# Doc: outro-satusd-oracle-weighted-asset-rate
Source: https://docs.river.inc/outro/satusd-oracle/weighted-asset-rate
Scraped: 2026-05-09T13:49:54.582Z

---

⌘Ctrlk

1.  [OUTRO](https://docs.river.inc/outro)chevron-right
2.  [arrow-progresssatUSD Oracle](https://docs.river.inc/outro/satusd-oracle)

## Weighted Asset Rate

Weighted asset rate represents the **average price of the assets backing satUSD**.

It calculates a **debtTokenMinted-weighted average rate** across all supported backing assets. In other words, it shows the overall price level of the asset pool supporting satUSD.

The function iterates through all supported assets and applies the following rules:

-   Only supported assets are included
    
-   Only assets with `debtTokenMinted > 0` are counted
    
-   Each asset is weighted by its `debtTokenMinted`
    
-   If an asset does not use an oracle, its price is treated as $1
    
-   If an asset uses an oracle, the on-chain price is fetched and validated against `minPrice` and `maxPrice`
    

Formula:

```
Weighted Asset Rate = Σ(asset price × debtTokenMinted) / Σ(debtTokenMinted)
```

Protocols, vaults, or monitoring contracts can call `getWeightedAssetRate()` to read the **debtTokenMinted-weighted average price of the assets backing satUSD**.

Contracts can integrate with the `NexusYieldManagerFacet` through the **SatoshiXApp contract address on each chain**.

For deployed addresses, please refer to the **Deployed Contract** page and use the corresponding **SatoshiXApp** address for that chain.

For example, to read the value on Ethereum, use the **Ethereum SatoshiXApp** address shown on that page:

[Ethereumchevron-right](https://docs.river.inc/outro/deployed-contracts/ethereum)

`getWeightedAssetRate()` returns a `uint256` scaled by `1e18`.

This means:

-   `1e18` = $1.00
    
-   `1.02e18` = $1.02
    
-   `0.98e18` = $0.98
    

The call may revert in the following cases:

-   `NoActiveAssets()` if no asset currently contributes weight
    
-   `InvalidPrice(uint256 price)` if an oracle price is outside the allowed range
    

Last updated 1 month ago

-   [How It Works](#how-it-works)
-   [Contract Integration](#contract-integration)

```
interface INexusYieldManagerFacet {
    function getWeightedAssetRate() external returns (uint256);
}
```