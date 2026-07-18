import { describe, expect, it } from 'vitest';
import { ManualClock } from './clock.js';
import { makeEvent } from './events.js';
import { contentHash, stableStringify } from './hash.js';
import { asRunId } from './ids.js';
import { Journal } from './journal.js';
import { andThen, err, map, ok } from './result.js';

describe('stableStringify', () => {
  it('is key-order independent', () => {
    expect(stableStringify({ b: 1, a: 2 })).toBe(stableStringify({ a: 2, b: 1 }));
  });

  it('preserves array order', () => {
    expect(stableStringify([1, 2])).not.toBe(stableStringify([2, 1]));
  });

  it('contentHash is stable for equal canonical values', () => {
    expect(contentHash({ x: [1, { y: 2 }] })).toBe(contentHash({ x: [1, { y: 2 }] }));
  });
});

describe('ManualClock', () => {
  it('advances monotonically and refuses to go backwards', () => {
    const c = new ManualClock(100);
    c.advance(50);
    expect(c.now()).toBe(150);
    expect(() => c.advance(-1)).toThrow();
  });
});

describe('makeEvent', () => {
  const runId = asRunId('run_test');

  it('is deterministic for identical inputs', () => {
    const a = makeEvent('heartbeat', 1000, runId, 's1', { system: 'x' });
    const b = makeEvent('heartbeat', 1000, runId, 's1', { system: 'x' });
    expect(a.id).toBe(b.id);
  });

  it('differs when payload differs', () => {
    const a = makeEvent('heartbeat', 1000, runId, 's1', { system: 'x' });
    const b = makeEvent('heartbeat', 1000, runId, 's1', { system: 'y' });
    expect(a.id).not.toBe(b.id);
  });
});

describe('Journal', () => {
  it('JSONL round-trip preserves eventHash', () => {
    const runId = asRunId('run_rt');
    const j = new Journal();
    j.append(makeEvent('run_started', 0, runId, 's', { agent: 'a', seed: 1, corpusHash: 'h' }));
    j.append(makeEvent('system_executed', 10, runId, 's', { system: 'watcher' }));
    j.append(makeEvent('heartbeat', 20, runId, 's', { system: 'watcher' }));

    const restored = Journal.fromJSONL(j.toJSONL());
    expect(restored.eventHash()).toBe(j.eventHash());
    expect(restored.ofType('heartbeat')).toHaveLength(1);
    expect(restored.forRun(runId)).toHaveLength(3);
  });
});

describe('Result', () => {
  it('map and andThen short-circuit on err', () => {
    const good = andThen(ok(2), (n) => ok(n * 3));
    expect(good).toEqual({ ok: true, value: 6 });

    const bad = andThen(err('boom'), (n: number) => ok(n * 3));
    expect(bad).toEqual({ ok: false, error: 'boom' });

    expect(map(ok(1), (n) => n + 1)).toEqual({ ok: true, value: 2 });
    expect(map(err('x'), (n: number) => n + 1)).toEqual({ ok: false, error: 'x' });
  });
});
