'use client';

import type { ReactNode } from 'react';
import type { CSSProperties } from 'react';
import { usePathname } from 'next/navigation';
import { toCommercialStorefrontLogicalPx } from '@/commercial/components/commercialStorefrontScale';
import type { SiteNavigationSiteLayoutSettings } from '@/shared/domain/navigation/siteNavigation';
import { toGlobalStyleCssVariables, type GlobalStyleConfig } from '@/shared/domain/style/globalStyle';

type CommercialScaleFrameProps = {
  children: ReactNode;
  siteLayout?: SiteNavigationSiteLayoutSettings;
  siteStyle?: GlobalStyleConfig;
};

export default function CommercialScaleFrame({ children, siteLayout, siteStyle }: CommercialScaleFrameProps) {
  const pathname = usePathname();
  const isAdminPath = pathname?.startsWith('/admin');
  let style: CSSProperties | undefined;
  let responsiveThemeCss = '';

  if (isAdminPath && siteLayout) {
    style = {
      '--site-content-max-width': `${siteLayout.siteContentMaxWidthPx}px`,
      '--site-gutter-min': `${siteLayout.siteGutterMinPx}px`,
      '--site-gutter-max': `${siteLayout.siteGutterMaxPx}px`,
      '--site-gutter': `clamp(${siteLayout.siteGutterMinPx}px, 4vw, ${siteLayout.siteGutterMaxPx}px)`
    } as CSSProperties;
  } else if (!isAdminPath && siteStyle) {
    const storefrontDimensionScale = toCommercialStorefrontLogicalPx(1);
    const variables = toGlobalStyleCssVariables(siteStyle, storefrontDimensionScale);
    style = {
      ...variables,
      '--site-content-max-width': variables['--site-global-max-width'],
      '--site-gutter-min': variables['--site-gutter-mobile'],
      '--site-gutter-max': variables['--site-gutter-desktop']
    } as CSSProperties;
    const tabletMin = siteStyle.breakpoints.mobileMaxPx + 1;
    const desktopMin = siteStyle.breakpoints.tabletMaxPx + 1;
    responsiveThemeCss = `
      [data-storefront-theme='true'] {
        --site-gutter: var(--site-gutter-mobile);
        --site-section-space-current: var(--site-section-space-mobile);
      }
      @media (min-width: ${tabletMin}px) {
        [data-storefront-theme='true'] {
          --site-gutter: var(--site-gutter-tablet);
          --site-section-space-current: var(--site-section-space-tablet);
        }
      }
      @media (min-width: ${desktopMin}px) {
        [data-storefront-theme='true'] {
          --site-gutter: var(--site-gutter-desktop);
          --site-section-space-current: var(--site-section-space-desktop);
        }
      }
    `;
  }

  return (
    <>
      {responsiveThemeCss ? <style>{responsiveThemeCss}</style> : null}
      <div
        style={style}
        data-storefront-theme={isAdminPath ? undefined : 'true'}
        className={
          isAdminPath
            ? 'flex min-h-screen flex-1 flex-col'
            : 'commercial-storefront-scale flex min-h-screen flex-1 flex-col'
        }
      >
        {children}
      </div>
    </>
  );
}
