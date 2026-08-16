import { NextResponse } from 'next/server';
import {
  CatalogItemConcurrencyConflictError,
  CatalogItemIdentityConflictError,
  CatalogItemValidationError,
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
    if (!Array.isArray(payload.variants)) {
      return NextResponse.json({ message: 'Različice morajo biti poslane kot seznam.' }, { status: 400 });
    }
    if (
      payload.id !== undefined
      && (!Number.isInteger(payload.id) || payload.id <= 0)
    ) {
      return NextResponse.json({ message: 'Artikel za posodobitev ni veljaven.' }, { status: 400 });
    }
    if (
      payload.id !== undefined
      && (
        typeof payload.expectedUpdatedAt !== 'string'
        || !payload.expectedUpdatedAt.trim()
        || Number.isNaN(Date.parse(payload.expectedUpdatedAt))
      )
    ) {
      return NextResponse.json(
        { message: 'Manjka različica podatkov artikla. Osvežite stran in poskusite znova.' },
        { status: 400 }
      );
    }
    if (
      payload.taxRate !== undefined
      && (
        typeof payload.taxRate !== 'number'
        || !Number.isFinite(payload.taxRate)
        || payload.taxRate < 0
        || payload.taxRate > 1
      )
    ) {
      return NextResponse.json({ message: 'Stopnja DDV mora biti število med 0 in 1.' }, { status: 400 });
    }
    if (
      payload.variants.some((variant) =>
        variant.costNet !== undefined
        && variant.costNet !== null
        && (
          typeof variant.costNet !== 'number'
          || !Number.isFinite(variant.costNet)
          || variant.costNet < 0
        )
      )
    ) {
      return NextResponse.json({ message: 'Nabavna cena brez DDV ne sme biti negativna.' }, { status: 400 });
    }

    if (payload.optionAxes !== undefined && !Array.isArray(payload.optionAxes)) {
      return NextResponse.json({ message: 'Izbirne lastnosti morajo biti poslane kot seznam.' }, { status: 400 });
    }
    if (
      Array.isArray(payload.optionAxes)
      && payload.optionAxes.some((axis) =>
        !axis
        || typeof axis.name !== 'string'
        || !axis.name.trim()
        || typeof axis.slug !== 'string'
        || !axis.slug.trim()
        || !Array.isArray(axis.values)
        || axis.values.length === 0
        || axis.values.some((value) =>
          !value
          || typeof value.value !== 'string'
          || !value.value.trim()
          || typeof value.slug !== 'string'
          || !value.slug.trim()
        )
      )
    ) {
      return NextResponse.json(
        { message: 'Vsaka izbirna lastnost potrebuje naziv, ključ in najmanj eno pravilno vrednost.' },
        { status: 400 }
      );
    }
    if (Array.isArray(payload.optionAxes)) {
      const axisSlugs = payload.optionAxes.map((axis) => axis.slug.trim().toLocaleLowerCase('sl'));
      const hasDuplicateAxisSlug = new Set(axisSlugs).size !== axisSlugs.length;
      const hasDuplicateValueSlug = payload.optionAxes.some((axis) => {
        const valueSlugs = axis.values.map((value) => value.slug.trim().toLocaleLowerCase('sl'));
        return new Set(valueSlugs).size !== valueSlugs.length;
      });
      if (hasDuplicateAxisSlug || hasDuplicateValueSlug) {
        return NextResponse.json(
          { message: 'Ključi izbirnih lastnosti in njihovih vrednosti morajo biti enolični.' },
          { status: 400 }
        );
      }
    }
    if (
      payload.defaultVariantIndex !== undefined
      && payload.defaultVariantIndex !== null
      && (
        !Number.isInteger(payload.defaultVariantIndex)
        || payload.defaultVariantIndex < 0
        || payload.defaultVariantIndex >= payload.variants.length
      )
    ) {
      return NextResponse.json({ message: 'Privzeta različica ni veljavna.' }, { status: 400 });
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

    return NextResponse.json<CatalogItemSaveApiResponse>({
      id: saved.id,
      slug: saved.slug,
      updatedAt: saved.updatedAt
    });
  } catch (error) {
    if (error instanceof CatalogItemConcurrencyConflictError) {
      return NextResponse.json<CatalogItemSaveApiResponse>(
        { message: error.message, updatedAt: error.currentUpdatedAt },
        { status: error.statusCode }
      );
    }
    if (error instanceof CatalogItemIdentityConflictError) {
      return NextResponse.json<CatalogItemSaveApiResponse>(
        { message: error.message, conflicts: error.conflicts },
        { status: error.statusCode }
      );
    }
    if (error instanceof CatalogItemValidationError) {
      return NextResponse.json<CatalogItemSaveApiResponse>(
        { message: error.message },
        { status: error.statusCode }
      );
    }
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Napaka na strežniku.' }, { status: 500 });
  }
}
