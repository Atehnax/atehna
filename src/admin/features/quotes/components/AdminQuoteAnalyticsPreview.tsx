import type { BusinessQuotePreview, BusinessQuotePreviewSummary } from '@/shared/domain/analytics/quotePreview';
import { formatSlInteger } from '@/shared/domain/formatting';
import AdminAnalyticsComparisonRow, { createAdminAnalyticsTrend } from '@/shared/ui/admin-analytics-comparison-row';
import AdminAnalyticsSummaryCard from '@/shared/ui/admin-analytics-summary-card';

const formatCount = (value: number | null) => value === null ? '—' : formatSlInteger(value);
const formatHours = (value: number | null) => value === null ? '—' : value.toFixed(1) + ' h';
const cards: { key: keyof BusinessQuotePreviewSummary; title: string; focusKey: string; format: (value: number | null) => string }[] = [
  { key: 'issued', title: 'Izdane priložnosti', focusKey: 'ponudbe-issued', format: formatCount },
  { key: 'mature', title: 'Zrele priložnosti', focusKey: 'ponudbe-mature', format: formatCount },
  { key: 'accepted', title: 'Sprejete v 30 dneh', focusKey: 'ponudbe-accepted', format: formatCount },
  { key: 'acceptanceRate', title: 'Sprejem v 30 dneh', focusKey: 'ponudbe-acceptance', format: value => value === null ? '—' : (100 * value).toFixed(1) + ' %' },
  { key: 'medianResponseHours', title: 'Mediana do izdaje', focusKey: 'ponudbe-response', format: formatHours },
  { key: 'medianDecisionHours', title: 'Mediana do sprejema', focusKey: 'ponudbe-decision', format: formatHours }
];

export default function AdminQuoteAnalyticsPreview({ preview }: { preview: BusinessQuotePreview }) {
  const { current, last30Days, previous30Days } = preview;
  return (
    <section aria-label="Ponudbe v zadnjih 90 dneh" className="mb-3 grid gap-[14px] sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      {cards.map(card => {
        const recent = last30Days[card.key];
        const previous = previous30Days?.[card.key] ?? null;
        const trend = recent !== null && previous !== null && previous > 0
          ? createAdminAnalyticsTrend(recent, previous)
          : { value: '—', direction: 'neutral' as const };
        return (
          <AdminAnalyticsSummaryCard key={card.focusKey} href={preview.href} title={card.title} metric={card.format(current[card.key])} focusKey={card.focusKey}>
            <AdminAnalyticsComparisonRow items={[{ label: '30d', value: card.format(recent), trend }]} />
          </AdminAnalyticsSummaryCard>
        );
      })}
      <p className="text-[11px] text-slate-500 sm:col-span-2 xl:col-span-6">
        Vse prve izdaje v zadnjih 90 dneh; filtri tabele ne spreminjajo kartic. Današnji dan je delen (Europe/Ljubljana). Sprejem velja za priložnosti z zaključenim 30-dnevnim opazovanjem. Mediana do sprejema vključuje vse sprejete priložnosti, tudi po 30 dneh. Noga: zadnjih 30 dni proti predhodnemu enako pretečenemu obdobju; pomišljaj pomeni nedostopno primerjavo.
      </p>
    </section>
  );
}
