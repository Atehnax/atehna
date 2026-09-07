import assert from 'node:assert/strict';

import { readFileSync } from 'node:fs';

import { resolve } from 'node:path';

import test from 'node:test';

const editorSource = readFileSync(
  resolve(process.cwd(), 'src/admin/features/podoba/components/LogoEditorCanvas.tsx'),
  'utf8'
);

const controlsSource = readFileSync(
  resolve(process.cwd(), 'src/admin/features/podoba/components/LogoEditorProperties.tsx'),
  'utf8'
);

const clientArtworkSource = readFileSync(
  resolve(process.cwd(), 'src/admin/features/podoba/components/LogoEditorCanvas.tsx'),
  'utf8'
);

const serverArtworkSource = readFileSync(
  resolve(process.cwd(), 'src/shared/server/logoLibraryRender.ts'),
  'utf8'
);

test('logo hit targets and drag deltas follow the current layer coordinates and normalized crop', () => {
  assert.match(editorSource, /data-logo-selectable/u);
  assert.match(editorSource, /layer\.x = event\.beforeTranslate\[0\]/u);
  assert.match(editorSource, /layer\.y = event\.beforeTranslate\[1\]/u);
  assert.match(editorSource, /-crop\.x \* layer\.width \/ crop\.width/u);
  assert.match(editorSource, /-crop\.y \* layer\.height \/ crop\.height/u);
  assert.match(editorSource, /transformOrigin: 'center'/u);
});

test('alignment is accessible and both editable and export renderers consume it', () => {
  assert.match(controlsSource, /aria-label="Poravnava besedila"/u);
  for (const value of ['left', 'center', 'right']) assert.ok(controlsSource.includes('value="' + value + '"'));
  assert.match(clientArtworkSource, /textAnchor=\{layer\.textAlign === 'center'/u);
  assert.match(serverArtworkSource, /layer\.textAlign === 'center'/u);
  assert.match(serverArtworkSource, /layer\.textAlign === 'right'/u);
});
