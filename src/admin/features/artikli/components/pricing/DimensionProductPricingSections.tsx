'use client';

export {
  CommercialToolsPanel,
  DimensionOrderPricingPanel
} from './OrderPriceSimulatorCard';
export { QuantityDiscountsCard } from './QuantityDiscountsCard';
export {
  ProductPricingLogicCardRow,
  ProductTypeSelectorCardRow,
  SimpleProductModule,
  UniqueMachineProductModule,
  WeightProductModule
} from './DimensionProductPricingSectionsImpl';
export {
  adminProductInputChipClassName,
  buildMachineCatalogVariants,
  buildSimpleCatalogVariants,
  buildWeightCatalogVariants,
  cloneQuantityDiscountDraft,
  cloneTypeSpecificData,
  createInitialQuantityDiscountDrafts,
  createInitialTypeSpecificData,
  createQuantityDiscountDraft,
  getMachineSimulatorOptions,
  getSimpleSimulatorOptions,
  getWeightSimulatorOptions,
  normalizeSimpleProductData,
  normalizeUniqueMachineProductData,
  normalizeWeightProductData,
  serializeQuantityDiscountTargets
} from './productData';
export { getDimensionSimulatorOptions } from './variantUtils';

export type {
  CommercialToolsPanelProps,
  ProductDataNormalizationContext,
  ProductModuleProps,
  ProductPricingLogicCardRowProps,
  ProductTypeSelectorCardRowProps,
  QuantityDiscountsCardProps,
  TypeSpecificProductData,
  UniqueMachineProductModuleProps,
  WeightProductModuleProps
} from './pricingTypes';

export type {
  ProductEditorType,
  QuantityDiscountDraft,
  SimulatorOption,
  UniversalProductSpecificData
} from '@/shared/domain/catalog/catalogAdminTypes';
