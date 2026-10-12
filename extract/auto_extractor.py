"""
Autonomous CDP On-Chain Batch Extractor.
Runs continuous 50k row batch queries against the CDP API, advancing the cursor
automatically until the latest block is reached (where block_number stops increasing).
"""

import argparse
import base64
import csv
import json
import re
import secrets
import sys
import time
from pathlib import Path

import jwt
import pandas as pd
import requests
from cryptography.hazmat.primitives.asymmetric import ed25519

# Paths
BASE_DIR = Path(__file__).resolve().parent
KEY_FILE = BASE_DIR / "cdp_api_key.json"
DATA_DIR = BASE_DIR / "data"

API_HOST = "api.cdp.coinbase.com"
API_PATH = "/platform/v2/data/query/run"
API_URL = f"https://{API_HOST}{API_PATH}"

DEFAULT_SQL = """SELECT
    block_number,
    block_timestamp,
    transaction_hash,
    transaction_to,
    transaction_from,
    address,
    event_name,
    event_signature,
    parameters['pair'] AS pool_address,
    parameters['token0'] AS token0_address,
    parameters['token1'] AS token1_address,
    parameter_types
FROM base.events
WHERE address = '0x8909dc15e40173ff4699343b6eb8132c65e18ec6'
  AND event_signature = 'PairCreated(address,address,address,uint256)'
  AND action = 1
  AND block_number >= 9000000
ORDER BY block_number ASC
LIMIT 50000;"""


def generate_jwt(key_file_path: Path) -> str:
    """Read CDP key JSON and generate a signed EdDSA JWT."""
    if not key_file_path.exists():
        raise FileNotFoundError(f"CDP key file not found at: {key_file_path}")

    with open(key_file_path, "r", encoding="utf-8") as f:
        key_data = json.load(f)

    key_id = key_data.get("id") or key_data.get("name")
    raw_key = base64.b64decode(key_data["privateKey"])
    priv_key = ed25519.Ed25519PrivateKey.from_private_bytes(raw_key[:32])

    now = int(time.time())
    payload = {
        "sub": key_id,
        "iss": "cdp",
        "nbf": now,
        "exp": now + 120,
        "uri": f"POST {API_HOST}{API_PATH}",
    }
    headers = {
        "kid": key_id,
        "nonce": secrets.token_hex(16),
    }
    return jwt.encode(payload, priv_key, algorithm="EdDSA", headers=headers)


def ensure_limit(sql: str, limit: int) -> str:
    """Safely apply or update the LIMIT clause in the SQL query."""
    clean_sql = sql.strip().rstrip(";")
    if re.search(r"\bLIMIT\s+\d+\s*$", clean_sql, re.IGNORECASE):
        return re.sub(
            r"\bLIMIT\s+\d+\s*$",
            f"LIMIT {limit}",
            clean_sql,
            flags=re.IGNORECASE,
        )
    return f"{clean_sql}\nLIMIT {limit}"


def update_query_cursor(sql: str, col_name: str, new_val, direction: str = "ASC") -> str:
    """Update or inject the cursor condition (>= or <=) for the selected column into the SQL query."""
    val_str = str(new_val) if isinstance(new_val, (int, float)) else f"'{new_val}'"
    op = "<=" if direction.upper() == "DESC" else ">="
    pattern = rf"(\b{re.escape(col_name)}\s*)(>=?|<=?)(\s*)(\d+|\'[^\']*\')"
    if re.search(pattern, sql, re.IGNORECASE):
        return re.sub(pattern, rf"\g<1>{op}\g<3>{val_str}", sql, flags=re.IGNORECASE)
    else:
        if re.search(r"\bWHERE\b", sql, re.IGNORECASE):
            return re.sub(
                r"(\bWHERE\b\s+)",
                rf"\g<1>{col_name} {op} {val_str}\n  AND ",
                sql,
                flags=re.IGNORECASE,
                count=1,
            )
        else:
            order_match = re.search(r"(\bORDER\s+BY\b|\bLIMIT\b)", sql, re.IGNORECASE)
            if order_match:
                idx = order_match.start()
                return f"{sql[:idx]}WHERE {col_name} {op} {val_str}\n{sql[idx:]}"
            return f"{sql}\nWHERE {col_name} {op} {val_str}"


def get_last_csv_row_value(path: Path, col_name: str):
    """Retrieve the last row value of a column using pandas."""
    if not path.exists():
        return None
    try:
        df_col = pd.read_csv(path, usecols=[col_name], low_memory=False)
        if df_col.empty:
            return None
        series = df_col[col_name].dropna()
        if series.empty:
            return None
        last_val = series.iloc[-1]
        try:
            num = float(last_val)
            return int(num) if num.is_integer() else num
        except (ValueError, TypeError):
            return str(last_val)
    except Exception:
        return None


def make_dataframe_hashable(df: pd.DataFrame) -> pd.DataFrame:
    """Ensure all columns contain hashable types and cast oversized integers to strings."""
    df = df.copy()
    for col in df.columns:
        if df[col].dtype == "object":
            df[col] = df[col].map(
                lambda v: json.dumps(v, sort_keys=True) if isinstance(v, (dict, list, set))
                else (str(v) if isinstance(v, int) and (v > 2**63 - 1 or v < -(2**63)) else v)
            )
        elif pd.api.types.is_integer_dtype(df[col]):
            if (df[col] > 2**63 - 1).any() or (df[col] < -(2**63)).any():
                df[col] = df[col].astype(str)
    return df


def safe_drop_duplicates(df: pd.DataFrame) -> tuple[pd.DataFrame, int]:
    """Safely drop duplicate rows."""
    initial_len = len(df)
    clean_df = make_dataframe_hashable(df)
    try:
        deduped = clean_df.drop_duplicates()
    except TypeError:
        fallback_df = clean_df.copy()
        for col in fallback_df.columns:
            if fallback_df[col].dtype == "object":
                fallback_df[col] = fallback_df[col].astype(str)
        deduped = fallback_df.drop_duplicates()
    dropped = initial_len - len(deduped)
    return deduped, dropped


def run_extractor(
    output_filename: str,
    sql_query: str,
    order_col: str = "block_number",
    order_dir: str = "ASC",
    batch_limit: int = 50000,
    max_batches: int | None = None,
    delay_seconds: float = 0.5,
):
    """
    Execute extraction loop until block_number stops increasing or 0 rows returned.
    """
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    target_path = DATA_DIR / output_filename
    if not target_path.name.endswith(".csv"):
        target_path = target_path.with_suffix(".csv")

    print(f"🚀 Starting Autonomous CDP Extractor")
    print(f"📁 Target Output: {target_path}")
    print(f"🎯 Tracking Column: {order_col} ({order_dir})")
    print(f"🔢 Batch Size Limit: {batch_limit:,}")

    # Check if target file already exists and get starting cursor
    last_cursor_val = None
    total_rows = 0
    cached_tail = pd.DataFrame()

    if target_path.exists():
        last_cursor_val = get_last_csv_row_value(target_path, order_col)
        try:
            total_rows = pd.read_csv(target_path, usecols=[order_col], low_memory=False).shape[0]
            cached_tail = pd.read_csv(target_path, low_memory=False).tail(5000)
        except Exception:
            total_rows = 0
        print(f"ℹ️ Found existing dataset with {total_rows:,} rows. Starting cursor {order_col} = {last_cursor_val}")
    else:
        print(f"✨ Target file does not exist yet. Will create new file upon first batch.")

    current_sql = sql_query
    if last_cursor_val is not None:
        current_sql = update_query_cursor(current_sql, order_col, last_cursor_val, order_dir)

    batch_idx = 0
    previous_max_val = last_cursor_val

    while True:
        batch_idx += 1
        if max_batches and batch_idx > max_batches:
            print(f"🛑 Reached user-defined max batches ({max_batches}). Stopping.")
            break

        final_sql = ensure_limit(current_sql, batch_limit)
        print(f"\n--- [Batch #{batch_idx}] ---")
        print(f"⏳ Querying CDP (Cursor: {order_col} = {previous_max_val})...")

        token = generate_jwt(KEY_FILE)
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        }

        start_time = time.time()
        try:
            response = requests.post(API_URL, json={"sql": final_sql}, headers=headers, timeout=120)
        except Exception as err:
            print(f"❌ Network request error: {err}. Retrying in 5s...")
            time.sleep(5)
            continue

        elapsed = time.time() - start_time

        if not response.ok:
            print(f"❌ API Error {response.status_code}: {response.text[:200]}")
            if response.status_code in (429, 500, 502, 503, 504):
                print(f"⏳ Transient error encountered. Waiting 10s before retry...")
                time.sleep(10)
                continue
            print(f"🛑 Halting due to query failure.")
            break

        data = response.json()
        rows = data.get("result", [])
        if not rows:
            print(f"🏁 Query returned 0 rows in {elapsed:.2f}s. Reached the latest block tip!")
            break

        df = pd.DataFrame(rows)
        df = make_dataframe_hashable(df)
        raw_count = len(df)

        # Drop duplicates within batch
        df, internal_dups = safe_drop_duplicates(df)

        # Boundary deduplication against tail of existing file
        boundary_dups = 0
        if target_path.exists() and order_col in df.columns:
            boundary_val = df[order_col].min() if order_dir == "ASC" else df[order_col].max()
            boundary_mask = df[order_col] == boundary_val
            incoming_boundary = df[boundary_mask]

            if not incoming_boundary.empty and not cached_tail.empty and order_col in cached_tail.columns:
                existing_boundary = cached_tail[cached_tail[order_col] == boundary_val]
                if not existing_boundary.empty:
                    combined = pd.concat([existing_boundary, incoming_boundary], ignore_index=True)
                    combined_deduped = combined.drop_duplicates(keep="first")
                    valid_incoming = combined_deduped.iloc[len(existing_boundary):]
                    df = pd.concat([valid_incoming, df[~boundary_mask]], ignore_index=True)
                    boundary_dups = len(incoming_boundary) - len(valid_incoming)

        # Check latest value in batch
        if order_col not in df.columns or df.empty:
            print(f"⚠️ No valid rows left after deduplication.")
            break

        current_batch_max = df[order_col].max() if order_dir == "ASC" else df[order_col].min()

        # Write to file
        is_first_write = not target_path.exists()
        df.to_csv(target_path, mode="w" if is_first_write else "a", header=is_first_write, index=False)

        total_rows += len(df)
        cached_tail = df.tail(1000)

        print(
            f"✅ Batch #{batch_idx} completed in {elapsed:.2f}s | "
            f"Fetched: +{raw_count:,} | Deduped: -{internal_dups + boundary_dups} | "
            f"Added: +{len(df):,} | Total Rows: {total_rows:,} | "
            f"New {order_col}: {current_batch_max}"
        )

        # Check termination condition: Did the cursor stop advancing?
        if previous_max_val is not None and current_batch_max == previous_max_val:
            print(f"🏁 Cursor {order_col} stopped advancing at {current_batch_max}. Chain tip reached!")
            break

        # If batch returned fewer rows than limit, we're likely caught up to the tip
        if raw_count < batch_limit:
            print(f"🏁 Batch returned fewer rows ({raw_count:,}) than limit ({batch_limit:,}). Tip reached!")
            break

        previous_max_val = current_batch_max
        current_sql = update_query_cursor(current_sql, order_col, current_batch_max, order_dir)

        if delay_seconds > 0:
            time.sleep(delay_seconds)

    print(f"\n🎉 Extraction Finished! Total dataset rows in {target_path.name}: {total_rows:,}")
    return total_rows


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Autonomous CDP Batch Extractor")
    parser.add_argument(
        "--file",
        "-f",
        default="aerodrome_pairs.csv",
        help="Target CSV filename inside extract/data/",
    )
    parser.add_argument(
        "--query-file",
        "-q",
        default=None,
        help="Path to SQL file containing the base query",
    )
    parser.add_argument(
        "--order-col",
        "-c",
        default="block_number",
        help="Cursor tracking column (default: block_number)",
    )
    parser.add_argument(
        "--order-dir",
        "-d",
        default="ASC",
        choices=["ASC", "DESC"],
        help="Order direction (default: ASC)",
    )
    parser.add_argument(
        "--limit",
        "-l",
        type=int,
        default=50000,
        help="Rows per batch (max: 50,000)",
    )
    parser.add_argument(
        "--max-batches",
        "-m",
        type=int,
        default=None,
        help="Optional max batches to run",
    )

    args = parser.parse_args()

    query_str = DEFAULT_SQL
    if args.query_file:
        q_path = Path(args.query_file)
        if q_path.exists():
            query_str = q_path.read_text(encoding="utf-8")
        else:
            print(f"❌ Query file not found: {q_path}")
            sys.exit(1)

    run_extractor(
        output_filename=args.file,
        sql_query=query_str,
        order_col=args.order_col,
        order_dir=args.order_dir,
        batch_limit=args.limit,
        max_batches=args.max_batches,
    )
