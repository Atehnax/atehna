import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  calculatePricingStockRow, compilePricingStockFormula, createDefaultPricingStockModel, DEFAULT_PRICING_STOCK_FORMULA,
  PRICING_STOCK_FORMULA_SYMBOLS, pricingFormulaDraftToCanonical, pricingFormulaDraftToShort,
  pricingFormulaToCanonical, pricingFormulaToShort, pricingFormulaMathTree, type PricingFormulaMathNode
} from '@/shared/domain/pricingStock';
import { PricingFormulaMath } from '@/admin/features/artikli/components/pricing-stock/PricingFormulaMath';

const shortDefault = 'v + (t / 60) * ((n * c + f + p) / (n * h * u))';
const render = (formula: string) => renderToStaticMarkup(createElement(PricingFormulaMath, { formula }));
function flatten(node: PricingFormulaMathNode): PricingFormulaMathNode[] { return [node, ...(node.children ?? []).flatMap(flatten)]; }

test('short aliases cover each canonical variable uniquely and default formula roundtrips exactly', () => {
  assert.equal(PRICING_STOCK_FORMULA_SYMBOLS.length, 10);
  assert.equal(new Set(PRICING_STOCK_FORMULA_SYMBOLS.map(symbol => symbol.alias)).size, 10);
  assert.deepEqual(PRICING_STOCK_FORMULA_SYMBOLS.map(symbol => symbol.alias), ['n','c','h','u','f','p','t','v','b','s']);
  assert.ok(PRICING_STOCK_FORMULA_SYMBOLS.every(symbol => symbol.label && !['abs','min','max','round'].includes(symbol.alias)));
  assert.equal(pricingFormulaToShort(DEFAULT_PRICING_STOCK_FORMULA), shortDefault);
  assert.equal(pricingFormulaToCanonical(shortDefault), DEFAULT_PRICING_STOCK_FORMULA);
  assert.throws(() => compilePricingStockFormula('n + c'), 'Aliases are not added to the persisted language.');
});

test('functions, decimal commas, whitespace and unary operators survive presentation conversion', () => {
  const source = 'max(v; 1,25) + round((s - b) / 3; 2) - abs(-t)';
  const canonical = pricingFormulaToCanonical(source);
  assert.equal(pricingFormulaToShort(canonical), source);
  assert.match(canonical, /max\(drugi_spremenljivi_stroški_artikla; 1,25\)/u);
  assert.equal(pricingFormulaDraftToCanonical('n + unknown + rou'), 'število_zaposlenih + unknown + rou');
  assert.equal(pricingFormulaDraftToShort('število_zaposlenih + unknown + rou'), 'n + unknown + rou');
  assert.equal(pricingFormulaDraftToCanonical('n + ('), 'število_zaposlenih + (');
});

test('unknown identifiers and injection remain invalid, including during an incomplete draft', () => {
  for (const source of ['unknown + n','nn + n','constructor(n)','__proto__','n.x','globalThis.process.exit()','<script>alert(1)</script>','s[0]','n + (']) {
    assert.throws(() => pricingFormulaToCanonical(source));
    assert.throws(() => compilePricingStockFormula(pricingFormulaDraftToCanonical(source)));
    assert.equal(render(pricingFormulaDraftToCanonical(source)), '');
  }
});

test('MathML displays the actual custom AST with stacked fractions, not a fixed default equation', () => {
  const defaultTree = flatten(pricingFormulaMathTree(DEFAULT_PRICING_STOCK_FORMULA));
  assert.equal(defaultTree.filter(node => node.tag === 'mfrac').length, 2);
  const canonical = pricingFormulaToCanonical('max(v; (s - b) / 2)');
  const customTree = flatten(pricingFormulaMathTree(canonical));
  assert.equal(customTree.filter(node => node.tag === 'mfrac').length, 1);
  assert.deepEqual(customTree.filter(node => node.tag === 'mi').map(node => node.text), ['max','v','s','b']);
  const markup = render(canonical);
  assert.match(markup, /data-testid="pricing-formula-math"/u);
  assert.match(markup, /aria-label="Ciljna RVC: max\(v; \(s - b\) \/ 2\)"/u);
  assert.match(markup, /<mfrac>/u);
  assert.doesNotMatch(markup, /<mi>n<\/mi>|<script|dangerouslySetInnerHTML/u);
});

test('rendered grouping preserves subtraction and multiplication precedence and exact rational constants', () => {
  assert.match(render(pricingFormulaToCanonical('s - (b + v)')), /<mo>−<\/mo><mrow><mo>\(<\/mo><mrow><mi>b<\/mi><mo>\+<\/mo><mi>v<\/mi><\/mrow><mo>\)<\/mo>/u);
  assert.match(render(pricingFormulaToCanonical('(s - b) * v')), /<mo>\(<\/mo>.*<mo>\)<\/mo><\/mrow><mo>·<\/mo><mi>v<\/mi>/u);
  assert.match(render(pricingFormulaToCanonical('v + 1 / 3')), /<mfrac><mn>1<\/mn><mn>3<\/mn><\/mfrac>/u);
  assert.match(render(pricingFormulaToCanonical('v + 1,25')), /<mn>1,25<\/mn>/u);
});

test('symbol edits preserve exact canonical calculations and unknown input semantics', () => {
  const model = createDefaultPricingStockModel();
  const values = {inventory:3,purchaseNet:'20.00',saleNet:'35.00',workMinutes:'10.0000',otherCosts:'1.00'};
  const original = calculatePricingStockRow(values, model);
  assert.equal(original.targetRvc, '7.13');
  assert.deepEqual(calculatePricingStockRow(values, {...model,formula:pricingFormulaToCanonical(pricingFormulaToShort(model.formula))}), original);
  const custom = {...model,formula:pricingFormulaToCanonical('(s - b) / 2 + v')};
  assert.equal(calculatePricingStockRow(values, custom).targetRvc, '8.50');
  assert.equal(calculatePricingStockRow({...values,otherCosts:null}, model).targetRvc, null);
});
