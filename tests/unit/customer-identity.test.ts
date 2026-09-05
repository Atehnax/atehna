import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import { getCustomerIdentity } from '../../src/shared/domain/order/customerIdentity';

test('individual identity uses the complete contact name instead of a stale first-name organization', () => {
  assert.deepEqual(getCustomerIdentity({
    customerType: 'individual', organizationName: 'Ana', contactName: 'Ana Novak'
  }), { name: 'Ana Novak', contact: '' });
});

test('individual names preserve surnames, accents, and compound names', () => {
  assert.deepEqual(getCustomerIdentity({
    customerType: 'individual', organizationName: 'Živa', contactName: ' Živa Marija Žagar-Novak '
  }), { name: 'Živa Marija Žagar-Novak', contact: '' });
});

test('individual identity falls back only when the contact name is empty', () => {
  for (const contactName of [undefined, null, '', '  ']) {
    assert.deepEqual(getCustomerIdentity({
      customerType: 'individual', organizationName: ' Ana Novak ', contactName
    }), { name: 'Ana Novak', contact: '' });
  }
});

for (const customerType of ['company', 'school']) {
  test(`${customerType} identity presents organization first and a distinct contact separately`, () => {
    assert.deepEqual(getCustomerIdentity({
      customerType, organizationName: ' Primer ustanove ', contactName: ' Ana Novak '
    }), { name: 'Primer ustanove', contact: 'Ana Novak' });
  });

  test(`${customerType} identity does not repeat an absent or duplicate contact`, () => {
    for (const contactName of [undefined, null, '', '  ', 'Primer ustanove', ' PRIMER  USTANOVE ']) {
      assert.deepEqual(getCustomerIdentity({
        customerType, organizationName: 'Primer ustanove', contactName
      }), { name: 'Primer ustanove', contact: '' });
    }
    assert.deepEqual(getCustomerIdentity({ customerType, contactName: 'Ana Novak' }), {
      name: 'Ana Novak', contact: ''
    });
  });
}

test('missing customer names remain empty so each surface controls its placeholder', () => {
  for (const customerType of ['individual', 'company', 'school', '']) {
    assert.deepEqual(getCustomerIdentity({ customerType }), { name: '', contact: '' });
    assert.deepEqual(getCustomerIdentity({ customerType, organizationName: ' ', contactName: null }), {
      name: '', contact: ''
    });
  }
});

const source = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

test('both admin tables render the shared identity with only a distinct secondary contact', () => {
  for (const [kind, path] of [
    ['order', 'src/admin/features/orders/components/AdminOrdersTable.tsx'],
    ['quote', 'src/admin/features/quotes/components/AdminQuotesTable.tsx']
  ]) {
    const table = source(path);
    assert.match(table, /import \{ getCustomerIdentity \} from '@\/shared\/domain\/order\/customerIdentity'/u);
    assert.match(table, /\{customerIdentity\.name \|\| '—'\}/u);
    assert.match(table, /\{customerIdentity\.contact \? \(/u);
    assert.match(table, /text-\[10px\] leading-4 text-slate-500/u);
    assert.ok(table.includes(`${kind}-table-customer-name-`));
    assert.ok(table.includes(`${kind}-table-contact-`));
  }
});

test('order search, sorting, and quick edit use the same displayed customer identity', () => {
  const table = source('src/admin/features/orders/components/AdminOrdersTable.tsx');
  assert.match(table, /const effectiveCustomer = \{ \.\.\.order, \.\.\.\(rowDetailOverrides\[order\.id\] \?\? \{\}\) \}/u);
  assert.match(table, /const customerLabel = customerIdentity\.name/u);
  assert.match(table, /customerLabel, customerIdentity\.contact, addressLabel/u);
  assert.match(table, /leftValue = leftRuntime\?\.customerLabel \?\? ''/u);
  assert.match(table, /const nextCustomerName = getCustomerIdentity\(\{/u);
  assert.doesNotMatch(table, /organization_name \|\| .*contact_name/u);
});

test('quote list mapping and quick edit do not prefer the stale individual organization field', () => {
  const mapper = source('src/shared/server/quotes.ts');
  assert.match(mapper, /customerName: getCustomerIdentity\(\{ customerType, organizationName, contactName \}\)\.name/u);
  assert.match(mapper, /or qr\.organization_name ilike/u);
  assert.match(mapper, /or qr\.contact_name ilike/u);
  const table = source('src/admin/features/quotes/components/AdminQuotesTable.tsx');
  assert.match(table, /initialCustomerName: getCustomerIdentity\(row\)\.name/u);
  assert.match(table, /draftCustomerName: getCustomerIdentity\(row\)\.name/u);
});
