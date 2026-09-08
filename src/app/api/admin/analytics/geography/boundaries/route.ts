import { withAdminRoute } from '@/shared/auth/adminRoute';

import { NextResponse } from 'next/server';
import { getReportingGeography, getBundledGeography } from '@/shared/server/geographyAnalytics';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
async function handleAdminGET() {
  try {
    const { reference } = await getReportingGeography();
    return NextResponse.json(reference, { headers: { 'Cache-Control': 'private, max-age=3600', ETag: '"' + reference.metadata.version + '"' } });
  } catch {
    return NextResponse.json(await getBundledGeography(), { headers: { 'Cache-Control': 'private, max-age=3600' } });
  }
}

export const GET = withAdminRoute(handleAdminGET);
