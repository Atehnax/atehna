import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const source = (path: string) =>
  readFileSync(resolve(process.cwd(), path), 'utf8');

test('invoice and pro forma delivery uses an explicit confirmation-protected action', () => {
  const manager = source(
    'src/admin/features/orders/components/AdminOrderPdfManager.tsx'
  );
  assert.match(manager, /pdfType\.key === 'predracun'[\s\S]*?pdfType\.key === 'invoice'/u);
  assert.match(manager, /label: 'Pošlji stranki'/u);
  assert.match(
    manager,
    /\/api\/admin\/orders\/\$\{orderId\}\/documents\/\$\{document\.id\}\/email/u
  );
  assert.match(manager, /handleConfirmationRequired/u);
  assert.match(manager, /CustomerEmailConfirmationDialog/u);

  const generator = source('src/admin/api/orders/generateOrderDocumentRoute.ts');
  assert.doesNotMatch(generator, /enqueueOrderEmailEvent|scheduleOrderEmailJobs/u);
});

test('document email route pins the exact current immutable PDF', () => {
  const route = source(
    'src/admin/api/orders/[orderId]/documents/[documentId]/email/route.ts'
  );
  assert.match(route, /document\.id = \$2[\s\S]*?document\.order_id = \$1/u);
  assert.match(route, /document\.deleted_at is null/u);
  assert.match(route, /row\.legal_status !== 'operational'/u);
  assert.match(route, /row\.format_marker !== 'atehna-template-pdf-v3'/u);
  assert.match(
    route,
    /row\.order_pricing_revision[\s\S]*?row\.pricing_revision[\s\S]*?row\.order_delivery_plan_revision[\s\S]*?row\.delivery_plan_revision/u
  );
  assert.match(route, /requireOrderCustomerEmailConfirmation/u);
  assert.match(route, /normalizeOrderEmailPdfDocumentReference/u);
  assert.match(route, /documentId,[\s\S]*?contentSha256:[\s\S]*?filename:/u);
  assert.match(route, /enqueueOrderEmailEvent\([\s\S]*?pdfDocument/u);
  assert.match(route, /scheduleOrderEmailJobs/u);
});

test('database accepts the two explicit document-email event types', () => {
  const migration = source(
    'database/migrations/20260903_order_document_email_events.sql'
  );
  assert.match(migration, /'predracun_issued'/u);
  assert.match(migration, /'invoice_issued'/u);
  assert.match(migration, /order_email_jobs_event_type_check/u);
});
