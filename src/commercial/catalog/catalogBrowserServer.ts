import 'server-only';

import type { Metadata } from 'next';
import { cache } from 'react';
import type {
  RecursiveCatalogCategory,
  RecursiveCatalogSubcategory
} from '@/shared/domain/catalog/catalogTypes';
import { getCatalogDataFromDatabase } from '@/shared/server/catalogCategories';
import { hasDatabaseConnectionString } from '@/shared/server/db';
import {
  buildStorefrontProductFromCatalogItem,
  toStorefrontPlainText
} from '@/commercial/features/products/storefrontProduct';
import { catalogCategoryHref, catalogCategoryItemHref, toPublicCatalogSlug } from './catalogRoutes';
import { sortCatalogItems } from './catalogUtils';
import type { CatalogBrowserNode, CatalogBrowserProps, CatalogBrowserShellData } from './catalogBrowserTypes';
import { getCatalogPriceBounds } from './catalogBrowserFilters';
import { toCatalogBrowserProduct } from './catalogBrowserProduct';

type SourceNode = RecursiveCatalogCategory | RecursiveCatalogSubcategory;

const catalogHref = (segments: string[]) =>
  '/products' + (segments.length ? '/' + segments.map(toPublicCatalogSlug).join('/') : '');

function descriptionFor(node: SourceNode): string | undefined {
  const candidates = ['summary' in node ? node.summary : '', node.description];
  return candidates.map(toStorefrontPlainText).find((value) =>
    value && value.toLocaleLowerCase('sl') !== node.title.trim().toLocaleLowerCase('sl')
  );
}

function buildNode(node: SourceNode, root: RecursiveCatalogCategory, path: string[]): CatalogBrowserNode {
  const href = catalogHref(path);
  const products = sortCatalogItems(node.items).flatMap((item) => {
    const product = buildStorefrontProductFromCatalogItem(item, {
      href: catalogCategoryItemHref(root.slug, item.slug),
      fallbackSku: [...path, item.slug].join('-'),
      fallbackPrice: item.price ?? 0,
      category: { slug: root.slug, title: root.title, href: catalogCategoryHref(root.slug) },
      ...(path.length > 1 ? { subcategory: { slug: node.slug, title: node.title, href } } : {})
    });
    if (product.status !== 'active') return [];
    return [toCatalogBrowserProduct(product, node.title)];
  });
  return {
    id: node.id,
    title: node.title,
    href,
    description: descriptionFor(node),
    products,
    children: node.subcategories.map((child) => buildNode(child, root, [...path, child.slug]))
  };
}

const loadSource = cache(async () => {
  if (!hasDatabaseConnectionString()) return [];
  // The public loader owns the tag-aware cache and includes every category depth.
  // Only explicit public summary fields are passed to the client below.
  return (await getCatalogDataFromDatabase({ diagnosticsContext: 'catalog:browser' })).categories;
});

function findPath(categories: RecursiveCatalogCategory[], segments: string[]): SourceNode[] | null {
  let children: SourceNode[] = categories;
  const ancestors: SourceNode[] = [];
  for (const segment of segments) {
    const node = children.find((candidate) => toPublicCatalogSlug(candidate.slug) === toPublicCatalogSlug(segment));
    if (!node) return null;
    ancestors.push(node);
    children = node.subcategories;
  }
  return ancestors;
}

function pagePresentation(ancestors: SourceNode[]): Pick<CatalogBrowserProps, 'title' | 'description' | 'breadcrumbs' | 'currentHref'> {
  const selected = ancestors.at(-1);
  const canonicalPath = ancestors.map((node) => node.slug);
  return {
    title: selected?.title ?? 'Katalog izdelkov',
    description: selected ? descriptionFor(selected) : 'Materiali, orodje in oprema za šole in delavnice.',
    breadcrumbs: [
      { label: 'Domov', href: '/' },
      { label: 'Katalog', ...(selected ? { href: '/products' } : {}) },
      ...ancestors.map((node, index) => ({
        label: node.title,
        ...(index < ancestors.length - 1 ? { href: catalogHref(canonicalPath.slice(0, index + 1)) } : {})
      }))
    ],
    currentHref: catalogHref(canonicalPath)
  };
}

// React cache shares this transformation only within a server render. The
// existing database loader continues to own cross-request tag invalidation.
const loadBrowserSnapshot = cache(async () => {
  const categories = await loadSource();
  const nodes = categories.map((category) => buildNode(category, category, [category.slug]));
  const navigation = categories.map((category) => ({
    id: category.id, title: category.title, href: catalogCategoryHref(category.slug)
  }));
  const nodesByHref = new Map<string, CatalogBrowserNode>();
  const routes: CatalogBrowserShellData['routes'] = [{
    ...pagePresentation([]),
    priceBounds: getCatalogPriceBounds(nodes)
  }];
  const visit = (source: SourceNode, node: CatalogBrowserNode, parents: SourceNode[]) => {
    const ancestors = [...parents, source];
    nodesByHref.set(node.href, node);
    routes.push({ ...pagePresentation(ancestors), priceBounds: getCatalogPriceBounds([node]) });
    source.subcategories.forEach((child, index) => visit(child, node.children[index], ancestors));
  };
  categories.forEach((category, index) => visit(category, nodes[index], []));
  return { nodes, navigation, nodesByHref, routes };
});

export async function getCatalogBrowserShellServer(): Promise<CatalogBrowserShellData> {
  const { nodes, navigation, routes } = await loadBrowserSnapshot();
  // Public product summaries stay in the shared layout so category navigation
  // can retain unchanged rows and images while scoped page data refreshes.
  return { nodes, navigation, routes };
}

export async function getCatalogBrowserPageServer(segments: string[] = []): Promise<CatalogBrowserProps | null> {
  const snapshot = await loadBrowserSnapshot();
  const href = catalogHref(segments);
  const route = snapshot.routes.find((candidate) => candidate.currentHref === href);
  if (!route) return null;
  const { priceBounds: _priceBounds, ...presentation } = route;
  const selected = snapshot.nodesByHref.get(href);
  return {
    ...presentation,
    nodes: selected ? [selected] : snapshot.nodes,
    navigation: snapshot.navigation
  };
}

export async function getCatalogBrowserMetadataServer(segments: string[]): Promise<Metadata> {
  const ancestors = findPath(await loadSource(), segments);
  const selected = ancestors?.at(-1);
  if (!selected || !ancestors) return {};
  const description = descriptionFor(selected) ?? 'Preglejte izdelke v kategoriji ' + selected.title + '.';
  const origin = new URL('https://atehna.si');
  const image = selected.image?.trim();
  let absoluteImage: string | undefined;
  try { absoluteImage = image ? new URL(image, origin).toString() : undefined; } catch { /* Ignore malformed catalog image URLs. */ }
  return {
    title: selected.title,
    description,
    openGraph: {
      title: selected.title, description,
      url: new URL(catalogHref(ancestors.map((node) => node.slug)), origin),
      type: 'website',
      images: absoluteImage ? [{ url: absoluteImage, alt: selected.title }] : []
    },
    twitter: {
      card: absoluteImage ? 'summary_large_image' : 'summary',
      title: selected.title, description, images: absoluteImage ? [absoluteImage] : []
    }
  };
}
