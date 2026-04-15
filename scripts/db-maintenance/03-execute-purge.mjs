#!/usr/bin/env node
import path from 'node:path';
import process from 'node:process';
import {
  ensureOutputDir,
  listPublicTables,
  timestampForFile,
  withPool,
  writeJson
} from './common.mjs';

function hasFlag(flag) {
  return process.argv.includes(flag);
}

function toSqlIdentifier(name) {
  return `"${name.replace(/"/g, '""')}"`;
}

async function countTable(client, tableName) {
  const result = await client.query(`select count(*)::bigint as count from ${toSqlIdentifier(tableName)}`);
  return Number(result.rows[0]?.count ?? 0);
}

async function updateCatalogItemsToEmpty(client) {
  const result = await client.query(`
    update catalog_categories
    set items = '[]'::jsonb,
        updated_at = now()
    where jsonb_typeof(items) = 'array'
      and jsonb_array_length(items) > 0
  `);
  return Number(result.rowCount ?? 0);
}

async function deleteAllRows(client, tableName) {
  const result = await client.query(`delete from ${toSqlIdentifier(tableName)}`);
  return Number(result.rowCount ?? 0);
}

const ORDER_DELETE_SEQUENCE = [
  'order_payment_logs',
  'order_items',
  'order_attachments',
  'order_documents',
  'orders',
  'deleted_archive_entries'
];

const COUNTER_RESET_CANDIDATES = [
  { table: 'orders', column: 'id' },
  { table: 'order_items', column: 'id' },
  { table: 'order_documents', column: 'id' },
  { table: 'order_attachments', column: 'id' },
  { table: 'order_payment_logs', column: 'id' },
  { table: 'deleted_archive_entries', column: 'id' }
];

async function main() {
  const execute = hasFlag('--execute');
  const resetSequences = hasFlag('--reset-sequences');
  const outputDir = await ensureOutputDir('reports');
  const timestamp = timestampForFile();

  const report = await withPool(async ({ pool, source }) => {
    const client = await pool.connect();
    try {
      const existingTables = new Set(await listPublicTables(pool));
      const orderTables = ORDER_DELETE_SEQUENCE.filter((table) => existingTables.has(table));
      const trackedTables = ['catalog_categories', ...orderTables].filter((table, index, arr) => arr.indexOf(table) === index);

      const beforeCounts = {};
      for (const table of trackedTables) {
        beforeCounts[table] = await countTable(client, table);
      }

      if (!execute) {
        const dryRunReport = {
          generatedAt: new Date().toISOString(),
          mode: 'dry-run',
          databaseUrlSource: source,
          instructions: 'Run with --execute to apply destructive purge. Optional --reset-sequences for purged tables.',
          trackedTables,
          beforeCounts,
          plannedOperations: [
            {
              domain: 'artikli',
              operation: "UPDATE catalog_categories SET items='[]'::jsonb WHERE items array is non-empty",
              expectedImpact: 'Only product payload in category rows; category hierarchy/metadata preserved.'
            },
            ...orderTables.map((table) => ({
              domain: table === 'deleted_archive_entries' ? 'arhiv' : 'orders',
              operation: `DELETE FROM ${table}`,
              expectedImpact: 'Remove all rows for this table.'
            }))
          ]
        };

        return dryRunReport;
      }

      await client.query('BEGIN');

      const operations = [];
      if (existingTables.has('catalog_categories')) {
        const affected = await updateCatalogItemsToEmpty(client);
        operations.push({ table: 'catalog_categories', action: 'update_items_to_empty', affectedRows: affected });
      }

      for (const table of orderTables) {
        const deleted = await deleteAllRows(client, table);
        operations.push({ table, action: 'delete_all_rows', affectedRows: deleted });
      }

      const sequenceResets = [];
      if (resetSequences) {
        for (const candidate of COUNTER_RESET_CANDIDATES) {
          if (!existingTables.has(candidate.table)) continue;
          const sequenceResult = await client.query(
            `select pg_get_serial_sequence($1, $2) as sequence_name`,
            [`public.${candidate.table}`, candidate.column]
          );
          const sequenceName = sequenceResult.rows[0]?.sequence_name ? String(sequenceResult.rows[0].sequence_name) : null;
          if (!sequenceName) continue;

          await client.query(`select setval($1::regclass, 1, false)`, [sequenceName]);
          sequenceResets.push({ table: candidate.table, column: candidate.column, sequenceName });
        }
      }

      const afterCounts = {};
      for (const table of trackedTables) {
        afterCounts[table] = await countTable(client, table);
      }

      await client.query('COMMIT');

      return {
        generatedAt: new Date().toISOString(),
        mode: 'execute',
        databaseUrlSource: source,
        trackedTables,
        beforeCounts,
        afterCounts,
        operations,
        sequenceResets
      };
    } catch (error) {
      try {
        await client.query('ROLLBACK');
      } catch {
        // noop
      }
      throw error;
    } finally {
      client.release();
    }
  });

  const suffix = execute ? 'purge-execute' : 'purge-dry-run';
  const filePath = path.join(outputDir, `${timestamp}.${suffix}.json`);
  await writeJson(filePath, report);

  console.log(`${execute ? 'Purge execution' : 'Purge dry-run'} report written: ${filePath}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
