---
name: onchain-batch-extractor
description: >-
  Autonomous batch extraction of on-chain data from CDP APIs into CSV files.
  Continuously queries batches of 50k rows, advances the block_number cursor,
  and stops when the latest block tip is reached.
---

# On-Chain Batch Extractor Skill

Use this skill when the user wants to run automated, multi-batch CDP blockchain data extractions without manual clicking in the Streamlit UI.

## Workflow

1. **Verify Credentials**:
   Ensure `extract/cdp_api_key.json` exists.

2. **Select or Prepare Query**:
   The query can be passed directly or read from a `.sql` / `.md` file (see `extract/queries.md`).
   Ensure the query contains:
   - `ORDER BY block_number ASC` (or chosen cursor column)
   - `LIMIT 50000`

3. **Run Autonomous Extractor**:
   Execute the background extraction command:
   ```bash
   uv run python extract/auto_extractor.py --file <target_file>.csv --query-file <path_to_query>
   ```

4. **Monitor & Finish**:
   - The extractor runs until `block_number` stops advancing or 0 rows are returned.
   - When finished, verify row count and latest block number in the generated CSV file.
