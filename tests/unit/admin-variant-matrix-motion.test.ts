import { expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { test } from 'node:test';

const readSource = (relativePath: string) =>
  readFileSync(resolve(process.cwd(), relativePath), 'utf8').replace(/\r\n?/g, '\n');

const dimensionEditorSource = readSource(
  'src/admin/features/artikli/components/AdminItemEditorPage.tsx'
);
const weightEditorSource = readSource(
  'src/admin/features/artikli/components/pricing/DimensionProductPricingSectionsImpl.tsx'
);
const globalStyles = readSource('src/shared/styles/globals.css');

function sourceBetween(source: string, start: string, end: string): string {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex + start.length);
  expect(startIndex, `Missing source marker: ${start}`).toBeGreaterThanOrEqual(0);
  expect(endIndex, `Missing source marker: ${end}`).toBeGreaterThan(startIndex);
  return source.slice(startIndex, endIndex);
}

test('selected variant tracks stay fitted to their 320px input content', () => {
  const implementations = [
    {
      source: dimensionEditorSource,
      getTrack: 'const getDimensionVariantTrack = (variant: Variant, variantIndex: number) => {',
      gridColumns: 'const dimensionMatrixGridTemplateColumns = [',
      gridEnd: 'const dimensionMatrixMinWidth =',
      variantCollection: 'draft.variants',
      denseLayoutName: 'usesDenseDimensionVariantLayout',
      expandedVariantName: 'expandedDimensionVariant',
      expandedTrackWidthName: 'expandedDimensionVariantTrackWidth',
      baseTrackWidthsName: 'dimensionVariantBaseTrackWidths',
      baseWidthName: 'dimensionMatrixBaseWidth',
      occupiedWidthName: 'dimensionMatrixOccupiedWidth',
      remainderTrackName: 'dimensionMatrixRemainderTrack'
    },
    {
      source: weightEditorSource,
      getTrack: 'const getWeightVariantTrack = (variant: WeightVariant, variantIndex: number) => {',
      gridColumns: 'const weightMatrixGridTemplateColumns = [',
      gridEnd: 'const weightMatrixMinWidth =',
      variantCollection: 'weightData.variants',
      denseLayoutName: 'usesDenseWeightVariantLayout',
      expandedVariantName: 'expandedWeightVariant',
      expandedTrackWidthName: 'expandedWeightVariantTrackWidth',
      baseTrackWidthsName: 'weightVariantBaseTrackWidths',
      baseWidthName: 'weightMatrixBaseWidth',
      occupiedWidthName: 'weightMatrixOccupiedWidth',
      remainderTrackName: 'weightMatrixRemainderTrack'
    }
  ] as const;

  for (const implementation of implementations) {
    const layoutSource = sourceBetween(
      implementation.source,
      `const ${implementation.baseTrackWidthsName} =`,
      implementation.gridColumns
    );
    const trackSource = sourceBetween(
      implementation.source,
      implementation.getTrack,
      implementation.gridColumns
    );
    const nonDenseTrackSource = sourceBetween(
      trackSource,
      `if (!${implementation.denseLayoutName}) return`,
      '    const isCompressedInactive ='
    );
    const gridSource = sourceBetween(
      implementation.source,
      implementation.gridColumns,
      implementation.gridEnd
    );

    expect(layoutSource).toContain(
      `const ${implementation.baseTrackWidthsName} = ${implementation.variantCollection}.map((variant) =>`
    );
    expect(layoutSource).toContain(
      `205 + ${implementation.baseTrackWidthsName}.reduce((total, width) => total + width, 0);`
    );
    expect(trackSource).toContain(
      `const baseTrackWidth = ${implementation.baseTrackWidthsName}[variantIndex]`
    );
    expect(implementation.source).toContain(
      `const ${implementation.expandedTrackWidthName} = 336;`
    );
    expect(trackSource).toContain(
      `if (isExpanded) return \`\${${implementation.expandedTrackWidthName}}px\`;`
    );
    expect(nonDenseTrackSource).toContain('return `${baseTrackWidth}px`;');
    expect(nonDenseTrackSource).not.toContain('minmax(');
    expect(nonDenseTrackSource).not.toMatch(/\dfr|flexibleWidth/u);

    expect(layoutSource).toContain(`const ${implementation.remainderTrackName} =`);
    expect(layoutSource).toContain(`const ${implementation.occupiedWidthName} =`);
    expect(layoutSource).toContain(
      `? ${implementation.expandedTrackWidthName} - compact`
    );
    expect(layoutSource).toMatch(
      new RegExp(
        `${implementation.denseLayoutName}\\s*\\?\\s*'0px'`,
        'u'
      )
    );
    expect(layoutSource).toContain(
      '`calc(100% - ${' + implementation.occupiedWidthName + '}px)`'
    );
    expect(implementation.source).toContain(
      `return total + ${implementation.expandedTrackWidthName};`
    );
    // 336px = the 320px standardized field shell plus px-2 on both sides.
    expect(implementation.source).toContain('bg-sky-50/45 px-2 py-1');
    expect(implementation.source).toContain(
      'admin-dimension-variant-content-enter w-full max-w-[320px]'
    );

    // The trailing remainder is unconditional and remains after one mapped
    // track per variant, so selection never changes the grid-track topology.
    const variantTracksIndex = gridSource.indexOf(
      `...${implementation.variantCollection}.map(get`
    );
    const remainderTrackIndex = gridSource.indexOf(implementation.remainderTrackName);
    expect(variantTracksIndex).toBeGreaterThanOrEqual(0);
    expect(remainderTrackIndex).toBeGreaterThan(variantTracksIndex);
    expect(gridSource).not.toContain('.filter(');
    expect(gridSource).not.toMatch(/\?\s*\[/u);
  }
});

test('dimension and weight matrices share symmetric track, cell, and content timing', () => {
  for (const source of [dimensionEditorSource, weightEditorSource]) {
    expect(source).toContain(
      'className="admin-variant-matrix-track-transition grid min-w-full bg-transparent"'
    );
    expect(source).toContain('gridTemplateColumns:');
  }

  const trackTransitionRule = sourceBetween(
    globalStyles,
    '.admin-variant-matrix-track-transition {',
    '.admin-variant-matrix-row {'
  );
  expect(trackTransitionRule).toContain(
    'transition-property: grid-template-columns, min-width;'
  );
  expect(trackTransitionRule).toContain('transition-duration: 260ms;');
  expect(trackTransitionRule).toContain('transition-timing-function: ease-in-out;');

  const cellTransitionRule = sourceBetween(
    globalStyles,
    '.admin-variant-matrix-cell-transition {',
    '.admin-variant-matrix-diagonal-border {'
  );
  expect(cellTransitionRule).toContain(
    'transition-property: background-color, border-color, opacity;'
  );
  expect(cellTransitionRule).toContain('transition-duration: 260ms;');
  expect(cellTransitionRule).toContain('transition-timing-function: ease-in-out;');

  const contentTransitionRule = sourceBetween(
    globalStyles,
    '.admin-dimension-variant-content-enter {',
    '@media (prefers-reduced-motion: reduce) {'
  );
  expect(contentTransitionRule).toContain(
    'animation: admin-dimension-variant-content-enter 260ms ease-in-out both;'
  );

  expect(globalStyles).toContain(
    '.admin-variant-matrix-track-transition,\n  .admin-variant-matrix-cell-transition {\n    transition: none;'
  );
});

test('expanded and compact variant cells do not switch conditional width utility classes', () => {
  const matrixSections = [
    sourceBetween(
      dimensionEditorSource,
      'aria-label="Razli\u010dice artikla s polji v vrsticah"',
      'Neto cene so uredljive.'
    ),
    sourceBetween(
      weightEditorSource,
      'aria-label="Razli\u010dice artikla po masi s polji v vrsticah"',
      'Neto cene so uredljive.'
    )
  ];

  for (const matrixSource of matrixSections) {
    expect(matrixSource).not.toMatch(
      /\?\s*['"`]\s*(?:w|min-w|max-w)-\[[^'"`]+['"`]/u
    );
    expect(matrixSource).not.toMatch(
      /:\s*['"`]\s*(?:w|min-w|max-w)-\[[^'"`]+['"`]/u
    );
  }
});
