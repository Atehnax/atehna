#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { Client } from 'pg';

const DB_URL_ENV_KEYS = ['DATABASE_URL', 'POSTGRES_URL', 'POSTGRES_PRISMA_URL', 'SUPABASE_DB_URL'];

function getDatabaseUrl() {
  for (const key of DB_URL_ENV_KEYS) {
    const value = process.env[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
}

function parseArgs(argv) {
  const args = new Set(argv.slice(2));
  return {
    execute: args.has('--execute'),
    resetSequences: args.has('--reset-sequences'),
    outputDir: (() => {
      const prefixed = [...args].find((arg) => arg.startsWith('--output-dir='));
      return prefixed ? prefixed.slice('--output-dir='.length) : null;
    })()
  };
}

async function queryOne(client, sql, params = []) {
  const result = await client.query(sql, params);
  return result.rows[0] ?? null;
}

async function listTables(client) {
  const result = await client.query(`
    select table_name
    from information_schema.tables
    where table_schema = 'public'
      and table_type = 'BASE TABLE'
    order by table_name asc
  `);
  return result.rows.map((row) => String(row.table_name));
}

async function listColumns(client) {
  const result = await client.query(`
    select
      table_name,
      column_name,
      data_type,
      is_nullable,
      column_default,
      ordinal_position
    from information_schema.columns
    where table_schema = 'public'
    order by table_name asc, ordinal_position asc
  `);

  return result.rows.map((row) => ({
    table_name: String(row.table_name),
    column_name: String(row.column_name),
    data_type: String(row.data_type),
    is_nullable: String(row.is_nullable),
    column_default: row.column_default === null ? null : String(row.column_default),
    ordinal_position: Number(row.ordinal_position)
  }));
}

async function listForeignKeys(client) {
  const result = await client.query(`
    select
      tc.table_name as source_table,
      kcu.column_name as source_column,
      ccu.table_name as target_table,
      ccu.column_name as target_column,
      rc.delete_rule,
      tc.constraint_name
    from information_schema.table_constraints tc
    join information_schema.key_column_usage kcu
      on tc.constraint_name = kcu.constraint_name
      and tc.table_schema = kcu.table_schema
    join information_schema.constraint_column_usage ccu
      on ccu.constraint_name = tc.constraint_name
      and ccu.table_schema = tc.table_schema
    join information_schema.referential_constraints rc
      on rc.constraint_name = tc.constraint_name
      and rc.constraint_schema = tc.table_schema
    where tc.constraint_type = 'FOREIGN KEY'
      and tc.table_schema = 'public'
    order by source_table asc, source_column asc
  `);

  return result.rows.map((row) => ({
    source_table: String(row.source_table),
    source_column: String(row.source_column),
    target_table: String(row.target_table),
    target_column: String(row.target_column),
    delete_rule: String(row.delete_rule),
    constraint_name: String(row.constraint_name)
  }));
}

function classifyTable(tableName) {
  if (tableName === 'catalog_categories') {
    return {
      classification: 'preserve-entirely',
      reason: 'Category definitions/hierarchy/media metadata are explicitly untouchable.'
    };
  }

  if (['orders', 'order_items', 'order_documents', 'order_attachments', 'order_payment_logs', 'deleted_archive_entries'].includes(tableName)) {
    return {
      classification: 'purge-rows-only',
      reason: 'Directly backs admin/orders/admin/arhiv workflows and purge scope.'
    };
  }

  if (['website_events', 'analytics_charts', 'analytics_chart_settings'].includes(tableName)) {
    return {
      classification: 'preserve-entirely',
      reason: 'Analytics/configuration tables outside requested destructive scope.'
    };
  }

  if (tableName === 'items') {
    return {
      classification: 'candidate-schema-cleanup',
      reason: 'Migration reference exists, but runtime references must be proven before dropping.'
    };
  }

  return {
    classification: 'unrelated-or-unknown',
    reason: 'No direct evidence yet that table belongs to purge scope.'
  };
}

async function collectCounts(client, tables) {
  const counts = {};
  for (const table of tables) {
    const row = await queryOne(client, `select count(*)::bigint as count from ${table}`);
    counts[table] = Number(row?.count ?? 0);
  }
  return counts;
}

async function fetchCatalogItemsSnapshot(client) {
  const result = await client.query(`
    select id, parent_id, slug, title, summary, description, image, admin_notes, banner_image, items, position, status, created_at, updated_at
    from catalog_categories
    order by parent_id nulls first, position asc, slug asc
  `);

  return result.rows;
}

function buildCategoryIntegritySignature(rows) {
  return rows.map((row) => ({
    id: row.id,
    parent_id: row.parent_id,
    slug: row.slug,
    title: row.title,
    summary: row.summary,
    description: row.description,
    image: row.image,
    admin_notes: row.admin_notes,
    banner_image: row.banner_image,
    position: row.position,
    status: row.status,
    created_at: row.created_at,
    updated_at: row.updated_at
  }));
}

async function exportTable(client, table, outFile) {
  const result = await client.query(`select * from ${table}`);
  await fs.writeFile(outFile, JSON.stringify(result.rows, null, 2), 'utf8');
}

async function main() {
  const args = parseArgs(process.argv);
  const databaseUrl = getDatabaseUrl();

  if (!databaseUrl) {
    console.error('No database URL found. Set one of: ' + DB_URL_ENV_KEYS.join(', '));
    process.exit(2);
  }

  const timestamp = new Date().toISOString().replace(/[.:]/g, '-');
  const outputDir = args.outputDir ?? path.join(process.cwd(), 'artifacts', `purge-audit-${timestamp}`);

  await fs.mkdir(outputDir, { recursive: true });

  const client = new Client({ connectionString: databaseUrl, ssl: { rejectUnauthorized: false } });
  await client.connect();

  const targetTables = [
    'orders',
    'order_items',
    'order_documents',
    'order_attachments',
    'order_payment_logs',
    'deleted_archive_entries'
  ];

  try {
    const [tables, columns, foreignKeys] = await Promise.all([
      listTables(client),
      listColumns(client),
      listForeignKeys(client)
    ]);

    const tableAudit = tables.map((table_name) => ({
      table_name,
      ...classifyTable(table_name),
      outgoing_fks: foreignKeys.filter((fk) => fk.source_table === table_name),
      incoming_fks: foreignKeys.filter((fk) => fk.target_table === table_name)
    }));

    const preCounts = await collectCounts(client, [...targetTables, 'catalog_categories']);
    const categorySnapshotBefore = await fetchCatalogItemsSnapshot(client);
    const categorySignatureBefore = buildCategoryIntegritySignature(categorySnapshotBefore);

    const metadata = {
      generated_at: new Date().toISOString(),
      execute: args.execute,
      reset_sequences: args.resetSequences,
      target_tables: targetTables,
      categories_table: 'catalog_categories'
    };

    await fs.writeFile(path.join(outputDir, 'metadata.json'), JSON.stringify(metadata, null, 2), 'utf8');
    await fs.writeFile(path.join(outputDir, 'schema-tables.json'), JSON.stringify(tables, null, 2), 'utf8');
    await fs.writeFile(path.join(outputDir, 'schema-columns.json'), JSON.stringify(columns, null, 2), 'utf8');
    await fs.writeFile(path.join(outputDir, 'schema-foreign-keys.json'), JSON.stringify(foreignKeys, null, 2), 'utf8');
    await fs.writeFile(path.join(outputDir, 'table-audit.json'), JSON.stringify(tableAudit, null, 2), 'utf8');
    await fs.writeFile(path.join(outputDir, 'row-counts-before.json'), JSON.stringify(preCounts, null, 2), 'utf8');
    await fs.writeFile(path.join(outputDir, 'catalog-signature-before.json'), JSON.stringify(categorySignatureBefore, null, 2), 'utf8');

    if (!args.execute) {
      console.log(`Audit-only mode complete. No destructive changes made. Output: ${outputDir}`);
      return;
    }

    for (const table of targetTables) {
      await exportTable(client, table, path.join(outputDir, `backup-${table}.json`));
    }

    await client.query('begin');
    try {
      // Purge orders/arhiv domains in child-first FK-safe order.
      await client.query('delete from order_payment_logs');
      await client.query('delete from order_attachments');
      await client.query('delete from order_documents');
      await client.query('delete from order_items');
      await client.query('delete from deleted_archive_entries');
      await client.query('delete from orders');

      // Purge artikli/product entries while preserving category definitions/hierarchy/media metadata.
      await client.query(`
        update catalog_categories
        set items = '[]'::jsonb,
            updated_at = now()
        where jsonb_typeof(items) = 'array' and jsonb_array_length(items) > 0
      `);

      if (args.resetSequences) {
        await client.query("select setval('orders_id_seq', 1, false)");
        await client.query("select setval('order_items_id_seq', 1, false)");
        await client.query("select setval('order_documents_id_seq', 1, false)");
        await client.query("select setval('order_attachments_id_seq', 1, false)");
        await client.query("select setval('order_payment_logs_id_seq', 1, false)");
        await client.query("select setval('deleted_archive_entries_id_seq', 1, false)");
      }

      await client.query('commit');
    } catch (error) {
      await client.query('rollback');
      throw error;
    }

    const postCounts = await collectCounts(client, [...targetTables, 'catalog_categories']);
    const categorySnapshotAfter = await fetchCatalogItemsSnapshot(client);
    const categorySignatureAfter = buildCategoryIntegritySignature(categorySnapshotAfter);

    const nonItemCategoryChanged = JSON.stringify(categorySignatureBefore) !== JSON.stringify(categorySignatureAfter);

    await fs.writeFile(path.join(outputDir, 'row-counts-after.json'), JSON.stringify(postCounts, null, 2), 'utf8');
    await fs.writeFile(path.join(outputDir, 'catalog-signature-after.json'), JSON.stringify(categorySignatureAfter, null, 2), 'utf8');
    await fs.writeFile(
      path.join(outputDir, 'post-checks.json'),
      JSON.stringify(
        {
          non_item_category_changed: nonItemCategoryChanged,
          categories_total_rows_before: preCounts.catalog_categories,
          categories_total_rows_after: postCounts.catalog_categories
        },
        null,
        2
      ),
      'utf8'
    );

    if (nonItemCategoryChanged) {
      throw new Error('Category non-item metadata changed unexpectedly. Inspect backups immediately.');
    }

    console.log(`Purge complete. Evidence and backups written to: ${outputDir}`);
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exit(1);
});
