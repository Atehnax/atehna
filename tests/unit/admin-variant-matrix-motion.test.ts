import { expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { getVariantMatrixLayout } from '../../src/admin/features/artikli/components/variantMatrixLayout';

for (const count of [1, 4, 12, 13, 20, 60, 200]) {
  test(`${count} variants keep compatible pixel tracks and stable scroll width while expanding`, () => {
    const indices = [-1, 0, Math.floor(count / 2), count - 1];
    const layouts = indices.map(index => getVariantMatrixLayout(count, index));
    expect(new Set(layouts.map(layout => layout.minWidth)).size).toBe(1);
    layouts.forEach((layout, index) => {
      const tracks = layout.gridTemplateColumns.match(/minmax\([^)]+\)|[^ ]+/g)!;
      expect(tracks).toHaveLength(count + 2);
      expect(tracks[0]).toBe('205px');
      expect(tracks.at(-1)).toBe('minmax(0px, 1fr)');
      tracks.slice(1, -1).forEach((track, variantIndex) => {
        expect(track).toBe(`${variantIndex === indices[index] ? 336 : layout.compactWidth}px`);
      });
      expect(layout.minWidth).toBeGreaterThanOrEqual(205 + (count - 1) * layout.compactWidth + 336);
    });
  });
}

const source = (file: string) => readFileSync(file, 'utf8').replace(/\r\n?/g, '\n');
const editors = [source('src/admin/features/artikli/components/AdminItemEditorPage.tsx'), source('src/admin/features/artikli/components/pricing/DimensionProductPricingSectionsImpl.tsx')];
const styles = source('src/shared/styles/globals.css');

test('both editors share the pixel layout and delegated visual hover', () => {
  for (const editor of editors) {
    expect(editor).toContain('getVariantMatrixLayout(');
    expect(editor).toContain('useVariantMatrixHover()');
    expect(editor).not.toContain('Skrči neaktivne');
    expect(editor).not.toContain('Razširi izbrano');
    expect(editor).not.toContain('Polja v stolpcih');
    expect(editor).not.toMatch(/const \[hovered(?:Dimension|Weight)VariantId/);
  }
});

test('grid-only animation respects reduced motion', () => {
  const trackRule = styles.slice(styles.indexOf('.admin-variant-matrix-track-transition {'), styles.indexOf('.admin-variant-matrix-row {'));
  expect(trackRule).toContain('transition-property: grid-template-columns;');
  expect(trackRule).not.toContain('min-width');
  expect(trackRule).toContain('transition-duration: 260ms;');
  expect(styles).toContain('.admin-variant-matrix-track-transition,\n  .admin-variant-matrix-cell-transition {\n    transition: none;');
});

test('header and body boundaries use a single continuous pixel edge', () => {
  const edge = source('src/admin/features/artikli/components/VariantMatrixHeaderEdge.tsx');
  expect(edge).toContain('strokeWidth="1"');
  expect(edge).toContain('vectorEffect="non-scaling-stroke"');
  for (const editor of editors) {
    expect(editor).toContain('<VariantMatrixHeaderEdge');
    const matrix = editor.slice(editor.indexOf('aria-label="Različice artikla'));
    expect(matrix).not.toContain('overflow-hidden border-x');
    expect(matrix).not.toContain('grid min-h-[38px] border-b');
  }
  expect(styles).toContain('box-shadow: inset 0 -1px');
});
