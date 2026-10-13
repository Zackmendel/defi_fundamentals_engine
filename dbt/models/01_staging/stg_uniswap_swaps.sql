SELECT
    to_timestamp(timestamp_ms / 1000.0) AS block_timestamp,
    block_number,
    tx_hash,
    pool_name,
    pool_address,
    base_token,
    quote_token,
    fee_tier,
    side,
    amount_base,
    amount_quote,
    price_quote,
    volume_usd AS amount_usd,
    amount0_raw,
    amount1_raw,
    tick,
    pool_liquidity,
    sender,
    recipient 
FROM {{ source('raw', 'uniswap_raw_swaps') }}

















-- SELECT
--     to_timestamp(timestamp_ms / 1000.0) AS block_timestamp,
--     block_number,
--     tx_hash,
--     pool_name,
--     pool_address,
--     base_token,
--     quote_token,
--     fee_tier,
--     side,
--     amount_base,
--     amount_quote,
--     price_quote,
--     volume_usd,
--     amount0_raw,
--     amount1_raw,
--     tick,
--     pool_liquidity,
--     sender,
--     recipient 
-- FROM main.uniswap_raw_swaps
-- LIMIT 3











-- SELECT
--     to_timestamp(timestamp_ms / 1000.0) AS block_timestamp,
--     block_number,
--     tx_hash,
--     tx_index,
--     log_index,
--     dex,
--     pool_name,
--     pool_address,
--     asset_family,
--     base_variant,
--     base_token,
--     quote_token,
--     fee_tier,
--     side,
--     amount_base,
--     amount_quote,
--     price_quote,
--     volume_usd,
--     amount0_raw,
--     amount1_raw,
--     sqrt_price_x96,
--     tick,
--     pool_liquidity,
--     sender,
--     recipient 
-- FROM main.uniswap_raw_swaps
-- LIMIT 3;
