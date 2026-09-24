import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import { SCHOOL_DIRECTORY_MAX_CELL_LENGTH, SCHOOL_DIRECTORY_MAX_ROWS } from '../../src/shared/domain/schoolDirectory';

type Row = { id: string; cells: Record<string, string> };
type Directory = { id: string; label: string; sourceFile: string; columns: { id: string; label: string }[]; rows: Row[] };
type Source = {
  id: string; sourceFile: string; importedRows: number; sourceTableRows: number;
  sourceHeaderRows: number[]; regionHeaders: { sourceRow: number; region: string }[];
  sourceHeaders: string[]; extraSourceColumns: string[];
  rows: { rowId: string; sourceRow: number; values: Record<string, string> }[];
};
const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');
const seed = JSON.parse(read('src/shared/data/institutions-seed.json')) as { directories: Directory[] };
const primaryText = read('src/shared/data/schools-seed.json');
const primary = JSON.parse(primaryText) as Directory;
const auditPath = 'data/imports/schools-and-institutions-2026-09-24/';
const provenance = JSON.parse(read(`${auditPath}source-provenance.json`)) as {
  standardColumnsSourceSha256: string; sourceFiles: Source[];
};
const expectedCounts = [35, 67, 1188, 415, 190, 59, 94, 28, 15];
const mappings: Record<string, string> = {
  ZAVSIF: 'zavsif', PRSMSS: 'prsmss', 'STATISTIČNA REGIJA': 'statisticna-regija', OBČINA: 'obcina',
  NAZIV: 'naziv', 'NAZIV ŠOLE': 'naziv', 'NAZIV VRTCA': 'naziv', NASLOV: 'naslov',
  'POŠTNA ŠTEVILKA': 'postna-stevilka', POŠTA: 'posta', TEL: 'telefon', 'E-NASLOV': 'e-naslov',
  URL: 'spletna-stran', 'Spletna stran (URL)': 'spletna-stran', DŠ: 'ds', TRR: 'trr'
};

test('raw archive keeps all nine source directories and 2091 rows with the original 14-column schema', () => {
  assert.deepEqual(seed.directories.map(({ id }) => id), [
    'dijaski-domovi', 'glasbene-sole', 'vrtci-z-enotami', 'vrtci', 'srednje-sole',
    'visje-strokovne-sole', 'izobrazevanje-odraslih', 'osnovne-sole-posebne-potrebe', 'zavodi-posebne-potrebe'
  ]);
  // Historical raw labels are deliberately independent of the current shortened tabs.
  assert.equal(seed.directories[0].label, 'Javni in zasebni dijaški domovi');
  assert.deepEqual(seed.directories.map(directory => directory.rows.length), expectedCounts);
  const ids = new Set(primary.rows.map(row => row.id));
  for (const directory of seed.directories) {
    assert.deepEqual(directory.columns, primary.columns);
    assert.ok(directory.rows.length <= SCHOOL_DIRECTORY_MAX_ROWS);
    for (const row of directory.rows) {
      assert.match(row.id, /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}$/);
      assert.equal(ids.has(row.id), false, `Duplicate row ID ${row.id}`);
      ids.add(row.id);
      assert.deepEqual(Object.keys(row.cells), primary.columns.map(column => column.id));
      for (const cell of Object.values(row.cells)) {
        assert.equal(typeof cell, 'string');
        assert.ok(cell.length <= SCHOOL_DIRECTORY_MAX_CELL_LENGTH);
        assert.ok(!cell.includes('\ufffd'), 'No replacement characters from decoding');
      }
    }
  }
  assert.equal(ids.size - primary.rows.length, 2091);
});

test('every imported cell reconciles to its source row, including inherited regions and missing fields', () => {
  assert.equal(createHash('sha256').update(primaryText).digest('hex'), provenance.standardColumnsSourceSha256);
  for (const source of provenance.sourceFiles) {
    const directory = seed.directories.find(directory => directory.id === source.id)!;
    assert.equal(directory.sourceFile, source.sourceFile);
    assert.equal(source.rows.length, directory.rows.length);
    assert.equal(source.sourceTableRows, source.rows.length + source.regionHeaders.length + source.sourceHeaderRows.length);
    assert.equal(new Set(source.rows.map(row => row.sourceRow)).size, source.rows.length);
    for (const [index, sourceRow] of source.rows.entries()) {
      const imported = directory.rows[index];
      assert.equal(imported.id, sourceRow.rowId, 'Original source order is preserved');
      const expected = Object.fromEntries(primary.columns.map(column => [column.id, '']));
      for (const [header, value] of Object.entries(sourceRow.values)) {
        if (mappings[header]) expected[mappings[header]] = value;
      }
      const inheritedRegion = source.regionHeaders.filter(header => header.sourceRow < sourceRow.sourceRow).at(-1);
      if (inheritedRegion) expected['statisticna-regija'] = inheritedRegion.region;
      assert.deepEqual(imported.cells, expected);
      assert.deepEqual(Object.keys(sourceRow.values), source.sourceHeaders, 'Extras remain in source audit');
    }
  }
});

test('kindergarten units and Windows-1250 names are retained without parent-name substitution', () => {
  const units = seed.directories.find(directory => directory.id === 'vrtci-z-enotami')!;
  const row = units.rows.find(row => row.cells.zavsif === '14049')!;
  assert.equal(row.cells.naziv, 'OTROŠKI VRTEC AJDOVŠČINA, ENOTA OB HUBLJU');
  assert.equal(row.cells.prsmss, '5050855001');
  assert.ok(units.rows.some(row => row.cells.naslov === 'Mašera-Spasićeva ulica 8'));
  assert.ok(units.rows.some(row => row.cells.posta === 'Prosenjakovci - Pártosfalva'));
});

test('historical overlap audit preserves pre-consolidation matches and shared-entity evidence', () => {
  const overlaps = JSON.parse(read(`${auditPath}overlaps.json`));
  const pair = (left: string, right: string) => overlaps.directoryPairs.find(
    (pair: { leftDirectoryId: string; rightDirectoryId: string }) => pair.leftDirectoryId === left && pair.rightDirectoryId === right
  );
  assert.equal(pair('osnovne-sole', 'vrtci').sameZavsifRowPairs, 207);
  assert.equal(pair('vrtci', 'vrtci-z-enotami').sameZavsifRowPairs, 203);
  assert.equal(pair('vrtci', 'vrtci-z-enotami').sameNameOnlyRowPairs, 1);
  assert.equal(pair('dijaski-domovi', 'srednje-sole').sameZavsifRowPairs, 20);
  assert.equal(pair('osnovne-sole-posebne-potrebe', 'vrtci').sameZavsifRowPairs, 5);
  assert.equal(pair('osnovne-sole', 'vrtci-z-enotami').sameZavsifRowPairs, 0);
  assert.equal(pair('osnovne-sole', 'vrtci-z-enotami').sharedEntityOnlyRowPairs, 340);
  const knownIds = new Set([...primary.rows, ...seed.directories.flatMap(directory => directory.rows)].map(row => row.id));
  for (const groups of Object.values(overlaps.crossTabGroups) as { rows: { rowId: string; directoryId: string }[] }[][]) {
    for (const group of groups) {
      assert.ok(new Set(group.rows.map(row => row.directoryId)).size > 1);
      for (const row of group.rows) assert.ok(knownIds.has(row.rowId), 'Every historical overlap member remains available in the raw archive');
    }
  }
});
