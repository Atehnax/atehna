import { expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, test } from 'node:test';

const source = (path: string) =>
  readFileSync(resolve(process.cwd(), path), 'utf8');

describe('related product appearance editor contracts', () => {
  test('offers automatic, manual, responsive sizing and placement controls in the canvas toolbar', () => {
    const toolbar = source(
      'src/admin/features/podoba/components/ProductAppearanceContextToolbar.tsx'
    );
    const adminPage = source(
      'src/admin/features/podoba/components/AdminProductAppearancePageClient.tsx'
    );

    expect(toolbar).toContain("'product-related-products'");
    expect(toolbar).toContain(
      'data-testid="product-related-products-controls"'
    );
    expect(toolbar).toContain('relatedProducts.sourceMode');
    expect(toolbar).toContain('relatedProducts.manualPlacement');
    expect(toolbar).toContain('relatedProducts.maxItems');
    expect(toolbar).toContain("['desktopColumns', 'Desktop', 6]");
    expect(toolbar).toContain("['tabletColumns', 'Tablica', 4]");
    expect(toolbar).toContain("['mobileColumns', 'Mobilno', 2]");
    expect(toolbar).toContain('relatedProducts.gapPx');
    expect(toolbar).toContain('relatedProducts.cardWidthPx');
    expect(toolbar).toContain('relatedProducts.imageHeightPx');
    expect(toolbar).toContain('relatedProducts.textScalePercent');
    expect(toolbar).toContain('relatedProducts.sectionPlacement');
    expect(toolbar).toContain('relatedProducts.sectionWidthPercent');
    expect(toolbar).toContain('relatedProducts.sectionAlignment');
    expect(toolbar).toContain('manualProductSlugs');
    expect(toolbar).toContain('productOptions.filter');
    expect(adminPage).toContain('productOptions={productOptions}');
    expect(adminPage).toContain('relatedProducts={config.relatedProducts}');
    expect(adminPage).toContain(
      "onRelatedProductsChange={(updates) => updateSection('relatedProducts', updates)}"
    );
  });

  test('persists manual picks and renders the configured section on the storefront', () => {
    const adminPage = source(
      'src/admin/features/podoba/components/AdminProductAppearancePageClient.tsx'
    );
    const presentationRoute = source(
      'src/admin/api/product-appearance/products/[slug]/route.ts'
    );
    const previewBuilder = source(
      'src/admin/features/podoba/lib/productAppearancePreviewProduct.ts'
    );
    const detail = source(
      'src/commercial/components/storefront/ProductDetailView.tsx'
    );
    const productCard = source(
      'src/commercial/components/storefront/ProductCard.tsx'
    );
    const styles = source('src/shared/styles/globals.css');

    expect(adminPage).toContain(
      'appearanceOverride: product.appearanceOverride'
    );
    expect(presentationRoute).toContain(
      'mergePresentationAppearanceOverride'
    );
    expect(presentationRoute).toContain('manualProductSlugs');
    expect(previewBuilder).toContain('buildPreviewRelatedProducts');
    expect(previewBuilder).toContain('product.relatedProducts =');
    expect(detail).toContain(
      "appearance.relatedProducts.sectionPlacement === 'before-content'"
    );
    expect(detail).toContain(
      "appearance.relatedProducts.sectionPlacement === 'after-content'"
    );
    expect(detail).toContain('storefront-related-products-section');
    expect(detail).toContain(
      'product.relatedProducts.length > 0 || Boolean(canvasEditor)'
    );
    expect(detail).toContain('<ProductCard');
    expect(productCard).toContain('storefront-product-card');
    expect(productCard).toContain('storefront-product-card-media');
    expect(productCard).toContain('storefront-product-card-content');
    expect(styles).toContain(
      'gap: var(--product-related-gap, var(--product-listing-gap, 20px));'
    );
    expect(styles).toContain('var(--product-related-card-width');
    expect(styles).toContain('var(--product-related-image-height');
    expect(styles).toContain('var(--product-related-text-scale');
    expect(styles).toMatch(
      /\.storefront-related-product-grid[\s\S]*?\.storefront-product-card/
    );
    expect(styles).toContain(
      'width: var(--product-related-section-width, 100%);'
    );
  });

  test('uses a compact horizontal card without weakening variant safety', () => {
    const productCard = source(
      'src/commercial/components/storefront/ProductCard.tsx'
    );
    const summary = source(
      'src/commercial/features/products/storefrontProduct.ts'
    );
    const styles = source('src/shared/styles/globals.css');

    expect(productCard).toContain(
      "'storefront-related-product-card-layout grid'"
    );
    expect(productCard).toContain(
      'className="storefront-related-product-quick-add'
    );
    expect(productCard).toContain('storefront-related-product-quantity');
    expect(productCard).toContain('quantity={relatedQuantity}');
    expect(productCard).toContain('<ShoppingCart');
    expect(productCard).toContain(
      "product.isAvailable ? 'Izberi razli"
    );
    expect(summary).toContain(
      'product.variants.length === 1 && purchasableVariants.length === 1'
    );
    expect(styles).toContain(
      'grid-template-columns: minmax(6rem, 0.35fr) minmax(0, 0.65fr);'
    );
    expect(productCard).toContain('storefront-related-product-purchase-row');
    expect(styles).toContain('.storefront-related-product-purchase-row');
    expect(styles).toContain('flex-wrap: wrap;');
    expect(styles).toContain('align-items: center;');
    expect(styles).toContain(
      'block-size: var(--product-related-image-height, 144px);'
    );
    expect(styles).toMatch(
      /\.storefront-related-product-card[\s\S]*?\.storefront-product-card-title\s*\{[\s\S]*?font-size:\s*1\.25em;/
    );
    expect(styles).toMatch(
      /\.storefront-related-product-card[\s\S]*?\.storefront-product-card-description\s*\{[\s\S]*?font-size:\s*1em;/
    );
    expect(styles).toMatch(
      /\.storefront-related-product-card[\s\S]*?\.storefront-price-primary\s*\{[\s\S]*?font-size:\s*1\.375em;/
    );
    expect(styles).toContain('justify-content: space-between;');
    expect(styles).toContain('flex: 0 1 7rem;');
    expect(styles).toContain('max-inline-size: 100%;');
    expect(styles).toContain('justify-content: flex-end;');
    expect(productCard).toContain("'min-w-0 shrink-0'");
    expect(styles).toContain('> #related-products-title');
    expect(styles).toContain('inline-size: 3.75rem;');
    expect(styles).toContain('.storefront-related-product-cart-button');
  });

  test('exposes the related section and every card subelement to the shared canvas', () => {
    const adminPage = source(
      'src/admin/features/podoba/components/AdminProductAppearancePageClient.tsx'
    );
    const detail = source(
      'src/commercial/components/storefront/ProductDetailView.tsx'
    );
    const productCard = source(
      'src/commercial/components/storefront/ProductCard.tsx'
    );

    for (const elementId of [
      'product-related-title',
      'product-related-grid',
      'product-related-card',
      'product-related-card-image',
      'product-related-card-content',
      'product-related-card-category',
      'product-related-card-title',
      'product-related-card-description',
      'product-related-card-price',
      'product-related-card-action',
      'product-related-card-quantity',
      'product-related-card-add'
    ]) {
      expect(adminPage).toContain(`id: '${elementId}'`);
    }

    expect(adminPage).not.toContain("id: 'product-related-card-tax'");
    expect(adminPage).not.toContain("id: 'product-related-card-stock'");
    expect(productCard).not.toContain("'product-related-card-tax'");
    expect(productCard).not.toContain("'product-related-card-stock'");

    expect(detail).toContain("'product-related-title'");
    expect(detail).toContain("'product-related-grid'");
    expect(detail).toContain(
      'canvasWrapper={canvasEditor ? wrapCanvasElement : undefined}'
    );
    expect(productCard).toContain('canvasWrapper?: (');
    expect(productCard).toContain(
      "canvasId('listing-card', 'product-related-card')"
    );
    expect(productCard).toContain(
      "canvasId('card-description', 'product-related-card-description')"
    );
    expect(productCard).toContain('product.shortDescription');
    expect(productCard).toContain("'product-related-card-quantity'");
    expect(productCard).toContain("'product-related-card-add'");
  });
});
