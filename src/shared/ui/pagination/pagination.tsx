'use client';

import { useEffect, useState } from 'react';
import IconButton from '../icon-button/IconButton';
import Input from '../input/input';

export type PaginationProps = {
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
  variant?: 'topPills' | 'bottomBar';
  size?: 'sm' | 'md';
  showNumbers?: boolean;
  className?: string;
};

const classNames = (...parts: Array<string | false | null | undefined>) =>
  parts.filter(Boolean).join(' ');

const sizeClassMap = {
  sm: {
    icon: 'h-7 w-7',
    label: 'text-xs',
    input: 'h-7 text-xs'
  },
  md: {
    icon: 'h-10 w-10',
    label: 'text-[13px]',
    input: 'h-10 rounded-xl border-slate-200/90 px-1.5 text-[13px]'
  }
} as const;

const navButtonClassMap = {
  sm: 'group border-0 bg-transparent text-slate-600 shadow-none active:bg-[color:var(--hover-neutral)] disabled:bg-transparent disabled:text-slate-400 disabled:opacity-70',
  md: 'group rounded-xl border-slate-200/90 bg-white text-slate-600 shadow-none hover:border-slate-300 hover:bg-slate-50 active:bg-slate-100 disabled:border-slate-200/80 disabled:bg-white disabled:text-slate-400 disabled:opacity-70'
} as const;

function NavIcon({ direction }: { direction: 'first' | 'prev' | 'next' | 'last' }) {
  if (direction === 'first') return <span aria-hidden="true" className="font-normal transition-all group-hover:font-semibold">«</span>;
  if (direction === 'prev') return <span aria-hidden="true" className="font-normal transition-all group-hover:font-semibold">‹</span>;
  if (direction === 'next') return <span aria-hidden="true" className="font-normal transition-all group-hover:font-semibold">›</span>;
  return <span aria-hidden="true" className="font-normal transition-all group-hover:font-semibold">»</span>;
}

export default function Pagination({
  page,
  pageCount,
  onPageChange,
  variant = 'bottomBar',
  size = 'md',
  className
}: PaginationProps) {
  const safePageCount = Math.max(pageCount, 1);
  const safePage = Math.min(Math.max(page, 1), safePageCount);
  const [pageInput, setPageInput] = useState(String(safePage));
  const pageInputDigits = Math.max(pageInput.length, String(safePageCount).length);
  const pageInputWidthCh = Math.max(3.9375, (pageInputDigits + 0.2) * 2.25);

  useEffect(() => {
    setPageInput(String(safePage));
  }, [safePage]);

  const commitPageInput = () => {
    const parsed = Number(pageInput);
    if (!Number.isFinite(parsed)) {
      setPageInput(String(safePage));
      return;
    }
    const clamped = Math.min(Math.max(Math.trunc(parsed), 1), safePageCount);
    setPageInput(String(clamped));
    if (clamped !== safePage) {
      onPageChange(clamped);
    }
  };

  return (
    <div
      className={classNames(
        'flex items-center gap-2',
        variant === 'topPills' ? 'justify-end' : 'justify-between',
        className
      )}
    >
      <div className="inline-flex items-center gap-1.5 text-slate-600">
        <span className={sizeClassMap[size].label}>Stran</span>
        <Input
          value={pageInput}
          inputMode="numeric"
          pattern="[0-9]*"
          aria-label="Številka strani"
          className={classNames(sizeClassMap[size].input, '!w-auto min-w-0 flex-none px-0.5 text-center font-semibold leading-none tabular-nums')}
          style={{ width: `${pageInputWidthCh}ch`, minWidth: `${pageInputWidthCh}ch`, maxWidth: `${pageInputWidthCh}ch` }}
          onChange={(event) => setPageInput(event.target.value.replace(/[^0-9]/g, ''))}
          onBlur={commitPageInput}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              commitPageInput();
            }
          }}
        />
        <span className={sizeClassMap[size].label}>od {safePageCount}</span>
      </div>

      <div className="inline-flex items-center gap-0.5">
        <IconButton
          type="button"
          tone="neutral"
          shape="square"
          size={size === 'sm' ? 'sm' : 'md'}
          onClick={() => onPageChange(1)}
          disabled={safePage <= 1}
          className={classNames(navButtonClassMap[size], sizeClassMap[size].icon)}
          aria-label="Prva stran"
          title="Prva stran"
        >
          <NavIcon direction="first" />
        </IconButton>

        <IconButton
          type="button"
          tone="neutral"
          shape="square"
          size={size === 'sm' ? 'sm' : 'md'}
          onClick={() => onPageChange(safePage - 1)}
          disabled={safePage <= 1}
          className={classNames(navButtonClassMap[size], sizeClassMap[size].icon)}
          aria-label="Prejšnja stran"
          title="Prejšnja stran"
        >
          <NavIcon direction="prev" />
        </IconButton>

        <IconButton
          type="button"
          tone="neutral"
          shape="square"
          size={size === 'sm' ? 'sm' : 'md'}
          onClick={() => onPageChange(safePage + 1)}
          disabled={safePage >= safePageCount}
          className={classNames(navButtonClassMap[size], sizeClassMap[size].icon)}
          aria-label="Naslednja stran"
          title="Naslednja stran"
        >
          <NavIcon direction="next" />
        </IconButton>

        <IconButton
          type="button"
          tone="neutral"
          shape="square"
          size={size === 'sm' ? 'sm' : 'md'}
          onClick={() => onPageChange(safePageCount)}
          disabled={safePage >= safePageCount}
          className={classNames(navButtonClassMap[size], sizeClassMap[size].icon)}
          aria-label="Zadnja stran"
          title="Zadnja stran"
        >
          <NavIcon direction="last" />
        </IconButton>
      </div>
    </div>
  );
}
