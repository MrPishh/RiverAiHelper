# Channel Learning

Auto-populated Q&A pairs learned from staff replies in Discord channels. Used as part of the RAG knowledge base.

## How it works

When a staff member replies to a user question in `#general` or `#support`, the bot saves the exchange as a Q&A pair. These pairs are indexed alongside docs, blogs, and corrections so future similar questions benefit from real staff answers.

## Structure

```
channel-learning/
  general/
    qa-log.md    ← Q&A pairs learned from staff replies in #general
  support/
    qa-log.md    ← Q&A pairs learned from staff replies in #support
```

## Notes

- Files are auto-appended by the bot — do not edit manually
- Indexed in RAG at startup via `buildIndex()`
- Quality depends on staff reply quality — vague or incorrect staff replies will be learned too
- If a bad pair is saved, edit `qa-log.md` directly and run `/sync-knowledge` to rebuild the index
