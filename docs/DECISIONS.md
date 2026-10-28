# Deliberate choices

Decisions that look odd out of context, and things that were tried and removed — each with its reason, so they are not undone or re-added by accident.

> **These were decided for the circumstances at the time and may change.** When a task runs into one — a request it rules out, or a reason that no longer seems to hold — say so and let the owner decide. Never silently follow one against a request, and never silently override it.

## Platform and runtime

| Choice | Why |
|---|---|
| Listen for `clientReady`, not `ready` | discord.js v14's typed event. Changed deliberately — do not revert. |
| Load `node-fetch` with `const fetch = (await import('node-fetch')).default`, never `require` | node-fetch v3 is ESM-only and this is a CommonJS project. |
| Cloudflare WARP must be on to scrape `docs.riverai.inc` and `blog.riverai.inc` | The host machine's ISP filter (Cisco SSE) blocks both sites. Without WARP every scrape fails with HTTP 403 — check WARP before debugging code. |
| TLS checks are off for scraping (`rejectUnauthorized: false`) in `blog-scraper.js` and the sitemap fetches | The sites' certificates are locally issued as seen from this machine, and Node rejects them. |
| pm2 runs `node bot.js` directly (process `river-bot`) | Keeps the bot running so real-time announcements are never missed — the bot captures them only as they arrive. |
| Gateway watchdog: exit after 30 min with no Discord gateway event | Added 2026-09-01 after a ~6-hour silent outage: a "zombie" connection stops delivering events without disconnecting, which discord.js cannot detect. Exiting lets pm2 restart the bot. |
| `GUILD_ID` hard-coded in `telegram-adapter.js` | Turns `<#channelId>` mentions into Discord links on Telegram. Update it if the Discord server changes. |

## Domain, links and wording

| Choice | Why |
|---|---|
| Only ever share `riverai.inc` links | The project moved off `river.inc` on 2026-09-04; `river.inc` and its subdomains are retired. Never reintroduce a `river.inc` link in code, prompts or sync URLs. |
| `river.inc` is still mentioned in `core-facts.md`, the scam-safety correction and `outro-official-links.md` | So the bot can redirect a user who reports the old domain as unreachable. |
| URLs in angle brackets `<https://…>`, never `[text](url)` | Claude used to render URLs as markdown links; the system prompt forbids that. Angle brackets also stop Discord's link previews. |
| …except `https://discord.com/channels/…` links | Discord renders these as native jump links; wrapping them breaks that. |
| `core-facts.md` says "River had a testnet in the past but it is no longer active." | The earlier "there is no testnet and never has been one" was wrong. Never revert it. |
| The bot shares only URLs present in its KB context | Links from Claude's training knowledge may be wrong or unsafe; the system prompt forbids them. |

## Knowledge base and sync

| Choice | Why |
|---|---|
| `BLOG_SINCE_DATE` = 2025-05-15 | The owner wants only posts from this date on; about 92 older posts are excluded. |
| `effectiveSinceDate` only advances when blog posts are deleted from disk | Recalculating it on every sync was a bug that made posts get skipped. |
| `syncBlog` does not trust sitemap `<lastmod>` alone — it cross-checks each post's own `article:published_time` / `modified_time` | A site redeploy bumped `lastmod` on ~40 unchanged posts (seen in the 2026-09-04 migration). Do not remove the check or `knowledge-base/blogs/_excluded-legacy.json`, the registry it maintains. |
| A post whose true publish date is before the floor is held for review, not auto-added or auto-dropped | Exactly the ambiguous case — a human decides with `/blog action:Include`. |
| `<!-- EXCLUDE -->` markers are re-applied when a sync rewrites a file | A delete-and-recreate (e.g. a domain change) would otherwise silently drop a hand-added marker. |
| The satoshi-protocol-v1 docs sitemap is not synced | The owner wants only the main River docs. |
| Raw `*_ann` and `*_tweet` folders are never indexed | They are unprocessed Discord captures; curated files in `announcements/` are indexed instead. Tweets are not indexed at all (they mirror announcements, low signal). |
| Correction updates are drafted to `corrections/_drafts/`, never applied automatically | A human must check a draft against the live correction. |
| The correction check is two-stage (Haiku flags, then Sonnet drafts or says `NO_CHANGE_NEEDED`) and drafting is not awaited by `/sync` | One Sonnet call per flagged pair took minutes and hung the `/sync` reply; the second stage also filters Haiku's false positives. |
| The staleness check sends each correction's full text, not a snippet | 600-character snippets cut off each file's scope statement, so Haiku flagged on topic overlap alone (fixed 2026-07-07). |
| `channel-learning/` Q&A logs, `data/` and the intent logs stay local — never committed or uploaded | They contain community members' messages and user IDs (decided 2026-10-28; only `channel-learning/README.md` is tracked). |

## Answering

| Choice | Why |
|---|---|
| RAG (top 8 chunks) instead of sending the whole KB | The full KB was ~100K+ tokens per call; RAG sends ~2–4K. |
| Voyage AI `voyage-3-lite` for embeddings | Anthropic recommends Voyage with Claude; 200M free tokens a month on the voyage-3 series; the cheapest model in it is plenty for support Q&A. OpenAI has no free tier, Cohere's is 1,000 calls/month, DeepSeek has no embedding API, local models were weakest. |
| A payment method is on the Voyage account | Without one the account is capped at 3 requests/min and 10K tokens/min. The free tokens still apply. |
| `embedder.js` separate from `rag.js` | Switching provider means one new function in `embedder.js` and one setting; `rag.js` stays untouched. |
| Chunks of 1,500 characters with 150 overlap; `TOP_K` = 8 | The overlap keeps facts at chunk edges intact. `TOP_K` started at 5 and was raised to 8 by the owner after testing. |
| Retrieved chunks are re-ranked by Haiku; those scoring below 3/5 dropped, at least 3 kept | Filters chunks that embed similarly but do not answer the question. On failure the original chunks are used. |
| `getSystemPrompt()` is a function, not a constant | `/sync type:Knowledge` reloads core facts at runtime; a constant would keep the old text. |
| `core-facts.md` is injected into every system prompt; dynamic stats are not put in it | Facts that must always be right can't depend on retrieval. Stats like TVL go stale — they belong in `ecosystem-milestones.md` as dated snapshots. |
| Replies start with `ANSWER:`, `CLARIFY:` or `ESCALATE:` | Guessing Claude's intent (looking for "?" or ticket links) was fragile; the tag decides whether conversation state is kept. |
| `CLARIFY` does not count toward the 2-answer ticket escalation | Asking a clarifying question is free. |
| Only the original asker can continue a conversation | The conversation key includes the user ID, so another user's reply starts fresh instead of hijacking it. |
| Prompt caching with two breakpoints (system block + last message) | The system block is shared by every user's first question; the last-message breakpoint caches one conversation's growing history. A regression that dropped the system breakpoint was fixed 2026-08-18. Cache stats are due for review. |
| Live prices come from Dexscreener and are added only for price questions | Keeps other prompts small; a failed token keeps its last known price. |

## Intent and moderation

| Choice | Why |
|---|---|
| Haiku classifies intent; only 4 of 15 intents get an answer | The old `looksLikeQuestion()` heuristic (a "?" or 8+ words) answered community members' advice. Haiku judges what a message *does*. |
| The classifier fails open (`help-seeking`) | A classification error should never make the bot go silent. |
| Scam Layer 2 (Haiku) fails safe to "not scam"; victim-side Layer 5 fails safe to "include the safety block" | Avoid punishing users on a network error; a needless safety message costs nothing. |
| A community reply cancels a pending auto-answer only when it is classified `community-help` | Scammers replied with phishing links within seconds to stop the bot answering the victim (seen: 3 accounts in 9 seconds). |
| Scenario 0.5 (a reply to the bot) is gated by intent | In busy channels a reply to the bot's message is often agreement, venting or meant for someone else (fixed 2026-07-10, both platforms). |
| Scenario 2 moderates the original message, never the mentioning user's text | Otherwise an innocent original asker could be timed out for words someone else typed (fixed 2026-08-18). |
| The scam blocker is OFF by default; plain link blocking is left to Discord's AutoMod | It targets what AutoMod misses: bio/profile redirects, t.me/wa.me links, name impersonation with DM offers, and social engineering. |
| Escalating timeouts (N hours for the Nth infraction, max 28 days) | Repeat offenders step up. The infraction is recorded before any `await` so concurrent messages can't share a count (race fixed 2026-08-18). |
| The bot never answers in ticket or collab channels | Staff handle tickets; the messages are only logged for reports. |
| The Chinese channel and topic are never answered, but Discord scam checks still run there | Scam links went unblocked there until 2026-09-01. Answers stay English-only. |
| `/check-permissions` is not registered | It was registered by accident and visible to everyone; removed from `COMMANDS` 2026-08-18, handler kept. |
| `/tgkick` kicks once, then drops the user to watch mode | They can rejoin; harmful messages are still deleted. |
| Telegram has no proactive scam blocking for first-time offenders | Only watched users are moderated. A known gap (flagged 2026-08-18), not yet decided. |

## Tried and removed

| What | Why it went |
|---|---|
| linkedom for parsing HTML | Ran out of memory (exit code 9) on large pages; replaced by jsdom. |
| Sending the whole knowledge base on every call (`loadKnowledgeBase`) | Replaced by RAG — far cheaper and more relevant. `knowledge-loader.js` remains only for `getSourceFiles()`. |
| `looksLikeQuestion()` | Replaced by Haiku intent classification; removed in the 2026-06-01 cleanup. |
| One monolithic `bot.js` (~1,713 lines) | Split into modules on 2026-05-16, moved into `src/` on 2026-06-01. |
| `/doc` subcommands | Folded into `/sync type:Doc`; manual doc adds use `!add-doc-text`. |
| Per-file hand-written "QUICK REFERENCE" line tables and `module-index.json` | Drifted out of date; replaced 2026-10-28 by the generated Contents blocks, `CODE_INDEX.md` and the CLAUDE.md task table. |
