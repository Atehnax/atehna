import { formatDecimalForDisplay } from './decimalFormat';

const mimeTypeToImageFormat: Readonly<Record<string, string>> = {
  'image/jpeg': 'JPG',
  'image/jpg': 'JPG',
  'image/png': 'PNG',
  'image/webp': 'WEBP',
  'image/gif': 'GIF',
  'image/svg+xml': 'SVG',
  'image/avif': 'AVIF',
  'image/bmp': 'BMP',
  'image/tiff': 'TIFF'
};

const imageExtensionToFormat: Readonly<Record<string, string>> = {
  jpg: 'JPG',
  jpeg: 'JPG',
  png: 'PNG',
  webp: 'WEBP',
  gif: 'GIF',
  avif: 'AVIF',
  svg: 'SVG',
  bmp: 'BMP',
  tif: 'TIFF',
  tiff: 'TIFF'
};

export type ImagePixelMetadata = {
  width: number;
  height: number;
};

export function inferImageFormatLabel({
  mimeType,
  fileName,
  url
}: {
  mimeType?: string | null;
  fileName?: string | null;
  url?: string | null;
}): string {
  const normalizedMimeType = mimeType?.split(';', 1)[0]?.trim().toLowerCase();
  const mimeLabel = normalizedMimeType ? mimeTypeToImageFormat[normalizedMimeType] : undefined;
  if (mimeLabel) return mimeLabel;

  const nameExtension = fileName?.match(/\.([a-zA-Z0-9]+)$/u)?.[1]?.toLowerCase();
  const fromName = nameExtension ? imageExtensionToFormat[nameExtension] : undefined;
  if (fromName) return fromName;

  const urlExtension = url?.match(/\.([a-zA-Z0-9]+)(?:$|[?#])/u)?.[1]?.toLowerCase();
  const fromUrl = urlExtension ? imageExtensionToFormat[urlExtension] : undefined;
  if (fromUrl) return fromUrl;

  return '—';
}

export function formatImagePixelDimensions(metadata: ImagePixelMetadata | null | undefined): string {
  if (!metadata || metadata.width <= 0 || metadata.height <= 0) return '—';
  return `${metadata.width} × ${metadata.height} px`;
}

export function normalizeImagePixelDimensions(
  metadata: { width?: number; height?: number } | null | undefined
): ImagePixelMetadata | null {
  const width = Number(metadata?.width);
  const height = Number(metadata?.height);
  if (!Number.isInteger(width) || width <= 0 || !Number.isInteger(height) || height <= 0) return null;
  return { width, height };
}

export function formatImageVariantAssignmentLabel(
  variant: {
    label?: string | null;
    sku?: string | null;
    thickness?: number | null;
    length?: number | null;
    width?: number | null;
  },
  variantIndex: number,
  showDimensions = false
): string {
  if (showDimensions) {
    const dimensions = [variant.thickness, variant.length, variant.width]
      .filter((value): value is number => typeof value === 'number' && Number.isFinite(value) && value > 0)
      .map(formatDecimalForDisplay);
    if (dimensions.length) return dimensions.join(' × ') + ' mm';
  }
  const label = variant.label?.trim();
  return label && label !== variant.sku?.trim() ? label : 'Različica ' + (variantIndex + 1);
}

export function remapMovedImageSlotIndex(
  slotIndex: number,
  fromIndex: number,
  toIndex: number
): number {
  if (fromIndex === toIndex) return slotIndex;
  if (slotIndex === fromIndex) return toIndex;

  if (fromIndex < toIndex && slotIndex > fromIndex && slotIndex <= toIndex) {
    return slotIndex - 1;
  }

  if (fromIndex > toIndex && slotIndex >= toIndex && slotIndex < fromIndex) {
    return slotIndex + 1;
  }

  return slotIndex;
}

export function remapImageSlotAssignmentsAfterMove(
  assignments: readonly number[],
  fromIndex: number,
  toIndex: number
): number[] {
  return assignments.map((slotIndex) => remapMovedImageSlotIndex(slotIndex, fromIndex, toIndex));
}
