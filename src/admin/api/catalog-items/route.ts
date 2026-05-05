import { NextResponse } from 'next/server';
import { fetchCatalogItemSeeds, type CatalogItemSeedRow } from '@/shared/server/catalogItems';
import { instrumentCatalogLoader } from '@/shared/server/catalogDiagnostics';
import { getDatabaseUrl, isDatabaseUnavailableError } from '@/shared/server/db';

type CatalogChoice = {
  sku: string;
  name: string;
  unit: string;
  unitPrice: number;
  display_order: number | null;
};

const DEFAULT_UNIT = 'kos';

const isFiniteMeasurement = (value: number | null | undefined): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const formatMeasurement = (value: number) => `${Number(value)}`;

const buildChoiceName = (row: CatalogItemSeedRow) => {
  const baseName = row.item_name.trim();
  if (row.variant_count <= 1) return baseName;

  const dimensions = [row.thickness, row.length, row.width]
    .filter(isFiniteMeasurement)
    .map(formatMeasurement);

  if (dimensions.length > 0) return `${baseName} ${dimensions.join(' × ')} mm`;
  if (isFiniteMeasurement(row.weight)) return `${baseName} ${formatMeasurement(row.weight)} g`;

  const variantName = row.variant_name.trim();
  return variantName ? `${baseName} ${variantName}` : baseName;
};

async function collectCatalogChoices(): Promise<CatalogChoice[]> {
  return instrumentCatalogLoader('adminCatalogItemsRoute', '/api/admin/catalog-items', async () => {
    const rows = await fetchCatalogItemSeeds();
    return rows
      .map((row) => ({
        sku: row.sku,
        name: buildChoiceName(row),
        unit: DEFAULT_UNIT,
        unitPrice: row.price,
        display_order: row.item_position
      }))
      .sort((leftItem, rightItem) => leftItem.name.localeCompare(rightItem.name, 'sl', { sensitivity: 'base' }));
  });
}

export async function GET() {
  if (!getDatabaseUrl()) {
    return NextResponse.json({
      items: [],
      warning: 'Povezava z bazo ni nastavljena. Prikazan je prazen katalog artiklov.'
    });
  }

  try {
    const items = await collectCatalogChoices();
    return NextResponse.json({ items });
  } catch (error) {
    if (isDatabaseUnavailableError(error)) {
      console.error('Failed to load /api/admin/catalog-items data', error);
      return NextResponse.json({
        items: [],
        warning: 'Podatkov trenutno ni mogoče naložiti. Prikazan je prazen katalog artiklov, dokler povezava z bazo ne deluje.'
      });
    }

    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Napaka na strezniku.' },
      { status: 500 }
    );
  }
}
