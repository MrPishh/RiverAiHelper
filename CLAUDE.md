# River Protocol AI Helper (RiverAiHelper)

Read `CONTEXT.md` at the start of every session before doing any work.

For targeted work on a specific feature, check `module-index.json` first. Look up the relevant topic(s) in the `topics` map — it lists exactly which files to read. Only read those files; do not scan the entire `src/` folder.

---

## Hard conventions

- **`clientReady` not `ready`** — discord.js v14 typed event. Deliberately changed; do NOT revert.
- **`node-fetch` import** — v3 is ESM-only in a CJS project. Always use `const fetch = (await import('node-fetch')).default`. Never `require('node-fetch')`.
- **Cloudflare WARP** — must be enabled for `docs.river.inc` and `blog.river.inc`. If scraping fails with 403, check WARP before debugging code.
- **URL formatting** — wrap in angle brackets: `<https://example.com>`. Never markdown `[text](url)`. Exception: `https://discord.com/channels/...` links must NOT be wrapped — Discord renders these as native channel jump links and wrapping breaks them.
- **`effectiveSinceDate`** — only advances when blog posts are deleted from disk. Never recalculate on a normal sync (old bug that caused posts to be wrongly skipped).
- **Testnet wording** — `core-facts.md` must say "River had a testnet in the past but it is no longer active." Never revert to "there is no testnet and never has been one."
- **GitHub / commits** — never mention committing, pushing, or GitHub unless the user explicitly asks.

## Scope rules

- `_dev-notes/` is the user's private folder. Only ever update `_dev-notes/Bot commands.txt`. Never touch any other file in `_dev-notes/` unless explicitly named by the user.
