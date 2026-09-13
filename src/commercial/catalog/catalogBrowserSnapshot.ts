import type {
  CatalogBrowserNode,
  CatalogBrowserProduct,
  CatalogBrowserProps,
  CatalogBrowserShellData
} from './catalogBrowserTypes';
import { collectCatalogProducts, getCatalogPriceBounds } from './catalogBrowserFilters';
import { CATALOG_ALL_PRODUCTS_HREF } from './catalogRoutes';

type Route = CatalogBrowserShellData['routes'][number];
const ROOT_HREF = '/products';
const EMPTY_PRODUCTS: CatalogBrowserProduct[] = [];
const equal = (left: unknown, right: unknown) => left === right || JSON.stringify(left) === JSON.stringify(right);
const shareArray = <T>(previous: T[], next: T[]): T[] =>
  previous.length === next.length && previous.every((entry, index) => entry === next[index])
    ? previous : next;
const sameNode = (left: CatalogBrowserNode, right: CatalogBrowserNode) =>
  left.id === right.id || left.href === right.href;

function shareNode(
  previous: CatalogBrowserNode | undefined,
  incoming: CatalogBrowserNode,
  productsById: Map<string, CatalogBrowserProduct>
): CatalogBrowserNode {
  const products = incoming.products.map((product) => {
    const known = productsById.get(product.id);
    return known && equal(known, product) ? known : product;
  });
  const children = incoming.children.map((child) => shareNode(
    previous?.children.find((known) => sameNode(known, child)), child, productsById
  ));
  const next = {
    ...incoming,
    products: previous ? shareArray(previous.products, products) : products,
    children: previous ? shareArray(previous.children, children) : children
  };
  return previous && equal(previous, next) ? previous : next;
}

function patchBranch(
  nodes: CatalogBrowserNode[],
  incoming: CatalogBrowserNode
): { nodes: CatalogBrowserNode[]; found: boolean } {
  let found = false;
  const next = nodes.map((node) => {
    if (sameNode(node, incoming)) {
      found = true;
      return incoming;
    }
    const childResult = patchBranch(node.children, incoming);
    if (!childResult.found) return node;
    found = true;
    return childResult.nodes === node.children ? node : { ...node, children: childResult.nodes };
  });
  return { nodes: shareArray(nodes, next), found };
}

function insertBranch(
  nodes: CatalogBrowserNode[],
  incoming: CatalogBrowserNode
): CatalogBrowserNode[] {
  const parentHref = incoming.href.slice(0, incoming.href.lastIndexOf('/'));
  let inserted = false;
  const visit = (entries: CatalogBrowserNode[]): CatalogBrowserNode[] => shareArray(entries, entries.map((node) => {
    if (node.href === parentHref) {
      inserted = true;
      return { ...node, children: [...node.children, incoming] };
    }
    const children = visit(node.children);
    return children === node.children ? node : { ...node, children };
  }));
  const next = visit(nodes);
  return inserted ? next : [...nodes, incoming];
}

function removeBranch(nodes: CatalogBrowserNode[], href: string): CatalogBrowserNode[] {
  return shareArray(nodes, nodes.filter((node) => node.href !== href).map((node) => {
    const children = removeBranch(node.children, href);
    return children === node.children ? node : { ...node, children };
  }));
}

function deriveRoutes(
  nodes: CatalogBrowserNode[],
  previous: Route[],
  page: CatalogBrowserProps
): Route[] {
  const previousRoutes = new Map(previous.map((route) => [route.currentHref, route]));
  const rootPresentation = previousRoutes.get(ROOT_HREF);
  const routes: Route[] = [];
  const addRoute = (route: Route) => {
    const next = route.currentHref === page.currentHref
      ? { ...route, title: page.title, description: page.description, breadcrumbs: page.breadcrumbs }
      : route;
    const known = previousRoutes.get(next.currentHref);
    if (known && equal(known, next)) {
      routes.push(known);
    } else {
      routes.push({
        ...next,
        breadcrumbs: known && equal(known.breadcrumbs, next.breadcrumbs) ? known.breadcrumbs : next.breadcrumbs,
        priceBounds: known && equal(known.priceBounds, next.priceBounds) ? known.priceBounds : next.priceBounds
      });
    }
  };
  addRoute({
    title: rootPresentation?.title ?? 'Katalog izdelkov',
    description: rootPresentation?.description ?? 'Materiali, orodje in oprema za šole in delavnice.',
    breadcrumbs: rootPresentation?.breadcrumbs ?? [{ label: 'Domov', href: '/' }, { label: 'Katalog' }],
    currentHref: ROOT_HREF,
    priceBounds: getCatalogPriceBounds(nodes)
  });
  const visit = (node: CatalogBrowserNode, ancestors: CatalogBrowserNode[]) => {
    const path = [...ancestors, node];
    addRoute({
      title: node.title,
      description: node.description,
      breadcrumbs: [
        { label: 'Domov', href: '/' },
        { label: 'Katalog', href: ROOT_HREF },
        ...path.map((entry, index) => ({
          label: entry.title,
          ...(index < path.length - 1 ? { href: entry.href } : {})
        }))
      ],
      currentHref: node.href,
      priceBounds: getCatalogPriceBounds([node])
    });
    node.children.forEach((child) => visit(child, path));
  };
  nodes.forEach((node) => visit(node, []));
  return shareArray(previous, routes);
}

/** Scoped responses replace their branch; omitted products and children stay removed. */
export function mergeCatalogBrowserPage(
  previous: CatalogBrowserShellData,
  page: CatalogBrowserProps
): CatalogBrowserShellData {
  const productsById = new Map(collectCatalogProducts(previous.nodes).map((product) => [product.id, product]));
  const previousNodes: CatalogBrowserNode[] = [];
  const collectNodes = (nodes: CatalogBrowserNode[]) => nodes.forEach((node) => {
    previousNodes.push(node);
    collectNodes(node.children);
  });
  collectNodes(previous.nodes);
  const incoming = page.nodes.map((node) => shareNode(
    previousNodes.find((known) => sameNode(known, node)), node, productsById
  ));
  let nodes = previous.nodes;
  if (page.currentHref === ROOT_HREF || page.currentHref === CATALOG_ALL_PRODUCTS_HREF) {
    nodes = shareArray(previous.nodes, incoming);
  } else if (incoming.length === 0) {
    nodes = removeBranch(nodes, page.currentHref);
  } else {
    for (const node of incoming) {
      const patched = patchBranch(nodes, node);
      nodes = patched.found ? patched.nodes : insertBranch(nodes, node);
    }
  }
  const navigation = shareArray(previous.navigation, page.navigation.map((entry) => {
    const known = previous.navigation.find((candidate) => candidate.id === entry.id || candidate.href === entry.href);
    return known && equal(known, entry) ? known : entry;
  }));
  const routes = deriveRoutes(nodes, previous.routes, page);
  return nodes === previous.nodes && navigation === previous.navigation && routes === previous.routes
    ? previous : { nodes, navigation, routes };
}

/** Keep ancestor keys and nesting stable while hiding products outside the selected branch. */
export function scopeCatalogBrowserNodes(nodes: CatalogBrowserNode[], href: string): CatalogBrowserNode[] {
  if (href === ROOT_HREF || href === CATALOG_ALL_PRODUCTS_HREF) return nodes;
  const visit = (entries: CatalogBrowserNode[]): CatalogBrowserNode[] => shareArray(entries, entries.flatMap((node) => {
    if (node.href === href) return [node];
    const children = visit(node.children);
    if (children.length === 0) return [];
    const products = node.products.length === 0 ? node.products : EMPTY_PRODUCTS;
    return [children === node.children && products === node.products ? node : { ...node, products, children }];
  }));
  return visit(nodes);
}
