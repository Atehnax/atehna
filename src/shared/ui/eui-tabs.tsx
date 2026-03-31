'use client';

import dynamic from 'next/dynamic';

const ElasticTabs = dynamic(() => import('@elastic/eui').then((module) => module.EuiTabs), { ssr: false });
const ElasticTab = dynamic(() => import('@elastic/eui').then((module) => module.EuiTab), { ssr: false });

type EuiTabItem = {
  value: string;
  label: string;
};

type EuiTabsProps = {
  value: string;
  onChange: (next: string) => void;
  tabs: EuiTabItem[];
  className?: string;
};

export default function EuiTabs({ value, onChange, tabs, className }: EuiTabsProps) {
  if (typeof window === 'undefined') {
    return (
      <div className={`inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white p-1 ${className ?? ''}`.trim()}>
        {tabs.map((tab) => {
          const active = tab.value === value;
          return (
            <button
              key={tab.value}
              type="button"
              onClick={() => onChange(tab.value)}
              className={`rounded-md px-3 py-1.5 text-xs transition ${
                active
                  ? 'bg-[#e9efff] text-[#3659d6] font-semibold'
                  : 'text-slate-700 hover:bg-[color:var(--hover-neutral)]'
              }`}
              aria-pressed={active}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <ElasticTabs className={`admin-eui-tabs ${className ?? ''}`.trim()}>
      {tabs.map((tab) => {
        const active = tab.value === value;
        return (
          <ElasticTab
            key={tab.value}
            onClick={() => onChange(tab.value)}
            isSelected={active}
            className="admin-eui-tab"
          >
            {tab.label}
          </ElasticTab>
        );
      })}
    </ElasticTabs>
  );
}

export type { EuiTabItem, EuiTabsProps };
