import { NextResponse } from 'next/server';
import { deleteCatalogItemBySlug, fetchCatalogItemEditorBySlug } from '@/shared/server/catalogItems';
import { insertAuditEventForRequest } from '@/shared/server/audit';

export async function GET(_request: Request, props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
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

export async function DELETE(request: Request, props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  try {
    const slug = decodeURIComponent(params.slug ?? '').trim();
    if (!slug) return NextResponse.json({ message: 'Neveljaven slug.' }, { status: 400 });

    const before = await fetchCatalogItemEditorBySlug(slug);
    const removed = await deleteCatalogItemBySlug(slug);
    if (!removed) return NextResponse.json({ message: 'Artikel ni bil najden.' }, { status: 404 });
    await insertAuditEventForRequest(request, {
      entityType: 'item',
      entityId: String(before?.slug ?? slug),
      entityLabel: before?.itemName ?? slug,
      action: 'archived',
      diff: {
        status: {
          label: 'Status',
          before: before?.status ?? 'aktiven',
          after: 'arhivirano'
        }
      },
      metadata: {
        slug,
        product_type: before?.productType ?? null,
        deleted_from_catalog: true
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Napaka na strežniku.' }, { status: 500 });
  }
}
