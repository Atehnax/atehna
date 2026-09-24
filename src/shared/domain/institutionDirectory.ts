import type { SchoolDirectoryData, SchoolDirectoryRow, SchoolDirectoryColumn } from './schoolDirectory';
import {
  SCHOOL_DIRECTORY_MAX_CELL_LENGTH, SCHOOL_DIRECTORY_MAX_COLUMNS,
  SCHOOL_DIRECTORY_MAX_LABEL_LENGTH, SCHOOL_DIRECTORY_MAX_ROWS
} from './schoolDirectory';

export const INSTITUTION_DIRECTORIES = [
  { id: 'osnovne-sole', label: 'Osnovne šole' },
  { id: 'dijaski-domovi', label: 'Dijaški domovi' },
  { id: 'glasbene-sole', label: 'Glasbene šole' },
  { id: 'vrtci', label: 'Vrtci' },
  { id: 'srednje-sole', label: 'Srednje šole' },
  { id: 'visje-strokovne-sole', label: 'Višje strokovne šole' },
  { id: 'izobrazevanje-odraslih', label: 'Organizacije za izobraževanje odraslih' },
  { id: 'osnovne-sole-posebne-potrebe', label: 'Osnovne šole za otroke s posebnimi potrebami' },
  { id: 'zavodi-posebne-potrebe', label: 'Zavodi za otroke in mladostnike s posebnimi potrebami' }
] as const;
export type InstitutionDirectoryId = typeof INSTITUTION_DIRECTORIES[number]['id'];
export const isInstitutionDirectoryId = (value: unknown): value is InstitutionDirectoryId =>
  typeof value === 'string' && INSTITUTION_DIRECTORIES.some(directory => directory.id === value);

// Keep previously saved tab links working after the two kindergarten lists were merged.
export function resolveInstitutionDirectoryId(value: unknown): InstitutionDirectoryId | undefined {
  if (value === 'vrtci-z-enotami') return 'vrtci';
  return isInstitutionDirectoryId(value) ? value : undefined;
}

// Presentation views can group directories without changing their stored identity.
export const INSTITUTION_DIRECTORY_VIEWS = [
  { id: 'vsi-seznami', label: 'Vsi seznami', directoryIds: INSTITUTION_DIRECTORIES.map(directory => directory.id), fullTitles: [] },
  { id: 'osnovne-sole', label: 'Osnovne šole', directoryIds: ['osnovne-sole'], fullTitles: [] },
  { id: 'dijaski-domovi', label: 'Dijaški domovi', directoryIds: ['dijaski-domovi'], fullTitles: [] },
  { id: 'glasbene-sole', label: 'Glasbene šole', directoryIds: ['glasbene-sole'], fullTitles: [] },
  { id: 'vrtci', label: 'Vrtci', directoryIds: ['vrtci'], fullTitles: [] },
  { id: 'srednje-sole', label: 'Srednje šole', directoryIds: ['srednje-sole'], fullTitles: [] },
  { id: 'visje-strokovne-sole', label: 'Višje strokovne šole', directoryIds: ['visje-strokovne-sole'], fullTitles: [] },
  { id: 'izobrazevanje-odraslih', label: 'Izobraževanje odraslih', directoryIds: ['izobrazevanje-odraslih'], fullTitles: ['Organizacije za izobraževanje odraslih'] },
  {
    id: 'posebne-potrebe', label: 'Posebne potrebe',
    directoryIds: ['osnovne-sole-posebne-potrebe', 'zavodi-posebne-potrebe'],
    fullTitles: ['Osnovne šole za otroke s posebnimi potrebami', 'Zavodi za otroke in mladostnike s posebnimi potrebami']
  }
] as const satisfies readonly {
  id: string;
  label: string;
  directoryIds: readonly InstitutionDirectoryId[];
  fullTitles: readonly string[];
}[];
export type InstitutionDirectoryViewId = typeof INSTITUTION_DIRECTORY_VIEWS[number]['id'];
export const isInstitutionDirectoryViewId = (value: unknown): value is InstitutionDirectoryViewId =>
  typeof value === 'string' && INSTITUTION_DIRECTORY_VIEWS.some(view => view.id === value);

export function resolveInstitutionDirectoryViewId(value: unknown): InstitutionDirectoryViewId | undefined {
  if (value === 'osnovne-sole-posebne-potrebe' || value === 'zavodi-posebne-potrebe') return 'posebne-potrebe';
  if (value === 'vrtci-z-enotami') return 'vrtci';
  return isInstitutionDirectoryViewId(value) ? value : undefined;
}

export class InstitutionDirectoryValidationError extends Error {}
export class InstitutionDirectoryConflictError extends Error {
  readonly row?: SchoolDirectoryRow;
  constructor(message: string, readonly rows: SchoolDirectoryRow[], readonly missingRowIds: string[] = []) {
    super(message);
    this.row = rows[0];
  }
}
export type InstitutionDirectoryContent = Pick<SchoolDirectoryData, 'columns' | 'rows'>;
export type InstitutionDirectoryMutationResult = {
  row?: SchoolDirectoryRow;
  rows?: SchoolDirectoryRow[];
  deletedRowIds?: string[];
  column?: SchoolDirectoryColumn;
};
const invalid = (message: string): never => { throw new InstitutionDirectoryValidationError(message); };
export function assertInstitutionDirectoryId(value: unknown): InstitutionDirectoryId {
  return isInstitutionDirectoryId(value) ? value : invalid('Neveljaven seznam šol in zavodov.');
}
const record = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : invalid('Podatki niso veljavni.');
const id = (value: unknown) => typeof value === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}$/.test(value)
  ? value : invalid('Oznaka vrstice ali stolpca ni veljavna.');
const value = (input: unknown) => typeof input === 'string' && input.length <= SCHOOL_DIRECTORY_MAX_CELL_LENGTH
  ? input : invalid('Vrednost celice ni veljavna.');
const label = (input: unknown) => typeof input === 'string' && input.trim().length > 0 && input.trim().length <= SCHOOL_DIRECTORY_MAX_LABEL_LENGTH
  ? input.trim() : invalid('Naziv stolpca mora vsebovati od 1 do 120 znakov.');
const unique = (ids: string[]) => { if (new Set(ids).size !== ids.length) invalid('Oznake se ne smejo ponavljati.'); };

// Apply to a private copy. A failed edit or batch never changes the supplied directory.
export function applyInstitutionDirectoryMutation(
  current: InstitutionDirectoryContent,
  input: unknown
): { content: InstitutionDirectoryContent; result: InstitutionDirectoryMutationResult } {
  const mutation = record(input);
  const columns = current.columns.map(column => ({ ...column }));
  let rows = current.rows.map(row => ({ ...row, cells: { ...row.cells } }));
  const columnIds = columns.map(column => column.id);
  const cells = (input: unknown, full = false) => {
    const entries = Object.entries(record(input));
    if (!entries.length || entries.length > SCHOOL_DIRECTORY_MAX_COLUMNS) invalid('Podatki vrstice niso veljavni.');
    const result = Object.fromEntries(entries.map(([key, cell]) => {
      if (!columnIds.includes(id(key))) invalid('Stolpec ne obstaja več.');
      return [key, value(cell)];
    }));
    if (full && (entries.length !== columnIds.length || columnIds.some(key => !Object.hasOwn(result, key)))) {
      invalid('Pričakovane vrednosti morajo vsebovati celotno vrstico.');
    }
    return result;
  };
  const row = (rowId: string) => {
    const found = rows.find(row => row.id === rowId);
    if (!found) throw new InstitutionDirectoryConflictError('Vrstica ne obstaja več.', [], [rowId]);
    return found;
  };
  const checkSnapshots = (snapshots: Array<{ rowId: string; expectedCells: Record<string, string> }>) => {
    const missing: string[] = [];
    const changed: SchoolDirectoryRow[] = [];
    for (const snapshot of snapshots) {
      const found = rows.find(row => row.id === snapshot.rowId);
      if (!found) missing.push(snapshot.rowId);
      else if (Object.entries(snapshot.expectedCells).some(([key, cell]) => (found.cells[key] ?? '') !== cell)) changed.push(found);
    }
    if (missing.length || changed.length) throw new InstitutionDirectoryConflictError('Podatki so se med urejanjem spremenili. Osvežite vrstico.', changed, missing);
  };
  const ensureNewIds = (ids: string[]) => {
    unique(ids);
    if (rows.length + ids.length > SCHOOL_DIRECTORY_MAX_ROWS) invalid('Doseženo je največje dovoljeno število vrstic.');
    if (ids.some(id => rows.some(row => row.id === id))) invalid('Vrstica s to oznako že obstaja.');
  };
  const firstPosition = (amount: number) => rows.reduce((min, row) => Math.min(min, row.position), 0) - amount;
  let result: InstitutionDirectoryMutationResult = {};
  switch (mutation.operation) {
    case 'update-cell': {
      const rowId = id(mutation.rowId);
      const columnId = id(mutation.columnId);
      const updatedCells = cells({ [columnId]: mutation.value });
      const expectedCells = cells({ [columnId]: mutation.expectedValue });
      checkSnapshots([{ rowId, expectedCells }]);
      const target = row(rowId);
      target.cells = { ...target.cells, ...updatedCells };
      result = { row: target };
      break;
    }
    case 'update-row': {
      const rowId = id(mutation.rowId);
      const updatedCells = cells(mutation.cells);
      const expectedCells = cells(mutation.expectedCells);
      if (Object.keys(updatedCells).length !== Object.keys(expectedCells).length || Object.keys(updatedCells).some(key => !Object.hasOwn(expectedCells, key))) invalid('Pričakovane in nove celice se ne ujemajo.');
      checkSnapshots([{ rowId, expectedCells }]);
      const target = row(rowId);
      target.cells = { ...target.cells, ...updatedCells };
      result = { row: target };
      break;
    }
    case 'add-row': {
      const rowId = id(mutation.rowId);
      ensureNewIds([rowId]);
      const newRow = { id: rowId, position: firstPosition(1), cells: Object.fromEntries(columnIds.map(key => [key, ''])) };
      rows.unshift(newRow);
      result = { row: newRow };
      break;
    }
    case 'delete-row':
    case 'delete-rows':
    case 'duplicate-rows': {
      const requested = mutation.operation === 'delete-row' ? [{ rowId: mutation.rowId, expectedCells: mutation.expectedCells }] : mutation.rows;
      if (!Array.isArray(requested) || !requested.length || requested.length > SCHOOL_DIRECTORY_MAX_ROWS) invalid('Vrstice niso veljavne.');
      const inputs = (requested as unknown[]).map(item => {
        const raw = record(item);
        return { rowId: id(mutation.operation === 'duplicate-rows' ? raw.sourceRowId : raw.rowId), expectedCells: cells(raw.expectedCells, true), ...(mutation.operation === 'duplicate-rows' ? { newRowId: id(raw.newRowId) } : {}) };
      });
      unique(inputs.map(item => item.rowId));
      checkSnapshots(inputs);
      if (mutation.operation === 'duplicate-rows') {
        const newIds = inputs.map(item => item.newRowId!);
        ensureNewIds(newIds);
        const position = firstPosition(inputs.length);
        const added = inputs.map((item, index) => {
          const copied = { ...row(item.rowId).cells };
          if (columnIds.includes('naziv')) copied.naziv = value(`${copied.naziv ?? ''} kopija`);
          return { id: item.newRowId!, position: position + index, cells: copied };
        });
        rows = [...added, ...rows];
        result = { rows: added };
      } else {
        const deletedRowIds = inputs.map(item => item.rowId);
        rows = rows.filter(row => !deletedRowIds.includes(row.id));
        result = { deletedRowIds };
      }
      break;
    }
    case 'add-column':
    case 'rename-column': {
      const columnId = id(mutation.columnId);
      const columnLabel = label(mutation.label);
      if (columns.some(column => column.id !== columnId && column.label.trim().toLocaleLowerCase('sl') === columnLabel.toLocaleLowerCase('sl'))) invalid('Stolpec s tem nazivom že obstaja.');
      if (mutation.operation === 'add-column') {
        if (columnIds.includes(columnId)) invalid('Stolpec s to oznako že obstaja.');
        if (columns.length >= SCHOOL_DIRECTORY_MAX_COLUMNS) invalid('Doseženo je največje dovoljeno število stolpcev.');
        const column = { id: columnId, label: columnLabel, position: columns.reduce((max, column) => Math.max(max, column.position), -1) + 1 };
        columns.push(column);
        rows.forEach(row => { row.cells = { ...row.cells, [columnId]: '' }; });
        result = { column };
      } else {
        const column = columns.find(column => column.id === columnId);
        if (!column) invalid('Stolpec ne obstaja več.');
        column!.label = columnLabel;
        result = { column: column! };
      }
      break;
    }
    case 'delete-column': {
      const columnId = id(mutation.columnId);
      const index = columns.findIndex(column => column.id === columnId);
      if (index < 0) invalid('Stolpec ne obstaja več.');
      if (columns.length <= 1) invalid('Zadnjega stolpca ni mogoče izbrisati.');
      columns.splice(index, 1);
      rows.forEach(row => { delete row.cells[columnId]; });
      break;
    }
    default: invalid('Neznano dejanje.');
  }
  return { content: { columns, rows }, result };
}
