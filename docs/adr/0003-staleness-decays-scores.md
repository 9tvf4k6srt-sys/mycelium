# ADR-0003: Staleness decays scores — stale data costs points, never vanishes

- Status: accepted
- Date: 2026-07-18
- Context: docs/audits/2026-07-05-recursive-learning-audit.md (secondary findings 1–2)

## Context

The predecessor's health scorer detected that its smoke-test report was 137
days old — and then *excluded* it, scoring the gates section 100. The
observers collector marked a 64-day-old run as `stale` in the status column
while still scoring it 100. Status and score disagreed, and the composite only
used score.

Excluding stale data is the optimistic version of the same lie as ADR-0002:
absence of evidence is treated as evidence of health. A system that has not
been verified recently is not a healthy system; it is an *unknown* system, and
unknown must score worse than known-good.

## Decision

Scores are functions of the age of the last real execution (ADR-0002 defines
"real"):

1. **Never executed → 0, status `dormant`.** Unknown scores worst, not best.
2. **Grace window** (default 7 days): fresh execution scores 100.
3. **Linear decay past grace** (default −5/day) to a floor (default 25): a
   system that ran once, long ago, is distinguishable from one that never
   ran — but both are visibly unhealthy.
4. **Every penalty is enumerated.** Each non-`ok` subsystem contributes a
   `penalties` entry and a report-level `honestyNote`. The composite can
   never be silently inflated by a subsystem the reader forgot to check.

## Consequences

- Monotonicity is a tested invariant: for any event stream, a subsystem's
  score is non-increasing as its last real run recedes into the past
  (property-based test).
- A regression test pins the predecessor's exact failure: a subsystem whose
  only evidence is ancient scores strictly worse than one with fresh
  evidence, and its penalty is visible in the report.
- Dashboards built on `HealthReport` inherit honesty: there is no field to
  read that omits the bad news.

## Alternatives considered

- *Binary freshness (fresh = 100, stale = 0).* Rejected: destroys information
  about *how* stale, and creates cliff-edge alarms.
- *Exclude-and-flag (predecessor model).* Rejected: the flag was rendered in
  a column nobody aggregated; only decay makes staleness cost something.
