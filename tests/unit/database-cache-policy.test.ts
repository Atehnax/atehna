import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, relative, resolve } from 'node:path';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import type { WorkStore } from 'next/dist/server/app-render/work-async-storage.external';

// Exercise the installed Next implementation with an in-memory cache, no server or database.
const require = createRequire(import.meta.url);
require('next/dist/server/node-environment-baseline');
const nextCache = require('next/dist/server/web/spec-extension/unstable-cache') as typeof import('next/cache');
const { workAsyncStorage } = require('next/dist/server/app-render/work-async-storage.external') as typeof import('next/dist/server/app-render/work-async-storage.external');
const policySource = readFileSync(resolve('src/shared/server/databaseCache.ts'), 'utf8');
const policy = {} as typeof import('../../src/shared/server/databaseCache');
runInNewContext(ts.transpileModule(policySource, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, {
  exports: policy,
  require(id: string) {
    if (id === 'server-only') return {};
    assert.equal(id, 'next/cache');
    return nextCache;
  }
});

type CacheValue = { kind: 'FETCH'; data: { body: string }; revalidate: number };
function fixture() {
  let now = 0;
  const entries = new Map<string, { value: CacheValue; writtenAt: number; tags: string[] }>();
  const reads: Array<{ key: string; revalidate: number | false | undefined }> = [];
  const cache = {
    async generateSimpleCacheKey(key: string) { return createHash('sha256').update(key).digest('hex'); },
    async get(key: string, options: { revalidate?: number | false }) {
      reads.push({ key, revalidate: options.revalidate });
      const entry = entries.get(key);
      return entry ? { value: entry.value, isStale: now - entry.writtenAt > entry.value.revalidate } : null;
    },
    async set(key: string, value: CacheValue, options: { tags: string[] }) {
      entries.set(key, { value, writtenAt: now, tags: [...options.tags] });
    }
  };
  async function request<T>(read: () => Promise<T>) {
    const store = { incrementalCache: cache } as unknown as WorkStore;
    const value = await workAsyncStorage.run(store, read);
    return { value, settled: async () => { await Promise.all(Object.values(store.pendingRevalidates ?? {})); } };
  }
  return {
    entries, reads, request,
    advance(seconds: number) { now += seconds; },
    invalidateTag(tag: string) {
      for (const [key, entry] of entries) if (entry.tags.includes(tag)) entries.delete(key);
    }
  };
}

test('database cache isolates previous indefinite entries and preserves typed arguments, keys and tags', async () => {
  const f = fixture();
  let data = 'old';
  const reader = async (id: number, locale: 'sl' | 'en') => ({ id, locale, data });
  const keys = ['existing-catalog-v7', 'category-12'];
  const tags = ['catalog-public', 'catalog-admin'];
  const old = nextCache.unstable_cache(reader, keys, { tags });
  const first = await f.request(() => old(12, 'sl')); await first.settled();
  data = 'shared-production';
  const current = policy.cacheDatabaseRead(reader, keys, { tags });
  const typed: typeof reader = current;
  const result = await f.request(() => typed(12, 'sl')); await result.settled();
  assert.equal(result.value.data, 'shared-production');
  assert.equal(result.value.id, 12);
  assert.equal(result.value.locale, 'sl');
  assert.deepEqual(keys, ['existing-catalog-v7', 'category-12']);
  assert.deepEqual(tags, ['catalog-public', 'catalog-admin']);
  assert.notEqual(f.reads[0].key, f.reads[1].key, 'the old indefinite entry must be unreachable');
  assert.equal(f.reads[1].revalidate, 60);
  const stored = f.entries.get(f.reads[1].key)!;
  assert.equal(stored.value.revalidate, 60);
  assert.deepEqual(stored.tags, tags);
  await (await f.request(() => current(13, 'en'))).settled();
  assert.notEqual(f.reads[1].key, f.reads[2].key, 'arguments still partition the cache');
});

test('shared reads stay warm before 60 seconds then serve stale once while Next refreshes', async () => {
  const f = fixture();
  let data = 'before-edit';
  let calls = 0;
  const read = policy.cacheDatabaseRead(async () => { calls++; return { data }; }, ['navigation'], { tags: ['site-navigation-config'] });
  const first = await f.request(read); await first.settled();
  data = 'edited-in-other-environment';
  f.advance(59);
  const warm = await f.request(read); await warm.settled();
  assert.equal(warm.value.data, 'before-edit');
  assert.equal(calls, 1);
  f.advance(2);
  const stale = await f.request(read);
  assert.equal(stale.value.data, 'before-edit', 'time revalidation is not a hard freshness deadline');
  await stale.settled();
  const refreshed = await f.request(read); await refreshed.settled();
  assert.equal(refreshed.value.data, 'edited-in-other-environment');
  assert.equal(calls, 2);
});

test('existing tag invalidation still gets fresh data immediately without waiting for the interval', async () => {
  const f = fixture();
  let data = 'before-edit';
  const read = policy.cacheDatabaseRead(async () => data, ['appearance'], { tags: ['product-appearance-config'] });
  await (await f.request(read)).settled();
  data = 'saved';
  f.invalidateTag('product-appearance-config');
  const result = await f.request(read); await result.settled();
  assert.equal(result.value, 'saved');
});

test('database reader failures propagate on a cold cache and do not create cached values', async () => {
  const f = fixture();
  const failure = new Error('synthetic database unavailable');
  const read = policy.cacheDatabaseRead(async () => { throw failure; }, ['failure'], { tags: ['catalog-public'] });
  await assert.rejects(f.request(read), error => error === failure);
  assert.equal(f.entries.size, 0);
});

test('a failed background refresh keeps stale data and the next successful refresh recovers', async (context) => {
  const logged = context.mock.method(console, 'error', () => {});
  const f = fixture();
  let unavailable = false;
  let data = 'before-edit';
  let calls = 0;
  const read = policy.cacheDatabaseRead(async () => {
    calls++;
    if (unavailable) throw new Error('synthetic refresh failure');
    return data;
  }, ['refresh-failure'], { tags: ['catalog-public'] });
  await (await f.request(read)).settled();
  unavailable = true;
  f.advance(61);
  const stale = await f.request(read); await stale.settled();
  assert.equal(stale.value, 'before-edit');
  assert.equal(logged.mock.callCount(), 1);
  assert.equal(f.entries.size, 1, 'a failed refresh must not replace the last good value');
  unavailable = false;
  data = 'after-edit';
  const recovered = await f.request(read); await recovered.settled();
  assert.equal(recovered.value, 'before-edit');
  const warm = await f.request(read); await warm.settled();
  assert.equal(warm.value, 'after-edit');
  assert.equal(calls, 3);
  assert.equal(logged.mock.callCount(), 1);
});

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? sourceFiles(path) : /\.[cm]?[jt]sx?$/.test(entry.name) ? [path] : [];
  });
}

test('every persistent database reader uses the shared lifetime, keeping direct Next caching inside the policy', () => {
  const modules = new Map<string, number>();
  const direct: string[] = [];
  for (const file of sourceFiles(resolve('src'))) {
    const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
    const policyNames = new Set<string>();
    const nextNamespaces = new Set<string>();
    for (const statement of source.statements) {
      if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) continue;
      const bindings = statement.importClause?.namedBindings;
      if (bindings && ts.isNamespaceImport(bindings) && statement.moduleSpecifier.text === 'next/cache') nextNamespaces.add(bindings.name.text);
      if (!bindings || !ts.isNamedImports(bindings)) continue;
      for (const entry of bindings.elements) {
        const imported = entry.propertyName?.text ?? entry.name.text;
        if (statement.moduleSpecifier.text === 'next/cache' && imported === 'unstable_cache') direct.push(relative(resolve('src'), file).replaceAll('\\', '/'));
        if (statement.moduleSpecifier.text === '@/shared/server/databaseCache' && imported === 'cacheDatabaseRead') policyNames.add(entry.name.text);
      }
    }
    const visit = (node: ts.Node) => {
      if (ts.isPropertyAccessExpression(node) && ts.isIdentifier(node.expression) && nextNamespaces.has(node.expression.text)) {
        assert.notEqual(node.name.text, 'unstable_cache', 'database caching must use the shared policy');
      }
      if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && policyNames.has(node.expression.text)) {
        const name = relative(resolve('src/shared/server'), file).replaceAll('\\', '/');
        modules.set(name, (modules.get(name) ?? 0) + 1);
        assert.equal(node.arguments.length, 3, `${name} must retain explicit keys and tags`);
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  assert.deepEqual(direct, ['shared/server/databaseCache.ts']);
  assert.deepEqual(Object.fromEntries([...modules].sort()), {
    'catalogCategories.ts': 11, 'categoryShowcase.ts': 1, 'globalStyle.ts': 1,
    'landingPage.ts': 2, 'logoLibrary.ts': 1, 'orderDocumentTemplates.ts': 1,
    'productAppearance.ts': 1, 'siteNavigation.ts': 1
  });
});
