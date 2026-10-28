# scripts/ — One-Shot Diagnostic Utilities

These are run manually from the terminal, not by the bot itself.

## Files

| File | How to run | Purpose |
|---|---|---|
| `check-perms.js` | `node scripts/check-perms.js` | Checks View / Read History / Send Messages / Embed Links for every channel ID configured in `.env`. Useful after server permission changes. Currently not registered as a slash command — enable by adding it to `COMMANDS` in `src/slash-commands.js`. |
