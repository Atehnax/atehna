import { revalidatePath } from 'next/cache';
import { NextResponse } from 'next/server';
import { validateSiteLogoConfigInput } from '@/shared/domain/logo/siteLogo';
import { isDatabaseUnavailableError } from '@/shared/server/db';
import { readRequiredJsonRecord } from '@/shared/server/requestJson';
import {
  getSiteLogoConfig,
  revalidateSiteLogoConfigCache,
  updateSiteLogoConfig
} from '@/shared/server/siteLogo';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({ config: await getSiteLogoConfig() });
}

export async function PUT(request: Request) {
  try {
    const body = await readRequiredJsonRecord(request);
    if (!body.ok) return body.response;
    const configInput = body.body.config ?? body.body;
    const errors = validateSiteLogoConfigInput(configInput);
    if (errors.length > 0) {
      return NextResponse.json(
        { message: errors[0] ?? 'Nastavitve logotipa niso veljavne.', errors },
        { status: 400 }
      );
    }

    const result = await updateSiteLogoConfig(configInput, { request });
    if (result.changed) {
      revalidateSiteLogoConfigCache();
      revalidatePath('/', 'layout');
      revalidatePath('/admin/podoba/logotip');
      revalidatePath('/admin/arhiv/podoba');
      revalidatePath('/favicon.ico');
      revalidatePath('/icon');
      revalidatePath('/apple-icon');
      revalidatePath('/manifest.webmanifest');
    }
    return NextResponse.json({ config: result.config });
  } catch (error) {
    console.error('Failed to update site logo config', error);
    return NextResponse.json(
      { message: 'Shranjevanje nastavitev logotipa ni uspelo.' },
      { status: isDatabaseUnavailableError(error) ? 503 : 500 }
    );
  }
}
