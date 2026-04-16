import { NextResponse } from 'next/server';
import { deleteCatalogItemBySlug, fetchCatalogItemEditorBySlug } from '@/shared/server/catalogItems';

export async function GET(_request: Request, { params }: { params: { slug: string } }) {
  try {
    const slug = decodeURIComponent(params.slug ?? '').trim();
    if (!slug) return NextResponse.json({ message: 'Neveljaven slug.' }, { status: 400 });

    const item = await fetchCatalogItemEditorBySlug(slug);
    if (!item) return NextResponse.json({ message: 'Artikel ni bil najden.' }, { status: 404 });
    return NextResponse.json(item);
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Napaka na strežniku.' }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: { params: { slug: string } }) {
  try {
    const slug = decodeURIComponent(params.slug ?? '').trim();
    if (!slug) return NextResponse.json({ message: 'Neveljaven slug.' }, { status: 400 });

    const removed = await deleteCatalogItemBySlug(slug);
    if (!removed) return NextResponse.json({ message: 'Artikel ni bil najden.' }, { status: 404 });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Napaka na strežniku.' }, { status: 500 });
  }
}
