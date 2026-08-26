import { revalidatePath } from 'next/cache';
import { NextResponse } from 'next/server';
import {
  SITE_LOGO_PURPOSE_IDS,
  normalizeSiteLogoConfig,
  validateSiteLogoConfigInput
} from '@/shared/domain/logo/siteLogo';
import { isDatabaseUnavailableError } from '@/shared/server/db';
import { readRequiredJsonRecord } from '@/shared/server/requestJson';
import {
  getSiteLogoConfig,
  getSiteLogoConfigStrict,
  revalidateSiteLogoConfigCache,
  updateSiteLogoConfig
} from '@/shared/server/siteLogo';
import {
  revalidateSiteLogoArtworkCache,
  validateSiteLogoConfigContent
} from '@/shared/server/siteLogoArtwork';

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

    const normalizedConfig = normalizeSiteLogoConfig(configInput);
    const previousConfig = await getSiteLogoConfigStrict();
    try {
      await validateSiteLogoConfigContent(normalizedConfig, previousConfig);
    } catch (error) {
      const message = error instanceof Error
        ? error.message
        : 'Vsebina logotipa ni veljavna.';
      return NextResponse.json({ message, errors: [message] }, { status: 400 });
    }

    const result = await updateSiteLogoConfig(normalizedConfig, { request });
    if (result.changed) {
      revalidateSiteLogoConfigCache();
      revalidateSiteLogoArtworkCache();
      revalidatePath('/', 'layout');
      revalidatePath('/admin/podoba/logotip');
      revalidatePath('/admin/arhiv/podoba');
      revalidatePath('/favicon.ico');
      revalidatePath('/icon');
      revalidatePath('/apple-icon');
      revalidatePath('/manifest.webmanifest');
      for (const purposeId of SITE_LOGO_PURPOSE_IDS) {
        revalidatePath(`/api/site-logo/${purposeId}`);
      }
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
