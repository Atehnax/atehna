import { NextResponse } from 'next/server';
import { getPool } from '@/shared/server/db';
import {
  buildAuthoritativeOrderEstimate,
  normalizeOrderEstimateCustomerLabels,
  OrderCommerceError,
  parseOrderSelections
} from '@/shared/server/orderCommerce';
import { readRequiredJsonRecord } from '@/shared/server/requestJson';

export const runtime = 'nodejs';

const MAX_ESTIMATE_CUSTOMER_LABELS = 3;
const MAX_ESTIMATE_CUSTOMER_LABEL_LENGTH = 240;

function readAdditionalCustomerLabels(body: Record<string, unknown>): string[] {
  if (body.customerLabels === undefined) return [];
  if (
    !Array.isArray(body.customerLabels) ||
    body.customerLabels.length > MAX_ESTIMATE_CUSTOMER_LABELS ||
    body.customerLabels.some(
      (label) =>
        typeof label !== 'string' ||
        label.trim().length > MAX_ESTIMATE_CUSTOMER_LABEL_LENGTH
    )
  ) {
    throw new OrderCommerceError(
      400,
      'INVALID_ESTIMATE_CUSTOMER_CONTEXT',
      'Podatki naročnika za izračun niso veljavni.'
    );
  }
  return body.customerLabels;
}

export async function POST(request: Request) {
  try {
    const bodyResult = await readRequiredJsonRecord(request);
    if (!bodyResult.ok) return bodyResult.response;

    const pool = await getPool();
    const selections = parseOrderSelections(bodyResult.body.items);
    const customerName =
      typeof bodyResult.body.customerName === 'string'
        ? bodyResult.body.customerName.trim()
        : '';
    const additionalCustomerLabels = readAdditionalCustomerLabels(
      bodyResult.body
    );
    const estimateOptions = additionalCustomerLabels.length > 0
      ? {
          customerLabels: normalizeOrderEstimateCustomerLabels([
            customerName,
            ...additionalCustomerLabels
          ])
        }
      : { customerLabels: customerName ? [customerName] : [] };
    const estimate = await buildAuthoritativeOrderEstimate(
      pool,
      selections,
      estimateOptions
    );

    return NextResponse.json(estimate, {
      headers: { 'Cache-Control': 'no-store' }
    });
  } catch (error) {
    if (error instanceof OrderCommerceError) {
      return NextResponse.json(
        {
          code: error.code,
          message: error.message,
          issues: error.issues
        },
        {
          status: error.status,
          headers: { 'Cache-Control': 'no-store' }
        }
      );
    }

    console.error('[orders.estimate] failed', {
      message: error instanceof Error ? error.message : 'Unknown error'
    });
    return NextResponse.json(
      {
        code: 'ESTIMATE_FAILED',
        message: 'Izračuna naročila trenutno ni mogoče pripraviti.'
      },
      {
        status: 500,
        headers: { 'Cache-Control': 'no-store' }
      }
    );
  }
}
