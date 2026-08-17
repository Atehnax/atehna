import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { request, type FullConfig } from '@playwright/test';
import {
  checkE2eDatabase,
  readE2eEnvironment
} from '../../scripts/e2e-database.mjs';
import { ADMIN_STORAGE_STATE_PATH } from './support/auth';
import {
  assertLiveDatabaseIdentity,
  readLiveDatabaseIdentity
} from './support/database-identity';

function requiredEnvironment(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`[e2e-preflight] ${name} is required.`);
  return value;
}

export default async function globalSetup(config: FullConfig) {
  if (process.env.E2E_MODE !== '1') {
    throw new Error('[e2e-preflight] E2E_MODE must be set to 1.');
  }

  const baseURL = String(
    config.projects[0]?.use.baseURL
      ?? process.env.PLAYWRIGHT_BASE_URL
      ?? 'http://localhost:3000'
  );
  const username = requiredEnvironment('ADMIN_USERNAME');
  const password = requiredEnvironment('ADMIN_PASSWORD');
  requiredEnvironment('ADMIN_SESSION_SECRET');
  const { databaseIdentity: expectedDatabaseIdentity } = readE2eEnvironment();
  await checkE2eDatabase();

  const adminRequest = await request.newContext({ baseURL });
  try {
    const health = await adminRequest.get('/api/e2e/health');
    if (!health.ok()) {
      throw new Error(`[e2e-preflight] Application health check failed with status ${health.status()}.`);
    }
    const healthPayload: unknown = await health.json();
    assertLiveDatabaseIdentity(
      expectedDatabaseIdentity,
      readLiveDatabaseIdentity(healthPayload)
    );

    const login = await adminRequest.post('/api/admin/login', {
      data: { username, password }
    });
    if (!login.ok()) {
      throw new Error(`[e2e-preflight] Admin authentication check failed with status ${login.status()}.`);
    }

    const protectedProbe = await adminRequest.get('/api/admin/categories?view=preview');
    if (!protectedProbe.ok()) {
      throw new Error(`[e2e-preflight] Protected database-backed endpoint failed with status ${protectedProbe.status()}.`);
    }
    const payload = await protectedProbe.json() as { categories?: unknown[] };
    if (!Array.isArray(payload.categories) || payload.categories.length === 0) {
      throw new Error('[e2e-preflight] Deterministic category seed is unavailable through the application.');
    }

    await mkdir(dirname(ADMIN_STORAGE_STATE_PATH), { recursive: true });
    await adminRequest.storageState({ path: ADMIN_STORAGE_STATE_PATH });
    console.info('[e2e-preflight] Application, admin authentication, and protected database endpoint are healthy.');
  } finally {
    await adminRequest.dispose();
  }
}
