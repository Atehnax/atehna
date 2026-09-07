import assert from 'node:assert/strict';

import { readFileSync } from 'node:fs';

import { resolve } from 'node:path';

import test from 'node:test';

const adminLogoSource = readFileSync(resolve(
  process.cwd(),
  'src/admin/features/podoba/components/AdminLogoPageClient.tsx'
), 'utf8');

const clientArtworkSource = readFileSync(resolve(
  process.cwd(),
  'src/admin/features/podoba/components/LogoEditorCanvas.tsx'
), 'utf8');

test('uploaded artwork stays a source image layer and exposes crop, masks and shared placement measurement', () => {
  assert.match(adminLogoSource, /api\/admin\/logo-library\/assets/u);
  assert.match(adminLogoSource, /result\.asset\.id/u);
  assert.match(adminLogoSource, /<LogoPlacementPreview/u);
  assert.match(clientArtworkSource, /asset\.url/u);
  assert.match(clientArtworkSource, /layer\.mask === 'ellipse'/u);
  assert.match(clientArtworkSource, /crop\.width/u);
  const properties = readFileSync(resolve(process.cwd(), 'src/admin/features/podoba/components/LogoEditorProperties.tsx'), 'utf8');
  assert.match(properties, /Vdelano besedilo ni ločeno urejljivo/u);
  assert.match(properties, /Zamenjaj sliko/u);
  assert.match(properties, /Izreži sliko/u);
  const preview = readFileSync(resolve(process.cwd(), 'src/admin/features/podoba/components/LogoPlacementPreview.tsx'), 'utf8');
  assert.match(preview, /getBoundingClientRect\(\)/u);
  assert.match(preview, /asset\.bounds/u);
});
