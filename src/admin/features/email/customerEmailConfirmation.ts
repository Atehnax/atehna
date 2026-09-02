export const CUSTOMER_EMAIL_CONFIRMATION_REQUIRED =
  'CUSTOMER_EMAIL_CONFIRMATION_REQUIRED';

export type CustomerEmailConfirmationDelivery = {
  scope: 'order' | 'quote';
  entityId: number;
  eventType: string;
  eventLabel: string;
  recipientEmail: string;
};

export type CustomerEmailConfirmationDetails = {
  scope: string;
  eventType: string;
  eventLabel: string;
  action: string;
  actionLabel?: string;
  recipientEmail: string;
  confirmationToken: string;
  expiresAt: string;
  deliveries: CustomerEmailConfirmationDelivery[];
};

const record = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};

const text = (value: unknown): string =>
  typeof value === 'string' ? value.trim() : '';

export const parseCustomerEmailConfirmationRequired = (
  payload: unknown
): CustomerEmailConfirmationDetails | null => {
  const source = record(payload);
  if (text(source.code) !== CUSTOMER_EMAIL_CONFIRMATION_REQUIRED) return null;

  const nested = record(source.confirmation);
  const field = (key: string) =>
    text(nested[key]) || text(source[key]);

  const confirmationToken = field('confirmationToken');
  if (!confirmationToken) return null;
  const actionLabel = text(nested.actionLabel) || text(source.actionLabel);
  const rawDeliveries = Array.isArray(nested.deliveries)
    ? nested.deliveries
    : Array.isArray(source.deliveries)
      ? source.deliveries
      : [];
  const deliveries = rawDeliveries.flatMap((value) => {
    const delivery = record(value);
    const scope = text(delivery.scope);
    const entityId = Number(delivery.entityId);
    const eventType = text(delivery.eventType);
    const eventLabel = text(delivery.eventLabel);
    const recipientEmail = text(delivery.recipientEmail);
    if (
      (scope !== 'order' && scope !== 'quote') ||
      !Number.isSafeInteger(entityId) ||
      entityId <= 0 ||
      !eventType ||
      !recipientEmail
    ) {
      return [];
    }
    return [{
      scope,
      entityId,
      eventType,
      eventLabel,
      recipientEmail
    } satisfies CustomerEmailConfirmationDelivery];
  });
  const fallbackScope = field('scope');
  const fallbackEntityId = Number(field('entityId'));
  const fallbackEventType = field('eventType');
  const fallbackEventLabel = field('eventLabel');
  const fallbackRecipientEmail = field('recipientEmail');
  if (
    deliveries.length === 0 &&
    (fallbackScope === 'order' || fallbackScope === 'quote') &&
    Number.isSafeInteger(fallbackEntityId) &&
    fallbackEntityId > 0 &&
    fallbackEventType &&
    fallbackRecipientEmail
  ) {
    deliveries.push({
      scope: fallbackScope,
      entityId: fallbackEntityId,
      eventType: fallbackEventType,
      eventLabel: fallbackEventLabel,
      recipientEmail: fallbackRecipientEmail
    });
  }
  if (deliveries.length === 0) return null;
  const first = deliveries[0];
  return {
    scope: field('scope') || (deliveries.length > 1 ? 'multiple' : first.scope),
    eventType: field('eventType') || first.eventType,
    eventLabel: field('eventLabel') || first.eventLabel,
    action: field('action'),
    ...(actionLabel ? { actionLabel } : {}),
    recipientEmail: field('recipientEmail') || first.recipientEmail,
    confirmationToken,
    expiresAt: field('expiresAt'),
    deliveries
  };
};
