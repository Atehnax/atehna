import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { buildCatalogImageBlobPath, uploadBlob } from '@/shared/server/blob';
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
import { recordCatalogInvalidation } from '@/shared/server/catalogDiagnostics';
import { readRequiredJsonRecord } from '@/shared/server/requestJson';

export const runtime = 'nodejs';

const MAX_FILE_SIZE = 5 * 1024 * 1024;

function sanitizeSlug(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9-čšžćđ]/gi, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
}

function isImageFile(file: File): boolean {
  return file.type.toLowerCase().startsWith('image/');
}

function getImageExtension(file: File): string {
  const fromName = file.name.split('.').pop()?.toLowerCase();
  if (fromName && /^[a-z0-9]+$/.test(fromName)) return fromName;

  switch (file.type.toLowerCase()) {
    case 'image/jpeg':
      return 'jpg';
    case 'image/png':
      return 'png';
    case 'image/webp':
      return 'webp';
    case 'image/gif':
      return 'gif';
    case 'image/svg+xml':
      return 'svg';
    default:
      return 'bin';
  }
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');
    const categorySlugValue = formData.get('categorySlug');
    const subcategoryPathValue = formData.get('subcategoryPath');

    if (!(file instanceof File)) {
      return NextResponse.json({ message: 'Datoteka manjka.' }, { status: 400 });
    }

    if (typeof categorySlugValue !== 'string' || !categorySlugValue.trim()) {
      return NextResponse.json({ message: 'Manjka kategorija.' }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ message: 'Slika je prevelika.' }, { status: 400 });
    }

    if (!isImageFile(file)) {
      return NextResponse.json({ message: 'Dovoljene so samo slike.' }, { status: 400 });
    }

    const categorySlug = sanitizeSlug(categorySlugValue);
    const subcategoryPath =
      typeof subcategoryPathValue === 'string' && subcategoryPathValue.trim()
        ? subcategoryPathValue.split('__').map(sanitizeSlug).filter(Boolean)
        : [];

    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const extension = getImageExtension(file);
    const fileName = `${Date.now()}-${categorySlug}.${extension}`;
    const blob = await uploadBlob(
      buildCatalogImageBlobPath(categorySlug, fileName, subcategoryPath),
      fileBuffer,
      file.type || 'application/octet-stream'
    );

    return NextResponse.json({
      ok: true,
      url: blob.url,
      pathname: blob.pathname
    });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Napaka pri nalaganju slike.' },
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
    for (const target of CATEGORY_SHOWCASE_REVALIDATE_PATHS) revalidatePath(target.path, target.type);
    recordCatalogInvalidation({
      context: '/api/admin/categories/images:patch',
      tags: [CATEGORY_SHOWCASE_TAG],
      revalidatedPaths: CATEGORY_SHOWCASE_REVALIDATE_PATHS.length
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
