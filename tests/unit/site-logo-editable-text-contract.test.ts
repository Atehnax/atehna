import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import {
  DEFAULT_SITE_LOGO_PRESENTATION,
  cloneDefaultSiteLogoConfig,
  copySiteLogoPlacement,
  normalizeSiteLogoConfig,
  resetSiteLogoTextLayer,
  resolveSiteLogoPresentation,
  sanitizeSiteLogoTextContent,
  toStoredSiteLogoConfig,
  updateSiteLogoTextLayer,
  validateSiteLogoConfigInput
} from '@/shared/domain/logo/siteLogo';

const logoEditorSource = readFileSync(
  resolve(process.cwd(), 'src/admin/features/podoba/components/AdminLogoPageClient.tsx'),
  'utf8'
);
const documentEditorSource = readFileSync(
  resolve(process.cwd(), 'src/admin/features/urejevalnik/components/OrderDocumentTemplateCanvas.tsx'),
  'utf8'
);
const sharedTextControlsSource = readFileSync(
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

test('legacy logo settings gain independent authentic suffix and tagline layers', () => {
  const normalized = normalizeSiteLogoConfig({ masters: [], placements: {} });
  const presentation = normalized.placements['pdf-document'].presentation;

  assert.deepEqual(presentation.secondaryText, {
    enabled: true,
    content: 'd.o.o.',
    x: 1603 / 1873,
    y: 334 / 840,
    fontFamily: 'Barlow',
    fontSizePx: 56,
    fontStyle: 'italic',
    fontWeight: 400,
    letterSpacingPx: 0,
    textAlign: 'left'
  });
  assert.deepEqual(presentation.taglineText, {
    enabled: true,
    content: 'varčevanje z energijo',
    x: 100 / 1873,
    y: 518 / 840,
    fontFamily: 'Noto Sans',
    fontSizePx: 98,
    fontStyle: 'normal',
    fontWeight: 400,
    letterSpacingPx: 36,
    textAlign: 'left'
  });
  assert.deepEqual(presentation, DEFAULT_SITE_LOGO_PRESENTATION);
});

test('editable logo text content, visibility, position, and typography round-trip safely', () => {
  const config = cloneDefaultSiteLogoConfig();
  config.placements['pdf-document'].presentation.secondaryText = {
    enabled: false,
    content: 'podjetje',
    x: -0.2,
    y: 1.25,
    fontFamily: 'Noto Sans',
    fontSizePx: 112,
    fontStyle: 'normal',
    fontWeight: 700,
    letterSpacingPx: 8,
    textAlign: 'right'
  };
  config.placements['pdf-document'].presentation.taglineText = {
    enabled: true,
    content: 'znanje ustvarja prihodnost',
    x: 0.08,
    y: 0.71,
    fontFamily: 'Barlow',
    fontSizePx: 74,
    fontStyle: 'italic',
    fontWeight: 500,
    letterSpacingPx: 12,
    textAlign: 'center'
  };

  const stored = toStoredSiteLogoConfig(config);
  const reloaded = normalizeSiteLogoConfig(stored);
  assert.deepEqual(
    reloaded.placements['pdf-document'].presentation.secondaryText,
    config.placements['pdf-document'].presentation.secondaryText
  );
  assert.deepEqual(
    reloaded.placements['pdf-document'].presentation.taglineText,
    config.placements['pdf-document'].presentation.taglineText
  );
  assert.deepEqual(validateSiteLogoConfigInput(reloaded), []);
});

test('logo text normalization rejects unsafe values and validation catches malformed stored input', () => {
  const normalized = normalizeSiteLogoConfig({
    masters: [],
    placements: {
      'pdf-document': {
        presentation: {
          secondaryText: {
            enabled: 'yes',
            content: `  ${'x'.repeat(220)}\u0000  `,
            x: -50,
            y: 50,
            fontFamily: 'Comic Sans',
            fontSizePx: 9999,
            fontStyle: 'oblique',
            fontWeight: 950,
            letterSpacingPx: 999
          }
        }
      }
    }
  });
  const secondary = normalized.placements['pdf-document'].presentation.secondaryText;
  assert.equal(secondary.enabled, true);
  assert.ok(secondary.content.length <= 180);
  assert.doesNotMatch(secondary.content, /[\u0000-\u001F\u007F]/u);
  assert.equal(secondary.x, -1);
  assert.equal(secondary.y, 2);
  assert.equal(secondary.fontFamily, 'Barlow');
  assert.equal(secondary.fontSizePx, 420);
  assert.equal(secondary.fontStyle, 'italic');
  assert.equal(secondary.fontWeight, 400);
  assert.equal(secondary.letterSpacingPx, 128);

  const malformed = structuredClone(cloneDefaultSiteLogoConfig()) as unknown as {
    placements: Record<string, { presentation: { secondaryText: Record<string, unknown> } }>;
  };
  Object.assign(malformed.placements['pdf-document']!.presentation.secondaryText, {
    content: 'x'.repeat(181),
    x: 3,
    fontFamily: 'Comic Sans',
    fontSizePx: 421
  });
  const errors = validateSiteLogoConfigInput(malformed);
  assert.ok(errors.length >= 4, `Expected independent text validation errors, received: ${errors.join(' | ')}`);
});

test('legacy text layers may omit alignment while present invalid alignment still fails', () => {
  const legacy = toStoredSiteLogoConfig(cloneDefaultSiteLogoConfig()) as unknown as {
    placements: Record<string, {
      presentation: {
        secondaryText: Record<string, unknown>;
        taglineText: Record<string, unknown>;
      };
    }>;
  };
  delete legacy.placements['pdf-document']!.presentation.secondaryText.textAlign;
  delete legacy.placements['pdf-document']!.presentation.taglineText.textAlign;

  assert.deepEqual(validateSiteLogoConfigInput(legacy), []);
  const normalized = normalizeSiteLogoConfig(legacy);
  assert.equal(normalized.placements['pdf-document'].presentation.secondaryText.textAlign, 'left');
  assert.equal(normalized.placements['pdf-document'].presentation.taglineText.textAlign, 'left');

  legacy.placements['pdf-document']!.presentation.secondaryText.textAlign = 'justify';
  assert.match(
    validateSiteLogoConfigInput(legacy).join(' | '),
    /Poravnava besedilne plasti secondaryText/u
  );
});

test('copying logo appearance deep-copies both editable text layers across use cases', () => {
  const config = cloneDefaultSiteLogoConfig();
  config.placements['header-desktop'].presentation.secondaryText.content = 'družba';
  config.placements['header-desktop'].presentation.taglineText.enabled = false;

  const copied = copySiteLogoPlacement(config, 'header-desktop', 'pdf-document');
  const copiedPresentation = resolveSiteLogoPresentation(copied.placements['pdf-document']);
  assert.equal(copiedPresentation.secondaryText.content, 'družba');
  assert.equal(copiedPresentation.taglineText.enabled, false);

  copied.placements['pdf-document'].presentation.secondaryText.content = 'spremenjeno';
  assert.equal(config.placements['header-desktop'].presentation.secondaryText.content, 'družba');
});

test('hide preserves customization while remove resets it and restore makes the default visible', () => {
  let config = cloneDefaultSiteLogoConfig();
  config = updateSiteLogoTextLayer(config, 'header-desktop', 'secondaryText', {
    content: 'družba',
    fontFamily: 'Noto Sans',
    fontSizePx: 84,
    fontStyle: 'normal',
    fontWeight: 700
  });
  config = updateSiteLogoTextLayer(config, 'header-desktop', 'secondaryText', { enabled: false });
  let layer = resolveSiteLogoPresentation(config.placements['header-desktop']).secondaryText;
  assert.equal(layer.enabled, false);
  assert.equal(layer.content, 'družba');
  assert.equal(layer.fontSizePx, 84);

  config = updateSiteLogoTextLayer(
    resetSiteLogoTextLayer(config, 'header-desktop', 'secondaryText'),
    'header-desktop',
    'secondaryText',
    { enabled: false }
  );
  layer = resolveSiteLogoPresentation(config.placements['header-desktop']).secondaryText;
  assert.equal(layer.enabled, false);
  assert.equal(layer.content, 'd.o.o.');
  assert.equal(layer.fontFamily, 'Barlow');
  assert.equal(layer.fontSizePx, 56);

  config = updateSiteLogoTextLayer(config, 'header-desktop', 'secondaryText', { enabled: true });
  assert.equal(resolveSiteLogoPresentation(config.placements['header-desktop']).secondaryText.enabled, true);
});

test('the logo workspace edits each text layer directly through its floating toolbar', () => {
  for (const layer of ['secondaryText', 'taglineText']) {
    assert.ok(
      logoEditorSource.includes(`data-logo-text-layer={layerKey}`)
        || logoEditorSource.includes('data-logo-text-layer={layerId}')
        || logoEditorSource.includes(`data-logo-text-layer="${layer}"`),
      `Missing direct canvas target for ${layer}.`
    );
  }
  assert.match(logoEditorSource, /data-logo-text-toolbar/u);
  for (const panel of ['edit', 'layers']) {
    assert.ok(
      logoEditorSource.includes(`data-logo-text-toolbar-panel="${panel}"`)
        || logoEditorSource.includes('data-logo-text-toolbar-panel={panel}'),
      `Missing floating ${panel} panel.`
    );
  }
  for (const control of [
    'content',
    'fontFamily',
    'fontSizePx',
    'fontStyle',
    'fontWeight',
    'letterSpacingPx'
  ]) {
    assert.ok(
      sharedTextControlsSource.includes(`data-logo-text-control="${control}"`)
        || sharedTextControlsSource.includes('data-logo-text-control={control}')
        || sharedTextControlsSource.includes('data-logo-text-control={marker}'),
      `Missing editable ${control} control.`
    );
  }
  assert.match(sharedTextControlsSource, /data-logo-text-hide/u);
  assert.match(sharedTextControlsSource, /data-logo-text-remove/u);
  assert.match(sharedTextControlsSource, /data-logo-text-restore/u);
  assert.doesNotMatch(logoEditorSource, /data-logo-text-sidebar/u);
});

test('logo text fields keep a local draft so spaces survive until an explicit commit', () => {
  assert.equal(
    sanitizeSiteLogoTextContent('  varčevanje z energijo  '),
    'varčevanje z energijo'
  );
  assert.match(sharedTextControlsSource, /useState\(layer\.content\)/u);
  assert.match(sharedTextControlsSource, /value=\{contentDraft\}/u);
  assert.match(
    sharedTextControlsSource,
    /onChange=\{\(event\) => setContentDraft\(event\.currentTarget\.value\)\}/u
  );
  assert.match(sharedTextControlsSource, /onBlur=\{commitContent\}/u);
  assert.match(sharedTextControlsSource, /event\.key === 'Enter'[\s\S]*?commitContent\(\)/u);
  assert.match(sharedTextControlsSource, /event\.key === 'Escape'[\s\S]*?setContentDraft\(layer\.content\)/u);
  assert.match(
    sharedTextControlsSource,
    /sanitizeSiteLogoTextContent\(contentDraft, layer\.content\)/u
  );
  assert.doesNotMatch(
    sharedTextControlsSource,
    /onChange=\{\(event\) => onChange\(\{ content: event\.currentTarget\.value \}\)\}/u
  );
});

test('Urejevalnik exposes the same PDF suffix and tagline controls instead of preview-only settings', () => {
  assert.match(documentEditorSource, /SiteLogoTextLayerManager/u);
  assert.match(documentEditorSource, /purposeId="pdf-document"/u);
  assert.match(documentEditorSource, /showFields/u);
  for (const control of [
    'content',
    'fontFamily',
    'fontSizePx',
    'fontStyle',
    'fontWeight',
    'letterSpacingPx'
  ]) {
    assert.ok(
      sharedTextControlsSource.includes(`data-logo-text-control="${control}"`)
        || sharedTextControlsSource.includes('data-logo-text-control={control}')
        || sharedTextControlsSource.includes('data-logo-text-control={marker}'),
      `Missing PDF logo ${control} control in Urejevalnik.`
    );
  }
  assert.match(sharedTextControlsSource, /data-logo-text-hide/u);
  assert.match(sharedTextControlsSource, /data-logo-text-remove/u);
  assert.match(sharedTextControlsSource, /data-logo-text-restore/u);
});

test('client and server renderers consume both text layers and remove inactive originals from effects', () => {
  for (const source of [clientArtworkSource, serverArtworkSource]) {
    assert.match(source, /presentation\.secondaryText/u);
    assert.match(source, /presentation\.taglineText/u);
  }
  assert.match(clientArtworkSource, /SITE_LOGO_BUILTIN_MASK_URLS\.secondary/u);
  assert.match(clientArtworkSource, /SITE_LOGO_BUILTIN_MASK_URLS\.tagline/u);
  assert.match(serverArtworkSource, /masks\.secondary/u);
  assert.match(serverArtworkSource, /masks\.tagline/u);

  const script = String.raw`
    const { DEFAULT_SITE_LOGO_PRESENTATION } = await import('./src/shared/domain/logo/siteLogo.ts');
    const { renderBuiltInAtehnaLogoArtwork } = await import('./src/shared/server/siteLogoArtwork.ts');
    const sharp = (await import('sharp')).default;

    const read = async (input) => sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const [secondaryMask, taglineMask] = await Promise.all([
      read('./public/brand/atehna-logo-secondary-mask.png'),
      read('./public/brand/atehna-logo-tagline-mask.png')
    ]);
    const presentation = structuredClone(DEFAULT_SITE_LOGO_PRESENTATION);
    presentation.secondaryText.enabled = false;
    presentation.taglineText.enabled = false;
    presentation.outline = { enabled: true, color: '#FF0000', widthPx: 4 };
    presentation.shadow = {
      enabled: true,
      color: '#0000FF',
      opacity: 1,
      blurPx: 0,
      offsetXpx: 2,
      offsetYpx: 2
    };
    const rendered = await read(await renderBuiltInAtehnaLogoArtwork(presentation));

    const expectedTop = [57, 54, 45];
    const expectedBottom = [76, 72, 61];
    let staleSecondaryPixels = 0;
    let staleTaglinePixels = 0;
    for (let index = 0; index < rendered.info.width * rendered.info.height; index += 1) {
      const offset = index * rendered.info.channels;
      if (secondaryMask.data[index * secondaryMask.info.channels + 3] > 0) {
        if (!expectedTop.every((channel, i) => rendered.data[offset + i] === channel)) staleSecondaryPixels += 1;
      }
      if (taglineMask.data[index * taglineMask.info.channels + 3] > 0) {
        if (!expectedBottom.every((channel, i) => rendered.data[offset + i] === channel)) staleTaglinePixels += 1;
      }
    }
    process.stdout.write(JSON.stringify({ staleSecondaryPixels, staleTaglinePixels }));
  `;
  const result = JSON.parse(execFileSync(process.execPath, [
    '--conditions=react-server',
    '--import',
    'tsx',
    '--input-type=module',
    '--eval',
    script
  ], {
    cwd: process.cwd(),
    encoding: 'utf8'
  })) as { staleSecondaryPixels: number; staleTaglinePixels: number };

  assert.deepEqual(result, { staleSecondaryPixels: 0, staleTaglinePixels: 0 });
});

test('an explicit artwork effect scale overrides numeric-style inference for measured previews', () => {
  assert.match(clientArtworkSource, /effectScale\?: number/u);
  assert.match(
    clientArtworkSource,
    /typeof effectScaleInput === 'number'[\s\S]*?Number\.isFinite\(effectScaleInput\)[\s\S]*?Math\.max\(0, effectScaleInput\)[\s\S]*?typeof style\?\.width === 'number'/u
  );
});

test('canonical text masks move and resize exactly while escaped Slovene custom text renders safely', () => {
  const script = String.raw`
    const { DEFAULT_SITE_LOGO_PRESENTATION } = await import('./src/shared/domain/logo/siteLogo.ts');
    const { renderBuiltInAtehnaLogoArtwork } = await import('./src/shared/server/siteLogoArtwork.ts');
    const sharp = (await import('sharp')).default;
    const bounds = async (presentation) => {
      const { data, info } = await sharp(await renderBuiltInAtehnaLogoArtwork(presentation)).raw().toBuffer({ resolveWithObject: true });
      let minX = info.width; let minY = info.height; let maxX = -1; let maxY = -1; let count = 0;
      for (let y = 0; y < info.height; y += 1) for (let x = 0; x < info.width; x += 1) {
        if (data[(y * info.width + x) * info.channels] === 0) continue;
        minX = Math.min(minX, x); minY = Math.min(minY, y);
        maxX = Math.max(maxX, x); maxY = Math.max(maxY, y); count += 1;
      }
      return { minX, minY, maxX, maxY, count };
    };
    const isolated = () => {
      const presentation = structuredClone(DEFAULT_SITE_LOGO_PRESENTATION);
      Object.assign(presentation, {
        backgroundColor: '#000000', taglineBackgroundColor: '#000000',
        primaryTextColor: '#000000', secondaryTextColor: '#FFFFFF', taglineTextColor: '#000000'
      });
      presentation.taglineText.enabled = false;
      return presentation;
    };
    const moved = isolated();
    Object.assign(moved.secondaryText, { x: 0.72, y: 0.30, fontSizePx: 88 });
    const custom = isolated();
    Object.assign(custom.secondaryText, { content: '<>& čšž', fontWeight: 500, fontSizePx: 72 });
    process.stdout.write(JSON.stringify({ moved: await bounds(moved), custom: await bounds(custom) }));
  `;
  const result = JSON.parse(execFileSync(process.execPath, [
    '--conditions=react-server', '--import', 'tsx', '--input-type=module', '--eval', script
  ], { cwd: process.cwd(), encoding: 'utf8' })) as {
    moved: { minX: number; minY: number; maxX: number; maxY: number; count: number };
    custom: { minX: number; minY: number; maxX: number; maxY: number; count: number };
  };
  assert.deepEqual(result.moved, { minX: 1349, minY: 252, maxX: 1604, maxY: 339, count: 6612 });
  assert.ok(result.custom.count > 0);
  assert.ok(result.custom.maxX > result.custom.minX && result.custom.maxY > result.custom.minY);
});
