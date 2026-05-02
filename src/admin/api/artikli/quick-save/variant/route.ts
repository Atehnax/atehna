import { NextResponse } from 'next/server';
import {
  CatalogItemIdentityConflictError,
  fetchCatalogItemEditorBySlug,
  quickPatchCatalogVariantByIdentifier
} from '@/shared/server/catalogItems';
import { computeCatalogItemAuditDiff, countAuditChangedFields, diffHasEntries, inferCatalogItemAuditAction } from '@/shared/audit/auditDiff';
import { insertAuditEventForRequest } from '@/shared/server/audit';
import { isJsonRecord, readRequiredJsonRecord } from '@/shared/server/requestJson';
import type { CatalogVariantQuickPatch } from '@/shared/domain/catalog/catalogAdminTypes';

export async function PATCH(request: Request) {
  try {
    const bodyResult = await readRequiredJsonRecord(request);
    if (!bodyResult.ok) return bodyResult.response;

    const itemIdentifier = typeof bodyResult.body.itemIdentifier === 'string' ? bodyResult.body.itemIdentifier.trim() : '';
    const variantId = Number(bodyResult.body.variantId);
    const patch = isJsonRecord(bodyResult.body.patch) ? (bodyResult.body.patch as CatalogVariantQuickPatch) : undefined;
    if (!itemIdentifier) {
      return NextResponse.json({ message: 'Item identifikator je obvezen.' }, { status: 400 });
    }
    if (!Number.isFinite(variantId)) {
      return NextResponse.json({ message: 'Variant identifikator je obvezen.' }, { status: 400 });
    }
    if (!patch || Object.keys(patch).length === 0) {
      return NextResponse.json({ message: 'Patch payload je obvezen.' }, { status: 400 });
    }

    const before = await fetchCatalogItemEditorBySlug(itemIdentifier);
    const updated = await quickPatchCatalogVariantByIdentifier(itemIdentifier, variantId, patch);
    if (!updated) {
      return NextResponse.json({ message: 'Različica ni bila najdena.' }, { status: 404 });
    }

    const after = await fetchCatalogItemEditorBySlug(String(updated.item.id));
    const diff = computeCatalogItemAuditDiff(before as Record<string, unknown> | null, after as Record<string, unknown> | null);
    if (diffHasEntries(diff)) {
      await insertAuditEventForRequest(request, {
        entityType: 'item',
        entityId: String(after?.slug ?? updated.item.slug ?? itemIdentifier),
        entityLabel: after?.itemName ?? updated.item.itemName,
        action: inferCatalogItemAuditAction(diff, 'updated'),
        diff,
        metadata: {
          product_type: after?.productType ?? updated.item.productType,
          changed_field_count: countAuditChangedFields(diff),
          variant_id: variantId
        }
      });
    }

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof CatalogItemIdentityConflictError) {
      return NextResponse.json({ message: error.message, conflicts: error.conflicts }, { status: error.statusCode });
    }
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Napaka na strežniku.' }, { status: 500 });
  }
}
