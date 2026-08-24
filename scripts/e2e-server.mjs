import { spawn } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { checkE2eDatabase, readE2eEnvironment } from './e2e-database.mjs';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const nextCli = resolve(projectRoot, 'node_modules', 'next', 'dist', 'bin', 'next');

async function main() {
  const { databaseUrl } = readE2eEnvironment();
  const { schemaSha256 } = await checkE2eDatabase();

  const port = process.env.PORT?.trim() || '3000';
  const child = spawn(
    process.execPath,
    [nextCli, 'start', '--hostname', 'localhost', '--port', port],
    {
      stdio: 'inherit',
      env: {
        ...process.env,
        DATABASE_URL: databaseUrl,
        POSTGRES_URL: databaseUrl,
        POSTGRES_PRISMA_URL: databaseUrl,
        SUPABASE_DB_URL: databaseUrl,
        PGSSLMODE: 'disable',
        BLOB_READ_WRITE_TOKEN: 'e2e-external-blob-disabled',
        ORDER_ACCESS_BOOTSTRAP_KEY: 'e2e-only-order-bootstrap-key-with-at-least-32-characters',
        RESEND_API_KEY: '',
        E2E_MODE: '1',
        E2E_SCHEMA_SHA256: schemaSha256
      }
    }
  );

  const forwardSignal = (signal) => {
    if (!child.killed) child.kill(signal);
  };
  process.once('SIGINT', () => forwardSignal('SIGINT'));
  process.once('SIGTERM', () => forwardSignal('SIGTERM'));

  child.once('error', (error) => {
    console.error(`[e2e-server] Failed to start Next.js: ${error.message}`);
    process.exitCode = 1;
  });
  child.once('exit', (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }
    process.exitCode = code ?? 1;
  });
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : '[e2e-server] Unknown startup failure.');
  process.exitCode = 1;
});
