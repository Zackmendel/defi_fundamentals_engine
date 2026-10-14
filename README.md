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
│   Next.js Executive Dashboard   DuckDB SQL CLI / BI Tools (Metabase)   │
│   - Overview (KPIs, Charts)     - Ad-hoc Quantitative Analysis         │
│   - Metrics (Trends & Pools)    - Risk Management & Solvency Modeling  │
│   - Methodology & Data Quality  - Streamlit Extraction GUI             │
```

---

## 🖥️ Executive Dashboard Preview

The **DeFi Fundamentals Engine** features a Next.js web application built with **Next.js 16**, **React 19**, and embedded **DuckDB**, designed with **Uniswap V3 aesthetics**.

### 1. Executive Overview
> Real-time 30-day KPI cards ($7.06B Volume, $6.15M Gross Fees, $1.21M Protocol Revenue, 8.71 bps Take Rate), interactive dual-axis volume/fee SVG time-series, pool dominance share, and LP vs. protocol treasury fee economics split.

![Dashboard Overview](images/01_overview.png)

### 2. Deep Dive Metrics & Pool Matrix
> Dynamic multi-metric trend exploration (Volume, Fees, Take Rate bps, Active Traders, Trade Size) and sortable/searchable 24-pool performance matrix with direct Etherscan contract links.

![Dashboard Metrics](images/02_metrics.png)

### 3. Methodology, Lineage & Data Quality
> Interactive 5-tier transformation DAG (Parquet to Metrics) with live table row counts, raw schema mappings, known limitations, and 100% passing dbt validation assertions.

![Dashboard Methodology](images/03_methodology.png)

---

## 🛠️ Tech Stack

| Technology | Purpose | Description |
| :--- | :--- | :--- |
| **Python 3.13+** | Orchestration & Extraction | Environment execution, CLI batch scripts, and automated CDP JWT auth. |
| **uv** | Package Manager | Fast, deterministic Python package resolution and lockfile management. |
| **DuckDB** | OLAP Database | In-process columnar database capable of querying multi-gigabyte Parquet datasets. |
| **Apache Parquet** | Storage Format | Highly compressed, snappy columnar format for raw event datasets. |
| **dbt (`dbt-duckdb`)** | Transformations & Tests | Medallion data transformations (`staging`, `intermediate`, `marts`, `metrics`) with data tests. |
| **Next.js 16 + React 19** | Executive Web Dashboard | Production web analytics dashboard with server-side DuckDB connection and Uniswap V3 aesthetics. |
| **Streamlit** | UI & Extraction | Interactive interface for CDP-indexed on-chain querying and pipeline monitoring. |

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
├── dashboard/                          # Next.js web application
│   ├── package.json                    # Next.js, React 19, and duckdb dependencies
│   ├── next.config.ts                  # Server external packages configuration
│   └── src/
│       ├── lib/duckdb.ts               # DuckDB connection pooling & snapshot fallback
│       ├── app/
│       │   ├── globals.css             # Uniswap V3 aesthetic design system
│       │   ├── layout.tsx              # Root HTML shell & metadata
│       │   ├── page.tsx                # Master dashboard view with tab switching
│       │   └── api/                    # Server Route Handlers querying DuckDB
│       │       ├── overview/route.ts   # Executive KPIs ($7.06B Vol, $6.15M Fees)
│       │       ├── daily/route.ts      # Daily time series
│       │       ├── pools/route.ts      # 24-pool performance breakdown
│       │       └── quality/route.ts    # Live table row counts & dbt test results
│       └── components/                 # Tab page components
│           ├── Header.tsx              # Navigation bar & live status badges
│           ├── OverviewTab.tsx         # Executive KPIs & dual-axis SVG chart
│           ├── MetricsTab.tsx          # Multi-metric trend & pool matrix
│           └── MethodologyTab.tsx      # Lineage DAG, sources, limitations, tests
│
├── images/                             # Dashboard screenshots & previews
│   ├── 01_overview.png                 # Executive Overview tab preview
│   ├── 02_metrics.png                  # Multi-metric explorer & pool matrix preview
│   └── 03_methodology.png              # Lineage DAG & validation audit preview
│
└── docs/                               # Project documentation & methodology
    ├── methodology/
    │   └── uniswap.md                  # Comprehensive Uniswap V3 metric dictionary & dashboard guide
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

### Step 6: Launch the Next.js Executive Dashboard

Launch the Uniswap-themed Next.js analytics dashboard connected directly to the DuckDB metrics engine:

```bash
cd ../dashboard

# Install dependencies (Next.js, React, duckdb)
npm install

# Run in development mode
npm run dev

# Or build and start production server
npm run build
npm run start
```

Navigate to `http://localhost:3000` to interact with:
- **Overview Tab:** Executive KPI cards ($7.06B volume, $6.15M fees, $1.21M protocol revenue, $4.94M LP payouts), interactive dual-axis volume & fee chart, and pool market share.
- **Metrics Tab:** Multi-metric toggleable trends (Volume, Fees, Take Rate bps, Active Traders, Trade Size) and searchable Uniswap V3 pool performance matrix.
- **Methodology & Data Quality Tab:** 5 sub-tabs covering transformation DAG lineage, data source mappings, known limitations, incidents audit log, and live dbt validation results.

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
