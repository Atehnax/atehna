import {
  addExact, compareExact, divideExact, EXACT_ZERO, formatExactDecimal,
  multiplyExact, parseExactDecimal, subtractExact, type ExactDecimal
} from './decimal';
import {
  bindPricingStockFormulaParameters, compilePricingStockFormula, DEFAULT_PRICING_STOCK_FORMULA,
  evaluateCompiledPricingStockFormula, pricingStockValidationIssues,
  type PricingStockFormulaVariable
} from './formula';
import {
  pricingStockIssue, PricingStockValidationError, PRICING_STOCK_STATUS_LABELS,
  type PricingStockCalculation, type PricingStockEditableField, type PricingStockModel,
  type PricingStockParameters, type PricingStockValidationIssue, type PricingStockValues
} from './types';

export const PRICING_STOCK_LIMITS = Object.freeze({
  money: '9999999999.99',
  workMinutes: '99999999.9999',
  inventory: '2147483647',
  headcount: '1000000',
  availableHours: '744',
  adequacyThresholdPercent: '1000000'
});
const HUNDRED = parseExactDecimal('100');
const SIXTY = parseExactDecimal('60');
const PARAMETER_KEYS = [
  'headcount', 'employeeCost', 'availableHours', 'utilizationPercent',
  'fixedCosts', 'targetProfit', 'adequacyThresholdPercent'
] as const;
export const DEFAULT_PRICING_STOCK_PARAMETERS: Readonly<PricingStockParameters> = Object.freeze({
  headcount: '5',
  employeeCost: '2650.00',
  availableHours: '128.0000',
  utilizationPercent: '75.0000',
  fixedCosts: '2400.00',
  targetProfit: '2000.00',
  adequacyThresholdPercent: '120.0000'
});

export function createDefaultPricingStockModel(revision = '0'): PricingStockModel {
  return {
    revision, formulaVersion: 1, formula: DEFAULT_PRICING_STOCK_FORMULA,
    parameters: { ...DEFAULT_PRICING_STOCK_PARAMETERS }
  };
}

function boundedValue(
  raw: string, field: string, maximum: string, digits: number,
  options: { positive?: boolean; integer?: boolean; minimum?: string } = {}
): string {
  const value = parseExactDecimal(raw, field);
  if (compareExact(value, EXACT_ZERO) < 0 || (options.positive && value.numerator === 0n)) {
    throw pricingStockIssue(field, 'OUT_OF_RANGE', options.positive
      ? 'Vrednost mora biti večja od nič.' : 'Negativna vrednost ni dovoljena.');
  }
  if (options.integer && value.denominator !== 1n) {
    throw pricingStockIssue(field, 'INTEGER_REQUIRED', 'Vnesite celo število.');
  }
  if (compareExact(value, parseExactDecimal(maximum)) > 0
    || (options.minimum && compareExact(value, parseExactDecimal(options.minimum)) < 0)) {
    throw pricingStockIssue(field, 'OUT_OF_RANGE', 'Vrednost je zunaj dovoljenega območja.');
  }
  const canonical = formatExactDecimal(value, digits);
  const rounded = parseExactDecimal(canonical);
  if ((options.positive && rounded.numerator === 0n)
    || compareExact(rounded, parseExactDecimal(maximum)) > 0) {
    throw pricingStockIssue(field, 'OUT_OF_RANGE', 'Zaokrožena vrednost je zunaj dovoljenega območja.');
  }
  return canonical;
}

/** Blank nullable values stay absent; an explicit zero is always retained. */
export function normalizePricingStockCell(field: PricingStockEditableField, raw: string | null): string | null {
  if (raw !== null && typeof raw !== 'string') {
    throw pricingStockIssue(field, 'INVALID_DECIMAL', 'Vrednost mora biti decimalni zapis.');
  }
  if (raw === null || raw.trim() === '') {
    if (field === 'purchaseNet' || field === 'workMinutes' || field === 'otherCosts') return null;
    throw pricingStockIssue(field, 'REQUIRED', 'Podatek je obvezen.');
  }
  if (field === 'inventory') {
    return boundedValue(raw, field, PRICING_STOCK_LIMITS.inventory, 0, { integer: true });
  }
  if (field === 'workMinutes') return boundedValue(raw, field, PRICING_STOCK_LIMITS.workMinutes, 4);
  if (field === 'purchaseNet' || field === 'saleNet' || field === 'otherCosts') {
    return boundedValue(raw, field, PRICING_STOCK_LIMITS.money, 2);
  }
  throw pricingStockIssue(field, 'UNKNOWN_FIELD', 'Polje ni dovoljeno.');
}

function normalizeParameter(key: keyof PricingStockParameters, raw: unknown): string {
  const field = 'parameters.' + key;
  if (typeof raw !== 'string' || raw.trim() === '') {
    throw pricingStockIssue(field, 'REQUIRED', 'Vnesite decimalno vrednost parametra.');
  }
  if (key === 'headcount') return boundedValue(raw, field, PRICING_STOCK_LIMITS.headcount, 0, { positive: true, integer: true });
  if (key === 'availableHours') return boundedValue(raw, field, PRICING_STOCK_LIMITS.availableHours, 4, { positive: true });
  if (key === 'utilizationPercent') return boundedValue(raw, field, '100', 4, { positive: true });
  if (key === 'adequacyThresholdPercent') {
    return boundedValue(raw, field, PRICING_STOCK_LIMITS.adequacyThresholdPercent, 4, { minimum: '100' });
  }
  return boundedValue(raw, field, PRICING_STOCK_LIMITS.money, 2);
}

function normalizeParameters(input: unknown): PricingStockParameters {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    throw pricingStockIssue('parameters', 'INVALID_PARAMETERS', 'Parametri modela niso veljavni.');
  }
  const source = input as Record<string, unknown>;
  const parameters = {} as PricingStockParameters;
  const issues: PricingStockValidationIssue[] = [];
  for (const key of PARAMETER_KEYS) {
    try { parameters[key] = normalizeParameter(key, Object.hasOwn(source, key) ? source[key] : undefined); }
    catch (error) { issues.push(...pricingStockValidationIssues(error)); }
  }
  if (issues.length) throw new PricingStockValidationError(issues);
  return parameters;
}

function globalValues(parameters: PricingStockParameters): Record<
  Exclude<PricingStockFormulaVariable, 'čas_artikla_v_minutah' | 'drugi_spremenljivi_stroški_artikla' | 'nabavna_cena' | 'prodajna_cena'>,
  ExactDecimal
> {
  return {
    'število_zaposlenih': parseExactDecimal(parameters.headcount),
    'mesečni_strošek_zaposlenega': parseExactDecimal(parameters.employeeCost),
    'razpoložljive_ure_na_zaposlenega': parseExactDecimal(parameters.availableHours),
    'izkoriščenost': divideExact(parseExactDecimal(parameters.utilizationPercent), HUNDRED),
    'fiksni_stroški': parseExactDecimal(parameters.fixedCosts),
    'ciljni_dobiček': parseExactDecimal(parameters.targetProfit)
  };
}

function exactCapacityRate(parameters: PricingStockParameters): ExactDecimal {
  const variables = globalValues(parameters);
  const monthly = addExact(addExact(
    multiplyExact(variables['število_zaposlenih'], variables['mesečni_strošek_zaposlenega']),
    variables['fiksni_stroški']
  ), variables['ciljni_dobiček']);
  const capacity = multiplyExact(multiplyExact(
    variables['število_zaposlenih'], variables['razpoložljive_ure_na_zaposlenega']
  ), variables['izkoriščenost']);
  if (compareExact(capacity, EXACT_ZERO) <= 0) {
    throw pricingStockIssue('parameters', 'INVALID_CAPACITY', 'Razpoložljiva zmogljivost mora biti večja od nič.');
  }
  return divideExact(monthly, capacity);
}

export function calculateCapacityRate(input: PricingStockParameters): string {
  return formatExactDecimal(exactCapacityRate(normalizeParameters(input)), 6);
}

export function normalizePricingStockModel(input: unknown): PricingStockModel {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    throw pricingStockIssue('model', 'INVALID_MODEL', 'Model ni veljaven.');
  }
  const source = input as Record<string, unknown>;
  const issues: PricingStockValidationIssue[] = [];
  if (typeof source.revision !== 'string' || !source.revision || source.revision.length > 128) {
    issues.push({ field: 'revision', code: 'INVALID_REVISION', message: 'Različica modela ni veljavna.' });
  }
  if (source.formulaVersion !== 1) {
    issues.push({ field: 'formulaVersion', code: 'INVALID_VERSION', message: 'Različica jezika enačbe ni podprta.' });
  }
  let parameters: PricingStockParameters | undefined;
  let formula: string | undefined;
  try { parameters = normalizeParameters(source.parameters); }
  catch (error) { issues.push(...pricingStockValidationIssues(error)); }
  try { formula = compilePricingStockFormula(source.formula as string).source; }
  catch (error) { issues.push(...pricingStockValidationIssues(error)); }
  if (parameters) {
    try {
      exactCapacityRate(parameters);
      if (formula) bindPricingStockFormulaParameters(compilePricingStockFormula(formula), globalValues(parameters));
    } catch (error) { issues.push(...pricingStockValidationIssues(error)); }
  }
  if (issues.length || !parameters || !formula) throw new PricingStockValidationError(issues);
  return { revision: source.revision as string, formulaVersion: 1, formula, parameters };
}

export function validatePricingStockModel(input: unknown): PricingStockValidationIssue[] {
  try { normalizePricingStockModel(input); return []; }
  catch (error) { return pricingStockValidationIssues(error); }
}

export function calculatePricingStockRow(values: PricingStockValues, inputModel: PricingStockModel): PricingStockCalculation {
  const result: PricingStockCalculation = {
    rvc: null, rvcPercent: null, targetRvc: null, difference: null,
    coveragePercent: null, recommendedPrice: null, capacityRate: null,
    status: 'missing', statusLabel: PRICING_STOCK_STATUS_LABELS.missing, errors: []
  };
  const parsed: Record<'saleNet' | 'purchaseNet' | 'workMinutes' | 'otherCosts', ExactDecimal | null> = {
    saleNet: null, purchaseNet: null, workMinutes: null, otherCosts: null
  };
  for (const field of ['saleNet', 'purchaseNet', 'workMinutes', 'otherCosts'] as const) {
    try {
      const raw = values[field];
      const canonical = raw === null ? null : normalizePricingStockCell(field, raw);
      parsed[field] = canonical === null ? null : parseExactDecimal(canonical);
    } catch (error) { result.errors.push(...pricingStockValidationIssues(error)); }
  }
  let rvc: ExactDecimal | null = null;
  if (parsed.saleNet !== null && parsed.purchaseNet !== null) {
    rvc = subtractExact(parsed.saleNet, parsed.purchaseNet);
    result.rvc = formatExactDecimal(rvc);
    if (parsed.saleNet.numerator > 0n) {
      result.rvcPercent = formatExactDecimal(multiplyExact(divideExact(rvc, parsed.saleNet), HUNDRED));
    }
  }
  let model: PricingStockModel;
  try {
    model = normalizePricingStockModel(inputModel);
    result.capacityRate = formatExactDecimal(exactCapacityRate(model.parameters), 6);
  } catch (error) {
    result.errors.push(...pricingStockValidationIssues(error));
    return result;
  }
  try {
    const compiled = compilePricingStockFormula(model.formula);
    const target = evaluateCompiledPricingStockFormula(compiled, {
      ...globalValues(model.parameters),
      'čas_artikla_v_minutah': parsed.workMinutes,
      'drugi_spremenljivi_stroški_artikla': parsed.otherCosts,
      'nabavna_cena': parsed.purchaseNet,
      'prodajna_cena': parsed.saleNet
    });
    result.targetRvc = formatExactDecimal(target);
    if (parsed.purchaseNet !== null) {
      result.recommendedPrice = formatExactDecimal(addExact(parsed.purchaseNet, target));
    }
    if (rvc !== null) {
      result.difference = formatExactDecimal(subtractExact(rvc, target));
      if (compareExact(target, EXACT_ZERO) > 0) {
        const coverage = multiplyExact(divideExact(rvc, target), HUNDRED);
        result.coveragePercent = formatExactDecimal(coverage);
        result.status = compareExact(coverage, HUNDRED) < 0 ? 'below'
          : compareExact(coverage, parseExactDecimal(model.parameters.adequacyThresholdPercent)) < 0 ? 'borderline'
            : 'adequate';
        result.statusLabel = PRICING_STOCK_STATUS_LABELS[result.status];
      }
    }
  } catch (error) { result.errors.push(...pricingStockValidationIssues(error)); }
  return result;
}

/** Exact TDABC reference used in tests and integrations that do not edit the expression. */
export function calculateDefaultPricingStockTarget(
  parameters: PricingStockParameters, workMinutes: string, otherCosts: string
): string {
  const time = normalizePricingStockCell('workMinutes', workMinutes);
  const costs = normalizePricingStockCell('otherCosts', otherCosts);
  if (time === null || costs === null) throw pricingStockIssue('row', 'MISSING_VALUE', 'Manjka čas ali drugi stroški artikla.');
  return formatExactDecimal(addExact(
    parseExactDecimal(costs),
    multiplyExact(divideExact(parseExactDecimal(time), SIXTY), exactCapacityRate(normalizeParameters(parameters)))
  ));
}
