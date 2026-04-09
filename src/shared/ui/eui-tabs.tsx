'use client';

import type { KeyboardEvent } from 'react';

type EuiTabItem = {
  value: string;
  label: string;
};

type EuiTabsProps = {
  value: string;
  onChange: (next: string) => void;
  tabs: EuiTabItem[];
  className?: string;
  size?: 'default' | 'compact';
  tabClassName?: string;
};

export default function EuiTabs({ value, onChange, tabs, className, size = 'default', tabClassName }: EuiTabsProps) {
  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, currentIndex: number) => {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
    event.preventDefault();
    const direction = event.key === 'ArrowRight' ? 1 : -1;
    const nextIndex = (currentIndex + direction + tabs.length) % tabs.length;
    onChange(tabs[nextIndex]?.value ?? value);
  };

  return (
    <div
      role="tablist"
      aria-orientation="horizontal"
      className={`relative inline-flex items-end ${size === 'compact' ? 'gap-4' : 'gap-5'} ${className ?? ''}`.trim()}
    >
      <span aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-[2px] bg-slate-300" />
      {tabs.map((tab) => {
        const active = tab.value === value;
        return (
          <button
            key={tab.value}
            type="button"
            role="tab"
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(tab.value)}
            onKeyDown={(event) => onKeyDown(event, tabs.findIndex((entry) => entry.value === tab.value))}
            className={`relative z-10 border-b-2 bg-transparent ${size === 'compact' ? 'pb-1.5 text-sm' : 'pb-2 text-base'} leading-none font-['Inter',system-ui,sans-serif] font-semibold transition ${tabClassName ?? ''} ${
              active
                ? 'border-[#1982bf] text-[#1982bf]'
                : 'border-transparent text-black hover:text-[#1982bf] active:text-[#1982bf]'
            }`}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

export type { EuiTabItem, EuiTabsProps };
