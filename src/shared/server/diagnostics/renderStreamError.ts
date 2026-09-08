import { createHash, randomUUID } from 'node:crypto';
import type { Instrumentation } from 'next';

type ErrorRequest = Parameters<Instrumentation.onRequestError>[1];
type ErrorContext = Parameters<Instrumentation.onRequestError>[2];
const destinationClosedMessage = 'The destination stream closed early.';
const hash = (value: string) => createHash('sha256').update(value).digest('hex');
function member<T extends string>(value: unknown, choices: readonly T[]): T | null {
  return typeof value === 'string' && choices.includes(value as T) ? value as T : null;
}

export function renderStreamErrorEvent(error: unknown, request: ErrorRequest, context: ErrorContext) {
  if (!error || typeof error !== 'object' || !('message' in error) || error.message !== destinationClosedMessage) return null;

  // routePath is the framework's source route template, never request.path or query data.
  const route = context.routePath;
  const routeTemplate = route.length <= 180 && /^\/[A-Za-z0-9_./()[\]-]*$/.test(route) ? route : null;
  const platformId = request.headers['x-vercel-id'];
  const platformRequestIdSha256 = typeof platformId === 'string' && platformId.length > 0 && platformId.length <= 256 ? hash(platformId) : null;
  const digest = 'digest' in error && typeof error.digest === 'string' && /^\d{1,16}$/.test(error.digest) ? error.digest : null;
  const stackSha256 = 'stack' in error && typeof error.stack === 'string' ? hash(error.stack) : null;

  return {
    event: 'render_destination_stream_closed',
    eventId: randomUUID(),
    recordedAt: new Date().toISOString(),
    routeTemplate,
    method: member(request.method, ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']),
    routerKind: member(context.routerKind, ['App Router', 'Pages Router']),
    routeType: member(context.routeType, ['render', 'route', 'action', 'proxy']),
    renderSource: member(context.renderSource, ['react-server-components', 'react-server-components-payload', 'server-rendering']),
    revalidateReason: member(context.revalidateReason, ['on-demand', 'stale']),
    platformRequestIdSha256,
    digest,
    stackSha256
  };
}

export function reportRenderStreamError(
  error: unknown,
  request: ErrorRequest,
  context: ErrorContext,
  write: (line: string) => void = line => console.error(line)
) {
  try {
    const event = renderStreamErrorEvent(error, request, context);
    if (event) write(JSON.stringify(event));
  } catch {
    // Do not throw, persist to the database, or replace the framework's original error.
  }
}
