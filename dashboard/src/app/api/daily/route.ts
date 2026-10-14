import { NextResponse } from 'next/server';
import { getDailyProtocolMetrics } from '@/lib/duckdb';

export async function GET() {
  try {
    const data = await getDailyProtocolMetrics();
    return NextResponse.json({ success: true, count: data.length, data });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
