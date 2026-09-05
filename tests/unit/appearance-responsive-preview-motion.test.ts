import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, test } from 'node:test';
import {
  appearancePreviewTransitionDurationMs,
  appearancePreviewTransitionEasing,
  easeAppearancePreviewProgress,
  interpolateAppearancePreviewValue,
  preserveAdjacentAppearancePreviewDevice,
  roundAppearancePreviewValue
} from '@/shared/ui/responsive-preview-motion';

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}

describe('shared appearance responsive preview motion', () => {
  test('uses the established homepage timing and monotonic easing curve', () => {
    assert.equal(appearancePreviewTransitionDurationMs, 420);
    assert.equal(appearancePreviewTransitionEasing, 'cubic-bezier(0.4, 0, 0.2, 1)');

    const samples = Array.from({ length: 101 }, (_, index) => (
      easeAppearancePreviewProgress(index / 100)
    ));
    assert.ok(samples[0] >= 0 && samples[0] < 0.001);
    assert.ok(samples.at(-1)! > 0.999 && samples.at(-1)! <= 1);
    samples.slice(1).forEach((sample, index) => {
      assert.ok(sample >= samples[index], `easing reversed at sample ${index + 1}`);
      assert.ok(sample >= 0 && sample <= 1);
    });
    assert.equal(interpolateAppearancePreviewValue(390, 1120, 0.5), 755);
    assert.equal(roundAppearancePreviewValue(755.12345), 755.123);
  });

  test('homepage and product previews consume one shared motion standard', () => {
    const homepage = source(
      'src/admin/features/podoba/components/AdminLandingPageClient.tsx'
    );
    const product = source(
      'src/admin/features/podoba/components/AdminProductAppearancePageClient.tsx'
    );
    const productLivePreview = source(
      'src/admin/features/podoba/components/ProductAppearanceLivePreview.tsx'
    );

    assert.match(homepage, /from '@\/shared\/ui\/responsive-preview-motion'/u);
    assert.match(homepage, /appearancePreviewTransitionDurationMs as previewViewportTransitionDurationMs/u);
    assert.match(product, /useAppearanceResponsivePreviewMotion/u);
    assert.match(product, /device=\{previewMotion\.renderDevice\}/u);
    assert.match(product, /transitioning=\{previewMotion\.phase === 'animating'\}/u);
    assert.equal((product.match(/data-testid="product-preview-stage"/gu) ?? []).length, 2);
    assert.equal((product.match(/data-testid="product-preview-frame"/gu) ?? []).length, 2);
    assert.doesNotMatch(product, /const previewWidth =/u);
    assert.doesNotMatch(product, /previewMotion\.geometry\.renderedWidth/u);
    assert.doesNotMatch(product, /transition-\[width\]/u);
    assert.doesNotMatch(product, /transition-all \$\{previewWidth\}/u);
    assert.match(productLivePreview, /appearancePreviewMotionEventName/u);
    assert.match(productLivePreview, /content\.style\.width/u);
    assert.match(productLivePreview, /motionLogicalWidth/u);
  });

  test('holds an adjacent responsive device at its crossed boundary', () => {
    const devices = ['desktop', 'tablet', 'mobile'] as const;
    const resolveDevice = (logicalWidth: number) => {
      if (logicalWidth < 600) return 'mobile' as const;
      if (logicalWidth < 1_000) return 'tablet' as const;
      return 'desktop' as const;
    };
    const startGeometry = { logicalWidth: 1_600, renderedWidth: 1_120 };
    const targetGeometry = { logicalWidth: 390, renderedWidth: 390 };
    const step = preserveAdjacentAppearancePreviewDevice({
      currentDevice: 'desktop',
      candidateGeometry: targetGeometry,
      startGeometry,
      targetGeometry,
      orderedDevices: devices,
      resolveDevice
    });

    assert.equal(step.device, 'tablet');
    assert.equal(step.heldIntermediateDevice, true);
    assert.equal(resolveDevice(step.geometry.logicalWidth), step.device);
    assert.ok(Math.abs(step.geometry.logicalWidth - 1_000) < 0.01);
    assert.ok(step.geometry.renderedWidth > 390);
    assert.ok(step.geometry.renderedWidth < 1_120);

    const reverseStep = preserveAdjacentAppearancePreviewDevice({
      currentDevice: 'mobile',
      candidateGeometry: startGeometry,
      startGeometry: targetGeometry,
      targetGeometry: startGeometry,
      orderedDevices: devices,
      resolveDevice
    });
    assert.equal(reverseStep.device, 'tablet');
    assert.equal(reverseStep.heldIntermediateDevice, true);
    assert.equal(resolveDevice(reverseStep.geometry.logicalWidth), reverseStep.device);
    assert.ok(Math.abs(reverseStep.geometry.logicalWidth - 600) < 0.01);
  });
});
