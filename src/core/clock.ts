export const DAY_MS = 86_400_000;

/** Source of time. Injected at every edge so runs and tests are reproducible. */
export interface Clock {
  now(): number;
}

export class SystemClock implements Clock {
  now(): number {
    return Date.now();
  }
}

/** Deterministic clock for tests, harness runs, and replay verification. */
export class ManualClock implements Clock {
  private t: number;

  constructor(start = 0) {
    this.t = start;
  }

  now(): number {
    return this.t;
  }

  advance(ms: number): void {
    if (ms < 0) {
      throw new Error('ManualClock cannot move backwards');
    }
    this.t += ms;
  }

  set(t: number): void {
    this.t = t;
  }
}
