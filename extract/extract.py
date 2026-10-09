import base64
import json
import secrets
import time
from pathlib import Path

import jwt
import pandas as pd
import requests
from cryptography.hazmat.primitives.asymmetric import ed25519

# Paths
BASE_DIR = Path(__file__).resolve().parent
KEY_FILE = BASE_DIR / "cdp_api_key.json"
OUTPUT_PATH = BASE_DIR / "data" / "base_transactions.csv"

API_HOST = "api.cdp.coinbase.com"
API_PATH = "/platform/v2/data/query/run"
API_URL = f"https://{API_HOST}{API_PATH}"


def generate_jwt(key_file_path: Path) -> str:
    """Read CDP key JSON and generate a signed EdDSA JWT."""
    if not key_file_path.exists():
        raise FileNotFoundError(f"Key file not found at {key_file_path}")

    with open(key_file_path, "r", encoding="utf-8") as f:
        key_data = json.load(f)

    key_id = key_data.get("id") or key_data.get("name")
    raw_key = base64.b64decode(key_data["privateKey"])

    # Ed25519 seed is the first 32 bytes of the 64-byte key
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


def main():
    token = generate_jwt(KEY_FILE)

    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }

    payload = {
        "sql": """
            SELECT
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
            -- 👇 Direct un-aliased comparison forces the engine to auto-infer the type safely
            AND s.address IN (
                SELECT parameters['pair']
                FROM base.events
                WHERE address = '0x8909dc15e40173ff4699343b6eb8132c65e18ec6' -- Factory
                    AND event_signature = 'PairCreated(address,address,address,uint256)'
                    AND action = 1
                    AND block_timestamp >= NOW() - INTERVAL 90 DAY
            )
            ORDER BY s.block_timestamp DESC
            LIMIT 50000
            ;
        """.strip()
    }

    print("Running query against CDP...")
    response = requests.post(API_URL, json=payload, headers=headers)

    if not response.ok:
        print(f"Error {response.status_code}: {response.text}")
        response.raise_for_status()

    data = response.json()
    rows = data.get("result", [])

    if not rows:
        print("Query returned 0 rows.")
        return

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    df = pd.DataFrame(rows)
    df.to_csv(OUTPUT_PATH, index=False)
    print(f"Successfully saved {len(df)} rows to {OUTPUT_PATH}")


if __name__ == "__main__":
    main()