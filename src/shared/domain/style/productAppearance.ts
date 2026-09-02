import {
  validateAndNormalizeCatalogSpecificationLabels,
  type CatalogSpecificationLabelOverrides
} from '@/shared/domain/catalog/catalogSpecification';

export const PRODUCT_APPEARANCE_SETTINGS_KEY = 'website-product-appearance';

export const PRODUCT_LISTING_MODES = ['grid', 'list', 'both'] as const;
export const PRODUCT_CARD_DENSITIES = ['compact', 'comfortable', 'spacious'] as const;
export const PRODUCT_IMAGE_RATIOS = ['1:1', '4:3', '3:2', '16:9'] as const;
export const PRODUCT_IMAGE_FITS = ['contain', 'cover'] as const;
export const PRODUCT_FILTER_PLACEMENTS = ['sidebar', 'toolbar'] as const;
export const PRODUCT_PAGINATION_STYLES = ['pages', 'load-more'] as const;
export const PRODUCT_WIDTH_MODES = ['global', 'wide'] as const;
export const PRODUCT_THUMBNAIL_POSITIONS = [
  'left',
  'right',
  'top',
  'bottom',
  'hidden'
] as const;
export const PRODUCT_ZOOM_MODES = ['none', 'click', 'hover-and-click'] as const;
export const PRODUCT_PRICE_EMPHASIS = ['standard', 'strong'] as const;
export const PRODUCT_VARIANT_SELECTOR_STYLES = ['auto', 'chips', 'select', 'swatches'] as const;
export const PRODUCT_PURCHASE_PANEL_STYLES = ['flat', 'card'] as const;
export const PRODUCT_SECONDARY_LAYOUTS = ['stacked', 'tabs', 'accordions'] as const;
export const PRODUCT_RELATED_SOURCE_MODES = [
  'same-category',
  'same-subcategory',
  'manual-only'
] as const;
export const PRODUCT_RELATED_MANUAL_PLACEMENTS = [
  'before-auto',
  'after-auto'
] as const;
export const PRODUCT_RELATED_SECTION_PLACEMENTS = [
  'before-content',
  'after-content'
] as const;
export const PRODUCT_RELATED_SECTION_ALIGNMENTS = [
  'left',
  'center',
  'right'
] as const;
export const PRODUCT_CART_SIDES = ['left', 'right'] as const;
export const PRODUCT_CART_MOBILE_MODES = ['fullscreen', 'sheet'] as const;
export const PRODUCT_CANVAS_MODES = ['guided', 'free'] as const;
export const PRODUCT_CANVAS_DEVICES = ['desktop', 'tablet', 'mobile'] as const;
export const PRODUCT_CANVAS_SHADOWS = ['none', 'sm', 'md', 'lg'] as const;

export type ProductListingMode = (typeof PRODUCT_LISTING_MODES)[number];
export type ProductCardDensity = (typeof PRODUCT_CARD_DENSITIES)[number];
export type ProductImageRatio = (typeof PRODUCT_IMAGE_RATIOS)[number];
export type ProductImageFit = (typeof PRODUCT_IMAGE_FITS)[number];
export type ProductFilterPlacement = (typeof PRODUCT_FILTER_PLACEMENTS)[number];
export type ProductPaginationStyle = (typeof PRODUCT_PAGINATION_STYLES)[number];
export type ProductWidthMode = (typeof PRODUCT_WIDTH_MODES)[number];
export type ProductThumbnailPosition = (typeof PRODUCT_THUMBNAIL_POSITIONS)[number];
export type ProductZoomMode = (typeof PRODUCT_ZOOM_MODES)[number];
export type ProductPriceEmphasis = (typeof PRODUCT_PRICE_EMPHASIS)[number];
export type ProductVariantSelectorStyle = (typeof PRODUCT_VARIANT_SELECTOR_STYLES)[number];
export type ProductPurchasePanelStyle = (typeof PRODUCT_PURCHASE_PANEL_STYLES)[number];
export type ProductSecondaryLayout = (typeof PRODUCT_SECONDARY_LAYOUTS)[number];
export type ProductRelatedSourceMode =
  (typeof PRODUCT_RELATED_SOURCE_MODES)[number];
export type ProductRelatedManualPlacement =
  (typeof PRODUCT_RELATED_MANUAL_PLACEMENTS)[number];
export type ProductRelatedSectionPlacement =
  (typeof PRODUCT_RELATED_SECTION_PLACEMENTS)[number];
export type ProductRelatedSectionAlignment =
  (typeof PRODUCT_RELATED_SECTION_ALIGNMENTS)[number];
export type ProductCartSide = (typeof PRODUCT_CART_SIDES)[number];
export type ProductCartMobileMode = (typeof PRODUCT_CART_MOBILE_MODES)[number];
export type ProductCanvasMode = (typeof PRODUCT_CANVAS_MODES)[number];
export type ProductCanvasDevice = (typeof PRODUCT_CANVAS_DEVICES)[number];
export type ProductCanvasShadow = (typeof PRODUCT_CANVAS_SHADOWS)[number];

export type ProductCanvasElementDeviceSettings = {
  visible: boolean;
  locked: boolean;
  aspectRatioLocked: boolean;
  offsetXPx: number;
  offsetYPx: number;
  widthPx: number;
  heightPx: number;
  contentScale: number;
  paddingTopPx: number;
  paddingRightPx: number;
  paddingBottomPx: number;
  paddingLeftPx: number;
  marginTopPx: number;
  marginRightPx: number;
  marginBottomPx: number;
  marginLeftPx: number;
  zIndex: number;
  opacity: number;
  color: string;
  backgroundColor: string;
  borderColor: string;
  borderWidthPx: number;
  borderRadiusPx: number;
  shadow: ProductCanvasShadow;
  fontFamily: string;
  fontSizePx: number;
  lineHeight: number;
  letterSpacingPx: number;
  fontWeight: number;
  textAlign: 'inherit' | 'left' | 'center' | 'right' | 'justify';
};

export type ProductCanvasElementSettings = {
  responsive: Record<ProductCanvasDevice, ProductCanvasElementDeviceSettings>;
};

export type ProductCanvasSettings = {
  mode: ProductCanvasMode;
  gridSizePx: number;
  snapToGrid: boolean;
  showGrid: boolean;
  showGuides: boolean;
  elements: Record<string, ProductCanvasElementSettings>;
};

export type ProductPurchaseAreaCopy = {
  priceSelectionPrompt: string;
  grossPriceLabel: string;
  netPriceLabel: string;
  taxLabel: string;
  savingsLabel: string;
  selectVariantLabel: string;
  selectVariantDetail: string;
  inactiveVariantLabel: string;
  inactiveVariantDetail: string;
  outOfStockLabel: string;
  outOfStockDetail: string;
  insufficientStockLabel: string;
  insufficientStockDetail: string;
  inStockLabel: string;
  inStockDetail: string;
  confirmationAvailabilityLabel: string;
  confirmationAvailabilityDetail: string;
  variantLabel: string;
  skuLabel: string;
  minimumOrderLabel: string;
  quantityLabel: string;
  decreaseQuantityLabel: string;
  increaseQuantityLabel: string;
  selectOptionsActionLabel: string;
  addToCartActionLabel: string;
  unavailableActionLabel: string;
  deliveryFallbackMessage: string;
  paymentMessage: string;
  secondaryActionLabel: string;
};

export const DEFAULT_PRODUCT_CANVAS_ELEMENT_DEVICE_SETTINGS: ProductCanvasElementDeviceSettings = {
  visible: true,
  locked: false,
  aspectRatioLocked: false,
  offsetXPx: 0,
  offsetYPx: 0,
  widthPx: 0,
  heightPx: 0,
  contentScale: 1,
  paddingTopPx: 0,
  paddingRightPx: 0,
  paddingBottomPx: 0,
  paddingLeftPx: 0,
  marginTopPx: 0,
  marginRightPx: 0,
  marginBottomPx: 0,
  marginLeftPx: 0,
  zIndex: 0,
  opacity: 1,
  color: '',
  backgroundColor: '',
  borderColor: '',
  borderWidthPx: 0,
  borderRadiusPx: 0,
  shadow: 'none',
  fontFamily: '',
  fontSizePx: 0,
  lineHeight: 0,
  letterSpacingPx: 0,
  fontWeight: 0,
  textAlign: 'inherit'
};

export const PRODUCT_PRIMARY_ACTION_MIN_WIDTH_PX = 160;
export const PRODUCT_PRIMARY_ACTION_MIN_HEIGHT_PX = 40;

export const PRODUCT_INFORMATION_BLOCKS = [
  'brand',
  'title',
  'badge',
  'sku',
  'shortDescription',
  'keyAttributes',
  'variants'
] as const;

export const PRODUCT_SECONDARY_BLOCKS = [
  'specifications',
  'description',
  'includedItems',
  'documents',
  'relatedProducts'
] as const;

export type ProductInformationBlock = (typeof PRODUCT_INFORMATION_BLOCKS)[number];
export type ProductSecondaryBlock = (typeof PRODUCT_SECONDARY_BLOCKS)[number];

export type ProductAppearanceConfig = {
  schemaVersion: number;
  listings: {
    availableModes: ProductListingMode;
    defaultMode: Exclude<ProductListingMode, 'both'>;
    desktopColumns: number;
    tabletColumns: number;
    mobileColumns: number;
    gapPx: number;
    cardDensity: ProductCardDensity;
    imageRatio: ProductImageRatio;
    imageFit: ProductImageFit;
    titleLines: number;
    showBrand: boolean;
    showSku: boolean;
    showShortDescription: boolean;
    showStock: boolean;
    showDiscount: boolean;
    showPurchaseAction: boolean;
    allowSimpleQuickAdd: boolean;
    showUnavailableVariants: boolean;
    filterPlacement: ProductFilterPlacement;
    paginationStyle: ProductPaginationStyle;
    subcategoryTilesVisible: boolean;
  };
  productPage: {
    widthMode: ProductWidthMode;
    contentMaxWidthPx: number;
    galleryColumns: number;
    informationColumns: number;
    purchaseColumns: number;
    columnGapPx: number;
    showBreadcrumbs: boolean;
    informationOrder: ProductInformationBlock[];
    stickyPurchaseDesktop: boolean;
    stickyPurchaseMobile: boolean;
  };
  gallery: {
    sizePercent: number;
    imageRatio: ProductImageRatio;
    imageFit: ProductImageFit;
    thumbnailPositionDesktop: ProductThumbnailPosition;
    thumbnailPositionMobile: ProductThumbnailPosition;
    thumbnailSizePx: number;
    thumbnailGapPx: number;
    visibleThumbnailCount: number;
    hideThumbnailsWhenSingle: boolean;
    showArrows: boolean;
    showDotsMobile: boolean;
    keyboardNavigation: boolean;
    zoomMode: ProductZoomMode;
    showVideoThumbnails: boolean;
    showDocumentThumbnails: boolean;
  };
  information: {
    showCategory: boolean;
    showBrand: boolean;
    showBadge: boolean;
    showSku: boolean;
    showShortDescription: boolean;
    showKeyAttributes: boolean;
    longDescriptionMaxWidthPx: number;
  };
  pricing: {
    emphasis: ProductPriceEmphasis;
    showGrossPrice: boolean;
    showNetPrice: boolean;
    showTaxRate: boolean;
    showTaxAmount: boolean;
    showOriginalPrice: boolean;
    showDiscountPercentage: boolean;
    showAbsoluteSavings: boolean;
    showUnitPrice: boolean;
    listingUsesPriceRange: boolean;
  };
  variants: {
    selectorStyle: ProductVariantSelectorStyle;
    selectWidthPx: number;
    selectHeightPx: number;
    chipWidthPx: number;
    chipHeightPx: number;
    chipFontSizePx: number;
    labelFontSizePx: number;
    labelControlGapPx: number;
    labelAboveSelector: boolean;
    compactSelectors: boolean;
    showUnavailableValues: boolean;
    showSelectedSummary: boolean;
    showCompatibilityReasons: boolean;
    autoSelectFallbackInStock: boolean;
  };
  purchaseArea: {
    panelStyle: ProductPurchasePanelStyle;
    fullWidthPrimaryAction: boolean;
    showAvailability: boolean;
    showDeliveryEstimate: boolean;
    showMinimumOrder: boolean;
    showQuantityStepper: boolean;
    showSecondaryAction: boolean;
    copy: ProductPurchaseAreaCopy;
  };
  secondaryContent: {
    desktopLayout: ProductSecondaryLayout;
    mobileLayout: ProductSecondaryLayout;
    blockOrder: ProductSecondaryBlock[];
    openByDefault: ProductSecondaryBlock[];
    specificationOrder: string[];
    specificationLabels: CatalogSpecificationLabelOverrides;
    combinedOverviewLabel: string;
    sectionLabels: Record<ProductSecondaryBlock, string>;
    showTabDivider: boolean;
    showContentDivider: boolean;
    showSpecificationColumnDivider: boolean;
    showSpecificationRowDividers: boolean;
    dividerThicknessPx: number;
    descriptionColumnPercent: number;
    specificationFirstColumnPercent: number;
    compactSpecifications: boolean;
    stripedSpecifications: boolean;
    documentsAsCards: boolean;
  };
  relatedProducts: {
    enabled: boolean;
    sourceMode: ProductRelatedSourceMode;
    manualProductSlugs: string[];
    manualPlacement: ProductRelatedManualPlacement;
    maxItems: number;
    desktopColumns: number;
    tabletColumns: number;
    mobileColumns: number;
    gapPx: number;
    cardWidthPx: number;
    imageHeightPx: number;
    textScalePercent: number;
    sectionPlacement: ProductRelatedSectionPlacement;
    sectionWidthPercent: number;
    sectionAlignment: ProductRelatedSectionAlignment;
    showAccessoriesFirst: boolean;
  };
  cartSidebar: {
    widthPx: number;
    side: ProductCartSide;
    mobileMode: ProductCartMobileMode;
    lineImageSizePx: number;
    compactRows: boolean;
    stickySummary: boolean;
    showNetTaxBreakdown: boolean;
    highlightAddedLine: boolean;
    showRelatedProducts: boolean;
  };
  canvas: ProductCanvasSettings;
  overrides: {
    allowCategoryTemplates: boolean;
    allowProductLayoutOverride: boolean;
    allowProductGalleryOverride: boolean;
    allowProductBlockVisibilityOverride: boolean;
  };
  updatedAt?: string | null;
};

export type ProductAppearanceOverride = {
  productPage?: Partial<ProductAppearanceConfig['productPage']>;
  gallery?: Partial<ProductAppearanceConfig['gallery']>;
  information?: Partial<ProductAppearanceConfig['information']>;
  secondaryContent?: Partial<ProductAppearanceConfig['secondaryContent']>;
  relatedProducts?: Partial<ProductAppearanceConfig['relatedProducts']>;
};

export const DEFAULT_PRODUCT_APPEARANCE_CONFIG: ProductAppearanceConfig = {
  schemaVersion: 10,
  listings: {
    availableModes: 'grid',
    defaultMode: 'grid',
    desktopColumns: 4,
    tabletColumns: 3,
    mobileColumns: 1,
    gapPx: 20,
    cardDensity: 'compact',
    imageRatio: '1:1',
    imageFit: 'contain',
    titleLines: 2,
    showBrand: true,
    showSku: false,
    showShortDescription: true,
    showStock: true,
    showDiscount: true,
    showPurchaseAction: true,
    allowSimpleQuickAdd: true,
    showUnavailableVariants: true,
    filterPlacement: 'sidebar',
    paginationStyle: 'pages',
    subcategoryTilesVisible: true
  },
  productPage: {
    widthMode: 'global',
    contentMaxWidthPx: 1500,
    galleryColumns: 6,
    informationColumns: 4,
    purchaseColumns: 4,
    columnGapPx: 44,
    showBreadcrumbs: true,
    informationOrder: [
      'title',
      'shortDescription',
      'variants',
      'brand',
      'badge',
      'sku',
      'keyAttributes'
    ],
    stickyPurchaseDesktop: true,
    stickyPurchaseMobile: true
  },
  gallery: {
    sizePercent: 100,
    imageRatio: '4:3',
    imageFit: 'cover',
    thumbnailPositionDesktop: 'left',
    thumbnailPositionMobile: 'bottom',
    thumbnailSizePx: 70,
    thumbnailGapPx: 16,
    visibleThumbnailCount: 6,
    hideThumbnailsWhenSingle: true,
    showArrows: true,
    showDotsMobile: true,
    keyboardNavigation: true,
    zoomMode: 'hover-and-click',
    showVideoThumbnails: true,
    showDocumentThumbnails: false
  },
  information: {
    showCategory: true,
    showBrand: false,
    showBadge: true,
    showSku: false,
    showShortDescription: false,
    showKeyAttributes: false,
    longDescriptionMaxWidthPx: 880
  },
  pricing: {
    emphasis: 'strong',
    showGrossPrice: true,
    showNetPrice: true,
    showTaxRate: true,
    showTaxAmount: true,
    showOriginalPrice: true,
    showDiscountPercentage: true,
    showAbsoluteSavings: false,
    showUnitPrice: true,
    listingUsesPriceRange: true
  },
  variants: {
    selectorStyle: 'auto',
    selectWidthPx: 260,
    selectHeightPx: 44,
    chipWidthPx: 88,
    chipHeightPx: 40,
    chipFontSizePx: 14,
    labelFontSizePx: 14,
    labelControlGapPx: 6,
    labelAboveSelector: true,
    compactSelectors: true,
    showUnavailableValues: true,
    showSelectedSummary: false,
    showCompatibilityReasons: true,
    autoSelectFallbackInStock: true
  },
  purchaseArea: {
    panelStyle: 'card',
    fullWidthPrimaryAction: true,
    showAvailability: true,
    showDeliveryEstimate: true,
    showMinimumOrder: true,
    showQuantityStepper: true,
    showSecondaryAction: false,
    copy: {
      priceSelectionPrompt: 'Cena bo prikazana po izbiri različice.',
      grossPriceLabel: 'z DDV',
      netPriceLabel: 'brez DDV',
      taxLabel: 'DDV',
      savingsLabel: 'Prihranek',
      selectVariantLabel: 'Izberite različico',
      selectVariantDetail: 'Za ceno in dobavljivost izberite vse možnosti.',
      inactiveVariantLabel: 'Različica ni na voljo',
      inactiveVariantDetail: 'Izberite drugo različico.',
      outOfStockLabel: 'Trenutno ni na zalogi',
      outOfStockDetail:
        'Artikel ostaja v ponudbi in bo ponovno dobavljiv; rok potrdimo naknadno.',
      insufficientStockLabel: 'Zaloga ne zadošča za najmanjše naročilo',
      insufficientStockDetail:
        'Na voljo je {stock} {unit}, najmanjše naročilo pa je {minimum} {unit}.',
      inStockLabel: 'Na zalogi',
      inStockDetail: 'Na voljo: {stock} {unit}',
      confirmationAvailabilityLabel: 'Dobavljivo po potrditvi',
      confirmationAvailabilityDetail:
        'Dobavljivost in rok potrdimo po prejemu naročila.',
      variantLabel: 'Različica',
      skuLabel: 'SKU',
      minimumOrderLabel: 'Minimalno naročilo',
      quantityLabel: 'Količina',
      decreaseQuantityLabel: 'Zmanjšaj količino',
      increaseQuantityLabel: 'Povečaj količino',
      selectOptionsActionLabel: 'Izberite vse možnosti',
      addToCartActionLabel: 'Dodaj v košarico',
      unavailableActionLabel: 'Trenutno ni mogoče naročiti',
      deliveryFallbackMessage:
        'Predvideni rok sporočimo ob potrditvi naročila.',
      paymentMessage: 'Plačilo uredimo ročno po ponudbi ali predračunu.',
      secondaryActionLabel: 'Vprašajte za ponudbo'
    }
  },
  secondaryContent: {
    desktopLayout: 'stacked',
    mobileLayout: 'accordions',
    blockOrder: [
      'description',
      'specifications',
      'documents',
      'includedItems',
      'relatedProducts'
    ],
    openByDefault: ['specifications', 'description'],
    specificationOrder: [
      'material',
      'barva',
      'oblika',
      'dimensions',
      'teza',
      'toleranca',
      'sku'
    ],
    specificationLabels: {},
    combinedOverviewLabel: 'Opis in specifikacije',
    sectionLabels: {
      specifications: 'Specifikacije',
      description: 'Opis izdelka',
      includedItems: 'Vključeno',
      documents: 'Dokumenti',
      relatedProducts: 'Sorodni izdelki'
    },
    showTabDivider: true,
    showContentDivider: true,
    showSpecificationColumnDivider: true,
    showSpecificationRowDividers: true,
    dividerThicknessPx: 1,
    descriptionColumnPercent: 42,
    specificationFirstColumnPercent: 50,
    compactSpecifications: true,
    stripedSpecifications: false,
    documentsAsCards: false
  },
  relatedProducts: {
    enabled: true,
    sourceMode: 'same-category',
    manualProductSlugs: [],
    manualPlacement: 'before-auto',
    maxItems: 4,
    desktopColumns: 4,
    tabletColumns: 2,
    mobileColumns: 1,
    gapPx: 24,
    cardWidthPx: 360,
    imageHeightPx: 144,
    textScalePercent: 100,
    sectionPlacement: 'after-content',
    sectionWidthPercent: 100,
    sectionAlignment: 'left',
    showAccessoriesFirst: true
  },
  cartSidebar: {
    widthPx: 456,
    side: 'right',
    mobileMode: 'fullscreen',
    lineImageSizePx: 72,
    compactRows: false,
    stickySummary: true,
    showNetTaxBreakdown: true,
    highlightAddedLine: true,
    showRelatedProducts: false
  },
  canvas: {
    mode: 'guided',
    gridSizePx: 8,
    snapToGrid: true,
    showGrid: false,
    showGuides: true,
    elements: {}
  },
  overrides: {
    allowCategoryTemplates: false,
    allowProductLayoutOverride: false,
    allowProductGalleryOverride: true,
    allowProductBlockVisibilityOverride: true
  },
  updatedAt: null
};

type UnknownRecord = Record<string, unknown>;
type ProductAppearanceCssVariables = Record<`--${string}`, string>;

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const asRecord = (value: unknown): UnknownRecord => value && typeof value === 'object' && !Array.isArray(value) ? value as UnknownRecord : {};
const asBoolean = (value: unknown, fallback: boolean) => typeof value === 'boolean' ? value : fallback;
const asString = (value: unknown, fallback: string) => typeof value === 'string' && value.trim() ? value.trim() : fallback;
const asNumber = (value: unknown, fallback: number, min: number, max: number) => {
  if (value === null || value === undefined || (typeof value === 'string' && !value.trim())) {
    return fallback;
  }
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.min(max, Math.max(min, Math.round(numeric))) : fallback;
};
const asDecimal = (value: unknown, fallback: number, min: number, max: number) => {
  if (value === null || value === undefined || (typeof value === 'string' && !value.trim())) {
    return fallback;
  }
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.min(max, Math.max(min, numeric)) : fallback;
};
const asOptionalString = (value: unknown, fallback = '', maxLength = 180) =>
  typeof value === 'string' ? value.trim().slice(0, maxLength) : fallback;
const asEnum = <T extends string>(value: unknown, values: readonly T[], fallback: T): T => values.includes(value as T) ? value as T : fallback;
const asOrderedSubset = <T extends string>(value: unknown, allowed: readonly T[], fallback: readonly T[]): T[] => {
  if (!Array.isArray(value)) return [...fallback];
  const normalized = value.filter((entry): entry is T => typeof entry === 'string' && allowed.includes(entry as T));
  const unique = [...new Set(normalized)];
  return unique.length > 0 ? unique : [...fallback];
};
const asStringList = (
  value: unknown,
  fallback: readonly string[] = [],
  maximum = 24
) => {
  if (!Array.isArray(value)) return [...fallback];
  return [
    ...new Set(
      value
        .filter((entry): entry is string => typeof entry === 'string')
        .map((entry) => entry.trim().slice(0, 180))
        .filter(Boolean)
    )
  ].slice(0, maximum);
};

const MAX_PRODUCT_CANVAS_ELEMENTS = 160;

export function normalizeProductCanvasElementDeviceSettings(
  value: unknown,
  fallback: ProductCanvasElementDeviceSettings
): ProductCanvasElementDeviceSettings {
  const record = asRecord(value);
  return {
    visible: asBoolean(record.visible, fallback.visible),
    locked: asBoolean(record.locked, fallback.locked),
    aspectRatioLocked: asBoolean(
      record.aspectRatioLocked,
      fallback.aspectRatioLocked
    ),
    offsetXPx: asNumber(record.offsetXPx, fallback.offsetXPx, -5000, 5000),
    offsetYPx: asNumber(record.offsetYPx, fallback.offsetYPx, -5000, 5000),
    widthPx: asNumber(record.widthPx, fallback.widthPx, 0, 5000),
    heightPx: asNumber(record.heightPx, fallback.heightPx, 0, 5000),
    contentScale: asDecimal(record.contentScale, fallback.contentScale, 0.1, 4),
    paddingTopPx: asNumber(record.paddingTopPx, fallback.paddingTopPx, 0, 1000),
    paddingRightPx: asNumber(record.paddingRightPx, fallback.paddingRightPx, 0, 1000),
    paddingBottomPx: asNumber(record.paddingBottomPx, fallback.paddingBottomPx, 0, 1000),
    paddingLeftPx: asNumber(record.paddingLeftPx, fallback.paddingLeftPx, 0, 1000),
    marginTopPx: asNumber(record.marginTopPx, fallback.marginTopPx, -1000, 2000),
    marginRightPx: asNumber(record.marginRightPx, fallback.marginRightPx, -1000, 2000),
    marginBottomPx: asNumber(record.marginBottomPx, fallback.marginBottomPx, -1000, 2000),
    marginLeftPx: asNumber(record.marginLeftPx, fallback.marginLeftPx, -1000, 2000),
    zIndex: asNumber(record.zIndex, fallback.zIndex, -100, 1000),
    opacity: asDecimal(record.opacity, fallback.opacity, 0, 1),
    color: asOptionalString(record.color, fallback.color),
    backgroundColor: asOptionalString(record.backgroundColor, fallback.backgroundColor),
    borderColor: asOptionalString(record.borderColor, fallback.borderColor),
    borderWidthPx: asNumber(record.borderWidthPx, fallback.borderWidthPx, 0, 24),
    borderRadiusPx: asNumber(record.borderRadiusPx, fallback.borderRadiusPx, 0, 240),
    shadow: asEnum(record.shadow, PRODUCT_CANVAS_SHADOWS, fallback.shadow),
    fontFamily: asOptionalString(record.fontFamily, fallback.fontFamily, 120),
    fontSizePx: asDecimal(record.fontSizePx, fallback.fontSizePx, 0, 240),
    lineHeight: asDecimal(record.lineHeight, fallback.lineHeight, 0, 4),
    letterSpacingPx: asDecimal(record.letterSpacingPx, fallback.letterSpacingPx, -20, 100),
    fontWeight: asNumber(record.fontWeight, fallback.fontWeight, 0, 900),
    textAlign: asEnum(
      record.textAlign,
      ['inherit', 'left', 'center', 'right', 'justify'] as const,
      fallback.textAlign
    )
  };
}

function normalizeProductCanvasElement(
  value: unknown,
  elementId = ''
): ProductCanvasElementSettings {
  const record = asRecord(value);
  const responsive = asRecord(record.responsive);
  const normalizeDevice = (deviceValue: unknown) => {
    let settings = normalizeProductCanvasElementDeviceSettings(
      deviceValue,
      DEFAULT_PRODUCT_CANVAS_ELEMENT_DEVICE_SETTINGS
    );
    if (elementId === 'product-primary-action') {
      settings = {
        ...settings,
        widthPx: settings.widthPx > 0
          ? Math.max(PRODUCT_PRIMARY_ACTION_MIN_WIDTH_PX, settings.widthPx)
          : 0,
        heightPx: settings.heightPx > 0
          ? Math.max(PRODUCT_PRIMARY_ACTION_MIN_HEIGHT_PX, settings.heightPx)
          : 0
      };
    }
    return settings;
  };
  return {
    responsive: {
      desktop: normalizeDevice(responsive.desktop),
      tablet: normalizeDevice(responsive.tablet),
      mobile: normalizeDevice(responsive.mobile)
    }
  };
}

function normalizeProductCanvas(value: unknown): ProductCanvasSettings {
  const record = asRecord(value);
  const elementSource = asRecord(record.elements);
  const elements: ProductCanvasSettings['elements'] = {};
  for (const [rawElementId, element] of Object.entries(elementSource)) {
    const elementId = rawElementId.trim().slice(0, 160);
    if (
      !elementId
      || ['__proto__', 'prototype', 'constructor'].includes(elementId)
      || Object.prototype.hasOwnProperty.call(elements, elementId)
    ) {
      continue;
    }
    elements[elementId] = normalizeProductCanvasElement(
      element,
      elementId
    );
    if (Object.keys(elements).length >= MAX_PRODUCT_CANVAS_ELEMENTS) break;
  }

  return {
    mode: asEnum(record.mode, PRODUCT_CANVAS_MODES, 'guided'),
    gridSizePx: asNumber(record.gridSizePx, 8, 2, 64),
    snapToGrid: asBoolean(record.snapToGrid, true),
    showGrid: asBoolean(record.showGrid, false),
    showGuides: asBoolean(record.showGuides, true),
    elements
  };
}

export function resolveProductCanvasElementDeviceSettings(
  value: ProductAppearanceConfig | ProductCanvasSettings | unknown,
  elementId: string,
  device: ProductCanvasDevice
): ProductCanvasElementDeviceSettings {
  const source = asRecord(value);
  const canvas = asRecord(
    Object.prototype.hasOwnProperty.call(source, 'canvas') ? source.canvas : value
  );
  const rawElement = asRecord(asRecord(canvas.elements)[elementId]);
  if (Object.keys(rawElement).length === 0) {
    return clone(DEFAULT_PRODUCT_CANVAS_ELEMENT_DEVICE_SETTINGS);
  }
  return clone(normalizeProductCanvasElement(
    rawElement,
    elementId
  ).responsive[device]);
}

export function cloneDefaultProductAppearanceConfig() {
  return clone(DEFAULT_PRODUCT_APPEARANCE_CONFIG);
}

export function normalizeProductAppearanceConfig(value: unknown): ProductAppearanceConfig {
  const record = asRecord(value);
  const listings = asRecord(record.listings);
  const productPage = asRecord(record.productPage);
  const gallery = asRecord(record.gallery);
  const information = asRecord(record.information);
  const pricing = asRecord(record.pricing);
  const variants = asRecord(record.variants);
  const purchaseArea = asRecord(record.purchaseArea);
  const purchaseAreaCopy = asRecord(purchaseArea.copy);
  const secondaryContent = asRecord(record.secondaryContent);
  const secondaryContentSectionLabels = asRecord(secondaryContent.sectionLabels);
  const relatedProducts = asRecord(record.relatedProducts);
  const cartSidebar = asRecord(record.cartSidebar);
  const canvas = record.canvas;
  const overrides = asRecord(record.overrides);
  const defaults = DEFAULT_PRODUCT_APPEARANCE_CONFIG;

  const availableModes = asEnum(listings.availableModes, PRODUCT_LISTING_MODES, defaults.listings.availableModes);
  const defaultModeCandidate = asEnum(listings.defaultMode, ['grid', 'list'] as const, defaults.listings.defaultMode);
  const deliveryFallbackMessage = asOptionalString(
    purchaseAreaCopy.deliveryFallbackMessage,
    defaults.purchaseArea.copy.deliveryFallbackMessage,
    320
  );
  const minimumOrderLabel = asString(
    purchaseAreaCopy.minimumOrderLabel,
    defaults.purchaseArea.copy.minimumOrderLabel
  );
  const normalizedMinimumOrderLabel = minimumOrderLabel === 'Najmanjše naročilo'
    ? defaults.purchaseArea.copy.minimumOrderLabel : minimumOrderLabel;
  return {
    schemaVersion: defaults.schemaVersion,
    listings: {
      availableModes,
      defaultMode: availableModes === 'both' || availableModes === defaultModeCandidate ? defaultModeCandidate : availableModes,
      desktopColumns: asNumber(listings.desktopColumns, defaults.listings.desktopColumns, 2, 6),
      tabletColumns: asNumber(listings.tabletColumns, defaults.listings.tabletColumns, 1, 4),
      mobileColumns: asNumber(listings.mobileColumns, defaults.listings.mobileColumns, 1, 2),
      gapPx: asNumber(listings.gapPx, defaults.listings.gapPx, 8, 48),
      cardDensity: asEnum(
        listings.cardDensity,
        PRODUCT_CARD_DENSITIES,
        defaults.listings.cardDensity
      ),
      imageRatio: asEnum(
        listings.imageRatio,
        PRODUCT_IMAGE_RATIOS,
        defaults.listings.imageRatio
      ),
      imageFit: asEnum(listings.imageFit, PRODUCT_IMAGE_FITS, defaults.listings.imageFit),
      titleLines: asNumber(listings.titleLines, defaults.listings.titleLines, 1, 4),
      showBrand: asBoolean(listings.showBrand, defaults.listings.showBrand),
      showSku: asBoolean(listings.showSku, defaults.listings.showSku),
      showShortDescription: asBoolean(
        listings.showShortDescription,
        defaults.listings.showShortDescription
      ),
      showStock: asBoolean(listings.showStock, defaults.listings.showStock),
      showDiscount: asBoolean(listings.showDiscount, defaults.listings.showDiscount),
      showPurchaseAction: asBoolean(listings.showPurchaseAction, defaults.listings.showPurchaseAction),
      allowSimpleQuickAdd: asBoolean(listings.allowSimpleQuickAdd, defaults.listings.allowSimpleQuickAdd),
      // These remain explicit in the schema so the future filtering/paging
      // data model has a stable home, but they are fixed until that model
      // exists. Active stock-zero variants are an agreed catalogue invariant.
      showUnavailableVariants: true,
      filterPlacement: defaults.listings.filterPlacement,
      paginationStyle: defaults.listings.paginationStyle,
      subcategoryTilesVisible: true
    },
    productPage: {
      // The product page shares the content lane governed by Globalni parametri.
      widthMode: 'global',
      contentMaxWidthPx: asNumber(
        productPage.contentMaxWidthPx,
        defaults.productPage.contentMaxWidthPx,
        1120,
        1680
      ),
      galleryColumns: asNumber(productPage.galleryColumns, defaults.productPage.galleryColumns, 3, 7),
      informationColumns: asNumber(productPage.informationColumns, defaults.productPage.informationColumns, 3, 6),
      purchaseColumns: asNumber(productPage.purchaseColumns, defaults.productPage.purchaseColumns, 2, 5),
      columnGapPx: asNumber(
        productPage.columnGapPx,
        defaults.productPage.columnGapPx,
        8,
        64
      ),
      showBreadcrumbs: asBoolean(productPage.showBreadcrumbs, defaults.productPage.showBreadcrumbs),
      informationOrder: asOrderedSubset(productPage.informationOrder, PRODUCT_INFORMATION_BLOCKS, defaults.productPage.informationOrder),
      stickyPurchaseDesktop: asBoolean(productPage.stickyPurchaseDesktop, defaults.productPage.stickyPurchaseDesktop),
      stickyPurchaseMobile: asBoolean(productPage.stickyPurchaseMobile, defaults.productPage.stickyPurchaseMobile)
    },
    gallery: {
      sizePercent: asNumber(
        gallery.sizePercent,
        defaults.gallery.sizePercent,
        50,
        100
      ),
      imageRatio: asEnum(gallery.imageRatio, PRODUCT_IMAGE_RATIOS, defaults.gallery.imageRatio),
      imageFit: asEnum(gallery.imageFit, PRODUCT_IMAGE_FITS, defaults.gallery.imageFit),
      thumbnailPositionDesktop: asEnum(gallery.thumbnailPositionDesktop, PRODUCT_THUMBNAIL_POSITIONS, defaults.gallery.thumbnailPositionDesktop),
      thumbnailPositionMobile: asEnum(gallery.thumbnailPositionMobile, PRODUCT_THUMBNAIL_POSITIONS, defaults.gallery.thumbnailPositionMobile),
      thumbnailSizePx: asNumber(
        gallery.thumbnailSizePx,
        defaults.gallery.thumbnailSizePx,
        30,
        120
      ),
      thumbnailGapPx: asNumber(
        gallery.thumbnailGapPx,
        defaults.gallery.thumbnailGapPx,
        0,
        40
      ),
      visibleThumbnailCount: asNumber(gallery.visibleThumbnailCount, defaults.gallery.visibleThumbnailCount, 3, 12),
      hideThumbnailsWhenSingle: asBoolean(
        gallery.hideThumbnailsWhenSingle,
        defaults.gallery.hideThumbnailsWhenSingle
      ),
      showArrows: asBoolean(gallery.showArrows, defaults.gallery.showArrows),
      showDotsMobile: asBoolean(gallery.showDotsMobile, defaults.gallery.showDotsMobile),
      keyboardNavigation: asBoolean(gallery.keyboardNavigation, defaults.gallery.keyboardNavigation),
      zoomMode: asEnum(gallery.zoomMode, PRODUCT_ZOOM_MODES, defaults.gallery.zoomMode),
      showVideoThumbnails: asBoolean(gallery.showVideoThumbnails, defaults.gallery.showVideoThumbnails),
      showDocumentThumbnails: asBoolean(gallery.showDocumentThumbnails, defaults.gallery.showDocumentThumbnails)
    },
    information: {
      showCategory: asBoolean(information.showCategory, defaults.information.showCategory),
      showBrand: asBoolean(information.showBrand, defaults.information.showBrand),
      showBadge: asBoolean(information.showBadge, defaults.information.showBadge),
      showSku: asBoolean(information.showSku, defaults.information.showSku),
      showShortDescription: asBoolean(information.showShortDescription, defaults.information.showShortDescription),
      showKeyAttributes: asBoolean(information.showKeyAttributes, defaults.information.showKeyAttributes),
      longDescriptionMaxWidthPx: asNumber(information.longDescriptionMaxWidthPx, defaults.information.longDescriptionMaxWidthPx, 480, 1400)
    },
    pricing: {
      emphasis: asEnum(pricing.emphasis, PRODUCT_PRICE_EMPHASIS, defaults.pricing.emphasis),
      showGrossPrice: true,
      showNetPrice: true,
      showTaxRate: true,
      showTaxAmount: true,
      showOriginalPrice: asBoolean(pricing.showOriginalPrice, defaults.pricing.showOriginalPrice),
      showDiscountPercentage: asBoolean(pricing.showDiscountPercentage, defaults.pricing.showDiscountPercentage),
      showAbsoluteSavings: asBoolean(pricing.showAbsoluteSavings, defaults.pricing.showAbsoluteSavings),
      showUnitPrice: asBoolean(pricing.showUnitPrice, defaults.pricing.showUnitPrice),
      listingUsesPriceRange: asBoolean(pricing.listingUsesPriceRange, defaults.pricing.listingUsesPriceRange)
    },
    variants: {
      selectorStyle: asEnum(variants.selectorStyle, PRODUCT_VARIANT_SELECTOR_STYLES, defaults.variants.selectorStyle),
      selectWidthPx: asNumber(
        variants.selectWidthPx,
        defaults.variants.selectWidthPx,
        160,
        500
      ),
      selectHeightPx: asNumber(
        variants.selectHeightPx,
        defaults.variants.selectHeightPx,
        40,
        88
      ),
      chipWidthPx: asNumber(
        variants.chipWidthPx,
        defaults.variants.chipWidthPx,
        72,
        180
      ),
      chipHeightPx: asNumber(
        variants.chipHeightPx,
        defaults.variants.chipHeightPx,
        36,
        80
      ),
      chipFontSizePx: asNumber(
        variants.chipFontSizePx,
        defaults.variants.chipFontSizePx,
        11,
        24
      ),
      labelFontSizePx: asNumber(
        variants.labelFontSizePx,
        defaults.variants.labelFontSizePx,
        11,
        28
      ),
      labelControlGapPx: asNumber(
        variants.labelControlGapPx,
        defaults.variants.labelControlGapPx,
        0,
        32
      ),
      labelAboveSelector: asBoolean(variants.labelAboveSelector, defaults.variants.labelAboveSelector),
      compactSelectors: asBoolean(
        variants.compactSelectors,
        defaults.variants.compactSelectors
      ),
      showUnavailableValues: true,
      showSelectedSummary: asBoolean(variants.showSelectedSummary, defaults.variants.showSelectedSummary),
      showCompatibilityReasons: asBoolean(variants.showCompatibilityReasons, defaults.variants.showCompatibilityReasons),
      autoSelectFallbackInStock: true
    },
    purchaseArea: {
      panelStyle: asEnum(purchaseArea.panelStyle, PRODUCT_PURCHASE_PANEL_STYLES, defaults.purchaseArea.panelStyle),
      fullWidthPrimaryAction: asBoolean(purchaseArea.fullWidthPrimaryAction, defaults.purchaseArea.fullWidthPrimaryAction),
      showAvailability: asBoolean(purchaseArea.showAvailability, defaults.purchaseArea.showAvailability),
      showDeliveryEstimate: asBoolean(purchaseArea.showDeliveryEstimate, defaults.purchaseArea.showDeliveryEstimate),
      showMinimumOrder: asBoolean(purchaseArea.showMinimumOrder, defaults.purchaseArea.showMinimumOrder),
      showQuantityStepper: asBoolean(purchaseArea.showQuantityStepper, defaults.purchaseArea.showQuantityStepper),
      showSecondaryAction: asBoolean(purchaseArea.showSecondaryAction, defaults.purchaseArea.showSecondaryAction),
      copy: {
        priceSelectionPrompt: asString(
          purchaseAreaCopy.priceSelectionPrompt,
          defaults.purchaseArea.copy.priceSelectionPrompt
        ),
        grossPriceLabel: asString(
          purchaseAreaCopy.grossPriceLabel,
          defaults.purchaseArea.copy.grossPriceLabel
        ),
        netPriceLabel: asString(
          purchaseAreaCopy.netPriceLabel,
          defaults.purchaseArea.copy.netPriceLabel
        ),
        taxLabel: asString(
          purchaseAreaCopy.taxLabel,
          defaults.purchaseArea.copy.taxLabel
        ),
        savingsLabel: asString(
          purchaseAreaCopy.savingsLabel,
          defaults.purchaseArea.copy.savingsLabel
        ),
        selectVariantLabel: asString(
          purchaseAreaCopy.selectVariantLabel,
          defaults.purchaseArea.copy.selectVariantLabel
        ),
        selectVariantDetail: asOptionalString(
          purchaseAreaCopy.selectVariantDetail,
          defaults.purchaseArea.copy.selectVariantDetail,
          240
        ),
        inactiveVariantLabel: asString(
          purchaseAreaCopy.inactiveVariantLabel,
          defaults.purchaseArea.copy.inactiveVariantLabel
        ),
        inactiveVariantDetail: asOptionalString(
          purchaseAreaCopy.inactiveVariantDetail,
          defaults.purchaseArea.copy.inactiveVariantDetail,
          240
        ),
        outOfStockLabel: asString(
          purchaseAreaCopy.outOfStockLabel,
          defaults.purchaseArea.copy.outOfStockLabel
        ),
        outOfStockDetail: asOptionalString(
          purchaseAreaCopy.outOfStockDetail,
          defaults.purchaseArea.copy.outOfStockDetail,
          320
        ),
        insufficientStockLabel: asString(
          purchaseAreaCopy.insufficientStockLabel,
          defaults.purchaseArea.copy.insufficientStockLabel
        ),
        insufficientStockDetail: asOptionalString(
          purchaseAreaCopy.insufficientStockDetail,
          defaults.purchaseArea.copy.insufficientStockDetail,
          320
        ),
        inStockLabel: asString(
          purchaseAreaCopy.inStockLabel,
          defaults.purchaseArea.copy.inStockLabel
        ),
        inStockDetail: asOptionalString(
          purchaseAreaCopy.inStockDetail,
          defaults.purchaseArea.copy.inStockDetail,
          240
        ),
        confirmationAvailabilityLabel: asString(
          purchaseAreaCopy.confirmationAvailabilityLabel,
          defaults.purchaseArea.copy.confirmationAvailabilityLabel
        ),
        confirmationAvailabilityDetail: asOptionalString(
          purchaseAreaCopy.confirmationAvailabilityDetail,
          defaults.purchaseArea.copy.confirmationAvailabilityDetail,
          320
        ),
        variantLabel: asString(
          purchaseAreaCopy.variantLabel,
          defaults.purchaseArea.copy.variantLabel
        ),
        skuLabel: asString(
          purchaseAreaCopy.skuLabel,
          defaults.purchaseArea.copy.skuLabel
        ),
        minimumOrderLabel: normalizedMinimumOrderLabel,
        quantityLabel: asString(
          purchaseAreaCopy.quantityLabel,
          defaults.purchaseArea.copy.quantityLabel
        ),
        decreaseQuantityLabel: asString(
          purchaseAreaCopy.decreaseQuantityLabel,
          defaults.purchaseArea.copy.decreaseQuantityLabel
        ),
        increaseQuantityLabel: asString(
          purchaseAreaCopy.increaseQuantityLabel,
          defaults.purchaseArea.copy.increaseQuantityLabel
        ),
        selectOptionsActionLabel: asString(
          purchaseAreaCopy.selectOptionsActionLabel,
          defaults.purchaseArea.copy.selectOptionsActionLabel
        ),
        addToCartActionLabel: asString(
          purchaseAreaCopy.addToCartActionLabel,
          defaults.purchaseArea.copy.addToCartActionLabel
        ),
        unavailableActionLabel: asString(
          purchaseAreaCopy.unavailableActionLabel,
          defaults.purchaseArea.copy.unavailableActionLabel
        ),
        deliveryFallbackMessage,
        paymentMessage: asOptionalString(
          purchaseAreaCopy.paymentMessage,
          defaults.purchaseArea.copy.paymentMessage,
          320
        ),
        secondaryActionLabel: asString(
          purchaseAreaCopy.secondaryActionLabel,
          defaults.purchaseArea.copy.secondaryActionLabel
        )
      }
    },
    secondaryContent: {
      desktopLayout: asEnum(secondaryContent.desktopLayout, PRODUCT_SECONDARY_LAYOUTS, defaults.secondaryContent.desktopLayout),
      mobileLayout: asEnum(secondaryContent.mobileLayout, PRODUCT_SECONDARY_LAYOUTS, defaults.secondaryContent.mobileLayout),
      blockOrder: asOrderedSubset(secondaryContent.blockOrder, PRODUCT_SECONDARY_BLOCKS, defaults.secondaryContent.blockOrder),
      openByDefault: asOrderedSubset(secondaryContent.openByDefault, PRODUCT_SECONDARY_BLOCKS, defaults.secondaryContent.openByDefault),
      specificationOrder: asStringList(
        secondaryContent.specificationOrder,
        defaults.secondaryContent.specificationOrder,
        80
      ),
      specificationLabels: (() => {
        const result = validateAndNormalizeCatalogSpecificationLabels(
          secondaryContent.specificationLabels
        );
        return result.ok ? result.value : defaults.secondaryContent.specificationLabels;
      })(),
      combinedOverviewLabel: asString(
        secondaryContent.combinedOverviewLabel,
        defaults.secondaryContent.combinedOverviewLabel
      ),
      sectionLabels: Object.fromEntries(
        PRODUCT_SECONDARY_BLOCKS.map((block) => [
          block,
          asString(
            secondaryContentSectionLabels[block],
            defaults.secondaryContent.sectionLabels[block]
          )
        ])
      ) as Record<ProductSecondaryBlock, string>,
      showTabDivider: asBoolean(
        secondaryContent.showTabDivider,
        defaults.secondaryContent.showTabDivider
      ),
      showContentDivider: asBoolean(
        secondaryContent.showContentDivider,
        defaults.secondaryContent.showContentDivider
      ),
      showSpecificationColumnDivider: asBoolean(
        secondaryContent.showSpecificationColumnDivider,
        defaults.secondaryContent.showSpecificationColumnDivider
      ),
      showSpecificationRowDividers: asBoolean(
        secondaryContent.showSpecificationRowDividers,
        defaults.secondaryContent.showSpecificationRowDividers
      ),
      dividerThicknessPx: asDecimal(
        secondaryContent.dividerThicknessPx,
        defaults.secondaryContent.dividerThicknessPx,
        0.5,
        4
      ),
      descriptionColumnPercent: asNumber(
        secondaryContent.descriptionColumnPercent,
        defaults.secondaryContent.descriptionColumnPercent,
        30,
        65
      ),
      specificationFirstColumnPercent: asNumber(
        secondaryContent.specificationFirstColumnPercent,
        defaults.secondaryContent.specificationFirstColumnPercent,
        35,
        65
      ),
      compactSpecifications: asBoolean(secondaryContent.compactSpecifications, defaults.secondaryContent.compactSpecifications),
      stripedSpecifications: asBoolean(secondaryContent.stripedSpecifications, defaults.secondaryContent.stripedSpecifications),
      documentsAsCards: asBoolean(secondaryContent.documentsAsCards, defaults.secondaryContent.documentsAsCards)
    },
    relatedProducts: {
      enabled: asBoolean(relatedProducts.enabled, defaults.relatedProducts.enabled),
      sourceMode: asEnum(
        relatedProducts.sourceMode,
        PRODUCT_RELATED_SOURCE_MODES,
        defaults.relatedProducts.sourceMode
      ),
      manualProductSlugs: asStringList(
        relatedProducts.manualProductSlugs,
        defaults.relatedProducts.manualProductSlugs,
        48
      ),
      manualPlacement: asEnum(
        relatedProducts.manualPlacement,
        PRODUCT_RELATED_MANUAL_PLACEMENTS,
        defaults.relatedProducts.manualPlacement
      ),
      maxItems: asNumber(relatedProducts.maxItems, defaults.relatedProducts.maxItems, 1, 12),
      desktopColumns: asNumber(relatedProducts.desktopColumns, defaults.relatedProducts.desktopColumns, 2, 6),
      tabletColumns: asNumber(relatedProducts.tabletColumns, defaults.relatedProducts.tabletColumns, 1, 4),
      mobileColumns: asNumber(relatedProducts.mobileColumns, defaults.relatedProducts.mobileColumns, 1, 2),
      gapPx: asNumber(
        relatedProducts.gapPx,
        defaults.relatedProducts.gapPx,
        8,
        64
      ),
      cardWidthPx: asNumber(
        relatedProducts.cardWidthPx,
        defaults.relatedProducts.cardWidthPx,
        160,
        520
      ),
      imageHeightPx: asNumber(
        relatedProducts.imageHeightPx,
        defaults.relatedProducts.imageHeightPx,
        96,
        480
      ),
      textScalePercent: asNumber(
        relatedProducts.textScalePercent,
        defaults.relatedProducts.textScalePercent,
        70,
        140
      ),
      sectionPlacement: asEnum(
        relatedProducts.sectionPlacement,
        PRODUCT_RELATED_SECTION_PLACEMENTS,
        defaults.relatedProducts.sectionPlacement
      ),
      sectionWidthPercent: asNumber(
        relatedProducts.sectionWidthPercent,
        defaults.relatedProducts.sectionWidthPercent,
        25,
        100
      ),
      sectionAlignment: asEnum(
        relatedProducts.sectionAlignment,
        PRODUCT_RELATED_SECTION_ALIGNMENTS,
        defaults.relatedProducts.sectionAlignment
      ),
      showAccessoriesFirst: asBoolean(
        relatedProducts.showAccessoriesFirst,
        defaults.relatedProducts.showAccessoriesFirst
      )
    },
    cartSidebar: {
      widthPx: asNumber(cartSidebar.widthPx, defaults.cartSidebar.widthPx, 360, 640),
      side: asEnum(cartSidebar.side, PRODUCT_CART_SIDES, defaults.cartSidebar.side),
      mobileMode: asEnum(cartSidebar.mobileMode, PRODUCT_CART_MOBILE_MODES, defaults.cartSidebar.mobileMode),
      lineImageSizePx: asNumber(cartSidebar.lineImageSizePx, defaults.cartSidebar.lineImageSizePx, 48, 120),
      compactRows: asBoolean(cartSidebar.compactRows, defaults.cartSidebar.compactRows),
      stickySummary: asBoolean(cartSidebar.stickySummary, defaults.cartSidebar.stickySummary),
      showNetTaxBreakdown: true,
      highlightAddedLine: asBoolean(cartSidebar.highlightAddedLine, defaults.cartSidebar.highlightAddedLine),
      showRelatedProducts: false
    },
    canvas: normalizeProductCanvas(canvas),
    overrides: {
      allowCategoryTemplates: false,
      allowProductLayoutOverride: asBoolean(overrides.allowProductLayoutOverride, defaults.overrides.allowProductLayoutOverride),
      allowProductGalleryOverride: asBoolean(overrides.allowProductGalleryOverride, defaults.overrides.allowProductGalleryOverride),
      allowProductBlockVisibilityOverride: asBoolean(overrides.allowProductBlockVisibilityOverride, defaults.overrides.allowProductBlockVisibilityOverride)
    },
    updatedAt: typeof record.updatedAt === 'string' ? record.updatedAt : typeof record.updated_at === 'string' ? record.updated_at : null
  };
}

export function toStoredProductAppearanceConfig(value: unknown): Omit<ProductAppearanceConfig, 'updatedAt'> {
  const normalized = normalizeProductAppearanceConfig(value);
  const { updatedAt: _updatedAt, ...stored } = normalized;
  return stored;
}

export function resolveProductAppearanceConfig(
  globalConfig: unknown,
  productOverride: unknown
): ProductAppearanceConfig {
  const base = normalizeProductAppearanceConfig(globalConfig);
  const override = asRecord(productOverride);
  const overrideSecondaryContent = asRecord(override.secondaryContent);
  const merged: ProductAppearanceConfig = clone(base);

  if (base.overrides.allowProductLayoutOverride) {
    merged.productPage = {
      ...merged.productPage,
      ...asRecord(override.productPage)
    } as ProductAppearanceConfig['productPage'];
  }
  if (base.overrides.allowProductGalleryOverride) {
    merged.gallery = {
      ...merged.gallery,
      ...asRecord(override.gallery)
    } as ProductAppearanceConfig['gallery'];
  }
  if (base.overrides.allowProductBlockVisibilityOverride) {
    merged.information = {
      ...merged.information,
      ...asRecord(override.information)
    } as ProductAppearanceConfig['information'];
    merged.secondaryContent = {
      ...merged.secondaryContent,
      ...overrideSecondaryContent
    } as ProductAppearanceConfig['secondaryContent'];
    merged.relatedProducts = {
      ...merged.relatedProducts,
      ...asRecord(override.relatedProducts)
    } as ProductAppearanceConfig['relatedProducts'];
  }

  // Display labels are item content, not a layout capability. Keep them
  // effective even when broader per-product block/layout overrides are off.
  if (Object.prototype.hasOwnProperty.call(
    overrideSecondaryContent,
    'specificationLabels'
  )) {
    const labels = validateAndNormalizeCatalogSpecificationLabels(
      overrideSecondaryContent.specificationLabels
    );
    if (labels.ok) merged.secondaryContent.specificationLabels = labels.value;
  }

  return normalizeProductAppearanceConfig(merged);
}

export function validateProductAppearanceConfigInput(value: unknown): string[] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return ['Nastavitve prikaza artiklov niso veljavne.'];
  }
  const normalized = normalizeProductAppearanceConfig(value);
  const columnTotal = normalized.productPage.galleryColumns
    + normalized.productPage.informationColumns
    + normalized.productPage.purchaseColumns;
  const errors: string[] = [];
  if (columnTotal < 10 || columnTotal > 16) {
    errors.push('Vsota stolpcev galerije, informacij in nakupa mora biti med 10 in 16.');
  }
  if (
    !normalized.pricing.showGrossPrice
    || !normalized.pricing.showNetPrice
    || !normalized.pricing.showTaxRate
    || !normalized.pricing.showTaxAmount
  ) {
    errors.push('Cena z DDV ter neto in DDV razčlenitev morajo ostati vidne.');
  }
  return errors;
}

export function toProductAppearanceCssVariables(
  value: unknown,
  dimensionScale = 1
): ProductAppearanceCssVariables {
  const config = normalizeProductAppearanceConfig(value);
  const ratio = config.gallery.imageRatio.replace(':', ' / ');
  const cardRatio = config.listings.imageRatio.replace(':', ' / ');
  const px = (valueInPx: number) => `${valueInPx * dimensionScale}px`;
  return {
    '--product-listing-columns-desktop': String(config.listings.desktopColumns),
    '--product-listing-columns-tablet': String(config.listings.tabletColumns),
    '--product-listing-columns-mobile': String(config.listings.mobileColumns),
    '--product-listing-gap': px(config.listings.gapPx),
    '--product-card-image-ratio': cardRatio,
    '--product-card-image-fit': config.listings.imageFit,
    '--product-page-gallery-columns': `${config.productPage.galleryColumns}fr`,
    '--product-page-information-columns': `${config.productPage.informationColumns}fr`,
    '--product-page-purchase-columns': `${config.productPage.purchaseColumns}fr`,
    '--product-page-content-max-width': px(config.productPage.contentMaxWidthPx),
    '--product-page-column-gap': px(config.productPage.columnGapPx),
    '--product-gallery-size': `${config.gallery.sizePercent}%`,
    '--product-gallery-ratio': ratio,
    '--product-gallery-image-fit': config.gallery.imageFit,
    '--product-gallery-thumbnail-size': px(config.gallery.thumbnailSizePx),
    '--product-gallery-thumbnail-gap': px(config.gallery.thumbnailGapPx),
    '--product-variant-select-width': px(config.variants.selectWidthPx),
    '--product-variant-select-height': px(config.variants.selectHeightPx),
    '--product-variant-chip-width': px(config.variants.chipWidthPx),
    '--product-variant-chip-height': px(config.variants.chipHeightPx),
    '--product-variant-chip-font-size': px(config.variants.chipFontSizePx),
    '--product-variant-label-font-size': px(config.variants.labelFontSizePx),
    '--product-variant-label-control-gap': px(
      config.variants.labelControlGapPx
    ),
    '--product-description-max-width': px(config.information.longDescriptionMaxWidthPx),
    '--product-detail-divider-width': px(
      config.secondaryContent.dividerThicknessPx
    ),
    '--product-detail-description-first-column': `${config.secondaryContent.descriptionColumnPercent}fr`,
    '--product-detail-description-second-column': `${100 - config.secondaryContent.descriptionColumnPercent}fr`,
    '--product-detail-specification-first-column': `${config.secondaryContent.specificationFirstColumnPercent}fr`,
    '--product-detail-specification-second-column': `${100 - config.secondaryContent.specificationFirstColumnPercent}fr`,
    '--product-detail-specification-divider-position': `${config.secondaryContent.specificationFirstColumnPercent}%`,
    '--product-cart-width': px(config.cartSidebar.widthPx),
    '--product-cart-line-image-size': px(config.cartSidebar.lineImageSizePx),
    '--product-related-columns-desktop': String(config.relatedProducts.desktopColumns),
    '--product-related-columns-tablet': String(config.relatedProducts.tabletColumns),
    '--product-related-columns-mobile': String(config.relatedProducts.mobileColumns),
    '--product-related-gap': px(config.relatedProducts.gapPx),
    '--product-related-card-width': px(config.relatedProducts.cardWidthPx),
    '--product-related-image-height': px(config.relatedProducts.imageHeightPx),
    '--product-related-text-scale': String(
      config.relatedProducts.textScalePercent / 100
    ),
    '--product-related-section-width': `${config.relatedProducts.sectionWidthPercent}%`,
    '--product-related-section-margin-inline-start':
      config.relatedProducts.sectionAlignment === 'left' ? '0' : 'auto',
    '--product-related-section-margin-inline-end':
      config.relatedProducts.sectionAlignment === 'right' ? '0' : 'auto'
  };
}
