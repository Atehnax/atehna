function decodeRouteSegment(value: string): string {
  const trimmed = value.trim();

  try {
    return decodeURIComponent(trimmed);
  } catch {
    return trimmed;
  }
}

export function toPublicCatalogSlug(slug: string): string {
  const normalized = decodeRouteSegment(slug)
    .toLocaleLowerCase('sl')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  return normalized || decodeRouteSegment(slug);
}

export function catalogCategoryHref(categorySlug: string): string {
  return `/products/${toPublicCatalogSlug(categorySlug)}`;
}

export function catalogSubcategoryHref(categorySlug: string, subcategorySlug: string): string {
  return `/products/${toPublicCatalogSlug(categorySlug)}/${toPublicCatalogSlug(subcategorySlug)}`;
}

export function catalogCategoryItemHref(categorySlug: string, itemSlug: string): string {
  return `/products/${toPublicCatalogSlug(categorySlug)}/items/${toPublicCatalogSlug(itemSlug)}`;
}

export function catalogSubcategoryItemHref(categorySlug: string, subcategorySlug: string, itemSlug: string): string {
  return `/products/${toPublicCatalogSlug(categorySlug)}/${toPublicCatalogSlug(subcategorySlug)}/${toPublicCatalogSlug(itemSlug)}`;
}
