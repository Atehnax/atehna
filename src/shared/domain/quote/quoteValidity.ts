const daysInUtcMonth = (year: number, monthIndex: number): number =>
  new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();

export const addOneCalendarMonth = (value: string | Date): Date | null => {
  const source = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  if (Number.isNaN(source.getTime())) return null;

  const sourceYear = source.getUTCFullYear();
  const sourceMonth = source.getUTCMonth();
  const targetMonthIndex = sourceMonth + 1;
  const targetYear = sourceYear + Math.floor(targetMonthIndex / 12);
  const targetMonth = targetMonthIndex % 12;
  const targetDay = Math.min(
    source.getUTCDate(),
    daysInUtcMonth(targetYear, targetMonth)
  );

  source.setUTCDate(1);
  source.setUTCFullYear(targetYear, targetMonth, targetDay);
  return source;
};

export const defaultQuoteValidityDateInput = (value: string | Date): string =>
  addOneCalendarMonth(value)?.toISOString().slice(0, 10) ?? '';
