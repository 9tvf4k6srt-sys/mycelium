import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { DAY_MS } from '../core/clock.js';
import { makeEvent } from '../core/events.js';
import type { MyceliumEvent } from '../core/events.js';
import { asRunId } from '../core/ids.js';
import { healthReport, lastRealRun, scoreSubsystem } from './scoring.js';
import { eventRate, wilsonInterval } from './trends.js';

const runId = asRunId('run_telemetry_test');
const NOW = 1_000 * DAY_MS;
const hb = (system: string, at: number, seed: string): MyceliumEvent =>
  makeEvent('heartbeat', at, runId, seed, { system });
const exec = (system: string, at: number, seed: string): MyceliumEvent =>
  makeEvent('system_executed', at, runId, seed, { system });
interface ScoreOpts {
  graceDays?: number;
  decayPerDay?: number;
  floor?: number;
}
const score1 = (execAt: number, now = NOW, opts?: ScoreOpts) =>
  scoreSubsystem('sys', [exec('sys', execAt, 'e')], now, opts);

describe('wilsonInterval', () => {
  it('matches the textbook 95% interval for 50/100', () => {
    const [lo, hi] = wilsonInterval(50, 100);
    expect(lo).toBeCloseTo(0.4038, 4);
    expect(hi).toBeCloseTo(0.5962, 4);
  });
  it('zero trials means total uncertainty [0, 1]', () => {
    expect(wilsonInterval(0, 0)).toEqual([0, 1]);
  });
  it('respects the extremes: all-fail lo ~ 0, all-pass hi ~ 1', () => {
    expect(wilsonInterval(0, 8)[0]).toBeCloseTo(0, 9);
    expect(wilsonInterval(8, 8)[1]).toBeCloseTo(1, 9);
  });
  it('rejects invalid counts and z', () => {
    expect(() => wilsonInterval(3, 2)).toThrow();
    expect(() => wilsonInterval(-1, 2)).toThrow();
    expect(() => wilsonInterval(1, 2, 0)).toThrow();
  });
  it('stays within [0, 1] and contains p-hat (property)', () => {
    const countsArb = fc
      .integer({ min: 0, max: 5000 })
      .chain((trials) => fc.tuple(fc.integer({ min: 0, max: trials }), fc.constant(trials)));
    fc.assert(
      fc.property(countsArb, fc.double({ min: 0.5, max: 5, noNaN: true }), ([successes, trials], z) => {
        const [lo, hi] = wilsonInterval(successes, trials, z);
        expect(lo).toBeGreaterThanOrEqual(0);
        expect(hi).toBeLessThanOrEqual(1);
        expect(lo).toBeLessThanOrEqual(hi);
        if (trials > 0) {
          const pHat = successes / trials;
          // epsilon guards last-ulp float rounding at the interval edges
          expect(lo).toBeLessThanOrEqual(pHat + 1e-9);
          expect(hi).toBeGreaterThanOrEqual(pHat - 1e-9);
        }
      }),
      { numRuns: 500 },
    );
  });
});

describe('eventRate', () => {
  const at = (daysAgo: number) => NOW - daysAgo * DAY_MS;
  it('counts only the requested type inside the trailing window, ends inclusive', () => {
    const events = [
      hb('sys', at(0), 'a'), // at now — in
      hb('sys', at(7), 'b'), // at window start — in
      hb('sys', at(7.000_001), 'c'), // just outside — out
      hb('sys', NOW + DAY_MS, 'd'), // future — out
      exec('sys', at(1), 'e'), // other type — out
    ];
    expect(eventRate(events, 'heartbeat', 7, NOW)).toEqual({ count: 2, windowDays: 7, perDay: 2 / 7 });
  });
  it('returns 0 for an empty journal and rejects non-positive windows', () => {
    expect(eventRate([], 'heartbeat', 7, NOW)).toEqual({ count: 0, windowDays: 7, perDay: 0 });
    expect(() => eventRate([], 'heartbeat', 0, NOW)).toThrow();
    expect(() => eventRate([], 'heartbeat', -3, NOW)).toThrow();
  });
  it('matches an independent recount (property)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 60 }),
        fc.array(fc.nat({ max: 120 }), { maxLength: 100 }),
        (windowDays, ages) => {
          const events = ages.map((d, i) => hb('s', NOW - d * DAY_MS, `e${i}`));
          const rate = eventRate(events, 'heartbeat', windowDays, NOW);
          expect(rate.count).toBe(ages.filter((d) => d <= windowDays).length);
          expect(rate.perDay).toBe(rate.count / windowDays);
        },
      ),
    );
  });
});

describe('lastRealRun', () => {
  it('returns null without execution evidence, however many heartbeats', () => {
    expect(lastRealRun([], 'sys')).toBeNull();
    expect(lastRealRun([hb('sys', NOW, 'h1'), hb('sys', NOW + 1, 'h2')], 'sys')).toBeNull();
  });
  it('returns the latest execution timestamp for that system only', () => {
    const events = [
      exec('sys', NOW - 50, 'a'),
      hb('sys', NOW - 10, 'h'), // later heartbeat must be ignored
      exec('sys', NOW - 30, 'b'),
      exec('other', NOW - 5, 'c'),
    ];
    expect(lastRealRun(events, 'sys')).toBe(NOW - 30);
  });
});

describe('scoreSubsystem', () => {
  it('no real run ever → dormant at 0 with penalty', () => {
    const h = scoreSubsystem('sys', [hb('sys', NOW, 'h')], NOW);
    expect(h).toMatchObject({ score: 0, status: 'dormant', lastRealRun: null, ageDays: null });
    expect(h.penalties).toEqual(['never executed']);
  });
  it('within grace → 100 ok with no penalties', () => {
    const h = score1(NOW - 3 * DAY_MS);
    expect(h).toMatchObject({ score: 100, status: 'ok', ageDays: 3, penalties: [] });
    expect(h.lastRealRun).toBe(NOW - 3 * DAY_MS);
  });
  it('watch band: 8d → 95, 10d → 85 (threshold inclusive)', () => {
    expect(score1(NOW - 8 * DAY_MS)).toMatchObject({ score: 95, status: 'watch' });
    expect(score1(NOW - 10 * DAY_MS)).toMatchObject({ score: 85, status: 'watch' });
  });
  it('stale below 85: 11d → 80 with a penalty', () => {
    const h = score1(NOW - 11 * DAY_MS);
    expect(h).toMatchObject({ score: 80, status: 'stale', ageDays: 11 });
    expect(h.penalties).toHaveLength(1);
  });
  it('decay clamps at floor and the penalty says so', () => {
    const h = score1(NOW - 100 * DAY_MS);
    expect(h).toMatchObject({ score: 25, status: 'stale' });
    expect(h.penalties[0]).toContain('clamped at floor 25');
  });
  it('future-dated execution counts as age 0 (clock skew is not negative age)', () => {
    expect(score1(NOW + 5 * DAY_MS)).toMatchObject({ score: 100, status: 'ok', ageDays: 0 });
  });
  it('honours custom grace/decay/floor', () => {
    const opts = { graceDays: 0, decayPerDay: 10, floor: 50 };
    expect(score1(NOW - 10 * DAY_MS, NOW, opts)).toMatchObject({ score: 50, status: 'stale' });
  });
  it('rejects invalid options', () => {
    expect(() => score1(NOW, NOW, { graceDays: -1 })).toThrow();
    expect(() => score1(NOW, NOW, { decayPerDay: -1 })).toThrow();
    expect(() => score1(NOW, NOW, { floor: 101 })).toThrow();
  });
});

describe('honesty properties (ADR-0002, ADR-0003)', () => {
  // Heartbeats, telemetry, and OTHER systems' executions — never our execution.
  const t = fc.nat({ max: 2_000_000_000 });
  const dormantEventsArb = (system: string): fc.Arbitrary<MyceliumEvent[]> =>
    fc.array(
      fc.oneof(
        t.map((at) => hb(system, at, `hb:${at}`)),
        t.map((at) => hb('other-sys', at, `hbo:${at}`)),
        t.map((at) => exec('other-sys', at, `exo:${at}`)),
        t.map((at) => makeEvent('telemetry_sampled', at, runId, `ts:${at}`, { name: system, value: 1 })),
      ),
      { maxLength: 60 },
    );
  it('arbitrary heartbeat bursts with no system_executed stay dormant at 0 (property)', () => {
    const scenarioArb = fc
      .constantFrom('indexer', 'matcher', 'store')
      .chain((system) => fc.tuple(fc.constant(system), dormantEventsArb(system), fc.nat({ max: 4e9 })));
    fc.assert(
      fc.property(scenarioArb, ([system, events, now]) => {
        const h = scoreSubsystem(system, events, now);
        expect(h.score).toBe(0);
        expect(h.status).toBe('dormant');
        expect(h.lastRealRun).toBeNull();
        expect(h.ageDays).toBeNull();
        expect(h.penalties).toEqual(['never executed']);
      }),
      { numRuns: 300 },
    );
  });
  it('heartbeats are inert: adding any burst never changes a score (property)', () => {
    fc.assert(
      fc.property(
        fc.nat({ max: 2_000_000_000 }),
        fc.nat({ max: 2_000_000_000 }),
        fc.array(fc.nat({ max: 4_000_000_000 }), { maxLength: 40 }),
        (execAt, now, hbTimes) => {
          const base = [exec('indexer', execAt, 'exec')];
          const burst = hbTimes.map((at, i) => hb('indexer', at, `hb:${at}:${i}`));
          const withBurst = scoreSubsystem('indexer', [...base, ...burst], now);
          expect(withBurst).toEqual(scoreSubsystem('indexer', base, now));
        },
      ),
      { numRuns: 300 },
    );
  });
  it('score is non-increasing as age grows (property)', () => {
    const optsArb = fc.record({
      graceDays: fc.integer({ min: 0, max: 60 }),
      decayPerDay: fc.integer({ min: 0, max: 50 }),
      floor: fc.integer({ min: 0, max: 100 }),
    });
    fc.assert(
      fc.property(
        fc.nat({ max: 1_000_000_000 }),
        fc.nat({ max: 200 * DAY_MS }),
        fc.nat({ max: 200 * DAY_MS }),
        optsArb,
        (execAt, d1, d2, opts) => {
          const events = [exec('indexer', execAt, 'exec')];
          const early = scoreSubsystem('indexer', events, execAt + Math.min(d1, d2), opts).score;
          const late = scoreSubsystem('indexer', events, execAt + Math.max(d1, d2), opts).score;
          expect(late).toBeLessThanOrEqual(early);
        },
      ),
      { numRuns: 300 },
    );
  });
});

describe('healthReport', () => {
  const reportAtAge = (ageDays: number | null) =>
    healthReport(['sys'], ageDays === null ? [] : [exec('sys', NOW - ageDays * DAY_MS, 'e')], NOW);
  it('maps composite to grades A/B/C/D/F at the thresholds', () => {
    const cases: Array<[number | null, string]> = [
      [2, 'A'],
      [9, 'A'], // 90 — A boundary
      [11, 'B'], // 80 — B boundary
      [13, 'C'], // 70 — C boundary
      [15, 'D'], // 60 — D boundary
      [17, 'F'], // 50
      [null, 'F'], // dormant → 0
    ];
    for (const [age, grade] of cases) {
      expect(reportAtAge(age).grade).toBe(grade);
    }
  });
  it('empty system list → composite 0, grade F, explanatory note', () => {
    const r = healthReport([], [], NOW);
    expect(r).toMatchObject({ composite: 0, grade: 'F', subsystems: [], generatedAt: NOW });
    expect(r.honestyNotes).toHaveLength(1);
  });
  it('composite is the rounded mean; honestyNotes enumerate each non-ok subsystem', () => {
    const events = [exec('fresh', NOW - DAY_MS, 'a'), exec('aging', NOW - 9 * DAY_MS, 'b')];
    const r = healthReport(['fresh', 'aging', 'ghost'], events, NOW);
    expect(r.composite).toBe(63); // round((100 + 90 + 0) / 3)
    expect(r.honestyNotes).toHaveLength(2);
    expect(r.honestyNotes.some((n) => n.includes('aging') && n.includes('watch'))).toBe(true);
    expect(r.honestyNotes.some((n) => n.includes('ghost') && n.includes('dormant'))).toBe(true);
  });
  it('every non-ok subsystem appears in honestyNotes (property)', () => {
    const memberArb = fc.record({
      name: fc.string({ minLength: 1, maxLength: 10 }),
      ageDays: fc.option(fc.integer({ min: 0, max: 120 }), { nil: null }),
    });
    const membersArb = fc.uniqueArray(memberArb, { selector: (m) => m.name, minLength: 1, maxLength: 8 });
    fc.assert(
      fc.property(membersArb, (members) => {
        const events = members.flatMap((m) =>
          m.ageDays === null ? [] : [exec(m.name, NOW - m.ageDays * DAY_MS, `e:${m.name}`)],
        );
        const report = healthReport(
          members.map((m) => m.name),
          events,
          NOW,
        );
        const nonOk = report.subsystems.filter((s) => s.status !== 'ok');
        expect(report.honestyNotes).toHaveLength(nonOk.length);
        for (const s of nonOk) {
          expect(report.honestyNotes.some((n) => n.includes(s.name))).toBe(true);
        }
      }),
    );
  });
  it('ADR-0003 regression: keeping stale data scores worse than excluding it', () => {
    const events = [exec('fresh', NOW - DAY_MS, 'f'), exec('ancient', NOW - 22 * DAY_MS, 'a')];
    const withStale = healthReport(['fresh', 'ancient'], events, NOW);
    const excluded = healthReport(['fresh'], events, NOW);
    expect(withStale.subsystems.map((s) => s.score)).toEqual([100, 25]); // ancient clamped at floor
    expect(withStale.composite).toBe(63); // round(62.5)
    expect(excluded.composite).toBe(100);
    expect(withStale.composite).toBeLessThan(excluded.composite);
    expect(withStale.grade).toBe('D');
    expect(excluded.grade).toBe('A');
    expect(withStale.honestyNotes.some((n) => n.includes('ancient'))).toBe(true);
  });
});
