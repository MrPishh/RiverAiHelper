# Docs Knowledge Base — Curation Context

Source: docs.river.inc
Last curated: 2026-05-10

---

## Purpose of this folder

Official product documentation — how things work, step-by-step guides, contract addresses, oracle specs, audit reports. This is the most authoritative source for product mechanics and technical details.

Docs are scraped from docs.river.inc and represent the current state of the official documentation. When a doc conflicts with a blog or governance post, the doc takes precedence unless a corrections file explicitly overrides it.

---

## Known issues

**`intro-faq.md`** — Contains references to the old domain `blog.satoshiprotocol.org` and some Satoshi Protocol era framing. These are outdated links but the Q&A content itself is still largely valid. Do not remove the file — the FAQ structure is useful. If scraping a fresh version, the links should be updated.

**`intro-publish-your-docs.md`** — Excluded from RAG (EXCLUDE markers applied). This is the docs mission statement page, fully covered by `docs/index.md` and `announcements/ecosystem-milestones.md`.

---

## Currently excluded files

| File | Reason |
|---|---|
| `intro-publish-your-docs.md` | Mission statement only — content covered by `index.md` and announcements |

---

## Key relationships to other folders

- **Corrections folder** overrides docs where content is outdated (e.g., River4FUN staking removed, conversion mechanism versions)
- **Governance folder** provides the official decision record for mechanism parameters — use governance as the source for WHY something works a certain way
- **Blogs** provide the user-facing narrative for features documented here

---

## Sync configuration (stored in `_index.json`)

| Field | Value | Meaning |
|---|---|---|
| `sitemapUrl` | `https://docs.river.inc/sitemap-pages.xml` | Where `/sync doc` reads the page list from |
| `configuredSinceDate` | — | No date floor. All pages in the sitemap are scraped regardless of publish date |
| `excluded` | — | No URL-level exclusion list for docs. Unlike blogs, there is no `/exclude-doc` command. To skip a doc page, apply `<!-- EXCLUDE -->` markers inside the file instead |

---

## Future sync instructions

When scraping updated docs from docs.river.inc:
1. Always overwrite existing doc files — docs are the live authoritative source
2. After sync, check if any corrections files are now outdated (i.e., if the main doc has been updated to reflect what the correction was fixing)
3. Check `outro-deployed-contracts-*.md` files after any new chain integration announcement — new chain deployments will need a new file
4. Do not auto-exclude any doc file — flag to editor for review first
