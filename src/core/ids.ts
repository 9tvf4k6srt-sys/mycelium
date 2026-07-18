import { sha256Hex } from './hash.js';

export type TaskId = string & { readonly __brand: 'TaskId' };
export type RunId = string & { readonly __brand: 'RunId' };
export type EventId = string & { readonly __brand: 'EventId' };
export type PatternId = string & { readonly __brand: 'PatternId' };
export type BreakageId = string & { readonly __brand: 'BreakageId' };

/**
 * Deterministic, content-seeded id: `${prefix}_${hash12}`.
 * Invariant: same seed ⇒ same id. Replay verification depends on this.
 */
export function makeId(prefix: string, seed: string): string {
  return `${prefix}_${sha256Hex(seed).slice(0, 12)}`;
}

export const asTaskId = (s: string): TaskId => s as TaskId;
export const asRunId = (s: string): RunId => s as RunId;
export const asEventId = (s: string): EventId => s as EventId;
export const asPatternId = (s: string): PatternId => s as PatternId;
export const asBreakageId = (s: string): BreakageId => s as BreakageId;
