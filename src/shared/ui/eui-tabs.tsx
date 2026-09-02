'use client';

import type { KeyboardEvent, ReactNode } from 'react';
import AdminNotificationCountBadge from '@/shared/ui/admin-notification-count-badge';

type EuiTabItem = {
  value: string;
  label: ReactNode;
  panelId?: string;
  notification?: {
    count: number;
    label: string;
  };
};

type EuiTabsProps = {
  value: string;
  onChange: (next: string) => void;
  tabs: EuiTabItem[];
  className?: string;
  surface?: 'page' | 'panel';
  tabClassName?: string;
  ariaLabel?: string;
  idPrefix?: string;
};

export default function EuiTabs({
  value,
  onChange,
  tabs,
  className,
  surface = 'page',
  tabClassName,
  ariaLabel,
  idPrefix
}: EuiTabsProps) {
  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, currentIndex: number) => {
    let nextIndex: number | null = null;
    if (event.key === 'ArrowRight') {
      nextIndex = (currentIndex + 1) % tabs.length;
    } else if (event.key === 'ArrowLeft') {
      nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
    } else if (event.key === 'Home') {
      nextIndex = 0;
    } else if (event.key === 'End') {
      nextIndex = tabs.length - 1;
    }
    if (nextIndex === null) return;

    event.preventDefault();
    const nextTab = event.currentTarget
      .closest('[role="tablist"]')
      ?.querySelectorAll<HTMLButtonElement>('[role="tab"]')
      .item(nextIndex);
    onChange(tabs[nextIndex]?.value ?? value);
    nextTab?.focus();
  };

  const activeRaisedSurfaceClassName = surface === 'panel'
    ? '!border-b-white bg-white'
    : '!border-b-[color:var(--bg)] bg-[color:var(--bg)]';

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      aria-orientation="horizontal"
      className={`relative flex w-full items-end gap-0 border-b border-slate-200 ${className ?? ''}`.trim()}
    >
      {tabs.map((tab, tabIndex) => {
        const active = tab.value === value;
        const tabId = idPrefix ? `${idPrefix}-tab-${tab.value}` : undefined;
        return (
          <button
            key={tab.value}
            id={tabId}
            type="button"
            role="tab"
            aria-selected={active}
            aria-controls={tab.panelId}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(tab.value)}
            onKeyDown={(event) => onKeyDown(event, tabIndex)}
            className={
              `relative z-10 -mb-px inline-flex h-[42px] min-w-[118px] items-center justify-center rounded-t-lg border px-6 font-['Inter',system-ui,sans-serif] text-[13px] leading-4 transition ${tabClassName ?? ''} ${
                active
                  ? `border-slate-200 ${activeRaisedSurfaceClassName} font-semibold text-[color:var(--blue-500)]`
                  : 'border-transparent bg-transparent font-semibold text-slate-600 hover:text-slate-900 active:text-slate-900'
              }`
            }
          >
            {active ? (
              <span
                aria-hidden="true"
                data-eui-tab-divider-mask="true"
                className={`pointer-events-none absolute -bottom-[2px] -left-px -right-px z-20 h-[3px] ${
                  surface === 'panel' ? 'bg-white' : 'bg-[color:var(--bg)]'
                }`}
              />
            ) : null}
            <span className="inline-flex min-w-0 items-center justify-center gap-1.5">
              <span className="min-w-0">{tab.label}</span>
              {tab.notification ? (
                <AdminNotificationCountBadge
                  count={tab.notification.count}
                  label={tab.notification.label}
                />
              ) : null}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export type { EuiTabItem, EuiTabsProps };
