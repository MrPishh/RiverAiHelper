# River Discord Bot — Session Context

This file exists so any new Claude Code session can read it and immediately understand the full state of the project without needing conversation history.

---

## What This Bot Does

A Discord support bot for **River Protocol** that answers community questions using Claude (claude-sonnet-4-6). It uses RAG (Retrieval-Augmented Generation) with Voyage AI embeddings so only the most relevant knowledge base chunks are sent to Claude per question — not the entire KB.

---

## File Map

| File | Purpose |
|---|---|
| `bot.js` | Thin entry point — creates clients, wires all modules, fires `clientReady`, launches Telegram bot, calls Discord `login` |
| `state.js` | All shared Maps + timing constants + REFERRAL_CODES. No local requires (root of dependency tree) |
| `utils.js` | Pure helpers: date/folder utils, Discord helpers (isStaff, isBotMentioned, stripBotMention), looksResolved, saveQAPair |
| `intent.js` | Factory `createIntentModule(anthropic, { SUPPORT_CHANNEL_ID })` → classifyMessageIntent, logMessageIntent, logIntentClassification, logTelegramMessage, logTelegramIntent, RESPOND_INTENTS. Exports INTENT_LOG_PATH (`dc-intent-log.jsonl`) and TG_INTENT_LOG_PATH (`tg-intent-log.jsonl`) |
| `kb-sync.js` | syncDocs, syncBlog, registerDocInIndex, registerBlogInIndex, loadUsageStats, trackUsage |
| `claude.js` | Factory `createClaudeModule(anthropic, state, { searchKB, getSourceFiles, trackUsage })` → getSystemPrompt, askClaude, answerQuestion, pruneStaleEntries, loadCoreFacts, isScamConcern |
| `commands.js` | Factory `registerMessageHandler(discordClient, state, config, modules)` — full messageCreate event + all staff commands |
| `kb-monitor.js` | Factory `createMonitorModule(anthropic)` → `checkCorrectionStaleness`, `scanAnnouncementsForNewFacts`. Passive KB health monitor: detects stale corrections after syncs and auto-extracts net-new facts from raw announcements |
| `rag.js` | RAG engine — chunks MD files, embeds via Voyage AI, cosine similarity search. TOP_K=8, CHUNK_SIZE=1500, OVERLAP=150 |
| `embedder.js` | Voyage AI embedding provider (`voyage-3-lite`). Retry on 429. Swap via `EMBEDDING_PROVIDER` in `.env` |
| `knowledge-loader.js` | Legacy. Only `getSourceFiles()` is still used (by explain embed). `loadKnowledgeBase()` is unused |
| `blog-scraper.js` | Scrapes URLs to Markdown: jsdom → Readability → Turndown+GFM. RSS fallback on 403 |
| `toggles.js` | Platform reply toggle. `isEnabled(platform)`, `toggle(platform)`, `getStatus()`. State persisted to `toggles.json` — survives restarts. Controlled via `!toggle discord` / `!toggle telegram` |
| `toggles.json` | Persisted toggle state `{ discord: true, telegram: true }`. Auto-created on first toggle |
| `telegram/telegram-adapter.js` | Telegram bot adapter using Telegraf. Same reply rules as Discord: intent gate, staff-admin detection (cached 10 min), staff-wait timer, staff-engaged suppression, Scenario 0/0.5/@mention handling. Logs all messages to `tg-intent-log.jsonl` |
| `weekly-report/member-stats/discord/discord-member-stats.js` | Logs Discord join/leave events to `member-log.jsonl`. `getMemberStats(from, to)` returns join/leave counts for any date range. `getWeeklyStats()` is a wrapper for the current Mon–Sun week. Registered via `registerMemberEvents(client)` in `clientReady` |
| `weekly-report/member-stats/telegram/tg-member-stats.js` | Logs Telegram join/leave events to `tg-member-log.jsonl` via `logTgMemberEvent`. `getTgMemberStats(from, to)` returns join/leave counts for any date range. Requires bot to be admin and `chat_member` in `allowedUpdates` |
| `weekly-report/community-report/community-report.js` | Reads intent logs for a date range of user messages (general + support channels, no staff). Sends to Haiku to produce three-section report: Common Problems, FAQs, Conversation Highlights. Posts to REPORTS_CHANNEL_ID. Supports `reportType: 'weekly'` (Mon–Sun) or `'daily'` (today) |
| `usage-stats.json` | Persisted Claude API token counts and estimated cost. Auto-created on first answer |
| `intent/` | Standalone folder for message intent classification. Contains `dc-intent-log.jsonl` (Discord messages + classified intents, tagged `"platform":"discord"`), `tg-intent-log.jsonl` (Telegram messages + classified intents, tagged `"platform":"telegram"`), `intent-taxonomy.md` (category registry with rules and examples), `theory-notes.md` (SDT, Speech Act Theory, Bayesian, Control/Queuing/Decision Theory — consult when intent-log data shows recurring failure patterns), `fetch-messages.js` (historical Discord message fetch utility) |
| `README.md` | Human-readable project overview: file descriptions, all staff commands, all .env vars, KB folder structure |
| `CONTEXT.md` | This file. Read at start of every session |

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
    May_blog/ etc.               ← Monthly folders for manually added posts (!add-blog)
  governance/
    _governance-context.md       ← 17 curated files, narrative order, excluded topic IDs, sync rules
    *.md                         ← First posts only from gov.river.inc/c/proposal-lab/5
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
  .embeddings-cache.json         ← Voyage AI vector cache (auto-generated, do not edit)

channel-learning/
  general/qa-log.md              ← Q&A pairs learned from staff replies in #general
  support/qa-log.md              ← Q&A pairs learned from staff replies in #support

intent/
  dc-intent-log.jsonl            ← Discord: two record types — raw message log (platform, ts, id, content, isStaff, etc.)
  |                                 and classified intent records ({platform:"discord", type:"classified", id, intent, ts})
  tg-intent-log.jsonl            ← Telegram: same structure, platform:"telegram". Separate file for platform-level analysis
  intent-taxonomy.md             ← Category registry: intents, context rules, examples, edge cases
  theory-notes.md                ← Reference: SDT, Speech Act Theory, Bayesian, Control/Queuing/Decision Theory
  fetch-messages.js              ← Utility: pull historical messages from Discord REST API
```

---

## Answer Flow (How the Bot Responds)

1. **Scenario 0** — User replies to bot's CLARIFY question → continues full conversation history
2. **Scenario 0.5** — User replies to any bot ANSWER using Discord's reply feature (no @mention needed) AND message is more than one word → reconstructs prior exchange + fresh KB search, answers in context. The reply itself is treated as intentional engagement — no question-detection heuristic applied.
3. **Scenario 1** — User @mentions bot directly → classifies intent first; if `staff-ping`, redirects to support channel; otherwise answers immediately
4. **Scenario 2** — User @mentions bot as reply to another message → fetches original, classifies the original message; if `staff-ping`, redirects; otherwise answers it
5. **Scenario 3** — User posts with no mention → classifies intent; only the 4 respond categories (`help-seeking`, `troubleshooting`, `onboarding`, `factual-question`) proceed to `scheduleAutoAnswer()` which waits STAFF_WAIT_MINUTES (3) then auto-answers if no staff reply

**Claude response tags:** Every response starts with `ANSWER:`, `CLARIFY:`, or `ESCALATE:`.

**Rephrase escalation:** After MAX_BOT_ANSWERS_BEFORE_TICKET (2) complete answer exchanges with the same user in the same channel within 2 hours, the bot escalates to the support ticket link.

### Conversation context guards (added 2026-05-12)

Two state maps plus two event-based rules protect against the bot firing when it shouldn't:

| Map | Key | TTL | Purpose |
|---|---|---|---|
| `staffEngaged` | `userId::channelId` | 4 hours | Set when staff directly replies to a user. Suppresses **Scenario 3 auto-answers only** — @mentions (Scenario 1) and bot-replies (Scenario 0.5) still get a response. Staff hierarchy is always respected: if staff is actively in a thread, the bot stays out of unprompted answers, but responds when directly addressed. |
| `botReplied` | `userId::channelId` | 5 minutes | Set after bot replies. Kept in state for potential future use — suppression logic was removed (intent gate handles duplicate responses cleanly enough) |

**Self-resolution cancellation** — on every incoming message, if the sender has a pending Scenario 3 timer and their message matches `looksResolved()` (e.g. "ok", "fixed", "working now", "good now"), the timer is cancelled silently before it fires.

**Community stepped in** — if a non-staff user replies to a pending Scenario 3 question before the timer fires, the reply is classified first. The timer is only cancelled if the reply is genuine `community-help`. Any other classification — including `scam-content` — leaves the timer running. This prevents scammer accounts from suppressing the bot by replying within seconds of a victim's message (observed incident: 3 scammer accounts replied with phishing links within 9 seconds, which would have cancelled the timer under the old blanket rule).

**Scenario 0.5 gate** — any reply to a bot message using Discord's reply feature (> 1 word) continues the conversation. The reply feature itself signals intentional engagement — no question heuristic required. Single-word/emoji-only replies (< 2 words) are ignored.

**What these fix:**
- Staff handles user in thread → bot no longer auto-answers unprompted, but still responds if user explicitly @mentions or replies to the bot
- User self-resolves during the 3-minute wait → timer cancelled, no late bot response
- Community member replies to a pending question first → timer cancelled, bot stays out
- Single-word or emoji-only reply to a bot answer → Scenario 0.5 silently skipped

---

## Intent Classification System (added 2026-05-12)

### How it works

Every message that reaches Scenario 1, 2, or 3 is classified by Claude Haiku (`claude-haiku-4-5-20251001`) before a response decision is made. The classifier returns one of 14 categories from the intent taxonomy.

**`classifyMessageIntent(content, message)`** — async function. Builds a prompt with three context signals:
- **Channel** — `#support` or `#general`. Same message reads differently depending on channel.
- **Reply-to context** — fetches the referenced message (if any) to determine who the message is replying to: the bot, another community member, or nobody.
- **Recent thread** — last 3 messages in the channel before this one, shown as `author: content` lines. Gives the classifier conversational context so it can distinguish community-help from help-seeking even when content is ambiguous.

Returns the category string. On API error, falls back to `'help-seeking'` (fail open — never go silent due to a classification failure).

**`RESPOND_INTENTS`** — `Set { 'help-seeking', 'troubleshooting', 'onboarding', 'factual-question' }`. Only these four categories proceed to `scheduleAutoAnswer()` in Scenario 3.

**`ALL_INTENT_CATEGORIES`** — the full list of 15 valid category strings. Used to validate Haiku's response and reject hallucinated labels.

**`logIntentClassification(messageId, intent)`** — appends `{ type: 'classified', id, intent, ts }` to `intent/intent-log.jsonl`. Joinable with the raw message record by `id`.

### Where classification runs

| Scenario | What is classified | On `staff-ping` | On `scam-content` |
|---|---|---|---|
| 1 (direct @mention) | The question (mention stripped) | Short redirect reply to `#support`, no answer | Not applicable — direct @mentions skip scam filter |
| 2 (@mention as reply) | The original message being answered | Short redirect reply, no answer | Not applicable |
| 3 (no mention) | The raw message content | Skip `scheduleAutoAnswer()` entirely | Skip `scheduleAutoAnswer()` entirely |
| Community reply to pending | The reply content | — | Timer kept alive — scam reply does not cancel the pending answer |

Scenarios 0 and 0.5 skip classification — the user's explicit reply to the bot is itself the intent signal.

### `scam-content` vs `safety-alert`

Two distinct categories — both scam-related but opposite in who is posting:

| Category | Sender | What it is | Timer effect |
|---|---|---|---|
| `safety-alert` | Legitimate community member | Warning ABOUT a scam posted for public awareness | N/A — not a reply to a pending question |
| `scam-content` | Bad actor | Active phishing disguised as help — external links, fake admin offers, wallet restore apps | Timer kept alive |

Key signal for `scam-content`: the message redirects a user away from the channel (to external apps, X.com links, DMs) and often arrives within seconds of a victim reporting a problem. Genuine `community-help` references the protocol, asks clarifying questions, and does not redirect to external sites.

### `help-seeking` covers frustrated complaints (updated 2026-05-15)

The `help-seeking` definition was extended to explicitly include frustrated complaints and venting about conversion rates, waiting periods, staking, and token amounts — even when phrased as opinions rather than questions (e.g. "the conversion is so poor", "why do I get fewer tokens the longer I wait"). The `community-discussion` definition was updated to explicitly exclude protocol frustration so the classifier doesn't use it as a catch-all for these cases.

### Why `looksLikeQuestion()` was replaced

The old heuristic passed any message with `?` or ≥ 8 words. "You should clear browser cache and try again" (community-help, 8 words) passed it and triggered an auto-answer. Haiku classifies based on what the message *does* (speech act), not surface patterns. It cannot be fooled by word count.

`looksLikeQuestion()` was moved to `utils.js` during the module split but is no longer called anywhere in the main message flow (dead code — safe to remove).

---

## Staff Commands

| Command | What It Does |
|---|---|
| `!usage-stats` | Show Claude API calls, token counts, estimated cost |
| `!sync-knowledge` | Reload core-facts.md + rebuild full RAG index |
| `!sync-blog` | Pull new/changed posts from blog sitemap (auto-detects updates via lastmod) |
| `!sync-docs` | Pull new/removed pages from docs sitemap |
| `!sync-docs force` | Force re-scrape all 45 doc pages |
| `!add-blog <url>` | Scrape single blog post → save to knowledge-base/blogs/ |
| `!add-blog-text <url>` + attach | Manual add: attach .md/.html/.txt (use MarkDownload extension) |
| `!exclude-blog <url>` | Exclude a post: deletes its .md file, removed from index, skipped on future syncs |
| `!include-blog <url>` | Remove URL from exclusion list; post will be re-scraped on next `!sync-blog` |
| `!add-correction <slug> <text>` | Add/update a correction in `knowledge-base/corrections/<slug>.md`. Ranks above docs and blogs in RAG. Also accepts attachment. |
| `!add-doc <url>` | Scrape single doc page → save to knowledge-base/docs/ |
| `!add-doc-text <url>` + attach | Manual add with attachment |
| `!toggle discord` | Toggle Discord auto-replies ON/OFF. State persisted across restarts |
| `!toggle telegram` | Toggle Telegram auto-replies ON/OFF. State persisted across restarts |
| `!toggle status` | Show current ON/OFF state for both platforms |
| `!member-stats` | Show Discord server total members + Mon–Sun join/leave counts (current week) |
| `!report weekly [discord\|telegram]` | Generate weekly community report (Mon–Sun of most recently completed week) and post to REPORTS_CHANNEL_ID |
| `!report daily [discord\|telegram]` | Generate daily community report (today's messages) and post to REPORTS_CHANNEL_ID |
| @bot + Discord message link | Staff only: post explanation embed to staff channel |

---

## Sitemaps

| Site | Sitemap URL | Pages | Notes |
|---|---|---|---|
| docs.river.inc | https://docs.river.inc/sitemap-pages.xml | 45 pages | satoshi-protocol-v1 sitemap excluded |
| blog.river.inc | https://blog.river.inc/sitemap-posts.xml | 133 posts total, 41 after BLOG_SINCE_DATE | BLOG_SINCE_DATE = 2025-05-15 |

**`!sync-docs` vs `!sync-docs force`:** Docs sitemap has no lastmod dates so regular sync only catches new/removed pages. Use `force` to re-scrape all on content updates.

**`!sync-blog`:** Blog (Ghost) has lastmod on every post so it auto-detects updates — no force flag needed.

**Both `!sync-blog` and `!sync-docs` have been run — 42 blog posts and 45 docs pages are indexed.**

---

## Network Note

`docs.river.inc` and `blog.river.inc` are blocked by the user's ISP (Cisco SSE filter). **Cloudflare WARP must be enabled** on the machine for the bot to scrape these sites. Without WARP, all scrape commands will fail with HTTP 403.

---

## Corrections System

### `knowledge-base/corrections/` folder
Files here are indexed like all other KB content but ranked 1.3× higher than docs in RAG search. Corrections are injected into the system prompt's SOURCE PRIORITY rule so Claude deprioritises conflicting doc chunks.

### Workflow
1. Bot gives wrong answer (old mechanism from outdated docs)
2. Staff uses `@bot + message link` → sees which source caused it
3. Staff runs `!add-correction <slug> <correct info>` in Discord, or describes the problem in the Claude Code terminal and lets Claude create/update the correction file
4. RAG rebuilt — correction now outranks the conflicting doc chunk
5. Optionally: staff edits the doc file and wraps the outdated section in `<!-- EXCLUDE -->...<!-- /EXCLUDE -->`, then runs `!sync-knowledge`

### `<!-- EXCLUDE -->` markers
Add these HTML comment tags in any `.md` file in the KB to mark a section as permanently outdated. The `rag.js` chunker strips these blocks before indexing — the excluded content is never embedded, never retrieved. Files containing these markers are automatically protected from being overwritten by `!sync-docs force`.

### Dynamic blog effective date
`blogs/_index.json` tracks three fields:
- `configuredSinceDate` — the original `BLOG_SINCE_DATE` from config (2025-05-15). Never changes.
- `effectiveSinceDate` — the current scraping floor. Starts equal to `configuredSinceDate`. Only advances when posts are deliberately deleted from disk. Never recalculated automatically on a normal sync (that was a bug that was fixed — it was causing posts between May 15–24 to be wrongly skipped).
- `sinceHistory` — array logging every time `effectiveSinceDate` advanced: `{ changedAt, from, to }`. Shown in the `!sync-blog` Discord output as "Floor history".

If you delete old blog posts from `knowledge-base/blogs/`, the next `!sync-blog` detects the missing files, removes them from the index, advances `effectiveSinceDate` to the oldest *remaining* post's date, appends an entry to `sinceHistory`, and uses the new date as the floor going forward. Deleted posts are not re-scraped.

### Blog URL exclusion list
`blogs/_index.json` also tracks an `excluded` array of full post URLs. Managed by `!exclude-blog <url>` and `!include-blog <url>`. Posts on this list are skipped on every future `!sync-blog` even if they appear in the sitemap.

**This is distinct from `<!-- EXCLUDE -->` markers:**
- `excluded` list → prevents re-scraping entirely; the file is deleted from disk when `!exclude-blog` runs
- `<!-- EXCLUDE -->` markers → file stays on disk, excluded section is stripped from RAG only; use for outdated content within an otherwise-valid file

### Docs has no exclusion mechanism
`docs/_index.json` only tracks `sitemapUrl` and `lastChecked` — no `excluded` URL list, no `configuredSinceDate`. `!sync-docs` scrapes every page in the sitemap with no date floor and no URL-level skip. To suppress a doc page from RAG, apply `<!-- EXCLUDE -->` markers inside the file instead.

---

## KB Monitor (`kb-monitor.js`)

Two background health checks that run automatically as part of sync commands. Both use Haiku to keep API cost low.

### 1. Correction Staleness Check

**Triggered by:** `!sync-blog` and `!sync-docs` (after files are written, before reporting results)

**What it does:** For each newly scraped file, Haiku compares the first 1500 chars of the new content against every active correction file (first 600 chars each). If the new content appears to contradict, update, or supersede a correction, a warning is added to the Discord sync reply.

**Discord output:** `⚠️ <slug> may affect correction: <correction-file>` lines appended to the sync summary.

**Why it matters:** Correction files can become stale when the blog or docs are updated with correct information. Without this check, the correction file would keep overriding the now-accurate source. Staff are alerted immediately after each sync so they can review and delete/update the correction.

**Data flow:**
- `kb-sync.js` collects `processedFiles: [{ filePath, content }]` from every successful scrape
- `commands.js` passes this array to `monitor.checkCorrectionStaleness(result.processedFiles)`
- Returns `[{ newFile, correctionFile }]` — each pair shown as one warning line

### 2. Announcement Auto-Scan

**Triggered by:** `!sync-knowledge` (runs before `buildIndex()` so extracted facts are indexed in the same pass)

**What it does:** Reads all raw weekly announcement files (`announcements/*_ann/week*.md`), filters to entries newer than the last scan timestamp, strips already-indexed blog URLs (replacing them with `[blog post already indexed]`), then asks Haiku whether the remaining content contains net-new operational facts. If yes, Haiku returns a category and 2–3 sentence summary, which is auto-appended to the matching curated file.

**Scan state:** `knowledge-base/announcements/_scan-state.json` — stores `lastScanned` ISO timestamp. On first run (file absent), initialises to "now" so existing announcements are not reprocessed.

**Categories and target files:**
| Haiku category | Curated file |
|---|---|
| `EXCHANGE` | `exchanges-and-token.md` |
| `MILESTONE` | `ecosystem-milestones.md` |
| `NOTICE` | `important-notices.md` |

**Noise reduction:** Blog reposts in announcements are stripped before Haiku sees them (matched against `blogs/_index.json` URL list). If the entire entry was just a blog repost, it is skipped entirely with no Haiku call.

**Discord output (from `!sync-knowledge`):** `📌 Auto-extracted N fact(s): <category>: <summary>` lines, or a single line if nothing was found.

**Format appended to curated files:**
```
---
*Auto-extracted from announcement — YYYY-MM-DD*

<2–3 sentence Haiku summary>
```

---

## Backfilling Missed Announcements

The bot saves announcements **in real-time only** via the `messageCreate` handler. If the bot was offline when a post was made, the announcement is never written to disk. `!sync-knowledge` cannot recover it — it only scans what is already on disk.

### How to backfill

**1. Identify the correct weekly file**

Week boundaries (based on day-of-month):
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

Check `knowledge-base/announcements/_scan-state.json` — if the missed announcement's date is older than `lastScanned`, the scanner will skip it even after `!sync-knowledge`. Two types of content:

| Content type | Action |
|---|---|
| Operational facts — exchange listing, integration, parameter change, safety notice | Also add a summary to the relevant curated file (`exchanges-and-token.md`, `ecosystem-milestones.md`, or `important-notices.md`) |
| Community/event content — celebration posts, contest reminders, meetup recaps with no new protocol facts | Raw file only — no curated update needed |

**4. Run `!sync-knowledge` in Discord** once all missed announcements are added.

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
- **SSL bypass** — `https.Agent({ rejectUnauthorized: false })` used in scraper and docs/blog sync because river.inc certs are locally-issued.
- **linkedom → jsdom** — linkedom caused OOM (exit code 9) on large pages. jsdom is stable.
- **RAG replaced full-KB loading** — old approach sent entire KB (~100K+ tokens) to Claude per call. RAG sends top-8 chunks (~2,000–4,000 tokens). Voyage AI voyage-3-lite handles embeddings.
- **BLOG_SINCE_DATE = 2025-05-15** — user only wants posts from this date onward; 92 older posts excluded.
- **URLs must be plain text** — Claude was rendering URLs as `[url](url)`. System prompt explicitly forbids markdown link syntax.
- **satoshi-protocol-v1 docs excluded** — user only wants the main River docs sitemap, not the legacy v1 subdomain sitemap.

---

## RAG Design Decisions

### Why Voyage AI (not OpenAI / Ollama / Cohere / DeepSeek / Llama)
We evaluated several options:
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
Separation of concerns: `rag.js` handles chunking, caching, and search logic. `embedder.js` is the provider adapter. Switching from Voyage to OpenAI (or any other provider) means adding one function in `embedder.js` and changing `EMBEDDING_PROVIDER` in `.env` — `rag.js` is untouched. Current supported providers: `voyage`.

### Why chunk overlap (150 chars)
Without overlap, a sentence or key fact that falls at a chunk boundary gets split across two chunks, and neither chunk contains the full context. 150-char overlap ensures the tail of one chunk and the head of the next share context, so searches don't miss answers that straddle a boundary.

### Why TOP_K=8
Started at 5, raised to 8 by user after testing. More chunks = more context for Claude to draw from, at the cost of slightly more tokens per call. At ~1500 chars/chunk × 8 = ~12K chars of context, still far cheaper than the old full-KB approach (~100K+ chars).

### Why `getSystemPrompt()` is a function, not a `const`
`coreFacts` is loaded from disk at startup and can be reloaded at runtime via `!sync-knowledge`. A `const` would capture the empty string at module load time and never update. The function reads `coreFacts` at call time, so reloading the file takes effect immediately on the next Claude call.

---

## Core Facts Design

### What `core-facts.md` is for
Facts that must be true in **every single Claude response**, regardless of what the RAG search returns. Examples: "River had a testnet but is now on mainnet", "RIVER token is live on DEX and CEX", "TGE date is September 22, 2025".

### How it works
- `loadCoreFacts()` reads the file into the `coreFacts` variable at startup (and on `!sync-knowledge`)
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
- `conversationState`: `userId::channelId → { history, botMsgId, channelId, lastActivity }`
- `botMsgIndex`: `botMsgId → userId::channelId` — reverse lookup so when a reply arrives, we find the conversation in O(1)
- `staffEngaged`: `userId::channelId → timestamp` — tracks recent staff engagement per user (4hr TTL)
- `botReplied`: `userId::channelId → timestamp` — tracks recent bot replies per user (5min TTL)
- `pendingQuestions`: `messageId → { question, userId, channelId, timer, storedAt }` — Scenario 3 timers awaiting staff reply; pruned hourly if storedAt is older than STAFF_WAIT_MS + 10 min

**Flow:**
1. Claude responds with `CLARIFY:` → bot saves conversation history + the bot message ID to `conversationState`
2. User replies to that specific bot message → Scenario 0 detects it via `botMsgIndex`, appends user reply to history, calls Claude again with full history
3. Claude responds with `ANSWER:` or `ESCALATE:` → conversation state is cleared, exchange counted

**Design choices:**
- **Only the original asker can continue** — `convKey` encodes `userId`, so a different user replying to the bot's message starts a fresh conversation rather than hijacking the existing one
- **30-minute expiry** (`CONV_EXPIRY_MS`) — stale conversations are pruned hourly so the maps don't grow unbounded
- **CLARIFY does not increment the answer counter** — only complete exchanges (ANSWER or ESCALATE) count toward `MAX_BOT_ANSWERS_BEFORE_TICKET` (2). Asking a clarifying question is free.

### Why ANSWER / CLARIFY / ESCALATE tags
Previously the bot had to guess Claude's intent (check for "?", regex for ticket links, etc.) — fragile and unreliable. Structured tags make intent explicit and machine-parseable. Claude is instructed to always start with one of the three tags, and `askClaude()` parses it to decide whether to save conversation state or clear it.

---

## RAG Source Attribution

When the bot answers a question, `searchKB()` now returns `{ context, sources }` — an object, not a plain string. The `sources` array (unique filenames that contributed to the answer) is stored in `ragSourcesMap`:

```
ragSourcesMap: Map<botMsgId → { sources: string[], storedAt: number }>
```

TTL: 30 minutes. Pruned hourly alongside conversation state.

When a staff member uses the explanation embed trigger (@bot + message link), `sendExplanationEmbed()` reads `ragSourcesMap` first for accurate source attribution. Falls back to `identifyRelevantSources()` (keyword matcher) only if the entry has expired.

`searchKB()` signature: `async function searchKB(query, topK = TOP_K) → { context: string, sources: string[] }`

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
- **SCAM SAFETY** — Dynamic injection (2026-05-15): the verbatim scam safety block is no longer always-on. It is injected only when `isScamConcern(question)` returns true. See Scam Concern Detection below.

### Prompt Caching (added 2026-05-15)

`askClaude()` passes `system` as a two-element array:
1. **Static block** — `getSystemPrompt(includeScamBlock)` output, marked `cache_control: { type: 'ephemeral' }`. Cached by Anthropic for 5 minutes. Stable across most calls (only changes when `!sync-knowledge` reloads `coreFacts`, or when `includeScamBlock` differs).
2. **Dynamic block** — referral code (rotates each call) + SOURCES instruction. Never cached.

Cache hits are logged: `[Cache] Hit — N tokens served from cache`. Minimum threshold for caching is 1024 tokens (Sonnet); the static block exceeds this when `core-facts.md` is loaded.

### Scam Concern Detection (added 2026-05-15)

Three functions in `claude.js` (module-level constants + factory-bound functions):

- **`detectScamConcernSync(question)`** — synchronous regex screen. Matches phrases like "is this a scam", "seed phrase", "private key", "someone claiming they're admin", "help outside the server", etc. No API cost, ~0ms.
- **`detectScamConcernLLM(question)`** — Haiku fallback (max_tokens: 5, YES/NO answer). Only called when tier-1 misses but `SCAM_SOFT_SIGNALS` words are present (scam, legit, seed, wallet, etc.). Fails safe: returns `true` on API error.
- **`isScamConcern(question)`** — orchestrates both tiers. Called inside `answerQuestion()` concurrently with `buildInitialHistory()` (no added latency on the normal path).

The scam block (`SCAM_CONCERN_BLOCK` constant) is verbatim and injected only when `isScamConcern` returns true. False positives (block injected unnecessarily) are acceptable; false negatives are not.

---

## Known Issues / Gotchas

- **`saveQAPair` missing `ensureDir`** — ~~Fixed~~. `ensureDir(path.dirname(filepath))` is called inside `saveQAPair()` in `utils.js`. `channel-learning/` subdirs are now auto-created on first write.

- **`identifyRelevantSources()` is the old keyword matcher** — lives in `claude.js`, still called by `sendExplanationEmbed()` in `commands.js` for the staff explanation embed. Reads all source files via `getSourceFiles()` and does word-frequency matching. Not used for actual Q&A (RAG handles that). Fine as-is.

- **`looksLikeQuestion()` is dead code** — exported from `utils.js` but not called anywhere. Safe to remove in a future cleanup pass.

- **`Jithu/` folder in root** — user's personal notes folder. Contains: `readme.txt` (original build prompt), `Bot commands.txt` (stale command reference — lists `!refresh-blogs` and `!refresh-docs` which no longer exist), `prompt.txt`, `Work flow structure.txt`. Not used by the bot. Safe to ignore.

- **PM2 is set up** — bot runs as `river-bot` under PM2. Use `pm2 restart river-bot`, `pm2 logs river-bot`, `pm2 status`. A Windows Task Scheduler task (`PM2 Resurrect on Login`) auto-runs `pm2 resurrect` on login after a reboot. Note: `pm2 startup` does not work on Windows (no init system support).

---

## RAG Index State

- **Current index:** stale — run `!sync-knowledge` to get accurate count after recent KB additions
- **Cache location:** `knowledge-base/.embeddings-cache.json`
- **Restart behaviour:** instant — `buildIndex()` on startup only calls Voyage AI for new/changed chunks. If nothing changed, 0 API calls are made.
- **What's indexed:** `core-facts.md`, 45 docs pages, blog posts (May 2025 onwards), governance folder (17 curated files), corrections (4 files), curated announcements (3 files), channel-learning Q&A logs
- **Excluded from index:** raw announcement/tweet weekly files (EXCLUDE markers), outdated blog sections (EXCLUDE markers on rate tables and stale campaign content)

---

## Pending / Discussed But Not Done

- **~~API-level prompt caching~~** — implemented 2026-05-15. See Prompt Caching section above.
- **~~Module split~~** — completed 2026-05-16. Monolithic `bot.js` (~1713 lines) split into `state.js`, `utils.js`, `intent.js`, `kb-sync.js`, `claude.js`, `commands.js`, thin `bot.js`. Original backed up as `bot.js.bak`.
- **~~PM2 setup~~** — complete. Bot runs under PM2 (`river-bot`). Windows Task Scheduler handles auto-resurrect on login.

### ⏰ Time-based reminders — do these after 2–4 weeks of live traffic

- **Batch intent log analysis** ← **DO THIS FIRST for cost savings.** After 2–4 weeks of traffic, run `intent/dc-intent-log.jsonl` and `intent/tg-intent-log.jsonl` through the Anthropic Batch API (50% cost vs real-time). Goal: identify misclassification patterns at scale. Use `intent/theory-notes.md` to pick the right framework for each failure type before changing the taxonomy.
  - How: group messages by classified intent, sample disagreements (messages that seem wrongly labelled), send a batch job to Haiku asking "was this classification correct?", review the disagreement rate per category.
  - If misclassification rate > 10% for a category, update `intent/intent-taxonomy.md` and re-classify going forward.

- **Intent classification refinement** — review `intent/dc-intent-log.jsonl` and `intent/tg-intent-log.jsonl` for misclassifications after batch analysis above. Consult `intent/theory-notes.md` for which theoretical framework applies to the observed failure pattern before making changes.

### 💡 Improvements discussed but deferred

- **Structured output migration** — `askClaude()` currently parses ANSWER/CLARIFY/ESCALATE tags from free text. Could be migrated to Claude tool use (typed JSON response) for more robust parsing. Low priority — current approach is stable.

- **Supabase / pgvector** — if `knowledge-base/.embeddings-cache.json` grows large (slow startup, memory pressure), migrate the embedding cache to Supabase with pgvector. Current flat-file cache is fine up to ~5,000 chunks. Flag: check file size periodically with `!sync-knowledge` output (total chunks).

- **Scam moderation** — auto-delete + timeout + log for detected `scam-content` messages. Fully specced (see project memory). Implement only when explicitly requested.

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
STAFF_WAIT_MINUTES=3
TELEGRAM_BOT_TOKEN                       ← from BotFather
TELEGRAM_CHAT_ID=-1002060657220          ← Telegram group ID
TELEGRAM_TOPIC_IDS=1,62                  ← comma-separated topic thread IDs bot responds in
```
