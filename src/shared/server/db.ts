import { Pool, type PoolConfig } from 'pg';

let pool: Pool | null = null;

const DB_URL_ENV_KEYS = ['DATABASE_URL', 'POSTGRES_URL', 'POSTGRES_PRISMA_URL', 'SUPABASE_DB_URL'] as const;
const DATABASE_UNAVAILABLE_ERROR_CODES = new Set(['EACCES', 'ECONNREFUSED', 'ENETUNREACH', 'ETIMEDOUT', 'ENOTFOUND']);
const DATABASE_RUNTIME_ENV_KEYS = {
  poolMax: 'ATEHNA_DB_POOL_MAX',
  connectionTimeoutMillis: 'ATEHNA_DB_CONNECTION_TIMEOUT_MS',
  idleTimeoutMillis: 'ATEHNA_DB_IDLE_TIMEOUT_MS',
  statementTimeoutMillis: 'ATEHNA_DB_STATEMENT_TIMEOUT_MS',
  lockTimeoutMillis: 'ATEHNA_DB_LOCK_TIMEOUT_MS'
} as const;

type SslConfig = false | { rejectUnauthorized: boolean };
type DatabaseRuntimeEnvironment = Readonly<Record<string, string | undefined>>;
type RuntimeIntegerRange = Readonly<{
  minimum: number;
  maximum: number;
  allowZero?: boolean;
}>;

export type DatabasePoolRuntimeConfig = Readonly<{
  poolMax: number;
  connectionTimeoutMillis: number;
  idleTimeoutMillis: number;
  statementTimeoutMillis: number;
  lockTimeoutMillis: number;
}>;

const DATABASE_RUNTIME_DEFAULTS: DatabasePoolRuntimeConfig = {
  poolMax: 10,
  connectionTimeoutMillis: 0,
  idleTimeoutMillis: 10_000,
  statementTimeoutMillis: 0,
  lockTimeoutMillis: 0
};

function throwInvalidRuntimeInteger(key: string, range: RuntimeIntegerRange): never {
  const zeroOption = range.allowZero ? '0 (disabled) or ' : '';
  throw new Error(
    `${key} must be ${zeroOption}a whole number between ${range.minimum} and ${range.maximum}`
  );
}

function parseRuntimeInteger(
  environment: DatabaseRuntimeEnvironment,
  key: string,
  fallback: number,
  range: RuntimeIntegerRange
): number {
  const rawValue = environment[key];
  if (rawValue == null || rawValue.trim() === '') return fallback;

  const normalizedValue = rawValue.trim();
  if (!/^\d+$/u.test(normalizedValue)) {
    throwInvalidRuntimeInteger(key, range);
  }

  const value = Number(normalizedValue);
  if (!Number.isSafeInteger(value)) {
    throwInvalidRuntimeInteger(key, range);
  }

  const isAllowedZero = range.allowZero === true && value === 0;
  if (!isAllowedZero && (value < range.minimum || value > range.maximum)) {
    throwInvalidRuntimeInteger(key, range);
  }

  return value;
}

export function resolveDatabasePoolRuntimeConfig(
  environment: DatabaseRuntimeEnvironment = process.env
): DatabasePoolRuntimeConfig {
  return {
    poolMax: parseRuntimeInteger(
      environment,
      DATABASE_RUNTIME_ENV_KEYS.poolMax,
      DATABASE_RUNTIME_DEFAULTS.poolMax,
      {
        minimum: 1,
        maximum: 50
      }
    ),
    connectionTimeoutMillis: parseRuntimeInteger(
      environment,
      DATABASE_RUNTIME_ENV_KEYS.connectionTimeoutMillis,
      DATABASE_RUNTIME_DEFAULTS.connectionTimeoutMillis,
      { minimum: 100, maximum: 120_000, allowZero: true }
    ),
    idleTimeoutMillis: parseRuntimeInteger(
      environment,
      DATABASE_RUNTIME_ENV_KEYS.idleTimeoutMillis,
      DATABASE_RUNTIME_DEFAULTS.idleTimeoutMillis,
      { minimum: 1_000, maximum: 600_000, allowZero: true }
    ),
    statementTimeoutMillis: parseRuntimeInteger(
      environment,
      DATABASE_RUNTIME_ENV_KEYS.statementTimeoutMillis,
      DATABASE_RUNTIME_DEFAULTS.statementTimeoutMillis,
      { minimum: 1_000, maximum: 900_000, allowZero: true }
    ),
    lockTimeoutMillis: parseRuntimeInteger(
      environment,
      DATABASE_RUNTIME_ENV_KEYS.lockTimeoutMillis,
      DATABASE_RUNTIME_DEFAULTS.lockTimeoutMillis,
      { minimum: 100, maximum: 120_000, allowZero: true }
    )
  };
}

export function getDatabaseUrl(): string | null {
  for (const key of DB_URL_ENV_KEYS) {
    const value = process.env[key];
    if (value && value.trim()) return value;
  }
  return null;
}

export function hasDatabaseConnectionString(): boolean {
  return getDatabaseUrl() !== null;
}

function parseSslMode(databaseUrl: string): string | null {
  const parsedUrl = new URL(databaseUrl);
  return parsedUrl.searchParams.get('sslmode');
}

function resolveSslConfig(databaseUrl: string): SslConfig {
  const sslModeFromUrl = parseSslMode(databaseUrl)?.toLowerCase() ?? null;
  const sslModeFromEnv = process.env.PGSSLMODE?.trim().toLowerCase() ?? null;
  const mode = sslModeFromUrl ?? sslModeFromEnv;

  if (mode === 'disable' || mode === 'allow' || mode === 'prefer') return false;
  if (mode === 'verify-ca' || mode === 'verify-full') return { rejectUnauthorized: true };

  if (databaseUrl.includes('localhost') || databaseUrl.includes('127.0.0.1')) return false;

  return { rejectUnauthorized: false };
}

function hasDatabaseUnavailableSignal(error: unknown, seen: Set<unknown>): boolean {
  if (error == null) return false;
  if (typeof error === 'string') {
    return error.includes('Database connection string is not set');
  }
  if (typeof error !== 'object') return false;
  if (seen.has(error)) return false;
  seen.add(error);

  const candidate = error as {
    code?: unknown;
    message?: unknown;
    cause?: unknown;
    errors?: unknown[];
  };

  if (typeof candidate.code === 'string' && DATABASE_UNAVAILABLE_ERROR_CODES.has(candidate.code)) {
    return true;
  }
  if (typeof candidate.message === 'string' && candidate.message.includes('Database connection string is not set')) {
    return true;
  }
  if (Array.isArray(candidate.errors) && candidate.errors.some((entry) => hasDatabaseUnavailableSignal(entry, seen))) {
    return true;
  }
  if ('cause' in candidate && hasDatabaseUnavailableSignal(candidate.cause, seen)) {
    return true;
  }
  return false;
}

export function isDatabaseUnavailableError(error: unknown): boolean {
  return hasDatabaseUnavailableSignal(error, new Set());
}

export async function getPool(): Promise<Pool> {
  if (pool) return pool;
  const connectionString = getDatabaseUrl();
  if (!connectionString) {
    throw new Error('Database connection string is not set');
  }

  const runtimeConfig = resolveDatabasePoolRuntimeConfig();
  const poolConfig = {
    connectionString,
    ssl: resolveSslConfig(connectionString),
    max: runtimeConfig.poolMax,
    connectionTimeoutMillis: runtimeConfig.connectionTimeoutMillis,
    idleTimeoutMillis: runtimeConfig.idleTimeoutMillis,
    statement_timeout: runtimeConfig.statementTimeoutMillis,
    lock_timeout: runtimeConfig.lockTimeoutMillis
  } satisfies PoolConfig;

  pool = new Pool(poolConfig);
  return pool;
}
