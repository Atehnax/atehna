export const SCHOOL_DIRECTORY_MAX_COLUMNS = 100;
export const SCHOOL_DIRECTORY_MAX_ROWS = 5_000;
export const SCHOOL_DIRECTORY_MAX_CELL_LENGTH = 4_000;
export const SCHOOL_DIRECTORY_MAX_LABEL_LENGTH = 120;

export type SchoolDirectoryColumn = {
  id: string;
  label: string;
  position: number;
};

export type SchoolDirectoryRow = {
  id: string;
  position: number;
  cells: Record<string, string>;
};

export type SchoolDirectoryData = {
  columns: SchoolDirectoryColumn[];
  rows: SchoolDirectoryRow[];
  updatedAt: string | null;
  persistenceAvailable: boolean;
};

export type SchoolDirectoryDuplicateRowInput = {
  sourceRowId: string;
  newRowId: string;
  expectedCells: Record<string, string>;
};

export type SchoolDirectoryDeleteRowInput = {
  rowId: string;
  expectedCells: Record<string, string>;
};

export type SchoolDirectoryMutation =
  | {
    operation: 'update-cell';
    rowId: string;
    columnId: string;
    value: string;
    expectedValue: string;
  }
  | {
    operation: 'update-row';
    rowId: string;
    cells: Record<string, string>;
    expectedCells: Record<string, string>;
  }
  | { operation: 'add-row'; rowId: string }
  | { operation: 'delete-row'; rowId: string }
  | { operation: 'duplicate-rows'; rows: SchoolDirectoryDuplicateRowInput[] }
  | { operation: 'delete-rows'; rows: SchoolDirectoryDeleteRowInput[] }
  | { operation: 'add-column'; columnId: string; label: string }
  | { operation: 'rename-column'; columnId: string; label: string }
  | { operation: 'delete-column'; columnId: string };
