import { DAY_MS } from '../core/clock.js';

/**
 * Jaccard similarity |A ∩ B| / |A ∪ B|.
 * Invariant: result ∈ [0, 1]; reflexive (jaccard(s, s) = 1); symmetric.
 * Invariant: ∅ vs ∅ → 1 — two empty token sets are identical, not undefined.
 */
export function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) {
    return 1;
  }
  let intersection = 0;
  for (const x of a) {
    if (b.has(x)) {
      intersection += 1;
    }
  }
  const union = a.size + b.size - intersection;
  return intersection / union;
}

/**
 * Exponential recency decay: 2^(-ageMs / halfLifeMs).
 * Invariant: result ∈ (0, 1]; age 0 → 1; negative ages clamp to 0 (no boost
 * for future timestamps). Degenerate halfLifeMs <= 0: fresh → 1, else → 0.
 */
export function recencyDecay(ageMs: number, halfLifeMs: number): number {
  const age = Math.max(0, ageMs);
  if (halfLifeMs <= 0) {
    return age === 0 ? 1 : 0;
  }
  return 2 ** (-age / halfLifeMs);
}

/** Default half-life for match scoring: 14 days. */
export const DEFAULT_HALF_LIFE_MS = 14 * DAY_MS;
