import 'server-only';

export function requestOriginMatchesHost(request: Request): boolean {
  const origin = request.headers.get('origin');
  if (!origin) return process.env.NODE_ENV !== 'production';
  try {
    const parsed = new URL(origin);
    const forwardedHost =
      request.headers.get('x-forwarded-host')?.split(',')[0]?.trim() ||
      request.headers.get('host')?.trim();
    const forwardedProto =
      request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim() ||
      (process.env.NODE_ENV === 'production' ? 'https' : parsed.protocol.slice(0, -1));
    return (
      Boolean(forwardedHost) &&
      parsed.host.toLowerCase() === forwardedHost?.toLowerCase() &&
      parsed.protocol === `${forwardedProto}:`
    );
  } catch {
    return false;
  }
}
