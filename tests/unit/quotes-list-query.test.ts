import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import test from 'node:test';
import ts from 'typescript';
import * as quoteTypes from '@/shared/domain/quote/quoteAdminTypes';
import * as publicCodes from '@/shared/domain/commercePublicCode';
import type { fetchAdminQuoteRequestsPage } from '@/shared/server/quotes';

const compiled = ts.transpileModule(
  readFileSync(resolve('src/shared/server/quotes.ts'), 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }
).outputText;

function createLoader(metadata = { total_count: 31, new_count: 7, latest_created_at: '2026-09-07T09:00:00Z' } as Record<string, unknown>, error?: Error) {
  const queries: { sql: string; params: unknown[] }[] = [];
  const dependencies: Record<string, unknown> = {
    '@/shared/server/db': { getPool: async () => ({ query: async (sql: string, params: unknown[] = []) => {
      assert.match(sql.trim(), /^select\s/u);
      queries.push({ sql, params: [...params] });
      if (error && sql.includes('as total_count')) throw error;
      return { rows: sql.includes('as total_count') ? [metadata] : [] };
    } }) },
    '@/shared/server/diagnostics/instrumentation': { instrumentCatalogLoader: (_name: string, _route: string, task: () => unknown) => task() },
    '@/shared/domain/quote/quoteAdminTypes': quoteTypes,
    '@/shared/domain/commercePublicCode': publicCodes,
    '@/shared/domain/order/manualDraftCustomer': {},
    '@/shared/domain/order/customerIdentity': {},
    '@/shared/domain/quote/quoteEmailSettings': {},
    '@/shared/domain/quote/quoteEmailRetryEligibility': {},
    '@/shared/server/orderEmailSettings': {}
  };
  const exports: { fetchAdminQuoteRequestsPage?: typeof fetchAdminQuoteRequestsPage } = {};
  runInNewContext(compiled, { exports, require(id: string) { assert.ok(id in dependencies, `Unexpected dependency: ${id}`); return dependencies[id]; } });
  return { list: exports.fetchAdminQuoteRequestsPage!, queries };
}

function assertBindings({ sql, params }: { sql: string; params: unknown[] }) {
  const slots = [...new Set([...sql.matchAll(/\$(\d+)/gu)].map(match => Number(match[1])))].sort((a,b)=>a-b);
  assert.deepEqual(slots, Array.from({length:params.length},(_,i)=>i+1));
}

test('an empty or out-of-range quote page keeps filtered totals and global notification metadata', async () => {
  const loader = createLoader();
  const result = await loader.list({ query: 'not on this page', page: 4, pageSize: 10 });
  assert.equal(result.rows.length, 0);
  assert.equal(result.totalCount, 31);
  assert.equal(result.newCount, 7);
  assert.equal(result.latestCreatedAt, '2026-09-07T09:00:00Z');
  assert.equal(loader.queries.length, 2);
  const [rows, metadata] = loader.queries;
  assert.deepEqual(rows.params, ['%not on this page%', 10, 30]);
  assert.deepEqual(metadata.params, ['%not on this page%']);
  assert.match(metadata.sql, /select count\(\*\)::int from quote_requests where status = 'received' and voided_at is null/u);
  assert.match(metadata.sql, /select max\(created_at\) from quote_requests where voided_at is null/u);
  assertBindings(rows);
  assertBindings(metadata);
});

test('quote metadata shares filter bindings while excluding pagination and keeping input parameterized', async () => {
  const loader = createLoader();
  const query = "O'Reilly %'; select 1 --";
  await loader.list({ query, customerType: 'company', fromDate: '2026-09-01', toDate: '2026-09-07', minRequestNumber: 10, maxRequestNumber: 50, minTotal: 0, maxTotal: 100, page: 2 });
  const [rows, metadata] = loader.queries;
  assert.deepEqual(metadata.params, rows.params.slice(0,-2));
  assert.equal(metadata.params[0], `%${query}%`);
  assert.equal(metadata.sql.includes(query), false);
  assert.match(metadata.sql, /AT TIME ZONE 'Europe\/Ljubljana'/u);
  assert.match(metadata.sql, /qr.customer_type = \$4/u);
  assert.match(metadata.sql, /amount_filter_offer.is_current desc/u);
  assert.match(metadata.sql, /qr.voided_at is null/u);
  assert.doesNotMatch(metadata.sql, /offset \$|limit \$/u);
  loader.queries.forEach(assertBindings);
});

test('an empty quote database preserves zero counts and a missing latest timestamp', async () => {
  const result = await createLoader({ total_count: 0, new_count: 0, latest_created_at: null }).list();
  assert.equal(result.totalCount, 0);
  assert.equal(result.newCount, 0);
  assert.equal(result.latestCreatedAt, null);
});

test('quote metadata failures remain failures instead of being returned as zero counts', async () => {
  const failure = new Error('database unavailable');
  await assert.rejects(createLoader(undefined, failure).list(), error => error === failure);
});
