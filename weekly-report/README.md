# weekly-report/

Community reports and member join/leave stats. Reports are made on request by staff — nothing runs on a schedule.

## Files

| Folder | What it owns |
|---|---|
| `community-report/` | Reads the intent logs, asks Claude to summarise them, posts or returns the report — see `community-report/README.md`. |
| `member-stats/` | Logs Discord and Telegram joins and leaves and counts them — see `member-stats/README.md`. |

## How it works

### Commands that use it

| Command | What it does |
|---|---|
| `/report period:week platform: [aimodel:] [force:]` | Weekly community report (last complete Mon–Sun) → `REPORTS_CHANNEL_ID`. |
| `/report period:day platform: [aimodel:] [force:]` | Daily report (today) → `REPORTS_CHANNEL_ID`. |
| `/member-stats period: [platform:]` | Member counts plus joins and leaves for the period. |

`aimodel` picks Haiku (default) or Sonnet. `force` bypasses the cache and regenerates.

The Telegram staff panel (`/start` → Community Report → period → platform → model, or a "force" button) calls the same report builder and shares the same cache, so a report already made on Discord is reused on Telegram and the other way round, as long as platform, model and period match.

### How a report is made

1. Staff run `/report` (Discord) or use the Telegram panel.
2. `community-report.js` reads `intent/dc-intent-log.jsonl`, `intent/tg-intent-log.jsonl` and `intent/ticket-log.jsonl` for the period.
3. It keeps non-staff messages from #general, #support, support tickets, Telegram, and — when configured — the Chinese Discord channel and Telegram topic.
4. Claude writes three sections: Common Problems, Frequently Asked Questions, Conversation Highlights. Chinese messages are analysed but the report is always in English.
5. The report is posted to `REPORTS_CHANNEL_ID`, or sent in the Telegram DM.

Chinese channels are opt-in: set `CHINESE_DISCORD_CHANNEL_ID` and/or `CHINESE_TELEGRAM_TOPIC_ID`.

**Caching:** daily and weekly reports are cached in `community-report/report-cache.json` (local only) for 14 days, keyed by `platform::model::from::to` (plus `::cn` when Chinese channels are configured). A repeat request returns instantly with no API call unless `force` is set.

### How member stats work

- **Discord:** `registerMemberEvents(client)` runs at start-up and logs every `guildMemberAdd` / `guildMemberRemove` to `member-stats/discord/member-log.jsonl`.
- **Telegram:** the adapter's `chat_member` handler (bot must be admin) logs to `member-stats/telegram/tg-member-log.jsonl`.
- Both count with the same pattern — pass a date range, get `{ joins, leaves }`.

## Notes

- All logs and the report cache are local only (ignored by git).
