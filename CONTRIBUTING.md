# Contributing

## Setup

```bash
npm install
npm run typecheck   # tsc --noEmit (strict, exactOptionalPropertyTypes, noUncheckedIndexedAccess)
npm test            # vitest (unit + fast-check property tests)
npm run lint        # biome check .
npm run demo        # build + deterministic demo run
```

All four must be green before a PR. CI runs them on Node 20 and 22.

## House rules

1. **Zero runtime dependencies.** Node stdlib only. This is a design
   constraint, not a preference — it keeps every run reproducible offline.
2. **Errors are values.** Cross module boundaries with `Result<T, E>`.
   Throw only for programmer-bug invariant violations.
3. **Time and randomness are injected.** No `Date.now()`, no `Math.random()`
   in `src/`. Use `Clock` and seeded ids. The replay tests enforce this.
4. **Invariants get property tests.** If you state an `Invariant:` in a TSDoc
   comment, there is a fast-check test that tries to break it.
5. **Metrics changes need an ADR.** Anything that changes how a score is
   computed also updates `docs/adr/` and the honesty notes that surface it.
   Scores that can silently inflate are treated as bugs (see ADR-0002/0003).
6. **Files stay under 300 lines.** Decompose instead of growing.

## Adding a benchmark task

Fixtures live in `fixtures/tasks/<id>/` and carry their own ground truth:

```
fixtures/tasks/<id>/
  task.json    # id, title, area, description, signature, candidates[], checks[]
  check.cjs    # exits 0 iff the fix is correct — the ONLY arbiter of success
  src/...      # the broken code under test
```

Rules for fixtures: checks must be deterministic and hermetic; exactly one
candidate fix is correct; the correct candidate is never listed first (the
baseline must pay turns, or the A/B measures nothing).

## Honesty policy

Numbers in README and docs are produced by `npm run demo` or an archived run
report. Do not edit numbers by hand. If a claim cannot be reproduced by a
command in this repo, it does not belong in this repo.
