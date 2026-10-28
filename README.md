# River Support Bot

A Discord and Telegram support bot for River Protocol. It answers community questions with Claude (Anthropic), using semantic search (RAG) over a local knowledge base so only the most relevant content is sent to Claude — not the whole knowledge base on every message. It also classifies every message's intent, blocks scammers, and produces community reports for staff.

## What it does

- **Answers questions** on Discord and Telegram — when @mentioned, when someone replies to one of its answers, or unprompted in answer channels after giving staff 5 minutes to reply first. How each case is handled: `docs/ARCHITECTURE.md` § How a message flows.
- **Replies are tagged** `ANSWER:` (answered from the KB), `CLARIFY:` (asks one follow-up question) or `ESCALATE:` (sends the user to a support ticket).
- **Follow-up footer:** on Discord, ANSWER and CLARIFY replies end with *"-# To follow up: reply to this message or @RiverAiBot — no wait."* — replying or @mentioning skips the 5-minute staff wait. Telegram replies have no footer.
- **Blocks scams** — detects scam messages and name impersonation; with the scam blocker on, deletes them and times the sender out.
- **Keeps its knowledge current** — syncs the docs and blog sitemaps, captures announcements, and learns Q&A pairs from staff replies.
- **Reports** — weekly or daily community reports and member join/leave stats (see `weekly-report/README.md`).

Staff commands (`/sync`, `/report`, `/toggle`, Telegram moderation…) are listed in `docs/REFERENCE.md` § Commands.

## Running it

1. `npm install`, then copy `.env.example` to `.env` and fill it in — every setting is described in `docs/REFERENCE.md` § Settings.
2. Turn on **Cloudflare WARP** — the ISP blocks the River docs and blog sites, so scraping fails with HTTP 403 without it.
3. Start the bot: `npm start` (runs `node bot.js`). In production pm2 runs it as `river-bot`:

```
pm2 start bot.js --name river-bot
pm2 save
pm2 restart river-bot     # after a code change
pm2 logs river-bot
```

On Windows, `pm2 startup` does not work; a Task Scheduler task (`PM2 Resurrect on Login`) runs `pm2 resurrect` after a reboot. Keep the bot running — announcements are captured only as they arrive (see `CONTEXT.md` § Backfilling Missed Announcements).

## Folders

| Folder | What is in it |
|---|---|
| `bot.js` | Entry point — wires everything together. |
| `src/` | All bot logic — see `src/README.md`. |
| `telegram/` | The Telegram bot — see `telegram/README.md`. |
| `intent/` | Intent taxonomy, theory notes, utility scripts and the local intent logs — see `intent/README.md`. |
| `weekly-report/` | Community reports and member stats — see `weekly-report/README.md`. |
| `scripts/` | Manual diagnostic and one-off scripts — see `scripts/README.md`. |
| `docs/` | Architecture, deliberate choices, and reference tables. |
| `knowledge-base/` | What the bot knows (below). |
| `channel-learning/` | Q&A pairs learned from staff replies — local only, never committed. |
| `data/` | Runtime state (below) — local only. |
| `logs/` | Log files outside pm2's own logs — local only. |

`CONTEXT.md` holds the current state, feature design notes and pending work. `CLAUDE.md` is the guide for Claude Code sessions (file map and task table).

### `data/`

Runtime state that survives restarts. Not in git — created on first write; `data/.gitkeep` keeps the folder in a fresh clone.

| File | What it holds |
|---|---|
| `toggles.json` | ON/OFF for Discord replies, Telegram replies and the scam blocker (`/toggle`). |
| `usage-stats.json` | Claude API calls, tokens and estimated cost (`/usage-stats`). |
| `scammer-list.json` | Scam-blocker infractions, keyed by Discord user ID (`/scam-record`). |
| `tg-perma-ban.json` | Telegram moderation list: watch / mute / kick / ban modes. |
| `tg-alert-admins.json` | Telegram admins subscribed to moderation alerts. |
| `tg-watch-log.jsonl` | Evidence log of deleted messages from watched Telegram users. |

### `logs/`

| File | What it holds |
|---|---|
| `bot-startup.log` | Start-up output from an early pm2 setup. No longer written — kept for reference. |

## Knowledge base

```
knowledge-base/
  README.md                      ← Notes on the folder (also indexed by RAG)
  core-facts.md                  ← Permanent facts injected into every Claude prompt
  docs/
    _docs-context.md             ← Curation notes: purpose, known issues, sync rules
    _index.json                  ← Sitemap sync state: URL, slug, file, lastScraped per page
    *.md                         ← Scraped docs pages, slug-named (45)
  blogs/
    _blogs-context.md            ← Curation notes: exclusion rules, overlap map, sync rules
    _index.json                  ← Sync state: URL, slug, file, lastmod, lastScraped per post
    _excluded-legacy.json        ← Registry of posts older than the date floor
    *.md                         ← Sitemap-synced posts, slug-named (47)
    <Month>_blog/                ← Posts added by /blog action:Add or !add-blog-text
  governance/
    _governance-context.md       ← Curation notes: 17 curated files, narrative order, excluded topics
    *.md                         ← First posts from gov.riverai.inc/c/proposal-lab/5
  announcements/
    _announcements-context.md    ← Curation notes: what's included, sync rules
    _scan-state.json             ← When announcements were last scanned for facts
    exchanges-and-token.md       ← Token address, exchange listings with dates, DEX integrations
    ecosystem-milestones.md      ← Audits, investments, season stats, launches, brand history
    important-notices.md         ← Bridge pause, safety notices, operational alerts
    <Month>_ann/weekN.md         ← Raw captured announcements (never indexed — the curated files are)
  tweets/
    _tweets-context.md           ← Why tweets are not indexed (they mirror announcements)
    <Month>_tweet/weekN.md       ← Raw captured tweets (never indexed)
  corrections/
    _corrections-context.md      ← Authority order, when to add a correction, file list
    _drafts/                     ← Proposed correction updates for review (local only)
    binance-river-airdrop.md     ← River × Binance Wallet campaign (21 RIVER, two tranches, 2026)
    conversion-mechanism.md      ← Conversion 1.0 → 2.0 → 3.0, season parameters, tone guidance
    official-support-and-scam-safety.md ← Official support policy, safety message, scam red flags
    referral-program.md          ← Referral codes: registration vs own code, rotation
    river-pts-staking-deprecated.md
    river-token-utility.md
    river4fun-outdated-features.md ← Removed features: staking pool, River Pts voting
    river4fun-zero-points.md     ← Zero points despite posting: causes and diagnosis steps
    riverpts-pricing.md
    smart-vault-deposits-closed.md
    tokenomics-unlock-schedule.md ← RIVER unlock schedule for all non-dynamic categories
  .embeddings-cache.json         ← Voyage AI vector cache (generated, local only)

channel-learning/
  <channel>/qa-log.md            ← Q&A pairs learned from staff replies (local only)
```

**Search priority:** corrections rank 1.3×, blogs and announcements 1.1×, docs 1.0×. Files and folders starting with `_`, and the raw `*_ann` / `*_tweet` folders, are not indexed.

**`<!-- EXCLUDE -->` markers:** a section wrapped in `<!-- EXCLUDE -->…<!-- /EXCLUDE -->` is stripped before indexing — kept in the file, never retrieved. Use it for outdated content. Docs files carrying a marker are skipped by `/sync type:Doc force:true`, and syncs re-apply the marker when they rewrite a file.

**To add a core fact:** edit `knowledge-base/core-facts.md`, then run `/sync type:Knowledge` in Discord.

**To correct a wrong answer:** use "@bot + message link" to see which source caused it, then `/add-correction` (or ask Claude Code to write the correction file). See `CONTEXT.md` § Corrections System.

## Dependencies

| Package | Used for |
|---|---|
| `discord.js` | Discord API client |
| `telegraf` | Telegram API client |
| `@anthropic-ai/sdk` | Claude API client |
| `node-fetch` | HTTP requests (scraping, Voyage AI, Dexscreener) |
| `jsdom` + `@mozilla/readability` | Parse HTML and extract the article body |
| `turndown` + `turndown-plugin-gfm` | HTML → Markdown, tables kept |
| `dotenv` | Loads `.env` |
| `node-cron` | Scheduled jobs (hourly clean-up, daily staff-name refresh) |
