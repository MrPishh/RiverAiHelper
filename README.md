# River Support Bot

A Discord support bot for River Protocol that uses Claude (Anthropic) to answer community questions. It searches a local knowledge base using semantic search (RAG) so only the most relevant content is sent to Claude — not the entire KB on every message.

---

## Root Files

### `CONTEXT.md`
Full session context document. Read this at the start of any new Claude Code session to get a complete picture of the project — architecture, all features, pending work, key technical decisions, and network notes. Updated whenever significant changes are made.

---

### `usage-stats.json`
Persisted Claude API usage log. Auto-created on the first answer. Stores total call count, input/output tokens, and estimated cost since tracking began. View via `!usage-stats` in Discord.

---

### `intent/`
Standalone folder for the message intent classification feature. Contains:

| File | Purpose |
|---|---|
| `intent-log.jsonl` | Passive log of every human message in `#general` and `#support`. One JSON record per line — auto-appended by the bot. Fields: `ts`, `id`, `channelId`, `channel`, `authorId`, `author`, `content` (up to 600 chars), `wordCount`, `hasQuestion`, `isReply`, `mentionsBot`, `hasAttachment`. Classification events are logged as separate records with `type: "classified"` |
| `intent-taxonomy.md` | The message intent registry — categories, descriptions, real examples, context override rules, and edge cases. Built from observed traffic. Updated as new samples are reviewed |
| `theory-notes.md` | Reference notes on theoretical frameworks (SDT, Speech Act Theory, Bayesian Inference, Control Theory, Queuing Theory, Decision Theory) and how each maps to the classification system. Consult when intent-log data shows a recurring failure pattern |
| `fetch-messages.js` | Utility script to pull historical messages from a channel via Discord REST API. Run with `node intent/fetch-messages.js <channel-id>` — outputs JSON to stdout |

---

### `bot.js`
The main bot entry point. Handles all Discord events and staff commands.

**How it answers questions:**
- **Scenario 0** — User replies to the bot's own clarifying question → continues the conversation with full history
- **Scenario 0.5** — User replies to any regular bot answer (no @mention needed) → reconstructs the prior exchange as history and answers the follow-up in context
- **Scenario 1** — User @mentions the bot directly → answers immediately
- **Scenario 2** — User @mentions the bot as a reply to someone else's message → answers the original message
- **Scenario 3** — User posts a question in a bot-answer channel with no mention → waits `STAFF_WAIT_MINUTES` for a staff reply, then auto-answers if none comes

**Claude response types:**
- `ANSWER:` — bot has a direct answer from the knowledge base
- `CLARIFY:` — question is too vague; bot asks one focused follow-up question
- `ESCALATE:` — knowledge base lacks the answer; bot directs user to the support ticket channel

**Staff commands (restricted by role):**

| Command | Description |
|---|---|
| `!usage-stats` | Show Claude API call count, token usage, and estimated cost since tracking began |
| `!sync-knowledge` | Reload core facts + re-index the entire knowledge base |
| `!sync-blog` | Pull new/updated posts from the blog sitemap |
| `!sync-docs` | Pull new/removed pages from the docs sitemap |
| `!sync-docs force` | Force re-scrape all doc pages even if unchanged |
| `!add-blog <url>` | Scrape a single blog article and add it to the KB |
| `!add-blog-text <url>` + attachment | Add a blog article from an uploaded `.md`, `.html`, or `.txt` file (for Cloudflare-protected pages) |
| `!exclude-blog <url>` | Permanently exclude a post — deletes its file from the KB and skips it on all future syncs |
| `!include-blog <url>` | Remove a post from the exclusion list — it will be re-scraped on the next `!sync-blog` |
| `!add-correction <slug> <text>` | Add or update a correction note in `knowledge-base/corrections/`. Corrections rank above docs and blogs in RAG and take priority in Claude's answers. Accepts an attached `.md`/`.txt` file for longer text. |
| `!add-doc <url>` | Scrape a single doc page and add it to the KB |
| `!add-doc-text <url>` + attachment | Add a doc page from an uploaded file |
| `!report weekly [discord\|telegram]` | Generate the weekly community report (Mon–Sun of the most recently completed week) and post it to the reports channel. Defaults to both Discord + Telegram. |
| `!report daily [discord\|telegram]` | Generate a daily community report (today's messages) and post it to the reports channel. Defaults to both Discord + Telegram. |
| `!member-stats` | Show Discord server total members and Mon–Sun join/leave counts for the current week |
| @bot + Discord message link | (Staff) Post an explanation embed for a bot answer to the staff channel |

---

### `rag.js`
Retrieval-Augmented Generation engine. Instead of sending the full knowledge base to Claude on every question, this module finds the most relevant content first.

**How it works:**
1. **Chunks** every `.md` file in `knowledge-base/` and `channel-learning/` into ~1500-character pieces with 150-character overlap
2. **Embeds** each chunk as a vector using Voyage AI (only re-embeds chunks that have changed since last run)
3. **Caches** all embeddings to `knowledge-base/.embeddings-cache.json` on disk — so restarts are instant
4. **Searches** by embedding the user's question and finding the top 8 most similar chunks using cosine similarity

**Exports:** `buildIndex()`, `searchKB(query)`

---

### `embedder.js`
Thin abstraction layer over the embedding API. Swap providers by changing `EMBEDDING_PROVIDER` in `.env` — no other code changes needed.

**Currently supported:** `voyage` (Voyage AI — `voyage-3-lite` model)

Includes automatic retry with exponential backoff on rate limit (429) errors.

**Exports:** `embed(texts[])`

---

### `knowledge-loader.js`
Legacy module that reads all `.md` files from `knowledge-base/` and `channel-learning/` into memory. No longer used for answering questions (replaced by `rag.js`). Only `getSourceFiles()` is still used — by `identifyRelevantSources()` in `bot.js` to label sources in explanation embeds.

**Exports:** `loadKnowledgeBase()` *(unused)*, `getSourceFiles()`

---

### `blog-scraper.js`
Scrapes web pages and converts them to clean Markdown for storage in the knowledge base.

**Pipeline:** fetch page → jsdom (parse HTML) → @mozilla/readability (extract article body, strips ads/nav) → turndown + GFM plugin (convert to Markdown)

**Fallback:** If a direct page fetch fails (e.g. Cloudflare block), automatically tries the site's RSS feed to extract the full article HTML.

**Exports:** `scrapeSingleArticle(url)`, `htmlToMarkdown(html, url)`, `scrapeBlogArticles()` *(exported but not called from bot.js — superseded by `!sync-blog`)*

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
| `STAFF_WAIT_MINUTES` | Minutes to wait for a staff reply before the bot auto-answers (default: 3) |

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
    May_blog/ etc.               ← Monthly folders for posts added via !add-blog
  governance/
    _governance-context.md       ← Curation notes: 17 curated files, narrative order, excluded topic IDs
    *.md                         ← First posts only from gov.river.inc/c/proposal-lab/5
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
  .embeddings-cache.json         ← Cached Voyage AI embeddings (auto-generated, do not edit)

channel-learning/
  general/qa-log.md              ← Q&A pairs learned from staff replies in #general
  support/qa-log.md              ← Q&A pairs learned from staff replies in #support
```

**`<!-- EXCLUDE -->` markers:** Any section of a `.md` file wrapped in `<!-- EXCLUDE -->...<!-- /EXCLUDE -->` is stripped before indexing — never embedded, never retrieved. Use for outdated content you want to preserve in the file but remove from RAG. Files with these markers are protected from being overwritten by `!sync-docs force`.

To add a new core fact: edit `knowledge-base/core-facts.md`, then run `!sync-knowledge` in Discord.
