import { NextResponse } from 'next/server';
import type { SchoolDirectoryMutation } from '@/shared/domain/schoolDirectory';
import { isDatabaseUnavailableError } from '@/shared/server/db';
import {
  getSchoolDirectory,
  mutateSchoolDirectory,
  SchoolDirectoryConflictError,
  SchoolDirectoryValidationError
} from '@/shared/server/schoolDirectory';
import { readRequiredJsonRecord } from '@/shared/server/requestJson';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({ directory: await getSchoolDirectory() });
}

export async function PATCH(request: Request) {
  try {
    const body = await readRequiredJsonRecord(request);
    if (!body.ok) return body.response;

    const result = await mutateSchoolDirectory(body.body as SchoolDirectoryMutation);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    if (error instanceof SchoolDirectoryConflictError) {
      return NextResponse.json({
        message: error.message,
        ...(error.row ? { row: error.row } : {}),
        rows: error.rows,
        ...(error.missingRowIds.length ? { missingRowIds: error.missingRowIds } : {})
      }, { status: 409 });
    }
    if (error instanceof SchoolDirectoryValidationError) {
      return NextResponse.json({ message: error.message }, { status: 400 });
    }
    console.error('Failed to update school directory', error);
    const status = isDatabaseUnavailableError(error) ? 503 : 500;
    return NextResponse.json({ message: 'Shranjevanje seznama šol ni uspelo.' }, { status });
  }
}
