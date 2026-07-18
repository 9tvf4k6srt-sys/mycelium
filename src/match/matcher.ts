import type { FixPattern } from '../core/types.js';
import { signatureTokens } from '../memory/signature.js';
import { DEFAULT_HALF_LIFE_MS, jaccard, recencyDecay } from './features.js';

/** Options for matchPatterns. All fields optional; defaults keep scoring deterministic. */
export interface MatchOptions {
  /**
   * Reference timestamp for recency. Default 0: with real (positive)
   * timestamps the age clamps to 0 and recency is neutral (factor 1). Pass an
   * injected clock reading for time-aware scoring.
   */
  now?: number;
  /** Half-life for recency decay. Default DEFAULT_HALF_LIFE_MS (14 days). */
  halfLifeMs?: number;
  /** Max matches returned. Default 5; clamped to >= 0. */
  limit?: number;
  /** Minimum score (inclusive). Default 0.05. */
  threshold?: number;
}

/** A scored pattern with a human-readable explanation of every score factor. */
export interface Match {
  pattern: FixPattern;
  score: number;
  why: string[];
}

/** Default maximum number of matches returned. */
export const DEFAULT_MATCH_LIMIT = 5;

/** Default minimum score (inclusive) for a match to be returned. */
export const DEFAULT_MATCH_THRESHOLD = 0.05;

/**
 * Rank fix patterns against a query signature (expected pre-normalized via
 * normalizeSignature; tokenization itself is case-insensitive).
 *
 * score = jaccard(tokens(query), tokens(p.signature)) * p.confidence *
 *         recencyDecay(now - (p.lastUsed ?? p.createdAt), halfLifeMs)
 *
 * Invariant: score ∈ [0, 1]; results sorted by score desc, ties by pattern id
 * asc; only scores >= threshold kept; at most limit returned.
 * `why` carries the three factors at 3 decimals, e.g.
 * "similarity=0.667 confidence=0.750 recency=0.891".
 */
export function matchPatterns(
  querySignature: string,
  patterns: readonly FixPattern[],
  opts: MatchOptions = {},
): Match[] {
  const now = opts.now ?? 0;
  const halfLifeMs = opts.halfLifeMs ?? DEFAULT_HALF_LIFE_MS;
  const limit = Math.max(0, Math.floor(opts.limit ?? DEFAULT_MATCH_LIMIT));
  const threshold = opts.threshold ?? DEFAULT_MATCH_THRESHOLD;
  const queryTokens = signatureTokens(querySignature);

  const matches: Match[] = [];
  for (const pattern of patterns) {
    const similarity = jaccard(queryTokens, signatureTokens(pattern.signature));
    const recency = recencyDecay(now - (pattern.lastUsed ?? pattern.createdAt), halfLifeMs);
    const score = similarity * pattern.confidence * recency;
    if (score >= threshold) {
      matches.push({
        pattern,
        score,
        why: [
          `similarity=${similarity.toFixed(3)} confidence=${pattern.confidence.toFixed(3)} recency=${recency.toFixed(3)}`,
        ],
      });
    }
  }
  matches.sort(
    (a, b) => b.score - a.score || (a.pattern.id < b.pattern.id ? -1 : a.pattern.id > b.pattern.id ? 1 : 0),
  );
  return matches.slice(0, limit);
}
