import type {
  CatalogBrowserNode,
  CatalogBrowserProduct
} from './catalogBrowserTypes';

export type CatalogBrowserSort =
  | 'recommended'
  | 'name'
  | 'name-desc'
  | 'price-asc'
  | 'price-desc'
  | 'availability-asc'
  | 'availability-desc';

export type CatalogProductAvailability =
  | { label: 'Na zalogi'; tone: 'stock'; rank: 0 }
  | { label: 'Po naročilu'; tone: 'order'; rank: 1 }
  | { label: 'Ni na zalogi'; tone: 'unavailable'; rank: 2 };

export type CatalogBrowserFilters = {
  query: string;
  inStockOnly: boolean;
  minPrice: number | null;
  maxPrice: number | null;
  sort: CatalogBrowserSort;
};

const isValidPrice = (value: number) => Number.isFinite(value) && value >= 0;

const normalizeSearch = (value: string) =>
  value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('sl').trim();

export function collectCatalogProducts(nodes: CatalogBrowserNode[]): CatalogBrowserProduct[] {
  const products: CatalogBrowserProduct[] = [];
  const seen = new Set<string>();
  const visit = (node: CatalogBrowserNode) => {
    for (const product of node.products) {
      if (seen.has(product.id)) continue;
      seen.add(product.id);
      products.push(product);
    }
    node.children.forEach(visit);
  };
  nodes.forEach(visit);
  return products;
}

export function getCatalogProductMinimumPrice(product: CatalogBrowserProduct): number {
  let minimum = Infinity;
  for (const option of product.priceOptions) {
    if (isValidPrice(option.gross)) minimum = Math.min(minimum, option.gross);
  }
  if (minimum !== Infinity) return minimum;
  if (!isValidPrice(product.minUnitNet) || !isValidPrice(product.taxRate)) return 0;
  const gross = product.minUnitNet * (1 + product.taxRate);
  return isValidPrice(gross) ? gross : 0;
}

export function getCatalogProductAvailability(
  product: CatalogBrowserProduct,
  stockEnforced = true
): CatalogProductAvailability {
  if (product.priceOptions.some((option) => option.inStock)) {
    return { label: 'Na zalogi', tone: 'stock', rank: 0 };
  }
  if (product.priceOptions.length > 0
    && (!stockEnforced || product.priceOptions.some((option) => option.orderable))) {
    return { label: 'Po naročilu', tone: 'order', rank: 1 };
  }
  return { label: 'Ni na zalogi', tone: 'unavailable', rank: 2 };
}

const productNameCollator = new Intl.Collator('sl', { sensitivity: 'base' });

function compareCatalogProducts(
  left: CatalogBrowserProduct,
  right: CatalogBrowserProduct,
  sort: CatalogBrowserSort,
  stockEnforced: boolean
): number {
  if (sort === 'name' || sort === 'name-desc') {
    const comparison = productNameCollator.compare(left.name, right.name);
    return sort === 'name-desc' ? -comparison : comparison;
  }
  if (sort === 'availability-asc' || sort === 'availability-desc') {
    const comparison = getCatalogProductAvailability(left, stockEnforced).rank
      - getCatalogProductAvailability(right, stockEnforced).rank;
    if (comparison !== 0) return sort === 'availability-desc' ? -comparison : comparison;
    return productNameCollator.compare(left.name, right.name);
  }
  if (sort === 'price-asc' || sort === 'price-desc') {
    const comparison = getCatalogProductMinimumPrice(left) - getCatalogProductMinimumPrice(right);
    return sort === 'price-desc' ? -comparison : comparison;
  }
  return 0;
}

export function sortCatalogProducts(
  products: CatalogBrowserProduct[],
  sort: CatalogBrowserSort,
  stockEnforced = true
): CatalogBrowserProduct[] {
  return [...products].sort((left, right) => compareCatalogProducts(left, right, sort, stockEnforced));
}

export function getCatalogPriceBounds(nodes: CatalogBrowserNode[]): { min: number; max: number } {
  let minimum = Infinity;
  let maximum = 0;
  for (const product of collectCatalogProducts(nodes)) {
    for (const option of product.priceOptions) {
      if (!isValidPrice(option.gross)) continue;
      minimum = Math.min(minimum, option.gross);
      maximum = Math.max(maximum, option.gross);
    }
  }
  return { min: minimum === Infinity ? 0 : minimum, max: maximum };
}

export function filterCatalogNodes(
  nodes: CatalogBrowserNode[],
  filters: CatalogBrowserFilters,
  stockEnforced = true
): CatalogBrowserNode[] {
  const queryTokens = normalizeSearch(filters.query).split(/\s+/).filter(Boolean);
  const minimum = filters.minPrice !== null && Number.isFinite(filters.minPrice)
    ? filters.minPrice : null;
  const maximum = filters.maxPrice !== null && Number.isFinite(filters.maxPrice)
    ? filters.maxPrice : null;
  const hasOptionFilter = filters.inStockOnly || minimum !== null || maximum !== null;
  const hasFilter = queryTokens.length > 0 || hasOptionFilter;

  const visit = (node: CatalogBrowserNode, ancestors: string[]): CatalogBrowserNode | null => {
    const categoryTitles = [...ancestors, node.title];
    const matches = node.products.flatMap((product) => {
      const searchable = normalizeSearch([
        ...categoryTitles,
        product.name,
        product.shortDescription,
        product.sku,
        product.categoryLabel
      ].filter(Boolean).join(' '));
      if (!queryTokens.every((token) => searchable.includes(token))) return [];

      // Stock and price must describe the same purchasable variant.
      const options = product.priceOptions.filter((option) =>
        isValidPrice(option.gross)
        && (!filters.inStockOnly || option.inStock)
        && (minimum === null || option.gross >= minimum)
        && (maximum === null || option.gross <= maximum)
      );
      if (hasOptionFilter && options.length === 0) return [];
      // Display the price of a matching option, rather than an excluded cheaper one.
      const visibleProduct = hasOptionFilter && options.length !== product.priceOptions.length
        ? { ...product, priceOptions: options } : product;
      return [visibleProduct];
    });

    const products = sortCatalogProducts(matches, filters.sort, stockEnforced);
    const children = node.children
      .map((child) => visit(child, categoryTitles))
      .filter((child): child is CatalogBrowserNode => child !== null);
    if (hasFilter && products.length === 0 && children.length === 0) return null;
    return { ...node, products, children };
  };

  return nodes.map((node) => visit(node, []))
    .filter((node): node is CatalogBrowserNode => node !== null);
}
