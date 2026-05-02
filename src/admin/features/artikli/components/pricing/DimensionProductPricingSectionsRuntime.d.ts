import type { Variant } from '@/admin/features/artikli/lib/familyModel';
import type { UniversalProductSpecificData } from '@/shared/domain/catalog/catalogAdminTypes';
import type {
  CatalogItemQuantityDiscountRule,
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
import type { ComponentType } from 'react';

export const CommercialToolsPanel: ComponentType<CommercialToolsPanelProps>;
export const DimensionOrderPricingPanel: ComponentType<CommercialToolsPanelProps>;
export const ProductPricingLogicCardRow: ComponentType<ProductPricingLogicCardRowProps>;
export const ProductTypeSelectorCardRow: ComponentType<ProductTypeSelectorCardRowProps>;
export const QuantityDiscountsCard: ComponentType<QuantityDiscountsCardProps>;
export const SimpleProductModule: ComponentType<ProductModuleProps>;
export const UniqueMachineProductModule: ComponentType<UniqueMachineProductModuleProps>;
export const WeightProductModule: ComponentType<WeightProductModuleProps>;

export const adminProductInputChipClassName: string;

export function buildMachineCatalogVariants(
  data: TypeSpecificProductData,
  fallback: Variant | undefined,
  baseSku: string,
  name: string
): Variant[];
export function buildSimpleCatalogVariants(
  data: TypeSpecificProductData,
  fallback: Variant | undefined,
  baseSku: string,
  name: string
): Variant[];
export function buildWeightCatalogVariants(data: TypeSpecificProductData, baseSku: string): Variant[];
export function cloneQuantityDiscountDraft<T extends Record<string, unknown>>(rule: T): T;
export function cloneTypeSpecificData(data: UniversalProductSpecificData): UniversalProductSpecificData;
export function createInitialQuantityDiscountDrafts(
  rules: readonly CatalogItemQuantityDiscountRule[] | undefined,
  productType?: string
): import('@/shared/domain/catalog/catalogAdminTypes').QuantityDiscountDraft[];
export function createInitialTypeSpecificData(
  value?: unknown,
  context?: ProductDataNormalizationContext
): UniversalProductSpecificData;
export function createQuantityDiscountDraft(
  rule: Record<string, unknown>,
  index: number
): import('@/shared/domain/catalog/catalogAdminTypes').QuantityDiscountDraft;
export function getDimensionSimulatorOptions(variants: readonly Variant[]): import('@/shared/domain/catalog/catalogAdminTypes').SimulatorOption[];
export function getMachineSimulatorOptions(
  data: TypeSpecificProductData,
  label?: string
): import('@/shared/domain/catalog/catalogAdminTypes').SimulatorOption[];
export function getSimpleSimulatorOptions(
  data: TypeSpecificProductData,
  label?: string
): import('@/shared/domain/catalog/catalogAdminTypes').SimulatorOption[];
export function getWeightSimulatorOptions(
  data: TypeSpecificProductData
): import('@/shared/domain/catalog/catalogAdminTypes').SimulatorOption[];
export function normalizeSimpleProductData(
  value: unknown,
  context?: ProductDataNormalizationContext
): TypeSpecificProductData;
export function normalizeUniqueMachineProductData(
  value: unknown,
  context?: ProductDataNormalizationContext
): TypeSpecificProductData;
export function normalizeWeightProductData(
  value: unknown,
  context?: ProductDataNormalizationContext
): TypeSpecificProductData;
export function serializeQuantityDiscountTargets(rule: Record<string, unknown>): string;
