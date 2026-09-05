import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import {
  normalizeCategoryShowcaseMediaSettings,
  validateCategoryShowcaseMediaSettings
} from '@/shared/features/category-showcase/categoryShowcaseSchema';
import {
  CATEGORY_SHOWCASE_REVALIDATE_PATHS,
  CATEGORY_SHOWCASE_TAG,
  CategoryShowcaseConflictError,
  updateTopLevelCategoryPresentations,
  type TopLevelCategoryPresentationUpdate
} from '@/shared/server/catalogCategories';
import { recordCatalogInvalidation } from '@/shared/server/diagnostics/instrumentation';
import {
  getCategoryShowcaseItemsFromDatabase,
} from '@/shared/server/categoryShowcase';
import { readRequiredJsonRecord } from '@/shared/server/requestJson';

export const runtime = 'nodejs';

function sanitizeSlug(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9-čšžćđ]/gi, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
}

export async function GET(request: Request) {
  try {
    const requestedSlugs = Array.from(new Set(
      new URL(request.url).searchParams.get('slugs')
        ?.split(',')
        .map(sanitizeSlug)
        .filter(Boolean) ?? []
    )).slice(0, 24);
    if (requestedSlugs.length === 0) {
      return NextResponse.json({ message: 'Manjkajo kategorije za osvežitev.' }, { status: 400 });
    }

    const requested = new Set(requestedSlugs);
    const updates = (await getCategoryShowcaseItemsFromDatabase('/api/admin/categories/images:get'))
      .filter((item) => requested.has(item.slug))
      .map((item) => ({
        categoryId: item.id,
        categorySlug: item.slug,
        image: item.image,
        presentation: item.presentation,
        revision: item.revision
      }));
    return NextResponse.json({ ok: true, updates });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Osveževanje videza kategorij ni uspelo.' },
      { status: 500 }
    );
  }
}


export async function PATCH(request: Request) {
  try {
    const payloadResult = await readRequiredJsonRecord(request);
    if (!payloadResult.ok) return payloadResult.response;

    const rawUpdates = Array.isArray(payloadResult.body.updates) ? payloadResult.body.updates : [];
    if (rawUpdates.length === 0 || rawUpdates.length > 24) {
      return NextResponse.json({ message: 'Manjkajo veljavne spremembe slik.' }, { status: 400 });
    }

    const updates: TopLevelCategoryPresentationUpdate[] = [];
    const seenIds = new Set<string>();
    const seenSlugs = new Set<string>();
    for (const rawUpdate of rawUpdates) {
      if (!rawUpdate || typeof rawUpdate !== 'object' || Array.isArray(rawUpdate)) {
        return NextResponse.json({ message: 'Neveljavna sprememba slike.' }, { status: 400 });
      }
      const record = rawUpdate as Record<string, unknown>;
      const categoryId = typeof record.categoryId === 'string' ? record.categoryId.trim() : '';
      const categorySlug = typeof record.categorySlug === 'string' ? sanitizeSlug(record.categorySlug) : '';
      const hasImage = Object.prototype.hasOwnProperty.call(record, 'image');
      const hasPresentation = Object.prototype.hasOwnProperty.call(record, 'presentation');
      const hasExpectedRevision = Object.prototype.hasOwnProperty.call(record, 'expectedRevision');
      const expectedRevision = typeof record.expectedRevision === 'string'
        ? record.expectedRevision.trim().toLowerCase()
        : undefined;
      const image = record.image === null ? null : typeof record.image === 'string' ? record.image.trim() : undefined;

      if (
        (!categoryId && !categorySlug) ||
        (categoryId && (!/^[a-z0-9:_-]{1,160}$/i.test(categoryId) || seenIds.has(categoryId))) ||
        (categorySlug && seenSlugs.has(categorySlug)) ||
        (!hasImage && !hasPresentation) ||
        (hasExpectedRevision && (!expectedRevision || !/^[a-f0-9]{32}$/.test(expectedRevision))) ||
        (hasImage && (image === undefined || (image !== null && (image.length > 2048 || !/^(https?:\/\/|\/)/i.test(image)))))
      ) {
        return NextResponse.json({ message: 'Neveljavna sprememba predstavitve kategorije.' }, { status: 400 });
      }

      if (hasPresentation) {
        const errors = validateCategoryShowcaseMediaSettings(record.presentation);
        if (errors.length > 0) {
          return NextResponse.json({ message: errors[0], errors }, { status: 400 });
        }
      }
      if (categoryId) seenIds.add(categoryId);
      if (categorySlug) seenSlugs.add(categorySlug);
      updates.push({
        ...(categoryId ? { categoryId } : {}),
        ...(categorySlug ? { categorySlug } : {}),
        ...(expectedRevision ? { expectedRevision } : {}),
        ...(hasImage ? { image } : {}),
        ...(hasPresentation ? { presentation: normalizeCategoryShowcaseMediaSettings(record.presentation) } : {})
      });
    }

    const saved = await updateTopLevelCategoryPresentations(updates);
    const imageChanged = updates.some((update) => Object.prototype.hasOwnProperty.call(update, 'image'));
    const revalidatedPaths = imageChanged ? CATEGORY_SHOWCASE_REVALIDATE_PATHS : [];
    for (const target of revalidatedPaths) revalidatePath(target.path, target.type);
    recordCatalogInvalidation({
      context: '/api/admin/categories/images:patch',
      tags: [CATEGORY_SHOWCASE_TAG],
      revalidatedPaths: revalidatedPaths.length
    });

    return NextResponse.json({ ok: true, updates: saved });
  } catch (error) {
    if (error instanceof CategoryShowcaseConflictError) {
      return NextResponse.json({ message: error.message, conflict: true }, { status: error.statusCode });
    }
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Shranjevanje slik kategorij ni uspelo.' },
      { status: 500 }
    );
  }
}
