'use client';

import { useMemo, useState, type ReactNode } from 'react';
import ProductCard from '@/commercial/components/storefront/ProductCard';
import { useProductAppearance } from '@/commercial/components/ProductAppearanceProvider';
import useProductCanvasDevice from '@/commercial/components/storefront/useProductCanvasDevice';
import type { StorefrontProductSummary } from '@/commercial/features/products/storefrontProduct';
import {
  resolveProductCanvasElementDeviceSettings,
  type ProductAppearanceConfig
} from '@/shared/domain/style/productAppearance';
import ProductCanvasElement from '@/shared/ui/product-canvas/ProductCanvasElement';

type ProductListingProps = {
  products: StorefrontProductSummary[];
  title: string;
  description?: string | null;
  secondaryDescription?: string | null;
  children?: ReactNode;
};

type SortMode = 'recommended' | 'name' | 'price-asc' | 'price-desc';

export default function ProductListing({
  products,
  title,
  description,
  secondaryDescription,
  children
}: ProductListingProps) {
  const appearance = useProductAppearance();
  const canvasDevice = useProductCanvasDevice();
  const canvasActive = appearance.canvas?.mode === 'free';
  const [sort, setSort] = useState<SortMode>('recommended');
  const [selectedMode, setSelectedMode] = useState<'grid' | 'list'>(
    appearance.listings.defaultMode
  );
  const mode =
    appearance.listings.availableModes === 'both'
      ? selectedMode
      : appearance.listings.availableModes;
  const sortedProducts = useMemo(() => {
    const next = [...products];
    if (sort === 'name') {
      next.sort((left, right) =>
        left.name.localeCompare(right.name, 'sl', { sensitivity: 'base' })
      );
    } else if (sort === 'price-asc') {
      next.sort((left, right) => left.minUnitNet - right.minUnitNet);
    } else if (sort === 'price-desc') {
      next.sort((left, right) => right.minUnitNet - left.minUnitNet);
    }
    return next;
  }, [products, sort]);
  const toolbar = products.length > 0 ? (
    canvasActive ? (
      <ProductCanvasElement
        elementId="listing-header"
        label="Glava seznama"
        settings={resolveProductCanvasElementDeviceSettings(
          appearance,
          'listing-header',
          canvasDevice
        )}
        active
      >
        <ProductListingToolbar
          appearance={appearance}
          mode={mode}
          sort={sort}
          onModeChange={setSelectedMode}
          onSortChange={setSort}
        />
      </ProductCanvasElement>
    ) : (
      <ProductListingToolbar
        appearance={appearance}
        mode={mode}
        sort={sort}
        onModeChange={setSelectedMode}
        onSortChange={setSort}
      />
    )
  ) : null;

  return (
    <section aria-label="Izdelki">
      <ProductListingHeader
        title={title}
        description={description}
        secondaryDescription={secondaryDescription}
        productCount={products.length}
        toolbar={toolbar}
      />

      {children}

      {products.length === 0 ? (
        <section className="site-panel mt-8 border-dashed p-8 text-center">
          <h2 className="site-heading-3">V tej kategoriji še ni izdelkov</h2>
          <p className="site-paragraph mt-2 text-sm">
            Izdelki bodo prikazani, ko bodo objavljeni v tej kategoriji.
          </p>
        </section>
      ) : (
        <div
          className={`${children ? 'mt-12 ' : 'mt-5 '}${
            mode === 'grid'
              ? 'storefront-product-grid'
              : 'grid gap-[var(--product-listing-gap,20px)]'
          }`}
          data-card-density={appearance.listings.cardDensity}
        >
          {sortedProducts.map((product) => (
            <ProductCard key={product.id} product={product} layout={mode} />
          ))}
        </div>
      )}
    </section>
  );
}

export function ProductListingHeader({
  title,
  description,
  secondaryDescription,
  productCount,
  toolbar
}: {
  title: string;
  description?: string | null;
  secondaryDescription?: string | null;
  productCount: number;
  toolbar?: ReactNode;
}) {
  return (
    <header className="border-b border-[color:var(--site-divider-color)] pb-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0 flex-1">
          <h1 className="site-heading-2">{title}</h1>
          <p className="mt-2 text-sm text-[color:var(--site-color-text-muted)]">
            {productCount} {productCount === 1 ? 'izdelek' : 'izdelkov'}
          </p>
          {description ? (
            <p className="mt-3 max-w-xl text-[length:calc(0.9375rem/var(--commercial-storefront-scale))] leading-7 text-[color:var(--site-color-text-muted)]">
              {description}
            </p>
          ) : null}
          {secondaryDescription ? (
            <p className="mt-2 max-w-xl text-[length:calc(0.8125rem/var(--commercial-storefront-scale))] leading-6 text-[color:var(--site-color-text-muted)]">
              {secondaryDescription}
            </p>
          ) : null}
        </div>

        {toolbar}
      </div>
    </header>
  );
}

export function ProductListingToolbar({
  appearance,
  mode,
  sort,
  onModeChange,
  onSortChange
}: {
  appearance: ProductAppearanceConfig;
  mode: 'grid' | 'list';
  sort: SortMode;
  onModeChange: (mode: 'grid' | 'list') => void;
  onSortChange: (sort: SortMode) => void;
}) {
  return (
    <div className="flex shrink-0 flex-wrap items-center gap-3">
      {appearance.listings.availableModes === 'both' ? (
        <div
          className="inline-flex overflow-hidden rounded-[var(--site-field-radius)] border border-[color:var(--site-border-color)]"
          aria-label="Pogled izdelkov"
        >
          {(['grid', 'list'] as const).map((candidate) => (
            <button
              key={candidate}
              type="button"
              onClick={() => onModeChange(candidate)}
              aria-pressed={mode === candidate}
              className={`min-h-10 px-3 text-sm font-semibold ${
                mode === candidate
                  ? 'bg-[color:var(--site-color-primary)] text-[color:var(--site-color-primary-foreground)]'
                  : 'bg-[color:var(--site-color-surface)] text-[color:var(--site-color-text)]'
              }`}
            >
              {candidate === 'grid' ? 'Mreža' : 'Seznam'}
            </button>
          ))}
        </div>
      ) : null}
      <select
        aria-label="Razvrsti"
        className="site-field storefront-product-listing-sort-select"
        value={sort}
        onChange={(event) => onSortChange(event.target.value as SortMode)}
      >
        <option value="recommended">Razvrsti po: Priporočeno</option>
        <option value="name">Razvrsti po: Imenu</option>
        <option value="price-asc">Razvrsti po: Najnižji ceni</option>
        <option value="price-desc">Razvrsti po: Najvišji ceni</option>
      </select>
    </div>
  );
}
