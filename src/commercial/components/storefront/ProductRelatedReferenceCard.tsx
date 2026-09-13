'use client';

import Image from 'next/image';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import type { ReactNode } from 'react';
import { useProductAppearance } from '@/commercial/components/ProductAppearanceProvider';
import type { StorefrontProductSummary } from '@/commercial/features/products/storefrontProduct';
import { formatEuro } from '@/shared/domain/formatting';
import styles from './ProductShowcase.module.css';

type Props = {
  product: StorefrontProductSummary;
  canvasWrapper: (id: string, label: string, children: ReactNode, className?: string) => ReactNode;
};

export default function ProductRelatedReferenceCard({ product, canvasWrapper: wrap }: Props) {
  const appearance = useProductAppearance();
  const price = product.minUnitNet * (1 + Math.max(0, product.taxRate));
  const hasRange = product.maxUnitNet - product.minUnitNet > 0.005;
  return wrap('product-related-card', 'Kartica sorodnega izdelka',
    <article className={styles.relatedCard}>
      {wrap('product-related-card-image', 'Slika sorodnega izdelka',
        <Link href={product.href} prefetch={false} className={styles.relatedImage} aria-label={product.name}>
          {product.image ? <Image src={product.image.url} alt={product.image.altText || product.name} fill sizes="180px" />
            : <span>Slika še ni objavljena</span>}
        </Link>, styles.relatedImageSlot)}
      {wrap('product-related-card-content', 'Podatki sorodnega izdelka',
        <div className={styles.relatedContent}>
          {product.categoryLabel ? wrap('product-related-card-category', 'Kategorija kartice',
            <p className="site-eyebrow">{product.categoryLabel}</p>) : null}
          {wrap('product-related-card-title', 'Naziv kartice',
            <Link href={product.href} prefetch={false}><h3>{product.name}</h3></Link>)}
          {product.shortDescription ? wrap('product-related-card-description', 'Opis kartice',
            <p className={styles.relatedDescription}>{product.shortDescription}</p>) : null}
        </div>, styles.relatedContentSlot)}
      {wrap('product-related-card-price', 'Cena kartice',
        <div className={styles.relatedPrice}>
          {appearance.pricing.showGrossPrice ? <p>{hasRange ? 'od ' : ''}{formatEuro(price)}</p> : null}
          {appearance.pricing.showUnitPrice && product.unit ? <span>/ {product.unit}</span> : null}
        </div>, styles.relatedPriceSlot)}
      {wrap('product-related-card-action', 'Odpri sorodni izdelek',
        <Link href={product.href} prefetch={false} className={styles.relatedAction} aria-label={'Odpri ' + product.name}>
          <ChevronRight aria-hidden="true" />
        </Link>, styles.relatedActionSlot)}
    </article>, styles.relatedShell);
}
