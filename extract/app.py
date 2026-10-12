import base64
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
    page_title="CDP On-Chain SQL Extractor",
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
    s.block_timestamp,
    s.transaction_hash,
    s.address AS pair_address,
    s.parameters['sender'] AS sender,
    s.parameters['amount0In'] AS amount0_in,
    s.parameters['amount1In'] AS amount1_in,
    s.parameters['amount0Out'] AS amount0_out,
    s.parameters['amount1Out'] AS amount1_out,
    s.parameters['to'] AS recipient
FROM base.events s
WHERE s.event_signature = 'Swap(address,uint256,uint256,uint256,uint256,address)'
AND s.action = 1
AND s.block_timestamp >= NOW() - INTERVAL 7 DAY 
AND s.address IN (
    SELECT parameters['pair']
    FROM base.events
    WHERE address = '0x8909dc15e40173ff4699343b6eb8132c65e18ec6' -- Aerodrome Factory
        AND event_signature = 'PairCreated(address,address,address,uint256)'
        AND action = 1
        AND block_timestamp >= NOW() - INTERVAL 90 DAY
)
ORDER BY s.block_timestamp DESC"""


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
    # Check if top-level LIMIT exists at the end
    if re.search(r"\bLIMIT\s+\d+\s*$", clean_sql, re.IGNORECASE):
        # Replace existing limit with user-selected limit
        clean_sql = re.sub(
            r"\bLIMIT\s+\d+\s*$",
            f"LIMIT {limit}",
            clean_sql,
            flags=re.IGNORECASE,
        )
    else:
        clean_sql = f"{clean_sql}\nLIMIT {limit}"
    return clean_sql


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
st.title("⚡ CDP On-Chain SQL Extractor")
st.caption("Query indexed Base blockchain data via Coinbase Developer Platform & export directly to CSV.")

# --- Sidebar / Credential Status ---
with st.sidebar:
    st.header("🔑 Credentials Status")
    if KEY_FILE.exists():
        st.success("`cdp_api_key.json` detected", icon="✅")
    else:
        st.error("`cdp_api_key.json` not found in `extract/`", icon="⚠️")

    st.markdown("---")
    st.header("📁 Saved Data Files")
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    csv_files = list(DATA_DIR.glob("*.csv"))
    if csv_files:
        for f in sorted(csv_files, key=lambda x: x.stat().st_mtime, reverse=True):
            size_mb = f.stat().st_size / (1024 * 1024)
            st.markdown(f"- **`{f.name}`** ({size_mb:.1f} MB)")
    else:
        st.info("No CSV files saved yet.")

# --- Main Form ---
col_file, col_limit = st.columns([2, 1])

with col_file:
    file_name = st.text_input(
        "📄 CSV File Name",
        value="aerodrome_swaps.csv",
        help="The CSV will be saved inside extract/data/",
    )
    if not file_name.endswith(".csv"):
        file_name = f"{file_name}.csv"

    target_path = DATA_DIR / file_name
    if target_path.exists():
        size_mb = target_path.stat().st_size / (1024 * 1024)
        st.caption(f"📁 Target exists ({size_mb:.2f} MB)")
    else:
        st.caption("✨ Target will be created as a new file.")

with col_limit:
    limit_value = st.number_input(
        "🔢 Row Limit (Max: 50,000)",
        min_value=1,
        max_value=50000,
        value=50000,
        step=1000,
        help="CDP enforces a hard limit of 50,000 rows per query.",
    )

col_mode, col_dedup, col_sort = st.columns([2, 1.2, 1.2])

with col_mode:
    save_mode = st.radio(
        "💾 Save Action",
        options=["Append to previous data", "Replace / Overwrite"],
        index=0,
        horizontal=True,
        help=(
            "Append: Merges new query results with previously saved data so you can run queries by range.\n"
            "Replace: Completely overwrites the existing file."
        ),
    )

with col_dedup:
    deduplicate = st.checkbox(
        "Deduplicate rows",
        value=True,
        help="Removes duplicate rows when appending so overlapping ranges don't duplicate records.",
    )

with col_sort:
    sort_timestamp = st.checkbox(
        "Sort by timestamp",
        value=True,
        help="Sort results descending by block_timestamp if the column exists.",
    )

sql_query = st.text_area(
    "📝 SQL Query",
    value=DEFAULT_SQL,
    height=320,
    help="Enter standard ClickHouse SQL. Tables available: base.transactions, base.events, base.blocks, etc.",
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
                        st.info("Query returned 0 rows.")
                    else:
                        st.write("3️⃣ Parsing and saving results...")
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

                        if sort_timestamp and "block_timestamp" in final_df.columns:
                            final_df = final_df.sort_values(by="block_timestamp", ascending=False)

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
                                f"Successfully appended **{new_row_count:,} new rows** to `{output_path}`. "
                                f"File now contains **{total_rows:,} total rows**."
                            )
                        else:
                            st.success(f"Successfully saved **{total_rows:,} rows** to `{output_path}`")

                        # Display metrics
                        if is_append:
                            m1, m2, m3, m4 = st.columns(4)
                            m1.metric("New Rows Fetched", f"+{new_row_count:,}")
                            m1.metric("Previous Rows", f"{prev_row_count:,}")
                            m1.metric("Duplicates Dropped", f"{duplicates_dropped:,}")
                            m1.metric("Total Rows in File", f"{total_rows:,}")
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
