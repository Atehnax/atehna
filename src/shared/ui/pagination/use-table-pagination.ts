'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

type Params = {
  totalCount: number;
  storageKey: string;
  defaultPageSize: number;
  pageSizeOptions?: number[];
};

type Result = {
  page: number;
  pageSize: number;
  pageCount: number;
  setPage: (page: number) => void;
  setPageSize: (pageSize: number) => void;
};

export default function useTablePagination({
  totalCount,
  storageKey,
  defaultPageSize,
  pageSizeOptions = [defaultPageSize]
}: Params): Result {
  const [page, setPageState] = useState(1);

  const normalizedPageSizeOptions = useMemo(() =>
    Array.from(new Set(pageSizeOptions.filter((option) => Number.isFinite(option) && option > 0))).sort((a, b) => a - b),
  [pageSizeOptions]);

  const safeDefaultPageSize = normalizedPageSizeOptions.includes(defaultPageSize)
    ? defaultPageSize
    : normalizedPageSizeOptions[0] ?? defaultPageSize;
  const [pageSize, setPageSizeState] = useState(safeDefaultPageSize);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const rawValue = window.localStorage.getItem(storageKey);
    const parsedValue = Number(rawValue);
    if (normalizedPageSizeOptions.includes(parsedValue)) {
      setPageSizeState(parsedValue);
      return;
    }

    setPageSizeState(safeDefaultPageSize);
  }, [normalizedPageSizeOptions, safeDefaultPageSize, storageKey]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(storageKey, String(pageSize));
  }, [pageSize, storageKey]);

  useEffect(() => {
    if (normalizedPageSizeOptions.includes(pageSize)) return;
    setPageSizeState(safeDefaultPageSize);
  }, [normalizedPageSizeOptions, pageSize, safeDefaultPageSize]);

  const pageCount = useMemo(() => Math.max(1, Math.ceil(totalCount / pageSize)), [pageSize, totalCount]);

  useEffect(() => {
    setPageState((currentPage) => Math.min(Math.max(currentPage, 1), pageCount));
  }, [pageCount]);

  const setPage = useCallback((nextPage: number) => {
    setPageState(Math.max(1, nextPage));
  }, []);

  const setPageSize = useCallback((nextPageSize: number) => {
    if (!normalizedPageSizeOptions.includes(nextPageSize)) return;
    setPageSizeState(nextPageSize);
    setPageState(1);
  }, [normalizedPageSizeOptions]);

  return {
    page,
    pageSize,
    pageCount,
    setPage,
    setPageSize
  };
}

