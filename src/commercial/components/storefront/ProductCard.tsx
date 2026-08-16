'use client';

import Image from 'next/image';
import Link from 'next/link';
import { ShoppingCart } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import AddToCartButton from '@/commercial/features/products/AddToCartButton';
import { buildProductCartItem } from '@/commercial/features/products/productCart';
import type { StorefrontProductSummary } from '@/commercial/features/products/storefrontProduct';
import { useProductAppearance } from '@/commercial/components/ProductAppearanceProvider';
import Availability from '@/commercial/components/storefront/Availability';
import PriceBreakdown from '@/commercial/components/storefront/PriceBreakdown';
import useProductCanvasDevice from '@/commercial/components/storefront/useProductCanvasDevice';
import { resolveProductCanvasElementDeviceSettings } from '@/shared/domain/style/productAppearance';
import ProductCanvasElement from '@/shared/ui/product-canvas/ProductCanvasElement';

type ProductCardProps = {
  product: StorefrontProductSummary;
  layout?: 'grid' | 'list';
  presentation?: 'listing' | 'related';
  className?: string;
  canvasWrapper?: (
    elementId: string,
    label: string,
    children: ReactNode,
    className?: string
  ) => ReactNode;
};

const densityClasses = {
  compact: 'p-3',
  comfortable: 'p-4',
  spacious: 'p-5'
} as const;

export default function ProductCard({
  product,
  layout = 'grid',
  presentation = 'listing',
  className,
  canvasWrapper
}: ProductCardProps) {
  const appearance = useProductAppearance();
  const isRelated = presentation === 'related';
  const isCompactListing =
    !isRelated && appearance.listings.cardDensity === 'compact';
  const canvasDevice = useProductCanvasDevice();
  const canvasActive = appearance.canvas?.mode === 'free' || Boolean(canvasWrapper);
  const localCanvasWrapper = (
    elementId: string,
    label: string,
    children: ReactNode,
    canvasClassName = ''
  ) => {
    if (!canvasActive) return children;
    return (
      <ProductCanvasElement
        elementId={elementId}
        label={label}
        settings={resolveProductCanvasElementDeviceSettings(
          appearance,
          elementId,
          canvasDevice
        )}
        active
        className={canvasClassName}
      >
        {children}
      </ProductCanvasElement>
    );
  };
  const wrapCanvasElement = canvasWrapper ?? localCanvasWrapper;
  const canvasId = (listingId: string, relatedId: string) =>
    isRelated ? relatedId : listingId;
  const quickVariant = product.purchasableVariant;
  const minimumQuantity = Math.max(1, quickVariant?.minOrder ?? 1);
  const maximumQuantity =
    typeof quickVariant?.inventory === 'number'
      ? Math.max(minimumQuantity, quickVariant.inventory)
      : undefined;
  const [relatedQuantityInput, setRelatedQuantityInput] = useState(
    minimumQuantity
  );
  const relatedQuantity = Math.min(
    maximumQuantity ?? Number.POSITIVE_INFINITY,
    Math.max(
      minimumQuantity,
      Math.floor(relatedQuantityInput || minimumQuantity)
    )
  );
  const displayVariant = product.displayVariant;
  const canQuickAdd =
    appearance.listings.allowSimpleQuickAdd &&
    appearance.listings.showPurchaseAction &&
    quickVariant !== null &&
    quickVariant.commerceId !== null;
  const cartItem = quickVariant
    ? buildProductCartItem({
        productId: product.id,
        productSlug: product.slug,
        productHref: product.href,
        productName: product.name,
        category: product.categoryLabel,
        image: product.image,
        variant: quickVariant
      })
    : null;
  const inlineRelatedPurchase =
    isRelated && canQuickAdd && cartItem !== null;

  const card = (
    <article
      data-product-card-layout={isRelated ? undefined : layout}
      className={`site-panel storefront-product-card group h-full min-w-0 overflow-hidden transition-colors duration-200 ${
        isRelated ? '' : 'storefront-product-listing-card'
      } ${
        isRelated ? 'storefront-related-product-card' : ''
      } ${
        isRelated
          ? 'storefront-related-product-card-layout grid'
          : layout === 'list'
            ? 'grid grid-cols-[8rem_minmax(0,1fr)] sm:grid-cols-[12rem_minmax(0,1fr)]'
            : 'flex flex-col'
      } ${
        className ?? ''
      }`.trim()}
    >
      {wrapCanvasElement(
        canvasId('card-image', 'product-related-card-image'),
        'Slika kartice',
        <Link
          href={product.href}
          prefetch={false}
          className={`storefront-product-card-media storefront-product-card-image-frame relative block overflow-hidden ${
            isRelated
              ? 'bg-[color:var(--site-card-bg)]'
              : 'bg-[color:var(--site-color-surface-muted)]'
          }`}
          style={isRelated
            ? undefined
            : { aspectRatio: 'var(--product-card-image-ratio, 1 / 1)' }}
          aria-label={product.name}
        >
          {product.image ? (
            <Image
              src={product.image.url}
              alt={product.image.altText || product.name}
              fill
              sizes="(min-width: 1280px) 25vw, (min-width: 768px) 50vw, 100vw"
              className={`storefront-product-card-image transition duration-300 group-hover:scale-[1.03] ${
                isRelated ? 'p-3' : ''
              }`}
            />
          ) : (
            <div className="flex h-full items-center justify-center px-5 text-center text-xs text-[color:var(--site-color-text-muted)]">
              Slika še ni objavljena
            </div>
          )}

          {product.badge ? (
            <span className="site-radius-pill absolute left-3 top-3 bg-[color:var(--site-color-primary)] px-2.5 py-1 text-xs font-semibold text-[color:var(--site-color-primary-foreground)]">
              {product.badge}
            </span>
          ) : null}
          {!isRelated &&
          appearance.listings.showDiscount &&
          product.discountPct > 0 ? (
            <span className="site-radius-pill absolute right-3 top-3 bg-[color:var(--site-color-success)] px-2.5 py-1 text-xs font-semibold text-white">
              −{Math.round(product.discountPct)} %
            </span>
          ) : null}
        </Link>,
        'min-w-0'
      )}

      {wrapCanvasElement(
        canvasId('card-content', 'product-related-card-content'),
        'Vsebina kartice',
        <div
          className={`storefront-product-card-content flex flex-1 flex-col ${
            densityClasses[appearance.listings.cardDensity]
          }`}
        >
        {product.categoryLabel ? (
          wrapCanvasElement(
            canvasId('card-category', 'product-related-card-category'),
            'Kategorija kartice',
            <p className={`site-eyebrow storefront-product-card-category truncate ${
              isCompactListing ? 'mb-1' : 'mb-2'
            }`}>
              {product.categoryLabel}
            </p>
          )
        ) : null}
        {!isRelated && appearance.listings.showBrand && product.brand ? (
          wrapCanvasElement(
            canvasId('card-brand', 'product-related-card-brand'),
            'Blagovna znamka',
            <p className="storefront-product-card-brand mb-1 truncate text-xs font-semibold text-[color:var(--site-color-text-muted)]">
              {product.brand}
            </p>
          )
        ) : null}
        {wrapCanvasElement(
          canvasId('card-title', 'product-related-card-title'),
          'Naziv kartice',
          <Link href={product.href} prefetch={false} className="block">
            <h2
              className="storefront-product-card-title font-semibold leading-snug text-[color:var(--site-color-text)] transition group-hover:text-[color:var(--site-color-primary)]"
              style={{
                display: '-webkit-box',
                WebkitBoxOrient: 'vertical',
                WebkitLineClamp: appearance.listings.titleLines,
                overflow: 'hidden'
              }}
            >
              {product.name}
            </h2>
          </Link>
        )}

        {(isRelated || appearance.listings.showShortDescription) &&
        product.shortDescription ? (
          wrapCanvasElement(
            canvasId('card-description', 'product-related-card-description'),
            'Opis kartice',
            <p className={`storefront-product-card-description text-[color:var(--site-color-text-muted)] ${
              isRelated
                ? 'mt-1 line-clamp-1 text-xs leading-4'
                : 'mt-2 line-clamp-2 text-sm leading-5'
            }`}>
              {product.shortDescription}
            </p>
          )
        ) : null}
        {!isRelated && appearance.listings.showSku && product.sku ? (
          wrapCanvasElement(
            'card-sku',
            'SKU kartice',
            <p className="storefront-product-card-sku mt-2 truncate font-mono text-[11px] text-[color:var(--site-color-text-muted)]">
              SKU: {product.sku}
            </p>
          )
        ) : null}

        <div
          className={
            inlineRelatedPurchase
              ? 'storefront-related-product-purchase-row'
              : 'contents'
          }
        >
        <div
          className={
            inlineRelatedPurchase
              ? 'min-w-0'
              : isRelated
                ? 'mt-1'
                : isCompactListing
                  ? 'mt-2'
                  : 'mt-4'
          }
        >
          <PriceBreakdown
            unitNet={product.minUnitNet}
            baseUnitNet={product.baseUnitNet}
            maxUnitNet={
              appearance.pricing.listingUsesPriceRange
                ? product.maxUnitNet
                : undefined
            }
            discountPct={
              product.discountPct
            }
            taxRate={product.taxRate}
            unit={product.unit}
            compact
            listingCard
            className="storefront-product-card-price"
            priceWrapper={
              canvasActive
                ? (children) =>
                    wrapCanvasElement(
                      canvasId('card-price', 'product-related-card-price'),
                      'Cena kartice',
                      children
                    )
                : undefined
            }
          />
        </div>

        {!isRelated && appearance.listings.showStock && !product.hasMultipleVariants ? (
          wrapCanvasElement(
            'card-stock',
            'Zaloga kartice',
            <Availability
              variant={displayVariant}
              selectionComplete={!product.hasMultipleVariants}
              compact
              className={`storefront-product-card-availability ${
                isRelated || isCompactListing ? 'mt-2' : 'mt-3'
              }`}
            />
          )
        ) : null}

        {appearance.listings.showPurchaseAction ? (
          wrapCanvasElement(
            canvasId('card-action', 'product-related-card-action'),
            'Dejanje kartice',
            <div
              className={`storefront-product-card-action ${
                inlineRelatedPurchase ? '' : 'mt-auto'
              } ${
                inlineRelatedPurchase
                  ? ''
                  : isRelated || isCompactListing
                    ? 'pt-2'
                    : 'pt-4'
              }`}
            >
              {canQuickAdd && cartItem ? (
                isRelated ? (
                  <div className="storefront-related-product-quick-add flex min-w-0 items-center gap-2">
                    <label
                      htmlFor={`related-product-quantity-${product.id}`}
                      className="sr-only"
                    >
                      {appearance.purchaseArea.copy.quantityLabel}
                    </label>
                    {wrapCanvasElement(
                      'product-related-card-quantity',
                      'Količina sorodnega artikla',
                      <input
                        id={`related-product-quantity-${product.id}`}
                        type="number"
                        inputMode="numeric"
                        min={minimumQuantity}
                        max={maximumQuantity}
                        step={1}
                        value={relatedQuantity}
                        onChange={(event) =>
                          setRelatedQuantityInput(Number(event.target.value))
                        }
                        className="site-field storefront-related-product-quantity h-full w-full text-center font-semibold tabular-nums"
                      />,
                      'min-w-0 shrink-0'
                    )}
                    {wrapCanvasElement(
                      'product-related-card-add',
                      'Dodaj sorodni artikel',
                      <AddToCartButton
                        item={cartItem}
                        quantity={relatedQuantity}
                        className="storefront-related-product-cart-button h-full w-full justify-center"
                      >
                        <ShoppingCart aria-hidden="true" className="h-5 w-5" />
                        <span className="sr-only">
                          {appearance.purchaseArea.copy.addToCartActionLabel}
                        </span>
                      </AddToCartButton>,
                      'shrink-0'
                    )}
                  </div>
                ) : (
                  <AddToCartButton
                    item={cartItem}
                    className="w-full justify-center"
                  >
                    {appearance.purchaseArea.copy.addToCartActionLabel}
                  </AddToCartButton>
                )
              ) : (
                <Link
                  href={product.href}
                  prefetch={false}
                  className={`site-button inline-flex w-full items-center justify-center ${
                    isRelated || !product.isAvailable
                      ? 'site-button--secondary'
                      : ''
                  }`}
                >
                  {product.isAvailable ? 'Izberi različico' : 'Preveri izdelek'}
                </Link>
              )}
            </div>,
            inlineRelatedPurchase ? 'min-w-0' : 'mt-auto'
          )
        ) : null}
        </div>
        </div>,
        'flex min-w-0 flex-1'
      )}
    </article>
  );

  return wrapCanvasElement(
    canvasId('listing-card', 'product-related-card'),
    'Kartica artikla',
    card,
    `h-full min-w-0 ${
      isRelated ? 'storefront-related-product-card-shell' : ''
    }`
  );
}
