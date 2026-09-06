import 'server-only';
import { createHash, randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { LOGO_PLACEMENT_IDS, LOGO_PLACEMENT_LABELS, type LogoLibrary, type LogoSourceAsset, type LogoProject, type LogoPublishedRevision } from '@/shared/domain/logo/logoLibrary';
import { normalizeSiteLogoConfig, resolveSiteLogoGeometry, resolveSiteLogoFittedArtworkRect, resolveSiteLogoFittedCropRect, SITE_LOGO_PURPOSE_CATALOG, isSiteLogoHeaderPurpose, type SiteLogoConfig, type SiteLogoPurposeId } from '@/shared/domain/logo/siteLogo';
import { resolveSiteLogoArtwork } from '@/shared/server/siteLogoArtworkCore';

/** Used only by the one-time importer. Active consumers never render the old settings model. */
export async function renderLegacyLogoPlacement(config: SiteLogoConfig, purposeId: SiteLogoPurposeId): Promise<Buffer | null> {
  const artwork = await resolveSiteLogoArtwork(config, purposeId);
  if (!artwork) return null;
  const purpose = SITE_LOGO_PURPOSE_CATALOG[purposeId], placement = config.placements[purposeId];
  const width = purpose.widthPx * 2, height = purpose.heightPx * 2;
  const geometry = resolveSiteLogoGeometry(placement);
  // Pure contain placements share the artwork itself; their different viewport sizes do not
  // create disconnected library copies. Only existing optical edits need a baked viewport.
  if (placement.fitMode === 'contain' && geometry.scale === 1 && geometry.translateX === 0 && geometry.translateY === 0 && geometry.safeAreaInset === 0 && geometry.crop.x === 0 && geometry.crop.y === 0 && geometry.crop.width === 1 && geometry.crop.height === 1) {
    const scale = Math.min(1, Math.sqrt(4_000_000 / (artwork.intrinsicWidth * artwork.intrinsicHeight)));
    return sharp(artwork.bytes).resize(Math.max(1, Math.floor(artwork.intrinsicWidth * scale)), Math.max(1, Math.floor(artwork.intrinsicHeight * scale))).png().toBuffer();
  }
  const rect = resolveSiteLogoFittedArtworkRect({ sourceWidth: artwork.intrinsicWidth, sourceHeight: artwork.intrinsicHeight, viewportWidth: width, viewportHeight: height, geometry, fitMode: placement.fitMode, artworkScale: isSiteLogoHeaderPurpose(purposeId) && placement.displayHeightPx != null ? 1 : geometry.scale });
  const crop = resolveSiteLogoFittedCropRect(rect, geometry.crop);
  const left = Math.max(0, crop.left), top = Math.max(0, crop.top), right = Math.min(width, crop.left + crop.width), bottom = Math.min(height, crop.top + crop.height);
  const content = right > left && bottom > top ? `<defs><clipPath id="crop"><rect x="${left}" y="${top}" width="${right - left}" height="${bottom - top}"/></clipPath></defs><g clip-path="url(#crop)"><image href="data:image/png;base64,${Buffer.from(artwork.bytes).toString('base64')}" x="${rect.left}" y="${rect.top}" width="${rect.width}" height="${rect.height}" preserveAspectRatio="none"/></g>` : '';
  return sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">${content}</svg>`), { limitInputPixels: 16_000_000 }).png().toBuffer();
}

type MigrationCallbacks = {
  saveSource: (name: string, bytes: Uint8Array, mimeType: LogoSourceAsset['mimeType']) => Promise<LogoSourceAsset>;
  publish: (project: LogoProject, assets: LogoSourceAsset[]) => Promise<LogoPublishedRevision>;
};

export async function migrateLegacyLogoConfig(raw: unknown, callbacks: MigrationCallbacks): Promise<Omit<LogoLibrary, 'revision'>> {
  const config = normalizeSiteLogoConfig(raw), now = new Date().toISOString();
  const assets: LogoSourceAsset[] = [], variants: LogoLibrary['variants'] = [], placements = {} as LogoLibrary['placements'];
  const renderedByHash = new Map<string, string>();
  // Keep original uploads as independent editable image sources, including currently unused files.
  for (const master of config.masters) {
    const { validateSiteLogoMasterContent } = await import('@/shared/server/siteLogoArtworkCore');
    const source = await validateSiteLogoMasterContent(master);
    const asset = await callbacks.saveSource(master.filename, source.bytes, master.mimeType);
    assets.push(asset);
    const scale = Math.min(1, Math.sqrt(4_000_000 / (asset.width * asset.height)));
    const project: LogoProject = { version: 1, canvas: { width: Math.max(1, Math.floor(asset.width * scale)), height: Math.max(1, Math.floor(asset.height * scale)) }, layers: [{ id: randomUUID(), name: master.label, type: 'image', assetId: asset.id, x: 0, y: 0, width: Math.max(1, Math.floor(asset.width * scale)), height: Math.max(1, Math.floor(asset.height * scale)), opacity: 1, rotation: 0, visible: true, locked: false, crop: { x: 0, y: 0, width: 1, height: 1 }, mask: 'rectangle' }] };
    variants.push({ id: randomUUID(), name: master.label + ' · izvirnik', draft: project, draftRevision: 1, updatedAt: now, published: null, history: [] });
  }
  for (const purpose of LOGO_PLACEMENT_IDS) {
    const old = config.placements[purpose];
    if (!old.enabled) { placements[purpose] = { variantId: null, fallback: 'none' }; continue; }
    if (!old.masterId) {
      placements[purpose] = { variantId: null, fallback: purpose === 'pdf-document' ? 'none' : purpose.startsWith('footer-') ? 'original' : 'brand' };
      continue;
    }
    const png = await renderLegacyLogoPlacement(config, purpose);
    if (!png) throw new Error('Obstoječega logotipa ni mogoče ohraniti.');
    const hash = createHash('sha256').update(png).digest('hex');
    let variantId = renderedByHash.get(hash);
    if (!variantId) {
      const asset = await callbacks.saveSource(LOGO_PLACEMENT_LABELS[purpose] + ' · ohranjen videz.png', png, 'image/png');
      assets.push(asset);
      const project: LogoProject = { version: 1, canvas: { width: asset.width, height: asset.height }, layers: [{ id: randomUUID(), name: 'Ohranjen videz logotipa', type: 'image', assetId: asset.id, x: 0, y: 0, width: asset.width, height: asset.height, rotation: 0, opacity: 1, visible: true, locked: false, crop: { x: 0, y: 0, width: 1, height: 1 }, mask: 'rectangle' }] };
      const published = await callbacks.publish(project, assets);
      variantId = randomUUID();
      variants.push({ id: variantId, name: LOGO_PLACEMENT_LABELS[purpose], draft: project, draftRevision: 1, updatedAt: now, published, history: [] });
      renderedByHash.set(hash, variantId);
    }
    placements[purpose] = { variantId, fallback: 'none' };
  }
  return { version: 1, assets, variants, placements, migratedAt: now };
}
