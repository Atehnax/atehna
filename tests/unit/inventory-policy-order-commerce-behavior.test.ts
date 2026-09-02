import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import test from 'node:test';

type ScenarioResult = {
  outcome: 'accepted' | 'rejected';
  errorCode?: string;
  issueCodes?: string[];
  availableStock?: number;
  shippingStatus?: string;
};

type ProbeResult = {
  enabledOverstock: ScenarioResult;
  disabledOverstock: ScenarioResult;
  disabledInactiveProduct: ScenarioResult;
  disabledInactiveVariant: ScenarioResult;
  disabledInactiveCategory: ScenarioResult;
};

function runProbe(): ProbeResult {
  const output = execFileSync(
    process.execPath,
    [
      '--conditions=react-server',
      '--import',
      'tsx',
      'tests/unit/fixtures/inventory-policy-order-estimate-probe.ts'
    ],
    {
      cwd: process.cwd(),
      encoding: 'utf8',
      maxBuffer: 1024 * 1024,
      timeout: 30_000
    }
  );
  return JSON.parse(output) as ProbeResult;
}

test('authoritative checkout estimate applies stock policy without bypassing catalog activity', () => {
  const result = runProbe();

  assert.deepEqual(result.enabledOverstock, {
    outcome: 'rejected',
    errorCode: 'ORDER_ITEMS_UNAVAILABLE',
    issueCodes: ['INSUFFICIENT_STOCK']
  });
  assert.deepEqual(result.disabledOverstock, {
    outcome: 'accepted',
    availableStock: 0,
    shippingStatus: 'manual_quote'
  });

  for (const inactiveResult of [
    result.disabledInactiveProduct,
    result.disabledInactiveVariant,
    result.disabledInactiveCategory
  ]) {
    assert.deepEqual(inactiveResult, {
      outcome: 'rejected',
      errorCode: 'ORDER_ITEMS_UNAVAILABLE',
      issueCodes: ['VARIANT_NOT_AVAILABLE']
    });
  }
});
