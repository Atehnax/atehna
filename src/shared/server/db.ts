import { Pool, type PoolConfig } from 'pg';
import {
  resolveDatabasePoolRuntimeConfig as resolveDatabasePoolRuntimeConfigCore,
  resolveDatabaseSslConfig as resolveDatabaseSslConfigCore,
  resolveDatabaseUrl as resolveDatabaseUrlCore,
  type DatabasePoolRuntimeConfig,
  type EnvironmentSource
} from '@/shared/server/environmentCore.mjs';

export type { DatabasePoolRuntimeConfig };

let pool: Pool | null = null;

const DATABASE_UNAVAILABLE_ERROR_CODES = new Set(['EACCES', 'ECONNREFUSED', 'ENETUNREACH', 'ETIMEDOUT', 'ENOTFOUND']);

export function getDatabaseUrl(): string | null {
  return resolveDatabaseUrlCore(process.env);
}

export function resolveDatabasePoolRuntimeConfig(
  environment: EnvironmentSource = process.env
): DatabasePoolRuntimeConfig {
  return resolveDatabasePoolRuntimeConfigCore(environment);
}

export function hasDatabaseConnectionString(): boolean {
  return getDatabaseUrl() !== null;
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
    ssl: resolveDatabaseSslConfigCore(connectionString, process.env),
    max: runtimeConfig.poolMax,
    connectionTimeoutMillis: runtimeConfig.connectionTimeoutMillis,
    idleTimeoutMillis: runtimeConfig.idleTimeoutMillis,
    statement_timeout: runtimeConfig.statementTimeoutMillis,
    lock_timeout: runtimeConfig.lockTimeoutMillis
  } satisfies PoolConfig;

  pool = new Pool(poolConfig);
  return pool;
}
