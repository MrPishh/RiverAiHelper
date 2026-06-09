# Knowledge Base

All content used by the bot to answer questions via RAG (Retrieval-Augmented Generation). At startup, every `.md` file here is chunked, embedded via Voyage AI, and indexed for semantic search. Only the most relevant chunks are sent to Claude per question.

## Structure

```
knowledge-base/
  core-facts.md              ← Injected into every Claude call regardless of RAG results
  docs/                      ← Scraped River Protocol documentation pages
  blogs/                     ← Scraped River Protocol blog posts (May 2025 onwards)
  governance/                ← Curated governance forum posts
  announcements/             ← Curated announcement summaries + raw weekly files
  tweets/                    ← Raw saved tweets (excluded from RAG)
  corrections/               ← Staff-written corrections that outrank docs and blogs in RAG
  .embeddings-cache.json     ← Cached Voyage AI embeddings (auto-generated, do not edit or commit)
```

Each subfolder has its own `_context.md` or `_*-context.md` file explaining curation rules, what's included, what's excluded, and sync behaviour. **Read the relevant context file before editing a subfolder.**

## Content priority in RAG

| Source | Boost | Notes |
|---|---|---|
| `corrections/` | 1.3× | Overrides conflicting docs/blogs — always use for factual corrections |
| `blogs/` | 1.1× | Slightly preferred over raw docs |
| `announcements/` | 1.1× | Curated files only — raw `*_ann/` subfolders excluded from indexing |
| `docs/` | 1.0× | No boost |
| `governance/` | 1.0× | No boost |
| `channel-learning/` | 1.0× | No boost |

Use corrections to override outdated or conflicting doc content — they will surface above docs/blogs for topically related queries.

## Key rules

- **`<!-- EXCLUDE -->...<!-- /EXCLUDE -->`** — wrap any section in these markers to strip it from RAG without deleting the file. Files with these markers are protected from `/sync doc force:true` overwrites.
- **`.embeddings-cache.json`** — never edit or commit this file. It is rebuilt automatically when content changes.
- **`raw` folders** (`May_ann/`, `May_tweet/`) — auto-saved raw content, excluded from RAG. Use curated files in the parent folder instead.

## Sync commands

| Command | What it does |
|---|---|
| `/sync-knowledge` | Reload core facts + rebuild full RAG index |
| `/sync blog` | Pull new/updated blog posts from sitemap |
| `/sync doc` | Pull new/removed doc pages from sitemap |
| `/sync doc force:true` | Force re-scrape all doc pages |
| `/add-correction slug:<slug>` | Add or update a correction file |
