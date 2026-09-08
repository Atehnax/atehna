import { ArchiveDeleteConflictError, permanentlyDeleteArchiveEntries } from '@/shared/server/purgeDeletedArchive';
import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import {
  ArchiveRestoreConflictError,
  fetchArchiveEntries,
  restoreArchiveEntries,
  restoreArchiveTargets
} from '@/shared/server/deletedArchive';
import { insertAuditEventForRequest } from '@/shared/server/audit';
import type {
  ArchiveEntriesResponse,
  ArchiveRestoreResponse,
  RestoreTarget
} from '@/shared/domain/archive/archiveTypes';
import { readRequiredJsonRecord } from '@/shared/server/requestJson';

const isPositiveNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value > 0;

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

    const ids = Array.isArray(body.ids) ? body.ids.filter(isPositiveNumber) : [];
    const targets = Array.isArray(body.targets) ? body.targets.filter(isRestoreTarget) : [];

    if (ids.length === 0 && targets.length === 0) {
      return NextResponse.json({ message: 'Ni izbranih zapisov za obnovo.' }, { status: 400 });
    }

    const beforeEntries = await fetchArchiveEntries('all');
    const selectedByIds = beforeEntries.filter((entry) => ids.includes(entry.id));
    const selectedByTargets = beforeEntries.filter((entry) =>
      targets.some((target) =>
        target.item_type === entry.item_type &&
        (target.order_id ?? null) === (entry.order_id ?? null) &&
        (target.document_id ?? null) === (entry.document_id ?? null)
      )
    );
    const selected = [...selectedByIds, ...selectedByTargets].filter((entry, index, entries) =>
      entries.findIndex((candidate) => candidate.id === entry.id) === index
    );

    const restoredFromIds = ids.length > 0 ? await restoreArchiveEntries(ids) : 0;
    const restoredFromTargets = targets.length > 0 ? await restoreArchiveTargets(targets) : 0;
    for (const entry of selected) {
      await insertAuditEventForRequest(request, {
        entityType: 'order',
        entityId: String(entry.order_id ?? entry.document_id ?? entry.id),
        entityLabel: entry.item_type === 'order' ? `Naročilo ${entry.label.split(' ')[0] ?? entry.order_id}` : entry.label,
        action: 'restored',
        summary: entry.item_type === 'order' ? 'Naročilo obnovljeno' : 'Dokument obnovljen',
        diff: {
          status: {
            label: 'Status',
            before: 'v košu',
            after: 'obnovljeno'
          }
        },
        metadata: {
          archive_entry_id: entry.id,
          item_type: entry.item_type,
          order_id: entry.order_id,
          document_id: entry.document_id
        }
      });
    }

    revalidatePath('/admin/trash');
    revalidatePath('/admin/orders');
    revalidatePath('/admin/orders/[orderId]', 'page');

    return NextResponse.json<ArchiveRestoreResponse>({ success: true, restoredCount: restoredFromIds + restoredFromTargets });
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
