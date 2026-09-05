import { NextResponse } from 'next/server';
export const runtime = 'nodejs';
export const maxDuration = 300;
export async function GET(request: Request) {
  if (!process.env.CRON_SECRET || request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) return NextResponse.json({ message: 'Nedovoljen dostop.' }, { status: 401 });
  try {
    const { importGeographyReference } = await import('@/shared/server/geographyReference');
    return NextResponse.json(await importGeographyReference(), { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('Geography reference refresh failed', error);
    return NextResponse.json({ message: 'Osvežitev uradnih geografskih podatkov ni uspela; zadnja veljavna različica je ohranjena.' }, { status: 503 });
  }
}
