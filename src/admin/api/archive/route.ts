import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import {
  fetchArchiveEntries,
  permanentlyDeleteArchiveEntries,
  restoreArchiveEntries,
  restoreArchiveTargets
} from '@/shared/server/deletedArchive';
import { insertAuditEventForRequest } from '@/shared/server/audit';
import type {
  ArchiveDeleteResponse,
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
    const parsedBody = await readRequiredJsonRecord(request);
    if (!parsedBody.ok) return parsedBody.response;
    const body = parsedBody.body;
    const ids = Array.isArray(body.ids) ? body.ids.filter(isArchiveEntryId) : [];
    if (ids.length === 0) {
      return NextResponse.json({ message: 'Ni izbranih zapisov za trajni izbris.' }, { status: 400 });
    }

    const beforeEntries = await fetchArchiveEntries('all');
    const selected = beforeEntries.filter((entry) => ids.includes(entry.id));
    const deletedCount = await permanentlyDeleteArchiveEntries(ids);
    for (const entry of selected) {
      await insertAuditEventForRequest(request, {
        entityType: entry.item_type === 'order' ? 'order' : 'media',
        entityId: String(entry.order_id ?? entry.document_id ?? entry.id),
        entityLabel: entry.item_type === 'order' ? `Naročilo ${entry.label.split(' ')[0] ?? entry.order_id}` : entry.label,
        action: 'deleted',
        summary: entry.item_type === 'order' ? 'Naročilo trajno izbrisano' : 'Dokument trajno izbrisan',
        diff: {
          status: {
            label: 'Status',
            before: 'v arhivu',
            after: 'trajno izbrisano'
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
    return NextResponse.json<ArchiveDeleteResponse>({ success: true, deletedCount });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Napaka na strežniku.' },
      { status: 500 }
    );
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
        entityType: entry.item_type === 'order' ? 'order' : 'media',
        entityId: String(entry.order_id ?? entry.document_id ?? entry.id),
        entityLabel: entry.item_type === 'order' ? `Naročilo ${entry.label.split(' ')[0] ?? entry.order_id}` : entry.label,
        action: 'restored',
        summary: entry.item_type === 'order' ? 'Naročilo obnovljeno' : 'Dokument obnovljen',
        diff: {
          status: {
            label: 'Status',
            before: 'v arhivu',
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

    revalidatePath('/admin/arhiv');
    revalidatePath('/admin/orders');
    revalidatePath('/admin/orders/[orderId]', 'page');

    return NextResponse.json<ArchiveRestoreResponse>({ success: true, restoredCount: restoredFromIds + restoredFromTargets });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Napaka na strežniku.' },
      { status: 500 }
    );
  }
}
