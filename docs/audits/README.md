# The audit trail (origin story)

This repo exists because of three audits of its predecessor — a self-healing
codebase system ("Mycelium") that ran inside a production web app for six
months. The audits are kept here, unedited except where noted, because they
are the design specification for everything in `src/`.

**The arc: a system gets elaborate, then honest, then rebuilt.**

| Date | Audit | What it found | What it changed here |
|---|---|---|---|
| 2026-02-19 | [Learning systems inventory](2026-02-19-learning-systems-audit.md) | Seven self-recursive loops, impressive individually, **disconnected** — no unified event bus | The journal (`src/core/journal.ts`) is that bus, and the ONLY source of truth |
| 2026-06-03 | [Token efficiency](2026-06-03-token-efficiency-audit.md) | The dominant cost was the *shape of the loop* (the "re-see loop"), not bad code | Turn counts are first-class harness metrics; baselines must pay them |
| 2026-07-05 | [Recursive learning stack](2026-07-05-recursive-learning-audit.md) | **"Silent non-execution wearing a green dashboard"** — heartbeats impersonated real runs, stale data scored 100, health read 88/B on a dormant engine | ADR-0002, ADR-0003, and the founding thesis: external ground truth or decoration |

## Why keep failure documents in a portfolio repo?

Because the audits are the strongest evidence of the engineering values this
repo claims:

- **Honesty over optics.** The July audit is a public, measured account of the
  author's own system failing. Publishing it is the point.
- **Findings become invariants.** Every ADR cites the audit finding it
  encodes, and every finding has a property test that would catch its
  recurrence.
- **Institutional memory as method.** The predecessor's failure was not lack
  of effort — it was lack of ground truth. That is a claim about *systems*,
  and it generalizes far beyond one codebase.

Read the July audit first. If you only read one document in this repo, read
that one.
