# discord/

Discord member join/leave tracker. Registers Discord gateway events at startup and logs every join/leave to `member-log.jsonl`.

## Files

| File | Purpose |
|---|---|
| `discord-member-stats.js` | Event registration + stats functions |
| `member-log.jsonl` | Auto-appended join/leave log (gitignored, never commit) |

## Log record format

```json
{ "ts": "2026-06-01T12:00:00.000Z", "type": "join", "userId": "1234567890", "username": "alice", "guildId": "1212686319596216350" }
```

## Setup

`registerMemberEvents(client)` is called once in `bot.js` inside `clientReady`. No additional config needed.

## Exports

- `registerMemberEvents(client)` — attach event listeners to Discord client
- `getMemberStats(from, to)` — returns `{ joins, leaves }` for a date range
- `getWeeklyStats()` — convenience wrapper, returns stats for the current Mon–Sun week
- `getWeekRange()` / `getDayRange()` — date range helpers (also exported from `src/utils.js`)
