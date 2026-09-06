import 'server-only';
import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { unstable_cache, unstable_noStore as noStore, revalidatePath } from 'next/cache';
import { revalidateTag } from '@/shared/server/diagnostics/cache';
import { getPool } from '@/shared/server/db';
import { insertAuditEventForRequest } from '@/shared/server/audit';
import { LOGO_LIBRARY_SETTINGS_KEY, LOGO_PLACEMENT_IDS, type LogoLibrary, type LogoLibraryAction, type LogoSourceAsset, type LogoProject, type LogoPublishedRevision } from '@/shared/domain/logo/logoLibrary';
import { validateLogoProject, resizeLogoLayer } from '@/shared/domain/logo/logoProject';
import { SITE_LOGO_SETTINGS_KEY } from '@/shared/domain/logo/siteLogo';
import { SITE_NAVIGATION_SETTINGS_KEY } from '@/shared/domain/navigation/siteNavigation';
import { migrateLogoNavigationConstraints } from '@/shared/domain/logo/logoPlacement';
import { migrateLegacyLogoConfig } from '@/shared/server/logoLibraryMigration';
import { decodeLogoImport, renderLogoProject } from '@/shared/server/logoLibraryRender';
import { createLogoPublication, imageLogoProject, readLogoSource, storeLogoSource } from '@/shared/server/logoLibraryStorage';
import { applyLogoLibraryAction, LogoLibraryError, LOGO_LIBRARY_MAX_ASSETS, publishedLogoProjection, requireLogoRevision } from '@/shared/server/logoLibraryOperations';
import { commitLogoLibraryChange, readLogoLibraryRecord } from '@/shared/server/logoLibraryTransaction';

export const LOGO_LIBRARY_PUBLIC_CACHE_TAG = 'logo-library-published';
const MIGRATION_RECEIPT_KEY = 'website-logo-library-migration-receipt-v1';
let pendingInitialization: Promise<LogoLibrary> | null = null;
let lastInitializationFailureAt = 0;

async function initializeLogoLibrary(): Promise<LogoLibrary> {
  const pool = await getPool(); const client = await pool.connect();
  try {
    await client.query('begin');
    await client.query("select pg_advisory_xact_lock(hashtext('atehna-logo-library-v1'))");
    const existing = await client.query('select config_json from site_logo_settings where key = $1 for update', [LOGO_LIBRARY_SETTINGS_KEY]);
    if (existing.rows[0]) { await client.query('commit'); return readLogoLibraryRecord(existing.rows[0].config_json); }
    const legacy = await client.query('select config_json, updated_at from site_logo_settings where key = $1 for update', [SITE_LOGO_SETTINGS_KEY]);
    const navigation = await client.query('select config_json, updated_at from site_navigation_settings where key = $1 for update', [SITE_NAVIGATION_SETTINGS_KEY]);
    const previousLogo = legacy.rows[0]?.config_json ?? null;
    const previousNavigation = navigation.rows[0]?.config_json ?? null;
    const migrated = await migrateLegacyLogoConfig(previousLogo, { saveSource: storeLogoSource, publish: createLogoPublication });
    const library: LogoLibrary = { ...migrated, revision: 1 };
    const migratedNavigation = migrateLogoNavigationConstraints(previousNavigation, previousLogo);
    await client.query('insert into site_logo_settings (key, config_json) values ($1, $2::jsonb)', [
      MIGRATION_RECEIPT_KEY, JSON.stringify({ version: 1, createdAt: library.migratedAt, sourceLogo: previousLogo, sourceLogoUpdatedAt: legacy.rows[0]?.updated_at ?? null,
        sourceNavigation: previousNavigation, sourceNavigationUpdatedAt: navigation.rows[0]?.updated_at ?? null })
    ]);
    await client.query('insert into site_navigation_settings (key, config_json, updated_at) values ($1, $2::jsonb, now()) on conflict (key) do update set config_json = excluded.config_json, updated_at = now()', [SITE_NAVIGATION_SETTINGS_KEY, JSON.stringify(migratedNavigation)]);
    await client.query('insert into site_logo_settings (key, config_json) values ($1, $2::jsonb)', [LOGO_LIBRARY_SETTINGS_KEY, JSON.stringify(library)]);
    await client.query('commit');
    return library;
  } catch (error) {
    await client.query('rollback'); lastInitializationFailureAt = Date.now(); throw error;
  } finally { client.release(); }
}
async function readLogoLibrary(): Promise<LogoLibrary> {
  const pool = await getPool();
  const result = await pool.query('select config_json from site_logo_settings where key = $1', [LOGO_LIBRARY_SETTINGS_KEY]);
  if (result.rows[0]) return readLogoLibraryRecord(result.rows[0].config_json);
  if (Date.now() - lastInitializationFailureAt < 15_000) throw new LogoLibraryError('Prenos obstoječih logotipov še ni uspel. Obstoječe nastavitve so ohranjene; poskusite znova čez nekaj trenutkov.', 503);
  pendingInitialization ??= initializeLogoLibrary().finally(() => { pendingInitialization = null; });
  return pendingInitialization;
}
export async function ensureLogoLibrary(): Promise<LogoLibrary> { return readLogoLibrary(); }
export async function getLogoLibrary(): Promise<LogoLibrary> {
  noStore(); return readLogoLibrary();
}
const cachedPublished = unstable_cache(async () => publishedLogoProjection(await readLogoLibrary()), ['logo-library-published-v1'], { tags: [LOGO_LIBRARY_PUBLIC_CACHE_TAG] });
export async function getPublishedSiteLogos() { return cachedPublished(); }
export function revalidatePublishedLogos() {
  revalidateTag(LOGO_LIBRARY_PUBLIC_CACHE_TAG, { expire: 0 });
  revalidatePath('/', 'layout');
  for (const purpose of LOGO_PLACEMENT_IDS) revalidatePath('/api/site-logo/' + purpose);
  for (const path of ['/favicon.ico', '/icon', '/apple-icon', '/manifest.webmanifest']) revalidatePath(path);
}
function validateProject(input: unknown, assets: LogoSourceAsset[]): LogoProject {
  try { return validateLogoProject(input, assets); }
  catch (error) { throw new LogoLibraryError(error instanceof Error ? error.message : 'Projekt logotipa ni veljaven.'); }
}
async function auditLogoChange(request: Request | undefined, action: string, before: LogoLibrary, after: LogoLibrary, client: PoolClient) {
  if (!request) return;
  await insertAuditEventForRequest(request, {
    entityType: 'system', entityId: 'logo-library', entityLabel: 'Knjižnica logotipov', action: 'updated',
    summary: 'Knjižnica logotipov: ' + action,
    metadata: { area: 'logo_library', operation: action, previousRevision: before.revision, revision: after.revision, variantCount: after.variants.length }
  }, client);
}
export async function mutateLogoLibrary(input: Exclude<LogoLibraryAction, { action: 'preview' | 'export' }>, request?: Request): Promise<LogoLibrary> {
  const snapshot = await getLogoLibrary();
  requireLogoRevision(snapshot.revision, input.expectedRevision);
  let publication: LogoPublishedRevision | undefined;
  if (input.action === 'publish') {
    const variant = snapshot.variants.find(value => value.id === input.variantId);
    if (!variant) throw new LogoLibraryError('Različica ne obstaja.', 404);
    requireLogoRevision(variant.draftRevision, input.expectedDraftRevision);
    validateProject(variant.draft, snapshot.assets);
    publication = await createLogoPublication(variant.draft, snapshot.assets);
  } else if (input.action === 'save') validateProject(input.project, snapshot.assets);
  else if (input.action === 'create' && input.project) validateProject(input.project, snapshot.assets);
  const pool = await getPool(); const client = await pool.connect(); let publicChanged = false;
  try {
    const library = await commitLogoLibraryChange(client, input.expectedRevision, current => {
      const result = applyLogoLibraryAction(current, input, { id: randomUUID(), now: new Date().toISOString(), publication });
      publicChanged = result.publicChanged; return result.library;
    }, (before, after) => auditLogoChange(request, input.action, before, after, client));
    if (publicChanged) revalidatePublishedLogos();
    return library;
  } finally { client.release(); }
}
export async function uploadLogoLibrarySource(name: string, bytes: Uint8Array, mimeType: LogoSourceAsset['mimeType'], expectedRevision: number, request?: Request) {
  const snapshot = await getLogoLibrary(); requireLogoRevision(snapshot.revision, expectedRevision);
  if (snapshot.assets.length >= LOGO_LIBRARY_MAX_ASSETS) throw new LogoLibraryError('Knjižnica že vsebuje največje dovoljeno število izvornih slik.');
  let decoded: Awaited<ReturnType<typeof decodeLogoImport>>;
  try { decoded = await decodeLogoImport(Buffer.from(bytes), mimeType); }
  catch (error) { throw new LogoLibraryError(error instanceof Error ? error.message : 'Slike ni mogoče odpreti.'); }
  const asset = await storeLogoSource(name, bytes, mimeType);
  const project = structuredClone(decoded.project ?? imageLogoProject(asset));
  const scale = Math.min(1, Math.sqrt(4_000_000 / (project.canvas.width * project.canvas.height)));
  if (scale < 1) {
    project.canvas.width = Math.max(1, Math.floor(project.canvas.width * scale)); project.canvas.height = Math.max(1, Math.floor(project.canvas.height * scale));
    for (const layer of project.layers) { layer.x *= scale; layer.y *= scale; resizeLogoLayer(layer, layer.width * scale, layer.height * scale); }
    asset.warnings.push('Platno je zmanjšano za varen izvoz 2×; izvirna slika je ohranjena v polni ločljivosti.');
  }
  validateProject(project, [...snapshot.assets, asset]);
  const pool = await getPool(); const client = await pool.connect();
  try {
    const library = await commitLogoLibraryChange(client, expectedRevision, current => ({ ...current, assets: [...current.assets, asset], revision: current.revision + 1 }),
      (before, after) => auditLogoChange(request, 'upload', before, after, client));
    return { library, asset, project };
  } finally { client.release(); }
}
export async function previewLogoProject(input: unknown) {
  const library = await getLogoLibrary();
  const project = validateProject(input, library.assets);
  return renderLogoProject(project, library.assets, readLogoSource);
}
