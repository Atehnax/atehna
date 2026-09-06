import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';
import { createLogoBrandFallback } from '@/shared/server/logoBrandFallback';
import { LOGO_PLACEMENT_IDS, type LogoPlacementId } from '@/shared/domain/logo/logoLibrary';
import { LOGO_OUTPUT_DIMENSIONS } from '@/shared/domain/logo/logoOutputDimensions';
import { getLogoLibrary, getPublishedSiteLogos } from '@/shared/server/logoLibrary';
import { readLogoPublishedOutput } from '@/shared/server/logoLibraryStorage';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 120;
export async function GET(_request: Request, context: { params: Promise<{ purpose: string }> }) {
  const { purpose } = await context.params;
  if (!(LOGO_PLACEMENT_IDS as readonly string[]).includes(purpose)) return new Response('Not found', { status: 404 });
  const selected = (await getPublishedSiteLogos()).placements[purpose as LogoPlacementId];
  if (!selected) return new Response(null, { status: 204, headers: { 'Cache-Control': 'public, max-age=0, must-revalidate' } });
  const dimensions = LOGO_OUTPUT_DIMENSIONS[purpose as LogoPlacementId];
  const headers = { 'Cache-Control': 'public, max-age=0, must-revalidate', 'X-Content-Type-Options': 'nosniff', ETag: '"' + selected.revision + '-' + purpose + '"' };
  if (selected.fallback === 'brand') {
    return createLogoBrandFallback(purpose as LogoPlacementId, headers);
  }
  let bytes: Buffer;
  if (selected.fallback === 'original') bytes = await readFile(join(process.cwd(), 'public', 'brand', 'atehna-document-wordmark.png'));
  else {
    const library = await getLogoLibrary();
    const variant = library.variants.find(value => value.id === selected.variantId);
    const revision = [variant?.published, ...(variant?.history ?? [])].find(value => value?.id === selected.revision);
    if (!revision) return new Response('Logo temporarily unavailable', { status: 503, headers: { 'Cache-Control': 'no-store' } });
    bytes = await readLogoPublishedOutput(revision.png2x);
  }
  const rendered = await sharp(bytes, { limitInputPixels: 16_000_000 }).resize(dimensions.widthPx, dimensions.heightPx, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
  return new Response(Uint8Array.from(rendered), { headers: { ...headers, 'Content-Type': 'image/png' } });
}
