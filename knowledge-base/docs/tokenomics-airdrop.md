# Doc: tokenomics-airdrop
Source: https://docs.riverai.inc/tokenomics/airdrop
Scraped: 2026-05-09T13:50:13.198Z

---

⌘Ctrlk

1.  [Tokenomics](https://docs.riverai.inc/tokenomics)

## balloonAirdrop

Dynamic Airdrop Conversion 3.0 : First seasonal incentive model

Dynamic Airdrop Conversion is the conversion mechanism between River Pts and $RIVER.

[Conversion 3.0arrow-up-right](https://blog.riverai.inc/dynamic-airdrop-conversion-3-0/) is the first seasonal incentives model from River that balances contributions and sustains token distribution through recurring Seasons. It changes airdrops from a single distribution to a structure that runs every Season.

Conversion 1.0 introduced the first time-encoded tokenomics, aligning rewards with long-term contributors. [Conversion 2.0arrow-up-right](https://gov.riverai.inc/t/conversion-2-0-activation/) added the integral curve, daily cap, and half-life recovery.

The 180-day curve closed on April 22, 2026, with 650M River Pts converted across 2 Seasons. Conversion 3.0 is now live.

The conversion rate moves with real-time activity within each Season, and users can convert in one or multiple transactions across an open Season. River Pts themselves are standard ERC-20 tokens, they can be traded, transferred, or staked across the River ecosystem.

River Pts : `0xfc6be825925b7a83d131e33b46efef9084f0e014`

Full mechanism details

A total of **1 billion River Pts** correspond to **up to 30 million $RIVER**, covering the **Community Airdrop + Community Reserve** allocation (≈ 30 % of total supply).

Total River Points

1,000,000,000

Maximum Convertible $RIVER

30,000,000 (≈ 30 % of total supply)

Conversion Cycle

Recurring quarterly Seasons

Conversion Chain

BNB Chain

Mechanism Type

Seasonal, dynamic conversion with integral pricing

Staking Epochs

8 options, from 3 to 24 months

Mode

Convert anytime within an open Season, in one or multiple batches

Distribution runs across recurring Seasons rather than a single window. Each Season's actual conversion outcomes determine how much $RIVER is released in that cycle.

Supply not converted in a given Season carries forward, sustaining distribution across future Seasons.

The 30 % allocation acts as a long-term ceiling, released Season by Season as the network grows.

Real-time conversion data is shown at [**app.riverai.inc/airdrop**arrow-up-right](https://app.riverai.inc/airdrop)

Suppose you hold 10,000 River Pts.

Each Season is set with a constant ideal rate. The [S5 ideal rate is 0.01arrow-up-right](https://blog.riverai.inc/s5-live/), meaning 10,000 River Pts produce a base output of 100 Staked RIVER at the ideal rate.

The actual rate at execution depends on the conversion activity at that moment and the staking epoch (3 to 24 months) you select. Conversion activity follows the integral pricing model from 2.0. Denser participation compresses the rate, quieter periods recover it.

![Dynamic Airdrop Conversion 3.0](https://docs.riverai.inc/~gitbook/image?url=https%3A%2F%2F3162812039-files.gitbook.io%2F%7E%2Ffiles%2Fv0%2Fb%2Fgitbook-x-prod.appspot.com%2Fo%2Fspaces%252FPZA7LS6LjeZIqysGy3p7%252Fuploads%252Fam3ffqkuOI7JVRGng3WM%252Fimage.png%3Falt%3Dmedia%26token%3D5b7591f4-61a1-4f47-9599-3a5e0b954387&width=768&dpr=3&quality=100&sign=73150e69&sv=2)

**Example : 10k River Pts / 3 months**

Three participants each convert 10,000 River Pts during the same Season on the same staking epoch. They convert on Day 10, Day 60, and Day 90.

The actual rate at execution moves with conversion density. Participant A converts on Day 10 at 0.007. By Day 60, activity thins out and the rate recovers, so Participant B converts at 0.009.

By Day 90, conversion density compresses it back down, so Participant C converts at 0.005.

Same input, three different rates, three different amounts of Staked RIVER. The Staked Until date stays the same for all three, anchored to the Season boundary.

**3-Month Staking Epoch (70% reshare)**

Input

10,000 River Pts

10,000 River Pts

10,000 River Pts

Convert Date

Day 10

Day 60

Day 90

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

Input

10,000 River Pts

10,000 River Pts

10,000 River Pts

Convert Date

Day 10

Day 60

Day 90

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

The pattern across both tables shows the central trade-off in Conversion 3.0. Rate at execution is shaped by collective activity, and that variation flows through to Receive at every staking epoch.

Output scales by staking epoch, with longer epochs retaining a larger share and applying a higher voting power multiplier. Unlock timing is Season-anchored, determined by Season boundary and staking epoch, not by individual conversion timing.

Using a base output of 100 Staked RIVER (10,000 River Pts × ideal rate 0.01)

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

River Pts are awarded based on real activity across the River ecosystem. They reflect contributions in DeFi, social engagement, and staking, and accrue across Seasons.

They reflect contributions in DeFi, social engagement, and staking. ([S5 Airdroparrow-up-right](https://blog.riverai.inc/s5-live/))

-   [**Omni-CDP**arrow-up-right](https://app.riverai.inc/staking) **/ satUSD / Vaults**: add liquidity (e.g. satUSD/USDT), stake in Smart Vault or Prime Vault, hold YT. Actions include multipliers (2× to 25×).
    
-   [**River4FUN**arrow-up-right](https://app.riverai.inc/fun) **/ Social Engagement**: connect your X account, post content, participate in campaigns — your engagement is converted into Pts.
    
-   [**Staked RIVER**arrow-up-right](https://app.riverai.inc/river) : Staking $RIVER is how you accumulate River Pts, gain voting power, and participate in River governance.
    

Claim is receiving the eligible River Pts allocation through the airdrop page. River Pts earned in any Season remain claimable within a specific window (S4 — 60 days, see [S4 Airdrop is Livearrow-up-right](https://blog.riverai.inc/)).

Once claimed, Pts remain convertible across all subsequent Seasons.

2.  Connect your wallet or X account
    
3.  Click "Claim River Pts" to receive your allocation
    
4.  Confirm the live conversion rate and remaining daily cap.
    
5.  Select a staking epoch (3 to 24 months)
    
6.  Confirm to receive Staked RIVER
    

View your final Staked RIVER amount, actual conversion result, and full history at [app.riverai.inc/riverarrow-up-right](https://app.riverai.inc/river).

[**Season 5**arrow-up-right](https://blog.riverai.inc/s5-live/) is open to everyone.

Most actions to earn River Pts are the same as in Season 4, including minting, staking, swapping, and joining campaigns.

The only difference is the claiming time.

This is a new opportunity to start earning River Pts and participate in the ecosystem.

Learn more : [https://blog.riverai.inc/s5-live/arrow-up-right](https://blog.riverai.inc/s5-live/)

Last updated 47 minutes ago

-   [How to Earn River Pts](#how-to-earn-river-pts)
-   [How to Claim River Pts](#how-to-claim-river-pts)