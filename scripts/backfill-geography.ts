import nextEnv from '@next/env';
nextEnv.loadEnvConfig(process.cwd());
const { backfillGeography } = await import('../src/shared/server/geographyAnalytics');
try {
  const result = await backfillGeography({ batchSize: 500, retryUnresolved: process.argv.includes('--retry-unresolved') });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
  process.exitCode = 1;
} finally {
  const { getPool } = await import('../src/shared/server/db');
  await (await getPool()).end();
}
