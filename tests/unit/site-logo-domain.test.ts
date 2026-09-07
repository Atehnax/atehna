import assert from 'node:assert/strict';

import { readFileSync } from 'node:fs';

import { resolve } from 'node:path';

import test from 'node:test';

test('storefront header and footer consume immutable published assets with contain sizing', () => {
  const source = readFileSync(resolve(process.cwd(), 'src/commercial/components/SiteLogo.tsx'), 'utf8');
  assert.match(source, /PublishedSiteLogoConfig/u);
  assert.match(source, /asset\.svgUrl \|\| asset\.pngUrl/u);
  assert.match(source, /width=\{asset\.width\} height=\{asset\.height\}/u);
  assert.match(source, /object-contain/u);
  assert.match(source, /data-site-logo-revision=\{asset\.revision\}/u);
  assert.match(source, /if \(!asset\) return null/u);
  assert.doesNotMatch(source, /resolveSiteLogoMaster|SiteLogoArtwork|geometry\.scale/u);
});

test('the real SiteHeader applies physical logo size once while preserving its slot anchor', () => {
  const logoSource = readFileSync(resolve(process.cwd(), 'src/commercial/components/SiteLogo.tsx'), 'utf8');
  const headerSource = readFileSync(resolve(process.cwd(), 'src/commercial/components/SiteHeader.tsx'), 'utf8');
  assert.match(headerSource, /resolveHeaderLogoSize\(/u);
  assert.match(headerSource, /activeHeaderLogoDisplaySize\?\.explicit/u);
  assert.match(headerSource, /headerLogoLinkPaddingEndPx\s*=\s*10\s*\*\s*COMMERCIAL_STOREFRONT_SCALE/u);
  assert.match(headerSource, /activeHeaderLogoDisplaySize\.widthPx\s*\+\s*headerLogoLinkPaddingEndPx/u);
  assert.match(headerSource, /const logicalCenteredExpansionShiftPx\s*=\s*toCommercialStorefrontLogicalPx\(\s*\(itemWidthPx - baseItemWidthPx\) \/ 2\s*\)/u);
  assert.match(headerSource, /item\.region === 'center'[\s\S]*?logicalCenteredExpansionShiftPx/u);
  assert.match(headerSource, /item\.region === 'edgeRight'[\s\S]*?\{ left: 'auto', right: 0 \}/u);
  assert.match(headerSource, /item\.anchorWidthPx != null \? item\.anchorWidthPx : getTopBarItemRenderedWidthPx/u);
  assert.match(headerSource, /width:\s*.*displaySize\.widthPx.*\/ var\(--commercial-storefront-scale\)/u);
  assert.match(headerSource, /height:\s*.*displaySize\.heightPx.*\/ var\(--commercial-storefront-scale\)/u);
  assert.match(headerSource, /className=\{headerLogoClassNames\[device\]\}/u);
  assert.match(logoSource, /style=\{style\}/u);
  assert.match(logoSource, /object-contain/u);
  assert.doesNotMatch(logoSource, /const scale[XY]\s*=|geometry\.scale|displayHeightPx/u);
});
