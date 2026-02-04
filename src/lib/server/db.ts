import 'server-only';

import type { Pool as PgPool } from 'pg';

let pool: PgPool | null = null;

export async function getPool(): Promise<PgPool> {
  if (pool) return pool;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set');
  }

  const { Pool } = await import('pg');
  pool = new Pool({ connectionString });

  return pool;
}