import {
  isStorefrontVariantPurchasable,
  toStorefrontProductSummary,
  type StorefrontProduct
} from '@/commercial/features/products/storefrontProduct';
import type { CatalogBrowserProduct } from './catalogBrowserTypes';

// The live catalog and its admin draft preview use identical row data.
export function toCatalogBrowserProduct(product: StorefrontProduct, categoryLabel?: string): CatalogBrowserProduct {
  const priceOptions = product.variants.flatMap(variant => {
    if (!isStorefrontVariantPurchasable(variant, false) || !Number.isFinite(variant.unitNet) || variant.unitNet <= 0) return [];
    const gross = Math.round((variant.unitNet * (1 + Math.max(0, variant.taxRate)) + Number.EPSILON) * 100) / 100;
    if (!Number.isFinite(gross) || gross <= 0) return [];
    return [{
      gross,
      inStock: variant.inventory !== null && Number.isFinite(variant.inventory) && variant.inventory >= variant.minOrder,
      orderable: isStorefrontVariantPurchasable(variant)
    }];
  });
  return { ...toStorefrontProductSummary(product, categoryLabel), priceOptions };
}
