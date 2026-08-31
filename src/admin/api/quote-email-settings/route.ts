import { revalidatePath } from 'next/cache';
import { NextResponse } from 'next/server';
import { isDatabaseUnavailableError } from '@/shared/server/db';
import { isQuoteAdminEnabled } from '@/shared/server/quoteFeatureFlags';
import {
  getQuoteEmailAdminState,
  QuoteEmailSchemaNotReadyError,
  QuoteEmailSettingsValidationError,
  updateQuoteEmailSettings
} from '@/shared/server/quoteEmailSettings';
import { readRequiredJsonRecord } from '@/shared/server/requestJson';
import { hasValidQuoteAdminSession } from '@/admin/api/quote-requests/quoteAdminRouteUtils';

export const dynamic = 'force-dynamic';

function authorize(request: Request): NextResponse | null {
  if (!isQuoteAdminEnabled()) {
    return NextResponse.json({ message: 'Ponudbe niso omogočene.' }, { status: 404 });
  }
  if (!hasValidQuoteAdminSession(request)) {
    return NextResponse.json({ message: 'Za dostop je potrebna prijava.' }, { status: 401 });
  }
  return null;
}

export async function GET(request: Request) {
  const denied = authorize(request);
  if (denied) return denied;
  try {
    return NextResponse.json({ state: await getQuoteEmailAdminState() });
  } catch (error) {
    return NextResponse.json(
      {
        message: isDatabaseUnavailableError(error)
          ? 'Nastavitev e-pošte za ponudbe ni mogoče naložiti, ker baza ni dosegljiva.'
          : 'Nastavitev e-pošte za ponudbe trenutno ni mogoče naložiti.'
      },
      { status: isDatabaseUnavailableError(error) ? 503 : 500 }
    );
  }
}

export async function PUT(request: Request) {
  const denied = authorize(request);
  if (denied) return denied;
  try {
    const parsed = await readRequiredJsonRecord(request);
    if (!parsed.ok) return parsed.response;
    await updateQuoteEmailSettings(parsed.body.config ?? parsed.body, { request });
    revalidatePath('/admin/email');
    return NextResponse.json({ state: await getQuoteEmailAdminState() });
  } catch (error) {
    if (error instanceof QuoteEmailSchemaNotReadyError) {
      return NextResponse.json({ message: error.message }, { status: 503 });
    }
    if (error instanceof QuoteEmailSettingsValidationError) {
      return NextResponse.json(
        { message: error.message, errors: error.errors },
        { status: 400 }
      );
    }
    return NextResponse.json(
      {
        message: isDatabaseUnavailableError(error)
          ? 'Nastavitev ni mogoče shraniti, ker baza ni dosegljiva.'
          : 'Shranjevanje nastavitev e-pošte za ponudbe ni uspelo.'
      },
      { status: isDatabaseUnavailableError(error) ? 503 : 500 }
    );
  }
}
