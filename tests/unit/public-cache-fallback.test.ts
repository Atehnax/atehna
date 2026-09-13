import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import type { WorkStore } from 'next/dist/server/app-render/work-async-storage.external';
import type { WorkUnitStore } from 'next/dist/server/app-render/work-unit-async-storage.external';

// Next's Node baseline must run before its async storage singletons are imported.
// These tests execute the installed Next 16 implementation without a server/DB.
const require = createRequire(import.meta.url);
require('next/dist/server/node-environment-baseline');
const { workAsyncStorage } = require('next/dist/server/app-render/work-async-storage.external') as typeof import('next/dist/server/app-render/work-async-storage.external');
const { workUnitAsyncStorage } = require('next/dist/server/app-render/work-unit-async-storage.external') as typeof import('next/dist/server/app-render/work-unit-async-storage.external');
const { isStaticGenBailoutError } = require('next/dist/client/components/static-generation-bailout') as typeof import('next/dist/client/components/static-generation-bailout');
const { preventCachingPublicFallback } = require(resolve('src/shared/server/publicCacheFallback.ts')) as typeof import('../../src/shared/server/publicCacheFallback');

function inRender<T>(strictStatic: boolean, run: () => T) {
  const store = { route: '/', isStaticGeneration: strictStatic, dynamicShouldError: strictStatic, forceDynamic: !strictStatic, forceStatic: false } as WorkStore;
  const unit = { type: strictStatic ? 'prerender-legacy' : 'request', revalidate: 60 } as WorkUnitStore;
  return { store, value: workAsyncStorage.run(store, () => workUnitAsyncStorage.run(unit, run)) };
}
function inCache<T>(run: () => T): T { return workUnitAsyncStorage.run({ type: 'unstable-cache' } as WorkUnitStore, run); }
function loadFunction(file: string, name: string, bindings: Record<string, unknown>): () => Promise<unknown> {
  const source = ts.createSourceFile(file, readFileSync(resolve(file), 'utf8'), ts.ScriptTarget.Latest, true);
  const fn = source.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === name);
  assert.ok(fn, 'public getter must exist: ' + name);
  const code = ts.transpileModule(fn.getText(source), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports: Record<string, unknown> = {};
  runInNewContext(code + ';exports.selected = ' + name + ';', { exports, preventCachingPublicFallback, console: { error() {} }, ...bindings });
  return exports.selected as () => Promise<unknown>;
}

test('fallback guard permits CLI/dynamic output but rejects strict static generation using actual Next storage', () => {
  assert.doesNotThrow(() => preventCachingPublicFallback());
  const dynamic = inRender(false, preventCachingPublicFallback);
  assert.equal(dynamic.store.isUnstableNoStore, true);
  assert.throws(() => inRender(true, preventCachingPublicFallback), isStaticGenBailoutError);
  // This is the installed API's documented limitation, and why caller tests
  // below exercise catches after the cached operation has left its context.
  assert.doesNotThrow(() => inRender(true, () => inCache(preventCachingPublicFallback)));
});

const getters = [
  ['src/shared/server/globalStyle.ts', 'getGlobalStyleConfig', 'getCachedGlobalStyleConfigFromDatabase', 'cloneDefaultGlobalStyleConfig'],
  ['src/shared/server/landingPage.ts', 'getLandingPageConfig', 'getCachedLandingPageConfigFromDatabase', 'cloneDefaultLandingPageConfig'],
  ['src/shared/server/productAppearance.ts', 'getProductAppearanceConfig', 'getCachedProductAppearanceConfigFromDatabase', 'cloneDefaultProductAppearanceConfig'],
  ['src/shared/server/siteNavigation.ts', 'getSiteNavigationConfig', 'getCachedSiteNavigationConfigFromDatabase', 'cloneDefaultSiteNavigationConfig']
] as const;
for (const [file, name, cachedName, defaultsName] of getters) {
  test(name + ' keeps dynamic defaults but rejects an outage outside the cache boundary during regeneration', async () => {
    const fallback = { source: 'existing-default' };
    const failure = Object.assign(new Error('synthetic unavailable database'), { code: 'ECONNREFUSED' });
    const getter = loadFunction(file, name, {
      [cachedName]: () => inCache(async () => { throw failure; }),
      [defaultsName]: () => fallback,
      isDatabaseUnavailableError: () => true,
      normalizeSiteNavigationConfig: (value: unknown) => value
    });
    assert.equal(await getter(), fallback, 'CLI callers retain their existing fallback');
    assert.equal(await inRender(false, getter).value, fallback, 'dynamic requests retain their existing fallback');
    await assert.rejects(inRender(true, getter).value, isStaticGenBailoutError);
  });
  test(name + ' leaves successful published data cacheable', async () => {
    const published = { source: 'published' };
    const getter = loadFunction(file, name, {
      [cachedName]: () => inCache(async () => published),
      [defaultsName]: () => { throw new Error('defaults must not be read'); },
      normalizeSiteNavigationConfig: (value: unknown) => value
    });
    const result = inRender(true, getter);
    assert.equal(await result.value, published);
    assert.equal(result.store.isUnstableNoStore, undefined);
  });
}

test('homepage missing-DB early return cannot publish an empty category fallback as static HTML', async () => {
  let reads = 0;
  const categories = loadFunction('src/commercial/components/landing/LandingPage.tsx', 'getHomepageCategories', {
    hasDatabaseConnectionString: () => false,
    getCatalogCategoryCardsServer: () => { reads++; throw new Error('must not read when unconfigured'); }
  });
  const result = await inRender(false, categories).value;
  assert.equal(Array.isArray(result) && result.length === 0, true);
  await assert.rejects(inRender(true, categories).value, isStaticGenBailoutError);
  assert.equal(reads, 0);
});
test('homepage category outage aborts strict regeneration; healthy categories remain cacheable', async () => {
  let unavailable = true;
  const published = [{ slug: 'materiali' }];
  const categories = loadFunction('src/commercial/components/landing/LandingPage.tsx', 'getHomepageCategories', {
    hasDatabaseConnectionString: () => true,
    getCatalogCategoryCardsServer: () => inCache(async () => { if (unavailable) throw new Error('synthetic outage'); return published; })
  });
  const fallback = await inRender(false, categories).value;
  assert.equal(Array.isArray(fallback) && fallback.length === 0, true);
  await assert.rejects(inRender(true, categories).value, isStaticGenBailoutError);
  unavailable = false;
  const healthy = inRender(true, categories);
  assert.equal(await healthy.value, published);
  assert.equal(healthy.store.isUnstableNoStore, undefined);
});
