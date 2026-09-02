import {
  ORDER_STATUS_OPTIONS,
  isOrderStatus
} from '@/shared/domain/order/orderStatus';

export type OrderProgressStatus = (typeof ORDER_STATUS_OPTIONS)[number]['value'];

export type OrderProgressStatusLogInput = {
  id: string | number;
  occurredAt: string | Date;
  previousStatus: unknown;
  status: unknown;
};

export type OrderProgressMilestone = {
  id: string;
  occurredAt: string;
  timestampKnown: boolean;
  previousStatus: OrderProgressStatus | null;
  status: OrderProgressStatus;
  source: 'initial_status' | 'status_log' | 'current_status_fallback';
};

export type OrderProgressResponse = {
  milestones: OrderProgressMilestone[];
};

const normalizedStatus = (value: unknown): OrderProgressStatus | null =>
  typeof value === 'string' && isOrderStatus(value) ? value : null;

const normalizedTimestamp = (value: string | Date): string | null => {
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
};

export function buildOrderProgressMilestones(input: {
  orderId: string | number;
  orderCreatedAt: string | Date;
  currentStatus: unknown;
  statusLogs: readonly OrderProgressStatusLogInput[];
}): OrderProgressMilestone[] {
  const orderCreatedAt = normalizedTimestamp(input.orderCreatedAt);
  if (!orderCreatedAt) return [];

  const currentStatus = normalizedStatus(input.currentStatus);
  const statusLogs = input.statusLogs
    .flatMap((entry): OrderProgressMilestone[] => {
      const status = normalizedStatus(entry.status);
      const occurredAt = normalizedTimestamp(entry.occurredAt);
      if (!status || !occurredAt) return [];

      return [{
        id: `status-log-${String(entry.id)}`,
        occurredAt,
        timestampKnown: true,
        previousStatus: normalizedStatus(entry.previousStatus),
        status,
        source: 'status_log'
      }];
    })
    .sort((left, right) =>
      left.occurredAt.localeCompare(right.occurredAt) || left.id.localeCompare(right.id)
    );

  const milestones: OrderProgressMilestone[] = [];
  const firstLog = statusLogs[0];
  if (firstLog?.previousStatus && firstLog.previousStatus !== firstLog.status) {
    milestones.push({
      id: `order-${String(input.orderId)}-initial-status`,
      occurredAt: orderCreatedAt,
      timestampKnown: true,
      previousStatus: null,
      status: firstLog.previousStatus,
      source: 'initial_status'
    });
  }

  for (const statusLog of statusLogs) {
    const previousMilestone = milestones.at(-1);
    if (
      previousMilestone?.status === statusLog.status &&
      previousMilestone.source === 'status_log'
    ) {
      continue;
    }
    milestones.push(statusLog);
  }

  const lastLoggedStatus = statusLogs.at(-1)?.status ?? null;
  if (currentStatus && currentStatus !== lastLoggedStatus) {
    // Orders have no maintained updated_at column. The latest status-log time is
    // therefore the nearest persisted mutation time; created_at covers no-log imports.
    milestones.push({
      id: `order-${String(input.orderId)}-current-status`,
      occurredAt: statusLogs.at(-1)?.occurredAt ?? orderCreatedAt,
      timestampKnown: false,
      previousStatus: milestones.at(-1)?.status ?? null,
      status: currentStatus,
      source: 'current_status_fallback'
    });
  }

  return milestones;
}
