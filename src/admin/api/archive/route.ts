import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import {
  fetchArchiveEntries,
  permanentlyDeleteArchiveEntries,
  restoreArchiveEntries,
  restoreArchiveTargets,
  type RestoreTarget
} from '@/shared/server/deletedArchive';
import { insertAuditEventForRequest } from '@/shared/server/audit';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const typeParam = searchParams.get('type');
    const type = typeParam === 'order' || typeParam === 'pdf' ? typeParam : 'all';

    const entries = await fetchArchiveEntries(type);
    return NextResponse.json({ entries });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Napaka na strežniku.' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as { ids?: number[] };
    const ids = Array.isArray(body.ids) ? body.ids.filter((id) => Number.isFinite(id)) : [];
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
    return NextResponse.json({ success: true, deletedCount });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Napaka na strežniku.' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      ids?: number[];
      targets?: RestoreTarget[];
    };

    const ids = Array.isArray(body.ids) ? body.ids.filter((id) => Number.isFinite(id) && id > 0) : [];
    const targets = Array.isArray(body.targets)
      ? body.targets.filter(
          (target) =>
            target &&
            (target.item_type === 'order' || target.item_type === 'pdf') &&
            (target.order_id === null || Number.isFinite(target.order_id)) &&
            (target.document_id === null || Number.isFinite(target.document_id))
        )
      : [];

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
    revalidatePath('/admin/arhiv-izbrisanih');
    revalidatePath('/admin/orders');
    revalidatePath('/admin/orders/[orderId]', 'page');

    return NextResponse.json({ success: true, restoredCount: restoredFromIds + restoredFromTargets });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Napaka na strežniku.' },
      { status: 500 }
    );
  }
}
