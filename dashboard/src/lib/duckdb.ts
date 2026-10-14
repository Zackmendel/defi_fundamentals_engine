import duckdb from 'duckdb';
import path from 'path';
import fs from 'fs';

const PRIMARY_DB_PATH = path.resolve(process.cwd(), '../dbt/defi_fundamentals.duckdb');
const SNAPSHOT_DIR = '/tmp/defi_engine_active';
const SNAPSHOT_DB_PATH = path.join(SNAPSHOT_DIR, 'defi_fundamentals.duckdb');

export function sanitizeBigInts<T>(obj: T): T {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'bigint') return Number(obj) as unknown as T;
  if (Array.isArray(obj)) return obj.map(sanitizeBigInts) as unknown as T;
  if (typeof obj === 'object') {
    const res: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(obj)) {
      res[key] = sanitizeBigInts(val);
    }
    return res as T;
  }
  return obj;
}

// Global singleton cache across requests
let globalDb: duckdb.Database | null = null;
let initPromise: Promise<duckdb.Database> | null = null;

/**
 * Initializes and returns a persistent singleton DuckDB database handle.
 */
function getOrInitDatabase(): Promise<duckdb.Database> {
  if (globalDb) return Promise.resolve(globalDb);
  if (initPromise) return initPromise;

  initPromise = new Promise<duckdb.Database>((resolve, reject) => {
    // 1. First attempt: Direct connection to dbt database in OPEN_READONLY mode
    const directDb = new duckdb.Database(PRIMARY_DB_PATH, duckdb.OPEN_READONLY, (err) => {
      if (!err) {
        globalDb = directDb;
        console.log(`[DuckDB] Successfully connected directly to ${PRIMARY_DB_PATH} in READ_ONLY mode.`);
        return resolve(directDb);
      }

      console.warn(
        `[DuckDB] Primary database lock detected (${err.message}). Preparing dedicated read snapshot...`
      );

      // 2. Safe atomic copy to avoid partial-read collisions
      try {
        if (!fs.existsSync(SNAPSHOT_DIR)) {
          fs.mkdirSync(SNAPSHOT_DIR, { recursive: true });
        }
        const tempPath = `${SNAPSHOT_DB_PATH}.${Date.now()}.tmp`;
        fs.copyFileSync(PRIMARY_DB_PATH, tempPath);
        fs.renameSync(tempPath, SNAPSHOT_DB_PATH);

        const snapDb = new duckdb.Database(SNAPSHOT_DB_PATH, duckdb.OPEN_READONLY, (snapErr) => {
          if (snapErr) {
            console.error('[DuckDB] Snapshot initialization error:', snapErr.message);
            return reject(snapErr);
          }
          globalDb = snapDb;
          console.log(`[DuckDB] Successfully connected to snapshot ${SNAPSHOT_DB_PATH} in READ_ONLY mode.`);
          resolve(snapDb);
        });
      } catch (copyErr) {
        console.error('[DuckDB] Snapshot creation failed:', copyErr);
        reject(copyErr);
      }
    });
  });

  return initPromise;
}

/**
 * Executes a SQL query against the singleton DuckDB connection.
 */
export async function queryDuckDB<T = Record<string, unknown>>(sql: string): Promise<T[]> {
  const db = await getOrInitDatabase();

  return new Promise((resolve, reject) => {
    db.all(sql, (err, rows) => {
      if (err) {
        console.error('[DuckDB Query Error]', err.message, '\nQuery:', sql);
        return reject(err);
      }
      resolve(sanitizeBigInts(rows as unknown as T[]));
    });
  });
}

/**
 * High-level executive overview KPIs.
 */
export async function getProtocolOverview() {
  const summarySql = `
    SELECT
      COUNT(DISTINCT block_date) AS active_days,
      MIN(block_date) AS min_date,
      MAX(block_date) AS max_date,
      SUM(trading_volume) AS total_volume_usd,
      SUM(tx_count) AS total_transactions,
      SUM(fees) AS total_fees_usd,
      SUM(lp_fees) AS total_lp_fees_usd,
      SUM(protocol_revenue) AS total_protocol_revenue_usd,
      SUM(fees) / NULLIF(SUM(trading_volume), 0) AS avg_take_rate,
      SUM(trading_volume) / NULLIF(SUM(tx_count), 0) AS overall_avg_trade_size
    FROM metrics.daily_protocol_metrics
  `;

  const tradersSql = `
    SELECT COUNT(*) AS total_unique_wallets
    FROM mart.dim_users
  `;

  const [summary] = await queryDuckDB<{
    active_days: number;
    min_date: string;
    max_date: string;
    total_volume_usd: number;
    total_transactions: number;
    total_fees_usd: number;
    total_lp_fees_usd: number;
    total_protocol_revenue_usd: number;
    avg_take_rate: number;
    overall_avg_trade_size: number;
  }>(summarySql);

  const [traders] = await queryDuckDB<{ total_unique_wallets: number }>(tradersSql);

  return {
    ...summary,
    total_unique_wallets: traders?.total_unique_wallets || 0,
  };
}

/**
 * Daily time-series protocol metrics.
 */
export async function getDailyProtocolMetrics() {
  const sql = `
    SELECT
      STRFTIME(block_date, '%Y-%m-%d') AS date_str,
      block_date,
      trading_volume,
      tx_count,
      active_traders,
      fees,
      lp_fees,
      protocol_revenue,
      take_rate,
      avg_trade_size_usd,
      volume_per_active_trader
    FROM metrics.daily_protocol_metrics
    ORDER BY block_date ASC
  `;
  return queryDuckDB(sql);
}

/**
 * Pool-level aggregates from dimensional mart and pool dimensions.
 */
export async function getPoolMetrics() {
  const sql = `
    SELECT
      p.pool_name,
      p.fee_tier,
      p.pool_address,
      p.base_token,
      p.quote_token,
      SUM(f.amount_usd) AS total_volume_usd,
      COUNT(DISTINCT f.tx_hash) AS total_transactions,
      COUNT(DISTINCT f.sender) AS unique_traders,
      SUM(f.total_fee_usd) AS total_fees_usd,
      SUM(f.lp_fee_usd) AS lp_fees_usd,
      SUM(f.protocol_fee_usd) AS protocol_revenue_usd,
      SUM(f.total_fee_usd) / NULLIF(SUM(f.amount_usd), 0) AS effective_take_rate,
      SUM(f.amount_usd) / NULLIF(COUNT(DISTINCT f.tx_hash), 0) AS avg_trade_size_usd
    FROM mart.fct_uniswap_swaps f
    JOIN mart.dim_pools p ON f.pool_address = p.pool_address
    GROUP BY p.pool_name, p.fee_tier, p.pool_address, p.base_token, p.quote_token
    ORDER BY total_volume_usd DESC
  `;
  return queryDuckDB(sql);
}

/**
 * Table row counts and data quality stats.
 */
export async function getDataQualityStats() {
  const tableCountsSql = `
    SELECT 'main.uniswap_raw_swaps' AS table_name, 'Raw Layer' AS layer, COUNT(*) AS row_count FROM main.uniswap_raw_swaps
    UNION ALL
    SELECT 'staging.stg_uniswap_swaps', 'Staging Layer (View)', COUNT(*) FROM staging.stg_uniswap_swaps
    UNION ALL
    SELECT 'staging.stg_uniswap_pools', 'Staging Layer (View)', COUNT(*) FROM staging.stg_uniswap_pools
    UNION ALL
    SELECT 'mart.fct_uniswap_swaps', 'Mart Layer (Table)', COUNT(*) FROM mart.fct_uniswap_swaps
    UNION ALL
    SELECT 'mart.dim_pools', 'Mart Layer (Table)', COUNT(*) FROM mart.dim_pools
    UNION ALL
    SELECT 'mart.dim_users', 'Mart Layer (Table)', COUNT(*) FROM mart.dim_users
    UNION ALL
    SELECT 'mart.dim_date', 'Mart Layer (Table)', COUNT(*) FROM mart.dim_date
    UNION ALL
    SELECT 'metrics.daily_protocol_metrics', 'Metrics Layer (Table)', COUNT(*) FROM metrics.daily_protocol_metrics
    UNION ALL
    SELECT 'metrics.metrics_by_pool', 'Metrics Layer (Table)', COUNT(*) FROM metrics.metrics_by_pool
  `;

  return queryDuckDB(tableCountsSql);
}
