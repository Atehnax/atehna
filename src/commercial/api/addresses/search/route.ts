import { NextResponse } from 'next/server';
import { getAddressSearchCacheControl } from '@/commercial/api/addresses/search/cachePolicy';
import {
  GursAddressSearchQueryError,
  searchGursAddresses
} from '@/shared/server/gursAddresses';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get('query') ?? '';

  try {
    const response = await searchGursAddresses(query);
    return NextResponse.json(response, {
      headers: {
        'Cache-Control': getAddressSearchCacheControl(response)
      }
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
