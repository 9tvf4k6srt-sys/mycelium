import type { RunSummary } from './runner.js';

/** Side-by-side A/B verdict for two run summaries. */
export interface CompareReport {
  baseline: RunSummary;
  treatment: RunSummary;
  /** treatment.solveRate − baseline.solveRate. */
  solveRateDelta: number;
  /** treatment.meanTurns − baseline.meanTurns; negative means the treatment is cheaper. */
  meanTurnsDelta: number;
  /** Fairness and context statements — the comparison displays its own doubts. */
  notes: string[];
}

/** Passes over the corpus, derived from attempts / unique tasks. */
function passesPerTask(s: RunSummary): string {
  if (s.tasks <= 0) {
    return 'n/a';
  }
  const passes = s.attempts / s.tasks;
  return Number.isInteger(passes) ? String(passes) : passes.toFixed(2);
}

/**
 * Compare two run summaries as an A/B experiment.
 * Invariant: notes ALWAYS state whether the corpora match (a hash mismatch is
 * not a fair A/B) and the derived repeatEach of both runs.
 */
export function compareRuns(baseline: RunSummary, treatment: RunSummary): CompareReport {
  const notes: string[] = [];
  if (baseline.corpusHash === treatment.corpusHash) {
    notes.push(`corpusHash identical (${baseline.corpusHash.slice(0, 12)}…): fair A/B on the same corpus`);
  } else {
    notes.push(
      `corpusHash MISMATCH (baseline ${baseline.corpusHash.slice(0, 12)}… vs ` +
        `treatment ${treatment.corpusHash.slice(0, 12)}…): NOT a fair A/B — different corpora were evaluated`,
    );
  }
  notes.push(
    `repeatEach: baseline=${passesPerTask(baseline)}, treatment=${passesPerTask(treatment)} (attempts / unique tasks)`,
  );
  if (baseline.seed !== treatment.seed) {
    notes.push(
      `seed differs (baseline=${baseline.seed}, treatment=${treatment.seed}): journals are not pair-matched`,
    );
  }
  return {
    baseline,
    treatment,
    solveRateDelta: treatment.solveRate - baseline.solveRate,
    meanTurnsDelta: treatment.meanTurns - baseline.meanTurns,
    notes,
  };
}
