import type { CSSProperties } from 'react';
import layout from './CatalogBrowser.module.css';
import styles from './CatalogBrowserSkeleton.module.css';

function Placeholder({ width = '100%', height = 12, className = '' }: {
  width?: CSSProperties['inlineSize']; height?: number; className?: string;
}) {
  return <span className={`${styles.placeholder} ${className}`} style={{ inlineSize: width, blockSize: `calc(${height} * var(--u))` }} />;
}

function ProductRowSkeleton({ index }: { index: number }) {
  return (
    <div className={layout.productRow}>
      <div className={layout.productIdentity}>
        <span className={`${layout.productImage} ${styles.placeholder}`} />
        <span className={layout.productCopy}>
          <Placeholder width={index % 2 ? '67%' : '82%'} height={12} />
          <Placeholder width={index % 2 ? '90%' : '75%'} height={10} />
        </span>
      </div>
      <div className={layout.availability}>
        <span /><div><Placeholder width="calc(58 * var(--u))" height={9} /></div>
      </div>
      <span className={layout.price}><Placeholder width="calc(50 * var(--u))" height={12} className={styles.alignEnd} /></span>
    </div>
  );
}

function ResultsPlaceholders() {
  return (
    <>
      <div className={layout.resultsToolbar}><Placeholder width="min(55%, calc(195 * var(--u)))" height={10} /><Placeholder width="calc(68 * var(--u))" height={10} /></div>
      {[2, 1, 2].map((branchCount, groupIndex) => (
        <div key={groupIndex} className={layout.categoryGroup}>
          <div className={layout.categoryHeader}>
            <div className={layout.categoryIdentity}><div className={layout.categoryHeading}>
            <span className={layout.categoryToggle}><Placeholder width="calc(14 * var(--u))" height={8} /></span>
            <div className={styles.groupTitle}><Placeholder width="calc(18 * var(--u))" height={12} /><Placeholder width={`${[56, 38, 63][groupIndex]}%`} height={15} /></div>
            <span className={`${layout.sortHeading} ${layout.nameSort}`}><Placeholder width="calc(22 * var(--u))" height={9} /></span></div></div>
            <span className={layout.sortHeading}><Placeholder width="calc(64 * var(--u))" height={9} /></span>
            <span className={layout.sortHeading} data-sort-key="price"><Placeholder width="calc(57 * var(--u))" height={9} /></span>
          </div>
          <div className={layout.branchContent}>
            {Array.from({ length: branchCount }, (_, branchIndex) => (
              <div key={branchIndex} className={layout.categoryBranch}>
                <div className={`${layout.branchHeader} ${styles.branchTitle}`}><Placeholder width="calc(10 * var(--u))" height={8} /><Placeholder width="min(55%, calc(155 * var(--u)))" height={11} /></div>
                <div className={layout.branchContent}>
                  {Array.from({ length: branchIndex === 0 ? 2 : 1 }, (_, index) => <ProductRowSkeleton key={index} index={index} />)}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </>
  );
}

export function CatalogBrowserResultsSkeleton() {
  return (
    <div className={[layout.results, styles.loading].join(' ')} role="status" aria-label="Nalaganje kataloga" aria-busy="true">
      <div aria-hidden="true"><ResultsPlaceholders /></div>
      <span className={layout.srOnly}>Nalaganje …</span>
    </div>
  );
}

export default function CatalogBrowserSkeleton() {
  return (
    <div className={`${layout.surface} ${styles.loading}`} role="status" aria-label="Nalaganje kataloga" aria-busy="true">
      <div className={`container-base ${layout.catalog}`} aria-hidden="true">
        <div className={`${layout.breadcrumbs} ${styles.breadcrumbs}`}>
          <Placeholder width="calc(14 * var(--u))" height={14} />
          <Placeholder width="calc(96 * var(--u))" height={10} />
        </div>
        <div className={layout.intro}>
          <div className={styles.title}><Placeholder width="min(75%, calc(270 * var(--u)))" height={28} /></div>
          <p className={styles.description}><Placeholder width="min(90%, calc(360 * var(--u)))" height={12} /></p>
        </div>
        <div className={layout.toolbar}>
          <div className={layout.search}><Placeholder width="42%" height={12} /></div>
        </div>
        <div className={layout.layout}>
          <aside className={layout.sidebar}>
            <div className={layout.mobileFilterToggle}><Placeholder width="48%" height={12} /></div>
            <div className={layout.sidebarContent} data-open="false">
              <div className={layout.categoryNav}>
                <div className={styles.sidebarTitle}><Placeholder width="45%" height={10} /></div>
                {Array.from({ length: 8 }, (_, index) => (
                  <div key={index} className={styles.categoryLink}>
                    <Placeholder width="calc(17 * var(--u))" height={11} />
                    <Placeholder width={`${[73, 58, 80, 65][index % 4]}%`} height={12} />
                  </div>
                ))}
              </div>
              <div className={layout.availabilityFilter}>
                <Placeholder width="60%" height={10} />
                <div className={layout.stockFilter}><Placeholder width="calc(17 * var(--u))" height={17} /><Placeholder width="calc(54 * var(--u))" height={10} /></div>
              </div>
              <div className={layout.priceFilter}>
                <Placeholder width="30%" height={10} />
                <div className={styles.priceCaption}><Placeholder width="48%" height={9} /></div>
                <div className={`${layout.priceSlider} ${styles.range}`}><Placeholder height={3} /></div>
                <div className={layout.priceInputs}>
                  <div><Placeholder width="30%" height={9} /><div className={`${layout.priceInput} ${styles.priceInput}`}><Placeholder width="45%" height={10} /></div></div>
                  <span className={layout.priceDash}>–</span>
                  <div><Placeholder width="30%" height={9} /><div className={`${layout.priceInput} ${styles.priceInput}`}><Placeholder width="45%" height={10} /></div></div>
                </div>
              </div>
              <div className={layout.helpLink}><Placeholder width="70%" height={11} /></div>
            </div>
          </aside>
          <div className={layout.results}>
            <ResultsPlaceholders />
          </div>
        </div>
      </div>
      <span className={layout.srOnly}>Nalaganje …</span>
    </div>
  );
}
