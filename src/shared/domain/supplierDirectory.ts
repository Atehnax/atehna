import type { SchoolDirectoryData, SchoolDirectoryMutation } from './schoolDirectory';

export const SUPPLIER_DIRECTORY_COLUMNS = [
  { id: 'artikel', label: 'Artikel', position: 0 },
  { id: 'dobavitelj', label: 'Dobavitelj', position: 1 },
  { id: 'naslov', label: 'Naslov', position: 2 },
  { id: 'kontakt', label: 'Kontakt', position: 3 },
  { id: 'e-naslov', label: 'E-naslov', position: 4 },
  { id: 'spletna-stran', label: 'Spletna stran', position: 5 },
  { id: 'opombe', label: 'Opombe', position: 6 }
];
export const SUPPLIER_DIRECTORY_MAX_ROWS = 5_000;
export const SUPPLIER_DIRECTORY_MAX_CELL_LENGTH = 4_000;
export type SupplierCatalogOption = { value: string; label: string; disabled?: boolean };
export type SupplierDirectoryData = SchoolDirectoryData & { articles: SupplierCatalogOption[] };
export type SupplierDirectoryMutation = Extract<SchoolDirectoryMutation, {
  operation: 'update-row' | 'add-row' | 'duplicate-rows' | 'delete-rows';
}>;

export class SupplierDirectoryValidationError extends Error {}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new SupplierDirectoryValidationError('Podatki dobavitelja niso veljavni.');
  }
  return value as Record<string, unknown>;
}
function id(value: unknown) {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}$/.test(value)) {
    throw new SupplierDirectoryValidationError('Vrstica ni veljavna.');
  }
  return value;
}
function cells(value: unknown, full = false) {
  const input = record(value);
  const entries = Object.entries(input);
  if (!entries.length || (full && entries.length !== SUPPLIER_DIRECTORY_COLUMNS.length)) {
    throw new SupplierDirectoryValidationError('Pričakovane vrednosti morajo vsebovati celotno vrstico.');
  }
  return Object.fromEntries(entries.map(([key, cell]) => {
    if (!SUPPLIER_DIRECTORY_COLUMNS.some(column => column.id === key)
      || typeof cell !== 'string' || cell.length > SUPPLIER_DIRECTORY_MAX_CELL_LENGTH) {
      throw new SupplierDirectoryValidationError('Vrednost celice ni veljavna.');
    }
    return [key, cell];
  }));
}
function validateNewValues(values: Record<string, string>) {
  if (values.artikel && !/^[1-9][0-9]{0,18}$/.test(values.artikel)) {
    throw new SupplierDirectoryValidationError('Izberite artikel iz kataloga.');
  }
  if (values['e-naslov']?.trim()) {
    const addresses = values['e-naslov'].split(/[;\r\n]+/).map(value => value.trim()).filter(Boolean);
    if (addresses.some(value => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))) {
      throw new SupplierDirectoryValidationError('Vnesite veljaven e-naslov. Več naslovov ločite s podpičjem.');
    }
  }
  if (values['spletna-stran']?.trim()) {
    for (const value of values['spletna-stran'].split(/[;\r\n]+/).map(value => value.trim()).filter(Boolean)) {
      try {
        if (/^[a-z][a-z0-9+.-]*:/i.test(value) && !/^https?:\/\//i.test(value)) throw new Error();
        const url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
        if (!['https:', 'http:'].includes(url.protocol) || !url.hostname || url.username || url.password) throw new Error();
      } catch { throw new SupplierDirectoryValidationError('Vnesite veljaven spletni naslov (http ali https).'); }
    }
  }
}
export function parseSupplierDirectoryMutation(value: unknown): SupplierDirectoryMutation {
  const input = record(value);
  if (input.operation === 'add-row') return { operation: 'add-row', rowId: id(input.rowId) };
  if (input.operation === 'update-row') {
    const next = cells(input.cells);
    const expected = cells(input.expectedCells);
    if (Object.keys(next).length !== Object.keys(expected).length
      || Object.keys(next).some(key => !Object.hasOwn(expected, key))) {
      throw new SupplierDirectoryValidationError('Podatki vrstice niso veljavni.');
    }
    validateNewValues(next);
    return { operation: 'update-row', rowId: id(input.rowId), cells: next, expectedCells: expected };
  }
  if (input.operation === 'duplicate-rows' || input.operation === 'delete-rows') {
    if (!Array.isArray(input.rows) || !input.rows.length || input.rows.length > SUPPLIER_DIRECTORY_MAX_ROWS) {
      throw new SupplierDirectoryValidationError('Izberite veljavne vrstice.');
    }
    const rows = input.rows.map(value => record(value));
    const sourceIds = rows.map(row => id(input.operation === 'duplicate-rows' ? row.sourceRowId : row.rowId));
    if (new Set(sourceIds).size !== sourceIds.length) throw new SupplierDirectoryValidationError('Vrstice se ne smejo ponavljati.');
    if (input.operation === 'delete-rows') return {
      operation: 'delete-rows',
      rows: rows.map((row, index) => ({ rowId: sourceIds[index], expectedCells: cells(row.expectedCells, true) }))
    };
    const newIds = rows.map(row => id(row.newRowId));
    if (new Set(newIds).size !== newIds.length || newIds.some(value => sourceIds.includes(value))) {
      throw new SupplierDirectoryValidationError('Nove vrstice morajo imeti enolične oznake.');
    }
    return {
      operation: 'duplicate-rows',
      rows: rows.map((row, index) => ({ sourceRowId: sourceIds[index], newRowId: newIds[index], expectedCells: cells(row.expectedCells, true) }))
    };
  }
  throw new SupplierDirectoryValidationError('Neznano dejanje.');
}