import { localDate, validCalendarDate } from '@/shared/domain/analytics/period';

const slDateFormatter = new Intl.DateTimeFormat('sl-SI', {
  timeZone: 'Europe/Ljubljana',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit'
});

const slDateTimeFormatter = new Intl.DateTimeFormat('sl-SI', {
  timeZone: 'Europe/Ljubljana',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false
});

const formatFromParts = (value: string | Date, formatter: Intl.DateTimeFormat) => {
  const parsedDate = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsedDate.getTime())) return String(value);

  const parts = formatter.formatToParts(parsedDate);
  const day = parts.find((part) => part.type === 'day')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const year = parts.find((part) => part.type === 'year')?.value;
  const hour = parts.find((part) => part.type === 'hour')?.value;
  const minute = parts.find((part) => part.type === 'minute')?.value;

  if (!day || !month || !year) {
    return formatter.format(parsedDate).replace(',', '').replace(/\s+/g, ' ').trim();
  }

  return hour && minute
    ? `${day}.${month}.${year} ${hour}:${minute}`
    : `${day}.${month}.${year}`;
};

export const formatSlDateTime = (value: string) => {
  return formatFromParts(value, slDateTimeFormatter);
};

export const formatSlDate = (value: string) => {
  return formatFromParts(value, slDateFormatter);
};

/** Calendar day shown to administrators, independent of their browser timezone. */
export const toDateInputValue = (value: string | Date): string => {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return validCalendarDate(value) ? value : '';
  }
  const parsedDate = value instanceof Date ? value : new Date(value);
  return Number.isFinite(parsedDate.getTime()) ? localDate(parsedDate) : '';
};

/** Parse a calendar input without interpreting it as a browser-local instant. */
export const parseOrderDateInput = (value: string): string => {
  const trimmed = value.trim();
  const display = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(trimmed);
  const candidate = display ? `${display[3]}-${display[2]}-${display[1]}` : trimmed;
  return validCalendarDate(candidate) ? candidate : '';
};
