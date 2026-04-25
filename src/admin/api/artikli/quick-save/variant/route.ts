import { NextResponse } from 'next/server';
import {
  CatalogItemIdentityConflictError,
  quickPatchCatalogVariantByIdentifier,
  type CatalogVariantQuickPatch
} from '@/shared/server/catalogItems';

type VariantQuickSaveRequest = {
  itemIdentifier?: string;
  variantId?: number;
  patch?: CatalogVariantQuickPatch;
};

export async function PATCH(request: Request) {
  try {
    const body = (await request.json()) as VariantQuickSaveRequest;
    const itemIdentifier = (body.itemIdentifier ?? '').trim();
    const variantId = Number(body.variantId);
    if (!itemIdentifier) {
      return NextResponse.json({ message: 'Item identifikator je obvezen.' }, { status: 400 });
    }
    if (!Number.isFinite(variantId)) {
      return NextResponse.json({ message: 'Variant identifikator je obvezen.' }, { status: 400 });
    }
    if (!body.patch || Object.keys(body.patch).length === 0) {
      return NextResponse.json({ message: 'Patch payload je obvezen.' }, { status: 400 });
    }

    const updated = await quickPatchCatalogVariantByIdentifier(itemIdentifier, variantId, body.patch);
    if (!updated) {
      return NextResponse.json({ message: 'Različica ni bila najdena.' }, { status: 404 });
    }

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof CatalogItemIdentityConflictError) {
      return NextResponse.json({ message: error.message, conflicts: error.conflicts }, { status: error.statusCode });
    }
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Napaka na strežniku.' }, { status: 500 });
  }
}
