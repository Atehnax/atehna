import Link from 'next/link';
import { fetchBusinessRecords } from '@/shared/server/businessAnalytics';
import { getCustomerTypeLabel } from '@/shared/domain/order/customerType';
import { getStatusLabel } from '@/shared/domain/order/orderStatus';

const filterLabels: Record<string, string> = { customerType: 'Tip naročnika', status: 'Status', source: 'Potek', entrySource: 'Način vnosa', history: 'Zgodovina', from: 'Od', to: 'Do', date: 'Dan', area: 'Geografsko območje', basis: 'Populacija', productKey: 'Artikel', customerKey: 'Naročnik', min: 'Spodnja meja', max: 'Zgornja meja', cohort: 'Kohorta', cohortMonth: 'Mesec kohorte' };
const filterValues: Record<string, string> = { direct: 'Neposredno', quote: 'Iz ponudbe', website: 'Splet', manual: 'Ročno', unknown: 'Neznano', historical: 'Zgodovinska', current: 'Tekoča', realised: 'Realizirana naročila', activity: 'Naročila', paid: 'Plačana naročila', mature: 'Zrele ponudbe', issued: 'Prvič izdane ponudbe', lorenz: 'Realizirano blago pred vračili' };

/** Exact canonical selection, including archived orders and excluding the trash. */
export default async function AdminBusinessOrderList({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) if (typeof value === 'string') query.set(key, value);
  const kind = query.get('kind') ?? 'orders';
  const title = kind === 'requests' ? 'Povpraševanja' : kind === 'quotes' ? 'Ponudbe' : 'Naročila';
  const dateLabel = kind === 'requests' ? 'Datum prejema' : kind === 'quotes' ? 'Prva izdaja' : 'Datum naročila';
  const backQuery = new URLSearchParams(query);
  for (const key of ['analytics', 'page', 'basis', 'area', 'date', 'orderId', 'quoteId', 'min', 'max', 'productKey', 'customerKey', 'cohort', 'cohortMonth', 'kind', 'topCustomerCount', 'lorenzPopulation']) backQuery.delete(key);
  if (kind === 'orders' && query.get('view') === 'zemljevid' && query.get('basis') === 'paid') backQuery.set('basis', 'paid');
  if (kind !== 'orders') backQuery.set('view', 'ponudbe');
  const result = await fetchBusinessRecords(query).catch((error: unknown) => {
    console.error('Canonical order selection unavailable', error);
    return null;
  });
  if (!result) return <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">Analitičnega izbora ni mogoče naložiti. Filtri niso bili prezrti. <Link className="underline" href={`/admin/analitika?${backQuery}`}>Nazaj na analitiko</Link></div>;
  query.set('asOf', result.asOf);
  const exportQuery = new URLSearchParams(query); exportQuery.set('format', 'csv');
  const pageHref = (page: number) => { const next = new URLSearchParams(query); next.set('page', String(page)); return `/admin/orders?${next}`; };
  const datetime = new Intl.DateTimeFormat('sl-SI', { timeZone: 'Europe/Ljubljana', dateStyle: 'medium', timeStyle: 'short' });
  const money = new Intl.NumberFormat('sl-SI', { style: 'currency', currency: 'EUR' });
  const filters = [...query].filter(([key, value]) => !['analytics', 'asOf', 'page', 'view', 'range', 'kind'].includes(key) && !['all', ''].includes(value));
  return <section className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h1 className="text-2xl font-semibold">{title} — analitični izbor</h1><p className="mt-1 text-sm text-slate-500">Zapisi: {result.total} · {result.period.from}–{result.period.to} · Europe/Ljubljana</p></div>
      <div className="flex gap-3 text-sm"><Link href={`/admin/analitika?${backQuery}`} className="text-blue-700 underline">Nazaj na analitiko</Link><Link href="/admin/orders" className="text-blue-700 underline">Počisti izbor</Link><a href={`/api/admin/analytics/business/records?${exportQuery}`} className="text-blue-700 underline">Izvozi CSV</a></div>
    </div>
    <div className="flex flex-wrap gap-2 text-xs">{filters.map(([key, value]) => <span key={key} className="rounded-full bg-slate-100 px-3 py-1">{filterLabels[key] ?? key}: {key === 'customerType' ? value === 'unknown' ? 'Neznano' : getCustomerTypeLabel(value) : key === 'status' ? getStatusLabel(value) : filterValues[value] ?? value}</span>)}</div>
    <p className="text-xs text-slate-500">{kind === 'orders' ? 'Obdobje določa prikazani datum naročila, tudi pri realizaciji. Arhivirana naročila ostanejo vključena; koš, osnutki in testi so izključeni.' : kind === 'requests' ? 'Povpraševanja po datumu prejema od nastavljenega začetka; brez testov in zgodovinskih vnosov.' : 'Ponudbe po prvi izdaji od nastavljenega začetka, vsako povpraševanje enkrat; brez testov in zgodovinskih vnosov.'} Vrednosti blaga so po popustih, brez DDV in poštnine.</p>
    <div className="overflow-x-auto rounded-xl border border-slate-200"><table className="w-full border-collapse text-left text-sm">
      <caption className="sr-only">{title}, ki ustrezajo vsem analitičnim filtrom</caption>
      <thead className="bg-slate-50 text-xs text-slate-500"><tr>{['Številka', dateLabel, 'Naročnik', 'Tip', 'Status', 'Potek', 'Način vnosa', 'Zgodovina', 'Vrednost'].map(label => <th key={label} scope="col" className="px-4 py-3 font-medium">{label}</th>)}</tr></thead>
      <tbody>{result.records.map(record => <tr key={record.id} className="border-t border-slate-100">
        <td className="px-4 py-3"><Link className="text-blue-700 underline" href={record.href}>{record.number}</Link></td>
        <td className="whitespace-nowrap px-4 py-3">{datetime.format(new Date(record.date))}</td><td className="px-4 py-3">{record.customerName}</td>
        <td className="px-4 py-3">{record.customerType === 'unknown' ? 'Neznano' : getCustomerTypeLabel(record.customerType)}</td>
        <td className="px-4 py-3">{kind !== 'orders' || getStatusLabel(record.status) === 'Neznano' ? record.status : getStatusLabel(record.status)}</td>
        <td className="px-4 py-3">{record.source === 'quote' ? 'Iz ponudbe' : 'Neposredno'}</td>
        <td className="px-4 py-3">{record.entrySource === 'website' ? 'Splet' : record.entrySource === 'manual' ? 'Ročno' : 'Neznano'}</td>
        <td className="px-4 py-3">{record.isHistorical === undefined ? '—' : record.isHistorical ? 'Zgodovinsko' : 'Tekoče'}</td>
        <td className="whitespace-nowrap px-4 py-3 tabular-nums">{record.value === null ? '—' : result.valueUnit && result.valueUnit !== 'EUR' ? `${record.value.toFixed(2)} ${result.valueUnit}` : money.format(record.value)}</td>
      </tr>)}{!result.records.length && <tr><td colSpan={9} className="px-4 py-8 text-center text-slate-500">Ni ujemajočih se zapisov.</td></tr>}</tbody>
    </table></div>
    <nav aria-label="Strani analitičnega izbora" className="flex justify-between text-sm">{result.page > 1 ? <Link className="text-blue-700 underline" href={pageHref(result.page - 1)}>Prejšnja stran</Link> : <span />}<span>Stran {result.page} / {Math.max(1, Math.ceil(result.total / result.pageSize))}</span>{result.page * result.pageSize < result.total ? <Link className="text-blue-700 underline" href={pageHref(result.page + 1)}>Naslednja stran</Link> : <span />}</nav>
  </section>;
}
