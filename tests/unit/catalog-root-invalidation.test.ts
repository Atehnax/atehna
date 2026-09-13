import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';
import type { WorkStore } from 'next/dist/server/app-render/work-async-storage.external';
import { CATALOG_REVALIDATE_PATHS, CATEGORY_SHOWCASE_REVALIDATE_PATHS } from '../../src/shared/server/catalogCache';

const require = createRequire(import.meta.url);
require('next/dist/server/node-environment-baseline');
const { workAsyncStorage } = require('next/dist/server/app-render/work-async-storage.external') as typeof import('next/dist/server/app-render/work-async-storage.external');
const { revalidatePath } = require('next/cache') as typeof import('next/cache');
const { getImplicitTags } = require('next/dist/server/lib/implicit-tags') as typeof import('next/dist/server/lib/implicit-tags');

function tagsFor(path: string, type?: 'page' | 'layout') {
  const store = { page: '/api/admin/categories/route', route: '/api/admin/categories', incrementalCache: {} } as WorkStore;
  workAsyncStorage.run(store, () => revalidatePath(path, type));
  return store.pendingRevalidatedTags?.map(entry => entry.tag) ?? [];
}
for (const [label, paths] of [['catalog', CATALOG_REVALIDATE_PATHS], ['category showcase', CATEGORY_SHOWCASE_REVALIDATE_PATHS]] as const) {
  test(label + ' invalidates the actual grouped homepage using installed Next tags', async () => {
    const homepage = paths.find(target => target.path === '/');
    assert.ok(homepage);
    const implicit = await getImplicitTags('/(commercial)/page', '/', null);
    const invalidated = tagsFor(homepage.path, homepage.type);
    assert.ok(invalidated.some(tag => implicit.tags.includes(tag)), 'the explicit invalidation must match a real homepage cache tag');
  });
}
test('a root page-pattern token does not match the commercial route group', async () => {
  const implicit = await getImplicitTags('/(commercial)/page', '/', null);
  assert.equal(tagsFor('/', 'page').some(tag => implicit.tags.includes(tag)), false);
  assert.equal(tagsFor('/').some(tag => implicit.tags.includes(tag)), true);
});
