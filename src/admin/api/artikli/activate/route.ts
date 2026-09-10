import { NextResponse } from 'next/server';
import { CatalogActivationValidationError, parseCatalogBulkActivationRequest } from '@/shared/domain/catalog/catalogActivation';
import { activateCatalogItems, CatalogItemValidationError, CatalogItemConcurrencyConflictError } from '@/shared/server/catalogItems';
import { readRequiredJsonRecord } from '@/shared/server/requestJson';

export async function POST(request: Request) {
  try {
    const body = await readRequiredJsonRecord(request);
    if (!body.ok) return body.response;
    const selection = parseCatalogBulkActivationRequest(body.body);
    const result = await activateCatalogItems(selection, { request });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof CatalogActivationValidationError || error instanceof CatalogItemValidationError || error instanceof CatalogItemConcurrencyConflictError) {
      return NextResponse.json({ message: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Aktivacija ni uspela.' }, { status: 500 });
  }
}
