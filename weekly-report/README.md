# weekly-report/

Automated reporting system for community activity. Generates reports from intent logs and tracks server member join/leave events. All features are triggered by staff commands — nothing runs automatically.

## Structure

```
weekly-report/
  member-stats/
    discord/    ← Logs Discord join/leave events, provides stats functions
    telegram/   ← Logs Telegram join/leave events, provides stats functions
  community-report/
    community-report.js  ← Reads intent logs, asks Haiku to summarise, posts to reports channel
```

## Staff commands that use this module

| Command | What it does |
|---|---|
| `/member-stats period: platform:` | Show member counts + join/leave for a period (week/day) and platform |
| `/report period:week platform:` | Generate weekly community report (Mon–Sun) → posts to `REPORTS_CHANNEL_ID` |
| `/report period:day platform:` | Generate daily community report (today) → posts to `REPORTS_CHANNEL_ID` |

## How reports are generated

1. Staff runs `/report period:week`
2. `community-report.js` reads `intent/dc-intent-log.jsonl`, `intent/tg-intent-log.jsonl`, and `intent/ticket-log.jsonl` for the selected date range
3. Filters to user messages only (no staff, no bots) from `#general`, `#support`, support ticket channels, the Chinese Discord channel, and the Chinese Telegram topic
4. Sends messages to Claude Haiku with a prompt asking for three sections: Common Problems, FAQs, Conversation Highlights. If Chinese-channel messages are present, Claude is instructed to analyse them but write the report in English
5. Posts the formatted report to the Discord channel set in `REPORTS_CHANNEL_ID`

Chinese channels are opt-in — set `CHINESE_DISCORD_CHANNEL_ID` and/or `CHINESE_TELEGRAM_TOPIC_ID` in `.env` to include them. If both are unset the report behaves exactly as before.

## How member stats work

- Discord: `registerMemberEvents(client)` is called at startup and listens for `guildMemberAdd` / `guildMemberRemove` events. Every join/leave is appended to `member-stats/discord/member-log.jsonl`.
- Telegram: The bot's `chat_member` Telegram update (requires bot to be admin) fires on join/leave. Events are appended to `member-stats/telegram/tg-member-log.jsonl`.
- Both use the same `getMemberStats(from, to)` pattern — pass a date range, get `{ joins, leaves }`.
