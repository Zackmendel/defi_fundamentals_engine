# DeFi Fundamentals Engine — dbt Modeling Architecture

This directory houses the **dbt** project for the **DeFi Fundamentals Engine**, orchestrating the transformation of raw on-chain protocol events into structured dimensional data marts and daily protocol metrics using **DuckDB**.

---

## 1. Project Configuration & Database Setup

- **Adapter:** `dbt-duckdb` (v1.11.0+)
- **Target Database:** `defi_fundamentals.duckdb`
- **Configuration File:** [`dbt_project.yml`](file:///home/zackmendel/projects/defi_fundamentals_engine/dbt/dbt_project.yml)
- **Profile Name:** `defi_fundamentals_engine`

### Schema & Materialization Strategy

| Layer | Subdirectory | Target Schema | Default Materialization | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| **Sources** | Seed / Raw | `main` / `raw` | Tables (Raw Ingestion) | Direct parity with raw Parquet / CSV extracts. |
| **01_staging** | `models/01_staging/` | `staging` | `view` | Data cleaning, typecasting, timestamp conversion, column aliasing. |
| **02_intermediate** | `models/02_intermediate/` | `intermediate` | `view` | Complex business logic (fee modeling, OHLCV / VWAP aggregations). |
| **03_marts** | `models/03_marts/` | `mart` | `table` | Dimensional fact and dimension models for business intelligence. |
| **04_metrics** | `models/04_metrics/` | `metrics` | `table` | Pre-aggregated KPI tables for executive reporting and dashboards. |

---

## 2. Transformation DAG & Data Lineage

```
                       [raw.uniswap_raw_swaps]
                                  │
         ┌────────────────────────┼────────────────────────┐
         ▼                        ▼                        ▼
[stg_uniswap_swaps]      [stg_uniswap_pools]     [stg_token_prices]
         │                        │
         ├────────────────────────┤
         ▼                        ▼
 [int_uniswap_fees]     [int_token_prices_daily]
         │
         ├────────────────────────┬────────────────────────┐
         ▼                        ▼                        ▼
[fct_uniswap_swaps]          [dim_pools]              [dim_users]        [dim_date]
         │                        │
         ├────────────────────────┴────────────────────────┐
         ▼                                                 ▼
[daily_protocol_metrics]                           [metrics_by_pool]
```

---

## 3. Detailed Model Breakdown

### Layer 1: Staging (`models/01_staging/`)
Staging models extract from raw sources without modifying historical facts. They normalize types, convert timestamps, and filter out malformed transactions.

- [`stg_uniswap_swaps.sql`](file:///home/zackmendel/projects/defi_fundamentals_engine/dbt/models/01_staging/stg_uniswap_swaps.sql):
  - **Source:** `{{ source('raw', 'uniswap_raw_swaps') }}`
  - **Grain:** One row per swap event log.
  - **Transformations:**
    - Converts Unix epoch milliseconds to UTC timestamps via `to_timestamp(timestamp_ms / 1000.0) AS block_timestamp`.
    - Renames `volume_usd` to canonical `amount_usd`.
    - Standardizes column types across blocks, transaction hashes, pool addresses, trading amounts, execution prices, ticks, and liquidity.

- [`stg_uniswap_pools.sql`](file:///home/zackmendel/projects/defi_fundamentals_engine/dbt/models/01_staging/stg_uniswap_pools.sql):
  - **Source:** `{{ source('raw', 'uniswap_raw_swaps') }}`
  - **Grain:** One row per unique Uniswap liquidity pool.
  - **Transformations:** Employs `SELECT DISTINCT` to extract pool addresses, pair names, base tokens, quote tokens, and configured fee tiers (ordered ascending by fee tier).

- [`stg_token_prices.sql`](file:///home/zackmendel/projects/defi_fundamentals_engine/dbt/models/01_staging/stg_token_prices.sql):
  - **Source:** `{{ source('raw', 'uniswap_raw_swaps') }}`
  - **Grain:** One row per unique timestamp, base token, and execution quote price.
  - **Transformations:** Casts epoch to `block_timestamp`, captures base asset pricing points, and groups records chronologically.

---

### Layer 2: Intermediate (`models/02_intermediate/`)
Intermediate models encapsulate protocol-specific calculations and mathematical formulations.

- [`int_token_prices_daily.sql`](file:///home/zackmendel/projects/defi_fundamentals_engine/dbt/models/02_intermediate/int_token_prices_daily.sql):
  - **Source:** `{{ ref('stg_uniswap_swaps') }}`
  - **Grain:** Base Token × Quote Token × Price Date.
  - **Business Logic:**
    - Filters records where `price_quote > 0` and `amount_base > 0`.
    - Applies window functions `ROW_NUMBER() OVER (PARTITION BY price_date, base_token, quote_token ORDER BY block_timestamp ASC/DESC)` to determine intraday **Open Price** and **Close Price**.
    - Evaluates **High Price** (`MAX(price_quote)`) and **Low Price** (`MIN(price_quote)`).
    - Computes **Volume-Weighted Average Price (VWAP)**:
      $$\text{VWAP} = \frac{\sum (\text{price\_quote} \times \text{amount\_base})}{\sum \text{amount\_base}}$$
    - Aggregates daily trading volume in USD, base token units, and total swap transactions.

- [`int_uniswap_fees.sql`](file:///home/zackmendel/projects/defi_fundamentals_engine/dbt/models/02_intermediate/int_uniswap_fees.sql):
  - **Source:** `{{ ref('stg_uniswap_swaps') }}`
  - **Grain:** One row per swap event.
  - **Business Logic:**
    - Translates fee tier integers (e.g., 500, 3000, 10000) into decimal multipliers (`fee_tier / 1000000.0`) and percentages (`fee_tier / 10000.0`).
    - Computes gross transaction fee paid by trader: `total_fee_usd = decimal_factor * amount_usd`.
    - Models the protocol revenue fee switch:
      - **Low-Fee / Stable Pairs ($\le 500$ bps):** 25% to Protocol Treasury (`total_fee_usd * 0.25`), 75% to LPs (`total_fee_usd * 0.75`).
      - **Standard / Volatile Pairs ($> 500$ bps):** 1/6th to Protocol Treasury (`total_fee_usd * (1/6)`), 5/6ths to LPs (`total_fee_usd * (5/6)`).

---

### Layer 3: Data Marts (`models/03_marts/`)
The analytical consumption layer containing persistent facts and dimensions.

- [`fct_uniswap_swaps.sql`](file:///home/zackmendel/projects/defi_fundamentals_engine/dbt/models/03_marts/fct_uniswap_swaps.sql):
  - **Sources:** `{{ ref('stg_uniswap_swaps') }}` joined with `{{ ref('int_uniswap_fees') }}` on `tx_hash` and `pool_address`.
  - **Grain:** One row per swap execution.
  - **Fields:** Calendar `block_date`, block number, transaction hash, pool address, sender, recipient, trade side (`buy`/`sell`), USD notional volume, base/quote token amounts, fee breakdown (`total_fee_usd`, `protocol_fee_usd`, `lp_fee_usd`), post-swap `tick`, and virtual `pool_liquidity`.

- [`dim_date.sql`](file:///home/zackmendel/projects/defi_fundamentals_engine/dbt/models/03_marts/dim_date.sql):
  - **Source:** `staging.stg_uniswap_swaps`
  - **Grain:** Hourly timestamp bucket (`date_hour`).
  - **Transformations:** Dynamically computes min and max swap timestamps, expanding an hourly continuous date spine via DuckDB's `GENERATE_SERIES`. Generates date attributes: `date_day`, `year`, `quarter`, `month`, `month_name`, `day_of_month`, `day_of_week` (ISO), `day_name`, `week_of_year`, `day_hour`, and boolean `is_weekend`.
  - **Note:** Configured with `static_analysis = 'off'` to permit dynamic DuckDB table-valued functions.

- [`dim_pools.sql`](file:///home/zackmendel/projects/defi_fundamentals_engine/dbt/models/03_marts/dim_pools.sql):
  - **Source:** `{{ ref('stg_uniswap_pools') }}`
  - **Grain:** Unique `pool_address` (Primary Key).
  - **Fields:** Contract address, pair name, base asset, quote asset, and configured fee tier.

- [`dim_users.sql`](file:///home/zackmendel/projects/defi_fundamentals_engine/dbt/models/03_marts/dim_users.sql):
  - **Source:** `{{ ref('stg_uniswap_swaps') }}`
  - **Grain:** Unique `wallet_address` (Primary Key).
  - **Transformations:** Consolidates both `sender` and `recipient` addresses via `UNION ALL`. Evaluates lifecycle metrics: `first_seen_at`, `last_seen_at`, and cumulative `total_interactions`.

---

### Layer 4: Metrics (`models/04_metrics/`)
Aggregated metric tables built directly for BI dashboards and quantitative analysis.

- [`daily_protocol_metrics.sql`](file:///home/zackmendel/projects/defi_fundamentals_engine/dbt/models/04_metrics/daily_protocol_metrics.sql):
  - **Source:** `{{ ref('fct_uniswap_swaps') }}`
  - **Grain:** `block_date`.
  - **Metrics Evaluated:**
    - `trading_volume`: `SUM(amount_usd)`
    - `tx_count`: `COUNT(DISTINCT tx_hash)`
    - `active_traders`: `COUNT(DISTINCT sender)`
    - `fees`: `SUM(total_fee_usd)`
    - `lp_fees`: `SUM(lp_fee_usd)`
    - `protocol_revenue`: `SUM(protocol_fee_usd)`
    - `take_rate`: `SUM(total_fee_usd) / NULLIF(SUM(amount_usd), 0)`
    - `avg_trade_size_usd`: `SUM(amount_usd) / NULLIF(COUNT(DISTINCT tx_hash), 0)`
    - `volume_per_active_trader`: `SUM(amount_usd) / NULLIF(COUNT(DISTINCT sender), 0)`

- [`metrics_by_pool.sql`](file:///home/zackmendel/projects/defi_fundamentals_engine/dbt/models/04_metrics/metrics_by_pool.sql):
  - **Sources:** `{{ ref('fct_uniswap_swaps') }}` joined with `{{ ref('dim_pools') }}`.
  - **Grain:** `block_date` × `pool_name`.
  - **Metrics Evaluated:** Evaluates the full suite of daily volume, fee, revenue, and active trader metrics partitioned at the individual liquidity pool grain.

---

## 4. Testing & Validation Suite

Automated tests are declared across YAML specifications ([`schema.yml`](file:///home/zackmendel/projects/defi_fundamentals_engine/dbt/models/01_staging/schema.yml)):

- **Primary Key Uniqueness (`unique`):**  
  Enforced on `dim_pools.pool_address`, `dim_users.wallet_address`, and `dim_date.date_hour`.
- **Integrity Constraints (`not_null`):**  
  Enforced on all transaction identifiers (`tx_hash`), block heights (`block_number`), pool addresses (`pool_address`), timestamps (`block_timestamp`), and calendar dimensions.
- **Static Analysis Compliance:**  
  The project runs with `+static_analysis: strict` configured in `dbt_project.yml` to prevent schema drift and detect unreferenced or untyped column dependencies during compilation.

---

## 5. Execution Guide

Run all commands from within the `dbt/` directory:

```bash
cd dbt

# 1. Install dependencies (e.g. dbt-utils)
uv run dbt deps

# 2. Compile SQL models and validate Jinja refs
uv run dbt compile

# 3. Build all models (views and tables)
uv run dbt run

# 4. Execute test suite
uv run dbt test

# 5. Full build (run models + execute tests concurrently)
uv run dbt build

# 6. Generate and view interactive documentation
uv run dbt docs generate
uv run dbt docs serve
```

---

## 6. Downstream Consumption & Next.js Dashboard Integration

The output models generated by this dbt project directly power the institutional Next.js analytics dashboard in [`dashboard/`](file:///home/zackmendel/projects/defi_fundamentals_engine/dashboard):

| dbt Model / Schema | Dashboard Destination | Visual & Analytical Role |
| :--- | :--- | :--- |
| **`metrics.daily_protocol_metrics`** | **Overview & Metrics Tabs** | Executive 30-day KPI cards (Volume: $7.06B, Fees: $6.15M, Take Rate: 8.71 bps), dual-axis SVG volume/fee chart, and multi-metric trend exploration. |
| **`metrics.metrics_by_pool`** | **Overview & Metrics Tabs** | Top 5 pool volume dominance progress bars and the 24-pool sortable/searchable performance matrix. |
| **`mart.dim_users`** | **Overview Tab** | Cumulative unique wallet counts (23,425 active participants) and user lifecycle analysis. |
| **`mart.dim_pools`** | **Metrics & Overview Tabs** | Pool contract metadata, token symbols (`base_token`, `quote_token`), and fee tier badges. |
| **`staging.*` & `mart.*`** | **Methodology & Data Quality Tab** | Live table row counts (1,567,364 rows), lineage DAG flow, and test suite pass verification. |

### Database Access Architecture
- **Adapter Concurrency:** The dashboard connects via `duckdb.OPEN_READONLY` against `defi_fundamentals.duckdb`.
- **Locking Fallback:** If an external process (e.g. an interactive DuckDB CLI session or active dbt compilation) holds an exclusive write lock, the application dynamically initializes a zero-copy read snapshot at `/tmp/defi_engine_active/defi_fundamentals.duckdb`. Matching the database file name ensures compiled view catalog references remain 100% valid.
- **BigInt Conversion:** All integer columns (`BIGINT` blocks, timestamps, transaction counts) are sanitized into JavaScript numbers for JSON API serialization.