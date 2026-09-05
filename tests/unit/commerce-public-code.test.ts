import assert from 'node:assert/strict';
import test from 'node:test';
import {
  abbreviateCommercePublicCode,
  formatOfferCode,
  formatOrderCode,
  formatQuoteCode,
  matchesParsedCommercePublicCode,
  parseCommercePublicCode
} from '../../src/shared/domain/commercePublicCode';

const base = '7K3M4X9P2D6R8H4Q';

test('admin public-code display uses six leading characters, an ellipsis and four trailing characters', () => {
  assert.equal(abbreviateCommercePublicCode('N-PZBM-Q44X-V55K-8AMY'), 'N-PZBM\u20268AMY');
  assert.equal(abbreviateCommercePublicCode(formatQuoteCode(base)), 'PV-7K3\u20268H4Q');
  assert.equal(abbreviateCommercePublicCode('SHORT-CODE'), 'SHORT-CODE');
  assert.equal(abbreviateCommercePublicCode('12345678901'), '12345678901');
  assert.equal(abbreviateCommercePublicCode('123456789012'), '123456\u20269012');
});

test('commerce public codes retain one immutable base across the journey', () => {
  assert.equal(formatQuoteCode(base), 'PV-7K3M-4X9P-2D6R-8H4Q');
  assert.equal(formatOfferCode(base, 2), 'PN-7K3M-4X9P-2D6R-8H4Q-V2');
  assert.equal(formatOrderCode(base), 'N-7K3M-4X9P-2D6R-8H4Q');
});

test('complete public codes are searchable without case, space, or hyphen sensitivity', () => {
  assert.deepEqual(parseCommercePublicCode('pv 7k3m 4x9p 2d6r 8h4q'), {
    kind: 'quote',
    base,
    version: null
  });
  assert.deepEqual(parseCommercePublicCode('pn7k3m4x9p2d6r8h4qv12'), {
    kind: 'offer',
    base,
    version: 12
  });
});

test('exact public-code matching includes the kind and offer version', () => {
  const expectedOffer = parseCommercePublicCode(`PN-${base}-V2`);
  assert.ok(expectedOffer);
  assert.equal(
    matchesParsedCommercePublicCode(`pn ${base} v2`, expectedOffer),
    true
  );
  assert.equal(
    matchesParsedCommercePublicCode(`PN-${base}-V1`, expectedOffer),
    false
  );
  assert.equal(
    matchesParsedCommercePublicCode(`PV-${base}`, expectedOffer),
    false
  );
  assert.equal(matchesParsedCommercePublicCode(null, expectedOffer), false);
});

test('partial, ambiguous, malformed, and unsafe public codes are rejected', () => {
  for (const value of [
    base,
    'N-7K3M',
    'N-7K3M-4X9P-2D6R-8H4O',
    'PN-7K3M-4X9P-2D6R-8H4Q-V0',
    'PV-7K3M-4X9P-2D6R-8H4Q-extra'
  ]) {
    assert.equal(parseCommercePublicCode(value), null);
  }
});
