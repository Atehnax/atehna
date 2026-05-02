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

export const toDateInputValue = (value: string) => {
  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) return new Date().toISOString().slice(0, 10);
  return parsedDate.toISOString().slice(0, 10);
};
