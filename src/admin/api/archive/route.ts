import { ArchiveDeleteConflictError, permanentlyDeleteArchiveEntries } from '@/shared/server/purgeDeletedArchive';
import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import {
  ArchiveRestoreConflictError,
  fetchArchiveEntries,
  restoreArchiveSelection
} from '@/shared/server/deletedArchive';
import type {
  ArchiveEntriesResponse,
  ArchiveRestoreResponse,
  RestoreTarget
} from '@/shared/domain/archive/archiveTypes';
import { readRequiredJsonRecord } from '@/shared/server/requestJson';

const isArchiveEntryId = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

function isRestoreTarget(value: unknown): value is RestoreTarget {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const target = value as Partial<RestoreTarget>;
  return (
    (target.item_type === 'order' || target.item_type === 'pdf') &&
    (target.order_id === null || isArchiveEntryId(target.order_id)) &&
    (target.document_id === null || isArchiveEntryId(target.document_id))
  );
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const typeParam = searchParams.get('type');
    const type = typeParam === 'order' || typeParam === 'pdf' ? typeParam : 'all';

    const entries = await fetchArchiveEntries(type);
    return NextResponse.json<ArchiveEntriesResponse>({ entries });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Napaka na strežniku.' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const parsed = await readRequiredJsonRecord(request);
    if (!parsed.ok) return parsed.response;
    const { ids = [], targets = [] } = parsed.body;
    if (!Array.isArray(ids) || !Array.isArray(targets) || ids.length + targets.length > 1000 ||
      !ids.every(id => Number.isSafeInteger(id) && id > 0) || !targets.every(target => isRestoreTarget(target) &&
        (target.order_id === null || (Number.isSafeInteger(target.order_id) && target.order_id > 0)) &&
        (target.document_id === null || (Number.isSafeInteger(target.document_id) && target.document_id > 0))) ||
      ids.length + targets.length === 0) {
      return NextResponse.json({ message: 'Izberite veljavne zapise za trajni izbris.' }, { status: 400 });
    }
    const result = await permanentlyDeleteArchiveEntries(request, ids, targets);
    revalidatePath('/admin/trash');
    revalidatePath('/admin/orders');
    revalidatePath('/admin/orders/[orderId]', 'page');
    revalidatePath('/admin/analitika');
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    const conflict = error instanceof ArchiveDeleteConflictError;
    return NextResponse.json({ message: conflict ? error.message : 'Trajni izbris ni uspel. Poskusite znova.', code: conflict ? error.code : undefined }, { status: conflict ? 409 : 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const parsedBody = await readRequiredJsonRecord(request);
    if (!parsedBody.ok) return parsedBody.response;
    const body = parsedBody.body;

    const { ids = [], targets = [] } = body;
    if (!Array.isArray(ids) || !Array.isArray(targets) || ids.length + targets.length > 1000 ||
      !ids.every(id => Number.isSafeInteger(id) && id > 0) || !targets.every(target => isRestoreTarget(target) &&
        (target.order_id === null || (Number.isSafeInteger(target.order_id) && target.order_id > 0)) &&
        (target.document_id === null || (Number.isSafeInteger(target.document_id) && target.document_id > 0))) ||
      ids.length + targets.length === 0) {
      return NextResponse.json({ message: 'Izberite veljavne zapise za obnovo.' }, { status: 400 });
    }
    const restoredCount = await restoreArchiveSelection(ids, targets, request);

    revalidatePath('/admin/trash');
    revalidatePath('/admin/orders');
    revalidatePath('/admin/orders/[orderId]', 'page');

    return NextResponse.json<ArchiveRestoreResponse>({ success: true, restoredCount });
  } catch (error) {
    return NextResponse.json(
      {
        code:
          error instanceof ArchiveRestoreConflictError
            ? error.code
            : undefined,
        message: error instanceof Error ? error.message : 'Napaka na strežniku.'
      },
      { status: error instanceof ArchiveRestoreConflictError ? 409 : 500 }
    );
  }
}
