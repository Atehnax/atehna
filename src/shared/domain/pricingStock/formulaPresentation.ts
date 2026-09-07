import { compilePricingStockFormula, PRICING_STOCK_FORMULA_TOKENS, type CompiledPricingStockFormula, type PricingStockFormulaVariable } from './formula';
import type { ExactDecimal } from './decimal';

const aliases: Record<PricingStockFormulaVariable, string> = {
  'število_zaposlenih': 'n', 'mesečni_strošek_zaposlenega': 'c',
  'razpoložljive_ure_na_zaposlenega': 'h', 'izkoriščenost': 'u',
  'fiksni_stroški': 'f', 'ciljni_dobiček': 'p', 'čas_artikla_v_minutah': 't',
  'drugi_spremenljivi_stroški_artikla': 'v', 'nabavna_cena': 'b', 'prodajna_cena': 's'
};
/** Presentation symbols only; the persisted formula language remains canonical. */
export const PRICING_STOCK_FORMULA_SYMBOLS = PRICING_STOCK_FORMULA_TOKENS.map(token => ({
  canonical: token.value, alias: aliases[token.value], label: token.label
}));
const shortByCanonical = new Map(PRICING_STOCK_FORMULA_SYMBOLS.map(symbol => [symbol.canonical as string, symbol.alias as string]));
const canonicalByShort = new Map(PRICING_STOCK_FORMULA_SYMBOLS.map(symbol => [symbol.alias as string, symbol.canonical as string]));
const identifiers = /[\p{L}_][\p{L}\p{N}_]*/gu;
function translate(source: string, dictionary: ReadonlyMap<string, string>): string {
  return source.normalize('NFC').replace(identifiers, identifier => dictionary.get(identifier) ?? identifier);
}
/** Keep incomplete/unknown draft tokens intact so existing validation blocks saving. */
export function pricingFormulaDraftToCanonical(short: string): string { return translate(short, canonicalByShort); }
export function pricingFormulaDraftToShort(canonical: string): string { return translate(canonical, shortByCanonical); }
export function pricingFormulaToCanonical(short: string): string {
  return compilePricingStockFormula(pricingFormulaDraftToCanonical(short)).source;
}
export function pricingFormulaToShort(canonical: string): string {
  return pricingFormulaDraftToShort(compilePricingStockFormula(canonical).source);
}

export type PricingFormulaMathNode = Readonly<{
  tag: 'mi' | 'mn' | 'mo' | 'mrow' | 'mfrac';
  text?: string;
  children?: readonly PricingFormulaMathNode[];
}>;
type Expression = CompiledPricingStockFormula['expression'];
const token = (tag: 'mi' | 'mn' | 'mo', text: string): PricingFormulaMathNode => ({ tag, text });
const row = (...children: PricingFormulaMathNode[]): PricingFormulaMathNode => ({ tag: 'mrow', children });
const fenced = (child: PricingFormulaMathNode) => row(token('mo', '('), child, token('mo', ')'));
function literal(value: ExactDecimal): PricingFormulaMathNode {
  const magnitude = value.numerator < 0n ? -value.numerator : value.numerator;
  let denominator = value.denominator, twos = 0, fives = 0;
  while (denominator % 2n === 0n) { denominator /= 2n; twos += 1; }
  while (denominator % 5n === 0n) { denominator /= 5n; fives += 1; }
  const digits = Math.max(twos, fives);
  let content: PricingFormulaMathNode;
  if (denominator === 1n && digits <= 12) {
    const scale = 10n ** BigInt(digits), scaled = magnitude * scale / value.denominator;
    const fraction = digits ? (scaled % scale).toString().padStart(digits, '0').replace(/0+$/u, '') : '';
    content = token('mn', (scaled / scale).toString() + (fraction ? ',' + fraction : ''));
  } else {
    // Constant folding may produce a repeating rational. Never round its display.
    content = { tag: 'mfrac', children: [token('mn', magnitude.toString()), token('mn', value.denominator.toString())] };
  }
  return value.numerator < 0n ? row(token('mo', '−'), content) : content;
}
function precedence(expression: Expression): number {
  if (expression.kind === 'binary') return expression.operator === '/' ? 4 : expression.operator === '*' ? 2 : 1;
  return expression.kind === 'unary' ? 3 : 4;
}
function render(expression: Expression): PricingFormulaMathNode {
  if (expression.kind === 'literal') return literal(expression.value);
  if (expression.kind === 'variable') return token('mi', shortByCanonical.get(expression.name)!);
  if (expression.kind === 'call') {
    const argumentsList = expression.args.flatMap((argument, index) => index ? [token('mo', ';'), render(argument)] : [render(argument)]);
    return row(token('mi', expression.name), token('mo', '('), ...argumentsList, token('mo', ')'));
  }
  if (expression.kind === 'unary') {
    const operand = render(expression.operand);
    return row(token('mo', expression.operator === '-' ? '−' : '+'), precedence(expression.operand) < 3 ? fenced(operand) : operand);
  }
  if (expression.operator === '/') return { tag: 'mfrac', children: [render(expression.left), render(expression.right)] };
  const level = precedence(expression), left = render(expression.left), right = render(expression.right);
  const rightNeedsFence = precedence(expression.right) < level || (expression.operator === '-' && precedence(expression.right) === level);
  return row(precedence(expression.left) < level ? fenced(left) : left,
    token('mo', expression.operator === '*' ? '·' : expression.operator === '-' ? '−' : '+'),
    rightNeedsFence ? fenced(right) : right);
}
/** Render the same validated, constant-folded AST that the calculator evaluates. */
export function pricingFormulaMathTree(canonical: string): PricingFormulaMathNode {
  return render(compilePricingStockFormula(canonical).expression);
}
