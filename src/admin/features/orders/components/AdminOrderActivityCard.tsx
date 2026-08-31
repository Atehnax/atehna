'use client';

import { useEffect, useMemo, useState } from 'react';
import { groupAuditEvents } from '@/shared/audit/auditPresentation';
import type { AuditEventListResult, AuditEventRecord } from '@/shared/audit/auditTypes';
import { ORDER_PDF_TYPE_CONFIGS } from '@/shared/domain/order/orderTypes';
import { AdminActivityTimeline } from '@/shared/ui/admin-detail/AdminActivityTimeline';

const fullDateFormatter = new Intl.DateTimeFormat('sl-SI', {
  day: 'numeric',
  month: 'numeric',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Europe/Ljubljana'
});

const compactDateFormatter = new Intl.DateTimeFormat('sl-SI', {
  day: 'numeric',
  month: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
  timeZone: 'Europe/Ljubljana'
});

const formatTimestamp = (value: string) => {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : fullDateFormatter.format(parsed);
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

const compactSummary = (summary: string, entityLabel: string | null) => {
  const prefix = entityLabel ? `${entityLabel}: ` : '';
  return prefix && summary.startsWith(prefix)
    ? summary.slice(prefix.length)
    : summary;
};

type ActivityDocumentMetadataEvent = Pick<AuditEventRecord, 'metadata'>;

const orderPdfActivityLabelByType = new Map<string, string>(
  ORDER_PDF_TYPE_CONFIGS.map((config) => [config.key, config.shortLabel + ' PDF'])
);

const conciseDocumentActivitySummary = (
  events: readonly ActivityDocumentMetadataEvent[]
) => {
  const documentTypes = Array.from(new Set(
    events.flatMap((event) => {
      const documentType = event.metadata.document_type;
      return typeof documentType === 'string' && documentType.trim()
        ? [documentType.trim().toLowerCase()]
        : [];
    })
  ));

  if (documentTypes.length === 0) return null;
  if (documentTypes.length > 1) return 'PDF';
  return orderPdfActivityLabelByType.get(documentTypes[0] ?? '') ?? 'PDF';
};

export const conciseActivitySummary = (
  summary: string,
  entityLabel: string | null,
  actionLabel: string,
  events: readonly ActivityDocumentMetadataEvent[] = []
) => {
  const compact = compactSummary(summary, entityLabel).trim();
  const normalized = compact.toLocaleLowerCase('sl-SI');
  const documentSummary = conciseDocumentActivitySummary(events);

  if (documentSummary) return documentSummary;
  if (normalized.includes('status')) return 'Status';
  if (normalized.includes('dokument')) return 'PDF';
  if (normalized.includes('plačil')) return 'Plačilo';
  if (normalized.includes('poštnin')) return 'Poštnina';
  if (normalized.includes('postavk') || normalized.includes('artikel')) return 'Postavke';
  if (normalized.includes('naročnik') || normalized.includes('strank')) return 'Stranka';

  const capitalized = compact
    ? `${compact.charAt(0).toLocaleUpperCase('sl-SI')}${compact.slice(1)}`
    : '';
  if (capitalized.length <= 10) return capitalized || 'Dogodek';

  const compactActionLabels: Record<string, string> = {
    dodano: 'Dodano',
    spremenjeno: 'Sprem.',
    arhivirano: 'Arhiv.',
    obnovljeno: 'Obnov.',
    odstranjeno: 'Odstr.'
  };
  return compactActionLabels[actionLabel.toLocaleLowerCase('sl-SI')] ?? 'Dogodek';
};

export default function AdminOrderActivityCard({
  orderId,
  refreshToken = 0
}: {
  orderId: number;
  refreshToken?: number;
}) {
  const [events, setEvents] = useState<AuditEventRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const groups = useMemo(
    () => groupAuditEvents(events).slice(0, 5).reverse(),
    [events]
  );
  const timelineItems = useMemo(
    () => groups.map((group) => {
      const actor = group.actorName || group.actorId || 'Sistem';
      const fullTimestamp = formatTimestamp(group.occurredAt);
      const compactLabel = conciseActivitySummary(
        group.summary,
        group.entityLabel,
        group.actionLabel,
        group.events
      );

      return {
        id: group.id,
        occurredAt: group.occurredAt,
        timestampLabel: formatCompactTimestamp(group.occurredAt),
        compactLabel,
        fullLabel: `${compactSummary(group.summary, group.entityLabel)} · ${actor} · ${group.actionLabel} · ${fullTimestamp}`
      };
    }),
    [groups]
  );

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({
      entity_type: 'order',
      entity_id: String(orderId),
      page_size: '10'
    });

    setLoading(true);
    setError(false);
    fetch(`/api/admin/audit-events?${params.toString()}`, {
      cache: 'no-store',
      signal: controller.signal
    })
      .then(async (response) => {
        const payload = (await response.json().catch(() => ({}))) as AuditEventListResult;
        if (!response.ok) throw new Error('Dejavnosti ni bilo mogoče naložiti.');
        setEvents(payload.events ?? []);
      })
      .catch(() => {
        if (!controller.signal.aborted) setError(true);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [orderId, refreshToken]);

  return (
    <AdminActivityTimeline
      testId="admin-order-activity-timeline"
      ariaLabel="Časovnica dejavnosti naročila"
      progressAriaLabel="Napredovanje naročila"
      items={timelineItems}
      emptyMessage="Za naročilo še ni zabeležene dejavnosti."
      loading={loading}
      error={error}
      messageMinHeightClassName="min-h-[52px]"
    />
  );
}
