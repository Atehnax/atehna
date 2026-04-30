'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type ClipboardEvent as ReactClipboardEvent, type FocusEvent as ReactFocusEvent, type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Uppy from '@uppy/core';
import { UppyContextProvider, useDropzone } from '@uppy/react';
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
import { Button } from '@/shared/ui/button';
import { Chip } from '@/shared/ui/badge';
import { AdminCheckbox } from '@/shared/ui/checkbox';
import { IconButton } from '@/shared/ui/icon-button';
import { ActionUndoIcon, ArchiveIcon, CopyIcon, PencilIcon, PlusIcon, SaveIcon, TrashCanIcon } from '@/shared/ui/icons/AdminActionIcons';
import { useToast } from '@/shared/ui/toast';
import {
  adminStatusInfoPillCompactTableClassName,
  adminStatusInfoPillGroupClassName,
  buttonTokenClasses
} from '@/shared/ui/theme/tokens';
import { MenuItem, MenuPanel } from '@/shared/ui/menu';
import EuiTabs from '@/shared/ui/eui-tabs';
import {
  adminTableNeutralIconButtonClassName,
  adminTablePrimaryButtonClassName,
  adminTableRowHeightClassName,
  adminTableSelectedDangerIconButtonClassName,
  adminTableSelectedWarningIconButtonClassName,
  adminWindowCardClassName,
  adminWindowCardStyle
} from '@/shared/ui/admin-table';
import { UnsavedChangesDialog } from '@/shared/ui/unsaved-changes-dialog';
import {
  createArchivedItemRecord,
  readArchivedItemStorage,
  writeArchivedItemStorage
} from '@/admin/features/artikli/lib/archiveItemClient';
import {
  buildPersistedVariantName,
  computeSalePrice,
  createFamily,
  createVariant,
  formatCurrency,
  toSlug,
  type ProductFamily,
  type Variant
} from '@/admin/features/artikli/lib/familyModel';
import { formatDecimalForDisplay, formatDecimalForSku, parseDecimalInput, parseDecimalListInput } from '@/admin/features/artikli/lib/decimalFormat';
import AdminCategoryBreadcrumbPicker from '@/admin/features/artikli/components/AdminCategoryBreadcrumbPicker';
import ActiveStateChip from '@/admin/features/artikli/components/ActiveStateChip';
import OpisColorPopover from '@/admin/features/artikli/components/OpisColorPopover';
import UploadedImageCropperModal from '@/admin/features/artikli/components/UploadedImageCropperModal';
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
  adminProductInputChipClassName,
  type ProductEditorType,
  type QuantityDiscountDraft,
  type SimulatorOption,
  type UniversalProductSpecificData
} from '@/admin/features/artikli/components/DimensionProductPricingSections';
import AdminFieldSuggestionMenu from '@/admin/components/AdminFieldSuggestionMenu';
import {
  getCatalogItemIdentityMessage,
  useCatalogItemIdentityAvailability
} from '@/admin/features/artikli/components/useCatalogItemIdentityAvailability';
import { NoteTagChip, getNoteTagMenuItemClassName, type NoteTag } from '@/admin/features/artikli/components/NoteTagChip';
import {
  articleNameInputClassName,
  compactSideInputClassName,
  compactSideInputWrapClassName,
  compactTableAdornmentClassName,
  compactTableAlignedInputClassName,
  compactTableAlignedTextInputClassName,
  compactTableValueUnitShellClassName,
  numberInputClass,
  topBarArticleNameInputClassName
} from '@/admin/features/artikli/components/artikliFieldStyles';
import { saveCatalogItemPayload } from '@/admin/features/artikli/lib/canonicalSaveClient';
import { Dialog, dialogActionButtonClassName, dialogFooterClassName } from '@/shared/ui/dialog';
import { THead, TH } from '@/shared/ui/table';
import type { AdminCatalogListItem, CatalogItemEditorHydration, CatalogItemEditorPayload } from '@/shared/server/catalogItems';

const inputClass = 'h-10 w-full rounded-md border border-slate-300 bg-white px-2.5 text-sm text-slate-900 outline-none transition-[border-color,box-shadow,color] focus:border-[#3e67d6] focus:ring-0';
const compactTableNumericSlotClassName = 'inline-flex h-6 w-[7ch] items-center justify-end';
const compactTableFourDigitSlotClassName = 'inline-flex h-6 w-[5ch] items-center justify-end';
const topActionSaveButtonClassName = `gap-2 ${adminTablePrimaryButtonClassName} !h-8 !leading-none !tracking-[0] disabled:!border-transparent disabled:!bg-[color:var(--blue-500)] disabled:!text-white disabled:!opacity-50`;
const topSaveActionButtonIconClassName = 'h-[15.3px] w-[15.3px]';
const editorSectionTitleClassName = 'text-[20px] font-semibold tracking-tight text-slate-900';
const inlineSnippetClass = 'rounded bg-[#1982bf1a] px-1 py-0.5 font-mono text-[11px] text-[#1982bf]';
const mimeTypeToImageExtension: Record<string, string> = {
  'image/jpeg': 'JPG',
  'image/jpg': 'JPG',
  'image/png': 'PNG',
  'image/webp': 'WEBP',
  'image/gif': 'GIF',
  'image/svg+xml': 'SVG',
  'image/avif': 'AVIF',
  'image/bmp': 'BMP',
  'image/tiff': 'TIFF'
};

function inferImageExtensionLabel({ mimeType, fileName, url }: { mimeType?: string; fileName?: string; url?: string }) {
  const mimeLabel = mimeType ? mimeTypeToImageExtension[mimeType.toLowerCase()] : undefined;
  if (mimeLabel) return mimeLabel;
  const fromName = fileName?.match(/\.([a-zA-Z0-9]+)$/)?.[1]?.toUpperCase();
  if (fromName) return fromName;
  const fromUrl = url?.match(/\.([a-zA-Z0-9]+)(?:$|\?)/)?.[1]?.toUpperCase();
  if (fromUrl) return fromUrl;
  return 'IMG';
}

function formatCurrencyAmountOnly(value: number) {
  return formatCurrency(value).replace(/\s*€/u, '').trim();
}

type EditorMode = 'create' | 'edit';
type CreateType = ProductEditorType | 'variants';
type MediaTab = 'slike' | 'video' | 'tehnicni';
type VariantTag = NoteTag;
type GeneratorDimension = 'length' | 'width' | 'thickness';
type GeneratorChip = { dimension: GeneratorDimension; values: number[] };
type VariantDimensionSet = { length: number; width: number; thickness: number };
type SideFieldIcon = 'name' | 'brand' | 'material' | 'shape' | 'color' | 'link' | 'document' | 'dimension' | 'sku';
type IdentitySuggestionField = 'name' | 'sku' | 'slug';
type SideSettingsState = {
  sku: string;
  brand: string;
  material: string;
  surface: string;
  color: string;
  thicknessTolerance: string;
  moq: number;
  weightPerUnit: string;
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
  previewUrl: string;
  uploadedUrl: string | null;
  file: File | null;
  filename: string | null;
  mimeType: string | null;
  altText: string;
  localId: string | null;
};
type StagedVideoState = {
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
const MEDIA_SLOT_COUNT = 7;
const GALLERY_SMALL_SLOT_COUNT = 6;
const UNDO_HISTORY_LIMIT = 10;
const IMAGE_MAX_UPLOAD_BYTES = 4 * 1024 * 1024;
const VIDEO_MAX_UPLOAD_BYTES = 100 * 1024 * 1024;
const TECHNICAL_DOCUMENT_MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const ITEM_NOTE_OPTIONS: Array<{ value: VariantTag; label: string }> = [
  { value: 'na-zalogi', label: 'Na zalogi' },
  { value: 'novo', label: 'Novo' },
  { value: 'akcija', label: 'V akciji' },
  { value: 'zadnji-kosi', label: 'Zadnji kosi' },
  { value: 'ni-na-zalogi', label: 'Ni na zalogi' }
];

const normalizeVariantTag = (value: string | null | undefined): VariantTag | '' => {
  const normalized = (value ?? '').trim().toLowerCase();
  if (!normalized) return '';
  if (normalized === 'opomba') return 'na-zalogi';
  if (normalized === 'na-zalogi' || normalized === 'novo' || normalized === 'akcija' || normalized === 'zadnji-kosi' || normalized === 'ni-na-zalogi') {
    return normalized;
  }
  return '';
};

const createLocalStageId = () => `local-${Math.random().toString(36).slice(2, 10)}`;

function formatFileSize(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '—';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

type MediaUrlImportKind = 'image' | 'video' | 'document';
type UploadedMediaFile = { url: string; pathname: string; mimeType: string | null; filename: string; size?: number };
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
    imageAssignments: [...(variant.imageAssignments ?? [])]
  };
}

function cloneSideSettings(settings: SideSettingsState): SideSettingsState {
  return {
    ...settings,
    dimensions: { ...settings.dimensions }
  };
}

function cloneMediaImage(slot: StagedImageSlot): StagedImageSlot {
  return { ...slot };
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
      variants: state.draft.variants.map(cloneVariant)
    },
    productType: state.productType,
    typeSpecificData: cloneTypeSpecificData(state.typeSpecificData),
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
      variants: state.draft.variants.map((variant) => ({
        ...variant,
        imageAssignments: [...(variant.imageAssignments ?? [])]
      }))
    },
    productType: state.productType,
    typeSpecificData: state.typeSpecificData,
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
      altText: slot.altText,
      filename: slot.filename,
      mimeType: slot.mimeType,
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
  return ITEM_NOTE_OPTIONS.find((entry) => entry.value === value)?.label ?? 'Brez opombe';
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
  return `${rule.minQuantity} kos -> ${formatDecimalForDisplay(rule.discountPercent)} %; razlicice: ${variants}; kupci: ${customers}${note}`;
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
  return label || `Razlicica ${index + 1}`;
}

function describeStagedImageSlot(slot: StagedImageSlot) {
  return formatSaveDiffText(slot.file?.name ?? slot.filename ?? slot.uploadedUrl ?? slot.previewUrl ?? 'slika', 80);
}

function describeStagedDocument(documentEntry: StagedTechnicalDocument) {
  return formatSaveDiffText(documentEntry.file?.name ?? documentEntry.name ?? documentEntry.blobUrl ?? 'tehnicni list', 80);
}

function describeStagedVideo(video: StagedVideoState) {
  const sourceLabel = video.source === 'youtube' ? 'YouTube' : 'Upload';
  const label = video.file?.name ?? video.label ?? video.uploadedUrl ?? video.previewUrl ?? 'video';
  return `${sourceLabel}: ${formatSaveDiffText(label, 80)}`;
}

function formatProductTypeLabel(type: ProductEditorType) {
  if (type === 'dimensions') return 'Po dimenzijah';
  if (type === 'weight') return 'Po teži';
  if (type === 'unique_machine') return 'Stroj / unikaten';
  return 'Enostavni';
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
  if (basicItems.length > 0) groups.push({ title: 'Osnovni podatki', items: basicItems });

  const detailItems: string[] = [];
  pushSaveDiff(detailItems, 'Osnovni SKU', formatSaveDiffText(saved.sideSettings.sku), formatSaveDiffText(next.sideSettings.sku));
  pushSaveDiff(detailItems, 'Blagovna znamka', formatSaveDiffText(saved.sideSettings.brand), formatSaveDiffText(next.sideSettings.brand));
  pushSaveDiff(detailItems, 'Material', formatSaveDiffText(saved.sideSettings.material), formatSaveDiffText(next.sideSettings.material));
  pushSaveDiff(detailItems, 'Barva', formatSaveDiffText(saved.sideSettings.color), formatSaveDiffText(next.sideSettings.color));
  pushSaveDiff(detailItems, 'Oblika', formatSaveDiffText(saved.sideSettings.surface), formatSaveDiffText(next.sideSettings.surface));
  pushSaveDiff(detailItems, 'Toleranca', formatSaveDiffText(saved.sideSettings.thicknessTolerance), formatSaveDiffText(next.sideSettings.thicknessTolerance));
  pushSaveDiff(detailItems, 'Min. narocilo', formatSaveDiffInteger(saved.sideSettings.moq), formatSaveDiffInteger(next.sideSettings.moq));
  pushSaveDiff(detailItems, 'Teza / kos', formatSaveDiffText(saved.sideSettings.weightPerUnit), formatSaveDiffText(next.sideSettings.weightPerUnit));
  if (detailItems.length > 0) groups.push({ title: 'Dodatni podatki', items: detailItems });

  if (JSON.stringify(saved.typeSpecificData) !== JSON.stringify(next.typeSpecificData)) {
    groups.push({ title: 'Aktivni modul', items: ['Posodobljeni so podatki aktivnega modula.'] });
  }

  const variantItems: string[] = [];
  const savedVariantsById = new Map(saved.draft.variants.map((variant, index) => [variant.id, { variant, index }]));
  const nextVariantsById = new Map(next.draft.variants.map((variant, index) => [variant.id, { variant, index }]));

  saved.draft.variants.forEach((variant, index) => {
    if (nextVariantsById.has(variant.id)) return;
    variantItems.push(`Odstranjena razlicica "${buildVariantSaveDiffLabel(variant, index)}".`);
  });

  next.draft.variants.forEach((variant, index) => {
    const savedVariantInfo = savedVariantsById.get(variant.id);
    const variantLabel = buildVariantSaveDiffLabel(variant, index);
    const prefix = `Razlicica "${variantLabel}"`;

    if (!savedVariantInfo) {
      const summary: string[] = [];
      if (variant.sku.trim()) summary.push(`SKU ${variant.sku.trim()}`);
      if (variant.length !== null || variant.width !== null || variant.thickness !== null) {
        summary.push(
          `dimenzije ${[
            formatSaveDiffNumber(variant.length, 'mm'),
            formatSaveDiffNumber(variant.width, 'mm'),
            formatSaveDiffNumber(variant.thickness, 'mm')
          ].join(' / ')}`
        );
      }
      summary.push(`cena ${formatSaveDiffCurrency(variant.price)}`);
      variantItems.push(`Dodana razlicica "${variantLabel}"${summary.length > 0 ? ` (${summary.join(', ')})` : ''}.`);
      return;
    }

    const savedVariant = savedVariantInfo.variant;
    pushSaveDiff(variantItems, `${prefix} - naziv`, formatSaveDiffText(savedVariant.label), formatSaveDiffText(variant.label));
    pushSaveDiff(variantItems, `${prefix} - dolzina`, formatSaveDiffNumber(savedVariant.length, 'mm'), formatSaveDiffNumber(variant.length, 'mm'));
    pushSaveDiff(variantItems, `${prefix} - sirina/fi`, formatSaveDiffNumber(savedVariant.width, 'mm'), formatSaveDiffNumber(variant.width, 'mm'));
    pushSaveDiff(variantItems, `${prefix} - debelina`, formatSaveDiffNumber(savedVariant.thickness, 'mm'), formatSaveDiffNumber(variant.thickness, 'mm'));
    pushSaveDiff(variantItems, `${prefix} - teza`, formatSaveDiffNumber(savedVariant.weight, 'g'), formatSaveDiffNumber(variant.weight, 'g'));
    pushSaveDiff(variantItems, `${prefix} - toleranca`, formatSaveDiffText(savedVariant.errorTolerance), formatSaveDiffText(variant.errorTolerance));
    pushSaveDiff(variantItems, `${prefix} - cena`, formatSaveDiffCurrency(savedVariant.price), formatSaveDiffCurrency(variant.price));
    pushSaveDiff(variantItems, `${prefix} - popust`, formatSaveDiffNumber(savedVariant.discountPct, '%'), formatSaveDiffNumber(variant.discountPct, '%'));
    pushSaveDiff(variantItems, `${prefix} - zaloga`, formatSaveDiffInteger(savedVariant.stock), formatSaveDiffInteger(variant.stock));
    pushSaveDiff(variantItems, `${prefix} - min. narocilo`, formatSaveDiffInteger(savedVariant.minOrder), formatSaveDiffInteger(variant.minOrder));
    pushSaveDiff(variantItems, `${prefix} - SKU`, formatSaveDiffText(savedVariant.sku), formatSaveDiffText(variant.sku));
    pushSaveDiff(variantItems, `${prefix} - status`, formatSaveDiffStatus(savedVariant.active), formatSaveDiffStatus(variant.active));
    pushSaveDiff(variantItems, `${prefix} - vrstni red`, formatSaveDiffInteger(savedVariant.sort), formatSaveDiffInteger(variant.sort));

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

  if (variantItems.length > 0) groups.push({ title: 'Razlicice', items: variantItems });

  const quantityDiscountItems: string[] = [];
  const savedQuantityDiscountsById = new Map(saved.quantityDiscounts.map((rule) => [rule.id, rule]));
  const nextQuantityDiscountsById = new Map(next.quantityDiscounts.map((rule) => [rule.id, rule]));
  saved.quantityDiscounts.forEach((rule) => {
    if (!nextQuantityDiscountsById.has(rule.id)) {
      quantityDiscountItems.push(`Odstranjen kolicinski popust: ${formatQuantityDiscountForSaveDiff(rule)}.`);
    }
  });
  next.quantityDiscounts.forEach((rule) => {
    const savedRule = savedQuantityDiscountsById.get(rule.id);
    if (!savedRule) {
      quantityDiscountItems.push(`Dodan kolicinski popust: ${formatQuantityDiscountForSaveDiff(rule)}.`);
      return;
    }
    if (serializeQuantityDiscountForSaveDiff(savedRule) !== serializeQuantityDiscountForSaveDiff(rule)) {
      quantityDiscountItems.push(`Kolicinski popust: ${formatQuantityDiscountForSaveDiff(savedRule)} -> ${formatQuantityDiscountForSaveDiff(rule)}.`);
    }
  });
  if (quantityDiscountItems.length > 0) groups.push({ title: 'Kolicinski popusti', items: quantityDiscountItems });

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
    const label = `Tehnicni list ${index + 1}`;
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
  if (documentItems.length > 0) groups.push({ title: 'Tehnicni listi', items: documentItems });

  return groups;
}

function buildArchiveRecord(state: EditorPersistedState, identifier: string) {
  const firstVariant = state.draft.variants[0];
  return createArchivedItemRecord({
    id: identifier,
    name: state.draft.name,
    category: state.selectedCategoryPath.join(' / '),
    sku: state.sideSettings.sku || firstVariant?.sku || '',
    price: firstVariant?.price ?? 0,
    discountPct: firstVariant?.discountPct ?? 0,
    active: state.draft.active
  });
}

function buildInitialEditorPersistedState(initialData: CatalogItemEditorHydration | null, createType: CreateType): EditorPersistedState {
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
                discountPct: variant.discountPct ?? 0,
                stock: variant.inventory ?? 0,
                active: (variant.status ?? 'active') === 'active',
                sort: variant.position ?? index + 1
              })
            )
          : [createVariant({ label: 'Osnovni artikel' })])
      })
    : createFamily({
        variants: createType === 'variants' ? [createVariant()] : [createVariant({ label: 'Osnovni artikel' })],
        active: true
      });

  const mediaImages = (initialData?.media
    .filter((media) => media.mediaKind === 'image' && media.role === 'gallery')
    .sort((left, right) => (left.position ?? 0) - (right.position ?? 0))
    .map((media) => {
      const url = media.blobUrl || media.externalUrl || '';
      return {
        previewUrl: url,
        uploadedUrl: url || null,
        file: null,
        filename: media.filename ?? null,
        mimeType: media.mimeType ?? null,
        altText: media.altText ?? '',
        localId: null
      } satisfies StagedImageSlot;
    })
    .filter((slot) => Boolean(slot.previewUrl)) ?? []);

  const videoMedia = initialData?.media.find((media) => media.mediaKind === 'video') ?? null;
  const video = videoMedia
    ? {
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
    thicknessTolerance: initialData?.variants[0]?.errorTolerance ?? '',
    moq: initialData?.variants[0]?.minOrder ?? 1,
    weightPerUnit: initialData?.variants[0]?.weight != null ? String(initialData.variants[0]?.weight) : '0',
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
  const typeSpecificData = createInitialTypeSpecificData(initialData?.typeSpecificData, {
    variants: family.variants,
    baseSku: sideSettings.sku
  });

  return {
    draft: family,
    productType,
    typeSpecificData,
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

function canonicalizeVariantDimensions(
  input: VariantDimensionSet,
  options: { interchangeableGroups?: Array<Array<keyof VariantDimensionSet>> } = {}
): VariantDimensionSet {
  const normalized: VariantDimensionSet = { ...input };
  const groups = options.interchangeableGroups ?? [['length', 'width']];
  groups.forEach((group) => {
    if (group.length < 2) return;
    const values = group
      .map((key) => normalized[key])
      .filter((value): value is number => Number.isFinite(value))
      .sort((a, b) => b - a);
    if (values.length !== group.length) return;
    group.forEach((key, index) => {
      normalized[key] = values[index];
    });
  });
  return normalized;
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

function UppyDropzoneField({
  uppy,
  disabled,
  onPrepareAddFiles,
  className = '',
  children
}: {
  uppy: Uppy;
  disabled: boolean;
  onPrepareAddFiles: (files: File[]) => void;
  className?: string;
  children: ReactNode;
}) {
  return (
    <UppyContextProvider uppy={uppy}>
      <UppyDropzoneFieldInner disabled={disabled} onPrepareAddFiles={onPrepareAddFiles} className={className}>
        {children}
      </UppyDropzoneFieldInner>
    </UppyContextProvider>
  );
}

function UppyDropzoneFieldInner({
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
  const dropzone = useDropzone({
    onDragEnter: () => setDragActive(true),
    onDragLeave: () => setDragActive(false),
    onDrop: (files) => {
      setDragActive(false);
      onPrepareAddFiles(files);
    },
    onFileInputChange: (files) => {
      onPrepareAddFiles(files);
    }
  });

  const rootProps = dropzone.getRootProps();
  const inputProps = dropzone.getInputProps();
  const interactionProps = disabled ? {} : rootProps;

  return (
    <div
      {...interactionProps}
      className={[
        'relative border-2 border-dashed transition',
        dragActive ? 'border-[#1982bf] bg-[#edf3ff]' : 'border-[#9cb8ea] bg-[#f7f9fe]',
        disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:border-[#1982bf] hover:bg-[#edf3ff]',
        className
      ].join(' ')}
    >
      {disabled ? null : <input {...inputProps} className="hidden" />}
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
        StarterKit,
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

  useEffect(() => {
    if (!openMenu) return;
    updateMenuPosition();
    const onDocMouseDown = (event: MouseEvent) => {
      const target = event.target as Node;
      const refs = getMenuRefs(openMenu);
      if (toolbarRef.current?.contains(target) || refs.trigger?.contains(target) || refs.panel?.contains(target)) return;
      setOpenMenu(null);
    };
    const onDocKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpenMenu(null);
    };
    const onWindowChange = () => updateMenuPosition();
    document.addEventListener('mousedown', onDocMouseDown);
    document.addEventListener('keydown', onDocKeyDown);
    window.addEventListener('resize', onWindowChange);
    window.addEventListener('scroll', onWindowChange, true);
    return () => {
      document.removeEventListener('mousedown', onDocMouseDown);
      document.removeEventListener('keydown', onDocKeyDown);
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
  const [isOpen, setIsOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const selectedOption = options.find((option) => option.value === value) ?? null;
  const displayedLabel = selectedOption?.label ?? placeholderLabel ?? '';

  const updateMenuPosition = useCallback(() => {
    if (!triggerRef.current) return;
    const triggerRect = triggerRef.current.getBoundingClientRect();
    const menuWidth = Math.max(150, menuRef.current?.offsetWidth ?? 150);
    const left = Math.min(Math.max(8, triggerRect.left), window.innerWidth - menuWidth - 8);
    const top = menuPlacement === 'top' ? triggerRect.top - 6 : triggerRect.bottom + 6;
    setMenuPosition({ top, left });
  }, [menuPlacement]);

  useEffect(() => {
    if (!isOpen) return;
    updateMenuPosition();
    const onDocClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (rootRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      setIsOpen(false);
    };
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false);
    };
    const onWindowChange = () => updateMenuPosition();
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onEscape);
    window.addEventListener('resize', onWindowChange);
    window.addEventListener('scroll', onWindowChange, true);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onEscape);
      window.removeEventListener('resize', onWindowChange);
      window.removeEventListener('scroll', onWindowChange, true);
    };
  }, [isOpen, updateMenuPosition]);

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => {
          if (!editable) return;
          setIsOpen((current) => !current);
        }}
        className="relative block rounded-full focus:outline-none"
        aria-haspopup={editable ? 'menu' : undefined}
        aria-expanded={editable ? isOpen : undefined}
      >
        {editable ? <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-500">▾</span> : null}
        <span className="block">
          <Chip size="adminStatusInfo" variant="neutral" className={chipClassName}>{displayedLabel}</Chip>
        </span>
      </button>

      {editable && isOpen && menuPosition && typeof document !== 'undefined'
        ? createPortal(
            <div
              ref={menuRef}
              role="menu"
              className={`fixed z-[1000] min-w-[150px] ${menuPlacement === 'top' ? '-translate-y-full' : ''}`}
              style={{ top: menuPosition.top, left: menuPosition.left }}
            >
              <MenuPanel>
                {options.map((option) => (
                  <MenuItem
                    key={option.value}
                    className={optionClassName?.(option.value)}
                    onClick={() => {
                      onChange(option.value);
                      setIsOpen(false);
                    }}
                  >
                    {option.label}
                  </MenuItem>
                ))}
              </MenuPanel>
            </div>,
            document.body
          )
        : null}
    </div>
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

  const [draft, setDraft] = useState<ProductFamily>(() => ({
    ...initialPersistedState.draft,
    variants: initialPersistedState.draft.variants.map(cloneVariant)
  }));
  const [productType, setProductType] = useState<ProductEditorType>(initialPersistedState.productType);
  const [typeSpecificData, setTypeSpecificData] = useState<UniversalProductSpecificData>(() => cloneTypeSpecificData(initialPersistedState.typeSpecificData));
  const [variantSelections, setVariantSelections] = useState<Set<string>>(new Set());
  const [generatorInput, setGeneratorInput] = useState('');
  const [generatorChips, setGeneratorChips] = useState<GeneratorChip[]>([]);
  const [generatorError, setGeneratorError] = useState<string | null>(null);
  const [sideSettings, setSideSettings] = useState<SideSettingsState>(() => cloneSideSettings(initialPersistedState.sideSettings));
  const [documents, setDocuments] = useState<StagedTechnicalDocument[]>(() => initialPersistedState.documents.map(cloneDocument));
  const [quantityDiscounts, setQuantityDiscounts] = useState<QuantityDiscountDraft[]>(() => initialPersistedState.quantityDiscounts.map(cloneQuantityDiscountDraft));
  const [editorMode, setEditorMode] = useState<'read' | 'edit'>(mode === 'create' ? 'edit' : 'read');
  const [isSaving, setIsSaving] = useState(false);
  const [isDuplicating, setIsDuplicating] = useState(false);
  const [itemLevelNote, setItemLevelNote] = useState<VariantTag | ''>(initialPersistedState.itemLevelNote);
  const [mediaTab, setMediaTab] = useState<MediaTab>('slike');
  const [mediaImageSlots, setMediaImageSlots] = useState<StagedImageSlot[]>(() => initialPersistedState.mediaImages.map(cloneMediaImage));
  const [draggedImageIndex, setDraggedImageIndex] = useState<number | null>(null);
  const [draggedVariantId, setDraggedVariantId] = useState<string | null>(null);
  const [draggedVariantImageSlot, setDraggedVariantImageSlot] = useState<number | null>(null);
  const [imageMeta, setImageMeta] = useState<Record<string, { width: number; height: number; type: string }>>({});
  const localBlobUrlsRef = useRef<Set<string>>(new Set());
  const imageTypeHintsRef = useRef<Record<string, string>>({});
  const suppressImageClickAfterDragRef = useRef(false);
  const uppyRef = useRef<Uppy | null>(null);
  const uploadPlanRef = useRef<{ startSlot: number; nextOffset: number; maxFiles: number }>({ startSlot: 0, nextOffset: 0, maxFiles: 1 });
  const mediaUploadInputRef = useRef<HTMLInputElement>(null);
  const mediaUploadContextRef = useRef<{ slotIndex: number; multiple: boolean }>({ slotIndex: 0, multiple: true });
  const updateImageAtSlotRef = useRef<(slotIndex: number, slot: StagedImageSlot) => void>(() => {});
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
  const simulatorOptions = useMemo<SimulatorOption[]>(() => {
    if (productType === 'dimensions') return getDimensionSimulatorOptions(draft.variants);
    if (productType === 'weight') return getWeightSimulatorOptions(weightProductData);
    if (productType === 'unique_machine') return getMachineSimulatorOptions(machineProductData, draft.name || 'Stroj / unikaten artikel');
    return getSimpleSimulatorOptions(simpleProductData, draft.name || 'Osnovni artikel');
  }, [draft.name, draft.variants, machineProductData, productType, simpleProductData, weightProductData]);

  const decimalDraftKey = (variantId: string, field: string) => `${variantId}:${field}`;

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
        variants: nextDraft.variants.map(cloneVariant)
      },
      productType,
      typeSpecificData: cloneTypeSpecificData(typeSpecificData),
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
  ), [documents, itemLevelNote, mediaImageSlots, productType, quantityDiscounts, selectedCategoryPath, sideSettings, typeSpecificData, variantTags, videoAssignedVariantId, videoDraft]);

  const currentPersistedState = useMemo<EditorPersistedState>(() => buildPersistedState(draft), [buildPersistedState, draft]);
  const buildSaveReadyPersistedState = useCallback((state: EditorPersistedState): EditorPersistedState => {
    const baseSku = state.sideSettings.sku || state.draft.variants[0]?.sku || toSlug(state.draft.name || 'artikel').toUpperCase();
    let variants = state.draft.variants.map(cloneVariant);
    if (state.productType === 'simple') {
      variants = buildSimpleCatalogVariants(
        normalizeSimpleProductData(state.typeSpecificData.simple, { variants, baseSku }),
        variants[0],
        baseSku,
        state.draft.name
      );
    } else if (state.productType === 'weight') {
      variants = buildWeightCatalogVariants(
        normalizeWeightProductData(state.typeSpecificData.weight, { variants, baseSku }),
        baseSku
      );
    } else if (state.productType === 'unique_machine') {
      variants = buildMachineCatalogVariants(
        normalizeUniqueMachineProductData(state.typeSpecificData.uniqueMachine, { variants, baseSku }),
        variants[0],
        baseSku,
        state.draft.name
      );
    }
    return {
      ...state,
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
      variants: snapshot.persistedState.draft.variants.map(cloneVariant)
    });
    setProductType(snapshot.persistedState.productType);
    setTypeSpecificData(cloneTypeSpecificData(snapshot.persistedState.typeSpecificData));
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
  const applyProductTypeChange = useCallback((nextProductType: ProductEditorType) => {
    setProductType(nextProductType);
    setSimulatorVariantId('');
    setPendingProductTypeChange(null);
  }, []);
  const changeProductType = (nextProductType: ProductEditorType) => {
    if (!isEditable || nextProductType === productType) return;
    if (mode !== 'create' && hasUnsavedChanges) {
      setPendingProductTypeChange(nextProductType);
      return;
    }
    applyProductTypeChange(nextProductType);
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
    width: 'Širina/fi',
    thickness: 'Debelina'
  };
  const generatorByDimension = useMemo(() => {
    const map = new Map<GeneratorDimension, number[]>();
    generatorChips.forEach((chip) => {
      map.set(chip.dimension, chip.values);
    });
    return map;
  }, [generatorChips]);
  const combinationCount = useMemo(() => {
    const activeDimensions = (['length', 'width', 'thickness'] as const)
      .map((dimension) => generatorByDimension.get(dimension) ?? [])
      .filter((values) => values.length > 0);
    if (activeDimensions.length < 2) return 0;
    return activeDimensions.reduce((total, values) => total * values.length, 1);
  }, [generatorByDimension]);

  const commitPendingDecimalDrafts = useCallback(() => {
    if (Object.keys(decimalInputDrafts).length === 0) return { nextDraft: draft };

    const fieldConfigs: Record<string, { emptyFallback: number | null; apply: (value: number | null) => Partial<Variant> }> = {
      length: { emptyFallback: null, apply: (value) => ({ length: value }) },
      width: { emptyFallback: null, apply: (value) => ({ width: value }) },
      thickness: { emptyFallback: null, apply: (value) => ({ thickness: value }) },
      weight: { emptyFallback: null, apply: (value) => ({ weight: value }) },
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
  }, [decimalInputDrafts, draft]);

  const performSave = async (preparedState: EditorPersistedState) => {
    const nextDraft = preparedState.draft;

    if (!nextDraft.name.trim()) {
      toast.error('Naziv je obvezen.');
      return;
    }
    if (!nextDraft.category.trim() || preparedState.selectedCategoryPath.length === 0) {
      toast.error('Kategorija je obvezna.');
      return;
    }
    if (!isEditable || isSaving) return;

    suppressUndoTrackingRef.current = true;
    setDraft({
      ...nextDraft,
      variants: nextDraft.variants.map(cloneVariant)
    });
    setProductType(preparedState.productType);
    setTypeSpecificData(cloneTypeSpecificData(preparedState.typeSpecificData));
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

    setIsSaving(true);

    try {
      const uploadedImages = await Promise.all(
        preparedState.mediaImages.map(async (slot) => {
          if (!slot.file) return slot;
          const uploaded = await uploadMediaFile(slot.file);
          imageTypeHintsRef.current[uploaded.url] = inferImageExtensionLabel({
            mimeType: uploaded.mimeType ?? slot.mimeType ?? undefined,
            fileName: uploaded.filename ?? slot.filename ?? undefined
          });
          return {
            ...slot,
            previewUrl: uploaded.url,
            uploadedUrl: uploaded.url,
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
            const uploaded = await uploadMediaFile(preparedState.video.file);
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
          const uploaded = await uploadMediaFile(documentEntry.file);
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

      const payload: CatalogItemEditorPayload = {
        id: initialData?.id,
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
        variants: nextDraft.variants.map((variant, index) => ({
          variantName: buildPersistedVariantName({
            ...variant,
            weight: variant.weight ?? (preparedState.sideSettings.weightPerUnit ? Number(preparedState.sideSettings.weightPerUnit) : null)
          }, {
            baseName: nextDraft.name,
            variantCount: nextDraft.variants.length,
            index
          }),
          length: variant.length,
          width: variant.width,
          thickness: variant.thickness,
          weight: variant.weight ?? (preparedState.sideSettings.weightPerUnit ? Number(preparedState.sideSettings.weightPerUnit) : null),
          errorTolerance: (variant.errorTolerance ?? preparedState.sideSettings.thicknessTolerance) || null,
          price: variant.price,
          discountPct: variant.discountPct,
          inventory: variant.stock,
          minOrder: Math.max(1, variant.minOrder ?? Number(preparedState.sideSettings.moq || 1)),
          variantSku: variant.sku || null,
          unit: null,
          status: variant.active ? 'active' : 'inactive',
          badge: preparedState.variantTags[variant.id] ?? (normalizeVariantTag(variant.badge) || null),
          position: variant.sort ?? index,
          imageAssignments: variant.imageAssignments ?? []
        })),
        quantityDiscounts: preparedState.quantityDiscounts.map((rule, index) => ({
          id: rule.persistedId,
          minQuantity: Math.max(1, Math.floor(rule.minQuantity)),
          discountPercent: Math.min(100, Math.max(0, rule.discountPercent)),
          appliesTo: serializeQuantityDiscountTargets(rule),
          note: rule.note.trim() || null,
          position: index
        })),
        media: [
          ...uploadedImages.map((entry, index) => ({
            mediaKind: 'image' as const,
            role: 'gallery' as const,
            sourceKind: 'upload' as const,
            blobUrl: entry.uploadedUrl,
            altText: entry.altText || null,
            position: index
          })),
          ...(uploadedVideo
            ? [
                {
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
          variants: canonicalDraft.variants.map(cloneVariant)
        },
        productType: preparedState.productType,
        typeSpecificData: cloneTypeSpecificData(preparedState.typeSpecificData),
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
      setIsSaving(false);
    }
  };

  const save = async (..._args: unknown[]) => {
    commitPendingTextUndoSession();
    if (!draft.name.trim()) {
      toast.error('Naziv je obvezen.');
      return;
    }
    if (!draft.category.trim() || selectedCategoryPath.length === 0) {
      toast.error('Kategorija je obvezna.');
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

    const nextPersistedState = cloneEditorPersistedState(buildSaveReadyPersistedState(buildPersistedState(decimalCommit.nextDraft)));
    const computedChangeGroups = buildProposedSaveChanges(savedSnapshot, nextPersistedState);
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
      toast.error('Artikel nima veljavnega identifikatorja za arhiviranje.');
      return;
    }
    const shouldArchive = window.confirm(
      hasUnsavedChanges
        ? 'Artikel ima neshranjene spremembe. Če nadaljujete, bo v arhiv dodana trenutna lokalna različica, artikel pa bo odstranjen iz aktivnega seznama. Želite nadaljevati?'
        : 'Ali želite arhivirati ta artikel?'
    );
    if (!shouldArchive) return;

    const previousArchiveItems = readArchivedItemStorage();
    writeArchivedItemStorage([
      buildArchiveRecord(currentPersistedState, itemIdentifier),
      ...previousArchiveItems.filter((item) => String(item.id ?? '') !== itemIdentifier)
    ]);

    try {
      const response = await fetch(`/api/admin/artikli/${encodeURIComponent(itemIdentifier)}`, { method: 'DELETE' });
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { message?: string };
        throw new Error(body.message || 'Arhiviranje artikla ni uspelo.');
      }
      toast.success('Artikel je arhiviran.');
      router.push('/admin/arhiv/artikli');
      router.refresh();
    } catch (error) {
      writeArchivedItemStorage(previousArchiveItems);
      toast.error(error instanceof Error ? error.message : 'Arhiviranje artikla ni uspelo.');
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
      const body = (await response.json().catch(() => ({}))) as { item?: AdminCatalogListItem; message?: string };
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
  const setTableEditorMode = (_value: 'read' | 'edit' | ((current: 'read' | 'edit') => 'read' | 'edit')) => undefined;
  const canArchive = mode !== 'create' && Boolean(articleId || initialData?.id || draft.slug.trim()) && !isSaving;
  const canDuplicate = mode !== 'create' && Boolean(articleId || initialData?.id || draft.slug.trim()) && !isSaving && !isDuplicating;

  const discardEditorUnsavedChanges = () => {
    setIsDiscardUnsavedDialogOpen(false);
    restoreSavedSnapshot();
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

    if (widths.length === 0 || lengths.length === 0 || (shouldUseThickness && thicknesses.length === 0)) {
      toast.error(shouldUseThickness ? 'Najprej dodajte Dolžino, Širino in Debelino.' : 'Najprej dodajte Dolžino in Širino/fi.');
      return;
    }

    const baseSku = sideSettings.sku.trim();
    const normalizedBaseForVariants = baseSku.replace(/-GEN$/i, '');
    const generatedByKey = new Map<string, VariantDimensionSet>();

    widths.forEach((width) => lengths.forEach((length) => thicknessValues.forEach((thickness) => {
      const canonical = canonicalizeVariantDimensions({
        length,
        width,
        thickness
      });
      const key = shouldUseThickness
        ? `${canonical.length}|${canonical.width}|${canonical.thickness}`
        : `${canonical.length}|${canonical.width}`;
      if (!generatedByKey.has(key)) generatedByKey.set(key, canonical);
    })));

    const generated: Variant[] = Array.from(generatedByKey.values()).map((dimensions, index) => {
      const dimensionSuffix = shouldUseThickness
        ? `${formatDecimalForSku(dimensions.length)}x${formatDecimalForSku(dimensions.width)}x${formatDecimalForSku(dimensions.thickness)}`
        : `${formatDecimalForSku(dimensions.length)}x${formatDecimalForSku(dimensions.width)}`;
      const generatedSku = baseSku
        ? `${normalizedBaseForVariants}-${dimensionSuffix}`
        : shouldUseThickness
          ? `${toSlug(draft.name || 'artikel').toUpperCase()}-${formatDecimalForSku(dimensions.length)}${formatDecimalForSku(dimensions.width)}${formatDecimalForSku(dimensions.thickness)}`
          : `${toSlug(draft.name || 'artikel').toUpperCase()}-${formatDecimalForSku(dimensions.length)}${formatDecimalForSku(dimensions.width)}`;
      return createVariant({
        label: shouldUseThickness
          ? `${formatDecimalForDisplay(dimensions.length)} × ${formatDecimalForDisplay(dimensions.width)} × ${formatDecimalForDisplay(dimensions.thickness)} mm`
          : `${formatDecimalForDisplay(dimensions.length)} × ${formatDecimalForDisplay(dimensions.width)} mm`,
        width: dimensions.width,
        length: dimensions.length,
        thickness: dimensions.thickness,
        sku: generatedSku,
        skuAutoGenerated: true,
        price: 0,
        discountPct: draft.defaultDiscountPct,
        sort: index + 1
      });
    });

    setDraft((current) => ({ ...current, variants: generated }));
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
        if (variant.length === null || variant.width === null || variant.thickness === null) return variant;
        const nextSku = `${normalizedBaseForVariants}-${formatDecimalForSku(variant.length)}x${formatDecimalForSku(variant.width)}x${formatDecimalForSku(variant.thickness)}`;
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
    const match = normalized.match(/^(dolzina|dolžina|sirina(?:\/fi)?|širina(?:\/fi)?|debelina|fi|d|s|š|v|h)\s*:?\s*(.+)$/i);
    if (!match) return { error: 'Uporabite Dolžina/Širina/fi/Debelina + vrednosti.' };
    const prefix = match[1]
      .toLowerCase()
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '');
    const rawValues = (match[2] ?? '').trim().replace(/:/g, ',');
    if (!rawValues) return { error: 'Dodajte vsaj eno številčno vrednost.' };

    const dimension: GeneratorDimension = (prefix.startsWith('dol') || prefix === 'd')
      ? 'length'
      : (prefix.startsWith('sir') || prefix.startsWith('fi') || prefix === 's')
        ? 'width'
        : (prefix.startsWith('deb') || prefix === 'v' || prefix === 'h')
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

  const uploadMediaFile = useCallback(async (file: File): Promise<UploadedMediaFile> => {
    const itemSlug = (draft.slug || toSlug(draft.name || articleId || 'artikel')).trim();
    if (!itemSlug) {
      throw new Error('Najprej vnesite naziv ali URL artikla.');
    }
    const formData = new FormData();
    formData.append('file', file);
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
      throw new Error(body.message || 'Nalaganje datoteke ni uspelo.');
    }
    return {
      url: body.url,
      pathname: body.pathname,
      mimeType: body.mimeType ?? null,
      filename: body.filename ?? file.name,
      size: body.size
    };
  }, [articleId, draft.name, draft.slug]);

  const uploadMediaUrl = useCallback(async (sourceUrl: string, mediaKind: MediaUrlImportKind): Promise<UploadedMediaFile> => {
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
        variants: remainingVariants.map((variant, index) => ({
          ...variant,
          sort: index + 1
        }))
      };
    });
    setVariantSelections(new Set());
    toast.info(removedCount === 1 ? 'Različica je odstranjena. Shrani za potrditev.' : `Odstranjenih različic: ${removedCount}. Shrani za potrditev.`);
  };

  const setVariantTag = (variantId: string, tag: VariantTag) => {
    setVariantTags((current) => ({ ...current, [variantId]: tag }));
  };

  const getVariantTag = (variantId: string): VariantTag => variantTags[variantId] ?? 'na-zalogi';

  const addQuantityDiscount = () => {
    setQuantityDiscounts((current) => {
      const maxMinQuantity = current.reduce((max, rule) => Math.max(max, rule.minQuantity), 0);
      return [
        ...current,
        {
          ...createQuantityDiscountDraft({
            minQuantity: Math.max(1, maxMinQuantity + 10),
            discountPercent: 0,
            appliesTo: 'allVariants',
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
    delete imageTypeHintsRef.current[url];
  }, []);

  useEffect(() => () => {
    localBlobUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    localBlobUrlsRef.current.clear();
    imageTypeHintsRef.current = {};
  }, []);

  useEffect(() => {
    mediaImagesDraft.forEach((url) => {
      if (!url || imageMeta[url]) return;
      const probe = new window.Image();
      probe.onload = () => {
        const extension = imageTypeHintsRef.current[url] ?? inferImageExtensionLabel({ url });
        setImageMeta((current) => ({ ...current, [url]: { width: probe.width, height: probe.height, type: extension } }));
      };
      probe.src = url;
    });
  }, [imageMeta, mediaImagesDraft]);

  useEffect(() => {
    if (editingImageSlot === null) return;
    if (!mediaImagesDraft[editingImageSlot]) setEditingImageSlot(null);
  }, [editingImageSlot, mediaImagesDraft]);

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

  useEffect(() => {
    updateImageAtSlotRef.current = updateImageAtSlot;
  }, [updateImageAtSlot]);

  useEffect(() => {
    const uppy = new Uppy({
      autoProceed: false,
      restrictions: {
        allowedFileTypes: ['image/*'],
        maxFileSize: IMAGE_MAX_UPLOAD_BYTES,
        maxNumberOfFiles: 1
      },
      onBeforeFileAdded: (file) => {
        const plan = uploadPlanRef.current;
        if (plan.nextOffset >= plan.maxFiles) return false;
        const targetSlot = Math.min(MEDIA_SLOT_COUNT - 1, plan.startSlot + plan.nextOffset);
        plan.nextOffset += 1;
        return {
          ...file,
          meta: {
            ...file.meta,
            targetSlot
          }
        };
      }
    });

    uppy.on('restriction-failed', (_file, error) => {
      toast.error(error.message || 'Nalaganje ni uspelo. Dovoljene so le slike do 4 MB.');
    });

    uppy.on('error', (error) => {
      toast.error(error.message || 'Pri nalaganju slik je prišlo do napake.');
    });
    uppy.on('files-added', () => {
      void uppy.upload();
    });

    uppy.addUploader(async (fileIDs) => {
      for (const fileID of fileIDs) {
        const file = uppy.getFile(fileID);
        if (!file) continue;
        const targetSlot = Number(file.meta?.targetSlot);
        if (!Number.isFinite(targetSlot)) continue;
        const blob = file.data;
        if (!(blob instanceof Blob)) continue;
        const stagedFile = blob instanceof File ? blob : new File([blob], file.name, { type: file.type });
        const previewUrl = createLocalImageUrl(stagedFile);
        imageTypeHintsRef.current[previewUrl] = inferImageExtensionLabel({ mimeType: file.type, fileName: file.name });
        updateImageAtSlotRef.current(Math.max(0, Math.min(MEDIA_SLOT_COUNT - 1, targetSlot)), {
          previewUrl,
          uploadedUrl: null,
          file: stagedFile,
          filename: file.name,
          mimeType: file.type || null,
          altText: mediaImageSlots[Math.max(0, Math.min(MEDIA_SLOT_COUNT - 1, targetSlot))]?.altText ?? '',
          localId: createLocalStageId()
        });
      }
      fileIDs.forEach((fileID) => {
        if (uppy.getFile(fileID)) uppy.removeFile(fileID);
      });
    });

    uppyRef.current = uppy;
    return () => {
      uppy.cancelAll();
      uppy.destroy();
      uppyRef.current = null;
    };
  }, [createLocalImageUrl, mediaImageSlots, toast, updateImageAtSlot]);

  const stageImageFile = useCallback((file: File, slotIndex: number) => {
    const boundedSlotIndex = Math.max(0, Math.min(MEDIA_SLOT_COUNT - 1, slotIndex));
    const previewUrl = createLocalImageUrl(file);
    imageTypeHintsRef.current[previewUrl] = inferImageExtensionLabel({ mimeType: file.type, fileName: file.name });
    updateImageAtSlot(boundedSlotIndex, {
      previewUrl,
      uploadedUrl: null,
      file,
      filename: file.name,
      mimeType: file.type || null,
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
        imageTypeHintsRef.current[uploaded.url] = inferImageExtensionLabel({
          mimeType: uploaded.mimeType ?? undefined,
          fileName: uploaded.filename
        });
        updateImageAtSlot(targetSlot, {
          previewUrl: uploaded.url,
          uploadedUrl: uploaded.url,
          file: null,
          filename: uploaded.filename,
          mimeType: uploaded.mimeType,
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

  const openUppyFilePicker = useCallback((slotIndex: number, allowMultiple: boolean) => {
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
      variants: current.variants.map((variant) => {
        const assignments = [...(variant.imageAssignments ?? [])];
        const fromPos = assignments.indexOf(fromIndex);
        const toPos = assignments.indexOf(toIndex);
        if (fromPos !== -1) assignments[fromPos] = toIndex;
        if (toPos !== -1) assignments[toPos] = fromIndex;
        return { ...variant, imageAssignments: assignments };
      })
    }));
  };

  const removeImageSlot = (slotIndex: number) => {
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

  const assignImageToVariant = (variantIndex: number, slotIndex: number) => {
    const slotImage = mediaImagesDraft[slotIndex];
    if (!slotImage) return;
    const variant = draft.variants[variantIndex];
    if (!variant) return;
    const currentAssignments = variant.imageAssignments ?? [];
    if (currentAssignments.includes(slotIndex)) return;
    updateVariant(variant.id, { imageAssignments: [...currentAssignments, slotIndex], imageOverride: slotImage });
  };

  const reorderVariantAssignment = (variantIndex: number, fromSlot: number, toSlot: number) => {
    const variant = draft.variants[variantIndex];
    if (!variant) return;
    const assignments = [...(variant.imageAssignments ?? [])];
    const fromIndex = assignments.indexOf(fromSlot);
    const toIndex = assignments.indexOf(toSlot);
    if (fromIndex === -1 || toIndex === -1) return;
    assignments.splice(fromIndex, 1);
    assignments.splice(toIndex, 0, fromSlot);
    updateVariant(variant.id, {
      imageAssignments: assignments,
      imageOverride: assignments.length > 0 ? mediaImagesDraft[assignments[0]] ?? null : null
    });
  };

  const updateImageAltText = useCallback((slotIndex: number, altText: string) => {
    setMediaImageSlots((current) => current.map((slot, index) => (index === slotIndex ? { ...slot, altText } : slot)));
  }, []);

  const handleSaveEditedImage = useCallback((slotIndex: number, blob: Blob, mimeType: string) => {
    const nextMimeType = mimeType || 'image/webp';
    if (blob.size > IMAGE_MAX_UPLOAD_BYTES) {
      toast.error('Urejena slika je prevelika. Dovoljene so le slike do 4 MB.');
      return;
    }
    const extension = inferImageExtensionLabel({ mimeType: nextMimeType, fileName: 'edited.webp' }).toLowerCase();
    const fileName = `edited-${Date.now()}.${extension}`;
    const file = new File([blob], fileName, { type: nextMimeType });
    const previewUrl = createLocalImageUrl(file);
    imageTypeHintsRef.current[previewUrl] = inferImageExtensionLabel({ mimeType: nextMimeType, fileName });
    updateImageAtSlot(slotIndex, {
      previewUrl,
      uploadedUrl: null,
      file,
      filename: fileName,
      mimeType: nextMimeType,
      altText: mediaImageSlots[slotIndex]?.altText ?? '',
      localId: createLocalStageId()
    });
    setEditingImageSlot(null);
    toast.success('Slika je pripravljena za shranjevanje.');
  }, [createLocalImageUrl, mediaImageSlots, toast, updateImageAtSlot]);

  const renderImageActionButtons = (slotIndex: number) => {
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
        onClick: () => openUppyFilePicker(slotIndex, false),
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
            className={`inline-flex items-center justify-center rounded-md border px-0 leading-none shadow-[0_6px_18px_rgba(15,23,42,0.12)] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 ${compact ? 'h-[20px] w-[20px]' : 'h-[25px] min-w-[1.6rem]'} ${action.tone === 'danger' ? 'border-[#f1c1bd] bg-white text-[#d2554a] hover:bg-[#fff7f6]' : 'border-slate-200 bg-white text-slate-900 hover:bg-slate-50'}`}
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
          { title: 'Enota prodaje', value: 'kg', placeholder: 'kg', icon: 'sku' as SideFieldIcon, onChange: () => {} },
          { title: 'DDV', value: '22 %', placeholder: '22 %', icon: 'color' as SideFieldIcon, onChange: () => {} }
        ]
      : productType === 'unique_machine'
        ? [
            { title: 'Enota prodaje', value: 'kos', placeholder: 'kos', icon: 'sku' as SideFieldIcon, onChange: () => {} },
            { title: 'DDV', value: '22 %', placeholder: '22 %', icon: 'color' as SideFieldIcon, onChange: () => {} }
          ]
        : [
            { title: 'Barva', value: sideSettings.color, placeholder: 'Srebrna', icon: 'color' as SideFieldIcon, onChange: (value: string) => setSideSettings((current) => ({ ...current, color: value })) },
            { title: 'Oblika', value: sideSettings.surface, placeholder: 'Pravokotna', icon: 'shape' as SideFieldIcon, onChange: (value: string) => setSideSettings((current) => ({ ...current, surface: value })) },
            { title: 'Enota prodaje', value: 'kos', placeholder: 'kos', icon: 'sku' as SideFieldIcon, onChange: () => {} },
            { title: 'DDV', value: '22 %', placeholder: '22 %', icon: 'color' as SideFieldIcon, onChange: () => {} }
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
            <IconButton
              type="button"
              onClick={handleEditModeToggle}
              tone="neutral"
              size="sm"
              className={`order-1 ${adminTableNeutralIconButtonClassName}`}
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
              className={`order-2 ${adminTableNeutralIconButtonClassName}`}
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
              className={`order-3 ${adminTableNeutralIconButtonClassName}`}
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
              className={`order-4 ${adminTableSelectedWarningIconButtonClassName}`}
              aria-label="Arhiviraj artikel"
              title="Arhiviraj"
              disabled={!canArchive}
            >
              <ArchiveIcon />
            </IconButton>
            <Button
              type="button"
              variant="primary"
              size="toolbar"
              className={`order-5 ${topActionSaveButtonClassName}`}
              onClick={() => void save()}
              disabled={!isEditable || !hasUnsavedChanges || isSaving}
            >
              <SaveIcon className={topSaveActionButtonIconClassName} />
              <span>Shrani</span>
            </Button>
          </div>
        </div>
        <ProductTypeSelectorCardRow value={productType} editable={isEditable} onChange={changeProductType} embedded />
      </section>
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
              <h2 className={editorSectionTitleClassName}>Osnovni podatki</h2>
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
                size="compact"
                tone="muted-control"
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
                    uppyRef.current ? (
                      <UppyDropzoneField
                        uppy={uppyRef.current}
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
                      </UppyDropzoneField>
                    ) : (
                      <div
                        className={`group relative flex h-full w-full items-center justify-center rounded-[8px] bg-[#f5f6f8] text-[#1982bf] transition ${isMediaEditable ? 'cursor-pointer hover:bg-[#f3f5f7]' : 'cursor-not-allowed opacity-60'}`}
                        onClick={() => openUppyFilePicker(0, true)}
                        onDragOver={(event) => {
                          if (!isMediaEditable) return;
                          event.preventDefault();
                        }}
                        onDrop={(event) => {
                          if (!isMediaEditable) return;
                          event.preventDefault();
                          prepareDropzoneUploadPlan(0, true, Array.from(event.dataTransfer.files));
                        }}
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
                      </div>
                    )
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
                          if (suppressImageClickAfterDragRef.current) {
                            suppressImageClickAfterDragRef.current = false;
                            return;
                          }
                          setEditingImageSlot(0);
                        }}
                      >
                        <Image src={mediaImagesDraft[0]} alt="Glavna slika" width={1200} height={1200} unoptimized sizes="(max-width: 1280px) 36vw, 420px" className="h-full w-full object-cover" />
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
                                if (suppressImageClickAfterDragRef.current) {
                                  suppressImageClickAfterDragRef.current = false;
                                  return;
                                }
                                setEditingImageSlot(slotIndex);
                              }}
                            >
                              <Image src={slotImage} alt={`Slika ${slotIndex + 1}`} width={720} height={720} unoptimized sizes="(max-width: 1280px) 18vw, 180px" className="h-full w-full object-cover" />
                              {renderImageActionButtons(slotIndex)}
                            </div>
                          );
                        }

                        if (isActiveUploadSlot) {
                          return (
                            uppyRef.current ? (
                              <UppyDropzoneField
                                key={`slot-${slotIndex}`}
                                uppy={uppyRef.current}
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
                              </UppyDropzoneField>
                            ) : (
                              <div
                                key={`slot-${slotIndex}`}
                                className={`group relative flex h-full flex-col items-center justify-center gap-1.5 rounded-[8px] bg-[#f5f6f8] px-2 py-3 text-center text-slate-500 transition ${isMediaEditable ? 'cursor-pointer hover:bg-[#f3f5f7]' : 'cursor-not-allowed opacity-60'}`}
                                onClick={() => openUppyFilePicker(slotIndex, true)}
                                onDragOver={(event) => {
                                  if (!isMediaEditable) return;
                                  event.preventDefault();
                                }}
                                onDrop={(event) => {
                                  if (!isMediaEditable) return;
                                  event.preventDefault();
                                  prepareDropzoneUploadPlan(slotIndex, true, Array.from(event.dataTransfer.files));
                                }}
                              >
                                <CalmDashedOutline
                                  className="inset-0 text-[#c8c8c8] transition group-hover:text-[#c8c8c8]"
                                  strokeWidth={1.1664}
                                  dashLength={3.77}
                                  gapLength={2.95}
                                  lineCap="butt"
                                />
                                <ImageUploadFrameIcon className="relative z-[1] h-[42px] w-[42px] text-[#1982bf]" />
                                <span className="relative z-[1] -translate-y-[7px] text-[10px] font-medium leading-none text-slate-600">Naloži sliko</span>
                              </div>
                            )
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
                  <table className="min-w-full text-xs">
                    <thead className="bg-[color:var(--admin-table-header-bg)]">
                      <tr>
                        <th className="px-2 py-1.5 text-left">SKU</th>
                        <th className="px-2 py-1.5 text-center">Tip</th>
                        <th className="px-2 py-1.5 text-center">{productType === 'weight' ? 'Teža' : 'Dimenzije'}</th>
                        <th className="px-2 py-1.5 text-left">Slike</th>
                      </tr>
                    </thead>
                    <tbody>
                      {draft.variants.map((variant, variantIndex) => {
                        const assignedSlots = variant.imageAssignments ?? [];
                        const variantTypeLabel =
                          productType === 'dimensions'
                            ? 'Plošča'
                            : productType === 'weight'
                              ? 'Po teži'
                              : productType === 'unique_machine'
                                ? 'Stroj'
                                : 'Enostavni';
                        const variantDimensionParts = [variant.length, variant.width, variant.thickness]
                          .filter((value): value is number => value !== null && value !== undefined)
                          .map((value) => formatDecimalForDisplay(value));
                        const variantDimensionLabel = variantDimensionParts.length > 0
                          ? `${variantDimensionParts.join(' x ')} mm`
                          : productType === 'weight'
                            ? (variant.weight === null || variant.weight === undefined ? '—' : `${formatDecimalForDisplay(variant.weight)} kg`)
                            : '—';
                        return (
                          <tr
                            key={`variant-media-${variant.id}`}
                            className="border-t border-slate-100"
                            onDragOver={(event) => {
                              if (!isMediaEditable) return;
                              event.preventDefault();
                            }}
                            onDrop={(event) => {
                              event.preventDefault();
                              if (!isMediaEditable || draggedImageIndex === null) return;
                              assignImageToVariant(variantIndex, draggedImageIndex);
                              setDraggedImageIndex(null);
                            }}
                          >
                            <td className="px-2 py-1.5">{variant.sku || '—'}</td>
                            <td className="px-2 py-1.5 text-center">{variantTypeLabel}</td>
                            <td className="px-2 py-1.5 text-center">{variantDimensionLabel}</td>
                            <td className="px-2 py-1.5">
                              <div className="flex flex-wrap gap-1">
                                {assignedSlots.map((slot) => {
                                  const slotImage = mediaImagesDraft[slot];
                                  if (!slotImage) return null;
                                  return (
                                    <div
                                      key={`${variant.id}-${slot}`}
                                      className="inline-flex h-[18px] items-center gap-1 overflow-hidden rounded-md border border-slate-200 bg-white px-1"
                                      draggable={isMediaEditable}
                                      onDragStart={() => {
                                        setDraggedVariantId(variant.id);
                                        setDraggedVariantImageSlot(slot);
                                      }}
                                      onDragOver={(event) => {
                                        if (!isMediaEditable) return;
                                        event.preventDefault();
                                      }}
                                      onDrop={(event) => {
                                        event.preventDefault();
                                        if (!isMediaEditable || draggedVariantId !== variant.id || draggedVariantImageSlot === null) return;
                                        reorderVariantAssignment(variantIndex, draggedVariantImageSlot, slot);
                                        setDraggedVariantId(null);
                                        setDraggedVariantImageSlot(null);
                                      }}
                                    >
                                      <Image src={slotImage} alt={`SKU ${variant.sku}`} width={16} height={16} unoptimized className="h-4 w-4 shrink-0 rounded object-cover" />
                                      <span className="max-w-[84px] truncate text-[11px] text-slate-600">Slika {slot + 1}</span>
                                      <button
                                        type="button"
                                        disabled={!isMediaEditable}
                                        className="text-slate-400 hover:text-rose-600"
                                        onClick={() => updateVariant(variant.id, {
                                          imageAssignments: assignedSlots.filter((value) => value !== slot),
                                          imageOverride: assignedSlots.length > 1 ? mediaImagesDraft[assignedSlots.find((value) => value !== slot) ?? 0] ?? null : null
                                        })}
                                      >
                                        ×
                                      </button>
                                    </div>
                                  );
                                })}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
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
                            className={`inline-flex h-[25px] min-w-[1.6rem] items-center justify-center rounded-md border px-0 leading-none shadow-[0_6px_18px_rgba(15,23,42,0.12)] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 ${action.tone === 'danger' ? 'border-[#f1c1bd] bg-white text-[#d2554a] hover:bg-[#fff7f6]' : 'border-slate-200 bg-white text-slate-900 hover:bg-slate-50'}`}
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

      {isDimensionBasedMode ? (
      <section className={`${adminWindowCardClassName} px-5 pb-5 pt-5`} style={adminWindowCardStyle}>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className={editorSectionTitleClassName}>Uredi artikel</h2>
          <div className={`flex items-center gap-2 [&>*:first-child]:hidden [&>*:nth-child(3)]:hidden ${isTableEditable ? '' : '[&>*:nth-child(5)]:pointer-events-none [&>*:nth-child(5)]:opacity-50'}`}>
            <IconButton
              type="button"
              aria-label="Uredi tabelo artikla"
              title={isTableEditable ? 'Zaključi urejanje' : 'Uredi'}
              tone="neutral"
              className={adminTableNeutralIconButtonClassName}
              onClick={() => setTableEditorMode((current) => (current === 'read' ? 'edit' : 'read'))}
            >
              <PencilIcon />
            </IconButton>
            <IconButton
              type="button"
              aria-label="Dodaj različico"
              title="Dodaj različico"
              tone="neutral"
              className={adminTableNeutralIconButtonClassName}
              disabled={!isTableEditable}
              onClick={() => setDraft((current) => ({ ...current, variants: [...current.variants, createVariant({ sort: current.variants.length + 1 })] }))}
            >
              <PlusIcon />
            </IconButton>
            <IconButton
              type="button"
              aria-label="Shrani tabelo artikla"
              title="Shrani"
              tone="neutral"
              className={adminTableNeutralIconButtonClassName}
              disabled={!isTableEditable}
              onClick={async () => {
                setTableEditorMode('read');
                await save();
              }}
            >
              <SaveIcon />
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
              onClick={generateVariants}
            >
              Generiraj različice
            </Button>
          </div>
        </div>
        <div className="mb-3 space-y-2">
          <h3 className="text-sm font-semibold text-slate-800">Dimenzije</h3>
          <p className="text-xs text-slate-500">
            Vnesi vrednosti (v mm) za vsako dimenzijo posebej, na primer: <span className={inlineSnippetClass}>Dolžina: 10; 20</span>. Več vrednosti loči s podpičjem; decimalke lahko vneseš z vejico ali piko, npr. <span className={inlineSnippetClass}>10,5; 20.25</span>. Podprte so Dolžina, Širina/fi in Debelina, razen pri dolžinskih artiklih, kjer Debelina ni dovoljena. Za posamezno dimenzijo lahko dodaš največ pet vrednosti.
          </p>
          <p className="whitespace-nowrap text-xs leading-5 text-slate-700">
            <span className="font-semibold">Dodaj do tri dimenzije. Vnosne bližnjice:</span>{' '}
            <span className={`${inlineSnippetClass} !font-normal`}>d:</span>, <span className={`${inlineSnippetClass} !font-normal`}>š:</span>, <span className={`${inlineSnippetClass} !font-normal`}>fi:</span>, <span className={`${inlineSnippetClass} !font-normal`}>h:</span>, <span className={`${inlineSnippetClass} !font-normal`}>v:</span>
          </p>
          <div className="pt-2">
            <div className="flex items-start gap-3">
            <div className="relative w-1/2 min-w-[300px]">
              <div className={`flex h-[30px] flex-nowrap items-center gap-2 overflow-hidden rounded-md border border-slate-300 pl-[10px] pr-11 ${isGeneratorLocked ? '!bg-[color:var(--field-locked-bg)] text-slate-500' : 'bg-white'}`}>
                <SideInputIcon icon="dimension" muted={generatorInput.trim().length === 0 && generatorChips.length === 0} />
                {generatorChips.map((chip) => (
                  <span key={chip.dimension} className={`${adminProductInputChipClassName} shrink-0 whitespace-nowrap`}>
                    <button
                      type="button"
                      className="whitespace-nowrap hover:text-[#0f6799] disabled:cursor-not-allowed disabled:text-slate-400"
                      disabled={isGeneratorLocked}
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
                      className="text-[#1982bf]/70 transition hover:text-rose-600 active:text-rose-700 disabled:cursor-not-allowed disabled:text-slate-400"
                      disabled={isGeneratorLocked}
                      onClick={() => setGeneratorChips((current) => current.filter((entry) => entry.dimension !== chip.dimension))}
                    >
                      ×
                    </button>
                  </span>
                ))}
                <input
                  className={`h-full min-w-0 flex-1 border-0 bg-transparent text-xs outline-none focus:ring-0 ${isGeneratorLocked ? 'cursor-not-allowed text-slate-500' : 'text-slate-900'}`}
                  value={generatorInput}
                  disabled={isGeneratorLocked}
                  onChange={(event) => {
                    setGeneratorInput(event.target.value);
                    if (generatorError) setGeneratorError(null);
                  }}
                  placeholder={generatorChips.length > 0 ? '' : 'Dolžina: 10; 20 + enter'}
                  onKeyDown={(event) => {
                    if (event.key !== 'Enter') return;
                    event.preventDefault();
                    submitGeneratorEntry();
                  }}
                />
              </div>
              <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-400">{combinationCount}</span>
            </div>
          </div>
          </div>
          <div className="text-xs">
            {generatorError ? <span className="text-rose-600">{generatorError}</span> : null}
          </div>
        </div>
        <div className="relative overflow-x-auto overflow-y-visible rounded-lg border border-slate-200">
          <table className="min-w-full text-[11px] leading-4">
            <colgroup>
              <col style={{ width: '1.87%' }} />
              <col style={{ width: '5.4%' }} />
              <col style={{ width: '5.4%' }} />
              <col style={{ width: '5.1%' }} />
              <col style={{ width: '5%' }} />
              <col style={{ width: '5.1%' }} />
              <col style={{ width: '5.1%' }} />
              {!isDimensionBasedMode ? (
                <>
                  <col style={{ width: '6%' }} />
                  <col style={{ width: '8%' }} />
                </>
              ) : null}
              <col style={{ width: '6%' }} />
              <col style={{ width: '6%' }} />
              <col style={{ width: '20.97%' }} />
              <col style={{ width: '8%' }} />
              <col style={{ width: '9%' }} />
              <col style={{ width: '3.06%' }} />
            </colgroup>
            <THead>
              <tr>
                <TH className={`${adminTableRowHeightClassName} px-2 py-1.5 text-center text-[11px]`}>
                  <AdminCheckbox
                    checked={isTableEditable && allVariantsSelected}
                    onChange={() =>
                      setVariantSelections(allVariantsSelected ? new Set() : new Set(draft.variants.map((variant) => variant.id)))
                    }
                    disabled={!isTableEditable}
                  />
                </TH>
                <TH className={`${adminTableRowHeightClassName} px-2 py-1.5 text-right text-[11px]`}>Dolžina</TH>
                <TH className={`${adminTableRowHeightClassName} px-2 py-1.5 text-right text-[11px]`}>Širina/fi</TH>
                <TH className={`${adminTableRowHeightClassName} px-2 py-1.5 text-right text-[11px]`}>Debelina</TH>
                <TH className={`${adminTableRowHeightClassName} px-2 py-1.5 text-right text-[11px]`}>Teža</TH>
                <TH className={`${adminTableRowHeightClassName} px-2 py-1.5 text-center text-[11px]`}>Toleranca</TH>
                <TH className={`${adminTableRowHeightClassName} px-2 py-1.5 text-right text-[11px]`}>Cena</TH>
                {!isDimensionBasedMode ? (
                  <>
                    <TH className={`${adminTableRowHeightClassName} px-2 py-1.5 text-right text-[11px]`}>Popust</TH>
                    <TH className={`${adminTableRowHeightClassName} whitespace-nowrap px-2 py-1.5 text-right text-[11px]`}>Akcijska cena</TH>
                  </>
                ) : null}
                <TH className={`${adminTableRowHeightClassName} px-2 py-1.5 text-right text-[11px]`}>Zaloga</TH>
                <TH className={`${adminTableRowHeightClassName} px-2 py-1.5 text-center text-[11px]`}>Min količina</TH>
                <TH className={`${adminTableRowHeightClassName} px-2 py-1.5 text-center text-[11px]`}>SKU</TH>
                <TH className={`${adminTableRowHeightClassName} px-1 py-1.5 text-center text-[11px]`}>Status</TH>
                <TH className={`${adminTableRowHeightClassName} px-1 py-1.5 text-center text-[11px]`}>Opombe</TH>
                <TH className={`${adminTableRowHeightClassName} px-2 py-1.5 text-center text-[11px]`}>Mesto</TH>
              </tr>
            </THead>
            <tbody>
              {draft.variants.map((variant) => (
                <tr key={variant.id} className={`${adminTableRowHeightClassName} border-t border-slate-100 align-middle`}>
                  <td className="px-2 py-1.5 text-center"><AdminCheckbox checked={variantSelections.has(variant.id)} onChange={() => setVariantSelections((current) => { const next = new Set(current); if (next.has(variant.id)) next.delete(variant.id); else next.add(variant.id); return next; })} disabled={!isTableEditable} /></td>
                  <td className="px-2 py-1.5 text-right">{isTableEditable ? <span className={`inline-flex w-full justify-end ${isDimensionLockActive ? 'text-slate-500' : ''}`}><span className={compactTableValueUnitShellClassName}><input type="text" inputMode="decimal" disabled={isDimensionLockActive} className={`${compactTableAlignedInputClassName} !w-[7ch] text-right ${isDimensionLockActive ? '!bg-[color:var(--field-locked-bg)] text-slate-500' : ''}`} value={readDecimalInputValue(variant.id, 'length', variant.length)} onChange={(event) => updateDecimalInputDraft(variant.id, 'length', event.target.value)} onBlur={() => commitDecimalInputDraft(variant.id, 'length', variant.length, (value) => updateVariant(variant.id, { length: value }), null)} /><span className={compactTableAdornmentClassName}>mm</span></span></span> : <span className={`inline-flex h-6 w-full justify-end ${isDimensionLockActive ? 'text-slate-500' : ''}`}><span className={compactTableValueUnitShellClassName}><span className={compactTableNumericSlotClassName}>{variant.length === null ? '—' : formatDecimalForDisplay(variant.length)}</span><span className={compactTableAdornmentClassName}>mm</span></span></span>}</td>
                  <td className="px-2 py-1.5 text-right">{isTableEditable ? <span className={`inline-flex w-full justify-end ${isDimensionLockActive ? 'text-slate-500' : ''}`}><span className={compactTableValueUnitShellClassName}><input type="text" inputMode="decimal" disabled={isDimensionLockActive} className={`${compactTableAlignedInputClassName} !w-[7ch] text-right ${isDimensionLockActive ? '!bg-[color:var(--field-locked-bg)] text-slate-500' : ''}`} value={readDecimalInputValue(variant.id, 'width', variant.width)} onChange={(event) => updateDecimalInputDraft(variant.id, 'width', event.target.value)} onBlur={() => commitDecimalInputDraft(variant.id, 'width', variant.width, (value) => updateVariant(variant.id, { width: value }), null)} /><span className={compactTableAdornmentClassName}>mm</span></span></span> : <span className={`inline-flex h-6 w-full justify-end ${isDimensionLockActive ? 'text-slate-500' : ''}`}><span className={compactTableValueUnitShellClassName}><span className={compactTableNumericSlotClassName}>{variant.width === null ? '—' : formatDecimalForDisplay(variant.width)}</span><span className={compactTableAdornmentClassName}>mm</span></span></span>}</td>
                  <td className="px-2 py-1.5 text-right">{isTableEditable ? <span className={`inline-flex w-full justify-end ${isThicknessLockActive ? 'text-slate-500' : ''}`}><span className={compactTableValueUnitShellClassName}><input type="text" inputMode="decimal" disabled={isThicknessLockActive} className={`${compactTableAlignedInputClassName} !w-[5ch] text-right ${isThicknessLockActive ? '!bg-[color:var(--field-locked-bg)] text-slate-500' : ''}`} value={readDecimalInputValue(variant.id, 'thickness', variant.thickness)} onChange={(event) => updateDecimalInputDraft(variant.id, 'thickness', event.target.value)} onBlur={() => commitDecimalInputDraft(variant.id, 'thickness', variant.thickness, (value) => updateVariant(variant.id, { thickness: value }), null)} /><span className={compactTableAdornmentClassName}>mm</span></span></span> : <span className={`inline-flex h-6 w-full justify-end ${isThicknessLockActive ? 'text-slate-500' : ''}`}><span className={compactTableValueUnitShellClassName}><span className={compactTableFourDigitSlotClassName}>{variant.thickness === null ? '—' : formatDecimalForDisplay(variant.thickness)}</span><span className={compactTableAdornmentClassName}>mm</span></span></span>}</td>
                  <td className="px-2 py-1.5 text-right">{isTableEditable ? <span className="inline-flex w-full justify-end"><span className={compactTableValueUnitShellClassName}><input type="text" inputMode="decimal" className={`${compactTableAlignedInputClassName} !mt-0 !w-[7ch] text-right`} value={readDecimalInputValue(variant.id, 'weight', variant.weight)} onChange={(event) => updateDecimalInputDraft(variant.id, 'weight', event.target.value)} onBlur={() => commitDecimalInputDraft(variant.id, 'weight', variant.weight ?? null, (value) => updateVariant(variant.id, { weight: value }), null)} /><span className={compactTableAdornmentClassName}>g</span></span></span> : <span className="inline-flex h-6 w-full justify-end"><span className={compactTableValueUnitShellClassName}><span className={compactTableNumericSlotClassName}>{variant.weight === null || variant.weight === undefined ? '—' : formatDecimalForDisplay(variant.weight)}</span><span className={compactTableAdornmentClassName}>g</span></span></span>}</td>
                  <td className="px-2 py-1.5 text-center">
                    {isTableEditable ? (
                      <div className={`inline-flex h-6 items-center justify-center whitespace-nowrap ${isToleranceLocked ? 'text-slate-500' : ''}`}>
                        <span className={compactTableAdornmentClassName}>±</span>
                        <input
                          type="text"
                          inputMode="decimal"
                          disabled={isToleranceLocked}
                          maxLength={1}
                          className={`${compactTableAlignedInputClassName} !mt-0 !w-[3ch] !px-0 text-center ${isToleranceLocked ? '!bg-[color:var(--field-locked-bg)] text-slate-500' : ''}`}
                          value={decimalInputDrafts[decimalDraftKey(variant.id, 'errorTolerance')] ?? variant.errorTolerance ?? ''}
                          onChange={(event) => {
                            if (isToleranceLocked) return;
                            const nextValue = event.target.value.replace(/\D/g, '').slice(0, 1);
                            updateDecimalInputDraft(variant.id, 'errorTolerance', nextValue);
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
                        <span className={`ml-1 ${compactTableAdornmentClassName}`}>mm</span>
                      </div>
                    ) : (
                      <span className="inline-flex h-6 items-center justify-center">
                        {variant.errorTolerance
                          ? (
                            <span className="inline-flex h-6 items-center whitespace-nowrap">
                              <span>{`±${variant.errorTolerance.replace('.', ',')}`}</span>
                              <span className={`ml-1 ${compactTableAdornmentClassName}`}>mm</span>
                            </span>
                          )
                          : '—'}
                      </span>
                    )}
                  </td>
                  <td className="px-2 py-1.5 text-right">{isTableEditable ? <span className="inline-flex w-full justify-end"><span className={compactTableValueUnitShellClassName}><input type="text" inputMode="decimal" className={`${compactTableAlignedInputClassName} !mt-0 !w-[7ch] text-right`} value={readDecimalInputValue(variant.id, 'price', variant.price)} onChange={(event) => updateDecimalInputDraft(variant.id, 'price', event.target.value)} onBlur={() => commitDecimalInputDraft(variant.id, 'price', variant.price, (value) => updateVariant(variant.id, { price: value ?? 0 }), 0)} /><span className={compactTableAdornmentClassName}>€</span></span></span> : <span className="inline-flex h-6 w-full justify-end"><span className={compactTableValueUnitShellClassName}><span className={compactTableNumericSlotClassName}>{formatCurrencyAmountOnly(variant.price)}</span><span className={compactTableAdornmentClassName}>€</span></span></span>}</td>
                  {!isDimensionBasedMode ? (
                    <>
                      <td className="px-2 py-1.5 text-right">{isTableEditable ? <span className="inline-flex w-full justify-end"><span className={compactTableValueUnitShellClassName}><input type="text" inputMode="decimal" className={`${compactTableAlignedInputClassName} !mt-0 !w-[5ch] !px-0 text-right`} value={readDecimalInputValue(variant.id, 'discountPct', variant.discountPct)} onChange={(event) => updateDecimalInputDraft(variant.id, 'discountPct', event.target.value)} onBlur={() => commitDecimalInputDraft(variant.id, 'discountPct', variant.discountPct, (value) => updateVariant(variant.id, { discountPct: Math.min(99.9, Math.max(0, value ?? 0)) }), 0)} /><span className={compactTableAdornmentClassName}>%</span></span></span> : <span className="inline-flex h-6 w-full justify-end"><span className={compactTableValueUnitShellClassName}><span className={compactTableFourDigitSlotClassName}>{formatDecimalForDisplay(variant.discountPct)}</span><span className={compactTableAdornmentClassName}>%</span></span></span>}</td>
                      <td className="px-2 py-1.5 text-right"><span className="inline-flex h-6 items-center justify-end">{variant.discountPct > 0 ? formatCurrency(computeSalePrice(variant.price, variant.discountPct)) : '—'}</span></td>
                    </>
                  ) : null}
                  <td className="px-2 py-1.5 text-right">{isTableEditable ? <span className="inline-flex w-full justify-end"><input type="number" inputMode="numeric" className={`${compactTableAlignedInputClassName} !mt-0 !w-auto !max-w-[6ch] text-right`} value={variant.stock} onChange={(event) => updateVariant(variant.id, { stock: Number(event.target.value) || 0 })} /></span> : <span className="inline-flex h-6 w-full justify-end"><span className="inline-flex h-6 max-w-[6ch] items-center justify-end">{variant.stock}</span></span>}</td>
                  <td className="px-2 py-1.5 text-center">{isTableEditable ? <input type="number" inputMode="numeric" className={`${compactTableAlignedInputClassName} !mt-0 !w-[5ch] !px-0 text-center`} value={variant.minOrder ?? 1} onChange={(event) => updateVariant(variant.id, { minOrder: Math.max(1, Number(event.target.value) || 1) })} /> : <span className="inline-flex h-6 w-[5ch] items-center justify-center">{variant.minOrder ?? 1}</span>}</td>
                  <td className="px-2 py-1.5 text-center">{isTableEditable ? <input className={`${compactTableAlignedTextInputClassName} !mt-0 !h-6 !w-[26ch] text-center`} value={variant.sku} onChange={(event) => updateVariant(variant.id, { sku: event.target.value, skuAutoGenerated: false })} /> : <span className="inline-flex h-6 w-[26ch] items-center justify-center overflow-hidden text-ellipsis whitespace-nowrap text-center">{variant.sku || '—'}</span>}</td>
                  <td className="px-1 py-1.5 text-center">
                    <div className="inline-flex justify-center">
                      <ActiveStateChip
                        active={variant.active}
                        editable={isTableEditable}
                        chipClassName={adminStatusInfoPillCompactTableClassName}
                        menuPlacement="bottom"
                        onChange={(next) => applySelectionChange(() => updateVariant(variant.id, { active: next }))}
                      />
                    </div>
                  </td>
                  <td className="px-1 py-1.5 text-center">
                    <div className="inline-flex justify-center">
                      <NoteTagChip
                        value={getVariantTag(variant.id)}
                        editable={isTableEditable}
                        chipClassName={adminStatusInfoPillCompactTableClassName}
                        menuPlacement="bottom"
                        onChange={(next) => {
                          if (!next) return;
                          applySelectionChange(() => setVariantTag(variant.id, next));
                        }}
                      />
                    </div>
                  </td>
                  <td className="px-2 py-1.5 text-center">{isTableEditable ? <input type="number" inputMode="numeric" className={`${compactTableAlignedInputClassName} !mt-0 !w-[4ch] !px-0 text-center`} value={variant.sort} onChange={(event) => updateVariant(variant.id, { sort: Number(event.target.value) || 1 })} /> : <span className="inline-flex h-6 w-[4ch] items-center justify-center">{variant.sort}</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="border-t border-slate-200 px-3 py-2 text-[11px] leading-4 text-slate-500">Cena vključuje DDV.</p>
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
              minQuantityLabel="Min kg"
              minQuantityAllowsDecimal
            />
          )}
        />
      ) : productType === 'unique_machine' ? (
        <UniqueMachineProductModule
          editable={isEditable}
          data={machineProductData}
          documents={documents.map((documentEntry) => ({ id: documentEntry.id, name: documentEntry.name, size: documentEntry.size }))}
          orderMatches={initialData?.machineSerialOrderMatches ?? []}
          onUploadDocument={() => technicalUploadInputRef.current?.click()}
          onChange={updateMachineProductData}
        />
      ) : (
        <SimpleProductModule
          editable={isEditable}
          data={simpleProductData}
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
              className="!border-t-0"
            />
          )}
        />
      )}

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
        panelClassName="!max-w-2xl"
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
        <div className="mt-3 max-h-[60vh] space-y-4 overflow-y-auto pr-1">
          <p className="text-sm text-slate-600">
            Pred potrditvijo bodo shranjene naslednje spremembe:
          </p>
          {pendingSaveConfirmation?.changeGroups.map((group) => (
            <div key={group.title} className="space-y-2">
              <h3 className="text-sm font-semibold text-slate-900">{group.title}</h3>
              <ul className="space-y-1.5 text-sm text-slate-600">
                {group.items.map((item, index) => (
                  <li key={`${group.title}-${index}`} className="rounded-lg bg-slate-50 px-3 py-2 leading-5">
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Dialog>
      {editingImageSlot !== null && mediaImagesDraft[editingImageSlot]
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

