import { NextResponse } from 'next/server';
import {
  CatalogItemIdentityConflictError,
  duplicateCatalogItemByIdentifier
} from '@/shared/server/catalogItems';

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as { itemIdentifier?: string };
    const itemIdentifier = typeof body.itemIdentifier === 'string' ? body.itemIdentifier.trim() : '';
    if (!itemIdentifier) {
      return NextResponse.json({ message: 'Neveljaven identifikator artikla.' }, { status: 400 });
    }

    const item = await duplicateCatalogItemByIdentifier(itemIdentifier);
    if (!item) return NextResponse.json({ message: 'Artikel ni bil najden.' }, { status: 404 });

    return NextResponse.json({ item });
  } catch (error) {
    if (error instanceof CatalogItemIdentityConflictError) {
      return NextResponse.json({ message: error.message, conflicts: error.conflicts }, { status: error.statusCode });
    }
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Kopiranje artikla ni uspelo.' }, { status: 500 });
  }
}
