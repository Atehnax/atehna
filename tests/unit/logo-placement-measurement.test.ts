import assert from 'node:assert/strict';
import test from 'node:test';
import { measureLogoPlacementImage } from '@/admin/features/podoba/lib/logoPlacementMeasurement';
import { resizeHeaderLogo, resolveHeaderLogoSize } from '@/shared/domain/logo/logoPlacement';
import { cloneDefaultSiteNavigationConfig } from '@/shared/domain/navigation/siteNavigation';
import { publishedLogoAsset } from './fixtures/published-site-logo';

const close = (actual: number, expected: number) => assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} != ${expected}`);

test('cropped header overlay follows the visible32px ink window at half preview zoom', () => {
  const asset = { ...publishedLogoAsset('padded', 640, 240), bounds: { x: 203, y: 81, width: 217, height: 47 } };
  const layout = resizeHeaderLogo(cloneDefaultSiteNavigationConfig().topBarLayout.responsive.desktop, asset);
  const fitted = resolveHeaderLogoSize('desktop', layout, asset);
  const zoom = .5;
  const measured = measureLogoPlacementImage({ x: 20, y: 8, width: fitted.widthPx * zoom, height: fitted.heightPx * zoom }, fitted.sourceBounds, asset.bounds);
  close(measured.artwork.x, 20); close(measured.artwork.y, 8);
  close(measured.artwork.height / zoom, 32);
  close(measured.artwork.width / zoom, 217 * 32 / 47);
  close(measured.sourceScale / zoom, 32 / 47);
  assert.deepEqual(measured.artwork, measured.image);
});

test('full-canvas header overlays retain the original transparent margins and source scale', () => {
  const asset = { ...publishedLogoAsset('padded', 640, 240), bounds: { x: 203, y: 81, width: 217, height: 47 } };
  const fitted = resolveHeaderLogoSize('desktop', cloneDefaultSiteNavigationConfig().topBarLayout.responsive.desktop, asset);
  const measured = measureLogoPlacementImage({ x: 10, y: 15, width: fitted.widthPx, height: fitted.heightPx }, fitted.sourceBounds, asset.bounds);
  close(measured.artwork.x, 10 + 203 * fitted.scale);
  close(measured.artwork.y, 15 + 81 * fitted.scale);
  close(measured.artwork.width, 217 * fitted.scale);
  close(measured.artwork.height, 47 * fitted.scale);
  close(measured.sourceScale, fitted.scale);
});

test('footer and standalone containment still center the full canvas in a differently shaped area', () => {
  const source = { x: 0, y: 0, width: 640, height: 240 };
  const artwork = { x: 60, y: 24, width: 480, height: 192 };
  const before = structuredClone({ source, artwork });
  const measured = measureLogoPlacementImage({ x: 10, y: 20, width: 320, height: 240 }, source, artwork);
  assert.deepEqual(measured.image, { x: 10, y: 80, width: 320, height: 120 });
  assert.deepEqual(measured.artwork, { x: 40, y: 92, width: 240, height: 96 });
  assert.equal(measured.sourceScale, .5);
  assert.deepEqual({ source, artwork }, before);
});
