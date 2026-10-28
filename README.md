# River Support Bot

A Discord support bot for River Protocol that uses Claude (Anthropic) to answer community questions. It searches a local knowledge base using semantic search (RAG) so only the most relevant content is sent to Claude — not the entire KB on every message.

---

## Table of Contents

- [Root Files](#root-files)
  - [CONTEXT.md](#contextmd)
  - [intent/](#intent)
  - [bot.js](#botjs)
- [data/](#data)
- [logs/](#logs)
- [scripts/](#scripts)
- [src/ — Core Modules](#src--core-modules)
  - [state.js](#statejs)
  - [commands.js](#commandsjs)
  - [slash-commands.js](#slash-commandsjs)
  - [intent.js](#intentjs)
  - [claude.js](#claudejs)
  - [kb-sync.js](#kb-syncjs)
  - [kb-monitor.js](#kb-monitorjs)
  - [utils.js](#utilsjs)
  - [toggles.js](#togglesjs)
  - [rag.js](#ragjs)
  - [embedder.js](#embedderjs)
  - [knowledge-loader.js](#knowledge-loaderjs)
  - [blog-scraper.js](#blog-scraperjs)
- [Config Files](#config-files)
  - [.env](#env)
  - [package.json](#packagejson)
- [Knowledge Base Structure](#knowledge-base-structure)

---

## Root Files

### `CONTEXT.md`
Full session context document. Read this at the start of any new Claude Code session to get a complete picture of the project — architecture, all features, pending work, key technical decisions, and network notes. Updated whenever significant changes are made.

---

### `intent/`
Standalone folder for message intent logs, taxonomy, and supporting utilities. See `intent/README.md` for full details.

| File | Purpose |
|---|---|
| `dc-intent-log.jsonl` | Live log of every Discord user message + classified intent. Two records per message: raw log and `{ type: "classified" }`. Gitignored — local only. |
| `tg-intent-log.jsonl` | Same structure, for Telegram messages. Gitignored — local only. |
| `ticket-log.jsonl` | Non-staff messages from support ticket category channels. Records: `{ platform, ts, id, channelId, channel, authorId, author, content }`. No classification at write time — full thread classification happens at report time. |
| `collab-log.jsonl` | Non-staff messages from collab/business inquiry category channels. Same record format. Reserved for future Business Proposals report section. |
| `intent-taxonomy.md` | The classification rulebook — all 15 categories, descriptions, real examples, and edge cases. Read before changing classification behaviour. |
| `theory-notes.md` | Reference notes on theoretical frameworks (Speech Act Theory, SDT, Bayesian, Control/Queuing/Decision Theory). Consult when intent-log data shows recurring failure patterns. |
| `fetch-messages.js` | Utility script to pull historical messages from a Discord channel via REST API. Run with `node intent/fetch-messages.js <channel-id>` — outputs JSON to stdout. |

---

### `bot.js`
The main bot entry point — the only file that stays in root. Creates the Discord client, wires all `src/` modules together, launches the Telegram adapter, registers slash commands, and starts the hourly maintenance cron. Contains no command logic itself — that lives in `src/commands.js` and `src/slash-commands.js`.

**How it answers questions:**
- **Scenario 0** — User replies to the bot's own clarifying question → continues the conversation with full history
- **Scenario 0.5** — User replies to any regular bot answer (no @mention needed) → reconstructs the prior exchange as history and answers the follow-up in context
- **Scenario 1** — User @mentions the bot directly → answers immediately
- **Scenario 2** — User @mentions the bot as a reply to someone else's message → answers the original message
- **Scenario 3** — User posts a question in a bot-answer channel with no mention → waits `STAFF_WAIT_MINUTES` for a staff reply, then auto-answers if none comes. Extra messages from the same user posted while that wait is running are folded into the same batch and answered together as one reply, not answered separately.

**Claude response types:**
- `ANSWER:` — bot has a direct answer from the knowledge base
- `CLARIFY:` — question is too vague; bot asks one focused follow-up question
- `ESCALATE:` — knowledge base lacks the answer; bot directs user to the support ticket channel

`ANSWER` and `CLARIFY` responses append a small Discord subtext footer:
> *-# To follow up: reply to this message or @RiverAiBot — no wait.*

This tells users they can reply directly to the bot's message (Scenario 0.5) or @mention it (Scenario 1) to skip the 5-minute staff-wait queue. The footer is Discord-only — Telegram replies do not include it.

**Community reports (`/report`):**
Staff can generate weekly (Mon–Sun) or daily community reports from the intent logs. Reports are produced by Claude Haiku and posted to `REPORTS_CHANNEL_ID`. See `weekly-report/README.md` for full details.

**Member stats (`/member-stats`):**
Tracks Discord and Telegram join/leave events. Discord events are captured automatically. Telegram events require the bot to be an admin in the group. See `weekly-report/member-stats/README.md` for details.

**Staff commands (restricted by role):**

See the **Staff Commands** section in `CONTEXT.md` for the full command reference with descriptions. All commands are slash-based (`/command`). Two exceptions — `!add-blog-text` and `!add-doc-text` — remain as text commands because they require a file attachment and have no slash equivalent.

---

## `src/` — Core Modules

All bot logic lives here. `bot.js` in the root wires these together — none of these files are entry points. See `src/README.md` for a quick map of which module does what.

> **History:** The bot was originally a single monolithic `bot.js` (~1713 lines). It was split into separate modules on 2026-05-16 and reorganised into this `src/` folder on 2026-06-01.

---

### `state.js`
Shared state — all Maps and timing constants exported as a single object so every module holds a reference to the same live state. Mutations in one module are immediately visible to all others.

**Key exports:** All shared Maps (`pendingQuestions`, `pendingMsgIndex`, `conversationState`, `staffEngaged`, `recentCommunityDiscussion`, etc.) and all timing constants. Key timers:
- `STAFF_WAIT_MS` (5 min) — how long the bot waits before auto-answering any new question
- `STAFF_ENGAGED_WINDOW_MS` (3 min) — hard block after staff replies to a user
- `POST_STAFF_WAIT_MS` (3 min) — shorter wait for the same user's next question after staffEngaged expires
- `POST_STAFF_CONTEXT_MS` (20 min) — how long POST_STAFF_WAIT applies after staff engagement

See the **Timer Reference** section in `CONTEXT.md` for the full breakdown and how these stack.

---

### `commands.js`
Registers the `messageCreate` Discord event handler and all `!text` staff commands. Built as a factory (`registerMessageHandler`) that receives all dependencies injected from `bot.js` — no direct imports of Discord client or env vars.

**Ticket/collab gate:** Messages in `SUPPORT_TICKET_CATEGORY_IDS` or `COLLAB_CATEGORY_IDS` channels are logged immediately to `ticket-log.jsonl` / `collab-log.jsonl` and the handler returns early — the bot never responds in ticket or collab channels.

**Scam blocker (`takeScamAction`):** Called when any detection layer fires on a non-staff message. Actions: delete the message, issue an escalating timeout (1h × infraction count, capped at 28 days), post an alert embed to `SCAM_LOG_CHANNEL_ID`. Each action fails gracefully so the others still run. No-ops silently when the scam-blocker toggle is OFF. Required bot permissions: `Manage Messages` + `Moderate Members`; bot role must be above member roles in the server hierarchy.

---

### `slash-commands.js`
Registers all slash commands and handles slash interactions. Same dependency-injection pattern as `commands.js`. Commands: `/sync` (knowledge/blog dropdown), `/blog` (add/exclude/include subcommands), `/doc` (sync [force] / add subcommands), `/scam-record`, `/toggle`, `/report`, `/member-stats`, `/usage-stats`, `/add-correction`. Text-command exceptions (`!add-blog-text`, `!add-doc-text`) remain in `commands.js` — attachment-only, no slash equivalent.

---

### `intent.js`
Factory (`createIntentModule`) for the message intent classification system. Classifies every incoming message into one of 15 categories using Claude Haiku. Only 4 categories trigger a bot response. See `intent/intent-taxonomy.md` for the full category rulebook.

Contains two scammer-side detection layers that run before normal classification:
- **Hard sync (`detectScamContentSync`)** — unambiguous patterns (t.me links, wa.me links, `visit/go to my bio`, etc.) return `scam-content` immediately with zero API cost.
- **Soft sync + Haiku (`hasSoftScamSignal` + `detectScamContentLLM`)** — context-dependent patterns (`dm me`, `check my dashboard`, etc.) that regex alone cannot resolve. Regex flags the message; a focused Haiku YES/NO call reasons over reply context and recent thread to decide. Fails safe (returns false on API error).

Also exports two write-time logging functions used directly by `commands.js` (not via the factory): `logToTicketFile(message)` and `logToCollabFile(message)`. These append a minimal JSON record synchronously — no classification, no state.

---

### `claude.js`
Factory (`createClaudeModule`) for all Claude Sonnet interactions — RAG search, prompt building, `askClaude()`, `answerQuestion()`, scam detection, and conversation state management.

---

### `kb-sync.js`
All knowledge base sync functions — `syncBlog()`, `syncDocs()`, blog/doc index management, and usage tracking. Called by staff commands `/sync`, `/doc sync`, etc.

**`<!-- EXCLUDE -->` marker preservation:** both sync functions read which filenames currently carry the marker *before* any delete/rewrite pass, and reinsert it on write — so a page that's deleted-and-recreated (e.g. its URL changed) doesn't silently lose a hand-applied exclusion.

**Blog lastmod verification:** a sitemap `<lastmod>` change alone isn't trusted — `syncBlog` cross-checks it against `fetchPublishMeta()` (see `blog-scraper.js`) before treating a post as new or changed, since a site-wide redeploy can bump `lastmod` with zero content change. A candidate that only looks new because of that (true `published_time` still pre-`BLOG_SINCE_DATE`) is held out and reported in the `/sync type:Blog` reply for a human `/include-blog` decision, rather than silently added or dropped. `knowledge-base/blogs/_excluded-legacy.json` is a self-maintaining registry (title + true publish date, keyed by URL) of every post ever seen failing that floor — each URL is fetched once to seed it, then it's a free lookup.

---

### `kb-monitor.js`
Factory (`createMonitorModule`) for passive KB health checks. Runs two background checks after syncs: correction staleness detection and announcement auto-scanning for new facts. Uses Haiku to keep cost low.

---

### `utils.js`
Pure helper functions shared across modules — date/folder utilities (`getWeekRange`, `getDayRange`, `getMonthLabel`), Discord helpers (`isStaff`, `isBotMentioned`, `stripBotMention`), and knowledge helpers (`saveQAPair`, `looksResolved`).

---

### `toggles.js`
Platform reply toggle — `isEnabled(platform)`, `toggle(platform)`, `getStatus()`. State persisted to `data/toggles.json` so ON/OFF survives restarts.

| Toggle key | Command | Default | Controls |
|---|---|---|---|
| `discord` | `/toggle platform:discord` | ON | Discord auto-replies |
| `telegram` | `/toggle platform:telegram` | ON | Telegram auto-replies |
| `scam-blocker` | `/toggle platform:scam-blocker` | **OFF** | Delete + 1h timeout on detected scam messages |

Use `/toggle platform:status` to see all three states at once.

---

### `rag.js`
Retrieval-Augmented Generation engine. Instead of sending the full knowledge base to Claude on every question, this module finds the most relevant content first.

**How it works:**
1. **Chunks** every `.md` file in `knowledge-base/` and `channel-learning/` into ~1500-character pieces with 150-character overlap
2. **Embeds** each chunk as a vector using Voyage AI (only re-embeds chunks that have changed since last run)
3. **Caches** all embeddings to `knowledge-base/.embeddings-cache.json` on disk — so restarts are instant
4. **Searches** by embedding the user's question and finding the top 8 most similar chunks using cosine similarity

**Excluded from indexing:** `*_ann/` and `*_tweet/` monthly subfolders are skipped at directory level — these contain raw Discord captures, not curated content. Curated announcement files in the parent `announcements/` folder are indexed normally. Outdated sections within files can be excluded via `<!-- EXCLUDE -->` markers.

**Exports:** `buildIndex()`, `searchKB(query)`

---

### `embedder.js`
Thin abstraction layer over the embedding API. Swap providers by changing `EMBEDDING_PROVIDER` in `.env` — no other code changes needed.

**Currently supported:** `voyage` (Voyage AI — `voyage-3-lite` model)

Includes automatic retry with exponential backoff on rate limit (429) errors.

**Exports:** `embed(texts[])`

---

### `knowledge-loader.js`
Legacy module. `loadKnowledgeBase()` was replaced by `rag.js`. Only `getSourceFiles()` is still used — by the explanation embed feature to label which KB files were relevant to a bot answer.

**Exports:** `getSourceFiles()`

---

### `blog-scraper.js`
Scrapes web pages and converts them to clean Markdown for storage in the knowledge base.

**Pipeline:** fetch page → jsdom (parse HTML) → @mozilla/readability (extract article body, strips ads/nav) → turndown + GFM plugin (convert to Markdown)

**Fallback:** If a direct page fetch fails (e.g. Cloudflare block), automatically tries the site's RSS feed to extract the full article HTML.

**Publish metadata (added 2026-09-04):** `fetchPublishMeta(url)` does a lightweight fetch (no Readability parse) and reads a post's own `article:published_time` / `article:modified_time` / `og:title` meta tags — the editorial dates, set once and untouched by a redeploy. `syncBlog` in `kb-sync.js` uses this to verify a sitemap `<lastmod>` change is a real content edit and not just a site-wide redeploy/migration artifact before trusting it. Only populated via the direct-fetch path — returns nulls when the RSS fallback is used (RSS only carries the article body, not the page `<head>`).

**Exports:** `scrapeSingleArticle(url)`, `htmlToMarkdown(html, url)`, `fetchPublishMeta(url)`

---

## `data/`

Runtime state files that persist across bot restarts. Gitignored — auto-created on first write. The `data/` folder itself is tracked via `.gitkeep` so the directory exists on a fresh clone.

| File | Purpose |
|---|---|
| `toggles.json` | ON/OFF state for Discord replies, Telegram replies, and Scam Blocker. Written by `/toggle` commands. |
| `usage-stats.json` | Cumulative Claude API call counts, token totals, and estimated cost since tracking began. Viewed via `/usage-stats`. |
| `scammer-list.json` | Persistent scammer infraction log, keyed by Discord user ID. Updated on every scam-blocker action. Managed via `/scam-record`. |

---

## `logs/`

Log files written outside of PM2's own log stream. Gitignored — the folder is tracked via `.gitkeep`.

| File | Purpose |
|---|---|
| `bot-startup.log` | Startup output from an early PM2 configuration. No longer written to by bot code — kept for historical reference. |

---

## `scripts/`

Standalone diagnostic and maintenance utilities. Not part of the bot runtime — run manually as needed.

| File | How to run | Purpose |
|---|---|---|
| `check-perms.js` | `node scripts/check-perms.js` | Checks the bot's Discord permissions (View, Read History, Send, Embed Links) across every configured channel and reports any gaps. Reads channel IDs directly from `.env`. |

---

## Config Files

---

### `.env`
Environment variables. Never commit this file — it contains secrets.

| Variable | Description |
|---|---|
| `DISCORD_TOKEN` | Bot token from the Discord Developer Portal |
| `ANTHROPIC_API_KEY` | API key for Claude (Anthropic) |
| `VOYAGE_API_KEY` | API key for Voyage AI (semantic search embeddings) |
| `EMBEDDING_PROVIDER` | Embedding provider to use — currently `voyage` |
| `ANNOUNCEMENTS_CHANNEL_ID` | Channel ID — messages here are saved to the KB as announcements |
| `TWEETS_CHANNEL_ID` | Channel ID — messages here are saved to the KB as tweets |
| `GENERAL_CHANNEL_ID` | Channel ID — general chat; Q&A pairs from staff replies are learned |
| `SUPPORT_CHANNEL_ID` | Channel ID — support chat; same Q&A learning as general |
| `BOT_ANSWER_CHANNEL_IDS` | Comma-separated list of channel IDs where the bot actively answers questions |
| `STAFF_EXPLANATION_CHANNEL_ID` | Channel ID where staff explanation embeds are posted |
| `STAFF_ROLE_IDS` | Comma-separated role IDs that count as staff |
| `STAFF_WAIT_MINUTES` | Minutes to wait for a staff reply before the bot auto-answers (default: 5) |
| `REPORTS_CHANNEL_ID` | Channel ID where `/report` weekly/daily reports are posted |
| `TELEGRAM_BOT_TOKEN` | Bot token from BotFather |
| `TELEGRAM_CHAT_ID` | Telegram group chat ID (negative number for groups) |
| `TELEGRAM_TOPIC_IDS` | Comma-separated topic thread IDs the bot responds in |
| `CHINESE_DISCORD_CHANNEL_ID` | Discord channel ID for the Chinese community channel — messages are logged for reports; bot never auto-responds here |
| `CHINESE_TELEGRAM_TOPIC_ID` | Telegram topic thread ID for the Chinese community topic — messages are logged for reports; bot never auto-responds here |
| `SUPPORT_TICKET_CATEGORY_IDS` | Comma-separated Discord category IDs for support ticket channels. Non-staff messages are logged to `intent/ticket-log.jsonl`; bot never responds. |
| `COLLAB_CATEGORY_IDS` | Comma-separated Discord category IDs for collab/business inquiry channels. Logged to `intent/collab-log.jsonl`. |
| `SCAM_LOG_CHANNEL_ID` | Channel ID where the scam blocker posts alert embeds (delete/timeout actions). Requires bot to have Send Messages in this channel. |

---

### `package.json`
Node.js project manifest. Key dependencies:

| Package | Purpose |
|---|---|
| `discord.js` | Discord API client |
| `@anthropic-ai/sdk` | Claude API client |
| `node-fetch` | HTTP requests (scraping, Voyage AI calls) |
| `@mozilla/readability` | Extracts article body from raw HTML |
| `jsdom` | DOM parser for Readability |
| `turndown` + `turndown-plugin-gfm` | HTML → Markdown conversion |
| `dotenv` | Loads `.env` variables |
| `node-cron` | Scheduled tasks (hourly state pruning) |

---

## Knowledge Base Structure

```
knowledge-base/
  core-facts.md                  ← Permanent project facts injected into every Claude prompt
  docs/
    _docs-context.md             ← Curation notes: purpose, known issues, sync rules
    _index.json                  ← Tracks URL, slug, file, lastScraped per page (sitemap sync state)
    *.md                         ← Scraped doc pages, slug-named (e.g. intro-quickstart.md)
  blogs/
    _blogs-context.md            ← Curation notes: exclusion rules, overlap map, sync rules
    _index.json                  ← Tracks URL, slug, file, lastmod, lastScraped per post
    *.md                         ← Sitemap-synced blog posts, slug-named
    May_blog/ etc.               ← Monthly folders for posts added via /blog action:Add
  governance/
    _governance-context.md       ← Curation notes: 17 curated files, narrative order, excluded topic IDs
    *.md                         ← First posts only from gov.riverai.inc/c/proposal-lab/5
  announcements/
    _announcements-context.md    ← Curation notes: what's included, cross-reference status, sync rules
    exchanges-and-token.md       ← Token address, all exchange listings with dates, DEX integrations
    ecosystem-milestones.md      ← Audits, investments, season stats, product launch timeline, brand upgrade history
    important-notices.md         ← Bridge pause, system safety notices, operational alerts
    May_ann/ etc.                ← Auto-saved raw announcements (excluded from RAG — use curated files above)
  tweets/
    _tweets-context.md           ← Decision log: tweets not indexed (mirrors announcements, low signal)
    May_tweet/ etc.              ← Auto-saved raw tweets (excluded from RAG)
  corrections/
    _corrections-context.md      ← Authority hierarchy, when to add corrections, file descriptions
    conversion-mechanism.md      ← Deep reference: Conversion 1.0→2.0→3.0, S5 params, tone guidance
    river4fun-outdated-features.md ← Removed features: staking pool, River Pts voting
    referral-program.md          ← Referral code guidance, registration vs own code, rotation codes
    tokenomics-unlock-schedule.md ← Definitive RIVER unlock schedule for all non-dynamic categories
    binance-river-airdrop.md     ← River × Binance Wallet campaign details (21 RIVER, two tranches, 2026)
    official-support-and-scam-safety.md ← Official support policy, safety message, scam red flags
    river4fun-zero-points.md     ← Zero points despite daily posting: causes + exact diagnosis steps
  .embeddings-cache.json         ← Cached Voyage AI embeddings (auto-generated, do not edit)

channel-learning/
  general/qa-log.md              ← Q&A pairs learned from staff replies in #general
  support/qa-log.md              ← Q&A pairs learned from staff replies in #support
```

**`<!-- EXCLUDE -->` markers:** Any section of a `.md` file wrapped in `<!-- EXCLUDE -->...<!-- /EXCLUDE -->` is stripped before indexing — never embedded, never retrieved. Use for outdated content you want to preserve in the file but remove from RAG. Files with these markers are protected from being overwritten by `/doc sync force:true`.

To add a new core fact: edit `knowledge-base/core-facts.md`, then run `/sync` in Discord.
