import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import {
  PUBLIC_MEDIA_UPLOAD_LIMITS,
  getPublicMediaUploadPolicy,
  getOrCreateCachedMediaUpload,
  parsePublicMediaUploadPayload,
  resolvePublicMediaContentType,
  type MediaUploadPromiseCache
} from '../../src/shared/domain/media/publicMediaUpload';

const root = process.cwd();
const source = (relativePath: string) => readFileSync(path.join(root, relativePath), 'utf8');

test('public media policy creates an immutable opaque catalogue image path', () => {
  const policy = getPublicMediaUploadPolicy({
    scope: 'catalog-item',
    itemSlug: 'Aluminijasta plošča',
    mediaKind: 'image',
    originalFileName: 'Naslovna slika.png',
    contentType: 'image/png',
    uploadId: '123e4567-e89b-42d3-a456-426614174000'
  });

  assert.equal(
    policy.pathname,
    'catalog-items/aluminijasta-plosca/images/123e4567-e89b-42d3-a456-426614174000-Naslovna-slika.png'
  );
  assert.equal(policy.maximumSizeInBytes, PUBLIC_MEDIA_UPLOAD_LIMITS.catalogImage);
  assert.equal(policy.contentType, 'image/png');
  assert.equal(policy.mediaKind, 'image');
  assert.ok(policy.cacheControlMaxAge >= 365 * 24 * 60 * 60);
});

test('public media policy infers a technical-document MIME type without widening image permissions', () => {
  assert.equal(resolvePublicMediaContentType('drawing.dwg', ''), 'image/vnd.dwg');

  const documentPolicy = getPublicMediaUploadPolicy({
    scope: 'catalog-item',
    itemSlug: 'aluminijasta-plosca',
    mediaKind: 'document',
    originalFileName: 'drawing.dwg',
    contentType: 'image/vnd.dwg',
    uploadId: '123e4567-e89b-42d3-a456-426614174001'
  });
  assert.equal(documentPolicy.pathname.endsWith('.dwg'), true);
  assert.equal(documentPolicy.maximumSizeInBytes, PUBLIC_MEDIA_UPLOAD_LIMITS.catalogDocument);

  assert.throws(
    () => getPublicMediaUploadPolicy({
      scope: 'catalog-item',
      itemSlug: 'aluminijasta-plosca',
      mediaKind: 'image',
      originalFileName: 'drawing.dwg',
      contentType: 'image/vnd.dwg',
      uploadId: '123e4567-e89b-42d3-a456-426614174001'
    }),
    /Vrsta datoteke ni dovoljena/u
  );
});

test('public media payload parser rejects scope confusion and caller-controlled paths', () => {
  const payload = JSON.stringify({
    scope: 'site-logo',
    masterId: 'symbol',
    originalFileName: '../../logo.svg',
    contentType: 'image/svg+xml',
    uploadId: '123e4567-e89b-42d3-a456-426614174002',
    pathname: 'catalog-items/other/file.svg'
  });

  assert.throws(
    () => parsePublicMediaUploadPayload(payload, 'catalog-item'),
    /Namen nalaganja medija se ne ujema/u
  );
  const parsed = parsePublicMediaUploadPayload(payload, 'site-logo');
  assert.equal(parsed.originalFileName, 'logo.svg');
  assert.equal(getPublicMediaUploadPolicy(parsed).pathname.includes('..'), false);
});

test('admin media clients upload directly and the token route remains behind admin auth', () => {
  const clientSource = source('src/shared/client/publicMediaUpload.ts');
  const routeSource = source('src/admin/api/media/route.ts');
  const serverSource = source('src/shared/server/publicMediaUpload.ts');
  const proxySource = source('src/proxy.ts');
  const articleImportSource = source('src/admin/api/artikli/media/route.ts');
  const categoryRouteSource = source('src/admin/api/categories/images/route.ts');

  assert.match(clientSource, /fetch\(HANDLE_UPLOAD_URL/u);
  assert.match(clientSource, /fetch\(authorization\.presignedUrl/u);
  assert.doesNotMatch(clientSource, /new FormData/u);
  assert.match(routeSource, /parsePublicMediaUploadPayload/u);
  assert.match(routeSource, /topLevelCatalogCategoryExistsInDatabase/u);
  assert.match(serverSource, /operations: \['put'\]/u);
  assert.match(serverSource, /presignUrl\(/u);
  assert.doesNotMatch(serverSource, /handleUploadPresigned/u);
  assert.match(serverSource, /pathname !== policy\.pathname/u);
  assert.match(serverSource, /maximumSizeInBytes: policy\.maximumSizeInBytes/u);
  assert.match(serverSource, /validUntil/u);
  assert.match(proxySource, /'\/api\/admin\/:path\*'/u);
  assert.match(articleImportSource, /uploadPublicMediaFromServer/u);
  assert.doesNotMatch(articleImportSource, /formData\.get\('file'\)/u);
  assert.doesNotMatch(articleImportSource, /uploadBlob/u);
  assert.doesNotMatch(categoryRouteSource, /export async function POST/u);
  assert.equal(existsSync(path.join(root, 'src/admin/api/landing-page/media/route.ts')), false);
  assert.equal(existsSync(path.join(root, 'src/app/api/admin/landing-page/media/route.ts')), false);
  assert.equal(existsSync(path.join(root, 'src/admin/api/site-logo/media/route.ts')), false);
  assert.equal(existsSync(path.join(root, 'src/app/api/admin/site-logo/media/route.ts')), false);
});

test('all public admin media callers use the shared direct-upload helper', () => {
  const callers = [
    'src/admin/features/artikli/components/AdminItemEditorPage.tsx',
    'src/admin/features/podoba/components/AdminProductAppearancePageClient.tsx',
    'src/admin/features/podoba/components/AdminLandingPageClient.tsx',
    'src/admin/features/podoba/components/AdminLogoPageClient.tsx',
    'src/admin/features/kategorije/components/AdminCategoriesMainTable.tsx',
    'src/shared/features/category-showcase/useCategoryShowcaseEditor.ts'
  ];

  for (const caller of callers) {
    assert.match(source(caller), /uploadAdminPublicMedia/u, caller);
  }
});

test('staged media upload cache reuses in-flight and completed uploads by file and scope', async () => {
  type UploadResult = { pathname: string };
  const cache: MediaUploadPromiseCache<object, UploadResult> = new WeakMap();
  const file = {};
  let uploadCalls = 0;

  const upload = async () => {
    uploadCalls += 1;
    return { pathname: 'catalog-items/example/images/upload.png' };
  };
  const first = getOrCreateCachedMediaUpload(cache, file, 'example:image', upload);
  const concurrent = getOrCreateCachedMediaUpload(cache, file, 'example:image', upload);

  assert.strictEqual(concurrent, first);
  assert.deepEqual(await first, { pathname: 'catalog-items/example/images/upload.png' });
  assert.equal(uploadCalls, 1);
  assert.deepEqual(
    await getOrCreateCachedMediaUpload(cache, file, 'example:image', upload),
    { pathname: 'catalog-items/example/images/upload.png' }
  );
  assert.equal(uploadCalls, 1);

  await getOrCreateCachedMediaUpload(cache, file, 'other-slug:image', upload);
  assert.equal(uploadCalls, 2);
});

test('failed staged media uploads are evicted so a later retry can succeed', async () => {
  type UploadResult = { pathname: string };
  const cache: MediaUploadPromiseCache<object, UploadResult> = new WeakMap();
  const file = {};
  let uploadCalls = 0;

  await assert.rejects(
    getOrCreateCachedMediaUpload(cache, file, 'example:document', async () => {
      uploadCalls += 1;
      throw new Error('upload failed');
    }),
    /upload failed/u
  );
  const retried = await getOrCreateCachedMediaUpload(cache, file, 'example:document', async () => {
    uploadCalls += 1;
    return { pathname: 'catalog-items/example/documents/retry.pdf' };
  });

  assert.equal(uploadCalls, 2);
  assert.deepEqual(retried, { pathname: 'catalog-items/example/documents/retry.pdf' });
  const articleEditorSource = source('src/admin/features/artikli/components/AdminItemEditorPage.tsx');
  assert.match(articleEditorSource, /saveInFlightRef\.current/u);
  assert.match(articleEditorSource, /getOrCreateCachedMediaUpload/u);
});
