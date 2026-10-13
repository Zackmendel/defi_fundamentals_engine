SELECT 
    to_timestamp(timestamp_ms / 1000.0) AS block_timestamp,
    base_token,
    price_quote
FROM {{ source('raw', 'uniswap_raw_swaps') }}
GROUP BY ALL
ORDER BY block_timestamp ASC 

-- SELECT 
--     DATE_TRUNC('day', to_timestamp(timestamp_ms / 1000.0))::DATE AS block_timestamp,
--     base_token,
--     AVG(price_quote) AS price
-- FROM uniswap_raw_swaps
-- GROUP BY ALL
-- ORDER BY block_timestamp ASC 
-- LIMIT 10;