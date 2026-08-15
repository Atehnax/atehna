'use client';

import { useMemo, useState } from 'react';
import ProductCard from '@/commercial/components/storefront/ProductCard';
import { useProductAppearance } from '@/commercial/components/ProductAppearanceProvider';
import useProductCanvasDevice from '@/commercial/components/storefront/useProductCanvasDevice';
import type { StorefrontProductSummary } from '@/commercial/features/products/storefrontProduct';
import { resolveProductCanvasElementDeviceSettings } from '@/shared/domain/style/productAppearance';
import ProductCanvasElement from '@/shared/ui/product-canvas/ProductCanvasElement';

type ProductListingProps = {
  products: StorefrontProductSummary[];
  title?: string;
  description?: string;
};

type SortMode = 'recommended' | 'name' | 'price-asc' | 'price-desc';

export default function ProductListing({
  products,
  title = 'Izdelki',
  description
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

  if (products.length === 0) {
    return (
      <section className="site-panel border-dashed p-8 text-center">
        <h2 className="site-heading-3">V tej kategoriji še ni izdelkov</h2>
        <p className="site-paragraph mt-2 text-sm">
          Izdelki bodo prikazani, ko bodo objavljeni v tej kategoriji.
        </p>
      </section>
    );
  }

  return (
    <section aria-labelledby="product-listing-title">
      {canvasActive ? (
        <ProductCanvasElement
          elementId="listing-header"
          label="Glava seznama"
          settings={resolveProductCanvasElementDeviceSettings(
            appearance,
            'listing-header',
            canvasDevice
          )}
          active
          className="mb-5"
        >
          <div className="flex flex-col gap-4 border-b border-[color:var(--site-divider-color)] pb-4 sm:flex-row sm:items-end sm:justify-between">
            <ProductListingHeader
              title={title}
              description={description}
              productCount={products.length}
              appearance={appearance}
              mode={mode}
              sort={sort}
              onModeChange={setSelectedMode}
              onSortChange={setSort}
            />
          </div>
        </ProductCanvasElement>
      ) : (
        <div className="mb-5 flex flex-col gap-4 border-b border-[color:var(--site-divider-color)] pb-4 sm:flex-row sm:items-end sm:justify-between">
          <ProductListingHeader
            title={title}
            description={description}
            productCount={products.length}
            appearance={appearance}
            mode={mode}
            sort={sort}
            onModeChange={setSelectedMode}
            onSortChange={setSort}
          />
        </div>
      )}

      <div
        className={
          mode === 'grid'
            ? 'storefront-product-grid'
            : 'grid gap-[var(--product-listing-gap,20px)]'
        }
        data-card-density={appearance.listings.cardDensity}
      >
        {sortedProducts.map((product) => (
          <ProductCard key={product.id} product={product} layout={mode} />
        ))}
      </div>
    </section>
  );
}

function ProductListingHeader({
  title,
  description,
  productCount,
  appearance,
  mode,
  sort,
  onModeChange,
  onSortChange
}: {
  title: string;
  description?: string;
  productCount: number;
  appearance: ReturnType<typeof useProductAppearance>;
  mode: 'grid' | 'list';
  sort: SortMode;
  onModeChange: (mode: 'grid' | 'list') => void;
  onSortChange: (sort: SortMode) => void;
}) {
  return (
    <>
        <div>
          <h2 id="product-listing-title" className="site-heading-2">
            {title}
          </h2>
          {description ? (
            <p className="site-paragraph mt-2">{description}</p>
          ) : null}
          <p className="mt-1 text-sm text-[color:var(--site-color-text-muted)]">
            {productCount} {productCount === 1 ? 'izdelek' : 'izdelkov'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
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
          <label className="flex items-center gap-2 text-sm font-semibold text-[color:var(--site-color-text)]">
            Razvrsti
            <select
              className="site-field min-w-44"
              value={sort}
              onChange={(event) => onSortChange(event.target.value as SortMode)}
            >
              <option value="recommended">Priporočeno</option>
              <option value="name">Po imenu</option>
              <option value="price-asc">Cena: nižja najprej</option>
              <option value="price-desc">Cena: višja najprej</option>
            </select>
          </label>
        </div>
    </>
  );
}
