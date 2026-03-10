import { NextResponse } from 'next/server';
import type { CatalogCategory } from '@/lib/catalog';
import { readCatalogFile, writeCatalogFile } from '@/lib/server/catalogAdmin';

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
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Napaka pri shranjevanju.' }, { status: 500 });
  }
}
