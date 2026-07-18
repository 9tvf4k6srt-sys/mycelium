import { stableStringify } from './hash.js';
import { asEventId, makeId } from './ids.js';
import type { EventId, PatternId, RunId, TaskId } from './ids.js';
import type { Breakage, FixPattern } from './types.js';

export interface EventBase {
  id: EventId;
  at: number;
  runId: RunId;
}

export interface RunStarted extends EventBase {
  type: 'run_started';
  agent: string;
  seed: number;
  corpusHash: string;
}

export interface RunFinished extends EventBase {
  type: 'run_finished';
  solved: number;
  failed: number;
  totalTurns: number;
}

export interface TaskStarted extends EventBase {
  type: 'task_started';
  taskId: TaskId;
  attempt: number;
}

export interface TaskSolved extends EventBase {
  type: 'task_solved';
  taskId: TaskId;
  turns: number;
}

export interface TaskFailed extends EventBase {
  type: 'task_failed';
  taskId: TaskId;
  turns: number;
  reason: string;
}

export interface FixAttempted extends EventBase {
  type: 'fix_attempted';
  taskId: TaskId;
  candidateIndex: number;
  patternId: PatternId | null;
}

export interface BreakageRecorded extends EventBase {
  type: 'breakage_recorded';
  breakage: Breakage;
}

export interface PatternLearned extends EventBase {
  type: 'pattern_learned';
  pattern: FixPattern;
}

export interface TelemetrySampled extends EventBase {
  type: 'telemetry_sampled';
  name: string;
  value: number;
}

/** Real execution of a subsystem. The ONLY event scoring accepts as proof of life (ADR-0002). */
export interface SystemExecuted extends EventBase {
  type: 'system_executed';
  system: string;
  detail?: string;
}

/** Liveness ping. NEVER counts as execution (ADR-0002: the alibi and the witness must differ). */
export interface Heartbeat extends EventBase {
  type: 'heartbeat';
  system: string;
}

export type MyceliumEvent =
  | RunStarted
  | RunFinished
  | TaskStarted
  | TaskSolved
  | TaskFailed
  | FixAttempted
  | BreakageRecorded
  | PatternLearned
  | TelemetrySampled
  | SystemExecuted
  | Heartbeat;

export type EventType = MyceliumEvent['type'];

/**
 * Construct an event with a deterministic, content-seeded id.
 * Invariant: identical (type, at, runId, seed, payload) ⇒ identical id.
 */
export function makeEvent<T extends MyceliumEvent>(
  type: T['type'],
  at: number,
  runId: RunId,
  seed: string,
  payload: Omit<T, keyof EventBase | 'type'>,
): T {
  const id = asEventId(makeId('evt', `${type}:${at}:${runId}:${seed}:${stableStringify(payload)}`));
  return { id, at, runId, type, ...payload } as T;
}
