import { expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, test } from 'node:test';

describe('Navigation top-bar appearance', () => {
  test('keeps configured width modes authoritative on product pages', () => {
    const headerSource = readFileSync(
      resolve(process.cwd(), 'src/commercial/components/SiteHeader.tsx'),
      'utf8'
    );
    const styles = readFileSync(
      resolve(process.cwd(), 'src/shared/styles/globals.css'),
      'utf8'
    );

    expect(headerSource).toContain(
      'data-width-mode={activeTopBarLayout.settings.widthMode}'
    );
    expect(headerSource).toContain(
      "activeTopBarLayout.settings.widthMode === 'full'"
    );
    expect(headerSource).toContain(
      "activeTopBarLayout.settings.widthMode === 'custom'"
    );
    expect(styles).toMatch(
      /\.topbar-inner\s*\{[^}]*max-width:\s*var\(--topbar-inner-max-width\);/s
    );
    expect(styles).toMatch(
      /\.topbar-inner\[data-width-mode='full'\]\s*\{[^}]*max-width:\s*none;/s
    );
    expect(styles).not.toMatch(
      /:has\(\.storefront-product-page\)[\s\S]{0,200}\.topbar-inner\s*\{[^}]*max-width:\s*none\s*!important;/
    );
  });

  test('keeps the wide Videz card grouped into colour, typography, width, and dimension rows', () => {
    const navigationEditorSource = readFileSync(
      resolve(
        process.cwd(),
        'src/admin/features/podoba/components/AdminNavigationPageClient.tsx'
      ),
      'utf8'
    );

    const settingsPanelIndex = navigationEditorSource.indexOf('data-testid="top-bar-settings-panel"');
    const colorsRowIndex = navigationEditorSource.indexOf('data-testid="top-bar-colors-row"');
    const typographyRowIndex = navigationEditorSource.indexOf('data-testid="top-bar-typography-row"');
    const widthSettingsIndex = navigationEditorSource.indexOf('data-testid="top-bar-width-settings"');
    const dimensionsIndex = navigationEditorSource.indexOf('data-testid="top-bar-dimensions-settings"');
    const elementsTableIndex = navigationEditorSource.indexOf('data-testid="top-bar-elements-table"');

    for (const index of [
      settingsPanelIndex,
      colorsRowIndex,
      typographyRowIndex,
      widthSettingsIndex,
      dimensionsIndex,
      elementsTableIndex
    ]) {
      expect(index).toBeGreaterThan(-1);
    }
    expect(settingsPanelIndex).toBeLessThan(colorsRowIndex);
    expect(colorsRowIndex).toBeLessThan(typographyRowIndex);
    expect(typographyRowIndex).toBeLessThan(widthSettingsIndex);
    expect(widthSettingsIndex).toBeLessThan(dimensionsIndex);
    expect(dimensionsIndex).toBeLessThan(elementsTableIndex);

    const widthSettingsSource = navigationEditorSource.slice(widthSettingsIndex, dimensionsIndex);
    const dimensionsSource = navigationEditorSource.slice(dimensionsIndex, elementsTableIndex);
    expect(widthSettingsSource).toMatch(/>\s*Širina\s*</);
    expect(widthSettingsSource).not.toContain('Širina zgornje vrstice');
    expect(dimensionsSource).toContain('label="Odmik"');
    expect(dimensionsSource).not.toContain('label="Min in Max odmik"');
  });
  test('keeps the customer-facing logo background transparent on hover', () => {
    const headerSource = readFileSync(
      resolve(process.cwd(), 'src/commercial/components/SiteHeader.tsx'),
      'utf8'
    );
    const logoLinkClassName = headerSource.match(
      /aria-label="Atehna home"[\s\S]{0,220}?className="([^"]+)"/
    )?.[1];

    expect(logoLinkClassName).toBeTruthy();
    expect(logoLinkClassName).not.toContain('hover:bg-');
  });
  test('centers the desktop mega-menu within the website header', () => {
    const headerSource = readFileSync(
      resolve(process.cwd(), 'src/commercial/components/SiteHeader.tsx'),
      'utf8'
    );
    const menuStart = headerSource.indexOf('id={desktopPanelId}');
    const menuEnd = headerSource.indexOf('onMouseEnter={cancelDesktopMenuClose}', menuStart);
    const menuSource = headerSource.slice(menuStart, menuEnd);

    expect(menuStart).toBeGreaterThan(-1);
    expect(menuEnd).toBeGreaterThan(menuStart);
    expect(menuSource).toContain('data-navigation-menu-alignment="site-center"');
    expect(menuSource).toContain("left: '50%'");
    expect(menuSource).toContain("transform: 'translateX(-50%)'");
    expect(menuSource).toContain(
      "maxWidth: 'calc(100% - (32px / var(--commercial-storefront-scale)))'"
    );
    expect(headerSource).not.toContain('dropdownPanelLeft');
    expect(headerSource).not.toContain('katalogLabelRef');
  });
  test('omits hidden entries from top-bar previews while keeping them muted in the main-menu editor', () => {
    const headerSource = readFileSync(
      resolve(process.cwd(), 'src/commercial/components/SiteHeader.tsx'),
      'utf8'
    );
    const navigationEditorSource = readFileSync(
      resolve(
        process.cwd(),
        'src/admin/features/podoba/components/AdminNavigationPageClient.tsx'
      ),
      'utf8'
    );
    const landingEditorSource = readFileSync(
      resolve(
        process.cwd(),
        'src/admin/features/podoba/components/AdminLandingPageClient.tsx'
      ),
      'utf8'
    );

    expect(headerSource).not.toContain('showHiddenNavigation');
    expect(headerSource).toContain(
      '() => getVisibleSiteNavigationItems(normalizedNavigation)'
    );
    expect(navigationEditorSource).not.toContain('showHiddenNavigation');
    expect(landingEditorSource).not.toContain('showHiddenNavigation');
    expect(navigationEditorSource).toContain(
      'const visibleItems = items.filter((item) => item.visible);'
    );
    expect(navigationEditorSource).toContain('data-navigation-parent-hidden=');
    expect(navigationEditorSource).toContain('data-navigation-group-hidden=');
    expect(navigationEditorSource).toContain(
      "group.visible ? 'Skrij skupino' : 'Prikaži skupino'"
    );
  });

  test('keeps Search compact in layout geometry and expands its field to the left on click', () => {
    const headerSource = readFileSync(
      resolve(process.cwd(), 'src/commercial/components/SiteHeader.tsx'),
      'utf8'
    );
    const navigationEditorSource = readFileSync(
      resolve(
        process.cwd(),
        'src/admin/features/podoba/components/AdminNavigationPageClient.tsx'
      ),
      'utf8'
    );
    const searchStart = headerSource.indexOf('function NavbarSearch');
    const searchEnd = headerSource.indexOf('function NavbarCartControl', searchStart);
    const navbarSearchSource = headerSource.slice(searchStart, searchEnd);

    expect(searchStart).toBeGreaterThan(-1);
    expect(searchEnd).toBeGreaterThan(searchStart);
    expect(navbarSearchSource).toContain('aria-expanded={desktopExpanded}');
    expect(navbarSearchSource).toContain('aria-controls={searchSurfaceId}');
    expect(navbarSearchSource).toContain('onClick={openExpandedSearch}');
    expect(navbarSearchSource).not.toContain('onFocus={openExpandedSearch}');
    expect(navbarSearchSource).toContain('absolute right-0');
    expect(navbarSearchSource).toContain(
      'getSiteNavigationTopBarSearchReservedWidth(device)'
    );
    expect(headerSource).toContain(
      '<NavbarSearch device={activeTopBarDevice} onNavigate={closeMenus} />'
    );
    expect(navigationEditorSource).toContain(
      'SITE_NAVIGATION_TOP_BAR_SEARCH_COLLAPSED_WIDTH_PX'
    );
    expect(navigationEditorSource).toContain('disabled={searchWidthLocked}');
    expect(navigationEditorSource).not.toContain(
      'getSiteNavigationTopBarSearchReservedWidth'
    );
  });
});
