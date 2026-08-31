import assert from 'node:assert/strict';
import test from 'node:test';
import { createAdminAnalyticsTrend } from '@/shared/ui/admin-analytics-comparison-row';

test('analytics comparison trends match the shared order-card zero baseline rules', () => {
  assert.deepEqual(createAdminAnalyticsTrend(5, 0), {
    direction: 'positive',
    value: '100%'
  });
  assert.deepEqual(createAdminAnalyticsTrend(0, 0), {
    direction: 'neutral',
    value: '0%'
  });
  assert.deepEqual(createAdminAnalyticsTrend(5, 10), {
    direction: 'negative',
    value: '50%'
  });
  assert.deepEqual(createAdminAnalyticsTrend(15, 10), {
    direction: 'positive',
    value: '50%'
  });
});
