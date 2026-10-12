import base64
import csv
import json
import re
import secrets
import time
from pathlib import Path

import jwt
import pandas as pd
import requests
import streamlit as st
from cryptography.hazmat.primitives.asymmetric import ed25519

# Set page config
st.set_page_config(
    page_title="CDP On-Chain SQL Extractor v2",
    page_icon="⚡",
    layout="wide",
)

# Paths
BASE_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = BASE_DIR.parent
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
  AND block_number >= 9000000  -- Roughly the start of 2024 on Base
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

    # Ed25519 seed is first 32 bytes
    priv_key = ed25519.Ed25519PrivateKey.from_private_bytes(raw_key[:32])

    now = int(time.time())
    payload = {
        "sub": key_id,
        "iss": "cdp",
        "nbf": now,
        "exp": now + 120,  # 2 minutes expiry
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
        clean_sql = re.sub(
            r"\bLIMIT\s+\d+\s*$",
            f"LIMIT {limit}",
            clean_sql,
            flags=re.IGNORECASE,
        )
    else:
        clean_sql = f"{clean_sql}\nLIMIT {limit}"
    return clean_sql


def get_csv_columns(path: Path) -> list[str]:
    """Read only the CSV header to extract column names rapidly in sub-millisecond time."""
    if not path.exists():
        return []
    try:
        with open(path, "r", encoding="utf-8", errors="replace") as f:
            header_line = f.readline().strip()
        if not header_line:
            return []
        reader = csv.reader([header_line])
        return [c.strip() for c in next(reader) if c.strip()]
    except Exception:
        return []


def get_last_csv_row_value(path: Path, col_name: str):
    """
    Instantly retrieve the last row value of a column by seeking to the end of the file.
    Executes in under 1ms even for gigabyte-sized files.
    """
    if not path.exists():
        return None
    try:
        with open(path, "r", encoding="utf-8", errors="replace") as f:
            header_line = f.readline().strip()
        cols = [c.strip() for c in next(csv.reader([header_line]))]
        if col_name not in cols:
            return None
        col_idx = cols.index(col_name)

        with open(path, "rb") as f:
            f.seek(0, 2)
            file_size = f.tell()
            if file_size == 0:
                return None
            buffer_size = min(file_size, 8192)
            f.seek(file_size - buffer_size)
            chunk = f.read().decode("utf-8", errors="replace")
            lines = chunk.strip().split("\n")
            if not lines:
                return None
            last_line = lines[-1].strip()
            row = next(csv.reader([last_line]))
            if len(row) > col_idx:
                raw_val = row[col_idx].strip()
                try:
                    num = float(raw_val)
                    return int(num) if num.is_integer() else num
                except ValueError:
                    return raw_val
    except Exception:
        return None


def update_query_cursor(sql: str, col_name: str, new_val) -> str:
    """Update or inject the >= cursor condition for the selected column into the SQL query."""
    val_str = str(new_val) if isinstance(new_val, (int, float)) else f"'{new_val}'"
    pattern = rf"(\b{re.escape(col_name)}\s*>=?\s*)(\d+|\'[^\']*\')"
    if re.search(pattern, sql, re.IGNORECASE):
        return re.sub(pattern, rf"\g<1>{val_str}", sql, flags=re.IGNORECASE)
    else:
        if re.search(r"\bWHERE\b", sql, re.IGNORECASE):
            return re.sub(
                r"(\bWHERE\b\s+)",
                rf"\g<1>{col_name} >= {val_str}\n  AND ",
                sql,
                flags=re.IGNORECASE,
                count=1,
            )
        else:
            order_match = re.search(r"(\bORDER\s+BY\b|\bLIMIT\b)", sql, re.IGNORECASE)
            if order_match:
                idx = order_match.start()
                return f"{sql[:idx]}WHERE {col_name} >= {val_str}\n{sql[idx:]}"
            return f"{sql}\nWHERE {col_name} >= {val_str}"


def make_dataframe_hashable(df: pd.DataFrame) -> pd.DataFrame:
    """Ensure all columns contain hashable types by serializing dicts/lists to JSON strings."""
    df = df.copy()
    for col in df.columns:
        if df[col].dtype == "object":
            df[col] = df[col].map(
                lambda v: json.dumps(v, sort_keys=True) if isinstance(v, (dict, list, set)) else v
            )
    return df


def safe_drop_duplicates(df: pd.DataFrame) -> tuple[pd.DataFrame, int]:
    """Safely drop duplicate rows, handling unhashable types like dicts or lists."""
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


# --- UI Header ---
st.title("⚡ CDP On-Chain SQL Extractor v2")
st.caption(
    "Query indexed Base blockchain data in 50k row batches with instant cursor tracking, "
    "column ordering, deduplication, and continuous CSV appending."
)

# Initialize Session State
if "sql_query_input_v2" not in st.session_state:
    st.session_state["sql_query_input_v2"] = DEFAULT_SQL

# --- Main Form File Selection ---
col_file, col_limit = st.columns([2, 1])

with col_file:
    file_name = st.text_input(
        "📄 CSV File Name",
        value="aerodrome_pairs.csv",
        help="The CSV will be saved or appended inside extract/data/",
    )
    if not file_name.endswith(".csv"):
        file_name = f"{file_name}.csv"

    target_path = DATA_DIR / file_name
    target_exists = target_path.exists()
    if target_exists:
        target_mb = target_path.stat().st_size / (1024 * 1024)
        st.caption(f"📁 Target file exists on disk: `{target_path.name}` ({target_mb:.2f} MB)")
    else:
        st.caption("✨ Target will be created as a new file upon first run.")

# --- Sidebar / Credential Status & Active Target File ---
with st.sidebar:
    st.header("🔑 Credentials Status")
    if KEY_FILE.exists():
        st.success("`cdp_api_key.json` detected", icon="✅")
    else:
        st.error("`cdp_api_key.json` not found in `extract/`", icon="⚠️")

    st.markdown("---")
    st.header("📄 Active Target File")
    if target_exists:
        target_mb = target_path.stat().st_size / (1024 * 1024)
        st.success(f"**`{target_path.name}`**\n\nSize: `{target_mb:.2f} MB`")
    else:
        st.info(f"**`{file_name}`**\n\nNot created yet.")

with col_limit:
    limit_value = st.number_input(
        "🔢 Row Limit (Max: 50,000)",
        min_value=1,
        max_value=50000,
        value=50000,
        step=1000,
        help="CDP enforces a hard limit of 50,000 rows per query.",
    )

col_mode, col_dedup = st.columns([2, 1])

with col_mode:
    save_mode = st.radio(
        "💾 Save Action",
        options=["Append to previous data", "Replace / Overwrite"],
        index=0,
        horizontal=True,
        help=(
            "Append: Merges new query results with previous data and deduplicates boundaries.\n"
            "Replace: Completely overwrites the existing file."
        ),
    )

with col_dedup:
    deduplicate = st.checkbox(
        "Deduplicate rows",
        value=True,
        help="Removes duplicate rows when appending so boundary overlap records are clean.",
    )

# --- Cursor & Order-By Section (Instant Load) ---
csv_columns = get_csv_columns(target_path) if target_exists else []
order_col = "block_number"
order_dir = "ASC"

if target_exists and save_mode.startswith("Append") and csv_columns:
    st.markdown("---")
    st.subheader("🎯 Batch Range & Cursor Tracking")

    c_col, c_dir = st.columns([2, 1])
    with c_col:
        # Default priority: block_number > block_timestamp > first column
        default_idx = 0
        if "block_number" in csv_columns:
            default_idx = csv_columns.index("block_number")
        elif "block_timestamp" in csv_columns:
            default_idx = csv_columns.index("block_timestamp")

        order_col = st.selectbox(
            "📌 Column to Order By & Track Cursor:",
            options=csv_columns,
            index=default_idx,
            help="Select the column used for ordering your batches (e.g. block_number).",
        )

    with c_dir:
        order_dir = st.selectbox(
            "↕️ Order Direction:",
            options=["ASC", "DESC"],
            index=0,
            help="ASC = Ascending (low to high, standard for block ranges); DESC = Descending.",
        )

    # Sub-millisecond extraction of the last value
    last_val = get_last_csv_row_value(target_path, order_col)

    if last_val is not None:
        c_val, c_btn = st.columns([1, 2])
        with c_val:
            display_val = f"{last_val:,}" if isinstance(last_val, (int, float)) else str(last_val)
            st.metric(
                label=f"Last Value in File ({order_col})",
                value=display_val,
                help=f"The value at the end of {file_name}. Use this as the starting block for the next batch.",
            )

        with c_btn:
            advance_label = f"⚡ Advance Query to: {order_col} >= {last_val}"
            if st.button(advance_label, use_container_width=True, type="secondary"):
                new_sql = update_query_cursor(
                    st.session_state["sql_query_input_v2"], order_col, last_val
                )
                st.session_state["sql_query_input_v2"] = new_sql
                st.rerun()

            st.caption(f"Suggested WHERE clause: `{order_col} >= {last_val}`")

    st.markdown("---")

# --- SQL Query Area ---
sql_query = st.text_area(
    "📝 SQL Query",
    value=st.session_state["sql_query_input_v2"],
    height=320,
    key="sql_query_input_v2",
    help="Enter ClickHouse SQL. Update the cursor condition (e.g. block_number >= ...) between iterations.",
)

# Run Query Action
if st.button("🚀 Run Query & Export Data", type="primary", use_container_width=True):
    if not sql_query.strip():
        st.warning("Please enter a SQL query.")
    elif not KEY_FILE.exists():
        st.error(f"Cannot proceed: API Key file missing at `{KEY_FILE}`")
    else:
        final_sql = ensure_limit(sql_query, limit_value)

        with st.status("Executing query on CDP...", expanded=True) as status:
            try:
                st.write("1️⃣ Generating authenticated Ed25519 JWT...")
                token = generate_jwt(KEY_FILE)

                headers = {
                    "Authorization": f"Bearer {token}",
                    "Content-Type": "application/json",
                }

                payload = {"sql": final_sql}

                st.write("2️⃣ Sending request to CDP query engine...")
                start_time = time.time()
                response = requests.post(API_URL, json=payload, headers=headers)
                elapsed = time.time() - start_time

                if not response.ok:
                    status.update(label="Query Failed!", state="error", expanded=True)
                    st.error(f"API Error {response.status_code}")
                    st.code(response.text, language="json")
                else:
                    data = response.json()
                    rows = data.get("result", [])
                    metadata = data.get("metadata", {})

                    if not rows:
                        status.update(label="Query succeeded (0 rows)", state="complete")
                        st.info("Query returned 0 rows. You may have reached the latest block or condition limit.")
                    else:
                        st.write("3️⃣ Parsing and serializing results...")
                        df = pd.DataFrame(rows)
                        df = make_dataframe_hashable(df)
                        new_row_count = len(df)

                        output_path = DATA_DIR / file_name
                        output_path.parent.mkdir(parents=True, exist_ok=True)

                        is_append = save_mode.startswith("Append") and output_path.exists()
                        prev_row_count = 0
                        duplicates_dropped = 0

                        if is_append:
                            try:
                                existing_df = pd.read_csv(output_path, low_memory=False)
                                prev_row_count = len(existing_df)
                                final_df = pd.concat([existing_df, df], ignore_index=True)
                            except Exception as read_err:
                                st.warning(f"Could not read existing CSV ({read_err}); starting fresh.")
                                final_df = df
                        else:
                            final_df = df

                        if deduplicate:
                            final_df, duplicates_dropped = safe_drop_duplicates(final_df)

                        # Sort by user's chosen column and direction if column exists
                        active_sort_col = order_col if (order_col and order_col in final_df.columns) else None
                        if not active_sort_col:
                            if "block_number" in final_df.columns:
                                active_sort_col = "block_number"
                            elif "block_timestamp" in final_df.columns:
                                active_sort_col = "block_timestamp"

                        if active_sort_col:
                            ascending_order = (order_dir == "ASC")
                            if pd.to_numeric(final_df[active_sort_col], errors="coerce").notna().sum() > (len(final_df) * 0.9):
                                sort_helper = pd.to_numeric(final_df[active_sort_col], errors="coerce")
                                final_df = final_df.iloc[sort_helper.argsort(kind="mergesort")]
                                if not ascending_order:
                                    final_df = final_df.iloc[::-1]
                            else:
                                final_df = final_df.sort_values(by=active_sort_col, ascending=ascending_order)

                        final_df.to_csv(output_path, index=False)
                        total_rows = len(final_df)

                        status_label = (
                            f"Appended {new_row_count:,} rows (Total: {total_rows:,}) in {elapsed:.2f}s"
                            if is_append
                            else f"Saved {total_rows:,} rows in {elapsed:.2f}s"
                        )
                        status.update(
                            label=status_label,
                            state="complete",
                            expanded=False,
                        )

                        if is_append:
                            st.success(
                                f"Successfully appended **{new_row_count:,} rows** to `{output_path}`. "
                                f"File now contains **{total_rows:,} total rows**."
                            )
                        else:
                            st.success(f"Successfully saved **{total_rows:,} rows** to `{output_path}`")

                        # Display metrics
                        if is_append:
                            m1, m2, m3, m4 = st.columns(4)
                            m1.metric("New Rows Fetched", f"+{new_row_count:,}")
                            m2.metric("Previous Rows", f"{prev_row_count:,}")
                            m3.metric("Duplicates Dropped", f"{duplicates_dropped:,}")
                            m4.metric("Total Rows in File", f"{total_rows:,}")
                        else:
                            m1, m2, m3 = st.columns(3)
                            m1.metric("Rows Returned", f"{total_rows:,}")
                            m2.metric("Execution Time", f"{elapsed:.2f}s")
                            m3.metric("Cached", str(metadata.get("cached", False)))

                        # Download buttons
                        csv_data = final_df.to_csv(index=False).encode("utf-8")
                        if is_append:
                            col_dl1, col_dl2 = st.columns(2)
                            with col_dl1:
                                st.download_button(
                                    label=f"⬇️ Download Full Dataset ({total_rows:,} rows)",
                                    data=csv_data,
                                    file_name=file_name,
                                    mime="text/csv",
                                    use_container_width=True,
                                )
                            with col_dl2:
                                batch_csv = df.to_csv(index=False).encode("utf-8")
                                st.download_button(
                                    label=f"⬇️ Download Current Batch ({new_row_count:,} rows)",
                                    data=batch_csv,
                                    file_name=f"batch_{file_name}",
                                    mime="text/csv",
                                    use_container_width=True,
                                )
                        else:
                            st.download_button(
                                label=f"⬇️ Download CSV File ({total_rows:,} rows)",
                                data=csv_data,
                                file_name=file_name,
                                mime="text/csv",
                                use_container_width=True,
                            )

                        # Preview Data
                        st.subheader(f"📊 Data Preview (Top 100 of {total_rows:,} rows)")
                        st.dataframe(final_df.head(100), use_container_width=True)

            except Exception as e:
                status.update(label="Error occurred", state="error")
                st.exception(e)
