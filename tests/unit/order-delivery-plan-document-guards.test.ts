import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const source = (relativePath: string) =>
  readFileSync(resolve(process.cwd(), relativePath), 'utf8');

test('order list document-type filters ignore stale pricing and delivery-note revisions', () => {
  const orders = source('src/shared/server/orders.ts');
  const filterStart = orders.indexOf(
    "if (options?.documentType && options.documentType !== 'all')"
  );
  const filterEnd = orders.indexOf('const requestedPageSize', filterStart);
  assert.ok(filterStart >= 0 && filterEnd > filterStart);
  const filter = orders.slice(filterStart, filterEnd);

  assert.match(filter, /od\.deleted_at is null/u);
  assert.match(
    filter,
    /od\.order_pricing_revision = orders\.pricing_revision/u
  );
  assert.match(filter, /od\.type <> 'dobavnica'/u);
  assert.match(
    filter,
    /od\.order_delivery_plan_revision = orders\.delivery_plan_revision/u
  );
});

test('archive restore rejects delivery-plan-stale Dobavnica documents only', () => {
  const archive = source('src/shared/server/deletedArchive.ts');
  const guardStart = archive.indexOf(
    'async function enforceCurrentPricingRevisionForRestoredDocuments'
  );
  const guardEnd = archive.indexOf(
    'async function enforceImmutableQuotePurchaseOrderEvidence',
    guardStart
  );
  assert.ok(guardStart >= 0 && guardEnd > guardStart);
  const guard = archive.slice(guardStart, guardEnd);

  assert.match(
    guard,
    /d\.order_pricing_revision <> o\.pricing_revision/u
  );
  assert.match(guard, /d\.type = 'dobavnica'/u);
  assert.match(
    guard,
    /d\.order_delivery_plan_revision <> o\.delivery_plan_revision/u
  );
  assert.match(guard, /cena, poštnina ali načrt dobave naročila/u);
});
