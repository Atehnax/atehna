import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { isDatabaseUnavailableError } from '@/shared/server/db';
import { readRequiredJsonRecord } from '@/shared/server/requestJson';
import {
  getSiteNavigationConfig,
  revalidateSiteNavigationConfigCache,
  updateSiteNavigationConfig
} from '@/shared/server/siteNavigation';

export const dynamic = 'force-dynamic';

export async function GET() {
  const config = await getSiteNavigationConfig();
  return NextResponse.json({ config });
}

export async function PUT(request: Request) {
  try {
    const body = await readRequiredJsonRecord(request);
    if (!body.ok) return body.response;

    const result = await updateSiteNavigationConfig(body.body.config ?? body.body, { request });
    if (result.changed) {
      revalidateSiteNavigationConfigCache();
      revalidatePath('/', 'layout');
      revalidatePath('/admin/arhiv/podoba');
    }

    return NextResponse.json({ config: result.config });
  } catch (error) {
    console.error('Failed to update site navigation config', error);
    const status = isDatabaseUnavailableError(error) ? 503 : 500;
    return NextResponse.json({ message: 'Shranjevanje navigacije ni uspelo.' }, { status });
  }
}
