import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const source = (relativePath: string) =>
  readFileSync(resolve(process.cwd(), relativePath), 'utf8').replace(/\r\n?/gu, '\n');

test('confirmation prices use integer cents and basis points for tax and reconciliation', () => {
  const summarySource = source(
    'src/commercial/order/components/OrderConfirmationSummary.tsx'
  );

  assert.match(
    summarySource,
    /function moneyToCents\(value: number\) \{\n  return BigInt\(Math\.round\(value \* 100\)\);\n\}/u
  );
  assert.match(
    summarySource,
    /const taxBasisPoints = BigInt\(Math\.round\(safeTaxRate \* 10_000\)\);/u
  );
  assert.match(
    summarySource,
    /const taxCents = \(netCents \* taxBasisPoints \+ 5_000n\) \/ 10_000n;/u
  );
  assert.match(
    summarySource,
    /moneyToCents\(unitListGross\) \* BigInt\(item\.quantity\) === moneyToCents\(lineListGross\)/u
  );
  assert.match(
    summarySource,
    /const difference = moneyToCents\(minuend\) - moneyToCents\(subtrahend\);/u
  );
});

test('confirmation VAT rows group reconciled rates and preserve authoritative totals', () => {
  const summarySource = source(
    'src/commercial/order/components/OrderConfirmationSummary.tsx'
  );

  assert.match(
    summarySource,
    /taxByRate\.set\(rate, \(taxByRate\.get\(rate\) \?\? 0n\) \+ moneyToCents\(item\.lineTax\)\);/u
  );
  assert.match(
    summarySource,
    /if \(rows\.length === 1\) \{\n    return \[\{ rate: rows\[0\]\.rate, amount: totalTax \}\];\n  \}/u
  );
  assert.match(
    summarySource,
    /groupedTax !== moneyToCents\(totalTax\)/u
  );
  assert.match(
    summarySource,
    /return \[\{ rate: null, amount: totalTax \}\];/u
  );
  assert.match(
    summarySource,
    /label="Vmesna vsota brez DDV"/u
  );
  assert.match(
    summarySource,
    /taxRow\.rate === null \? 'DDV' : `DDV \(\$\{formatPercent\(taxRow\.rate \* 100\)\}\)`/u
  );
  assert.match(summarySource, />Skupaj za plačilo<\/dt>/u);
});

test('confirmation discounts require explicit quantity or variant provenance', () => {
  const summarySource = source(
    'src/commercial/order/components/OrderConfirmationSummary.tsx'
  );
  const contractsSource = source('src/commercial/order/contracts.ts');

  assert.match(contractsSource, /discountKind: 'quantity' \| 'variant' \| null;/u);
  assert.match(summarySource, /item\.discountKind === 'quantity'/u);
  assert.match(summarySource, /item\.discountKind === 'variant'/u);
  assert.doesNotMatch(`${contractsSource}\n${summarySource}`, /discountKind[^\n]*['"]other['"]/u);
  assert.doesNotMatch(summarySource, /discountKind\s*\?\?/u);
});
