import { defineConfig, devices } from '@playwright/test';
import { ADMIN_STORAGE_STATE_PATH } from './tests/e2e/support/auth';

function readE2eBaseURL() {
  const rawBaseURL = process.env.PLAYWRIGHT_BASE_URL?.trim() || 'http://localhost:3000';
  let parsed: URL;
  try {
    parsed = new URL(rawBaseURL);
  } catch {
    throw new Error('[e2e-preflight] PLAYWRIGHT_BASE_URL must be a valid URL.');
  }
  const port = Number(parsed.port);
  if (
    parsed.protocol !== 'http:'
    || parsed.hostname.toLowerCase() !== 'localhost'
    || parsed.username
    || parsed.password
    || parsed.pathname !== '/'
    || parsed.search
    || parsed.hash
    || !Number.isInteger(port)
    || port < 1024
    || port > 65_535
  ) {
    throw new Error(
      '[e2e-preflight] PLAYWRIGHT_BASE_URL must be an explicit http://localhost:<port> origin.'
    );
  }
  process.env.PORT = String(port);
  return parsed.origin;
}

const baseURL = readE2eBaseURL();
const shardLabel = process.env.PLAYWRIGHT_SHARD?.trim() || 'sequential';
const localChromiumExecutablePath =
  process.env.ATEHNA_PLAYWRIGHT_EXECUTABLE?.trim();
const reuseExistingServer = process.env.PLAYWRIGHT_REUSE_EXISTING_SERVER === '1';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  expect: {
    timeout: 5_000
  },
  forbidOnly: Boolean(process.env.CI),
  fullyParallel: false,
  retries: 0,
  workers: 1,
  globalSetup: './tests/e2e/global-setup.ts',
  globalTeardown: './tests/e2e/global-teardown.ts',
  reporter: process.env.CI
    ? [['blob', {
        outputDir: 'blob-report',
        fileName: `report-${shardLabel.replace(/[^a-zA-Z0-9._-]+/gu, '-')}.zip`
      }]]
    : [
        ['list'],
        ['html', { outputFolder: 'playwright-report', open: 'never' }]
      ],
  use: {
    baseURL,
    storageState: ADMIN_STORAGE_STATE_PATH,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure'
  },
  webServer: {
    command: 'npm run e2e:server',
    url: `${baseURL}/api/e2e/health`,
    reuseExistingServer,
    timeout: 120_000
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: localChromiumExecutablePath
          ? { executablePath: localChromiumExecutablePath }
          : undefined
      }
    }
  ]
});
