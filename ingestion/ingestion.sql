-- duckdb ../dbt/defi_funadamentals.duckdb

SELECT '===== Creating raw_uniswap_v2 =====' AS info;

CREATE OR REPLACE TABLE raw_uniswap_v2 AS
SELECT * FROM read_csv('../extract/data/uniswap_v2_swaps.csv');

-- Validation
SELECT * FROM raw_uniswap_v2 LIMIT 5;


SELECT '===== Creating raw_uniswap_v3 =====' AS info;

CREATE OR REPLACE TABLE raw_uniswap_v3 AS 
SELECT * FROM read_csv('../extract/data/uniswap_v3_swaps.csv');

-- Validation
SELECT * FROM raw_uniswap_v3 LIMIT 5;


SELECT '===== Creating raw_uniswap_v4 =====' AS info;

CREATE OR REPLACE TABLE raw_uniswap_v4 AS 
SELECT * FROM read_csv('../extract/data/uniswap_v4_swaps.csv');

-- Validation
SELECT * FROM raw_uniswap_v4 LIMIT 5;


SELECT '===== Creating raw_aave_borrows =====' AS info;

CREATE OR REPLACE TABLE raw_aave_borrows AS 
SELECT * FROM read_csv('../extract/data/aave_v3_borrow.csv');

-- Validation
SELECT * FROM raw_aave_borrows LIMIT 5;


SELECT '===== Creating raw_aave_supplies =====' AS info;

CREATE OR REPLACE TABLE raw_aave_supplies AS 
SELECT * FROM read_csv('../extract/data/aave_v3_supplies.csv');

-- Validation
SELECT * FROM raw_aave_supplies LIMIT 5;


SELECT '===== Creating raw_aave_repays =====' AS info;

CREATE OR REPLACE TABLE raw_aave_repays AS 
SELECT * FROM read_csv('../extract/data/aave_v3_repay.csv');

-- Validation
SELECT * FROM raw_aave_repays LIMIT 5;


SELECT '===== Creating raw_aave_liquidations =====' AS info;

CREATE OR REPLACE TABLE raw_aave_liquidations AS 
SELECT * FROM read_csv('../extract/data/aave_v3_liquidations.csv');

-- Validation
SELECT * FROM raw_aave_liquidations LIMIT 5;