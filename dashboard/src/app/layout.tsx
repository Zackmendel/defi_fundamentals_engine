import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'DeFi Fundamentals Engine | Uniswap V3 Analytics',
  description: 'Institutional-grade on-chain analytics, volume, fees, and data lineage powered by DuckDB and dbt.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body>{children}</body>
    </html>
  );
}
