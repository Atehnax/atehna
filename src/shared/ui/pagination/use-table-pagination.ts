'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

type Params = {
  totalCount: number;
  storageKey: string;
  defaultPageSize: number;
  pageSizeOptions: number[];
};

type Result = {
  page: number;
  pageSize: number;
  pageCount: number;
  setPage: (page: number) => void;
  setPageSize: (pageSize: number) => void;
};

export default function useTablePagination({ totalCount, storageKey, defaultPageSize, pageSizeOptions }: Params): Result {
  const normalizedPageSizeOptions = useMemo(
    () => Array.from(new Set(pageSizeOptions.filter((option) => Number.isFinite(option) && option > 0))).sort((left, right) => left - right),
    [pageSizeOptions]
  );

  const fallbackPageSize = normalizedPageSizeOptions[0] ?? 50;

  const clampPageSize = useCallback(
    (nextPageSize: number) => (normalizedPageSizeOptions.includes(nextPageSize) ? nextPageSize : fallbackPageSize),
    [fallbackPageSize, normalizedPageSizeOptions]
  );

  const safeDefaultPageSize = clampPageSize(defaultPageSize);
  const [page, setPageState] = useState(1);
  const [pageSize, setPageSizeState] = useState(safeDefaultPageSize);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const rawValue = window.localStorage.getItem(storageKey);
    const parsedValue = Number(rawValue);
    setPageSizeState(clampPageSize(parsedValue));
  }, [clampPageSize, storageKey]);

  useEffect(() => {
    setPageSizeState((currentPageSize) => clampPageSize(currentPageSize));
  }, [clampPageSize]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(storageKey, String(pageSize));
  }, [pageSize, storageKey]);

  const pageCount = useMemo(() => Math.max(1, Math.ceil(totalCount / pageSize)), [pageSize, totalCount]);

  useEffect(() => {
    setPageState((currentPage) => Math.min(Math.max(currentPage, 1), pageCount));
  }, [pageCount]);

  const setPage = useCallback((nextPage: number) => {
    setPageState(Math.max(1, nextPage));
  }, []);

  const setPageSize = useCallback((nextPageSize: number) => {
    if (!Number.isFinite(nextPageSize) || nextPageSize <= 0) return;
    setPageSizeState(clampPageSize(nextPageSize));
    setPageState(1);
  }, [clampPageSize]);

  return {
    page,
    pageSize,
    pageCount,
    setPage,
    setPageSize
  };
}
