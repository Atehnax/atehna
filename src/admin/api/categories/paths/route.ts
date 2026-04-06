import { NextResponse } from 'next/server';
import { getCatalogPreviewDataFromDatabase } from '@/shared/server/catalogCategories';

type CategoryNode = {
  title?: string;
  slug?: string;
  subcategories?: CategoryNode[];
};

function collectCategoryPaths(nodes: CategoryNode[], parents: string[] = [], target: string[] = []) {
  nodes.forEach((node) => {
    const title = (node.title ?? '').trim();
    if (!title) return;

    const path = [...parents, title];
    target.push(path.join(' / '));

    const slug = (node.slug ?? '').trim();
    if (slug && slug.toLowerCase() !== title.toLowerCase()) {
      target.push([...parents, slug].join(' / '));
    }

    const children = Array.isArray(node.subcategories) ? node.subcategories : [];
    if (children.length > 0) {
      collectCategoryPaths(children, path, target);
    }
  });

  return target;
}

export async function GET() {
  try {
    const catalog = await getCatalogPreviewDataFromDatabase({
      includeInactive: true,
      includeStatuses: true,
      diagnosticsContext: '/api/admin/categories/paths'
    });

    const categories = Array.isArray((catalog as { categories?: unknown }).categories)
      ? ((catalog as { categories: CategoryNode[] }).categories)
      : [];
    const paths = Array.from(new Set(collectCategoryPaths(categories)));
    return NextResponse.json({ paths });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Napaka pri nalaganju poti kategorij.' },
      { status: 500 }
    );
  }
}
