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
  WeightProductModule,
  adminProductInputChipClassName,
  buildMachineCatalogVariants,
  buildSimpleCatalogVariants,
  buildWeightCatalogVariants,
  cloneQuantityDiscountDraft,
  cloneTypeSpecificData,
  createInitialQuantityDiscountDrafts,
  createInitialTypeSpecificData,
  createQuantityDiscountDraft,
  getDimensionSimulatorOptions,
  getMachineSimulatorOptions,
  getSimpleSimulatorOptions,
  getWeightSimulatorOptions,
  normalizeSimpleProductData,
  normalizeUniqueMachineProductData,
  normalizeWeightProductData,
  serializeQuantityDiscountTargets
} from './DimensionProductPricingSectionsRuntime.js';

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
