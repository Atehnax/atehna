import type { LogoBounds, PublishedLogoAsset } from './logoLibrary';
import {
  SITE_NAVIGATION_TOP_BAR_LOGO_WIDTH_PX,
  SITE_NAVIGATION_TOP_BAR_SEARCH_COLLAPSED_WIDTH_PX,
  type SiteNavigationTopBarDevice,
  type SiteNavigationTopBarResponsiveLayout
} from '@/shared/domain/navigation/siteNavigation';
import { COMMERCIAL_STOREFRONT_SCALE } from '@/commercial/components/commercialStorefrontScale';

export const HEADER_LOGO_DEFAULT_HEIGHTS = { desktop: 18, tablet: 16.5, mobile: 15 } as const;
export const HEADER_LOGO_LINK_PADDING_PX = 10 * COMMERCIAL_STOREFRONT_SCALE;
export type LogoDisplaySize = {
  widthPx: number; heightPx: number; explicit: boolean;
  areaWidthPx: number; areaHeightPx: number; scale: number;
  sourceBounds: LogoBounds; artworkBounds: LogoBounds; rasterUpscaled: boolean;
};

/** Invalid or empty ink metadata must never produce an unsafe image window. */
function headerLogoArtworkBounds(asset: PublishedLogoAsset | null, canvas: LogoBounds): LogoBounds {
  const bounds = asset?.bounds;
  return bounds && [bounds.x, bounds.y, bounds.width, bounds.height].every(Number.isFinite)
    && bounds.x >= 0 && bounds.y >= 0 && bounds.width > 0 && bounds.height > 0
    && bounds.x + bounds.width <= canvas.width && bounds.y + bounds.height <= canvas.height
    ? { ...bounds } : { ...canvas };
}

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
  const sourceWidth = Math.max(1, Number.isFinite(asset?.width) ? asset!.width : 88);
  const sourceHeight = Math.max(1, Number.isFinite(asset?.height) ? asset!.height : 24);
  const canvas = { x: 0, y: 0, width: sourceWidth, height: sourceHeight };
  const bounds = headerLogoArtworkBounds(asset, canvas);
  const sourceBounds = layout.settings.logoFit === 'artwork' ? { ...bounds } : canvas;
  const scale = Math.min(areaWidthPx / sourceBounds.width, areaHeightPx / sourceBounds.height, requestedHeight / sourceBounds.height);
  return {
    widthPx: sourceBounds.width * scale, heightPx: sourceBounds.height * scale, explicit: asset?.fallback !== 'brand',
    areaWidthPx, areaHeightPx, scale, sourceBounds,
    artworkBounds: { x: (bounds.x - sourceBounds.x) * scale, y: (bounds.y - sourceBounds.y) * scale, width: bounds.width * scale, height: bounds.height * scale },
    rasterUpscaled: Boolean(asset && !asset.svgUrl && scale > 1)
  };
}

/**
 * Sizes newly adopted artwork, or an explicit height edit, in visible CSS pixels.
 * Width rounds upward because navigation persists whole-pixel slots. The image
 * keeps its exact aspect ratio inside that slot after configuration normalization.
 */
export function resizeHeaderLogo(
  layout: SiteNavigationTopBarResponsiveLayout,
  asset: PublishedLogoAsset | null,
  requestedHeight = SITE_NAVIGATION_TOP_BAR_SEARCH_COLLAPSED_WIDTH_PX
): SiteNavigationTopBarResponsiveLayout {
  const logo = layout.items.find(item => item.id === 'logo');
  // Text-brand fallback uses its own DOM typography, not the published-image box.
  if (!logo || !asset || asset.fallback === 'brand') return layout;
  if (!Number.isFinite(asset.width) || !Number.isFinite(asset.height) || asset.width <= 0 || asset.height <= 0) {
    return layout;
  }
  const bounds = headerLogoArtworkBounds(asset, { x: 0, y: 0, width: asset.width, height: asset.height });
  const aspect = bounds.width / bounds.height;
  // These bounds match normalizeTopBarResponsiveItems (widthPx / fixedWidthPx).
  const maximumSlotWidth = 1600;
  const maximumFixedWidth = 1200;
  const desiredHeight = Math.max(8, Math.min(64,
    Math.round((Number.isFinite(requestedHeight) ? requestedHeight : SITE_NAVIGATION_TOP_BAR_SEARCH_COLLAPSED_WIDTH_PX) * 2) / 2
  ));
  const maximumHeight = Math.floor(Math.min(
    64,
    layout.settings.height * COMMERCIAL_STOREFRONT_SCALE - HEADER_LOGO_LINK_PADDING_PX,
    (maximumSlotWidth - HEADER_LOGO_LINK_PADDING_PX) / aspect
  ) * 2) / 2;
  // Extreme panoramas can require less than the persisted 8px minimum. Keep
  // the existing bounded fit behavior; callers can display its actual height.
  const height = Math.max(8, Math.min(desiredHeight, maximumHeight));
  const width = Math.min(maximumSlotWidth, Math.max(SITE_NAVIGATION_TOP_BAR_LOGO_WIDTH_PX,
    Math.ceil(height * aspect + HEADER_LOGO_LINK_PADDING_PX)));
  const previousAnchorWidth = logo.anchorWidthPx ?? Math.max(
    logo.widthPx, logo.fixedWidthPx ?? 0, SITE_NAVIGATION_TOP_BAR_LOGO_WIDTH_PX
  );
  return {
    ...layout,
    settings: { ...layout.settings, logoHeightPx: height, logoFit: 'artwork' },
    items: layout.items.map(item => item !== logo ? item : {
      ...item,
      widthPx: width,
      fixedWidthPx: Math.min(width, maximumFixedWidth),
      ...(item.region === 'center' ? { anchorWidthPx: previousAnchorWidth } : {})
    })
  };
}
