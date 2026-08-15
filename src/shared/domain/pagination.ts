export const ALL_PAGE_SIZE = 'all' as const;

export type PageSizeValue = number | typeof ALL_PAGE_SIZE;

export const isAllPageSize = (value: unknown): value is typeof ALL_PAGE_SIZE => value === ALL_PAGE_SIZE;

export const normalizePageSizeOptions = (options: readonly number[]): number[] =>
  Array.from(new Set(options.filter((option) => Number.isFinite(option) && option > 0).map(Math.floor))).sort(
    (left, right) => left - right
  );

export const parsePageSizeValue = (
  value: unknown,
  numericOptions?: readonly number[]
): PageSizeValue | null => {
  if (isAllPageSize(value)) return ALL_PAGE_SIZE;

  if (value === null || value === undefined || value === '') return null;

  const parsedValue = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsedValue) || parsedValue <= 0) return null;

  const normalizedValue = Math.floor(parsedValue);
  if (numericOptions && !numericOptions.includes(normalizedValue)) return null;

  return normalizedValue;
};

export const resolvePageSize = (selection: PageSizeValue, totalCount: number): number =>
  isAllPageSize(selection) ? Math.max(1, Math.floor(totalCount)) : selection;
