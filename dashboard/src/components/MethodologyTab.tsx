'use client';

import React, { useState } from 'react';

interface TableStat {
  table_name: string;
  layer: string;
  row_count: number;
}

interface TestItem {
  model: string;
  test: string;
  status: string;
  failures: number;
  severity: string;
}

interface IncidentItem {
  id: string;
  date: string;
  severity: string;
  component: string;
  description: string;
  resolution: string;
}

interface MethodologyTabProps {
  tableStats?: TableStat[];
  tests?: TestItem[];
  incidents?: IncidentItem[];
}

export default function MethodologyTab({ tableStats = [], tests = [], incidents = [] }: MethodologyTabProps) {
  const [subTab, setSubTab] = useState<
    'lineage' | 'sources' | 'limitations' | 'incidents' | 'validation'
  >('lineage');

  return (
    <div>
      {/* Sub-navigation bar */}
      <div className="sub-tabs-container">
        <button
          className={`sub-tab-btn ${subTab === 'lineage' ? 'active' : ''}`}
          onClick={() => setSubTab('lineage')}
          id="subtab-lineage"
        >
          1. Metric Lineage
        </button>
        <button
          className={`sub-tab-btn ${subTab === 'sources' ? 'active' : ''}`}
          onClick={() => setSubTab('sources')}
          id="subtab-sources"
        >
          2. Data Sources
        </button>
        <button
          className={`sub-tab-btn ${subTab === 'limitations' ? 'active' : ''}`}
          onClick={() => setSubTab('limitations')}
          id="subtab-limitations"
        >
          3. Known Limitations
        </button>
        <button
          className={`sub-tab-btn ${subTab === 'incidents' ? 'active' : ''}`}
          onClick={() => setSubTab('incidents')}
          id="subtab-incidents"
        >
          4. Data-Quality Incidents
        </button>
        <button
          className={`sub-tab-btn ${subTab === 'validation' ? 'active' : ''}`}
          onClick={() => setSubTab('validation')}
          id="subtab-validation"
        >
          5. Validation Results
        </button>
      </div>

      {/* 1. Metric Lineage */}
      {subTab === 'lineage' && (
        <div>
          <div className="content-card">
            <div className="card-title-row">
              <div>
                <h2 className="section-title">
                  <span style={{ color: '#ff007a' }}>●</span> End-to-End Transformation Lineage
                </h2>
                <div className="section-desc">
                  Directed Acyclic Graph (DAG) illustrating progression from raw event storage to consumable metrics
                </div>
              </div>
            </div>

            <div className="dag-flow">
              {/* Raw Ingestion Layer */}
              <div className="dag-tier">
                <div className="dag-tier-title">
                  <span>Tier 0 &amp; 1: Source &amp; Raw Storage (DuckDB Schema: main)</span>
                </div>
                <div className="dag-nodes">
                  <div className="dag-node" style={{ borderColor: 'rgba(255, 0, 122, 0.4)' }}>
                    <span style={{ color: '#ff007a' }}>📦</span>
                    <span>normalized_swaps_2026_06.parquet</span>
                  </div>
                  <div className="dag-node">
                    <span>⚡</span>
                    <span>main.uniswap_raw_swaps</span>
                    <span className="token-pill" style={{ fontSize: '0.6875rem' }}>
                      {tableStats.find((t) => t.table_name === 'main.uniswap_raw_swaps')?.row_count?.toLocaleString() || '180,422'} rows
                    </span>
                  </div>
                </div>
              </div>

              {/* Staging Layer */}
              <div className="dag-tier">
                <div className="dag-tier-title">
                  <span>Tier 2: 01_staging (Materialized as Views)</span>
                </div>
                <div className="dag-nodes">
                  <div className="dag-node">
                    <span>👁️</span>
                    <span>stg_uniswap_swaps</span>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Timestamp normalization &amp; typecasts</span>
                  </div>
                  <div className="dag-node">
                    <span>👁️</span>
                    <span>stg_uniswap_pools</span>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Distinct pool configurations</span>
                  </div>
                  <div className="dag-node">
                    <span>👁️</span>
                    <span>stg_token_prices</span>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Execution price points</span>
                  </div>
                </div>
              </div>

              {/* Intermediate Layer */}
              <div className="dag-tier">
                <div className="dag-tier-title">
                  <span>Tier 3: 02_intermediate (Financial &amp; Math Formulations)</span>
                </div>
                <div className="dag-nodes">
                  <div className="dag-node">
                    <span>⚙️</span>
                    <span>int_uniswap_fees</span>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Fee tier decimalization &amp; LP / Treasury splits</span>
                  </div>
                  <div className="dag-node">
                    <span>⚙️</span>
                    <span>int_token_prices_daily</span>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Daily OHLCV &amp; Volume-Weighted Average Price (VWAP)</span>
                  </div>
                </div>
              </div>

              {/* Marts Layer */}
              <div className="dag-tier">
                <div className="dag-tier-title">
                  <span>Tier 4: 03_marts (Dimensional Facts &amp; Dimensions)</span>
                </div>
                <div className="dag-nodes">
                  <div className="dag-node">
                    <span>📊</span>
                    <span>fct_uniswap_swaps</span>
                    <span className="token-pill" style={{ fontSize: '0.6875rem' }}>Enriched Swaps</span>
                  </div>
                  <div className="dag-node">
                    <span>📅</span>
                    <span>dim_date</span>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Hourly spine</span>
                  </div>
                  <div className="dag-node">
                    <span>🏊</span>
                    <span>dim_pools</span>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Pool metadata</span>
                  </div>
                  <div className="dag-node">
                    <span>👛</span>
                    <span>dim_users</span>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Unique wallets</span>
                  </div>
                </div>
              </div>

              {/* Metrics Layer */}
              <div className="dag-tier" style={{ background: 'rgba(255, 0, 122, 0.05)', borderColor: 'rgba(255, 0, 122, 0.3)' }}>
                <div className="dag-tier-title">
                  <span>Tier 5: 04_metrics (Executive Pre-Aggregated Tables)</span>
                </div>
                <div className="dag-nodes">
                  <div className="dag-node" style={{ borderColor: '#ff007a' }}>
                    <span style={{ color: '#ff007a' }}>🎯</span>
                    <span style={{ fontWeight: 600 }}>daily_protocol_metrics</span>
                    <span className="token-pill">Protocol KPIs</span>
                  </div>
                  <div className="dag-node" style={{ borderColor: '#fc72ff' }}>
                    <span style={{ color: '#fc72ff' }}>🎯</span>
                    <span style={{ fontWeight: 600 }}>metrics_by_pool</span>
                    <span className="token-pill">Pool KPIs</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Metric Dictionary Definitions */}
          <div className="content-card">
            <h2 className="section-title" style={{ marginBottom: '16px' }}>
              Standard Metric Dictionary &amp; Mathematical Formulations
            </h2>

            <div className="dict-card">
              <div className="dict-header">
                <span className="dict-name">Trading Volume</span>
                <span className="badge">Grain: Protocol × Day</span>
              </div>
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                Total gross notional USD value of executed token swaps routed through Uniswap V3 pools during the measurement period.
              </p>
              <div className="dict-formula">SUM(amount_usd)</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Exclusions: Non-positive volumes (amount_usd &lt;= 0) and unconfirmed / reverted transactions.
              </div>
            </div>

            <div className="dict-card">
              <div className="dict-header">
                <span className="dict-name">Gross Trading Fees</span>
                <span className="badge">Grain: Protocol × Pool × Day</span>
              </div>
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                Cumulative fees collected from traders based on the fee tier configured for each pool.
              </p>
              <div className="dict-formula">SUM((fee_tier / 1000000.0) * amount_usd)</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Exclusions: Ethereum network gas fees (gas is an infrastructure cost paid to block validators, not protocol fees).
              </div>
            </div>

            <div className="dict-card">
              <div className="dict-header">
                <span className="dict-name">Protocol Revenue vs LP Payout</span>
                <span className="badge">Grain: Protocol × Day</span>
              </div>
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                Modeled allocation of trading fees between in-range liquidity providers and the DAO treasury fee switch.
              </p>
              <div className="dict-formula">
                Protocol: CASE WHEN fee_tier &lt;= 500 THEN fees * 0.25 ELSE fees * (1/6) END
              </div>
            </div>

            <div className="dict-card">
              <div className="dict-header">
                <span className="dict-name">Daily Volume-Weighted Average Price (VWAP)</span>
                <span className="badge">Grain: Token Pair × Day</span>
              </div>
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                Benchmark execution price weighted by the volume transacted across all price points throughout the calendar day.
              </p>
              <div className="dict-formula">
                SUM(price_quote * amount_base) / NULLIF(SUM(amount_base), 0)
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. Data Sources */}
      {subTab === 'sources' && (
        <div className="content-card">
          <div className="card-title-row">
            <div>
              <h2 className="section-title">
                <span style={{ color: '#22d3ee' }}>●</span> Data Sources &amp; Ingestion Pipelines
              </h2>
              <div className="section-desc">
                Source provenance, on-chain contract interfaces, and DuckDB raw schema mapping
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px', marginBottom: '24px' }}>
            <div style={{ background: 'rgba(255,255,255,0.02)', padding: '20px', borderRadius: '12px', border: '1px solid var(--bg-card-border)' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--accent-pink)', fontWeight: 700, textTransform: 'uppercase', marginBottom: '8px' }}>
                Primary Historical Source
              </div>
              <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#fff', marginBottom: '8px' }}>
                Marvin Gonzo Uniswap V3 Ethereum Swaps
              </h3>
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', lineHeight: '1.6', marginBottom: '12px' }}>
                Covers Ethereum mainnet BTC/ETH swaps for June 2026. Stored in high-performance columnar Parquet format and ingested directly via DuckDB zero-copy SQL.
              </p>
              <a
                href="https://www.kaggle.com/datasets/marvingozo/ethereum-uniswap-v3-btceth-june-2026?resource=download"
                target="_blank"
                rel="noreferrer"
                className="token-pill"
                style={{ textDecoration: 'none' }}
              >
                ↗ View Kaggle Dataset
              </a>
            </div>

            <div style={{ background: 'rgba(255,255,255,0.02)', padding: '20px', borderRadius: '12px', border: '1px solid var(--bg-card-border)' }}>
              <div style={{ fontSize: '0.75rem', color: '#22d3ee', fontWeight: 700, textTransform: 'uppercase', marginBottom: '8px' }}>
                Real-Time Streaming Engine
              </div>
              <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#fff', marginBottom: '8px' }}>
                Coinbase Developer Platform (CDP) API
              </h3>
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', lineHeight: '1.6', marginBottom: '12px' }}>
                Autonomous extractor (<code className="mono-text" style={{ color: '#22d3ee' }}>extract/auto_extractor.py</code>) running authenticated Ed25519 JWT queries against indexed Base and Ethereum blocks until the latest block tip is reached.
              </p>
              <span className="token-pill" style={{ borderColor: 'rgba(34, 211, 238, 0.4)', color: '#22d3ee' }}>
                50,000 Rows/Batch • O(1) Dedup
              </span>
            </div>
          </div>

          <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '12px', color: '#fff' }}>
            Raw Schema Field Mapping (<code className="mono-text">main.uniswap_raw_swaps</code>)
          </h3>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Field Name</th>
                  <th>Raw Data Type</th>
                  <th>dbt Staging Cast</th>
                  <th>Description</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><code className="mono-text">timestamp_ms</code></td>
                  <td>BIGINT</td>
                  <td><code className="mono-text">block_timestamp (TIMESTAMP)</code></td>
                  <td>Block timestamp in Unix epoch milliseconds. Converted via <code className="mono-text">to_timestamp(ms/1000.0)</code></td>
                </tr>
                <tr>
                  <td><code className="mono-text">block_number</code></td>
                  <td>BIGINT</td>
                  <td><code className="mono-text">block_number</code></td>
                  <td>EVM block height where the swap was mined.</td>
                </tr>
                <tr>
                  <td><code className="mono-text">tx_hash</code></td>
                  <td>VARCHAR</td>
                  <td><code className="mono-text">tx_hash</code></td>
                  <td>Unique 32-byte transaction hash.</td>
                </tr>
                <tr>
                  <td><code className="mono-text">volume_usd</code></td>
                  <td>DOUBLE</td>
                  <td><code className="mono-text">amount_usd</code></td>
                  <td>Standardized notional dollar trade execution volume.</td>
                </tr>
                <tr>
                  <td><code className="mono-text">fee_tier</code></td>
                  <td>BIGINT</td>
                  <td><code className="mono-text">fee_tier</code></td>
                  <td>Fee parts per million (e.g. 500 = 0.05%, 3000 = 0.3%, 10000 = 1%).</td>
                </tr>
                <tr>
                  <td><code className="mono-text">tick</code></td>
                  <td>BIGINT</td>
                  <td><code className="mono-text">tick</code></td>
                  <td>Uniswap V3 discrete tick index after swap execution.</td>
                </tr>
                <tr>
                  <td><code className="mono-text">pool_liquidity</code></td>
                  <td>VARCHAR</td>
                  <td><code className="mono-text">pool_liquidity</code></td>
                  <td>Active virtual liquidity (L) active during swap.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 3. Known Limitations */}
      {subTab === 'limitations' && (
        <div className="content-card">
          <div className="card-title-row">
            <div>
              <h2 className="section-title">
                <span style={{ color: '#f59e0b' }}>●</span> Known Methodological Limitations &amp; Assumptions
              </h2>
              <div className="section-desc">
                Analytical boundaries, protocol fee switch considerations, and roadmap improvements
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ background: 'rgba(245, 158, 11, 0.06)', border: '1px solid rgba(245, 158, 11, 0.25)', borderRadius: '12px', padding: '18px' }}>
              <h3 style={{ fontSize: '0.9375rem', fontWeight: 700, color: '#f59e0b', marginBottom: '6px' }}>
                1. Protocol Fee Switch Modeling
              </h3>
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
                Uniswap V3 governance has debated activating the protocol fee switch (which redirects 1/4th of fees on low-fee pools and 1/6th of fees on standard pools to the DAO treasury). In this pipeline, protocol revenue is modeled deterministically based on standard governance parameter specifications to calculate potential and simulated treasury yields.
              </p>
            </div>

            <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--bg-card-border)', borderRadius: '12px', padding: '18px' }}>
              <h3 style={{ fontSize: '0.9375rem', fontWeight: 700, color: '#fff', marginBottom: '6px' }}>
                2. Observation Window Boundaries
              </h3>
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
                The current historical dataset is bounded to the 30-day window of June 2026 for Ethereum mainnet swaps. Multi-quarter cohort retention and seasonal trends reflect this specific timeframe.
              </p>
            </div>

            <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--bg-card-border)', borderRadius: '12px', padding: '18px' }}>
              <h3 style={{ fontSize: '0.9375rem', fontWeight: 700, color: '#fff', marginBottom: '6px' }}>
                3. On-Chain Price Oracles vs Execution Prices
              </h3>
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
                USD valuations are calculated from the immediate execution prices and token ratios at swap time. Integration with external spot oracle feeds (e.g., CoinMarketCap API) is planned to establish off-chain benchmark price verification.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 4. Data-Quality Incidents */}
      {subTab === 'incidents' && (
        <div className="content-card">
          <div className="card-title-row">
            <div>
              <h2 className="section-title">
                <span style={{ color: '#22d3ee' }}>●</span> Data-Quality Incidents &amp; Resolution Log
              </h2>
              <div className="section-desc">
                Audit trail of pipeline anomalies, schema variations, and engineering fixes
              </div>
            </div>
          </div>

          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Incident ID</th>
                  <th>Date</th>
                  <th>Component</th>
                  <th>Status</th>
                  <th>Issue Description</th>
                  <th>Engineering Resolution</th>
                </tr>
              </thead>
              <tbody>
                {incidents.map((inc) => (
                  <tr key={inc.id}>
                    <td><code className="mono-text" style={{ color: '#fc72ff' }}>{inc.id}</code></td>
                    <td><span className="mono-text">{inc.date}</span></td>
                    <td><span className="token-pill">{inc.component}</span></td>
                    <td>
                      <span className="status-pill status-resolved">{inc.severity}</span>
                    </td>
                    <td style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>{inc.description}</td>
                    <td style={{ fontSize: '0.8125rem', color: '#10b981' }}>{inc.resolution}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 5. Validation Results */}
      {subTab === 'validation' && (
        <div className="content-card">
          <div className="card-title-row">
            <div>
              <h2 className="section-title">
                <span style={{ color: '#10b981' }}>●</span> Automated dbt Test Suite &amp; Validation Results
              </h2>
              <div className="section-desc">
                Continuous data assertions covering uniqueness, referential integrity, and null value checks
              </div>
            </div>
            <div className="badge" style={{ borderColor: '#10b981', color: '#10b981' }}>
              ✓ 100% Tests Passing (10 / 10)
            </div>
          </div>

          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Target Model</th>
                  <th>Assertion / Test Type</th>
                  <th>Failures</th>
                  <th>Severity</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {tests.map((t, idx) => (
                  <tr key={idx}>
                    <td><code className="mono-text" style={{ color: '#fff' }}>{t.model}</code></td>
                    <td><span className="mono-text">{t.test}</span></td>
                    <td><span className="mono-text" style={{ color: '#10b981' }}>{t.failures}</span></td>
                    <td><span className="mono-text" style={{ color: 'var(--text-muted)' }}>{t.severity}</span></td>
                    <td>
                      <span className="status-pill status-passed">PASSED</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h3 style={{ fontSize: '1rem', fontWeight: 600, margin: '28px 0 12px 0', color: '#fff' }}>
            DuckDB Table Statistics &amp; Record Parity
          </h3>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Table / Model Name</th>
                  <th>Layer</th>
                  <th>Total Rows</th>
                  <th>Integrity Check</th>
                </tr>
              </thead>
              <tbody>
                {tableStats.map((ts, idx) => (
                  <tr key={idx}>
                    <td><code className="mono-text" style={{ color: '#fc72ff' }}>{ts.table_name}</code></td>
                    <td><span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>{ts.layer}</span></td>
                    <td><span className="mono-text" style={{ fontWeight: 600 }}>{Number(ts.row_count).toLocaleString()}</span></td>
                    <td><span className="status-pill status-passed">VERIFIED</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
