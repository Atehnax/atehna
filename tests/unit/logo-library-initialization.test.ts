import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import test from 'node:test';
import { defaultLogoAssignments, LOGO_LIBRARY_SETTINGS_KEY, type LogoLibrary } from '@/shared/domain/logo/logoLibrary';
import { initializeLogoLibraryTransaction, type LogoLibraryTransactionClient } from '@/shared/server/logoLibraryTransaction';

const fixture = (): LogoLibrary => ({ version: 1, revision: 7, assets: [], variants: [], placements: defaultLogoAssignments(), migratedAt: '2026-01-01T00:00:00Z' });
class InitializationTransaction implements LogoLibraryTransactionClient {
  committed: Map<string, unknown>; pending: Map<string, unknown>; log: string[] = [];
  failCommit = false;
  constructor(records: Array<[string, unknown]> = []) { this.committed = new Map(records); this.pending = structuredClone(this.committed); }
  async query(sql: string, values?: unknown[]) {
    this.log.push(sql);
    if (sql === 'begin') this.pending = structuredClone(this.committed);
    if (sql.startsWith('select config_json')) {
      const key = String(values?.[0]);
      return { rows: this.pending.has(key) ? [{ config_json: structuredClone(this.pending.get(key)) }] : [] };
    }
    if (sql.startsWith('insert into site_logo_settings')) this.pending.set(String(values?.[0]), JSON.parse(String(values?.[1])));
    if (sql === 'commit') { if (this.failCommit) throw new Error('Commit failed'); this.committed = structuredClone(this.pending); }
    if (sql === 'rollback') this.pending = structuredClone(this.committed);
    return { rows: [] };
  }
}

test('an existing library is unchanged and never invokes fresh initialization or old settings', async () => {
  const library = fixture(), old = { masters: ['preserved'], placements: { 'header-desktop': { displayHeightPx: 42 } } };
  const db = new InitializationTransaction([[LOGO_LIBRARY_SETTINGS_KEY, library], ['website-site-logo', old]]);
  let called = false;
  const result = await initializeLogoLibraryTransaction(db, async () => { called = true; return fixture(); });
  assert.deepEqual(result, library);
  assert.equal(called, false);
  assert.deepEqual([...db.committed], [[LOGO_LIBRARY_SETTINGS_KEY, library], ['website-site-logo', old]]);
  assert.equal(db.log.filter(sql => sql.startsWith('select config_json')).length, 1);
  assert.equal(db.log.some(sql => /^(insert|update|delete)/u.test(sql)), false);
});

test('old settings without a library fail before uploads or writes, including empty old records', async () => {
  for (const previous of [{ masters: ['preserve'], placements: { 'footer-mobile': { enabled: false } } }, {}, null]) {
    const db = new InitializationTransaction([['website-site-logo', previous]]); let called = false;
    await assert.rejects(initializeLogoLibraryTransaction(db, async () => { called = true; return fixture(); }), /Pred zagonom obnovite pripravljeno knjižnico/u);
    assert.equal(called, false);
    assert.deepEqual([...db.committed], [['website-site-logo', previous]]);
    assert.equal(db.log.some(sql => /^(insert|update|delete)/u.test(sql)), false);
    assert.equal(db.log.at(-1), 'rollback');
  }
});

test('a fresh settings store publishes once under the initialization lock and leaves other settings alone', async () => {
  const receipt = { recovery: 'preserved' }, db = new InitializationTransaction([['unrelated-setting', receipt]]);
  const initial = { ...fixture(), revision: 1 }; let calls = 0;
  assert.deepEqual(await initializeLogoLibraryTransaction(db, async () => { calls++; return initial; }), initial);
  assert.equal(calls, 1);
  assert.deepEqual(db.committed.get(LOGO_LIBRARY_SETTINGS_KEY), initial);
  assert.deepEqual(db.committed.get('unrelated-setting'), receipt);
  assert.ok(db.log.some(sql => sql.includes('pg_advisory_xact_lock')));
  assert.equal(db.log.filter(sql => sql.startsWith('insert')).length, 1);
  assert.equal(db.log.some(sql => sql.includes('site_navigation_settings')), false);
});

test('failed source/publication preparation cannot install a partial library', async () => {
  const db = new InitializationTransaction();
  await assert.rejects(initializeLogoLibraryTransaction(db, async () => { throw new Error('Publication failed'); }), /Publication failed/u);
  assert.equal(db.committed.size, 0);
  assert.equal(db.log.some(sql => sql.startsWith('insert')), false);
  assert.equal(db.log.at(-1), 'rollback');
});

test('a failed commit rolls back the initial library pointer', async () => {
  const db = new InitializationTransaction(); db.failCommit = true;
  await assert.rejects(initializeLogoLibraryTransaction(db, async () => fixture()), /Commit failed/u);
  assert.equal(db.committed.size, 0);
  assert.equal(db.pending.size, 0);
  assert.equal(db.log.at(-1), 'rollback');
});

test('fresh default projects retain the established original and PDF pixels and placement fallbacks', () => {
  const result = JSON.parse(execFileSync(process.execPath, ['--conditions=react-server', '--import', 'tsx', '--input-type=module', '--eval', `
    import assert from 'node:assert/strict';
    import { createHash } from 'node:crypto';
    import sharp from 'sharp';
    import { createInitialLogoLibrary } from './src/shared/server/logoLibraryDefaults.ts';
    import { decodeLogoImport, renderLogoProject } from './src/shared/server/logoLibraryRender.ts';
    const sources = new Map(), pixels = [];
    const library = await createInitialLogoLibrary({
      saveSource: async (name, bytes, mimeType) => { const decoded = await decodeLogoImport(bytes, mimeType); const id = createHash('sha256').update(bytes).digest('hex'); sources.set(id, Buffer.from(bytes)); return { id, name, url: '/private/' + id, pathname: id, mimeType, width: decoded.width, height: decoded.height, bytes: bytes.length, bounds: decoded.bounds, warnings: decoded.warnings }; },
      publish: async (project, assets) => { const rendered = await renderLogoProject(project, assets, async asset => sources.get(asset.id)); const raw = await sharp(rendered.png).raw().toBuffer(); pixels.push(createHash('sha256').update(raw).digest('hex')); const id = 'publication-' + pixels.length, png = { url: '/published/' + id, pathname: id, width: rendered.width, height: rendered.height, mimeType: 'image/png' }; return { id, createdAt: 'time', project, png, png2x: { ...png, width: png.width * 2, height: png.height * 2 }, svg: { ...png, mimeType: 'image/svg+xml' }, bounds: rendered.bounds }; }
    });
    assert.equal(library.revision, 1); assert.equal(library.variants.length, 2); assert.equal(library.assets.length, 2);
    assert.deepEqual(library.variants.map(value => [value.name, value.draft.canvas.width, value.draft.canvas.height, value.draft.layers[0].name]), [['Privzeti logotip', 1873, 840, 'Ohranjen videz logotipa'], ['Dokumenti PDF', 1892, 600, 'Ohranjen videz logotipa']]);
    for (const [purpose, assignment] of Object.entries(library.placements)) {
      if (purpose === 'standalone' || purpose === 'pdf-document') { assert.equal(assignment.fallback, 'none'); assert.equal(assignment.variantId, library.variants[purpose === 'standalone' ? 0 : 1].id); }
      else assert.deepEqual(assignment, { variantId: null, fallback: purpose.startsWith('footer-') ? 'original' : 'brand' });
    }
    console.log(JSON.stringify({ sourceHashes: [...sources.keys()], pixels }));
  `], { cwd: process.cwd(), encoding: 'utf8', timeout: 60000 })) as { sourceHashes: string[]; pixels: string[] };
  assert.deepEqual(result.sourceHashes, ['5f1292f6bb31a320a57f063058fe45ee8dcf7f9671decb06368b944afc3068c1', '3a3a626385d52f177782cfcb42e23a3edf6809b22f737a25e1a350d90a666e67']);
  assert.deepEqual(result.pixels, ['11ef9bbe449f8c3af610985cc76ffd79fd8a8e86ab8cf04332199232dbe8c2a5', '9f2a4f4671c2f9e3eb96e4a5887c739dc0655644349d3b1650ae74fb3e4d312d']);
});
