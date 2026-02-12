import { Pool } from 'pg';

let pool: Pool | null = null;

function shouldUseSsl(databaseUrl: string): boolean {
  if (databaseUrl.includes('sslmode=disable')) return false;
  return databaseUrl.includes('neon.tech') || process.env.NODE_ENV === 'production';
}

export async function getPool(): Promise<Pool> {
  if (pool) return pool;
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set');
  }

  const connectionString = process.env.DATABASE_URL;

  pool = new Pool(
    {
      connectionString,
      ...(shouldUseSsl(connectionString) ? { ssl: { rejectUnauthorized: false } } : {})
    } as any
  );
  return pool;
}
