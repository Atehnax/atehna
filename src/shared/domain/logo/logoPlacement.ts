import type { LogoBounds, PublishedLogoAsset } from './logoLibrary';
import {
  normalizeSiteNavigationConfig,
  type SiteNavigationConfig,
  type SiteNavigationTopBarDevice,
  type SiteNavigationTopBarResponsiveLayout
} from '@/shared/domain/navigation/siteNavigation';
import { COMMERCIAL_STOREFRONT_SCALE } from '@/commercial/components/commercialStorefrontScale';

export const HEADER_LOGO_DEFAULT_HEIGHTS = { desktop: 18, tablet: 16.5, mobile: 15 } as const;
export const HEADER_LOGO_LINK_PADDING_PX = 10 * COMMERCIAL_STOREFRONT_SCALE;
export type LogoDisplaySize = {
  widthPx: number; heightPx: number; explicit: boolean;
  areaWidthPx: number; areaHeightPx: number; scale: number;
  artworkBounds: LogoBounds; rasterUpscaled: boolean;
};

export function resolveHeaderLogoSize(
  device: SiteNavigationTopBarDevice,
  layout: SiteNavigationTopBarResponsiveLayout,
  asset: PublishedLogoAsset | null
): LogoDisplaySize {
  const item = layout.items.find(candidate => candidate.id === 'logo');
  const slotWidth = Math.max(item?.widthPx ?? 88, item?.fixedWidthPx ?? 0, 88);
  const areaWidthPx = Math.max(1, slotWidth - HEADER_LOGO_LINK_PADDING_PX);
  const requestedHeight = layout.settings.logoHeightPx ?? HEADER_LOGO_DEFAULT_HEIGHTS[device];
  const areaHeightPx = Math.max(1, Math.min(requestedHeight, layout.settings.height * COMMERCIAL_STOREFRONT_SCALE - HEADER_LOGO_LINK_PADDING_PX));
  const sourceWidth = Math.max(1, asset?.width ?? 88);
  const sourceHeight = Math.max(1, asset?.height ?? 24);
  const scale = Math.min(areaWidthPx / sourceWidth, areaHeightPx / sourceHeight, requestedHeight / sourceHeight);
  const bounds = asset?.bounds ?? { x: 0, y: 0, width: sourceWidth, height: sourceHeight };
  return {
    widthPx: sourceWidth * scale, heightPx: sourceHeight * scale, explicit: asset?.fallback !== 'brand',
    areaWidthPx, areaHeightPx, scale,
    artworkBounds: { x: bounds.x * scale, y: bounds.y * scale, width: bounds.width * scale, height: bounds.height * scale },
    rasterUpscaled: Boolean(asset && !asset.svgUrl && scale > 1)
  };
}

/** One-time migration of existing placement sizing into navigation's ownership. */
export function migrateLogoNavigationConstraints(navigationInput: unknown, previousLogoInput: unknown): SiteNavigationConfig {
  const navigation = normalizeSiteNavigationConfig(navigationInput);
  const old = previousLogoInput && typeof previousLogoInput === 'object'
    ? previousLogoInput as { placements?: Record<string, { displayHeightPx?: unknown }> } : {};
  const ratios = { desktop: 176 / 48, tablet: 144 / 44, mobile: 112 / 40 };
  for (const key of ['topBarLayout', 'topBarInitialLayout'] as const) {
    for (const device of ['desktop', 'tablet', 'mobile'] as const) {
      const layout = navigation[key].responsive[device];
      const oldHeight = old.placements?.['header-' + device]?.displayHeightPx;
      const explicit = typeof oldHeight === 'number' && Number.isFinite(oldHeight);
      const height = explicit ? Math.max(8, Math.min(64, oldHeight)) : HEADER_LOGO_DEFAULT_HEIGHTS[device];
      layout.settings.logoHeightPx = height;
      if (explicit) {
        const item = layout.items.find(candidate => candidate.id === 'logo');
        if (item) {
          const previousWidth = Math.max(item.widthPx, item.fixedWidthPx ?? 0, 88);
          const width = Math.max(previousWidth, height * ratios[device] + HEADER_LOGO_LINK_PADDING_PX);
          if (item.region === 'center' && width > previousWidth) item.anchorWidthPx = item.anchorWidthPx ?? previousWidth;
          item.widthPx = width;
          item.fixedWidthPx = width;
        }
      }
    }
  }
  return navigation;
}
