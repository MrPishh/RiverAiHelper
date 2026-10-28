# River Discord Bot — Session Context

This file exists so any new Claude Code session can read it and immediately understand the full state of the project without needing conversation history.

---

## Quick Reference — Read This Section Only at Session Start

**Bot:** Discord + Telegram support bot for River Protocol. Claude Sonnet-4-6 + Voyage AI RAG. All modules in `src/`.

### Active State
- Conversion 3.0 / S6 is the active season (July 1 – Sep 30, 2026); S6 ideal rate is 0.01, same as S5
- Scam blocker: **OFF** by default → `/toggle platform:Scam Blocker` to enable
- Prompt caching: ON (5-min TTL, static system block cached)
- Live price fetching: ON — `src/price-fetcher.js` (Dexscreener, 5-min cache, auto-injects on price questions)
- RAG indexed: 45 docs · 47 blogs · 11 corrections · 17 governance · 3 announcement curated files

### File Map
| File | Purpose |
|---|---|
| `bot.js` | Entry point — client wiring, staff name cache cron |
| `src/state.js` | All shared Maps + timing constants + REFERRAL_CODES |
| `src/utils.js` | Date helpers, Discord helpers, spoof-detection |
| `src/intent.js` | Intent classification (Haiku), logging, scammer-side detection (Layers 1–2) |
| `src/kb-sync.js` | Sync docs/blog from sitemaps, usage stats tracking |
| `src/claude.js` | answerQuestion, system prompt, RAG reranking, scam concern, live price injection |
| `src/commands.js` | messageCreate handler, all !text staff commands, Scenarios 0–3, spoof detector (Layer 3) |
| `src/slash-commands.js` | All /slash command registration + handlers |
| `src/kb-monitor.js` | Correction staleness check, announcement auto-scan |
| `src/rag.js` | Chunks MD files, Voyage AI embeddings, cosine search (TOP_K=8, CHUNK=1500) |
| `src/price-fetcher.js` | Live RIVERPTS/$RIVER prices from Dexscreener, 5-min cache, `isPricingQuestion()` |
| `src/scam-tracker.js` | Scammer infraction store → `data/scammer-list.json` |
| `src/toggles.js` | Platform toggle (Discord/Telegram/Scam Blocker), persisted to `data/toggles.json` |
| `src/embedder.js` | Voyage AI adapter (voyage-3-lite) |
| `telegram/telegram-adapter.js` | Full Telegram bot adapter (Telegraf), full Discord parity |
| `weekly-report/community-report/community-report.js` | Weekly/daily community reports, 14-day cache |

### Key Timer Constants (all defined in `src/state.js`)
`STAFF_WAIT=5min` · `STAFF_ENGAGED=3min` · `POST_STAFF=3min (20min window)` · `CONV_EXPIRY=30min` · `REPHRASE_WINDOW=2hr`

### Top Pending Items
- **Batch intent log analysis** — started 2026-08-18, `msgbatch_01PzBGupfcCBv6nBYyawno9f` (Anthropic Batch API, Sonnet reviewer, 50% cost saving) — see "Time-based reminders" below for detail
- **Prompt cache stats** — check after ~1 week (`cache_read_input_tokens` vs `cache_creation_input_tokens` ratio) — especially relevant now: 2026-08-18 fixed a regression that had silently dropped the cross-conversation cache breakpoint
- **Log rotation** — implement when any intent log hits ~5 MB
- **Telegram proactive scam-blocking** — Discord has `takeScamAction` (delete + timeout + alert) wired into every scenario that classifies intent; Telegram only moderates already-`watchedUsers`-flagged accounts reactively, with no equivalent action for a first-time offender's live message. Flagged 2026-08-18, not yet decided/built.

> For section details use the Table of Contents below. Navigate with `Read(offset=N)` — grep for the `## Section Name` to get the line number.

---

## Table of Contents

- [What This Bot Does](#what-this-bot-does)
- [File Map](#file-map)
- [Answer Flow](#answer-flow-how-the-bot-responds)
- [Intent Classification System](#intent-classification-system)
- [Staff Commands](#staff-commands)
- [Sitemaps](#sitemaps)
- [Network Note](#network-note)
- [Corrections System](#corrections-system)
- [KB Monitor](#kb-monitor)
- [Backfilling Missed Announcements](#backfilling-missed-announcements)
- [Key Technical Decisions](#key-technical-decisions-why-not-just-what)
- [RAG Design Decisions](#rag-design-decisions)
- [Core Facts Design](#core-facts-design)
- [Multi-Turn Conversation Design](#multi-turn-conversation-design)
- [RAG Source Attribution](#rag-source-attribution)
- [Referral Code Rotation](#referral-code-rotation)
- [System Prompt Features](#system-prompt-features-getsystemprompt)
- [Known Issues / Gotchas](#known-issues--gotchas)
- [RAG Index State](#rag-index-state)
- [Pending / Discussed But Not Done](#pending--discussed-but-not-done)
- [Timer Reference](#timer-reference)
- [.env Variables](#env-variables)

---

## What This Bot Does

A Discord support bot for **River Protocol** that answers community questions using Claude (claude-sonnet-4-6). It uses RAG (Retrieval-Augmented Generation) with Voyage AI embeddings so only the most relevant knowledge base chunks are sent to Claude per question — not the entire KB.

---

## File Map

All modules listed below (except `bot.js`) live in `src/`. The reorganisation from root into `src/` was completed 2026-06-01.

| File | Purpose |
|---|---|
| `bot.js` | Thin entry point — creates clients, wires all `src/` modules, fires `clientReady`, launches Telegram bot, calls Discord `login`. Also contains `buildStaffNameCache(guild, staffRoleIds)` — builds `state.staffNameCache` at startup and refreshes every 24 hrs via cron |
| `src/state.js` | All shared Maps + timing constants + REFERRAL_CODES. No local requires (root of dependency tree). Also exports `staffNameCache` (Map of normalizedName → originalDisplayName) and `staffNameCacheTs` for the spoof detector |
| `src/utils.js` | Pure helpers: date/folder utils (`getWeekRange`, `getDayRange`), Discord helpers (`isStaff`, `isBotMentioned`, `stripBotMention`), `looksResolved`, `saveQAPair`. Also exports spoof-detection helpers: `normalizeDisplayName`, `looksLikeSpoofedName`, `looksLikeHelperOffer` |
| `src/intent.js` | Factory `createIntentModule(anthropic, { SUPPORT_CHANNEL_ID })` → `classifyMessageIntent`, `logMessageIntent`, `logIntentClassification`, `logTelegramMessage`, `logTelegramIntent`, `RESPOND_INTENTS`, `logToTicketFile`, `logToCollabFile`. Also exports module-level `logToTicketFile(message)` and `logToCollabFile(message)` (write-time only — no classification) and path constants `INTENT_LOG_PATH`, `TG_INTENT_LOG_PATH`, `TICKET_LOG_PATH`, `COLLAB_LOG_PATH`. Contains module-level `detectScamContentSync(content)` — scammer-side tier-1 regex that short-circuits Haiku for bio/profile redirects and t.me/wa.me links |
| `src/kb-sync.js` | `syncDocs`, `syncBlog`, `registerDocInIndex`, `registerBlogInIndex`, `loadUsageStats`, `trackUsage` |
| `src/claude.js` | Factory `createClaudeModule(anthropic, state, { searchKB, getSourceFiles, trackUsage })` → `getSystemPrompt`, `askClaude`, `answerQuestion`, `pruneStaleEntries`, `loadCoreFacts`, `isScamConcern`. Also contains `rerankChunks` (internal — Haiku re-ranker that filters retrieved KB chunks before they reach Claude) |
| `src/commands.js` | Factory `registerMessageHandler(discordClient, state, config, modules)` — full `messageCreate` event + all `!text` staff commands. Ticket channel early-return: checks `message.channel.parentId` against `SUPPORT_TICKET_CATEGORY_IDS` / `COLLAB_CATEGORY_IDS` sets — logs non-staff messages via `logToTicketFile` / `logToCollabFile`, never responds. Chinese channel: logs via `logMessageIntent` then returns early (no classification, no response — batch processing planned). Spoof detection block: runs after Chinese early-return, classifies matching messages as `scam-content` in the intent log (no active blocking yet) |
| `src/slash-commands.js` | `registerSlashCommands()` registers all `/slash` commands with Discord. `createSlashHandler()` handles interactions. Same dependency-injection pattern as `commands.js`. |
| `src/kb-monitor.js` | Factory `createMonitorModule(anthropic)` → `checkCorrectionStaleness`, `scanAnnouncementsForNewFacts`. Passive KB health monitor. |
| `src/rag.js` | RAG engine — chunks MD files, embeds via Voyage AI, cosine similarity search. TOP_K=8, CHUNK_SIZE=1500, OVERLAP=150. `collectMdFiles` skips `*_ann` and `*_tweet` monthly subfolders at directory level — raw Discord captures, not curated content. |
| `src/embedder.js` | Voyage AI embedding provider (`voyage-3-lite`). Retry on 429. Swap via `EMBEDDING_PROVIDER` in `.env` |
| `src/knowledge-loader.js` | Legacy. Only `getSourceFiles()` remains — used by explanation embeds for source attribution |
| `src/blog-scraper.js` | Scrapes URLs to Markdown: jsdom → Readability → Turndown+GFM. RSS fallback on 403 |
| `src/toggles.js` | Platform reply toggle. `isEnabled(platform)`, `toggle(platform)`, `getStatus()`. State persisted to `data/toggles.json` — survives restarts. |
| `data/toggles.json` | Persisted toggle state `{ discord: true, telegram: true, "scam-blocker": false }`. Auto-created on first toggle; `data/` auto-created if missing. |
| `data/usage-stats.json` | Persisted Claude API token counts and estimated cost. Auto-created on first answer; `data/` auto-created if missing. |
| `data/scammer-list.json` | Persistent scammer infraction log. Keyed by Discord user ID — survives username/display name changes. Written by `src/scam-tracker.js` on every scam-blocker action. Managed via `/scam-record` slash command. |
| `src/scam-tracker.js` | Scammer infraction store — `recordInfraction`, `getRecord`, `getAllRecords`, `removeInfraction`, `clearUser`. No local requires. |
| `logs/` | Log files outside PM2's log stream. Gitignored. `logs/.gitkeep` tracks the folder in git. |
| `scripts/check-perms.js` | One-shot diagnostic: checks View / Read / Send / Embed Links for every configured channel. Run with `node scripts/check-perms.js`. Reads channel IDs from `.env`. |
| `telegram/telegram-adapter.js` | Telegram bot adapter using Telegraf. Full parity with Discord: intent gate, staff-admin detection (cached 10 min), staff-wait timer, staff-engaged suppression, Scenario 0/0.5/@mention handling, self-resolution detection, community step-in cancellation, community-discussion follow-up detection, `staff-ping` redirect. Logs all messages to `tg-intent-log.jsonl`. DM staff panel: `/start` opens inline keyboard (Report / Stats); persistent "≡ Menu" button set via `setChatMenuButton` + `setMyCommands` at startup. **Moderation system:** perma-ban store (`data/tg-perma-ban.json`) with four modes — `watch` (delete harmful msgs), `mute` (permanent mute, re-applied on rejoin and captcha unlock), `kick` (removed on every rejoin), `ban` (banned on every rejoin). FUD secondary check via `checkWatchedFUD` in `src/intent.js`. Alert DMs sent to subscribed admins on every action. |
| `weekly-report/member-stats/discord/discord-member-stats.js` | Logs Discord join/leave events to `member-log.jsonl`. `getMemberStats(from, to)` returns join/leave counts for any date range. Registered via `registerMemberEvents(client)` in `clientReady` |
| `weekly-report/member-stats/telegram/tg-member-stats.js` | Logs Telegram join/leave events to `tg-member-log.jsonl`. `getTgMemberStats(from, to)` returns join/leave counts for any date range. |
| `weekly-report/community-report/community-report.js` | Reads intent logs + ticket log for a date range. Sends to Haiku/Sonnet to produce three-section report: Common Problems, FAQs, Conversation Highlights. Posts to REPORTS_CHANNEL_ID. Supports `reportType: 'weekly'` or `'daily'`. Includes Chinese Discord channel and Telegram topic when `CHINESE_DISCORD_CHANNEL_ID` / `CHINESE_TELEGRAM_TOPIC_ID` are set — Claude analyses Chinese messages but writes the report in English. Both daily and weekly reports are cached in `report-cache.json` (daily caching added 2026-08-18; previously weekly-only), keyed by `platform::model::fromDate::toDate` (plus `::cn` suffix when Chinese channels are configured) — repeat runs with the same parameters return instantly with no API call, from either Discord or Telegram, whichever asks first. Pass `force: true` to bypass the cache and regenerate. Cache entries expire after 14 days. `max_tokens` is 800. |
| `weekly-report/community-report/report-cache.json` | Weekly report cache. Auto-created on first `/report period:week` run. Never edit manually |
| `intent/` | `dc-intent-log.jsonl`, `tg-intent-log.jsonl`, `ticket-log.jsonl`, `intent-taxonomy.md`, `theory-notes.md`, `fetch-messages.js`, `backfill-chinese.js` |
| `README.md` | Human-readable project overview: file descriptions, all staff commands, all .env vars, KB folder structure |
| `CONTEXT.md` | This file. Read at the start of every session. |

### Knowledge Base Structure

```
knowledge-base/
  core-facts.md                  ← Static facts always injected into Claude system prompt
  docs/
    _docs-context.md             ← Curation notes, known issues, sync rules
    _index.json                  ← Tracks URL, slug, file, lastScraped per docs page
    *.md                         ← Scraped docs pages (slug-named, e.g. intro-quickstart.md)
  blogs/
    _blogs-context.md            ← Curation notes, exclusion rules, overlap map, sync rules
    _index.json                  ← Tracks URL, slug, file, lastmod, lastScraped per post
    *.md                         ← Scraped blog posts (slug-named)
    May_blog/ etc.               ← Monthly folders for manually added posts (/blog action:Add)
  governance/
    _governance-context.md       ← 17 curated files, narrative order, excluded topic IDs, sync rules
    *.md                         ← First posts only from gov.riverai.inc/c/proposal-lab/5
  announcements/
    _announcements-context.md    ← Curation notes, cross-reference status, sync rules
    exchanges-and-token.md       ← Token address, exchange listings, DEX integrations
    ecosystem-milestones.md      ← Audits, investments, season stats, launch timeline, brand upgrade
    important-notices.md         ← Bridge pause, operational alerts, safety notices
    May_ann/ etc.                ← Auto-saved raw announcements (EXCLUDED from RAG — use curated files)
  tweets/
    _tweets-context.md           ← Decision: tweets not indexed (mirrors announcements, low signal)
    May_tweet/ etc.              ← Auto-saved raw tweets (EXCLUDED from RAG)
  corrections/
    _corrections-context.md      ← Authority hierarchy, when to add corrections, file descriptions
    conversion-mechanism.md      ← Deep reference: Conversion 1.0→2.0→3.0, S5 params, tone guidance
    river4fun-outdated-features.md ← Removed features: staking pool, River Pts voting
    referral-program.md          ← Referral code guidance, registration vs own code, rotation codes
    tokenomics-unlock-schedule.md ← Definitive RIVER unlock schedule for all non-dynamic categories
    binance-river-airdrop.md     ← River × Binance Wallet campaign: 21 RIVER distributed in two tranches in 2026 (final). Legitimate, safe to hold/sell.
    official-support-and-scam-safety.md ← Official support policy, safety message, red flags. RAG source for scam-related questions.
    river4fun-zero-points.md            ← Zero points despite daily posting: points update daily (tweeting) vs weekly (satUSD liquidity); primary cause is Twitter shadowban — includes exact search method for both @river4fun and @riverdotinc; non-Twitter earning via S5 blog. Corrects old season advice about tagging partner projects.
  .embeddings-cache.json         ← Voyage AI vector cache (auto-generated, do not edit)

channel-learning/
  general/qa-log.md              ← Q&A pairs learned from staff replies in #general
  support/qa-log.md              ← Q&A pairs learned from staff replies in #support

intent/
  dc-intent-log.jsonl            ← Discord: two record types — raw message log (platform, ts, id, content, isStaff, etc.)
  |                                 and classified intent records ({platform:"discord", type:"classified", id, intent, ts})
  tg-intent-log.jsonl            ← Telegram: same structure, platform:"telegram". Separate file for platform-level analysis
  ticket-log.jsonl               ← Discord support ticket messages. Records: { platform, ts, id, channelId, channel, authorId, author, content }. Non-staff only. No source field — file assignment IS the classification. Bot never responds in ticket channels — logging only
  collab-log.jsonl               ← Discord collab/business inquiry messages. Same record format as ticket-log.jsonl. Excluded from reports — reserved for future Business Proposals section.
  intent-taxonomy.md             ← Category registry: intents, context rules, examples, edge cases
  theory-notes.md                ← Reference: SDT, Speech Act Theory, Bayesian, Control/Queuing/Decision Theory
  fetch-messages.js              ← Utility: pull historical messages from Discord REST API
```

---

## Answer Flow (How the Bot Responds)

1. **Scenario 0** — User replies to bot's CLARIFY question → continues full conversation history
2. **Scenario 0.5** — User replies to any bot ANSWER using the platform's reply feature (no @mention needed) AND message is more than one word → runs `classifyMessageIntent()` on the reply text first and only answers if the intent is in `RESPOND_INTENTS` (updated 2026-07-10, both platforms); `staff-ping` gets the support-channel redirect; everything else (e.g. `general-greeting`, `community-discussion`) is skipped and logged. Fixes a bug where replying to the bot's last message in a busy channel/thread — even when the reply was actually addressed to a different person, purely agreeing/venting with no question — still triggered a full Sonnet answer, because reply structure alone (not content) used to decide whether to respond.
3. **Scenario 1** — User @mentions bot directly → classifies intent first; if `staff-ping`, redirects to support channel; otherwise answers immediately
4. **Scenario 2** — User @mentions bot as reply to another message → scam-content/staff-ping classification always checks the **original message** being replied to, never the mentioning user's own text (fixed 2026-08-18: classifying the mentioning user's own words under the original asker's identity could misattribute a scam-content action to the wrong, innocent user). If the mention carries its own text (e.g. staff replying to a vague question with their own clearer phrasing) and classification clears it, that text is used as the question for the *answer* — but the answer is still attributed to and threaded under whoever's message the mention replied to (so their conversation context continues correctly) — the reply itself lands on the mentioning user's message, not the original one, since the mentioning user typically pings the original asker separately. If the mention carries no text (pure "explain this" tag), falls back to fetching and answering the original message as before. If the replied-to message is the bot's own, the mention's own text is answered as a personal follow-up (there's no "original asker" to attribute it to).
5. **Scenario 3** — User posts with no mention → classifies intent; only the 4 respond categories (`help-seeking`, `troubleshooting`, `onboarding`, `factual-question`) proceed to `scheduleAutoAnswer()` which waits STAFF_WAIT_MINUTES (5) then auto-answers if no staff reply. Messages from the same user in the same channel that arrive while a batch is already pending are folded into it instead of starting a competing timer (added 2026-08-18) — the batch is answered as one combined message once the original timer fires, not as N separate replies. See "Burst batching" below.

**Channel gate:** `BOT_ANSWER_CHANNEL_IDS` only restricts unprompted auto-answers (Scenario 3). Direct `@mentions` (Scenarios 1 & 2) are allowed in any channel, including staff channels. However, the bot must have **Send Messages** permission in that channel in Discord's server settings, otherwise the reply will fail silently with `[Answer] Failed: Missing Permissions`.

**Claude response tags:** Every response starts with `ANSWER:`, `CLARIFY:`, or `ESCALATE:`.

**Rephrase escalation:** After MAX_BOT_ANSWERS_BEFORE_TICKET (2) complete answer exchanges with the same user in the same channel within 2 hours, the bot escalates to the support ticket link.

### Conversation context guards (added 2026-05-12)

Two state maps plus two event-based rules protect against the bot firing when it shouldn't:

| Map | Key | TTL | Purpose |
|---|---|---|---|
| `staffEngaged` | `userId::channelId` | 3 min | Set when staff replies directly to a user's message, **or** when staff posts any plain (non-reply) message while that user has a pending Scenario 3 timer in the same channel — either way, the pending timer is cancelled immediately rather than waiting to expire. Suppresses **Scenario 3 auto-answers only** — @mentions (Scenario 1 & 2) and bot-replies (Scenario 0.5) still get a response. |

**Burst batching** (added 2026-08-18) — `pendingQuestions` is keyed by `userId::channelId`, not by message ID. If the same user posts again while a batch is already pending, the new message is folded into `messages[]` on the existing entry instead of starting a competing timer — the original timer/deadline is left untouched, so a burst of messages still produces exactly one combined answer (all messages joined and sent to Claude as one question) instead of a separate reply per message, and a single-message asker's wait time is unaffected. A companion map, `pendingMsgIndex` (`messageId → userId::channelId`), lets a reply to *any* individual message in the batch — not just the latest — still find and cancel the whole thing. Both maps are always mutated together; see `cancelPendingBatch()` / `fireAutoAnswer()` in `commands.js` and their Telegram mirrors.

**Self-resolution cancellation** — on every incoming message, if the sender has a pending Scenario 3 batch and their message matches `looksResolved()` (e.g. "ok", "fixed", "working now", "good now"), the whole batch is cancelled silently before it fires.

**Community stepped in** — if a non-staff user replies to a pending Scenario 3 question before the timer fires, the reply is classified first. The batch is only cancelled if the reply is genuine `community-help`. Any other classification — including `scam-content` — leaves the timer running. This prevents scammer accounts from suppressing the bot by replying within seconds of a victim's message (observed incident: 3 scammer accounts replied with phishing links within 9 seconds, which would have cancelled the timer under the old blanket rule).

**Scenario 0.5 gate** — any reply to a bot message using the platform's reply feature (> 1 word) is a *candidate* to continue the conversation. Single-word/emoji-only replies (< 2 words) are ignored outright. Since 2026-07-10 (both platforms), candidates additionally go through `classifyMessageIntent()` — only `RESPOND_INTENTS` categories actually get answered; `staff-ping` redirects to support.

**Community-discussion follow-up detection** (added 2026-06-01) — when a Scenario 3 message is classified as `community-discussion`, the message content is stored in `recentCommunityDiscussion` (keyed by `userId::channelId`, 30-min TTL). If the same user posts a follow-up within 30 minutes, that prior message is passed as context to the classifier. The stored entry is cleared once a `RESPOND_INTENTS` classification is triggered for that user.

---

## Intent Classification System

### How it works

Every message that reaches Scenario 1, 2, or 3 is classified by Claude Haiku (`claude-haiku-4-5-20251001`) before a response decision is made. The classifier returns one of 15 categories from the intent taxonomy.

**`classifyMessageIntent(content, message)`** — async function. Builds a prompt with three context signals:
- **Channel** — `#support` or `#general`. Same message reads differently depending on channel.
- **Reply-to context** — fetches the referenced message (if any) to determine who the message is replying to: the bot, another community member, or nobody.
- **Recent thread** — last 3 messages in the channel before this one, shown as `author: content` lines.

Returns the category string. On API error, falls back to `'help-seeking'` (fail open — never go silent due to a classification failure).

**`RESPOND_INTENTS`** — `Set { 'help-seeking', 'troubleshooting', 'onboarding', 'factual-question' }`. Only these four categories proceed to `scheduleAutoAnswer()` in Scenario 3.

**`ALL_INTENT_CATEGORIES`** — the full list of 15 valid category strings. Used to validate Haiku's response and reject hallucinated labels.

**`logIntentClassification(messageId, intent)`** — appends `{ type: 'classified', id, intent, ts }` to `intent/dc-intent-log.jsonl`. Joinable with the raw message record by `id`.

### Where classification runs

| Scenario | What is classified | On `staff-ping` | On `scam-content` |
|---|---|---|---|
| 1 (direct @mention) | The question (mention stripped) | Short redirect reply to `#support`, no answer | Not applicable — direct @mentions skip scam filter |
| 2 (@mention as reply) | The original message being answered | Short redirect reply, no answer | Not applicable |
| 3 (no mention) | The raw message content | Skip `scheduleAutoAnswer()` entirely | Skip `scheduleAutoAnswer()` entirely |
| Community reply to pending | The reply content | — | Timer kept alive — scam reply does not cancel the pending answer |

Scenario 0 skips classification — the user's explicit reply to an active CLARIFY/ANSWER conversation is itself the intent signal. Scenario 0.5 (both platforms, since 2026-07-10) classifies the reply text and gates on `RESPOND_INTENTS` before answering — see Answer Flow above.

### `scam-content` vs `safety-alert`

| Category | Sender | What it is | Timer effect |
|---|---|---|---|
| `safety-alert` | Legitimate community member | Warning ABOUT a scam posted for public awareness | N/A |
| `scam-content` | Bad actor | Active phishing disguised as help — external links, fake admin offers, wallet restore apps | Timer kept alive |

Key signal for `scam-content`: the message redirects a user away from the channel and often arrives within seconds of a victim reporting a problem.

### `help-seeking` covers frustrated complaints (updated 2026-05-15)

Extended to include frustrated complaints and venting about conversion rates, waiting periods, staking, and token amounts — even when phrased as opinions rather than questions.

### `help-seeking` also covers "anyone received X?" phrasing (updated 2026-06-01)

Messages like "anyone received their Pizza day reward?" are classified as `help-seeking` — the "anyone" framing is a social softener; the asker typically didn't receive their reward. See `intent/intent-taxonomy.md` for the full edge case note.

### Why `looksLikeQuestion()` was replaced

The old heuristic passed any message with `?` or ≥ 8 words. "You should clear browser cache and try again" (community-help, 8 words) passed it and triggered an auto-answer. Haiku classifies based on what the message *does* (speech act), not surface patterns.

`looksLikeQuestion()` was removed entirely during the dead code cleanup pass (2026-06-01).

---

## Staff Commands

All staff commands are **slash commands** (`/command`). Two manual-attachment helpers (`!add-blog-text`, `!add-doc-text`) remain as text commands because they require a file attachment and have no slash equivalent.

**Sync** — `/sync` is one command with a `type` dropdown (Knowledge / Blog).

| Command | What It Does |
|---|---|
| `/sync type:Knowledge` | Reload core-facts.md, scan announcements, rebuild full RAG index |
| `/sync type:Blog` | Pull new/changed posts from blog sitemap (auto-detects updates via lastmod) |

**Blog management** — `/blog` is one command with an `action` dropdown + required `url`.

| Command | What It Does |
|---|---|
| `/blog action:Add url:<url>` | Scrape single blog post → save to knowledge-base/blogs/ |
| `/blog action:Exclude url:<url>` | Remove post from KB and skip on all future `/sync type:Blog` runs |
| `/blog action:Include url:<url>` | Remove URL from exclusion list; re-scraped on next `/sync type:Blog` |

**Doc management** — `/doc` subcommands.

| Command | What It Does |
|---|---|
| `/doc sync` | Pull new/removed pages from docs sitemap |
| `/doc sync force:true` | Force re-scrape all doc pages regardless of changes |
| `/doc add url:<url>` | Scrape single doc page → save to knowledge-base/docs/ |

**Knowledge corrections**

| Command | What It Does |
|---|---|
| `/add-correction slug:<slug> text:<text>` | Add/update a correction in `knowledge-base/corrections/<slug>.md`. Ranks above docs and blogs in RAG. Also accepts a file attachment. |

**Toggles** — `/toggle` is one command with a `platform` dropdown.

| Command | What It Does |
|---|---|
| `/toggle platform:Discord` | Toggle Discord auto-replies ON/OFF. State persisted across restarts |
| `/toggle platform:Telegram` | Toggle Telegram auto-replies ON/OFF. State persisted across restarts |
| `/toggle platform:Scam Blocker` | Toggle scam-blocker ON/OFF (default OFF). When ON: delete + escalating timeout + alert embed. |
| `/toggle platform:Show current status` | Show current ON/OFF state for all three toggles |

**Scam tracking** — `/scam-record` is one command with an `action` dropdown.

| Command | What It Does |
|---|---|
| `/scam-record action:View user:<user>` | Show all infractions — detection reason, channel, message, timeout applied. Repeat offenders flagged. |
| `/scam-record action:List` | List all users in the scammer record, sorted by infraction count (highest first). |
| `/scam-record action:Clear user:<user>` | Remove all infractions for a user (use for false positives). |
| `/scam-record action:Clear user:<user> count:-N` | Remove the N most recent infractions only. If N ≥ total, clears entirely. |

**Telegram moderation** *(admin DM to bot only — not registered as public commands)*

Escalation ladder (↑ up, ↓ down with the de-escalation counterparts):

| Command | Mode | Behaviour |
|---|---|---|
| `/tgwatch <userId> [reason]` | watch | Stays in group. Harmful msgs auto-deleted. Alert DM sent. |
| `/tgmute <userId> [reason]` | mute | Permanently muted. Re-muted on every rejoin and after captcha/verification bot unlocks. |
| `/tgkick <userId> [reason]` | kick | Removed on every rejoin (can try again). |
| `/tgban <userId> [reason]` | ban | Banned on every rejoin, messages revoked. |
| `/tgunwatch <userId>` | — | Remove from watchlist entirely (clean slate). |
| `/tgunmute <userId>` | → watch | Lift permanent mute, drop to watch mode. |
| `/tgunkick <userId>` | → watch | Drop from kick to watch mode. |
| `/tgunban <userId>` | — | Remove from all lists, unban from group. |
| `/tglist` | — | Show all users with mode, reason, rejoin count. |
| `/tgalerts on\|off` | — | Subscribe/unsubscribe from moderation alert DMs. |

Alert DM format: user identity, detected-as label, full message text (up to 400 chars), action taken, `tg://user?id=<id>` link for Telegram reporting.

Store: `data/tg-perma-ban.json` — keyed by userId string. Fields: `userId`, `username`, `reason`, `mode`, `bannedAt`, `rejoinCount`, `lastRejoin`. Survives restarts.

**Stats & reports**

| Command | What It Does |
|---|---|
| `/usage-stats` | Show Claude API calls, token counts, estimated cost |
| `/member-stats period: [platform:]` | Show member counts + join/leave for a period (week/day) and platform. Defaults to Both. |
| `/report period:week platform: [aimodel:]` | Generate weekly community report → REPORTS_CHANNEL_ID. aimodel defaults to Haiku. |
| `/report period:day platform: [aimodel:]` | Generate daily community report → REPORTS_CHANNEL_ID. aimodel defaults to Haiku. |

**Diagnostics** *(disabled — exists in code, not registered)*

| Command | What It Does |
|---|---|
| `/check-permissions` | Show bot's actual Discord permissions for each configured channel |

**Text commands** *(no slash equivalent — require file attachment)*

| Command | What It Does |
|---|---|
| `!add-blog-text <url>` + attach | Manual blog add for Cloudflare-protected pages. Attach .md/.html/.txt (use MarkDownload extension). |
| `!add-doc-text <url>` + attach | Manual doc add with attachment — same workflow. |
| @bot + Discord message link | Staff only: post explanation embed showing which KB sources drove that answer. |

---

## Sitemaps

| Site | Sitemap URL | Pages | Notes |
|---|---|---|---|
| docs.riverai.inc | https://docs.riverai.inc/sitemap-pages.xml | 45 pages | satoshi-protocol-v1 sitemap excluded |
| blog.riverai.inc | https://blog.riverai.inc/sitemap-posts.xml | 138 posts total, 46 after BLOG_SINCE_DATE | BLOG_SINCE_DATE = 2025-05-15 |

**Domain migration (river.inc → riverai.inc), completed and synced 2026-09-04.** `DOCS_SITEMAP_URL`/`BLOG_SITEMAP_URL` in `src/kb-sync.js` point at the new domain; every `_index.json`/`Source:` reference across the KB was repointed from `river.inc` to `riverai.inc` in the same pass (not left for a rescrape) so the URL-keyed sync matching stays intact — confirmed against the live sitemaps: docs 45/45 exact match (0 added/removed), blog 0 removed. `core-facts.md`, the scam-safety correction, and `outro-official-links.md` deliberately still mention the old `river.inc` domain — that's intentional, so the bot can redirect a user who reports the old site as down.

Because the site's own redeploy also bumped `lastmod` on ~40 already-indexed blog posts (zero content change, confirmed via each post's `article:published_time`/`article:modified_time`), `syncBlog` no longer trusts sitemap `lastmod` alone — see "lastmod verification" below. The actual post-migration `/sync type:Blog` run: 40 updated, 0 added, 0 removed, 1 filtered (held for review, see below), 91 legacy pre-floor posts correctly stayed excluded.

**`<!-- EXCLUDE -->` marker preservation:** a URL-keyed delete-and-recreate (like the domain migration) would normally wipe a hand-added `<!-- EXCLUDE -->` marker, since the fresh scrape has no marker. `syncDocs`/`syncBlog` in `src/kb-sync.js` capture which filenames carry the marker *before* any rewrite and reinsert it on write. Verified intact after the real post-migration sync on all 8 marked files: docs' `intro-publish-your-docs.md`; blogs' `river-follow-up-2.md`, `river-action-follow-up-ch.md`, `river-together-4m-river-pts.md`, `2026-new-year-challenge.md`, `s4-best-creators.md`, `dynamic-airdrop-conversion-2.md`, `dynamic-airdrop-conversion-3.md`. The blog `index.excluded` URL-list (`/exclude-blog`) is currently empty. Governance is manually curated (not code-synced), so it's unaffected by any of this.

**lastmod verification (added 2026-09-04, `syncBlog` in `src/kb-sync.js`):** sitemap `lastmod` can move on a redeploy alone, with zero editorial change — not safe on its own to gate `BLOG_SINCE_DATE` or "did this post change." `fetchPublishMeta()` in `src/blog-scraper.js` reads each post's own `article:published_time`/`article:modified_time`/`og:title` (Ghost's immutable content dates) as a cross-check:
- A candidate that's new-to-the-index but whose true `published_time` is still pre-floor is **not** silently added or silently dropped — it's held out of the KB and reported in the `/sync type:Blog` Discord reply under "Held back for review," with title + date, so a human decides via `/include-blog`. Real example from the migration sync: `blog.riverai.inc/river/` (`published_time` 2025-05-13, two days pre-floor) — flagged, then manually reviewed: it carries the `announcement` tag (a real, live tag page, just not featured in the site's nav) alongside already-indexed posts like `season2-airdrop-is-live` and `season-6-is-live`, so it's legitimate current content, not orphaned. Manually added 2026-09-04 (`knowledge-base/blogs/river.md`) since it fell outside the automated floor — future `/sync type:Blog` runs will maintain it normally (matches by URL) from here on.
- `knowledge-base/blogs/_excluded-legacy.json` — a self-maintaining registry (title + true `published_time`, keyed by URL) of every post ever seen failing the `BLOG_SINCE_DATE` floor. Seeded 2026-09-04 with all 91 currently-known legacy (pre-floor) posts. A URL is only ever fetched once to populate its entry; after that it's a free lookup. Lets a future flagged candidate be checked against known legacy titles ("previously known as X") instead of judged with zero history.
- An already-indexed post whose `lastmod` changed but whose `article:modified_time` matches what's on file is recognized as a redeploy artifact and the rescrape is skipped (falls back to a normal rescrape if inconclusive — no regression for that case).

**`/doc sync` vs `/doc sync force:true`:** Docs sitemap has no lastmod dates so regular sync only catches new/removed pages. Use `force` to re-scrape all on content updates.

**`/sync type:Blog`:** Blog (Ghost) has lastmod on every post so it auto-detects updates — no force flag needed.

**Both `/sync type:Blog` and `/doc sync` have been run (most recently 2026-09-04, post-migration) — 47 blog posts (46 from sync + `river.md` manually added, see above) and 45 docs pages are indexed.**

---

## Network Note

`docs.riverai.inc` and `blog.riverai.inc` are blocked by the user's ISP (Cisco SSE filter). **Cloudflare WARP must be enabled** on the machine for the bot to scrape these sites. Without WARP, all scrape commands will fail with HTTP 403.

---

## Corrections System

### `knowledge-base/corrections/` folder
Files here are indexed like all other KB content but ranked 1.3× higher than docs in RAG search. Corrections are injected into the system prompt's SOURCE PRIORITY rule so Claude deprioritises conflicting doc chunks.

### Workflow
1. Bot gives wrong answer (old mechanism from outdated docs)
2. Staff uses `@bot + message link` → sees which source caused it
3. Staff runs `/add-correction <slug> <correct info>` in Discord, or describes the problem in the Claude Code terminal and lets Claude create/update the correction file
4. RAG rebuilt — correction now outranks the conflicting doc chunk
5. Optionally: staff edits the doc file and wraps the outdated section in `<!-- EXCLUDE -->...<!-- /EXCLUDE -->`, then runs `/sync type:Knowledge`

**Automatic staleness detection:** `/sync type:Blog` and `/sync type:Doc` also flag correction files that a newly synced article may have superseded, and draft a proposed update for review — see [KB Monitor](#kb-monitor). Drafts are never auto-applied to the live correction file.

### `<!-- EXCLUDE -->` markers
Add these HTML comment tags in any `.md` file in the KB to mark a section as permanently outdated. The `rag.js` chunker strips these blocks before indexing — the excluded content is never embedded, never retrieved. Files containing these markers are automatically protected from being overwritten by `/doc sync force:true`.

### Dynamic blog effective date
`blogs/_index.json` tracks three fields:
- `configuredSinceDate` — the original `BLOG_SINCE_DATE` from config (2025-05-15). Never changes.
- `effectiveSinceDate` — the current scraping floor. Only advances when posts are deliberately deleted from disk. Never recalculated automatically on a normal sync (that was a bug that was fixed).
- `sinceHistory` — array logging every advance: `{ changedAt, from, to }`. Shown in `/sync type:Blog` output as "Floor history".

### Blog URL exclusion list
`blogs/_index.json` also tracks an `excluded` array of full post URLs. Managed by `/blog action:Exclude url:<url>` and `/blog action:Include url:<url>`.

**Distinct from `<!-- EXCLUDE -->` markers:**
- `excluded` list → prevents re-scraping entirely; file deleted from disk when `/blog action:Exclude` runs
- `<!-- EXCLUDE -->` markers → file stays on disk, excluded section stripped from RAG only

### Docs has no exclusion mechanism
`docs/_index.json` only tracks `sitemapUrl` and `lastChecked` — no `excluded` URL list, no date floor. To suppress a doc page from RAG, apply `<!-- EXCLUDE -->` markers inside the file instead.

---

## KB Monitor

Two background health checks that run automatically as part of sync commands. Both use Haiku to keep API cost low.

### 1. Correction Staleness Check

**Triggered by:** `/sync type:Blog` and `/sync type:Doc` (after files are written, before reporting results)

**What it does:** For each newly scraped file, Haiku compares the first 1500 chars of the new content against the **full text** of every active correction file. It's instructed to only flag a correction when it can point to a specific existing claim (a figure, date, or fact) that the new article actually contradicts or supersedes, within that correction's own stated scope — topical overlap alone (e.g. both mentioning "River Pts") is explicitly not sufficient. This check is fast (one Haiku call per new file) and is `await`ed directly in the sync command handler.

**Why full content, not a snippet (fixed 2026-07-07):** the original version sent only the first 600 chars of each correction, which often cut off the file's own scope statement — leaving Haiku to flag on topic overlap alone. In practice this produced mostly false positives (e.g. a Binance-airdrop-safety correction and a River4FUN-points correction both got flagged by an unrelated seasonal blog post, purely because both mention "River Pts").

**Discord output:** `⚠️ Correction may need review (drafting proposed updates in the background):` followed by one line per flagged pair, e.g. `• conversion-mechanism.md — related to: season-6-is-live`.

**Data flow:**
- `kb-sync.js` collects `processedFiles: [{ filePath, content }]` from every successful scrape
- `slash-commands.js` passes this array to `monitor.checkCorrectionStaleness(result.processedFiles)`
- Returns `[{ newFile, correctionFile }]` — each entry shown as one warning line

**Draft generation (added 2026-07-07, decoupled from the sync reply 2026-07-07 after it caused a multi-minute hang):** If any corrections were flagged, `slash-commands.js` fires `monitor.draftCorrectionUpdates(stale, result.processedFiles)` **without awaiting it** so the sync reply is never blocked. For each flagged pair, `draftCorrectionUpdate()` sends the **full** correction file plus the **full** new article to Sonnet (`claude-sonnet-4-6`) and asks it, first, whether a change is genuinely needed. If not — the correction's claims are still accurate, or the article is out of its stated scope — the model replies `NO_CHANGE_NEEDED` and no draft file is written at all; this is the second line of defense against false positives that slip past the Haiku flag. Otherwise it produces a complete updated version, changing only what the new article explicitly states and leaving everything else untouched, written to `knowledge-base/corrections/_drafts/<correction-file>.md` (gitignored) with a header noting the source article and timestamp. **Nothing is ever written to the live correction file automatically** — a human must diff the draft against the real file and manually apply/delete it. Once the batch finishes (one sequential Sonnet call per flagged pair — can take a while), a `📝 Correction review results:` follow-up message is posted per entry: a draft path, `reviewed, no change needed`, or `draft generation failed` (API error, or a flagged filename that didn't match a real correction file).

**Why this had to be split in two:** the first version ran drafting inline inside `checkCorrectionStaleness`, awaited by `Promise.all([buildIndex(), checkCorrectionStaleness(...)])` in the sync handler — so the interaction reply waited on every flagged correction's Sonnet call before replying at all, turning a normally-instant `/sync` into a multi-minute hang with zero output in between.

### 2. Announcement Auto-Scan

**Triggered by:** `/sync type:Knowledge` (runs before `buildIndex()` so extracted facts are indexed in the same pass)

**What it does:** Reads all raw weekly announcement files (`announcements/*_ann/week*.md`), filters to entries newer than the last scan timestamp, strips already-indexed blog URLs, then asks Haiku whether the remaining content contains net-new operational facts. If yes, Haiku returns a category and 2–3 sentence summary, auto-appended to the matching curated file.

**Scan state:** `knowledge-base/announcements/_scan-state.json` — stores `lastScanned` ISO timestamp. On first run (file absent), initialises to "now" so existing announcements are not reprocessed.

**Categories and target files:**
| Haiku category | Curated file |
|---|---|
| `EXCHANGE` | `exchanges-and-token.md` |
| `MILESTONE` | `ecosystem-milestones.md` |
| `NOTICE` | `important-notices.md` |

**Noise reduction:** Blog reposts in announcements are stripped before Haiku sees them. If the entire entry was just a blog repost, it is skipped entirely with no Haiku call.

**What Haiku captures (updated 2026-06-03):** Exchange/DEX listings, token changes, product launches, protocol parameter changes, safety notices, integrations, ecosystem stats and milestones (TVL, staking amounts, user counts, season progress), partnership/community milestones, and context that adds to or updates existing blog/docs content. Pure hype, generic community messages, and event reminders with no new data are skipped. Previously the prompt was too narrow (operational facts only) and missed milestone stats like staking totals.

**Discord output (from `/sync type:Knowledge`):** `📌 Auto-extracted N fact(s): <category>: <summary>` lines, or a single line if nothing was found.

**Format appended to curated files:**
```
---
*Auto-extracted from announcement — YYYY-MM-DD*

<2–3 sentence Haiku summary>
```

---

## Backfilling Missed Announcements

The bot saves announcements **in real-time only** via the `messageCreate` handler. If the bot was offline when a post was made, the announcement is never written to disk. `/sync type:Knowledge` cannot recover it.

### How to backfill

**1. Identify the correct weekly file**

| Day range | File |
|---|---|
| 1–7 | `week1.md` |
| 8–14 | `week2.md` |
| 15–21 | `week3.md` |
| 22–31 | `week4.md` |

File path: `knowledge-base/announcements/<Month>_ann/weekN.md`
Example: May 20 → `knowledge-base/announcements/May_ann/week3.md`

If the file doesn't exist yet, create it (bot would have created it on first write that week).

**2. Append in the correct format**

```
---
*2026-05-20T15:10:00.000Z*
<announcement content>
```

Use `T00:00:00.000Z` as the time if the exact time is unknown. The separator must be `\n\n---\n` (blank line before `---`).

**3. Decide whether to update a curated file**

Check `knowledge-base/announcements/_scan-state.json` — if the missed announcement's date is older than `lastScanned`, the scanner will skip it even after `/sync type:Knowledge`.

| Content type | Action |
|---|---|
| Operational facts — exchange listing, integration, parameter change, safety notice | Also add a summary to the relevant curated file (`exchanges-and-token.md`, `ecosystem-milestones.md`, or `important-notices.md`) |
| Community/event content — celebration posts, contest reminders with no new protocol facts | Raw file only — no curated update needed |

**4. Run `/sync type:Knowledge` in Discord** once all missed announcements are added.

### Preventing future gaps

Set up PM2 so the bot stays running and never misses real-time messages:
```
npm install -g pm2
pm2 start bot.js --name river-bot
pm2 save
pm2 startup
```

---

## Key Technical Decisions (Why, Not Just What)

- **`clientReady` not `ready`** — discord.js v14 uses `clientReady`. We deliberately changed this; do NOT revert to `ready`.
- **`node-fetch` dynamic import** — v3 is ESM-only in a CJS project. Always use `const fetch = (await import('node-fetch')).default`.
- **SSL bypass** — `https.Agent({ rejectUnauthorized: false })` used in scraper and docs/blog sync because riverai.inc certs are locally-issued.
- **linkedom → jsdom** — linkedom caused OOM (exit code 9) on large pages. jsdom is stable.
- **RAG replaced full-KB loading** — old approach sent entire KB (~100K+ tokens) to Claude per call. RAG sends top-8 chunks (~2,000–4,000 tokens). Voyage AI voyage-3-lite handles embeddings.
- **BLOG_SINCE_DATE = 2025-05-15** — user only wants posts from this date onward; 92 older posts excluded.
- **URLs must be plain text** — Claude was rendering URLs as `[url](url)`. System prompt explicitly forbids markdown link syntax.
- **Telegram channel mention → deep link** — `sanitizeForTelegram()` in `telegram/telegram-adapter.js` converts any `<#channelId>` Discord mention into `https://discord.com/channels/GUILD_ID/channelId`. `GUILD_ID` is hardcoded as `1212686319596216350` — update it there if the server changes.
- **satoshi-protocol-v1 docs excluded** — user only wants the main River docs sitemap, not the legacy v1 subdomain sitemap.

---

## RAG Design Decisions

### Why Voyage AI (not OpenAI / Ollama / Cohere / DeepSeek / Llama)
- **OpenAI** (`text-embedding-3-small`) — excellent quality, no free tier, pay-as-you-go from day one
- **Ollama (local Llama)** — fully free, no API key, but weakest semantic quality (small model ~22M params)
- **Cohere** — good quality, only 1000 calls/month free (too limited)
- **DeepSeek** — chat/reasoning model, no dedicated embedding API
- **Voyage AI** — chosen because: Anthropic specifically recommends it for use with Claude, **200M free tokens/month** on the voyage-3 series (effectively free for a Discord bot), and highest retrieval quality when paired with Claude

### Why `voyage-3-lite` specifically
Cheapest model in the voyage-3 series. Still high quality for retrieval. The 200M free token allowance applies to it. `voyage-3` or `voyage-large-2` would be marginally better but overkill for support Q&A.

### Why Voyage AI requires a payment method
Free accounts without a payment method are capped at **3 RPM and 10K TPM** (rate limits, not billing). Adding a card unlocks standard rate limits (~2000 RPM). **The 200M free tokens still fully apply** — you are not charged unless you exceed them. The card is purely for identity verification / abuse prevention.

### Why `embedder.js` is a separate file from `rag.js`
Separation of concerns: `rag.js` handles chunking, caching, and search logic. `embedder.js` is the provider adapter. Switching from Voyage to OpenAI means adding one function in `embedder.js` and changing `EMBEDDING_PROVIDER` in `.env` — `rag.js` is untouched.

### Why chunk overlap (150 chars)
Without overlap, a sentence or key fact that falls at a chunk boundary gets split across two chunks, and neither chunk contains the full context. 150-char overlap ensures the tail of one chunk and the head of the next share context.

### Why TOP_K=8
Started at 5, raised to 8 by user after testing. More chunks = more context for Claude to draw from. At ~1500 chars/chunk × 8 = ~12K chars of context, still far cheaper than the old full-KB approach (~100K+ chars).

### Why `getSystemPrompt()` is a function, not a `const`
`coreFacts` is loaded from disk at startup and can be reloaded at runtime via `/sync type:Knowledge`. A `const` would capture the empty string at module load time and never update. The function reads `coreFacts` at call time, so reloading the file takes effect immediately on the next Claude call.

---

## Core Facts Design

### What `core-facts.md` is for
Facts that must be true in **every single Claude response**, regardless of what the RAG search returns. Examples: "River had a testnet but is now on mainnet", "RIVER token is live on DEX and CEX", "TGE date is September 22, 2025".

**Do NOT put dynamic stats in `core-facts.md`** — staking amounts, TVL, user counts, and similar figures change constantly and will go stale. These belong in `ecosystem-milestones.md` as dated snapshots. `core-facts.md` carries a general instruction telling Claude to always qualify such numbers with the announcement date and note the current figure may be higher, directing users to the app for live stats.

### How it works
- `loadCoreFacts()` reads the file into the `coreFacts` variable at startup (and on `/sync type:Knowledge`)
- `getSystemPrompt()` injects `coreFacts` directly into Claude's system prompt
- This means core facts are present in **every API call**, bypassing RAG entirely
- `core-facts.md` is also indexed in the RAG vector cache (so it surfaces as a retrieved chunk when relevant), but its primary effect is via the system prompt — it cannot be "missed" by a low similarity score

### The original problem that created this
A user asked: *"Can anyone give me a link to its test net?"*
The bot replied with two problems:
1. It included a completely unrelated voting announcement from the KB (loose relevance matching)
2. It had no way to know River's testnet is no longer active — that fact wasn't in the KB

**Fixes applied:**
1. Added `RELEVANCE RULE` to the system prompt: only include content that **directly** answers the question
2. Added `ANSWER / CLARIFY / ESCALATE` structured response tags so Claude declares intent before replying
3. Added `core-facts.md` with the testnet status and token live fact so Claude always knows it
4. Built the full RAG system so context is fetched semantically, not dumped wholesale

**Note:** The original core-facts stated "there is NO testnet and there never has been one" — this was incorrect. River did have a testnet; it no longer exists. This was corrected in a later session.

---

## Multi-Turn Conversation Design

### The problem
The old bot was stateless — each message got one response with no memory of prior exchanges. This meant:
- Claude couldn't ask a clarifying question and wait for the answer
- Users who got a wrong/incomplete answer had no way to continue the conversation in context

### How it works now
**State maps:**
- `conversationState`: `userId::channelId → { history, botMsgId, channelId, lastActivity, isAnswered }`
- `botMsgIndex`: `botMsgId → userId::channelId` — reverse lookup so when a reply arrives, we find the conversation in O(1)
- `pendingQuestions`: `userId::channelId → { messages: [{id, content, ts}], userId, channelId, timer, lastMessage, storedAt }` — Scenario 3 batch + timer awaiting staff reply; pruned hourly if storedAt is older than STAFF_WAIT_MS + 10 min. Messages from the same user arriving while a batch is pending are folded into `messages[]` (see "Burst batching" above) rather than creating a new entry.
- `pendingMsgIndex`: `messageId → userId::channelId` — reverse lookup into `pendingQuestions` so a reply to any individual batched message resolves to the right batch

**Flow:**
1. Claude responds with `CLARIFY:` → bot saves conversation history + the bot message ID to `conversationState`
2. User replies to that specific bot message → Scenario 0 detects it via `botMsgIndex`, appends user reply to history, calls Claude again with full history
3. Claude responds with `ANSWER:` → conversation state is **kept** (`isAnswered: true`) so a reply within `CONV_EXPIRY_MS` (30 min) — via Scenario 0 or a fresh Scenario 3 message — resumes with prior history instead of starting cold. Claude responds with `ESCALATE:` → conversation state is cleared, exchange counted.

**Design choices:**
- **Only the original asker can continue** — `convKey` encodes `userId`, so a different user replying to the bot's message starts a fresh conversation rather than hijacking the existing one
- **30-minute expiry** (`CONV_EXPIRY_MS`) — stale conversations are pruned hourly so the maps don't grow unbounded
- **CLARIFY does not increment the answer counter** — only complete exchanges (ANSWER or ESCALATE) count toward `MAX_BOT_ANSWERS_BEFORE_TICKET` (2). Asking a clarifying question is free.

### Why ANSWER / CLARIFY / ESCALATE tags
Previously the bot had to guess Claude's intent (check for "?", regex for ticket links, etc.) — fragile and unreliable. Structured tags make intent explicit and machine-parseable. Claude is instructed to always start with one of the three tags, and `askClaude()` parses it to decide whether to save conversation state or clear it.

---

## RAG Source Attribution

When the bot answers a question, `searchKB()` returns `{ context, sources, rawChunks }` — an object, not a plain string. The `sources` array (unique filenames that contributed to the answer) is stored in `ragSourcesMap`:

```
ragSourcesMap: Map<botMsgId → { sources: string[], storedAt: number }>
```

TTL: 30 minutes. Pruned hourly alongside conversation state.

When a staff member uses the explanation embed trigger (@bot + message link), `sendExplanationEmbed()` reads `ragSourcesMap` first for accurate source attribution. Falls back to `identifyRelevantSources()` (keyword matcher) only if the entry has expired.

`searchKB()` signature: `async function searchKB(query, topK = TOP_K) → { context: string, sources: string[], rawChunks: Chunk[] }`

### Chunk Re-ranking (inside `buildInitialHistory`)

After `searchKB()` retrieves the top-K chunks by cosine similarity, `buildInitialHistory()` in `claude.js` passes them through a **Haiku re-ranker** before building the Claude prompt:

1. Each chunk is scored 1–5 for relevance to the question (Haiku call, max_tokens: 40)
2. Chunks scoring below 3 are dropped. At least 3 chunks are always kept (`MIN_KEEP = 3`)
3. Passing chunks are re-sorted by Haiku score (highest first)
4. The final context and source list are built from this filtered set — not from the raw top-K

**Effect:** Low-relevance chunks that happen to have similar embeddings are filtered out before Claude sees them. This improves answer precision at the cost of one Haiku call per user question (~0.1–0.3 cent range). If the Haiku call fails, the original top-K chunks are used as fallback.

---

## Referral Code Rotation

Two referral codes are hardcoded in `state.js`:

```js
const REFERRAL_CODES = ['JosephineOral', 'MrPishh'];
const referralCode = { idx: 0 };  // wrapped in object so mutations propagate across modules
```

`referralCode.idx` increments on every `askClaude()` call (inside `claude.js`). The current code is injected into the system prompt:

```
ASSIGNED REFERRAL CODE: If this conversation requires giving a user a registration referral code, use exactly: <current code>
```

**Bot behaviour for referral questions:**
- If user asks how to get their own referral code → direct them to their profile page (X username only, no mention of bonuses)
- If user needs a code to register → give the ASSIGNED code from the system prompt
- Never mention that referral bonuses are not being delivered; if asked about referral benefits, say points are added to leaderboard

---

## System Prompt Features (getSystemPrompt)

Key rules injected into every Claude call:
- **CONVERSION** — Always default to Conversion 3.0 unless user specifically asks about 1.0 or 2.0. If version unclear, ask which they mean.
- **PARTIAL KNOWLEDGE** — If only part of a question can be answered, answer that part then add one short line directing to support for the rest.
- **TONE** — Acknowledge frustration briefly before answering; highlight genuine positives (longer staking = more tokens + voting power); never dismissive.
- **URL formatting** — Always wrap in angle brackets `<https://...>`. Never markdown `[text](url)`.
- **No `---` dividers** — Bold headers are fine; horizontal rules are not.
- **ASSIGNED REFERRAL CODE** — Dynamic block, injected per-call outside the cached portion (see Prompt Caching below).
- **SOURCE PRIORITY** — corrections > blogs/announcements > docs.
- **SCAM SAFETY** — Dynamic injection (2026-05-15): injected only when `isScamConcern(question)` returns true. See Scam Concern Detection below.
- **CONVERSATIONAL BREVITY** — Dynamic injection (added 2026-07-10): `getSystemPrompt(includeScamBlock, isFollowUp)` takes a second param; `askClaude()` sets `isFollowUp = history.length > 1` (true for Scenario 0/0.5/CLARIFY-continuation calls, false on a fresh first question). When true, injects a rule capping replies to 2-4 sentences, forbidding re-explanation of a mechanism already covered earlier in the thread (point back to it instead), and calling for a short acknowledgement rather than a full mechanic restatement when the user is just agreeing/venting. Added because conversational replies (e.g. a user agreeing with someone, then venting about price) were getting full multi-paragraph re-explanations of conversion mechanics on every turn.

### Prompt Caching (added 2026-05-15)

`askClaude()` passes `system` as a two-element array:
1. **Static block** — `getSystemPrompt(includeScamBlock)` output, marked `cache_control: { type: 'ephemeral' }`. Cached by Anthropic for 5 minutes. Stable across most calls.
2. **Dynamic block** — referral code (rotates each call) + SOURCES instruction. Never cached.

Cache hits are logged: `[Cache] Hit — N tokens served from cache`. Minimum threshold for caching is 1024 tokens (Sonnet); the static block exceeds this when `core-facts.md` is loaded.

### Scam Detection — All Layers (updated 2026-06-13)

Scam detection runs across five independent layers. The first three classify the **scammer's own message**; the last two guard the **victim's message** to inject a safety block into the bot's answer.

**Active blocking (Layers 1–3):** When the scam-blocker toggle is ON, a detected scam message triggers: (1) message deletion, (2) 1-hour timeout on the member, (3) infraction recorded in `data/scammer-list.json` via `scam-tracker.js`, (4) alert embed to `SCAM_LOG_CHANNEL_ID`. All actions fail gracefully — if the bot lacks permissions, the others still run and the alert is still posted. Toggle is OFF by default; enable with `/toggle platform:scam-blocker`. **Required bot permissions: `Manage Messages` + `Moderate Members`; bot role must sit above regular member roles.**

**Infraction tracking:** Every action writes a record keyed by Discord user ID (survives username/display name changes). The alert embed shows the total infraction count and flags repeat offenders in red. Use `/scam-record view <user>` to see full history, `/scam-record clear <user>` for false positives, `/scam-record remove-infraction` to remove a single record.

Scope: targets what Discord's built-in automod misses — bio/profile redirect text, t.me/wa.me links, name impersonation + DM offers, and semantic social-engineering patterns Haiku catches. Direct link blocking is left to Discord automod.

#### Layer 1 — Scammer-side hard sync (`detectScamContentSync` in `src/intent.js`)
Runs as the first line of `classifyMessageIntent`. Catches patterns that are unambiguous regardless of context — zero API cost. Returns `'scam-content'` and skips all further checks.

Patterns (6):
- `visit/click/open/go to my bio/profile/page/dashboard` — unambiguous redirect verbs only; `check/see/look at` are excluded because "can you check my profile?" is a legitimate help-seeking message
- `link in (my) bio`
- `in my bio/profile`
- `t.me/<handle>` — Telegram invite links (full link format; `@username` mentions are normal)
- `wa.me/<number>` — WhatsApp invite links
- `(report/contact/reach) the (team/support/us)` + external URL

**Content normalization (added 2026-06-10):** Before patterns are tested, `normalizeScamContent()` is applied to the raw message text: (1) collapses spaced-out letters (`t e a m` → `team`, `d m` → `dm`), then (2) applies leet substitution (`1→i`, `3→e`, `4→a`, `5→s`, `6→g`, `7→t`, `@→a`). This catches obfuscation like `gu1de` and `t e a m` that plain regex would miss. The normalized string is used only for matching — never logged or displayed.

#### Layer 2 — Scammer-side soft sync + Haiku (`hasSoftScamSignal` + `detectScamContentLLM` in `src/intent.js`)
Handles patterns that are suspicious but context-dependent — the same words appear in both scam messages and legitimate help-seeking. Regex (`SCAM_SOFT_PATTERNS`) narrows the field; a focused Haiku YES/NO call reasons over the full conversation context to make the final call.

**Why regex alone fails here:** "check my dashboard" is a scammer redirecting a victim to an external site, but also a user asking for help with their own River account. "dm me" is a scam offer to a stranger, but also two people naturally moving a conversation to private. The word is identical in both cases — only context resolves the direction.

Soft patterns (3):
- `dm/pm me/you/us` — innocent between friends mid-conversation; scam when offered unsolicited to a help-seeker
- `inbox me/you/us` — same
- `check/see/look at my bio/profile/page/dashboard/link/feed/channel/group/site` — ambiguous: help-seeker asking for help with own account vs scammer directing victim to external resource

**`detectScamContentLLM` flow:** Receives the message content + reply context + recent thread (same context built for normal classification). Asks Haiku: *"Is this sender redirecting another user toward an external resource they own, or inviting them into a private conversation as a way of offering unsolicited help?"* YES → `'scam-content'`; NO → falls through to normal classification. Fails safe: returns `false` on API error (never false-positives due to a network issue). Haiku max_tokens: 5.

**Real example caught by this layer (2026-06-11):** "Check my dashboard and relay this" — Layer 1 missed it (`check` is an ambiguous verb), Haiku correctly identified it as a non-staff sender directing a help-seeker to an external resource. Previously misclassified as `troubleshooting` by normal intent classification.

#### Layer 3 — Display name spoof detector (in `src/commands.js`)
Checks non-staff messages for the impersonation pattern: scammer copies a staff display name with slight variation, then offers unsolicited help + DM redirect. Logs `scam-content` to intent log and calls `takeScamAction` (delete + timeout + alert when scam-blocker is ON). Early-returns after a hit — spoof messages never reach intent classification or auto-answer. Active blocking/deletion is deferred to the scam-blocker feature.

Flow:
1. Skip if sender has a staff role
2. Skip if `staffNameCache` is empty (startup race)
3. Normalise sender display name: lowercase → leet substitution (`0→o 1→i 3→e 4→a 5→s 6→g 7→t @→a`) → strip padding words (`official real support admin mod helper team river`) → strip non-alpha
4. Compare against every entry in `staffNameCache`: exact match, sender contains staff name as substring, or Levenshtein distance ≤ 1
5. If name matches AND message contains a DM/helper-offer phrase → log `scam-content`

**Staff name cache** (`state.staffNameCache`) — `Map<normalizedName → originalDisplayName>`. Built at startup in `buildStaffNameCache()` in `bot.js`, refreshed every 24 hrs via cron. Only stores names ≥ 4 chars after normalisation to avoid short-name false positives.

Key functions (all in `src/utils.js`): `normalizeDisplayName`, `looksLikeSpoofedName`, `looksLikeHelperOffer`.

`looksLikeHelperOffer` was extended 2026-06-10 to also match: `inbox me/us`, `check your inbox`, `check requests`, `sent you a request`.

#### Layer 4 — Victim-side tier-1 sync (`detectScamConcernSync` in `src/claude.js`)
Synchronous regex screen on the **victim's question**. Matches: "is this a scam", "seed phrase", "private key", "someone claiming they're admin", "help outside the server", plus patterns added 2026-06-06 and 2026-06-10:
- `told/asking/asked/telling me to DM/inbox/message/contact them`
- `someone/a user/an account offering/offered/saying they can help`

No API cost, ~0ms.

#### Layer 5 — Victim-side tier-2 LLM (`detectScamConcernLLM` in `src/claude.js`)
Haiku fallback (max_tokens: 5, YES/NO). Only called when tier-1 misses but `SCAM_SOFT_SIGNALS` words are present. Fails safe: returns `true` on API error.

`isScamConcern(question)` orchestrates layers 4–5. Called inside `answerQuestion()` concurrently with `buildInitialHistory()` (no added latency on the normal path). When it returns true, `SCAM_CONCERN_BLOCK` is injected into the system prompt. False positives are acceptable; false negatives are not.

---

## Known Issues / Gotchas

- **`saveQAPair` missing `ensureDir`** — ~~Fixed~~. `ensureDir(path.dirname(filepath))` is called inside `saveQAPair()` in `utils.js`. `channel-learning/` subdirs are now auto-created on first write.

- **`identifyRelevantSources()` is the old keyword matcher** — lives in `claude.js`, still called by `sendExplanationEmbed()` in `commands.js` for the staff explanation embed. Reads all source files via `getSourceFiles()` and does word-frequency matching. Not used for actual Q&A (RAG handles that). Fine as-is.

- **`_dev-notes/` folder in root** — user's private reference folder. Contains: `Bot commands.txt` (staff command quick-reference, kept up to date), `readme.txt` (original build prompt), `prompt.txt`, `Work flow structure.txt`, `Notes.txt` (theory notes). Not used by the bot. Safe to ignore.

- **PM2 is set up** — bot runs as `river-bot` under PM2. Use `pm2 restart river-bot`, `pm2 logs river-bot`, `pm2 status`. A Windows Task Scheduler task (`PM2 Resurrect on Login`) auto-runs `pm2 resurrect` on login after a reboot. Note: `pm2 startup` does not work on Windows (no init system support).

- **Telegram's "General" topic never sets `message_thread_id`** — ~~Fixed 2026-07-06~~. Telegram omits `message_thread_id` on messages sent in a forum's General topic (its real ID is always `1`, but the field is absent on the wire). `telegram-adapter.js` now normalizes a missing `message_thread_id` to `1` for topic-matching/logging/`channelId`, but keeps the raw (possibly `null`) value when replying — sending without `message_thread_id` already routes to General correctly, so forcing `1` on outgoing replies was avoided. If General-topic messages ever stop being detected again, check this normalization first before assuming `TELEGRAM_TOPIC_IDS` is misconfigured.

- **Report generation model plumbing** — ~~Fixed 2026-08-18~~. Two separate bugs: (1) Telegram's DM report panel passed the literal string `'haiku'`/`'sonnet'` as the `model` param straight to the Anthropic API (404 `model: haiku`) — every Telegram report generation failed. (2) Discord's `/report` slash command's live wrapper in `bot.js` only accepted `(client, platform, reportType)`, silently dropping the `aimodel` argument — selecting "Sonnet" always silently used Haiku instead, no error. Both now map the choice to the real model ID before calling `buildCommunityReport`/`generateCommunityReport`.

- **Scenario 2 scam-check misattribution** — ~~Fixed 2026-08-18~~. When the mentioning user added their own clarifying text (`ownQuestion`), that text was classified for scam-content/staff-ping under the *original asker's* identity and message context — a scam-content hit would delete and time out the innocent original asker for words the mentioning user typed. Also meant real scam content in the original post could go undetected if clarifying text replaced it entirely as the classification input. Classification now always checks `originalMessage.content`; `ownQuestion` (when present) is only used to compose the answer, never the moderation check.

- **Prompt cache lost cross-conversation reuse** — ~~Fixed 2026-08-18~~. `askClaude()`'s `system` param had been changed to a bare string (no `cache_control`), losing the static-block cache breakpoint documented in Prompt Caching below — only the last-message breakpoint remained, which only helps repeat turns within the same conversation, not the many independent first questions from different users that used to share the cached system block. Fix restored the system-block breakpoint alongside the last-message one (Anthropic supports up to 4 breakpoints per request, so both coexist) — verified live: a repeat call read back 3003 of 3013 cached tokens.

- **`check-permissions` silently registered** — ~~Fixed 2026-08-18~~. The `check-permissions` command entry had been added directly into the `COMMANDS` array (which `registerSlashCommands` sends to Discord unconditionally), making it publicly visible/invokable despite this file's own header comment saying "disabled — not registered." Removed from `COMMANDS`; the handler is left in place for whenever it's intentionally re-enabled.

- **`getLivePrices()` Promise.all fail-together** — ~~Fixed 2026-08-18~~. RIVERPTS and RIVER were fetched with `Promise.all`, so a timeout on either token discarded the other's already-successful price for that round. Switched to `Promise.allSettled`; a failed side now falls back to the last known price for that token instead of blanking both.

- **`pendingMsgIndex` leak in `pruneStaleEntries()`** — ~~Fixed 2026-08-18~~. Found while updating this doc for the burst-batching change: the hourly stale-`pendingQuestions` sweep in `claude.js` deleted the batch entry but never cleaned up the corresponding `pendingMsgIndex` entries for that batch's messages, leaking one orphaned index entry per message on every batch that hits the safety-net prune path (rare — normal cancel/fire paths already clean up both maps correctly). Now clears the batch's message IDs from `pendingMsgIndex` too.

- **Discord `scheduleAutoAnswer` checked staffEngaged after the batch merge** — ~~Fixed 2026-08-18~~. Found by code review of the burst-batching change: the new "fold into an existing batch" branch ran before the `staffEngaged` hard-block check, so once a batch existed for a user, further messages from them silently bypassed the check — staff engaging via a path that doesn't touch the current batch (e.g. replying to an older, non-pending message) wouldn't stop it from still auto-answering. Telegram's equivalent code already checked staffTs first; Discord's order was swapped to match. Verified: a message arriving after `staffEngaged` is set is now skipped, not merged.

- **Telegram `lastMessage` retained the full Telegraf `ctx`** — ~~Fixed 2026-08-18~~. The burst-batching change stored the entire incoming `ctx` (full Update payload) per batched message, kept alive in `pendingQuestions` for up to `STAFF_WAIT_MS`, when only the shared `bot.telegram` client was ever needed to reply later. Now stores just `{ chatId, threadId, messageId }` and uses the already-in-scope `bot` (not per-message `ctx`) to build the reply target.

- **Scenario 0.5 didn't check for scam-content** — ~~Fixed 2026-08-18~~. Unlike Scenario 1/2/3 (Discord), Scenario 0.5's intent gate only special-cased `staff-ping` before falling through to a generic "not in RESPOND_INTENTS → skip" branch — a `scam-content` classification (e.g. a scammer replying to the bot's earlier legitimate answer with a phishing/DM-redirect) was silently skipped instead of triggering `takeScamAction`. Now checked explicitly, same as the other scenarios. (Telegram's Scenario 0.5/1/3 have the same underlying gap — Telegram has no `takeScamAction` equivalent for first-time offenders at all, only reactive moderation for already-`watchedUsers`-flagged accounts via Layer 1/2 sync detection; not fixed as part of this pass, flagged for a separate decision since it's a larger architectural gap, not a one-line fix.)

- **Telegram watched-user check sat after early-return scenarios** — ~~Fixed 2026-08-18~~. `watchedUsers.has(fromId)` (which routes to `handleWatchedMessage()` — auto-delete + admin DM for previously-flagged users) was checked inside the Scenario 3 block, after Scenario 0/0.5/1, all of which can `return` before reaching it. A watched user replying to the bot or @mentioning it entirely skipped watchlist moderation. Moved to run immediately after admin-status is known, before any scenario routing.

- **Scam-escalation infraction count had a TOCTOU race** — ~~Fixed 2026-08-18~~. `takeScamAction()` read the user's existing infraction count via a separate `getRecord()` call, then did two `await`s (`message.delete()`, `member.timeout()`) before writing the new infraction via `recordInfraction()`. Two near-simultaneous scam messages from the same user (e.g. posted in different channels within milliseconds) could both read the same starting count and apply the same escalation level instead of the second one stepping up. Fixed by calling `recordInfraction()` first — it's a synchronous read-modify-write with no `await` in between, so calling it before any async work makes the count atomic across concurrent calls. The human-readable `actions` summary (needs delete/timeout results, not known yet at record time) is patched in afterward via the new `updateInfractionActions(userId, infractionCount, actionsStr)`, indexed by the count each call owns rather than "whichever infraction is currently last" — an initial version of the patch-in-afterward approach had that exact bug, caught by a concurrency test before shipping. Verified with a concurrency test: two simultaneous scam messages now correctly escalate 1h → 2h with correct per-infraction action text, not both landing at 1h.

- **Telegram community reports showed literal `**asterisks**` instead of bold** — ~~Fixed 2026-08-18~~. Report text always comes out of Claude in Discord-style `**bold**` markdown, regardless of which platform requested it (including a report cached from a Discord-triggered generation, then served on Telegram). The Telegram report-send path called raw `ctx.reply(chunk)` directly, bypassing `sanitizeForTelegram()` entirely — so the `**` markers went out unrendered. Fixed by routing the report through `sanitizeForTelegram()` (now converts `**bold**` to real Telegram `<b>` tags instead of stripping it, since the old strip-to-plain-text behavior existed only because no send call set a `parse_mode`) and adding `{ parse_mode: 'HTML' }` to both the report send and `makeTgTarget`'s reply. See `telegram/README.md` § Message sanitisation for the full before/after. Verified against real cached report text.

---

## RAG Index State

- **Current index:** stale — run `/sync type:Knowledge` to get accurate count after recent KB additions
- **Cache location:** `knowledge-base/.embeddings-cache.json`
- **Restart behaviour:** instant — `buildIndex()` on startup only calls Voyage AI for new/changed chunks. If nothing changed, 0 API calls are made.
- **What's indexed:** `core-facts.md`, 45 docs pages, 47 blog posts (May 2025 onwards), governance folder (17 curated files), corrections (11 files), curated announcements (3 files), channel-learning Q&A logs
- **Excluded from index:** `*_ann/` and `*_tweet/` monthly subfolders — excluded at **directory level** in `collectMdFiles` (not via EXCLUDE markers). Outdated blog sections excluded via `<!-- EXCLUDE -->` markers. The two mechanisms are distinct: directory-skip prevents the folder from ever being walked; EXCLUDE markers strip sections from files that are otherwise indexed.

---

## Pending / Discussed But Not Done

- **~~API-level prompt caching~~** — implemented 2026-05-15. See System Prompt Features above.
- **~~Module split~~** — completed 2026-05-16. Monolithic `bot.js` (~1713 lines) split into `state.js`, `utils.js`, `intent.js`, `kb-sync.js`, `claude.js`, `commands.js`, thin `bot.js`.
- **~~src/ reorganisation~~** — completed 2026-06-01. All 13 modules moved from root into `src/`. Each `src/` file uses `const ROOT_DIR = path.join(__dirname, '..')` for paths pointing back to root-level folders.
- **~~PM2 setup~~** — complete. Bot runs under PM2 (`river-bot`). Windows Task Scheduler handles auto-resurrect on login.
- **~~Weekly report cache~~** — implemented 2026-06-03. `report-cache.json` keyed by `platform::model::fromDate::toDate`. Haiku and Sonnet cached separately. 14-day TTL. Extended to daily reports 2026-08-18 (previously weekly-only); `force: true` bypasses the cache on either.
- **Support ticket + collab logging** — fully implemented. Non-staff messages from `SUPPORT_TICKET_CATEGORY_IDS` logged to `intent/ticket-log.jsonl`, `COLLAB_CATEGORY_IDS` logged to `intent/collab-log.jsonl`. Classification is write-time dumb (file = category); full thread classification happens at report time when the whole conversation is available. Tickets included in community reports as "Discord — Support Tickets" section. **Business Proposals section** deferred — when added, classify collab threads concurrently at report time using `Promise.all` (one Haiku call per thread). See `readCollabMessages` in `community-report.js` for the hook comment.
- **~~Chinese channel logging (Discord)~~** — implemented 2026-06-06. Messages from `CHINESE_DISCORD_CHANNEL_ID` are logged to `dc-intent-log.jsonl` then the handler returns early — no live classification, no bot response. Historical backfill from 2026-06-01 (129 messages) completed via `intent/backfill-chinese.js`. Batch intent classification deferred.
- **~~Telegram DM persistent menu button~~** — implemented 2026-06-06. `setChatMenuButton` + `setMyCommands` called at bot startup in `telegram/telegram-adapter.js`. `/start` in a private DM opens the staff panel inline keyboard (Report / Stats). The "≡ Menu" button is persistent across sessions — user does not need to type `/start` each time.

### ⏰ Time-based reminders — do these after 2–4 weeks of live traffic

- **Batch intent log analysis** — **started 2026-08-18** (`msgbatch_01PzBGupfcCBv6nBYyawno9f`, 2,050 joined classified messages from `intent/dc-intent-log.jsonl` + `intent/tg-intent-log.jsonl`). Goal: identify misclassification patterns at scale. Use `intent/theory-notes.md` to pick the right framework for each failure type before changing the taxonomy.
  - How: joined every classified message with its raw record, sent each through the Anthropic Batch API (50% cost vs real-time) to **Sonnet** — not Haiku as originally written here; reviewing Haiku's classifications with Haiku again risks correlated blind spots, so an independent, more capable reviewer was used for this one-time accuracy audit — asking "was this classification correct?" against the full taxonomy, review the disagreement rate per category.
  - If misclassification rate > 10% for a category, update `intent/intent-taxonomy.md` and re-classify going forward.

- **Intent classification refinement** — review intent logs for misclassifications after batch analysis above. Consult `intent/theory-notes.md` for which theoretical framework applies to the observed failure pattern before making changes.

### 💡 Improvements discussed but deferred

- **Structured output migration** — `askClaude()` currently parses ANSWER/CLARIFY/ESCALATE tags from free text. Could be migrated to Claude tool use (typed JSON response) for more robust parsing. Low priority — current approach is stable.

- **Supabase / pgvector** — if `knowledge-base/.embeddings-cache.json` grows large (slow startup, memory pressure), migrate the embedding cache to Supabase with pgvector. Current flat-file cache is fine up to ~5,000 chunks. Flag: check file size periodically with `/sync type:Knowledge` output (total chunks).

- **~~Scam moderation~~** — implemented 2026-06-09. All three detection signals (tier-1 regex, spoof detector, Haiku `scam-content`) now call `takeScamAction`: delete message + 1h timeout + alert embed to `SCAM_LOG_CHANNEL_ID`. Toggle: `/toggle platform:scam-blocker` (default OFF). Required Discord permissions: `Manage Messages` + `Moderate Members`. Bot role must be above member roles in server hierarchy.

- **~~Discord vs Telegram parity gaps~~** — resolved 2026-06-01 (core features) and 2026-06-09 (two additional gaps). Self-resolution detection, community step-in cancellation (with scam-content timer protection), community-discussion follow-up detection, and `staff-ping` redirect are now implemented in both platforms. Additional fixes (2026-06-09): removed extra `RESPOND_INTENTS` gate from Telegram Scenario 1 (direct @mentions now always answered, same as Discord); added word-count guard (`> 1 word`) to Telegram Scenario 0.5 (single emoji/word replies no longer trigger full KB search).

- **~~Scenario 0.5 unguarded reply bug~~** — resolved 2026-07-10, both platforms. Scenario 0.5 now gates on `classifyMessageIntent()`/`RESPOND_INTENTS` before answering a reply (fixes bot responding to replies that were agreement/venting/addressed-to-someone-else rather than an actual question — reply *structure* alone used to be treated as intent). Telegram fixed first (`telegram-adapter.js`), then Discord (`commands.js` ~line 545) patched to match for parity.

---

## Timer Reference

All timers are defined in `src/state.js`. To change any value, edit `src/state.js` (and `.env` for `STAFF_WAIT_MINUTES`).

| Constant | Value | Where used | Purpose |
|---|---|---|---|
| `STAFF_WAIT_MS` | 5 min (from `.env` `STAFF_WAIT_MINUTES`) | `commands.js`, `telegram-adapter.js` | How long bot waits before auto-answering any user when no staff has replied |
| `STAFF_ENGAGED_WINDOW_MS` | 3 min | `commands.js`, `telegram-adapter.js` | Hard block — bot backs off completely for 3 min after staff engages a specific user, whether by replying directly to them or by posting any plain message while their Scenario 3 timer is pending |
| `POST_STAFF_WAIT_MS` | 3 min | `commands.js`, `telegram-adapter.js` | Shorter wait for same user after staffEngaged expires — applies for 20 min after staff engagement |
| `POST_STAFF_CONTEXT_MS` | 20 min | `commands.js`, `telegram-adapter.js` | How long POST_STAFF_WAIT applies — after 20 min, user's wait resets to normal 5 min |
| `CONV_EXPIRY_MS` | 30 min | `claude.js` pruner | How long a multi-turn conversation is kept alive before being discarded |
| `REPHRASE_WINDOW_MS` | 2 hours | `claude.js` | Window in which bot counts answer exchanges before escalating to support ticket |
| `COMMUNITY_DISC_WINDOW_MS` | 30 min | `commands.js` | How long a community-discussion message is stored for follow-up context detection |

**How the timers stack for the same user after staff engagement:**
1. Staff replies at 12:05 → `staffEngaged` set
2. User posts at 12:07 → hard blocked (within 3 min STAFF_ENGAGED_WINDOW_MS) → no timer started
3. User posts at 12:09 → window expired → 3 min wait starts (POST_STAFF_WAIT_MS) → staffEngaged entry cleared
4. User posts at 12:20 (next question) → no staffEngaged entry → normal 5 min wait resumes

**Different user in same channel is never affected** — all timers are keyed by `userId::channelId`.

---

## .env Variables

```
DISCORD_TOKEN
ANTHROPIC_API_KEY
VOYAGE_API_KEY                  ← Voyage AI for embeddings
EMBEDDING_PROVIDER=voyage
ANNOUNCEMENTS_CHANNEL_ID=1213030463040655410
TWEETS_CHANNEL_ID=1212717389104414750
GENERAL_CHANNEL_ID=1212717429319540790
SUPPORT_CHANNEL_ID=1212717485862944818
BOT_ANSWER_CHANNEL_IDS=1212717429319540790,1212717485862944818,1502041137119105054
STAFF_EXPLANATION_CHANNEL_ID=1502041137119105054
REPORTS_CHANNEL_ID=1502056590004715530   ← dedicated weekly-report channel
STAFF_ROLE_IDS=1212718739808845835
STAFF_WAIT_MINUTES=5
SUPPORT_TICKET_CATEGORY_IDS=1212753951578005644,1419608088297865286  ← support ticket category IDs; channels are dynamic (created per ticket). Bot logs only, never responds
COLLAB_CATEGORY_IDS=                                          ← collab/business inquiry category IDs (optional). Logs to collab-log.jsonl. Not included in reports yet.
TELEGRAM_BOT_TOKEN                       ← from BotFather
TELEGRAM_CHAT_ID=-1002060657220          ← Telegram group ID
TELEGRAM_TOPIC_IDS=1,62,229775           ← comma-separated topic thread IDs bot responds in (1=General, 62=Support, 229775=River)
CHINESE_DISCORD_CHANNEL_ID=              ← Chinese Discord channel — logged for reports, no auto-responses
CHINESE_TELEGRAM_TOPIC_ID=               ← Chinese Telegram topic ID — logged for reports, no auto-responses
SCAM_LOG_CHANNEL_ID=1212717191955480667  ← auto-mod channel — scam-blocker alert embeds posted here
```
