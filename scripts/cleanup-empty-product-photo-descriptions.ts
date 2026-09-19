/** Remove only reviewed obsolete photograph references from six photograph-empty families. */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import pg from 'pg';
import { catalogTypeHash, parseCatalogTypeArgs, resolveCatalogTypeTarget } from './reclassify-atehna-catalog';
import { protectedHashes, readState, type PhotoState } from './replace-atehna-generated-images';

type Entry = { slug: string; before: string; after: string; removedText: string };
const materialText = ' Fotografije prikazujejo material; več plošč na fotografiji ne pomeni kompleta.';
const allowed: Record<string, string> = {
  'aluminijasta-plosca': materialText, 'bakrena-plosca': materialText,
  'pocinkana-plocevina': materialText, 'medeninasta-plosca': materialText,
  'seleshamer': '',
  'zlatarske-skarje-za-plocevino': '<p>Fotografija prikazuje posamezne škarje. Stojalo ni prikazano.</p>'
};
function ensure(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }
const same = (a: unknown, b: unknown) => catalogTypeHash({ value: a }) === catalogTypeHash({ value: b });
export function planEmptyPhotoDescriptionCleanup(state: PhotoState, entries: Entry[]) {
  ensure(entries.length === 6 && new Set(entries.map(entry => entry.slug)).size === 6, 'Exactly six audited families are required.');
  const expected = structuredClone(state);
  const updates: Array<{ id: unknown; slug: string; before: string; after: string }> = [];
  for (const entry of entries) {
    ensure(Object.hasOwn(allowed, entry.slug) && entry.removedText === allowed[entry.slug], 'Unreviewed copy change.');
    ensure(entry.after === (entry.removedText ? entry.before.replace(entry.removedText, '') : entry.before), 'Only the exact reviewed text may be removed.');
    if (entry.removedText) ensure(entry.before.split(entry.removedText).length === 2, 'Expected photo text must occur exactly once.');
    const rows = expected.items.filter(item => item.slug === entry.slug);
    ensure(rows.length === 1 && rows[0].status !== 'deleted', 'Missing/ambiguous family: ' + entry.slug);
    const item = rows[0];
    ensure(!state.media.some(media => String(media.item_id) === String(item.id) && media.media_kind === 'image' && media.role === 'gallery' && !media.hidden && !['dimension-diagram', 'dimension-overview'].includes(String(media.image_type))), 'Family still has a photograph: ' + entry.slug);
    ensure(item.description === entry.before || item.description === entry.after, 'Description changed since review: ' + entry.slug);
    if (item.description !== entry.after) {
      updates.push({ id: item.id, slug: entry.slug, before: entry.before, after: entry.after });
      item.description = entry.after;
    }
  }
  return { expected, updates };
}
export async function runEmptyPhotoDescriptionCleanup(args = process.argv.slice(2)) {
  const options = parseCatalogTypeArgs(args);
  const target = resolveCatalogTypeTarget(options.target, process.env.DATABASE_URL);
  const entries = JSON.parse(await readFile('data/catalog/empty-photo-description-cleanup-2026-09.json', 'utf8')).products as Entry[];
  const pool = new pg.Pool({ connectionString: target.connectionString, max: 1 });
  const client = await pool.connect();
  let committed = false;
  try {
    await client.query(options.apply ? 'begin isolation level serializable' : 'begin isolation level repeatable read read only');
    ensure((await client.query('select current_database() as name')).rows[0].name === target.database, 'Unexpected database.');
    if (options.apply) await client.query("select pg_advisory_xact_lock(hashtext('atehna-product-image-remediation-2026-09'))");
    const before = await readState(client, options.apply);
    const plan = planEmptyPhotoDescriptionCleanup(before, entries);
    const summary = { target: options.target, auditedFamilies: entries.length, changedDescriptions: plan.updates.length, changes: plan.updates.map(({ slug, before, after }) => ({ slug, before, after })) };
    if (!options.apply) { await client.query('rollback'); console.log(JSON.stringify(summary)); return summary; }
    const hashes = await protectedHashes(client);
    const directory = `tmp/catalog-refinements/empty-photo-copy-${options.target}-${new Date().toISOString().replace(/[:.]/g, '-')}`;
    await mkdir(directory, { recursive: true });
    const backup = Buffer.from(JSON.stringify({ before, hashes, summary, entries }, null, 2));
    await writeFile(`${directory}/before.json`, backup, { flag: 'wx' });
    ensure(backup.equals(await readFile(`${directory}/before.json`)), 'Backup verification failed.');
    for (const entry of plan.updates) {
      const result = await client.query('update catalog_items set description=$1,updated_at=now() where id=$2 and description=$3', [entry.after, entry.id, entry.before]);
      ensure(result.rowCount === 1, 'Expected-description update failed: ' + entry.slug);
    }
    const actual = await readState(client);
    for (const entry of plan.updates) {
      const actualItem = actual.items.find(item => String(item.id) === String(entry.id))!;
      const expectedItem = plan.expected.items.find(item => String(item.id) === String(entry.id))!;
      expectedItem.updated_at = actualItem.updated_at;
    }
    ensure(same(actual, plan.expected), 'Unexpected catalog changes outside the five descriptions.');
    ensure(same(hashes, await protectedHashes(client)), 'Protected metadata/commerce changed.');
    ensure(planEmptyPhotoDescriptionCleanup(actual, entries).updates.length === 0, 'Cleanup is not idempotent.');
    await client.query('commit'); committed = true;
    const result = { ...summary, backup: `${directory}/before.json`, unchangedNonCopyState: true, unchangedProtectedHashes: true, repeatMutations: 0 };
    await writeFile(`${directory}/result.json`, JSON.stringify(result, null, 2));
    console.log(JSON.stringify(result)); return result;
  } finally { if (!committed) await client.query('rollback').catch(() => undefined); client.release(); await pool.end(); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await runEmptyPhotoDescriptionCleanup();
