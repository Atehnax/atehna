import assert from 'node:assert/strict';

import { readFileSync } from 'node:fs';

import { resolve } from 'node:path';

import test from 'node:test';

import { blankLogoProject } from '@/shared/domain/logo/logoLibrary';

import { validateLogoProject } from '@/shared/domain/logo/logoProject';

const logoEditorSource = readFileSync(
  resolve(process.cwd(), 'src/admin/features/podoba/components/AdminLogoPageClient.tsx'),
  'utf8'
);

const documentEditorSource = readFileSync(
  resolve(process.cwd(), 'src/admin/features/urejevalnik/components/OrderDocumentTemplateCanvas.tsx'),
  'utf8'
);

const sharedTextControlsSource = readFileSync(
  resolve(process.cwd(), 'src/admin/features/podoba/components/LogoEditorProperties.tsx'),
  'utf8'
);

const clientArtworkSource = readFileSync(
  resolve(process.cwd(), 'src/admin/features/podoba/components/LogoEditorCanvas.tsx'),
  'utf8'
);

test('the logo workspace edits arbitrary text layers through the selected-layer inspector', () => {
  assert.match(logoEditorSource, /addLayer\(kind: 'text'/u);
  assert.match(logoEditorSource, /<LogoEditorProperties/u);
  assert.match(clientArtworkSource, /data-logo-selectable/u);
  for (const field of ['text', 'fontFamily', 'fontSize', 'fontStyle', 'fontWeight', 'letterSpacing']) assert.ok(sharedTextControlsSource.includes('layer.' + field), field);
  assert.match(sharedTextControlsSource, /aria-label="Vsebina besedila"/u);
  assert.match(sharedTextControlsSource, /item\.visible = !item\.visible|target\.visible = !target\.visible/u);
  assert.match(sharedTextControlsSource, /onDelete/u);
  assert.doesNotMatch(logoEditorSource, /secondaryText|taglineText|SiteLogoTextLayerControls/u);
});

test('logo text drafts retain spaces and commit only through the explicit library save', () => {
  const project = blankLogoProject();
  project.layers.push({ id: 'text', name: 'Text', type: 'text', x: 0, y: 0, width: 600, height: 100, rotation: 0, opacity: 1, visible: true, locked: false,
    text: '  varčevanje z energijo  ', fontFamily: 'Inter', fontSize: 24, fontWeight: 400, fontStyle: 'normal', fill: '#000000', textAlign: 'left', lineHeight: 1.2, letterSpacing: 0 });
  const saved = validateLogoProject(JSON.parse(JSON.stringify(project)));
  assert.equal(saved.layers[0].type === 'text' && saved.layers[0].text, '  varčevanje z energijo  ');
  assert.match(sharedTextControlsSource, /value=\{layer\.text\}/u);
  assert.match(sharedTextControlsSource, /item\.text = event\.target\.value/u);
  assert.match(logoEditorSource, /async function saveWorking/u);
  assert.match(logoEditorSource, /action: 'save'/u);
  assert.doesNotMatch(sharedTextControlsSource, /fetch\(/u);
});

test('Urejevalnik selects the shared published PDF logo and links editing to the library', () => {
  assert.match(documentEditorSource, /LogoPlacementSelector/u);
  assert.match(documentEditorSource, /purpose="pdf-document"/u);
  assert.match(documentEditorSource, /objavljeno različico iz knjižnice/u);
  assert.match(documentEditorSource, /Sloje in besedilo urejate v urejevalniku logotipa/u);
  assert.doesNotMatch(documentEditorSource, /SiteLogoTextLayerManager|api\/admin\/site-logo/u);
  for (const field of ['fontFamily', 'fontSize', 'fontStyle', 'fontWeight', 'letterSpacing']) assert.ok(sharedTextControlsSource.includes(field), field);
});

test('the current logo client renders arbitrary text layers without legacy masks', () => {
  assert.match(clientArtworkSource, /layer\.type === 'text'/u);
  assert.doesNotMatch(clientArtworkSource, /SITE_LOGO_BUILTIN_MASK_URLS|secondaryText|taglineText/u);
});

test('canvas zoom scales geometry and visual effects together without inferred style scaling', () => {
  assert.match(clientArtworkSource, /transform: `scale\(\$\{zoom\}\)`/u);
  assert.match(clientArtworkSource, /layer\.shadow\.offsetX/u);
  assert.match(clientArtworkSource, /layer\.shadow\.blur \/ 2/u);
  assert.doesNotMatch(clientArtworkSource, /effectScaleInput|typeof style\?\.width/u);
});
