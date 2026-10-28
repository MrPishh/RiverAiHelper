# Doc: products-swap
Source: https://docs.riverai.inc/products/swap
Scraped: 2026-05-09T13:49:49.875Z

---

⌘Ctrlk

1.  [Products](https://docs.riverai.inc/products)

## rotateSwap

The Swap Module in the River allows users to easily exchange popular stablecoins, such as USDT and USDC, for the protocol’s native stablecoin, satUSD. This feature ensures stable and seamless liquidity, supporting satUSD’s utility and maintaining its peg to the US dollar.

1.  **Maintaining Stability and Peg** The Swap Module helps maintain satUSD’s stable peg to USD by enabling users to swap USDT or USDC for satUSD at a fixed 1:1 ratio. This mechanism ensures that satUSD remains tightly aligned with the value of the US dollar, fostering user trust and enhancing stability within the protocol.
    
2.  **User Incentives and Engagement** The module incentivizes user participation in the ecosystem by offering a simple, reliable way to acquire satUSD. Users can then access various DeFi opportunities within the River, enhancing liquidity and user engagement.
    
3.  **Risk Management and Security** Stablecoins swapped for satUSD are held securely within the protocol’s vault, managed with a focus on security and liquidity. This structure helps safeguard the protocol from market volatility, ensuring satUSD remains reliable for all users.
    

1.  **User Initiates Swap** A user initiates a swap transaction within the Swap Module interface, selecting either USDT or USDC to exchange for satUSD.
    
2.  **Stablecoins Sent to Swap Vault** The user’s USDT or USDC is transferred to the Swap Vault, a secure repository managed by the River.
    
3.  **satUSD Issuance** Upon receiving the stablecoins, the protocol mints an equivalent amount of satUSD (1:1 ratio) and sends it to the user’s wallet. This issuance ensures that satUSD remains pegged to the US dollar.
    
4.  **User Confirmation** The user receives satUSD in their wallet, ready for use within the River ecosystem or in any other compatible DeFi applications.
    

The Swap Module is central to maintaining satUSD’s peg to the US dollar within the River. By allowing users to exchange stablecoins like USDT and USDC for satUSD at a fixed 1:1 rate, the module ensures that satUSD holds a stable value tightly linked to USD. This peg is vital for satUSD’s stability, reliability, and usability across the River ecosystem.

The Swap Module also creates natural arbitrage opportunities to stabilize satUSD’s value whenever it deviates from 1 USD, reinforcing the peg. Here’s how this works:

-   **Scenario 1: satUSD Trades Below 1 USD**
    
    -   Situation: If satUSD trades at a discount, say 0.98 USD on the open market.
        
    -   Arbitrage Action: Arbitrageurs purchase satUSD at the market rate of 0.98 USD.
        
    -   Swap Mechanism: They then swap the acquired satUSD for USDT or USDC through the Swap Module at the fixed 1:1 rate.
        
    -   Profit: For each satUSD bought at 0.98 USD, they receive 1 USD in stablecoins, profiting 0.02 USD per satUSD.
        
    -   Result: This buying pressure on satUSD raises its market value back towards 1 USD, stabilizing the peg.
        
    
-   **Scenario 2: satUSD Trades Above 1 USD**
    
    -   Situation: If satUSD trades above 1 USD, for example, at 1.02 USD on the open market.
        
    -   Arbitrage Action: Arbitrageurs swap USDT or USDC for satUSD through the Swap Module at the 1:1 rate.
        
    -   Market Sale: They sell the acquired satUSD at the market rate of 1.02 USD.
        
    -   Profit: They make 0.02 USD per satUSD by selling at the higher market price.
        
    -   Result: This selling pressure on satUSD lowers its price, bringing it back to 1 USD, reinforcing the peg.
        
    

These arbitrage dynamics create a self-correcting mechanism that maintains satUSD’s value near 1 USD. Whenever the price deviates, the module incentivizes arbitrageurs to act, supporting satUSD’s stability and reliability as a stablecoin.

[arrow-up-right](https://docs.satoshiprotocol.org/satoshi-protocol-v1/mechanism/nexus-yield-module-nym)

Last updated 11 months ago

-   [Purpose and Benefits of the Swap Module in River](#purpose-and-benefits-of-the-swap-module-in-satoshi-protocol)
-   [Asset Swapping Process](#asset-swapping-process)
-   [Significance of Swap](#significance-of-swap)