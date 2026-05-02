import { NextResponse } from 'next/server';
import {
  CatalogItemIdentityConflictError,
  duplicateCatalogItemByIdentifier,
  fetchCatalogItemEditorBySlug
} from '@/shared/server/catalogItems';
import { computeCatalogItemAuditDiff, countAuditChangedFields } from '@/shared/audit/auditDiff';
import { insertAuditEventForRequest } from '@/shared/server/audit';

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as { itemIdentifier?: string };
    const itemIdentifier = typeof body.itemIdentifier === 'string' ? body.itemIdentifier.trim() : '';
    if (!itemIdentifier) {
      return NextResponse.json({ message: 'Neveljaven identifikator artikla.' }, { status: 400 });
    }

    const item = await duplicateCatalogItemByIdentifier(itemIdentifier);
    if (!item) return NextResponse.json({ message: 'Artikel ni bil najden.' }, { status: 404 });
    const after = await fetchCatalogItemEditorBySlug(String(item.id));
    const diff = computeCatalogItemAuditDiff(null, after as Record<string, unknown> | null);
    await insertAuditEventForRequest(request, {
      entityType: 'item',
      entityId: String(after?.slug ?? item.slug ?? itemIdentifier),
      entityLabel: after?.itemName ?? item.itemName,
      action: 'created',
      diff,
      metadata: {
        duplicated_from: itemIdentifier,
        product_type: after?.productType ?? item.productType,
        changed_field_count: countAuditChangedFields(diff)
      }
    });

    return NextResponse.json({ item });
  } catch (error) {
    if (error instanceof CatalogItemIdentityConflictError) {
      return NextResponse.json({ message: error.message, conflicts: error.conflicts }, { status: error.statusCode });
    }
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Kopiranje artikla ni uspelo.' }, { status: 500 });
  }
}
