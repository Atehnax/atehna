type CanonicalVariant = { id?: number; variantSku?: string | null; price: number; costNet?: number | null; discountPct?: number; inventory?: number; stockRevision?: string; pricingRevision?: string };
const record = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
/** The editable JSON holds presentation choices, never a second price/stock source. */
export function overlayCanonicalEditorPricing(input: unknown, variants: readonly CanonicalVariant[]): Record<string, unknown> {
  const data = structuredClone(record(input));
  const first = variants[0];
  if (!first) return data;
  if (data.simple && variants.length === 1) {
    const simple = record(data.simple); const discount = first.discountPct ?? 0;
    data.simple = { ...simple, basePrice: first.price, actionPrice: Number((first.price * (1-discount/100)).toFixed(2)), actionPriceEnabled: discount > 0, discountPercent: discount, stock: first.inventory ?? 0 };
  }
  const machineKey = data.uniqueMachine ? 'uniqueMachine' : data.machine ? 'machine' : null;
  if (machineKey && variants.length === 1) data[machineKey] = { ...record(data[machineKey]), basePrice:first.price,discountPercent:first.discountPct??0,stock:first.inventory??0 };
  if (data.weight) {
    const weight = record(data.weight);
    if (Array.isArray(weight.variants)) {
      data.weight = { ...weight, variants: weight.variants.map((entry, index) => {
        const original = record(entry);
        const canonical = variants.find(v => String(v.id) === String(original.id))
          ?? variants.find(v => v.variantSku && v.variantSku === original.sku)
          ?? variants[index];
        if (!canonical) return original;
        return { ...original, id: String(canonical.id), sku:canonical.variantSku??original.sku,unitPrice:canonical.price,costNet:canonical.costNet??null,discountPct:canonical.discountPct??0,stockKg:canonical.inventory??0,stockRevision:canonical.stockRevision,pricingRevision:canonical.pricingRevision };
      }) };
    }
  }
  return data;
}
