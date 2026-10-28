# Doc: products-editor-stability-pool
Source: https://docs.riverai.inc/products/editor/stability-pool
Scraped: 2026-05-09T13:49:39.797Z

---

⌘Ctrlk

1.  [Products](https://docs.riverai.inc/products)chevron-right
2.  [dollar-signOmni-CDP](https://docs.riverai.inc/products/editor)

## Stability Pool

The Stability Pool (SP) serves as a crucial mechanism within the River, designed to preserve the system's stability by providing liquidity for settling debts from liquidated Positions. When a Position undergoes liquidation, the SP uses satUSD to clear the debt and, in return, acquires the collateral from the liquidated Position. This process maintains the integrity of the protocol by ensuring that under-collateralized positions do not threaten the system’s stability.

Stability Pool providers are incentivized through several mechanisms:

-   **Collateral Gains:** When liquidations occur, SP providers receive discounted collateral in proportion to their satUSD holdings in the pool.
    
-   **Liquidation Trigger Rewards:** Users who initiate liquidations earn 0.25% of the collateral and 2 satUSD as gas compensation.
    
-   **Revenue Sharing**: Revenue earned by the protocol will be shared with staked $RIVER holders.
    

Liquidations ensure that satUSD is always fully backed by collateral. Positions with a collateral ratio below 110% are eligible for liquidation. Any user can trigger a liquidation, which helps maintain the stability of the protocol by removing riskier positions.

-   Once a position’s collateral ratio drops below 110%, it becomes eligible for liquidation.
    
-   The liquidation is initiated by any user, who is rewarded with 0.25% of the collateral and 2 satUSD for gas fees.
    
-   The Stability Pool absorbs the position’s debt and acquires its collateral.
    

-   Stability Pool Providers gain a share of liquidated collateral, typically at a discounted rate.
    
-   These gains are in proportion to their satUSD contributions to the pool.
    

Stability Pool providers can generally withdraw their satUSD from the Stability Pool without restrictions. However, withdrawals may be temporarily paused during pending liquidations to ensure sufficient liquidity is available for settling debts.

While contributing to the Stability Pool offers potential rewards, it also comes with risks:

-   **Sub-Optimal Liquidations**: Stability pool providers might incur losses if liquidations occur at unfavorable collateral ratios.
    
-   **satUSD-to-Collateral Value Discrepancies**: The value of the collateral obtained through liquidations can fluctuate, impacting the overall returns.
    

[arrow-up-right](https://docs.satoshiprotocol.org/mechanism/minting)

Last updated 10 months ago

-   [What is the Stability Pool (SP)?](#what-is-the-stability-pool-sp)
-   [Why Contribute satUSD to the Stability Pool?](#why-contribute-satusd-to-the-stability-pool)
-   [Liquidation Mechanics](#liquidation-mechanics)
-   [Liquidation Process and Incentives](#liquidation-process-and-incentives)
-   [Benefits for Stability Pool Providers](#benefits-for-stability-pool-providers)
-   [Withdrawal Policies](#withdrawal-policies)
-   [Risks and Considerations](#risks-and-considerations)