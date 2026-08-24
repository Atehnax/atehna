import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';

const readSource = (path: string) =>
  readFile(resolve(process.cwd(), path), 'utf8');

test('admin renewal verifies the current confirmation format before revoking access', async () => {
  const source = await readSource(
    'src/admin/api/orders/[orderId]/access-token/route.ts'
  );
  const postStart = source.indexOf('export async function POST');
  const deleteStart = source.indexOf('export async function DELETE');
  const postSource = source.slice(postStart, deleteStart);
  const readinessIndex = postSource.indexOf(
    'const readiness = await readOrderConfirmationReadiness(client, orderId);'
  );
  const revokeIndex = postSource.indexOf(
    'const revokedCount = await revokeOrderAccessTokens(client, orderId);'
  );

  assert.ok(postStart >= 0 && deleteStart > postStart);
  assert.ok(readinessIndex >= 0, 'POST must check confirmation readiness');
  assert.ok(
    revokeIndex > readinessIndex,
    'the active token must not be revoked before readiness succeeds'
  );
  assert.match(source, /to_regclass\('public\.order_line_snapshots'\)/u);
  assert.match(source, /to_regclass\('public\.order_document_jobs'\)/u);
  assert.match(source, /column_name = 'customer_access_id'/u);
  assert.match(source, /from order_line_snapshots[\s\S]*?where order_id = \$1/u);
  assert.match(source, /ORDER_CONFIRMATION_SCHEMA_NOT_READY/u);
  assert.match(source, /ORDER_CONFIRMATION_DATA_NOT_READY/u);
  assert.match(
    postSource,
    /if \(!readiness\.ready\) \{[\s\S]*?rollback[\s\S]*?status: 409/u
  );
  assert.match(source, /Obstoječa povezava ni bila spremenjena\./u);
});

test('admin exposes the newly issued customer URL as both an open and copy action', async () => {
  const source = await readSource(
    'src/admin/features/orders/components/AdminOrderCustomerAccess.tsx'
  );

  assert.match(source, /href=\{issuedUrl\}/u);
  assert.match(source, /target="_blank"/u);
  assert.match(source, /rel="noreferrer noopener"/u);
  assert.match(source, />\s*Odpri novo povezavo\s*<\/a>/u);
  assert.match(source, /navigator\.clipboard\.writeText\(issuedUrl\)/u);
  assert.match(source, />\s*Kopiraj\s*<\/Button>/u);
});
