import { NextResponse } from 'next/server';
import {
  CatalogItemIdentityConflictError,
  quickPatchCatalogItemByIdentifier,
  type CatalogItemQuickPatch
} from '@/shared/server/catalogItems';

type ItemQuickSaveRequest = {
  itemIdentifier?: string;
  patch?: CatalogItemQuickPatch;
};

export async function PATCH(request: Request) {
  try {
    const body = (await request.json()) as ItemQuickSaveRequest;
    const itemIdentifier = (body.itemIdentifier ?? '').trim();
    if (!itemIdentifier) {
      return NextResponse.json({ message: 'Item identifikator je obvezen.' }, { status: 400 });
    }
    if (!body.patch || Object.keys(body.patch).length === 0) {
      return NextResponse.json({ message: 'Patch payload je obvezen.' }, { status: 400 });
    }

    const item = await quickPatchCatalogItemByIdentifier(itemIdentifier, body.patch);
    if (!item) {
      return NextResponse.json({ message: 'Artikel ni bil najden.' }, { status: 404 });
    }

    return NextResponse.json({ item });
  } catch (error) {
    if (error instanceof CatalogItemIdentityConflictError) {
      return NextResponse.json({ message: error.message, conflicts: error.conflicts }, { status: error.statusCode });
    }
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Napaka na strežniku.' }, { status: 500 });
  }
}
