import assert from 'node:assert/strict';
import test from 'node:test';
import { formatSlCount, formatSlOrderCount } from '../../src/shared/domain/formatting';

test('Slovenian order counts use singular, dual, and plural forms', () => {
  const examples: Array<[number, string]> = [
    [0, '0 naročil'], [1, '1 naročilo'], [2, '2 naročili'],
    [3, '3 naročila'], [4, '4 naročila'], [5, '5 naročil'],
    [11, '11 naročil'], [12, '12 naročil'], [13, '13 naročil'], [14, '14 naročil'],
    [21, '21 naročil'], [100, '100 naročil'],
    [101, '101 naročilo'], [102, '102 naročili'], [103, '103 naročila'],
    [104, '104 naročila'], [105, '105 naročil'], [111, '111 naročil'],
    [112, '112 naročil'], [201, '201 naročilo'], [1.5, '1,5 naročila']
  ];
  for (const [count, expected] of examples) assert.equal(formatSlOrderCount(count), expected);
});

test('Slovenian count phrases inflect accompanying adjectives', () => {
  const forms = {
    one: 'zabeležen ogled', two: 'zabeležena ogleda',
    few: 'zabeleženi ogledi', other: 'zabeleženih ogledov'
  };
  assert.equal(formatSlCount(1, forms), '1 zabeležen ogled');
  assert.equal(formatSlCount(2, forms), '2 zabeležena ogleda');
  assert.equal(formatSlCount(3, forms), '3 zabeleženi ogledi');
  assert.equal(formatSlCount(5, forms), '5 zabeleženih ogledov');
});
