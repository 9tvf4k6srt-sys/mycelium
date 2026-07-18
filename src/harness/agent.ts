import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { type Clock, ManualClock } from '../core/clock.js';
import { stableStringify } from '../core/hash.js';
import type { PatternId } from '../core/ids.js';
import { matchPatterns } from '../match/matcher.js';
import type { MemoryStore } from '../memory/store.js';
import { type CandidateFix, type Task, runCheck } from './task.js';

/** Clock cost of one agent turn (choosing and applying a candidate). */
export const TURN_MS = 1000;

/** Clock cost of one check execution. */
export const CHECK_MS = 100;

/** Everything an agent may use during one attempt. Memory is null for baselines. */
export interface AttemptContext {
  /** Scratch directory holding a copy of the task fixture; the agent edits files here. */
  workDir: string;
  /** Shared memory store, or null (baseline agents never learn). */
  memory: MemoryStore | null;
  clock: Clock;
  /** Maximum number of candidate fixes the agent may try. */
  maxTurns: number;
}

/** Outcome of one task attempt. */
export interface AgentAttempt {
  solved: boolean;
  /** Candidates tried (winning position in try order, 1-based). */
  turns: number;
  /** Pattern that nominated the winning candidate, or null when memory was not used. */
  usedPatternId: PatternId | null;
  /** One JSON-encoded {@link TurnRecord} per turn; the runner journals these as fix_attempted. */
  transcript: string[];
}

/** An honest mechanism stand-in for an LLM agent. The interface is the extension point. */
export interface Agent {
  name: string;
  attempt(task: Task, ctx: AttemptContext): AgentAttempt;
}

/** Machine-readable record of one turn; one per transcript line. */
export interface TurnRecord {
  /** 1-based position in try order. */
  turn: number;
  /** Index into task.candidates (listed order). */
  candidateIndex: number;
  /** Memory pattern that nominated this candidate, or null. */
  patternId: PatternId | null;
  /** Whether the checks passed with this candidate applied. */
  passed: boolean;
  /** Clock reading after this turn's checks ran. */
  at: number;
}

/** Parse one transcript line (a JSON-encoded {@link TurnRecord}). Null for foreign lines. */
export function parseTurn(line: string): TurnRecord | null {
  let r: unknown;
  try {
    r = JSON.parse(line);
  } catch {
    return null;
  }
  if (typeof r !== 'object' || r === null || Array.isArray(r)) {
    return null;
  }
  const rec = r as Record<string, unknown>;
  if (
    typeof rec.turn !== 'number' ||
    typeof rec.candidateIndex !== 'number' ||
    typeof rec.passed !== 'boolean' ||
    typeof rec.at !== 'number' ||
    (rec.patternId !== null && typeof rec.patternId !== 'string')
  ) {
    return null;
  }
  return {
    turn: rec.turn,
    candidateIndex: rec.candidateIndex,
    patternId: rec.patternId as PatternId | null,
    passed: rec.passed,
    at: rec.at,
  };
}

/**
 * Apply one candidate to workDir: replace the FIRST occurrence of `find`. A candidate
 * whose `find` is absent is a no-op — the checks fail, the honest outcome for a wrong edit.
 */
export function applyCandidate(workDir: string, candidate: CandidateFix): void {
  const path = join(workDir, candidate.file);
  const original = readFileSync(path, 'utf8');
  const next = original.includes(candidate.find)
    ? original.replace(candidate.find, candidate.replace)
    : original;
  writeFileSync(path, next);
}

interface OrderedCandidate {
  index: number;
  candidate: CandidateFix;
  patternId: PatternId | null;
}

interface LoopResult {
  attempt: AgentAttempt;
  winning: CandidateFix | null;
  lastTried: CandidateFix | null;
}

/** Advance the clock when it is manual; a system clock advances itself. */
function advance(clock: Clock, ms: number): void {
  if (clock instanceof ManualClock) {
    clock.advance(ms);
  }
}

/**
 * The shared turn loop: try candidates in the given order, one turn each.
 * Every turn starts from the ORIGINAL file content (candidates never stack),
 * applies the edit, then runs the task checks in workDir (exit 0 = pass).
 * Clock: +1000ms per turn, +100ms per check execution, pass or fail.
 */
function runCandidateLoop(task: Task, ctx: AttemptContext, ordered: readonly OrderedCandidate[]): LoopResult {
  const pristine = new Map<string, string>();
  const pristineContent = (file: string): string => {
    let content = pristine.get(file);
    if (content === undefined) {
      content = readFileSync(join(ctx.workDir, file), 'utf8');
      pristine.set(file, content);
    }
    return content;
  };
  const transcript: string[] = [];
  let lastTried: CandidateFix | null = null;
  const limit = Math.max(0, Math.min(ctx.maxTurns, ordered.length));
  for (let pos = 0; pos < limit; pos++) {
    const entry = ordered[pos];
    if (entry === undefined) {
      break;
    }
    advance(ctx.clock, TURN_MS);
    writeFileSync(join(ctx.workDir, entry.candidate.file), pristineContent(entry.candidate.file));
    applyCandidate(ctx.workDir, entry.candidate);
    let passed = true;
    for (const check of task.checks) {
      advance(ctx.clock, CHECK_MS);
      if (!runCheck(check, ctx.workDir)) {
        passed = false;
        break;
      }
    }
    const rec: TurnRecord = {
      turn: pos + 1,
      candidateIndex: entry.index,
      patternId: entry.patternId,
      passed,
      at: ctx.clock.now(),
    };
    transcript.push(JSON.stringify(rec));
    lastTried = entry.candidate;
    if (passed) {
      return {
        attempt: { solved: true, turns: pos + 1, usedPatternId: entry.patternId, transcript },
        winning: entry.candidate,
        lastTried,
      };
    }
  }
  return {
    attempt: { solved: false, turns: transcript.length, usedPatternId: null, transcript },
    winning: null,
    lastTried,
  };
}

/** Canonical key for a candidate, so a pattern's `fix` JSON identifies it regardless of key order. */
function candidateKey(candidate: CandidateFix): string {
  return stableStringify(candidate);
}

function keyFromFixJson(fix: string): string | null {
  try {
    return stableStringify(JSON.parse(fix));
  } catch {
    return null;
  }
}

const listedOrder = (task: Task): OrderedCandidate[] =>
  task.candidates.map((candidate, index) => ({ index, candidate, patternId: null }));

/**
 * Baseline: tries candidates in listed order and never touches memory.
 * Invariant: turns = index of the correct candidate + 1, on every pass —
 * this is what the memory-first treatment is measured against.
 */
export function fixedOrderSolver(): Agent {
  return {
    name: 'fixed-order',
    attempt: (task, ctx) => runCandidateLoop(task, ctx, listedOrder(task)).attempt,
  };
}

/**
 * Order candidates by memory: matchPatterns nominates candidates whose JSON
 * encoding appears in a matched pattern's `fix` field. Ties (and unmatched
 * candidates) fall back to listed order.
 * Invariant: foreign matches never reorder, so pass-1 ordering equals the baseline's.
 */
function orderByMemory(task: Task, ctx: AttemptContext): OrderedCandidate[] {
  const listed = listedOrder(task);
  const memory = ctx.memory;
  if (memory === null) {
    return listed;
  }
  const patterns = memory.patterns();
  if (patterns.length === 0) {
    return listed;
  }
  const matches = matchPatterns(task.signature, patterns, {
    now: ctx.clock.now(),
    limit: Math.max(patterns.length, 5),
  });
  const indexByKey = new Map<string, number>();
  for (const [index, candidate] of task.candidates.entries()) {
    indexByKey.set(candidateKey(candidate), index);
  }
  // Matches arrive sorted by score descending — the first hit per candidate wins.
  const best = new Map<number, { patternId: PatternId; score: number }>();
  for (const match of matches) {
    const key = keyFromFixJson(match.pattern.fix);
    if (key === null) {
      continue;
    }
    const index = indexByKey.get(key);
    if (index === undefined || best.has(index)) {
      continue;
    }
    best.set(index, { patternId: match.pattern.id, score: match.score });
  }
  return listed
    .map((entry) => ({ ...entry, hit: best.get(entry.index) }))
    .sort((a, b) => (b.hit?.score ?? -1) - (a.hit?.score ?? -1) || a.index - b.index)
    .map((entry) => ({
      index: entry.index,
      candidate: entry.candidate,
      patternId: entry.hit?.patternId ?? null,
    }));
}

/** The fix outcome to record for a finished loop: success on the winner, else failure on the last tried. */
function fixOutcomeOf(result: LoopResult): { fix: CandidateFix; success: boolean } | null {
  if (result.winning !== null) {
    return { fix: result.winning, success: true };
  }
  if (result.lastTried !== null) {
    return { fix: result.lastTried, success: false };
  }
  return null;
}

/**
 * Treatment: memory-first ordering. On solve it records the winning fix
 * (success: true) plus the breakage; on exhaustion it records the LAST tried
 * fix with success: false. With memory: null it records nothing.
 * Invariant: a memory hit puts the known-good candidate first ⇒ turns = 1.
 */
export function memoryFirstSolver(): Agent {
  return {
    name: 'memory-first',
    attempt(task: Task, ctx: AttemptContext): AgentAttempt {
      const result = runCandidateLoop(task, ctx, orderByMemory(task, ctx));
      const memory = ctx.memory;
      const outcome = fixOutcomeOf(result);
      if (memory !== null && outcome !== null) {
        memory.recordFixOutcome({
          signature: task.signature,
          area: task.area,
          fix: JSON.stringify(outcome.fix),
          success: outcome.success,
        });
        if (outcome.success) {
          memory.recordBreakage({
            signature: task.signature,
            area: task.area,
            description: task.description,
          });
        }
      }
      return result.attempt;
    },
  };
}
