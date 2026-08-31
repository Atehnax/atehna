import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const source = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

test('order submission atomically enqueues email before commit and dispatches after commit', () => {
  const route = source('src/commercial/api/orders/route.ts');
  const tokenIssueIndex = route.indexOf(
    'const accessToken = await issueOrderAccessToken(client, inserted.orderId, {'
  );
  const enqueueIndex = route.indexOf('await enqueueOrderEmailEvent(client, {');
  const commitIndex = route.indexOf("await client.query('commit');", enqueueIndex);
  const scheduleIndex = route.indexOf('scheduleOrderEmailJobs(pool, inserted.orderId);');

  assert.ok(enqueueIndex > 0, 'submission must enqueue an email event');
  assert.ok(
    tokenIssueIndex > 0 && tokenIssueIndex < enqueueIndex,
    'the one persisted access token must be issued before the immutable email snapshot'
  );
  assert.ok(commitIndex > enqueueIndex, 'email enqueue must be committed with the order');
  assert.ok(scheduleIndex > commitIndex, 'provider dispatch must only be scheduled after commit');
  assert.match(route, /eventKey: `order-submitted:\$\{inserted\.orderId\}`/u);
  assert.match(route, /eventType: 'order_submitted'/u);
  assert.match(
    route,
    /customer\.customerType === 'school'[\s\S]*?\['confirmation', 'purchase_order'\][\s\S]*?: \['confirmation'\]/u
  );
  assert.match(
    route,
    /customerOrderAccessToken:\s*customer\.customerType === 'school' \? accessToken\.token : null/u
  );

  const replayScheduleIndex = route.indexOf(
    'scheduleOrderEmailJobs(pool, reservation.orderId);'
  );
  assert.ok(replayScheduleIndex > 0, 'idempotent replay must retrigger pending jobs');
  const replayBranch = route.slice(route.indexOf("if (reservation.kind === 'replay')"), route.indexOf('const quote ='));
  assert.doesNotMatch(replayBranch, /enqueueOrderEmailEvent/u);
});

test('status transitions serialize mutation, log, audit, and email enqueue in one transaction', () => {
  const route = source('src/admin/api/orders/[orderId]/status/route.ts');

  assert.match(
    route,
    /select[\s\S]*?id,[\s\S]*?order_number,[\s\S]*?status,[\s\S]*?customer_type,[\s\S]*?commitment_status,[\s\S]*?shipping_override_stale,[\s\S]*?from orders[\s\S]*?where id = \$1[\s\S]*?for update/u
  );
  assert.match(route, /const changed = previousStatus !== status;/u);
  assert.match(
    route,
    /if \(changed\) \{[\s\S]*?update orders set status[\s\S]*?insert into order_status_logs[\s\S]*?returning id, created_at[\s\S]*?if \(shouldEnqueueStatusEmail\)[\s\S]*?enqueueOrderEmailEvent\(client,[\s\S]*?insertAuditEventForRequest\([\s\S]*?client[\s\S]*?\n\s*\);[\s\S]*?\n\s*\}/u
  );
  assert.match(route, /eventKey: `order-status:\$\{statusLog\.id\}`/u);

  const enqueueIndex = route.indexOf('await enqueueOrderEmailEvent(client, {');
  const commitIndex = route.indexOf("await client.query('commit');");
  const scheduleIndex = route.indexOf('if (shouldEnqueueStatusEmail) scheduleOrderEmailJobs(pool, orderId);');
  assert.ok(enqueueIndex > 0 && enqueueIndex < commitIndex);
  assert.ok(scheduleIndex > commitIndex);
  assert.match(
    route,
    /if \(status === 'cancelled'\)[\s\S]*?shouldEnqueueStatusEmail = false/u
  );
});

test('email worker is per-recipient, idempotent, retryable, and hard-disabled in E2E', () => {
  const worker = source('src/shared/server/orderEmailJobs.ts');
  const delivery = source('src/shared/domain/order/orderEmailDelivery.ts');
  const cipher = source('src/shared/server/orderEmailDeliveryCipher.ts');
  const schema = source('database/schema.sql');

  assert.match(delivery, /ORDER_EMAIL_DELIVERY_ENVELOPE_VERSION = 2 as const/u);
  assert.match(cipher, /createCipheriv\('aes-256-gcm'/u);
  assert.match(cipher, /ADDITIONAL_AUTHENTICATED_DATA_DOMAIN/u);
  assert.match(delivery, /category: 'invalid_payload'/u);
  assert.match(worker, /if \(isOrderEmailTransportDisabledForE2e\(\)\)/u);
  assert.match(worker, /'Idempotency-Key': idempotencyKey/u);
  assert.match(worker, /`atehna-order-email\/\$\{job\.id\}`/u);
  assert.match(worker, /for update skip locked/u);
  assert.match(worker, /status = 'processing'/u);
  assert.match(worker, /MAX_ATTEMPTS = 8/u);
  assert.match(worker, /status = \$3/u);
  assert.match(worker, /on conflict do nothing/u);
  assert.match(worker, /to: \[message\.to\]/u);
  assert.match(worker, /createOrderEmailDeliveryEnvelope\(payload\)/u);
  assert.match(worker, /serializeOrderEmailDeliveryEnvelope\(envelope\)/u);
  assert.match(worker, /const jobId = randomUUID\(\)/u);
  assert.match(
    worker,
    /encryptOrderEmailDeliveryEnvelope\([\s\S]*?serializedEnvelope,[\s\S]*?jobId,[\s\S]*?input\.orderId/u
  );
  assert.match(worker, /insert into order_email_jobs \(\s*id,/u);
  assert.match(worker, /decryptOrderEmailDeliveryEnvelope\(/u);
  assert.match(worker, /parseClaimedOrderEmailEnvelope\(job\)/u);
  assert.match(worker, /sendOrderEmailMessage\(\s*envelope\.message,/u);
  const processStart = worker.indexOf('processJob: async (job) => {');
  const parseIndex = worker.indexOf(
    'const envelope = parseClaimedOrderEmailEnvelope(job);',
    processStart
  );
  const validationIndex = worker.indexOf(
    'await validatePurchaseOrderTokenBeforeDelivery(pool, job, envelope);',
    parseIndex
  );
  const sendIndex = worker.indexOf(
    'const providerMessageId = await sendOrderEmailMessage(',
    validationIndex
  );
  assert.ok(
    processStart > 0 &&
      parseIndex > processStart &&
      validationIndex > parseIndex &&
      sendIndex > validationIndex,
    'decrypt/parse and active-token validation must precede every provider request'
  );
  const tokenValidationStart = worker.indexOf(
    'async function validatePurchaseOrderTokenBeforeDelivery'
  );
  const tokenValidationEnd = worker.indexOf(
    'async function markOrderEmailJobSent',
    tokenValidationStart
  );
  const tokenValidationBody = worker.slice(
    tokenValidationStart,
    tokenValidationEnd
  );
  assert.match(tokenValidationBody, /select exists \(/u);
  assert.match(tokenValidationBody, /from order_access_tokens/u);
  assert.match(tokenValidationBody, /token_record\.token_hash = \$1/u);
  assert.match(tokenValidationBody, /token_record\.order_id = \$2/u);
  assert.match(tokenValidationBody, /\$3 = any\(token_record\.scopes\)/u);
  assert.match(tokenValidationBody, /token_record\.revoked_at is null/u);
  assert.match(tokenValidationBody, /token_record\.expires_at > now\(\)/u);
  assert.match(tokenValidationBody, /join orders email_order/u);
  assert.match(tokenValidationBody, /email_order\.customer_type = 'school'/u);
  assert.match(tokenValidationBody, /email_order\.deleted_at is null/u);
  assert.doesNotMatch(tokenValidationBody, /\bupdate\b|last_used_at/iu);
  assert.match(tokenValidationBody, /email_order\.status <> 'cancelled'/u);
  assert.match(
    tokenValidationBody,
    /email_order\.commitment_status = 'pending_confirmation'/u
  );
  assert.match(tokenValidationBody, /and not exists \(/u);
  assert.match(tokenValidationBody, /from order_documents purchase_order/u);
  assert.match(tokenValidationBody, /purchase_order\.order_id = email_order\.id/u);
  assert.match(tokenValidationBody, /purchase_order\.type = 'purchase_order'/u);
  assert.match(tokenValidationBody, /purchase_order\.deleted_at is null/u);
  assert.match(
    tokenValidationBody,
    /purchase_order\.format_marker = any\(\$4::text\[\]\)/u
  );
  assert.match(
    tokenValidationBody,
    /\[\.\.\.SCHOOL_PURCHASE_ORDER_PROOF_FORMAT_MARKERS\]/u
  );
  assert.match(
    worker,
    /if \(!job\.payloadEncrypted\) \{[\s\S]*?persistEncryptedClaimedEnvelope/u
  );
  assert.match(worker, /classifyOrderEmailDeliveryValidationFailure\(error\)/u);
  assert.match(worker, /redactOrderEmailDeliveryEnvelope\(envelope\)/u);
  assert.ok(
    worker.includes(
      ".replace(/ath_order_[A-Za-z0-9_-]{43}/gu, '[order-access-token]')"
    ),
    'persisted last_error and logs must redact every order access token'
  );
  assert.match(
    worker,
    /classification\.category === 'invalid_payload'[\s\S]*?redactOrderEmailDeliveryEnvelope\(job\.envelope\)[\s\S]*?payload_json = coalesce\(\$6::jsonb, payload_json\)/u
  );
  assert.match(worker, /classifyResendFailure/u);
  assert.match(worker, /MAX_CLAIM_SIZE = 2/u);
  assert.match(worker, /maxJobs: IMMEDIATE_MAX_JOBS/u);
  assert.match(worker, /deadlineMs: WORKER_DEADLINE_MS/u);
  assert.match(worker, /\(result\.rowCount \?\? 0\) !== 1/u);
  assert.match(worker, /isResendApiKeyConfigured\(\)/u);
  assert.match(worker, /select sku, name, unit, quantity, line_gross, image_url/u);
  assert.match(worker, /imageUrl: optionalString\(item\.image_url\)/u);
  assert.match(worker, /order: toCustomerOrderSnapshot\(order\)/u);
  const manualRetryStart = worker.indexOf(
    'export async function resetFailedOrderEmailJobs'
  );
  const manualRetryEnd = worker.indexOf(
    'export async function sendOrderEmailTest',
    manualRetryStart
  );
  const manualRetryBody = worker.slice(manualRetryStart, manualRetryEnd);
  assert.match(manualRetryBody, /set status = 'pending'/u);
  assert.doesNotMatch(manualRetryBody, /payload_json/u);
  assert.doesNotMatch(worker, /buildOrderEmailMessage\(job\./u);
  assert.doesNotMatch(worker, /\bcc\s*:|\bbcc\s*:/iu);
  assert.match(schema, /audience in \('customer', 'admin'\)/u);
});

test('cron recovery is authenticated and deployable on Vercel Hobby cadence', () => {
  const proxy = source('src/proxy.ts');
  const cronRoute = source('src/admin/api/order-email-settings/process/route.ts');
  const appCronRoute = source('src/app/api/admin/order-email-settings/process/route.ts');
  const vercelConfig = JSON.parse(source('vercel.json')) as {
    crons: Array<{ path: string; schedule: string }>;
  };
  const cron = vercelConfig.crons.find(
    (entry) => entry.path === '/api/admin/order-email-settings/process'
  );

  assert.ok(cron);
  assert.equal(cron.schedule, '40 3 * * *');
  assert.match(proxy, /pathname === '\/api\/admin\/order-email-settings\/process'/u);
  assert.match(cronRoute, /request\.headers\.get\('authorization'\) !== `Bearer \$\{cronSecret\}`/u);
  assert.match(cronRoute, /maxJobs: 100/u);
  assert.match(cronRoute, /deadlineMs: 45_000/u);
  assert.match(cronRoute, /pruneSentOrderEmailJobs\(pool, \{ retentionDays: 30 \}\)/u);
  assert.match(cronRoute, /isOrderEmailSchemaReady\(pool\)/u);
  assert.match(appCronRoute, /export const dynamic = 'force-dynamic'/u);
  assert.match(appCronRoute, /export const maxDuration = 60/u);
  assert.match(
    appCronRoute,
    /export \{ GET \} from '@\/admin\/api\/order-email-settings\/process\/route'/u
  );
});

test('provider secret is server-only and explicitly removed from E2E runtime', () => {
  const client = source(
    'src/admin/features/email/components/AdminOrderEmailSettingsPageClient.tsx'
  );
  const e2eServer = source('scripts/e2e-server.mjs');
  const example = source('.env.example');

  assert.doesNotMatch(client, /RESEND_API_KEY|re_[A-Za-z0-9_-]+/u);
  assert.match(e2eServer, /RESEND_API_KEY: ''/u);
  assert.match(example, /RESEND_API_KEY=re_replace-with-your-resend-api-key/u);
});
