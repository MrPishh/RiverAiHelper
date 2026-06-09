# member-stats/

Tracks server member joins and leaves for both Discord and Telegram. Each platform has its own subfolder with its own log file and stats module. Both use an identical interface.

## Structure

```
member-stats/
  discord/
    discord-member-stats.js  ← Event listener + stats functions
    member-log.jsonl         ← Auto-appended join/leave log (gitignored)
  telegram/
    tg-member-stats.js       ← Log writer + stats functions
    tg-member-log.jsonl      ← Auto-appended join/leave log (gitignored)
```

## Log format (both platforms)

One JSON record per line:

```json
{ "ts": "2026-06-01T12:00:00.000Z", "type": "join", "userId": "123456", "username": "alice", "guildId": "..." }
```

`type` is either `"join"` or `"leave"`.

## Shared interface

Both modules export a `getMemberStats(from, to)` function that takes two `Date` objects and returns `{ joins, leaves }` — count of join and leave events within that range.

| Export | Discord | Telegram |
|---|---|---|
| `getMemberStats(from, to)` | ✅ | ✅ |
| `getWeeklyStats()` | ✅ (wrapper for Mon–Sun week) | ✗ |
| `registerMemberEvents(client)` | ✅ (call at startup) | ✗ (triggered by Telegraf `chat_member` event) |
| `logTgMemberEvent(type, user, chatId)` | ✗ | ✅ (called from telegram-adapter.js) |

## Requirements

- **Discord**: No special requirements — `guildMemberAdd` and `guildMemberRemove` events fire for any bot in the server.
- **Telegram**: The bot must be an **admin** in the group. Telegram only sends `chat_member` updates to admin bots. Also requires `allowedUpdates: ['message', 'chat_member']` in the Telegraf `bot.launch()` call (already set in `telegram-adapter.js`).
