export const DOTS = '…' as const;

export type PaginationItem = number | typeof DOTS;

type Params = {
  page: number;
  pageCount: number;
  siblingCount?: number;
};

export default function usePaginationRange({ page, pageCount, siblingCount = 1 }: Params): PaginationItem[] {
  const totalNumbers = siblingCount * 2 + 5;

  if (pageCount <= totalNumbers) {
    return Array.from({ length: pageCount }, (_, index) => index + 1);
  }

  const leftSiblingIndex = Math.max(page - siblingCount, 1);
  const rightSiblingIndex = Math.min(page + siblingCount, pageCount);

  const showLeftDots = leftSiblingIndex > 2;
  const showRightDots = rightSiblingIndex < pageCount - 1;

  if (!showLeftDots && showRightDots) {
    const leftRange = Array.from({ length: 3 + siblingCount * 2 }, (_, index) => index + 1);
    return [...leftRange, DOTS, pageCount];
  }

  if (showLeftDots && !showRightDots) {
    const rightRangeStart = pageCount - (3 + siblingCount * 2) + 1;
    const rightRange = Array.from({ length: 3 + siblingCount * 2 }, (_, index) => rightRangeStart + index);
    return [1, DOTS, ...rightRange];
  }

  const middleRange = Array.from(
    { length: rightSiblingIndex - leftSiblingIndex + 1 },
    (_, index) => leftSiblingIndex + index
  );
  return [1, DOTS, ...middleRange, DOTS, pageCount];
}
