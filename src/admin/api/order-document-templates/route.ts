import { revalidatePath } from 'next/cache';
import { NextResponse } from 'next/server';
import { validateOrderDocumentTemplatesInput } from '@/shared/domain/order/orderDocumentTemplates';
import { isDatabaseUnavailableError } from '@/shared/server/db';
import {
  getOrderDocumentTemplatesConfig,
  revalidateOrderDocumentTemplatesCache,
  updateOrderDocumentTemplatesConfig
} from '@/shared/server/orderDocumentTemplates';
import { readRequiredJsonRecord } from '@/shared/server/requestJson';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({ config: await getOrderDocumentTemplatesConfig() });
}

export async function PUT(request: Request) {
  try {
    const body = await readRequiredJsonRecord(request);
    if (!body.ok) return body.response;
    const configInput = body.body.config ?? body.body;
    const errors = validateOrderDocumentTemplatesInput(configInput);
    if (errors.length > 0) {
      return NextResponse.json(
        { message: errors[0] ?? 'Nastavitve predlog PDF niso veljavne.', errors },
        { status: 400 }
      );
    }

    const result = await updateOrderDocumentTemplatesConfig(configInput, { request });
    if (result.changed) {
      revalidateOrderDocumentTemplatesCache();
      revalidatePath('/admin/urejevalnik');
    }
    return NextResponse.json({ config: result.config });
  } catch (error) {
    console.error('Failed to update order document templates', error);
    return NextResponse.json(
      { message: 'Shranjevanje predlog PDF ni uspelo.' },
      { status: isDatabaseUnavailableError(error) ? 503 : 500 }
    );
  }
}
