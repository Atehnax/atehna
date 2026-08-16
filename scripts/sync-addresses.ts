import nextEnv from '@next/env';

nextEnv.loadEnvConfig(process.cwd());

const { syncGursAddresses } = await import(
  '../src/shared/server/gursAddressSync'
);

try {
  const result = await syncGursAddresses();
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (result.status === 'skipped') process.exitCode = 2;
} catch (error) {
  process.stderr.write(
    `${error instanceof Error ? error.stack ?? error.message : String(error)}\n`
  );
  process.exitCode = 1;
}
