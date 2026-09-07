import { localDate, localInstant, validCalendarDate } from './period';

export type BusinessAnalyticsSettings = { quoteGoLiveDate: string | null; revision: string; updatedAt: string | null };
export const EMPTY_BUSINESS_ANALYTICS_SETTINGS: BusinessAnalyticsSettings = { quoteGoLiveDate: null, revision: '0', updatedAt: null };
export class BusinessSettingsInputError extends Error {}

export function parseQuoteGoLiveDate(value: unknown, today = localDate(new Date())): string | null {
  if (value === null) return null;
  if (typeof value !== 'string' || !validCalendarDate(value) || value > today) {
    throw new BusinessSettingsInputError('Izberite veljaven datum začetka, ki ni v prihodnosti.');
  }
  return value;
}
export function quoteAnalyticsStart(value: string | null): string | null {
  return value && validCalendarDate(value) ? localInstant(value).toISOString() : null;
}
