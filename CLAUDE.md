# River Protocol AI Helper (RiverAiHelper)

A Discord and Telegram support bot for River Protocol. It answers community questions with Claude (Sonnet) using RAG over a local knowledge base (Voyage AI embeddings), classifies every message's intent with Haiku, blocks scammers, and produces community reports. CommonJS, Node; pm2 runs `node bot.js` as `river-bot`.

## How to navigate — read this first

1. **Current state** (active season, toggles, open items): read `CONTEXT.md` § Quick Reference — its generated section list at the top gives the line.
2. **Find the code**: use the task table below, then look the name up in `CODE_INDEX.md` for its exact `file:line`, and read just that part with a small `limit`.
3. **Inside a code file**: the top of the file holds a header and a generated Contents block (sections and definitions with line numbers).
4. **Long docs** (`CONTEXT.md`, `README.md`, …) start with a generated section list — read it, then jump to the section.
5. **How it fits together / why it is this way**: `docs/ARCHITECTURE.md` (parts, message flow, glossary, "when you add…") and `docs/DECISIONS.md` (deliberate choices). Settings, commands, events and timers: `docs/REFERENCE.md`.

Do not read whole files or scan `src/` when the index can point you to the line.

## Rules to know before editing

- **`clientReady` not `ready`** — discord.js v14 typed event; do not revert.
- **`node-fetch`** is ESM-only: always `const fetch = (await import('node-fetch')).default`, never `require('node-fetch')`.
- **Cloudflare WARP** must be on to scrape `docs.riverai.inc` / `blog.riverai.inc`. A 403 while scraping → check WARP before the code.
- **Only `riverai.inc` links.** `river.inc` and its subdomains are retired (2026-09-04). It is mentioned on purpose only in `core-facts.md`, the scam-safety correction and `outro-official-links.md` (scraped blog posts also carry the live blog's own `?ref=blog.river.inc` tracking tags — harmless; see `docs/DECISIONS.md`) so the bot can redirect users who report the old domain. Never reintroduce a `river.inc` link into code, prompts or sync URLs.
- **URLs in angle brackets** `<https://example.com>`, never `[text](url)` — except `https://discord.com/channels/…` links, which must not be wrapped.
- **`effectiveSinceDate`** only advances when blog posts are deleted from disk — never recalculate it on a normal sync.
- **Blog lastmod verification** in `syncBlog` (cross-check with `fetchPublishMeta`) and `knowledge-base/blogs/_excluded-legacy.json` must stay.
- **Testnet wording** — `core-facts.md` must say "River had a testnet in the past but it is no longer active."
- **Never commit or upload** `channel-learning/` Q&A logs, `data/` or the intent logs — only `channel-learning/README.md` is tracked.
- **GitHub / commits** — never mention committing, pushing or GitHub unless the user asks.
- **`_dev-notes/`** is the user's private folder. Only ever update `_dev-notes/Bot commands.txt`; never touch anything else there unless the user names it.
- **Deliberate choices are circumstantial.** `docs/DECISIONS.md` records why things are the way they are. When a task runs into one, tell the user and let them decide — never silently follow it against a request or silently override it.

## File map

| Path | What it owns |
|---|---|
| `bot.js` | Entry point: settings, clients, module wiring, start-up, cron jobs, gateway watchdog, staff name cache. |
| `src/state.js` | All shared Maps, timer constants and referral codes. |
| `src/commands.js` | Discord `messageCreate`: routing (Scenarios 0–3), `!` staff commands, explanation embed, scam blocker action. |
| `src/slash-commands.js` | Slash command definitions and handler. |
| `src/intent.js` | Haiku intent classification, intent/ticket/collab logs, scam layers 1–2, Telegram FUD check. |
| `src/claude.js` | Answering: system prompt, scam-concern check (layers 4–5), RAG + re-ranking, prices, Sonnet call, conversation state. |
| `src/rag.js` | Chunking, embedding cache, cosine search. |
| `src/embedder.js` | Voyage AI embedding adapter. |
| `src/kb-sync.js` | Docs and blog sitemap sync; API usage tracking. |
| `src/blog-scraper.js` | Page → Markdown scraper, RSS fallback, publish metadata. |
| `src/kb-monitor.js` | Correction staleness check and drafts; announcement fact scan. |
| `src/knowledge-loader.js` | Legacy: `getSourceFiles()` for the explanation embed. |
| `src/price-fetcher.js` | Live RIVERPTS / $RIVER prices (Dexscreener). |
| `src/scam-tracker.js` | Scammer infraction store (`data/scammer-list.json`). |
| `src/tweet-check.js` | Reads linked X/Twitter posts (FxTwitter) and judges them for the scam blocker. |
| `src/toggles.js` | Discord / Telegram / Scam Blocker toggles (`data/toggles.json`). |
| `src/utils.js` | Date, Discord and spoof-detection helpers; Q&A learning and announcement capture writers. |
| `telegram/telegram-adapter.js` | The Telegram bot: routing, staff DM panel, moderation, join/leave. |
| `weekly-report/community-report/community-report.js` | Community reports (Discord post or Telegram DM), 14-day cache. |
| `weekly-report/member-stats/discord/discord-member-stats.js` | Discord join/leave log and counts. |
| `weekly-report/member-stats/telegram/tg-member-stats.js` | Telegram join/leave log and counts. |
| `intent/fetch-messages.js` | Utility: dump a channel's messages as JSON. |
| `intent/backfill-chinese.js` | One-time: backfilled the Chinese channel into the intent log. |
| `scripts/check-perms.js` | Diagnostic: the bot's Discord permissions per channel. |
| `scripts/intent-batch-audit/prepare-and-submit.js` | One-time audit step 1: submit classified messages to the Batch API. |
| `scripts/intent-batch-audit/analyze-results.js` | One-time audit step 2: tally the reviewer's verdicts. |
| `scripts/scam-review/review-infractions.js` | Periodic AI review of scam-blocker actions (finds false positives). |
| `scripts/build-index.js` | Index builder and drift checks (`npm run index`). |
| `scripts/index-hook.js` | Claude Code edit hook: rebuilds the generated parts after each edit. |
| `scripts/stop-hook.js` | Claude Code stop hook: runs the drift check before a turn ends. |
| `test/helpers.js` | Test helpers: sandbox copies (tests never touch real data), fake Claude client. |
| `test/message-handler.test.js` | Tests: channel gate, scam blocker vs staff, Q&A learning. |
| `test/knowledge.test.js` | Tests: RAG index contents, EXCLUDE, blog numbering, announcement-scan retry, staleness check. |
| `test/utils-and-reports.test.js` | Tests: small helpers and community-report rules. |
| `test/evals/run-evals.js` | Answer-quality evals against the real models (`npm run eval`); cases in `test/evals/cases.json`. |
| `CODE_INDEX.md` | Generated: every definition, setting, command, event and job with its line. |
| `.claude/settings.json` | The two hooks above (shared). `.claude/settings.local.json` is personal — never edit or commit it. |
| `docs/` | `ARCHITECTURE.md`, `DECISIONS.md`, `REFERENCE.md`. |
| `CONTEXT.md` | Current state, feature design notes, known issues, pending work. |
| `README.md` | Human overview: running the bot, folders, knowledge base layout. |
| `knowledge-base/` | The KB (written by the bot and by hand). Off-limits for indexing; its files are fed to Claude, so never add comments to them. |
| `intent/` | Intent taxonomy and theory notes (docs) and the local intent logs. |
| `channel-learning/` | Local Q&A logs (not in git) and its README. |
| `data/` | Local runtime state — not in git. |

## Where to look for…

| Task | Look in | Key names |
|---|---|---|
| Start-up, wiring, cron | `bot.js` | `buildStaffNameCache` |
| Shared state, timers, referral codes | `src/state.js` | `STAFF_WAIT_MS`, `REFERRAL_CODES` |
| Discord routing (Scenarios 0–3), batching | `src/commands.js` | `registerMessageHandler`, `scheduleAutoAnswer`, `fireAutoAnswer`, `cancelPendingBatch` |
| Scam blocker action and timeouts | `src/commands.js` | `takeScamAction`, `escalatedTimeoutMs`, `scamEvidence` |
| Linked-tweet check (fake help desks, ordinary tweets) | `src/tweet-check.js`, `src/commands.js` | `createTweetChecker`, `isLinkOnly`, `campaignCounts` |
| Slash commands | `src/slash-commands.js` | `COMMANDS`, `registerSlashCommands`, `createSlashHandler` |
| Intent classification and logs | `src/intent.js` | `classifyMessageIntent`, `RESPOND_INTENTS`, `logMessageIntent` |
| Scammer-side detection (layers 1–2) | `src/intent.js` | `detectScamContentSync`, `hasSoftScamSignal`, `detectScamContentLLM` |
| Name-spoof detection (layer 3) | `src/utils.js`, `bot.js` | `looksLikeSpoofedName`, `looksLikeHelperOffer`, `buildStaffNameCache` |
| Scam-safety message (layers 4–5) | `src/claude.js` | `isScamConcern`, `detectScamConcernSync`, `SCAM_CONCERN_BLOCK` |
| Answering, system prompt, conversation state | `src/claude.js` | `answerQuestion`, `askClaude`, `getSystemPrompt`, `buildInitialHistory`, `pruneStaleEntries` |
| Retrieval and re-ranking | `src/rag.js`, `src/claude.js` | `searchKB`, `buildIndex`, `rerankChunks` |
| Embeddings | `src/embedder.js` | `embed` |
| Live prices | `src/price-fetcher.js` | `getLivePrices`, `isPricingQuestion` |
| Docs / blog sync, scraping | `src/kb-sync.js`, `src/blog-scraper.js` | `syncDocs`, `syncBlog`, `fetchPublishMeta`, `scrapeSingleArticle` |
| API usage and cost | `src/kb-sync.js` | `trackUsage`, `loadUsageStats` |
| Correction staleness, announcement scan | `src/kb-monitor.js` | `checkCorrectionStaleness`, `draftCorrectionUpdates`, `scanAnnouncementsForNewFacts` |
| Core facts | `src/claude.js` | `loadCoreFacts` |
| Toggles | `src/toggles.js` | `isEnabled`, `toggle` |
| Scammer records | `src/scam-tracker.js` | `recordInfraction`, `trimInfractions` |
| Explanation embed | `src/commands.js`, `src/claude.js` | `sendExplanationEmbed`, `identifyRelevantSources` |
| Q&A learning, announcement capture | `src/utils.js` | `saveQAPair`, `appendToMonthlyWeeklyFile` |
| Telegram routing, staff panel, moderation | `telegram/telegram-adapter.js` | `createTelegramAdapter`, `handlePrivateDM`, `handleWatchedMessage`, `sanitizeForTelegram` |
| Community reports | `weekly-report/community-report/community-report.js` | `buildCommunityReport`, `generateCommunityReport`, `buildPrompt` |
| Member stats | `weekly-report/member-stats/discord/discord-member-stats.js`, `weekly-report/member-stats/telegram/tg-member-stats.js` | `getMemberStats`, `getTgMemberStats` |
| Index builder, drift checks | `scripts/build-index.js` | `build`, `runChecks`, `analyzeCode`, `KNOWN_FINDINGS` |

## Key flows (details in docs/ARCHITECTURE.md)

- **A message:** `messageCreate` → logging → spoof check → routing (Scenario 0 / 0.5 / 1 / 2 / 3) → `classifyMessageIntent` → `answerQuestion` → `searchKB` + `rerankChunks` → `askClaude`.
- **Scam:** layers 1–3 and the linked-tweet check → `takeScamAction` (when the scam blocker is ON); layers 4–5 → safety message in the answer.
- **Knowledge:** `/sync` → `syncBlog` / `syncDocs` or `scanAnnouncementsForNewFacts` → `checkCorrectionStaleness` (corrections + `core-facts.md`) → `buildIndex`.

## Generated parts and checks

`npm run index` (`scripts/build-index.js`) generates — never hand-edit these:

- the **Contents block** at the top of every code file (between the `----- Contents` markers),
- **`CODE_INDEX.md`**,
- the **section list** at the top of every doc over 150 lines (an HTML comment, invisible when rendered).

It then checks the docs against the code: file map and task table above, code names in this file and README.md, settings (code ↔ `.env.example` ↔ `.env` ↔ `docs/REFERENCE.md`), commands and events (↔ `docs/REFERENCE.md`), npm scripts, hand-written line numbers, links, and dead code. Known findings awaiting the owner's decision are listed in `KNOWN_FINDINGS` and reported as warnings.

| Command | What it does |
|---|---|
| `npm run index` | Rewrites stale generated parts and prints the drift report. |
| `npm run index:check` | Changes nothing; exits 1 if anything is stale or drifted. |
| `npm run index:watch` | Rebuilds on every save. |

Hooks in `.claude/settings.json` run it for you: after every edit (regenerate only) and when a turn ends (check; drift sends Claude back once to fix it).

- **Tests:** `npm test` (fast, offline, fakes only — run after every code change) and `npm run eval` (real models, costs a little — run after changing prompts, the classifier, the KB or answer logic). When you fix a bug or change behaviour, add a test in `test/` that fails without the fix; when the bot answers or classifies something wrong in real use, add the case to `test/evals/cases.json`.
- **A change is finished only when `npm test` and `npm run index:check` pass.** Never write a line number into a doc — point to a heading or a name.
- **After any change that alters behaviour**, run a description review (the "Description audit" prompt) — the scripts check that docs *point* to real things, not that what they *say* is still true — and record it in `.claude/last-description-review`.
