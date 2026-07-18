# Ultra-audit: the recursive learning stack — is it actually learning? (2026-07-05)

Scope: a full-depth audit of every self-recursive learning system in the repo,
asked from the builder's seat: *when I build, does this stack make me spend
fewer tokens and ship better, more reliable work — or does it just look like
it does?* Follow-on to `LEARNING-SYSTEMS-AUDIT.md` (2026-02-19),
`AUDIT-learning-stack-2026-06-04.md`, and both token-efficiency audits.

Method: no theory. Every claim below was verified by running the tools and
reading the data stores in the live sandbox.

> Harvested from the predecessor repo. This is the founding document of the
> redesign: every ADR in docs/adr/ traces back to a finding below.

---

## Verdict at a glance

| Layer | Looks like | Actually is | Root cause |
|---|---|---|---|
| Git hooks (the loop's engine) | wired | **DORMANT** — `core.hooksPath` unset in this clone | activation is manual (`ai hooks`), nothing self-heals |
| Heartbeat | 9/9 systems alive | **pings masked true silence** | ping events count as system activity in idle detection |
| System health | 88/B | inflated | observers "100" while last real run was 64d ago; gates "100" with a 137-day-stale smoke report excluded, not penalized |
| Telemetry | continuous series | **1 record — again** | same regression as June: post-commit never fires without hooks |
| Learning loop | 2 rules added | derived only "X is silent" meta-alerts | no real events flowing → nothing real to learn |
| Memory stores | trimmed | memory.json stuck at 161KB vs 100KB target | trimmer skips `patterns` maps (34KB) entirely |
| Token discipline | budget/firewall/route tools exist | **0 budgets ever declared** | tools are opt-in, nothing prompts their use |
| Sandbox hygiene | — | 40MB biome core dump squatting in repo root | crash artifact, gitignored but never cleaned |

**Composite honesty finding:** the stack's biggest enemy is no longer missing
features — it is **silent non-execution wearing a green dashboard**. Every
subsystem is well-built; the delivery pipeline that runs them is the single
point of failure, and the monitoring layer papers over that exact failure.

---

## The one root cause that dominates everything

### Hooks are the engine, and the engine wasn't running

Every recursive loop in this repo — watch → learn → enforce, commit → mine →
rules, commit → telemetry → trends — is driven by `.husky/post-commit`. That
hook only fires if `git config core.hooksPath` points at `.husky`.

Verified state of this clone:

```
$ git config --get core.hooksPath
(unset)                      ← git falls back to .git/hooks (empty samples)
$ node tools/install-hooks.cjs --check
✗ hooks NOT active
```

Consequences measured in the data stores:

- `observer-run.json` — last real observer run **2026-05-02, 64 days ago**
- `telemetry.json` — **1 record** (the June audit fixed this once already;
  it regressed the moment a fresh clone skipped hook activation)
- `learning-run.json` — last derivation 25 days ago; when run manually today
  it derived only *"system X has been silent"* meta-rules — the loop is
  starving, not broken
- efficiency ledger — no per-commit slices since the last wired session

The repo *knows* this failure mode. `tools/install-hooks.cjs` exists, its own
header explains the problem, and memory has a workflow rule about
`core.hooksPath`. What's missing is **self-healing**: activation still depends
on a human/agent remembering to run `ai hooks` in every fresh sandbox. A
learning system whose survival depends on being remembered is not recursive —
it is decorative.

### The heartbeat made it worse, honestly

`tools/heartbeat.cjs` was built (correctly) to stop false "system silent"
alarms across chat windows. But its ping events are emitted **under each
system's own name**, and both `learning-loop.cjs §system-idle` and
`system-health.cjs` count any event as proof of life. Net effect measured
today: heartbeat "revived" 8 systems that had genuinely not run in 25+ days,
and system health reported **88/B while the entire post-commit loop was
dormant**. The alibi and the witness were the same event.

---

## Secondary findings (verified)

1. **Gates score is stale-blind.** `system-health` correctly detects the
   smoke report is 137 days old, then *excludes* it and scores gates 100.
   Stale gate data should cost points, not vanish.

2. **Observers score ignores recency.** `collectObservers` marks status
   `stale` after 7 days but still scores 100 (10/10 ok from a 64-day-old
   run). Score and status disagree; the composite only uses score.

3. **memory.json can't reach its own target.** Trimmer target is <100KB;
   file sits at 161KB. The trimmer only trims arrays — `patterns` (34.2KB,
   of which `coChanges` alone is 22.5KB) is a keyed map it never touches.
   The trimKeyedMap helper it already ships for watch.json is exactly the
   tool for the job; it just isn't applied to memory.

4. **Token discipline is built but unused.** `token-budget.cjs` (declare/
   check/spend/close), `task-brief.cjs` (context firewall), `route-task.cjs`
   (complexity-aware routing) are all excellent — and the scorecard says
   *"token budgets: none declared yet."* Opt-in discipline gets opted out of.

5. **40MB `core` dump** (biome crash artifact) sits in the repo root.
   Gitignored, so no repo damage — but it's 40MB of dead sandbox weight and
   it shadows the word "core" in searches.

6. **`.mycelium-context` COSTS tiers are the right idea** (T1 read-whole →
   T4 CLI-only) and match reality (mycelium.cjs 58K tokens, watch.json 61K).
   This is the strongest token-efficiency asset in the repo — keep it.

---

## Fixes shipped in this pass

All four target the root cause: **make execution self-healing and make the
dashboard honest.**

### Fix 1 — hooks self-heal at every entry point
- `tools/heartbeat.cjs` now checks `core.hooksPath` first and **auto-installs
  the hooks when dormant** (idempotent, <50ms). Heartbeat runs at session
  start (`ai brief`) and on every commit, so a cold clone physically cannot
  stay dormant past its first `ai brief`.
- `package.json` gains `"prepare": "node tools/install-hooks.cjs --silent || true"`
  so `npm install` wires hooks too (covers CI and fresh-clone-then-install).
- When heartbeat finds hooks dormant it emits a `hooks_dormant` **warning**
  event — recurrence becomes learnable signal instead of invisible rot.

### Fix 2 — pings can no longer impersonate real runs
- `heartbeat.cjs` `lastSeen()` and `learning-loop.cjs §system-idle` now
  **ignore `event === 'heartbeat'`** when judging whether a system actually
  ran. Heartbeat still reports runnability (probe) and delivery health
  (hooks), which is what it can truthfully attest.
- Result: a system that hasn't *really* run in 14d surfaces again — but now
  the alert is actionable because Fix 1 restores the delivery pipeline.

### Fix 3 — honest scoring in system-health
- New `hooks` collector (weight 1.5): dormant hooks = score 0/`failing`.
  The dashboard can never again show B-grade with a dead engine.
- `collectObservers`: score now decays with age (−5/day past 7d, floor 25).
- `collectGates`: each stale/missing gate caps the section at 85 and lowers
  status to `watch` — stale data costs points instead of disappearing.

### Fix 4 — trimmer finishes the job
- `memory-trimmer.cjs` now trims `memory.patterns` keyed maps (`coChanges`,
  `fixChains`, `hotspots`) with the same weigh-and-keep strategy used for
  watch.json, and rotates the archive dir (keep 20 newest). Measured
  result: memory.json 161KB → 140KB on first run (patterns.coChanges
  382→120 pairs, hotspots 132→80, bundleTrend −40, fixChains −1); the
  remaining bulk is snapshots/reflections/constraints prose that carries
  real lessons — cutting those would trade quality for bytes.

### Hygiene
- Deleted the 40MB `core` dump.

---

## Recommendations not shipped (next passes, in value order)

1. **Auto-declare token budgets.** Wire `task-brief.cjs` to call
   `token-budget.cjs declare` with the route-task's suggested budget. The
   discipline exists; make it the default path, not a virtue.
2. **Feed the loop real build events.** The learning loop's best rules came
   from trend/gate events. Emit `build_metrics` from `npm run build` and
   `gate_fail` from CI so derivation has protein, not just heartbeats.
3. **Make derived constraints enforceable.** learning-run constraints are
   prose. Promote high-confidence (≥0.85, seen 3×) ones into
   `mycelium --guard` checks automatically.
4. **Archive rotation.** `.mycelium/archive/` will now accumulate one file
   per trim; cap at 20 files.
5. **Refresh the smoke report** (137d old) or fold smoke into the `keeper`
   freshness registry with a 14d TTL and a real refresh command.

## The builder's token-efficiency contract (what this buys you)

With hooks self-healing, every commit again produces: risk warnings before
you break things (fewer re-fix laps — the #1 measured token sink, 41% of all
fixes), mined rules that stop repeat mistakes, telemetry that catches
regressions before the user does, and honest health so you never spend a
session debugging a system that was simply switched off. The cheapest token
is the turn you never have to take.
