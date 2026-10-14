-- WITH top_10_pools AS (
-- SELECT
--     p.pool_name,
--     SUM(amount_usd) AS trading_volume
-- FROM {{ ref('fct_uniswap_swaps') }} f 
-- JOIN {{ ref('dim_pools') }} p ON f.pool_address = p.pool_address
-- GROUP BY p.pool_name
-- HAVING trading_volume IS NOT NULL
-- ORDER BY trading_volume DESC
-- LIMIT 10
-- )


SELECT
    block_date,
    p.pool_name,
    SUM(amount_usd) AS trading_volume,
    COUNT(DISTINCT tx_hash) AS tx_count,
    COUNT(DISTINCT sender) AS active_traders,
    SUM(total_fee_usd) AS fees,
    SUM(lp_fee_usd) AS lp_fees,
    SUM(protocol_fee_usd) AS protocol_revenue,
    SUM(total_fee_usd) / NULLIF(SUM(amount_usd), 0) AS take_rate,
    SUM(amount_usd) / NULLIF(COUNT(DISTINCT tx_hash), 0) AS avg_trade_size_usd,
    SUM(amount_usd) / NULLIF(COUNT(DISTINCT sender), 0) AS volume_per_active_trader
FROM {{ ref('fct_uniswap_swaps') }} f 
JOIN {{ ref('dim_pools') }} p ON f.pool_address = p.pool_address
-- WHERE p.pool_name IN (SELECT pool_name FROM top_10_pools)
GROUP BY block_date, p.pool_name
HAVING trading_volume IS NOT NULL
ORDER BY block_date, trading_volume DESC