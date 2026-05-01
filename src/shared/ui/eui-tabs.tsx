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
  size?: 'default' | 'compact';
  tabClassName?: string;
  tone?: 'default' | 'muted-control' | 'raised';
};

export default function EuiTabs({ value, onChange, tabs, className, surface = 'page', size = 'default', tabClassName, tone = 'raised' }: EuiTabsProps) {
  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, currentIndex: number) => {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
    event.preventDefault();
    const direction = event.key === 'ArrowRight' ? 1 : -1;
    const nextIndex = (currentIndex + direction + tabs.length) % tabs.length;
    onChange(tabs[nextIndex]?.value ?? value);
  };

  const isRaised = tone === 'raised';
  const activeRaisedSurfaceClassName = surface === 'panel'
    ? '!border-b-white bg-white'
    : '!border-b-[color:var(--bg)] bg-[color:var(--bg)]';

  return (
    <div
      role="tablist"
      aria-orientation="horizontal"
      className={
        isRaised
          ? `relative flex w-full items-end gap-0 border-b border-slate-200 ${className ?? ''}`.trim()
          : `relative inline-flex items-end ${size === 'compact' ? 'gap-4' : 'gap-5'} ${className ?? ''}`.trim()
      }
    >
      {isRaised ? null : <span aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-[2px] bg-slate-300" />}
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
              isRaised
                ? `relative z-10 -mb-px inline-flex h-[42px] min-w-[118px] items-center justify-center rounded-t-lg border px-6 font-['Inter',system-ui,sans-serif] text-[13px] leading-4 transition ${tabClassName ?? ''} ${
                  active
                    ? `border-slate-200 ${activeRaisedSurfaceClassName} font-semibold text-[#1982bf]`
                    : 'border-transparent bg-transparent font-semibold text-slate-600 hover:text-slate-900 active:text-slate-900'
                }`
                : `relative z-10 border-b-2 bg-transparent font-['Inter',system-ui,sans-serif] transition ${size === 'compact' ? 'pt-2 pb-2.5 text-[15px] leading-[22px]' : 'pb-2 text-base leading-none'} ${tabClassName ?? ''} ${
                  tone === 'muted-control'
                    ? active
                      ? 'border-[#1982bf] text-[#1982bf] font-semibold'
                      : 'border-transparent text-slate-500 font-medium hover:text-slate-700 active:text-slate-700'
                    : active
                      ? 'border-[#1982bf] text-[#1982bf] font-semibold'
                      : 'border-transparent text-black font-semibold hover:text-[#1982bf] active:text-[#1982bf]'
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
