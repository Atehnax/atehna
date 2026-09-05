import { redirect } from 'next/navigation';
import { BUSINESS_PERIOD_PRESETS } from '@/shared/domain/analytics/period';

export const metadata = { title: 'Ponudbe | Poslovna analitika | Atehna' };
export const dynamic = 'force-dynamic';

export default async function AdminQuoteAnalyticsPage(props: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const search = await props.searchParams;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(search ?? {})) if (typeof value === 'string') params.set(key, value);
  const requested = (params.get('range') ?? '90D').toUpperCase();
  const range = requested === '365D' ? '1Y' : requested;
  if (params.has('from') && params.has('to')) params.set('range', 'custom');
  else if ((BUSINESS_PERIOD_PRESETS as readonly string[]).includes(range)) params.set('range', range);
  else { params.set('legacyRange', requested); params.set('range', '90D'); }
  params.set('view', 'ponudbe');
  redirect('/admin/analitika?' + params.toString());
}
