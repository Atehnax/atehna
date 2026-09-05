import type { BusinessOrderPreview, BusinessOrderPreviewSummary } from '@/shared/domain/analytics/orderPreview';
import { formatEuroWithSuffix, formatSlInteger } from '@/shared/domain/formatting';
import AdminAnalyticsComparisonRow, { createAdminAnalyticsTrend } from '@/shared/ui/admin-analytics-comparison-row';
import AdminAnalyticsSummaryCard from '@/shared/ui/admin-analytics-summary-card';
const count = (value: number | null) => value === null ? '—' : formatSlInteger(value);
const currency = (value: number | null) => value === null ? '—' : formatEuroWithSuffix(value);
const cards: { key: keyof BusinessOrderPreviewSummary; title: string; format: (value: number | null) => string }[] = [
  { key: 'orderCount', title: 'Oddana naročila', format: count },
  { key: 'activityValue', title: 'Vrednost oddanih', format: currency },
  { key: 'realisedValue', title: 'Realizirano neto', format: currency },
  { key: 'realisedCount', title: 'Realizirana naročila', format: count },
  { key: 'meanOrderValue', title: 'Povprečna vrednost', format: currency },
  { key: 'medianOrderValue', title: 'Mediana vrednosti', format: currency }
];
export default function AdminOrdersPreviewChart({ preview }: { preview: BusinessOrderPreview | null }) {
  if (!preview) return <p className="mb-3 text-sm text-slate-500">Analitika naročil trenutno ni na voljo.</p>;
  return <section aria-label="Naročila v zadnjih 90 dneh" className="mb-3 grid gap-[14px] sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
    {cards.map(card => {
      const recent = preview.last30Days[card.key];
      const previous = preview.previous30Days?.[card.key] ?? null;
      const trend = recent !== null && previous !== null && previous > 0 ? createAdminAnalyticsTrend(recent, previous) : { value: '—', direction: 'neutral' as const };
      return <AdminAnalyticsSummaryCard key={card.key} title={card.title} metric={card.format(preview.current[card.key])} href={preview.href} focusKey={'narocila-' + card.key}>
        <AdminAnalyticsComparisonRow items={[{ label: '30d', value: card.format(recent), trend }]} />
      </AdminAnalyticsSummaryCard>;
    })}
    <p className="text-[11px] text-slate-500 sm:col-span-2 xl:col-span-6">Vsa upravičena naročila v zadnjih 90 dneh; filtri tabele ne spreminjajo kartic. Vrednosti blaga so brez DDV in poštnine. Realizacija je vezana na izpolnitev in potrjena vračila blaga. Pomišljaj pomeni manjkajoče podatke. Noga: 30 dni proti predhodnemu enako pretečenemu obdobju; današnji dan je delen (Europe/Ljubljana).</p>
  </section>;
}
