# intent/

Every user message that reaches the bot is classified into one of 15 intent categories before the bot decides whether to respond. This folder holds that system's rulebook, reference notes, utility scripts and the local logs.

## Files

| File | What it holds |
|---|---|
| `intent-taxonomy.md` | The classification rulebook — all 15 categories, descriptions, real examples, context rules and edge cases. **Read it before changing classification.** The batch-audit script sends it to the model word for word. |
| `theory-notes.md` | Notes on the theory behind the system (Speech Act Theory, SDT, Bayesian, Control / Queuing / Decision Theory). Use it to pick the right framework when the logs show a recurring failure. |
| `fetch-messages.js` | Utility: prints a Discord channel's human messages since a date as JSON. Run: `node intent/fetch-messages.js <channel-id>`. |
| `backfill-chinese.js` | One-time utility (already run) that backfilled the Chinese channel into `dc-intent-log.jsonl`. Run: `node intent/backfill-chinese.js`. |
| `dc-intent-log.jsonl` | Local log of every Discord user message plus a `{ type: "classified" }` record per classified message, joined by message ID. |
| `tg-intent-log.jsonl` | The same for Telegram. |
| `ticket-log.jsonl` | Non-staff messages from support-ticket channels: `{ platform, ts, id, channelId, channel, authorId, author, content }`. Not classified when written — the whole thread is read at report time. |
| `collab-log.jsonl` | The same for collab / business-inquiry channels. Reserved for a future Business Proposals report section. |

## How it works

1. A message arrives in #general, #support or a Telegram answer topic.
2. Haiku classifies it using the channel, what it replies to, and the last 3 messages as context.
3. Only 4 categories get an answer: `help-seeking`, `troubleshooting`, `onboarding`, `factual-question`.
4. Everything is logged; the bot stays silent for the rest.

## Notes

- The `*.jsonl` logs are **local only** (ignored by git) — they contain community members' messages. Never commit them.
- **Log rotation:** add monthly rotation when any log reaches about 5 MB. Check sizes with `ls -lh intent/*.jsonl`.
- **Batch audits:** a one-time Sonnet review of all classifications ran on 2026-08-18 (`scripts/intent-batch-audit/`, see `CONTEXT.md` § Pending / Discussed But Not Done).
