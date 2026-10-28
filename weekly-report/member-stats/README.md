# member-stats/

Logs member joins and leaves for Discord and Telegram and counts them for any date range. Each platform has its own subfolder, log file and module, with the same counting interface.

## Files

```
member-stats/
  discord/
    discord-member-stats.js  ← Event listener + counting
    member-log.jsonl         ← Join/leave log (local only)
  telegram/
    tg-member-stats.js       ← Log writer + counting
    tg-member-log.jsonl      ← Join/leave log (local only)
```

## How it works

One JSON record per line:

```json
{ "ts": "2026-06-01T12:00:00.000Z", "type": "join", "userId": "123456", "username": "alice", "guildId": "..." }
```

`type` is `"join"` or `"leave"` (Telegram records have `chatId` instead of `guildId`).

| Export | Discord | Telegram |
|---|---|---|
| `getMemberStats(from, to)` / `getTgMemberStats(from, to)` | ✅ | ✅ |
| `getWeeklyStats()` — last complete Mon–Sun week | ✅ | ✗ |
| `registerMemberEvents(client)` — call once at start-up | ✅ | ✗ (the Telegram adapter's `chat_member` handler instead) |
| `logTgMemberEvent(type, user, chatId)` — called by the adapter | ✗ | ✅ |

Both counting functions take two `Date`s and return `{ joins, leaves }`.

## Notes

- **Discord:** no special setup — `guildMemberAdd` / `guildMemberRemove` fire for any bot with the GuildMembers intent.
- **Telegram:** the bot must be a group admin (Telegram sends `chat_member` updates only to admin bots), and `chat_member` must be in `allowedUpdates` (already set in `telegram-adapter.js`).
