import type { AdminCatalogListItem } from './catalogAdminTypes';

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

export type CatalogActivationSkippedTarget = {
  itemId: number;
  itemIdentifier: string;
  itemName: string;
  itemSku: string | null;
  variantId?: number;
  variantName?: string;
  variantSku?: string | null;
  reasons: string[];
};

export type CatalogBulkActivationResult = {
  items: AdminCatalogListItem[];
  skipped: CatalogActivationSkippedTarget[];
  /** Counts only statuses changed from inactive to active by this request. */
  activatedItemCount: number;
  activatedVariantCount: number;
};

export type CatalogActivationVariant = {
  id: number;
  position: number;
  name: string;
  sku: string | null;
  price: number;
  status: string;
  optionAxisCount: number;
  assignedOptionCount: number;
  optionSignature: string | null;
};

export const CATALOG_ACTIVATION_PRICE_REASON = 'Prodajna cena brez DDV mora biti večja od 0.';
export const CATALOG_ACTIVATION_SKU_REASON = 'Različica potrebuje veljaven SKU.';
export const CATALOG_ACTIVATION_OPTIONS_REASON = 'Izberite eno vrednost vsake izbirne lastnosti.';
export const CATALOG_ACTIVATION_DUPLICATE_OPTIONS_REASON = 'Kombinacija izbirnih lastnosti se že uporablja pri drugi aktivni različici.';

/** Publication eligibility is independent of shipping measurement readiness. */
export function getCatalogVariantPublicationReasons(variant: { sku?: unknown; price?: unknown }): string[] {
  const reasons: string[] = [];
  if (typeof variant.sku !== 'string' || !variant.sku.trim()) reasons.push(CATALOG_ACTIVATION_SKU_REASON);
  if (typeof variant.price !== 'number' || !Number.isFinite(variant.price) || variant.price <= 0) reasons.push(CATALOG_ACTIVATION_PRICE_REASON);
  return reasons;
}

/** Plan eligible state changes without mutating current statuses or silently substituting another first row. */
export function planCatalogItemActivation(input: {
  item: Omit<CatalogActivationSkippedTarget, 'variantId' | 'variantName' | 'variantSku' | 'reasons'> & { status: string };
  parentSelected: boolean;
  parentReasons: string[];
  mode: CatalogActivationMode;
  explicitVariantIds: number[];
  variants: CatalogActivationVariant[];
}) {
  const { item, variants, parentSelected, parentReasons } = input;
  const base = { itemId: item.itemId, itemIdentifier: item.itemIdentifier, itemName: item.itemName, itemSku: item.itemSku };
  const requestedIds = new Set(input.explicitVariantIds);
  if (parentSelected) getCatalogActivationVariantIds(input.mode, variants).forEach(id => requestedIds.add(id));
  const ordered = [...variants].sort((left, right) => left.position - right.position || left.id - right.id);
  const reasonsById = new Map(variants.map(variant => {
    const reasons = getCatalogVariantPublicationReasons(variant);
    if (variant.optionAxisCount !== variant.assignedOptionCount) reasons.push(CATALOG_ACTIVATION_OPTIONS_REASON);
    return [variant.id, reasons] as const;
  }));
  // Existing active rows retain priority. Even invalid historical rows are never deactivated here.
  const usedSignatures = new Map<string, number>();
  for (const variant of ordered) {
    if (variant.status !== 'active' || !variant.optionSignature) continue;
    const existing = usedSignatures.get(variant.optionSignature);
    if (existing !== undefined) {
      reasonsById.get(existing)!.push(CATALOG_ACTIVATION_DUPLICATE_OPTIONS_REASON);
      reasonsById.get(variant.id)!.push(CATALOG_ACTIVATION_DUPLICATE_OPTIONS_REASON);
    }
    usedSignatures.set(variant.optionSignature, variant.id);
  }
  const skipped: CatalogActivationSkippedTarget[] = [];
  const activateVariantIds: number[] = [];
  const eligibleNewIds = new Set<number>();
  for (const variant of ordered.filter(variant => requestedIds.has(variant.id))) {
    const reasons = [...reasonsById.get(variant.id)!];
    if (parentReasons.length) reasons.unshift(...parentReasons);
    if (variant.status !== 'active' && variant.optionSignature && usedSignatures.has(variant.optionSignature)) {
      reasons.push(CATALOG_ACTIVATION_DUPLICATE_OPTIONS_REASON);
    }
    if (reasons.length) {
      skipped.push({ ...base, variantId: variant.id, variantName: variant.name, variantSku: variant.sku, reasons });
      continue;
    }
    if (variant.status !== 'active') {
      activateVariantIds.push(variant.id);
      eligibleNewIds.add(variant.id);
      if (variant.optionSignature) usedSignatures.set(variant.optionSignature, variant.id);
    }
  }
  const hasEligibleActiveVariant = variants.some(variant => eligibleNewIds.has(variant.id)
    || (variant.status === 'active' && reasonsById.get(variant.id)!.length === 0));
  const itemReasons = [...parentReasons];
  if (parentSelected && item.status !== 'active') {
    for (const variant of variants.filter(variant => variant.status === 'active')) {
      const reasons = [...new Set(reasonsById.get(variant.id)!)];
      if (reasons.length) itemReasons.push(`Že aktivna različica »${variant.name}«${variant.sku ? ` (SKU ${variant.sku})` : ''} še ni pripravljena za objavo: ${reasons.join(' ')}`);
    }
  }
  if (!hasEligibleActiveVariant) itemReasons.push('Artikel potrebuje najmanj eno aktivno različico z veljavno prodajno ceno, SKU in izbirnimi lastnostmi.');
  if (parentSelected && itemReasons.length) skipped.push({ ...base, reasons: itemReasons });
  const activateItem = parentSelected && item.status !== 'active' && itemReasons.length === 0;
  return { activateItem, activateVariantIds, skipped };
}