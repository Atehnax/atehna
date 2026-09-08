import { createHash } from 'node:crypto';
export type Store = {
    id: string;
    access: 'public' | 'private';
    tokenEnv?: string;
    oidcTokenEnv?: string;
    ownedPrefixes: string[];
};
export type Config = {
    version: 1;
    connectionEnv: string;
    expectedHost: string;
    expectedPort: number;
    databases: string[];
    stores: Store[];
    minimumAgeHours: number;
};
export type ObjectInfo = {
    id: string;
    storeId: string;
    access: 'public' | 'private';
    pathname: string;
    url: string;
    size: number;
    uploadedAt: string;
};
export type Reference = {
    database: string;
    table: string;
    rows: number;
    possible: boolean;
};
export type OutboxIntent = {
    database: string;
    row: Record<string, unknown> & {
        id: string;
        blob_target: string;
    };
};
export type Scan = {
    complete: boolean;
    issues: string[];
    databases: {
        database: string;
        tables: number;
        readOnly: boolean;
        tlsVerified: boolean;
    }[];
    references: Record<string, Reference[]>;
    intents: Record<string, OutboxIntent[]>;
    unresolvedIntents?: {
        database: string;
        id: string;
        targetSha256: string;
    }[];
    exclusions?: {
        database: string;
        table: string;
        reason: string;
    }[];
};
export type ReviewedObject = ObjectInfo & {
    references: Reference[];
    intents: OutboxIntent[];
    blockers: string[];
    candidate: boolean;
};
export type Review = {
    version: 1;
    capturedAt: string;
    configSha256: string;
    complete: boolean;
    scan: Scan;
    objects: ReviewedObject[];
};
export type Metadata = ObjectInfo & {
    etag: string;
    contentType: string;
    cacheControlMaxAge: number;
};
export type PreparedObject = Metadata & {
    sha256: string;
    recoveryFile: string;
    intents: OutboxIntent[];
};
export type Manifest = {
    version: 1;
    createdAt: string;
    configSha256: string;
    reviewSha256: string;
    externalReview: {
        reviewedBy: string;
        reviewedAt: string;
        backupsAndExternalConsumersChecked: true;
        note: string;
    };
    objects: PreparedObject[];
};
export type Event = {
    objectId: string;
    action: 'delete-intent' | 'absence-confirmed' | 'outbox-acknowledged';
    at: string;
};
export function ensure(value: unknown, code: string): asserts value { if (!value)
    throw new Error(code); }
export const hash = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');
export function canonical(value: unknown): string {
    if (value === null || typeof value !== 'object')
        return JSON.stringify(value);
    if (Array.isArray(value))
        return `[${value.map(canonical).join(',')}]`;
    return `{${Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(',')}}`;
}
export const objectId = (storeId: string, pathname: string) => hash(`${storeId}\0${pathname}`);
const environmentName = /^[A-Z][A-Z0-9_]{1,100}$/u;
export function validateConfig(value: Config): Config {
    ensure(value?.version === 1 && environmentName.test(value.connectionEnv), 'INVALID_CONFIG');
    ensure(/^[a-zA-Z0-9.-]+$/u.test(value.expectedHost) && Number.isInteger(value.expectedPort) && value.expectedPort > 0 && value.expectedPort <= 65535, 'INVALID_DATABASE_ENDPOINT');
    ensure(Array.isArray(value.databases) && value.databases.length > 0 && value.databases.length <= 20 && value.databases.every(name => /^[a-z][a-z0-9_]{1,62}$/u.test(name)) && new Set(value.databases).size === value.databases.length, 'INVALID_DATABASE_SCOPE');
    ensure(Number.isFinite(value.minimumAgeHours) && value.minimumAgeHours >= 24, 'MINIMUM_AGE_MUST_BE_AT_LEAST_24_HOURS');
    ensure(Array.isArray(value.stores) && value.stores.length > 0 && value.stores.length <= 10 && new Set(value.stores.map(store => store.id)).size === value.stores.length, 'INVALID_STORE_SCOPE');
    for (const store of value.stores) {
        ensure(/^store_[a-zA-Z0-9]+$/u.test(store.id) && ['public', 'private'].includes(store.access), 'INVALID_STORE_IDENTITY');
        ensure(Boolean(store.tokenEnv) !== Boolean(store.oidcTokenEnv) && environmentName.test(store.tokenEnv ?? store.oidcTokenEnv ?? ''), 'EXACTLY_ONE_AUTH_ENV_REQUIRED');
        ensure(store.ownedPrefixes?.length > 0 && store.ownedPrefixes.every(prefix => /^[a-zA-Z0-9][a-zA-Z0-9/_-]*\/$/u.test(prefix) && !prefix.includes('//')), 'INVALID_OWNED_PREFIX');
    }
    return value;
}
export function validateObject(object: ObjectInfo, config: Config) {
    const store = config.stores.find(store => store.id === object.storeId);
    ensure(store && store.access === object.access && typeof object.pathname === 'string' && object.pathname.length > 0 && object.pathname.length < 8192 && !/[\u0000-\u001f\\]/u.test(object.pathname), 'OBJECT_SCOPE_MISMATCH');
    ensure(object.id === objectId(object.storeId, object.pathname) && Number.isSafeInteger(object.size) && object.size >= 0 && Number.isFinite(Date.parse(object.uploadedAt)), 'INVALID_OBJECT_METADATA');
    const url = new URL(object.url);
    ensure(url.protocol === 'https:' && !url.username && !url.password && url.hostname === `${store.id.slice(6).toLowerCase()}.${store.access}.blob.vercel-storage.com` && decodeURIComponent(url.pathname.slice(1)) === object.pathname && !url.search && !url.hash, 'OBJECT_URL_MISMATCH');
}
export function reviewObjects(config: Config, inventory: ObjectInfo[], scan: Scan, now = new Date()): Review {
    ensure(new Set(inventory.map(object => object.id)).size === inventory.length, 'DUPLICATE_INVENTORY_OBJECT');
    const objects = inventory.map(object => {
        validateObject(object, config);
        const references = scan.references[object.id] ?? [], intents = scan.intents[object.id] ?? [], blockers: string[] = [];
        if (!scan.complete)
            blockers.push('incomplete-database-scope');
        if (references.length)
            blockers.push('retained-database-reference');
        if (object.size > 100 * 1024 * 1024)
            blockers.push('exceeds-supported-recovery-size');
        const store = config.stores.find(store => store.id === object.storeId)!;
        if (!store.ownedPrefixes.some(prefix => object.pathname.startsWith(prefix)))
            blockers.push('outside-declared-owned-prefix');
        if (/(?:^|\/)(?:backups?|recovery)(?:\/|[-_])|\.(?:dump|sql|backup|json)(?:\.|$)/iu.test(object.pathname))
            blockers.push('recovery-or-configuration-object');
        if (now.getTime() - Date.parse(object.uploadedAt) < config.minimumAgeHours * 3600000)
            blockers.push('retention-or-in-flight-window');
        return { ...object, references, intents, blockers, candidate: blockers.length === 0 };
    });
    return { version: 1, capturedAt: now.toISOString(), configSha256: hash(canonical(config)), complete: scan.complete, scan, objects };
}
export function selectCandidates(review: Review, ids: string[]) {
    ensure(review.complete && ids.length > 0 && ids.length <= 100 && new Set(ids).size === ids.length, 'INVALID_OR_INCOMPLETE_SELECTION');
    return ids.map(id => {
        const object = review.objects.find(object => object.id === id);
        ensure(object?.candidate && object.references.length === 0, 'SELECTED_OBJECT_IS_NOT_A_CANDIDATE');
        return object;
    });
}
export function matchesOutboxTarget(target: string, sourceType: string, object: ObjectInfo) {
    if ((sourceType === 'product_media' ? 'public' : ['order', 'pdf'].includes(sourceType) ? 'private' : null) !== object.access)
        return false;
    let value = target;
    for (let pass = 0; pass < 3; pass += 1) {
        if (value === object.pathname || value === '/' + object.pathname)
            return true;
        try {
            const url = new URL(value), expected = new URL(object.url);
            if (url.protocol === 'https:' && url.hostname === expected.hostname && !url.username && !url.password && !url.search && !url.hash && decodeURIComponent(url.pathname.slice(1)) === object.pathname)
                return true;
        }
        catch { }
        try {
            const decoded = decodeURIComponent(value);
            if (decoded === value)
                break;
            value = decoded;
        }
        catch {
            break;
        }
    }
    return false;
}
export function validateManifest(manifest: Manifest, config: Config) {
    ensure(manifest?.version === 1 && manifest.configSha256 === hash(canonical(config)) && /^[a-f0-9]{64}$/u.test(manifest.reviewSha256), 'MANIFEST_SCOPE_CHANGED');
    ensure(manifest.externalReview?.backupsAndExternalConsumersChecked === true && manifest.externalReview.reviewedBy?.trim() && manifest.externalReview.note?.trim() && Number.isFinite(Date.parse(manifest.externalReview.reviewedAt)), 'EXTERNAL_AND_BACKUP_REVIEW_REQUIRED');
    ensure(manifest.objects.length > 0 && manifest.objects.length <= 100 && new Set(manifest.objects.map(object => object.id)).size === manifest.objects.length, 'INVALID_MANIFEST_SELECTION');
    const queueIds = manifest.objects.flatMap(object => object.intents.map(intent => `${intent.database}\0${intent.row.id}`));
    ensure(new Set(queueIds).size === queueIds.length, 'DUPLICATE_OUTBOX_ACKNOWLEDGMENT');
    for (const object of manifest.objects) {
        validateObject(object, config);
        ensure(/^[a-f0-9]{64}$/u.test(object.sha256) && object.etag?.trim() && object.contentType?.trim() && Number.isInteger(object.cacheControlMaxAge) && object.cacheControlMaxAge >= 60, 'RECOVERY_METADATA_INCOMPLETE');
        ensure(object.recoveryFile === `files/${object.id}.blob`, 'RECOVERY_FILE_SCOPE_CHANGED');
        for (const intent of object.intents)
            ensure(config.databases.includes(intent.database) && /^\d+$/u.test(String(intent.row.id)) && typeof intent.row.blob_target === 'string' && matchesOutboxTarget(intent.row.blob_target, String(intent.row.source_item_type), object), 'OUTBOX_INTENT_SCOPE_CHANGED');
    }
}
export function assertMetadata(original: Metadata, current: Metadata) {
    ensure(original.id === current.id && original.storeId === current.storeId && original.access === current.access && original.pathname === current.pathname && original.url === current.url && original.uploadedAt === current.uploadedAt && original.size === current.size && original.etag === current.etag && original.contentType === current.contentType && original.cacheControlMaxAge === current.cacheControlMaxAge, 'OBJECT_VERSION_CHANGED');
}
export function safeReview(review: Review) {
    return { version: review.version, capturedAt: review.capturedAt, configSha256: review.configSha256, complete: review.complete, databases: review.scan.databases, issues: review.scan.issues, exclusions: review.scan.exclusions ?? [], unresolvedOutboxIntents: review.scan.unresolvedIntents ?? [], objects: review.objects.map(({ id, storeId, access, size, uploadedAt, references, intents, blockers, candidate }) => ({ id, storeId, access, size, uploadedAt, references, outboxIntents: intents.map(intent => ({ database: intent.database, id: intent.row.id })), blockers, candidate, externalReviewStillRequired: candidate })), deletionsAuthorized: false, limitation: 'No matches does not prove external non-use. Backups, other projects/clusters, exports and delivered documents require an explicit review. Separate database snapshots require a controlled write/drain window before apply.' };
}
export type ApplyIO = {
    verifyRecovery: (object: PreparedObject) => Promise<void>;
    freshReview: (objects: PreparedObject[]) => Promise<Review>;
    head: (object: PreparedObject) => Promise<Metadata | null>;
    delete: (object: PreparedObject) => Promise<void>;
    acknowledge: (object: PreparedObject) => Promise<void>;
    append: (event: Event) => Promise<void>;
};
export async function applyApproved(manifest: Manifest, config: Config, events: Event[], io: ApplyIO) {
    validateManifest(manifest, config);
    ensure(events.every(event => manifest.objects.some(object => object.id === event.objectId) && ['delete-intent', 'absence-confirmed', 'outbox-acknowledged'].includes(event.action)), 'JOURNAL_SCOPE_CHANGED');
    for (const object of manifest.objects)
        await io.verifyRecovery(object);
    const review = await io.freshReview(manifest.objects);
    ensure(review.complete && review.configSha256 === manifest.configSha256, 'FRESH_REFERENCE_REVIEW_INCOMPLETE');
    for (const object of manifest.objects) {
        const current = review.objects.find(candidate => candidate.id === object.id);
        ensure(current && current.references.length === 0 && current.blockers.length === 0, 'FRESH_REFERENCE_OR_RETENTION_BLOCKER');
    }
    // Check every version before the first deletion; on resume only a journaled deletion may already be absent.
    for (const object of manifest.objects) {
        const current = await io.head(object);
        if (current)
            assertMetadata(object, current);
        else
            ensure(events.some(event => event.objectId === object.id && event.action === 'delete-intent'), 'OBJECT_MISSING_WITHOUT_PRIOR_INTENT');
    }
    for (const object of manifest.objects) {
        const current = await io.head(object);
        if (current) {
            assertMetadata(object, current);
            ensure(!events.some(event => event.objectId === object.id && event.action === 'absence-confirmed'), 'PREVIOUSLY_REMOVED_OBJECT_REAPPEARED');
            const event: Event = { objectId: object.id, action: 'delete-intent', at: new Date().toISOString() };
            await io.append(event);
            events.push(event);
            await io.delete(object);
        }
        else {
            ensure(events.some(event => event.objectId === object.id && event.action === 'delete-intent'), 'OBJECT_DISAPPEARED_WITHOUT_PRIOR_INTENT');
        }
        ensure(await io.head(object) === null, 'OBJECT_ABSENCE_NOT_CONFIRMED');
        const absence: Event = { objectId: object.id, action: 'absence-confirmed', at: new Date().toISOString() };
        await io.append(absence);
        events.push(absence);
        // Exact archived outbox rows are acknowledged only after external absence is confirmed.
        await io.acknowledge(object);
        const acknowledged: Event = { objectId: object.id, action: 'outbox-acknowledged', at: new Date().toISOString() };
        await io.append(acknowledged);
        events.push(acknowledged);
    }
    return { objects: manifest.objects.length, bytes: manifest.objects.reduce((sum, object) => sum + object.size, 0), outboxIntents: manifest.objects.reduce((sum, object) => sum + object.intents.length, 0) };
}
