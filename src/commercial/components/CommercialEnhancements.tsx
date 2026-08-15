'use client';

import dynamic from 'next/dynamic';
import { usePathname } from 'next/navigation';
import type { CSSProperties } from 'react';
import {
  toGlobalStyleCssVariables,
  type GlobalStyleConfig
} from '@/shared/domain/style/globalStyle';
import {
  toProductAppearanceCssVariables,
  type ProductAppearanceConfig
} from '@/shared/domain/style/productAppearance';

const WebsiteAnalyticsTracker = dynamic(() => import('@/commercial/components/WebsiteAnalyticsTracker'), { ssr: false });
const CartDrawer = dynamic(() => import('@/commercial/features/cart/CartDrawer'), { ssr: false });

export default function CommercialEnhancements({
  siteStyle,
  productAppearance
}: {
  siteStyle?: GlobalStyleConfig;
  productAppearance?: ProductAppearanceConfig;
}) {
  const pathname = usePathname();
  const isAdminPath = pathname?.startsWith('/admin');

  if (isAdminPath) return null;

  const globalVariables = siteStyle
    ? toGlobalStyleCssVariables(siteStyle)
    : {};
  const style = {
    ...globalVariables,
    ...(productAppearance
      ? toProductAppearanceCssVariables(productAppearance)
      : {}),
    ...(globalVariables['--site-global-max-width']
      ? {
          '--site-content-max-width':
            globalVariables['--site-global-max-width']
        }
      : {})
  } as CSSProperties;

  return (
    <div
      data-storefront-theme="true"
      className="site-token-scope"
      style={style}
    >
      <WebsiteAnalyticsTracker />
      <CartDrawer />
    </div>
  );
}
