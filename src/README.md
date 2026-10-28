# src/

All bot logic. `bot.js` in the project root wires these modules together — none of them is an entry point on its own.

## Files

### Message handling and answers

| File | What it owns |
|---|---|
| `commands.js` | The Discord `messageCreate` handler: ticket/collab gate, name-spoof detector, `!add-blog-text` / `!add-doc-text`, explanation embed, routing (Scenarios 0–3), and `takeScamAction`. |
| `slash-commands.js` | Every `/slash` command definition and the interaction handler. |
| `claude.js` | Claude calls: system prompt, retrieval + re-ranking, live prices, conversation state, scam-concern check. |
| `intent.js` | Intent classification (Haiku, 15 categories), scam layers 1–2, intent logs. |

### Knowledge base

| File | What it owns |
|---|---|
| `rag.js` | Semantic search: chunking, embedding cache, cosine search. |
| `embedder.js` | Voyage AI embedding provider. |
| `kb-sync.js` | Docs and blog sync from sitemaps, KB index files, API usage tracking. |
| `blog-scraper.js` | Web page → Markdown scraper. |
| `kb-monitor.js` | Correction staleness check and announcement fact scan. |
| `knowledge-loader.js` | Legacy loader — only `getSourceFiles()` is still used. |

### Infrastructure

| File | What it owns |
|---|---|
| `state.js` | Shared Maps and timer constants — one object shared by every module. |
| `utils.js` | Date, Discord and spoof-detection helpers; Q&A learning and announcement capture. |
| `toggles.js` | Feature toggles, persisted to `data/toggles.json`. |
| `scam-tracker.js` | Scammer infraction store, `data/scammer-list.json`. |
| `price-fetcher.js` | Live RIVERPTS and $RIVER prices from Dexscreener. |

## How it works

### `commands.js`

A factory, `registerMessageHandler`, receives the client, state, config and modules from `bot.js` — it never imports the Discord client or reads `.env`.

- **Ticket/collab gate:** messages in `SUPPORT_TICKET_CATEGORY_IDS` or `COLLAB_CATEGORY_IDS` channels are logged to `intent/ticket-log.jsonl` / `collab-log.jsonl` and the handler returns — the bot never replies there.
- **Scam blocker (`takeScamAction`):** called when any scam layer fires on a non-staff message. Deletes the message, times the member out (1 hour × infraction count, capped at 28 days) and posts an alert to `SCAM_LOG_CHANNEL_ID`. Each step fails on its own without stopping the others. Does nothing while the scam-blocker toggle is OFF, and never acts on staff. Needs the **Manage Messages** and **Moderate Members** permissions, and the bot's role above members' roles.

### `slash-commands.js`

Same dependency-injection pattern. `COMMANDS` is sent to Discord on every start-up; `/check-permissions` has a handler but is deliberately left out of `COMMANDS`. The full command list is in `docs/REFERENCE.md` § Commands.

### `intent.js`

A factory, `createIntentModule`. Classifies messages into 15 categories with Haiku; only 4 trigger an answer (see `intent/intent-taxonomy.md`). Two scammer-side layers run first:

- **Layer 1 — hard patterns (`detectScamContentSync`):** unambiguous patterns (t.me / wa.me links, "visit my bio", "share your issue with the team: <link>"…) return `scam-content` with no API call.
- **Layer 2 — soft patterns + Haiku (`hasSoftScamSignal` + `detectScamContentLLM`):** context-dependent phrases ("dm me", "check my dashboard"…) trigger a focused Haiku YES/NO check over the reply and thread context. Fails safe (not scam) on an API error.

`logToTicketFile` and `logToCollabFile` are module-level write-time loggers used directly by `commands.js` — no classification, no state.

### `claude.js`

A factory, `createClaudeModule`, for everything Sonnet: the system prompt, retrieval and Haiku re-ranking, live prices, `askClaude`, `answerQuestion`, the scam-concern check (layers 4–5) and conversation state.

### `kb-sync.js`

`syncDocs`, `syncBlog`, the docs/blog `_index.json` files, and usage tracking. Called by `/sync`.

- **`<!-- EXCLUDE -->` preservation:** both syncs note which files carry the marker before deleting or rewriting anything, and put it back on write — so a page recreated under a new URL keeps its hand-added exclusion.
- **Blog lastmod verification:** a sitemap `<lastmod>` change alone is not trusted. `syncBlog` checks it against `fetchPublishMeta()` before treating a post as new or changed, because a site redeploy can bump `lastmod` with no content change. A post that only looks new because of that (its true publish date is before the date floor) is held back and listed in the `/sync type:Blog` reply for a human decision. `knowledge-base/blogs/_excluded-legacy.json` records every post ever seen below the floor (title + true date, keyed by URL); each URL is fetched once, then looked up for free.

### `kb-monitor.js`

A factory, `createMonitorModule`, for two health checks run during `/sync` (Haiku keeps them cheap): the announcement fact scan, and staleness detection — new blog/doc pages and new announcement facts are checked against every correction and `core-facts.md`. Details: `CONTEXT.md` § KB Monitor.

### `toggles.js`

| Toggle | Command | Default | Controls |
|---|---|---|---|
| `discord` | `/toggle platform:Discord` | ON | Discord auto-replies |
| `telegram` | `/toggle platform:Telegram` | ON | Telegram auto-replies |
| `scam-blocker` | `/toggle platform:Scam Blocker` | **OFF** | Delete + escalating timeout on detected scam messages |

`/toggle platform:Show current status` shows all three.

### `rag.js`

1. **Chunks** every `.md` file in `knowledge-base/` and `channel-learning/` into ~1,500-character pieces with 150 characters of overlap.
2. **Embeds** each chunk with Voyage AI — only chunks whose text changed since the last run.
3. **Caches** the vectors in `knowledge-base/.embeddings-cache.json`, so a restart costs no API calls when nothing changed.
4. **Searches** by embedding the question and returning the 8 most similar chunks (cosine similarity × source priority). The cache is kept in memory between questions and reloaded only when the file changes (any rebuild, from the bot or a separate script).

Skipped: the raw `*_ann/` and `*_tweet/` folders, files and folders starting with `_` (so correction drafts never reach answers), `README.md` files, and `<!-- EXCLUDE -->` sections (an unclosed marker hides to the end of the file).

### `embedder.js`

A thin adapter: switch provider with `EMBEDDING_PROVIDER` — only `voyage` (`voyage-3-lite`) exists today. Retries with exponential backoff on HTTP 429.

### `knowledge-loader.js`

Legacy. The old whole-KB loader was replaced by `rag.js`; only `getSourceFiles()` remains, used by the explanation embed's keyword fallback to label sources.

### `blog-scraper.js`

**Pipeline:** fetch the page → jsdom (parse) → @mozilla/readability (article body, no nav/ads) → turndown + GFM (Markdown, tables kept). If the direct fetch fails (e.g. a Cloudflare block), it tries the site's RSS feed.

**Publish metadata (2026-09-04):** `fetchPublishMeta(url)` fetches a page without parsing it and reads `article:published_time`, `article:modified_time` and `og:title` — dates a redeploy does not touch. Only available through a direct fetch; returns nulls when only RSS works.

## Notes

**Paths:** every file here uses `const ROOT_DIR = path.join(__dirname, '..');` to reach root folders (`knowledge-base/`, `channel-learning/`, `intent/`…). Never use bare `__dirname` for paths outside `src/`.

**Who requires whom** (project files only; `bot.js` requires all of them):

```
state.js, utils.js, toggles.js, embedder.js, knowledge-loader.js,
blog-scraper.js, price-fetcher.js, scam-tracker.js, intent.js, kb-monitor.js   ← no project requires
rag.js            ← embedder
kb-sync.js        ← blog-scraper, utils
claude.js         ← price-fetcher
commands.js       ← toggles
slash-commands.js ← toggles
```

Outside `src/`: `telegram/telegram-adapter.js` requires `toggles`, `utils` and the Telegram member-stats module; `community-report.js` requires `intent`, `utils` and `kb-sync`; `discord-member-stats.js` requires `utils`.

**History:** the bot was one `bot.js` of ~1,713 lines until it was split into modules on 2026-05-16; the modules moved into `src/` on 2026-06-01.
