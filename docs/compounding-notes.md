# Constellation compounding notes

Store for Gauntlet Dual-Mode 4 daily audits (Grok, Builder, Lucas, Arbiter).
This file is the durable ledger. Chat history is not the ledger.

**Canonical path:** `9tvf4k6srt-sys/mycelium` → `docs/compounding-notes.md`
**Not the ledger:** `docs/audits/compounding-notes.md` (does not exist; 404).
**Working copy:** `/root/.grok/server-skills/orchestration-self-auditor/references/compounding-notes.md` (header path `/home/workdir/.grok/skills/...` 404 as of 2026-10-02; sync this path after each GitHub write).
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
- “Lucas” in user audit prompts is a constellation label, not a bot to spawn; do not create a Lucas name-twin.
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
- Consumed-on: 2026-09-30 | bot_search_agents showed Researcher PARKED; no Pre-Ritual send to that id.

### Daily Compound | 2026-09-20 | Orchestration | Conf: Med | Source: Critic Chair block cited 2026-09-13; not re-verified this turn
- Observation: Blind Critic likeness/UI hard-gates exist but were not retrieved with the compounding loop.
- Evidence: 2026-09-20 audit cited Critic Chair HARD GATE — 2026-09-13. Residual: gate text not independently re-read on 2026-09-28..09-30 lean audits (no Critic Chair transcript fetch).
- Micro-action: Next Hybrid/Build audit retrieve Critic Chair tail + this file together.
- Dead Letter as of 2026-09-30 on lean reprints. Keep only as standing rule + Hybrid trigger.

### Daily Compound | 2026-09-20 | Process | Conf: High | Source: user message this thread
- Observation: User rejected jargon-only audit output and asked for a real compounding store.
- Evidence: “I want compounding notes so our systems are honestly get better day by day.”
- Micro-action: Keep user-facing replies short. Persist only high-signal dated notes here.

### Daily Compound | 2026-09-28 | Orchestration | Conf: High | Source: github___get_file_contents + local compounding-notes.md + conversation_search + Arbiter Research Foundation PASS
- Observation: Compounding was a local diary with a stale public twin. Not a cross-session learning system.
- Evidence: Local file had 09-20..09-28. GitHub frozen at 09-20 until SoT fix. conversation_search is not the ledger. memory.md missing.
- Micro-action: This file is the one SoT. Next audit must get_file_contents this path and report SHA.
- Consumed-on: 2026-09-29 | opened GitHub first; SHA e9e16120; skipped circular reprints; did not invent High-Impact.

### Daily Compound | 2026-09-29 | Orchestration | Conf: High | Source: github___get_file_contents SHA e9e16120 + local ledger match + anti-circular rule
- Observation: Measurable reuse now exists: a later audit retrieved the SoT SHA and changed behavior (GitHub-first, no circular reprint, no invented High-Impact).
- Evidence: Pre-write GitHub SHA e9e16120ee810e44261c7646f78e679c9129201e (post-09-28 write).
- Micro-action: Keep GitHub-first + SHA report as the only retrieve path. Candidate High-Impact remains candidate until Critic/Arbiter PASS.
- Consumed-on: 2026-09-30 | GitHub-first get_file_contents; pre-write SHA dca8d18bccd1eae8d0f947fb6bd421992658d2e1; no High-Impact invent; no circular 09-22..27 reprint.

### Daily Compound | 2026-09-30 | Orchestration | Conf: High | Source: github___get_file_contents SHA dca8d18 + bot_search_agents roster
- Observation: Reuse is now two-audit deep: retrieve-then-differ is the operating loop, not a diary line.
- Evidence: First tool after skill skim was GitHub get_file_contents (SHA dca8d18). Parked Researcher not used. High-Impact section left empty. 09-20 Critic-gate reprint marked Dead Letter for lean days.
- Micro-action: Next Hybrid/Build run must fetch Critic Chair hard-gate text as a separate retrieve, not a lean reprint. Do not auto-promote dual-store candidate.
- Consumed-on: 2026-10-01 | GitHub-first get_file_contents SHA 3e28aeb17e576f995d0d8cee9791d72d77f44592; parked Researcher not woken; no High-Impact invent; lean-only output.

### Daily Compound | 2026-10-01 | Orchestration | Conf: High | Source: github___get_file_contents SHA 3e28aeb + bot_search_agents
- Observation: Three-audit reuse now holds: GitHub-first SoT + parked-Researcher routing + no auto-promote changed this session vs first-cycle diary behavior.
- Evidence: Pre-write blob SHA 3e28aeb17e576f995d0d8cee9791d72d77f44592. Roster: Researcher PARKED; DEEP/Builder/Critic Chair/Leader idle. Quality Learning section still empty.
- Micro-action: Next Hybrid/Build only: retrieve Critic Chair 2026-09-13 hard-gate text separately. Do not spawn a Lucas bot. Candidate High-Impact still needs Critic/Arbiter PASS.
- Consumed-on: 2026-10-02 | GitHub get_file_contents blob SHA 23b73e10216d2b55cf0e8f21aad902023ab1f611; Researcher left parked; no Lucas spawn; no High-Impact invent. Critic Chair hard-gate text was visible in bot_search description only (not a separate transcript fetch).


### Daily Compound | 2026-10-02 | Skills | Conf: High | Source: ls + github___get_file_contents blob SHA 23b73e10
- Observation: Header working-copy path does not exist. Audits that follow the header never see the local twin.
- Evidence: `/home/workdir/.grok/skills/orchestration-self-auditor/references/compounding-notes.md` 404. Readable twin is `/root/.grok/server-skills/orchestration-self-auditor/references/compounding-notes.md`. `/home/workdir/.grok/user_info/memory.md` also missing. GitHub blob 23b73e10 matched the 2026-10-01 text.
- Micro-action: GitHub remains sole SoT. After each write, sync the server-skills path. Do not claim memory-edit stored a compound.
- Consumed-on: 2026-10-03 | GitHub-first get_file_contents blob SHA 15a8f24d28c91855afc92dcb446c7717ac42c063 (commit f0deec24); local twin text matched; no memory.md write claimed; Researcher left parked; no Lucas spawn.


### Daily Compound | 2026-10-03 | Orchestration | Conf: High | Source: github___get_file_contents blob SHA 15a8f24 + resource commit f0deec24
- Observation: A later audit can false-flag SoT drift if it compares yesterday’s blob SHA to today’s commit SHA.
- Evidence: Pre-write file SHA 15a8f24d28c91855afc92dcb446c7717ac42c063; resource URI commit f0deec246577e9a4e2033ad40b1d04c72aabdaba. Text matched the 10-02 local twin. Header path still not the readable copy.
- Micro-action: Record blob SHA and commit SHA separately. Drift only if text or blob SHA changes. Do not treat commit SHA mismatch as a failed sync.
- Consumed-on: pending later audit.

## Dead Letters (do not reprint as new compounds)

- 2026-09-22..09-28 local repeats of “High-Impact still empty; do not invent Quality Learning; wait for Critic PASS” — status line, not insight.
- 2026-09-22 micro-action “create docs/audits/compounding-notes.md” — wrong path; closed by header fix.
- 2026-09-22..09-28 reprint of Dual-Mode agent IDs without re-verification.
- 2026-09-20 Critic Chair hard-gate as a Daily Compound reprint on lean days (standing rule remains; retrieve only on Hybrid/Build).

## Candidate for later High-Impact elevation

- Dual-store + wrong path + conversation_search non-retrieval made daily notes decorative. SoT rule consumed 2026-09-29, 09-30, 10-01, 10-02. Elevate only after Critic/Arbiter PASS. Never auto-promote.
