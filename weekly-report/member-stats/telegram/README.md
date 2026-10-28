# telegram/

Telegram join/leave tracker: `telegram-adapter.js` passes each `chat_member` join or leave here, and it is logged and counted.

## Files

| File | What it owns |
|---|---|
| `tg-member-stats.js` | Log writer and counting. |
| `tg-member-log.jsonl` | Join/leave log (local only, never commit). |

## How it works

Each event appends:

```json
{ "ts": "2026-06-01T12:00:00.000Z", "type": "join", "userId": 987654321, "username": "bob", "chatId": "-1002060657220" }
```

Exports:

- `logTgMemberEvent(type, user, chatId)` — called by `telegram-adapter.js` on each join or leave.
- `getTgMemberStats(from, to)` — `{ joins, leaves }` for a date range.

A user rejoining while on the moderation list is handled by the adapter (ban / kick / mute) and is not logged as a join.

## Notes

- The bot must be a group **admin** — Telegram delivers `chat_member` updates only to admin bots. Without it this log stays empty.
- `chat_member` must be in `allowedUpdates` in `bot.launch()` — already set in `telegram/telegram-adapter.js`.
