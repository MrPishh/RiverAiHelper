# telegram/

The Telegram bot for River Protocol support. It mirrors the Discord bot — same intent classification, same answer flow, same staff-wait logic — and adds a staff DM panel and a moderation system.

## Files

| File | What it owns |
|---|---|
| `telegram-adapter.js` | The whole Telegram bot (Telegraf): message routing, staff detection, staff-wait timers, the DM panel, moderation, join/leave tracking. |

## How it works

### Answering

- **Scenarios** as on Discord: 0 (reply to a CLARIFY question), 0.5 (reply to a bot answer, intent-gated), 1 (@mention), 3 (unprompted, intent-gated, after the staff wait). There is no Scenario 2.
- **Staff = group admins.** The admin list is fetched from Telegram and cached for 10 minutes.
- **Staff suppression** works as on Discord: a 3-minute hard block after staff engage a user, then a 3-minute wait instead of 5 for 20 minutes.
- **Topics:** the bot answers only in `TELEGRAM_TOPIC_IDS`. The forum's "General" topic arrives without a topic ID; it is treated as topic 1. The topic in `CHINESE_TELEGRAM_TOPIC_ID` is logged for reports but never answered.
- **Toggle:** `/toggle platform:Telegram` turns replies on or off.

### Message sanitising (`sanitizeForTelegram`)

Claude writes Discord-style text, even for Telegram (and a cached report may have been generated for Discord). `sanitizeForTelegram()` converts it for Telegram's HTML parse mode — every send that uses it must pass `{ parse_mode: 'HTML' }`:

- `**bold**` becomes real Telegram bold (`<b>…</b>`). `*italic*` is left as plain text (a much noisier pattern to match safely).
- `&`, `<` and `>` are escaped so they can't break the `<b>` tags.
- `<https://url>` becomes a plain URL.
- `<#channelId>` becomes a Discord link, `https://discord.com/channels/GUILD_ID/channelId` — members go straight to the channel; others see the server's join prompt.
- Three or more newlines collapse to two.

Fixed, hand-written replies (moderation confirmations, alert DMs) don't go through it — they contain no markdown. `GUILD_ID` is hard-coded at the top of `telegram-adapter.js`; update it if the Discord server changes.

### Staff DM panel

An admin DMs the bot `/start` (or taps the persistent ≡ Menu button) to get two buttons:

- **Community Report** — period → platform → model (with "force" buttons that bypass the cache). The report is sent in the DM, not to Discord. It shares its cache with Discord's `/report` (see `weekly-report/README.md`).
- **Member Stats** — period → platform; join/leave counts and member totals.

### Moderation

Moderated users are stored in `data/tg-perma-ban.json` (local only), keyed by user ID, and survive restarts. Each entry holds `userId`, `username`, `reason`, `mode`, `bannedAt`, `rejoinCount` and `lastRejoin`. Commands are DM-only and listed in `docs/REFERENCE.md` § Commands.

| Mode | Behaviour |
|---|---|
| `watch` | The user stays. Every message is classified; harmful ones (scam, abuse, or clear FUD) are deleted and admins get an alert DM. |
| `mute` | The user cannot send messages. Re-applied on every rejoin and whenever a captcha bot restores their permissions. |
| `kick` | Kicked once — now, or on their next join — then dropped to watch mode. |
| `ban` | Banned now and on every rejoin attempt; messages revoked. |

Escalation: `/tgwatch` → `/tgmute` → `/tgkick` → `/tgban`. De-escalation: `/tgunwatch` (remove), `/tgunmute` and `/tgunkick` (→ watch), `/tgunban` (remove and unban).

**Alert DM** sent to subscribed admins (`/tgalerts on`; if nobody has subscribed, every admin) when a watched user's message is deleted:

```
🚨 Watched user alert
User: @username (or ID 12345678)
Detected as: scam-content  ← or "fud/negative sentiment"

Deleted message:
"<first 400 characters of the message>"

Action taken: message deleted.

To report to Telegram: tg://user?id=12345678
(Open that link → tap ⋮ → Report)
```

Each deletion is also logged to `data/tg-watch-log.jsonl` as evidence.

**FUD check (`checkWatchedFUD` in `src/intent.js`):** a second Haiku check for watched users' messages that weren't already scam or abuse. Deliberately lenient — it flags only messages that clearly call the project a rug pull or scam, urge others to sell, or declare it dead. Frustration, skeptical questions and price comments pass. Returns "not harmful" on any API error.

**Known gap:** Telegram has no proactive scam blocking for first-time offenders — only watched users are moderated (see `docs/DECISIONS.md`).

## Notes

- The bot must be a group **admin** for join/leave tracking, admin detection and moderation.
- It launches with `allowedUpdates: ['message', 'chat_member', 'callback_query']` — without `chat_member`, Telegram sends no join/leave or permission-change events.
- Join/leave events are logged to `weekly-report/member-stats/telegram/tg-member-log.jsonl`.

Required settings (details in `docs/REFERENCE.md` § Settings): `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `TELEGRAM_TOPIC_IDS`, and optionally `CHINESE_TELEGRAM_TOPIC_ID`.
