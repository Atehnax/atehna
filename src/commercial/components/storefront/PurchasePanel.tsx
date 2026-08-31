'use client';

import Link from 'next/link';
import { ShoppingCart, Truck } from 'lucide-react';
import type { ReactNode } from 'react';
import { useProductAppearance } from '@/commercial/components/ProductAppearanceProvider';
import Availability from '@/commercial/components/storefront/Availability';
import PriceBreakdown from '@/commercial/components/storefront/PriceBreakdown';
import {
  isStorefrontVariantPurchasable,
  type StorefrontVariant
} from '@/commercial/features/products/storefrontProduct';
import {
  resolveProductCanvasElementDeviceSettings,
  type ProductCanvasDevice
} from '@/shared/domain/style/productAppearance';
import { Button } from '@/shared/ui/button';
import ProductCanvasElement, {
  PRODUCT_CANVAS_PROTECTED_ELEMENT_IDS
} from '@/shared/ui/product-canvas/ProductCanvasElement';

type PurchasePanelProps = {
  variant: StorefrontVariant | null;
  selectionComplete: boolean;
  quantity: number;
  onQuantityChange: (quantity: number) => void;
  onAdd: () => void;
  deliveryEstimate?: string;
  canvasDevice?: ProductCanvasDevice;
  canvasWrapper?: (
    elementId: string,
    label: string,
    children: ReactNode,
    className?: string
  ) => ReactNode;
  className?: string;
};

export default function PurchasePanel({
  variant,
  selectionComplete,
  quantity,
  onQuantityChange,
  onAdd,
  deliveryEstimate,
  canvasDevice = 'desktop',
  canvasWrapper,
  className
}: PurchasePanelProps) {
  const appearance = useProductAppearance();
  const copy = appearance.purchaseArea.copy;
  const canvasActive = appearance.canvas?.mode === 'free';
  const localCanvasWrapper = (
    elementId: string,
    label: string,
    children: ReactNode,
    elementClassName = ''
  ) => {
    if (!canvasActive) return children;
    return (
      <ProductCanvasElement
        key={`${elementId}-${canvasDevice}`}
        elementId={elementId}
        label={label}
        settings={resolveProductCanvasElementDeviceSettings(
          appearance,
          elementId,
          canvasDevice
        )}
        active
        forceVisible={PRODUCT_CANVAS_PROTECTED_ELEMENT_IDS.has(elementId)}
        className={elementClassName}
      >
        {children}
      </ProductCanvasElement>
    );
  };
  const wrapCanvasElement = canvasWrapper ?? localCanvasWrapper;
  const minimum = variant?.minOrder ?? 1;
  const maximum =
    typeof variant?.inventory === 'number'
      ? Math.max(minimum, variant.inventory)
      : undefined;
  const canPurchase =
    selectionComplete && isStorefrontVariantPurchasable(variant);
  const primaryActionLabel = !selectionComplete
    ? copy.selectOptionsActionLabel
    : canPurchase
      ? copy.addToCartActionLabel
      : copy.unavailableActionLabel;
  const panelClass =
    appearance.purchaseArea.panelStyle === 'card'
      ? 'site-card storefront-product-purchase-panel'
      : 'border-y border-[color:var(--site-divider-color)] py-5';
  const resolvedDeliveryEstimate =
    variant?.deliveryEstimate ??
    deliveryEstimate ??
    copy.deliveryFallbackMessage;

  const commitQuantity = (value: number) => {
    const normalized = Math.max(minimum, Math.floor(value || minimum));
    onQuantityChange(
      typeof maximum === 'number' ? Math.min(maximum, normalized) : normalized
    );
  };

  return (
    <aside
      className={`storefront-product-purchase-area ${panelClass} ${
        className ?? ''
      }`.trim()}
      aria-label="Nakup izdelka"
    >
      {wrapCanvasElement(
        'product-price',
        'Cena in DDV',
        variant ? (
        <PriceBreakdown
          unitNet={variant.unitNet}
          baseUnitNet={variant.baseUnitNet}
          discountPct={
            variant.discountPct
          }
          taxRate={variant.taxRate}
          unit={variant.unit}
        />
      ) : (
        <p className="text-sm font-semibold text-[color:var(--site-color-text)]">
          {copy.priceSelectionPrompt}
        </p>
        )
      )}

      {appearance.purchaseArea.showAvailability ? (
        wrapCanvasElement(
          'product-availability',
          'Razpoložljivost',
          <Availability
            variant={variant}
            selectionComplete={selectionComplete}
            fallbackDeliveryEstimate={deliveryEstimate}
            className="storefront-product-availability mt-5"
          />
        )
      ) : null}

      {variant && appearance.variants.showSelectedSummary ? (
        wrapCanvasElement(
          'product-summary',
          'Povzetek različice',
          <dl className="mt-4 space-y-1 text-xs text-[color:var(--site-color-text-muted)]">
            <div className="flex justify-between gap-3">
              <dt>{copy.variantLabel}</dt>
              <dd className="text-right font-semibold text-[color:var(--site-color-text)]">
                {variant.name}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt>{copy.skuLabel}</dt>
              <dd className="text-right font-mono text-[color:var(--site-color-text)]">
                {variant.sku}
              </dd>
            </div>
            {appearance.purchaseArea.showMinimumOrder && variant.minOrder > 1 ? (
              <div className="flex justify-between gap-3">
                <dt>{copy.minimumOrderLabel}</dt>
                <dd className="text-right font-semibold text-[color:var(--site-color-text)]">
                  {variant.minOrder} {variant.unit}
                </dd>
              </div>
            ) : null}
          </dl>
        )
      ) : null}

      {appearance.purchaseArea.showQuantityStepper && variant ? (
        wrapCanvasElement(
          'product-quantity',
          'Količina',
          <div className="storefront-product-quantity mt-5">
            {wrapCanvasElement(
              'product-quantity-label',
              'Naslov količine',
              <label
                htmlFor="product-quantity"
                className="block text-sm font-semibold text-[color:var(--site-color-text)]"
              >
                {copy.quantityLabel}
              </label>,
              'mb-2 block'
            )}
            {wrapCanvasElement(
              'product-quantity-controls',
              'Kontrole količine',
              <div className="storefront-product-quantity-controls inline-flex max-w-full items-center align-middle">
                <div className="storefront-product-quantity-stepper inline-flex shrink-0 items-stretch overflow-hidden rounded-[var(--site-field-radius)] border border-[color:var(--site-border-color)] bg-[color:var(--site-field-bg)]">
                  <button
                    type="button"
                    onClick={() => commitQuantity(quantity - 1)}
                    disabled={quantity <= minimum}
                    className="storefront-product-quantity-button inline-flex shrink-0 items-center justify-center text-lg text-[color:var(--site-color-text)] transition hover:bg-[color:var(--site-color-surface-muted)] disabled:cursor-not-allowed disabled:opacity-40"
                    aria-label={copy.decreaseQuantityLabel}
                  >
                    −
                  </button>
                  <input
                    id="product-quantity"
                    type="number"
                    inputMode="numeric"
                    min={minimum}
                    max={maximum}
                    step={1}
                    value={quantity}
                    onChange={(event) => commitQuantity(Number(event.target.value))}
                    className="storefront-product-quantity-input shrink-0 border-x border-y-0 border-[color:var(--site-border-color)] bg-transparent text-center font-semibold text-[color:var(--site-color-text)] outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => commitQuantity(quantity + 1)}
                    disabled={typeof maximum === 'number' && quantity >= maximum}
                    className="storefront-product-quantity-button inline-flex shrink-0 items-center justify-center text-lg text-[color:var(--site-color-text)] transition hover:bg-[color:var(--site-color-surface-muted)] disabled:cursor-not-allowed disabled:opacity-40"
                    aria-label={copy.increaseQuantityLabel}
                  >
                    +
                  </button>
                </div>
                {variant?.unit ? (
                  <span className="storefront-product-quantity-unit ml-2 inline-flex shrink-0 items-center self-center text-xs leading-none text-[color:var(--site-color-text-muted)]">
                    {variant.unit}
                  </span>
                ) : null}
              </div>,
              'inline-flex max-w-full items-center align-middle'
            )}
          </div>
        )
      ) : null}

      <div className="storefront-product-primary-action-slot">
        {wrapCanvasElement(
          'product-primary-action',
          'Primarno dejanje',
          <Button
            type="button"
            variant="primary"
            size="md"
            disabled={!canPurchase}
            onClick={onAdd}
            className={`storefront-product-primary-action ${
              appearance.purchaseArea.fullWidthPrimaryAction ? 'w-full' : ''
            } justify-center`}
          >
            {canPurchase ? (
              <ShoppingCart aria-hidden="true" className="h-5 w-5" />
            ) : null}
            {primaryActionLabel}
          </Button>
        )}
      </div>

      {wrapCanvasElement(
        'product-delivery',
        'Dostava',
        <div className="storefront-product-delivery mt-4 flex items-start gap-3 border-t border-[color:var(--site-divider-color)] text-xs leading-5 text-[color:var(--site-color-text-muted)]">
          <Truck
            aria-hidden="true"
            className="mt-0.5 h-6 w-6 shrink-0 text-[color:var(--site-color-text-muted)]"
          />
          <div className="min-w-0">
            <p className="font-semibold text-[color:var(--site-color-text)]">
              Poštnina se izračuna v košarici glede na skupno težo in mere.
            </p>
            {appearance.purchaseArea.showDeliveryEstimate ? (
              resolvedDeliveryEstimate ? (
                <p>
                  {resolvedDeliveryEstimate}
                </p>
              ) : null
            ) : null}
            {copy.paymentMessage ? <p>{copy.paymentMessage}</p> : null}
          </div>
        </div>
      )}

      {appearance.purchaseArea.showSecondaryAction ? (
        wrapCanvasElement(
          'product-secondary-action',
          'Sekundarno dejanje',
          <Link
            href="/contact"
            className="site-button site-button--secondary mt-3 inline-flex w-full items-center justify-center"
          >
            {copy.secondaryActionLabel}
          </Link>
        )
      ) : null}
    </aside>
  );
}
