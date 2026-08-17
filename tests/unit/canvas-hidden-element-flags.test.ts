import { expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, test } from 'node:test';

const source = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('appearance canvas hidden-element flags', () => {
  test('shared flag is zero-footprint, accessible, unclipped, and reversible', () => {
    const flagSource = source(
      'src/shared/ui/product-canvas/CanvasHiddenElementFlag.tsx'
    );

    expect(flagSource).toContain('data-canvas-hidden-placeholder');
    expect(flagSource).toContain('pointer-events-none absolute h-0 w-0');
    expect(flagSource).toContain('createPortal(');
    expect(flagSource).toContain('data-canvas-hidden-flag={elementId}');
    expect(flagSource).toContain('function HiddenEyeIcon');
    expect(flagSource).toContain('inline-flex h-6 max-w-36');
    expect(flagSource).toContain('<span className="truncate">{label}</span>');
    expect(flagSource).not.toContain('Skrito · {label}');
    expect(flagSource).toContain('role="dialog"');
    expect(flagSource).toContain('Element je odstranjen iz postavitve');
    expect(flagSource).toContain('Prikaži znova');
    expect(flagSource).toContain('onRestore();');
  });

  test('product and homepage editors replace hidden content instead of fading it', () => {
    const productElementSource = source(
      'src/shared/ui/product-canvas/ProductCanvasElement.tsx'
    );
    const homepageSource = source(
      'src/commercial/components/landing/HomepageRenderer.tsx'
    );
    const homepageAdminSource = source(
      'src/admin/features/podoba/components/AdminLandingPageClient.tsx'
    );

    expect(productElementSource).toContain('interactive && !settings.visible');
    expect(productElementSource).toContain('<CanvasHiddenElementFlag');
    expect(productElementSource).toContain("onChange?.(elementId, { visible: true })");

    expect(homepageSource).toContain('preview && !settings.visible');
    expect(homepageSource).toContain('preview && hidden');
    expect(homepageSource).toContain('hiddenCategories.map');
    expect(homepageSource).toContain('renderHiddenElementFlag');
    expect(homepageSource).toContain('onRestoreHiddenElement');
    expect(homepageAdminSource).toContain('function restoreHiddenElement(');
    expect(homepageAdminSource).toContain(
      'onRestoreHiddenElement={restoreHiddenElement}'
    );
  });
});
