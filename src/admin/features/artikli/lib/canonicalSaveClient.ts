import type { CatalogItemEditorHydration, CatalogItemEditorPayload } from '@/shared/server/catalogItems';

export function toCatalogItemUpsertPayload(item: CatalogItemEditorHydration): CatalogItemEditorPayload {
  return {
    itemName: item.itemName,
    itemType: item.itemType,
    badge: item.badge,
    status: item.status,
    categoryPath: item.categoryPath,
    sku: item.sku,
    slug: item.slug,
    unit: item.unit,
    brand: item.brand,
    material: item.material,
    colour: item.colour,
    shape: item.shape,
    description: item.description,
    adminNotes: item.adminNotes,
    position: item.position,
    variants: item.variants.map((variant) => ({
      variantName: variant.variantName,
      length: variant.length,
      width: variant.width,
      thickness: variant.thickness,
      weight: variant.weight,
      errorTolerance: variant.errorTolerance,
      price: variant.price,
      discountPct: variant.discountPct,
      inventory: variant.inventory,
      minOrder: variant.minOrder,
      variantSku: variant.variantSku,
      unit: variant.unit,
      status: variant.status,
      badge: variant.badge,
      position: variant.position,
      imageAssignments: variant.imageAssignments
    })),
    media: item.media.map((media) => ({
      mediaKind: media.mediaKind,
      role: media.role,
      sourceKind: media.sourceKind,
      filename: media.filename,
      blobUrl: media.blobUrl,
      blobPathname: media.blobPathname,
      externalUrl: media.externalUrl,
      mimeType: media.mimeType,
      altText: media.altText,
      imageType: media.imageType,
      imageDimensions: media.imageDimensions,
      videoType: media.videoType,
      hidden: media.hidden,
      position: media.position,
      variantIndex: media.variantIndex
    }))
  };
}

export async function fetchCatalogItemEditorHydration(slug: string): Promise<CatalogItemEditorHydration> {
  const normalizedSlug = slug.trim();
  const readResponse = await fetch(`/api/admin/artikli/${encodeURIComponent(normalizedSlug)}`, { cache: 'no-store' });
  if (!readResponse.ok) {
    const body = (await readResponse.json().catch(() => ({}))) as { message?: string };
    throw new Error(body.message || 'Nalagam podatke artikla ni uspelo.');
  }
  return (await readResponse.json()) as CatalogItemEditorHydration;
}

export async function saveCatalogItemPayload(payload: CatalogItemEditorPayload): Promise<{ slug?: string; message?: string }> {
  const saveResponse = await fetch('/api/admin/artikli', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const body = (await saveResponse.json().catch(() => ({}))) as { slug?: string; message?: string };
  if (!saveResponse.ok) {
    throw new Error(body.message || 'Shranjevanje artikla ni uspelo.');
  }
  return body;
}

export async function updateCatalogItemBySlug(
  slug: string,
  mutate: (payload: CatalogItemEditorPayload, hydration: CatalogItemEditorHydration) => void
): Promise<void> {
  const hydration = await fetchCatalogItemEditorHydration(slug);
  const payload = toCatalogItemUpsertPayload(hydration);
  mutate(payload, hydration);
  await saveCatalogItemPayload(payload);
}
