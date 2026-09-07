import type { AuditEventGroup } from './auditPresentation';

const appearancePages: Record<string, string> = {
  'site-navigation': '/admin/podoba/navigacija',
  'landing-page': '/admin/podoba/glavna-stran',
  'global-style': '/admin/podoba/globalni-parametri',
  'product-appearance': '/admin/podoba/artikli',
  'logo-library': '/admin/podoba/logotip'
};

/** A page location stays useful after an individual record is archived or deleted. */
export function getAuditLocation(group: Pick<AuditEventGroup, 'entityType' | 'entityId' | 'entityLabel' | 'action' | 'events'>) {
  const latest = [...group.events].sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt))[0];
  const action = latest?.action ?? group.action;
  const metadata = latest?.metadata ?? {};
  const deleted = action === 'deleted' || action === 'removed';
  let href: string | null = null;
  if (group.entityId.startsWith('quote:')) href = '/admin/orders?view=quotes';
  else if (group.entityType === 'order') {
    href = deleted ? '/admin/trash' : action === 'archived' ? '/admin/orders?view=archive' : '/admin/orders';
  } else if (group.entityType === 'item') {
    href = deleted || action === 'archived' ? '/admin/trash?view=articles' : '/admin/artikli';
    if (!deleted && action !== 'archived' && (metadata.area === 'pricing_stock' || String(metadata.route ?? '').includes('/pricing-stock'))) href = '/admin/artikli?view=pricing-stock';
  } else if (group.entityType === 'media') {
    const orderDocument = metadata.order_id != null || metadata.item_type === 'pdf' || String(metadata.route ?? '').startsWith('/api/admin/orders/');
    href = orderDocument ? deleted ? '/admin/trash' : '/admin/orders' : deleted || action === 'archived' ? '/admin/trash?view=articles' : '/admin/artikli';
  } else if (group.entityType === 'category') href = '/admin/kategorije';
  else {
    href = appearancePages[group.entityId] ?? null;
    if (!href && (group.entityId === 'shipping-configuration' || metadata.area === 'shipping')) href = '/admin/postnina';
    if (!href && (metadata.area === 'pricing_stock' || String(metadata.route ?? '').includes('/pricing-stock'))) href = '/admin/artikli?view=pricing-stock';
    if (!href && (group.entityId === 'order-document-templates' || String(metadata.route ?? '').includes('/order-document-templates'))) href = '/admin/urejevalnik';
    if (!href && String(metadata.route ?? '').startsWith('/api/admin/order-email')) href = '/admin/email';
  }
  return { label: group.entityLabel || group.entityId, href };
}
