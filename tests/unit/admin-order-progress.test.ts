import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import { buildOrderProgressMilestones } from '@/shared/domain/order/orderProgress';

const source = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

test('order progress is chronological canonical status history, not generic audit activity', () => {
  const milestones = buildOrderProgressMilestones({
    orderId: 41,
    orderCreatedAt: '2026-08-01T08:00:00.000Z',
    currentStatus: 'sent',
    statusLogs: [
      {
        id: 3,
        occurredAt: '2026-08-03T08:00:00.000Z',
        previousStatus: 'in_progress',
        status: 'sent'
      },
      {
        id: 2,
        occurredAt: '2026-08-02T08:00:00.000Z',
        previousStatus: 'received',
        status: 'in_progress'
      },
      {
        id: 99,
        occurredAt: '2026-08-02T12:00:00.000Z',
        previousStatus: 'in_progress',
        status: 'payment_changed'
      }
    ]
  });

  assert.deepEqual(
    milestones.map(({ status, source }) => ({ status, source })),
    [
      { status: 'received', source: 'initial_status' },
      { status: 'in_progress', source: 'status_log' },
      { status: 'sent', source: 'status_log' }
    ]
  );
});

test('an unlogged legacy current status is present exactly once', () => {
  const milestones = buildOrderProgressMilestones({
    orderId: 42,
    orderCreatedAt: '2026-08-01T08:00:00.000Z',
    currentStatus: 'partially_sent',
    statusLogs: [
      {
        id: 1,
        occurredAt: '2026-08-01T08:00:00.000Z',
        previousStatus: null,
        status: 'received'
      },
      {
        id: 2,
        occurredAt: '2026-08-02T08:00:00.000Z',
        previousStatus: 'received',
        status: 'in_progress'
      }
    ]
  });

  assert.deepEqual(
    milestones.map((milestone) => milestone.status),
    ['received', 'in_progress', 'partially_sent']
  );
  assert.equal(milestones.at(-1)?.source, 'current_status_fallback');
  assert.equal(milestones.at(-1)?.occurredAt, '2026-08-02T08:00:00.000Z');
  assert.equal(milestones.at(-1)?.timestampKnown, false);
  assert.equal(
    milestones.filter((milestone) => milestone.status === 'partially_sent').length,
    1
  );
});

test('current status matching an older but not latest log still gets a final fallback', () => {
  const milestones = buildOrderProgressMilestones({
    orderId: 43,
    orderCreatedAt: '2026-08-01T08:00:00.000Z',
    currentStatus: 'in_progress',
    statusLogs: [
      {
        id: 1,
        occurredAt: '2026-08-02T08:00:00.000Z',
        previousStatus: 'received',
        status: 'in_progress'
      },
      {
        id: 2,
        occurredAt: '2026-08-03T08:00:00.000Z',
        previousStatus: 'in_progress',
        status: 'sent'
      }
    ]
  });

  assert.deepEqual(
    milestones.map((milestone) => milestone.status),
    ['received', 'in_progress', 'sent', 'in_progress']
  );
  assert.equal(milestones.at(-1)?.source, 'current_status_fallback');
  assert.equal(milestones.at(-1)?.occurredAt, '2026-08-03T08:00:00.000Z');
  assert.equal(milestones.at(-1)?.timestampKnown, false);
});

test('a no-log imported order falls back to its current status and creation time', () => {
  const milestones = buildOrderProgressMilestones({
    orderId: 44,
    orderCreatedAt: '2026-08-04T08:00:00.000Z',
    currentStatus: 'finished',
    statusLogs: []
  });

  assert.deepEqual(milestones, [{
    id: 'order-44-current-status',
    occurredAt: '2026-08-04T08:00:00.000Z',
    timestampKnown: false,
    previousStatus: null,
    status: 'finished',
    source: 'current_status_fallback'
  }]);
});

test('the order progress endpoint is admin-protected, record-scoped, and status-log backed', () => {
  const route = source('src/admin/api/orders/[orderId]/progress/route.ts');
  const wrapper = source('src/app/api/admin/orders/[orderId]/progress/route.ts');
  const activity = source(
    'src/admin/features/orders/components/AdminOrderActivityCard.tsx'
  );
  const proxy = source('src/proxy.ts');

  assert.match(route, /left join order_status_logs/u);
  assert.match(route, /where orders\.id = \$1/u);
  assert.doesNotMatch(route, /orders\.deleted_at is null/u);
  assert.match(route, /\[orderId\]/u);
  assert.match(route, /buildOrderProgressMilestones/u);
  assert.match(route, /hasValidAdminSession\(request\)/u);
  assert.match(route, /'Cache-Control': 'private, no-store'/u);
  assert.match(wrapper, /export \* from '@\/admin\/api\/orders\/\[orderId\]\/progress\/route'/u);
  assert.match(proxy, /'\/api\/admin\/:path\*'/u);

  assert.match(activity, /fetch\(`\/api\/admin\/orders\/\$\{orderId\}\/progress`/u);
  assert.match(activity, /milestones\.slice\(-5\)/u);
  assert.match(activity, /getStatusLabel\(milestone\.status\)/u);
  assert.match(activity, /timestampKnown: milestone\.timestampKnown/u);
  assert.match(activity, /'čas ni zabeležen'/u);
  assert.match(activity, /'čas ni znan'/u);
  assert.doesNotMatch(activity, /audit-events|groupAuditEvents|ORDER_PDF_TYPE_CONFIGS/u);
});
