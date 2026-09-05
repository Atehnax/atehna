import { NextResponse } from 'next/server';
import { fetchGeography, correctGeography, backfillGeography } from '@/shared/server/geographyAnalytics';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 300;
const headers = { 'Cache-Control': 'private, no-store' };
function csvCell(value: unknown) {
  let text = value === null || value === undefined ? '' : String(value);
  if (/^[=+@\-]/.test(text)) text = "'" + text;
  return '"' + text.replaceAll('"', '""') + '"';
}
export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const result = await fetchGeography(params);
    const format = params.get('export');
    if (format) {
      if (!['orders', 'areas'].includes(format)) return NextResponse.json({ message: 'Neveljaven izvoz.' }, { status: 400, headers });
      if (format === 'orders' && !result.selected) return NextResponse.json({ message: 'Najprej izberite območje.' }, { status: 400, headers });
      const rows = format === 'orders'
        ? [['Naročilo', 'Datum oddaje', 'Tip naročnika', 'Status', 'Vir', 'Vrednost brez DDV in poštnine EUR'], ...(result.selected?.records ?? []).map((order) => [order.number, order.date, order.customerType, order.status, order.source, order.value])]
        : [['Raven', 'Uradni EID', 'Šifra', 'Območje', 'Naročila', 'Vrednost EUR', 'Naročila z znano vrednostjo', 'Povezane stranke', 'Regijsko razrešena naročila'], ...result.areas.filter((area) => !params.get('level') || area.level === params.get('level')).map((area) => [area.level, area.id, area.code, area.name, area.orderCount, area.activityValue, area.knownValueOrders, area.distinctCustomers, area.regionOnlyOrders])];
      return new Response('\uFEFF' + rows.map((row) => row.map(csvCell).join(';')).join('\r\n'), { headers: { ...headers, 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="atehna-zemljevid.csv"' } });
    }
    return NextResponse.json(result, { headers });
  } catch (error) {
    console.error('Geography analytics failed', error);
    return NextResponse.json({ message: 'Geografska analitika ni na voljo. Preverite uvoz in migracijo podatkov.' }, { status: 503, headers });
  }
}
export async function PATCH(request: Request) {
  try {
    const body = await request.json() as Record<string, unknown>;
    if (typeof body.orderId !== 'string' || typeof body.reason !== 'string' || (body.municipalityId != null && typeof body.municipalityId !== 'string') || (body.regionId != null && typeof body.regionId !== 'string')) return NextResponse.json({ message: 'Neveljaven geografski popravek.' }, { status: 400, headers });
    const resolution = await correctGeography({ orderId: body.orderId, reason: body.reason, municipalityId: body.municipalityId as string | null, regionId: body.regionId as string | null, remove: body.remove === true });
    return NextResponse.json({ resolution }, { headers });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Popravka ni mogoče shraniti.' }, { status: 400, headers });
  }
}
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    return NextResponse.json(await backfillGeography({ retryUnresolved: body.retryUnresolved === true }), { headers });
  } catch (error) {
    console.error('Geography backfill failed', error);
    return NextResponse.json({ message: 'Dopolnjevanje geografije ni uspelo. Zadnje preslikave so ohranjene.' }, { status: 503, headers });
  }
}
