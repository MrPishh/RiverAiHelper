# Doc: products-editor-risk-management
Source: https://docs.riverai.inc/products/editor/risk-management
Scraped: 2026-05-09T13:49:44.577Z

---

⌘Ctrlk

1.  [Products](https://docs.riverai.inc/products)chevron-right
2.  [dollar-signOmni-CDP](https://docs.riverai.inc/products/editor)

## Risk Management

The River employs a comprehensive risk management framework to ensure system stability and security. This framework includes a Two-tier Liquidation system that provides users an opportunity to rectify their positions before full liquidation, inspired by Aave’s approach.

Instant & Permissionless Liquidation allows any user to initiate liquidations without prior approval, ensuring prompt handling of undercollateralized positions. Overcollateralization requires users to deposit more collateral than the value of their debt, tailored to different asset risk profiles, such as varying interest rates and LTV ratios.

The Stability Pool Mechanism offers liquidity for settling debts from liquidated positions, using satUSD and flash loans to maintain stability. Recovery Mode is activated when the Total Collateral Ratio (TCR) falls below 150%, enforcing stricter rules to restore system health.

Flash Loan Liquidation provides immediate liquidity for liquidations, enhancing efficiency. Isolated Risk Control to customize parameters of risk management for each asset type, like LST/LRT, to address specific risks and ensure protocol resilience.

Isolated Risk Control in the River involves a tailored risk management approach, where parameters such as Loan-to-Value (LTV) ratio, interest rates, and other risk factors are customized for each collateral type.

This ensures the protocol can adapt to different market conditions while maintaining stability. By differentiating these parameters, the protocol can manage volatile assets more effectively, ensuring a secure and stable environment for users.

Additionally, we implement different safety coefficients for each collateral, such as more conservative LTV ratios for higher-risk assets, ensuring the security of the protocol. Beyond LTV, the protocol also imposes Minting Caps on individual collateral types, limiting the amount of stablecoin that can be minted against each type of asset.

This prevents overexposure to any single collateral type and keeps risks within manageable levels, providing another layer of protection for the protocol and its users.

**Example**

Consider the River supporting two asset types: native BTC and an LST token from another protocol. For BTC, due to its stability and lower volatility, the protocol generally applies a higher Loan-to-Value (LTV) ratio, potentially allowing users to borrow up to 90.91% of its value with a Minimum Collateral Ratio (MCR) around 110%.

This structure enables efficient collateral use with relatively low risk for BTC. Conversely, for an LST token—which may carry higher volatility or additional risk factors due to its connection to an external protocol—the protocol typically adopts a more conservative approach, such as setting an LTV around 65% and an MCR near 160%.

This conservative adjustment helps safeguard against potential risks tied to the token’s stability, supporting the protocol’s overall security.

Additionally, the protocol employs a minting cap on each asset type, limiting the maximum amount of stablecoins that can be minted against any specific collateral. This prevents overexposure to riskier assets and enhances overall stability. As market conditions evolve, for example with increased volatility in the LST token, the protocol has the flexibility to further adjust parameters like the LTV ratio or MCR to preserve system safety. Through this approach, the protocol customizes risk management for each asset type, balancing risk control with user flexibility and security.

Instant and permissionless liquidation is a key feature of the River, designed to address under-collateralized positions swiftly and efficiently. Instead of using auction models, the River allows any user to initiate the liquidation process without prior approval. This immediacy is crucial as it ensures that risky positions are dealt with promptly, preventing potential bad debt and protecting the protocol from market volatility.

When a user’s collateral falls below the 110% threshold, any participant can trigger the liquidation process. This open access system encourages active participation and provides incentives for liquidators, such as a reward percentage of the liquidated collateral and gas fee compensation. By enabling instant liquidation, the River avoids the delays associated with auction models, which can exacerbate losses during rapid market declines. The protocol’s approach ensures that liquidations are executed quickly, maintaining the integrity and stability of the overall system and mitigating the risk of further price drops impacting the collateral value.

**Example**

Imagine a user’s collateral in the River falls below the 110% threshold, making the position under-collateralized. Since the protocol does not rely on slow auction models, liquidations can be triggered immediately. A liquidation bot, continuously monitoring the system, detects this risky position. Without any need for permission, it initiates the liquidation process, selling the collateral to cover the user’s debt. This ensures that the protocol remains stable and avoids accumulating bad debt during volatile market conditions. In addition, the protocol is permissionless, meaning any user, not just the bots, can perform the liquidation. For their action, the liquidator receives 0.25% of the liquidated collateral as a reward, along with gas fee compensation. This mechanism encourages active participation from users to keep the protocol secure while allowing them to profit from liquidations.

Over-collateralization is a core principle in the River, requiring users to deposit more collateral than the value of the debt they wish to incur. This practice ensures the stability and security of the protocol, protecting against market volatility and sudden price drops. Users must maintain a Minimum Collateral Ratio (MCR) of at least 110%, with higher ratios recommended for added safety. The protocol allows different collateral types to have varied borrow rates, Loan-to-Value (LTV) ratios, and other parameters to cater to the specific risk profiles of each asset. This tailored approach ensures that the protocol remains secure and adaptable to different market conditions.

**Example**

-   **Scenario** User B deposits $2,000 worth of BTC to borrow $1,818.18 in satUSD (Collateral Ratio of 110%).
    
-   **Collateral Maintenance** To avoid liquidation, User B maintains a buffer, keeping the collateral ratio above 150%.
    
-   **Collateral Drop** If the BTC value drops, reducing the collateral value to $1,980, the system still ensures the position remains overcollateralized.
    
-   **Security** This overcollateralization protects the protocol from volatile market conditions, ensuring the stability and reliability of satUSD.
    

The Stability Pool (SP) serves as a crucial mechanism within the River, designed to preserve the system’s stability by providing liquidity for settling debts from liquidated positions. When a position undergoes liquidation, the SP uses satUSD to clear the debt and, in return, acquires the collateral from the liquidated position. Contributors to the SP are incentivized through several mechanisms, including collateral gains from liquidations, trigger rewards for initiating liquidations, and token rewards in the form of RIVER tokens. Additionally, the SP ensures that even in scenarios where it lacks sufficient funds, flash loans can be utilized to facilitate liquidations, maintaining the protocol’s stability.

**Example**

-   **Scenario** User C contributes satUSD to the Stability Pool.
    
-   **Liquidation Event** A position with a collateral ratio below 110% is liquidated. The SP uses satUSD to settle the debt.
    
-   **Collateral Acquisition** The SP acquires the liquidated collateral, providing User C with a share of the discounted collateral.
    
-   **Rewards** User C receives RIVER tokens and a portion of the collateral as incentives for their contribution.
    
-   **Flash Loan Utilization** In cases where the SP lacks sufficient funds, a flash loan is used to facilitate the liquidation, ensuring the debt is cleared and stability is maintained.
    

Recovery Mode is a critical safety mechanism within the River, designed to safeguard the system’s overall health and stability. It is triggered when the Total Collateral Ratio (TCR) falls below 150%, indicating a potential risk to the system’s stability. During Recovery Mode, specific actions are taken to prevent further decreases in the TCR and to encourage measures that would raise it back above the 150% threshold. These actions include liquidating positions with collateral ratios below 150%, restricting borrowing activities that could further compromise the TCR, and incentivizing borrowing that improves the TCR with a 0% borrowing fee. This mode ensures the protocol remains robust and can recover quickly from potential destabilizing events.

**Example**

Imagine the Total Collateral Ratio (TCR) of the River drops below 150%, signaling potential instability. To restore balance, Recovery Mode is triggered. During Recovery Mode, positions with a collateral ratio below 150% become eligible for liquidation. For example, if a user's position has a collateral ratio of 130%, it will be liquidated to help remove risky positions and improve the overall TCR. Additionally, borrowing restrictions are applied. New borrowing can only occur if it helps raise the collateral ratio above 150%, or if it strengthens existing positions. This ensures that no further strain is placed on the system. To incentivize positive action, the protocol waives all borrowing fees, allowing participants to restructure their positions at a 0% borrowing fee. This encourages users to take actions that will quickly stabilize the protocol, ensuring that the system can swiftly recover and resume normal operations.

Flash loan liquidation allows for instant liquidation of under-collateralized positions using flash loans. This method provides immediate liquidity without requiring upfront capital, ensuring that the protocol can swiftly handle liquidations even in scenarios where the Stability Pool lacks sufficient funds. By leveraging flash loans, the River can cover the debt of liquidated positions in a single transaction, which is then repaid within the same block. This approach enhances the efficiency and responsiveness of the liquidation process, maintaining the protocol’s stability and protecting against sudden market fluctuations.

**Example**

Imagine a scenario where User D spots an under-collateralized position with a collateral ratio falling below 110%. User D doesn't have the upfront capital to handle the liquidation, but initiates a flash loan, temporarily borrowing the necessary funds to cover the position’s debt. Using the flash loan, User D liquidates the position by covering its debt, selling off the collateral. The borrowed amount is then repaid instantly within the same transaction, all happening within a single block. As a result, User D earns the liquidation reward, which includes 0.25% of the liquidated collateral and compensation for gas fees. Even if the Stability Pool doesn't have enough funds, the use of flash loans ensures that liquidations can still happen smoothly and quickly, keeping the protocol stable and protecting against sudden market shifts.

Redistribution is a key component of River’s risk management strategy, ensuring that the system remains stable during liquidations, particularly in Recovery Mode. When positions fall below the required collateral ratio, instead of liquidating the collateral on the open market, debt and collateral are redistributed to healthier positions within the system. This approach helps to prevent sharp sell-offs and protects the overall stability of the protocol. In Recovery Mode, when the Total Collateral Ratio (TCR) of the system drops below a critical threshold, liquidations are managed in a way that redistributes both debt and collateral across all remaining positions. This prevents further market impact by avoiding mass collateral sales that could lead to downward price pressure. Instead, healthy positions absorb the risk by taking on a proportion of the liquidated position's debt and collateral.

Redistribution also aids in maintaining liquidity, automatically rebalancing the system by spreading risk across multiple participants. It ensures that the protocol remains solvent without destabilizing the market, offering users a more stable experience even in times of volatility. This mechanism is essential for preserving user confidence and ensuring that the protocol can continue to operate effectively during periods of market stress.

**Example**

Imagine a situation where the Total Collateral Ratio (TCR) of the River falls below the critical threshold during a period of market volatility. Instead of liquidating collateral on the open market, which could lead to sharp sell-offs and further price drops, the protocol triggers redistribution. User A holds a healthy position with a collateral ratio well above the required threshold. Meanwhile, another position has become under-collateralized. Rather than selling off the collateral from this under-collateralized position, the protocol redistributes a portion of its debt and collateral to User A and others with strong positions. This process allows the system to balance risk without impacting the market. User A absorbs part of the debt and collateral, helping to maintain the protocol’s stability. By spreading the exposure across several healthy participants, the protocol ensures liquidity remains intact and market pressure is minimized, keeping the system solvent and secure during recovery.

[arrow-up-right](https://docs.satoshiprotocol.org/mechanism/revenue-structure)

Last updated 10 months ago

-   [Isolated Risk Control](#isolated-risk-control)
-   [Instant & Permissionless Liquidation](#instant-and-permissionless-liquidation)
-   [Over-collateralization](#over-collateralization)
-   [Stability Pool Mechanism](#stability-pool-mechanism)
-   [Recovery Mode](#recovery-mode)
-   [Flash Loan Liquidation](#flash-loan-liquidation)
-   [Redistribution](#redistribution)