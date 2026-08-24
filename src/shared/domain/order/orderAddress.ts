type StructuredOrderAddress = {
  addressLine1?: unknown;
  addressLine2?: unknown;
  postalCode?: unknown;
  city?: unknown;
  countryCode?: unknown;
};

type StructuredOrderAddressRow = {
  address_line1?: unknown;
  address_line2?: unknown;
  postal_code?: unknown;
  city?: unknown;
  country_code?: unknown;
};

const normalizePart = (value: unknown) =>
  typeof value === 'string' ? value.trim() : '';

export function formatStructuredOrderAddress({
  addressLine1,
  addressLine2,
  postalCode,
  city,
  countryCode
}: StructuredOrderAddress): string {
  const locality = [normalizePart(postalCode), normalizePart(city)]
    .filter(Boolean)
    .join(' ');
  const normalizedCountryCode = normalizePart(countryCode).toUpperCase();
  const country = normalizedCountryCode && normalizedCountryCode !== 'SI'
    ? normalizedCountryCode
    : '';

  return [
    normalizePart(addressLine1),
    normalizePart(addressLine2),
    locality,
    country
  ].filter(Boolean).join(', ');
}

export function formatOrderRowAddress(address: StructuredOrderAddressRow): string {
  return formatStructuredOrderAddress({
    addressLine1: address.address_line1,
    addressLine2: address.address_line2,
    postalCode: address.postal_code,
    city: address.city,
    countryCode: address.country_code
  });
}
