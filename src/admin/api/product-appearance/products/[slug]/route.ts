import { NextResponse } from 'next/server';
import {
  CatalogItemConcurrencyConflictError,
  CatalogItemIdentityConflictError,
  CatalogItemValidationError,
  fetchCatalogItemEditorBySlug,
  upsertCatalogItem
} from '@/shared/server/catalogItems';
import {
  computeCatalogItemAuditDiff,
  countAuditChangedFields,
  diffHasEntries
} from '@/shared/audit/auditDiff';
import { insertAuditEventForRequest } from '@/shared/server/audit';
import { readRequiredJsonRecord } from '@/shared/server/requestJson';
import {
  applyVariantPresentationPatch,
  validateAndNormalizeVariantPresentationPatches
} from '@/shared/domain/catalog/catalogVariantPresentationPatch';
import {
  validateAndNormalizeCatalogSpecificationLabels
} from '@/shared/domain/catalog/catalogSpecification';
import type {
  CatalogItemAppearanceOverride,
  CatalogItemEditorHydration,
  CatalogItemEditorPayload,
  CatalogItemPresentationPatch,
  CatalogItemPresentationSaveResponse
} from '@/shared/domain/catalog/catalogAdminTypes';

const cleanOptionalText = (value: unknown, maxLength: number) => {
  if (value === null) return null;
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim().slice(0, maxLength);
  return normalized || null;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const validateAppearanceOverridePatch = (value: unknown): string | null => {
  if (value === undefined || value === null) return null;
  if (!isRecord(value)) return 'Lokalne nastavitve prikaza niso veljavne.';
  if (Object.prototype.hasOwnProperty.call(value, 'secondaryContent')) {
    if (!isRecord(value.secondaryContent)) {
      return 'Nastavitve prikaza specifikacij niso veljavne.';
    }
    if (Object.prototype.hasOwnProperty.call(value.secondaryContent, 'specificationLabels')) {
      const result = validateAndNormalizeCatalogSpecificationLabels(
        value.secondaryContent.specificationLabels
      );
      if (!result.ok) return result.message;
    }
  }
  if (!Object.prototype.hasOwnProperty.call(value, 'relatedProducts')) return null;
  if (value.relatedProducts === null) return null;
  if (!isRecord(value.relatedProducts)) {
    return 'Nastavitve sorodnih izdelkov niso veljavne.';
  }
  if (
    Object.prototype.hasOwnProperty.call(value.relatedProducts, 'manualProductSlugs')
    && !Array.isArray(value.relatedProducts.manualProductSlugs)
  ) {
    return 'Ročno izbrani sorodni izdelki niso veljavni.';
  }
  if (
    Array.isArray(value.relatedProducts.manualProductSlugs)
    && (
      value.relatedProducts.manualProductSlugs.length > 100
      || value.relatedProducts.manualProductSlugs.some((slug) => typeof slug !== 'string')
    )
  ) {
    return 'Ročno izbrani sorodni izdelki niso veljavni.';
  }
  return null;
};

function mergePresentationAppearanceOverride(
  item: CatalogItemEditorHydration,
  patchValue: CatalogItemAppearanceOverride | null | undefined,
  specificationLabelsPatch: CatalogItemPresentationPatch['specificationLabels']
): CatalogItemAppearanceOverride | null {
  if (patchValue === undefined && specificationLabelsPatch === undefined) {
    return item.appearanceOverride;
  }

  const current = isRecord(item.appearanceOverride)
    ? { ...item.appearanceOverride }
    : {};
  const currentRelated = isRecord(current.relatedProducts)
    ? { ...current.relatedProducts }
    : {};
  const patchRelated = patchValue === null
    ? null
    : isRecord(patchValue)
      ? patchValue.relatedProducts
      : undefined;
  const currentSecondaryContent = isRecord(current.secondaryContent)
    ? { ...current.secondaryContent }
    : {};
  const patchSecondaryContent = isRecord(patchValue)
    ? patchValue.secondaryContent
    : undefined;

  if (
    isRecord(patchSecondaryContent)
    && Object.prototype.hasOwnProperty.call(
      patchSecondaryContent,
      'specificationLabels'
    )
  ) {
    const labels = validateAndNormalizeCatalogSpecificationLabels(
      patchSecondaryContent.specificationLabels
    );
    if (labels.ok && Object.keys(labels.value).length > 0) {
      currentSecondaryContent.specificationLabels = labels.value;
    } else {
      delete currentSecondaryContent.specificationLabels;
    }
  }
  if (specificationLabelsPatch !== undefined) {
    if (Object.keys(specificationLabelsPatch).length > 0) {
      currentSecondaryContent.specificationLabels = specificationLabelsPatch;
    } else {
      delete currentSecondaryContent.specificationLabels;
    }
  }

  if (Object.keys(currentSecondaryContent).length > 0) {
    current.secondaryContent = currentSecondaryContent;
  } else {
    delete current.secondaryContent;
  }

  if (patchRelated === null) {
    delete currentRelated.manualProductSlugs;
  } else if (
    isRecord(patchRelated)
    && Array.isArray(patchRelated.manualProductSlugs)
  ) {
    currentRelated.manualProductSlugs = Array.from(new Set(
      patchRelated.manualProductSlugs
        .map((slug) => String(slug).trim().slice(0, 240))
        .filter((slug) => slug && slug !== item.slug)
    ));
  }

  if (Object.keys(currentRelated).length > 0) {
    current.relatedProducts = currentRelated;
  } else {
    delete current.relatedProducts;
  }
  return Object.keys(current).length > 0 ? current : null;
}

function toEditorPayload(
  item: CatalogItemEditorHydration,
  patch: CatalogItemPresentationPatch
): CatalogItemEditorPayload {
  const variantPatches = new Map(
    (patch.variantSpecifications ?? []).map((entry) => [entry.variantId, entry])
  );
  const originalGallery = item.media
    .filter((media) => media.mediaKind === 'image' && media.role === 'gallery')
    .sort((left, right) => (left.position ?? 0) - (right.position ?? 0));
  const nextMedia = patch.media ?? item.media;
  const nextGallery = nextMedia
    .filter((media) => media.mediaKind === 'image' && media.role === 'gallery')
    .sort((left, right) => (left.position ?? 0) - (right.position ?? 0));
  const nextGalleryIndexById = new Map(
    nextGallery.flatMap((media, index) => (
      typeof media.id === 'number' ? [[media.id, index] as const] : []
    ))
  );

  return {
    id: item.id,
    expectedUpdatedAt: patch.expectedUpdatedAt,
    itemName: cleanOptionalText(patch.itemName, 240) ?? item.itemName,
    itemType: item.itemType,
    productType: item.productType,
    typeSpecificData: item.typeSpecificData,
    badge: patch.badge === undefined ? item.badge : cleanOptionalText(patch.badge, 80),
    status: item.status === 'active' ? 'active' : 'inactive',
    categoryPath: item.categoryPath,
    sku: item.sku,
    slug: item.slug,
    unit: item.unit,
    brand: patch.brand === undefined ? item.brand : cleanOptionalText(patch.brand, 160),
    material: patch.material === undefined ? item.material : cleanOptionalText(patch.material, 160),
    colour: patch.colour === undefined ? item.colour : cleanOptionalText(patch.colour, 160),
    shape: patch.shape === undefined ? item.shape : cleanOptionalText(patch.shape, 160),
    description: patch.description === undefined
      ? item.description
      : cleanOptionalText(patch.description, 20_000),
    adminNotes: item.adminNotes,
    position: item.position,
    taxRate: item.taxRate,
    shippingWeightGrams: item.shippingWeightGrams ?? null,
    shippingLengthMm: item.shippingLengthMm ?? null,
    shippingWidthMm: item.shippingWidthMm ?? null,
    shippingHeightMm: item.shippingHeightMm ?? null,
    appearanceOverride: mergePresentationAppearanceOverride(
      item,
      patch.appearanceOverride,
      patch.specificationLabels
    ),
    defaultVariantId: item.defaultVariantId,
    optionAxes: item.optionAxes,
    variants: item.variants.map((variant) => {
      const variantPatch = variant.id
        ? variantPatches.get(variant.id)
        : undefined;
      const patchedVariant = applyVariantPresentationPatch(variant, variantPatch);
      return {
        ...patchedVariant,
        imageAssignments: patch.media === undefined
          ? variant.imageAssignments
          : (variant.imageAssignments ?? []).flatMap((originalIndex) => {
              const mediaId = originalGallery[originalIndex]?.id;
              const nextIndex = typeof mediaId === 'number'
                ? nextGalleryIndexById.get(mediaId)
                : undefined;
              return nextIndex === undefined ? [] : [nextIndex];
            })
      };
    }),
    quantityDiscounts: item.quantityDiscounts,
    media: nextMedia
  };
}

export async function PATCH(
  request: Request,
  props: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug: encodedSlug } = await props.params;
    const slug = decodeURIComponent(encodedSlug ?? '').trim();
    if (!slug) {
      return NextResponse.json({ message: 'Neveljaven artikel.' }, { status: 400 });
    }

    const parsed = await readRequiredJsonRecord(request);
    if (!parsed.ok) return parsed.response;
    const patch = parsed.body as Partial<CatalogItemPresentationPatch>;
    if (
      typeof patch.expectedUpdatedAt !== 'string'
      || !patch.expectedUpdatedAt.trim()
      || Number.isNaN(Date.parse(patch.expectedUpdatedAt))
    ) {
      return NextResponse.json(
        { message: 'Manjka različica podatkov artikla.' },
        { status: 400 }
      );
    }
    const expectedUpdatedAt = new Date(patch.expectedUpdatedAt).toISOString();

    const before = await fetchCatalogItemEditorBySlug(slug);
    if (!before) {
      return NextResponse.json({ message: 'Artikel ni bil najden.' }, { status: 404 });
    }
    if (before.status === 'deleted') {
      return NextResponse.json(
        { message: 'Izbrisanega artikla ni mogoče urejati.' },
        { status: 409 }
      );
    }
    if (before.updatedAt !== expectedUpdatedAt) {
      return NextResponse.json(
        {
          message: 'Artikel je bil medtem spremenjen drugje. Osvežite predogled in ponovno uporabite spremembe.',
          item: before
        },
        { status: 409 }
      );
    }
    if (patch.media !== undefined && !Array.isArray(patch.media)) {
      return NextResponse.json({ message: 'Mediji niso veljavni.' }, { status: 400 });
    }
    const variantPatchesResult = validateAndNormalizeVariantPresentationPatches(
      patch.variantSpecifications,
      before
    );
    if (!variantPatchesResult.ok) {
      return NextResponse.json(
        { message: variantPatchesResult.message },
        { status: 400 }
      );
    }
    const appearanceOverrideError = validateAppearanceOverridePatch(
      patch.appearanceOverride
    );
    if (appearanceOverrideError) {
      return NextResponse.json(
        { message: appearanceOverrideError },
        { status: 400 }
      );
    }
    const specificationLabelsResult = validateAndNormalizeCatalogSpecificationLabels(
      patch.specificationLabels
    );
    if (!specificationLabelsResult.ok) {
      return NextResponse.json(
        { message: specificationLabelsResult.message },
        { status: 400 }
      );
    }

    const validatedPatch: CatalogItemPresentationPatch = {
      ...(patch as CatalogItemPresentationPatch),
      expectedUpdatedAt,
      ...(patch.specificationLabels !== undefined
        ? { specificationLabels: specificationLabelsResult.value }
        : {}),
      ...(variantPatchesResult.value !== undefined
        ? { variantSpecifications: variantPatchesResult.value }
        : {})
    };
    const payload = toEditorPayload(before, validatedPatch);
    await upsertCatalogItem(payload);
    const after = await fetchCatalogItemEditorBySlug(String(before.id));
    if (!after) throw new Error('Shranjeni artikel ni bil najden.');

    const diff = computeCatalogItemAuditDiff(
      before as unknown as Record<string, unknown>,
      after as unknown as Record<string, unknown>
    );
    if (diffHasEntries(diff)) {
      await insertAuditEventForRequest(request, {
        entityType: 'item',
        entityId: after.slug,
        entityLabel: after.itemName,
        action: 'updated',
        diff,
        metadata: {
          source: 'admin_product_appearance',
          changed_field_count: countAuditChangedFields(diff)
        }
      });
    }

    return NextResponse.json<CatalogItemPresentationSaveResponse>({ item: after });
  } catch (error) {
    if (error instanceof CatalogItemConcurrencyConflictError) {
      const item = await fetchCatalogItemEditorBySlug(String(error.itemId)).catch(() => null);
      return NextResponse.json(
        { message: error.message, ...(item ? { item } : {}) },
        { status: error.statusCode }
      );
    }
    if (error instanceof CatalogItemIdentityConflictError) {
      return NextResponse.json(
        { message: error.message, conflicts: error.conflicts },
        { status: error.statusCode }
      );
    }
    if (error instanceof CatalogItemValidationError) {
      return NextResponse.json(
        { message: error.message },
        { status: error.statusCode }
      );
    }
    return NextResponse.json(
      {
        message: error instanceof Error
          ? error.message
          : 'Shranjevanje vsebine artikla ni uspelo.'
      },
      { status: 500 }
    );
  }
}
