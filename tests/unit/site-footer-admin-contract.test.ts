import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import SiteFooter, {
  type SiteFooterContactField,
  type SiteFooterEditorAdapter
} from '@/commercial/components/SiteFooter';
import {
  DEFAULT_HOMEPAGE_SETTINGS,
  normalizeHomepageFooterSettings
} from '@/shared/domain/landing/landingPage';

const navigationPageSource = readFileSync(
  resolve(process.cwd(), 'src/admin/pages/podoba/navigacija/page.tsx'),
  'utf8'
);
const navigationEditorSource = readFileSync(
  resolve(
    process.cwd(),
    'src/admin/features/podoba/components/AdminNavigationPageClient.tsx'
  ),
  'utf8'
);

test('the navigation footer preview receives the saved shared-logo configuration', () => {
  assert.match(navigationPageSource, /getSiteLogoConfig/u);
  assert.match(
    `${navigationPageSource}\n${navigationEditorSource}`,
    /SiteLogoProvider/u
  );
  assert.match(navigationEditorSource, /Uredi logotip/u);
  assert.match(navigationEditorSource, /\/admin\/podoba\/logotip/u);
  assert.doesNotMatch(navigationEditorSource, /function FooterLogoEditor\b/u);
  assert.doesNotMatch(navigationEditorSource, /Besedilo logotipa/u);
  assert.doesNotMatch(navigationEditorSource, /Prikaz logotipa v nogi/u);
});

test('the admin editor exposes independent accessible section controls', () => {
  assert.match(navigationEditorSource, /<fieldset[^>]*aria-label="Vidnost delov noge"/u);
  assert.match(navigationEditorSource, /Prikaži zgornji del/u);
  assert.match(navigationEditorSource, /Prikaži spodnji del/u);
  assert.match(navigationEditorSource, /Prikaži kontakt v spodnjem delu/u);
  assert.match(
    navigationEditorSource,
    /!config\.footer\.upperSectionVisible[\s\S]*?Prikaži kontakt v spodnjem delu/u
  );
});

test('the lower contact adapter receives every canonical editable contact field', () => {
  const seenFields: Array<{ field: SiteFooterContactField; value: string }> = [];
  const adapter = {
    editorMode: true,
    renderContactField: ({ field, value, defaultNode }) => {
      seenFields.push({ field, value });
      return defaultNode;
    }
  } satisfies SiteFooterEditorAdapter;
  const settings = normalizeHomepageFooterSettings({
    ...structuredClone(DEFAULT_HOMEPAGE_SETTINGS.footer),
    upperSectionVisible: false,
    lowerSectionVisible: true,
    lowerContactVisible: true,
    contact: {
      email: 'shared-contact@example.test',
      phone: '+386 1 555 02 03',
      address: 'Skupni naslov 4',
      workingHours: 'Pon–Pet 8.00–16.00'
    }
  });

  const markup = renderToStaticMarkup(
    createElement(SiteFooter, { settings, editorAdapter: adapter })
  );

  assert.match(markup, /data-testid="site-footer-lower-contact"/u);
  assert.deepEqual(seenFields, [
    { field: 'email', value: 'shared-contact@example.test' },
    { field: 'phone', value: '+386 1 555 02 03' },
    { field: 'address', value: 'Skupni naslov 4' },
    { field: 'workingHours', value: 'Pon–Pet 8.00–16.00' }
  ]);
});
