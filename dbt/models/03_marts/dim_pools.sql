SELECT DISTINCT 
    *
FROM {{ ref('stg_uniswap_pools') }}
ORDER BY fee_tier ASC 