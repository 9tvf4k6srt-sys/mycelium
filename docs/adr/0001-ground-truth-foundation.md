# ADR-0001: External ground truth is the foundation

- Status: accepted
- Date: 2026-07-18
- Context: docs/audits/2026-07-05-recursive-learning-audit.md

## Context

The predecessor system ran seven self-recursive loops — watching, learning,
enforcing, scoring — for six months. The July 2026 audit found the composite
failure mode: every loop measured the system *watching itself*. Health scores
reflected the monitoring stack's opinion of the monitoring stack. When the
delivery pipeline (git hooks) went dormant, the dashboard stayed green for 64
days, because nothing in the scoring model required contact with the outside
world.

The general principle: **a self-improvement loop that cannot verify itself
against external ground truth becomes decoration.** It still produces
dashboards, rules, and scores — they just stop meaning anything.

## Decision

Every claim this system makes about itself must be anchored to external,
deterministic, versioned ground truth:

1. **The harness is the product; memory is a hypothesis.** The eval harness
   (`src/harness/`) runs agents against task fixtures whose checks are
   deterministic programs. Memory (`src/memory/`) does not get to declare
   itself useful — the harness measures its effect in an A/B run against a
   memory-less baseline on an identical corpus (`corpusHash` equality is
   asserted in the compare report).
2. **No metric without a ground-truth anchor.** Solve rates come from check
   exit codes, not from agent self-reports. Turn counts come from the runner,
   not the agent.
3. **Reports must show their own doubts.** Every health report enumerates
   every subsystem that is not `ok` in `honestyNotes`. A report that cannot
   find anything wrong with itself is considered broken, not healthy.

## Consequences

- "Improvement" claims require a baseline comparison on the same corpus hash.
  There is no other kind of claim.
- Determinism is a correctness requirement, not a convenience: replay
  verification (`src/replay/`) re-runs recordings and compares event hashes,
  so any hidden nondeterminism (wall-clock reads, unseeded randomness) is a
  detectable bug.
- Fixtures are versioned with the code. A benchmark result can always be
  traced to the exact corpus that produced it.

## Alternatives considered

- *Self-reported health (the predecessor model).* Rejected: it produced
  88/B on a dead engine.
- *External SaaS eval dashboards.* Rejected for the core loop: the ground
  truth must be reproducible offline by anyone who clones the repo.
