import {
  applyInstitutionDirectoryMutation, assertInstitutionDirectoryId, InstitutionDirectoryConflictError,
  InstitutionDirectoryValidationError, type InstitutionDirectoryContent, type InstitutionDirectoryId,
  type InstitutionDirectoryMutationResult
} from './institutionDirectory';
import { SCHOOL_DIRECTORY_MAX_CELL_LENGTH, SCHOOL_DIRECTORY_MAX_ROWS, type SchoolDirectoryData, type SchoolDirectoryRow } from './schoolDirectory';

export type InstitutionDirectoryViewSource = { directoryId: InstitutionDirectoryId; data: SchoolDirectoryData };
const invalid = (message: string): never => { throw new InstitutionDirectoryValidationError(message); };
const record = (input: unknown): Record<string, unknown> => input && typeof input === 'object' && !Array.isArray(input)
  ? input as Record<string, unknown> : invalid('Podatki niso veljavni.');
const rowId = (input: unknown) => typeof input === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}$/.test(input)
  ? input : invalid('Oznaka vrstice ni veljavna.');

export function qualifyInstitutionRowId(directoryId: InstitutionDirectoryId, id: string): string {
  return `${assertInstitutionDirectoryId(directoryId)}::${rowId(id)}`;
}
export function parseInstitutionRowId(input: unknown): { directoryId: InstitutionDirectoryId; rowId: string } {
  if (typeof input !== 'string' || input.split('::').length !== 2) invalid('Izvor vrstice ni veljaven.');
  const [directoryId, id] = (input as string).split('::');
  return { directoryId: assertInstitutionDirectoryId(directoryId), rowId: rowId(id) };
}

export function combineInstitutionDirectoryView(sources: InstitutionDirectoryViewSource[]): SchoolDirectoryData {
  const columns = [...new Map(sources.flatMap(source => source.data.columns).map(column => [column.id, column])).values()]
    .map((column, position) => ({ ...column, position }));
  const rows = sources.flatMap(source => [...source.data.rows].sort((a, b) => a.position - b.position || a.id.localeCompare(b.id)).map(row => ({
    ...row, id: qualifyInstitutionRowId(source.directoryId, row.id),
    cells: Object.fromEntries(columns.map(column => [column.id, row.cells[column.id] ?? '']))
  }))).map((row, position) => ({ ...row, position }));
  const timestamps = sources.map(source => source.data.updatedAt).filter((value): value is string => Boolean(value)).sort();
  return { columns, rows, updatedAt: timestamps.at(-1) ?? null, persistenceAvailable: sources.length > 0 && sources.every(source => source.data.persistenceAvailable) };
}

/** Split an aggregate operation by immutable source identity; no caller-supplied source can escape its view. */
export function planInstitutionDirectoryViewMutation(allowedIds: readonly InstitutionDirectoryId[], input: unknown) {
  const mutation = record(input);
  const scoped = (value: unknown) => {
    const parsed = parseInstitutionRowId(value);
    if (!allowedIds.includes(parsed.directoryId)) invalid('Vrstica ne pripada izbranemu seznamu.');
    return parsed;
  };
  const plans = new Map<InstitutionDirectoryId, Record<string, unknown>>();
  if (mutation.operation === 'add-row' || mutation.operation === 'update-row' || mutation.operation === 'update-cell' || mutation.operation === 'delete-row') {
    const target = scoped(mutation.rowId);
    if (mutation.targetDirectoryId !== undefined && mutation.targetDirectoryId !== target.directoryId) invalid('Izbrani seznam se ne ujema z izvorom vrstice.');
    plans.set(target.directoryId, { ...mutation, rowId: target.rowId });
  } else if (mutation.operation === 'duplicate-rows' || mutation.operation === 'delete-rows') {
    if (!Array.isArray(mutation.rows) || !mutation.rows.length || mutation.rows.length > SCHOOL_DIRECTORY_MAX_ROWS) invalid('Vrstice niso veljavne.');
    const seen = new Set<string>();
    const newIds = new Set<string>();
    for (const raw of mutation.rows as unknown[]) {
      const item = record(raw);
      const source = scoped(mutation.operation === 'duplicate-rows' ? item.sourceRowId : item.rowId);
      const qualified = qualifyInstitutionRowId(source.directoryId, source.rowId);
      if (seen.has(qualified)) invalid('Oznake se ne smejo ponavljati.');
      seen.add(qualified);
      let value: Record<string, unknown>;
      if (mutation.operation === 'duplicate-rows') {
        const destination = scoped(item.newRowId);
        if (destination.directoryId !== source.directoryId) invalid('Podvojena vrstica mora ostati v izvornem seznamu.');
        const newQualified = qualifyInstitutionRowId(destination.directoryId, destination.rowId);
        if (newIds.has(newQualified)) invalid('Nove oznake se ne smejo ponavljati.');
        newIds.add(newQualified);
        value = { ...item, sourceRowId: source.rowId, newRowId: destination.rowId };
      } else value = { ...item, rowId: source.rowId };
      const existing = plans.get(source.directoryId);
      if (existing) (existing.rows as unknown[]).push(value);
      else plans.set(source.directoryId, { operation: mutation.operation, rows: [value] });
    }
  } else invalid('Stolpce urejajte v posameznem seznamu.');
  return [...plans].map(([directoryId, mutation]) => ({ directoryId, mutation }));
}

/** Validate and apply the whole batch to private copies before any database write. */
export function applyInstitutionDirectoryViewMutation(sources: InstitutionDirectoryViewSource[], allowedIds: readonly InstitutionDirectoryId[], input: unknown) {
  const plans = planInstitutionDirectoryViewMutation(allowedIds, input);
  const union = combineInstitutionDirectoryView(sources);
  const unionColumns = new Set(union.columns.map(column => column.id));
  const changes: Array<{ directoryId: InstitutionDirectoryId; content: InstitutionDirectoryContent; result: InstitutionDirectoryMutationResult }> = [];
  const currentRows = new Map(union.rows.map(row => [row.id, row]));
  for (const plan of plans) {
    const source = sources.find(source => source.directoryId === plan.directoryId);
    if (!source) invalid('Izvorni seznam ni na voljo.');
    const ownColumns = new Set(source!.data.columns.map(column => column.id));
    const filterCells = (value: unknown) => Object.fromEntries(Object.entries(record(value)).filter(([key, cell]) => {
      if (!unionColumns.has(key) || typeof cell !== 'string' || cell.length > SCHOOL_DIRECTORY_MAX_CELL_LENGTH) invalid('Celica ni veljavna.');
      if (!ownColumns.has(key)) {
        if (cell !== '') invalid('Stolpec ne pripada izvornemu seznamu; vrednost ni bila shranjena.');
        return false;
      }
      return true;
    }));
    const mutation = { ...plan.mutation };
    for (const key of ['cells', 'expectedCells']) if (Object.hasOwn(mutation, key)) mutation[key] = filterCells(mutation[key]);
    if (Array.isArray(mutation.rows)) mutation.rows = mutation.rows.map(raw => {
      const item = record(raw);
      return { ...item, expectedCells: filterCells(item.expectedCells) };
    });
    try {
      const applied = applyInstitutionDirectoryMutation(source!.data, mutation);
      changes.push({ directoryId: plan.directoryId, ...applied });
    } catch (error) {
      if (!(error instanceof InstitutionDirectoryConflictError)) throw error;
      const qualify = (id: string) => qualifyInstitutionRowId(plan.directoryId, id);
      throw new InstitutionDirectoryConflictError(error.message,
        error.rows.map(row => currentRows.get(qualify(row.id)) ?? { ...row, id: qualify(row.id) }),
        error.missingRowIds.map(qualify));
    }
  }
  const after = combineInstitutionDirectoryView(sources.map(source => {
    const change = changes.find(change => change.directoryId === source.directoryId);
    return change ? { ...source, data: { ...source.data, ...change.content } } : source;
  }));
  const afterRows = new Map(after.rows.map(row => [row.id, row]));
  const result: InstitutionDirectoryMutationResult = {};
  for (const change of changes) {
    const qualify = (id: string) => qualifyInstitutionRowId(change.directoryId, id);
    const qualifiedRow = (row: SchoolDirectoryRow) => afterRows.get(qualify(row.id))!;
    if (change.result.row) result.row = qualifiedRow(change.result.row);
    if (change.result.rows) result.rows = [...(result.rows ?? []), ...change.result.rows.map(qualifiedRow)];
    if (change.result.deletedRowIds) result.deletedRowIds = [...(result.deletedRowIds ?? []), ...change.result.deletedRowIds.map(qualify)];
  }
  return { changes, result };
}
