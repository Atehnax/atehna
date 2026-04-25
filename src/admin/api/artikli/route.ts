import { NextResponse } from 'next/server';
import {
  CatalogItemIdentityConflictError,
  upsertCatalogItem,
  type CatalogItemEditorPayload
} from '@/shared/server/catalogItems';

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as CatalogItemEditorPayload;
    if (!payload?.itemName?.trim()) {
      return NextResponse.json({ message: 'Naziv artikla je obvezen.' }, { status: 400 });
    }
    if (!payload?.slug?.trim()) {
      return NextResponse.json({ message: 'URL (slug) je obvezen.' }, { status: 400 });
    }
    if (!Array.isArray(payload.variants) || payload.variants.length === 0) {
      return NextResponse.json({ message: 'Artikel mora imeti vsaj eno različico.' }, { status: 400 });
    }

    const saved = await upsertCatalogItem(payload);
    return NextResponse.json({ id: saved.id, slug: saved.slug });
  } catch (error) {
    if (error instanceof CatalogItemIdentityConflictError) {
      return NextResponse.json({ message: error.message, conflicts: error.conflicts }, { status: error.statusCode });
    }
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Napaka na strežniku.' }, { status: 500 });
  }
}
