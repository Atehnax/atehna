'use client';

import { useCallback, useDeferredValue, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronDown, CircleHelp, List, Search, SlidersHorizontal, X } from 'lucide-react';
import type { ProductCanvasDevice } from '@/shared/domain/style/productAppearance';
import type { CatalogBrowserProps, CatalogBrowserShellData } from '@/commercial/catalog/catalogBrowserTypes';
import { CATALOG_ALL_PRODUCTS_HREF, toPublicCatalogSlug } from '@/commercial/catalog/catalogRoutes';
import { getCatalogAllProductsPresentation } from '@/commercial/catalog/catalogBrowserAllProducts';
import type { CatalogBrowserSort } from '@/commercial/catalog/catalogBrowserFilters';
import { mergeCatalogBrowserPage } from '@/commercial/catalog/catalogBrowserSnapshot';
import CatalogBrowserResults from './CatalogBrowserResults';
import { CatalogBrowserContext, CatalogBrowserDataContext } from './CatalogBrowserContext';
import StorefrontBreadcrumbs from './StorefrontBreadcrumbs';
import styles from './CatalogBrowser.module.css';
import CatalogCanvasElement, { CatalogCanvasContext, type CatalogCanvasWrapper } from './CatalogCanvasElement';

const parsePrice = (value: string) => {
  if (!value.trim()) return null;
  const parsed = Number(value.replace(',', '.'));
  return Number.isFinite(parsed) ? Math.max(0, parsed) : null;
};

export default function CatalogBrowserShell({ data, children }: { data: CatalogBrowserShellData; children: ReactNode }) {
  const pathname = usePathname();
  const href = '/' + pathname.split('/').filter(Boolean).map(toPublicCatalogSlug).join('/');
  const [state, setState] = useState({ source: data, snapshot: data, invalid: new Set<string>() });
  if (state.source !== data) {
    const root = data.routes.find(route => route.currentHref === '/products');
    setState({
      source: data,
      snapshot: root ? mergeCatalogBrowserPage(state.snapshot, { ...root, nodes: data.nodes, navigation: data.navigation }) : data,
      invalid: new Set()
    });
  }
  const publishPage = useCallback((page: CatalogBrowserProps) => {
    // Ignore a superseded route payload if another navigation already committed.
    if (page.currentHref !== href) return;
    setState(previous => {
      const snapshot = mergeCatalogBrowserPage(previous.snapshot, page);
      if (snapshot === previous.snapshot && !previous.invalid.has(page.currentHref)) return previous;
      const invalid = new Set(previous.invalid);
      invalid.delete(page.currentHref);
      return { ...previous, snapshot, invalid };
    });
  }, [href]);
  const invalidatePage = useCallback((path: string) => setState(previous => {
    const normalized = '/' + path.split('/').filter(Boolean).map(toPublicCatalogSlug).join('/');
    if (previous.invalid.has(normalized)) return previous;
    return { ...previous, invalid: new Set(previous.invalid).add(normalized) };
  }), []);
  const updates = useMemo(() => ({ publishPage, invalidatePage }), [publishPage, invalidatePage]);
  const route = state.snapshot.routes.find(entry => entry.currentHref === (href === CATALOG_ALL_PRODUCTS_HREF ? '/products' : href));
  const page = state.invalid.has(href) || !route ? undefined : href === CATALOG_ALL_PRODUCTS_HREF
    ? { ...route, ...getCatalogAllProductsPresentation() } : route;
  return (
    <CatalogBrowserDataContext.Provider value={updates}>
      {page ? (
        <CatalogBrowserView page={page} navigation={state.snapshot.navigation} nodes={state.snapshot.nodes}>
          {children}
        </CatalogBrowserView>
      ) : children}
    </CatalogBrowserDataContext.Provider>
  );
}

export function CatalogBrowserView({ page, navigation, nodes, children, canvasWrapper, representativeProductId, canvasDevice }: {
  page: CatalogBrowserShellData['routes'][number];
  navigation: CatalogBrowserShellData['navigation'];
  nodes: CatalogBrowserShellData['nodes'];
  children?: ReactNode;
  canvasWrapper?: CatalogCanvasWrapper;
  representativeProductId?: string;
  canvasDevice?: ProductCanvasDevice;
}) {
  const { title, description, breadcrumbs, currentHref, priceBounds: bounds } = page;
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);
  const [inStockOnly, setInStockOnly] = useState(false);
  const allProducts = currentHref === CATALOG_ALL_PRODUCTS_HREF;
  const [sortChoice, setSort] = useState<CatalogBrowserSort>('name');
  const sort = sortChoice === 'recommended' ? 'name' : sortChoice;
  const [minInput, setMinInput] = useState('');
  const [maxInput, setMaxInput] = useState('');
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const minPrice = parsePrice(minInput);
  const maxPrice = parsePrice(maxInput);
  const invalidRange = minPrice !== null && maxPrice !== null && minPrice > maxPrice;
  const sliderMax = Math.max(1, Math.ceil(bounds.max));
  const sliderMinValue = Math.min(sliderMax, minPrice ?? 0);
  const sliderMaxValue = Math.min(sliderMax, maxPrice ?? sliderMax);
  const hasFilters = Boolean(query.trim() || inStockOnly || minInput || maxInput);
  const expandResults = useCallback(() => setCollapsed(new Set()), []);
  const resetFilters = useCallback(() => {
    setQuery(''); setInStockOnly(false); setMinInput(''); setMaxInput(''); expandResults();
  }, [expandResults]);
  const toggle = useCallback((id: string) => setCollapsed(previous => {
    const next = new Set(previous);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  }), []);

  const filters = useMemo(() => ({ query: deferredQuery, inStockOnly, minPrice, maxPrice, sort }), [deferredQuery, inStockOnly, minPrice, maxPrice, sort]);
  const context = useMemo(() => ({
    filters, isFiltering: query !== deferredQuery, hasFilters, collapsed, setCollapsed,
    resetFilters, toggle, navigation, setSort
  }), [filters, query, deferredQuery, hasFilters, collapsed, resetFilters, toggle, navigation]);

  return (
    <CatalogCanvasContext.Provider value={{ wrapper: canvasWrapper, representativeProductId, device: canvasDevice }}>
    <CatalogBrowserContext.Provider value={context}>
      <div className={styles.surface}>
        <div className={`container-base ${styles.catalog}`}>
          <StorefrontBreadcrumbs breadcrumbs={breadcrumbs} className={styles.breadcrumbs} scroll={false} />
          <CatalogCanvasElement id="catalog-heading" label="Naslov in opis kataloga">
          <header className={styles.intro}>
            <h1>{title}</h1>
            <p>{description || 'Materiali, orodja in oprema za šole in delavnice.'}</p>
          </header>
          </CatalogCanvasElement>

          <CatalogCanvasElement id="catalog-search" label="Iskanje po katalogu">
          <div className={styles.toolbar} role="search" aria-label="Poiščite izdelke v katalogu">
            <label className={styles.search}>
              <Search aria-hidden="true" />
              <input type="search" value={query} onChange={event => { setQuery(event.target.value); expandResults(); }} placeholder="Poiščite izdelek, material ali oznako ..." aria-label="Poiščite izdelek, material ali oznako" />
            </label>
          </div>

          </CatalogCanvasElement>

          <div className={styles.layout}>
            <aside className={styles.sidebar} aria-label="Kategorije in filtri">
              <button type="button" className={styles.mobileFilterToggle} onClick={() => setMobileFiltersOpen(value => !value)} aria-expanded={mobileFiltersOpen} aria-controls="catalog-sidebar-content">
                <SlidersHorizontal aria-hidden="true" />Kategorije in filtri<ChevronDown aria-hidden="true" data-collapsed={!mobileFiltersOpen} />
              </button>
              <div id="catalog-sidebar-content" className={styles.sidebarContent} data-open={mobileFiltersOpen}>
                <CatalogCanvasElement id="catalog-categories" label="Stranski meni kategorij">
                <nav aria-label="Kategorije" className={styles.categoryNav}>
                  <h2>Kategorije</h2>
                  <ol>
                    <li><Link href={CATALOG_ALL_PRODUCTS_HREF} scroll={false} aria-current={allProducts ? 'location' : undefined}>
                      <List aria-hidden="true" className={styles.allCategoriesIcon} /><span>Vse kategorije</span>
                    </Link></li>
                    {navigation.map((category, index) => {
                      const active = currentHref === category.href || currentHref.startsWith(`${category.href}/`);
                      return <li key={category.id}><Link href={category.href} scroll={false} aria-current={active ? 'location' : undefined}>
                        <span>{String(index + 1).padStart(2, '0')}</span><span>{category.title}</span>
                      </Link></li>;
                    })}
                  </ol>
                </nav>
                </CatalogCanvasElement>

                <CatalogCanvasElement id="catalog-stock-filter" label="Filter dobavljivosti">
                <fieldset className={styles.availabilityFilter}>
                  <legend>Dobavljivost</legend>
                  <label className={styles.stockFilter}>
                    <input type="checkbox" checked={inStockOnly} onChange={event => { setInStockOnly(event.target.checked); expandResults(); }} />
                    <span>Na zalogi</span>
                  </label>
                </fieldset>

                </CatalogCanvasElement>
                <CatalogCanvasElement id="catalog-price-filter" label="Cenovni filter">
                <fieldset className={styles.priceFilter}>
                  <legend>Cena</legend>
                  <p>Cena z DDV</p>
                  <div className={styles.priceSlider} style={{ '--range-start': `${sliderMinValue / sliderMax * 100}%`, '--range-end': `${sliderMaxValue / sliderMax * 100}%` } as CSSProperties}>
                    <div className={styles.sliderTrack} />
                    <input type="range" style={{ zIndex: sliderMinValue > 0 && sliderMinValue >= sliderMaxValue ? 2 : 0 }} min="0" max={sliderMax} step="0.01" value={sliderMinValue} disabled={bounds.max <= 0} aria-label="Najnižja cena na drsniku" onChange={event => { setMinInput(String(Math.min(Number(event.target.value), sliderMaxValue))); expandResults(); }} />
                    <input type="range" min="0" max={sliderMax} step="0.01" value={sliderMaxValue} disabled={bounds.max <= 0} aria-label="Najvišja cena na drsniku" onChange={event => { setMaxInput(String(Math.max(Number(event.target.value), sliderMinValue))); expandResults(); }} />
                  </div>
                  <div className={styles.priceInputs}>
                    <label><span>Od</span><span className={styles.priceInput}><input type="number" min="0" step="0.01" inputMode="decimal" placeholder="0" value={minInput} onChange={event => { setMinInput(event.target.value); expandResults(); }} aria-label="Najnižja cena v evrih" aria-invalid={invalidRange} /><span>€</span></span></label>
                    <span className={styles.priceDash} aria-hidden="true">–</span>
                    <label><span>Do</span><span className={styles.priceInput}><input type="number" min="0" step="0.01" inputMode="decimal" placeholder={String(sliderMax)} value={maxInput} onChange={event => { setMaxInput(event.target.value); expandResults(); }} aria-label="Najvišja cena v evrih" aria-invalid={invalidRange} /><span>€</span></span></label>
                  </div>
                  {invalidRange ? <p className={styles.rangeError} role="alert">Najnižja cena ne sme presegati najvišje.</p> : null}
                  {hasFilters ? <button className={styles.clearFilters} type="button" onClick={resetFilters}><X aria-hidden="true" />Počisti filtre</button> : null}
                </fieldset>
                </CatalogCanvasElement>
                <Link href="/contact" className={styles.helpLink}><CircleHelp aria-hidden="true" />Potrebujete pomoč?</Link>
              </div>
            </aside>

            <CatalogBrowserResults nodes={nodes} currentHref={currentHref} />
            {children}
          </div>
        </div>
      </div>
    </CatalogBrowserContext.Provider>
    </CatalogCanvasContext.Provider>
  );
}
