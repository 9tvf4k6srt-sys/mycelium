import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { DAY_MS } from '../core/clock.js';
import { asPatternId } from '../core/ids.js';
import type { FixPattern } from '../core/types.js';
import { DEFAULT_HALF_LIFE_MS, jaccard, recencyDecay } from './features.js';
import { matchPatterns } from './matcher.js';

const tokenSet = fc.array(fc.stringMatching(/^[a-z]{2,10}$/), { maxLength: 8 }).map((a) => new Set(a));

describe('jaccard', () => {
  it('treats two empty sets as identical; disjoint sets score 0', () => {
    expect(jaccard(new Set(), new Set())).toBe(1);
    expect(jaccard(new Set(['a']), new Set(['b']))).toBe(0);
    expect(jaccard(new Set(['a', 'b']), new Set(['b', 'c']))).toBeCloseTo(1 / 3, 12);
  });

  it('property: reflexive, symmetric, bounded in [0,1]', () => {
    fc.assert(
      fc.property(tokenSet, tokenSet, (a, b) => {
        expect(jaccard(a, a)).toBe(1);
        expect(jaccard(a, b)).toBe(jaccard(b, a));
        expect(jaccard(a, b)).toBeGreaterThanOrEqual(0);
        expect(jaccard(a, b)).toBeLessThanOrEqual(1);
      }),
    );
  });
});

describe('recencyDecay', () => {
  it('is 1 at age 0, 0.5 at one half-life, clamps negative ages to 1', () => {
    expect(recencyDecay(0, DAY_MS)).toBe(1);
    expect(recencyDecay(DAY_MS, DAY_MS)).toBe(0.5);
    expect(recencyDecay(-1000, DAY_MS)).toBe(1);
    expect(DEFAULT_HALF_LIFE_MS).toBe(14 * DAY_MS);
  });

  it('property: bounded in [0,1] and non-increasing as age grows', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 3650 }),
        fc.integer({ min: 1, max: 365 }),
        (ageDays, halfLifeDays) => {
          const decay = recencyDecay(ageDays * DAY_MS, halfLifeDays * DAY_MS);
          expect(decay).toBeGreaterThanOrEqual(0);
          expect(decay).toBeLessThanOrEqual(1);
          expect(recencyDecay((ageDays + 1) * DAY_MS, halfLifeDays * DAY_MS)).toBeLessThanOrEqual(decay);
        },
      ),
    );
  });
});

let patternCounter = 0;
const mkPattern = (over: Partial<FixPattern>): FixPattern => {
  patternCounter += 1;
  return {
    id: asPatternId(`pat_auto${patternCounter}`),
    signature: 'sig',
    area: 'a',
    fix: 'f',
    confidence: 0.5,
    seen: 1,
    successes: 1,
    failures: 0,
    lastUsed: null,
    createdAt: 0,
    ...over,
  };
};

const patternArb: fc.Arbitrary<FixPattern> = fc.record({
  id: fc.stringMatching(/^[a-z0-9]{4,12}$/).map((s) => asPatternId(`pat_${s}`)),
  signature: fc.constantFrom('typeerror at <path>', 'error expected <n> got <n>', 'enoent open <path>'),
  area: fc.constantFrom('math', 'async'),
  fix: fc.string({ maxLength: 20 }),
  confidence: fc.double({ min: 0, max: 1, noNaN: true }),
  seen: fc.nat(100),
  successes: fc.nat(100),
  failures: fc.nat(100),
  lastUsed: fc.option(fc.nat({ max: 20_000 }), { nil: null }),
  createdAt: fc.nat({ max: 20_000 }),
});

describe('matchPatterns', () => {
  it('scores jaccard * confidence * recencyDecay and explains all three factors', () => {
    const p = mkPattern({ signature: 'typeerror at <path>', confidence: 0.75, lastUsed: 0 });
    const matches = matchPatterns('typeerror at <path>', [p], { now: DEFAULT_HALF_LIFE_MS });
    const m = matches[0];
    if (!m) {
      throw new Error('expected one match');
    }
    expect(matches).toHaveLength(1);
    expect(m.score).toBeCloseTo(1 * 0.75 * 0.5, 12);
    expect(m.why).toEqual(['similarity=1.000 confidence=0.750 recency=0.500']);
  });

  it('falls back to createdAt when lastUsed is null', () => {
    const stale = mkPattern({ signature: 'sig tokens', confidence: 1, lastUsed: null, createdAt: 100 });
    const used = mkPattern({ signature: 'sig tokens', confidence: 1, lastUsed: 100, createdAt: 0 });
    const now = 100 + DEFAULT_HALF_LIFE_MS;
    expect(matchPatterns('sig tokens', [stale], { now })[0]?.score).toBeCloseTo(0.5, 12);
    expect(matchPatterns('sig tokens', [used], { now })[0]?.score).toBeCloseTo(0.5, 12);
  });

  it('applies default threshold 0.05 and default limit 5', () => {
    const strong = Array.from({ length: 8 }, () =>
      mkPattern({ signature: 'typeerror at <path>', confidence: 0.9, lastUsed: 0 }),
    );
    expect(matchPatterns('typeerror at <path>', strong, { now: 0 })).toHaveLength(5);
    const weak = [mkPattern({ signature: 'typeerror at <path>', confidence: 0.04, lastUsed: 0 })];
    expect(matchPatterns('typeerror at <path>', weak, { now: 0 })).toEqual([]);
    expect(matchPatterns('typeerror at <path>', [], { now: 0 })).toEqual([]);
  });

  it('breaks score ties by pattern id asc', () => {
    const b = mkPattern({ id: asPatternId('pat_bbb'), signature: 'same sig', confidence: 0.5, createdAt: 0 });
    const a = mkPattern({ id: asPatternId('pat_aaa'), signature: 'same sig', confidence: 0.5, createdAt: 0 });
    expect(matchPatterns('same sig', [b, a], { now: 0 }).map((m) => m.pattern.id)).toEqual([
      'pat_aaa',
      'pat_bbb',
    ]);
  });

  it('property: score in [0,1], ordered desc with id tie-break, why non-empty, threshold/limit respected', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('typeerror at <path>', 'error expected <n> got <n>', 'unrelated query'),
        fc.array(patternArb, { maxLength: 12 }),
        fc.nat({ max: 20_000 }),
        fc.double({ min: 0, max: 1, noNaN: true }),
        fc.nat(10),
        (query, patterns, now, threshold, limit) => {
          const matches = matchPatterns(query, patterns, { now, threshold, limit });
          expect(matches.length).toBeLessThanOrEqual(limit);
          expect(matches.length).toBeLessThanOrEqual(patterns.length);
          for (let i = 0; i < matches.length; i += 1) {
            const m = matches[i];
            if (!m) {
              throw new Error('index within bounds');
            }
            expect(m.score).toBeGreaterThanOrEqual(0);
            expect(m.score).toBeLessThanOrEqual(1);
            expect(m.score).toBeGreaterThanOrEqual(threshold);
            expect(m.why.length).toBeGreaterThan(0);
            expect(m.why[0]).toMatch(/^similarity=\d+\.\d{3} confidence=\d+\.\d{3} recency=\d+\.\d{3}$/);
            const prev = matches[i - 1];
            if (prev) {
              expect(prev.score).toBeGreaterThanOrEqual(m.score);
              if (prev.score === m.score) {
                expect(prev.pattern.id <= m.pattern.id).toBe(true);
              }
            }
          }
        },
      ),
    );
  });

  it('property: deterministic — same inputs give identical output', () => {
    fc.assert(
      fc.property(fc.array(patternArb, { maxLength: 8 }), fc.nat({ max: 20_000 }), (patterns, now) => {
        const first = matchPatterns('typeerror at <path>', patterns, { now });
        const second = matchPatterns('typeerror at <path>', patterns, { now });
        expect(second).toEqual(first);
      }),
    );
  });
});
