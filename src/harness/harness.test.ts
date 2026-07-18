import { cpSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ManualClock } from '../core/clock.js';
import { createMemoryStore } from '../memory/store.js';
import { type Agent, applyCandidate, fixedOrderSolver, memoryFirstSolver } from './agent.js';
import { compareRuns } from './compare.js';
import { REASON_VERIFICATION_FAILED, type RunSummary, runHarness } from './runner.js';
import { loadCorpus, runTaskChecks } from './task.js';

const CORPUS_DIR = 'fixtures/tasks';
/** Fixture checks spawn real node processes; keep timeouts generous. */
const SLOW = 120_000;

function run(agent: Agent, seed: number, repeatEach: number, withMemory: boolean) {
  const clock = new ManualClock(0);
  return runHarness(
    agent,
    { corpusDir: CORPUS_DIR, seed, repeatEach },
    { clock, memory: withMemory ? createMemoryStore(clock) : null },
  );
}

describe('harness runner', () => {
  it(
    'is deterministic: two full runs (same seed, fresh memory+clock) give identical journals',
    { timeout: SLOW },
    () => {
      const a = run(memoryFirstSolver(), 42, 2, true);
      const b = run(memoryFirstSolver(), 42, 2, true);
      expect(a.ok && b.ok).toBe(true);
      if (!a.ok || !b.ok) {
        return;
      }
      expect(a.value.summary.eventHash).toBe(b.value.summary.eventHash);
      expect(a.value.journal.toJSONL()).toBe(b.value.journal.toJSONL());
    },
  );

  it(
    'mechanism effect: memory-first cuts mean turns below baseline, both solve everything',
    { timeout: SLOW },
    () => {
      const baseline = run(fixedOrderSolver(), 42, 2, false);
      const treatment = run(memoryFirstSolver(), 42, 2, true);
      expect(baseline.ok && treatment.ok).toBe(true);
      if (!baseline.ok || !treatment.ok) {
        return;
      }
      const b = baseline.value.summary;
      const t = treatment.value.summary;
      expect(b.corpusHash).toBe(t.corpusHash);
      expect(b.solveRate).toBe(1);
      expect(t.solveRate).toBe(1);
      expect(t.meanTurns).toBeLessThan(b.meanTurns);
      // Exact expectations for this corpus: correct candidates sit at indices 2,1,2,1.
      expect(b.totalTurns).toBe(20);
      expect(b.meanTurns).toBe(2.5);
      // Pass 1 pays the search cost; pass 2 is retrieval (1 turn per task).
      expect(t.totalTurns).toBe(14);
      expect(t.meanTurns).toBe(1.75);
      const solved = treatment.value.journal.ofType('task_solved');
      expect(solved.filter((e) => e.turns === 1)).toHaveLength(4);
      // One pattern learned per task, all on pass 1; breakage journaled per solve.
      expect(treatment.value.journal.ofType('pattern_learned')).toHaveLength(4);
      expect(treatment.value.journal.ofType('breakage_recorded')).toHaveLength(8);
      const memoryHits = treatment.value.journal.ofType('fix_attempted').filter((e) => e.patternId !== null);
      expect(memoryHits).toHaveLength(4);
      // Baseline never records anything.
      expect(baseline.value.journal.ofType('pattern_learned')).toHaveLength(0);
      expect(baseline.value.journal.ofType('breakage_recorded')).toHaveLength(0);
    },
  );

  it('re-verification catches an agent that lies about solving (ADR-0001)', { timeout: SLOW }, () => {
    const liar: Agent = {
      name: 'liar',
      attempt: () => ({ solved: true, turns: 1, usedPatternId: null, transcript: [] }),
    };
    const result = run(liar, 7, 1, false);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.value.summary.solved).toBe(0);
    expect(result.value.summary.failed).toBe(result.value.summary.attempts);
    const failedEvents = result.value.journal.ofType('task_failed');
    expect(failedEvents).toHaveLength(4);
    for (const e of failedEvents) {
      expect(e.reason).toBe(REASON_VERIFICATION_FAILED);
    }
    expect(result.value.journal.ofType('task_solved')).toHaveLength(0);
  });
});

describe('compareRuns', () => {
  const fakeSummary = (over: Partial<RunSummary>): RunSummary => ({
    agent: 'agent',
    seed: 42,
    corpusHash: 'aaa',
    tasks: 4,
    attempts: 8,
    solved: 8,
    failed: 0,
    totalTurns: 20,
    meanTurns: 2.5,
    solveRate: 1,
    wilson95: [0.6, 1],
    eventHash: 'hash',
    ...over,
  });

  it('flags a corpusHash mismatch as an unfair A/B and states repeatEach', () => {
    const report = compareRuns(fakeSummary({ corpusHash: 'left' }), fakeSummary({ corpusHash: 'right' }));
    expect(report.notes.some((n) => n.includes('MISMATCH') && n.includes('NOT a fair A/B'))).toBe(true);
    expect(report.notes.some((n) => n.includes('repeatEach') && n.includes('baseline=2'))).toBe(true);
    const fair = compareRuns(fakeSummary({}), fakeSummary({}));
    expect(fair.notes.some((n) => n.includes('corpusHash identical'))).toBe(true);
    expect(fair.notes.some((n) => n.includes('NOT a fair A/B'))).toBe(false);
  });

  it('computes deltas as treatment minus baseline', () => {
    const report = compareRuns(
      fakeSummary({ meanTurns: 2.5, solveRate: 1 }),
      fakeSummary({ meanTurns: 1.75, solveRate: 0.75, solved: 6, failed: 2 }),
    );
    expect(report.meanTurnsDelta).toBeCloseTo(-0.75, 10);
    expect(report.solveRateDelta).toBeCloseTo(-0.25, 10);
  });
});

describe('fixture corpus self-test', () => {
  it(
    'every raw fixture fails its checks; exactly one candidate (never the first) passes',
    { timeout: SLOW },
    () => {
      const corpus = loadCorpus(CORPUS_DIR);
      expect(corpus.ok).toBe(true);
      if (!corpus.ok) {
        return;
      }
      const tasks = corpus.value;
      expect(tasks).toHaveLength(4);
      const ids = tasks.map((t) => t.id);
      expect([...ids].sort()).toEqual(ids);
      // Normalized signatures must be distinct so memory keys never collide.
      expect(new Set(tasks.map((t) => t.signature)).size).toBe(tasks.length);
      for (const task of tasks) {
        const workDir = mkdtempSync(join(tmpdir(), 'fixture-selftest-'));
        try {
          cpSync(task.fixtureDir, workDir, { recursive: true });
          expect(runTaskChecks(task.checks, workDir)).toBe(false);
          const passing: number[] = [];
          task.candidates.forEach((candidate, index) => {
            rmSync(workDir, { recursive: true, force: true });
            cpSync(task.fixtureDir, workDir, { recursive: true });
            applyCandidate(workDir, candidate);
            if (runTaskChecks(task.checks, workDir)) {
              passing.push(index);
            }
          });
          expect(passing).toHaveLength(1);
          expect(passing[0]).toBeGreaterThan(0);
        } finally {
          rmSync(workDir, { recursive: true, force: true });
        }
      }
    },
  );
});
