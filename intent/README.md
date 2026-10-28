# Intent Classification

Every user message that reaches the bot is classified into one of 15 intent categories before the bot decides whether and how to respond. This folder contains the logs, taxonomy, and supporting files for that system.

## Files

| File | Purpose |
|---|---|
| `dc-intent-log.jsonl` | Live log of every Discord user message + its classified intent. Two record types per message: raw log record and a `{ type: "classified" }` record. Joinable by message ID. |
| `tg-intent-log.jsonl` | Same structure as above, for Telegram messages. |
| `ticket-log.jsonl` | Non-staff messages from support ticket category channels (`SUPPORT_TICKET_CATEGORY_IDS`). Records: `{ platform, ts, id, channelId, channel, authorId, author, content }`. No classification at write time — full thread classification happens at report time. |
| `collab-log.jsonl` | Non-staff messages from collab/business inquiry channels (`COLLAB_CATEGORY_IDS`). Same record format as `ticket-log.jsonl`. Reserved for a future Business Proposals report section. |
| `intent-taxonomy.md` | The classification rulebook — all 15 categories, descriptions, real examples, context override rules, and edge cases. **Read this before changing classification behaviour.** |
| `theory-notes.md` | Reference notes on the theoretical frameworks behind the system (Speech Act Theory, SDT, Bayesian, Control/Queuing/Decision Theory). Consult when the intent log shows a recurring failure pattern — it maps failure types to the right framework. |
| `fetch-messages.js` | Utility script to pull historical messages from a Discord channel via REST API. Run with `node intent/fetch-messages.js <channel-id>`. Outputs JSON to stdout. |
| `backfill-chinese.js` | One-time utility to backfill historical Chinese channel messages into `dc-intent-log.jsonl`. Run with `node intent/backfill-chinese.js`. |

## How classification works

1. Message arrives in `#general` or `#support`
2. Claude Haiku classifies it into one of 15 categories using channel, reply context, and recent thread as signals
3. Only 4 categories trigger a bot response: `help-seeking`, `troubleshooting`, `onboarding`, `factual-question`
4. All others are logged but the bot stays silent

## Logs note

`*.jsonl` files are excluded from git (`.gitignore`). They contain live community message data and grow continuously. Review them locally for intent analysis — never commit them.

**Log rotation:** Implement monthly rotation when any `.jsonl` file hits ~5 MB. Check sizes: `ls -lh intent/*.jsonl`

**Batch analysis reminder:** After 2–4 weeks of traffic, run both jsonl files through the Anthropic Batch API for 50% cost savings. See CONTEXT.md pending items for the full workflow.
