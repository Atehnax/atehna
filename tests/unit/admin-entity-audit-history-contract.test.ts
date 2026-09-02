import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const source = (path: string) =>
  readFileSync(resolve(process.cwd(), path), 'utf8');

const drawer = source('src/admin/components/AuditHistoryDrawer.tsx');
const orderDetail = source(
  'src/admin/features/orders/components/AdminOrderDetailClient.tsx'
);
const quoteDetail = source(
  'src/admin/features/quotes/components/AdminQuoteDetailClient.tsx'
);
const quoteTimeline = source(
  'src/admin/features/quotes/components/AdminQuoteActivityTimeline.tsx'
);
const auditEventsRoute = source('src/admin/api/audit-events/route.ts');
const quoteServer = source('src/shared/server/quotes.ts');
const quoteEventsRoute = source(
  'src/admin/api/quote-requests/[quoteRequestId]/events/route.ts'
);
const quoteEventsWrapper = source(
  'src/app/api/admin/quote-requests/[quoteRequestId]/events/route.ts'
);

test('entity audit drawer loads every retained audit event and exposes an accessible dialog', () => {
  assert.match(drawer, /page_size: normalizedEntityId \? 'all' : '100'/u);
  assert.match(drawer, /triggerLabel\?: string/u);
  assert.match(drawer, /aria-haspopup="dialog"/u);
  assert.match(drawer, /aria-expanded=\{open\}/u);
  assert.match(drawer, /role="dialog"/u);
  assert.match(drawer, /aria-modal="true"/u);
  assert.match(drawer, /aria-labelledby=\{titleId\}/u);
  assert.match(drawer, /aria-describedby=\{descriptionId\}/u);
  assert.match(drawer, /event\.key === 'Escape'/u);
  assert.match(drawer, /event\.key !== 'Tab'/u);
  assert.match(drawer, /closeButtonRef\.current\?\.focus\(\)/u);
  assert.match(drawer, /restoreTarget\.focus\(\)/u);
  assert.match(drawer, /aria-expanded=\{expanded\}/u);
  assert.match(drawer, /<caption className="sr-only">/u);
  assert.match(drawer, /role="status" aria-live="polite"/u);
  assert.match(drawer, /role="alert"/u);
  assert.match(drawer, /payload\.warning/u);
  assert.match(drawer, /setEvents\(\[\]\)/u);
  assert.match(drawer, /createPortal\(/u);
  assert.match(drawer, /document\.body/u);
  assert.match(drawer, /className="hidden sm:inline"/u);
  assert.match(
    auditEventsRoute,
    /const AUDIT_RESPONSE_HEADERS = \{[\s\S]*?'Cache-Control': 'private, no-store'[\s\S]*?\} as const/u
  );
  assert.match(
    auditEventsRoute,
    /NextResponse\.json\(result, \{ headers: AUDIT_RESPONSE_HEADERS \}\)/u
  );
  assert.match(
    auditEventsRoute,
    /warning: 'Dnevnika sprememb trenutno ni mogoče naložiti, ker baza ni dosegljiva\.'[\s\S]*?\{ headers: AUDIT_RESPONSE_HEADERS \}/u
  );
  assert.match(
    auditEventsRoute,
    /parsedBody\.response\.headers\.set\('Cache-Control', AUDIT_RESPONSE_HEADERS\['Cache-Control'\]\)/u
  );
  assert.match(
    auditEventsRoute,
    /\{ success: true, \.\.\.result \},[\s\S]*?\{ headers: AUDIT_RESPONSE_HEADERS \}/u
  );
});

test('order and quote headers expose the same icon-only audit action with exact entity filters', () => {
  assert.match(
    orderDetail,
    /<AuditHistoryDrawer[\s\S]*?entityType="order"[\s\S]*?entityId=\{orderId\}[\s\S]*?entityLabel=\{displayOrderNumber\}/u
  );
  assert.doesNotMatch(orderDetail, /auditHistoryOpen|setAuditHistoryOpen/u);
  assert.doesNotMatch(orderDetail, /triggerLabel=/u);
  assert.match(
    quoteDetail,
    /<AuditHistoryDrawer[\s\S]*?entityType="system"[\s\S]*?entityId=\{'quote:' \+ detail\.id\}[\s\S]*?entityLabel=\{'Povpraševanje ' \+ detail\.requestNumber\}/u
  );
  assert.doesNotMatch(quoteDetail, /triggerLabel=/u);
});

test('quote Dnevnik reloads every authoritative quote_event without duplicate audit rows', () => {
  assert.match(
    quoteServer,
    /fetchAdminQuoteEvents[\s\S]*?from quote_events[\s\S]*?where quote_request_id = \$1[\s\S]*?order by occurred_at desc, id desc/u
  );
  assert.match(
    quoteDetail,
    /loadAuditEvents=\{false\}[\s\S]*?workflowEventsUrl=\{`\/api\/admin\/quote-requests\/\$\{detail\.id\}\/events`\}/u
  );
  assert.match(quoteDetail, /workflowEventLabels=\{QUOTE_EVENT_LABELS\}/u);
  assert.match(quoteDetail, /workflowHeading="Celoten potek ponudbe"/u);
  assert.match(drawer, /visibleWorkflowEvents\.map\(\(event, index\) =>/u);
  assert.match(drawer, /fetch\(workflowEventsUrl/u);
  assert.doesNotMatch(drawer, /selectQuoteProgressEvents/u);
  assert.match(quoteEventsRoute, /hasValidQuoteAdminSession\(request\)/u);
  assert.match(quoteEventsRoute, /fetchAdminQuoteEvents\(quoteRequestId\)/u);
  assert.match(quoteEventsRoute, /'Cache-Control': 'private, no-store'/u);
  assert.match(
    quoteEventsWrapper,
    /export \* from '@\/admin\/api\/quote-requests\/\[quoteRequestId\]\/events\/route'/u
  );

  for (const eventType of [
    'draft_changed',
    'quote_request_details_changed',
    'offer_preview_generated',
    'quote_email_provider_accepted',
    'quote_email_provider_failed',
    'acceptance_attempted',
    'customer_acceptance_attempted'
  ]) {
    assert.match(quoteTimeline, new RegExp(eventType, 'u'));
  }
});

test('complete history remains separate from both compact header timeline components', () => {
  assert.match(orderDetail, /<AdminOrderActivityCard/u);
  assert.match(
    quoteDetail,
    /<AdminQuoteActivityTimeline events=\{detail\.events\} \/>/u
  );
  assert.doesNotMatch(
    drawer,
    /AdminOrderActivityCard|AdminQuoteActivityTimeline|selectQuoteProgressEvents/u
  );
});
