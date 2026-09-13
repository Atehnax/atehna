import type { StorefrontProductMedia } from '@/commercial/features/products/storefrontProduct';

export const isProductDimensionDiagram = (media: StorefrontProductMedia) =>
  media.kind === 'image' &&
  (media.imageType === 'dimension-diagram' || media.imageType === 'dimension-overview');

const isIndividualDiagram = (media: StorefrontProductMedia) =>
  media.kind === 'image' && media.imageType === 'dimension-diagram';

/** Variant-specific photos lead; individual sketches require an explicit matching assignment. */
export function getVisibleProductMedia(
  media: readonly StorefrontProductMedia[],
  selectedVariantId: string | null
): StorefrontProductMedia[] {
  const variantMedia = selectedVariantId
    ? media.filter((entry) => entry.variantIds.includes(selectedVariantId))
    : [];
  const parentMedia = media.filter(
    (entry) => entry.variantIds.length === 0 && !isIndividualDiagram(entry)
  );
  const candidates = [...variantMedia, ...parentMedia];
  const hasIndividualDiagram = candidates.some(isIndividualDiagram);
  const seen = new Set<string>();
  const matchingMedia = candidates.filter((entry) => {
    // A legacy overview is only a fallback until the selected variant has its own sketch.
    if (hasIndividualDiagram && entry.imageType === 'dimension-overview') return false;
    const key = entry.kind + ':' + entry.url;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return [
    ...matchingMedia.filter((entry) => !isProductDimensionDiagram(entry)),
    ...matchingMedia.filter(isProductDimensionDiagram)
  ];
}

/** Resolve during render so both the gallery and an open preview change without a photo flash. */
export function resolveProductGallerySelection(
  media: readonly StorefrontProductMedia[],
  previous: StorefrontProductMedia | null
): StorefrontProductMedia | null {
  const retained = previous && media.find((entry) => entry.id === previous.id);
  if (retained) return retained;
  if (previous && isProductDimensionDiagram(previous)) {
    const nextDiagram = media.find(isIndividualDiagram) ?? media.find(isProductDimensionDiagram);
    if (nextDiagram) return nextDiagram;
  }
  return media[0] ?? null;
}
