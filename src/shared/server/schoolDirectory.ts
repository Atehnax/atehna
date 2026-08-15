import 'server-only';

import { unstable_noStore as noStore } from 'next/cache';
import type { Pool, PoolClient } from 'pg';
import schoolSeed from '@/shared/data/schools-seed.json';
import {
  SCHOOL_DIRECTORY_MAX_CELL_LENGTH,
  SCHOOL_DIRECTORY_MAX_COLUMNS,
  SCHOOL_DIRECTORY_MAX_LABEL_LENGTH,
  SCHOOL_DIRECTORY_MAX_ROWS,
  type SchoolDirectoryColumn,
  type SchoolDirectoryData,
  type SchoolDirectoryMutation,
  type SchoolDirectoryRow
} from '@/shared/domain/schoolDirectory';
import { getPool, isDatabaseUnavailableError } from '@/shared/server/db';

const DIRECTORY_KEY = 'schools';
const ID_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}$/;
const DUPLICATE_NAME_SUFFIX = ' kopija';
const SCHOOL_NAME_LONG_FORM = 'Osnovna šola';
const SCHOOL_NAME_SHORT_FORM = 'OŠ';

const tableSql = `
  create table if not exists school_directory_meta (
    key text primary key,
    seed_version integer not null default 0,
    updated_at timestamptz not null default now()
  );

  create table if not exists school_directory_columns (
    id text primary key,
    label text not null,
    position integer not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
  );

  create table if not exists school_directory_rows (
    id text primary key,
    position integer not null,
    cells jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
  );

  create index if not exists school_directory_columns_position_idx
    on school_directory_columns (position, id);

  create unique index if not exists school_directory_columns_label_unique_idx
    on school_directory_columns (lower(btrim(label)));

  create index if not exists school_directory_rows_position_idx
    on school_directory_rows (position, id);
`;

type SeedShape = {
  version: number;
  columns: Array<{ id: string; label: string }>;
  rows: Array<{ id: string; cells: Record<string, string> }>;
};

type MutationResult = {
  updatedAt: string;
  row?: SchoolDirectoryRow;
  rows?: SchoolDirectoryRow[];
  deletedRowIds?: string[];
  column?: SchoolDirectoryColumn;
};

export class SchoolDirectoryValidationError extends Error {}
export class SchoolDirectoryConflictError extends Error {
  readonly row?: SchoolDirectoryRow;
  readonly rows: SchoolDirectoryRow[];
  readonly missingRowIds: string[];

  constructor(
    message: string,
    rows: SchoolDirectoryRow | SchoolDirectoryRow[],
    missingRowIds: string[] = []
  ) {
    super(message);
    this.name = 'SchoolDirectoryConflictError';
    this.rows = Array.isArray(rows) ? rows : [rows];
    this.row = this.rows[0];
    this.missingRowIds = missingRowIds;
  }
}

let schoolDirectoryReadyPromise: Promise<Pool> | null = null;

const toIso = (value: unknown) => {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string') {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return date.toISOString();
  }
  return new Date().toISOString();
};

const assertId = (value: unknown, label: string) => {
  if (typeof value !== 'string' || !ID_PATTERN.test(value)) {
    throw new SchoolDirectoryValidationError(`${label} ni veljaven.`);
  }
  return value;
};

const normalizeLabel = (value: unknown) => {
  if (typeof value !== 'string') {
    throw new SchoolDirectoryValidationError('Naziv stolpca ni veljaven.');
  }
  const label = value.trim();
  if (!label || label.length > SCHOOL_DIRECTORY_MAX_LABEL_LENGTH) {
    throw new SchoolDirectoryValidationError('Naziv stolpca mora vsebovati od 1 do 120 znakov.');
  }
  return label;
};

const normalizeCellValue = (value: unknown) => {
  if (typeof value !== 'string' || value.length > SCHOOL_DIRECTORY_MAX_CELL_LENGTH) {
    throw new SchoolDirectoryValidationError('Vrednost celice ni veljavna.');
  }
  return value;
};

const normalizeExpectedCells = (value: unknown) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new SchoolDirectoryValidationError('Pričakovane vrednosti vrstice niso veljavne.');
  }

  const entries = Object.entries(value);
  if (!entries.length || entries.length > SCHOOL_DIRECTORY_MAX_COLUMNS) {
    throw new SchoolDirectoryValidationError('Pričakovane vrednosti vrstice niso veljavne.');
  }

  return Object.fromEntries(entries.map(([columnId, cellValue]) => [
    assertId(columnId, 'Stolpec'),
    normalizeCellValue(cellValue)
  ]));
};

const assertFullExpectedCells = (
  expectedCells: Record<string, string>,
  columnIds: string[]
) => {
  const expectedColumnIds = Object.keys(expectedCells);
  if (
    expectedColumnIds.length !== columnIds.length
    || columnIds.some((columnId) => !Object.hasOwn(expectedCells, columnId))
  ) {
    throw new SchoolDirectoryValidationError('Pričakovane vrednosti morajo vsebovati celotno vrstico.');
  }
};

const cellsMatchSnapshot = (
  currentCells: Record<string, string>,
  expectedCells: Record<string, string>,
  columnIds: string[]
) => columnIds.every((columnId) => (currentCells[columnId] ?? '') === expectedCells[columnId]);

const assertUniqueIds = (ids: string[], label: string) => {
  if (new Set(ids).size !== ids.length) {
    throw new SchoolDirectoryValidationError(`${label} se ne smejo ponavljati.`);
  }
};

const normalizeStoredCells = (value: unknown): Record<string, string> =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? Object.fromEntries(Object.entries(value).map(([key, cellValue]) => [
      key,
      cellValue == null ? '' : String(cellValue)
    ]))
    : {};

const toSchoolDirectoryRow = (rowId: string, row: Record<string, unknown>): SchoolDirectoryRow => ({
  id: rowId,
  position: Number(row.position),
  cells: normalizeStoredCells(row.cells)
});

const normalizeSeedCells = (cells: Record<string, string>) => ({
  ...cells,
  naziv: (cells.naziv ?? '').replaceAll(SCHOOL_NAME_LONG_FORM, SCHOOL_NAME_SHORT_FORM)
});

const cloneSeedDirectory = (): SchoolDirectoryData => {
  const seed = schoolSeed as SeedShape;
  return {
    columns: seed.columns.map((column, position) => ({ ...column, position })),
    rows: seed.rows.map((row, position) => ({
      id: row.id,
      position,
      cells: normalizeSeedCells(row.cells)
    })),
    updatedAt: null,
    persistenceAvailable: false
  };
};

async function seedSchoolDirectory(client: PoolClient) {
  const seed = schoolSeed as SeedShape;
  if (seed.columns.length > SCHOOL_DIRECTORY_MAX_COLUMNS || seed.rows.length > SCHOOL_DIRECTORY_MAX_ROWS) {
    throw new Error('School directory seed exceeds the configured limits.');
  }

  await client.query("select pg_advisory_xact_lock(hashtext('school-directory-seed'))");
  const metaResult = await client.query(
    'select seed_version from school_directory_meta where key = $1 for update',
    [DIRECTORY_KEY]
  );
  const currentSeedVersion = Number(metaResult.rows[0]?.seed_version ?? 0);

  if (metaResult.rowCount) {
    if (currentSeedVersion < 2) {
      await client.query(
        `update school_directory_rows
         set
           cells = jsonb_set(
             cells,
             array['naziv']::text[],
             to_jsonb(replace(cells ->> 'naziv', $1, $2)::text),
             true
           ),
           updated_at = now()
         where strpos(coalesce(cells ->> 'naziv', ''), $1) > 0`,
        [SCHOOL_NAME_LONG_FORM, SCHOOL_NAME_SHORT_FORM]
      );
    }

    if (currentSeedVersion < seed.version) {
      await client.query(
        'update school_directory_meta set seed_version = $2, updated_at = now() where key = $1',
        [DIRECTORY_KEY, seed.version]
      );
    }
    return;
  }

  const columns = seed.columns.map((column, position) => ({ ...column, position }));
  const rows = seed.rows.map((row, position) => ({
    ...row,
    position,
    cells: normalizeSeedCells(row.cells)
  }));

  await client.query(
    `insert into school_directory_columns (id, label, position)
     select entry.id, entry.label, entry.position
     from jsonb_to_recordset($1::jsonb) as entry(id text, label text, position integer)
     on conflict (id) do nothing`,
    [JSON.stringify(columns)]
  );
  await client.query(
    `insert into school_directory_rows (id, position, cells)
     select entry.id, entry.position, entry.cells
     from jsonb_to_recordset($1::jsonb) as entry(id text, position integer, cells jsonb)
     on conflict (id) do nothing`,
    [JSON.stringify(rows)]
  );
  await client.query(
    `insert into school_directory_meta (key, seed_version, updated_at)
     values ($1, $2, now())
     on conflict (key) do nothing`,
    [DIRECTORY_KEY, seed.version]
  );
}

async function prepareSchoolDirectory(): Promise<Pool> {
  const pool = await getPool();
  await pool.query(tableSql);
  const client = await pool.connect();
  try {
    await client.query('begin');
    await seedSchoolDirectory(client);
    await client.query('commit');
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
  return pool;
}

async function ensureSchoolDirectory() {
  schoolDirectoryReadyPromise ??= prepareSchoolDirectory().catch((error) => {
    schoolDirectoryReadyPromise = null;
    throw error;
  });
  return schoolDirectoryReadyPromise;
}

async function readSchoolDirectoryFromDatabase(): Promise<SchoolDirectoryData> {
  const pool = await ensureSchoolDirectory();
  const [columnResult, rowResult, metaResult] = await Promise.all([
    pool.query('select id, label, position from school_directory_columns order by position asc, id asc'),
    pool.query('select id, position, cells from school_directory_rows order by position asc, id asc'),
    pool.query('select updated_at from school_directory_meta where key = $1 limit 1', [DIRECTORY_KEY])
  ]);

  return {
    columns: columnResult.rows.map((row) => ({
      id: String(row.id),
      label: String(row.label),
      position: Number(row.position)
    })),
    rows: rowResult.rows.map((row) => ({
      id: String(row.id),
      position: Number(row.position),
      cells: normalizeStoredCells(row.cells)
    })),
    updatedAt: metaResult.rows[0]?.updated_at ? toIso(metaResult.rows[0].updated_at) : null,
    persistenceAvailable: true
  };
}

export async function getSchoolDirectory(): Promise<SchoolDirectoryData> {
  noStore();
  try {
    return await readSchoolDirectoryFromDatabase();
  } catch (error) {
    if (!isDatabaseUnavailableError(error)) {
      console.error('Failed to load school directory', error);
    }
    return cloneSeedDirectory();
  }
}

async function assertUniqueColumnLabel(client: PoolClient, label: string, excludedColumnId?: string) {
  const result = await client.query(
    `select 1
     from school_directory_columns
     where lower(btrim(label)) = lower(btrim($1))
       and ($2::text is null or id <> $2)
     limit 1`,
    [label, excludedColumnId ?? null]
  );
  if (result.rowCount) {
    throw new SchoolDirectoryValidationError('Stolpec s tem nazivom že obstaja.');
  }
}

async function touchDirectory(client: PoolClient) {
  const result = await client.query(
    `update school_directory_meta set updated_at = now() where key = $1 returning updated_at`,
    [DIRECTORY_KEY]
  );
  return toIso(result.rows[0]?.updated_at);
}

async function lockDirectoryStructure(client: PoolClient) {
  await client.query("select pg_advisory_xact_lock(hashtext('school-directory-structure'))");
}

type NormalizedDuplicateRowInput = {
  sourceRowId: string;
  newRowId: string;
  expectedCells: Record<string, string>;
};

type NormalizedDeleteRowInput = {
  rowId: string;
  expectedCells: Record<string, string>;
};

function normalizeDuplicateRows(value: unknown): NormalizedDuplicateRowInput[] {
  if (!Array.isArray(value) || !value.length || value.length > SCHOOL_DIRECTORY_MAX_ROWS) {
    throw new SchoolDirectoryValidationError('Vrstice za podvajanje niso veljavne.');
  }

  const rows = value.map((rawRow) => {
    if (!rawRow || typeof rawRow !== 'object' || Array.isArray(rawRow)) {
      throw new SchoolDirectoryValidationError('Vrstice za podvajanje niso veljavne.');
    }
    const row = rawRow as Record<string, unknown>;
    return {
      sourceRowId: assertId(row.sourceRowId, 'Izvorna vrstica'),
      newRowId: assertId(row.newRowId, 'Nova vrstica'),
      expectedCells: normalizeExpectedCells(row.expectedCells)
    };
  });

  assertUniqueIds(rows.map((row) => row.sourceRowId), 'Izvorne vrstice');
  assertUniqueIds(rows.map((row) => row.newRowId), 'Nove vrstice');
  return rows;
}

function normalizeDeleteRows(value: unknown): NormalizedDeleteRowInput[] {
  if (!Array.isArray(value) || !value.length || value.length > SCHOOL_DIRECTORY_MAX_ROWS) {
    throw new SchoolDirectoryValidationError('Vrstice za brisanje niso veljavne.');
  }

  const rows = value.map((rawRow) => {
    if (!rawRow || typeof rawRow !== 'object' || Array.isArray(rawRow)) {
      throw new SchoolDirectoryValidationError('Vrstice za brisanje niso veljavne.');
    }
    const row = rawRow as Record<string, unknown>;
    return {
      rowId: assertId(row.rowId, 'Vrstica'),
      expectedCells: normalizeExpectedCells(row.expectedCells)
    };
  });

  assertUniqueIds(rows.map((row) => row.rowId), 'Vrstice');
  return rows;
}

async function lockDirectoryColumns(client: PoolClient) {
  const result = await client.query(
    'select id from school_directory_columns order by id asc for share'
  );
  return result.rows.map((row) => String(row.id));
}

async function lockDirectoryRows(
  client: PoolClient,
  rowIds: string[],
  lockMode: 'share' | 'update'
) {
  const result = await client.query(
    `select id, position, cells
     from school_directory_rows
     where id = any($1::text[])
     order by id asc
     for ${lockMode}`,
    [rowIds]
  );
  return result.rows.map((row) => toSchoolDirectoryRow(String(row.id), row));
}

function getSnapshotConflicts(
  requestedRows: Array<{ rowId: string; expectedCells: Record<string, string> }>,
  currentRows: SchoolDirectoryRow[],
  columnIds: string[]
) {
  const currentRowsById = new Map(currentRows.map((row) => [row.id, row]));
  const missingRowIds: string[] = [];
  const conflictingRows: SchoolDirectoryRow[] = [];

  requestedRows.forEach((requestedRow) => {
    const currentRow = currentRowsById.get(requestedRow.rowId);
    if (!currentRow) {
      missingRowIds.push(requestedRow.rowId);
    } else if (!cellsMatchSnapshot(currentRow.cells, requestedRow.expectedCells, columnIds)) {
      conflictingRows.push(currentRow);
    }
  });

  return { conflictingRows, missingRowIds };
}

async function applyMutation(client: PoolClient, mutation: SchoolDirectoryMutation): Promise<Omit<MutationResult, 'updatedAt'>> {
  if (mutation.operation === 'update-row') {
    const rowId = assertId(mutation.rowId, 'Vrstica');
    if (
      !mutation.cells
      || typeof mutation.cells !== 'object'
      || Array.isArray(mutation.cells)
      || !mutation.expectedCells
      || typeof mutation.expectedCells !== 'object'
      || Array.isArray(mutation.expectedCells)
    ) {
      throw new SchoolDirectoryValidationError('Podatki vrstice niso veljavni.');
    }

    const entries = Object.entries(mutation.cells);
    const expectedEntries = Object.entries(mutation.expectedCells);
    if (
      !entries.length
      || entries.length > SCHOOL_DIRECTORY_MAX_COLUMNS
      || expectedEntries.length !== entries.length
    ) {
      throw new SchoolDirectoryValidationError('Podatki vrstice niso veljavni.');
    }

    const cells = Object.fromEntries(entries.map(([columnId, value]) => [
      assertId(columnId, 'Stolpec'),
      normalizeCellValue(value)
    ]));
    const expectedCells = Object.fromEntries(expectedEntries.map(([columnId, value]) => [
      assertId(columnId, 'Stolpec'),
      normalizeCellValue(value)
    ]));
    const columnIds = Object.keys(cells);
    if (columnIds.some((columnId) => !Object.hasOwn(expectedCells, columnId))) {
      throw new SchoolDirectoryValidationError('Podatki vrstice niso veljavni.');
    }
    const columnResult = await client.query(
      'select id from school_directory_columns where id = any($1::text[]) for share',
      [columnIds]
    );
    if (columnResult.rowCount !== columnIds.length) {
      throw new SchoolDirectoryValidationError('Eden ali več stolpcev ne obstaja več.');
    }

    const rowResult = await client.query(
      'select position, cells from school_directory_rows where id = $1 for update',
      [rowId]
    );
    if (!rowResult.rowCount) {
      throw new SchoolDirectoryValidationError('Vrstica ne obstaja več.');
    }
    const currentRow = toSchoolDirectoryRow(rowId, rowResult.rows[0]);
    const currentCells = currentRow.cells;
    if (columnIds.some((columnId) => String(currentCells[columnId] ?? '') !== expectedCells[columnId])) {
      throw new SchoolDirectoryConflictError(
        'Vrstico je med urejanjem spremenil drug uporabnik.',
        currentRow
      );
    }

    const result = await client.query(
      `update school_directory_rows
       set cells = cells || $2::jsonb, updated_at = now()
       where id = $1
       returning position, cells`,
      [rowId, JSON.stringify(cells)]
    );
    if (!result.rowCount) {
      throw new SchoolDirectoryValidationError('Vrstica ne obstaja več.');
    }

    return { row: toSchoolDirectoryRow(rowId, result.rows[0]) };
  }

  if (mutation.operation === 'update-cell') {
    const rowId = assertId(mutation.rowId, 'Vrstica');
    const columnId = assertId(mutation.columnId, 'Stolpec');
    const value = normalizeCellValue(mutation.value);
    const expectedValue = normalizeCellValue(mutation.expectedValue);
    const columnResult = await client.query(
      'select id from school_directory_columns where id = $1 for share',
      [columnId]
    );
    if (!columnResult.rowCount) {
      throw new SchoolDirectoryValidationError('Stolpec ne obstaja več.');
    }
    const rowResult = await client.query(
      'select position, cells from school_directory_rows where id = $1 for update',
      [rowId]
    );
    if (!rowResult.rowCount) {
      throw new SchoolDirectoryValidationError('Vrstica ne obstaja več.');
    }
    const currentRow = toSchoolDirectoryRow(rowId, rowResult.rows[0]);
    if ((currentRow.cells[columnId] ?? '') !== expectedValue) {
      throw new SchoolDirectoryConflictError(
        'Celico je med urejanjem spremenil drug uporabnik.',
        currentRow
      );
    }
    await client.query(
      `update school_directory_rows
       set cells = jsonb_set(cells, array[$2]::text[], to_jsonb($3::text), true), updated_at = now()
       where id = $1`,
      [rowId, columnId, value]
    );
    return {};
  }

  if (mutation.operation === 'add-row') {
    const rowId = assertId(mutation.rowId, 'Vrstica');
    await lockDirectoryStructure(client);
    const countResult = await client.query('select count(*)::integer as count from school_directory_rows');
    if (Number(countResult.rows[0]?.count ?? 0) >= SCHOOL_DIRECTORY_MAX_ROWS) {
      throw new SchoolDirectoryValidationError('Doseženo je največje dovoljeno število vrstic.');
    }
    const positionResult = await client.query('select coalesce(min(position), 0) - 1 as position from school_directory_rows');
    const position = Number(positionResult.rows[0]?.position ?? -1);
    const columnResult = await client.query('select id from school_directory_columns order by position asc, id asc');
    const cells = Object.fromEntries(columnResult.rows.map((row) => [String(row.id), '']));
    await client.query(
      'insert into school_directory_rows (id, position, cells) values ($1, $2, $3::jsonb)',
      [rowId, position, JSON.stringify(cells)]
    );
    return { row: { id: rowId, position, cells } };
  }

  if (mutation.operation === 'delete-row') {
    const rowId = assertId(mutation.rowId, 'Vrstica');
    const result = await client.query('delete from school_directory_rows where id = $1', [rowId]);
    if (!result.rowCount) throw new SchoolDirectoryValidationError('Vrstica ne obstaja več.');
    return {};
  }

  if (mutation.operation === 'duplicate-rows') {
    const requestedRows = normalizeDuplicateRows(mutation.rows);
    await lockDirectoryStructure(client);

    const columnIds = await lockDirectoryColumns(client);
    requestedRows.forEach((row) => assertFullExpectedCells(row.expectedCells, columnIds));

    const countResult = await client.query('select count(*)::integer as count from school_directory_rows');
    const currentRowCount = Number(countResult.rows[0]?.count ?? 0);
    if (currentRowCount + requestedRows.length > SCHOOL_DIRECTORY_MAX_ROWS) {
      throw new SchoolDirectoryValidationError('Podvojitev bi presegla največje dovoljeno število vrstic.');
    }

    const newRowIds = requestedRows.map((row) => row.newRowId);
    const existingNewRowResult = await client.query(
      'select id from school_directory_rows where id = any($1::text[]) limit 1',
      [newRowIds]
    );
    if (existingNewRowResult.rowCount) {
      throw new SchoolDirectoryValidationError('Ena ali več novih vrstic že obstaja.');
    }

    const sourceRowIds = requestedRows.map((row) => row.sourceRowId);
    const currentSourceRows = await lockDirectoryRows(client, sourceRowIds, 'share');
    const { conflictingRows, missingRowIds } = getSnapshotConflicts(
      requestedRows.map((row) => ({ rowId: row.sourceRowId, expectedCells: row.expectedCells })),
      currentSourceRows,
      columnIds
    );
    if (conflictingRows.length || missingRowIds.length) {
      throw new SchoolDirectoryConflictError(
        'Ena ali več vrstic se je pred podvajanjem spremenilo.',
        conflictingRows,
        missingRowIds
      );
    }

    const currentRowsById = new Map(currentSourceRows.map((row) => [row.id, row]));
    const positionResult = await client.query(
      'select coalesce(min(position), 0)::integer as position from school_directory_rows'
    );
    const minimumPosition = Number(positionResult.rows[0]?.position ?? 0);
    const firstPosition = minimumPosition - requestedRows.length;
    const duplicateRows = requestedRows.map((requestedRow, index) => {
      const sourceRow = currentRowsById.get(requestedRow.sourceRowId);
      if (!sourceRow) {
        throw new SchoolDirectoryConflictError(
          'Izvorna vrstica ne obstaja več.',
          [],
          [requestedRow.sourceRowId]
        );
      }
      const cells = Object.fromEntries(columnIds.map((columnId) => [
        columnId,
        sourceRow.cells[columnId] ?? ''
      ]));
      if (columnIds.includes('naziv')) {
        cells.naziv = normalizeCellValue(`${cells.naziv ?? ''}${DUPLICATE_NAME_SUFFIX}`);
      }
      return {
        id: requestedRow.newRowId,
        position: firstPosition + index,
        cells
      };
    });

    const insertResult = await client.query(
      `insert into school_directory_rows (id, position, cells)
       select entry.id, entry.position, entry.cells
       from jsonb_to_recordset($1::jsonb) as entry(id text, position integer, cells jsonb)
       returning id, position, cells`,
      [JSON.stringify(duplicateRows)]
    );
    if (insertResult.rowCount !== duplicateRows.length) {
      throw new Error('Not all duplicate school directory rows were inserted.');
    }
    const insertedRowsById = new Map(insertResult.rows.map((row) => {
      const rowId = String(row.id);
      return [rowId, toSchoolDirectoryRow(rowId, row)];
    }));
    return {
      rows: duplicateRows.map((row) => {
        const insertedRow = insertedRowsById.get(row.id);
        if (!insertedRow) throw new Error('Inserted school directory row was not returned.');
        return insertedRow;
      })
    };
  }

  if (mutation.operation === 'delete-rows') {
    const requestedRows = normalizeDeleteRows(mutation.rows);
    await lockDirectoryStructure(client);

    const columnIds = await lockDirectoryColumns(client);
    requestedRows.forEach((row) => assertFullExpectedCells(row.expectedCells, columnIds));

    const rowIds = requestedRows.map((row) => row.rowId);
    const currentRows = await lockDirectoryRows(client, rowIds, 'update');
    const { conflictingRows, missingRowIds } = getSnapshotConflicts(
      requestedRows,
      currentRows,
      columnIds
    );
    if (conflictingRows.length || missingRowIds.length) {
      throw new SchoolDirectoryConflictError(
        'Ena ali več vrstic se je pred brisanjem spremenilo.',
        conflictingRows,
        missingRowIds
      );
    }

    const deleteResult = await client.query(
      'delete from school_directory_rows where id = any($1::text[]) returning id',
      [rowIds]
    );
    if (deleteResult.rowCount !== rowIds.length) {
      const deletedRowIds = new Set(deleteResult.rows.map((row) => String(row.id)));
      throw new SchoolDirectoryConflictError(
        'Ene ali več vrstic ni bilo mogoče izbrisati.',
        currentRows,
        rowIds.filter((rowId) => !deletedRowIds.has(rowId))
      );
    }
    return { deletedRowIds: rowIds };
  }

  if (mutation.operation === 'add-column') {
    const columnId = assertId(mutation.columnId, 'Stolpec');
    const label = normalizeLabel(mutation.label);
    await lockDirectoryStructure(client);
    const countResult = await client.query('select count(*)::integer as count from school_directory_columns');
    if (Number(countResult.rows[0]?.count ?? 0) >= SCHOOL_DIRECTORY_MAX_COLUMNS) {
      throw new SchoolDirectoryValidationError('Doseženo je največje dovoljeno število stolpcev.');
    }
    await assertUniqueColumnLabel(client, label);
    const positionResult = await client.query('select coalesce(max(position), -1) + 1 as position from school_directory_columns');
    const position = Number(positionResult.rows[0]?.position ?? 0);
    await client.query(
      'insert into school_directory_columns (id, label, position) values ($1, $2, $3)',
      [columnId, label, position]
    );
    await client.query(
      `update school_directory_rows
       set cells = cells || jsonb_build_object($1::text, ''::text), updated_at = now()`,
      [columnId]
    );
    return { column: { id: columnId, label, position } };
  }

  if (mutation.operation === 'rename-column') {
    const columnId = assertId(mutation.columnId, 'Stolpec');
    const label = normalizeLabel(mutation.label);
    await assertUniqueColumnLabel(client, label, columnId);
    const result = await client.query(
      `update school_directory_columns set label = $2, updated_at = now() where id = $1 returning position`,
      [columnId, label]
    );
    if (!result.rowCount) throw new SchoolDirectoryValidationError('Stolpec ne obstaja več.');
    return { column: { id: columnId, label, position: Number(result.rows[0].position) } };
  }

  if (mutation.operation === 'delete-column') {
    const columnId = assertId(mutation.columnId, 'Stolpec');
    await lockDirectoryStructure(client);
    const countResult = await client.query('select count(*)::integer as count from school_directory_columns');
    if (Number(countResult.rows[0]?.count ?? 0) <= 1) {
      throw new SchoolDirectoryValidationError('Zadnjega stolpca ni mogoče izbrisati.');
    }
    const result = await client.query('delete from school_directory_columns where id = $1', [columnId]);
    if (!result.rowCount) throw new SchoolDirectoryValidationError('Stolpec ne obstaja več.');
    await client.query(
      'update school_directory_rows set cells = cells - $1, updated_at = now()',
      [columnId]
    );
    return {};
  }

  throw new SchoolDirectoryValidationError('Neznano dejanje.');
}

export async function mutateSchoolDirectory(mutation: SchoolDirectoryMutation): Promise<MutationResult> {
  const pool = await ensureSchoolDirectory();
  const client = await pool.connect();
  try {
    await client.query('begin');
    const result = await applyMutation(client, mutation);
    const updatedAt = await touchDirectory(client);
    await client.query('commit');
    return { ...result, updatedAt };
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
}
