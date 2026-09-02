import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const source = (path: string) =>
  readFileSync(resolve(process.cwd(), path), 'utf8');

test('order customer details reuse the canonical customer directory identity', () => {
  const directory = source('src/shared/server/customerDirectory.ts');
  const route = source('src/admin/api/orders/[orderId]/customer/route.ts');
  const appRoute = source('src/app/api/admin/orders/[orderId]/customer/route.ts');

  assert.match(directory, /fetchCustomerDirectoryRowForOrder/u);
  assert.match(
    directory,
    /select md5\(identified_orders\.customer_key\)[\s\S]*?where identified_orders\.id = \$1/u
  );
  assert.match(directory, /mapCustomerDirectoryRow\(row\)/u);
  assert.match(route, /fetchCustomerDirectoryRowForOrder\(orderId\)/u);
  assert.match(route, /Cache-Control': 'no-store'/u);
  assert.match(route, /Stranka za to naročilo ni bila najdena/u);
  assert.match(
    appRoute,
    /admin\/api\/orders\/\[orderId\]\/customer\/route/u
  );
});

test('order customer actions keep profile and copy controls without a redundant summary card', () => {
  const actions = source(
    'src/admin/features/orders/components/AdminOrderCustomerCard.tsx'
  );
  const adminTableStandards = source('src/shared/ui/admin-table/standards.ts');

  assert.match(actions, /export type AdminOrderCustomerActionsProps/u);
  assert.match(actions, /export default function AdminOrderCustomerActions/u);
  assert.match(actions, /data-testid="admin-order-customer-actions"/u);
  assert.doesNotMatch(
    actions,
    /Naročnik in dostava|admin-order-customer-card|admin-order-customer-name-row|admin-order-customer-contact-details|admin-order-customer-email|admin-order-customer-address/u
  );
  assert.doesNotMatch(actions, /customerType|getCustomerTypeLabel|adminWindowCardClassName/u);

  const actionGroup = actions.slice(
    actions.indexOf('data-testid="admin-order-customer-actions"'),
    actions.indexOf('{drawer}')
  );
  assert.match(actionGroup, /data-testid="admin-order-customer-open"/u);
  assert.match(actionGroup, /onClick=\{\(\) => setDrawerOpen\(true\)\}/u);
  assert.match(actionGroup, /aria-label="Odpri stranko"/u);
  assert.match(actionGroup, /title="Odpri stranko"/u);
  assert.match(actionGroup, /data-testid="admin-order-customer-copy"/u);
  assert.match(actionGroup, /onClick=\{\(\) => void copyCustomerData\(\)\}/u);
  assert.match(actionGroup, /aria-label="Kopiraj podatke"/u);
  assert.match(actionGroup, /title="Kopiraj podatke"/u);
  assert.match(actions, /from '@\/shared\/ui\/admin-table'/u);
  assert.equal(
    actions.match(/className=\{adminCardSectionIconActionButtonClassName\}/gu)?.length,
    2
  );
  assert.equal(
    actions.match(/className=\{adminCardSectionIconClassName\}/gu)?.length,
    2
  );
  assert.match(
    adminTableStandards,
    /export const adminCardSectionIconActionButtonClassName =\s*`\$\{adminCardSectionEditIconButtonClassName\} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-\[#3e67d6\]\/30`;/u
  );
  assert.match(
    adminTableStandards,
    /export const adminCardSectionIconClassName = '!h-3\.5 !w-3\.5';/u
  );
  assert.doesNotMatch(actions, /customerHeaderActionButtonClassName|customerHeaderActionIconClassName/u);
  assert.match(actionGroup, /<CopyIcon className=\{adminCardSectionIconClassName\} \/>\s*<\/button>/u);
  assert.doesNotMatch(actionGroup, /<OpenCustomerIcon[^>]*\/>\s*Odpri stranko/u);
  assert.doesNotMatch(actionGroup, /<CopyIcon[^>]*\/>\s*Kopiraj podatke/u);
  assert.match(actions, /navigator\.clipboard\.writeText\(lines\.join\('\\n'\)\)/u);
  assert.match(actions, /Podatki stranke so kopirani\./u);
  assert.match(actions, /customerEndpoint\?: string/u);
  assert.match(
    actions,
    /fetch\(customerEndpoint \?\? `\/api\/admin\/orders\/\$\{orderId\}\/customer`/u
  );
  assert.match(actions, /\[customerEndpoint, drawerOpen, orderId\]/u);
  assert.match(actions, /\/api\/admin\/orders\/\$\{orderId\}\/customer/u);
  assert.match(actions, /role="dialog"/u);
  assert.match(actions, /aria-modal="true"/u);
  assert.match(actions, /event\.key === 'Escape'/u);
  assert.match(actions, /Podatki iz Stranke › Vse/u);
  assert.match(
    actions,
    /\[clean\(addressLine1\), clean\(addressLine2\)\]\.filter\(Boolean\)\.join\(', '\)[\s\S]*?locality,[\s\S]*?clean\(countryCode\)[\s\S]*?\.filter\(Boolean\)\.join\(', '\)/u
  );
  assert.match(actions, /const lines = \[[\s\S]*?fullAddress[\s\S]*?\]\.filter\(Boolean\)/u);
  assert.doesNotMatch(actions, /addressLines\.map/u);

  for (const label of [
    'Kontakti',
    'E-naslovi',
    'Število nakupov',
    'Skupna vrednost',
    'Prvi nakup',
    'Zadnji nakup',
    'Povprečna vrednost nakupa'
  ]) {
    assert.match(actions, new RegExp(label, 'u'));
  }
});
