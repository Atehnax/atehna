import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import type { CatalogCategory } from '@/commercial/catalog/catalog';
import { readCatalogFile, writeCatalogFile } from '@/shared/server/catalogAdmin';

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
    if (!Array.isArray(payload.categories)) {
      return NextResponse.json({ message: 'Neveljavni podatki.' }, { status: 400 });
    }

    await writeCatalogFile({ categories: payload.categories });
    revalidatePath('/products');
    revalidatePath('/products/[category]', 'page');
    revalidatePath('/products/[category]/[subcategory]', 'page');
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Napaka pri shranjevanju.' }, { status: 500 });
  }
}
