import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

export const ADMIN_SESSION_COOKIE = 'atehna_admin_session';

export type AdminAuthConfig = {
  username: string;
  password: string;
  sessionSecret: string;
  sessionTtlSeconds: number;
};

type AdminSessionPayload = {
  v: 1;
  sub: string;
  iat: number;
  exp: number;
};

const DEFAULT_SESSION_TTL_SECONDS = 8 * 60 * 60;
const MIN_SESSION_TTL_SECONDS = 5 * 60;
const MAX_SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;

function safeTextEqual(left: string, right: string): boolean {
  const leftHash = createHash('sha256').update(left, 'utf8').digest();
  const rightHash = createHash('sha256').update(right, 'utf8').digest();
  return timingSafeEqual(leftHash, rightHash);
}

function normalizeSessionTtl(value: string | undefined): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return DEFAULT_SESSION_TTL_SECONDS;
  return Math.min(
    MAX_SESSION_TTL_SECONDS,
    Math.max(MIN_SESSION_TTL_SECONDS, Math.floor(parsed))
  );
}

export function getAdminAuthConfig(): AdminAuthConfig | null {
  const isProduction = process.env.NODE_ENV === 'production';
  const configuredUsername = process.env.ADMIN_USERNAME?.trim();
  const configuredPassword = process.env.ADMIN_PASSWORD;
  const configuredSecret = process.env.ADMIN_SESSION_SECRET;

  if (isProduction && (!configuredUsername || !configuredPassword || !configuredSecret)) {
    return null;
  }

  const username = configuredUsername || 'admin';
  const password = configuredPassword || 'admin';
  const sessionSecret =
    configuredSecret ||
    createHash('sha256')
      .update(`atehna-development-session:${username}:${password}`, 'utf8')
      .digest('hex');

  return {
    username,
    password,
    sessionSecret,
    sessionTtlSeconds: normalizeSessionTtl(process.env.ADMIN_SESSION_TTL_SECONDS)
  };
}

function signPayload(encodedPayload: string, secret: string): string {
  return createHmac('sha256', secret).update(encodedPayload, 'utf8').digest('base64url');
}

export function createAdminSessionToken(
  config: AdminAuthConfig,
  now = new Date()
): { token: string; expiresAt: Date; maxAge: number } {
  const issuedAt = Math.floor(now.getTime() / 1000);
  const expiresAtSeconds = issuedAt + config.sessionTtlSeconds;
  const payload: AdminSessionPayload = {
    v: 1,
    sub: config.username,
    iat: issuedAt,
    exp: expiresAtSeconds
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const signature = signPayload(encodedPayload, config.sessionSecret);

  return {
    token: `${encodedPayload}.${signature}`,
    expiresAt: new Date(expiresAtSeconds * 1000),
    maxAge: config.sessionTtlSeconds
  };
}

export function verifyAdminSessionToken(
  token: string | null | undefined,
  config: AdminAuthConfig | null,
  now = new Date()
): boolean {
  if (!token || !config) return false;
  const [encodedPayload, suppliedSignature, extra] = token.split('.');
  if (!encodedPayload || !suppliedSignature || extra !== undefined) return false;

  const expectedSignature = signPayload(encodedPayload, config.sessionSecret);
  if (!safeTextEqual(suppliedSignature, expectedSignature)) return false;

  try {
    const payload = JSON.parse(
      Buffer.from(encodedPayload, 'base64url').toString('utf8')
    ) as Partial<AdminSessionPayload>;
    const nowSeconds = Math.floor(now.getTime() / 1000);

    return (
      payload.v === 1 &&
      typeof payload.sub === 'string' &&
      safeTextEqual(payload.sub, config.username) &&
      typeof payload.iat === 'number' &&
      typeof payload.exp === 'number' &&
      payload.iat <= nowSeconds + 300 &&
      payload.exp > nowSeconds
    );
  } catch {
    return false;
  }
}

export function verifyAdminCredentials(
  username: unknown,
  password: unknown,
  config: AdminAuthConfig | null
): boolean {
  if (!config || typeof username !== 'string' || typeof password !== 'string') return false;
  return safeTextEqual(username, config.username) && safeTextEqual(password, config.password);
}
