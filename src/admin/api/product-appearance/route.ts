import { revalidatePath } from 'next/cache';
import { NextResponse } from 'next/server';
import { validateProductAppearanceConfigInput } from '@/shared/domain/style/productAppearance';
import { isDatabaseUnavailableError } from '@/shared/server/db';
import {
  getProductAppearanceConfig,
  revalidateProductAppearanceConfigCache,
  updateProductAppearanceConfig
} from '@/shared/server/productAppearance';
import { readRequiredJsonRecord } from '@/shared/server/requestJson';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({ config: await getProductAppearanceConfig() });
}

export async function PUT(request: Request) {
  try {
    const body = await readRequiredJsonRecord(request);
    if (!body.ok) return body.response;
    const configInput = body.body.config ?? body.body;
    const errors = validateProductAppearanceConfigInput(configInput);
    if (errors.length > 0) {
      return NextResponse.json(
        { message: errors[0] ?? 'Nastavitve prikaza artiklov niso veljavne.', errors },
        { status: 400 }
      );
    }
    const result = await updateProductAppearanceConfig(configInput, { request });
    if (result.changed) {
      revalidateProductAppearanceConfigCache();
      revalidatePath('/', 'layout');
      revalidatePath('/admin/podoba/artikli');
      revalidatePath('/admin/arhiv/podoba');
    }
    return NextResponse.json({ config: result.config });
  } catch (error) {
    console.error('Failed to update product appearance config', error);
    return NextResponse.json(
      { message: 'Shranjevanje nastavitev prikaza artiklov ni uspelo.' },
      { status: isDatabaseUnavailableError(error) ? 503 : 500 }
    );
  }
}
