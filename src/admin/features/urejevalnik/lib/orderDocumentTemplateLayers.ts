import {
  ORDER_DOCUMENT_CANVAS_ELEMENT_IDS,
  ORDER_DOCUMENT_FIELD_GROUP_IDS,
  isOrderDocumentCanvasElementDeleted,
  resolveOrderDocumentCanvas,
  resolveOrderDocumentCompanyContacts,
  resolveOrderDocumentFieldRows,
  resolveOrderDocumentTable,
  type OrderDocumentCanvasElementId,
  type OrderDocumentFieldGroupId,
  type OrderDocumentFieldRowId,
  type OrderDocumentTableColumnId,
  type OrderDocumentTemplate,
  type OrderDocumentTemplateLabels,
  type OrderDocumentTemplateText
} from '@/shared/domain/order/orderDocumentTemplates';
import type { OrderDocumentPreviewLayout } from '@/shared/domain/order/orderDocumentPreviewLayout';
import {
  orderDocumentChildSelection,
  orderDocumentElementSelection,
  type OrderDocumentCanvasChildSelection,
  type OrderDocumentCanvasSelectionEntry,
  type OrderDocumentCompanyTextKey
} from './orderDocumentCanvasSelection';

export type OrderDocumentTemplateLayer = {
  key: string;
  parentKey: string | null;
  label: string;
  value: string;
  selection: OrderDocumentCanvasSelectionEntry;
  pages: readonly number[];
  visible: boolean;
  locked: boolean;
};

const ELEMENT_LABELS: Record<OrderDocumentCanvasElementId, string> = {
  header: 'Območje glave', logo: 'Logotip', company: 'Podatki podjetja',
  document_details: 'Območje dokumenta', title: 'Naslov in številka',
  customer: 'Naročnik', document_meta: 'Podatki naročila', intro: 'Uvod',
  items: 'Artikli', totals: 'Zneski', notes: 'Opombe', closing: 'Zaključek',
  signatures: 'Podpisi', footer: 'Noga'
};
const ELEMENT_PARENTS: Partial<Record<OrderDocumentCanvasElementId, OrderDocumentCanvasElementId>> = {
  logo: 'header', company: 'header', title: 'document_details',
  customer: 'document_details', document_meta: 'document_details'
};
const ROW_LABELS: Record<OrderDocumentFieldRowId, string> = {
  title_text: 'Naslov dokumenta', document_number: 'Številka dokumenta',
  public_code: 'Koda naročila', issue_date: 'Datum dokumenta', subtitle: 'Podnaslov',
  company_name: 'Ime podjetja', address_line_1: 'Naslov podjetja', address_line_2: 'Kraj in pošta',
  contacts: 'Kontakti podjetja', customer: 'Stranka', contact: 'Kontakt', address: 'Naslov',
  email: 'E-pošta', order_date: 'Datum naročila', customer_type: 'Vrsta naročnika', status: 'Status',
  reference: 'Referenca naročnika', dispatch_date: 'Datum odpreme', dispatch_method: 'Način odpreme',
  purchase_order_number: 'Številka naročilnice', purchase_order_date: 'Datum naročilnice',
  delivery_note: 'Dobavnica', due_date: 'Rok plačila', payment_reference: 'Sklicna številka',
  subtotal: 'Skupaj brez DDV', shipping: 'Stroški dostave', tax: 'Davek', total: 'Končni znesek',
  notes_label: 'Naslov opomb', notes_content: 'Vsebina opomb', payment_terms: 'Plačilni pogoji',
  closing_text: 'Zaključno besedilo', signer_name: 'Ime podpisnika', handed_over_by: 'Predal',
  received_by: 'Prevzel', registration_text: 'Registracijski podatki', footer_text: 'Besedilo noge',
  page_numbers: 'Številke strani'
};
const LABEL_BY_ROW: Partial<Record<OrderDocumentFieldRowId, keyof OrderDocumentTemplateLabels>> = {
  customer: 'customer', contact: 'contact', address: 'address', email: 'email', public_code: 'publicCode',
  issue_date: 'issueDate', order_date: 'orderDate', customer_type: 'customerType', status: 'status',
  reference: 'reference', dispatch_date: 'dispatchDate', dispatch_method: 'dispatchMethod',
  purchase_order_number: 'purchaseOrderNumber', purchase_order_date: 'purchaseOrderDate',
  delivery_note: 'deliveryNote', due_date: 'dueDate', payment_reference: 'paymentReference',
  subtotal: 'subtotal', shipping: 'shipping', tax: 'tax', total: 'total', notes_label: 'notes',
  handed_over_by: 'handedOverBy', received_by: 'receivedBy'
};
const TEXT_BY_ROW: Partial<Record<OrderDocumentFieldRowId, keyof Omit<OrderDocumentTemplateText, 'labels'>>> = {
  title_text: 'title', subtitle: 'subtitle', payment_terms: 'paymentTerms',
  closing_text: 'closing', signer_name: 'signerName', footer_text: 'footerText'
};
const COMPANY_BY_ROW: Partial<Record<OrderDocumentFieldRowId, OrderDocumentCompanyTextKey>> = {
  company_name: 'name', address_line_1: 'addressLine1', address_line_2: 'addressLine2',
  registration_text: 'registrationText'
};
const COLUMN_LABEL_KEYS: Record<OrderDocumentTableColumnId, keyof OrderDocumentTemplateLabels> = {
  sku: 'code', quantity: 'quantity', unit: 'unit', description: 'description',
  unitPrice: 'unitPrice', lineTotal: 'lineTotal'
};
const COLUMN_LABELS: Record<OrderDocumentTableColumnId, string> = {
  sku: 'SKU', quantity: 'Količina', unit: 'Enota', description: 'Naziv',
  unitPrice: 'Cena/enoto', lineTotal: 'Skupna cena'
};
const rowKey = (group: OrderDocumentFieldGroupId, id: OrderDocumentFieldRowId) =>
  `child:${group}:field-row:${id}`;

function fieldRowValue(template: OrderDocumentTemplate, group: OrderDocumentFieldGroupId, id: OrderDocumentFieldRowId) {
  const label = id === 'document_number' && group === 'document_meta' ? 'documentNumber' : LABEL_BY_ROW[id];
  if (label) return template.text.labels[label];
  const text = TEXT_BY_ROW[id];
  if (text) return template.text[text];
  const company = COMPANY_BY_ROW[id];
  return company ? template.company[company] : '';
}

/** Build from supported template controls; preview geometry adds pages and real table rows only. */
export function buildOrderDocumentTemplateLayers({ template, layout }: {
  template: OrderDocumentTemplate;
  layout?: OrderDocumentPreviewLayout | null;
}): OrderDocumentTemplateLayer[] {
  const canvas = resolveOrderDocumentCanvas(template);
  const layers = new Map<string, OrderDocumentTemplateLayer>();
  const pagesById = new Map<string, Set<number>>();
  for (const region of layout?.regions ?? []) {
    const pages = pagesById.get(region.id) ?? new Set<number>();
    pages.add(region.pageNumber);
    pagesById.set(region.id, pages);
  }
  const add = (selection: OrderDocumentCanvasSelectionEntry, label: string, value = '', parentKey: string | null = null, ownVisible = true) => {
    const ownerId = selection.kind === 'element' ? selection.elementId : selection.child.parentId;
    if (isOrderDocumentCanvasElementDeleted(template, ownerId)) return;
    const element = canvas.elements[ownerId];
    const id = selection.kind === 'element' ? selection.elementId : selection.child.id;
    const pageIds = pagesById.get(id);
    const parent = parentKey ? layers.get(parentKey) : undefined;
    layers.set(selection.key, {
      key: selection.key, parentKey, label, value, selection,
      pages: pageIds ? [...pageIds].sort((left, right) => left - right) : [],
      visible: ownVisible && element.visible && (parent?.visible ?? true),
      locked: element.locked
    });
  };
  const addChild = (child: OrderDocumentCanvasChildSelection, label: string, value = '', parentKey = `element:${child.parentId}`, visible = true) =>
    add(orderDocumentChildSelection(child), label, value, parentKey, visible);
  const addText = (parentId: OrderDocumentCanvasElementId, key: keyof Omit<OrderDocumentTemplateText, 'labels'>, label: string, parentKey?: string) =>
    addChild({ id: `${parentId}:text:${key}`, parentId, kind: 'text', key }, label, template.text[key], parentKey);

  for (const id of ORDER_DOCUMENT_CANVAS_ELEMENT_IDS) {
    const parent = ELEMENT_PARENTS[id];
    add(orderDocumentElementSelection(id), ELEMENT_LABELS[id], '', parent ? `element:${parent}` : null);
  }
  for (const group of ORDER_DOCUMENT_FIELD_GROUP_IDS) {
    if (isOrderDocumentCanvasElementDeleted(template, group)) continue;
    for (const row of resolveOrderDocumentFieldRows(template, group)) {
      addChild({ id: `${group}:field-row:${row.id}`, parentId: group, kind: 'field_row', group, rowId: row.id },
        ROW_LABELS[row.id], fieldRowValue(template, group, row.id), `element:${group}`, row.visible);
      if (group === 'company' && row.id === 'contacts') {
        for (const contact of resolveOrderDocumentCompanyContacts(template)) {
          addChild({ id: `company:contact:${contact.id}`, parentId: 'company', kind: 'company_contact', contactId: contact.id },
            contact.label || 'Kontakt podjetja', contact.value, rowKey(group, row.id), contact.visible);
        }
      }
      if (group === 'document_meta' && row.id === 'dispatch_method') {
        addText('document_meta', 'deliveryMethod', 'Besedilo načina odpreme', rowKey(group, row.id));
      }
    }
  }
  addText('intro', 'intro', 'Uvodno besedilo');
  if (template.type === 'dobavnica') {
    addText('items', 'currentItemsTitle', 'Naslov trenutne dobave');
    addText('items', 'deferredItemsTitle', 'Naslov kasnejše dobave');
  }
  if (!isOrderDocumentCanvasElementDeleted(template, 'items')) {
    addChild({ id: 'items:table-header', parentId: 'items', kind: 'table_header' }, 'Glava tabele');
    addChild({ id: 'items:table-body', parentId: 'items', kind: 'table_body' }, 'Vrstice izdelkov');
    const columns = resolveOrderDocumentTable(template).columns;
    for (const column of columns) {
      const value = template.text.labels[COLUMN_LABEL_KEYS[column.id]];
      addChild({ id: `items:table-header-cell:${column.id}`, parentId: 'items', kind: 'table_header_cell', key: column.id },
        `Naslov stolpca: ${COLUMN_LABELS[column.id]}`, value, 'child:items:table-header', column.visible);
      addChild({ id: `items:table-column:${column.id}`, parentId: 'items', kind: 'table_column', key: column.id },
        `Stolpec: ${COLUMN_LABELS[column.id]}`, value, 'child:items:table-body', column.visible);
    }
    // A row number is meaningful only when the PDF has actually rendered it.
    const rowNumbers = new Set<number>();
    for (const region of layout?.regions ?? []) {
      if (region.kind !== 'child' || region.parentId !== 'items') continue;
      const match = /^items:table-row:([1-9]\d*)$/u.exec(region.id);
      if (match && Number.isSafeInteger(Number(match[1]))) rowNumbers.add(Number(match[1]));
    }
    for (const rowNumber of [...rowNumbers].sort((left, right) => left - right)) {
      const id = `items:table-row:${rowNumber}`;
      addChild({ id, parentId: 'items', kind: 'table_row', rowNumber }, `Vrstica izdelkov ${rowNumber}`, '', 'child:items:table-body');
      for (const column of columns) {
        const cellId = `items:table-cell:${rowNumber}:${column.id}`;
        if (!pagesById.has(cellId)) continue;
        addChild({ id: cellId, parentId: 'items', kind: 'table_cell', rowNumber, key: column.id },
          `Celica ${rowNumber}: ${COLUMN_LABELS[column.id]}`, '', `child:${id}`, column.visible);
      }
    }
  }
  // Deleted group containers must not orphan otherwise supported descendants.
  return [...layers.values()].map((layer) => ({
    ...layer, parentKey: layer.parentKey && layers.has(layer.parentKey) ? layer.parentKey : null
  }));
}

const searchableText = (value: string) => value.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase('sl').trim();

/** Preserve ancestors and include a matching group's descendants so hierarchy stays understandable. */
export function filterOrderDocumentTemplateLayers(items: readonly OrderDocumentTemplateLayer[], query: string) {
  const terms = searchableText(query).split(/\s+/u).filter(Boolean);
  if (terms.length === 0) return [...items];
  const byKey = new Map(items.map((item) => [item.key, item]));
  const matched = new Set(items.filter((item) => {
    const text = searchableText(`${item.label} ${item.value}`);
    return terms.every((term) => text.includes(term));
  }).map((item) => item.key));
  const included = new Set(matched);
  for (const item of items) {
    let ancestorKey = item.parentKey;
    const visited = new Set<string>();
    while (ancestorKey && !visited.has(ancestorKey)) {
      visited.add(ancestorKey);
      if (matched.has(ancestorKey)) included.add(item.key);
      ancestorKey = byKey.get(ancestorKey)?.parentKey ?? null;
    }
  }
  for (const key of [...included]) {
    let ancestorKey = byKey.get(key)?.parentKey;
    while (ancestorKey && !included.has(ancestorKey)) {
      included.add(ancestorKey);
      ancestorKey = byKey.get(ancestorKey)?.parentKey;
    }
  }
  return items.filter((item) => included.has(item.key));
}

