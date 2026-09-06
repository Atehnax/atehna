import assert from 'node:assert/strict';
import test from 'node:test';
import { blankLogoProject, defaultLogoAssignments, type LogoLibrary, type LogoPublishedRevision } from '@/shared/domain/logo/logoLibrary';
import { applyLogoLibraryAction, publishedLogoProjection } from '@/shared/server/logoLibraryOperations';
import { commitLogoLibraryChange, type LogoLibraryTransactionClient } from '@/shared/server/logoLibraryTransaction';

const context = { id: 'variant-two', now: '2026-09-06T00:00:00Z' };
function fixture(): LogoLibrary {
  const project = blankLogoProject();
  return { version: 1, revision: 1, assets: [], variants: [{ id: 'variant-one', name: 'Izvirnik', draft: project, draftRevision: 1, updatedAt: context.now, published: null, history: [] }], placements: defaultLogoAssignments(), migratedAt: context.now };
}
function publication(project = blankLogoProject(), id = 'revision-one'): LogoPublishedRevision {
  const asset = { url: 'https://example.public.blob.vercel-storage.com/' + id + '.png', pathname: id + '.png', width: 640, height: 240, mimeType: 'image/png' as const };
  return { id, createdAt: context.now, project: structuredClone(project), png: asset, png2x: { ...asset, width: 1280, height: 480 }, svg: { ...asset, url: asset.url + '.svg', mimeType: 'image/svg+xml' }, bounds: { x: 0, y: 0, width: 640, height: 240 } };
}
test('draft save and duplicate retain independent editable projects without publishing', () => {
  const original = fixture();
  const project = { ...blankLogoProject(), canvas: { width: 720, height: 280 } };
  const saved = applyLogoLibraryAction(original, { action: 'save', variantId: 'variant-one', name: 'Osnutek', project, expectedRevision: 1, expectedDraftRevision: 1 }, context);
  assert.equal(saved.publicChanged, false);
  assert.deepEqual(saved.library.variants[0].draft, project);
  assert.equal(saved.library.variants[0].draftRevision, 2);
  assert.equal(saved.library.variants[0].published, null);
  assert.equal(original.variants[0].draft.canvas.width, 640);
  const copy = applyLogoLibraryAction(saved.library, { action: 'duplicate', variantId: 'variant-one', name: 'Kopija', expectedRevision: 2 }, context).library;
  copy.variants[1].draft.canvas.width = 300;
  assert.equal(copy.variants[0].draft.canvas.width, 720);
  assert.equal(copy.variants[1].published, null);
  assert.deepEqual(copy.variants[1].history, []);
});
test('both library and draft revision reject stale saves', () => {
  const library = fixture();
  assert.throws(() => applyLogoLibraryAction(library, { action: 'rename', variantId: 'variant-one', name: 'X', expectedRevision: 0 }, context), /Osvežite knjižnico/u);
  assert.throws(() => applyLogoLibraryAction(library, { action: 'save', variantId: 'variant-one', name: 'X', project: blankLogoProject(), expectedRevision: 1, expectedDraftRevision: 0 }, context), /Osvežite knjižnico/u);
  assert.equal(library.revision, 1);
});
test('publication is refused unless complete outputs belong to the exact current draft', () => {
  const library = fixture();
  const input = { action: 'publish' as const, variantId: 'variant-one', expectedRevision: 1, expectedDraftRevision: 1 };
  assert.throws(() => applyLogoLibraryAction(library, input, context), /Objava se ne ujema/u);
  assert.throws(() => applyLogoLibraryAction(library, input, { ...context, publication: publication({ ...blankLogoProject(), canvas: { width: 10, height: 10 } }) }), /Objava se ne ujema/u);
  assert.equal(library.variants[0].published, null);
  const result = applyLogoLibraryAction(library, input, { ...context, publication: publication() });
  assert.equal(result.publicChanged, true);
  assert.equal(result.library.variants[0].published?.id, 'revision-one');
});
test('assignments require published variants and deleting a shared default is blocked', () => {
  let library = fixture();
  assert.throws(() => applyLogoLibraryAction(library, { action: 'assign', expectedRevision: 1, placements: { standalone: { variantId: 'variant-one', fallback: 'none' } } }, context), /le objavljeno/u);
  library.variants[0].published = publication();
  library = applyLogoLibraryAction(library, { action: 'assign', expectedRevision: 1, placements: {
    standalone: { variantId: 'variant-one', fallback: 'none' }, 'header-mobile': { variantId: null, fallback: 'default' }, 'footer-desktop': { variantId: 'variant-one', fallback: 'none' }
  } }, context).library;
  assert.equal(publishedLogoProjection(library).placements['header-mobile']?.variantId, 'variant-one');
  assert.throws(() => applyLogoLibraryAction(library, { action: 'delete', expectedRevision: 2, variantId: 'variant-one' }, context), /v uporabi/u);
  library = applyLogoLibraryAction(library, { action: 'assign', expectedRevision: 2, placements: {
    standalone: { variantId: null, fallback: 'original' }, 'footer-desktop': { variantId: null, fallback: 'original' }
  } }, context).library;
  assert.equal(applyLogoLibraryAction(library, { action: 'delete', expectedRevision: 3, variantId: 'variant-one' }, context).library.variants.length, 0);
});
test('public projection omits private drafts, assets, source paths and revision history', () => {
  const library = fixture(); library.variants[0].published = publication();
  library.placements.standalone = { variantId: 'variant-one', fallback: 'none' };
  library.placements['header-mobile'] = { variantId: null, fallback: 'none' };
  library.variants[0].history.push(publication(blankLogoProject(), 'private-history'));
  library.variants[0].draft.canvas.width = 780;
  const result = publishedLogoProjection(library); const serialized = JSON.stringify(result);
  assert.equal(result.placements.standalone?.width, 640);
  assert.equal(result.placements['header-mobile'], null);
  assert.doesNotMatch(serialized, /private-history|draft|layers|pathname|assets/u);
});
test('restoring previous publication preserves a path back to the current one and restores its project', () => {
  const library = fixture();
  library.variants[0].published = publication(blankLogoProject(), 'current');
  library.variants[0].history = [publication({ ...blankLogoProject(), canvas: { width: 320, height: 120 } }, 'previous')];
  const result = applyLogoLibraryAction(library, { action: 'restore', variantId: 'variant-one', revisionId: 'previous', expectedRevision: 1 }, context);
  assert.equal(result.library.variants[0].published?.id, 'previous');
  assert.equal(result.library.variants[0].history[0].id, 'current');
  assert.equal(result.library.variants[0].draft.canvas.width, 320);
  assert.equal(result.publicChanged, true);
});
class MemoryTransaction implements LogoLibraryTransactionClient {
  committed = fixture(); pending = this.committed; log: string[] = [];
  async query(sql: string, values?: unknown[]) {
    this.log.push(sql);
    if (sql === 'begin') this.pending = structuredClone(this.committed);
    if (sql.startsWith('select')) return { rows: [{ config_json: structuredClone(this.pending) }] };
    if (sql.startsWith('update')) this.pending = JSON.parse(String(values?.[1])) as LogoLibrary;
    if (sql === 'commit') this.committed = structuredClone(this.pending);
    if (sql === 'rollback') this.pending = structuredClone(this.committed);
    return { rows: [] };
  }
}
test('row-lock transaction commits library and audit together; a second stale writer cannot overwrite', async () => {
  const db = new MemoryTransaction(); let audited = false;
  const change = (current: LogoLibrary) => applyLogoLibraryAction(current, { action: 'rename', variantId: 'variant-one', name: 'Shranjeno', expectedRevision: 1 }, context).library;
  await commitLogoLibraryChange(db, 1, change, async () => { audited = true; });
  assert.equal(audited, true); assert.equal(db.committed.revision, 2);
  assert.ok(db.log.some(sql => sql.endsWith('for update')));
  await assert.rejects(commitLogoLibraryChange(db, 1, change, async () => {}), /Osvežite knjižnico/u);
  assert.equal(db.committed.variants[0].name, 'Shranjeno'); assert.equal(db.log.at(-1), 'rollback');
});
test('audit failure rolls back the pending publication pointer and history', async () => {
  const db = new MemoryTransaction();
  await assert.rejects(commitLogoLibraryChange(db, 1, current => applyLogoLibraryAction(current, {
    action: 'publish', variantId: 'variant-one', expectedRevision: 1, expectedDraftRevision: 1
  }, { ...context, publication: publication() }).library, async () => { throw new Error('Audit failure'); }), /Audit failure/u);
  assert.equal(db.committed.revision, 1); assert.equal(db.committed.variants[0].published, null);
  assert.deepEqual(db.committed.variants[0].history, []); assert.equal(db.log.at(-1), 'rollback');
});

test('oversized library is rejected before database or audit write', async () => {
  const client = new MemoryTransaction();
  let audits = 0;
  await assert.rejects(() => commitLogoLibraryChange(client, 1, current => {
    current.variants[0].name = 'x'.repeat(3_500_000);
    return { ...current, revision: 2 };
  }, async () => { audits += 1; }), /dovoljeno velikost/u);
  assert.equal(client.committed.revision, 1);
  assert.equal(audits, 0);
});
