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

test('the admin lower footer keeps legal editors and copyright in the shared lower row', () => {
  const settings = normalizeHomepageFooterSettings({
    ...structuredClone(DEFAULT_HOMEPAGE_SETTINGS.footer),
    upperSectionVisible: false,
    lowerSectionVisible: true,
    lowerContactVisible: true,
    contact: {
      email: 'info@atehna.si',
      phone: '+386 1 234 56 78',
      address: 'Ajdovska 1, 4264 Bohinjska Bistrica',
      workingHours: 'Pon-Pet 8.00-16.00'
    }
  });
  const markup = renderToStaticMarkup(
    createElement(SiteFooter, {
      settings,
      editorAdapter: { editorMode: true } satisfies SiteFooterEditorAdapter
    })
  );

  assert.match(
    markup,
    /class="[^"]*flex-wrap[^"]*" data-testid="site-footer-lower-section"/u
  );
  assert.match(
    markup,
    /class="[^"]*flex[^"]*lg:flex-1[^"]*" data-footer-lower-leading="true"/u
  );
  assert.match(
    markup,
    /class="[^"]*flex-nowrap[^"]*" data-testid="site-footer-lower-contact"/u
  );
  assert.doesNotMatch(navigationEditorSource, /data-admin-footer-layout="contact-copyright-row"/u);
  assert.match(
    navigationEditorSource,
    /data-admin-footer-lower-contact-preview="true"[\s\S]{0,180}?relative flex w-full min-w-0 basis-full items-center/u
  );
  assert.match(
    navigationEditorSource,
    /data-admin-footer-lower-contact-preview="true"[\s\S]{0,260}?className="min-w-0 flex-1"/u
  );
  assert.match(
    navigationEditorSource,
    /className="flex min-h-7 items-center justify-end gap-1 pr-1"[\s\S]{0,220}?aria-label="Urejanje pravnih povezav" className="flex min-w-0 flex-wrap items-center justify-end gap-x-5 gap-y-2"/u
  );
  assert.doesNotMatch(navigationEditorSource, /order-last flex min-h-7 basis-full/u);
});
