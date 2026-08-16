'use client';

import type { CSSProperties } from 'react';
import { useProductAppearance } from '@/commercial/components/ProductAppearanceProvider';
import type { StorefrontSpecification } from '@/commercial/features/products/storefrontProduct';
import { prepareStorefrontSpecifications } from '@/commercial/features/products/storefrontSpecifications';

type SpecificationTableProps = {
  specifications: StorefrontSpecification[];
  emptyMessage?: string;
  className?: string;
};

export default function SpecificationTable({
  specifications,
  emptyMessage = 'Tehnični podatki za ta artikel še niso objavljeni.',
  className
}: SpecificationTableProps) {
  const appearance = useProductAppearance();
  const visibleSpecifications = prepareStorefrontSpecifications(
    specifications,
    appearance.secondaryContent.specificationOrder,
    appearance.secondaryContent.specificationLabels
  );
  const firstColumnCount = Math.ceil(visibleSpecifications.length / 2);
  if (visibleSpecifications.length === 0) {
    return (
      <p className={`site-paragraph text-sm ${className ?? ''}`.trim()}>
        {emptyMessage}
      </p>
    );
  }

  return (
    <dl
      className={`storefront-specification-grid overflow-hidden ${className ?? ''}`.trim()}
      data-column-divider-visible={
        appearance.secondaryContent.showSpecificationColumnDivider
      }
      data-row-dividers-visible={
        appearance.secondaryContent.showSpecificationRowDividers
      }
    >
      {visibleSpecifications.map((specification, index) => (
        <div
          key={specification.id}
          data-specification-column-end={
            index === firstColumnCount - 1
            || index === visibleSpecifications.length - 1
          }
          style={{
            '--storefront-specification-desktop-column': index < firstColumnCount ? 1 : 2,
            '--storefront-specification-desktop-row': index < firstColumnCount
              ? index + 1
              : index - firstColumnCount + 1
          } as CSSProperties}
          className={`storefront-specification-row grid gap-1 px-3 text-sm sm:grid-cols-[minmax(10rem,0.42fr)_1fr] sm:gap-6 ${
            appearance.secondaryContent.compactSpecifications ? 'py-2' : 'py-3'
          } ${
            appearance.secondaryContent.stripedSpecifications &&
            index % 2 === 0
              ? 'bg-[color:var(--site-color-surface-muted)]'
              : 'bg-[color:var(--site-color-surface)]'
          }`}
        >
          <dt className="font-semibold text-[color:var(--site-color-text)]">
            {specification.label}
          </dt>
          <dd className="min-w-0 [overflow-wrap:anywhere] text-[color:var(--site-color-text-muted)]">
            {specification.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
