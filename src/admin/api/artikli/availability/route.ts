import { NextResponse } from 'next/server';
import {
  getCatalogItemIdentityAvailability,
  type CatalogItemIdentityField
} from '@/shared/server/catalogItems';

const IDENTITY_FIELDS = new Set<CatalogItemIdentityField>(['name', 'sku', 'slug']);

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const field = searchParams.get('field') as CatalogItemIdentityField | null;
    const value = searchParams.get('value') ?? '';
    const itemIdParam = searchParams.get('itemId');
    const variantIdParam = searchParams.get('variantId');
    const itemId = itemIdParam ? Number(itemIdParam) : null;
    const variantId = variantIdParam ? Number(variantIdParam) : null;

    if (!field || !IDENTITY_FIELDS.has(field)) {
      return NextResponse.json({ message: 'Neveljavno polje.' }, { status: 400 });
    }
    if (itemIdParam && !Number.isFinite(itemId)) {
      return NextResponse.json({ message: 'Neveljaven ID artikla.' }, { status: 400 });
    }
    if (variantIdParam && !Number.isFinite(variantId)) {
      return NextResponse.json({ message: 'Neveljaven ID različice.' }, { status: 400 });
    }

    const availability = await getCatalogItemIdentityAvailability({
      field,
      value,
      itemId,
      variantId
    });
    return NextResponse.json(availability);
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Napaka na strežniku.' },
      { status: 500 }
    );
  }
}
