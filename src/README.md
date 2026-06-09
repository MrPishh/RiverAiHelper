# src/ — Core Bot Modules

All bot logic lives here. `bot.js` in the root wires these modules together — none of these files are entry points on their own.

## Module Map

### Message Handling & Responses
| File | Purpose |
|---|---|
| `commands.js` | `messageCreate` Discord event handler + `!add-blog-text` / `!add-doc-text` (attachment-only text commands). Includes ticket/collab early-return gate (logs to jsonl, never responds) and `takeScamAction` (delete + 1h timeout + alert embed when scam-blocker is ON). |
| `slash-commands.js` | All `/slash` command definitions and interaction handler |
| `claude.js` | Claude Sonnet calls — RAG search, prompt building, conversation state, scam detection |
| `intent.js` | Intent classification via Claude Haiku — 15 categories, logs every message to `intent/` |

### Knowledge Base Management
| File | Purpose |
|---|---|
| `rag.js` | Semantic search engine — chunks MD files, embeds via Voyage AI, cosine similarity search |
| `kb-sync.js` | Blog and docs sync from sitemaps, KB index management, usage tracking |
| `kb-monitor.js` | Passive health checks — correction staleness detection, announcement auto-scan |
| `knowledge-loader.js` | Legacy loader — `getSourceFiles()` only, used by explanation embeds |
| `blog-scraper.js` | Web scraper — jsdom → Readability → Turndown Markdown |
| `embedder.js` | Voyage AI embedding provider — swap via `EMBEDDING_PROVIDER` in `.env` |

### Infrastructure & Utilities
| File | Purpose |
|---|---|
| `state.js` | Shared Maps and timing constants — single object shared across all modules |
| `utils.js` | Pure helpers — date ranges, Discord helpers, Q&A learning, folder utilities |
| `toggles.js` | Bot feature toggles — Discord replies, Telegram replies, Scam Blocker. Persisted to `toggles.json`. Controlled via `/toggle platform:<key>`. |

## Path convention

Every file here uses:
```js
const ROOT_DIR = path.join(__dirname, '..');
```
to reference root-level folders (`knowledge-base/`, `channel-learning/`, `intent/`, etc.). Never use bare `__dirname` for paths outside this folder.

## Key dependencies

```
bot.js (root)
  └── src/state.js          ← no local requires
  └── src/embedder.js       ← no local requires
  └── src/toggles.js        ← no local requires
  └── src/knowledge-loader.js
  └── src/blog-scraper.js
  └── src/rag.js            ← requires embedder
  └── src/utils.js
  └── src/intent.js
  └── src/kb-sync.js        ← requires blog-scraper, utils
  └── src/kb-monitor.js
  └── src/claude.js         ← requires state
  └── src/commands.js       ← requires toggles
  └── src/slash-commands.js ← requires toggles
```
