# Governance Knowledge Base — Curation Context

Source: https://gov.riverai.inc/c/proposal-lab/5
Last curated: 2026-05-10
Domain migrated from gov.river.inc to gov.riverai.inc on 2026-09-04 — old domain retired.

---

## What this folder contains

Only the **first/main post** from each governance topic. Reply posts and discussion threads are excluded — only the proposal or official update from River is kept.

---

## Curated files — DO NOT overwrite on sync

These 17 files have been deliberately curated, ordered, and deduplicated. Future syncs must not overwrite or re-scrape them. They tell the story of River's mechanism evolution in narrative order.

### Narrative order (chronological story)

**1. The market event that triggered everything**
- `river-s-actions-and-follow-up-on-the-recent-market-event.md` — topic ID 9 (2025-11-11)
  Market manipulation attack (Nov 7-9), why conversion was suspended, next steps.

**2. Countermeasure 1 — The Buyback response**
- `the-countermeasure-1-the-buyback.md` — topic ID 10 (2025-11-11)
  Full BNB buyback plan for Public Sale participants. Buyback price, eligibility, timeline.
- `the-countermeasure-1-2-buyback-list-update.md` — topic ID 11 (2025-11-11)
  Finalized eligible addresses and amounts. Buyback list published.
- `the-countermeasure-1-3-buyback-execution.md` — topic ID 13 (2025-11-12)
  Official buyback address, deadline (Nov 20), verification process.
- `the-countermeasure-1-4-public-sale-buyback-completed.md` — topic ID 56 (2025-11-24)
  Completion notice. Buyback at 0.0000447 BNB per River Pt done.

**3. Countermeasure 2 — Conversion mechanism redesign**
- `the-countermeasure-2-smart-vault-conversion-mechanism-preliminary-update.md` — topic ID 12 (2025-11-11)
  First outline of upgrade directions: extended window, dynamic ratio, daily cap.
- `the-countermeasure-2-1-conversion-mechanism-upgrade-progress.md` — topic ID 15 (2025-11-14)
  Four core upgrade components defined: daily cap, per-conversion limit, dynamic curve, Staked RIVER.
- `the-countermeasure-2-2-simulation-overview.md` — topic ID 18 (2025-11-16)
  Simulation comparing original vs integral model using real historical data.
- `the-countermeasure-2-3-conversion-mechanism-formula-specification.md` — topic ID 25 (2025-11-18)
  Full mathematical specification: marginal rate formula, integral, half-life recovery, execution flow.
- `the-countermeasure-2-4-simulation-update.md` — topic ID 41 (2025-11-20)
  Updated simulation with refined parameters and improved charts.
- `the-countermeasure-2-5-conversion-2-0-upgrade-parameters.md` — topic ID 58 (2025-11-26)
  Draft consolidation of all Conversion 2.0 parameters. Open for community feedback.

**4. Governance — community input call**
- `governance-update-community-directions-requested.md` — topic ID 69 (2025-11-28)
  Pause in conversion. Community asked for concrete proposals with execution plans.

**5. River Staking system**
- `river-staking-mechanism-overview.md` — topic ID 85 (2025-12-01)
  High-level: staking epochs (3/6/9/12 months), voting power, early unstake, governance weight.
- `river-staking-parameters-for-activation.md` — topic ID 147 (2025-12-08)
  Technical parameters: epoch multipliers (1x–8x), voting power formula, weekly emission rates.

**6. Conversion activations — final specs**
- `conversion-2-0-activation.md` — topic ID 151 (2025-12-11)
  Full Conversion 2.0 spec: integral curve, daily cap, half-life recovery, staking output.
- `conversion-reshare-adjustment.md` — topic ID 167 (2026-02-28)
  Reshare structure update: 3-month 40%, 6-month 75%, 9-month 87.5%, 12-month 100%.
- `conversion-3-0-activation.md` — topic ID 185 (2026-05-08)
  Current mechanism. Seasonal model, S5 ideal rate 0.01, 8 staking epochs (3–24 months).

---

## Excluded topics — DO NOT re-scrape

These topic IDs were reviewed and deliberately excluded. Do not add them back on future syncs.

| Topic ID | Title | Reason excluded |
|---|---|---|
| 8 | About the Proposal Lab category | Meta/navigation only |
| 14 | The Countermeasure 3: Community AMA | AMA event announcement |
| 16 | The Countermeasure 3.1: EN Community AMA | AMA event announcement |
| 19 | The Countermeasure 3.2: Korean Community AMA | AMA event announcement |

---

## Future sync instructions

When syncing this governance source:
1. Fetch topics from https://gov.riverai.inc/c/proposal-lab/5.json
2. Skip any topic ID already in the curated list above (IDs: 9, 10, 11, 13, 56, 12, 15, 18, 25, 41, 58, 69, 85, 147, 151, 167, 185)
3. Skip any topic ID in the excluded list (IDs: 8, 14, 16, 19)
4. For any NEW topic ID not in either list: scrape first post only, review before adding
5. Never overwrite existing curated files
