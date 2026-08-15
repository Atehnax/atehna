'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ALL_PAGE_SIZE,
  isAllPageSize,
  normalizePageSizeOptions,
  parsePageSizeValue,
  resolvePageSize,
  type PageSizeValue
} from '@/shared/domain/pagination';

type Params = {
  totalCount: number;
  storageKey: string;
  defaultPageSize: number;
  pageSizeOptions: readonly number[];
};

type Result = {
  page: number;
  pageSize: number;
  pageSizeSelection: PageSizeValue;
  pageCount: number;
  setPage: (page: number) => void;
  setPageSize: (pageSize: PageSizeValue) => void;
};

export default function useTablePagination({ totalCount, storageKey, defaultPageSize, pageSizeOptions }: Params): Result {
  const normalizedPageSizeOptions = useMemo(
    () => normalizePageSizeOptions(pageSizeOptions),
    [pageSizeOptions]
  );

  const safeDefaultPageSize = parsePageSizeValue(defaultPageSize, normalizedPageSizeOptions);
  const fallbackPageSize = isAllPageSize(safeDefaultPageSize)
    ? (normalizedPageSizeOptions[0] ?? 50)
    : (safeDefaultPageSize ?? normalizedPageSizeOptions[0] ?? 50);
  const [page, setPageState] = useState(1);
  const [pageSizeSelection, setPageSizeSelection] = useState<PageSizeValue>(fallbackPageSize);
  const [restoredStorageKey, setRestoredStorageKey] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const rawValue = window.localStorage.getItem(storageKey);
      if (rawValue !== null) {
        const parsedValue = parsePageSizeValue(rawValue, normalizedPageSizeOptions);
        if (parsedValue !== null) setPageSizeSelection(parsedValue);
      }
    } catch {
      // Browsers may block local storage; the configured default remains usable.
    } finally {
      setRestoredStorageKey(storageKey);
    }
  }, [normalizedPageSizeOptions, storageKey]);

  useEffect(() => {
    setPageSizeSelection((currentPageSize) => {
      if (isAllPageSize(currentPageSize)) return ALL_PAGE_SIZE;
      return parsePageSizeValue(currentPageSize, normalizedPageSizeOptions) ?? fallbackPageSize;
    });
  }, [fallbackPageSize, normalizedPageSizeOptions]);

  useEffect(() => {
    if (typeof window === 'undefined' || restoredStorageKey !== storageKey) return;
    try {
      window.localStorage.setItem(storageKey, String(pageSizeSelection));
    } catch {
      // Pagination remains functional when local storage is unavailable.
    }
  }, [pageSizeSelection, restoredStorageKey, storageKey]);

  const safeTotalCount = Number.isFinite(totalCount) ? Math.max(0, Math.floor(totalCount)) : 0;
  const pageSize = resolvePageSize(pageSizeSelection, safeTotalCount);

  const pageCount = useMemo(
    () => (isAllPageSize(pageSizeSelection) ? 1 : Math.max(1, Math.ceil(safeTotalCount / pageSize))),
    [pageSize, pageSizeSelection, safeTotalCount]
  );

  useEffect(() => {
    setPageState((currentPage) => Math.min(Math.max(currentPage, 1), pageCount));
  }, [pageCount]);

  const setPage = useCallback((nextPage: number) => {
    setPageState(Math.max(1, nextPage));
  }, []);

  const setPageSize = useCallback((nextPageSize: PageSizeValue) => {
    const parsedPageSize = parsePageSizeValue(nextPageSize, normalizedPageSizeOptions);
    if (parsedPageSize === null) return;
    setPageSizeSelection(parsedPageSize);
    setPageState(1);
  }, [normalizedPageSizeOptions]);

  return {
    page,
    pageSize,
    pageSizeSelection,
    pageCount,
    setPage,
    setPageSize
  };
}
