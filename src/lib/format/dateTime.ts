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
