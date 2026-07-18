import { DAY_MS } from '../core/clock.js';
import type { EventType, MyceliumEvent } from '../core/events.js';

const DEFAULT_Z = 1.96;

function clamp01(x: number): number {
  return Math.min(1, Math.max(0, x));
}

/**
 * Wilson score confidence interval for a binomial proportion.
 *
 * Preferred over the normal approximation because it behaves at the extremes
 * (p-hat near 0 or 1) and for small samples — exactly where dashboards lie.
 *
 * Invariant: the returned interval is always within [0, 1] and always contains
 * the sample proportion p-hat = successes / trials. Zero trials yield [0, 1]:
 * with no evidence, uncertainty is total.
 *
 * @param successes observed successes; must satisfy 0 <= successes <= trials
 * @param trials total trials; must be >= 0
 * @param z standard-normal quantile (default 1.96, i.e. a 95% interval)
 */
export function wilsonInterval(successes: number, trials: number, z = DEFAULT_Z): [number, number] {
  if (
    !Number.isFinite(successes) ||
    !Number.isFinite(trials) ||
    successes < 0 ||
    trials < 0 ||
    successes > trials
  ) {
    throw new Error(`wilsonInterval: require 0 <= successes <= trials, got ${successes}/${trials}`);
  }
  if (!Number.isFinite(z) || z <= 0) {
    throw new Error(`wilsonInterval: z must be positive and finite, got ${z}`);
  }
  if (trials === 0) {
    return [0, 1];
  }
  const n = trials;
  const pHat = successes / n;
  const z2 = z * z;
  const denominator = 1 + z2 / n;
  const center = (pHat + z2 / (2 * n)) / denominator;
  const margin = (z / denominator) * Math.sqrt((pHat * (1 - pHat)) / n + z2 / (4 * n * n));
  return [clamp01(center - margin), clamp01(center + margin)];
}

/** Frequency of one event type within a trailing time window. */
export interface Rate {
  /** Events of the type inside the window. */
  count: number;
  /** Window width, in days, echoed back for display. */
  windowDays: number;
  /** count / windowDays. */
  perDay: number;
}

/**
 * Count events of `type` in the trailing window [now - windowDays, now].
 * Both ends are inclusive.
 *
 * Invariant: events outside the window — including future-dated events
 * (at > now) — never count, so a misconfigured clock cannot inflate rates.
 */
export function eventRate(
  events: readonly MyceliumEvent[],
  type: EventType,
  windowDays: number,
  now: number,
): Rate {
  if (!Number.isFinite(windowDays) || windowDays <= 0) {
    throw new Error(`eventRate: windowDays must be positive and finite, got ${windowDays}`);
  }
  const start = now - windowDays * DAY_MS;
  const count = events.filter((e) => e.type === type && e.at >= start && e.at <= now).length;
  return { count, windowDays, perDay: count / windowDays };
}
