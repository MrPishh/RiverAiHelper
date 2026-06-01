# Tweets Knowledge Base — Curation Context

Last updated: 2026-05-10

---

## Current status

This folder currently contains only test files. No production tweet content has been indexed.

The `May_tweet/week2.md` file is a test file and has EXCLUDE markers applied.

---

## Decision on tweet indexing

Tweets mirror announcement channel content — River posts a tweet and then shares it in the announcements channel. Indexing both would create duplicates.

The decision was made NOT to index the tweets channel because:
1. Tweet content (280 chars) is too short to be useful as RAG chunks — low signal
2. Any tweet with substantive content (product launch, integration) has a corresponding blog post already indexed
3. Pure hype/milestone tweets ("$RIVER hits ATH") should not be referenced by the bot
4. The announcements channel captures the same content with body text added

**If this decision changes**, update this file and define a clear filter: only index tweets that contain information not in any blog, governance doc, or announcement.
