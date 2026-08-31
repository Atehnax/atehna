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

test('order customer card exposes compact delivery data and full directory metrics', () => {
  const card = source(
    'src/admin/features/orders/components/AdminOrderCustomerCard.tsx'
  );

  assert.match(card, /Naročnik in dostava/u);
  assert.match(card, /Odpri stranko/u);
  assert.match(card, /Kopiraj podatke/u);
  assert.match(card, /data-testid="admin-order-customer-card"/u);
  assert.match(card, /data-testid="admin-order-customer-name-row"/u);
  const nameRow = card.slice(
    card.indexOf('data-testid="admin-order-customer-name-row"'),
    card.indexOf('data-testid="admin-order-customer-contact-details"')
  );
  assert.match(nameRow, /data-testid="admin-order-customer-open"/u);
  assert.match(nameRow, /onClick=\{\(\) => setDrawerOpen\(true\)\}/u);
  assert.match(nameRow, /aria-label="Odpri stranko"/u);
  assert.match(nameRow, /title="Odpri stranko"/u);
  assert.match(nameRow, /data-testid="admin-order-customer-copy"/u);
  assert.match(nameRow, /onClick=\{\(\) => void copyCustomerData\(\)\}/u);
  assert.match(nameRow, /aria-label="Kopiraj podatke"/u);
  assert.match(nameRow, /title="Kopiraj podatke"/u);
  assert.equal(card.match(/className=\{customerHeaderActionButtonClassName\}/gu)?.length, 2);
  assert.equal(card.match(/className=\{customerHeaderActionIconClassName\}/gu)?.length, 2);
  assert.match(card, /const customerHeaderActionIconClassName = '!h-3\.5 !w-3\.5';/u);
  assert.match(nameRow, /<CopyIcon className=\{customerHeaderActionIconClassName\} \/>\s*<\/button>/u);
  assert.doesNotMatch(nameRow, /<OpenCustomerIcon[^>]*\/>\s*Odpri stranko/u);
  assert.doesNotMatch(nameRow, /<CopyIcon[^>]*\/>\s*Kopiraj podatke/u);
  assert.doesNotMatch(card, /border-t border-slate-100 pt-3/u);
  assert.match(card, /navigator\.clipboard\.writeText\(lines\.join\('\\n'\)\)/u);
  assert.match(card, /Podatki stranke so kopirani\./u);
  assert.match(card, /customerEndpoint\?: string/u);
  assert.match(
    card,
    /fetch\(customerEndpoint \?\? `\/api\/admin\/orders\/\$\{orderId\}\/customer`/u
  );
  assert.match(card, /\[customerEndpoint, drawerOpen, orderId\]/u);
  assert.match(card, /\/api\/admin\/orders\/\$\{orderId\}\/customer/u);
  assert.match(card, /role="dialog"/u);
  assert.match(card, /aria-modal="true"/u);
  assert.match(card, /event\.key === 'Escape'/u);
  assert.match(card, /Podatki iz Stranke › Vse/u);
  assert.match(
    card,
    /\[clean\(addressLine1\), clean\(addressLine2\)\]\.filter\(Boolean\)\.join\(', '\)[\s\S]*?locality,[\s\S]*?clean\(countryCode\)[\s\S]*?\.filter\(Boolean\)\.join\(', '\)/u
  );
  assert.match(card, /data-testid="admin-order-customer-contact-details"/u);
  assert.match(card, /className="mt-1 space-y-0\.5 text-\[11px\] leading-4 text-slate-600"/u);
  assert.match(card, /data-testid="admin-order-customer-email"/u);
  assert.match(card, /data-testid="admin-order-customer-address"/u);
  assert.match(card, /\{fullAddress\}/u);
  assert.doesNotMatch(card, /addressLines\.map/u);

  for (const label of [
    'Kontakti',
    'E-naslovi',
    'Število nakupov',
    'Skupna vrednost',
    'Prvi nakup',
    'Zadnji nakup',
    'Povprečna vrednost nakupa'
  ]) {
    assert.match(card, new RegExp(label, 'u'));
  }
});
