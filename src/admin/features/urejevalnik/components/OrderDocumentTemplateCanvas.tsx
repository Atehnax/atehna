'use client';

import {
  createContext,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type RefObject
} from 'react';
import { createPortal } from 'react-dom';
import {
  AlignJustify,
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowDown,
  ArrowUp,
  Bold,
  Check,
  ChevronDown,
  Eye,
  EyeOff,
  Grid3X3,
  Layers3,
  Lock,
  Magnet,
  Move,
  Palette,
  Plus,
  Ruler,
  RotateCcw,
  Settings2,
  SlidersHorizontal,
  Trash2,
  Type,
  X,
  Unlock
} from 'lucide-react';
import Image from 'next/image';
import {
  ORDER_DOCUMENT_COMPANY_CONTACT_LIMIT,
  ORDER_DOCUMENT_CANVAS_ELEMENT_IDS,
  ORDER_DOCUMENT_DECORATION_SIDES,
  ORDER_DOCUMENT_FIELD_ROW_IDS_BY_GROUP,
  ORDER_DOCUMENT_FONT_FAMILY_CATALOG,
  ORDER_DOCUMENT_FONT_SIZE_MAX_PT,
  ORDER_DOCUMENT_FONT_SIZE_MIN_PT,
  ORDER_DOCUMENT_FONT_SIZE_STEP_PT,
  ORDER_DOCUMENT_FONT_STYLE_IDS,
  ORDER_DOCUMENT_FONT_WEIGHT_IDS,
  ORDER_DOCUMENT_FONT_WEIGHT_VALUES,
  createOrderDocumentCompanyContactId,
  deleteOrderDocumentCanvasElement,
  getOrderDocumentDecorationOverride,
  getOrderDocumentTextAlignmentOverride,
  getOrderDocumentTypographyOverride,
  isOrderDocumentCanvasElementDeleted,
  materializeOrderDocumentCanvasElement,
  removeOrderDocumentFieldRow,
  resolveOrderDocumentCanvas,
  resolveOrderDocumentCompanyContacts,
  resolveOrderDocumentDecoration,
  resolveOrderDocumentDecorationContentInset,
  resolveOrderDocumentFieldRows,
  resolveOrderDocumentTable,
  resolveOrderDocumentTableBorders,
  resolveOrderDocumentTextAlignment,
  resolveOrderDocumentTypography,
  resolveSupportedOrderDocumentTypography,
  resetOrderDocumentDecoration,
  resetOrderDocumentFieldRowPlacement,
  resetOrderDocumentTextAlignment,
  resetOrderDocumentTypography,
  resolveOrderDocumentDeletedCanvasElementIds,
  restoreOrderDocumentCanvasElement,
  restoreOrderDocumentFieldRow,
  setOrderDocumentDecoration,
  setOrderDocumentCompanyContacts,
  setOrderDocumentFieldRowPlacement,
  setOrderDocumentFieldRows,
  setOrderDocumentTextAlignment,
  setOrderDocumentTypography,
  type OrderDocumentCompanyContact,
  type OrderDocumentCanvasElement,
  type OrderDocumentCanvasElementId,
  type OrderDocumentDecorationSide,
  type OrderDocumentDecorationTarget,
  type OrderDocumentFieldGroupId,
  type OrderDocumentFieldRowId,
  type OrderDocumentFieldRowPlacement,
  type OrderDocumentFontStyleId,
  type OrderDocumentFontWeightId,
  type OrderDocumentSectionId,
  type OrderDocumentTableColumnId,
  type OrderDocumentTemplate,
  type OrderDocumentTemplateCompany,
  type OrderDocumentTemplateLabels,
  type OrderDocumentTemplateRules,
  type OrderDocumentTemplateStyle,
  type OrderDocumentTemplateText,
  type OrderDocumentTextAlignment,
  type OrderDocumentResolvedTextAlignment,
  type OrderDocumentTypography,
  type OrderDocumentTypographyTarget
} from '@/shared/domain/order/orderDocumentTemplates';
import {
  createOrderDocumentPreviewContext,
  formatOrderDocumentCurrency,
  matchesOrderDocumentElementCondition,
  resolveOrderDocumentCustomerRows,
  resolveOrderDocumentFooterRows,
  resolveOrderDocumentItemCells,
  resolveOrderDocumentItemSections,
  resolveOrderDocumentMetadataRows,
  resolveOrderDocumentPreviewText,
  resolveOrderDocumentTotalRows,
  shouldRenderOrderDocumentPreviewElement,
  type OrderDocumentPreviewContext
} from '@/shared/domain/order/orderDocumentPreview';
import { resolveOrderDocumentFlowPreviewElements } from '@/shared/domain/order/orderDocumentFlowLayout';
import {
  resolveOrderDocumentCanvasAlignment,
  type OrderDocumentAlignmentGuide
} from '@/admin/features/urejevalnik/lib/orderDocumentCanvasAlignment';
import {
  clampOrderDocumentFieldRowToPage,
  clampOrderDocumentMoveWithDependents,
  clampOrderDocumentRectToPage,
  resolveOrderDocumentFieldRowPageBounds,
  resolveOrderDocumentPointerDragPosition,
  type OrderDocumentRectGeometry
} from '@/admin/features/urejevalnik/lib/orderDocumentDragGeometry';
import {
  cycleOrderDocumentSelectionCandidate,
  resolveOrderDocumentSelectionCandidatesFromHitStack,
  type OrderDocumentSelectionCandidate,
  type OrderDocumentSelectionCandidateKey
} from '@/admin/features/urejevalnik/lib/orderDocumentOverlapSelection';
import {
  hasOrderDocumentDecorationContentFrame,
  resolveOrderDocumentFinancialOpticalEdgeOffsetPx,
  resolveOrderDocumentFinancialPairPreviewStyle,
  resolveOrderDocumentNaturalFinancialFramePreview,
  resolveOrderDocumentDecorationPreviewStyle,
  type OrderDocumentDecorationContentAlignment,
  type OrderDocumentFinancialOpticalEdge
} from '@/admin/features/urejevalnik/lib/orderDocumentDecorationPreview';
import {
  applyOrderDocumentTextAlignmentToTargets,
  applyOrderDocumentTypographyToTargets,
  orderDocumentChildSelection,
  orderDocumentElementSelection,
  reduceOrderDocumentCanvasSelection,
  resetOrderDocumentTextAlignmentTargets,
  resetOrderDocumentTypographyTargets,
  resolveOrderDocumentMixedTextAlignment,
  resolveOrderDocumentMixedTypography,
  resolveOrderDocumentSelectionTypographyTargets,
  type OrderDocumentCanvasChildSelection,
  type OrderDocumentCanvasSelectionEntry,
  type OrderDocumentCompanyTextKey
} from '@/admin/features/urejevalnik/lib/orderDocumentCanvasSelection';
import {
  getSiteLogoPresentationCapabilities,
  resolveSiteLogoMaster,
  resolveSiteLogoPresentation,
  type SiteLogoConfig,
  type SiteLogoPresentation
} from '@/shared/domain/logo/siteLogo';
import { SiteLogo, SiteLogoProvider } from '@/commercial/components/SiteLogo';
import { CompactHexColorField } from '@/shared/ui/admin-controls/CompactHexColorField';
import { SiteLogoTextLayerManager } from '@/admin/features/podoba/components/SiteLogoTextLayerControls';
import AdminCheckbox from '@/shared/ui/checkbox/admin-checkbox';
import { adminEditorSelectionOutlineTokenClasses } from '@/shared/ui/theme/tokens';
import { useDropdownDismiss } from '@/shared/ui/dropdown/use-dropdown-dismiss';
import OrderDocumentTableContextControls from './OrderDocumentTableContextControls';
import OrderDocumentTableQuickStyleControls, {
  type OrderDocumentTableQuickStyleScope
} from './OrderDocumentTableQuickStyleControls';
import {
  AppearanceEditorAlignmentControl,
  AppearanceEditorCompactSelect,
  AppearanceEditorToolbarButton,
  AppearanceEditorToolbarDivider,
  AppearanceEditorToolbarToneProvider,
  FloatingAppearanceEditorContextToolbar
} from '@/admin/features/podoba/components/AppearanceEditorToolbarPrimitives';
import { createOrderDocumentInspectorSnapshot } from '@/admin/features/urejevalnik/lib/orderDocumentInspectorSession';

const A4_WIDTH_MM = 210;
const A4_HEIGHT_MM = 297;
const MIN_ELEMENT_SIZE_MM = 5;
const DRAG_START_THRESHOLD_PX = 3;
const ORDER_DOCUMENT_NESTED_POPOVER_SELECTOR =
  '[data-admin-color-palette-portal], [data-order-document-dark-select-portal], [data-appearance-editor-compact-select-portal]';
const ORDER_DOCUMENT_CANVAS_POPOVER_ROOT_SELECTOR =
  '[data-order-document-canvas-popover-root]';
const ORDER_DOCUMENT_CONTEXT_POPOVER_SELECTOR =
  '[data-order-document-toolbar-popover]';
const ORDER_DOCUMENT_CANVAS_POPOVER_DISMISS_GROUP = 'order-document-canvas-toolbar';

const ELEMENT_META: Record<
  OrderDocumentCanvasElementId,
  { label: string; description: string }
> = {
  header: { label: 'Območje glave', description: 'Skupina elementov na vrhu strani.' },
  logo: { label: 'Logotip', description: 'Izvirni barvni pravokotnik ATEHNA.' },
  company: { label: 'Podatki podjetja', description: 'Kontaktni podatki desno od logotipa.' },
  document_details: { label: 'Območje dokumenta', description: 'Skupina naslova in podatkov naročila.' },
  title: { label: 'Naslov in številka', description: 'Naslov dokumenta, številka in datum.' },
  customer: { label: 'Naročnik', description: 'Ime, kontakt in naslov naročnika.' },
  document_meta: { label: 'Podatki naročila', description: 'Datumi, reference in način odpreme.' },
  intro: { label: 'Uvod', description: 'Uvodno sporočilo pred artikli.' },
  items: { label: 'Artikli', description: 'Tabela izdelkov, količin in cen.' },
  totals: { label: 'Zneski', description: 'Vmesni seštevek, DDV in končni znesek.' },
  notes: { label: 'Opombe', description: 'Opombe, shranjene pri naročilu.' },
  closing: { label: 'Zaključek', description: 'Plačilni pogoji in zaključno besedilo.' },
  signatures: { label: 'Podpisi', description: 'Polji za predajo in prevzem.' },
  footer: { label: 'Noga', description: 'Registracijski, bančni in davčni podatki.' }
};

const GROUP_IDS = new Set<OrderDocumentCanvasElementId>(['header', 'document_details']);
const GROUP_CHILD_IDS: Partial<
  Record<OrderDocumentCanvasElementId, ReadonlyArray<OrderDocumentCanvasElementId>>
> = {
  header: ['logo', 'company'],
  document_details: ['title', 'customer', 'document_meta']
};

const groupForChild = (id: OrderDocumentCanvasElementId) =>
  (Object.entries(GROUP_CHILD_IDS) as Array<
    [OrderDocumentCanvasElementId, ReadonlyArray<OrderDocumentCanvasElementId>]
  >).find(([, childIds]) => childIds.includes(id))?.[0] ?? null;

const SECTION_META: Record<OrderDocumentSectionId, string> = {
  document_details: 'Podatki dokumenta',
  intro: 'Uvod',
  items: 'Artikli',
  totals: 'Zneski',
  notes: 'Opombe',
  closing: 'Zaključek',
  signatures: 'Podpisi'
};

const PAGE_CONTROL_FIELDS = [
  { key: 'showHeader', label: 'Prikaži glavo' },
  { key: 'showLogoMark', label: 'Prikaži logotip' },
  { key: 'showFooter', label: 'Prikaži nogo' },
  { key: 'showPageNumbers', label: 'Prikaži številke strani' },
  { key: 'showShipping', label: 'Prikaži strošek dostave' },
  { key: 'showTaxSummary', label: 'Prikaži davčni povzetek' }
] as const;

const COMPANY_FIELDS: ReadonlyArray<{
  key: keyof OrderDocumentTemplateCompany;
  label: string;
  multiline?: boolean;
}> = [
  { key: 'logoText', label: 'Besedilo logotipa' },
  { key: 'logoTagline', label: 'Slogan' },
  { key: 'name', label: 'Ime podjetja' },
  { key: 'addressLine1', label: 'Naslov – 1. vrstica' },
  { key: 'addressLine2', label: 'Naslov – 2. vrstica' },
  { key: 'phone', label: 'Telefon' },
  { key: 'fax', label: 'Faks' },
  { key: 'mobile', label: 'Mobilni telefon' },
  { key: 'email', label: 'E-pošta' },
  { key: 'website', label: 'Spletna stran' },
  { key: 'bankName', label: 'Banka' },
  { key: 'iban', label: 'IBAN' },
  { key: 'swift', label: 'SWIFT / BIC' },
  { key: 'taxId', label: 'ID za DDV' },
  { key: 'registrationText', label: 'Registracijski podatki', multiline: true }
];

const LABEL_DISPLAY_NAMES: Record<keyof OrderDocumentTemplateLabels, string> = {
  customer: 'Stranka',
  address: 'Naslov',
  contact: 'Kontakt',
  email: 'E-pošta',
  deliveryAddress: 'Naslov dostave',
  customerType: 'Vrsta naročnika',
  documentNumber: 'Številka dokumenta',
  orderNumber: 'Številka naročila',
  issueDate: 'Datum',
  orderDate: 'Datum naročila',
  reference: 'Referenca naročnika',
  status: 'Status',
  dispatchDate: 'Datum odpreme',
  dispatchMethod: 'Način odpreme',
  purchaseOrderNumber: 'Številka naročilnice',
  purchaseOrderDate: 'Datum naročilnice',
  deliveryNote: 'Dobavnica',
  dueDate: 'Rok plačila',
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
  total: 'Končni znesek',
  notes: 'Opombe',
  handedOverBy: 'Predal',
  receivedBy: 'Prevzel'
};

const TEXT_DISPLAY_NAMES: Record<keyof Omit<OrderDocumentTemplateText, 'labels'>, string> = {
  title: 'Naslov dokumenta',
  subtitle: 'Podnaslov',
  intro: 'Uvodno besedilo',
  closing: 'Zaključno besedilo',
  paymentTerms: 'Plačilni pogoji',
  deliveryMethod: 'Način odpreme',
  signerName: 'Ime podpisnika',
  footerText: 'Besedilo noge'
};

const COMPANY_DISPLAY_NAMES = Object.fromEntries(
  COMPANY_FIELDS.map((field) => [field.key, field.label])
) as Partial<Record<OrderDocumentCompanyTextKey, string>>;

const fieldClassName =
  "h-7 w-full rounded-md border border-slate-300 bg-white px-2 text-[10px] text-slate-900 outline-none transition hover:border-slate-400 focus:border-[color:var(--blue-500)] focus:ring-1 focus:ring-blue-100 font-['Inter',system-ui,sans-serif]";

const childToolbarInputClassName =
  "h-8 w-full rounded-lg border border-white/15 bg-slate-800 px-2.5 text-[11px] text-slate-100 shadow-inner outline-none transition placeholder:text-slate-400 hover:border-white/25 focus:border-blue-300 focus:bg-slate-700 focus:ring-1 focus:ring-blue-300/35";

const FIELD_ROW_DISPLAY_NAMES: Record<OrderDocumentFieldRowId, string> = {
  title_text: 'Naslov dokumenta',
  document_number: 'Številka dokumenta',
  issue_date: 'Datum dokumenta',
  subtitle: 'Podnaslov',
  company_name: 'Ime podjetja',
  address_line_1: 'Naslov podjetja',
  address_line_2: 'Kraj in pošta',
  contacts: 'Kontakti podjetja',
  customer: 'Stranka',
  contact: 'Kontakt',
  address: 'Naslov',
  email: 'E-pošta',
  order_date: 'Datum naročila',
  customer_type: 'Vrsta naročnika',
  status: 'Status',
  reference: 'Referenca naročnika',
  dispatch_date: 'Datum odpreme',
  dispatch_method: 'Način odpreme',
  purchase_order_number: 'Številka naročilnice',
  purchase_order_date: 'Datum naročilnice',
  delivery_note: 'Dobavnica',
  due_date: 'Rok plačila',
  payment_reference: 'Sklicna številka',
  subtotal: 'Skupaj brez DDV',
  shipping: 'Stroški dostave',
  tax: 'Davek',
  total: 'Končni znesek',
  notes_label: 'Naslov opomb',
  notes_content: 'Vsebina opomb',
  payment_terms: 'Plačilni pogoji',
  closing_text: 'Zaključno besedilo',
  signer_name: 'Ime podpisnika',
  handed_over_by: 'Predal',
  received_by: 'Prevzel',
  registration_text: 'Registracijski podatki',
  footer_text: 'Besedilo noge',
  page_numbers: 'Številka strani'
};

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(maximum, Math.max(minimum, value));
const roundMm = (value: number) => Math.round(value * 10) / 10;

type Interaction = {
  id: OrderDocumentCanvasElementId;
  kind: 'move' | 'resize';
  pointerId: number;
  startClientX: number;
  startClientY: number;
  start: OrderDocumentCanvasElement;
  groupStarts: Partial<Record<OrderDocumentCanvasElementId, OrderDocumentCanvasElement>>;
  didMove: boolean;
};

type GuideState = ReadonlyArray<OrderDocumentAlignmentGuide> | null;

type CanvasOverlapCandidate = OrderDocumentSelectionCandidate<HTMLElement> & {
  node: HTMLElement;
};

type CanvasOverlapSelection = {
  candidates: ReadonlyArray<CanvasOverlapCandidate>;
  anchorClientX: number;
  anchorClientY: number;
  placement: 'above' | 'below';
  open: boolean;
};

type FieldRowSelection = Extract<CanvasChildSelection, { kind: 'field_row' }>;

type FieldRowDragEntry = {
  selection: FieldRowSelection;
  startPlacement: OrderDocumentFieldRowPlacement;
  measuredWidthMm: number;
  measuredHeightMm: number;
  ownerElement: OrderDocumentCanvasElement;
};

type FieldRowInteraction = {
  primaryId: string;
  entries: readonly FieldRowDragEntry[];
  pointerId: number;
  startClientX: number;
  startClientY: number;
  didMove: boolean;
};

type TransientFieldRowPlacement = {
  group: OrderDocumentFieldGroupId;
  rowId: OrderDocumentFieldRowId;
  placement: OrderDocumentFieldRowPlacement;
};

type CanvasChildSelection = OrderDocumentCanvasChildSelection;

type SelectionGesture = { additive: boolean };

/**
 * Commit modified direct-manipulation selection on pointerdown. The later
 * click can be omitted/retargeted by capture, overlap chrome, or a tiny drag.
 * Consume only the click belonging to the handled pointer gesture so the
 * additive toggle cannot immediately undo itself.
 */
function useAdditiveSelectionPointerGuard(onAdditiveSelect: () => void) {
  const suppressTrailingClickRef = useRef(false);
  const suppressTrailingClickTimerRef = useRef<number | null>(null);
  const clearTrailingClickSuppression = () => {
    suppressTrailingClickRef.current = false;
    if (suppressTrailingClickTimerRef.current !== null) {
      window.clearTimeout(suppressTrailingClickTimerRef.current);
      suppressTrailingClickTimerRef.current = null;
    }
  };
  useEffect(() => () => {
    if (suppressTrailingClickTimerRef.current !== null) {
      window.clearTimeout(suppressTrailingClickTimerRef.current);
    }
  }, []);
  return {
    handlePointerDown(event: ReactPointerEvent<HTMLElement>) {
      if (event.button !== 0 || (!event.ctrlKey && !event.metaKey)) return false;
      event.preventDefault();
      event.stopPropagation();
      suppressTrailingClickRef.current = true;
      if (suppressTrailingClickTimerRef.current !== null) {
        window.clearTimeout(suppressTrailingClickTimerRef.current);
      }
      suppressTrailingClickTimerRef.current = window.setTimeout(clearTrailingClickSuppression, 750);
      onAdditiveSelect();
      return true;
    },
    consumeTrailingClick() {
      if (!suppressTrailingClickRef.current) return false;
      clearTrailingClickSuppression();
      return true;
    }
  };
}

const OrderDocumentTypographyPreviewContext =
  createContext<OrderDocumentTemplate | null>(null);

const OrderDocumentElementPreviewContext =
  createContext<OrderDocumentCanvasElement | null>(null);

const OrderDocumentFieldRowInteractionContext = createContext<{
  transient: readonly TransientFieldRowPlacement[];
  begin: (
    selection: FieldRowSelection,
    event: ReactPointerEvent<HTMLElement>
  ) => void;
} | null>(null);

const typographyTargetForSelection = (
  selection: CanvasChildSelection
): OrderDocumentTypographyTarget => {
  if (selection.kind === 'field_row') {
    return { kind: 'field_row', group: selection.group, rowId: selection.rowId };
  }
  if (selection.kind === 'company_contact') {
    return { kind: 'company_contact', contactId: selection.contactId };
  }
  if (selection.kind === 'table_header') {
    return { kind: 'table_header' };
  }
  if (selection.kind === 'table_body') {
    return { kind: 'table_body' };
  }
  if (selection.kind === 'table_header_cell') {
    return { kind: 'table_header_cell', columnId: selection.key };
  }
  if (selection.kind === 'table_column') {
    return { kind: 'table_column', columnId: selection.key };
  }
  if (selection.kind === 'table_row') {
    return { kind: 'table_row', rowNumber: selection.rowNumber };
  }
  if (selection.kind === 'table_cell') {
    return { kind: 'table_cell', rowNumber: selection.rowNumber, columnId: selection.key };
  }
  return { kind: 'element', elementId: selection.parentId };
};

const typographyCss = (typography: OrderDocumentTypography): CSSProperties => ({
  fontFamily:
    ORDER_DOCUMENT_FONT_FAMILY_CATALOG.find(
      (family) => family.id === typography.fontFamily
    )?.cssFontFamily,
  fontWeight: ORDER_DOCUMENT_FONT_WEIGHT_VALUES[typography.fontWeight],
  fontStyle: typography.fontStyle,
  fontSize: `${typography.fontSizePt}pt`
});

const textAlignmentCss = (
  alignment: OrderDocumentResolvedTextAlignment
): CSSProperties => alignment === 'distributed'
  ? {}
  : { textAlign: alignment };

const semanticTextAlignmentCss = (
  alignment: OrderDocumentResolvedTextAlignment
): CSSProperties => alignment === 'distributed'
  ? { justifyContent: 'space-between' }
  : {
      textAlign: alignment,
      justifyContent: alignment === 'left' || alignment === 'justify'
        ? 'flex-start'
        : alignment === 'center'
          ? 'center'
          : 'flex-end',
      columnGap: '0.75em'
    };

const FINANCIAL_OPTICAL_EDGE_OFFSET_PROPERTY =
  '--order-document-financial-optical-edge-offset';

type FinancialOpticalEdgeStyle = CSSProperties & {
  [FINANCIAL_OPTICAL_EDGE_OFFSET_PROPERTY]: string;
};

function CanvasFinancialOpticalEdgeText({
  cell,
  edge,
  measurementKey,
  style,
  children
}: {
  cell: 'label' | 'value';
  edge: OrderDocumentFinancialOpticalEdge;
  measurementKey: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  const textRef = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const textElement = textRef.current;
    if (!textElement) return;
    let cancelled = false;

    const measure = () => {
      if (cancelled) return;
      const context = document.createElement('canvas').getContext('2d');
      const computedStyle = window.getComputedStyle(textElement);
      const text = textElement.textContent ?? '';
      if (!context || !text || !computedStyle.font) {
        textElement.style.setProperty(FINANCIAL_OPTICAL_EDGE_OFFSET_PROPERTY, '0px');
        textElement.dataset.orderDocumentFinancialOpticalEdgeOffsetPx = '0';
        return;
      }

      context.font = computedStyle.font;
      context.textAlign = 'left';
      const offsetPx = resolveOrderDocumentFinancialOpticalEdgeOffsetPx(
        context.measureText(text),
        edge
      );
      const roundedOffsetPx = Math.round(offsetPx * 1000) / 1000;
      textElement.style.setProperty(
        FINANCIAL_OPTICAL_EDGE_OFFSET_PROPERTY,
        `${roundedOffsetPx}px`
      );
      textElement.dataset.orderDocumentFinancialOpticalEdgeOffsetPx =
        String(roundedOffsetPx);
    };

    measure();
    const fontSet = document.fonts;
    void fontSet?.ready.then(measure);
    fontSet?.addEventListener('loadingdone', measure);
    return () => {
      cancelled = true;
      fontSet?.removeEventListener('loadingdone', measure);
    };
  }, [edge, measurementKey]);

  return (
    <span
      ref={textRef}
      data-order-document-financial-label-cell={cell === 'label' || undefined}
      data-order-document-financial-value-cell={cell === 'value' || undefined}
      data-order-document-financial-optical-edge={edge}
      style={{
        ...style,
        position: 'relative',
        transform: `translateX(var(${FINANCIAL_OPTICAL_EDGE_OFFSET_PROPERTY}))`,
        [FINANCIAL_OPTICAL_EDGE_OFFSET_PROPERTY]: '0px'
      } as FinancialOpticalEdgeStyle}
    >
      {children}
    </span>
  );
}

const resolvePreviewTypographyCss = (
  template: OrderDocumentTemplate,
  target: OrderDocumentTypographyTarget | readonly OrderDocumentTypographyTarget[]
) => typographyCss(resolveOrderDocumentTypography(template, target));

const labelChild = (
  parentId: OrderDocumentCanvasElementId,
  key: keyof OrderDocumentTemplateLabels
): CanvasChildSelection => ({
  id: `${parentId}:label:${key}`,
  parentId,
  kind: 'label',
  key
});

const textChild = (
  parentId: OrderDocumentCanvasElementId,
  key: keyof Omit<OrderDocumentTemplateText, 'labels'>
): CanvasChildSelection => ({
  id: `${parentId}:text:${key}`,
  parentId,
  kind: 'text',
  key
});

const companyChild = (
  parentId: OrderDocumentCanvasElementId,
  key: OrderDocumentCompanyTextKey
): CanvasChildSelection => ({
  id: `${parentId}:company:${key}`,
  parentId,
  kind: 'company',
  key
});

const tableColumnChild = (
  key: OrderDocumentTableColumnId
): CanvasChildSelection => ({
  id: `items:table-column:${key}`,
  parentId: 'items',
  kind: 'table_column',
  key
});

const tableHeaderChild = (): CanvasChildSelection => ({
  id: 'items:table-header',
  parentId: 'items',
  kind: 'table_header'
});

const tableBodyChild = (): CanvasChildSelection => ({
  id: 'items:table-body',
  parentId: 'items',
  kind: 'table_body'
});

const tableHeaderCellChild = (key: OrderDocumentTableColumnId): CanvasChildSelection => ({
  id: `items:table-header-cell:${key}`,
  parentId: 'items',
  kind: 'table_header_cell',
  key
});

const tableRowChild = (rowNumber: number): CanvasChildSelection => ({
  id: `items:table-row:${rowNumber}`,
  parentId: 'items',
  kind: 'table_row',
  rowNumber
});

const tableCellChild = (
  rowNumber: number,
  key: OrderDocumentTableColumnId
): CanvasChildSelection => ({
  id: `items:table-cell:${rowNumber}:${key}`,
  parentId: 'items',
  kind: 'table_cell',
  rowNumber,
  key
});

const companyContactChild = (contactId: string): CanvasChildSelection => ({
  id: `company:contact:${contactId}`,
  parentId: 'company',
  kind: 'company_contact',
  contactId
});

const fieldRowChild = (
  group: OrderDocumentFieldGroupId,
  rowId: OrderDocumentFieldRowId
): FieldRowSelection => ({
  id: `${group}:field-row:${rowId}`,
  parentId: group,
  kind: 'field_row',
  group,
  rowId
});

function AtehnaDocumentLogoFallback({ className = '' }: { className?: string }) {
  return (
    <span className={`relative block h-full w-full overflow-hidden ${className}`}>
      <Image
        src="/brand/atehna-document-wordmark.png"
        alt="ATEHNA"
        width={1873}
        height={840}
        unoptimized
        draggable={false}
        className="absolute left-0 w-full max-w-none object-fill"
        style={{ height: '141.414%', top: '-11.7845%' }}
      />
    </span>
  );
}

function AtehnaDocumentLogo({ className = '' }: { className?: string }) {
  return (
    <SiteLogo
      purposeId="pdf-document"
      fallback={<AtehnaDocumentLogoFallback />}
      className={`h-full w-full ${className}`}
      alt="ATEHNA"
    />
  );
}

function CanvasChildTarget({
  selection,
  selectedChildId,
  onSelect,
  className = '',
  style,
  children
}: {
  selection: CanvasChildSelection;
  selectedChildId: string | readonly string[] | null;
  onSelect: (selection: CanvasChildSelection, gesture: SelectionGesture) => void;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  const selected = Array.isArray(selectedChildId)
    ? selectedChildId.includes(selection.id)
    : selectedChildId === selection.id;
  const key = selection.kind === 'label' ? selection.key : undefined;
  const previewTemplate = useContext(OrderDocumentTypographyPreviewContext);
  const typographyTarget = typographyTargetForSelection(selection);
  const typographyTargets: OrderDocumentTypographyTarget | readonly OrderDocumentTypographyTarget[] =
    selection.kind === 'company_contact'
      ? [
          { kind: 'field_row', group: 'company', rowId: 'contacts' },
          typographyTarget
        ]
      : typographyTarget;
  const resolvedTypographyStyle = previewTemplate
    ? resolvePreviewTypographyCss(previewTemplate, typographyTargets)
    : undefined;
  const resolvedTextAlignmentStyle = previewTemplate
    ? textAlignmentCss(resolveOrderDocumentTextAlignment(previewTemplate, typographyTargets))
    : undefined;
  const additiveSelectionPointer = useAdditiveSelectionPointerGuard(() =>
    onSelect(selection, { additive: true })
  );
  return (
    <button
      type="button"
      data-order-document-child
      data-order-document-child-id={selection.id}
      data-order-document-table-column-id={
        selection.kind === 'table_column'
          || selection.kind === 'table_header_cell'
          || selection.kind === 'table_cell'
          ? selection.key
          : undefined
      }
      data-order-document-table-row-number={
        selection.kind === 'table_row' || selection.kind === 'table_cell'
          ? selection.rowNumber
          : undefined
      }
      data-order-document-table-scope={selection.kind.startsWith('table_') ? selection.kind : undefined}
      data-canvas-element-id={selection.id}
      data-canvas-element-selected={selected || undefined}
      aria-label={`Uredi ${
        selection.kind === 'label'
          ? LABEL_DISPLAY_NAMES[selection.key]
          : selection.kind === 'text'
            ? TEXT_DISPLAY_NAMES[selection.key]
            : selection.kind === 'company'
              ? COMPANY_DISPLAY_NAMES[selection.key] ?? selection.key
              : selection.kind === 'table_header'
                ? 'Glava tabele'
                : selection.kind === 'table_body'
                  ? 'Vrstice tabele'
              : selection.kind === 'table_column'
                ? LABEL_DISPLAY_NAMES[
                    selection.key === 'sku'
                      ? 'code'
                      : selection.key
                  ]
                : selection.kind === 'table_header_cell'
                  ? `Glava stolpca ${selection.key}`
                : selection.kind === 'table_row'
                  ? `Vrstica ${selection.rowNumber}`
                  : selection.kind === 'table_cell'
                    ? `Celica ${selection.rowNumber}, ${selection.key}`
                  : selection.kind === 'field_row'
                    ? FIELD_ROW_DISPLAY_NAMES[selection.rowId]
                    : 'Kontakt podjetja'
      }`}
      className={`relative z-30 min-w-0 border border-transparent bg-transparent p-0 text-inherit transition hover:border-blue-300/80 ${
        selected ? adminEditorSelectionOutlineTokenClasses : ''
      } ${selection.kind === 'table_row' ? 'cursor-pointer' : 'cursor-text'} ${className}`}
      style={{ ...style, ...resolvedTypographyStyle, ...resolvedTextAlignmentStyle }}
      data-order-document-label-id={key}
      onPointerDown={(event) => {
        if (additiveSelectionPointer.handlePointerDown(event)) return;
        event.stopPropagation();
      }}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        if (additiveSelectionPointer.consumeTrailingClick()) return;
        onSelect(selection, { additive: event.ctrlKey || event.metaKey });
      }}
    >
      {children}
    </button>
  );
}

function CanvasGroupTarget({
  selection,
  selectedChildId,
  onSelect,
  className = '',
  style,
  children
}: {
  selection: CanvasChildSelection;
  selectedChildId: string | readonly string[] | null;
  onSelect: (selection: CanvasChildSelection, gesture: SelectionGesture) => void;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  const selected = Array.isArray(selectedChildId)
    ? selectedChildId.includes(selection.id)
    : selectedChildId === selection.id;
  const previewTemplate = useContext(OrderDocumentTypographyPreviewContext);
  const typographyTarget = typographyTargetForSelection(selection);
  const groupLabel = selection.kind === 'table_header'
    ? 'Izberi glavo tabele'
    : selection.kind === 'table_body'
      ? 'Izberi vse podatkovne vrstice'
      : selection.kind === 'table_row'
        ? `Izberi vrstico ${selection.rowNumber}`
        : 'Izberi skupino';
  const resolvedTextAlignmentStyle = previewTemplate
    ? textAlignmentCss(resolveOrderDocumentTextAlignment(previewTemplate, typographyTarget))
    : undefined;
  const additiveSelectionPointer = useAdditiveSelectionPointerGuard(() =>
    onSelect(selection, { additive: true })
  );
  return (
    <div
      role="group"
      data-order-document-child
      data-order-document-child-id={selection.id}
      data-order-document-table-scope={selection.kind}
      data-order-document-table-row-number={
        selection.kind === 'table_row' ? selection.rowNumber : undefined
      }
      data-canvas-element-id={selection.id}
      data-canvas-element-selected={selected || undefined}
      aria-label={groupLabel}
      className={`group/scope relative border border-transparent transition hover:border-blue-300/80 ${
        selected ? adminEditorSelectionOutlineTokenClasses : ''
      } ${className}`}
      style={{
        ...style,
        ...(previewTemplate ? resolvePreviewTypographyCss(previewTemplate, typographyTarget) : {}),
        ...resolvedTextAlignmentStyle
      }}
      onPointerDown={(event) => {
        if (additiveSelectionPointer.handlePointerDown(event)) return;
        event.stopPropagation();
      }}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        if (additiveSelectionPointer.consumeTrailingClick()) return;
        onSelect(selection, { additive: event.ctrlKey || event.metaKey });
      }}
    >
      <button
        type="button"
        data-order-document-table-scope-keyboard-handle={selection.kind}
        aria-label={groupLabel}
        className="sr-only focus:not-sr-only focus:absolute focus:left-0 focus:top-0 focus:z-50 focus:rounded focus:bg-blue-600 focus:px-2 focus:py-1 focus:text-[9px] focus:font-semibold focus:text-white focus:outline-none focus:ring-2 focus:ring-white"
        onPointerDown={(event) => {
          if (additiveSelectionPointer.handlePointerDown(event)) return;
          event.stopPropagation();
        }}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          if (additiveSelectionPointer.consumeTrailingClick()) return;
          onSelect(selection, { additive: event.ctrlKey || event.metaKey });
        }}
      >
        {groupLabel}
      </button>
      {children}
    </div>
  );
}

function CanvasSemanticRowTarget({
  group,
  rowId,
  selectedChildId,
  onSelect,
  className = '',
  style,
  contentAlignment = 'left',
  children
}: {
  group: OrderDocumentFieldGroupId;
  rowId: OrderDocumentFieldRowId;
  selectedChildId: string | readonly string[] | null;
  onSelect: (selection: CanvasChildSelection, gesture: SelectionGesture) => void;
  className?: string;
  style?: CSSProperties;
  contentAlignment?: OrderDocumentDecorationContentAlignment;
  children: ReactNode;
}) {
  const selection = fieldRowChild(group, rowId);
  const selected = Array.isArray(selectedChildId)
    ? selectedChildId.includes(selection.id)
    : selectedChildId === selection.id;
  const previewTemplate = useContext(OrderDocumentTypographyPreviewContext);
  const ownerElement = useContext(OrderDocumentElementPreviewContext);
  const rowInteraction = useContext(OrderDocumentFieldRowInteractionContext);
  const row = previewTemplate
    ? resolveOrderDocumentFieldRows(previewTemplate, group).find((candidate) => candidate.id === rowId)
    : undefined;
  const transientPlacement = rowInteraction?.transient.find((candidate) =>
    candidate.group === group && candidate.rowId === rowId
  )?.placement ?? null;
  const placement = transientPlacement ?? row?.placement;
  const resolvedTypographyStyle = previewTemplate
    ? resolvePreviewTypographyCss(previewTemplate, {
        kind: 'field_row',
        group,
        rowId
      })
    : undefined;
  const textAlignmentTarget: OrderDocumentTypographyTarget = {
    kind: 'field_row',
    group,
    rowId
  };
  const resolvedTextAlignment = previewTemplate
    ? resolveOrderDocumentTextAlignment(previewTemplate, textAlignmentTarget)
    : contentAlignment;
  const resolvedTextAlignmentStyle = group === 'totals'
    ? resolveOrderDocumentFinancialPairPreviewStyle(resolvedTextAlignment).container
    : semanticTextAlignmentCss(resolvedTextAlignment);
  const decorationTarget: OrderDocumentDecorationTarget = {
    kind: 'field_row',
    group,
    rowId
  };
  const resolvedDecoration = previewTemplate
    ? resolveOrderDocumentDecoration(previewTemplate, decorationTarget)
    : undefined;
  const resolvedDecorationInsetPt = previewTemplate
    ? resolveOrderDocumentDecorationContentInset(previewTemplate, decorationTarget)
    : 0;
  const resolvedDecorationStyle = resolvedDecoration
    ? resolveOrderDocumentDecorationPreviewStyle(
        resolvedDecoration,
        resolvedDecorationInsetPt,
        { centerText: true, alignment: resolvedTextAlignment }
      )
    : undefined;
  const centeredDecorationContent = resolvedDecorationStyle?.alignItems === 'center';
  const naturalFinancialFrame = group === 'totals' && resolvedDecoration
    ? resolveOrderDocumentNaturalFinancialFramePreview(
        resolvedDecoration,
        Boolean(placement),
        resolvedDecorationInsetPt
      )
    : null;
  const placementStyle: CSSProperties | undefined = placement && ownerElement
    ? {
        position: 'absolute',
        left: typeof placement.xMm === 'number'
          ? `${(placement.xMm / ownerElement.widthMm) * 100}%`
          : undefined,
        top: typeof placement.yMm === 'number'
          ? `${(placement.yMm / ownerElement.heightMm) * 100}%`
          : undefined,
        width: typeof placement.widthMm === 'number'
          ? `${(placement.widthMm / ownerElement.widthMm) * 100}%`
          : 'max-content',
        height: typeof placement.heightMm === 'number'
          ? `${(placement.heightMm / ownerElement.heightMm) * 100}%`
          : undefined,
        maxWidth: '100%',
        zIndex: 35
      }
    : undefined;
  const select = (gesture: SelectionGesture = { additive: false }) =>
    onSelect(selection, gesture);
  const additiveSelectionPointer = useAdditiveSelectionPointerGuard(() =>
    select({ additive: true })
  );
  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`Uredi vrstico ${FIELD_ROW_DISPLAY_NAMES[rowId]}`}
      data-order-document-child
      data-order-document-child-id={selection.id}
      data-order-document-semantic-row-id={rowId}
      data-order-document-semantic-row-group={group}
      data-order-document-decoration-content-centered={
        centeredDecorationContent || undefined
      }
      data-order-document-decoration-line-box-centered={
        centeredDecorationContent || undefined
      }
      data-order-document-decoration-content-inset-pt={
        resolvedDecoration ? resolvedDecorationInsetPt : undefined
      }
      data-order-document-text-alignment={resolvedTextAlignment}
      data-order-document-financial-content-anchors={group === 'totals' ? 'preserved' : undefined}
      data-order-document-financial-paired-columns={group === 'totals' ? '67/33' : undefined}
      data-order-document-natural-financial-frame={naturalFinancialFrame ? true : undefined}
      data-order-document-natural-financial-frame-left-inset-pt={
        naturalFinancialFrame?.leftInsetPt
      }
      data-order-document-natural-financial-frame-right-inset-pt={
        naturalFinancialFrame?.rightInsetPt
      }
      data-canvas-element-id={selection.id}
      data-canvas-element-selected={selected || undefined}
      className={`relative z-30 min-w-0 cursor-grab border border-transparent bg-transparent text-inherit transition hover:border-blue-300/80 active:cursor-grabbing ${
        selected ? adminEditorSelectionOutlineTokenClasses : ''
      } ${className}`}
      style={{
        ...style,
        ...resolvedTypographyStyle,
        ...resolvedDecorationStyle,
        ...naturalFinancialFrame?.style,
        ...resolvedTextAlignmentStyle,
        ...placementStyle,
        ...(centeredDecorationContent ? { lineHeight: 1 } : {})
      }}
      onPointerDown={(event) => {
        if (additiveSelectionPointer.handlePointerDown(event)) return;
        event.stopPropagation();
        rowInteraction?.begin(selection, event);
      }}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        if (additiveSelectionPointer.consumeTrailingClick()) return;
        select({ additive: event.ctrlKey || event.metaKey });
      }}
      onKeyDown={(event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        event.stopPropagation();
        select({ additive: event.ctrlKey || event.metaKey });
      }}
    >
      {centeredDecorationContent && contentAlignment !== 'distributed' ? (
        <span
          data-order-document-decoration-text-content
          className="block min-w-0 w-full"
          style={textAlignmentCss(resolvedTextAlignment)}
        >
          {children}
        </span>
      ) : children}
    </div>
  );
}

function CanvasTableScopeSelectionButton({
  selection,
  active,
  label,
  onSelect
}: {
  selection: CanvasChildSelection;
  active: boolean;
  label: string;
  onSelect: (
    selection: CanvasChildSelection,
    gesture: SelectionGesture
  ) => void;
}) {
  const additiveSelectionPointer = useAdditiveSelectionPointerGuard(() =>
    onSelect(selection, { additive: true })
  );
  return (
    <button
      type="button"
      data-order-document-table-typography-scope={selection.kind}
      aria-pressed={active}
      onPointerDown={(event) => {
        additiveSelectionPointer.handlePointerDown(event);
      }}
      onClick={(event) => {
        if (additiveSelectionPointer.consumeTrailingClick()) {
          event.preventDefault();
          event.stopPropagation();
          return;
        }
        onSelect(selection, { additive: event.ctrlKey || event.metaKey });
      }}
      className={'rounded-md border px-1.5 py-1 text-[8px] font-semibold transition '
        + (active
          ? 'border-blue-300/60 bg-blue-400/20 text-blue-100'
          : 'border-white/15 bg-white/5 text-white/70 hover:bg-white/10')}
    >
      {label}
    </button>
  );
}

const FONT_WEIGHT_LABELS: Record<OrderDocumentFontWeightId, string> = {
  regular: 'Navadno',
  medium: 'Srednje',
  semibold: 'Polkrepko',
  bold: 'Krepko'
};

const FONT_STYLE_LABELS: Record<OrderDocumentFontStyleId, string> = {
  normal: 'Pokončno',
  italic: 'Ležeče'
};

const typographyControlClassName =
  'h-7 w-full min-w-0 rounded-md border border-white/15 bg-slate-800 px-2 text-[10px] font-semibold text-slate-100 outline-none transition hover:border-white/25 focus:border-blue-300 focus:bg-slate-700 focus:ring-1 focus:ring-blue-300/35 disabled:cursor-not-allowed disabled:opacity-45';

type CompactDarkSelectOption<Value extends string> = {
  value: Value;
  label: string;
  disabled?: boolean;
};

/**
 * Native Windows option popups ignore the dark inspector surface. This compact
 * portal listbox keeps every option visible, keyboard reachable and visually
 * consistent without introducing a nested scroll region.
 */
function CompactDarkSelect<Value extends string>({
  value,
  options,
  label,
  placeholder = 'Izberite',
  onChange,
  marker
}: {
  value: Value | '';
  options: readonly CompactDarkSelectOption<Value>[];
  label: string;
  placeholder?: string;
  onChange: (value: Value) => void;
  marker: string;
}) {
  const listboxId = useId();
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const [position, setPosition] = useState({ left: 0, top: 0, width: 0 });
  const selected = options.find((option) => option.value === value);
  const multiColumn = options.length > 8;

  useLayoutEffect(() => {
    if (!open || !triggerRef.current || !listRef.current) return;
    const trigger = triggerRef.current.getBoundingClientRect();
    const list = listRef.current.getBoundingClientRect();
    const viewportGap = 8;
    const width = Math.min(
      window.innerWidth - viewportGap * 2,
      Math.max(trigger.width, multiColumn ? 320 : 190)
    );
    const left = clamp(
      trigger.left,
      viewportGap,
      Math.max(viewportGap, window.innerWidth - width - viewportGap)
    );
    const spaceBelow = window.innerHeight - trigger.bottom - viewportGap;
    const top = spaceBelow >= list.height + 6
      ? trigger.bottom + 4
      : Math.max(viewportGap, trigger.top - list.height - 4);
    setPosition({ left, top, width });
  }, [multiColumn, open, options.length]);

  useEffect(() => {
    if (!open) return undefined;
    const dismiss = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (target && (triggerRef.current?.contains(target) || listRef.current?.contains(target))) {
        return;
      }
      setOpen(false);
    };
    const closeForViewportChange = () => setOpen(false);
    document.addEventListener('pointerdown', dismiss, true);
    window.addEventListener('resize', closeForViewportChange);
    window.addEventListener('scroll', closeForViewportChange, true);
    return () => {
      document.removeEventListener('pointerdown', dismiss, true);
      window.removeEventListener('resize', closeForViewportChange);
      window.removeEventListener('scroll', closeForViewportChange, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    window.requestAnimationFrame(() => {
      const selectedOption = listRef.current?.querySelector<HTMLButtonElement>(
        '[role="option"][aria-selected="true"]'
      );
      const firstOption = listRef.current?.querySelector<HTMLButtonElement>(
        '[role="option"]:not(:disabled)'
      );
      (selectedOption ?? firstOption)?.focus();
    });
  }, [open]);

  const openFromKeyboard = () => {
    if (!open && options.some((option) => !option.disabled)) setOpen(true);
  };

  return (
    <div className="min-w-0" data-order-document-dark-select={marker}>
      <button
        ref={triggerRef}
        type="button"
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        data-order-document-typography-control={marker}
        data-order-document-dark-select-trigger={marker}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            openFromKeyboard();
          } else if (event.key === 'Escape' && open) {
            event.preventDefault();
            event.stopPropagation();
            setOpen(false);
          }
        }}
        className={`${typographyControlClassName} flex items-center justify-between gap-2 text-left`}
      >
        <span className={`min-w-0 flex-1 truncate ${selected ? '' : 'text-white/45'}`}>
          {selected?.label ?? placeholder}
        </span>
        <ChevronDown className={`h-3.5 w-3.5 shrink-0 transition ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && typeof document !== 'undefined' ? createPortal(
        <div
          ref={listRef}
          id={listboxId}
          role="listbox"
          aria-label={label}
          data-order-document-dark-select-portal={marker}
          className={`fixed z-[2147483647] grid gap-1 rounded-xl border border-white/15 bg-slate-950/95 p-1.5 text-white shadow-[0_18px_50px_rgba(15,23,42,.55)] backdrop-blur-xl ${
            multiColumn ? 'grid-cols-2' : 'grid-cols-1'
          }`}
          style={{ left: position.left, top: position.top, width: position.width }}
          onPointerDown={(event) => event.stopPropagation()}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.preventDefault();
              event.stopPropagation();
              setOpen(false);
              triggerRef.current?.focus();
              return;
            }
            if (event.key === 'Tab') {
              setOpen(false);
              return;
            }
            if (!['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
              return;
            }
            const buttons = Array.from(
              listRef.current?.querySelectorAll<HTMLButtonElement>('[role="option"]:not(:disabled)') ?? []
            );
            if (buttons.length === 0) return;
            event.preventDefault();
            const current = buttons.indexOf(document.activeElement as HTMLButtonElement);
            const next = event.key === 'Home'
              ? 0
              : event.key === 'End'
                ? buttons.length - 1
                : (Math.max(0, current) + (event.key === 'ArrowUp' || event.key === 'ArrowLeft' ? -1 : 1) + buttons.length) % buttons.length;
            buttons[next]?.focus();
          }}
        >
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              role="option"
              aria-selected={option.value === value}
              disabled={option.disabled}
              className={`flex h-7 min-w-0 items-center gap-2 rounded-lg px-2 text-left text-[10px] font-semibold outline-none transition focus-visible:ring-2 focus-visible:ring-blue-300 ${
                option.value === value
                  ? 'bg-blue-500/30 text-blue-100'
                  : 'text-white/75 hover:bg-white/10 hover:text-white'
              } disabled:opacity-30`}
              onClick={() => {
                onChange(option.value);
                setOpen(false);
                triggerRef.current?.focus();
              }}
            >
              <Check className={`h-3 w-3 shrink-0 ${option.value === value ? 'opacity-100' : 'opacity-0'}`} />
              <span className="truncate">{option.label}</span>
            </button>
          ))}
        </div>,
        document.body
      ) : null}
    </div>
  );
}

const TEXT_ALIGNMENT_LABELS: Record<OrderDocumentResolvedTextAlignment, string> = {
  left: 'Levo',
  center: 'Na sredino',
  right: 'Desno',
  justify: 'Obojestransko',
  distributed: 'Razporejeno'
};

const TEXT_ALIGNMENT_OPTIONS = ['left', 'center', 'right', 'justify'] as const satisfies
  readonly OrderDocumentTextAlignment[];

function TextAlignmentButtons({
  resolvedAlignment,
  overrideState,
  mixed,
  batchCount,
  onSet,
  onReset
}: {
  resolvedAlignment: OrderDocumentResolvedTextAlignment;
  overrideState: 'automatic' | 'explicit' | 'mixed';
  mixed?: boolean;
  batchCount?: number;
  onSet: (alignment: OrderDocumentTextAlignment) => void;
  onReset: () => void;
}) {
  const selectionLabel = batchCount
    ? ` za ${batchCount} izbranih elementov`
    : '';
  const status = overrideState === 'automatic'
    ? mixed
      ? 'Samodejno · različne poravnave'
      : `Samodejno · ${TEXT_ALIGNMENT_LABELS[resolvedAlignment]}`
    : overrideState === 'mixed' || mixed
      ? 'Različne poravnave'
      : 'Prilagojeno';
  return (
    <fieldset
      data-order-document-text-alignment-controls
      data-order-document-text-alignment-batch={batchCount}
      data-order-document-text-alignment-mixed={mixed || overrideState === 'mixed' || undefined}
      className="space-y-1.5"
    >
      <div className="flex items-center justify-between gap-2">
        <legend className="text-[9px] font-semibold text-white/55">Poravnava besedila</legend>
        <span className="truncate text-[8px] font-semibold text-white/40">{status}</span>
      </div>
      <div
        role="radiogroup"
        aria-label={`Poravnava besedila${selectionLabel}`}
        className="grid grid-cols-[minmax(0,1fr)_repeat(4,2rem)] gap-1"
        onKeyDown={(event) => {
          if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) {
            return;
          }
          const radios = Array.from(
            event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="radio"]')
          );
          const currentIndex = radios.indexOf(event.target as HTMLButtonElement);
          if (currentIndex < 0 || radios.length === 0) return;
          event.preventDefault();
          const nextIndex = event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? radios.length - 1
              : (currentIndex + (event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 1)
                + radios.length) % radios.length;
          radios[nextIndex].focus();
          radios[nextIndex].click();
        }}
      >
        <button
          type="button"
          role="radio"
          data-order-document-text-alignment="auto"
          aria-checked={overrideState === 'automatic'}
          tabIndex={overrideState === 'automatic' || overrideState === 'mixed' ? 0 : -1}
          onClick={onReset}
          className={`h-7 min-w-0 rounded-md border px-2 text-[9px] font-semibold transition ${
            overrideState === 'automatic'
              ? 'border-blue-300/50 bg-blue-400/20 text-blue-100'
              : 'border-white/15 bg-white/5 text-white/65 hover:bg-white/10 hover:text-white'
          }`}
          title="Samodejno: uporabi smiselno poravnavo vsebine; pri zneskih ostaneta oznaka levo in vrednost desno"
        >
          Samodejno
        </button>
        {TEXT_ALIGNMENT_OPTIONS.map((alignment) => {
          const active = overrideState === 'explicit' && !mixed
            && resolvedAlignment === alignment;
          const label = TEXT_ALIGNMENT_LABELS[alignment];
          return (
            <button
              key={alignment}
              type="button"
              role="radio"
              data-order-document-text-alignment={alignment}
              aria-label={`Poravnaj ${label.toLocaleLowerCase('sl')}${selectionLabel}`}
              title={`Poravnaj ${label.toLocaleLowerCase('sl')}`}
              aria-checked={active}
              tabIndex={active ? 0 : -1}
              onClick={() => onSet(alignment)}
              className={`grid h-7 w-8 place-items-center rounded-md border transition ${
                active
                  ? 'border-blue-300/50 bg-blue-400/20 text-blue-100'
                  : 'border-white/15 bg-white/5 text-white/65 hover:bg-white/10 hover:text-white'
              }`}
            >
              {alignment === 'left' ? (
                <AlignLeft className="h-3.5 w-3.5" aria-hidden="true" />
              ) : alignment === 'center' ? (
                <AlignCenter className="h-3.5 w-3.5" aria-hidden="true" />
              ) : alignment === 'right' ? (
                <AlignRight className="h-3.5 w-3.5" aria-hidden="true" />
              ) : (
                <AlignJustify className="h-3.5 w-3.5" aria-hidden="true" />
              )}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

function OrderDocumentTypographyControls({
  template,
  target,
  resolutionTargets,
  showAlignment = true,
  onChange
}: {
  template: OrderDocumentTemplate;
  target: OrderDocumentTypographyTarget;
  resolutionTargets?: OrderDocumentTypographyTarget | readonly OrderDocumentTypographyTarget[];
  showAlignment?: boolean;
  onChange: (template: OrderDocumentTemplate) => void;
}) {
  const typography = resolveOrderDocumentTypography(
    template,
    resolutionTargets ?? target
  );
  const override = getOrderDocumentTypographyOverride(template, target);
  const alignmentResolutionTargets = resolutionTargets ?? target;
  const resolvedTextAlignment = resolveOrderDocumentTextAlignment(
    template,
    alignmentResolutionTargets
  );
  const textAlignmentOverride = getOrderDocumentTextAlignmentOverride(template, target);
  const family = ORDER_DOCUMENT_FONT_FAMILY_CATALOG.find(
    (candidate) => candidate.id === typography.fontFamily
  ) ?? ORDER_DOCUMENT_FONT_FAMILY_CATALOG[0];
  const supportedWeights = ORDER_DOCUMENT_FONT_WEIGHT_IDS.filter((weight) =>
    family.faces.some((face) => face.weight === weight)
  );
  const supportedStyles = ORDER_DOCUMENT_FONT_STYLE_IDS.filter((fontStyle) =>
    family.faces.some(
      (face) => face.weight === typography.fontWeight && face.style === fontStyle
    )
  );

  return (
    <section
      data-order-document-typography-controls
      data-order-document-typography-target={target.kind}
      className="space-y-2"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <Type className="h-3.5 w-3.5 shrink-0 text-blue-200" />
          <span className="truncate text-[10px] font-bold uppercase tracking-[0.1em] text-white/75">
            Tipografija
          </span>
          <span className="rounded bg-white/8 px-1.5 py-0.5 text-[8px] font-semibold text-white/45">
            {override ? 'Prilagojeno' : 'Podedovano'}
          </span>
        </div>
        <button
          type="button"
          data-order-document-typography-reset
          disabled={!override}
          onClick={() => onChange(resetOrderDocumentTypography(template, target))}
          className="grid h-7 w-7 shrink-0 place-items-center rounded-md border border-white/15 bg-white/5 text-white/70 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
          aria-label="Ponastavi tipografijo na podedovano vrednost"
          title="Podeduj vse nastavitve tipografije"
        >
          <RotateCcw className="h-3 w-3" />
        </button>
      </div>

      <div className="grid grid-cols-[minmax(0,1.35fr)_minmax(0,.9fr)_4rem] gap-1.5">
        <label
          className="min-w-0"
          data-order-document-typography-control="fontFamily"
        >
          <span className="mb-1 block text-[8px] font-bold uppercase tracking-[0.08em] text-white/45" data-order-document-typography-visible-label="fontFamily">
            Družina pisave
          </span>
          <CompactDarkSelect
            marker="fontFamily"
            label="Pisava"
            value={typography.fontFamily}
            options={ORDER_DOCUMENT_FONT_FAMILY_CATALOG.map((candidate) => ({
              value: candidate.id,
              label: candidate.label
            }))}
            onChange={(fontFamily) => {
              const supported = resolveSupportedOrderDocumentTypography({
                ...typography,
                fontFamily
              });
              onChange(
                setOrderDocumentTypography(template, target, {
                  fontFamily,
                  ...(supported.fontWeight === typography.fontWeight
                    ? {}
                    : { fontWeight: supported.fontWeight }),
                  ...(supported.fontStyle === typography.fontStyle
                    ? {}
                    : { fontStyle: supported.fontStyle })
                })
              );
            }}
          />
        </label>

        <label
          className="min-w-0"
          data-order-document-typography-control="fontWeight"
        >
          <span className="mb-1 block text-[8px] font-bold uppercase tracking-[0.08em] text-white/45" data-order-document-typography-visible-label="fontWeight">
            Debelina
          </span>
          <CompactDarkSelect
            marker="fontWeight"
            label="Debelina pisave"
            value={typography.fontWeight}
            options={supportedWeights.map((weight) => ({
              value: weight,
              label: FONT_WEIGHT_LABELS[weight]
            }))}
            onChange={(fontWeight) =>
              onChange(
                setOrderDocumentTypography(template, target, {
                  fontWeight
                })
              )
            }
          />
        </label>

        <label className="min-w-0">
          <span className="mb-1 block text-[8px] font-bold uppercase tracking-[0.08em] text-white/45" data-order-document-typography-visible-label="fontSizePt">
            Velikost
          </span>
          <span className="relative block">
            <input
              type="number"
              data-order-document-typography-control="fontSizePt"
              value={typography.fontSizePt}
              min={ORDER_DOCUMENT_FONT_SIZE_MIN_PT}
              max={ORDER_DOCUMENT_FONT_SIZE_MAX_PT}
              step={ORDER_DOCUMENT_FONT_SIZE_STEP_PT}
              onChange={(event) => {
                const fontSizePt = event.currentTarget.valueAsNumber;
                if (Number.isFinite(fontSizePt)) {
                  onChange(setOrderDocumentTypography(template, target, { fontSizePt }));
                }
              }}
              className={`${typographyControlClassName} pr-7 text-right tabular-nums`}
              aria-label="Velikost pisave v točkah"
            />
            <span className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-[8px] font-semibold text-white/40">
              pt
            </span>
          </span>
        </label>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="text-[9px] font-semibold text-white/45">Slog</span>
        <button
          type="button"
          data-order-document-typography-control="fontWeightBold"
          aria-label="Krepko besedilo"
          title="Krepko"
          aria-pressed={typography.fontWeight === 'bold'}
          disabled={!supportedWeights.includes('bold')}
          onClick={() => onChange(
            setOrderDocumentTypography(template, target, {
              fontWeight: typography.fontWeight === 'bold' ? 'regular' : 'bold'
            })
          )}
          className={`grid h-7 w-8 place-items-center rounded-md border transition ${
            typography.fontWeight === 'bold'
              ? 'border-blue-300/50 bg-blue-400/20 text-blue-100'
              : 'border-white/15 bg-white/5 text-white/65 hover:bg-white/10 hover:text-white'
          } disabled:cursor-not-allowed disabled:opacity-30`}
        >
          <Bold className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          data-order-document-typography-control="fontStyle"
          aria-label="Ležeče besedilo"
          title={FONT_STYLE_LABELS.italic}
          aria-pressed={typography.fontStyle === 'italic'}
          disabled={!supportedStyles.includes('italic')}
          onClick={() =>
            onChange(
              setOrderDocumentTypography(template, target, {
                fontStyle: typography.fontStyle === 'italic' ? 'normal' : 'italic'
              })
            )
          }
          className={`grid h-7 w-8 place-items-center rounded-md border text-[13px] italic transition ${
            typography.fontStyle === 'italic'
              ? 'border-blue-300/50 bg-blue-400/20 text-blue-100'
              : 'border-white/15 bg-white/5 text-white/65 hover:bg-white/10 hover:text-white'
          } disabled:cursor-not-allowed disabled:opacity-30`}
        >
          I
        </button>
        <span className="ml-auto truncate text-[9px] text-white/40">
          {family.label} · {FONT_WEIGHT_LABELS[typography.fontWeight]}
        </span>
      </div>
      {showAlignment ? (
        <TextAlignmentButtons
          resolvedAlignment={resolvedTextAlignment}
          overrideState={textAlignmentOverride === undefined ? 'automatic' : 'explicit'}
          onSet={(alignment) =>
            onChange(setOrderDocumentTextAlignment(template, target, alignment))
          }
          onReset={() => onChange(resetOrderDocumentTextAlignment(template, target))}
        />
      ) : null}
    </section>
  );
}

function OrderDocumentBatchTypographyControls({
  template,
  targets,
  onChange
}: {
  template: OrderDocumentTemplate;
  targets: readonly OrderDocumentTypographyTarget[];
  onChange: (template: OrderDocumentTemplate) => void;
}) {
  const mixed = resolveOrderDocumentMixedTypography(template, targets);
  if (!mixed) return null;
  const mixedTextAlignment = resolveOrderDocumentMixedTextAlignment(template, targets);
  if (!mixedTextAlignment) return null;
  const resolved = targets.map((target) => resolveOrderDocumentTypography(template, target));
  const families = resolved.map((typography) =>
    ORDER_DOCUMENT_FONT_FAMILY_CATALOG.find((candidate) => candidate.id === typography.fontFamily)
      ?? ORDER_DOCUMENT_FONT_FAMILY_CATALOG[0]
  );
  const supportedWeights = ORDER_DOCUMENT_FONT_WEIGHT_IDS.filter((weight) =>
    families.every((family) => family.faces.some((face) => face.weight === weight))
  );
  const italicSupported = resolved.every((typography, index) =>
    families[index].faces.some((face) =>
      face.weight === typography.fontWeight && face.style === 'italic'
    )
  );
  const overrides = targets.map((target) => getOrderDocumentTypographyOverride(template, target));
  const overrideLabel = overrides.every(Boolean)
    ? 'Prilagojeno'
    : overrides.some(Boolean)
      ? 'Mešano'
      : 'Podedovano';
  const apply = (updates: Partial<OrderDocumentTypography>) =>
    onChange(applyOrderDocumentTypographyToTargets(template, targets, updates));

  return (
    <section
      data-order-document-batch-typography-controls
      data-order-document-typography-batch={targets.length}
      data-order-document-typography-mixed={Object.values(mixed).some((field) => field.mixed) || undefined}
      className={'space-y-2'}
    >
      <div className={'flex items-center justify-between gap-2'}>
        <div className={'flex min-w-0 items-center gap-1.5'}>
          <Type className={'h-3.5 w-3.5 shrink-0 text-blue-200'} />
          <span className={'truncate text-[10px] font-bold uppercase tracking-[0.1em] text-white/75'}>
            Tipografija · {targets.length} izbranih
          </span>
          <span className={'rounded bg-white/8 px-1.5 py-0.5 text-[8px] font-semibold text-white/45'}>
            {overrideLabel}
          </span>
        </div>
        <button
          type={'button'}
          data-order-document-typography-reset
          disabled={!overrides.some(Boolean)}
          onClick={() => onChange(resetOrderDocumentTypographyTargets(template, targets))}
          className={'grid h-7 w-7 shrink-0 place-items-center rounded-md border border-white/15 bg-white/5 text-white/70 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-30'}
          aria-label={'Ponastavi tipografijo vseh izbranih elementov'}
        >
          <RotateCcw className={'h-3 w-3'} />
        </button>
      </div>

      <div className={'grid grid-cols-[minmax(0,1.35fr)_minmax(0,.9fr)_4rem] gap-1.5'}>
        <label className={'min-w-0'}>
          <span className={'mb-1 block text-[8px] font-bold uppercase tracking-[0.08em] text-white/45'} data-order-document-typography-visible-label={'fontFamily'}>
            Družina pisave
          </span>
          <CompactDarkSelect
            marker="fontFamily"
            label="Pisava vseh izbranih elementov"
            value={mixed.fontFamily.mixed ? '' : mixed.fontFamily.value}
            placeholder="Različno"
            options={ORDER_DOCUMENT_FONT_FAMILY_CATALOG.map((candidate) => ({
              value: candidate.id,
              label: candidate.label
            }))}
            onChange={(fontFamily) => {
              let next = template;
              for (const target of targets) {
                const current = resolveOrderDocumentTypography(next, target);
                const supported = resolveSupportedOrderDocumentTypography({ ...current, fontFamily });
                next = setOrderDocumentTypography(next, target, {
                  fontFamily,
                  ...(supported.fontWeight === current.fontWeight
                    ? {}
                    : { fontWeight: supported.fontWeight }),
                  ...(supported.fontStyle === current.fontStyle
                    ? {}
                    : { fontStyle: supported.fontStyle })
                });
              }
              onChange(next);
            }}
          />
        </label>
        <label className={'min-w-0'}>
          <span className={'mb-1 block text-[8px] font-bold uppercase tracking-[0.08em] text-white/45'} data-order-document-typography-visible-label={'fontWeight'}>
            Debelina
          </span>
          <CompactDarkSelect
            marker="fontWeight"
            label="Debelina vseh izbranih elementov"
            value={mixed.fontWeight.mixed ? '' : mixed.fontWeight.value}
            placeholder="Različno"
            options={supportedWeights.map((weight) => ({
              value: weight,
              label: FONT_WEIGHT_LABELS[weight]
            }))}
            onChange={(fontWeight) => apply({ fontWeight })}
          />
        </label>
        <label className={'min-w-0'}>
          <span className={'mb-1 block text-[8px] font-bold uppercase tracking-[0.08em] text-white/45'} data-order-document-typography-visible-label={'fontSizePt'}>
            Velikost
          </span>
          <input
            type={'number'}
            data-order-document-typography-control={'fontSizePt'}
            value={mixed.fontSizePt.mixed ? '' : mixed.fontSizePt.value}
            placeholder={'Različno'}
            min={ORDER_DOCUMENT_FONT_SIZE_MIN_PT}
            max={ORDER_DOCUMENT_FONT_SIZE_MAX_PT}
            step={ORDER_DOCUMENT_FONT_SIZE_STEP_PT}
            onChange={(event) => {
              const fontSizePt = event.currentTarget.valueAsNumber;
              if (Number.isFinite(fontSizePt)) apply({ fontSizePt });
            }}
            className={`${typographyControlClassName} text-right tabular-nums`}
            aria-label={'Velikost pisave vseh izbranih elementov'}
          />
        </label>
      </div>
      <div className={'flex items-center gap-1.5'}>
        <button
          type={'button'}
          data-order-document-typography-control={'fontWeightBold'}
          aria-label={'Krepko besedilo'}
          aria-pressed={mixed.fontWeight.mixed
            ? 'mixed'
            : mixed.fontWeight.value === 'bold'}
          disabled={!supportedWeights.includes('bold')}
          onClick={() => apply({
            fontWeight: !mixed.fontWeight.mixed && mixed.fontWeight.value === 'bold'
              ? 'regular'
              : 'bold'
          })}
          className={'grid h-7 w-8 place-items-center rounded-md border border-white/15 bg-white/5 text-white/75 transition hover:bg-white/10 disabled:opacity-30'}
        >
          <Bold className={'h-3.5 w-3.5'} />
        </button>
        <button
          type={'button'}
          data-order-document-typography-control={'fontStyle'}
          aria-label={'Ležeče besedilo'}
          aria-pressed={mixed.fontStyle.mixed
            ? 'mixed'
            : mixed.fontStyle.value === 'italic'}
          disabled={!italicSupported}
          onClick={() => apply({
            fontStyle: !mixed.fontStyle.mixed && mixed.fontStyle.value === 'italic'
              ? 'normal'
              : 'italic'
          })}
          className={'grid h-7 w-8 place-items-center rounded-md border border-white/15 bg-white/5 text-[13px] italic text-white/75 transition hover:bg-white/10 disabled:opacity-30'}
        >
          I
        </button>
        {Object.values(mixed).some((field) => field.mixed) ? (
          <span className={'ml-auto text-[9px] font-semibold text-amber-200'}>Različne vrednosti</span>
        ) : null}
      </div>
      <TextAlignmentButtons
        resolvedAlignment={mixedTextAlignment.value}
        overrideState={mixedTextAlignment.overrideState}
        mixed={mixedTextAlignment.mixed}
        batchCount={targets.length}
        onSet={(alignment) => onChange(
          applyOrderDocumentTextAlignmentToTargets(template, targets, alignment)
        )}
        onReset={() => onChange(
          resetOrderDocumentTextAlignmentTargets(template, targets)
        )}
      />
    </section>
  );
}

const ORDER_DOCUMENT_INLINE_ALIGNMENT_OPTIONS = [
  'inherit',
  'left',
  'center',
  'right',
  'justify'
] as const;

function OrderDocumentInlineTypographyControls({
  template,
  targets,
  onChange
}: {
  template: OrderDocumentTemplate;
  targets: readonly OrderDocumentTypographyTarget[];
  onChange: (template: OrderDocumentTemplate) => void;
}) {
  const mixed = resolveOrderDocumentMixedTypography(template, targets);
  const mixedTextAlignment = resolveOrderDocumentMixedTextAlignment(template, targets);
  if (!mixed || !mixedTextAlignment || targets.length === 0) return null;

  const resolved = targets.map((target) => resolveOrderDocumentTypography(template, target));
  const families = resolved.map((typography) =>
    ORDER_DOCUMENT_FONT_FAMILY_CATALOG.find((candidate) => candidate.id === typography.fontFamily)
      ?? ORDER_DOCUMENT_FONT_FAMILY_CATALOG[0]
  );
  const supportedWeights = ORDER_DOCUMENT_FONT_WEIGHT_IDS.filter((weight) =>
    families.every((family) => family.faces.some((face) => face.weight === weight))
  );
  const italicSupported = resolved.every((typography, index) =>
    families[index].faces.some((face) =>
      face.weight === typography.fontWeight && face.style === 'italic'
    )
  );
  const typographyMixed = Object.values(mixed).some((field) => field.mixed);
  const alignmentMixed = mixedTextAlignment.mixed || mixedTextAlignment.overrideState === 'mixed';
  const alignmentValue: (typeof ORDER_DOCUMENT_INLINE_ALIGNMENT_OPTIONS)[number] =
    mixedTextAlignment.overrideState === 'automatic'
      || alignmentMixed
      || mixedTextAlignment.value === 'distributed'
      ? 'inherit'
      : mixedTextAlignment.value;
  const apply = (updates: Partial<OrderDocumentTypography>) =>
    onChange(applyOrderDocumentTypographyToTargets(template, targets, updates));

  return (
    <div
      className="flex min-h-7 min-w-0 flex-1 flex-wrap items-center gap-1"
      data-order-document-inline-typography
      data-order-document-inline-typography-targets={targets.length}
      data-order-document-inline-typography-mixed={typographyMixed || alignmentMixed || undefined}
    >
      {typographyMixed || alignmentMixed ? (
        <span
          className="inline-flex h-7 items-center rounded-md border border-amber-300/25 bg-amber-300/10 px-2 text-[8px] font-bold uppercase tracking-[0.08em] text-amber-100"
          data-order-document-inline-style-mixed
        >
          Mešano
        </span>
      ) : null}
      <AppearanceEditorCompactSelect
        value={mixed.fontFamily.mixed ? '' : mixed.fontFamily.value}
        placeholder="Različne pisave"
        ariaLabel="Pisava izbranih besedil"
        marker="order-document.inline.font-family"
        options={ORDER_DOCUMENT_FONT_FAMILY_CATALOG.map((candidate) => ({
          value: candidate.id,
          label: candidate.label
        }))}
        onValueChange={(fontFamily) => {
          let next = template;
          for (const target of targets) {
            const current = resolveOrderDocumentTypography(next, target);
            const supported = resolveSupportedOrderDocumentTypography({ ...current, fontFamily });
            next = setOrderDocumentTypography(next, target, {
              fontFamily,
              ...(supported.fontWeight === current.fontWeight
                ? {}
                : { fontWeight: supported.fontWeight }),
              ...(supported.fontStyle === current.fontStyle
                ? {}
                : { fontStyle: supported.fontStyle })
            });
          }
          onChange(next);
        }}
        className="w-36"
        triggerClassName="!h-7 !rounded-md !px-2 !text-[9px]"
      />
      <AppearanceEditorCompactSelect
        value={mixed.fontWeight.mixed ? '' : mixed.fontWeight.value}
        placeholder="Različno"
        ariaLabel="Debelina izbranih besedil"
        marker="order-document.inline.font-weight"
        options={supportedWeights.map((fontWeight) => ({
          value: fontWeight,
          label: FONT_WEIGHT_LABELS[fontWeight]
        }))}
        onValueChange={(fontWeight) => apply({ fontWeight })}
        className="w-24"
        triggerClassName="!h-7 !rounded-md !px-2 !text-[9px]"
      />
      <label className="relative block w-[4.5rem]" data-order-document-inline-font-size>
        <span className="sr-only">Velikost pisave</span>
        <input
          type="number"
          value={mixed.fontSizePt.mixed ? '' : mixed.fontSizePt.value}
          placeholder="—"
          min={ORDER_DOCUMENT_FONT_SIZE_MIN_PT}
          max={ORDER_DOCUMENT_FONT_SIZE_MAX_PT}
          step={ORDER_DOCUMENT_FONT_SIZE_STEP_PT}
          onChange={(event) => {
            const fontSizePt = event.currentTarget.valueAsNumber;
            if (Number.isFinite(fontSizePt)) apply({ fontSizePt });
          }}
          className="h-7 w-full rounded-md border border-white/15 bg-slate-800 px-2 pr-6 text-right text-[9px] tabular-nums text-white outline-none transition hover:border-white/25 focus:border-blue-300 focus:ring-1 focus:ring-blue-300/35"
        />
        <span className="pointer-events-none absolute inset-y-0 right-1.5 flex items-center text-[8px] text-white/40">pt</span>
      </label>
      <button
        type="button"
        data-order-document-inline-bold
        aria-label="Krepko besedilo"
        aria-pressed={mixed.fontWeight.mixed ? 'mixed' : mixed.fontWeight.value === 'bold'}
        disabled={!supportedWeights.includes('bold')}
        onClick={() => apply({
          fontWeight: !mixed.fontWeight.mixed && mixed.fontWeight.value === 'bold'
            ? 'regular'
            : 'bold'
        })}
        className="grid h-7 w-7 place-items-center rounded-md border border-white/15 bg-white/5 text-white/70 transition hover:bg-white/10 disabled:opacity-30"
      >
        <Bold className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        data-order-document-inline-italic
        aria-label="Ležeče besedilo"
        aria-pressed={mixed.fontStyle.mixed ? 'mixed' : mixed.fontStyle.value === 'italic'}
        disabled={!italicSupported}
        onClick={() => apply({
          fontStyle: !mixed.fontStyle.mixed && mixed.fontStyle.value === 'italic'
            ? 'normal'
            : 'italic'
        })}
        className="grid h-7 w-7 place-items-center rounded-md border border-white/15 bg-white/5 text-[12px] italic text-white/70 transition hover:bg-white/10 disabled:opacity-30"
      >
        I
      </button>
      <div data-order-document-inline-alignment data-order-document-inline-alignment-mixed={alignmentMixed || undefined}>
        <AppearanceEditorAlignmentControl
          value={alignmentValue}
          options={ORDER_DOCUMENT_INLINE_ALIGNMENT_OPTIONS}
          mixed={alignmentMixed}
          ariaLabel={alignmentMixed
            ? 'Poravnava izbranih besedil: mešane vrednosti'
            : 'Poravnava izbranih besedil'}
          onValueChange={(alignment) => onChange(
            alignment === 'inherit'
              ? resetOrderDocumentTextAlignmentTargets(template, targets)
              : applyOrderDocumentTextAlignmentToTargets(template, targets, alignment)
          )}
          className="!h-7"
        />
      </div>
      <button
        type="button"
        data-order-document-inline-style-reset
        onClick={() => onChange(resetOrderDocumentTextAlignmentTargets(
          resetOrderDocumentTypographyTargets(template, targets),
          targets
        ))}
        className="grid h-7 w-7 place-items-center rounded-md border border-white/15 bg-white/5 text-white/65 transition hover:bg-white/10 hover:text-white"
        aria-label="Ponastavi skupni slog"
        title="Ponastavi slog"
      >
        <RotateCcw className="h-3 w-3" />
      </button>
    </div>
  );
}

function CompactDecorationNumber({
  label,
  value,
  min,
  max,
  step,
  onChange,
  marker
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  marker: string;
}) {
  return (
    <label className="flex h-8 min-w-0 items-center gap-2 rounded-md border border-white/15 bg-white/5 px-2 text-[9px] font-semibold text-white/55">
      <span className="min-w-0 flex-1 truncate">{label}</span>
      <span className="relative w-[4.8rem] shrink-0">
        <input
          type="number"
          value={value}
          min={min}
          max={max}
          step={step}
          data-order-document-decoration-control={marker}
          onChange={(event) => {
            const next = event.currentTarget.valueAsNumber;
            if (Number.isFinite(next)) onChange(next);
          }}
          className="h-6 w-full rounded border border-white/10 bg-slate-800 pl-1.5 pr-5 text-right text-[10px] font-semibold tabular-nums text-white outline-none focus:border-blue-300"
          aria-label={`${label} v točkah`}
        />
        <span className="pointer-events-none absolute inset-y-0 right-1.5 flex items-center text-[8px] text-white/35">pt</span>
      </span>
    </label>
  );
}

function OrderDocumentDecorationControls({
  template,
  target,
  onChange
}: {
  template: OrderDocumentTemplate;
  target: OrderDocumentDecorationTarget;
  onChange: (template: OrderDocumentTemplate) => void;
}) {
  const decoration = resolveOrderDocumentDecoration(template, target);
  const override = getOrderDocumentDecorationOverride(template, target);
  const targetKey = target.kind === 'element'
    ? `element-${target.elementId}`
    : `row-${target.group}-${target.rowId}`;
  const update = (patch: Parameters<typeof setOrderDocumentDecoration>[2]) =>
    onChange(setOrderDocumentDecoration(template, target, patch));
  const toggleOutlineSide = (side: OrderDocumentDecorationSide) => {
    const included = decoration.outlineSides.includes(side);
    const outlineSides = included
      ? decoration.outlineSides.filter((candidate) => candidate !== side)
      : [...decoration.outlineSides, side];
    update({ outlineSides });
  };

  const toggleClass = (active: boolean) => `h-7 rounded-md border px-2 text-[9px] font-semibold transition ${
    active
      ? 'border-blue-300/45 bg-blue-400/20 text-blue-100'
      : 'border-white/15 bg-white/5 text-white/60 hover:bg-white/10 hover:text-white'
  }`;

  return (
    <section
      data-order-document-decoration-controls
      data-order-document-decoration-target={target.kind}
      className="space-y-2 border-t border-white/10 pt-2.5 first:border-t-0 first:pt-0"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <Palette className="h-3.5 w-3.5 shrink-0 text-blue-200" />
          <span className="truncate text-[10px] font-bold uppercase tracking-[0.1em] text-white/75">Okvir in poudarki</span>
          <span className="rounded bg-white/8 px-1.5 py-0.5 text-[8px] font-semibold text-white/45">
            {override ? 'Prilagojeno' : 'Podedovano'}
          </span>
        </div>
        <button
          type="button"
          data-order-document-decoration-reset
          disabled={!override}
          onClick={() => onChange(resetOrderDocumentDecoration(template, target))}
          className="grid h-7 w-7 shrink-0 place-items-center rounded-md border border-white/15 bg-white/5 text-white/70 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
          aria-label="Ponastavi okvir in poudarke"
          title="Podeduj videz"
        >
          <RotateCcw className="h-3 w-3" />
        </button>
      </div>

      <div className="grid grid-cols-3 gap-1.5" data-order-document-decoration-toggles>
        <button type="button" data-order-document-decoration-toggle="fill" aria-pressed={decoration.fillEnabled} onClick={() => update({ fillEnabled: !decoration.fillEnabled })} className={toggleClass(decoration.fillEnabled)}>
          Polnilo
        </button>
        <button type="button" data-order-document-decoration-toggle="outline" aria-pressed={decoration.outlineEnabled} onClick={() => update({ outlineEnabled: !decoration.outlineEnabled })} className={toggleClass(decoration.outlineEnabled)}>
          Obroba
        </button>
        <button type="button" data-order-document-decoration-toggle="accent" aria-pressed={decoration.accentEnabled} onClick={() => update({ accentEnabled: !decoration.accentEnabled })} className={toggleClass(decoration.accentEnabled)}>
          Poudarek
        </button>
      </div>

      {decoration.fillEnabled ? (
        <CompactHexColorField
          id={`order-document-decoration-${targetKey}-fill`}
          label="Barva polnila"
          value={decoration.fillColor}
          marker={`decoration.${targetKey}.fillColor`}
          onChange={(fillColor) => update({ fillColor })}
        />
      ) : null}

      {decoration.outlineEnabled ? (
        <div className="grid grid-cols-2 gap-1.5" data-order-document-decoration-section="outline">
          <CompactHexColorField
            id={`order-document-decoration-${targetKey}-outline`}
            label="Barva obrobe"
            value={decoration.outlineColor}
            marker={`decoration.${targetKey}.outlineColor`}
            onChange={(outlineColor) => update({ outlineColor })}
          />
          <CompactDecorationNumber label="Debelina" value={decoration.outlineWidthPt} min={0.25} max={12} step={0.25} marker="outlineWidthPt" onChange={(outlineWidthPt) => update({ outlineWidthPt })} />
          <div className="col-span-full flex items-center gap-1.5 rounded-md border border-white/10 bg-white/5 p-1">
            <span className="pl-1 text-[9px] font-semibold text-white/45">Stranice</span>
            <span className="ml-auto grid grid-cols-4 gap-1">
              {ORDER_DOCUMENT_DECORATION_SIDES.map((side) => (
                <button
                  key={side}
                  type="button"
                  data-order-document-decoration-outline-side={side}
                  aria-pressed={decoration.outlineSides.includes(side)}
                  onClick={() => toggleOutlineSide(side)}
                  className={`grid h-6 w-6 place-items-center rounded border text-[8px] font-bold ${
                    decoration.outlineSides.includes(side)
                      ? 'border-blue-300/45 bg-blue-400/20 text-blue-100'
                      : 'border-white/10 text-white/45 hover:bg-white/10'
                  }`}
                  title={{ left: 'Levo', right: 'Desno', top: 'Zgoraj', bottom: 'Spodaj' }[side]}
                >
                  {{ left: 'L', right: 'D', top: 'Z', bottom: 'S' }[side]}
                </button>
              ))}
            </span>
          </div>
        </div>
      ) : null}

      {decoration.accentEnabled ? (
        <div className="grid grid-cols-2 gap-1.5" data-order-document-decoration-section="accent">
          <CompactHexColorField
            id={`order-document-decoration-${targetKey}-accent`}
            label="Barva poudarka"
            value={decoration.accentColor}
            marker={`decoration.${targetKey}.accentColor`}
            onChange={(accentColor) => update({ accentColor })}
          />
          <CompactDecorationNumber label="Debelina" value={decoration.accentWidthPt} min={0.25} max={24} step={0.25} marker="accentWidthPt" onChange={(accentWidthPt) => update({ accentWidthPt })} />
          <div className="col-span-full grid grid-cols-4 gap-1">
            {ORDER_DOCUMENT_DECORATION_SIDES.map((side) => (
              <button
                key={side}
                type="button"
                data-order-document-decoration-accent-side={side}
                aria-pressed={decoration.accentSide === side}
                onClick={() => update({ accentSide: side })}
                className={toggleClass(decoration.accentSide === side)}
              >
                {{ left: 'Levo', right: 'Desno', top: 'Zgoraj', bottom: 'Spodaj' }[side]}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <CompactDecorationNumber label="Notranji odmik" value={decoration.paddingPt} min={0} max={36} step={0.5} marker="paddingPt" onChange={(paddingPt) => update({ paddingPt })} />
      <p className="sr-only" data-order-document-decoration-automatic-inset>
        Ob okvirju se vedno doda enak osnovni odmik zgoraj, spodaj in ob poravnani stranici.
      </p>
    </section>
  );
}

type OrderDocumentToolbarPanel = 'all' | 'geometry' | 'content' | 'style' | 'logic' | null;
type OrderDocumentToolbarSection = Exclude<OrderDocumentToolbarPanel, 'all' | null>;

function OrderDocumentContextToolbar({
  anchorId,
  label,
  initialPanel = null,
  childEditor,
  childActions,
  inlineStyleControls,
  compactGeometryAction = false,
  compactStyleAction = false,
  showElementActions = true,
  multiSelectionCount = 0,
  geometryPanel,
  contentPanel,
  stylePanel,
  logicPanel,
  visible,
  locked,
  onToggleVisible,
  onToggleLocked,
  onDelete,
  onBeginEdit,
  onCancelEdit,
  onCommitEdit,
  onClose
}: {
  anchorId: string;
  label: string;
  initialPanel?: OrderDocumentToolbarPanel;
  childEditor?: ReactNode;
  childActions?: ReactNode;
  inlineStyleControls?: ReactNode;
  compactGeometryAction?: boolean;
  compactStyleAction?: boolean;
  showElementActions?: boolean;
  multiSelectionCount?: number;
  geometryPanel: ReactNode;
  contentPanel: ReactNode;
  stylePanel: ReactNode;
  logicPanel: ReactNode;
  visible: boolean;
  locked: boolean;
  onToggleVisible: () => void;
  onToggleLocked: () => void;
  onDelete: () => void;
  onBeginEdit: () => void;
  onCancelEdit: () => void;
  onCommitEdit: () => void;
  onClose: () => void;
}) {
  const [panel, setPanel] = useState<OrderDocumentToolbarPanel>(initialPanel);
  const toolbarRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const toolbarDismissRefs = useMemo(() => [toolbarRef], []);
  const panelPortalRefs = useMemo(() => [panelRef], []);
  const compactChildMode = Boolean(childEditor || childActions);

  const restorePanelTriggerFocus = (activePanel: Exclude<OrderDocumentToolbarPanel, null>) => {
    window.requestAnimationFrame(() => toolbarRef.current?.querySelector<HTMLElement>(
      `[data-order-document-toolbar-panel-trigger=${activePanel}]`
    )?.focus());
  };
  const cancelDialog = (restoreFocus = false) => {
    if (!panel) return;
    const activePanel = panel;
    onCancelEdit();
    setPanel(null);
    if (restoreFocus) restorePanelTriggerFocus(activePanel);
  };
  const commitDialog = () => {
    if (!panel) return;
    const activePanel = panel;
    onCommitEdit();
    setPanel(null);
    restorePanelTriggerFocus(activePanel);
  };
  const togglePanel = (nextPanel: Exclude<OrderDocumentToolbarPanel, null>) => {
    if (panel === nextPanel) {
      cancelDialog(true);
      return;
    }
    if (!panel) onBeginEdit();
    setPanel(nextPanel);
  };

  useDropdownDismiss({
    open: Boolean(panel),
    refs: toolbarDismissRefs,
    portalRefs: panelPortalRefs,
    ignoreSelector: ORDER_DOCUMENT_NESTED_POPOVER_SELECTOR,
    ignoreEscapeSelector: ORDER_DOCUMENT_NESTED_POPOVER_SELECTOR,
    dismissGroup: 'order-document-settings-dialog',
    onClose: () => cancelDialog(false)
  });
  useEffect(() => {
    if (!panel) return undefined;
    const previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const focusDialog = window.requestAnimationFrame(() => {
      panelRef.current?.querySelector<HTMLElement>('[data-order-document-dialog-initial-focus]')?.focus();
    });
    const trapFocus = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;
      if (event.target instanceof Element && event.target.closest(ORDER_DOCUMENT_NESTED_POPOVER_SELECTOR)) return;
      const focusable = Array.from(panelRef.current?.querySelectorAll<HTMLElement>(
        'button:not(:disabled), input:not(:disabled), [href], [tabindex]:not([tabindex="-1"])'
      ) ?? []).filter((candidate) => candidate.getClientRects().length > 0);
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable.at(-1) ?? first;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', trapFocus);
    return () => {
      window.cancelAnimationFrame(focusDialog);
      document.removeEventListener('keydown', trapFocus);
      document.body.style.overflow = previousBodyOverflow;
    };
  }, [panel]);

  const panels: Record<OrderDocumentToolbarSection, ReactNode> = {
    geometry: geometryPanel,
    content: contentPanel,
    style: stylePanel,
    logic: logicPanel
  };
  const panelTitles: Record<Exclude<OrderDocumentToolbarPanel, null>, string> = {
    all: 'Nastavitve elementa',
    geometry: 'Postavitev',
    content: 'Vsebina',
    style: 'Videz',
    logic: 'Logika'
  };
  const panelIcons = {
    all: SlidersHorizontal,
    geometry: Move,
    content: Type,
    style: Palette,
    logic: Settings2
  } satisfies Record<Exclude<OrderDocumentToolbarPanel, null>, typeof SlidersHorizontal>;
  const unifiedPanelKeys: readonly OrderDocumentToolbarSection[] = multiSelectionCount > 1
    ? ['geometry', 'style']
    : compactChildMode || !showElementActions
      ? compactGeometryAction ? ['geometry', 'style'] : ['style']
      : ['geometry', 'content', 'style', 'logic'];
  const availablePanels: readonly Exclude<OrderDocumentToolbarPanel, null>[] = compactChildMode
    ? ['all', ...unifiedPanelKeys]
    : ['all', 'geometry', 'content', 'style', 'logic'];
  const ActivePanelIcon = panel ? panelIcons[panel] : SlidersHorizontal;
  const dialogTitleId = useId();

  return (
    <div
      ref={toolbarRef}
      data-testid="order-document-element-inspector"
      data-order-document-multi-selection={multiSelectionCount > 1 ? multiSelectionCount : undefined}
      data-order-document-parent-actions-enabled={showElementActions || undefined}
      data-logo-context-toolbar={anchorId === 'logo' ? '' : undefined}
      className="relative"
      onPointerDown={(event) => event.stopPropagation()}
    >
      <AppearanceEditorToolbarToneProvider tone="dark">
        <div
          className="flex min-w-0 flex-wrap items-center gap-0.5 overflow-visible"
          data-order-document-toolbar-wrap="visible"
        >
          <span
            className="mr-1 inline-flex h-8 max-w-44 min-w-0 items-center gap-1.5 rounded-lg bg-white/10 px-2.5 text-[11px] font-semibold text-white"
            title={label}
            data-order-document-selection-summary
            aria-live="polite"
          >
            <span className="min-w-0 truncate">{label}</span>
            {multiSelectionCount > 1 ? (
              <span className="shrink-0 rounded-full bg-blue-500 px-1.5 py-0.5 text-[8px] font-bold text-white">
                {multiSelectionCount}
              </span>
            ) : null}
          </span>
          <AppearanceEditorToolbarDivider />
          {compactChildMode ? (
            <>
              <AppearanceEditorToolbarButton
                label="Vse nastavitve"
                popover
                data-order-document-toolbar-panel-trigger={'all'}
                active={panel === 'all'}
                onClick={() => togglePanel('all')}
              >
                <SlidersHorizontal className="h-3.5 w-3.5" />
              </AppearanceEditorToolbarButton>
              <AppearanceEditorToolbarDivider />
              <div className="min-w-32 max-w-52 flex-1 px-1" data-order-document-child-editor>
                {childEditor ?? (
                  <span className="flex h-8 items-center truncate px-2 text-[11px] font-semibold text-white/85">
                    {label}
                  </span>
                )}
              </div>
              {childActions ? (
                <>
                  <AppearanceEditorToolbarDivider />
                  {childActions}
                </>
              ) : null}
              {compactGeometryAction ? (
                <>
                  <AppearanceEditorToolbarDivider />
                  <AppearanceEditorToolbarButton
                    label="Položaj vrstice"
                    popover
                    data-order-document-toolbar-panel-trigger={'geometry'}
                    active={panel === 'geometry'}
                    onClick={() => togglePanel('geometry')}
                  >
                    <Move className="h-3.5 w-3.5" />
                  </AppearanceEditorToolbarButton>
                </>
              ) : null}
              {compactStyleAction ? (
                <>
                  <AppearanceEditorToolbarDivider />
                  <AppearanceEditorToolbarButton
                    label="Tipografija, okvir in poudarki"
                    popover
                    data-order-document-toolbar-panel-trigger={'style'}
                    active={panel === 'style'}
                    onClick={() => togglePanel('style')}
                  >
                    <Palette className="h-3.5 w-3.5" />
                  </AppearanceEditorToolbarButton>
                </>
              ) : null}
            </>
          ) : (
            <>
              <AppearanceEditorToolbarButton
                label="Vse nastavitve"
                popover
                data-order-document-toolbar-panel-trigger={'all'}
                active={panel === 'all'}
                onClick={() => togglePanel('all')}
              >
                <SlidersHorizontal className="h-3.5 w-3.5" />
              </AppearanceEditorToolbarButton>
              <AppearanceEditorToolbarDivider />
              <AppearanceEditorToolbarButton
                label="Položaj in velikost"
                popover
                data-order-document-toolbar-panel-trigger={'geometry'}
                active={panel === 'geometry'}
                onClick={() => togglePanel('geometry')}
              >
                <Move className="h-3.5 w-3.5" />
              </AppearanceEditorToolbarButton>
              <AppearanceEditorToolbarButton
                label="Vsebina"
                popover
                data-order-document-toolbar-panel-trigger={'content'}
                active={panel === 'content'}
                onClick={() => togglePanel('content')}
              >
                <SlidersHorizontal className="h-3.5 w-3.5" />
              </AppearanceEditorToolbarButton>
              <AppearanceEditorToolbarButton
                label="Videz"
                popover
                data-order-document-toolbar-panel-trigger={'style'}
                active={panel === 'style'}
                onClick={() => togglePanel('style')}
              >
                <Palette className="h-3.5 w-3.5" />
              </AppearanceEditorToolbarButton>
              <AppearanceEditorToolbarButton
                label="Logika"
                popover
                data-order-document-toolbar-panel-trigger={'logic'}
                active={panel === 'logic'}
                onClick={() => togglePanel('logic')}
              >
                <Settings2 className="h-3.5 w-3.5" />
              </AppearanceEditorToolbarButton>
              {showElementActions ? (
                <>
              <AppearanceEditorToolbarDivider />
              <span data-testid="order-document-element-visible" aria-pressed={visible}>
                <AppearanceEditorToolbarButton
                  label={visible ? 'Skrij element' : 'Prikaži element'}
                  pressed={visible}
                  onClick={onToggleVisible}
                >
                  {visible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                </AppearanceEditorToolbarButton>
              </span>
              <span data-testid="order-document-element-delete">
                <AppearanceEditorToolbarButton
                  label="Izbriši element"
                  onClick={onDelete}
                >
                  <Trash2 className={'h-3.5 w-3.5'} />
                </AppearanceEditorToolbarButton>
              </span>
              <AppearanceEditorToolbarButton
                label={locked ? 'Odkleni položaj' : 'Zakleni položaj'}
                pressed={locked}
                onClick={onToggleLocked}
              >
                {locked ? <Lock className="h-3.5 w-3.5" /> : <Unlock className="h-3.5 w-3.5" />}
              </AppearanceEditorToolbarButton>
                </>
              ) : null}
            </>
          )}
          {inlineStyleControls ? (
            <>
              <AppearanceEditorToolbarDivider />
              <div
                className="flex min-w-0 flex-1 basis-[32rem] px-1"
                data-order-document-inline-style-surface
              >
                {inlineStyleControls}
              </div>
            </>
          ) : null}
          <AppearanceEditorToolbarDivider />
          <AppearanceEditorToolbarButton label="Zapri" onClick={onClose}>
            <X className="h-3.5 w-3.5" />
          </AppearanceEditorToolbarButton>
        </div>
      </AppearanceEditorToolbarToneProvider>

      {panel && (panel === 'all' || !compactChildMode || panel === 'style' || (panel === 'geometry' && compactGeometryAction)) && typeof document !== 'undefined'
        ? createPortal(
          <div
            className="fixed inset-0 z-[2147483646] grid place-items-center bg-slate-950/65 p-4 backdrop-blur-[3px] sm:p-6"
            data-order-document-settings-dialog-backdrop
            data-order-document-settings-dialog-layout="centered"
          >
            <div
              ref={panelRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby={dialogTitleId}
              data-order-document-toolbar-popover
              data-order-document-settings-surface
              data-order-document-settings-dialog="navy"
              className="flex w-[min(1180px,calc(100vw-2rem))] flex-col overflow-visible rounded-2xl border border-white/15 bg-[#17212d] text-white shadow-[0_32px_90px_rgba(2,6,23,.68)]"
            >
              <header className="rounded-t-2xl border-b border-white/10 bg-[#111923] px-4 pb-3 pt-3.5">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <ActivePanelIcon className="h-4 w-4 shrink-0 text-blue-200" aria-hidden="true" />
                      <h2 id={dialogTitleId} className="truncate text-lg font-semibold tracking-tight text-white">
                        {panelTitles[panel]}
                      </h2>
                    </div>
                    <p className="mt-0.5 truncate text-[10px] font-medium text-white/45">{label}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => cancelDialog(true)}
                    data-order-document-dialog-initial-focus
                    data-order-document-settings-dialog-action="cancel-close"
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-white/10 text-white/70 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300"
                    aria-label="Prekliči in zapri"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="mt-3 flex flex-wrap gap-1" role="toolbar" aria-label="Skupine nastavitev">
                  {availablePanels.map((key) => {
                    const PanelIcon = panelIcons[key];
                    return (
                      <button
                        key={key}
                        type="button"
                        aria-pressed={panel === key}
                        onClick={() => setPanel(key)}
                        className={`inline-flex h-7 items-center gap-1.5 rounded-md border px-2.5 text-[9px] font-bold uppercase tracking-[0.08em] transition ${
                          panel === key
                            ? 'border-blue-300/45 bg-blue-400/20 text-blue-100'
                            : 'border-white/10 bg-white/[.035] text-white/55 hover:bg-white/10 hover:text-white'
                        }`}
                      >
                        <PanelIcon className="h-3 w-3" aria-hidden="true" />
                        {key === 'all' ? 'Vse' : panelTitles[key]}
                      </button>
                    );
                  })}
                </div>
              </header>

              <div
                data-order-document-settings-density="compact"
                data-order-document-settings-scroll="none"
                className="overflow-visible bg-[#17212d] p-3 [&_.bg-slate-100]:!bg-white/10 [&_.bg-slate-50]:!bg-white/5 [&_.bg-white]:!bg-white/10 [&_.border-slate-200]:!border-white/15 [&_.border-slate-300]:!border-white/20 [&_.text-slate-400]:!text-white/55 [&_.text-slate-500]:!text-white/65 [&_.text-slate-600]:!text-white/75 [&_.text-slate-700]:!text-white/85 [&_.text-slate-800]:!text-white/90 [&_.text-slate-900]:!text-white"
              >
                {panel === 'all' ? (
                  <div
                    className="grid grid-cols-4 items-start gap-2.5 max-[1000px]:grid-cols-2 max-[640px]:grid-cols-1"
                    data-order-document-unified-settings-grid
                  >
                    {unifiedPanelKeys.map((key) => {
                      const SectionIcon = panelIcons[key];
                      return (
                        <section
                          key={key}
                          className="min-w-0 rounded-xl border border-white/10 bg-[#1d2936] p-2.5"
                          data-order-document-unified-settings-section={key}
                        >
                          <div className="mb-2 flex items-center gap-1.5 border-b border-white/10 pb-2">
                            <SectionIcon className="h-3.5 w-3.5 text-blue-200" aria-hidden="true" />
                            <h3 className="text-[10px] font-bold uppercase tracking-[0.1em] text-white/70">
                              {panelTitles[key]}
                            </h3>
                          </div>
                          {panels[key]}
                        </section>
                      );
                    })}
                  </div>
                ) : (
                  <section
                    className="rounded-xl border border-white/10 bg-[#1d2936] p-3"
                    data-order-document-settings-dialog-section={panel}
                  >
                    <div className="mb-2.5 flex items-center gap-1.5 border-b border-white/10 pb-2">
                      <ActivePanelIcon className="h-3.5 w-3.5 text-blue-200" aria-hidden="true" />
                      <h3 className="text-[10px] font-bold uppercase tracking-[0.1em] text-white/70">
                        {panelTitles[panel]}
                      </h3>
                    </div>
                    {panels[panel]}
                  </section>
                )}
              </div>

              <footer className="flex items-center justify-between gap-3 rounded-b-2xl border-t border-white/10 bg-[#111923] px-4 py-3">
                <p className="text-[9px] font-medium text-white/40">Spremembe se na dokumentu predogledajo sproti.</p>
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    onClick={() => cancelDialog(true)}
                    data-order-document-settings-dialog-action="cancel"
                    className="h-8 rounded-lg border border-white/15 bg-white/5 px-3 text-[10px] font-semibold text-white/75 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300"
                  >
                    Prekliči
                  </button>
                  <button
                    type="button"
                    onClick={commitDialog}
                    data-order-document-settings-dialog-action="save"
                    className="h-8 rounded-lg border border-blue-300/40 bg-blue-500 px-4 text-[10px] font-bold text-white shadow-sm transition hover:bg-blue-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200"
                  >
                    Shrani
                  </button>
                </div>
              </footer>
            </div>
          </div>,
          document.body
        )
        : null}
    </div>
  );
}

function OrderDocumentCompanyContactsControls({
  template,
  selectedContactId,
  onChange,
  onSelectContact,
  onSelectCompany
}: {
  template: OrderDocumentTemplate;
  selectedContactId: string | null;
  onChange: (template: OrderDocumentTemplate) => void;
  onSelectContact: (contactId: string) => void;
  onSelectCompany: () => void;
}) {
  const contacts = resolveOrderDocumentCompanyContacts(template);
  const selectedIndex = selectedContactId
    ? contacts.findIndex((contact) => contact.id === selectedContactId)
    : -1;
  const selectedContact = selectedIndex >= 0 ? contacts[selectedIndex] : null;
  const commit = (nextContacts: OrderDocumentCompanyContact[]) =>
    onChange(setOrderDocumentCompanyContacts(template, nextContacts));
  const updateSelected = (updates: Partial<OrderDocumentCompanyContact>) => {
    if (!selectedContact) return;
    commit(
      contacts.map((contact) =>
        contact.id === selectedContact.id ? { ...contact, ...updates } : contact
      )
    );
  };
  const moveSelected = (direction: -1 | 1) => {
    if (!selectedContact) return;
    const target = selectedIndex + direction;
    if (target < 0 || target >= contacts.length) return;
    const nextContacts = [...contacts];
    [nextContacts[selectedIndex], nextContacts[target]] = [
      nextContacts[target],
      nextContacts[selectedIndex]
    ];
    commit(nextContacts);
  };

  return (
    <div className="space-y-2" data-order-document-company-contacts>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[9px] font-bold uppercase tracking-[0.12em] text-white/55">
          Kontakti
        </span>
        <button
          type="button"
          data-order-document-company-contact-add
          disabled={contacts.length >= ORDER_DOCUMENT_COMPANY_CONTACT_LIMIT}
          onClick={() => {
            const id = createOrderDocumentCompanyContactId(contacts, 'contact');
            commit([
              ...contacts,
              { id, label: 'Kontakt', value: '', visible: true, emphasis: false }
            ]);
            onSelectContact(id);
          }}
          className="inline-flex h-7 items-center gap-1 rounded-md border border-white/15 bg-white/10 px-2 text-[10px] font-semibold text-white hover:bg-white/15 disabled:opacity-40"
          aria-label="Dodaj kontakt"
          title="Dodaj kontakt"
        >
          <Plus className="h-3 w-3" /> Dodaj
        </button>
      </div>

      {selectedContact ? (
        <div
          data-order-document-company-contact-edit
          className="space-y-1.5 rounded-lg border border-white/15 bg-white/5 p-2"
        >
          <div className="grid grid-cols-[minmax(84px,.7fr)_minmax(0,1.5fr)] gap-1.5">
            <input
              value={selectedContact.label}
              onChange={(event) => updateSelected({ label: event.target.value })}
              className="h-8 min-w-0 rounded-md border border-white/15 bg-white/10 px-2 text-[10px] text-white outline-none placeholder:text-white/35 focus:border-blue-300"
              aria-label="Oznaka kontakta"
              placeholder="Oznaka"
            />
            <input
              value={selectedContact.value}
              onChange={(event) => updateSelected({ value: event.target.value })}
              className="h-8 min-w-0 rounded-md border border-white/15 bg-white/10 px-2 text-[10px] text-white outline-none placeholder:text-white/35 focus:border-blue-300"
              aria-label="Vrednost kontakta"
              placeholder="Vrednost"
            />
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => updateSelected({ visible: !selectedContact.visible })}
              className={`grid h-7 w-7 place-items-center rounded-md border transition ${selectedContact.visible ? 'border-blue-300/40 bg-blue-400/15 text-blue-100' : 'border-white/15 bg-white/5 text-white/55'}`}
              aria-label={selectedContact.visible ? 'Skrij kontakt' : 'Prikaži kontakt'}
              title={selectedContact.visible ? 'Skrij kontakt' : 'Prikaži kontakt'}
              aria-pressed={selectedContact.visible}
            >
              {selectedContact.visible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
            </button>
            <button
              type="button"
              onClick={() => updateSelected({ emphasis: !selectedContact.emphasis })}
              className={`grid h-7 w-7 place-items-center rounded-md border transition ${selectedContact.emphasis ? 'border-blue-300/40 bg-blue-400/15 text-blue-100' : 'border-white/15 bg-white/5 text-white/55'}`}
              aria-label="Poudari kontakt"
              title="Poudari kontakt"
              aria-pressed={selectedContact.emphasis}
            >
              <Bold className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              data-order-document-company-contact-reorder
              disabled={selectedIndex === 0}
              onClick={() => moveSelected(-1)}
              className="grid h-7 w-7 place-items-center rounded-md border border-white/15 bg-white/5 text-white/70 hover:bg-white/10 disabled:opacity-30"
              aria-label="Premakni kontakt navzgor"
              title="Premakni navzgor"
            >
              <ArrowUp className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              data-order-document-company-contact-reorder
              disabled={selectedIndex === contacts.length - 1}
              onClick={() => moveSelected(1)}
              className="grid h-7 w-7 place-items-center rounded-md border border-white/15 bg-white/5 text-white/70 hover:bg-white/10 disabled:opacity-30"
              aria-label="Premakni kontakt navzdol"
              title="Premakni navzdol"
            >
              <ArrowDown className="h-3.5 w-3.5" />
            </button>
            <span className="flex-1" />
            <button
              type="button"
              data-order-document-company-contact-remove
              onClick={() => {
                commit(contacts.filter((contact) => contact.id !== selectedContact.id));
                onSelectCompany();
              }}
              className="grid h-7 w-7 place-items-center rounded-md border border-rose-300/25 bg-rose-500/10 text-rose-100 hover:bg-rose-500/20"
              aria-label="Odstrani kontakt"
              title="Odstrani kontakt"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-1">
          {contacts.map((contact) => (
            <button
              key={contact.id}
              type="button"
              onClick={() => onSelectContact(contact.id)}
              className="flex w-full items-center justify-between gap-2 rounded-lg border border-white/10 bg-white/5 px-2.5 py-2 text-left text-[10px] text-white/85 hover:bg-white/10"
            >
              <span className="truncate">{contact.label || 'Brez oznake'}</span>
              <span className="truncate text-white/55">{contact.value || '—'}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function OrderDocumentFieldRowRestoreControls({
  template,
  group,
  onChange,
  onSelectRow
}: {
  template: OrderDocumentTemplate;
  group: OrderDocumentFieldGroupId;
  onChange: (template: OrderDocumentTemplate) => void;
  onSelectRow: (rowId: OrderDocumentFieldRowId) => void;
}) {
  const rows = resolveOrderDocumentFieldRows(template, group);
  const omittedRows = (ORDER_DOCUMENT_FIELD_ROW_IDS_BY_GROUP[group] as readonly OrderDocumentFieldRowId[])
    .filter((rowId) => !rows.some((row) => row.id === rowId && row.visible));
  if (omittedRows.length === 0) return null;

  const restore = (rowId: OrderDocumentFieldRowId) => {
    const existing = rows.find((row) => row.id === rowId);
    const nextTemplate = existing
      ? setOrderDocumentFieldRows(
          template,
          group,
          rows.map((row) => row.id === rowId ? { ...row, visible: true } : row)
        )
      : restoreOrderDocumentFieldRow(template, group, rowId);
    onChange(nextTemplate);
    onSelectRow(rowId);
  };

  return (
    <div className="space-y-1.5 border-t border-white/15 pt-2" data-order-document-row-restore-menu={group}>
      <span className="text-[9px] font-bold uppercase tracking-[0.12em] text-white/55">
        Dodaj odstranjeno vrstico
      </span>
      <div className="flex flex-wrap gap-1.5">
        {omittedRows.map((rowId) => (
          <button
            key={rowId}
            type="button"
            data-order-document-row-restore={rowId}
            onClick={() => restore(rowId)}
            className="inline-flex h-7 items-center gap-1 rounded-md border border-white/15 bg-white/5 px-2 text-[10px] font-semibold text-white/80 transition hover:bg-white/12 hover:text-white"
            aria-label={`Dodaj ${FIELD_ROW_DISPLAY_NAMES[rowId]}`}
            title={`Dodaj ${FIELD_ROW_DISPLAY_NAMES[rowId]}`}
          >
            <Plus className="h-3 w-3" /> {FIELD_ROW_DISPLAY_NAMES[rowId]}
          </button>
        ))}
      </div>
    </div>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
  multiline = false,
  testId
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  multiline?: boolean;
  testId?: string;
}) {
  return (
    <label htmlFor={id} className="block text-[10px] font-semibold text-slate-600">
      {label}
      {multiline ? (
        <textarea
          id={id}
          rows={2}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className={`${fieldClassName} mt-1 h-auto min-h-12 resize-none py-1.5 leading-4`}
          data-testid={testId}
        />
      ) : (
        <input
          id={id}
          type="text"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className={`${fieldClassName} mt-1`}
          data-testid={testId}
          autoComplete="off"
        />
      )}
    </label>
  );
}

function NumberField({
  id,
  label,
  value,
  min,
  max,
  unit,
  step = 0.1,
  onChange,
  testId
}: {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  unit: string;
  step?: number;
  onChange: (value: number) => void;
  testId?: string;
}) {
  return (
    <label htmlFor={id} className="block text-[10px] font-semibold text-slate-600">
      {label}
      <span className="relative mt-1 block">
        <input
          id={id}
          type="number"
          value={value}
          min={min}
          max={max}
          step={step}
          onChange={(event) => {
            const next = event.currentTarget.valueAsNumber;
            if (Number.isFinite(next)) onChange(next);
          }}
          className={`${fieldClassName} pr-10 tabular-nums`}
          data-testid={testId}
        />
        <span className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center text-[9px] font-normal text-slate-400">
          {unit}
        </span>
      </span>
    </label>
  );
}

function CompactGeometryField({
  label,
  value,
  min,
  max,
  onChange,
  testId
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  testId: string;
}) {
  return (
    <label
      className="flex h-8 min-w-0 items-center rounded-md border border-slate-200 bg-slate-50 pl-2 transition focus-within:border-blue-400 focus-within:bg-white focus-within:ring-2 focus-within:ring-blue-100"
      data-testid={testId}
    >
      <span className="w-3 shrink-0 text-[9px] font-bold uppercase text-slate-400">
        {label}
      </span>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        step={0.1}
        onChange={(event) => {
          const next = event.currentTarget.valueAsNumber;
          if (Number.isFinite(next)) onChange(next);
        }}
        className="h-full min-w-0 flex-1 bg-transparent px-1 text-right text-[11px] font-semibold tabular-nums text-slate-700 outline-none"
        aria-label={`${label} v milimetrih`}
      />
      <span className="shrink-0 pr-1.5 text-[8px] font-medium text-slate-400">mm</span>
    </label>
  );
}

function ColorField({
  id,
  label,
  value,
  inherited,
  onChange,
  testId
}: {
  id: string;
  label: string;
  value: string;
  inherited: string;
  onChange: (value: string) => void;
  testId?: string;
}) {
  return (
    <CompactHexColorField
      id={id}
      label={label}
      value={value}
      inheritedColor={inherited}
      marker={`order-document.${id}`}
      tone="dark"
      layout="compact"
      allowClear
      clearLabel="Podeduj"
      inputAttributes={{
        'aria-label': `${label} – vrednost`,
        'data-testid': testId
      }}
      onChange={onChange}
    />
  );
}

function Toggle({
  id,
  label,
  checked,
  onChange,
  testId
}: {
  id: string;
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  testId?: string;
}) {
  return (
    <label
      htmlFor={id}
      className="flex min-h-7 cursor-pointer items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] font-medium text-slate-700 hover:bg-white"
    >
      <AdminCheckbox
        id={id}
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        data-testid={testId}
      />
      <span>{label}</span>
    </label>
  );
}

function InspectorSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="min-w-0 rounded-lg border border-slate-200 bg-slate-50/50 p-2 first:mt-0">
      <h4 className="mb-1.5 text-[9px] font-bold uppercase tracking-[0.1em] text-slate-400">
        {title}
      </h4>
      <div className="grid gap-1.5 [grid-template-columns:repeat(auto-fit,minmax(min(100%,12rem),1fr))] [&>p]:col-span-full">
        {children}
      </div>
    </section>
  );
}

function ToolbarButton({
  active,
  label,
  children,
  onClick,
  testId,
  buttonRef,
  popover = false
}: {
  active?: boolean;
  label: string;
  children: ReactNode;
  onClick: () => void;
  testId?: string;
  buttonRef?: RefObject<HTMLButtonElement | null>;
  popover?: boolean;
}) {
  return (
    <button
      ref={buttonRef}
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={Boolean(active)}
      aria-haspopup={popover ? 'dialog' : undefined}
      aria-expanded={popover ? Boolean(active) : undefined}
      onClick={onClick}
      data-testid={testId}
      data-order-document-canvas-popover-trigger={popover || undefined}
      className={`inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${
        active
          ? 'bg-blue-50 text-blue-700'
          : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'
      }`}
    >
      {children}
    </button>
  );
}

function RulerTicks({ axis }: { axis: 'horizontal' | 'vertical' }) {
  const maximum = axis === 'horizontal' ? A4_WIDTH_MM : A4_HEIGHT_MM;
  return (
    <>
      {Array.from({ length: Math.floor(maximum / 5) + 1 }, (_, index) => index * 5).map(
        (millimetres) => {
          const major = millimetres % 10 === 0;
          const offset = `${(millimetres / maximum) * 100}%`;
          return (
            <span
              key={millimetres}
              className="absolute text-[7px] font-medium leading-none text-slate-400"
              style={
                axis === 'horizontal'
                  ? { left: offset, bottom: 0, height: major ? 9 : 5, borderLeft: '1px solid currentColor' }
                  : { top: offset, right: 0, width: major ? 9 : 5, borderTop: '1px solid currentColor' }
              }
            >
              {major ? (
                <span
                  className="absolute whitespace-nowrap"
                  style={axis === 'horizontal' ? { left: 2, bottom: 10 } : { right: 11, top: -3 }}
                >
                  {millimetres}
                </span>
              ) : null}
            </span>
          );
        }
      )}
    </>
  );
}

function ElementPreview({
  id,
  template,
  previewContext,
  element,
  selectedChildId,
  onSelectChild
}: {
  id: OrderDocumentCanvasElementId;
  template: OrderDocumentTemplate;
  previewContext: OrderDocumentPreviewContext;
  element: OrderDocumentCanvasElement;
  selectedChildId: string | readonly string[] | null;
  onSelectChild: (selection: CanvasChildSelection, gesture: SelectionGesture) => void;
}) {
  const textColor = element.textColor || template.style.textColor;
  const mutedColor = element.mutedTextColor || template.style.mutedTextColor;
  const elementDecorationTarget: OrderDocumentDecorationTarget = {
    kind: 'element',
    elementId: id
  };
  const elementDecoration = resolveOrderDocumentDecoration(
    template,
    elementDecorationTarget
  );
  const elementDecorationInsetPt = resolveOrderDocumentDecorationContentInset(
    template,
    elementDecorationTarget
  );
  const centerElementText = id === 'intro'
    && hasOrderDocumentDecorationContentFrame(elementDecoration);
  const contentOverflowClass = element.overflow === 'visible'
    ? 'overflow-visible'
    : 'overflow-hidden';
  const elementTypographyStyle = resolvePreviewTypographyCss(template, {
    kind: 'element',
    elementId: id
  });
  const elementTextAlignmentStyle = textAlignmentCss(
    resolveOrderDocumentTextAlignment(template, {
      kind: 'element',
      elementId: id
    })
  );
  const baseStyle: CSSProperties = {
    color: textColor,
    ...resolveOrderDocumentDecorationPreviewStyle(
      elementDecoration,
      elementDecorationInsetPt
    ),
    ...(centerElementText
      ? {
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center'
        } as const
      : {}),
    ...elementTypographyStyle,
    ...elementTextAlignmentStyle
  };
  const labels = template.text.labels;
  const visibleFieldRows = (group: OrderDocumentFieldGroupId) =>
    resolveOrderDocumentFieldRows(template, group).filter((row) => row.visible);

  if (GROUP_IDS.has(id)) return null;
  if (id === 'logo') {
    return <AtehnaDocumentLogo />;
  }
  if (id === 'company') {
    const rows = visibleFieldRows('company');
    return (
      <div className={`h-full text-right leading-[1.25] ${contentOverflowClass}`} style={baseStyle}>
        {rows.map((row) => {
          if (row.id === 'company_name') {
            if (!template.company.name.trim()) return null;
            return (
              <CanvasSemanticRowTarget key={row.id} group="company" rowId={row.id} selectedChildId={selectedChildId} onSelect={onSelectChild} contentAlignment="right" className="block w-full text-right">
                {template.company.name}
              </CanvasSemanticRowTarget>
            );
          }
          if (row.id === 'address_line_1' || row.id === 'address_line_2') {
            const value = row.id === 'address_line_1'
              ? template.company.addressLine1
              : template.company.addressLine2;
            if (!value.trim()) return null;
            return (
              <CanvasSemanticRowTarget key={row.id} group="company" rowId={row.id} selectedChildId={selectedChildId} onSelect={onSelectChild} contentAlignment="right" className="block w-full text-right">
                {value}
              </CanvasSemanticRowTarget>
            );
          }
          if (row.id !== 'contacts') return null;
          return (
            <CanvasSemanticRowTarget key={row.id} group="company" rowId={row.id} selectedChildId={selectedChildId} onSelect={onSelectChild} contentAlignment="right" className="block w-full text-right">
              {template.company.contacts.map((contact) =>
                contact.visible && (contact.label.trim() || contact.value.trim()) ? (
                  <span key={contact.id} data-order-document-company-contact-id={contact.id} className="block" onPointerDown={(event) => event.stopPropagation()}>
                    <CanvasChildTarget
                      selection={companyContactChild(contact.id)}
                      selectedChildId={selectedChildId}
                      onSelect={onSelectChild}
                      className={`block w-full text-right ${contact.emphasis ? 'font-bold tracking-[0.12em]' : ''}`}
                    >
                      {contact.label ? `${contact.label}: ` : ''}{contact.value}
                    </CanvasChildTarget>
                  </span>
                ) : null
              )}
            </CanvasSemanticRowTarget>
          );
        })}
      </div>
    );
  }
  if (id === 'title') {
    const rows = visibleFieldRows('title');
    const titleText = resolveOrderDocumentPreviewText(
      template.text.title,
      template,
      previewContext
    );
    const subtitle = resolveOrderDocumentPreviewText(
      template.text.subtitle,
      template,
      previewContext
    );
    return (
      <div className={`flex h-full flex-col ${contentOverflowClass}`} style={baseStyle}>
        <div className={`flex flex-wrap items-baseline gap-y-1 ${template.style.titleAlignment === 'right' ? 'justify-end' : ''}`}>
          {rows.map((row) => {
            if (row.id === 'title_text') {
              if (!titleText) return null;
              return (
                <CanvasSemanticRowTarget
                  key={row.id}
                  group="title"
                  rowId={row.id}
                  selectedChildId={selectedChildId}
                  onSelect={onSelectChild}
                  contentAlignment={
                    template.style.titleAlignment === 'right' ? 'right' : 'left'
                  }
                  className="min-w-0 flex-1 whitespace-nowrap text-left leading-none"
                >
                  {titleText}
                </CanvasSemanticRowTarget>
              );
            }
            if (row.id === 'document_number') {
              return (
                <CanvasSemanticRowTarget key={row.id} group="title" rowId={row.id} selectedChildId={selectedChildId} onSelect={onSelectChild} contentAlignment="right" className="ml-5 shrink-0 text-right">
                  {previewContext.documentNumber}
                </CanvasSemanticRowTarget>
              );
            }
            if (row.id !== 'subtitle') return null;
            if (!subtitle) return null;
            return (
              <CanvasSemanticRowTarget
                key={row.id}
                group="title"
                rowId={row.id}
                selectedChildId={selectedChildId}
                onSelect={onSelectChild}
                contentAlignment={
                  template.style.titleAlignment === 'right' ? 'right' : 'left'
                }
                className="basis-full text-left"
                style={{ color: mutedColor }}
              >
                {subtitle}
              </CanvasSemanticRowTarget>
            );
          })}
        </div>
      </div>
    );
  }
  if (id === 'customer') {
    const rows = resolveOrderDocumentCustomerRows(template, previewContext);
    return (
      <div className={`h-full leading-[1.55] ${contentOverflowClass}`} style={baseStyle}>
        {rows.map((row) => {
          return (
            <CanvasSemanticRowTarget key={row.id} group="customer" rowId={row.id} selectedChildId={selectedChildId} onSelect={onSelectChild} className={`block w-full text-left ${row.bold ? 'font-bold' : ''}`}>
              {row.label}: &nbsp; {row.value}
            </CanvasSemanticRowTarget>
          );
        })}
      </div>
    );
  }
  if (id === 'document_meta') {
    const rows = resolveOrderDocumentMetadataRows(template, previewContext);
    return (
      <div className={`h-full text-right leading-[1.55] ${contentOverflowClass}`} style={baseStyle}>
        {rows.map((row) => {
          return (
            <CanvasSemanticRowTarget key={row.id} group="document_meta" rowId={row.id} selectedChildId={selectedChildId} onSelect={onSelectChild} contentAlignment="right" className={`block w-full text-right ${row.bold ? 'font-bold' : ''}`}>
              {row.label}: &nbsp; {row.value}
            </CanvasSemanticRowTarget>
          );
        })}
      </div>
    );
  }
  if (id === 'intro') {
    const intro = resolveOrderDocumentPreviewText(
      template.text.intro,
      template,
      previewContext
    );
    if (!intro) return null;
    return (
      <div
        className={`h-full leading-[1.45] ${contentOverflowClass}`}
        style={baseStyle}
      >
        <CanvasChildTarget
          selection={textChild('intro', 'intro')}
          selectedChildId={selectedChildId}
          onSelect={onSelectChild}
          className="block w-full text-left"
        >
          {intro}
        </CanvasChildTarget>
      </div>
    );
  }
  if (id === 'items') {
    const itemSections = resolveOrderDocumentItemSections(
      previewContext.type,
      previewContext.items
    );
    const table = resolveOrderDocumentTable(template);
    const tableBorders = resolveOrderDocumentTableBorders(template, table);
    const tableBorder = `${tableBorders.widthPt}pt solid ${tableBorders.color}`;
    const visibleColumns = table.columns.filter((column) => column.visible);
    const columns = visibleColumns.map((column) => `${column.widthRatio}fr`).join(' ');
    const columnLabelKeys: Record<OrderDocumentTableColumnId, keyof OrderDocumentTemplateLabels> = {
      sku: 'code',
      quantity: 'quantity',
      unit: 'unit',
      description: 'description',
      unitPrice: 'unitPrice',
      lineTotal: 'lineTotal'
    };
    return (
      <div className={`h-full ${contentOverflowClass}`} style={baseStyle}>
        {itemSections.map((section, sectionIndex) => {
          const sectionRows = section.items.map((item, index) => ({
            cells: resolveOrderDocumentItemCells(item),
            item,
            rowNumber: section.startRowNumber + index
          }));
          return (
            <div
              key={section.id}
              data-order-document-item-section={section.id}
              style={{ marginTop: sectionIndex > 0 ? '10pt' : undefined }}
            >
              {section.label ? (
                <div
                  data-order-document-item-section-label={section.id}
                  className="px-1 font-bold leading-[1.35]"
                  style={{ paddingBottom: '3pt' }}
                >
                  {section.label}
                </div>
              ) : null}
              <div
                className="relative"
                data-order-document-table-border-outer={tableBorders.outer || undefined}
                data-order-document-table-border-horizontal={tableBorders.horizontal || undefined}
                data-order-document-table-border-vertical={tableBorders.vertical || undefined}
                style={tableBorders.outer
                  ? { outline: tableBorder, outlineOffset: `-${tableBorders.widthPt}pt` }
                  : undefined}
              >
                <CanvasGroupTarget
                  selection={tableHeaderChild()}
                  selectedChildId={selectedChildId}
                  onSelect={onSelectChild}
                  className="grid items-center gap-1 px-1 font-bold"
                  style={{
                    gridTemplateColumns: columns,
                    minHeight: `${table.headerHeightPt}pt`,
                    backgroundColor: template.style.tableHeaderBackground,
                    color: template.style.tableHeaderTextColor,
                    boxShadow: tableBorders.horizontal
                      ? `inset 0 -${tableBorders.widthPt}pt 0 ${tableBorders.color}`
                      : undefined
                  }}
                >
                  {visibleColumns.map((column) => (
                    <CanvasChildTarget
                      key={column.id}
                      selection={tableHeaderCellChild(column.id)}
                      selectedChildId={selectedChildId}
                      onSelect={onSelectChild}
                      className={`block w-full ${column.id === 'quantity' || column.id === 'unitPrice' || column.id === 'lineTotal' ? 'text-right' : 'text-left'}`}
                    >
                      {labels[columnLabelKeys[column.id]]}
                    </CanvasChildTarget>
                  ))}
                </CanvasGroupTarget>
                <CanvasGroupTarget
                  selection={tableBodyChild()}
                  selectedChildId={selectedChildId}
                  onSelect={onSelectChild}
                  className="block w-full"
                >
                  {sectionRows.map(({ cells, item, rowNumber }, index) => (
                    <CanvasGroupTarget
                      key={`${item.sku}-${rowNumber}`}
                      selection={tableRowChild(rowNumber)}
                      selectedChildId={selectedChildId}
                      onSelect={onSelectChild}
                      className="grid w-full items-center gap-1 px-1 text-left"
                      style={{
                        gridTemplateColumns: columns,
                        minHeight: `${
                          table.rowHeightOverrides.find((override) => override.rowNumber === rowNumber)?.heightPt
                            ?? table.rowHeightPt
                        }pt`,
                        marginTop: index === 0 ? 0 : `${table.rowGapPt}pt`,
                        backgroundColor: (rowNumber - 1) % 2
                          ? template.style.tableStripeColor
                          : 'transparent',
                        boxShadow: tableBorders.horizontal && index < sectionRows.length - 1
                          ? `inset 0 -${tableBorders.widthPt}pt 0 ${tableBorders.color}`
                          : undefined
                      }}
                    >
                      {visibleColumns.map((column) => (
                        <CanvasChildTarget
                          key={column.id}
                          selection={tableCellChild(rowNumber, column.id)}
                          selectedChildId={selectedChildId}
                          onSelect={onSelectChild}
                          className={`block w-full ${column.id === 'quantity' || column.id === 'unitPrice' || column.id === 'lineTotal' ? 'text-right' : 'text-left'}`}
                          style={{
                            ...(column.id === 'sku' || column.id === 'description'
                              ? { minWidth: 0, overflowWrap: 'break-word' as const }
                              : {})
                          }}
                        >
                          {cells[column.id]}
                        </CanvasChildTarget>
                      ))}
                    </CanvasGroupTarget>
                  ))}
                </CanvasGroupTarget>
                {tableBorders.vertical && visibleColumns.length > 1 ? (
                  <div
                    aria-hidden="true"
                    data-order-document-table-vertical-rule-overlay
                    className="pointer-events-none absolute inset-0 z-20 grid gap-1 px-1"
                    style={{ gridTemplateColumns: columns }}
                  >
                    {visibleColumns.slice(0, -1).map((column, index) => (
                      <span
                        key={column.id}
                        className="h-full"
                        style={{
                          gridColumn: index + 1,
                          borderRight: tableBorder
                        }}
                      />
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    );
  }
  if (id === 'totals') {
    const rows = resolveOrderDocumentTotalRows(template, previewContext);
    return (
      <div className={`h-full leading-[1.65] ${contentOverflowClass}`} style={baseStyle}>
        {rows.map((row, index) => {
          const typographyTarget: OrderDocumentTypographyTarget = {
            kind: 'field_row',
            group: 'totals',
            rowId: row.id
          };
          const rowAlignment = resolveOrderDocumentTextAlignment(template, typographyTarget);
          const rowTypography = resolveOrderDocumentTypography(template, typographyTarget);
          const financialPairStyle = resolveOrderDocumentFinancialPairPreviewStyle(rowAlignment);
          const formattedValue = formatOrderDocumentCurrency(row.value);
          const opticalLabelEdge = rowAlignment === 'distributed' || rowAlignment === 'left'
            ? 'left'
            : null;
          const opticalValueEdge = rowAlignment === 'distributed' || rowAlignment === 'right'
            ? 'right'
            : null;
          const fontMeasurementKey = [
            rowTypography.fontFamily,
            rowTypography.fontWeight,
            rowTypography.fontStyle,
            rowTypography.fontSizePt
          ].join(':');
          return (
            <CanvasSemanticRowTarget
              key={`${row.id}-${index}`}
              group="totals"
              rowId={row.id}
              selectedChildId={selectedChildId}
              onSelect={onSelectChild}
              contentAlignment="distributed"
              className={`grid w-full ${row.id === 'total' ? 'mt-1' : ''} ${row.bold ? 'font-bold' : ''}`}
            >
              <>
                {opticalLabelEdge ? (
                  <CanvasFinancialOpticalEdgeText
                    cell="label"
                    edge={opticalLabelEdge}
                    measurementKey={`${fontMeasurementKey}:${row.label}`}
                    style={financialPairStyle.label}
                  >
                    {row.label}
                  </CanvasFinancialOpticalEdgeText>
                ) : (
                  <span
                    data-order-document-financial-label-cell
                    style={financialPairStyle.label}
                  >
                    {row.label}
                  </span>
                )}
                {opticalValueEdge ? (
                  <CanvasFinancialOpticalEdgeText
                    cell="value"
                    edge={opticalValueEdge}
                    measurementKey={`${fontMeasurementKey}:${formattedValue}`}
                    style={financialPairStyle.value}
                  >
                    {formattedValue}
                  </CanvasFinancialOpticalEdgeText>
                ) : (
                  <span
                    data-order-document-financial-value-cell
                    style={financialPairStyle.value}
                  >
                    {formattedValue}
                  </span>
                )}
              </>
            </CanvasSemanticRowTarget>
          );
        })}
      </div>
    );
  }
  if (id === 'notes') {
    const rows = visibleFieldRows('notes');
    const notes = previewContext.order.notes?.trim() ?? '';
    return (
      <div className={`h-full leading-[1.45] ${contentOverflowClass}`} style={baseStyle}>
        {rows.map((row) => row.id === 'notes_label' ? (
          <CanvasSemanticRowTarget key={row.id} group="notes" rowId={row.id} selectedChildId={selectedChildId} onSelect={onSelectChild} className="block w-full text-left">
            {labels.notes}:
          </CanvasSemanticRowTarget>
        ) : row.id === 'notes_content' ? (
          <CanvasSemanticRowTarget key={row.id} group="notes" rowId={row.id} selectedChildId={selectedChildId} onSelect={onSelectChild} className="mt-1 block w-full text-left" style={{ color: mutedColor }}>
            {notes}
          </CanvasSemanticRowTarget>
        ) : null)}
      </div>
    );
  }
  if (id === 'closing') {
    const rows = visibleFieldRows('closing');
    return (
      <div className={`h-full leading-[1.45] ${contentOverflowClass}`} style={baseStyle}>
        {rows.map((row) => {
          const value = row.id === 'payment_terms'
            ? resolveOrderDocumentPreviewText(template.text.paymentTerms, template, previewContext)
            : row.id === 'closing_text'
              ? resolveOrderDocumentPreviewText(template.text.closing, template, previewContext)
              : row.id === 'signer_name'
                ? resolveOrderDocumentPreviewText(template.text.signerName, template, previewContext)
                : '';
          if (!value) return null;
          return (
            <CanvasSemanticRowTarget key={row.id} group="closing" rowId={row.id} selectedChildId={selectedChildId} onSelect={onSelectChild} className="block w-full text-left">
              {value}
            </CanvasSemanticRowTarget>
          );
        })}
      </div>
    );
  }
  if (id === 'signatures') {
    const rows = visibleFieldRows('signatures');
    return (
      <div className={`grid h-full grid-cols-2 items-end gap-10 ${contentOverflowClass}`} style={baseStyle}>
        {rows.map((row) => {
          if (row.id !== 'handed_over_by' && row.id !== 'received_by') return null;
          const label = row.id === 'handed_over_by' ? labels.handedOverBy : labels.receivedBy;
          return (
            <CanvasSemanticRowTarget key={row.id} group="signatures" rowId={row.id} selectedChildId={selectedChildId} onSelect={onSelectChild} contentAlignment="distributed" className="flex w-full items-end gap-2 text-left">
              <span>{label}:</span><span className="mb-0.5 h-px flex-1 bg-current" />
            </CanvasSemanticRowTarget>
          );
        })}
      </div>
    );
  }
  const rows = resolveOrderDocumentFooterRows(template, previewContext, 0, 1);
  return (
    <div className={`flex h-full flex-col justify-end text-center leading-[1.35] ${contentOverflowClass}`} style={baseStyle}>
      {rows.map((row) => (
        <CanvasSemanticRowTarget
          key={row.id}
          group="footer"
          rowId={row.id}
          selectedChildId={selectedChildId}
          onSelect={onSelectChild}
          contentAlignment={row.alignment === 'right' ? 'right' : 'center'}
          className={`${row.id === 'page_numbers' ? 'mt-0.5' : ''} block w-full ${row.alignment === 'right' ? 'text-right' : 'text-center'}`}
        >
          {row.value}
        </CanvasSemanticRowTarget>
      ))}
    </div>
  );
}

const sectionForElement = (
  id: OrderDocumentCanvasElementId
): OrderDocumentSectionId | null => {
  if (id === 'header' || id === 'logo' || id === 'company' || id === 'footer') return null;
  if (id === 'title' || id === 'customer' || id === 'document_meta') return 'document_details';
  return id;
};

function withLegacyVisibility(
  template: OrderDocumentTemplate,
  id: OrderDocumentCanvasElementId,
  visible: boolean
) {
  if (id === 'header') {
    return { ...template, layout: { ...template.layout, showHeader: visible } };
  }
  if (id === 'logo') {
    return {
      ...template,
      layout: { ...template.layout, showLogoMark: visible }
    };
  }
  if (id === 'company' || id === 'title' || id === 'customer' || id === 'document_meta') {
    return template;
  }
  if (id === 'footer') {
    return { ...template, layout: { ...template.layout, showFooter: visible } };
  }
  const section = sectionForElement(id);
  return {
    ...template,
    layout: {
      ...template.layout,
      sections: template.layout.sections.map((item) =>
        item.id === section ? { ...item, enabled: visible } : item
      )
    }
  };
}

export default function OrderDocumentTemplateCanvas({
  template,
  logoConfig,
  onChange,
  onLogoConfigChange
}: {
  template: OrderDocumentTemplate;
  logoConfig: SiteLogoConfig;
  onChange: (template: OrderDocumentTemplate) => void;
  onLogoConfigChange: (config: SiteLogoConfig) => void;
}) {
  const [selectionEntries, setSelectionEntries] = useState<
    readonly OrderDocumentCanvasSelectionEntry[]
  >([]);
  const [layersOpen, setLayersOpen] = useState(false);
  const [restoreElementsOpen, setRestoreElementsOpen] = useState(false);
  const [pageSettingsOpen, setPageSettingsOpen] = useState(false);
  const [transientElement, setTransientElement] = useState<OrderDocumentCanvasElement | null>(null);
  const [transientFieldRowPlacements, setTransientFieldRowPlacementsState] =
    useState<readonly TransientFieldRowPlacement[]>([]);
  const [measuredSelectedRowPlacement, setMeasuredSelectedRowPlacement] =
    useState<OrderDocumentFieldRowPlacement | null>(null);
  const [guides, setGuides] = useState<GuideState>(null);
  const [overlapSelection, setOverlapSelection] =
    useState<CanvasOverlapSelection | null>(null);
  const [overlapAnnouncement, setOverlapAnnouncement] = useState('');
  const editorFrameRef = useRef<HTMLDivElement | null>(null);
  const scrollRegionRef = useRef<HTMLDivElement | null>(null);
  const pageRef = useRef<HTMLDivElement | null>(null);
  const overlapTriggerRef = useRef<HTMLButtonElement | null>(null);
  const overlapMenuRef = useRef<HTMLDivElement | null>(null);
  const restoreElementsPopoverRef = useRef<HTMLDivElement | null>(null);
  const layersPopoverRef = useRef<HTMLDivElement | null>(null);
  const pageSettingsPopoverRef = useRef<HTMLDivElement | null>(null);
  const restoreElementsTriggerRef = useRef<HTMLButtonElement | null>(null);
  const layersTriggerRef = useRef<HTMLButtonElement | null>(null);
  const pageSettingsTriggerRef = useRef<HTMLButtonElement | null>(null);
  const restoreElementsDismissRefs = useMemo(() => [restoreElementsPopoverRef], []);
  const layersDismissRefs = useMemo(() => [layersPopoverRef], []);
  const pageSettingsDismissRefs = useMemo(() => [pageSettingsPopoverRef], []);
  const suppressNextCanvasClickRef = useRef(false);
  const suppressNextCanvasClickTimerRef = useRef<number | null>(null);
  const interactionRef = useRef<Interaction | null>(null);
  const fieldRowInteractionRef = useRef<FieldRowInteraction | null>(null);
  const transientElementRef = useRef<OrderDocumentCanvasElement | null>(null);
  const transientFieldRowPlacementsRef = useRef<readonly TransientFieldRowPlacement[]>([]);
  const inspectorSnapshotRef = useRef<ReturnType<typeof createOrderDocumentInspectorSnapshot> | null>(null);

  const beginInspectorEdit = () => {
    if (inspectorSnapshotRef.current) return;
    inspectorSnapshotRef.current = createOrderDocumentInspectorSnapshot(template, logoConfig);
  };
  const cancelInspectorEdit = () => {
    const snapshot = inspectorSnapshotRef.current;
    inspectorSnapshotRef.current = null;
    if (!snapshot) return;
    onChange(snapshot.template);
    onLogoConfigChange(snapshot.logoConfig);
  };
  const commitInspectorEdit = () => {
    inspectorSnapshotRef.current = null;
  };

  useDropdownDismiss({
    open: restoreElementsOpen,
    refs: restoreElementsDismissRefs,
    returnFocusRef: restoreElementsTriggerRef,
    dismissGroup: ORDER_DOCUMENT_CANVAS_POPOVER_DISMISS_GROUP,
    ignoreSelector: ORDER_DOCUMENT_NESTED_POPOVER_SELECTOR,
    ignoreEscapeSelector: ORDER_DOCUMENT_NESTED_POPOVER_SELECTOR,
    onClose: () => setRestoreElementsOpen(false)
  });
  useDropdownDismiss({
    open: layersOpen,
    refs: layersDismissRefs,
    returnFocusRef: layersTriggerRef,
    dismissGroup: ORDER_DOCUMENT_CANVAS_POPOVER_DISMISS_GROUP,
    ignoreSelector: ORDER_DOCUMENT_NESTED_POPOVER_SELECTOR,
    ignoreEscapeSelector: ORDER_DOCUMENT_NESTED_POPOVER_SELECTOR,
    onClose: () => setLayersOpen(false)
  });
  useDropdownDismiss({
    open: pageSettingsOpen,
    refs: pageSettingsDismissRefs,
    returnFocusRef: pageSettingsTriggerRef,
    dismissGroup: ORDER_DOCUMENT_CANVAS_POPOVER_DISMISS_GROUP,
    ignoreSelector: ORDER_DOCUMENT_NESTED_POPOVER_SELECTOR,
    ignoreEscapeSelector: ORDER_DOCUMENT_NESTED_POPOVER_SELECTOR,
    onClose: () => setPageSettingsOpen(false)
  });

  const setTransient = (element: OrderDocumentCanvasElement | null) => {
    transientElementRef.current = element;
    setTransientElement(element);
  };
  const setTransientFieldRowPlacements = (
    value: readonly TransientFieldRowPlacement[]
  ) => {
    transientFieldRowPlacementsRef.current = value;
    setTransientFieldRowPlacementsState(value);
  };

  const canvas = useMemo(() => resolveOrderDocumentCanvas(template), [template]);
  const deletedElementIds = useMemo(
    () => resolveOrderDocumentDeletedCanvasElementIds(template),
    [template]
  );
  const activeElementIds = useMemo(
    () => ORDER_DOCUMENT_CANVAS_ELEMENT_IDS.filter(
      (id) => !isOrderDocumentCanvasElementDeleted(template, id)
    ),
    [template]
  );
  const activeSections = useMemo(
    () => template.layout.sections.filter(
      (section) => !isOrderDocumentCanvasElementDeleted(template, section.id)
    ),
    [template]
  );
  const previewContext = useMemo(
    () => createOrderDocumentPreviewContext(template.type),
    [template.type]
  );
  const logoPlacement = logoConfig.placements['pdf-document'];
  const logoPresentation = resolveSiteLogoPresentation(logoPlacement);
  const logoMaster = resolveSiteLogoMaster(logoConfig, 'pdf-document');
  const logoCapabilities = getSiteLogoPresentationCapabilities(logoMaster);
  const previewElements = useMemo(
    () => resolveOrderDocumentFlowPreviewElements(template, canvas, previewContext),
    [canvas, previewContext, template]
  );
  const primarySelection = selectionEntries.at(-1) ?? null;
  const selectedChild = primarySelection?.kind === 'child'
    ? primarySelection.child
    : null;
  const selectedElementId = primarySelection?.kind === 'element'
    ? primarySelection.elementId
    : primarySelection?.kind === 'child'
      ? primarySelection.child.parentId
      : null;
  const selectedElement = selectedElementId
    ? transientElement?.id === selectedElementId
      ? transientElement
      : previewElements[selectedElementId]
    : null;
  const selectedElementIds = selectionEntries
    .filter((entry): entry is Extract<OrderDocumentCanvasSelectionEntry, { kind: 'element' }> =>
      entry.kind === 'element'
    )
    .map((entry) => entry.elementId);
  const selectedElementIdSet = new Set(selectedElementIds);
  const selectedChildIds = selectionEntries
    .filter((entry): entry is Extract<OrderDocumentCanvasSelectionEntry, { kind: 'child' }> =>
      entry.kind === 'child'
    )
    .map((entry) => entry.child.id);
  const selectedFieldRowCount = selectionEntries.filter(
    (entry) => entry.kind === 'child' && entry.child.kind === 'field_row'
  ).length;
  const selectedChildName = selectedChild
    ? selectedChild.kind === 'label'
      ? LABEL_DISPLAY_NAMES[selectedChild.key]
      : selectedChild.kind === 'text'
        ? TEXT_DISPLAY_NAMES[selectedChild.key]
        : selectedChild.kind === 'company'
          ? COMPANY_DISPLAY_NAMES[selectedChild.key] ?? String(selectedChild.key)
          : selectedChild.kind === 'table_header'
            ? 'Glava tabele'
            : selectedChild.kind === 'table_body'
              ? 'Vrstice tabele'
          : selectedChild.kind === 'table_column'
            ? `Stolpec ${selectedChild.key}`
            : selectedChild.kind === 'table_header_cell'
              ? `Glava stolpca ${selectedChild.key}`
            : selectedChild.kind === 'table_row'
              ? `Vrstica ${selectedChild.rowNumber}`
              : selectedChild.kind === 'table_cell'
                ? `Celica ${selectedChild.rowNumber}, ${selectedChild.key}`
              : selectedChild.kind === 'field_row'
                ? FIELD_ROW_DISPLAY_NAMES[selectedChild.rowId]
                : resolveOrderDocumentCompanyContacts(template).find(
                    (contact) => contact.id === selectedChild.contactId
                  )?.label || 'Kontakt podjetja'
    : '';
  const selectedTypographyTarget: OrderDocumentTypographyTarget | null = selectedChild
    ? typographyTargetForSelection(selectedChild)
    : selectedElementId && selectedElementId !== 'logo' && !GROUP_IDS.has(selectedElementId)
      ? { kind: 'element', elementId: selectedElementId }
      : null;
  const selectedTypographyTargets = useMemo(
    () => resolveOrderDocumentSelectionTypographyTargets(selectionEntries),
    [selectionEntries]
  );
  const multipleSelection = selectionEntries.length > 1;
  const currentSelectionCandidateKey: OrderDocumentSelectionCandidateKey | null =
    selectedChild
      ? `child:${selectedChild.id}`
      : selectedElementId
        ? `element:${selectedElementId}`
        : null;
  const selectedCandidateKeys = new Set<OrderDocumentSelectionCandidateKey>(
    selectionEntries.map((entry) => entry.key)
  );
  const selectElement = (
    id: OrderDocumentCanvasElementId,
    gesture: SelectionGesture = { additive: false }
  ) => {
    setSelectionEntries((current) => reduceOrderDocumentCanvasSelection(current, {
      type: gesture.additive ? 'toggle' : 'replace',
      entry: orderDocumentElementSelection(id)
    }));
    setLayersOpen(false);
    setRestoreElementsOpen(false);
    setPageSettingsOpen(false);
  };

  const selectChild = (
    selection: CanvasChildSelection,
    gesture: SelectionGesture = { additive: false }
  ) => {
    setSelectionEntries((current) => reduceOrderDocumentCanvasSelection(current, {
      type: gesture.additive ? 'toggle' : 'replace',
      entry: orderDocumentChildSelection(selection)
    }));
    setLayersOpen(false);
    setRestoreElementsOpen(false);
    setPageSettingsOpen(false);
  };

  const armNextCanvasClickSuppression = () => {
    suppressNextCanvasClickRef.current = true;
    if (suppressNextCanvasClickTimerRef.current !== null) {
      window.clearTimeout(suppressNextCanvasClickTimerRef.current);
    }
    suppressNextCanvasClickTimerRef.current = window.setTimeout(() => {
      suppressNextCanvasClickRef.current = false;
      suppressNextCanvasClickTimerRef.current = null;
    }, 750);
  };
  const consumeNextCanvasClickSuppression = () => {
    if (!suppressNextCanvasClickRef.current) return false;
    suppressNextCanvasClickRef.current = false;
    if (suppressNextCanvasClickTimerRef.current !== null) {
      window.clearTimeout(suppressNextCanvasClickTimerRef.current);
      suppressNextCanvasClickTimerRef.current = null;
    }
    return true;
  };

  const selectionElementLabel = (elementId: string) => {
    const meta = (ELEMENT_META as Partial<Record<string, { label: string }>>)[elementId];
    const element = (previewElements as Partial<Record<string, OrderDocumentCanvasElement>>)[
      elementId
    ];
    const label = meta?.label ?? `Element ${elementId}`;
    if (!element) return label;
    if (!element.visible) return `${label} (skrito)`;
    if (!matchesOrderDocumentElementCondition(element, previewContext)) {
      return `${label} (pogoj ni izpolnjen)`;
    }
    if (element.page !== 1) return `${label} (ni na tej strani)`;
    return label;
  };

  const overlapCandidatesAtPoint = (clientX: number, clientY: number) => {
    const page = pageRef.current;
    if (!page) return [] as ReadonlyArray<CanvasOverlapCandidate>;
    return resolveOrderDocumentSelectionCandidatesFromHitStack(
      document.elementsFromPoint(clientX, clientY).filter((node) => page.contains(node)),
      { getElementLabel: selectionElementLabel }
    ).filter((candidate): candidate is CanvasOverlapCandidate =>
      candidate.node instanceof HTMLElement && page.contains(candidate.node)
    );
  };

  const activateOverlapCandidate = (
    candidate: CanvasOverlapCandidate,
    { focus = false, additive = false }: { focus?: boolean; additive?: boolean } = {}
  ) => {
    if (!candidate.node.isConnected) {
      setOverlapSelection(null);
      return;
    }
    setOverlapAnnouncement(`Izbrano: ${candidate.label}`);
    setOverlapSelection(null);
    if (focus && candidate.node.matches('button, [role="button"], [tabindex]')) {
      candidate.node.focus({ preventScroll: true });
    }
    if (additive) {
      candidate.node.dispatchEvent(new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        ctrlKey: true,
        view: window
      }));
    } else {
      candidate.node.click();
    }
  };

  const handleCanvasPointerDownCapture = (
    event: ReactPointerEvent<HTMLDivElement>
  ) => {
    if (event.button !== 0) return;
    const target = event.target as HTMLElement;
    if (target.closest('[data-order-document-selection-chrome]')) return;
    const candidates = overlapCandidatesAtPoint(event.clientX, event.clientY);
    if (candidates.length <= 1) {
      setOverlapSelection(null);
      return;
    }

    const placement = event.clientY > window.innerHeight / 2 ? 'above' : 'below';
    const anchorClientX = clamp(
      event.clientX + 10,
      8,
      Math.max(8, window.innerWidth - 296)
    );
    const anchorClientY = clamp(
      event.clientY + (placement === 'above' ? -10 : 10),
      8,
      Math.max(8, window.innerHeight - 8)
    );
    setOverlapSelection({
      candidates,
      anchorClientX,
      anchorClientY,
      placement,
      open: false
    });

    // Ctrl/Cmd belongs exclusively to additive selection. Alt cycles an
    // overlapping hit stack, with Shift+Alt cycling in reverse.
    if (!event.altKey) return;
    event.preventDefault();
    event.stopPropagation();
    const nextCandidate = cycleOrderDocumentSelectionCandidate(
      candidates,
      currentSelectionCandidateKey,
      event.shiftKey ? -1 : 1
    );
    if (nextCandidate?.node instanceof HTMLElement) {
      setOverlapAnnouncement(`Izbrano: ${nextCandidate.label}`);
      nextCandidate.node.click();
    }

    // The exact candidate click above is intentional. Suppress only the native
    // click that the original modified pointer gesture may emit afterwards.
    armNextCanvasClickSuppression();
  };

  const handleCanvasClickCapture = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (!consumeNextCanvasClickSuppression()) return;
    event.preventDefault();
    event.stopPropagation();
  };

  const handleOverlapMenuKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    const items = Array.from(
      overlapMenuRef.current?.querySelectorAll<HTMLButtonElement>(
        '[data-order-document-overlap-candidate]'
      ) ?? []
    );
    if (items.length === 0) return;
    event.preventDefault();
    event.stopPropagation();
    const currentIndex = items.indexOf(document.activeElement as HTMLButtonElement);
    const nextIndex = event.key === 'Home'
      ? 0
      : event.key === 'End'
        ? items.length - 1
        : event.key === 'ArrowUp'
          ? (currentIndex <= 0 ? items.length : currentIndex) - 1
          : (currentIndex + 1) % items.length;
    items[nextIndex]?.focus();
  };

  const clearSelection = () => {
    setSelectionEntries([]);
    setOverlapSelection(null);
  };

  const deleteElement = (id: OrderDocumentCanvasElementId) => {
    onChange(deleteOrderDocumentCanvasElement(template, id));
    clearSelection();
    setLayersOpen(false);
    setPageSettingsOpen(false);
  };

  const restoreElement = (id: OrderDocumentCanvasElementId) => {
    onChange(restoreOrderDocumentCanvasElement(template, id));
    setRestoreElementsOpen(false);
    setSelectionEntries([orderDocumentElementSelection(id)]);
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (
        event.target instanceof Element
        && event.target.closest(ORDER_DOCUMENT_NESTED_POPOVER_SELECTOR)
      ) {
        return;
      }
      if (overlapSelection?.open) {
        event.preventDefault();
        event.stopImmediatePropagation();
        setOverlapSelection((current) => current ? { ...current, open: false } : null);
        window.requestAnimationFrame(() => overlapTriggerRef.current?.focus());
        return;
      }
      if (overlapSelection) {
        event.preventDefault();
        event.stopImmediatePropagation();
        setOverlapSelection(null);
        return;
      }
      if (document.querySelector(ORDER_DOCUMENT_CONTEXT_POPOVER_SELECTOR)) return;
      if (restoreElementsOpen || layersOpen || pageSettingsOpen) {
        const activeRoot = restoreElementsOpen
          ? restoreElementsPopoverRef.current
          : layersOpen
            ? layersPopoverRef.current
            : pageSettingsPopoverRef.current;
        const popoverRoot = activeRoot?.closest<HTMLDivElement>(
          ORDER_DOCUMENT_CANVAS_POPOVER_ROOT_SELECTOR
        );
        event.preventDefault();
        event.stopImmediatePropagation();
        setRestoreElementsOpen(false);
        setLayersOpen(false);
        setPageSettingsOpen(false);
        window.requestAnimationFrame(() =>
          popoverRoot?.querySelector<HTMLButtonElement>(
            '[data-order-document-canvas-popover-trigger]'
          )?.focus()
        );
        return;
      }
      setSelectionEntries([]);
      setLayersOpen(false);
      setRestoreElementsOpen(false);
      setPageSettingsOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [layersOpen, overlapSelection, pageSettingsOpen, restoreElementsOpen]);

  useEffect(() => {
    if (!overlapSelection) return;
    const dismissOutside = (event: PointerEvent) => {
      const target = event.target as Element | null;
      if (target?.closest('[data-order-document-overlap-selection]')) return;
      setOverlapSelection(null);
    };
    const dismissForViewportChange = () => setOverlapSelection(null);
    document.addEventListener('pointerdown', dismissOutside, true);
    window.addEventListener('resize', dismissForViewportChange);
    window.addEventListener('scroll', dismissForViewportChange, true);
    return () => {
      document.removeEventListener('pointerdown', dismissOutside, true);
      window.removeEventListener('resize', dismissForViewportChange);
      window.removeEventListener('scroll', dismissForViewportChange, true);
    };
  }, [overlapSelection]);

  useEffect(() => {
    if (!overlapSelection?.open) return;
    window.requestAnimationFrame(() => {
      const selectedItem = overlapMenuRef.current?.querySelector<HTMLButtonElement>(
        '[data-order-document-overlap-candidate][aria-checked="true"]'
      );
      const firstItem = overlapMenuRef.current?.querySelector<HTMLButtonElement>(
        '[data-order-document-overlap-candidate]'
      );
      (selectedItem ?? firstItem)?.focus();
    });
  }, [overlapSelection?.open]);

  useEffect(() => () => {
    if (suppressNextCanvasClickTimerRef.current !== null) {
      window.clearTimeout(suppressNextCanvasClickTimerRef.current);
    }
  }, []);

  useLayoutEffect(() => {
    if (selectedChild?.kind !== 'field_row' || !pageRef.current) {
      setMeasuredSelectedRowPlacement(null);
      return;
    }
    const rowNode = Array.from(
      pageRef.current.querySelectorAll<HTMLElement>('[data-order-document-child-id]')
    ).find((candidate) => candidate.dataset.orderDocumentChildId === selectedChild.id);
    const ownerNode = rowNode?.parentElement?.closest<HTMLElement>('[data-canvas-element-id]');
    const ownerElement = previewElements[selectedChild.parentId];
    if (!rowNode || !ownerNode || !ownerElement) {
      setMeasuredSelectedRowPlacement(null);
      return;
    }
    const rowRect = rowNode.getBoundingClientRect();
    const ownerRect = ownerNode.getBoundingClientRect();
    if (ownerRect.width <= 0 || ownerRect.height <= 0) return;
    setMeasuredSelectedRowPlacement({
      xMm: roundMm(((rowRect.left - ownerRect.left) / ownerRect.width) * ownerElement.widthMm),
      yMm: roundMm(((rowRect.top - ownerRect.top) / ownerRect.height) * ownerElement.heightMm),
      widthMm: roundMm((rowRect.width / ownerRect.width) * ownerElement.widthMm),
      heightMm: roundMm((rowRect.height / ownerRect.height) * ownerElement.heightMm)
    });
  }, [previewElements, selectedChild, template]);

  const updateCanvasSettings = (
    updates: Partial<Omit<typeof canvas, 'elements'>>
  ) => {
    onChange({
      ...template,
      layout: {
        ...template.layout,
        canvas: {
          ...canvas,
          ...updates,
          elements: { ...template.layout.canvas?.elements }
        }
      }
    });
  };

  const updateElement = (
    id: OrderDocumentCanvasElementId,
    updates: Partial<OrderDocumentCanvasElement>
  ) => {
    if (isOrderDocumentCanvasElementDeleted(template, id)) return;
    const materialized = materializeOrderDocumentCanvasElement(template, id);
    const source = materialized.layout.canvas;
    if (!source) return;
    const current = source.elements[id] ?? canvas.elements[id];
    let next: OrderDocumentTemplate = {
      ...materialized,
      layout: {
        ...materialized.layout,
        canvas: {
          ...source,
          elements: { ...source.elements, [id]: { ...current, ...updates, id } }
        }
      }
    };
    if (typeof updates.visible === 'boolean') {
      next = withLegacyVisibility(next, id, updates.visible);
    }
    onChange(next);
  };

  const updateSelectedElements = (
    updates: Partial<OrderDocumentCanvasElement>
  ) => {
    if (selectedElementIds.length === 0) return;
    let next = template;
    for (const id of selectedElementIds) {
      if (isOrderDocumentCanvasElementDeleted(next, id)) continue;
      next = materializeOrderDocumentCanvasElement(next, id);
      const source = next.layout.canvas;
      if (!source) continue;
      const current = source.elements[id] ?? resolveOrderDocumentCanvas(next).elements[id];
      next = {
        ...next,
        layout: {
          ...next.layout,
          canvas: {
            ...source,
            elements: { ...source.elements, [id]: { ...current, ...updates, id } }
          }
        }
      };
      if (typeof updates.visible === 'boolean') {
        next = withLegacyVisibility(next, id, updates.visible);
      }
    }
    onChange(next);
  };

  const deleteSelectedElements = () => {
    let next = template;
    for (const id of selectedElementIds) {
      next = deleteOrderDocumentCanvasElement(next, id);
    }
    onChange(next);
    clearSelection();
  };

  const updateStyle = <Key extends keyof OrderDocumentTemplateStyle>(
    key: Key,
    value: OrderDocumentTemplateStyle[Key]
  ) => onChange({ ...template, style: { ...template.style, [key]: value } });
  const setLogoPresentation = (presentation: SiteLogoPresentation) => {
    onLogoConfigChange({
      ...logoConfig,
      placements: {
        ...logoConfig.placements,
        'pdf-document': {
          ...logoPlacement,
          presentation
        }
      }
    });
  };
  const updateLogoPresentation = <Key extends keyof SiteLogoPresentation>(
    key: Key,
    value: SiteLogoPresentation[Key]
  ) => setLogoPresentation({ ...logoPresentation, [key]: value });
  const updateLogoOutline = <Key extends keyof SiteLogoPresentation['outline']>(
    key: Key,
    value: SiteLogoPresentation['outline'][Key]
  ) => updateLogoPresentation('outline', { ...logoPresentation.outline, [key]: value });
  const updateLogoShadow = <Key extends keyof SiteLogoPresentation['shadow']>(
    key: Key,
    value: SiteLogoPresentation['shadow'][Key]
  ) => updateLogoPresentation('shadow', { ...logoPresentation.shadow, [key]: value });
  const updateCompany = <Key extends keyof OrderDocumentTemplateCompany>(
    key: Key,
    value: OrderDocumentTemplateCompany[Key]
  ) => onChange({ ...template, company: { ...template.company, [key]: value } });
  const updateText = <Key extends keyof Omit<OrderDocumentTemplateText, 'labels'>>(
    key: Key,
    value: OrderDocumentTemplateText[Key]
  ) => onChange({ ...template, text: { ...template.text, [key]: value } });
  const updateLabel = <Key extends keyof OrderDocumentTemplateLabels>(
    key: Key,
    value: OrderDocumentTemplateLabels[Key]
  ) =>
    onChange({
      ...template,
      text: { ...template.text, labels: { ...template.text.labels, [key]: value } }
    });
  const updateRule = <Key extends keyof OrderDocumentTemplateRules>(
    key: Key,
    value: OrderDocumentTemplateRules[Key]
  ) => onChange({ ...template, rules: { ...template.rules, [key]: value } });

  const updateLayoutBoolean = (
    key: (typeof PAGE_CONTROL_FIELDS)[number]['key'],
    value: boolean
  ) => onChange({ ...template, layout: { ...template.layout, [key]: value } });
  const updateSection = (id: OrderDocumentSectionId, enabled: boolean) => {
    let next: OrderDocumentTemplate = {
      ...template,
      layout: {
        ...template.layout,
        sections: template.layout.sections.map((section) =>
          section.id === id ? { ...section, enabled } : section
        )
      }
    };
    const relatedIds = ORDER_DOCUMENT_CANVAS_ELEMENT_IDS.filter(
      (elementId) => sectionForElement(elementId) === id
    );
    for (const elementId of relatedIds) {
      if (isOrderDocumentCanvasElementDeleted(next, elementId)) continue;
      next = materializeOrderDocumentCanvasElement(next, elementId);
      const source = next.layout.canvas;
      const current = source?.elements[elementId];
      if (source && current) {
        source.elements[elementId] = { ...current, visible: enabled };
      }
    }
    onChange(next);
  };

  const moveSection = (id: OrderDocumentSectionId, direction: -1 | 1) => {
    const activeIndex = activeSections.findIndex((section) => section.id === id);
    const targetSection = activeSections[activeIndex + direction];
    if (activeIndex < 0 || !targetSection) return;
    const sections = [...template.layout.sections];
    const index = sections.findIndex((section) => section.id === id);
    const target = sections.findIndex((section) => section.id === targetSection.id);
    [sections[index], sections[target]] = [sections[target], sections[index]];
    onChange({ ...template, layout: { ...template.layout, sections } });
  };

  const alignmentTargets = (
    movingId: string,
    excludedIds: ReadonlySet<string> = new Set()
  ) => (Object.entries(previewElements) as Array<[
    OrderDocumentCanvasElementId,
    OrderDocumentCanvasElement
  ]>)
    .filter(([candidateId, candidate]) =>
      candidateId !== movingId
      && !excludedIds.has(candidateId)
      && activeElementIds.includes(candidateId)
      && !GROUP_IDS.has(candidateId)
      && candidate.page === 1
      && shouldRenderOrderDocumentPreviewElement(candidate, previewContext, 1)
    )
    .map(([candidateId, candidate]) => ({
      id: candidateId,
      label: ELEMENT_META[candidateId].label,
      xMm: candidate.xMm,
      yMm: candidate.yMm,
      widthMm: candidate.widthMm,
      heightMm: candidate.heightMm,
      visible: candidate.visible
    }));

  const resolveDragFrame = ({
    movingId,
    rawPosition,
    size,
    pageRect,
    bypassAssistance,
    excludedIds,
    origin,
    dependents = []
  }: {
    movingId: string;
    rawPosition: { xMm: number; yMm: number };
    size: { widthMm: number; heightMm: number };
    pageRect: DOMRect;
    bypassAssistance: boolean;
    excludedIds?: ReadonlySet<string>;
    origin?: OrderDocumentRectGeometry;
    dependents?: ReadonlyArray<OrderDocumentRectGeometry>;
  }) => {
    const page = { widthMm: A4_WIDTH_MM, heightMm: A4_HEIGHT_MM };
    const clampPosition = (position: { xMm: number; yMm: number }) => {
      if (origin && dependents.length > 0) {
        return clampOrderDocumentMoveWithDependents(position, origin, dependents, page);
      }
      const clamped = clampOrderDocumentRectToPage({ ...position, ...size }, page);
      return { xMm: clamped.xMm, yMm: clamped.yMm };
    };
    const pageSafeRaw = clampPosition(rawPosition);
    if (bypassAssistance) {
      return { ...pageSafeRaw, guideState: null as GuideState };
    }

    const gridPosition = canvas.snapToGrid && canvas.gridSizeMm > 0
      ? clampPosition({
          xMm: Math.round(pageSafeRaw.xMm / canvas.gridSizeMm) * canvas.gridSizeMm,
          yMm: Math.round(pageSafeRaw.yMm / canvas.gridSizeMm) * canvas.gridSizeMm
        })
      : pageSafeRaw;
    if (!canvas.showGuides && !canvas.snapToElements) {
      return { ...gridPosition, guideState: null as GuideState };
    }

    const alignment = resolveOrderDocumentCanvasAlignment({
      moving: { id: movingId, ...pageSafeRaw, ...size },
      targets: alignmentTargets(movingId, excludedIds),
      pageWidthMm: A4_WIDTH_MM,
      pageHeightMm: A4_HEIGHT_MM,
      pageMarginMm: template.style.marginMm,
      // Six screen pixels keeps the magnetic/suggestion distance visually
      // consistent at different editor widths.
      thresholdMm: (6 / Math.max(1, pageRect.width)) * A4_WIDTH_MM,
      snap: canvas.snapToElements
    });
    const horizontalGuide = alignment.guides.find((guide) => guide.axis === 'x');
    const verticalGuide = alignment.guides.find((guide) => guide.axis === 'y');
    const assisted = clampPosition({
      xMm: canvas.snapToElements && horizontalGuide ? alignment.xMm : gridPosition.xMm,
      yMm: canvas.snapToElements && verticalGuide ? alignment.yMm : gridPosition.yMm
    });
    return {
      ...assisted,
      guideState: alignment.guides.length > 0 ? alignment.guides : null
    };
  };

  const beginFieldRowInteraction = (
    selection: FieldRowSelection,
    event: ReactPointerEvent<HTMLElement>
  ) => {
    if (event.button !== 0) return;
    if (event.ctrlKey || event.metaKey) {
      event.preventDefault();
      event.stopPropagation();
      selectChild(selection, { additive: true });
      armNextCanvasClickSuppression();
      return;
    }
    const selectedRows = selectionEntries.flatMap((entry) =>
      entry.kind === 'child' && entry.child.kind === 'field_row'
        ? [entry.child]
        : []
    );
    const movementSelections = selectedChildIds.includes(selection.id)
      ? selectedRows
      : [selection];
    const rowNodes = Array.from(
      pageRef.current?.querySelectorAll<HTMLElement>('[data-order-document-child-id]') ?? []
    );
    const measure = (candidate: FieldRowSelection): FieldRowDragEntry | null => {
      const ownerElement = previewElements[candidate.parentId];
      const rowNode = candidate.id === selection.id
        ? event.currentTarget
        : rowNodes.find((node) => node.dataset.orderDocumentChildId === candidate.id);
      const ownerNode = rowNode?.closest<HTMLElement>('[data-order-document-element-id]');
      if (!rowNode || !ownerNode || !ownerElement) return null;
      const ownerRect = ownerNode.getBoundingClientRect();
      const rowRect = rowNode.getBoundingClientRect();
      if (ownerRect.width <= 0 || ownerRect.height <= 0) return null;
      const row = resolveOrderDocumentFieldRows(template, candidate.group)
        .find((item) => item.id === candidate.rowId);
      const measured = {
        xMm: roundMm(((rowRect.left - ownerRect.left) / ownerRect.width) * ownerElement.widthMm),
        yMm: roundMm(((rowRect.top - ownerRect.top) / ownerRect.height) * ownerElement.heightMm),
        widthMm: roundMm((rowRect.width / ownerRect.width) * ownerElement.widthMm),
        heightMm: roundMm((rowRect.height / ownerRect.height) * ownerElement.heightMm)
      };
      return {
        selection: candidate,
        ownerElement,
        measuredWidthMm: measured.widthMm,
        measuredHeightMm: measured.heightMm,
        startPlacement: {
          ...row?.placement,
          xMm: row?.placement?.xMm ?? measured.xMm,
          yMm: row?.placement?.yMm ?? measured.yMm,
          widthMm: row?.placement?.widthMm ?? measured.widthMm,
          heightMm: row?.placement?.heightMm ?? measured.heightMm
        }
      };
    };
    const entries = movementSelections.map(measure).filter(
      (entry): entry is FieldRowDragEntry => Boolean(entry)
    );
    const primary = entries.find((entry) => entry.selection.id === selection.id);
    if (!primary) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    if (!selectedChildIds.includes(selection.id)) selectChild(selection);
    interactionRef.current = null;
    fieldRowInteractionRef.current = {
      primaryId: primary.selection.id,
      entries,
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      didMove: false
    };
    setTransientFieldRowPlacements([]);
  };

  const beginInteraction = (
    id: OrderDocumentCanvasElementId,
    kind: Interaction['kind'],
    event: ReactPointerEvent<HTMLElement>
  ) => {
    const element = previewElements[id];
    if (event.button !== 0) return;
    if (event.ctrlKey || event.metaKey) {
      event.preventDefault();
      event.stopPropagation();
      selectElement(id, { additive: true });
      armNextCanvasClickSuppression();
      return;
    }
    if (element.locked) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    if (!selectedElementIdSet.has(id)) selectElement(id);
    const directMovementIds = kind === 'move' && selectedElementIdSet.has(id)
      ? selectedElementIds.filter((selectedId) => !previewElements[selectedId].locked)
      : [id];
    const movementIds = new Set<OrderDocumentCanvasElementId>(directMovementIds);
    for (const selectedId of directMovementIds) {
      for (const childId of GROUP_CHILD_IDS[selectedId] ?? []) {
        if (!isOrderDocumentCanvasElementDeleted(template, childId)) movementIds.add(childId);
      }
    }
    const groupStarts = Object.fromEntries(
      [...movementIds].map((movementId) => [movementId, previewElements[movementId]])
    ) as Partial<Record<OrderDocumentCanvasElementId, OrderDocumentCanvasElement>>;
    interactionRef.current = {
      id,
      kind,
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      start: element,
      groupStarts,
      didMove: false
    };
    setTransient(null);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const fieldRowInteraction = fieldRowInteractionRef.current;
    const page = pageRef.current;
    if (
      fieldRowInteraction
      && fieldRowInteraction.pointerId === event.pointerId
      && page
    ) {
      const pageRect = page.getBoundingClientRect();
      const pixelDeltaX = event.clientX - fieldRowInteraction.startClientX;
      const pixelDeltaY = event.clientY - fieldRowInteraction.startClientY;
      if (!fieldRowInteraction.didMove) {
        if (Math.hypot(pixelDeltaX, pixelDeltaY) < DRAG_START_THRESHOLD_PX) return;
        fieldRowInteraction.didMove = true;
        setOverlapSelection(null);
        suppressNextCanvasClickRef.current = true;
        if (suppressNextCanvasClickTimerRef.current !== null) {
          window.clearTimeout(suppressNextCanvasClickTimerRef.current);
        }
        suppressNextCanvasClickTimerRef.current = window.setTimeout(() => {
          suppressNextCanvasClickRef.current = false;
          suppressNextCanvasClickTimerRef.current = null;
        }, 750);
      }
      const primary = fieldRowInteraction.entries.find(
        (entry) => entry.selection.id === fieldRowInteraction.primaryId
      );
      if (!primary) return;
      const startX = primary.startPlacement.xMm ?? 0;
      const startY = primary.startPlacement.yMm ?? 0;
      const primaryOrigin = {
        xMm: primary.ownerElement.xMm + startX,
        yMm: primary.ownerElement.yMm + startY,
        widthMm: primary.measuredWidthMm,
        heightMm: primary.measuredHeightMm
      };
      const rawPagePosition = resolveOrderDocumentPointerDragPosition({
        startXmm: primaryOrigin.xMm,
        startYmm: primaryOrigin.yMm,
        startClientX: fieldRowInteraction.startClientX,
        startClientY: fieldRowInteraction.startClientY,
        clientX: event.clientX,
        clientY: event.clientY,
        pagePixelWidth: pageRect.width,
        pagePixelHeight: pageRect.height,
        page: { widthMm: A4_WIDTH_MM, heightMm: A4_HEIGHT_MM }
      });
      const assisted = resolveDragFrame({
        movingId: `field-row:${primary.selection.group}:${primary.selection.rowId}`,
        rawPosition: rawPagePosition,
        size: {
          widthMm: primary.measuredWidthMm,
          heightMm: primary.measuredHeightMm
        },
        pageRect,
        bypassAssistance: event.altKey,
        origin: primaryOrigin,
        dependents: fieldRowInteraction.entries
          .filter((entry) => entry.selection.id !== primary.selection.id)
          .map((entry) => ({
            xMm: entry.ownerElement.xMm + (entry.startPlacement.xMm ?? 0),
            yMm: entry.ownerElement.yMm + (entry.startPlacement.yMm ?? 0),
            widthMm: entry.measuredWidthMm,
            heightMm: entry.measuredHeightMm
          }))
      });
      const deltaX = assisted.xMm - primaryOrigin.xMm;
      const deltaY = assisted.yMm - primaryOrigin.yMm;
      setTransientFieldRowPlacements(fieldRowInteraction.entries.map((entry) => {
        const relativePosition = clampOrderDocumentFieldRowToPage(
          {
            xMm: (entry.startPlacement.xMm ?? 0) + deltaX,
            yMm: (entry.startPlacement.yMm ?? 0) + deltaY
          },
          entry.ownerElement,
          {
            widthMm: entry.measuredWidthMm,
            heightMm: entry.measuredHeightMm
          },
          { widthMm: A4_WIDTH_MM, heightMm: A4_HEIGHT_MM }
        );
        return {
          group: entry.selection.group,
          rowId: entry.selection.rowId,
          placement: {
            ...entry.startPlacement,
            xMm: relativePosition.xMm,
            yMm: relativePosition.yMm
          }
        };
      }));
      setGuides(assisted.guideState);
      return;
    }
    const interaction = interactionRef.current;
    if (!interaction || interaction.pointerId !== event.pointerId || !page) return;
    const pageRect = page.getBoundingClientRect();
    const pixelDeltaX = event.clientX - interaction.startClientX;
    const pixelDeltaY = event.clientY - interaction.startClientY;
    if (!interaction.didMove) {
      if (Math.hypot(pixelDeltaX, pixelDeltaY) < DRAG_START_THRESHOLD_PX) return;
      interaction.didMove = true;
      setOverlapSelection(null);
    }
    const absoluteStart = { ...interaction.start, positioning: 'absolute' as const };
    const rawPosition = resolveOrderDocumentPointerDragPosition({
      startXmm: absoluteStart.xMm,
      startYmm: absoluteStart.yMm,
      startClientX: interaction.startClientX,
      startClientY: interaction.startClientY,
      clientX: event.clientX,
      clientY: event.clientY,
      pagePixelWidth: pageRect.width,
      pagePixelHeight: pageRect.height,
      page: { widthMm: A4_WIDTH_MM, heightMm: A4_HEIGHT_MM }
    });
    const deltaX = rawPosition.xMm - absoluteStart.xMm;
    const deltaY = rawPosition.yMm - absoluteStart.yMm;
    if (interaction.kind === 'move') {
      const groupStartEntries = Object.entries(interaction.groupStarts) as Array<[
        OrderDocumentCanvasElementId,
        OrderDocumentCanvasElement
      ]>;
      const excludedIds = new Set<string>(groupStartEntries.map(([movementId]) => movementId));
      const dependents = groupStartEntries
        .filter(([movementId]) => movementId !== interaction.id)
        .map(([, movementStart]) => movementStart);
      const assisted = resolveDragFrame({
        movingId: interaction.id,
        rawPosition,
        size: { widthMm: absoluteStart.widthMm, heightMm: absoluteStart.heightMm },
        pageRect,
        bypassAssistance: event.altKey,
        excludedIds,
        origin: absoluteStart,
        dependents
      });
      setTransient({
        ...absoluteStart,
        xMm: assisted.xMm,
        yMm: assisted.yMm
      });
      setGuides(assisted.guideState);
      return;
    }
    suppressNextCanvasClickRef.current = true;
    if (suppressNextCanvasClickTimerRef.current !== null) {
      window.clearTimeout(suppressNextCanvasClickTimerRef.current);
    }
    suppressNextCanvasClickTimerRef.current = window.setTimeout(() => {
      suppressNextCanvasClickRef.current = false;
      suppressNextCanvasClickTimerRef.current = null;
    }, 750);
    const rawWidth = absoluteStart.widthMm + deltaX;
    const rawHeight = absoluteStart.heightMm + deltaY;
    const width = canvas.snapToGrid && canvas.gridSizeMm > 0
      ? Math.round(rawWidth / canvas.gridSizeMm) * canvas.gridSizeMm
      : rawWidth;
    const height = canvas.snapToGrid && canvas.gridSizeMm > 0
      ? Math.round(rawHeight / canvas.gridSizeMm) * canvas.gridSizeMm
      : rawHeight;
    setTransient({
      ...absoluteStart,
      widthMm: roundMm(clamp(width, MIN_ELEMENT_SIZE_MM, A4_WIDTH_MM - absoluteStart.xMm)),
      heightMm: roundMm(clamp(height, MIN_ELEMENT_SIZE_MM, A4_HEIGHT_MM - absoluteStart.yMm))
    });
    setGuides(null);
  };

  const endInteraction = (event: ReactPointerEvent<HTMLDivElement>) => {
    const fieldRowInteraction = fieldRowInteractionRef.current;
    if (fieldRowInteraction?.pointerId === event.pointerId) {
      const latest = transientFieldRowPlacementsRef.current;
      if (fieldRowInteraction.didMove && latest.length > 0) {
        let next = template;
        for (const placement of latest) {
          next = setOrderDocumentFieldRowPlacement(
            next,
            placement.group,
            placement.rowId,
            placement.placement
          );
        }
        onChange(next);
      }
      fieldRowInteractionRef.current = null;
      setTransientFieldRowPlacements([]);
      setGuides(null);
      return;
    }
    const interaction = interactionRef.current;
    if (!interaction || interaction.pointerId !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (!interaction.didMove) {
      interactionRef.current = null;
      setTransient(null);
      setGuides(null);
      return;
    }
    suppressNextCanvasClickRef.current = true;
    if (suppressNextCanvasClickTimerRef.current !== null) {
      window.clearTimeout(suppressNextCanvasClickTimerRef.current);
    }
    suppressNextCanvasClickTimerRef.current = window.setTimeout(() => {
      suppressNextCanvasClickRef.current = false;
      suppressNextCanvasClickTimerRef.current = null;
    }, 750);
    const latest = transientElementRef.current;
    if (latest?.id === interaction.id && interaction.kind === 'move') {
      const movementStarts = Object.entries(interaction.groupStarts) as Array<[
        OrderDocumentCanvasElementId,
        OrderDocumentCanvasElement
      ]>;
      let materialized = template;
      for (const [movementId] of movementStarts) {
        materialized = materializeOrderDocumentCanvasElement(materialized, movementId);
      }
      const source = materialized.layout.canvas;
      if (source) {
        const deltaX = latest.xMm - interaction.start.xMm;
        const deltaY = latest.yMm - interaction.start.yMm;
        const elements = { ...source.elements };
        for (const [movementId, movementStart] of movementStarts) {
          elements[movementId] = {
            ...(source.elements[movementId] ?? movementStart),
            positioning: 'absolute',
            xMm: roundMm(movementStart.xMm + deltaX),
            yMm: roundMm(movementStart.yMm + deltaY)
          };
        }
        onChange({
          ...materialized,
          layout: {
            ...materialized.layout,
            canvas: { ...source, elements }
          }
        });
      }
    } else if (latest?.id === interaction.id) {
      updateElement(interaction.id, latest);
    }
    interactionRef.current = null;
    setTransient(null);
    setGuides(null);
  };

  const cancelInteraction = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (fieldRowInteractionRef.current?.pointerId === event.pointerId) {
      fieldRowInteractionRef.current = null;
      setTransientFieldRowPlacements([]);
      setGuides(null);
      return;
    }
    if (interactionRef.current?.pointerId !== event.pointerId) return;
    interactionRef.current = null;
    setTransient(null);
    setGuides(null);
  };

  const renderSelectedChildInspector = (selection: CanvasChildSelection) => {
    if (selection.kind === 'field_row') {
      const labelKeyByRow: Partial<
        Record<OrderDocumentFieldRowId, keyof OrderDocumentTemplateLabels>
      > = {
        customer: 'customer',
        contact: 'contact',
        address: 'address',
        email: 'email',
        issue_date: 'issueDate',
        order_date: 'orderDate',
        customer_type: 'customerType',
        status: 'status',
        reference: 'reference',
        dispatch_date: 'dispatchDate',
        dispatch_method: 'dispatchMethod',
        purchase_order_number: 'purchaseOrderNumber',
        purchase_order_date: 'purchaseOrderDate',
        delivery_note: 'deliveryNote',
        due_date: 'dueDate',
        payment_reference: 'paymentReference',
        subtotal: 'subtotal',
        shipping: 'shipping',
        tax: 'tax',
        total: 'total',
        notes_label: 'notes',
        handed_over_by: 'handedOverBy',
        received_by: 'receivedBy'
      };
      if (selection.rowId === 'document_number' && selection.group === 'document_meta') {
        labelKeyByRow.document_number = 'documentNumber';
      }
      const labelKey = labelKeyByRow[selection.rowId];
      if (labelKey) {
        return (
          <input
            data-order-document-field-row-edit={selection.rowId}
            data-order-document-label-edit
            id={`order-document-template-row-label-${selection.group}-${selection.rowId}`}
            aria-label={`Besedilo oznake ${FIELD_ROW_DISPLAY_NAMES[selection.rowId]}`}
            value={template.text.labels[labelKey]}
            onChange={(event) => updateLabel(labelKey, event.target.value)}
            className={childToolbarInputClassName}
          />
        );
      }

      const textKeyByRow: Partial<
        Record<OrderDocumentFieldRowId, keyof Omit<OrderDocumentTemplateText, 'labels'>>
      > = {
        title_text: 'title',
        subtitle: 'subtitle',
        payment_terms: 'paymentTerms',
        closing_text: 'closing',
        signer_name: 'signerName',
        footer_text: 'footerText'
      };
      const textKey = textKeyByRow[selection.rowId];
      if (textKey) {
        return (
          <input
            data-order-document-field-row-edit={selection.rowId}
            id={`order-document-template-row-text-${selection.group}-${selection.rowId}`}
            aria-label={FIELD_ROW_DISPLAY_NAMES[selection.rowId]}
            value={template.text[textKey]}
            onChange={(event) => updateText(textKey, event.target.value)}
            className={childToolbarInputClassName}
          />
        );
      }

      const companyKeyByRow: Partial<Record<OrderDocumentFieldRowId, OrderDocumentCompanyTextKey>> = {
        company_name: 'name',
        address_line_1: 'addressLine1',
        address_line_2: 'addressLine2',
        registration_text: 'registrationText'
      };
      const companyKey = companyKeyByRow[selection.rowId];
      if (companyKey) {
        return (
          <input
            data-order-document-field-row-edit={selection.rowId}
            id={`order-document-template-row-company-${selection.group}-${selection.rowId}`}
            aria-label={FIELD_ROW_DISPLAY_NAMES[selection.rowId]}
            value={template.company[companyKey]}
            onChange={(event) => updateCompany(companyKey, event.target.value)}
            className={childToolbarInputClassName}
          />
        );
      }

      return (
        <span
          data-order-document-field-row-edit={selection.rowId}
          className="flex h-8 items-center truncate rounded-lg border border-white/10 bg-slate-800/80 px-2.5 text-[11px] font-semibold text-slate-200"
        >
          {FIELD_ROW_DISPLAY_NAMES[selection.rowId]}
        </span>
      );
    }
    if (selection.kind === 'label') {
      return (
        <input
          data-order-document-label-edit
          id={`order-document-template-label-${selection.key}`}
          aria-label="Besedilo oznake"
          value={template.text.labels[selection.key]}
          onChange={(event) => updateLabel(selection.key, event.target.value)}
          data-testid={`order-document-template-label-${selection.key}`}
          className={childToolbarInputClassName}
        />
      );
    }
    if (selection.kind === 'text') {
      return (
        <input
          id={selection.key === 'title' ? 'order-document-template-title' : `order-document-template-text-${selection.key}`}
          aria-label="Besedilo"
          value={template.text[selection.key]}
          onChange={(event) => updateText(selection.key, event.target.value)}
          data-testid={`order-document-template-text-${selection.key}`}
          className={childToolbarInputClassName}
        />
      );
    }
    if (selection.kind !== 'company') return null;
    return (
      <input
        id={`order-document-template-company-${selection.key}`}
        aria-label="Podatek podjetja"
        value={template.company[selection.key]}
        onChange={(event) => updateCompany(selection.key, event.target.value)}
        data-testid={`order-document-template-company-${selection.key}`}
        className={childToolbarInputClassName}
      />
    );
  };

  const renderSelectedFieldRowActions = (
    selection: Extract<CanvasChildSelection, { kind: 'field_row' }>
  ) => {
    const rows = resolveOrderDocumentFieldRows(template, selection.group);
    const selectedIndex = rows.findIndex((row) => row.id === selection.rowId);
    const move = (direction: -1 | 1) => {
      const targetIndex = selectedIndex + direction;
      if (selectedIndex < 0 || targetIndex < 0 || targetIndex >= rows.length) return;
      const nextRows = [...rows];
      [nextRows[selectedIndex], nextRows[targetIndex]] = [
        nextRows[targetIndex],
        nextRows[selectedIndex]
      ];
      onChange(setOrderDocumentFieldRows(template, selection.group, nextRows));
    };
    return (
      <>
        <AppearanceEditorToolbarButton
          label="Premakni vrstico navzgor"
          data-order-document-row-move="up"
          disabled={selectedIndex <= 0}
          onClick={() => move(-1)}
        >
          <ArrowUp className="h-3.5 w-3.5" />
        </AppearanceEditorToolbarButton>
        <AppearanceEditorToolbarButton
          label="Premakni vrstico navzdol"
          data-order-document-row-move="down"
          disabled={selectedIndex < 0 || selectedIndex >= rows.length - 1}
          onClick={() => move(1)}
        >
          <ArrowDown className="h-3.5 w-3.5" />
        </AppearanceEditorToolbarButton>
        <AppearanceEditorToolbarButton
          label="Odstrani vrstico"
          danger
          data-order-document-row-remove={selection.rowId}
          onClick={() => {
            onChange(removeOrderDocumentFieldRow(template, selection.group, selection.rowId));
            selectElement(selection.parentId);
          }}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </AppearanceEditorToolbarButton>
      </>
    );
  };

  const renderSelectedFieldRowGeometry = (selection: FieldRowSelection) => {
    const row = resolveOrderDocumentFieldRows(template, selection.group)
      .find((candidate) => candidate.id === selection.rowId);
    const owner = previewElements[selection.parentId];
    const measured = measuredSelectedRowPlacement;
    const placement: OrderDocumentFieldRowPlacement = {
      ...row?.placement,
      xMm: row?.placement?.xMm ?? measured?.xMm ?? 0,
      yMm: row?.placement?.yMm ?? measured?.yMm ?? 0,
      ...(typeof row?.placement?.widthMm === 'number'
        ? { widthMm: row.placement.widthMm }
        : typeof measured?.widthMm === 'number'
          ? { widthMm: measured.widthMm }
          : {}),
      ...(typeof row?.placement?.heightMm === 'number'
        ? { heightMm: row.placement.heightMm }
        : typeof measured?.heightMm === 'number'
          ? { heightMm: measured.heightMm }
          : {})
    };
    const widthMm = placement.widthMm ?? 0;
    const heightMm = placement.heightMm ?? 0;
    const rowBounds = resolveOrderDocumentFieldRowPageBounds(
      owner,
      { widthMm, heightMm },
      { widthMm: A4_WIDTH_MM, heightMm: A4_HEIGHT_MM }
    );
    const updatePlacement = (patch: OrderDocumentFieldRowPlacement) =>
      onChange(setOrderDocumentFieldRowPlacement(
        template,
        selection.group,
        selection.rowId,
        { ...placement, ...patch }
      ));
    return (
      <div className="space-y-2" data-order-document-row-placement-controls>
        <div className="grid grid-cols-2 gap-1.5">
          <CompactGeometryField
            label="X"
            value={placement.xMm ?? 0}
            min={rowBounds.minXmm}
            max={rowBounds.maxXmm}
            onChange={(xMm) => updatePlacement({ xMm })}
            testId="order-document-row-x-input"
          />
          <CompactGeometryField
            label="Y"
            value={placement.yMm ?? 0}
            min={rowBounds.minYmm}
            max={rowBounds.maxYmm}
            onChange={(yMm) => updatePlacement({ yMm })}
            testId="order-document-row-y-input"
          />
        </div>
        <div className="flex items-center justify-between gap-2 rounded-md border border-white/10 bg-white/5 px-2 py-1.5">
          <p className="text-[9px] leading-3.5 text-white/50">
            Povlecite vrstico po celotni strani ali vnesite položaj glede na njen element.
          </p>
          <button
            type="button"
            data-order-document-row-placement-reset
            disabled={!row?.placement}
            onClick={() => onChange(resetOrderDocumentFieldRowPlacement(
              template,
              selection.group,
              selection.rowId
            ))}
            className="grid h-7 w-7 shrink-0 place-items-center rounded-md border border-white/15 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white disabled:opacity-30"
            aria-label="Ponastavi naravni položaj vrstice"
            title="Ponastavi naravni položaj"
          >
            <RotateCcw className="h-3 w-3" />
          </button>
        </div>
      </div>
    );
  };

  const renderContentInspector = (id: OrderDocumentCanvasElementId) => {
    if (id === 'header' || id === 'document_details') {
      return (
        <InspectorSection title="Skupina elementov">
          <p className="text-xs leading-5 text-slate-500">
            Ta okvir je namenjen skupinskemu premiku. Za vsebino izberite enega od elementov znotraj njega ali ga izberite v meniju Elementi.
          </p>
        </InspectorSection>
      );
    }
    if (id === 'logo') {
      return (
        <div className="space-y-3" data-logo-text-pdf-controls>
          <InspectorSection title="Logotip">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div className="aspect-[73/22] w-full">
                <AtehnaDocumentLogo />
              </div>
            </div>
            <p className="text-[11px] leading-4 text-slate-500">
              PDF uporablja skupno različico »Dokumenti PDF«. Videz in besedilni plasti uredite tukaj, položaj celotnega logotipa pa neposredno na strani.
            </p>
          </InspectorSection>
          {logoCapabilities.editableText ? (
            <InspectorSection title="Besedilo logotipa">
              <SiteLogoTextLayerManager
                config={logoConfig}
                purposeId="pdf-document"
                showFields
                onConfigChange={onLogoConfigChange}
              />
            </InspectorSection>
          ) : (
            <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[10px] leading-4 text-slate-500">
              Besedilo d.o.o. in slogan lahko urejate pri vgrajenem logotipu ATEHNA. Naložena slika ohrani besedilo iz datoteke.
            </p>
          )}
        </div>
      );
    }
    if (id === 'company') {
      return (
        <InspectorSection title="Podatki podjetja">
          <div className="grid grid-cols-2 gap-2">
            <Field
              id="order-document-template-company-name"
              label="Ime"
              value={template.company.name}
              onChange={(value) => updateCompany('name', value)}
            />
            <Field
              id="order-document-template-company-addressLine1"
              label="Naslov"
              value={template.company.addressLine1}
              onChange={(value) => updateCompany('addressLine1', value)}
            />
          </div>
          <Field
            id="order-document-template-company-addressLine2"
            label="Kraj in pošta"
            value={template.company.addressLine2}
            onChange={(value) => updateCompany('addressLine2', value)}
            testId="order-document-template-company-addressLine2"
          />
        </InspectorSection>
      );
    }
    if (id === 'title') {
      return (
        <InspectorSection title="Naslov dokumenta">
          <Field
            id="order-document-template-title"
            label="Naslov"
            value={template.text.title}
            onChange={(value) => updateText('title', value)}
          />
          <Field
            id="order-document-template-text-subtitle"
            label="Podnaslov"
            value={template.text.subtitle}
            onChange={(value) => updateText('subtitle', value)}
            testId="order-document-template-text-subtitle"
          />
        </InspectorSection>
      );
    }
    if (id === 'customer') {
      return (
        <InspectorSection title="Oznake naročnika">
          <p className="text-xs leading-5 text-slate-500">Kliknite oznako, ki jo želite urediti.</p>
        </InspectorSection>
      );
    }
    if (id === 'document_meta') {
      return (
        <InspectorSection title="Oznake naročila">
          <p data-order-document-label-edit className="text-xs leading-5 text-slate-500">Kliknite posamezno oznako metapodatka neposredno na dokumentu.</p>
          <Field
            id="order-document-template-text-deliveryMethod"
            label="Način odpreme"
            value={template.text.deliveryMethod}
            onChange={(value) => updateText('deliveryMethod', value)}
            testId="order-document-template-text-deliveryMethod"
          />
        </InspectorSection>
      );
    }
    if (id === 'intro') {
      return (
        <InspectorSection title="Uvodno besedilo">
          <Field
            id="order-document-template-text-intro"
            label="Besedilo"
            value={template.text.intro}
            onChange={(value) => updateText('intro', value)}
            multiline
          />
        </InspectorSection>
      );
    }
    if (id === 'items') {
      return (
        <InspectorSection title="Oznake tabele">
          <p className="text-xs leading-5 text-slate-500">Kliknite naslov stolpca neposredno v glavi tabele.</p>
        </InspectorSection>
      );
    }
    if (id === 'totals') {
      return (
        <InspectorSection title="Oznake zneskov">
          <p className="text-xs leading-5 text-slate-500">Kliknite oznako zneska neposredno na dokumentu.</p>
        </InspectorSection>
      );
    }
    if (id === 'notes') {
      return (
        <InspectorSection title="Opombe">
          <p className="text-xs leading-5 text-slate-500">Kliknite oznako opomb neposredno na dokumentu.</p>
        </InspectorSection>
      );
    }
    if (id === 'closing') {
      return (
        <InspectorSection title="Zaključek in plačilo">
          <Field
            id="order-document-template-text-paymentTerms"
            label="Plačilni pogoji"
            value={template.text.paymentTerms}
            onChange={(value) => updateText('paymentTerms', value)}
            multiline
          />
          <Field
            id="order-document-template-text-closing"
            label="Zaključno besedilo"
            value={template.text.closing}
            onChange={(value) => updateText('closing', value)}
            multiline
          />
          <Field
            id="order-document-template-text-signerName"
            label="Ime podpisnika"
            value={template.text.signerName}
            onChange={(value) => updateText('signerName', value)}
            testId="order-document-template-text-signerName"
          />
        </InspectorSection>
      );
    }
    if (id === 'signatures') {
      return (
        <InspectorSection title="Podpisi">
          <p className="text-xs leading-5 text-slate-500">Kliknite oznako podpisa neposredno na dokumentu.</p>
        </InspectorSection>
      );
    }
    return (
      <>
        <InspectorSection title="Besedilo noge">
          <Field
            id="order-document-template-company-registrationText"
            label="Registracijski podatki"
            value={template.company.registrationText}
            onChange={(value) => updateCompany('registrationText', value)}
            multiline
            testId="order-document-template-company-registrationText"
          />
          <Field
            id="order-document-template-text-footerText"
            label="Besedilo z nadomestnimi oznakami"
            value={template.text.footerText}
            onChange={(value) => updateText('footerText', value)}
            multiline
            testId="order-document-template-text-footerText"
          />
        </InspectorSection>
        <InspectorSection title="Bančni in davčni podatki">
          <Field id="order-document-template-company-bankName" label="Banka" value={template.company.bankName} onChange={(value) => updateCompany('bankName', value)} testId="order-document-template-company-bankName" />
          <div className="grid grid-cols-2 gap-2">
            <Field id="order-document-template-company-iban" label="IBAN" value={template.company.iban} onChange={(value) => updateCompany('iban', value)} testId="order-document-template-company-iban" />
            <Field id="order-document-template-company-swift" label="SWIFT / BIC" value={template.company.swift} onChange={(value) => updateCompany('swift', value)} testId="order-document-template-company-swift" />
          </div>
          <Field id="order-document-template-company-taxId" label="ID za DDV" value={template.company.taxId} onChange={(value) => updateCompany('taxId', value)} testId="order-document-template-company-taxId" />
        </InspectorSection>
      </>
    );
  };

  const renderTableTypographyScopeControls = () => {
    const columnId = selectedChild?.kind === 'table_column'
      || selectedChild?.kind === 'table_header_cell'
      || selectedChild?.kind === 'table_cell'
      ? selectedChild.key
      : null;
    const rowNumber = selectedChild?.kind === 'table_row' || selectedChild?.kind === 'table_cell'
      ? selectedChild.rowNumber
      : null;
    const scopes: Array<{ label: string; selection: CanvasChildSelection }> = [
      { label: 'Glava tabele', selection: tableHeaderChild() },
      { label: 'Vrstice izdelkov', selection: tableBodyChild() }
    ];
    if (columnId) {
      scopes.push({ label: 'Cel stolpec', selection: tableColumnChild(columnId) });
    }
    if (rowNumber) {
      scopes.push({ label: `Vrstica ${rowNumber}`, selection: tableRowChild(rowNumber) });
    }
    if (selectedChild?.kind === 'table_header_cell') {
      scopes.push({ label: 'Ta naslovna celica', selection: tableHeaderCellChild(selectedChild.key) });
    }
    if (selectedChild?.kind === 'table_cell') {
      scopes.push({
        label: 'Ta celica',
        selection: tableCellChild(selectedChild.rowNumber, selectedChild.key)
      });
    }
    return (
      <section className={'space-y-1.5'} data-order-document-table-typography-scopes>
        <div className={'text-[9px] font-bold uppercase tracking-[0.1em] text-white/55'}>
          Obseg urejanja besedila
        </div>
        <div className={'flex flex-wrap gap-1'}>
          {scopes.map((scope) => {
            const active = selectedChildIds.includes(scope.selection.id);
            return (
              <CanvasTableScopeSelectionButton
                key={scope.selection.id}
                selection={scope.selection}
                active={active}
                label={scope.label}
                onSelect={selectChild}
              />
            );
          })}
        </div>
        <p className={'text-[8px] leading-3 text-white/40'}>
          Ctrl/Cmd + klik doda več obsegov; skupne nastavitve se uporabijo na vseh izbranih.
        </p>
      </section>
    );
  };

  const renderTableQuickStyleControls = () => {
    if (!selectedChild?.kind.startsWith('table_') || !selectedTypographyTarget) return null;
    const columnId = selectedChild.kind === 'table_column'
      || selectedChild.kind === 'table_header_cell'
      || selectedChild.kind === 'table_cell'
      ? selectedChild.key
      : null;
    const rowNumber = selectedChild.kind === 'table_row' || selectedChild.kind === 'table_cell'
      ? selectedChild.rowNumber
      : null;
    const activeScope: OrderDocumentTableQuickStyleScope = selectedChild.kind === 'table_header'
      ? 'header'
      : selectedChild.kind === 'table_body'
        ? 'body'
        : selectedChild.kind === 'table_column'
          ? 'column'
          : selectedChild.kind === 'table_row'
            ? 'row'
            : 'cell';
    const hasCellIdentity = selectedChild.kind === 'table_header_cell'
      || (columnId !== null && rowNumber !== null);
    const availableScopes: Record<OrderDocumentTableQuickStyleScope, boolean> = {
      header: true,
      body: true,
      column: columnId !== null,
      row: rowNumber !== null,
      cell: hasCellIdentity
    };
    const columnLabel = columnId
      ? ({
          sku: template.text.labels.code,
          quantity: template.text.labels.quantity,
          unit: template.text.labels.unit,
          description: template.text.labels.description,
          unitPrice: template.text.labels.unitPrice,
          lineTotal: template.text.labels.lineTotal
        } satisfies Record<OrderDocumentTableColumnId, string>)[columnId]
      : undefined;
    const scopeDetails: Partial<Record<OrderDocumentTableQuickStyleScope, string>> = {
      ...(columnLabel ? { column: columnLabel } : {}),
      ...(rowNumber ? { row: `#${rowNumber}` } : {}),
      ...(hasCellIdentity
        ? {
            cell: selectedChild.kind === 'table_header_cell'
              ? `Glava · ${columnLabel ?? selectedChild.key}`
              : `#${rowNumber} · ${columnLabel ?? columnId}`
          }
        : {})
    };

    return (
      <OrderDocumentTableQuickStyleControls
        template={template}
        target={selectedTypographyTarget}
        activeScope={activeScope}
        availableScopes={availableScopes}
        scopeDetails={scopeDetails}
        onSelectScope={(scope, gesture) => {
          const selection = scope === 'header'
            ? tableHeaderChild()
            : scope === 'body'
              ? tableBodyChild()
              : scope === 'column' && columnId
                ? tableColumnChild(columnId)
                : scope === 'row' && rowNumber
                  ? tableRowChild(rowNumber)
                  : scope === 'cell' && selectedChild.kind === 'table_header_cell'
                    ? tableHeaderCellChild(selectedChild.key)
                    : scope === 'cell' && columnId && rowNumber
                      ? tableCellChild(rowNumber, columnId)
                      : null;
          if (selection) selectChild(selection, gesture);
        }}
        onChange={onChange}
      />
    );
  };

  const renderContentPanel = (id: OrderDocumentCanvasElementId) => {
    if (id === 'items') {
      return (
        <div className={'space-y-2'}>
          {renderTableTypographyScopeControls()}
          <OrderDocumentTableContextControls
            template={template}
            selectedColumnId={
              selectedChild?.kind === 'table_column'
                || selectedChild?.kind === 'table_header_cell'
                || selectedChild?.kind === 'table_cell'
                ? selectedChild.key
                : null
            }
            selectedRowNumber={
              selectedChild?.kind === 'table_row' || selectedChild?.kind === 'table_cell'
                ? selectedChild.rowNumber
                : null
            }
            onChange={onChange}
          />
        </div>
      );
    }

    const fieldGroup = (ORDER_DOCUMENT_FIELD_ROW_IDS_BY_GROUP as Partial<
      Record<OrderDocumentCanvasElementId, readonly OrderDocumentFieldRowId[]>
    >)[id]
      ? id as OrderDocumentFieldGroupId
      : null;
    return (
      <div className="space-y-4">
        {id === 'company' ? (
          <>
            {selectedChild?.kind === 'company_contact' ? null : renderContentInspector('company')}
            <OrderDocumentCompanyContactsControls
              template={template}
              selectedContactId={selectedChild?.kind === 'company_contact' ? selectedChild.contactId : null}
              onChange={onChange}
              onSelectContact={(contactId) => selectChild(companyContactChild(contactId))}
              onSelectCompany={() => selectElement('company')}
            />
          </>
        ) : renderContentInspector(id)}
        {fieldGroup ? (
          <OrderDocumentFieldRowRestoreControls
            template={template}
            group={fieldGroup}
            onChange={onChange}
            onSelectRow={(rowId) => selectChild(fieldRowChild(fieldGroup, rowId))}
          />
        ) : null}
      </div>
    );
  };

  const renderStyleInspector = (
    id: OrderDocumentCanvasElementId,
    element: OrderDocumentCanvasElement
  ) => {
    if (id === 'logo') {
      return (
        <div
          className="grid grid-cols-2 gap-2 max-sm:grid-cols-1"
          data-logo-use-case="pdf-document"
          data-logo-placement="pdf-document"
          data-logo-toolbar-panel="appearance"
        >
          <InspectorSection title="Barve logotipa za PDF">
            <CompactHexColorField
              id="site-logo-pdf-backgroundColor"
              label="Glavno ozadje"
              value={logoPresentation.backgroundColor}
              marker="backgroundColor"
              onChange={(value) => updateLogoPresentation('backgroundColor', value)}
            />
            <CompactHexColorField
              id="site-logo-pdf-taglineBackgroundColor"
              label="Ozadje slogana"
              value={logoPresentation.taglineBackgroundColor}
              marker="taglineBackgroundColor"
              onChange={(value) => updateLogoPresentation('taglineBackgroundColor', value)}
            />
            <fieldset disabled={!logoCapabilities.artworkColors} className="space-y-2.5 disabled:opacity-50">
              <CompactHexColorField
                id="site-logo-pdf-primaryTextColor"
                label="Primarna rumena"
                value={logoPresentation.primaryTextColor}
                marker="primaryTextColor"
                onChange={(value) => updateLogoPresentation('primaryTextColor', value)}
              />
              <CompactHexColorField
                id="site-logo-pdf-secondaryTextColor"
                label="Barva d.o.o."
                value={logoPresentation.secondaryTextColor}
                marker="secondaryTextColor"
                onChange={(value) => updateLogoPresentation('secondaryTextColor', value)}
              />
              <CompactHexColorField
                id="site-logo-pdf-taglineTextColor"
                label="Besedilo slogana"
                value={logoPresentation.taglineTextColor}
                marker="taglineTextColor"
                onChange={(value) => updateLogoPresentation('taglineTextColor', value)}
              />
            </fieldset>
            {!logoCapabilities.artworkColors ? (
              <p className="text-[10px] leading-4 text-slate-500">
                Pri naloženi sliki je mogoče spremeniti ozadji; posamezne barve znakov so del datoteke.
              </p>
            ) : null}
          </InspectorSection>

          <InspectorSection title="Obroba znakov">
            <fieldset disabled={!logoCapabilities.outline} className="space-y-2.5 disabled:opacity-50">
              <div data-logo-presentation-control="outline.enabled">
                <Toggle
                  id="site-logo-pdf-outline-enabled"
                  label="Vključi obrobo"
                  checked={logoPresentation.outline.enabled}
                  onChange={(enabled) => updateLogoOutline('enabled', enabled)}
                />
              </div>
              {logoPresentation.outline.enabled ? (
                <>
                  <CompactHexColorField
                    id="site-logo-pdf-outline-color"
                    label="Barva obrobe"
                    value={logoPresentation.outline.color}
                    marker="outline.color"
                    onChange={(value) => updateLogoOutline('color', value)}
                  />
                  <div data-logo-presentation-control="outline.widthPx">
                    <NumberField
                      id="site-logo-pdf-outline-widthPx"
                      label="Debelina obrobe"
                      value={logoPresentation.outline.widthPx}
                      min={0}
                      max={24}
                      step={0.5}
                      unit="px"
                      onChange={(value) => updateLogoOutline('widthPx', value)}
                    />
                  </div>
                </>
              ) : null}
            </fieldset>
          </InspectorSection>

          <InspectorSection title="Senca znakov">
            <fieldset disabled={!logoCapabilities.shadow} className="space-y-2.5 disabled:opacity-50">
              <div data-logo-presentation-control="shadow.enabled">
                <Toggle
                  id="site-logo-pdf-shadow-enabled"
                  label="Vključi senco"
                  checked={logoPresentation.shadow.enabled}
                  onChange={(enabled) => updateLogoShadow('enabled', enabled)}
                />
              </div>
              {logoPresentation.shadow.enabled ? (
                <>
                  <CompactHexColorField
                    id="site-logo-pdf-shadow-color"
                    label="Barva sence"
                    value={logoPresentation.shadow.color}
                    marker="shadow.color"
                    onChange={(value) => updateLogoShadow('color', value)}
                  />
                  <div data-logo-presentation-control="shadow.opacity">
                    <NumberField
                      id="site-logo-pdf-shadow-opacity"
                      label="Prosojnost"
                      value={logoPresentation.shadow.opacity}
                      min={0}
                      max={1}
                      step={0.05}
                      unit="0–1"
                      onChange={(value) => updateLogoShadow('opacity', value)}
                    />
                  </div>
                  <div data-logo-presentation-control="shadow.blurPx">
                    <NumberField
                      id="site-logo-pdf-shadow-blurPx"
                      label="Zameglitev"
                      value={logoPresentation.shadow.blurPx}
                      min={0}
                      max={64}
                      step={0.5}
                      unit="px"
                      onChange={(value) => updateLogoShadow('blurPx', value)}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div data-logo-presentation-control="shadow.offsetXpx">
                      <NumberField
                        id="site-logo-pdf-shadow-offsetXpx"
                        label="Odmik X"
                        value={logoPresentation.shadow.offsetXpx}
                        min={-64}
                        max={64}
                        step={0.5}
                        unit="px"
                        onChange={(value) => updateLogoShadow('offsetXpx', value)}
                      />
                    </div>
                    <div data-logo-presentation-control="shadow.offsetYpx">
                      <NumberField
                        id="site-logo-pdf-shadow-offsetYpx"
                        label="Odmik Y"
                        value={logoPresentation.shadow.offsetYpx}
                        min={-64}
                        max={64}
                        step={0.5}
                        unit="px"
                        onChange={(value) => updateLogoShadow('offsetYpx', value)}
                      />
                    </div>
                  </div>
                </>
              ) : null}
            </fieldset>
          </InspectorSection>

          <InspectorSection title="Mere dokumenta">
            <NumberField
              id="order-document-template-style-logoWidthMm"
              label="Privzeta širina logotipa"
              value={template.style.logoWidthMm}
              min={50}
              max={95}
              step={0.5}
              unit="mm"
              onChange={(value) => updateStyle('logoWidthMm', value)}
              testId="order-document-template-style-logoWidthMm"
            />
          </InspectorSection>
        </div>
      );
    }

    return (
    <>
      {!GROUP_IDS.has(id) ? (
        <div className="space-y-3">
          <OrderDocumentTypographyControls
            template={template}
            target={{ kind: 'element', elementId: id }}
            onChange={onChange}
          />
          <OrderDocumentDecorationControls
            template={template}
            target={{ kind: 'element', elementId: id }}
            onChange={onChange}
          />
        </div>
      ) : null}
      <InspectorSection title="Barve besedila">
        <div data-testid="order-document-element-color">
          <ColorField
            id="order-document-element-color-picker"
            label="Besedilo"
            value={element.textColor}
            inherited={template.style.textColor}
            onChange={(textColor) => updateElement(id, { textColor })}
            testId="order-document-element-color-input"
          />
        </div>
        <ColorField
          id="order-document-element-muted-color"
          label="Sekundarno besedilo"
          value={element.mutedTextColor}
          inherited={template.style.mutedTextColor}
          onChange={(mutedTextColor) => updateElement(id, { mutedTextColor })}
        />
      </InspectorSection>

      {(id === 'header' || id === 'title' || id === 'items') ? (
      <InspectorSection title="Postavitev vsebine">
        {id === 'header' ? (
          <NumberField
            id="order-document-template-style-headerHeightMm"
            label="Višina glave"
            value={template.style.headerHeightMm}
            min={18}
            max={48}
            step={0.5}
            unit="mm"
            onChange={(value) => updateStyle('headerHeightMm', value)}
            testId="order-document-template-style-headerHeightMm"
          />
        ) : null}
        {id === 'title' ? (
          <div className="grid grid-cols-2 gap-2">
            {(['left', 'right'] as const).map((alignment) => (
              <button
                key={alignment}
                type="button"
                aria-pressed={template.style.titleAlignment === alignment}
                onClick={() => updateStyle('titleAlignment', alignment)}
                className={`h-9 rounded-lg border text-xs font-semibold ${
                  template.style.titleAlignment === alignment
                    ? 'border-blue-400 bg-blue-50 text-blue-700'
                    : 'border-slate-300 text-slate-600'
                }`}
                data-testid={`order-document-template-style-titleAlignment-${alignment}`}
              >
                {alignment === 'left' ? 'Levo' : 'Desno'}
              </button>
            ))}
          </div>
        ) : null}
        {id === 'items' ? (
          <>
            <NumberField
              id="order-document-template-style-rowPaddingPt"
              label="Odmik vrstic"
              value={template.style.rowPaddingPt}
              min={2}
              max={10}
              step={0.5}
              unit="pt"
              onChange={(value) => updateStyle('rowPaddingPt', value)}
              testId="order-document-template-style-rowPaddingPt"
            />
            <ColorField
              id="order-document-template-style-tableHeaderBackground"
              label="Ozadje glave tabele"
              value={template.style.tableHeaderBackground}
              inherited="#FFFFFF"
              onChange={(value) => updateStyle('tableHeaderBackground', value || '#FFFFFF')}
              testId="order-document-template-style-tableHeaderBackground"
            />
            <ColorField
              id="order-document-template-style-tableStripeColor"
              label="Izmenična vrstica"
              value={template.style.tableStripeColor}
              inherited="#FFFFFF"
              onChange={(value) => updateStyle('tableStripeColor', value || '#FFFFFF')}
              testId="order-document-template-style-tableStripeColor"
            />
            <ColorField
              id="order-document-template-style-tableHeaderTextColor"
              label="Besedilo glave tabele"
              value={template.style.tableHeaderTextColor}
              inherited={template.style.textColor}
              onChange={(value) => updateStyle('tableHeaderTextColor', value || template.style.textColor)}
              testId="order-document-template-style-tableHeaderTextColor"
            />
          </>
        ) : null}
      </InspectorSection>
      ) : null}
    </>
    );
  };

  const renderLogicInspector = (
    id: OrderDocumentCanvasElementId,
    element: OrderDocumentCanvasElement
  ) => (
    <div data-testid="order-document-element-logic-controls" className="grid gap-2">
      <InspectorSection title="Prikaz in postavitev">
        <div className="grid grid-cols-2 gap-1.5">
          <label className="min-w-0 text-[10px] font-semibold text-slate-600">
            <span className="mb-1 block">Način postavitve</span>
            <CompactDarkSelect
              marker="positioning"
              label="Način postavitve"
              value={element.positioning}
              options={[
                { value: 'absolute', label: 'Prosto na strani' },
                { value: 'flow', label: 'V toku dokumenta' }
              ]}
              onChange={(positioning) => updateElement(id, { positioning })}
            />
          </label>
          <label className="min-w-0 text-[10px] font-semibold text-slate-600">
            <span className="mb-1 block">Pogoj prikaza</span>
            <CompactDarkSelect
              marker="condition"
              label="Pogoj prikaza"
              value={element.condition}
              options={[
                { value: 'always', label: 'Vedno' },
                { value: 'has_items', label: 'Ko ima naročilo artikle' },
                { value: 'has_notes', label: 'Ko obstajajo opombe' },
                { value: 'has_shipping', label: 'Ko obstaja dostava' },
                { value: 'has_tax', label: 'Ko obstaja DDV' },
                { value: 'has_reference', label: 'Ko obstaja referenca' }
              ]}
              onChange={(condition) => updateElement(id, { condition })}
            />
          </label>
          {id === 'header' || id === 'logo' || id === 'company' || id === 'footer' ? (
            <label className="min-w-0 text-[10px] font-semibold text-slate-600">
              <span className="mb-1 block">Ponavljanje</span>
              <CompactDarkSelect
                marker="repeat"
                label="Ponavljanje"
                value={element.repeat}
                options={[
                  { value: 'once', label: 'Samo enkrat' },
                  { value: 'every_page', label: 'Na vsaki strani' }
                ]}
                onChange={(repeat) => updateElement(id, { repeat })}
              />
            </label>
          ) : null}
          <label className="min-w-0 text-[10px] font-semibold text-slate-600">
            <span className="mb-1 block">Prelivanje vsebine</span>
            <CompactDarkSelect
              marker="overflow"
              label="Prelivanje vsebine"
              value={element.overflow}
              options={[
                { value: 'visible', label: 'Dovoli prelivanje' },
                { value: 'clip', label: 'Skrij presežek' }
              ]}
              onChange={(overflow) => updateElement(id, { overflow })}
            />
          </label>
          <NumberField
            id="order-document-element-z-index"
            label="Plast"
            value={element.zIndex}
            min={-100}
            max={1000}
            step={1}
            unit=""
            onChange={(zIndex) => updateElement(id, { zIndex })}
          />
        </div>
      </InspectorSection>

      {id === 'footer' || id === 'totals' ? (
        <InspectorSection title="Elementi strani">
          {PAGE_CONTROL_FIELDS.filter((field) =>
            id === 'footer'
              ? field.key === 'showPageNumbers'
              : field.key === 'showShipping' || field.key === 'showTaxSummary'
          ).map((field) => (
            <Toggle
              key={field.key}
              id={`order-document-template-layout-${field.key}`}
              label={field.label}
              checked={template.layout[field.key]}
              onChange={(checked) => updateLayoutBoolean(field.key, checked)}
              testId={`order-document-template-layout-${field.key}`}
            />
          ))}
        </InspectorSection>
      ) : null}

      {id === 'closing' || id === 'document_meta' ? (
        <InspectorSection title="Roki">
          <NumberField
            id="order-document-template-rule-dueDays"
            label="Rok plačila"
            value={template.rules.dueDays}
            min={0}
            max={365}
            step={1}
            unit="dni"
            onChange={(value) => updateRule('dueDays', value)}
            testId="order-document-template-rule-dueDays"
          />
          <NumberField
            id="order-document-template-rule-validityDays"
            label="Veljavnost dokumenta"
            value={template.rules.validityDays}
            min={0}
            max={365}
            step={1}
            unit="dni"
            onChange={(value) => updateRule('validityDays', value)}
            testId="order-document-template-rule-validityDays"
          />
        </InspectorSection>
      ) : null}
    </div>
  );

  return (
    <SiteLogoProvider config={logoConfig}>
      <div className="min-w-0" data-testid="order-document-template-fields">
      <div ref={editorFrameRef} className="relative rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex min-w-0 flex-wrap items-center gap-1 border-b border-slate-200 px-3 py-2">
          <div className="mr-2 flex items-center gap-2 text-xs font-semibold text-slate-700">
            <Move className="h-4 w-4 text-blue-600" />
            Izberi in povleci element
          </div>
          <button
            type="button"
            aria-label="Pripenjanje na mrežo"
            title="Pripenjanje na mrežo"
            aria-pressed={canvas.snapToGrid}
            onClick={() => updateCanvasSettings({ snapToGrid: !canvas.snapToGrid })}
            data-testid="order-document-snap-toggle"
            className={`inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition ${
              canvas.snapToGrid
                ? 'bg-blue-50 text-blue-700'
                : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'
            }`}
          >
            <Magnet className="h-4 w-4" /> Pripni
          </button>
          <ToolbarButton
            label="Prikaži mrežo"
            active={canvas.showGrid}
            onClick={() => updateCanvasSettings({ showGrid: !canvas.showGrid })}
          >
            <Grid3X3 className="h-4 w-4" />
            Mreža
          </ToolbarButton>
          <ToolbarButton
            label="Prikaži ravnila"
            active={canvas.showRulers}
            onClick={() => updateCanvasSettings({ showRulers: !canvas.showRulers })}
          >
            <Ruler className="h-4 w-4" />
            Ravnila
          </ToolbarButton>

          {deletedElementIds.length > 0 ? (
            <div
              ref={restoreElementsPopoverRef}
              className="relative ml-auto"
              data-order-document-canvas-popover-root="restore-elements"
              data-order-document-canvas-popover-dismiss="outside-pointer"
              data-order-document-canvas-popover-group="toolbar"
            >
              <ToolbarButton
                label="Dodaj izbrisan element"
                active={restoreElementsOpen}
                buttonRef={restoreElementsTriggerRef}
                popover
                onClick={() => {
                  setRestoreElementsOpen((value) => !value);
                  setLayersOpen(false);
                  setPageSettingsOpen(false);
                }}
              >
                <Plus className="h-4 w-4" />
                Dodaj element
              </ToolbarButton>
              {restoreElementsOpen ? (
                <div
                  role="dialog"
                  aria-label="Izbrisani elementi"
                  data-order-document-canvas-popover-panel="restore-elements"
                  className="absolute right-0 top-10 z-[120] w-[290px] max-w-[calc(100vw-3rem)] rounded-xl border border-slate-200 bg-white p-2 shadow-2xl"
                  data-testid="order-document-restore-elements"
                >
                  <div className="px-2 pb-2 pt-1 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
                    Izbrisani elementi
                  </div>
                  <div className="space-y-1">
                    {deletedElementIds.map((id) => (
                      <button
                        key={id}
                        type="button"
                        className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left transition hover:bg-slate-50"
                        onClick={() => restoreElement(id)}
                        data-testid={'order-document-restore-element-' + id}
                      >
                        <Plus className="h-3.5 w-3.5 shrink-0 text-blue-600" />
                        <span className="min-w-0">
                          <span className="block truncate text-xs font-semibold text-slate-700">
                            {ELEMENT_META[id].label}
                          </span>
                          <span className="block text-[10px] text-slate-400">Obnovi privzeto postavitev</span>
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          <div
            ref={layersPopoverRef}
            className={deletedElementIds.length > 0 ? 'relative' : 'relative ml-auto'}
            data-order-document-canvas-popover-root="layers"
            data-order-document-canvas-popover-dismiss="outside-pointer"
            data-order-document-canvas-popover-group="toolbar"
          >
            <ToolbarButton
              label="Elementi dokumenta"
              active={layersOpen}
              buttonRef={layersTriggerRef}
              popover
              onClick={() => {
                setLayersOpen((value) => !value);
                setRestoreElementsOpen(false);
                setPageSettingsOpen(false);
              }}
            >
              <Layers3 className="h-4 w-4" />
              Elementi
            </ToolbarButton>
            {layersOpen ? (
              <div
                role="dialog"
                aria-label="Plasti dokumenta"
                data-testid="order-document-layers"
                data-order-document-canvas-popover-panel="layers"
                className="absolute right-0 top-10 z-[120] w-[350px] max-w-[calc(100vw-3rem)] rounded-xl border border-slate-200 bg-white p-2 shadow-2xl"
              >
                <div className="px-2 pb-2 pt-1 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
                  Plasti dokumenta
                </div>
                <div className="max-h-[430px] space-y-1 overflow-auto">
                  {activeElementIds.map((id) => {
                    const element = canvas.elements[id];
                    return (
                      <div
                        key={id}
                        className={`flex items-center gap-2 rounded-lg border px-2 py-2 ${
                          selectedElementId === id
                            ? 'border-blue-300 bg-blue-50'
                            : 'border-transparent hover:bg-slate-50'
                        }`}
                      >
                        <span className={element.visible ? 'text-emerald-600' : 'text-slate-400'} aria-hidden="true">
                          {element.visible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                        </span>
                        <button
                          type="button"
                          className="min-w-0 flex-1 text-left"
                          onClick={(event) => {
                            selectElement(id, { additive: event.ctrlKey || event.metaKey });
                            setLayersOpen(false);
                          }}
                        >
                          <span className="block truncate text-xs font-semibold text-slate-700">
                            {ELEMENT_META[id].label}
                          </span>
                          <span className="block truncate text-[10px] text-slate-400">
                            {element.positioning === 'absolute' ? 'Prosta postavitev' : 'Tok dokumenta'}
                          </span>
                        </button>
                      </div>
                    );
                  })}
                  <div className="mx-1 mt-2 border-t border-slate-200 pt-2">
                    <div className="px-1 pb-1 text-[9px] font-bold uppercase tracking-[0.12em] text-slate-400">
                      Vidnost in vrstni red razdelkov
                    </div>
                    {activeSections.map((section, index) => (
                      <div
                        key={section.id}
                        className="mt-1 flex items-center gap-2 rounded-lg bg-slate-50 px-2 py-1.5"
                        data-testid={`order-document-template-section-${section.id}`}
                      >
                        <AdminCheckbox
                          id={`order-document-template-section-enabled-${section.id}`}
                          checked={section.enabled}
                          onChange={(event) => updateSection(section.id, event.target.checked)}
                          data-testid={`order-document-template-section-${section.id}-enabled`}
                        />
                        <label
                          htmlFor={`order-document-template-section-enabled-${section.id}`}
                          className="min-w-0 flex-1 cursor-pointer truncate text-[11px] font-semibold text-slate-600"
                        >
                          {SECTION_META[section.id]}
                        </label>
                        <button
                          type="button"
                          className="h-7 w-7 rounded border border-slate-200 bg-white text-xs text-slate-500 disabled:opacity-30"
                          disabled={index === 0}
                          onClick={() => moveSection(section.id, -1)}
                          data-testid={`order-document-template-section-${section.id}-up`}
                          aria-label={`Premakni ${SECTION_META[section.id]} navzgor`}
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          className="h-7 w-7 rounded border border-slate-200 bg-white text-xs text-slate-500 disabled:opacity-30"
                          disabled={index === activeSections.length - 1}
                          onClick={() => moveSection(section.id, 1)}
                          data-testid={`order-document-template-section-${section.id}-down`}
                          aria-label={`Premakni ${SECTION_META[section.id]} navzdol`}
                        >
                          ↓
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          <div
            ref={pageSettingsPopoverRef}
            className="relative"
            data-order-document-canvas-popover-root="page-settings"
            data-order-document-canvas-popover-dismiss="outside-pointer"
            data-order-document-canvas-popover-group="toolbar"
          >
            <ToolbarButton
              label="Nastavitve strani"
              active={pageSettingsOpen}
              buttonRef={pageSettingsTriggerRef}
              popover
              onClick={() => {
                setPageSettingsOpen((value) => !value);
                setLayersOpen(false);
                setRestoreElementsOpen(false);
              }}
            >
              <Settings2 className="h-4 w-4" />
              Stran
            </ToolbarButton>
            {pageSettingsOpen ? (
              <div
                role="dialog"
                aria-label="Nastavitve strani"
                data-testid="order-document-page-settings"
                data-order-document-canvas-popover-panel="page-settings"
                data-order-document-settings-surface
                data-order-document-settings-density="compact"
                data-order-document-settings-scroll="none"
                className="absolute right-0 top-10 z-[120] grid w-[min(760px,calc(100vw-3rem))] grid-cols-3 gap-2 rounded-xl border border-slate-200 bg-white p-3 shadow-2xl max-[900px]:grid-cols-2 max-md:grid-cols-1"
              >
                <ColorField
                  id="order-document-template-style-pageBackground"
                  label="Ozadje strani"
                  value={template.style.pageBackground}
                  inherited="#FFFFFF"
                  onChange={(value) => updateStyle('pageBackground', value || '#FFFFFF')}
                  testId="order-document-template-style-pageBackground"
                />
                <ColorField
                  id="order-document-template-style-textColor"
                  label="Privzeto besedilo"
                  value={template.style.textColor}
                  inherited="#151515"
                  onChange={(value) => updateStyle('textColor', value || '#151515')}
                  testId="order-document-template-style-textColor"
                />
                <ColorField
                  id="order-document-template-style-mutedTextColor"
                  label="Sekundarno besedilo"
                  value={template.style.mutedTextColor}
                  inherited="#5F6875"
                  onChange={(value) => updateStyle('mutedTextColor', value || '#5F6875')}
                  testId="order-document-template-style-mutedTextColor"
                />
                <ColorField
                  id="order-document-template-style-lineColor"
                  label="Črte dokumenta"
                  value={template.style.lineColor}
                  inherited="#A7AFB8"
                  onChange={(value) => updateStyle('lineColor', value || '#A7AFB8')}
                  testId="order-document-template-style-lineColor"
                />
                <ColorField
                  id="order-document-template-style-accentColor"
                  label="Privzeti poudarek"
                  value={template.style.accentColor}
                  inherited="#D6A900"
                  onChange={(value) => updateStyle('accentColor', value || '#D6A900')}
                  testId="order-document-template-style-accentColor"
                />
                <NumberField
                  id="order-document-template-style-marginMm"
                  label="Varnostni rob"
                  value={template.style.marginMm}
                  min={10}
                  max={30}
                  step={0.5}
                  unit="mm"
                  onChange={(value) => updateStyle('marginMm', value)}
                  testId="order-document-template-style-marginMm"
                />
                <NumberField
                  id="order-document-grid-size"
                  label="Korak mreže"
                  value={canvas.gridSizeMm}
                  min={0.5}
                  max={20}
                  step={0.5}
                  unit="mm"
                  onChange={(gridSizeMm) => updateCanvasSettings({ gridSizeMm })}
                />
                <Toggle
                  id="order-document-snap-elements"
                  label="Pripni na druge elemente"
                  checked={canvas.snapToElements}
                  onChange={(snapToElements) => updateCanvasSettings({ snapToElements })}
                />
                <Toggle
                  id="order-document-show-guides"
                  label="Prikaži pametna vodila"
                  checked={canvas.showGuides}
                  onChange={(showGuides) => updateCanvasSettings({ showGuides })}
                />
                <p className="col-span-full rounded-lg bg-slate-50 px-2.5 py-1.5 text-[9px] leading-3.5 text-slate-500">
                  Med vlečenjem držite Alt za popolnoma prost premik brez mreže in pripenjanja.
                </p>
              </div>
            ) : null}
          </div>
        </div>

        <div className="grid min-w-0 bg-slate-100">
          <div ref={scrollRegionRef} className="min-w-0 overflow-auto p-4 sm:p-6">
            <div
              className={`relative mx-auto w-full max-w-[760px] ${canvas.showRulers ? 'pl-8 pt-7' : ''}`}
              aria-label="Interaktivno platno dokumenta A4"
            >
              {canvas.showRulers ? (
                <>
                  <div
                    data-testid="order-document-ruler-horizontal"
                    className="absolute left-8 right-0 top-0 h-7 select-none border-b border-slate-300"
                    aria-hidden="true"
                  >
                    <RulerTicks axis="horizontal" />
                  </div>
                  <div
                    data-testid="order-document-ruler-vertical"
                    className="absolute bottom-0 left-0 top-7 w-8 select-none border-r border-slate-300"
                    aria-hidden="true"
                  >
                    <RulerTicks axis="vertical" />
                  </div>
                  <span className="absolute left-0 top-0 flex h-7 w-8 items-center justify-center text-[8px] font-bold text-slate-400">
                    mm
                  </span>
                </>
              ) : null}

              <div
                ref={pageRef}
                data-testid="order-document-canvas"
                data-page-format="A4"
                data-order-document-selection-count={selectionEntries.length}
                data-order-document-multi-dragging={
                  transientElement
                    && Object.keys(interactionRef.current?.groupStarts ?? {}).length > 1
                    ? true
                    : undefined
                }
                className="relative aspect-[210/297] w-full overflow-hidden border border-slate-300 shadow-[0_18px_50px_rgba(15,23,42,0.16)]"
                style={{
                  backgroundColor: template.style.pageBackground,
                  backgroundImage: canvas.showGrid
                    ? 'linear-gradient(to right, rgba(14,116,144,.10) 1px, transparent 1px), linear-gradient(to bottom, rgba(14,116,144,.10) 1px, transparent 1px)'
                    : undefined,
                  backgroundSize: canvas.showGrid
                    ? `${(canvas.gridSizeMm / A4_WIDTH_MM) * 100}% 100%, 100% ${(canvas.gridSizeMm / A4_HEIGHT_MM) * 100}%`
                    : undefined
                }}
                onPointerDownCapture={handleCanvasPointerDownCapture}
                onClickCapture={handleCanvasClickCapture}
                onClick={clearSelection}
                onPointerMove={handlePointerMove}
                onPointerUp={endInteraction}
                onPointerCancel={cancelInteraction}
              >
                {multipleSelection ? (
                  <div
                    role="status"
                    aria-live="polite"
                    data-testid="order-document-selection-count"
                    data-order-document-selection-chrome
                    data-order-document-editor-only
                    className="pointer-events-none absolute right-2 top-2 z-[2147483001] rounded-full bg-blue-600 px-2 py-1 text-[9px] font-bold text-white shadow"
                  >
                    {selectionEntries.length} izbranih
                  </div>
                ) : null}
                <div
                  data-testid="order-document-guides"
                  data-order-document-alignment-guides
                  data-order-document-editor-only
                  className="pointer-events-none absolute inset-0 z-[2147482990]"
                  aria-hidden="true"
                >
                  {canvas.showGuides ? (
                    <>
                      <span
                        data-order-document-drop-zone="page-margins"
                        className="absolute border border-dashed border-fuchsia-500/20"
                        style={{
                          left: `${(template.style.marginMm / A4_WIDTH_MM) * 100}%`,
                          right: `${(template.style.marginMm / A4_WIDTH_MM) * 100}%`,
                          top: `${(template.style.marginMm / A4_HEIGHT_MM) * 100}%`,
                          bottom: `${(template.style.marginMm / A4_HEIGHT_MM) * 100}%`
                        }}
                      />
                      <span
                        data-order-document-drop-zone="page-center-x"
                        className="absolute inset-y-0 left-1/2 w-px bg-fuchsia-500/20"
                      />
                      <span
                        data-order-document-drop-zone="page-center-y"
                        className="absolute inset-x-0 top-1/2 h-px bg-fuchsia-500/20"
                      />
                    </>
                  ) : null}
                  {canvas.showGuides ? guides?.map((guide) => {
                    const isHorizontalAxis = guide.axis === 'x';
                    const positionPercent = (
                      guide.positionMm / (isHorizontalAxis ? A4_WIDTH_MM : A4_HEIGHT_MM)
                    ) * 100;
                    const markerPercent = (
                      guide.markerMm / (isHorizontalAxis ? A4_HEIGHT_MM : A4_WIDTH_MM)
                    ) * 100;
                    const labelTransform = isHorizontalAxis
                      ? guide.positionMm > A4_WIDTH_MM / 2
                        ? 'translate(calc(-100% - 4px), -50%)'
                        : 'translate(4px, -50%)'
                      : guide.positionMm > A4_HEIGHT_MM / 2
                        ? 'translate(-50%, calc(-100% - 4px))'
                        : 'translate(-50%, 4px)';
                    return (
                      <div
                        key={`${guide.axis}-${guide.targetId}-${guide.movingAnchor}-${guide.targetAnchor}`}
                        data-order-document-alignment-guide={guide.axis}
                        data-order-document-alignment-source-anchor={guide.movingAnchor}
                        data-order-document-alignment-target={guide.targetId}
                        data-order-document-drop-zone={guide.targetKind}
                        data-order-document-alignment-mode={canvas.snapToElements ? 'snap' : 'suggestion'}
                        className="absolute inset-0"
                      >
                        <span
                          className={isHorizontalAxis
                            ? canvas.snapToElements
                              ? 'absolute inset-y-0 w-px bg-fuchsia-600 shadow-[0_0_0_1px_rgba(255,255,255,0.8)]'
                              : 'absolute inset-y-0 border-l border-dashed border-fuchsia-600'
                            : canvas.snapToElements
                              ? 'absolute inset-x-0 h-px bg-fuchsia-600 shadow-[0_0_0_1px_rgba(255,255,255,0.8)]'
                              : 'absolute inset-x-0 border-t border-dashed border-fuchsia-600'}
                          style={isHorizontalAxis
                            ? { left: `${positionPercent}%` }
                            : { top: `${positionPercent}%` }}
                        />
                        <span
                          data-order-document-alignment-guide-label
                          className={`absolute max-w-40 truncate whitespace-nowrap rounded-full px-2 py-1 text-[8px] font-bold leading-none shadow-lg ${
                            canvas.snapToElements
                              ? 'bg-fuchsia-600 text-white'
                              : 'border border-fuchsia-500 bg-white text-fuchsia-700'
                          }`}
                          style={{
                            left: `${isHorizontalAxis ? positionPercent : clamp(markerPercent, 3, 97)}%`,
                            top: `${isHorizontalAxis ? clamp(markerPercent, 3, 97) : positionPercent}%`,
                            transform: labelTransform
                          }}
                        >
                          {guide.label}
                        </span>
                      </div>
                    );
                  }) : null}
                </div>
                <div
                  data-testid="order-document-alignment-guide-status"
                  className="sr-only"
                  role="status"
                  aria-live="polite"
                  aria-atomic="true"
                >
                  {guides?.length
                    ? `Predlagana poravnava: ${guides.map((guide) => guide.label).join(', ')}`
                    : ''}
                </div>

                {activeElementIds.map((id) => {
                  const baseElement = previewElements[id];
                  const activeInteraction = interactionRef.current;
                  const groupDragStart = activeInteraction?.kind === 'move'
                    ? activeInteraction.groupStarts[id]
                    : undefined;
                  const groupDragDelta = transientElement && activeInteraction?.kind === 'move'
                    ? {
                        xMm: transientElement.xMm - activeInteraction.start.xMm,
                        yMm: transientElement.yMm - activeInteraction.start.yMm
                      }
                    : null;
                  const parentGroupId = groupForChild(id);
                  const groupOffset =
                    parentGroupId && transientElement?.id === parentGroupId
                      ? {
                          xMm: transientElement.xMm - canvas.elements[parentGroupId].xMm,
                          yMm: transientElement.yMm - previewElements[parentGroupId].yMm
                        }
                      : null;
                  const element =
                    groupDragStart && groupDragDelta
                      ? {
                          ...groupDragStart,
                          positioning: 'absolute' as const,
                          xMm: roundMm(groupDragStart.xMm + groupDragDelta.xMm),
                          yMm: roundMm(groupDragStart.yMm + groupDragDelta.yMm)
                        }
                    : transientElement?.id === id
                      ? transientElement
                      : groupOffset
                        ? {
                            ...baseElement,
                            xMm: baseElement.xMm + groupOffset.xMm,
                            yMm: baseElement.yMm + groupOffset.yMm
                          }
                        : baseElement;
                  const selected = selectedElementIdSet.has(id);
                  const group = GROUP_IDS.has(id);
                  const conditionMatched = matchesOrderDocumentElementCondition(
                    element,
                    previewContext
                  );
                  const previewRendered = shouldRenderOrderDocumentPreviewElement(
                    element,
                    previewContext,
                    1
                  );
                  const editorOnlyReason = !element.visible
                    ? `${ELEMENT_META[id].label} je skrit`
                    : !conditionMatched
                      ? `${ELEMENT_META[id].label}: pogoj ni izpolnjen`
                      : `${ELEMENT_META[id].label} ni na tej strani`;
                  return (
                    <div
                      key={id}
                      data-logo-use-case={id === 'logo' ? 'pdf-document' : undefined}
                      data-logo-placement={id === 'logo' ? 'pdf-document' : undefined}
                      data-order-document-element-id={id}
                      data-canvas-element-id={id}
                      data-order-document-element-selected={selected || undefined}
                      data-canvas-element-selected={selected || undefined}
                      data-order-document-element-hidden={!element.visible || undefined}
                      data-order-document-element-condition-matched={conditionMatched}
                      data-order-document-preview-rendered={previewRendered}
                      data-order-document-editor-only-hidden-state={!previewRendered || undefined}
                      data-order-document-drag-handle
                      onClick={(event) => {
                        event.stopPropagation();
                        selectElement(id, { additive: event.ctrlKey || event.metaKey });
                      }}
                      onPointerDown={(event) => {
                        if ((event.target as HTMLElement).closest('[data-order-document-child], [data-order-document-resize-handle]')) return;
                        beginInteraction(id, 'move', event);
                      }}
                      className={`group absolute touch-none select-none border transition-opacity ${
                        group
                          ? 'border-dashed border-transparent hover:border-blue-300/50'
                          : 'border-transparent hover:border-blue-300/80'
                       } ${selected ? adminEditorSelectionOutlineTokenClasses : ''} ${element.locked ? 'cursor-not-allowed' : 'cursor-move'} ${previewRendered ? '' : 'border-dashed !border-slate-400 bg-slate-100/75 opacity-70'}`}
                      style={{
                        left: `${(element.xMm / A4_WIDTH_MM) * 100}%`,
                        top: `${(element.yMm / A4_HEIGHT_MM) * 100}%`,
                        width: `${(element.widthMm / A4_WIDTH_MM) * 100}%`,
                        height: `${(element.heightMm / A4_HEIGHT_MM) * 100}%`,
                        zIndex: element.zIndex,
                        overflow: element.overflow
                      }}
                    >
                      <div className={`relative z-10 h-full ${previewRendered ? '' : 'opacity-30'}`}>
                        {previewRendered ? (
                          <OrderDocumentTypographyPreviewContext.Provider value={template}>
                            <OrderDocumentElementPreviewContext.Provider value={element}>
                              <OrderDocumentFieldRowInteractionContext.Provider
                                value={{
                                  transient: transientFieldRowPlacements,
                                  begin: beginFieldRowInteraction
                                }}
                              >
                                <ElementPreview
                                  id={id}
                                  template={template}
                                  previewContext={previewContext}
                                  element={element}
                                  selectedChildId={selectedChildIds}
                                  onSelectChild={selectChild}
                                />
                              </OrderDocumentFieldRowInteractionContext.Provider>
                            </OrderDocumentElementPreviewContext.Provider>
                          </OrderDocumentTypographyPreviewContext.Provider>
                        ) : (
                          <div className="flex h-full items-center justify-center gap-1 text-[7px] font-bold uppercase tracking-wide text-slate-500">
                            <EyeOff className="h-3 w-3" /> {editorOnlyReason} · samo urejevalnik
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}

                {selectedElementId && selectedElement && !selectedChild ? (
                  <div
                    data-order-document-selection-chrome
                    data-order-document-editor-only
                    className={`pointer-events-none absolute z-[2147483000] ${adminEditorSelectionOutlineTokenClasses}`}
                    style={{
                      left: `${(selectedElement.xMm / A4_WIDTH_MM) * 100}%`,
                      top: `${(selectedElement.yMm / A4_HEIGHT_MM) * 100}%`,
                      width: `${(selectedElement.widthMm / A4_WIDTH_MM) * 100}%`,
                      height: `${(selectedElement.heightMm / A4_HEIGHT_MM) * 100}%`
                    }}
                  >
                    <button
                      type="button"
                      data-order-document-drag-handle
                      className="pointer-events-auto absolute -top-6 left-0 flex h-5 cursor-move items-center gap-1 whitespace-nowrap rounded bg-blue-600 px-1.5 text-[8px] font-bold text-white shadow"
                      onPointerDown={(event) => beginInteraction(selectedElementId, 'move', event)}
                      aria-label={`Premakni ${ELEMENT_META[selectedElementId].label}`}
                      tabIndex={-1}
                    >
                      {selectedElement.locked ? <Lock className="h-2.5 w-2.5" /> : <Move className="h-2.5 w-2.5" />}
                      {ELEMENT_META[selectedElementId].label}
                    </button>
                    {!selectedElement.locked ? (
                      <button
                        type="button"
                        data-order-document-resize-handle
                        className="pointer-events-auto absolute -bottom-1.5 -right-1.5 h-3.5 w-3.5 cursor-nwse-resize rounded-[3px] border-2 border-white bg-blue-600 shadow"
                        onPointerDown={(event) => beginInteraction(selectedElementId, 'resize', event)}
                        aria-label={`Spremeni velikost ${ELEMENT_META[selectedElementId].label}`}
                        tabIndex={-1}
                      />
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>
          </div>

        </div>

        {selectedElementId && selectedElement ? (
          <FloatingAppearanceEditorContextToolbar
            anchorId={selectedChild?.id ?? selectedElementId}
            frameRef={editorFrameRef}
            viewportRef={pageRef}
            scrollRegionRef={scrollRegionRef}
            ariaLabel={multipleSelection
              ? `Skupne nastavitve za ${selectionEntries.length} izbranih elementov`
              : selectedChild
                ? `Uredi ${selectedChildName}`
                : `Orodja za ${ELEMENT_META[selectedElementId].label}`}
            testId="order-document-floating-toolbar"
            className="!transition-none"
          >
            <OrderDocumentContextToolbar
              anchorId={selectedChild?.id ?? selectedElementId}
              label={multipleSelection
                ? `${selectionEntries.length} izbranih`
                : selectedChild
                  ? selectedChildName
                  : ELEMENT_META[selectedElementId].label}
              initialPanel={null}
              childEditor={
                !multipleSelection && selectedChild &&
                selectedChild.kind !== 'table_column' &&
                selectedChild.kind !== 'table_row' &&
                !selectedChild.kind.startsWith('table_')
                  ? renderSelectedChildInspector(selectedChild)
                  : undefined
              }
              childActions={
                !multipleSelection && selectedChild?.kind === 'field_row'
                  ? renderSelectedFieldRowActions(selectedChild)
                  : undefined
              }
              compactGeometryAction={selectedChild?.kind === 'field_row'}
              compactStyleAction={!multipleSelection && Boolean(selectedChild && selectedTypographyTarget)}
              inlineStyleControls={selectedTypographyTargets.length > 0 ? (
                <OrderDocumentInlineTypographyControls
                  template={template}
                  targets={selectedTypographyTargets}
                  onChange={onChange}
                />
              ) : undefined}
              showElementActions={!selectedChild || selectedElementIds.length > 0}
              multiSelectionCount={selectionEntries.length}
              geometryPanel={
                multipleSelection ? (
                  <div
                    className={'space-y-1.5 text-[9px] leading-3.5 text-white/65'}
                    data-order-document-multi-selection-geometry
                    data-order-document-multi-selection-compatible-move={
                      selectedElementIds.length + selectedFieldRowCount
                    }
                  >
                    <p>{selectionEntries.length} izbranih · {selectedElementIds.length + selectedFieldRowCount} premakljivih.</p>
                    <p>
                      Skupaj se premaknejo izbrani elementi iste vrste: elementi strani med seboj ali besedilne vrstice med seboj. Celice tabele ostanejo slogovni izbor.
                    </p>
                  </div>
                ) : selectedChild?.kind.startsWith('table_') ? (
                  <p className={'text-[10px] leading-4 text-white/60'}>
                    Položaj tabele urejajte z izborom elementa Artikli; tukaj je izbran le obseg besedila.
                  </p>
                ) : selectedChild?.kind === 'field_row' ? (
                  renderSelectedFieldRowGeometry(selectedChild)
                ) : <div className="grid grid-cols-2 gap-2">
                  <div data-testid="order-document-element-x">
                    <CompactGeometryField
                      label="X"
                      value={selectedElement.xMm}
                      min={0}
                      max={A4_WIDTH_MM - selectedElement.widthMm}
                      onChange={(xMm) => updateElement(selectedElementId, { xMm, positioning: 'absolute' })}
                      testId="order-document-element-x-input"
                    />
                  </div>
                  <div data-testid="order-document-element-y">
                    <CompactGeometryField
                      label="Y"
                      value={selectedElement.yMm}
                      min={0}
                      max={A4_HEIGHT_MM - selectedElement.heightMm}
                      onChange={(yMm) => updateElement(selectedElementId, { yMm, positioning: 'absolute' })}
                      testId="order-document-element-y-input"
                    />
                  </div>
                  <div data-testid="order-document-element-width">
                    <CompactGeometryField
                      label="Š"
                      value={selectedElement.widthMm}
                      min={MIN_ELEMENT_SIZE_MM}
                      max={A4_WIDTH_MM - selectedElement.xMm}
                      onChange={(widthMm) => updateElement(selectedElementId, { widthMm, positioning: 'absolute' })}
                      testId="order-document-element-width-input"
                    />
                  </div>
                  <div data-testid="order-document-element-height">
                    <CompactGeometryField
                      label="V"
                      value={selectedElement.heightMm}
                      min={MIN_ELEMENT_SIZE_MM}
                      max={A4_HEIGHT_MM - selectedElement.yMm}
                      onChange={(heightMm) => updateElement(selectedElementId, { heightMm, positioning: 'absolute' })}
                      testId="order-document-element-height-input"
                    />
                  </div>
                </div>
              }
              contentPanel={renderContentPanel(selectedElementId)}
              stylePanel={
                multipleSelection ? (
                  selectedTypographyTargets.length > 0 ? (
                    <div className="space-y-2" data-order-document-multi-selection-style-summary>
                      {selectedTypographyTargets.length < selectionEntries.length ? (
                        <p className="rounded-md border border-amber-300/20 bg-amber-300/10 px-2 py-1 text-[8px] leading-3 text-amber-100">
                          Slog se uporabi na {selectedTypographyTargets.length} od {selectionEntries.length} izbranih besedilnih obsegov; netipografski okvirji ostanejo nespremenjeni.
                        </p>
                      ) : null}
                      <OrderDocumentBatchTypographyControls
                        template={template}
                        targets={selectedTypographyTargets}
                        onChange={onChange}
                      />
                    </div>
                  ) : (
                    <p className={'text-[10px] leading-4 text-white/60'}>
                      Izbrani elementi nimajo skupnih nastavitev tipografije.
                    </p>
                  )
                ) : selectedChild && selectedTypographyTarget ? (
                  <div className="space-y-3">
                    {renderTableQuickStyleControls()}
                    <OrderDocumentTypographyControls
                      template={template}
                      target={selectedTypographyTarget}
                      showAlignment={!selectedChild.kind.startsWith('table_')}
                      resolutionTargets={
                        selectedChild.kind === 'company_contact'
                          ? [
                              { kind: 'field_row', group: 'company', rowId: 'contacts' },
                              selectedTypographyTarget
                            ]
                          : selectedTypographyTarget
                      }
                      onChange={onChange}
                    />
                    {selectedChild.kind === 'field_row' ? (
                      <OrderDocumentDecorationControls
                        template={template}
                        target={{
                          kind: 'field_row',
                          group: selectedChild.group,
                          rowId: selectedChild.rowId
                        }}
                        onChange={onChange}
                      />
                    ) : null}
                  </div>
                ) : renderStyleInspector(selectedElementId, selectedElement)
              }
              logicPanel={multipleSelection
                ? <p className={'text-[10px] leading-4 text-white/60'}>Logični pogoji ostanejo vezani na posamezne elemente.</p>
                : renderLogicInspector(selectedElementId, selectedElement)}
              visible={selectedElementIds.length > 0
                ? selectedElementIds.every((id) => previewElements[id].visible)
                : selectedElement.visible}
              locked={selectedElementIds.length > 0
                ? selectedElementIds.every((id) => previewElements[id].locked)
                : selectedElement.locked}
              onToggleVisible={() => selectedElementIds.length > 0
                ? updateSelectedElements({
                    visible: !selectedElementIds.every((id) => previewElements[id].visible)
                  })
                : updateElement(selectedElementId, { visible: !selectedElement.visible })}
              onToggleLocked={() => selectedElementIds.length > 0
                ? updateSelectedElements({
                    locked: !selectedElementIds.every((id) => previewElements[id].locked)
                  })
                : updateElement(selectedElementId, { locked: !selectedElement.locked })}
              onDelete={() => selectedElementIds.length > 0
                ? deleteSelectedElements()
                : deleteElement(selectedElementId)}
              onBeginEdit={beginInspectorEdit}
              onCancelEdit={cancelInspectorEdit}
              onCommitEdit={commitInspectorEdit}
              onClose={clearSelection}
            />
          </FloatingAppearanceEditorContextToolbar>
        ) : null}
        </div>
      </div>
      {typeof document !== 'undefined' && overlapSelection
        ? createPortal(
            <div
              data-order-document-overlap-selection
              data-order-document-selection-chrome
              data-order-document-editor-only
              className={`fixed z-[2147483646] flex w-72 max-w-[calc(100vw-1rem)] gap-1.5 ${
                overlapSelection.placement === 'above'
                  ? 'flex-col-reverse'
                  : 'flex-col'
              }`}
              style={{
                left: overlapSelection.anchorClientX,
                top: overlapSelection.anchorClientY,
                transform: overlapSelection.placement === 'above'
                  ? 'translateY(-100%)'
                  : undefined,
                maxHeight: overlapSelection.placement === 'above'
                  ? Math.max(96, overlapSelection.anchorClientY - 8)
                  : Math.max(96, window.innerHeight - overlapSelection.anchorClientY - 8)
              }}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => event.stopPropagation()}
            >
              <button
                ref={overlapTriggerRef}
                type="button"
                data-order-document-overlap-trigger
                aria-haspopup="menu"
                aria-expanded={overlapSelection.open}
                aria-controls="order-document-overlap-menu"
                className="flex h-8 w-max max-w-full items-center gap-1.5 rounded-full border border-blue-200 bg-white px-3 text-[10px] font-bold text-blue-700 shadow-[0_8px_24px_rgba(15,23,42,0.24)] outline-none transition hover:bg-blue-50 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
                onClick={() => setOverlapSelection((current) =>
                  current ? { ...current, open: !current.open } : null
                )}
              >
                <Layers3 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span className="truncate">
                  Izberi plast ({overlapSelection.candidates.length})
                </span>
              </button>

              {overlapSelection.open ? (
                <div
                  ref={overlapMenuRef}
                  id="order-document-overlap-menu"
                  data-order-document-overlap-menu
                  role="menu"
                  aria-label="Elementi pod kazalcem"
                  className="min-h-0 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-[0_18px_50px_rgba(15,23,42,0.30)]"
                  onKeyDown={handleOverlapMenuKeyDown}
                >
                  <div className="px-2 pb-1.5 pt-1 text-[9px] leading-4 text-slate-500">
                    Izberite element. Alt + klik kroži po plasteh; Shift + Alt v obratni smeri. Ctrl/Cmd + klik doda ali odstrani izbor.
                  </div>
                  {overlapSelection.candidates.map((candidate) => {
                    const selected = selectedCandidateKeys.has(candidate.key);
                    const primary = candidate.key === currentSelectionCandidateKey;
                    return (
                      <button
                        key={candidate.key}
                        type="button"
                        role="menuitemcheckbox"
                        aria-checked={selected}
                        aria-label={`Izberi ${candidate.label} (${candidate.kind === 'child' ? 'pod-element' : 'element'})`}
                        data-order-document-overlap-candidate={candidate.key}
                        data-order-document-overlap-candidate-kind={candidate.kind}
                        data-order-document-overlap-candidate-primary={primary || undefined}
                        className={`flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left outline-none transition focus-visible:ring-2 focus-visible:ring-blue-500 ${
                          selected
                            ? 'bg-blue-50 text-blue-800'
                            : 'text-slate-700 hover:bg-slate-50'
                        }`}
                        onClick={(event) => activateOverlapCandidate(candidate, {
                          focus: true,
                          additive: event.ctrlKey || event.metaKey
                        })}
                      >
                        <span className={`rounded px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide ${
                          candidate.kind === 'child'
                            ? 'bg-violet-100 text-violet-700'
                            : 'bg-slate-100 text-slate-600'
                        }`}>
                          {candidate.kind === 'child' ? 'Pod-element' : 'Element'}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-[10px] font-semibold">
                          {candidate.label}
                        </span>
                        {selected ? (
                          <span className="text-[8px] font-bold uppercase text-blue-600">
                            {primary ? 'Glavni izbor' : 'Izbrano'}
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </div>,
            document.body
          )
        : null}
      <div
        data-order-document-overlap-status
        className="sr-only"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {overlapAnnouncement}
      </div>
    </SiteLogoProvider>
  );
}
