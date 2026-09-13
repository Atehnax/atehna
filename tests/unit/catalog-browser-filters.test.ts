import assert from 'node:assert/strict';
import { test } from 'node:test';
import type {
  CatalogBrowserNode,
  CatalogBrowserProduct
} from '../../src/commercial/catalog/catalogBrowserTypes';
import {
  collectCatalogProducts,
  filterCatalogNodes,
  getCatalogPriceBounds,
  getCatalogProductAvailability,
  getCatalogProductMinimumPrice,
  sortCatalogProducts,
  type CatalogBrowserFilters
} from '../../src/commercial/catalog/catalogBrowserFilters';

const defaults: CatalogBrowserFilters = {
  query: '', inStockOnly: false, minPrice: null, maxPrice: null, sort: 'recommended'
};

const product = (
  id: string,
  name: string,
  priceOptions: CatalogBrowserProduct['priceOptions'] = [{ gross: 10, inStock: true, orderable: true }]
): CatalogBrowserProduct => ({
  id, name, slug: id, href: `/products/materiali/items/${id}`, sku: `MAT-KOV-${id.toUpperCase()}`,
  shortDescription: 'Za tehnični pouk in delavnico.',
  minUnitNet: 10, maxUnitNet: 10, baseUnitNet: 10, taxRate: 0.22, discountPct: 0,
  displayVariant: null, purchasableVariant: null, hasMultipleVariants: priceOptions.length > 1,
  isAvailable: true, priceOptions
});

const node = (
  id: string,
  title: string,
  products: CatalogBrowserProduct[] = [],
  children: CatalogBrowserNode[] = []
): CatalogBrowserNode => ({ id, title, href: `/products/${id}`, products, children });

const ids = (nodes: CatalogBrowserNode[]) => collectCatalogProducts(nodes).map((entry) => entry.id);

function freezeTree(value: unknown): void {
  if (!value || typeof value !== 'object') return;
  Object.values(value).forEach(freezeTree);
  Object.freeze(value);
}

test('search retains ancestors and combines Slovenian names, SKU and category ancestry', () => {
  const tree = [node('materiali', 'Materiali', [], [
    node('kovine', 'Kovine', [product('alu', 'Aluminijasta plošča'), product('bak', 'Bakrena plošča')]),
    node('les', 'Les', [product('vez', 'Vezana plošča')])
  ])];
  const categoryMatch = filterCatalogNodes(tree, { ...defaults, query: 'KOVINE' });
  assert.equal(categoryMatch[0].id, 'materiali');
  assert.deepEqual(categoryMatch[0].children.map((entry) => entry.id), ['kovine']);
  assert.deepEqual(ids(categoryMatch), ['alu', 'bak']);
  assert.deepEqual(ids(filterCatalogNodes(tree, { ...defaults, query: 'materiali bakrena plosca' })), ['bak']);
  assert.deepEqual(ids(filterCatalogNodes(tree, { ...defaults, query: 'mat-kov-alu' })), ['alu']);
  assert.deepEqual(ids(filterCatalogNodes(tree, { ...defaults, query: 'tehnicni pouk' })), ['alu', 'bak', 'vez']);
  assert.deepEqual(filterCatalogNodes(tree, { ...defaults, query: 'neobstojeci' }), []);
});

test('stock and inclusive gross-price filters match one variant and show its price without mutation', () => {
  const tree = [node('kovine', 'Kovine', [
    product('wrong', 'Napačna kombinacija', [{ gross: 5, inStock: false, orderable: false }, { gross: 30, inStock: true, orderable: true }]),
    product('boundary', 'Robna cena', [{ gross: 5, inStock: false, orderable: false }, { gross: 20, inStock: true, orderable: true }]),
    product('inside', 'V razponu', [{ gross: 12, inStock: true, orderable: true }]),
    product('unknown', 'Brez različic', [])
  ])];
  const original = structuredClone(tree);
  freezeTree(tree);
  const result = filterCatalogNodes(tree, {
    ...defaults, inStockOnly: true, minPrice: 12, maxPrice: 20, sort: 'price-desc'
  });
  assert.deepEqual(ids(result), ['boundary', 'inside']);
  assert.deepEqual(result[0].products[0].priceOptions, [{ gross: 20, inStock: true, orderable: true }]);
  assert.equal(getCatalogProductMinimumPrice(result[0].products[0]), 20);
  assert.notEqual(result[0].products[0], tree[0].products[1]);
  assert.equal(result[0].products[1], tree[0].products[2]);
  assert.deepEqual(tree, original);
  assert.deepEqual(ids(filterCatalogNodes(tree, { ...defaults, minPrice: 5, maxPrice: 5 })), ['wrong', 'boundary']);
});

test('unfiltered browsing preserves empty categories, recommended order and unique product counts', () => {
  const first = product('zaga', 'Žaga');
  const second = product('aluminij', 'Aluminij');
  const tree = [node('vse', 'Vse', [first, second], [
    node('prazno', 'Prazna kategorija'),
    node('ponovljeno', 'Ponovljeno', [first]),
    node('neznano', 'Neznano', [product('brez-cene', 'Brez cene', [])])
  ])];
  assert.deepEqual(ids(filterCatalogNodes(tree, defaults)), ['zaga', 'aluminij', 'brez-cene']);
  assert.equal(filterCatalogNodes(tree, defaults)[0].children.length, 3);
  assert.deepEqual(filterCatalogNodes(tree, { ...defaults, sort: 'name' })[0].products.map((entry) => entry.id), ['aluminij', 'zaga']);
  assert.deepEqual(filterCatalogNodes(tree, { ...defaults, sort: 'price-asc' })[0].products.map((entry) => entry.id), ['zaga', 'aluminij']);
  assert.equal(tree[0].products[0], first);
});

test('price bounds ignore invalid options and support zero and absent prices', () => {
  const entry = product('prices', 'Cene', [
    { gross: NaN, inStock: true, orderable: true }, { gross: Infinity, inStock: true, orderable: true },
    { gross: -5, inStock: true, orderable: true }, { gross: 0, inStock: true, orderable: true }, { gross: 24.9, inStock: false, orderable: false }
  ]);
  const tree = [node('vse', 'Vse', [entry])];
  assert.deepEqual(getCatalogPriceBounds(tree), { min: 0, max: 24.9 });
  assert.deepEqual(getCatalogPriceBounds([]), { min: 0, max: 0 });
  assert.equal(getCatalogProductMinimumPrice(entry), 0);
  assert.deepEqual(ids(filterCatalogNodes(tree, { ...defaults, minPrice: 0, maxPrice: 0 })), ['prices']);
  assert.equal(getCatalogProductMinimumPrice(product('fallback', 'Nadomestna cena', [])), 12.2);
  assert.equal(getCatalogProductMinimumPrice({ ...entry, priceOptions: [], minUnitNet: NaN }), 0);
});


test('global sorting spans deduplicated categories in all four directions and uses qualifying variant prices', () => {
  const zaga = product('zaga', 'Žaga', [
    { gross: 5, inStock: false, orderable: false }, { gross: 30, inStock: true, orderable: true }
  ]);
  const price = (gross: number) => [{ gross, inStock: true, orderable: true }];
  const tree = [
    node('orodje', 'Orodje', [zaga, product('sestilo', 'Šestilo', price(12)), product('copic', 'Čopič', price(20))]),
    node('pribor', 'Pribor', [zaga], [
      node('dodatki', 'Dodatki', [product('cerada', 'Cerada', price(12)), product('ravnilo', 'Ravnilo', price(25))])
    ])
  ];
  const filtered = filterCatalogNodes(tree, { ...defaults, inStockOnly: true, minPrice: 10 });
  const products = collectCatalogProducts(filtered);
  const originalOrder = ['zaga', 'sestilo', 'copic', 'cerada', 'ravnilo'];
  freezeTree(products);
  assert.deepEqual(products.map((entry) => entry.id), originalOrder);
  assert.equal(getCatalogProductMinimumPrice(products[0]), 30);
  const expectations = [
    ['name', ['cerada', 'copic', 'ravnilo', 'sestilo', 'zaga']],
    ['name-desc', ['zaga', 'sestilo', 'ravnilo', 'copic', 'cerada']],
    ['price-asc', ['sestilo', 'cerada', 'copic', 'ravnilo', 'zaga']],
    ['price-desc', ['zaga', 'ravnilo', 'copic', 'sestilo', 'cerada']],
    ['recommended', originalOrder]
  ] as const;
  for (const [sort, expected] of expectations) {
    const sorted = sortCatalogProducts(products, sort);
    assert.notEqual(sorted, products);
    assert.deepEqual(sorted.map((entry) => entry.id), expected);
    for (const entry of sorted) assert.equal(entry, products.find((known) => known.id === entry.id));
  }
  assert.deepEqual(products.map((entry) => entry.id), originalOrder);
  assert.deepEqual(filterCatalogNodes(tree, { ...defaults, sort: 'name-desc' })[0].products.map((entry) => entry.id), ['zaga', 'sestilo', 'copic']);
});


test('availability classification follows matching options and the stock enforcement policy', () => {
  const stocked = product('stocked', 'Na zalogi', [
    { gross: 5, inStock: false, orderable: false },
    { gross: 20, inStock: true, orderable: true }
  ]);
  const backorder = product('backorder', 'Po naročilu', [
    { gross: 10, inStock: false, orderable: true }
  ]);
  const blocked = product('blocked', 'Ni na zalogi', [
    { gross: 10, inStock: false, orderable: false }
  ]);
  const empty = product('empty', 'Brez različic', []);
  const stock = { label: 'Na zalogi', tone: 'stock', rank: 0 };
  const order = { label: 'Po naročilu', tone: 'order', rank: 1 };
  const unavailable = { label: 'Ni na zalogi', tone: 'unavailable', rank: 2 };
  assert.deepEqual(getCatalogProductAvailability(stocked), stock);
  assert.deepEqual(getCatalogProductAvailability(stocked, false), stock);
  assert.deepEqual(getCatalogProductAvailability(backorder), order);
  assert.deepEqual(getCatalogProductAvailability(blocked), unavailable);
  assert.deepEqual(getCatalogProductAvailability(blocked, false), order);
  assert.deepEqual(getCatalogProductAvailability(empty), unavailable);
  assert.deepEqual(getCatalogProductAvailability(empty, false), unavailable);

  const [filtered] = filterCatalogNodes([node('vse', 'Vse', [stocked])], {
    ...defaults, maxPrice: 5
  });
  assert.deepEqual(getCatalogProductAvailability(filtered.products[0]), unavailable);
  assert.deepEqual(getCatalogProductAvailability(filtered.products[0], false), order);
  assert.deepEqual(getCatalogProductAvailability(stocked), stock);
});

test('availability sorting supports both directions, Slovenian name ties and immutable inputs', () => {
  const option = (inStock: boolean, orderable: boolean) => [{ gross: 10, inStock, orderable }];
  const products = [
    product('stock-z', 'Žaga', option(true, true)),
    product('order-s', 'Šestilo', option(false, true)),
    product('blocked-c', 'Cerada', option(false, false)),
    product('stock-c', 'Čopič', option(true, true)),
    product('empty-a', 'Aluminij', []),
    product('order-r', 'Ravnilo', option(false, true))
  ];
  const before = structuredClone(products);
  freezeTree(products);
  const expectations = [
    ['availability-asc', true, ['stock-c', 'stock-z', 'order-r', 'order-s', 'empty-a', 'blocked-c']],
    ['availability-desc', true, ['empty-a', 'blocked-c', 'order-r', 'order-s', 'stock-c', 'stock-z']],
    ['availability-asc', false, ['stock-c', 'stock-z', 'blocked-c', 'order-r', 'order-s', 'empty-a']],
    ['availability-desc', false, ['empty-a', 'blocked-c', 'order-r', 'order-s', 'stock-c', 'stock-z']]
  ] as const;
  for (const [sort, stockEnforced, expected] of expectations) {
    const sorted = sortCatalogProducts(products, sort, stockEnforced);
    assert.notEqual(sorted, products);
    assert.deepEqual(sorted.map((entry) => entry.id), expected);
    for (const entry of sorted) assert.equal(entry, products.find((known) => known.id === entry.id));
  }
  assert.deepEqual(products, before);
});

test('nested category sorting uses the same availability policy after option filtering', () => {
  const tree = [node('materiali', 'Materiali', [], [node('kovine', 'Kovine', [
    product('blocked', 'Aluminij', [{ gross: 10, inStock: false, orderable: false }]),
    product('order', 'Baker', [{ gross: 10, inStock: false, orderable: true }]),
    product('stock', 'Cink', [{ gross: 10, inStock: true, orderable: true }])
  ])])];
  const filters: CatalogBrowserFilters = { ...defaults, sort: 'availability-asc' };
  assert.deepEqual(ids(filterCatalogNodes(tree, filters)), ['stock', 'order', 'blocked']);
  assert.deepEqual(ids(filterCatalogNodes(tree, filters, false)), ['stock', 'blocked', 'order']);
});
