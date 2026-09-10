/** Human-readable SKU parts: Slovenian names, ASCII letters, decimal P. */
export function catalogSkuPart(value: string): string {
  return value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toUpperCase()
    .replace(/(\d)[,.](?=\d)/g, '$1P').replace(/[^A-Z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export function buildCatalogBaseSku(categoryPath: readonly string[], itemName: string): string {
  return [...categoryPath, itemName].map(part => catalogSkuPart(part).replace(/-/g, '').slice(0, 3)).filter(Boolean).join('-');
}

export function buildCatalogDimensionSkuSuffix(dimensions: { thickness?: number | null; length?: number | null; width?: number | null }): string {
  return [dimensions.thickness, dimensions.length, dimensions.width]
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value) && value > 0)
    .map(value => String(value).replace('.', 'P')).join('x');
}
