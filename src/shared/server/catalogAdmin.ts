import fs from 'fs/promises';
import path from 'path';
import type { CatalogCategory } from '@/commercial/catalog/catalog';

type CatalogData = { categories: CatalogCategory[] };

const catalogPath = path.join(process.cwd(), 'src/commercial/content/data/catalog.json');

export async function readCatalogFile(): Promise<CatalogData> {
  const raw = await fs.readFile(catalogPath, 'utf8');
  const parsed = JSON.parse(raw) as unknown;
  return normalizeCatalogData(parsed);
}

export async function writeCatalogFile(data: CatalogData): Promise<void> {
  const normalized = normalizeCatalogData(data);
  const tempPath = `${catalogPath}.tmp`;

  await fs.writeFile(tempPath, `${JSON.stringify(normalized, null, 2)}\n`, 'utf8');
  await fs.rename(tempPath, catalogPath);
}

export function normalizeCatalogData(input: unknown): CatalogData {
  const categoriesSource =
    typeof input === 'object' && input !== null && Array.isArray((input as { categories?: unknown }).categories)
      ? (input as { categories: unknown[] }).categories
      : [];

  const categories = categoriesSource
    .map((rawCategory) => normalizeCategory(rawCategory))
    .filter((entry): entry is CatalogCategory => entry !== null);

  return { categories };
}

function normalizeCategory(raw: unknown): CatalogCategory | null {
  if (typeof raw !== 'object' || raw === null) return null;

  const category = raw as Partial<CatalogCategory>;
  const slug = typeof category.slug === 'string' ? category.slug.trim() : '';
  if (!slug) return null;

  const subcategoriesSource = Array.isArray(category.subcategories) ? category.subcategories : [];

  return {
    slug,
    title: typeof category.title === 'string' ? category.title : slug,
    summary: typeof category.summary === 'string' ? category.summary : '',
    description: typeof category.description === 'string' ? category.description : '',
    image: typeof category.image === 'string' ? category.image : '',
    adminNotes: typeof category.adminNotes === 'string' ? category.adminNotes : undefined,
    bannerImage: typeof category.bannerImage === 'string' ? category.bannerImage : undefined,
    subcategories: subcategoriesSource
      .map((rawSubcategory) => normalizeSubcategory(rawSubcategory))
      .filter((entry): entry is NonNullable<typeof entry> => entry !== null),
    items: Array.isArray(category.items) ? category.items : []
  };
}

function normalizeSubcategory(raw: unknown): CatalogCategory['subcategories'][number] | null {
  if (typeof raw !== 'object' || raw === null) return null;

  const subcategory = raw as Partial<CatalogCategory['subcategories'][number]>;
  const slug = typeof subcategory.slug === 'string' ? subcategory.slug.trim() : '';
  if (!slug) return null;

  return {
    slug,
    title: typeof subcategory.title === 'string' ? subcategory.title : slug,
    description: typeof subcategory.description === 'string' ? subcategory.description : '',
    adminNotes: typeof subcategory.adminNotes === 'string' ? subcategory.adminNotes : undefined,
    image: typeof subcategory.image === 'string' ? subcategory.image : '',
    items: Array.isArray(subcategory.items) ? subcategory.items : []
  };
}
