# discord/

Discord join/leave tracker: registers the gateway events at start-up and logs every join and leave.

## Files

| File | What it owns |
|---|---|
| `discord-member-stats.js` | Event registration and counting. |
| `member-log.jsonl` | Join/leave log (local only, never commit). |

## How it works

`registerMemberEvents(client)` is called once from `bot.js` inside `clientReady`; no other setup is needed. Each event appends:

```json
{ "ts": "2026-06-01T12:00:00.000Z", "type": "join", "userId": "1234567890", "username": "alice", "guildId": "1212686319596216350" }
```

Exports:

- `registerMemberEvents(client)` — attach the listeners.
- `getMemberStats(from, to)` — `{ joins, leaves }` for a date range.
- `getWeeklyStats()` — the same for the last complete Mon–Sun week.
- `getWeekRange()` / `getDayRange()` — re-exported from `src/utils.js`.

## Notes

- Counts only events since logging began; it does not read Discord's history.
