import { NextResponse } from 'next/server';
import { getSiteNavigationConfig } from '@/shared/server/siteNavigation';

export const dynamic = 'force-dynamic';

export async function GET() {
  const config = await getSiteNavigationConfig();

  return NextResponse.json(
    { config },
    {
      headers: {
        'Cache-Control': 'no-store'
      }
    }
  );
}
