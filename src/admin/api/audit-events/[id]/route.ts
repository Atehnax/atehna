import { NextResponse } from 'next/server';
import { fetchAuditEventById } from '@/shared/server/audit';

export async function GET(_request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const event = await fetchAuditEventById(decodeURIComponent(params.id ?? ''));
    if (!event) {
      return NextResponse.json({ message: 'Zapis ni bil najden.' }, { status: 404 });
    }
    return NextResponse.json({ event });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Napaka pri nalaganju zapisa.' },
      { status: 500 }
    );
  }
}
