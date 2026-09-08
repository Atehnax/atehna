import { createInterface } from 'node:readline';
import { Writable } from 'node:stream';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { AdminAccountSetupError, initializeAdminAccount, validateAdminCredentials } from './admin-account-core.mjs';
import { createAdminSetupPool } from './admin-setup-database.mjs';
import { loadManifest, verifyDatabaseContract } from './check-database-schema.mjs';

function promptLine(label, hidden = false) {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new AdminAccountSetupError('Interactive setup requires a terminal. For a one-time import, use --import-legacy-env.');
  }
  return new Promise((resolveLine, reject) => {
    const silentOutput = new Writable({ write(_chunk, _encoding, callback) { callback(); } });
    const reader = createInterface({ input: process.stdin, output: hidden ? silentOutput : process.stdout, terminal: true, historySize: 0 });
    let settled = false;
    const cancel = () => {
      if (settled) return;
      settled = true;
      reader.close();
      if (hidden) process.stdout.write('\n');
      reject(new AdminAccountSetupError('Administrator initialization cancelled.'));
    };
    reader.once('SIGINT', cancel);
    reader.once('close', cancel);
    if (hidden) process.stdout.write(label);
    reader.question(hidden ? '' : label, answer => {
      settled = true;
      reader.close();
      if (hidden) process.stdout.write('\n');
      resolveLine(answer);
    });
  });
}

export async function main(args = process.argv.slice(2)) {
  if (args.length > 1 || (args.length === 1 && args[0] !== '--import-legacy-env')) {
    throw new AdminAccountSetupError('Usage: node scripts/init-admin-account.mjs [--import-legacy-env]. Credentials are never accepted as arguments.');
  }
  const pool = createAdminSetupPool();
  try {
    await verifyDatabaseContract(pool, await loadManifest());
    let credentials;
    if (args[0] === '--import-legacy-env') {
      credentials = validateAdminCredentials(process.env.ADMIN_USERNAME, process.env.ADMIN_PASSWORD);
    } else {
      const username = await promptLine('Administrator username: ');
      const password = await promptLine('Administrator password (hidden): ', true);
      const confirmation = await promptLine('Repeat password (hidden): ', true);
      if (password !== confirmation) throw new AdminAccountSetupError('Passwords do not match. No account was created.');
      credentials = validateAdminCredentials(username, password);
    }
    await initializeAdminAccount(pool, credentials);
    console.info('Administrator account initialized. Remove legacy ADMIN_USERNAME, ADMIN_PASSWORD and ADMIN_SESSION_TTL_SECONDS from runtime configuration.');
  } finally { await pool.end(); }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => {
    console.error(error instanceof AdminAccountSetupError ? error.message : 'Administrator initialization failed; no credentials were printed. Verify the selected database and schema, then retry.');
    process.exitCode = 1;
  });
}
