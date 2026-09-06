import assert from 'node:assert/strict';
import test from 'node:test';
import {
  calculateCapacityRate, calculateDefaultPricingStockTarget, calculatePricingStockRow,
  comparePricingStockDecimals, compilePricingStockFormula, createDefaultPricingStockModel,
  evaluatePricingStockFormula, normalizePricingStockCell, normalizePricingStockModel,
  parsePricingStockPaste, previewPricingStockBulk, PricingStockValidationError,
  validatePricingStockModel, type PricingStockValues
} from '@/shared/domain/pricingStock';
import {
  addExact, divideExact, formatExactDecimal, multiplyExact, parseExactDecimal
} from '@/shared/domain/pricingStock/decimal';

const values = (override: Partial<PricingStockValues> = {}): PricingStockValues => ({
  purchaseNet: '10.00', saleNet: '20.00', workMinutes: '6.0000', otherCosts: '2.00',
  inventory: 5, ...override
});
const literalModel = (formula = '10') => ({ ...createDefaultPricingStockModel(), formula });
const errorCode = (code: string) => (error: unknown) =>
  error instanceof PricingStockValidationError && error.issues.some((issue) => issue.code === code);

test('default TDABC includes headcount in both costs and available capacity', () => {
  const model = createDefaultPricingStockModel();
  assert.equal(calculateCapacityRate(model.parameters), '36.770833');
  assert.equal(calculateCapacityRate({ ...model.parameters, headcount: '10' }), '32.187500');
  assert.deepEqual(calculatePricingStockRow(values(), model), {
    rvc: '10.00', rvcPercent: '50.00', targetRvc: '5.68', difference: '4.32',
    coveragePercent: '176.15', recommendedPrice: '15.68', capacityRate: '36.770833',
    status: 'adequate', statusLabel: 'Ustrezno', errors: []
  });
  assert.equal(calculateDefaultPricingStockTarget(model.parameters, '6', '2'), '5.68');
});

test('cost calculations remain exact until the final decimal boundary', () => {
  assert.equal(evaluatePricingStockFormula('(0.1 + 0.2) * 10', {}, 2), '3.00');
  assert.equal(evaluatePricingStockFormula('(1 / 3) * 3', {}, 12), '1.000000000000');
  assert.equal(evaluatePricingStockFormula('(10000000000 / 3) * 3 - 10000000000', {}, 2), '0.00');
  assert.equal(evaluatePricingStockFormula('1 / 6', {}, 6), '0.166667');
  const third = divideExact(parseExactDecimal('1'), parseExactDecimal('3'));
  assert.equal(formatExactDecimal(addExact(addExact(third, third), third), 2), '1.00');
  assert.equal(formatExactDecimal(multiplyExact(parseExactDecimal('0.1'), parseExactDecimal('0.2')), 2), '0.02');
});

test('rounding uses half away from zero and never emits negative zero', () => {
  for (const [input, expected] of [
    ['1.005', '1.01'], ['-1.005', '-1.01'], ['-0.004', '0.00'],
    ['999.995', '1000.00'], ['2.675', '2.68']
  ]) assert.equal(formatExactDecimal(parseExactDecimal(input), 2), expected);
  assert.equal(evaluatePricingStockFormula('round(-1.005; 2)', {}, 2), '-1.01');
});

test('grammar supports arithmetic precedence, unary signs, safe functions and Slovenian decimals', () => {
  assert.equal(evaluatePricingStockFormula('2 + 3 * 4', {}, 2), '14.00');
  assert.equal(evaluatePricingStockFormula('-(2 + 3) * -4', {}, 2), '20.00');
  assert.equal(evaluatePricingStockFormula('max(1,5; min(8; 2,5)) + abs(-3)', {}, 2), '5.50');
  assert.equal(evaluatePricingStockFormula('round(1.23456; 4)', {}, 4), '1.2346');
  assert.equal(evaluatePricingStockFormula('izkoriščenost * 100', { izkoriščenost: '0.75' }, 2), '75.00');
});

test('all four coverage states use exact target comparisons at the boundaries', () => {
  const model = literalModel();
  for (const [saleNet, status, statusLabel, coverage] of [
    ['19.99', 'below', 'Pod pragom', '99.90'],
    ['20.00', 'borderline', 'Na meji', '100.00'],
    ['21.99', 'borderline', 'Na meji', '119.90'],
    ['22.00', 'adequate', 'Ustrezno', '120.00']
  ]) {
    const calculated = calculatePricingStockRow(values({ saleNet }), model);
    assert.equal(calculated.status, status);
    assert.equal(calculated.statusLabel, statusLabel);
    assert.equal(calculated.coveragePercent, coverage);
  }
  const missing = calculatePricingStockRow(values({ purchaseNet: null }), model);
  assert.equal(missing.status, 'missing');
  assert.equal(missing.statusLabel, 'Ni podatkov');
  assert.equal(missing.coveragePercent, null);
});

test('selling below acquisition cost is valid and produces negative RVC and coverage', () => {
  const calculated = calculatePricingStockRow(values({ saleNet: '5.00' }), literalModel());
  assert.equal(calculated.rvc, '-5.00');
  assert.equal(calculated.rvcPercent, '-100.00');
  assert.equal(calculated.difference, '-15.00');
  assert.equal(calculated.coveragePercent, '-50.00');
  assert.equal(calculated.status, 'below');
  assert.deepEqual(calculated.errors, []);
});

test('blank and explicit zero have distinct meaning for nullable fields', () => {
  for (const field of ['purchaseNet', 'workMinutes', 'otherCosts'] as const) {
    assert.equal(normalizePricingStockCell(field, ''), null);
    assert.equal(normalizePricingStockCell(field, null), null);
    assert.equal(normalizePricingStockCell(field, '0'), field === 'workMinutes' ? '0.0000' : '0.00');
  }
  assert.throws(() => normalizePricingStockCell('saleNet', ''), errorCode('REQUIRED'));
  assert.throws(() => normalizePricingStockCell('inventory', ''), errorCode('REQUIRED'));
  const blank = calculatePricingStockRow(values({ workMinutes: null }), createDefaultPricingStockModel());
  assert.equal(blank.rvc, '10.00');
  assert.equal(blank.targetRvc, null);
  assert.equal(blank.status, 'missing');
  const zero = calculatePricingStockRow(values({ workMinutes: '0', otherCosts: '0' }), createDefaultPricingStockModel());
  assert.equal(zero.targetRvc, '0.00');
  assert.equal(zero.coveragePercent, null);
});

test('zero sale and zero or negative target never divide by zero', () => {
  const free = calculatePricingStockRow(values({ saleNet: '0', purchaseNet: '0' }), literalModel());
  assert.equal(free.rvc, '0.00');
  assert.equal(free.rvcPercent, null);
  assert.equal(free.coveragePercent, '0.00');
  for (const formula of ['0', '-2']) {
    const result = calculatePricingStockRow(values(), literalModel(formula));
    assert.equal(result.coveragePercent, null);
    assert.equal(result.status, 'missing');
    assert.deepEqual(result.errors, []);
  }
});

test('custom formulas can depend only on supplied allowed source values, with no implicit zero', () => {
  const row = values({ workMinutes: null, otherCosts: null });
  assert.equal(calculatePricingStockRow(row, literalModel('nabavna_cena * 0.2')).targetRvc, '2.00');
  assert.equal(calculatePricingStockRow(row, literalModel('0 * čas_artikla_v_minutah')).targetRvc, null);
  assert.throws(() => evaluatePricingStockFormula('nabavna_cena', {}), errorCode('MISSING_VALUE'));
});

test('formula-derived recommendation is a pure result and does not mutate the selling price', () => {
  const row = values();
  const snapshot = JSON.stringify(row);
  const model = createDefaultPricingStockModel();
  const modelSnapshot = JSON.stringify(model);
  calculatePricingStockRow(row, model);
  previewPricingStockBulk([{ variantId: 1, ...row }], model, { kind: 'recommended-price' });
  assert.equal(JSON.stringify(row), snapshot);
  assert.equal(JSON.stringify(model), modelSnapshot);
});

test('cell normalization handles comma input, explicit rounding, and database bounds', () => {
  assert.equal(normalizePricingStockCell('purchaseNet', ' 123,455 '), '123.46');
  assert.equal(normalizePricingStockCell('workMinutes', '1,23455'), '1.2346');
  assert.equal(normalizePricingStockCell('inventory', '12.0'), '12');
  assert.equal(normalizePricingStockCell('saleNet', '9999999999.99'), '9999999999.99');
  assert.equal(normalizePricingStockCell('workMinutes', '99999999.9999'), '99999999.9999');
  for (const raw of ['-0.001', '10000000000', '9999999999.991']) {
    assert.throws(() => normalizePricingStockCell('saleNet', raw), errorCode('OUT_OF_RANGE'));
  }
  assert.throws(() => normalizePricingStockCell('inventory', '1.5'), errorCode('INTEGER_REQUIRED'));
  assert.throws(() => normalizePricingStockCell('inventory', '2147483648'), errorCode('OUT_OF_RANGE'));
});

test('nonnumeric, exponential, mixed-separator, and giant decimal inputs are rejected', () => {
  for (const value of ['Infinity', 'NaN', '1e6', '1.234,56', '1,234.56', '1 000', '0x20', '', '.5', '1.1234567890123', '9'.repeat(500)]) {
    assert.throws(() => parseExactDecimal(value), PricingStockValidationError);
  }
  assert.throws(() => normalizePricingStockCell('saleNet', 1 as unknown as string), PricingStockValidationError);
});

test('model validation rejects unusable capacity, invalid percentages, negative costs and unsupported versions', () => {
  for (const parameters of [
    { headcount: '0' }, { headcount: '1.5' }, { availableHours: '0' }, { availableHours: '-2' },
    { utilizationPercent: '0' }, { utilizationPercent: '100.0001' },
    { adequacyThresholdPercent: '99' }, { fixedCosts: '-1' }, { targetProfit: '-1' },
    { employeeCost: '10000000000' }, { headcount: '1000001' }, { availableHours: '744.0001' }
  ]) {
    const model = createDefaultPricingStockModel();
    assert.ok(validatePricingStockModel({ ...model, parameters: { ...model.parameters, ...parameters } }).length > 0);
  }
  assert.ok(validatePricingStockModel({ ...createDefaultPricingStockModel(), formulaVersion: 2 }).length > 0);
  assert.ok(validatePricingStockModel({ ...createDefaultPricingStockModel(), revision: '' }).length > 0);
  const normalized = normalizePricingStockModel({
    ...createDefaultPricingStockModel('r2'),
    parameters: { ...createDefaultPricingStockModel().parameters, employeeCost: '2650,005' }
  });
  assert.equal(normalized.parameters.employeeCost, '2650.01');
  assert.equal(normalized.revision, 'r2');
});

test('the closed formula grammar rejects executable code and circular references', () => {
  for (const formula of [
    'process.exit()', 'globalThis', 'window.alert(1)', 'eval(1)', 'Function(1)',
    'constructor.constructor(1)', '__proto__', 'Object.keys(1)', 'Math.max(1;2)',
    'nabavna_cena = 4', '1; 2', '1 || 2', '1 && 2', '1 < 2', '1 ? 2 : 3',
    '[1]', '{a:1}', '"10"', '`10`', '1 // 2', '2 ** 4', '2 ^ 3',
    'ciljna_rvc + 1', 'recommendedPrice', 'unknown_variable', '1e6', '1 + )'
  ]) assert.throws(() => compilePricingStockFormula(formula), PricingStockValidationError, formula);
});

test('parser rejects division by zero, malformed parentheses and incorrect function arguments', () => {
  for (const formula of ['1/0', '1/(2-2)', 'čas_artikla_v_minutah / 0']) {
    assert.throws(() => compilePricingStockFormula(formula), errorCode('DIVISION_BY_ZERO'));
  }
  for (const formula of ['(1+2', '1+2)', 'min(1)', 'abs(1;2)', 'round(1;2;3)', 'round(1;7)', 'round(1;-1)', 'round(1;0.5)', 'min()', '1 2']) {
    assert.throws(() => compilePricingStockFormula(formula), PricingStockValidationError, formula);
  }
  const division = calculatePricingStockRow(values({ saleNet: '0' }), literalModel('1 / prodajna_cena'));
  assert.equal(division.targetRvc, null);
  assert.ok(division.errors.some((issue) => issue.code === 'DIVISION_BY_ZERO'));
});

test('expression limits cap text, tokens, nesting and rational growth', () => {
  for (const formula of [
    '1'.repeat(2049), '1+'.repeat(270) + '1', '('.repeat(40) + '1' + ')'.repeat(40),
    Array.from({ length: 45 }, () => '0.000000000001').join(' * '),
    '9999999999999999999999999 * 2'
  ]) assert.throws(() => compilePricingStockFormula(formula), PricingStockValidationError);
});

test('exact sort keeps missing values last without float conversion', () => {
  const sorted = ['9999999999.99', null, '-1.00', '0.30', '0.10'].sort(comparePricingStockDecimals);
  assert.deepEqual(sorted, ['-1.00', '0.10', '0.30', '9999999999.99', null]);
  assert.equal(comparePricingStockDecimals('0.3', '0.30'), 0);
});

test('bulk previews support stock set/adjust, sale deltas, time and recommendations with explicit rounding', () => {
  const rows = [{ variantId: 1, ...values({ saleNet: '10.05' }) }];
  const model = createDefaultPricingStockModel();
  for (const [operation, proposed] of [
    [{ kind: 'inventory-set', value: '9' }, '9'],
    [{ kind: 'inventory-adjust', value: '-2' }, '3'],
    [{ kind: 'sale-adjust-money', value: '0.005' }, '10.06'],
    [{ kind: 'sale-adjust-percent', value: '10' }, '11.06'],
    [{ kind: 'work-set', value: '8,55555' }, '8.5556'],
    [{ kind: 'recommended-price' }, '15.68']
  ] as const) {
    const result = previewPricingStockBulk(rows, model, operation);
    assert.deepEqual(result.errors, []);
    assert.equal(result.rows[0].proposed, proposed);
    assert.equal(result.rounding, 'half-away-from-zero');
  }
});

test('bulk errors remain attached to exact variants and no invalid proposal silently becomes zero', () => {
  const rows = [
    { variantId: 1, ...values({ inventory: 0 }) },
    { variantId: 2, ...values({ inventory: 5 }) }
  ];
  const result = previewPricingStockBulk(rows, createDefaultPricingStockModel(), { kind: 'inventory-adjust', value: '-2' });
  assert.equal(result.errors[0].variantId, 1);
  assert.equal(result.rows[0].variantId, 2);
  assert.equal(result.rows[0].proposed, '3');
  const missing = previewPricingStockBulk([{ variantId: 3, ...values({ purchaseNet: null }) }],
    createDefaultPricingStockModel(), { kind: 'recommended-price' });
  assert.equal(missing.rows.length, 0);
  assert.equal(missing.errors[0].code, 'MISSING_VALUE');
  assert.equal(previewPricingStockBulk([rows[0], rows[0]], createDefaultPricingStockModel(), {
    kind: 'inventory-set', value: '1'
  }).errors[0].code, 'DUPLICATE_VARIANT');
});

test('Excel paste respects tabular row order, comma decimals, quotes, and nullable blanks', () => {
  assert.deepEqual(parsePricingStockPaste('1,25\t2.55\t3\r\n"0"\t0\t\r\n', ['purchaseNet', 'saleNet', 'workMinutes']), {
    rows: [
      { purchaseNet: '1.25', saleNet: '2.55', workMinutes: '3.0000' },
      { purchaseNet: '0.00', saleNet: '0.00', workMinutes: null }
    ],
    errors: []
  });
  assert.deepEqual(parsePricingStockPaste('1\n\n3', ['purchaseNet']).rows,
    [{ purchaseNet: '1.00' }, { purchaseNet: null }, { purchaseNet: '3.00' }]);
});

test('paste rejects bad cells and overflow with their row/column positions', () => {
  const result = parsePricingStockPaste('1\t2\n-1\tbogus', ['inventory', 'saleNet']);
  assert.deepEqual(result.errors.map(({ rowIndex, columnIndex }) => [rowIndex, columnIndex]), [[1, 0], [1, 1]]);
  assert.equal(parsePricingStockPaste('1\t2', ['saleNet']).errors[0].code, 'PASTE_COLUMNS');
  assert.equal(parsePricingStockPaste('"1', ['saleNet']).errors[0].code, 'INVALID_TSV');
  assert.equal(parsePricingStockPaste('1', ['saleNet', 'saleNet']).errors[0].code, 'INVALID_FIELDS');
  assert.equal(parsePricingStockPaste('1\n'.repeat(5001), ['saleNet']).errors[0].code, 'PASTE_LIMIT');
});

test('model validation rejects global division errors without needing sample item values', () => {
  for (const formula of [
    'čas_artikla_v_minutah / (število_zaposlenih - 5)',
    'čas_artikla_v_minutah + 1 / (izkoriščenost - 0.75)'
  ]) {
    const issues = validatePricingStockModel(literalModel(formula));
    assert.ok(issues.some((issue) => issue.code === 'DIVISION_BY_ZERO'));
  }
  assert.throws(() => compilePricingStockFormula('round(čas_artikla_v_minutah; 7)'), errorCode('INVALID_PRECISION'));
});

test('exact division does not reject valid cancellation through a tiny rational denominator', () => {
  const tiny = multiplyExact(parseExactDecimal('0.000000000001'), parseExactDecimal('0.000000000001'));
  const tinier = multiplyExact(tiny, parseExactDecimal('0.1'));
  assert.equal(formatExactDecimal(divideExact(parseExactDecimal('0'), tinier), 2), '0.00');
  assert.equal(formatExactDecimal(divideExact(tinier, tinier), 2), '1.00');
});

test('bulk output bounds are checked before monetary rounding', () => {
  const result = previewPricingStockBulk([
    { variantId: 1, ...values({ saleNet: '9999999999.99' }) }
  ], createDefaultPricingStockModel(), { kind: 'sale-adjust-money', value: '0.001' });
  assert.equal(result.rows.length, 0);
  assert.equal(result.errors[0].code, 'OUT_OF_RANGE');
});


test('coverage classifications use unrounded targets rather than displayed cents or percentages', () => {
  const justBelow = calculatePricingStockRow(values(), literalModel('10.000001'));
  assert.equal(justBelow.targetRvc, '10.00');
  assert.equal(justBelow.coveragePercent, '100.00');
  assert.equal(justBelow.status, 'below');
  const nearAdequate = calculatePricingStockRow(values({ saleNet: '22.00' }), literalModel('10.000001'));
  assert.equal(nearAdequate.coveragePercent, '120.00');
  assert.equal(nearAdequate.status, 'borderline');
  const exactlyAdequate = calculatePricingStockRow(values({ saleNet: '22.00' }), literalModel('10'));
  assert.equal(exactlyAdequate.status, 'adequate');
});

test('recommended selling price adds the exact target before its final rounding', () => {
  const result = calculatePricingStockRow(values(), literalModel('-0.005'));
  assert.equal(result.targetRvc, '-0.01');
  assert.equal(result.recommendedPrice, '10.00');
  assert.equal(result.coveragePercent, null);
  const proposal = previewPricingStockBulk([{ variantId: 1, ...values() }],
    literalModel('-0.005'), { kind: 'recommended-price' });
  assert.deepEqual(proposal.errors, []);
  assert.equal(proposal.rows[0].proposed, '10.00');
});

test('numeric functions keep decimal commas distinct from semicolon argument separators', () => {
  assert.equal(evaluatePricingStockFormula('min(1,20; 1,25)', {}, 2), '1.20');
  assert.equal(evaluatePricingStockFormula('max(1,20; 1,25)', {}, 2), '1.25');
  assert.equal(evaluatePricingStockFormula('round(max(1,004; 1,005); 2)', {}, 2), '1.01');
  assert.throws(() => compilePricingStockFormula('min(1,2)'), errorCode('INVALID_ARGUMENTS'));
  assert.throws(() => compilePricingStockFormula('max(1.20, 1.25)'), errorCode('INVALID_TOKEN'));
  assert.throws(() => evaluatePricingStockFormula('min(0; 1 / prodajna_cena)', { prodajna_cena: '0' }),
    errorCode('DIVISION_BY_ZERO'));
});


test('missing inputs cannot hide a known invalid row denominator or precision later in the expression', () => {
  const invalidDenominator = calculatePricingStockRow(values({ otherCosts: null, saleNet: '0.00' }),
    literalModel('drugi_spremenljivi_stroški_artikla + 1 / prodajna_cena'));
  assert.ok(invalidDenominator.errors.some((issue) => issue.code === 'DIVISION_BY_ZERO'));
  const invalidPrecision = calculatePricingStockRow(values({ otherCosts: null, purchaseNet: '7.00' }),
    literalModel('round(drugi_spremenljivi_stroški_artikla; nabavna_cena)'));
  assert.ok(invalidPrecision.errors.some((issue) => issue.code === 'INVALID_PRECISION'));
  const genuinelyMissing = calculatePricingStockRow(values({ otherCosts: null, saleNet: null }),
    literalModel('drugi_spremenljivi_stroški_artikla + 1 / prodajna_cena'));
  assert.deepEqual(genuinelyMissing.errors.map((issue) => issue.code), ['MISSING_VALUE']);
});
