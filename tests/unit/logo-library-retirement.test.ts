import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import { GET, PUT } from '@/admin/api/site-logo/route';
import { LOGO_OUTPUT_DIMENSIONS } from '@/shared/domain/logo/logoOutputDimensions';
import { SITE_LOGO_PURPOSE_CATALOG } from '@/shared/domain/logo/siteLogo';

const source = (name: string) => readFileSync(resolve(process.cwd(), name), 'utf8');

test('old logo API is retired without accepting writes or reading legacy settings', async () => {
  for (const response of [GET(), PUT()]) {
    assert.equal(response.status, 410);
    assert.match(response.headers.get('cache-control') ?? '', /no-store/u);
    assert.match((await response.json()).message, /odstranjen/u);
  }
  assert.doesNotMatch(source('src/admin/api/site-logo/route.ts'), /getPool|updateSiteLogoConfig|getSiteLogoConfig/u);
});

test('the new library is the only active logo editor and the old facades are absent', () => {
  for (const name of [
    'src/shared/server/siteLogo.ts', 'src/shared/server/siteLogoArtwork.ts',
    'src/shared/components/SiteLogoArtwork.tsx', 'src/admin/features/podoba/components/SiteLogoTextLayerControls.tsx'
  ]) assert.equal(existsSync(resolve(process.cwd(), name)), false, name);
  const editor = source('src/admin/features/podoba/components/AdminLogoPageClient.tsx');
  assert.match(editor, /logo-library/u);
  assert.match(editor, /LogoEditorCanvas/u);
  assert.match(editor, /LogoImageCropDialog/u);
  assert.doesNotMatch(editor, /api\/admin\/site-logo|SiteLogoTextLayerControls|uploadAdminPublicMedia/u);
  assert.match(source('src/admin/pages/podoba/logotip/page.tsx'), /getLogoLibrary/u);
});

test('public consumers use the published projection and metadata dimensions remain stable', () => {
  for (const name of [
    'src/commercial/components/SiteLogo.tsx', 'src/commercial/components/SiteHeader.tsx',
    'src/commercial/components/SiteFooter.tsx', 'src/app/api/site-logo/[purpose]/route.ts'
  ]) assert.doesNotMatch(source(name), /domain\/logo\/siteLogo|SiteLogoArtwork|getSiteLogoConfig|resolveCachedSiteLogoArtwork/u, name);
  for (const [purpose, dimensions] of Object.entries(LOGO_OUTPUT_DIMENSIONS)) {
    const legacy = SITE_LOGO_PURPOSE_CATALOG[purpose as keyof typeof SITE_LOGO_PURPOSE_CATALOG];
    assert.deepEqual(dimensions, { widthPx: legacy.widthPx, heightPx: legacy.heightPx });
  }
});
