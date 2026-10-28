# Doc: outro-satusd-oracle-dia-oracle
Source: https://docs.riverai.inc/outro/satusd-oracle/dia-oracle
Scraped: 2026-05-09T13:49:55.843Z

---

⌘Ctrlk

1.  [OUTRO](https://docs.riverai.inc/outro)chevron-right
2.  [arrow-progresssatUSD Oracle](https://docs.riverai.inc/outro/satusd-oracle)

## DIA Oracle

DIA is a decentralized oracle platform supporting thousands of assets across 50+ blockchains. For satUSD, DIA delivers high-frequency, deviation-based price updates using their battle-tested DIAOracleV2 and AggregatorV3Interface-compatible adapters, ensuring compatibility with most DeFi protocols and aggregators.

The satUSD price feed uses the following configuration across all chains:

Pricing Method

MAIR (Moving Average with Interquartile Range)

Deviation Trigger

0.5%

Refresh Frequency

120 seconds

Heartbeat

24 hours

These are the main contracts to call for direct access to price data.

Ethereum

BNB Chain

Base

Arbitrum

BOB

For protocols expecting a Chainlink-style interface via AggregatorV3Interface.

Ethereum

BNB Chain

Base

Arbitrum

BOB

Last updated 8 months ago

-   [Oracle Configuration](#oracle-configuration)
-   [How to Access On-Chain](#how-to-access-on-chain)
-   [1\. DIAOracleV2](#id-1.-diaoraclev2)
-   [2\. Adapter Contracts (Chainlink-Compatible)](#id-2.-adapter-contracts-chainlink-compatible)

```
pragma solidity 0.8.29;

interface IDIAOracleV2 {
    function getValue(string memory key) external view returns (uint128, uint128);
}

contract OracleConsumer {

    address immutable ORACLE = 0xbea082c15417716541D3169e7a48e4A53A19B5D1; // BNB Chain

    function getSatUSDPrice() external view returns (uint128 price, uint128 timestamp) {
        (price, timestamp) = IDIAOracleV2(ORACLE).getValue("satUSD/USD");
        // Note: `price` has 8 decimals (e.g., 99882732 = $0.99882732)
    }
}
```

```
interface AggregatorV3Interface {
    function latestRoundData() external view returns (
        uint80 roundID,
        int256 answer,
        uint256 startedAt,
        uint256 updatedAt,
        uint80 answeredInRound
    );
}
```