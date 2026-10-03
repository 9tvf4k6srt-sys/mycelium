# Constellation compounding notes

Store for Gauntlet Dual-Mode 4. This file is the durable ledger. Chat history is not the ledger.

**Canonical path:** `9tvf4k6srt-sys/mycelium` → `docs/compounding-notes.md`
**Not the ledger:** `docs/audits/compounding-notes.md` (404).
**Working copy:** `/root/.grok/server-skills/orchestration-self-auditor/references/compounding-notes.md` (header path `/home/workdir/.grok/skills/...` 404 as of 2026-10-02). GitHub is sole SoT.
**Public:** yes. No secrets, portfolio sizes, or private personal facts.

## Impact Gate (2026-10-03, user-ordered redo)

ADR-0002: activity is not execution. The alibi and the witness must not be the same event. A ledger read is a heartbeat. Heartbeats do not prove the system learned.

A Daily Compound is `system_executed` only if all three are named:

1. **Artifact** outside this file: skill text, research method, user-task output, or routing that changes a real deliverable.
2. **Predicted delta:** what that artifact will do differently next time.
3. **Verify-by:** a later non-audit session on that artifact.

Forbidden as compounds and as Consumed-on: opened GitHub, SHA matched, path synced, did not invent High-Impact, did not spawn Lucas, did not wake parked Researcher. Those are standing rules.

Zero capability delta = no new Daily Compound. One status line max: `needs attention / no system change`. Do not restate the empty High-Impact section.

Elevate to Quality Learning | Impact: High only after a later non-audit session shows the delta and Critic/Arbiter PASS. Never auto-promote. Propose skill edits; never auto-edit skills.

Scheduled prompt `daily-impact-audit` (task `0bb3a8bd-8368-4727-a8d5-c4d5267b1d57`) must follow this gate. Old prompt name `daily-compound-audit`.

## How to retrieve

1. `get_file_contents` on this path. Report blob SHA only if the write is being verified, not as the insight.
2. Apply Quality Learning first, then last 3–5 compounds that are not Dead Letters or Closed-hygiene.
3. Append 0–1 insight that passes the Impact Gate.
4. Confirm the file is readable after a write. If the write failed, say so.

`conversation_search` is not the ledger (verified 2026-09-28). `memory.md` is missing. Do not claim a compound was stored via chat search.

## Quality Learning | Impact: High

_None yet. Do not invent._

## Standing operating rules (heartbeats, not compounds)

- GitHub this path is sole SoT. Record blob SHA and commit SHA separately if verifying a write. Drift only if text or blob SHA changes.
- Parked generic Researcher stays parked. Pre-Ritual → DEEP Researcher only.
- Dual-Mode routing only to DEEP / Builder / Critic Chair / Leader. No name-twin bots. "Lucas" in audit prompts is a label, not a bot to spawn.
- Observe/Jot proposes only. Not a second High-Impact store.
- Critic Chair hard-gates (2026-09-13 likeness / UI) retrieve only on Hybrid/Build, as a separate fetch, not a lean reprint.
- ANTI-SILENT-STOP (DEEP): Pre-Ritual must write Foundation to a Leader-named workspace path and update progress.md before exit.
- Next capability target when a real task exists: the user's production research (TWSE evidence / pre-market and after-hours automations), not this ledger.

## Daily Compound

### Daily Compound | 2026-10-03 | Orchestration | Conf: High | Source: user 2026-10-03 + ADR-0002 + automation_list
- Artifact: scheduled prompt `daily-impact-audit` (was `daily-compound-audit`, task `0bb3a8bd-8368-4727-a8d5-c4d5267b1d57`) and this Impact Gate.
- Predicted delta: next scheduled run cannot store SHA/path/roster notes as compounds. Zero delta must be one status line, not a new note.
- Verify-by: next run of that automation either stays silent on compounds or names a non-ledger artifact.
- Evidence: user asked if the audit was useless; compounds 2026-09-28..10-03 were ledger hygiene; Quality Learning empty; ADR-0002 already named this failure mode (heartbeats revived dormant systems).
- Consumed-on: pending the next non-audit or next scheduled run.

### Closed-hygiene (history only, do not consume, do not reprint)

- 2026-09-20 ledger created; chat search is not memory. Consumed as SoT setup.
- 2026-09-20 parked Researcher stays parked.
- 2026-09-28..10-02 GitHub-first, SHA report, no High-Impact invent, no Lucas spawn. Standing rules now. Further "we read the file" is not consumption.
- 2026-10-03 blob-vs-commit SHA note. Reclassified Dead Letter this redo. Bookkeeping, not a compound.

## Dead Letters

- 2026-09-22..09-28 reprints of empty High-Impact / wrong path / unreverified agent IDs.
- 2026-09-20 Critic Chair hard-gate as a Daily Compound on lean days.
- 2026-10-03 blob SHA vs commit SHA false-drift note.

## Candidate for later High-Impact elevation

- Impact Gate itself, only after the next scheduled run shows it changed output (silence or a non-ledger artifact) and Arbiter PASS. Do not promote today.
