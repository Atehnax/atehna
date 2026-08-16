import { NextResponse } from 'next/server';
import {
  GursAddressSearchQueryError,
  searchGursAddresses
} from '@/shared/server/gursAddresses';

const PUBLIC_SEARCH_CACHE =
  'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get('query') ?? '';

  try {
    const response = await searchGursAddresses(query);
    return NextResponse.json(response, {
      headers: { 'Cache-Control': PUBLIC_SEARCH_CACHE }
    });
  } catch (error) {
    if (error instanceof GursAddressSearchQueryError) {
      return NextResponse.json(
        { message: error.message },
        {
          status: 400,
          headers: { 'Cache-Control': 'no-store' }
        }
      );
    }

    console.error('GURS address search failed.', error);
    return NextResponse.json(
      { message: 'Iskanje naslovov trenutno ni na voljo.' },
      {
        status: 503,
        headers: { 'Cache-Control': 'no-store' }
      }
    );
  }
}
