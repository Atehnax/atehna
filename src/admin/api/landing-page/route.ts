import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { isDatabaseUnavailableError } from '@/shared/server/db';
import { readRequiredJsonRecord } from '@/shared/server/requestJson';
import {
  getLandingPageConfig,
  revalidateLandingPageConfigCache,
  updateLandingPageConfig
} from '@/shared/server/landingPage';
import { validateLandingPageConfigInput } from '@/shared/domain/landing/landingPage';

export const dynamic = 'force-dynamic';

export async function GET() {
  const config = await getLandingPageConfig();
  return NextResponse.json({ config });
}

export async function PUT(request: Request) {
  try {
    const body = await readRequiredJsonRecord(request);
    if (!body.ok) return body.response;

    const configInput = body.body.config ?? body.body;
    const errors = validateLandingPageConfigInput(configInput);
    if (errors.length > 0) {
      return NextResponse.json(
        {
          message: errors[0] ?? 'Nastavitve glavne strani niso veljavne.',
          errors
        },
        { status: 400 }
      );
    }

    const result = await updateLandingPageConfig(configInput, { request });
    if (result.changed) {
      revalidateLandingPageConfigCache();
      revalidatePath('/');
      revalidatePath('/products/[category]', 'page');
      revalidatePath('/admin/podoba/glavna');
      revalidatePath('/admin/podoba/glavna-stran');
      revalidatePath('/admin/arhiv/podoba');
    }

    return NextResponse.json({ config: result.config });
  } catch (error) {
    console.error('Failed to update landing page config', error);
    const status = isDatabaseUnavailableError(error) ? 503 : 500;
    return NextResponse.json({ message: 'Shranjevanje glavne strani ni uspelo.' }, { status });
  }
}
