'use client';

import {
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type RefObject
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
import type { ProductCanvasSelectionOptions } from '@/shared/ui/product-canvas/ProductCanvasElement';
import ProductCanvasGuidesOverlay from '@/shared/ui/product-canvas/ProductCanvasGuidesOverlay';
import { appearancePreviewMotionEventName } from '@/shared/ui/responsive-preview-motion';

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
  motionFrameRef,
  transitioning = false,
  selectedElementId,
  selectedElementIds,
  onSelectElement,
  onElementChange
}: {
  config: ProductAppearanceConfig;
  globalStyle: GlobalStyleConfig;
  siteLayout: SiteNavigationSiteLayoutSettings;
  product: StorefrontProduct;
  device: ProductCanvasDevice;
  motionFrameRef?: RefObject<HTMLDivElement | null>;
  transitioning?: boolean;
  selectedElementId: string | null;
  selectedElementIds: readonly string[];
  onSelectElement: (elementId: string, options?: ProductCanvasSelectionOptions) => void;
  onElementChange: (
    elementId: string,
    updates: Partial<ProductCanvasElementDeviceSettings>
  ) => void;
}) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(1);
  const [scaledHeight, setScaledHeight] = useState(620);
  const settledLogicalWidth = device === 'desktop'
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
      const motionFrame = motionFrameRef?.current;
      const motionLogicalWidth = Number(motionFrame?.dataset.previewLogicalWidth);
      const logicalWidth = Number.isFinite(motionLogicalWidth) && motionLogicalWidth > 0
        ? motionLogicalWidth
        : settledLogicalWidth;
      const availableWidth = Math.max(280, viewport.clientWidth - 16);
      const nextScale = Math.min(1, availableWidth / logicalWidth);
      const nextScaledHeight = Math.max(
        520,
        Math.ceil(content.scrollHeight * nextScale)
      );

      content.style.width = `${logicalWidth}px`;
      content.style.transform = `scale(${nextScale})`;
      viewport.style.height = `${nextScaledHeight}px`;
      viewport.dataset.previewLogicalWidth = logicalWidth.toFixed(3);
      viewport.dataset.previewScale = nextScale.toFixed(6);

      if (motionFrame?.dataset.previewTransitioning !== 'true') {
        setScale((currentScale) => (
          Math.abs(currentScale - nextScale) <= 0.0001 ? currentScale : nextScale
        ));
        setScaledHeight((currentHeight) => (
          currentHeight === nextScaledHeight ? currentHeight : nextScaledHeight
        ));
      }
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(viewport);
    observer.observe(content);
    const motionFrame = motionFrameRef?.current;
    motionFrame?.addEventListener(appearancePreviewMotionEventName, update);
    return () => {
      observer.disconnect();
      motionFrame?.removeEventListener(appearancePreviewMotionEventName, update);
    };
  }, [motionFrameRef, product, previewConfig, settledLogicalWidth]);

  return (
    <div
      ref={viewportRef}
      className="relative h-[620px] w-full overflow-hidden bg-slate-100/70"
      data-preview-transitioning={transitioning}
    >
      <div
        ref={contentRef}
        data-storefront-theme="true"
        data-admin-product-live-preview="true"
        data-preview-device={device}
        className="admin-product-live-preview storefront-theme-preview absolute left-2 top-2 min-h-[640px] origin-top-left overflow-hidden bg-[color:var(--site-color-page)] text-[color:var(--site-color-text)]"
        style={{
          ...themeStyle
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
              selectedElementIds,
              onSelectElement,
              onElementChange
            }}
          />
        </ProductAppearanceProvider>
        <ProductCanvasGuidesOverlay
          rootRef={contentRef}
          selectedElementId={selectedElementId}
          enabled={previewConfig.canvas.showGuides && !transitioning}
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
