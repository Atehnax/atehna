import { NextResponse } from 'next/server';
import { isDatabaseUnavailableError } from '@/shared/server/db';
import { SchoolDirectoryConflictError, SchoolDirectoryValidationError } from '@/shared/server/schoolDirectory';
import {
  assertInstitutionDirectoryId, resolveInstitutionDirectoryId, InstitutionDirectoryConflictError, InstitutionDirectoryValidationError
} from '@/shared/domain/institutionDirectory';
import { getInstitutionDirectory, mutateInstitutionDirectory } from '@/shared/server/institutionDirectory';
import { getInstitutionDirectoryView, mutateInstitutionDirectoryView } from '@/shared/server/institutionDirectoryViews';
import { readRequiredJsonRecord } from '@/shared/server/requestJson';

export const dynamic = 'force-dynamic';
const selectedDirectory = (request?: Request) => {
  const input = request ? new URL(request.url).searchParams.get('directory') ?? 'osnovne-sole' : 'osnovne-sole';
  if (input === 'vsi-seznami' || input === 'posebne-potrebe') return input;
  return assertInstitutionDirectoryId(resolveInstitutionDirectoryId(input) ?? input);
};
function errorResponse(error: unknown) {
  if (error instanceof SchoolDirectoryConflictError || error instanceof InstitutionDirectoryConflictError) {
    return NextResponse.json({
      message: error.message,
      ...(error.row ? { row: error.row } : {}),
      rows: error.rows,
      ...(error.missingRowIds.length ? { missingRowIds: error.missingRowIds } : {})
    }, { status: 409 });
  }
  if (error instanceof SchoolDirectoryValidationError || error instanceof InstitutionDirectoryValidationError) {
    return NextResponse.json({ message: error.message }, { status: 400 });
  }
  console.error('School/institution directory request failed', error);
  return NextResponse.json({ message: 'Obdelava seznama šol in zavodov ni uspela.' }, { status: isDatabaseUnavailableError(error) ? 503 : 500 });
}
export async function GET(request: Request) {
  try {
    const directoryId = selectedDirectory(request);
    const directory = directoryId === 'vsi-seznami' || directoryId === 'posebne-potrebe'
      ? await getInstitutionDirectoryView(directoryId)
      : await getInstitutionDirectory(directoryId);
    return NextResponse.json({ directory });
  }
  catch (error) { return errorResponse(error); }
}
export async function PATCH(request: Request) {
  try {
    const directoryId = selectedDirectory(request);
    const body = await readRequiredJsonRecord(request);
    if (!body.ok) return body.response;
    const result = directoryId === 'vsi-seznami' || directoryId === 'posebne-potrebe'
      ? await mutateInstitutionDirectoryView(directoryId, body.body)
      : await mutateInstitutionDirectory(directoryId, body.body);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) { return errorResponse(error); }
}
