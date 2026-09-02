import { expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, test } from 'node:test';
import {
  DEFAULT_PRODUCT_APPEARANCE_CONFIG,
  normalizeProductAppearanceConfig,
  toStoredProductAppearanceConfig
} from '@/shared/domain/style/productAppearance';

const purchaseCopyKeys = [
  'priceSelectionPrompt',
  'grossPriceLabel',
  'netPriceLabel',
  'taxLabel',
  'savingsLabel',
  'selectVariantLabel',
  'selectVariantDetail',
  'inactiveVariantLabel',
  'inactiveVariantDetail',
  'outOfStockLabel',
  'outOfStockDetail',
  'insufficientStockLabel',
  'insufficientStockDetail',
  'inStockLabel',
  'inStockDetail',
  'confirmationAvailabilityLabel',
  'confirmationAvailabilityDetail',
  'variantLabel',
  'skuLabel',
  'minimumOrderLabel',
  'quantityLabel',
  'decreaseQuantityLabel',
  'increaseQuantityLabel',
  'selectOptionsActionLabel',
  'addToCartActionLabel',
  'unavailableActionLabel',
  'deliveryFallbackMessage',
  'paymentMessage',
  'secondaryActionLabel'
] as const;

const source = (path: string) =>
  readFileSync(resolve(process.cwd(), path), 'utf8');

describe('product purchase copy contracts', () => {
  test('supplies complete defaults and preserves normalized copy through storage', () => {
    const defaults = DEFAULT_PRODUCT_APPEARANCE_CONFIG.purchaseArea.copy;

    expect(Object.keys(defaults).sort()).toEqual([...purchaseCopyKeys].sort());
    expect(defaults).toMatchObject({
      grossPriceLabel: 'z DDV',
      netPriceLabel: 'brez DDV',
      taxLabel: 'DDV',
      inStockDetail: 'Na voljo: {stock} {unit}',
      insufficientStockDetail: expect.stringContaining('{minimum}'),
      quantityLabel: 'Količina',
      minimumOrderLabel: 'Minimalno naročilo',
      addToCartActionLabel: 'Dodaj v košarico'
    });
    expect(defaults.deliveryFallbackMessage).toBe(
      'Predvideni rok sporočimo ob potrditvi naročila.'
    );

    expect(
      normalizeProductAppearanceConfig({
        purchaseArea: {
          copy: {
            deliveryFallbackMessage:
              'Predvideni rok pošljemo po e-pošti.'
          }
        }
      }).purchaseArea.copy.deliveryFallbackMessage
    ).toBe('Predvideni rok pošljemo po e-pošti.');
    expect(
      normalizeProductAppearanceConfig({
        purchaseArea: {
          copy: {
            minimumOrderLabel: 'Najmanjše naročilo'
          }
        }
      }).purchaseArea.copy.minimumOrderLabel
    ).toBe('Minimalno naročilo');


    const normalized = normalizeProductAppearanceConfig({
      purchaseArea: {
        copy: {
          grossPriceLabel: '  tax included  ',
          netPriceLabel: '',
          inStockDetail: '  Available: {stock} {unit}  ',
          insufficientStockDetail:
            'Only {stock} {unit}; minimum {minimum} {unit}.',
          paymentMessage: `  ${'x'.repeat(360)}  `,
          addToCartActionLabel: '  Add item  '
        }
      }
    });

    expect(normalized.purchaseArea.copy).toMatchObject({
      grossPriceLabel: 'tax included',
      netPriceLabel: defaults.netPriceLabel,
      inStockDetail: 'Available: {stock} {unit}',
      insufficientStockDetail:
        'Only {stock} {unit}; minimum {minimum} {unit}.',
      paymentMessage: 'x'.repeat(320),
      addToCartActionLabel: 'Add item'
    });
    expect(normalized.purchaseArea.copy).not.toHaveProperty(
      ['free', 'ShippingMessage'].join('')
    );

    const stored = toStoredProductAppearanceConfig(normalized);
    expect(stored.purchaseArea.copy).toEqual(normalized.purchaseArea.copy);
    expect(normalizeProductAppearanceConfig(stored).purchaseArea.copy).toEqual(
      normalized.purchaseArea.copy
    );
    expect(stored).not.toHaveProperty('updatedAt');
  });

  test('wires every purchase selection to the contextual content editor', () => {
    const toolbarSource = source(
      'src/admin/features/podoba/components/ProductAppearanceContextToolbar.tsx'
    );
    const adminPageSource = source(
      'src/admin/features/podoba/components/AdminProductAppearancePageClient.tsx'
    );

    for (const elementId of [
      'product-purchase',
      'product-price',
      'product-availability',
      'product-summary',
      'product-quantity',
      'product-minimum-order',
      'product-primary-action',
      'product-delivery',
      'product-secondary-action'
    ]) {
      expect(toolbarSource).toContain(`'${elementId}'`);
      expect(adminPageSource).toContain(`id: '${elementId}'`);
    }

    const purchasePanelSource = source(
      'src/commercial/components/storefront/PurchasePanel.tsx'
    );
    for (const elementId of [
      'product-quantity-label',
      'product-quantity-controls',
      'product-quantity-decrease',
      'product-quantity-input',
      'product-quantity-increase'
    ]) {
      expect(purchasePanelSource).toContain(`'${elementId}'`);
      expect(adminPageSource).toContain(`id: '${elementId}'`);
    }

    for (const nestedElementId of [
      'product-quantity-stepper',
      'product-quantity-value',
      'product-quantity-unit'
    ]) {
      expect(purchasePanelSource).not.toContain(`'${nestedElementId}'`);
      expect(adminPageSource).not.toContain(`id: '${nestedElementId}'`);
    }

    const globalStylesSource = source('src/shared/styles/globals.css');
    expect(purchasePanelSource).toContain(
      'storefront-product-quantity-stepper'
    );
    expect(purchasePanelSource).not.toContain(
      'storefront-product-quantity-stepper-canvas'
    );
    expect(globalStylesSource).toContain(
      'height: calc(2.5rem / var(--commercial-storefront-scale));'
    );

    expect(toolbarSource).toContain(
      "selectedElementId === 'product-purchase'"
    );
    expect(toolbarSource).toContain(
      'purchaseCopyGroups.some((group) => group.id === purchaseCopyElementId)'
    );
    expect(toolbarSource).toContain(
      'data-testid={`product-purchase-copy-${field.key}`}'
    );
    expect(toolbarSource).toContain('...purchaseArea.copy');
    expect(toolbarSource).toContain('[key]: value');
    expect(adminPageSource).toContain('purchaseArea={config.purchaseArea}');
    expect(adminPageSource).toContain(
      "onPurchaseAreaChange={(updates) => updateSection('purchaseArea', updates)}"
    );
    expect(purchasePanelSource).toContain(
      "appearance.purchaseArea.showMinimumOrder && variant && variant.minOrder > 1"
    );
    expect(purchasePanelSource).toContain("'product-minimum-order'");
    expect(purchasePanelSource).toContain(
      '<span>{copy.minimumOrderLabel}</span>: {variant.minOrder}'
    );
    expect(adminPageSource).toContain(
      "id: 'product-minimum-order'"
    );
  });

  test('shared storefront renderers consume configured copy, including mobile CTA', () => {
    const purchasePanelSource = source(
      'src/commercial/components/storefront/PurchasePanel.tsx'
    );
    const availabilitySource = source(
      'src/commercial/components/storefront/Availability.tsx'
    );
    const priceSource = source(
      'src/commercial/components/storefront/PriceBreakdown.tsx'
    );
    const detailSource = source(
      'src/commercial/components/storefront/ProductDetailView.tsx'
    );

    for (const key of [
      'priceSelectionPrompt',
      'variantLabel',
      'skuLabel',
      'minimumOrderLabel',
      'quantityLabel',
      'decreaseQuantityLabel',
      'increaseQuantityLabel',
      'selectOptionsActionLabel',
      'addToCartActionLabel',
      'unavailableActionLabel',
      'deliveryFallbackMessage',
      'paymentMessage',
      'secondaryActionLabel'
    ]) {
      expect(purchasePanelSource).toContain(`copy.${key}`);
    }

    for (const key of [
      'selectVariantLabel',
      'selectVariantDetail',
      'inactiveVariantLabel',
      'inactiveVariantDetail',
      'outOfStockLabel',
      'outOfStockDetail',
      'insufficientStockLabel',
      'insufficientStockDetail',
      'inStockLabel',
      'inStockDetail',
      'confirmationAvailabilityLabel',
      'confirmationAvailabilityDetail'
    ]) {
      expect(availabilitySource).toContain(`copy.${key}`);
    }
    expect(availabilitySource).toContain(
      'renderTemplate(copy.insufficientStockDetail'
    );
    expect(availabilitySource).toContain(
      'renderTemplate(copy.inStockDetail'
    );

    for (const key of [
      'grossPriceLabel',
      'netPriceLabel',
      'taxLabel',
      'savingsLabel'
    ]) {
      expect(priceSource).toContain(`copy.${key}`);
    }

    expect(detailSource).toContain(
      'canvasWrapper={canvasEditor ? wrapCanvasElement : undefined}'
    );
    expect(detailSource).toContain(
      'appearance.purchaseArea.copy.addToCartActionLabel'
    );
    expect(detailSource).toContain(
      'appearance.purchaseArea.copy.unavailableActionLabel'
    );
    const shippingMessage =
      'Poštnina se izračuna v košarici glede na skupno težo in mere.';
    expect(purchasePanelSource).toContain(shippingMessage);
    expect(detailSource).toContain(shippingMessage);
    expect(purchasePanelSource).not.toMatch(/free.?Shipping|Brezplačn[a]? dostav/u);
    expect(detailSource).not.toMatch(/free.?Shipping|Brezplačn[a]? dostav/u);
  });
});
