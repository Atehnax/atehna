import { NextResponse } from 'next/server';
import { getCatalogSearchItemsServer } from '@/commercial/catalog/catalogServer';

export async function GET() {
  const items = await getCatalogSearchItemsServer();

  return NextResponse.json(
    { items },
    {
      headers: {
        'Cache-Control': 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400'
      }
    }
  );
}
