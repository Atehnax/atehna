import { expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, test } from 'node:test';

const source = (relativePath: string) => readFileSync(
  resolve(process.cwd(), relativePath),
  'utf8'
);

describe('product appearance individual controls and multi-selection contracts', () => {
  test('delivery and payment can be selected, edited, hidden, or removed independently', () => {
    const detailSource = source(
      'src/commercial/components/storefront/ProductDetailView.tsx'
    );
    const editorSource = source(
      'src/admin/features/podoba/components/AdminProductAppearancePageClient.tsx'
    );
    const toolbarSource = source(
      'src/admin/features/podoba/components/ProductAppearanceContextToolbar.tsx'
    );

    expect(detailSource).toContain(
      "canvasElementId: 'product-delivery-and-payment'"
    );
    expect(editorSource).toContain(
      "{ id: 'product-delivery-and-payment', label: 'Dostava in plačilo'"
    );
    expect(toolbarSource).toContain(
      "selectedElementId === 'product-delivery-and-payment'"
    );
    expect(toolbarSource).toContain("? 'product-delivery' : selectedElementId");
    expect(editorSource).toContain('function removeSelectedCanvasElements()');
    expect(editorSource).toContain(
      "for (const device of ['desktop', 'tablet', 'mobile'] as const)"
    );
  });

  test('dropdown fields and buttons expose independent responsive canvas boundaries', () => {
    const listingSource = source(
      'src/commercial/components/storefront/ProductListing.tsx'
    );
    const variantsSource = source(
      'src/commercial/components/storefront/VariantSelector.tsx'
    );
    const purchaseSource = source(
      'src/commercial/components/storefront/PurchasePanel.tsx'
    );
    const editorSource = source(
      'src/admin/features/podoba/components/AdminProductAppearancePageClient.tsx'
    );

    expect(listingSource).toContain('`listing-view-${candidate}`');
    expect(listingSource).toContain("'listing-sort'");
    expect(variantsSource).toContain(
      '`product-variant-thickness-option-${groupIndex + 1}`'
    );
    expect(variantsSource).toContain(
      '`${controlCanvasId}-option-${optionIndex + 1}`'
    );
    for (const elementId of [
      'product-quantity-decrease',
      'product-quantity-input',
      'product-quantity-increase'
    ]) {
      expect(purchaseSource).toContain("'" + elementId + "'");
      expect(editorSource).toContain("id: '" + elementId + "'");
    }
    expect(editorSource).toContain(
      'resolveProductCanvasElementDeviceSettings(config, elementId, device)'
    );
  });

  test('Ctrl click accumulates selection and batch actions operate on the selected ids', () => {
    const canvasSource = source(
      'src/shared/ui/product-canvas/ProductCanvasElement.tsx'
    );
    const editorSource = source(
      'src/admin/features/podoba/components/AdminProductAppearancePageClient.tsx'
    );
    const toolbarSource = source(
      'src/admin/features/podoba/components/ProductAppearanceContextToolbar.tsx'
    );
    const layersPanelSource = source(
      'src/admin/features/podoba/components/ProductAppearanceLayersPanel.tsx'
    );

    expect(canvasSource).toContain('additive: event.ctrlKey || event.metaKey');
    expect(canvasSource).toContain('preserveExisting: true');
    expect(editorSource).toContain(
      'const [selectedCanvasElementIds, setSelectedCanvasElementIds]'
    );
    expect(editorSource).toContain('if (options.additive)');
    expect(editorSource).toContain('function updateSelectedCanvasElements(');
    expect(editorSource).toContain('if (moveSelection)');
    expect(editorSource).toContain(
      'for (const selectedId of selectedCanvasElementIds)'
    );
    expect(layersPanelSource).toContain('selected={selected.has(item.id)}');
    expect(toolbarSource).toContain('onRemove: () => void;');
  });
});
