import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applyShippingManualOverride,
  calculateShipping,
  cloneDefaultShippingConfiguration,
  formatShippingWeightIntervalGrams,
  parseShippingWeightIntervalGrams,
  recalculateShippingFromSnapshot,
  resetShippingManualOverride,
  SHIPPING_MAX_PARCEL_COUNT,
  validateShippingConfiguration,
  type CalculatedShipping,
  type ShippingCalculationContext,
  type ShippingCalculationItemInput,
  type ShippingConfiguration,
  type ShippingDimensionComparisonOperator
} from '../../src/shared/domain/shipping/shipping';

function item(
  weightGrams: number,
  dimensions: [number, number, number] = [100, 80, 10],
  quantity = 1,
  variantId = 'variant-1'
): ShippingCalculationItemInput {
  return {
    productId: 'product-1',
    variantId,
    sku: variantId.toUpperCase(),
    name: variantId,
    quantity,
    measurement: {
      weightGrams,
      lengthMm: dimensions[0],
      widthMm: dimensions[1],
      heightMm: dimensions[2]
    }
  };
}

function calculated(
  configuration: ShippingConfiguration,
  items: ShippingCalculationItemInput[],
  context: ShippingCalculationContext = {}
): CalculatedShipping {
  const result = calculateShipping(configuration, items, context);
  assert.equal(result.status, 'calculated', result.status === 'manual_quote' ? result.reason : '');
  return result as CalculatedShipping;
}

test('default shipping boundaries are inclusive and unmatched high weight is manual', () => {
  const configuration = cloneDefaultShippingConfiguration();
  assert.equal(calculated(configuration, [item(4_999)]).finalAmountCents, 300);
  assert.equal(calculated(configuration, [item(5_000)]).finalAmountCents, 1_000);
  assert.equal(calculated(configuration, [item(30_000)]).finalAmountCents, 1_000);

  const unmatched = calculateShipping(configuration, [item(30_001)]);
  assert.equal(unmatched.status, 'manual_quote');
  assert.equal(unmatched.issues[0]?.code, 'WEIGHT_OUTSIDE_CONFIGURED_BANDS');
});

test('mathematical gram intervals map exactly to inclusive whole-gram bands', () => {
  assert.deepEqual(parseShippingWeightIntervalGrams('(1000, 2000)'), {
    ok: true,
    minWeightGrams: 1_001,
    maxWeightGrams: 1_999
  });
  assert.deepEqual(parseShippingWeightIntervalGrams('[1000, 2000)'), {
    ok: true,
    minWeightGrams: 1_000,
    maxWeightGrams: 1_999
  });
  assert.deepEqual(parseShippingWeightIntervalGrams('(1000, 2000]'), {
    ok: true,
    minWeightGrams: 1_001,
    maxWeightGrams: 2_000
  });
  assert.deepEqual(parseShippingWeightIntervalGrams('[1000, 2000]'), {
    ok: true,
    minWeightGrams: 1_000,
    maxWeightGrams: 2_000
  });
  assert.deepEqual(parseShippingWeightIntervalGrams('(30000, ∞)'), {
    ok: true,
    minWeightGrams: 30_001,
    maxWeightGrams: null
  });
  assert.deepEqual(parseShippingWeightIntervalGrams('[1001; 2000)'), {
    ok: true,
    minWeightGrams: 1_001,
    maxWeightGrams: 1_999
  });
});

test('stored weight bands format as compact equivalent mathematical intervals', () => {
  const configuration = cloneDefaultShippingConfiguration();
  assert.equal(
    formatShippingWeightIntervalGrams(configuration.weightBands[0]),
    '(0, 5000)'
  );
  assert.equal(
    formatShippingWeightIntervalGrams(configuration.weightBands[1]),
    '[5000, 30000]'
  );
  assert.equal(
    formatShippingWeightIntervalGrams({
      minWeightGrams: 30_001,
      maxWeightGrams: null
    }),
    '(30000, ∞)'
  );
  assert.equal(parseShippingWeightIntervalGrams('[0, 5000)').ok, false);
  assert.equal(parseShippingWeightIntervalGrams('[1000, 1500, 2000)').ok, false);
  assert.equal(parseShippingWeightIntervalGrams('(1000, ∞]').ok, false);
  assert.equal(parseShippingWeightIntervalGrams('[1000.5, 2000)').ok, false);
  assert.deepEqual(parseShippingWeightIntervalGrams('(30000, +∞)'), {
    ok: true,
    minWeightGrams: 30_001,
    maxWeightGrams: null
  });
});

test('an open-ended additional band handles 30,001 grams', () => {
  const configuration = cloneDefaultShippingConfiguration();
  configuration.weightBands.push({
    id: 'over-30kg',
    name: 'Nad 30 kg',
    minWeightGrams: 30_001,
    maxWeightGrams: null,
    priceCents: 2_500,
    enabled: true,
    position: 2
  });
  assert.equal(calculated(configuration, [item(30_001)]).finalAmountCents, 2_500);
});

test('quantity multiplies weight but never concatenates dimensions', () => {
  const configuration = cloneDefaultShippingConfiguration();
  configuration.dimensionalRules[0] = {
    ...configuration.dimensionalRules[0],
    enabled: true,
    adjustmentValue: 500
  };
  const result = calculated(configuration, [item(900, [900, 20, 5], 10)]);
  assert.equal(result.combinedWeightGrams, 9_000);
  assert.equal(result.largestDimensionMm, 900);
  assert.equal(result.basePriceCents, 1_000);
  assert.equal(result.surchargeAmountCents, 0);
});

test('1000 mm is not oversized and 1001 mm on every supported axis is oversized', () => {
  const configuration = cloneDefaultShippingConfiguration();
  configuration.dimensionalRules[0] = {
    ...configuration.dimensionalRules[0],
    enabled: true,
    adjustmentValue: 500
  };

  assert.equal(calculated(configuration, [item(1_000, [1_000, 20, 5])]).surchargeAmountCents, 0);
  for (const dimensions of [
    [1_001, 20, 5],
    [20, 1_001, 5],
    [20, 5, 1_001]
  ] as Array<[number, number, number]>) {
    assert.equal(calculated(configuration, [item(1_000, dimensions)]).surchargeAmountCents, 500);
  }
});

test('dimensional surcharge applies once and the first matching table rule wins', () => {
  const configuration = cloneDefaultShippingConfiguration();
  configuration.dimensionalRules = [
    {
      id: 'over-1000',
      name: 'Nad 1000',
      comparisonOperator: '>',
      thresholdMm: 1_000,
      adjustmentType: 'fixed',
      adjustmentValue: 500,
      enabled: true,
      position: 0
    },
    {
      id: 'over-1500',
      name: 'Nad 1500',
      comparisonOperator: '>',
      thresholdMm: 1_500,
      adjustmentType: 'fixed',
      adjustmentValue: 900,
      enabled: true,
      position: 1
    }
  ];
  const result = calculated(configuration, [
    item(2_500, [1_800, 20, 5], 4, 'long-a'),
    item(2_500, [1_700, 20, 5], 4, 'long-b')
  ]);
  assert.equal(result.matchedDimensionalRule?.id, 'over-1000');
  assert.equal(result.surchargeAmountCents, 500);
  assert.equal(result.finalAmountCents, 1_500);
  assert.equal(result.triggeringItem?.variantId, 'long-a');

  configuration.dimensionalRules[0].position = 1;
  configuration.dimensionalRules[1].position = 0;
  const reorderedResult = calculated(configuration, [
    item(2_500, [1_800, 20, 5], 4, 'long-a')
  ]);
  assert.equal(reorderedResult.matchedDimensionalRule?.id, 'over-1500');
  assert.equal(reorderedResult.surchargeAmountCents, 900);
});

test('percentage surcharge uses the base shipping price and rounds once', () => {
  const configuration = cloneDefaultShippingConfiguration();
  configuration.dimensionalRules[0] = {
    ...configuration.dimensionalRules[0],
    enabled: true,
    adjustmentType: 'percentage',
    adjustmentValue: 20
  };
  const result = calculated(configuration, [item(5_000, [1_001, 2, 1])]);
  assert.equal(result.basePriceCents, 1_000);
  assert.equal(result.surchargeAmountCents, 200);
  assert.equal(result.finalAmountCents, 1_200);
});

test('all dimensional comparison operators apply their boundary semantics exactly', () => {
  const cases: Array<[
    ShippingDimensionComparisonOperator,
    number,
    number,
    number,
    number
  ]> = [
    ['<', 999, 500, 1_000, 0],
    ['>', 1_001, 500, 1_000, 0],
    ['>=', 1_000, 500, 999, 0],
    ['<=', 1_000, 500, 1_001, 0]
  ];

  for (const [comparisonOperator, matchingSize, matchingAmount, otherSize, otherAmount] of cases) {
    const configuration = cloneDefaultShippingConfiguration();
    configuration.dimensionalRules[0] = {
      ...configuration.dimensionalRules[0],
      comparisonOperator,
      thresholdMm: 1_000,
      enabled: true,
      adjustmentValue: 500
    };
    assert.equal(
      calculated(configuration, [item(1_000, [matchingSize, 2, 1])]).surchargeAmountCents,
      matchingAmount
    );
    assert.equal(
      calculated(configuration, [item(1_000, [otherSize, 2, 1])]).surchargeAmountCents,
      otherAmount
    );
  }
});

test('missing, zero, fractional-gram, and incomplete measurements block calculation', () => {
  const configuration = cloneDefaultShippingConfiguration();
  const invalidMeasurements: ShippingCalculationItemInput['measurement'][] = [
    null,
    { weightGrams: 0, lengthMm: 10, widthMm: 10, heightMm: 10 },
    { weightGrams: 1.5, lengthMm: 10, widthMm: 10, heightMm: 10 },
    { weightGrams: 10, lengthMm: 10, widthMm: 10 }
  ];
  for (const measurement of invalidMeasurements) {
    const result = calculateShipping(configuration, [{ ...item(10), measurement }]);
    assert.equal(result.status, 'manual_quote');
  }
});

test('overlaps and malformed active dimensional rules invalidate configuration', () => {
  const configuration = cloneDefaultShippingConfiguration();
  configuration.weightBands[1].minWeightGrams = 4_999;
  configuration.dimensionalRules[0].enabled = true;
  const codes = validateShippingConfiguration(configuration).map((issue) => issue.code);
  assert.ok(codes.includes('OVERLAPPING_WEIGHT_BANDS'));
  assert.ok(codes.includes('INVALID_DIMENSIONAL_RULE'));
  assert.equal(calculateShipping(configuration, [item(5_000)]).status, 'manual_quote');
});

test('a configured gap uses the explicit manual-quote fallback and never zero', () => {
  const configuration = cloneDefaultShippingConfiguration();
  configuration.weightBands[1].minWeightGrams = 6_000;
  const result = calculateShipping(configuration, [item(5_500)]);
  assert.equal(result.status, 'manual_quote');
  assert.equal('finalAmountCents' in result, false);
});

test('a configuration without an explicit manual fallback is rejected', () => {
  const configuration = cloneDefaultShippingConfiguration() as unknown as Omit<
    ShippingConfiguration,
    'manualQuoteFallbackEnabled'
  > & { manualQuoteFallbackEnabled: boolean };
  configuration.manualQuoteFallbackEnabled = false;
  assert.ok(
    validateShippingConfiguration(configuration as ShippingConfiguration)
      .some((issue) => issue.code === 'MANUAL_FALLBACK_REQUIRED')
  );
  assert.equal(
    calculateShipping(configuration as ShippingConfiguration, [item(5_500)]).status,
    'manual_quote'
  );
});

test('decimal millimetre thresholds preserve strict greater-than semantics', () => {
  const configuration = cloneDefaultShippingConfiguration();
  configuration.dimensionalRules[0] = {
    ...configuration.dimensionalRules[0],
    thresholdMm: 1_000.5,
    enabled: true,
    adjustmentValue: 500
  };
  assert.equal(
    calculated(configuration, [item(1_000, [1_000.5, 2, 1])]).surchargeAmountCents,
    0
  );
  assert.equal(
    calculated(configuration, [item(1_000, [1_000.6, 2, 1])]).surchargeAmountCents,
    500
  );
});

test('manual override accepts exact zero and reset restores the automatic amount', () => {
  const automatic = calculated(cloneDefaultShippingConfiguration(), [item(4_999)]);
  const overridden = applyShippingManualOverride(automatic, {
    reason: 'Osebni prevzem',
    automaticAmountCents: automatic.automaticAmountCents,
    originalAmountCents: automatic.finalAmountCents,
    overrideAmountCents: 0,
    actorId: 'admin-1',
    actorName: 'Administrator',
    appliedAt: '2026-08-28T10:00:00.000Z'
  });
  assert.equal(overridden.source, 'manual_override');
  assert.equal(overridden.finalAmountCents, 0);
  assert.equal(overridden.manualOverride?.reason, 'Osebni prevzem');

  const reset = resetShippingManualOverride(overridden);
  assert.equal(reset.source, 'automatic');
  assert.equal(reset.finalAmountCents, 300);
  assert.equal(reset.manualOverride, null);
});

test('one parcel preserves the existing base-plus-dimensional result and snapshots v2 inputs', () => {
  const configuration = cloneDefaultShippingConfiguration();
  configuration.dimensionalRules[0] = {
    ...configuration.dimensionalRules[0],
    enabled: true,
    adjustmentValue: 200
  };
  const result = calculated(configuration, [item(1_000, [1_001, 20, 5])], {
    merchandiseSubtotalCents: 12_345,
    parcelCount: 1
  });

  assert.equal(result.singleParcelAmountCents, 500);
  assert.equal(result.parcelCountGrossAmountCents, 500);
  assert.equal(result.multiPieceDiscountAmountCents, 0);
  assert.equal(result.afterMultiPieceAmountCents, 500);
  assert.equal(result.orderValueDiscountAmountCents, 0);
  assert.equal(result.automaticAmountCents, 500);
  assert.equal(result.finalAmountCents, 500);
  assert.equal(result.parcelCount, 1);
  assert.equal(result.merchandiseSubtotalCents, 12_345);
  assert.equal(result.matchedMultiPieceDiscountRule, null);
  assert.equal(result.configurationSnapshot.multiPieceDiscountRules[0]?.id, 'multi-piece-2');
  assert.equal('draftRules' in result.configurationSnapshot, false);
});

test('multi-piece percentage applies to the parcel-count gross and rounds the formula once', () => {
  const configuration = cloneDefaultShippingConfiguration();
  configuration.weightBands[0].priceCents = 333;
  const result = calculated(configuration, [item(1_000)], {
    merchandiseSubtotalCents: 0,
    parcelCount: 3
  });

  assert.equal(result.singleParcelAmountCents, 333);
  assert.equal(result.parcelCountGrossAmountCents, 999);
  assert.equal(result.afterMultiPieceAmountCents, 500);
  assert.equal(result.multiPieceDiscountAmountCents, 499);
  assert.equal(result.automaticAmountCents, 500);
  assert.equal(result.matchedMultiPieceDiscountRule?.id, 'multi-piece-2');
});

test('multi-piece fixed discount is per parcel and floors each parcel at zero', () => {
  const configuration = cloneDefaultShippingConfiguration();
  configuration.multiPieceDiscountRules[0] = {
    ...configuration.multiPieceDiscountRules[0],
    adjustmentType: 'fixed',
    adjustmentValue: 400
  };
  const result = calculated(configuration, [item(1_000)], {
    merchandiseSubtotalCents: 0,
    parcelCount: 3
  });

  assert.equal(result.parcelCountGrossAmountCents, 900);
  assert.equal(result.afterMultiPieceAmountCents, 0);
  assert.equal(result.multiPieceDiscountAmountCents, 900);
  assert.equal(result.automaticAmountCents, 0);
});

test('highest qualifying parcel threshold wins independently of table position', () => {
  const configuration = cloneDefaultShippingConfiguration();
  configuration.multiPieceDiscountRules = [
    {
      id: 'four-parcels',
      name: 'Od štirih paketov',
      minParcelCount: 4,
      adjustmentType: 'fixed',
      adjustmentValue: 100,
      enabled: true,
      position: 0
    },
    {
      id: 'two-parcels',
      name: 'Od dveh paketov',
      minParcelCount: 2,
      adjustmentType: 'percentage',
      adjustmentValue: 10,
      enabled: true,
      position: 1
    }
  ];

  const four = calculated(configuration, [item(1_000)], {
    merchandiseSubtotalCents: 0,
    parcelCount: 4
  });
  assert.equal(four.matchedMultiPieceDiscountRule?.id, 'four-parcels');
  assert.equal(four.parcelCountGrossAmountCents, 1_200);
  assert.equal(four.afterMultiPieceAmountCents, 800);

  configuration.multiPieceDiscountRules = [{
    ...configuration.multiPieceDiscountRules[0],
    id: 'five-parcels',
    minParcelCount: 5
  }];
  const noDiscount = calculated(configuration, [item(1_000)], {
    merchandiseSubtotalCents: 0,
    parcelCount: 3
  });
  assert.equal(noDiscount.matchedMultiPieceDiscountRule, null);
  assert.equal(noDiscount.afterMultiPieceAmountCents, 900);
});

test('highest qualifying merchandise threshold wins and fixed discounts floor at zero', () => {
  const configuration = cloneDefaultShippingConfiguration();
  configuration.orderValueDiscountRules = [
    {
      id: 'over-100-eur',
      name: 'Nad 100 €',
      comparisonOperator: '>=',
      minMerchandiseValueCents: 10_000,
      adjustmentType: 'fixed',
      adjustmentValue: 100,
      enabled: true,
      position: 0
    },
    {
      id: 'over-200-eur',
      name: 'Nad 200 €',
      comparisonOperator: '>=',
      minMerchandiseValueCents: 20_000,
      adjustmentType: 'percentage',
      adjustmentValue: 50,
      enabled: true,
      position: 1
    }
  ];

  const lower = calculated(configuration, [item(1_000)], {
    merchandiseSubtotalCents: 19_999,
    parcelCount: 1
  });
  assert.equal(lower.matchedOrderValueDiscountRule?.id, 'over-100-eur');
  assert.equal(lower.orderValueDiscountAmountCents, 100);
  assert.equal(lower.automaticAmountCents, 200);

  const higher = calculated(configuration, [item(1_000)], {
    merchandiseSubtotalCents: 20_000,
    parcelCount: 1
  });
  assert.equal(higher.matchedOrderValueDiscountRule?.id, 'over-200-eur');
  assert.equal(higher.orderValueDiscountAmountCents, 150);
  assert.equal(higher.automaticAmountCents, 150);

  configuration.orderValueDiscountRules[1] = {
    ...configuration.orderValueDiscountRules[1],
    adjustmentType: 'fixed',
    adjustmentValue: 10_000
  };
  const floored = calculated(configuration, [item(1_000)], {
    merchandiseSubtotalCents: 20_000,
    parcelCount: 1
  });
  assert.equal(floored.orderValueDiscountAmountCents, 300);
  assert.equal(floored.automaticAmountCents, 0);
});

test('all order-value comparison operators apply their boundary semantics exactly', () => {
  const cases: Array<[
    ShippingDimensionComparisonOperator,
    number,
    number
  ]> = [
    ['<', 9_999, 10_000],
    ['>', 10_001, 10_000],
    ['>=', 10_000, 9_999],
    ['<=', 10_000, 10_001]
  ];

  for (const [comparisonOperator, matchingSubtotal, otherSubtotal] of cases) {
    const configuration = cloneDefaultShippingConfiguration();
    configuration.orderValueDiscountRules = [{
      id: `value-${comparisonOperator}`,
      name: `Pogoj ${comparisonOperator} 100 €`,
      comparisonOperator,
      minMerchandiseValueCents: 10_000,
      adjustmentType: 'fixed',
      adjustmentValue: 100,
      enabled: true,
      position: 0
    }];

    const matching = calculated(configuration, [item(1_000)], {
      merchandiseSubtotalCents: matchingSubtotal,
      parcelCount: 1
    });
    assert.equal(matching.orderValueDiscountAmountCents, 100);
    assert.equal(matching.matchedOrderValueDiscountRule?.comparisonOperator, comparisonOperator);
    assert.equal(
      matching.configurationSnapshot.orderValueDiscountRules[0].comparisonOperator,
      comparisonOperator
    );

    const other = calculated(configuration, [item(1_000)], {
      merchandiseSubtotalCents: otherSubtotal,
      parcelCount: 1
    });
    assert.equal(other.orderValueDiscountAmountCents, 0);
    assert.equal(other.matchedOrderValueDiscountRule, null);
  }
});

test('the numerically highest matching order-value boundary wins for overlapping conditions', () => {
  const configuration = cloneDefaultShippingConfiguration();
  configuration.orderValueDiscountRules = [
    {
      id: 'under-100-eur',
      name: 'Do 100 €',
      comparisonOperator: '<=',
      minMerchandiseValueCents: 10_000,
      adjustmentType: 'fixed',
      adjustmentValue: 50,
      enabled: true,
      position: 0
    },
    {
      id: 'under-200-eur',
      name: 'Do 200 €',
      comparisonOperator: '<=',
      minMerchandiseValueCents: 20_000,
      adjustmentType: 'fixed',
      adjustmentValue: 100,
      enabled: true,
      position: 1
    }
  ];

  const result = calculated(configuration, [item(1_000)], {
    merchandiseSubtotalCents: 5_000,
    parcelCount: 1
  });
  assert.equal(result.matchedOrderValueDiscountRule?.id, 'under-200-eur');
  assert.equal(result.orderValueDiscountAmountCents, 100);
});

test('calculation order is dimensional addition, multi-piece discount, then value discount', () => {
  const configuration = cloneDefaultShippingConfiguration();
  configuration.dimensionalRules[0] = {
    ...configuration.dimensionalRules[0],
    enabled: true,
    adjustmentType: 'fixed',
    adjustmentValue: 200
  };
  configuration.orderValueDiscountRules = [{
    id: 'value-20',
    name: 'Vrednostni popust',
    comparisonOperator: '>=',
    minMerchandiseValueCents: 10_000,
    adjustmentType: 'percentage',
    adjustmentValue: 20,
    enabled: true,
    position: 0
  }];

  const result = calculated(configuration, [item(1_000, [1_001, 20, 5])], {
    merchandiseSubtotalCents: 10_000,
    parcelCount: 3
  });
  assert.equal(result.singleParcelAmountCents, 500);
  assert.equal(result.parcelCountGrossAmountCents, 1_500);
  assert.equal(result.multiPieceDiscountAmountCents, 750);
  assert.equal(result.afterMultiPieceAmountCents, 750);
  assert.equal(result.orderValueDiscountAmountCents, 150);
  assert.equal(result.automaticAmountCents, 600);
  assert.equal(result.finalAmountCents, 600);

  const overridden = applyShippingManualOverride(result, {
    reason: 'Dogovorjen končni znesek',
    automaticAmountCents: result.automaticAmountCents,
    originalAmountCents: result.finalAmountCents,
    overrideAmountCents: 725,
    actorId: 'admin-1',
    actorName: 'Administrator',
    appliedAt: '2026-08-28T10:00:00.000Z'
  });
  assert.equal(overridden.automaticAmountCents, 600);
  assert.equal(overridden.finalAmountCents, 725);
  assert.equal(overridden.source, 'manual_override');
});

test('invalid calculation context and parcel-count overflow fail closed', () => {
  const configuration = cloneDefaultShippingConfiguration();
  const invalidSubtotal = calculateShipping(configuration, [item(1_000)], {
    merchandiseSubtotalCents: -1,
    parcelCount: 1
  });
  assert.equal(invalidSubtotal.status, 'manual_quote');
  assert.equal(invalidSubtotal.issues[0]?.code, 'INVALID_MERCHANDISE_SUBTOTAL');

  const invalidParcelCount = calculateShipping(configuration, [item(1_000)], {
    merchandiseSubtotalCents: 0,
    parcelCount: 1.5
  });
  assert.equal(invalidParcelCount.status, 'manual_quote');
  assert.equal(invalidParcelCount.issues[0]?.code, 'INVALID_PARCEL_COUNT');

  const databaseOverflowParcelCount = calculateShipping(
    configuration,
    [item(1_000)],
    {
      merchandiseSubtotalCents: 0,
      parcelCount: SHIPPING_MAX_PARCEL_COUNT + 1
    }
  );
  assert.equal(databaseOverflowParcelCount.status, 'manual_quote');
  assert.equal(
    databaseOverflowParcelCount.issues[0]?.code,
    'INVALID_PARCEL_COUNT'
  );

  configuration.weightBands[0].priceCents = 999_999_999_999;
  const overflow = calculateShipping(configuration, [item(1_000)], {
    merchandiseSubtotalCents: 0,
    parcelCount: 2
  });
  assert.equal(overflow.status, 'manual_quote');
  assert.equal(overflow.issues[0]?.code, 'CALCULATION_AMOUNT_OUT_OF_RANGE');
});

test('parcel recalculation uses only the frozen configuration, items, and merchandise subtotal', () => {
  const configuration = cloneDefaultShippingConfiguration();
  const original = calculated(configuration, [item(1_000)], {
    merchandiseSubtotalCents: 12_000,
    parcelCount: 1
  });

  configuration.weightBands[0].priceCents = 1_000;
  configuration.multiPieceDiscountRules[0].adjustmentValue = 90;
  assert.notEqual(
    original.configurationSnapshot.multiPieceDiscountRules,
    configuration.multiPieceDiscountRules
  );

  const recalculated = recalculateShippingFromSnapshot(original, 2);
  assert.equal(recalculated.status, 'calculated');
  if (recalculated.status !== 'calculated') return;
  assert.equal(recalculated.basePriceCents, 300);
  assert.equal(recalculated.merchandiseSubtotalCents, 12_000);
  assert.equal(recalculated.parcelCountGrossAmountCents, 600);
  assert.equal(recalculated.afterMultiPieceAmountCents, 300);
  assert.equal(recalculated.automaticAmountCents, 300);
  assert.equal(recalculated.manualOverride, null);
});
