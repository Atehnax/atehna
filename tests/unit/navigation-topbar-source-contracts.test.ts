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

  test('gives the compact width heading enough line height for descenders', () => {
    const navigationEditorSource = readFileSync(
      resolve(
        process.cwd(),
        'src/admin/features/podoba/components/AdminNavigationPageClient.tsx'
      ),
      'utf8'
    );

    expect(navigationEditorSource).toMatch(
      /className="text-\[11px\] font-semibold leading-\[14px\] text-slate-600">\s*Širina zgornje vrstice/
    );
  });
});
