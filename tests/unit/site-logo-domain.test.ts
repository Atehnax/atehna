import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import {
  DEFAULT_SITE_LOGO_PRESENTATION,
  SITE_LOGO_BUILTIN_ORIGINAL_MASTER_ID,
  SITE_LOGO_HEADER_DEFAULT_DISPLAY_HEIGHT_PX,
  SITE_LOGO_HEADER_DISPLAY_HEIGHT_MAX_PX,
  SITE_LOGO_HEADER_DISPLAY_HEIGHT_MIN_PX,
  SITE_LOGO_HEADER_PURPOSE_IDS,
  SITE_LOGO_PURPOSE_CATALOG,
  copySiteLogoPlacement,
  getSiteLogoPresentationCapabilities,
  normalizeSiteLogoConfig,
  resolveSiteLogoDisplaySize,
  resolveSiteLogoGeometry,
  suggestSiteLogoPlacement,
  toStoredSiteLogoConfig,
  validateSiteLogoConfigInput
} from '@/shared/domain/logo/siteLogo';

test('legacy site-logo config gains new use cases without losing explicit placement choices', () => {
  const normalized = normalizeSiteLogoConfig({
    version: 1,
    masters: [],
    placements: {
      'header-desktop': {
        purposeId: 'header-desktop',
        enabled: true,
        masterId: null,
        suggestion: { scale: 1, translateX: 0, translateY: 0, crop: { x: 0, y: 0, width: 1, height: 1 }, safeAreaInset: 0, algorithmVersion: 'legacy' },
        override: null
      }
    }
  });

  assert.equal(normalized.placements['header-desktop'].masterId, null);
  assert.equal(normalized.placements.standalone.masterId, SITE_LOGO_BUILTIN_ORIGINAL_MASTER_ID);
  assert.equal(normalized.placements['pdf-document'].masterId, SITE_LOGO_BUILTIN_ORIGINAL_MASTER_ID);
  assert.equal(normalized.placements['pdf-document'].fitMode, 'fill');
  assert.equal(normalized.placements.standalone.fitMode, 'contain');
  assert.deepEqual(normalized.placements['pdf-document'].presentation, DEFAULT_SITE_LOGO_PRESENTATION);
  assert.equal(normalized.placements['pdf-document'].suggestion.crop.y, 70 / 840);
  assert.equal(normalized.placements['pdf-document'].suggestion.crop.height, 594 / 840);
});

test('an explicit null master remains disabled across normalization', () => {
  const normalized = normalizeSiteLogoConfig({
    masters: [],
    placements: { 'pdf-document': { masterId: null } }
  });
  assert.equal(normalized.placements['pdf-document'].masterId, null);
});

test('legacy header placements retain their fixed viewport defaults and independent geometry scale', () => {
  const legacyScale = 1.8;
  const normalized = normalizeSiteLogoConfig({
    masters: [],
    placements: Object.fromEntries(SITE_LOGO_HEADER_PURPOSE_IDS.map((purposeId) => [purposeId, {
      suggestion: {
        scale: 1,
        translateX: 0,
        translateY: 0,
        crop: { x: 0, y: 0, width: 1, height: 1 },
        safeAreaInset: 0,
        algorithmVersion: 'legacy'
      },
      override: { scale: legacyScale }
    }]))
  });

  assert.deepEqual(SITE_LOGO_HEADER_DEFAULT_DISPLAY_HEIGHT_PX, {
    'header-desktop': 18,
    'header-tablet': 16.5,
    'header-mobile': 15
  });

  for (const purposeId of SITE_LOGO_HEADER_PURPOSE_IDS) {
    const placement = normalized.placements[purposeId];
    const purpose = SITE_LOGO_PURPOSE_CATALOG[purposeId];
    const expectedHeightPx = SITE_LOGO_HEADER_DEFAULT_DISPLAY_HEIGHT_PX[purposeId];

    assert.equal(placement.displayHeightPx, null);
    assert.equal(resolveSiteLogoGeometry(placement).scale, legacyScale);
    assert.deepEqual(resolveSiteLogoDisplaySize(purposeId, placement), {
      widthPx: expectedHeightPx * (purpose.widthPx / purpose.heightPx),
      heightPx: expectedHeightPx,
      explicit: false
    });
  }
});

test('an explicit header height round-trips in visible CSS pixels without affecting non-header scale', () => {
  const normalized = normalizeSiteLogoConfig({
    masters: [],
    placements: {
      'header-desktop': {
        displayHeightPx: 14,
        suggestion: { scale: 1 },
        override: { scale: 1, translateX: 0.15 }
      },
      'footer-desktop': {
        displayHeightPx: 14,
        suggestion: { scale: 1 },
        override: { scale: 1.8 }
      }
    }
  });
  const stored = toStoredSiteLogoConfig(normalized);
  const reloaded = normalizeSiteLogoConfig(stored);
  const headerPlacement = reloaded.placements['header-desktop'];

  assert.equal(headerPlacement.displayHeightPx, 14);
  assert.deepEqual(resolveSiteLogoDisplaySize('header-desktop', headerPlacement), {
    widthPx: 14 * (176 / 48),
    heightPx: 14,
    explicit: true
  });
  assert.equal(resolveSiteLogoGeometry(headerPlacement).scale, 1);
  assert.equal(resolveSiteLogoGeometry(headerPlacement).translateX, 0.15);
  assert.equal(reloaded.placements['footer-desktop'].displayHeightPx, null);
  assert.equal(resolveSiteLogoGeometry(reloaded.placements['footer-desktop']).scale, 1.8);
});

test('enabled explicit-size headers normalize to a renderable master without changing legacy or disabled null choices', () => {
  const normalized = normalizeSiteLogoConfig({
    masters: [],
    placements: {
      'header-desktop': { enabled: true, displayHeightPx: 14, masterId: null },
      'header-tablet': { enabled: true, displayHeightPx: 14, masterId: 'missing-master' },
      'header-mobile': { enabled: false, displayHeightPx: 14, masterId: null },
      'footer-desktop': { enabled: true, displayHeightPx: 14, masterId: null }
    }
  });

  assert.equal(
    normalized.placements['header-desktop'].masterId,
    SITE_LOGO_BUILTIN_ORIGINAL_MASTER_ID
  );
  assert.equal(
    normalized.placements['header-tablet'].masterId,
    SITE_LOGO_BUILTIN_ORIGINAL_MASTER_ID
  );
  assert.equal(normalized.placements['header-mobile'].masterId, null);
  assert.equal(normalized.placements['footer-desktop'].masterId, null);
});

test('explicit header display heights normalize to the supported pixel range', () => {
  const normalized = normalizeSiteLogoConfig({
    masters: [],
    placements: {
      'header-desktop': { displayHeightPx: SITE_LOGO_HEADER_DISPLAY_HEIGHT_MAX_PX + 100 },
      'header-tablet': { displayHeightPx: SITE_LOGO_HEADER_DISPLAY_HEIGHT_MIN_PX - 100 }
    }
  });

  assert.equal(
    normalized.placements['header-desktop'].displayHeightPx,
    SITE_LOGO_HEADER_DISPLAY_HEIGHT_MAX_PX
  );
  assert.equal(
    normalized.placements['header-tablet'].displayHeightPx,
    SITE_LOGO_HEADER_DISPLAY_HEIGHT_MIN_PX
  );
});

test('cross-purpose suggestions and copies preserve target geometry by default', () => {
  const config = normalizeSiteLogoConfig({ masters: [], placements: {} });
  config.placements['header-desktop'].presentation.primaryTextColor = '#102030';
  const targetCrop = config.placements['pdf-document'].suggestion.crop;

  const suggestion = suggestSiteLogoPlacement(config, 'header-desktop', 'pdf-document');
  assert.equal(suggestion.presentation.primaryTextColor, '#102030');
  assert.deepEqual(suggestion.suggestion.crop, targetCrop);

  const copied = copySiteLogoPlacement(config, 'header-desktop', 'pdf-document');
  assert.equal(copied.placements['pdf-document'].presentation.primaryTextColor, '#102030');
  assert.deepEqual(copied.placements['pdf-document'].suggestion.crop, targetCrop);
  assert.notEqual(copied, config);
});

test('presentation normalization and validation retain authentic secondary color safely', () => {
  const config = normalizeSiteLogoConfig({ masters: [], placements: {} });
  assert.equal(config.placements['pdf-document'].presentation.secondaryTextColor, '#AF991B');
  assert.deepEqual(validateSiteLogoConfigInput(config), []);
  const invalid = structuredClone(config) as unknown as { placements: Record<string, { presentation: { shadow: { opacity: number } } }> };
  invalid.placements['pdf-document'].presentation.shadow.opacity = 2;
  assert.ok(validateSiteLogoConfigInput(invalid).some((message) => message.includes('opacity')));
});

test('uploaded masters support background and alpha effects but not per-glyph recoloring', () => {
  assert.deepEqual(getSiteLogoPresentationCapabilities('uploaded-master'), {
    backgroundColors: true,
    artworkColors: false,
    editableText: false,
    outline: true,
    shadow: true
  });
});

test('storefront header and footer renderer consume shared masters and presentation', () => {
  const source = readFileSync(
    resolve(process.cwd(), 'src/commercial/components/SiteLogo.tsx'),
    'utf8'
  );
  assert.match(source, /resolveSiteLogoMaster/u);
  assert.match(source, /resolveSiteLogoPresentation/u);
  assert.match(source, /<SiteLogoArtwork\b/u);
  assert.match(source, /resolveSiteLogoCanvasLayout/u);
  assert.match(source, /resolveSiteLogoFittedArtworkRect/u);
  assert.match(source, /fitMode:\s*placement\.fitMode/u);
});

test('the real SiteHeader applies explicit pixel size to the outer viewport exactly once', () => {
  const logoSource = readFileSync(
    resolve(process.cwd(), 'src/commercial/components/SiteLogo.tsx'),
    'utf8'
  );
  const headerSource = readFileSync(
    resolve(process.cwd(), 'src/commercial/components/SiteHeader.tsx'),
    'utf8'
  );

  assert.match(headerSource, /resolveSiteLogoDisplaySize\(/u);
  assert.match(headerSource, /activeHeaderLogoDisplaySize\?\.explicit/u);
  assert.match(
    headerSource,
    /headerLogoLinkPaddingEndPx\s*=\s*10\s*\*\s*COMMERCIAL_STOREFRONT_SCALE/u
  );
  assert.match(
    headerSource,
    /activeHeaderLogoDisplaySize\.widthPx\s*\+\s*headerLogoLinkPaddingEndPx/u
  );
  assert.match(
    headerSource,
    /const logicalCenteredExpansionShiftPx\s*=\s*toCommercialStorefrontLogicalPx\(\s*\(itemWidthPx - baseItemWidthPx\) \/ 2\s*\)/u
  );
  assert.match(
    headerSource,
    /item\.region === 'center'[\s\S]*?left:\s*\x60calc\(\$\{baseLeft\} - \$\{logicalCenteredExpansionShiftPx\}px\)\x60/u
  );
  assert.match(
    headerSource,
    /item\.region === 'edgeRight'[\s\S]*?\{ left: 'auto', right: 0 \}/u
  );
  assert.match(
    headerSource,
    /const baseItemWidthPx\s*=\s*getTopBarItemRenderedWidthPx\(\s*item,\s*activeDevice,\s*settings\s*\)/u
  );
  assert.match(
    headerSource,
    /:\s*\{ left:\s*\x60min\(\$\{leftPercent\}%, calc\(100% - \$\{logicalWidthPx\}px\)\)\x60 \}/u
  );
  assert.match(
    headerSource,
    /width:\s*.*displaySize\.widthPx.*\/ var\(--commercial-storefront-scale\)/u
  );
  assert.match(
    headerSource,
    /height:\s*.*displaySize\.heightPx.*\/ var\(--commercial-storefront-scale\)/u
  );
  assert.match(headerSource, /className=\{headerLogoClassNames\[device\]\}/u);
  assert.match(logoSource, /style=\{style\}/u);
  assert.match(
    logoSource,
    /artworkScale\s*=\s*isSiteLogoHeaderPurpose\(purposeId\)[\s\S]*?placement\.displayHeightPx\s*!=\s*null[\s\S]*?\?\s*1[\s\S]*?:\s*geometry\.scale/u
  );
  assert.match(
    logoSource,
    /resolveSiteLogoFittedArtworkRect\(\{[\s\S]*?fitMode:\s*placement\.fitMode,[\s\S]*?artworkScale/u
  );
  assert.match(logoSource, /sourceWidth:\s*canvasLayout\.width/u);
  assert.match(logoSource, /sourceHeight:\s*canvasLayout\.height/u);
  assert.doesNotMatch(logoSource, /const scale[XY]\s*=/u);
  assert.doesNotMatch(
    logoSource,
    /displayHeightPx[\s\S]{0,240}(?:Math\.(?:min|max)|clamp)\([^)]*geometry\.scale/u
  );
});
