# Correction: River Points Conversion Mechanism — Deep Reference

## Default behaviour for conversion questions

**Always answer based on Conversion 3.0 (the current active mechanism) unless the user specifically asks about 1.0 or 2.0.**

If a user asks a conversion question and it is unclear which version they mean, clarify: "Are you asking about the current Conversion 3.0, or about how the earlier 1.0/2.0 mechanism worked?"

Never apply old 1.0/2.0 rate figures (Day 90/180 table, 0.03 max rate, 270× multiplier) to current questions. That mechanism is closed.

---

## Why Conversion 1.0 Failed — The Root Cause

Conversion 1.0 launched at TGE (September 22, 2025) as a 180-day linear time-based curve. The conversion rate depended only on time — the longer you waited, the higher the rate, up to a maximum of 0.03 at Day 180 (30,000 RIVER per 1M pts).

On November 7-9, 2025, a coordinated market manipulation attack targeted the mechanism:
- Attackers simultaneously opened large short positions on $RIVER across multiple exchanges
- They then converted massive amounts of River Pts to $RIVER and immediately sold
- Funding rates turned sharply negative
- Other holders panicked and also converted and sold, creating a cascade
- Conversion was suspended on November 9 to prevent total market collapse

**Why the linear model was structurally exploitable:**
- Rate depended only on time, not on how much was being converted — whale dumps got the same per-unit rate as small conversions
- No daily cap — a coordinated group could convert unlimited amounts in a single day
- No per-conversion limit — one transaction could consume the entire system's capacity
- Splitting one large conversion into many small ones gave the same total output (no advantage to small conversions over large ones)
- Output was liquid $RIVER — converted tokens could be dumped immediately with no lock-in
- Once price started falling, the mechanism created a self-reinforcing spiral

The team suspended conversion and initiated a full buyback for Public Sale participants at 0.0000447 BNB per River Pt.

---

## Conversion 2.0 — Each Element and Why It Was Added

Conversion 2.0 resumed from Day 48 of the original 180-day schedule (no reset — the clock kept running during the pause, making the effective window ~211 days). Every element of 2.0 directly addressed a specific weakness found in 1.0.

### Daily Conversion Cap (20M River Pts/day)
**Why:** The coordinated attack dumped massive amounts in single-day surges. A daily cap distributes participation across time and prevents any group from overwhelming the system in one day, even if they hold enough pts to do so.

### Per-Conversion Limit (1M River Pts per transaction)
**Why:** Without this, one transaction could consume the entire day's capacity, locking out other participants. The limit ensures fair access. Combined with the integral curve, splitting transactions into smaller ones gives zero advantage.

### Dynamic Integral Pricing Model — The Core Innovation
**Why:** The linear model's rate was purely time-based — conversion density had no effect. Coordinated dump = same rate for attackers as for any holder. The integral model makes rate sensitive to density.

**How it works:** Rate decays exponentially based on how much has been converted in the current epoch:
- Marginal rate: `r(p) = r_prev · e^(-k · p / P_epoch)` — the more you convert, the worse each additional unit's rate
- Output integral: `R_out = r_prev · (P_epoch / k) · (1 - e^(-k · P_in / P_epoch))`
- After conversion: `r_new = r_prev · e^(-k · P_in / P_epoch)` — rate updates immediately

**Key properties this achieves:**
- Dense conversion compresses the marginal rate — coordinated dumps become self-defeating
- Splitting transactions provides zero gain (integral-based, not per-transaction)
- Whales and robots cannot exploit granularity or timing
- Rate compression is proportional and predictable

### Half-Life Recovery
**Why:** Without recovery, one surge could permanently suppress the rate. Recovery ensures that after activity slows, the rate automatically moves back toward the baseline — continuously and without manual intervention.

**Formula:** `r(t) = r_new + (r_base(t) - r_new) · (1 - e^(-λ · (t - t_last)))`

This is MEV-resistant because it is continuous — there is no step-function moment to exploit.

### Output as Staked RIVER (not liquid RIVER)
**Why:** In 1.0, conversion output was liquid $RIVER that could be immediately dumped, directly feeding the attack. Staked RIVER has a lock-in period — converted tokens cannot be immediately sold. This breaks the convert-and-dump cycle and aligns holders with long-term participation through staking yield and governance weight.

**Staking duration determines share of base output.** Longer commitment = larger share retained + higher voting power multiplier.

---

## Conversion 2.0 → 3.0: What Changed and Why

After 2.0 ran for two Seasons (650M River Pts converted), its structural limitation became clear: a single fixed 180-day window creates endpoint pressure. As the window neared its close, participants felt urgency, and the time-based baseline still created timing incentives — waiting longer within the window increased the base rate. Distribution was also a one-time event, with no ongoing incentive model.

**3.0 was designed to make distribution sustainable and recurring.**

### What 3.0 kept from 2.0 (unchanged mechanics)
- Dynamic integral pricing curve (same formulas)
- Half-life recovery formula
- Staked RIVER output with epoch selection
- Per-conversion limit (1M pts)
- Daily cap (reduced to 5M/day in 3.0 to reflect smaller per-Season issuance)

### What 3.0 changed and why

**Recurring quarterly Seasons (replacing single 180-day window)**
Why: A single window creates endpoint pressure and one-time participation spikes. Quarterly Seasons mean incentives reset every ~90 days. Contributors who stay active across Seasons keep earning and converting. Distribution scales with the protocol's actual growth over time.

**Per-Season ideal rate (replacing time-based baseline)**
Why: In 2.0, the baseline rate increased with time — waiting until Day 180 gave the highest possible rate. This incentivised hoarding and waiting. In 3.0, the ideal rate is a constant set at the Season's start (S5 = 0.01). Time within the Season no longer raises or lowers the ideal rate — only conversion density moves the actual rate around it. This removes the "wait until the last day" incentive.

**8 staking epochs — 3 to 24 months (expanded from 4: 3-12 months)**
Why: The 4-tier system in 2.0 showed that most participants chose the shortest option (3 months). This tilted governance power toward short-term participants and undermined long-term protocol stability. Expanding to 8 tiers (3/6/9/12/15/18/21/24 months) creates a more granular spectrum, and the 24-month option receiving 100% of base output gives a strong incentive for longer commitment.

**Season-anchored unlock dates**
Why: All participants who convert in the same Season under the same epoch unlock on the same date, regardless of which day they converted. This removes any advantage from converting early vs late within a Season (from an unlock perspective), and makes timing transparent and predictable.

---

## Reshare Evolution — Why It Kept Getting Stricter

The "reshare" is the portion retained by the protocol. A higher reshare % means the user receives a smaller share of the base output. The trend across all three versions is toward penalising short-term more heavily:

| Version | 3-month keeps | 12-month keeps | 24-month keeps |
|---|---|---|---|
| 2.0 original (CM 2.5) | 55% | 100% | — (not available) |
| Reshare Adjustment (2026-02-28) | 40% | 100% | — |
| Conversion 3.0 | 30% | 60% | 100% |

**Why the trend toward stricter short-term penalties:**
After 2.0 launched, participation data showed the majority chose the 3-month option. This concentrated governance power in short-term holders, reducing the protocol's ability to make long-term decisions. Each adjustment pushed more of the base output toward longer commitments to rebalance governance weight toward holders with long-term skin in the game.

---

## S6 Current Parameters (Conversion 3.0)

- **Season:** S6, July 1 – Sep 30, 2026 (conversion window and claim window both close Sep 30, 2026)
- **Ideal rate:** 0.01 (constant for S6). 10,000 pts → 100 Staked RIVER at ideal rate
- **Actual rate:** floats around 0.01 based on conversion density. Denser activity compresses it below 0.01; quieter periods recover it toward 0.01.
- **Daily cap:** 5,000,000 River Pts/day
- **Per-conversion limit:** 1,000,000 River Pts
- **Staking epochs:** 3/6/9/12/15/18/21/24 months
- **Reshare at ideal rate (100 Staked RIVER base):** 3M→30, 6M→40, 9M→50, 12M→60, 15M→70, 18M→80, 21M→90, 24M→100
- **Voting power multipliers:** 3M=1x, 6M=2x, 9M=4x, 12M=8x, 15M=12x, 18M=16x, 21M=20x, 24M=24x
- **Unlock anchors:** Season boundary + epoch. All S6 converters on 3-month epoch unlock January 1, 2027; 24-month unlock October 1, 2028 (steps forward one quarter per epoch in between).
- **Remaining supply:** not yet published for S6 as of this writing — do not quote a figure until the team confirms one; S5 entered 3.0 with 350M River Pts remaining against the 30M $RIVER ceiling.

---

## About the 0.01 rate — common question

Users often ask "why is the rate capped at 0.01?" or compare it to the old 0.03 maximum.

**How to answer:**
- 0.01 is the S5 **ideal rate** — a target constant, not a hard cap. The actual rate can be compressed below it during dense activity and recovers back toward it during quieter periods.
- The old 0.03 was the maximum of the Conversion 1.0/2.0 time-based curve at Day 180. That entire window closed April 22, 2026. Conversion 3.0 uses a different model — time within a Season no longer raises the rate.
- Each Season sets its own ideal rate based on network scale. S5 and S6 have both been set at 0.01.
- Longer staking epochs significantly offset the lower rate: 24-month receives 100% of base output vs 30% for 3-month, plus a 24x vs 1x voting power multiplier.

---

## Tone guidance for conversion frustration

Many users feel let down because:
- They expected the 0.03 rate from Conversion 1.0 and see only 0.01 now
- They feel the epoch lock-up periods are too long
- Their expected token amount doesn't match what they see

Acknowledge their concern genuinely. Do not dismiss it. Then bring in the following genuine positives where relevant:

**Sustainability framing:**
Conversion 3.0's lower ideal rate exists because the model is designed to be sustainable across years of Seasons, not to maximise a single payout window. The old 0.03 rate was part of a 180-day one-time event — that model could not scale. The seasonal model means distribution continues every quarter indefinitely, scaling with the protocol's actual growth. Users who stay active across multiple Seasons keep accruing and converting, rather than having one shot.

**Predictability framing (genuine comfort for uncertain users):**
Every Season gives users a clear three-point framework for their expected return:
1. They know when the Season ends (the conversion window close date)
2. They can see the current $RIVER price
3. They can estimate their reward based on their River Pts balance and the current actual conversion rate

This is more predictable than the old 180-day curve where timing decisions were opaque and pressure built toward the end of the window.

**Voting power framing:**
Longer staking epochs carry a voting power multiplier of up to 24x (24-month epoch). This is not just a governance benefit — Staked RIVER earns River Pts throughout the staking period, and higher voting power means earning those pts more efficiently. A user who commits long-term is rewarded with both more tokens at conversion AND better pts accumulation during the stake. This rewards genuine long-term financial participation, not just activity.

**Seasonal continuity framing:**
Supply not converted in one Season carries forward to the next. Choosing not to convert this Season does not forfeit anything. Users who feel the current rate is too low can wait for a Season where conversion density is lower and the actual rate recovers toward ideal.

**Do not:**
- Make any predictions about $RIVER price direction
- Compare current token output to any historical price movements
- Tell users the rate will definitely improve or that waiting will definitely pay off
- Characterise frustrated users negatively
