'use client';

import Link from 'next/link';
import { ShoppingCart, Truck, Wallet } from 'lucide-react';
import type { ReactNode } from 'react';
import { useProductAppearance } from '@/commercial/components/ProductAppearanceProvider';
import { useStockEnforcementEnabled } from '@/commercial/components/StorefrontInventoryPolicyProvider';
import Availability from '@/commercial/components/storefront/Availability';
import PriceBreakdown from '@/commercial/components/storefront/PriceBreakdown';
import styles from './PurchasePanel.module.css';
import {
  isStorefrontVariantPurchasable,
  type StorefrontVariant
} from '@/commercial/features/products/storefrontProduct';
import {
  MAX_STOREFRONT_QUANTITY,
  parseStorefrontQuantityDraft
} from '@/commercial/quantity/quantityDraft';
import { STOREFRONT_CHECKOUT_SHIPPING_MESSAGE } from '@/shared/domain/shipping/storefrontShippingCopy';
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
  quantity: string;
  quantityError?: string | null;
  onQuantityChange: (quantity: string) => void;
  onAdd: () => void;
  deliveryEstimate?: string;
  presentation?: 'default' | 'integrated';
  section?: 'all' | 'details' | 'actions';
  variantSelector?: ReactNode;
  saleUnit?: string;
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
  quantityError,
  onQuantityChange,
  onAdd,
  deliveryEstimate,
  presentation = 'default',
  section = 'all',
  variantSelector,
  saleUnit,
  canvasDevice = 'desktop',
  canvasWrapper,
  className
}: PurchasePanelProps) {
  const appearance = useProductAppearance();
  const stockEnforcementEnabled = useStockEnforcementEnabled();
  const copy = appearance.purchaseArea.copy;
  const integrated = presentation === 'integrated';
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
  const minimumOrderWithQuantity =
    appearance.purchaseArea.showQuantityStepper && !canvasActive && !canvasWrapper;
  const minimumOrderBesideQuantity = integrated && appearance.purchaseArea.showQuantityStepper && Boolean(variant);
  const minimumOrderNote =
    appearance.purchaseArea.showMinimumOrder && variant && variant.minOrder > 1
      ? wrapCanvasElement(
          'product-minimum-order',
          'Minimalno naročilo',
          <p id="product-minimum-order-note" className="storefront-product-minimum-order">
            <span>{copy.minimumOrderLabel}</span>{copy.minimumOrderLabel.endsWith('.') ? ' ' : ': '}{variant.minOrder}{variant.unit ? ' ' + variant.unit : ''}
          </p>,
          'block'
        )
      : null;
  const minimum = variant?.minOrder ?? 1;
  const maximum =
    stockEnforcementEnabled && typeof variant?.inventory === 'number'
      ? Math.max(minimum, variant.inventory)
      : undefined;
  const canPurchase =
    selectionComplete &&
    isStorefrontVariantPurchasable(variant, stockEnforcementEnabled);
  const primaryActionLabel = !selectionComplete
    ? copy.selectOptionsActionLabel
    : canPurchase
      ? copy.addToCartActionLabel
      : copy.unavailableActionLabel;
  const panelClass = integrated
    ? styles.integrated
    : appearance.purchaseArea.panelStyle === 'card'
      ? 'site-card storefront-product-purchase-panel'
      : 'border-y border-[color:var(--site-divider-color)] py-5';
  const resolvedDeliveryEstimate =
    variant?.deliveryEstimate ??
    deliveryEstimate ??
    copy.deliveryFallbackMessage;
  const parsedQuantity = parseStorefrontQuantityDraft(quantity);
  const effectiveMaximum =
    typeof maximum === 'number'
      ? Math.min(maximum, MAX_STOREFRONT_QUANTITY)
      : MAX_STOREFRONT_QUANTITY;

  const stepQuantity = (step: -1 | 1) => {
    const nextQuantity =
      parsedQuantity === null ? minimum : parsedQuantity + step;
    const boundedQuantity = Math.max(
      minimum,
      Math.min(effectiveMaximum, nextQuantity)
    );
    onQuantityChange(String(boundedQuantity));
  };


  const pricingContent = (
    <div className={integrated ? styles.pricing : undefined}>
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
            className={integrated ? styles.priceBlock : undefined}
            priceWrapper={(children) => wrapCanvasElement(
              'product-price-main',
              'Prodajna cena in popust',
              <div className={integrated ? styles.priceFigures : undefined}>{children}</div>
            )}
            taxWrapper={(children) => (
              <div className="storefront-product-price-meta">
                {wrapCanvasElement('product-price-tax', 'Podatki o DDV', children)}
                {integrated && appearance.purchaseArea.showSaleUnit && saleUnit ? wrapCanvasElement(
                  'product-gallery-sale-unit',
                  'Prodajna enota',
                  <p className="storefront-product-sale-unit">Prodajna enota: <span>{saleUnit}</span></p>
                ) : null}
              </div>
            )}
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
              className={
                integrated ? 'storefront-product-availability ' + styles.availability : 'storefront-product-availability mt-5'
              }
              elementWrapper={wrapCanvasElement}
            />
          )
        ) : null}

      </div>
  );
  const variantDetails = (
    <>
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
          </dl>
        )
      ) : null}
      {!integrated && !minimumOrderWithQuantity ? minimumOrderNote : null}

      {variantSelector ? <div className={integrated ? styles.variants : undefined}>{variantSelector}</div> : null}
    </>
  );
  const purchaseControls = (
    <div className={integrated ? styles.purchaseRow : undefined}>
        {appearance.purchaseArea.showQuantityStepper && variant ? (
          wrapCanvasElement(
            'product-quantity',
            'Količina',
            <div className="storefront-product-quantity mt-5">
              <div className={integrated ? styles.quantityHeading : undefined}>
              {wrapCanvasElement(
                'product-quantity-label',
                'Naslov količine',
                <label
                  htmlFor="product-quantity"
                  className="block text-sm font-semibold text-[color:var(--site-color-text)]"
                >
                  {copy.quantityLabel}
                  {integrated && variant.unit ? (
                    <span className="storefront-product-quantity-unit">({variant.unit})</span>
                  ) : null}
                </label>,
                'mb-2 block'
              )}
              {minimumOrderBesideQuantity ? minimumOrderNote : null}
              </div>
              {wrapCanvasElement(
                'product-quantity-controls',
                'Kontrole količine',
                <div className="storefront-product-quantity-controls inline-flex max-w-full items-center align-middle">
                  <div className={`storefront-product-quantity-stepper inline-flex shrink-0 items-stretch rounded-[var(--site-field-radius)] border border-[color:var(--site-border-color)] bg-[color:var(--site-field-bg)] ${canvasWrapper ? 'overflow-visible' : 'overflow-hidden'}`}>
                    {wrapCanvasElement(
                      'product-quantity-decrease',
                      'Zmanjšaj količino',
                      <button
                        type="button"
                        onClick={() => stepQuantity(-1)}
                        disabled={
                          parsedQuantity !== null && parsedQuantity <= minimum
                        }
                        className="storefront-product-quantity-button inline-flex shrink-0 items-center justify-center text-lg text-[color:var(--site-color-text)] transition hover:bg-[color:var(--site-color-surface-muted)] disabled:cursor-not-allowed disabled:opacity-40"
                        aria-label={copy.decreaseQuantityLabel}
                      >
                        −
                      </button>,
                      'inline-flex shrink-0'
                    )}
                    {wrapCanvasElement(
                      'product-quantity-input',
                      'Vnos količine',
                      <input
                        id="product-quantity"
                        type="number"
                        inputMode="numeric"
                        min={minimum}
                        max={effectiveMaximum}
                        step={1}
                        value={quantity}
                        onChange={(event) => onQuantityChange(event.target.value)}
                        aria-invalid={quantityError ? 'true' : undefined}
                        aria-describedby={
                          [
                            minimumOrderNote ? 'product-minimum-order-note' : null,
                            quantityError ? 'product-quantity-error' : null
                          ].filter(Boolean).join(' ') || undefined
                        }
                        className="storefront-product-quantity-input shrink-0 border-x border-y-0 border-[color:var(--site-border-color)] bg-transparent text-center font-semibold text-[color:var(--site-color-text)] outline-none"
                      />,
                      'inline-flex shrink-0'
                    )}
                    {wrapCanvasElement(
                      'product-quantity-increase',
                      'Povečaj količino',
                      <button
                        type="button"
                        onClick={() => stepQuantity(1)}
                        disabled={
                          parsedQuantity !== null &&
                          parsedQuantity >= effectiveMaximum
                        }
                        className="storefront-product-quantity-button inline-flex shrink-0 items-center justify-center text-lg text-[color:var(--site-color-text)] transition hover:bg-[color:var(--site-color-surface-muted)] disabled:cursor-not-allowed disabled:opacity-40"
                        aria-label={copy.increaseQuantityLabel}
                      >
                        +
                      </button>,
                      'inline-flex shrink-0'
                    )}
                  </div>
                  {!integrated && variant?.unit ? (
                    <span className="storefront-product-quantity-unit ml-2 inline-flex shrink-0 items-center self-center text-xs leading-none text-[color:var(--site-color-text-muted)]">
                      {variant.unit}
                    </span>
                  ) : null}
                </div>,
                'inline-flex max-w-full items-center align-middle'
              )}
              {quantityError ? (
                <p
                  id="product-quantity-error"
                  role="alert"
                  className="mt-2 text-xs font-medium text-[color:var(--site-color-danger)]"
                >
                  {quantityError}
                </p>
              ) : null}
            </div>
          )
        ) : null}

        {!integrated && minimumOrderWithQuantity ? minimumOrderNote : null}

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

      </div>
  );
  const fulfillmentContent = (
    <div className={integrated ? styles.fulfillment : undefined}>
        {wrapCanvasElement(
          'product-delivery',
          'Dostava',
          <div className={
            integrated
              ? 'storefront-product-delivery ' + styles.delivery
              : 'storefront-product-delivery mt-4 flex items-start gap-3 border-t border-[color:var(--site-divider-color)] text-xs leading-5 text-[color:var(--site-color-text-muted)]'
          }>
            {wrapCanvasElement(
              'product-delivery-icon',
              'Ikona dostave',
              <Truck aria-hidden="true" className="mt-0.5 h-6 w-6 shrink-0 text-[color:var(--site-color-text-muted)]" />,
              'inline-flex shrink-0'
            )}
            <div className="min-w-0">
              {wrapCanvasElement(
                'product-delivery-title',
                'Rok dostave',
                <p className="font-semibold text-[color:var(--site-color-text)]">
                  {integrated && appearance.purchaseArea.showDeliveryEstimate && resolvedDeliveryEstimate
                    ? resolvedDeliveryEstimate
                    : STOREFRONT_CHECKOUT_SHIPPING_MESSAGE}
                </p>
              )}
              {appearance.purchaseArea.showDeliveryEstimate && resolvedDeliveryEstimate ? (
                wrapCanvasElement(
                  'product-delivery-note',
                  'Opomba o dostavi',
                  <p>{integrated ? STOREFRONT_CHECKOUT_SHIPPING_MESSAGE : resolvedDeliveryEstimate}</p>
                )
              ) : null}
            </div>
          </div>
        )}
        {copy.paymentMessage ? wrapCanvasElement(
          'product-payment',
          'Plačilo',
          <div className={
            integrated
              ? 'storefront-product-payment ' + styles.payment
              : 'storefront-product-payment mt-3 flex items-start gap-3 text-xs leading-5 text-[color:var(--site-color-text-muted)]'
          }>
            {wrapCanvasElement(
              'product-payment-icon',
              'Ikona plačila',
              <Wallet aria-hidden="true" className="mt-0.5 h-6 w-6 shrink-0 text-[color:var(--site-color-text-muted)]" />,
              'inline-flex shrink-0'
            )}
            {wrapCanvasElement(
              'product-payment-text',
              'Podatki o plačilu',
              <p className="min-w-0">{copy.paymentMessage}</p>
            )}
          </div>
        ) : null}
      </div>
  );
  const secondaryAction = (
    <>
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
    </>
  );
  const Panel = section === 'details' ? 'div' : 'aside';

  return (
    <Panel
      className={`${section === 'details' ? 'storefront-product-purchase-details' : 'storefront-product-purchase-area'} ${panelClass} ${className ?? ''}`.trim()}
      data-purchase-presentation={presentation}
      data-purchase-section={section}
      data-stock-enforcement={stockEnforcementEnabled ? 'enabled' : 'disabled'}
      aria-label={section === 'details' ? undefined : 'Nakup izdelka'}
    >
      {section === 'details' ? variantDetails : section === 'actions' ? (
        <>
          {pricingContent}
          {fulfillmentContent}
          {secondaryAction}
          <div className={styles.purchaseFooter}>
            {!minimumOrderBesideQuantity ? minimumOrderNote : null}
            {purchaseControls}
          </div>
        </>
      ) : (
        <>
          {pricingContent}
          {variantDetails}
          {purchaseControls}
          {integrated && !minimumOrderBesideQuantity ? minimumOrderNote : null}
          {fulfillmentContent}
          {secondaryAction}
        </>
      )}
    </Panel>
  );
}
