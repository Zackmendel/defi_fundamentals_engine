### Uniswap v2 extraction query

```
SELECT
    'v2' AS version,
    s.block_timestamp,
    s.transaction_hash,
    s.address AS pair_address,
    s.parameters['sender'] AS sender,
    s.parameters['amount0In'] AS amount0_in,
    s.parameters['amount1In'] AS amount1_in,
    s.parameters['amount0Out'] AS amount0_out,
    s.parameters['amount1Out'] AS amount1_out,
    s.parameters['to'] AS recipient
FROM base.events s
WHERE s.event_signature = 'Swap(address,uint256,uint256,uint256,uint256,address)'
  AND s.action = 1
  AND s.block_timestamp >= NOW() - INTERVAL 7 DAY 
  -- 👇 Direct un-aliased comparison forces the engine to auto-infer the type safely
  AND s.address IN (
      SELECT parameters['pair']
      FROM base.events
      WHERE address = '0x8909dc15e40173ff4699343b6eb8132c65e18ec6' -- Factory
        AND event_signature = 'PairCreated(address,address,address,uint256)'
        AND action = 1
        AND block_timestamp >= NOW() - INTERVAL 90 DAY
  )
ORDER BY s.block_timestamp DESC
;
```


### Uniswap v3 extraction query
```
SELECT
    'v3' AS version,
    s.block_timestamp,
    s.transaction_hash,
    s.address AS pool_address,
    s.parameters['sender'] AS sender,
    s.parameters['recipient'] AS recipient,
    s.parameters['amount0'] AS amount0,
    s.parameters['amount1'] AS amount1,
    s.parameters['sqrtPriceX96'] AS sqrt_price_x96,
    s.parameters['liquidity'] AS liquidity,
    s.parameters['tick'] AS tick
FROM base.events s
WHERE s.event_signature = 'Swap(address,address,int256,int256,uint160,uint128,int24)'
  AND s.action = 1
  AND s.block_timestamp >= NOW() - INTERVAL 7 DAY
  AND s.address IN (
      SELECT parameters['pool']
      FROM base.events
      WHERE address = '0x33128a8fc17869897dce68ed026d694621f6fdfd' -- Canonical Uniswap V3 Factory on Base
        AND event_signature = 'PoolCreated(address,address,uint24,int24,address)'
        AND action = 1
  )
ORDER BY s.block_timestamp DESC
;
```


### Uniswap v4 extraction query

```
SELECT
    'v4' AS version,
    block_timestamp,
    transaction_hash,
    parameters['id'] AS pool_id,
    parameters['sender'] AS sender,
    parameters['amount0'] AS amount0,
    parameters['amount1'] AS amount1,
    parameters['sqrtPriceX96'] AS sqrt_price_x96,
    parameters['liquidity'] AS liquidity,
    parameters['tick'] AS tick,
    parameters['fee'] AS dynamic_fee
FROM base.events
WHERE address = '0x498581ff718922c3f8e6a244956af099b2652b2b' -- Canonical Uniswap V4 PoolManager on Base
  AND event_signature = 'Swap(bytes32,address,int128,int128,uint160,uint128,int24,uint24)'
  AND action = 1
  AND block_timestamp >= NOW() - INTERVAL 7 DAY
ORDER BY block_timestamp DESC
;
```

### AAVE v3 SUPPLIES
```
SELECT
    'Supply' AS action_type,
    block_timestamp,
    transaction_hash,
    parameters['reserve'] AS token_address,
    parameters['user'] AS user,
    parameters['onBehalfOf'] AS on_behalf_of,
    parameters['amount'] AS raw_amount,
    parameters['referralCode'] AS referral_code
FROM base.events
WHERE address = '0xa238dd80c259a72e81d7e4664a9801593f98d1c5' -- Aave V3 Pool Proxy on Base
  AND event_signature = 'Supply(address,address,address,uint256,uint16)'
  AND action = 1
  AND block_timestamp >= NOW() - INTERVAL 7 DAY
ORDER BY block_timestamp DESC
;
```

### AAVE v3 BORROWS
```
SELECT
    'Borrow' AS action_type,
    block_timestamp,
    transaction_hash,
    parameters['reserve'] AS token_address,
    parameters['user'] AS user,
    parameters['onBehalfOf'] AS on_behalf_of,
    parameters['amount'] AS raw_amount,
    parameters['interestRateMode'] AS rate_mode, -- 1 = Stable (deprecated/legacy), 2 = Variable
    parameters['borrowRate'] AS borrow_rate_ray,  -- In ray units (1e27)
    parameters['referralCode'] AS referral_code
FROM base.events
WHERE address = '0xa238dd80c259a72e81d7e4664a9801593f98d1c5'
  AND event_signature = 'Borrow(address,address,address,uint256,uint8,uint256,uint16)'
  AND action = 1
  AND block_timestamp >= NOW() - INTERVAL 7 DAY
ORDER BY block_timestamp DESC
;
```

### AAVE v3 REPAYMENTS
```
SELECT
    'Repay' AS action_type,
    block_timestamp,
    transaction_hash,
    parameters['reserve'] AS token_address,
    parameters['user'] AS borrower,
    parameters['repayer'] AS repayer,
    parameters['amount'] AS raw_amount,
    parameters['useATokens'] AS used_a_tokens
FROM base.events
WHERE address = '0xa238dd80c259a72e81d7e4664a9801593f98d1c5'
  AND event_signature = 'Repay(address,address,address,uint256,bool)'
  AND action = 1
  AND block_timestamp >= NOW() - INTERVAL 7 DAY
ORDER BY block_timestamp DESC
;
```

### AAVE v3 LIQUIDATIONS
```
SELECT
    'Liquidation' AS action_type,
    block_timestamp,
    transaction_hash,
    parameters['collateralAsset'] AS collateral_asset,
    parameters['debtAsset'] AS debt_asset,
    parameters['user'] AS borrower_liquidated,
    parameters['liquidator'] AS liquidator,
    parameters['debtToCover'] AS debt_repaid,
    parameters['liquidatedCollateralAmount'] AS collateral_seized,
    parameters['receiveAToken'] AS receive_a_token
FROM base.events
WHERE address = '0xa238dd80c259a72e81d7e4664a9801593f98d1c5'
  AND event_signature = 'LiquidationCall(address,address,address,uint256,uint256,address,bool)'
  AND action = 1
  AND block_timestamp >= NOW() - INTERVAL 30 DAY
ORDER BY block_timestamp DESC
;
```

### AAVE v3
```

```

### AAVE v3
```

```