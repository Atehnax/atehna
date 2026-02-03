import 'server-only';

const connectionString = process.env.DATABASE_URL;

let pool: { connect: () => Promise<DbClient> } | null = null;

const getPool = async (): Promise<{ connect: () => Promise<DbClient> }> => {
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set');
  }
  if (!pool) {
    const { Pool } = await (0, eval)('import("pg")');
    pool = new Pool({ connectionString });
  }
  return pool as { connect: () => Promise<DbClient> };
};

export async function query<T>(text: string, params: unknown[] = []) {
  const poolInstance = await getPool();
  const client = await poolInstance.connect();
  try {
    const result = await client.query<T>(text, params);
    return result;
  } finally {
    client.release();
  }
}

export async function withTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const poolInstance = await getPool();
  const client = await poolInstance.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export type DbClient = {
  query: <T>(text: string, params?: unknown[]) => Promise<{ rows: T[] }>;
  release: () => void;
};

export type PoolClient = DbClient;
