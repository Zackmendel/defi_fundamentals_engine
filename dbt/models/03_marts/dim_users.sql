WITH all_wallets AS (
    SELECT sender AS wallet_address, block_timestamp FROM {{ ref('stg_uniswap_swaps') }}
    UNION ALL
    SELECT recipient AS wallet_address, block_timestamp FROM {{ ref('stg_uniswap_swaps') }}
)
SELECT
    wallet_address,
    MIN(block_timestamp) AS first_seen_at,
    MAX(block_timestamp) AS last_seen_at,
    COUNT(*) AS total_interactions
FROM all_wallets
GROUP BY wallet_address
