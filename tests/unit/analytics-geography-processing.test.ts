import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { NextRequest } from 'next/server';
import { proxy } from '@/proxy';
import { processScheduledGeography } from '@/shared/server/geographyProcessing';

const path = '/api/admin/analytics/geography/process';
const secret = 'isolated-geography-cron-test';
const request = (authorization?: string, method = 'GET') => new Request('http://localhost' + path + '?batchSize=1000000', { method, headers: authorization ? { authorization } : {} });

test('geography processing requires the exact configured cron bearer before opening a batch', async () => {
  let opened = 0;
  const processBatch = async () => { opened++; return { status: 'succeeded', processed: 0 }; };
  for (const authorization of [undefined, 'Bearer wrong', 'bearer ' + secret, secret]) {
    const response = await processScheduledGeography(request(authorization), { cronSecret: secret, processBatch });
    assert.equal(response.status, 401);
    assert.equal(response.headers.get('cache-control'), 'no-store');
  }
  const missingSecret = await processScheduledGeography(request('Bearer ' + secret), { cronSecret: '', processBatch });
  assert.equal(missingSecret.status, 401);
  assert.equal(opened, 0);
});

test('one authorized invocation processes at most one fixed batch and keeps the resumable result', async () => {
  let opened = 0;
  const response = await processScheduledGeography(request('Bearer ' + secret), {
    cronSecret: secret,
    processBatch: async (options) => {
      opened++;
      assert.deepEqual(options, { batchSize: 100, retryUnresolved: true });
      return { status: 'succeeded', processed: 100, remaining: true, version: 'frozen-reporting-vintage' };
    }
  });
  assert.equal(opened, 1);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: 'succeeded', processed: 100, remaining: true, version: 'frozen-reporting-vintage' });
});

test('overlapping jobs remain a no-op and unsupported methods cannot invoke processing', async () => {
  const result = await processScheduledGeography(request('Bearer ' + secret), {
    cronSecret: secret, processBatch: async () => ({ status: 'skipped', processed: 0 })
  });
  assert.deepEqual(await result.json(), { status: 'skipped', processed: 0 });
  const unsupported = await processScheduledGeography(request('Bearer ' + secret, 'POST'), {
    cronSecret: secret, processBatch: async () => { throw new Error('Must not open a batch'); }
  });
  assert.equal(unsupported.status, 405);
});

test('the proxy permits only the exact scheduled GET path for this cron bearer', () => {
  const previous = process.env.CRON_SECRET;
  process.env.CRON_SECRET = secret;
  try {
    const scheduled = proxy(new NextRequest('http://localhost' + path, { headers: { authorization: 'Bearer ' + secret } }));
    assert.equal(scheduled.headers.get('x-middleware-next'), '1');
    for (const [url, method, authorization] of [
      [path, 'GET', 'Bearer wrong'],
      [path, 'POST', 'Bearer ' + secret],
      ['/api/admin/analytics/geography', 'GET', 'Bearer ' + secret]
    ]) {
      const denied = proxy(new NextRequest('http://localhost' + url, { method, headers: { authorization } }));
      assert.equal(denied.status, 401);
    }
  } finally {
    if (previous === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = previous;
  }
});

test('the daily resolver is registered independently of monthly reference refresh', () => {
  const configuration = JSON.parse(readFileSync('vercel.json', 'utf8')) as { crons: { path: string; schedule: string }[] };
  assert.deepEqual(configuration.crons.find((entry) => entry.path === path), { path, schedule: '30 4 * * *' });
  assert.equal(configuration.crons.filter((entry) => entry.path === path).length, 1);
  assert.equal(configuration.crons.some((entry) => entry.path === '/api/admin/analytics/geography/refresh' && entry.schedule === '0 5 2 * *'), true);
});
