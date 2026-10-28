# Governance: Conversion 3.0 Activation
Source: https://gov.riverai.inc/t/conversion-3-0-activation/185
Scraped: 2026-05-10T01:04:01.464Z

---

> Dynamic Airdrop Conversion 3.0 is live.  
> Conversion 3.0 is the first seasonal incentive model to balance contributions and sustain tokenomics.

Dynamic Airdrop Conversion has been River’s core mechanism for distributing $RIVER to contributors since TGE.

Conversion 1.0 introduced the concept of Dynamic Airdrop Conversion to reward long-term contributors.

Conversion 2.0 added the dynamic conversion activity that adjusted the rate against real participation. Together they ran for two Seasons and converted 650M River Pts.

Conversion 3.0 builds on the concept from 1.0 and the dynamic conversion activity from 2.0, extending into a model that balances three sides: ecosystem incentives, long-term contribution, and sustainable tokenomic.

Where earlier versions ran on a single closing window, 3.0 makes distribution recurring. Conversion runs every Season, alongside the people building with River. The mechanism focuses on four things:

*   Recurring Seasons aligned to each quarter
*   Per-Season ideal rate that resets at a level the network can support
*   Unlock schedule and staking epoch anchored to each Season
*   Expanded set of eight staking epochs, from 3 to 24 months

Conversion 3.0 is live as of May 8, 2026. This post documents the mechanism in full for community reference.

S5 (April 22 - June 30, 2026) is the first Season under Conversion 3.0. From S6 onward, every Season runs a full quarter aligned to the calendar.

* * *

## [](#p-332-h-0-before-you-read-1)0\. Before You Read

Conversion 3.0 uses a per-Season ideal rate together with the dynamic conversion curve from 2.0.

The ideal rate is set at the start of each Season as a constant and stays unchanged across the window.

The actual rate updates every block via the dynamic curve and may differ from the ideal rate.

Before converting, always check:

*   The actual rate
*   The remaining daily cap
*   Slippage setting to protect minimum received RIVER
*   Selected staking epoch and corresponding reshare

Final output is determined strictly by the actual rate at execution, not the ideal rate.

**Q: What is the Season schedule?**

*   S5: April 22 - June 30, 2026 (transitional)
*   S6: July 1 - September 30, 2026 (Q3, first full quarter Season)
*   S7: October 1 - December 31, 2026 (Q4)
*   S8: January 1 - March 31, 2027 (Q1)

From S6 onward each Season aligns to a full quarter. There is no gap between Seasons.

**Q: What happens to River Pts earned in earlier Seasons?**

River Pts earned in any Season remain claimable and convertible in subsequent Seasons.

**Q: Does this change the total $RIVER allocation?**

No. TGE allocated 1B River Pts convertible into 30M $RIVER (30% of total supply).

Conversion 1.0 and 2.0 together converted 650M River Pts. The remaining 350M River Pts enter 3.0 against the same 30M $RIVER cap.

**Q: Does this document relate to market pricing?**

No. This text describes the mechanism only.

* * *

## [](#p-332-h-1-seasonal-model-2)1\. Seasonal Model

The seasonal model is how Conversion 3.0 keeps ecosystem incentives and contribution in balance over time. Distribution does not resolve in one event. It runs across recurring Seasons, with each Season opening a fresh conversion window for contributors to claim and convert what they earned within that quarter.

What keeps this balance sustainable is how the ideal rate moves between Seasons. The conversion rate adjusts against growing network metrics every Season, so distribution scales with where the protocol actually is, not where it was at TGE. Each Season’s ideal rate resets at a level the network can support, which means incentives and contribution grow together rather than one outrunning the other.

Contributors who stay active across Seasons keep accruing River Pts and keep converting against actual rates, Season after Season.

### [](#p-332-h-11-season-structure-3)1.1 Season Structure

Each Season runs a full quarter, ending on the final day of the quarter, with the next Season starting the following day.

S5 (April 22 - June 30, 2026) is transitional and runs shorter than a full quarter because it follows the close of the Conversion 2.0 curve on April 22.

S6 (July 1 - September 30, 2026) is the first Season aligned to a full quarter, and the seasonal model holds from there.

### [](#p-332-h-12-season-anchored-unlock-4)1.2 Season-Anchored Unlock

Unlock dates anchor to Season boundaries rather than to individual conversion timing. The rule:

Conversion date + staking epoch → aligned forward to the next Season boundary.

Worked examples:

*   Convert on May 15 + 3-month staking epoch → Staked RIVER anchors to October 1, 2026
*   Convert on June 30 + 3-month staking epoch → Staked RIVER anchors to October 1, 2026

All participants who convert in the same Season under the same staking epoch unlock on the same date.

* * *

## [](#p-332-h-2-overview-of-conversion-30-5)2\. Overview of Conversion 3.0

The mechanism from 2.0 continues. Daily cap structure, integral curve, half-life recovery, and Staked RIVER output structure remain in place.

The seasonal model adds two structural elements: recurring Seasons aligned to each quarter and a per-Season ideal rate. Both anchor to the Season as the unit of incentive design. Staking epochs expand from 4 tiers to 8, and daily cap reduces to 5M to reflect the smaller per-Season issuance under the seasonal model.

### [](#p-332-h-21-daily-conversion-cap-per-conversion-limit-6)2.1 Daily Conversion Cap & Per-Conversion Limit

*   Daily Conversion Cap: 5,000,000 River Pts per day
*   Per-Conversion Limit: 1,000,000 River Pts per conversion

The daily cap continues to prevent extreme single-day pressure that could distort rate behavior. The lower figure reflects the seasonal model and smaller per-Season issuance, which is materially below S2 and S3 levels.

The per-conversion limit ensures equal access to daily capacity and prevents single transactions from consuming an entire day of quota. Splitting transactions does not increase total output.

### [](#p-332-h-22-ideal-rate-and-actual-rate-7)2.2 Ideal Rate and Actual Rate

The ideal rate is anchored to the Season. It is set at the start of each Season as a constant and stays unchanged across the window. Time within the window is no longer an input to the ideal rate. The S5 ideal rate is 0.01.

The actual rate is the rate at execution. It is shaped by collective conversion density and floats around the ideal rate via the dynamic integral pricing inherited from 2.0.

This is where ecosystem incentives meet contribution behavior. The ideal rate sets what the protocol can sustainably distribute that Season. The actual rate reflects what contributors are actually doing, denser participation compresses it, quieter periods recover it. Output at any moment is the equilibrium between the two.

### [](#p-332-h-23-dynamic-conversion-curve-integral-pricing-model-8)2.3 Dynamic Conversion Curve (Integral Pricing Model)

The integral curve from 2.0 governs how the actual rate moves around the ideal rate.

#### [](#p-332-h-231-marginal-rate-function-9)2.3.1 Marginal Rate Function

```
r(p) = r_prev · e^(−k · p / P_epoch)
```

Where:

*   r\_prev: rate before this conversion
*   p: depth variable
*   P\_epoch: epoch capacity
*   k: decay coefficient

This produces density-sensitive rate compression.

#### [](#p-332-h-232-conversion-output-integral-curve-10)2.3.2 Conversion Output (Integral Curve)

```
R_base = r_prev · (P_epoch / k) · (1 − e^(−k · P_in / P_epoch))
```

#### [](#p-332-h-233-rate-update-11)2.3.3 Rate Update

```
r_new = r_prev · e^(−k · P_in / P_epoch)
```

This reduces the actual rate proportionally to participation density.

### [](#p-332-h-24-half-life-recovery-12)2.4 Half-Life Recovery

```
r(t) = r_new + (r_base(t) − r_new) · (1 − e^(−λ · (t − t_last)))
```

Recovery moves the actual rate smoothly toward the ideal rate. The formula is unchanged from 2.0.

[Ref: Conversion 2.0 Activation - Dynamic Conversion Curve](https://gov.riverai.inc/t/conversion-2-0-activation/151)

### [](#p-332-h-25-staking-epochs-output-and-voting-power-13)2.5 Staking Epochs, Output, and Voting Power

Staking epochs are how Conversion 3.0 lets each contributor choose where they sit on the short-term to long-term spectrum. The choice has a direct effect on output, on how long the position participates in governance, and on how the unlock anchors to Seasons.

Conversion produces Staked RIVER immediately. The Staked RIVER is held across the selected staking epoch and carries voting power throughout that period.

At the end of the staking epoch, the underlying RIVER unlocks and becomes claimable. The unlock date anchors to a Season boundary.

The staking epoch determines:

*   How long the position is staked
*   The voting power multiplier applied across the staking period
*   How much voting power is active in River Governance
*   Which Season boundary the unlock anchors to

Output scales with the staking epoch. Conversion 3.0 expands staking epochs from 4 to 8 tiers, ranging from 3 to 24 months.

```
R_final = R_base × (1 − Reshare)
```

Reshare is the portion retained by the protocol. A higher reshare percentage corresponds to a shorter staking epoch and a smaller share of base output received.

Selecting the longest staking epoch retains the full base output.

#### [](#p-332-h-251-numerical-example-same-season-different-conversion-days-14)2.5.1 Numerical Example: Same Season, Different Conversion Days

Three participants each convert 10,000 River Pts during S5 on the same staking epoch. They convert on Day 10, Day 30, and Day 60.

The actual rate at execution moves with conversion density. Participant A converts on Day 10 at 0.007. By Day 30, activity thins out and the rate recovers, so Participant B converts at 0.009. By Day 60, conversion density compresses it back down, so Participant C converts at 0.005.

Same input, three different rates, three different amounts of Staked RIVER. The Staked Until date stays the same for all three, anchored to the Season boundary.

**3-Month Staking Epoch (70% reshare)**

Participant A

Participant B

Participant C

Input

10,000 River Pts

10,000 River Pts

10,000 River Pts

Convert Date

Day 10

Day 30

Day 60

Actual Rate

0.007

0.009

0.005

Staking Period

3 months

3 months

3 months

est. Receive

21 Staked RIVER

27 Staked RIVER

15 Staked RIVER

Multiplier

1x

1x

1x

Voting Power

21

27

15

Staked Until

October 1, 2026

October 1, 2026

October 1, 2026

**24-Month Staking Epoch (0% reshare)**

Participant A

Participant B

Participant C

Input

10,000 River Pts

10,000 River Pts

10,000 River Pts

Convert Date

Day 10

Day 30

Day 60

Actual Rate

0.007

0.009

0.005

Staking Period

24 months

24 months

24 months

est. Receive

70 Staked RIVER

90 Staked RIVER

50 Staked RIVER

Multiplier

24x

24x

24x

Voting Power

1,680

2,160

1,200

Staked Until

July 1, 2028

July 1, 2028

July 1, 2028

The pattern across both tables shows the central trade-off in Conversion 3.0: rate at execution is shaped by collective activity, and that variation flows through to Receive at every staking epoch. Output scales by staking epoch, with longer epochs retaining a larger share and applying a higher voting power multiplier.

Unlock timing is Season-anchored. It is determined by Season boundary and staking epoch, not by individual conversion timing.

#### [](#p-332-h-252-reshare-across-staking-epochs-15)2.5.2 Reshare Across Staking Epochs

Using a base output of 100 Staked RIVER (10,000 River Pts × ideal rate 0.01):

Staking Epoch

Reshare

est. Receive

Voting Power Multiplier

Staked Until (convert in S5)

3 months

70%

30 Staked RIVER

1x

October 1, 2026

6 months

60%

40 Staked RIVER

2x

January 1, 2027

9 months

50%

50 Staked RIVER

4x

April 1, 2027

12 months

40%

60 Staked RIVER

8x

July 1, 2027

15 months

30%

70 Staked RIVER

12x

October 1, 2027

18 months

20%

80 Staked RIVER

16x

January 1, 2028

21 months

10%

90 Staked RIVER

20x

April 1, 2028

24 months

0%

100 Staked RIVER

24x

July 1, 2028

Every Staked Until date anchors to a Season boundary. Voting power stays active across the entire Staked Until period. A 24-month staking epoch produces both the largest received amount and the longest active governance participation.

The reshare structure is what keeps the long-term contribution side of the balance honest. Short-term participants exit faster but receive less, with the difference flowing back to the protocol. Long-term participants take on duration risk and compound across Seasons. Both options stay open to every contributor, and the curve is the same for everyone.

* * *

## [](#p-332-h-3-why-the-upgraded-system-works-16)3\. Why the Upgraded System Works

Conversion 3.0 keeps three things in balance: what the protocol can sustainably distribute, how contribution actually happens, and the long-term direction of the network.

The seasonal model handles sustainability. Each Season’s ideal rate resets against growing network metrics, so distribution stays in step with the protocol’s actual scale. The 30M $RIVER conversion cap from TGE remains the ceiling, and 350M River Pts enter 3.0 to convert against it.

The dynamic conversion curve handles real-time contribution. The 2.0 simulations confirmed the properties that carry into 3.0:

*   Dense participation produces proportional compression
*   Lower activity allows continuous recovery
*   Output distributes more evenly over time
*   Timing attempts do not increase output
*   Splitting provides no advantage

The eight staking epochs handle long-term direction. Contributors choose where to sit on the duration spectrum, and the choice flows through to output, voting power, and unlock anchoring. The protocol does not force a single path. It rewards continued contribution across whichever path each contributor takes.

Within each Season the mechanism behaves identically to 2.0. Across Seasons, the model compounds. The design supports sustainable distribution, predictable unlock alignment, and long-term system stability.

* * *

## [](#p-332-h-4-conclusion-17)4\. Conclusion

Dynamic Airdrop Conversion is River’s mechanism for long-term, sustainable protocol development. Conversion 1.0 introduced the concept and the goal of rewarding long-term contributors.

Conversion 2.0 added the dynamic conversion activity that adjusted the rate against real participation. 650M River Pts converted across both versions under that lineage.

Conversion 3.0 builds on the concept from 1.0 and the dynamic conversion activity from 2.0, extending into a model that balances three sides: ecosystem incentives, long-term contribution, and sustainable tokenomic.

It replaces a single fixed window with recurring Seasons aligned to each quarter.

The Season is the unit of incentive design, anchoring the ideal rate, the unlock schedule, and the staking epoch.

The model balances post-TGE growth momentum with sustained tokenomic release. The actual rate responds to collective conversion activity at execution.

The eight staking epochs (3-24 months) shape how each contributor’s output scales and how voting power compounds over the staked period.

Short-term exit reshares to the protocol, long-term commitment compounds across Seasons.

* * *

#### [](#p-332-reference-18)Reference

*   [Conversion Reshare Adjustment](https://gov.riverai.inc/t/conversion-reshare-adjustment/167)
*   [Conversion 2.0 Activation](https://gov.riverai.inc/t/conversion-2-0-activation/151/1)
*   [Conversion 2.0 is LIVE](https://blog.riverai.inc/conversion-2-0/)
*   [River Staking Parameters for Activation](https://gov.riverai.inc/t/river-staking-parameters-for-activation/147)