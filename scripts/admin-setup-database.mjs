import pg from 'pg';
import { resolveDatabaseSslConfig } from '../src/shared/server/environmentCore.mjs';
import { AdminAccountSetupError } from './admin-account-core.mjs';

/** No .env loader: operators must explicitly select the target in this process. */
export function createAdminSetupPool(environment = process.env) {
  const connectionString = environment.DATABASE_URL;
  if (typeof connectionString !== 'string' || !connectionString.trim()) {
    throw new AdminAccountSetupError('Explicit DATABASE_URL is required; setup does not load environment files.');
  }
  let target;
  try { target = new URL(connectionString); } catch {
    throw new AdminAccountSetupError('DATABASE_URL is invalid.');
  }
  if (!['postgres:', 'postgresql:'].includes(target.protocol)) {
    throw new AdminAccountSetupError('DATABASE_URL must use PostgreSQL.');
  }
  return new pg.Pool({
    connectionString,
    ssl: resolveDatabaseSslConfig(connectionString, environment),
    max: 1,
    connectionTimeoutMillis: 5_000,
    idleTimeoutMillis: 5_000,
    statement_timeout: 15_000,
    lock_timeout: 5_000
  });
}
