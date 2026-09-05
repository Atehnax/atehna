import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const schema = readFileSync(
  resolve(process.cwd(), 'database', 'schema.sql'),
  'utf8'
);

test('canonical schema persists order email settings and durable delivery jobs', () => {
  const settingsTable = schema.match(
    /create table order_email_settings \(([\s\S]*?)\n\);/u
  );
  assert.ok(settingsTable, 'order_email_settings must exist in the canonical schema');
  assert.match(settingsTable[1], /\bkey text primary key\b/u);
  assert.match(settingsTable[1], /\bconfig_json jsonb not null\b/u);
  assert.match(settingsTable[1], /\bupdated_at timestamptz not null default now\(\)/u);

  const jobsTable = schema.match(
    /create table order_email_jobs \(([\s\S]*?)\n\);/u
  );
  assert.ok(jobsTable, 'order_email_jobs must exist in the canonical schema');
  const jobs = jobsTable[1];

  assert.match(jobs, /\bid uuid primary key default gen_random_uuid\(\)/u);
  assert.match(
    jobs,
    /\border_id bigint not null references orders\(id\) on delete cascade\b/u
  );
  for (const requiredColumn of [
    'event_key text not null',
    'event_type text not null',
    'audience text not null',
    'recipient_email text not null',
    'recipient_name text',
    'payload_json jsonb not null',
    "status text not null default 'pending'",
    'attempts integer not null default 0',
    'next_attempt_at timestamptz not null default now()',
    'claim_id uuid',
    'locked_at timestamptz',
    'provider_message_id text',
    'last_error text',
    'sent_at timestamptz',
    'created_at timestamptz not null default now()',
    'updated_at timestamptz not null default now()'
  ]) {
    assert.ok(jobs.includes(requiredColumn), `missing email job column: ${requiredColumn}`);
  }

  for (const eventType of [
    'order_submitted',
    'order_accepted',
    'order_rejected',
    'predracun_issued',
    'invoice_issued',
    'received',
    'in_progress',
    'partially_sent',
    'sent',
    'finished',
    'cancelled'
  ]) {
    assert.match(jobs, new RegExp(`'${eventType}'`, 'u'));
  }
  assert.match(jobs, /audience in \('customer', 'admin'\)/u);
  assert.match(jobs, /status in \('pending', 'processing', 'sent', 'failed'\)/u);
  assert.match(jobs, /attempts >= 0/u);
  assert.match(
    jobs,
    /status = 'processing'[\s\S]*?claim_id is not null[\s\S]*?locked_at is not null[\s\S]*?status <> 'processing'[\s\S]*?claim_id is null[\s\S]*?locked_at is null/u
  );
  assert.match(
    schema,
    /create unique index idx_order_email_jobs_event_audience_recipient\s+on order_email_jobs\(event_key, audience, lower\(recipient_email\)\)/u
  );
  assert.match(
    schema,
    /create index idx_order_email_jobs_pending[\s\S]*?where status = 'pending'/u
  );
  assert.match(
    schema,
    /create index idx_order_email_jobs_stale_processing[\s\S]*?where status = 'processing'/u
  );
  assert.match(
    schema,
    /create index idx_order_email_jobs_order\s+on order_email_jobs\(order_id\)/u
  );
  assert.match(
    schema,
    /create index idx_order_email_jobs_sent_retention[\s\S]*?on order_email_jobs\(sent_at, id\)[\s\S]*?where status = 'sent'/u
  );
});
