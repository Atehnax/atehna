import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const source = (path: string) =>
  readFileSync(resolve(process.cwd(), path), 'utf8');

test('manual admin intake is authenticated, attributed, non-binding, and has no customer delivery side effects', () => {
  const route = source('src/admin/api/quote-requests/route.ts');
  const commerce = source('src/shared/server/orderCommerce.ts');
  const wrapper = source('src/app/api/admin/quote-requests/route.ts');

  assert.match(route, /export async function POST/u);
  assert.match(route, /isQuoteAdminEnabled\(\)/u);
  assert.match(route, /hasValidQuoteAdminSession\(request\)/u);
  assert.match(route, /status: 401/u);
  assert.match(route, /readRequiredJsonRecord\(request\)/u);
  assert.match(route, /INTAKE_SOURCES = new Set\(\['admin_email', 'admin_testing'\]\)/u);
  assert.match(route, /parsed\.body\.intakeSource \?\? 'admin_email'/u);
  assert.match(route, /insert into quote_requests/u);
  assert.match(route, /estimate_json, intake_source, state_version/u);
  assert.match(route, /insert into quote_request_items/u);
  assert.match(route, /catalogItemId: number \| null/u);
  assert.match(route, /catalogVariantId: number \| null/u);
  assert.match(route, /loadAuthoritativeManualQuoteCatalogSnapshot/u);
  assert.match(route, /catalogItemId: input\.requestedItem\.catalogItemId/u);
  assert.match(route, /sku: input\.requestedItem\.sku/u);
  assert.match(
    commerce,
    /loadAuthoritativeManualQuoteCatalogSnapshot[\s\S]*?lockVariants: true[\s\S]*?false/u
  );
  assert.match(commerce, /if \(!enforceOrderability\) return/u);
  assert.match(commerce, /'CATALOG_SELECTION_MISMATCH'/u);
  assert.match(commerce, /productStatus: row\.product_status/u);
  assert.match(commerce, /variantStatus: row\.variant_status/u);
  assert.match(commerce, /categoryIsActive: row\.category_is_active/u);
  assert.match(commerce, /minimumOrderMet:/u);
  assert.match(commerce, /stockSufficient:/u);
  assert.match(commerce, /stockReserved: false/u);
  assert.match(route, /await insertCatalogRequestItem/u);
  assert.match(route, /await insertManualRequestItem/u);
  assert.match(route, /source: 'manual_intake'/u);
  assert.match(route, /pricingStatus: 'pending_admin_entry'/u);
  assert.match(route, /status: 'manual_quote'/u);
  assert.match(route, /nonBinding: true/u);
  assert.match(route, /eventType: 'request_received'/u);
  assert.match(route, /actorType: 'admin'/u);
  assert.match(route, /source: input\.intakeSource/u);
  assert.match(route, /manualIntake: true/u);
  assert.match(route, /customerAccessIssued: false/u);
  assert.match(route, /customerEmailQueued: false/u);
  assert.match(route, /insertAuditEventForRequest/u);
  assert.match(route, /revalidateAdminQuotePaths\(quoteRequestId\)/u);

  assert.doesNotMatch(route, /insert into quote_access_tokens/iu);
  assert.doesNotMatch(route, /insert into quote_email_jobs/iu);
  assert.doesNotMatch(route, /enqueueQuoteEmail|scheduleQuoteEmailJobs/u);
  assert.doesNotMatch(route, /insert into\s+orders\b/iu);
  assert.match(wrapper, /export \{ POST \} from '@\/admin\/api\/quote-requests\/route'/u);
});

test('manual intake accepts incomplete addresses but issuance requires a complete customer snapshot', () => {
  const route = source('src/admin/api/quote-requests/route.ts');
  const create = source(
    'src/admin/features/quotes/components/AdminCreateManualQuoteRequestButton.tsx'
  );
  const detailsRoute = source(
    'src/admin/api/quote-requests/[quoteRequestId]/details/route.ts'
  );
  const detailClient = source(
    'src/admin/features/quotes/components/AdminQuoteDetailClient.tsx'
  );
  const issue = source(
    'src/admin/api/quote-requests/[quoteRequestId]/issue/route.ts'
  );

  assert.match(route, /addressLine1: string \| null/u);
  assert.match(route, /postalCode: string \| null/u);
  assert.match(route, /city: string \| null/u);
  assert.match(route, /const addressLine1 = nullableText/u);
  assert.match(route, /postalCode !== null && !POSTAL_CODE_PATTERN\.test\(postalCode\)/u);
  assert.doesNotMatch(route, /\|\| !addressLine1/u);
  assert.doesNotMatch(route, /\|\| !city/u);

  assert.match(create, /Neobvezni ob vnosu · obvezni pred izdajo ponudbe/u);
  assert.match(create, /addressLine1: addressLine1 \|\| null/u);
  assert.match(create, /postalCode: postalCode \|\| null/u);
  assert.match(create, /city: city \|\| null/u);
  assert.match(create, /if \(postalCode && !isValidPostalCode\(postalCode\)\)/u);

  assert.match(
    detailsRoute,
    /postalCode !== null && !POSTAL_CODE_PATTERN\.test\(postalCode\)/u
  );
  assert.doesNotMatch(detailsRoute, /!addressLine1 \|\| !city/u);
  assert.match(
    detailClient,
    /draftRequestDetails\.postalCode\.trim\(\)[\s\S]*?\^\\d\{4\}\$/u
  );
  assert.doesNotMatch(detailClient, /Naslov in kraj sta obvezna/u);

  assert.match(issue, /QUOTE_CUSTOMER_DETAILS_INCOMPLETE/u);
  assert.match(issue, /Boolean\(addressLine1\)/u);
  assert.match(issue, /POSTAL_CODE_PATTERN\.test\(postalCode\)/u);
  assert.match(issue, /Boolean\(city\)/u);
  assert.match(issue, /countryCode === 'SI'/u);
});

test('admin delete is a lifecycle-guarded logical void and never deletes the quote record', () => {
  const route = source(
    'src/admin/api/quote-requests/[quoteRequestId]/route.ts'
  );
  const wrapper = source(
    'src/app/api/admin/quote-requests/[quoteRequestId]/route.ts'
  );

  assert.match(route, /export async function DELETE/u);
  assert.match(route, /isQuoteAdminEnabled\(\)/u);
  assert.match(route, /hasValidQuoteAdminSession\(request\)/u);
  assert.match(route, /status: 401/u);
  assert.match(route, /lockQuoteWorkflow\(client, quoteRequestId\)/u);
  assert.match(route, /from quote_requests[\s\S]*?where id = \$1[\s\S]*?for update/u);
  assert.match(route, /expectedStateVersion/u);
  assert.match(route, /code: 'QUOTE_REQUEST_STALE'[\s\S]*?status: 409/u);
  assert.match(route, /\['received', 'in_preparation'\]\.includes/u);
  assert.match(route, /code: 'QUOTE_REQUEST_VOID_BLOCKED'[\s\S]*?status: 409/u);
  assert.match(route, /current\.intake_source === 'admin_testing'/u);
  assert.match(route, /has_purchase_order_document/u);
  assert.match(route, /hasCustomerCommitment/u);

  for (const commercialHistoryGuard of [
    'has_non_draft_offer',
    'has_document',
    'has_document_job',
    'has_acceptance',
    'has_linked_order'
  ]) {
    assert.match(route, new RegExp(`\\b${commercialHistoryGuard}\\b`, 'u'));
  }
  assert.match(route, /update quote_requests[\s\S]*?set voided_at = now\(\)/u);
  assert.match(route, /voided_by_actor_id = \$2/u);
  assert.match(route, /void_reason = \$3/u);
  assert.match(route, /state_version = state_version \+ 1/u);
  assert.match(route, /update quote_access_tokens[\s\S]*?set revoked_at = now\(\)/u);
  assert.match(route, /update quote_email_verifications[\s\S]*?status = 'expired'/u);
  assert.match(route, /update quote_email_jobs[\s\S]*?failureKind', 'voided_request'/u);
  assert.match(route, /update quote_document_jobs job[\s\S]*?status = 'completed'/u);
  assert.match(route, /eventType: 'request_voided'/u);
  assert.match(route, /actorType: 'admin'/u);
  assert.match(route, /logicalDelete: true/u);
  assert.match(route, /insertAuditEventForRequest/u);
  assert.match(route, /revalidateAdminQuotePaths\(quoteRequestId\)/u);
  assert.doesNotMatch(route, /delete\s+from\s+quote_requests/iu);
  assert.match(
    wrapper,
    /export \{ DELETE \} from '@\/admin\/api\/quote-requests\/\[quoteRequestId\]\/route'/u
  );
});

test('voided quote requests are excluded from the list, new badge, detail, and analytics', () => {
  const quotes = source('src/shared/server/quotes.ts');
  const analytics = source('src/shared/server/quoteAnalytics.ts');

  assert.match(quotes, /const conditions = \[[\s\S]*?'qr\.voided_at is null'/u);
  assert.match(quotes, /status = 'received' and voided_at is null/u);
  assert.match(
    quotes,
    /fetchAdminQuoteDetail[\s\S]*?where qr\.id = \$1[\s\S]*?and qr\.voided_at is null/u
  );
  assert.match(
    analytics,
    /from quote_requests request[\s\S]*?and request\.voided_at is null/u
  );
});

test('schema and migration preserve quote durability and void evidence', () => {
  const schema = source('database/schema.sql');
  const migration = source(
    'database/migrations/20260829_quote_request_management.sql'
  );

  for (const contents of [schema, migration]) {
    assert.match(contents, /intake_source/u);
    assert.match(contents, /admin_email/u);
    assert.match(contents, /admin_testing/u);
    assert.match(contents, /voided_at/u);
    assert.match(contents, /voided_by_actor_id/u);
    assert.match(contents, /void_reason/u);
    assert.match(contents, /request_voided/u);
    assert.match(contents, /Quote requests are durable records and cannot be deleted/u);
    assert.match(contents, /explicitly tagged test request can be voided/u);
    assert.match(contents, /customer acceptance, purchase-order evidence, or linked orders cannot be voided/u);
    assert.match(contents, /Non-test quote requests with commercial history cannot be voided/u);
  }
});

test('archived quote requests cannot race external email or document delivery', () => {
  const emailJobs = source('src/shared/server/quoteEmailJobs.ts');
  const documentJobs = source('src/shared/server/quoteDocumentJobs.ts');
  const lifecycleJobs = source('src/shared/server/quoteLifecycleJobs.ts');

  assert.match(emailJobs, /deliverQuoteEmailWhileActive/u);
  assert.match(emailJobs, /lockQuoteWorkflow\(client, job\.requestId\)/u);
  assert.match(emailJobs, /select voided_at from quote_requests/u);
  assert.match(emailJobs, /failureKind: 'voided_request'/u);
  assert.match(documentJobs, /lockQuoteWorkflow\(client, quoteRequestId\)/u);
  assert.match(documentJobs, /request\.voided_at/u);
  assert.match(documentJobs, /\[voided_request\]/u);
  assert.match(lifecycleJobs, /request\.voided_at is null/u);
});

test('stale admin lifecycle mutations return a conflict for archived requests', () => {
  for (const routePath of [
    'src/admin/api/quote-requests/[quoteRequestId]/withdraw/route.ts',
    'src/admin/api/quote-requests/[quoteRequestId]/revise/route.ts',
    'src/admin/api/quote-requests/[quoteRequestId]/preview/route.ts',
    'src/admin/api/quote-requests/[quoteRequestId]/issue/route.ts',
    'src/admin/api/quote-requests/[quoteRequestId]/draft/route.ts',
    'src/admin/api/quote-requests/[quoteRequestId]/clarification/route.ts',
    'src/admin/api/quote-requests/[quoteRequestId]/close/route.ts',
    'src/admin/api/quote-requests/[quoteRequestId]/details/route.ts',
    'src/admin/api/quote-requests/[quoteRequestId]/status/route.ts',
    'src/admin/api/quote-requests/[quoteRequestId]/documents/route.ts'
  ]) {
    const route = source(routePath);
    assert.match(route, /voided_at/u, `${routePath} must inspect voided_at`);
    assert.match(route, /code: 'QUOTE_REQUEST_VOIDED'/u, `${routePath} must return the void conflict code`);
    assert.match(route, /status: 409/u, `${routePath} must return HTTP 409`);
  }
});

test('quote table exposes manual create and confirmed row or bulk removal controls', () => {
  const create = source(
    'src/admin/features/quotes/components/AdminCreateManualQuoteRequestButton.tsx'
  );
  const table = source(
    'src/admin/features/quotes/components/AdminQuotesTable.tsx'
  );

  assert.match(create, /data-testid="quote-table-create-request"/u);
  assert.match(create, /Novo povpraševanje/u);
  assert.match(create, /fetch\('\/api\/admin\/quote-requests', \{/u);
  assert.match(create, /method: 'POST'/u);
  assert.match(create, /intakeSource:/u);
  assert.match(create, /requestedItems:/u);
  assert.match(create, /productName:/u);
  assert.match(create, /quantity:/u);
  assert.match(create, /router\.push\(`\/admin\/orders\/quotes\/\$\{quoteRequestId\}`\)/u);

  assert.match(table, /<AdminCreateManualQuoteRequestButton \/>/u);
  assert.match(table, /data-testid="quote-table-delete-selected"/u);
  assert.match(table, /key: 'delete'/u);
  assert.match(table, /fetch\(`\/api\/admin\/quote-requests\/\$\{rowId\}`, \{/u);
  assert.match(table, /method: 'DELETE'/u);
  assert.match(table, /response\.status === 409/u);
  assert.match(table, /<LazyConfirmDialog/u);
  assert.match(table, /confirmLabel="Izbriši"/u);
  assert.match(table, /isDanger/u);
  assert.match(table, /Ali ste prepričani, da želite izbrisati/u);
  assert.match(table, /router\.refresh\(\)/u);
});
