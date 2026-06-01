# Announcements Knowledge Base — Curation Context

Source: Discord announcements channel (ID: 1213030463040655410)
Scraped range: 2025-05-15 onward
Last curated: 2026-05-10

---

## What this folder contains

Curated facts extracted from the announcements channel that are NOT already covered by:
- `knowledge-base/blogs/` — blog posts (all blog links in announcements are already indexed)
- `knowledge-base/governance/` — governance posts (all governance links already curated)
- `knowledge-base/docs/` — official documentation

This folder does NOT store raw announcement dumps. It stores only information that would help the bot answer user questions and that has no better source elsewhere.

---

## What is excluded

- Pure tweet shares with no body text (announcement = just a tweet link)
- Voting leaderboard updates (live scores, no lasting value)
- Event meetup recaps (just photos/tweets)
- Contest/giveaway announcements (form links, deadlines — time-sensitive, handled via channel-learning Q&A)
- Anything whose content is fully covered by an existing blog or governance file

---

## Files in this folder

- `exchanges-and-token.md` — Official $RIVER token address, all exchange listings with dates, DEX integrations
- `ecosystem-milestones.md` — Audits, investments, season statistics, product launch dates, TVL/growth milestones
- `important-notices.md` — Bridge pause, system safety notices, ListaDAO USDX notice

---

## Cross-reference status (as of 2026-05-10)

All blog URLs found in announcements are already in `blogs/`.
All governance URLs found in announcements are already in `governance/`.
No new blog or governance scraping needed from this batch.

---

## Future sync instructions

When adding new announcements:
1. Skip anything that only links to a tweet with no substantive body text
2. Skip anything whose content is in a blog already indexed
3. Skip anything whose content is in a governance post already indexed
4. For operational info buried in tweet threads (form links, claim steps) — use channel-learning Q&A, not this folder
5. Update the relevant file in this folder if new exchange listings, audits, investments, or notices appear
6. Check if a new announcement supersedes an existing entry before adding it — update the existing entry rather than adding a conflicting fact. Historical facts stay in the file; only remove something if it is factually wrong or completely obsolete.
