import type { HandleUploadPresignedBody } from '@vercel/blob/client';
import { NextResponse } from 'next/server';
import { parsePublicMediaUploadPayload } from '@/shared/domain/media/publicMediaUpload';
import { topLevelCatalogCategoryExistsInDatabase } from '@/shared/server/categoryShowcase';
import { handlePublicMediaUpload } from '@/shared/server/publicMediaUpload';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as HandleUploadPresignedBody;
    if (body.type !== 'blob.generate-presigned-url') {
      return NextResponse.json({ message: 'Vrsta zahtevka za nalaganje ni veljavna.' }, { status: 400 });
    }

    const payload = parsePublicMediaUploadPayload(body.payload.clientPayload);
    const response = await handlePublicMediaUpload(body, {
      expectedScope: payload.scope,
      authorize: payload.scope === 'category-image'
        ? async (policy) => {
            if (
              policy.payload.scope !== 'category-image' ||
              !(await topLevelCatalogCategoryExistsInDatabase(policy.payload.categorySlug))
            ) {
              throw new Error('Kategorija ne obstaja.');
            }
          }
        : undefined
    });
    return NextResponse.json(response);
  } catch (error) {
    console.error('Failed to authorize direct public media upload', {
      message: error instanceof Error ? error.message : 'Unknown error'
    });
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Nalaganja medija ni mogoče začeti.' },
      { status: 400 }
    );
  }
}
