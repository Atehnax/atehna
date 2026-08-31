export type CatalogCategoryActivityRow = {
  id: unknown;
  ancestors_active: unknown;
};

export function catalogCategoryId(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const normalized = String(value).trim();
  return normalized || null;
}

export function indexCatalogCategoryActivity(
  rows: CatalogCategoryActivityRow[]
): Map<string, boolean> {
  const index = new Map<string, boolean>();
  for (const row of rows) {
    const id = catalogCategoryId(row.id);
    if (id) index.set(id, row.ancestors_active === true);
  }
  return index;
}
