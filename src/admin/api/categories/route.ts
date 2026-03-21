import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import type { CatalogCategory } from '@/commercial/catalog/catalog';
import { normalizeCatalogData } from '@/shared/server/catalogAdmin';
import { CATALOG_ADMIN_TAG, CATALOG_PUBLIC_TAG, CATALOG_REVALIDATE_PATHS, getCatalogDataFromDatabase, getCatalogPreviewDataFromDatabase, patchCategoryTree, replaceCategoryTree } from '@/shared/server/catalogCategories';
import { recordCatalogInvalidation } from '@/shared/server/catalogDiagnostics';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const view = url.searchParams.get('view');
    const catalog = view === 'preview'
      ? await getCatalogPreviewDataFromDatabase({ includeInactive: true, includeStatuses: true, diagnosticsContext: '/api/admin/categories?view=preview' })
      : await getCatalogDataFromDatabase({ includeInactive: true, includeStatuses: true });
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

    return NextResponse.json({ ok: true, categories: normalized.categories, statuses: payload.statuses ?? {} });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Napaka pri shranjevanju.' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const payload = (await request.json()) as {
      upserts?: Array<{
        id: string;
        parentId: string | null;
        slug: string;
        title: string;
        summary: string;
        description: string;
        image: string;
        adminNotes?: string | null;
        bannerImage?: string | null;
        items?: unknown;
        position: number;
        status: 'active' | 'inactive';
      }>;
      deleteIds?: string[];
    };

    const upserts = Array.isArray(payload.upserts)
      ? payload.upserts.map((entry) => ({
          ...entry,
          items: Array.isArray(entry.items) ? entry.items : []
        }))
      : [];
    const deleteIds = Array.isArray(payload.deleteIds) ? payload.deleteIds.filter((entry): entry is string => typeof entry === 'string' && entry.length > 0) : [];

    await patchCategoryTree({ upserts, deleteIds });

    for (const target of CATALOG_REVALIDATE_PATHS) {
      revalidatePath(target.path, target.type);
    }

    recordCatalogInvalidation({
      context: '/api/admin/categories:patch',
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
