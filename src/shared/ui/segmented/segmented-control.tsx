'use client';

import { useRef, type KeyboardEvent } from 'react';
import { pillTokenClasses } from '@/shared/ui/theme/tokens';

type SegmentedOption = {
  value: string;
  label: string;
  disabled?: boolean;
  activeClassName?: string;
  idleClassName?: string;
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
    root: 'h-8 px-1 gap-1 rounded-xl',
    item: 'px-3 py-1 text-xs rounded-lg'
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
        pillTokenClasses.list,
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
              pillTokenClasses.itemBase,
              sizeClassMap[size].item,
              isActive
                ? classNames(pillTokenClasses.itemActive, option.activeClassName)
                : classNames(pillTokenClasses.itemIdle, option.idleClassName),
              option.disabled && 'cursor-default opacity-50'
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
