# Corrections Knowledge Base — Curation Context

Last updated: 2026-05-10

---

## Purpose of this folder

Corrections files do two things:
1. **Override** outdated or misleading content in other KB folders that cannot be fixed by simply editing the source file (e.g., scraped files that will be overwritten on next sync)
2. **Provide deep operational references** for topics where the bot needs accurate, current information to answer questions correctly

These files are handcrafted and should never be auto-overwritten by any sync script.

---

## The authority hierarchy

When sources conflict, the bot should apply this priority order:
1. **Corrections** (this folder) — highest authority, explicitly curated
2. **Governance** — official mechanism decisions and parameters
3. **Docs** — current product documentation
4. **Blogs** — narrative context, announcement framing
5. **Announcements** — operational facts, dates, stats

---

## Files in this folder

### `conversion-mechanism.md`
**The most important file in the entire KB.**
Deep reference covering the full evolution of the conversion mechanism (1.0 → 2.0 → 3.0): why each version failed or was upgraded, the mathematical model, current S5 parameters, tone guidance for frustrated users, and a hard rule to always default to Conversion 3.0 unless a user specifically asks about an earlier version.

Editors: treat this file as gospel. If anything in the blogs or governance docs contradicts this file, this file wins.

### `river4fun-outdated-features.md`
Documents features that have been removed from River4FUN:
- Staking Pool (removed — do not recommend)
- Voting with River Pts (removed — voting now uses $RIVER token)

Prevents the bot from recommending features that no longer exist.

### `referral-program.md`
Clarifies the referral program:
- Distinguish between a user's own referral code (find on their profile) vs a registration referral code (needed to sign up)
- Rotation of registration codes: JosephineOral / MrPishh (alternated per conversation)
- Never mention referral bonuses not being delivered
- Only mention benefits when directly asked

### `tokenomics-unlock-schedule.md`
Correction for tokenomics unlock dates and vesting schedules calculated from TGE date (September 22, 2025).

---

## When to add a new corrections file

Add a new corrections file when:
- The bot is giving wrong answers and the source of truth is spread across multiple files with no single authoritative version
- A feature, product, or mechanic has been removed or significantly changed and existing files still describe the old version
- There is a topic where tone/framing guidance is needed beyond what the system prompt provides
- A question pattern keeps requiring the same nuanced answer that source files alone don't capture

Do NOT add a corrections file just to summarize content that already exists clearly in one place. Corrections are for fixing gaps and conflicts, not for convenience summaries.
