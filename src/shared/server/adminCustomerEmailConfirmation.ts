import type { PoolClient } from 'pg';
import {
  ORDER_EMAIL_EVENT_DEFINITIONS,
  type OrderEmailEventType
} from '@/shared/domain/order/orderEmailSettings';
import {
  normalizeQuoteEmailSettings,
  QUOTE_EMAIL_EDITABLE_EVENT_DEFINITIONS,
  type QuoteEmailEventType
} from '@/shared/domain/quote/quoteEmailSettings';
import {
  type AdminCustomerEmailConfirmationChallenge
} from '@/shared/domain/email/adminCustomerEmailConfirmation';
import { getOrderEmailSettings } from '@/shared/server/orderEmailSettings';
import {
  requireAdminCustomerEmailConfirmationForDeliveries
} from '@/shared/server/adminCustomerEmailConfirmationToken';

export {
  CUSTOMER_EMAIL_CONFIRMATION_REQUIRED_CODE
} from '@/shared/domain/email/adminCustomerEmailConfirmation';
export type {
  AdminCustomerEmailConfirmationChallenge,
  AdminCustomerEmailConfirmationScope
} from '@/shared/domain/email/adminCustomerEmailConfirmation';

type RequireOrderCustomerEmailConfirmationInput = Readonly<{
  client: PoolClient;
  orderId: number;
  eventType: OrderEmailEventType;
  action: string;
  actionLabel: string;
  customerEmailConfirmationToken?: unknown;
  recipientEmail?: unknown;
}>;

type RequireQuoteCustomerEmailConfirmationInput = Readonly<{
  client: PoolClient;
  quoteRequestId: number;
  eventType: QuoteEmailEventType;
  action: string;
  actionLabel: string;
  customerEmailConfirmationToken?: unknown;
  recipientEmail?: unknown;
}>;

type RequireOrderAndQuoteCustomerEmailConfirmationInput = Readonly<{
  client: PoolClient;
  orderId: number;
  orderEventType: OrderEmailEventType;
  orderRecipientEmail?: unknown;
  quoteRequestId: number;
  quoteEventType: QuoteEmailEventType;
  quoteRecipientEmail?: unknown;
  action: string;
  actionLabel: string;
  customerEmailConfirmationToken?: unknown;
}>;

/**
 * Resolves the live order notification configuration and customer recipient.
 * Callers must invoke this before their first mutation in the transaction.
 */
export async function requireOrderCustomerEmailConfirmation({
  client,
  orderId,
  eventType,
  action,
  actionLabel,
  customerEmailConfirmationToken,
  recipientEmail
}: RequireOrderCustomerEmailConfirmationInput): Promise<AdminCustomerEmailConfirmationChallenge | null> {
  const [settings, recipientResult] = await Promise.all([
    getOrderEmailSettings(client),
    client.query('select email from orders where id = $1', [orderId])
  ]);
  const definition = ORDER_EMAIL_EVENT_DEFINITIONS.find(
    (candidate) => candidate.value === eventType
  );

  return requireAdminCustomerEmailConfirmationForDeliveries({
    action,
    actionLabel,
    confirmationToken: customerEmailConfirmationToken,
    confirmCustomerEmails: settings.confirmCustomerEmails,
    deliveries: [{
      scope: 'order',
      entityId: orderId,
      eventType,
      eventLabel: definition?.label ?? eventType,
      recipientEmail: recipientEmail === undefined ? recipientResult.rows[0]?.email : recipientEmail,
      masterEmailEnabled: settings.enabled,
      customerAudienceEnabled: settings.events[eventType]?.customer === true
    }]
  });
}

/**
 * Resolves the live quote notification configuration and customer recipient.
 * Callers must invoke this before their first mutation in the transaction.
 */
export async function requireQuoteCustomerEmailConfirmation({
  client,
  quoteRequestId,
  eventType,
  action,
  actionLabel,
  customerEmailConfirmationToken,
  recipientEmail
}: RequireQuoteCustomerEmailConfirmationInput): Promise<AdminCustomerEmailConfirmationChallenge | null> {
  const [sharedSettings, quoteSettingsResult, recipientResult] =
    await Promise.all([
      getOrderEmailSettings(client),
      client.query(
        `select config_json from quote_email_settings where key = 'default'`
      ),
      client.query('select email from quote_requests where id = $1', [
        quoteRequestId
      ])
    ]);
  const quoteSettings = normalizeQuoteEmailSettings(
    quoteSettingsResult.rows[0]?.config_json
  );
  const definition = QUOTE_EMAIL_EDITABLE_EVENT_DEFINITIONS.find(
    (candidate) => candidate.value === eventType
  );

  return requireAdminCustomerEmailConfirmationForDeliveries({
    action,
    actionLabel,
    confirmationToken: customerEmailConfirmationToken,
    confirmCustomerEmails: sharedSettings.confirmCustomerEmails,
    deliveries: [{
      scope: 'quote',
      entityId: quoteRequestId,
      eventType,
      eventLabel: definition?.label ?? eventType,
      recipientEmail: recipientEmail === undefined ? recipientResult.rows[0]?.email : recipientEmail,
      masterEmailEnabled: quoteSettings.enabled,
      customerAudienceEnabled: quoteSettings.events[eventType]?.customer === true
    }]
  });
}

export async function requireOrderAndQuoteCustomerEmailConfirmation({
  client,
  orderId,
  orderEventType,
  orderRecipientEmail,
  quoteRequestId,
  quoteEventType,
  quoteRecipientEmail,
  action,
  actionLabel,
  customerEmailConfirmationToken
}: RequireOrderAndQuoteCustomerEmailConfirmationInput): Promise<AdminCustomerEmailConfirmationChallenge | null> {
  const [sharedSettings, orderRecipientResult, quoteSettingsResult, quoteRecipientResult] =
    await Promise.all([
      getOrderEmailSettings(client),
      client.query('select email from orders where id = $1', [orderId]),
      client.query(`select config_json from quote_email_settings where key = 'default'`),
      client.query('select email from quote_requests where id = $1', [quoteRequestId])
    ]);
  const quoteSettings = normalizeQuoteEmailSettings(quoteSettingsResult.rows[0]?.config_json);
  const orderDefinition = ORDER_EMAIL_EVENT_DEFINITIONS.find(
    (candidate) => candidate.value === orderEventType
  );
  const quoteDefinition = QUOTE_EMAIL_EDITABLE_EVENT_DEFINITIONS.find(
    (candidate) => candidate.value === quoteEventType
  );

  return requireAdminCustomerEmailConfirmationForDeliveries({
    action,
    actionLabel,
    confirmationToken: customerEmailConfirmationToken,
    confirmCustomerEmails: sharedSettings.confirmCustomerEmails,
    deliveries: [
      {
        scope: 'order',
        entityId: orderId,
        eventType: orderEventType,
        eventLabel: orderDefinition?.label ?? orderEventType,
        recipientEmail: orderRecipientEmail === undefined ? orderRecipientResult.rows[0]?.email : orderRecipientEmail,
        masterEmailEnabled: sharedSettings.enabled,
        customerAudienceEnabled: sharedSettings.events[orderEventType]?.customer === true
      },
      {
        scope: 'quote',
        entityId: quoteRequestId,
        eventType: quoteEventType,
        eventLabel: quoteDefinition?.label ?? quoteEventType,
        recipientEmail: quoteRecipientEmail === undefined ? quoteRecipientResult.rows[0]?.email : quoteRecipientEmail,
        masterEmailEnabled: quoteSettings.enabled,
        customerAudienceEnabled: quoteSettings.events[quoteEventType]?.customer === true
      }
    ]
  });
}
