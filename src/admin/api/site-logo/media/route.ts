import { NextResponse } from 'next/server';
import {
  SITE_LOGO_MIME_TYPES,
  type SiteLogoMimeType,
  type SiteLogoNormalizedRect
} from '@/shared/domain/logo/siteLogo';
import { buildSiteLogoBlobPath, uploadBlob } from '@/shared/server/blob';

export const runtime = 'nodejs';

const MAX_LOGO_FILE_SIZE = 10 * 1024 * 1024;
const MAX_IMAGE_DIMENSION = 32768;

function parseFiniteNumber(value: FormDataEntryValue | null, min: number, max: number): number | null {
  if (typeof value !== 'string') return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= min && number <= max ? number : null;
}

function parseOpticalBounds(value: FormDataEntryValue | null): SiteLogoNormalizedRect | null {
  if (typeof value !== 'string') return null;
  try {
    const parsed = JSON.parse(value) as Partial<SiteLogoNormalizedRect>;
    const x = Number(parsed.x);
    const y = Number(parsed.y);
    const width = Number(parsed.width);
    const height = Number(parsed.height);
    if (![x, y, width, height].every(Number.isFinite)) return null;
    if (x < 0 || y < 0 || width <= 0 || height <= 0 || x + width > 1.000001 || y + height > 1.000001) return null;
    return { x, y, width, height };
  } catch {
    return null;
  }
}

function isAllowedMimeType(value: string): value is SiteLogoMimeType {
  return SITE_LOGO_MIME_TYPES.includes(value as SiteLogoMimeType);
}

function hasExpectedRasterSignature(buffer: Buffer, mimeType: SiteLogoMimeType): boolean {
  if (mimeType === 'image/png') {
    return buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  }
  if (mimeType === 'image/jpeg') return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  if (mimeType === 'image/webp') return buffer.length >= 12 && buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP';
  return true;
}

function validateSvg(buffer: Buffer): string | null {
  const source = buffer.toString('utf8').replace(/^\uFEFF/, '').trim();
  if (!/<svg\b/i.test(source)) return 'Datoteka ni veljaven SVG.';
  if (/<\s*script\b/i.test(source)) return 'SVG ne sme vsebovati skript.';
  if (/<\s*foreignObject\b/i.test(source)) return 'SVG ne sme vsebovati elementa foreignObject.';
  if (/\son[a-z][\w:.-]*\s*=/i.test(source)) return 'SVG ne sme vsebovati aktivnih dogodkov.';

  const hrefPattern = /\b(?:href|xlink:href)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi;
  for (const match of source.matchAll(hrefPattern)) {
    const href = (match[1] ?? match[2] ?? match[3] ?? '').trim();
    if (href && !href.startsWith('#')) return 'SVG ne sme vsebovati zunanjih povezav.';
  }
  return null;
}

function extensionFor(mimeType: SiteLogoMimeType): string {
  if (mimeType === 'image/png') return 'png';
  if (mimeType === 'image/jpeg') return 'jpg';
  if (mimeType === 'image/webp') return 'webp';
  return 'svg';
}

function sanitizeMasterId(value: string): string | null {
  const trimmed = value.trim();
  return /^[a-zA-Z0-9._-]{1,80}$/.test(trimmed) ? trimmed : null;
}

function safeBaseName(fileName: string): string {
  const withoutExtension = fileName.replace(/\.[^.]+$/, '');
  return withoutExtension.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 80) || 'logo';
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');
    const rawMasterId = formData.get('masterId');
    const intrinsicWidth = parseFiniteNumber(formData.get('intrinsicWidth'), 1, MAX_IMAGE_DIMENSION);
    const intrinsicHeight = parseFiniteNumber(formData.get('intrinsicHeight'), 1, MAX_IMAGE_DIMENSION);
    const opticalBounds = parseOpticalBounds(formData.get('opticalBounds'));

    if (!(file instanceof File)) return NextResponse.json({ message: 'Datoteka manjka.' }, { status: 400 });
    const mimeType = file.type.toLowerCase();
    if (!isAllowedMimeType(mimeType)) {
      return NextResponse.json({ message: 'Dovoljene so samo datoteke PNG, JPEG, WebP ali SVG.' }, { status: 400 });
    }
    if (file.size <= 0 || file.size > MAX_LOGO_FILE_SIZE) {
      return NextResponse.json({ message: 'Datoteka logotipa je prazna ali večja od 10 MB.' }, { status: 400 });
    }
    const masterId = typeof rawMasterId === 'string' ? sanitizeMasterId(rawMasterId) : null;
    if (!masterId) return NextResponse.json({ message: 'ID glavne različice ni veljaven.' }, { status: 400 });
    if (intrinsicWidth === null || intrinsicHeight === null || opticalBounds === null) {
      return NextResponse.json({ message: 'Optične meje in izvorne mere logotipa niso veljavne.' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    if (mimeType === 'image/svg+xml') {
      const svgError = validateSvg(buffer);
      if (svgError) return NextResponse.json({ message: svgError }, { status: 400 });
    } else if (!hasExpectedRasterSignature(buffer, mimeType)) {
      return NextResponse.json({ message: 'Vsebina datoteke se ne ujema z navedeno vrsto slike.' }, { status: 400 });
    }

    const filename = `${Date.now()}-${safeBaseName(file.name)}.${extensionFor(mimeType)}`;
    const blob = await uploadBlob(
      buildSiteLogoBlobPath(masterId, filename),
      buffer,
      mimeType
    );

    return NextResponse.json({
      ok: true,
      asset: {
        url: blob.url,
        pathname: blob.pathname,
        filename: file.name,
        mimeType,
        size: file.size,
        intrinsicWidth,
        intrinsicHeight,
        opticalBounds
      }
    });
  } catch (error) {
    console.error('Failed to upload site logo', error);
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Nalaganje logotipa ni uspelo.' },
      { status: 500 }
    );
  }
}
