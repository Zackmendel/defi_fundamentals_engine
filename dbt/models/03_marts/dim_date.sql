{{ config(
    static_analysis = 'off'
) }}

WITH bounds AS (
SELECT
    DATE_TRUNC('day', MIN(block_timestamp)) AS min_date,
    DATE_TRUNC('day', MAX(block_timestamp)) AS max_date
FROM staging.stg_uniswap_swaps
),

date_spine AS (
SELECT
    UNNEST(
        GENERATE_SERIES(min_date, max_date, INTERVAL 1 HOUR)
    ) AS date_hour
FROM bounds
)

SELECT
    date_hour,
    DATE_TRUNC('day', date_hour)::DATE AS date_day,
    EXTRACT(YEAR FROM date_hour) AS year,
    EXTRACT(QUARTER FROM date_hour) AS quarter,
    EXTRACT(MONTH FROM date_hour) AS month,
    STRFTIME(date_hour, '%B') AS month_name,
    EXTRACT(DAY FROM date_hour) AS day_of_month,
    EXTRACT(ISODOW FROM date_hour) AS day_of_week,     -- 1 = Monday, 7 = Sunday
    STRFTIME(date_hour, '%A') AS day_name,
    EXTRACT(WEEK FROM date_hour) AS week_of_year,
    EXTRACT(HOUR from date_hour) AS day_hour,
    -- Flags
    CASE WHEN EXTRACT(ISODOW FROM date_hour) IN (6, 7) THEN TRUE ELSE FALSE END AS is_weekend

FROM date_spine
ORDER BY date_hour