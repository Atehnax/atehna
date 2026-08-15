'use client';

import {
  createContext,
  useContext,
  useMemo,
  type ReactNode
} from 'react';
import {
  DEFAULT_PRODUCT_APPEARANCE_CONFIG,
  normalizeProductAppearanceConfig,
  type ProductAppearanceConfig
} from '@/shared/domain/style/productAppearance';

const ProductAppearanceContext = createContext<ProductAppearanceConfig>(
  DEFAULT_PRODUCT_APPEARANCE_CONFIG
);

export function ProductAppearanceProvider({
  config,
  children
}: {
  config: ProductAppearanceConfig;
  children: ReactNode;
}) {
  const normalizedConfig = useMemo(
    () => normalizeProductAppearanceConfig(config),
    [config]
  );
  return (
    <ProductAppearanceContext.Provider value={normalizedConfig}>
      {children}
    </ProductAppearanceContext.Provider>
  );
}

export function useProductAppearance() {
  return useContext(ProductAppearanceContext);
}
