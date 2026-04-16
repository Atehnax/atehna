import { NextResponse } from 'next/server';
import { buildCatalogItemMediaBlobPath, uploadBlob } from '@/shared/server/blob';

export const runtime = 'nodejs';

const MAX_UPLOAD_BYTES = 100 * 1024 * 1024;

function sanitizeSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-čšžćđ]/gi, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function extensionFromFile(file: File): string {
  const fromName = file.name.split('.').pop()?.toLowerCase();
  if (fromName && /^[a-z0-9]+$/.test(fromName)) return fromName;

  const [type, subtype] = file.type.toLowerCase().split('/');
  if (type && subtype) return subtype.replace(/[^a-z0-9]+/g, '');
  return 'bin';
}

function mediaFolderForMime(mimeType: string): 'images' | 'videos' | 'documents' {
  if (mimeType.startsWith('image/')) return 'images';
  if (mimeType.startsWith('video/')) return 'videos';
  return 'documents';
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');
    const itemSlugValue = formData.get('itemSlug');

    if (!(file instanceof File)) {
      return NextResponse.json({ message: 'Datoteka manjka.' }, { status: 400 });
    }

    if (typeof itemSlugValue !== 'string' || !itemSlugValue.trim()) {
      return NextResponse.json({ message: 'Manjka slug artikla.' }, { status: 400 });
    }

    if (file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json({ message: 'Datoteka je prevelika.' }, { status: 400 });
    }

    const itemSlug = sanitizeSlug(itemSlugValue);
    const extension = extensionFromFile(file);
    const mediaFolder = mediaFolderForMime(file.type.toLowerCase());
    const fileName = `${Date.now()}-${itemSlug}.${extension}`;
    const blob = await uploadBlob(
      buildCatalogItemMediaBlobPath(itemSlug, fileName, mediaFolder),
      Buffer.from(await file.arrayBuffer()),
      file.type || 'application/octet-stream'
    );

    return NextResponse.json({
      ok: true,
      url: blob.url,
      pathname: blob.pathname,
      filename: file.name,
      mimeType: file.type || null
    });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Napaka pri nalaganju datoteke.' },
      { status: 500 }
    );
  }
}
