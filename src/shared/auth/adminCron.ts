import { createHash, timingSafeEqual } from 'node:crypto';

const ADMIN_CRON_PATHS = new Set([
  '/api/admin/archive/cleanup',
  '/api/admin/audit-events/prune',
  '/api/admin/order-email-settings/process',
  '/api/admin/quote-workflow/process',
  '/api/admin/addresses/sync',
  '/api/admin/analytics/geography/refresh',
  '/api/admin/analytics/geography/process',
  '/api/admin/analytics/diagnostics/prune'
]);

// Machine authentication is limited to the scheduled GET operations.
export function isAuthorizedAdminCron(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (
    request.method !== 'GET' ||
    !ADMIN_CRON_PATHS.has(new URL(request.url).pathname) ||
    !secret
  ) return false;
  const authorization = request.headers.get('authorization');
  if (!authorization) return false;
  const supplied = createHash('sha256').update(authorization).digest();
  const expected = createHash('sha256').update('Bearer ' + secret).digest();
  return timingSafeEqual(supplied, expected);
}
