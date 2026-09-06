import {
  addExact, compareExact, divideExact, formatExactDecimal, multiplyExact,
  negateExact, parseExactDecimal, roundExact, subtractExact,
  type ExactDecimal
} from './decimal';
import { pricingStockIssue, PricingStockValidationError } from './types';

export const PRICING_STOCK_FORMULA_TOKENS = [
  { value: 'število_zaposlenih', label: 'Število zaposlenih' },
  { value: 'mesečni_strošek_zaposlenega', label: 'Mesečni strošek / zaposlenega' },
  { value: 'razpoložljive_ure_na_zaposlenega', label: 'Razpoložljive ure / zaposlenega' },
  { value: 'izkoriščenost', label: 'Izkoriščenost (delež: 75 % = 0,75)' },
  { value: 'fiksni_stroški', label: 'Fiksni stroški / mesec' },
  { value: 'ciljni_dobiček', label: 'Ciljni dobiček / mesec' },
  { value: 'čas_artikla_v_minutah', label: 'Čas artikla v minutah' },
  { value: 'drugi_spremenljivi_stroški_artikla', label: 'Drugi spremenljivi stroški artikla' },
  { value: 'nabavna_cena', label: 'Nabavna cena brez DDV' },
  { value: 'prodajna_cena', label: 'Prodajna cena brez DDV' }
] as const;
export type PricingStockFormulaVariable = typeof PRICING_STOCK_FORMULA_TOKENS[number]['value'];
const allowedVariables = new Set<string>(PRICING_STOCK_FORMULA_TOKENS.map((token) => token.value));
export const PRICING_STOCK_FORMULA_HELP =
  'Dovoljeni so +, −, *, /, oklepaji ter abs(x), min(x; y), max(x; y), round(x; decimalke). Decimalno ločilo je pika ali vejica, argumente ločite s podpičjem.';

export const DEFAULT_PRICING_STOCK_FORMULA =
  'drugi_spremenljivi_stroški_artikla + (čas_artikla_v_minutah / 60) * '
  + '((število_zaposlenih * mesečni_strošek_zaposlenega + fiksni_stroški + ciljni_dobiček) / '
  + '(število_zaposlenih * razpoložljive_ure_na_zaposlenega * izkoriščenost))';

type NumericFunction = 'abs' | 'min' | 'max' | 'round';
type Operator = '+' | '-' | '*' | '/';
type Expression =
  | { kind: 'literal'; value: ExactDecimal }
  | { kind: 'variable'; name: PricingStockFormulaVariable; position: number }
  | { kind: 'unary'; operator: '+' | '-'; operand: Expression }
  | { kind: 'binary'; operator: Operator; left: Expression; right: Expression }
  | { kind: 'call'; name: NumericFunction; args: Expression[] };
type Token = { kind: 'number' | 'identifier' | 'symbol' | 'end'; value: string; position: number };
export type CompiledPricingStockFormula = Readonly<{
  version: 1;
  source: string;
  variables: readonly PricingStockFormulaVariable[];
  expression: Expression;
}>;

function formulaError(code: string, message: string, position?: number) {
  return pricingStockIssue('formula', code, message, position);
}
function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  let index = 0;
  while (index < source.length) {
    const char = source[index];
    if (/\s/u.test(char)) { index += 1; continue; }
    const position = index;
    const rest = source.slice(index);
    const number = /^\d+(?:[.,]\d+)?/u.exec(rest)?.[0];
    const identifier = /^[\p{L}_][\p{L}\p{N}_]*/u.exec(rest)?.[0];
    if (number) { tokens.push({ kind: 'number', value: number, position }); index += number.length; }
    else if (identifier) {
      tokens.push({ kind: 'identifier', value: identifier, position }); index += identifier.length;
    } else if ('+-*/();'.includes(char)) {
      tokens.push({ kind: 'symbol', value: char, position }); index += 1;
    } else {
      throw formulaError('INVALID_TOKEN', 'Nedovoljen znak v enačbi.', position);
    }
    if (tokens.length > 512) {
      throw formulaError('EXPRESSION_LIMIT', 'Enačba lahko vsebuje največ 512 členov.', position);
    }
  }
  tokens.push({ kind: 'end', value: '', position: source.length });
  return tokens;
}

function binary(operator: Operator, left: ExactDecimal, right: ExactDecimal): ExactDecimal {
  if (operator === '+') return addExact(left, right);
  if (operator === '-') return subtractExact(left, right);
  if (operator === '*') return multiplyExact(left, right);
  return divideExact(left, right);
}
function callNumeric(name: NumericFunction, args: ExactDecimal[]): ExactDecimal {
  if (name === 'abs') return args[0].numerator < 0n ? negateExact(args[0]) : args[0];
  if (name === 'min') return args.reduce((left, right) => compareExact(left, right) <= 0 ? left : right);
  if (name === 'max') return args.reduce((left, right) => compareExact(left, right) >= 0 ? left : right);
  const precision = args[1] ?? parseExactDecimal('0');
  if (precision.denominator !== 1n || precision.numerator < 0n || precision.numerator > 6n) {
    throw formulaError('INVALID_PRECISION', 'round dovoljuje od 0 do 6 decimalnih mest.');
  }
  return roundExact(args[0], Number(precision.numerator)); // Bounded integer precision, never financial data.
}

function foldConstants(expression: Expression): Expression {
  if (expression.kind === 'literal' || expression.kind === 'variable') return expression;
  if (expression.kind === 'unary') {
    const operand = foldConstants(expression.operand);
    return operand.kind === 'literal'
      ? { kind: 'literal', value: expression.operator === '-' ? negateExact(operand.value) : operand.value }
      : { ...expression, operand };
  }
  if (expression.kind === 'binary') {
    const left = foldConstants(expression.left);
    const right = foldConstants(expression.right);
    if (expression.operator === '/' && right.kind === 'literal' && right.value.numerator === 0n) {
      throw formulaError('DIVISION_BY_ZERO', 'Deljenje z nič ni dovoljeno.');
    }
    return left.kind === 'literal' && right.kind === 'literal'
      ? { kind: 'literal', value: binary(expression.operator, left.value, right.value) }
      : { ...expression, left, right };
  }
  const args = expression.args.map(foldConstants);
  if (expression.name === 'round' && args[1]?.kind === 'literal') {
    const precision = args[1].value;
    if (precision.denominator !== 1n || precision.numerator < 0n || precision.numerator > 6n) {
      throw formulaError('INVALID_PRECISION', 'round dovoljuje od 0 do 6 decimalnih mest.');
    }
  }
  return args.every((argument) => argument.kind === 'literal')
    ? { kind: 'literal', value: callNumeric(expression.name, args.map((argument) => argument.value)) }
    : { ...expression, args };
}

/** A closed grammar: no JavaScript, property access, arbitrary calls, or computed references. */
export function compilePricingStockFormula(input: string): CompiledPricingStockFormula {
  if (typeof input !== 'string' || input.length > 2048 || input.trim().length === 0) {
    throw formulaError('INVALID_FORMULA', 'Enačba mora vsebovati od 1 do 2048 znakov.');
  }
  const source = input.normalize('NFC').trim();
  const tokens = tokenize(source);
  let cursor = 0;
  const variables = new Set<PricingStockFormulaVariable>();
  const current = () => tokens[cursor];
  const consume = (value: string) => {
    if (current().value !== value) return false;
    cursor += 1; return true;
  };
  const requireSymbol = (value: string) => {
    if (!consume(value)) throw formulaError('EXPECTED_TOKEN', 'Pričakovan znak ' + value + '.', current().position);
  };
  function expression(depth: number): Expression {
    let node = product(depth);
    while (current().value === '+' || current().value === '-') {
      const operator = current().value as '+' | '-'; cursor += 1;
      node = { kind: 'binary', operator, left: node, right: product(depth) };
    }
    return node;
  }
  function product(depth: number): Expression {
    let node = primary(depth);
    while (current().value === '*' || current().value === '/') {
      const operator = current().value as '*' | '/'; cursor += 1;
      node = { kind: 'binary', operator, left: node, right: primary(depth) };
    }
    return node;
  }
  function primary(depth: number): Expression {
    if (depth > 32) throw formulaError('EXPRESSION_LIMIT', 'Enačba ima preveč ugnezdenih oklepajev.', current().position);
    if (current().value === '+' || current().value === '-') {
      const operator = current().value as '+' | '-'; cursor += 1;
      return { kind: 'unary', operator, operand: primary(depth + 1) };
    }
    if (consume('(')) { const node = expression(depth + 1); requireSymbol(')'); return node; }
    const token = current();
    if (token.kind === 'number') {
      cursor += 1;
      return { kind: 'literal', value: parseExactDecimal(token.value, 'formula') };
    }
    if (token.kind === 'identifier') {
      cursor += 1;
      if (consume('(')) {
        if (!['min', 'max', 'abs', 'round'].includes(token.value)) {
          throw formulaError('UNKNOWN_FUNCTION', 'Funkcija ni dovoljena.', token.position);
        }
        const args = [expression(depth + 1)];
        while (consume(';')) {
          if (args.length >= 16) throw formulaError('EXPRESSION_LIMIT', 'Funkcija ima lahko največ 16 argumentov.', token.position);
          args.push(expression(depth + 1));
        }
        requireSymbol(')');
        const validCount = token.value === 'abs' ? args.length === 1
          : token.value === 'round' ? args.length <= 2 : args.length >= 2;
        if (!validCount) throw formulaError('INVALID_ARGUMENTS', 'Funkcija nima pravilnega števila argumentov.', token.position);
        return { kind: 'call', name: token.value as NumericFunction, args };
      }
      if (!allowedVariables.has(token.value)) {
        throw formulaError('UNKNOWN_VARIABLE', 'Spremenljivka ni dovoljena: ' + token.value + '.', token.position);
      }
      const name = token.value as PricingStockFormulaVariable;
      variables.add(name);
      return { kind: 'variable', name, position: token.position };
    }
    throw formulaError('EXPECTED_VALUE', 'Pričakovano je število, spremenljivka ali oklepaj.', token.position);
  }
  const parsed = expression(0);
  if (current().kind !== 'end') {
    throw formulaError('UNEXPECTED_TOKEN', 'Nepričakovan del enačbe.', current().position);
  }
  return { version: 1, source, variables: [...variables], expression: foldConstants(parsed) };
}

/**
 * Substitute known model parameters, then fold constant subexpressions. This
 * detects invalid global denominators even when item-specific inputs are absent.
 */
export function bindPricingStockFormulaParameters(
  compiled: CompiledPricingStockFormula,
  values: Partial<Record<PricingStockFormulaVariable, ExactDecimal>>
): CompiledPricingStockFormula {
  function bind(node: Expression): Expression {
    if (node.kind === 'variable') {
      const value = Object.hasOwn(values, node.name) ? values[node.name] : undefined;
      return value === undefined ? node : { kind: 'literal', value };
    }
    if (node.kind === 'unary') return { ...node, operand: bind(node.operand) };
    if (node.kind === 'binary') return { ...node, left: bind(node.left), right: bind(node.right) };
    if (node.kind === 'call') return { ...node, args: node.args.map(bind) };
    return node;
  }
  return { ...compiled, expression: foldConstants(bind(compiled.expression)) };
}

export function evaluateCompiledPricingStockFormula(
  compiled: CompiledPricingStockFormula,
  values: Partial<Record<PricingStockFormulaVariable, ExactDecimal | null>>
): ExactDecimal {
  function evaluate(node: Expression): ExactDecimal {
    if (node.kind === 'literal') return node.value;
    if (node.kind === 'variable') {
      const value = Object.hasOwn(values, node.name) ? values[node.name] : null;
      if (!value) throw formulaError('MISSING_VALUE', 'Manjka podatek: ' + node.name + '.', node.position);
      return value;
    }
    if (node.kind === 'unary') {
      const value = evaluate(node.operand);
      return node.operator === '-' ? negateExact(value) : value;
    }
    if (node.kind === 'binary') return binary(node.operator, evaluate(node.left), evaluate(node.right));
    return callNumeric(node.name, node.args.map(evaluate));
  }
  // Resolve every known operand first: an absent earlier input must not hide
  // a division by zero or invalid precision in a later, already-known branch.
  const known: Partial<Record<PricingStockFormulaVariable, ExactDecimal>> = {};
  for (const variable of compiled.variables) {
    const value = Object.hasOwn(values, variable) ? values[variable] : undefined;
    if (value !== null && value !== undefined) known[variable] = value;
  }
  return evaluate(bindPricingStockFormulaParameters(compiled, known).expression);
}

export function evaluatePricingStockFormula(
  formula: string, values: Partial<Record<PricingStockFormulaVariable, string | null>>, digits = 6
): string {
  const compiled = compilePricingStockFormula(formula);
  const parsed: Partial<Record<PricingStockFormulaVariable, ExactDecimal | null>> = {};
  for (const variable of compiled.variables) {
    const value = Object.hasOwn(values, variable) ? values[variable] : null;
    parsed[variable] = value == null ? null : parseExactDecimal(value, variable);
  }
  return formatExactDecimal(evaluateCompiledPricingStockFormula(compiled, parsed), digits);
}

export function pricingStockValidationIssues(error: unknown) {
  if (error instanceof PricingStockValidationError) return error.issues;
  throw error;
}
