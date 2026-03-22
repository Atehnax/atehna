import { NextResponse } from 'next/server';
import { buildCatalogImageBlobPath, uploadBlob } from '@/shared/server/blob';

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
