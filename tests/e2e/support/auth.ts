import { resolve } from 'node:path';
import type { APIRequestContext } from '@playwright/test';

export const E2E_BASE_URL = process.env.PLAYWRIGHT_BASE_URL?.trim()
  || 'http://localhost:3000';

export const ADMIN_STORAGE_STATE_PATH = resolve(
  process.cwd(),
  '.playwright',
  'auth',
  'admin.json'
);

const ADMIN_AUTH_PROBE_PATH = '/api/admin/categories?view=preview';

export async function assertAuthenticatedAdmin(
  request: APIRequestContext
) {
  const response = await request.get(ADMIN_AUTH_PROBE_PATH);
  if (response.status() !== 200) {
    throw new Error(
      `[e2e-auth] Expected the Playwright global admin storage state to authenticate ${ADMIN_AUTH_PROBE_PATH}, but it returned status ${response.status()}.`
    );
  }
}
