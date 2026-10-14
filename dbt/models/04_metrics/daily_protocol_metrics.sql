SELECT
    block_date,
    SUM(amount_usd) AS trading_volume,
    COUNT(DISTINCT tx_hash) AS tx_count,
    COUNT(DISTINCT sender) AS active_traders,
    SUM(total_fee_usd) AS fees,
    SUM(lp_fee_usd) AS lp_fees,
    SUM(protocol_fee_usd) AS protocol_revenue,
    SUM(total_fee_usd) / NULLIF(SUM(amount_usd), 0) AS take_rate,
    SUM(amount_usd) / NULLIF(COUNT(DISTINCT tx_hash), 0) AS avg_trade_size_usd,
    SUM(amount_usd) / NULLIF(COUNT(DISTINCT sender), 0) AS volume_per_active_trader
FROM {{ ref('fct_uniswap_swaps') }}
GROUP BY block_date
ORDER BY block_date