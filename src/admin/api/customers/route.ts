import { NextResponse } from 'next/server';
import { isDatabaseUnavailableError } from '@/shared/server/db';
import {
  CustomerDirectoryConflictError,
  CustomerDirectoryValidationError,
  getCustomerDirectory,
  mutateCustomerDirectory
} from '@/shared/server/customerDirectory';
import { readRequiredJsonRecord } from '@/shared/server/requestJson';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({ directory: await getCustomerDirectory() });
}

export async function PATCH(request: Request) {
  try {
    const body = await readRequiredJsonRecord(request);
    if (!body.ok) return body.response;

    const result = await mutateCustomerDirectory(body.body);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    if (error instanceof CustomerDirectoryConflictError) {
      return NextResponse.json({
        message: error.message,
        ...(error.row ? { row: error.row } : {}),
        rows: error.rows,
        ...(error.missingRowIds.length ? { missingRowIds: error.missingRowIds } : {})
      }, { status: 409 });
    }
    if (error instanceof CustomerDirectoryValidationError) {
      return NextResponse.json({ message: error.message }, { status: 400 });
    }
    console.error('Failed to update customer directory', error);
    const status = isDatabaseUnavailableError(error) ? 503 : 500;
    return NextResponse.json({ message: 'Shranjevanje seznama strank ni uspelo.' }, { status });
  }
}
