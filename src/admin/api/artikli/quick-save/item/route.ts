import { NextResponse } from 'next/server';
import {
  CatalogItemIdentityConflictError,
  fetchCatalogItemEditorBySlug,
  quickPatchCatalogItemByIdentifier
} from '@/shared/server/catalogItems';
import { computeCatalogItemAuditDiff, countAuditChangedFields, diffHasEntries, inferCatalogItemAuditAction } from '@/shared/audit/auditDiff';
import { insertAuditEventForRequest } from '@/shared/server/audit';
import { isJsonRecord, readRequiredJsonRecord } from '@/shared/server/requestJson';
import type { CatalogItemQuickPatch } from '@/shared/domain/catalog/catalogAdminTypes';

export async function PATCH(request: Request) {
  try {
    const bodyResult = await readRequiredJsonRecord(request);
    if (!bodyResult.ok) return bodyResult.response;

    const itemIdentifier = typeof bodyResult.body.itemIdentifier === 'string' ? bodyResult.body.itemIdentifier.trim() : '';
    const patch = isJsonRecord(bodyResult.body.patch) ? (bodyResult.body.patch as CatalogItemQuickPatch) : undefined;
    if (!itemIdentifier) {
      return NextResponse.json({ message: 'Item identifikator je obvezen.' }, { status: 400 });
    }
    if (!patch || Object.keys(patch).length === 0) {
      return NextResponse.json({ message: 'Patch payload je obvezen.' }, { status: 400 });
    }

    const before = await fetchCatalogItemEditorBySlug(itemIdentifier);
    const item = await quickPatchCatalogItemByIdentifier(itemIdentifier, patch);
    if (!item) {
      return NextResponse.json({ message: 'Artikel ni bil najden.' }, { status: 404 });
    }
    const after = await fetchCatalogItemEditorBySlug(String(item.id));
    const diff = computeCatalogItemAuditDiff(before as Record<string, unknown> | null, after as Record<string, unknown> | null);
    if (diffHasEntries(diff)) {
      await insertAuditEventForRequest(request, {
        entityType: 'item',
        entityId: String(after?.slug ?? item.slug ?? itemIdentifier),
        entityLabel: after?.itemName ?? item.itemName,
        action: inferCatalogItemAuditAction(diff, 'updated'),
        diff,
        metadata: {
          product_type: after?.productType ?? item.productType,
          changed_field_count: countAuditChangedFields(diff)
        }
      });
    }

    return NextResponse.json({ item });
  } catch (error) {
    if (error instanceof CatalogItemIdentityConflictError) {
      return NextResponse.json({ message: error.message, conflicts: error.conflicts }, { status: error.statusCode });
    }
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Napaka na strežniku.' }, { status: 500 });
  }
}
