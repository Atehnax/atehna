import type { ComponentType, ReactNode } from 'react';
import type { Variant } from '@/admin/features/artikli/lib/familyModel';
import type {
  CatalogItemQuantityDiscountRule,
  ProductEditorType,
  QuantityDiscountDraft,
  SimulatorOption,
  UniversalProductSpecificData
} from '@/shared/domain/catalog/catalogAdminTypes';
import type { OrderItemSkuAllocationRow } from '@/shared/domain/order/orderTypes';

export type TypeSpecificProductData = Record<string, unknown>;

export type ProductDataNormalizationContext = {
  variants?: Variant[];
  baseSku?: string;
};

export type ProductTypeSelectorCardRowProps = {
  value: ProductEditorType;
  editable: boolean;
  onChange: (nextProductType: ProductEditorType) => void;
  embedded?: boolean;
  collapsed?: boolean;
  onExpand?: () => void;
  expandDisabled?: boolean;
};

export type ProductPricingLogicCardRowProps = {
  productType: ProductEditorType;
  simpleData: TypeSpecificProductData;
  weightData: TypeSpecificProductData;
  machineData: TypeSpecificProductData;
};

export type QuantityDiscountsCardProps = {
  editable: boolean;
  quantityDiscounts: QuantityDiscountDraft[];
  onAddDiscount: () => void;
  onRemoveDiscount: (id: string) => void;
  onUpdateDiscount: (id: string, updates: Partial<QuantityDiscountDraft>) => void;
  simulatorOptions: SimulatorOption[];
  usesScopedCommercialTools?: boolean;
  embedded?: boolean;
  minQuantityLabel?: string;
  minQuantityUnitLabel?: string;
  minQuantityAllowsDecimal?: boolean;
  className?: string;
};

export type CommercialToolsPanelProps = {
  productType?: ProductEditorType;
  hideQuantityDiscounts?: boolean;
  editable: boolean;
  quantityDiscounts: QuantityDiscountDraft[];
  onAddDiscount: () => void;
  onRemoveDiscount: (id: string) => void;
  onUpdateDiscount: (id: string, updates: Partial<QuantityDiscountDraft>) => void;
  simulatorOptions: SimulatorOption[];
  selectedOptionId: string;
  onSelectedOptionIdChange: (nextOptionId: string) => void;
  quantity: number;
  onQuantityChange: (nextQuantity: number) => void;
  applyQuantityDiscounts: boolean;
  onApplyQuantityDiscountsChange: (nextEnabled: boolean) => void;
};

export type ProductModuleProps = {
  editable: boolean;
  data: TypeSpecificProductData;
  quantityDiscountsPanel?: ReactNode;
  onChange: (nextData: TypeSpecificProductData) => void;
};

export type WeightProductModuleProps = ProductModuleProps & {
  baseSku: string;
  color?: string | null;
};

export type MachineDocumentSummary = {
  id: string | number;
  name: string;
  size?: string | number | null;
};

export type UniqueMachineProductModuleProps = {
  editable: boolean;
  data: TypeSpecificProductData;
  documents?: MachineDocumentSummary[];
  orderMatches?: OrderItemSkuAllocationRow[];
  onUploadDocument?: () => void;
  onChange: (nextData: TypeSpecificProductData) => void;
};

export type ProductPricingComponentMap = {
  CommercialToolsPanel: ComponentType<CommercialToolsPanelProps>;
  DimensionOrderPricingPanel: ComponentType<CommercialToolsPanelProps>;
  ProductPricingLogicCardRow: ComponentType<ProductPricingLogicCardRowProps>;
  ProductTypeSelectorCardRow: ComponentType<ProductTypeSelectorCardRowProps>;
  QuantityDiscountsCard: ComponentType<QuantityDiscountsCardProps>;
  SimpleProductModule: ComponentType<ProductModuleProps>;
  UniqueMachineProductModule: ComponentType<UniqueMachineProductModuleProps>;
  WeightProductModule: ComponentType<WeightProductModuleProps>;
};

export type { ProductEditorType, QuantityDiscountDraft, SimulatorOption, UniversalProductSpecificData };
export type { CatalogItemQuantityDiscountRule };
