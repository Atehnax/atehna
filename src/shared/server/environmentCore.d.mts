export type EnvironmentSource = Readonly<Record<string, string | undefined>>;

export declare const DATABASE_URL_ENV_KEYS: readonly [
  'DATABASE_URL',
  'POSTGRES_URL',
  'POSTGRES_PRISMA_URL',
  'SUPABASE_DB_URL'
];

export type DatabaseUrlEnvironmentKey =
  (typeof DATABASE_URL_ENV_KEYS)[number];

export type DatabaseUrlEnvironmentMetadata = Readonly<{
  selectedKey: DatabaseUrlEnvironmentKey | null;
  configuredKeys: readonly DatabaseUrlEnvironmentKey[];
  hasConflictingValues: boolean;
}>;

export type DatabaseSslConfig = false | Readonly<{
  rejectUnauthorized: boolean;
}>;

export type DatabasePoolRuntimeConfig = Readonly<{
  poolMax: number;
  connectionTimeoutMillis: number;
  idleTimeoutMillis: number;
  statementTimeoutMillis: number;
  lockTimeoutMillis: number;
}>;

export type QuoteFeatureFlags = Readonly<{
  admin: boolean;
  publicRequests: boolean;
  onlineAcceptance: boolean;
  emailDelivery: boolean;
}>;

export function resolveDatabaseUrl(
  environment: EnvironmentSource
): string | null;
export function inspectDatabaseUrlEnvironment(
  environment: EnvironmentSource
): DatabaseUrlEnvironmentMetadata;
export function resolvePostgresSslMode(
  environment: EnvironmentSource
): string | null;
export function resolveDatabaseSslConfig(
  databaseUrl: string,
  environment: EnvironmentSource
): DatabaseSslConfig;
export function resolveDatabasePoolRuntimeConfig(
  environment: EnvironmentSource
): DatabasePoolRuntimeConfig;
export function resolveQuoteFeatureFlags(
  environment: EnvironmentSource
): QuoteFeatureFlags;
