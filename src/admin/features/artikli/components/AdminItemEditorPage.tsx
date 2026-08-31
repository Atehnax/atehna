'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type ClipboardEvent as ReactClipboardEvent, type FocusEvent as ReactFocusEvent, type MouseEvent as ReactMouseEvent, type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Editor, Extension } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import TiptapLink from '@tiptap/extension-link';
import TiptapImage from '@tiptap/extension-image';
import TextAlign from '@tiptap/extension-text-align';
import Placeholder from '@tiptap/extension-placeholder';
import Highlight from '@tiptap/extension-highlight';
import Color from '@tiptap/extension-color';
import FontFamily from '@tiptap/extension-font-family';
import { TextStyle } from '@tiptap/extension-text-style';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
  type KeyboardCoordinateGetter,
  type UniqueIdentifier
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  horizontalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS as DndCss } from '@dnd-kit/utilities';
import { Button } from '@/shared/ui/button';
import { AdminCheckbox } from '@/shared/ui/checkbox';
import EditableChipMenu, { type EditableChipMenuOption } from '@/shared/ui/badge/editable-chip-menu';
import { IconButton } from '@/shared/ui/icon-button';
import { ActionUndoIcon, ApplyToAllIcon, CheckIcon, CloseIcon, CopyIcon, PencilIcon, PlusIcon, SaveIcon, TrashCanIcon } from '@/shared/ui/icons/AdminActionIcons';
import { useToast } from '@/shared/ui/toast';
import { useDropdownDismiss } from '@/shared/ui/dropdown/use-dropdown-dismiss';
import {
  adminStatusInfoPillGroupClassName,
  adminStatusInfoPillVariantTableClassName,
  buttonTokenClasses,
  hoverTokenClasses,
  selectTokenClasses
} from '@/shared/ui/theme/tokens';
import { MenuItem, MenuPanel } from '@/shared/ui/menu';
import EuiTabs from '@/shared/ui/eui-tabs';
import SegmentedControl from '@/shared/ui/segmented/segmented-control';
import {
  adminTableNeutralIconButtonClassName,
  adminTablePrimaryButtonClassName,
  adminTableInlineActionRowClassName,
  adminTableInlineCancelButtonClassName,
  adminTableInlineCancelIconClassName,
  adminTableInlineConfirmButtonClassName,
  adminTableInlineConfirmIconClassName,
  adminTableRowHeightClassName,
  adminTableSelectedDangerIconButtonClassName,
  adminTableSelectedWarningIconButtonClassName,
  adminWindowCardClassName,
  adminWindowCardStyle
} from '@/shared/ui/admin-table';
import { UnsavedChangesDialog } from '@/shared/ui/unsaved-changes-dialog';
import {
  buildPersistedVariantName,
  computeSalePrice,
  createFamily,
  createVariant,
  applyProportionalVariantWeights,
  applyVariantValueToAll,
  duplicateSelectedVariant,
  formatCurrency,
  toSlug,
  type ProductOptionAxisDraft,
  type ProductFamily,
  type Variant,
  type VariantBulkApplyField
} from '@/admin/features/artikli/lib/familyModel';
import { uploadAdminPublicMedia } from '@/shared/client/publicMediaUpload';
import {
  getOrCreateCachedMediaUpload,
  type MediaUploadPromiseCache
} from '@/shared/domain/media/publicMediaUpload';
import { formatEuroAmount } from '@/shared/domain/formatting';
import { formatDecimalForDisplay, formatDecimalForSku, parseDecimalInput, parseDecimalListInput } from '@/admin/features/artikli/lib/decimalFormat';
import AdminCategoryBreadcrumbPicker from '@/admin/components/AdminCategoryBreadcrumbPicker';
import ActiveStateChip from '@/admin/features/artikli/components/ActiveStateChip';
import OpisColorPopover from '@/admin/features/artikli/components/OpisColorPopover';
import UploadedImageCropperModal from '@/admin/features/artikli/components/UploadedImageCropperModal';
import ProductVariantOptionsCard from '@/admin/features/artikli/components/ProductVariantOptionsCard';
import AuditHistoryDrawer from '@/admin/components/AuditHistoryDrawer';
import {
  CommercialToolsPanel,
  ProductTypeSelectorCardRow,
  QuantityDiscountsCard,
  SimpleProductModule,
  UniqueMachineProductModule,
  WeightProductModule,
  buildMachineCatalogVariants,
  buildSimpleCatalogVariants,
  buildWeightCatalogVariants,
  cloneQuantityDiscountDraft,
  cloneTypeSpecificData,
  createInitialTypeSpecificData,
  createInitialQuantityDiscountDrafts,
  createQuantityDiscountDraft,
  getDimensionSimulatorOptions,
  getMachineSimulatorOptions,
  getSimpleSimulatorOptions,
  getWeightSimulatorOptions,
  normalizeSimpleProductData,
  normalizeUniqueMachineProductData,
  normalizeWeightProductData,
  serializeQuantityDiscountTargets,
  adminProductInputChipClassName
} from '@/admin/features/artikli/components/DimensionProductPricingSections';
import type {
  ProductEditorType,
  CatalogItemAppearanceOverride,
  CatalogItemQuickSaveResponse,
  QuantityDiscountDraft,
  SimulatorOption,
  CatalogMediaImportKind,
  UploadedCatalogMediaFile,
  UniversalProductSpecificData
} from '@/shared/domain/catalog/catalogAdminTypes';
import AdminFieldSuggestionMenu from '@/admin/components/AdminFieldSuggestionMenu';
import {
  getCatalogItemIdentityMessage,
  useCatalogItemIdentityAvailability
} from '@/admin/features/artikli/components/useCatalogItemIdentityAvailability';
import {
  NOTE_TAG_OPTIONS,
  NoteTagChip,
  getNoteTagLabel,
  getNoteTagMenuItemClassName,
  normalizeNoteTagValue,
  type NoteTag
} from '@/admin/features/artikli/components/NoteTagChip';
import {
  articleNameInputClassName,
  compactSideInputClassName,
  compactSideInputWrapClassName,
  numberInputClass,
  topBarArticleNameInputClassName
} from '@/admin/features/artikli/components/artikliFieldStyles';
import { saveCatalogItemPayload } from '@/admin/lib/catalogItemClient';
import { Dialog, dialogActionButtonClassName, dialogFooterClassName } from '@/shared/ui/dialog';
import { THead, TH } from '@/shared/ui/table';
import type { AdminCatalogListItem, CatalogItemEditorHydration, CatalogItemEditorPayload } from '@/shared/domain/catalog/catalogAdminTypes';
import { readCatalogSpecificationLabels } from '@/shared/domain/catalog/catalogSpecification';
import {
  classNames,
  CompactSegmentedField,
  fieldUnitAdornmentClassName
} from '@/admin/features/artikli/components/pricing/PricingFieldControls';
import {
  formatImagePixelDimensions,
  formatImageVariantAssignmentLabel,
  inferImageFormatLabel,
  normalizeImagePixelDimensions,
  remapImageSlotAssignmentsAfterMove,
  type ImagePixelMetadata
} from '@/admin/features/artikli/lib/imageMediaMetadata';
import {
  catalogWeightDisplayGramsToKilograms,
  catalogWeightKilogramsToDisplayGrams
} from '@/admin/features/artikli/lib/catalogMeasurementUnits';
import {
  CATALOG_SHIPPING_FIELD_LABELS,
  deriveCatalogVariantShippingMeasurements,
  getCatalogShippingReadiness,
} from '@/shared/domain/catalog/catalogShipping';

const inputClass = 'h-10 w-full rounded-md border border-slate-300 bg-white px-2.5 text-sm text-slate-900 outline-none transition-[border-color,box-shadow,color] focus:border-[#3e67d6] focus:ring-0';
const dimensionEditorInputHeightClassName =
  '[&_input:not([type=checkbox]):not(.admin-discount-target-input)]:!h-[30px] [&_input:not([type=checkbox]):not(.admin-discount-target-input)]:!min-h-[30px] [&_input:not([type=checkbox]):not(.admin-discount-target-input)]:!leading-[30px] [&_.h-6]:!h-[30px] [&_.min-h-6]:!min-h-[30px]';
const topActionSaveButtonClassName = `gap-2 ${adminTablePrimaryButtonClassName} !h-8 !leading-none !tracking-[0] disabled:!border-transparent disabled:!bg-[color:var(--blue-500)] disabled:!text-white disabled:!opacity-50`;
const topSaveActionButtonIconClassName = 'h-[15.3px] w-[15.3px]';
const editorSectionTitleClassName = 'text-[20px] font-semibold tracking-tight text-slate-900';
const dimensionVariantRowActionButtonClassName =
  'inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-transparent text-slate-400 transition hover:border-sky-200 hover:bg-sky-50 hover:text-[color:var(--blue-700)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--blue-500)] focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:border-transparent disabled:hover:bg-transparent disabled:hover:text-slate-400';
type EditorMode = 'create' | 'edit';
type CreateType = ProductEditorType | 'variants';
type ProductEditorMainTab = 'basic' | 'sales' | 'simulator';
type MediaTab = 'slike' | 'video' | 'tehnicni';
type VariantTag = NoteTag;
type GeneratorDimension = 'length' | 'width' | 'thickness';
type GeneratorChip = { dimension: GeneratorDimension; values: number[] };
type DimensionVariantViewMode = 'columns' | 'rows';
type DimensionVariantMatrixRowKey =
  | 'default'
  | 'dimensions'
  | 'weight'
  | 'tolerance'
  | 'cost'
  | 'price'
  | 'priceGross'
  | 'discount'
  | 'salePrice'
  | 'salePriceGross'
  | 'stock'
  | 'minOrder'
  | 'delivery'
  | 'sku'
  | 'status'
  | 'note';

const DIMENSION_VARIANT_MATRIX_ROWS: ReadonlyArray<{
  key: DimensionVariantMatrixRowKey;
  label: string;
  help: string;
}> = [
  { key: 'default', label: 'Privzeta različica', help: 'Različica, ki je izbrana ob odprtju izdelka.' },
  { key: 'dimensions', label: 'Dimenzije', help: 'Dolžina, širina in višina oziroma debelina različice v milimetrih.' },
  { key: 'weight', label: 'Masa', help: 'Masa ene prodajne enote v gramih.' },
  { key: 'tolerance', label: 'Toleranca', help: 'Dovoljeno odstopanje mere v milimetrih.' },
  { key: 'cost', label: 'Nabavna cena brez DDV', help: 'Interna nabavna cena različice brez DDV.' },
  { key: 'price', label: 'Prodajna cena brez DDV', help: 'Prodajna cena različice brez DDV.' },
  { key: 'priceGross', label: 'Prodajna cena z DDV', help: 'Prodajna cena z vključeno nastavljeno stopnjo DDV.' },
  { key: 'discount', label: 'Popust', help: 'Odstotek popusta za različico.' },
  { key: 'salePrice', label: 'Akcijska cena brez DDV', help: 'Izračunana cena po popustu.' },
  { key: 'salePriceGross', label: 'Akcijska cena z DDV', help: 'Izračunana akcijska cena z vključeno nastavljeno stopnjo DDV.' },
  { key: 'stock', label: 'Zaloga', help: 'Trenutna razpoložljiva količina.' },
  { key: 'minOrder', label: 'Minimalno naročilo', help: 'Najmanjša dovoljena količina naročila.' },
  { key: 'delivery', label: 'Dobavni rok', help: 'Predvideni dobavni rok v delovnih dneh.' },
  { key: 'sku', label: 'SKU', help: 'Enolična oznaka različice.' },
  { key: 'status', label: 'Status', help: 'Samo aktivne različice so na voljo kupcem.' },
  { key: 'note', label: 'Opomba', help: 'Prodajna oznaka oziroma stanje različice.' }
];

type DimensionVariantBulkApplyRowKey =
  | 'weight'
  | 'tolerance'
  | 'cost'
  | 'price'
  | 'discount'
  | 'stock'
  | 'minOrder'
  | 'delivery'
  | 'status'
  | 'note';

const DIMENSION_VARIANT_BULK_APPLY_FIELDS: Readonly<
  Partial<Record<DimensionVariantBulkApplyRowKey, VariantBulkApplyField>>
> = {
  weight: 'weight',
  tolerance: 'errorTolerance',
  cost: 'costNet',
  price: 'price',
  discount: 'discountPct',
  stock: 'stock',
  minOrder: 'minOrder',
  delivery: 'deliveryEstimate',
  status: 'active'
};

const DIMENSION_VARIANT_BULK_DRAFT_FIELDS: Readonly<
  Partial<Record<DimensionVariantBulkApplyRowKey, string>>
> = {
  weight: 'weight',
  tolerance: 'errorTolerance',
  cost: 'costNet',
  price: 'price',
  discount: 'discountPct',
  delivery: 'deliveryTime'
};

const DIMENSION_VARIANT_BULK_APPLY_ROW_KEYS = new Set<DimensionVariantMatrixRowKey>([
  'weight',
  'tolerance',
  'cost',
  'price',
  'discount',
  'stock',
  'minOrder',
  'delivery',
  'status',
  'note'
]);

const isDimensionVariantBulkApplyRow = (
  rowKey: DimensionVariantMatrixRowKey
): rowKey is DimensionVariantBulkApplyRowKey =>
  DIMENSION_VARIANT_BULK_APPLY_ROW_KEYS.has(rowKey);

type DimensionInventoryEntry = {
  id: string;
  thickness: number | null;
  length: number | null;
  width: number | null;
  stock: number;
  deliveryTime: string;
};
type DimensionInventoryOption = Pick<DimensionInventoryEntry, 'thickness' | 'length' | 'width'>;
type SideFieldIcon = 'name' | 'brand' | 'material' | 'shape' | 'color' | 'link' | 'document' | 'dimension' | 'sku' | 'percent' | 'unit';
type IdentitySuggestionField = 'name' | 'sku' | 'slug';
type SideSettingsState = {
  sku: string;
  brand: string;
  material: string;
  surface: string;
  color: string;
  taxRatePercent: string;
  thicknessTolerance: string;
  moq: number;
  palletCount: string;
  dimensions: { width: string; depth: string; height: string };
  trackInventory: boolean;
  currentStock: number;
  minStock: number;
  warehouseLocation: string;
  basePriceNoVat: string;
  priceRounding: string;
  showOldPrice: boolean;
  showGallery: boolean;
  imageFocus: string;
  galleryMode: 'grid' | 'slider' | 'list';
  imageAltText: string;
  videoUrl: string;
};

function normalizeCreateType(createType: CreateType): ProductEditorType {
  return createType === 'variants' ? 'dimensions' : createType;
}

function mapProductTypeToCatalogItemType(productType: ProductEditorType): CatalogItemEditorPayload['itemType'] {
  if (productType === 'dimensions') return 'sheet';
  if (productType === 'weight') return 'bulk';
  return 'unit';
}

type StagedImageSlot = {
  persistedId?: number | null;
  previewUrl: string;
  uploadedUrl: string | null;
  blobPathname: string | null;
  file: File | null;
  filename: string | null;
  mimeType: string | null;
  imageDimensions: ImagePixelMetadata | null;
  altText: string;
  localId: string | null;
};
type StagedVideoState = {
  persistedId?: number | null;
  source: 'upload' | 'youtube';
  label: string;
  previewUrl: string;
  uploadedUrl: string | null;
  blobPathname: string | null;
  file: File | null;
  mimeType: string | null;
  localId: string | null;
};
type StagedTechnicalDocument = {
  id: string;
  name: string;
  size: string;
  blobUrl: string | null;
  blobPathname: string | null;
  file: File | null;
  mimeType: string | null;
  localId: string | null;
};
type EditorPersistedState = {
  draft: ProductFamily;
  productType: ProductEditorType;
  typeSpecificData: UniversalProductSpecificData;
  appearanceOverride: CatalogItemAppearanceOverride | null;
  sideSettings: SideSettingsState;
  documents: StagedTechnicalDocument[];
  quantityDiscounts: QuantityDiscountDraft[];
  itemLevelNote: VariantTag | '';
  mediaImages: StagedImageSlot[];
  video: StagedVideoState | null;
  variantTags: Record<string, VariantTag>;
  selectedCategoryPath: string[];
  videoAssignedVariantId: string | null;
};

function validateEditorPhysicalMeasurements(state: EditorPersistedState):
  | { ok: true }
  | { ok: false; message: string } {
  if (!state.draft.active) return { ok: true };

  for (const variant of state.draft.variants.filter((entry) => entry.active)) {
    const readiness = getCatalogShippingReadiness(
      {},
      deriveCatalogVariantShippingMeasurements(variant)
    );
    if (readiness.isReady) continue;

    const issueFields = Array.from(new Set([
      ...readiness.missingFields,
      ...readiness.invalidFields
    ]));
    const variantLabel = variant.sku || variant.label || 'brez naziva';
    return {
      ok: false,
      message: `Aktivna različica »${variantLabel}« potrebuje popolne pozitivne mere v zavihku Prodaja: ${issueFields.map((field) => CATALOG_SHIPPING_FIELD_LABELS[field]).join(', ')}.`
    };
  }

  return { ok: true };
}
type SaveChangeGroup = {
  title: string;
  items: string[];
};
type PendingSaveConfirmation = {
  nextPersistedState: EditorPersistedState;
  changeGroups: SaveChangeGroup[];
  changeCount: number;
};
type EditorUndoSnapshot = {
  persistedState: EditorPersistedState;
  decimalDrafts: Record<string, string>;
};
type TextUndoSession = {
  element: HTMLElement;
  snapshot: EditorUndoSnapshot;
  snapshotKey: string;
};

const allQuantityDiscountTargetsJson = '{"variants":["Vse"],"customers":["Vse"]}';

const defaultQuantityDiscountAuditPlaceholders = [
  { minQuantity: 1, discountPercent: 0, appliesTo: allQuantityDiscountTargetsJson, note: '', position: 0 },
  { minQuantity: 10, discountPercent: 3, appliesTo: allQuantityDiscountTargetsJson, note: '', position: 1 },
  { minQuantity: 25, discountPercent: 5, appliesTo: allQuantityDiscountTargetsJson, note: '', position: 2 },
  { minQuantity: 50, discountPercent: 8, appliesTo: allQuantityDiscountTargetsJson, note: '', position: 3 }
] as const;

function normalizeQuantityDiscountAuditTarget(rule: QuantityDiscountDraft) {
  return serializeQuantityDiscountTargets(rule);
}

function isUntouchedDefaultQuantityDiscountSet(rules: QuantityDiscountDraft[]) {
  if (rules.length !== defaultQuantityDiscountAuditPlaceholders.length) return false;
  return rules.every((rule, index) => {
    const expected = defaultQuantityDiscountAuditPlaceholders[index];
    if (!expected) return false;
    return !rule.persistedId
      && Number(rule.minQuantity) === expected.minQuantity
      && Number(rule.discountPercent) === expected.discountPercent
      && normalizeQuantityDiscountAuditTarget(rule) === expected.appliesTo
      && String(rule.note ?? '').trim() === expected.note
      && Number(rule.position ?? index) === expected.position;
  });
}

function getPersistableQuantityDiscounts(rules: QuantityDiscountDraft[], hadPersistedQuantityDiscounts: boolean) {
  return !hadPersistedQuantityDiscounts && isUntouchedDefaultQuantityDiscountSet(rules) ? [] : rules;
}
const MEDIA_SLOT_COUNT = 7;
const GALLERY_SMALL_SLOT_COUNT = 6;
const UNDO_HISTORY_LIMIT = 10;
const IMAGE_MAX_UPLOAD_BYTES = 4 * 1024 * 1024;
const VIDEO_MAX_UPLOAD_BYTES = 100 * 1024 * 1024;
const TECHNICAL_DOCUMENT_MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const ITEM_NOTE_OPTIONS = NOTE_TAG_OPTIONS;

const normalizeVariantTag = normalizeNoteTagValue;

const createLocalStageId = () => `local-${Math.random().toString(36).slice(2, 10)}`;

function formatFileSize(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '—';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const pastedUrlPattern = /https?:\/\/[^\s<>"']+/giu;
const technicalDocumentExtensions = new Set(['pdf', 'doc', 'docx', 'xls', 'xlsx', 'txt', 'csv', 'dwg']);

function getPastedUrls(value: string) {
  return Array.from(new Set((value.match(pastedUrlPattern) ?? []).map((url) => url.trim().replace(/[),.;]+$/u, ''))));
}

function getFileExtension(fileName: string) {
  return fileName.split('.').pop()?.toLowerCase() ?? '';
}

function isTechnicalDocumentFile(file: File) {
  if (file.type && !file.type.startsWith('image/') && !file.type.startsWith('video/')) return true;
  return technicalDocumentExtensions.has(getFileExtension(file.name));
}

function isEditablePasteTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  return Boolean(target.closest('input, textarea, select, [contenteditable="true"]'));
}

function cloneVariant(variant: Variant): Variant {
  return {
    ...variant,
    contentOverride: variant.contentOverride
      ? {
          ...variant.contentOverride,
          specifications: variant.contentOverride.specifications ? { ...variant.contentOverride.specifications } : undefined,
          attributes: variant.contentOverride.attributes ? { ...variant.contentOverride.attributes } : undefined,
          includedItems: variant.contentOverride.includedItems ? [...variant.contentOverride.includedItems] : undefined,
          documentIds: variant.contentOverride.documentIds ? [...variant.contentOverride.documentIds] : undefined
        }
      : null,
    imageAssignments: [...(variant.imageAssignments ?? [])],
    optionValueIds: [...(variant.optionValueIds ?? [])],
    optionSelections: { ...(variant.optionSelections ?? {}) }
  };
}

function findFirstActiveVariant(variants: readonly Variant[]): Variant | undefined {
  return variants
    .filter((variant) => variant.active)
    .sort((left, right) => (left.sort ?? 0) - (right.sort ?? 0))[0];
}

function cloneOptionAxes(optionAxes: readonly ProductOptionAxisDraft[]): ProductOptionAxisDraft[] {
  return optionAxes.map((axis) => ({
    ...axis,
    values: axis.values.map((value) => ({ ...value }))
  }));
}

function cloneSideSettings(settings: SideSettingsState): SideSettingsState {
  return {
    ...settings,
    dimensions: { ...settings.dimensions }
  };
}

function cloneMediaImage(slot: StagedImageSlot): StagedImageSlot {
  return {
    ...slot,
    imageDimensions: slot.imageDimensions ? { ...slot.imageDimensions } : null
  };
}

function cloneVideo(video: StagedVideoState | null): StagedVideoState | null {
  return video ? { ...video } : null;
}

function cloneDocument(documentEntry: StagedTechnicalDocument): StagedTechnicalDocument {
  return { ...documentEntry };
}

function cloneEditorPersistedState(state: EditorPersistedState): EditorPersistedState {
  return {
    draft: {
      ...state.draft,
      optionAxes: cloneOptionAxes(state.draft.optionAxes),
      variants: state.draft.variants.map(cloneVariant)
    },
    productType: state.productType,
    typeSpecificData: cloneTypeSpecificData(state.typeSpecificData),
    appearanceOverride: state.appearanceOverride
      ? JSON.parse(JSON.stringify(state.appearanceOverride)) as CatalogItemAppearanceOverride
      : null,
    sideSettings: cloneSideSettings(state.sideSettings),
    documents: state.documents.map(cloneDocument),
    quantityDiscounts: state.quantityDiscounts.map(cloneQuantityDiscountDraft),
    itemLevelNote: state.itemLevelNote,
    mediaImages: state.mediaImages.map(cloneMediaImage),
    video: cloneVideo(state.video),
    variantTags: { ...state.variantTags },
    selectedCategoryPath: [...state.selectedCategoryPath],
    videoAssignedVariantId: state.videoAssignedVariantId
  };
}

function cloneEditorUndoSnapshot(snapshot: EditorUndoSnapshot): EditorUndoSnapshot {
  return {
    persistedState: cloneEditorPersistedState(snapshot.persistedState),
    decimalDrafts: { ...snapshot.decimalDrafts }
  };
}

function isUndoTrackedTextField(target: EventTarget | null): target is HTMLElement {
  if (!(target instanceof HTMLElement)) return false;
  if (target instanceof HTMLTextAreaElement) return true;
  if (target instanceof HTMLInputElement) {
    const inputType = (target.type || 'text').toLowerCase();
    return inputType !== 'checkbox'
      && inputType !== 'radio'
      && inputType !== 'range'
      && inputType !== 'file'
      && inputType !== 'button'
      && inputType !== 'submit'
      && inputType !== 'reset';
  }
  return target.isContentEditable;
}

function serializeEditorPersistedState(state: EditorPersistedState, decimalDrafts: Record<string, string>) {
  return JSON.stringify({
    draft: {
      ...state.draft,
      optionAxes: cloneOptionAxes(state.draft.optionAxes),
      variants: state.draft.variants.map((variant) => ({
        ...variant,
        imageAssignments: [...(variant.imageAssignments ?? [])],
        optionValueIds: [...(variant.optionValueIds ?? [])],
        optionSelections: { ...(variant.optionSelections ?? {}) }
      }))
    },
    productType: state.productType,
    typeSpecificData: state.typeSpecificData,
    appearanceOverride: state.appearanceOverride,
    sideSettings: state.sideSettings,
    documents: state.documents.map((documentEntry) => ({
      id: documentEntry.id,
      name: documentEntry.name,
      size: documentEntry.size,
      blobUrl: documentEntry.blobUrl,
      blobPathname: documentEntry.blobPathname,
      mimeType: documentEntry.mimeType,
      localId: documentEntry.localId,
      file: documentEntry.file
        ? {
            name: documentEntry.file.name,
            size: documentEntry.file.size,
            type: documentEntry.file.type,
            lastModified: documentEntry.file.lastModified
          }
        : null
    })),
    quantityDiscounts: state.quantityDiscounts
      .map((rule) => ({
        id: rule.id,
        persistedId: rule.persistedId ?? null,
        minQuantity: rule.minQuantity,
        discountPercent: rule.discountPercent,
        appliesTo: serializeQuantityDiscountTargets(rule),
        variantTargets: [...rule.variantTargets],
        customerTargets: [...rule.customerTargets],
        note: rule.note,
        position: rule.position
      }))
      .sort((left, right) => left.position - right.position || left.minQuantity - right.minQuantity),
    itemLevelNote: state.itemLevelNote,
    mediaImages: state.mediaImages.map((slot) => ({
      uploadedUrl: slot.uploadedUrl,
      blobPathname: slot.blobPathname,
      altText: slot.altText,
      filename: slot.filename,
      mimeType: slot.mimeType,
      imageDimensions: slot.imageDimensions,
      localId: slot.localId,
      file: slot.file
        ? {
            name: slot.file.name,
            size: slot.file.size,
            type: slot.file.type,
            lastModified: slot.file.lastModified
          }
        : null
    })),
    video: state.video
      ? {
          source: state.video.source,
          label: state.video.label,
          uploadedUrl: state.video.uploadedUrl,
          blobPathname: state.video.blobPathname,
          mimeType: state.video.mimeType,
          localId: state.video.localId,
          file: state.video.file
            ? {
                name: state.video.file.name,
                size: state.video.file.size,
                type: state.video.file.type,
                lastModified: state.video.file.lastModified
              }
            : null
        }
      : null,
    variantTags: Object.fromEntries(Object.entries(state.variantTags).sort(([left], [right]) => left.localeCompare(right))),
    selectedCategoryPath: [...state.selectedCategoryPath],
    videoAssignedVariantId: state.videoAssignedVariantId,
    decimalDrafts: Object.fromEntries(Object.entries(decimalDrafts).sort(([left], [right]) => left.localeCompare(right)))
  });
}

function truncateSaveDiffText(value: string, maxLength = 120) {
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (!normalized) return 'prazno';
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, Math.max(0, maxLength - 3)).trimEnd()}...`;
}

function formatSaveDiffText(value: string | null | undefined, maxLength = 120) {
  const normalized = (value ?? '').trim();
  return normalized ? truncateSaveDiffText(normalized, maxLength) : 'prazno';
}

function formatSaveDiffPath(path: string[]) {
  return path.length > 0 ? path.join(' / ') : 'prazno';
}

function formatSaveDiffNumber(value: number | null | undefined, suffix = '') {
  if (value === null || value === undefined || !Number.isFinite(value)) return 'prazno';
  const display = formatDecimalForDisplay(value);
  return suffix ? `${display} ${suffix}` : display;
}

function formatSaveDiffInteger(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return 'prazno';
  return `${Math.round(value)}`;
}

function formatSaveDiffCurrency(value: number) {
  return formatCurrency(Number.isFinite(value) ? value : 0);
}

function formatSaveDiffStatus(active: boolean) {
  return active ? 'Aktiven' : 'Skrit';
}

function formatSaveDiffNoteTag(value: VariantTag | '') {
  return getNoteTagLabel(value);
}

function formatSaveDiffAssignments(assignments: number[] | undefined) {
  const normalized = (assignments ?? [])
    .filter((value) => Number.isFinite(value))
    .slice()
    .sort((left, right) => left - right);
  return normalized.length > 0 ? normalized.map((value) => `#${value + 1}`).join(', ') : 'brez dodeljenih slik';
}

function formatQuantityDiscountForSaveDiff(rule: QuantityDiscountDraft) {
  const note = rule.note.trim() ? `, opomba ${rule.note.trim()}` : '';
  const variants = rule.variantTargets.join(', ') || 'Vse';
  const customers = rule.customerTargets.join(', ') || 'Vse';
  return `${rule.minQuantity} kos -> ${formatDecimalForDisplay(rule.discountPercent)} %; različice: ${variants}; kupci: ${customers}${note}`;
}

function serializeQuantityDiscountForSaveDiff(rule: QuantityDiscountDraft) {
  return JSON.stringify({
    minQuantity: rule.minQuantity,
    discountPercent: rule.discountPercent,
    appliesTo: serializeQuantityDiscountTargets(rule),
    variantTargets: rule.variantTargets,
    customerTargets: rule.customerTargets,
    note: rule.note.trim(),
    position: rule.position
  });
}

function buildVariantSaveDiffLabel(variant: Variant, index: number) {
  const label = variant.label.trim();
  return label || `Različica ${index + 1}`;
}

function buildDimensionVariantHeaderLabel(variant: Variant, index: number, includeUnits = false) {
  const dimensions = [variant.thickness, variant.length, variant.width]
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value))
    .map(formatDecimalForDisplay);
  if (dimensions.length > 0) {
    return includeUnits
      ? dimensions.map((dimension) => `${dimension} mm`).join(' × ')
      : dimensions.join(' × ');
  }
  return variant.label.trim() || variant.sku.trim() || `Različica ${index + 1}`;
}

function computeGrossPrice(netPrice: number, taxRate: number) {
  const netCents = Math.round(netPrice * 100);
  const taxCents = Math.round(netCents * Math.min(1, Math.max(0, taxRate)));
  return (netCents + taxCents) / 100;
}

function getVariantTagSummaryDotClassName(tag: VariantTag) {
  if (tag === 'akcija') return 'bg-rose-500';
  if (tag === 'novo') return 'bg-sky-500';
  if (tag === 'zadnji-kosi') return 'bg-violet-500';
  if (tag === 'ni-na-zalogi') return 'bg-slate-400';
  return 'bg-emerald-500';
}

type SortableKeyboardMetadata = {
  sortable?: {
    items?: UniqueIdentifier[];
  };
};

const adjacentDimensionVariantKeyboardCoordinates: KeyboardCoordinateGetter = (
  event,
  { active, context }
) => {
  if (event.code !== 'ArrowLeft' && event.code !== 'ArrowRight') return undefined;
  event.preventDefault();

  const activeContainer = context.droppableContainers.get(active);
  const sortable = (activeContainer?.data.current ?? {}) as SortableKeyboardMetadata;
  const items = sortable.sortable?.items;
  if (!items?.length || !context.collisionRect) return undefined;

  const activeIndex = items.indexOf(active);
  const overIndex = context.over ? items.indexOf(context.over.id) : -1;
  const currentIndex = overIndex >= 0 ? overIndex : activeIndex;
  const targetIndex = currentIndex + (event.code === 'ArrowRight' ? 1 : -1);
  const targetId = items[targetIndex];
  const targetRect = targetId === undefined ? null : context.droppableRects.get(targetId);
  if (!targetRect) return undefined;

  return {
    x: targetRect.left + (targetRect.width - context.collisionRect.width) / 2,
    y: targetRect.top + (targetRect.height - context.collisionRect.height) / 2
  };
};

function DimensionVariantSortableHeader({
  id,
  label,
  disabled,
  className,
  onMouseEnter,
  onMouseLeave,
  children
}: {
  id: string;
  label: string;
  disabled: boolean;
  className: string;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  children: (dragHandle: ReactNode, state: { isDragging: boolean; isOver: boolean }) => ReactNode;
}) {
  const {
    attributes,
    listeners,
    setActivatorNodeRef,
    setNodeRef,
    transform,
    transition,
    isDragging,
    isOver
  } = useSortable({ id, disabled });
  const dragHandle = disabled ? null : (
    <button
      ref={setActivatorNodeRef}
      type="button"
      {...attributes}
      {...listeners}
      className="relative z-30 inline-flex h-4 w-4 shrink-0 cursor-grab items-center justify-center rounded text-slate-400 transition hover:bg-white hover:text-[color:var(--blue-700)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--blue-500)] active:cursor-grabbing"
      aria-label={`Premakni različico ${label}`}
      title="Povleci za spremembo vrstnega reda. S tipkovnico: presledek, puščici levo/desno, presledek."
      onClick={(event) => event.stopPropagation()}
    >
      <svg viewBox="0 0 12 16" className="h-3 w-2.5" fill="currentColor" aria-hidden="true">
        <circle cx="3" cy="3" r="1" />
        <circle cx="9" cy="3" r="1" />
        <circle cx="3" cy="8" r="1" />
        <circle cx="9" cy="8" r="1" />
        <circle cx="3" cy="13" r="1" />
        <circle cx="9" cy="13" r="1" />
      </svg>
    </button>
  );

  return (
    <div
      ref={setNodeRef}
      role="columnheader"
      className={`${className} ${isDragging ? 'z-40 opacity-45' : ''} ${
        isOver && !isDragging ? 'z-30 ring-2 ring-inset ring-[color:var(--blue-500)]' : ''
      }`}
      style={{
        transform: DndCss.Transform.toString(transform),
        transition
      }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {children(dragHandle, { isDragging, isOver })}
    </div>
  );
}

function describeStagedImageSlot(slot: StagedImageSlot) {
  return formatSaveDiffText(slot.file?.name ?? slot.filename ?? slot.uploadedUrl ?? slot.previewUrl ?? 'slika', 80);
}

function describeStagedDocument(documentEntry: StagedTechnicalDocument) {
  return formatSaveDiffText(documentEntry.file?.name ?? documentEntry.name ?? documentEntry.blobUrl ?? 'tehnični list', 80);
}

function describeStagedVideo(video: StagedVideoState) {
  const sourceLabel = video.source === 'youtube' ? 'YouTube' : 'Upload';
  const label = video.file?.name ?? video.label ?? video.uploadedUrl ?? video.previewUrl ?? 'video';
  return `${sourceLabel}: ${formatSaveDiffText(label, 80)}`;
}

function formatProductTypeLabel(type: ProductEditorType) {
  if (type === 'dimensions') return 'Po dimenzijah';
  if (type === 'weight') return 'Po masi';
  if (type === 'unique_machine') return 'Stroj / unikaten';
  return 'Enostavni';
}

function formatProductSalesSectionLabel(type: ProductEditorType) {
  if (type === 'weight') return 'Prodaja po masi';
  if (type === 'unique_machine') return 'Stroj / unikaten artikel';
  return 'Prodajne informacije';
}

function resolveVideoVariantTargetLabel(state: EditorPersistedState, variantId: string | null) {
  if (!variantId) return 'brez dodelitve';
  const index = state.draft.variants.findIndex((variant) => variant.id === variantId);
  if (index === -1) return 'brez dodelitve';
  return buildVariantSaveDiffLabel(state.draft.variants[index], index);
}

function pushSaveDiff(items: string[], label: string, previousValue: string, nextValue: string) {
  if (previousValue === nextValue) return;
  items.push(`${label}: ${previousValue} -> ${nextValue}`);
}

function sameNumberArray(left: number[] | undefined, right: number[] | undefined) {
  const normalizedLeft = (left ?? []).slice().sort((a, b) => a - b);
  const normalizedRight = (right ?? []).slice().sort((a, b) => a - b);
  if (normalizedLeft.length !== normalizedRight.length) return false;
  return normalizedLeft.every((value, index) => value === normalizedRight[index]);
}

function buildProposedSaveChanges(saved: EditorPersistedState, next: EditorPersistedState): SaveChangeGroup[] {
  const groups: SaveChangeGroup[] = [];

  const basicItems: string[] = [];
  pushSaveDiff(basicItems, 'Naziv', formatSaveDiffText(saved.draft.name), formatSaveDiffText(next.draft.name));
  pushSaveDiff(basicItems, 'URL', formatSaveDiffText(saved.draft.slug), formatSaveDiffText(next.draft.slug));
  pushSaveDiff(basicItems, 'Status', formatSaveDiffStatus(saved.draft.active), formatSaveDiffStatus(next.draft.active));
  pushSaveDiff(basicItems, 'Kategorija', formatSaveDiffPath(saved.selectedCategoryPath), formatSaveDiffPath(next.selectedCategoryPath));
  pushSaveDiff(basicItems, 'Tip artikla', formatProductTypeLabel(saved.productType), formatProductTypeLabel(next.productType));
  pushSaveDiff(basicItems, 'Opis', formatSaveDiffText(saved.draft.description, 180), formatSaveDiffText(next.draft.description, 180));
  pushSaveDiff(basicItems, 'Opomba artikla', formatSaveDiffNoteTag(saved.itemLevelNote), formatSaveDiffNoteTag(next.itemLevelNote));
  if (basicItems.length > 0) groups.push({ title: 'Osnovne informacije', items: basicItems });

  const detailItems: string[] = [];
  pushSaveDiff(detailItems, 'Osnovni SKU', formatSaveDiffText(saved.sideSettings.sku), formatSaveDiffText(next.sideSettings.sku));
  pushSaveDiff(detailItems, 'Blagovna znamka', formatSaveDiffText(saved.sideSettings.brand), formatSaveDiffText(next.sideSettings.brand));
  pushSaveDiff(detailItems, 'Material', formatSaveDiffText(saved.sideSettings.material), formatSaveDiffText(next.sideSettings.material));
  pushSaveDiff(detailItems, 'Barva', formatSaveDiffText(saved.sideSettings.color), formatSaveDiffText(next.sideSettings.color));
  pushSaveDiff(detailItems, 'Oblika', formatSaveDiffText(saved.sideSettings.surface), formatSaveDiffText(next.sideSettings.surface));
  pushSaveDiff(detailItems, 'Toleranca', formatSaveDiffText(saved.sideSettings.thicknessTolerance), formatSaveDiffText(next.sideSettings.thicknessTolerance));
  pushSaveDiff(detailItems, 'Min. naročilo', formatSaveDiffInteger(saved.sideSettings.moq), formatSaveDiffInteger(next.sideSettings.moq));
  const savedSpecificationLabels = readCatalogSpecificationLabels(saved.appearanceOverride);
  const nextSpecificationLabels = readCatalogSpecificationLabels(next.appearanceOverride);
  if (JSON.stringify(savedSpecificationLabels) !== JSON.stringify(nextSpecificationLabels)) {
    const renamedLabels = Object.entries(nextSpecificationLabels)
      .map(([key, label]) => `${key}: ${label}`)
      .join(', ');
    detailItems.push(
      `Prikazni nazivi specifikacij: ${renamedLabels || 'ponastavljeni na privzete nazive'}.`
    );
  }
  if (detailItems.length > 0) groups.push({ title: 'Dodatni podatki', items: detailItems });

  if (JSON.stringify(saved.typeSpecificData) !== JSON.stringify(next.typeSpecificData)) {
    groups.push({
      title: formatProductSalesSectionLabel(next.productType),
      items: [`Posodobljeni so prodajni podatki za tip "${formatProductTypeLabel(next.productType)}".`]
    });
  }

  const variantItems: string[] = [];
  const savedVariantsById = new Map(saved.draft.variants.map((variant, index) => [variant.id, { variant, index }]));
  const nextVariantsById = new Map(next.draft.variants.map((variant, index) => [variant.id, { variant, index }]));

  saved.draft.variants.forEach((variant, index) => {
    if (nextVariantsById.has(variant.id)) return;
    variantItems.push(`Odstranjena različica "${buildVariantSaveDiffLabel(variant, index)}".`);
  });

  next.draft.variants.forEach((variant, index) => {
    const savedVariantInfo = savedVariantsById.get(variant.id);
    const variantLabel = buildVariantSaveDiffLabel(variant, index);
    const prefix = `Različica "${variantLabel}"`;

    if (!savedVariantInfo) {
      const summary: string[] = [];
      if (variant.sku.trim()) summary.push(`SKU ${variant.sku.trim()}`);
      if (variant.length !== null || variant.width !== null || variant.thickness !== null) {
        summary.push(
          `dimenzije ${[
            formatSaveDiffNumber(variant.thickness, 'mm'),
            formatSaveDiffNumber(variant.length, 'mm'),
            formatSaveDiffNumber(variant.width, 'mm')
          ].join(' / ')}`
        );
      }
      summary.push(`cena ${formatSaveDiffCurrency(variant.price)}`);
      variantItems.push(`Dodana različica "${variantLabel}"${summary.length > 0 ? ` (${summary.join(', ')})` : ''}.`);
      return;
    }

    const savedVariant = savedVariantInfo.variant;
    pushSaveDiff(variantItems, `${prefix} - naziv`, formatSaveDiffText(savedVariant.label), formatSaveDiffText(variant.label));
    pushSaveDiff(variantItems, `${prefix} - debelina/fi`, formatSaveDiffNumber(savedVariant.thickness, 'mm'), formatSaveDiffNumber(variant.thickness, 'mm'));
    pushSaveDiff(variantItems, `${prefix} - dolžina`, formatSaveDiffNumber(savedVariant.length, 'mm'), formatSaveDiffNumber(variant.length, 'mm'));
    pushSaveDiff(variantItems, `${prefix} - širina`, formatSaveDiffNumber(savedVariant.width, 'mm'), formatSaveDiffNumber(variant.width, 'mm'));
    const savedDisplayWeight = next.productType === 'dimensions'
      ? catalogWeightKilogramsToDisplayGrams(savedVariant.weight)
      : savedVariant.weight;
    const nextDisplayWeight = next.productType === 'dimensions'
      ? catalogWeightKilogramsToDisplayGrams(variant.weight)
      : variant.weight;
    pushSaveDiff(variantItems, `${prefix} - teža`, formatSaveDiffNumber(savedDisplayWeight, 'g'), formatSaveDiffNumber(nextDisplayWeight, 'g'));
    pushSaveDiff(variantItems, `${prefix} - toleranca`, formatSaveDiffText(savedVariant.errorTolerance), formatSaveDiffText(variant.errorTolerance));
    pushSaveDiff(variantItems, `${prefix} - cena`, formatSaveDiffCurrency(savedVariant.price), formatSaveDiffCurrency(variant.price));
    pushSaveDiff(variantItems, `${prefix} - popust`, formatSaveDiffNumber(savedVariant.discountPct, '%'), formatSaveDiffNumber(variant.discountPct, '%'));
    pushSaveDiff(variantItems, `${prefix} - zaloga`, formatSaveDiffInteger(savedVariant.stock), formatSaveDiffInteger(variant.stock));
    pushSaveDiff(variantItems, `${prefix} - min. naročilo`, formatSaveDiffInteger(savedVariant.minOrder), formatSaveDiffInteger(variant.minOrder));
    pushSaveDiff(variantItems, `${prefix} - SKU`, formatSaveDiffText(savedVariant.sku), formatSaveDiffText(variant.sku));
    pushSaveDiff(variantItems, `${prefix} - status`, formatSaveDiffStatus(savedVariant.active), formatSaveDiffStatus(variant.active));
    pushSaveDiff(variantItems, `${prefix} - vrstni red`, formatSaveDiffInteger(savedVariant.sort), formatSaveDiffInteger(variant.sort));
    const savedSpecifications = savedVariant.contentOverride?.specifications ?? {};
    const nextSpecifications = variant.contentOverride?.specifications ?? {};
    if (JSON.stringify(savedSpecifications) !== JSON.stringify(nextSpecifications)) {
      const specificationLabels = Object.keys(nextSpecifications).filter((label) => label.trim());
      variantItems.push(
        `${prefix} - dodatne specifikacije: ${
          specificationLabels.length > 0
            ? specificationLabels.join(', ')
            : 'odstranjene'
        }.`
      );
    }

    const savedVariantTag = saved.variantTags[savedVariant.id] ?? '';
    const nextVariantTag = next.variantTags[variant.id] ?? '';
    pushSaveDiff(variantItems, `${prefix} - opomba`, formatSaveDiffNoteTag(savedVariantTag), formatSaveDiffNoteTag(nextVariantTag));

    if (!sameNumberArray(savedVariant.imageAssignments, variant.imageAssignments)) {
      pushSaveDiff(
        variantItems,
        `${prefix} - dodeljene slike`,
        formatSaveDiffAssignments(savedVariant.imageAssignments),
        formatSaveDiffAssignments(variant.imageAssignments)
      );
    }
  });

  if (variantItems.length > 0) groups.push({ title: 'Različice', items: variantItems });

  const quantityDiscountItems: string[] = [];
  const savedQuantityDiscountsById = new Map(saved.quantityDiscounts.map((rule) => [rule.id, rule]));
  const nextQuantityDiscountsById = new Map(next.quantityDiscounts.map((rule) => [rule.id, rule]));
  saved.quantityDiscounts.forEach((rule) => {
    if (!nextQuantityDiscountsById.has(rule.id)) {
      quantityDiscountItems.push(`Odstranjen količinski popust: ${formatQuantityDiscountForSaveDiff(rule)}.`);
    }
  });
  next.quantityDiscounts.forEach((rule) => {
    const savedRule = savedQuantityDiscountsById.get(rule.id);
    if (!savedRule) {
      quantityDiscountItems.push(`Dodan količinski popust: ${formatQuantityDiscountForSaveDiff(rule)}.`);
      return;
    }
    if (serializeQuantityDiscountForSaveDiff(savedRule) !== serializeQuantityDiscountForSaveDiff(rule)) {
      quantityDiscountItems.push(`Količinski popust: ${formatQuantityDiscountForSaveDiff(savedRule)} -> ${formatQuantityDiscountForSaveDiff(rule)}.`);
    }
  });
  if (quantityDiscountItems.length > 0) groups.push({ title: 'Količinski popusti', items: quantityDiscountItems });

  const imageItems: string[] = [];
  const maxImageSlots = Math.max(saved.mediaImages.length, next.mediaImages.length);
  for (let index = 0; index < maxImageSlots; index += 1) {
    const savedSlot = saved.mediaImages[index];
    const nextSlot = next.mediaImages[index];
    const label = `Slika ${index + 1}`;
    if (!savedSlot && nextSlot) {
      imageItems.push(`${label}: dodana (${describeStagedImageSlot(nextSlot)}).`);
      continue;
    }
    if (savedSlot && !nextSlot) {
      imageItems.push(`${label}: odstranjena (${describeStagedImageSlot(savedSlot)}).`);
      continue;
    }
    if (!savedSlot || !nextSlot) continue;

    const savedImageKey = JSON.stringify({
      fileName: savedSlot.file?.name ?? null,
      filename: savedSlot.filename,
      uploadedUrl: savedSlot.uploadedUrl,
      previewUrl: savedSlot.previewUrl
    });
    const nextImageKey = JSON.stringify({
      fileName: nextSlot.file?.name ?? null,
      filename: nextSlot.filename,
      uploadedUrl: nextSlot.uploadedUrl,
      previewUrl: nextSlot.previewUrl
    });
    if (savedImageKey !== nextImageKey) {
      pushSaveDiff(imageItems, label, describeStagedImageSlot(savedSlot), describeStagedImageSlot(nextSlot));
    }
    pushSaveDiff(imageItems, `${label} - alt`, formatSaveDiffText(savedSlot.altText), formatSaveDiffText(nextSlot.altText));
  }
  if (imageItems.length > 0) groups.push({ title: 'Slike', items: imageItems });

  const videoItems: string[] = [];
  if (!saved.video && next.video) {
    videoItems.push(`Video: dodan (${describeStagedVideo(next.video)}).`);
  } else if (saved.video && !next.video) {
    videoItems.push(`Video: odstranjen (${describeStagedVideo(saved.video)}).`);
  } else if (saved.video && next.video) {
    const savedVideoKey = JSON.stringify({
      source: saved.video.source,
      label: saved.video.label,
      uploadedUrl: saved.video.uploadedUrl,
      previewUrl: saved.video.previewUrl,
      fileName: saved.video.file?.name ?? null
    });
    const nextVideoKey = JSON.stringify({
      source: next.video.source,
      label: next.video.label,
      uploadedUrl: next.video.uploadedUrl,
      previewUrl: next.video.previewUrl,
      fileName: next.video.file?.name ?? null
    });
    if (savedVideoKey !== nextVideoKey) {
      pushSaveDiff(videoItems, 'Video', describeStagedVideo(saved.video), describeStagedVideo(next.video));
    }
  }
  const savedVideoTarget = resolveVideoVariantTargetLabel(saved, saved.videoAssignedVariantId);
  const nextVideoTarget = resolveVideoVariantTargetLabel(next, next.videoAssignedVariantId);
  if (saved.video || next.video) {
    pushSaveDiff(videoItems, 'Dodelitev videa', savedVideoTarget, nextVideoTarget);
  }
  if (videoItems.length > 0) groups.push({ title: 'Video', items: videoItems });

  const documentItems: string[] = [];
  const maxDocumentCount = Math.max(saved.documents.length, next.documents.length);
  for (let index = 0; index < maxDocumentCount; index += 1) {
    const savedDocument = saved.documents[index];
    const nextDocument = next.documents[index];
    const label = `Tehnični list ${index + 1}`;
    if (!savedDocument && nextDocument) {
      documentItems.push(`${label}: dodan (${describeStagedDocument(nextDocument)}).`);
      continue;
    }
    if (savedDocument && !nextDocument) {
      documentItems.push(`${label}: odstranjen (${describeStagedDocument(savedDocument)}).`);
      continue;
    }
    if (!savedDocument || !nextDocument) continue;

    const savedDocumentKey = JSON.stringify({
      fileName: savedDocument.file?.name ?? null,
      name: savedDocument.name,
      blobUrl: savedDocument.blobUrl
    });
    const nextDocumentKey = JSON.stringify({
      fileName: nextDocument.file?.name ?? null,
      name: nextDocument.name,
      blobUrl: nextDocument.blobUrl
    });
    if (savedDocumentKey !== nextDocumentKey) {
      pushSaveDiff(documentItems, label, describeStagedDocument(savedDocument), describeStagedDocument(nextDocument));
    }
  }
  if (documentItems.length > 0) groups.push({ title: 'Tehnični listi', items: documentItems });

  return groups;
}


function buildInitialEditorPersistedState(initialData: CatalogItemEditorHydration | null, createType: CreateType): EditorPersistedState {
  const optionAxes: ProductOptionAxisDraft[] = (initialData?.optionAxes ?? []).map((axis, axisIndex) => ({
    id: axis.id ? String(axis.id) : `axis-${axisIndex}`,
    name: axis.name,
    slug: axis.slug,
    position: axis.position ?? axisIndex,
    values: axis.values.map((value, valueIndex) => ({
      id: value.id ? String(value.id) : `value-${axisIndex}-${valueIndex}`,
      value: value.value,
      slug: value.slug,
      swatch: value.swatch ?? null,
      position: value.position ?? valueIndex
    }))
  }));
  const optionSelectionByValueId = new Map<number, { axisId: string; valueId: string }>();
  for (const axis of optionAxes) {
    for (const value of axis.values) {
      const persistedValueId = /^\d+$/.test(value.id) ? Number(value.id) : null;
      if (persistedValueId !== null) optionSelectionByValueId.set(persistedValueId, { axisId: axis.id, valueId: value.id });
    }
  }
  const family = initialData
    ? createFamily({
        id: String(initialData.id),
        name: initialData.itemName,
        description: initialData.description ?? '',
        category: initialData.categoryPath.join(' / '),
        categoryId: null,
        subcategoryId: null,
        images: initialData.media
          .filter((media) => media.mediaKind === 'image' && media.role === 'gallery')
          .map((media) => media.blobUrl || media.externalUrl || '')
          .filter(Boolean),
        promoBadge: initialData.badge ?? '',
        defaultDiscountPct: 0,
        active: initialData.status === 'active',
        sort: initialData.position,
        notes: initialData.adminNotes ?? '',
        slug: initialData.slug,
        defaultVariantId: initialData.defaultVariantId == null ? null : String(initialData.defaultVariantId),
        optionAxes,
        variants: (initialData.variants.length > 0
          ? initialData.variants.map((variant, index) =>
              createVariant({
                id: String(variant.id ?? `variant-${index}`),
                label: variant.variantName,
                width: variant.width ?? null,
                length: variant.length ?? null,
                thickness: variant.thickness ?? null,
                errorTolerance: variant.errorTolerance ?? null,
                weight: variant.weight ?? null,
                minOrder: variant.minOrder ?? 1,
                badge: variant.badge ?? null,
                sku: variant.variantSku ?? '',
                skuAutoGenerated: false,
                price: variant.price,
                costNet: variant.costNet ?? null,
                contentOverride: variant.contentOverride ?? null,
                discountPct: variant.discountPct ?? 0,
                stock: variant.inventory ?? 0,
                active: (variant.status ?? 'active') === 'active',
                sort: index + 1,
                imageAssignments: [...(variant.imageAssignments ?? [])],
                optionValueIds: [...(variant.optionValueIds ?? [])],
                optionSelections: Object.fromEntries(
                  (variant.optionValueIds ?? [])
                    .map((valueId) => optionSelectionByValueId.get(valueId))
                    .filter((selection): selection is { axisId: string; valueId: string } => Boolean(selection))
                    .map((selection) => [selection.axisId, selection.valueId])
                )
              })
            )
          : [createVariant({ label: 'Osnovni artikel' })])
      })
    : createFamily({
        variants: createType === 'variants' ? [createVariant()] : [createVariant({ label: 'Osnovni artikel' })],
        active: true
      });

  const configuredDefaultVariant = family.variants.find((variant) => variant.id === family.defaultVariantId);
  if (!configuredDefaultVariant?.active) {
    family.defaultVariantId = findFirstActiveVariant(family.variants)?.id ?? null;
  }

  const productType: ProductEditorType =
    initialData?.productType
    ?? (initialData?.itemType === 'bulk'
      ? 'weight'
      : initialData?.itemType === 'sheet'
        ? 'dimensions'
        : createType === 'variants'
          ? 'dimensions'
          : family.variants.length > 1 || family.variants.some((variant) => variant.length !== null || variant.width !== null || variant.thickness !== null)
            ? 'dimensions'
            : normalizeCreateType(createType));

  const mediaImages = (initialData?.media
    .filter((media) => media.mediaKind === 'image' && media.role === 'gallery')
    .sort((left, right) => (left.position ?? 0) - (right.position ?? 0))
    .map((media) => {
      const url = media.blobUrl || media.externalUrl || '';
      return {
        persistedId: media.id ?? null,
        previewUrl: url,
        uploadedUrl: url || null,
        blobPathname: media.blobPathname ?? null,
        file: null,
        filename: media.filename ?? null,
        mimeType: media.mimeType ?? null,
        imageDimensions: normalizeImagePixelDimensions(media.imageDimensions),
        altText: media.altText ?? '',
        localId: null
      } satisfies StagedImageSlot;
    })
    .filter((slot) => Boolean(slot.previewUrl)) ?? []);

  const videoMedia = initialData?.media.find((media) => media.mediaKind === 'video') ?? null;
  const video = videoMedia
    ? {
        persistedId: videoMedia.id ?? null,
        source: videoMedia.sourceKind === 'youtube' ? 'youtube' : 'upload',
        label: videoMedia.filename || 'Video',
        previewUrl: videoMedia.externalUrl || videoMedia.blobUrl || '',
        uploadedUrl: videoMedia.blobUrl ?? null,
        blobPathname: videoMedia.blobPathname ?? null,
        file: null,
        mimeType: videoMedia.mimeType ?? null,
        localId: null
      } satisfies StagedVideoState
    : null;

  const videoAssignedVariantId =
    videoMedia && typeof videoMedia.variantIndex === 'number' && family.variants[videoMedia.variantIndex]
      ? family.variants[videoMedia.variantIndex]?.id ?? null
      : null;

  const sideSettings: SideSettingsState = {
    sku: initialData?.sku ?? '',
    brand: initialData?.brand ?? '',
    material: initialData?.material ?? '',
    surface: initialData?.shape ?? '',
    color: initialData?.colour ?? '',
    taxRatePercent: String(Number(((initialData?.taxRate ?? 0.22) * 100).toFixed(2))),
    thicknessTolerance: initialData?.variants[0]?.errorTolerance ?? '',
    moq: initialData?.variants[0]?.minOrder ?? 1,
    palletCount: '',
    dimensions: { width: '', depth: '', height: '' },
    trackInventory: true,
    currentStock: 0,
    minStock: 0,
    warehouseLocation: '',
    basePriceNoVat: '',
    priceRounding: '0.01',
    showOldPrice: true,
    showGallery: true,
    imageFocus: 'center',
    galleryMode: 'grid',
    imageAltText: '',
    videoUrl: ''
  };

  const itemLevelNote = (() => {
    const raw = normalizeVariantTag(initialData?.badge ?? initialData?.adminNotes);
    return ITEM_NOTE_OPTIONS.some((entry) => entry.value === raw) ? raw : '';
  })();

  const documents = initialData?.media
    .filter((media) => media.mediaKind === 'document' && media.role === 'technical_sheet')
    .map((media, index) => ({
      id: String(media.id ?? `document-${index}`),
      name: media.filename || 'Tehnični list',
      size: '—',
      blobUrl: media.blobUrl ?? media.externalUrl ?? null,
      blobPathname: media.blobPathname ?? null,
      file: null,
      mimeType: media.mimeType ?? null,
      localId: null
    })) ?? [];

  const variantTags: Record<string, VariantTag> = {};
  initialData?.variants.forEach((variant) => {
    const key = String(variant.id ?? '');
    const rawBadge = normalizeVariantTag(variant.badge) as VariantTag;
    if (key && ITEM_NOTE_OPTIONS.some((entry) => entry.value === rawBadge)) variantTags[key] = rawBadge;
  });

  const typeSpecificData = createInitialTypeSpecificData(initialData?.typeSpecificData, {
    variants: family.variants,
    baseSku: sideSettings.sku
  });

  return {
    draft: family,
    productType,
    typeSpecificData,
    appearanceOverride: initialData?.appearanceOverride
      ? JSON.parse(JSON.stringify(initialData.appearanceOverride)) as CatalogItemAppearanceOverride
      : null,
    sideSettings,
    documents,
    quantityDiscounts: createInitialQuantityDiscountDrafts(initialData?.quantityDiscounts, productType),
    itemLevelNote,
    mediaImages,
    video,
    variantTags,
    selectedCategoryPath: initialData?.categoryPath ?? [],
    videoAssignedVariantId
  };
}

const defaultDimensionDeliveryTime = '1-2 delovna dneva';

function getWorkingDayUnit(amount: string) {
  const numbers = amount.match(/\d+/g);
  const lastValue = numbers ? Number(numbers[numbers.length - 1]) : 0;
  const lastTwo = Math.abs(lastValue) % 100;
  if (lastTwo === 1) return 'delovni dan';
  if (lastTwo === 2) return 'delovna dneva';
  if (lastTwo === 3 || lastTwo === 4) return 'delovni dnevi';
  return 'delovnih dni';
}

function getDeliveryDayAmount(value: string) {
  const normalized = value.replace(/[–—]/g, '-').trim();
  const match = normalized.match(/\d+(?:\s*-\s*\d*)?/);
  return match ? match[0].replace(/\s+/g, '') : '';
}

function normalizeDeliveryDayAmount(value: string) {
  const normalized = value
    .replace(/[–—]/g, '-')
    .replace(/[^\d-\s]/g, '')
    .replace(/\s+/g, '')
    .replace(/-+/g, '-');
  const [start = '', end = ''] = normalized.split('-', 2);
  if (normalized.includes('-')) return `${start}${start ? '-' : ''}${end}`;
  return start;
}

function formatDeliveryTimeFromAmount(amount: string) {
  const normalizedAmount = normalizeDeliveryDayAmount(amount);
  return normalizedAmount ? `${normalizedAmount} ${getWorkingDayUnit(normalizedAmount)}` : '';
}

function asPlainRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function formatDimensionKeyValue(value: number | null | undefined): string {
  return typeof value === 'number' && Number.isFinite(value) ? formatDecimalForSku(value) : '';
}

function getDimensionVariantKey(variant: Pick<Variant, 'thickness' | 'width' | 'length'> | DimensionInventoryOption): string {
  return [
    formatDimensionKeyValue(variant.thickness),
    formatDimensionKeyValue(variant.length),
    formatDimensionKeyValue(variant.width)
  ].join('x');
}

function shouldGenerateDimensionPair(length: number, width: number | null): boolean {
  return width === null || length >= width;
}

function compareDimensionSortValue(left: number | null | undefined, right: number | null | undefined): number {
  const normalizedLeft = typeof left === 'number' && Number.isFinite(left) ? left : Number.POSITIVE_INFINITY;
  const normalizedRight = typeof right === 'number' && Number.isFinite(right) ? right : Number.POSITIVE_INFINITY;
  return normalizedLeft - normalizedRight;
}

function compareGeneratedDimensionOptions(left: DimensionInventoryOption, right: DimensionInventoryOption): number {
  return (
    compareDimensionSortValue(left.thickness, right.thickness) ||
    compareDimensionSortValue(left.length, right.length) ||
    compareDimensionSortValue(left.width, right.width)
  );
}

function hasDimensionInventoryValues(option: DimensionInventoryOption): boolean {
  return [option.thickness, option.length, option.width].some((value) => typeof value === 'number' && Number.isFinite(value));
}

function formatDimensionInventoryLabel(option: DimensionInventoryOption, fallback = 'Različica'): string {
  const dimensions = [option.thickness, option.length, option.width]
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value))
    .map((value) => formatDecimalForDisplay(value));
  return dimensions.length > 0 ? `${dimensions.join(' × ')} mm` : fallback;
}

function parseDimensionInventoryEntry(value: unknown, index: number): DimensionInventoryEntry | null {
  const record = asPlainRecord(value);
  const thickness = parseDecimalInput(String(record.thickness ?? '').trim());
  const length = parseDecimalInput(String(record.length ?? '').trim());
  const width = parseDecimalInput(String(record.width ?? '').trim());
  const option = {
    thickness: typeof record.thickness === 'number' && Number.isFinite(record.thickness) ? record.thickness : thickness,
    length: typeof record.length === 'number' && Number.isFinite(record.length) ? record.length : length,
    width: typeof record.width === 'number' && Number.isFinite(record.width) ? record.width : width
  };
  if (!hasDimensionInventoryValues(option)) return null;

  const rawStock = typeof record.stock === 'number' ? record.stock : Number(String(record.stock ?? '').replace(',', '.'));
  return {
    id: typeof record.id === 'string' && record.id.trim() ? record.id : `dimension-inventory-${index}-${getDimensionVariantKey(option)}`,
    thickness: option.thickness,
    length: option.length,
    width: option.width,
    stock: Number.isFinite(rawStock) ? Math.max(0, Math.floor(rawStock)) : 0,
    deliveryTime: typeof record.deliveryTime === 'string' && record.deliveryTime.trim() ? record.deliveryTime : defaultDimensionDeliveryTime
  };
}

function uniqueDimensionInventoryRows(rows: readonly DimensionInventoryEntry[]): DimensionInventoryEntry[] {
  const unique: DimensionInventoryEntry[] = [];
  rows.forEach((row) => {
    if (!hasDimensionInventoryValues(row)) return;
    const key = getDimensionVariantKey(row);
    if (unique.some((entry) => getDimensionVariantKey(entry) === key)) return;
    unique.push({
      ...row,
      id: row.id || `dimension-inventory-${key}`
    });
  });
  return unique;
}

function normalizeDimensionSalesData(value: unknown): {
  defaultDeliveryTime: string;
  variantDeliveryTimes: Record<string, string>;
  variantInventory: DimensionInventoryEntry[];
} {
  const record = asPlainRecord(value);
  const rawDeliveryTimes = asPlainRecord(record.variantDeliveryTimes);
  const variantDeliveryTimes = Object.fromEntries(
    Object.entries(rawDeliveryTimes)
      .map(([key, deliveryTime]) => [key, typeof deliveryTime === 'string' ? deliveryTime : ''])
      .filter(([key, deliveryTime]) => key.trim().length > 0 && deliveryTime.trim().length > 0)
  );
  return {
    defaultDeliveryTime: typeof record.defaultDeliveryTime === 'string' && record.defaultDeliveryTime.trim()
      ? record.defaultDeliveryTime
      : defaultDimensionDeliveryTime,
    variantDeliveryTimes,
    variantInventory: uniqueDimensionInventoryRows(
      Array.isArray(record.variantInventory)
        ? record.variantInventory.map(parseDimensionInventoryEntry).filter((entry): entry is DimensionInventoryEntry => Boolean(entry))
        : []
    )
  };
}

function getDimensionVariantDeliveryTime(data: unknown, variant: Variant | null | undefined): string {
  const normalized = normalizeDimensionSalesData(data);
  if (!variant) return normalized.defaultDeliveryTime;
  const contentOverrideDeliveryTime = variant.contentOverride?.deliveryEstimate?.trim();
  if (contentOverrideDeliveryTime) return contentOverrideDeliveryTime;
  return (
    normalized.variantDeliveryTimes[variant.id] ||
    normalized.variantDeliveryTimes[getDimensionVariantKey(variant)] ||
    normalized.defaultDeliveryTime
  );
}

function createDimensionInventoryEntry(
  option: DimensionInventoryOption,
  fallback: { stock?: number; deliveryTime?: string }
): DimensionInventoryEntry {
  const key = getDimensionVariantKey(option);
  return {
    id: `dimension-inventory-${key || Math.random().toString(36).slice(2, 9)}`,
    thickness: option.thickness,
    length: option.length,
    width: option.width,
    stock: Math.max(0, Math.floor(Number(fallback.stock) || 0)),
    deliveryTime: fallback.deliveryTime || defaultDimensionDeliveryTime
  };
}

function getDimensionInventoryRows(data: unknown, variants: readonly Variant[]): DimensionInventoryEntry[] {
  const normalized = normalizeDimensionSalesData(data);
  const rows = [...normalized.variantInventory];

  variants.forEach((variant) => {
    if (!hasDimensionInventoryValues(variant)) return;
    const key = getDimensionVariantKey(variant);
    const existingIndex = rows.findIndex((row) => getDimensionVariantKey(row) === key);
    const deliveryTime = existingIndex >= 0
      ? rows[existingIndex]?.deliveryTime ?? getDimensionVariantDeliveryTime(data, variant)
      : getDimensionVariantDeliveryTime(data, variant);
    if (existingIndex >= 0) {
      rows[existingIndex] = {
        ...rows[existingIndex],
        stock: Math.max(0, Math.floor(Number(variant.stock) || 0)),
        deliveryTime
      };
      return;
    }
    rows.push(createDimensionInventoryEntry(variant, { stock: variant.stock, deliveryTime }));
  });

  return uniqueDimensionInventoryRows(rows);
}

function setDimensionInventoryRows(data: unknown, rows: readonly DimensionInventoryEntry[]): Record<string, unknown> {
  const record = asPlainRecord(data);
  const normalized = normalizeDimensionSalesData(record);
  const variantInventory = uniqueDimensionInventoryRows(rows);
  return {
    ...record,
    defaultDeliveryTime: normalized.defaultDeliveryTime,
    variantDeliveryTimes: {
      ...normalized.variantDeliveryTimes,
      ...Object.fromEntries(variantInventory.map((row) => [getDimensionVariantKey(row), row.deliveryTime]))
    },
    variantInventory
  };
}

function parseDimensionInventoryInput(value: string): DimensionInventoryOption | null {
  const matches = value.replace(/,/g, '.').match(/-?\d+(?:\.\d+)?/g) ?? [];
  const values = matches.map(Number).filter(Number.isFinite);
  if (values.length < 2) return null;
  return {
    thickness: values[0],
    length: values[1],
    width: values[2] ?? null
  };
}

function DimensionVariantInventoryPanel({
  editable,
  inventories,
  selectedInventory,
  selectedInventoryKey,
  lockedInventoryKeys,
  onSelectInventory,
  onAddInventory,
  onRenameInventory,
  onDeleteInventory,
  onUpdateInventory
}: {
  editable: boolean;
  inventories: DimensionInventoryEntry[];
  selectedInventory: DimensionInventoryEntry | null;
  selectedInventoryKey: string;
  lockedInventoryKeys: ReadonlySet<string>;
  onSelectInventory: (key: string) => void;
  onAddInventory: (option: DimensionInventoryOption) => void;
  onRenameInventory: (previousOption: DimensionInventoryOption, nextOption: DimensionInventoryOption) => void;
  onDeleteInventory: (option: DimensionInventoryOption) => void;
  onUpdateInventory: (updates: Partial<Pick<DimensionInventoryEntry, 'stock' | 'deliveryTime'>>) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [addingVariant, setAddingVariant] = useState(false);
  const [newVariantInput, setNewVariantInput] = useState('');
  const [editingInventoryKey, setEditingInventoryKey] = useState<string | null>(null);
  const [editingVariantInput, setEditingVariantInput] = useState('');
  const menuRef = useRef<HTMLDivElement | null>(null);
  const closeMenu = useCallback(() => {
    setMenuOpen(false);
    setAddingVariant(false);
    setNewVariantInput('');
    setEditingInventoryKey(null);
    setEditingVariantInput('');
  }, []);
  const dismissRefs = useMemo(() => [menuRef], []);
  const deliveryTime = selectedInventory?.deliveryTime ?? defaultDimensionDeliveryTime;
  const deliveryDayAmount = getDeliveryDayAmount(deliveryTime);
  const deliveryDayUnit = getWorkingDayUnit(deliveryDayAmount);
  const selectedLabel = selectedInventory ? formatDimensionInventoryLabel(selectedInventory) : 'Ni različic';
  const commitNewVariant = () => {
    const option = parseDimensionInventoryInput(newVariantInput);
    if (!option) return;
    onAddInventory(option);
    setNewVariantInput('');
    setAddingVariant(false);
  };
  const startInventoryEdit = (entry: DimensionInventoryEntry) => {
    const key = getDimensionVariantKey(entry);
    if (lockedInventoryKeys.has(key)) return;
    setAddingVariant(false);
    setEditingInventoryKey(key);
    setEditingVariantInput(formatDimensionInventoryLabel(entry).replace(/\s*mm$/i, ''));
  };
  const cancelInventoryEdit = () => {
    setEditingInventoryKey(null);
    setEditingVariantInput('');
  };
  const commitInventoryRename = (entry: DimensionInventoryEntry) => {
    const key = getDimensionVariantKey(entry);
    if (lockedInventoryKeys.has(key)) return;
    const option = parseDimensionInventoryInput(editingVariantInput);
    if (!option) return;
    onRenameInventory(entry, option);
    cancelInventoryEdit();
  };

  useDropdownDismiss({
    open: menuOpen,
    refs: dismissRefs,
    onClose: closeMenu
  });

  return (
    <aside
      className={classNames(
        'relative mb-5 inline-grid w-fit max-w-full rounded-lg border border-slate-200 bg-white lg:grid-cols-[300px_auto] xl:max-w-[66.666%]',
        menuOpen ? 'overflow-visible' : 'overflow-hidden'
      )}
    >
      <div className="flex min-w-0 items-center gap-3 px-3 py-3">
        <span className="font-['Inter',system-ui,sans-serif] text-[11px] font-semibold leading-[1.2] text-slate-600">Različica</span>
        <div ref={menuRef} className="relative min-w-0">
          <button
            type="button"
            disabled={!editable && inventories.length === 0}
            className={classNames(
              selectTokenClasses.trigger,
              '!h-[30px] !w-[205px] !rounded-md !px-2.5 !py-0 justify-between gap-3 shadow-sm disabled:cursor-not-allowed disabled:opacity-60'
            )}
            onClick={() => setMenuOpen((open) => !open)}
          >
            <span className="truncate font-semibold text-slate-900">{selectedLabel}</span>
            <span
              className="h-0 w-0 border-x-[3.5px] border-t-[5px] border-x-transparent border-t-slate-500"
              aria-hidden="true"
            />
          </button>
          {menuOpen ? (
            <div className={classNames('absolute left-0 z-20 mt-1 rounded-lg border border-slate-200 bg-white p-1.5 shadow-xl', editable ? 'w-[360px]' : 'w-[300px]')}>
              <div className="space-y-1">
                {inventories.map((entry) => {
                  const key = getDimensionVariantKey(entry);
                  const selected = key === selectedInventoryKey;
                  const locked = lockedInventoryKeys.has(key);
                  const isEditing = editingInventoryKey === key && !locked;
                  return (
                    <div
                      key={entry.id || key}
                      role="option"
                      aria-selected={selected}
                      tabIndex={0}
                      className={classNames(
                        "grid min-h-[42px] cursor-pointer items-center gap-2 rounded-md border border-transparent px-2 font-['Inter',system-ui,sans-serif] text-[12px] font-semibold leading-[1.2] outline-none transition hover:text-[color:var(--blue-500)] focus-visible:border-[color:var(--blue-500)] focus-visible:ring-0 focus-visible:shadow-none",
                        editable ? 'grid-cols-[18px_minmax(0,1fr)_58px_24px]' : 'grid-cols-[18px_minmax(0,1fr)_24px]',
                        hoverTokenClasses.neutral,
                        selected ? 'bg-slate-100 text-slate-900' : 'text-slate-600'
                      )}
                      onClick={() => {
                        onSelectInventory(key);
                        setMenuOpen(false);
                      }}
                      onKeyDown={(event) => {
                        if (event.target !== event.currentTarget) return;
                        if (event.key !== 'Enter' && event.key !== ' ') return;
                        event.preventDefault();
                        onSelectInventory(key);
                        setMenuOpen(false);
                      }}
                    >
                      <span className="inline-flex h-4 w-4 items-center justify-center rounded-full">
                        <span
                          className={
                            selected
                              ? 'h-2 w-2 rounded-full bg-[#1982bf]'
                              : 'h-2.5 w-2.5 rounded-full border border-slate-300 bg-white'
                          }
                        />
                      </span>
                      {editable && isEditing ? (
                        <>
                          <input
                            className="h-8 min-w-0 rounded-md border border-slate-300 bg-white px-2 font-['Inter',system-ui,sans-serif] text-[12px] font-semibold leading-[1.2] text-slate-900 outline-none focus:border-[#3e67d6] focus:ring-0"
                            value={editingVariantInput}
                            autoFocus
                            placeholder="0,5 × 200 × 300"
                            onChange={(event) => setEditingVariantInput(event.target.value)}
                            onClick={(event) => event.stopPropagation()}
                            onKeyDown={(event) => {
                              if (event.key === 'Escape') {
                                event.preventDefault();
                                cancelInventoryEdit();
                                return;
                              }
                              if (event.key !== 'Enter') return;
                              event.preventDefault();
                              commitInventoryRename(entry);
                            }}
                          />
                          <span className={adminTableInlineActionRowClassName}>
                            <IconButton
                              type="button"
                              tone="neutral"
                              className={adminTableInlineConfirmButtonClassName}
                              disabled={!parseDimensionInventoryInput(editingVariantInput)}
                              aria-label={`Potrdi urejanje za ${formatDimensionInventoryLabel(entry)}`}
                              title="Potrdi"
                              onClick={(event) => {
                                event.stopPropagation();
                                commitInventoryRename(entry);
                              }}
                            >
                              <CheckIcon className={adminTableInlineConfirmIconClassName} strokeWidth={2.2} />
                            </IconButton>
                            <IconButton
                              type="button"
                              tone="neutral"
                              className={adminTableInlineCancelButtonClassName}
                              aria-label={`Prekliči urejanje za ${formatDimensionInventoryLabel(entry)}`}
                              title="Prekliči"
                              onClick={(event) => {
                                event.stopPropagation();
                                cancelInventoryEdit();
                              }}
                            >
                              <CloseIcon className={adminTableInlineCancelIconClassName} strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" />
                            </IconButton>
                          </span>
                        </>
                      ) : editable && !locked ? (
                        <>
                          <button
                            type="button"
                            className="min-w-0 truncate rounded-md px-1 py-1 text-left font-semibold text-slate-700 hover:bg-white hover:text-slate-900"
                            onClick={(event) => {
                              event.stopPropagation();
                              startInventoryEdit(entry);
                            }}
                            title="Uredi različico"
                          >
                            {formatDimensionInventoryLabel(entry)}
                          </button>
                          <span aria-hidden="true" />
                        </>
                      ) : (
                        <>
                          <span className="min-w-0 truncate text-left">{formatDimensionInventoryLabel(entry)}</span>
                          {editable ? <span aria-hidden="true" /> : null}
                        </>
                      )}
                      {editable ? (
                        <button
                          type="button"
                          className="inline-flex h-6 w-6 items-center justify-center rounded-md text-slate-300 hover:bg-rose-50 hover:text-rose-500 disabled:cursor-not-allowed disabled:opacity-40"
                          aria-label={`Izbriši različico ${formatDimensionInventoryLabel(entry)}`}
                          disabled={inventories.length <= 1 || locked}
                          onClick={(event) => {
                            event.stopPropagation();
                            onDeleteInventory(entry);
                          }}
                        >
                          <TrashCanIcon className="h-4 w-4" />
                        </button>
                      ) : (
                        <span aria-hidden="true" />
                      )}
                    </div>
                  );
                })}
              </div>
              {editable ? (
                addingVariant ? (
                  <div className="mt-1 grid min-h-[34px] grid-cols-[18px_minmax(0,1fr)_66px] items-center gap-2 rounded-lg border border-slate-200 bg-white px-2 py-1.5">
                    <PlusIcon className="h-4 w-4 text-slate-600" />
                    <input
                      className="h-8 min-w-0 rounded-md border border-slate-300 bg-white px-2 font-['Inter',system-ui,sans-serif] text-[12px] font-semibold leading-[1.2] text-slate-900 outline-none focus:border-[#3e67d6] focus:ring-0"
                      value={newVariantInput}
                      autoFocus
                      placeholder="0,5 × 200 × 300"
                      onChange={(event) => setNewVariantInput(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Escape') {
                          setAddingVariant(false);
                          setNewVariantInput('');
                          return;
                        }
                        if (event.key !== 'Enter') return;
                        event.preventDefault();
                        commitNewVariant();
                      }}
                    />
                    <button
                      type="button"
                      className="h-8 rounded-md border border-slate-200 bg-white px-2 font-['Inter',system-ui,sans-serif] text-[11px] font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                      disabled={!parseDimensionInventoryInput(newVariantInput)}
                      onClick={commitNewVariant}
                    >
                      Dodaj
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="mt-1 flex h-8 w-full items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-3 font-['Inter',system-ui,sans-serif] text-[12px] font-semibold leading-[1.2] text-slate-600 shadow-[0_1px_2px_rgba(15,23,42,0.04)] hover:bg-slate-50"
                    onClick={() => setAddingVariant(true)}
                  >
                    <PlusIcon className="h-3.5 w-3.5" />
                    Dodaj različico
                  </button>
                )
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      <div className="grid min-w-0 border-t border-slate-200 bg-white md:grid-cols-[185px_275px] lg:border-l lg:border-t-0 xl:divide-x xl:divide-slate-200">
        <div className="flex min-h-[62px] min-w-0 items-center gap-2 px-3 py-3">
          <span className="shrink-0 text-[11px] font-semibold text-slate-600">Zaloga</span>
          <span className="ml-auto min-w-0">
            <span className="flex h-[30px] w-[90px] rounded-md border border-slate-300 bg-white">
              <input
                className="h-full min-w-0 flex-1 rounded-md border-0 bg-transparent px-2.5 text-right text-[12px] font-semibold text-slate-900 outline-none focus:ring-0"
                value={selectedInventory ? String(selectedInventory.stock) : '0'}
                inputMode="numeric"
                readOnly={!editable || !selectedInventory}
                tabIndex={editable && selectedInventory ? undefined : -1}
                onChange={(event) => onUpdateInventory({ stock: Math.max(0, Math.floor(Number(event.target.value.replace(/\D/g, '')) || 0)) })}
              />
            </span>
          </span>
        </div>
        <div className="flex min-h-[62px] min-w-0 items-center gap-2 px-3 py-3">
          <span className="shrink-0 text-[11px] font-semibold text-slate-600">Dobavni rok</span>
          <span className="ml-auto min-w-0">
            <span className="flex h-[30px] w-[175px] rounded-md border border-slate-300 bg-white">
              <input
                className="h-full min-w-0 flex-1 rounded-l-md border-0 bg-transparent px-2.5 text-[12px] font-semibold text-slate-900 outline-none focus:ring-0"
                value={deliveryDayAmount}
                inputMode="numeric"
                placeholder="1-2"
                readOnly={!editable || !selectedInventory}
                tabIndex={editable && selectedInventory ? undefined : -1}
                onChange={(event) => onUpdateInventory({ deliveryTime: formatDeliveryTimeFromAmount(event.target.value) })}
              />
              <span className={fieldUnitAdornmentClassName}>{deliveryDayUnit}</span>
            </span>
          </span>
        </div>
      </div>
    </aside>
  );
}

function CalmDashedOutline({
  className = '',
  strokeWidth = 1.2,
  dashLength = 5,
  gapLength = 6,
  lineCap = 'butt'
}: {
  className?: string;
  strokeWidth?: number;
  dashLength?: number;
  gapLength?: number;
  lineCap?: 'butt' | 'round' | 'square';
}) {
  const frameRef = useRef<SVGSVGElement>(null);
  const [frameSize, setFrameSize] = useState({ width: 0, height: 0 });
  const [cornerRadius, setCornerRadius] = useState(8);

  useEffect(() => {
    const host = frameRef.current;
    if (!host?.parentElement) return;
    const parent = host.parentElement;
    const sync = () => {
      const rect = parent.getBoundingClientRect();
      setFrameSize({ width: Math.max(0, rect.width), height: Math.max(0, rect.height) });
      const parentStyles = window.getComputedStyle(parent);
      const radius = Number.parseFloat(parentStyles.borderTopLeftRadius || '8');
      setCornerRadius(Number.isFinite(radius) ? radius : 8);
    };
    sync();
    const observer = new ResizeObserver(sync);
    observer.observe(parent);
    return () => observer.disconnect();
  }, []);

  const width = Math.max(0, frameSize.width);
  const height = Math.max(0, frameSize.height);
  const devicePixelRatio = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
  const snapToDevicePixel = (value: number) => Math.round(value * devicePixelRatio) / devicePixelRatio;
  const snappedWidth = Math.max(1, snapToDevicePixel(width));
  const snappedHeight = Math.max(1, snapToDevicePixel(height));
  const svgOffsetX = (width - snappedWidth) / 2;
  const svgOffsetY = (height - snappedHeight) / 2;
  const pathLength = 1000;
  const targetDashLength = dashLength;
  const targetGapLength = gapLength;
  const targetUnit = targetDashLength + targetGapLength;

  const snapToGrid = (value: number) => snapToDevicePixel(value);
  const inset = snapToGrid(strokeWidth / 2);
  const innerWidth = Math.max(0, snapToGrid(snappedWidth - inset * 2));
  const innerHeight = Math.max(0, snapToGrid(snappedHeight - inset * 2));
  const effectiveRadius = Math.max(0, snapToGrid(cornerRadius - inset));
  const perimeter = Math.max(
    1,
    2 * (innerWidth + innerHeight - effectiveRadius * 4) + (2 * Math.PI * effectiveRadius),
  );
  const cycleCount = Math.max(1, Math.round(perimeter / targetUnit));
  const normalizedCycle = pathLength / cycleCount;
  const dashRatio = targetDashLength / targetUnit;
  const normalizedDashLength = normalizedCycle * dashRatio;
  const normalizedGapLength = Math.max(1, normalizedCycle - normalizedDashLength);
  const dashOffset = -(normalizedCycle / 2);

  return (
    <svg
      ref={frameRef}
      aria-hidden
      className={`pointer-events-none absolute ${className}`}
      style={{ left: svgOffsetX, top: svgOffsetY }}
      width={snappedWidth}
      height={snappedHeight}
      viewBox={`0 0 ${snappedWidth} ${snappedHeight}`}
    >
      {width > 0 && height > 0 ? (
        <rect
          x={inset}
          y={inset}
          width={innerWidth}
          height={innerHeight}
          rx={effectiveRadius}
          ry={effectiveRadius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          pathLength={pathLength}
          strokeDasharray={`${normalizedDashLength} ${normalizedGapLength}`}
          strokeDashoffset={dashOffset}
          strokeLinecap={lineCap}
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
          shapeRendering="geometricPrecision"
        />
      ) : null}
    </svg>
  );
}

function ImageUploadFrameIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 48" aria-hidden className={className}>
      <rect x="9" y="8" width="46" height="32" rx="4" fill="#b9d3ea" />
      <path d="M9 28.5 20.5 20l7.5 5.6L42.5 14 55 25v15H9V28.5Z" fill="#74addb" />
      <circle cx="20.5" cy="13.5" r="4.5" fill="#eef5fb" />
      <path d="M4 6.5A2.5 2.5 0 0 1 6.5 4H10v2H7.5A1.5 1.5 0 0 0 6 7.5V10H4V6.5Z" fill="#74addb" />
      <path d="M60 6.5A2.5 2.5 0 0 0 57.5 4H54v2h2.5A1.5 1.5 0 0 1 58 7.5V10h2V6.5Z" fill="#74addb" />
      <path d="M4 41.5A2.5 2.5 0 0 0 6.5 44H10v-2H7.5A1.5 1.5 0 0 1 6 40.5V38H4v3.5Z" fill="#74addb" />
      <path d="M60 41.5A2.5 2.5 0 0 1 57.5 44H54v-2h2.5a1.5 1.5 0 0 0 1.5-1.5V38h2v3.5Z" fill="#74addb" />
    </svg>
  );
}

function VideoUploadFrameIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 48" aria-hidden className={className}>
      <path d="M4 6.5A2.5 2.5 0 0 1 6.5 4H10v2H7.5A1.5 1.5 0 0 0 6 7.5V10H4V6.5Z" fill="currentColor" />
      <path d="M60 6.5A2.5 2.5 0 0 0 57.5 4H54v2h2.5A1.5 1.5 0 0 1 58 7.5V10h2V6.5Z" fill="currentColor" />
      <path d="M4 41.5A2.5 2.5 0 0 0 6.5 44H10v-2H7.5A1.5 1.5 0 0 1 6 40.5V38H4v3.5Z" fill="currentColor" />
      <path d="M60 41.5A2.5 2.5 0 0 1 57.5 44H54v-2h2.5a1.5 1.5 0 0 0 1.5-1.5V38h2v3.5Z" fill="currentColor" />
      <rect x="9" y="8" width="46" height="32" rx="4" fill="currentColor" opacity="0.9" />
      <path d="M27 18.2c0-1.7 1.8-2.8 3.3-2l11.5 6.4c1.6.9 1.6 3.1 0 4L30.3 33c-1.5.9-3.3-.2-3.3-2V18.2Z" fill="#f8fafc" />
    </svg>
  );
}

function DocumentUploadFrameIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 48" aria-hidden className={className}>
      <path d="M4 6.5A2.5 2.5 0 0 1 6.5 4H10v2H7.5A1.5 1.5 0 0 0 6 7.5V10H4V6.5Z" fill="currentColor" />
      <path d="M60 6.5A2.5 2.5 0 0 0 57.5 4H54v2h2.5A1.5 1.5 0 0 1 58 7.5V10h2V6.5Z" fill="currentColor" />
      <path d="M4 41.5A2.5 2.5 0 0 0 6.5 44H10v-2H7.5A1.5 1.5 0 0 1 6 40.5V38H4v3.5Z" fill="currentColor" />
      <path d="M60 41.5A2.5 2.5 0 0 1 57.5 44H54v-2h2.5a1.5 1.5 0 0 0 1.5-1.5V38h2v3.5Z" fill="currentColor" />
      <path d="M20 11h16l8 8v18H20z" fill="currentColor" opacity="0.28" />
      <path d="M36 11v8h8" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M25 27h14M25 32h14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function ImageDropzoneField({
  disabled,
  onPrepareAddFiles,
  className = '',
  children
}: {
  disabled: boolean;
  onPrepareAddFiles: (files: File[]) => void;
  className?: string;
  children: ReactNode;
}) {
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const handleFiles = useCallback((files: FileList | File[] | null) => {
    if (disabled) return;
    const selectedFiles = Array.from(files ?? []).filter((file): file is File => file instanceof File);
    if (selectedFiles.length === 0) return;
    onPrepareAddFiles(selectedFiles);
  }, [disabled, onPrepareAddFiles]);

  const openPicker = useCallback(() => {
    if (disabled) return;
    inputRef.current?.click();
  }, [disabled]);

  return (
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      onClick={openPicker}
      onKeyDown={(event) => {
        if (disabled) return;
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          openPicker();
        }
      }}
      onDragEnter={(event) => {
        if (disabled) return;
        event.preventDefault();
        setDragActive(true);
      }}
      onDragOver={(event) => {
        if (disabled) return;
        event.preventDefault();
        setDragActive(true);
      }}
      onDragLeave={(event) => {
        if (disabled) return;
        event.preventDefault();
        const nextTarget = event.relatedTarget as Node | null;
        if (!nextTarget || !event.currentTarget.contains(nextTarget)) {
          setDragActive(false);
        }
      }}
      onDrop={(event) => {
        if (disabled) return;
        event.preventDefault();
        setDragActive(false);
        handleFiles(event.dataTransfer.files);
      }}
      className={[
        'relative border-2 border-dashed transition',
        dragActive ? 'border-[#1982bf] bg-[#edf3ff]' : 'border-[#9cb8ea] bg-[#f7f9fe]',
        disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:border-[#1982bf] hover:bg-[#edf3ff]',
        className
      ].join(' ')}
    >
      {disabled ? null : (
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          tabIndex={-1}
          onClick={(event) => event.stopPropagation()}
          onChange={(event) => {
            handleFiles(event.currentTarget.files);
            event.currentTarget.value = '';
          }}
        />
      )}
      {children}
    </div>
  );
}

function SideInputIcon({ icon, muted = false, className = '' }: { icon: SideFieldIcon; muted?: boolean; className?: string }) {
  const iconProps = {
    className: `h-[14px] w-[14px] shrink-0 ${muted ? 'text-slate-400' : 'text-slate-500'} ${className}`.trim(),
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    fill: 'none',
    viewBox: '0 0 24 24'
  };

  if (icon === 'brand') {
    return (
      <svg {...iconProps}>
        <path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z" />
        <circle cx="7.5" cy="7.5" r=".5" fill="currentColor" />
      </svg>
    );
  }
  if (icon === 'name') {
    return (
      <svg {...iconProps}>
        <path d="m15 16 2.536-7.328a1.02 1.02 1 0 1 .928 0L22 16" />
        <path d="M15.697 14h5.606" />
        <path d="m2 16 4.039-9.69a.5.5 0 0 1 .923 0L11 16" />
        <path d="M3.304 13h6.392" />
      </svg>
    );
  }
  if (icon === 'material') {
    return (
      <svg {...iconProps}>
        <path d="M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83z" />
        <path d="M2 12a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 12" />
        <path d="M2 17a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 17" />
      </svg>
    );
  }
  if (icon === 'shape') {
    return (
      <svg {...iconProps}>
        <path d="M8.3 10a.7.7 0 0 1-.626-1.079L11.4 3a.7.7 0 0 1 1.198-.043L16.3 8.9a.7.7 0 0 1-.572 1.1Z" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <circle cx="17.5" cy="17.5" r="3.5" />
      </svg>
    );
  }
  if (icon === 'color') {
    return (
      <svg {...iconProps}>
        <path d="M12 22a1 1 0 0 1 0-20 10 9 0 0 1 10 9 5 5 0 0 1-5 5h-2.25a1.75 1.75 0 0 0-1.4 2.8l.3.4a1.75 1.75 0 0 1-1.4 2.8z" />
        <circle cx="13.5" cy="6.5" r=".5" fill="currentColor" />
        <circle cx="17.5" cy="10.5" r=".5" fill="currentColor" />
        <circle cx="6.5" cy="12.5" r=".5" fill="currentColor" />
        <circle cx="8.5" cy="7.5" r=".5" fill="currentColor" />
      </svg>
    );
  }
  if (icon === 'percent') {
    return (
      <svg {...iconProps}>
        <path d="M2.7 10.3a2.41 2.41 0 0 0 0 3.41l7.59 7.59a2.41 2.41 0 0 0 3.41 0l7.59-7.59a2.41 2.41 0 0 0 0-3.41L13.7 2.71a2.41 2.41 0 0 0-3.41 0Z" />
        <path d="M9.2 9.2h.01" />
        <path d="m14.5 9.5-5 5" />
        <path d="M14.7 14.8h.01" />
      </svg>
    );
  }
  if (icon === 'unit') {
    return (
      <svg {...iconProps}>
        <path d="M7 10H6a4 4 0 0 1-4-4 1 1 0 0 1 1-1h4" />
        <path d="M7 5a1 1 0 0 1 1-1h13a1 1 0 0 1 1 1 7 7 0 0 1-7 7H8a1 1 0 0 1-1-1z" />
        <path d="M9 12v5" />
        <path d="M15 12v5" />
        <path d="M5 20a3 3 0 0 1 3-3h8a3 3 0 0 1 3 3 1 1 0 0 1-1 1H6a1 1 0 0 1-1-1" />
      </svg>
    );
  }
  if (icon === 'sku') {
    return (
      <svg {...iconProps}>
        <path d="M3 7V5a2 2 0 0 1 2-2h2" />
        <path d="M17 3h2a2 2 0 0 1 2 2v2" />
        <path d="M21 17v2a2 2 0 0 1-2 2h-2" />
        <path d="M7 21H5a2 2 0 0 1-2-2v-2" />
        <path d="M7 12h10" />
      </svg>
    );
  }
  if (icon === 'link') {
    return (
      <svg {...iconProps}>
        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
      </svg>
    );
  }
  if (icon === 'dimension') {
    return (
      <svg {...iconProps}>
        <path d="M10 15v-3" />
        <path d="M14 15v-3" />
        <path d="M18 15v-3" />
        <path d="M2 8V4" />
        <path d="M22 6H2" />
        <path d="M22 8V4" />
        <path d="M6 15v-3" />
        <rect x="2" y="12" width="20" height="8" rx="2" />
      </svg>
    );
  }
  return <svg {...iconProps}><path d="M7 3h7l5 5v13H7z" /><path d="M14 3v5h5" /><path d="M10 12h6M10 16h6" /></svg>;
}

function OpisRichTextEditor({
  value,
  editable,
  onChange
}: {
  value: string;
  editable: boolean;
  onChange: (next: string) => void;
}) {
  const editorHostRef = useRef<HTMLDivElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const sizeTriggerRef = useRef<HTMLButtonElement>(null);
  const fontTriggerRef = useRef<HTMLButtonElement>(null);
  const colorTriggerRef = useRef<HTMLButtonElement>(null);
  const sizeMenuRef = useRef<HTMLDivElement>(null);
  const fontMenuRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<Editor | null>(null);
  const onChangeRef = useRef(onChange);
  const initialContentRef = useRef(value || '<p></p>');
  const [textLength, setTextLength] = useState(0);
  const [openMenu, setOpenMenu] = useState<null | 'size' | 'font' | 'color'>(null);
  const [customColor, setCustomColor] = useState('#1e293b');
  const [fontSizeValue, setFontSizeValue] = useState('');
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null);
  const [mediaDialogMode, setMediaDialogMode] = useState<'link' | 'image' | null>(null);
  const [mediaUrlDraft, setMediaUrlDraft] = useState('https://');
  const closeRichTextMenu = useCallback(() => setOpenMenu(null), []);
  const richTextMenuDismissRefs = useMemo(() => [toolbarRef, sizeMenuRef, fontMenuRef], []);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (!editorHostRef.current) return;
    const FontSize = Extension.create({
      name: 'fontSize',
      addGlobalAttributes() {
        return [
          {
            types: ['textStyle'],
            attributes: {
              fontSize: {
                default: null,
                parseHTML: (element: HTMLElement) => element.style.fontSize || null,
                renderHTML: (attributes: { fontSize?: string | null }) =>
                  attributes.fontSize
                    ? { style: `font-size: ${attributes.fontSize}` }
                    : {}
              }
            }
          }
        ];
      }
    });

    const editor = new Editor({
      element: editorHostRef.current,
      editable,
      extensions: [
        StarterKit.configure({ link: false, underline: false }),
        Underline,
        TextStyle,
        FontSize,
        Highlight.configure({ multicolor: true }),
        Color,
        FontFamily,
        TiptapLink.configure({ openOnClick: false, defaultProtocol: 'https' }),
        TiptapImage,
        TextAlign.configure({ types: ['heading', 'paragraph'] }),
        Placeholder.configure({ placeholder: 'Opis artikla...' })
      ],
      content: initialContentRef.current,
      editorProps: {
        attributes: {
          class: `w-full bg-white px-5 py-4 text-[12px] font-['Inter',system-ui,sans-serif] text-slate-800 outline-none ${!editable ? 'cursor-default' : ''}`
        }
      },
      onUpdate: ({ editor: nextEditor }: { editor: Editor }) => {
        onChangeRef.current(nextEditor.getHTML());
        setTextLength(nextEditor.getText().length);
      }
    });

    setTextLength(editor.getText().length);
    editorRef.current = editor;
    return () => {
      editor.destroy();
      editorRef.current = null;
    };
  }, [editable]);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    const next = value || '<p></p>';
    if (editor.getHTML() !== next) {
      editor.commands.setContent(next, { emitUpdate: false });
      setTextLength(editor.getText().length);
    }
  }, [value]);

  const getMenuRefs = useCallback((menu: 'size' | 'font' | 'color') => {
    if (menu === 'size') return { trigger: sizeTriggerRef.current, panel: sizeMenuRef.current };
    if (menu === 'font') return { trigger: fontTriggerRef.current, panel: fontMenuRef.current };
    return { trigger: colorTriggerRef.current, panel: null };
  }, []);

  const updateMenuPosition = useCallback(() => {
    if (!openMenu) return;
    const refs = getMenuRefs(openMenu);
    if (!refs.trigger) return;
    const rect = refs.trigger.getBoundingClientRect();
    const panelWidth = refs.panel?.offsetWidth ?? (openMenu === 'color' ? 228 : 90);
    const left = Math.min(Math.max(8, rect.left), window.innerWidth - panelWidth - 8);
    const top = Math.min(rect.bottom + 6, window.innerHeight - 8);
    setMenuPosition({ top, left });
  }, [getMenuRefs, openMenu]);

  const positionMenuForTrigger = useCallback((menu: 'size' | 'font' | 'color', trigger: HTMLElement | null) => {
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const estimatedWidth = menu === 'size' ? 100 : menu === 'font' ? 135 : 228;
    const left = Math.min(Math.max(8, rect.left), window.innerWidth - estimatedWidth - 8);
    const top = Math.min(rect.bottom + 6, window.innerHeight - 8);
    setMenuPosition({ top, left });
  }, []);

  useDropdownDismiss({
    open: openMenu === 'size' || openMenu === 'font',
    refs: richTextMenuDismissRefs,
    onClose: closeRichTextMenu
  });

  useEffect(() => {
    if (!openMenu) return;
    updateMenuPosition();
    const onWindowChange = () => updateMenuPosition();
    window.addEventListener('resize', onWindowChange);
    window.addEventListener('scroll', onWindowChange, true);
    return () => {
      window.removeEventListener('resize', onWindowChange);
      window.removeEventListener('scroll', onWindowChange, true);
    };
  }, [getMenuRefs, openMenu, updateMenuPosition]);

  const run = (action: (editor: Editor) => void, options?: { focusEditor?: boolean }) => {
    const editor = editorRef.current;
    if (!editor || !editable) return;
    action(editor);
    if (options?.focusEditor ?? true) editor.commands.focus();
  };
  const applyFontSize = (rawValue: string) => {
    const parsed = Number(rawValue);
    if (!Number.isFinite(parsed) || parsed <= 0) return;
    run((e) => e.chain().setMark('textStyle', { fontSize: `${parsed}px` }).run(), { focusEditor: false });
  };
  const applyColor = (nextColor: string) => {
    const normalized = nextColor.trim();
    if (!normalized) return;
    setCustomColor(normalized);
    run((e) => e.chain().setColor(normalized).run(), { focusEditor: false });
  };
  const escapeHtml = (value: string) => value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
  const applyListWithLineSplit = (ordered: boolean) => {
    run((editorInstance) => {
      const { from, to } = editorInstance.state.selection;
      const selected = editorInstance.state.doc.textBetween(from, to, '\n');
      const lines = selected.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
      if (lines.length > 1) {
        const html = lines.map((line) => `<p>${escapeHtml(line)}</p>`).join('');
        const chain = editorInstance.chain().focus().deleteRange({ from, to }).insertContent(html);
        if (ordered) chain.toggleOrderedList().run();
        else chain.toggleBulletList().run();
        return;
      }
      if (ordered) editorInstance.chain().focus().toggleOrderedList().run();
      else editorInstance.chain().focus().toggleBulletList().run();
    });
  };
  const submitMediaUrl = () => {
    const normalized = mediaUrlDraft.trim();
    if (!normalized) return;
    if (mediaDialogMode === 'link') run((e) => e.chain().focus().setLink({ href: normalized }).run());
    if (mediaDialogMode === 'image') run((e) => e.chain().focus().setImage({ src: normalized }).run());
    setMediaDialogMode(null);
    setMediaUrlDraft('https://');
  };
  const preventToolbarFocusLoss = (event: { preventDefault: () => void }) => event.preventDefault();
  const toolbarButtonClass = 'rounded p-1.5 text-slate-600 transition hover:bg-slate-200 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50';
  const toolbarIconClass = 'h-4 w-4';
  const toolbarIconItalicClass = 'h-[14px] w-[14px]';
  const toolbarIconTextSizeClass = 'h-[17.6px] w-[17.6px]';
  const toolbarIconLargeClass = 'h-[18px] w-[18px]';
  const toolbarIconAlignClass = 'h-4 w-4';
  const toolbarIconSmallClass = 'h-[13.6px] w-[13.6px]';
  const toolbarIconTinyClass = 'h-3.5 w-3.5';
  const toolbarIconHighlightClass = 'h-3.5 w-3.5';
  const divider = <span className="mx-1 h-6 w-px bg-slate-300" aria-hidden />;
  const fontFamilyOptions = [
    { label: 'Inter', value: 'Inter, system-ui, sans-serif' },
    { label: 'Arial', value: 'Arial, sans-serif' },
    { label: 'Helvetica', value: 'Helvetica, Arial, sans-serif' },
    { label: 'Georgia', value: 'Georgia, serif' },
    { label: 'Times New Roman', value: '"Times New Roman", Times, serif' },
    { label: 'Verdana', value: 'Verdana, sans-serif' },
    { label: 'Tahoma', value: 'Tahoma, sans-serif' },
    { label: 'Trebuchet MS', value: '"Trebuchet MS", sans-serif' },
    { label: 'Courier New', value: '"Courier New", Courier, monospace' },
    { label: 'system-ui', value: 'system-ui, sans-serif' }
  ] as const;

  return (
    <div className={`relative flex h-[150px] min-h-[130px] resize-y flex-col overflow-hidden rounded-lg border border-slate-300 ${editable ? 'bg-white' : 'bg-[color:var(--field-locked-bg)]'}`}>
      <div ref={toolbarRef} className="flex flex-nowrap items-center gap-0.5 border-b border-slate-200 bg-slate-50 px-3 py-2">
        <button type="button" title="Krepko" className={toolbarButtonClass} disabled={!editable} onMouseDown={preventToolbarFocusLoss} onClick={() => run((e) => e.chain().focus().toggleBold().run())} aria-label="Bold"><span className="inline-block w-4 text-center text-base font-bold leading-none">B</span></button>
        <button type="button" title="Ležeče" className={toolbarButtonClass} disabled={!editable} onMouseDown={preventToolbarFocusLoss} onClick={() => run((e) => e.chain().focus().toggleItalic().run())} aria-label="Italic"><svg xmlns="http://www.w3.org/2000/svg" className={toolbarIconItalicClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" x2="10" y1="4" y2="4"/><line x1="14" x2="5" y1="20" y2="20"/><line x1="15" x2="9" y1="4" y2="20"/></svg></button>
        <button type="button" title="Podčrtano" className={toolbarButtonClass} disabled={!editable} onMouseDown={preventToolbarFocusLoss} onClick={() => run((e) => e.chain().focus().toggleUnderline().run())} aria-label="Underline"><span className="inline-block w-4 text-center text-base underline leading-none">U</span></button>
        {divider}
        <button type="button" title="Točkovni seznam" className={toolbarButtonClass} disabled={!editable} onMouseDown={preventToolbarFocusLoss} onClick={() => applyListWithLineSplit(false)} aria-label="Bullet list"><svg className={toolbarIconLargeClass} viewBox="0 0 20 20" fill="currentColor"><path d="M3 5.75A.75.75 0 1 1 4.5 5.75.75.75 0 0 1 3 5.75Zm0 4.25A.75.75 0 1 1 4.5 10 .75.75 0 0 1 3 10Zm0 4.25a.75.75 0 1 1 1.5 0 .75.75 0 0 1-1.5 0ZM7 5h10v1.5H7V5Zm0 4.25h10v1.5H7v-1.5Zm0 4.25h10V15H7v-1.5Z" /></svg></button>
        <button type="button" title="Oštevilčen seznam" className={toolbarButtonClass} disabled={!editable} onMouseDown={preventToolbarFocusLoss} onClick={() => applyListWithLineSplit(true)} aria-label="Ordered list"><svg className={toolbarIconLargeClass} viewBox="0 0 20 20" fill="currentColor"><path d="M3.5 5h1v4h-1V7.3l-.7.3L2.5 6.8 3.5 6.3V5Zm3.5 0h10v1.5H7V5Zm0 4.25h10v1.5H7v-1.5Zm0 4.25h10V15H7v-1.5Zm-3.5-.15a1.9 1.9 0 0 1 1.9 1.9c0 .42-.13.79-.43 1.12-.23.26-.56.48-1 .63H5.5V18H2.5v-1.08l1.32-1.1c.2-.17.34-.3.41-.4a.66.66 0 0 0 .12-.39.63.63 0 0 0-.2-.48.81.81 0 0 0-.54-.17c-.34 0-.67.11-.99.33L2 13.9a2.4 2.4 0 0 1 1.5-.55Z" /></svg></button>
        {divider}
        <div className="relative">
          <button ref={sizeTriggerRef} type="button" title="Velikost besedila" className={toolbarButtonClass} disabled={!editable} onMouseDown={preventToolbarFocusLoss} onClick={(event) => { event.stopPropagation(); const next = openMenu === 'size' ? null : 'size'; if (next) positionMenuForTrigger(next, event.currentTarget); setOpenMenu(next); }} aria-label="Text size"><svg className={toolbarIconTextSizeClass} viewBox="0 0 36 36" fill="currentColor" aria-hidden="true"><path d="M21,9.08A1.13,1.13,0,0,0,19.86,8H4.62a1.1,1.1,0,1,0,0,2.19H11V27a1.09,1.09,0,0,0,2.17,0V10.19h6.69A1.14,1.14,0,0,0,21,9.08Z" /><path d="M30.67,15H21.15a1.1,1.1,0,1,0,0,2.19H25V26.5a1.09,1.09,0,0,0,2.17,0V17.23h3.54a1.1,1.1,0,1,0,0-2.19Z" /></svg></button>
          {openMenu === 'size' && editable && menuPosition ? createPortal(
            <MenuPanel ref={sizeMenuRef} className="fixed z-[90] w-[100px] p-2 shadow-lg" style={menuPosition}>
              <div onMouseDown={(event) => event.stopPropagation()}>
              <div className="grid grid-cols-[1.25fr_1fr] items-center overflow-hidden rounded-md border border-slate-300">
                <input
                  type="number"
                  min={1}
                  className={`h-8 w-full border-0 px-2 text-xs text-slate-700 outline-none focus:ring-0 ${numberInputClass}`}
                  value={fontSizeValue}
                  onChange={(event) => {
                    setFontSizeValue(event.target.value);
                    applyFontSize(event.target.value);
                  }}
                  placeholder="16"
                />
                <span className="inline-flex h-8 items-center justify-center border-l border-slate-300 bg-slate-50 text-xs text-slate-500">px</span>
              </div>
              </div>
            </MenuPanel>,
            document.body
          ) : null}
        </div>
        <div className="relative">
          <button ref={fontTriggerRef} type="button" title="Pisava" className={toolbarButtonClass} disabled={!editable} onMouseDown={preventToolbarFocusLoss} onClick={(event) => { event.stopPropagation(); const next = openMenu === 'font' ? null : 'font'; if (next) positionMenuForTrigger(next, event.currentTarget); setOpenMenu(next); }} aria-label="Font family"><svg className={toolbarIconLargeClass} viewBox="0 0 20 20" fill="currentColor"><path d="m11.3 4.5 4.2 11h-2.1l-.8-2.4H8.2l-.8 2.4H5.3l4.2-11h1.8Zm.7 6.8-1.6-4.7-1.6 4.7H12Z" /></svg></button>
          {openMenu === 'font' && editable && menuPosition ? createPortal(
            <MenuPanel ref={fontMenuRef} className="fixed z-[90] w-[135px] shadow-lg" style={menuPosition}>
              <div onMouseDown={(event) => event.stopPropagation()}>
              {fontFamilyOptions.map((font) => (
                <MenuItem key={font.value} className="h-8 text-[12px]" onClick={() => { run((e) => e.chain().focus().setFontFamily(font.value).run()); setOpenMenu(null); }}>
                  <span className="text-[12px]" style={{ fontFamily: font.value }}>{font.label}</span>
                </MenuItem>
              ))}
              </div>
            </MenuPanel>,
            document.body
          ) : null}
        </div>
        <div className="relative">
          <button
            ref={colorTriggerRef}
            type="button"
            title="Barva besedila"
            className={toolbarButtonClass}
            disabled={!editable}
            onMouseDown={preventToolbarFocusLoss}
            onClick={(event) => {
              event.stopPropagation();
              const next = openMenu === 'color' ? null : 'color';
              if (next) positionMenuForTrigger(next, event.currentTarget);
              setOpenMenu(next);
            }}
            aria-label="Text color"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className={toolbarIconTinyClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m11 10 3 3"/><path d="M6.5 21A3.5 3.5 0 1 0 3 17.5a2.62 2.62 0 0 1-.708 1.792A1 1 0 0 0 3 21z"/><path d="M9.969 17.031 21.378 5.624a1 1 0 0 0-3.002-3.002L6.967 14.031"/></svg>
          </button>
          <OpisColorPopover open={openMenu === 'color' && editable} anchorRef={colorTriggerRef} color={customColor} onChange={applyColor} onClose={() => setOpenMenu(null)} />
        </div>
        <button type="button" title="Označi besedilo" className={toolbarButtonClass} disabled={!editable} onMouseDown={preventToolbarFocusLoss} onClick={() => run((e) => e.chain().focus().toggleHighlight({ color: '#fde68a' }).run())} aria-label="Highlight"><svg xmlns="http://www.w3.org/2000/svg" className={toolbarIconHighlightClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 11-6 6v3h9l3-3"/><path d="m22 12-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4"/></svg></button>
        <button type="button" title="Vodoravna črta" className={toolbarButtonClass} disabled={!editable} onMouseDown={preventToolbarFocusLoss} onClick={() => run((e) => e.chain().focus().setHorizontalRule().run())} aria-label="Horizontal rule"><svg className={toolbarIconClass} viewBox="0 0 20 20" fill="currentColor"><path d="M3 9.25h14v1.5H3v-1.5Z" /></svg></button>
        {divider}
        <button type="button" title="Povezava" className={toolbarButtonClass} disabled={!editable} onMouseDown={preventToolbarFocusLoss} onClick={() => run((e) => {
          if (e.isActive('link')) {
            e.chain().focus().unsetLink().run();
            return;
          }
          setMediaDialogMode('link');
          setMediaUrlDraft('https://');
        })} aria-label="Link"><svg className={toolbarIconSmallClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></svg></button>
        <button type="button" title="Slika" className={toolbarButtonClass} disabled={!editable} onMouseDown={preventToolbarFocusLoss} onClick={() => { setMediaDialogMode('image'); setMediaUrlDraft('https://'); }} aria-label="Image"><svg className={toolbarIconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="m21 15-5-5L5 21" /></svg></button>
        {divider}
        <button type="button" title="Poravnaj levo" className={toolbarButtonClass} disabled={!editable} onMouseDown={preventToolbarFocusLoss} onClick={() => run((e) => e.chain().focus().setTextAlign('left').run())} aria-label="Align left"><svg xmlns="http://www.w3.org/2000/svg" className={toolbarIconAlignClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 5H3"/><path d="M15 12H3"/><path d="M17 19H3"/></svg></button>
        <button type="button" title="Poravnaj na sredino" className={toolbarButtonClass} disabled={!editable} onMouseDown={preventToolbarFocusLoss} onClick={() => run((e) => e.chain().focus().setTextAlign('center').run())} aria-label="Align center"><svg xmlns="http://www.w3.org/2000/svg" className={toolbarIconAlignClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 5H3"/><path d="M17 12H7"/><path d="M19 19H5"/></svg></button>
        <button type="button" title="Poravnaj desno" className={toolbarButtonClass} disabled={!editable} onMouseDown={preventToolbarFocusLoss} onClick={() => run((e) => e.chain().focus().setTextAlign('right').run())} aria-label="Align right"><svg xmlns="http://www.w3.org/2000/svg" className={toolbarIconAlignClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 5H3"/><path d="M21 12H9"/><path d="M21 19H7"/></svg></button>
        <button type="button" title="Poravnaj obojestransko" className={toolbarButtonClass} disabled={!editable} onMouseDown={preventToolbarFocusLoss} onClick={() => run((e) => e.chain().focus().setTextAlign('justify').run())} aria-label="Align justify"><svg xmlns="http://www.w3.org/2000/svg" className={toolbarIconAlignClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 5h18"/><path d="M3 12h18"/><path d="M3 19h18"/></svg></button>
      </div>
      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
        <div
          ref={editorHostRef}
          className={`min-h-0 flex-1 overflow-x-hidden overflow-y-hidden [&_.ProseMirror]:min-h-[112px] [&_.ProseMirror]:px-4 [&_.ProseMirror]:py-3 [&_.ProseMirror]:text-sm [&_.ProseMirror]:outline-none [&_.ProseMirror]:prose [&_.ProseMirror]:max-w-none [&_.ProseMirror_h1]:text-xl [&_.ProseMirror_h2]:text-lg [&_.ProseMirror_h3]:text-base [&_.ProseMirror_ul]:list-disc [&_.ProseMirror_ul]:pl-5 [&_.ProseMirror_ol]:list-decimal [&_.ProseMirror_ol]:pl-5 [&_.ProseMirror_blockquote]:border-l-4 [&_.ProseMirror_blockquote]:border-slate-300 [&_.ProseMirror_blockquote]:pl-3 [&_.ProseMirror_a]:text-[#1982bf] [&_.ProseMirror_a]:underline ${editable ? '[&_.ProseMirror]:text-slate-800 [&_.ProseMirror]:prose-slate' : 'cursor-not-allowed [&_.ProseMirror]:bg-[color:var(--field-locked-bg)] [&_.ProseMirror]:text-slate-500 [&_.ProseMirror]:prose-slate'}`}
        />
        <div className={`pointer-events-none ml-auto px-4 pb-2 text-xs ${editable ? 'text-slate-400' : 'text-slate-500'}`}>{textLength} / 5000</div>
      </div>
      <Dialog
        open={mediaDialogMode !== null}
        onOpenChange={(open) => {
          if (open) return;
          setMediaDialogMode(null);
          setMediaUrlDraft('https://');
        }}
        title={mediaDialogMode === 'link' ? 'Dodaj povezavo' : 'Dodaj sliko'}
        isDismissable
        footer={(
          <div className={dialogFooterClassName}>
            <Button type="button" variant="default" size="toolbar" className={dialogActionButtonClassName} onClick={() => setMediaDialogMode(null)}>Prekliči</Button>
            <Button type="button" variant="primary" size="toolbar" className={dialogActionButtonClassName} onClick={submitMediaUrl}>Potrdi</Button>
          </div>
        )}
      >
        <div className="mt-2 space-y-1">
          <label className="text-xs text-slate-600">{mediaDialogMode === 'link' ? 'URL povezave' : 'URL slike'}</label>
          <input className={inputClass} value={mediaUrlDraft} onChange={(event) => setMediaUrlDraft(event.target.value)} placeholder="https://" />
        </div>
      </Dialog>
    </div>
  );
}

function NeutralDropdownChip<Value extends string>({
  value,
  editable,
  options,
  onChange,
  chipClassName,
  placeholderLabel,
  optionClassName,
  menuPlacement = 'bottom'
}: {
  value: Value | '';
  editable: boolean;
  options: ReadonlyArray<{ value: Value; label: string }>;
  onChange: (next: Value) => void;
  chipClassName?: string;
  placeholderLabel?: string;
  optionClassName?: (value: Value) => string;
  menuPlacement?: 'top' | 'bottom';
}) {
  const selectedOption = options.find((option) => option.value === value) ?? null;
  const displayedLabel = selectedOption?.label ?? placeholderLabel ?? '';
  const menuOptions = options.map((option): EditableChipMenuOption<Value> => ({
    value: option.value,
    label: option.label,
    className: optionClassName?.(option.value)
  }));

  return (
    <EditableChipMenu
      label={displayedLabel}
      variant="neutral"
      editable={editable}
      options={menuOptions}
      onChange={onChange}
      chipClassName={chipClassName}
      menuPlacement={menuPlacement}
      minMenuWidth={150}
    />
  );
}

export default function AdminItemEditorPage({
  articleId,
  mode,
  createType = 'simple',
  initialData = null
}: {
  articleId?: string;
  mode: EditorMode;
  createType?: CreateType;
  initialData?: CatalogItemEditorHydration | null;
}) {
  const { toast } = useToast();
  const router = useRouter();
  const categoryPathsFromSeed = useMemo(() => [], []);
  const [categoryPaths, setCategoryPaths] = useState<string[]>(categoryPathsFromSeed);
  const initialPersistedStateRef = useRef<EditorPersistedState | null>(null);
  if (initialPersistedStateRef.current === null) {
    initialPersistedStateRef.current = buildInitialEditorPersistedState(initialData, createType);
  }
  const initialPersistedState = initialPersistedStateRef.current;
  const [currentUpdatedAt, setCurrentUpdatedAt] = useState<string | null>(
    initialData?.updatedAt ?? null
  );

  const [draft, setDraft] = useState<ProductFamily>(() => ({
    ...initialPersistedState.draft,
    optionAxes: cloneOptionAxes(initialPersistedState.draft.optionAxes),
    variants: initialPersistedState.draft.variants.map(cloneVariant)
  }));
  const [productType, setProductType] = useState<ProductEditorType>(initialPersistedState.productType);
  const [typeSpecificData, setTypeSpecificData] = useState<UniversalProductSpecificData>(() => cloneTypeSpecificData(initialPersistedState.typeSpecificData));
  const [appearanceOverride, setAppearanceOverride] = useState<CatalogItemAppearanceOverride | null>(
    () => initialPersistedState.appearanceOverride
      ? JSON.parse(JSON.stringify(initialPersistedState.appearanceOverride)) as CatalogItemAppearanceOverride
      : null
  );
  const [variantSelections, setVariantSelections] = useState<Set<string>>(new Set());
  const [dimensionVariantViewMode, setDimensionVariantViewMode] = useState<DimensionVariantViewMode>('rows');
  const [expandedDimensionVariantId, setExpandedDimensionVariantId] = useState<string | null>(
    () => initialPersistedState.draft.defaultVariantId ?? initialPersistedState.draft.variants[0]?.id ?? null
  );
  const [hoveredDimensionVariantId, setHoveredDimensionVariantId] = useState<string | null>(null);
  const [collapseInactiveDimensionVariants, setCollapseInactiveDimensionVariants] = useState(true);
  const [draggedDimensionVariantId, setDraggedDimensionVariantId] = useState<string | null>(null);
  const dimensionVariantScrollRef = useRef<HTMLDivElement | null>(null);
  const dimensionVariantSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: adjacentDimensionVariantKeyboardCoordinates })
  );
  const [generatorInput, setGeneratorInput] = useState('');
  const [generatorChips, setGeneratorChips] = useState<GeneratorChip[]>([]);
  const [generatorError, setGeneratorError] = useState<string | null>(null);
  const [sideSettings, setSideSettings] = useState<SideSettingsState>(() => cloneSideSettings(initialPersistedState.sideSettings));
  const [documents, setDocuments] = useState<StagedTechnicalDocument[]>(() => initialPersistedState.documents.map(cloneDocument));
  const [quantityDiscounts, setQuantityDiscounts] = useState<QuantityDiscountDraft[]>(() => initialPersistedState.quantityDiscounts.map(cloneQuantityDiscountDraft));
  const [editorMode, setEditorMode] = useState<'read' | 'edit'>(mode === 'create' ? 'edit' : 'read');
  const [isSaving, setIsSaving] = useState(false);
  const saveInFlightRef = useRef(false);
  const mediaUploadPromiseCacheRef = useRef<MediaUploadPromiseCache<File, UploadedCatalogMediaFile>>(
    new WeakMap()
  );
  const [isDuplicating, setIsDuplicating] = useState(false);
  const [itemLevelNote, setItemLevelNote] = useState<VariantTag | ''>(initialPersistedState.itemLevelNote);
  const [editorTab, setEditorTab] = useState<ProductEditorMainTab>('basic');
  const [mediaTab, setMediaTab] = useState<MediaTab>('slike');
  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get('tab') !== 'sales' && url.hash !== '#product-measurements') return;
    setEditorTab('sales');
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        document.getElementById('product-measurements')?.scrollIntoView({ block: 'start' });
      });
    });
  }, []);
  const [mediaImageSlots, setMediaImageSlots] = useState<StagedImageSlot[]>(() => initialPersistedState.mediaImages.map(cloneMediaImage));
  const [draggedImageIndex, setDraggedImageIndex] = useState<number | null>(null);
  const localBlobUrlsRef = useRef<Set<string>>(new Set());
  const suppressImageClickAfterDragRef = useRef(false);
  const mediaUploadInputRef = useRef<HTMLInputElement>(null);
  const mediaUploadContextRef = useRef<{ slotIndex: number; multiple: boolean }>({ slotIndex: 0, multiple: true });
  const [youtubeInput, setYoutubeInput] = useState('');
  const [videoDraft, setVideoDraft] = useState<StagedVideoState | null>(() => cloneVideo(initialPersistedState.video));
  const [videoDragActive, setVideoDragActive] = useState(false);
  const [videoMoveMode, setVideoMoveMode] = useState(false);
  const [videoAssignedVariantId, setVideoAssignedVariantId] = useState<string | null>(initialPersistedState.videoAssignedVariantId);
  const technicalUploadInputRef = useRef<HTMLInputElement>(null);
  const [variantTags, setVariantTags] = useState<Record<string, VariantTag>>(() => ({ ...initialPersistedState.variantTags }));
  const [editingImageSlot, setEditingImageSlot] = useState<number | null>(null);
  const [decimalInputDrafts, setDecimalInputDrafts] = useState<Record<string, string>>({});
  const [selectedCategoryPath, setSelectedCategoryPath] = useState<string[]>(() => [...initialPersistedState.selectedCategoryPath]);
  const [savedSnapshot, setSavedSnapshot] = useState<EditorPersistedState>(() => cloneEditorPersistedState(initialPersistedState));
  const [pendingSaveConfirmation, setPendingSaveConfirmation] = useState<PendingSaveConfirmation | null>(null);
  const [pendingProductTypeChange, setPendingProductTypeChange] = useState<ProductEditorType | null>(null);
  const [isProductTypeSelectorExpanded, setIsProductTypeSelectorExpanded] = useState(mode === 'create');
  const [isProductTypeSelectionConfirmed, setIsProductTypeSelectionConfirmed] = useState(mode !== 'create');
  const [isDiscardUnsavedDialogOpen, setIsDiscardUnsavedDialogOpen] = useState(false);
  const undoHistoryRef = useRef<EditorUndoSnapshot[]>([]);
  const activeTextUndoSessionRef = useRef<TextUndoSession | null>(null);
  const pendingTextUndoCommitRef = useRef<TextUndoSession | null>(null);
  const pendingTextUndoStartRef = useRef<HTMLElement | null>(null);
  const resumeTextUndoSessionRef = useRef<HTMLElement | null>(null);
  const nameSuggestionInputRef = useRef<HTMLInputElement | null>(null);
  const skuSuggestionInputRef = useRef<HTMLInputElement | null>(null);
  const slugSuggestionInputRef = useRef<HTMLInputElement | null>(null);
  const suppressUndoTrackingRef = useRef(false);
  const lastTrackedUndoSnapshotRef = useRef<{ key: string; snapshot: EditorUndoSnapshot } | null>(null);
  const [undoDepth, setUndoDepth] = useState(0);
  const [textUndoSessionRevision, setTextUndoSessionRevision] = useState(0);
  const [openIdentitySuggestionField, setOpenIdentitySuggestionField] = useState<IdentitySuggestionField | null>(null);
  const [simulatorVariantId, setSimulatorVariantId] = useState(() => initialPersistedState.draft.variants[0]?.id ?? '');
  const [simulatorQuantity, setSimulatorQuantity] = useState(30);
  const [simulatorAppliesQuantityDiscounts, setSimulatorAppliesQuantityDiscounts] = useState(true);
  const mediaImagesDraft = useMemo(() => mediaImageSlots.map((slot) => slot.previewUrl).filter(Boolean), [mediaImageSlots]);
  const simpleProductData = typeSpecificData.simple;
  const weightProductData = typeSpecificData.weight;
  const machineProductData = typeSpecificData.uniqueMachine;
  const normalizedWeightProductData = useMemo(
    () => normalizeWeightProductData(weightProductData, {
      variants: draft.variants,
      baseSku: sideSettings.sku || draft.variants[0]?.sku || 'SKU'
    }),
    [draft.variants, sideSettings.sku, weightProductData]
  );
  const weightLocalDefaultVariantId = useMemo(() => {
    const configuredDefaultId = draft.defaultVariantId;
    if (!configuredDefaultId) return null;
    return normalizedWeightProductData.variants.find(
      (variant) => variant.id === configuredDefaultId
    )?.id ?? null;
  }, [draft.defaultVariantId, normalizedWeightProductData.variants]);
  const selectDefaultWeightVariant = useCallback((weightVariantId: string | null) => {
    setDraft((current) =>
      current.defaultVariantId === weightVariantId
        ? current
        : { ...current, defaultVariantId: weightVariantId }
    );
  }, []);
  const simulatorOptions = useMemo<SimulatorOption[]>(() => {
    if (productType === 'dimensions') return getDimensionSimulatorOptions(draft.variants);
    if (productType === 'weight') return getWeightSimulatorOptions(weightProductData);
    if (productType === 'unique_machine') return getMachineSimulatorOptions(machineProductData, draft.name || 'Stroj / unikaten artikel');
    return getSimpleSimulatorOptions(
      simpleProductData,
      draft.name || 'Osnovni artikel',
      sideSettings.sku || draft.variants[0]?.sku || ''
    );
  }, [draft.name, draft.variants, machineProductData, productType, sideSettings.sku, simpleProductData, weightProductData]);

  const decimalDraftKey = (variantId: string, field: string) => `${variantId}:${field}`;

  useEffect(() => {
    setCurrentUpdatedAt(initialData?.updatedAt ?? null);
  }, [initialData?.id, initialData?.updatedAt]);

  useEffect(() => {
    setDraft((current) => ({ ...current, category: selectedCategoryPath.join(' / ') }));
  }, [selectedCategoryPath]);

  useEffect(() => {
    if (!videoDraft) {
      if (videoAssignedVariantId !== null) setVideoAssignedVariantId(null);
      if (videoMoveMode) setVideoMoveMode(false);
      return;
    }
    if (!draft.variants.length) {
      if (videoAssignedVariantId !== null) setVideoAssignedVariantId(null);
      return;
    }
    const hasAssignedVariant = videoAssignedVariantId
      ? draft.variants.some((variant) => variant.id === videoAssignedVariantId)
      : false;
    if (!hasAssignedVariant) {
      setVideoAssignedVariantId(draft.variants[0].id);
    }
  }, [draft.variants, videoAssignedVariantId, videoDraft, videoMoveMode]);

  useEffect(() => {
    if (simulatorOptions.length === 0) {
      if (simulatorVariantId) setSimulatorVariantId('');
      return;
    }
    if (!simulatorOptions.some((option) => option.id === simulatorVariantId)) {
      setSimulatorVariantId(simulatorOptions[0].id);
    }
  }, [simulatorOptions, simulatorVariantId]);

  useEffect(() => {
    setExpandedDimensionVariantId((current) => {
      if (current && draft.variants.some((variant) => variant.id === current)) return current;
      return draft.defaultVariantId ?? draft.variants[0]?.id ?? null;
    });
  }, [draft.defaultVariantId, draft.variants]);

  useEffect(() => {
    let cancelled = false;

    const hydrateCategoryTree = async () => {
      try {
        const response = await fetch('/api/admin/categories/paths', { cache: 'no-store' });
        if (!response.ok) return;
        const payload = (await response.json()) as { paths?: string[] };
        const apiPaths = Array.isArray(payload.paths) ? payload.paths : [];
        const mergedPaths = Array.from(new Set([...categoryPathsFromSeed, ...apiPaths]));
        if (!cancelled) setCategoryPaths(mergedPaths);
      } catch {
        if (!cancelled) setCategoryPaths(categoryPathsFromSeed);
      }
    };

    void hydrateCategoryTree();
    return () => {
      cancelled = true;
    };
  }, [categoryPathsFromSeed]);

  const selectCategoryPath = (path: string[]) => {
    setSelectedCategoryPath(path);
  };

  const buildPersistedState = useCallback((nextDraft: ProductFamily): EditorPersistedState => (
    {
      draft: {
        ...nextDraft,
        category: selectedCategoryPath.join(' / '),
        optionAxes: cloneOptionAxes(nextDraft.optionAxes),
        variants: nextDraft.variants.map(cloneVariant)
      },
      productType,
      typeSpecificData: cloneTypeSpecificData(typeSpecificData),
      appearanceOverride: appearanceOverride
        ? JSON.parse(JSON.stringify(appearanceOverride)) as CatalogItemAppearanceOverride
        : null,
      sideSettings: cloneSideSettings(sideSettings),
      documents: documents.map(cloneDocument),
      quantityDiscounts: quantityDiscounts.map(cloneQuantityDiscountDraft),
      itemLevelNote,
      mediaImages: mediaImageSlots.map(cloneMediaImage),
      video: cloneVideo(videoDraft),
      variantTags: { ...variantTags },
      selectedCategoryPath: [...selectedCategoryPath],
      videoAssignedVariantId
    }
  ), [appearanceOverride, documents, itemLevelNote, mediaImageSlots, productType, quantityDiscounts, selectedCategoryPath, sideSettings, typeSpecificData, variantTags, videoAssignedVariantId, videoDraft]);

  const currentPersistedState = useMemo<EditorPersistedState>(() => buildPersistedState(draft), [buildPersistedState, draft]);
  const buildSaveReadyPersistedState = useCallback((state: EditorPersistedState): EditorPersistedState => {
    const baseSku = state.sideSettings.sku || state.draft.variants[0]?.sku || toSlug(state.draft.name || 'artikel').toUpperCase();
    let variants = state.draft.variants.map(cloneVariant);
    let typeSpecificData = cloneTypeSpecificData(state.typeSpecificData);
    if (state.productType === 'simple') {
      variants = buildSimpleCatalogVariants(
        normalizeSimpleProductData(typeSpecificData.simple, { variants, baseSku }),
        variants[0],
        baseSku,
        state.draft.name
      );
    } else if (state.productType === 'weight') {
      const weightData = normalizeWeightProductData(typeSpecificData.weight, { variants, baseSku });
      typeSpecificData = {
        ...typeSpecificData,
        weight: weightData
      };
      variants = buildWeightCatalogVariants(
        weightData,
        baseSku
      );
    } else if (state.productType === 'unique_machine') {
      variants = buildMachineCatalogVariants(
        normalizeUniqueMachineProductData(typeSpecificData.uniqueMachine, { variants, baseSku }),
        variants[0],
        baseSku,
        state.draft.name
      );
    }
    const originalVariantById = new Map(state.draft.variants.map((variant) => [variant.id, variant]));
    variants = variants.map((variant) => {
      const original = originalVariantById.get(variant.id);
      return original
        ? {
            ...variant,
            costNet: original.costNet ?? null,
            contentOverride: original.contentOverride ?? null,
            optionValueIds: [...(original.optionValueIds ?? [])],
            optionSelections: { ...(original.optionSelections ?? {}) }
          }
        : variant;
    });
    return {
      ...state,
      typeSpecificData,
      draft: {
        ...state.draft,
        variants
      }
    };
  }, []);
  const currentUndoSnapshot = useMemo<EditorUndoSnapshot>(() => ({
    persistedState: cloneEditorPersistedState(currentPersistedState),
    decimalDrafts: { ...decimalInputDrafts }
  }), [currentPersistedState, decimalInputDrafts]);

  const savedSnapshotKey = useMemo(() => serializeEditorPersistedState(savedSnapshot, {}), [savedSnapshot]);
  const currentSnapshotKey = useMemo(
    () => serializeEditorPersistedState(currentPersistedState, decimalInputDrafts),
    [currentPersistedState, decimalInputDrafts]
  );

  const clearUndoHistory = useCallback(() => {
    undoHistoryRef.current = [];
    activeTextUndoSessionRef.current = null;
    pendingTextUndoCommitRef.current = null;
    pendingTextUndoStartRef.current = null;
    resumeTextUndoSessionRef.current = null;
    setUndoDepth(0);
  }, []);

  const appendUndoHistoryEntry = useCallback((snapshot: EditorUndoSnapshot, snapshotKey: string) => {
    if (snapshotKey === currentSnapshotKey) return;
    const nextHistory = [...undoHistoryRef.current, cloneEditorUndoSnapshot(snapshot)];
    undoHistoryRef.current = nextHistory.slice(-UNDO_HISTORY_LIMIT);
    setUndoDepth(undoHistoryRef.current.length);
  }, [currentSnapshotKey]);

  const commitPendingTextUndoSession = useCallback(() => {
    const pendingSession = pendingTextUndoCommitRef.current;
    if (!pendingSession) return;

    pendingTextUndoCommitRef.current = null;
    appendUndoHistoryEntry(pendingSession.snapshot, pendingSession.snapshotKey);

    suppressUndoTrackingRef.current = false;
    lastTrackedUndoSnapshotRef.current = {
      key: currentSnapshotKey,
      snapshot: cloneEditorUndoSnapshot(currentUndoSnapshot)
    };
  }, [appendUndoHistoryEntry, currentSnapshotKey, currentUndoSnapshot]);

  const startTextUndoSession = useCallback((element: HTMLElement) => {
    activeTextUndoSessionRef.current = {
      element,
      snapshot: cloneEditorUndoSnapshot(currentUndoSnapshot),
      snapshotKey: currentSnapshotKey
    };
  }, [currentSnapshotKey, currentUndoSnapshot]);

  const commitUndoBoundaryForSelectionChange = useCallback(() => {
    if (pendingTextUndoCommitRef.current) {
      commitPendingTextUndoSession();
    }

    const activeSession = activeTextUndoSessionRef.current;
    if (!activeSession) return;

    activeTextUndoSessionRef.current = null;
    resumeTextUndoSessionRef.current = activeSession.element.isConnected ? activeSession.element : null;
    appendUndoHistoryEntry(activeSession.snapshot, activeSession.snapshotKey);

    suppressUndoTrackingRef.current = false;
    lastTrackedUndoSnapshotRef.current = {
      key: currentSnapshotKey,
      snapshot: cloneEditorUndoSnapshot(currentUndoSnapshot)
    };
  }, [appendUndoHistoryEntry, commitPendingTextUndoSession, currentSnapshotKey, currentUndoSnapshot]);

  useEffect(() => {
    if (pendingTextUndoCommitRef.current) {
      commitPendingTextUndoSession();
    }

    if (editorMode !== 'edit') {
      pendingTextUndoStartRef.current = null;
      activeTextUndoSessionRef.current = null;
      return;
    }

    const pendingStart = pendingTextUndoStartRef.current;
    if (!pendingStart) return;
    pendingTextUndoStartRef.current = null;
    startTextUndoSession(pendingStart);
  }, [commitPendingTextUndoSession, editorMode, startTextUndoSession, textUndoSessionRevision]);

  useEffect(() => {
    const previous = lastTrackedUndoSnapshotRef.current;
    if (!previous) {
      lastTrackedUndoSnapshotRef.current = {
        key: currentSnapshotKey,
        snapshot: cloneEditorUndoSnapshot(currentUndoSnapshot)
      };
      return;
    }

    if (previous.key === currentSnapshotKey) return;
    if (activeTextUndoSessionRef.current || pendingTextUndoCommitRef.current || pendingTextUndoStartRef.current) return;

    if (editorMode === 'edit' && !suppressUndoTrackingRef.current) {
      const nextHistory = [...undoHistoryRef.current, cloneEditorUndoSnapshot(previous.snapshot)];
      undoHistoryRef.current = nextHistory.slice(-UNDO_HISTORY_LIMIT);
      setUndoDepth(undoHistoryRef.current.length);
    }

    suppressUndoTrackingRef.current = false;
    lastTrackedUndoSnapshotRef.current = {
      key: currentSnapshotKey,
      snapshot: cloneEditorUndoSnapshot(currentUndoSnapshot)
    };

    const resumeElement = resumeTextUndoSessionRef.current;
    if (!resumeElement) return;

    const activeElement = typeof document !== 'undefined' ? document.activeElement : null;
    if (resumeElement.isConnected && activeElement instanceof Node && (resumeElement === activeElement || resumeElement.contains(activeElement))) {
      activeTextUndoSessionRef.current = {
        element: resumeElement,
        snapshot: cloneEditorUndoSnapshot(currentUndoSnapshot),
        snapshotKey: currentSnapshotKey
      };
    }
    resumeTextUndoSessionRef.current = null;
  }, [currentSnapshotKey, currentUndoSnapshot, editorMode]);

  const applyUndoSnapshot = useCallback((snapshot: EditorUndoSnapshot) => {
    suppressUndoTrackingRef.current = true;
    activeTextUndoSessionRef.current = null;
    pendingTextUndoCommitRef.current = null;
    pendingTextUndoStartRef.current = null;
    resumeTextUndoSessionRef.current = null;
    setDraft({
      ...snapshot.persistedState.draft,
      optionAxes: cloneOptionAxes(snapshot.persistedState.draft.optionAxes),
      variants: snapshot.persistedState.draft.variants.map(cloneVariant)
    });
    setProductType(snapshot.persistedState.productType);
    setTypeSpecificData(cloneTypeSpecificData(snapshot.persistedState.typeSpecificData));
    setAppearanceOverride(
      snapshot.persistedState.appearanceOverride
        ? JSON.parse(JSON.stringify(snapshot.persistedState.appearanceOverride)) as CatalogItemAppearanceOverride
        : null
    );
    setSideSettings(cloneSideSettings(snapshot.persistedState.sideSettings));
    setDocuments(snapshot.persistedState.documents.map(cloneDocument));
    setQuantityDiscounts(snapshot.persistedState.quantityDiscounts.map(cloneQuantityDiscountDraft));
    setItemLevelNote(snapshot.persistedState.itemLevelNote);
    setMediaImageSlots(snapshot.persistedState.mediaImages.map(cloneMediaImage));
    setVideoDraft(cloneVideo(snapshot.persistedState.video));
    setVariantTags({ ...snapshot.persistedState.variantTags });
    setSelectedCategoryPath([...snapshot.persistedState.selectedCategoryPath]);
    setVideoAssignedVariantId(snapshot.persistedState.videoAssignedVariantId);
    setDecimalInputDrafts({ ...snapshot.decimalDrafts });
    setVariantSelections(new Set());
    setEditingImageSlot(null);
    setYoutubeInput('');
    setVideoMoveMode(false);
    setPendingSaveConfirmation(null);
    setPendingProductTypeChange(null);
  }, []);

  const handleUndoTrackedFieldFocus = useCallback((event: ReactFocusEvent<HTMLDivElement>) => {
    if (editorMode !== 'edit') return;
    if (!isUndoTrackedTextField(event.target)) return;

    if (pendingTextUndoCommitRef.current) {
      pendingTextUndoStartRef.current = event.target;
      return;
    }

    const activeSession = activeTextUndoSessionRef.current;
    if (activeSession?.element === event.target) return;
    startTextUndoSession(event.target);
  }, [editorMode, startTextUndoSession]);

  const handleUndoTrackedFieldBlur = useCallback((event: ReactFocusEvent<HTMLDivElement>) => {
    if (!isUndoTrackedTextField(event.target)) return;

    const activeSession = activeTextUndoSessionRef.current;
    if (!activeSession || activeSession.element !== event.target) return;
    if (event.relatedTarget instanceof HTMLElement && activeSession.element.contains(event.relatedTarget)) return;

    activeTextUndoSessionRef.current = null;
    pendingTextUndoCommitRef.current = activeSession;
    pendingTextUndoStartRef.current = isUndoTrackedTextField(event.relatedTarget) ? event.relatedTarget : null;
    setTextUndoSessionRevision((current) => current + 1);
  }, []);

  const applySelectionChange = useCallback((apply: () => void) => {
    commitUndoBoundaryForSelectionChange();
    apply();
  }, [commitUndoBoundaryForSelectionChange]);

  const restoreSavedSnapshot = useCallback(() => {
    applyUndoSnapshot({
      persistedState: cloneEditorPersistedState(savedSnapshot),
      decimalDrafts: {}
    });
    clearUndoHistory();
  }, [applyUndoSnapshot, clearUndoHistory, savedSnapshot]);

  const isEditable = editorMode === 'edit';
  const hasUnsavedChanges = currentSnapshotKey !== savedSnapshotKey;
  const isTableEditable = isEditable;
  const isMediaEditable = isEditable;
  const isDimensionBasedMode = productType === 'dimensions';
  const configuredDefaultVariant = draft.variants.find((variant) => variant.id === draft.defaultVariantId);
  const resolvedDefaultVariantId = configuredDefaultVariant?.active
    ? configuredDefaultVariant.id
    : findFirstActiveVariant(draft.variants)?.id ?? null;
  const applyProductTypeChange = useCallback((nextProductType: ProductEditorType) => {
    setProductType(nextProductType);
    setSimulatorVariantId('');
    setPendingProductTypeChange(null);
    setIsProductTypeSelectionConfirmed(false);
    setIsProductTypeSelectorExpanded(true);
  }, []);
  const changeProductType = (nextProductType: ProductEditorType) => {
    if (!isEditable || nextProductType === productType) return;
    if (mode !== 'create' && hasUnsavedChanges) {
      setPendingProductTypeChange(nextProductType);
      return;
    }
    applyProductTypeChange(nextProductType);
  };
  const shouldCollapseProductTypeSelector = isProductTypeSelectionConfirmed && !isProductTypeSelectorExpanded;
  const expandProductTypeSelector = () => {
    if (isSaving) return;
    if (editorMode === 'read') {
      clearUndoHistory();
      setEditorMode('edit');
    }
    setIsProductTypeSelectorExpanded(true);
  };
  const updateSimpleProductData = (nextData: typeof simpleProductData) => {
    setTypeSpecificData((current) => ({ ...current, simple: nextData }));
  };
  const updateWeightProductData = (nextData: typeof weightProductData) => {
    setTypeSpecificData((current) => ({ ...current, weight: nextData }));
  };
  const updateMachineProductData = (nextData: typeof machineProductData) => {
    setTypeSpecificData((current) => ({ ...current, uniqueMachine: nextData }));
  };
  const isToleranceLocked = false;
  const isDimensionLockActive = false;
  const isThicknessLockActive = false;
  const isGeneratorLocked = !isTableEditable;
  const identityItemId = initialData?.id ?? null;
  const nameAvailability = useCatalogItemIdentityAvailability({
    field: 'name',
    value: draft.name,
    itemId: identityItemId,
    enabled: isEditable
  });
  const skuAvailability = useCatalogItemIdentityAvailability({
    field: 'sku',
    value: sideSettings.sku,
    itemId: identityItemId,
    enabled: isEditable && sideSettings.sku.trim().length > 0
  });
  const slugAvailability = useCatalogItemIdentityAvailability({
    field: 'slug',
    value: draft.slug || toSlug(draft.name.trim()),
    itemId: identityItemId,
    enabled: isEditable && (draft.slug.trim().length > 0 || draft.name.trim().length > 0)
  });
  const identityValidationMessages = [
    getCatalogItemIdentityMessage('name', nameAvailability),
    getCatalogItemIdentityMessage('sku', skuAvailability),
    getCatalogItemIdentityMessage('slug', slugAvailability)
  ].filter((message): message is string => Boolean(message));
  const hasIdentityConflict =
    (nameAvailability.status === 'ready' && !nameAvailability.isAvailable) ||
    (skuAvailability.status === 'ready' && !skuAvailability.isAvailable) ||
    (slugAvailability.status === 'ready' && !slugAvailability.isAvailable);
  const hasSelectedVariants = variantSelections.size > 0;
  const allVariantsSelected = draft.variants.length > 0 && draft.variants.every((variant) => variantSelections.has(variant.id));
  const canUndoStagedChanges = isEditable && !isSaving && pendingSaveConfirmation === null && undoDepth > 0;
  const generatorDimensionLabels: Record<GeneratorDimension, string> = {
    length: 'Dolžina',
    width: 'Širina',
    thickness: 'Debelina/fi'
  };
  const generatorByDimension = useMemo(() => {
    const map = new Map<GeneratorDimension, number[]>();
    generatorChips.forEach((chip) => {
      map.set(chip.dimension, chip.values);
    });
    return map;
  }, [generatorChips]);
  const combinationCount = useMemo(() => {
    const lengths = generatorByDimension.get('length') ?? [];
    const widths = generatorByDimension.get('width') ?? [];
    const thicknesses = generatorByDimension.get('thickness') ?? [];
    if (lengths.length === 0 || thicknesses.length === 0) return 0;

    const widthValues: Array<number | null> = widths.length > 0 ? widths : [null];
    const lengthWidthCount = widthValues.reduce<number>(
      (total, width) => total + lengths.filter((length) => shouldGenerateDimensionPair(length, width)).length,
      0
    );
    return lengthWidthCount * thicknesses.length;
  }, [generatorByDimension]);

  const commitPendingDecimalDrafts = useCallback(() => {
    if (Object.keys(decimalInputDrafts).length === 0) return { nextDraft: draft };

    const fieldConfigs: Record<string, { emptyFallback: number | null; apply: (value: number | null) => Partial<Variant> }> = {
      length: { emptyFallback: null, apply: (value) => ({ length: value }) },
      width: { emptyFallback: null, apply: (value) => ({ width: value }) },
      thickness: { emptyFallback: null, apply: (value) => ({ thickness: value }) },
      weight: {
        emptyFallback: null,
        apply: (value) => ({
          weight: productType === 'dimensions'
            ? catalogWeightDisplayGramsToKilograms(value)
            : value
        })
      },
      costNet: { emptyFallback: null, apply: (value) => ({ costNet: value === null ? null : Math.max(0, value) }) },
      price: { emptyFallback: 0, apply: (value) => ({ price: value ?? 0 }) },
      discountPct: { emptyFallback: 0, apply: (value) => ({ discountPct: Math.min(99.9, Math.max(0, value ?? 0)) }) }
    };

    let changed = false;
    let invalidFieldLabel = '';

    const nextVariants = draft.variants.map((variant) => {
      let nextVariant = variant;

      for (const [key, raw] of Object.entries(decimalInputDrafts)) {
        const [variantId, field] = key.split(':');
        if (variantId !== variant.id) continue;

        const trimmed = raw.trim();
        if (field === 'errorTolerance') {
          const parsed = trimmed ? parseDecimalInput(trimmed) : null;
          if (trimmed && parsed === null) {
            invalidFieldLabel = 'toleranca';
            return variant;
          }
          const nextValue = parsed === null ? null : formatDecimalForDisplay(parsed);
          if (nextVariant.errorTolerance !== nextValue) {
            nextVariant = { ...nextVariant, errorTolerance: nextValue };
            changed = true;
          }
          continue;
        }
        if (field === 'deliveryTime') {
          const deliveryTime = formatDeliveryTimeFromAmount(trimmed);
          const contentOverride = { ...(nextVariant.contentOverride ?? {}) };
          if (deliveryTime) contentOverride.deliveryEstimate = deliveryTime;
          else delete contentOverride.deliveryEstimate;
          const nextContentOverride = Object.keys(contentOverride).length > 0 ? contentOverride : null;
          if (JSON.stringify(nextVariant.contentOverride ?? null) !== JSON.stringify(nextContentOverride)) {
            nextVariant = { ...nextVariant, contentOverride: nextContentOverride };
            changed = true;
          }
          continue;
        }

        const fieldConfig = fieldConfigs[field];
        if (!fieldConfig) continue;
        if (!trimmed) {
          nextVariant = { ...nextVariant, ...fieldConfig.apply(fieldConfig.emptyFallback) };
          changed = true;
          continue;
        }

        const parsed = parseDecimalInput(trimmed);
        if (parsed === null) {
          invalidFieldLabel = field;
          return variant;
        }

        nextVariant = { ...nextVariant, ...fieldConfig.apply(parsed) };
        changed = true;
      }

      return nextVariant;
    });

    if (invalidFieldLabel) {
      return { nextDraft: draft, error: `Preverite vrednost v polju ${invalidFieldLabel}.` };
    }

    return {
      nextDraft: changed ? { ...draft, variants: nextVariants } : draft
    };
  }, [decimalInputDrafts, draft, productType]);

  const performSave = async (preparedState: EditorPersistedState) => {
    const nextDraft = preparedState.draft;
    const physicalMeasurementsValidation = validateEditorPhysicalMeasurements(preparedState);
    if (!physicalMeasurementsValidation.ok) {
      setEditorTab('sales');
      toast.error(physicalMeasurementsValidation.message);
      window.requestAnimationFrame(() => {
        document.getElementById('product-measurements')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
      return;
    }

    if (!nextDraft.name.trim()) {
      toast.error('Naziv je obvezen.');
      return;
    }
    if (!nextDraft.category.trim() || preparedState.selectedCategoryPath.length === 0) {
      toast.error('Kategorija je obvezna.');
      return;
    }
    if (!isEditable || saveInFlightRef.current) return;

    suppressUndoTrackingRef.current = true;
    setDraft({
      ...nextDraft,
      optionAxes: cloneOptionAxes(nextDraft.optionAxes),
      variants: nextDraft.variants.map(cloneVariant)
    });
    setProductType(preparedState.productType);
    setTypeSpecificData(cloneTypeSpecificData(preparedState.typeSpecificData));
    setAppearanceOverride(
      preparedState.appearanceOverride
        ? JSON.parse(JSON.stringify(preparedState.appearanceOverride)) as CatalogItemAppearanceOverride
        : null
    );
    setSideSettings(cloneSideSettings(preparedState.sideSettings));
    setDocuments(preparedState.documents.map(cloneDocument));
    setQuantityDiscounts(preparedState.quantityDiscounts.map(cloneQuantityDiscountDraft));
    setItemLevelNote(preparedState.itemLevelNote);
    setMediaImageSlots(preparedState.mediaImages.map(cloneMediaImage));
    setVideoDraft(cloneVideo(preparedState.video));
    setVariantTags({ ...preparedState.variantTags });
    setSelectedCategoryPath([...preparedState.selectedCategoryPath]);
    setVideoAssignedVariantId(preparedState.videoAssignedVariantId);
    if (Object.keys(decimalInputDrafts).length > 0) {
      setDecimalInputDrafts({});
    }

    const nextSlug = nextDraft.slug.trim() || toSlug(nextDraft.name.trim());
    const localImageUrlsToRevoke = preparedState.mediaImages
      .filter((slot) => slot.file && slot.previewUrl.startsWith('blob:'))
      .map((slot) => slot.previewUrl);
    const localVideoUrlsToRevoke =
      preparedState.video?.file && preparedState.video.previewUrl.startsWith('blob:') ? [preparedState.video.previewUrl] : [];

    saveInFlightRef.current = true;
    setIsSaving(true);

    try {
      const uploadedImages = await Promise.all(
        preparedState.mediaImages.map(async (slot) => {
          if (!slot.file) return slot;
          const uploaded = await uploadMediaFile(slot.file, 'image');
          return {
            ...slot,
            previewUrl: uploaded.url,
            uploadedUrl: uploaded.url,
            blobPathname: uploaded.pathname,
            file: null,
            filename: uploaded.filename ?? slot.filename,
            mimeType: uploaded.mimeType ?? slot.mimeType,
            localId: null
          } satisfies StagedImageSlot;
        })
      );

      const uploadedVideo = preparedState.video
        ? await (async () => {
            if (preparedState.video?.source === 'youtube' || !preparedState.video?.file) return preparedState.video;
            const uploaded = await uploadMediaFile(preparedState.video.file, 'video');
            return {
              ...preparedState.video,
              previewUrl: uploaded.url,
              uploadedUrl: uploaded.url,
              blobPathname: uploaded.pathname,
              label: uploaded.filename ?? preparedState.video.label,
              file: null,
              mimeType: uploaded.mimeType ?? preparedState.video.mimeType,
              localId: null
            } satisfies StagedVideoState;
          })()
        : null;

      const uploadedDocuments = await Promise.all(
        preparedState.documents.map(async (documentEntry) => {
          if (!documentEntry.file) return documentEntry;
          const uploaded = await uploadMediaFile(documentEntry.file, 'document');
          return {
            ...documentEntry,
            name: uploaded.filename ?? documentEntry.name,
            blobUrl: uploaded.url,
            blobPathname: uploaded.pathname,
            file: null,
            mimeType: uploaded.mimeType ?? documentEntry.mimeType,
            localId: null
          } satisfies StagedTechnicalDocument;
        })
      );

      const persistableQuantityDiscounts = getPersistableQuantityDiscounts(
        preparedState.quantityDiscounts,
        Boolean(initialData?.quantityDiscounts.length)
      );

      const payload: CatalogItemEditorPayload = {
        id: initialData?.id,
        expectedUpdatedAt: initialData?.id ? currentUpdatedAt ?? undefined : undefined,
        itemName: nextDraft.name.trim(),
        itemType: mapProductTypeToCatalogItemType(preparedState.productType),
        productType: preparedState.productType,
        typeSpecificData: preparedState.typeSpecificData,
        badge: preparedState.itemLevelNote || null,
        status: nextDraft.active ? 'active' : 'inactive',
        categoryPath: preparedState.selectedCategoryPath,
        sku: preparedState.sideSettings.sku || nextDraft.variants[0]?.sku || null,
        slug: nextSlug,
        unit: null,
        brand: preparedState.sideSettings.brand || null,
        material: preparedState.sideSettings.material || null,
        colour: preparedState.sideSettings.color || null,
        shape: preparedState.sideSettings.surface || null,
        description: nextDraft.description || '',
        adminNotes: initialData?.adminNotes ?? null,
        position: nextDraft.sort ?? 0,
        taxRate: Math.min(
          1,
          Math.max(0, (parseDecimalInput(preparedState.sideSettings.taxRatePercent) ?? 22) / 100)
        ),
        appearanceOverride: preparedState.appearanceOverride,
        defaultVariantId:
          nextDraft.defaultVariantId != null
          && /^\d+$/.test(nextDraft.defaultVariantId)
            ? Number(nextDraft.defaultVariantId)
            : null,
        defaultVariantIndex: Math.max(
          0,
          nextDraft.defaultVariantId == null
            ? 0
            : nextDraft.variants.findIndex((variant) => variant.id === nextDraft.defaultVariantId)
        ),
        optionAxes: nextDraft.optionAxes.map((axis, axisIndex) => ({
          id: /^\d+$/.test(axis.id) ? Number(axis.id) : undefined,
          name: axis.name.trim(),
          slug: axis.slug.trim(),
          position: axisIndex,
          values: axis.values.map((value, valueIndex) => ({
            id: /^\d+$/.test(value.id) ? Number(value.id) : undefined,
            value: value.value.trim(),
            slug: value.slug.trim(),
            swatch: value.swatch || null,
            position: valueIndex
          }))
        })),
        variants: nextDraft.variants.map((variant, index) => {
          const optionValueIds: number[] = [];
          const optionSelections: Record<string, string> = {};
          for (const axis of nextDraft.optionAxes) {
            const selectedValueId = variant.optionSelections?.[axis.id];
            const selectedValue = axis.values.find((value) => value.id === selectedValueId);
            if (!selectedValue) continue;
            if (/^\d+$/.test(selectedValue.id)) optionValueIds.push(Number(selectedValue.id));
            optionSelections[axis.slug] = selectedValue.slug;
          }
          return {
            id: /^\d+$/.test(variant.id) ? Number(variant.id) : undefined,
            variantName: preparedState.productType === 'dimensions'
              ? buildPersistedVariantName({
                  ...variant,
                  weight: variant.weight ?? null
                }, {
                  baseName: nextDraft.name,
                  variantCount: nextDraft.variants.length,
                  index
                })
              : nextDraft.variants.length === 1
                ? nextDraft.name.trim()
                : variant.label.trim() || `Različica ${index + 1}`,
            length: variant.length,
            width: variant.width,
            thickness: variant.thickness,
            weight: variant.weight ?? null,
            errorTolerance: (variant.errorTolerance ?? preparedState.sideSettings.thicknessTolerance) || null,
            price: variant.price,
            costNet: variant.costNet ?? null,
            contentOverride: variant.contentOverride ?? null,
            discountPct: variant.discountPct,
            inventory: variant.stock,
            minOrder: Math.max(1, variant.minOrder ?? Number(preparedState.sideSettings.moq || 1)),
            variantSku: variant.sku || null,
            unit: null,
            status: variant.active ? 'active' : 'inactive',
            badge: preparedState.variantTags[variant.id] ?? (normalizeVariantTag(variant.badge) || null),
            position: index + 1,
            imageAssignments: variant.imageAssignments ?? [],
            optionValueIds,
            optionSelections
          };
        }),
        quantityDiscounts: persistableQuantityDiscounts.map((rule, index) => ({
          id: rule.persistedId ?? undefined,
          minQuantity: Math.max(1, Math.floor(rule.minQuantity)),
          discountPercent: Math.min(100, Math.max(0, rule.discountPercent)),
          appliesTo: serializeQuantityDiscountTargets(rule),
          note: rule.note.trim() || null,
          position: index
        })),
        media: [
          ...uploadedImages.map((entry, index) => ({
            id: entry.persistedId ?? undefined,
            mediaKind: 'image' as const,
            role: 'gallery' as const,
            sourceKind: 'upload' as const,
            blobUrl: entry.uploadedUrl,
            blobPathname: entry.blobPathname,
            filename: entry.filename,
            mimeType: entry.mimeType,
            imageDimensions: entry.imageDimensions,
            altText: entry.altText || null,
            position: index
          })),
          ...(uploadedVideo
            ? [
                {
                  id: uploadedVideo.persistedId ?? undefined,
                  mediaKind: 'video' as const,
                  role: 'gallery' as const,
                  sourceKind: uploadedVideo.source === 'youtube' ? ('youtube' as const) : ('upload' as const),
                  externalUrl: uploadedVideo.source === 'youtube' ? uploadedVideo.previewUrl : null,
                  blobUrl: uploadedVideo.source === 'upload' ? uploadedVideo.uploadedUrl : null,
                  blobPathname: uploadedVideo.source === 'upload' ? uploadedVideo.blobPathname ?? null : null,
                  filename: uploadedVideo.label,
                  videoType: uploadedVideo.source,
                  variantIndex: preparedState.videoAssignedVariantId
                    ? Math.max(0, nextDraft.variants.findIndex((variant) => variant.id === preparedState.videoAssignedVariantId))
                    : null,
                  position: 0
                }
              ]
            : []),
          ...uploadedDocuments.map((documentEntry, index) => ({
            id: /^\d+$/.test(documentEntry.id) ? Number(documentEntry.id) : undefined,
            mediaKind: 'document' as const,
            role: 'technical_sheet' as const,
            sourceKind: 'upload' as const,
            filename: documentEntry.name,
            blobUrl: documentEntry.blobUrl,
            blobPathname: documentEntry.blobPathname,
            position: index
          }))
        ]
      };

      const body = await saveCatalogItemPayload(payload);
      if (body.updatedAt) setCurrentUpdatedAt(body.updatedAt);
      localImageUrlsToRevoke.forEach(revokeLocalImageUrl);
      localVideoUrlsToRevoke.forEach(revokeLocalImageUrl);

      const canonicalDraft: ProductFamily = {
        ...nextDraft,
        slug: body.slug ?? nextSlug,
        category: preparedState.selectedCategoryPath.join(' / ')
      };
      const canonicalSnapshot: EditorPersistedState = {
        draft: {
          ...canonicalDraft,
          optionAxes: cloneOptionAxes(canonicalDraft.optionAxes),
          variants: canonicalDraft.variants.map(cloneVariant)
        },
        productType: preparedState.productType,
        typeSpecificData: cloneTypeSpecificData(preparedState.typeSpecificData),
        appearanceOverride: preparedState.appearanceOverride
          ? JSON.parse(JSON.stringify(preparedState.appearanceOverride)) as CatalogItemAppearanceOverride
          : null,
        sideSettings: cloneSideSettings(preparedState.sideSettings),
        documents: uploadedDocuments.map(cloneDocument),
        quantityDiscounts: preparedState.quantityDiscounts.map(cloneQuantityDiscountDraft),
        itemLevelNote: preparedState.itemLevelNote,
        mediaImages: uploadedImages.map(cloneMediaImage),
        video: cloneVideo(uploadedVideo),
        variantTags: { ...preparedState.variantTags },
        selectedCategoryPath: [...preparedState.selectedCategoryPath],
        videoAssignedVariantId: preparedState.videoAssignedVariantId
      };

      suppressUndoTrackingRef.current = true;
      setDraft(canonicalDraft);
      setProductType(preparedState.productType);
      setTypeSpecificData(cloneTypeSpecificData(preparedState.typeSpecificData));
      setAppearanceOverride(
        preparedState.appearanceOverride
          ? JSON.parse(JSON.stringify(preparedState.appearanceOverride)) as CatalogItemAppearanceOverride
          : null
      );
      setSideSettings(cloneSideSettings(preparedState.sideSettings));
      setMediaImageSlots(uploadedImages.map(cloneMediaImage));
      setVideoDraft(cloneVideo(uploadedVideo));
      setDocuments(uploadedDocuments.map(cloneDocument));
      setQuantityDiscounts(preparedState.quantityDiscounts.map(cloneQuantityDiscountDraft));
      setItemLevelNote(preparedState.itemLevelNote);
      setVariantTags({ ...preparedState.variantTags });
      setSelectedCategoryPath([...preparedState.selectedCategoryPath]);
      setVideoAssignedVariantId(preparedState.videoAssignedVariantId);
      setSavedSnapshot(cloneEditorPersistedState(canonicalSnapshot));
      setIsProductTypeSelectionConfirmed(true);
      setIsProductTypeSelectorExpanded(false);
      clearUndoHistory();
      setEditorMode('read');
      toast.success('Artikel shranjen.');
      if (body.slug) {
        router.push(`/admin/artikli/${encodeURIComponent(body.slug)}`);
      }
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Shranjevanje artikla ni uspelo.');
    } finally {
      saveInFlightRef.current = false;
      setIsSaving(false);
    }
  };

  const save = async (..._args: unknown[]) => {
    commitPendingTextUndoSession();
    if (!draft.name.trim()) {
      toast.error('Naziv je obvezen.');
      return;
    }
    if (draft.active && (!draft.category.trim() || selectedCategoryPath.length === 0)) {
      toast.error('Za objavo je kategorija obvezna.');
      return;
    }
    if (hasIdentityConflict) {
      toast.error(identityValidationMessages[0] ?? 'Naziv, SKU ali URL je že uporabljen.');
      return;
    }
    if (!isEditable || !hasUnsavedChanges || isSaving) return;

    const decimalCommit = commitPendingDecimalDrafts();
    if (decimalCommit.error) {
      toast.error(decimalCommit.error);
      return;
    }

    const savedSaveReadySnapshot = cloneEditorPersistedState(buildSaveReadyPersistedState(savedSnapshot));
    const nextPersistedState = cloneEditorPersistedState(buildSaveReadyPersistedState(buildPersistedState(decimalCommit.nextDraft)));
    const physicalMeasurementsValidation = validateEditorPhysicalMeasurements(nextPersistedState);
    if (!physicalMeasurementsValidation.ok) {
      setEditorTab('sales');
      toast.error(physicalMeasurementsValidation.message);
      window.requestAnimationFrame(() => {
        document.getElementById('product-measurements')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
      return;
    }
    const computedChangeGroups = buildProposedSaveChanges(savedSaveReadySnapshot, nextPersistedState);
    const computedChangeCount = computedChangeGroups.reduce((count, group) => count + group.items.length, 0);
    const changeGroups =
      computedChangeCount > 0
        ? computedChangeGroups
        : [{ title: 'Spremembe', items: ['Trenutna verzija artikla bo shranjena.'] }];
    const changeCount = changeGroups.reduce((count, group) => count + group.items.length, 0);

    setPendingSaveConfirmation({
      nextPersistedState,
      changeGroups,
      changeCount
    });
  };

  const confirmSave = async () => {
    if (!pendingSaveConfirmation) return;
    const nextState = cloneEditorPersistedState(pendingSaveConfirmation.nextPersistedState);
    setPendingSaveConfirmation(null);
    await performSave(nextState);
  };

  const undoLastChange = () => {
    commitPendingTextUndoSession();
    const previous = undoHistoryRef.current.pop();
    if (!previous) return;
    setUndoDepth(undoHistoryRef.current.length);
    applyUndoSnapshot(cloneEditorUndoSnapshot(previous));
  };

  const archiveItem = async () => {
    const itemIdentifier = articleId || String(initialData?.id ?? '').trim() || draft.slug.trim();
    if (!itemIdentifier) {
      toast.error('Artikel nima veljavnega identifikatorja za brisanje.');
      return;
    }
    const shouldArchive = window.confirm(
      hasUnsavedChanges
        ? 'Artikel ima neshranjene spremembe, ki bodo izgubljene. Če nadaljujete, bo izbrisan in 90 dni shranjen v arhivu. Želite nadaljevati?'
        : 'Ali želite izbrisati ta artikel? Shranjen bo v arhivu 90 dni in v tem času ga lahko obnovite.'
    );
    if (!shouldArchive) return;

    try {
      const response = await fetch(`/api/admin/artikli/${encodeURIComponent(itemIdentifier)}`, { method: 'DELETE' });
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { message?: string };
        throw new Error(body.message || 'Brisanje artikla ni uspelo.');
      }
      toast.success('Artikel je izbrisan in premaknjen v 90-dnevni arhiv.');
      router.push('/admin/arhiv/artikli');
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Brisanje artikla ni uspelo.');
    }
  };

  const duplicateItem = async () => {
    const itemIdentifier = articleId || String(initialData?.id ?? '').trim() || draft.slug.trim();
    if (!itemIdentifier) {
      toast.error('Artikel nima veljavnega identifikatorja za kopiranje.');
      return;
    }

    setIsDuplicating(true);
    try {
      const response = await fetch('/api/admin/artikli/duplicate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ itemIdentifier })
      });
      const body = (await response.json().catch(() => ({}))) as CatalogItemQuickSaveResponse;
      if (!response.ok || !body.item) throw new Error(body.message || 'Kopiranje artikla ni uspelo.');

      const href = `/admin/artikli/${encodeURIComponent(body.item.slug || String(body.item.id))}`;
      toast.success(
        <span>
          Kopija artikla je ustvarjena.{' '}
          <a className="font-semibold underline underline-offset-2" href={href}>
            Uredi kopijo
          </a>
        </span>,
        { durationMs: 7000 }
      );
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Kopiranje artikla ni uspelo.');
    } finally {
      setIsDuplicating(false);
    }
  };

  const deleteItem = archiveItem;
  const canArchive = mode !== 'create' && Boolean(articleId || initialData?.id || draft.slug.trim()) && !isSaving;
  const canDuplicate = mode !== 'create' && Boolean(articleId || initialData?.id || draft.slug.trim()) && !isSaving && !isDuplicating;

  const discardEditorUnsavedChanges = () => {
    setIsDiscardUnsavedDialogOpen(false);
    restoreSavedSnapshot();
    setIsProductTypeSelectionConfirmed(mode !== 'create');
    setIsProductTypeSelectorExpanded(mode === 'create');
    setEditorMode('read');
    toast.success('Neshranjene spremembe so zavržene.');
  };

  const saveEditorUnsavedChanges = () => {
    setIsDiscardUnsavedDialogOpen(false);
    void save();
  };

  const handleEditModeToggle = () => {
    commitPendingTextUndoSession();
    if (editorMode === 'read') {
      clearUndoHistory();
      setEditorMode('edit');
      return;
    }
    if (!hasUnsavedChanges) {
      clearUndoHistory();
      setEditorMode('read');
      return;
    }
    setIsDiscardUnsavedDialogOpen(true);
  };

  const generateVariants = () => {
    if (!isTableEditable) return;
    const widths = generatorByDimension.get('width') ?? [];
    const lengths = generatorByDimension.get('length') ?? [];
    const thicknesses = generatorByDimension.get('thickness') ?? [];
    const shouldUseThickness = true;
    const thicknessValues = shouldUseThickness ? thicknesses : [0];

    if (lengths.length === 0 || (shouldUseThickness && thicknesses.length === 0)) {
      toast.error(shouldUseThickness ? 'Najprej dodajte Debelino/fi in Dolžino.' : 'Najprej dodajte Dolžino.');
      return;
    }

    const baseSku = sideSettings.sku.trim();
    const normalizedBaseForVariants = baseSku.replace(/-GEN$/i, '');
    const generatedByKey = new Map<string, DimensionInventoryOption>();
    const widthValues: Array<number | null> = widths.length > 0 ? widths : [null];

    widthValues.forEach((width) => lengths.forEach((length) => thicknessValues.forEach((thickness) => {
      if (!shouldGenerateDimensionPair(length, width)) return;
      const dimensions = {
        length,
        width,
        thickness
      };
      const key = getDimensionVariantKey(dimensions);
      if (!generatedByKey.has(key)) generatedByKey.set(key, dimensions);
    })));

    const generatedDimensions = Array.from(generatedByKey.values()).sort(compareGeneratedDimensionOptions);
    if (generatedDimensions.length === 0) {
      toast.error('Ni veljavnih kombinacij. Dolžina mora biti enaka ali večja od širine.');
      return;
    }

    setDraft((current) => {
      const existingByDimensionKey = new Map(
        current.variants
          .filter((variant) => getDimensionVariantKey(variant))
          .map((variant) => [getDimensionVariantKey(variant), variant])
      );
      const nextNewPosition = Math.max(0, ...current.variants.map((variant) => variant.sort || 0)) + 1;
      let newVariantIndex = 0;
      const generated = generatedDimensions.map((dimensions) => {
        const dimensionSuffix = shouldUseThickness
          ? [dimensions.thickness, dimensions.length, dimensions.width].map(formatDimensionKeyValue).filter(Boolean).join('x')
          : [dimensions.length, dimensions.width].map(formatDimensionKeyValue).filter(Boolean).join('x');
        const generatedSku = baseSku
          ? `${normalizedBaseForVariants}-${dimensionSuffix}`
          : shouldUseThickness
            ? `${toSlug(current.name || 'artikel').toUpperCase()}-${[dimensions.thickness, dimensions.length, dimensions.width].map(formatDimensionKeyValue).filter(Boolean).join('')}`
            : `${toSlug(current.name || 'artikel').toUpperCase()}-${[dimensions.length, dimensions.width].map(formatDimensionKeyValue).filter(Boolean).join('')}`;
        const existing = existingByDimensionKey.get(getDimensionVariantKey(dimensions));
        if (existing) {
          return {
            ...existing,
            label: formatDimensionInventoryLabel(dimensions),
            width: dimensions.width,
            length: dimensions.length,
            thickness: dimensions.thickness,
            sku: existing.skuAutoGenerated === false ? existing.sku : generatedSku,
            skuAutoGenerated: existing.skuAutoGenerated === false ? false : true
          };
        }
        const variant = createVariant({
          label: formatDimensionInventoryLabel(dimensions),
          width: dimensions.width,
          length: dimensions.length,
          thickness: dimensions.thickness,
          sku: generatedSku,
          skuAutoGenerated: true,
          price: 0,
          discountPct: current.defaultDiscountPct,
          sort: nextNewPosition + newVariantIndex
        });
        newVariantIndex += 1;
        return variant;
      });
      const orderedGenerated = generated
        .sort((left, right) => (left.sort ?? 0) - (right.sort ?? 0))
        .map((variant, index) => ({ ...variant, sort: index + 1 }));
      const retainedDefault = orderedGenerated.find(
        (variant) => variant.id === current.defaultVariantId && variant.active
      );
      return {
        ...current,
        defaultVariantId: retainedDefault?.id ?? findFirstActiveVariant(orderedGenerated)?.id ?? null,
        variants: orderedGenerated
      };
    });
    setVariantSelections(new Set());
  };

  useEffect(() => {
    const baseSku = sideSettings.sku.trim();
    if (!baseSku) return;
    setDraft((current) => {
      if (current.variants.length === 0) return current;
      if (current.variants.length === 1) {
        const variant = current.variants[0];
        if (variant.sku && variant.skuAutoGenerated === false) return current;
        if (variant.sku === baseSku) return current;
        return {
          ...current,
          variants: [{ ...variant, sku: baseSku, skuAutoGenerated: true }]
        };
      }
      const normalizedBaseForVariants = baseSku.replace(/-GEN$/i, '');
      let changed = false;
      const variants = current.variants.map((variant) => {
        if (variant.skuAutoGenerated === false) return variant;
        if (variant.length === null || variant.thickness === null) return variant;
        const dimensionSuffix = [variant.thickness, variant.length, variant.width].map(formatDimensionKeyValue).filter(Boolean).join('x');
        const nextSku = `${normalizedBaseForVariants}-${dimensionSuffix}`;
        if (variant.sku === nextSku && variant.skuAutoGenerated) return variant;
        changed = true;
        return { ...variant, sku: nextSku, skuAutoGenerated: true };
      });
      return changed ? { ...current, variants } : current;
    });
  }, [sideSettings.sku]);

  const parseGeneratorEntry = (value: string): { dimension: GeneratorDimension; values: number[] } | { error: string } => {
    const normalized = value.trim();
    if (!normalized) return { error: 'Vnos ne sme biti prazen.' };
    const match = normalized.match(/^(dolzina|dolžina|sirina|širina|debelina(?:\/fi)?|fi|d|s|š|v|h)\s*:?\s*(.+)$/i);
    if (!match) return { error: 'Uporabite Debelina/fi, Dolžina ali Širina + vrednosti.' };
    const prefix = match[1]
      .toLowerCase()
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '');
    const rawValues = (match[2] ?? '').trim().replace(/:/g, ',');
    if (!rawValues) return { error: 'Dodajte vsaj eno številčno vrednost.' };

    const dimension: GeneratorDimension = (prefix.startsWith('dol') || prefix === 'd')
      ? 'length'
      : (prefix.startsWith('sir') || prefix === 's')
        ? 'width'
        : (prefix.startsWith('deb') || prefix.startsWith('fi') || prefix === 'v' || prefix === 'h')
          ? 'thickness'
          : 'thickness';
    const parsedValues = parseDecimalListInput(rawValues);
    if (parsedValues.length === 0) return { error: 'Dodajte vsaj eno številčno vrednost.' };
    if (parsedValues.length > 5) return { error: `${generatorDimensionLabels[dimension]} podpira največ 5 vrednosti.` };
    const duplicateGuard = new Set<number>();
    for (const parsed of parsedValues) {
      if (duplicateGuard.has(parsed)) return { error: 'Podvojene vrednosti v isti dimenziji niso dovoljene.' };
      duplicateGuard.add(parsed);
    }

    return { dimension, values: parsedValues };
  };

  const submitGeneratorEntry = () => {
    const parsed = parseGeneratorEntry(generatorInput);
    if ('error' in parsed) {
      setGeneratorError(parsed.error);
      return;
    }
    setGeneratorError(null);
    setGeneratorChips((current) => {
      const next = current.filter((chip) => chip.dimension !== parsed.dimension);
      return [...next, parsed];
    });
    setGeneratorInput('');
  };

  const uploadMediaFile = useCallback(async (
    file: File,
    mediaKind: CatalogMediaImportKind
  ): Promise<UploadedCatalogMediaFile> => {
    const itemSlug = (draft.slug || toSlug(draft.name || articleId || 'artikel')).trim();
    if (!itemSlug) {
      throw new Error('Najprej vnesite naziv ali URL artikla.');
    }
    const cacheKey = `${itemSlug}\u0000${mediaKind}`;
    return getOrCreateCachedMediaUpload(
      mediaUploadPromiseCacheRef.current,
      file,
      cacheKey,
      async () => {
        const uploaded = await uploadAdminPublicMedia(file, {
          scope: 'catalog-item',
          itemSlug,
          mediaKind
        });
        return {
          url: uploaded.url,
          pathname: uploaded.pathname,
          mimeType: uploaded.contentType,
          filename: uploaded.filename,
          size: uploaded.size
        };
      }
    );
  }, [articleId, draft.name, draft.slug]);

  const uploadMediaUrl = useCallback(async (sourceUrl: string, mediaKind: CatalogMediaImportKind): Promise<UploadedCatalogMediaFile> => {
    const itemSlug = (draft.slug || toSlug(draft.name || articleId || 'artikel')).trim();
    if (!itemSlug) {
      throw new Error('Najprej vnesite naziv ali URL artikla.');
    }
    const formData = new FormData();
    formData.append('sourceUrl', sourceUrl);
    formData.append('mediaKind', mediaKind);
    formData.append('itemSlug', itemSlug);
    const response = await fetch('/api/admin/artikli/media', {
      method: 'POST',
      body: formData
    });
    const body = (await response.json().catch(() => ({}))) as {
      message?: string;
      url?: string;
      pathname?: string;
      mimeType?: string | null;
      filename?: string;
      size?: number;
    };
    if (!response.ok || !body.url || !body.pathname) {
      throw new Error(body.message || 'Nalaganje URL-ja ni uspelo.');
    }
    return {
      url: body.url,
      pathname: body.pathname,
      mimeType: body.mimeType ?? null,
      filename: body.filename ?? sourceUrl,
      size: body.size
    };
  }, [articleId, draft.name, draft.slug]);

  const resolveYoutubeEmbedUrl = (rawUrl: string) => {
    const value = rawUrl.trim();
    if (!value) return null;
    const normalized = value.toLowerCase();
    if (!normalized.includes('youtube.com') && !normalized.includes('youtu.be')) return null;
    try {
      const parsed = new URL(value);
      if (parsed.hostname.includes('youtu.be')) {
        const videoId = parsed.pathname.replace('/', '').trim();
        if (!videoId) return null;
        return `https://www.youtube.com/embed/${videoId}`;
      }
      if (!parsed.hostname.includes('youtube.com')) return null;
      if (parsed.pathname === '/watch') {
        const videoId = parsed.searchParams.get('v');
        if (!videoId) return null;
        return `https://www.youtube.com/embed/${videoId}`;
      }
      if (parsed.pathname.startsWith('/embed/')) {
        return `${parsed.origin}${parsed.pathname}`;
      }
      return null;
    } catch {
      return null;
    }
  };

  const submitYoutubeVideo = (rawUrl: string, options: { showError?: boolean } = {}) => {
    const value = rawUrl.trim();
    if (!value) return false;
    const previewUrl = resolveYoutubeEmbedUrl(value);
    if (!previewUrl) {
      if (options.showError) toast.error('Vnesite veljavno YouTube povezavo.');
      return false;
    }
    if (videoDraft?.file && videoDraft.previewUrl.startsWith('blob:')) {
      revokeLocalImageUrl(videoDraft.previewUrl);
    }
    setVideoDraft({
      source: 'youtube',
      label: value,
      previewUrl,
      uploadedUrl: null,
      blobPathname: null,
      file: null,
      mimeType: null,
      localId: null
    });
    setYoutubeInput('');
    setVideoMoveMode(false);
    return true;
  };

  const handleVideoFileSelect = (file?: File | null) => {
    if (!file) return;
    if (!file.type.startsWith('video/')) {
      toast.error('Izberite veljavno video datoteko.');
      return;
    }
    if (file.size > VIDEO_MAX_UPLOAD_BYTES) {
      toast.error('Video je prevelik. Dovoljena velikost je največ 100 MB.');
      return;
    }
    if (videoDraft?.file && videoDraft.previewUrl.startsWith('blob:')) {
      revokeLocalImageUrl(videoDraft.previewUrl);
    }
    const previewUrl = createLocalImageUrl(file);
    setVideoDraft({
      source: 'upload',
      label: file.name,
      previewUrl,
      uploadedUrl: null,
      blobPathname: null,
      file,
      mimeType: file.type || null,
      localId: createLocalStageId()
    });
    setVideoMoveMode(false);
  };

  const handleTechnicalFileSelect = (file?: File | null) => {
    if (!file) return;
    if (file.size > TECHNICAL_DOCUMENT_MAX_UPLOAD_BYTES) {
      toast.error('Datoteka je prevelika. Dovoljena velikost je največ 5 MB.');
      return;
    }
    const nextDocument: StagedTechnicalDocument = {
      id: `document-${createLocalStageId()}`,
      name: file.name,
      size: formatFileSize(file.size),
      blobUrl: null,
      blobPathname: null,
      file,
      mimeType: file.type || null,
      localId: createLocalStageId()
    };
    setDocuments((current) => [
      nextDocument,
      ...current.filter((entry) => entry.name !== file.name)
    ]);
  };

  const updateVariant = (variantId: string, updates: Partial<Variant>) => {
    setDraft((current) => {
      return {
        ...current,
        variants: current.variants.map((variant) => (variant.id === variantId ? { ...variant, ...updates } : variant))
      };
    });
  };

  const updateDimensionVariantStock = (variant: Variant, stock: number) => {
    updateVariant(variant.id, { stock });
    setVariantTags((current) => {
      const currentTag = current[variant.id] ?? 'na-zalogi';
      if (stock === 0 && currentTag === 'na-zalogi') {
        return { ...current, [variant.id]: 'ni-na-zalogi' };
      }
      if (stock > 0 && currentTag === 'ni-na-zalogi') {
        return { ...current, [variant.id]: 'na-zalogi' };
      }
      return current;
    });
  };

  const updateDimensionVariantDeliveryDraft = (variantId: string, amount: string) => {
    setDecimalInputDrafts((current) => ({
      ...current,
      [decimalDraftKey(variantId, 'deliveryTime')]: normalizeDeliveryDayAmount(amount)
    }));
  };

  const commitDimensionVariantDeliveryDraft = (variant: Variant) => {
    const key = decimalDraftKey(variant.id, 'deliveryTime');
    const rawAmount = decimalInputDrafts[key];
    if (rawAmount === undefined) return;
    const deliveryTime = formatDeliveryTimeFromAmount(rawAmount);
    const contentOverride = { ...(variant.contentOverride ?? {}) };
    if (deliveryTime) contentOverride.deliveryEstimate = deliveryTime;
    else delete contentOverride.deliveryEstimate;
    updateVariant(variant.id, {
      contentOverride: Object.keys(contentOverride).length > 0 ? contentOverride : null
    });
    setDecimalInputDrafts((current) => {
      const next = { ...current };
      delete next[key];
      return next;
    });
  };

  const selectDefaultDimensionVariant = (variant: Variant) => {
    if (!variant.active) return;
    setDraft((current) => ({ ...current, defaultVariantId: variant.id }));
  };

  const updateDimensionVariantActiveState = (variantId: string, active: boolean) => {
    const reassignsDefault = !active && draft.defaultVariantId === variantId;
    setDraft((current) => {
      const variants = current.variants.map((variant) =>
        variant.id === variantId ? { ...variant, active } : variant
      );
      const configuredDefault = variants.find((variant) => variant.id === current.defaultVariantId);
      const defaultVariantId = configuredDefault?.active
        ? configuredDefault.id
        : findFirstActiveVariant(variants)?.id ?? null;
      return { ...current, variants, defaultVariantId };
    });
    if (reassignsDefault) {
      toast.info('Privzeta različica je bila prestavljena na naslednjo aktivno vrstico.');
    }
  };

  const readDecimalInputValue = (variantId: string, field: string, value: number | null | undefined) => {
    const key = decimalDraftKey(variantId, field);
    return decimalInputDrafts[key] ?? formatDecimalForDisplay(value);
  };

  const updateDecimalInputDraft = (variantId: string, field: string, raw: string) => {
    if (!/^-?\d*(?:[.,]\d*)?$/.test(raw.trim()) && raw.trim() !== '') return;
    const key = decimalDraftKey(variantId, field);
    setDecimalInputDrafts((current) => ({ ...current, [key]: raw }));
  };

  const commitDecimalInputDraft = (
    variantId: string,
    field: string,
    fallbackValue: number | null | undefined,
    onCommit: (value: number | null) => void,
    emptyFallback: number | null
  ) => {
    const key = decimalDraftKey(variantId, field);
    const raw = decimalInputDrafts[key] ?? formatDecimalForDisplay(fallbackValue);
    const trimmed = raw.trim();
    if (!trimmed) {
      onCommit(emptyFallback);
      setDecimalInputDrafts((current) => {
        const next = { ...current };
        delete next[key];
        return next;
      });
      return;
    }
    const parsed = parseDecimalInput(trimmed);
    if (parsed === null) return;
    onCommit(parsed);
    setDecimalInputDrafts((current) => {
      const next = { ...current };
      delete next[key];
      return next;
    });
  };

  const deleteSelectedVariants = () => {
    if (!isTableEditable || !hasSelectedVariants) return;
    const removedCount = variantSelections.size;
    setDraft((current) => {
      const remainingVariants = current.variants.filter((variant) => !variantSelections.has(variant.id));
      return {
        ...current,
        defaultVariantId: remainingVariants.some((variant) => variant.id === current.defaultVariantId && variant.active)
          ? current.defaultVariantId
          : findFirstActiveVariant(remainingVariants)?.id ?? null,
        variants: remainingVariants.map((variant, index) => ({
          ...variant,
          sort: index + 1
        }))
      };
    });
    setVariantSelections(new Set());
    toast.info(removedCount === 1 ? 'Različica je odstranjena. Shrani za potrditev.' : `Odstranjenih različic: ${removedCount}. Shrani za potrditev.`);
  };

  const duplicateSelectedDimensionVariant = () => {
    if (!isTableEditable || variantSelections.size !== 1) return;

    commitPendingTextUndoSession();
    const decimalCommit = commitPendingDecimalDrafts();
    if (decimalCommit.error) {
      toast.error(decimalCommit.error);
      return;
    }

    const selectedVariantIds = Array.from(variantSelections);
    const sourceVariantId = selectedVariantIds[0];
    const result = duplicateSelectedVariant(
      decimalCommit.nextDraft.variants,
      selectedVariantIds
    );
    if (!result.duplicatedVariant) return;

    const duplicatedVariantId = result.duplicatedVariant.id;
    setDraft({
      ...decimalCommit.nextDraft,
      variants: result.variants
    });
    if (Object.keys(decimalInputDrafts).length > 0) {
      setDecimalInputDrafts({});
    }
    const explicitSourceTag = variantTags[sourceVariantId];
    if (explicitSourceTag) {
      setVariantTags((current) => ({
        ...current,
        [duplicatedVariantId]: explicitSourceTag
      }));
    }
    setVariantSelections(new Set([duplicatedVariantId]));
    setExpandedDimensionVariantId(duplicatedVariantId);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const scrollContainer = dimensionVariantScrollRef.current;
        scrollContainer?.scrollTo({
          left: scrollContainer.scrollWidth,
          behavior: 'smooth'
        });
      });
    });
    toast.info('Različica je podvojena kot neaktivna. Shrani za potrditev.');
  };

  const setVariantTag = (variantId: string, tag: VariantTag) => {
    setVariantTags((current) => ({ ...current, [variantId]: tag }));
  };

  const getVariantTag = (variant: Variant): VariantTag =>
    variantTags[variant.id] ?? (variant.stock > 0 ? 'na-zalogi' : 'ni-na-zalogi');

  const applyDimensionVariantRowValueToAll = (
    rowKey: DimensionVariantBulkApplyRowKey
  ) => {
    if (!isTableEditable || draft.variants.length < 2 || !expandedDimensionVariantId) return;

    const sourceVariant = draft.variants.find(
      (variant) => variant.id === expandedDimensionVariantId
    );
    if (!sourceVariant) return;

    let resolvedSourceVariant = sourceVariant;
    const draftField = DIMENSION_VARIANT_BULK_DRAFT_FIELDS[rowKey];
    const rawDraft = draftField
      ? decimalInputDrafts[decimalDraftKey(sourceVariant.id, draftField)]
      : undefined;

    if (rowKey === 'delivery') {
      const deliveryEstimate = rawDraft === undefined
        ? getDimensionVariantDeliveryTime(typeSpecificData.dimensions, sourceVariant)
        : formatDeliveryTimeFromAmount(rawDraft.trim())
          || normalizeDimensionSalesData(typeSpecificData.dimensions).defaultDeliveryTime;
      resolvedSourceVariant = {
        ...sourceVariant,
        contentOverride: {
          ...(sourceVariant.contentOverride ?? {}),
          deliveryEstimate
        }
      };
    } else if (rawDraft !== undefined) {
      const trimmed = rawDraft.trim();
      const parsed = trimmed ? parseDecimalInput(trimmed) : null;
      if (trimmed && parsed === null) {
        const rowLabel = DIMENSION_VARIANT_MATRIX_ROWS.find((row) => row.key === rowKey)?.label ?? rowKey;
        toast.error(`Preverite vrednost v polju ${rowLabel.toLocaleLowerCase('sl')}.`);
        return;
      }
      if (rowKey === 'weight') {
        resolvedSourceVariant = {
          ...sourceVariant,
          weight: catalogWeightDisplayGramsToKilograms(parsed)
        };
      } else if (rowKey === 'tolerance') {
        resolvedSourceVariant = {
          ...sourceVariant,
          errorTolerance: parsed === null ? null : formatDecimalForDisplay(parsed)
        };
      } else if (rowKey === 'cost') {
        resolvedSourceVariant = {
          ...sourceVariant,
          costNet: parsed === null ? null : Math.max(0, parsed)
        };
      } else if (rowKey === 'price') {
        if (parsed !== null && parsed < 0) {
          toast.error('Prodajna cena ne more biti negativna.');
          return;
        }
        resolvedSourceVariant = { ...sourceVariant, price: parsed ?? 0 };
      } else if (rowKey === 'discount') {
        resolvedSourceVariant = {
          ...sourceVariant,
          discountPct: Math.min(99.9, Math.max(0, parsed ?? 0))
        };
      }
    }

    if (rowKey === 'status' && !resolvedSourceVariant.active) {
      toast.error('Statusa »Neaktiven« ni mogoče uporabiti za vse, ker mora vsaj ena različica ostati aktivna.');
      return;
    }

    const variantsWithResolvedSource = draft.variants.map((variant) =>
      variant.id === resolvedSourceVariant.id ? resolvedSourceVariant : variant
    );
    const rowLabel = DIMENSION_VARIANT_MATRIX_ROWS.find((row) => row.key === rowKey)?.label ?? rowKey;
    const sourceName = buildDimensionVariantHeaderLabel(
      resolvedSourceVariant,
      Math.max(0, draft.variants.findIndex((variant) => variant.id === resolvedSourceVariant.id))
    );
    let changedVariantIds: string[] = [];
    let nextVariants = variantsWithResolvedSource;
    let nextDefaultVariantId = draft.defaultVariantId;
    let sourceTag: VariantTag | null = null;
    let stockTagVariantIds: string[] = [];

    if (rowKey === 'note') {
      sourceTag = getVariantTag(resolvedSourceVariant);
      changedVariantIds = variantsWithResolvedSource
        .filter((variant) => variant.id !== resolvedSourceVariant.id && getVariantTag(variant) !== sourceTag)
        .map((variant) => variant.id);
    } else {
      const field = DIMENSION_VARIANT_BULK_APPLY_FIELDS[rowKey];
      if (!field) return;
      const result = applyVariantValueToAll(
        variantsWithResolvedSource,
        resolvedSourceVariant.id,
        field
      );
      nextVariants = result.variants;
      changedVariantIds = result.changedVariantIds;
      if (rowKey === 'status') {
        const configuredDefault = nextVariants.find(
          (variant) => variant.id === draft.defaultVariantId && variant.active
        );
        nextDefaultVariantId = configuredDefault?.id ?? resolvedSourceVariant.id;
      } else if (rowKey === 'stock') {
        const previousVariantById = new Map(
          draft.variants.map((variant) => [variant.id, variant])
        );
        stockTagVariantIds = nextVariants
          .filter((variant) => {
            const previousVariant = previousVariantById.get(variant.id) ?? variant;
            const currentTag = variantTags[variant.id]
              ?? (previousVariant.stock > 0 ? 'na-zalogi' : 'ni-na-zalogi');
            return (
              (variant.stock === 0 && currentTag === 'na-zalogi')
              || (variant.stock > 0 && currentTag === 'ni-na-zalogi')
            );
          })
          .map((variant) => variant.id);
        changedVariantIds = Array.from(new Set([
          ...changedVariantIds,
          ...stockTagVariantIds.filter((variantId) => variantId !== resolvedSourceVariant.id)
        ]));
      }
    }

    applySelectionChange(() => {
      setDraft({
        ...draft,
        variants: nextVariants,
        defaultVariantId: nextDefaultVariantId
      });
      if (draftField) {
        setDecimalInputDrafts((current) =>
          Object.fromEntries(
            Object.entries(current).filter(([key]) => !key.endsWith(`:${draftField}`))
          )
        );
      }
      if (rowKey === 'note' && sourceTag && changedVariantIds.length > 0) {
        const changedVariantIdSet = new Set(changedVariantIds);
        setVariantTags((current) => {
          const next = { ...current };
          variantsWithResolvedSource.forEach((variant) => {
            if (changedVariantIdSet.has(variant.id)) next[variant.id] = sourceTag;
          });
          return next;
        });
      } else if (rowKey === 'stock') {
        const previousVariantById = new Map(
          draft.variants.map((variant) => [variant.id, variant])
        );
        const stockTagVariantIdSet = new Set(stockTagVariantIds);
        setVariantTags((current) => {
          let changed = false;
          const next = { ...current };
          nextVariants.forEach((variant) => {
            if (!stockTagVariantIdSet.has(variant.id)) return;
            const previousVariant = previousVariantById.get(variant.id) ?? variant;
            const currentTag = current[variant.id]
              ?? (previousVariant.stock > 0 ? 'na-zalogi' : 'ni-na-zalogi');
            const nextTag = variant.stock === 0 && currentTag === 'na-zalogi'
              ? 'ni-na-zalogi'
              : variant.stock > 0 && currentTag === 'ni-na-zalogi'
                ? 'na-zalogi'
                : currentTag;
            if (nextTag !== currentTag) {
              next[variant.id] = nextTag;
              changed = true;
            }
          });
          return changed ? next : current;
        });
      }
    });

    if (changedVariantIds.length === 0) {
      toast.info(`Vse druge različice že imajo enako vrednost za »${rowLabel}«.`);
      return;
    }
    const hiddenInactiveCount = changedVariantIds.filter((variantId) =>
      draft.variants.some((variant) => variant.id === variantId && !variant.active)
    ).length;
    toast.info(
      `»${rowLabel}« iz »${sourceName}« uporabljena za ${changedVariantIds.length} različic${
        hiddenInactiveCount > 0 ? ` (${hiddenInactiveCount} neaktivnih)` : ''
      }.`
    );
  };

  const applyProportionalDimensionVariantWeights = () => {
    if (!isTableEditable || draft.variants.length < 2 || !expandedDimensionVariantId) return;

    const decimalCommit = commitPendingDecimalDrafts();
    if (decimalCommit.error) {
      toast.error(decimalCommit.error);
      return;
    }

    const result = applyProportionalVariantWeights(
      decimalCommit.nextDraft.variants,
      expandedDimensionVariantId
    );
    if (result.error === 'SOURCE_DIMENSIONS_INVALID') {
      toast.error('Izvorna različica potrebuje pozitivno debelino/fi, dolžino in širino.');
      return;
    }
    if (result.error === 'SOURCE_WEIGHT_INVALID') {
      toast.error('Masa izvorne različice mora biti pozitivno celo število gramov.');
      return;
    }
    if (result.error === 'SOURCE_VARIANT_NOT_FOUND' || !result.sourceVariant) {
      toast.error('Izvorne različice ni mogoče najti.');
      return;
    }
    if (result.eligibleVariantIds.length === 0) {
      toast.error('Ni drugih različic s popolnimi pozitivnimi dimenzijami za izračun mase.');
      return;
    }

    const sourceName = buildDimensionVariantHeaderLabel(
      result.sourceVariant,
      Math.max(
        0,
        decimalCommit.nextDraft.variants.findIndex(
          (variant) => variant.id === result.sourceVariant?.id
        )
      )
    );
    const hasPendingDecimalDrafts = Object.keys(decimalInputDrafts).length > 0;
    if (result.changedVariantIds.length > 0 || hasPendingDecimalDrafts) {
      applySelectionChange(() => {
        setDraft({
          ...decimalCommit.nextDraft,
          variants: result.variants
        });
        if (hasPendingDecimalDrafts) setDecimalInputDrafts({});
      });
    }

    if (result.changedVariantIds.length === 0) {
      toast.info(`Mase drugih različic že ustrezajo prostorninskemu razmerju iz »${sourceName}«.`);
      return;
    }

    const inactiveCount = result.changedVariantIds.filter((variantId) =>
      decimalCommit.nextDraft.variants.some(
        (variant) => variant.id === variantId && !variant.active
      )
    ).length;
    toast.info(
      `Po prostornini iz »${sourceName}« izračunanih mas: ${result.changedVariantIds.length}${
        inactiveCount > 0 ? ` (${inactiveCount} neaktivnih)` : ''
      }${
        result.skippedVariantIds.length > 0
          ? `. Brez popolnih dimenzij: ${result.skippedVariantIds.length}`
          : ''
      }.`
    );
  };

  const addQuantityDiscount = () => {
    setQuantityDiscounts((current) => {
      const maxMinQuantity = current.reduce((max, rule) => Math.max(max, rule.minQuantity), 0);
      return [
        ...current,
        {
          ...createQuantityDiscountDraft({
            minQuantity: Math.max(1, maxMinQuantity + 10),
            discountPercent: 0,
            appliesTo: allQuantityDiscountTargetsJson,
            note: '',
            position: current.length
          }, current.length),
          id: `quantity-discount-local-${Date.now().toString(36)}-${current.length}`
        }
      ];
    });
  };

  const updateQuantityDiscount = (id: string, updates: Partial<QuantityDiscountDraft>) => {
    setQuantityDiscounts((current) =>
      current.map((rule) => (rule.id === id ? { ...rule, ...updates } : rule))
    );
  };

  const removeQuantityDiscount = (id: string) => {
    setQuantityDiscounts((current) =>
      current
        .filter((rule) => rule.id !== id)
        .map((rule, index) => ({ ...rule, position: index }))
    );
  };

  const createLocalImageUrl = useCallback((file: Blob) => {
    const url = URL.createObjectURL(file);
    localBlobUrlsRef.current.add(url);
    return url;
  }, []);

  const revokeLocalImageUrl = useCallback((url: string) => {
    if (!url.startsWith('blob:')) return;
    if (!localBlobUrlsRef.current.has(url)) return;
    URL.revokeObjectURL(url);
    localBlobUrlsRef.current.delete(url);
  }, []);

  useEffect(() => () => {
    localBlobUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    localBlobUrlsRef.current.clear();
  }, []);

  const recordImageDimensions = useCallback((slotIndex: number, previewUrl: string, image: HTMLImageElement) => {
    const dimensions = normalizeImagePixelDimensions({
      width: image.naturalWidth,
      height: image.naturalHeight
    });
    if (!dimensions) return;
    setMediaImageSlots((current) => {
      const slot = current[slotIndex];
      if (!slot || slot.previewUrl !== previewUrl) return current;
      if (
        slot.imageDimensions?.width === dimensions.width
        && slot.imageDimensions.height === dimensions.height
      ) return current;
      const next = [...current];
      next[slotIndex] = { ...slot, imageDimensions: dimensions };
      return next;
    });
    setSavedSnapshot((current) => {
      const savedSlot = current.mediaImages[slotIndex];
      if (!savedSlot || savedSlot.previewUrl !== previewUrl) return current;
      if (
        savedSlot.imageDimensions?.width === dimensions.width
        && savedSlot.imageDimensions.height === dimensions.height
      ) return current;
      const nextMediaImages = [...current.mediaImages];
      nextMediaImages[slotIndex] = {
        ...savedSlot,
        imageDimensions: dimensions
      };
      return { ...current, mediaImages: nextMediaImages };
    });
  }, []);

  useEffect(() => {
    if (editingImageSlot === null) return;
    if (!isMediaEditable || !mediaImagesDraft[editingImageSlot]) setEditingImageSlot(null);
  }, [editingImageSlot, isMediaEditable, mediaImagesDraft]);

  const updateImageAtSlot = useCallback((slotIndex: number, nextSlot: StagedImageSlot) => {
    setMediaImageSlots((current) => {
      const next = [...current];
      if (slotIndex < next.length) {
        const previous = next[slotIndex];
        if (previous && previous.previewUrl !== nextSlot.previewUrl) revokeLocalImageUrl(previous.previewUrl);
        next[slotIndex] = nextSlot;
        return next.slice(0, MEDIA_SLOT_COUNT);
      }
      next.push(nextSlot);
      return next.slice(0, MEDIA_SLOT_COUNT);
    });
  }, [revokeLocalImageUrl]);

  const stageImageFile = useCallback((file: File, slotIndex: number) => {
    const boundedSlotIndex = Math.max(0, Math.min(MEDIA_SLOT_COUNT - 1, slotIndex));
    const previewUrl = createLocalImageUrl(file);
    updateImageAtSlot(boundedSlotIndex, {
      previewUrl,
      uploadedUrl: null,
      blobPathname: null,
      file,
      filename: file.name,
      mimeType: file.type || null,
      imageDimensions: null,
      altText: mediaImageSlots[boundedSlotIndex]?.altText ?? '',
      localId: createLocalStageId()
    });
  }, [createLocalImageUrl, mediaImageSlots, updateImageAtSlot]);

  const queueImageUpload = useCallback((files: FileList | File[] | null, startSlot: number, allowMultiple: boolean) => {
    if (!isMediaEditable) return;
    const queuedFiles = Array.from(files ?? []).filter((file): file is File => file instanceof File);
    if (queuedFiles.length === 0) return;

    const remainingSlots = Math.max(0, MEDIA_SLOT_COUNT - startSlot);
    if (remainingSlots === 0) {
      toast.error('Vse reže so že zapolnjene.');
      return;
    }

    const maxFiles = Math.max(1, allowMultiple ? remainingSlots : 1);
    const acceptedFiles = queuedFiles.slice(0, maxFiles);
    if (queuedFiles.length > acceptedFiles.length) {
      toast.error(`Izberete lahko največ ${maxFiles} slik.`);
    }

    acceptedFiles.forEach((file, offset) => {
      if (!file.type.startsWith('image/')) {
        toast.error('Izberite veljavno slikovno datoteko.');
        return;
      }
      if (file.size > IMAGE_MAX_UPLOAD_BYTES) {
        toast.error('Slika je prevelika. Dovoljena velikost je največ 4 MB.');
        return;
      }
      stageImageFile(file, startSlot + offset);
    });

  }, [isMediaEditable, stageImageFile, toast]);

  const importImageUrls = async (urls: string[], startSlot: number, allowMultiple: boolean) => {
    if (!isMediaEditable) return;
    const remainingSlots = Math.max(0, MEDIA_SLOT_COUNT - startSlot);
    if (remainingSlots === 0) {
      toast.error('Vse reže so že zapolnjene.');
      return;
    }

    const acceptedUrls = urls.slice(0, Math.max(1, allowMultiple ? remainingSlots : 1));
    if (urls.length > acceptedUrls.length) {
      toast.error(`Prilepite lahko največ ${acceptedUrls.length} slik.`);
    }

    let importedCount = 0;
    for (const [offset, url] of acceptedUrls.entries()) {
      try {
        const uploaded = await uploadMediaUrl(url, 'image');
        const targetSlot = Math.max(0, Math.min(MEDIA_SLOT_COUNT - 1, startSlot + offset));
        updateImageAtSlot(targetSlot, {
          previewUrl: uploaded.url,
          uploadedUrl: uploaded.url,
          blobPathname: uploaded.pathname,
          file: null,
          filename: uploaded.filename,
          mimeType: uploaded.mimeType,
          imageDimensions: null,
          altText: mediaImageSlots[targetSlot]?.altText ?? '',
          localId: null
        });
        importedCount += 1;
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Nalaganje slike iz URL-ja ni uspelo.');
      }
    }
    if (importedCount > 0) {
      toast.success(importedCount === 1 ? 'Slika je naložena iz URL-ja.' : `Naloženih slik iz URL-ja: ${importedCount}.`);
    }
  };

  const importVideoUrl = async (url: string) => {
    if (!isMediaEditable) return;
    if (submitYoutubeVideo(url)) return;
    try {
      const uploaded = await uploadMediaUrl(url, 'video');
      if (videoDraft?.file && videoDraft.previewUrl.startsWith('blob:')) {
        revokeLocalImageUrl(videoDraft.previewUrl);
      }
      setVideoDraft({
        source: 'upload',
        label: uploaded.filename,
        previewUrl: uploaded.url,
        uploadedUrl: uploaded.url,
        blobPathname: uploaded.pathname,
        file: null,
        mimeType: uploaded.mimeType,
        localId: null
      });
      setVideoMoveMode(false);
      toast.success('Video je naložen iz URL-ja.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Nalaganje videa iz URL-ja ni uspelo.');
    }
  };

  const importDocumentUrls = async (urls: string[]) => {
    if (!isMediaEditable) return;
    let importedCount = 0;
    for (const url of urls) {
      try {
        const uploaded = await uploadMediaUrl(url, 'document');
        const nextDocument: StagedTechnicalDocument = {
          id: `document-${createLocalStageId()}`,
          name: uploaded.filename,
          size: uploaded.size ? formatFileSize(uploaded.size) : '—',
          blobUrl: uploaded.url,
          blobPathname: uploaded.pathname,
          file: null,
          mimeType: uploaded.mimeType,
          localId: null
        };
        setDocuments((current) => [
          nextDocument,
          ...current.filter((entry) => entry.name !== nextDocument.name)
        ]);
        importedCount += 1;
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Nalaganje dokumenta iz URL-ja ni uspelo.');
      }
    }
    if (importedCount > 0) {
      toast.success(importedCount === 1 ? 'Dokument je naložen iz URL-ja.' : `Naloženih dokumentov iz URL-ja: ${importedCount}.`);
    }
  };

  const handleMediaPanelPaste = (event: ReactClipboardEvent<HTMLElement>) => {
    if (!isMediaEditable || isEditablePasteTarget(event.target)) return;

    const clipboardFiles = [
      ...Array.from(event.clipboardData.files ?? []),
      ...Array.from(event.clipboardData.items ?? [])
        .filter((item) => item.kind === 'file')
        .map((item) => item.getAsFile())
        .filter((file): file is File => file instanceof File)
    ].filter((file, index, files) => files.findIndex((candidate) => candidate.name === file.name && candidate.size === file.size && candidate.type === file.type) === index);

    if (clipboardFiles.length > 0) {
      if (mediaTab === 'slike') {
        const imageFiles = clipboardFiles.filter((file) => file.type.startsWith('image/'));
        if (imageFiles.length > 0) {
          event.preventDefault();
          queueImageUpload(imageFiles, Math.min(mediaImagesDraft.length, MEDIA_SLOT_COUNT - 1), true);
          return;
        }
      }

      if (mediaTab === 'video') {
        const videoFile = clipboardFiles.find((file) => file.type.startsWith('video/'));
        if (videoFile) {
          event.preventDefault();
          handleVideoFileSelect(videoFile);
          return;
        }
      }

      if (mediaTab === 'tehnicni') {
        const documentFile = clipboardFiles.find(isTechnicalDocumentFile);
        if (documentFile) {
          event.preventDefault();
          handleTechnicalFileSelect(documentFile);
          return;
        }
      }
    }

    const pastedUrls = getPastedUrls(event.clipboardData.getData('text/plain'));
    if (pastedUrls.length === 0) return;
    event.preventDefault();

    if (mediaTab === 'slike') {
      void importImageUrls(pastedUrls, Math.min(mediaImagesDraft.length, MEDIA_SLOT_COUNT - 1), true);
      return;
    }
    if (mediaTab === 'video') {
      void importVideoUrl(pastedUrls[0] ?? '');
      return;
    }
    void importDocumentUrls(pastedUrls);
  };

  const openMediaFilePicker = useCallback((slotIndex: number, allowMultiple: boolean) => {
    if (!isMediaEditable) return;
    mediaUploadContextRef.current = { slotIndex, multiple: allowMultiple };
    const input = mediaUploadInputRef.current;
    if (!input) return;
    input.multiple = allowMultiple;
    input.value = '';
    input.click();
  }, [isMediaEditable]);

  const prepareDropzoneUploadPlan = useCallback((slotIndex: number, allowMultiple: boolean, files: File[]) => {
    if (!isMediaEditable) return;
    queueImageUpload(files, slotIndex, allowMultiple);
  }, [isMediaEditable, queueImageUpload]);

  const moveImageSlot = (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return;
    setMediaImageSlots((current) => {
      const next = [...current];
      const image = next[fromIndex];
      if (!image) return current;
      next.splice(fromIndex, 1);
      next.splice(Math.min(toIndex, next.length), 0, image);
      return next.slice(0, MEDIA_SLOT_COUNT);
    });
    setDraft((current) => ({
      ...current,
      variants: current.variants.map((variant) => ({
        ...variant,
        imageAssignments: remapImageSlotAssignmentsAfterMove(
          variant.imageAssignments ?? [],
          fromIndex,
          toIndex
        )
      }))
    }));
  };

  const removeImageSlot = (slotIndex: number) => {
    if (!isMediaEditable) return;
    setMediaImageSlots((current) => {
      const slotToRemove = current[slotIndex];
      if (slotToRemove?.previewUrl) revokeLocalImageUrl(slotToRemove.previewUrl);
      return current.filter((_, index) => index !== slotIndex).slice(0, MEDIA_SLOT_COUNT);
    });
    setDraft((current) => ({
      ...current,
      variants: current.variants.map((variant) => ({
        ...variant,
        imageAssignments: (variant.imageAssignments ?? [])
          .filter((slot) => slot !== slotIndex)
          .map((slot) => (slot > slotIndex ? slot - 1 : slot))
      }))
    }));
    setEditingImageSlot((current) => {
      if (current === null) return null;
      if (current === slotIndex) return null;
      return current > slotIndex ? current - 1 : current;
    });
  };

  const removeVideoDraft = () => {
    if (!videoDraft) return;
    if (videoDraft?.file && videoDraft.previewUrl.startsWith('blob:')) {
      revokeLocalImageUrl(videoDraft.previewUrl);
    }
    setVideoDraft(null);
    setYoutubeInput('');
    setVideoMoveMode(false);
    setVideoAssignedVariantId(null);
  };

  const addImageVariantAssignment = (slotIndex: number, variantId: string) => {
    if (!isMediaEditable) return;
    const slotImage = mediaImagesDraft[slotIndex];
    if (!slotImage) return;
    setDraft((current) => ({
      ...current,
      variants: current.variants.map((variant) => {
        if (variant.id !== variantId) return variant;
        const assignments = variant.imageAssignments ?? [];
        if (assignments.includes(slotIndex)) return variant;
        const nextAssignments = [...assignments, slotIndex];
        return {
          ...variant,
          imageAssignments: nextAssignments,
          imageOverride: mediaImagesDraft[nextAssignments[0]] ?? slotImage
        };
      })
    }));
  };

  const removeImageVariantAssignment = (slotIndex: number, variantId: string) => {
    if (!isMediaEditable) return;
    setDraft((current) => ({
      ...current,
      variants: current.variants.map((variant) => {
        if (variant.id !== variantId) return variant;
        const nextAssignments = (variant.imageAssignments ?? []).filter((assignment) => assignment !== slotIndex);
        return {
          ...variant,
          imageAssignments: nextAssignments,
          imageOverride: nextAssignments.length > 0
            ? mediaImagesDraft[nextAssignments[0]] ?? null
            : null
        };
      })
    }));
  };

  const clearImageVariantAssignments = (slotIndex: number) => {
    if (!isMediaEditable) return;
    setDraft((current) => ({
      ...current,
      variants: current.variants.map((variant) => {
        const assignments = variant.imageAssignments ?? [];
        if (!assignments.includes(slotIndex)) return variant;
        const nextAssignments = assignments.filter((assignment) => assignment !== slotIndex);
        return {
          ...variant,
          imageAssignments: nextAssignments,
          imageOverride: nextAssignments.length > 0
            ? mediaImagesDraft[nextAssignments[0]] ?? null
            : null
        };
      })
    }));
  };

  const updateImageAltText = useCallback((slotIndex: number, altText: string) => {
    setMediaImageSlots((current) => current.map((slot, index) => (index === slotIndex ? { ...slot, altText } : slot)));
  }, []);

  const handleSaveEditedImage = useCallback((slotIndex: number, blob: Blob, mimeType: string) => {
    if (!isMediaEditable) return;
    const nextMimeType = mimeType || 'image/webp';
    if (blob.size > IMAGE_MAX_UPLOAD_BYTES) {
      toast.error('Urejena slika je prevelika. Dovoljene so le slike do 4 MB.');
      return;
    }
    const extension = inferImageFormatLabel({ mimeType: nextMimeType, fileName: 'edited.webp' }).toLowerCase();
    const fileName = `edited-${Date.now()}.${extension}`;
    const file = new File([blob], fileName, { type: nextMimeType });
    const previewUrl = createLocalImageUrl(file);
    updateImageAtSlot(slotIndex, {
      previewUrl,
      uploadedUrl: null,
      blobPathname: null,
      file,
      filename: fileName,
      mimeType: nextMimeType,
      imageDimensions: null,
      altText: mediaImageSlots[slotIndex]?.altText ?? '',
      localId: createLocalStageId()
    });
    setEditingImageSlot(null);
    toast.success('Slika je pripravljena za shranjevanje.');
  }, [createLocalImageUrl, isMediaEditable, mediaImageSlots, toast, updateImageAtSlot]);

  const renderImageActionButtons = (slotIndex: number) => {
    if (!isMediaEditable) return null;
    const compact = slotIndex !== 0;
    const verticalAlignClass = compact ? 'justify-center' : 'justify-start pt-2';
    const actions = [
      {
        key: 'remove',
        label: 'Odstrani',
        tone: 'danger' as const,
        onClick: () => removeImageSlot(slotIndex),
        icon: <span aria-hidden className={`${compact ? 'text-[11px]' : 'text-sm'} leading-none`}>✕</span>
      },
      {
        key: 'replace',
        label: 'Zamenjaj sliko',
        tone: 'light' as const,
        onClick: () => openMediaFilePicker(slotIndex, false),
        icon: (
          <svg viewBox="0 0 24 24" className={`block shrink-0 ${compact ? 'h-[12px] w-[12px]' : 'h-[17.6px] w-[17.6px]'}`} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <rect x="3" y="4" width="18" height="16" rx="2.8" />
            <path d="m6.5 15.5 3.7-3.8a1 1 0 0 1 1.42 0L15 15l2-2a1 1 0 0 1 1.42 0l2.08 2.08" />
            <circle cx="15.5" cy="9.3" r="1.5" />
          </svg>
        )
      },
      {
        key: 'hide',
        label: 'Skrij',
        tone: 'light' as const,
        onClick: () => toast.info('Skrivanje slike bo na voljo kmalu.'),
        icon: (
          <svg viewBox="0 0 24 24" className={compact ? 'h-[12px] w-[12px]' : 'h-4 w-4'} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M1.5 12s3.75-6.75 10.5-6.75S22.5 12 22.5 12s-3.75 6.75-10.5 6.75S1.5 12 1.5 12Z" />
            <circle cx="12" cy="12" r="3" />
            <path d="M3 3 21 21" />
          </svg>
        )
      }
    ];

    return (
      <div className={`absolute inset-y-0 right-2 z-20 flex flex-col items-end opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100 ${verticalAlignClass} ${compact ? 'gap-1' : 'gap-1.5'}`}>
        {actions.map((action) => (
          <button
            key={`${slotIndex}-${action.key}`}
            type="button"
            className={`inline-flex items-center justify-center rounded-md border px-0 leading-none shadow-[0_6px_18px_rgba(15,23,42,0.12)] transition focus-visible:border-[color:var(--blue-500)] focus-visible:outline-none focus-visible:ring-0 focus-visible:shadow-none ${compact ? 'h-[20px] w-[20px]' : 'h-[25px] min-w-[1.6rem]'} ${action.tone === 'danger' ? 'border-[#f1c1bd] bg-white text-[#d2554a] hover:bg-[#fff7f6]' : 'border-slate-200 bg-white text-slate-900 hover:bg-slate-50'}`}
            onPointerDown={(event) => {
              event.stopPropagation();
              event.preventDefault();
            }}
            onClick={(event) => {
              event.stopPropagation();
              action.onClick();
            }}
            aria-label={action.label}
            title={action.label}
          >
            <span className="inline-flex h-full w-full items-center justify-center">{action.icon}</span>
          </button>
        ))}
      </div>
    );
  };

  const expandedDimensionVariant =
    draft.variants.find((variant) => variant.id === expandedDimensionVariantId) ?? null;
  // The selected cell contains a 320px-wide field plus 8px horizontal padding
  // on each side. Keep the highlighted column fitted to that content.
  const expandedDimensionVariantTrackWidth = 336;
  const dimensionVariantLayoutCompactCount = Math.max(0, draft.variants.length - 1);
  const compactDimensionVariantWidth = dimensionVariantLayoutCompactCount <= 2
    ? 220
    : dimensionVariantLayoutCompactCount <= 4
      ? 140
      : dimensionVariantLayoutCompactCount <= 6
        ? 100
        : dimensionVariantLayoutCompactCount <= 8
          ? 82
          : dimensionVariantLayoutCompactCount <= 12
            ? 58
            : dimensionVariantLayoutCompactCount <= 15
              ? 44
              : dimensionVariantLayoutCompactCount <= 19
                ? 34
                : 40;
  const usesDenseDimensionVariantLayout = dimensionVariantLayoutCompactCount >= 12;
  const usesSteepDimensionVariantHeaders = dimensionVariantLayoutCompactCount > 15;
  const dimensionVariantHeaderHeight = usesSteepDimensionVariantHeaders ? 138 : 118;
  const dimensionVariantNormalBandHeight = 36;
  const dimensionVariantDiagonalHeight =
    dimensionVariantHeaderHeight - dimensionVariantNormalBandHeight;
  const dimensionVariantHeaderAngle = 45;
  const dimensionVariantHeaderTitleOpticalOffset = 6;
  const dimensionVariantHeaderSlant = dimensionVariantDiagonalHeight;
  const dimensionVariantBaseTrackWidths = draft.variants.map((variant) =>
    variant.id !== expandedDimensionVariant?.id
    && collapseInactiveDimensionVariants
    && !variant.active
      ? Math.min(26, compactDimensionVariantWidth)
      : compactDimensionVariantWidth
  );
  const dimensionMatrixBaseWidth =
    205 + dimensionVariantBaseTrackWidths.reduce((total, width) => total + width, 0);
  const getDimensionVariantTrack = (variant: Variant, variantIndex: number) => {
    const isExpanded = variant.id === expandedDimensionVariant?.id;
    const baseTrackWidth = dimensionVariantBaseTrackWidths[variantIndex] ?? compactDimensionVariantWidth;
    if (isExpanded) return `${expandedDimensionVariantTrackWidth}px`;
    if (!usesDenseDimensionVariantLayout) return `${baseTrackWidth}px`;
    const isCompressedInactive =
      collapseInactiveDimensionVariants && !variant.active;
    const minimumWidth = isCompressedInactive
      ? Math.min(26, compactDimensionVariantWidth)
      : compactDimensionVariantWidth;
    const flexibleWidth = isCompressedInactive ? 0 : 1;
    return `minmax(${minimumWidth}px, ${flexibleWidth}fr)`;
  };
  const dimensionMatrixOccupiedWidth =
    dimensionMatrixBaseWidth
    + (expandedDimensionVariant
      ? expandedDimensionVariantTrackWidth - compactDimensionVariantWidth
      : 0);
  const dimensionMatrixRemainderTrack =
    usesDenseDimensionVariantLayout
      ? '0px'
      : `calc(100% - ${dimensionMatrixOccupiedWidth}px)`;
  const dimensionMatrixGridTemplateColumns = [
    '205px',
    ...draft.variants.map(getDimensionVariantTrack),
    dimensionMatrixRemainderTrack
  ].join(' ');
  const dimensionMatrixMinWidth =
    205
    + draft.variants.reduce((total, variant) => {
      if (variant.id === expandedDimensionVariant?.id) {
        return total + expandedDimensionVariantTrackWidth;
      }
      return total + (
        collapseInactiveDimensionVariants && !variant.active
          ? Math.min(26, compactDimensionVariantWidth)
          : compactDimensionVariantWidth
      );
    }, 0);
  const firstSelectedDimensionVariant = draft.variants.find((variant) => variantSelections.has(variant.id)) ?? null;
  const draggedDimensionVariant =
    draft.variants.find((variant) => variant.id === draggedDimensionVariantId) ?? null;
  const dimensionVariantTaxRate = Math.min(
    1,
    Math.max(0, (parseDecimalInput(sideSettings.taxRatePercent) ?? 22) / 100)
  );

  const toggleDimensionVariantSelection = (variantId: string) => {
    setVariantSelections((current) => {
      const next = new Set(current);
      if (next.has(variantId)) next.delete(variantId);
      else next.add(variantId);
      return next;
    });
  };

  const reorderDimensionVariants = (activeId: string, overId: string) => {
    if (!isTableEditable || activeId === overId) return;
    commitPendingTextUndoSession();
    setDraft((current) => {
      const oldIndex = current.variants.findIndex((variant) => variant.id === activeId);
      const newIndex = current.variants.findIndex((variant) => variant.id === overId);
      if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) return current;
      return {
        ...current,
        variants: arrayMove(current.variants, oldIndex, newIndex).map((variant, index) => ({
          ...variant,
          sort: index + 1
        }))
      };
    });
  };

  const handleDimensionVariantDragStart = (event: DragStartEvent) => {
    commitPendingTextUndoSession();
    setHoveredDimensionVariantId(null);
    setDraggedDimensionVariantId(String(event.active.id));
  };

  const handleDimensionVariantDragEnd = (event: DragEndEvent) => {
    setDraggedDimensionVariantId(null);
    if (!event.over) return;
    reorderDimensionVariants(String(event.active.id), String(event.over.id));
  };

  const renderDimensionVariantTriplet = (
    variant: Variant,
    variantName: string
  ): ReactNode => (
    <div className="grid w-full min-w-0 grid-cols-3 gap-1">
      <CompactSegmentedField
        editable={isTableEditable}
        disabled={isThicknessLockActive}
        value={isTableEditable ? readDecimalInputValue(variant.id, 'thickness', variant.thickness) : variant.thickness === null ? null : formatDecimalForDisplay(variant.thickness)}
        suffix="mm"
        placeholder="Debelina/fi"
        ariaLabel={`Debelina oziroma fi za ${variantName}`}
        className="min-w-0"
        inputClassName="placeholder:text-[9px]"
        onChange={(value) => updateDecimalInputDraft(variant.id, 'thickness', value)}
        onBlur={() => commitDecimalInputDraft(variant.id, 'thickness', variant.thickness, (value) => updateVariant(variant.id, { thickness: value }), null)}
      />
      <CompactSegmentedField
        editable={isTableEditable}
        disabled={isDimensionLockActive}
        value={isTableEditable ? readDecimalInputValue(variant.id, 'length', variant.length) : variant.length === null ? null : formatDecimalForDisplay(variant.length)}
        suffix="mm"
        placeholder="Dolžina"
        ariaLabel={`Dolžina za ${variantName}`}
        className="min-w-0"
        inputClassName="placeholder:text-[9px]"
        onChange={(value) => updateDecimalInputDraft(variant.id, 'length', value)}
        onBlur={() => commitDecimalInputDraft(variant.id, 'length', variant.length, (value) => updateVariant(variant.id, { length: value }), null)}
      />
      <CompactSegmentedField
        editable={isTableEditable}
        disabled={isDimensionLockActive}
        value={isTableEditable ? readDecimalInputValue(variant.id, 'width', variant.width) : variant.width === null ? null : formatDecimalForDisplay(variant.width)}
        suffix="mm"
        placeholder="Širina"
        ariaLabel={`Širina za ${variantName}`}
        className="min-w-0"
        inputClassName="placeholder:text-[9px]"
        onChange={(value) => updateDecimalInputDraft(variant.id, 'width', value)}
        onBlur={() => commitDecimalInputDraft(variant.id, 'width', variant.width, (value) => updateVariant(variant.id, { width: value }), null)}
      />
    </div>
  );

  const getDimensionVariantSummaryValue = (
    variant: Variant,
    rowKey: DimensionVariantMatrixRowKey
  ) => {
    const decimal = (value: number | null | undefined) =>
      value === null || value === undefined ? '—' : formatDecimalForDisplay(value);
    if (rowKey === 'dimensions') {
      return `${[
        decimal(variant.thickness),
        decimal(variant.length),
        decimal(variant.width)
      ].join(' × ')} mm`;
    }
    if (rowKey === 'weight') {
      return decimal(catalogWeightKilogramsToDisplayGrams(variant.weight));
    }
    if (rowKey === 'tolerance') {
      return variant.errorTolerance ? `± ${variant.errorTolerance.replace('.', ',')}` : '—';
    }
    if (rowKey === 'cost') {
      return variant.costNet === null || variant.costNet === undefined ? '—' : formatEuroAmount(variant.costNet);
    }
    if (rowKey === 'price') return formatEuroAmount(variant.price);
    if (rowKey === 'priceGross') {
      return formatEuroAmount(computeGrossPrice(variant.price, dimensionVariantTaxRate));
    }
    if (rowKey === 'discount') return formatDecimalForDisplay(variant.discountPct);
    if (rowKey === 'salePrice') {
      return variant.discountPct > 0
        ? formatEuroAmount(computeSalePrice(variant.price, variant.discountPct))
        : '—';
    }
    if (rowKey === 'salePriceGross') {
      return variant.discountPct > 0
        ? formatEuroAmount(
            computeGrossPrice(
              computeSalePrice(variant.price, variant.discountPct),
              dimensionVariantTaxRate
            )
          )
        : '—';
    }
    if (rowKey === 'stock') return `${variant.stock}`;
    if (rowKey === 'minOrder') return `${variant.minOrder ?? 1}`;
    if (rowKey === 'delivery') {
      return getDeliveryDayAmount(getDimensionVariantDeliveryTime(typeSpecificData.dimensions, variant)) || '—';
    }
    if (rowKey === 'sku') return variant.sku || '—';
    return '—';
  };

  const renderExpandedDimensionVariantCell = (
    variant: Variant,
    rowKey: DimensionVariantMatrixRowKey
  ): ReactNode => {
    const variantName = buildDimensionVariantHeaderLabel(
      variant,
      Math.max(0, draft.variants.findIndex((entry) => entry.id === variant.id)),
      true
    );
    if (rowKey === 'default') {
      return (
        <input
          type="radio"
          name="default-dimension-variant"
          aria-label={`Nastavi ${variantName} kot privzeto`}
          title={variant.active ? 'Nastavi kot privzeto različico' : 'Neaktivna različica ne more biti privzeta'}
          className="h-4 w-4 accent-[color:var(--blue-600)] disabled:cursor-not-allowed disabled:opacity-40"
          checked={resolvedDefaultVariantId === variant.id}
          disabled={!isTableEditable || !variant.active}
          onChange={() => selectDefaultDimensionVariant(variant)}
        />
      );
    }
    if (rowKey === 'dimensions') return renderDimensionVariantTriplet(variant, variantName);
    if (rowKey === 'weight') {
      const displayWeightGrams = catalogWeightKilogramsToDisplayGrams(variant.weight);
      return (
        <CompactSegmentedField
          editable={isTableEditable}
          value={isTableEditable ? readDecimalInputValue(variant.id, 'weight', displayWeightGrams) : displayWeightGrams === null ? null : formatDecimalForDisplay(displayWeightGrams)}
          suffix="g"
          ariaLabel={`Masa za ${variantName}`}
          onChange={(value) => updateDecimalInputDraft(variant.id, 'weight', value)}
          onBlur={() => commitDecimalInputDraft(
            variant.id,
            'weight',
            displayWeightGrams,
            (value) => updateVariant(variant.id, {
              weight: catalogWeightDisplayGramsToKilograms(value)
            }),
            null
          )}
        />
      );
    }
    if (rowKey === 'tolerance') {
      return (
        <CompactSegmentedField
          editable={isTableEditable}
          disabled={isToleranceLocked}
          value={
            isTableEditable
              ? decimalInputDrafts[decimalDraftKey(variant.id, 'errorTolerance')] ?? variant.errorTolerance ?? ''
              : variant.errorTolerance
                ? variant.errorTolerance.replace('.', ',')
                : null
          }
          prefix="±"
          suffix="mm"
          ariaLabel={`Toleranca za ${variantName}`}
          onChange={(value) => {
            if (!isToleranceLocked) updateDecimalInputDraft(variant.id, 'errorTolerance', value);
          }}
          onBlur={() => {
            const key = decimalDraftKey(variant.id, 'errorTolerance');
            const raw = decimalInputDrafts[key] ?? variant.errorTolerance ?? '';
            const parsed = parseDecimalInput(raw);
            updateVariant(variant.id, { errorTolerance: parsed === null ? null : formatDecimalForDisplay(parsed) });
            setDecimalInputDrafts((current) => {
              const next = { ...current };
              delete next[key];
              return next;
            });
          }}
        />
      );
    }
    if (rowKey === 'cost') {
      return (
        <CompactSegmentedField
          editable={isTableEditable}
          value={isTableEditable ? readDecimalInputValue(variant.id, 'costNet', variant.costNet) : variant.costNet === null || variant.costNet === undefined ? null : formatEuroAmount(variant.costNet)}
          suffix="€"
          ariaLabel={`Nabavna cena brez DDV za ${variantName}`}
          onChange={(value) => updateDecimalInputDraft(variant.id, 'costNet', value)}
          onBlur={() => commitDecimalInputDraft(
            variant.id,
            'costNet',
            variant.costNet,
            (value) => updateVariant(variant.id, { costNet: value === null ? null : Math.max(0, value) }),
            null
          )}
        />
      );
    }
    if (rowKey === 'price') {
      return (
        <CompactSegmentedField
          editable={isTableEditable}
          value={isTableEditable ? readDecimalInputValue(variant.id, 'price', variant.price) : formatEuroAmount(variant.price)}
          suffix="€"
          ariaLabel={`Prodajna cena brez DDV za ${variantName}`}
          onChange={(value) => updateDecimalInputDraft(variant.id, 'price', value)}
          onBlur={() => commitDecimalInputDraft(variant.id, 'price', variant.price, (value) => updateVariant(variant.id, { price: value ?? 0 }), 0)}
        />
      );
    }
    if (rowKey === 'priceGross') {
      return (
        <CompactSegmentedField
          editable={false}
          value={formatEuroAmount(computeGrossPrice(variant.price, dimensionVariantTaxRate))}
          suffix="€"
          ariaLabel={`Prodajna cena z DDV za ${variantName}`}
        />
      );
    }
    if (rowKey === 'discount') {
      return (
        <CompactSegmentedField
          editable={isTableEditable}
          value={isTableEditable ? readDecimalInputValue(variant.id, 'discountPct', variant.discountPct) : formatDecimalForDisplay(variant.discountPct)}
          suffix="%"
          ariaLabel={`Popust za ${variantName}`}
          onChange={(value) => updateDecimalInputDraft(variant.id, 'discountPct', value)}
          onBlur={() => commitDecimalInputDraft(variant.id, 'discountPct', variant.discountPct, (value) => updateVariant(variant.id, { discountPct: Math.min(99.9, Math.max(0, value ?? 0)) }), 0)}
        />
      );
    }
    if (rowKey === 'salePrice') {
      return (
        <CompactSegmentedField
          editable={false}
          value={variant.discountPct > 0 ? formatEuroAmount(computeSalePrice(variant.price, variant.discountPct)) : null}
          suffix="€"
          ariaLabel={`Akcijska cena brez DDV za ${variantName}`}
        />
      );
    }
    if (rowKey === 'salePriceGross') {
      return (
        <CompactSegmentedField
          editable={false}
          value={
            variant.discountPct > 0
              ? formatEuroAmount(
                  computeGrossPrice(
                    computeSalePrice(variant.price, variant.discountPct),
                    dimensionVariantTaxRate
                  )
                )
              : null
          }
          suffix="€"
          ariaLabel={`Akcijska cena z DDV za ${variantName}`}
        />
      );
    }
    if (rowKey === 'stock') {
      return (
        <CompactSegmentedField
          editable={isTableEditable}
          inputMode="numeric"
          value={variant.stock}
          ariaLabel={`Zaloga za ${variantName}`}
          onChange={(value) => updateDimensionVariantStock(variant, Math.max(0, Math.floor(Number(value.replace(/\D/g, '')) || 0)))}
        />
      );
    }
    if (rowKey === 'minOrder') {
      return (
        <CompactSegmentedField
          editable={isTableEditable}
          inputMode="numeric"
          value={variant.minOrder ?? 1}
          ariaLabel={`Minimalno naročilo za ${variantName}`}
          onChange={(value) => updateVariant(variant.id, { minOrder: Math.max(1, Math.floor(Number(value.replace(/\D/g, '')) || 1)) })}
        />
      );
    }
    if (rowKey === 'delivery') {
      return (
        <CompactSegmentedField
          editable={isTableEditable}
          inputMode="numeric"
          value={
            decimalInputDrafts[decimalDraftKey(variant.id, 'deliveryTime')]
            ?? getDeliveryDayAmount(getDimensionVariantDeliveryTime(typeSpecificData.dimensions, variant))
          }
          suffix="dni"
          placeholder="1-2"
          ariaLabel={`Dobavni rok za ${variantName}`}
          title={getDimensionVariantDeliveryTime(typeSpecificData.dimensions, variant)}
          onChange={(value) => updateDimensionVariantDeliveryDraft(variant.id, value)}
          onBlur={() => commitDimensionVariantDeliveryDraft(variant)}
        />
      );
    }
    if (rowKey === 'sku') {
      return (
        <CompactSegmentedField
          editable={isTableEditable}
          value={variant.sku}
          inputMode="text"
          align="left"
          ariaLabel={`SKU za ${variantName}`}
          title={variant.sku || undefined}
          onChange={(value) => updateVariant(variant.id, { sku: value, skuAutoGenerated: false })}
        />
      );
    }
    if (rowKey === 'status') {
      return (
        <div className="flex w-full justify-end">
          <ActiveStateChip
            active={variant.active}
            editable={isTableEditable}
            chipClassName={`${adminStatusInfoPillVariantTableClassName} !w-full !min-w-0 !px-2 !text-[10px]`}
            menuPlacement="bottom"
            onChange={(next) => applySelectionChange(() => updateDimensionVariantActiveState(variant.id, next))}
          />
        </div>
      );
    }
    if (rowKey === 'note') {
      return (
        <div className="flex w-full justify-end">
          <NoteTagChip
            value={getVariantTag(variant)}
            editable={isTableEditable}
            chipClassName={`${adminStatusInfoPillVariantTableClassName} !w-full !min-w-0 !px-2 !text-[10px]`}
            menuPlacement="bottom"
            onChange={(next) => {
              if (!next) return;
              applySelectionChange(() => setVariantTag(variant.id, next));
            }}
          />
        </div>
      );
    }
    return null;
  };

  const renderCompactDimensionVariantCell = (
    variant: Variant,
    rowKey: DimensionVariantMatrixRowKey
  ): ReactNode => {
    const variantIndex = Math.max(0, draft.variants.findIndex((entry) => entry.id === variant.id));
    const variantName = buildDimensionVariantHeaderLabel(variant, variantIndex, true);
    if (rowKey === 'default') {
      return (
        <input
          type="radio"
          name="default-dimension-variant"
          aria-label={`Nastavi ${variantName} kot privzeto`}
          className="h-3.5 w-3.5 accent-[color:var(--blue-600)] disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-40"
          checked={resolvedDefaultVariantId === variant.id}
          disabled={!isTableEditable || !variant.active}
          onClick={(event) => event.stopPropagation()}
          onChange={() => selectDefaultDimensionVariant(variant)}
        />
      );
    }
    if (rowKey === 'status') {
      return (
        <span
          className={`h-2.5 w-2.5 rounded-full ${variant.active ? 'bg-emerald-500' : 'bg-slate-400'}`}
          title={variant.active ? 'Aktiven' : 'Neaktiven'}
        >
          <span className="sr-only">{variant.active ? 'Aktiven' : 'Neaktiven'}</span>
        </span>
      );
    }
    if (rowKey === 'note') {
      const tag = getVariantTag(variant);
      return (
        <span
          className={`h-2.5 w-2.5 rounded-full ${getVariantTagSummaryDotClassName(tag)}`}
          title={getNoteTagLabel(tag)}
        >
          <span className="sr-only">{getNoteTagLabel(tag)}</span>
        </span>
      );
    }
    const value = getDimensionVariantSummaryValue(variant, rowKey);
    return (
      <span
        className={`block max-w-full truncate px-0.5 text-center text-[10px] text-slate-700 ${rowKey === 'sku' ? 'font-mono text-[9px]' : ''}`}
        title={`${variantName} · ${value}`}
      >
        {value}
      </span>
    );
  };

  const activateCollapsedDimensionVariant = (
    event: ReactMouseEvent<HTMLDivElement>,
    variantId: string
  ) => {
    const target = event.target;
    if (
      target instanceof Element &&
      target.closest(
        'button, input, select, textarea, a, label, [role="button"], [role="checkbox"], [role="radio"], [contenteditable="true"]'
      )
    ) {
      return;
    }

    setExpandedDimensionVariantId(variantId);
    setHoveredDimensionVariantId(null);
  };

  const basicProductFields: Array<{
    title: string;
    value: string;
    placeholder: string;
    icon: SideFieldIcon;
    onChange: (value: string) => void;
  }> = [
    { title: 'Osnovni SKU', value: sideSettings.sku, placeholder: 'SKU koda', icon: 'sku', onChange: (value) => setSideSettings((current) => ({ ...current, sku: value })) },
    { title: 'URL', value: draft.slug, placeholder: toSlug(draft.name || 'naziv-artikla'), icon: 'link', onChange: (value) => setDraft((current) => ({ ...current, slug: value })) },
    { title: 'Blagovna znamka', value: sideSettings.brand, placeholder: productType === 'unique_machine' ? 'Proxxon' : 'AluCraft', icon: 'brand', onChange: (value) => setSideSettings((current) => ({ ...current, brand: value })) },
    { title: 'Material', value: sideSettings.material, placeholder: productType === 'weight' ? 'Kremenčev pesek' : 'Aluminij', icon: 'material', onChange: (value) => setSideSettings((current) => ({ ...current, material: value })) },
    ...(productType === 'weight'
      ? [
          { title: 'Enota prodaje', value: 'kg', placeholder: 'kg', icon: 'unit' as SideFieldIcon, onChange: () => {} },
          { title: 'Stopnja DDV', value: sideSettings.taxRatePercent, placeholder: '22', icon: 'percent' as SideFieldIcon, onChange: (value: string) => setSideSettings((current) => ({ ...current, taxRatePercent: value.replace(/[^\d,.]/g, '') })) }
        ]
      : productType === 'unique_machine'
        ? [
            { title: 'Enota prodaje', value: 'kos', placeholder: 'kos', icon: 'unit' as SideFieldIcon, onChange: () => {} },
            { title: 'Stopnja DDV', value: sideSettings.taxRatePercent, placeholder: '22', icon: 'percent' as SideFieldIcon, onChange: (value: string) => setSideSettings((current) => ({ ...current, taxRatePercent: value.replace(/[^\d,.]/g, '') })) }
          ]
        : [
            { title: 'Barva', value: sideSettings.color, placeholder: 'Srebrna', icon: 'color' as SideFieldIcon, onChange: (value: string) => setSideSettings((current) => ({ ...current, color: value })) },
            { title: 'Oblika', value: sideSettings.surface, placeholder: 'Pravokotna', icon: 'shape' as SideFieldIcon, onChange: (value: string) => setSideSettings((current) => ({ ...current, surface: value })) },
            { title: 'Enota prodaje', value: 'kos', placeholder: 'kos', icon: 'unit' as SideFieldIcon, onChange: () => {} },
            { title: 'Stopnja DDV', value: sideSettings.taxRatePercent, placeholder: '22', icon: 'percent' as SideFieldIcon, onChange: (value: string) => setSideSettings((current) => ({ ...current, taxRatePercent: value.replace(/[^\d,.]/g, '') })) }
          ])
  ];
  return (
    <div
      className="mx-auto max-w-7xl space-y-5 font-['Inter',system-ui,sans-serif] [&>div:nth-child(2)]:hidden"
      onFocus={handleUndoTrackedFieldFocus}
      onBlur={handleUndoTrackedFieldBlur}
    >
      <div className="-mb-2 text-xs text-slate-500">
        <Link href="/admin/artikli" className="hover:underline">Artikli</Link>
        <span className="mx-1 text-slate-400">&rsaquo;</span>
        <span>{mode === 'create' ? 'Nov artikel' : draft.name || 'Uredi artikel'}</span>
      </div>
      <section className={`${adminWindowCardClassName} px-5 py-4`} style={adminWindowCardStyle}>
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex min-w-0 flex-1 flex-col gap-3 xl:flex-row xl:items-center">
            <div className="min-w-0 flex-1 xl:max-w-[420px]">
              <div className={`${compactSideInputWrapClassName} !mt-0 !h-[38.4px] min-w-0 ${isEditable ? '' : '!bg-[color:var(--field-locked-bg)] text-slate-500'} ${nameAvailability.status === 'ready' && !nameAvailability.isAvailable ? '!border-rose-400' : ''}`}>
                <SideInputIcon icon="material" muted={draft.name.trim().length === 0} className="h-[18px] w-[18px]" />
                <input
                  ref={nameSuggestionInputRef}
                  aria-label="Naziv artikla"
                  aria-invalid={isEditable && nameAvailability.status === 'ready' && !nameAvailability.isAvailable}
                  value={draft.name}
                  disabled={!isEditable}
                  autoComplete="off"
                  spellCheck={false}
                  onFocus={() => setOpenIdentitySuggestionField('name')}
                  onBlur={() => setOpenIdentitySuggestionField((current) => (current === 'name' ? null : current))}
                  onChange={(event) => {
                    setDraft((current) => ({ ...current, name: event.target.value }));
                    setOpenIdentitySuggestionField('name');
                  }}
                  placeholder="Naziv artikla"
                  className={`${topBarArticleNameInputClassName} ${isEditable ? 'text-slate-900' : 'cursor-not-allowed text-slate-500'}`}
                />
                <AdminFieldSuggestionMenu
                  anchorRef={nameSuggestionInputRef}
                  open={isEditable && openIdentitySuggestionField === 'name' && nameAvailability.status === 'ready' && !nameAvailability.isAvailable}
                  suggestions={nameAvailability.suggestions.slice(0, 1)}
                  ariaLabel="Predlog naziva artikla"
                  onSelect={(suggestion) => {
                    setDraft((current) => ({ ...current, name: suggestion }));
                    setOpenIdentitySuggestionField(null);
                    window.setTimeout(() => nameSuggestionInputRef.current?.focus(), 0);
                  }}
                />
              </div>
            </div>
            <div className={adminStatusInfoPillGroupClassName}>
              <ActiveStateChip
                active={draft.active}
                editable={isEditable}
                onChange={(next) => applySelectionChange(() => setDraft((current) => ({ ...current, active: next })))}
              />
              {itemLevelNote
                ? (
                  <NoteTagChip
                    value={itemLevelNote}
                    editable={isEditable}
                    menuPlacement="bottom"
                    onChange={(next) => applySelectionChange(() => setItemLevelNote(next))}
                  />
                )
                : (
                  <NeutralDropdownChip
                    value=""
                    editable={isEditable}
                    placeholderLabel="Opombe"
                    onChange={(value) => applySelectionChange(() => setItemLevelNote(value || 'na-zalogi'))}
                    options={ITEM_NOTE_OPTIONS}
                    optionClassName={getNoteTagMenuItemClassName}
                  />
                )}
            </div>
          </div>
          <div className="flex flex-nowrap items-center justify-end gap-3">
            {mode !== 'create' ? (
              <AuditHistoryDrawer
                entityType="item"
                entityId={initialData?.slug ?? articleId ?? draft.slug}
                entityLabel={draft.name || initialData?.itemName || articleId || 'Artikel'}
                buttonClassName={`order-5 ${adminTableNeutralIconButtonClassName}`}
              />
            ) : null}
            <IconButton
              type="button"
              onClick={handleEditModeToggle}
              tone="neutral"
              size="sm"
              className={`order-2 ${adminTableNeutralIconButtonClassName}`}
              aria-label="Uredi artikel"
              title="Uredi"
              disabled={isSaving}
            >
              <PencilIcon />
            </IconButton>
            <IconButton
              type="button"
              onClick={undoLastChange}
              tone="neutral"
              size="sm"
              className={`order-3 ${adminTableNeutralIconButtonClassName}`}
              aria-label="Razveljavi"
              title="Razveljavi"
              disabled={!canUndoStagedChanges}
            >
              <ActionUndoIcon />
            </IconButton>
            <IconButton
              type="button"
              onClick={() => void duplicateItem()}
              tone="neutral"
              size="sm"
              className={`order-4 ${adminTableNeutralIconButtonClassName}`}
              aria-label="Podvoji artikel"
              title="Podvoji"
              disabled={!canDuplicate}
            >
              <CopyIcon />
            </IconButton>
            <IconButton
              type="button"
              onClick={() => void archiveItem()}
              tone="warning"
              size="sm"
              className={`order-6 ${adminTableSelectedWarningIconButtonClassName}`}
              aria-label="Izbriši artikel"
              title="Izbriši"
              disabled={!canArchive}
            >
              <TrashCanIcon />
            </IconButton>
            <Button
              type="button"
              variant="primary"
              size="toolbar"
              className={`order-7 ${topActionSaveButtonClassName}`}
              onClick={() => void save()}
              disabled={!isEditable || !hasUnsavedChanges || isSaving}
            >
              <SaveIcon className={topSaveActionButtonIconClassName} />
              <span>Shrani</span>
            </Button>
          </div>
        </div>
        <ProductTypeSelectorCardRow
          value={productType}
          editable={isEditable}
          onChange={changeProductType}
          embedded
          collapsed={shouldCollapseProductTypeSelector}
          onExpand={expandProductTypeSelector}
          expandDisabled={isSaving}
        />
      </section>
      <div className="-mb-2">
        <EuiTabs
          value={editorTab}
          onChange={(value) => setEditorTab(value as ProductEditorMainTab)}
          tabs={[
            { value: 'basic', label: 'Osnovno' },
            { value: 'sales', label: 'Prodaja' },
            { value: 'simulator', label: 'Simulator' }
          ]}
        />
      </div>
      {editorTab === 'basic' ? (
      <>
      <div className="grid items-stretch gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(340px,0.85fr)]">
        <div className="space-y-4">
          <section className={`${adminWindowCardClassName} h-full p-6`} style={adminWindowCardStyle}>
            <div className="hidden flex flex-wrap items-center gap-2">
              <h1 className="flex min-h-10 flex-1 flex-nowrap items-center gap-1 whitespace-nowrap text-lg font-semibold tracking-tight text-slate-900">
                <span className="inline-flex h-10 min-w-0 flex-1 items-center gap-0">
                  <div className={`inline-flex h-[36px] w-full min-w-[20ch] max-w-[38ch] items-center gap-2 rounded-md border border-slate-300 px-[10px] ${isEditable ? 'bg-white' : 'bg-[color:var(--field-locked-bg)] text-slate-500'}`}>
                    <input
                      aria-label="Naziv artikla"
                      value={draft.name}
                      disabled={!isEditable}
                      onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
                      placeholder="Naziv artikla"
                      className={articleNameInputClassName}
                    />
                  </div>
                </span>
              </h1>
              <div className="ml-auto flex items-center gap-1.5">
                {itemLevelNote
                  ? (
                    <NoteTagChip
                      value={itemLevelNote}
                      editable={isEditable}
                      menuPlacement="bottom"
                      onChange={(next) => applySelectionChange(() => setItemLevelNote(next))}
                    />
                  )
                  : (
                    <NeutralDropdownChip
                      value=""
                      editable={isEditable}
                      placeholderLabel="Opombe"
                      onChange={(value) => applySelectionChange(() => setItemLevelNote(value || 'na-zalogi'))}
                      options={ITEM_NOTE_OPTIONS}
                      optionClassName={getNoteTagMenuItemClassName}
                    />
                  )}
                <ActiveStateChip active={draft.active} editable={isEditable} onChange={(next) => applySelectionChange(() => setDraft((current) => ({ ...current, active: next })))} />
                <IconButton type="button" tone="neutral" className={adminTableNeutralIconButtonClassName} onClick={handleEditModeToggle} aria-label="Uredi artikel" title="Uredi"><PencilIcon /></IconButton>
                <IconButton type="button" tone="neutral" className={adminTableNeutralIconButtonClassName} onClick={() => save(false)} aria-label="Shrani artikel" title="Shrani" disabled={!isEditable}><SaveIcon /></IconButton>
                <button type="button" className={buttonTokenClasses.closeX} onClick={deleteItem} aria-label="Izbriši artikel" title="Izbriši"><TrashCanIcon /></button>
              </div>
            </div>
            <div className="mb-3">
              <h2 className={editorSectionTitleClassName}>Osnovne informacije</h2>
            </div>
            <div className="mb-[15px]">
              <p className="text-sm font-semibold text-slate-900">Pot do kategorije</p>
              <div className="grid grid-cols-[minmax(0,1fr)] items-center">
                <div className="col-span-1 flex min-h-8 items-center px-1">
                  <AdminCategoryBreadcrumbPicker
                    className="flex h-9 items-center rounded-md bg-transparent px-0 !py-0"
                    value={selectedCategoryPath}
                    onChange={(path) => applySelectionChange(() => selectCategoryPath(path))}
                    categoryPaths={categoryPaths}
                    disabled={!isEditable}
                  />
                </div>
              </div>
            </div>
            <div className="mb-5 border-t border-slate-200" />
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="grid grid-cols-1 gap-4 md:col-span-2 md:grid-cols-2">
                {basicProductFields.map((field) => {
                  const availability = field.title === 'Osnovni SKU'
                    ? skuAvailability
                    : field.title === 'URL'
                      ? slugAvailability
                      : null;
                  const identityField = field.title === 'Osnovni SKU'
                    ? 'sku'
                    : field.title === 'URL'
                      ? 'slug'
                      : null;
                  const suggestionInputRef = identityField === 'sku'
                    ? skuSuggestionInputRef
                    : identityField === 'slug'
                      ? slugSuggestionInputRef
                      : null;
                  const hasConflict = availability?.status === 'ready' && !availability.isAvailable;

                  return (
                    <div key={field.title} className="min-h-10">
                      <p className="text-sm font-semibold text-slate-900">{field.title}</p>
                      <div className={`${compactSideInputWrapClassName} ${isEditable ? '' : '!bg-[color:var(--field-locked-bg)] text-slate-500'} ${hasConflict ? '!border-rose-400' : ''}`}>
                        <SideInputIcon icon={field.icon} muted={field.value.trim().length === 0} />
                        <input
                          ref={suggestionInputRef ?? undefined}
                          disabled={!isEditable}
                          style={{ outline: 'none', boxShadow: 'none' }}
                          className={`${compactSideInputClassName} ${isEditable ? '' : 'cursor-not-allowed text-slate-500'}`}
                          value={field.value}
                          aria-invalid={isEditable && hasConflict}
                          autoComplete="off"
                          spellCheck={false}
                          onFocus={() => {
                            if (identityField) setOpenIdentitySuggestionField(identityField);
                          }}
                          onBlur={() => {
                            if (identityField) {
                              setOpenIdentitySuggestionField((current) => (current === identityField ? null : current));
                            }
                          }}
                          onChange={(event) => {
                            field.onChange(event.target.value);
                            if (identityField) setOpenIdentitySuggestionField(identityField);
                          }}
                          placeholder={field.placeholder}
                        />
                        {identityField && suggestionInputRef && availability ? (
                          <AdminFieldSuggestionMenu
                            anchorRef={suggestionInputRef}
                            open={isEditable && openIdentitySuggestionField === identityField && hasConflict}
                            suggestions={availability.suggestions.slice(0, 1)}
                            ariaLabel={identityField === 'sku' ? 'Predlog SKU' : 'Predlog URL'}
                            onSelect={(suggestion) => {
                              field.onChange(suggestion);
                              setOpenIdentitySuggestionField(null);
                              window.setTimeout(() => suggestionInputRef.current?.focus(), 0);
                            }}
                          />
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="space-y-1 pt-0.5 md:col-span-2">
                <label className="text-sm font-semibold text-slate-900">Opis</label>
                <OpisRichTextEditor value={draft.description} editable={isEditable} onChange={(next) => setDraft((current) => ({ ...current, description: next }))} />
              </div>
            </div>
          </section>

        </div>

        <aside
          className={`${adminWindowCardClassName} h-full p-6 outline-none`}
          style={adminWindowCardStyle}
          tabIndex={isMediaEditable ? 0 : -1}
          aria-label="Mediji artikla"
          onPaste={handleMediaPanelPaste}
          onMouseDown={(event) => {
            if (!isMediaEditable || isEditablePasteTarget(event.target)) return;
            event.currentTarget.focus({ preventScroll: true });
          }}
        >
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <EuiTabs
                value={mediaTab}
                onChange={(value) => setMediaTab(value as MediaTab)}
                surface="panel"
                tabClassName="!font-['Inter',system-ui,sans-serif] !tracking-[0]"
                tabs={[
                  { value: 'slike', label: 'Slike' },
                  { value: 'video', label: 'Video' },
                  { value: 'tehnicni', label: 'Tehnični list' }
                ]}
              />
            </div>
            {mediaTab === 'slike' ? (
              <div className="mt-3 space-y-2">
                <input
                  ref={mediaUploadInputRef}
                  type="file"
                  className="hidden"
                  accept="image/*"
                  multiple
                  disabled={!isMediaEditable}
                  onChange={(event) => {
                    const { slotIndex, multiple } = mediaUploadContextRef.current;
                    queueImageUpload(event.target.files, slotIndex, multiple);
                    event.currentTarget.value = '';
                  }}
                />
                <div className="h-[11.5rem]">
                  {mediaImagesDraft.length === 0 ? (
                    <ImageDropzoneField
                        disabled={!isMediaEditable}
                        onPrepareAddFiles={(files) => prepareDropzoneUploadPlan(0, true, files)}
                        className="group !relative !flex h-full w-full !items-center !justify-center !rounded-[8px] !border-0 !bg-[#f5f6f8] text-[#1982bf] hover:!bg-[#f3f5f7]"
                      >
                        <CalmDashedOutline
                          className="inset-0 text-[#c8c8c8]"
                          strokeWidth={1.1664}
                          dashLength={3.77}
                          gapLength={2.95}
                          lineCap="butt"
                        />
                        <span className="relative z-[1] flex flex-col items-center justify-center gap-2 text-center">
                          <ImageUploadFrameIcon className="h-[84px] w-[84px] text-[#1982bf]" />
                          <span className="text-base font-semibold text-slate-800">Naloži sliko</span>
                          <span className="text-xs font-medium text-slate-500">(največ 4 MB)</span>
                        </span>
                    </ImageDropzoneField>
                  ) : (
                    <div className="grid h-full grid-cols-5 grid-rows-2 gap-2">
                      <div
                        className={`group relative col-span-2 row-span-2 overflow-hidden rounded-[8px] border border-slate-300 ${isMediaEditable ? 'cursor-grab' : ''}`}
                        draggable={Boolean(isMediaEditable)}
                        onDragStart={() => {
                          suppressImageClickAfterDragRef.current = true;
                          setDraggedImageIndex(0);
                        }}
                        onDragEnd={() => {
                          suppressImageClickAfterDragRef.current = false;
                        }}
                        onDragOver={(event) => {
                          if (!isMediaEditable) return;
                          event.preventDefault();
                        }}
                        onDrop={(event) => {
                          event.preventDefault();
                          if (!isMediaEditable || draggedImageIndex === null) return;
                          moveImageSlot(draggedImageIndex, 0);
                          setDraggedImageIndex(null);
                          suppressImageClickAfterDragRef.current = false;
                        }}
                        onClick={() => {
                          if (!isMediaEditable) return;
                          if (suppressImageClickAfterDragRef.current) {
                            suppressImageClickAfterDragRef.current = false;
                            return;
                          }
                          setEditingImageSlot(0);
                        }}
                      >
                        <Image
                          src={mediaImagesDraft[0]}
                          alt="Glavna slika"
                          width={1200}
                          height={1200}
                          unoptimized
                          sizes="(max-width: 1280px) 36vw, 420px"
                          className="h-full w-full object-cover"
                          onLoad={(event) => recordImageDimensions(0, mediaImagesDraft[0], event.currentTarget)}
                        />
                        {renderImageActionButtons(0)}
                      </div>
                      {Array.from({ length: GALLERY_SMALL_SLOT_COUNT }).map((_, smallIndex) => {
                        const slotIndex = smallIndex + 1;
                        const slotImage = mediaImagesDraft[slotIndex];
                        const nextUploadSlot = Math.min(mediaImagesDraft.length, MEDIA_SLOT_COUNT - 1);
                        const isActiveUploadSlot = !slotImage && mediaImagesDraft.length < MEDIA_SLOT_COUNT && slotIndex === nextUploadSlot;

                        if (slotImage) {
                          return (
                            <div
                              key={`slot-${slotIndex}`}
                              className={`group relative overflow-hidden rounded-[8px] border border-slate-300 ${isMediaEditable ? 'cursor-grab' : ''}`}
                              draggable={Boolean(isMediaEditable)}
                              onDragStart={() => {
                                suppressImageClickAfterDragRef.current = true;
                                setDraggedImageIndex(slotIndex);
                              }}
                              onDragEnd={() => {
                                suppressImageClickAfterDragRef.current = false;
                              }}
                              onDragOver={(event) => {
                                if (!isMediaEditable) return;
                                event.preventDefault();
                              }}
                              onDrop={(event) => {
                                event.preventDefault();
                                if (!isMediaEditable || draggedImageIndex === null) return;
                                moveImageSlot(draggedImageIndex, slotIndex);
                                setDraggedImageIndex(null);
                                suppressImageClickAfterDragRef.current = false;
                              }}
                              onClick={() => {
                                if (!isMediaEditable) return;
                                if (suppressImageClickAfterDragRef.current) {
                                  suppressImageClickAfterDragRef.current = false;
                                  return;
                                }
                                setEditingImageSlot(slotIndex);
                              }}
                            >
                              <Image
                                src={slotImage}
                                alt={`Slika ${slotIndex + 1}`}
                                width={720}
                                height={720}
                                unoptimized
                                sizes="(max-width: 1280px) 18vw, 180px"
                                className="h-full w-full object-cover"
                                onLoad={(event) => recordImageDimensions(slotIndex, slotImage, event.currentTarget)}
                              />
                              {renderImageActionButtons(slotIndex)}
                            </div>
                          );
                        }

                        if (isActiveUploadSlot) {
                          return (
                            <ImageDropzoneField
                                key={`slot-${slotIndex}`}
                                disabled={!isMediaEditable}
                                onPrepareAddFiles={(files) => prepareDropzoneUploadPlan(slotIndex, true, files)}
                                className="group !relative !flex h-full !items-center !justify-center !rounded-[8px] !border-0 !bg-[#f5f6f8] px-2 py-3 text-slate-500 hover:!bg-[#f3f5f7]"
                              >
                                <CalmDashedOutline
                                  className="inset-0 text-[#c8c8c8] transition group-hover:text-[#c8c8c8]"
                                  strokeWidth={1.1664}
                                  dashLength={3.77}
                                  gapLength={2.95}
                                  lineCap="butt"
                                />
                                <span className="relative z-[1] flex h-full w-full flex-col items-center justify-center gap-1.5 text-center">
                                  <ImageUploadFrameIcon className="h-[42px] w-[42px] text-[#1982bf]" />
                                  <span className="-translate-y-[7px] text-[10px] font-medium leading-none text-slate-600">Naloži sliko</span>
                                </span>
                            </ImageDropzoneField>
                          );
                        }

                        return (
                          <div
                            key={`slot-${slotIndex}`}
                            className={`relative h-full rounded-[8px] bg-[#f5f6f8] ${isMediaEditable ? '' : 'opacity-60'}`}
                            aria-hidden
                          >
                            <CalmDashedOutline
                              className="inset-0 text-[#c8c8c8]"
                              strokeWidth={1.1664}
                              dashLength={3.77}
                              gapLength={2.95}
                              lineCap="butt"
                            />
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
                <div className="overflow-hidden rounded-lg border border-slate-200">
                  <table className="min-w-full table-fixed text-xs">
                    <thead className="bg-[color:var(--admin-table-header-bg)]">
                      <tr>
                        <th className="w-[34%] px-2 py-1.5 text-left">Slika</th>
                        <th className="w-[13%] px-2 py-1.5 text-center">Format</th>
                        <th className="w-[20%] px-2 py-1.5 text-center">Dimenzije</th>
                        <th className="w-[33%] px-2 py-1.5 text-left">Različice</th>
                      </tr>
                    </thead>
                    <tbody>
                      {mediaImageSlots.length === 0 ? (
                        <tr className="border-t border-slate-100">
                          <td colSpan={4} className="px-3 py-4 text-center text-[11px] text-slate-500">
                            Naložene slike se bodo prikazale tukaj.
                          </td>
                        </tr>
                      ) : mediaImageSlots.map((slot, slotIndex) => {
                        const assignedVariants = draft.variants.flatMap((variant, variantIndex) => {
                          if (!(variant.imageAssignments ?? []).includes(slotIndex)) return [];
                          return [{
                            variant,
                            label: formatImageVariantAssignmentLabel(variant, variantIndex)
                          }];
                        });
                        const availableVariants = draft.variants.flatMap((variant, variantIndex) => {
                          if ((variant.imageAssignments ?? []).includes(slotIndex)) return [];
                          return [{
                            variant,
                            label: formatImageVariantAssignmentLabel(variant, variantIndex)
                          }];
                        });
                        const imageLabel = slotIndex === 0 ? 'Glavna slika' : `Slika ${slotIndex + 1}`;
                        const filename = slot.filename?.trim() || imageLabel;
                        return (
                          <tr
                            key={slot.localId ?? slot.persistedId ?? `${slot.previewUrl}-${slotIndex}`}
                            className="border-t border-slate-100"
                          >
                            <td className="px-2 py-1.5">
                              <div className="flex min-w-0 items-center gap-2">
                                <Image
                                  src={slot.previewUrl}
                                  alt=""
                                  width={32}
                                  height={32}
                                  unoptimized
                                  className="h-8 w-8 shrink-0 rounded-md border border-slate-200 object-cover"
                                  onLoad={(event) => recordImageDimensions(slotIndex, slot.previewUrl, event.currentTarget)}
                                />
                                <div className="min-w-0">
                                  <div className="truncate font-medium text-slate-800">{imageLabel}</div>
                                  <div className="truncate text-[10px] text-slate-500" title={filename}>{filename}</div>
                                </div>
                              </div>
                            </td>
                            <td className="px-2 py-1.5 text-center">
                              {inferImageFormatLabel({
                                mimeType: slot.mimeType,
                                fileName: slot.filename,
                                url: slot.previewUrl
                              })}
                            </td>
                            <td className="px-2 py-1.5 text-center text-[11px] tabular-nums">
                              {formatImagePixelDimensions(slot.imageDimensions)}
                            </td>
                            <td className="px-2 py-1.5">
                              <div className="flex min-w-0 flex-col gap-1">
                                <div className="flex min-w-0 flex-wrap gap-1">
                                  {assignedVariants.length === 0 ? (
                                    <span className="inline-flex h-5 items-center rounded-md border border-emerald-200 bg-emerald-50 px-1.5 text-[10px] font-medium text-emerald-700">
                                      Vse različice
                                    </span>
                                  ) : assignedVariants.map(({ variant, label }) => (
                                    <span
                                      key={`${slotIndex}-${variant.id}`}
                                      className="inline-flex h-5 max-w-full items-center gap-1 rounded-md border border-slate-200 bg-white px-1.5 text-[10px] text-slate-600"
                                      title={label}
                                    >
                                      <span className="truncate">{label}</span>
                                      {isMediaEditable ? (
                                        <button
                                          type="button"
                                          className="shrink-0 text-slate-400 hover:text-rose-600"
                                          onClick={() => removeImageVariantAssignment(slotIndex, variant.id)}
                                          aria-label={`Odstrani povezavo slike z različico ${label}`}
                                        >
                                          ×
                                        </button>
                                      ) : null}
                                    </span>
                                  ))}
                                </div>
                                {isMediaEditable && draft.variants.length > 1 ? (
                                  <select
                                    value=""
                                    onChange={(event) => {
                                      const nextVariantId = event.target.value;
                                      if (nextVariantId === '__all__') clearImageVariantAssignments(slotIndex);
                                      else if (nextVariantId) addImageVariantAssignment(slotIndex, nextVariantId);
                                    }}
                                    className={`${selectTokenClasses.trigger} !h-6 !min-w-0 !px-1.5 !text-[10px]`}
                                    aria-label={`Poveži ${imageLabel.toLowerCase()} z različico`}
                                  >
                                    <option value="">Dodaj različico …</option>
                                    {assignedVariants.length > 0 ? (
                                      <option value="__all__">Vse različice (splošna slika)</option>
                                    ) : null}
                                    {availableVariants.map(({ variant, label }) => (
                                      <option key={variant.id} value={variant.id}>{label}</option>
                                    ))}
                                  </select>
                                ) : null}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <p className="px-0.5 text-[10px] leading-4 text-slate-500">
                  Slika brez povezave velja za vse različice. Povežite jo le, kadar prikazuje točno določeno različico.
                </p>
              </div>
            ) : mediaTab === 'video' ? (
              <div className="mt-3 space-y-2">
                <input
                  id="video-upload-input"
                  type="file"
                  accept="video/*"
                  disabled={!isMediaEditable}
                  className="hidden"
                  onChange={(event) => {
                    void handleVideoFileSelect(event.target.files?.[0]);
                    event.currentTarget.value = '';
                  }}
                />
                <div className="h-[11.5rem]">
                  {videoDraft ? (
                    <div className="group relative h-full overflow-hidden rounded-lg border border-slate-300 bg-black">
                      {videoDraft.source === 'youtube' ? (
                        <iframe
                          title="Predogled videa"
                          className="h-full w-full"
                          src={videoDraft.previewUrl}
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                        />
                      ) : (
                        <video controls className="h-full w-full object-contain">
                          <source src={videoDraft.previewUrl} />
                        </video>
                      )}
                      <div className="absolute inset-y-0 right-2 z-20 flex flex-col items-end justify-start gap-1.5 pt-2 opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100">
                        {[
                          { key: 'remove', label: 'Odstrani', tone: 'danger' as const, onClick: removeVideoDraft, icon: <span aria-hidden className="text-sm leading-none">✕</span> },
                          {
                            key: 'move',
                            label: 'Premakni',
                            tone: 'light' as const,
                            onClick: () => {
                              setVideoMoveMode(true);
                              toast.info('Izberite ciljno celico v stolpcu Video.');
                            },
                            icon: <span className="text-[11px]">↕</span>
                          }
                        ].map((action) => (
                          <button
                            key={action.key}
                            type="button"
                            className={`inline-flex h-[25px] min-w-[1.6rem] items-center justify-center rounded-md border px-0 leading-none shadow-[0_6px_18px_rgba(15,23,42,0.12)] transition focus-visible:border-[color:var(--blue-500)] focus-visible:outline-none focus-visible:ring-0 focus-visible:shadow-none ${action.tone === 'danger' ? 'border-[#f1c1bd] bg-white text-[#d2554a] hover:bg-[#fff7f6]' : 'border-slate-200 bg-white text-slate-900 hover:bg-slate-50'}`}
                            onPointerDown={(event) => {
                              event.stopPropagation();
                              event.preventDefault();
                            }}
                            onClick={(event) => {
                              event.stopPropagation();
                              action.onClick();
                            }}
                            aria-label={action.label}
                            title={action.label}
                          >
                            <span className="inline-flex h-full w-full items-center justify-center">{action.icon}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div
                      className={`group relative flex h-full w-full flex-col items-center justify-between rounded-[8px] px-5 pb-4 pt-3 text-center transition ${videoDragActive ? 'bg-[#f3f5f7]' : 'bg-[#f5f6f8]'} ${isMediaEditable ? 'cursor-pointer hover:bg-[#f3f5f7]' : 'cursor-not-allowed opacity-60'}`}
                      onClick={() => {
                        if (!isMediaEditable) return;
                        document.getElementById('video-upload-input')?.click();
                      }}
                      onDragEnter={(event) => {
                        if (!isMediaEditable) return;
                        event.preventDefault();
                        setVideoDragActive(true);
                      }}
                      onDragOver={(event) => {
                        if (!isMediaEditable) return;
                        event.preventDefault();
                        setVideoDragActive(true);
                      }}
                      onDragLeave={(event) => {
                        if (!isMediaEditable) return;
                        event.preventDefault();
                        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                          setVideoDragActive(false);
                        }
                      }}
                      onDrop={(event) => {
                        if (!isMediaEditable) return;
                        event.preventDefault();
                        setVideoDragActive(false);
                        void handleVideoFileSelect(event.dataTransfer.files?.[0]);
                      }}
                    >
                      <CalmDashedOutline
                        className="inset-0 text-[#c8c8c8]"
                        strokeWidth={1.1664}
                        dashLength={3.77}
                        gapLength={2.95}
                        lineCap="butt"
                      />
                      <div className="relative z-[1] flex flex-1 flex-col items-center justify-center">
                        <VideoUploadFrameIcon className="h-[72px] w-[72px] text-[#1982bf]" />
                        <div className="mt-1 flex flex-col items-center justify-center leading-tight">
                          <span className="text-base font-semibold text-slate-800">Naloži video</span>
                          <span className="mt-1 text-xs font-medium text-slate-500">(največ 100 MB)</span>
                        </div>
                      </div>
                      <div className="relative z-[1] mt-3 w-full max-w-[340px] pb-1">
                        <div
                          className="flex h-[30px] items-center gap-1 rounded-md border border-slate-200 bg-white px-1"
                          onClick={(event) => event.stopPropagation()}
                          onPointerDown={(event) => event.stopPropagation()}
                        >
                          <input
                            className="h-full w-full border-0 bg-transparent px-1.5 text-sm text-slate-500 outline-none placeholder:font-normal placeholder:text-slate-300 placeholder:opacity-100 focus:ring-0"
                            value={youtubeInput}
                            disabled={!isMediaEditable}
                            onChange={(event) => setYoutubeInput(event.target.value)}
                            onPaste={(event) => {
                              const pastedText = event.clipboardData.getData('text');
                              const didEmbed = submitYoutubeVideo(pastedText);
                              if (didEmbed) {
                                event.preventDefault();
                              }
                            }}
                            onBlur={() => {
                              if (!youtubeInput.trim()) return;
                              void submitYoutubeVideo(youtubeInput, { showError: true });
                            }}
                            onKeyDown={(event) => {
                              if (event.key !== 'Enter') return;
                              event.preventDefault();
                              submitYoutubeVideo(youtubeInput, { showError: true });
                            }}
                            placeholder="https://youtube.com/watch?v=..."
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                <div className="overflow-hidden rounded-lg border border-slate-200">
                  <table className="min-w-full text-xs">
                    <thead className="bg-[color:var(--admin-table-header-bg)]">
                      <tr>
                        <th className="px-2 py-1.5 text-left">SKU</th>
                        <th className="px-2 py-1.5 text-center">Tip</th>
                        <th className="px-2 py-1.5 text-left">Video</th>
                      </tr>
                    </thead>
                    <tbody>
                      {draft.variants.map((variant) => {
                        const hasVideoInCell = Boolean(videoDraft) && videoAssignedVariantId === variant.id;
                        const canPlaceHere = Boolean(videoDraft) && isMediaEditable && videoMoveMode;
                        return (
                        <tr key={`variant-video-${variant.id}`} className="border-t border-slate-100">
                          <td className="px-2 py-1.5">{variant.sku || '—'}</td>
                          <td className="px-2 py-1.5 text-center">{hasVideoInCell ? (videoDraft?.source === 'youtube' ? 'YouTube' : 'Upload') : '—'}</td>
                          <td className="px-2 py-1.5 text-left">
                            <button
                              type="button"
                              disabled={!canPlaceHere && !hasVideoInCell}
                              className={`inline-flex h-[18px] items-center gap-1 overflow-hidden rounded-md border px-1 text-[11px] transition ${hasVideoInCell ? 'border-slate-200 bg-white text-slate-600' : canPlaceHere ? 'border-[#9cb8ea] bg-[#f0f6ff] text-[#1982bf] hover:bg-[#e6f0ff]' : 'border-transparent bg-transparent text-slate-400'}`}
                              onClick={() => {
                                if (!canPlaceHere) return;
                                setVideoAssignedVariantId(variant.id);
                                setVideoMoveMode(false);
                              }}
                            >
                              {hasVideoInCell ? (
                                <span className="max-w-[120px] truncate">{videoDraft?.label}</span>
                              ) : canPlaceHere ? 'Postavi video' : '—'}
                            </button>
                          </td>
                        </tr>
                      )})}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="mt-3 space-y-2">
                <input
                  ref={technicalUploadInputRef}
                  type="file"
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.csv,.dwg"
                  className="hidden"
                  disabled={!isMediaEditable}
                  onChange={(event) => {
                    void handleTechnicalFileSelect(event.target.files?.[0]);
                    event.currentTarget.value = '';
                  }}
                />
                <div className="h-[11.5rem]">
                  <div
                    className={`group relative flex h-full w-full flex-col items-center justify-center rounded-[8px] bg-[#f5f6f8] px-5 pb-4 pt-3 text-center transition ${isMediaEditable ? 'cursor-pointer hover:bg-[#f3f5f7]' : 'cursor-not-allowed opacity-60'}`}
                    onClick={() => {
                      if (!isMediaEditable) return;
                      technicalUploadInputRef.current?.click();
                    }}
                    onDragOver={(event) => {
                      if (!isMediaEditable) return;
                      event.preventDefault();
                    }}
                    onDrop={(event) => {
                      if (!isMediaEditable) return;
                      event.preventDefault();
                      void handleTechnicalFileSelect(event.dataTransfer.files?.[0]);
                    }}
                  >
                    <CalmDashedOutline
                      className="inset-0 text-[#c8c8c8]"
                      strokeWidth={1.1664}
                      dashLength={3.77}
                      gapLength={2.95}
                      lineCap="butt"
                    />
                    <DocumentUploadFrameIcon className="relative z-[1] h-[72px] w-[72px] text-[#1982bf]" />
                    <div className="relative z-[1] mt-1 flex flex-col items-center justify-center leading-tight">
                      <span className="text-base font-semibold text-slate-800">Naloži tehnični list</span>
                      <span className="mt-1 text-xs font-medium text-slate-500">(največ 5 MB)</span>
                    </div>
                  </div>
                </div>
                <div className="overflow-hidden rounded-lg border border-slate-200">
                  <table className="min-w-full text-xs">
                    <thead className="bg-[color:var(--admin-table-header-bg)]">
                      <tr>
                        <th className="px-2 py-1.5 text-left">Datoteka</th>
                        <th className="px-2 py-1.5 text-right">Velikost</th>
                      </tr>
                    </thead>
                    <tbody>
                      {documents.length > 0 ? documents.map((documentEntry) => (
                        <tr key={documentEntry.name} className="border-t border-slate-100">
                          <td className="px-2 py-1.5">{documentEntry.name}</td>
                          <td className="px-2 py-1.5 text-right">{documentEntry.size}</td>
                        </tr>
                      )) : (
                        <tr className="border-t border-slate-100">
                          <td className="px-2 py-2 text-slate-500" colSpan={2}>Ni naloženih dokumentov.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </aside>
      </div>
      </>
      ) : null}

      {editorTab === 'sales' ? (
      <div id="product-measurements" className="scroll-mt-24">
      {isDimensionBasedMode ? (
      <section className={`${adminWindowCardClassName} ${dimensionEditorInputHeightClassName} px-5 pb-5 pt-5`} style={adminWindowCardStyle}>
        <div className="mb-3">
          <h2 className={editorSectionTitleClassName}>Prodajne informacije</h2>
        </div>
        <div className="mb-3 space-y-1 px-1">
          <div className="flex flex-wrap items-start gap-x-4 gap-y-1">
            <p className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5 text-[12px] font-medium leading-5 text-slate-600">
              <span>Vnesi debelino/fi, dolžino in po potrebi širino v en vnos, na primer:</span>
              <span className={adminProductInputChipClassName}>Debelina/fi: 0,5; 0,3</span>
              <span className={adminProductInputChipClassName}>Dolžina: 100; 200</span>
              <span>in</span>
              <span className="inline-flex items-center">
                <span className={adminProductInputChipClassName}>Širina: 100; 200</span>
                <span>.</span>
              </span>
            </p>
          </div>
          <p className="flex flex-wrap items-center gap-1.5 text-[12px] font-medium leading-5 text-slate-600">
            <span className="font-semibold">Vnosne bližnjice:</span>
            <span className={adminProductInputChipClassName}>d:</span>
            <span className={adminProductInputChipClassName}>s:</span>
            <span className={adminProductInputChipClassName}>fi:</span>
            <span className="inline-flex items-center">
              <span className={adminProductInputChipClassName}>v:</span>
              <span>.</span>
            </span>
          </p>
        </div>
        <ProductVariantOptionsCard
          editable={isEditable}
          axes={draft.optionAxes}
          variants={draft.variants}
          onAxesChange={(optionAxes) => {
            const validValueIdsByAxis = new Map(
              optionAxes.map((axis) => [axis.id, new Set(axis.values.map((value) => value.id))])
            );
            setDraft((current) => ({
              ...current,
              optionAxes,
              variants: current.variants.map((variant) => ({
                ...variant,
                optionSelections: Object.fromEntries(
                  Object.entries(variant.optionSelections ?? {}).filter(([axisId, valueId]) =>
                    validValueIdsByAxis.get(axisId)?.has(valueId)
                  )
                )
              }))
            }));
          }}
          onVariantChange={updateVariant}
        />
        <div className="relative rounded-lg border border-slate-200">
          <div className="flex min-w-0 flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-3 py-2">
            <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
              <h3 className="text-sm font-semibold text-slate-900">
                Različice
                <span className="ml-1.5 font-normal text-slate-500">({draft.variants.length})</span>
              </h3>
              {dimensionVariantViewMode === 'rows' && draft.variants.length > 1 ? (
                <p className="text-[10px] font-medium text-slate-500">
                  Povlecite ročico za vrstni red. Razširjena različica je vir za ikono »Uporabi za vse« ob polju.
                </p>
              ) : null}
            </div>
            <div className="flex min-w-0 flex-wrap items-center justify-end gap-3">
              <SegmentedControl
                size="sm"
                value={dimensionVariantViewMode}
                onChange={(value) => setDimensionVariantViewMode(value as DimensionVariantViewMode)}
                options={[
                  {
                    value: 'columns',
                    label: 'Polja v stolpcih',
                    activeClassName: '!rounded-[4px] !bg-[color:var(--blue-600)] !text-white',
                    idleClassName: '!rounded-[4px]'
                  },
                  {
                    value: 'rows',
                    label: 'Polja v vrsticah',
                    activeClassName: '!rounded-[4px] !bg-[color:var(--blue-600)] !text-white',
                    idleClassName: '!rounded-[4px]'
                  }
                ]}
                className="!h-[30px] !gap-0 !rounded-md !border !border-slate-300 !bg-white !p-0 [&>button]:!h-full [&>button]:!px-4 [&>button]:!text-[10px]"
              />
              {dimensionVariantViewMode === 'rows' ? (
                <>
                  <div className="inline-flex items-center gap-2 text-[10px] font-medium text-slate-600">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={collapseInactiveDimensionVariants}
                      aria-label="Skrči neaktivne različice"
                      className={`relative inline-flex h-5 w-9 shrink-0 rounded-full border transition ${
                        collapseInactiveDimensionVariants
                          ? 'border-[color:var(--blue-600)] bg-[color:var(--blue-600)]'
                          : 'border-slate-300 bg-slate-200'
                      }`}
                      onClick={() => setCollapseInactiveDimensionVariants((current) => !current)}
                    >
                      <span
                        className={`absolute top-0.5 h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-transform ${
                          collapseInactiveDimensionVariants ? 'translate-x-[17px]' : 'translate-x-0.5'
                        }`}
                      />
                    </button>
                    Skrči neaktivne
                  </div>
                  <button
                    type="button"
                    className="inline-flex h-[30px] items-center gap-1.5 rounded-md px-2 text-[10px] font-semibold text-[color:var(--blue-700)] transition hover:bg-sky-50 disabled:cursor-not-allowed disabled:text-slate-400 disabled:hover:bg-transparent"
                    disabled={!firstSelectedDimensionVariant}
                    onClick={() => {
                      if (firstSelectedDimensionVariant) setExpandedDimensionVariantId(firstSelectedDimensionVariant.id);
                    }}
                  >
                    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden>
                      <path d="M6 2H2v4M10 14h4v-4M2.5 5.5 6 2M13.5 10.5 10 14" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    Razširi izbrano
                  </button>
                </>
              ) : null}
            </div>
          </div>
          <div className="grid min-w-0 gap-3 border-b border-slate-200 bg-white px-3 py-3 lg:grid-cols-[minmax(90px,0.7fr)_minmax(280px,520px)_minmax(300px,1fr)] lg:items-center">
            <span className="text-[11px] font-semibold text-slate-500">Generator različic</span>
            <div className="w-full min-w-0 justify-self-center">
              <div className="relative w-full min-w-0">
                <div className={`flex h-[30px] flex-nowrap items-center gap-2 overflow-hidden rounded-md border border-slate-300 !bg-white pl-[10px] pr-11 ${isGeneratorLocked ? 'text-slate-500' : ''}`}>
                  {generatorChips.map((chip) => (
                    <span
                      key={chip.dimension}
                      className={`${adminProductInputChipClassName} shrink-0 whitespace-nowrap ${isGeneratorLocked ? '' : '!gap-0.5 !pr-1'}`.trim()}
                    >
                      {isGeneratorLocked ? (
                        <span>{`${generatorDimensionLabels[chip.dimension]}: ${chip.values.map((value) => formatDecimalForDisplay(value)).join('; ')}`}</span>
                      ) : (
                        <>
                          <button
                            type="button"
                            className="whitespace-nowrap hover:text-[#0f6799]"
                            onClick={() => {
                              setGeneratorInput(`${generatorDimensionLabels[chip.dimension]}: ${chip.values.map((value) => formatDecimalForDisplay(value)).join('; ')}`);
                              setGeneratorChips((current) => current.filter((entry) => entry.dimension !== chip.dimension));
                            }}
                          >
                            {`${generatorDimensionLabels[chip.dimension]}: ${chip.values.map((value) => formatDecimalForDisplay(value)).join('; ')}`}
                          </button>
                          <button
                            type="button"
                            aria-label={`Odstrani ${generatorDimensionLabels[chip.dimension]}`}
                            className="inline-flex h-3 w-3 items-center justify-center rounded-full text-[12px] leading-none text-current transition hover:text-[color:var(--danger-600)] active:text-[color:var(--danger-600)]"
                            onClick={() => setGeneratorChips((current) => current.filter((entry) => entry.dimension !== chip.dimension))}
                          >
                            &times;
                          </button>
                        </>
                      )}
                    </span>
                  ))}
                  {isGeneratorLocked ? (
                    <span className="h-full min-w-0 flex-1 !bg-white" aria-hidden="true" />
                  ) : (
                    <input
                      className="h-full min-w-0 flex-1 border-0 !bg-transparent text-xs text-slate-900 outline-none focus:ring-0"
                      value={generatorInput}
                      onChange={(event) => {
                        setGeneratorInput(event.target.value);
                        if (generatorError) setGeneratorError(null);
                      }}
                      placeholder={generatorChips.length > 0 ? '' : 'Debelina/fi: 0,5; 0,3 + enter'}
                      onKeyDown={(event) => {
                        if (event.key !== 'Enter') return;
                        event.preventDefault();
                        submitGeneratorEntry();
                      }}
                    />
                  )}
                </div>
                <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-400">{combinationCount}</span>
              </div>
              {generatorError ? <div className="mt-1 text-xs text-rose-600">{generatorError}</div> : null}
            </div>
            <div className="flex items-center justify-end gap-2 justify-self-end">
              <IconButton
                type="button"
                aria-label="Dodaj različico"
                title="Dodaj različico"
                tone="neutral"
                className={adminTableNeutralIconButtonClassName}
                disabled={!isTableEditable}
                onClick={() => setDraft((current) => {
                  const nextVariant = createVariant({
                    sort: Math.max(0, ...current.variants.map((variant) => variant.sort || 0)) + 1
                  });
                  return {
                    ...current,
                    defaultVariantId: current.defaultVariantId ?? nextVariant.id,
                    variants: [...current.variants, nextVariant]
                  };
                })}
              >
                <PlusIcon />
              </IconButton>
              <IconButton
                type="button"
                aria-label="Podvoji izbrano različico"
                title="Podvoji izbrano različico"
                tone="neutral"
                className={adminTableNeutralIconButtonClassName}
                disabled={!isTableEditable || variantSelections.size !== 1}
                onClick={duplicateSelectedDimensionVariant}
              >
                <CopyIcon />
              </IconButton>
              <IconButton
                type="button"
                aria-label="Odstrani izbrane različice"
                title="Izbriši izbrane"
                tone={hasSelectedVariants ? 'danger' : 'neutral'}
                className={hasSelectedVariants ? adminTableSelectedDangerIconButtonClassName : adminTableNeutralIconButtonClassName}
                disabled={!isTableEditable || !hasSelectedVariants}
                onClick={deleteSelectedVariants}
              >
                <TrashCanIcon />
              </IconButton>
              <Button
                type="button"
                variant="primary"
                size="toolbar"
                className={adminTablePrimaryButtonClassName}
                disabled={!isTableEditable}
                onClick={generateVariants}
              >
                Generiraj različice
              </Button>
            </div>
          </div>
          <div className="relative">
          <div
            ref={dimensionVariantScrollRef}
            className="overflow-x-auto overflow-y-visible overscroll-x-contain"
          >
          {dimensionVariantViewMode === 'columns' ? (
          <table className="w-full table-fixed text-[10px] leading-4">
            <colgroup>
              <col style={{ width: '28px' }} />
              <col style={{ width: '34px' }} />
              <col style={{ width: '272px' }} />
              <col style={{ width: '48px' }} />
              <col style={{ width: '58px' }} />
              <col style={{ width: '58px' }} />
              <col style={{ width: '58px' }} />
              <col style={{ width: '66px' }} />
              <col style={{ width: '52px' }} />
              <col style={{ width: '62px' }} />
              <col style={{ width: '66px' }} />
              <col style={{ width: '48px' }} />
              <col style={{ width: '50px' }} />
              <col style={{ width: '65px' }} />
              <col style={{ width: '150px' }} />
              <col style={{ width: '76px' }} />
              <col style={{ width: '88px' }} />
            </colgroup>
            <THead>
              <tr>
                <TH className={`${adminTableRowHeightClassName} px-0.5 py-1.5 text-center text-[9px]`}>
                  <AdminCheckbox
                    aria-label="Izberi vse različice"
                    checked={isTableEditable && allVariantsSelected}
                    onChange={() =>
                      setVariantSelections(allVariantsSelected ? new Set() : new Set(draft.variants.map((variant) => variant.id)))
                    }
                    disabled={!isTableEditable}
                  />
                </TH>
                <TH
                  className={`${adminTableRowHeightClassName} whitespace-nowrap px-0.5 py-1.5 text-center text-[9px]`}
                  title="Privzeta različica"
                >
                  Privz.
                </TH>
                <TH className={`${adminTableRowHeightClassName} px-0.5 py-1.5 text-center text-[9px]`} title="Dolžina × širina × višina / debelina">Dimenzije</TH>
                <TH className={`${adminTableRowHeightClassName} whitespace-nowrap px-0.5 py-1.5 text-right text-[9px]`} title="Masa">Masa</TH>
                <TH className={`${adminTableRowHeightClassName} whitespace-nowrap px-0.5 py-1.5 text-center text-[9px]`} title="Toleranca">Tol.</TH>
                <TH className={`${adminTableRowHeightClassName} whitespace-nowrap px-0.5 py-1.5 text-right text-[9px]`} title="Nabavna cena brez DDV">Nabavna</TH>
                <TH className={`${adminTableRowHeightClassName} whitespace-nowrap px-0.5 py-1.5 text-right text-[9px]`} title="Prodajna cena brez DDV">Prod. brez</TH>
                <TH className={`${adminTableRowHeightClassName} whitespace-nowrap px-0.5 py-1.5 text-right text-[9px]`} title="Prodajna cena z DDV">Prod. z DDV</TH>
                <TH className={`${adminTableRowHeightClassName} px-0.5 py-1.5 text-right text-[9px]`}>Popust</TH>
                <TH className={`${adminTableRowHeightClassName} whitespace-nowrap px-0.5 py-1.5 text-right text-[9px]`} title="Akcijska cena brez DDV">Akc. brez</TH>
                <TH className={`${adminTableRowHeightClassName} whitespace-nowrap px-0.5 py-1.5 text-right text-[9px]`} title="Akcijska cena z DDV">Akc. z DDV</TH>
                <TH className={`${adminTableRowHeightClassName} whitespace-nowrap px-0.5 py-1.5 text-right text-[9px]`}>Zaloga</TH>
                <TH className={`${adminTableRowHeightClassName} whitespace-nowrap px-0.5 py-1.5 text-right text-[9px]`} title="Minimalno naročilo">Min.</TH>
                <TH className={`${adminTableRowHeightClassName} whitespace-nowrap px-0.5 py-1.5 text-center text-[9px]`} title="Dobavni rok">Rok</TH>
                <TH className={`${adminTableRowHeightClassName} px-0.5 py-1.5 text-center text-[9px]`}>SKU</TH>
                <TH className={`${adminTableRowHeightClassName} px-0.5 py-1.5 text-center text-[9px]`}>Status</TH>
                <TH className={`${adminTableRowHeightClassName} px-0.5 py-1.5 text-center text-[9px]`} title="Opomba">Opomba</TH>
              </tr>
            </THead>
            <tbody>
              {draft.variants.map((variant) => (
                <tr key={variant.id} className={`${adminTableRowHeightClassName} border-t border-slate-100 align-middle`}>
                  <td className="px-0.5 py-1.5 text-center">
                    <AdminCheckbox
                      aria-label={`Izberi ${buildDimensionVariantHeaderLabel(
                        variant,
                        Math.max(0, draft.variants.findIndex((entry) => entry.id === variant.id)),
                        true
                      )}`}
                      checked={variantSelections.has(variant.id)}
                      onChange={() => setVariantSelections((current) => {
                        const next = new Set(current);
                        if (next.has(variant.id)) next.delete(variant.id);
                        else next.add(variant.id);
                        return next;
                      })}
                      disabled={!isTableEditable}
                    />
                  </td>
                  <td className="px-0.5 py-1.5 text-center">
                    <input
                      type="radio"
                      name="default-dimension-variant"
                      aria-label={`Nastavi ${variant.label || variant.sku || 'različico'} kot privzeto`}
                      title={variant.active ? 'Nastavi kot privzeto različico' : 'Neaktivna različica ne more biti privzeta'}
                      className="h-4 w-4 accent-[color:var(--blue-600)] disabled:cursor-not-allowed disabled:opacity-40"
                      checked={resolvedDefaultVariantId === variant.id}
                      disabled={!isTableEditable || !variant.active}
                      onChange={() => selectDefaultDimensionVariant(variant)}
                    />
                  </td>
                  <td className="px-0.5 py-1.5">
                    {renderDimensionVariantTriplet(
                      variant,
                      variant.label || variant.sku || 'različico'
                    )}
                  </td>
                  <td className="px-0.5 py-1.5">
                    {(() => {
                      const displayWeightGrams = catalogWeightKilogramsToDisplayGrams(variant.weight);
                      return (
                    <CompactSegmentedField
                      editable={isTableEditable}
                      value={isTableEditable ? readDecimalInputValue(variant.id, 'weight', displayWeightGrams) : displayWeightGrams === null ? null : formatDecimalForDisplay(displayWeightGrams)}
                      suffix="g"
                      ariaLabel={`Masa za ${variant.label || variant.sku}`}
                      onChange={(value) => updateDecimalInputDraft(variant.id, 'weight', value)}
                      onBlur={() => commitDecimalInputDraft(
                        variant.id,
                        'weight',
                        displayWeightGrams,
                        (value) => updateVariant(variant.id, {
                          weight: catalogWeightDisplayGramsToKilograms(value)
                        }),
                        null
                      )}
                    />
                      );
                    })()}
                  </td>
                  <td className="px-0.5 py-1.5">
                    <CompactSegmentedField
                      editable={isTableEditable}
                      disabled={isToleranceLocked}
                      value={
                        isTableEditable
                          ? decimalInputDrafts[decimalDraftKey(variant.id, 'errorTolerance')] ?? variant.errorTolerance ?? ''
                          : variant.errorTolerance
                            ? variant.errorTolerance.replace('.', ',')
                            : null
                      }
                      prefix="±"
                      suffix="mm"
                      ariaLabel={`Toleranca za ${variant.label || variant.sku}`}
                      onChange={(value) => {
                        if (!isToleranceLocked) updateDecimalInputDraft(variant.id, 'errorTolerance', value);
                      }}
                      onBlur={() => {
                        const key = decimalDraftKey(variant.id, 'errorTolerance');
                        const raw = decimalInputDrafts[key] ?? variant.errorTolerance ?? '';
                        const parsed = parseDecimalInput(raw);
                        updateVariant(variant.id, { errorTolerance: parsed === null ? null : formatDecimalForDisplay(parsed) });
                        setDecimalInputDrafts((current) => {
                          const next = { ...current };
                          delete next[key];
                          return next;
                        });
                      }}
                    />
                  </td>
                  <td className="px-0.5 py-1.5">
                    <CompactSegmentedField
                      editable={isTableEditable}
                      value={isTableEditable ? readDecimalInputValue(variant.id, 'costNet', variant.costNet) : variant.costNet === null || variant.costNet === undefined ? null : formatEuroAmount(variant.costNet)}
                      suffix="€"
                      ariaLabel={`Nabavna cena brez DDV za ${variant.label || variant.sku}`}
                      onChange={(value) => updateDecimalInputDraft(variant.id, 'costNet', value)}
                      onBlur={() => commitDecimalInputDraft(
                        variant.id,
                        'costNet',
                        variant.costNet,
                        (value) => updateVariant(variant.id, { costNet: value === null ? null : Math.max(0, value) }),
                        null
                      )}
                    />
                  </td>
                  <td className="px-0.5 py-1.5">
                    <CompactSegmentedField
                      editable={isTableEditable}
                      value={isTableEditable ? readDecimalInputValue(variant.id, 'price', variant.price) : formatEuroAmount(variant.price)}
                      suffix="€"
                      ariaLabel={`Prodajna cena brez DDV za ${variant.label || variant.sku}`}
                      onChange={(value) => updateDecimalInputDraft(variant.id, 'price', value)}
                      onBlur={() => commitDecimalInputDraft(variant.id, 'price', variant.price, (value) => updateVariant(variant.id, { price: value ?? 0 }), 0)}
                    />
                  </td>
                  <td className="px-0.5 py-1.5">
                    <CompactSegmentedField
                      editable={false}
                      value={formatEuroAmount(computeGrossPrice(variant.price, dimensionVariantTaxRate))}
                      suffix="€"
                      ariaLabel={`Prodajna cena z DDV za ${variant.label || variant.sku}`}
                    />
                  </td>
                  <td className="px-0.5 py-1.5">
                    <CompactSegmentedField
                      editable={isTableEditable}
                      value={isTableEditable ? readDecimalInputValue(variant.id, 'discountPct', variant.discountPct) : formatDecimalForDisplay(variant.discountPct)}
                      suffix="%"
                      ariaLabel={`Popust za ${variant.label || variant.sku}`}
                      onChange={(value) => updateDecimalInputDraft(variant.id, 'discountPct', value)}
                      onBlur={() => commitDecimalInputDraft(variant.id, 'discountPct', variant.discountPct, (value) => updateVariant(variant.id, { discountPct: Math.min(99.9, Math.max(0, value ?? 0)) }), 0)}
                    />
                  </td>
                  <td className="px-0.5 py-1.5">
                    <CompactSegmentedField
                      editable={false}
                      value={variant.discountPct > 0 ? formatEuroAmount(computeSalePrice(variant.price, variant.discountPct)) : null}
                      suffix="€"
                      ariaLabel={`Akcijska cena brez DDV za ${variant.label || variant.sku}`}
                    />
                  </td>
                  <td className="px-0.5 py-1.5">
                    <CompactSegmentedField
                      editable={false}
                      value={
                        variant.discountPct > 0
                          ? formatEuroAmount(
                              computeGrossPrice(
                                computeSalePrice(variant.price, variant.discountPct),
                                dimensionVariantTaxRate
                              )
                            )
                          : null
                      }
                      suffix="€"
                      ariaLabel={`Akcijska cena z DDV za ${variant.label || variant.sku}`}
                    />
                  </td>
                  <td className="px-0.5 py-1.5">
                    <CompactSegmentedField
                      editable={isTableEditable}
                      inputMode="numeric"
                      value={variant.stock}
                      ariaLabel={`Zaloga za ${variant.label || variant.sku}`}
                      onChange={(value) => updateDimensionVariantStock(variant, Math.max(0, Math.floor(Number(value.replace(/\D/g, '')) || 0)))}
                    />
                  </td>
                  <td className="px-0.5 py-1.5">
                    <CompactSegmentedField
                      editable={isTableEditable}
                      inputMode="numeric"
                      value={variant.minOrder ?? 1}
                      ariaLabel={`Minimalno naročilo za ${variant.label || variant.sku}`}
                      onChange={(value) => updateVariant(variant.id, { minOrder: Math.max(1, Math.floor(Number(value.replace(/\D/g, '')) || 1)) })}
                    />
                  </td>
                  <td className="px-0.5 py-1.5">
                    <CompactSegmentedField
                      editable={isTableEditable}
                      inputMode="numeric"
                      value={
                        decimalInputDrafts[decimalDraftKey(variant.id, 'deliveryTime')]
                        ?? getDeliveryDayAmount(getDimensionVariantDeliveryTime(typeSpecificData.dimensions, variant))
                      }
                      suffix="dni"
                      placeholder="1-2"
                      ariaLabel={`Dobavni rok za ${variant.label || variant.sku}`}
                      title={getDimensionVariantDeliveryTime(typeSpecificData.dimensions, variant)}
                      onChange={(value) => updateDimensionVariantDeliveryDraft(variant.id, value)}
                      onBlur={() => commitDimensionVariantDeliveryDraft(variant)}
                    />
                  </td>
                  <td className="px-0.5 py-1.5">
                    <CompactSegmentedField
                      editable={isTableEditable}
                      value={variant.sku}
                      inputMode="text"
                      align="left"
                      ariaLabel={`SKU za ${variant.label || variant.sku}`}
                      title={variant.sku || undefined}
                      onChange={(value) => updateVariant(variant.id, { sku: value, skuAutoGenerated: false })}
                    />
                  </td>
                  <td className="px-0.5 py-1.5 text-center">
                    <div className="inline-flex w-full justify-center">
                      <ActiveStateChip
                        active={variant.active}
                        editable={isTableEditable}
                        chipClassName={`${adminStatusInfoPillVariantTableClassName} !w-full !min-w-0 !px-1 !text-[9px]`}
                        menuPlacement="bottom"
                        onChange={(next) => applySelectionChange(() => updateDimensionVariantActiveState(variant.id, next))}
                      />
                    </div>
                  </td>
                  <td className="px-0.5 py-1.5 text-center">
                    <div className="inline-flex w-full justify-center">
                      <NoteTagChip
                        value={getVariantTag(variant)}
                        editable={isTableEditable}
                        chipClassName={`${adminStatusInfoPillVariantTableClassName} !w-full !min-w-0 !px-1 !text-[9px]`}
                        menuPlacement="bottom"
                        onChange={(next) => {
                          if (!next) return;
                          applySelectionChange(() => setVariantTag(variant.id, next));
                        }}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          ) : draft.variants.length === 0 ? (
            <div className="border-b border-slate-200 px-4 py-10 text-center">
              <p className="text-sm font-semibold text-slate-700">Ni različic za prikaz.</p>
              <p className="mt-1 text-[11px] text-slate-500">
                Dodajte različico ali vnesite mere in izberite »Generiraj različice«.
              </p>
            </div>
          ) : (
            <div
              role="table"
              aria-label="Različice artikla s polji v vrsticah"
              className="admin-variant-matrix-track-transition grid min-w-full bg-transparent"
              style={{
                minWidth: `${Math.max(720, dimensionMatrixMinWidth)}px`,
                gridTemplateColumns: dimensionMatrixGridTemplateColumns
              }}
            >
              <DndContext
                sensors={dimensionVariantSensors}
                collisionDetection={closestCenter}
                onDragStart={handleDimensionVariantDragStart}
                onDragEnd={handleDimensionVariantDragEnd}
                onDragCancel={() => setDraggedDimensionVariantId(null)}
              >
                <SortableContext
                  items={draft.variants.map((variant) => variant.id)}
                  strategy={horizontalListSortingStrategy}
                >
                  <div
                    role="row"
                    className="admin-variant-matrix-row relative grid border-b border-slate-200 bg-slate-50/80"
                    style={{
                      height: `${dimensionVariantHeaderHeight}px`,
                      clipPath: `polygon(0 0, calc(100% - ${dimensionVariantHeaderSlant}px) 0, 100% ${dimensionVariantDiagonalHeight}px, 100% 100%, 0 100%)`
                    }}
                  >
                    <div
                      role="columnheader"
                      className="sticky left-0 z-30 flex items-end px-3 pb-2 text-[11px] font-bold text-slate-700"
                    >
                      <span
                        aria-hidden="true"
                        className="pointer-events-none absolute inset-0 bg-slate-50"
                        style={{
                          clipPath: `polygon(0 0, calc(100% - ${dimensionVariantHeaderSlant}px) 0, 100% ${dimensionVariantDiagonalHeight}px, 100% 100%, 0 100%)`
                        }}
                      />
                      <span className="relative z-10 flex items-center gap-2">
                        <AdminCheckbox
                          aria-label="Izberi vse različice"
                          checked={isTableEditable && allVariantsSelected}
                          onChange={() =>
                            setVariantSelections(allVariantsSelected ? new Set() : new Set(draft.variants.map((variant) => variant.id)))
                          }
                          disabled={!isTableEditable}
                        />
                        Različica
                      </span>
                    </div>
                    {draft.variants.map((variant) => {
                      const variantIndex = Math.max(0, draft.variants.findIndex((entry) => entry.id === variant.id));
                      const variantDisplayName = buildDimensionVariantHeaderLabel(variant, variantIndex);
                      const variantHoverName = buildDimensionVariantHeaderLabel(variant, variantIndex, true);
                      const isExpanded = expandedDimensionVariant?.id === variant.id;
                      const isHovered = hoveredDimensionVariantId === variant.id;
                      const isCompressedInactive = collapseInactiveDimensionVariants && !variant.active;
                      const nextVariantIsExpanded =
                        draft.variants[variantIndex + 1]?.id === expandedDimensionVariant?.id;
                      const expandedVariantHasLeftSlant = variantIndex > 0;
                      if (isExpanded) {
                        return (
                          <DimensionVariantSortableHeader
                            key={variant.id}
                            id={variant.id}
                            label={variantHoverName}
                            disabled={!isTableEditable || draft.variants.length <= 1}
                            className="relative z-20 flex min-w-0 items-end overflow-visible px-2 pb-px"
                          >
                            {(dragHandle) => (
                              <>
                                <span
                                  aria-hidden="true"
                                  className="pointer-events-none absolute bottom-0 h-full bg-sky-50/80"
                                  style={{
                                    left: expandedVariantHasLeftSlant
                                      ? `-${dimensionVariantHeaderSlant}px`
                                      : 0,
                                    width: expandedVariantHasLeftSlant
                                      ? `calc(100% + ${dimensionVariantHeaderSlant}px)`
                                      : '100%',
                                    clipPath: expandedVariantHasLeftSlant
                                      ? `polygon(0 0, calc(100% - ${dimensionVariantHeaderSlant}px) 0, 100% ${dimensionVariantDiagonalHeight}px, 100% 100%, ${dimensionVariantHeaderSlant}px 100%, ${dimensionVariantHeaderSlant}px ${dimensionVariantDiagonalHeight}px)`
                                      : `polygon(0 0, calc(100% - ${dimensionVariantHeaderSlant}px) 0, 100% ${dimensionVariantDiagonalHeight}px, 100% 100%, 0 100%)`
                                  }}
                                />
                                {expandedVariantHasLeftSlant ? (
                                  <span
                                    aria-hidden="true"
                                    className="admin-variant-matrix-diagonal-border pointer-events-none absolute left-0 top-0 z-20 origin-bottom bg-[color:var(--blue-500)]"
                                    style={{
                                      height: `${dimensionVariantDiagonalHeight}px`,
                                      transform: `skewX(${dimensionVariantHeaderAngle}deg)`
                                    }}
                                  />
                                ) : null}
                                <span
                                  aria-hidden="true"
                                  className="pointer-events-none absolute bottom-0 left-0 z-20 w-px bg-[color:var(--blue-500)]"
                                  style={{
                                    height: `${
                                      expandedVariantHasLeftSlant
                                        ? dimensionVariantNormalBandHeight
                                        : dimensionVariantHeaderHeight
                                    }px`
                                  }}
                                />
                                <span
                                  aria-hidden="true"
                                  className="admin-variant-matrix-diagonal-border pointer-events-none absolute right-0 top-0 z-20 origin-bottom bg-[color:var(--blue-500)]"
                                  style={{
                                    height: `${dimensionVariantDiagonalHeight}px`,
                                    transform: `skewX(${dimensionVariantHeaderAngle}deg)`
                                  }}
                                />
                                <span
                                  aria-hidden="true"
                                  className="pointer-events-none absolute bottom-0 right-0 z-20 w-px bg-[color:var(--blue-500)]"
                                  style={{ height: `${dimensionVariantNormalBandHeight}px` }}
                                />
                                <div className="admin-dimension-variant-content-enter relative z-30 flex w-full min-w-0 items-center gap-1.5">
                                  {dragHandle}
                                  <span onClick={(event) => event.stopPropagation()}>
                                    <AdminCheckbox
                                      aria-label={`Izberi ${variantHoverName}`}
                                      checked={variantSelections.has(variant.id)}
                                      onChange={() => toggleDimensionVariantSelection(variant.id)}
                                      disabled={!isTableEditable}
                                    />
                                  </span>
                                  <span
                                    className="min-w-0 flex-1 truncate text-[11px] font-semibold text-slate-900"
                                    title={variantHoverName}
                                  >
                                    {variantDisplayName}
                                  </span>
                                  {draft.variants.length > 1 ? (
                                    <button
                                      type="button"
                                      className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-slate-500 transition hover:bg-white hover:text-[color:var(--blue-700)]"
                                      aria-label="Skrči razširjeno različico"
                                      title="Skrči različico"
                                      onClick={() => setExpandedDimensionVariantId(null)}
                                    >
                                      <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
                                        <path d="m5 6 3 3 3-3" strokeLinecap="round" strokeLinejoin="round" />
                                      </svg>
                                    </button>
                                  ) : null}
                                </div>
                              </>
                            )}
                          </DimensionVariantSortableHeader>
                        );
                      }
                      return (
                        <DimensionVariantSortableHeader
                          key={variant.id}
                          id={variant.id}
                          label={variantHoverName}
                          disabled={!isTableEditable || draft.variants.length <= 1}
                          className={`relative min-w-0 overflow-visible transition-colors ${
                            isHovered
                              ? 'z-10'
                              : isCompressedInactive
                                ? 'opacity-70'
                                : ''
                          }`}
                          onMouseEnter={() => setHoveredDimensionVariantId(variant.id)}
                          onMouseLeave={() => setHoveredDimensionVariantId((current) => current === variant.id ? null : current)}
                        >
                          {(dragHandle) => (
                            <>
                              <button
                                type="button"
                                className={`absolute bottom-0 block h-full overflow-hidden outline-none transition-colors focus-visible:z-20 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[color:var(--blue-500)] ${
                                  isHovered
                                    ? 'bg-sky-50'
                                    : isCompressedInactive
                                      ? 'bg-slate-100/80'
                                      : 'bg-slate-50/80'
                                }`}
                                style={{
                                  left: `-${dimensionVariantHeaderSlant}px`,
                                  width: `calc(100% + ${dimensionVariantHeaderSlant}px)`,
                                  clipPath: `polygon(0 0, calc(100% - ${dimensionVariantHeaderSlant}px) 0, 100% ${dimensionVariantDiagonalHeight}px, 100% 100%, ${dimensionVariantHeaderSlant}px 100%, ${dimensionVariantHeaderSlant}px ${dimensionVariantDiagonalHeight}px)`
                                }}
                                aria-label={`Razširi različico ${variantHoverName}`}
                                title={variantHoverName}
                                onClick={() => {
                                  setExpandedDimensionVariantId(variant.id);
                                  setHoveredDimensionVariantId(null);
                                }}
                              >
                                <span
                                  className="pointer-events-none absolute"
                                  style={{
                                    left: `calc(50% + ${dimensionVariantHeaderTitleOpticalOffset}px)`,
                                    top: `${dimensionVariantDiagonalHeight / 2 + dimensionVariantHeaderTitleOpticalOffset}px`,
                                    transform: 'translate(-50%, -50%)'
                                  }}
                                  aria-hidden="true"
                                >
                                  <span
                                    className={`block origin-center whitespace-nowrap text-[10.5px] font-semibold leading-none text-slate-800 ${
                                      isCompressedInactive ? 'text-slate-500' : ''
                                    }`}
                                    style={{ transform: `rotate(${dimensionVariantHeaderAngle}deg)` }}
                                  >
                                    {variantDisplayName}
                                  </span>
                                </span>
                              </button>
                              {variantIndex === 0 ? (
                                <>
                                  <span
                                    aria-hidden="true"
                                    className="admin-variant-matrix-diagonal-border pointer-events-none absolute left-0 top-0 z-20 origin-bottom bg-slate-300"
                                    style={{
                                      height: `${dimensionVariantDiagonalHeight}px`,
                                      transform: `skewX(${dimensionVariantHeaderAngle}deg)`
                                    }}
                                  />
                                  <span
                                    aria-hidden="true"
                                    className="pointer-events-none absolute bottom-0 left-0 z-20 w-px bg-slate-300"
                                    style={{ height: `${dimensionVariantNormalBandHeight}px` }}
                                  />
                                </>
                              ) : null}
                              {!nextVariantIsExpanded ? (
                                <>
                                  <span
                                    aria-hidden="true"
                                    className="admin-variant-matrix-diagonal-border pointer-events-none absolute right-0 top-0 z-20 origin-bottom bg-slate-300"
                                    style={{
                                      height: `${dimensionVariantDiagonalHeight}px`,
                                      transform: `skewX(${dimensionVariantHeaderAngle}deg)`
                                    }}
                                  />
                                  <span
                                    aria-hidden="true"
                                    className="pointer-events-none absolute bottom-0 right-0 z-20 w-px bg-slate-300"
                                    style={{ height: `${dimensionVariantNormalBandHeight}px` }}
                                  />
                                </>
                              ) : null}
                              <span
                                className="absolute bottom-2 left-1/2 z-30 flex -translate-x-1/2 items-center gap-0.5"
                                onClick={(event) => event.stopPropagation()}
                              >
                                {dragHandle}
                                <AdminCheckbox
                                  aria-label={`Izberi ${variantHoverName}`}
                                  checked={variantSelections.has(variant.id)}
                                  onChange={() => toggleDimensionVariantSelection(variant.id)}
                                  disabled={!isTableEditable}
                                />
                              </span>
                            </>
                          )}
                        </DimensionVariantSortableHeader>
                      );
                    })}
                  </div>
                </SortableContext>
                <DragOverlay dropAnimation={{ duration: 180, easing: 'cubic-bezier(0.2, 0, 0, 1)' }}>
                  {draggedDimensionVariant ? (
                    <div className="rounded-md border border-[color:var(--blue-500)] bg-white px-3 py-2 text-[11px] font-semibold text-slate-800 shadow-lg">
                      {buildDimensionVariantHeaderLabel(
                        draggedDimensionVariant,
                        Math.max(0, draft.variants.findIndex((variant) => variant.id === draggedDimensionVariant.id))
                      )}
                    </div>
                  ) : null}
                </DragOverlay>
              </DndContext>
              {DIMENSION_VARIANT_MATRIX_ROWS.map((row, rowIndex) => {
                const alternatingClassName = rowIndex % 2 === 0 ? 'bg-white' : 'bg-slate-50/45';
                const bulkApplyRowKey = isDimensionVariantBulkApplyRow(row.key)
                  ? row.key
                  : null;
                const bulkApplySourceName = expandedDimensionVariant
                  ? buildDimensionVariantHeaderLabel(
                      expandedDimensionVariant,
                      Math.max(
                        0,
                        draft.variants.findIndex(
                          (variant) => variant.id === expandedDimensionVariant.id
                        )
                      )
                    )
                  : null;
                const canBulkApplyRow =
                  isTableEditable
                  && draft.variants.length > 1
                  && Boolean(expandedDimensionVariant);
                return (
                  <div
                    key={row.key}
                    role="row"
                    className={`admin-variant-matrix-row grid min-h-[38px] border-b border-slate-200 ${alternatingClassName}`}
                  >
                    <div
                      role="rowheader"
                      className={`sticky left-0 z-20 flex min-w-0 items-center gap-1.5 border-r border-slate-200 px-3 text-[11px] font-normal text-slate-700 ${alternatingClassName}`}
                    >
                      <span className="truncate">{row.label}</span>
                      <span
                        className="group/help relative inline-flex h-3 w-3 shrink-0 cursor-help items-center justify-center rounded-full border border-sky-300 text-[8px] font-semibold leading-none text-sky-600 outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-1"
                        tabIndex={0}
                        aria-label={`${row.label}: ${row.help}`}
                      >
                        i
                        <span
                          role="tooltip"
                          className="pointer-events-none absolute left-full top-1/2 z-50 ml-2 hidden w-max max-w-52 -translate-y-1/2 rounded-md border border-slate-200 bg-slate-900 px-2 py-1.5 text-left text-[10px] font-medium leading-4 text-white shadow-lg group-hover/help:block group-focus/help:block"
                        >
                          {row.help}
                        </span>
                      </span>
                      {bulkApplyRowKey ? (
                        <span className="ml-auto inline-flex shrink-0 items-center gap-0.5">
                          <button
                            type="button"
                            className={dimensionVariantRowActionButtonClassName}
                            aria-label={
                              bulkApplySourceName
                                ? `Uporabi ${row.label} iz ${bulkApplySourceName} za vse različice`
                                : `Uporabi ${row.label} za vse različice`
                            }
                            title={
                              bulkApplySourceName
                                ? `Uporabi »${row.label}« iz »${bulkApplySourceName}« za vse različice`
                                : 'Najprej razširite izvorno različico'
                            }
                            disabled={!canBulkApplyRow}
                            onClick={() => applyDimensionVariantRowValueToAll(bulkApplyRowKey)}
                          >
                            <ApplyToAllIcon className="!h-3.5 !w-3.5" />
                          </button>
                          {bulkApplyRowKey === 'weight' ? (
                            <button
                              type="button"
                              className={dimensionVariantRowActionButtonClassName}
                              data-testid="dimension-variant-proportional-mass"
                              aria-label={
                                bulkApplySourceName
                                  ? `Izračunaj mase drugih različic po prostornini iz ${bulkApplySourceName}`
                                  : 'Izračunaj mase drugih različic po prostornini'
                              }
                              title={
                                bulkApplySourceName
                                  ? `Izračunaj mase drugih različic sorazmerno s prostornino iz »${bulkApplySourceName}«`
                                  : 'Najprej razširite izvorno različico'
                              }
                              disabled={!canBulkApplyRow}
                              onClick={applyProportionalDimensionVariantWeights}
                            >
                              <span
                                aria-hidden="true"
                                className="inline-flex !h-3.5 !w-3.5 shrink-0 items-center justify-center text-[14px] font-semibold leading-none"
                              >
                                ∏
                              </span>
                            </button>
                          ) : null}
                        </span>
                      ) : null}
                    </div>
                    {draft.variants.map((variant) => {
                      const variantIndex = Math.max(0, draft.variants.findIndex((entry) => entry.id === variant.id));
                      const variantName = buildDimensionVariantHeaderLabel(variant, variantIndex, true);
                      const isExpanded = expandedDimensionVariant?.id === variant.id;
                      const isHovered = hoveredDimensionVariantId === variant.id;
                      const isCompressedInactive = collapseInactiveDimensionVariants && !variant.active;
                      if (isExpanded) {
                        return (
                          <div
                            key={`${row.key}-${variant.id}`}
                            role="cell"
                            className={`admin-variant-matrix-cell-transition flex min-w-0 items-center overflow-hidden border-x border-[color:var(--blue-500)] bg-sky-50/45 px-2 py-1 ${
                              row.key === 'default' ? 'justify-center' : ''
                            }`}
                          >
                            <div
                              className={`admin-dimension-variant-content-enter w-full max-w-[320px] ${
                                row.key === 'default' ? 'flex justify-center' : ''
                              }`}
                            >
                              {renderExpandedDimensionVariantCell(variant, row.key)}
                            </div>
                          </div>
                        );
                      }
                      return (
                        <div
                          key={`${row.key}-${variant.id}`}
                          role="cell"
                          className={`admin-variant-matrix-cell-transition flex min-w-0 cursor-pointer items-center justify-center overflow-hidden border-r border-slate-200 px-0.5 py-1 ${
                            isHovered
                              ? 'z-10 border-x border-[color:var(--blue-500)] bg-sky-50'
                              : isCompressedInactive
                                ? 'bg-slate-100/70 opacity-[0.65]'
                                : ''
                          }`}
                          onClick={(event) => activateCollapsedDimensionVariant(event, variant.id)}
                          onMouseEnter={() => setHoveredDimensionVariantId(variant.id)}
                          onMouseLeave={() => setHoveredDimensionVariantId((current) => current === variant.id ? null : current)}
                        >
                          {renderCompactDimensionVariantCell(variant, row.key)}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          )}
          </div>
          {dimensionVariantViewMode === 'rows' && draft.variants.length > 0 ? (
            <>
              <span
                aria-hidden="true"
                className="pointer-events-none absolute right-[-1px] top-[-1px] z-40 h-px bg-white"
                style={{ width: `${dimensionVariantHeaderSlant + 1}px` }}
              />
            </>
          ) : null}
          </div>
          <p className="border-t border-slate-200 px-3 py-2 text-[11px] leading-4 text-slate-500">
            Neto cene so uredljive. Cene z DDV se izračunajo iz nastavljene stopnje DDV.
          </p>
          <QuantityDiscountsCard
            editable={isEditable}
            quantityDiscounts={quantityDiscounts}
            onAddDiscount={addQuantityDiscount}
            onRemoveDiscount={removeQuantityDiscount}
            onUpdateDiscount={updateQuantityDiscount}
            simulatorOptions={simulatorOptions}
            usesScopedCommercialTools
            embedded
          />
        </div>
      </section>
      ) : productType === 'weight' ? (
        <WeightProductModule
          editable={isEditable}
          data={weightProductData}
          baseSku={sideSettings.sku || draft.variants[0]?.sku || 'SKU'}
          color={sideSettings.color}
          taxRate={dimensionVariantTaxRate}
          defaultVariantId={weightLocalDefaultVariantId}
          onDefaultVariantChange={selectDefaultWeightVariant}
          onChange={updateWeightProductData}
          quantityDiscountsPanel={(
            <QuantityDiscountsCard
              editable={isEditable}
              quantityDiscounts={quantityDiscounts}
              onAddDiscount={addQuantityDiscount}
              onRemoveDiscount={removeQuantityDiscount}
              onUpdateDiscount={updateQuantityDiscount}
              simulatorOptions={simulatorOptions}
              usesScopedCommercialTools
              embedded
            />
          )}
        />
      ) : productType === 'unique_machine' ? (
        <UniqueMachineProductModule
          editable={isEditable}
          data={machineProductData}
          orderMatches={initialData?.machineSerialOrderMatches ?? []}
          onRequestEdit={handleEditModeToggle}
          onChange={updateMachineProductData}
        />
      ) : (
        <SimpleProductModule
          editable={isEditable}
          data={simpleProductData}
          costNet={draft.variants[0]?.costNet ?? null}
          taxRate={dimensionVariantTaxRate}
          onCostNetChange={(costNet) => {
            const simpleVariant = draft.variants[0];
            if (simpleVariant) updateVariant(simpleVariant.id, { costNet });
          }}
          onChange={updateSimpleProductData}
          quantityDiscountsPanel={(
            <QuantityDiscountsCard
              editable={isEditable}
              quantityDiscounts={quantityDiscounts}
              onAddDiscount={addQuantityDiscount}
              onRemoveDiscount={removeQuantityDiscount}
              onUpdateDiscount={updateQuantityDiscount}
              simulatorOptions={simulatorOptions}
              usesScopedCommercialTools
              embedded
            />
          )}
        />
      )}
      </div>
      ) : null}

      {editorTab === 'simulator' ? (
          <CommercialToolsPanel
            productType={productType}
            hideQuantityDiscounts={
              productType === 'simple' || productType === 'dimensions' || productType === 'weight' || productType === 'unique_machine'
            }
            editable={isEditable}
            quantityDiscounts={quantityDiscounts}
            onAddDiscount={addQuantityDiscount}
        onRemoveDiscount={removeQuantityDiscount}
        onUpdateDiscount={updateQuantityDiscount}
        simulatorOptions={simulatorOptions}
        selectedOptionId={simulatorVariantId}
        onSelectedOptionIdChange={setSimulatorVariantId}
        quantity={simulatorQuantity}
        onQuantityChange={setSimulatorQuantity}
        applyQuantityDiscounts={simulatorAppliesQuantityDiscounts}
        onApplyQuantityDiscountsChange={setSimulatorAppliesQuantityDiscounts}
      />
      ) : null}
      <UnsavedChangesDialog
        open={isDiscardUnsavedDialogOpen}
        label="zaključkom urejanja artikla"
        isSaving={isSaving}
        saveDisabled={!hasUnsavedChanges || isSaving}
        onSave={saveEditorUnsavedChanges}
        onContinueEditing={() => setIsDiscardUnsavedDialogOpen(false)}
        onDiscard={discardEditorUnsavedChanges}
      />
      <Dialog
        open={pendingProductTypeChange !== null}
        onOpenChange={(open) => {
          if (!open) setPendingProductTypeChange(null);
        }}
        title="Potrditev spremembe tipa artikla"
        footer={(
          <div className={dialogFooterClassName}>
            <Button
              type="button"
              variant="default"
              size="toolbar"
              className={dialogActionButtonClassName}
              onClick={() => setPendingProductTypeChange(null)}
            >
              Prekliči
            </Button>
            <Button
              type="button"
              variant="primary"
              size="toolbar"
              className={dialogActionButtonClassName}
              onClick={() => {
                if (pendingProductTypeChange) applyProductTypeChange(pendingProductTypeChange);
              }}
            >
              Da, spremeni tip
            </Button>
          </div>
        )}
      >
        <div className="mt-3 space-y-2 text-[13px] leading-5 text-slate-600">
          <p>
            Artikel ima neshranjene spremembe. Ali ste popolnoma prepričani, da želite spremeniti tip artikla?
          </p>
          <p>
            Sprememba iz <span className="font-semibold text-slate-800">{formatProductTypeLabel(productType)}</span> v{' '}
            <span className="font-semibold text-slate-800">
              {pendingProductTypeChange ? formatProductTypeLabel(pendingProductTypeChange) : ''}
            </span>{' '}
            lahko vpliva na prikazane module, simulator in podatke, ki bodo shranjeni za artikel.
          </p>
        </div>
      </Dialog>
      <Dialog
        open={pendingSaveConfirmation !== null}
        onOpenChange={(open) => {
          if (!open) setPendingSaveConfirmation(null);
        }}
        title={pendingSaveConfirmation ? `Pred shranjevanjem preverite spremembe (${pendingSaveConfirmation.changeCount})` : 'Pred shranjevanjem preverite spremembe'}
        panelClassName="!max-w-xl [&_[data-dialog-title]]:text-xl"
        footer={(
          <div className={dialogFooterClassName}>
            <Button
              type="button"
              variant="default"
              size="toolbar"
              className={dialogActionButtonClassName}
              onClick={() => setPendingSaveConfirmation(null)}
            >
              Prekliči
            </Button>
            <Button
              type="button"
              variant="primary"
              size="toolbar"
              className={dialogActionButtonClassName}
              onClick={() => { void confirmSave(); }}
            >
              Potrdi in shrani
            </Button>
          </div>
        )}
      >
        <div className="mt-2 max-h-[56vh] space-y-3 overflow-y-auto pr-1">
          <p className="text-[13px] leading-5 text-slate-600">
            Pred potrditvijo bodo shranjene naslednje spremembe:
          </p>
          {pendingSaveConfirmation?.changeGroups.map((group) => (
            <div key={group.title} className="space-y-1.5">
              <h3 className="text-[13px] font-semibold text-slate-900">{group.title}</h3>
              <ul className="space-y-1 text-[13px] text-slate-600">
                {group.items.map((item, index) => (
                  <li key={`${group.title}-${index}`} className="rounded-md bg-slate-50 px-2.5 py-1.5 leading-5">
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Dialog>
      {isMediaEditable && editingImageSlot !== null && mediaImagesDraft[editingImageSlot]
        ? createPortal(
          <UploadedImageCropperModal
            imageUrl={mediaImagesDraft[editingImageSlot]}
            slotIndex={editingImageSlot}
            altText={mediaImageSlots[editingImageSlot]?.altText ?? ''}
            onAltTextChange={(value) => updateImageAltText(editingImageSlot, value)}
            onCancel={() => setEditingImageSlot(null)}
            onSave={({ blob, mimeType }) => { void handleSaveEditedImage(editingImageSlot, blob, mimeType); }}
          />,
          document.body
        )
        : null}
    </div>
  );
}

