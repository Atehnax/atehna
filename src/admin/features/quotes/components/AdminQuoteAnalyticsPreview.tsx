'use client';

import type { BusinessAnalyticsResponse } from '@/shared/domain/analytics/businessAnalytics';
import type { BusinessQuotePreview, BusinessQuotePreviewSummary } from '@/shared/domain/analytics/quotePreview';
import { formatSlInteger } from '@/shared/domain/formatting';
import AdminAnalyticsComparisonRow, { createAdminAnalyticsTrend } from '@/shared/ui/admin-analytics-comparison-row';
import AdminAnalyticsSummaryCard from '@/shared/ui/admin-analytics-summary-card';
import AdminPeriodSelector from '@/shared/ui/admin-period-selector';
import { businessPreviewHref, useBusinessPreviewRange } from '@/shared/ui/use-business-preview-range';

const formatCount = (value: number | null) => value === null ? '—' : formatSlInteger(value);
const formatHours = (value: number | null) => value === null ? '—' : value.toFixed(1) + ' h';
const cards: { key: keyof BusinessQuotePreviewSummary; title: string; description?: string; focusKey: string; format: (value: number | null) => string }[] = [
  { key: 'issued', title: 'Izdane ponudbe', description: 'Vsako povpraševanje štejemo enkrat, ob prvi izdaji ponudbe v izbranem obdobju.', focusKey: 'ponudbe-issued', format: formatCount },
  { key: 'mature', title: 'Ponudbe ≥ 30 dni', description: 'Ponudbe iz izbranega obdobja, od katerih prve izdaje je minilo najmanj 30 dni. Te ponudbe so osnova za delež sprejetih v 30 dneh.', focusKey: 'ponudbe-mature', format: formatCount },
  { key: 'accepted', title: 'Sprejete v 30 dneh', description: 'Med ponudbami z zaključenim 30-dnevnim opazovanjem: sprejete v 30 × 24 urah od prve izdaje.', focusKey: 'ponudbe-accepted', format: formatCount },
  { key: 'acceptanceRate', title: 'Sprejem v 30 dneh', description: 'Delež ponudb, sprejetih v 30 dneh od prve izdaje, med ponudbami z zaključenim 30-dnevnim opazovanjem.', focusKey: 'ponudbe-acceptance', format: value => value === null ? '—' : (100 * value).toFixed(1) + ' %' },
  { key: 'medianResponseHours', title: 'Mediana do izdaje', description: 'Mediana časa od prejema povpraševanja do prve izdaje ponudbe.', focusKey: 'ponudbe-response', format: formatHours },
  { key: 'medianDecisionHours', title: 'Mediana do sprejema', description: 'Mediana časa od prve izdaje do sprejema, tudi pri sprejemih po 30 dneh.', focusKey: 'ponudbe-decision', format: formatHours }
];

// Project the existing canonical response without bundling its server aggregation.
const projectSummary = ({ quotes }: BusinessAnalyticsResponse): BusinessQuotePreviewSummary => ({
  issued: quotes.mature.total + quotes.immature,
  mature: quotes.mature.total,
  accepted: quotes.mature.accepted,
  acceptanceRate: quotes.mature.rate,
  medianResponseHours: quotes.responseStatistics.median,
  medianDecisionHours: quotes.decisionStatistics.median
});

export default function AdminQuoteAnalyticsPreview({ preview }: { preview: BusinessQuotePreview }) {
  const { range, setRange, summary, loading, failed, retry } = useBusinessPreviewRange(
    preview.current, preview.asOf, projectSummary
  );
  const href = businessPreviewHref('ponudbe', range, preview.asOf);

  return (
    <section aria-label="Analitika ponudb" aria-busy={loading} className="mb-3">
      <div className="mb-3 flex flex-wrap items-end justify-end gap-2">
        {loading ? <p role="status" className="mr-auto text-xs text-slate-500">Nalaganje izbranega obdobja …</p> : null}
        {failed ? (
          <p role="alert" className="mr-auto text-xs text-red-700">
            Analitika za izbrano obdobje ni na voljo.{' '}
            <button type="button" onClick={retry} className="underline underline-offset-2">Poskusi znova</button>
          </p>
        ) : null}
        <AdminPeriodSelector value={range} onChange={setRange} ariaLabel="Obdobje analitike ponudb" />
      </div>
      <div className="grid gap-[14px] sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {cards.map(card => {
          const recent = preview.last30Days[card.key];
          const previous = preview.previous30Days?.[card.key] ?? null;
          const trend = recent !== null && previous !== null && previous > 0
            ? createAdminAnalyticsTrend(recent, previous)
            : { value: '—', direction: 'neutral' as const };
          return (
            <AdminAnalyticsSummaryCard
              key={card.focusKey}
              href={href}
              title={card.title}
              description={card.description}
              metric={card.format(summary?.[card.key] ?? null)}
              focusKey={card.focusKey}
            >
              <AdminAnalyticsComparisonRow items={[{ label: '30d', value: card.format(recent), trend }]} />
            </AdminAnalyticsSummaryCard>
          );
        })}
      </div>
    </section>
  );
}
