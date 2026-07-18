import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { ManualClock } from '../core/clock.js';
import { makeEvent } from '../core/events.js';
import { asRunId, makeId } from '../core/ids.js';
import { Journal } from '../core/journal.js';
import { recordRun } from './recorder.js';
import { verifyDeterminism } from './runner.js';

/**
 * Scripted stand-in for an agent run: every event derives from `seed` via
 * ManualClock timestamps and content-seeded ids — no wall clock, no RNG,
 * so full event equality is achievable and verifiable.
 */
function scriptedRun(seed: number): Journal {
  const clock = new ManualClock(1_700_000_000_000);
  const runId = asRunId(makeId('run', `scripted:${seed}`));
  const journal = new Journal();
  journal.append(
    makeEvent('run_started', clock.now(), runId, `s${seed}:start`, {
      agent: 'scripted',
      seed,
      corpusHash: 'corpus-v1',
    }),
  );
  for (let i = 0; i < 4; i++) {
    clock.advance(1000);
    journal.append(
      makeEvent('system_executed', clock.now(), runId, `s${seed}:exec:${i}`, {
        system: 'indexer',
        detail: `pass ${i}`,
      }),
    );
    clock.advance(100);
    journal.append(makeEvent('heartbeat', clock.now(), runId, `s${seed}:hb:${i}`, { system: 'indexer' }));
  }
  clock.advance(1000);
  journal.append(
    makeEvent('run_finished', clock.now(), runId, `s${seed}:end`, { solved: 3, failed: 1, totalTurns: 9 }),
  );
  return journal;
}

describe('scripted determinism (ManualClock + seeded ids)', () => {
  it('identical seeds give identical eventHash (property)', () => {
    fc.assert(
      fc.property(fc.integer(), (seed) => {
        expect(scriptedRun(seed).eventHash()).toBe(scriptedRun(seed).eventHash());
      }),
    );
  });

  it('different seeds give different eventHashes (property)', () => {
    fc.assert(
      fc.property(
        fc.tuple(fc.integer(), fc.integer()).filter(([a, b]) => a !== b),
        ([a, b]) => {
          expect(scriptedRun(a).eventHash()).not.toBe(scriptedRun(b).eventHash());
        },
      ),
    );
  });

  it('event sequence survives a JSONL round trip', () => {
    const journal = scriptedRun(42);
    expect(Journal.fromJSONL(journal.toJSONL()).eventHash()).toBe(journal.eventHash());
  });
});

describe('recordRun', () => {
  it('captures version, seed, agent, corpus hash, events and eventHash', () => {
    const journal = scriptedRun(7);
    const rec = recordRun(7, 'scripted', 'corpus-v1', journal);
    expect(rec.version).toBe(1);
    expect(rec.seed).toBe(7);
    expect(rec.agentName).toBe('scripted');
    expect(rec.corpusHash).toBe('corpus-v1');
    expect(rec.events).toHaveLength(journal.all().length);
    expect(rec.eventHash).toBe(journal.eventHash());
  });

  it('is a snapshot: later journal appends never leak into the recording', () => {
    const journal = scriptedRun(7);
    const rec = recordRun(7, 'scripted', 'corpus-v1', journal);
    journal.append(makeEvent('heartbeat', 0, asRunId('run_late'), 'late', { system: 'indexer' }));
    expect(rec.events).toHaveLength(10);
    expect(rec.eventHash).not.toBe(journal.eventHash());
  });
});

describe('verifyDeterminism', () => {
  it('confirms a faithful rerun for arbitrary seeds (property)', () => {
    fc.assert(
      fc.property(fc.integer(), (seed) => {
        const rec = recordRun(seed, 'scripted', 'corpus-v1', scriptedRun(seed));
        expect(verifyDeterminism(rec, scriptedRun)).toEqual({
          ok: true,
          value: { match: true, hash: rec.eventHash },
        });
      }),
    );
  });

  it('re-runs with the recorded seed', () => {
    const rec = recordRun(123, 'scripted', 'corpus-v1', scriptedRun(123));
    const seen: number[] = [];
    const result = verifyDeterminism(rec, (seed) => {
      seen.push(seed);
      return scriptedRun(seed);
    });
    expect(seen).toEqual([123]);
    expect(result.ok).toBe(true);
  });

  it('reports both hashes on mismatch', () => {
    const rec = recordRun(1, 'scripted', 'corpus-v1', scriptedRun(1));
    const result = verifyDeterminism(rec, (seed) => scriptedRun(seed + 1));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toEqual({
        match: false,
        expected: rec.eventHash,
        actual: scriptedRun(2).eventHash(),
      });
    }
  });

  it('flags tampering: one extra event breaks the hash', () => {
    const rec = recordRun(5, 'scripted', 'corpus-v1', scriptedRun(5));
    const result = verifyDeterminism(rec, (seed) => {
      const journal = scriptedRun(seed);
      journal.append(makeEvent('heartbeat', 1, asRunId('run_x'), 'x', { system: 'indexer' }));
      return journal;
    });
    expect(result.ok).toBe(false);
  });
});
