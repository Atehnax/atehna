import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  DEFAULT_PRODUCT_APPEARANCE_CONFIG,
  PRODUCT_SECONDARY_BLOCKS,
  normalizeProductAppearanceConfig,
  toProductAppearanceCssVariables,
  toStoredProductAppearanceConfig
} from '@/shared/domain/style/productAppearance';

const source = (path: string) =>
  readFileSync(resolve(process.cwd(), path), 'utf8');

function cssRule(styles: string, selector: string) {
  const selectorStart = styles.indexOf(`${selector} {`);
  expect(selectorStart, `missing CSS rule: ${selector}`).toBeGreaterThanOrEqual(0);
  const blockStart = styles.indexOf('{', selectorStart);
  const blockEnd = styles.indexOf('}', blockStart);
  expect(blockEnd, `unterminated CSS rule: ${selector}`).toBeGreaterThan(blockStart);
  return styles.slice(blockStart + 1, blockEnd);
}

function cssRuleFromSelectorList(styles: string, selector: string) {
  const rules = styles.matchAll(/([^{}]+)\{([^{}]*)\}/g);
  for (const match of rules) {
    const selectors = match[1]!
      .split(',')
      .map((entry) => entry.trim());
    if (selectors.includes(selector)) return match[2]!;
  }
  expect(false, `missing CSS rule containing selector: ${selector}`).toBe(true);
  return '';
}

test.describe('product secondary content tab contracts', () => {
  test('supplies and normalizes configurable group and section labels', () => {
    const defaults = DEFAULT_PRODUCT_APPEARANCE_CONFIG.secondaryContent;

    expect(defaults.combinedOverviewLabel).toBe('Opis in specifikacije');
    expect(defaults.sectionLabels).toEqual({
      specifications: 'Specifikacije',
      description: 'Opis izdelka',
      includedItems: 'Vključeno',
      documents: 'Dokumenti',
      relatedProducts: 'Sorodni izdelki'
    });
    expect(Object.keys(defaults.sectionLabels)).toEqual([...PRODUCT_SECONDARY_BLOCKS]);

    const normalized = normalizeProductAppearanceConfig({
      secondaryContent: {
        combinedOverviewLabel: '  Overview and specifications  ',
        sectionLabels: {
          specifications: '   ',
          description: '  Product overview  ',
          includedItems: null,
          documents: '  Downloads  ',
          relatedProducts: '  Related items  ',
          ignored: 'Must not be stored'
        }
      }
    });

    expect(normalized.secondaryContent.combinedOverviewLabel)
      .toBe('Overview and specifications');
    expect(normalized.secondaryContent.sectionLabels).toEqual({
      specifications: defaults.sectionLabels.specifications,
      description: 'Product overview',
      includedItems: defaults.sectionLabels.includedItems,
      documents: 'Downloads',
      relatedProducts: 'Related items'
    });
    expect(normalized.secondaryContent.sectionLabels).not.toHaveProperty('ignored');

    const fallback = normalizeProductAppearanceConfig({
      secondaryContent: {
        combinedOverviewLabel: '   ',
        sectionLabels: {
          description: '',
          documents: 42
        }
      }
    });
    expect(fallback.secondaryContent.combinedOverviewLabel)
      .toBe(defaults.combinedOverviewLabel);
    expect(fallback.secondaryContent.sectionLabels).toEqual(defaults.sectionLabels);

    const stored = toStoredProductAppearanceConfig(normalized);
    expect(stored.secondaryContent).toEqual(normalized.secondaryContent);
    expect(normalizeProductAppearanceConfig(stored).secondaryContent)
      .toEqual(normalized.secondaryContent);

    const configuredDividers = normalizeProductAppearanceConfig({
      secondaryContent: {
        showTabDivider: false,
        showContentDivider: false,
        showSpecificationColumnDivider: false,
        showSpecificationRowDividers: false,
        dividerThicknessPx: 3.5,
        descriptionColumnPercent: 99,
        specificationFirstColumnPercent: 10
      }
    }).secondaryContent;
    expect(configuredDividers).toMatchObject({
      showTabDivider: false,
      showContentDivider: false,
      showSpecificationColumnDivider: false,
      showSpecificationRowDividers: false,
      dividerThicknessPx: 3.5,
      descriptionColumnPercent: 65,
      specificationFirstColumnPercent: 35
    });
    expect(toProductAppearanceCssVariables({ secondaryContent: configuredDividers }))
      .toMatchObject({
        '--product-detail-divider-width': '3.5px',
        '--product-detail-description-first-column': '65fr',
        '--product-detail-description-second-column': '35fr',
        '--product-detail-specification-divider-position': '35%'
      });
  });

  test('builds real grouped tabs and only exposes documents backed by product data', () => {
    const detailSource = source(
      'src/commercial/components/storefront/ProductDetailView.tsx'
    );

    expect(detailSource).toContain('type DetailContentGroup = DetailNavigationItem & {');
    expect(detailSource).toContain('function buildStackedGroups(');
    expect(detailSource).toContain(
      "section.id === 'description' || section.id === 'specifications'"
    );
    expect(detailSource).toContain('if (overviewSections.length < 2)');
    expect(detailSource).toContain('title: section.title');
    expect(detailSource).toContain('sections: overviewSections');
    expect(detailSource).toContain('const stackedGroups = buildStackedGroups(');
    expect(detailSource).toContain('sections={stackedGroups}');
    expect(detailSource).toContain('mode="tabs"');

    expect(detailSource).toContain('role="tablist"');
    expect(detailSource).toContain('role="tab"');
    expect(detailSource).toContain('aria-selected={active}');
    expect(detailSource).toContain('tabIndex={active ? 0 : -1}');
    expect(detailSource).toContain('role="tabpanel"');
    expect(detailSource).toContain('aria-labelledby=');

    expect(detailSource).toContain(
      'appearance.secondaryContent.combinedOverviewLabel'
    );
    for (const block of PRODUCT_SECONDARY_BLOCKS) {
      expect(detailSource).toContain(
        `appearance.secondaryContent.sectionLabels.${block}`
      );
    }

    expect(detailSource).toContain(
      "if (block === 'documents' && documents.length > 0)"
    );
    expect(detailSource).toContain('selectedVariant?.documents.length');
    expect(detailSource).toContain(': product.documents.filter(');
    expect(detailSource).toContain(
      'document.variantIds.includes(selectedVariant?.id ?? \'\')'
    );
    expect(detailSource).toContain(
      "(section) => section.id !== 'relatedProducts'"
    );
    expect(detailSource).toContain(
      "(section) => section.id === 'relatedProducts'"
    );
    expect(detailSource).toContain(
      "'product-related-products'"
    );
    expect(detailSource).toContain("id: 'delivery-and-payment'");
    expect(detailSource).toContain("title: 'Dostava in plačilo'");
  });

  test('compacts the stacked desktop overview with a two-column specification list', () => {
    const detailSource = source(
      'src/commercial/components/storefront/ProductDetailView.tsx'
    );
    const specificationSource = source(
      'src/commercial/components/storefront/SpecificationTable.tsx'
    );
    const compactStyles = source('src/shared/styles/globals.css')
      .replace(/\s+/g, ' ');
    const desktopGridSelector = [
      '[data-storefront-theme]',
      '.storefront-detail-layout-desktop',
      '.storefront-detail-stacked-grid',
      "[data-detail-section='specifications']",
      '.storefront-specification-grid'
    ].join(' ');
    const desktopRowSelector = `${desktopGridSelector.replace(
      ' .storefront-specification-grid',
      ''
    )} .storefront-specification-row`;

    expect(detailSource).toContain('data-detail-section={section.id}');
    expect(detailSource).toContain(
      'data-content-divider-visible={secondaryContent.showContentDivider}'
    );
    expect(detailSource).toContain(
      'data-tab-divider-visible={secondaryContent.showTabDivider}'
    );
    expect(specificationSource).toContain(
      'storefront-specification-grid overflow-hidden'
    );
    expect(specificationSource).toContain(
      'appearance.secondaryContent.showSpecificationColumnDivider'
    );
    expect(specificationSource).toContain(
      'appearance.secondaryContent.showSpecificationRowDividers'
    );
    expect(compactStyles).toContain(
      'grid-template-columns: minmax(0, var(--product-detail-specification-first-column, 50fr)) minmax(0, var(--product-detail-specification-second-column, 50fr));'
    );
    expect(compactStyles).toContain(
      `${desktopRowSelector} { grid-template-columns: minmax(0, 0.45fr) minmax(0, 0.55fr) !important; gap: 1rem !important; }`
    );
    expect(compactStyles).toContain(
      ".storefront-detail-layout-desktop .storefront-detail-stacked-grid[data-combined-overview='true'] [data-detail-section='specifications'] .storefront-specification-grid { border-block-start-width: 0; }"
    );
    expect(compactStyles).not.toContain(
      ".storefront-detail-layout-mobile .storefront-detail-stacked-grid [data-detail-section='specifications'] .storefront-specification-grid"
    );
  });

  test('wires contextual label editing and keeps storefront tabs underline-only', () => {
    const toolbarSource = source(
      'src/admin/features/podoba/components/ProductAppearanceContextToolbar.tsx'
    );
    const adminPageSource = source(
      'src/admin/features/podoba/components/AdminProductAppearancePageClient.tsx'
    );
    const globalStyles = source('src/shared/styles/globals.css');

    expect(toolbarSource).toContain(
      "selectedElementId === 'product-secondary'"
    );
    expect(toolbarSource).toContain(
      'data-testid="product-secondary-combined-label"'
    );
    expect(toolbarSource).toContain(
      'data-testid={`product-secondary-label-${block}`}'
    );
    expect(toolbarSource).toContain(
      'data-testid={`product-secondary-toggle-${block}`}'
    );
    expect(toolbarSource).toContain(
      'combinedOverviewLabel: event.target.value'
    );
    expect(toolbarSource).toContain(
      '...secondaryContent.sectionLabels'
    );
    expect(toolbarSource).toContain('[block]: event.target.value');
    expect(toolbarSource).toContain(
      'onSecondaryContentChange({ blockOrder: nextOrder })'
    );
    expect(toolbarSource).toContain(
      'data-testid="product-secondary-divider-controls"'
    );
    expect(toolbarSource).toContain(
      'data-testid="product-secondary-divider-thickness"'
    );
    expect(toolbarSource).toContain(
      'data-testid={`product-secondary-divider-position-${key}`}'
    );
    expect(toolbarSource).toContain("block === 'documents'");

    const editableBlocksStart = toolbarSource.indexOf(
      'const editableSecondaryBlocks'
    );
    const editableBlocksEnd = toolbarSource.indexOf('];', editableBlocksStart);
    const editableBlocksSource = toolbarSource.slice(
      editableBlocksStart,
      editableBlocksEnd
    );
    for (const block of [
      'description',
      'specifications',
      'documents',
      'includedItems'
    ]) {
      expect(editableBlocksSource).toContain(`'${block}'`);
    }
    expect(editableBlocksSource).not.toContain("'relatedProducts'");

    expect(adminPageSource).toContain(
      'secondaryContent={config.secondaryContent}'
    );
    expect(adminPageSource).toContain(
      "onSecondaryContentChange={(updates) => updateSection('secondaryContent', updates)}"
    );
    expect(adminPageSource).toContain('title="Ločnice vsebine"');

    const tabsRule = cssRule(
      globalStyles,
      '[data-storefront-theme] .storefront-detail-tabs'
    );
    expect(tabsRule.replace(/\s+/g, ' ')).toContain(
      'border-bottom: var(--product-detail-divider-width, 1px) solid var(--site-divider-color);'
    );
    expect(tabsRule).not.toContain('background:');
    expect(tabsRule).not.toContain('border-radius:');
    expect(tabsRule).not.toContain('box-shadow:');

    const tabRule = cssRule(
      globalStyles,
      '[data-storefront-theme] .storefront-detail-tab'
    );
    expect(tabRule).toContain('border: 0;');
    expect(tabRule).toContain(
      'border-bottom: calc(3px / var(--commercial-storefront-scale)) solid transparent;'
    );
    expect(tabRule).toContain('border-radius: 0;');
    expect(tabRule).toContain('background: transparent;');
    expect(tabRule).toContain('box-sizing: border-box;');
    expect(tabRule).toContain(
      'padding: calc(4px / var(--commercial-storefront-scale)) 0 0;'
    );
    expect(tabRule).not.toContain('box-shadow:');

    const activeTabRule = cssRule(
      globalStyles,
      "[data-storefront-theme] .storefront-detail-tab[data-active='true']"
    );
    expect(activeTabRule).toContain(
      'border-bottom-color: var(--site-color-primary);'
    );
    expect(activeTabRule).toContain('color: var(--site-color-primary);');
    expect(activeTabRule).not.toContain('background:');
    expect(activeTabRule).not.toContain('border-radius:');
    expect(activeTabRule).not.toContain('box-shadow:');
  });

  test('hides native tab and gallery scrollbars without disabling scrolling', () => {
    const globalStyles = source('src/shared/styles/globals.css');

    const tabsRule = cssRule(
      globalStyles,
      '[data-storefront-theme] .storefront-detail-tabs'
    );
    expect(tabsRule).toContain('overflow-x: auto;');
    expect(tabsRule).toContain('overflow-y: hidden;');
    expect(tabsRule).toContain('scrollbar-width: none;');

    const thumbnailListRule = cssRule(
      globalStyles,
      '[data-storefront-theme] .storefront-gallery-thumbnail-list'
    );
    expect(thumbnailListRule).toContain('overflow-x: auto;');
    expect(thumbnailListRule).toContain('overflow-y: hidden;');
    expect(thumbnailListRule).toContain('scrollbar-width: none;');
    expect(globalStyles).toContain(
      ".storefront-product-gallery[data-thumbnail-position-preview='left']"
    );
    expect(globalStyles).toContain('overflow-x: hidden !important;');
    expect(globalStyles).toContain('overflow-y: auto !important;');
    expect(globalStyles).toContain('padding-right: 0 !important;');

    for (const selector of [
      '[data-storefront-theme] .storefront-detail-tabs::-webkit-scrollbar',
      '[data-storefront-theme] .storefront-gallery-thumbnail-list::-webkit-scrollbar'
    ]) {
      const webkitRule = cssRuleFromSelectorList(globalStyles, selector);
      expect(webkitRule).toContain('display: none;');
    }
  });
});
