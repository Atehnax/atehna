import { expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, test } from 'node:test';
import { resolveProductDescriptionFontSize } from '@/admin/features/podoba/components/ProductDescriptionRichTextEditor';
import { clampAppearanceEditorNumberInput } from '@/admin/features/podoba/components/AppearanceEditorToolbarPrimitives';

describe('product appearance toolbar parity contracts', () => {
  test('description typography reports the selected or inherited font size', () => {
    expect(resolveProductDescriptionFontSize('18px', 16)).toBe('18');
    expect(resolveProductDescriptionFontSize('13.5px', 16)).toBe('13.5');
    expect(resolveProductDescriptionFontSize(null, 22)).toBe('22');
    expect(resolveProductDescriptionFontSize(undefined, 0)).toBe('16');
  });

  test('appearance number drafts clamp only the committed numeric value', () => {
    expect(clampAppearanceEditorNumberInput(44, 8, 64)).toBe(44);
    expect(clampAppearanceEditorNumberInput(4, 8, 64)).toBe(8);
    expect(clampAppearanceEditorNumberInput(120, 72, 180)).toBe(120);
    expect(clampAppearanceEditorNumberInput(220, 72, 180)).toBe(180);
  });

  test('source exposes semantic device controls and inline/floating toolbar markers', () => {
    const editorSource = readFileSync(
      resolve(
        process.cwd(),
        'src/admin/features/podoba/components/AdminProductAppearancePageClient.tsx'
      ),
      'utf8'
    );
    const toolbarSource = readFileSync(
      resolve(
        process.cwd(),
        'src/admin/features/podoba/components/ProductAppearanceContextToolbar.tsx'
      ),
      'utf8'
    );
    const toolbarPrimitivesSource = readFileSync(
      resolve(
        process.cwd(),
        'src/admin/features/podoba/components/AppearanceEditorToolbarPrimitives.tsx'
      ),
      'utf8'
    );
    const descriptionEditorSource = readFileSync(
      resolve(
        process.cwd(),
        'src/admin/features/podoba/components/ProductDescriptionRichTextEditor.tsx'
      ),
      'utf8'
    );
    const globalStylesSource = readFileSync(
      resolve(process.cwd(), 'src/shared/styles/globals.css'),
      'utf8'
    );
    const sharedPopoverClassUses = (
      `${editorSource}\n${toolbarSource}`.match(
        /appearanceEditorToolbarPopoverSurfaceClassName/g
      ) ?? []
    ).length;

    expect(editorSource).toContain('aria-label="Stran predogleda"');
    expect(editorSource).toContain('aria-label="Odzivni predogled"');
    expect(editorSource).toContain('data-product-preview-controls');
    expect(editorSource).toContain('<PreviewDeviceIcon');
    expect(editorSource).toContain("page === 'listing'");
    expect(editorSource).toContain('? List');
    expect(editorSource).toContain('? Package');
    expect(editorSource).toContain(': ShoppingCart');
    expect(editorSource).toContain('data-toolbar-mode="inline"');
    expect(editorSource).toContain('data-toolbar-placement="inline"');
    expect(editorSource).toContain('data-toolbar-ready="true"');

    expect(editorSource).toContain('FloatingAppearanceEditorContextToolbar');
    expect(toolbarSource).toContain('AppearanceEditorToolbarToneProvider');
    expect(toolbarPrimitivesSource).toContain("import { createPortal } from 'react-dom'");
    expect(toolbarPrimitivesSource).toContain('data-product-toolbar-anchor-id=');
    expect(toolbarPrimitivesSource).toContain('data-toolbar-mode="floating"');
    expect(toolbarPrimitivesSource).toContain('data-toolbar-placement=');
    expect(toolbarPrimitivesSource).toContain('data-toolbar-ready=');
    expect(toolbarPrimitivesSource).toContain('bg-black/90');
    expect(toolbarPrimitivesSource).toContain(
      'export const appearanceEditorToolbarPopoverSurfaceClassName'
    );
    expect(editorSource).toContain(
      '${appearanceEditorToolbarPopoverSurfaceClassName}'
    );
    expect(toolbarSource).toContain(
      '${appearanceEditorToolbarPopoverSurfaceClassName}'
    );
    expect(
      sharedPopoverClassUses,
      'inline and floating toolbar menus should consume the shared black-glass surface'
    ).toBeGreaterThanOrEqual(5);
    expect(toolbarSource).toContain('data-product-toolbar-dark-controls');
    expect(toolbarSource).toContain(
      "const preferredSide = toolbarPlacement === 'top' ? 'above' : 'below';"
    );
    expect(toolbarSource).toContain(
      'data-product-toolbar-popover-side={panelLayout.side}'
    );
    expect(toolbarSource).toContain(
      'data-testid="product-variant-select-size-controls"'
    );
    expect(toolbarSource).toContain(
      'data-testid="product-variant-chip-size-controls"'
    );
    expect(toolbarSource).toContain(
      'data-testid={`product-variant-chip-${key}`}'
    );
    expect(toolbarSource).toContain(
      'data-testid={`product-variant-select-${key}`}'
    );
    expect(toolbarSource).toContain('onVariantsChange({');
    expect(editorSource).toContain('variants={config.variants}');
    expect(editorSource).toContain(
      "onVariantsChange={(updates) => updateSection('variants', updates)}"
    );
    expect(toolbarSource).toContain('<ProductDescriptionRichTextEditor');
    expect(toolbarSource).not.toMatch(
      /selectedElementId === 'product-description'[\s\S]{0,1800}<textarea/
    );
    expect(descriptionEditorSource).toContain(
      'data-testid="product-description-rich-text-editor"'
    );
    expect(descriptionEditorSource).toContain('StarterKit.configure');
    expect(descriptionEditorSource).toContain('toggleBold');
    expect(descriptionEditorSource).toContain('toggleBulletList');
    expect(descriptionEditorSource).toContain('setTextAlign');
    expect(descriptionEditorSource).toContain("fontSize: `${parsed}px`");
    expect(descriptionEditorSource).toContain(
      "?.getAttributes('textStyle')"
    );
    expect(toolbarSource).toContain(
      'defaultFontSizePx={settings?.fontSizePx ?? 0}'
    );
    expect(globalStylesSource).toMatch(
      /\[data-product-toolbar-dark-controls\]\s*\{[^}]*color-scheme:\s*dark;[^}]*\}/s
    );
    expect(globalStylesSource).toMatch(
      /\[data-product-toolbar-dark-controls\]\s+select\s*\{[^}]*color-scheme:\s*dark;[^}]*background-color:[^}]*color:[^}]*\}/s
    );
    expect(globalStylesSource).toMatch(
      /\[data-product-toolbar-dark-controls\]\s+select\s+option\s*\{[^}]*background-color:[^}]*color:[^}]*\}/s
    );
    expect(globalStylesSource).toMatch(
      /\[data-product-toolbar-dark-controls\]\s+select\s+option:checked\s*\{[^}]*background-color:[^}]*color:[^}]*\}/s
    );
    expect(globalStylesSource).toMatch(
      /\[data-product-toolbar-dark-controls\]\s+select\s+option:disabled\s*\{[^}]*color:[^}]*\}/s
    );
  });
});
