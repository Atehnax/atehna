import 'server-only';
import {
  DATABASE_URL_ENV_KEYS,
  inspectDatabaseUrlEnvironment as inspectDatabaseUrlEnvironmentCore,
  resolveDatabasePoolRuntimeConfig as resolveDatabasePoolRuntimeConfigCore,
  resolveDatabaseSslConfig as resolveDatabaseSslConfigCore,
  resolveDatabaseUrl as resolveDatabaseUrlCore,
  resolvePostgresSslMode as resolvePostgresSslModeCore,
  resolveQuoteFeatureFlags as resolveQuoteFeatureFlagsCore
} from './environmentCore.mjs';
import type {
  DatabasePoolRuntimeConfig,
  DatabaseSslConfig,
  DatabaseUrlEnvironmentMetadata,
  EnvironmentSource,
  QuoteFeatureFlags
} from './environmentCore.mjs';

export { DATABASE_URL_ENV_KEYS };
export type {
  DatabasePoolRuntimeConfig,
  DatabaseSslConfig,
  DatabaseUrlEnvironmentKey,
  DatabaseUrlEnvironmentMetadata,
  EnvironmentSource,
  QuoteFeatureFlags
} from './environmentCore.mjs';

export function resolveDatabaseUrl(
  environment: EnvironmentSource = process.env
): string | null {
  return resolveDatabaseUrlCore(environment);
}

export function inspectDatabaseUrlEnvironment(
  environment: EnvironmentSource = process.env
): DatabaseUrlEnvironmentMetadata {
  return inspectDatabaseUrlEnvironmentCore(environment);
}

export function resolvePostgresSslMode(
  environment: EnvironmentSource = process.env
): string | null {
  return resolvePostgresSslModeCore(environment);
}

export function resolveDatabaseSslConfig(
  databaseUrl: string,
  environment: EnvironmentSource = process.env
): DatabaseSslConfig {
  return resolveDatabaseSslConfigCore(databaseUrl, environment);
}

export function resolveDatabasePoolRuntimeConfig(
  environment: EnvironmentSource = process.env
): DatabasePoolRuntimeConfig {
  return resolveDatabasePoolRuntimeConfigCore(environment);
}

export function resolveQuoteFeatureFlags(
  environment: EnvironmentSource = process.env
): QuoteFeatureFlags {
  return resolveQuoteFeatureFlagsCore(environment);
}
