export type CatalogActivationMode = 'all' | 'first';
export type CatalogBulkActivationRequest = {
  mode: CatalogActivationMode;
  itemIdentifiers: string[];
  variants: Array<{ itemIdentifier: string; variantId: number }>;
};

export class CatalogActivationValidationError extends Error {
  readonly statusCode = 400;
}

export function parseCatalogBulkActivationRequest(value: unknown): CatalogBulkActivationRequest {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new CatalogActivationValidationError('Izberite artikle za aktivacijo.');
  const input = value as Record<string, unknown>;
  if (input.mode !== 'all' && input.mode !== 'first') throw new CatalogActivationValidationError('Izberite način aktivacije različic.');
  if (!Array.isArray(input.itemIdentifiers) || !Array.isArray(input.variants ?? [])) throw new CatalogActivationValidationError('Izbira artiklov ni veljavna.');
  const identifier = (candidate: unknown) => {
    if (typeof candidate !== 'string' || !candidate.trim() || candidate.trim().length > 240) throw new CatalogActivationValidationError('Identifikator artikla ni veljaven.');
    return candidate.trim();
  };
  const itemIdentifiers = [...new Set(input.itemIdentifiers.map(identifier))];
  const variants = (input.variants ?? []) as unknown[];
  if (itemIdentifiers.length + variants.length < 1 || itemIdentifiers.length + variants.length > 5000) throw new CatalogActivationValidationError('Izberite od 1 do 5000 artiklov ali različic.');
  const targets = variants.map(value => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new CatalogActivationValidationError('Izbira različice ni veljavna.');
    const target = value as Record<string, unknown>;
    if (typeof target.variantId !== 'number' || !Number.isSafeInteger(target.variantId) || target.variantId <= 0) throw new CatalogActivationValidationError('Identifikator različice ni veljaven.');
    return { itemIdentifier: identifier(target.itemIdentifier), variantId: target.variantId };
  });
  return { mode: input.mode, itemIdentifiers, variants: [...new Map(targets.map(target => [target.itemIdentifier + ':' + target.variantId, target])).values()] };
}

/** The first displayed variant is defined by the persisted order, not active/default state. */
export function getCatalogActivationVariantIds(mode: CatalogActivationMode, variants: Array<{ id: number; position: number }>): number[] {
  const ordered = [...variants].sort((left, right) => left.position - right.position || left.id - right.id);
  return (mode === 'first' ? ordered.slice(0, 1) : ordered).map(variant => variant.id);
}
