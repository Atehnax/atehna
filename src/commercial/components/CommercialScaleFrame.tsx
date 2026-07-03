'use client';

import type { ReactNode } from 'react';
import type { CSSProperties } from 'react';
import { usePathname } from 'next/navigation';
import { toCommercialStorefrontLogicalPx } from '@/commercial/components/commercialStorefrontScale';
import type { SiteNavigationSiteLayoutSettings } from '@/shared/domain/navigation/siteNavigation';

type CommercialScaleFrameProps = {
  children: ReactNode;
  siteLayout?: SiteNavigationSiteLayoutSettings;
};

export default function CommercialScaleFrame({ children, siteLayout }: CommercialScaleFrameProps) {
  const pathname = usePathname();
  const isAdminPath = pathname?.startsWith('/admin');
  const resolveLayoutPx = isAdminPath ? (value: number) => value : toCommercialStorefrontLogicalPx;
  const siteGutterMinPx = siteLayout ? resolveLayoutPx(siteLayout.siteGutterMinPx) : null;
  const siteGutterMaxPx = siteLayout ? resolveLayoutPx(siteLayout.siteGutterMaxPx) : null;
  const siteContentMaxWidth = siteLayout
    ? `${resolveLayoutPx(siteLayout.siteContentMaxWidthPx)}px`
    : undefined;
  const style = siteLayout
    ? ({
        '--site-content-max-width': siteContentMaxWidth,
        '--site-gutter-min': `${siteGutterMinPx}px`,
        '--site-gutter-max': `${siteGutterMaxPx}px`,
        '--site-gutter': `clamp(${siteGutterMinPx}px, 4vw, ${siteGutterMaxPx}px)`
      } as CSSProperties)
    : undefined;

  return (
    <div
      style={style}
      className={
        isAdminPath
          ? 'flex min-h-screen flex-1 flex-col'
          : 'commercial-storefront-scale flex min-h-screen flex-1 flex-col'
      }
    >
      {children}
    </div>
  );
}
