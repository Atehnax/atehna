import { NextResponse } from 'next/server';
import {
  getCatalogCategories,
  getCatalogCategoryItemPrice,
  getCatalogCategoryItemSku,
  getCatalogItemPrice,
  getCatalogItemSku
} from '@/lib/catalog';

type CatalogChoice = {
  sku: string;
  name: string;
  unit: string;
  unitPrice: number;
};

const DEFAULT_UNIT = 'kos';

function collectCatalogChoices(): CatalogChoice[] {
  const items: CatalogChoice[] = [];

  for (const category of getCatalogCategories()) {
    for (const item of category.items ?? []) {
      items.push({
        sku: getCatalogCategoryItemSku(category.slug, item.slug),
        name: item.name,
        unit: DEFAULT_UNIT,
        unitPrice: item.price ?? getCatalogCategoryItemPrice(category.slug, item.slug)
      });
    }

    for (const subcategory of category.subcategories) {
      for (const item of subcategory.items) {
        items.push({
          sku: getCatalogItemSku(category.slug, subcategory.slug, item.slug),
          name: item.name,
          unit: DEFAULT_UNIT,
          unitPrice: item.price ?? getCatalogItemPrice(category.slug, subcategory.slug, item.slug)
        });
      }
    }
  }

  return items.sort((leftItem, rightItem) =>
    leftItem.name.localeCompare(rightItem.name, 'sl', { sensitivity: 'base' })
  );
}

export async function GET() {
  try {
    const items = collectCatalogChoices();
    return NextResponse.json({ items });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Napaka na strežniku.' },
      { status: 500 }
    );
  }
}
