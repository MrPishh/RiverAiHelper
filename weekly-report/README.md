# weekly-report/

Automated reporting system for community activity. Generates reports from intent logs and tracks server member join/leave events. All features are triggered by staff commands — nothing runs automatically.

> **Navigation:** `community-report/community-report.js` has a QUICK REFERENCE block at the top with all function names and line numbers — read lines 1–30 to navigate without loading the full 385-line file.

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
| `/report period:week platform: aimodel: force:` | Generate weekly community report (Mon–Sun) → posts to `REPORTS_CHANNEL_ID` |
| `/report period:day platform: aimodel: force:` | Generate daily community report (today) → posts to `REPORTS_CHANNEL_ID` |

`aimodel` picks Haiku (default) or Sonnet. `force` (optional, default off) bypasses the cache described below and regenerates even if this exact period/platform/model was already reported.

Staff can also trigger the same report generation from the Telegram DM staff panel (`/start` → 📊 Community Report → period → platform → model, with a second "🔄 force" button row) — it calls the same `buildCommunityReport()` and shares the same cache described below, so a report already generated from Discord is reused from Telegram (and vice versa) as long as the platform/model/period match.

## How reports are generated

1. Staff runs `/report period:week` (Discord) or walks the Telegram DM panel
2. `community-report.js` reads `intent/dc-intent-log.jsonl`, `intent/tg-intent-log.jsonl`, and `intent/ticket-log.jsonl` for the selected date range
3. Filters to user messages only (no staff, no bots) from `#general`, `#support`, support ticket channels, the Chinese Discord channel, and the Chinese Telegram topic
4. Sends messages to Claude Haiku (or Sonnet, if selected) with a prompt asking for three sections: Common Problems, FAQs, Conversation Highlights. If Chinese-channel messages are present, Claude is instructed to analyse them but write the report in English
5. Posts the formatted report to the Discord channel set in `REPORTS_CHANNEL_ID`, or replies in the Telegram DM, depending on where it was triggered

Chinese channels are opt-in — set `CHINESE_DISCORD_CHANNEL_ID` and/or `CHINESE_TELEGRAM_TOPIC_ID` in `.env` to include them. If both are unset the report behaves exactly as before.

**Caching:** both daily and weekly reports are cached in `report-cache.json`, keyed by `platform::model::fromDate::toDate` (plus `::cn` when Chinese channels are configured), for 14 days. A repeat request with the same parameters — from either platform — returns instantly with no API call, unless `force:true` is passed.

## How member stats work

- Discord: `registerMemberEvents(client)` is called at startup and listens for `guildMemberAdd` / `guildMemberRemove` events. Every join/leave is appended to `member-stats/discord/member-log.jsonl`.
- Telegram: The bot's `chat_member` Telegram update (requires bot to be admin) fires on join/leave. Events are appended to `member-stats/telegram/tg-member-log.jsonl`.
- Both use the same `getMemberStats(from, to)` pattern — pass a date range, get `{ joins, leaves }`.
