# Doc: products-editor-minting
Source: https://docs.river.inc/products/editor/minting
Scraped: 2026-05-09T13:49:38.124Z

---

⌘Ctrlk

1.  [Products](https://docs.river.inc/products)chevron-right
2.  [dollar-signOmni-CDP](https://docs.river.inc/products/editor)

## Minting

River allows users to collateralize BTC and LST assets across multiple chains and mint satUSD on any supported destination chain. With the integration of LayerZero’s OFT (Omnichain Fungible Token) standard, River introduces a seamless omnichain minting experience, eliminating liquidity fragmentation and unlocking BTC’s full potential across EVM, Solana, and Bitcoin Layer 2 ecosystems.

River introduces Omni-CDP, enabling users to deposit BTC or LST on a source chain and mint satUSD on a destination chain.

![](https://docs.river.inc/~gitbook/image?url=https%3A%2F%2F3162812039-files.gitbook.io%2F%7E%2Ffiles%2Fv0%2Fb%2Fgitbook-x-prod.appspot.com%2Fo%2Fspaces%252FPZA7LS6LjeZIqysGy3p7%252Fuploads%252Fltl964Muq1lSqAqWtkBY%252Fimage.png%3Falt%3Dmedia%26token%3D94935bc4-6408-4d7e-a924-e6c953242d68&width=768&dpr=3&quality=100&sign=d497b95e&sv=2)

**How It Works?**

1.  **Deposit Collateral**
    
    -   Users deposit BTC or BTC LSTs on a supported source chain (e.g., Bitcoin L2, Ethereum, Solana).
        
    
2.  **Omnichain Minting**
    
    -   satUSD is minted on any supported destination chain based on the deposited collateral.
        
    
3.  **Cross-Chain Liquidity**
    
    -   satUSD can be transferred across chains without wrapped assets or liquidity fragmentation, ensuring unified liquidity across the ecosystem.
        
    

**How LayerZero Enables Cross-Chain Minting & Transfers?**

1.  **Burn & Lock Mechanism**
    
    -   On the source chain, satUSD is burned or locked, ensuring total supply consistency.
        
    
2.  **LayerZero Messaging**
    
    -   LayerZero transmits a cross-chain message, triggering minting on the destination chain.
        
    
3.  **Omnichain Minting & Liquidity Preservation**
    
    -   satUSD is minted on the destination chain, ensuring consistent collateral ratios across all supported networks.
        
    

-   The River OApp (deployed on LayerZero) manages cross-chain minting, position creation, and liquidationsvia `_lzSend` and `_lzReceive` functions.
    
-   This ensures all chains maintain synchronized debt and collateral data, preventing inconsistencies.
    

When minting satUSD, the protocol imposes:

-   **Minting Fee**: Calculated as the **Base Rate + 0.5%** (minimum of **0.5%**, maximum of **5%**).
    

-   **Gas Compensation**: A reserve of **2 satUSD** set aside for gas fees. This reserve is intended to cover potential costs associated with the liquidation process. If the position is closed without liquidation, the 2 satUSD will not be charged.
    

TotalMintingFee\=MintingFee+InterestFee+GasCompensationTotalMinting Fee=MintingFee + InterestFee + Gas CompensationTotalMintingFee\=MintingFee+InterestFee+GasCompensation

While the annual interest fee is fixed, the one-time minting fee is calculated as "base rate + 0.5%" and is applied to the total amount of satUSD minted.

MintingFeet\=BaseRatet+0.5%Minting Fee\_t = BaseRate\_t + 0.5 \\%MintingFeet​\=BaseRatet​+0.5%

The current base rate is determined by previous base rate and the quantity of satUSD redeemed as a proportion of the total stablecoin supply. This dynamic fee structure has a minimum of 0.5% and a maximum cap of 5%, ensuring flexibility based on market conditions.

BaseRatet\=BaseRatet−1+0.5×mnBaseRate\_t = BaseRate\_{t−1} + 0.5 × \\frac{m}{n}BaseRatet​\=BaseRatet−1​+0.5×nm​

where mmm denotes the amount of redeemed satUSD, nnn signifies the current supply of satUSD.

Over time, the base rate experiences decay due to a decay factor applied with every satUSD redemption and issuance before calculating the resulting fee. The decay follows the form:

BaseRatet\=BaseRatet−1×δ∆tBaseRate\_t = BaseRate\_{t−1} × δ^{∆t}BaseRatet​\=BaseRatet−1​×δ∆t

Where `δ` represents an hourly decay factor (0.944 in our case), and `∆t` denotes the time elapsed in hours since the last redemption or loan issuance. The decay factor `δ` is selected to ensure a 12-hour half-life for the base rate.

**Example**: If the base rate is set at 0.5% and a user deposits BTC worth $2,000 to mint 2,000 satUSD, they will incur a 0.5% one-time minting fee, amounting to 10 satUSD, and an additional 2 satUSD for gas compensation. Consequently, while the user receives 2,000 satUSD, their total debt is 2,012 satUSD. To fully close the Position and retrieve their BTC collateral, the users must settle this 2,012 satUSD debt.

In Recovery Mode, minting is restricted to protect against liquidation risks. Users should keep their collateral ratio well above the MCR (ideally over 150%) to minimize liquidation risk.

This strategy decreases the likelihood of liquidation and reduces the potential impact of large redemptions on their positions.

* * *

Currently, the Borrow Interest Rate is 0% when using BTC as collateral. This interest accumulates over time, serving as a revenue stream for the protocol.

Interest accrues on the minted satUSD for all users within the protocol. The accumulation of interest is triggered by any interaction with the smart contracts, ensuring that the debt value remains up-to-date with the accrued interest over time.

**Example of Interest Accrual**

-   Alice mints 10,000 satUSD against her BTC collateral.
    
-   The annual interest rate is fixed, which translates to about debt amount times 1.427×10−91.427 × 10^{-9}1.427×10−9 per second.
    
-   If there is no interaction with the smart contract for 100 seconds, interest continues to accrue on Alice's minted amount during this period.
    
-   Upon a subsequent interaction with the protocol (e.g., Bob mints some satUSD), Alice's debt would reflect the accrued interest over those 100 seconds.
    

**Using the specific per second interest rate**

-   The additional interest accrued over 100 seconds on Alice's initial minting of 10,000 satUSD would be 10,000×1.427×10−9\=0.000142710,000×1.427×10^{-9}=0.000142710,000×1.427×10−9\=0.0001427 satUSD.
    
-   Alice’s updated debt would be 10,000+0.0001427\=10,000.000142710,000+0.0001427=10,000.000142710,000+0.0001427\=10,000.0001427 satUSD after 100 seconds of accrued interest. For the next updated debt calculation, it would based on this amount of 10,000.0001427 satUSD.
    

The minting process in the River facilitates liquidity while ensuring stability. By maintaining over-collateralization, users can safely manage their debt while contributing to the overall health of the ecosystem.

Last updated 11 months ago

-   [Omnichain Minting via LayerZero](#omnichain-minting-via-layerzero)
-   [Minting Costs](#minting-costs)
-   [Restrictions During Recovery Mode](#restrictions-during-recovery-mode)
-   [Borrow Interest Rate](#borrow-interest-rate)
-   [Detailed Interest Amount Calculation](#detailed-interest-amount-calculation)