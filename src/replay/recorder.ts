import type { MyceliumEvent } from '../core/events.js';
import type { Journal } from '../core/journal.js';

/**
 * Immutable snapshot of a finished run: everything needed to later re-verify
 * that the run is deterministic.
 *
 * Invariant: `events` is a defensive copy taken at record time — appending to
 * the source journal afterwards never alters the recording — and `eventHash`
 * always matches the recorded `events` sequence.
 */
export interface RunRecording {
  version: 1;
  seed: number;
  agentName: string;
  corpusHash: string;
  events: MyceliumEvent[];
  eventHash: string;
}

/**
 * Capture a journal into a portable, hash-stamped recording.
 * Pure: reads the journal but never mutates it.
 */
export function recordRun(
  seed: number,
  agentName: string,
  corpusHash: string,
  journal: Journal,
): RunRecording {
  return {
    version: 1,
    seed,
    agentName,
    corpusHash,
    events: [...journal.all()],
    eventHash: journal.eventHash(),
  };
}
