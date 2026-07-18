import type { Clock } from '../core/clock.js';
import { stableStringify } from '../core/hash.js';
import { type BreakageId, type PatternId, asBreakageId, asPatternId, makeId } from '../core/ids.js';
import { type Result, err, ok } from '../core/result.js';
import type { Breakage, FixPattern } from '../core/types.js';

/** Serializable form of a MemoryStore. Versioned for forward migration. */
export interface StoreSnapshot {
  version: 1;
  breakages: Breakage[];
  patterns: FixPattern[];
}

/**
 * Append-only evidence store for breakages and fix outcomes.
 *
 * Invariant: signatures are opaque keys — callers normalize them first
 * (see memory/signature). Ids are deterministic, content-seeded from the
 * upsert key, so identical histories serialize byte-identically.
 * Invariant: for every FixPattern, confidence = (successes + 1) / (seen + 2)
 * and seen = successes + failures (Laplace smoothing; maintained here only).
 */
export interface MemoryStore {
  /** Upsert by signature: on repeat, occurrences++ and lastSeen = now; first record's area/description win. */
  recordBreakage(input: { area: string; signature: string; description: string }): Breakage;
  /** Upsert by (signature, fix): seen++, successes|failures++, confidence re-Laplaced, lastUsed = now. */
  recordFixOutcome(input: { signature: string; area: string; fix: string; success: boolean }): FixPattern;
  /** All patterns. Returned records are copies; mutating them does not affect the store. */
  patterns(): readonly FixPattern[];
  /** All breakages. Returned records are copies; mutating them does not affect the store. */
  breakages(): readonly Breakage[];
  /** Exact signature match, sorted by confidence desc (ties by pattern id asc). */
  findPatterns(signature: string): readonly FixPattern[];
  /** Buffer.byteLength of the canonical snapshot JSON (stableStringify of snapshot()). */
  sizeBytes(): number;
  /** Canonical snapshot: arrays sorted by id so serialization is byte-stable. */
  snapshot(): StoreSnapshot;
}

/** Internal mutation surface for the trim module only; not part of the public contract. */
export interface MemoryStoreInternals {
  readonly clock: Clock;
  evictPattern(id: PatternId): boolean;
  evictBreakage(id: BreakageId): boolean;
}

const byId = (a: { id: string }, b: { id: string }): number => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

const laplace = (successes: number, seen: number): number => (successes + 1) / (seen + 2);

/** Upsert key for patterns: canonical tuple encoding, free of separator collisions. */
const patternKey = (signature: string, fix: string): string => stableStringify([signature, fix]);

/** Linear id lookup + delete; stores are small, so no id index is kept. */
function evictById<V extends { id: string }>(map: Map<string, V>, id: string): boolean {
  for (const [key, v] of map) {
    if (v.id === id) {
      map.delete(key);
      return true;
    }
  }
  return false;
}

class MemoryStoreImpl implements MemoryStore, MemoryStoreInternals {
  readonly clock: Clock;
  private readonly breakageByKey = new Map<string, Breakage>();
  private readonly patternByKey = new Map<string, FixPattern>();

  constructor(clock: Clock) {
    this.clock = clock;
  }

  recordBreakage(input: { area: string; signature: string; description: string }): Breakage {
    const now = this.clock.now();
    const existing = this.breakageByKey.get(input.signature);
    if (existing) {
      existing.occurrences += 1;
      existing.lastSeen = now;
      return { ...existing };
    }
    const created: Breakage = {
      id: asBreakageId(makeId('breakage', input.signature)),
      area: input.area,
      signature: input.signature,
      description: input.description,
      firstSeen: now,
      lastSeen: now,
      occurrences: 1,
    };
    this.breakageByKey.set(input.signature, created);
    return { ...created };
  }

  recordFixOutcome(input: { signature: string; area: string; fix: string; success: boolean }): FixPattern {
    const now = this.clock.now();
    const key = patternKey(input.signature, input.fix);
    const existing = this.patternByKey.get(key);
    if (existing) {
      existing.seen += 1;
      if (input.success) {
        existing.successes += 1;
      } else {
        existing.failures += 1;
      }
      existing.confidence = laplace(existing.successes, existing.seen);
      existing.lastUsed = now;
      return { ...existing };
    }
    const created: FixPattern = {
      id: asPatternId(makeId('pattern', key)),
      signature: input.signature,
      area: input.area,
      fix: input.fix,
      confidence: laplace(input.success ? 1 : 0, 1),
      seen: 1,
      successes: input.success ? 1 : 0,
      failures: input.success ? 0 : 1,
      lastUsed: now,
      createdAt: now,
    };
    this.patternByKey.set(key, created);
    return { ...created };
  }

  patterns(): readonly FixPattern[] {
    return [...this.patternByKey.values()].map((p) => ({ ...p }));
  }

  breakages(): readonly Breakage[] {
    return [...this.breakageByKey.values()].map((b) => ({ ...b }));
  }

  findPatterns(signature: string): readonly FixPattern[] {
    return this.patterns()
      .filter((p) => p.signature === signature)
      .sort((a, b) => b.confidence - a.confidence || byId(a, b));
  }

  sizeBytes(): number {
    return Buffer.byteLength(serializeStore(this), 'utf8');
  }

  snapshot(): StoreSnapshot {
    return {
      version: 1,
      breakages: [...this.breakages()].sort(byId),
      patterns: [...this.patterns()].sort(byId),
    };
  }

  evictPattern(id: PatternId): boolean {
    return evictById(this.patternByKey, id);
  }

  evictBreakage(id: BreakageId): boolean {
    return evictById(this.breakageByKey, id);
  }

  /** Bulk-load a validated snapshot, replacing current contents. Used by deserializeStore. */
  restore(snapshot: StoreSnapshot): void {
    this.breakageByKey.clear();
    this.patternByKey.clear();
    for (const b of snapshot.breakages) {
      this.breakageByKey.set(b.signature, { ...b });
    }
    for (const p of snapshot.patterns) {
      this.patternByKey.set(patternKey(p.signature, p.fix), { ...p });
    }
  }
}

/** Create an empty store reading time from the injected clock. */
export function createMemoryStore(clock: Clock): MemoryStore {
  return new MemoryStoreImpl(clock);
}

/** Internal bridge for trim: mutation surface of a store created here, or null for foreign implementations. */
export function storeInternals(store: MemoryStore): MemoryStoreInternals | null {
  return store instanceof MemoryStoreImpl ? store : null;
}

/** Canonical serialization: stableStringify of the snapshot. */
export function serializeStore(s: MemoryStore): string {
  return stableStringify(s.snapshot());
}

/**
 * Rebuild a store from canonical JSON. Structural validation only; stored
 * confidence values are trusted so round-trips preserve behavior exactly.
 */
export function deserializeStore(json: string, clock: Clock): Result<MemoryStore, Error> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch (cause) {
    return err(new Error(`invalid store JSON: ${cause instanceof Error ? cause.message : String(cause)}`));
  }
  const validated = validateSnapshot(parsed);
  if (!validated.ok) {
    return validated;
  }
  const store = new MemoryStoreImpl(clock);
  store.restore(validated.value);
  return ok(store);
}

function validateSnapshot(parsed: unknown): Result<StoreSnapshot, Error> {
  if (!isRecord(parsed)) {
    return err(new Error('store snapshot must be an object'));
  }
  if (parsed.version !== 1) {
    return err(new Error('unsupported store snapshot version'));
  }
  if (!Array.isArray(parsed.breakages) || !Array.isArray(parsed.patterns)) {
    return err(new Error('store snapshot must contain breakages and patterns arrays'));
  }
  const breakages: Breakage[] = [];
  for (const raw of parsed.breakages) {
    const b = parseBreakage(raw);
    if (!b) {
      return err(new Error('invalid breakage entry in store snapshot'));
    }
    breakages.push(b);
  }
  const patterns: FixPattern[] = [];
  for (const raw of parsed.patterns) {
    const p = parseFixPattern(raw);
    if (!p) {
      return err(new Error('invalid fix pattern entry in store snapshot'));
    }
    patterns.push(p);
  }
  return ok({ version: 1, breakages, patterns });
}

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x);
}

const isStr = (x: unknown): x is string => typeof x === 'string';
const isNum = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);

function parseBreakage(x: unknown): Breakage | null {
  if (!isRecord(x)) {
    return null;
  }
  if (!isStr(x.id) || !isStr(x.area) || !isStr(x.signature) || !isStr(x.description)) {
    return null;
  }
  if (!isNum(x.firstSeen) || !isNum(x.lastSeen) || !isNum(x.occurrences) || x.occurrences < 0) {
    return null;
  }
  return {
    id: asBreakageId(x.id),
    area: x.area,
    signature: x.signature,
    description: x.description,
    firstSeen: x.firstSeen,
    lastSeen: x.lastSeen,
    occurrences: x.occurrences,
  };
}

function parseFixPattern(x: unknown): FixPattern | null {
  if (!isRecord(x)) {
    return null;
  }
  if (!isStr(x.id) || !isStr(x.signature) || !isStr(x.area) || !isStr(x.fix)) {
    return null;
  }
  if (!isNum(x.confidence) || x.confidence < 0 || x.confidence > 1) {
    return null;
  }
  if (!isNum(x.seen) || !isNum(x.successes) || !isNum(x.failures) || !isNum(x.createdAt)) {
    return null;
  }
  if (x.seen < 0 || x.successes < 0 || x.failures < 0 || (x.lastUsed !== null && !isNum(x.lastUsed))) {
    return null;
  }
  return {
    id: asPatternId(x.id),
    signature: x.signature,
    area: x.area,
    fix: x.fix,
    confidence: x.confidence,
    seen: x.seen,
    successes: x.successes,
    failures: x.failures,
    lastUsed: x.lastUsed,
    createdAt: x.createdAt,
  };
}
