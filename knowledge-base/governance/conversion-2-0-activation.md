# Governance: Conversion 2.0 Activation
Source: https://gov.riverai.inc/t/conversion-2-0-activation/151
Scraped: 2026-05-10T01:04:04.728Z

---

### [](#p-295-conversion-20-activation-1)Conversion 2.0 Activation

This activation document consolidates all components of Conversion 2.0 into a single reference shaped by earlier community discussions. It describes how Conversion 2.0 operates.

Conversion continues along the original 180-day schedule and resumes from Day 48. Earlier days are not repeated and nothing resets.

#### [](#p-295-h-0-before-you-read-2)0\. Before You Read

Conversion 2.0 uses a dynamic conversion curve.

The **actual conversion rate updates every block** and may differ from the displayed baseline.

Before converting, always check:

*   The actual rate
*   The remaining daily cap
*   Slippage setting to protect minimum received RIVER

Your final output is determined strictly by the **rate at execution**, not the preview.

When conversions resume, where does the rate resume?

Conversion resumes from Day 48, with an expected conversion rate of ~0.005444 according to the original baseline curve.

Does conversion still follow the original allocation?

Yes. Conversion remains subject to the original 30% allocation defined at launch.

Does this document relate to market pricing?

No. This text describes the mechanism only.

### [](#p-295-h-1-conversion-window-structure-3)1\. Conversion Window Structure

#### [](#p-295-h-11-180-day-conversion-window-4)1.1 180-Day Conversion Window

The mechanism continues to follow a fixed 180-day progression curve exactly as originally designed.

#### [](#p-295-h-12-30-maximum-conversion-allocation-5)1.2 30% Maximum Conversion Allocation

Total conversion remains capped at 30% of the designated supply.

These two parameters remain unchanged. All other components are upgraded.

### [](#p-295-h-2-overview-of-conversion-20-activation-6)2\. Overview of Conversion 2.0 (Activation)

Conversion resumes under the upgraded mechanism. The previous fixed model is no longer in use. Conversion now follows a dynamic conversion curve with continuous recovery and continues along the original 180-day progression.

#### [](#p-295-h-21-daily-conversion-cap-7)2.1 Daily Conversion Cap

To prevent extreme single-day pressure that could distort rate behavior. This distributes participation across time and stabilizes short-term behavior, even during demand spikes.

Daily Conversion Cap: 20,000,000 River Pts.

#### [](#p-295-h-22-per-conversion-limit-8)2.2 Per-Conversion Limit

Ensures equal access to daily capacity and prevents system disruption by oversized transactions. No single address can consume the full daily quota

Maximum per conversion: 1,000,000 River Pts.

### [](#p-295-h-23-dynamic-conversion-curveintegral-pricing-model-9)2.3 Dynamic Conversion Curve（Integral Pricing Model）

The original model used a static, time-based rate that did not respond to participation density.

Conversion 2.0 replaces it with a continuous integral curve that adjusts instantly to activity levels.

#### [](#p-295-h-231-marginal-rate-function-10)2.3.1 Marginal Rate Function

r(p) = r\_{\\text{prev}} \\cdot e^{-\\,k \\cdot p / P\_{\\text{epoch}}}

Where:

*   r\_{\\text{prev}}：rate before this conversion
*   p：depth variable
*   P\_{\\text{epoch}}：epoch capacity
*   k：decay coefficient

This produces density-sensitive rate compression.

#### [](#p-295-h-232-conversion-outputintegral-curve-11)2.3.2 Conversion Output（Integral Curve）

R\_{\\text{base}} = r\_{\\text{prev}} \\cdot \\frac{P\_{\\text{epoch}}}{k} \\left( 1 - e^{-\\,k P\_{\\text{in}} / P\_{\\text{epoch}}} \\right)

#### [](#p-295-h-233-rate-update-12)2.3.3 Rate Update

r\_{\\text{new}} = r\_{\\text{prev}} \\cdot e^{-\\,k P\_{\\text{in}} / P\_{\\text{epoch}}}

This reduces the rate proportionally to participation density.

#### [](#p-295-h-24-half-life-recovery-13)2.4 Half-Life Recovery

The system uses an exponential recovery formula to move the rate smoothly toward the baseline curve:

r(t) = r\_{\\text{new}} + \\left( r\_{\\text{base}}(t) - r\_{\\text{new}} \\right) \\left( 1 - e^{-\\,\\lambda (t - t\_{\\text{last}})} \\right)

The recovery is continuous and MEV-resistant.

#### [](#p-295-h-25-conversion-output-and-the-yield-earned-through-staked-river-14)2.5 Conversion Output and the Yield Earned Through Staked RIVER

All conversion output is delivered as Staked RIVER. It earns yield throughout the selected epoch and carries governance weight. Longer epochs receive a larger portion of the same base output and correspond to higher voting power.

This directs conversion toward holders who commit to longer participation and supports long-term development rather than short-term liquidity.

It also reduces immediate supply pressure and keeps incentives consistent across epochs.

Epoch

Voting Power

3 Months

1x

6 Months

2x

9 Months

4x

12 Months

8x

R\_{\\text{final}} = R\_{\\text{base}} \\times M\_{\\text{duration}}

Longer staking epoch receive a larger share of the same base output, which increases both governance weight and yield.

#### [](#p-295-h-251-numerical-example1000000-river-pts-15)2.5.1 Numerical Example（1,000,000 River Pts）

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

### [](#p-295-h-3-why-the-upgraded-system-works-16)3\. Why the Upgraded System Works

Across all simulations (published in [2.2](https://gov.riverai.inc/t/the-countermeasure-2-2-simulation-overview/18/6) and [2.4](https://gov.riverai.inc/t/the-countermeasure-2-4-simulation-update/41/1)):

*   Dense participation produces proportional compression
*   Lower activity allows continuous recovery
*   Output distributes more evenly over time
*   Timing attempts do not increase output
*   Splitting provides no advantage

Conversion moves from liquid output to a yield-bearing position with long-term alignment.

Conversion parameters may adjust if actual participation or system conditions require it.

Any adjustment is limited to protecting participants, preventing concentrated behavior, and maintaining long-term system stability.

### [](#p-295-h-4-next-steps-17)4\. Next Steps

Conversion 2.0 is active. Further details regarding staking, participation, and operational updates will continue to be shared in the Forum.

#### [](#p-295-reference-18)Reference

*   [The Countermeasure 2.1 : Conversion Mechanism Upgrade Progress](https://gov.riverai.inc/t/the-countermeasure-2-1-conversion-mechanism-upgrade-progress/15/11)
*   [The Countermeasure 2.2: Simulation Overview](https://gov.riverai.inc/t/the-countermeasure-2-2-simulation-overview/18)
*   [The Countermeasure 2.3 : Conversion Mechanism Formula Specification](https://gov.riverai.inc/t/the-countermeasure-2-3-conversion-mechanism-formula-specification/25)
*   [The Countermeasure 2.4｜Simulation Update](https://gov.riverai.inc/t/the-countermeasure-2-4-simulation-update/41/1)
*   [The Countermeasure 2.5｜Conversion 2.0 Upgrade Parameters](https://gov.riverai.inc/t/the-countermeasure-2-5-conversion-2-0-upgrade-parameters/58)
*   [River Staking Parameters for Activation](https://gov.riverai.inc/t/river-staking-parameters-for-activation/147/7)
*   [River English Community AMA Recap](https://gov.riverai.inc/t/river-english-community-ama-recap/35)