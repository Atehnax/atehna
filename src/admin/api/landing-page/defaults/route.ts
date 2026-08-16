import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { validateLandingPageConfigInput } from '@/shared/domain/landing/landingPage';
import { isDatabaseUnavailableError } from '@/shared/server/db';
import {
  getLandingPageDefaults,
  LandingPageDefaultsConflictError,
  revalidateLandingPageConfigCache,
  revalidateLandingPageDefaultsCache,
  updateLandingPageConfigAndDefaults
} from '@/shared/server/landingPage';
import { readRequiredJsonRecord } from '@/shared/server/requestJson';

export const dynamic = 'force-dynamic';

export async function GET() {
  const defaults = await getLandingPageDefaults();
  return NextResponse.json({ defaults });
}

export async function PUT(request: Request) {
  try {
    const body = await readRequiredJsonRecord(request);
    if (!body.ok) return body.response;

    const configInput = body.body.config;
    const errors = validateLandingPageConfigInput(configInput);
    if (errors.length > 0) {
      return NextResponse.json(
        {
          message: errors[0] ?? 'Privzete nastavitve glavne strani niso veljavne.',
          errors
        },
        { status: 400 }
      );
    }

    const hasExpectedUpdatedAt = Object.prototype.hasOwnProperty.call(body.body, 'expectedUpdatedAt');
    const expectedUpdatedAtValue = body.body.expectedUpdatedAt;
    const expectedUpdatedAt = expectedUpdatedAtValue === null
      ? null
      : typeof expectedUpdatedAtValue === 'string' && !Number.isNaN(Date.parse(expectedUpdatedAtValue))
        ? new Date(expectedUpdatedAtValue).toISOString()
        : undefined;

    if (hasExpectedUpdatedAt && expectedUpdatedAt === undefined) {
      return NextResponse.json(
        { message: 'Različica glavne strani ni veljavna.' },
        { status: 400 }
      );
    }

    const result = await updateLandingPageConfigAndDefaults(configInput, {
      request,
      ...(hasExpectedUpdatedAt ? { expectedUpdatedAt } : {})
    });

    if (result.configChanged) {
      revalidateLandingPageConfigCache();
      revalidatePath('/');
      revalidatePath('/products/[category]', 'page');
      revalidatePath('/admin/podoba/glavna');
      revalidatePath('/admin/podoba/glavna-stran');
      revalidatePath('/admin/arhiv/podoba');
    }
    if (result.defaultsChanged) {
      revalidateLandingPageDefaultsCache();
      revalidatePath('/admin/podoba/glavna-stran');
    }

    return NextResponse.json({ config: result.config, defaults: result.defaults });
  } catch (error) {
    if (error instanceof LandingPageDefaultsConflictError) {
      return NextResponse.json({ message: error.message }, { status: 409 });
    }

    console.error('Failed to update landing page defaults', error);
    const status = isDatabaseUnavailableError(error) ? 503 : 500;
    return NextResponse.json(
      { message: 'Shranjevanje privzetih nastavitev glavne strani ni uspelo.' },
      { status }
    );
  }
}
