import type { AdminQuoteEvent } from '@/shared/domain/quote/quoteAdminTypes';
import { AdminActivityTimeline } from '@/shared/ui/admin-detail/AdminActivityTimeline';

const EVENT_LABELS: Record<string, string> = {
  request_received: 'Povpraševanje prejeto',
  draft_created: 'Osnutek ponudbe ustvarjen',
  draft_changed: 'Osnutek ponudbe spremenjen',
  preview_generated: 'Predogled ustvarjen',
  customer_acceptance_attempted: 'Poskus sprejema ponudbe',
  acceptance_blocked_stock: 'Sprejem blokiran zaradi zaloge',
  customer_purchase_order_uploaded: 'Naročilnica naložena',
  admin_document_uploaded: 'Dokument naložen',
  admin_purchase_order_validated: 'Naročilnica potrjena',
  admin_purchase_order_rejected: 'Naročilnica zavrnjena',
  request_closed_without_offer: 'Povpraševanje zaključeno',
  request_voided: 'Povpraševanje razveljavljeno',
  quote_request_received: 'Povpraševanje prejeto',
  offer_draft_created: 'Osnutek ponudbe ustvarjen',
  offer_draft_changed: 'Osnutek ponudbe spremenjen',
  quote_request_details_changed: 'Povpraševanje spremenjeno',
  clarification_requested: 'Zahtevano pojasnilo',
  offer_preview_generated: 'Predogled ustvarjen',
  offer_issued: 'Ponudba izdana',
  quote_email_queued: 'E-pošta uvrščena v čakalno vrsto',
  quote_email_provider_accepted: 'Ponudnik je sprejel e-pošto',
  quote_email_provider_failed: 'Pošiljanje e-pošte ni uspelo',
  quote_email_failed: 'Pošiljanje e-pošte ni uspelo',
  offer_viewed: 'Ponudba ogledana',
  acceptance_attempted: 'Poskus sprejema ponudbe',
  customer_accepted: 'Stranka je sprejela ponudbo',
  customer_declined: 'Stranka je zavrnila ponudbo',
  purchase_order_submitted: 'Naročilnica naložena',
  purchase_order_validated: 'Naročilnica potrjena',
  purchase_order_rejected: 'Naročilnica zavrnjena',
  offer_withdrawn: 'Ponudba umaknjena',
  offer_expired: 'Ponudba potekla',
  offer_superseded: 'Izdana nova različica',
  new_version_issued: 'Izdana nova različica',
  order_created: 'Ustvarjeno naročilo',
  quote_request_closed: 'Povpraševanje zaključeno'
};

const COMPACT_EVENT_LABELS: Record<string, string> = {
  request_received: 'Povpraševanje',
  draft_created: 'Osnutek',
  draft_changed: 'Osnutek',
  preview_generated: 'Predogled',
  customer_acceptance_attempted: 'Sprejem',
  acceptance_blocked_stock: 'Zaloga',
  customer_purchase_order_uploaded: 'Naročilnica',
  admin_document_uploaded: 'Dokument',
  admin_purchase_order_validated: 'Naročilnica',
  admin_purchase_order_rejected: 'Naročilnica',
  request_closed_without_offer: 'Zaključeno',
  request_voided: 'Razveljavljeno',
  quote_request_received: 'Povpraševanje',
  offer_draft_created: 'Osnutek',
  offer_draft_changed: 'Osnutek',
  quote_request_details_changed: 'Podatki',
  clarification_requested: 'Pojasnilo',
  offer_preview_generated: 'Predogled',
  offer_issued: 'Ponudba',
  quote_email_queued: 'E-pošta',
  quote_email_provider_accepted: 'E-pošta',
  quote_email_provider_failed: 'E-pošta',
  quote_email_failed: 'E-pošta',
  offer_viewed: 'Ogled',
  acceptance_attempted: 'Sprejem',
  customer_accepted: 'Sprejem',
  customer_declined: 'Zavrnitev',
  purchase_order_submitted: 'Naročilnica',
  purchase_order_validated: 'Naročilnica',
  purchase_order_rejected: 'Naročilnica',
  offer_withdrawn: 'Umik',
  offer_expired: 'Potek',
  offer_superseded: 'Različica',
  new_version_issued: 'Različica',
  order_created: 'Naročilo',
  quote_request_closed: 'Zaključeno'
};

const compactDateFormatter = new Intl.DateTimeFormat('sl-SI', {
  day: 'numeric',
  month: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
  timeZone: 'Europe/Ljubljana'
});

const formatFullTimestamp = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat('sl-SI', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
};

const formatCompactTimestamp = (value: string) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  const parts = compactDateFormatter.formatToParts(parsed);
  const day = parts.find((part) => part.type === 'day')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const hour = parts.find((part) => part.type === 'hour')?.value;
  const minute = parts.find((part) => part.type === 'minute')?.value;
  return day && month && hour && minute
    ? `${day}.${month}. ${hour}:${minute}`
    : compactDateFormatter.format(parsed);
};

export default function AdminQuoteActivityTimeline({
  events
}: {
  events: AdminQuoteEvent[];
}) {
  const items = [...events].slice(0, 5).reverse().map((event) => {
    const label = EVENT_LABELS[event.eventType] ?? event.eventType;
    const actor = event.actorId ? `${event.actorType} ${event.actorId}` : event.actorType;
    const reason = event.reason?.trim();

    return {
      id: event.id,
      occurredAt: event.occurredAt,
      timestampLabel: formatCompactTimestamp(event.occurredAt),
      compactLabel: COMPACT_EVENT_LABELS[event.eventType] ?? label,
      fullLabel: `${label} · ${actor} · ${formatFullTimestamp(event.occurredAt)}${reason ? ` · ${reason}` : ''}`
    };
  });

  return (
    <AdminActivityTimeline
      testId="quote-activity-timeline"
      ariaLabel="Časovnica povpraševanja"
      progressAriaLabel="Napredovanje povpraševanja"
      items={items}
      emptyMessage="Za povpraševanje še ni zabeležene dejavnosti."
    />
  );
}
