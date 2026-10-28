# scripts/

Scripts run by hand from the terminal — the bot never loads them.

## Files

| File | How to run | What it does |
|---|---|---|
| `check-perms.js` | `node scripts/check-perms.js` | Checks View / Read History / Send / Embed Links in every channel configured in `.env`, plus the scam blocker's guild-level permissions. Useful after permission changes. (The same report exists as the unregistered `/check-permissions` slash command.) |
| `intent-batch-audit/prepare-and-submit.js` | `node scripts/intent-batch-audit/prepare-and-submit.js` | One-time audit, step 1: joins every classified message from both intent logs and submits them to the Anthropic Batch API for a Sonnet review. Writes `messages.json` and `batch-id.txt`. |
| `intent-batch-audit/analyze-results.js` | `node scripts/intent-batch-audit/analyze-results.js` | Step 2, after the batch has ended: tallies the verdicts per category and writes `results-summary.json`. |
| `build-index.js` | `npm run index` (`:check`, `:watch`) | Generates the Contents blocks, `CODE_INDEX.md` and doc section lists, and checks the docs against the code. Reads files as text only — never loads a bot module. See CLAUDE.md § Generated parts and checks. |
| `index-hook.js` | Claude Code, after each edit | Rebuilds the generated parts when an indexed file changes. |
| `stop-hook.js` | Claude Code, when a turn ends | Runs the drift check; if docs drifted, sends Claude back once to fix them. |

## How it works

Each bot script reads `.env` from the project root itself and runs to completion; none of them change the bot's state. The index builder reads `.env` for setting **names** only, never values.

## Notes

- The batch-audit outputs (`messages.json`, `batch-id.txt`, `results-summary.json`) contain community messages and are local only (ignored by git).
- The audit ran on 2026-08-18; results are summarised in `CONTEXT.md`.
