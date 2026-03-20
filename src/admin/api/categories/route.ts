import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import type { CatalogCategory } from '@/commercial/catalog/catalog';
import { normalizeCatalogData } from '@/shared/server/catalogAdmin';
import { CATALOG_ADMIN_TAG, CATALOG_PUBLIC_TAG, CATALOG_REVALIDATE_PATHS, getCatalogDataFromDatabase, replaceCategoryTree } from '@/shared/server/catalogCategories';
import { recordCatalogInvalidation } from '@/shared/server/catalogDiagnostics';

export async function GET() {
  try {
    const catalog = await getCatalogDataFromDatabase({ includeInactive: true, includeStatuses: true });
    return NextResponse.json(catalog);
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Napaka pri nalaganju.' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const payload = (await request.json()) as { categories?: CatalogCategory[]; statuses?: Record<string, 'active' | 'inactive'> };
    const normalized = normalizeCatalogData(payload);

    if (!Array.isArray(payload.categories)) {
      return NextResponse.json({ message: 'Neveljavni podatki.' }, { status: 400 });
    }

    if (!isValidCategoryTree(normalized.categories)) {
      return NextResponse.json({ message: 'Neveljavna struktura kategorij.' }, { status: 400 });
    }

    await replaceCategoryTree(normalized, payload.statuses ?? {});

    for (const target of CATALOG_REVALIDATE_PATHS) {
      revalidatePath(target.path, target.type);
    }

    recordCatalogInvalidation({
      context: '/api/admin/categories:save',
      tags: [CATALOG_PUBLIC_TAG, CATALOG_ADMIN_TAG],
      revalidatedPaths: CATALOG_REVALIDATE_PATHS.length
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Napaka pri shranjevanju.' }, { status: 500 });
  }
}

function isValidCategoryTree(categories: CatalogCategory[]): boolean {
  const categorySlugs = new Set<string>();
  const categoryIds = new Set<string>();
  const subcategoryIds = new Set<string>();

  for (const category of categories) {
    const normalizedCategorySlug = category.slug.trim();
    const normalizedCategoryId = category.id.trim();

    if (!normalizedCategorySlug || categorySlugs.has(normalizedCategorySlug)) return false;
    if (!normalizedCategoryId || categoryIds.has(normalizedCategoryId)) return false;

    categorySlugs.add(normalizedCategorySlug);
    categoryIds.add(normalizedCategoryId);

    const subcategorySlugs = new Set<string>();
    for (const subcategory of category.subcategories ?? []) {
      const normalizedSubcategorySlug = subcategory.slug.trim();
      const normalizedSubcategoryId = subcategory.id.trim();

      if (!normalizedSubcategorySlug || subcategorySlugs.has(normalizedSubcategorySlug)) return false;
      if (!normalizedSubcategoryId || subcategoryIds.has(normalizedSubcategoryId)) return false;
      if (normalizedSubcategorySlug === normalizedCategorySlug) return false;

      subcategorySlugs.add(normalizedSubcategorySlug);
      subcategoryIds.add(normalizedSubcategoryId);
    }
  }

  return true;
}
