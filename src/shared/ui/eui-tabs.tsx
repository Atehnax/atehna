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
      <div className={`inline-flex items-end gap-5 ${className ?? ''}`.trim()}>
        {tabs.map((tab) => {
          const active = tab.value === value;
          return (
            <button
              key={tab.value}
              type="button"
              onClick={() => onChange(tab.value)}
              className={`border-b-2 bg-transparent pb-2 text-base leading-none font-['Inter',system-ui,sans-serif] transition ${
                active
                  ? 'border-[#1982bf] text-[#1982bf] font-medium'
                  : 'border-slate-300 text-black hover:text-[#1982bf] active:text-[#1982bf]'
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
