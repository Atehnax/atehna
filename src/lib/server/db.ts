import type { Pool } from 'pg';

let pool: Pool | null = null;

export async function getPool(): Promise<Pool> {
  if (pool) return pool;
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set');
  }
  const { Pool } = await import('pg');
  pool = new Pool({ connectionString: process.env.DATABASE_URL });
  return pool;
}
