SELECT DISTINCT
    pool_name,
    pool_address,
    base_token,
    quote_token,
    fee_tier
FROM {{ source('raw', 'uniswap_raw_swaps') }}
ORDER BY fee_tier ASC 