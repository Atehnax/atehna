import { NextResponse } from 'next/server';
import { getReportingGeography, getBundledGeography } from '@/shared/server/geographyAnalytics';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET() {
  try {
    const { reference } = await getReportingGeography();
    return NextResponse.json(reference, { headers: { 'Cache-Control': 'private, max-age=3600', ETag: '"' + reference.metadata.version + '"' } });
  } catch {
    return NextResponse.json(await getBundledGeography(), { headers: { 'Cache-Control': 'private, max-age=3600' } });
  }
}
