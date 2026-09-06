import { getLogoLibrary } from '@/shared/server/logoLibrary';
import { LogoLibraryError } from '@/shared/server/logoLibraryOperations';
import { readLogoSource } from '@/shared/server/logoLibraryStorage';
import { authorizeLogoRequest, logoErrorResponse, logoPrivateHeaders } from '@/shared/server/logoLibraryRequest';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export async function GET(request: Request, context: { params: Promise<{ assetId: string }> }) {
  try {
    authorizeLogoRequest(request);
    const { assetId } = await context.params;
    const asset = (await getLogoLibrary()).assets.find(value => value.id === assetId);
    if (!asset) throw new LogoLibraryError('Izvorna slika ne obstaja.', 404);
    return new Response(Uint8Array.from(await readLogoSource(asset)), { headers: {
      ...logoPrivateHeaders, 'Content-Type': asset.mimeType,
      'Content-Security-Policy': "sandbox; default-src 'none'; style-src 'unsafe-inline'"
    } });
  } catch (error) { return logoErrorResponse(error); }
}
