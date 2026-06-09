# community-report/

Reads intent logs and uses Claude Haiku to generate a structured community report. Supports weekly (Mon–Sun) and daily (today) modes for Discord, Telegram, or both.

## How it works

1. Date range is calculated based on `reportType` — `'weekly'` uses the most recently completed Mon–Sun week, `'daily'` uses today midnight to now
2. Reads `intent/dc-intent-log.jsonl` (Discord) and/or `intent/tg-intent-log.jsonl` (Telegram) — filters to user messages only (no staff, no bots, no classified records)
3. Groups messages into sections: Discord General, Discord Support, Discord Support Tickets, Telegram, Discord Chinese Channel, Telegram Chinese Topic
4. Chinese sections are only included if `CHINESE_DISCORD_CHANNEL_ID` / `CHINESE_TELEGRAM_TOPIC_ID` are set in `.env` and have messages in the period
5. If no messages found → posts a "no messages" notice to the reports channel
6. Sends all sections to Claude Haiku with a prompt requesting three sections: Common Problems, FAQs, Conversation Highlights. If Chinese messages are present, the prompt instructs Claude to analyse them but write the entire report in English
7. Posts the formatted report to the Discord channel in `REPORTS_CHANNEL_ID`

## Report format

```
**Weekly Community Report (Both)** — 26 May to 1 Jun 2026
*(203 Discord + 14 Tickets + 51 Telegram + 18 Chinese (Discord) + 9 Chinese (Telegram) messages analysed)*

**Common Problems**
• ...

**Frequently Asked Questions**
• ...

**Conversation Highlights**
• ...
```

Chinese-channel content is input only — Claude synthesises insights from it into the same three sections. There is no separate Chinese section in the output.

If no Chinese channels are configured, the count line shows only the channels that exist:
```
*(150 Discord + 12 Tickets + 43 Telegram messages analysed)*
```

## Weekly report cache

Weekly reports are cached in `report-cache.json` keyed by `platform::model::from::to` (plus `::cn` suffix when Chinese channels are configured). Repeat runs with the same parameters return instantly with no API call. Cache entries expire after 14 days.

Daily reports are never cached.

## Exported functions

```js
generateCommunityReport(discordClient, {
    GENERAL_CHANNEL_ID,
    SUPPORT_CHANNEL_ID,
    REPORTS_CHANNEL_ID,
    CHINESE_DISCORD_CHANNEL_ID,   // optional — omit to exclude Chinese Discord
    CHINESE_TELEGRAM_TOPIC_ID,    // optional — omit to exclude Chinese Telegram
    anthropic,
    platform,    // 'discord' | 'telegram' | 'both'
    reportType,  // 'weekly' | 'daily'
    model,       // MODEL_HAIKU | MODEL_SONNET
})

buildCommunityReport(anthropic, {
    GENERAL_CHANNEL_ID,
    SUPPORT_CHANNEL_ID,
    CHINESE_DISCORD_CHANNEL_ID,   // optional
    CHINESE_TELEGRAM_TOPIC_ID,    // optional
    platform,
    reportType,
    model,
})
// Returns: { text, dc, tg, tickets, dcChinese, tgChinese, from, to, totalMessages, fromCache }
```

`generateCommunityReport` wraps `buildCommunityReport` and posts the result to Discord. `buildCommunityReport` is used directly by the Telegram staff panel (DM → /start → Report).

Both are called via wrappers in `bot.js` which inject the config — `commands.js` and `slash-commands.js` only pass `platform`, `reportType`, and `model`.

## Date range logic

- **Weekly**: finds the most recently completed Sunday (if today is Sunday, range ends today). Goes back 6 days to find the Monday. So running on any day of the week always gives you the last complete Mon–Sun block.
- **Daily**: today from 00:00:00 to 23:59:59.

Both use `getWeekRange()` and `getDayRange()` from `src/utils.js`.
