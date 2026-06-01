# Doc: intro-faq
Source: https://docs.river.inc/intro/faq
Scraped: 2026-05-09T13:49:35.405Z

---

⌘Ctrlk

1.  [Intro](https://docs.river.inc/intro)

## questionFAQ

chevron-rightWhat is River[hashtag](#what-is-river)

River is building the first chain-abstraction stablecoin system that connects liquidity across ecosystems. Powered by omni-CDP’s satUSD, users can collateralize on one chain and mint on another—unlocking native cross-chain capital flow without friction.

chevron-rightWhat’s new in River?[hashtag](#whats-new-in-river)

1.  **Omni-CDP integration:** Enables users to collateralize their BTC and BTC LST assets and allows them to mint satUSD on any integrated chains.
    

chevron-rightHow to use River[hashtag](#how-to-use-river)chevron-rightWhat’s LayerZero?[hashtag](#whats-layerzero)

[LayerZeroarrow-up-right](https://layerzero.network/?ref=blog.satoshiprotocol.org) is an omnichain interoperability protocol that enables seamless communication between different blockchains. It allows developers to build omnichain applications (OApps) that can interact across multiple chains as if they were on a single chain.

chevron-rightWhat is satUSD?[hashtag](#what-is-satusd)

satUSD is an over-collateralized stablecoin backed by BTC, ETH, BNB, and other liquid staking tokens (LSTs). It lets users access liquidity without selling their assets and earn yield by staking satUSD to share protocol revenue.

chevron-rightWhat is Omni-CDP?[hashtag](#what-is-omni-cdp)

River has launched V2, introducing the first Omni-CDP integrated with LayerZero to enable omnichain liquidity management for BTC, ETH, BNB and LST.

With this upgrade, users can deposit BTC or BTC LSTs (e.g., solvBTC, LBTC) on any supported chain and seamlessly mint satUSD on a destination chain.

This architecture enhances BTC liquidity across ecosystems, unlocking new opportunities for yield, trading, and capital efficiency.

chevron-rightWhat makes satUSD different from other stablecoins?[hashtag](#what-makes-satusd-different-from-other-stablecoins)

satUSD is a universal stablecoin backed by Bitcoin. It offers greater transparency and user control compared to fiat-backed centralized stablecoins.

chevron-rightHow can I mint satUSD?[hashtag](#how-can-i-mint-satusd)

You can deposit BTC, ETH, BNB and LST as collateral on the source chain and choose to mint satUSD on a destination chain.

To ensure the stability of your position, a minimum collateral ratio (MCR) is required: **110% for BTC and 120%-150% for LSTs**, though the exact ratio may vary depending on the specific asset

chevron-rightWhat are the fees for minting satUSD?[hashtag](#what-are-the-fees-for-minting-satusd)

There is a one-time minting fee that ranges from 0.5% to 5%, and a 0% interest fee. _Learn more about minting fees_ [_here_](https://docs.river.inc/products/editor/minting#minting-costs)_. Why 0% interest fee? Learn more_ [_here_arrow-up-right](https://blog.satoshiprotocol.org/satoshi-protocol-slashes-borrowing-fees-to-0-unlock-bitcoin-liquidity-with-unprecedented-efficiency/)

chevron-rightWhat is gas compensation?[hashtag](#what-is-gas-compensation)

Gas compensation refers to a small reserve of satUSD set aside to cover transaction fees associated with the liquidation of your position.

chevron-rightHow does satUSD maintain its peg to the US dollar?[hashtag](#how-does-satusd-maintain-its-peg-to-the-us-dollar)

satUSD maintains its peg through over-collateralization, an instant liquidation module, and a peg mechanism.

1.  If satUSD drops below $1, arbitragers can purchase discounted satUSD and redeem it for $1 worth of BTC from the protocol.
    
2.  If satUSD exceeds $1.10, users can mint satUSD at 110% MCR and sell it immediately on the market.
    

chevron-rightWhy is my position liquidated?[hashtag](#why-is-my-position-liquidated)

If your position’s collateral ratio fall below 110%, it will be allowed to trigger liquidation, which mean your collateral will be sold to stability pool providers for satUSD to repay your debt.

chevron-rightHow can I avoid liquidations?[hashtag](#how-can-i-avoid-liquidations)

To avoid liquidations, maintain a healthy collateralization ratio, typically above 150%. You can add collateral to your position or repay part of your debt to improve the ratio and prevent liquidation.

chevron-rightHow can I close position and claim my collateral?[hashtag](#how-can-i-close-position-and-claim-my-collateral)

You can close your position by repaying your satUSD debt in full. Once the debt is repaid, you can claim your collateral.

chevron-rightHow does Recovery Mode work?[hashtag](#how-does-recovery-mode-work)

During Recovery Mode, actions are taken to improve the Total Collateral Ratio (TCR) to 150%:

1.  Positions with a collateral ratio below 150% are liquidated.
    
2.  Minting is restricted to maintaining a 150% Minimum Collateral Ratio (MCR).
    
3.  To incentivize recovery, the minting fee is set to 0%.
    

chevron-rightCan I use satUSD across other chains?[hashtag](#can-i-use-satusd-across-other-chains)

Yes, satUSD is designed to operate on multiple chains, currently it works on BEVM, BOB, BSquared, & Bitlayer. We are working on to add more chains.

chevron-rightHas River been audited?[hashtag](#has-river-been-audited)

Yes, River has undergone audits to ensure security and safety. The audits were conducted by Scalebit, Supremacy, and Billh.

For more details, you can view the _audit reports_

chevron-rightWhat is Stability Pool?[hashtag](#what-is-stability-pool)

The Stability Pool (SP) is a key part of the River that maintains system stability by providing liquidity for settling debts from liquidated positions. Users can deposit satUSD into the pool and benefit from discounted liquidated collateral.

chevron-rightCan I earn rewards from the Stability Pool?[hashtag](#can-i-earn-rewards-from-the-stability-pool)

Yes, users can deposit satUSD into the pool and benefit from discounted liquidated collateral.

chevron-rightHow is the APR on the Stability Pool calculated?[hashtag](#how-is-the-apr-on-the-stability-pool-calculated)

The APR displayed on the protocol is calculated based on the average amount of collateral liquidated over the past 7 days, along with the current BTC price.

chevron-rightWhy is my satUSD in the Stability Pool decreasing?[hashtag](#why-is-my-satusd-in-the-stability-pool-decreasing)

If you find your deposited satUSD decreasing, it means a liquidation has occurred. satUSD depositors gain liquidated collateral, such as wBTC, tBTC, etc., at a discounted price.

chevron-rightWhy my BTC balance didn’t increase after claiming liquidation from the stability pool?[hashtag](#why-my-btc-balance-didnt-increase-after-claiming-liquidation-from-the-stability-pool)

The reward you claim from the Stability Pool liquidation is wBTC, please add the wBTC contract address to your wallet. Keep in mind that the contract addresses for wBTC can differ based on the chain you are using, so make sure to verify and use the correct address for the specific chain you are operating on.

chevron-rightCan I swap satUSD to USDT/USDC?[hashtag](#can-i-swap-satusd-to-usdt-usdc)

Yes, you can swap satUSD for USDT/USDC at a 1:1 ratio. Please note that there is a 3-day lock-up period for withdrawals.

chevron-rightWhy is there a 3-day lock-up period for satUSD to USDT swaps?[hashtag](#why-is-there-a-3-day-lock-up-period-for-satusd-to-usdt-swaps)

The 3-day lock-up period is implemented to ensure sufficient liquidity is available for transactions. This measure helps maintain the stability of the market and protects users' funds.

chevron-rightHow does satUSD Bridge work? [hashtag](#how-does-satusd-bridge-work)

satUSD adopts the **OFT (Omnichain Fungible Token) standard**, enabling **native cross-chain transfers** without using wrapped assets. We have integrated with **LayerZero**, allowing satUSD to move seamlessly across supported networks while maintaining a **consistent total supply**.

LayerZero Bridge : [https://app.satoshiprotocol.org/bridgearrow-up-right](https://app.satoshiprotocol.org/bridge)

chevron-rightWhich chains support satUSD bridging?[hashtag](#which-chains-support-satusd-bridging)

The availability of satUSD bridging **varies by network**. Some chains allow direct bridging between multiple networks, while others may have restrictions.

For the latest supported chains and bridging options, please refer to the [**Bridge**](https://docs.river.inc/products/editor/bridge)**.**

chevron-right**What is Redemption?**[hashtag](#what-is-redemption)

Redemption allows users to exchange 1 satUSD for $1 USD worth of collateral. This feature ensures that satUSD maintains its value and provides users with a mechanism to utilize their satUSD effectively.

chevron-rightCan I exchange satUSD for BTC or other assets?[hashtag](#can-i-exchange-satusd-for-btc-or-other-assets)

Yes, you can exchange satUSD for BTC or other assets. Simply go to the River app and navigate to the Redemption section.

chevron-rightHow does Redemption work?[hashtag](#how-does-redemption-work)

Redemption begins with liquidating positions having the lowest Collateralization Ratio (CR). To avoid your position being redeemed by others, it’s important to maintain a higher CR than the average.

chevron-rightHow does the Redemption fee work?[hashtag](#how-does-the-redemption-fee-work)

The Redemption fee is a dynamic fee that ranges from 0.5% to 5%, calculated based on market volatility.

For more FAQs and explanatory videos, please visit [Discord FAQ channelarrow-up-right](https://discord.com/channels/1212686319596216350/1212770924965928980).

chevron-rightWhat is River?[hashtag](#what-is-river-1)

River is building the circulatory system for crypto, connecting capital, liquidity, and yield across chains. Powered by the omni-CDP stablecoin protocol, it lets you earn, leverage, and scale—without selling your assets.

chevron-rightWhat is satUSD?[hashtag](#what-is-satusd-1)

satUSD is an over-collateralized stablecoin backed by BTC, ETH, BNB, and other liquid staking tokens (LSTs).

It lets users access liquidity without selling their assets and earn yield by staking satUSD to share protocol revenue.

chevron-rightWhat is CDP?[hashtag](#what-is-cdp)

CDP, or Collateralized Debt Position, allows users to deposit BTC as collateral to borrow the stablecoin satUSD. It requires a minimum collateral ratio (MCR) of 110%, enabling users to hold BTC while accessing liquidity.

chevron-rightWhat makes satUSD different from other stablecoins?[hashtag](#what-makes-satusd-different-from-other-stablecoins-1)

satUSD is a universal stablecoin backed by Bitcoin. It offers greater transparency and user control compared to fiat-backed centralized stablecoins.

chevron-rightHow can I mint satUSD?[hashtag](#how-can-i-mint-satusd-1)

You can mint satUSD by depositing BTC as collateral. This process requires maintaining a minimum collateral ratio (MCR) of 110% to ensure the stability of your position.

chevron-rightWhat are the fees for minting satUSD?[hashtag](#what-are-the-fees-for-minting-satusd-1)chevron-rightWhat is gas compensation?[hashtag](#what-is-gas-compensation-1)

Gas compensation refers to a small reserve of satUSD set aside to cover transaction fees associated with the liquidation of your position.

chevron-rightHow does satUSD maintain its peg to the US dollar?[hashtag](#how-does-satusd-maintain-its-peg-to-the-us-dollar-1)

satUSD maintains its peg through over-collateralization, an instant liquidation module, and a peg mechanism.

1.  If satUSD drops below $1, arbitragers can purchase discounted satUSD and redeem it for $1 worth of BTC from the protocol.
    
2.  If satUSD exceeds $1.10, users can mint satUSD at 110% MCR and sell it immediately on the market.
    

chevron-rightWhy is my position liquidated?[hashtag](#why-is-my-position-liquidated-1)

If your position’s collateral ratio fall below 110%, it will be allowed to trigger liquidation, which mean your collateral will be sold to stability pool providers for satUSD to repay your debt.

chevron-rightHow can I avoid liquidations?[hashtag](#how-can-i-avoid-liquidations-1)

To avoid liquidations, maintain a healthy collateralization ratio, typically above 150%. You can add collateral to your position or repay part of your debt to improve the ratio and prevent liquidation.

chevron-rightHow can I close position and claim my collateral?[hashtag](#how-can-i-close-position-and-claim-my-collateral-1)

You can close your position by repaying your satUSD debt in full. Once the debt is repaid, you can claim your collateral.

chevron-rightHow does Recovery Mode work?[hashtag](#how-does-recovery-mode-work-1)

During Recovery Mode, actions are taken to improve the Total Collateral Ratio (TCR) to 150%:

1.  Positions with a collateral ratio below 150% are liquidated.
    
2.  Minting is restricted to maintaining a 150% Minimum Collateral Ratio (MCR).
    
3.  To incentivize recovery, the minting fee is set to 0%.
    

chevron-rightCan I use satUSD across other chains?[hashtag](#can-i-use-satusd-across-other-chains-1)

Yes, satUSD is designed to operate on multiple chains, currently it works on BEVM, BOB, & Bitlayer. We are working on to add more chains.

chevron-rightHas Satoshi Protocol been audited?[hashtag](#has-satoshi-protocol-been-audited)

Yes, Satoshi Protocol has undergone audits to ensure security and safety. The audits were conducted by Scalebit, Supremacy, and Billh.

For more details, you can view the [_audit reports_arrow-up-right](https://docs.satoshiprotocol.org/outro/audit-reports)

chevron-rightWhat is Stability Pool?[hashtag](#what-is-stability-pool-1)

The Stability Pool (SP) is a key part of the River that maintains system stability by providing liquidity for settling debts from liquidated positions. Users can deposit satUSD into the pool and benefit from discounted liquidated collateral.

chevron-rightCan I earn rewards from the Stability Pool?[hashtag](#can-i-earn-rewards-from-the-stability-pool-1)

Yes, users can deposit satUSD into the pool and benefit from discounted liquidated collateral.

chevron-rightHow is the APR on the Stability Pool calculated?[hashtag](#how-is-the-apr-on-the-stability-pool-calculated-1)

The APR displayed on the protocol is calculated based on the average amount of collateral liquidated over the past 7 days, along with the current BTC price.

chevron-rightWhy is my satUSD in the Stability Pool decreasing?[hashtag](#why-is-my-satusd-in-the-stability-pool-decreasing-1)

If you find your deposited satUSD decreasing, it means a liquidation has occurred. satUSD depositors gain liquidated collateral, such as wBTC, tBTC, etc., at a discounted price.

chevron-rightWhy my BTC balance didn’t increase after claiming liquidation from the stability pool?[hashtag](#why-my-btc-balance-didnt-increase-after-claiming-liquidation-from-the-stability-pool-1)

The reward you claim from the Stability Pool liquidation is wBTC, please add the wBTC contract address to your wallet. Keep in mind that the contract addresses for wBTC can differ based on the chain you are using, so make sure to verify and use the correct address for the specific chain you are operating on.

chevron-rightCan I swap satUSD to USDT/USDC?[hashtag](#can-i-swap-satusd-to-usdt-usdc-1)

Yes, you can swap satUSD for USDT/USDC at a 1:1 ratio. Please note that there is a 3-day lock-up period for withdrawals.

chevron-rightWhy is there a 3-day lock-up period for satUSD to USDT swaps?[hashtag](#why-is-there-a-3-day-lock-up-period-for-satusd-to-usdt-swaps-1)

The 3-day lock-up period is implemented to ensure sufficient liquidity is available for transactions. This measure helps maintain the stability of the market and protects users' funds.

chevron-right**What is Redemption?**[hashtag](#what-is-redemption-1)

Redemption allows users to exchange 1 satUSD for $1 USD worth of collateral. This feature ensures that satUSD maintains its value and provides users with a mechanism to utilize their satUSD effectively.

chevron-rightCan I exchange satUSD for BTC or other assets?[hashtag](#can-i-exchange-satusd-for-btc-or-other-assets-1)

Yes, you can exchange satUSD for BTC or other assets. Simply go to the Satoshi Protocol app and navigate to the Redemption section.

chevron-rightHow does Redemption work?[hashtag](#how-does-redemption-work-1)

Redemption begins with liquidating positions having the lowest Collateralization Ratio (CR). To avoid your position being redeemed by others, it’s important to maintain a higher CR than the average.

chevron-rightHow does the Redemption fee work?[hashtag](#how-does-the-redemption-fee-work-1)

The Redemption fee is a dynamic fee that ranges from 0.5% to 5%, calculated based on market volatility.

For more FAQs and explanatory videos, please visit [Discord FAQ channelarrow-up-right](https://discord.com/channels/1212686319596216350/1212770924965928980).

Last updated 8 months ago

-   [General FAQs](#general-faqs)
-   [Stability Pool Related FAQs](#stability-pool-related-faqs)
-   [Swap Related FAQs](#swap-related-faqs)
-   [Bridge Related FAQs](#swap-related-faqs-1)
-   [Redemption Related FAQs](#redemption-related-faqs)
-   [General FAQs](#general-faqs-1)
-   [Stability Pool Related FAQs](#stability-pool-related-faqs-1)
-   [Swap Related FAQs](#swap-related-faqs-2)
-   [Redemption Related FAQs](#redemption-related-faqs-1)