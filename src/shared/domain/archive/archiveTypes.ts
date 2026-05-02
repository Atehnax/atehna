export type ArchiveItemType = 'order' | 'pdf';

export type ArchiveEntry = {
  id: number;
  item_type: ArchiveItemType;
  order_id: number | null;
  document_id: number | null;
  label: string;
  order_created_at: string | null;
  customer_name: string | null;
  address: string | null;
  customer_type: string | null;
  deleted_at: string;
  expires_at: string;
};

export type ArchiveEntryTuple = readonly [
  id: number,
  itemType: ArchiveItemType,
  orderId: number | null,
  documentId: number | null,
  label: string,
  orderCreatedAt: string | null,
  customerName: string | null,
  address: string | null,
  customerType: string | null,
  deletedAt: string,
  expiresAt: string
];

export type RestoreTarget = {
  item_type: ArchiveItemType;
  order_id: number | null;
  document_id: number | null;
};

export type ArchiveEntriesResponse = {
  entries: ArchiveEntry[];
};

export type ArchiveDeleteResponse = {
  success: true;
  deletedCount: number;
};

export type ArchiveRestoreResponse = {
  success: true;
  restoredCount: number;
};
