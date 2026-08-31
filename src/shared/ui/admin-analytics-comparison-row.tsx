export type AdminAnalyticsTrend = {
  value: string;
  direction: 'positive' | 'negative' | 'neutral';
};

export type AdminAnalyticsComparisonItem = {
  label: string;
  value: string;
  trend: AdminAnalyticsTrend;
};

export const createAdminAnalyticsTrend = (
  current: number,
  previous: number
): AdminAnalyticsTrend => {
  const percentage =
    !Number.isFinite(current) || !Number.isFinite(previous)
      ? 0
      : previous <= 0
        ? current > 0
          ? 100
          : 0
        : ((current - previous) / previous) * 100;
  const direction =
    percentage > 0 ? 'positive' : percentage < 0 ? 'negative' : 'neutral';

  return {
    direction,
    value: `${Intl.NumberFormat('sl-SI', {
      maximumFractionDigits: 1
    }).format(Math.abs(percentage))}%`
  };
};

function TrendBadge({ trend }: { trend: AdminAnalyticsTrend }) {
  const arrowClass =
    trend.direction === 'positive'
      ? 'border-x-[4px] border-b-[6px] border-x-transparent border-b-current text-[#409762]'
      : trend.direction === 'negative'
        ? 'border-x-[4px] border-t-[6px] border-x-transparent border-t-current text-[#d25a0b]'
        : '';

  return (
    <span
      className={`inline-flex items-center gap-1 text-[14px] font-semibold leading-none ${
        trend.direction === 'neutral'
          ? 'text-[#7c8798]'
          : trend.direction === 'positive'
            ? 'text-[#4f8d59]'
            : 'text-[#d25a0b]'
      }`}
    >
      {arrowClass ? (
        <span
          aria-hidden="true"
          className={`inline-block h-0 w-0 ${arrowClass}`}
        />
      ) : null}
      {trend.value}
    </span>
  );
}

export default function AdminAnalyticsComparisonRow({
  items
}: {
  items: AdminAnalyticsComparisonItem[];
}) {
  return (
    <div className="mt-3 flex min-w-0 flex-col gap-y-2 whitespace-nowrap text-[14px] leading-none">
      {items.map((item) => (
        <div
          key={item.label}
          className="flex min-w-0 items-center gap-2"
          data-analytics-comparison-period={item.label.toLowerCase()}
        >
          <span className="font-semibold uppercase tracking-[0.04em] text-[#707986]">
            {item.label}
          </span>
          <span
            className="font-semibold text-[#334155]"
            title={item.value}
          >
            {item.value}
          </span>
          <TrendBadge trend={item.trend} />
        </div>
      ))}
    </div>
  );
}
