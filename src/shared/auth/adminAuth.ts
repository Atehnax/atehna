import 'server-only';

import { AsyncLocalStorage } from 'node:async_hooks';
import { betterAuth } from 'better-auth';
import { username } from 'better-auth/plugins';
import { getAdminSessionSecret } from '@/shared/auth/adminSecret';
import { getPool } from '@/shared/server/db';

export const adminLoginContext = new AsyncLocalStorage<{ credentialVersion: number }>();

export { getAdminSessionSecret } from '@/shared/auth/adminSecret';

export function getAdminAuthOrigin(): string {
  const configured = process.env.ADMIN_AUTH_URL || process.env.NEXT_PUBLIC_SITE_URL;
  if (configured) return new URL(configured).origin;
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return new URL(`https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`).origin;
  if (process.env.NODE_ENV !== 'production') return 'http://localhost:3000';
  throw new Error('ADMIN_AUTH_URL must specify the administrator login origin.');
}

async function createAuth() {
  const pool = await getPool();
  return betterAuth({
    appName: 'Atehna',
    secret: getAdminSessionSecret(),
    baseURL: getAdminAuthOrigin(),
    basePath: '/api/admin/auth',
    trustedOrigins: [getAdminAuthOrigin()],
    database: pool,
    logger: { disabled: true },
    emailAndPassword: { enabled: true, disableSignUp: true, minPasswordLength: 12, maxPasswordLength: 128 },
    // No generic auth handler is mounted. Only our username login/logout endpoints are exposed.
    disabledPaths: ['/sign-up/email', '/sign-in/email', '/request-password-reset', '/reset-password',
      '/send-verification-email', '/verify-email', '/update-user', '/change-email', '/delete-user',
      '/is-username-available'],
    rateLimit: { enabled: false }, // Atomic PostgreSQL attempt reservations in adminLoginRateLimit.
    user: { modelName: 'admin_auth_user', additionalFields: {
      credentialVersion: { type: 'number', defaultValue: 1, input: false }
    } },
    account: { modelName: 'admin_auth_account' },
    verification: { modelName: 'admin_auth_verification' },
    session: {
      modelName: 'admin_auth_session',
      // Cookie can outlive a server session, but never authenticates without the database.
      expiresIn: 90 * 86400,
      disableSessionRefresh: true,
      cookieCache: { enabled: false },
      additionalFields: {
        lastActivityAt: { type: 'date', input: false },
        credentialVersion: { type: 'number', input: false }
      }
    },
    advanced: {
      useSecureCookies: process.env.NODE_ENV === 'production',
      cookiePrefix: 'atehna_admin',
      cookies: { session_token: { name: 'atehna_admin_session' } },
      defaultCookieAttributes: { httpOnly: true, sameSite: 'lax', path: '/' }
    },
    plugins: [username({
      displayUsername: false, usernameNormalization: false,
      minUsernameLength: 1, maxUsernameLength: 128,
      usernameValidator: (value) => value.trim() === value && !/[\u0000-\u001f\u007f]/u.test(value)
    })],
    databaseHooks: {
      session: { create: { before: async (session) => {
        const login = adminLoginContext.getStore();
        if (!login) return false;
        const { rows } = await pool.query('select max_lifetime_days from admin_session_policy where id = 1');
        if (!rows[0]) throw new Error('Admin session policy is not initialized.');
        return { data: {
          ...session,
          lastActivityAt: session.createdAt,
          credentialVersion: login.credentialVersion,
          expiresAt: new Date(session.createdAt.getTime() + Number(rows[0].max_lifetime_days) * 86400000)
        } };
      } } }
    }
  });
}
let authPromise: ReturnType<typeof createAuth> | undefined;
export function getAdminAuth() {
  return authPromise ??= createAuth().catch((error: unknown) => { authPromise = undefined; throw error; });
}
