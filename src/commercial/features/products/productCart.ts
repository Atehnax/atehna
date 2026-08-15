import type {
  AddCartItemInput,
  CartOptionSelection
} from '@/commercial/cart/cartTypes';
import type {
  StorefrontOptionAxis,
  StorefrontProductMedia,
  StorefrontVariant
} from '@/commercial/features/products/storefrontProduct';
import type { VariantSelection } from '@/commercial/components/storefront/VariantSelector';

export function buildCartOptionSelections(
  axes: StorefrontOptionAxis[],
  selection: VariantSelection
): CartOptionSelection[] {
  return axes.flatMap((axis) => {
    const valueId = selection[axis.id];
    const value = axis.values.find((entry) => entry.id === valueId);
    if (!value) return [];
    return [
      {
        axisId: axis.id,
        axisName: axis.name,
        valueId: value.id,
        valueLabel: value.label
      }
    ];
  });
}

export function buildProductCartItem(input: {
  productId: string;
  productSlug: string;
  productHref: string;
  productName: string;
  category?: string;
  image?: StorefrontProductMedia;
  variant: StorefrontVariant;
  options?: CartOptionSelection[];
}): AddCartItemInput {
  const { variant } = input;
  const estimatedUnitGross = variant.unitNet * (1 + variant.taxRate);

  return {
    sku: variant.sku,
    name: input.productName,
    productId: input.productId,
    productSlug: input.productSlug,
    productHref: input.productHref,
    imageUrl: input.image?.url,
    imageAlt: input.image?.altText || input.productName,
    category: input.category,
    unit: variant.unit,
    unitPrice: estimatedUnitGross,
    variant: {
      id: variant.commerceId,
      name: variant.name,
      sku: variant.sku,
      options: input.options ?? []
    },
    pricing: {
      currency: 'EUR',
      taxRate: variant.taxRate,
      baseUnitNet: variant.baseUnitNet,
      discountPct: variant.discountPct,
      unitNet: variant.unitNet,
      estimatedUnitGross
    },
    reconciliation: {
      status: variant.commerceId === null ? 'needs_review' : 'unchecked',
      message:
        variant.commerceId === null
          ? 'Različica še ni povezana z veljavnim cenikom.'
          : undefined,
      availableStock: variant.inventory,
      minOrder: variant.minOrder
    }
  };
}

