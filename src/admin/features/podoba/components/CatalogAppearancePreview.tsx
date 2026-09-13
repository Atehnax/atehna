'use client';

import { useMemo, useState, type MouseEvent } from 'react';
import type { ProductCanvasDevice } from '@/shared/domain/style/productAppearance';
import { scopeCatalogBrowserNodes } from '@/commercial/catalog/catalogBrowserSnapshot';
import type { StorefrontProduct } from '@/commercial/features/products/storefrontProduct';
import { toCatalogBrowserProduct } from '@/commercial/catalog/catalogBrowserProduct';
import type { CatalogBrowserNode, CatalogBrowserShellData } from '@/commercial/catalog/catalogBrowserTypes';
import { CATALOG_ALL_PRODUCTS_HREF } from '@/commercial/catalog/catalogRoutes';
import { getCatalogAllProductsPresentation } from '@/commercial/catalog/catalogBrowserAllProducts';
import { collectCatalogProducts } from '@/commercial/catalog/catalogBrowserFilters';
import { CatalogBrowserView } from '@/commercial/components/storefront/CatalogBrowserShell';
import type { CatalogCanvasWrapper } from '@/commercial/components/storefront/CatalogCanvasElement';
import styles from './CatalogAppearancePreview.module.css';

export default function CatalogAppearancePreview({
  data, device, product: draftProduct, canvasWrapper, interactive, onOpenProduct
}: {
  data: CatalogBrowserShellData;
  device: ProductCanvasDevice;
  product?: StorefrontProduct | null;
  canvasWrapper?: CatalogCanvasWrapper;
  interactive: boolean;
  onOpenProduct?: (slug: string) => void;
}) {
  const [href, setHref] = useState('/products');
  const [editing, setEditing] = useState(true);
  const nodes = useMemo(() => {
    if (!draftProduct) return data.nodes;
    const applyDraft = (entries: CatalogBrowserNode[]): CatalogBrowserNode[] => entries.map(node => ({
      ...node,
      products: node.products.map(item => item.id === draftProduct.id || item.slug === draftProduct.slug
        ? toCatalogBrowserProduct(draftProduct, item.categoryLabel) : item),
      children: applyDraft(node.children)
    }));
    return applyDraft(data.nodes);
  }, [data.nodes, draftProduct]);
  const products = useMemo(() => collectCatalogProducts(nodes), [nodes]);
  const route = data.routes.find(entry => entry.currentHref === (href === CATALOG_ALL_PRODUCTS_HREF ? '/products' : href))
    ?? data.routes[0];
  const page = route && href === CATALOG_ALL_PRODUCTS_HREF
    ? { ...route, ...getCatalogAllProductsPresentation() } : route;
  const visibleProducts = page ? collectCatalogProducts(scopeCatalogBrowserNodes(nodes, page.currentHref)) : products;
  const isEditing = interactive && editing;
  const navigate = (event: MouseEvent<HTMLDivElement>) => {
    if (!(event.target instanceof Element)) return;
    const link = event.target.closest('a');
    if (!link) return;
    event.preventDefault();
    const path = new URL(link.href, window.location.origin).pathname;
    if (path === CATALOG_ALL_PRODUCTS_HREF || data.routes.some(entry => entry.currentHref === path)) {
      setHref(path);
    } else {
      const product = products.find(entry => entry.href === path);
      if (product && !isEditing) onOpenProduct?.(product.slug);
    }
  };

  if (!page) return <p className="p-6 text-sm text-slate-500">Katalog še nima kategorij.</p>;

  return (
    <div className={styles.preview} onClickCapture={navigate}>
      <div className={styles.notice}>
        <p>Prikaz je enak javnemu katalogu in vsebuje aktivne artikle.</p>
        {interactive ? (
          <button type="button" aria-pressed={!editing} onClick={() => setEditing(value => !value)}>
            {editing ? 'Preizkusi povezave in filtre' : 'Uredi videz'}
          </button>
        ) : null}
      </div>
      <CatalogBrowserView canvasDevice={device} page={page} navigation={data.navigation} nodes={nodes}
        representativeProductId={visibleProducts.find(item => item.slug === draftProduct?.slug)?.id ?? visibleProducts[0]?.id}
        canvasWrapper={isEditing ? canvasWrapper : undefined} />
    </div>
  );
}
