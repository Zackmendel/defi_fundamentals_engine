SELECT
    block_timestamp,
    tx_hash,
    pool_address,
    fee_tier,
    fee_tier / 1000000.0 AS decimal_factor,
    fee_tier / 10000.0 AS percent_fees,
    amount_usd,
    
    -- Total gross swap fee collected from trader
    (fee_tier / 1000000.0) * amount_usd AS total_fee_usd,
    
    -- Protocol/Community Split (assumes fee switch is enabled)
    CASE 
        WHEN fee_tier <= 500 THEN ((fee_tier / 1000000.0) * amount_usd) * 0.25         -- 1/4th for stable/low-fee pools
        ELSE ((fee_tier / 1000000.0) * amount_usd) * (1.0 / 6.0)                      -- 1/6th for standard/volatile pools
    END AS protocol_fee_usd,
    
    -- Liquidity Provider Split
    CASE 
        WHEN fee_tier <= 500 THEN ((fee_tier / 1000000.0) * amount_usd) * 0.75         -- 3/4ths to LPs
        ELSE ((fee_tier / 1000000.0) * amount_usd) * (5.0 / 6.0)                      -- 5/6ths to LPs
    END AS lp_fee_usd

FROM {{ ref('stg_uniswap_swaps') }}