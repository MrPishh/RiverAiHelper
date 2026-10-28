# Privacy Policy — RiverAiHelper (Discord Bot)

*Last updated: June 12, 2026*

## Overview

RiverAiHelper is a private AI-powered support bot operating exclusively within the River Protocol Discord server. It is not publicly distributed and cannot be added to other servers.

---

## Data Collected

The bot collects the following data from Discord's API:

| Data | Source | Purpose |
|---|---|---|
| Message content | Discord messages in configured channels | Intent classification, generating AI support answers, scam detection |
| Discord user ID | Message author | Scam infraction tracking, identifying repeat offenders |
| Display name | Message author | Staff impersonation detection |
| Channel ID | Message metadata | Logging and reporting |
| Timestamp | Message metadata | Logging and reporting |
| Member join/leave events | Guild member events | Aggregate community statistics |

---

## How Data Is Used

- **Support answers** — Message content is sent to Anthropic's Claude API (real-time inference only) and Voyage AI (semantic search) to generate answers to user questions. Neither service retains this data for training purposes under standard API terms.
- **Scam detection** — Messages are screened for known scam patterns. Flagged messages result in an infraction record keyed to the offending user's Discord ID.
- **Community reporting** — Aggregated and anonymised data from intent logs and member events is used to generate weekly/daily server health reports for server administrators.
- **Q&A learning** — Staff replies to user questions are saved locally as Q&A pairs to improve future bot responses.

---

## Data Storage

All data is stored locally on a private, access-controlled server operated by the bot owner. Data is encrypted at rest. No data is sold, shared with third parties, or used to train any machine learning or AI models.

### Retention

| Data | Retention period |
|---|---|
| Scammer infraction records | Indefinite (required for repeat-offender detection) |
| Intent classification logs | Indefinite (used for ongoing accuracy review) |
| Member join/leave log | Indefinite (used for long-term community statistics) |
| Q&A learning pairs | Indefinite (used to improve bot responses) |

---

## User Rights

Users may request review or deletion of their data by contacting a server moderator or administrator in the River Protocol Discord server. Administrators can immediately remove any user's scammer record using the `/scam-record clear` bot command.

---

## Scope

This policy applies only to the River Protocol Discord server. The bot is not available for installation on any other server.

---

## Changes

This policy may be updated at any time. The *Last updated* date above will reflect any changes.
