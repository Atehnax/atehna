import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const source = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

for (const [kind, path, codeProp, label] of [
  ['order', 'orders/components/AdminOrderPdfManager.tsx', 'orderCode', 'Številka naročila:'],
  ['quote', 'quotes/components/AdminQuoteDocumentsManager.tsx', 'quoteCode', 'Številka povpraševanja:']
] as const) {
  test(`${kind} purchase-order upload shows its full parent code without changing attachment identity`, () => {
    const manager = source(`src/admin/features/${path}`);
    assert.ok(manager.includes(`${codeProp}?: string;`));
    assert.ok(manager.includes(`.key === 'purchase_order' && ${codeProp} ? (`));
    const association = manager.match(new RegExp(
      `<p\\s+id=\\{purchaseOrderAssociationId\\}[\\s\\S]*?data-testid="${kind}-purchase-order-association"[\\s\\S]*?<\\/p>`, 'u'
    ))?.[0];
    assert.ok(association, 'the association is visible before selecting a file and remains beside uploaded evidence');
    assert.ok(association.includes(label));
    assert.ok(association.includes(`{${codeProp}}</span>`), 'display the authoritative complete code');
    assert.doesNotMatch(association, /truncate|line-clamp|abbreviate|reference|documentNumber/u);
    assert.match(association, /break-words[\s\S]*?leading-4/u);
    assert.equal(
      manager.match(/aria-describedby=\{[^\n]*purchaseOrderAssociationId[^\n]*\}/gu)?.length,
      2,
      'the file input and upload action expose the same association description'
    );

    const upload = manager.slice(manager.indexOf('const handleUpload = async'));
    const uploadBody = upload.slice(0, upload.indexOf('const response = await fetch'));
    assert.match(uploadBody, /formData\.append\('file', file\)/u);
    assert.match(uploadBody, /formData\.append\('type', /u);
    assert.doesNotMatch(uploadBody, /reference|orderCode|quoteCode|documentNumber/u);
  });
}

test('the lazy order document manager forwards its optional public code without a separate lookup', () => {
  const wrapper = source('src/admin/features/orders/components/AdminOrderPdfManagerClient.tsx');
  assert.match(wrapper, /orderCode\?: string;/u);
  assert.match(wrapper, /<AdminOrderPdfManager \{\.\.\.props\} \/>/u);
  assert.doesNotMatch(wrapper, /fetch\(/u);
});
