'use client';

import {
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties
} from 'react';
import { toCommercialStorefrontLogicalPx } from '@/commercial/components/commercialStorefrontScale';
import ProductDetailView from '@/commercial/components/storefront/ProductDetailView';
import { ProductAppearanceProvider } from '@/commercial/components/ProductAppearanceProvider';
import type { StorefrontProduct } from '@/commercial/features/products/storefrontProduct';
import {
  toGlobalStyleCssVariables,
  type GlobalStyleConfig
} from '@/shared/domain/style/globalStyle';
import type { SiteNavigationSiteLayoutSettings } from '@/shared/domain/navigation/siteNavigation';
import {
  toProductAppearanceCssVariables,
  type ProductAppearanceConfig,
  type ProductCanvasDevice,
  type ProductCanvasElementDeviceSettings
} from '@/shared/domain/style/productAppearance';
import ProductCanvasGuidesOverlay from '@/shared/ui/product-canvas/ProductCanvasGuidesOverlay';

const logicalWidthByDevice: Record<Exclude<ProductCanvasDevice, 'desktop'>, number> = {
  tablet: toCommercialStorefrontLogicalPx(900),
  mobile: toCommercialStorefrontLogicalPx(390)
};

export default function ProductAppearanceLivePreview({
  config,
  globalStyle,
  siteLayout,
  product,
  device,
  selectedElementId,
  onSelectElement,
  onElementChange
}: {
  config: ProductAppearanceConfig;
  globalStyle: GlobalStyleConfig;
  siteLayout: SiteNavigationSiteLayoutSettings;
  product: StorefrontProduct;
  device: ProductCanvasDevice;
  selectedElementId: string | null;
  onSelectElement: (elementId: string) => void;
  onElementChange: (
    elementId: string,
    updates: Partial<ProductCanvasElementDeviceSettings>
  ) => void;
}) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(1);
  const [scaledHeight, setScaledHeight] = useState(620);
  const logicalWidth = device === 'desktop'
    ? toCommercialStorefrontLogicalPx(globalStyle.layout.maxWidthPx)
    : logicalWidthByDevice[device];
  const previewConfig = config;
  const themeStyle = useMemo(() => {
    const storefrontDimensionScale = toCommercialStorefrontLogicalPx(1);
    const variables = toGlobalStyleCssVariables(
      globalStyle,
      storefrontDimensionScale
    );
    const contentMaxWidth = toCommercialStorefrontLogicalPx(
      siteLayout.siteContentMaxWidthPx
    );
    return {
      ...variables,
      ...toProductAppearanceCssVariables(
        previewConfig,
        storefrontDimensionScale
      ),
      '--site-content-max-width': `${contentMaxWidth}px`,
      '--site-gutter': device === 'mobile'
        ? variables['--site-gutter-mobile']
        : device === 'tablet'
          ? variables['--site-gutter-tablet']
          : variables['--site-gutter-desktop'],
      '--site-section-space-current': device === 'mobile'
        ? variables['--site-section-space-mobile']
        : device === 'tablet'
          ? variables['--site-section-space-tablet']
          : variables['--site-section-space-desktop']
    } as CSSProperties;
  }, [device, globalStyle, previewConfig, siteLayout.siteContentMaxWidthPx]);

  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    const content = contentRef.current;
    if (!viewport || !content) return;

    const update = () => {
      const availableWidth = Math.max(280, viewport.clientWidth - 16);
      const nextScale = Math.min(1, availableWidth / logicalWidth);
      setScale(nextScale);
      setScaledHeight(Math.max(520, Math.ceil(content.scrollHeight * nextScale)));
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(viewport);
    observer.observe(content);
    return () => observer.disconnect();
  }, [logicalWidth, product, previewConfig]);

  return (
    <div
      ref={viewportRef}
      className="relative w-full overflow-hidden bg-slate-100/70"
      style={{ height: scaledHeight }}
    >
      <div
        ref={contentRef}
        data-storefront-theme="true"
        data-admin-product-live-preview="true"
        data-preview-device={device}
        className="admin-product-live-preview storefront-theme-preview absolute left-2 top-2 min-h-[640px] origin-top-left overflow-hidden bg-[color:var(--site-color-page)] text-[color:var(--site-color-text)]"
        style={{
          ...themeStyle,
          width: logicalWidth,
          transform: `scale(${scale})`
        }}
      >
        <ProductAppearanceProvider config={previewConfig}>
          <ProductDetailView
            key={`${product.id}-${product.defaultVariantId ?? 'none'}`}
            product={product}
            canvasEditor={{
              device,
              selectedElementId,
              scale,
              onSelectElement,
              onElementChange
            }}
          />
        </ProductAppearanceProvider>
        <ProductCanvasGuidesOverlay
          rootRef={contentRef}
          selectedElementId={selectedElementId}
          enabled={previewConfig.canvas.showGuides}
          changeToken={[
            previewConfig.canvas.elements,
            scale,
            scaledHeight
          ]}
        />
      </div>
    </div>
  );
}
