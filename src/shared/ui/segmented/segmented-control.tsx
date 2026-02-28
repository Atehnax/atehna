'use client';

import { useRef, type KeyboardEvent } from 'react';

type SegmentedOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

export type SegmentedControlProps = {
  value: string;
  onChange: (value: string) => void;
  options: SegmentedOption[];
  size?: 'sm' | 'md';
  className?: string;
};

const classNames = (...parts: Array<string | false | null | undefined>) =>
  parts.filter(Boolean).join(' ');

const sizeClassMap = {
  sm: {
    root: 'h-8 px-1 gap-1 rounded-full',
    item: 'px-3 py-1 text-xs rounded-full'
  },
  md: {
    root: 'h-9 px-1 gap-1 rounded-lg',
    item: 'px-3 py-1.5 text-sm rounded-md'
  }
} as const;

export default function SegmentedControl({ value, onChange, options, size = 'md', className }: SegmentedControlProps) {
  const rootRef = useRef<HTMLDivElement>(null);

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
    const root = rootRef.current;
    if (!root) return;

    const buttons = Array.from(root.querySelectorAll<HTMLButtonElement>('button:not([disabled])'));
    const currentIndex = buttons.findIndex((button) => button === event.currentTarget);
    if (currentIndex === -1) return;

    event.preventDefault();
    const direction = event.key === 'ArrowRight' ? 1 : -1;
    const nextIndex = (currentIndex + direction + buttons.length) % buttons.length;
    const nextButton = buttons[nextIndex];
    nextButton.focus();
    const nextValue = nextButton.dataset.value;
    if (nextValue) onChange(nextValue);
  };

  return (
    <div
      ref={rootRef}
      className={classNames(
        'inline-flex items-center border border-slate-300 bg-white',
        sizeClassMap[size].root,
        className
      )}
      role="group"
    >
      {options.map((option) => {
        const isActive = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            data-value={option.value}
            disabled={option.disabled}
            onClick={() => onChange(option.value)}
            onKeyDown={handleKeyDown}
            className={classNames(
              'font-semibold transition focus-visible:border focus-visible:border-[#5d3ed6] focus-visible:outline-none focus-visible:ring-0',
              sizeClassMap[size].item,
              isActive ? 'border border-[#5d3ed6] bg-[#f8f7fc] text-[#5d3ed6]' : 'text-slate-700 hover:bg-slate-100',
              option.disabled && 'cursor-not-allowed opacity-50'
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
