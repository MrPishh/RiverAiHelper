# Reference

Lookup tables for the running bot: settings, commands, events, scheduled jobs, timers and npm scripts. Each table is the one place that fact is written down; other docs link here.

For where each item lives in the code (exact lines), see `CODE_INDEX.md`.

## Settings

Read from `.env` in the project root (copy `.env.example` to start). Never commit `.env` — it holds secrets. "Current value" shows the live, non-secret IDs as of 2026-09; secrets are never written here.

| Setting | Required | What it does | Current value |
|---|---|---|---|
| `DISCORD_TOKEN` | yes | Bot token from the Discord Developer Portal. | *(secret)* |
| `ANTHROPIC_API_KEY` | yes | API key for Claude (Anthropic). | *(secret)* |
| `VOYAGE_API_KEY` | yes | API key for Voyage AI (RAG embeddings). | *(secret)* |
| `EMBEDDING_PROVIDER` | no | Embedding provider; only `voyage` is supported (the default). | `voyage` |
| `ANNOUNCEMENTS_CHANNEL_ID` | yes | Messages here are saved to the knowledge base as raw announcements. | `1213030463040655410` |
| `TWEETS_CHANNEL_ID` | yes | Messages here are saved to the knowledge base as raw tweets. | `1212717389104414750` |
| `GENERAL_CHANNEL_ID` | yes | #general — logged for intent analysis and reports; Q&A pairs are learned from staff replies. | `1212717429319540790` |
| `SUPPORT_CHANNEL_ID` | yes | #support — same as general; also the channel staff-ping replies point to. | `1212717485862944818` |
| `BOT_ANSWER_CHANNEL_IDS` | yes | Comma-separated channels where the bot auto-answers unprompted (Scenario 3). @mentions work anywhere. | `1212717429319540790,1212717485862944818,1502041137119105054` |
| `STAFF_EXPLANATION_CHANNEL_ID` | yes | Where staff explanation embeds are posted. | `1502041137119105054` |
| `STAFF_ROLE_IDS` | yes | Comma-separated role IDs that count as staff. | `1212718739808845835` |
| `STAFF_WAIT_MINUTES` | no | Minutes to wait for a staff reply before auto-answering (default 5). | `5` |
| `REPORTS_CHANNEL_ID` | yes | Where `/report` posts community reports. | `1502056590004715530` |
| `SUPPORT_TICKET_CATEGORY_IDS` | no | Comma-separated support-ticket category IDs. Ticket channels are created per ticket; non-staff messages are logged to `intent/ticket-log.jsonl`, never answered. | `1212753951578005644,1419608088297865286` |
| `COLLAB_CATEGORY_IDS` | no | Comma-separated collab / business-inquiry category IDs. Logged to `intent/collab-log.jsonl`; not in reports yet. | *(empty)* |
| `SCAM_LOG_CHANNEL_ID` | no | Where the scam blocker posts alert embeds. The bot needs Send Messages there. | `1212717191955480667` |
| `CHINESE_DISCORD_CHANNEL_ID` | no | Chinese community channel — logged for reports and scam-checked, never answered. | *(empty)* |
| `TELEGRAM_BOT_TOKEN` | no | Bot token from BotFather. Without it the Telegram bot is disabled. | *(secret)* |
| `TELEGRAM_CHAT_ID` | with Telegram | Telegram group ID (a negative number). | `-1002060657220` |
| `TELEGRAM_TOPIC_IDS` | with Telegram | Comma-separated topic IDs the bot answers in (1 = General, 62 = Support, 229775 = River). | `1,62,229775` |
| `CHINESE_TELEGRAM_TOPIC_ID` | no | Chinese community topic — logged for reports, never answered. | *(empty)* |

## Commands

Every command is staff-only (Discord: a role in `STAFF_ROLE_IDS`; Telegram: a group admin). `/check-permissions` has a handler but is deliberately not registered with Discord; to enable it, add its definition back to `COMMANDS` in `src/slash-commands.js`.

| Command | Where | What it does |
|---|---|---|
| `/sync type:Knowledge` | Discord | Reloads `core-facts.md`, scans new announcements for facts (see CONTEXT.md § KB Monitor) and rebuilds the RAG index. |
| `/sync type:Blog` | Discord | Pulls new and changed posts from the blog sitemap (lastmod cross-checked), flags corrections the new posts may outdate, then drafts proposed updates in the background. |
| `/sync type:Doc [force:true]` | Discord | Pulls new and removed pages from the docs sitemap; `force` re-scrapes every page (files with `<!-- EXCLUDE -->` markers are skipped). Same correction check as Blog. |
| `/blog action:Add url:<url>` | Discord | Scrapes one post into `knowledge-base/blogs/<Month>_blog/articleN.md` and rebuilds the index. |
| `/blog action:Exclude url:<url>` | Discord | Deletes the post from the KB and skips it on every future blog sync. |
| `/blog action:Include url:<url>` | Discord | Removes the URL from the exclusion list; the next blog sync re-scrapes it. |
| `/add-correction slug:<slug> [text:] [file:]` | Discord | Adds or updates `knowledge-base/corrections/<slug>.md` (text or an attached .md/.txt). Corrections outrank docs and blogs in RAG. |
| `/toggle platform:<Discord\|Telegram\|Scam Blocker\|Show current status>` | Discord | Turns auto-replies or the scam blocker on/off (persisted), or shows all three states. |
| `/scam-record action:View user:<user>` | Discord | Shows a user's infractions (last 10): reason, channel, message, actions taken. |
| `/scam-record action:List` | Discord | Lists every user in the scammer record, most infractions first. |
| `/scam-record action:Clear user:<user> [count:-N]` | Discord | Clears all of a user's infractions, or only the N most recent with a negative count. |
| `/report period:<week\|day> platform:<both\|discord\|telegram> [aimodel:] [force:]` | Discord | Generates a community report and posts it to `REPORTS_CHANNEL_ID`. Haiku by default; `force` bypasses the 14-day cache. |
| `/member-stats period:<week\|day> [platform:]` | Discord | Member counts plus joins and leaves for the period. |
| `/usage-stats` | Discord | Claude API calls, tokens and estimated cost — all-time and the last 3 months. |
| `/check-permissions` | Discord (not registered) | Shows the bot's permissions in every configured channel. Same report as `node scripts/check-perms.js`. |
| `!add-blog-text <url>` + attached file | Discord | Manual blog add for pages that cannot be scraped (e.g. Cloudflare): attach .md, .html or .txt (the MarkDownload browser extension makes .md). |
| `!add-doc-text <url>` + attached file | Discord | Same, for a docs page (`knowledge-base/docs/<slug>.md`). |
| @bot + a Discord message link | Discord | Posts an explanation embed to the staff channel: question, answer and the KB sources used. Not a slash command. |
| `/start` | Telegram DM | Opens the staff panel (Community Report / Member Stats buttons). A persistent ≡ Menu button also opens it. |
| `/tgwatch <userId> [reason]` | Telegram DM | Watch mode: the user stays; harmful messages (scam, abuse, FUD) are deleted and admins alerted. |
| `/tgmute <userId> [reason]` | Telegram DM | Permanent mute — re-applied on every rejoin and after a captcha bot unlocks the user. |
| `/tgkick <userId> [reason]` | Telegram DM | Kicks once (now, or on the next join if not in the group), then drops to watch mode. |
| `/tgban <userId> [reason]` | Telegram DM | Banned now and on every rejoin attempt; messages revoked. |
| `/tgunwatch <userId>` | Telegram DM | Removes a watched user from the list entirely. |
| `/tgunmute <userId>` | Telegram DM | Lifts a permanent mute and drops to watch mode. |
| `/tgunkick <userId>` | Telegram DM | Drops a pending kick to watch mode. |
| `/tgunban <userId>` | Telegram DM | Removes the user from every list and unbans them. |
| `/tglist` | Telegram DM | Every user on the moderation list with mode, reason and rejoin count. |
| `/tgalerts [on\|off]` | Telegram DM | Subscribes to or unsubscribes from moderation alert DMs; with no argument shows the status. |

Telegram moderation commands are not registered publicly — an admin sends them to the bot in a private DM. The moderation store is `data/tg-perma-ban.json` (local only).

## Events

Event listeners the bot registers. `receiver.event` matches the code (`discordClient` is the bot's Discord client, `client` the one passed into a helper, `bot` the Telegraf bot).

| Event | File | What it does |
|---|---|---|
| `discordClient.clientReady` | `bot.js` | Start-up: core facts, RAG index, staff name cache, Telegram adapter, slash commands, cron jobs. |
| `discordClient.messageCreate` | `src/commands.js` | Every Discord message: logging, scam checks, staff text commands and answer routing. |
| `discordClient.interactionCreate` | `bot.js` | Slash commands (handler from `createSlashHandler`). |
| `discordClient.raw` | `bot.js` | Records gateway activity for the silence watchdog. |
| `discordClient.error` | `bot.js` | Logs client errors. |
| `discordClient.shardError` | `bot.js` | Logs shard errors. |
| `discordClient.shardDisconnect` | `bot.js` | Logs disconnects. |
| `discordClient.shardReconnecting` | `bot.js` | Logs reconnect attempts. |
| `discordClient.shardResume` | `bot.js` | Logs resumes. |
| `client.guildMemberAdd` | `weekly-report/member-stats/discord/discord-member-stats.js` | Logs a join. |
| `client.guildMemberRemove` | `weekly-report/member-stats/discord/discord-member-stats.js` | Logs a leave. |
| `client.clientReady` | `scripts/check-perms.js` | Runs the permission report, then exits (diagnostic script, not the bot). |
| `bot.message` | `telegram/telegram-adapter.js` | Every Telegram message: staff DM panel, watched users, answer routing. |
| `bot.callback_query` | `telegram/telegram-adapter.js` | Staff panel button presses. |
| `bot.chat_member` | `telegram/telegram-adapter.js` | Joins, leaves, and re-applying ban/kick/mute on rejoin. |
| `process.SIGTERM` | `bot.js` | Stops the Telegram bot cleanly. |
| `process.SIGINT` | `bot.js` | Stops the Telegram bot cleanly. |
| `stdin.data` | `scripts/index-hook.js` | Reads the Claude Code hook payload (tooling, not the bot). |
| `stdin.end` | `scripts/index-hook.js` | Rebuilds the index once the payload is read (tooling, not the bot). |

## Scheduled jobs

| Schedule (cron) | File | What it does |
|---|---|---|
| `0 * * * *` (hourly) | `bot.js` | Drops expired conversation, timer and tracker entries (`pruneStaleEntries`). |
| `0 0 */1 * *` (daily, midnight) | `bot.js` | Rebuilds the staff name cache for the spoof detector. |

There is also a 5-minute watchdog in `bot.js`: after 30 minutes with no Discord gateway event it exits so pm2 restarts the bot (see `docs/DECISIONS.md`).

## Timers

All timers are defined in `src/state.js` (only `STAFF_WAIT_MS` comes from `.env`). Every timer is keyed by `userId::channelId`, so another user in the same channel is never affected.

| Constant | Value | Used in | What it controls |
|---|---|---|---|
| `STAFF_WAIT_MS` | 5 min (`STAFF_WAIT_MINUTES`) | `commands.js`, `telegram-adapter.js` | How long the bot waits for a staff reply before auto-answering. |
| `STAFF_ENGAGED_WINDOW_MS` | 3 min | `commands.js`, `telegram-adapter.js` | Hard block after staff engage a user — by replying to them, or by posting any message while that user's auto-answer is pending. |
| `POST_STAFF_WAIT_MS` | 3 min | `commands.js`, `telegram-adapter.js` | Shorter wait for the same user once the hard block ends. |
| `POST_STAFF_CONTEXT_MS` | 20 min | `commands.js`, `telegram-adapter.js` | How long after staff engagement the shorter wait applies. |
| `CONV_EXPIRY_MS` | 30 min | `claude.js` | How long a conversation is kept for follow-ups. |
| `REPHRASE_WINDOW_MS` | 2 hours | `claude.js` | Window for counting answers to one user before escalating to a ticket. |
| `MAX_BOT_ANSWERS_BEFORE_TICKET` | 2 | `claude.js` | Complete answers (ANSWER or ESCALATE) before the bot sends the user to a ticket. |
| `COMMUNITY_DISC_WINDOW_MS` | 30 min | `commands.js`, `telegram-adapter.js` | How long a community-discussion message is kept as context. |

How the timers stack for one user after staff engagement:

1. 12:05 — staff reply to the user → `staffEngaged` set.
2. 12:07 — the user posts → hard-blocked (within 3 min), no timer started.
3. 12:09 — the user posts → block over → 3-minute wait instead of 5.
4. 12:30 — the user posts a new question → more than 20 min since staff engaged → the normal 5-minute wait.

## npm scripts

| Command | What it does |
|---|---|
| `npm start` | Runs the bot (`node bot.js`). In production pm2 runs `node bot.js` directly as `river-bot`. |
| `npm test` | Placeholder — there are no tests; it prints an error and exits. |
| `npm run index` | Rebuilds the generated Contents blocks, `CODE_INDEX.md` and doc section lists, then prints the drift report. |
| `npm run index:check` | Changes nothing; exits 1 if a generated part is stale or the docs have drifted from the code. |
| `npm run index:watch` | Rebuilds after every save. |

pm2 commands: `pm2 restart river-bot`, `pm2 logs river-bot`, `pm2 status`. After a reboot, a Windows Task Scheduler task (`PM2 Resurrect on Login`) runs `pm2 resurrect`; `pm2 startup` does not work on Windows.
