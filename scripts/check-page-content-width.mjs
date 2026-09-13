/**
 * Isolated browser layout regression. Uses real page CSS and never starts the
 * application or touches a database. Run: npx tsx scripts/check-page-content-width.mjs
 */
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from '@playwright/test';
import postcss from 'postcss';
import selectorParser from 'postcss-selector-parser';
import tailwindcss from 'tailwindcss';
import autoprefixer from 'autoprefixer';
import tailwindConfig from '../tailwind.config.ts';
import { COMMERCIAL_STOREFRONT_SCALE, toCommercialStorefrontLogicalPx } from '../src/commercial/components/commercialStorefrontScale.ts';
import { DEFAULT_GLOBAL_STYLE_CONFIG, toGlobalStyleCssVariables } from '../src/shared/domain/style/globalStyle.ts';

const root = process.cwd();
const profiles = [
  ['landing', 'container-base'],
  ['landing-section', 'site-container'],
  ['catalog', 'container-base catalog_catalog'],
  ['product-columns', 'container-base storefront-product-page columns_page'],
  ['product-showcase', 'container-base storefront-product-page showcase_page']
];
const moduleFiles = [
  ['catalog', 'src/commercial/components/storefront/CatalogBrowser.module.css'],
  ['columns', 'src/commercial/components/storefront/ProductDetailResponsive.module.css'],
  ['showcase', 'src/commercial/components/storefront/ProductShowcase.module.css'],
  ['related', 'src/commercial/components/storefront/ProductRelatedResponsive.module.css']
];

async function compileModule(prefix, filename) {
  const css = postcss.parse(await readFile(resolve(root, filename), 'utf8'), { from: filename });
  css.walkRules(rule => {
    rule.selector = selectorParser(selectors => {
      selectors.walkClasses(node => {
        for (let parent = node.parent; parent; parent = parent.parent) {
          if (parent.type === 'pseudo' && parent.value === ':global') return;
        }
        node.value = prefix + '_' + node.value;
      });
      selectors.walkPseudos(node => {
        if (node.value === ':global') node.replaceWith(...node.nodes[0].nodes);
      });
    }).processSync(rule.selector);
  });
  return css.toString();
}

function declarations(values) {
  return Object.entries(values).map(([key, value]) => key + ':' + value).join(';');
}

function markup(maxWidth) {
  const variables = toGlobalStyleCssVariables(DEFAULT_GLOBAL_STYLE_CONFIG, toCommercialStorefrontLogicalPx(1));
  const publicStyle = declarations({
    ...variables,
    '--commercial-storefront-scale': COMMERCIAL_STOREFRONT_SCALE,
    '--site-content-max-width': toCommercialStorefrontLogicalPx(maxWidth) + 'px',
    // Old product-specific overrides must no longer shrink the outer page.
    '--product-page-content-max-width': toCommercialStorefrontLogicalPx(600) + 'px'
  });
  return '<div data-storefront-theme="true" class="commercial-storefront-scale" style="' + publicStyle.replaceAll('&', '&amp;').replaceAll('"', '&quot;') + '">' +
    profiles.map(([id, classes]) => '<section id="' + id + '" class="' + classes + '"' +
      (id === 'product-showcase' ? ' data-product-layout="showcase"' : '') +
      '><div data-content-marker="' + id + '">Content</div></section>').join('') +
    '</div><div class="admin-scope flex w-full" style="--site-content-max-width:' + maxWidth + 'px">' +
    '<main id="admin-main" class="min-w-0 flex-1 overflow-x-hidden py-6 pl-[var(--site-page-inset-start)] pr-[var(--site-page-inset-end)]">' +
    '<div id="admin-content" class="site-page-content"><div data-content-marker="admin">Content</div></div></main></div>';
}

function previewMarkup(device, viewportWidth, maxWidth) {
  const variables = toGlobalStyleCssVariables(DEFAULT_GLOBAL_STYLE_CONFIG, toCommercialStorefrontLogicalPx(1));
  const style = declarations({
    ...variables,
    '--commercial-storefront-scale': COMMERCIAL_STOREFRONT_SCALE,
    '--site-page-content-scale': COMMERCIAL_STOREFRONT_SCALE,
    '--site-page-inset-start': device === 'mobile' ? '80px' : '96px',
    '--site-page-inset-end': device === 'mobile' ? '16px' : device === 'tablet' ? '24px' : '28px',
    '--site-content-max-width': toCommercialStorefrontLogicalPx(maxWidth) + 'px',
    '--product-page-content-max-width': toCommercialStorefrontLogicalPx(600) + 'px',
    width: toCommercialStorefrontLogicalPx(viewportWidth) + 'px',
    transform: 'scale(' + COMMERCIAL_STOREFRONT_SCALE + ')',
    'transform-origin': 'top left'
  }).replaceAll('&', '&amp;').replaceAll('"', '&quot;');
  return '<div style="width:' + viewportWidth + 'px;overflow:hidden"><div data-storefront-theme="true" ' +
    'class="admin-product-live-preview" data-preview-device="' + device + '" style="' + style + '">' +
    '<div id="preview-content" class="container-base storefront-product-page showcase_page" data-product-preview-device="' + device + '" ' +
    'data-product-layout="showcase"><div data-content-marker="preview">Content</div></div></div></div>';
}

const sampleMarkup = markup(1500);
const compiledGlobal = await postcss([
  tailwindcss({ ...tailwindConfig, content: [{ raw: sampleMarkup, extension: 'html' }] }),
  autoprefixer()
]).process(await readFile(resolve(root, 'src/shared/styles/globals.css'), 'utf8'), {
  from: resolve(root, 'src/shared/styles/globals.css')
});
const moduleCss = await Promise.all(moduleFiles.map(([prefix, file]) => compileModule(prefix, file)));
const { mobileMaxPx, tabletMaxPx } = DEFAULT_GLOBAL_STYLE_CONFIG.breakpoints;
// This matches CommercialScaleFrame's responsive token selection. Container
// widths, max-widths, padding and module overrides all come from actual CSS.
const responsiveTokens = '[data-storefront-theme="true"]{--site-gutter:var(--site-gutter-mobile)}' +
  '@media(min-width:' + (mobileMaxPx + 1) + 'px){[data-storefront-theme="true"]{--site-gutter:var(--site-gutter-tablet)}}' +
  '@media(min-width:' + (tabletMaxPx + 1) + 'px){[data-storefront-theme="true"]{--site-gutter:var(--site-gutter-desktop)}}';
const css = compiledGlobal.css + '\n' + moduleCss.join('\n') + '\n' + responsiveTokens;
const explicitBrowser = process.env.ATEHNA_PLAYWRIGHT_EXECUTABLE?.trim();
const installedBrowser = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
].find(path => existsSync(path));
const executablePath = explicitBrowser || (existsSync(chromium.executablePath()) ? undefined : installedBrowser);
const browser = await chromium.launch({ ...(executablePath ? { executablePath } : {}), headless: true });
const results = [];
try {
  const page = await browser.newPage();
  await page.route('**/*', route => route.abort());
  for (const maxWidth of [1500, 1200]) {
    for (const viewport of [390, 767, 768, 900, 1023, 1024, 1280, 1920]) {
      await page.setViewportSize({ width: viewport, height: 900 });
      await page.setContent('<!doctype html><html><head><style>' + css + '</style></head><body>' + markup(maxWidth) + '</body></html>');
      const measurements = await page.evaluate(() => {
        const markers = [...document.querySelectorAll('[data-content-marker]')].map(element => ({
          id: element.getAttribute('data-content-marker'),
          width: element.getBoundingClientRect().width,
          left: element.getBoundingClientRect().left
        }));
        const adminMain = getComputedStyle(document.getElementById('admin-main'));
        return {
          markers,
          frameWidth: document.querySelector('.commercial-storefront-scale').getBoundingClientRect().width,
          bodyWidth: document.body.getBoundingClientRect().width,
          bodyPadding: getComputedStyle(document.body).padding,
          container: { width: getComputedStyle(document.getElementById('landing')).width,
            padding: getComputedStyle(document.getElementById('landing')).padding,
            gutter: getComputedStyle(document.getElementById('landing')).getPropertyValue('--site-gutter') },
          adminPadding: parseFloat(adminMain.paddingLeft) + parseFloat(adminMain.paddingRight),
          scrollWidth: document.documentElement.scrollWidth,
          viewportWidth: document.documentElement.clientWidth
        };
      });
      const expectedPublicWidth = Math.min(maxWidth, measurements.bodyWidth - measurements.adminPadding);
      for (const marker of measurements.markers) {
        const expected = marker.id === 'admin' ? Math.min(maxWidth, measurements.bodyWidth - measurements.adminPadding) : expectedPublicWidth;
        assert.ok(Math.abs(marker.width - expected) < 0.2,
          marker.id + ' at viewport ' + viewport + '/max ' + maxWidth + ': expected ' + expected + ', got ' + marker.width + ' ' + JSON.stringify(measurements));
        if (marker.id !== 'admin') {
          assert.ok(Math.abs(marker.left - (measurements.bodyWidth - expectedPublicWidth) / 2) < 0.2,
            marker.id + ' is not centered at viewport ' + viewport);
        }
      }
      assert.ok(measurements.scrollWidth <= measurements.viewportWidth,
        'Horizontal overflow at viewport ' + viewport + '/max ' + maxWidth);
      results.push({ viewport, maxWidth, publicWidth: expectedPublicWidth,
        adminWidth: measurements.markers.find(marker => marker.id === 'admin').width });
    }
  }
  // Selected preview device controls insets even inside a desktop host window.
  await page.setViewportSize({ width: 1920, height: 900 });
  for (const [device, viewportWidth, insets] of [['mobile', 390, 96], ['tablet', 900, 120], ['desktop', 1500, 124]]) {
    await page.setContent('<!doctype html><html><head><style>' + css + '</style></head><body>' + previewMarkup(device, viewportWidth, 1500) + '</body></html>');
    const width = await page.locator('[data-content-marker="preview"]').evaluate(element => element.getBoundingClientRect().width);
    assert.ok(Math.abs(width - (viewportWidth - insets)) < 0.2,
      device + ' product preview: expected ' + (viewportWidth - insets) + ', got ' + width);
  }
  const relatedCards = Array.from({ length: 6 }, (_, index) =>
    '<article class="showcase_relatedCard" data-related-card><a class="showcase_relatedImage" data-related-image href="#"><span>Image</span></a>' +
    '<div class="showcase_relatedContent" data-related-content><p class="site-eyebrow">Category</p><h3>Related product ' + (index + 1) + '</h3>' +
    '<p class="showcase_relatedDescription">Description for the related product.</p></div>' +
    '<div class="showcase_relatedPrice" data-related-price><p>12,00 €</p></div><a class="showcase_relatedAction" href="#">›</a></article>'
  ).join('');
  for (const viewport of [390, 900, 1280, 1920]) {
    await page.setViewportSize({ width: viewport, height: 900 });
    await page.setContent('<!doctype html><html><head><style>' + css + '</style></head><body>' + markup(1500) + '</body></html>');
    await page.locator('#product-showcase').evaluate((element, cards) => {
      element.innerHTML = '<section class="storefront-related-products-section related_responsiveRelated">' +
        '<div id="related-row" class="storefront-related-product-grid" style="--product-related-columns-desktop:3;--product-related-card-width:640px;--product-related-section-width:50%">' + cards + '</div></section>';
    }, relatedCards);
    const layout = await page.locator('#related-row').evaluate(row => {
      const cards = [...row.querySelectorAll('[data-related-card]')].map(card => {
        const rect = card.getBoundingClientRect();
        const image = card.querySelector('[data-related-image]').getBoundingClientRect();
        const content = card.querySelector('[data-related-content]').getBoundingClientRect();
        const price = card.querySelector('[data-related-price]').getBoundingClientRect();
        return { top: rect.top, width: rect.width, height: rect.height, imageBottom: image.bottom, contentTop: content.top, contentBottom: content.bottom, priceTop: price.top };
      });
      return { cards, scrollWidth: row.scrollWidth, clientWidth: row.clientWidth, documentWidth: document.documentElement.scrollWidth, viewportWidth: window.innerWidth };
    });
    assert.equal(layout.cards.length, 6);
    for (const card of layout.cards) {
      assert.ok(Math.abs(card.top - layout.cards[0].top) < 0.2, 'Related cards wrapped at ' + viewport);
      assert.ok(card.height > card.width, 'Related card is not portrait at ' + viewport);
      assert.ok(card.contentTop >= card.imageBottom - 0.2, 'Related image is not above content at ' + viewport);
      assert.ok(card.priceTop >= card.contentBottom - 0.2, 'Related price is not after description at ' + viewport);
    }
    if (viewport >= 1025) {
      assert.ok(layout.scrollWidth <= layout.clientWidth + 1, 'Six related cards do not fit at ' + viewport);
    } else {
      assert.ok(layout.scrollWidth > layout.clientWidth, 'Mobile/tablet row must scroll at ' + viewport);
      const lastVisible = await page.locator('#related-row').evaluate(row => {
        row.scrollLeft = row.scrollWidth;
        return row.lastElementChild.getBoundingClientRect().right <= row.getBoundingClientRect().right + 1;
      });
      assert.ok(lastVisible, 'The last related card is not reachable at ' + viewport);
    }
    assert.ok(layout.documentWidth <= layout.viewportWidth, 'Related row causes page overflow at ' + viewport);
  }
  console.table(results);
  console.log('All public page profiles match the actual admin content width; responsive insets, six portrait related cards and overflow checks pass.');
} finally {
  await browser.close();
}
