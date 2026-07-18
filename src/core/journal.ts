import type { EventType, MyceliumEvent } from './events.js';
import { contentHash } from './hash.js';
import type { RunId } from './ids.js';

/**
 * Append-only event log — the single source of truth for scoring, trends, and replay.
 * Invariant: JSONL round-trip preserves eventHash exactly.
 */
export class Journal {
  private events: MyceliumEvent[] = [];

  append(e: MyceliumEvent): void {
    this.events.push(e);
  }

  all(): readonly MyceliumEvent[] {
    return this.events;
  }

  ofType<T extends EventType>(t: T): Array<Extract<MyceliumEvent, { type: T }>> {
    return this.events.filter((e): e is Extract<MyceliumEvent, { type: T }> => e.type === t);
  }

  forRun(runId: RunId): readonly MyceliumEvent[] {
    return this.events.filter((e) => e.runId === runId);
  }

  toJSONL(): string {
    const lines = this.events.map((e) => JSON.stringify(e));
    return lines.length === 0 ? '' : `${lines.join('\n')}\n`;
  }

  static fromJSONL(s: string): Journal {
    const journal = new Journal();
    for (const line of s.split('\n')) {
      const trimmed = line.trim();
      if (trimmed.length > 0) {
        journal.append(JSON.parse(trimmed) as MyceliumEvent);
      }
    }
    return journal;
  }

  /** Canonical hash of the full event sequence. Equal sequences hash equally. */
  eventHash(): string {
    return contentHash(this.events);
  }
}
