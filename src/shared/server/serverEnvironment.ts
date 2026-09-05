import 'server-only';
import {
  resolveDatabasePoolRuntimeConfig as resolveDatabasePoolRuntimeConfigCore,
  resolveDatabaseSslConfig as resolveDatabaseSslConfigCore,
  resolveDatabaseUrl as resolveDatabaseUrlCore,
  resolvePostgresSslMode as resolvePostgresSslModeCore,
  resolveQuoteFeatureFlags as resolveQuoteFeatureFlagsCore
} from './environmentCore.mjs';
import type {
  DatabasePoolRuntimeConfig,
  DatabaseSslConfig,
  EnvironmentSource,
  QuoteFeatureFlags
} from './environmentCore.mjs';

export type {
  DatabasePoolRuntimeConfig,
  DatabaseSslConfig,
  EnvironmentSource,
  QuoteFeatureFlags
} from './environmentCore.mjs';

export function resolveDatabaseUrl(
  environment: EnvironmentSource = process.env
): string | null {
  return resolveDatabaseUrlCore(environment);
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
