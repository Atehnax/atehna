import type { HandleUploadPresignedBody } from '@vercel/blob/client';
import { NextResponse } from 'next/server';
import { validateStoredCatalogImage } from '@/shared/server/catalogImageQuality';
import { getPublicMediaUploadPolicy, parsePublicMediaUploadPayload } from '@/shared/domain/media/publicMediaUpload';
import { topLevelCatalogCategoryExistsInDatabase } from '@/shared/server/categoryShowcase';
import { handlePublicMediaUpload } from '@/shared/server/publicMediaUpload';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const requestBody = await request.json();
    if (requestBody?.type === 'catalog-image.validate') {
      const payload = parsePublicMediaUploadPayload(requestBody.clientPayload, 'catalog-item');
      const policy = getPublicMediaUploadPolicy(payload);
      if (policy.mediaKind !== 'image' || policy.pathname !== requestBody.pathname || typeof requestBody.url !== 'string') {
        return NextResponse.json({ message: 'Podatki naložene slike niso veljavni.' }, { status: 400 });
      }
      const image = await validateStoredCatalogImage(requestBody.url, policy.pathname, policy.contentType);
      return NextResponse.json({ ok: true, ...image });
    }
    const body = requestBody as HandleUploadPresignedBody;
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
