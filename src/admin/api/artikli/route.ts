import { NextResponse } from 'next/server';
import {
  CatalogItemIdentityConflictError,
  fetchCatalogItemEditorBySlug,
  upsertCatalogItem
} from '@/shared/server/catalogItems';
import type { CatalogItemEditorPayload, CatalogItemSaveApiResponse } from '@/shared/domain/catalog/catalogAdminTypes';
import {
  computeCatalogItemAuditDiff,
  countAuditChangedFields,
  diffHasEntries,
  inferCatalogItemAuditAction
} from '@/shared/audit/auditDiff';
import { insertAuditEventForRequest } from '@/shared/server/audit';
import { readRequiredJsonRecord } from '@/shared/server/requestJson';

export async function POST(request: Request) {
  try {
    const payloadResult = await readRequiredJsonRecord(request);
    if (!payloadResult.ok) return payloadResult.response;

    const payload = payloadResult.body as Partial<CatalogItemEditorPayload>;
    if (!payload?.itemName?.trim()) {
      return NextResponse.json<CatalogItemSaveApiResponse>({ message: 'Naziv artikla je obvezen.' }, { status: 400 });
    }
    if (!payload?.slug?.trim()) {
      return NextResponse.json<CatalogItemSaveApiResponse>({ message: 'URL (slug) je obvezen.' }, { status: 400 });
    }
    if (!Array.isArray(payload.variants) || payload.variants.length === 0) {
      return NextResponse.json({ message: 'Artikel mora imeti vsaj eno različico.' }, { status: 400 });
    }

    const before = payload.id
      ? await fetchCatalogItemEditorBySlug(String(payload.id))
      : await fetchCatalogItemEditorBySlug(payload.slug);
    const itemPayload = payload as CatalogItemEditorPayload;
    const saved = await upsertCatalogItem(itemPayload);
    const after = await fetchCatalogItemEditorBySlug(String(saved.id));
    const diff = computeCatalogItemAuditDiff(before as Record<string, unknown> | null, after as Record<string, unknown> | null);
    const action = before ? inferCatalogItemAuditAction(diff, 'updated') : 'created';

    if (!before || diffHasEntries(diff)) {
      await insertAuditEventForRequest(request, {
        entityType: 'item',
        entityId: String(after?.slug ?? saved.slug ?? payload.slug),
        entityLabel: after?.itemName ?? payload.itemName,
        action,
        diff,
        metadata: {
          product_type: after?.productType ?? payload.productType ?? null,
          changed_field_count: countAuditChangedFields(diff),
          variant_added_count: 'variants' in diff && 'added' in diff.variants ? diff.variants.added?.length ?? 0 : 0,
          variant_removed_count: 'variants' in diff && 'removed' in diff.variants ? diff.variants.removed?.length ?? 0 : 0,
          variant_updated_count: 'variants' in diff && 'updated' in diff.variants ? diff.variants.updated?.length ?? 0 : 0
        }
      });
    }

    return NextResponse.json<CatalogItemSaveApiResponse>({ id: saved.id, slug: saved.slug });
  } catch (error) {
    if (error instanceof CatalogItemIdentityConflictError) {
      return NextResponse.json<CatalogItemSaveApiResponse>(
        { message: error.message, conflicts: error.conflicts },
        { status: error.statusCode }
      );
    }
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Napaka na strežniku.' }, { status: 500 });
  }
}
