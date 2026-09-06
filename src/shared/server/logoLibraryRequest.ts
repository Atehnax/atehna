import 'server-only';
import { hasValidAdminSession } from '@/shared/auth/adminSession';
import { requestOriginMatchesHost } from '@/shared/server/requestSecurity';
import { LogoLibraryError } from './logoLibraryOperations';
import { readLimitedLogoStream } from './logoLibraryStorage';

export const logoPrivateHeaders = { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff', 'X-Robots-Tag': 'noindex, nofollow' };
export function authorizeLogoRequest(request: Request, mutation = false) {
  if (!hasValidAdminSession(request)) throw new LogoLibraryError('Za dostop je potrebna prijava.', 401);
  if (mutation && (request.headers.get('sec-fetch-site') === 'cross-site' || !requestOriginMatchesHost(request))) {
    throw new LogoLibraryError('Zahtevek mora izvirati iz te administracije.', 403);
  }
}
export async function boundedLogoBody(request: Request, maximum: number): Promise<Buffer> {
  const length = request.headers.get('content-length');
  if (length && (!/^\d+$/u.test(length) || Number(length) > maximum)) throw new LogoLibraryError('Zahtevek je prevelik.', 413);
  if (!request.body) throw new LogoLibraryError('Vsebina zahtevka manjka.');
  return readLimitedLogoStream(request.body, maximum);
}
export function logoErrorResponse(error: unknown): Response {
  const known = error instanceof LogoLibraryError;
  if (!known) console.error('Logo library operation failed', { error: error instanceof Error ? error.name : 'UnknownError' });
  return Response.json({ message: known ? error.message : 'Dejanje logotipa ni uspelo. Prejšnja objava je ohranjena; poskusite znova.' },
    { status: known ? error.status : 503, headers: logoPrivateHeaders });
}
