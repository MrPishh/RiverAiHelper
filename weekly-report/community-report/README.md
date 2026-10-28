# community-report/

Builds a community report from the intent logs with Claude — weekly (last Mon–Sun) or daily (today), for Discord, Telegram or both.

## Files

| File | What it owns |
|---|---|
| `community-report.js` | Reads the logs, builds the prompt, calls Claude, caches and posts the report. |
| `report-cache.json` | Report cache, 14 days (local only — never edit by hand). |

## How it works

1. The period comes from `reportType`: `'weekly'` = the most recent complete Mon–Sun week (ending today if today is Sunday); `'daily'` = today, 00:00:00–23:59:59. Both use `getWeekRange()` / `getDayRange()` from `src/utils.js`.
2. Unless `force` is set, a cached report for the same platform, model and period is returned straight away.
3. It reads `intent/dc-intent-log.jsonl` and/or `intent/tg-intent-log.jsonl` plus `intent/ticket-log.jsonl`, keeping only non-staff user messages (each cut to 280 characters, private keys redacted).
4. Messages are grouped into sections: Discord General, Discord Support, Discord Support Tickets (grouped by ticket), Telegram, Discord Chinese Channel, Telegram Chinese Topic. Chinese sections appear only when configured and non-empty.
5. With no messages, Discord gets a "no messages" notice.
6. Claude (Haiku by default, `max_tokens` 800) writes three sections — Common Problems, Frequently Asked Questions, Conversation Highlights — always in English. Routine scam spam is left out; only unusual incidents are flagged.
7. The result is cached and posted to `REPORTS_CHANNEL_ID` (or returned to the Telegram panel).

### Report format

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

Chinese messages feed the same three sections — there is no separate Chinese section in the output. Without Chinese channels the count line shows only what exists, e.g. `*(150 Discord + 12 Tickets + 43 Telegram messages analysed)*`. A cached report adds "— cached".

### Exported functions

```js
generateCommunityReport(discordClient, {
    GENERAL_CHANNEL_ID, SUPPORT_CHANNEL_ID, REPORTS_CHANNEL_ID,
    CHINESE_DISCORD_CHANNEL_ID,   // optional
    CHINESE_TELEGRAM_TOPIC_ID,    // optional
    anthropic,
    platform,    // 'discord' | 'telegram' | 'both'
    reportType,  // 'weekly' | 'daily'
    model,       // MODEL_HAIKU | MODEL_SONNET
    force,       // true = bypass the cache
})

buildCommunityReport(anthropic, {
    GENERAL_CHANNEL_ID, SUPPORT_CHANNEL_ID,
    CHINESE_DISCORD_CHANNEL_ID, CHINESE_TELEGRAM_TOPIC_ID,
    platform, reportType, model, force,
})
// Returns: { text, dc, tg, tickets, dcChinese, tgChinese, from, to, totalMessages, fromCache }
```

`generateCommunityReport` wraps `buildCommunityReport` and posts to Discord. The Telegram staff panel calls `buildCommunityReport` directly. Both are called through wrappers in `bot.js` that add the config, so `slash-commands.js` and the Telegram adapter pass only platform, report type, model and force.

## Notes

- `readCollabMessages()` reads `intent/collab-log.jsonl` but is not used yet — it is reserved for a future Business Proposals section (classify each collab thread with one Haiku call at report time).
