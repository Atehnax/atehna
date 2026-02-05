declare module 'pg' {
  export type QueryResult<T = any> = {
    rows: T[];
    rowCount: number | null;
  };

  export type PoolClient = {
    query: (text: string, params?: unknown[]) => Promise<QueryResult>;
    release: () => void;
  };

  export class Pool {
    constructor(config: { connectionString: string });
    connect: () => Promise<PoolClient>;
    query: (text: string, params?: unknown[]) => Promise<QueryResult>;
  }
}
