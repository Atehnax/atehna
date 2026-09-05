import 'server-only';

import { revalidateTag } from '@/shared/server/diagnostics/cache';
import { unstable_cache } from 'next/cache';
import sharp from 'sharp';
import {
  SITE_LOGO_PURPOSE_CATALOG,
  isSiteLogoHeaderPurpose,
  normalizeSiteLogoConfig,
  resolveSiteLogoFittedArtworkRect,
  resolveSiteLogoFittedCropRect,
  resolveSiteLogoGeometry,
  toStoredSiteLogoConfig,
  type SiteLogoConfig,
  type SiteLogoPurposeId
} from '@/shared/domain/logo/siteLogo';
import { resolveSiteLogoArtwork as resolveSiteLogoArtworkCore } from '@/shared/server/siteLogoArtworkCore';

export const SITE_LOGO_RENDERED_ARTWORK_CACHE_TAG = 'site-logo-rendered-artwork';
export const SITE_LOGO_RENDERED_ARTWORK_CACHE_SECONDS = 300;
export const SITE_LOGO_CACHED_ARTWORK_MAX_BASE64_BYTES = 1_400_000;
export const SITE_LOGO_PUBLIC_CACHE_CONTROL = 'public, max-age=0, s-maxage=300, stale-while-revalidate=60';

export type CachedSiteLogoArtwork = {
  base64: string;
  format: 'png';
  intrinsicWidth: number;
  intrinsicHeight: number;
};

async function renderPurposeSizedCachedArtwork(
  config: SiteLogoConfig,
  purposeId: SiteLogoPurposeId
): Promise<CachedSiteLogoArtwork | null> {
  const artwork = await resolveSiteLogoArtworkCore(config, purposeId);
  if (!artwork) return null;

  const purpose = SITE_LOGO_PURPOSE_CATALOG[purposeId];
  const placement = config.placements[purposeId];
  const geometry = resolveSiteLogoGeometry(placement);
  const fitted = resolveSiteLogoFittedArtworkRect({
    sourceWidth: artwork.intrinsicWidth,
    sourceHeight: artwork.intrinsicHeight,
    viewportWidth: purpose.widthPx,
    viewportHeight: purpose.heightPx,
    geometry,
    fitMode: placement.fitMode,
    artworkScale: isSiteLogoHeaderPurpose(purposeId) && placement.displayHeightPx != null
      ? 1
      : geometry.scale
  });
  const fittedCrop = resolveSiteLogoFittedCropRect(fitted, geometry.crop);
  const targetLeft = Math.max(0, Math.ceil(fittedCrop.left));
  const targetTop = Math.max(0, Math.ceil(fittedCrop.top));
  const targetRight = Math.min(purpose.widthPx, Math.floor(fittedCrop.left + fittedCrop.width));
  const targetBottom = Math.min(purpose.heightPx, Math.floor(fittedCrop.top + fittedCrop.height));
  let canvas = sharp({
    create: {
      width: purpose.widthPx,
      height: purpose.heightPx,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    }
  });

  if (targetRight > targetLeft && targetBottom > targetTop) {
    const cropSourceLeft = Math.ceil(geometry.crop.x * artwork.intrinsicWidth);
    const cropSourceTop = Math.ceil(geometry.crop.y * artwork.intrinsicHeight);
    const cropSourceRight = Math.floor(
      (geometry.crop.x + geometry.crop.width) * artwork.intrinsicWidth
    );
    const cropSourceBottom = Math.floor(
      (geometry.crop.y + geometry.crop.height) * artwork.intrinsicHeight
    );
    const sourceLeft = Math.max(
      cropSourceLeft,
      Math.floor((targetLeft - fitted.left) / fitted.scale)
    );
    const sourceTop = Math.max(
      cropSourceTop,
      Math.floor((targetTop - fitted.top) / fitted.scale)
    );
    const sourceRight = Math.min(
      cropSourceRight,
      artwork.intrinsicWidth,
      Math.ceil((targetRight - fitted.left) / fitted.scale)
    );
    const sourceBottom = Math.min(
      cropSourceBottom,
      artwork.intrinsicHeight,
      Math.ceil((targetBottom - fitted.top) / fitted.scale)
    );
    if (sourceRight > sourceLeft && sourceBottom > sourceTop) {
      const visibleArtwork = await sharp(Buffer.from(artwork.bytes))
        .extract({
          left: sourceLeft,
          top: sourceTop,
          width: sourceRight - sourceLeft,
          height: sourceBottom - sourceTop
        })
        .resize(targetRight - targetLeft, targetBottom - targetTop, {
          fit: 'fill',
          kernel: 'lanczos3'
        })
        .ensureAlpha()
        .png()
        .toBuffer();
      canvas = canvas.composite([{ input: visibleArtwork, left: targetLeft, top: targetTop }]);
    }
  }

  let encoded = await canvas
    .png({ palette: true, colours: 256, compressionLevel: 9 })
    .toBuffer();
  let base64 = encoded.toString('base64');
  if (base64.length > SITE_LOGO_CACHED_ARTWORK_MAX_BASE64_BYTES) {
    encoded = await sharp(encoded)
      .png({ palette: true, colours: 64, compressionLevel: 9 })
      .toBuffer();
    base64 = encoded.toString('base64');
  }
  if (base64.length > SITE_LOGO_CACHED_ARTWORK_MAX_BASE64_BYTES) {
    throw new Error('Purpose-sized site logo exceeds the safe rendered-artwork cache budget.');
  }
  return {
    base64,
    format: 'png',
    intrinsicWidth: purpose.widthPx,
    intrinsicHeight: purpose.heightPx
  };
}

const readCachedSiteLogoArtwork = unstable_cache(
  async (serializedConfig: string, purposeId: SiteLogoPurposeId): Promise<CachedSiteLogoArtwork | null> => {
    const config = normalizeSiteLogoConfig(JSON.parse(serializedConfig) as unknown);
    return renderPurposeSizedCachedArtwork(config, purposeId);
  },
  ['site-logo-rendered-artwork-v1'],
  {
    revalidate: SITE_LOGO_RENDERED_ARTWORK_CACHE_SECONDS,
    tags: [SITE_LOGO_RENDERED_ARTWORK_CACHE_TAG]
  }
);

export function revalidateSiteLogoArtworkCache() {
  revalidateTag(SITE_LOGO_RENDERED_ARTWORK_CACHE_TAG, { expire: 0 });
}

export function resolveCachedSiteLogoArtwork(
  config: SiteLogoConfig,
  purposeId: SiteLogoPurposeId
) {
  // The arguments are part of unstable_cache's key. Stored config includes
  // placement plus master URL/path/type/size/dimensions, so purpose, config,
  // and authoritative content metadata all participate without caching Buffer.
  return readCachedSiteLogoArtwork(JSON.stringify(toStoredSiteLogoConfig(config)), purposeId);
}

// The pure renderer owns renderBuiltInAtehnaLogoArtwork and the masks.secondary
// layer; this wrapper prevents accidental Client Component imports.
export {
  SITE_LOGO_MAX_CANVAS_PIXELS,
  SITE_LOGO_MAX_CANVAS_RAW_BYTES,
  SITE_LOGO_MAX_EFFECT_WORKSPACE_PIXELS,
  SITE_LOGO_MAX_SOURCE_DIMENSION,
  SITE_LOGO_MAX_SOURCE_PIXELS,
  assertSiteLogoRasterBudget,
  renderBuiltInAtehnaLogoArtwork,
  resolveSiteLogoArtwork,
  validateSiteLogoConfigContent,
  validateSiteLogoMasterContent,
  type ResolvedSiteLogoArtwork
} from '@/shared/server/siteLogoArtworkCore';
