'use client';

import React, { useState } from 'react';

export interface OverviewData {
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
  total_unique_wallets: number;
}

export interface DailyMetric {
  date_str: string;
  block_date: string;
  trading_volume: number;
  tx_count: number;
  active_traders: number;
  fees: number;
  lp_fees: number;
  protocol_revenue: number;
  take_rate: number;
  avg_trade_size_usd: number;
  volume_per_active_trader: number;
}

export interface PoolMetric {
  pool_name: string;
  fee_tier: number;
  pool_address: string;
  base_token: string;
  quote_token: string;
  total_volume_usd: number;
  total_transactions: number;
  unique_traders: number;
  total_fees_usd: number;
  lp_fees_usd: number;
  protocol_revenue_usd: number;
  effective_take_rate: number;
  avg_trade_size_usd: number;
}

interface OverviewTabProps {
  overview: OverviewData;
  daily: DailyMetric[];
  pools: PoolMetric[];
}

export default function OverviewTab({ overview, daily, pools }: OverviewTabProps) {
  const [hoveredDay, setHoveredDay] = useState<DailyMetric | null>(null);

  // Formatting helpers
  const formatUSD = (val: number, compact = true) => {
    if (val === undefined || val === null) return '$0.00';
    if (compact) {
      if (val >= 1e9) return `$${(val / 1e9).toFixed(2)}B`;
      if (val >= 1e6) return `$${(val / 1e6).toFixed(2)}M`;
      if (val >= 1e3) return `$${(val / 1e3).toFixed(2)}K`;
    }
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);
  };

  const formatNumber = (val: number) => {
    return new Intl.NumberFormat('en-US').format(val || 0);
  };

  const maxVolume = Math.max(...daily.map((d) => d.trading_volume), 1);
  const maxFees = Math.max(...daily.map((d) => d.fees), 1);

  // Chart dimensions
  const chartHeight = 220;
  const barWidthPercent = 100 / (daily.length || 1);

  const topPools = pools.slice(0, 5);
  const totalTopVolume = pools.reduce((acc, p) => acc + (p.total_volume_usd || 0), 0) || 1;

  return (
    <div>
      {/* KPI Stat Cards */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-title">30-Day Trading Volume</span>
            <span className="kpi-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>
              </svg>
            </span>
          </div>
          <div className="kpi-value">{formatUSD(overview.total_volume_usd)}</div>
          <div className="kpi-subtext">Across {overview.active_days} active trading days in June 2026</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-title">Gross Trading Fees</span>
            <span className="kpi-icon" style={{ color: '#fc72ff' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
              </svg>
            </span>
          </div>
          <div className="kpi-value" style={{ color: '#fc72ff' }}>
            {formatUSD(overview.total_fees_usd)}
          </div>
          <div className="kpi-subtext">Paid by traders across all fee tiers</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-title">Protocol Revenue</span>
            <span className="kpi-icon" style={{ color: '#22d3ee' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
              </svg>
            </span>
          </div>
          <div className="kpi-value" style={{ color: '#22d3ee' }}>
            {formatUSD(overview.total_protocol_revenue_usd)}
          </div>
          <div className="kpi-subtext">Modeled treasury capture (1/4th &amp; 1/6th cuts)</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-title">Liquidity Provider Fees</span>
            <span className="kpi-icon" style={{ color: '#10b981' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
              </svg>
            </span>
          </div>
          <div className="kpi-value" style={{ color: '#10b981' }}>
            {formatUSD(overview.total_lp_fees_usd)}
          </div>
          <div className="kpi-subtext">Distributed to active in-range LPs</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-title">Overall Take Rate</span>
            <span className="kpi-icon" style={{ color: '#f59e0b' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/><path d="M16 8l-8 8M9 9h.01M15 15h.01"/>
              </svg>
            </span>
          </div>
          <div className="kpi-value" style={{ color: '#f59e0b' }}>
            {((overview.avg_take_rate || 0) * 100).toFixed(4)}%
          </div>
          <div className="kpi-subtext">{((overview.avg_take_rate || 0) * 10000).toFixed(1)} bps capture yield</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-title">Swap Transactions</span>
            <span className="kpi-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
              </svg>
            </span>
          </div>
          <div className="kpi-value">{formatNumber(overview.total_transactions)}</div>
          <div className="kpi-subtext">Across {formatNumber(overview.total_unique_wallets)} unique wallets</div>
        </div>
      </div>

      {/* Main Charts Row */}
      <div className="chart-grid-2">
        {/* Daily Volume & Fee Interactive Chart */}
        <div className="content-card">
          <div className="card-title-row">
            <div>
              <h2 className="section-title">
                <span style={{ color: '#ff007a' }}>●</span> Daily Trading Volume &amp; Fee Trajectory
              </h2>
              <div className="section-desc">
                Dual-axis representation of daily notional volume ($ bars) and total swap fees ($ line)
              </div>
            </div>
            {hoveredDay ? (
              <div className="badge" style={{ borderColor: '#ff007a', color: '#fff' }}>
                {hoveredDay.date_str}: {formatUSD(hoveredDay.trading_volume)} Vol | {formatUSD(hoveredDay.fees)} Fees
              </div>
            ) : (
              <div className="badge">Hover bars for daily details</div>
            )}
          </div>

          {/* SVG Chart Container */}
          <div style={{ position: 'relative', width: '100%', height: `${chartHeight + 40}px` }}>
            <svg width="100%" height={chartHeight} style={{ overflow: 'visible' }}>
              <defs>
                <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#ff007a" stopOpacity="0.85"/>
                  <stop offset="100%" stopColor="#7928ca" stopOpacity="0.2"/>
                </linearGradient>
                <linearGradient id="barGradientHover" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#fc72ff" stopOpacity="1"/>
                  <stop offset="100%" stopColor="#ff007a" stopOpacity="0.6"/>
                </linearGradient>
              </defs>

              {/* Grid Lines */}
              <line x1="0" y1="0" x2="100%" y2="0" stroke="rgba(255,255,255,0.06)" strokeDasharray="4"/>
              <line x1="0" y1={chartHeight / 2} x2="100%" y2={chartHeight / 2} stroke="rgba(255,255,255,0.06)" strokeDasharray="4"/>
              <line x1="0" y1={chartHeight} x2="100%" y2={chartHeight} stroke="rgba(255,255,255,0.1)"/>

              {/* Volume Bars */}
              {daily.map((d, i) => {
                const height = (d.trading_volume / maxVolume) * (chartHeight - 20);
                const isHovered = hoveredDay?.date_str === d.date_str;
                const xPercent = (i / daily.length) * 100;
                const widthPercent = (1 / daily.length) * 100 * 0.75;

                return (
                  <rect
                    key={d.date_str}
                    x={`${xPercent + 0.5}%`}
                    y={chartHeight - height}
                    width={`${Math.max(widthPercent, 1.5)}%`}
                    height={Math.max(height, 2)}
                    rx="3"
                    fill={isHovered ? 'url(#barGradientHover)' : 'url(#barGradient)'}
                    style={{ cursor: 'pointer', transition: 'all 0.15s ease' }}
                    onMouseEnter={() => setHoveredDay(d)}
                    onMouseLeave={() => setHoveredDay(null)}
                  />
                );
              })}

              {/* Fee Overlay Line */}
              {daily.length > 1 && (
                <polyline
                  fill="none"
                  stroke="#22d3ee"
                  strokeWidth="2.5"
                  points={daily
                    .map((d, i) => {
                      const x = ((i + 0.5) / daily.length) * 100;
                      const y = chartHeight - (d.fees / maxFees) * (chartHeight - 30);
                      return `${x}%,${y}`;
                    })
                    .join(' ')}
                />
              )}
            </svg>

            {/* X-Axis Date Labels */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '10px' }}>
              <span className="mono-text" style={{ color: 'var(--text-muted)' }}>{daily[0]?.date_str}</span>
              <span className="mono-text" style={{ color: 'var(--text-muted)' }}>{daily[Math.floor(daily.length / 2)]?.date_str}</span>
              <span className="mono-text" style={{ color: 'var(--text-muted)' }}>{daily[daily.length - 1]?.date_str}</span>
            </div>
          </div>
        </div>

        {/* Top 5 Pools Share Card */}
        <div className="content-card">
          <div className="card-title-row">
            <div>
              <h2 className="section-title">
                <span style={{ color: '#fc72ff' }}>●</span> Pool Volume Share
              </h2>
              <div className="section-desc">Dominance breakdown of primary trading pairs</div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '8px' }}>
            {topPools.map((p) => {
              const share = ((p.total_volume_usd / totalTopVolume) * 100).toFixed(1);
              return (
                <div key={p.pool_address} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span className="token-pill">{p.pool_name}</span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {(p.fee_tier / 10000).toFixed(2)}% fee
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span className="mono-text" style={{ fontWeight: 600 }}>{formatUSD(p.total_volume_usd)}</span>
                      <span className="mono-text" style={{ color: 'var(--accent-pink)', fontSize: '0.75rem' }}>{share}%</span>
                    </div>
                  </div>
                  {/* Progress bar */}
                  <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.06)', borderRadius: '3px', overflow: 'hidden' }}>
                    <div
                      style={{
                        width: `${share}%`,
                        height: '100%',
                        background: 'linear-gradient(90deg, #ff007a, #fc72ff)',
                        borderRadius: '3px',
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Protocol Economics Breakdown */}
      <div className="content-card">
        <div className="card-title-row">
          <div>
            <h2 className="section-title">
              <span style={{ color: '#10b981' }}>●</span> Fee Economics: LP vs Protocol Treasury Split
            </h2>
            <div className="section-desc">
              Modeling cumulative liquidity provider compensation vs. protocol governance fee switch capture
            </div>
          </div>
          <div style={{ display: 'flex', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{ width: '12px', height: '12px', borderRadius: '3px', background: '#10b981' }}/>
              <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>LP Earnings ({formatUSD(overview.total_lp_fees_usd)})</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{ width: '12px', height: '12px', borderRadius: '3px', background: '#22d3ee' }}/>
              <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>Protocol Treasury ({formatUSD(overview.total_protocol_revenue_usd)})</span>
            </div>
          </div>
        </div>

        {/* Stacked Distribution Bar */}
        <div style={{ width: '100%', height: '24px', background: 'rgba(255,255,255,0.06)', borderRadius: '8px', overflow: 'hidden', display: 'flex', margin: '14px 0 20px 0' }}>
          <div
            style={{
              width: `${(overview.total_lp_fees_usd / (overview.total_fees_usd || 1)) * 100}%`,
              background: 'linear-gradient(90deg, #059669, #10b981)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.75rem',
              fontWeight: 700,
              color: '#fff',
            }}
          >
            {((overview.total_lp_fees_usd / (overview.total_fees_usd || 1)) * 100).toFixed(1)}% LP Share
          </div>
          <div
            style={{
              width: `${(overview.total_protocol_revenue_usd / (overview.total_fees_usd || 1)) * 100}%`,
              background: 'linear-gradient(90deg, #0891b2, #22d3ee)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.75rem',
              fontWeight: 700,
              color: '#fff',
            }}
          >
            {((overview.total_protocol_revenue_usd / (overview.total_fees_usd || 1)) * 100).toFixed(1)}% Protocol
          </div>
        </div>

        <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', lineHeight: '1.6' }}>
          *Uniswap V3 allows DAO governance to enable a protocol fee switch per pool (redirecting between 10% to 25% of trading fees to the treasury).
          In this engine, fee splits are deterministically modeled via <code className="mono-text" style={{ color: '#fc72ff' }}>int_uniswap_fees</code> to track theoretical and historical treasury yields.
        </p>
      </div>
    </div>
  );
}
