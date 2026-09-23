import assert from 'node:assert/strict';
import test from 'node:test';
import {
  cloneDefaultOrderDocumentTemplate,
  deleteOrderDocumentCanvasElement,
  removeOrderDocumentFieldRow,
  resolveOrderDocumentFieldRows,
  setOrderDocumentCompanyContacts,
  setOrderDocumentFieldRows
} from '../../src/shared/domain/order/orderDocumentTemplates';
import type { OrderDocumentPreviewLayout, OrderDocumentPreviewRegion } from '../../src/shared/domain/order/orderDocumentPreviewLayout';
import { reduceOrderDocumentCanvasSelection } from '../../src/admin/features/urejevalnik/lib/orderDocumentCanvasSelection';
import {
  buildOrderDocumentTemplateLayers,
  filterOrderDocumentTemplateLayers
} from '../../src/admin/features/urejevalnik/lib/orderDocumentTemplateLayers';

const region = (id: string, parentId: string, pageNumber = 1): OrderDocumentPreviewRegion => ({
  id, parentId, kind: 'child', pageNumber, xMm: 10, yMm: 20, widthMm: 40, heightMm: 5
});
const layout = (...regions: OrderDocumentPreviewRegion[]): OrderDocumentPreviewLayout => ({
  pages: [{ pageNumber: 1, widthMm: 210, heightMm: 297 }, { pageNumber: 2, widthMm: 210, heightMm: 297 }], regions
});

test('PDF layers select the exact nested title and live editable text before a preview arrives', () => {
  const template = cloneDefaultOrderDocumentTemplate('dobavnica');
  template.text.title = 'Dobavnica za preizkus';
  const items = buildOrderDocumentTemplateLayers({ template });
  const title = items.find((item) => item.key === 'child:title:field-row:title_text');
  assert.ok(title);
  assert.equal(title.parentKey, 'element:title');
  assert.equal(title.label, 'Naslov dokumenta');
  assert.equal(title.value, 'Dobavnica za preizkus');
  assert.deepEqual(title.selection, {
    key: 'child:title:field-row:title_text', kind: 'child',
    child: { id: 'title:field-row:title_text', parentId: 'title', kind: 'field_row', group: 'title', rowId: 'title_text' }
  });
  assert.deepEqual(title.pages, []);
  assert.ok(items.some((item) => item.key === 'child:items:text:deferredItemsTitle'));
  assert.ok(items.some((item) => item.key === 'child:items:text:currentItemsTitle'));
  assert.equal(items.filter((item) => item.value === template.text.title).length, 1);
  const parent = items.find((item) => item.key === 'element:title')!;
  const selection = reduceOrderDocumentCanvasSelection([parent.selection], { type: 'replace', entry: title.selection });
  assert.deepEqual(selection, [title.selection]);
});

test('PDF text search finds renamed headings without accents and retains the exact ancestor path', () => {
  const template = cloneDefaultOrderDocumentTemplate('dobavnica');
  template.text.title = 'Dobavnica po meri';
  const items = buildOrderDocumentTemplateLayers({ template });
  const titleKeys = filterOrderDocumentTemplateLayers(items, 'DOBAVNICA MERI').map((item) => item.key);
  assert.deepEqual(titleKeys, ['element:document_details', 'element:title', 'child:title:field-row:title_text']);
  const later = filterOrderDocumentTemplateLayers(items, 'postavke za poznejso dobavo');
  assert.deepEqual(later.map((item) => item.key), ['element:items', 'child:items:text:deferredItemsTitle']);
  assert.ok(filterOrderDocumentTemplateLayers(items, 'naslov dokumenta').some((item) => item.value === template.text.title));
  assert.deepEqual(filterOrderDocumentTemplateLayers(items, 'neobstoječa vsebina'), []);
});

test('PDF group search includes its nested contacts and uses the current contact value', () => {
  const template = setOrderDocumentCompanyContacts(cloneDefaultOrderDocumentTemplate('invoice'), [
    { id: 'support', label: 'Pomoč', value: 'novi-kontakt@example.test', visible: false, emphasis: false }
  ]);
  const items = buildOrderDocumentTemplateLayers({ template });
  const contact = items.find((item) => item.key === 'child:company:contact:support');
  assert.ok(contact);
  assert.equal(contact.parentKey, 'child:company:field-row:contacts');
  assert.equal(contact.visible, false);
  assert.equal(contact.selection.kind, 'child');
  if (contact.selection.kind === 'child') assert.equal(contact.selection.child.kind, 'company_contact');
  const search = filterOrderDocumentTemplateLayers(items, 'novi-kontakt');
  assert.deepEqual(search.map((item) => item.key), [
    'element:header', 'element:company', 'child:company:field-row:contacts', 'child:company:contact:support'
  ]);
  assert.ok(filterOrderDocumentTemplateLayers(items, 'kontakti podjetja').some((item) => item.key === contact.key));
});

test('PDF layers retain hidden fields but exclude removed rows and deleted owners even with stale preview regions', () => {
  let template = cloneDefaultOrderDocumentTemplate('dobavnica');
  template = setOrderDocumentFieldRows(template, 'title', resolveOrderDocumentFieldRows(template, 'title').map((row) => ({ ...row, visible: false })));
  template = removeOrderDocumentFieldRow(template, 'title', 'subtitle');
  template = deleteOrderDocumentCanvasElement(template, 'closing');
  const items = buildOrderDocumentTemplateLayers({ template, layout: layout(
    region('title:field-row:subtitle', 'title'),
    region('closing:field-row:closing_text', 'closing'),
    region('items:text:unsupported', 'items'),
    region('items:table-row:0', 'items')
  ) });
  assert.equal(items.find((item) => item.key === 'child:title:field-row:title_text')?.visible, false);
  assert.equal(items.some((item) => item.key === 'child:title:field-row:subtitle'), false);
  assert.equal(items.some((item) => item.key.includes('closing')), false);
  assert.equal(items.some((item) => item.key.includes('unsupported')), false);
  assert.equal(items.some((item) => item.key === 'child:items:table-row:0'), false);
  assert.equal(new Set(items.map((item) => item.key)).size, items.length);
  const keys = new Set(items.map((item) => item.key));
  assert.ok(items.every((item) => !item.parentKey || keys.has(item.parentKey)));
});

test('PDF layers deduplicate repeated regions, preserve all pages, and select supported table cells', () => {
  const template = cloneDefaultOrderDocumentTemplate('invoice');
  const items = buildOrderDocumentTemplateLayers({ template, layout: layout(
    region('items:table-header', 'items', 2), region('items:table-header', 'items', 1),
    region('items:table-row:3', 'items', 2), region('items:table-row:3', 'items', 2),
    region('items:table-cell:3:description', 'items', 2), region('items:table-cell:3:unsupported', 'items', 2)
  ) });
  assert.deepEqual(items.find((item) => item.key === 'child:items:table-header')?.pages, [1, 2]);
  assert.equal(items.filter((item) => item.key === 'child:items:table-row:3').length, 1);
  const cell = items.find((item) => item.key === 'child:items:table-cell:3:description');
  assert.ok(cell);
  assert.equal(cell.parentKey, 'child:items:table-row:3');
  assert.deepEqual(cell.selection, {
    key: 'child:items:table-cell:3:description', kind: 'child',
    child: { id: 'items:table-cell:3:description', parentId: 'items', kind: 'table_cell', rowNumber: 3, key: 'description' }
  });
  assert.deepEqual(cell.pages, [2]);
  assert.equal(items.some((item) => item.key.includes('unsupported')), false);
  assert.equal(items.some((item) => item.key === 'child:items:table-row:1'), false);
  assert.equal(items.some((item) => item.key === 'child:items:text:deferredItemsTitle'), false);
});
