# River Protocol AI Helper (RiverAiHelper)

At the start of every session, read **only the Quick Reference section** of `CONTEXT.md` (lines 1–75). That covers active state, the full file map, key timers, and top pending items — enough context for most tasks.

For specific section details (Answer Flow, Intent System, Scam Detection, etc.), navigate on demand: grep for the `## Section Name` in CONTEXT.md to get the line number, then `Read(offset=N, limit=80)` for only that section. Do not read the entire file.

For targeted work on a specific feature, check `module-index.json` first. Look up the relevant topic(s) in the `topics` map — it lists exactly which files to read. Only read those files; do not scan the entire `src/` folder.

---

## Hard conventions

- **`clientReady` not `ready`** — discord.js v14 typed event. Deliberately changed; do NOT revert.
- **`node-fetch` import** — v3 is ESM-only in a CJS project. Always use `const fetch = (await import('node-fetch')).default`. Never `require('node-fetch')`.
- **Cloudflare WARP** — must be enabled for `docs.riverai.inc` and `blog.riverai.inc`. If scraping fails with 403, check WARP before debugging code.
- **Official domain — `riverai.inc`** — the project migrated off `river.inc` on 2026-09-04. `river.inc` and all its subdomains (`app.`, `docs.`, `blog.`, `gov.`) are retired; the bot must only ever share `riverai.inc` links. `river.inc` is kept only in `core-facts.md` so the bot can redirect users who report the old domain as unreachable. Never reintroduce a `river.inc` link into code, prompts, or sync URLs.
- **URL formatting** — wrap in angle brackets: `<https://example.com>`. Never markdown `[text](url)`. Exception: `https://discord.com/channels/...` links must NOT be wrapped — Discord renders these as native channel jump links and wrapping breaks them.
- **`effectiveSinceDate`** — only advances when blog posts are deleted from disk. Never recalculate on a normal sync (old bug that caused posts to be wrongly skipped).
- **Blog sync lastmod verification** — `syncBlog` (`src/kb-sync.js`) does NOT trust sitemap `<lastmod>` alone; it cross-checks against `fetchPublishMeta()` (`src/blog-scraper.js`, reads `article:published_time`/`modified_time`). This isn't optional robustness to simplify away — a site redeploy has already been observed bumping `lastmod` on ~40 unchanged posts with zero content change. Don't remove the check or the `knowledge-base/blogs/_excluded-legacy.json` registry it maintains.
- **Testnet wording** — `core-facts.md` must say "River had a testnet in the past but it is no longer active." Never revert to "there is no testnet and never has been one."
- **GitHub / commits** — never mention committing, pushing, or GitHub unless the user explicitly asks.

## Scope rules

- `_dev-notes/` is the user's private folder. Only ever update `_dev-notes/Bot commands.txt`. Never touch any other file in `_dev-notes/` unless explicitly named by the user.
