import assert from 'node:assert/strict';
import test from 'node:test';
import {
  SITE_LOGO_CANVAS_EDGE_MAX,
  SITE_LOGO_CANVAS_EDGE_MIN,
  SITE_LOGO_CANVAS_MIN_SIZE_RATIO,
  SITE_LOGO_COLOR_CHANNEL_IDS,
  copySiteLogoPlacement,
  normalizeSiteLogoCanvasEdges,
  normalizeSiteLogoConfig,
  resolveSiteLogoCanvasEdges,
  resolveSiteLogoCanvasLayout,
  resolveSiteLogoTransparentColors,
  suggestSiteLogoPlacement,
  toStoredSiteLogoConfig,
  updateSiteLogoCanvasEdges,
  updateSiteLogoColorTransparency,
  validateSiteLogoConfigInput
} from '@/shared/domain/logo/siteLogo';

test('legacy logo presentations remain opaque and keep a source-sized canvas', () => {
  const legacy = normalizeSiteLogoConfig({
    version: 1,
    masters: [],
    placements: {
      'header-desktop': {
        presentation: {
          backgroundColor: '#102030',
          primaryTextColor: '#405060'
        }
      }
    }
  });
  const presentation = legacy.placements['header-desktop'].presentation;

  assert.deepEqual(presentation.canvasEdges, {});
  assert.deepEqual(presentation.transparentColors, {});
  assert.deepEqual(resolveSiteLogoTransparentColors(presentation.transparentColors), {
    background: false,
    taglineBackground: false,
    primary: false,
    secondary: false,
    tagline: false
  });
  assert.deepEqual(resolveSiteLogoCanvasLayout(1873, 840, presentation.canvasEdges), {
    width: 1873,
    height: 840,
    sourceLeft: 0,
    sourceTop: 0,
    sourceWidth: 1873,
    sourceHeight: 840,
    edges: { top: 0, right: 0, bottom: 0, left: 0 }
  });

  const reloaded = normalizeSiteLogoConfig(toStoredSiteLogoConfig(legacy));
  assert.deepEqual(reloaded.placements['header-desktop'].presentation, presentation);
});

test('canvas edges normalize hostile values, preserve a positive canvas, and round deterministically', () => {
  assert.deepEqual(normalizeSiteLogoCanvasEdges({
    top: Number.NaN,
    right: Number.POSITIVE_INFINITY,
    bottom: 0,
    left: -0
  }), {});

  assert.deepEqual(resolveSiteLogoCanvasEdges({
    top: SITE_LOGO_CANVAS_EDGE_MAX + 100,
    right: SITE_LOGO_CANVAS_EDGE_MAX + 100,
    bottom: SITE_LOGO_CANVAS_EDGE_MIN - 100,
    left: SITE_LOGO_CANVAS_EDGE_MIN - 100
  }), {
    top: SITE_LOGO_CANVAS_EDGE_MAX,
    right: SITE_LOGO_CANVAS_EDGE_MAX,
    bottom: SITE_LOGO_CANVAS_EDGE_MIN,
    left: SITE_LOGO_CANVAS_EDGE_MIN
  });

  const maximumCrop = resolveSiteLogoCanvasEdges({
    left: SITE_LOGO_CANVAS_EDGE_MIN,
    right: SITE_LOGO_CANVAS_EDGE_MIN,
    top: SITE_LOGO_CANVAS_EDGE_MIN,
    bottom: SITE_LOGO_CANVAS_EDGE_MIN
  });
  assert.ok(1 + maximumCrop.left + maximumCrop.right >= SITE_LOGO_CANVAS_MIN_SIZE_RATIO - Number.EPSILON);
  assert.ok(1 + maximumCrop.top + maximumCrop.bottom >= SITE_LOGO_CANVAS_MIN_SIZE_RATIO - Number.EPSILON);

  assert.deepEqual(resolveSiteLogoCanvasLayout(101, 79, {
    left: 0.25,
    right: 0.5,
    top: -0.25,
    bottom: 0.5
  }), {
    width: 177,
    height: 99,
    sourceLeft: 25,
    sourceTop: -20,
    sourceWidth: 101,
    sourceHeight: 79,
    edges: { top: -0.25, right: 0.5, bottom: 0.5, left: 0.25 }
  });
  assert.deepEqual(resolveSiteLogoCanvasLayout(Number.NaN, Number.POSITIVE_INFINITY, {}), {
    width: 1,
    height: 1,
    sourceLeft: 0,
    sourceTop: 0,
    sourceWidth: 1,
    sourceHeight: 1,
    edges: { top: 0, right: 0, bottom: 0, left: 0 }
  });
});

test('every transparency channel is independent, sparse, removable, and storage-safe', () => {
  for (const channel of SITE_LOGO_COLOR_CHANNEL_IDS) {
    let config = normalizeSiteLogoConfig({ masters: [], placements: {} });
    config = updateSiteLogoColorTransparency(config, 'header-desktop', channel, true);

    const resolved = resolveSiteLogoTransparentColors(
      config.placements['header-desktop'].presentation.transparentColors
    );
    for (const candidate of SITE_LOGO_COLOR_CHANNEL_IDS) {
      assert.equal(resolved[candidate], candidate === channel, `${channel} changed ${candidate}`);
    }
    assert.deepEqual(
      normalizeSiteLogoConfig(toStoredSiteLogoConfig(config))
        .placements['header-desktop'].presentation.transparentColors,
      { [channel]: true }
    );

    config = updateSiteLogoColorTransparency(config, 'header-desktop', channel, false);
    assert.deepEqual(config.placements['header-desktop'].presentation.transparentColors, {});
  }
});

test('presentation copy and suggestion carry canvas edges and transparency without aliasing target geometry', () => {
  let config = normalizeSiteLogoConfig({ masters: [], placements: {} });
  config = updateSiteLogoCanvasEdges(config, 'header-desktop', {
    top: 0.2,
    right: -0.15,
    bottom: 0.4,
    left: -0.1
  });
  config = updateSiteLogoColorTransparency(config, 'header-desktop', 'background', true);
  config = updateSiteLogoColorTransparency(config, 'header-desktop', 'secondary', true);
  const targetSuggestion = structuredClone(config.placements['pdf-document'].suggestion);

  const suggestion = suggestSiteLogoPlacement(config, 'header-desktop', 'pdf-document');
  assert.deepEqual(suggestion.presentation.canvasEdges, {
    top: 0.2,
    right: -0.15,
    bottom: 0.4,
    left: -0.1
  });
  assert.deepEqual(suggestion.presentation.transparentColors, {
    background: true,
    secondary: true
  });
  assert.deepEqual(suggestion.suggestion, targetSuggestion);

  const copied = copySiteLogoPlacement(config, 'header-desktop', 'pdf-document');
  assert.deepEqual(copied.placements['pdf-document'].presentation, suggestion.presentation);
  assert.deepEqual(copied.placements['pdf-document'].suggestion, targetSuggestion);
  copied.placements['pdf-document'].presentation.canvasEdges.top = 1;
  assert.equal(config.placements['header-desktop'].presentation.canvasEdges.top, 0.2);
});

test('strict configuration validation rejects malformed edges and transparency flags', () => {
  const invalid = toStoredSiteLogoConfig(normalizeSiteLogoConfig({ masters: [], placements: {} })) as unknown as {
    placements: Record<string, { presentation: Record<string, unknown> }>;
  };
  invalid.placements['header-desktop'].presentation.canvasEdges = {
    top: '0.2',
    left: SITE_LOGO_CANVAS_EDGE_MIN,
    right: SITE_LOGO_CANVAS_EDGE_MIN
  };
  invalid.placements['header-desktop'].presentation.transparentColors = {
    background: 'true',
    primary: 1
  };

  const errors = validateSiteLogoConfigInput(invalid);
  assert.ok(errors.some((message) => message.includes('Rob platna top')));
  assert.ok(errors.some((message) => message.includes('Vodoravni izrez platna')));
  assert.ok(errors.some((message) => message.includes('Prosojnost barve background')));
  assert.ok(errors.some((message) => message.includes('Prosojnost barve primary')));
});
