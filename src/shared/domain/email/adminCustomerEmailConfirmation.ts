export const CUSTOMER_EMAIL_CONFIRMATION_REQUIRED_CODE =
  'CUSTOMER_EMAIL_CONFIRMATION_REQUIRED' as const;

export type AdminCustomerEmailDeliveryScope = 'order' | 'quote';
export type AdminCustomerEmailConfirmationScope =
  | AdminCustomerEmailDeliveryScope
  | 'multiple';

export type AdminCustomerEmailConfirmationDelivery = Readonly<{
  scope: AdminCustomerEmailDeliveryScope;
  entityId: number;
  eventType: string;
  eventLabel: string;
  recipientEmail: string;
}>;

export type AdminCustomerEmailConfirmationChallenge = Readonly<{
  code: typeof CUSTOMER_EMAIL_CONFIRMATION_REQUIRED_CODE;
  message: string;
  scope: AdminCustomerEmailConfirmationScope;
  action: string;
  actionLabel: string;
  eventType: string;
  eventLabel: string;
  recipientEmail: string;
  deliveries: readonly AdminCustomerEmailConfirmationDelivery[];
  confirmationToken: string;
  expiresAt: string;
}>;
