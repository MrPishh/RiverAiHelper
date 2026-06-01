# Doc: products-editor-recovery-mode
Source: https://docs.river.inc/products/editor/recovery-mode
Scraped: 2026-05-09T13:49:42.194Z

---

⌘Ctrlk

1.  [Products](https://docs.river.inc/products)chevron-right
2.  [dollar-signOmni-CDP](https://docs.river.inc/products/editor)

## Recovery Mode

Recovery Mode is a critical safety mechanism within the River, designed to protect the overall health and stability of the system. This mode is activated when the Total Collateral Ratio (TCR) falls below a specific threshold, initiating a set of rules aimed at restoring balance and safeguarding user interests.

The Total Collateral Ratio (TCR) measures the system's overall leverage, calculated by dividing the dollar value of all collateral by the total debt in satUSD. A healthy TCR indicates a well-collateralized system, while a low TCR signals potential liquidity issues and system instability.

Recovery Mode is triggered when the TCR drops below 150%. The TCR is a key metric that measures the overall health of the system by comparing the total dollar value of all collateral to the total system debt. A TCR below 150% indicates potential risks to the system's stability, prompting the activation of Recovery Mode.

During Recovery Mode, specific actions are implemented to prevent further decreases in the TCR and encourage measures that will raise it back above the 150% threshold:

-   **Liquidations**: Positions with a collateral ratio below 150% become eligible for liquidation. This process helps eliminate riskier positions from the system, contributing to the restoration of a healthy TCR.
    
-   **Minting Restrictions**: The system temporarily restricts minting activities that could further compromise the TCR. While new satUSD can still be issued, it is limited to adjustments that improve existing positions' collateral ratios or the creation of new positions with a collateral ratio of 150% or higher.
    
-   **Incentives for Recovery**: To encourage positive actions during Recovery Mode, the minting fee is set to 0%. This incentive stimulates the system's recovery by facilitating minting under strict conditions that enhance the TCR.
    

To protect your position from liquidation during Recovery Mode:

-   **Increase Collateral Ratio**: Boost your position's collateral ratio to 150% or above by adding more collateral or repaying part of the debt.
    
-   **Understand Liquidation Risks**: Positions with collateral ratios below 150% are vulnerable to liquidation during Recovery Mode. It is highly recommended to maintain a collateral ratio above this threshold in both normal and Recovery Modes to avoid potential liquidation.
    

The behavior of liquidations during Recovery Mode is structured as follows:

ICR <=100%

Redistribute all debt and collateral to Position.

100% < ICR < MCR & SP's satUSD > Position debt

satUSD in the SP equal to the Position's debt is offset with the Position's debt. The Position's collateral is shared between depositors.

100% < ICR < MCR & SP's satUSD < Position debt

The total SP's satUSD is offset with an equal amount of debt from the Position. A fraction of the Position's collateral (equal to the ratio of its offset debt to its entire debt) is shared between depositors. The remaining debt and collateral are redistributed to all Positions.

MCR <= ICR < TCR & SP's satUSD >= Position debt

The SP's satUSD is offset with an equal amount of debt from the Position. A fraction of collateral with a dollar value equal to `1.1 * debt` is shared between depositors. Nothing is redistributed to other Positions.

MCR <= ICR < TCR & SP's satUSD < Position debt

No action is taken.

ICR >= TCR

No action is taken.

Recovery Mode is a essential component of the River's risk management framework, meticulously designed to uphold system stability and protect users' interests. By understanding and adhering to the principles and requirements of Recovery Mode, participants can help ensure the long-term health and success of the platform.

Last updated 11 months ago

-   [Total Collateral Ratio (TCR)](#total-collateral-ratio-tcr)
-   [What Triggers Recovery Mode?](#what-triggers-recovery-mode)
-   [Implications of Recovery Mode](#implications-of-recovery-mode)
-   [Managing Your Position in Recovery Mode](#managing-your-position-in-recovery-mode)
-   [Liquidations in Recovery Mode](#liquidations-in-recovery-mode)