# ⚡ DeFi Fundamentals Engine

An institutional-grade ELT analytics engine and data modeling pipeline that extracts, standardizes, models, and aggregates decentralized finance (DeFi) on-chain execution logs into verified financial and operational metrics.

Built with **Python**, **DuckDB**, **Parquet**, **dbt**, and **Streamlit**.

---

## 📌 Project Overview

Traditional financial markets rely on quarterly SEC filings and centralized settlement systems, whereas decentralized financial protocols emit continuous, deterministic, and immutable state transitions on-chain. Translating these raw EVM execution logs into standardized institutional metrics (trading volume, liquidity provider earnings, protocol revenue, take rates, and daily VWAPs) requires specialized data engineering:

- **Uniswap V3** concentrates liquidity into discrete tick intervals, executes optimistic callback swaps, and provides governance-controlled fee switches between liquidity providers (LPs) and protocol treasuries.
- **Aave V3** operates a hub-and-spoke lending architecture with scaled balance indexes, dynamic interest utilization curves, and liquidation mechanics.

The **DeFi Fundamentals Engine** implements a modular, reproducible medallion architecture on top of an embedded **DuckDB** OLAP engine, enabling high-performance zero-copy queries over columnar Parquet files with end-to-end testing and documentation via **dbt**.

---

## 🏛️ System Architecture

```
┌────────────────────────────────────────────────────────────────────────┐
│                        1. Ingestion / Data Source                      │
│                                                                        │
│   Kaggle Parquet Dataset           Coinbase Developer Platform (CDP)   │
│ (Marvin Gonzo Uniswap V3 ETH)       Autonomous Continuous Extractor    │
│  [normalized_swaps_2026_06.parquet]    [extract/auto_extractor.py]    │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ SQL Ingestion
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                       2. Embedded OLAP Storage                         │
│                                                                        │
│                    DuckDB (defi_fundamentals.duckdb)                   │
│                   Raw Tables: main.uniswap_raw_swaps                   │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ dbt Transformation Pipeline
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                      3. dbt Transformation Layers                      │
│                                                                        │
│   01_staging         02_intermediate         03_marts       04_metrics │
│  ┌──────────────┐   ┌────────────────┐   ┌─────────────┐   ┌─────────┐ │
│  │stg_swaps     │──▶│int_prices_daily│──▶│fct_swaps    │──▶│daily_   │ │
│  │stg_pools     │   │int_fees        │   │dim_date     │   │protocol_│ │
│  │stg_prices    │   └────────────────┘   │dim_pools    │   │metrics  │ │
│  └──────────────┘                        │dim_users    │   │metrics_ │ │
│                                          └─────────────┘   │by_pool  │ │
│                                                            └─────────┘ │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Curated Marts & Metrics
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                   4. Analytics & Consumption Layer                     │
│                                                                        │
│   Streamlit Web Dashboard       DuckDB SQL CLI / BI Tools (Metabase)   │
│   - Executive Overview          - Ad-hoc Quantitative Analysis         │
│   - Deep Dive Metrics           - Risk Management & Solvency Modeling  │
│   - Data Quality & Lineage                                             │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 🛠️ Tech Stack

| Technology | Purpose | Description |
| :--- | :--- | :--- |
| **Python 3.13+** | Orchestration & Extraction | Environment execution, CLI batch scripts, and automated CDP JWT auth. |
| **uv** | Package Manager | Fast, deterministic Python package resolution and lockfile management. |
| **DuckDB** | OLAP Database | In-process columnar database capable of querying multi-gigabyte Parquet datasets. |
| **Apache Parquet** | Storage Format | Highly compressed, snappy columnar format for raw event datasets. |
| **dbt (`dbt-duckdb`)** | Transformations & Tests | Medallion data transformations (`staging`, `intermediate`, `marts`, `metrics`) with data tests. |
| **Streamlit** | UI & Visualization | Interactive dashboard for operational metric monitoring and data quality reporting. |

---

## 📊 Protocol Coverage

| Protocol | Version | Network | Status | Focus / Key Metrics |
| :--- | :--- | :--- | :--- | :--- |
| **Uniswap** | **V3** | Ethereum | **Implemented** | Swaps, Notional Volume, OHLCV, VWAP, LP Fees, Protocol Revenue, Take Rate, Active Traders. |
| **Uniswap** | **V2 / V4** | Base | Ingestion Ready | Factory pair creation, Singleton PoolManager flash accounting, dynamic hook fees. |
| **Aave** | **V3** | Base | Ingestion Ready | Supplies, Borrows, Repayments, Liquidations, Scaled Index Debt, Reserve Factors. |

---

## 📂 Repository Structure

```
defi_fundamentals_engine/
├── README.md                           # Main project overview and replication guide
├── pyproject.toml                      # Project metadata and locked Python dependencies
├── uv.lock                             # Reproducible dependency lockfile
├── app.py                              # Root launcher for the extraction UI
│
├── extract/                            # Data extraction module
│   ├── app.py                          # Streamlit interactive extractor interface
│   ├── app_v2.py                       # Enhanced extractor with live logging & pagination
│   ├── auto_extractor.py               # Autonomous headless batch extractor (runs to chain tip)
│   ├── cdp_api_key.json                # CDP Ed25519 authentication credentials (gitignored)
│   ├── queries.md                      # SQL extraction queries for Base and Ethereum
│   └── data/                           # Data directory for Parquet and CSV files
│       └── normalized_swaps_2026_06.parquet  # Marvin Gonzo Uniswap V3 ETH swaps
│
├── ingestion/                          # Raw database ingestion scripts
│   ├── ingest_raw_uniswap_swaps.sql    # DuckDB SQL script ingesting Parquet into main.uniswap_raw_swaps
│   └── ingestion.sql                   # SQL script for batch ingesting extracted CSV files
│
├── dbt/                                # dbt transformation project
│   ├── README.md                       # Comprehensive dbt architecture and model documentation
│   ├── dbt_project.yml                 # dbt project configurations and schema settings
│   ├── packages.yml                    # dbt dependencies (dbt_utils)
│   ├── defi_fundamentals.duckdb        # Target analytical DuckDB database file
│   └── models/
│       ├── 01_staging/                 # Views: Typecasting, timestamp normalization, deduplication
│       │   ├── __sources.yml
│       │   ├── schema.yml
│       │   ├── stg_uniswap_swaps.sql
│       │   ├── stg_uniswap_pools.sql
│       │   └── stg_token_prices.sql
│       ├── 02_intermediate/            # Views: Financial logic, fee modeling, daily OHLCV & VWAP
│       │   ├── schema.yml
│       │   ├── int_token_prices_daily.sql
│       │   └── int_uniswap_fees.sql
│       ├── 03_marts/                   # Tables: Dimensional model (facts and dimensions)
│       │   ├── schema.yml
│       │   ├── dim_date.sql
│       │   ├── dim_pools.sql
│       │   ├── dim_users.sql
│       │   └── fct_uniswap_swaps.sql
│       └── 04_metrics/                 # Tables: Pre-aggregated daily KPI tables
│           ├── daily_protocol_metrics.sql
│           └── metrics_by_pool.sql
│
├── dashboard/                          # Dashboard presentation layer
│   └── (Dashboard scripts & assets)
│
└── docs/                               # Project documentation & methodology
    ├── methodology/
    │   └── uniswap.md                  # Comprehensive Uniswap V3 metric dictionary & specifications
    └── research/
        └── protocols.md                # In-depth architectural analysis of Uniswap (v2-v4) and Aave v3
```

---

## 🚀 End-to-End Replication Guide

Follow this step-by-step workflow to reproduce the entire environment, ingest raw data, execute dbt models, and inspect metrics.

### Step 1: Environment Setup

Clone the repository and install dependencies using `uv`:

```bash
git clone https://github.com/Zackmendel/defi_fundamentals_engine.git
cd defi_fundamentals_engine

# Install Python dependencies deterministic to uv.lock
uv sync
```

### Step 2: Acquire Raw Data

The primary dataset is the **Marvin Gonzo Uniswap V3 BTC/ETH dataset** for June 2026:
1. Download `normalized_swaps_2026_06.parquet` from [Kaggle](https://www.kaggle.com/datasets/marvingozo/ethereum-uniswap-v3-btceth-june-2026?resource=download).
2. Place the file inside `extract/data/normalized_swaps_2026_06.parquet`.

*(Optional: For live on-chain extracts via the Coinbase Developer Platform, see [Autonomous On-Chain Extractor](#autonomous-on-chain-extractor) below).*

### Step 3: Ingest Raw Data into DuckDB

Run the ingestion script to load the Parquet file into the DuckDB analytical database:

```bash
cd ingestion

# Run DuckDB directly against the target database
duckdb ../dbt/defi_fundamentals.duckdb -c ".read ingest_raw_uniswap_swaps.sql"
```

This creates the table `main.uniswap_raw_swaps` populated with swap logs, token flow amounts, tick levels, and transaction hashes.

### Step 4: Run the dbt Modeling Pipeline

Navigate into the `dbt/` directory, install package dependencies, compile the models, and build the warehouse:

```bash
cd ../dbt

# 1. Install dbt packages (dbt-utils)
uv run dbt deps

# 2. Build and test all models across staging, intermediate, marts, and metrics
uv run dbt build
```

This materializes:
- **`staging`** (`stg_uniswap_swaps`, `stg_uniswap_pools`, `stg_token_prices`) as SQL views.
- **`intermediate`** (`int_token_prices_daily`, `int_uniswap_fees`) as SQL views.
- **`mart`** (`fct_uniswap_swaps`, `dim_date`, `dim_pools`, `dim_users`) as persistent tables.
- **`metrics`** (`daily_protocol_metrics`, `metrics_by_pool`) as persistent tables.

### Step 5: Query Analytical Outputs

You can query your newly materialized models directly via the DuckDB CLI or Python:

```bash
duckdb defi_fundamentals.duckdb
```

```sql
-- Query daily protocol fundamentals
SELECT 
    block_date,
    ROUND(trading_volume, 2) AS volume_usd,
    tx_count,
    active_traders,
    ROUND(fees, 2) AS gross_fees_usd,
    ROUND(lp_fees, 2) AS lp_cut_usd,
    ROUND(protocol_revenue, 2) AS treasury_revenue_usd,
    ROUND(take_rate * 100, 4) AS take_rate_pct
FROM metrics.daily_protocol_metrics
ORDER BY block_date DESC
LIMIT 10;
```

---

## 🤖 Script & Tool Reference

### Autonomous On-Chain Extractor (`extract/auto_extractor.py`)

A headless extraction engine that connects to the Coinbase Developer Platform (CDP) API using signed Ed25519 JWT tokens:
- Inspects target CSV files in `extract/data/` to determine the latest ingested `block_number` cursor.
- Queries CDP in batches of 50,000 rows (`block_number >= <cursor>`).
- Performs $O(1)$ boundary deduplication and appends new rows directly.
- Automatically halts when the latest block tip is reached.

```bash
# Run headless batch extractor
uv run python extract/auto_extractor.py --file aerodrome_pairs.csv --limit 50000
```

| Flag | Argument | Description | Default |
| :--- | :--- | :--- | :--- |
| `--file`, `-f` | `FILENAME` | Target output CSV in `extract/data/` | `aerodrome_pairs.csv` |
| `--query-file`, `-q` | `PATH` | Custom SQL query file | `DEFAULT_SQL` |
| `--order-col`, `-c` | `COLUMN` | Tracking cursor column | `block_number` |
| `--limit`, `-l` | `INT` | Rows per batch request | `50000` |
| `--max-batches`, `-m` | `INT` | Optional maximum batch iteration cap | None (runs to tip) |

### Streamlit Extraction UI (`extract/app.py` & `extract/app_v2.py`)

Launch an interactive GUI to test and execute SQL queries against CDP indexed events:

```bash
uv run streamlit run extract/app.py
```

---

## 📈 Metric Dictionary & Documentation

For thorough, granular documentation on calculation logic, exclusions, and business definitions, consult:
- **[Uniswap V3 Metric Dictionary & Methodology](file:///home/zackmendel/projects/defi_fundamentals_engine/docs/methodology/uniswap.md)**: Standard syntax covering Trading Volume, Active Traders, Protocol Take Rate, LP Payouts, VWAP, and Dashboard specifications.
- **[Protocol Architecture & Research](file:///home/zackmendel/projects/defi_fundamentals_engine/docs/research/protocols.md)**: Deep comparative breakdown of Uniswap (v2, v3, v4) and Aave v3 smart contract primitives, invariant curves, and risk frameworks.
- **[dbt Pipeline Architecture](file:///home/zackmendel/projects/defi_fundamentals_engine/dbt/README.md)**: Detailed model documentation, DAG flows, and schema tests.

---

## 🛡️ License

This project is licensed under the MIT License.
