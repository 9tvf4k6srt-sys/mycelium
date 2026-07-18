import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { ManualClock } from '../core/clock.js';
import type { FixPattern } from '../core/types.js';
import { normalizeSignature, signatureTokens } from './signature.js';
import { type MemoryStore, createMemoryStore, deserializeStore, serializeStore } from './store.js';
import { trimToBudget, weightBreakage, weightPattern } from './trim.js';

const word = fc.stringMatching(/^[a-z]{2,12}$/);
const pathLike = fc
  .tuple(fc.array(word, { minLength: 2, maxLength: 4 }), fc.constantFrom('js', 'ts', 'json'))
  .map(([segs, ext]) => `${segs.join('/')}.${ext}`);

describe('normalizeSignature', () => {
  it('collapses path, number, case, punctuation (SPEC example + windows paths)', () => {
    expect(normalizeSignature('TypeError at src/cart.js:42:7')).toBe('typeerror at <path>');
    expect(normalizeSignature('typeerror at lib/x.js:9:1')).toBe('typeerror at <path>');
    expect(normalizeSignature('Error:  open   C:\\tmp\\a.log  failed (code 3)')).toBe(
      'error open <path> failed code <n>',
    );
  });

  it('property: stable across path/number/case/whitespace variation', () => {
    const variant = fc.record({
      head: word,
      tail: word,
      pathA: pathLike,
      pathB: pathLike,
      n1: fc.nat(),
      n2: fc.nat(),
      upper: fc.boolean(),
      pad: fc.constantFrom(' ', '  ', '\t'),
    });
    fc.assert(
      fc.property(variant, (v) => {
        const rawA = `${v.head} at ${v.pathA}:${v.n1}:${v.n2}${v.pad}${v.tail}`;
        const rawB = `${v.head} at ${v.pathB}:${v.n2}:${v.n1} ${v.tail}`;
        const a = v.upper ? rawA.toUpperCase() : rawA;
        expect(normalizeSignature(a)).toBe(normalizeSignature(rawB));
      }),
    );
  });

  it('property: idempotent, lowercase, single-spaced', () => {
    fc.assert(
      fc.property(fc.string(), (s) => {
        const once = normalizeSignature(s);
        expect(normalizeSignature(once)).toBe(once);
        expect(once).toBe(once.toLowerCase());
        expect(once).not.toMatch(/\s{2,}|^\s|\s$/);
      }),
    );
  });
});

describe('signatureTokens', () => {
  it('unwraps <path>/<n> into tokens path/n and drops tokens shorter than 2', () => {
    expect(signatureTokens('typeerror at <path> <n> x y zz')).toEqual(
      new Set(['typeerror', 'at', 'path', 'n', 'zz']),
    );
  });

  it('property: lowercase alnum tokens; placeholders survive the length filter', () => {
    fc.assert(
      fc.property(fc.string(), (s) => {
        const tokens = signatureTokens(s);
        for (const t of tokens) {
          expect(t).toMatch(/^[a-z0-9]+$/);
          if (t !== 'n') {
            expect(t.length).toBeGreaterThanOrEqual(2);
          }
        }
        const lower = s.toLowerCase();
        // 'n' can only come from the <n> placeholder; 'path' may also be a plain word
        expect(tokens.has('n')).toBe(lower.includes('<n>'));
        if (lower.includes('<path>')) {
          expect(tokens.has('path')).toBe(true);
        }
      }),
    );
  });
});

type Op =
  | { kind: 'breakage'; area: string; signature: string; description: string }
  | { kind: 'fix'; signature: string; area: string; fix: string; success: boolean };

const SIGS = ['typeerror at <path>', 'error expected <n> got <n>', 'enoent open <path>'] as const;
const sigArb = fc.constantFrom(...SIGS);
const opArb: fc.Arbitrary<Op> = fc.oneof(
  fc.record({
    kind: fc.constant('breakage' as const),
    area: fc.constantFrom('math', 'async'),
    signature: sigArb,
    description: fc.string({ maxLength: 24 }),
  }),
  fc.record({
    kind: fc.constant('fix' as const),
    signature: sigArb,
    area: fc.constantFrom('math', 'async'),
    fix: fc.constantFrom('add await', 'fix bounds', 'round late'),
    success: fc.boolean(),
  }),
);
const historyArb = fc.array(opArb, { maxLength: 40 });

const replay = (ops: Op[]): { store: MemoryStore; clock: ManualClock } => {
  const clock = new ManualClock(10_000);
  const store = createMemoryStore(clock);
  for (const op of ops) {
    clock.advance(1000);
    if (op.kind === 'breakage') {
      store.recordBreakage(op);
    } else {
      store.recordFixOutcome(op);
    }
  }
  return { store, clock };
};

describe('MemoryStore', () => {
  it('upserts breakages by signature; first area/description wins', () => {
    const clock = new ManualClock(1000);
    const store = createMemoryStore(clock);
    const first = store.recordBreakage({ area: 'math', signature: 's', description: 'd1' });
    clock.advance(500);
    const second = store.recordBreakage({ area: 'x', signature: 's', description: 'd2' });
    expect(second.id).toBe(first.id);
    expect(second.occurrences).toBe(2);
    expect([second.firstSeen, second.lastSeen]).toEqual([1000, 1500]);
    expect(second.description).toBe('d1');
    expect(store.breakages()).toHaveLength(1);
  });

  it('upserts patterns by (signature, fix) with Laplace confidence', () => {
    const store = createMemoryStore(new ManualClock(0));
    let p = store.recordFixOutcome({ signature: 's', area: 'a', fix: 'f1', success: true });
    expect(p.confidence).toBeCloseTo(2 / 3, 12);
    p = store.recordFixOutcome({ signature: 's', area: 'a', fix: 'f1', success: false });
    expect(p.confidence).toBeCloseTo(2 / 4, 12);
    p = store.recordFixOutcome({ signature: 's', area: 'a', fix: 'f1', success: true });
    expect([p.seen, p.successes, p.failures, p.confidence]).toEqual([3, 2, 1, 3 / 5]);
    store.recordFixOutcome({ signature: 's', area: 'a', fix: 'f2', success: true });
    expect(store.patterns()).toHaveLength(2);
  });

  it('findPatterns: exact signature only, confidence desc', () => {
    const store = createMemoryStore(new ManualClock(0));
    store.recordFixOutcome({ signature: 's', area: 'a', fix: 'low', success: true });
    store.recordFixOutcome({ signature: 's', area: 'a', fix: 'low', success: false });
    store.recordFixOutcome({ signature: 's', area: 'a', fix: 'high', success: true });
    store.recordFixOutcome({ signature: 'other', area: 'a', fix: 'x', success: true });
    expect(store.findPatterns('s').map((p) => p.fix)).toEqual(['high', 'low']);
    expect(store.findPatterns('missing')).toEqual([]);
  });

  it('property: confidence = (successes+1)/(seen+2), in (0,1), seen = successes + failures', () => {
    fc.assert(
      fc.property(fc.array(fc.boolean(), { minLength: 1, maxLength: 50 }), (outcomes) => {
        const store = createMemoryStore(new ManualClock(0));
        let last: FixPattern | undefined;
        for (const success of outcomes) {
          last = store.recordFixOutcome({ signature: 's', area: 'a', fix: 'f', success });
        }
        if (!last) {
          throw new Error('minLength 1 guarantees a recorded outcome');
        }
        const successes = outcomes.filter(Boolean).length;
        expect(last.seen).toBe(outcomes.length);
        expect(last.seen).toBe(last.successes + last.failures);
        expect(last.confidence).toBe((successes + 1) / (outcomes.length + 2));
        expect(last.confidence).toBeGreaterThan(0);
        expect(last.confidence).toBeLessThan(1);
      }),
    );
  });

  it('property: confidence strictly increases with successes at fixed failures', () => {
    fc.assert(
      fc.property(fc.nat(20), fc.integer({ min: 1, max: 20 }), (s, f) => {
        const record = (successes: number, failures: number): number => {
          const store = createMemoryStore(new ManualClock(0));
          const outcomes = [...Array<boolean>(successes).fill(true), ...Array<boolean>(failures).fill(false)];
          for (const success of outcomes) {
            store.recordFixOutcome({ signature: 's', area: 'a', fix: 'f', success });
          }
          const only = store.patterns()[0];
          if (!only) {
            throw new Error('pattern expected after recording outcomes');
          }
          return only.confidence;
        };
        expect(record(s + 1, f)).toBeGreaterThan(record(s, f));
      }),
    );
  });
});

describe('serializeStore / deserializeStore', () => {
  it('rejects invalid input', () => {
    const clock = new ManualClock(0);
    expect(deserializeStore('not json', clock).ok).toBe(false);
    expect(deserializeStore('{"version":2,"breakages":[],"patterns":[]}', clock).ok).toBe(false);
    expect(deserializeStore('{"version":1,"breakages":[{}],"patterns":[]}', clock).ok).toBe(false);
  });

  it('property: round-trip preserves serialization and query behavior', () => {
    fc.assert(
      fc.property(historyArb, (ops) => {
        const { store } = replay(ops);
        const restored = deserializeStore(serializeStore(store), new ManualClock(0));
        expect(restored.ok).toBe(true);
        if (!restored.ok) {
          return;
        }
        expect(serializeStore(restored.value)).toBe(serializeStore(store));
        for (const sig of [...SIGS, 'missing']) {
          expect(restored.value.findPatterns(sig)).toEqual(store.findPatterns(sig));
        }
      }),
    );
  });
});

describe('trimToBudget', () => {
  it('is a no-op when already within budget', () => {
    const store = createMemoryStore(new ManualClock(0));
    store.recordBreakage({ area: 'a', signature: 's', description: 'd' });
    const before = serializeStore(store);
    const size = store.sizeBytes();
    const report = trimToBudget(store, size);
    expect(report).toEqual({ beforeBytes: size, afterBytes: size, evictedPatterns: 0, evictedBreakages: 0 });
    expect(serializeStore(store)).toBe(before);
  });

  it('evicts a stale breakage before a fresh strong pattern (keyed maps not exempt)', () => {
    const clock = new ManualClock(0);
    const store = createMemoryStore(clock);
    store.recordBreakage({ area: 'a', signature: 'old', description: 'd' });
    clock.advance(60 * 86_400_000);
    store.recordFixOutcome({ signature: 's', area: 'a', fix: 'f', success: true });
    store.recordFixOutcome({ signature: 's', area: 'a', fix: 'f', success: true });
    const report = trimToBudget(store, store.sizeBytes() - 1);
    expect(report.evictedBreakages).toBe(1);
    expect(store.breakages()).toHaveLength(0);
    expect(store.patterns()).toHaveLength(1);
  });

  it('never trims a non-empty store to empty, even at budget 0', () => {
    const store = createMemoryStore(new ManualClock(0));
    store.recordBreakage({ area: 'a', signature: 'only', description: 'd' });
    const report = trimToBudget(store, 0);
    expect(report.evictedBreakages + report.evictedPatterns).toBe(0);
    expect(store.breakages()).toHaveLength(1);
  });

  it('property: budget respected when reachable; evicted set is exactly the lowest-weight prefix', () => {
    fc.assert(
      fc.property(historyArb, fc.nat(), (ops, budgetSeed) => {
        const { store, clock } = replay(ops);
        const before = store.sizeBytes();
        const total = store.patterns().length + store.breakages().length;
        const budget = total === 0 ? 0 : budgetSeed % (before + 1);
        const now = clock.now();
        const order = [
          ...store.patterns().map((p) => ({
            key: `p:${p.id}`,
            id: p.id as string,
            weight: weightPattern(p, now),
            ts: p.lastUsed ?? p.createdAt,
          })),
          ...store.breakages().map((b) => ({
            key: `b:${b.id}`,
            id: b.id as string,
            weight: weightBreakage(b, now),
            ts: b.lastSeen,
          })),
        ].sort((a, b) => a.weight - b.weight || a.ts - b.ts || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
        const report = trimToBudget(store, budget);
        const remainingKeys = new Set([
          ...store.patterns().map((p) => `p:${p.id}`),
          ...store.breakages().map((b) => `b:${b.id}`),
        ]);
        const evicted = order.filter((c) => !remainingKeys.has(c.key)).map((c) => c.key);
        const evictedCount = report.evictedPatterns + report.evictedBreakages;
        expect(evicted).toEqual(order.slice(0, evictedCount).map((c) => c.key));
        const remaining = store.patterns().length + store.breakages().length;
        expect(remaining).toBe(total - evictedCount);
        if (total > 0) {
          expect(remaining).toBeGreaterThanOrEqual(1);
        }
        if (remaining > 1) {
          expect(report.afterBytes).toBeLessThanOrEqual(budget);
        }
        expect(report.afterBytes).toBeLessThanOrEqual(report.beforeBytes);
      }),
    );
  });
});
