'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

type Params = {
  totalCount: number;
  storageKey: string;
  defaultPageSize: number;
};

type Result = {
  page: number;
  pageSize: number;
  pageCount: number;
  setPage: (page: number) => void;
  setPageSize: (pageSize: number) => void;
};

export default function useTablePagination({ totalCount, storageKey, defaultPageSize }: Params): Result {
  const [page, setPageState] = useState(1);
  const [pageSize, setPageSizeState] = useState(defaultPageSize);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const rawValue = window.localStorage.getItem(storageKey);
    const parsedValue = Number(rawValue);
    if (Number.isFinite(parsedValue) && parsedValue > 0) {
      setPageSizeState(parsedValue);
    }
  }, [storageKey]);

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
    setPageSizeState(nextPageSize);
    setPageState(1);
  }, []);

  return {
    page,
    pageSize,
    pageCount,
    setPage,
    setPageSize
  };
}

