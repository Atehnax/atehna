import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const editorSource = readFileSync(
  resolve(process.cwd(), 'src/admin/features/podoba/components/AdminLogoPageClient.tsx'),
  'utf8'
);

test('the primary logo editor is canvas-first and exposes four compact use cases', () => {
  assert.match(editorSource, /SITE_LOGO_PRIMARY_USE_CASE_IDS\.map/u);
  assert.match(editorSource, /data-logo-use-case-tab=/u);
  assert.match(editorSource, /data-logo-other-outputs/u);
  assert.match(editorSource, /data-logo-use-case-preview/u);
  assert.match(editorSource, /<LogoUseCasePreview\b/u);
  assert.match(editorSource, /<FloatingAppearanceEditorContextToolbar\b/u);
  assert.match(editorSource, /data-logo-context-toolbar/u);
  assert.doesNotMatch(editorSource, /<aside\b/u);
  assert.doesNotMatch(editorSource, /data-testid="logo-master-variants"/u);
});

test('logo previews and PDF documents share the canonical artwork renderer', () => {
  assert.match(editorSource, /<SiteLogoArtwork\b/u);
  assert.match(editorSource, /resolveSiteLogoMaster/u);
  assert.match(editorSource, /resolveSiteLogoPresentation/u);
  assert.match(editorSource, /['"]pdf-document['"]/u);
  assert.match(editorSource, /SITE_LOGO_BUILTIN_ORIGINAL_MASTER_ID/u);
});

test('all logo presentation fields remain reachable only from the contextual toolbar', () => {
  for (const field of [
    'backgroundColor',
    'taglineBackgroundColor',
    'primaryTextColor',
    'secondaryTextColor',
    'taglineTextColor',
    'outline.enabled',
    'outline.color',
    'outline.widthPx',
    'shadow.enabled',
    'shadow.color',
    'shadow.opacity',
    'shadow.blurPx',
    'shadow.offsetXpx',
    'shadow.offsetYpx'
  ]) {
    assert.ok(
      editorSource.includes(`data-logo-presentation-control="${field}"`)
      || editorSource.includes(`marker="${field}"`),
      `Missing contextual logo presentation control: ${field}`
    );
  }
  assert.match(editorSource, /data-logo-toolbar-panel=/u);
  assert.match(editorSource, /data-logo-fit-mode=/u);
});

test('header logo size is edited in visible pixels while non-header outputs retain percentage scale', () => {
  assert.match(editorSource, /data-logo-header-size-control/u);
  assert.match(editorSource, /Višina logotipa/u);
  assert.match(editorSource, /SITE_LOGO_HEADER_DISPLAY_HEIGHT_MIN_PX/u);
  assert.match(editorSource, /SITE_LOGO_HEADER_DISPLAY_HEIGHT_MAX_PX/u);
  assert.match(editorSource, /displayHeightPx:\s*clamp\(/u);
  assert.match(
    editorSource,
    /override:\s*\{\s*\.\.\.effectivePlacement\.override,\s*scale:\s*1\s*\}/u
  );
  assert.match(editorSource, /displaySize\s*\?\s*\([\s\S]*?\)\s*:\s*\([\s\S]*?max=\{180\}/u);
});

test('explicit header sizing keeps a renderable master through empty selection and upload removal', () => {
  assert.match(
    editorSource,
    /function resolveSelectedSiteLogoMasterId\([\s\S]*?isSiteLogoHeaderPurpose\(purposeId\)[\s\S]*?placement\.displayHeightPx != null[\s\S]*?SITE_LOGO_BUILTIN_ORIGINAL_MASTER_ID/u
  );
  assert.ok(
    (editorSource.match(/resolveSelectedSiteLogoMasterId\(/gu) ?? []).length >= 4,
    'Expected the shared master-selection rule in both selects and upload removal'
  );
  assert.match(
    editorSource,
    /masterId:\s*resolveSelectedSiteLogoMasterId\(purposeId, placement, null\)/u
  );
  assert.match(
    editorSource,
    /return isSiteLogoHeaderPurpose\(purposeId\) && placement\.displayHeightPx != null[\s\S]*?\? SITE_LOGO_BUILTIN_ORIGINAL_MASTER_ID[\s\S]*?: null;/u
  );
  assert.ok(
    (editorSource.match(/resolveSelectedSiteLogoMasterId\([\s\S]{0,180}?masterId \|\| null/gu) ?? []).length >= 2,
    'Expected both compact source selectors to use the explicit-header fallback rule'
  );
  assert.match(
    editorSource,
    /if \(placement\.masterId !== slotId\) return \[purposeId, placement\];/u
  );
  assert.match(
    editorSource,
    /return \[purposeId, \{\s*\.\.\.placement,\s*masterId:\s*resolveSelectedSiteLogoMasterId\(purposeId, placement, null\),\s*override:\s*null\s*\}\];/u
  );
  assert.doesNotMatch(editorSource, /masterId:\s*(?:event\.target\.value|masterId) \|\| null/u);
});

test('the active admin header preview uses its configured visible pixel dimensions directly', () => {
  assert.doesNotMatch(editorSource, /toCommercialStorefrontLogicalPx/u);
  assert.match(editorSource, /width:\s*\x60\$\{displaySize\.widthPx\}px\x60/u);
  assert.match(editorSource, /height:\s*\x60\$\{displaySize\.heightPx\}px\x60/u);
  assert.match(
    editorSource,
    /data-logo-display-height-px=\{displaySize\.heightPx\}/u
  );
  assert.match(
    editorSource,
    /headerArtworkStyle[\s\S]*?imagePlacementStyle\([\s\S]*?widthPx:\s*displaySize\.widthPx,\s*heightPx:\s*displaySize\.heightPx[\s\S]*?data-logo-header-preview-viewport[\s\S]*?<MeasuredSiteLogoArtwork[\s\S]*?style=\{headerArtworkStyle!?\}/u
  );
  assert.match(editorSource, /new ResizeObserver\(measure\)/u);
  assert.match(editorSource, /effectScale=\{effectScale\}/u);
});

test('logo canvas and color controls expose compact crop, extension, and supported transparency editing', () => {
  assert.match(editorSource, /data-logo-canvas-edge-controls/u);
  assert.match(editorSource, /− izreže, \+ razširi/u);
  assert.match(editorSource, /SITE_LOGO_CANVAS_EDGE_IDS\.map/u);
  assert.match(editorSource, /updateSiteLogoCanvasEdges\(config, purposeId/u);
  assert.match(editorSource, /data-logo-transparent-color-controls/u);
  assert.match(editorSource, /updateSiteLogoColorTransparency\(config, purposeId/u);
  assert.match(editorSource, /capabilities\.artworkColors[\s\S]*?channel="taglineBackground"/u);
});

test('the 3x3 logo placement radiogroup is immediately visible and keyboard navigable', () => {
  assert.match(editorSource, /data-logo-placement-alignment/u);
  assert.match(editorSource, /role="radiogroup" aria-label="Poravnava logotipa"/u);
  assert.match(editorSource, /role="radio"/u);
  assert.match(editorSource, /tabIndex=\{index === rovingPlacementPresetIndex \? 0 : -1\}/u);
  for (const key of ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End']) {
    assert.ok(editorSource.includes(`event.key === '${key}'`), `Missing ${key} placement navigation`);
  }
  assert.match(editorSource, /querySelectorAll<HTMLButtonElement>\('\[data-logo-placement-preset\]'\)/u);
});

test('cross-use-case synchronization is explicit and preserves target geometry by default', () => {
  assert.match(editorSource, /data-logo-sync-suggestion/u);
  assert.match(editorSource, /data-logo-apply-to-purpose=/u);
  assert.match(editorSource, /suggestSiteLogoPlacement/u);
  assert.match(editorSource, /copySiteLogoPlacement/u);
  assert.match(editorSource, /copyGeometry/u);
  assert.doesNotMatch(editorSource, /useEffect\([^)]*copySiteLogoPlacement/su);
});
