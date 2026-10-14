import { NextResponse } from 'next/server';
import { getProtocolOverview } from '@/lib/duckdb';

export async function GET() {
  try {
    const data = await getProtocolOverview();
    return NextResponse.json({ success: true, data });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
