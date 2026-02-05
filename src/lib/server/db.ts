let pool: any = null;

async function getPgModule() {
  const { createRequire } = await import('module');
  const require = createRequire(import.meta.url);
  return require('pg') as typeof import('pg');
}

export async function getPool() {
  if (pool) return pool;
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set');
  }
  const { Pool } = await getPgModule();
  pool = new Pool({ connectionString: process.env.DATABASE_URL });
  return pool;
}
