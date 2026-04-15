#!/usr/bin/env node
import path from 'node:path';
import process from 'node:process';
import {
  ensureOutputDir,
  getRowCounts,
  listForeignKeys,
  listPublicColumns,
  listPublicTables,
  listSerialSequences,
  timestampForFile,
  withPool,
  writeJson
} from './common.mjs';

async function main() {
  const outputDir = await ensureOutputDir('reports');
  const timestamp = timestampForFile();

  const report = await withPool(async ({ pool, source }) => {
    const [tables, columns, foreignKeys, sequences] = await Promise.all([
      listPublicTables(pool),
      listPublicColumns(pool),
      listForeignKeys(pool),
      listSerialSequences(pool)
    ]);

    const rowCounts = await getRowCounts(pool, tables);

    return {
      generatedAt: new Date().toISOString(),
      databaseUrlSource: source,
      inventory: {
        tableCount: tables.length,
        columnCount: columns.length,
        foreignKeyCount: foreignKeys.length,
        sequenceCount: sequences.length
      },
      tables,
      rowCounts,
      columns,
      foreignKeys,
      serialSequences: sequences
    };
  });

  const filePath = path.join(outputDir, `${timestamp}.read-only-db-audit.json`);
  await writeJson(filePath, report);

  console.log(`Read-only DB audit complete: ${filePath}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
