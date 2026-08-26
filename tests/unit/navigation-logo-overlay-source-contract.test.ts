import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

import { COMMERCIAL_STOREFRONT_SCALE } from '../../src/commercial/components/commercialStorefrontScale';
import { SITE_NAVIGATION_TOP_BAR_LOGO_WIDTH_PX } from '../../src/shared/domain/navigation/siteNavigation';

const navigationEditorSource = readFileSync(
  resolve(
    process.cwd(),
    'src/admin/features/podoba/components/AdminNavigationPageClient.tsx'
  ),
  'utf8'
).replace(/\r\n?/gu, '\n');

function sourceBetween(start: string, end: string) {
  const startIndex = navigationEditorSource.indexOf(start);
  const endIndex = navigationEditorSource.indexOf(end, startIndex + start.length);

  assert.notEqual(startIndex, -1, `Missing source boundary: ${start}`);
  assert.notEqual(endIndex, -1, `Missing source boundary: ${end}`);

  return navigationEditorSource.slice(startIndex, endIndex);
}

test('navigation overlay resolves the active header logo size from the shared logo configuration', () => {
  assert.match(navigationEditorSource, /const siteLogoConfig = useSiteLogoConfig\(\);/u);
  assert.match(
    navigationEditorSource,
    /const logoPurposeId = `header-\$\{device\}` as SiteLogoPurposeId;/u
  );
  assert.match(
    navigationEditorSource,
    /const logoDisplaySize = resolveSiteLogoDisplaySize\(\s*logoPurposeId,\s*siteLogoConfig\.placements\[logoPurposeId\]\s*\);/u
  );
  assert.match(
    navigationEditorSource,
    /<TopBarResponsivePreview[\s\S]*?logoDisplaySize=\{logoDisplaySize\}/u
  );

  const responsivePreviewSource = sourceBetween(
    'function TopBarResponsivePreview(',
    'function TopBarElementRow('
  );
  assert.match(responsivePreviewSource, /logoDisplaySize\?: SiteLogoDisplaySize \| null;/u);
  assert.match(
    responsivePreviewSource,
    /calculateTopBarGeometry\(\{[\s\S]*?device,\s*logoDisplaySize,\s*labelScale:/u
  );
});
test('explicit logo overlay dimensions include the same 7.5 physical pixels of link padding as the storefront', () => {
  assert.equal(COMMERCIAL_STOREFRONT_SCALE, 0.75);
  assert.equal(10 * COMMERCIAL_STOREFRONT_SCALE, 7.5);
  assert.match(
    navigationEditorSource,
    /const topBarLogoLinkPaddingFinalPx = 10 \* COMMERCIAL_STOREFRONT_SCALE;/u
  );

  const visualHeightSource = sourceBetween(
    'function getTopBarElementVisualHeight(',
    'function getTopBarRenderedViewportHeight('
  );
  assert.match(visualHeightSource, /logoDisplaySize\?\.explicit/u);
  assert.match(
    visualHeightSource,
    /\(logoDisplaySize\.heightPx \+ topBarLogoLinkPaddingFinalPx\) \/ Math\.max\(coordinateScale, 0\.0001\)/u
  );

  const computedWidthSource = sourceBetween(
    'function getTopBarElementComputedWidth(',
    'function getTopBarElementRenderedPlacementWidth('
  );
  assert.match(computedWidthSource, /logoDisplaySize\?\.explicit/u);
  assert.match(
    computedWidthSource,
    /logoDisplaySize\.widthPx \+ topBarLogoLinkPaddingFinalPx/u
  );
});

test('legacy navigation-logo overlay geometry remains 88 by 34 when no pixel size is explicit', () => {
  assert.equal(SITE_NAVIGATION_TOP_BAR_LOGO_WIDTH_PX, 88);

  const visualHeightSource = sourceBetween(
    'function getTopBarElementVisualHeight(',
    'function getTopBarRenderedViewportHeight('
  );
  assert.match(
    visualHeightSource,
    /logoDisplaySize\?\.explicit[\s\S]*?\?[^:]+:\s*34;/u
  );

  const computedWidthSource = sourceBetween(
    'function getTopBarElementComputedWidth(',
    'function getTopBarElementRenderedPlacementWidth('
  );
  assert.match(computedWidthSource, /SITE_NAVIGATION_TOP_BAR_LOGO_WIDTH_PX/u);
  assert.match(
    computedWidthSource,
    /logoDisplaySize\?\.explicit \? logoDisplaySize\.widthPx \+ topBarLogoLinkPaddingFinalPx : 0/u
  );
});

test('expanded logo overlay width preserves its saved center anchor', () => {
  const xPlacementSource = sourceBetween(
    'function getTopBarElementXInBounds(',
    'function isTopBarPlacementItemRendered('
  );
  assert.match(xPlacementSource, /baseElementWidth = elementWidth/u);
  assert.match(
    xPlacementSource,
    /const baseMaxXPx = Math\.max\(0, placementBoundsWidth - baseElementWidth\);/u
  );
  assert.match(
    xPlacementSource,
    /const baseXPx = clampTopBarNumber\(ratioX, 0, baseMaxXPx\);/u
  );
  assert.match(
    xPlacementSource,
    /baseXPx - Math\.max\(0, elementWidth - baseElementWidth\) \/ 2/u
  );
  assert.doesNotMatch(
    xPlacementSource,
    /clampTopBarNumber\(centeredXPx/u,
    'A final clamp would shift the saved center when the visual logo width expands.'
  );

  const geometrySource = sourceBetween(
    'function calculateTopBarGeometry(',
    'function useMeasuredElementWidth<'
  );
  assert.match(
    geometrySource,
    /const baseWidth = getTopBarElementRenderedPlacementWidth\(\{ item, items, device, settings \}\) \/ coordinateScaleFactor;/u
  );
  assert.match(
    geometrySource,
    /const width = getTopBarElementRenderedPlacementWidth\(\{[\s\S]*?logoDisplaySize[\s\S]*?\}\) \/ coordinateScaleFactor;/u
  );
  assert.match(
    geometrySource,
    /getTopBarElementXInBounds\(item, placementBounds\.width, width, baseWidth\)/u
  );
});

test('visual logo expansion is not written back into persisted navigation item widths', () => {
  const normalizationSource = sourceBetween(
    'const normalizeDeviceItemWidth = (',
    'const updateDeviceItem = ('
  );
  assert.doesNotMatch(normalizationSource, /logoDisplaySize|displayHeightPx/u);

  const rowSource = sourceBetween(
    'function TopBarElementRow(',
    'function GroupEditor('
  );
  assert.match(rowSource, /logoDisplaySize\?: SiteLogoDisplaySize \| null;/u);
  assert.match(
    rowSource,
    /const resolvedWidth = getTopBarElementComputedWidth\(\{ item, items, device, settings \}\);/u
  );
  assert.match(
    rowSource,
    /const placementWidth = getTopBarElementRenderedPlacementWidth\(\{\s*item,\s*items,\s*device,\s*settings,\s*logoDisplaySize\s*\}\);/u
  );
});
