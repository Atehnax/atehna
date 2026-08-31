import 'server-only';

export type QuoteFeatureFlags = Readonly<{
  admin: boolean;
  publicRequests: boolean;
  onlineAcceptance: boolean;
  emailDelivery: boolean;
}>;

function isEnabled(value: string | undefined): boolean {
  return value?.trim().toLowerCase() === 'true' || value?.trim() === '1';
}

export function getQuoteFeatureFlags(): QuoteFeatureFlags {
  return {
    admin: isEnabled(process.env.QUOTE_ADMIN_ENABLED),
    publicRequests: isEnabled(process.env.QUOTE_PUBLIC_REQUESTS_ENABLED),
    onlineAcceptance: isEnabled(process.env.QUOTE_ONLINE_ACCEPTANCE_ENABLED),
    emailDelivery: isEnabled(process.env.QUOTE_EMAIL_DELIVERY_ENABLED)
  };
}

export function isQuoteAdminEnabled(): boolean {
  return getQuoteFeatureFlags().admin;
}

export function arePublicQuoteRequestsEnabled(): boolean {
  return getQuoteFeatureFlags().publicRequests;
}

export function isQuoteOnlineAcceptanceEnabled(): boolean {
  return getQuoteFeatureFlags().onlineAcceptance;
}

export function isQuoteEmailDeliveryEnabled(): boolean {
  return getQuoteFeatureFlags().emailDelivery;
}
