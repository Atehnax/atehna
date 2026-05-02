import { NextResponse } from 'next/server';
import { fetchAuditLoggingSettings, updateAuditLoggingSettings } from '@/shared/server/audit';
import { isDatabaseUnavailableError } from '@/shared/server/db';
import { readRequiredJsonRecord } from '@/shared/server/requestJson';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const settings = await fetchAuditLoggingSettings();
    return NextResponse.json(settings);
  } catch (error) {
    if (isDatabaseUnavailableError(error)) {
      return NextResponse.json({
        enabled: true,
        updatedAt: null,
        warning: 'Nastavitve dnevnika trenutno niso dosegljive, ker baza ni dosegljiva.'
      });
    }
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Napaka pri nalaganju nastavitev dnevnika.' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await readRequiredJsonRecord(request);
    if (!body.ok) return body.response;
    const payload = body.body;
    if (typeof payload.enabled !== 'boolean') {
      return NextResponse.json({ message: 'Manjka veljavna vrednost enabled.' }, { status: 400 });
    }

    const settings = await updateAuditLoggingSettings(payload.enabled);
    return NextResponse.json(settings);
  } catch (error) {
    const status = isDatabaseUnavailableError(error) ? 503 : 500;
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Shranjevanje nastavitev dnevnika ni uspelo.' },
      { status }
    );
  }
}
