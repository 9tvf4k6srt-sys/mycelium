# Ultra-audit: token efficiency in how we build (2026-06-03)

Scope: how the recent guild-page work actually spent tokens, where the system
already helps, where it is blind, and the durable tooling shipped to fix the
blind spot. Written so the next agent (any model) inherits the lesson.

> Harvested from the predecessor repo. Origin of the token-economics ideas
> (read-budget ladders, measured cost per loop) that this repo's harness
> tracks as first-class metrics.

---

## 1. What the git history shows

The last 12 commits to `main`:

```
e713c39 fix(guild): rebuild join headline ... flex gaps        (#86)
d7fbdad fix(guild): keep ROSTER whole on mobile ...            (#85)
0921c9e fix(guild): preserve word spacing in join headline ... (#84)
056505c feat(guild): Ohm/Omega monogram in the demon-P counter (#83)
a51a9be fix(guild): remove dark island inside P ...            (#82)
13d6b3b fix(guild): clean demon-P emblem + asset gate          (#81)
ed6150d feat(guild): bolder ember-accented demon-P emblem      (#80)
8b9d703 fix(guild): clean demon-P emblem negative space        (#79)
ea1046a feat(guild): PARADOX MiniDemon rebrand ...             (#78)
...
```

**11 of 12 are the same page.** Two clusters dominate:

- **Emblem transparency:** #79 → #83 — five round-trips on one logo.
- **Join headline spacing/sizing:** #84 → #85 → #86 — three round-trips on one `<h2>`.

Every one of those fixes was correct in isolation. The waste was not bad code,
it was the **shape of the loop**.

## 2. The one pattern behind almost all of it: the re-see loop

```
I change something visual
  → I cannot see it (no screenshots in this sandbox)
  → I ship it on a green build
  → the user opens it on their phone and sees the bug
  → the user screenshots it and writes a message
  → I re-open context, re-fix, re-ship
  → repeat
```

Each lap costs a full PR, my entire turn of context, and a user turn. Three
laps on a headline is not three small edits; it is three of the most expensive
units of work in this project, chained.

The root cause is structural, not careless: **we have no eye.** The existing
gates check copy (`ai-tell`), visual-tell (`layout`), page weight (`pagesize`),
and asset alpha (`assets`). None of them looks at whether the layout will
actually *render correctly at 375px*. That is exactly the gap the headline and
emblem fell through, repeatedly.

## 3. What the system already does well (keep)

- **Read-budget ladder + anchors** (`EFFICIENCY.md` levers 1–4): grep-then-Read,
  batch lookups, verify once, target searches. This kills *read* waste and it
  works — none of the recent cost was over-reading.
- **`preship`** already bundles the copy/layout/size/asset gates into one call,
  which is the right shape (one command, many checks).
- **The efficiency ledger + memory constraints** give a model-agnostic place to
  record lessons. Good bones.

The system was strong on *read* cost and *copy* cost. It was blind on
*render* cost — which turned out to be the dominant spend.

## 4. The fix shipped (executed, not just noted)

### `tools/render-risk-lint.cjs` — a static eye for the re-see loop
Since we cannot render, we read the static fingerprint of each bug class that
actually shipped. Rules, each tied to a real past bug:

| Rule | Catches | Shipped as |
|------|---------|-----------|
| RR1  | multi-word phrase fed to a letter-splitter with no flex gap / spacer → words fuse (`ontheroster`) | #84, #86 |
| RR2  | letter/word-split line with no `nowrap` → mid-word break (`ROS / TER`) | #85 |
| RR3  | fixed `width`/`min-width` > 360px with no `max-width:100%` guard → mobile overflow | class of bug |
| RR4  | uppercase headline `clamp()` floor ≥ 40px on a multi-word line → won't fit 375px | #85 |

Proven both ways before shipping:
- Reconstructed the #84 and #85 buggy markup → lint **fails** (exit 1, RR1 / RR4).
- Current fixed page → lint **passes** (exit 0).
- Swept all 152 `public/**.html` → 3 honest findings (`oracle` rings,
  `profile-card`), zero false positives on the rest.

Decorative/off-flow elements (`position:absolute`, transforms, `pointer-events:
none`) and single-word logos (PARADOX split into PARA/D/OX) are correctly
skipped, so it does not cry wolf.

### Wired into the existing surface
- `node bin/ai.cjs render [--strict|--all|<file>]` — new command.
- `preship` runs it **`--strict` on any HTML in scope**, so a render risk now
  blocks before it can become a re-see loop.
- `EFFICIENCY.md` gains lever 6 (kill the re-see loop) and a "verify visual work
  without a screenshot" ladder, so the next agent stops re-discovering that
  screenshots are impossible and trusts the gate instead.
- Memory: one `constraint` + one `learned` recorded under `efficiency`.

## 5. The durable rule

> For any visual change: `node bin/ai.cjs render --strict <file>` (or just
> `preship`) is the eye. Trust the green. Do not ship a visual change on a build
> that only checked copy and weight, and do not spend turns trying to screenshot.

## 6. Honest limits

- The lint is static; it cannot catch *every* visual issue (e.g. subtle color
  contrast, z-index overlaps). It targets the *recurring* classes, which is
  where the tokens actually went. New recurring classes should be added as new
  RR rules when they cost a second round-trip — not before (a rule that never
  fires is just more code to read).
- `PlaywrightConsoleCapture` remains the only live-browser signal and is for JS
  errors, not layout.
