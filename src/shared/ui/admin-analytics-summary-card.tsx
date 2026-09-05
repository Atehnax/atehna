import Link from 'next/link';
import type { ReactNode } from 'react';

type AdminAnalyticsSummaryCardProps = {
  href: string;
  title: string;
  description?: string;
  metric: string;
  children?: ReactNode;
  id?: string;
  focusKey?: string;
  isFocused?: boolean;
};

export default function AdminAnalyticsSummaryCard({
  href,
  title,
  description,
  metric,
  children,
  id,
  focusKey,
  isFocused = false
}: AdminAnalyticsSummaryCardProps) {
  return (
    <Link
      href={href}
      id={id}
      title={description}
      aria-description={description}
      aria-label={`${title}: ${metric}`}
      aria-current={isFocused ? 'location' : undefined}
      data-analytics-summary-card="true"
      data-focus-key={focusKey}
      data-focused={isFocused ? 'true' : 'false'}
      className={`flex h-full min-h-[94px] min-w-0 flex-col rounded-[11px] border bg-white px-5 py-[11px] text-left font-['Inter',system-ui,sans-serif] shadow-[0_1px_2px_rgba(15,23,42,0.05),0_8px_20px_rgba(15,23,42,0.035)] transition hover:-translate-y-px hover:shadow-[0_3px_8px_rgba(15,23,42,0.07),0_14px_28px_rgba(15,23,42,0.05)] focus-visible:border-[color:var(--blue-500)] focus-visible:outline-none focus-visible:ring-0 focus-visible:shadow-none ${isFocused ? 'border-[color:var(--blue-500)] ring-2 ring-blue-100' : 'border-[#e5e7eb]'}`}
    >
      <p
        className="min-w-0 truncate whitespace-nowrap text-[11px] font-bold uppercase leading-3 tracking-[0.035em] text-[#6f7784]"
        title={description ?? title}
      >
        {title}
      </p>
      <p
        className="mt-2 truncate text-[27px] font-semibold leading-none tracking-[-0.035em] text-[#334155]"
        title={metric}
      >
        {metric}
      </p>
      {children}
    </Link>
  );
}
