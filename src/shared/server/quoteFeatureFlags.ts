import 'server-only';

import {
  resolveQuoteFeatureFlags,
  type QuoteFeatureFlags
} from '@/shared/server/serverEnvironment';

export type { QuoteFeatureFlags };

export function getQuoteFeatureFlags(): QuoteFeatureFlags {
  return resolveQuoteFeatureFlags();
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
