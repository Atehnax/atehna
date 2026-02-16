import { Pool } from 'pg';

let pool: Pool | null = null;

const DB_URL_ENV_KEYS = ['DATABASE_URL', 'POSTGRES_URL', 'POSTGRES_PRISMA_URL', 'SUPABASE_DB_URL'] as const;

export function getDatabaseUrl(): string | null {
  for (const key of DB_URL_ENV_KEYS) {
    const value = process.env[key];
    if (value && value.trim()) return value;
  }
  return null;
}

function shouldUseSsl(databaseUrl: string): boolean {
  if (databaseUrl.includes('sslmode=disable')) return false;
  return databaseUrl.includes('neon.tech') || process.env.NODE_ENV === 'production';
}

export async function getPool(): Promise<Pool> {
  if (pool) return pool;
  const connectionString = getDatabaseUrl();
  if (!connectionString) {
    throw new Error('Database connection string is not set');
  }

  pool = new Pool(
    {
      connectionString,
      ...(shouldUseSsl(connectionString) ? { ssl: { rejectUnauthorized: false } } : {})
    } as any
  );
  return pool;
}
