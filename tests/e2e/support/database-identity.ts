import type { ExpectedE2eDatabaseIdentity } from '../../../scripts/e2e-database.mjs';

export interface LiveE2eDatabaseIdentity {
  database: string;
  effectiveUser: string;
  serverAddress: string;
  serverPort: number;
}

export function readLiveDatabaseIdentity(payload: unknown): LiveE2eDatabaseIdentity {
  if (!payload || typeof payload !== 'object') {
    throw new Error('[e2e-preflight] Application health check did not return a database identity.');
  }
  const databaseIdentity = (payload as { databaseIdentity?: unknown }).databaseIdentity;
  if (!databaseIdentity || typeof databaseIdentity !== 'object') {
    throw new Error('[e2e-preflight] Application health check did not return a database identity.');
  }
  const candidate = databaseIdentity as Partial<LiveE2eDatabaseIdentity>;
  if (
    typeof candidate.database !== 'string'
    || typeof candidate.effectiveUser !== 'string'
    || typeof candidate.serverAddress !== 'string'
    || !Number.isInteger(candidate.serverPort)
  ) {
    throw new Error('[e2e-preflight] Application health check returned an invalid database identity.');
  }
  return candidate as LiveE2eDatabaseIdentity;
}

function serverAddressMatches(expected: ExpectedE2eDatabaseIdentity, actual: string) {
  if (expected.serverAddress === 'localhost') {
    return actual === 'localhost' || actual === '127.0.0.1' || actual === '::1';
  }
  return actual === expected.serverAddress;
}

export function assertLiveDatabaseIdentity(
  expected: ExpectedE2eDatabaseIdentity,
  actual: LiveE2eDatabaseIdentity
) {
  const mismatches: string[] = [];
  if (actual.database !== expected.database) mismatches.push('database');
  if (actual.effectiveUser !== expected.effectiveUser) mismatches.push('effective user');
  if (!serverAddressMatches(expected, actual.serverAddress)) mismatches.push('server address');
  if (actual.serverPort !== expected.serverPort) mismatches.push('server port');
  if (mismatches.length > 0) {
    throw new Error(
      `[e2e-preflight] Live application database identity does not match E2E_DATABASE_URL (${mismatches.join(', ')}). Refusing to run against that server.`
    );
  }
}
