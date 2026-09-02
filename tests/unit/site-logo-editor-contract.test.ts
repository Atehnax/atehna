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
  assert.match(editorSource, /displaySize\s*\?\s*\([\s\S]*?\)\s*:\s*\([\s\S]*?max=\{LOGO_EDITOR_SCALE_MAX \* 100\}/u);
});

test('explicit header sizing keeps a renderable master through empty selection and upload removal', () => {
  assert.match(
    editorSource,
    /function resolveSelectedSiteLogoMasterId\([\s\S]*?isSiteLogoHeaderPurpose\(purposeId\)[\s\S]*?placement\.displayHeightPx != null[\s\S]*?SITE_LOGO_BUILTIN_ORIGINAL_MASTER_ID/u
  );
  assert.match(
    editorSource,
    /const selectMaster = \([\s\S]*?resolveSelectedSiteLogoMasterId\([\s\S]*?suggestion:\s*deriveSiteLogoFitSuggestion\([\s\S]*?override:\s*null/u
  );
  assert.match(
    editorSource,
    /return isSiteLogoHeaderPurpose\(purposeId\) && placement\.displayHeightPx != null[\s\S]*?\? SITE_LOGO_BUILTIN_ORIGINAL_MASTER_ID[\s\S]*?: null;/u
  );
  assert.ok(
    (editorSource.match(/selectMaster\(/gu) ?? []).length >= 3,
    'Expected every compact source selector to use the centralized fallback and fresh-fit rule'
  );
  assert.match(
    editorSource,
    /if \(placement\.masterId !== slotId\) return \[purposeId, placement\];/u
  );
  assert.match(
    editorSource,
    /const fallbackMasterId = getPreferredMasterId\(configWithoutMaster, purposeId\);[\s\S]*?masterId:\s*fallbackMasterId,[\s\S]*?suggestion:\s*deriveSiteLogoFitSuggestion\([\s\S]*?getMaster\(configWithoutMaster, fallbackMasterId\)[\s\S]*?override:\s*null/u
  );
  assert.doesNotMatch(editorSource, /masterId:\s*(?:event\.target\.value|masterId) \|\| null/u);
});

test('explicitly empty sources stay empty and fill-mode transform handles escape clipping ancestors', () => {
  assert.match(
    editorSource,
    /const current = placement\?\.masterId;[\s\S]*?if \(current === null\) return null;/u
  );
  assert.match(
    editorSource,
    /const showOverflowingTransformHandles = toolbarOpen && !activeTextLayerId && logoEditMode !== 'move';/u
  );
  assert.match(
    editorSource,
    /activeHeaderDisplaySize \|\| showOverflowingTransformHandles \? 'overflow-visible' : 'overflow-hidden'/u
  );
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
    /headerArtworkStyle[\s\S]*?imagePlacementStyle\([\s\S]*?widthPx:\s*displaySize\.widthPx,\s*heightPx:\s*displaySize\.heightPx[\s\S]*?data-logo-header-preview-viewport[\s\S]*?<MeasuredSiteLogoArtwork[\s\S]*?style=\{[\s\S]{0,240}?headerArtworkStyle/u
  );
  assert.match(editorSource, /new ResizeObserver\(measure\)/u);
  assert.match(editorSource, /effectScale=\{effectScale\}/u);
});

test('the canvas applies placement scale and exposes direct move, resize, and crop modes', () => {
  assert.match(
    editorSource,
    /resolveSiteLogoFittedArtworkRect\(\{[\s\S]*?artworkScale:\s*geometry\.scale/u
  );
  assert.match(editorSource, /type LogoEditMode = 'move' \| 'resize' \| 'crop'/u);
  assert.match(editorSource, /data-logo-edit-mode-control=\{mode\}/u);
  assert.match(editorSource, /pressed=\{editMode === mode\}/u);
  assert.match(editorSource, /onEditModeChange\(mode\)/u);
  assert.match(editorSource, /'move'[\s\S]*?'resize'[\s\S]*?'crop'/u);
});

test('resize and crop modes render keyboard-accessible transform handles', () => {
  assert.match(editorSource, /data-logo-editable-artwork-frame/u);
  assert.match(editorSource, /data-logo-transform-bounds/u);
  assert.match(editorSource, /data-logo-transform-handle=\{handle\}/u);
  assert.match(editorSource, /data-logo-resize-handle=/u);
  assert.match(editorSource, /data-logo-crop-handle=/u);
  assert.match(editorSource, /onPointerDown=\{\(event\) =>/u);
  assert.match(editorSource, /onKeyDown=\{\(event\) =>/u);
  assert.match(editorSource, /data-logo-clipped-artwork-layer/u);
  assert.match(editorSource, /data-logo-crop-shade/u);
  assert.match(editorSource, /overflow-visible/u);
  assert.match(editorSource, /clipPath:\s*'none'/u);
  assert.match(editorSource, /WebkitClipPath:\s*'none'/u);
  assert.match(editorSource, /onResizePointerDown/u);
  assert.match(editorSource, /onCropPointerDown/u);
  assert.match(editorSource, /onResizeKeyboard/u);
  assert.match(editorSource, /onCropKeyboard/u);
});

test('crop editing persists source-relative crop geometry in the placement override', () => {
  assert.match(editorSource, /function cropFromPointerDelta\(/u);
  assert.match(editorSource, /function applyCrop\([^)]*crop:/u);
  assert.match(
    editorSource,
    /override:\s*\{\s*\.\.\.placement\.override,\s*crop:\s*normalize(?:Editor|SiteLogo)Crop(?:Rect)?\(crop\)\s*\}/u
  );
  assert.match(editorSource, /data-logo-crop-field/u);
  assert.match(editorSource, /setOverride\(\{\s*crop:/u);
});

test('logo toolbar settings use compact viewport-aware popovers without the legacy 640px surface', () => {
  assert.match(editorSource, /<AppearanceEditorToolbarPopover\b/u);
  assert.match(
    editorSource,
    /<AppearanceEditorToolbarPopover[\s\S]{0,240}?ariaLabel=[\s\S]{0,240}?size=/u
  );
  assert.match(editorSource, /size=[^\n]{0,180}?'wide'[^\n]{0,180}?'compact'/u);
  assert.doesNotMatch(editorSource, /w-\[min\(640px,calc\(100vw-32px\)\)\]/u);
  assert.doesNotMatch(editorSource, /useAppearanceEditorToolbarPlacement\(\)/u);
  assert.match(editorSource, /data-logo-translation-field=\{axis\}/u);
  assert.match(editorSource, /className="w-\[58px\][^"]*"/u);
});

test('selecting another logo master derives a fresh fit suggestion and clears stale overrides', () => {
  assert.match(editorSource, /deriveSiteLogoFitSuggestion/u);
  assert.match(
    editorSource,
    /suggestion:\s*deriveSiteLogoFitSuggestion\(\s*purposeId,\s*[\s\S]{0,160}?\)/u
  );
  assert.match(editorSource, /override:\s*null/u);
});

test('logo canvas and color controls expose compact crop, extension, and supported transparency editing', () => {
  assert.match(editorSource, /data-logo-canvas-edge-controls/u);
  assert.match(editorSource, /Platno \(napredno\)/u);
  assert.match(editorSource, /SITE_LOGO_CANVAS_EDGE_IDS\.map/u);
  assert.match(editorSource, /updateSiteLogoCanvasEdges\(config, purposeId/u);
  assert.match(editorSource, /data-logo-transparent-color-controls/u);
  assert.match(editorSource, /updateSiteLogoColorTransparency\(config, purposeId/u);
  assert.match(editorSource, /capabilities\.artworkColors[\s\S]*?channel="taglineBackground"/u);
});

test('the 3x3 logo placement radiogroup is immediately visible and keyboard navigable', () => {
  assert.match(editorSource, /data-logo-placement-alignment/u);
  assert.match(editorSource, /role="radiogroup"[\s\S]{0,100}?aria-label="Poravnava logotipa"/u);
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
