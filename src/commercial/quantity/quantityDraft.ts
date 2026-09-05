export const MAX_STOREFRONT_QUANTITY = 1_000_000;

export type StorefrontQuantityValidationCode =
  | 'required'
  | 'invalid'
  | 'below-minimum'
  | 'above-maximum';

export type StorefrontQuantityValidation =
  | {
      valid: true;
      quantity: number;
    }
  | {
      valid: false;
      code: StorefrontQuantityValidationCode;
      message: string;
    };

type StorefrontQuantityBounds = {
  minimum?: number;
  maximum?: number | null;
};

const normalizeMinimum = (value: number | undefined) =>
  typeof value === 'number' && Number.isFinite(value)
    ? Math.max(1, Math.floor(value))
    : 1;

const normalizeMaximum = (value: number | null | undefined) =>
  typeof value === 'number' && Number.isFinite(value)
    ? Math.min(MAX_STOREFRONT_QUANTITY, Math.max(0, Math.floor(value)))
    : MAX_STOREFRONT_QUANTITY;

/**
 * Parses a committed quantity without mutating the user's editable draft.
 * Callers should retain the raw string while the customer is typing.
 */
export function parseStorefrontQuantityDraft(raw: string): number | null {
  const draft = raw.trim();
  if (!/^-?\d+$/u.test(draft)) return null;

  const quantity = Number(draft);
  return Number.isSafeInteger(quantity) ? quantity : null;
}

/**
 * Validates a quantity when the customer commits or submits it. This helper
 * intentionally returns an error instead of clamping the entered value.
 */
export function validateStorefrontQuantityDraft(
  raw: string,
  bounds: StorefrontQuantityBounds = {}
): StorefrontQuantityValidation {
  if (raw.trim().length === 0) {
    return {
      valid: false,
      code: 'required',
      message: 'Vnesite količino.'
    };
  }

  const quantity = parseStorefrontQuantityDraft(raw);
  if (quantity === null || quantity < 1) {
    return {
      valid: false,
      code: 'invalid',
      message: 'Količina mora biti pozitivno celo število.'
    };
  }

  const minimum = normalizeMinimum(bounds.minimum);
  if (quantity < minimum) {
    return {
      valid: false,
      code: 'below-minimum',
      message: `Najmanjša količina je ${minimum}.`
    };
  }

  const maximum = normalizeMaximum(bounds.maximum);
  if (quantity > maximum) {
    return {
      valid: false,
      code: 'above-maximum',
      message: `Največja dovoljena količina je ${maximum}.`
    };
  }

  return { valid: true, quantity };
}
