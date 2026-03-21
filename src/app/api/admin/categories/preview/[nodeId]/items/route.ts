import { NextResponse } from 'next/server';
import { getAdminPreviewLeafItemsFromDatabase } from '@/shared/server/catalogCategories';

export async function GET(_request: Request, { params }: { params: { nodeId: string } }) {
  try {
    const payload = await getAdminPreviewLeafItemsFromDatabase(params.nodeId);
    if (!payload) {
      return NextResponse.json({ message: 'Vozlišče ni bilo najdeno.' }, { status: 404 });
    }
    return NextResponse.json(payload);
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Napaka pri nalaganju izdelkov.' }, { status: 500 });
  }
}
