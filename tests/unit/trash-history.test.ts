import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { getAuditLocation } from '@/shared/audit/auditLocation';
import { getAuditRetentionUntil, isDurableOrderAudit } from '@/shared/audit/auditRetention';
import { groupTrashRows } from '@/shared/domain/archive/trashRows';
import type { AuditEventGroup } from '@/shared/audit/auditPresentation';
import type { AuditEventRecord } from '@/shared/audit/auditTypes';
const source = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');
function group(overrides: Partial<AuditEventGroup> = {}): AuditEventGroup {
  return { id: 'g', events: [], changes: [], occurredAt: '2026-09-07T10:00:00Z', actorId: null, actorName: null, actorEmail: null, entityType: 'order', entityId: '17', entityLabel: 'Naročilo SI-17', action: 'updated', actionLabel: '', summary: '', ...overrides };
}

test('audit locations distinguish business archive, trash, quotes and normal page paths', () => {
  assert.deepEqual(getAuditLocation(group()), { label: 'Naročilo SI-17', href: '/admin/orders' });
  assert.equal(getAuditLocation(group({ action: 'archived' })).href, '/admin/orders?view=archive');
  assert.equal(getAuditLocation(group({ action: 'deleted' })).href, '/admin/trash');
  assert.equal(getAuditLocation(group({ entityType: 'item', action: 'archived' })).href, '/admin/trash?view=articles');
  assert.equal(getAuditLocation(group({ entityType: 'system', entityId: 'quote:19', action: 'deleted' })).href, '/admin/orders?view=quotes');
  assert.equal(getAuditLocation(group({ entityType: 'category' })).href, '/admin/kategorije');
});

test('existing appearance audit records link to every actual Podoba page without duplicating records', () => {
  for (const [id, page] of [['site-navigation', 'navigacija'], ['landing-page', 'glavna-stran'], ['global-style', 'globalni-parametri'], ['product-appearance', 'artikli'], ['logo-library', 'logotip']]) {
    assert.equal(getAuditLocation(group({ entityType: 'system', entityId: id })).href, `/admin/podoba/${page}`);
  }
  assert.equal(getAuditLocation(group({ entityType: 'system', entityId: 'unknown' })).href, null);
});

test('latest lifecycle event determines the location even when a grouped summary includes an earlier delete', () => {
  const events = [{ occurredAt: '2026-09-07T10:00:00Z', action: 'deleted', metadata: {} }, { occurredAt: '2026-09-07T10:00:02Z', action: 'restored', metadata: {} }] as AuditEventRecord[];
  const input = group({ action: 'deleted', events });
  const before = structuredClone(input);
  assert.equal(getAuditLocation(input).href, '/admin/orders');
  assert.deepEqual(input, before);
  assert.equal(getAuditLocation(group({ entityType: 'media', action: 'deleted', events: [{ ...events[0], metadata: { item_type: 'pdf', order_id: 17 } }] })).href, '/admin/trash');
});

test('order and older PDF restore audit history has no expiry while unrelated records retain the existing policy', () => {
  assert.equal(getAuditRetentionUntil('order', '1999-01-01T00:00:00Z'), null);
  assert.equal(getAuditRetentionUntil('media', '1999-01-01T00:00:00Z', { item_type: 'pdf' }), null);
  assert.equal(isDurableOrderAudit('media', {}), false);
  assert.equal(getAuditRetentionUntil('item', '2026-01-01T00:00:00Z')?.toISOString(), '2029-01-01T00:00:00.000Z');
  assert.equal(getAuditRetentionUntil('media', '2026-01-01T00:00:00Z')?.toISOString(), '2029-01-01T00:00:00.000Z');
});

test('trash pagination keeps complete document families across a25-order boundary and keeps standalone PDFs', () => {
  const rows = Array.from({ length: 26 }, (_, i) => ({ entry: { item_type: 'order' as const, order_id: i + 1 }, isChild: false, parentOrderId: null as number | null }));
  const child = { entry: { item_type: 'pdf' as const, order_id: 25 }, isChild: true, parentOrderId: 25 };
  const standalone = { entry: { item_type: 'pdf' as const, order_id: 90 }, isChild: false, parentOrderId: null };
  const input = [child, ...rows, standalone];
  const before = structuredClone(input);
  const groups = groupTrashRows(input);
  assert.equal(groups.length, 27);
  assert.deepEqual(groups[24], [rows[24], child]);
  assert.equal(groups.slice(0, 25).flat().length, 26);
  assert.deepEqual(groups.slice(25).flat(), [rows[25], standalone]);
  assert.deepEqual(input, before);
});

test('legacy navigation redirects and backend guards preserve recoverable orders', () => {
  assert.match(source('src/admin/pages/arhiv/page.tsx'), /redirect\('\/admin\/trash'\)/u);
  assert.match(source('src/admin/pages/arhiv/artikli/page.tsx'), /redirect\('\/admin\/trash\?view=articles'\)/u);
  assert.match(source('src/admin/pages/arhiv/podoba/page.tsx'), /redirect\('\/admin\/dnevnik'\)/u);
  const route = source('src/admin/api/orders/[orderId]/route.ts');
  assert.doesNotMatch(route, /ORDER_ARCHIVED_DELETE_BLOCKED/u);
  assert.doesNotMatch(route, /interval '90 days'|delete from orders/u);
  assert.match(source('src/admin/api/archive/route.ts'), /permanentlyDeleteArchiveEntries/u);
  assert.doesNotMatch(source('src/admin/api/archive/cleanup/route.ts'), /cleanupExpiredArchiveEntries/u);
  const audit = source('src/shared/server/audit.ts');
  assert.match(audit, /delete from audit_events where id = any\(\$1::uuid\[\]\) and not \$\{DURABLE_ORDER_AUDIT_SQL\}/u);
  assert.match(audit, /where not \$\{DURABLE_ORDER_AUDIT_SQL\} and/u);
});
