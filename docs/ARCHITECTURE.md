# Architecture

How the parts of the bot fit together, how a message flows through them, which outside services it talks to, the project's own vocabulary, and what to update when you add something.

For the full design history of each feature, see `CONTEXT.md`. For lookup tables (settings, commands, timers), see `docs/REFERENCE.md`.

## The parts

| Part | Files | Role |
|---|---|---|
| Entry point | `bot.js` | Reads `.env`, creates the clients, wires the modules, runs start-up and the cron jobs. |
| Shared state | `src/state.js` | Every Map and timer constant, one object shared by all modules. |
| Discord front end | `src/commands.js`, `src/slash-commands.js` | Message handling and answer routing; staff slash commands. |
| Telegram front end | `telegram/telegram-adapter.js` | The same routing for Telegram, plus the staff DM panel and moderation. |
| Intent and scam detection | `src/intent.js`, `src/utils.js` (spoof helpers) | Haiku intent classification, scam layers 1–3, intent logs. |
| Answering | `src/claude.js`, `src/price-fetcher.js` | Scam-concern check (layers 4–5), RAG retrieval and re-ranking, prices, the Sonnet call, conversation state. |
| Knowledge base | `src/rag.js`, `src/embedder.js`, `src/kb-sync.js`, `src/blog-scraper.js`, `src/kb-monitor.js`, `src/knowledge-loader.js` | Indexing and search, sitemap sync and scraping, health checks. |
| Moderation store | `src/scam-tracker.js`, `src/toggles.js` | Scammer infractions and feature toggles (both under `data/`). |
| Reports | `weekly-report/` | Community reports and join/leave stats. |
| Tools | `scripts/`, `intent/*.js` | One-off and diagnostic scripts — not loaded by the bot. |

Most modules are **factories**: `bot.js` calls `createClaudeModule(...)`, `createIntentModule(...)`, `createMonitorModule(...)`, `registerMessageHandler(...)`, `createSlashHandler(...)` and `createTelegramAdapter(...)` once, passing in the clients, config and other modules. Modules never read the Discord client or `.env` themselves (except `state.js` for `STAFF_WAIT_MINUTES` and `embedder.js` for the Voyage key).

## How a message flows

A Discord message in an answer channel (Telegram follows the same path in `telegram-adapter.js`):

1. **`messageCreate`** (`src/commands.js`) ignores bots. Ticket and collab channels are logged and dropped.
2. The message is logged to `intent/dc-intent-log.jsonl` (general, support and the Chinese channel).
3. **Name-spoof check** (Layer 3): a non-staff sender whose name resembles staff, offering private help → `takeScamAction`.
4. The Chinese channel stops here after a scam check. Staff text commands, the explanation embed, knowledge capture (announcements, tweets) and Q&A learning are handled next.
5. **Routing** picks a scenario:
   - **0** — a reply to the bot's clarifying question → continue the conversation.
   - **0.5** — a reply to any bot answer → classify; answer only a "respond" intent.
   - **1** — an @mention → classify (scam / staff-ping), then answer.
   - **2** — an @mention as a reply to someone else → moderate the original, answer it.
   - **3** — no mention → classify; a "respond" intent waits `STAFF_WAIT_MS` for staff, then auto-answers. Messages arriving meanwhile join the same batch.
6. **`answerQuestion`** (`src/claude.js`): escalate after 2 answers in 2 hours; otherwise check for scam concern, search the KB (`searchKB`), re-rank with Haiku, add live prices if asked, call Sonnet, send the reply (split under 2,000 characters) and store the conversation for follow-ups.

Any scenario that classifies `scam-content` calls `takeScamAction` (delete, escalating timeout, alert) when the scam blocker is ON.

Knowledge flows in separately: `/sync` scrapes the docs and blog sitemaps into `knowledge-base/`, the announcement scan appends facts to curated files, and `buildIndex()` re-embeds only changed chunks into `knowledge-base/.embeddings-cache.json`.

## External systems

| System | Used for | Where |
|---|---|---|
| Discord (discord.js v14) | The main bot | `bot.js`, `src/commands.js`, `src/slash-commands.js` |
| Telegram (Telegraf) | The Telegram bot | `telegram/telegram-adapter.js` |
| Anthropic — Sonnet | Answers, correction drafts, optional reports | `src/claude.js`, `src/kb-monitor.js`, `weekly-report/` |
| Anthropic — Haiku | Intent, scam checks, re-ranking, staleness flags, announcement scan, default reports | `src/intent.js`, `src/claude.js`, `src/kb-monitor.js`, `weekly-report/` |
| Voyage AI | Embeddings for RAG | `src/embedder.js` |
| Dexscreener | Live token prices | `src/price-fetcher.js` |
| `docs.riverai.inc`, `blog.riverai.inc` | Sitemap sync and scraping (needs WARP) | `src/kb-sync.js`, `src/blog-scraper.js` |

## Data on disk

| Path | Written by | In git? |
|---|---|---|
| `knowledge-base/` | sync, capture, `/add-correction`, `/blog`, announcement scan | yes (except the embedding cache and `corrections/_drafts/`) |
| `channel-learning/<channel>/qa-log.md` | Q&A learning | no — local only |
| `intent/*.jsonl` | intent, ticket and collab logs | no |
| `data/` | toggles, usage stats, scammer list, Telegram moderation | no |
| `weekly-report/**/*.jsonl`, `report-cache.json` | member stats, report cache | no |

## Glossary

| Term | Meaning |
|---|---|
| KB | The knowledge base: Markdown files under `knowledge-base/` (plus local `channel-learning/`). |
| RAG | Retrieval-augmented generation: find the most relevant KB chunks, send only those to Claude. |
| Chunk | A ~1,500-character piece of a KB file, embedded as one vector. |
| Correction | A hand-written file in `knowledge-base/corrections/` that overrides wrong docs or blogs; ranked 1.3× in search. |
| Core facts | `knowledge-base/core-facts.md` — injected into every system prompt. |
| Curated announcement file | `exchanges-and-token.md`, `ecosystem-milestones.md`, `important-notices.md` — indexed summaries of announcements. |
| Raw capture | `<Month>_ann/` and `<Month>_tweet/` week files written as messages arrive; never indexed. |
| `<!-- EXCLUDE -->` marker | Wraps a section of a KB file that must not be indexed (closed by `<!-- /EXCLUDE -->`). |
| Intent | One of 15 categories Haiku gives a message; see `intent/intent-taxonomy.md`. |
| Respond intents | `help-seeking`, `troubleshooting`, `onboarding`, `factual-question` — the only ones answered. |
| Scenario 0 / 0.5 / 1 / 2 / 3 | How a message reached the bot (see "How a message flows"). |
| Staff wait | The pause before a Scenario 3 auto-answer, so staff can reply first. |
| Batch | All of one user's messages that arrive during a staff wait, answered together once. |
| Staff engaged | Staff have just replied to a user, so auto-answers to that user are blocked for 3 minutes. |
| Community step-in | Another member answers a pending question; cancels the auto-answer only if it is genuine help. |
| Self-resolution | The asker says it's sorted ("ok", "fixed"); cancels their pending auto-answer. |
| ANSWER / CLARIFY / ESCALATE | The tag Claude starts each reply with: answered, asking one question, or sending to a ticket. |
| Scam layers 1–5 | 1–2 check a scammer's message (regex, then Haiku); 3 is the name-spoof detector; 4–5 check a worried user's question (regex, then Haiku) to add the safety message. |
| Scam blocker | The toggle that lets layers 1–3 delete the message and time the sender out. |
| Infraction | One recorded scam-blocker action against a user (`data/scammer-list.json`). |
| Watch / mute / kick / ban | Telegram moderation modes, re-applied on rejoin. |
| Staff panel | The Telegram DM menu (`/start`) for reports and member stats. |
| Explanation embed | Staff "@bot + message link": shows which sources an answer used. |
| Q&A learning | Saving a user question with the staff reply into `channel-learning/` for RAG. |
| Date floor | `BLOG_SINCE_DATE` / `effectiveSinceDate`: blog posts older than this are not synced. |
| WARP | Cloudflare's VPN client; must be on for scraping. |

## When you add…

| You add | Also update |
|---|---|
| A code file | A row in the CLAUDE.md file map; a file header comment and `// ─── Section ───` headers; a purpose comment above each definition. Then `npm run index`. |
| A code folder | Add it to `CODE_ROOTS` in `scripts/build-index.js` (or it stays invisible to the index and checks), give it a README.md, and add it to the file map. |
| A setting | `.env.example`, your `.env`, `docs/REFERENCE.md` § Settings and the code that reads it — the drift check compares all four. Read it in `bot.js` and pass it in, not inside a module. |
| A slash command | Its definition in `COMMANDS` and a `cmd === '…'` branch in `src/slash-commands.js`, a row in `docs/REFERENCE.md` § Commands, and `_dev-notes/Bot commands.txt` if the owner asks. |
| A Telegram or `!` command | Its handler, and a row in `docs/REFERENCE.md` § Commands. |
| An event listener or cron job | A row in `docs/REFERENCE.md` § Events or § Scheduled jobs. |
| A doc | Link it from CLAUDE.md or a README; long docs get a generated section list automatically. |
| A deliberate choice | A row in `docs/DECISIONS.md` with its reason. |
