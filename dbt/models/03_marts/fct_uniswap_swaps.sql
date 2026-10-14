SELECT
    DATE_TRUNC('day', s.block_timestamp)::DATE AS block_date,
    s.block_number,
    s.tx_hash,
    s.pool_address,
    s.sender,
    s.recipient,
    s.side,
    s.amount_usd,
    s.amount_base,
    s.amount_quote,

    f.fee_tier,
    f.total_fee_usd,
    f.protocol_fee_usd,
    f.lp_fee_usd,

    s.tick,
    s.pool_liquidity
FROM {{ ref('stg_uniswap_swaps') }} s
LEFT JOIN {{ ref('int_uniswap_fees') }} f
    ON s.tx_hash = f.tx_hash
    AND s.pool_address = f.pool_address