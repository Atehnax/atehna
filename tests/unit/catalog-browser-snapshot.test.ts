import assert from 'node:assert/strict';
import { test } from 'node:test';
import type {
  CatalogBrowserNode,
  CatalogBrowserProduct,
  CatalogBrowserProps,
  CatalogBrowserShellData
} from '../../src/commercial/catalog/catalogBrowserTypes';
import { mergeCatalogBrowserPage, scopeCatalogBrowserNodes } from '../../src/commercial/catalog/catalogBrowserSnapshot';
import { CATALOG_ALL_PRODUCTS_HREF } from '../../src/commercial/catalog/catalogRoutes';
import { getCatalogAllProductsPresentation } from '../../src/commercial/catalog/catalogBrowserAllProducts';

const product = (id: string, gross: number): CatalogBrowserProduct => ({
  id, name: id, slug: id, href: `/products/materiali/items/${id}`,
  minUnitNet: gross, maxUnitNet: gross, baseUnitNet: gross, taxRate: 0, discountPct: 0,
  displayVariant: null, purchasableVariant: null, hasMultipleVariants: false, isAvailable: true,
  priceOptions: [{ gross, inStock: true, orderable: true }]
});
const node = (id: string, href: string, products: CatalogBrowserProduct[] = [], children: CatalogBrowserNode[] = []): CatalogBrowserNode => ({
  id, title: id, href, products, children
});
const rootPresentation = {
  currentHref: '/products', title: 'Katalog izdelkov',
  description: 'Materiali, orodje in oprema za šole in delavnice.',
  breadcrumbs: [{ label: 'Domov', href: '/' }, { label: 'Katalog' }]
};
const empty: CatalogBrowserShellData = { nodes: [], navigation: [], routes: [] };
const fixturePage = (): CatalogBrowserProps => ({
  ...rootPresentation,
  nodes: [
    node('Materiali', '/products/materiali', [product('root-product', 10)], [
      node('Kovine', '/products/materiali/kovine', [product('alu', 5), product('baker', 15)], [
        node('Ostanki', '/products/materiali/kovine/ostanki', [product('ostanek', 1)])
      ]),
      node('Les', '/products/materiali/les', [product('vezana', 8)])
    ]),
    node('Orodje', '/products/orodje', [product('kladivo', 12)])
  ],
  navigation: [
    { id: 'Materiali', title: 'Materiali', href: '/products/materiali' },
    { id: 'Orodje', title: 'Orodje', href: '/products/orodje' }
  ]
});
const pageFor = (snapshot: CatalogBrowserShellData, selected: CatalogBrowserNode): CatalogBrowserProps => {
  const route = snapshot.routes.find((entry) => entry.currentHref === selected.href);
  if (!route) throw new Error('Fixture route missing');
  const { priceBounds: _bounds, ...presentation } = route;
  return { ...presentation, nodes: [structuredClone(selected)], navigation: structuredClone(snapshot.navigation) };
};
const routeFor = (snapshot: CatalogBrowserShellData, href: string) => {
  const route = snapshot.routes.find((entry) => entry.currentHref === href);
  if (!route) throw new Error(`Route missing: ${href}`);
  return route;
};
function freeze(value: unknown): void {
  if (!value || typeof value !== 'object') return;
  Object.values(value).forEach(freeze);
  Object.freeze(value);
}

test('equivalent full and scoped responses retain the complete snapshot identity', () => {
  const page = fixturePage();
  const snapshot = mergeCatalogBrowserPage(empty, page);
  freeze(snapshot);
  assert.equal(mergeCatalogBrowserPage(snapshot, structuredClone(page)), snapshot);
  const scoped = pageFor(snapshot, snapshot.nodes[0].children[0]);
  assert.equal(mergeCatalogBrowserPage(snapshot, scoped), snapshot);
  assert.deepEqual(routeFor(snapshot, '/products/materiali/kovine').breadcrumbs, [
    { label: 'Domov', href: '/' }, { label: 'Katalog', href: '/products' },
    { label: 'Materiali', href: '/products/materiali' }, { label: 'Kovine' }
  ]);
});

test('scoped replacement removes stale descendants and refreshes ancestor bounds while sharing unaffected data', () => {
  const snapshot = mergeCatalogBrowserPage(empty, fixturePage());
  const metals = snapshot.nodes[0].children[0];
  const page = pageFor(snapshot, metals);
  page.nodes[0].products = [page.nodes[0].products[0], product('baker', 30)];
  page.nodes[0].children = [];
  page.title = 'Kovinski materiali';
  page.description = 'Posodobljena predstavitev';
  freeze(snapshot);
  const result = mergeCatalogBrowserPage(snapshot, page);
  const updated = result.nodes[0].children[0];
  assert.equal(updated.products[0], metals.products[0]);
  assert.notEqual(updated.products[1], metals.products[1]);
  assert.deepEqual(updated.children, []);
  assert.equal(result.nodes[0].products, snapshot.nodes[0].products);
  assert.equal(result.nodes[0].children[1], snapshot.nodes[0].children[1]);
  assert.equal(result.nodes[1], snapshot.nodes[1]);
  assert.equal(result.navigation, snapshot.navigation);
  assert.equal(routeFor(result, '/products/orodje'), routeFor(snapshot, '/products/orodje'));
  assert.equal(result.routes.some((entry) => entry.currentHref.endsWith('/ostanki')), false);
  assert.deepEqual(routeFor(result, '/products').priceBounds, { min: 5, max: 30 });
  assert.deepEqual(routeFor(result, '/products/materiali').priceBounds, { min: 5, max: 30 });
  assert.equal(routeFor(result, metals.href).title, page.title);
  assert.equal(routeFor(result, metals.href).description, page.description);
  assert.equal(mergeCatalogBrowserPage(result, structuredClone(page)), result);
});

test('new scoped branches insert under their parent and a full response authoritatively removes omitted branches', () => {
  const snapshot = mergeCatalogBrowserPage(empty, fixturePage());
  const added = node('Papir', '/products/materiali/papir', [product('list', 2)]);
  const page: CatalogBrowserProps = {
    currentHref: added.href, title: added.title,
    breadcrumbs: [
      { label: 'Domov', href: '/' }, { label: 'Katalog', href: '/products' },
      { label: 'Materiali', href: '/products/materiali' }, { label: 'Papir' }
    ],
    nodes: [added], navigation: structuredClone(snapshot.navigation)
  };
  const inserted = mergeCatalogBrowserPage(snapshot, page);
  assert.equal(inserted.nodes.length, 2);
  assert.equal(inserted.nodes[0].children[2].id, 'Papir');
  assert.equal(inserted.nodes[0].children[0], snapshot.nodes[0].children[0]);
  assert.equal(routeFor(inserted, added.href).breadcrumbs[2].href, '/products/materiali');

  const removed = mergeCatalogBrowserPage(inserted, { ...page, nodes: [] });
  assert.equal(removed.nodes[0].children.length, 2);
  assert.equal(removed.routes.some((entry) => entry.currentHref === added.href), false);
  const replaced = mergeCatalogBrowserPage(inserted, {
    ...rootPresentation,
    nodes: [structuredClone(inserted.nodes[1])],
    navigation: [structuredClone(inserted.navigation[1])]
  });
  assert.equal(replaced.nodes[0], inserted.nodes[1]);
  assert.deepEqual(replaced.navigation.map((entry) => entry.id), ['Orodje']);
  assert.deepEqual(replaced.routes.map((entry) => entry.currentHref), ['/products', '/products/orodje']);
  assert.deepEqual(routeFor(replaced, '/products').priceBounds, { min: 12, max: 12 });
});

test('scoping retains every ancestor wrapper and the original selected subtree', () => {
  const snapshot = mergeCatalogBrowserPage(empty, fixturePage());
  freeze(snapshot);
  const materials = snapshot.nodes[0];
  const metals = materials.children[0];
  const selected = metals.children[0];
  const scoped = scopeCatalogBrowserNodes(snapshot.nodes, selected.href);
  assert.equal(scopeCatalogBrowserNodes(snapshot.nodes, '/products'), snapshot.nodes);
  assert.equal(scoped.length, 1);
  assert.equal(scoped[0].id, materials.id);
  assert.deepEqual(scoped[0].products, []);
  assert.equal(scoped[0].children.length, 1);
  assert.equal(scoped[0].children[0].id, metals.id);
  assert.deepEqual(scoped[0].children[0].products, []);
  assert.equal(scoped[0].children[0].children[0], selected);
  assert.deepEqual(scopeCatalogBrowserNodes(snapshot.nodes, '/products/missing'), []);
  assert.equal(materials.products.length, 1);
  assert.equal(metals.products.length, 2);
});

test('virtual all-products route scopes and replaces the full catalog without renaming the tree root', () => {
  const snapshot = mergeCatalogBrowserPage(empty, fixturePage());
  freeze(snapshot);
  assert.equal(scopeCatalogBrowserNodes(snapshot.nodes, CATALOG_ALL_PRODUCTS_HREF), snapshot.nodes);
  const allProductsPage = {
    ...fixturePage(),
    ...getCatalogAllProductsPresentation()
  };
  assert.equal(mergeCatalogBrowserPage(snapshot, allProductsPage), snapshot);

  const refreshed = mergeCatalogBrowserPage(snapshot, {
    ...allProductsPage,
    nodes: [structuredClone(snapshot.nodes[1])],
    navigation: [structuredClone(snapshot.navigation[1])]
  });
  assert.equal(refreshed.nodes.length, 1);
  assert.equal(refreshed.nodes[0], snapshot.nodes[1]);
  assert.deepEqual(refreshed.routes.map(route => route.currentHref), ['/products', '/products/orodje']);
  assert.equal(routeFor(refreshed, '/products').title, 'Katalog izdelkov');
  assert.deepEqual(routeFor(refreshed, '/products').breadcrumbs, rootPresentation.breadcrumbs);
});
