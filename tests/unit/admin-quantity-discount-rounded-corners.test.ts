import { expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { test } from 'node:test';

const readSource = (relativePath: string) =>
  readFileSync(resolve(process.cwd(), relativePath), 'utf8').replace(/\r\n?/g, '\n');

const quantityDiscountCardSource = readSource(
  'src/admin/features/artikli/components/pricing/QuantityDiscountsCard.tsx'
);
const editorSource = readSource(
  'src/admin/features/artikli/components/AdminItemEditorPage.tsx'
);
const productModuleSource = readSource(
  'src/admin/features/artikli/components/pricing/DimensionProductPricingSectionsImpl.tsx'
);

function sourceBetween(source: string, start: string, end: string): string {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex + start.length);
  expect(startIndex, `Missing source marker: ${start}`).toBeGreaterThanOrEqual(0);
  expect(endIndex, `Missing source marker: ${end}`).toBeGreaterThan(startIndex);
  return source.slice(startIndex, endIndex);
}

test('embedded quantity-discount card clips both lower corners inside its bordered host', () => {
  const cardMarkup = sourceBetween(
    quantityDiscountCardSource,
    '  return (',
    '\nexport default QuantityDiscountsCard;'
  );
  const sectionOpening = sourceBetween(cardMarkup, '<section', '<div className={classNames');

  expect(sectionOpening).toContain(
    "embedded ? 'overflow-hidden rounded-b-[7px] border-t border-slate-200 bg-white' : adminWindowCardClassName"
  );
  expect(sectionOpening).toContain("!embedded && 'h-full p-5'");

  // The host owns the outer bottom/side border. The embedded section only clips
  // square row backgrounds to the host's inner radius, including the empty row.
  expect(sectionOpening).not.toMatch(/\bborder-(?:b|x|l|r)\b/u);
});

test('horizontal table scrolling stays inside the rounded embedded section', () => {
  const tableScroller = sourceBetween(
    quantityDiscountCardSource,
    "<div className={classNames('overflow-x-auto'",
    '<table className='
  );
  const tableMarkup = sourceBetween(
    quantityDiscountCardSource,
    '<table className=',
    '</table>'
  );

  expect(tableScroller).toContain("!embedded && 'rounded-lg border border-slate-200'");
  expect(tableScroller).not.toContain(", embedded && 'rounded");
  expect(tableMarkup).not.toMatch(/rounded-b(?:l|r)?-/u);
  expect(tableMarkup).toContain('Ni aktivnih koli\u010dinskih popustov.');
});

test('dimension, weight, and simple article editors all use the shared embedded card', () => {
  const embeddedCalls = editorSource.match(/<QuantityDiscountsCard\b[\s\S]*?\/>/gu) ?? [];

  expect(embeddedCalls).toHaveLength(3);
  for (const call of embeddedCalls) {
    expect(call).toMatch(/\n\s+embedded\n/u);
    expect(call).not.toContain('className=');
  }

  const dimensionSalesBranch = sourceBetween(
    editorSource,
    "{isDimensionBasedMode ? (",
    ") : productType === 'weight' ? ("
  );
  const weightSalesBranch = sourceBetween(
    editorSource,
    ") : productType === 'weight' ? (",
    ") : productType === 'unique_machine' ? ("
  );
  const simpleSalesBranch = sourceBetween(
    editorSource,
    ') : (\n        <SimpleProductModule',
    '\n      )}\n      </div>'
  );

  expect(dimensionSalesBranch).toContain('<QuantityDiscountsCard');
  expect(weightSalesBranch).toContain('quantityDiscountsPanel={(');
  expect(weightSalesBranch).toContain('<QuantityDiscountsCard');
  expect(simpleSalesBranch).toContain('quantityDiscountsPanel={(');
  expect(simpleSalesBranch).toContain('<QuantityDiscountsCard');
});

test('embedded corner clipping does not move to variant hosts or individual table cells', () => {
  expect(editorSource).toContain(
    '<div className="relative rounded-lg border border-slate-200">'
  );
  expect(productModuleSource).toContain(
    '<div className="relative mt-3 rounded-lg border border-slate-200">'
  );
  expect(productModuleSource).toContain(
    "const machinePanelClassName = 'overflow-hidden rounded-lg border border-slate-200 bg-white';"
  );

  // Dimension/weight hosts deliberately stay overflow-visible for drag overlays,
  // slanted headers, and focus effects; the shared embedded section is sufficient.
  expect(editorSource).not.toContain(
    '<div className="relative overflow-hidden rounded-lg border border-slate-200">'
  );
  expect(productModuleSource).not.toContain(
    '<div className="relative mt-3 overflow-hidden rounded-lg border border-slate-200">'
  );
});
