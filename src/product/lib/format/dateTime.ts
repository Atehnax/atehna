const padTwoDigits = (value: number) => String(value).padStart(2, '0');

const toSlDateParts = (value: string) => {
  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) return null;

  const day = padTwoDigits(parsedDate.getDate());
  const month = padTwoDigits(parsedDate.getMonth() + 1);
  const year = parsedDate.getFullYear();
  const hour = padTwoDigits(parsedDate.getHours());
  const minute = padTwoDigits(parsedDate.getMinutes());

  return { day, month, year, hour, minute };
};

export const formatSlDateTime = (value: string) => {
  const parts = toSlDateParts(value);
  if (!parts) return value;

  return `${parts.day}.${parts.month}.${parts.year} ${parts.hour}:${parts.minute}`;
};

export const formatSlDate = (value: string) => {
  const parts = toSlDateParts(value);
  if (!parts) return value;

  return `${parts.day}.${parts.month}.${parts.year}`;
};

export const formatSlDateFromDateInput = (value: string) => {
  if (!value) return '—';
  const parsedDate = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsedDate.getTime())) return value;

  const day = padTwoDigits(parsedDate.getDate());
  const month = padTwoDigits(parsedDate.getMonth() + 1);
  const year = parsedDate.getFullYear();
  return `${day}.${month}.${year}`;
};

export const toDateInputValue = (value: string) => {
  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) return new Date().toISOString().slice(0, 10);
  return parsedDate.toISOString().slice(0, 10);
};



const ljubljanaDateFormatter = new Intl.DateTimeFormat('sl-SI', {
  timeZone: 'Europe/Ljubljana',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit'
});

export const formatLjubljanaDate = (value: string | Date) => {
  const dateOnlyValue = typeof value === 'string' ? value.match(/^(\d{4})-(\d{2})-(\d{2})$/) : null;
  if (dateOnlyValue) {
    const [, year, month, day] = dateOnlyValue;
    return `${day}-${month}-${year}`;
  }

  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value);

  const parts = ljubljanaDateFormatter.formatToParts(parsed);
  const day = parts.find((part) => part.type === 'day')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const year = parts.find((part) => part.type === 'year')?.value;
  if (!day || !month || !year) return ljubljanaDateFormatter.format(parsed).replace(/\./g, '-');
  return `${day}-${month}-${year}`;
};

const ljubljanaDateTimeFormatter = new Intl.DateTimeFormat('sl-SI', {
  timeZone: 'Europe/Ljubljana',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false
});

const ljubljanaTimeFormatter = new Intl.DateTimeFormat('sl-SI', {
  timeZone: 'Europe/Ljubljana',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false
});

export const formatLjubljanaDateTime = (value: string | Date, options?: { useCurrentTimeForDateOnly?: boolean }) => {
  const useCurrentTimeForDateOnly = options?.useCurrentTimeForDateOnly ?? true;
  const dateOnlyValue = typeof value === 'string' ? value.match(/^(\d{4})-(\d{2})-(\d{2})$/) : null;

  if (dateOnlyValue) {
    const [, year, month, day] = dateOnlyValue;
    const baseDate = new Date(`${year}-${month}-${day}T00:00:00`);
    if (Number.isNaN(baseDate.getTime())) return `${day}-${month}-${year} ${ljubljanaTimeFormatter.format(new Date())}`;

    if (!useCurrentTimeForDateOnly) return ljubljanaDateTimeFormatter.format(baseDate).replace(',','');

    const currentTime = ljubljanaTimeFormatter.format(new Date());
    return `${day}-${month}-${year} ${currentTime}`;
  }

  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value);
  return ljubljanaDateTimeFormatter.format(parsed).replace(',', '');
};
