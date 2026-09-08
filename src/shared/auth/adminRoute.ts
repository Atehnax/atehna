import 'server-only';

import { getAdminSession } from '@/shared/auth/adminSession';
import { isAuthorizedAdminCron } from '@/shared/auth/adminCron';
import { rejectAdminCrossOrigin } from '@/shared/auth/adminCsrf';

type RouteHandler = (...args: never[]) => Response | Promise<Response>;
type AdminRouteOptions = { allowCron?: boolean };

const privateHeaders = { 'Cache-Control': 'private, no-store' };

// Preserve each route's exact Request/context types for Next's route validator.
// The original operation cannot run until its server-side session is verified.
export function withAdminRoute<Handler extends RouteHandler>(
  handler: Handler,
  options: AdminRouteOptions = {}
): Handler {
  const protectedHandler = async (...args: unknown[]): Promise<Response> => {
    const request = args[0] as Request;
    const cron = options.allowCron === true && isAuthorizedAdminCron(request);

    if (!cron) {
      let session;
      try {
        session = await getAdminSession(request);
      } catch {
        return Response.json(
          { message: 'Prijave trenutno ni mogoče preveriti. Poskusite znova.' },
          { status: 503, headers: privateHeaders }
        );
      }
      if (!session) {
        return Response.json(
          { message: 'Za dostop je potrebna prijava.' },
          { status: 401, headers: privateHeaders }
        );
      }
      if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
        const rejected = rejectAdminCrossOrigin(request);
        if (rejected) return rejected;
      }
    }

    const invoke = handler as unknown as (...values: unknown[]) => Response | Promise<Response>;
    const response = await invoke(...args);
    response.headers.set('Cache-Control', 'private, no-store');
    return response;
  };
  return protectedHandler as unknown as Handler;
}

