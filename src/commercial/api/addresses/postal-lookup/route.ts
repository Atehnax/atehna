import { NextResponse } from 'next/server';
import { getAddressSearchCacheControl } from '@/commercial/api/addresses/search/cachePolicy';
import {
  GursPostalLookupQueryError,
  lookupGursPostalLocations
} from '@/shared/server/gursAddresses';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const searchParams = new URL(request.url).searchParams;
  const field = searchParams.get('field');
  const query = searchParams.get('query') ?? '';

  try {
    const response = await lookupGursPostalLocations(field, query);
    return NextResponse.json(response, {
      headers: {
        'Cache-Control': getAddressSearchCacheControl(response)
      }
    });
  } catch (error) {
    if (error instanceof GursPostalLookupQueryError) {
      return NextResponse.json(
        { message: error.message, code: error.code },
        {
          status: 400,
          headers: { 'Cache-Control': 'no-store' }
        }
      );
    }

    console.error('GURS postal-location lookup failed.', error);
    return NextResponse.json(
      { message: 'Iskanje poštnega kraja trenutno ni na voljo.' },
      {
        status: 503,
        headers: { 'Cache-Control': 'no-store' }
      }
    );
  }
}
