'use client';

import React from 'react';

interface HeaderProps {
  activeTab: 'overview' | 'metrics' | 'methodology';
  setActiveTab: (tab: 'overview' | 'metrics' | 'methodology') => void;
  activeSubTab?: string;
  isSnapshot?: boolean;
}

export default function Header({ activeTab, setActiveTab }: HeaderProps) {
  return (
    <header className="header-container">
      <div className="header-content">
        <div className="logo-section">
          <div className="logo-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M2 17L12 22L22 17" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M2 12L12 17L22 12" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div>
            <h1 className="logo-title">DeFi Fundamentals Engine</h1>
            <div className="logo-subtitle">Uniswap V3 • Ethereum Mainnet (June 2026)</div>
          </div>
        </div>

        <nav className="tabs-bar">
          <button
            className={`tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveTab('overview')}
            id="tab-overview"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="7" height="9" rx="1"/>
              <rect x="14" y="3" width="7" height="5" rx="1"/>
              <rect x="14" y="12" width="7" height="9" rx="1"/>
              <rect x="3" y="16" width="7" height="5" rx="1"/>
            </svg>
            Overview
          </button>

          <button
            className={`tab-btn ${activeTab === 'metrics' ? 'active' : ''}`}
            onClick={() => setActiveTab('metrics')}
            id="tab-metrics"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="20" x2="18" y2="10"/>
              <line x1="12" y1="20" x2="12" y2="4"/>
              <line x1="6" y1="20" x2="6" y2="14"/>
            </svg>
            Metrics
          </button>

          <button
            className={`tab-btn ${activeTab === 'methodology' ? 'active' : ''}`}
            onClick={() => setActiveTab('methodology')}
            id="tab-methodology"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="16" y1="13" x2="8" y2="13"/>
              <line x1="16" y1="17" x2="8" y2="17"/>
              <polyline points="10 9 9 9 8 9"/>
            </svg>
            Methodology & Data Quality
          </button>
        </nav>

        <div className="header-badges">
          <div className="badge">
            <span className="badge-pulse"></span>
            DuckDB Engine Connected
          </div>
          <div className="badge" style={{ borderColor: 'rgba(255, 0, 122, 0.3)', color: '#fc72ff' }}>
            dbt v1.11+
          </div>
        </div>
      </div>
    </header>
  );
}
