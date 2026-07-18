# ADR-0002: Activity is not execution

- Status: accepted
- Date: 2026-07-18
- Context: docs/audits/2026-07-05-recursive-learning-audit.md ("The heartbeat made it worse, honestly")

## Context

The predecessor emitted heartbeat pings to suppress false "system silent"
alarms. The pings were emitted **under each monitored system's own name**, and
both the idle detector and the health scorer counted any event as proof of
life. Measured effect: heartbeats "revived" 8 systems that had not executed in
25+ days, and the composite health read 88/B while the engine driving every
loop was dormant.

The alibi and the witness were the same event.

This is an instance of a general monitoring failure: **when the monitor and
the monitored share a signal source, the monitor cannot detect the monitored
system's silence.** Any activity-based liveness signal will eventually be
emitted by the wrong component for the wrong reason.

## Decision

The event model (`src/core/events.ts`) makes the distinction structurally
unsplittable:

- `system_executed` — a subsystem did real work. The ONLY event accepted as
  proof of life. (`EXECUTION_TYPES` in `src/telemetry/scoring.ts`.)
- `heartbeat` — a liveness ping. Attests delivery and runnability, never
  execution. `lastRealRun` ignores it by construction, not by convention.

Scoring depends only on `system_executed`. A property test asserts that an
arbitrary burst of heartbeats with zero executions scores 0/`dormant` —
heartbeats can never lift a health score, no matter how many arrive.

## Consequences

- Emitting a heartbeat is easy and safe; emitting `system_executed` requires
  actually doing the work and passing through the code path that records it.
  Faking execution is therefore a code change, not a config change.
- Heartbeats remain useful for what they can truthfully attest (the event
  pipeline is alive) and useless for what they cannot (the subsystem ran).
- Any future event type proposed as execution evidence must be added to
  `EXECUTION_TYPES` explicitly, with a justification — the default for new
  events is "not evidence."

## Alternatives considered

- *Tag heartbeats and filter at query time.* Rejected: the predecessor did
  exactly this and the filter was forgotten in two of three consumers. The
  type system now makes the forgotten-filter mistake unrepresentable.
