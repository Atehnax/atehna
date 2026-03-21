import { NextResponse } from 'next/server';
import { getAdminPreviewPayloadFromDatabase, updateCatalogNode } from '@/shared/server/catalogCategories';

export async function GET() {
  try {
    const payload = await getAdminPreviewPayloadFromDatabase();
    return NextResponse.json(payload);
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Napaka pri nalaganju predogleda.' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const payload = (await request.json()) as {
      id?: string;
      changes?: {
        title?: string;
        description?: string;
        image?: string;
        status?: 'active' | 'inactive';
        position?: number;
        parentId?: string | null;
      };
    };

    if (!payload.id || !payload.changes || Object.keys(payload.changes).length === 0) {
      return NextResponse.json({ message: 'Neveljavna zahteva.' }, { status: 400 });
    }

    const updated = await updateCatalogNode(payload.id, payload.changes);
    if (!updated) {
      return NextResponse.json({ message: 'Kategorija ni bila najdena.' }, { status: 404 });
    }

    return NextResponse.json({ ok: true, node: updated });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Napaka pri shranjevanju.' }, { status: 500 });
  }
}
