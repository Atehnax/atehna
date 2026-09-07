import assert from 'node:assert/strict';

import { readFileSync } from 'node:fs';

import { resolve } from 'node:path';

import test from 'node:test';

const saveRouteSource = readFileSync(
  resolve(process.cwd(), 'src/shared/server/logoLibrary.ts'),
  'utf8'
);

const publicRouteSource = readFileSync(
  resolve(process.cwd(), 'src/app/api/site-logo/[purpose]/route.ts'),
  'utf8'
);

const artworkCacheSource = readFileSync(
  resolve(process.cwd(), 'src/shared/server/logoLibraryStorage.ts'),
  'utf8'
);

test('library save validates projects before persistence and public mutations refresh published output', () => {
  const mutation = saveRouteSource.slice(saveRouteSource.indexOf('export async function mutateLogoLibrary'), saveRouteSource.indexOf('export async function uploadLogoLibrarySource'));
  assert.match(mutation, /requireLogoRevision\(snapshot\.revision, input\.expectedRevision\)/u);
  assert.ok(mutation.indexOf('validateProject(') < mutation.indexOf('commitLogoLibraryChange('));
  assert.ok(mutation.indexOf('createLogoPublication(') < mutation.indexOf('commitLogoLibraryChange('));
  assert.match(mutation, /if \(publicChanged\) revalidatePublishedLogos\(\)/u);
  assert.match(saveRouteSource, /revalidateTag\(LOGO_LIBRARY_PUBLIC_CACHE_TAG, \{ expire: 0 \}\)/u);
  assert.match(saveRouteSource, /for \(const purpose of LOGO_PLACEMENT_IDS\) revalidatePath/u);
});

test('public output is immutable, bounded and separate from private originals', () => {
  assert.match(artworkCacheSource, /LOGO_OUTPUT_MAX_BYTES/u);
  assert.match(artworkCacheSource, /addRandomSuffix: false, allowOverwrite: false/u);
  assert.match(artworkCacheSource, /access: privateSource \? 'private' : 'public'/u);
  assert.match(artworkCacheSource, /cacheControlMaxAge: 365 \* 24 \* 60 \* 60/u);
  assert.match(artworkCacheSource, /readLimitedLogoStream\(result\.stream, maximum\)/u);
  assert.match(artworkCacheSource, /result\.blob\.pathname !== pathname/u);
  assert.match(publicRouteSource, /getPublishedSiteLogos\(\)/u);
  assert.match(publicRouteSource, /readLogoPublishedOutput\(revision\.png2x\)/u);
  assert.match(publicRouteSource, /max-age=0, must-revalidate/u);
  assert.match(publicRouteSource, /status: 503/u);
  assert.doesNotMatch(publicRouteSource, /resolveCachedSiteLogoArtwork|readLogoSource|draft/u);
});
