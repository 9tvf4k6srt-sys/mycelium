import type { Journal } from '../core/journal.js';
import { type Result, err, ok } from '../core/result.js';
import type { RunRecording } from './recorder.js';

/** Outcome of a successful determinism check: both runs produced this hash. */
export interface DeterminismMatch {
  match: true;
  hash: string;
}

/** Outcome of a failed determinism check, with both hashes for the report. */
export interface DeterminismMismatch {
  match: false;
  expected: string;
  actual: string;
}

/**
 * Re-run `rerun(rec.seed)` and compare full event sequences by canonical hash.
 *
 * Invariant: match ⇔ identical event sequences. The rerun must use ManualClock
 * and content-seeded ids so full event equality holds — any wall-clock or
 * random leakage shows up here as a mismatch, never silently.
 */
export function verifyDeterminism(
  rec: RunRecording,
  rerun: (seed: number) => Journal,
): Result<DeterminismMatch, DeterminismMismatch> {
  const actual = rerun(rec.seed).eventHash();
  if (actual === rec.eventHash) {
    return ok({ match: true, hash: rec.eventHash });
  }
  return err({ match: false, expected: rec.eventHash, actual });
}
