import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const source = (path: string) =>
  readFileSync(resolve(process.cwd(), path), 'utf8');

test('retry-all plans and confirms an exact locked customer delivery batch', () => {
  const jobs = source('src/shared/server/orderEmailJobs.ts');
  const route = source('src/admin/api/order-email-settings/retry/route.ts');
  const plannerStart = jobs.indexOf(
    'export async function planFailedOrderEmailJobRetries'
  );
  const resetStart = jobs.indexOf(
    'export async function resetFailedOrderEmailJobs',
    plannerStart
  );
  const planner = jobs.slice(plannerStart, resetStart);
  const challengeIndex = route.indexOf(
    'requireAdminCustomerEmailConfirmationForDeliveries({'
  );
  const resetIndex = route.indexOf('resetFailedOrderEmailJobs(');

  assert.ok(plannerStart > 0 && resetStart > plannerStart);
  assert.match(planner, /where job\.status = 'failed'/u);
  assert.match(planner, /for update of job/u);
  assert.match(planner, /settings\.enabled/u);
  assert.match(planner, /eventSettings\.customer/u);
  assert.match(planner, /eventSettings\.admins/u);
  assert.match(planner, /isRetryableOrderEmailFailure\(row\.last_error\)/u);
  assert.match(planner, /isOrderEmailRetryEventCurrent/u);
  assert.match(planner, /currentAdminRecipients\.has\(recipientEmail\)/u);
  assert.match(planner, /currentRecipient !== recipientEmail/u);
  assert.match(planner, /parseClaimedOrderEmailEnvelope\(job\)/u);
  assert.match(planner, /validatePurchaseOrderTokenBeforeDelivery/u);
  assert.match(planner, /seenDeliveryKeys/u);
  assert.match(planner, /createHash\('sha256'\)/u);
  assert.match(planner, /delivery\.jobId.*delivery\.jobUpdatedAt/u);
  assert.match(planner, /retry_failed_order_emails:\$\{customerBatchDigest\}/u);

  assert.ok(challengeIndex > 0 && resetIndex > challengeIndex);
  assert.match(route, /bodyResult\.body\.customerEmailConfirmationToken/u);
  assert.match(route, /action: plan\.customerBatchAction/u);
  assert.match(route, /await client\.query\('rollback'\)[\s\S]*?status: 428/u);
  assert.match(route, /await client\.query\('commit'\)[\s\S]*?scheduleOrderEmailJobs/u);
  assert.doesNotMatch(route, /customerEmailConfirmed/u);
});

test('retry-all updates explicit eligible ids and leaves failed evidence intact', () => {
  const jobs = source('src/shared/server/orderEmailJobs.ts');
  const resetStart = jobs.indexOf(
    'export async function resetFailedOrderEmailJobs'
  );
  const resetEnd = jobs.indexOf(
    'export async function sendOrderEmailTest',
    resetStart
  );
  const reset = jobs.slice(resetStart, resetEnd);

  assert.match(reset, /eligibleJobIds: readonly string\[\]/u);
  assert.match(reset, /if \(eligibleJobIds\.length === 0\) return 0/u);
  assert.match(reset, /and id = any\(\$1::uuid\[\]\)/u);
  assert.doesNotMatch(reset, /payload_json/u);
  assert.doesNotMatch(reset, /where status = 'failed'\s*`/u);
});

test('email settings retry UI uses the shared signed confirmation dialog', () => {
  const client = source(
    'src/admin/features/email/components/AdminOrderEmailSettingsPageClient.tsx'
  );
  const handlerStart = client.indexOf('const handleRetry = async');
  const handlerEnd = client.indexOf('\n\n  return (', handlerStart);
  const handler = client.slice(handlerStart, handlerEnd);

  assert.match(client, /useCustomerEmailConfirmation\(\)/u);
  assert.match(handler, /customerEmailConfirmationToken: string \| null = null/u);
  assert.match(handler, /JSON\.stringify\([\s\S]*?customerEmailConfirmationToken/u);
  assert.match(handler, /parseCustomerEmailConfirmationRequired\(payload\)/u);
  assert.match(handler, /response\.status === 428/u);
  assert.match(handler, /handleRetry\(confirmation\.confirmationToken\)/u);
  assert.doesNotMatch(handler, /customerEmailConfirmed/u);
  assert.match(client, /<CustomerEmailConfirmationDialog/u);
});
