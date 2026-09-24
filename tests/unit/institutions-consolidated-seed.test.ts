import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  buildConsolidatedInstitutionSeed, CONSOLIDATED_SEED_PATH, CONSOLIDATION_REPORT_PATH, NAME_NORMALIZATION_REPORT_PATH
} from '../../scripts/build-consolidated-institution-seed';
import { normalizeInstitutionArchiveText, institutionArchiveTextSha256, INSTITUTION_ARCHIVE_TEXT_ENCODING } from '../../scripts/institution-archive-text';
import { normalizeInstitutionName } from '../../src/shared/domain/institutionName';
import { INSTITUTION_DIRECTORIES } from '../../src/shared/domain/institutionDirectory';
import {
  consolidateInstitutionDirectories, extractInstitutionEmails
} from '../../src/shared/domain/institutionEmailConsolidation';
import { SCHOOL_DIRECTORY_MAX_CELL_LENGTH } from '../../src/shared/domain/schoolDirectory';

const built = buildConsolidatedInstitutionSeed();
const { seed, report, input } = built;
const sourceRows = input.flatMap(directory => directory.rows.map(row => ({ directoryId: directory.id, ...row })));
const canonicalRows = seed.directories.flatMap(directory => directory.rows.map(row => ({ directoryId: directory.id, ...row })));
const sourceKey = (directoryId: string, rowId: string) => `${directoryId}/${rowId}`;
const outputKey = (directoryId: string, rowId: string) => `${directoryId}/${rowId}`;

test('version-three seed is reproducible from unchanged archives and has nine canonical directories', () => {
  assert.equal(normalizeInstitutionArchiveText(readFileSync(CONSOLIDATED_SEED_PATH, 'utf8')), built.seedText);
  assert.equal(normalizeInstitutionArchiveText(readFileSync(CONSOLIDATION_REPORT_PATH, 'utf8')), built.reportText);
  assert.equal(normalizeInstitutionArchiveText(readFileSync(NAME_NORMALIZATION_REPORT_PATH, 'utf8')), built.nameReportText);
  assert.equal(seed.version, 3);
  assert.deepEqual(seed.directories.map(({ id, label }) => ({ id, label })), INSTITUTION_DIRECTORIES);
  assert.deepEqual(seed.directories.map(directory => directory.rows.length), [452, 15, 67, 684, 165, 52, 78, 28, 13]);
  assert.equal(canonicalRows.length, 1554);
  assert.equal(report.summary.inputRows, 2549);
  assert.equal(report.summary.removedRows, 995);
  assert.equal(report.summary.mergedGroups, 459);
  for (const directory of seed.directories) {
    assert.equal(directory.columns.length, 14);
    assert.deepEqual(directory.rows.map(row => row.position), directory.rows.map((_, position) => position));
    for (const row of directory.rows) for (const value of Object.values(row.cells)) {
      assert.ok(value.length <= SCHOOL_DIRECTORY_MAX_CELL_LENGTH);
    }
  }
  assert.deepEqual(consolidateInstitutionDirectories(seed.directories).directories, seed.directories);
});

test('every original row maps to one existing canonical row and every email is retained exactly once', () => {
  const sourceKeys = new Set(sourceRows.map(row => sourceKey(row.directoryId, row.id)));
  const targets = new Map(canonicalRows.map(row => [outputKey(row.directoryId, row.id), row]));
  assert.equal(report.mappings.length, sourceRows.length);
  assert.equal(new Set(report.mappings.map(mapping => sourceKey(mapping.sourceDirectoryId, mapping.sourceRowId))).size, sourceRows.length);
  assert.equal(new Set(report.mappings.map(mapping => outputKey(mapping.targetDirectoryId, mapping.canonicalRowId))).size, canonicalRows.length);
  const sourceEmailSets = new Map(sourceRows.map(row => [sourceKey(row.directoryId, row.id), extractInstitutionEmails(row.cells['e-naslov'])]));
  const expectedTargetEmails = new Map<string, Set<string>>();
  for (const mapping of report.mappings) {
    const from = sourceKey(mapping.sourceDirectoryId, mapping.sourceRowId);
    const to = outputKey(mapping.targetDirectoryId, mapping.canonicalRowId);
    assert.ok(sourceKeys.has(from));
    assert.ok(targets.has(to));
    const expected = expectedTargetEmails.get(to) ?? new Set<string>();
    sourceEmailSets.get(from)!.forEach(email => expected.add(email));
    expectedTargetEmails.set(to, expected);
  }
  const allEmails = new Set<string>();
  for (const [key, row] of targets) {
    const emails = extractInstitutionEmails(row.cells['e-naslov']);
    assert.deepEqual(new Set(emails), expectedTargetEmails.get(key));
    for (const email of emails) {
      assert.equal(allEmails.has(email), false, `Mailbox appears in more than one row: ${email}`);
      allEmails.add(email);
    }
  }
});

test('rows without an email remain separate with their original content and identity', () => {
  const noEmail = sourceRows.filter(row => extractInstitutionEmails(row.cells['e-naslov']).length === 0);
  assert.equal(noEmail.length, 326);
  assert.equal(noEmail.filter(row => !row.cells['e-naslov'].trim()).length, 326);
  const targets = new Map(canonicalRows.map(row => [row.id, row]));
  for (const original of noEmail) {
    const mappings = report.mappings.filter(mapping => mapping.sourceRowId === original.id);
    assert.equal(mappings.length, 1);
    assert.equal(mappings[0].canonicalRowId, original.id);
    assert.equal(report.mappings.filter(mapping => mapping.canonicalRowId === original.id).length, 1);
    assert.deepEqual(targets.get(original.id)!.cells, { ...original.cells, naziv: normalizeInstitutionName(original.cells.naziv) });
  }
});

test('disconnected email groups never share a canonical row, regardless of name or legal identifiers', () => {
  // Independently derive connectivity from the source addresses rather than names or ZAVSIF.
  const owner = new Map<string, number>();
  const parents = sourceRows.map((_, index) => index);
  const find = (i: number): number => parents[i] === i ? i : (parents[i] = find(parents[i]));
  sourceRows.forEach((row, index) => {
    for (const email of extractInstitutionEmails(row.cells['e-naslov'])) {
      const first = owner.get(email);
      if (first === undefined) owner.set(email, index);
      else parents[find(index)] = find(first);
    }
  });
  const targetBySource = new Map(report.mappings.map(mapping => [sourceKey(mapping.sourceDirectoryId, mapping.sourceRowId), outputKey(mapping.targetDirectoryId, mapping.canonicalRowId)]));
  const targetByGroup = new Map<number, string>();
  const groupByTarget = new Map<string, number>();
  sourceRows.forEach((row, index) => {
    const component = find(index);
    const target = targetBySource.get(sourceKey(row.directoryId, row.id))!;
    if (targetByGroup.has(component)) assert.equal(targetByGroup.get(component), target);
    else targetByGroup.set(component, target);
    if (groupByTarget.has(target)) assert.equal(groupByTarget.get(target), component);
    else groupByTarget.set(target, component);
  });
  assert.equal(targetByGroup.size, canonicalRows.length);
});

test('consolidation audit preserves all merged source snapshots and scalar conflicts', () => {
  const originals = new Map(sourceRows.map(row => [sourceKey(row.directoryId, row.id), row]));
  for (const group of report.groups) {
    for (const source of group.sources) {
      assert.deepEqual(source.row.cells, originals.get(sourceKey(source.directoryId, source.rowId))!.cells);
      assert.ok(report.mappings.some(mapping => mapping.sourceDirectoryId === source.directoryId && mapping.sourceRowId === source.rowId && mapping.targetDirectoryId === group.targetDirectoryId && mapping.canonicalRowId === group.canonicalRowId));
    }
    for (const conflict of group.conflicts) for (const alternative of conflict.alternatives) {
      assert.ok(alternative.sources.length > 0);
      for (const source of alternative.sources) assert.equal(originals.get(sourceKey(source.directoryId, source.rowId))!.cells[conflict.columnId], alternative.value);
    }
  }
  assert.ok(report.groups.some(group => group.sources.some(source => source.row.cells.naziv === 'OŠ Prule') && group.sources.some(source => source.row.cells.naziv === 'OŠ Otočec')));
});


test('the repeated incomplete source domain merges literally without inventing a corrected address', () => {
  const recorded = 'info@vrtec.slo-bistrica';
  const originals = sourceRows.filter(row => row.cells['e-naslov'] === recorded);
  assert.equal(originals.length, 15);
  const targets = canonicalRows.filter(row => extractInstitutionEmails(row.cells['e-naslov']).includes(recorded));
  assert.equal(targets.length, 1);
  assert.equal(targets[0].directoryId, 'vrtci');
  assert.equal(targets[0].cells['e-naslov'], recorded);
  assert.equal(report.mappings.filter(mapping => mapping.canonicalRowId === targets[0].id).length, 15);
});


test('canonical names abbreviate the requested phrase across all stored directories and retain source name evidence', () => {
  const originalMerged = consolidateInstitutionDirectories(input).directories;
  const previous = new Map(originalMerged.flatMap(directory => directory.rows.map(row => [outputKey(directory.id, row.id), row.cells.naziv] as const)));
  for (const row of canonicalRows) {
    const before = previous.get(outputKey(row.directoryId, row.id))!;
    assert.equal(row.cells.naziv, normalizeInstitutionName(before));
    if (row.cells.naziv !== before) assert.ok(built.nameReport.changes.some(change => change.rowId === row.id && change.before === before && change.after === row.cells.naziv));
  }
  const special = seed.directories.filter(directory => ['osnovne-sole-posebne-potrebe', 'zavodi-posebne-potrebe'].includes(directory.id));
  assert.equal(special.reduce((total, directory) => total + directory.rows.length, 0), 41);
  assert.ok(special.flatMap(directory => directory.rows).some(row => row.cells.naziv === 'OŠ Roje'));
  assert.deepEqual(report.groups, consolidateInstitutionDirectories(input).audit);
});


test('archive fingerprints are equal for LF/CRLF checkouts but still detect content changes', () => {
  assert.equal(built.report.textHashEncoding, INSTITUTION_ARCHIVE_TEXT_ENCODING);
  assert.equal(built.nameReport.textHashEncoding, INSTITUTION_ARCHIVE_TEXT_ENCODING);
  for (const source of built.report.sources) {
    const lf = normalizeInstitutionArchiveText(readFileSync(source.path, 'utf8'));
    const crlf = lf.replaceAll('\n', '\r\n');
    assert.equal(institutionArchiveTextSha256(lf), source.sha256);
    assert.equal(institutionArchiveTextSha256(crlf), source.sha256);
    assert.notEqual(institutionArchiveTextSha256(lf.replace('naziv', 'changed-name')), source.sha256);
    assert.deepEqual(JSON.parse(crlf), JSON.parse(lf));
  }
  // Escaped line breaks inside JSON strings are product data, not checkout newlines.
  const encoded = '{"value":"first\\r\\nsecond"}\r\n';
  assert.equal(normalizeInstitutionArchiveText(encoded), '{"value":"first\\r\\nsecond"}\n');
});
