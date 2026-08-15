const ADMIN_HOME = '/admin/orders';
const RETURN_PATH_BASE = 'https://admin-return.invalid';

export function normalizeAdminReturnPath(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) return ADMIN_HOME;

  try {
    const parsed = new URL(value, RETURN_PATH_BASE);
    if (
      parsed.origin !== RETURN_PATH_BASE ||
      parsed.pathname === '/admin' ||
      !parsed.pathname.startsWith('/admin/')
    ) {
      return ADMIN_HOME;
    }

    return `${parsed.pathname}${parsed.search}`;
  } catch {
    return ADMIN_HOME;
  }
}
