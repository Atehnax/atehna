import { NextResponse } from 'next/server';
import { SupplierDirectoryValidationError } from '@/shared/domain/supplierDirectory';
import { getSupplierDirectory, mutateSupplierDirectory, SupplierDirectoryConflictError } from '@/shared/server/supplierDirectory';
import { getAuditActor, getAuditRequestContext } from '@/shared/server/audit';
import { isDatabaseUnavailableError } from '@/shared/server/db';
import { readRequiredJsonRecord } from '@/shared/server/requestJson';

export const dynamic = 'force-dynamic';
export async function GET() {
  try { return NextResponse.json({ directory: await getSupplierDirectory() }); }
  catch (error) {
    return NextResponse.json({ message: 'Seznama dobaviteljev trenutno ni mogoče naložiti.' }, { status: isDatabaseUnavailableError(error) ? 503 : 500 });
  }
}
export async function PATCH(request: Request) {
  try {
    const body = await readRequiredJsonRecord(request);
    if (!body.ok) return body.response;
    const context = getAuditRequestContext(request);
    const result = await mutateSupplierDirectory(body.body, { ...context, actor: await getAuditActor(request) });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    if (error instanceof SupplierDirectoryValidationError) return NextResponse.json({ message: error.message }, { status: 400 });
    if (error instanceof SupplierDirectoryConflictError) return NextResponse.json({
      message: error.message, row: error.row, rows: error.rows, missingRowIds: error.missingRowIds
    }, { status: 409 });
    return NextResponse.json({ message: 'Shranjevanje dobavitelja ni uspelo.' }, { status: isDatabaseUnavailableError(error) ? 503 : 500 });
  }
}