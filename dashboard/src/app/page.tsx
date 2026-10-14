'use client';

import React, { useState, useEffect } from 'react';
import Header from '@/components/Header';
import OverviewTab, { OverviewData, DailyMetric, PoolMetric } from '@/components/OverviewTab';
import MetricsTab from '@/components/MetricsTab';
import MethodologyTab from '@/components/MethodologyTab';

interface QualityData {
  tables: Array<{ table_name: string; layer: string; row_count: number }>;
  tests: Array<{ model: string; test: string; status: string; failures: number; severity: string }>;
  incidents: Array<{ id: string; date: string; severity: string; component: string; description: string; resolution: string }>;
}

export default function DashboardHome() {
  const [activeTab, setActiveTab] = useState<'overview' | 'metrics' | 'methodology'>('overview');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [daily, setDaily] = useState<DailyMetric[]>([]);
  const [pools, setPools] = useState<PoolMetric[]>([]);
  const [qualityData, setQualityData] = useState<QualityData | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        setError(null);

        const [ovRes, dailyRes, poolsRes, qualRes] = await Promise.all([
          fetch('/api/overview'),
          fetch('/api/daily'),
          fetch('/api/pools'),
          fetch('/api/quality'),
        ]);

        const [ovJson, dailyJson, poolsJson, qualJson] = await Promise.all([
          ovRes.json(),
          dailyRes.json(),
          poolsRes.json(),
          qualRes.json(),
        ]);

        if (!ovJson.success) throw new Error(ovJson.error || 'Failed to fetch overview metrics');
        if (!dailyJson.success) throw new Error(dailyJson.error || 'Failed to fetch daily metrics');
        if (!poolsJson.success) throw new Error(poolsJson.error || 'Failed to fetch pool metrics');

        setOverview(ovJson.data);
        setDaily(dailyJson.data || []);
        setPools(poolsJson.data || []);
        setQualityData(qualJson.data || null);
      } catch (err: unknown) {
        console.error('Error fetching dashboard data:', err);
        setError(err instanceof Error ? err.message : 'Unknown database error');
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  return (
    <div>
      <Header activeTab={activeTab} setActiveTab={setActiveTab} />

      <main className="main-container">
        {loading && (
          <div style={{ textAlign: 'center', padding: '100px 0' }}>
            <div
              style={{
                width: '48px',
                height: '48px',
                border: '3px solid rgba(255, 0, 122, 0.2)',
                borderTopColor: '#ff007a',
                borderRadius: '50%',
                margin: '0 auto 20px auto',
                animation: 'spin 1s linear infinite',
              }}
            />
            <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: '#fff', marginBottom: '8px' }}>
              Querying DuckDB Analytics Engine...
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
              Reading transformed dimensional marts from <code className="mono-text">metrics.daily_protocol_metrics</code>
            </p>
            <style jsx>{`
              @keyframes spin {
                to { transform: rotate(360deg); }
              }
            `}</style>
          </div>
        )}

        {error && (
          <div
            style={{
              background: 'rgba(244, 63, 94, 0.1)',
              border: '1px solid rgba(244, 63, 94, 0.3)',
              borderRadius: '12px',
              padding: '24px',
              textAlign: 'center',
              margin: '40px auto',
              maxWidth: '600px',
            }}
          >
            <h3 style={{ color: '#f43f5e', fontSize: '1.125rem', fontWeight: 700, marginBottom: '8px' }}>
              Unable to Load Metrics from DuckDB
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '16px' }}>
              {error}
            </p>
            <button
              onClick={() => window.location.reload()}
              style={{
                background: '#ff007a',
                color: '#fff',
                border: 'none',
                padding: '8px 20px',
                borderRadius: '8px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Retry Connection
            </button>
          </div>
        )}

        {!loading && !error && overview && (
          <>
            {activeTab === 'overview' && (
              <OverviewTab overview={overview} daily={daily} pools={pools} />
            )}

            {activeTab === 'metrics' && (
              <MetricsTab daily={daily} pools={pools} />
            )}

            {activeTab === 'methodology' && (
              <MethodologyTab
                tableStats={qualityData?.tables}
                tests={qualityData?.tests}
                incidents={qualityData?.incidents}
              />
            )}
          </>
        )}
      </main>

      {/* Footer */}
      <footer style={{ borderTop: '1px solid var(--bg-card-border)', padding: '28px 24px', textAlign: 'center' }}>
        <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
          DeFi Fundamentals Engine • Powered by DuckDB &amp; dbt • Designed with Uniswap V3 Aesthetics
        </p>
      </footer>
    </div>
  );
}
