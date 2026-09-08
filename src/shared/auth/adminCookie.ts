// Kept separate so the optimistic proxy never imports authentication storage.
export const ADMIN_SESSION_COOKIE =
  (process.env.NODE_ENV === 'production' ? '__Secure-' : '') + 'atehna_admin_session';

