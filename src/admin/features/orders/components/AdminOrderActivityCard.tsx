'use client';

import { useEffect, useMemo, useState } from 'react';
import type {
  OrderProgressMilestone,
  OrderProgressResponse
} from '@/shared/domain/order/orderProgress';
import { getStatusLabel } from '@/shared/domain/order/orderStatus';
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

export default function AdminOrderActivityCard({
  orderId,
  refreshToken = 0
}: {
  orderId: number;
  refreshToken?: number;
}) {
  const [milestones, setMilestones] = useState<OrderProgressMilestone[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const timelineItems = useMemo(
    () => milestones.slice(-5).map((milestone) => {
      const statusLabel = getStatusLabel(milestone.status);
      const fullTimestamp = milestone.timestampKnown
        ? formatTimestamp(milestone.occurredAt)
        : 'čas ni zabeležen';

      return {
        id: milestone.id,
        occurredAt: milestone.occurredAt,
        timestampKnown: milestone.timestampKnown,
        timestampLabel: milestone.timestampKnown
          ? formatCompactTimestamp(milestone.occurredAt)
          : 'čas ni znan',
        compactLabel: statusLabel,
        fullLabel: `${statusLabel} · ${fullTimestamp}`
      };
    }),
    [milestones]
  );

  useEffect(() => {
    const controller = new AbortController();

    setLoading(true);
    setError(false);
    fetch(`/api/admin/orders/${orderId}/progress`, {
      cache: 'no-store',
      signal: controller.signal
    })
      .then(async (response) => {
        const payload = (await response.json().catch(() => ({}))) as Partial<OrderProgressResponse>;
        if (!response.ok) throw new Error('Napredovanja ni bilo mogoče naložiti.');
        setMilestones(payload.milestones ?? []);
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
      ariaLabel="Časovnica napredovanja naročila"
      progressAriaLabel="Napredovanje naročila"
      items={timelineItems}
      emptyMessage="Za naročilo še ni zabeleženega napredovanja."
      loading={loading}
      error={error}
      loadingMessage="Nalaganje napredovanja …"
      errorMessage="Napredovanja trenutno ni mogoče prikazati."
      messageMinHeightClassName="min-h-[52px]"
    />
  );
}
