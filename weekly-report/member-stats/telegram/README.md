# telegram/

Telegram member join/leave tracker. Receives `chat_member` Telegram updates (forwarded from `telegram-adapter.js`) and logs every join/leave to `tg-member-log.jsonl`.

## Files

| File | Purpose |
|---|---|
| `tg-member-stats.js` | Log writer + stats functions |
| `tg-member-log.jsonl` | Auto-appended join/leave log (gitignored, never commit) |

## Log record format

```json
{ "ts": "2026-06-01T12:00:00.000Z", "type": "join", "userId": 987654321, "username": "bob", "chatId": "-1002060657220" }
```

## Requirements

The bot must be an **admin** in the Telegram group. Telegram only delivers `chat_member` updates to admin bots. Without admin status, join/leave events will never arrive and this log will remain empty.

`allowedUpdates: ['message', 'chat_member']` must be set in `bot.launch()` — already configured in `telegram/telegram-adapter.js`.

## Exports

- `logTgMemberEvent(type, user, chatId)` — called by `telegram-adapter.js` on each join/leave event
- `getTgMemberStats(from, to)` — returns `{ joins, leaves }` for a date range
