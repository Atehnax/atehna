import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import {
  DEFAULT_SHIPPING_CONFIGURATION,
  SHIPPING_MAX_AMOUNT_CENTS,
  applyShippingManualOverride,
  calculateShipping,
  cloneDefaultShippingConfiguration,
  getActiveShippingRuleRegistry,
  normalizeShippingConfiguration,
  parseShippingConfiguration,
  validatePersistedOrderShippingReadiness,
  validateShippingConfiguration,
  type CalculatedShipping,
  type ShippingCalculationItemInput,
  type ShippingConfiguration,
  type ShippingDimensionalRule,
  type ShippingDraftRule,
  type ShippingOrderValueDiscountRule
} from '../../src/shared/domain/shipping/shipping';

function item(
  weightGrams = 1_000,
  dimensions: [number, number, number] = [100, 80, 10]
): ShippingCalculationItemInput {
  return {
    productId: 'product-1',
    variantId: 'variant-1',
    sku: 'SKU-1',
    name: 'Artikel',
    quantity: 1,
    measurement: {
      weightGrams,
      lengthMm: dimensions[0],
      widthMm: dimensions[1],
      heightMm: dimensions[2]
    }
  };
}

function requireCalculated(
  configuration: ShippingConfiguration,
  merchandiseSubtotalCents = 0,
  parcelCount = 1
): CalculatedShipping {
  const result = calculateShipping(configuration, [item()], {
    merchandiseSubtotalCents,
    parcelCount
  });
  assert.equal(result.status, 'calculated', result.status === 'manual_quote' ? result.reason : '');
  return result as CalculatedShipping;
}

test('shipping money validation enforces the database cap and fails overflow closed', () => {
  const atLimit = cloneDefaultShippingConfiguration();
  atLimit.weightBands[0].priceCents = SHIPPING_MAX_AMOUNT_CENTS;
  assert.deepEqual(validateShippingConfiguration(atLimit), []);
  assert.equal(requireCalculated(atLimit).finalAmountCents, SHIPPING_MAX_AMOUNT_CENTS);

  const bandOverLimit = cloneDefaultShippingConfiguration();
  bandOverLimit.weightBands[0].priceCents = SHIPPING_MAX_AMOUNT_CENTS + 1;
  assert.ok(validateShippingConfiguration(bandOverLimit).some((issue) =>
    issue.code === 'INVALID_WEIGHT_BAND'
    && issue.ruleId === 'under-5kg'
    && issue.message.includes('presega največji podprti znesek')
  ));
  assert.equal(calculateShipping(bandOverLimit, [item()]).status, 'manual_quote');

  const combinedOverflow = cloneDefaultShippingConfiguration();
  combinedOverflow.weightBands[0].priceCents = SHIPPING_MAX_AMOUNT_CENTS - 100;
  combinedOverflow.dimensionalRules[0] = {
    ...combinedOverflow.dimensionalRules[0],
    enabled: true,
    adjustmentValue: 101
  };
  const overflowIssues = validateShippingConfiguration(combinedOverflow);
  assert.ok(overflowIssues.some((issue) =>
    issue.code === 'INVALID_DIMENSIONAL_RULE'
    && issue.ruleId === 'larger-than-1000mm'
    && issue.message.includes('presega največji podprti znesek')
  ));
  const overflowResult = calculateShipping(combinedOverflow, [item(1_000, [1_001, 80, 10])]);
  assert.equal(overflowResult.status, 'manual_quote');
  assert.equal(overflowResult.issues[0]?.code, 'INVALID_CONFIGURATION');
});

test('manual shipping override accepts the exact cap and rejects any larger amount', () => {
  const automatic = requireCalculated(cloneDefaultShippingConfiguration());
  const override = {
    reason: 'Posebna dostava',
    automaticAmountCents: automatic.automaticAmountCents,
    originalAmountCents: automatic.finalAmountCents,
    overrideAmountCents: SHIPPING_MAX_AMOUNT_CENTS,
    actorId: 'admin-1',
    actorName: 'Administrator',
    appliedAt: '2026-08-28T10:00:00.000Z'
  };

  assert.equal(
    applyShippingManualOverride(automatic, override).finalAmountCents,
    SHIPPING_MAX_AMOUNT_CENTS
  );
  assert.throws(
    () => applyShippingManualOverride(automatic, {
      ...override,
      overrideAmountCents: SHIPPING_MAX_AMOUNT_CENTS + 1
    }),
    /non-negative amount and a reason/u
  );
});

test('persisted order readiness blocks zero-default drafts and accepts coherent overrides', () => {
  const calculated = requireCalculated(cloneDefaultShippingConfiguration(), 1_220);
  const readyAutomatic = {
    expectedItemCount: 1,
    snapshotLineCount: 1,
    subtotal: '10.00',
    tax: '2.20',
    shipping: '3.00',
    automaticShipping: '3.00',
    total: '15.20',
    shippingSnapshot: calculated,
    shippingOverride: null,
    shippingOverrideStale: false,
    parcelCount: 1
  };
  assert.deepEqual(
    validatePersistedOrderShippingReadiness(readyAutomatic),
    { ok: true }
  );

  const zeroDefault = validatePersistedOrderShippingReadiness({
    ...readyAutomatic,
    expectedItemCount: 0,
    snapshotLineCount: 0,
    shipping: '0.00',
    automaticShipping: null,
    total: '0.00',
    shippingSnapshot: {}
  });
  assert.equal(zeroDefault.ok, false);
  if (!zeroDefault.ok) assert.match(zeroDefault.message, /vsaj eno veljavno postavko/u);

  const manualQuote = calculateShipping(
    cloneDefaultShippingConfiguration(),
    [item(30_001)]
  );
  assert.equal(manualQuote.status, 'manual_quote');
  const readyManualOverride = validatePersistedOrderShippingReadiness({
    ...readyAutomatic,
    shipping: '0.00',
    automaticShipping: null,
    total: '12.20',
    shippingSnapshot: manualQuote,
    shippingOverride: {
      reason: 'Dogovor s stranko',
      automaticAmountCents: null,
      originalAmountCents: null,
      overrideAmountCents: 0,
      actorId: 'admin',
      actorName: 'Administrator',
      appliedAt: new Date().toISOString()
    }
  });
  assert.deepEqual(readyManualOverride, { ok: true });

  const stale = validatePersistedOrderShippingReadiness({
    ...readyAutomatic,
    shippingOverrideStale: true
  });
  assert.equal(stale.ok, false);
  if (!stale.ok) assert.match(stale.message, /zastarela/u);
});

test('legacy dimensional rules without an operator normalize to strict greater-than', () => {
  const legacyConfiguration = cloneDefaultShippingConfiguration();
  delete (
    legacyConfiguration.dimensionalRules[0] as Partial<ShippingDimensionalRule>
  ).comparisonOperator;

  const normalized = normalizeShippingConfiguration(legacyConfiguration);
  assert.equal(normalized.dimensionalRules[0].comparisonOperator, '>');
});

test('dimensional condition uniqueness includes both operator and threshold', () => {
  const configuration = cloneDefaultShippingConfiguration();
  configuration.dimensionalRules.push({
    ...configuration.dimensionalRules[0],
    id: 'not-larger-than-1000mm',
    name: 'Do vključno 1000 mm',
    comparisonOperator: '<=',
    position: 1
  });
  assert.equal(
    validateShippingConfiguration(configuration)
      .some((issue) => issue.code === 'DUPLICATE_DIMENSIONAL_THRESHOLD'),
    false
  );

  configuration.dimensionalRules[1].comparisonOperator = '>';
  assert.equal(
    validateShippingConfiguration(configuration)
      .some((issue) => issue.code === 'DUPLICATE_DIMENSIONAL_THRESHOLD'),
    true
  );
});

test('order-value conditions default legacy rules to inclusive and validate operator plus boundary', () => {
  const legacyConfiguration = cloneDefaultShippingConfiguration();
  legacyConfiguration.orderValueDiscountRules = [{
    id: 'legacy-value-rule',
    name: 'Stari vrednostni prag',
    comparisonOperator: '>=',
    minMerchandiseValueCents: 10_000,
    adjustmentType: 'percentage',
    adjustmentValue: 10,
    enabled: true,
    position: 0
  }];
  delete (
    legacyConfiguration.orderValueDiscountRules[0] as Partial<ShippingOrderValueDiscountRule>
  ).comparisonOperator;

  const normalized = normalizeShippingConfiguration(legacyConfiguration);
  assert.equal(normalized.orderValueDiscountRules[0].comparisonOperator, '>=');

  normalized.orderValueDiscountRules.push({
    ...normalized.orderValueDiscountRules[0],
    id: 'upper-bound-value-rule',
    name: 'Do vključno 100 €',
    comparisonOperator: '<=',
    position: 1
  });
  assert.equal(
    validateShippingConfiguration(normalized)
      .some((issue) => issue.code === 'DUPLICATE_ORDER_VALUE_THRESHOLD'),
    false
  );

  normalized.orderValueDiscountRules[1].comparisonOperator = '>=';
  assert.equal(
    validateShippingConfiguration(normalized)
      .some((issue) => issue.code === 'DUPLICATE_ORDER_VALUE_THRESHOLD'),
    true
  );

  normalized.orderValueDiscountRules[1].comparisonOperator = '!=' as '>=';
  assert.ok(validateShippingConfiguration(normalized).some((issue) =>
    issue.code === 'INVALID_ORDER_VALUE_DISCOUNT_RULE'
    && issue.ruleId === 'upper-bound-value-rule'
    && issue.message.includes('operatorja primerjave')
  ));
});

test('the typed active registry excludes disabled and draft rules, and calculation follows it', () => {
  const configuration = cloneDefaultShippingConfiguration();
  configuration.weightBands.unshift({
    id: 'disabled-cheap-band',
    name: 'Neaktiven razpon',
    minWeightGrams: 1,
    maxWeightGrams: 4_999,
    priceCents: 1,
    enabled: false,
    position: -1
  });
  configuration.dimensionalRules[0] = {
    ...configuration.dimensionalRules[0],
    enabled: true,
    adjustmentValue: 400
  };
  configuration.draftRules.push({
    id: 'future-zone-rule',
    name: 'Območna dostava',
    note: 'Evaluator še ne obstaja.',
    status: 'draft',
    createdAt: '2026-08-28T10:00:00.000Z',
    updatedAt: '2026-08-28T10:00:00.000Z',
    enabled: true,
    thresholdMm: 1,
    adjustmentValue: 99_999
  } as ShippingDraftRule & {
    enabled: boolean;
    thresholdMm: number;
    adjustmentValue: number;
  });

  const registry = getActiveShippingRuleRegistry(configuration);
  assert.deepEqual(
    registry.map((entry) => [entry.type, entry.rule.id]),
    [
      ['weight_band', 'under-5kg'],
      ['weight_band', '5kg-to-30kg'],
      ['dimensional_surcharge', 'larger-than-1000mm'],
      ['multi_piece_discount', 'multi-piece-2']
    ]
  );
  assert.ok(registry.every((entry) => entry.rule.enabled));
  assert.equal(
    registry.find((entry) => entry.type === 'dimensional_surcharge')?.rule
      .comparisonOperator,
    '>'
  );
  assert.equal(registry.some((entry) => entry.rule.id === 'future-zone-rule'), false);
  assert.equal(registry.some((entry) => entry.rule.id === 'disabled-cheap-band'), false);

  const result = calculateShipping(configuration, [item(1_000, [1_001, 80, 10])]);
  assert.equal(result.status, 'calculated');
  if (result.status !== 'calculated') return;
  assert.equal(result.basePriceCents, 300);
  assert.equal(result.matchedDimensionalRule?.id, 'larger-than-1000mm');
  assert.equal(result.surchargeAmountCents, 400);
  assert.equal(result.finalAmountCents, 700);
});

test('validation names the exact range or rule and the invalid field', () => {
  const rangeCases: Array<{
    mutate: (configuration: ShippingConfiguration) => void;
    phrase: string;
  }> = [
    { mutate: (configuration) => { configuration.weightBands[0].minWeightGrams = 0; }, phrase: 'spodnje meje' },
    { mutate: (configuration) => { configuration.weightBands[0].maxWeightGrams = 0; }, phrase: 'zgornje meje' },
    { mutate: (configuration) => { configuration.weightBands[0].priceCents = 0; }, phrase: 'pozitivno ceno' }
  ];
  for (const rangeCase of rangeCases) {
    const configuration = cloneDefaultShippingConfiguration();
    configuration.weightBands[0].name = 'Lahka pošiljka';
    rangeCase.mutate(configuration);
    const message = validateShippingConfiguration(configuration)
      .find((issue) => issue.code === 'INVALID_WEIGHT_BAND' && issue.ruleId === 'under-5kg')
      ?.message ?? '';
    assert.match(message, /»Lahka pošiljka«/u);
    assert.ok(message.includes(rangeCase.phrase), message);
  }

  const dimensionalCases: Array<{
    mutate: (configuration: ShippingConfiguration) => void;
    phrase: string;
  }> = [
    { mutate: (configuration) => { configuration.dimensionalRules[0].thresholdMm = 0; }, phrase: 'meje v milimetrih' },
    {
      mutate: (configuration) => {
        configuration.dimensionalRules[0].adjustmentType = 'formula' as 'fixed';
      },
      phrase: 'vrste dodatka'
    },
    {
      mutate: (configuration) => {
        configuration.dimensionalRules[0].comparisonOperator = '!=' as '>';
      },
      phrase: 'operatorja primerjave'
    },
    { mutate: (configuration) => { configuration.dimensionalRules[0].adjustmentValue = -1; }, phrase: 'vrednosti dodatka' }
  ];
  for (const dimensionalCase of dimensionalCases) {
    const configuration = cloneDefaultShippingConfiguration();
    configuration.dimensionalRules[0].name = 'Dolga pošiljka';
    dimensionalCase.mutate(configuration);
    const message = validateShippingConfiguration(configuration)
      .find((issue) =>
        issue.code === 'INVALID_DIMENSIONAL_RULE'
        && issue.ruleId === 'larger-than-1000mm'
        && issue.message.includes(dimensionalCase.phrase)
      )?.message ?? '';
    assert.match(message, /»Dolga pošiljka«/u);
    assert.ok(message.includes(dimensionalCase.phrase), message);
  }
});

test('legacy stored configurations gain the new defaults while malformed present arrays fail', () => {
  const legacy = cloneDefaultShippingConfiguration() as Partial<ShippingConfiguration>;
  delete legacy.orderValueDiscountRules;
  delete legacy.multiPieceDiscountRules;

  const parsed = parseShippingConfiguration(legacy);
  assert.deepEqual(parsed.orderValueDiscountRules, []);
  assert.deepEqual(parsed.multiPieceDiscountRules, [
    {
      id: 'multi-piece-2',
      name: 'Od 2 paketov',
      minParcelCount: 2,
      adjustmentType: 'percentage',
      adjustmentValue: 50,
      enabled: true,
      position: 0
    }
  ]);

  const legacyWithoutMultiPieceName = cloneDefaultShippingConfiguration();
  delete (legacyWithoutMultiPieceName.multiPieceDiscountRules[0] as Partial<
    ShippingConfiguration['multiPieceDiscountRules'][number]
  >).name;
  assert.equal(
    parseShippingConfiguration(legacyWithoutMultiPieceName).multiPieceDiscountRules[0].name,
    'Od 2 paketov'
  );
  assert.throws(
    () => parseShippingConfiguration({
      ...legacy,
      orderValueDiscountRules: 'invalid'
    }),
    /arrays are missing/u
  );
});

test('discount configuration rejects duplicate thresholds and invalid values', () => {
  const configuration = cloneDefaultShippingConfiguration();
  configuration.orderValueDiscountRules = [
    {
      id: 'value-a',
      name: 'Prvi prag',
      comparisonOperator: '>=',
      minMerchandiseValueCents: 10_000,
      adjustmentType: 'percentage',
      adjustmentValue: 101,
      enabled: true,
      position: 0
    },
    {
      id: 'value-b',
      name: 'Podvojen prag',
      comparisonOperator: '>=',
      minMerchandiseValueCents: 10_000,
      adjustmentType: 'fixed',
      adjustmentValue: 100,
      enabled: true,
      position: 1
    }
  ];
  configuration.multiPieceDiscountRules = [
    {
      id: 'multi-a',
      name: 'Prvi večkosovni prag',
      minParcelCount: 2,
      adjustmentType: 'fixed',
      adjustmentValue: 1.5,
      enabled: true,
      position: 0
    },
    {
      id: 'multi-b',
      name: 'Podvojen večkosovni prag',
      minParcelCount: 2,
      adjustmentType: 'percentage',
      adjustmentValue: null,
      enabled: true,
      position: 1
    }
  ];

  const issues = validateShippingConfiguration(configuration);
  assert.ok(issues.some((issue) => issue.code === 'DUPLICATE_ORDER_VALUE_THRESHOLD'));
  assert.ok(issues.some((issue) =>
    issue.code === 'INVALID_ORDER_VALUE_DISCOUNT_RULE'
    && issue.ruleId === 'value-a'
    && issue.message.includes('100 %')
  ));
  assert.ok(issues.some((issue) => issue.code === 'DUPLICATE_MULTI_PIECE_THRESHOLD'));
  assert.ok(issues.some((issue) =>
    issue.code === 'INVALID_MULTI_PIECE_DISCOUNT_RULE'
    && issue.ruleId === 'multi-a'
    && issue.message.includes('celem številu centov')
  ));
  assert.ok(issues.some((issue) =>
    issue.code === 'INVALID_MULTI_PIECE_DISCOUNT_RULE'
    && issue.ruleId === 'multi-b'
    && issue.message.includes('mora imeti vrednost')
  ));
});

test('persisted v2 readiness verifies parcel count, arithmetic, frozen rules, and subtotal with VAT', () => {
  const calculated = requireCalculated(cloneDefaultShippingConfiguration(), 1_220, 2);
  const ready = {
    expectedItemCount: 1,
    snapshotLineCount: 1,
    subtotal: '10.00',
    tax: '2.20',
    shipping: '3.00',
    automaticShipping: '3.00',
    total: '15.20',
    shippingSnapshot: calculated,
    shippingOverride: null,
    shippingOverrideStale: false,
    parcelCount: 2
  };
  assert.deepEqual(validatePersistedOrderShippingReadiness(ready), { ok: true });

  const wrongParcelCount = validatePersistedOrderShippingReadiness({
    ...ready,
    parcelCount: 3
  });
  assert.equal(wrongParcelCount.ok, false);

  const brokenArithmetic = validatePersistedOrderShippingReadiness({
    ...ready,
    shippingSnapshot: {
      ...calculated,
      parcelCountGrossAmountCents: calculated.parcelCountGrossAmountCents + 1
    }
  });
  assert.equal(brokenArithmetic.ok, false);

  const changedAppliedRule = validatePersistedOrderShippingReadiness({
    ...ready,
    shippingSnapshot: {
      ...calculated,
      matchedMultiPieceDiscountRule: calculated.matchedMultiPieceDiscountRule
        ? { ...calculated.matchedMultiPieceDiscountRule, adjustmentValue: 40 }
        : null
    }
  });
  assert.equal(changedAppliedRule.ok, false);

  const wrongMerchandiseBasis = validatePersistedOrderShippingReadiness({
    ...ready,
    shippingSnapshot: {
      ...calculated,
      merchandiseSubtotalCents: 1_221
    }
  });
  assert.equal(wrongMerchandiseBasis.ok, false);
});

test('legacy persisted value-discount snapshots default a missing operator to inclusive', () => {
  const configuration = cloneDefaultShippingConfiguration();
  configuration.orderValueDiscountRules = [{
    id: 'legacy-value-discount',
    name: 'Stari vrednostni popust',
    comparisonOperator: '>=',
    minMerchandiseValueCents: 1_000,
    adjustmentType: 'fixed',
    adjustmentValue: 100,
    enabled: true,
    position: 0
  }];
  const calculated = requireCalculated(configuration, 1_220, 2);
  const legacySnapshot = JSON.parse(JSON.stringify(calculated)) as CalculatedShipping;
  delete (
    legacySnapshot.configurationSnapshot.orderValueDiscountRules[0] as Partial<ShippingOrderValueDiscountRule>
  ).comparisonOperator;
  delete (
    legacySnapshot.matchedOrderValueDiscountRule as Partial<ShippingOrderValueDiscountRule>
  ).comparisonOperator;

  assert.deepEqual(validatePersistedOrderShippingReadiness({
    expectedItemCount: 1,
    snapshotLineCount: 1,
    subtotal: '10.00',
    tax: '2.20',
    shipping: '2.00',
    automaticShipping: '2.00',
    total: '14.20',
    shippingSnapshot: legacySnapshot,
    shippingOverride: null,
    shippingOverrideStale: false,
    parcelCount: 2
  }), { ok: true });
});

test('the SQL seed stays byte-for-value equivalent to the TypeScript shipping defaults', () => {
  const schema = readFileSync(resolve(process.cwd(), 'database', 'schema.sql'), 'utf8');
  const seedBlock = schema.slice(
    schema.indexOf('insert into shipping_settings'),
    schema.indexOf('create table catalog_categories')
  );
  const match = seedBlock.match(/'(\{[\s\S]*\})'::jsonb/u);
  assert.ok(match, 'shipping_settings JSON seed is present');
  assert.deepEqual(JSON.parse(match[1]), DEFAULT_SHIPPING_CONFIGURATION);
});

test('draft-only admin edits advance the admin revision without changing checkout version', () => {
  const service = readFileSync(
    resolve(process.cwd(), 'src', 'shared', 'server', 'shipping.ts'),
    'utf8'
  );
  const schema = readFileSync(resolve(process.cwd(), 'database', 'schema.sql'), 'utf8');

  assert.match(
    service,
    /const \{ draftRules: _draftRules, \.\.\.calculationConfiguration \} =\s*normalizeShippingConfiguration\(configuration\);/u
  );
  assert.match(
    service,
    /serializeCalculationConfiguration\(comparableInput\)\s*!== serializeCalculationConfiguration\(currentConfiguration\)/u
  );
  assert.match(
    service,
    /version: currentConfiguration\.version \+ \(calculationChanged \? 1 : 0\)/u
  );
  assert.match(service, /const nextRevision = currentRevision \+ 1;/u);
  assert.match(schema, /revision integer not null default 1/u);
  assert.match(schema, /shipping_settings_revision_check check \(revision > 0\)/u);
});
