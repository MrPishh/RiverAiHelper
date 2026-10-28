# Governance: The Countermeasure 2.5｜Conversion 2.0 Upgrade Parameters
Source: https://gov.riverai.inc/t/the-countermeasure-2-5-conversion-2-0-upgrade-parameters/58
Scraped: 2026-05-10T01:04:11.828Z

---

This update consolidates all components of the Conversion 2.0 mechanism into a single draft document.

It is being shared now because many parts of the design came directly from community suggestions, and the next step is to review the full structure together before anything is finalized.

The document explains the mechanism only. It is not financial guidance and should not be used as a reference for secondary-market decisions regarding River Pts or RIVER.

Every part of this proposal is still in the discussion stage and open for adjustment based on community feedback.

#### [](#p-112-h-0-before-you-read-1)0\. Before You Read

When conversions resume, where does the rate start?

At the current day-index based on days elapsed since TGE (2024-09-22). No reset occurs.

*   If the last reference was Day 64 and seven days have passed → Day 71 rate
    
*   If resumed on Day 70 → Day 70 rate applies
    

What do I receive after conversion?

All conversion results are delivered as Staked RIVER, with selectable durations of 3 / 6 / 9 / 12 months. The chosen duration also determines the actual amount of RIVER received, where longer durations correspond to a higher share of the base conversion output.

Does this document relate to market pricing?

No. This document describes conversion mechanisms only and should not be used as reference for secondary-market decisions for River Pts or RIVER.

### [](#p-112-h-1-conversion-window-structure-2)1\. Conversion Window Structure

#### [](#p-112-h-11-180-day-conversion-window-3)1.1 180-Day Conversion Window

The mechanism continues to follow a fixed 180-day progression curve exactly as originally designed.

#### [](#p-112-h-12-30-maximum-conversion-allocation-4)1.2 30% Maximum Conversion Allocation

Total conversion remains capped at 30% of the designated supply.

These two parameters remain unchanged. All other components are upgraded.

### [](#p-112-h-2-overview-of-conversion-20-draft-5)2\. Overview of Conversion 2.0 (Draft)

Conversion will resume under the upgraded mechanism.

The previous linear model will not return because both community feedback and simulations showed that it cannot handle concentrated activity or liquidity shocks.

Conversion 2.0 introduces four upgraded components that together create a predictable and self-moderating system.

All parameters here are still open to discussion.

#### [](#p-112-h-21-daily-conversion-cap-6)2.1 Daily Conversion Cap

To prevent extreme single-day pressure that could distort rate behavior. This distributes participation across time and stabilizes short-term behavior, even during demand spikes.

Daily Conversion Cap: 20,000,000 River Pts.

#### [](#p-112-h-22-per-conversion-limit-7)2.2 Per-Conversion Limit

Ensures equal access to daily capacity and prevents system disruption by oversized transactions. No single address can consume the full daily quota

Maximum per conversion: 1,000,000 River Pts.

### [](#p-112-h-23-dynamic-conversion-curveintegral-pricing-model-8)2.3 Dynamic Conversion Curve（Integral Pricing Model）

The original model used a static, time-based rate that did not respond to participation density.  
Conversion 2.0 replaces it with a continuous integral curve that adjusts instantly to activity levels.

#### [](#p-112-h-231-marginal-rate-function-9)2.3.1 Marginal Rate Function

r(p) = r\_{\\text{prev}} \\cdot e^{-\\,k \\cdot p / P\_{\\text{epoch}}}

Where:

*   r\_{\\text{prev}}：rate before this conversion
*   p：depth variable
*   P\_{\\text{epoch}}：epoch capacity
*   k：decay coefficient

This produces density-sensitive rate compression.

#### [](#p-112-h-232-conversion-outputintegral-curve-10)2.3.2 Conversion Output（Integral Curve）

R\_{\\text{base}} = r\_{\\text{prev}} \\cdot \\frac{P\_{\\text{epoch}}}{k} \\left( 1 - e^{-\\,k P\_{\\text{in}} / P\_{\\text{epoch}}} \\right)

#### [](#p-112-h-233-rate-update-11)2.3.3 Rate Update

r\_{\\text{new}} = r\_{\\text{prev}} \\cdot e^{-\\,k P\_{\\text{in}} / P\_{\\text{epoch}}}

This reduces the rate proportionally to participation density.

#### [](#p-112-h-24-half-life-recovery-12)2.4 Half-Life Recovery

The system uses an exponential recovery formula to move the rate smoothly toward the baseline curve:

r(t) = r\_{\\text{new}} + \\left( r\_{\\text{base}}(t) - r\_{\\text{new}} \\right) \\left( 1 - e^{-\\,\\lambda (t - t\_{\\text{last}})} \\right)

The recovery is continuous and MEV-resistant.

#### [](#p-112-h-25-conversion-output-and-the-yield-earned-through-staked-river-13)2.5 Conversion Output and the Yield Earned Through Staked RIVER

All conversion output will be delivered as Staked RIVER, and the first thing to make clear is that Staked RIVER **earns yield**.

Once converted, the position continues to generate RIVER Pts throughout the staking period. These ongoing RIVER Pts form the yield. Depending on participation and the chosen duration, the returns can be meaningfully strong.

In addition to yield, Staked RIVER carries voting power. This means the position gives both influence and income.

Holders who stay aligned with the system gain measurable rewards instead of being pushed into the liquidity pressure that the old instant-liquid model created.

This structure shifts conversion away from short-term rotation and into a format that builds long-term value.

Receiving Staked RIVER prevents sudden supply shocks and directs rewards through a steady, rules-based yield mechanism.

Staked RIVER is intended to be a productive asset. It participates in governance and it earns.

### [](#p-112-fixed-multipliers-14)Fixed multipliers

Durations

Voting Power

3 Months

1x

6 Months

2x

9 Months

4x

12 Months

8x

### [](#p-112-formula-15)Formula

R\_{\\text{final}} = R\_{\\text{base}} \\times M\_{\\text{duration}}

Longer staking durations receive a larger share of the same base output, which increases both governance weight and yield.

#### [](#p-112-h-251-numerical-example1000000-river-pts-16)2.5.1 Numerical Example（1,000,000 River Pts）

Let’s use a simple example to show how the conversion works. Suppose you convert 1,000,000 River Pts on Day 90, and the Day 90 conversion rate is 0.01.

For this illustration, ignore integral adjustments and just use the base rate.

*   Input = 1,000,000 River Pts
*   Day 90 Conversion rate 0.01
*   Result 1,000,000 River Pts × 0.01 = 10,000 Staked RIVER

In this simplified example, 1M River Pts converts into 10,000 Staked RIVER (R\_base) before applying caps or curve adjustments.

The table below shows how the 10,000 Staked RIVER is distributed across different staking durations.

Each duration receives a different portion of the same base output. The total does not increase or decrease. A longer duration only shifts a larger portion of the base amount to that period.

Staking Duration

Conversion Reshare

Receive

3 Months

45%

5,500 Staked RIVER

6 Months

30%

7,000 Staked RIVER

9 Months

15%

8,500 Staked RIVER

12 Months

0%

10,000 Staked RIVER

Early Unstake:

An Early Unstake option will be available, allowing users to exit before the selected duration. Exact rules will follow in the official staking announcement.

### [](#p-112-h-3-why-the-upgraded-system-works-17)3\. Why the Upgraded System Works

Across all simulations (published in [2.2](https://gov.riverai.inc/t/the-countermeasure-2-2-simulation-overview/18/6) and [2.4](https://gov.riverai.inc/t/the-countermeasure-2-4-simulation-update/41/1)):

*   Dense activity produces proportional rate compression
*   Low activity allows smooth recovery
*   Output is more evenly distributed across time
*   Timing attacks and MEV extraction are suppressed
*   Splitting does not increase output
*   Mechanism remains stable under stress tests

Conversion 2.0 achieves predictability, fairness, and long-term alignment.

### [](#p-112-h-4-next-steps-18)4\. Next Steps

The team is concluding:

*   parameter calibration
*   integration testing
*   audit and validation
*   preparation for activation

This draft will continue to evolve with community feedback.

All updates will be published on the Forum after a full review.

Appreciation goes to everyone who has taken the time to share suggestions. The discussions will continue on the Forum, and more suggestions and ideas from the community are always welcome.

* * *

#### [](#p-112-reference-19)Reference

*   [The Countermeasure 2.1 : Conversion Mechanism Upgrade Progress](https://gov.riverai.inc/t/the-countermeasure-2-1-conversion-mechanism-upgrade-progress/15/11)
*   [The Countermeasure 2.2: Simulation Overview](https://gov.riverai.inc/t/the-countermeasure-2-2-simulation-overview/18)
*   [The Countermeasure 2.3 : Conversion Mechanism Formula Specification](https://gov.riverai.inc/t/the-countermeasure-2-3-conversion-mechanism-formula-specification/25)
*   [The Countermeasure 2.4｜Simulation Update](https://gov.riverai.inc/t/the-countermeasure-2-4-simulation-update/41/1)
*   [River English Community AMA Recap](https://gov.riverai.inc/t/river-english-community-ama-recap/35)