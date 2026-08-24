export interface ExpectedE2eDatabaseIdentity {
  database: string;
  effectiveUser: string;
  serverAddress: '127.0.0.1' | 'localhost' | '::1';
  serverPort: number;
}

export interface E2eEnvironment {
  databaseUrl: string;
  databaseName: string;
  storageNamespace: string;
  resetOwnershipHash: string;
  databaseIdentity: ExpectedE2eDatabaseIdentity;
}

export interface E2eResetQuery {
  query(
    text: string,
    values?: readonly unknown[]
  ): Promise<{ rows: Array<Record<string, unknown>> }>;
}

export function readE2eEnvironment(): E2eEnvironment;

export function verifyE2eResetTarget(
  pool: E2eResetQuery,
  expectedIdentity: ExpectedE2eDatabaseIdentity,
  storageNamespace: string,
  resetOwnershipHash: string
): Promise<void>;

export function verifyCanonicalE2eSchemaState(
  pool: E2eResetQuery,
  expectedSchemaSha256: string
): Promise<void>;

export function checkE2eDatabase(): Promise<{
  databaseName: string;
  schemaSha256: string;
}>;

export function prepareE2eDatabase(): Promise<{
  databaseName: string;
  schemaSha256: string;
}>;
