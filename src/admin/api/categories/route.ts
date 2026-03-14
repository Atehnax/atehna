import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import type { CatalogCategory } from '@/commercial/catalog/catalog';
import { normalizeCatalogData, readCatalogFile, writeCatalogFile } from '@/shared/server/catalogAdmin';

export async function GET() {
  try {
    const catalog = await readCatalogFile();
    return NextResponse.json(catalog);
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Napaka pri nalaganju.' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const payload = (await request.json()) as { categories?: CatalogCategory[] };
    const normalized = normalizeCatalogData(payload);

    if (!Array.isArray(payload.categories)) {
      return NextResponse.json({ message: 'Neveljavni podatki.' }, { status: 400 });
    }

    if (!isValidCategoryTree(normalized.categories)) {
      return NextResponse.json({ message: 'Neveljavna struktura kategorij.' }, { status: 400 });
    }

    await writeCatalogFile(normalized);
    revalidatePath('/');
    revalidatePath('/products');
    revalidatePath('/admin/kategorije');
    revalidatePath('/admin/kategorije/miller-view');
    revalidatePath('/admin/artikli');
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Napaka pri shranjevanju.' }, { status: 500 });
  }
}


function isValidCategoryTree(categories: CatalogCategory[]): boolean {
  const categorySlugs = new Set<string>();

  for (const category of categories) {
    const normalizedCategorySlug = category.slug.trim();
    if (!normalizedCategorySlug || categorySlugs.has(normalizedCategorySlug)) return false;
    categorySlugs.add(normalizedCategorySlug);

    const subcategorySlugs = new Set<string>();
    for (const subcategory of category.subcategories ?? []) {
      const normalizedSubcategorySlug = subcategory.slug.trim();
      if (!normalizedSubcategorySlug || subcategorySlugs.has(normalizedSubcategorySlug)) return false;
      if (normalizedSubcategorySlug === normalizedCategorySlug) return false;
      subcategorySlugs.add(normalizedSubcategorySlug);
    }
  }

  return true;
}
