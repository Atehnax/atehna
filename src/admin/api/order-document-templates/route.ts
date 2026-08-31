import { revalidatePath } from 'next/cache';
import { NextResponse } from 'next/server';
import {
  cloneDefaultOrderDocumentTemplate,
  validateOrderDocumentTemplatesInput
} from '@/shared/domain/order/orderDocumentTemplates';
import { isDatabaseUnavailableError } from '@/shared/server/db';
import {
  getOrderDocumentTemplatesConfig,
  revalidateOrderDocumentTemplatesCache,
  updateOrderDocumentTemplatesConfig,
  withoutQuoteOfferTemplate
} from '@/shared/server/orderDocumentTemplates';
import { isQuoteAdminEnabled } from '@/shared/server/quoteFeatureFlags';
import { readRequiredJsonRecord } from '@/shared/server/requestJson';

export const dynamic = 'force-dynamic';

export async function GET() {
  const config = await getOrderDocumentTemplatesConfig();
  return NextResponse.json({
    config: isQuoteAdminEnabled() ? config : withoutQuoteOfferTemplate(config)
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function offerSafeValidationInput(value: unknown): unknown {
  if (!isRecord(value)) return value;
  const templates = isRecord(value.templates) ? value.templates : {};
  return {
    ...value,
    templates: {
      ...templates,
      offer: cloneDefaultOrderDocumentTemplate('offer')
    }
  };
}

export async function PUT(request: Request) {
  try {
    const body = await readRequiredJsonRecord(request);
    if (!body.ok) return body.response;
    const configInput = body.body.config ?? body.body;
    const quoteAdminEnabled = isQuoteAdminEnabled();
    const errors = validateOrderDocumentTemplatesInput(
      quoteAdminEnabled ? configInput : offerSafeValidationInput(configInput)
    );
    if (errors.length > 0) {
      return NextResponse.json(
        { message: errors[0] ?? 'Nastavitve predlog PDF niso veljavne.', errors },
        { status: 400 }
      );
    }

    const result = await updateOrderDocumentTemplatesConfig(configInput, {
      request,
      preserveQuoteOfferTemplate: !quoteAdminEnabled
    });
    if (result.changed) {
      revalidateOrderDocumentTemplatesCache();
      revalidatePath('/admin/urejevalnik');
    }
    return NextResponse.json({
      config: quoteAdminEnabled
        ? result.config
        : withoutQuoteOfferTemplate(result.config)
    });
  } catch (error) {
    console.error('Failed to update order document templates', error);
    return NextResponse.json(
      { message: 'Shranjevanje predlog PDF ni uspelo.' },
      { status: isDatabaseUnavailableError(error) ? 503 : 500 }
    );
  }
}
