import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import AdminNotificationCountBadge from '../../src/shared/ui/admin-notification-count-badge';
import {
  getStatusLabel,
  ORDER_ATTENTION_STATUSES
} from '../../src/shared/domain/order/orderStatus';

const source = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

test('notification badge hides zero and caps only its visible number', () => {
  assert.equal(renderToStaticMarkup(createElement(AdminNotificationCountBadge, {
    count: 0,
    label: '0 novih povpraševanj'
  })), '');

  const markup = renderToStaticMarkup(createElement(AdminNotificationCountBadge, {
    count: 123,
    label: '123 novih povpraševanj'
  }));
  assert.match(markup, /data-admin-notification-count="123"/u);
  assert.match(markup, /aria-hidden="true">99\+<\/span>/u);
  assert.match(markup, /<span class="sr-only">123 novih povpraševanj<\/span>/u);
});

test('standardized tabs render one compact, subdued, accessible notification badge', () => {
  const tabs = source('src/shared/ui/eui-tabs.tsx');
  const badge = source('src/shared/ui/admin-notification-count-badge.tsx');

  assert.match(tabs, /notification\?: \{/u);
  assert.match(tabs, /<AdminNotificationCountBadge/u);
  assert.match(tabs, /gap-1\.5/u);
  assert.match(
    tabs,
    /role="tablist"[\s\S]*?className=\{`[^`]*border-b border-slate-200/u
  );
  assert.match(tabs, /data-eui-tab-divider-mask="true"/u);
  assert.match(badge, /h-\[15px\] min-w-\[15px\]/u);
  assert.match(badge, /border-rose-200\/80 bg-rose-50\/80/u);
  assert.match(badge, /text-rose-600\/90/u);
  assert.match(badge, /text-\[9px\] font-semibold/u);
  assert.match(badge, /normalizedCount > 99 \? '99\+' : normalizedCount/u);
  assert.match(badge, /aria-hidden="true"/u);
  assert.match(badge, /className="sr-only"/u);
  assert.doesNotMatch(badge, /bg-rose-600|text-white/u);
});

test('order and quote tabs use standardized reusable notification metadata', () => {
  const ordersTabs = source('src/admin/features/orders/components/AdminOrdersTabs.tsx');
  const page = source('src/admin/pages/orders/page.tsx');
  const ordersServer = source('src/shared/server/orders.ts');

  assert.match(ordersTabs, /attentionOrderCount/u);
  assert.match(ordersTabs, /newQuoteCount/u);
  assert.equal((ordersTabs.match(/notification: \{/gu) ?? []).length, 2);
  assert.match(ordersTabs, /naročilo za obravnavo/u);
  assert.match(ordersTabs, /naročili za obravnavo/u);
  assert.match(ordersTabs, /naročila za obravnavo/u);
  assert.match(ordersTabs, /naročil za obravnavo/u);
  assert.match(ordersTabs, /novo povpraševanje/u);
  assert.doesNotMatch(ordersTabs, /bg-rose-600/u);
  assert.match(page, /fetchOrderAttentionCount/u);
  assert.match(page, /fetchNewQuoteRequestCount/u);
  assert.match(page, /attentionOrderCount=\{attentionOrderCount\}/u);
  assert.match(ordersServer, /export async function fetchOrderAttentionCount/u);
  assert.match(ordersServer, /orders\.status = any\(\$1::text\[\]\)/u);
  assert.match(ordersServer, /orders\.deleted_at is null/u);
  assert.match(ordersServer, /\[\.\.\.ORDER_ATTENTION_STATUSES\]/u);
  const attentionCountLoader = ordersServer.slice(
    ordersServer.indexOf('export async function fetchOrderAttentionCount'),
    ordersServer.indexOf('export async function fetchOrdersAnalyticsRows')
  );
  assert.doesNotMatch(attentionCountLoader, /is_draft/u);
  assert.deepEqual(ORDER_ATTENTION_STATUSES, [
    'received',
    'in_progress',
    'partially_sent'
  ]);
  assert.deepEqual(ORDER_ATTENTION_STATUSES.map(getStatusLabel), [
    'Prejeto',
    'V obdelavi',
    'Delno poslano'
  ]);
});
