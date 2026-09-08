import assert from 'node:assert/strict';
import test from 'node:test';
import { applyApproved, canonical, hash, matchesOutboxTarget, objectId, reviewObjects, safeReview, selectCandidates, validateConfig, validateManifest, type ApplyIO, type Config, type Event, type Manifest, type Metadata, type ObjectInfo, type PreparedObject, type Scan } from '../../scripts/storage/lifecycle';
import { databaseOptions, patterns, referenceSql } from '../../scripts/storage/postgres';
const config: Config = { version: 1, connectionEnv: 'STORAGE_DATABASE_URL', expectedHost: 'db.example.test', expectedPort: 5432, databases: ['production', 'preview'], minimumAgeHours: 24, stores: [{ id: 'store_Public001', access: 'public', oidcTokenEnv: 'STORAGE_OIDC_TOKEN', ownedPrefixes: ['catalog-items/'] }] };
function object(name = 'image.png'): ObjectInfo { const pathname = `catalog-items/example/${name}`; return { id: objectId(config.stores[0].id, pathname), storeId: config.stores[0].id, access: 'public', pathname, url: `https://example.public.blob.vercel-storage.com/${pathname}`, size: 12, uploadedAt: '2025-01-01T00:00:00.000Z' }; }
function scan(): Scan { return { complete: true, issues: [], databases: config.databases.map(database => ({ database, tables: 1, readOnly: true, tlsVerified: true })), references: {}, intents: {} }; }
function prepared(name?: string): PreparedObject { return { ...object(name), etag: '"reviewed-version"', contentType: 'image/png', cacheControlMaxAge: 3600, sha256: 'a'.repeat(64), recoveryFile: `files/${object(name).id}.blob`, intents: [{ database: 'production', row: { id: '9007199254740993', blob_target: object(name).pathname, source_item_type: 'product_media' } }] }; }
function manifest(objects = [prepared()]): Manifest { return { version: 1, createdAt: '2026-01-01T00:00:00.000Z', configSha256: hash(canonical(config)), reviewSha256: 'b'.repeat(64), externalReview: { reviewedBy: 'operator', reviewedAt: '2026-01-01T00:00:00.000Z', backupsAndExternalConsumersChecked: true, note: 'Checked all shared stores, archives and delivered documents.' }, objects }; }
function fixture(objects = [prepared()]) {
    const current = new Map(objects.map(object => [object.id, { ...object } as Metadata])), calls: string[] = [], events: Event[] = [];
    const io: ApplyIO = {
        verifyRecovery: async (object) => { calls.push(`recover:${object.id}`); },
        freshReview: async (selected) => { calls.push('review'); return reviewObjects(config, selected, scan()); },
        head: async (object) => { calls.push(`head:${object.id}`); return current.get(object.id) ?? null; },
        delete: async (object) => { calls.push(`delete:${object.id}`); current.delete(object.id); },
        acknowledge: async (object) => { calls.push(`ack:${object.id}`); },
        append: async (event) => { calls.push(`journal:${event.action}:${event.objectId}`); }
    };
    return { current, calls, events, io, value: manifest(objects) };
}
test('scope configuration accepts explicit shared databases and refuses credential-like inline endpoint values', () => {
    assert.equal(validateConfig(config), config);
    assert.throws(() => validateConfig({ ...config, expectedHost: 'postgres://owner:secret@db.example.test' }), /INVALID_DATABASE_ENDPOINT/u);
    assert.throws(() => validateConfig({ ...config, databases: ['production', 'production'] }), /INVALID_DATABASE_SCOPE/u);
    assert.throws(() => validateConfig({ ...config, minimumAgeHours: 0 }), /MINIMUM_AGE/u);
});
test('remote connections require exact database host and verified TLS even if URL requests disable', () => {
    const options = databaseOptions(config, 'production', { STORAGE_DATABASE_URL: 'postgres://owner:fake@db.example.test/production?sslmode=disable' });
    assert.equal(options.ssl && options.ssl.rejectUnauthorized, true);
    assert.match(options.options, /default_transaction_read_only=on/u);
    assert.throws(() => databaseOptions(config, 'production', { STORAGE_DATABASE_URL: 'postgres://owner:fake@elsewhere.test/production' }), /DATABASE_CONNECTION_IDENTITY_CHANGED/u);
    assert.throws(() => databaseOptions(config, 'outside', {}), /DATABASE_NOT_IN_DECLARED_SCOPE/u);
});
test('historical order snapshots override an outbox deletion intent', () => {
    const value = object(), result = scan();
    result.references[value.id] = [{ database: 'preview', table: 'public.order_line_snapshots', rows: 1, possible: false }];
    result.intents[value.id] = prepared().intents;
    const reviewed = reviewObjects(config, [value], result);
    assert.equal(reviewed.objects[0].candidate, false);
    assert.ok(reviewed.objects[0].blockers.includes('retained-database-reference'));
    assert.throws(() => selectCandidates(reviewed, [value.id]), /NOT_A_CANDIDATE/u);
});
test('a detached upload becomes a candidate after retention without requiring an outbox row', () => {
    const value = object(), reviewed = reviewObjects(config, [value], scan());
    assert.equal(reviewed.objects[0].candidate, true);
    assert.equal(reviewed.objects[0].intents.length, 0);
});
test('unknown consumers block every candidate', () => {
    const state = scan();
    state.complete = false;
    state.issues = ['production:UNDECLARED_SHARED_CLUSTER_DATABASE'];
    const reviewed = reviewObjects(config, [object()], state);
    assert.equal(reviewed.objects[0].candidate, false);
    assert.throws(() => selectCandidates(reviewed, [object().id]), /INCOMPLETE_SELECTION/u);
});
for (const [name, change, blocker] of [
    ['recent upload', (value: ObjectInfo) => { value.uploadedAt = new Date().toISOString(); }, 'retention-or-in-flight-window'],
    ['backup', (value: ObjectInfo) => { Object.assign(value, object('before-change.dump')); }, 'recovery-or-configuration-object'],
    ['configuration export', (value: ObjectInfo) => { Object.assign(value, object('settings.json')); }, 'recovery-or-configuration-object'],
    ['oversized recovery', (value: ObjectInfo) => { value.size = 101 * 1024 * 1024; }, 'exceeds-supported-recovery-size']
] as const)
    test(`${name} remains protected`, () => { const value = object(); change(value); assert.ok(reviewObjects(config, [value], scan()).objects[0].blockers.includes(blocker)); });
test('undeclared prefixes and arbitrary public URLs are not cleanup input', () => {
    const value = object();
    value.pathname = 'outside/image.png';
    value.url = `https://example.public.blob.vercel-storage.com/${value.pathname}`;
    value.id = objectId(value.storeId, value.pathname);
    assert.ok(reviewObjects(config, [value], scan()).objects[0].blockers.includes('outside-declared-owned-prefix'));
    assert.throws(() => reviewObjects(config, [{ ...value, url: 'https://unrelated.test/image.png' }], scan()), /OBJECT_URL_MISMATCH/u);
});
test('safe review excludes object paths, URLs and raw outbox payloads', () => {
    const value = object(), state = scan();
    state.intents[value.id] = prepared().intents;
    const serialized = JSON.stringify(safeReview(reviewObjects(config, [value], state)));
    assert.ok(!serialized.includes(value.pathname));
    assert.ok(!serialized.includes(value.url));
    assert.ok(!serialized.includes('blob_target'));
    assert.match(serialized, /9007199254740993/u);
});
test('outbox identity accepts exact decoded URL but never a UUID sibling or another store host', () => {
    const value = object('12345678-abcd-4abc-8abc-123456789012@2x.png');
    assert.equal(matchesOutboxTarget(value.url.replace('@', '%40'), 'product_media', value), true);
    assert.equal(matchesOutboxTarget(encodeURIComponent(value.url), 'product_media', value), true);
    assert.equal(matchesOutboxTarget(value.pathname.replace('@2x', '@1x'), 'product_media', value), false);
    assert.equal(matchesOutboxTarget(value.url.replace('example.public', 'other.public'), 'product_media', value), false);
    assert.equal(matchesOutboxTarget(value.pathname, 'pdf', value), false);
});
test('reference patterns cover encoded URLs and UUID composition without reducing historical scope', () => {
    const value = object('12345678-abcd-4abc-8abc-123456789012@2x.png'), known = patterns([value]);
    assert.ok(known.some(pattern => pattern.value === value.url.replace('@', '%40')));
    assert.ok(known.some(pattern => pattern.possible && pattern.value === '12345678-abcd-4abc-8abc-123456789012'));
    assert.match(referenceSql('select 1 as ordinal,\'{}\'::jsonb as payload'), /jsonb_object_keys/u);
    assert.doesNotMatch(referenceSql('select 1 as ordinal,\'{}\'::jsonb as payload'), /deleted_at is null/u);
});
test('manifest requires explicit external review and rejects unrelated outbox acknowledgment', () => {
    const value = manifest();
    validateManifest(value, config);
    const unchecked = structuredClone(value);
    unchecked.externalReview.backupsAndExternalConsumersChecked = false as true;
    assert.throws(() => validateManifest(unchecked, config), /EXTERNAL_AND_BACKUP/u);
    const unrelated = structuredClone(value);
    unrelated.objects[0].intents[0].row.blob_target = 'catalog-items/another.png';
    assert.throws(() => validateManifest(unrelated, config), /OUTBOX_INTENT_SCOPE_CHANGED/u);
});
test('recovery validation fails before any remote review or mutation', async () => {
    const f = fixture();
    f.io.verifyRecovery = async () => { throw new Error('bad recovery'); };
    await assert.rejects(applyApproved(f.value, config, f.events, f.io), /bad recovery/u);
    assert.equal(f.calls.length, 0);
});
test('fresh history reference prevents deletion despite earlier candidate review', async () => {
    const f = fixture();
    f.io.freshReview = async (selected) => { const state = scan(); state.references[selected[0].id] = [{ database: 'preview', table: 'public.site_logo_settings', rows: 1, possible: true }]; return reviewObjects(config, selected, state); };
    await assert.rejects(applyApproved(f.value, config, f.events, f.io), /FRESH_REFERENCE_OR_RETENTION/u);
    assert.ok(!f.calls.some(call => call.startsWith('delete:')));
});
test('all object versions are checked before the first deletion', async () => {
    const a = prepared(), b = prepared('another.png');
    b.intents = [];
    const f = fixture([a, b]);
    f.current.get(b.id)!.etag = 'changed';
    await assert.rejects(applyApproved(f.value, config, f.events, f.io), /OBJECT_VERSION_CHANGED/u);
    assert.ok(!f.calls.some(call => call.startsWith('delete:')));
});
test('delete intent is durable before deletion and outbox acknowledgment follows confirmed absence', async () => {
    const f = fixture();
    await applyApproved(f.value, config, f.events, f.io);
    const id = f.value.objects[0].id;
    assert.ok(f.calls.indexOf(`journal:delete-intent:${id}`) < f.calls.indexOf(`delete:${id}`));
    assert.ok(f.calls.indexOf(`journal:absence-confirmed:${id}`) < f.calls.indexOf(`ack:${id}`));
    assert.equal(f.current.size, 0);
});
test('uncertain successful delete resumes from confirmed absence without a second deletion', async () => {
    const f = fixture();
    f.io.delete = async (object) => { f.calls.push(`delete:${object.id}`); f.current.delete(object.id); throw new Error('lost response'); };
    await assert.rejects(applyApproved(f.value, config, f.events, f.io), /lost response/u);
    assert.ok(!f.calls.some(call => call.startsWith('ack:')));
    await applyApproved(f.value, config, f.events, f.io);
    assert.equal(f.calls.filter(call => call.startsWith('delete:')).length, 1);
    assert.equal(f.calls.filter(call => call.startsWith('ack:')).length, 1);
});
test('outbox failure after confirmed absence resumes acknowledgment without deleting again', async () => {
    const f = fixture();
    let attempts = 0;
    f.io.acknowledge = async () => { if (++attempts === 1)
        throw new Error('db unavailable'); };
    await assert.rejects(applyApproved(f.value, config, f.events, f.io), /db unavailable/u);
    await applyApproved(f.value, config, f.events, f.io);
    assert.equal(attempts, 2);
    assert.equal(f.calls.filter(call => call.startsWith('delete:')).length, 1);
});
test('an absent object without prior intent or a resurrected confirmed deletion fails closed', async () => {
    const f = fixture();
    f.current.clear();
    await assert.rejects(applyApproved(f.value, config, f.events, f.io), /MISSING_WITHOUT_PRIOR_INTENT/u);
    const g = fixture();
    await applyApproved(g.value, config, g.events, g.io);
    g.current.set(g.value.objects[0].id, g.value.objects[0]);
    await assert.rejects(applyApproved(g.value, config, g.events, g.io), /PREVIOUSLY_REMOVED_OBJECT_REAPPEARED/u);
});
test('a file disappearing between preflight and deletion is not acknowledged without an intent', async () => {
    const f = fixture();
    let calls = 0;
    f.io.head = async (object) => ++calls === 1 ? object : null;
    await assert.rejects(applyApproved(f.value, config, f.events, f.io), /DISAPPEARED_WITHOUT_PRIOR_INTENT/u);
    assert.ok(!f.calls.some(call => call.startsWith('ack:')));
});
test('a successful delete response alone cannot acknowledge an outbox entry', async () => {
    const f = fixture();
    f.io.delete = async () => { };
    await assert.rejects(applyApproved(f.value, config, f.events, f.io), /ABSENCE_NOT_CONFIRMED/u);
    assert.ok(!f.calls.some(call => call.startsWith('ack:')));
});
test('an authoritative HEAD URL change blocks deletion even when all version fields match', async () => {
    const f = fixture();
    f.current.get(f.value.objects[0].id)!.url = f.value.objects[0].url.replace('example.public', 'another.public');
    await assert.rejects(applyApproved(f.value, config, f.events, f.io), /OBJECT_VERSION_CHANGED/u);
    assert.ok(!f.calls.some(call => call.startsWith('delete:')));
});
