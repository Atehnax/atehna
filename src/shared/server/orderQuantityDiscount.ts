export const ALL_QUANTITY_DISCOUNT_TARGET = 'Vse';

export type QuantityDiscountRule = {
  minQuantity: number;
  discountPercent: number;
  variantTargets: string[];
  customerTargets: string[];
};

export type DiscountKind = 'quantity' | 'variant' | null;

type QuantityDiscountContext = {
  quantity: number;
  sku: string;
  variantName: string;
  customerLabels?: readonly string[];
  productType: string;
};

function normalizedLabel(value: unknown): string {
  return typeof value === 'string'
    ? value.trim().toLocaleLowerCase('sl-SI')
    : String(value ?? '')
        .trim()
        .toLocaleLowerCase('sl-SI');
}

function isAllTarget(value: unknown): boolean {
  return normalizedLabel(value) === normalizedLabel(ALL_QUANTITY_DISCOUNT_TARGET);
}

function normalizeTargetList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  const targets: string[] = [];
  for (const entry of value) {
    const target = String(entry ?? '').trim();
    if (!target) continue;
    if (isAllTarget(target)) return [ALL_QUANTITY_DISCOUNT_TARGET];
    if (!targets.some((existing) => normalizedLabel(existing) === normalizedLabel(target))) {
      targets.push(target);
    }
  }
  return targets;
}

export function parseQuantityDiscountTargets(value: unknown): {
  variantTargets: string[];
  customerTargets: string[];
} {
  const appliesTo = typeof value === 'string' ? value.trim() : '';
  if (!appliesTo) return { variantTargets: [], customerTargets: [] };

  try {
    const parsed: unknown = JSON.parse(appliesTo);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { variantTargets: [], customerTargets: [] };
    }
    const record = parsed as Record<string, unknown>;
    return {
      variantTargets: normalizeTargetList(record.variants),
      customerTargets: normalizeTargetList(record.customers)
    };
  } catch {
    return { variantTargets: [], customerTargets: [] };
  }
}

function finiteNumber(value: unknown): number | null {
  const parsed = Number(typeof value === 'string' ? value.trim().replace(',', '.') : value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function parseQuantityDiscountRules(value: unknown): QuantityDiscountRule[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((entry) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return [];
    const record = entry as Record<string, unknown>;
    const minQuantityValue = finiteNumber(record.minQuantity);
    const discountPercent = finiteNumber(record.discountPercent);
    if (
      minQuantityValue === null ||
      discountPercent === null ||
      minQuantityValue < 1 ||
      discountPercent < 0 ||
      discountPercent > 100
    ) {
      return [];
    }
    const targets = parseQuantityDiscountTargets(record.appliesTo);
    if (targets.variantTargets.length === 0 || targets.customerTargets.length === 0) {
      return [];
    }

    return [
      {
        minQuantity: Math.floor(minQuantityValue),
        discountPercent,
        ...targets
      }
    ];
  });
}

function targetsVariant(rule: QuantityDiscountRule, sku: string, variantName: string): boolean {
  const normalizedSku = normalizedLabel(sku);
  const normalizedVariantName = normalizedLabel(variantName);
  return rule.variantTargets.some((target) => {
    if (isAllTarget(target)) return true;
    const normalizedTarget = normalizedLabel(target);
    return normalizedTarget === normalizedSku || normalizedVariantName.includes(normalizedTarget);
  });
}

function targetsCustomer(rule: QuantityDiscountRule, customerLabels: readonly string[]): boolean {
  if (rule.customerTargets.some(isAllTarget)) return true;
  const normalizedCustomerLabels = new Set(customerLabels.map(normalizedLabel).filter(Boolean));
  return rule.customerTargets.some((target) => normalizedCustomerLabels.has(normalizedLabel(target)));
}

export function getBestQuantityDiscount(
  rawRules: unknown,
  context: QuantityDiscountContext
): QuantityDiscountRule | null {
  if (normalizedLabel(context.productType) === 'unique_machine') return null;

  return (
    parseQuantityDiscountRules(rawRules)
      .filter(
        (rule) =>
          context.quantity >= rule.minQuantity &&
          targetsVariant(rule, context.sku, context.variantName) &&
          targetsCustomer(rule, context.customerLabels ?? [])
      )
      .sort((left, right) => right.minQuantity - left.minQuantity || right.discountPercent - left.discountPercent)[0] ??
    null
  );
}

function safeDiscountPercent(value: unknown): number {
  const parsed = finiteNumber(value);
  return parsed === null ? 0 : Math.max(0, Math.min(100, parsed));
}

export function resolveEffectiveOrderDiscount(
  variantDiscountPct: unknown,
  quantityRule: QuantityDiscountRule | null
): {
  discountKind: DiscountKind;
  discountPct: number;
  quantityDiscountPct: number | null;
} {
  const variantPct = safeDiscountPercent(variantDiscountPct);
  const quantityDiscountPct = quantityRule ? safeDiscountPercent(quantityRule.discountPercent) : null;

  if (quantityDiscountPct !== null && quantityDiscountPct > 0 && quantityDiscountPct >= variantPct) {
    return {
      discountKind: 'quantity',
      discountPct: quantityDiscountPct,
      quantityDiscountPct
    };
  }
  if (variantPct > 0) {
    return {
      discountKind: 'variant',
      discountPct: variantPct,
      quantityDiscountPct
    };
  }
  return {
    discountKind: null,
    discountPct: 0,
    quantityDiscountPct
  };
}
