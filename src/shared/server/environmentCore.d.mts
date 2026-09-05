export type EnvironmentSource = Readonly<Record<string, string | undefined>>;

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
}>;

export function resolveDatabaseUrl(
  environment: EnvironmentSource
): string | null;
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
