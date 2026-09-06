import assert from 'node:assert/strict';
import test from 'node:test';
import { logoPlacementGuidance } from '@/admin/features/podoba/lib/logoPlacementGuidance';
import type { LogoImageLayer, LogoProject, LogoSourceAsset } from '@/shared/domain/logo/logoLibrary';

const source: LogoSourceAsset = { id: 'source', name: 'Image', url: '/source.png', pathname: 'source.png', mimeType: 'image/png', width: 100, height: 50, bytes: 100, bounds: { x: 0, y: 0, width: 100, height: 50 }, warnings: [] };
const layer: LogoImageLayer = { id: 'image', name: 'Image', type: 'image', assetId: 'source', x: 0, y: 0, width: 200, height: 100, rotation: 0, opacity: 1, visible: true, locked: false, mask: 'rectangle', crop: { x: 0, y: 0, width: 1, height: 1 } };
const project = (image = layer): LogoProject => ({ version: 1, canvas: { width: 200, height: 100 }, layers: [image] });

test('placement warnings measure original raster pixels despite the composition being exported as SVG', () => {
  assert.equal(logoPlacementGuidance(project(), [source], .5).rasterUpscaled, false);
  assert.equal(logoPlacementGuidance(project(), [source], .75).rasterUpscaled, true);
});

test('cropping reduces usable source pixels before evaluating the displayed size', () => {
  const cropped = { ...layer, crop: { x: .25, y: .25, width: .5, height: .5 } };
  assert.equal(logoPlacementGuidance(project(cropped), [source], .25).rasterUpscaled, false);
  assert.equal(logoPlacementGuidance(project(cropped), [source], .5).rasterUpscaled, true);
});

test('hidden groups do not cause raster or tiny-text warnings', () => {
  const hidden: LogoProject = { ...project(), layers: [{ ...layer, type: 'group', visible: false, children: [layer, { ...layer, type: 'text', text: 'Small', fontFamily: 'Inter', fontSize: 5, fontWeight: 400, fontStyle: 'normal', fill: '#000000', textAlign: 'left', lineHeight: 1.2, letterSpacing: 0 }] }] };
  assert.deepEqual(logoPlacementGuidance(hidden, [source], 2), { tinyText: false, rasterUpscaled: false, embeddedRasterSvg: false });
});

test('pure vector sources stay scalable while SVGs with embedded raster get explicit guidance', () => {
  const vector = { ...source, mimeType: 'image/svg+xml' as const };
  assert.deepEqual(logoPlacementGuidance(project(), [vector], 10), { tinyText: false, rasterUpscaled: false, embeddedRasterSvg: false });
  assert.equal(logoPlacementGuidance(project(), [{ ...vector, warnings: ['SVG vsebuje vdelane rastrske slike.'] }], .5).embeddedRasterSvg, true);
});
