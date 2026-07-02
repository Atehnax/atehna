'use client';

import type { ReactNode } from 'react';
import type { CSSProperties } from 'react';
import { usePathname } from 'next/navigation';
import type { SiteNavigationSiteLayoutSettings } from '@/shared/domain/navigation/siteNavigation';

type CommercialScaleFrameProps = {
  children: ReactNode;
  siteLayout?: SiteNavigationSiteLayoutSettings;
};

export default function CommercialScaleFrame({ children, siteLayout }: CommercialScaleFrameProps) {
  const pathname = usePathname();
  const isAdminPath = pathname?.startsWith('/admin');
  const style = siteLayout
    ? ({
        '--site-content-max-width': `${siteLayout.siteContentMaxWidthPx}px`,
        '--site-gutter-min': `${siteLayout.siteGutterMinPx}px`,
        '--site-gutter-max': `${siteLayout.siteGutterMaxPx}px`
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
