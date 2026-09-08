import type { LogoSourceAsset } from '@/shared/domain/logo/logoLibrary';
import { uploadLogoLibrarySource } from '@/shared/server/logoLibrary';
import { LogoLibraryError } from '@/shared/server/logoLibraryOperations';
import { LOGO_SOURCE_MAX_BYTES } from '@/shared/server/logoLibraryStorage';
import { authorizeLogoRequest, boundedLogoBody, logoErrorResponse, logoPrivateHeaders } from '@/shared/server/logoLibraryRequest';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 120;
export async function POST(request: Request) {
  try {
    await authorizeLogoRequest(request, true);
    const contentType = request.headers.get('content-type') ?? '';
    if (!contentType.startsWith('multipart/form-data;')) throw new LogoLibraryError('Pričakovana je slikovna datoteka.');
    const bytes = await boundedLogoBody(request, LOGO_SOURCE_MAX_BYTES + 64 * 1024);
    let form: FormData;
    try { form = await new Response(Uint8Array.from(bytes), { headers: { 'Content-Type': contentType } }).formData(); }
    catch { throw new LogoLibraryError('Datoteke ni mogoče prebrati.'); }
    const file = form.get('file'); const revision = form.get('expectedRevision');
    if (!(file instanceof File) || file.size <= 0 || file.size > LOGO_SOURCE_MAX_BYTES || !['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'].includes(file.type)) {
      throw new LogoLibraryError('Dovoljeni so PNG, JPEG, WebP in SVG do 3 MB.', 413);
    }
    if (typeof revision !== 'string' || !/^\d+$/u.test(revision)) throw new LogoLibraryError('Različica knjižnice manjka.');
    const result = await uploadLogoLibrarySource(file.name, new Uint8Array(await file.arrayBuffer()), file.type as LogoSourceAsset['mimeType'], Number(revision), request);
    return Response.json(result, { headers: logoPrivateHeaders });
  } catch (error) { return logoErrorResponse(error); }
}
