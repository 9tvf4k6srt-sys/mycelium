import { realpathSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { ManualClock } from '../src/core/clock.js';
import type { Journal } from '../src/core/journal.js';
import { fixedOrderSolver, memoryFirstSolver } from '../src/harness/agent.js';
import { compareRuns } from '../src/harness/compare.js';
import { compareToMarkdown } from '../src/harness/report.js';
import { type RunSummary, runHarness } from '../src/harness/runner.js';
import { recordRun } from '../src/replay/recorder.js';
import { verifyDeterminism } from '../src/replay/runner.js';

/** One full A/B run pair, journals retained for replay verification. */
export interface Comparison {
  baseline: { summary: RunSummary; journal: Journal };
  treatment: { summary: RunSummary; journal: Journal };
  markdown: string;
}

/**
 * Run the baseline (fixed order, no memory) and the treatment (memory-first)
 * against the same corpus and render the A/B markdown.
 * Invariant: both runs share seed and corpus — the only difference is memory.
 */
export function compareCorpus(corpusDir: string, seed: number, repeatEach: number): Comparison {
  const baseline = runHarness(
    fixedOrderSolver(),
    { corpusDir, seed, repeatEach },
    { clock: new ManualClock(0), memory: null },
  );
  if (!baseline.ok) {
    throw new Error(`baseline run failed: ${baseline.error.message}`);
  }
  const treatment = runHarness(
    memoryFirstSolver(),
    { corpusDir, seed, repeatEach },
    { clock: new ManualClock(0) },
  );
  if (!treatment.ok) {
    throw new Error(`treatment run failed: ${treatment.error.message}`);
  }
  return {
    baseline: baseline.value,
    treatment: treatment.value,
    markdown: compareToMarkdown(compareRuns(baseline.value.summary, treatment.value.summary)),
  };
}

/** The demo's result: printable output plus the machine-readable pieces. */
export interface DemoResult {
  output: string;
  baseline: RunSummary;
  treatment: RunSummary;
  determinismHash: string;
}

/**
 * The deterministic demo: A/B on fixtures/tasks (seed 42, repeatEach 2,
 * ManualClock(0)), then a replay proof that the treatment run reproduces
 * byte-for-byte. Paths are relative to the repo-root cwd.
 * Invariant: identical checkout ⇒ identical output, byte for byte.
 */
export function runDemo(corpusDir = 'fixtures/tasks', seed = 42, repeatEach = 2): DemoResult {
  const cmp = compareCorpus(corpusDir, seed, repeatEach);
  const rec = recordRun(
    seed,
    cmp.treatment.summary.agent,
    cmp.treatment.summary.corpusHash,
    cmp.treatment.journal,
  );
  const verdict = verifyDeterminism(rec, (rerunSeed) => {
    const fresh = runHarness(
      memoryFirstSolver(),
      { corpusDir, seed: rerunSeed, repeatEach },
      { clock: new ManualClock(0) },
    );
    if (!fresh.ok) {
      throw new Error(`determinism rerun failed: ${fresh.error.message}`);
    }
    return fresh.value.journal;
  });
  if (!verdict.ok) {
    throw new Error(`determinism mismatch: expected ${verdict.error.expected}, got ${verdict.error.actual}`);
  }
  return {
    output: `${cmp.markdown}\n\ndeterminism: verified (hash ${verdict.value.hash.slice(0, 12)}…)`,
    baseline: cmp.baseline.summary,
    treatment: cmp.treatment.summary,
    determinismHash: verdict.value.hash,
  };
}

const invokedDirectly =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href;
if (invokedDirectly) {
  process.stdout.write(`${runDemo().output}\n`);
}
