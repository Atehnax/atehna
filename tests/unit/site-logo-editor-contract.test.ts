import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const source = (name: string) => readFileSync(resolve(process.cwd(), name), 'utf8');
const component = (name: string) => source('src/admin/features/podoba/components/' + name);
const editor = component('AdminLogoPageClient.tsx');
const canvas = component('LogoEditorCanvas.tsx');
const properties = component('LogoEditorProperties.tsx');
const crop = component('LogoImageCropDialog.tsx');
const placements = component('LogoPlacementSelector.tsx');

test('the primary logo editor provides a canvas, independent variants and placement contexts', () => {
  for (const marker of ['LogoEditorCanvas', 'LogoEditorProperties', 'LogoPlacementPreview', 'LogoPlacementSelector', 'library.variants', 'LOGO_PLACEMENT_IDS']) assert.ok(editor.includes(marker), marker);
  assert.doesNotMatch(editor, /SITE_LOGO_PRIMARY_USE_CASE_IDS|masterId|SiteLogoTextLayerControls/u);
});
test('logo previews and PDF documents use rendered library output', () => {
  assert.match(editor, /action: 'preview'/u);
  assert.match(editor, /currentPreview/u);
  const document = source('src/shared/server/documentLogo.ts');
  assert.match(document, /publishedLogoProjection/u);
  assert.match(document, /readLogoPublishedOutput\(revision\.png2x\)/u);
});
test('layer typography, color and effect controls remain reachable', () => {
  for (const field of ['fontFamily', 'fontSize', 'fontStyle', 'fontWeight', 'letterSpacing', 'lineHeight', 'fill', 'strokeWidth', 'shadow.color', 'shadow.opacity', 'shadow.blur', 'shadow.offsetX', 'shadow.offsetY']) assert.ok(properties.includes(field), field);
  assert.match(properties, /fieldset disabled=\{locked\}/u);
});
test('header placement size remains a navigation constraint in visible pixels', () => {
  assert.match(source('src/admin/features/podoba/components/AdminNavigationPageClient.tsx'), /logoHeightPx/u);
  assert.match(source('src/shared/domain/logo/logoPlacement.ts'), /resolveHeaderLogoSize/u);
  assert.doesNotMatch(editor, /displayHeightPx|SITE_LOGO_HEADER_DISPLAY_HEIGHT/u);
});
test('placement selection offers explicit original, brand and hidden fallbacks', () => {
  for (const fallback of ['original', 'brand', 'none', 'default']) assert.ok(placements.includes('fallback:' + fallback), fallback);
  assert.match(placements, /disabled=\{!candidate\.published\}/u);
});
test('empty canvases stay empty and selection controls live outside clipped artwork', () => {
  assert.match(canvas, /!project\.layers\.length/u);
  assert.match(canvas, /<Moveable/u);
  assert.ok(canvas.indexOf('<Moveable ref=') > canvas.indexOf('className={styles.canvasArtwork}'));
  assert.match(source('src/shared/domain/logo/publishedLogo.ts'), /selected\.fallback === 'none'\) return null/u);
});
test('placement previews reuse real storefront components and device constraints', () => {
  const preview = component('LogoPlacementPreview.tsx');
  for (const marker of ['<SiteHeader', '<SiteFooter', 'COMMERCIAL_STOREFRONT_SCALE', 'resolveHeaderLogoSize', 'getBoundingClientRect']) assert.ok(preview.includes(marker), marker);
});
test('canvas interactions expose direct move, resize, rotation and reversible crop', () => {
  assert.match(canvas, /draggable resizable rotatable/u);
  assert.match(canvas, /onDragGroup=/u);
  assert.match(canvas, /onResizeGroup=/u);
  assert.match(canvas, /onRotateGroup=/u);
  assert.match(editor, /<LogoImageCropDialog/u);
});
test('crop handles and numeric geometry support keyboard access', () => {
  assert.match(crop, /aria-label=\{'Izrez: '/u);
  assert.match(crop, /onPointerDown=/u);
  assert.match(crop, /onKeyDown=/u);
  for (const key of ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown']) assert.ok(crop.includes(key), key);
  assert.match(properties, /LogoNumber label="Širina sloja"/u);
  assert.match(properties, /LogoNumber label="Višina sloja"/u);
});
test('crop edits normalized coordinates while retaining the original source', () => {
  assert.match(crop, /onApply\(\{ \.\.\.crop \}\)/u);
  assert.match(crop, /setLogoCropPixels\(current, 'width'/u);
  assert.match(crop, /unit="px"/u);
  assert.match(crop, /src=\{asset\.url\}/u);
  assert.doesNotMatch(crop, /fetch\(|PUT|upload|writeFile/u);
  assert.match(properties, /layer\.crop = nextCrop/u);
});
test('editor settings and crop dialogs stay bounded to the viewport', () => {
  const css = component('LogoEditor.module.css');
  assert.match(css, /\.dialog[^}]*max-height:90vh/u);
  assert.match(css, /\.editorBody[^}]*minmax\(0,1fr\)/u);
  assert.match(css, /@media\(max-width:760px\)/u);
  assert.match(editor, /requestFullscreen/u);
});
test('opening another variant loads its own draft and clears selection and undo history', () => {
  const open = editor.slice(editor.indexOf('function openVariant'), editor.indexOf('async function saveWorking'));
  assert.match(open, /cloneLogoProject\(variant\.draft\)/u);
  assert.match(open, /setSelected\(\[\]\)/u);
  assert.match(open, /history\.current = \{ past: \[\], future: \[\], gesture: null \}/u);
});
test('transparent canvas, source trimming and independent layer opacity remain editable', () => {
  assert.match(editor, /trimLogoCanvas/u);
  assert.match(editor, /Ozadje platna/u);
  assert.match(properties, /Prosojnost \(%\)/u);
  assert.match(properties, /Odstrani prosojne robove slike/u);
  assert.match(properties, /Obnovi celotno sliko/u);
});
test('alignment is explicit, labeled and supports both canvas and selected layers', () => {
  assert.match(editor, /aria-label="Poravnava glede na"/u);
  assert.match(editor, /value="canvas"/u);
  assert.match(editor, /value="selection"/u);
  for (const label of ['Poravnaj levo', 'Poravnaj desno', 'Poravnaj zgoraj', 'Poravnaj spodaj', 'Enakomerno razporedi vodoravno', 'Enakomerno razporedi navpično']) assert.ok(editor.includes(label), label);
});
test('shared placement changes are explicit and retain separate editable projects', () => {
  assert.match(placements, /async function apply\(/u);
  assert.match(placements, /action: 'assign'/u);
  assert.match(placements, /placements: \{ \[purpose\]: selectedAssignment \}/u);
  assert.match(placements, /expectedRevision: library\.revision/u);
  assert.match(editor, /action: 'create'/u);
  const createCopy = editor.slice(editor.indexOf('function beginCreate'), editor.indexOf('function copySelection'));
  assert.match(createCopy, /cloneLogoProject/u);
  assert.doesNotMatch(createCopy, /saveWorking\(|request\(/u);
  assert.doesNotMatch(placements, /action: 'save'|copySiteLogoPlacement/u);
});
