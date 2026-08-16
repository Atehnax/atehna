import type { CatalogItemType } from '@/shared/domain/catalog/itemType';
import type { CatalogSpecificationLabelOverrides } from '@/shared/domain/catalog/catalogSpecification';
import type { OrderItemSkuAllocationRow } from '@/shared/domain/order/orderTypes';

export type CatalogEditorProductType = 'simple' | 'dimensions' | 'weight' | 'unique_machine';
export type ProductEditorType = CatalogEditorProductType;
export type CatalogItemPublicationStatus = 'active' | 'inactive';
export type CatalogItemLifecycleStatus = CatalogItemPublicationStatus | 'deleted';

export type CatalogItemTypeSpecificData = Record<string, unknown>;
export type CatalogItemAppearanceOverride = Record<string, unknown> & {
  secondaryContent?: Record<string, unknown> & {
    specificationLabels?: CatalogSpecificationLabelOverrides;
  };
};
export type CatalogVariantContentOverride = {
  description?: string;
  specifications?: Record<string, string>;
  attributes?: Record<string, string>;
  includedItems?: string[];
  deliveryEstimate?: string;
  documentIds?: number[];
};

export type CatalogItemOptionValuePayload = {
  id?: number;
  value: string;
  slug: string;
  swatch?: string | null;
  position?: number;
};

export type CatalogItemOptionAxisPayload = {
  id?: number;
  name: string;
  slug: string;
  position?: number;
  values: CatalogItemOptionValuePayload[];
};

export type CatalogItemQuantityDiscountRule = {
  id?: number;
  minQuantity: number;
  discountPercent: number;
  appliesTo?: 'allVariants' | string | null;
  note?: string | null;
  position?: number | null;
};

export type CatalogItemEditorVariantPayload = {
  id?: number;
  variantName: string;
  length?: number | null;
  width?: number | null;
  thickness?: number | null;
  weight?: number | null;
  errorTolerance?: string | null;
  price: number;
  costNet?: number | null;
  contentOverride?: CatalogVariantContentOverride | null;
  discountPct?: number;
  inventory?: number;
  minOrder?: number;
  variantSku?: string | null;
  unit?: string | null;
  status?: 'active' | 'inactive';
  badge?: string | null;
  position?: number;
  imageAssignments?: number[];
  optionValueIds?: number[];
  optionSelections?: Record<string, string>;
};

export type CatalogMediaKind = 'image' | 'video' | 'document';
export type CatalogMediaImportKind = CatalogMediaKind;
export type CatalogMediaRole = 'gallery' | 'technical_sheet';
export type CatalogMediaSourceKind = 'upload' | 'youtube';
export type CatalogImageDimensions = { width?: number; height?: number };

export type CatalogItemMediaPayload = {
  id?: number;
  variantIndex?: number | null;
  mediaKind: CatalogMediaKind;
  role: CatalogMediaRole;
  sourceKind: CatalogMediaSourceKind;
  filename?: string | null;
  blobUrl?: string | null;
  blobPathname?: string | null;
  externalUrl?: string | null;
  mimeType?: string | null;
  altText?: string | null;
  imageType?: string | null;
  imageDimensions?: CatalogImageDimensions | null;
  videoType?: string | null;
  hidden?: boolean;
  position?: number;
};

export type UploadedCatalogMediaFile = {
  url: string;
  pathname: string;
  mimeType: string | null;
  filename: string;
  size?: number;
};

export type CatalogMediaUploadResponse = UploadedCatalogMediaFile & {
  ok: true;
};

export type CatalogItemEditorPayload = {
  id?: number;
  expectedUpdatedAt?: string;
  itemName: string;
  itemType: CatalogItemType;
  productType?: CatalogEditorProductType;
  typeSpecificData?: CatalogItemTypeSpecificData;
  badge?: string | null;
  status: 'active' | 'inactive';
  categoryPath: string[];
  sku?: string | null;
  slug: string;
  unit?: string | null;
  brand?: string | null;
  material?: string | null;
  colour?: string | null;
  shape?: string | null;
  description?: string | null;
  adminNotes?: string | null;
  position?: number;
  taxRate?: number;
  appearanceOverride?: CatalogItemAppearanceOverride | null;
  defaultVariantId?: number | null;
  defaultVariantIndex?: number | null;
  optionAxes?: CatalogItemOptionAxisPayload[];
  variants: CatalogItemEditorVariantPayload[];
  quantityDiscounts?: CatalogItemQuantityDiscountRule[];
  media: CatalogItemMediaPayload[];
};

export type AdminCatalogVariantSummary = {
  id: number;
  variantName: string;
  variantSku: string | null;
  length: number | null;
  width: number | null;
  thickness: number | null;
  weight: number | null;
  price: number;
  costNet: number | null;
  discountPct: number;
  inventory: number;
  minOrder: number;
  status: 'active' | 'inactive';
  badge: string | null;
  position: number;
};

export type AdminCatalogListItem = {
  id: number;
  slug: string;
  itemName: string;
  productType: CatalogEditorProductType;
  typeSpecificData: CatalogItemTypeSpecificData;
  description: string | null;
  brand: string | null;
  material: string | null;
  unit: string | null;
  imageUrl: string | null;
  taxRate: number;
  baseSku: string | null;
  categoryLabel: string;
  status: 'active' | 'inactive';
  badge: string | null;
  variantCount: number;
  minPrice: number;
  maxPrice: number;
  defaultDiscountPct: number;
  adminNotes: string | null;
  defaultVariantId: number | null;
  variants: AdminCatalogVariantSummary[];
};

export type CatalogItemEditorHydration = {
  id: number;
  updatedAt: string;
  itemName: string;
  itemType: CatalogItemType;
  productType: CatalogEditorProductType;
  typeSpecificData: CatalogItemTypeSpecificData;
  badge: string | null;
  status: CatalogItemLifecycleStatus;
  statusBeforeDelete: CatalogItemPublicationStatus | null;
  deletedAt: string | null;
  purgeAfter: string | null;
  categoryPath: string[];
  sku: string | null;
  slug: string;
  unit: string | null;
  brand: string | null;
  material: string | null;
  colour: string | null;
  shape: string | null;
  description: string | null;
  adminNotes: string | null;
  taxRate: number;
  appearanceOverride: CatalogItemAppearanceOverride | null;
  position: number;
  defaultVariantId: number | null;
  optionAxes: CatalogItemOptionAxisPayload[];
  variants: CatalogItemEditorPayload['variants'];
  quantityDiscounts: CatalogItemQuantityDiscountRule[];
  media: CatalogItemEditorPayload['media'];
  machineSerialOrderMatches: OrderItemSkuAllocationRow[];
};

export type CatalogItemPresentationPatch = {
  expectedUpdatedAt: string;
  itemName?: string;
  description?: string | null;
  brand?: string | null;
  badge?: string | null;
  material?: string | null;
  colour?: string | null;
  shape?: string | null;
  appearanceOverride?: CatalogItemAppearanceOverride | null;
  /** Explicit PATCH transport field; an empty map clears persisted label overrides. */
  specificationLabels?: CatalogSpecificationLabelOverrides;
  media?: CatalogItemMediaPayload[];
  variantSpecifications?: Array<{
    variantId: number;
    specifications: Record<string, string>;
    length?: number | null;
    width?: number | null;
    thickness?: number | null;
    weight?: number | null;
    errorTolerance?: string | null;
    variantSku?: string | null;
  }>;
};

export type CatalogItemPresentationSaveResponse = {
  item: CatalogItemEditorHydration;
};

export type ArchivedCatalogItemSummary = {
  id: number;
  slug: string;
  itemName: string;
  categoryLabel: string;
  sku: string | null;
  price: number;
  discountPct: number;
  statusBeforeDelete: CatalogItemPublicationStatus | null;
  deletedAt: string;
  purgeAfter: string;
  canPurge: boolean;
};

export type CatalogItemQuickPatch = {
  itemName?: string;
  sku?: string | null;
  status?: 'active' | 'inactive';
  badge?: string | null;
  categoryPath?: string[];
  categoryId?: string | null;
};

export type CatalogVariantQuickPatch = {
  variantName?: string;
  variantSku?: string | null;
  length?: number | null;
  width?: number | null;
  thickness?: number | null;
  weight?: number | null;
  errorTolerance?: string | null;
  price?: number;
  discountPct?: number;
  inventory?: number;
  minOrder?: number;
  status?: 'active' | 'inactive';
  badge?: string | null;
  position?: number;
};

export type CatalogItemIdentityField = 'name' | 'sku' | 'slug';

export type CatalogItemIdentityAvailability = {
  field: CatalogItemIdentityField;
  value: string;
  isAvailable: boolean;
  conflictLabel: string | null;
  suggestions: string[];
};

export type CatalogItemIdentityConflict = CatalogItemIdentityAvailability & {
  message: string;
};

export type CatalogItemSaveResponse = {
  id?: number;
  slug?: string;
  updatedAt?: string;
  message?: string;
};

export type CatalogItemSaveConflictResponse = {
  message: string;
  conflicts: CatalogItemIdentityConflict[];
};

export type CatalogItemSaveApiResponse = CatalogItemSaveResponse | CatalogItemSaveConflictResponse;

export type CatalogItemQuickSaveRequest = {
  itemIdentifier?: string;
  patch?: CatalogItemQuickPatch;
};

export type CatalogVariantQuickSaveRequest = {
  itemIdentifier?: string;
  variantId?: number;
  patch?: CatalogVariantQuickPatch;
};

export type CatalogItemQuickSaveResponse = {
  item?: AdminCatalogListItem;
  message?: string;
};

export type CatalogVariantQuickSaveResponse = {
  item?: AdminCatalogListItem;
  variant?: AdminCatalogVariantSummary;
  message?: string;
};

export type QuantityDiscountDraft = {
  id: string;
  persistedId?: number | null;
  minQuantity: number;
  discountPercent: number;
  appliesTo: string;
  variantTargets: string[];
  customerTargets: string[];
  note: string;
  position: number;
};

export type SimulatorOption = {
  id: string;
  label?: string;
  sku?: string;
  discountUnitLabel?: string;
  stockLabel?: string;
  minOrderLabel?: string;
};

export type UniversalProductSpecificData = {
  dimensions: Record<string, unknown>;
  simple: Record<string, unknown>;
  weight: Record<string, unknown>;
  uniqueMachine: Record<string, unknown>;
};
