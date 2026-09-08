import { createReadStream, closeSync, existsSync, fsyncSync, openSync, readFileSync, realpathSync, writeFileSync, appendFileSync } from 'node:fs';
import { mkdir, open, readFile, rm, writeFile } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { applyApproved, assertMetadata, canonical, ensure, hash, objectId, reviewObjects, safeReview, selectCandidates, validateConfig, validateManifest, type Config, type Event, type Manifest, type Metadata, type ObjectInfo, type PreparedObject, type Review, type Store } from './storage/lifecycle';
import { acknowledgeOutbox, scanDatabases } from './storage/postgres';
const maximumObjectBytes = 100 * 1024 * 1024;
const readJson = async <T>(file: string): Promise<T> => JSON.parse((await readFile(file, 'utf8')).replace(/^\uFEFF/u, ''));
async function saveJson(file: string, value: unknown) { await writeFile(file, JSON.stringify(value, null, 2) + '\n', { flag: 'wx', mode: 0o600 }); }
function argsOf(args: string[]) {
    const mode = args.shift() ?? 'review', options: Record<string, string> = {};
    ensure(['review', 'prepare', 'apply'].includes(mode), 'UNKNOWN_MODE');
    while (args.length) {
        const key = args.shift()!;
        ensure(key.startsWith('--') && !(key in options), 'INVALID_ARGUMENTS');
        if (['--confirm-drained', '--resume', '--help'].includes(key))
            options[key] = 'true';
        else {
            const value = args.shift();
            ensure(value && !value.startsWith('--'), 'ARGUMENT_VALUE_REQUIRED');
            options[key] = value;
        }
    }
    const allowed = ['--config', '--output', '--review', '--selection', '--directory', '--external-review', '--manifest', '--approve-sha', '--confirm-drained', '--resume', '--help'];
    ensure(Object.keys(options).every(key => allowed.includes(key)), 'UNKNOWN_OPTION');
    return { mode, options };
}
function confinedFile(directory: string, name: string) {
    ensure(!isAbsolute(name), 'RECOVERY_PATH_MUST_BE_RELATIVE');
    const root = realpathSync(directory), file = realpathSync(resolve(directory, name)), rel = relative(root, file);
    ensure(rel && rel !== '..' && !rel.startsWith(`..${sep}`) && !isAbsolute(rel), 'RECOVERY_PATH_ESCAPES_DIRECTORY');
    return file;
}
async function digestFile(file: string) { const digest = createHash('sha256'); let bytes = 0; for await (const chunk of createReadStream(file)) {
    digest.update(chunk);
    bytes += chunk.length;
} return { bytes, sha256: digest.digest('hex') }; }
function appendDurable(file: string, event: Event) { appendFileSync(file, JSON.stringify(event) + '\n', { mode: 0o600 }); const fd = openSync(file, 'r+'); try {
    fsyncSync(fd);
}
finally {
    closeSync(fd);
} }
async function storage(config: Config) {
    ensure(process.env.NODE_TLS_REJECT_UNAUTHORIZED !== '0', 'TLS_BYPASS_NOT_ALLOWED');
    for (const key of ['VERCEL_BLOB_API_URL', 'NEXT_PUBLIC_VERCEL_BLOB_API_URL', 'VERCEL_BLOB_PROXY_THROUGH_ALTERNATIVE_API', 'NEXT_PUBLIC_VERCEL_BLOB_PROXY_THROUGH_ALTERNATIVE_API'])
        ensure(!process.env[key], 'BLOB_ENDPOINT_OVERRIDE_NOT_ALLOWED');
    // An uncertain mutation must be reviewed, not replayed by the SDK's default retry loop.
    process.env.VERCEL_BLOB_RETRIES = '0';
    delete process.env.DEBUG;
    const sdk = await import('@vercel/blob');
    function auth(store: Store) {
        const credential = process.env[store.tokenEnv ?? store.oidcTokenEnv!];
        ensure(credential, 'STORE_AUTH_ENV_MISSING');
        return { storeId: store.id, ...(store.tokenEnv ? { token: credential } : { oidcToken: credential }), abortSignal: AbortSignal.timeout(120000) };
    }
    function storeFor(object: ObjectInfo) { const store = config.stores.find(store => store.id === object.storeId); ensure(store, 'STORE_SCOPE_CHANGED'); return store; }
    const from = (store: Store, value: {
        pathname: string;
        url: string;
        size: number;
        uploadedAt: Date;
    }): ObjectInfo => ({ id: objectId(store.id, value.pathname), storeId: store.id, access: store.access, pathname: value.pathname, url: value.url, size: value.size, uploadedAt: value.uploadedAt.toISOString() });
    async function head(object: ObjectInfo): Promise<Metadata | null> {
        const store = storeFor(object);
        try {
            const result = await sdk.head(object.pathname, auth(store));
            const cacheControlMaxAge = Number(result.cacheControl.match(/(?:^|[,\s])max-age=(\d+)/u)?.[1]);
            ensure(Number.isInteger(cacheControlMaxAge) && cacheControlMaxAge >= 60, 'UNSUPPORTED_CACHE_METADATA');
            return { ...from(store, result), etag: result.etag, contentType: result.contentType, cacheControlMaxAge };
        }
        catch (error) {
            if (error instanceof sdk.BlobNotFoundError)
                return null;
            throw error;
        }
    }
    async function inventory() {
        const objects: ObjectInfo[] = [];
        for (const store of config.stores) {
            let cursor: string | undefined, pages = 0;
            do {
                const result = await sdk.list({ ...auth(store), limit: 1000, ...(cursor ? { cursor } : {}) });
                objects.push(...result.blobs.map(value => from(store, value)));
                ensure(++pages <= 20 && (!result.hasMore || result.cursor), 'INVENTORY_BOUND_EXCEEDED');
                cursor = result.hasMore ? result.cursor : undefined;
            } while (cursor);
        }
        return objects;
    }
    async function backup(object: ObjectInfo, file: string) {
        ensure(object.size <= maximumObjectBytes, 'OBJECT_TOO_LARGE_FOR_LIFECYCLE_RECOVERY');
        const before = await head(object);
        ensure(before && before.size === object.size && before.uploadedAt === object.uploadedAt, 'OBJECT_CHANGED_BEFORE_RECOVERY');
        const store = storeFor(object), response = await sdk.get(object.pathname, { ...auth(store), access: store.access, useCache: false });
        ensure(response?.statusCode === 200 && response.blob.pathname === object.pathname, 'RECOVERY_READ_FAILED');
        const handle = await open(file, 'wx', 0o600), digest = createHash('sha256');
        let bytes = 0;
        const reader = response.stream.getReader();
        try {
            while (true) {
                const result = await reader.read();
                if (result.done)
                    break;
                const chunk = result.value;
                bytes += chunk.length;
                ensure(bytes <= object.size, 'RECOVERY_SIZE_CHANGED');
                digest.update(chunk);
                let offset = 0;
                while (offset < chunk.length) {
                    const written = await handle.write(chunk, offset);
                    ensure(written.bytesWritten > 0, 'RECOVERY_WRITE_FAILED');
                    offset += written.bytesWritten;
                }
            }
            await handle.sync();
        }
        finally {
            await reader.cancel().catch(() => undefined);
            reader.releaseLock();
            await handle.close();
        }
        ensure(bytes === object.size, 'RECOVERY_TRUNCATED');
        const contentSha256 = digest.digest('hex');
        const after = await head(object);
        ensure(after, 'OBJECT_DISAPPEARED_DURING_RECOVERY');
        assertMetadata(before, after);
        const local = await digestFile(file);
        ensure(local.bytes === bytes && local.sha256 === contentSha256, 'RECOVERY_REOPEN_CHECK_FAILED');
        return { ...before, sha256: contentSha256 };
    }
    return { inventory, head, backup, delete: async (object: PreparedObject) => { await sdk.del(object.url, { ...auth(storeFor(object)), ifMatch: object.etag }); } };
}
async function main() {
    const { mode, options } = argsOf(process.argv.slice(2));
    if (!options['--config'] || options['--help']) {
        console.log('Storage lifecycle: review is read-only; prepare creates private recovery files; apply requires an exact manifest SHA and a confirmed write/drain window.');
        console.log('review --config scope.json --output artifacts/storage-review');
        console.log('prepare --config scope.json --review <private-review.json> --selection <ids.json> --external-review <attestation.json> --directory <new-recovery-directory>');
        console.log('apply --config scope.json --manifest <manifest.private.json> --approve-sha <sha256> --confirm-drained [--resume]');
        return;
    }
    const config = validateConfig(await readJson<Config>(options['--config']));
    if (mode === 'apply') {
        ensure(options['--manifest'] && options['--approve-sha'] && options['--confirm-drained'] === 'true', 'EXACT_APPROVAL_AND_DRAIN_CONFIRMATION_REQUIRED');
        const manifestPath = resolve(options['--manifest']), serialized = await readFile(manifestPath);
        ensure(hash(serialized) === options['--approve-sha'], 'APPROVED_MANIFEST_SHA_MISMATCH');
        const manifest = JSON.parse(serialized.toString('utf8')) as Manifest;
        validateManifest(manifest, config);
        const directory = dirname(manifestPath), journalPath = resolve(directory, 'apply-events.jsonl'), lockPath = resolve(directory, 'apply.lock');
        if (existsSync(journalPath))
            ensure(options['--resume'] === 'true', 'PARTIAL_APPLY_REQUIRES_EXPLICIT_RESUME');
        const events = existsSync(journalPath) ? readFileSync(journalPath, 'utf8').split('\n').filter(Boolean).map(line => JSON.parse(line) as Event) : [];
        // Verify recovery locally before any authentication or remote request.
        const verifyRecovery = async (object: PreparedObject) => { const local = await digestFile(confinedFile(directory, object.recoveryFile)); ensure(local.bytes === object.size && local.sha256 === object.sha256, 'LOCAL_RECOVERY_CHECKSUM_FAILED'); };
        for (const object of manifest.objects)
            await verifyRecovery(object);
        const lock = await open(lockPath, 'wx', 0o600);
        await lock.writeFile(JSON.stringify({ pid: process.pid, manifestSha256: options['--approve-sha'] }));
        await lock.close();
        try {
            const blobs = await storage(config);
            const result = await applyApproved(manifest, config, events, {
                verifyRecovery,
                freshReview: async (objects) => {
                    const inventory = await blobs.inventory();
                    // A partially deleted object still participates in reference revalidation on resume.
                    for (const object of objects)
                        if (!inventory.some(current => current.id === object.id))
                            inventory.push(object);
                    const review = reviewObjects(config, inventory, await scanDatabases(config, inventory));
                    await saveJson(resolve(directory, `apply-reference-review-${Date.now()}-${randomUUID()}.json`), safeReview(review));
                    return review;
                },
                head: blobs.head, delete: blobs.delete,
                acknowledge: async (object) => { await acknowledgeOutbox(config, object); },
                append: async (event) => { appendDurable(journalPath, event); }
            });
            const receipt = { completedAt: new Date().toISOString(), manifestSha256: options['--approve-sha'], ...result, exactObjectAbsenceConfirmed: true, localRecoveryPreserved: true };
            await saveJson(resolve(directory, `apply-complete-${Date.now()}-${randomUUID()}.json`), receipt);
            console.log(JSON.stringify(receipt));
        }
        finally {
            await rm(lockPath);
        }
        return;
    }
    const blobs = await storage(config);
    if (mode === 'review') {
        ensure(options['--output'], 'REVIEW_OUTPUT_DIRECTORY_REQUIRED');
        const directory = resolve(options['--output']);
        await mkdir(directory, { recursive: false });
        const inventory = await blobs.inventory(), review = reviewObjects(config, inventory, await scanDatabases(config, inventory));
        await saveJson(resolve(directory, 'review.private.json'), review);
        await saveJson(resolve(directory, 'review.json'), safeReview(review));
        console.log(JSON.stringify({ complete: review.complete, objects: review.objects.length, candidates: review.objects.filter(object => object.candidate).length, issues: review.scan.issues, remoteWrites: 0 }));
        if (!review.complete)
            process.exitCode = 2;
        return;
    }
    ensure(options['--review'] && options['--selection'] && options['--external-review'] && options['--directory'], 'PREPARATION_INPUTS_REQUIRED');
    const reviewBytes = await readFile(options['--review']), review = JSON.parse(reviewBytes.toString('utf8')) as Review;
    ensure(review.configSha256 === hash(canonical(config)), 'REVIEW_CONFIG_MISMATCH');
    const selected = selectCandidates(review, await readJson<string[]>(options['--selection']));
    const externalReview = await readJson<Manifest['externalReview']>(options['--external-review']);
    ensure(externalReview.backupsAndExternalConsumersChecked === true && externalReview.note?.trim() && externalReview.reviewedBy?.trim(), 'EXTERNAL_REVIEW_REQUIRED');
    const directory = resolve(options['--directory']);
    await mkdir(directory, { recursive: false });
    await mkdir(resolve(directory, 'files'));
    const objects: PreparedObject[] = [];
    for (const object of selected) {
        const recoveryFile = `files/${object.id}.blob`, recovered = await blobs.backup(object, resolve(directory, recoveryFile));
        objects.push({ ...recovered, recoveryFile, intents: object.intents });
    }
    const manifest: Manifest = { version: 1, createdAt: new Date().toISOString(), configSha256: review.configSha256, reviewSha256: hash(reviewBytes), externalReview, objects };
    validateManifest(manifest, config);
    const serialized = JSON.stringify(manifest, null, 2) + '\n';
    await writeFile(resolve(directory, 'manifest.private.json'), serialized, { flag: 'wx', mode: 0o600 });
    console.log(JSON.stringify({ recoveryPrepared: true, objects: objects.length, bytes: objects.reduce((sum, object) => sum + object.size, 0), approvalSha256: hash(serialized), remoteWrites: 0, note: 'Review the exact private manifest and verified recovery location before approving apply. No deletion is authorized by prepare.' }));
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href)
    main().catch(error => { const message = error instanceof Error ? error.message : ''; console.error(JSON.stringify({ stopped: true, code: /^[A-Z][A-Z0-9_]{2,100}$/u.test(message) ? message : 'STORAGE_LIFECYCLE_REVIEW_REQUIRED', detailsWithheld: true, automaticRetry: false })); process.exitCode = 1; });
