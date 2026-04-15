#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { ensureOutputDir, timestampForFile, writeJson } from './common.mjs';

const execFileAsync = promisify(execFile);

const TABLE_COLUMNS_TO_CHECK = {
  orders: ['id', 'order_number', 'customer_type', 'status', 'payment_status', 'payment_notes', 'is_draft', 'deleted_at'],
  order_items: ['id', 'order_id', 'sku', 'name', 'quantity', 'unit_price', 'total_price'],
  order_documents: ['id', 'order_id', 'type', 'filename', 'blob_url', 'blob_pathname', 'deleted_at'],
  order_attachments: ['id', 'order_id', 'type', 'filename', 'blob_url'],
  order_payment_logs: ['id', 'order_id', 'previous_status', 'new_status', 'note'],
  deleted_archive_entries: ['id', 'item_type', 'order_id', 'document_id', 'payload', 'deleted_at', 'expires_at'],
  catalog_categories: ['id', 'parent_id', 'slug', 'title', 'summary', 'description', 'image', 'admin_notes', 'banner_image', 'items', 'position', 'status']
};

const MUST_REMAIN = [
  {
    item: 'catalog_categories table and all structure columns',
    reason: 'Backs category hierarchy/pages/admin categories and artikel storage payload.',
    domain: 'artikli/categories'
  },
  {
    item: 'orders, order_items',
    reason: 'Required by create/edit order workflow and admin order detail/list pages.',
    domain: 'orders'
  },
  {
    item: 'order_documents',
    reason: 'Required for current PDF generation/document listing/download flows.',
    domain: 'orders/arhiv'
  },
  {
    item: 'deleted_archive_entries',
    reason: 'Required by current /admin/arhiv flow.',
    domain: 'arhiv'
  }
];

const PROVEN_REMOVABLE_CANDIDATES = [
  {
    item: 'Legacy fallback from local file catalog for DB outages (production DB-backed mode)',
    reason: 'Not directly required when database is healthy, but keep unless infrastructure policy changes.',
    filesLikelyInvolved: ['src/shared/server/catalogCategories.ts', 'src/shared/server/catalogAdmin.ts']
  }
];

const LIKELY_REMOVABLE_AFTER_PURGE = [
  {
    item: 'Order schema compatibility checks for missing columns (is_draft/deleted_at/payment_*)',
    reason: 'If DB is fully migrated and historical compatibility is no longer needed, dynamic checks can be simplified.',
    filesLikelyInvolved: ['src/shared/server/orders.ts']
  },
  {
    item: 'Archive fallback path that reconstructs entries from soft-deleted rows when deleted_archive_entries table missing',
    reason: 'Compatibility bridge for older schema state.',
    filesLikelyInvolved: ['src/shared/server/deletedArchive.ts']
  },
  {
    item: 'Try/catch fallback insert/query branches that omit newer columns',
    reason: 'Backward compatibility for partial schema deployments.',
    filesLikelyInvolved: ['src/commercial/api/orders/route.ts', 'src/admin/api/orders/[orderId]/documents/route.ts']
  }
];

async function rgJson(pattern) {
  const { stdout } = await execFileAsync('rg', ['-n', '--no-heading', '--color', 'never', '--json', pattern, 'src', 'migrations']);
  const lines = stdout.split('\n').filter(Boolean);
  const matches = [];

  for (const line of lines) {
    let parsed;
    try {
      parsed = JSON.parse(line);
    } catch {
      continue;
    }

    if (parsed.type !== 'match') continue;
    matches.push({
      file: parsed.data.path.text,
      line: parsed.data.line_number,
      text: parsed.data.lines.text.trim()
    });
  }

  return matches;
}

async function collectUsageMap() {
  const usage = {};

  for (const [table, columns] of Object.entries(TABLE_COLUMNS_TO_CHECK)) {
    const tableMatches = await rgJson(`\\b${table}\\b`);
    const columnMatches = {};

    for (const column of columns) {
      columnMatches[column] = await rgJson(`\\b${column}\\b`);
    }

    usage[table] = {
      tableMatches,
      columnMatches
    };
  }

  return usage;
}

async function main() {
  const outputDir = await ensureOutputDir('reports');
  const timestamp = timestampForFile();
  const usage = await collectUsageMap();

  const report = {
    generatedAt: new Date().toISOString(),
    scope: 'Static code/schema usage audit for post-purge cleanup decisions',
    usage,
    candidates: {
      provenRemovable: PROVEN_REMOVABLE_CANDIDATES,
      likelyRemovableNotProven: LIKELY_REMOVABLE_AFTER_PURGE,
      mustRemain: MUST_REMAIN
    },
    methodology: [
      'Searched src/ and migrations/ with ripgrep JSON output for table and column references.',
      'Classified compatibility layers conservatively: only mark as likely removable when tied to legacy fallback behavior.',
      'Do not remove anything in mustRemain until create/edit workflows for artikli, orders, and arhiv pass smoke checks.'
    ]
  };

  const filePath = path.join(outputDir, `${timestamp}.post-purge-legacy-audit.json`);
  await writeJson(filePath, report);

  const markdownPath = path.join(outputDir, `${timestamp}.post-purge-legacy-audit.md`);
  const lines = [];
  lines.push('# Post-purge legacy audit');
  lines.push('');
  lines.push(`Generated: ${report.generatedAt}`);
  lines.push('');
  lines.push('## Likely removable (not yet proven)');
  for (const candidate of LIKELY_REMOVABLE_AFTER_PURGE) {
    lines.push(`- ${candidate.item}: ${candidate.reason}`);
    lines.push(`  - Files: ${candidate.filesLikelyInvolved.join(', ')}`);
  }
  lines.push('');
  lines.push('## Must remain');
  for (const item of MUST_REMAIN) {
    lines.push(`- ${item.item}: ${item.reason}`);
  }
  lines.push('');
  lines.push('## Usage snapshot');
  for (const [table, summary] of Object.entries(usage)) {
    lines.push(`- ${table}: ${summary.tableMatches.length} table-name reference matches`);
  }
  lines.push('');
  await fs.writeFile(markdownPath, `${lines.join('\n')}\n`, 'utf8');

  console.log(`Post-purge legacy audit report written: ${filePath}`);
  console.log(`Post-purge legacy audit markdown: ${markdownPath}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
