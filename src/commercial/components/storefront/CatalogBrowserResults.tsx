'use client';

import { memo, useMemo } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowDown, ArrowRight, ArrowUp, ChevronDown, ChevronUp, ImageIcon, Search } from 'lucide-react';
import type { CatalogBrowserNode, CatalogBrowserProduct, CatalogBrowserProps } from '@/commercial/catalog/catalogBrowserTypes';
import { collectCatalogProducts, filterCatalogNodes, getCatalogProductAvailability, getCatalogProductMinimumPrice, sortCatalogProducts, type CatalogBrowserSort } from '@/commercial/catalog/catalogBrowserFilters';
import { useStockEnforcementEnabled } from '@/commercial/components/StorefrontInventoryPolicyProvider';
import { formatEuro, formatSlCount } from '@/shared/domain/formatting';
import { useCatalogBrowserState } from './CatalogBrowserContext';
import { scopeCatalogBrowserNodes } from '@/commercial/catalog/catalogBrowserSnapshot';
import { CATALOG_ALL_PRODUCTS_HREF } from '@/commercial/catalog/catalogRoutes';
import styles from './CatalogBrowser.module.css';
import CatalogCanvasElement from './CatalogCanvasElement';
import { useProductAppearance } from '@/commercial/components/ProductAppearanceProvider';

const nodeIds = (nodes: CatalogBrowserNode[], href: string): string[] => nodes.flatMap(node => [
  ...(href.startsWith(`${node.href}/`) ? [] : [node.id]), ...nodeIds(node.children, href)
]);
const countLabel = (count: number) => formatSlCount(count, { one: 'izdelek', two: 'izdelka', few: 'izdelki', other: 'izdelkov' });

const CatalogRow = memo(function CatalogRow({ product }: { product: CatalogBrowserProduct }) {
  const stockEnforced = useStockEnforcementEnabled();
  const { listings } = useProductAppearance();
  const hasPrice = product.priceOptions.length > 0;
  const price = getCatalogProductMinimumPrice(product);
  const hasPriceRange = product.priceOptions.some(option => option.gross > price + 0.005);
  const availability = getCatalogProductAvailability(product, stockEnforced);
  return (
    <article className={styles.productRow} data-catalog-product={product.id}>
      <Link href={product.href} prefetch={false} className={styles.productIdentity} aria-label={product.name}>
        <CatalogCanvasElement id="catalog-product-image" label="Slika izdelka" productId={product.id} className={styles.imageSlot}>
        <span className={styles.productImage}>
          {product.image ? (
            <Image src={product.image.url} alt={product.image.altText || product.name} fill sizes="(max-width: 760px) 45px, 49px" style={{ objectFit: listings.imageFit }} />
          ) : <ImageIcon aria-hidden="true" />}
        </span>
        </CatalogCanvasElement>
        <div className={styles.productCopy}>
          <CatalogCanvasElement id="catalog-product-name" label="Naziv izdelka" productId={product.id}><span className={styles.productName} style={{ WebkitLineClamp: listings.titleLines }}>{product.name}</span></CatalogCanvasElement>
          {listings.showShortDescription && product.shortDescription ? <CatalogCanvasElement id="catalog-product-description" label="Opis izdelka" productId={product.id}><span className={styles.productDescription}>{product.shortDescription}</span></CatalogCanvasElement> : null}
        </div>
      </Link>
      {listings.showStock ? <CatalogCanvasElement id="catalog-product-availability" label="Dobavljivost izdelka" productId={product.id} className={styles.availabilitySlot}>
      <span className={styles.availability} data-tone={availability.tone}>
        <span aria-hidden="true" />{availability.label}
      </span>
      </CatalogCanvasElement> : null}
      <CatalogCanvasElement id="catalog-product-price" label="Cena izdelka" productId={product.id} className={styles.priceSlot}>
      <span className={styles.price} aria-label={hasPrice ? `${hasPriceRange ? 'Od ' : ''}${formatEuro(price)} z DDV` : 'Cena po povpraševanju'}>
        {hasPrice ? <>{hasPriceRange ? <span className={styles.priceFrom}>od </span> : null}{formatEuro(price)}</> : 'Povprašajte'}
      </span>
      </CatalogCanvasElement>
    </article>
  );
});

function CategoryBranch({ node, index, depth = 0, currentHref, collapsed, toggle }: {
  node: CatalogBrowserNode; index: number; depth?: number; currentHref: string; collapsed: Set<string>; toggle: (id: string) => void;
}) {
  const ancestor = currentHref.startsWith(`${node.href}/`);
  const expanded = ancestor || !collapsed.has(node.id);
  const headingId = `catalog-heading-${node.id}`;
  const contentId = `catalog-children-${node.id}`;
  const Heading = depth === 0 ? 'h2' : 'h3';
  return (
    <section className={ancestor ? styles.scopeAncestor : depth === 0 ? styles.categoryGroup : styles.categoryBranch} aria-labelledby={ancestor ? undefined : headingId}>
      <div className={depth === 0 ? styles.categoryHeader : styles.branchHeader} role={depth === 0 ? 'group' : undefined} aria-label={depth === 0 ? 'Razvrsti izdelke' : undefined}>
        <div className={styles.categoryIdentity}>
          <div className={styles.categoryHeading}>
            <button type="button" className={styles.categoryToggle} onClick={() => toggle(node.id)}
              aria-label={(expanded ? 'Strni' : 'Razširi') + ' kategorijo ' + node.title}
              aria-expanded={expanded} aria-controls={contentId}>
              <ChevronDown aria-hidden="true" data-collapsed={!expanded} />
            </button>
            <Heading id={headingId}>
              <Link href={node.href} scroll={false} className={styles.categoryTitle} aria-label={node.title}>
                {depth === 0 ? <span className={styles.categoryNumber} aria-hidden="true">{String(index + 1).padStart(2, '0')}</span> : null}
                <span>{node.title}</span>
              </Link>
            </Heading>
            {depth === 0 ? <SortHeading column={sortColumns[0]} compact /> : null}
          </div>
        </div>
        {depth === 0 ? <><SortHeading column={sortColumns[1]} /><SortHeading column={sortColumns[2]} /></> : null}
      </div>
      <div id={contentId} hidden={!expanded} className={styles.branchContent}>
        {node.products.map(product => <CatalogRow key={product.id} product={product} />)}
        {node.children.map((child, childIndex) => <CategoryBranch key={child.id} node={child} index={childIndex} depth={ancestor ? 0 : depth + 1} currentHref={currentHref} collapsed={collapsed} toggle={toggle} />)}
        {node.products.length === 0 && node.children.length === 0 ? <p className={styles.emptyCategory}>Izdelki v tej kategoriji bodo na voljo kmalu.</p> : null}
      </div>
    </section>
  );
}

const sortColumns: { key: string; title: string; ascending: CatalogBrowserSort; descending: CatalogBrowserSort; ascendingLabel: string; descendingLabel: string }[] = [
  { key: 'name', title: 'Izdelek', ascending: 'name', descending: 'name-desc', ascendingLabel: 'razvrsti A–Z', descendingLabel: 'razvrsti Z–A' },
  { key: 'availability', title: 'Dobavljivost', ascending: 'availability-asc', descending: 'availability-desc', ascendingLabel: 'najprej na zalogi', descendingLabel: 'najprej ni na zalogi' },
  { key: 'price', title: 'Cena z DDV', ascending: 'price-asc', descending: 'price-desc', ascendingLabel: 'razvrsti naraščajoče', descendingLabel: 'razvrsti padajoče' },
];

function SortHeading({ column, compact = false }: { column: typeof sortColumns[number]; compact?: boolean }) {
  const { filters, setSort } = useCatalogBrowserState();
  const { listings } = useProductAppearance();
  if (column.key === 'availability' && !listings.showStock) return <span />;
  const ascending = filters.sort === column.ascending;
  const descending = filters.sort === column.descending;
  const restoreOrder = descending && column.key !== 'name';
  const nextSort = restoreOrder ? 'recommended' : ascending ? column.descending : column.ascending;
  const action = restoreOrder ? 'povrni prvotni vrstni red' : ascending ? column.descendingLabel : column.ascendingLabel;
  return (
    <button type="button" className={compact ? `${styles.sortHeading} ${styles.nameSort}` : styles.sortHeading}
      data-sort-key={column.key} data-direction={ascending ? 'ascending' : descending ? 'descending' : 'none'}
      aria-pressed={ascending || descending} aria-label={column.title + ': ' + action}
      title={column.title + ': ' + action}
      onClick={() => setSort(nextSort)}>
      {compact ? descending ? 'Z–A' : 'A–Z' : column.title}
      {column.key === 'price' ? (
        <span className={styles.sortDirection} aria-hidden="true">
          {ascending ? <ArrowUp /> : descending ? <ArrowDown /> : null}
        </span>
      ) : null}
    </button>
  );
}

function SortHeaders() {
  return (
    <div className={styles.sortHeader} role="group" aria-label="Razvrsti izdelke">
      {sortColumns.map(column => <SortHeading key={column.key} column={column} />)}
    </div>
  );
}

export default function CatalogBrowserResults({ nodes, currentHref }: Pick<CatalogBrowserProps, 'nodes' | 'currentHref'>) {
  const { filters, isFiltering, hasFilters, collapsed, setCollapsed, resetFilters, toggle, navigation } = useCatalogBrowserState();
  const stockEnforced = useStockEnforcementEnabled();
  const scopedNodes = useMemo(() => scopeCatalogBrowserNodes(nodes, currentHref), [nodes, currentHref]);
  const filteredNodes = useMemo(() => filterCatalogNodes(scopedNodes, filters, stockEnforced), [scopedNodes, filters, stockEnforced]);
  const visibleProducts = useMemo(() => collectCatalogProducts(filteredNodes), [filteredNodes]);
  const flat = currentHref === CATALOG_ALL_PRODUCTS_HREF;
  const sortedProducts = useMemo(() => sortCatalogProducts(visibleProducts, filters.sort === 'recommended' ? 'name' : filters.sort, stockEnforced), [visibleProducts, filters.sort, stockEnforced]);
  const hasResults = flat ? sortedProducts.length > 0 : filteredNodes.length > 0;
  const visibleNodeIds = useMemo(() => nodeIds(filteredNodes, currentHref), [filteredNodes, currentHref]);
  const allExpanded = visibleNodeIds.every(id => !collapsed.has(id));
  const categoryIndex = (id: string) => {
    const rootIndex = navigation.findIndex(category => category.id === id);
    return rootIndex >= 0 ? rootIndex : Math.max(0, nodes.findIndex(node => node.id === id));
  };

  return (
    <section className={styles.results} aria-label="Katalog izdelkov" aria-busy={isFiltering}>
      <div className={styles.resultsToolbar}>
        <span role="status">{hasFilters || flat ? countLabel(visibleProducts.length) : allExpanded ? 'Vse kategorije so razširjene' : 'Izberite kategorijo za prikaz izdelkov'}</span>
        {!flat && filteredNodes.length > 0 ? <button type="button" onClick={() => setCollapsed(allExpanded ? new Set(visibleNodeIds) : new Set())}>
          {allExpanded ? 'Strni vse' : 'Razširi vse'}{allExpanded ? <ChevronUp aria-hidden="true" /> : <ChevronDown aria-hidden="true" />}
        </button> : null}
      </div>
      {hasResults ? flat ? (
        <div className={styles.flatProductList}>
          <SortHeaders />
          {sortedProducts.map(product => <CatalogRow key={product.id} product={product} />)}
        </div>
      ) : filteredNodes.map(node => <CategoryBranch key={node.id} node={node} index={categoryIndex(node.id)} currentHref={currentHref} collapsed={collapsed} toggle={toggle} />) : (
        <div className={styles.emptyState}>
          <Search aria-hidden="true" />
          <h2>{hasFilters ? 'Ni izdelkov, ki ustrezajo izbranim filtrom' : 'Katalog se pripravlja'}</h2>
          <p>{hasFilters ? 'Poskusite drug iskalni izraz ali razširite cenovni razpon.' : 'Za pomoč pri izbiri materialov in opreme se obrnite na nas.'}</p>
          {hasFilters ? <button type="button" onClick={resetFilters}>Počisti filtre</button> : <Link href="/contact">Kontaktirajte nas<ArrowRight aria-hidden="true" /></Link>}
        </div>
      )}
    </section>
  );
}
