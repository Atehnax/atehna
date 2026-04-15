#!/usr/bin/env node
import path from 'node:path';
import process from 'node:process';
import {
  ensureOutputDir,
  getRowCounts,
  listForeignKeys,
  listPublicColumns,
  listPublicTables,
  timestampForFile,
  withPool,
  writeJson
} from './common.mjs';

const DOMAIN_TABLE_HINTS = {
  artikli: {
    canonical: ['catalog_categories'],
    dependents: [],
    strategy: 'Set catalog_categories.items = [] for all category/subcategory rows. Preserve category tree and metadata columns.'
  },
  orders: {
    canonical: ['orders'],
    dependents: ['order_items', 'order_documents', 'order_attachments', 'order_payment_logs'],
    strategy: 'Delete dependent rows, then delete orders.'
  },
  arhiv: {
    canonical: ['deleted_archive_entries'],
    dependents: [],
    strategy: 'Delete archive entries and remove soft-delete markers in order documents/orders only if rows remain.'
  }
};

const CATEGORY_UNTOUCHABLE_COLUMNS = [
  'id',
  'parent_id',
  'slug',
  'title',
  'summary',
  'description',
  'image',
  'admin_notes',
  'banner_image',
  'position',
  'status',
  'created_at',
  'updated_at'
];

const PRODUCT_OWNED_CATEGORY_PAYLOAD_COLUMNS = ['items'];

function pickExisting(tables, candidates) {
  const set = new Set(tables);
  return candidates.filter((name) => set.has(name));
}

function fkEdgesForTables(foreignKeys, tableSet) {
  return foreignKeys.filter((fk) => tableSet.has(fk.sourceTable) || tableSet.has(fk.targetTable));
}

function buildDeleteOrder(domainTables, foreignKeys) {
  const domainSet = new Set(domainTables);

  const edges = foreignKeys
    .filter((fk) => domainSet.has(fk.sourceTable) && domainSet.has(fk.targetTable))
    .map((fk) => ({ from: fk.sourceTable, to: fk.targetTable }));

  const inDegree = new Map();
  for (const table of domainTables) inDegree.set(table, 0);
  for (const edge of edges) inDegree.set(edge.to, (inDegree.get(edge.to) ?? 0) + 1);

  const queue = domainTables.filter((table) => (inDegree.get(table) ?? 0) === 0);
  const sorted = [];

  while (queue.length > 0) {
    const current = queue.shift();
    sorted.push(current);
    for (const edge of edges.filter((entry) => entry.from === current)) {
      const next = edge.to;
      inDegree.set(next, (inDegree.get(next) ?? 0) - 1);
      if ((inDegree.get(next) ?? 0) === 0) queue.push(next);
    }
  }

  if (sorted.length !== domainTables.length) {
    return [...domainTables].sort((left, right) => left.localeCompare(right));
  }

  return sorted;
}

async function main() {
  const outputDir = await ensureOutputDir('reports');
  const timestamp = timestampForFile();

  const report = await withPool(async ({ pool, source }) => {
    const [tables, columns, foreignKeys] = await Promise.all([
      listPublicTables(pool),
      listPublicColumns(pool),
      listForeignKeys(pool)
    ]);

    const artikliCanonical = pickExisting(tables, DOMAIN_TABLE_HINTS.artikli.canonical);
    const ordersCanonical = pickExisting(tables, DOMAIN_TABLE_HINTS.orders.canonical);
    const ordersDependents = pickExisting(tables, DOMAIN_TABLE_HINTS.orders.dependents);
    const arhivCanonical = pickExisting(tables, DOMAIN_TABLE_HINTS.arhiv.canonical);

    const purgeCandidateTables = [
      ...ordersDependents,
      ...ordersCanonical,
      ...arhivCanonical
    ];

    const rowCounts = await getRowCounts(pool, Array.from(new Set([...artikliCanonical, ...purgeCandidateTables])));

    const deleteOrder = buildDeleteOrder(
      Array.from(new Set(purgeCandidateTables)),
      foreignKeys
    );

    const categoryColumns = columns.filter((column) => column.tableName === 'catalog_categories');

    return {
      generatedAt: new Date().toISOString(),
      databaseUrlSource: source,
      domains: {
        artikli: {
          canonicalTables: artikliCanonical,
          dependentTables: [],
          strategy: DOMAIN_TABLE_HINTS.artikli.strategy,
          rowCounts: Object.fromEntries(artikliCanonical.map((table) => [table, rowCounts[table] ?? 0]))
        },
        orders: {
          canonicalTables: ordersCanonical,
          dependentTables: ordersDependents,
          strategy: DOMAIN_TABLE_HINTS.orders.strategy,
          rowCounts: Object.fromEntries([...ordersCanonical, ...ordersDependents].map((table) => [table, rowCounts[table] ?? 0]))
        },
        arhiv: {
          canonicalTables: arhivCanonical,
          dependentTables: [],
          strategy: DOMAIN_TABLE_HINTS.arhiv.strategy,
          rowCounts: Object.fromEntries(arhivCanonical.map((table) => [table, rowCounts[table] ?? 0]))
        }
      },
      categoryProtection: {
        table: 'catalog_categories',
        untouchableColumns: CATEGORY_UNTOUCHABLE_COLUMNS,
        productOwnedColumnsAllowedForPurge: PRODUCT_OWNED_CATEGORY_PAYLOAD_COLUMNS,
        existingColumns: categoryColumns.map((column) => column.columnName)
      },
      foreignKeysInScope: fkEdgesForTables(foreignKeys, new Set([...artikliCanonical, ...purgeCandidateTables])),
      purgeDeleteOrder: deleteOrder,
      notes: [
        'This report is read-only and does not modify data.',
        'If additional custom tables reference orders or catalog_categories in your live database, append them manually to purge order before execute mode.'
      ]
    };
  });

  const filePath = path.join(outputDir, `${timestamp}.purge-plan-read-only.json`);
  await writeJson(filePath, report);

  console.log(`Read-only purge plan written: ${filePath}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
