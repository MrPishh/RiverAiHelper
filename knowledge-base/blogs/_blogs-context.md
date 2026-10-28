# Blogs Knowledge Base — Curation Context

Source: blog.riverai.inc
Last curated: 2026-05-10
Domain migrated from blog.river.inc to blog.riverai.inc on 2026-09-04 — old domain retired.

---

## Purpose of this folder

Blog posts serve a different purpose from governance docs and official docs. They are the user-facing, narrative layer — announcement context, accessible explanations, and the story of how the project evolved. They complement governance and docs rather than duplicate them.

**A blog and a governance doc covering the same topic are not duplicates.** The governance doc is the authoritative technical spec; the blog is the announcement narrative and accessible explanation. Both help the RAG system match different query styles.

---

## Exclusion philosophy

Only exclude a blog if:
1. It is a language duplicate of an English file (Chinese/Korean variants)
2. It contains only time-sensitive campaign mechanics (forms, deadlines, prize tiers) — those belong in channel-learning Q&A
3. The content is purely market price data that the bot should not reference
4. A clearly better version of the same perspective exists elsewhere in the KB

Do NOT exclude a blog just because a governance doc covers the same topic. Both serve the knowledge graph.

---

## Currently excluded files (EXCLUDE markers applied)

| File | Reason |
|---|---|
| `river-follow-up-2.md` | Chinese language duplicate of `rivers-actions-and-follow-up.md` |
| `river-action-follow-up-ch.md` | Chinese language duplicate (variant) |
| `river-together-4m-river-pts.md` | Expired Oct 2025 campaign — time-sensitive mechanics only |
| `2026-new-year-challenge.md` | Expired Jan 2026 contest — time-sensitive mechanics only |
| `s4-best-creators.md` | Expired S4 campaign — time-sensitive mechanics only |
| `dynamic-airdrop-conversion-2.md` | Market price snapshot blog — bot should not reference historical prices; mechanism already covered in main blog |
| `dynamic-airdrop-conversion-3.md` | Same as above |

| `introducing-river-smart-vault.md` | Whole-file since 2026-10-29 — Smart Vault deposits are closed (see `corrections/smart-vault-deposits-closed.md`) |
| `smart-vault-2.md` | Same as above |
| `river-s3-airdrop.md` | Whole-file since 2026-10-29 — past season (S3) campaign |
| `season2-airdrop-is-live.md` | Whole-file since 2026-10-29 — past season (S2) campaign |
| `riverpts-public-sale-50m.md` | Whole-file since 2026-10-29 — outdated price figures (see `corrections/riverpts-pricing.md`) |
| `river4fun-earn-by-staking-and-sharing.md` | Whole-file since 2026-10-29 — removed River4FUN features (see `corrections/river4fun-outdated-features.md`) |

Partial exclusion: `river-dynamic-airdrop-conversion.md` — an 18-line section (restored 2026-10-29 from git).

Note: `dynamic-airdrop-conversion-2.md` and `dynamic-airdrop-conversion-3.md` also had partial EXCLUDE markers on rate tables from a previous session; the full-file exclusion covers those.

**History (2026-10-29):** the 2026-09-04 domain resync re-added only an opening marker to rewritten files, which hid nothing, so the 5 whole-file exclusions above it and the partial one quietly came back into answers. The six files added above carried such a lone marker too, but had no record here; they were made whole-file exclusions because each is superseded by a correction or is a past-season campaign. Remove the markers from any of them to bring it back. The sync now re-applies whole-file and partial markers correctly (`reapplyExclusions` in `src/kb-sync.js`), and an unclosed marker hides to the end of the file.

---

## Key overlaps to be aware of

**Conversion mechanism** — Multiple blogs + governance docs cover this. The corrections file `corrections/conversion-mechanism.md` is the authoritative operational reference for current (3.0) parameters. Blogs provide the narrative layer.

**Staking** — `river-staking-activation.md` describes the original 4-epoch system (3/6/9/12 months). Conversion 3.0 expanded this to 8 epochs (3–24 months). The corrections file has current parameters. The blog provides historical context for users with stakes from Dec 2025 onward.

**Market event / buyback** — `rivers-actions-and-follow-up.md` (English blog) covers the Nov 2025 crisis. The governance countermeasure series covers the same events from an operational/decision perspective. Both serve different angles.

**Brand upgrade** — River was previously Satoshi Protocol. $SAT stablecoin became satUSD. $RIVER is the governance token launched at TGE. See `announcements/ecosystem-milestones.md` for the full brand upgrade context.

---

## Sync configuration (stored in `_index.json`)

| Field | Value | Meaning |
|---|---|---|
| `sitemapUrl` | `https://blog.riverai.inc/sitemap-posts.xml` | Where `/sync blog` reads the post list from |
| `configuredSinceDate` | `2025-05-15` | Permanent floor — never scrape posts published before this date (River blog launch date). Hard-coded in `bot.js` as `BLOG_SINCE_DATE`. |
| `effectiveSinceDate` | auto-managed | Starts equal to `configuredSinceDate`. Advances automatically to the oldest remaining post's date whenever posts are physically deleted from disk. Prevents re-scraping of intentionally removed content. |
| `excluded` | URL list | Managed by `/exclude-blog url:<url>` / `/include-blog url:<url>`. Posts on this list are permanently skipped on all future syncs even if they appear in the sitemap. Distinct from `<!-- EXCLUDE -->` markers — the exclusion list prevents re-scraping; markers only strip content from RAG. |

---

## Future sync instructions

When scraping new blogs from blog.riverai.inc:
1. Add new files normally — do not auto-exclude
2. Check if the blog introduces new products, features, or events not yet in KB
3. If a blog is a Chinese/Korean translation of an existing English blog, apply EXCLUDE
4. If a blog is purely a campaign announcement (contest, giveaway, voting round) with no lasting operational info, apply EXCLUDE and log in channel-learning if users are likely to ask follow-up questions
5. Update this file with any new exclusion decisions
