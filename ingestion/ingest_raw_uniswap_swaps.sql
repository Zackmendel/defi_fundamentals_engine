-- Run from inside ingestion folder
-- duckdb ../dbt/defi_fundamentals.duckdb   -- to open local duckdb database
-- .read ingest_raw_uniswap_swaps.sql       -- to run sql file


SELECT '===== Creating raw_uniswap_v2 =====' AS info;

CREATE OR REPLACE TABLE uniswap_raw_swaps (
    timestamp_ms    BIGINT,        -- or TIMESTAMP_MS
    block_number    BIGINT,
    tx_hash         VARCHAR,
    tx_index        BIGINT,
    log_index       BIGINT,
    dex             VARCHAR,
    pool_name       VARCHAR,
    pool_address    VARCHAR,
    asset_family    VARCHAR,
    base_variant    VARCHAR,
    base_token      VARCHAR,
    quote_token     VARCHAR,
    fee_tier        BIGINT,
    side            VARCHAR,
    amount_base     DOUBLE,
    amount_quote    DOUBLE,
    price_quote     DOUBLE,
    volume_usd      DOUBLE,
    amount0_raw     VARCHAR,       -- large 256-bit int or numeric string
    amount1_raw     VARCHAR,       -- large 256-bit int or numeric string
    sqrt_price_x96  VARCHAR,       -- large uint160 represented as string
    tick            BIGINT,
    pool_liquidity  VARCHAR,       -- large uint128 represented as string
    sender          VARCHAR,
    recipient       VARCHAR
);

INSERT INTO uniswap_raw_swaps 
SELECT * FROM read_parquet('../extract/data/archive/data/normalized_swaps_2026_06.parquet');

SELECT * FROM uniswap_raw_swaps LIMIT 5;