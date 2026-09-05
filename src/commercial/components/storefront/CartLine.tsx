'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useId, useState, type ReactNode } from 'react';
import { useProductAppearance } from '@/commercial/components/ProductAppearanceProvider';
import {
  getDistinctCartVariantName,
  type CartItem
} from '@/commercial/cart/cartTypes';
import type { OrderEstimateItem } from '@/commercial/order/contracts';
import PriceBreakdown from '@/commercial/components/storefront/PriceBreakdown';
import { formatEuro } from '@/shared/domain/formatting';
import IconButton from '@/shared/ui/icon-button/IconButton';
import { TrashCanIcon } from '@/shared/ui/icons/AdminActionIcons';
import {
  resolveProductCanvasElementDeviceSettings,
  type ProductCanvasDevice
} from '@/shared/domain/style/productAppearance';
import { useStockEnforcementEnabled } from '@/commercial/components/StorefrontInventoryPolicyProvider';
import {
  MAX_STOREFRONT_QUANTITY,
  parseStorefrontQuantityDraft,
  validateStorefrontQuantityDraft
} from '@/commercial/quantity/quantityDraft';
import ProductCanvasElement from '@/shared/ui/product-canvas/ProductCanvasElement';

type CartLineProps = {
  item: CartItem;
  estimateItem?: OrderEstimateItem;
  compact?: boolean;
  presentation?: 'default' | 'order-summary';
  highlighted?: boolean;
  readOnly?: boolean;
  onQuantityChange?: (quantity: number) => void;
  onQuantityValidityChange?: (controlId: string, isValid: boolean) => void;
  onQuantityCommit?: (lineId: string, quantityChanged: boolean) => void;
  onRemove?: () => void;
  onNavigate?: () => void;
  canvasDevice?: ProductCanvasDevice;
};

const reconciliationTone = {
  valid: 'var(--site-color-success)',
  unchecked: 'var(--site-color-info)',
  price_changed: 'var(--site-color-warning)',
  quantity_adjusted: 'var(--site-color-warning)',
  unavailable: 'var(--site-color-danger)',
  needs_review: 'var(--site-color-danger)'
} as const;

export default function CartLine({
  item,
  estimateItem,
  compact = false,
  presentation = 'default',
  highlighted = false,
  readOnly = false,
  onQuantityChange,
  onQuantityValidityChange,
  onQuantityCommit,
  onRemove,
  onNavigate,
  canvasDevice
}: CartLineProps) {
  const stockEnforcementEnabled = useStockEnforcementEnabled();
  const appearance = useProductAppearance();
  const canvasActive =
    canvasDevice !== undefined && appearance.canvas?.mode === 'free';
  const wrapCanvasElement = (
    elementId: string,
    label: string,
    children: ReactNode,
    canvasClassName = ''
  ) => {
    if (!canvasActive || !canvasDevice) return children;
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
  const baseUnitNet =
    estimateItem?.baseUnitNet ?? item.pricing?.baseUnitNet ?? 0;
  const unitNet = estimateItem?.unitNet ?? item.pricing?.unitNet ?? 0;
  const taxRate = estimateItem?.taxRate ?? item.pricing?.taxRate ?? 0.22;
  const discountPct =
    estimateItem?.discountPct ?? item.pricing?.discountPct ?? 0;
  const lineGross =
    estimateItem?.lineGross ??
    (typeof item.pricing?.quotedUnitGross === 'number'
      ? item.pricing.quotedUnitGross * item.quantity
      : typeof item.pricing?.estimatedUnitGross === 'number'
        ? item.pricing.estimatedUnitGross * item.quantity
        : null);
  const minimum = estimateItem?.minOrder ?? item.reconciliation.minOrder ?? 1;
  const maximum =
    stockEnforcementEnabled
      ? estimateItem?.availableStock ??
        item.reconciliation.availableStock ??
        undefined
      : undefined;
  const distinctVariantName = getDistinctCartVariantName(item);
  const [quantityDraft, setQuantityDraft] = useState(() =>
    String(item.quantity)
  );
  const [quantityError, setQuantityError] = useState<string | null>(null);
  const quantityErrorId = useId();
  const quantityControlId = `${item.lineId}:${quantityErrorId}`;
  const parsedQuantity = parseStorefrontQuantityDraft(quantityDraft);
  const effectiveMaximum =
    typeof maximum === 'number'
      ? Math.min(maximum, MAX_STOREFRONT_QUANTITY)
      : MAX_STOREFRONT_QUANTITY;

  useEffect(() => {
    setQuantityDraft(String(item.quantity));
    setQuantityError(null);
    onQuantityValidityChange?.(quantityControlId, true);
  }, [item.quantity, onQuantityValidityChange, quantityControlId]);

  useEffect(
    () => () => onQuantityValidityChange?.(quantityControlId, true),
    [onQuantityValidityChange, quantityControlId]
  );

  const commitQuantityDraft = () => {
    const validation = validateStorefrontQuantityDraft(quantityDraft, {
      minimum,
      maximum
    });
    if (!validation.valid) {
      setQuantityError(validation.message);
      onQuantityValidityChange?.(quantityControlId, false);
      return;
    }

    const quantityChanged = validation.quantity !== item.quantity;
    const nextQuantity = String(validation.quantity);
    setQuantityDraft(nextQuantity);
    setQuantityError(null);
    onQuantityValidityChange?.(quantityControlId, true);
    onQuantityCommit?.(item.lineId, quantityChanged);
    if (quantityChanged) {
      onQuantityChange?.(validation.quantity);
    }
  };

  const stepQuantity = (step: -1 | 1) => {
    if (!onQuantityChange) return;
    const nextQuantity = Math.max(
      minimum,
      Math.min(
        effectiveMaximum,
        parsedQuantity === null ? minimum : parsedQuantity + step
      )
    );
    setQuantityDraft(String(nextQuantity));
    setQuantityError(null);
    onQuantityValidityChange?.(quantityControlId, true);
    const quantityChanged = nextQuantity !== item.quantity;
    onQuantityCommit?.(item.lineId, quantityChanged);
    if (quantityChanged) {
      onQuantityChange(nextQuantity);
    }
  };

  const line = (
    <article
      data-cart-line-id={item.lineId}
      data-cart-line-density={compact ? 'compact' : 'default'}
      data-cart-line-presentation={presentation}
      data-stock-enforcement={stockEnforcementEnabled ? 'enabled' : 'disabled'}
      className={`storefront-cart-line site-radius-md border p-3 transition ${
        highlighted && appearance.cartSidebar.highlightAddedLine
          ? 'border-[color:var(--site-color-primary)] bg-[color:var(--blue-50)]'
          : 'border-[color:var(--site-border-color)] bg-[color:var(--site-color-surface)]'
      }`}
    >
      <div className="flex gap-3">
        {wrapCanvasElement(
          'cart-line-image',
          'Slika v košarici',
          <div
            className="site-radius-sm relative shrink-0 overflow-hidden border border-[color:var(--site-border-color)] bg-[color:var(--site-color-surface-muted)]"
            style={{
              width: compact
                ? 'min(var(--product-cart-line-image-size, 72px), 64px)'
                : 'var(--product-cart-line-image-size, 72px)',
              height: compact
                ? 'min(var(--product-cart-line-image-size, 72px), 64px)'
                : 'var(--product-cart-line-image-size, 72px)'
            }}
          >
            {item.imageUrl ? (
              <Image
                src={item.imageUrl}
                alt={item.imageAlt || item.name}
                fill
                sizes="96px"
                className="object-contain p-1.5"
              />
            ) : (
              <span className="flex h-full items-center justify-center px-1 text-center text-[10px] text-[color:var(--site-color-text-muted)]">
                Brez slike
              </span>
            )}
          </div>,
          'shrink-0'
        )}

        {wrapCanvasElement(
          'cart-line-info',
          'Podatki vrstice',
          <div className="min-w-0 flex-1">
            {item.productHref ? (
              <Link
                href={item.productHref}
                onClick={onNavigate}
                className="storefront-cart-line-title font-semibold leading-snug text-[color:var(--site-color-text)] hover:text-[color:var(--site-color-primary)]"
              >
                {item.name}
              </Link>
            ) : (
              <p className="storefront-cart-line-title font-semibold leading-snug text-[color:var(--site-color-text)]">
                {item.name}
              </p>
            )}

            {distinctVariantName ? (
              <p className="storefront-cart-line-variant mt-1 text-xs text-[color:var(--site-color-text-muted)]">
                {distinctVariantName}
              </p>
            ) : null}
            {item.variant?.options.length ? (
              <p className="storefront-cart-line-options mt-0.5 text-xs text-[color:var(--site-color-text-muted)]">
                {item.variant.options
                  .map((option) => `${option.axisName}: ${option.valueLabel}`)
                  .join(' · ')}
              </p>
            ) : null}
            <p className="storefront-cart-line-sku mt-0.5 font-mono text-[10px] text-[color:var(--site-color-text-muted)]">
              SKU: {estimateItem?.sku ?? item.sku}
            </p>

            {unitNet > 0 ? (
              <PriceBreakdown
                unitNet={unitNet}
                baseUnitNet={baseUnitNet || unitNet}
                discountPct={discountPct}
                taxRate={taxRate}
                unit={estimateItem?.unit ?? item.unit}
                compact
                className="mt-2"
              />
            ) : (
              <p className="mt-2 text-xs font-semibold text-[color:var(--site-color-danger)]">
                Cena še ni potrjena.
              </p>
            )}
          </div>,
          'min-w-0 flex-1'
        )}

        {!readOnly && onRemove ? (
          <IconButton
            type="button"
            onClick={onRemove}
            tone="neutral"
            size="md"
            shape="square"
            className="storefront-cart-line-remove-button shrink-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--site-field-focus)]"
            aria-label={`Odstrani ${item.name}`}
            data-testid="cart-line-remove-item"
          >
            <TrashCanIcon className="storefront-cart-line-remove-icon !shrink-0" />
          </IconButton>
        ) : null}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-[color:var(--site-divider-color)] pt-3">
        {readOnly ? (
          <p className="text-xs text-[color:var(--site-color-text-muted)]">
            Količina: <strong>{item.quantity}</strong>
          </p>
        ) : (
          <div className="inline-flex items-center overflow-hidden rounded-[var(--site-field-radius)] border border-[color:var(--site-border-color)]">
            <button
              type="button"
              onClick={() => stepQuantity(-1)}
              disabled={
                parsedQuantity !== null && parsedQuantity <= minimum
              }
              className="h-9 w-9 text-[color:var(--site-color-text)] hover:bg-[color:var(--site-color-surface-muted)] disabled:opacity-40"
              aria-label={`Zmanjšaj količino za ${item.name}`}
            >
              −
            </button>
            <input
              type="number"
              inputMode="numeric"
              min={minimum}
              max={effectiveMaximum}
              value={quantityDraft}
              onChange={(event) => {
                const nextDraft = event.target.value;
                setQuantityDraft(nextDraft);
                setQuantityError(null);
                const validation = validateStorefrontQuantityDraft(nextDraft, {
                  minimum,
                  maximum
                });
                onQuantityValidityChange?.(
                  quantityControlId,
                  validation.valid
                );
              }}
              onBlur={commitQuantityDraft}
              onKeyDown={(event) => {
                if (event.key !== 'Enter') return;
                event.preventDefault();
                commitQuantityDraft();
              }}
              className="storefront-cart-line-quantity h-9 w-14 border-x border-y-0 border-[color:var(--site-border-color)] bg-transparent text-center text-sm font-semibold outline-none"
              aria-label={`Količina za ${item.name}`}
              aria-invalid={quantityError ? 'true' : undefined}
              aria-describedby={quantityError ? quantityErrorId : undefined}
            />
            <button
              type="button"
              onClick={() => stepQuantity(1)}
              disabled={
                parsedQuantity !== null &&
                parsedQuantity >= effectiveMaximum
              }
              className="h-9 w-9 text-[color:var(--site-color-text)] hover:bg-[color:var(--site-color-surface-muted)] disabled:opacity-40"
              aria-label={`Povečaj količino za ${item.name}`}
            >
              +
            </button>
          </div>
        )}

        {item.productHref && !readOnly ? (
          <Link
            href={item.productHref}
            onClick={onNavigate}
            className="storefront-cart-line-change-variant site-link text-xs"
          >
            Spremeni različico
          </Link>
        ) : null}
        <p className="storefront-cart-line-total ml-auto text-sm font-semibold tabular-nums text-[color:var(--site-color-text)]">
          {lineGross === null ? '—' : formatEuro(lineGross)}
        </p>
      </div>

      {quantityError ? (
        <p
          id={quantityErrorId}
          role="alert"
          className="mt-2 text-xs font-medium text-[color:var(--site-color-danger)]"
        >
          {quantityError}
        </p>
      ) : item.reconciliation.message ? (
        <p
          className="mt-2 text-xs"
          style={{
            color: reconciliationTone[item.reconciliation.status]
          }}
        >
          {item.reconciliation.message}
        </p>
      ) : null}
    </article>
  );

  return wrapCanvasElement(
    'cart-line',
    'Vrstica artikla',
    line,
    'min-w-0'
  );
}
