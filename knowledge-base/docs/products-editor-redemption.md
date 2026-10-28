# Doc: products-editor-redemption
Source: https://docs.riverai.inc/products/editor/redemption
Scraped: 2026-05-09T13:49:41.004Z

---

⌘Ctrlk

1.  [Products](https://docs.riverai.inc/products)chevron-right
2.  [dollar-signOmni-CDP](https://docs.riverai.inc/products/editor)

## Redemption

The River employs several mechanisms to ensure that its native stablecoin, satUSD, maintains a value closely aligned with the US dollar. These mechanisms work together to stabilize prices and enable smooth redemptions.

satUSD maintains its peg to the USD through both "hard" and "soft" mechanisms:

-   **Hard Peg**: The hard peg of satUSD is maintained through its redeemability for collateral. Holders can always exchange their satUSD for a specific amount of collateral, providing a solid price floor. This mechanism prevents satUSD from dropping significantly below its intended value, ensuring stability and reliability.
    
-   Soft Peg: The price stability of satUSD is supported by its Minimum Collateralization Ratio (MCR) of 110%. When the market price of satUSD rises above $1.10, it creates an incentive for users to deposit collateral and mint more satUSD at the 110% collateral ratio, and sell the minted satUSD in the market. This action increases the supply of satUSD in the market, which helps bring the price back down toward the target of $1.00.
    

Holders of satUSD have the ability to redeem their tokens for collateral, which plays a crucial role in managing the supply of satUSD and supporting its price stability:

-   **Redemption Process**: Holders can exchange satUSD for collateral. When users initiate a redemption, the system selects positions based on their collateralization ratios, starting with those that are least collateralized.
    
-   **Conditions for Redemption**: Redemptions are allowed only when the Total Collateral Ratio (TCR) is above 110% and not within the first 14 days post-protocol launch. This restriction ensures system stability during its initial stages.
    

-   **Partial Redemption**: This is the standard form of redemption, where the amount of satUSD redeemed does not fully cover the total debt of a position. This process adjusts the system's leverage without completely closing any positions.
    
-   **Full Redemption**: This occurs when a Position's entire debt is settled through redemption, thereby eliminating its debt and reallocating any surplus collateral to a general pool.
    

While both mechanisms reduce the system's overall debt, they operate differently:

-   Redemptions can be initiated by any party and directly affect the circulating supply of satUSD.
    
-   Debt repayments, on the other hand, are specific actions taken by users to manage their individual positions.
    

-   **Fee Calculation**: Redemption fees are determined by the formula `(baseRate + 0.5%)`. This fee structure ensures that users are charged based on current market conditions.
    
-   **Base Rate Dynamics**: Base Rate Dynamics: The base rate is a dynamic figure calculated based on the previous base rate and the amount of satUSD redeemed relative to the total supply. This approach helps adjust redemption costs in line with the liquidity needs of the system.
    

The detailed calculation of the redemption fee follows the same method as the minting fee, so please refer to [Mintingarrow-up-right](https://docs.satoshiprotocol.org/mechanism/minting).

Through these well-designed mechanisms, the River aims to maintain the price stability of satUSD, ensuring that it remains a reliable and functional token.

[arrow-up-right](https://docs.satoshiprotocol.org/mechanism/stability-pool-and-liquidations)

Last updated 11 months ago

-   [Mechanisms for Price Stability](#mechanisms-for-price-stability)
-   [satUSD Token Redemption](#satusd-token-redemption)
-   [Types of Redemption](#types-of-redemption)
-   [Redemption vs. Debt Repayment](#redemption-vs.-debt-repayment)
-   [Redemption Fees and Base Rate](#redemption-fees-and-base-rate)
-   [In Summary](#in-summary)