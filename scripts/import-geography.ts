import nextEnv from '@next/env';
nextEnv.loadEnvConfig(process.cwd());
const { importGeographyReference } = await import('../src/shared/server/geographyReference');
try {
  const result = await importGeographyReference({ assetsOnly: process.argv.includes('--assets-only'), bundled: process.argv.includes('--bundled'), writeAssets: process.argv.includes('--write-assets') });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
  process.exitCode = 1;
} finally {
  const { hasDatabaseConnectionString, getPool } = await import('../src/shared/server/db');
  if (!process.argv.includes('--assets-only') && hasDatabaseConnectionString()) await (await getPool()).end();
}
