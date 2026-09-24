import { spawn } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { loadManifest, verifyDatabaseContract } from './check-database-schema.mjs';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

async function main() {
  const { values } = parseArgs({
    options: {
      'env-file': { type: 'string', default: '.env.development.local' },
      port: { type: 'string', default: '3012' }
    }
  });
  const port = Number(values.port);
  if (!Number.isInteger(port) || port < 1024 || port > 65535) {
    throw new Error('Use a local review port between 1024 and 65535.');
  }
  process.loadEnvFile(resolve(projectRoot, values['env-file']));
  process.env.E2E_MODE = '1';
  const databaseUrl = process.env.DATABASE_URL;
  const database = new URL(databaseUrl);
  const namespace = process.env.E2E_STORAGE_NAMESPACE || '';
  if (
    !['postgres:', 'postgresql:'].includes(database.protocol) ||
    !['localhost', '127.0.0.1', '[::1]'].includes(database.hostname) ||
    !/^[a-z0-9][a-z0-9-]{10,50}[a-z0-9]$/.test(namespace) ||
    decodeURIComponent(database.pathname.slice(1)) !== 'atehna_e2e_' + namespace.replaceAll('-', '_') ||
    (process.env.E2E_DATABASE_URL && process.env.E2E_DATABASE_URL !== databaseUrl)
  ) throw new Error('Local review requires the matching isolated loopback database.');

  // Check the existing schema without resetting data or requiring a seed password.
  const client = new pg.Client({ connectionString: databaseUrl, ssl: false, connectionTimeoutMillis: 5000 });
  let schemaSha256;
  try {
    await client.connect();
    await verifyDatabaseContract(client, await loadManifest());
    const { rows } = await client.query("select sha256 from e2e_schema_state where key = 'canonical-schema'");
    schemaSha256 = rows[0]?.sha256;
    if (!/^[a-f0-9]{64}$/.test(schemaSha256 || '')) throw new Error('Local schema fingerprint is missing.');
  } finally {
    await client.end();
  }
  const env = {
    ...process.env,
    NODE_ENV: 'development',
    DATABASE_URL: databaseUrl,
    ADMIN_AUTH_URL: 'http://localhost:' + port,
    PGSSLMODE: 'disable',
    E2E_MODE: '1',
    E2E_SCHEMA_SHA256: schemaSha256,
    E2E_LOCAL_PRIVATE_BLOB: '1',
    BLOB_READ_WRITE_TOKEN: 'e2e-external-blob-disabled',
    RESEND_API_KEY: ''
  };
  for (const name of [
    'ADMIN_USERNAME', 'ADMIN_PASSWORD', 'ADMIN_SESSION_TTL', 'ADMIN_SESSION_TTL_SECONDS',
    'E2E_ADMIN_USERNAME', 'E2E_ADMIN_PASSWORD'
  ]) delete env[name];

  // Use Next's default Turbopack bundler, including its persistent development cache.
  const child = spawn(process.execPath, [
    resolve(projectRoot, 'node_modules/next/dist/bin/next'),
    'dev', '--hostname', 'localhost', '--port', String(port)
  ], { cwd: projectRoot, env, stdio: 'inherit', windowsHide: true });
  process.once('SIGINT', () => child.kill('SIGINT'));
  process.once('SIGTERM', () => child.kill('SIGTERM'));
  await new Promise((done, reject) => {
    child.once('error', reject);
    child.once('exit', code => { process.exitCode = code ?? 1; done(); });
  });
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : 'Local review startup failed.');
  process.exitCode = 1;
});
