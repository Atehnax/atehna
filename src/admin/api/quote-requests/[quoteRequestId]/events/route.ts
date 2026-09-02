import { NextResponse } from 'next/server';
import { hasValidQuoteAdminSession, positiveInteger } from '@/admin/api/quote-requests/quoteAdminRouteUtils';
import { isDatabaseUnavailableError } from '@/shared/server/db';
import { isQuoteAdminEnabled } from '@/shared/server/quoteFeatureFlags';
import { fetchAdminQuoteEvents } from '@/shared/server/quotes';

export const dynamic = 'force-dynamic';

const noStoreHeaders = { 'Cache-Control': 'private, no-store' } as const;

export async function GET(
  request: Request,
  props: { params: Promise<{ quoteRequestId: string }> }
) {
  if (!isQuoteAdminEnabled()) {
    return NextResponse.json(
      { message: 'Ponudbe niso omogočene.' },
      { status: 404, headers: noStoreHeaders }
    );
  }
  if (!hasValidQuoteAdminSession(request)) {
    return NextResponse.json(
      { message: 'Za dostop je potrebna prijava.' },
      { status: 401, headers: noStoreHeaders }
    );
  }

  const { quoteRequestId: rawQuoteRequestId } = await props.params;
  const quoteRequestId = positiveInteger(rawQuoteRequestId);
  if (!quoteRequestId) {
    return NextResponse.json(
      { message: 'Neveljaven ID povpraševanja.' },
      { status: 400, headers: noStoreHeaders }
    );
  }

  try {
    const events = await fetchAdminQuoteEvents(quoteRequestId);
    if (!events) {
      return NextResponse.json(
        { message: 'Povpraševanje ne obstaja.' },
        { status: 404, headers: noStoreHeaders }
      );
    }
    return NextResponse.json({ events }, { headers: noStoreHeaders });
  } catch (error) {
    const status = isDatabaseUnavailableError(error) ? 503 : 500;
    return NextResponse.json(
      { message: 'Celotnega poteka ponudbe trenutno ni mogoče naložiti.' },
      { status, headers: noStoreHeaders }
    );
  }
}
