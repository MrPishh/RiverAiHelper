# Governance: The Countermeasure 2.3 : Conversion Mechanism Formula Specification
Source: https://gov.river.inc/t/the-countermeasure-2-3-conversion-mechanism-formula-specification/25
Scraped: 2026-05-10T01:04:16.739Z

---

## [](#p-54-conversion-mechanism-architecture-integral-rate-decay-and-half-life-recovery-1)Conversion Mechanism Architecture: Integral Rate Decay and Half-Life Recovery

### [](#p-54-h-1-overview-2)1\. Overview

This chapter introduces the RIVER protocol’s conversion mechanism designed for converting PTS to RIVER in a scalable, incentive-aligned, and attack-resilient manner.

Traditional linear conversion models suffer from splitting attacks, MEV exploitation, flash conversions by whales, and unstable rate behavior that accelerates conversion rush cascades.

To address these vulnerabilities, RIVER introduces a novel **Integral Conversion Model with Half-Life Recovery**, which guarantees:

*   The more someone converts, the worse the marginal rate becomes
*   Time-based recovery prevents panic extraction behavior
*   Splitting transactions provides no gain
*   Conversion rate decays smoothly and predictably
*   Whales and robots cannot exploit timing or granularity
*   System-level controls through P\_{one} and P\_{epoch}

* * *

### [](#p-54-h-2-design-goals-3)2\. Design Goals

Objective

Achieved by

Conversion penalty increases with depth

Exponential marginal rate decay

Prevent conversion rush

Natural diminishing returns

Eliminate splitting or MEV arbitrage

Continuous integral-based output

Restore system health after stress

Half-life recovery curve

Protect against flash conversion

P\_{one} per-transaction cap

System pacing control

P\_{epoch} epoch ceiling

* * *

### [](#p-54-h-3-model-formulation-4)3\. Model Formulation

#### [](#p-54-variable-definitions-5)Variable Definitions

Symbol

Definition

P\_{in}

Amount of PTS converted in a single transaction

P\_{one}

Maximum PTS allowed per single conversion

P\_{epoch}

Maximum PTS allowed to convert within the current epoch

p

Conversion progress variable ranging from 0 to P\_{in}

r\_{prev}

Conversion rate before the current conversion begins

r\_{new}

Conversion rate after processing P\_{in}

r(t)

Conversion rate after applying time-based recovery

r\_{base}(t)

Target baseline conversion rate determined by time schedule

k

Penalty coefficient controlling curve steepness

R\_{out}

RIVER output amount received from converting P\_{in}

T\_{half}

Half-life constant defining recovery speed

\\lambda

Recovery rate constant derived from T\_{half}

t

Current timestamp

t\_{last}

Timestamp of the previous conversion trigger

\\sum P\_{in}

Cumulative conversion within the current epoch

epoch

Time period with a fixed conversion budget

#### [](#p-54-h-31-single-conversion-limit-6)3.1 Single Conversion Limit

0 < P\_{in} \\le P\_{one}

#### [](#p-54-h-32-marginal-conversion-rate-7)3.2 Marginal Conversion Rate

r(p) = r\_{prev} \\cdot e^{-k \\cdot p / P\_{epoch}}

#### [](#p-54-h-33-conversion-output-integral-calculation-8)3.3 Conversion Output (Integral Calculation)

R\_{out} = \\int\_0^{P\_{in}} r(p)\\, dp

Closed-form:

R\_{out} = r\_{prev} \\cdot \\frac{P\_{epoch}}{k} \\cdot \\left(1 - e^{-k \\cdot P\_{in} / P\_{epoch}}\\right)

#### [](#p-54-h-34-rate-update-after-conversion-9)3.4 Rate Update After Conversion

r\_{new} = r\_{prev} \\cdot e^{-k \\cdot P\_{in} / P\_{epoch}}

#### [](#p-54-h-35-half-life-recovery-10)3.5 Half-Life Recovery

r(t) = r\_{new} + (r\_{base}(t) - r\_{new}) \\cdot \\left(1 - e^{-\\lambda \\cdot (t - t\_{last})}\\right)

Half-life constant:

\\lambda = \\frac{\\ln 2}{T\_{half}}

#### [](#p-54-h-36-dynamic-base-rate-linear-example-11)3.6 Dynamic Base Rate (linear example)

r\_{base}(t) = r\_{start} + \\frac{r\_{end} - r\_{start}}{t\_{end} - t\_{start}} \\cdot (t - t\_{start})

#### [](#p-54-h-37-epoch-ceiling-12)3.7 Epoch Ceiling

\\sum P\_{in} \\le P\_{epoch}

### [](#p-54-h-4-execution-flow-13)4\. Execution Flow

r\_{prev} \\xrightarrow{\\text{recovery}} r(t) = r\_{prev} + (r\_{base}(t) - r\_{prev}) \\cdot (1 - e^{-\\lambda (t - t\_{last})})

P\_{in} = \\min(\\text{user request}, P\_{one}, P\_{epoch} - \\sum P\_{in})

R\_{out} = r(t) \\cdot \\frac{P\_{epoch}}{k} \\cdot \\left(1 - e^{-k P\_{in}/P\_{epoch}}\\right)

r\_{new} = r(t) \\cdot e^{-k P\_{in}/P\_{epoch}}