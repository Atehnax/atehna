import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import {
  SITE_LOGO_TEXT_ALIGNMENTS,
  cloneDefaultSiteLogoConfig,
  mapSiteLogoCanvasDeltaToSource,
  mapSiteLogoCanvasPointToSource,
  mapSiteLogoSourcePointToCanvas,
  normalizeSiteLogoConfig,
  resolveSiteLogoCanvasLayout,
  toStoredSiteLogoConfig,
  updateSiteLogoTextLayer,
  validateSiteLogoConfigInput
} from '@/shared/domain/logo/siteLogo';

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

test('source/canvas point and drag mappings remain exact under simultaneous crop and extension', () => {
  const layout = resolveSiteLogoCanvasLayout(200, 100, {
    left: 0.5,
    right: -0.25,
    top: -0.2,
    bottom: 0.3
  });
  assert.deepEqual(layout, {
    width: 250,
    height: 110,
    sourceLeft: 100,
    sourceTop: -20,
    sourceWidth: 200,
    sourceHeight: 100,
    edges: { top: -0.2, right: -0.25, bottom: 0.3, left: 0.5 }
  });

  const sourcePoint = { x: 0.25, y: 0.75 };
  const canvasPoint = mapSiteLogoSourcePointToCanvas(layout, sourcePoint);
  assert.deepEqual(canvasPoint, { x: 0.6, y: 0.5 });
  assert.deepEqual(mapSiteLogoCanvasPointToSource(layout, canvasPoint), sourcePoint);
  assert.deepEqual(
    mapSiteLogoCanvasDeltaToSource(layout, { x: 0.1, y: 0.2 }),
    { x: 0.125, y: 0.22 }
  );
});

test('editable logo text alignment defaults safely and round-trips every supported value', () => {
  const legacy = normalizeSiteLogoConfig({
    masters: [],
    placements: {
      'header-desktop': {
        presentation: {
          secondaryText: { content: 'd.o.o.' }
        }
      }
    }
  });
  assert.equal(legacy.placements['header-desktop'].presentation.secondaryText.textAlign, 'left');

  for (const textAlign of SITE_LOGO_TEXT_ALIGNMENTS) {
    const updated = updateSiteLogoTextLayer(
      cloneDefaultSiteLogoConfig(),
      'header-desktop',
      'secondaryText',
      { textAlign }
    );
    const reloaded = normalizeSiteLogoConfig(toStoredSiteLogoConfig(updated));
    assert.equal(
      reloaded.placements['header-desktop'].presentation.secondaryText.textAlign,
      textAlign
    );
    assert.deepEqual(validateSiteLogoConfigInput(reloaded), []);
  }
});

test('strict validation rejects malformed logo text alignment instead of silently persisting it', () => {
  const malformed = toStoredSiteLogoConfig(cloneDefaultSiteLogoConfig()) as unknown as {
    placements: Record<string, { presentation: { secondaryText: Record<string, unknown> } }>;
  };
  malformed.placements['header-desktop'].presentation.secondaryText.textAlign = 'justify';

  const errors = validateSiteLogoConfigInput(malformed);
  assert.ok(
    errors.some((message) => message.includes('Poravnava besedilne plasti secondaryText')),
    errors.join(' | ')
  );
  assert.equal(
    normalizeSiteLogoConfig(malformed).placements['header-desktop'].presentation.secondaryText.textAlign,
    'left'
  );
});

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
