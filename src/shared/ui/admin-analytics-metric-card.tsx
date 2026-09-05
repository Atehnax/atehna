import type { ReactNode } from 'react';

type Props = { title: string; metric: string; children?: ReactNode; onClick?: () => void };

/** Non-navigation metrics use the same typography and card geometry as admin list summaries. */
export default function AdminAnalyticsMetricCard({ title, metric, children, onClick }: Props) {
  const content = <>
    <p className="min-w-0 truncate whitespace-nowrap text-[11px] font-bold uppercase leading-3 tracking-[0.035em] text-[#6f7784]" title={title}>{title}</p>
    <p className="mt-2 truncate text-[27px] font-semibold leading-none tracking-[-0.035em] text-[#334155]" title={metric}>{metric}</p>
    {children && <div className="mt-2 text-[11px] leading-relaxed text-slate-500">{children}</div>}
  </>;
  const frame = "flex h-full min-h-[94px] min-w-0 flex-col rounded-[11px] border border-[#e5e7eb] bg-white px-5 py-[11px] text-left font-['Inter',system-ui,sans-serif] shadow-[0_1px_2px_rgba(15,23,42,0.05),0_8px_20px_rgba(15,23,42,0.035)]";
  return onClick ? <button type="button" aria-label={title + ': ' + metric} onClick={onClick} className={frame + ' transition hover:border-[color:var(--blue-500)] focus-visible:border-[color:var(--blue-500)] focus-visible:outline-none'}>{content}</button> : <article className={frame}>{content}</article>;
}
