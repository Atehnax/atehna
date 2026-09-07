import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import { GET, PUT } from '@/admin/api/site-logo/route';
import { LOGO_OUTPUT_DIMENSIONS } from '@/shared/domain/logo/logoOutputDimensions';

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
  assert.deepEqual(LOGO_OUTPUT_DIMENSIONS, {
    'header-desktop': { widthPx: 176, heightPx: 48 },
    'header-tablet': { widthPx: 144, heightPx: 44 },
    'header-mobile': { widthPx: 112, heightPx: 40 },
    'footer-desktop': { widthPx: 176, heightPx: 56 },
    'footer-tablet': { widthPx: 160, heightPx: 52 },
    'footer-mobile': { widthPx: 144, heightPx: 48 },
    standalone: { widthPx: 512, heightPx: 230 },
    'pdf-document': { widthPx: 946, heightPx: 300 },
    favicon: { widthPx: 48, heightPx: 48 },
    'apple-touch-icon': { widthPx: 180, heightPx: 180 },
    'pwa-maskable': { widthPx: 512, heightPx: 512 },
    'social-share': { widthPx: 1200, heightPx: 630 }
  });
});
