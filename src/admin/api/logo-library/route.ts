import type { LogoLibraryAction } from '@/shared/domain/logo/logoLibrary';
import { getLogoLibrary, mutateLogoLibrary, previewLogoProject } from '@/shared/server/logoLibrary';
import { LogoLibraryError, publishedLogoProjection } from '@/shared/server/logoLibraryOperations';
import { authorizeLogoRequest, boundedLogoBody, logoErrorResponse, logoPrivateHeaders } from '@/shared/server/logoLibraryRequest';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 120;
export async function GET(request: Request) {
  try {
    authorizeLogoRequest(request);
    const library = await getLogoLibrary();
    return Response.json({ library, published: publishedLogoProjection(library) }, { headers: logoPrivateHeaders });
  }
  catch (error) { return logoErrorResponse(error); }
}
export async function POST(request: Request) {
  try {
    authorizeLogoRequest(request, true);
    if (!request.headers.get('content-type')?.startsWith('application/json')) throw new LogoLibraryError('Pričakovan je zahtevek JSON.');
    let input: LogoLibraryAction;
    try { input = JSON.parse((await boundedLogoBody(request, 1024 * 1024)).toString('utf8')); }
    catch (error) { if (error instanceof LogoLibraryError) throw error; throw new LogoLibraryError('Neveljaven JSON.'); }
    if (!input || typeof input !== 'object' || !['create', 'save', 'duplicate', 'rename', 'delete', 'assign', 'publish', 'restore', 'preview', 'export'].includes(input.action)) throw new LogoLibraryError('Dejanje knjižnice ni veljavno.');
    if (input.action === 'preview' || input.action === 'export') {
      if (input.action === 'export' && (!['png', 'svg'].includes(input.format) || (input.scale !== undefined && input.scale !== 1 && input.scale !== 2))) throw new LogoLibraryError('Izberite izvoz PNG ali SVG pri povečavi 1× ali 2×.');
      const rendered = await previewLogoProject(input.project);
      if (input.action === 'preview') {
        const body = JSON.stringify({ svg: rendered.svg, pngDataUrl: 'data:image/png;base64,' + rendered.png.toString('base64'), width: rendered.width, height: rendered.height, bounds: rendered.bounds });
        if (Buffer.byteLength(body) > 4_000_000) throw new LogoLibraryError('Predogled je prevelik. Zmanjšajte platno ali velikost izvornih slik.', 413);
        return new Response(body, { headers: { ...logoPrivateHeaders, 'Content-Type': 'application/json' } });
      }
      const bytes = input.format === 'svg' ? Buffer.from(rendered.svg) : input.scale === 2 ? rendered.png2x : rendered.png;
      if (bytes.byteLength > 4_000_000) throw new LogoLibraryError('Izvoz je prevelik za neposredni prenos. Zmanjšajte platno ali izberite povečavo 1×.', 413);
      return new Response(Uint8Array.from(bytes), { headers: { ...logoPrivateHeaders,
        'Content-Type': input.format === 'svg' ? 'image/svg+xml' : 'image/png',
        'Content-Disposition': 'attachment; filename="logotip.' + input.format + '"' } });
    }
    const library = await mutateLogoLibrary(input, request);
    return Response.json({ library, published: publishedLogoProjection(library) }, { headers: logoPrivateHeaders });
  } catch (error) { return logoErrorResponse(error); }
}
