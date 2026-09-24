import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeInstitutionName } from '../src/shared/domain/institutionName';
import {
  consolidateInstitutionDirectories,
  type ConsolidationDirectory
} from '../src/shared/domain/institutionEmailConsolidation';

export const CONSOLIDATED_SEED_PATH = 'src/shared/data/schools-and-institutions-seed.json';
export const NAME_NORMALIZATION_REPORT_PATH = 'data/imports/schools-and-institutions-2026-09-24/name-normalization.json';
export const CONSOLIDATION_REPORT_PATH = 'data/imports/schools-and-institutions-2026-09-24/email-consolidation.json';
const PRIMARY_SOURCE = 'src/shared/data/schools-seed.json';
const INSTITUTION_SOURCE = 'src/shared/data/institutions-seed.json';
const sha256 = (text: string) => createHash('sha256').update(text).digest('hex');

type PrimaryArchive = Pick<ConsolidationDirectory, 'columns' | 'rows'> & { version: number };
type InstitutionArchive = { version: number; directories: ConsolidationDirectory[] };

/** Raw imports remain immutable; this release seed is a separate reproducible projection. */
export function buildConsolidatedInstitutionSeed(root = process.cwd()) {
  const primaryText = readFileSync(resolve(root, PRIMARY_SOURCE), 'utf8');
  const institutionText = readFileSync(resolve(root, INSTITUTION_SOURCE), 'utf8');
  const primary = JSON.parse(primaryText) as PrimaryArchive;
  const institutions = JSON.parse(institutionText) as InstitutionArchive;
  const input: ConsolidationDirectory[] = [{
    id: 'osnovne-sole', label: 'Osnovne šole', columns: primary.columns,
    // Identical display normalization to the original primary-school seeder.
    rows: primary.rows.map(row => ({ ...row, cells: {
      ...row.cells, naziv: (row.cells.naziv ?? '').replaceAll('Osnovna šola', 'OŠ')
    } }))
  }, ...institutions.directories];
  const result = consolidateInstitutionDirectories(input);
  // Apply the requested display abbreviation after merging. Original source snapshots and
  // conflicts in the email-consolidation audit remain byte-for-byte unchanged.
  const changes: Array<{ directoryId: string; rowId: string; before: string; after: string }> = [];
  const directories = result.directories.map(directory => ({ ...directory, rows: directory.rows.map(row => {
    const before = row.cells.naziv ?? '';
    const after = normalizeInstitutionName(before);
    if (before !== after) changes.push({ directoryId: directory.id, rowId: row.id, before, after });
    return before === after ? row : { ...row, cells: { ...row.cells, naziv: after } };
  }) }));
  const seed = { version: 3, directories };
  const seedText = `${JSON.stringify(seed, null, 2)}\n`;
  const report = {
    version: 1,
    policy: {
      matching: 'One institution per connected group of shared, case-insensitive individual email addresses. Empty or invalid addresses do not match.',
      categories: 'Merge both kindergarten directories into Vrtci. Existing Osnovne šole wins; otherwise retain the matching school or institution category rather than moving unrelated entities into primary schools.',
      deliverability: 'No mailbox deliverability or public-TLD assumptions; recorded domains are never corrected or guessed.',
      contacts: 'Union all distinct email addresses and contact values; preserve original snapshots and conflicting scalar values in this audit.',
      primaryNameNormalization: 'Osnovna šola -> OŠ, matching the existing primary-school seeder.'
    },
    sources: [
      { path: PRIMARY_SOURCE, version: primary.version, sha256: sha256(primaryText) },
      { path: INSTITUTION_SOURCE, version: institutions.version, sha256: sha256(institutionText) }
    ],
    canonicalSeed: { path: CONSOLIDATED_SEED_PATH, version: 3, sha256: sha256(seedText), nameNormalizationAudit: NAME_NORMALIZATION_REPORT_PATH },
    summary: result.summary,
    mappings: result.mappings,
    groups: result.audit
  };
  const nameReport = {
    version: 1,
    rule: 'Case-insensitive complete phrase Osnovna šola -> OŠ in canonical institution names; preserve all other name text and all source audit snapshots.',
    previousCanonicalSha256: sha256(`${JSON.stringify({ version: 3, directories: result.directories }, null, 2)}\n`),
    canonicalSeedSha256: sha256(seedText),
    changedNames: changes.length,
    directoryCounts: directories.map(directory => ({ id: directory.id, rows: directory.rows.length, changedNames: changes.filter(change => change.directoryId === directory.id).length })),
    changes
  };
  return { seed, report, nameReport, seedText, reportText: `${JSON.stringify(report, null, 2)}\n`, nameReportText: `${JSON.stringify(nameReport, null, 2)}\n`, input };
}

function main() {
  const args = process.argv.slice(2);
  if (args.some(arg => arg !== '--check') || args.length > 1) throw new Error('Usage: tsx scripts/build-consolidated-institution-seed.ts [--check]');
  const result = buildConsolidatedInstitutionSeed();
  for (const [path, content] of [[CONSOLIDATED_SEED_PATH, result.seedText], [CONSOLIDATION_REPORT_PATH, result.reportText], [NAME_NORMALIZATION_REPORT_PATH, result.nameReportText]]) {
    if (args.includes('--check')) {
      if (readFileSync(resolve(path), 'utf8') !== content) throw new Error(`Consolidated seed is stale: ${path}`);
    } else writeFileSync(resolve(path), content);
  }
  console.log(JSON.stringify({ mode: args.includes('--check') ? 'verified' : 'written', ...result.report.summary, abbreviatedNames: result.nameReport.changedNames }));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
