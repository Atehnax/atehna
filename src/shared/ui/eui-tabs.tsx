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
  surface?: 'page' | 'panel';
  tabClassName?: string;
};

export default function EuiTabs({ value, onChange, tabs, className, surface = 'page', tabClassName }: EuiTabsProps) {
  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, currentIndex: number) => {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
    event.preventDefault();
    const direction = event.key === 'ArrowRight' ? 1 : -1;
    const nextIndex = (currentIndex + direction + tabs.length) % tabs.length;
    onChange(tabs[nextIndex]?.value ?? value);
  };

  const activeRaisedSurfaceClassName = surface === 'panel'
    ? '!border-b-white bg-white'
    : '!border-b-[color:var(--bg)] bg-[color:var(--bg)]';

  return (
    <div
      role="tablist"
      aria-orientation="horizontal"
      className={`relative flex w-full items-end gap-0 border-b border-slate-200 ${className ?? ''}`.trim()}
    >
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
            className={
              `relative z-10 -mb-px inline-flex h-[42px] min-w-[118px] items-center justify-center rounded-t-lg border px-6 font-['Inter',system-ui,sans-serif] text-[13px] leading-4 transition ${tabClassName ?? ''} ${
                active
                  ? `border-slate-200 ${activeRaisedSurfaceClassName} font-semibold text-[color:var(--blue-500)]`
                  : 'border-transparent bg-transparent font-semibold text-slate-600 hover:text-slate-900 active:text-slate-900'
              }`
            }
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

export type { EuiTabItem, EuiTabsProps };
