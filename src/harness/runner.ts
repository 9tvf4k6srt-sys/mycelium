import { cpSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { ManualClock } from '../core/clock.js';
import { makeEvent } from '../core/events.js';
import { asRunId, makeId } from '../core/ids.js';
import { Journal } from '../core/journal.js';
import { type Result, err, ok } from '../core/result.js';
import { type MemoryStore, createMemoryStore } from '../memory/store.js';
import { wilsonInterval } from '../telemetry/trends.js';
import { type Agent, CHECK_MS, parseTurn } from './agent.js';
import { corpusHash, loadCorpus, runCheck } from './task.js';

/** Configuration of one harness run. */
export interface RunConfig {
  /** Root directory of the task corpus (one subdirectory per task). */
  corpusDir: string;
  /** Seed for run and event ids; identical seeds reproduce identical journals. */
  seed: number;
  /** Total passes over the corpus. Memory accrues across passes. Default 1. */
  repeatEach?: number;
  /** Per-task turn cap. Default: the task's candidate count. */
  maxTurns?: number;
}

/** Aggregate result of one harness run, derived from the journal. */
export interface RunSummary {
  agent: string;
  seed: number;
  corpusHash: string;
  /** Unique tasks in the corpus. */
  tasks: number;
  /** Total attempts (tasks × repeatEach). */
  attempts: number;
  solved: number;
  failed: number;
  totalTurns: number;
  meanTurns: number;
  solveRate: number;
  /** Wilson 95% interval for the solve rate. */
  wilson95: [number, number];
  eventHash: string;
}

/** task_failed reason when the agent tried every candidate it had. */
export const REASON_EXHAUSTED = 'candidates exhausted without a passing fix';

/**
 * task_failed reason when the agent claimed a solve but the runner's
 * independent re-verification failed (ADR-0001: claims are not ground truth).
 */
export const REASON_VERIFICATION_FAILED = 'agent claimed solve but checks failed';

/**
 * Run an agent against a corpus, journaling every step.
 *
 * Per attempt: copy the fixture into a fresh mkdtemp workDir, let the agent
 * loop over candidates, then — whenever the agent claims a solve — re-run the
 * checks independently (ADR-0001). The workDir is always deleted afterwards
 * and no path ever enters the journal, so identical seeds yield identical
 * event hashes. Memory (when provided) is shared across all attempts, which
 * is the mechanism demo: pass 2 of a memory-first run is a retrieval run.
 */
export function runHarness(
  agent: Agent,
  config: RunConfig,
  deps: { clock: ManualClock; memory?: MemoryStore | null },
): Result<{ summary: RunSummary; journal: Journal }, Error> {
  const loaded = loadCorpus(config.corpusDir);
  if (!loaded.ok) {
    return err(loaded.error);
  }
  const tasks = loaded.value;
  const clock = deps.clock;
  const memory: MemoryStore | null = deps.memory === undefined ? createMemoryStore(clock) : deps.memory;
  const repeatEach = Math.max(1, Math.floor(config.repeatEach ?? 1));
  const cHash = corpusHash(tasks);
  const runId = asRunId(makeId('run', `${agent.name}:${config.seed}:${cHash}`));
  const journal = new Journal();
  let eventSeq = 0;
  const eventSeed = (): string => `${config.seed}:${eventSeq++}`;

  journal.append(
    makeEvent('run_started', clock.now(), runId, eventSeed(), {
      agent: agent.name,
      seed: config.seed,
      corpusHash: cHash,
    }),
  );

  let solved = 0;
  let failed = 0;
  let totalTurns = 0;
  const occurrences = new Map<string, number>();

  for (let pass = 0; pass < repeatEach; pass++) {
    for (const task of tasks) {
      const attemptNo = (occurrences.get(task.id) ?? 0) + 1;
      occurrences.set(task.id, attemptNo);
      journal.append(
        makeEvent('task_started', clock.now(), runId, eventSeed(), { taskId: task.id, attempt: attemptNo }),
      );

      const workDir = mkdtempSync(join(tmpdir(), 'mycelium-'));
      try {
        cpSync(task.fixtureDir, workDir, { recursive: true });
        const knownPatternIds = new Set(memory?.patterns().map((p) => p.id) ?? []);
        const attempt = agent.attempt(task, {
          workDir,
          memory,
          clock,
          maxTurns: config.maxTurns ?? task.candidates.length,
        });
        for (const line of attempt.transcript) {
          const rec = parseTurn(line);
          if (rec === null) {
            continue;
          }
          journal.append(
            makeEvent('fix_attempted', rec.at, runId, eventSeed(), {
              taskId: task.id,
              candidateIndex: rec.candidateIndex,
              patternId: rec.patternId,
            }),
          );
        }
        let finalSolved = attempt.solved;
        let reason = REASON_EXHAUSTED;
        if (attempt.solved) {
          // ADR-0001: never trust the claim — re-verify against ground truth.
          let verified = true;
          for (const check of task.checks) {
            clock.advance(CHECK_MS);
            if (!runCheck(check, workDir)) {
              verified = false;
              break;
            }
          }
          if (!verified) {
            finalSolved = false;
            reason = REASON_VERIFICATION_FAILED;
          }
        }
        totalTurns += attempt.turns;
        if (finalSolved) {
          solved += 1;
          journal.append(
            makeEvent('task_solved', clock.now(), runId, eventSeed(), {
              taskId: task.id,
              turns: attempt.turns,
            }),
          );
          const breakage = memory?.breakages().find((b) => b.signature === task.signature);
          if (breakage !== undefined) {
            journal.append(makeEvent('breakage_recorded', clock.now(), runId, eventSeed(), { breakage }));
          }
        } else {
          failed += 1;
          journal.append(
            makeEvent('task_failed', clock.now(), runId, eventSeed(), {
              taskId: task.id,
              turns: attempt.turns,
              reason,
            }),
          );
        }
        for (const pattern of memory?.patterns() ?? []) {
          if (!knownPatternIds.has(pattern.id)) {
            journal.append(makeEvent('pattern_learned', clock.now(), runId, eventSeed(), { pattern }));
          }
        }
      } finally {
        rmSync(workDir, { recursive: true, force: true });
      }
    }
  }

  journal.append(makeEvent('run_finished', clock.now(), runId, eventSeed(), { solved, failed, totalTurns }));

  const attempts = solved + failed;
  const summary: RunSummary = {
    agent: agent.name,
    seed: config.seed,
    corpusHash: cHash,
    tasks: tasks.length,
    attempts,
    solved,
    failed,
    totalTurns,
    meanTurns: attempts === 0 ? 0 : totalTurns / attempts,
    solveRate: attempts === 0 ? 0 : solved / attempts,
    wilson95: wilsonInterval(solved, attempts),
    eventHash: journal.eventHash(),
  };
  return ok({ summary, journal });
}
