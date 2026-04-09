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
  tone?: 'default' | 'muted-control';
};

export default function EuiTabs({ value, onChange, tabs, className, size = 'default', tabClassName, tone = 'default' }: EuiTabsProps) {
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
            className={`relative z-10 border-b-2 bg-transparent font-['Inter',system-ui,sans-serif] transition ${size === 'compact' ? 'pt-2 pb-2.5 text-[15px] leading-[22px]' : 'pb-2 text-base leading-none'} ${tabClassName ?? ''} ${
              tone === 'muted-control'
                ? active
                  ? 'border-[#1982bf] text-[#1982bf] font-semibold'
                  : 'border-transparent text-slate-500 font-medium hover:text-slate-700 active:text-slate-700'
                : active
                  ? 'border-[#1982bf] text-[#1982bf] font-semibold'
                  : 'border-transparent text-black font-semibold hover:text-[#1982bf] active:text-[#1982bf]'
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
