# Constellation compounding notes

Store for Gauntlet Dual-Mode 4 daily audits (Grok, Builder, Lucas, Arbiter).
This file is the durable ledger. Chat history is not the ledger.

**Canonical path:** `9tvf4k6srt-sys/mycelium` → `docs/compounding-notes.md`
**Not the ledger:** `docs/audits/compounding-notes.md` (does not exist; 404).
**Working copy:** `/home/workdir/.grok/skills/orchestration-self-auditor/references/compounding-notes.md` (must match this file after each write).
**Public:** yes. Do not put secrets, portfolio sizes, or private personal facts here.

## How to retrieve (mandatory first step of every daily audit)

1. Read THIS file first via GitHub `get_file_contents` on `9tvf4k6srt-sys/mycelium` path `docs/compounding-notes.md`. Confirm SHA.
2. Apply every **Quality Learning | Impact: High** item before anything else.
3. Then apply the last 3–5 dated **Daily Compound** entries that are not Dead Letters.
4. Append 0–3 lean insights only. Prefer silence on low-signal days.
5. Propose skill edits; never auto-edit skills.
6. After writing, confirm the file is readable (new SHA / URL). If the write failed, say so. Do not pretend memory was stored.

**conversation_search is NOT the ledger.** It does not retrieve Daily Compound or Quality Learning entries (verified 2026-09-28: returns unrelated May 2026 threads). `memory.md` is missing. personal-context-orchestrator must not claim it injected compounds via chat search.

## Anti-circular / measurable-reuse rules

An insight **compounds** IFF a later dated session retrieved it AND a subsequent action or routing differed because of it.

- Restating “High-Impact still empty / do not invent / map holds” is **not** a Daily Compound. Zero-signal day = silence or one line `stable / no new compound`.
- Required field on new compounds: `Consumed-on: YYYY-MM-DD | action that differed`.
- After 3 later audits with no consume → mark **Dead Letter**. Do not keep reprinting it.
- Elevate to Quality Learning | Impact: High only after a *later* audit retrieves the insight and changes behavior, plus Critic/Arbiter PASS. Never auto-promote.

## Quality Learning | Impact: High

_None yet. Do not invent High-Impact entries._

## Standing operating rules (not High-Impact, not Daily Compounds)

- Parked generic Researcher stays parked. Pre-Ritual / deep research → DEEP Researcher only.
- Dual-Mode routing only to DEEP / Builder / Critic Chair / Leader. No name-twin bots.
- Observe/Jot may propose only; it is not a second High-Impact store.
- Retrieve Critic Chair hard-gates (2026-09-13 likeness / UI) together with this file and the old audit-log.
- ANTI-SILENT-STOP (DEEP): Pre-Ritual must write Foundation to a Leader-named workspace path and update progress.md before exit. Chat-only Pre-Ritual = process FAIL; Resume once.
- Daily Compound format: `Daily Compound | YYYY-MM-DD | [domain] | Conf: High/Med/Low | Source: …`
- Quality Learning format: `Quality Learning | Impact: High | Domain: … | insight | evidence | micro-action`

## Daily Compound

### Daily Compound | 2026-09-20 | Orchestration | Conf: High | Source: daily-compound-audit run + conversation
- Observation: No compounding ledger existed. Audits restarted at first-cycle every time. Conversation search is not a ledger.
- Evidence: No Quality Learning / Daily Compound entries found; last related audit-log trail ended 2026-07-09; user asked for compounding notes so the system honestly improves day by day.
- Micro-action: Created this file. Future audits must read it first.
- Consumed-on: 2026-09-28 | this audit opened GitHub + local ledgers first and treated chat-search as non-ledger.

### Daily Compound | 2026-09-20 | Agents | Conf: High | Source: Researcher role text cited in 2026-09-20 audit
- Observation: Role overlap risk if the parked Researcher is woken for Pre-Ritual work.
- Evidence: Prior audit recorded Researcher as PARKED / MERGE→DEEP.
- Micro-action: Route Pre-Ritual only to DEEP Researcher.
- Consumed-on: standing rule only; no live roster tool in the 2026-09-28 Gauntlet harness to prove a routing change today.

### Daily Compound | 2026-09-20 | Orchestration | Conf: Med | Source: Critic Chair block cited 2026-09-13; not re-verified this turn
- Observation: Blind Critic likeness/UI hard-gates exist but were not retrieved with the compounding loop.
- Evidence: 2026-09-20 audit cited Critic Chair HARD GATE — 2026-09-13. Residual: that gate text was not independently re-read on 2026-09-28 or 2026-09-29 (lean audit; no Critic Chair transcript fetch).
- Micro-action: Next Hybrid/Build audit retrieve Critic Chair tail + this file together.
- Dead-letter watch: restated 09-20 through 09-29 without independent re-read. One more unconsumed reprint → Dead Letter.

### Daily Compound | 2026-09-20 | Process | Conf: High | Source: user message this thread
- Observation: User rejected jargon-only audit output and asked for a real compounding store.
- Evidence: “I want compounding notes so our systems are honestly get better day by day.”
- Micro-action: Keep user-facing replies short. Persist only high-signal dated notes here.

### Daily Compound | 2026-09-28 | Orchestration | Conf: High | Source: github___get_file_contents + local compounding-notes.md + conversation_search + Arbiter Research Foundation PASS
- Observation: Compounding was a local diary with a stale public twin. Not a cross-session learning system.
- Evidence: Local file 6870B had 09-20..09-28. GitHub `docs/compounding-notes.md` SHA `9c8d8cb15f86625674b1ddc56d921cdf6388803c` was frozen at 09-20. Claimed path `docs/audits/compounding-notes.md` 404. conversation_search returned May 2026 TWSE/Maple threads, not Daily Compounds. memory.md missing. 09-23..09-28 local lines mostly restated “High-Impact empty / map holds” (maintenance, ADR-0002 activity ≠ execution; same class as 2026-07-05 “silent non-execution wearing a green dashboard”).
- Micro-action: This file is the one SoT. Header path corrected. Anti-circular + Consumed-on rules added. Do not reprint 09-22..27 circular lines. Next audit must `get_file_contents` this path and report the new SHA; if it cannot, say write/read failed.
- Consumed-on: 2026-09-29 | opened GitHub first; SHA `e9e16120ee810e44261c7646f78e679c9129201e`; skipped circular 09-22..27 reprints; did not invent High-Impact.

### Daily Compound | 2026-09-29 | Orchestration | Conf: High | Source: github___get_file_contents SHA e9e16120 + local ledger match + anti-circular rule
- Observation: Measurable reuse now exists: a later audit retrieved the SoT SHA and changed behavior (GitHub-first, no circular reprint, no invented High-Impact).
- Evidence: Pre-write GitHub SHA `e9e16120ee810e44261c7646f78e679c9129201e` (post-09-28 write). Local working copy matched. memory.md still missing. conversation_search not used as ledger.
- Micro-action: Keep GitHub-first + SHA report as the only retrieve path. Candidate High-Impact (dual-store / chat-search non-retrieval) remains candidate until Critic/Arbiter PASS — do not auto-promote today.
- Consumed-on: pending later audit.

## Dead Letters (do not reprint as new compounds)

- 2026-09-22..09-28 local repeats of “High-Impact still empty; do not invent Quality Learning; wait for Critic PASS” — status line, not insight.
- 2026-09-22 micro-action “create docs/audits/compounding-notes.md” — wrong path; real file was already `docs/compounding-notes.md`. Failed micro-action, now closed by this header fix.
- 2026-09-22..09-28 reprint of Dual-Mode agent IDs (Lucas→Leader `8b53ce2b…`, Arbiter→Critic Chair `f6947d0b…`, Builder `19665a6d…`, DEEP `4c6bdd8a…`) without re-verification. Standing map lives above; IDs not re-verified in the 2026-09-28/29 Gauntlet harness.

## Candidate for later High-Impact elevation

- Dual-store + wrong path + conversation_search non-retrieval made daily notes decorative. 2026-09-29 consumed the 09-28 SoT rule (GitHub-first + SHA). Elevate only after Critic/Arbiter PASS. Never auto-promote.
