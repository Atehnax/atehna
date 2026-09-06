import type { LogoPlacementId } from './logoLibrary';

/** Fixed raster dimensions for metadata and public placement downloads. */
export const LOGO_OUTPUT_DIMENSIONS: Record<LogoPlacementId, { widthPx: number; heightPx: number }> = {
  'header-desktop': { widthPx: 176, heightPx: 48 },
  'header-tablet': { widthPx: 144, heightPx: 44 },
  'header-mobile': { widthPx: 112, heightPx: 40 },
  'footer-desktop': { widthPx: 176, heightPx: 56 },
  'footer-tablet': { widthPx: 160, heightPx: 52 },
  'footer-mobile': { widthPx: 144, heightPx: 48 },
  standalone: { widthPx: 512, heightPx: 230 },
  'pdf-document': { widthPx: 946, heightPx: 300 },
  favicon: { widthPx: 48, heightPx: 48 },
  'apple-touch-icon': { widthPx: 180, heightPx: 180 },
  'pwa-maskable': { widthPx: 512, heightPx: 512 },
  'social-share': { widthPx: 1200, heightPx: 630 }
};
