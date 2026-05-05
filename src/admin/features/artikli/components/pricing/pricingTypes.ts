import type { ReactNode } from 'react';
import type { Variant } from '@/admin/features/artikli/lib/familyModel';
import type {
  CatalogItemQuantityDiscountRule,
  ProductEditorType,
  QuantityDiscountDraft,
  SimulatorOption as CatalogSimulatorOption,
  UniversalProductSpecificData
} from '@/shared/domain/catalog/catalogAdminTypes';
import type { OrderItemSkuAllocationRow } from '@/shared/domain/order/orderTypes';

export type TypeSpecificProductData = Record<string, unknown>;

export type ProductDataNormalizationContext = {
  variants?: Variant[];
  baseSku?: string;
};

export type SpecRow = {
  id: string;
  property: string;
  value: string;
  unit?: string;
};

export type SimpleProductData = {
  basePrice: number;
  actionPrice: number;
  actionPriceEnabled: boolean;
  stock: number;
  minStock: number;
  deliveryTime: string;
  moq: number;
  warehouseLocation: string;
  saleStatus: 'active' | 'inactive';
  visibleInStore: boolean;
  showAsNew: boolean;
  requireInstructions: boolean;
  basicInfoRows: SpecRow[];
  technicalSpecs: SpecRow[];
};

export type WeightVariant = {
  id: string;
  sku: string;
  fraction: string;
  color: string;
  netMassKg: number | null;
  minQuantity: number;
  unitPrice: number | null;
  stockKg: number;
  tolerance: string;
  deliveryTime: string;
  active: boolean;
  noteTag: string;
  position: number;
};

export type WeightFractionInventoryRow = {
  id: string;
  fraction: string;
  color: string;
  stockKg: number;
  reservedKg: number;
  deliveryTime: string;
};

export type WeightProductData = {
  minQuantity: number;
  fraction: string;
  netMassKg: number;
  stockKg: number;
  deliveryTime: string;
  packagingChips: string[];
  fractionChips: string[];
  colorChips: string[];
  fractionInventory: WeightFractionInventoryRow[];
  variants: WeightVariant[];
};

export type MachineSerialStatus = 'in_stock' | 'sold' | 'reserved' | 'service';

export type MachineSerialRow = {
  id: string;
  serialNumber: string;
  status: MachineSerialStatus;
  orderReference: string;
  shippedAt: string;
};

export type UniqueMachineProductData = {
  basePrice: number;
  discountPercent: number;
  stock: number;
  warrantyLabel: string;
  warrantyMonths: string;
  warrantyUnit?: string;
  serviceIntervalLabel: string;
  serviceIntervalMonths: string;
  serviceIntervalUnit?: string;
  deliveryTime: string;
  packageWeightKg: number;
  packageWeightUnit?: string;
  packageDimensions: string;
  warnings: string;
  basicInfoRows: SpecRow[];
  serialNumbers: MachineSerialRow[];
  specs: SpecRow[];
  includedItems: string[];
};

export type PricingSimulatorOption = CatalogSimulatorOption & {
  label: string;
  basePrice: number;
  discountPercent?: number;
  quantityUnit?: string;
  targetKey?: string;
  dimensionLabel?: string;
  dimensionThickness?: number;
  dimensionWidth?: number;
  dimensionLength?: number;
  summaryLabel?: string;
  discountUnitLabel?: string;
  stockLabel?: string;
  minOrderLabel?: string;
  serialLabels?: string[];
  weightFraction?: string;
  weightColor?: string;
  weightPackageLabel?: string;
  weightFractionColorLabel?: string;
  weightSelectionLabel?: string;
  weightNetMassKg?: number;
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
  simulatorOptions: CatalogSimulatorOption[];
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
  simulatorOptions: CatalogSimulatorOption[];
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

export type UniqueMachineProductModuleProps = {
  editable: boolean;
  data: TypeSpecificProductData;
  orderMatches?: OrderItemSkuAllocationRow[];
  onRequestEdit?: () => void;
  onChange: (nextData: TypeSpecificProductData) => void;
};

export type OrderPriceSummaryRow = {
  label: string;
  value: string;
  detail?: string;
  detailDisplay?: 'below' | 'inline';
  icon?:
    | 'fraction'
    | 'simpleProduct'
    | 'dimensionVariant'
    | 'machine'
    | 'machineCluster'
    | 'price'
    | 'quantity'
    | 'dimensionQuantity'
    | 'discount'
    | 'simpleStock'
    | 'stock'
    | 'machineGear'
    | 'dimensionStock'
    | 'package';
  tone?: 'default' | 'discount' | 'success' | 'warning';
  chips?: string[];
  valueDisplay?: 'plain' | 'badge';
};

export type OrderPriceSummaryCardProps = {
  compact?: boolean;
  detailRows: OrderPriceSummaryRow[];
  calculationRows: OrderPriceSummaryRow[];
  total: string;
};

export type {
  CatalogItemQuantityDiscountRule,
  ProductEditorType,
  QuantityDiscountDraft,
  UniversalProductSpecificData
};
export type SimulatorOption = CatalogSimulatorOption;
