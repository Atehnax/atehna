export const DATABASE_URL_ENV_KEYS = Object.freeze([
  'DATABASE_URL',
  'POSTGRES_URL',
  'POSTGRES_PRISMA_URL',
  'SUPABASE_DB_URL'
]);

const DATABASE_RUNTIME_ENV_KEYS = Object.freeze({
  poolMax: 'ATEHNA_DB_POOL_MAX',
  connectionTimeoutMillis: 'ATEHNA_DB_CONNECTION_TIMEOUT_MS',
  idleTimeoutMillis: 'ATEHNA_DB_IDLE_TIMEOUT_MS',
  statementTimeoutMillis: 'ATEHNA_DB_STATEMENT_TIMEOUT_MS',
  lockTimeoutMillis: 'ATEHNA_DB_LOCK_TIMEOUT_MS'
});

const DATABASE_RUNTIME_DEFAULTS = Object.freeze({
  poolMax: 10,
  connectionTimeoutMillis: 0,
  idleTimeoutMillis: 10_000,
  statementTimeoutMillis: 0,
  lockTimeoutMillis: 0
});

function configuredDatabaseUrls(environment) {
  return DATABASE_URL_ENV_KEYS.flatMap((key) => {
    const value = environment[key];
    return value && value.trim() ? [{ key, value }] : [];
  });
}

export function resolveDatabaseUrl(environment) {
  return configuredDatabaseUrls(environment)[0]?.value ?? null;
}

export function inspectDatabaseUrlEnvironment(environment) {
  const configured = configuredDatabaseUrls(environment);
  const distinctValues = new Set(configured.map(({ value }) => value.trim()));
  return {
    selectedKey: configured[0]?.key ?? null,
    configuredKeys: configured.map(({ key }) => key),
    hasConflictingValues: distinctValues.size > 1
  };
}

export function resolvePostgresSslMode(environment) {
  return environment.PGSSLMODE?.trim().toLowerCase() ?? null;
}

export function resolveDatabaseSslConfig(databaseUrl, environment) {
  const sslModeFromUrl = new URL(databaseUrl)
    .searchParams.get('sslmode')?.toLowerCase() ?? null;
  const mode = sslModeFromUrl ?? resolvePostgresSslMode(environment);

  if (mode === 'disable' || mode === 'allow' || mode === 'prefer') return false;
  if (mode === 'verify-ca' || mode === 'verify-full') {
    return { rejectUnauthorized: true };
  }
  if (databaseUrl.includes('localhost') || databaseUrl.includes('127.0.0.1')) {
    return false;
  }
  return { rejectUnauthorized: false };
}

function throwInvalidRuntimeInteger(key, range) {
  const zeroOption = range.allowZero ? '0 (disabled) or ' : '';
  throw new Error(
    key + ' must be ' + zeroOption + 'a whole number between '
      + range.minimum + ' and ' + range.maximum
  );
}

function parseRuntimeInteger(environment, key, fallback, range) {
  const rawValue = environment[key];
  if (rawValue == null || rawValue.trim() === '') return fallback;

  const normalizedValue = rawValue.trim();
  if (!/^\d+$/u.test(normalizedValue)) {
    throwInvalidRuntimeInteger(key, range);
  }

  const value = Number(normalizedValue);
  if (!Number.isSafeInteger(value)) {
    throwInvalidRuntimeInteger(key, range);
  }

  const isAllowedZero = range.allowZero === true && value === 0;
  if (!isAllowedZero && (value < range.minimum || value > range.maximum)) {
    throwInvalidRuntimeInteger(key, range);
  }
  return value;
}

export function resolveDatabasePoolRuntimeConfig(environment) {
  return {
    poolMax: parseRuntimeInteger(
      environment,
      DATABASE_RUNTIME_ENV_KEYS.poolMax,
      DATABASE_RUNTIME_DEFAULTS.poolMax,
      { minimum: 1, maximum: 50 }
    ),
    connectionTimeoutMillis: parseRuntimeInteger(
      environment,
      DATABASE_RUNTIME_ENV_KEYS.connectionTimeoutMillis,
      DATABASE_RUNTIME_DEFAULTS.connectionTimeoutMillis,
      { minimum: 100, maximum: 120_000, allowZero: true }
    ),
    idleTimeoutMillis: parseRuntimeInteger(
      environment,
      DATABASE_RUNTIME_ENV_KEYS.idleTimeoutMillis,
      DATABASE_RUNTIME_DEFAULTS.idleTimeoutMillis,
      { minimum: 1_000, maximum: 600_000, allowZero: true }
    ),
    statementTimeoutMillis: parseRuntimeInteger(
      environment,
      DATABASE_RUNTIME_ENV_KEYS.statementTimeoutMillis,
      DATABASE_RUNTIME_DEFAULTS.statementTimeoutMillis,
      { minimum: 1_000, maximum: 900_000, allowZero: true }
    ),
    lockTimeoutMillis: parseRuntimeInteger(
      environment,
      DATABASE_RUNTIME_ENV_KEYS.lockTimeoutMillis,
      DATABASE_RUNTIME_DEFAULTS.lockTimeoutMillis,
      { minimum: 100, maximum: 120_000, allowZero: true }
    )
  };
}

function isEnabled(value) {
  return value?.trim().toLowerCase() === 'true' || value?.trim() === '1';
}

export function resolveQuoteFeatureFlags(environment) {
  return {
    admin: isEnabled(environment.QUOTE_ADMIN_ENABLED),
    publicRequests: isEnabled(environment.QUOTE_PUBLIC_REQUESTS_ENABLED),
    onlineAcceptance: isEnabled(environment.QUOTE_ONLINE_ACCEPTANCE_ENABLED),
    emailDelivery: isEnabled(environment.QUOTE_EMAIL_DELIVERY_ENABLED)
  };
}
