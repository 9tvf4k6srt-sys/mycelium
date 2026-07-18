import { DAY_MS } from '../core/clock.js';
import type { BreakageId, PatternId } from '../core/ids.js';
import type { Breakage, FixPattern } from '../core/types.js';
import { type MemoryStore, storeInternals } from './store.js';

/** Recency window for trim weights: 30 days. */
const RECENCY_WINDOW_MS = 30 * DAY_MS;

/**
 * 2^(-(now - t) / 30d), clamped to [0, 1]. Future timestamps (t > now) clamp
 * to 1. Not exported per contract.
 */
function recencyFactor(t: number, now: number): number {
  const factor = 2 ** (-(now - t) / RECENCY_WINDOW_MS);
  return Math.min(1, Math.max(0, factor));
}

/**
 * Eviction weight of a fix pattern: confidence * log2(2 + seen) * recency.
 * Invariant: higher-confidence, better-evidenced, recently-used patterns weigh more.
 */
export function weightPattern(p: FixPattern, now: number): number {
  return p.confidence * Math.log2(2 + p.seen) * recencyFactor(p.lastUsed ?? p.createdAt, now);
}

/**
 * Eviction weight of a breakage: log2(1 + occurrences) * recency.
 * Invariant: frequently-seen, recently-seen breakages weigh more.
 */
export function weightBreakage(b: Breakage, now: number): number {
  return Math.log2(1 + b.occurrences) * recencyFactor(b.lastSeen, now);
}

/** Outcome of a trim pass, for journaling/telemetry. */
export interface TrimReport {
  beforeBytes: number;
  afterBytes: number;
  evictedPatterns: number;
  evictedBreakages: number;
}

type Candidate =
  | { kind: 'pattern'; id: PatternId; weight: number; ts: number }
  | { kind: 'breakage'; id: BreakageId; weight: number; ts: number };

/**
 * Evict lowest-value entries until the store fits budgetBytes.
 *
 * Invariant: strictly lowest-weight first, across BOTH maps — keyed maps are
 * NOT exempt (cf. audit 2026-07-05). Deterministic for equal weights:
 * older recency timestamp first (patterns: lastUsed ?? createdAt; breakages:
 * lastSeen), then id asc. Never trims a non-empty store below 1 entry, even
 * when one entry already exceeds the budget.
 */
export function trimToBudget(store: MemoryStore, budgetBytes: number): TrimReport {
  const beforeBytes = store.sizeBytes();
  const report: TrimReport = {
    beforeBytes,
    afterBytes: beforeBytes,
    evictedPatterns: 0,
    evictedBreakages: 0,
  };
  if (beforeBytes <= budgetBytes) {
    return report;
  }
  const internals = storeInternals(store);
  if (!internals) {
    throw new Error('trimToBudget: store was not created by createMemoryStore/deserializeStore');
  }
  const now = internals.clock.now();
  const candidates: Candidate[] = [
    ...store.patterns().map((p) => ({
      kind: 'pattern' as const,
      id: p.id,
      weight: weightPattern(p, now),
      ts: p.lastUsed ?? p.createdAt,
    })),
    ...store
      .breakages()
      .map((b) => ({ kind: 'breakage' as const, id: b.id, weight: weightBreakage(b, now), ts: b.lastSeen })),
  ];
  candidates.sort((a, b) => a.weight - b.weight || a.ts - b.ts || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  let remaining = candidates.length;
  for (const c of candidates) {
    if (remaining <= 1 || store.sizeBytes() <= budgetBytes) {
      break;
    }
    const evicted = c.kind === 'pattern' ? internals.evictPattern(c.id) : internals.evictBreakage(c.id);
    if (evicted) {
      remaining -= 1;
      if (c.kind === 'pattern') {
        report.evictedPatterns += 1;
      } else {
        report.evictedBreakages += 1;
      }
    }
  }
  report.afterBytes = store.sizeBytes();
  return report;
}
