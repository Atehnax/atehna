import { revalidatePath } from 'next/cache';
import { NextResponse } from 'next/server';
import {
  getOrderEmailAdminState,
  OrderEmailSchemaNotReadyError,
  OrderEmailSettingsValidationError,
  updateOrderEmailSettings
} from '@/shared/server/orderEmailSettings';
import { isDatabaseUnavailableError } from '@/shared/server/db';
import { readRequiredJsonRecord } from '@/shared/server/requestJson';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    return NextResponse.json({ state: await getOrderEmailAdminState() });
  } catch (error) {
    return NextResponse.json(
      {
        message: isDatabaseUnavailableError(error)
          ? 'Nastavitev samodejne e-pošte trenutno ni mogoče naložiti, ker baza ni dosegljiva.'
          : 'Nastavitev samodejne e-pošte trenutno ni mogoče naložiti.'
      },
      { status: isDatabaseUnavailableError(error) ? 503 : 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const body = await readRequiredJsonRecord(request);
    if (!body.ok) return body.response;
    await updateOrderEmailSettings(body.body.config ?? body.body, { request });
    revalidatePath('/admin/e-posta');
    return NextResponse.json({ state: await getOrderEmailAdminState() });
  } catch (error) {
    if (error instanceof OrderEmailSchemaNotReadyError) {
      return NextResponse.json(
        { message: error.message },
        { status: 503 }
      );
    }
    if (error instanceof OrderEmailSettingsValidationError) {
      return NextResponse.json(
        { message: error.message, errors: error.errors },
        { status: error.message.includes('RESEND_API_KEY') ? 409 : 400 }
      );
    }
    return NextResponse.json(
      {
        message: isDatabaseUnavailableError(error)
          ? 'Nastavitev ni mogoče shraniti, ker baza ni dosegljiva.'
          : 'Shranjevanje nastavitev samodejne e-pošte ni uspelo.'
      },
      { status: isDatabaseUnavailableError(error) ? 503 : 500 }
    );
  }
}
