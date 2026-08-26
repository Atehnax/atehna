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
  resolve(process.cwd(), 'src/admin/features/podoba/components/AdminLogoPageClient.tsx'),
  'utf8'
);
const controlsSource = readFileSync(
  resolve(process.cwd(), 'src/admin/features/podoba/components/SiteLogoTextLayerControls.tsx'),
  'utf8'
);
const clientArtworkSource = readFileSync(
  resolve(process.cwd(), 'src/shared/components/SiteLogoArtwork.tsx'),
  'utf8'
);
const serverArtworkSource = readFileSync(
  resolve(process.cwd(), 'src/shared/server/siteLogoArtworkCore.ts'),
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

test('logo target hitboxes and drag deltas use the source frame when the canvas is cropped or extended', () => {
  assert.match(editorSource, /resolveSiteLogoCanvasLayout/u);
  assert.match(editorSource, /mapSiteLogoSourcePointToCanvas/u);
  assert.match(editorSource, /mapSiteLogoCanvasDeltaToSource/u);
  assert.match(
    editorSource,
    /layer\.textAlign === 'center'[\s\S]{0,160}layer\.textAlign === 'right'/u
  );
  assert.match(
    editorSource,
    /mapSiteLogoSourcePointToCanvas\([\s\S]{0,500}(?:layer\.x|anchored)/u
  );
  assert.match(
    editorSource,
    /mapSiteLogoCanvasDeltaToSource\([\s\S]{0,700}(?:clientX|canvasDelta)/u
  );
});

test('alignment is exposed as an accessible control and has client/server rendering parity', () => {
  assert.match(controlsSource, /data-logo-text-control="textAlign"/u);
  assert.match(controlsSource, /AppearanceEditorAlignmentControl/u);
  assert.match(controlsSource, /options=\{\['left', 'center', 'right'\] as const\}/u);

  assert.match(clientArtworkSource, /layer\.textAlign === 'center' \? 0\.5/u);
  assert.match(clientArtworkSource, /layer\.textAlign === 'right' \? 1/u);
  assert.match(clientArtworkSource, /textAnchor=\{layer\.textAlign === 'center'/u);
  assert.match(serverArtworkSource, /layer\.textAlign === 'center' \? 0\.5/u);
  assert.match(serverArtworkSource, /layer\.textAlign === 'right' \? 1/u);
});
