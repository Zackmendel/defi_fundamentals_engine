# DeFi Fundamentals Engine - Antigravity Agent Guidelines

This repository extracts, processes, and models on-chain DeFi data from Base and Ethereum using Coinbase Developer Platform (CDP) indexed APIs and ClickHouse queries.

---

## 🤖 Automated On-Chain Data Extractor Agent

When the user asks to extract blockchain events, advance batches, or pull data until the latest `block_number` is reached:

### 1. Autonomous Extractor Engine
A dedicated headless extraction engine is located at:
[`extract/auto_extractor.py`](file:///home/zackmendel/projects/defi_fundamentals_engine/extract/auto_extractor.py)

It mirrors the exact logic of the Streamlit application ([`extract/app_v2.py`](file:///home/zackmendel/projects/defi_fundamentals_engine/extract/app_v2.py)):
- Reads credentials from [`extract/cdp_api_key.json`](file:///home/zackmendel/projects/defi_fundamentals_engine/extract/cdp_api_key.json) and generates authenticated Ed25519 JWTs.
- Auto-detects the starting cursor from the existing target file in `extract/data/` (handling multiline CSV records accurately).
- Loops through 50,000 row batches, injecting the advancing `block_number >= <last_val>` WHERE clause.
- Boundary-deduplicates overlapping records in $O(1)$ time.
- Appends new rows directly with `mode='a'`.
- Terminates automatically when `block_number` stops advancing or 0 rows are returned (indicating the chain tip is reached).

---

## 🛠️ How the Agent Executes Extractions

### A. Long-Running Execution with `/goal`
For automated extractions until the tip, recommend or execute the task using:
```bash
uv run python extract/auto_extractor.py --file <dataset_name>.csv [--query-file <path_to_query>] [--order-col block_number]
```

### B. Command Options
| Flag | Description | Default |
| :--- | :--- | :--- |
| `--file`, `-f` | Target CSV filename in `extract/data/` | `aerodrome_pairs.csv` |
| `--query-file`, `-q` | Path to SQL query file (e.g. from `extract/queries.md`) | `DEFAULT_SQL` |
| `--order-col`, `-c` | Cursor tracking column | `block_number` |
| `--order-dir`, `-d` | Order direction (`ASC` or `DESC`) | `ASC` |
| `--limit`, `-l` | Rows per batch | `50000` |
| `--max-batches`, `-m` | Optional upper limit on batches | None (runs until tip) |

### C. Agent Execution Procedure
1. **Launch**: Launch `extract/auto_extractor.py` as a background task via `run_command`.
2. **Monitor**: Check task logs periodically. The script logs progress after every 50k batch:
   ```
   [Batch #N] Fetched: +50,000 | Deduped: -1 | Total Rows: 150,000 | New block_number: 28,345,100
   ```
3. **Verify**: Upon completion, inspect the dataset's final row count and maximum block number:
   ```bash
   uv run python -c "import pandas as pd; df=pd.read_csv('extract/data/<file>.csv', usecols=['block_number']); print('Total rows:', len(df), 'Max block:', df['block_number'].max())"
   ```
4. **Report**: Summarize the number of batches run, rows added, and latest block reached.
