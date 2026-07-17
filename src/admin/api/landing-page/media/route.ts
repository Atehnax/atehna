import { NextResponse } from 'next/server';
import { buildLandingPageMediaBlobPath, uploadBlob } from '@/shared/server/blob';

export const runtime = 'nodejs';

const MAX_IMAGE_FILE_SIZE = 5 * 1024 * 1024;
const MAX_VIDEO_FILE_SIZE = 40 * 1024 * 1024;

function sanitizeSegment(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9-]/gi, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
}

function isImageFile(file: File): boolean {
  return file.type.toLowerCase().startsWith('image/');
}

function isVideoFile(file: File): boolean {
  return file.type.toLowerCase().startsWith('video/');
}

function getMediaExtension(file: File): string {
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
    case 'video/mp4':
      return 'mp4';
    case 'video/webm':
      return 'webm';
    case 'video/quicktime':
      return 'mov';
    default:
      return 'bin';
  }
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');
    const elementIdValue = formData.get('elementId');

    if (!(file instanceof File)) {
      return NextResponse.json({ message: 'Datoteka manjka.' }, { status: 400 });
    }

    const isImage = isImageFile(file);
    const isVideo = isVideoFile(file);

    if (!isImage && !isVideo) {
      return NextResponse.json({ message: 'Dovoljene so samo slike ali videi.' }, { status: 400 });
    }

    const maxFileSize = isVideo ? MAX_VIDEO_FILE_SIZE : MAX_IMAGE_FILE_SIZE;
    if (file.size > maxFileSize) {
      return NextResponse.json({ message: isVideo ? 'Video je prevelik.' : 'Slika je prevelika.' }, { status: 400 });
    }

    const elementId = typeof elementIdValue === 'string' && elementIdValue.trim()
      ? sanitizeSegment(elementIdValue)
      : 'element';
    const extension = getMediaExtension(file);
    const fileName = `${Date.now()}-${elementId}.${extension}`;
    const blob = await uploadBlob(
      buildLandingPageMediaBlobPath(elementId, fileName),
      Buffer.from(await file.arrayBuffer()),
      file.type || 'application/octet-stream'
    );

    return NextResponse.json({
      ok: true,
      url: blob.url,
      pathname: blob.pathname,
      filename: file.name,
      mimeType: file.type || null,
      mediaType: isVideo ? 'video' : 'image',
      size: file.size
    });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Napaka pri nalaganju medija.' },
      { status: 500 }
    );
  }
}
