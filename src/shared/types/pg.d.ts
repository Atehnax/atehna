declare module 'pg' {
  export type QueryResult<T = Record<string, unknown>> = {
    rows: T[];
    rowCount: number | null;
  };

  export type PoolConfig = {
    connectionString: string;
    ssl?: boolean | { rejectUnauthorized: boolean };
  };

  export type PoolClient = {
    query: <T = Record<string, unknown>>(text: string, params?: unknown[]) => Promise<QueryResult<T>>;
    release: () => void;
  };

  export class Pool {
    constructor(config: PoolConfig);
    connect: () => Promise<PoolClient>;
    query: <T = Record<string, unknown>>(text: string, params?: unknown[]) => Promise<QueryResult<T>>;
  }
}
