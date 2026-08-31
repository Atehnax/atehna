import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const source = (path: string) =>
  readFileSync(resolve(process.cwd(), path), 'utf8');

test('quote customer lookup reuses the canonical order-directory identity', () => {
  const directory = source('src/shared/server/customerDirectory.ts');

  assert.match(directory, /const customerDirectoryIdentityKeySql/u);
  assert.match(
    directory,
    /relation: 'normalized_orders',[\s\S]*?fallbackPrefix: 'order'/u
  );
  assert.match(
    directory,
    /relation: 'normalized_quote_request',[\s\S]*?fallbackPrefix: 'quote-request'/u
  );
  assert.match(
    directory,
    /from quote_requests as request_record[\s\S]*?where request_record\.id = \$1[\s\S]*?request_record\.voided_at is null/u
  );
  assert.match(
    directory,
    /visible_rows\.id = md5\(identified_quote_request\.customer_key\)/u
  );
  assert.match(
    directory,
    /fetchCustomerDirectoryRowForQuoteRequest\([\s\S]*?customerDirectoryForQuoteRequestSql,[\s\S]*?\[quoteRequestId\]/u
  );
  assert.match(directory, /return row \? mapCustomerDirectoryRow\(row\) : null/u);
});

test('quote customer endpoint is guarded, request-scoped, private, and app-routed', () => {
  const route = source(
    'src/admin/api/quote-requests/[quoteRequestId]/customer/route.ts'
  );
  const appRoute = source(
    'src/app/api/admin/quote-requests/[quoteRequestId]/customer/route.ts'
  );

  assert.match(route, /isQuoteAdminEnabled\(\)/u);
  assert.match(route, /hasValidQuoteAdminSession\(request\)/u);
  assert.match(route, /status: 401/u);
  assert.match(route, /positiveInteger\(rawQuoteRequestId\)/u);
  assert.match(
    route,
    /fetchCustomerDirectoryRowForQuoteRequest\([\s\S]*?quoteRequestId[\s\S]*?\)/u
  );
  assert.match(route, /Stranka za to povpraševanje ni bila najdena/u);
  assert.match(route, /isDatabaseUnavailableError\(error\) \? 503 : 500/u);
  assert.match(route, /Cache-Control': 'no-store'/u);
  assert.match(
    appRoute,
    /admin\/api\/quote-requests\/\[quoteRequestId\]\/customer\/route/u
  );
});
