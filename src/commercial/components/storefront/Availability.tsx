'use client';

import type { ReactNode } from 'react';
import { useProductAppearance } from '@/commercial/components/ProductAppearanceProvider';
import { useStockEnforcementEnabled } from '@/commercial/components/StorefrontInventoryPolicyProvider';
import type { StorefrontVariant } from '@/commercial/features/products/storefrontProduct';

type AvailabilityProps = {
  variant: StorefrontVariant | null;
  selectionComplete?: boolean;
  fallbackDeliveryEstimate?: string;
  compact?: boolean;
  className?: string;
  elementWrapper?: (
    elementId: string,
    label: string,
    children: ReactNode,
    className?: string
  ) => ReactNode;
};

const classNames = (...parts: Array<string | false | null | undefined>) =>
  parts.filter(Boolean).join(' ');

const renderTemplate = (
  template: string,
  values: Record<string, string | number>
) =>
  template.replace(/\{([a-z]+)\}/gi, (match, token: string) => (
    Object.prototype.hasOwnProperty.call(values, token)
      ? String(values[token])
      : match
  ));

export default function Availability({
  variant,
  selectionComplete = true,
  fallbackDeliveryEstimate,
  compact = false,
  className,
  elementWrapper
}: AvailabilityProps) {
  const copy = useProductAppearance().purchaseArea.copy;
  const wrapElement = elementWrapper ?? ((_id: string, _label: string, children: ReactNode) => children);
  const stockEnforcementEnabled = useStockEnforcementEnabled();
  let tone = 'var(--site-color-warning)';
  let label = copy.selectVariantLabel;
  let detail = copy.selectVariantDetail;

  if (selectionComplete && variant) {
    if (variant.status === 'inactive' || variant.commerceId === null) {
      tone = 'var(--site-color-danger)';
      label = copy.inactiveVariantLabel;
      detail = copy.inactiveVariantDetail;
    } else if (!stockEnforcementEnabled) {
      tone = 'var(--site-color-info)';
      label = 'Na voljo za naročilo';
      detail = typeof variant.inventory === 'number'
        ? `Trenutna zaloga: ${variant.inventory} ${variant.unit}. Naročite lahko tudi večjo količino.`
        : variant.deliveryEstimate ??
          fallbackDeliveryEstimate ??
          copy.confirmationAvailabilityDetail;
    } else if (variant.inventory === 0) {
      tone = 'var(--site-color-warning)';
      label = copy.outOfStockLabel;
      detail = copy.outOfStockDetail;
    } else if (
      typeof variant.inventory === 'number' &&
      variant.inventory < variant.minOrder
    ) {
      tone = 'var(--site-color-warning)';
      label = copy.insufficientStockLabel;
      detail = renderTemplate(copy.insufficientStockDetail, {
        stock: variant.inventory,
        minimum: variant.minOrder,
        unit: variant.unit
      });
    } else if (typeof variant.inventory === 'number') {
      tone = 'var(--site-color-success)';
      label = copy.inStockLabel;
      detail = renderTemplate(copy.inStockDetail, {
        stock: variant.inventory,
        unit: variant.unit
      });
    } else {
      tone = 'var(--site-color-info)';
      label = copy.confirmationAvailabilityLabel;
      detail =
        variant.deliveryEstimate ??
        fallbackDeliveryEstimate ??
        copy.confirmationAvailabilityDetail;
    }
  }

  return (
    <div
      className={classNames('flex items-start gap-2', className)}
      data-stock-enforcement={stockEnforcementEnabled ? 'enabled' : 'disabled'}
      role="status"
      aria-live="polite"
    >
      {wrapElement(
        'product-availability-indicator',
        'Oznaka razpoložljivosti',
        <span
          aria-hidden="true"
          className="mt-[0.38em] block h-2 w-2 shrink-0 rounded-full"
          style={{ backgroundColor: tone }}
        />,
        'inline-flex shrink-0'
      )}
      <div className="storefront-availability-copy min-w-0">
        {wrapElement(
          'product-availability-label',
          'Stanje zaloge',
          <p
            className={classNames(
              'storefront-availability-label font-semibold text-[color:var(--site-color-text)]',
              compact ? 'text-xs' : 'text-sm'
            )}
          >
            {label}
          </p>
        )}
        {!compact && detail ? wrapElement(
          'product-availability-detail',
          'Podrobnosti zaloge',
          <p className="storefront-availability-detail mt-0.5 text-xs leading-5 text-[color:var(--site-color-text-muted)]">
            {detail}
          </p>
        ) : null}
      </div>
    </div>
  );
}
