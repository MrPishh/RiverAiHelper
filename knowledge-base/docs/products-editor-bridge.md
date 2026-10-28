# Doc: products-editor-bridge
Source: https://docs.riverai.inc/products/editor/bridge
Scraped: 2026-05-09T13:49:43.405Z

---

⌘Ctrlk

1.  [Products](https://docs.riverai.inc/products)chevron-right
2.  [dollar-signOmni-CDP](https://docs.riverai.inc/products/editor)

## Bridge

River introduces Omnichain Bridging, enabling users to transfer satUSD seamlessly across multiple blockchains without relying on wrapped assets or liquidity fragmentation.

Powered by LayerZero’s OFT (Omnichain Fungible Token) standard, this bridge ensures low fees, instant transfers, and unified liquidity across EVM chains, Solana, and Bitcoin Layer 2 networks.

Here’s a table showing which source chains can bridge satUSD to different destination chains.

BOB

✅

✅

❌

✅

BEVM

❌

✅

❌

❌

Bitlayer

❌

❌

✅

❌

BSquared

✅

❌

❌

✅

1.  **Initiate a Cross-Chain Transfer**
    
    -   Users send satUSD from Chain A (source chain) to Chain B (destination chain).
        
    
2.  **Burn & Lock Mechanism**
    
    -   On the source chain, satUSD is burned or locked to maintain total supply consistency.
        
    
3.  **LayerZero Messaging System**
    
    -   A LayerZero cross-chain message is sent, verifying the transaction and triggering the minting process on the destination chain.
        
    
4.  **Mint & Unlock on the Destination Chain**
    
    -   The same amount of satUSD is minted or unlocked on the destination chain, ensuring a consistent total supply across all chains.
        
    

This trustless and decentralized process allows satUSD to move freely across chains without third-party bridges, wrapped tokens, or liquidity pools.

-   **Omnichain Transfers**: Move satUSD natively across supported blockchains.
    
-   **No Wrapped Assets**: Eliminates the risks of wrapped token depegging.
    
-   **Unified Liquidity**: satUSD maintains a single, consistent total supply across chains.
    
-   **Low Fees & Fast Settlement**: Transactions are efficient and cost-effective, with minimal slippage.
    
-   **Decentralized & Secure**: Powered by LayerZero’s infrastructure, ensuring trustless execution.
    

River leverages **LayerZero’s cross-chain interoperability technology** to enable secure and instant bridging:

-   **OFT Standard**: Facilitates **seamless satUSD transfers** without requiring external liquidity providers.
    
-   **Cross-Chain Messaging**: LayerZero’s **\_lzSend and \_lzReceive functions** handle omnichain transactions **securely and efficiently.**
    
-   **Burn & Mint Mechanism**: Ensures that satUSD’s total supply remains **synchronized across all integrated chains.**
    

-   **Solving Fragmented Liquidity** → Unified satUSD supply across all chains, eliminating isolated liquidity pools.
    
-   **Maximizing BTC Utility** → Use satUSD for DeFi, payments, and staking across different ecosystems without friction.
    
-   **Future-Proof Interoperability** → Built for a multi-chain world, supporting EVM, Solana, and Bitcoin Layer 2 ecosystems.
    

Last updated 11 months ago

-   [Supported satUSD Bridge Routes](#supported-satusd-bridge-routes)
-   [How the satUSD Bridge Works](#how-the-satusd-bridge-works)
-   [Key Features of the satUSD Bridge](#key-features-of-the-satusd-bridge)
-   [LayerZero: The Backbone of satUSD Bridging](#layerzero-the-backbone-of-satusd-bridging)
-   [Why This Changes the Game](#why-this-changes-the-game)