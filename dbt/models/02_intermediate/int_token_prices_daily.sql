WITH swaps AS (
    SELECT
        DATE_TRUNC('day', block_timestamp)::DATE AS price_date,
        block_timestamp,
        base_token,
        quote_token,
        price_quote,
        amount_base,
        amount_usd
    FROM {{ ref('stg_uniswap_swaps') }}
    WHERE price_quote > 0
      AND amount_base > 0
),

ordered_swaps AS (
    SELECT
        *,
        ROW_NUMBER() OVER (
            PARTITION BY price_date, base_token, quote_token 
            ORDER BY block_timestamp ASC
        ) AS rn_open,
        ROW_NUMBER() OVER (
            PARTITION BY price_date, base_token, quote_token 
            ORDER BY block_timestamp DESC
        ) AS rn_close
    FROM swaps
)

SELECT
    price_date,
    base_token,
    quote_token,

    -- OHLC Prices
    MAX(CASE WHEN rn_open = 1 THEN price_quote END) AS open_price,
    MAX(price_quote) AS high_price,
    MIN(price_quote) AS low_price,
    MAX(CASE WHEN rn_close = 1 THEN price_quote END) AS close_price,

    -- Volume-Weighted Average Price (VWAP)
    SUM(price_quote * amount_base) / NULLIF(SUM(amount_base), 0) AS vwap_price,

    -- Simple Average Price
    AVG(price_quote) AS avg_price,

    -- Daily Volume & Activity
    SUM(amount_usd) AS volume_usd,
    SUM(amount_base) AS volume_base,
    COUNT(*) AS total_swaps

FROM ordered_swaps
GROUP BY 
    price_date,
    base_token,
    quote_token
ORDER BY 
    price_date DESC,
    base_token ASC
