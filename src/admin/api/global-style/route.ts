import { revalidatePath } from 'next/cache';
import { NextResponse } from 'next/server';
import { validateGlobalStyleConfigInput } from '@/shared/domain/style/globalStyle';
import { isDatabaseUnavailableError } from '@/shared/server/db';
import {
  getGlobalStyleConfig,
  revalidateGlobalStyleConfigCache,
  updateGlobalStyleConfig
} from '@/shared/server/globalStyle';
import { readRequiredJsonRecord } from '@/shared/server/requestJson';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({ config: await getGlobalStyleConfig() });
}

export async function PUT(request: Request) {
  try {
    const body = await readRequiredJsonRecord(request);
    if (!body.ok) return body.response;
    const configInput = body.body.config ?? body.body;
    const errors = validateGlobalStyleConfigInput(configInput);
    if (errors.length > 0) {
      return NextResponse.json(
        { message: errors[0] ?? 'Nastavitve globalnih parametrov niso veljavne.', errors },
        { status: 400 }
      );
    }
    const result = await updateGlobalStyleConfig(configInput, { request });
    if (result.changed) {
      revalidateGlobalStyleConfigCache();
      revalidatePath('/', 'layout');
      revalidatePath('/admin/podoba/globalni-parametri');
      revalidatePath('/admin/arhiv/podoba');
    }
    return NextResponse.json({ config: result.config });
  } catch (error) {
    console.error('Failed to update global style config', error);
    return NextResponse.json(
      { message: 'Shranjevanje globalnih parametrov ni uspelo.' },
      { status: isDatabaseUnavailableError(error) ? 503 : 500 }
    );
  }
}
