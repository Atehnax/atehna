import type { CatalogEditorProductType } from './catalogAdminTypes';
import { buildCatalogPresentationDetails } from './catalogPresentation';

type DeliveryVariant = {
  id: string | number;
  thickness: number | null;
  length: number | null;
  width: number | null;
  contentOverride?: unknown;
};

const record = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown> : {};
const text = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() ? value.trim() : null;

/** Resolve saved delivery settings without inventing a lead time for missing data. */
export function resolveCatalogVariantDeliveryEstimate(
  productType: CatalogEditorProductType,
  typeSpecificData: unknown,
  variant: DeliveryVariant,
): string | null {
  const override = text(record(variant.contentOverride).deliveryEstimate);
  if (override !== null) return override;
  if (productType === 'dimensions') {
    const data = record(typeSpecificData);
    const dimensions = record(data.dimensions ?? data.dimension);
    const deliveryTimes = record(dimensions.variantDeliveryTimes);
    const byId = text(deliveryTimes[String(variant.id)]);
    if (byId !== null) return byId;
    // Matches the editor's thickness × length × width key and P decimal separator.
    const key = [variant.thickness, variant.length, variant.width]
      .map(value => typeof value === 'number' && Number.isFinite(value)
        ? String(value).replace('.', 'P') : '')
      .join('x');
    const byDimensions = text(deliveryTimes[key]);
    if (byDimensions !== null) return byDimensions;
  }
  return buildCatalogPresentationDetails(productType, typeSpecificData).deliveryEstimate;
}

/** Format only explicit day quantities; do not reinterpret dates or other units. */
export function formatCatalogDeliveryDays(value: string | null | undefined): string | null {
  if (typeof value !== 'string' || value.length > 80) return null;
  const match = /^(\d+)(?:\s*[-–—]\s*(\d+))?(?:\s*(?:d|(?:(?:delovn|koledarsk)(?:i|a|e|ih)\s+)?(?:dan|dneva|dnevi|dni)))?$/iu.exec(value.trim());
  if (!match) return null;
  const from = BigInt(match[1]);
  const to = match[2] === undefined ? null : BigInt(match[2]);
  if (to !== null && to < from) return null;
  return `${from}${to === null || to === from ? '' : `–${to}`} d`;
}
