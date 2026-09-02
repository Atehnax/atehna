import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const source = (path: string) =>
  readFileSync(resolve(process.cwd(), path), 'utf8');

const schema = source('database/schema.sql');
const migration = source(
  'database/migrations/20260901_quote_outbox_cancellation.sql'
);
const settings = source('src/shared/server/quoteEmailSettings.ts');
const cancelRoute = source(
  'src/admin/api/quote-email-jobs/[jobId]/route.ts'
);
const cancelWrapper = source(
  'src/app/api/admin/quote-email-jobs/[jobId]/route.ts'
);
const worker = source('src/shared/server/quoteEmailJobs.ts');

const quoteEmailJobs = schema.slice(
  schema.indexOf('create table quote_email_jobs'),
  schema.indexOf('create unique index idx_quote_email_jobs_event_audience_recipient')
);

test('cancelled quote emails are terminal, evidenced, and excluded from worker claims', () => {
  assert.match(
    quoteEmailJobs,
    /status in \('pending', 'processing', 'sent', 'failed', 'cancelled'\)/u
  );
  assert.match(quoteEmailJobs, /cancelled_at timestamptz/u);
  assert.match(quoteEmailJobs, /cancelled_by_actor_id text/u);
  assert.match(
    quoteEmailJobs,
    /quote_email_jobs_cancellation_check[\s\S]*?status = 'cancelled'[\s\S]*?cancelled_at is not null[\s\S]*?cancelled_by_actor_id is not null[\s\S]*?btrim\(cancelled_by_actor_id\) <> ''/u
  );
  assert.match(migration, /^begin;/mu);
  assert.match(migration, /pg_advisory_xact_lock/u);
  assert.match(
    migration,
    /drop constraint quote_email_jobs_status_check[\s\S]*?add constraint quote_email_jobs_status_check/u
  );
  assert.match(migration, /add column cancelled_at timestamptz/u);
  assert.match(migration, /add constraint quote_email_jobs_cancellation_check/u);
  assert.match(
    migration,
    /status = 'cancelled'[\s\S]*?cancelled_at is not null[\s\S]*?cancelled_by_actor_id is not null[\s\S]*?btrim\(cancelled_by_actor_id\) <> ''/u
  );
  assert.match(migration, /commit;\s*$/u);

  const claim = worker.slice(
    worker.indexOf('async function claim('),
    worker.indexOf('type Queryable')
  );
  assert.match(claim, /status = 'pending'/u);
  assert.match(claim, /status = 'processing'/u);
  assert.doesNotMatch(claim, /status = 'cancelled'/u);
});

test('a failed delivery is not counted as retried after its worker claim is lost', () => {
  assert.match(
    worker,
    /const retryUpdate = await pool\.query[\s\S]*?if \(retryUpdate\.rowCount !== 1\) \{[\s\S]*?Quote email claim was lost for job/u
  );
  assert.match(
    worker,
    /if \(retryUpdate\.rows\[0\]\?\.status === 'failed'\) result\.failed \+= 1;[\s\S]*?else result\.retried \+= 1;/u
  );
});

test('quote email admin state exposes only pending jobs as cancellable rows', () => {
  assert.match(settings, /export type QuoteEmailPendingJob/u);
  assert.match(settings, /pendingJobs: QuoteEmailPendingJob\[\]/u);
  assert.match(
    settings,
    /from quote_email_jobs[\s\S]*?where status = 'pending'[\s\S]*?order by next_attempt_at asc[\s\S]*?limit 100/u
  );
  assert.match(settings, /pendingJobs: pendingJobsResult\.rows\.map/u);
});

test('quote email cancellation is authenticated, row-locked, pending-only, redacted, and audited', () => {
  assert.match(cancelRoute, /isQuoteAdminEnabled/u);
  assert.match(cancelRoute, /hasValidQuoteAdminSession\(request\)/u);
  assert.match(cancelRoute, /status: 401/u);
  assert.match(cancelRoute, /for update of job/u);
  assert.match(cancelRoute, /if \(status === 'cancelled'\)/u);
  assert.match(cancelRoute, /if \(status !== 'pending'\)/u);
  assert.match(
    cancelRoute,
    /job\.provider_message_id !== null \|\| job\.sent_at !== null/u
  );
  assert.match(
    cancelRoute,
    /set status = 'cancelled'[\s\S]*?payload_json = jsonb_build_object[\s\S]*?cancelled_at = clock_timestamp\(\)[\s\S]*?cancelled_by_actor_id = \$2/u
  );
  assert.match(
    cancelRoute,
    /where id = \$1[\s\S]*?and status = 'pending'[\s\S]*?provider_message_id is null[\s\S]*?sent_at is null[\s\S]*?cancelled_at is null/u
  );
  assert.match(cancelRoute, /cancelled\.rowCount !== 1/u);
  assert.match(cancelRoute, /mirrorQuoteAdminAudit/u);
  assert.match(cancelRoute, /queue_action: 'cancelled'/u);
  assert.doesNotMatch(cancelRoute, /scheduleQuoteEmailJobs/u);
  assert.match(cancelWrapper, /export \{ DELETE \}/u);
});
