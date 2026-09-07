import type { LogoLibrary } from '@/shared/domain/logo/logoLibrary';
import { LOGO_LIBRARY_SETTINGS_KEY } from '@/shared/domain/logo/logoLibrary';
import { LogoLibraryError, LOGO_LIBRARY_MAX_JSON_BYTES, requireLogoRevision } from './logoLibraryOperations';

export type LogoLibraryTransactionClient = {
  query: (sql: string, values?: unknown[]) => Promise<{ rows: Array<{ config_json?: unknown }> }>;
};
export function readLogoLibraryRecord(input: unknown): LogoLibrary {
  const value = input as LogoLibrary | null;
  if (!value || value.version !== 1 || !Number.isSafeInteger(value.revision) || value.revision < 1 ||
    !Array.isArray(value.assets) || !Array.isArray(value.variants) || !value.placements ||
    typeof value.placements !== 'object') throw new Error('Stored logo library contract is invalid.');
  return value;
}
/** Row-lock, compare-and-swap and audit share one transaction. A rejected mutation never writes. */
export async function commitLogoLibraryChange(
  client: LogoLibraryTransactionClient, expectedRevision: number,
  change: (current: LogoLibrary) => LogoLibrary,
  audit: (before: LogoLibrary, after: LogoLibrary) => Promise<void>
): Promise<LogoLibrary> {
  await client.query('begin');
  try {
    const rows = await client.query('select config_json from site_logo_settings where key = $1 for update', [LOGO_LIBRARY_SETTINGS_KEY]);
    if (!rows.rows[0]) throw new LogoLibraryError('Knjižnica še ni pripravljena. Osvežite stran.', 409);
    const before = readLogoLibraryRecord(rows.rows[0].config_json);
    requireLogoRevision(before.revision, expectedRevision);
    const after = change(structuredClone(before));
    if (after.revision !== before.revision + 1) throw new Error('Logo mutation must advance the library revision exactly once.');
    const serialized = JSON.stringify(after);
    if (Buffer.byteLength(serialized) > LOGO_LIBRARY_MAX_JSON_BYTES) throw new LogoLibraryError('Knjižnica presega dovoljeno velikost. Odstranite neuporabljene različice.', 413);
    await client.query('update site_logo_settings set config_json = $2::jsonb, updated_at = now() where key = $1', [LOGO_LIBRARY_SETTINGS_KEY, serialized]);
    await audit(before, after);
    await client.query('commit');
    return after;
  } catch (error) {
    await client.query('rollback'); throw error;
  }
}

/** Initialize only fresh settings; preserved libraries never pass through a converter. */
export async function initializeLogoLibraryTransaction(
  client: LogoLibraryTransactionClient,
  createLibrary: () => Promise<LogoLibrary>
): Promise<LogoLibrary> {
  await client.query('begin');
  try {
    await client.query("select pg_advisory_xact_lock(hashtext('atehna-logo-library-v1'))");
    const current = await client.query('select config_json from site_logo_settings where key = $1 for update', [LOGO_LIBRARY_SETTINGS_KEY]);
    if (current.rows[0]) {
      const library = readLogoLibraryRecord(current.rows[0].config_json);
      await client.query('commit');
      return library;
    }
    const previous = await client.query('select config_json from site_logo_settings where key = $1 for update', ['website-site-logo']);
    if (previous.rows.length) {
      throw new LogoLibraryError('Obstoječe nastavitve logotipa zahtevajo ohranjeno knjižnico logotipov. Pred zagonom obnovite pripravljeno knjižnico; stare nastavitve niso spremenjene.', 503);
    }
    const library = readLogoLibraryRecord(await createLibrary());
    await client.query('insert into site_logo_settings (key, config_json) values ($1, $2::jsonb)', [LOGO_LIBRARY_SETTINGS_KEY, JSON.stringify(library)]);
    await client.query('commit');
    return library;
  } catch (error) {
    await client.query('rollback');
    throw error;
  }
}
