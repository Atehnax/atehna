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

  assert.equal(source.match(/<AdminDetailDocumentOpenLink/gu)?.length, 2);
  assert.equal(source.match(/href=\{issuedUrl\}/gu)?.length, 2);
  assert.equal(source.match(/target="_blank"/gu)?.length, 2);
  assert.equal(source.match(/rel="noreferrer noopener"/gu)?.length, 2);
  assert.match(
    source,
    /<AdminDetailDocumentOpenLink[\s\S]*?>\s*Odpri novo povezavo\s*<\/AdminDetailDocumentOpenLink>/u
  );
  assert.match(source, /navigator\.clipboard\.writeText\(issuedUrl\)/u);
  assert.equal(
    source.match(/data-testid="admin-order-customer-access-copy"/gu)?.length,
    2
  );
  assert.equal(source.match(/aria-label="Kopiraj povezavo"/gu)?.length, 2);
  assert.equal(source.match(/title="Kopiraj povezavo"/gu)?.length, 2);
  assert.equal(
    source.match(/<CopyIcon className=\{adminCardSectionIconClassName\} \/>/gu)?.length,
    2
  );
  assert.equal(
    source.match(/className=\{adminCardSectionIconActionButtonClassName\}/gu)?.length,
    2
  );
  assert.doesNotMatch(source, />\s*Kopiraj\s*</u);
});

test('customer access actions reuse compact admin-detail controls and a rose revoke tone', async () => {
  const source = await readSource(
    'src/admin/features/orders/components/AdminOrderCustomerAccess.tsx'
  );

  assert.match(source, /from '@\/shared\/ui\/admin-detail'/u);
  assert.equal(source.match(/<AdminDetailDocumentPrimaryAction/gu)?.length, 4);
  assert.equal(
    source.match(/className="!text-rose-700 hover:!bg-rose-50 active:!bg-rose-100"/gu)?.length,
    2
  );
  assert.doesNotMatch(source, /from '@\/shared\/ui\/button'|buttonTokenClasses/u);
});

test('customer access refreshes its local commitment status from server props', async () => {
  const source = await readSource(
    'src/admin/features/orders/components/AdminOrderCustomerAccess.tsx'
  );

  assert.match(
    source,
    /useEffect\(\(\) => \{\s*setCommitmentStatus\(initialCommitmentStatus\);\s*\}, \[initialCommitmentStatus\]\);/u
  );
});
