import SiteHeader from '@/commercial/components/SiteHeader';
import SiteFooterGate from '@/commercial/components/SiteFooterGate';
import { SiteLogoProvider } from '@/commercial/components/SiteLogo';
import CommercialEnhancements from '@/commercial/components/CommercialEnhancements';
import CommercialScaleFrame from '@/commercial/components/CommercialScaleFrame';
import { ProductAppearanceProvider } from '@/commercial/components/ProductAppearanceProvider';
import { StorefrontInventoryPolicyProvider } from '@/commercial/components/StorefrontInventoryPolicyProvider';
import { ToastProvider, Toaster } from '@/shared/ui/toast';
import { getGlobalStyleConfig } from '@/shared/server/globalStyle';
import { getSiteLogoConfig } from '@/shared/server/siteLogo';
import { getSiteNavigationConfig } from '@/shared/server/siteNavigation';
import { getProductAppearanceConfig } from '@/shared/server/productAppearance';
import { getInventoryPolicySettings } from '@/shared/server/inventoryPolicy';

export default async function CommercialRootLayout({ children }: { children: React.ReactNode }) {
  const [
    siteNavigation,
    globalStyle,
    siteLogo,
    productAppearance,
    inventoryPolicy
  ] = await Promise.all([
    getSiteNavigationConfig(),
    getGlobalStyleConfig(),
    getSiteLogoConfig(),
    getProductAppearanceConfig(),
    getInventoryPolicySettings()
  ]);

  return (
    <ToastProvider>
      <StorefrontInventoryPolicyProvider
        stockEnforcementEnabled={inventoryPolicy.stockEnforcementEnabled}
      >
        <ProductAppearanceProvider config={productAppearance}>
          <CommercialEnhancements
            siteStyle={globalStyle}
            productAppearance={productAppearance}
          />
          <SiteLogoProvider config={siteLogo}>
            <CommercialScaleFrame
              siteLayout={siteNavigation.siteLayout}
              siteStyle={globalStyle}
              productAppearance={productAppearance}
            >
              <SiteHeader navigation={siteNavigation} />
              <main className="site-page-surface flex-1">{children}</main>
              <SiteFooterGate footer={siteNavigation.footer} />
            </CommercialScaleFrame>
          </SiteLogoProvider>
        </ProductAppearanceProvider>
      </StorefrontInventoryPolicyProvider>
      <Toaster />
    </ToastProvider>
  );
}
