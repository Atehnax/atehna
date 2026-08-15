'use client';

import type { ReactNode } from 'react';
import { useProductAppearance } from '@/commercial/components/ProductAppearanceProvider';
import { formatEuro } from '@/shared/domain/formatting';

type PriceBreakdownProps = {
  unitNet: number;
  baseUnitNet?: number;
  maxUnitNet?: number;
  discountPct?: number;
  taxRate?: number;
  unit?: string | null;
  compact?: boolean;
  className?: string;
  priceWrapper?: (children: ReactNode) => ReactNode;
  taxWrapper?: (children: ReactNode) => ReactNode;
};

const classNames = (...parts: Array<string | false | null | undefined>) =>
  parts.filter(Boolean).join(' ');

export default function PriceBreakdown({
  unitNet,
  baseUnitNet = unitNet,
  maxUnitNet,
  discountPct = 0,
  taxRate = 0.22,
  unit,
  compact = false,
  className,
  priceWrapper,
  taxWrapper
}: PriceBreakdownProps) {
  const appearance = useProductAppearance();
  const copy = appearance.purchaseArea.copy;
  const safeTaxRate = Math.max(0, taxRate);
  const unitGross = unitNet * (1 + safeTaxRate);
  const maxGross =
    typeof maxUnitNet === 'number' ? maxUnitNet * (1 + safeTaxRate) : null;
  const baseGross = baseUnitNet * (1 + safeTaxRate);
  const taxAmount = unitGross - unitNet;
  const maxTaxAmount =
    maxGross !== null && typeof maxUnitNet === 'number'
      ? maxGross - maxUnitNet
      : null;
  const hasRange = maxGross !== null && Math.abs(maxGross - unitGross) > 0.005;
  const hasDiscount = discountPct > 0 && baseGross > unitGross;
  const savingsGross = Math.max(0, baseGross - unitGross);
  const priceContent = (
    <>
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <p
          className={classNames(
            'storefront-price-primary font-semibold leading-tight tabular-nums',
            compact
              ? 'text-lg'
              : appearance.pricing.emphasis === 'strong'
                ? 'text-3xl'
                : 'text-2xl'
          )}
        >
          {hasRange
            ? `${formatEuro(unitGross)}–${formatEuro(maxGross)}`
            : formatEuro(unitGross)}
        </p>
        <span className="storefront-price-label text-xs text-[color:var(--site-color-text-muted)]">
          {copy.grossPriceLabel}
          {appearance.pricing.showUnitPrice && unit ? ` / ${unit}` : ''}
        </span>
      </div>

      {hasDiscount &&
      (appearance.pricing.showOriginalPrice ||
        appearance.pricing.showDiscountPercentage ||
        appearance.pricing.showAbsoluteSavings) ? (
        <div className="storefront-price-discount-row mt-1 flex flex-wrap items-center gap-2 text-xs">
          {appearance.pricing.showOriginalPrice ? (
            <span className="text-[color:var(--site-color-text-muted)] line-through">
              {formatEuro(baseGross)}
            </span>
          ) : null}
          {appearance.pricing.showDiscountPercentage ? (
            <span className="site-radius-pill bg-[color:var(--site-color-success)] px-2 py-0.5 font-semibold text-white">
              −{Math.round(discountPct)} %
            </span>
          ) : null}
          {appearance.pricing.showAbsoluteSavings ? (
            <span className="font-semibold text-[color:var(--site-color-success)]">
              {copy.savingsLabel} {formatEuro(savingsGross)}
            </span>
          ) : null}
        </div>
      ) : null}
    </>
  );
  const taxContent = (
    <p
      className={classNames(
        'storefront-price-tax mt-1 text-[color:var(--site-color-text-muted)]',
        compact ? 'text-[11px] leading-4' : 'text-xs'
      )}
    >
      {hasRange && typeof maxUnitNet === 'number'
        ? `${formatEuro(unitNet)}–${formatEuro(maxUnitNet)}`
        : formatEuro(unitNet)}{' '}
      {copy.netPriceLabel} · {copy.taxLabel} {Math.round(safeTaxRate * 100)} %:{' '}
      {hasRange && maxTaxAmount !== null
        ? `${formatEuro(taxAmount)}–${formatEuro(maxTaxAmount)}`
        : formatEuro(taxAmount)}
    </p>
  );

  return (
    <div className={classNames('text-[color:var(--site-color-text)]', className)}>
      {priceWrapper ? priceWrapper(priceContent) : priceContent}
      {taxWrapper ? taxWrapper(taxContent) : taxContent}
    </div>
  );
}
