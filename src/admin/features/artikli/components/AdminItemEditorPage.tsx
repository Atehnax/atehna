'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { PencilIcon, PlusIcon, SaveIcon, TrashCanIcon } from '@/shared/ui/icons/AdminActionIcons';
import { useToast } from '@/shared/ui/toast';
import { MenuItem, MenuPanel } from '@/shared/ui/menu';
import { TH } from '@/shared/ui/table';
import EuiTabs from '@/shared/ui/eui-tabs';
import {
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
import { NoteTagChip, type NoteTag } from '@/admin/features/artikli/components/NoteTagChip';
import Dialog from '@/shared/ui/dialog/dialog';
import type { CatalogItemEditorHydration } from '@/shared/server/catalogItems';

const inputClass = 'h-10 w-full rounded-md border border-slate-300 bg-white px-2.5 text-sm text-slate-900 outline-none transition focus:border-[#3e67d6] focus:ring-0';
const numberInputClass = '[-moz-appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none';
const orderLikeEditableInputClassName = 'mt-0.5 h-7 w-full rounded-md border border-slate-300 bg-white px-2 text-[13px] leading-5 text-slate-900 outline-none transition focus:border-[#3e67d6] focus:outline-none focus:ring-0';
const compactTableNumberInputClassName = `h-7 w-full rounded-md border border-slate-300 bg-white px-2 text-[13px] leading-5 text-slate-900 outline-none transition focus:border-[#3e67d6] focus:outline-none focus:ring-0 ${numberInputClass}`;
const compactTableAlignedInputClassName = `${compactTableNumberInputClassName} !rounded-md !border-slate-300 !bg-white !px-1.5 shadow-none`;
const compactTableAlignedTextInputClassName = `${orderLikeEditableInputClassName} !rounded-md !border-slate-300 !bg-white !px-2 shadow-none`;
const compactTableValueUnitShellClassName = 'inline-flex h-7 items-center gap-1 whitespace-nowrap';
const compactTableAdornmentClassName = 'text-[13px] font-normal leading-5 text-slate-700';
const compactReadonlyRightBoxClassName = 'inline-flex h-7 items-center justify-end rounded-md border border-transparent bg-transparent px-1.5 text-[13px] leading-5 text-slate-900';
const compactReadonlyCenterBoxClassName = 'inline-flex h-7 items-center justify-center rounded-md border border-transparent bg-transparent px-1.5 text-[13px] leading-5 text-slate-900';
const compactTableNumericSlotClassName = `${compactReadonlyRightBoxClassName} w-[6.5ch]`;
const compactTableFourDigitSlotClassName = `${compactReadonlyRightBoxClassName} w-[4.5ch]`;
const compactTableThreeDigitSlotClassName = `${compactReadonlyRightBoxClassName} w-[4ch]`;
const compactTableSkuFieldWidthClassName = 'w-full min-w-0';
const compactTableStatusFieldWidthClassName = 'min-w-[84px]';
const compactTableVariantChipClassName = `!h-7 !px-2 !pr-5 !text-xs ${compactTableStatusFieldWidthClassName}`;
const articleVariantsHeaderCellClassName = 'px-2 py-3 !text-[13px] !font-normal text-slate-700';
const articleVariantsCheckboxShellClassName = 'inline-flex h-3.5 w-3.5 items-center justify-center';
const articleVariantsCheckboxCellClassName = 'pl-2 pr-1 py-2 text-center';
const compactTableStockSlotClassName = `${compactReadonlyRightBoxClassName} w-[5ch] !px-0`;
const compactTableMinOrderSlotClassName = `${compactReadonlyCenterBoxClassName} w-[4.5ch] !px-0`;
const compactReadonlyTextShellClassName = `${compactReadonlyCenterBoxClassName} w-full min-w-0 !justify-center whitespace-nowrap`;
const ARTICLE_VARIANTS_COLUMN_WIDTHS = {
  checkbox: '2%',
  length: '6%',
  width: '6%',
  thickness: '5.5%',
  weight: '5%',
  tolerance: '6%',
  price: '5%',
  discount: '4.5%',
  sale: '8%',
  stock: '4.5%',
  minOrder: '4.5%',
  sku: '22%',
  status: '8%',
  note: '9%',
  sort: '4%'
} as const;
const articleHeaderChipClassName = '!h-11 !min-w-[164px] !rounded-2xl !px-5 !text-[15px] !font-semibold';
const articleHeaderActionButtonClassName = '!h-11 !rounded-2xl !px-7 !text-[15px] !font-semibold [&_svg+*]:pl-2.5';
const compactSideInputWrapClassName = 'mt-0.5 flex h-[30px] items-center gap-2 rounded-md border border-slate-300 bg-white pl-[10px] pr-3 transition-colors focus-within:border-[#3e67d6]';
const compactSideInputClassName = 'h-full w-full border-0 bg-transparent p-0 text-sm text-slate-900 outline-none focus:ring-0';
const articleNameInputClassName = 'admin-item-name-input h-full w-full min-w-0 border-0 bg-transparent p-0 shadow-none outline-none transition focus:outline-none focus:ring-0 focus:shadow-none focus-visible:outline-none focus-visible:ring-0 focus-visible:shadow-none disabled:cursor-not-allowed';
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
type CreateType = 'simple' | 'variants';
type MediaTab = 'slike' | 'video' | 'tehnicni';
type VariantTag = NoteTag;
type GeneratorDimension = 'length' | 'width' | 'thickness';
type GeneratorChip = { dimension: GeneratorDimension; values: number[] };
type VariantDimensionSet = { length: number; width: number; thickness: number };
type VideoState = { source: 'upload' | 'youtube'; label: string; previewUrl: string; blobPathname?: string | null };
type ImageSettings = { altText: string };
type SideFieldIcon = 'name' | 'brand' | 'material' | 'shape' | 'color' | 'link' | 'document' | 'dimension' | 'sku';
type TechnicalDocument = { name: string; size: string; blobUrl: string | null; blobPathname: string | null };
type SideSettings = {
  sku: string;
  brand: string;
  material: string;
  surface: string;
  color: string;
  thicknessTolerance: string | number;
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
type PendingImageUpload = { file: File; mimeType: string | null; fileName: string };
type PendingVideoUpload = { file: File; mimeType: string | null; fileName: string } | null;
type PendingDocumentUpload = { file: File; name: string; size: string };
type EditorSnapshot = {
  draft: ProductFamily;
  sideSettings: SideSettings;
  itemLevelNote: VariantTag | '';
  selectedCategoryPath: string[];
  mediaImagesDraft: string[];
  videoDraft: VideoState | null;
  documents: TechnicalDocument[];
  generatorChips: GeneratorChip[];
  variantTags: Record<string, VariantTag>;
  imageSettings: Record<number, ImageSettings>;
  videoAssignedVariantId: string | null;
};
const MEDIA_SLOT_COUNT = 7;
const GALLERY_SMALL_SLOT_COUNT = 6;
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

function CalmDashedOutline({ className = '' }: { className?: string }) {
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
  const strokeWidth = 1.125;
  const pathLength = 1000;
  const targetDashLength = 6;
  const targetGapLength = 10;
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
          strokeLinecap="butt"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
          shapeRendering="geometricPrecision"
        />
      ) : null}
    </svg>
  );
}

function CloudUploadIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 48" aria-hidden className={className}>
      <path fill="currentColor" d="M17 40h30a11 11 0 0 0 1.5-21.9A17 17 0 0 0 16.2 13 12 12 0 0 0 17 40Z" />
      <path fill="#fff" d="M30 31v-9h-6l8-9 8 9h-6v9z" />
      <rect x="27.5" y="30.5" width="9" height="3" rx="1.5" fill="#fff" />
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

function ArchiveActionIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />
      <path d="M12 10v6" />
      <path d="m15 13-3 3-3-3" />
    </svg>
  );
}

function PackageTitleIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z" />
      <path d="M12 22V12" />
      <path d="M3.29 7 12 12l8.71-5" />
      <path d="m7.5 4.27 9 5.15" />
    </svg>
  );
}

function StatusCheckIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="10" cy="10" r="7.2" />
      <path d="m7 10 2.1 2.1L13 8.6" />
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
    <div className={`relative flex h-[150px] min-h-[130px] resize-y flex-col overflow-hidden rounded-lg border border-slate-300 ${editable ? 'bg-white' : 'bg-[color:var(--ui-neutral-bg)]'}`}>
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
          className={`min-h-0 flex-1 overflow-x-hidden overflow-y-hidden [&_.ProseMirror]:min-h-[112px] [&_.ProseMirror]:px-4 [&_.ProseMirror]:py-3 [&_.ProseMirror]:text-sm [&_.ProseMirror]:outline-none [&_.ProseMirror]:prose [&_.ProseMirror]:max-w-none [&_.ProseMirror_h1]:text-xl [&_.ProseMirror_h2]:text-lg [&_.ProseMirror_h3]:text-base [&_.ProseMirror_ul]:list-disc [&_.ProseMirror_ul]:pl-5 [&_.ProseMirror_ol]:list-decimal [&_.ProseMirror_ol]:pl-5 [&_.ProseMirror_blockquote]:border-l-4 [&_.ProseMirror_blockquote]:border-slate-300 [&_.ProseMirror_blockquote]:pl-3 [&_.ProseMirror_a]:text-blue-600 [&_.ProseMirror_a]:underline ${editable ? '[&_.ProseMirror]:text-slate-800 [&_.ProseMirror]:prose-slate' : 'cursor-not-allowed [&_.ProseMirror]:bg-[color:var(--ui-neutral-bg)] [&_.ProseMirror]:text-slate-500 [&_.ProseMirror]:prose-slate'}`}
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
          <div className="mt-3 flex items-center justify-end gap-2">
            <Button type="button" variant="default" size="toolbar" onClick={() => setMediaDialogMode(null)}>Prekliči</Button>
            <Button type="button" variant="primary" size="toolbar" onClick={submitMediaUrl}>Potrdi</Button>
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

function NeutralDropdownChip({
  value,
  editable,
  options,
  onChange,
  chipClassName,
  placeholderLabel
}: {
  value: string;
  editable: boolean;
  options: Array<{ value: string; label: string }>;
  onChange: (next: string) => void;
  chipClassName?: string;
  placeholderLabel?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const selectedOption = options.find((option) => option.value === value) ?? null;
  const displayedLabel = selectedOption?.label ?? placeholderLabel ?? '';

  useEffect(() => {
    if (!isOpen) return;
    const onDocClick = (event: MouseEvent) => {
      if (rootRef.current?.contains(event.target as Node)) return;
      setIsOpen(false);
    };
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onEscape);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onEscape);
    };
  }, [isOpen]);

  return (
    <div ref={rootRef} className="relative">
      <button
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
          <Chip variant="neutral" className={`min-w-[124px] ${chipClassName ?? ''}`}>{displayedLabel}</Chip>
        </span>
      </button>

      {editable && isOpen ? (
        <div role="menu" className="absolute left-0 top-8 z-30 min-w-[150px]">
          <MenuPanel>
            {options.map((option) => (
              <MenuItem
                key={option.value}
                onClick={() => {
                  onChange(option.value);
                  setIsOpen(false);
                }}
              >
                {option.label}
              </MenuItem>
            ))}
          </MenuPanel>
        </div>
      ) : null}
    </div>
  );
}

function VisibilityChip({
  visible,
  editable,
  onChange
}: {
  visible: boolean;
  editable: boolean;
  onChange: (next: boolean) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!isOpen) return;
    const onDocClick = (event: MouseEvent) => {
      if (rootRef.current?.contains(event.target as Node)) return;
      setIsOpen(false);
    };
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onEscape);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onEscape);
    };
  }, [isOpen]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => {
          if (!editable) return;
          setIsOpen((current) => !current);
        }}
        className="relative block rounded-full focus:outline-none"
      >
        {editable ? <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-500">▾</span> : null}
        <Chip variant={visible ? 'success' : 'warning'}>{visible ? 'Prikaži' : 'Skrij'}</Chip>
      </button>
      {editable && isOpen ? (
        <div role="menu" className="absolute left-0 top-8 z-30 min-w-[120px]">
          <MenuPanel>
            <MenuItem onClick={() => { onChange(true); setIsOpen(false); }}>Prikaži</MenuItem>
            <MenuItem onClick={() => { onChange(false); setIsOpen(false); }}>Skrij</MenuItem>
          </MenuPanel>
        </div>
      ) : null}
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

  const [draft, setDraft] = useState<ProductFamily>(() => {
    if (initialData) {
      return createFamily({
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
      });
    }
    return createFamily({
      variants: createType === 'variants' ? [createVariant()] : [createVariant({ label: 'Osnovni artikel' })],
      active: true
    });
  });
  const [variantSelections, setVariantSelections] = useState<Set<string>>(new Set());
  const [generatorInput, setGeneratorInput] = useState('');
  const [generatorChips, setGeneratorChips] = useState<GeneratorChip[]>([]);
  const [generatorError, setGeneratorError] = useState<string | null>(null);
  const [sideSettings, setSideSettings] = useState<SideSettings>({
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
    galleryMode: 'grid' as 'grid' | 'slider' | 'list',
    imageAltText: '',
    videoUrl: ''
  });
  const [documents, setDocuments] = useState<TechnicalDocument[]>(
    () =>
      initialData?.media
        .filter((media) => media.mediaKind === 'document' && media.role === 'technical_sheet')
        .map((media) => ({
          name: media.filename || 'Tehnični list',
          size: '—',
          blobUrl: media.blobUrl ?? media.externalUrl ?? null,
          blobPathname: media.blobPathname ?? null
        })) ?? []
  );
  const [editorMode, setEditorMode] = useState<'read' | 'edit'>(mode === 'create' ? 'edit' : 'read');
  const [itemLevelNote, setItemLevelNote] = useState<VariantTag | ''>(() => {
    const raw = normalizeVariantTag(initialData?.badge ?? initialData?.adminNotes);
    return ITEM_NOTE_OPTIONS.some((entry) => entry.value === raw) ? raw : '';
  });
  const [mediaTab, setMediaTab] = useState<MediaTab>('slike');
  const [mediaImagesDraft, setMediaImagesDraft] = useState<string[]>(draft.images);
  const [pendingImageUploads, setPendingImageUploads] = useState<Record<number, PendingImageUpload>>({});
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
  const updateImageAtSlotRef = useRef<(slotIndex: number, imageUrl: string) => void>(() => {});
  const [youtubeInput, setYoutubeInput] = useState('');
  const [videoDraft, setVideoDraft] = useState<VideoState | null>(() => {
    const video = initialData?.media.find((media) => media.mediaKind === 'video');
    if (!video) return null;
    return {
      source: video.sourceKind === 'youtube' ? 'youtube' : 'upload',
      label: video.filename || 'Video',
      previewUrl: video.externalUrl || video.blobUrl || ''
    };
  });
  const [pendingVideoUpload, setPendingVideoUpload] = useState<PendingVideoUpload>(null);
  const [videoDragActive, setVideoDragActive] = useState(false);
  const [videoMoveMode, setVideoMoveMode] = useState(false);
  const [videoAssignedVariantId, setVideoAssignedVariantId] = useState<string | null>(() => {
    const video = initialData?.media.find((media) => media.mediaKind === 'video');
    if (!video || typeof video.variantIndex !== 'number') return null;
    const variant = draft.variants[video.variantIndex];
    return variant ? variant.id : null;
  });
  const technicalUploadInputRef = useRef<HTMLInputElement>(null);
  const [pendingDocumentUploads, setPendingDocumentUploads] = useState<Record<string, PendingDocumentUpload>>({});
  const [pendingMediaRemoval, setPendingMediaRemoval] = useState<{ type: 'image'; slotIndex: number } | { type: 'video' } | null>(null);
  const [variantTags, setVariantTags] = useState<Record<string, VariantTag>>(() => {
    const allowed = new Set<VariantTag>(['na-zalogi', 'novo', 'akcija', 'zadnji-kosi', 'ni-na-zalogi']);
    const next: Record<string, VariantTag> = {};
    initialData?.variants.forEach((variant) => {
      const key = String(variant.id ?? '');
      const rawBadge = normalizeVariantTag(variant.badge) as VariantTag;
      if (key && allowed.has(rawBadge)) next[key] = rawBadge;
    });
    return next;
  });
  const [editingImageSlot, setEditingImageSlot] = useState<number | null>(null);
  const [decimalInputDrafts, setDecimalInputDrafts] = useState<Record<string, string>>({});
  const [imageSettings, setImageSettings] = useState<Record<number, ImageSettings>>(() => {
    const settings: Record<number, ImageSettings> = {};
    const imageMedia = initialData?.media
      .filter((media) => media.mediaKind === 'image' && media.role === 'gallery')
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0)) ?? [];
    imageMedia.forEach((media, index) => {
      settings[index] = { altText: media.altText ?? '' };
    });
    return settings;
  });
  const [selectedCategoryPath, setSelectedCategoryPath] = useState<string[]>(() => initialData?.categoryPath ?? []);
  const snapshotRef = useRef<EditorSnapshot | null>(null);
  const isSavingRef = useRef(false);

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

  const isEditable = editorMode === 'edit';
  const isTableEditable = isEditable;
  const isMediaEditable = isEditable;
  const isToleranceLocked = false;
  const isDimensionLockActive = false;
  const isThicknessLockActive = false;
  const isGeneratorLocked = !isTableEditable;
  const hasSelectedVariants = variantSelections.size > 0;
  const allVariantsSelected = draft.variants.length > 0 && draft.variants.every((variant) => variantSelections.has(variant.id));
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

  const buildSnapshot = useCallback((): EditorSnapshot => ({
    draft,
    sideSettings,
    itemLevelNote,
    selectedCategoryPath,
    mediaImagesDraft,
    videoDraft,
    documents,
    generatorChips,
    variantTags,
    imageSettings,
    videoAssignedVariantId
  }), [
    draft,
    sideSettings,
    itemLevelNote,
    selectedCategoryPath,
    mediaImagesDraft,
    videoDraft,
    documents,
    generatorChips,
    variantTags,
    imageSettings,
    videoAssignedVariantId
  ]);

  useEffect(() => {
    if (snapshotRef.current) return;
    snapshotRef.current = buildSnapshot();
  }, [buildSnapshot]);

  const hasPendingUploads = Object.keys(pendingImageUploads).length > 0 || pendingVideoUpload !== null || Object.keys(pendingDocumentUploads).length > 0;
  const isDirty = useMemo(() => {
    if (!snapshotRef.current) return false;
    return JSON.stringify(snapshotRef.current) !== JSON.stringify(buildSnapshot()) || hasPendingUploads;
  }, [buildSnapshot, hasPendingUploads]);

  const save = async (asDraft = false) => {
    if (!isEditable || !isDirty) return;
    isSavingRef.current = true;
    if (!draft.name.trim()) {
      toast.error('Naziv je obvezen.');
      isSavingRef.current = false;
      return;
    }
    if (!draft.category.trim()) {
      toast.error('Kategorija je obvezna.');
      isSavingRef.current = false;
      return;
    }

    const stagedImageUrls = [...mediaImagesDraft];
    const stagedDocuments = [...documents];
    let stagedVideo = videoDraft;

    try {
      for (const [slotKey, pendingImage] of Object.entries(pendingImageUploads)) {
        const slotIndex = Number(slotKey);
        const uploaded = await uploadMediaFile(pendingImage.file);
        imageTypeHintsRef.current[uploaded.url] = inferImageExtensionLabel({ mimeType: pendingImage.mimeType ?? undefined, fileName: pendingImage.fileName });
        stagedImageUrls[slotIndex] = uploaded.url;
      }

      if (pendingVideoUpload) {
        const uploadedVideo = await uploadMediaFile(pendingVideoUpload.file);
        stagedVideo = {
          source: 'upload',
          label: uploadedVideo.filename,
          previewUrl: uploadedVideo.url,
          blobPathname: uploadedVideo.pathname
        };
      }

      for (const [docKey, pendingDocument] of Object.entries(pendingDocumentUploads)) {
        const uploadedDocument = await uploadMediaFile(pendingDocument.file);
        const index = Number(docKey);
        if (!Number.isFinite(index) || !stagedDocuments[index]) continue;
        stagedDocuments[index] = {
          ...stagedDocuments[index],
          name: uploadedDocument.filename,
          blobUrl: uploadedDocument.url,
          blobPathname: uploadedDocument.pathname
        };
      }
    } catch (error) {
      isSavingRef.current = false;
      toast.error(error instanceof Error ? error.message : 'Nalaganje datotek ni uspelo.');
      return;
    }

    const normalizedMediaImages = stagedImageUrls
      .map((url, index) => ({ url, index }))
      .filter((entry) => Boolean(entry.url) && !entry.url.startsWith('blob:'));

    const payload = {
      itemName: draft.name.trim(),
      itemType: (initialData?.itemType ?? 'unit') as 'unit' | 'sheet' | 'linear' | 'bulk',
      badge: itemLevelNote || null,
      status: draft.active ? 'active' : 'inactive',
      categoryPath: selectedCategoryPath,
      sku: sideSettings.sku || draft.variants[0]?.sku || null,
      slug: draft.slug.trim() || toSlug(draft.name.trim()),
      unit: null,
      brand: sideSettings.brand || null,
      material: sideSettings.material || null,
      colour: sideSettings.color || null,
      shape: sideSettings.surface || null,
      description: draft.description || '',
      adminNotes: initialData?.adminNotes ?? null,
      position: draft.sort ?? 0,
      variants: draft.variants.map((variant, index) => ({
        variantName: variant.label || `Različica ${index + 1}`,
        length: variant.length,
        width: variant.width,
        thickness: variant.thickness,
        weight: variant.weight ?? (sideSettings.weightPerUnit ? Number(sideSettings.weightPerUnit) : null),
        errorTolerance: (variant.errorTolerance ?? sideSettings.thicknessTolerance) || null,
        price: variant.price,
        discountPct: variant.discountPct,
        inventory: variant.stock,
        minOrder: Math.max(1, variant.minOrder ?? Number(sideSettings.moq || 1)),
        variantSku: variant.sku || null,
        unit: null,
        status: variant.active ? 'active' : 'inactive',
        badge: variantTags[variant.id] ?? (normalizeVariantTag(variant.badge) || null),
        position: variant.sort ?? index,
        imageAssignments: variant.imageAssignments ?? []
      })),
      media: [
        ...normalizedMediaImages.map((entry) => ({
          mediaKind: 'image' as const,
          role: 'gallery' as const,
          sourceKind: 'upload' as const,
          blobUrl: entry.url,
          altText: imageSettings[entry.index]?.altText ?? null,
          position: entry.index
        })),
        ...(stagedVideo
          ? [
              {
                mediaKind: 'video' as const,
                role: 'gallery' as const,
                sourceKind: stagedVideo.source === 'youtube' ? ('youtube' as const) : ('upload' as const),
                externalUrl: stagedVideo.source === 'youtube' ? stagedVideo.previewUrl : null,
                blobUrl: stagedVideo.source === 'upload' && !stagedVideo.previewUrl.startsWith('blob:') ? stagedVideo.previewUrl : null,
                blobPathname: stagedVideo.source === 'upload' ? stagedVideo.blobPathname ?? null : null,
                filename: stagedVideo.label,
                videoType: stagedVideo.source,
                variantIndex: videoAssignedVariantId
                  ? Math.max(0, draft.variants.findIndex((variant) => variant.id === videoAssignedVariantId))
                  : null,
                position: 0
              }
            ]
          : []),
        ...stagedDocuments.map((documentEntry, index) => ({
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

    try {
      const response = await fetch('/api/admin/artikli', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const body = (await response.json().catch(() => ({}))) as { slug?: string; message?: string };
      if (!response.ok) {
        throw new Error(body.message || 'Shranjevanje artikla ni uspelo.');
      }
      setMediaImagesDraft(stagedImageUrls);
      setDocuments(stagedDocuments);
      setVideoDraft(stagedVideo);
      setPendingImageUploads({});
      setPendingVideoUpload(null);
      setPendingDocumentUploads({});
      snapshotRef.current = {
        ...buildSnapshot(),
        mediaImagesDraft: stagedImageUrls,
        documents: stagedDocuments,
        videoDraft: stagedVideo
      };
      setEditorMode('read');
      toast.success(asDraft ? 'Osnutek shranjen.' : 'Artikel shranjen.');
      if (body.slug) {
        router.push(`/admin/artikli/${encodeURIComponent(body.slug)}`);
      }
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Shranjevanje artikla ni uspelo.');
    } finally {
      isSavingRef.current = false;
    }
  };
  const deleteItem = async () => {
    const shouldArchive = window.confirm('Ali želite arhivirati artikel?');
    if (!shouldArchive) return;
    const slug = draft.slug || articleId || '';
    if (!slug) {
      toast.error('Artikel nima veljavnega identifikatorja za arhiviranje.');
      return;
    }
    try {
      const response = await fetch(`/api/admin/artikli/${encodeURIComponent(slug)}`, { method: 'DELETE' });
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { message?: string };
        throw new Error(body.message || 'Arhiviranje artikla ni uspelo.');
      }
      toast.success('Artikel je arhiviran.');
      router.push('/admin/arhiv/artikli');
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Arhiviranje artikla ni uspelo.');
    }
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

  const uploadMediaFile = useCallback(async (file: File): Promise<{ url: string; pathname: string; mimeType: string | null; filename: string }> => {
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
    };
    if (!response.ok || !body.url || !body.pathname) {
      throw new Error(body.message || 'Nalaganje datoteke ni uspelo.');
    }
    return {
      url: body.url,
      pathname: body.pathname,
      mimeType: body.mimeType ?? null,
      filename: body.filename ?? file.name
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
    setVideoDraft({ source: 'youtube', label: value, previewUrl });
    setYoutubeInput('');
    setVideoMoveMode(false);
    return true;
  };

  const handleVideoFileSelect = async (file?: File | null) => {
    if (!file) return;
    if (!file.type.startsWith('video/')) {
      toast.error('Izberite veljavno video datoteko.');
      return;
    }
    const maxBytes = 100 * 1024 * 1024;
    if (file.size > maxBytes) {
      toast.error('Video je prevelik. Dovoljena velikost je največ 100 MB.');
      return;
    }
    const previewUrl = createLocalImageUrl(file);
    setPendingVideoUpload({ file, mimeType: file.type || null, fileName: file.name });
    setVideoDraft({ source: 'upload', label: file.name, previewUrl, blobPathname: null });
    setVideoMoveMode(false);
  };

  const handleTechnicalFileSelect = async (file?: File | null) => {
    if (!file) return;
    const maxBytes = 5 * 1024 * 1024;
    if (file.size > maxBytes) {
      toast.error('Datoteka je prevelika. Dovoljena velikost je največ 5 MB.');
      return;
    }
    const previewUrl = createLocalImageUrl(file);
    const fileSizeLabel = file.size < 1024 * 1024
      ? `${Math.round(file.size / 1024)} KB`
      : `${(file.size / (1024 * 1024)).toFixed(1)} MB`;
    setDocuments((current) => [{ name: file.name, size: fileSizeLabel, blobUrl: previewUrl, blobPathname: null }, ...current]);
    setPendingDocumentUploads((current) => {
      const shifted: Record<string, PendingDocumentUpload> = {};
      Object.entries(current).forEach(([key, value]) => {
        shifted[String(Number(key) + 1)] = value;
      });
      shifted['0'] = { file, name: file.name, size: fileSizeLabel };
      return shifted;
    });
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
  };

  const setVariantTag = (variantId: string, tag: VariantTag) => {
    setVariantTags((current) => ({ ...current, [variantId]: tag }));
  };

  const getVariantTag = (variantId: string): VariantTag => variantTags[variantId] ?? 'na-zalogi';

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

  const updateImageAtSlot = useCallback((slotIndex: number, imageUrl: string) => {
    setMediaImagesDraft((current) => {
      const next = [...current];
      if (slotIndex < next.length) {
        const previous = next[slotIndex];
        if (previous && previous !== imageUrl) revokeLocalImageUrl(previous);
        next[slotIndex] = imageUrl;
        return next.slice(0, MEDIA_SLOT_COUNT);
      }
      while (next.length < slotIndex) next.push('');
      next.push(imageUrl);
      return next.filter(Boolean).slice(0, MEDIA_SLOT_COUNT);
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
        maxFileSize: 4 * 1024 * 1024,
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
        const stagedFile = new File([blob], file.name, { type: file.type });
        const localUrl = createLocalImageUrl(stagedFile);
        imageTypeHintsRef.current[localUrl] = inferImageExtensionLabel({ mimeType: file.type, fileName: file.name });
        const normalizedSlot = Math.max(0, Math.min(MEDIA_SLOT_COUNT - 1, targetSlot));
        updateImageAtSlotRef.current(normalizedSlot, localUrl);
        setPendingImageUploads((current) => ({
          ...current,
          [normalizedSlot]: { file: stagedFile, mimeType: file.type || null, fileName: file.name }
        }));
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
  }, [createLocalImageUrl, toast]);

  const queueImageUpload = useCallback((files: FileList | File[] | null, startSlot: number, allowMultiple: boolean) => {
    if (!isMediaEditable) return;
    const uppy = uppyRef.current;
    if (!uppy) return;
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

    uppy.cancelAll();
    uppy.getFiles().forEach((file) => uppy.removeFile(file.id));
    uploadPlanRef.current = { startSlot, nextOffset: 0, maxFiles };
    uppy.setOptions({
      restrictions: {
        ...(uppy.opts.restrictions ?? {}),
        maxNumberOfFiles: maxFiles
      }
    });

    acceptedFiles.forEach((file) => {
      try {
        uppy.addFile({
          name: file.name,
          type: file.type,
          data: file
        });
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Datoteke ni bilo mogoče dodati v vrsto.');
      }
    });

  }, [isMediaEditable, toast]);

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
    const uppy = uppyRef.current;
    if (!uppy) return;
    const remainingSlots = Math.max(0, MEDIA_SLOT_COUNT - slotIndex);
    const maxFiles = Math.max(1, allowMultiple ? remainingSlots : 1);
    if (files.length > maxFiles) {
      toast.error(`Izberete lahko največ ${maxFiles} slik.`);
    }
    uppy.cancelAll();
    uppy.getFiles().forEach((file) => uppy.removeFile(file.id));
    uploadPlanRef.current = { startSlot: slotIndex, nextOffset: 0, maxFiles };
    uppy.setOptions({
      restrictions: {
        ...(uppy.opts.restrictions ?? {}),
        maxNumberOfFiles: maxFiles
      }
    });
  }, [isMediaEditable, toast]);

  const moveImageSlot = (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return;
    setMediaImagesDraft((current) => {
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
    setMediaImagesDraft((current) => {
      const imageToRemove = current[slotIndex];
      if (imageToRemove) revokeLocalImageUrl(imageToRemove);
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
    setPendingImageUploads((current) => {
      const next: Record<number, PendingImageUpload> = {};
      Object.entries(current).forEach(([key, value]) => {
        const index = Number(key);
        if (index === slotIndex) return;
        next[index > slotIndex ? index - 1 : index] = value;
      });
      return next;
    });
  };

  const removeSelectedImageSlots = (selected: Set<number>) => {
    const sorted = Array.from(selected).sort((a, b) => b - a);
    sorted.forEach((slotIndex) => removeImageSlot(slotIndex));
  };

  const requestRemoveImageSlot = (slotIndex: number) => {
    setPendingMediaRemoval({ type: 'image', slotIndex });
  };

  const requestRemoveVideo = () => {
    if (!videoDraft) return;
    setPendingMediaRemoval({ type: 'video' });
  };

  const closePendingMediaRemoval = () => setPendingMediaRemoval(null);

  const confirmPendingMediaRemoval = () => {
    if (!pendingMediaRemoval) return;
    if (pendingMediaRemoval.type === 'image') {
      removeImageSlot(pendingMediaRemoval.slotIndex);
      setPendingMediaRemoval(null);
      return;
    }
    if (videoDraft?.previewUrl) revokeLocalImageUrl(videoDraft.previewUrl);
    setVideoDraft(null);
    setPendingVideoUpload(null);
    setYoutubeInput('');
    setVideoMoveMode(false);
    setVideoAssignedVariantId(null);
    setPendingMediaRemoval(null);
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

  const ensureImageSettings = useCallback((slotIndex: number): ImageSettings => {
    return imageSettings[slotIndex] ?? { altText: '' };
  }, [imageSettings]);

  const updateImageSettings = useCallback((slotIndex: number, updates: Partial<ImageSettings>) => {
    setImageSettings((current) => {
      const previous = current[slotIndex] ?? { altText: '' };
      const merged = { ...previous, ...updates };
      return {
        ...current,
        [slotIndex]: merged
      };
    });
  }, []);

  const handleSaveEditedImage = useCallback(async (slotIndex: number, blob: Blob, mimeType: string) => {
    const file = new File([blob], `edited-${Date.now()}.webp`, { type: mimeType || 'image/webp' });
    const localUrl = createLocalImageUrl(file);
    imageTypeHintsRef.current[localUrl] = inferImageExtensionLabel({ mimeType });
    updateImageAtSlot(slotIndex, localUrl);
    setPendingImageUploads((current) => ({
      ...current,
      [slotIndex]: { file, mimeType: file.type || null, fileName: file.name }
    }));
    setEditingImageSlot(null);
    toast.success('Slika je lokalno posodobljena. Shranite za potrditev.');
  }, [createLocalImageUrl, toast, updateImageAtSlot]);

  const renderImageActionButtons = (slotIndex: number) => {
    const compact = slotIndex !== 0;
    const verticalAlignClass = compact ? 'justify-center' : 'justify-start pt-2';
    const actions = [
      {
        key: 'remove',
        label: 'Odstrani',
        tone: 'danger' as const,
        onClick: () => requestRemoveImageSlot(slotIndex),
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
              if (!isMediaEditable) return;
              action.onClick();
            }}
            aria-label={action.label}
            title={action.label}
            disabled={!isMediaEditable}
          >
            <span className="inline-flex h-full w-full items-center justify-center">{action.icon}</span>
          </button>
        ))}
      </div>
    );
  };

  const discardChanges = useCallback(() => {
    const snapshot = snapshotRef.current;
    if (!snapshot) return;
    setDraft(snapshot.draft);
    setSideSettings(snapshot.sideSettings);
    setItemLevelNote(snapshot.itemLevelNote);
    setSelectedCategoryPath(snapshot.selectedCategoryPath);
    setMediaImagesDraft(snapshot.mediaImagesDraft);
    setVideoDraft(snapshot.videoDraft);
    setDocuments(snapshot.documents);
    setGeneratorChips(snapshot.generatorChips);
    setVariantTags(snapshot.variantTags);
    setImageSettings(snapshot.imageSettings);
    setVideoAssignedVariantId(snapshot.videoAssignedVariantId);
    setPendingImageUploads({});
    setPendingVideoUpload(null);
    setPendingDocumentUploads({});
  }, []);

  const handleToggleEditMode = () => {
    if (isEditable && isDirty && !isSavingRef.current) {
      const shouldDiscard = window.confirm('Imate neshranjene spremembe. Želite zavreči spremembe?');
      if (!shouldDiscard) return;
      discardChanges();
    }
    setEditorMode((current) => (current === 'read' ? 'edit' : 'read'));
  };
  return (
    <div className="mx-auto max-w-7xl space-y-4 font-['Inter',system-ui,sans-serif]">
      <div className="text-xs text-slate-500"><Link href="/admin/artikli" className="hover:underline">Artikli</Link> › {mode === 'create' ? 'Nov artikel' : draft.name || 'Uredi artikel'}</div>
      <div className="flex w-full items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div className={`flex h-11 min-w-[280px] max-w-[420px] flex-1 items-center gap-2 rounded-xl border border-slate-300 px-3 transition-colors focus-within:border-[#3e67d6] ${isEditable ? 'bg-white' : 'bg-[color:var(--ui-neutral-bg)]'}`}>
            <PackageTitleIcon className="h-[18px] w-[18px] text-slate-500" />
            <input
              aria-label="Naziv artikla"
              value={draft.name}
              disabled={!isEditable}
              onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
              placeholder="Naziv artikla"
              className={articleNameInputClassName}
            />
          </div>
          <ActiveStateChip active={draft.active} editable={isEditable} chipClassName={articleHeaderChipClassName} leadingIcon={<StatusCheckIcon className="h-[24px] w-[24px]" />} onChange={(next) => setDraft((current) => ({ ...current, active: next }))} />
          {itemLevelNote
            ? <NoteTagChip value={itemLevelNote} editable={isEditable} chipClassName={articleHeaderChipClassName} leadingIcon={<PackageTitleIcon className="h-[24px] w-[24px]" />} onChange={setItemLevelNote} />
            : (
              <NeutralDropdownChip
                value=""
                editable={isEditable}
                chipClassName={articleHeaderChipClassName}
                placeholderLabel="Opombe"
                onChange={(value) => setItemLevelNote((value as VariantTag) || 'na-zalogi')}
                options={ITEM_NOTE_OPTIONS as unknown as Array<{ value: string; label: string }>}
              />
            )}
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" variant="ghost" size="toolbar" className={articleHeaderActionButtonClassName} onClick={handleToggleEditMode}>
            <PencilIcon />
            <span>Uredi</span>
          </Button>
          <Button type="button" variant="primary" size="toolbar" className={articleHeaderActionButtonClassName} onClick={() => void save(false)} disabled={!isEditable || !isDirty}>
            <SaveIcon />
            <span>Shrani</span>
          </Button>
          <Button type="button" variant="ghost" size="toolbar" className={`${articleHeaderActionButtonClassName} !border !border-[#c97d00] !text-[#c97d00] hover:!bg-[#fff4cc] hover:!text-[#9a5e00]`} onClick={deleteItem}>
            <ArchiveActionIcon className="h-[18px] w-[18px] shrink-0" />
            <span>Arhiviraj</span>
          </Button>
        </div>
      </div>

      <div className="grid items-stretch gap-6 lg:grid-cols-[minmax(0,11fr)_minmax(0,9fr)]">
        <div className="space-y-4">
          <section className="h-full rounded-xl border border-slate-200 bg-white p-4">
            <h2 className="mb-3 text-lg font-semibold tracking-tight">Osnovni podatki</h2>
            <div className="mb-5 grid grid-cols-[minmax(0,1fr)] items-center border-b border-slate-200 pb-2">
              <div className="col-span-1 flex min-h-8 items-center px-1">
                <AdminCategoryBreadcrumbPicker
                  className="flex min-h-8 items-center rounded-md bg-transparent px-1 !py-0 text-sm"
                  value={selectedCategoryPath}
                  onChange={selectCategoryPath}
                  categoryPaths={categoryPaths}
                  disabled={!isEditable}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 grid grid-cols-2 gap-3">
                {[
                  { title: 'Osnovni SKU', value: sideSettings.sku, placeholder: 'SKU koda', icon: 'sku' as SideFieldIcon, onChange: (value: string) => setSideSettings((current) => ({ ...current, sku: value })) },
                  { title: 'URL', value: draft.slug, placeholder: toSlug(draft.name || 'naziv-artikla'), icon: 'link' as SideFieldIcon, onChange: (value: string) => setDraft((current) => ({ ...current, slug: value })) },
                  { title: 'Blagovna znamka', value: sideSettings.brand, placeholder: 'AluCraft', icon: 'brand' as SideFieldIcon, onChange: (value: string) => setSideSettings((current) => ({ ...current, brand: value })) },
                  { title: 'Material', value: sideSettings.material, placeholder: 'Aluminij', icon: 'material' as SideFieldIcon, onChange: (value: string) => setSideSettings((current) => ({ ...current, material: value })) },
                  { title: 'Barva', value: sideSettings.color, placeholder: 'Srebrna', icon: 'color' as SideFieldIcon, onChange: (value: string) => setSideSettings((current) => ({ ...current, color: value })) },
                  { title: 'Oblika', value: sideSettings.surface, placeholder: 'Pravokotna', icon: 'shape' as SideFieldIcon, onChange: (value: string) => setSideSettings((current) => ({ ...current, surface: value })) }
                ].map((field) => (
                  <div key={field.title} className="min-h-10">
                    <p className="text-sm font-semibold text-slate-900">{field.title}</p>
                    <div className={`${compactSideInputWrapClassName} ${isEditable ? '' : '!bg-[color:var(--ui-neutral-bg)] text-slate-500'}`}>
                      <SideInputIcon icon={field.icon} muted={field.value.trim().length === 0} />
                      <input disabled={!isEditable} style={{ outline: 'none', boxShadow: 'none' }} className={`${compactSideInputClassName} ${isEditable ? '' : 'cursor-not-allowed text-slate-500'}`} value={field.value} onChange={(event) => field.onChange(event.target.value)} placeholder={field.placeholder} />
                    </div>
                  </div>
                ))}
              </div>
              <div className="col-span-2 space-y-1 pt-0.5">
                <label className="text-sm font-semibold text-slate-900">Opis</label>
                <OpisRichTextEditor value={draft.description} editable={isEditable} onChange={(next) => setDraft((current) => ({ ...current, description: next }))} />
              </div>
            </div>
          </section>

        </div>

        <aside className="h-full rounded-xl border border-slate-200 bg-white p-4">
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
                        className="flex h-full w-full items-center justify-center rounded-lg text-blue-600"
                      >
                        <span className="flex flex-col items-center justify-center gap-2 text-center">
                          <ImageUploadFrameIcon className="h-[84px] w-[84px] text-[#2f7dc5]" />
                          <span className="text-base font-semibold text-slate-800">Naloži sliko</span>
                          <span className="text-xs font-medium text-slate-500">(največ 4 MB)</span>
                        </span>
                      </UppyDropzoneField>
                    ) : (
                      <div className={`relative flex h-full w-full items-center justify-center rounded-lg border-2 border-dashed border-[#9cb8ea] bg-[#f7f9fe] text-blue-600 transition ${isMediaEditable ? 'cursor-pointer hover:border-[#1982bf] hover:bg-[#edf3ff]' : 'cursor-not-allowed opacity-60'}`}>
                        <span className="flex flex-col items-center justify-center gap-2 text-center">
                          <ImageUploadFrameIcon className="h-[84px] w-[84px] text-[#2f7dc5]" />
                          <span className="text-base font-semibold text-slate-800">Naloži sliko</span>
                          <span className="text-xs font-medium text-slate-500">(največ 4 MB)</span>
                        </span>
                      </div>
                    )
                  ) : (
                    <div className="grid h-full grid-cols-5 grid-rows-2 gap-2">
                      <div
                        className={`group relative col-span-2 row-span-2 overflow-hidden rounded-lg border border-slate-300 ${isMediaEditable ? 'cursor-grab' : ''}`}
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
                              className={`group relative overflow-hidden rounded-lg border border-slate-300 ${isMediaEditable ? 'cursor-grab' : ''}`}
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
                                className="flex h-full items-center justify-center rounded-lg text-blue-600"
                              >
                                <span className="inline-flex h-full w-full items-center justify-center">
                                  <svg viewBox="0 0 24 24" className="h-9 w-9 text-[#2f7dc5]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                                    <path d="M12 5v14M5 12h14" />
                                  </svg>
                                </span>
                              </UppyDropzoneField>
                            ) : (
                              <div key={`slot-${slotIndex}`} className={`relative flex h-full items-center justify-center rounded-lg border-2 border-dashed border-[#9cb8ea] bg-[#f7f9fe] text-blue-600 transition ${isMediaEditable ? 'cursor-pointer hover:border-[#1982bf] hover:bg-[#edf3ff]' : 'cursor-not-allowed opacity-60'}`}>
                                <CloudUploadIcon className="h-8 w-8 text-[#2f7dc5]" />
                              </div>
                            )
                          );
                        }

                        return <div key={`slot-${slotIndex}`} className="relative h-full rounded-lg border-2 border-dashed border-[#d7e3f7] bg-[#f7f9fe] opacity-70" />;
                      })}
                    </div>
                  )}
                </div>
                <div className="overflow-hidden rounded-lg border border-slate-200">
                  <table className="min-w-full text-xs">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-2 py-2.5 text-left">SKU</th>
                        <th className="px-2 py-2.5 text-center">Tip</th>
                        <th className="px-2 py-2.5 text-center">Dimenzije</th>
                        <th className="px-2 py-2.5 text-left">Slike</th>
                      </tr>
                    </thead>
                    <tbody>
                      {draft.variants.map((variant, variantIndex) => {
                        const assignedSlots = variant.imageAssignments ?? [];
                        const assignedImageDetails = assignedSlots.flatMap((slot) => {
                          const url = mediaImagesDraft[slot];
                          if (!url) return [];
                          const typeLabel = imageMeta[url]?.type ?? imageTypeHintsRef.current[url] ?? inferImageExtensionLabel({ url });
                          const dimensionLabel = imageMeta[url] ? `${imageMeta[url].width}x${imageMeta[url].height}` : '—';
                          return [{ typeLabel, dimensionLabel }];
                        });
                        const assignedImageTypes = assignedImageDetails.map((entry) => entry.typeLabel);
                        const assignedImageDimensions = assignedImageDetails.map((entry) => entry.dimensionLabel);
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
                            <td className="px-2 py-2.5">{variant.sku || '—'}</td>
                            <td className="px-2 py-2.5 text-center">{assignedImageTypes.length ? assignedImageTypes.join(', ') : '—'}</td>
                            <td className="px-2 py-2.5 text-center">{assignedImageDimensions.length ? assignedImageDimensions.join(', ') : '—'}</td>
                            <td className="px-2 py-2.5">
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
                          { key: 'remove', label: 'Odstrani', tone: 'danger' as const, onClick: requestRemoveVideo, icon: <span aria-hidden className="text-sm leading-none">✕</span> },
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
                      className={`relative flex h-full w-full flex-col items-center justify-between rounded-lg border-2 border-dashed bg-[#f7f9fe] px-5 pb-4 pt-3 text-center transition ${videoDragActive ? 'border-[#1982bf] bg-[#edf3ff]' : 'border-[#9cb8ea]'} ${isMediaEditable ? 'cursor-pointer hover:border-[#1982bf] hover:bg-[#edf3ff]' : 'cursor-not-allowed opacity-60'}`}
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
                      <div className="flex flex-1 flex-col items-center justify-center">
                        <VideoUploadFrameIcon className="h-[72px] w-[72px] text-[#74addb]" />
                        <div className="mt-1 flex flex-col items-center justify-center leading-tight">
                          <span className="text-base font-semibold text-slate-800">Naloži video</span>
                          <span className="mt-1 text-xs font-medium text-slate-500">(največ 100 MB)</span>
                        </div>
                      </div>
                      <div className="mt-3 w-full max-w-[340px] pb-1">
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
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-2 py-2.5 text-left">SKU</th>
                        <th className="px-2 py-2.5 text-center">Tip</th>
                        <th className="px-2 py-2.5 text-left">Video</th>
                      </tr>
                    </thead>
                    <tbody>
                      {draft.variants.map((variant) => {
                        const hasVideoInCell = Boolean(videoDraft) && videoAssignedVariantId === variant.id;
                        const canPlaceHere = Boolean(videoDraft) && isMediaEditable && videoMoveMode;
                        return (
                        <tr key={`variant-video-${variant.id}`} className="border-t border-slate-100">
                          <td className="px-2 py-2.5">{variant.sku || '—'}</td>
                          <td className="px-2 py-2.5 text-center">{hasVideoInCell ? (videoDraft?.source === 'youtube' ? 'YouTube' : 'Upload') : '—'}</td>
                          <td className="px-2 py-2.5 text-left">
                            <button
                              type="button"
                              disabled={!canPlaceHere && !hasVideoInCell}
                              className={`inline-flex h-[18px] items-center gap-1 overflow-hidden rounded-md border px-1 text-[11px] transition ${hasVideoInCell ? 'border-slate-200 bg-white text-slate-600' : canPlaceHere ? 'border-[#9cb8ea] bg-[#f0f6ff] text-[#2f7dc5] hover:bg-[#e6f0ff]' : 'border-transparent bg-transparent text-slate-400'}`}
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
                    className={`relative flex h-full w-full flex-col items-center justify-center rounded-lg border-2 border-dashed bg-[#f7f9fe] px-5 pb-4 pt-3 text-center transition ${isMediaEditable ? 'cursor-pointer border-[#9cb8ea] hover:border-[#1982bf] hover:bg-[#edf3ff]' : 'cursor-not-allowed border-[#9cb8ea] opacity-60'}`}
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
                    <DocumentUploadFrameIcon className="h-[72px] w-[72px] text-[#74addb]" />
                    <div className="mt-1 flex flex-col items-center justify-center leading-tight">
                      <span className="text-base font-semibold text-slate-800">Naloži tehnični list</span>
                      <span className="mt-1 text-xs font-medium text-slate-500">(največ 5 MB)</span>
                    </div>
                  </div>
                </div>
                <div className="overflow-hidden rounded-lg border border-slate-200">
                  <table className="min-w-full text-xs">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-2 py-2.5 text-left">Datoteka</th>
                        <th className="px-2 py-2.5 text-right">Velikost</th>
                      </tr>
                    </thead>
                    <tbody>
                      {documents.length > 0 ? documents.map((documentEntry) => (
                        <tr key={documentEntry.name} className="border-t border-slate-100">
                          <td className="px-2 py-2.5">{documentEntry.name}</td>
                          <td className="px-2 py-2.5 text-right">{documentEntry.size}</td>
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

      <section className="rounded-xl border border-slate-200 bg-white px-4 pb-5 pt-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold tracking-tight">Uredi artikel</h2>
          <div className="flex items-center gap-2">
            <IconButton
              type="button"
              aria-label="Dodaj različico"
              title="Dodaj različico"
              tone="neutral"
              size="md"
              disabled={!isTableEditable}
              onClick={() => setDraft((current) => ({ ...current, variants: [...current.variants, createVariant({ sort: current.variants.length + 1 })] }))}
            >
              <PlusIcon />
            </IconButton>
            <IconButton
              type="button"
              aria-label="Odstrani izbrane različice"
              title="Izbriši izbrane"
              tone={hasSelectedVariants ? 'danger' : 'neutral'}
              size="md"
              disabled={!isTableEditable || !hasSelectedVariants}
              onClick={deleteSelectedVariants}
            >
              <TrashCanIcon />
            </IconButton>
            <Button type="button" variant="primary" size="toolbar" className="!h-10 !rounded-lg !px-4 !text-sm font-semibold" onClick={generateVariants} disabled={!isTableEditable}>Generiraj različice</Button>
          </div>
        </div>
        <div className="mb-3 space-y-2">
          <h3 className="text-sm font-semibold text-slate-800">Dimenzije</h3>
          <p className="text-xs text-slate-500">
            Vnesi vrednosti (v mm) za vsako dimenzijo posebej, na primer: <span className={inlineSnippetClass}>Dolžina: 10,20</span>. Podprte so Dolžina, Širina/fi in Debelina, razen pri dolžinskih artiklih, kjer Debelina ni dovoljena. Za posamezno dimenzijo lahko dodaš največ pet vrednosti. Ob generiranju se na podlagi vseh vnesenih kombinacij ustvarijo različice.
          </p>
          <p className="whitespace-nowrap text-xs leading-5 text-slate-700">
            <span className="font-semibold">Dodaj do tri dimenzije. Vnosne bližnjice:</span>{' '}
            <span className={`${inlineSnippetClass} !font-normal`}>d:</span>, <span className={`${inlineSnippetClass} !font-normal`}>š:</span>, <span className={`${inlineSnippetClass} !font-normal`}>fi:</span>, <span className={`${inlineSnippetClass} !font-normal`}>h:</span>, <span className={`${inlineSnippetClass} !font-normal`}>v:</span>
          </p>
          <div className="pt-2">
            <div className="flex items-start gap-3">
            <div className="relative w-1/2 min-w-[300px]">
              <div className={`flex h-[30px] flex-nowrap items-center gap-2 overflow-hidden rounded-md border border-slate-300 pl-[10px] pr-11 ${isGeneratorLocked ? '!bg-[color:var(--ui-neutral-bg)] text-slate-500' : 'bg-white'}`}>
                <SideInputIcon icon="dimension" muted={generatorInput.trim().length === 0 && generatorChips.length === 0} />
                {generatorChips.map((chip) => (
                  <span key={chip.dimension} className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-md border border-slate-300 bg-slate-50 px-2 py-0.5 text-xs text-slate-700">
                    <button
                      type="button"
                      className="whitespace-nowrap hover:text-slate-900 disabled:cursor-not-allowed disabled:text-slate-400"
                      disabled={isGeneratorLocked}
                      onClick={() => {
                        setGeneratorInput(`${generatorDimensionLabels[chip.dimension]}: ${chip.values.map((value) => formatDecimalForDisplay(value)).join(',')}`);
                        setGeneratorChips((current) => current.filter((entry) => entry.dimension !== chip.dimension));
                      }}
                    >
                      {`${generatorDimensionLabels[chip.dimension]}: ${chip.values.map((value) => formatDecimalForDisplay(value)).join(', ')}`}
                    </button>
                    <button
                      type="button"
                      aria-label={`Odstrani ${generatorDimensionLabels[chip.dimension]}`}
                      className="text-slate-500 transition hover:text-rose-600 active:text-rose-700 disabled:cursor-not-allowed disabled:text-slate-400"
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
                  placeholder={generatorChips.length > 0 ? '' : 'Dolžina: 10,20 + enter'}
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
        <div className="relative overflow-x-hidden overflow-y-visible rounded-lg border border-slate-200">
          <table className="min-w-full table-fixed whitespace-nowrap text-[13px] leading-5">
            <colgroup>
              <col style={{ width: ARTICLE_VARIANTS_COLUMN_WIDTHS.checkbox }} />
              <col style={{ width: ARTICLE_VARIANTS_COLUMN_WIDTHS.length }} />
              <col style={{ width: ARTICLE_VARIANTS_COLUMN_WIDTHS.width }} />
              <col style={{ width: ARTICLE_VARIANTS_COLUMN_WIDTHS.thickness }} />
              <col style={{ width: ARTICLE_VARIANTS_COLUMN_WIDTHS.weight }} />
              <col style={{ width: ARTICLE_VARIANTS_COLUMN_WIDTHS.tolerance }} />
              <col style={{ width: ARTICLE_VARIANTS_COLUMN_WIDTHS.price }} />
              <col style={{ width: ARTICLE_VARIANTS_COLUMN_WIDTHS.discount }} />
              <col style={{ width: ARTICLE_VARIANTS_COLUMN_WIDTHS.sale }} />
              <col style={{ width: ARTICLE_VARIANTS_COLUMN_WIDTHS.stock }} />
              <col style={{ width: ARTICLE_VARIANTS_COLUMN_WIDTHS.minOrder }} />
              <col style={{ width: ARTICLE_VARIANTS_COLUMN_WIDTHS.sku }} />
              <col style={{ width: ARTICLE_VARIANTS_COLUMN_WIDTHS.status }} />
              <col style={{ width: ARTICLE_VARIANTS_COLUMN_WIDTHS.note }} />
              <col style={{ width: ARTICLE_VARIANTS_COLUMN_WIDTHS.sort }} />
            </colgroup>
            <thead className="bg-slate-50">
              <tr>
                <TH className={`${articleVariantsHeaderCellClassName} !pl-2 !pr-1 text-center`}>
                  <span className={articleVariantsCheckboxShellClassName}>
                    <AdminCheckbox
                      checked={isTableEditable && allVariantsSelected}
                      onChange={() =>
                        setVariantSelections(allVariantsSelected ? new Set() : new Set(draft.variants.map((variant) => variant.id)))
                      }
                      disabled={!isTableEditable}
                    />
                  </span>
                </TH>
                <TH className={`${articleVariantsHeaderCellClassName} text-right`}>Dolžina</TH>
                <TH className={`${articleVariantsHeaderCellClassName} text-right`}>Širina/fi</TH>
                <TH className={`${articleVariantsHeaderCellClassName} text-right`}>Debelina</TH>
                <TH className={`${articleVariantsHeaderCellClassName} text-right`}>Teža</TH>
                <TH className={`${articleVariantsHeaderCellClassName} text-center`}>Toleranca</TH>
                <TH className={`${articleVariantsHeaderCellClassName} text-right`}>Cena</TH>
                <TH className={`${articleVariantsHeaderCellClassName} text-right`}>Popust</TH>
                <TH className={`${articleVariantsHeaderCellClassName} text-right`}>Akcijska cena</TH>
                <TH className={`${articleVariantsHeaderCellClassName} text-right`}>Zaloga</TH>
                <TH className={`${articleVariantsHeaderCellClassName} text-center`}>Min/nar.</TH>
                <TH className={`${articleVariantsHeaderCellClassName} text-center`}>SKU</TH>
                <TH className={`${articleVariantsHeaderCellClassName} text-center`}>Status</TH>
                <TH className={`${articleVariantsHeaderCellClassName} text-center`}>Opombe</TH>
                <TH className={`${articleVariantsHeaderCellClassName} text-center`}>Mesto</TH>
              </tr>
            </thead>
            <tbody>
              {draft.variants.map((variant, index) => (
                <tr key={variant.id} className="h-10 border-t border-slate-100 align-middle">
                  <td className={articleVariantsCheckboxCellClassName}>
                    <span className={articleVariantsCheckboxShellClassName}>
                      <AdminCheckbox checked={variantSelections.has(variant.id)} onChange={() => setVariantSelections((current) => { const next = new Set(current); if (next.has(variant.id)) next.delete(variant.id); else next.add(variant.id); return next; })} disabled={!isTableEditable} />
                    </span>
                  </td>
                  <td className="px-2 py-2 text-right">{isTableEditable ? <span className={`inline-flex w-full justify-end ${isDimensionLockActive ? 'text-slate-500' : ''}`}><span className={compactTableValueUnitShellClassName}><input type="text" inputMode="decimal" disabled={isDimensionLockActive} className={`${compactTableAlignedInputClassName} !w-[6.5ch] text-right ${isDimensionLockActive ? '!bg-[color:var(--ui-neutral-bg)] text-slate-500' : ''}`} value={readDecimalInputValue(variant.id, 'length', variant.length)} onChange={(event) => updateDecimalInputDraft(variant.id, 'length', event.target.value)} onBlur={() => commitDecimalInputDraft(variant.id, 'length', variant.length, (value) => updateVariant(variant.id, { length: value }), null)} /><span className={compactTableAdornmentClassName}>mm</span></span></span> : <span className={`inline-flex h-7 w-full justify-end ${isDimensionLockActive ? 'text-slate-500' : ''}`}><span className={compactTableValueUnitShellClassName}><span className={compactTableNumericSlotClassName}>{variant.length === null ? '—' : formatDecimalForDisplay(variant.length)}</span><span className={compactTableAdornmentClassName}>mm</span></span></span>}</td>
                  <td className="px-2 py-2 text-right">{isTableEditable ? <span className={`inline-flex w-full justify-end ${isDimensionLockActive ? 'text-slate-500' : ''}`}><span className={compactTableValueUnitShellClassName}><input type="text" inputMode="decimal" disabled={isDimensionLockActive} className={`${compactTableAlignedInputClassName} !w-[6.5ch] text-right ${isDimensionLockActive ? '!bg-[color:var(--ui-neutral-bg)] text-slate-500' : ''}`} value={readDecimalInputValue(variant.id, 'width', variant.width)} onChange={(event) => updateDecimalInputDraft(variant.id, 'width', event.target.value)} onBlur={() => commitDecimalInputDraft(variant.id, 'width', variant.width, (value) => updateVariant(variant.id, { width: value }), null)} /><span className={compactTableAdornmentClassName}>mm</span></span></span> : <span className={`inline-flex h-7 w-full justify-end ${isDimensionLockActive ? 'text-slate-500' : ''}`}><span className={compactTableValueUnitShellClassName}><span className={compactTableNumericSlotClassName}>{variant.width === null ? '—' : formatDecimalForDisplay(variant.width)}</span><span className={compactTableAdornmentClassName}>mm</span></span></span>}</td>
                  <td className="px-2 py-2 text-right">{isTableEditable ? <span className={`inline-flex w-full justify-end ${isThicknessLockActive ? 'text-slate-500' : ''}`}><span className={compactTableValueUnitShellClassName}><input type="text" inputMode="decimal" disabled={isThicknessLockActive} className={`${compactTableAlignedInputClassName} !w-[4.5ch] text-right ${isThicknessLockActive ? '!bg-[color:var(--ui-neutral-bg)] text-slate-500' : ''}`} value={readDecimalInputValue(variant.id, 'thickness', variant.thickness)} onChange={(event) => updateDecimalInputDraft(variant.id, 'thickness', event.target.value)} onBlur={() => commitDecimalInputDraft(variant.id, 'thickness', variant.thickness, (value) => updateVariant(variant.id, { thickness: value }), null)} /><span className={compactTableAdornmentClassName}>mm</span></span></span> : <span className={`inline-flex h-7 w-full justify-end ${isThicknessLockActive ? 'text-slate-500' : ''}`}><span className={compactTableValueUnitShellClassName}><span className={compactTableFourDigitSlotClassName}>{variant.thickness === null ? '—' : formatDecimalForDisplay(variant.thickness)}</span><span className={compactTableAdornmentClassName}>mm</span></span></span>}</td>
                  <td className="px-2 py-2 text-right">{isTableEditable ? <span className="inline-flex w-full justify-end"><span className={compactTableValueUnitShellClassName}><input type="text" inputMode="decimal" className={`${compactTableAlignedInputClassName} !mt-0 !w-[6.5ch] text-right`} value={readDecimalInputValue(variant.id, 'weight', variant.weight)} onChange={(event) => updateDecimalInputDraft(variant.id, 'weight', event.target.value)} onBlur={() => commitDecimalInputDraft(variant.id, 'weight', variant.weight ?? null, (value) => updateVariant(variant.id, { weight: value }), null)} /><span className={compactTableAdornmentClassName}>g</span></span></span> : <span className="inline-flex h-7 w-full justify-end"><span className={compactTableValueUnitShellClassName}><span className={compactTableNumericSlotClassName}>{variant.weight === null || variant.weight === undefined ? '—' : formatDecimalForDisplay(variant.weight)}</span><span className={compactTableAdornmentClassName}>g</span></span></span>}</td>
                  <td className="px-2 py-2 text-center">
                    {isTableEditable ? (
                      <div className={`inline-flex h-7 items-center justify-center whitespace-nowrap ${isToleranceLocked ? 'text-slate-500' : ''}`}>
                        <span className={compactTableAdornmentClassName}>±</span>
                        <input
                          type="text"
                          inputMode="decimal"
                          disabled={isToleranceLocked}
                          maxLength={1}
                          className={`${compactTableAlignedInputClassName} !mt-0 !w-[3ch] !px-0 text-center ${isToleranceLocked ? '!bg-[color:var(--ui-neutral-bg)] text-slate-500' : ''}`}
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
                      <span className={`${compactReadonlyCenterBoxClassName} !px-0`}>
                        {variant.errorTolerance
                          ? (
                            <span className="inline-flex h-7 items-center whitespace-nowrap">
                              <span>{`±${variant.errorTolerance.replace('.', ',')}`}</span>
                              <span className={`ml-1 ${compactTableAdornmentClassName}`}>mm</span>
                            </span>
                          )
                          : '—'}
                      </span>
                    )}
                  </td>
                  <td className="px-2 py-2 text-right">{isTableEditable ? <span className="inline-flex w-full justify-end"><span className={compactTableValueUnitShellClassName}><input type="text" inputMode="decimal" className={`${compactTableAlignedInputClassName} !mt-0 !w-[6.5ch] text-right`} value={readDecimalInputValue(variant.id, 'price', variant.price)} onChange={(event) => updateDecimalInputDraft(variant.id, 'price', event.target.value)} onBlur={() => commitDecimalInputDraft(variant.id, 'price', variant.price, (value) => updateVariant(variant.id, { price: value ?? 0 }), 0)} /><span className={compactTableAdornmentClassName}>€</span></span></span> : <span className="inline-flex h-7 w-full justify-end"><span className={compactTableValueUnitShellClassName}><span className={compactTableNumericSlotClassName}>{formatCurrencyAmountOnly(variant.price)}</span><span className={compactTableAdornmentClassName}>€</span></span></span>}</td>
                  <td className="px-2 py-2 text-right">{isTableEditable ? <span className="inline-flex w-full justify-end"><span className={compactTableValueUnitShellClassName}><input type="text" inputMode="decimal" className={`${compactTableAlignedInputClassName} !mt-0 !w-[4.5ch] !px-0 text-right`} value={readDecimalInputValue(variant.id, 'discountPct', variant.discountPct)} onChange={(event) => updateDecimalInputDraft(variant.id, 'discountPct', event.target.value)} onBlur={() => commitDecimalInputDraft(variant.id, 'discountPct', variant.discountPct, (value) => updateVariant(variant.id, { discountPct: Math.min(99.9, Math.max(0, value ?? 0)) }), 0)} /><span className={compactTableAdornmentClassName}>%</span></span></span> : <span className="inline-flex h-7 w-full justify-end"><span className={compactTableValueUnitShellClassName}><span className={compactTableFourDigitSlotClassName}>{formatDecimalForDisplay(variant.discountPct)}</span><span className={compactTableAdornmentClassName}>%</span></span></span>}</td>
                  <td className="px-2 py-2 text-right"><span className="inline-flex h-7 items-center justify-end">{variant.discountPct > 0 ? formatCurrency(computeSalePrice(variant.price, variant.discountPct)) : '—'}</span></td>
                  <td className="px-2 py-2 text-right">{isTableEditable ? <span className="inline-flex w-full justify-end"><input type="number" inputMode="numeric" className={`${compactTableAlignedInputClassName} !mt-0 !w-[5ch] !px-0 text-right`} value={variant.stock} onChange={(event) => updateVariant(variant.id, { stock: Number(event.target.value) || 0 })} /></span> : <span className="inline-flex h-7 w-full justify-end"><span className={compactTableStockSlotClassName}>{variant.stock}</span></span>}</td>
                  <td className="px-2 py-2 text-center">{isTableEditable ? <input type="number" inputMode="numeric" className={`${compactTableAlignedInputClassName} !mt-0 !w-[4.5ch] !px-0 text-center`} value={variant.minOrder ?? 1} onChange={(event) => updateVariant(variant.id, { minOrder: Math.max(1, Number(event.target.value) || 1) })} /> : <span className={compactTableMinOrderSlotClassName}>{variant.minOrder ?? 1}</span>}</td>
                  <td className="px-2 py-2 text-center">{isTableEditable ? <input className={`${compactTableAlignedTextInputClassName} ${compactTableSkuFieldWidthClassName} !mt-0 text-center`} value={variant.sku} onChange={(event) => updateVariant(variant.id, { sku: event.target.value, skuAutoGenerated: false })} /> : <span className={`${compactReadonlyTextShellClassName} ${compactTableSkuFieldWidthClassName}`}>{variant.sku || '—'}</span>}</td>
                  <td className="px-2 py-2 text-center">
                    <div className="inline-flex justify-center">
                      <ActiveStateChip
                        active={variant.active}
                        editable={isTableEditable}
                        chipClassName={compactTableVariantChipClassName}
                        menuPlacement="bottom"
                        onChange={(next) => updateVariant(variant.id, { active: next })}
                      />
                    </div>
                  </td>
                  <td className="px-2 py-2 text-center">
                    <div className="inline-flex justify-center">
                      <NoteTagChip
                        value={getVariantTag(variant.id)}
                        editable={isTableEditable}
                        chipClassName={compactTableVariantChipClassName}
                        menuPlacement="bottom"
                        onChange={(next) => {
                          if (!next) return;
                          setVariantTag(variant.id, next);
                        }}
                      />
                    </div>
                  </td>
                  <td className="px-2 py-2 text-center">{isTableEditable ? <input type="number" inputMode="numeric" className={`${compactTableAlignedInputClassName} !mt-0 !w-[4ch] !px-0 text-center`} value={variant.sort} onChange={(event) => updateVariant(variant.id, { sort: Number(event.target.value) || 1 })} /> : <span className={`${compactReadonlyCenterBoxClassName} w-[4ch] !px-0`}>{variant.sort}</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <Dialog
        open={pendingMediaRemoval !== null}
        onOpenChange={(open) => {
          if (!open) closePendingMediaRemoval();
        }}
        title={pendingMediaRemoval?.type === 'image' ? 'Odstrani sliko' : 'Odstrani video'}
        panelClassName="max-w-xs"
        footer={(
          <div className="mt-3 flex justify-end gap-2">
            <Button type="button" variant="ghost" size="toolbar" onClick={closePendingMediaRemoval}>Prekliči</Button>
            <Button type="button" variant="danger" size="toolbar" onClick={confirmPendingMediaRemoval}>Odstrani</Button>
          </div>
        )}
      >
        <p className="mt-2 text-sm text-slate-600">
          {pendingMediaRemoval?.type === 'image'
            ? 'Ali res želite odstraniti izbrano sliko?'
            : 'Ali res želite odstraniti izbrani video?'}
        </p>
      </Dialog>
      {editingImageSlot !== null && mediaImagesDraft[editingImageSlot]
        ? createPortal(
          <UploadedImageCropperModal
            imageUrl={mediaImagesDraft[editingImageSlot]}
            slotIndex={editingImageSlot}
            altText={ensureImageSettings(editingImageSlot).altText}
            onAltTextChange={(value) => updateImageSettings(editingImageSlot, { altText: value })}
            onCancel={() => setEditingImageSlot(null)}
            onSave={({ blob, mimeType }) => { void handleSaveEditedImage(editingImageSlot, blob, mimeType); }}
          />,
          document.body
        )
        : null}
    </div>
  );
}
