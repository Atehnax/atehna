export const ORDER_DOCUMENT_TEMPLATE_SETTINGS_KEY = 'order-document-templates';

export const ORDER_DOCUMENT_TEMPLATE_TYPES = [
  'order_summary',
  'dobavnica',
  'predracun',
  'invoice'
] as const;

export type OrderDocumentTemplateType = (typeof ORDER_DOCUMENT_TEMPLATE_TYPES)[number];

export const ORDER_DOCUMENT_SECTION_IDS = [
  'document_details',
  'intro',
  'items',
  'totals',
  'notes',
  'closing',
  'signatures'
] as const;

export type OrderDocumentSectionId = (typeof ORDER_DOCUMENT_SECTION_IDS)[number];

export type OrderDocumentTemplateSection = {
  id: OrderDocumentSectionId;
  enabled: boolean;
};

export const ORDER_DOCUMENT_CANVAS_ELEMENT_IDS = [
  'header',
  'logo',
  'company',
  'document_details',
  'title',
  'customer',
  'document_meta',
  'intro',
  'items',
  'totals',
  'notes',
  'closing',
  'signatures',
  'footer'
] as const;

export type OrderDocumentCanvasElementId =
  (typeof ORDER_DOCUMENT_CANVAS_ELEMENT_IDS)[number];

export const ORDER_DOCUMENT_CANVAS_POSITIONING_MODES = ['flow', 'absolute'] as const;
export type OrderDocumentCanvasPositioning =
  (typeof ORDER_DOCUMENT_CANVAS_POSITIONING_MODES)[number];

export const ORDER_DOCUMENT_CANVAS_CONDITIONS = [
  'always',
  'has_items',
  'has_notes',
  'has_shipping',
  'has_tax',
  'has_reference'
] as const;
export type OrderDocumentCanvasCondition =
  (typeof ORDER_DOCUMENT_CANVAS_CONDITIONS)[number];

export const ORDER_DOCUMENT_CANVAS_OVERFLOW_MODES = ['visible', 'clip'] as const;
export type OrderDocumentCanvasOverflow =
  (typeof ORDER_DOCUMENT_CANVAS_OVERFLOW_MODES)[number];

export const ORDER_DOCUMENT_CANVAS_REPEAT_MODES = ['once', 'every_page'] as const;
export type OrderDocumentCanvasRepeat =
  (typeof ORDER_DOCUMENT_CANVAS_REPEAT_MODES)[number];

export const ORDER_DOCUMENT_FONT_FAMILY_IDS = [
  'noto_sans',
  'barlow',
  'inter',
  'ibm_plex_sans',
  'source_sans_3',
  'manrope',
  'space_grotesk',
  'bitter',
  'noto_sans_mono'
] as const;
export type OrderDocumentFontFamilyId =
  (typeof ORDER_DOCUMENT_FONT_FAMILY_IDS)[number];

export const ORDER_DOCUMENT_FONT_WEIGHT_IDS = [
  'regular',
  'medium',
  'semibold',
  'bold'
] as const;
export type OrderDocumentFontWeightId =
  (typeof ORDER_DOCUMENT_FONT_WEIGHT_IDS)[number];

export const ORDER_DOCUMENT_FONT_STYLE_IDS = ['normal', 'italic'] as const;
export type OrderDocumentFontStyleId =
  (typeof ORDER_DOCUMENT_FONT_STYLE_IDS)[number];

export const ORDER_DOCUMENT_FONT_WEIGHT_VALUES: Record<OrderDocumentFontWeightId, number> = {
  regular: 400,
  medium: 500,
  semibold: 600,
  bold: 700
};

export const ORDER_DOCUMENT_FONT_SIZE_MIN_PT = 5;
export const ORDER_DOCUMENT_FONT_SIZE_MAX_PT = 48;
export const ORDER_DOCUMENT_FONT_SIZE_STEP_PT = 0.5;

export type OrderDocumentFontFace = {
  weight: OrderDocumentFontWeightId;
  style: OrderDocumentFontStyleId;
  /** Public, deploy-safe asset path. Every declared face contains Slovene glyphs. */
  assetPath: string;
};

export type OrderDocumentFontFamily = {
  id: OrderDocumentFontFamilyId;
  label: string;
  cssFontFamily: string;
  faces: readonly OrderDocumentFontFace[];
};

const bundledOrderDocumentFaces = (
  assetStem: string,
  options: {
    italic?: boolean;
    weights?: readonly OrderDocumentFontWeightId[];
  } = {}
): OrderDocumentFontFace[] => {
  const styles: readonly OrderDocumentFontStyleId[] = options.italic === false
    ? ['normal']
    : ORDER_DOCUMENT_FONT_STYLE_IDS;
  return (options.weights ?? ORDER_DOCUMENT_FONT_WEIGHT_IDS).flatMap((weight) =>
    styles.map((style) => ({
      weight,
      style,
      assetPath: `/fonts/${assetStem}-${ORDER_DOCUMENT_FONT_WEIGHT_VALUES[weight]}-${style}.ttf`
    }))
  );
};

export const ORDER_DOCUMENT_FONT_FAMILY_CATALOG: readonly OrderDocumentFontFamily[] = [
  {
    id: 'noto_sans',
    label: 'Noto Sans',
    cssFontFamily: '\"Noto Sans\", sans-serif',
    faces: [
      { weight: 'regular', style: 'normal', assetPath: '/fonts/NotoSans-Regular.ttf' },
      { weight: 'bold', style: 'normal', assetPath: '/fonts/NotoSans-Bold.ttf' }
    ]
  },
  {
    id: 'barlow',
    label: 'Barlow',
    cssFontFamily: '\"Barlow\", \"Noto Sans\", sans-serif',
    faces: [
      { weight: 'regular', style: 'normal', assetPath: '/fonts/Barlow-400-normal.ttf' },
      { weight: 'regular', style: 'italic', assetPath: '/fonts/Barlow-400-italic.ttf' },
      { weight: 'medium', style: 'normal', assetPath: '/fonts/Barlow-500-normal.ttf' },
      { weight: 'medium', style: 'italic', assetPath: '/fonts/Barlow-500-italic.ttf' },
      { weight: 'semibold', style: 'normal', assetPath: '/fonts/Barlow-600-normal.ttf' },
      { weight: 'semibold', style: 'italic', assetPath: '/fonts/Barlow-600-italic.ttf' },
      { weight: 'bold', style: 'normal', assetPath: '/fonts/Barlow-700-normal.ttf' },
      { weight: 'bold', style: 'italic', assetPath: '/fonts/Barlow-700-italic.ttf' }
    ]
  },
  {
    id: 'inter',
    label: 'Inter',
    cssFontFamily: '\"Inter Variable\", \"Inter\", \"Noto Sans\", sans-serif',
    faces: bundledOrderDocumentFaces('Inter')
  },
  {
    id: 'ibm_plex_sans',
    label: 'IBM Plex Sans',
    cssFontFamily: '\"IBM Plex Sans Variable\", \"IBM Plex Sans\", \"Noto Sans\", sans-serif',
    faces: bundledOrderDocumentFaces('IBMPlexSans')
  },
  {
    id: 'source_sans_3',
    label: 'Source Sans 3',
    cssFontFamily: '\"Source Sans 3 Variable\", \"Source Sans 3\", \"Noto Sans\", sans-serif',
    faces: bundledOrderDocumentFaces('SourceSans3')
  },
  {
    id: 'manrope',
    label: 'Manrope',
    cssFontFamily: '\"Manrope Variable\", \"Manrope\", \"Noto Sans\", sans-serif',
    faces: bundledOrderDocumentFaces('Manrope', { italic: false })
  },
  {
    id: 'space_grotesk',
    label: 'Space Grotesk',
    cssFontFamily: '\"Space Grotesk Variable\", \"Space Grotesk\", \"Noto Sans\", sans-serif',
    faces: bundledOrderDocumentFaces('SpaceGrotesk', {
      italic: false,
      weights: ['regular', 'medium', 'bold']
    })
  },
  {
    id: 'bitter',
    label: 'Bitter',
    cssFontFamily: '\"Bitter Variable\", \"Bitter\", Georgia, serif',
    faces: bundledOrderDocumentFaces('Bitter')
  },
  {
    id: 'noto_sans_mono',
    label: 'Noto Sans Mono',
    cssFontFamily: '\"Noto Sans Mono\", ui-monospace, monospace',
    faces: bundledOrderDocumentFaces('NotoSansMono', { italic: false })
  }
];

export type OrderDocumentTypographyOverride = {
  /** Missing values inherit from the semantic role or parent canvas element. */
  fontFamily?: OrderDocumentFontFamilyId;
  fontWeight?: OrderDocumentFontWeightId;
  fontStyle?: OrderDocumentFontStyleId;
  fontSizePt?: number;
};

export type OrderDocumentTypography = {
  fontFamily: OrderDocumentFontFamilyId;
  fontWeight: OrderDocumentFontWeightId;
  fontStyle: OrderDocumentFontStyleId;
  fontSizePt: number;
};

export const ORDER_DOCUMENT_TEXT_ALIGNMENTS = [
  'left',
  'center',
  'right',
  'justify'
] as const;
export type OrderDocumentTextAlignment =
  (typeof ORDER_DOCUMENT_TEXT_ALIGNMENTS)[number];

/**
 * `distributed` is a resolved semantic mode, not a stored override. It keeps
 * paired rows (for example a total label and amount) on their established
 * opposite edges. Resetting an explicit alignment returns to this automatic
 * semantic result where appropriate.
 */
export type OrderDocumentResolvedTextAlignment =
  | OrderDocumentTextAlignment
  | 'distributed';

export const ORDER_DOCUMENT_DECORATION_SIDES = [
  'left',
  'right',
  'top',
  'bottom'
] as const;

export type OrderDocumentDecorationSide =
  (typeof ORDER_DOCUMENT_DECORATION_SIDES)[number];

/**
 * Sparse, composable decoration settings. Missing values inherit from the
 * semantic role or parent element; explicit `false` disables inherited ink.
 */
export type OrderDocumentDecorationOverride = {
  fillEnabled?: boolean;
  fillColor?: string;
  outlineEnabled?: boolean;
  outlineColor?: string;
  outlineWidthPt?: number;
  outlineSides?: OrderDocumentDecorationSide[];
  accentEnabled?: boolean;
  accentSide?: OrderDocumentDecorationSide;
  accentColor?: string;
  accentWidthPt?: number;
  /** Extra symmetric inset beyond the permanent boxed-text safety margin. */
  paddingPt?: number;
};

export type OrderDocumentDecoration = {
  fillEnabled: boolean;
  fillColor: string;
  outlineEnabled: boolean;
  outlineColor: string;
  outlineWidthPt: number;
  outlineSides: OrderDocumentDecorationSide[];
  accentEnabled: boolean;
  accentSide: OrderDocumentDecorationSide;
  accentColor: string;
  accentWidthPt: number;
  /** Extra symmetric inset beyond the permanent boxed-text safety margin. */
  paddingPt: number;
};

/**
 * Every visible text box owns this symmetric safety margin. `paddingPt` is an
 * optional extra inset, so an explicit zero never lets glyphs touch box ink.
 */
export const ORDER_DOCUMENT_DECORATED_TEXT_INSET_PT = 3;

export function hasOrderDocumentBoxDecoration(
  decoration: Pick<
    OrderDocumentDecoration,
    'fillEnabled' | 'outlineEnabled' | 'outlineSides'
  >
) {
  return decoration.fillEnabled
    || (decoration.outlineEnabled && decoration.outlineSides.length > 0);
}

export const DEFAULT_ORDER_DOCUMENT_TYPOGRAPHY: OrderDocumentTypography = {
  fontFamily: 'noto_sans',
  fontWeight: 'regular',
  fontStyle: 'normal',
  fontSizePt: 9
};

export type OrderDocumentCanvasElement = {
  id: OrderDocumentCanvasElementId;
  positioning: OrderDocumentCanvasPositioning;
  visible: boolean;
  locked: boolean;
  /** A4 coordinates measured from the page's top-left corner. */
  xMm: number;
  yMm: number;
  widthMm: number;
  heightMm: number;
  page: number;
  zIndex: number;
  /** Empty color values inherit their template-level counterpart. */
  textColor: string;
  mutedTextColor: string;
  backgroundColor: string;
  borderColor: string;
  accentColor: string;
  condition: OrderDocumentCanvasCondition;
  overflow: OrderDocumentCanvasOverflow;
  /** Repetition is intentionally constrained to header and footer elements. */
  repeat: OrderDocumentCanvasRepeat;
  typography?: OrderDocumentTypographyOverride;
  /** Missing preserves the element's semantic/default alignment. */
  textAlign?: OrderDocumentTextAlignment;
  decoration?: OrderDocumentDecorationOverride;
};

export type OrderDocumentTemplateCanvas = {
  /** Version of body-section flow semantics. */
  flowLayoutVersion: number;
  gridSizeMm: number;
  snapToGrid: boolean;
  snapToElements: boolean;
  showGrid: boolean;
  showGuides: boolean;
  showRulers: boolean;
  /**
   * Explicit tombstones for elements removed by the editor. A tombstone is
   * intentionally distinct from `visible: false`: hidden elements retain
   * their complete override, while deleted elements discard it and stay
   * absent until the user restores them.
   */
  deletedElementIds: OrderDocumentCanvasElementId[];
  /** Sparse overrides: untouched elements continue to use legacy flow layout. */
  elements: Partial<Record<OrderDocumentCanvasElementId, OrderDocumentCanvasElement>>;
};

export const ORDER_DOCUMENT_CANVAS_FLOW_LAYOUT_VERSION = 1;

export const DEFAULT_ORDER_DOCUMENT_TEMPLATE_CANVAS: OrderDocumentTemplateCanvas = {
  flowLayoutVersion: ORDER_DOCUMENT_CANVAS_FLOW_LAYOUT_VERSION,
  gridSizeMm: 2.5,
  snapToGrid: true,
  snapToElements: true,
  showGrid: false,
  showGuides: true,
  showRulers: true,
  deletedElementIds: [],
  elements: {}
};

export type OrderDocumentTemplateStyle = {
  pageBackground: string;
  textColor: string;
  mutedTextColor: string;
  lineColor: string;
  accentColor: string;
  tableHeaderBackground: string;
  tableHeaderTextColor: string;
  tableStripeColor: string;
  totalBackground: string;
  marginMm: number;
  headerHeightMm: number;
  logoWidthMm: number;
  titleSizePt: number;
  bodySizePt: number;
  smallSizePt: number;
  tableSizePt: number;
  rowPaddingPt: number;
  lineWidthPt: number;
  titleAlignment: 'left' | 'right';
};

export const ORDER_DOCUMENT_COMPANY_CONTACT_LIMIT = 20;
export const ORDER_DOCUMENT_COMPANY_LEGACY_CONTACT_IDS = [
  'phone',
  'fax',
  'mobile',
  'email',
  'website'
] as const;

export type OrderDocumentCompanyContact = {
  /** Stable editor identity. IDs are unique within one company contact list. */
  id: string;
  label: string;
  value: string;
  visible: boolean;
  emphasis: boolean;
  typography?: OrderDocumentTypographyOverride;
  textAlign?: OrderDocumentTextAlignment;
};

export type OrderDocumentTemplateCompany = {
  logoText: string;
  logoTagline: string;
  name: string;
  addressLine1: string;
  addressLine2: string;
  phone: string;
  fax: string;
  mobile: string;
  email: string;
  website: string;
  contacts: OrderDocumentCompanyContact[];
  bankName: string;
  iban: string;
  swift: string;
  taxId: string;
  registrationText: string;
};

export type OrderDocumentTemplateLabels = {
  customer: string;
  address: string;
  contact: string;
  email: string;
  deliveryAddress: string;
  customerType: string;
  status: string;
  documentNumber: string;
  orderNumber: string;
  issueDate: string;
  orderDate: string;
  reference: string;
  dispatchDate: string;
  dispatchMethod: string;
  purchaseOrderNumber: string;
  purchaseOrderDate: string;
  deliveryNote: string;
  dueDate: string;
  paymentReference: string;
  code: string;
  quantity: string;
  unit: string;
  description: string;
  unitPrice: string;
  lineTotal: string;
  subtotal: string;
  tax: string;
  shipping: string;
  total: string;
  notes: string;
  handedOverBy: string;
  receivedBy: string;
};

export type OrderDocumentTemplateText = {
  title: string;
  subtitle: string;
  intro: string;
  closing: string;
  paymentTerms: string;
  deliveryMethod: string;
  signerName: string;
  footerText: string;
  labels: OrderDocumentTemplateLabels;
};

export const ORDER_DOCUMENT_TABLE_COLUMN_IDS = [
  'sku',
  'quantity',
  'unit',
  'description',
  'unitPrice',
  'lineTotal'
] as const;

export type OrderDocumentTableColumnId =
  (typeof ORDER_DOCUMENT_TABLE_COLUMN_IDS)[number];

export type OrderDocumentTableColumn = {
  id: OrderDocumentTableColumnId;
  visible: boolean;
  widthRatio: number;
  /**
   * Column typography inherited by both its header cell and body cells.
   * Keeping this shared scope preserves templates created before granular
   * header/body/cell controls were introduced.
   */
  typography?: OrderDocumentTypographyOverride;
  /** Shared body/header alignment retained for backwards-compatible column edits. */
  textAlign?: OrderDocumentTextAlignment;
  /** Header-cell-only override, applied after the shared column scope. */
  headerTypography?: OrderDocumentTypographyOverride;
  /** Header-cell-only alignment override. */
  headerTextAlign?: OrderDocumentTextAlignment;
};

export type OrderDocumentTableRowHeightOverride = {
  /** One-based visual row number; it never changes source item order. */
  rowNumber: number;
  /** Missing means this row continues to inherit the global row height. */
  heightPt?: number;
  typography?: OrderDocumentTypographyOverride;
  textAlign?: OrderDocumentTextAlignment;
};

export type OrderDocumentTableCellTypographyOverride = {
  /** One-based visual body-row number; it never changes source item order. */
  rowNumber: number;
  columnId: OrderDocumentTableColumnId;
  typography?: OrderDocumentTypographyOverride;
  textAlign?: OrderDocumentTextAlignment;
};

export type OrderDocumentTableBorders = {
  /** Draw one continuous outline around each rendered table/page segment. */
  outer?: boolean;
  /** Draw rules between the header and body rows, and between body rows. */
  horizontal?: boolean;
  /** Draw rules between visible columns. */
  vertical?: boolean;
  /** Missing values inherit the current template line style. */
  color?: string;
  widthPt?: number;
};

export type ResolvedOrderDocumentTableBorders = {
  outer: boolean;
  horizontal: boolean;
  vertical: boolean;
  color: string;
  widthPt: number;
};

export type OrderDocumentTable = {
  columns: OrderDocumentTableColumn[];
  headerHeightPt: number;
  rowHeightPt: number;
  rowGapPt: number;
  /** Shared typography for the complete column-label/header row. */
  headerTypography?: OrderDocumentTypographyOverride;
  headerTextAlign?: OrderDocumentTextAlignment;
  /** Shared typography for all item/body rows, without affecting the header. */
  bodyTypography?: OrderDocumentTypographyOverride;
  bodyTextAlign?: OrderDocumentTextAlignment;
  /** Sparse opt-in grid settings; absence preserves the legacy borderless table. */
  borders?: OrderDocumentTableBorders;
  rowHeightOverrides: OrderDocumentTableRowHeightOverride[];
  /** Sparse exact-cell overrides; row/column identity is unique. */
  cellTypographyOverrides: OrderDocumentTableCellTypographyOverride[];
};

/** Ordered, presentation-only rows inside semantic PDF elements. */
export const ORDER_DOCUMENT_FIELD_GROUP_IDS = [
  'company',
  'title',
  'customer',
  'document_meta',
  'totals',
  'notes',
  'closing',
  'signatures',
  'footer'
] as const;

export type OrderDocumentFieldGroupId =
  (typeof ORDER_DOCUMENT_FIELD_GROUP_IDS)[number];

export const ORDER_DOCUMENT_FIELD_ROW_IDS_BY_GROUP = {
  company: ['company_name', 'address_line_1', 'address_line_2', 'contacts'],
  title: ['title_text', 'document_number', 'subtitle'],
  customer: ['customer', 'contact', 'address', 'email'],
  document_meta: [
    'document_number',
    'issue_date',
    'order_date',
    'customer_type',
    'status',
    'reference',
    'dispatch_date',
    'dispatch_method',
    'purchase_order_number',
    'purchase_order_date',
    'delivery_note',
    'due_date',
    'payment_reference'
  ],
  totals: ['subtotal', 'shipping', 'tax', 'total'],
  notes: ['notes_label', 'notes_content'],
  closing: ['payment_terms', 'closing_text', 'signer_name'],
  signatures: ['handed_over_by', 'received_by'],
  footer: ['registration_text', 'footer_text', 'page_numbers']
} as const satisfies Record<OrderDocumentFieldGroupId, readonly string[]>;

export type OrderDocumentFieldRowId =
  (typeof ORDER_DOCUMENT_FIELD_ROW_IDS_BY_GROUP)[OrderDocumentFieldGroupId][number];

export type OrderDocumentFieldRow = {
  id: OrderDocumentFieldRowId;
  visible: boolean;
  typography?: OrderDocumentTypographyOverride;
  /** Missing preserves the row's semantic/default alignment. */
  textAlign?: OrderDocumentTextAlignment;
  /** Sparse offsets in millimetres from the owning semantic element's top-left. */
  placement?: OrderDocumentFieldRowPlacement;
  decoration?: OrderDocumentDecorationOverride;
};

export type OrderDocumentFieldRowPlacement = {
  xMm?: number;
  yMm?: number;
  widthMm?: number;
  heightMm?: number;
};

export type OrderDocumentFieldRows = Partial<
  Record<OrderDocumentFieldGroupId, OrderDocumentFieldRow[]>
>;

export type OrderDocumentTemplateColumns = {
  sku: boolean;
  quantity: boolean;
  unit: boolean;
  unitPrice: boolean;
  lineTotal: boolean;
};

export type OrderDocumentTemplateLayout = {
  showHeader: boolean;
  showLogoMark: boolean;
  showFooter: boolean;
  showPageNumbers: boolean;
  showShipping: boolean;
  showTaxSummary: boolean;
  columns: OrderDocumentTemplateColumns;
  sections: OrderDocumentTemplateSection[];
  canvas?: OrderDocumentTemplateCanvas;
  table?: OrderDocumentTable;
  /**
   * Sparse for backwards compatibility. A missing group resolves to its
   * template default; an explicitly stored list (including []) is authoritative.
   */
  fieldRows?: OrderDocumentFieldRows;
};

export type OrderDocumentTemplateRules = {
  dueDays: number;
  validityDays: number;
};

export type OrderDocumentTemplate = {
  type: OrderDocumentTemplateType;
  name: string;
  style: OrderDocumentTemplateStyle;
  company: OrderDocumentTemplateCompany;
  text: OrderDocumentTemplateText;
  layout: OrderDocumentTemplateLayout;
  rules: OrderDocumentTemplateRules;
};

export type OrderDocumentTypographyTarget =
  | {
      kind: 'element';
      elementId: OrderDocumentCanvasElementId;
    }
  | {
      kind: 'field_row';
      group: OrderDocumentFieldGroupId;
      rowId: OrderDocumentFieldRowId;
    }
  | {
      kind: 'company_contact';
      contactId: string;
    }
  | {
      kind: 'table_column';
      columnId: OrderDocumentTableColumnId;
    }
  | {
      kind: 'table_header';
    }
  | {
      kind: 'table_body';
    }
  | {
      kind: 'table_header_cell';
      columnId: OrderDocumentTableColumnId;
    }
  | {
      kind: 'table_row';
      rowNumber: number;
    }
  | {
      kind: 'table_cell';
      rowNumber: number;
      columnId: OrderDocumentTableColumnId;
    };

/** Alignment uses the same stable selection identities and table cascades. */
export type OrderDocumentTextAlignmentTarget = OrderDocumentTypographyTarget;

export type OrderDocumentDecorationTarget =
  | {
      kind: 'element';
      elementId: OrderDocumentCanvasElementId;
    }
  | {
      kind: 'field_row';
      group: OrderDocumentFieldGroupId;
      rowId: OrderDocumentFieldRowId;
    };

export type OrderDocumentTemplatesConfig = {
  templates: Record<OrderDocumentTemplateType, OrderDocumentTemplate>;
  updatedAt?: string | null;
};

const COMMON_COMPANY: OrderDocumentTemplateCompany = {
  logoText: 'ATEHNA',
  logoTagline: 'varčevanje z energijo',
  name: 'ATEHNA d.o.o., izobraževanje, proizvodnja in storitve',
  addressLine1: 'Ajdovska 1',
  addressLine2: '4264 Bohinjska Bistrica',
  phone: '+386 4 57 47 300',
  fax: '+386 4 57 47 305',
  mobile: '+386 41 67 52 68',
  email: 'atehna@siol.net',
  website: 'www.atehna.si',
  contacts: [
    {
      id: 'phone',
      label: 'Tel.',
      value: '+386 4 57 47 300',
      visible: true,
      emphasis: false
    },
    {
      id: 'fax',
      label: 'Fax',
      value: '+386 4 57 47 305',
      visible: true,
      emphasis: false
    },
    {
      id: 'mobile',
      label: 'GSM',
      value: '+386 41 67 52 68',
      visible: true,
      emphasis: false
    },
    {
      id: 'email',
      label: 'E-pošta',
      value: 'atehna@siol.net',
      visible: true,
      emphasis: false
    },
    {
      id: 'website',
      label: '',
      value: 'www.atehna.si',
      visible: true,
      emphasis: true
    }
  ],
  bankName: 'Gorenjska banka d.d. Kranj',
  iban: 'SI56 0700 0000 0027 638',
  swift: 'GORESI2X',
  taxId: 'SI32904789',
  registrationText:
    'Reg. št. 1/05317/00, Temeljno sodišče v Kranju, osnovni kapital: 23.072,00 EUR'
};

const COMMON_LABELS: OrderDocumentTemplateLabels = {
  customer: 'Stranka',
  address: 'Naslov',
  contact: 'Kontakt',
  email: 'E-pošta',
  deliveryAddress: 'Naslov dostave',
  customerType: 'Vrsta naročnika',
  status: 'Status',
  documentNumber: 'Številka dokumenta',
  orderNumber: 'Številka naročila',
  issueDate: 'Datum',
  orderDate: 'Datum naročila',
  reference: 'Referenca naročnika',
  dispatchDate: 'Datum odpreme',
  dispatchMethod: 'Način odpreme',
  purchaseOrderNumber: 'Številka naročilnice',
  purchaseOrderDate: 'Datum naročilnice',
  deliveryNote: 'Dobavnica',
  dueDate: 'Plačilo zapade',
  paymentReference: 'Sklicna številka',
  code: 'SKU',
  quantity: 'Količina',
  unit: 'Enota',
  description: 'Naziv',
  unitPrice: 'Cena/enoto',
  lineTotal: 'Skupna cena',
  subtotal: 'Skupaj brez DDV',
  tax: 'Davek',
  shipping: 'Stroški dostave',
  total: 'ZA PLAČILO EUR',
  notes: 'Opombe',
  handedOverBy: 'Predal',
  receivedBy: 'Prevzel'
};

const COMMON_STYLE: OrderDocumentTemplateStyle = {
  pageBackground: '#FFFFFF',
  textColor: '#151515',
  mutedTextColor: '#2F2F2F',
  lineColor: '#202020',
  accentColor: '#D6A900',
  tableHeaderBackground: '#FFFFFF',
  tableHeaderTextColor: '#151515',
  tableStripeColor: '#FFFFFF',
  totalBackground: '#FFFFFF',
  marginMm: 10,
  headerHeightMm: 22,
  logoWidthMm: 73,
  titleSizePt: 15.5,
  bodySizePt: 8.5,
  smallSizePt: 7,
  tableSizePt: 8,
  rowPaddingPt: 2.5,
  lineWidthPt: 0.5,
  titleAlignment: 'left'
};

const COMMON_LAYOUT: OrderDocumentTemplateLayout = {
  showHeader: true,
  showLogoMark: true,
  showFooter: true,
  showPageNumbers: false,
  showShipping: true,
  showTaxSummary: true,
  columns: {
    sku: true,
    quantity: true,
    unit: true,
    unitPrice: true,
    lineTotal: true
  },
  sections: [
    { id: 'document_details', enabled: true },
    { id: 'intro', enabled: false },
    { id: 'items', enabled: true },
    { id: 'totals', enabled: true },
    { id: 'notes', enabled: true },
    { id: 'closing', enabled: false },
    { id: 'signatures', enabled: false }
  ]
};

const commonText = (): OrderDocumentTemplateText => ({
  title: '',
  subtitle: '',
  intro: '',
  closing: '',
  paymentTerms: '',
  deliveryMethod: 'Po dogovoru',
  signerName: 'Dir. URBAN CESAR, dipl. inž. el. (UN)',
  footerText:
    'ID št. za DDV: {taxId} · TRR {bankName} · SWIFT: {swift} · IBAN: {iban}',
  labels: { ...COMMON_LABELS }
});

const sectionLayout = (
  enabled: Partial<Record<OrderDocumentSectionId, boolean>>,
  order: readonly OrderDocumentSectionId[] = ORDER_DOCUMENT_SECTION_IDS
): OrderDocumentTemplateLayout => ({
  ...COMMON_LAYOUT,
  columns: { ...COMMON_LAYOUT.columns },
  sections: order.map((id) => ({ id, enabled: enabled[id] ?? false }))
});

export const DEFAULT_ORDER_DOCUMENT_TEMPLATES_CONFIG: OrderDocumentTemplatesConfig = {
  templates: {
    order_summary: {
      type: 'order_summary',
      name: 'Potrditev naročila',
      style: {
        ...COMMON_STYLE,
        titleAlignment: 'left'
      },
      company: { ...COMMON_COMPANY },
      text: {
        ...commonText(),
        title: 'POTRDITEV NAROČILA',
        subtitle: 'Dokument potrjuje prejem naročila in ni račun.',
        intro:
          'Hvala za vaše naročilo. Potrjujemo, da smo ga prejeli in ga bomo obdelali v najkrajšem možnem času.',
        closing:
          'O odpremi oziroma morebitnih spremembah vas bomo obvestili po e-pošti.',
        signerName: '',
        labels: {
          ...COMMON_LABELS,
          documentNumber: 'Številka potrditve',
          total: 'VREDNOST NAROČILA EUR'
        }
      },
      layout: sectionLayout({
        document_details: true,
        intro: true,
        items: true,
        totals: true,
        notes: true,
        closing: true
      }),
      rules: { dueDays: 0, validityDays: 0 }
    },
    dobavnica: {
      type: 'dobavnica',
      name: 'Dobavnica',
      style: {
        ...COMMON_STYLE,
        titleAlignment: 'left'
      },
      company: { ...COMMON_COMPANY },
      text: {
        ...commonText(),
        title: 'DOBAVNICA',
        subtitle: '',
        labels: {
          ...COMMON_LABELS,
          documentNumber: 'Številka dobavnice',
          subtotal: 'Skupaj',
          total: 'SKUPAJ EUR'
        }
      },
      layout: sectionLayout({
        document_details: true,
        items: true,
        totals: true,
        notes: true,
        signatures: true
      }),
      rules: { dueDays: 0, validityDays: 0 }
    },
    predracun: {
      type: 'predracun',
      name: 'Predračun',
      style: {
        ...COMMON_STYLE,
        titleAlignment: 'left'
      },
      company: { ...COMMON_COMPANY },
      text: {
        ...commonText(),
        title: 'PREDRAČUN',
        subtitle: '',
        paymentTerms:
          'Predračun velja {validityDays} dni. Plačilo na transakcijski račun {iban}.',
        labels: {
          ...COMMON_LABELS,
          documentNumber: 'Številka predračuna',
          dueDate: 'Velja do',
          subtotal: 'Skupaj',
          total: 'ZA PLAČILO EUR'
        }
      },
      layout: sectionLayout({
        document_details: true,
        items: true,
        totals: true,
        notes: true,
        closing: true
      }),
      rules: { dueDays: 0, validityDays: 15 }
    },
    invoice: {
      type: 'invoice',
      name: 'Račun',
      style: {
        ...COMMON_STYLE,
        titleAlignment: 'right'
      },
      company: { ...COMMON_COMPANY },
      text: {
        ...commonText(),
        title: 'RAČUN',
        subtitle: '',
        paymentTerms: 'Prosimo, poravnajte račun na {iban} s sklicem {reference}.',
        labels: {
          ...COMMON_LABELS,
          documentNumber: 'Številka računa',
          subtotal: 'Osnova za DDV',
          total: 'ZA PLAČILO EUR'
        }
      },
      layout: sectionLayout({
        document_details: true,
        items: true,
        totals: true,
        notes: true,
        closing: true
      }),
      rules: { dueDays: 30, validityDays: 0 }
    }
  },
  updatedAt: null
};

type UnknownRecord = Record<string, unknown>;

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const asRecord = (value: unknown): UnknownRecord =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as UnknownRecord)
    : {};
const asString = (value: unknown, fallback: string, maxLength = 2000) => {
  if (typeof value !== 'string') return fallback;
  return value.trim().slice(0, maxLength);
};
const asBoolean = (value: unknown, fallback: boolean) =>
  typeof value === 'boolean' ? value : fallback;
const asNumber = (value: unknown, fallback: number, min: number, max: number, step = 1) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  const stepped = Math.round(parsed / step) * step;
  const clamped = Math.min(max, Math.max(min, stepped));
  const precision = String(step).split('.')[1]?.length ?? 0;
  return Number(clamped.toFixed(precision));
};
const asColor = (value: unknown, fallback: string) => {
  if (typeof value !== 'string') return fallback;
  const normalized = value.trim().toUpperCase();
  return /^#[0-9A-F]{6}$/u.test(normalized) ? normalized : fallback;
};

const asOptionalColor = (value: unknown, fallback: string) => {
  if (typeof value === 'string' && value.trim() === '') return '';
  return asColor(value, fallback);
};
const asEnum = <Value extends string>(
  value: unknown,
  allowed: readonly Value[],
  fallback: Value
) => allowed.includes(value as Value) ? value as Value : fallback;

export function normalizeOrderDocumentTypographyOverride(
  value: unknown
): OrderDocumentTypographyOverride | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const record = asRecord(value);
  const typography: OrderDocumentTypographyOverride = {};
  if (ORDER_DOCUMENT_FONT_FAMILY_IDS.includes(record.fontFamily as OrderDocumentFontFamilyId)) {
    typography.fontFamily = record.fontFamily as OrderDocumentFontFamilyId;
  }
  if (ORDER_DOCUMENT_FONT_WEIGHT_IDS.includes(record.fontWeight as OrderDocumentFontWeightId)) {
    typography.fontWeight = record.fontWeight as OrderDocumentFontWeightId;
  }
  if (ORDER_DOCUMENT_FONT_STYLE_IDS.includes(record.fontStyle as OrderDocumentFontStyleId)) {
    typography.fontStyle = record.fontStyle as OrderDocumentFontStyleId;
  }
  if (Number.isFinite(Number(record.fontSizePt))) {
    typography.fontSizePt = asNumber(
      record.fontSizePt,
      DEFAULT_ORDER_DOCUMENT_TYPOGRAPHY.fontSizePt,
      ORDER_DOCUMENT_FONT_SIZE_MIN_PT,
      ORDER_DOCUMENT_FONT_SIZE_MAX_PT,
      ORDER_DOCUMENT_FONT_SIZE_STEP_PT
    );
  }
  return Object.keys(typography).length > 0 ? typography : undefined;
}

export function normalizeOrderDocumentTextAlignment(
  value: unknown
): OrderDocumentTextAlignment | undefined {
  return ORDER_DOCUMENT_TEXT_ALIGNMENTS.includes(value as OrderDocumentTextAlignment)
    ? value as OrderDocumentTextAlignment
    : undefined;
}

export function normalizeOrderDocumentDecorationOverride(
  value: unknown
): OrderDocumentDecorationOverride | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const record = asRecord(value);
  const decoration: OrderDocumentDecorationOverride = {};
  const owns = (key: string) => Object.prototype.hasOwnProperty.call(record, key);
  for (const key of [
    'fillEnabled',
    'outlineEnabled',
    'accentEnabled'
  ] as const) {
    if (owns(key) && typeof record[key] === 'boolean') decoration[key] = record[key];
  }
  for (const key of ['fillColor', 'outlineColor', 'accentColor'] as const) {
    if (!owns(key) || typeof record[key] !== 'string') continue;
    const normalized = record[key].trim().toUpperCase();
    if (/^#[0-9A-F]{6}$/u.test(normalized)) decoration[key] = normalized;
  }
  if (owns('outlineWidthPt') && Number.isFinite(Number(record.outlineWidthPt))) {
    decoration.outlineWidthPt = asNumber(record.outlineWidthPt, 0.65, 0.25, 12, 0.25);
  }
  if (owns('accentWidthPt') && Number.isFinite(Number(record.accentWidthPt))) {
    decoration.accentWidthPt = asNumber(record.accentWidthPt, 3, 0.25, 24, 0.25);
  }
  if (owns('paddingPt') && Number.isFinite(Number(record.paddingPt))) {
    decoration.paddingPt = asNumber(record.paddingPt, 0, 0, 36, 0.5);
  }
  if (
    owns('accentSide')
    && ORDER_DOCUMENT_DECORATION_SIDES.includes(record.accentSide as OrderDocumentDecorationSide)
  ) {
    decoration.accentSide = record.accentSide as OrderDocumentDecorationSide;
  }
  if (owns('outlineSides') && Array.isArray(record.outlineSides)) {
    decoration.outlineSides = [...new Set(record.outlineSides.filter(
      (side): side is OrderDocumentDecorationSide =>
        ORDER_DOCUMENT_DECORATION_SIDES.includes(side as OrderDocumentDecorationSide)
    ))];
  }
  return Object.keys(decoration).length > 0 ? decoration : undefined;
}

export function normalizeOrderDocumentFieldRowPlacement(
  value: unknown
): OrderDocumentFieldRowPlacement | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const record = asRecord(value);
  const placement: OrderDocumentFieldRowPlacement = {};
  const limits = {
    // Row coordinates are relative to their owner element. A row may be
    // dragged outside that owner while remaining safely inside the A4 page,
    // so signed relative offsets are valid and must survive persistence.
    xMm: [-A4_WIDTH_MM, A4_WIDTH_MM] as const,
    yMm: [-A4_HEIGHT_MM, A4_HEIGHT_MM] as const,
    widthMm: [2, A4_WIDTH_MM] as const,
    heightMm: [2, A4_HEIGHT_MM] as const
  };
  for (const key of ['xMm', 'yMm', 'widthMm', 'heightMm'] as const) {
    if (!Object.prototype.hasOwnProperty.call(record, key)) continue;
    if (!Number.isFinite(Number(record[key]))) continue;
    placement[key] = asNumber(record[key], limits[key][0], limits[key][0], limits[key][1], 0.1);
  }
  return Object.keys(placement).length > 0 ? placement : undefined;
}

export function isOrderDocumentFontFaceSupported(
  fontFamily: OrderDocumentFontFamilyId,
  fontWeight: OrderDocumentFontWeightId,
  fontStyle: OrderDocumentFontStyleId
) {
  return ORDER_DOCUMENT_FONT_FAMILY_CATALOG
    .find((family) => family.id === fontFamily)
    ?.faces.some((face) => face.weight === fontWeight && face.style === fontStyle) ?? false;
}

/** Resolves the closest bundled face without silently changing font family. */
export function resolveSupportedOrderDocumentTypography(
  value: OrderDocumentTypography
): OrderDocumentTypography {
  const fontSizePt = asNumber(
    value.fontSizePt,
    DEFAULT_ORDER_DOCUMENT_TYPOGRAPHY.fontSizePt,
    ORDER_DOCUMENT_FONT_SIZE_MIN_PT,
    ORDER_DOCUMENT_FONT_SIZE_MAX_PT,
    ORDER_DOCUMENT_FONT_SIZE_STEP_PT
  );
  if (isOrderDocumentFontFaceSupported(value.fontFamily, value.fontWeight, value.fontStyle)) {
    return { ...value, fontSizePt };
  }
  const family = ORDER_DOCUMENT_FONT_FAMILY_CATALOG.find(
    (candidate) => candidate.id === value.fontFamily
  );
  if (family) {
    const targetWeight = ORDER_DOCUMENT_FONT_WEIGHT_VALUES[value.fontWeight];
    const nearestFace = [...family.faces].sort((left, right) => {
      const leftStyleDistance = left.style === value.fontStyle ? 0 : 1;
      const rightStyleDistance = right.style === value.fontStyle ? 0 : 1;
      const leftWeight = ORDER_DOCUMENT_FONT_WEIGHT_VALUES[left.weight];
      const rightWeight = ORDER_DOCUMENT_FONT_WEIGHT_VALUES[right.weight];
      return leftStyleDistance - rightStyleDistance
        || Math.abs(leftWeight - targetWeight) - Math.abs(rightWeight - targetWeight)
        || rightWeight - leftWeight;
    })[0];
    if (nearestFace) {
      return {
        fontFamily: family.id,
        fontWeight: nearestFace.weight,
        fontStyle: nearestFace.style,
        fontSizePt
      };
    }
  }
  return {
    ...DEFAULT_ORDER_DOCUMENT_TYPOGRAPHY,
    fontWeight: value.fontWeight === 'bold' || value.fontWeight === 'semibold'
      ? 'bold'
      : 'regular',
    fontSizePt
  };
}

const A4_WIDTH_MM = 210;
const A4_HEIGHT_MM = 297;

const DEFAULT_CANVAS_BOXES: Record<
  OrderDocumentCanvasElementId,
  { yMm: number; heightMm: number; zIndex: number }
> = {
  header: { yMm: 10, heightMm: 22, zIndex: 0 },
  logo: { yMm: 10, heightMm: 22, zIndex: 2 },
  company: { yMm: 10, heightMm: 22, zIndex: 2 },
  document_details: { yMm: 50, heightMm: 45, zIndex: 10 },
  title: { yMm: 50, heightMm: 15, zIndex: 12 },
  customer: { yMm: 67, heightMm: 28, zIndex: 12 },
  document_meta: { yMm: 67, heightMm: 28, zIndex: 12 },
  intro: { yMm: 98, heightMm: 18, zIndex: 20 },
  items: { yMm: 119, heightMm: 80, zIndex: 30 },
  totals: { yMm: 202, heightMm: 28, zIndex: 40 },
  notes: { yMm: 233, heightMm: 14, zIndex: 50 },
  closing: { yMm: 250, heightMm: 16, zIndex: 60 },
  signatures: { yMm: 250, heightMm: 16, zIndex: 70 },
  footer: { yMm: 276, heightMm: 12, zIndex: 90 }
};

const LEGACY_CANONICAL_ABSOLUTE_BODY_BOXES: Partial<Record<
  OrderDocumentCanvasElementId,
  { yMm: number; heightMm: number; zIndex: number }
>> = {
  intro: { yMm: 90, heightMm: 7.5, zIndex: 20 },
  items: { yMm: 102.5, heightMm: 80, zIndex: 30 },
  totals: { yMm: 177.5, heightMm: 28, zIndex: 40 },
  notes: { yMm: 230, heightMm: 14, zIndex: 50 },
  closing: { yMm: 207.5, heightMm: 16, zIndex: 60 },
  signatures: { yMm: 247.5, heightMm: 16, zIndex: 70 }
};

function isLegacyCanonicalAbsoluteBodyElement(
  element: OrderDocumentCanvasElement,
  style: OrderDocumentTemplateStyle
) {
  const legacy = LEGACY_CANONICAL_ABSOLUTE_BODY_BOXES[element.id];
  if (!legacy || element.positioning !== 'absolute') return false;
  const close = (left: number, right: number) => Math.abs(left - right) < 0.05;
  return element.page === 1
    && element.repeat === 'once'
    && close(element.xMm, style.marginMm)
    && close(element.widthMm, A4_WIDTH_MM - style.marginMm * 2)
    && close(element.yMm, legacy.yMm)
    && close(element.heightMm, legacy.heightMm)
    && close(element.zIndex, legacy.zIndex);
}

function legacyCanvasElementVisible(
  layout: OrderDocumentTemplateLayout,
  id: OrderDocumentCanvasElementId
) {
  if (id === 'header' || id === 'company') return layout.showHeader;
  if (id === 'logo') return layout.showHeader && layout.showLogoMark;
  if (id === 'footer') return layout.showFooter;
  const sectionId = (
    id === 'title' || id === 'customer' || id === 'document_meta'
      ? 'document_details'
      : id
  ) as OrderDocumentSectionId;
  return layout.sections.find((section) => section.id === sectionId)?.enabled ?? true;
}

function restoreLegacyCanvasElementVisibility(
  template: OrderDocumentTemplate,
  id: OrderDocumentCanvasElementId
): OrderDocumentTemplate {
  if (id === 'header') {
    return { ...template, layout: { ...template.layout, showHeader: true } };
  }
  if (id === 'logo') {
    return { ...template, layout: { ...template.layout, showLogoMark: true } };
  }
  if (id === 'footer') {
    return { ...template, layout: { ...template.layout, showFooter: true } };
  }
  if (id === 'company' || id === 'title' || id === 'customer' || id === 'document_meta') {
    return template;
  }
  const sectionId = id as OrderDocumentSectionId;
  return {
    ...template,
    layout: {
      ...template.layout,
      sections: template.layout.sections.map((section) =>
        section.id === sectionId ? { ...section, enabled: true } : section
      )
    }
  };
}

function createDefaultCanvasElement(
  id: OrderDocumentCanvasElementId,
  style: OrderDocumentTemplateStyle,
  layout: OrderDocumentTemplateLayout
): OrderDocumentCanvasElement {
  const marginMm = style.marginMm;
  const box = DEFAULT_CANVAS_BOXES[id];
  const isHeaderChild = id === 'logo' || id === 'company';
  const xMm = id === 'company'
    ? Math.min(A4_WIDTH_MM - marginMm - 5, marginMm + style.logoWidthMm + 6)
    : id === 'document_meta'
      ? marginMm + (A4_WIDTH_MM - marginMm * 2) * 0.6
      : marginMm;
  const widthMm = id === 'logo'
    ? Math.min(style.logoWidthMm, A4_WIDTH_MM - marginMm * 2)
    : id === 'company'
      ? A4_WIDTH_MM - marginMm - xMm
      : id === 'title'
        ? (A4_WIDTH_MM - marginMm * 2) * 0.55
        : id === 'customer'
          ? (A4_WIDTH_MM - marginMm * 2) * 0.54
          : id === 'document_meta'
            ? (A4_WIDTH_MM - marginMm * 2) * 0.4
            : A4_WIDTH_MM - marginMm * 2;
  return {
    id,
    positioning: 'flow',
    visible: legacyCanvasElementVisible(layout, id),
    locked: id === 'header' || id === 'document_details',
    xMm,
    yMm: box.yMm,
    widthMm,
    heightMm: isHeaderChild ? style.headerHeightMm : box.heightMm,
    page: 1,
    zIndex: box.zIndex,
    textColor: '',
    mutedTextColor: '',
    backgroundColor: '',
    borderColor: '',
    accentColor: '',
    condition: 'always',
    overflow: 'visible',
    repeat: id === 'header' || isHeaderChild || id === 'footer' ? 'every_page' : 'once'
  };
}

function normalizeCanvasElement(
  id: OrderDocumentCanvasElementId,
  value: unknown,
  fallback: OrderDocumentCanvasElement
): OrderDocumentCanvasElement {
  const record = asRecord(value);
  const xMm = asNumber(record.xMm, fallback.xMm, 0, A4_WIDTH_MM - 5, 0.1);
  const yMm = asNumber(record.yMm, fallback.yMm, 0, A4_HEIGHT_MM - 5, 0.1);
  const repeat = asEnum(record.repeat, ORDER_DOCUMENT_CANVAS_REPEAT_MODES, fallback.repeat);
  const mayRepeat = id === 'header' || id === 'logo' || id === 'company' || id === 'footer';
  const typography = normalizeOrderDocumentTypographyOverride(record.typography);
  const textAlign = normalizeOrderDocumentTextAlignment(record.textAlign);
  const decoration = normalizeOrderDocumentDecorationOverride(record.decoration);
  return {
    id,
    positioning: asEnum(record.positioning, ORDER_DOCUMENT_CANVAS_POSITIONING_MODES, fallback.positioning),
    visible: asBoolean(record.visible, fallback.visible),
    locked: asBoolean(record.locked, fallback.locked),
    xMm,
    yMm,
    widthMm: asNumber(record.widthMm, fallback.widthMm, 5, A4_WIDTH_MM - xMm, 0.1),
    heightMm: asNumber(record.heightMm, fallback.heightMm, 5, A4_HEIGHT_MM - yMm, 0.1),
    page: asNumber(record.page, fallback.page, 1, 50),
    zIndex: asNumber(record.zIndex, fallback.zIndex, -100, 1000),
    textColor: asOptionalColor(record.textColor, fallback.textColor),
    mutedTextColor: asOptionalColor(record.mutedTextColor, fallback.mutedTextColor),
    backgroundColor: asOptionalColor(record.backgroundColor, fallback.backgroundColor),
    borderColor: asOptionalColor(record.borderColor, fallback.borderColor),
    accentColor: asOptionalColor(record.accentColor, fallback.accentColor),
    condition: asEnum(record.condition, ORDER_DOCUMENT_CANVAS_CONDITIONS, fallback.condition),
    overflow: asEnum(record.overflow, ORDER_DOCUMENT_CANVAS_OVERFLOW_MODES, fallback.overflow),
    repeat: mayRepeat ? repeat : 'once',
    ...(typography ? { typography } : {}),
    ...(textAlign ? { textAlign } : {}),
    ...(decoration ? { decoration } : {})
  };
}

export function isOrderDocumentTemplateType(value: unknown): value is OrderDocumentTemplateType {
  return ORDER_DOCUMENT_TEMPLATE_TYPES.includes(value as OrderDocumentTemplateType);
}

type OrderDocumentCompanyStringKey = Exclude<
  keyof OrderDocumentTemplateCompany,
  'contacts'
>;

const ORDER_DOCUMENT_COMPANY_STRING_KEYS: readonly OrderDocumentCompanyStringKey[] = [
  'logoText',
  'logoTagline',
  'name',
  'addressLine1',
  'addressLine2',
  'phone',
  'fax',
  'mobile',
  'email',
  'website',
  'bankName',
  'iban',
  'swift',
  'taxId',
  'registrationText'
];

const CONTACT_ID_PATTERN = /^[a-z0-9][a-z0-9_-]{0,39}$/u;

function createLegacyOrderDocumentCompanyContacts(
  company: Pick<
    OrderDocumentTemplateCompany,
    'phone' | 'fax' | 'mobile' | 'email' | 'website'
  >
): OrderDocumentCompanyContact[] {
  return [
    { id: 'phone', label: 'Tel.', value: company.phone, visible: true, emphasis: false },
    { id: 'fax', label: 'Fax', value: company.fax, visible: true, emphasis: false },
    { id: 'mobile', label: 'GSM', value: company.mobile, visible: true, emphasis: false },
    { id: 'email', label: 'E-pošta', value: company.email, visible: true, emphasis: false },
    { id: 'website', label: '', value: company.website, visible: true, emphasis: true }
  ];
}

export function createOrderDocumentCompanyContactId(
  contacts: ReadonlyArray<Pick<OrderDocumentCompanyContact, 'id'>>,
  preferredId = 'contact'
) {
  const base = preferredId
    .trim()
    .toLocaleLowerCase('en-US')
    .replace(/[^a-z0-9_-]+/gu, '-')
    .replace(/^-+|-+$/gu, '')
    .slice(0, 32);
  const safeBase = CONTACT_ID_PATTERN.test(base) ? base : 'contact';
  const existing = new Set(contacts.map((contact) => contact.id));
  if (!existing.has(safeBase)) return safeBase;
  for (let suffix = 2; suffix <= ORDER_DOCUMENT_COMPANY_CONTACT_LIMIT + 1; suffix += 1) {
    const candidate = safeBase.slice(0, 39 - String(suffix).length) + '-' + suffix;
    if (!existing.has(candidate)) return candidate;
  }
  return 'contact-' + Date.now().toString(36).slice(-8);
}

function normalizeOrderDocumentCompanyContacts(
  value: unknown,
  legacy: Pick<
    OrderDocumentTemplateCompany,
    'phone' | 'fax' | 'mobile' | 'email' | 'website'
  >
): OrderDocumentCompanyContact[] {
  if (!Array.isArray(value)) return createLegacyOrderDocumentCompanyContacts(legacy);
  const contacts: OrderDocumentCompanyContact[] = [];
  for (const [index, rawContact] of value
    .slice(0, ORDER_DOCUMENT_COMPANY_CONTACT_LIMIT)
    .entries()) {
    const contact = asRecord(rawContact);
    const requestedId = asString(contact.id, '', 40).toLocaleLowerCase('en-US');
    const id = CONTACT_ID_PATTERN.test(requestedId)
      && !contacts.some((candidate) => candidate.id === requestedId)
      ? requestedId
      : createOrderDocumentCompanyContactId(
          contacts,
          requestedId || 'contact-' + (index + 1)
        );
    contacts.push({
      id,
      label: asString(contact.label, '', 80),
      value: asString(contact.value, '', 300),
      visible: asBoolean(contact.visible, true),
      emphasis: asBoolean(contact.emphasis, requestedId === 'website'),
      ...(normalizeOrderDocumentTypographyOverride(contact.typography)
        ? { typography: normalizeOrderDocumentTypographyOverride(contact.typography) }
        : {}),
      ...(normalizeOrderDocumentTextAlignment(contact.textAlign)
        ? { textAlign: normalizeOrderDocumentTextAlignment(contact.textAlign) }
        : {})
    });
  }
  return contacts;
}

function legacyCompanyValuesFromContacts(
  contacts: readonly OrderDocumentCompanyContact[]
): Pick<OrderDocumentTemplateCompany, 'phone' | 'fax' | 'mobile' | 'email' | 'website'> {
  const visibleValue = (id: (typeof ORDER_DOCUMENT_COMPANY_LEGACY_CONTACT_IDS)[number]) => {
    const contact = contacts.find((candidate) => candidate.id === id);
    return contact?.visible ? contact.value : '';
  };
  return {
    phone: visibleValue('phone'),
    fax: visibleValue('fax'),
    mobile: visibleValue('mobile'),
    email: visibleValue('email'),
    website: visibleValue('website')
  };
}

function normalizeCompany(
  value: unknown,
  fallback: OrderDocumentTemplateCompany
): OrderDocumentTemplateCompany {
  const record = asRecord(value);
  const normalizedStrings = Object.fromEntries(
    ORDER_DOCUMENT_COMPANY_STRING_KEYS.map((key) => [
      key,
      asString(record[key], fallback[key], key === 'registrationText' ? 1000 : 300)
    ])
  ) as Omit<OrderDocumentTemplateCompany, 'contacts'>;
  const hasExplicitContacts = Array.isArray(record.contacts);
  const contacts = normalizeOrderDocumentCompanyContacts(
    record.contacts,
    normalizedStrings
  );
  return {
    ...normalizedStrings,
    ...(hasExplicitContacts ? legacyCompanyValuesFromContacts(contacts) : {}),
    contacts
  };
}

export function resolveOrderDocumentCompanyContacts(
  template: Pick<OrderDocumentTemplate, 'company'>
): OrderDocumentCompanyContact[] {
  const company = template.company;
  return clone(normalizeOrderDocumentCompanyContacts(
    asRecord(company).contacts,
    company
  ));
}

export function setOrderDocumentCompanyContacts(
  template: OrderDocumentTemplate,
  value: readonly OrderDocumentCompanyContact[]
): OrderDocumentTemplate {
  const contacts = normalizeOrderDocumentCompanyContacts(value, template.company);
  return {
    ...template,
    company: {
      ...template.company,
      ...legacyCompanyValuesFromContacts(contacts),
      contacts: clone(contacts)
    }
  };
}

function normalizeLabels(value: unknown, fallback: OrderDocumentTemplateLabels) {
  const record = asRecord(value);
  return Object.fromEntries(
    Object.entries(fallback).map(([key, defaultValue]) => {
      const normalized = asString(record[key], defaultValue, 100);
      const matchesCanonicalLabel = normalized.localeCompare(defaultValue, 'sl-SI', {
        sensitivity: 'base'
      }) === 0;
      const isLegacyCodeLabel = key === 'code' && /^šifra(?: artikla)?$/iu.test(normalized);
      return [key, matchesCanonicalLabel || isLegacyCodeLabel ? defaultValue : normalized];
    })
  ) as OrderDocumentTemplateLabels;
}

function normalizeStyle(value: unknown, fallback: OrderDocumentTemplateStyle): OrderDocumentTemplateStyle {
  const record = asRecord(value);
  return {
    pageBackground: asColor(record.pageBackground, fallback.pageBackground),
    textColor: asColor(record.textColor, fallback.textColor),
    mutedTextColor: asColor(record.mutedTextColor, fallback.mutedTextColor),
    lineColor: asColor(record.lineColor, fallback.lineColor),
    accentColor: asColor(record.accentColor, fallback.accentColor),
    tableHeaderBackground: asColor(record.tableHeaderBackground, fallback.tableHeaderBackground),
    tableHeaderTextColor: asColor(record.tableHeaderTextColor, fallback.tableHeaderTextColor),
    tableStripeColor: asColor(record.tableStripeColor, fallback.tableStripeColor),
    totalBackground: asColor(record.totalBackground, fallback.totalBackground),
    marginMm: asNumber(record.marginMm, fallback.marginMm, 10, 30, 0.5),
    headerHeightMm: asNumber(record.headerHeightMm, fallback.headerHeightMm, 18, 48, 0.5),
    logoWidthMm: asNumber(record.logoWidthMm, fallback.logoWidthMm, 50, 95, 0.5),
    titleSizePt: asNumber(record.titleSizePt, fallback.titleSizePt, 14, 30, 0.5),
    bodySizePt: asNumber(record.bodySizePt, fallback.bodySizePt, 7, 13, 0.5),
    smallSizePt: asNumber(record.smallSizePt, fallback.smallSizePt, 6, 11, 0.5),
    tableSizePt: asNumber(record.tableSizePt, fallback.tableSizePt, 6.5, 11, 0.5),
    rowPaddingPt: asNumber(record.rowPaddingPt, fallback.rowPaddingPt, 2, 10, 0.5),
    lineWidthPt: asNumber(record.lineWidthPt, fallback.lineWidthPt, 0.25, 2, 0.25),
    titleAlignment: record.titleAlignment === 'left' || record.titleAlignment === 'right'
      ? record.titleAlignment
      : fallback.titleAlignment
  };
}

function normalizeText(value: unknown, fallback: OrderDocumentTemplateText): OrderDocumentTemplateText {
  const record = asRecord(value);
  return {
    title: asString(record.title, fallback.title, 120),
    subtitle: asString(record.subtitle, fallback.subtitle, 1000),
    intro: asString(record.intro, fallback.intro, 2000),
    closing: asString(record.closing, fallback.closing, 2000),
    paymentTerms: asString(record.paymentTerms, fallback.paymentTerms, 1000),
    deliveryMethod: asString(record.deliveryMethod, fallback.deliveryMethod, 200),
    signerName: asString(record.signerName, fallback.signerName, 300),
    footerText: asString(record.footerText, fallback.footerText, 1500),
    labels: normalizeLabels(record.labels, fallback.labels)
  };
}

function normalizeSections(
  value: unknown,
  fallback: OrderDocumentTemplateSection[]
): OrderDocumentTemplateSection[] {
  if (!Array.isArray(value)) return clone(fallback);

  const normalized: OrderDocumentTemplateSection[] = [];
  const seen = new Set<OrderDocumentSectionId>();
  for (const rawSection of value) {
    const record = asRecord(rawSection);
    const id = record.id;
    if (!ORDER_DOCUMENT_SECTION_IDS.includes(id as OrderDocumentSectionId)) continue;
    const sectionId = id as OrderDocumentSectionId;
    if (seen.has(sectionId)) continue;
    const fallbackSection = fallback.find((section) => section.id === sectionId);
    normalized.push({
      id: sectionId,
      enabled: asBoolean(record.enabled, fallbackSection?.enabled ?? false)
    });
    seen.add(sectionId);
  }

  for (const fallbackSection of fallback) {
    if (!seen.has(fallbackSection.id)) normalized.push(clone(fallbackSection));
  }
  return normalized;
}

function normalizeCanvas(
  value: unknown,
  style: OrderDocumentTemplateStyle,
  layout: OrderDocumentTemplateLayout
): OrderDocumentTemplateCanvas | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const record = asRecord(value);
  const sourceFlowLayoutVersion = record.flowLayoutVersion === ORDER_DOCUMENT_CANVAS_FLOW_LAYOUT_VERSION
    ? ORDER_DOCUMENT_CANVAS_FLOW_LAYOUT_VERSION
    : 0;
  const source = asRecord(record.elements);
  const deletedElementIds = Array.isArray(record.deletedElementIds)
    ? [...new Set(record.deletedElementIds.filter(
        (id): id is OrderDocumentCanvasElementId =>
          ORDER_DOCUMENT_CANVAS_ELEMENT_IDS.includes(id as OrderDocumentCanvasElementId)
      ))]
    : [];
  const deleted = new Set(deletedElementIds);
  const elements: OrderDocumentTemplateCanvas['elements'] = {};
  for (const id of ORDER_DOCUMENT_CANVAS_ELEMENT_IDS) {
    // A tombstone is authoritative. Discarding a stale override is what makes
    // delete semantically different from hiding and prevents default elements
    // from silently reappearing after a storage round-trip.
    if (deleted.has(id)) continue;
    if (!Object.prototype.hasOwnProperty.call(source, id)) continue;
    const fallback = createDefaultCanvasElement(id, style, layout);
    let normalized = normalizeCanvasElement(
      id,
      source[id],
      fallback
    );
    if (
      sourceFlowLayoutVersion < ORDER_DOCUMENT_CANVAS_FLOW_LAYOUT_VERSION
      && isLegacyCanonicalAbsoluteBodyElement(normalized, style)
    ) {
      normalized = { ...normalized, positioning: 'flow' };
    }
    const legacyGeometry = id === 'title'
      ? { yMm: 50, heightMm: 10 }
      : id === 'customer' || id === 'document_meta'
        ? { yMm: 64, heightMm: 28 }
        : null;
    const untouchedLegacyGeometry = legacyGeometry
      && normalized.positioning === 'flow'
      && normalized.page === 1
      && Math.abs(normalized.xMm - fallback.xMm) < 0.05
      && Math.abs(normalized.widthMm - fallback.widthMm) < 0.05
      && Math.abs(normalized.yMm - legacyGeometry.yMm) < 0.05
      && Math.abs(normalized.heightMm - legacyGeometry.heightMm) < 0.05;
    elements[id] = untouchedLegacyGeometry
      ? {
          ...normalized,
          yMm: fallback.yMm,
          heightMm: fallback.heightMm
        }
      : normalized;
  }
  return {
    flowLayoutVersion: ORDER_DOCUMENT_CANVAS_FLOW_LAYOUT_VERSION,
    gridSizeMm: asNumber(
      record.gridSizeMm,
      DEFAULT_ORDER_DOCUMENT_TEMPLATE_CANVAS.gridSizeMm,
      0.5,
      20,
      0.5
    ),
    snapToGrid: asBoolean(record.snapToGrid, DEFAULT_ORDER_DOCUMENT_TEMPLATE_CANVAS.snapToGrid),
    snapToElements: asBoolean(record.snapToElements, DEFAULT_ORDER_DOCUMENT_TEMPLATE_CANVAS.snapToElements),
    showGrid: asBoolean(record.showGrid, DEFAULT_ORDER_DOCUMENT_TEMPLATE_CANVAS.showGrid),
    showGuides: asBoolean(record.showGuides, DEFAULT_ORDER_DOCUMENT_TEMPLATE_CANVAS.showGuides),
    showRulers: asBoolean(record.showRulers, DEFAULT_ORDER_DOCUMENT_TEMPLATE_CANVAS.showRulers),
    deletedElementIds,
    elements
  };
}

const DEFAULT_ORDER_DOCUMENT_TABLE_COLUMN_RATIOS: Record<
  OrderDocumentTableColumnId,
  number
> = {
  sku: 13,
  quantity: 9,
  unit: 8,
  description: 39,
  unitPrice: 14,
  lineTotal: 17
};

function createDefaultOrderDocumentTable(
  style: OrderDocumentTemplateStyle,
  layout: OrderDocumentTemplateLayout
): OrderDocumentTable {
  const defaultRowHeight = style.tableSizePt + style.rowPaddingPt * 2 + 2;
  return {
    columns: ORDER_DOCUMENT_TABLE_COLUMN_IDS.map((id) => ({
      id,
      visible: id === 'description' || layout.columns[id],
      widthRatio: DEFAULT_ORDER_DOCUMENT_TABLE_COLUMN_RATIOS[id]
    })),
    headerHeightPt: defaultRowHeight,
    rowHeightPt: defaultRowHeight,
    rowGapPt: 0,
    rowHeightOverrides: [],
    cellTypographyOverrides: []
  };
}

function normalizeOrderDocumentTableBorders(
  value: unknown
): OrderDocumentTableBorders | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const record = asRecord(value);
  const borders: OrderDocumentTableBorders = {};
  for (const key of ['outer', 'horizontal', 'vertical'] as const) {
    if (typeof record[key] === 'boolean') borders[key] = record[key];
  }
  if (typeof record.color === 'string' && /^#[0-9A-F]{6}$/iu.test(record.color.trim())) {
    borders.color = record.color.trim().toUpperCase();
  }
  if (Number.isFinite(Number(record.widthPt))) {
    borders.widthPt = asNumber(record.widthPt, 0.5, 0.25, 12, 0.25);
  }
  return Object.keys(borders).length > 0 ? borders : undefined;
}

function normalizeOrderDocumentTableValue(
  value: unknown,
  style: OrderDocumentTemplateStyle,
  layout: OrderDocumentTemplateLayout
): OrderDocumentTable | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const record = asRecord(value);
  const fallback = createDefaultOrderDocumentTable(style, layout);
  const fallbackById = new Map(fallback.columns.map((column) => [column.id, column]));
  const columns: OrderDocumentTableColumn[] = [];
  const seenColumns = new Set<OrderDocumentTableColumnId>();

  if (Array.isArray(record.columns)) {
    for (const rawColumn of record.columns) {
      const column = asRecord(rawColumn);
      if (!ORDER_DOCUMENT_TABLE_COLUMN_IDS.includes(column.id as OrderDocumentTableColumnId)) {
        continue;
      }
      const id = column.id as OrderDocumentTableColumnId;
      if (seenColumns.has(id)) continue;
      const defaultColumn = fallbackById.get(id)!;
      const typography = normalizeOrderDocumentTypographyOverride(column.typography);
      const headerTypography = normalizeOrderDocumentTypographyOverride(
        column.headerTypography
      );
      const textAlign = normalizeOrderDocumentTextAlignment(column.textAlign);
      const headerTextAlign = normalizeOrderDocumentTextAlignment(
        column.headerTextAlign
      );
      columns.push({
        id,
        visible: asBoolean(column.visible, defaultColumn.visible),
        widthRatio: asNumber(column.widthRatio, defaultColumn.widthRatio, 1, 100, 0.1),
        ...(typography ? { typography } : {}),
        ...(textAlign ? { textAlign } : {}),
        ...(headerTypography ? { headerTypography } : {}),
        ...(headerTextAlign ? { headerTextAlign } : {})
      });
      seenColumns.add(id);
    }
  }

  for (const fallbackColumn of fallback.columns) {
    if (!seenColumns.has(fallbackColumn.id)) columns.push(clone(fallbackColumn));
  }
  if (!columns.some((column) => column.visible && (
    column.id === 'sku' || column.id === 'description'
  ))) {
    const description = columns.find((column) => column.id === 'description');
    if (description) description.visible = true;
  }

  const rowHeightOverrides: OrderDocumentTableRowHeightOverride[] = [];
  const seenRows = new Set<number>();
  if (Array.isArray(record.rowHeightOverrides)) {
    for (const rawOverride of record.rowHeightOverrides.slice(0, 200)) {
      const override = asRecord(rawOverride);
      const parsedRowNumber = Number(override.rowNumber);
      if (!Number.isFinite(parsedRowNumber)) continue;
      const rowNumber = asNumber(parsedRowNumber, 1, 1, 5000);
      if (seenRows.has(rowNumber)) continue;
      const typography = normalizeOrderDocumentTypographyOverride(override.typography);
      const textAlign = normalizeOrderDocumentTextAlignment(override.textAlign);
      const heightPt = Number.isFinite(Number(override.heightPt))
        ? asNumber(override.heightPt, fallback.rowHeightPt, 8, 200, 0.5)
        : undefined;
      if (heightPt === undefined && !typography && !textAlign) continue;
      rowHeightOverrides.push({
        rowNumber,
        ...(heightPt === undefined ? {} : { heightPt }),
        ...(typography ? { typography } : {}),
        ...(textAlign ? { textAlign } : {})
      });
      seenRows.add(rowNumber);
    }
  }
  rowHeightOverrides.sort((left, right) => left.rowNumber - right.rowNumber);

  const cellTypographyOverrides: OrderDocumentTableCellTypographyOverride[] = [];
  const seenCells = new Set<string>();
  if (Array.isArray(record.cellTypographyOverrides)) {
    for (const rawOverride of record.cellTypographyOverrides.slice(0, 30_000)) {
      const override = asRecord(rawOverride);
      if (!ORDER_DOCUMENT_TABLE_COLUMN_IDS.includes(
        override.columnId as OrderDocumentTableColumnId
      )) continue;
      const parsedRowNumber = Number(override.rowNumber);
      if (!Number.isFinite(parsedRowNumber)) continue;
      const typography = normalizeOrderDocumentTypographyOverride(override.typography);
      const textAlign = normalizeOrderDocumentTextAlignment(override.textAlign);
      if (!typography && !textAlign) continue;
      const rowNumber = asNumber(parsedRowNumber, 1, 1, 5000);
      const columnId = override.columnId as OrderDocumentTableColumnId;
      const identity = `${rowNumber}:${columnId}`;
      if (seenCells.has(identity)) continue;
      cellTypographyOverrides.push({
        rowNumber,
        columnId,
        ...(typography ? { typography } : {}),
        ...(textAlign ? { textAlign } : {})
      });
      seenCells.add(identity);
    }
  }
  cellTypographyOverrides.sort((left, right) => (
    left.rowNumber - right.rowNumber
    || ORDER_DOCUMENT_TABLE_COLUMN_IDS.indexOf(left.columnId)
      - ORDER_DOCUMENT_TABLE_COLUMN_IDS.indexOf(right.columnId)
  ));

  const headerTypography = normalizeOrderDocumentTypographyOverride(
    record.headerTypography
  );
  const bodyTypography = normalizeOrderDocumentTypographyOverride(record.bodyTypography);
  const headerTextAlign = normalizeOrderDocumentTextAlignment(record.headerTextAlign);
  const bodyTextAlign = normalizeOrderDocumentTextAlignment(record.bodyTextAlign);
  const borders = normalizeOrderDocumentTableBorders(record.borders);

  return {
    columns,
    headerHeightPt: asNumber(
      record.headerHeightPt,
      fallback.headerHeightPt,
      8,
      80,
      0.5
    ),
    rowHeightPt: asNumber(record.rowHeightPt, fallback.rowHeightPt, 8, 120, 0.5),
    rowGapPt: asNumber(record.rowGapPt, fallback.rowGapPt, 0, 30, 0.5),
    ...(headerTypography ? { headerTypography } : {}),
    ...(headerTextAlign ? { headerTextAlign } : {}),
    ...(bodyTypography ? { bodyTypography } : {}),
    ...(bodyTextAlign ? { bodyTextAlign } : {}),
    ...(borders ? { borders } : {}),
    rowHeightOverrides,
    cellTypographyOverrides
  };
}

function legacyColumnsFromOrderDocumentTable(
  table: OrderDocumentTable
): OrderDocumentTemplateColumns {
  const visibility = new Map(table.columns.map((column) => [column.id, column.visible]));
  return {
    sku: visibility.get('sku') ?? false,
    quantity: visibility.get('quantity') ?? false,
    unit: visibility.get('unit') ?? false,
    unitPrice: visibility.get('unitPrice') ?? false,
    lineTotal: visibility.get('lineTotal') ?? false
  };
}

const DEFAULT_DOCUMENT_META_ROW_IDS: Record<
  OrderDocumentTemplateType,
  readonly OrderDocumentFieldRowId[]
> = {
  order_summary: ['issue_date', 'order_date', 'customer_type', 'status', 'reference'],
  dobavnica: [
    'issue_date',
    'dispatch_date',
    'dispatch_method',
    'purchase_order_number',
    'purchase_order_date'
  ],
  predracun: ['issue_date', 'due_date', 'reference'],
  invoice: [
    'issue_date',
    'order_date',
    'purchase_order_number',
    'purchase_order_date',
    'dispatch_date',
    'delivery_note',
    'due_date',
    'payment_reference'
  ]
};

const DEFAULT_TOTAL_ROW_IDS: Record<
  OrderDocumentTemplateType,
  readonly OrderDocumentFieldRowId[]
> = {
  order_summary: ['subtotal', 'shipping', 'tax', 'total'],
  dobavnica: ['subtotal', 'tax'],
  predracun: ['subtotal', 'shipping', 'tax', 'total'],
  invoice: ['shipping', 'subtotal', 'tax', 'total']
};

function defaultOrderDocumentFieldRowIds(
  type: OrderDocumentTemplateType,
  group: OrderDocumentFieldGroupId
): readonly OrderDocumentFieldRowId[] {
  if (group === 'document_meta') return DEFAULT_DOCUMENT_META_ROW_IDS[type];
  if (group === 'totals') return DEFAULT_TOTAL_ROW_IDS[type];
  return ORDER_DOCUMENT_FIELD_ROW_IDS_BY_GROUP[group];
}

function normalizeOrderDocumentFieldRowList(
  value: unknown,
  group: OrderDocumentFieldGroupId
): OrderDocumentFieldRow[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const allowed = new Set<string>(ORDER_DOCUMENT_FIELD_ROW_IDS_BY_GROUP[group]);
  const rows: OrderDocumentFieldRow[] = [];
  const seen = new Set<string>();
  for (const rawRow of value) {
    const row = asRecord(rawRow);
    const id = row.id;
    if (typeof id !== 'string' || !allowed.has(id) || seen.has(id)) continue;
    rows.push({
      id: id as OrderDocumentFieldRowId,
      visible: asBoolean(row.visible, true),
      ...(normalizeOrderDocumentTypographyOverride(row.typography)
        ? { typography: normalizeOrderDocumentTypographyOverride(row.typography) }
        : {}),
      ...(normalizeOrderDocumentTextAlignment(row.textAlign)
        ? { textAlign: normalizeOrderDocumentTextAlignment(row.textAlign) }
        : {}),
      ...(normalizeOrderDocumentFieldRowPlacement(row.placement)
        ? { placement: normalizeOrderDocumentFieldRowPlacement(row.placement) }
        : {}),
      ...(normalizeOrderDocumentDecorationOverride(row.decoration)
        ? { decoration: normalizeOrderDocumentDecorationOverride(row.decoration) }
        : {})
    });
    seen.add(id);
  }
  return rows;
}

function normalizeOrderDocumentFieldRowsValue(value: unknown): OrderDocumentFieldRows | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const record = asRecord(value);
  const fieldRows: OrderDocumentFieldRows = {};
  for (const group of ORDER_DOCUMENT_FIELD_GROUP_IDS) {
    if (!Object.prototype.hasOwnProperty.call(record, group)) continue;
    const rows = normalizeOrderDocumentFieldRowList(record[group], group);
    if (rows) fieldRows[group] = rows;
  }
  return fieldRows;
}

function migrateLegacyIssueDateFieldRows(
  value: unknown,
  type: OrderDocumentTemplateType,
  style: OrderDocumentTemplateStyle,
  layout: OrderDocumentTemplateLayout,
  canvas: OrderDocumentTemplateCanvas | undefined
): unknown {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
  const record = asRecord(value);
  const hasTitleRows = Object.prototype.hasOwnProperty.call(record, 'title')
    && Array.isArray(record.title);
  const hasMetadataRows = Object.prototype.hasOwnProperty.call(record, 'document_meta')
    && Array.isArray(record.document_meta);
  if (!hasTitleRows && !hasMetadataRows) return value;

  const rawTitleRows = hasTitleRows ? [...(record.title as unknown[])] : [];
  const legacyIssueDate = rawTitleRows.find(
    (candidate) => asRecord(candidate).id === 'issue_date'
  );
  const oldMetadataDefaults: OrderDocumentFieldRow[] = DEFAULT_DOCUMENT_META_ROW_IDS[type]
    .filter((id) => id !== 'issue_date')
    .map((id) => ({ id, visible: true }));
  const metadataRows: OrderDocumentFieldRow[] = hasMetadataRows
    ? normalizeOrderDocumentFieldRowList(record.document_meta, 'document_meta') ?? []
    : oldMetadataDefaults;
  const source = normalizeOrderDocumentFieldRowList(
    legacyIssueDate ? [legacyIssueDate] : [],
    'document_meta'
  )?.[0];

  if (source?.placement) {
    const title = canvas?.elements.title ?? createDefaultCanvasElement('title', style, layout);
    const metadata = canvas?.elements.document_meta
      ?? createDefaultCanvasElement('document_meta', style, layout);
    const placement = source.placement;
    const mayConvert = title.positioning === 'absolute'
      && metadata.positioning === 'absolute'
      && title.page === metadata.page
      && typeof placement.xMm === 'number'
      && typeof placement.yMm === 'number';
    if (mayConvert) {
      const xMm = Number((title.xMm + placement.xMm! - metadata.xMm).toFixed(1));
      const yMm = Number((title.yMm + placement.yMm! - metadata.yMm).toFixed(1));
      const widthMm = placement.widthMm ?? 0;
      const heightMm = placement.heightMm ?? 0;
      const fits = xMm >= 0
        && yMm >= 0
        && xMm + widthMm <= metadata.widthMm
        && yMm + heightMm <= metadata.heightMm;
      if (fits) source.placement = { ...placement, xMm, yMm };
      else delete source.placement;
    } else {
      delete source.placement;
    }
  }

  const existingIndex = metadataRows.findIndex((row) => row.id === 'issue_date');
  if (source && existingIndex >= 0) {
    const existing = metadataRows[existingIndex];
    const merged: OrderDocumentFieldRow = {
      ...source,
      ...existing
    };
    if (source.typography || existing.typography) {
      merged.typography = { ...source.typography, ...existing.typography };
    }
    if (source.decoration || existing.decoration) {
      merged.decoration = { ...source.decoration, ...existing.decoration };
    }
    if (existing.placement) merged.placement = existing.placement;
    else if (source.placement) merged.placement = source.placement;
    else delete merged.placement;
    metadataRows[existingIndex] = merged;
  } else if (source) {
    metadataRows.unshift(source);
  } else if (!hasTitleRows && existingIndex < 0) {
    metadataRows.unshift({ id: 'issue_date', visible: true });
  }

  return {
    ...record,
    ...(hasTitleRows
      ? {
          title: rawTitleRows.filter(
            (candidate) => asRecord(candidate).id !== 'issue_date'
          )
        }
      : {}),
    document_meta: metadataRows
  };
}

function normalizeLayout(
  value: unknown,
  fallback: OrderDocumentTemplateLayout,
  style: OrderDocumentTemplateStyle,
  type: OrderDocumentTemplateType
): OrderDocumentTemplateLayout {
  const record = asRecord(value);
  const columns = asRecord(record.columns);
  const layout: OrderDocumentTemplateLayout = {
    showHeader: asBoolean(record.showHeader, fallback.showHeader),
    showLogoMark: asBoolean(record.showLogoMark, fallback.showLogoMark),
    showFooter: asBoolean(record.showFooter, fallback.showFooter),
    showPageNumbers: asBoolean(record.showPageNumbers, fallback.showPageNumbers),
    showShipping: asBoolean(record.showShipping, fallback.showShipping),
    showTaxSummary: asBoolean(record.showTaxSummary, fallback.showTaxSummary),
    columns: {
      sku: asBoolean(columns.sku, fallback.columns.sku),
      quantity: asBoolean(columns.quantity, fallback.columns.quantity),
      unit: asBoolean(columns.unit, fallback.columns.unit),
      unitPrice: asBoolean(columns.unitPrice, fallback.columns.unitPrice),
      lineTotal: asBoolean(columns.lineTotal, fallback.columns.lineTotal)
    },
    sections: normalizeSections(record.sections, fallback.sections)
  };
  const canvas = normalizeCanvas(record.canvas, style, layout);
  const table = normalizeOrderDocumentTableValue(record.table, style, layout);
  const fieldRows = normalizeOrderDocumentFieldRowsValue(
    migrateLegacyIssueDateFieldRows(record.fieldRows, type, style, layout, canvas)
  );
  return {
    ...layout,
    ...(table ? { columns: legacyColumnsFromOrderDocumentTable(table), table } : {}),
    ...(canvas ? { canvas } : {}),
    ...(fieldRows ? { fieldRows } : {})
  };
}

export function resolveOrderDocumentFieldRows(
  template: OrderDocumentTemplate,
  group: OrderDocumentFieldGroupId
): OrderDocumentFieldRow[] {
  const stored = template.layout.fieldRows;
  if (stored && Object.prototype.hasOwnProperty.call(stored, group)) {
    return clone(normalizeOrderDocumentFieldRowList(stored[group], group) ?? []);
  }
  return defaultOrderDocumentFieldRowIds(template.type, group).map((id) => ({
    id,
    visible: true
  }));
}

export function setOrderDocumentFieldRows(
  template: OrderDocumentTemplate,
  group: OrderDocumentFieldGroupId,
  value: readonly OrderDocumentFieldRow[]
): OrderDocumentTemplate {
  const rows = normalizeOrderDocumentFieldRowList(value, group) ?? [];
  const fieldRows = clone(template.layout.fieldRows ?? {});
  if (
    group === 'document_meta'
    && !Object.prototype.hasOwnProperty.call(fieldRows, 'title')
  ) {
    fieldRows.title = resolveOrderDocumentFieldRows(template, 'title');
  }
  return {
    ...template,
    layout: {
      ...template.layout,
      fieldRows: {
        ...fieldRows,
        [group]: clone(rows)
      }
    }
  };
}

export function setOrderDocumentFieldRowPlacement(
  template: OrderDocumentTemplate,
  group: OrderDocumentFieldGroupId,
  rowId: OrderDocumentFieldRowId,
  patch: OrderDocumentFieldRowPlacement
): OrderDocumentTemplate {
  const rows = resolveOrderDocumentFieldRows(template, group);
  if (!rows.some((row) => row.id === rowId)) return template;
  return setOrderDocumentFieldRows(
    template,
    group,
    rows.map((row) => {
      if (row.id !== rowId) return row;
      const placement = normalizeOrderDocumentFieldRowPlacement({
        ...row.placement,
        ...patch
      });
      const next = { ...row, ...(placement ? { placement } : {}) };
      if (!placement) delete next.placement;
      return next;
    })
  );
}

export function resetOrderDocumentFieldRowPlacement(
  template: OrderDocumentTemplate,
  group: OrderDocumentFieldGroupId,
  rowId: OrderDocumentFieldRowId
): OrderDocumentTemplate {
  const rows = resolveOrderDocumentFieldRows(template, group);
  if (!rows.some((row) => row.id === rowId && row.placement)) return template;
  return setOrderDocumentFieldRows(
    template,
    group,
    rows.map((row) => {
      if (row.id !== rowId) return row;
      const next = { ...row };
      delete next.placement;
      return next;
    })
  );
}

export function removeOrderDocumentFieldRow(
  template: OrderDocumentTemplate,
  group: OrderDocumentFieldGroupId,
  id: OrderDocumentFieldRowId
): OrderDocumentTemplate {
  return setOrderDocumentFieldRows(
    template,
    group,
    resolveOrderDocumentFieldRows(template, group).filter((row) => row.id !== id)
  );
}

export function restoreOrderDocumentFieldRow(
  template: OrderDocumentTemplate,
  group: OrderDocumentFieldGroupId,
  id: OrderDocumentFieldRowId,
  requestedIndex?: number
): OrderDocumentTemplate {
  const canonical = [...ORDER_DOCUMENT_FIELD_ROW_IDS_BY_GROUP[group]] as OrderDocumentFieldRowId[];
  if (!canonical.includes(id)) return template;
  const rows = resolveOrderDocumentFieldRows(template, group);
  if (rows.some((row) => row.id === id)) return template;

  let index = Number.isInteger(requestedIndex)
    ? Math.max(0, Math.min(rows.length, requestedIndex as number))
    : rows.length;
  if (!Number.isInteger(requestedIndex)) {
    const canonicalIndex = canonical.indexOf(id);
    const nextCanonical = canonical.slice(canonicalIndex + 1);
    const nextIndex = rows.findIndex((row) => nextCanonical.includes(row.id));
    if (nextIndex >= 0) index = nextIndex;
  }
  rows.splice(index, 0, { id, visible: true });
  return setOrderDocumentFieldRows(template, group, rows);
}

const ORDER_DOCUMENT_CANVAS_PARENT_BY_CHILD: Partial<
  Record<OrderDocumentCanvasElementId, OrderDocumentCanvasElementId>
> = {
  logo: 'header',
  company: 'header',
  title: 'document_details',
  customer: 'document_details',
  document_meta: 'document_details'
};

/** Direct tombstones only; descendants suppressed by a deleted group are not added. */
export function resolveOrderDocumentDeletedCanvasElementIds(
  template: Pick<OrderDocumentTemplate, 'layout'>
): OrderDocumentCanvasElementId[] {
  const value = template.layout.canvas?.deletedElementIds;
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((id): id is OrderDocumentCanvasElementId =>
    ORDER_DOCUMENT_CANVAS_ELEMENT_IDS.includes(id as OrderDocumentCanvasElementId)
  ))];
}

export function isOrderDocumentCanvasElementDirectlyDeleted(
  template: Pick<OrderDocumentTemplate, 'layout'>,
  id: OrderDocumentCanvasElementId
) {
  return resolveOrderDocumentDeletedCanvasElementIds(template).includes(id);
}

/** A group tombstone suppresses its children without creating child tombstones. */
export function isOrderDocumentCanvasElementDeleted(
  template: Pick<OrderDocumentTemplate, 'layout'>,
  id: OrderDocumentCanvasElementId
) {
  const deleted = new Set(resolveOrderDocumentDeletedCanvasElementIds(template));
  const parentId = ORDER_DOCUMENT_CANVAS_PARENT_BY_CHILD[id];
  return deleted.has(id) || (parentId ? deleted.has(parentId) : false);
}

/**
 * Deletes one canvas element, resets only that element's stored override and
 * leaves descendant tombstones/overrides untouched. This makes group restore
 * predictable: restoring a group never revives a child deleted independently.
 */
export function deleteOrderDocumentCanvasElement(
  template: OrderDocumentTemplate,
  id: OrderDocumentCanvasElementId
): OrderDocumentTemplate {
  const source = clone(template.layout.canvas ?? DEFAULT_ORDER_DOCUMENT_TEMPLATE_CANVAS);
  const elements = { ...source.elements };
  delete elements[id];
  const deletedElementIds = [
    ...resolveOrderDocumentDeletedCanvasElementIds(template).filter((candidate) => candidate !== id),
    id
  ];
  return {
    ...template,
    layout: {
      ...template.layout,
      canvas: { ...source, deletedElementIds, elements }
    }
  };
}

/**
 * Restores the canonical element while preserving unrelated tombstones. When
 * a directly deleted child is restored, its directly deleted required parent
 * group is restored as well so the child is immediately visible/reachable.
 */
export function restoreOrderDocumentCanvasElement(
  template: OrderDocumentTemplate,
  id: OrderDocumentCanvasElementId
): OrderDocumentTemplate {
  if (!isOrderDocumentCanvasElementDirectlyDeleted(template, id)) return template;
  const source = clone(template.layout.canvas ?? DEFAULT_ORDER_DOCUMENT_TEMPLATE_CANVAS);
  const elements = { ...source.elements };
  // A stale override must not survive a delete/restore round trip.
  delete elements[id];
  let restored = restoreLegacyCanvasElementVisibility({
    ...template,
    layout: {
      ...template.layout,
      canvas: {
        ...source,
        deletedElementIds: resolveOrderDocumentDeletedCanvasElementIds(template)
          .filter((candidate) => candidate !== id),
        elements
      }
    }
  }, id);
  const parentId = ORDER_DOCUMENT_CANVAS_PARENT_BY_CHILD[id];
  if (parentId && isOrderDocumentCanvasElementDirectlyDeleted(restored, parentId)) {
    restored = restoreOrderDocumentCanvasElement(restored, parentId);
  }
  return restored;
}

export function resolveOrderDocumentCanvasElement(
  template: OrderDocumentTemplate,
  id: OrderDocumentCanvasElementId
): OrderDocumentCanvasElement {
  const fallback = createDefaultCanvasElement(id, template.style, template.layout);
  const override = template.layout.canvas?.elements[id];
  const resolved = override ? normalizeCanvasElement(id, override, fallback) : fallback;
  const parentId = id === 'logo' || id === 'company'
    ? 'header'
    : id === 'title' || id === 'customer' || id === 'document_meta'
      ? 'document_details'
      : null;
  const parentVisible = parentId === null
    ? true
    : normalizeCanvasElement(
        parentId,
        template.layout.canvas?.elements[parentId],
        createDefaultCanvasElement(parentId, template.style, template.layout)
      ).visible;
  return clone({
    ...resolved,
    visible: resolved.visible
      && parentVisible
      && !isOrderDocumentCanvasElementDeleted(template, id)
      && legacyCanvasElementVisible(template.layout, id)
  });
}

export function resolveOrderDocumentCanvas(
  template: OrderDocumentTemplate
): OrderDocumentTemplateCanvas & {
  elements: Record<OrderDocumentCanvasElementId, OrderDocumentCanvasElement>;
} {
  const source = template.layout.canvas;
  return {
    ...clone(DEFAULT_ORDER_DOCUMENT_TEMPLATE_CANVAS),
    ...(source ? clone(source) : {}),
    deletedElementIds: resolveOrderDocumentDeletedCanvasElementIds(template),
    elements: Object.fromEntries(
      ORDER_DOCUMENT_CANVAS_ELEMENT_IDS.map((id) => [
        id,
        resolveOrderDocumentCanvasElement(template, id)
      ])
    ) as Record<OrderDocumentCanvasElementId, OrderDocumentCanvasElement>
  };
}

export function materializeOrderDocumentCanvasElement(
  template: OrderDocumentTemplate,
  id: OrderDocumentCanvasElementId
): OrderDocumentTemplate {
  if (isOrderDocumentCanvasElementDirectlyDeleted(template, id)) return template;
  const source = template.layout.canvas ?? DEFAULT_ORDER_DOCUMENT_TEMPLATE_CANVAS;
  return {
    ...template,
    layout: {
      ...template.layout,
      canvas: {
        ...clone(source),
        elements: {
          ...clone(source.elements),
          [id]: resolveOrderDocumentCanvasElement(template, id)
        }
      }
    }
  };
}

export function resolveOrderDocumentTable(
  template: OrderDocumentTemplate
): OrderDocumentTable {
  const fallback = createDefaultOrderDocumentTable(template.style, template.layout);
  return clone(
    normalizeOrderDocumentTableValue(template.layout.table, template.style, template.layout)
      ?? fallback
  );
}

export function setOrderDocumentTable(
  template: OrderDocumentTemplate,
  value: OrderDocumentTable
): OrderDocumentTemplate {
  const table = normalizeOrderDocumentTableValue(value, template.style, template.layout)
    ?? createDefaultOrderDocumentTable(template.style, template.layout);
  return {
    ...template,
    layout: {
      ...template.layout,
      columns: legacyColumnsFromOrderDocumentTable(table),
      table: clone(table)
    }
  };
}

export function materializeOrderDocumentTable(
  template: OrderDocumentTemplate
): OrderDocumentTemplate {
  return setOrderDocumentTable(template, resolveOrderDocumentTable(template));
}

/** Resolves sparse table-grid settings against the current template line style. */
export function resolveOrderDocumentTableBorders(
  template: OrderDocumentTemplate,
  table: OrderDocumentTable = resolveOrderDocumentTable(template)
): ResolvedOrderDocumentTableBorders {
  return {
    outer: table.borders?.outer ?? false,
    horizontal: table.borders?.horizontal ?? false,
    vertical: table.borders?.vertical ?? false,
    color: table.borders?.color ?? template.style.lineColor,
    widthPt: table.borders?.widthPt ?? template.style.lineWidthPt
  };
}

/** Applies a partial table-grid edit without materializing inherited defaults. */
export function setOrderDocumentTableBorders(
  template: OrderDocumentTemplate,
  patch: OrderDocumentTableBorders
): OrderDocumentTemplate {
  const table = resolveOrderDocumentTable(template);
  const borders = normalizeOrderDocumentTableBorders({
    ...table.borders,
    ...patch
  });
  const nextTable = { ...table, borders };
  if (!borders) delete nextTable.borders;
  return setOrderDocumentTable(template, nextTable);
}

export function resetOrderDocumentTableBorders(
  template: OrderDocumentTemplate
): OrderDocumentTemplate {
  const table = resolveOrderDocumentTable(template);
  if (!table.borders) return template;
  const nextTable = { ...table };
  delete nextTable.borders;
  return setOrderDocumentTable(template, nextTable);
}

/** Resolves explicit row height without coupling font-only edits to geometry. */
export function resolveOrderDocumentTableRowHeight(
  table: OrderDocumentTable,
  rowNumber: number
): number {
  return table.rowHeightOverrides.find((row) => row.rowNumber === rowNumber)?.heightPt
    ?? table.rowHeightPt;
}

/** Stable identity shared by selection state, controls, tests, and persistence adapters. */
export function orderDocumentTypographyTargetKey(
  target: OrderDocumentTypographyTarget
): string {
  if (target.kind === 'element') return `element:${target.elementId}`;
  if (target.kind === 'field_row') return `field_row:${target.group}:${target.rowId}`;
  if (target.kind === 'company_contact') return `company_contact:${target.contactId}`;
  if (target.kind === 'table_header') return 'table_header';
  if (target.kind === 'table_body') return 'table_body';
  if (target.kind === 'table_header_cell') {
    return `table_header_cell:${target.columnId}`;
  }
  if (target.kind === 'table_column') return `table_column:${target.columnId}`;
  if (target.kind === 'table_row') return `table_row:${target.rowNumber}`;
  return `table_cell:${target.rowNumber}:${target.columnId}`;
}

/**
 * Returns the deterministic table inheritance path for one semantic target.
 * Exact cells deliberately carry their full cascade so the canvas and PDF can
 * call the same pure resolver without reimplementing precedence.
 */
export function getOrderDocumentTypographyCascadeTargets(
  target: OrderDocumentTypographyTarget
): readonly OrderDocumentTypographyTarget[] {
  if (target.kind === 'table_header_cell') {
    return [
      { kind: 'table_header' },
      { kind: 'table_column', columnId: target.columnId },
      target
    ];
  }
  if (target.kind === 'table_cell') {
    return [
      { kind: 'table_body' },
      { kind: 'table_column', columnId: target.columnId },
      { kind: 'table_row', rowNumber: target.rowNumber },
      target
    ];
  }
  return [target];
}

function typographyElementIdForTarget(
  target: OrderDocumentTypographyTarget
): OrderDocumentCanvasElementId {
  if (target.kind === 'element') return target.elementId;
  if (target.kind === 'field_row') return target.group;
  if (target.kind === 'company_contact') return 'company';
  return 'items';
}

function defaultTypographyForElement(
  template: OrderDocumentTemplate,
  elementId: OrderDocumentCanvasElementId
): OrderDocumentTypography {
  const sizeByElement: Record<OrderDocumentCanvasElementId, number> = {
    header: template.style.bodySizePt,
    logo: template.style.bodySizePt,
    company: template.style.smallSizePt,
    document_details: template.style.bodySizePt,
    title: template.style.titleSizePt,
    customer: template.style.bodySizePt,
    document_meta: template.style.smallSizePt,
    intro: template.style.bodySizePt,
    items: template.style.tableSizePt,
    totals: template.style.bodySizePt,
    notes: template.style.smallSizePt,
    closing: template.style.smallSizePt,
    signatures: template.style.smallSizePt,
    footer: template.style.smallSizePt
  };
  return {
    ...DEFAULT_ORDER_DOCUMENT_TYPOGRAPHY,
    fontWeight: elementId === 'title' ? 'bold' : 'regular',
    fontSizePt: sizeByElement[elementId]
  };
}

/** Canonical semantic fallback used by both the editor preview and PDF renderer. */
export function getDefaultOrderDocumentTypography(
  template: OrderDocumentTemplate,
  target: OrderDocumentTypographyTarget
): OrderDocumentTypography {
  const base = defaultTypographyForElement(template, typographyElementIdForTarget(target));
  if (target.kind === 'company_contact') {
    const contact = resolveOrderDocumentCompanyContacts(template)
      .find((candidate) => candidate.id === target.contactId);
    return { ...base, fontWeight: contact?.emphasis ? 'bold' : 'regular' };
  }
  if (target.kind === 'table_header' || target.kind === 'table_header_cell') {
    return { ...base, fontWeight: 'bold' };
  }
  if (
    target.kind === 'table_body'
    || target.kind === 'table_column'
    || target.kind === 'table_row'
    || target.kind === 'table_cell'
  ) return base;
  if (target.kind !== 'field_row') return base;
  if (target.group === 'title') {
    if (target.rowId === 'title_text') {
      return { ...base, fontWeight: 'bold', fontSizePt: template.style.titleSizePt };
    }
    if (target.rowId === 'document_number') {
      return {
        ...base,
        fontWeight: 'bold',
        fontSizePt: Math.max(template.style.bodySizePt + 2, template.style.titleSizePt - 2.5)
      };
    }
    return { ...base, fontWeight: 'regular', fontSizePt: template.style.smallSizePt };
  }
  if (target.group === 'totals' && target.rowId === 'total') {
    return { ...base, fontWeight: 'bold', fontSizePt: template.style.bodySizePt + 0.5 };
  }
  if (target.group === 'notes' && target.rowId === 'notes_label') {
    return { ...base, fontWeight: 'bold', fontSizePt: template.style.smallSizePt };
  }
  if (target.group === 'closing' && target.rowId === 'signer_name') {
    return { ...base, fontWeight: 'bold', fontSizePt: template.style.smallSizePt };
  }
  return base;
}

export function getOrderDocumentTypographyOverride(
  template: OrderDocumentTemplate,
  target: OrderDocumentTypographyTarget
): OrderDocumentTypographyOverride | undefined {
  let value: unknown;
  if (target.kind === 'element') {
    value = template.layout.canvas?.elements[target.elementId]?.typography;
  } else if (target.kind === 'field_row') {
    value = resolveOrderDocumentFieldRows(template, target.group)
      .find((row) => row.id === target.rowId)?.typography;
  } else if (target.kind === 'company_contact') {
    value = resolveOrderDocumentCompanyContacts(template)
      .find((contact) => contact.id === target.contactId)?.typography;
  } else if (target.kind === 'table_column') {
    value = resolveOrderDocumentTable(template).columns
      .find((column) => column.id === target.columnId)?.typography;
  } else if (target.kind === 'table_header') {
    value = resolveOrderDocumentTable(template).headerTypography;
  } else if (target.kind === 'table_body') {
    value = resolveOrderDocumentTable(template).bodyTypography;
  } else if (target.kind === 'table_header_cell') {
    value = resolveOrderDocumentTable(template).columns
      .find((column) => column.id === target.columnId)?.headerTypography;
  } else if (target.kind === 'table_row') {
    value = resolveOrderDocumentTable(template).rowHeightOverrides
      .find((row) => row.rowNumber === target.rowNumber)?.typography;
  } else {
    value = resolveOrderDocumentTable(template).cellTypographyOverrides
      .find((cell) => (
        cell.rowNumber === target.rowNumber && cell.columnId === target.columnId
      ))?.typography;
  }
  const normalized = normalizeOrderDocumentTypographyOverride(value);
  return normalized ? clone(normalized) : undefined;
}

/**
 * Resolves role < parent element < child targets. Multiple child targets are
 * applied left-to-right, so table cells pass [column, row] and the row wins.
 */
export function resolveOrderDocumentTypography(
  template: OrderDocumentTemplate,
  target: OrderDocumentTypographyTarget | readonly OrderDocumentTypographyTarget[],
  fallback?: OrderDocumentTypography
): OrderDocumentTypography {
  const requestedTargets = Array.isArray(target) ? target : [target];
  const firstTarget = requestedTargets[0] as OrderDocumentTypographyTarget | undefined;
  if (!firstTarget) {
    return resolveSupportedOrderDocumentTypography(
      fallback ?? DEFAULT_ORDER_DOCUMENT_TYPOGRAPHY
    );
  }
  const base = fallback ?? getDefaultOrderDocumentTypography(template, firstTarget);
  const merged: OrderDocumentTypography = { ...base };
  const parentIds = new Set<OrderDocumentCanvasElementId>();
  for (const childTarget of requestedTargets) {
    parentIds.add(typographyElementIdForTarget(childTarget));
  }
  for (const elementId of parentIds) {
    Object.assign(
      merged,
      getOrderDocumentTypographyOverride(template, { kind: 'element', elementId })
    );
  }
  const appliedTargets = new Set<string>();
  for (const requestedTarget of requestedTargets) {
    for (const childTarget of getOrderDocumentTypographyCascadeTargets(requestedTarget)) {
      if (childTarget.kind === 'element') continue;
      const identity = orderDocumentTypographyTargetKey(childTarget);
      if (appliedTargets.has(identity)) continue;
      Object.assign(merged, getOrderDocumentTypographyOverride(template, childTarget));
      appliedTargets.add(identity);
    }
  }
  return resolveSupportedOrderDocumentTypography(merged);
}

function writeOrderDocumentTypographyOverride(
  template: OrderDocumentTemplate,
  target: OrderDocumentTypographyTarget,
  typography: OrderDocumentTypographyOverride | undefined
): OrderDocumentTemplate {
  if (target.kind === 'element') {
    if (isOrderDocumentCanvasElementDirectlyDeleted(template, target.elementId)) {
      return template;
    }
    const canvas = template.layout.canvas ?? DEFAULT_ORDER_DOCUMENT_TEMPLATE_CANVAS;
    const element = template.layout.canvas?.elements[target.elementId]
      ?? resolveOrderDocumentCanvasElement(template, target.elementId);
    const nextElement = { ...element, typography };
    if (!typography) delete nextElement.typography;
    return {
      ...template,
      layout: {
        ...template.layout,
        canvas: {
          ...clone(canvas),
          elements: {
            ...clone(canvas.elements),
            [target.elementId]: nextElement
          }
        }
      }
    };
  }
  if (target.kind === 'field_row') {
    return setOrderDocumentFieldRows(
      template,
      target.group,
      resolveOrderDocumentFieldRows(template, target.group).map((row) => {
        if (row.id !== target.rowId) return row;
        const nextRow = { ...row, typography };
        if (!typography) delete nextRow.typography;
        return nextRow;
      })
    );
  }
  if (target.kind === 'company_contact') {
    return setOrderDocumentCompanyContacts(
      template,
      resolveOrderDocumentCompanyContacts(template).map((contact) => {
        if (contact.id !== target.contactId) return contact;
        const nextContact = { ...contact, typography };
        if (!typography) delete nextContact.typography;
        return nextContact;
      })
    );
  }
  const table = resolveOrderDocumentTable(template);
  if (target.kind === 'table_header' || target.kind === 'table_body') {
    const property = target.kind === 'table_header'
      ? 'headerTypography'
      : 'bodyTypography';
    const nextTable = { ...table, [property]: typography };
    if (!typography) delete nextTable[property];
    return setOrderDocumentTable(template, nextTable);
  }
  if (target.kind === 'table_column') {
    return setOrderDocumentTable(template, {
      ...table,
      columns: table.columns.map((column) => {
        if (column.id !== target.columnId) return column;
        const nextColumn = { ...column, typography };
        if (!typography) delete nextColumn.typography;
        return nextColumn;
      })
    });
  }
  if (target.kind === 'table_header_cell') {
    return setOrderDocumentTable(template, {
      ...table,
      columns: table.columns.map((column) => {
        if (column.id !== target.columnId) return column;
        const nextColumn = { ...column, headerTypography: typography };
        if (!typography) delete nextColumn.headerTypography;
        return nextColumn;
      })
    });
  }
  if (target.kind === 'table_cell') {
    const rowNumber = Math.max(1, Math.min(5000, Math.round(target.rowNumber)));
    const existing = table.cellTypographyOverrides.find((cell) => (
      cell.rowNumber === rowNumber && cell.columnId === target.columnId
    ));
    const cells = existing
      ? table.cellTypographyOverrides.flatMap((cell) => {
          if (cell !== existing) return [cell];
          const nextCell = { ...cell, typography };
          if (!typography) delete nextCell.typography;
          return nextCell.typography || nextCell.textAlign ? [nextCell] : [];
        })
      : typography
        ? [...table.cellTypographyOverrides, {
            rowNumber,
            columnId: target.columnId,
            typography
          }]
        : table.cellTypographyOverrides;
    return setOrderDocumentTable(template, {
      ...table,
      cellTypographyOverrides: cells
    });
  }
  const rowNumber = Math.max(1, Math.min(5000, Math.round(target.rowNumber)));
  const existing = table.rowHeightOverrides.find((row) => row.rowNumber === rowNumber);
  const rows = existing
    ? table.rowHeightOverrides.flatMap((row) => {
        if (row.rowNumber !== rowNumber) return row;
        const nextRow = { ...row, typography };
        if (!typography) delete nextRow.typography;
        return nextRow.heightPt !== undefined || nextRow.typography || nextRow.textAlign
          ? [nextRow]
          : [];
      })
    : typography
      ? [...table.rowHeightOverrides, { rowNumber, typography }]
      : table.rowHeightOverrides;
  return setOrderDocumentTable(template, { ...table, rowHeightOverrides: rows });
}

/** Merges a sparse patch, preserving the target's other explicit properties. */
export function setOrderDocumentTypography(
  template: OrderDocumentTemplate,
  target: OrderDocumentTypographyTarget,
  patch: OrderDocumentTypographyOverride
): OrderDocumentTemplate {
  const normalizedPatch = normalizeOrderDocumentTypographyOverride(patch);
  if (!normalizedPatch) return template;
  const typography = normalizeOrderDocumentTypographyOverride({
    ...getOrderDocumentTypographyOverride(template, target),
    ...normalizedPatch
  });
  return writeOrderDocumentTypographyOverride(template, target, typography);
}

export function resetOrderDocumentTypography(
  template: OrderDocumentTemplate,
  target: OrderDocumentTypographyTarget
): OrderDocumentTemplate {
  if (!getOrderDocumentTypographyOverride(template, target)) return template;
  return writeOrderDocumentTypographyOverride(template, target, undefined);
}

export function orderDocumentTextAlignmentTargetKey(
  target: OrderDocumentTextAlignmentTarget
): string {
  return orderDocumentTypographyTargetKey(target);
}

export function getOrderDocumentTextAlignmentCascadeTargets(
  target: OrderDocumentTextAlignmentTarget
): readonly OrderDocumentTextAlignmentTarget[] {
  return getOrderDocumentTypographyCascadeTargets(target);
}

const defaultTableColumnTextAlignment = (
  columnId: OrderDocumentTableColumnId
): OrderDocumentTextAlignment => (
  columnId === 'quantity' || columnId === 'unitPrice' || columnId === 'lineTotal'
    ? 'right'
    : 'left'
);

/** Canonical automatic alignment that reproduces the legacy semantic layout. */
export function getDefaultOrderDocumentTextAlignment(
  template: OrderDocumentTemplate,
  target: OrderDocumentTextAlignmentTarget
): OrderDocumentResolvedTextAlignment {
  if (
    target.kind === 'table_column'
    || target.kind === 'table_header_cell'
    || target.kind === 'table_cell'
  ) return defaultTableColumnTextAlignment(target.columnId);
  if (
    target.kind === 'table_header'
    || target.kind === 'table_body'
    || target.kind === 'table_row'
  ) return 'distributed';
  if (target.kind === 'company_contact') return 'right';
  if (target.kind === 'field_row') {
    if (
      target.group === 'customer'
      || target.group === 'document_meta'
      || target.group === 'totals'
      || target.group === 'signatures'
    ) return 'distributed';
    if (target.group === 'company') return 'right';
    if (target.group === 'footer') {
      return target.rowId === 'page_numbers' ? 'right' : 'center';
    }
    if (target.group === 'title') {
      return target.rowId === 'document_number'
        ? 'right'
        : template.style.titleAlignment;
    }
    return 'left';
  }
  const defaults: Record<
    OrderDocumentCanvasElementId,
    OrderDocumentResolvedTextAlignment
  > = {
    header: 'distributed',
    logo: 'left',
    company: 'right',
    document_details: 'distributed',
    title: template.style.titleAlignment,
    customer: 'distributed',
    document_meta: 'distributed',
    intro: 'left',
    items: 'distributed',
    totals: 'distributed',
    notes: 'left',
    closing: 'left',
    signatures: 'distributed',
    footer: 'center'
  };
  return defaults[target.elementId];
}

export function getOrderDocumentTextAlignmentOverride(
  template: OrderDocumentTemplate,
  target: OrderDocumentTextAlignmentTarget
): OrderDocumentTextAlignment | undefined {
  let value: unknown;
  if (target.kind === 'element') {
    value = template.layout.canvas?.elements[target.elementId]?.textAlign;
  } else if (target.kind === 'field_row') {
    value = resolveOrderDocumentFieldRows(template, target.group)
      .find((row) => row.id === target.rowId)?.textAlign;
  } else if (target.kind === 'company_contact') {
    value = resolveOrderDocumentCompanyContacts(template)
      .find((contact) => contact.id === target.contactId)?.textAlign;
  } else if (target.kind === 'table_column') {
    value = resolveOrderDocumentTable(template).columns
      .find((column) => column.id === target.columnId)?.textAlign;
  } else if (target.kind === 'table_header') {
    value = resolveOrderDocumentTable(template).headerTextAlign;
  } else if (target.kind === 'table_body') {
    value = resolveOrderDocumentTable(template).bodyTextAlign;
  } else if (target.kind === 'table_header_cell') {
    value = resolveOrderDocumentTable(template).columns
      .find((column) => column.id === target.columnId)?.headerTextAlign;
  } else if (target.kind === 'table_row') {
    value = resolveOrderDocumentTable(template).rowHeightOverrides
      .find((row) => row.rowNumber === target.rowNumber)?.textAlign;
  } else {
    value = resolveOrderDocumentTable(template).cellTypographyOverrides
      .find((cell) => (
        cell.rowNumber === target.rowNumber && cell.columnId === target.columnId
      ))?.textAlign;
  }
  return normalizeOrderDocumentTextAlignment(value);
}

/** Parent element < table scope < exact semantic target, matching typography. */
export function resolveOrderDocumentTextAlignment(
  template: OrderDocumentTemplate,
  target: OrderDocumentTextAlignmentTarget | readonly OrderDocumentTextAlignmentTarget[],
  fallback?: OrderDocumentResolvedTextAlignment
): OrderDocumentResolvedTextAlignment {
  const requestedTargets = Array.isArray(target) ? target : [target];
  const firstTarget = requestedTargets[0] as OrderDocumentTextAlignmentTarget | undefined;
  if (!firstTarget) return fallback ?? 'left';
  let alignment = fallback ?? getDefaultOrderDocumentTextAlignment(template, firstTarget);
  const parentIds = new Set<OrderDocumentCanvasElementId>();
  for (const childTarget of requestedTargets) {
    parentIds.add(typographyElementIdForTarget(childTarget));
  }
  for (const elementId of parentIds) {
    alignment = getOrderDocumentTextAlignmentOverride(template, {
      kind: 'element',
      elementId
    }) ?? alignment;
  }
  const appliedTargets = new Set<string>();
  for (const requestedTarget of requestedTargets) {
    for (const childTarget of getOrderDocumentTextAlignmentCascadeTargets(requestedTarget)) {
      if (childTarget.kind === 'element') continue;
      const identity = orderDocumentTextAlignmentTargetKey(childTarget);
      if (appliedTargets.has(identity)) continue;
      alignment = getOrderDocumentTextAlignmentOverride(template, childTarget) ?? alignment;
      appliedTargets.add(identity);
    }
  }
  return alignment;
}

function writeOrderDocumentTextAlignmentOverride(
  template: OrderDocumentTemplate,
  target: OrderDocumentTextAlignmentTarget,
  textAlign: OrderDocumentTextAlignment | undefined
): OrderDocumentTemplate {
  if (target.kind === 'element') {
    if (isOrderDocumentCanvasElementDirectlyDeleted(template, target.elementId)) return template;
    const canvas = template.layout.canvas ?? DEFAULT_ORDER_DOCUMENT_TEMPLATE_CANVAS;
    const element = template.layout.canvas?.elements[target.elementId]
      ?? resolveOrderDocumentCanvasElement(template, target.elementId);
    const nextElement = { ...element, textAlign };
    if (!textAlign) delete nextElement.textAlign;
    return {
      ...template,
      layout: {
        ...template.layout,
        canvas: {
          ...clone(canvas),
          elements: { ...clone(canvas.elements), [target.elementId]: nextElement }
        }
      }
    };
  }
  if (target.kind === 'field_row') {
    return setOrderDocumentFieldRows(
      template,
      target.group,
      resolveOrderDocumentFieldRows(template, target.group).map((row) => {
        if (row.id !== target.rowId) return row;
        const nextRow = { ...row, textAlign };
        if (!textAlign) delete nextRow.textAlign;
        return nextRow;
      })
    );
  }
  if (target.kind === 'company_contact') {
    return setOrderDocumentCompanyContacts(
      template,
      resolveOrderDocumentCompanyContacts(template).map((contact) => {
        if (contact.id !== target.contactId) return contact;
        const nextContact = { ...contact, textAlign };
        if (!textAlign) delete nextContact.textAlign;
        return nextContact;
      })
    );
  }
  const table = resolveOrderDocumentTable(template);
  if (target.kind === 'table_header' || target.kind === 'table_body') {
    const property = target.kind === 'table_header' ? 'headerTextAlign' : 'bodyTextAlign';
    const nextTable = { ...table, [property]: textAlign };
    if (!textAlign) delete nextTable[property];
    return setOrderDocumentTable(template, nextTable);
  }
  if (target.kind === 'table_column' || target.kind === 'table_header_cell') {
    const property = target.kind === 'table_column' ? 'textAlign' : 'headerTextAlign';
    return setOrderDocumentTable(template, {
      ...table,
      columns: table.columns.map((column) => {
        if (column.id !== target.columnId) return column;
        const nextColumn = { ...column, [property]: textAlign };
        if (!textAlign) delete nextColumn[property];
        return nextColumn;
      })
    });
  }
  if (target.kind === 'table_cell') {
    const rowNumber = Math.max(1, Math.min(5000, Math.round(target.rowNumber)));
    const existing = table.cellTypographyOverrides.find((cell) => (
      cell.rowNumber === rowNumber && cell.columnId === target.columnId
    ));
    const cells = existing
      ? table.cellTypographyOverrides.flatMap((cell) => {
          if (cell !== existing) return [cell];
          const nextCell = { ...cell, textAlign };
          if (!textAlign) delete nextCell.textAlign;
          return nextCell.typography || nextCell.textAlign ? [nextCell] : [];
        })
      : textAlign
        ? [...table.cellTypographyOverrides, {
            rowNumber,
            columnId: target.columnId,
            textAlign
          }]
        : table.cellTypographyOverrides;
    return setOrderDocumentTable(template, { ...table, cellTypographyOverrides: cells });
  }
  const rowNumber = Math.max(1, Math.min(5000, Math.round(target.rowNumber)));
  const existing = table.rowHeightOverrides.find((row) => row.rowNumber === rowNumber);
  const rows = existing
    ? table.rowHeightOverrides.flatMap((row) => {
        if (row.rowNumber !== rowNumber) return [row];
        const nextRow = { ...row, textAlign };
        if (!textAlign) delete nextRow.textAlign;
        return nextRow.heightPt !== undefined || nextRow.typography || nextRow.textAlign
          ? [nextRow]
          : [];
      })
    : textAlign
      ? [...table.rowHeightOverrides, { rowNumber, textAlign }]
      : table.rowHeightOverrides;
  return setOrderDocumentTable(template, { ...table, rowHeightOverrides: rows });
}

export function setOrderDocumentTextAlignment(
  template: OrderDocumentTemplate,
  target: OrderDocumentTextAlignmentTarget,
  textAlign: OrderDocumentTextAlignment
): OrderDocumentTemplate {
  const normalized = normalizeOrderDocumentTextAlignment(textAlign);
  if (!normalized) return template;
  if (getOrderDocumentTextAlignmentOverride(template, target) === normalized) return template;
  return writeOrderDocumentTextAlignmentOverride(template, target, normalized);
}

export function resetOrderDocumentTextAlignment(
  template: OrderDocumentTemplate,
  target: OrderDocumentTextAlignmentTarget
): OrderDocumentTemplate {
  if (!getOrderDocumentTextAlignmentOverride(template, target)) return template;
  return writeOrderDocumentTextAlignmentOverride(template, target, undefined);
}

const ALL_DECORATION_SIDES: OrderDocumentDecorationSide[] = [
  ...ORDER_DOCUMENT_DECORATION_SIDES
];

function neutralOrderDocumentDecoration(
  template: OrderDocumentTemplate
): OrderDocumentDecoration {
  return {
    fillEnabled: false,
    fillColor: template.style.totalBackground,
    outlineEnabled: false,
    outlineColor: template.style.lineColor,
    outlineWidthPt: template.style.lineWidthPt,
    outlineSides: [...ALL_DECORATION_SIDES],
    accentEnabled: false,
    accentSide: 'left',
    accentColor: template.style.accentColor,
    accentWidthPt: Math.max(2, template.style.lineWidthPt * 4),
    paddingPt: 0
  };
}

function semanticOrderDocumentDecoration(
  template: OrderDocumentTemplate,
  target: OrderDocumentDecorationTarget
): OrderDocumentDecoration {
  const base = neutralOrderDocumentDecoration(template);
  if (target.kind === 'element' && target.elementId === 'intro') {
    return {
      ...base,
      accentEnabled: true,
      accentSide: 'left',
      paddingPt: 10
    };
  }
  if (
    target.kind === 'field_row'
    && target.group === 'totals'
    && target.rowId === 'total'
  ) {
    return {
      ...base,
      outlineEnabled: true,
      outlineColor: template.style.accentColor,
      outlineWidthPt: Math.max(0.5, template.style.lineWidthPt)
    };
  }
  return base;
}

export function getOrderDocumentDecorationOverride(
  template: OrderDocumentTemplate,
  target: OrderDocumentDecorationTarget
): OrderDocumentDecorationOverride | undefined {
  const value = target.kind === 'element'
    ? template.layout.canvas?.elements[target.elementId]?.decoration
    : resolveOrderDocumentFieldRows(template, target.group)
      .find((row) => row.id === target.rowId)?.decoration;
  const normalized = normalizeOrderDocumentDecorationOverride(value);
  return normalized ? clone(normalized) : undefined;
}

export function resolveOrderDocumentDecoration(
  template: OrderDocumentTemplate,
  target: OrderDocumentDecorationTarget
): OrderDocumentDecoration {
  const semantic = semanticOrderDocumentDecoration(template, target);
  if (target.kind === 'element') {
    const element = resolveOrderDocumentCanvasElement(template, target.elementId);
    const override = getOrderDocumentDecorationOverride(template, target);
    const legacy: OrderDocumentDecorationOverride = {
      ...(element.backgroundColor
        ? { fillEnabled: true, fillColor: element.backgroundColor }
        : {}),
      ...(element.borderColor
        ? {
            outlineEnabled: true,
            outlineColor: element.borderColor,
            outlineWidthPt: template.style.lineWidthPt,
            outlineSides: [...ALL_DECORATION_SIDES]
          }
        : {}),
      ...(element.accentColor ? { accentColor: element.accentColor } : {})
    };
    return {
      ...semantic,
      ...legacy,
      ...override,
      outlineSides: override?.outlineSides
        ?? legacy.outlineSides
        ?? semantic.outlineSides
    };
  }
  const parentElement = template.layout.canvas?.elements[target.group];
  const parentOverride = getOrderDocumentDecorationOverride(template, {
    kind: 'element',
    elementId: target.group
  });
  const inheritedColors: OrderDocumentDecorationOverride = {
    ...(parentElement?.backgroundColor
      ? { fillColor: parentElement.backgroundColor }
      : {}),
    ...(parentElement?.borderColor
      ? { outlineColor: parentElement.borderColor }
      : {}),
    ...(parentElement?.accentColor
      ? { accentColor: parentElement.accentColor }
      : {}),
    ...(parentOverride?.fillColor ? { fillColor: parentOverride.fillColor } : {}),
    ...(parentOverride?.outlineColor ? { outlineColor: parentOverride.outlineColor } : {}),
    ...(parentOverride?.accentColor ? { accentColor: parentOverride.accentColor } : {})
  };
  const override = getOrderDocumentDecorationOverride(template, target);
  return {
    ...semantic,
    ...inheritedColors,
    ...override,
    outlineSides: override?.outlineSides ?? semantic.outlineSides
  };
}

/** Returns the effective symmetric inset for an already-resolved decoration. */
export function resolveOrderDocumentDecorationInset(
  decoration: OrderDocumentDecoration
) {
  return decoration.paddingPt + (
    hasOrderDocumentBoxDecoration(decoration)
      ? ORDER_DOCUMENT_DECORATED_TEXT_INSET_PT
      : 0
  );
}

/** Returns the authoritative symmetric text inset for editor and PDF parity. */
export function resolveOrderDocumentDecorationContentInset(
  template: OrderDocumentTemplate,
  target: OrderDocumentDecorationTarget
) {
  return resolveOrderDocumentDecorationInset(
    resolveOrderDocumentDecoration(template, target)
  );
}

function writeOrderDocumentDecorationOverride(
  template: OrderDocumentTemplate,
  target: OrderDocumentDecorationTarget,
  decoration: OrderDocumentDecorationOverride | undefined
): OrderDocumentTemplate {
  if (target.kind === 'element') {
    if (isOrderDocumentCanvasElementDirectlyDeleted(template, target.elementId)) {
      return template;
    }
    const canvas = template.layout.canvas ?? DEFAULT_ORDER_DOCUMENT_TEMPLATE_CANVAS;
    const element = template.layout.canvas?.elements[target.elementId]
      ?? resolveOrderDocumentCanvasElement(template, target.elementId);
    const nextElement = { ...element, decoration };
    if (!decoration) delete nextElement.decoration;
    return {
      ...template,
      layout: {
        ...template.layout,
        canvas: {
          ...clone(canvas),
          elements: {
            ...clone(canvas.elements),
            [target.elementId]: nextElement
          }
        }
      }
    };
  }
  return setOrderDocumentFieldRows(
    template,
    target.group,
    resolveOrderDocumentFieldRows(template, target.group).map((row) => {
      if (row.id !== target.rowId) return row;
      const nextRow = { ...row, decoration };
      if (!decoration) delete nextRow.decoration;
      return nextRow;
    })
  );
}

export function setOrderDocumentDecoration(
  template: OrderDocumentTemplate,
  target: OrderDocumentDecorationTarget,
  patch: OrderDocumentDecorationOverride
): OrderDocumentTemplate {
  const normalizedPatch = normalizeOrderDocumentDecorationOverride(patch);
  if (!normalizedPatch) return template;
  const decoration = normalizeOrderDocumentDecorationOverride({
    ...getOrderDocumentDecorationOverride(template, target),
    ...normalizedPatch
  });
  return writeOrderDocumentDecorationOverride(template, target, decoration);
}

export function resetOrderDocumentDecoration(
  template: OrderDocumentTemplate,
  target: OrderDocumentDecorationTarget
): OrderDocumentTemplate {
  if (!getOrderDocumentDecorationOverride(template, target)) return template;
  return writeOrderDocumentDecorationOverride(template, target, undefined);
}

export function cloneDefaultOrderDocumentTemplatesConfig(): OrderDocumentTemplatesConfig {
  return clone(DEFAULT_ORDER_DOCUMENT_TEMPLATES_CONFIG);
}

export function cloneDefaultOrderDocumentTemplate(
  type: OrderDocumentTemplateType
): OrderDocumentTemplate {
  return clone(DEFAULT_ORDER_DOCUMENT_TEMPLATES_CONFIG.templates[type]);
}

export function normalizeOrderDocumentTemplate(
  type: OrderDocumentTemplateType,
  value: unknown
): OrderDocumentTemplate {
  const fallback = DEFAULT_ORDER_DOCUMENT_TEMPLATES_CONFIG.templates[type];
  const record = asRecord(value);
  const rules = asRecord(record.rules);
  const style = normalizeStyle(record.style, fallback.style);
  return {
    type,
    name: asString(record.name, fallback.name, 120),
    style,
    company: normalizeCompany(record.company, fallback.company),
    text: normalizeText(record.text, fallback.text),
    layout: normalizeLayout(record.layout, fallback.layout, style, type),
    rules: {
      dueDays: asNumber(rules.dueDays, fallback.rules.dueDays, 0, 365),
      validityDays: asNumber(rules.validityDays, fallback.rules.validityDays, 0, 365)
    }
  };
}

export function normalizeOrderDocumentTemplatesConfig(value: unknown): OrderDocumentTemplatesConfig {
  const record = asRecord(value);
  const templates = asRecord(record.templates);
  return {
    templates: Object.fromEntries(
      ORDER_DOCUMENT_TEMPLATE_TYPES.map((type) => [
        type,
        normalizeOrderDocumentTemplate(type, templates[type])
      ])
    ) as Record<OrderDocumentTemplateType, OrderDocumentTemplate>,
    updatedAt:
      typeof record.updatedAt === 'string'
        ? record.updatedAt
        : typeof record.updated_at === 'string'
          ? record.updated_at
          : null
  };
}

export function toStoredOrderDocumentTemplatesConfig(value: unknown): OrderDocumentTemplatesConfig {
  const normalized = normalizeOrderDocumentTemplatesConfig(value);
  const { updatedAt: _updatedAt, ...stored } = normalized;
  return stored;
}

const hasOwn = (record: UnknownRecord, key: string) =>
  Object.prototype.hasOwnProperty.call(record, key);
const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);
const isOptionalHexColor = (value: unknown) =>
  typeof value === 'string' && (value === '' || /^#[0-9A-F]{6}$/iu.test(value));

function validateTypographyOverrideInput(
  owner: UnknownRecord,
  path: string,
  errors: string[],
  property: string = 'typography'
) {
  if (!hasOwn(owner, property)) return;
  const value = owner[property];
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    errors.push(`Tipografija ${path} ni veljaven predmet.`);
    return;
  }
  const typography = asRecord(value);
  if (hasOwn(typography, 'fontFamily') && !ORDER_DOCUMENT_FONT_FAMILY_IDS.includes(
    typography.fontFamily as OrderDocumentFontFamilyId
  )) {
    errors.push(`Družina pisave ${path} ni podprta.`);
  }
  if (hasOwn(typography, 'fontWeight') && !ORDER_DOCUMENT_FONT_WEIGHT_IDS.includes(
    typography.fontWeight as OrderDocumentFontWeightId
  )) {
    errors.push(`Debelina pisave ${path} ni podprta.`);
  }
  if (hasOwn(typography, 'fontStyle') && !ORDER_DOCUMENT_FONT_STYLE_IDS.includes(
    typography.fontStyle as OrderDocumentFontStyleId
  )) {
    errors.push(`Slog pisave ${path} ni podprt.`);
  }
  if (hasOwn(typography, 'fontSizePt')) {
    const size = typography.fontSizePt;
    const isStepped = isFiniteNumber(size)
      && Math.abs(size / ORDER_DOCUMENT_FONT_SIZE_STEP_PT
        - Math.round(size / ORDER_DOCUMENT_FONT_SIZE_STEP_PT)) < 0.0001;
    if (
      !isStepped
      || (size as number) < ORDER_DOCUMENT_FONT_SIZE_MIN_PT
      || (size as number) > ORDER_DOCUMENT_FONT_SIZE_MAX_PT
    ) {
      errors.push(`Velikost pisave ${path} ni veljavna.`);
    }
  }
}

function validateTextAlignmentInput(
  owner: UnknownRecord,
  path: string,
  errors: string[],
  property: string = 'textAlign'
) {
  if (!hasOwn(owner, property)) return;
  if (!ORDER_DOCUMENT_TEXT_ALIGNMENTS.includes(
    owner[property] as OrderDocumentTextAlignment
  )) {
    errors.push(`Vodoravna poravnava ${path} ni podprta.`);
  }
}

function validateDecorationOverrideInput(
  owner: UnknownRecord,
  path: string,
  errors: string[]
) {
  if (!hasOwn(owner, 'decoration')) return;
  const value = owner.decoration;
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    errors.push(`Dekoracija ${path} ni veljaven predmet.`);
    return;
  }
  const decoration = asRecord(value);
  for (const key of ['fillEnabled', 'outlineEnabled', 'accentEnabled'] as const) {
    if (hasOwn(decoration, key) && typeof decoration[key] !== 'boolean') {
      errors.push(`Nastavitev dekoracije ${path}.${key} ni logična vrednost.`);
    }
  }
  for (const key of ['fillColor', 'outlineColor', 'accentColor'] as const) {
    if (
      hasOwn(decoration, key)
      && (typeof decoration[key] !== 'string' || !/^#[0-9A-F]{6}$/iu.test(decoration[key] as string))
    ) {
      errors.push(`Barva dekoracije ${path}.${key} ni veljavna.`);
    }
  }
  if (
    hasOwn(decoration, 'accentSide')
    && !ORDER_DOCUMENT_DECORATION_SIDES.includes(
      decoration.accentSide as OrderDocumentDecorationSide
    )
  ) {
    errors.push(`Stran poudarka ${path} ni veljavna.`);
  }
  if (hasOwn(decoration, 'outlineSides')) {
    if (
      !Array.isArray(decoration.outlineSides)
      || decoration.outlineSides.some((side) =>
        !ORDER_DOCUMENT_DECORATION_SIDES.includes(side as OrderDocumentDecorationSide)
      )
      || new Set(decoration.outlineSides).size !== decoration.outlineSides.length
    ) {
      errors.push(`Strani obrobe ${path} niso veljavne.`);
    }
  }
  const numeric = [
    ['outlineWidthPt', 0.25, 12],
    ['accentWidthPt', 0.25, 24],
    ['paddingPt', 0, 36]
  ] as const;
  for (const [key, min, max] of numeric) {
    if (
      hasOwn(decoration, key)
      && (!isFiniteNumber(decoration[key]) || decoration[key] < min || decoration[key] > max)
    ) {
      errors.push(`Mera dekoracije ${path}.${key} ni veljavna.`);
    }
  }
}

function validateFieldRowPlacementInput(
  row: UnknownRecord,
  path: string,
  errors: string[]
) {
  if (!hasOwn(row, 'placement')) return;
  const value = row.placement;
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    errors.push(`Položaj ${path} ni veljaven predmet.`);
    return;
  }
  const placement = asRecord(value);
  const limits = [
    ['xMm', -A4_WIDTH_MM, A4_WIDTH_MM],
    ['yMm', -A4_HEIGHT_MM, A4_HEIGHT_MM],
    ['widthMm', 2, A4_WIDTH_MM],
    ['heightMm', 2, A4_HEIGHT_MM]
  ] as const;
  for (const [key, min, max] of limits) {
    if (
      hasOwn(placement, key)
      && (!isFiniteNumber(placement[key]) || placement[key] < min || placement[key] > max)
    ) {
      errors.push(`Mera položaja ${path}.${key} ni veljavna.`);
    }
  }
}

function validateCompanyContactsInput(
  type: OrderDocumentTemplateType,
  company: UnknownRecord,
  errors: string[]
) {
  if (!hasOwn(company, 'contacts')) return;
  if (!Array.isArray(company.contacts)) {
    errors.push('Kontaktni podatki podjetja za ' + type + ' niso seznam.');
    return;
  }
  if (company.contacts.length > ORDER_DOCUMENT_COMPANY_CONTACT_LIMIT) {
    errors.push(
      'Kontaktni podatki podjetja za ' + type + ' lahko vsebujejo največ '
      + ORDER_DOCUMENT_COMPANY_CONTACT_LIMIT + ' vnosov.'
    );
  }

  const seen = new Set<string>();
  for (const rawContact of company.contacts.slice(
    0,
    ORDER_DOCUMENT_COMPANY_CONTACT_LIMIT + 1
  )) {
    if (!rawContact || typeof rawContact !== 'object' || Array.isArray(rawContact)) {
      errors.push('Kontaktni podatek podjetja za ' + type + ' ni veljaven predmet.');
      continue;
    }
    const contact = asRecord(rawContact);
    if (typeof contact.id !== 'string' || !CONTACT_ID_PATTERN.test(contact.id)) {
      errors.push('ID kontaktnega podatka podjetja za ' + type + ' ni veljaven.');
    } else if (seen.has(contact.id)) {
      errors.push(
        'ID kontaktnega podatka podjetja ' + type + '.' + contact.id + ' je podvojen.'
      );
    } else {
      seen.add(contact.id);
    }
    if (typeof contact.label !== 'string' || contact.label.length > 80) {
      errors.push('Oznaka kontaktnega podatka podjetja za ' + type + ' ni veljavna.');
    }
    if (typeof contact.value !== 'string' || contact.value.length > 300) {
      errors.push('Vrednost kontaktnega podatka podjetja za ' + type + ' ni veljavna.');
    }
    if (typeof contact.visible !== 'boolean') {
      errors.push('Vidnost kontaktnega podatka podjetja za ' + type + ' ni veljavna.');
    }
    if (typeof contact.emphasis !== 'boolean') {
      errors.push('Poudarek kontaktnega podatka podjetja za ' + type + ' ni veljaven.');
    }
    validateTypographyOverrideInput(
      contact,
      `${type}.company.contacts.${String(contact.id)}`,
      errors
    );
    validateTextAlignmentInput(
      contact,
      `${type}.company.contacts.${String(contact.id)}`,
      errors
    );
  }
}

function validateCanvasInput(
  type: OrderDocumentTemplateType,
  layout: UnknownRecord,
  errors: string[]
) {
  if (!hasOwn(layout, 'canvas')) return;
  const value = layout.canvas;
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    errors.push(`Platno za ${type} ni veljaven predmet.`);
    return;
  }
  const canvas = asRecord(value);
  if (
    hasOwn(canvas, 'flowLayoutVersion')
    && canvas.flowLayoutVersion !== ORDER_DOCUMENT_CANVAS_FLOW_LAYOUT_VERSION
  ) {
    errors.push(`Različica toka platna za ${type} ni podprta.`);
  }
  if (hasOwn(canvas, 'gridSizeMm') && (
    !isFiniteNumber(canvas.gridSizeMm)
    || canvas.gridSizeMm < 0.5
    || canvas.gridSizeMm > 20
  )) {
    errors.push(`Velikost mreže za ${type} ni veljavna.`);
  }
  for (const key of ['snapToGrid', 'snapToElements', 'showGrid', 'showGuides', 'showRulers']) {
    if (hasOwn(canvas, key) && typeof canvas[key] !== 'boolean') {
      errors.push(`Nastavitev platna ${type}.${key} ni logična vrednost.`);
    }
  }

  const deletedElementIds = new Set<OrderDocumentCanvasElementId>();
  if (hasOwn(canvas, 'deletedElementIds')) {
    if (!Array.isArray(canvas.deletedElementIds)) {
      errors.push(`Izbrisani elementi platna za ${type} niso seznam.`);
    } else {
      for (const rawId of canvas.deletedElementIds) {
        if (!ORDER_DOCUMENT_CANVAS_ELEMENT_IDS.includes(rawId as OrderDocumentCanvasElementId)) {
          errors.push(`Izbrisani element platna ${type}.${String(rawId)} ni podprt.`);
          continue;
        }
        const id = rawId as OrderDocumentCanvasElementId;
        if (deletedElementIds.has(id)) {
          errors.push(`Izbrisani element platna ${type}.${id} je podvojen.`);
        }
        deletedElementIds.add(id);
      }
    }
  }

  if (!canvas.elements || typeof canvas.elements !== 'object' || Array.isArray(canvas.elements)) {
    errors.push(`Elementi platna za ${type} niso veljaven predmet.`);
    return;
  }
  const repeatableIds = new Set<OrderDocumentCanvasElementId>([
    'header',
    'logo',
    'company',
    'footer'
  ]);
  for (const [rawId, rawElement] of Object.entries(asRecord(canvas.elements))) {
    if (!ORDER_DOCUMENT_CANVAS_ELEMENT_IDS.includes(rawId as OrderDocumentCanvasElementId)) {
      errors.push(`Element platna ${type}.${rawId} ni podprt.`);
      continue;
    }
    const id = rawId as OrderDocumentCanvasElementId;
    if (deletedElementIds.has(id)) {
      errors.push(`Izbrisani element platna ${type}.${id} ne sme imeti shranjene postavitve.`);
    }
    if (!rawElement || typeof rawElement !== 'object' || Array.isArray(rawElement)) {
      errors.push(`Element platna ${type}.${id} ni veljaven predmet.`);
      continue;
    }
    const element = asRecord(rawElement);
    if (element.id !== id) {
      errors.push(`ID elementa platna ${type}.${id} se ne ujema s ključem.`);
    }
    if (!ORDER_DOCUMENT_CANVAS_POSITIONING_MODES.includes(
      element.positioning as OrderDocumentCanvasPositioning
    )) {
      errors.push(`Način postavitve elementa ${type}.${id} ni veljaven.`);
    }
    if (!ORDER_DOCUMENT_CANVAS_CONDITIONS.includes(
      element.condition as OrderDocumentCanvasCondition
    )) {
      errors.push(`Pogoj elementa ${type}.${id} ni veljaven.`);
    }
    if (!ORDER_DOCUMENT_CANVAS_OVERFLOW_MODES.includes(
      element.overflow as OrderDocumentCanvasOverflow
    )) {
      errors.push(`Prelivanje elementa ${type}.${id} ni veljavno.`);
    }
    if (!ORDER_DOCUMENT_CANVAS_REPEAT_MODES.includes(
      element.repeat as OrderDocumentCanvasRepeat
    )) {
      errors.push(`Ponavljanje elementa ${type}.${id} ni veljavno.`);
    } else if (element.repeat === 'every_page' && !repeatableIds.has(id)) {
      errors.push(`Element ${type}.${id} se ne sme ponavljati na vsaki strani.`);
    }
    if (typeof element.visible !== 'boolean' || typeof element.locked !== 'boolean') {
      errors.push(`Vidnost ali zaklep elementa ${type}.${id} ni veljaven.`);
    }

    const geometry = ['xMm', 'yMm', 'widthMm', 'heightMm'] as const;
    if (geometry.some((key) => !isFiniteNumber(element[key]))) {
      errors.push(`Mere elementa ${type}.${id} niso končne številke.`);
    } else {
      const xMm = element.xMm as number;
      const yMm = element.yMm as number;
      const widthMm = element.widthMm as number;
      const heightMm = element.heightMm as number;
      if (
        xMm < 0
        || yMm < 0
        || widthMm < 5
        || heightMm < 5
        || xMm + widthMm > A4_WIDTH_MM
        || yMm + heightMm > A4_HEIGHT_MM
      ) {
        errors.push(`Element ${type}.${id} sega izven strani A4.`);
      }
    }
    if (
      !isFiniteNumber(element.page)
      || !Number.isInteger(element.page)
      || element.page < 1
      || element.page > 50
    ) {
      errors.push(`Stran elementa ${type}.${id} ni veljavna.`);
    }
    if (
      !isFiniteNumber(element.zIndex)
      || !Number.isInteger(element.zIndex)
      || element.zIndex < -100
      || element.zIndex > 1000
    ) {
      errors.push(`Sloj elementa ${type}.${id} ni veljaven.`);
    }
    for (const colorKey of [
      'textColor',
      'mutedTextColor',
      'backgroundColor',
      'borderColor',
      'accentColor'
    ] as const) {
      if (hasOwn(element, colorKey) && !isOptionalHexColor(element[colorKey])) {
        errors.push(`Barva ${type}.${id}.${colorKey} ni veljavna.`);
      }
    }
    validateTypographyOverrideInput(element, `${type}.canvas.${id}`, errors);
    validateTextAlignmentInput(element, `${type}.canvas.${id}`, errors);
    validateDecorationOverrideInput(element, `${type}.canvas.${id}`, errors);
  }
}

function validateTableInput(
  type: OrderDocumentTemplateType,
  layout: UnknownRecord,
  errors: string[]
) {
  if (!hasOwn(layout, 'table')) return;
  const value = layout.table;
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    errors.push(`Tabela izdelkov za ${type} ni veljaven predmet.`);
    return;
  }
  const table = asRecord(value);
  if (!Array.isArray(table.columns)) {
    errors.push(`Stolpci tabele izdelkov za ${type} manjkajo.`);
  } else {
    const seen = new Set<OrderDocumentTableColumnId>();
    let identifyingColumnVisible = false;
    for (const rawColumn of table.columns) {
      if (!rawColumn || typeof rawColumn !== 'object' || Array.isArray(rawColumn)) {
        errors.push(`Stolpec tabele izdelkov za ${type} ni veljaven predmet.`);
        continue;
      }
      const column = asRecord(rawColumn);
      if (!ORDER_DOCUMENT_TABLE_COLUMN_IDS.includes(column.id as OrderDocumentTableColumnId)) {
        errors.push(`Stolpec tabele izdelkov ${type}.${String(column.id)} ni podprt.`);
        continue;
      }
      const id = column.id as OrderDocumentTableColumnId;
      if (seen.has(id)) {
        errors.push(`Stolpec tabele izdelkov ${type}.${id} je podvojen.`);
        continue;
      }
      seen.add(id);
      if (typeof column.visible !== 'boolean') {
        errors.push(`Vidnost stolpca ${type}.${id} ni veljavna.`);
      }
      if (
        !isFiniteNumber(column.widthRatio)
        || column.widthRatio < 1
        || column.widthRatio > 100
      ) {
        errors.push(`Širina stolpca ${type}.${id} ni veljavna.`);
      }
      if ((id === 'sku' || id === 'description') && column.visible === true) {
        identifyingColumnVisible = true;
      }
      validateTypographyOverrideInput(column, `${type}.table.columns.${id}`, errors);
      validateTextAlignmentInput(column, `${type}.table.columns.${id}`, errors);
      validateTypographyOverrideInput(
        column,
        `${type}.table.headerCells.${id}`,
        errors,
        'headerTypography'
      );
      validateTextAlignmentInput(
        column,
        `${type}.table.headerCells.${id}`,
        errors,
        'headerTextAlign'
      );
    }
    for (const id of ORDER_DOCUMENT_TABLE_COLUMN_IDS) {
      if (!seen.has(id)) {
        errors.push(`Stolpec tabele izdelkov ${type}.${id} manjka; skrijte ga z visible=false.`);
      }
    }
    if (!identifyingColumnVisible) {
      errors.push(`Tabela izdelkov za ${type} mora prikazati SKU ali Naziv.`);
    }
  }

  const numericSettings = [
    ['headerHeightPt', 8, 80],
    ['rowHeightPt', 8, 120],
    ['rowGapPt', 0, 30]
  ] as const;
  for (const [key, min, max] of numericSettings) {
    if (!isFiniteNumber(table[key]) || table[key] < min || table[key] > max) {
      errors.push(`Nastavitev tabele ${type}.${key} ni veljavna.`);
    }
  }

  if (hasOwn(table, 'borders')) {
    const value = table.borders;
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      errors.push(`Obrobe tabele izdelkov za ${type} niso veljaven predmet.`);
    } else {
      const borders = asRecord(value);
      for (const key of ['outer', 'horizontal', 'vertical'] as const) {
        if (hasOwn(borders, key) && typeof borders[key] !== 'boolean') {
          errors.push(`Nastavitev obrobe tabele ${type}.${key} ni veljavna.`);
        }
      }
      if (hasOwn(borders, 'color') && !isOptionalHexColor(borders.color)) {
        errors.push(`Barva obrobe tabele ${type} ni veljavna.`);
      }
      if (hasOwn(borders, 'widthPt') && (
        !isFiniteNumber(borders.widthPt)
        || borders.widthPt < 0.25
        || borders.widthPt > 12
      )) {
        errors.push(`Debelina obrobe tabele ${type} ni veljavna.`);
      }
    }
  }

  validateTypographyOverrideInput(
    table,
    `${type}.table.header`,
    errors,
    'headerTypography'
  );
  validateTextAlignmentInput(table, `${type}.table.header`, errors, 'headerTextAlign');
  validateTypographyOverrideInput(
    table,
    `${type}.table.body`,
    errors,
    'bodyTypography'
  );
  validateTextAlignmentInput(table, `${type}.table.body`, errors, 'bodyTextAlign');

  if (!Array.isArray(table.rowHeightOverrides)) {
    errors.push(`Prilagoditve višin vrstic za ${type} manjkajo.`);
    return;
  }
  const seenRows = new Set<number>();
  for (const rawOverride of table.rowHeightOverrides) {
    if (!rawOverride || typeof rawOverride !== 'object' || Array.isArray(rawOverride)) {
      errors.push(`Prilagoditev višine vrstice za ${type} ni veljavna.`);
      continue;
    }
    const override = asRecord(rawOverride);
    if (
      !isFiniteNumber(override.rowNumber)
      || !Number.isInteger(override.rowNumber)
      || override.rowNumber < 1
      || override.rowNumber > 5000
    ) {
      errors.push(`Številka prilagojene vrstice za ${type} ni veljavna.`);
      continue;
    }
    if (seenRows.has(override.rowNumber)) {
      errors.push(`Višina vrstice ${type}.${override.rowNumber} je podvojena.`);
    }
    seenRows.add(override.rowNumber);
    if (hasOwn(override, 'heightPt') && (
      !isFiniteNumber(override.heightPt)
      || override.heightPt < 8
      || override.heightPt > 200
    )) {
      errors.push(`Višina vrstice ${type}.${override.rowNumber} ni veljavna.`);
    }
    validateTypographyOverrideInput(
      override,
      `${type}.table.rows.${String(override.rowNumber)}`,
      errors
    );
    validateTextAlignmentInput(
      override,
      `${type}.table.rows.${String(override.rowNumber)}`,
      errors
    );
    if (
      !hasOwn(override, 'heightPt')
      && !hasOwn(override, 'typography')
      && !hasOwn(override, 'textAlign')
    ) {
      errors.push(`Prilagoditev vrstice ${type}.${override.rowNumber} je prazna.`);
    }
  }

  if (hasOwn(table, 'cellTypographyOverrides')) {
    if (!Array.isArray(table.cellTypographyOverrides)) {
      errors.push(`Tipografija celic tabele izdelkov za ${type} ni veljaven seznam.`);
      return;
    }
    const seenCells = new Set<string>();
    for (const rawCell of table.cellTypographyOverrides) {
      if (!rawCell || typeof rawCell !== 'object' || Array.isArray(rawCell)) {
        errors.push(`Tipografija celice tabele izdelkov za ${type} ni veljaven predmet.`);
        continue;
      }
      const cell = asRecord(rawCell);
      if (
        !isFiniteNumber(cell.rowNumber)
        || !Number.isInteger(cell.rowNumber)
        || cell.rowNumber < 1
        || cell.rowNumber > 5000
      ) {
        errors.push(`Stevilka vrstice celice tabele izdelkov za ${type} ni veljavna.`);
        continue;
      }
      if (!ORDER_DOCUMENT_TABLE_COLUMN_IDS.includes(
        cell.columnId as OrderDocumentTableColumnId
      )) {
        errors.push(`Stolpec celice tabele izdelkov za ${type} ni podprt.`);
        continue;
      }
      const identity = `${cell.rowNumber}:${String(cell.columnId)}`;
      if (seenCells.has(identity)) {
        errors.push(`Tipografija celice tabele izdelkov ${type}.${identity} je podvojena.`);
      }
      seenCells.add(identity);
      if (!hasOwn(cell, 'typography') && !hasOwn(cell, 'textAlign')) {
        errors.push(`Slog celice tabele izdelkov ${type}.${identity} manjka.`);
        continue;
      }
      if (hasOwn(cell, 'typography')) {
        validateTypographyOverrideInput(
          cell,
          `${type}.table.cells.${identity}`,
          errors
        );
      }
      validateTextAlignmentInput(cell, `${type}.table.cells.${identity}`, errors);
    }
  }
}

function validateFieldRowsInput(
  type: OrderDocumentTemplateType,
  layout: UnknownRecord,
  errors: string[]
) {
  if (!hasOwn(layout, 'fieldRows')) return;
  const value = layout.fieldRows;
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    errors.push(`Vrstice elementov za ${type} niso veljaven predmet.`);
    return;
  }
  const groups = asRecord(value);
  for (const rawGroup of Object.keys(groups)) {
    if (!ORDER_DOCUMENT_FIELD_GROUP_IDS.includes(rawGroup as OrderDocumentFieldGroupId)) {
      errors.push(`Skupina vrstic ${type}.${rawGroup} ni podprta.`);
      continue;
    }
    const group = rawGroup as OrderDocumentFieldGroupId;
    const rows = groups[group];
    if (!Array.isArray(rows)) {
      errors.push(`Vrstice elementa ${type}.${group} niso seznam.`);
      continue;
    }
    const allowed = new Set<string>(ORDER_DOCUMENT_FIELD_ROW_IDS_BY_GROUP[group]);
    const seen = new Set<string>();
    for (const rawRow of rows) {
      if (!rawRow || typeof rawRow !== 'object' || Array.isArray(rawRow)) {
        errors.push(`Vrstica elementa ${type}.${group} ni veljaven predmet.`);
        continue;
      }
      const row = asRecord(rawRow);
      if (typeof row.id !== 'string' || !allowed.has(row.id)) {
        errors.push(`Vrstica elementa ${type}.${group}.${String(row.id)} ni podprta.`);
        continue;
      }
      if (seen.has(row.id)) {
        errors.push(`Vrstica elementa ${type}.${group}.${row.id} je podvojena.`);
      }
      seen.add(row.id);
      if (typeof row.visible !== 'boolean') {
        errors.push(`Vidnost vrstice ${type}.${group}.${row.id} ni veljavna.`);
      }
      validateTypographyOverrideInput(row, `${type}.fieldRows.${group}.${row.id}`, errors);
      validateTextAlignmentInput(row, `${type}.fieldRows.${group}.${row.id}`, errors);
      validateFieldRowPlacementInput(row, `${type}.fieldRows.${group}.${row.id}`, errors);
      validateDecorationOverrideInput(row, `${type}.fieldRows.${group}.${row.id}`, errors);
    }
  }
}

export function validateOrderDocumentTemplatesInput(value: unknown): string[] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return ['Nastavitve predlog PDF niso veljavne.'];
  }
  const record = asRecord(value);
  const templates = asRecord(record.templates);
  const errors: string[] = [];

  for (const type of ORDER_DOCUMENT_TEMPLATE_TYPES) {
    const template = asRecord(templates[type]);
    if (Object.keys(template).length === 0) {
      errors.push(`Predloga ${type} manjka.`);
      continue;
    }
    for (const group of ['style', 'company', 'text', 'layout', 'rules'] as const) {
      if (Object.keys(asRecord(template[group])).length === 0) {
        errors.push(`Skupina ${type}.${group} manjka.`);
      }
    }
    const company = asRecord(template.company);
    validateCompanyContactsInput(type, company, errors);
    const layout = asRecord(template.layout);
    if (!Array.isArray(layout.sections)) {
      errors.push(`Vrstni red elementov za ${type} manjka.`);
    }
    validateCanvasInput(type, layout, errors);
    validateTableInput(type, layout, errors);
    validateFieldRowsInput(type, layout, errors);
  }

  return errors;
}

export function resolveOrderDocumentTemplateText(
  value: string,
  template: OrderDocumentTemplate,
  replacements: Record<string, string | number | null | undefined> = {}
) {
  const { contacts: _contacts, ...companyTokens } = template.company;
  const source: Record<string, string | number | null | undefined> = {
    ...companyTokens,
    ...template.rules,
    ...replacements
  };
  return value.replace(/\{([a-zA-Z][a-zA-Z0-9]*)\}/gu, (match, key: string) => {
    const replacement = source[key];
    return replacement === null || replacement === undefined ? match : String(replacement);
  });
}
