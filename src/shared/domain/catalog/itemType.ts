const CATALOG_ITEM_TYPE_OPTIONS = [
  { value: 'unit', label: 'Kosovni artikel' },
  { value: 'sheet', label: 'Ploščni artikel' },
  { value: 'linear', label: 'Dolžinski artikel' },
  { value: 'bulk', label: 'Sipki artikel' }
] as const;

export type CatalogItemType = (typeof CATALOG_ITEM_TYPE_OPTIONS)[number]['value'];
