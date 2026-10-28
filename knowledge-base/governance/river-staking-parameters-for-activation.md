# Governance: River Staking Parameters for Activation
Source: https://gov.riverai.inc/t/river-staking-parameters-for-activation/147
Scraped: 2026-05-10T01:04:06.682Z

---

River Staking is moving into the activation phase.

This topic provides a technical summary of the mechanism and the parameters that define how staking behaves on-chain. It serves as a clear reference before the module goes live and ensures the operational details are understood as intended.

Staking establishes the system’s long-term participation structure.

The parameters below describe how epochs, multipliers, and reward emission function together within the staking mechanism.

### [](#p-285-h-1-functional-overview-1)1\. Functional Overview

Staking converts RIVER into a non-transferable staking position recorded as Staked RIVER.  
This position captures three elements:

*   the amount committed
*   the selected staking epoch
*   the multiplier applied to that epoch

These values determine the address’s Voting Power, which is used for Governance participation and for allocating rewards during the staking period.

### [](#p-285-h-2-duration-and-multiplier-structure-2)2\. Duration and Multiplier Structure

Staking is built on predefined epochs, each with a fixed multiplier. These values determine governance weight and reward weight for the duration of the chosen period.

Epoch

Multiplier

3 Months

1x

6 Months

2x

9 Months

4x

12 Months

8x

Voting power = staked amount × multiplier

This straightforward formulation ensures that:

*   longer commitments receive proportionally higher influence
*   the relationship between epoch and weight is transparent
*   the system can interpret long-term alignment consistently

### [](#p-285-h-3-representation-of-staked-river-3)3\. Representation of Staked RIVER

Staked RIVER is a non-transferable position tied to the staking address.It is not a tradable asset and does not circulate. Its purpose is to:

*   record the committed amount
*   apply the multiplier
*   define your Voting Power
*   Staked RIVER for the selected epoch

This provides a deterministic record of each user’s commitment for both Governance and reward calculations.

### [](#p-285-h-4-reward-emission-and-allocation-4)4\. Reward Emission and Allocation

Rewards emission during the staking epoch take the form of River Pts.

Distribution is based on each address’s Voting Power relative to the total Voting Power of all participants in the same duration.

reward share = your voting power / total voting power in the epoch

Emission schedule (variable, updated weekly)

Epoch

Weekly Emission

3 months

42,000 River Pts

6 months

84,000 River Pts

9 months

168,000 River Pts

12 months

336,000 River Pts

Weekly emission ensures predictable reward output. Distribution adjusts based on the actual participation within each epoch.

APR shown in the interface reflects:

*   Total staked per duration
*   Weekly Emission
*   River Pts price
*   RIVER price

APR updates continuously as participation and price inputs change.

### [](#p-285-h-5-system-level-effects-5)5\. System-Level Effects

The staking module is designed to introduce long term structural improvements to the protocol.

### [](#p-285-governance-signal-quality-6)Governance signal quality

Longer commitments receive proportionally higher multipliers.

This makes Governance outcomes more representative by weighting influence toward participants with higher and clearer alignment over time.

### [](#p-285-reward-efficiency-7)Reward efficiency

Reward allocation follows Voting Power. Participants who commit for longer epochs receive a larger share of the reward flow.

### [](#p-285-participation-stability-8)Participation stability

Fixed epochs combined with a linear exit curve reduce short term cycling and create more predictable participation patterns.

Together these effects form the basis for a more reliable environment as the protocol continues to expand its mechanisms.

### [](#p-285-h-6-activation-process-9)6\. Activation Process

The staking module is prepared for deployment. The parameters in this post reflect the structure that will be used at launch. Before activation, the team will complete standard checks on the interface and parameter configuration to ensure the module behaves as described.

This post serves as the technical reference for the parameters and on chain logic governing the staking mechanism.

If any part of the structure requires clarification or further detail, questions can be raised here so the entire community shares a consistent understanding as staking moves toward activation.