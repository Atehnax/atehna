import { NextResponse } from 'next/server';
import {
  deleteCatalogItemBySlug,
  fetchCatalogItemEditorBySlug,
  purgeCatalogItemBySlug,
  restoreCatalogItemBySlug
} from '@/shared/server/catalogItems';
import { insertAuditEventForRequest } from '@/shared/server/audit';
import { readRequiredJsonRecord } from '@/shared/server/requestJson';

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
    const shouldPurge = new URL(request.url).searchParams.get('purge') === 'true';
    if (shouldPurge) {
      const result = await purgeCatalogItemBySlug(slug);
      if (!result.purged) {
        if (result.reason === 'not_found') {
          return NextResponse.json({ message: 'Artikel ni bil najden.' }, { status: 404 });
        }
        if (result.reason === 'not_deleted') {
          return NextResponse.json(
            { message: 'Pred trajnim izbrisom mora biti artikel izbrisan in v 90-dnevni hrambi.' },
            { status: 409 }
          );
        }
        return NextResponse.json(
          {
            message: '90-dnevno obdobje hrambe še ni poteklo.',
            purgeAfter: result.purgeAfter
          },
          { status: 409 }
        );
      }
      await insertAuditEventForRequest(request, {
        entityType: 'item',
        entityId: String(before?.slug ?? slug),
        entityLabel: before?.itemName ?? slug,
        action: 'deleted',
        diff: {},
        metadata: {
          slug,
          product_type: before?.productType ?? null,
          purged_after_retention: true
        }
      });
      return NextResponse.json({ success: true, purged: true });
    }

    const removed = await deleteCatalogItemBySlug(slug);
    if (!removed) return NextResponse.json({ message: 'Artikel ni bil najden.' }, { status: 404 });
    await insertAuditEventForRequest(request, {
      entityType: 'item',
      entityId: String(before?.slug ?? slug),
      entityLabel: before?.itemName ?? slug,
      action: 'deleted',
      diff: {
        status: {
          label: 'Status',
          before: before?.status ?? 'aktiven',
          after: 'izbrisano'
        }
      },
      metadata: {
        slug,
        product_type: before?.productType ?? null,
        soft_deleted: true,
        retention_days: 90
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Napaka na strežniku.' }, { status: 500 });
  }
}

export async function PATCH(request: Request, props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  try {
    const slug = decodeURIComponent(params.slug ?? '').trim();
    if (!slug) return NextResponse.json({ message: 'Neveljaven slug.' }, { status: 400 });
    const parsedBody = await readRequiredJsonRecord(request);
    if (!parsedBody.ok) return parsedBody.response;
    if (parsedBody.body.action !== 'restore') {
      return NextResponse.json({ message: 'Nepodprto dejanje.' }, { status: 400 });
    }

    const before = await fetchCatalogItemEditorBySlug(slug);
    if (!before) return NextResponse.json({ message: 'Artikel ni bil najden.' }, { status: 404 });
    const restored = await restoreCatalogItemBySlug(slug);
    if (!restored) {
      return NextResponse.json({ message: 'Artikel ni izbrisan ali pa je že obnovljen.' }, { status: 409 });
    }
    const after = await fetchCatalogItemEditorBySlug(slug);
    await insertAuditEventForRequest(request, {
      entityType: 'item',
      entityId: String(after?.slug ?? slug),
      entityLabel: after?.itemName ?? before.itemName,
      action: 'restored',
      diff: {
        status: {
          label: 'Status',
          before: 'izbrisano',
          after: after?.status ?? 'inactive'
        }
      },
      metadata: {
        slug,
        product_type: after?.productType ?? before.productType,
        restored_from_soft_delete: true
      }
    });
    return NextResponse.json({ success: true, item: after });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Napaka na strežniku.' }, { status: 500 });
  }
}
