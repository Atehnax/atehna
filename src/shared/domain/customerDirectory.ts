export const CUSTOMER_DIRECTORY_MAX_BATCH_SIZE = 5_000;
export const CUSTOMER_DIRECTORY_MAX_TEXT_LENGTH = 4_000;
export const CUSTOMER_DIRECTORY_MAX_ARRAY_LENGTH = 5_000;

export type CustomerDirectoryEditableFields = {
  name: string;
  address: string;
  postalCode: string;
  city: string;
  contacts: string[];
  emails: string[];
};

export type CustomerDirectoryRow = CustomerDirectoryEditableFields & {
  id: string;
  origin: 'orders' | 'manual';
  revision: string | null;
  purchaseCount: number;
  firstPurchaseAt: string;
  lastPurchaseAt: string;
  averagePurchaseValue: number;
  totalPurchaseValue: number;
};

export type CustomerDirectoryData = {
  rows: CustomerDirectoryRow[];
  warningMessage: string | null;
  persistenceAvailable: boolean;
};

export type CustomerDirectoryDuplicateRowInput = {
  sourceRowId: string;
  newRowId: string;
  expectedFields: CustomerDirectoryEditableFields;
};

export type CustomerDirectoryDeleteRowInput = {
  rowId: string;
  expectedFields: CustomerDirectoryEditableFields;
};

export type CustomerDirectoryMutation =
  | {
    operation: 'update-row';
    rowId: string;
    fields: CustomerDirectoryEditableFields;
    expectedFields: CustomerDirectoryEditableFields;
  }
  | {
    operation: 'add-row';
    rowId: string;
    fields: CustomerDirectoryEditableFields;
  }
  | {
    operation: 'duplicate-rows';
    rows: CustomerDirectoryDuplicateRowInput[];
  }
  | {
    operation: 'delete-rows';
    rows: CustomerDirectoryDeleteRowInput[];
  };
