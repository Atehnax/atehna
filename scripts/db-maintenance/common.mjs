#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { Pool } from 'pg';

const DEFAULT_OUTPUT_ROOT = path.join(process.cwd(), 'artifacts', 'db-maintenance');

function parseConnectionString(connectionString) {
  try {
    return new URL(connectionString);
  } catch {
    return null;
  }
}

function resolveSsl(connectionString) {
  const parsed = parseConnectionString(connectionString);
  const sslMode = parsed?.searchParams.get('sslmode')?.toLowerCase() ?? process.env.PGSSLMODE?.toLowerCase() ?? null;
  if (sslMode && ['disable', 'allow', 'prefer'].includes(sslMode)) return false;
  if (connectionString.includes('localhost') || connectionString.includes('127.0.0.1')) return false;
  return { rejectUnauthorized: false };
}

export function resolveDatabaseUrl() {
  const preferred = process.env.DIRECT_URL?.trim();
  if (preferred) return { url: preferred, source: 'DIRECT_URL' };

  const fallback = process.env.DATABASE_URL?.trim();
  if (fallback) return { url: fallback, source: 'DATABASE_URL' };

  throw new Error('No database URL found. Set DIRECT_URL or DATABASE_URL.');
}

export async function withPool(fn) {
  const { url, source } = resolveDatabaseUrl();
  const pool = new Pool({
    connectionString: url,
    ssl: resolveSsl(url)
  });

  try {
    return await fn({ pool, source, connectionString: url });
  } finally {
    await pool.end();
  }
}

export async function ensureOutputDir(subdir) {
  const dir = subdir ? path.join(DEFAULT_OUTPUT_ROOT, subdir) : DEFAULT_OUTPUT_ROOT;
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

export function timestampForFile(date = new Date()) {
  return date.toISOString().replace(/[:.]/g, '-');
}

export async function writeJson(filePath, value) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

export async function listPublicTables(pool) {
  const result = await pool.query(`
    select table_name
    from information_schema.tables
    where table_schema = 'public'
      and table_type = 'BASE TABLE'
    order by table_name asc
  `);

  return result.rows.map((row) => String(row.table_name));
}

export async function listPublicColumns(pool) {
  const result = await pool.query(`
    select
      table_name,
      ordinal_position,
      column_name,
      data_type,
      udt_name,
      is_nullable,
      column_default
    from information_schema.columns
    where table_schema = 'public'
    order by table_name asc, ordinal_position asc
  `);

  return result.rows.map((row) => ({
    tableName: String(row.table_name),
    ordinalPosition: Number(row.ordinal_position),
    columnName: String(row.column_name),
    dataType: String(row.data_type),
    udtName: String(row.udt_name),
    isNullable: String(row.is_nullable) === 'YES',
    columnDefault: row.column_default === null ? null : String(row.column_default)
  }));
}

export async function listForeignKeys(pool) {
  const result = await pool.query(`
    select
      tc.constraint_name,
      tc.table_name as source_table,
      kcu.column_name as source_column,
      ccu.table_name as target_table,
      ccu.column_name as target_column,
      rc.update_rule,
      rc.delete_rule
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
    order by source_table asc, constraint_name asc, kcu.ordinal_position asc
  `);

  return result.rows.map((row) => ({
    constraintName: String(row.constraint_name),
    sourceTable: String(row.source_table),
    sourceColumn: String(row.source_column),
    targetTable: String(row.target_table),
    targetColumn: String(row.target_column),
    updateRule: String(row.update_rule),
    deleteRule: String(row.delete_rule)
  }));
}

export async function listSerialSequences(pool) {
  const result = await pool.query(`
    select
      t.relname as table_name,
      a.attname as column_name,
      s.relname as sequence_name,
      pg_get_serial_sequence(format('%I.%I', n.nspname, t.relname), a.attname) as full_sequence_name
    from pg_class t
    join pg_namespace n on n.oid = t.relnamespace
    join pg_attribute a on a.attrelid = t.oid and a.attnum > 0 and not a.attisdropped
    join pg_depend d on d.refobjid = t.oid and d.refobjsubid = a.attnum
    join pg_class s on s.oid = d.objid and s.relkind = 'S'
    where t.relkind = 'r'
      and n.nspname = 'public'
      and d.deptype in ('a', 'n')
    order by table_name asc, column_name asc
  `);

  return result.rows.map((row) => ({
    tableName: String(row.table_name),
    columnName: String(row.column_name),
    sequenceName: String(row.sequence_name),
    fullSequenceName: row.full_sequence_name ? String(row.full_sequence_name) : null
  }));
}

export async function getRowCounts(pool, tableNames) {
  const output = {};
  for (const tableName of tableNames) {
    const safe = tableName.replace(/"/g, '""');
    const result = await pool.query(`select count(*)::bigint as count from "${safe}"`);
    output[tableName] = Number(result.rows[0]?.count ?? 0);
  }
  return output;
}
