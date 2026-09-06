import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import sharp from 'sharp';
import { createLogoBrandFallback } from '@/shared/server/logoBrandFallback';

// RGBA baselines captured from the public production outputs before the library cutover.
const baselines = [
  { purpose: 'header-desktop', width: 176, height: 48, hash: '2972a487a19d8796eca345928aeaa21c66ce3bd67c8a8c09c32aa7427ca2b3a5' },
  { purpose: 'favicon', width: 48, height: 48, hash: '22b2d39250db8ca69fae5a9b3f9fa46e35c6c1c9eca3f5b334737c2c9cdde8dc' },
  { purpose: 'social-share', width: 1200, height: 630, hash: '22ed9525670bbebab823c01ff1662b10b4dd93ce77e9cc8e59879ec6e0a7bb65' }
] as const;
for (const baseline of baselines) test('public ' + baseline.purpose + ' fallback preserves deployed pixels', async () => {
  const response = createLogoBrandFallback(baseline.purpose, { 'Cache-Control': 'public, max-age=0, must-revalidate' });
  const bytes = Buffer.from(await response.arrayBuffer());
  const { data, info } = await sharp(bytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  assert.equal(info.width, baseline.width);
  assert.equal(info.height, baseline.height);
  assert.equal(createHash('sha256').update(data).digest('hex'), baseline.hash);
});
