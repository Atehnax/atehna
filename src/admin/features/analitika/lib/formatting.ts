import { formatEuro } from '@/shared/domain/formatting';

const numberFormatters = new Map<number, Intl.NumberFormat>();
const calendarDayFormatter = new Intl.DateTimeFormat('sl-SI', {
  timeZone: 'UTC', day: 'numeric', month: 'short', year: 'numeric'
});
const recordDateFormatter = new Intl.DateTimeFormat('sl-SI', {
  timeZone: 'Europe/Ljubljana', dateStyle: 'medium'
});

export const eur = (value: number | null | undefined) =>
  value == null || !Number.isFinite(value) ? '—' : formatEuro(value);

export function numeric(value: number | null | undefined, digits = 2): string {
  if (value == null || !Number.isFinite(value)) return '—';
  let formatter = numberFormatters.get(digits);
  if (!formatter) {
    formatter = new Intl.NumberFormat('sl-SI', { maximumFractionDigits: digits });
    // Bound cached options while preserving Intl validation for other inputs.
    if (Number.isInteger(digits) && digits >= 0 && digits <= 100) numberFormatters.set(digits, formatter);
  }
  return formatter.format(value);
}

export const percent = (value: number | null | undefined) =>
  value == null || !Number.isFinite(value * 100) ? '—' : numeric(value * 100, 1) + ' %';

/** Date-only API values retain their calendar day independently of browser timezone. */
export const formatAnalyticsCalendarDay = (date: string) =>
  calendarDayFormatter.format(new Date(date + 'T12:00:00Z'));

export const formatAnalyticsRecordDate = (value: string | number) =>
  recordDateFormatter.format(new Date(value));
