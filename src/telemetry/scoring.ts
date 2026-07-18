import { DAY_MS } from '../core/clock.js';
import type { EventType, MyceliumEvent } from '../core/events.js';

/**
 * Event types accepted as real execution evidence (ADR-0002).
 *
 * Invariant: 'heartbeat' is NEVER a member. A liveness ping proves a process
 * is alive, not that it did work — the alibi and the witness must differ.
 */
export const EXECUTION_TYPES: readonly EventType[] = ['system_executed'];

const EXECUTION_SET: ReadonlySet<EventType> = new Set(EXECUTION_TYPES);

const DEFAULT_GRACE_DAYS = 7;
const DEFAULT_DECAY_PER_DAY = 5;
const DEFAULT_FLOOR = 25;

/** Score at or above which a post-grace subsystem is only on 'watch', not 'stale'. */
const WATCH_THRESHOLD = 85;

/** Health band of one subsystem. */
export type SubsystemStatus = 'ok' | 'watch' | 'stale' | 'dormant';

/** Honesty assessment of one subsystem, derived only from real execution evidence. */
export interface SubsystemHealth {
  /** Subsystem name as passed to {@link scoreSubsystem}. */
  name: string;
  /** 0..100. 0 only when the subsystem never executed; otherwise >= floor. */
  score: number;
  status: SubsystemStatus;
  /** Timestamp of the most recent real execution; null if it never ran. */
  lastRealRun: number | null;
  /** Days since {@link SubsystemHealth.lastRealRun}; null if it never ran. */
  ageDays: number | null;
  /** Human-readable reasons points were lost. Empty iff status is 'ok'. */
  penalties: string[];
}

/** Whole-system health: the composite score plus the dashboard's own doubts. */
export interface HealthReport {
  /** Mean of subsystem scores, rounded to an integer. */
  composite: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  subsystems: SubsystemHealth[];
  /** One entry per non-'ok' subsystem — the dashboard displays its own doubts. */
  honestyNotes: string[];
  /** The injected `now` this report was computed at. */
  generatedAt: number;
}

/**
 * Timestamp of the most recent REAL execution of `system`, or null if it never ran.
 *
 * Invariant: only event types in {@link EXECUTION_TYPES} count; heartbeats and
 * every other event type are ignored no matter how frequently they fire.
 */
export function lastRealRun(events: readonly MyceliumEvent[], system: string): number | null {
  let last: number | null = null;
  for (const e of events) {
    if (EXECUTION_SET.has(e.type) && 'system' in e && e.system === system) {
      last = last === null ? e.at : Math.max(last, e.at);
    }
  }
  return last;
}

const fmt = (n: number): string => n.toFixed(1);

/**
 * Score one subsystem from its execution history (ADR-0002, ADR-0003).
 *
 * - No real run ever → score 0, status 'dormant', penalty 'never executed'.
 * - age <= graceDays → 100, 'ok'.
 * - Otherwise score = 100 - decayPerDay * (ageDays - graceDays), clamped to
 *   [floor, 100]; status 'watch' while score >= 85, 'stale' below it.
 *
 * Invariant: stale data always costs points — the score is monotonically
 * non-increasing as age grows, so an ancient subsystem drags the composite
 * below what simply excluding it would report (ADR-0003).
 * Invariant: heartbeats can never lift a score; only EXECUTION_TYPES can.
 */
export function scoreSubsystem(
  name: string,
  events: readonly MyceliumEvent[],
  now: number,
  opts?: { graceDays?: number; decayPerDay?: number; floor?: number },
): SubsystemHealth {
  const graceDays = opts?.graceDays ?? DEFAULT_GRACE_DAYS;
  const decayPerDay = opts?.decayPerDay ?? DEFAULT_DECAY_PER_DAY;
  const floor = opts?.floor ?? DEFAULT_FLOOR;
  if (!(graceDays >= 0) || !Number.isFinite(graceDays)) {
    throw new Error(`scoreSubsystem: graceDays must be >= 0, got ${graceDays}`);
  }
  if (!(decayPerDay >= 0) || !Number.isFinite(decayPerDay)) {
    throw new Error(`scoreSubsystem: decayPerDay must be >= 0, got ${decayPerDay}`);
  }
  if (!(floor >= 0 && floor <= 100)) {
    throw new Error(`scoreSubsystem: floor must be within [0, 100], got ${floor}`);
  }

  const last = lastRealRun(events, name);
  if (last === null) {
    return {
      name,
      score: 0,
      status: 'dormant',
      lastRealRun: null,
      ageDays: null,
      penalties: ['never executed'],
    };
  }

  // Future-dated executions (clock skew) count as age 0, never as negative age.
  const ageDays = Math.max(0, (now - last) / DAY_MS);
  const overdueDays = Math.max(0, ageDays - graceDays);
  const rawScore = 100 - decayPerDay * overdueDays;
  const score = Math.min(100, Math.max(floor, rawScore));
  const status: SubsystemStatus = ageDays <= graceDays ? 'ok' : score >= WATCH_THRESHOLD ? 'watch' : 'stale';

  const penalties: string[] = [];
  if (status !== 'ok') {
    let penalty = `stale data: -${fmt(100 - score)} pts (last real run ${fmt(ageDays)}d ago, grace ${graceDays}d)`;
    if (rawScore < floor) {
      penalty += `; raw decay -${fmt(100 - rawScore)} pts clamped at floor ${floor}`;
    }
    penalties.push(penalty);
  }
  return { name, score, status, lastRealRun: last, ageDays, penalties };
}

function gradeFor(composite: number): HealthReport['grade'] {
  if (composite >= 90) return 'A';
  if (composite >= 80) return 'B';
  if (composite >= 70) return 'C';
  if (composite >= 60) return 'D';
  return 'F';
}

/**
 * Composite health over `systems`, with mandatory self-doubt.
 *
 * Invariant: honestyNotes enumerates EVERY subsystem whose status is not 'ok'
 * — a report that hides its own weak spots is a lying dashboard.
 * An empty `systems` list yields composite 0 / grade 'F' plus an explanatory
 * note: absence of evidence is not evidence of health.
 */
export function healthReport(
  systems: readonly string[],
  events: readonly MyceliumEvent[],
  now: number,
): HealthReport {
  const subsystems = systems.map((name) => scoreSubsystem(name, events, now));
  const composite =
    subsystems.length === 0
      ? 0
      : Math.round(subsystems.reduce((sum, s) => sum + s.score, 0) / subsystems.length);

  const honestyNotes: string[] = [];
  if (subsystems.length === 0) {
    honestyNotes.push(
      'no subsystems reported; composite 0 by convention (absence of evidence is not health)',
    );
  }
  for (const s of subsystems) {
    if (s.status !== 'ok') {
      honestyNotes.push(`${s.name}: ${s.status} (score ${fmt(s.score)}) — ${s.penalties.join('; ')}`);
    }
  }
  return { composite, grade: gradeFor(composite), subsystems, honestyNotes, generatedAt: now };
}
