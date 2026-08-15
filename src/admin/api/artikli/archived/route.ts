import { NextResponse } from 'next/server';
import { fetchArchivedCatalogItems } from '@/shared/server/catalogItems';

export async function GET() {
  try {
    return NextResponse.json({ items: await fetchArchivedCatalogItems() });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Izbrisanih artiklov ni bilo mogoče naložiti.' },
      { status: 500 }
    );
  }
}
