import { getLogoLibrary } from '@/shared/server/logoLibrary';
import { isLocalLogoStorage, readLogoPublishedOutput } from '@/shared/server/logoLibraryStorage';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export async function GET(_request: Request, context: { params: Promise<{ revisionId: string; file: string }> }) {
  if (!isLocalLogoStorage()) return new Response('Not found', { status: 404 });
  const { revisionId, file } = await context.params;
  if (!/^[a-f0-9-]{36}$/u.test(revisionId) || !/^logo(?:@2x)?\.(png|svg)$/u.test(file)) return new Response('Not found', { status: 404 });
  const library = await getLogoLibrary();
  const revision = library.variants.flatMap(variant => [variant.published, ...variant.history]).find(value => value?.id === revisionId);
  const asset = revision && (file === 'logo.svg' ? revision.svg : file === 'logo@2x.png' ? revision.png2x : revision.png);
  if (!asset) return new Response('Not found', { status: 404 });
  return new Response(Uint8Array.from(await readLogoPublishedOutput(asset)), { headers: {
    'Content-Type': asset.mimeType, 'Cache-Control': 'public, max-age=31536000, immutable', 'X-Content-Type-Options': 'nosniff',
    'Content-Security-Policy': "sandbox; default-src 'none'; style-src 'unsafe-inline'"
  } });
}
