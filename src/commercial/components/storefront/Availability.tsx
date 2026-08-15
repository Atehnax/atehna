'use client';

import { useProductAppearance } from '@/commercial/components/ProductAppearanceProvider';
import type { StorefrontVariant } from '@/commercial/features/products/storefrontProduct';

type AvailabilityProps = {
  variant: StorefrontVariant | null;
  selectionComplete?: boolean;
  fallbackDeliveryEstimate?: string;
  compact?: boolean;
  className?: string;
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
  className
}: AvailabilityProps) {
  const copy = useProductAppearance().purchaseArea.copy;
  let tone = 'var(--site-color-warning)';
  let label = copy.selectVariantLabel;
  let detail = copy.selectVariantDetail;

  if (selectionComplete && variant) {
    if (variant.status === 'inactive' || variant.commerceId === null) {
      tone = 'var(--site-color-danger)';
      label = copy.inactiveVariantLabel;
      detail = copy.inactiveVariantDetail;
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
      role="status"
      aria-live="polite"
    >
      <span
        aria-hidden="true"
        className="mt-[0.38em] h-2 w-2 shrink-0 rounded-full"
        style={{ backgroundColor: tone }}
      />
      <div className="min-w-0">
        <p
          className={classNames(
            'storefront-availability-label font-semibold text-[color:var(--site-color-text)]',
            compact ? 'text-xs' : 'text-sm'
          )}
        >
          {label}
        </p>
        {!compact && detail ? (
          <p className="storefront-availability-detail mt-0.5 text-xs leading-5 text-[color:var(--site-color-text-muted)]">
            {detail}
          </p>
        ) : null}
      </div>
    </div>
  );
}
