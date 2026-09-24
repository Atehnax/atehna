import assert from 'node:assert/strict';
import test from 'node:test';
import { consolidateInstitutionDirectories as merge, extractInstitutionEmails, type ConsolidationDirectory, type ConsolidationRow } from '@/shared/domain/institutionEmailConsolidation';

const columns = ['naziv', 'e-naslov', 'naslov', 'telefon', 'kontaktne-osebe', 'zavsif'].map((id, position) => ({ id, label: id, position }));
const row = (id: string, email = '', extra: Record<string, string> = {}, position?: number): ConsolidationRow => ({
  id, ...(position === undefined ? {} : { position }), cells: Object.fromEntries(columns.map(column => [column.id, ({ naziv: id, 'e-naslov': email, ...extra } as Record<string, string>)[column.id] ?? '']))
});
const directory = (id: string, rows: ConsolidationRow[]): ConsolidationDirectory => ({ id, label: id, columns, rows });
const findRows = (result: ReturnType<typeof merge>, id: string) => result.directories.find(directory => directory.id === id)!.rows;

test('extracts exact, case-insensitive individual mailboxes without dot or plus alias merging', () => {
  assert.deepEqual(extractInstitutionEmails('mailto:Office@School.SI; second@school.si, <third@school.si> OFFICE@SCHOOL.SI\nfourth@school.si'), ['office@school.si', 'second@school.si', 'third@school.si', 'fourth@school.si']);
  assert.deepEqual(extractInstitutionEmails('a.b@gmail.com a+b@gmail.com ab@gmail.com'), ['a.b@gmail.com', 'a+b@gmail.com', 'ab@gmail.com']);
  assert.deepEqual(extractInstitutionEmails('not-an-email x@localhost @school.si x@-school.si x..y@school.si x@@school.si'), []);
});

test('partial multi-address overlap creates one transitive group and retains every email', () => {
  const result = merge([
    directory('osnovne-sole', [row('primary', 'a@school.si')]),
    directory('vrtci', [row('nursery', 'A@SCHOOL.SI; b@school.si')]),
    directory('dijaski-domovi', [row('dorm', 'b@school.si,c@school.si')])
  ]);
  assert.deepEqual(findRows(result, 'osnovne-sole').map(row => row.id), ['primary']);
  assert.equal(findRows(result, 'osnovne-sole')[0].cells['e-naslov'], 'a@school.si; b@school.si; c@school.si');
  assert.equal(findRows(result, 'vrtci').length + findRows(result, 'dijaski-domovi').length, 0);
  assert.equal(result.mappings.length, 3);
  assert.ok(result.mappings.every(mapping => mapping.canonicalRowId === 'primary'));
  assert.equal(result.audit[0].sources.length, 3);
  assert.deepEqual({ input: result.summary.inputRows, output: result.summary.outputRows, groups: result.summary.mergedGroups, removed: result.summary.removedRows, moved: result.summary.movedRows }, { input: 3, output: 1, groups: 1, removed: 2, moved: 2 });
});

test('missing and invalid mailboxes never consolidate despite identical identifying fields', () => {
  const result = merge([directory('vrtci', [row('one', '', { naziv: 'Same', zavsif: '12' }), row('two', '', { naziv: 'Same', zavsif: '12' }), row('three', 'invalid'), row('four', 'invalid')])]);
  assert.equal(result.summary.outputRows, 4);
  assert.equal(result.summary.rowsWithoutValidEmail, 4);
});

test('different emails remain separate even when official school identifiers and names are identical', () => {
  const result = merge([directory('osnovne-sole', [row('school', 'one@school.si', { naziv: 'Same', zavsif: '100' })]), directory('vrtci', [row('nursery', 'two@school.si', { naziv: 'Same', zavsif: '100' })])]);
  assert.equal(findRows(result, 'osnovne-sole').length, 1);
  assert.equal(findRows(result, 'vrtci').length, 1);
});

test('existing primary identity wins richer imported rows, fills blanks and archives scalar conflicts', () => {
  const primary = row('stable-school-id', 'office@school.si', { naziv: 'OŠ Original', telefon: '01 111', naslov: '' });
  const nursery = row('import', 'office@school.si; nursery@school.si', { naziv: 'Vrtec', telefon: '01 222; 01 111', naslov: 'Ulica 1', 'kontaktne-osebe': 'Ana; Boris', zavsif: '123' });
  const original = [directory('vrtci', [nursery]), directory('osnovne-sole', [primary])];
  const before = structuredClone(original);
  const result = merge(original);
  const kept = findRows(result, 'osnovne-sole')[0];
  assert.equal(kept.id, 'stable-school-id');
  assert.equal(kept.cells.naziv, 'OŠ Original');
  assert.equal(kept.cells.naslov, 'Ulica 1');
  assert.equal(kept.cells.telefon, '01 111; 01 222');
  assert.equal(kept.cells['kontaktne-osebe'], 'Ana; Boris');
  assert.deepEqual(result.audit[0].conflicts.find(conflict => conflict.columnId === 'naziv'), { columnId: 'naziv', keptValue: 'OŠ Original', alternatives: [{ value: 'Vrtec', sources: [{ directoryId: 'vrtci', rowId: 'import' }] }] });
  assert.deepEqual(original, before);
});

test('legacy kindergarten lists merge semantically and same-email rows stay under Vrtci', () => {
  const result = merge([directory('vrtci-z-enotami', [row('unit', 'nursery@school.si')]), directory('vrtci', [row('main', 'nursery@school.si', { naslov: 'Street' }), row('other', 'other@school.si')])]);
  assert.deepEqual(findRows(result, 'vrtci').map(row => row.id), ['main', 'other']);
  assert.equal(findRows(result, 'osnovne-sole').length, 0);
  assert.equal(result.directories.length, 9);
  assert.equal(new Set<string>(result.directories.map(directory => directory.id)).has('vrtci-z-enotami'), false);
  assert.deepEqual(result.directories.slice(1, 4).map(directory => directory.label), ['Dijaški domovi', 'Glasbene šole', 'Vrtci']);
});

test('secondary schools win shared-email dormitories without inventing a primary identity', () => {
  const result = merge([directory('srednje-sole', [row('secondary', 'office@school.si', { naziv: 'Srednja šola' })]), directory('dijaski-domovi', [row('dorm', 'office@school.si', { naziv: 'Dijaški dom', naslov: 'Ulica' })])]);
  assert.equal(findRows(result, 'srednje-sole')[0].id, 'secondary');
  assert.equal(findRows(result, 'srednje-sole')[0].cells.naziv, 'Srednja šola');
  assert.equal(findRows(result, 'osnovne-sole').length, 0);
  assert.equal(result.summary.movedRows, 1);
});

test('surviving order follows positions and each merged group retains the target-category row', () => {
  const result = merge([directory('vrtci', [row('import-first', 'merged@school.si'), row('moved-first', 'move@school.si')]), directory('srednje-sole', [row('moved-second', 'move@school.si')]), directory('osnovne-sole', [row('last', 'last@school.si', {}, 50), row('first', 'first@school.si', {}, -4), row('merged', 'merged@school.si', {}, 20)])]);
  assert.deepEqual(findRows(result, 'osnovne-sole').map(row => row.id), ['first', 'merged', 'last']);
  assert.deepEqual(findRows(result, 'osnovne-sole').map(row => row.position), [0, 1, 2]);
  assert.equal(findRows(result, 'srednje-sole')[0].id, 'moved-second');
});

test('same-category duplicates merge and retain unique contact people', () => {
  const result = merge([directory('glasbene-sole', [row('first', 'office@school.si', { 'kontaktne-osebe': 'Ana, Boris' }), row('second', 'OFFICE@SCHOOL.SI', { 'kontaktne-osebe': 'Boris; Cene' })])]);
  assert.equal(findRows(result, 'glasbene-sole')[0].cells['kontaktne-osebe'], 'Ana; Boris; Cene');
  assert.equal(findRows(result, 'glasbene-sole')[0].id, 'first');
  assert.equal(findRows(result, 'osnovne-sole').length, 0);
});

test('empty input preserves nine empty directories and normalized output is idempotent', () => {
  const empty = merge([]);
  assert.equal(empty.directories.length, 9);
  assert.ok(empty.directories.every(directory => directory.rows.length === 0));
  assert.equal(empty.summary.inputRows, 0);
  const original = [directory('vrtci-z-enotami', [row('unit', 'unit@school.si', { telefon: '1, 2' })]), directory('vrtci', [row('nursery', 'unit@school.si; next@school.si')]), directory('dijaski-domovi', [row('dorm', 'next@school.si')]), directory('osnovne-sole', [row('primary', 'separate@school.si')])];
  const result = merge(original);
  assert.deepEqual(merge(result.directories).directories, result.directories);
});

test('global row ID collisions and oversized merged cells fail rather than losing records', () => {
  assert.throws(() => merge([directory('vrtci', [row('same-id', 'one@school.si')]), directory('osnovne-sole', [row('same-id', 'different@school.si')])]), /Duplicate or empty row ID/);
  assert.throws(() => merge([directory('vrtci', [row('large', '', { naslov: 'a'.repeat(4001) })])]), /oversized cell/);
  assert.throws(() => merge([directory('vrtci', [row('one', 'same@school.si', { 'kontaktne-osebe': 'a'.repeat(3000) }), row('two', 'same@school.si', { 'kontaktne-osebe': 'b'.repeat(3000) })])]), /Merged cell exceeds/);
});


test('category priority can be overridden except that an existing primary record always wins', () => {
  const input = [directory('srednje-sole', [row('secondary', 'shared@school.si')]), directory('glasbene-sole', [row('music', 'shared@school.si')])];
  assert.equal(findRows(merge(input), 'srednje-sole')[0].id, 'secondary');
  const options = { categoryPriority: ['glasbene-sole', 'srednje-sole'] };
  assert.equal(findRows(merge(input, options), 'glasbene-sole')[0].id, 'music');
  const withPrimary = merge([...input, directory('osnovne-sole', [row('primary', 'shared@school.si')])], options);
  assert.equal(findRows(withPrimary, 'osnovne-sole')[0].id, 'primary');
});


test('recorded mailbox-like domains match exactly without public-TLD validation or spelling corrections', () => {
  assert.deepEqual(extractInstitutionEmails('info@vrtec.slo-bistrica'), ['info@vrtec.slo-bistrica']);
  const result = merge([directory('vrtci', [row('one', 'info@vrtec.slo-bistrica'), row('two', 'INFO@VRTEC.SLO-BISTRICA'), row('different', 'info@vrtec.slo-bistrica.si'), row('invalid-one', 'arbitrary free text'), row('invalid-two', 'arbitrary free text')])]);
  assert.deepEqual(findRows(result, 'vrtci').map(row => row.id), ['one', 'different', 'invalid-one', 'invalid-two']);
  assert.equal(findRows(result, 'vrtci')[0].cells['e-naslov'], 'info@vrtec.slo-bistrica');
  assert.equal(result.summary.removedRows, 1);
});


test('unique records retain original cell formatting including phones and email casing', () => {
  const untouched = row('unique', 'Office@School.SI', { telefon: '05 367 14 60, 05 367 14 63', 'kontaktne-osebe': 'Ana, Boris' });
  const blankEmail = row('blank-email', '', { telefon: '05 367 14 60, 05 367 14 63' });
  const result = merge([directory('vrtci', [untouched, blankEmail])]);
  assert.deepEqual(findRows(result, 'vrtci').map(row => row.cells), [untouched.cells, blankEmail.cells]);
});
