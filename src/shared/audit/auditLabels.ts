import type { AuditAction, AuditEntityType } from './auditTypes';

export const AUDIT_FIELD_LABELS: Record<string, string> = {
  title: 'Naziv',
  itemName: 'Naziv',
  name: 'Naziv',
  slug: 'URL',
  sku: 'SKU',
  variantSku: 'SKU',
  status: 'Status',
  price: 'Cena',
  priceGross: 'Cena z DDV',
  priceNet: 'Cena brez DDV',
  unitPrice: 'Cena',
  subtotal: 'Vmesni znesek',
  tax: 'DDV',
  total: 'Skupaj',
  shipping: 'Postnina',
  inventory: 'Zaloga',
  stock: 'Zaloga',
  category: 'Kategorija',
  categorySlug: 'Kategorija',
  categoryPath: 'Kategorija',
  description: 'Opis',
  summary: 'Povzetek',
  paymentStatus: 'Plačilo',
  payment_status: 'Plačilo',
  orderStatus: 'Status naročila',
  deliveryStatus: 'Dostava',
  variants: 'Različice',
  quantityDiscounts: 'Količinski popusti',
  media: 'Mediji',
  technicalSheet: 'Tehnični list',
  productType: 'Tip artikla',
  itemType: 'Tip v katalogu',
  badge: 'Oznaka',
  unit: 'Enota',
  brand: 'Znamka',
  material: 'Material',
  colour: 'Barva',
  shape: 'Oblika',
  adminNotes: 'Opombe administratorja',
  position: 'Vrstni red',
  variantName: 'Naziv različice',
  length: 'Dolžina',
  width: 'Širina',
  thickness: 'Debelina/fi',
  weight: 'Teža',
  errorTolerance: 'Toleranca',
  discountPct: 'Popust',
  minOrder: 'Minimalno naročilo',
  minQuantity: 'Minimalna količina',
  discountPercent: 'Popust',
  appliesTo: 'Velja za',
  filename: 'Datoteka',
  mediaKind: 'Tip medija',
  role: 'Vloga',
  sourceKind: 'Vir',
  altText: 'Alt besedilo',
  parentId: 'Nadrejena kategorija',
  parent_id: 'Nadrejena kategorija',
  order_number: 'Številka naročila',
  customer_type: 'Tip naročnika',
  organization_name: 'Naročnik',
  contact_name: 'Kontakt',
  email: 'Email',
  delivery_address: 'Naslov dostave',
  postal_code: 'Poštna številka',
  reference: 'Referenca',
  notes: 'Opombe stranke',
  admin_order_notes: 'Opombe administratorja',
  created_at: 'Datum naročila',
  items: 'Postavke'
};

export const AUDIT_ENTITY_LABELS: Record<AuditEntityType, string> = {
  item: 'Artikel',
  order: 'Naročilo',
  category: 'Kategorija',
  media: 'Medij',
  system: 'Sistem'
};

export const AUDIT_ENTITY_PLURAL_LABELS: Record<AuditEntityType, string> = {
  item: 'Artikli',
  order: 'Naročila',
  category: 'Kategorije',
  media: 'Mediji',
  system: 'Sistem'
};

export const AUDIT_ACTION_LABELS: Record<AuditAction, string> = {
  created: 'Dodano',
  updated: 'Spremenjeno',
  deleted: 'Odstranjeno',
  archived: 'Arhivirano',
  restored: 'Obnovljeno',
  uploaded: 'Dodano',
  removed: 'Odstranjeno',
  status_changed: 'Spremenjeno',
  reordered: 'Spremenjeno',
  price_changed: 'Spremenjeno',
  stock_changed: 'Spremenjeno'
};

export function getAuditFieldLabel(fieldKey: string) {
  return AUDIT_FIELD_LABELS[fieldKey] ?? fieldKey;
}
