'use client';

import React, { useState, useMemo } from 'react';
import { DailyMetric, PoolMetric } from './OverviewTab';

interface MetricsTabProps {
  daily: DailyMetric[];
  pools: PoolMetric[];
}

type MetricKey = 'trading_volume' | 'fees' | 'take_rate' | 'active_traders' | 'avg_trade_size_usd';

export default function MetricsTab({ daily, pools }: MetricsTabProps) {
  const [selectedMetric, setSelectedMetric] = useState<MetricKey>('trading_volume');
  const [searchQuery, setSearchQuery] = useState('');
  const [hoveredPoint, setHoveredPoint] = useState<DailyMetric | null>(null);

  const formatUSD = (val: number) => {
    if (val >= 1e9) return `$${(val / 1e9).toFixed(2)}B`;
    if (val >= 1e6) return `$${(val / 1e6).toFixed(2)}M`;
    if (val >= 1e3) return `$${(val / 1e3).toFixed(2)}K`;
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val || 0);
  };

  const metricConfigs: Record<
    MetricKey,
    { label: string; color: string; format: (v: number) => string; desc: string }
  > = {
    trading_volume: {
      label: 'Trading Volume ($)',
      color: '#ff007a',
      format: (v) => formatUSD(v),
      desc: 'Gross daily notional trading volume across all Ethereum Uniswap V3 pools',
    },
    fees: {
      label: 'Gross Fees ($)',
      color: '#fc72ff',
      format: (v) => formatUSD(v),
      desc: 'Total liquidity provider fees and protocol cuts paid by traders',
    },
    take_rate: {
      label: 'Take Rate (bps)',
      color: '#f59e0b',
      format: (v) => `${((v || 0) * 10000).toFixed(1)} bps (${((v || 0) * 100).toFixed(4)}%)`,
      desc: 'Effective fee capture percentage per dollar of executed volume',
    },
    active_traders: {
      label: 'Active Traders',
      color: '#22d3ee',
      format: (v) => new Intl.NumberFormat('en-US').format(v || 0),
      desc: 'Unique wallet addresses initiating swap transactions on each day',
    },
    avg_trade_size_usd: {
      label: 'Avg Trade Size ($)',
      color: '#10b981',
      format: (v) => formatUSD(v),
      desc: 'Average notional trade size executed per unique transaction',
    },
  };

  const config = metricConfigs[selectedMetric];

  // Dynamic Chart Range
  const values = daily.map((d) => d[selectedMetric] as number);
  const maxValue = Math.max(...values, 1);
  const minValue = Math.min(...values, 0);
  const chartHeight = 240;

  // Filtered Pools
  const filteredPools = useMemo(() => {
    if (!searchQuery.trim()) return pools;
    const q = searchQuery.toLowerCase();
    return pools.filter(
      (p) =>
        p.pool_name.toLowerCase().includes(q) ||
        p.pool_address.toLowerCase().includes(q) ||
        p.base_token.toLowerCase().includes(q) ||
        p.quote_token.toLowerCase().includes(q)
    );
  }, [pools, searchQuery]);

  return (
    <div>
      {/* Metric Selector Buttons */}
      <div className="content-card" style={{ padding: '16px 20px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
            Select Time-Series Metric:
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {(Object.keys(metricConfigs) as MetricKey[]).map((key) => {
              const active = selectedMetric === key;
              return (
                <button
                  key={key}
                  onClick={() => setSelectedMetric(key)}
                  style={{
                    background: active ? 'rgba(255, 0, 122, 0.2)' : 'rgba(255, 255, 255, 0.04)',
                    color: active ? '#fc72ff' : 'var(--text-secondary)',
                    border: `1px solid ${active ? 'rgba(255, 0, 122, 0.4)' : 'rgba(255, 255, 255, 0.08)'}`,
                    padding: '6px 14px',
                    borderRadius: '8px',
                    fontSize: '0.8125rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {metricConfigs[key].label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main Interactive Chart */}
      <div className="content-card">
        <div className="card-title-row">
          <div>
            <h2 className="section-title">
              <span style={{ color: config.color }}>●</span> {config.label} Trend
            </h2>
            <div className="section-desc">{config.desc}</div>
          </div>
          {hoveredPoint ? (
            <div className="badge" style={{ borderColor: config.color, color: '#fff' }}>
              {hoveredPoint.date_str}: {config.format(hoveredPoint[selectedMetric] as number)}
            </div>
          ) : (
            <div className="badge">Hover curve for day coordinates</div>
          )}
        </div>

        {/* SVG Area / Line Chart */}
        <div style={{ position: 'relative', width: '100%', height: `${chartHeight + 40}px` }}>
          <svg width="100%" height={chartHeight} style={{ overflow: 'visible' }}>
            <defs>
              <linearGradient id="metricAreaGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={config.color} stopOpacity="0.4"/>
                <stop offset="100%" stopColor={config.color} stopOpacity="0.0"/>
              </linearGradient>
            </defs>

            {/* Grid Lines */}
            <line x1="0" y1="0" x2="100%" y2="0" stroke="rgba(255,255,255,0.06)" strokeDasharray="4"/>
            <line x1="0" y1={chartHeight / 2} x2="100%" y2={chartHeight / 2} stroke="rgba(255,255,255,0.06)" strokeDasharray="4"/>
            <line x1="0" y1={chartHeight} x2="100%" y2={chartHeight} stroke="rgba(255,255,255,0.1)"/>

            {/* Filled Polygon Area */}
            {daily.length > 1 && (
              <polygon
                fill="url(#metricAreaGradient)"
                points={`
                  0,${chartHeight} 
                  ${daily
                    .map((d, i) => {
                      const x = (i / (daily.length - 1)) * 100;
                      const val = d[selectedMetric] as number;
                      const y = chartHeight - ((val - minValue) / (maxValue - minValue || 1)) * (chartHeight - 30);
                      return `${x}%,${y}`;
                    })
                    .join(' ')} 
                  100%,${chartHeight}
                `}
              />
            )}

            {/* Trend Polyline */}
            {daily.length > 1 && (
              <polyline
                fill="none"
                stroke={config.color}
                strokeWidth="2.5"
                points={daily
                  .map((d, i) => {
                    const x = (i / (daily.length - 1)) * 100;
                    const val = d[selectedMetric] as number;
                    const y = chartHeight - ((val - minValue) / (maxValue - minValue || 1)) * (chartHeight - 30);
                    return `${x}%,${y}`;
                  })
                  .join(' ')}
              />
            )}

            {/* Hover Circles */}
            {daily.map((d, i) => {
              const xPercent = (i / (daily.length - 1)) * 100;
              const val = d[selectedMetric] as number;
              const y = chartHeight - ((val - minValue) / (maxValue - minValue || 1)) * (chartHeight - 30);
              const isHovered = hoveredPoint?.date_str === d.date_str;

              return (
                <g key={d.date_str}>
                  <circle
                    cx={`${xPercent}%`}
                    cy={y}
                    r={isHovered ? 6 : 3.5}
                    fill={isHovered ? '#fff' : config.color}
                    stroke={config.color}
                    strokeWidth="2"
                    style={{ cursor: 'pointer', transition: 'all 0.15s ease' }}
                    onMouseEnter={() => setHoveredPoint(d)}
                    onMouseLeave={() => setHoveredPoint(null)}
                  />
                  {/* Invisible wider hover hit target */}
                  <rect
                    x={`${xPercent - 1.5}%`}
                    y="0"
                    width="3%"
                    height={chartHeight}
                    fill="transparent"
                    style={{ cursor: 'pointer' }}
                    onMouseEnter={() => setHoveredPoint(d)}
                    onMouseLeave={() => setHoveredPoint(null)}
                  />
                </g>
              );
            })}
          </svg>

          {/* Date Axis */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '10px' }}>
            <span className="mono-text" style={{ color: 'var(--text-muted)' }}>{daily[0]?.date_str}</span>
            <span className="mono-text" style={{ color: 'var(--text-muted)' }}>{daily[Math.floor(daily.length / 2)]?.date_str}</span>
            <span className="mono-text" style={{ color: 'var(--text-muted)' }}>{daily[daily.length - 1]?.date_str}</span>
          </div>
        </div>
      </div>

      {/* Pool Performance Matrix */}
      <div className="content-card">
        <div className="card-title-row">
          <div>
            <h2 className="section-title">
              <span style={{ color: '#fc72ff' }}>●</span> Uniswap V3 Pool Performance Matrix
            </h2>
            <div className="section-desc">
              Granular breakdown of trading volume, fees, LP share, and transaction frequency per liquidity pool
            </div>
          </div>
          {/* Search Bar */}
          <div>
            <input
              type="text"
              placeholder="Search pools (e.g. WBTC, WETH)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                background: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid var(--bg-card-border)',
                borderRadius: '8px',
                padding: '8px 14px',
                color: '#fff',
                fontSize: '0.8125rem',
                outline: 'none',
                minWidth: '240px',
              }}
            />
          </div>
        </div>

        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Liquidity Pool</th>
                <th>Fee Tier</th>
                <th>Trading Volume</th>
                <th>Gross Fees</th>
                <th>LP Share</th>
                <th>Protocol Revenue</th>
                <th>Take Rate</th>
                <th>Transactions</th>
                <th>Active Traders</th>
                <th>Contract Address</th>
              </tr>
            </thead>
            <tbody>
              {filteredPools.map((pool) => {
                const feePercent = (pool.fee_tier / 10000).toFixed(2);
                return (
                  <tr key={pool.pool_address}>
                    <td>
                      <span className="token-pill">{pool.pool_name}</span>
                    </td>
                    <td>
                      <span className="mono-text" style={{ color: 'var(--text-secondary)' }}>
                        {feePercent}%
                      </span>
                    </td>
                    <td>
                      <span className="mono-text" style={{ fontWeight: 600, color: '#fff' }}>
                        {formatUSD(pool.total_volume_usd)}
                      </span>
                    </td>
                    <td>
                      <span className="mono-text" style={{ color: '#fc72ff' }}>
                        {formatUSD(pool.total_fees_usd)}
                      </span>
                    </td>
                    <td>
                      <span className="mono-text" style={{ color: '#10b981' }}>
                        {formatUSD(pool.lp_fees_usd)}
                      </span>
                    </td>
                    <td>
                      <span className="mono-text" style={{ color: '#22d3ee' }}>
                        {formatUSD(pool.protocol_revenue_usd)}
                      </span>
                    </td>
                    <td>
                      <span className="mono-text" style={{ color: '#f59e0b' }}>
                        {((pool.effective_take_rate || 0) * 10000).toFixed(1)} bps
                      </span>
                    </td>
                    <td>
                      <span className="mono-text">
                        {new Intl.NumberFormat('en-US').format(pool.total_transactions)}
                      </span>
                    </td>
                    <td>
                      <span className="mono-text">
                        {new Intl.NumberFormat('en-US').format(pool.unique_traders)}
                      </span>
                    </td>
                    <td>
                      <a
                        href={`https://etherscan.io/address/${pool.pool_address}`}
                        target="_blank"
                        rel="noreferrer"
                        className="mono-text"
                        style={{ color: 'var(--text-muted)', textDecoration: 'none' }}
                        title={pool.pool_address}
                      >
                        {pool.pool_address.substring(0, 6)}...{pool.pool_address.substring(38)}
                      </a>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
