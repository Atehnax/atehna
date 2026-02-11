const padTwoDigits = (value: number) => String(value).padStart(2, '0');

export const formatSlDateTime = (value: string) => {
  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) return value;

  const day = padTwoDigits(parsedDate.getDate());
  const month = padTwoDigits(parsedDate.getMonth() + 1);
  const year = parsedDate.getFullYear();
  const hour = padTwoDigits(parsedDate.getHours());
  const minute = padTwoDigits(parsedDate.getMinutes());

  return `${day}.${month}.${year} ${hour}:${minute}`;
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
