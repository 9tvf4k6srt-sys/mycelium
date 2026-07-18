import type { BreakageId, PatternId } from './ids.js';

/** A recorded failure mode, deduplicated by normalized signature. */
export interface Breakage {
  id: BreakageId;
  area: string;
  signature: string;
  description: string;
  firstSeen: number;
  lastSeen: number;
  occurrences: number;
}

/**
 * A fix that was tried for a breakage signature, with accumulated evidence.
 * Invariant: confidence = (successes + 1) / (seen + 2) (Laplace smoothing);
 * seen = successes + failures. Maintained by memory/store, not by callers.
 */
export interface FixPattern {
  id: PatternId;
  signature: string;
  area: string;
  fix: string;
  confidence: number;
  seen: number;
  successes: number;
  failures: number;
  lastUsed: number | null;
  createdAt: number;
}
