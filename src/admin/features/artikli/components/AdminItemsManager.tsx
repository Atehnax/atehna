'use client';

import dynamic from 'next/dynamic';
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/shared/ui/button';
import { IconButton } from '@/shared/ui/icon-button';
import { Spinner } from '@/shared/ui/loading';
import { useToast } from '@/shared/ui/toast';
import { UnsavedChangesDialog } from '@/shared/ui/unsaved-changes-dialog';
import {
  adminTableCardClassName,
  adminTableCardStyle,
  adminTableBulkHeaderButtonClassName,
  adminTableHeaderClassName,
  adminTableHeaderTextClassName,
  adminTableInlineActionRowClassName,
  adminTableInlineCancelButtonClassName,
  adminTableInlineCancelIconClassName,
  adminTableInlineConfirmButtonClassName,
  adminTableInlineConfirmIconClassName,
  adminTableNeutralIconButtonClassName,
  adminTablePrimaryButtonClassName,
  adminTableSearchIconClassName,
  adminTableSearchInputClassName,
  adminTableSearchWrapperClassName,
  adminTableSelectedWarningIconButtonClassName,
  adminTableToolbarActionsClassName,
  adminTableToolbarGroupClassName,
  AdminTableLayout
} from '@/shared/ui/admin-table';
import { AdminCheckbox } from '@/shared/ui/checkbox';
import { AdminSearchInput } from '@/shared/ui/admin-search-input';
import { ArchiveIcon, CheckIcon, CloseIcon, ColumnFilterIcon, CopyIcon, DownloadIcon, OpenArticleIcon, PencilIcon } from '@/shared/ui/icons/AdminActionIcons';
import { MenuItem, MenuPanel } from '@/shared/ui/menu';
import { RowActionsDropdown, Table, THead, TH, TR } from '@/shared/ui/table';
import { EuiTablePagination, useTablePagination } from '@/shared/ui/pagination';
import AdminRangeFilterPanel from '@/shared/ui/admin-range-filter-panel';
import {
  HeaderFilterPortal,
  HEADER_FILTER_BUTTON_CLASS,
  HEADER_FILTER_ROOT_ATTR,
  getHeaderPopoverStyle,
  useHeaderFilterDismiss
} from '@/shared/ui/admin-header-filter';
import {
  adminStatusInfoPillTableCellClassName,
  adminTableRowToneClasses,
  filterPillTokenClasses
} from '@/shared/ui/theme/tokens';
import {
  createArchivedItemRecord,
  readArchivedItemStorage,
  writeArchivedItemStorage
} from '@/admin/features/artikli/lib/archiveItemClient';
import {
  buildPersistedVariantName,
  computeSalePrice,
  formatCurrency,
  type ProductFamily,
  type Variant
} from '@/admin/features/artikli/lib/familyModel';
import { formatDecimalForDisplay, parseDecimalInput } from '@/admin/features/artikli/lib/decimalFormat';
import ActiveStateChip, { getActiveStateMenuItemClassName } from '@/admin/features/artikli/components/ActiveStateChip';
import AdminCategoryBreadcrumbPicker from '@/admin/features/artikli/components/AdminCategoryBreadcrumbPicker';
import { NoteTagChip, getNoteTagMenuItemClassName, type NoteTag } from '@/admin/features/artikli/components/NoteTagChip';
import {
  compactTableAdornmentClassName,
  compactTableAlignedInputClassName,
  compactTableAlignedTextInputClassName,
  compactTableValueUnitShellClassName
} from '@/admin/features/artikli/components/artikliFieldStyles';
import type { AdminCatalogListItem } from '@/shared/server/catalogItems';

type StatusFilter = 'all' | 'active' | 'inactive';
type DiscountFilter = 'all' | 'yes' | 'no';
type NoteFilter = 'all' | 'na-zalogi' | 'novo' | 'akcija' | 'zadnji-kosi' | 'ni-na-zalogi';
type OpenFilter = 'category' | 'status' | 'discount' | 'note' | 'variantCount' | 'priceRange' | 'actionPriceRange' | null;
type EditScopeKind = 'row' | 'group';
type SortState =
  | { column: 'article' | 'sku' | 'category'; direction: 'asc' | 'desc' }
  | { column: 'variantCount' | 'discount' | 'status' | 'note'; direction: 'desc' | 'asc' }
  | { column: 'priceRange' | 'actionPriceRange'; mode: 'minAsc' | 'minDesc' | 'maxDesc' | 'maxAsc' }
  | null;

const PAGE_SIZE_OPTIONS = [20, 50, 100];
type ListFamily = ProductFamily & { baseSku: string; material: string | null; categoryPath: string[]; itemBadge: NoteValue };
type NoteValue = '' | NoteTag;
type FamilyDraft = { name: string; sku: string; categoryPath: string[]; active: boolean; badge: NoteValue };
type VariantDraft = { label: string; sku: string; price: number; discountPct: number; stock: number; active: boolean; minOrder: number; note: NoteValue; position: number };
type ActiveEditScope = { familyId: string; kind: EditScopeKind; restoreExpandedOnExit: boolean };
type PendingGuardAction = { label: string; run: () => void };
type NumericDraftField = 'price' | 'discountPct' | 'salePrice';
type NumericDraftScope = 'family' | 'variant';
type HighlightableArticleColumn = 'sku' | 'category' | 'priceRange' | 'discount' | 'actionPriceRange';
const ROW_EDIT_INPUT_CLASS = `${compactTableAlignedTextInputClassName} !mt-0 !h-7 !w-full !px-2 text-[12px]`;
const ROW_EDIT_COMPACT_NUMBER_INPUT_CLASS = `${compactTableAlignedInputClassName} !mt-0 !h-7 text-right text-[12px]`;
const MESTO_EDIT_INPUT_CLASS =
  'mx-auto h-7 w-3/4 rounded-md border border-slate-300 bg-white px-1 text-center text-[12px] leading-7 text-slate-900 shadow-none outline-none transition focus:border-[#3e67d6] focus:outline-none focus:ring-0';
const QUICK_EDIT_NAME_SHELL_CLASS = 'min-w-0 flex-1';
const QUICK_EDIT_NAME_INPUT_CLASS = `${ROW_EDIT_INPUT_CLASS} font-medium`;
const ARTICLE_COLUMN_CLASS = 'w-[21.175%]';
const CATEGORY_COLUMN_CLASS = 'w-[20.825%]';
const STATUS_COLUMN_CLASS = adminStatusInfoPillTableCellClassName;
const NOTE_COLUMN_CLASS = adminStatusInfoPillTableCellClassName;
const ACTIONS_COLUMN_CLASS = 'w-[96px] min-w-[96px] max-w-[96px]';
const STATUS_NOTE_CELL_INNER_CLASS = 'inline-flex w-full items-center justify-center';
const MATCHING_VALUE_HIGHLIGHT_CLASS =
  'rounded-[4px] bg-amber-100/70 outline outline-1 outline-dashed outline-amber-500/80';
const NUMERIC_FIELD_LABELS: Record<NumericDraftField, string> = {
  price: 'Cena',
  discountPct: 'Popust',
  salePrice: 'Akcijska cena'
};
const EDIT_SHORTCUT_IGNORE_SELECTOR = '[data-ignore-edit-shortcuts="true"], [role="menu"], [role="listbox"], [role="dialog"]';
const LazyConfirmDialog = dynamic(
  () => import('@/shared/ui/confirm-dialog').then((module) => module.ConfirmDialog),
  { ssr: false }
);

const getBaseSku = (family: ListFamily) => family.baseSku || family.variants[0]?.sku || '';
const normalizeCategoryPath = (value: string) =>
  value
    .split('/')
    .map((entry) => entry.trim())
    .filter(Boolean);

const CATEGORY_PLACEHOLDER_LABELS = new Set(['Izberi kategorijo', 'Izberi podkategorijo']);
const getFamilyCategoryDisplay = (family: ListFamily) => {
  const categoryPath = (family.categoryPath.length > 0 ? family.categoryPath : normalizeCategoryPath(family.category)).filter(
    (segment) => !CATEGORY_PLACEHOLDER_LABELS.has(segment)
  );
  const displayValue = categoryPath.join(' / ').trim();

  return displayValue || '\u2014';
};

const getComparableArticleCellValue = (value: string) =>
  (value || '\u2014')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

const normalizeIdentityValue = (value: string) => value.trim().replace(/\s+/g, ' ');
const normalizeIdentityComparisonValue = (value: string) => normalizeIdentityValue(value).toLocaleLowerCase('sl');
const createIdentitySuggestions = (value: string, reservedValues: Iterable<string>, separator: ' ' | '-' = '-') => {
  const reserved = new Set(Array.from(reservedValues, normalizeIdentityComparisonValue));
  const base = normalizeIdentityValue(value);
  const suggestions: string[] = [];

  for (let suffix = 2; suggestions.length < 5 && suffix <= 99; suffix += 1) {
    const suggestion = separator === ' ' ? `${base} ${suffix}` : `${base}-${suffix}`;
    const comparison = normalizeIdentityComparisonValue(suggestion);
    if (!comparison || reserved.has(comparison)) continue;
    reserved.add(comparison);
    suggestions.push(suggestion);
  }

  return suggestions;
};
type CatalogIdentityIssue = { message: string; suggestions: string[] };

const getFamilyNameIssue = (families: ListFamily[], familyId: string, value: string): CatalogIdentityIssue | null => {
  const normalized = normalizeIdentityComparisonValue(value);
  if (!normalized) return null;
  const conflict = families.find((family) => family.id !== familyId && normalizeIdentityComparisonValue(family.name) === normalized);
  if (!conflict) return null;

  return {
    message: `Naziv artikla je že uporabljen (${conflict.name}).`,
    suggestions: createIdentitySuggestions(value, families.filter((family) => family.id !== familyId).map((family) => family.name), ' ')
  };
};

const collectReservedSkuValues = (
  families: ListFamily[],
  options: { familyId: string; variantId?: string | null; includeSameFamilyVariants: boolean }
) => {
  const reserved: string[] = [];
  families.forEach((family) => {
    const baseSku = getBaseSku(family);
    if (family.id !== options.familyId && baseSku) reserved.push(baseSku);
    family.variants.forEach((variant) => {
      if (!variant.sku) return;
      if (family.id !== options.familyId) {
        reserved.push(variant.sku);
        return;
      }
      if (options.includeSameFamilyVariants && variant.id !== options.variantId) {
        reserved.push(variant.sku);
      }
    });
  });
  return reserved;
};

const getSkuIssue = (
  families: ListFamily[],
  value: string,
  options: { familyId: string; variantId?: string | null; includeSameFamilyVariants?: boolean }
): CatalogIdentityIssue | null => {
  const normalized = normalizeIdentityComparisonValue(value);
  if (!normalized) return null;
  const includeSameFamilyVariants = Boolean(options.includeSameFamilyVariants);

  for (const family of families) {
    if (family.id !== options.familyId && normalizeIdentityComparisonValue(getBaseSku(family)) === normalized) {
      return {
        message: `SKU je že uporabljen (${family.name}).`,
        suggestions: createIdentitySuggestions(value, collectReservedSkuValues(families, { ...options, includeSameFamilyVariants }))
      };
    }

    for (const variant of family.variants) {
      if (!variant.sku) continue;
      const isSameVariant = family.id === options.familyId && variant.id === options.variantId;
      const isAllowedSameFamilyVariant = family.id === options.familyId && !includeSameFamilyVariants;
      if (isSameVariant || isAllowedSameFamilyVariant) continue;
      if (normalizeIdentityComparisonValue(variant.sku) === normalized) {
        return {
          message: `SKU je že uporabljen (${family.name}).`,
          suggestions: createIdentitySuggestions(value, collectReservedSkuValues(families, { ...options, includeSameFamilyVariants }))
        };
      }
    }
  }

  return null;
};

const formatCurrencyAmountOnly = (value: number) =>
  value.toLocaleString('sl-SI', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const formatCurrencyWithSuffix = (value: number) => `${formatCurrencyAmountOnly(value)} €`;

const formatCurrencyRange = (minValue: number, maxValue: number) =>
  minValue === maxValue
    ? formatCurrencyWithSuffix(minValue)
    : `${formatCurrencyAmountOnly(minValue)}–${formatCurrencyAmountOnly(maxValue)} €`;
const formatCurrencyRangeFromValues = (values: number[]) => {
  if (!values.length) return '—';
  const min = Math.min(...values);
  const max = Math.max(...values);
  return min === max
    ? formatCurrencyWithSuffix(min)
    : `${formatCurrencyAmountOnly(min)}–${formatCurrencyAmountOnly(max)} €`;
};
const normalizeNoteValue = (value: string | null | undefined): NoteTag | '' => {
  const normalized = (value ?? '').trim().toLowerCase();
  if (!normalized) return '';
  if (normalized === 'opomba') return 'na-zalogi';
  if (normalized === 'na-zalogi' || normalized === 'novo' || normalized === 'akcija' || normalized === 'zadnji-kosi' || normalized === 'ni-na-zalogi') {
    return normalized;
  }
  return '';
};
const noteValueLabel = (value: NoteValue) => {
  if (value === 'na-zalogi') return 'Na zalogi';
  if (value === 'novo') return 'Novo';
  if (value === 'akcija') return 'V akciji';
  if (value === 'ni-na-zalogi') return 'Ni na zalogi';
  if (value === 'zadnji-kosi') return 'Zadnji kosi';
  return 'Brez opombe';
};
const ITEM_STATUS_BULK_OPTIONS = [
  { value: true, label: 'Aktiven' },
  { value: false, label: 'Neaktiven' }
] as const;
const ITEM_NOTE_BULK_OPTIONS: Array<{ value: NoteTag; label: string }> = [
  { value: 'na-zalogi', label: 'Na zalogi' },
  { value: 'novo', label: 'Novo' },
  { value: 'akcija', label: 'V akciji' },
  { value: 'zadnji-kosi', label: 'Zadnji kosi' },
  { value: 'ni-na-zalogi', label: 'Ni na zalogi' }
];
const itemStatusLabel = (active: boolean) => (active ? 'Aktiven' : 'Neaktiven');
const itemStatusSearchValue = (active: boolean) => (active ? 'Aktiven active' : 'Neaktiven inactive Skrit hidden');
const familySearchValue = (family: ListFamily) =>
  [
    family.name,
    getBaseSku(family),
    family.category,
    family.categoryPath.join(' / '),
    itemStatusSearchValue(family.active),
    family.notes,
    family.itemBadge,
    noteValueLabel(family.itemBadge),
    ...family.variants.flatMap((variant) => [
      variant.label,
      variant.sku,
      itemStatusSearchValue(variant.active),
      variant.badge ?? '',
      noteValueLabel(normalizeNoteValue(variant.badge) as NoteValue)
    ])
  ]
    .filter((value) => value && value.trim().length > 0)
    .join(' ')
    .toLowerCase();
const formatPercentRange = (values: number[]) => {
  if (!values.length) return '—';
  const min = Math.min(...values);
  const max = Math.max(...values);
  const minLabel = formatDecimalForDisplay(min);
  const maxLabel = formatDecimalForDisplay(max);
  return min === max ? `${maxLabel}%` : `${minLabel}–${maxLabel}%`;
};

const clampDiscountPct = (value: number) => Math.min(99.9, Math.max(0, value));
const computeDiscountPctFromSalePrice = (price: number, salePrice: number) => {
  if (!Number.isFinite(price) || price <= 0) return 0;
  const normalizedSalePrice = Math.max(0, salePrice);
  return clampDiscountPct(Number((((price - normalizedSalePrice) / price) * 100).toFixed(2)));
};
const isDecimalInputDraft = (raw: string) => raw.trim() === '' || /^\d*(?:[.,]\d*)?$/.test(raw.trim());
const getUniformNumber = (values: number[]) => {
  if (!values.length) return null;
  const [first, ...rest] = values;
  return rest.every((value) => Object.is(value, first)) ? first : null;
};
const getVariantSalePrice = (draft: Pick<VariantDraft, 'price' | 'discountPct'>) =>
  draft.discountPct > 0 ? computeSalePrice(draft.price, draft.discountPct) : null;
const numericDraftKey = (scope: NumericDraftScope, id: string, field: NumericDraftField) => `${scope}:${id}:${field}`;
const applyNumericFieldToVariantDraft = (draft: VariantDraft, field: NumericDraftField, raw: string) => {
  const trimmed = raw.trim();
  if (!trimmed) {
    return field === 'price'
      ? { nextDraft: { ...draft, price: 0 } }
      : { nextDraft: { ...draft, discountPct: 0 } };
  }

  const parsed = parseDecimalInput(trimmed);
  if (parsed === null) {
    return { nextDraft: draft, error: `Preverite vrednost v polju ${NUMERIC_FIELD_LABELS[field]}.` };
  }

  if (field === 'price') {
    return { nextDraft: { ...draft, price: Math.max(0, parsed) } };
  }
  if (field === 'discountPct') {
    return { nextDraft: { ...draft, discountPct: clampDiscountPct(parsed) } };
  }

  return {
    nextDraft: {
      ...draft,
      discountPct: computeDiscountPctFromSalePrice(draft.price, parsed)
    }
  };
};
const formatAmountRangeForInput = (values: number[]) => {
  if (!values.length) return '';
  const min = Math.min(...values);
  const max = Math.max(...values);
  return min === max ? formatCurrencyAmountOnly(min) : `${formatCurrencyAmountOnly(min)}-${formatCurrencyAmountOnly(max)}`;
};
const formatPercentRangeForInput = (values: number[]) => {
  if (!values.length) return '';
  const min = Math.min(...values);
  const max = Math.max(...values);
  const minLabel = formatDecimalForDisplay(min);
  const maxLabel = formatDecimalForDisplay(max);
  return min === max ? maxLabel : `${minLabel}-${maxLabel}`;
};

function toListFamilies(items: AdminCatalogListItem[]): ListFamily[] {
  return items.map((item, itemIndex) => {
    const variants: Variant[] = item.variants.map((variant, variantIndex) => ({
      id: String(variant.id),
      label: buildPersistedVariantName(
        {
          label: variant.variantName || `Različica ${variantIndex + 1}`,
          width: variant.width,
          length: variant.length,
          thickness: variant.thickness,
          weight: variant.weight
        },
        { baseName: item.itemName, variantCount: item.variants.length, index: variantIndex }
      ),
      width: variant.width,
      length: variant.length,
      thickness: variant.thickness,
      weight: variant.weight,
      minOrder: variant.minOrder,
      badge: variant.badge,
      position: variant.position,
      sku: variant.variantSku ?? '',
      price: variant.price,
      discountPct: variant.discountPct,
      stock: variant.inventory,
      active: variant.status === 'active',
      sort: variantIndex + 1,
      imageAssignments: [],
      imageOverride: null
    }));

    return {
      id: String(item.id),
      name: item.itemName,
      description: '',
      category: item.categoryLabel || '—',
      categoryPath: normalizeCategoryPath(item.categoryLabel || ''),
      categoryId: null,
      subcategoryId: null,
      images: [],
      promoBadge: '',
      defaultDiscountPct: item.defaultDiscountPct,
      active: item.status === 'active',
      sort: itemIndex + 1,
      notes: item.badge ?? item.adminNotes ?? '',
      itemBadge: (normalizeNoteValue(item.badge) as NoteValue) || 'na-zalogi',
      slug: item.slug,
      variants,
      baseSku: item.baseSku ?? '',
      material: item.material
    };
  });
}

function buildArchiveRecordForFamily(family: ListFamily) {
  const firstVariant = family.variants[0];
  return createArchivedItemRecord({
    id: family.slug,
    name: family.name,
    category: family.categoryPath.length > 0 ? family.categoryPath.join(' / ') : family.category,
    sku: getBaseSku(family) || firstVariant?.sku || '',
    price: firstVariant?.price ?? 0,
    discountPct: firstVariant?.discountPct ?? 0,
    active: family.active
  });
}

const createFamilyDraft = (family: ListFamily): FamilyDraft => ({
  name: family.name,
  sku: getBaseSku(family),
  categoryPath: family.categoryPath.length > 0 ? family.categoryPath : normalizeCategoryPath(family.category),
  active: family.active,
  badge: family.itemBadge || 'na-zalogi'
});

const getFamilyDraftForState = (family: ListFamily, sourceDrafts: Record<string, FamilyDraft>) =>
  sourceDrafts[family.id] ?? createFamilyDraft(family);

const buildFamilyPatch = (family: ListFamily, draft: FamilyDraft) => {
  const baseline = createFamilyDraft(family);
  const patch: Record<string, unknown> = {};
  let changeCount = 0;

  if (draft.name !== baseline.name) {
    patch.itemName = draft.name;
    changeCount += 1;
  }
  if ((draft.sku || null) !== (baseline.sku || null)) {
    patch.sku = draft.sku || null;
    changeCount += 1;
  }
  if (draft.active !== baseline.active) {
    patch.status = draft.active ? 'active' : 'inactive';
    changeCount += 1;
  }
  if ((draft.badge || null) !== (baseline.badge || null)) {
    patch.badge = draft.badge || null;
    changeCount += 1;
  }

  const baselinePath = baseline.categoryPath.join('/');
  const draftPath = draft.categoryPath.join('/');
  if (draftPath !== baselinePath && draft.categoryPath.length > 0) {
    patch.categoryPath = draft.categoryPath;
    changeCount += 1;
  }

  return { patch, changeCount };
};

const createVariantDraft = (variant: Variant): VariantDraft => ({
  label: variant.label || 'Različica',
  sku: variant.sku,
  price: variant.price,
  discountPct: variant.discountPct,
  stock: variant.stock,
  active: variant.active,
  minOrder: variant.minOrder ?? 1,
  note: (normalizeNoteValue(variant.badge) as NoteValue) || 'na-zalogi',
  position: variant.position ?? 1
});

const buildVariantPatch = (variant: Variant, draft: VariantDraft) => {
  const baseline = createVariantDraft(variant);
  const patch: Record<string, unknown> = {};
  let changeCount = 0;

  if (draft.label !== baseline.label) {
    patch.variantName = draft.label;
    changeCount += 1;
  }
  if (draft.sku !== baseline.sku) {
    patch.variantSku = draft.sku || null;
    changeCount += 1;
  }
  if (draft.price !== baseline.price) {
    patch.price = draft.price;
    changeCount += 1;
  }
  if (draft.discountPct !== baseline.discountPct) {
    patch.discountPct = draft.discountPct;
    changeCount += 1;
  }
  if (draft.stock !== baseline.stock) {
    patch.inventory = draft.stock;
    changeCount += 1;
  }
  if (Math.max(1, draft.minOrder) !== Math.max(1, baseline.minOrder)) {
    patch.minOrder = Math.max(1, draft.minOrder);
    changeCount += 1;
  }
  if (draft.active !== baseline.active) {
    patch.status = draft.active ? 'active' : 'inactive';
    changeCount += 1;
  }
  if ((draft.note || null) !== (baseline.note || null)) {
    patch.badge = draft.note || null;
    changeCount += 1;
  }
  if (Math.max(1, draft.position) !== Math.max(1, baseline.position)) {
    patch.position = Math.max(1, draft.position);
    changeCount += 1;
  }

  return { patch, changeCount };
};

export default function AdminItemsManager({ items }: { items: AdminCatalogListItem[] }) {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [discountFilter, setDiscountFilter] = useState<DiscountFilter>('all');
  const [noteFilter, setNoteFilter] = useState<NoteFilter>('all');
  const [openFilter, setOpenFilter] = useState<OpenFilter>(null);
  const [isStatusBulkMenuOpen, setIsStatusBulkMenuOpen] = useState(false);
  const [isNoteBulkMenuOpen, setIsNoteBulkMenuOpen] = useState(false);
  const [isSelectedPillUpdating, setIsSelectedPillUpdating] = useState(false);
  const [expandedFamilyIds, setExpandedFamilyIds] = useState<Set<string>>(new Set());
  const [selectedFamilyIds, setSelectedFamilyIds] = useState<Set<string>>(new Set());
  const [selectedVariantIds, setSelectedVariantIds] = useState<Set<string>>(new Set());
  const [activeEditScope, setActiveEditScope] = useState<ActiveEditScope | null>(null);
  const [isSavingActiveScope, setIsSavingActiveScope] = useState(false);
  const [deletedVariantIds] = useState<Set<string>>(new Set());
  const [familyDrafts, setFamilyDrafts] = useState<Record<string, FamilyDraft>>({});
  const [variantDrafts, setVariantDrafts] = useState<Record<string, VariantDraft>>({});
  const [numericDrafts, setNumericDrafts] = useState<Record<string, string>>({});
  const [savedFamilyRows, setSavedFamilyRows] = useState<Record<string, ListFamily>>({});
  const [duplicatedFamilyRows, setDuplicatedFamilyRows] = useState<Record<string, ListFamily[]>>({});
  const [categoryPaths, setCategoryPaths] = useState<string[]>([]);
  const [sortState, setSortState] = useState<SortState>(null);
  const [variantCountRange, setVariantCountRange] = useState<{ min: string; max: string }>({ min: '', max: '' });
  const [priceRangeFilter, setPriceRangeFilter] = useState<{ min: string; max: string }>({ min: '', max: '' });
  const [draftPriceRangeFilter, setDraftPriceRangeFilter] = useState<{ min: string; max: string }>({ min: '', max: '' });
  const [actionPriceRangeFilter, setActionPriceRangeFilter] = useState<{ min: string; max: string }>({ min: '', max: '' });
  const [draftActionPriceRangeFilter, setDraftActionPriceRangeFilter] = useState<{ min: string; max: string }>({ min: '', max: '' });
  const [hoveredCellMatch, setHoveredCellMatch] = useState<{ column: HighlightableArticleColumn; value: string } | null>(null);
  const [isBulkArchiveDialogOpen, setIsBulkArchiveDialogOpen] = useState(false);
  const [isArchivingSelected, setIsArchivingSelected] = useState(false);
  const [isDuplicatingSelected, setIsDuplicatingSelected] = useState(false);
  const [archiveDialogFamilyIds, setArchiveDialogFamilyIds] = useState<Set<string> | null>(null);
  const [pendingGuardLabel, setPendingGuardLabel] = useState<string | null>(null);
  const categoryFilterButtonRef = useRef<HTMLButtonElement | null>(null);
  const priceFilterButtonRef = useRef<HTMLButtonElement | null>(null);
  const discountFilterButtonRef = useRef<HTMLButtonElement | null>(null);
  const actionPriceFilterButtonRef = useRef<HTMLButtonElement | null>(null);
  const statusFilterButtonRef = useRef<HTMLButtonElement | null>(null);
  const noteFilterButtonRef = useRef<HTMLButtonElement | null>(null);
  const statusBulkMenuRef = useRef<HTMLDivElement | null>(null);
  const noteBulkMenuRef = useRef<HTMLDivElement | null>(null);
  const pendingGuardActionRef = useRef<PendingGuardAction | null>(null);

  const families = useMemo(() => toListFamilies(items), [items]);
  const pendingGuardArticleTitle = useMemo(() => {
    if (!pendingGuardLabel) return null;
    const articleEditPrefix = 'začetkom urejanja artikla ';
    return pendingGuardLabel.startsWith(articleEditPrefix) ? pendingGuardLabel.slice(articleEditPrefix.length) : null;
  }, [pendingGuardLabel]);
  const { toast } = useToast();
  const effectiveFamilies = useMemo(
    () => {
      const baseFamilyIds = new Set(families.map((family) => family.id));
      return families.flatMap((family) => {
        const saved = savedFamilyRows[family.id];
        const duplicatedRows = (duplicatedFamilyRows[family.id] ?? []).filter(
          (duplicatedFamily) => !baseFamilyIds.has(duplicatedFamily.id)
        );
        return [
          saved ?? family,
          ...duplicatedRows.map((duplicatedFamily) => savedFamilyRows[duplicatedFamily.id] ?? duplicatedFamily)
        ];
      });
    },
    [duplicatedFamilyRows, families, savedFamilyRows]
  );
  const familyById = useMemo(() => new Map(effectiveFamilies.map((family) => [family.id, family])), [effectiveFamilies]);
  const variantTargetById = useMemo(() => {
    const next = new Map<string, { family: ListFamily; variant: Variant }>();
    effectiveFamilies.forEach((family) => {
      family.variants.forEach((variant) => {
        next.set(variant.id, { family, variant });
      });
    });
    return next;
  }, [effectiveFamilies]);
  const selectedArchiveFamilies = useMemo(
    () =>
      effectiveFamilies.filter(
        (family) =>
          selectedFamilyIds.has(family.id) ||
          family.variants.some((variant) => selectedVariantIds.has(variant.id))
      ),
    [effectiveFamilies, selectedFamilyIds, selectedVariantIds]
  );
  const selectedArchiveCount = selectedArchiveFamilies.length;
  const hasSelectedArchiveFamilies = selectedArchiveCount > 0;
  const selectedPillTargetCount = selectedFamilyIds.size + selectedVariantIds.size;
  const hasBulkSelectedPillTargets = selectedPillTargetCount > 1;
  const singleSelectedFamilyId = selectedPillTargetCount === 1 ? Array.from(selectedFamilyIds)[0] ?? null : null;
  const singleSelectedVariantId = selectedPillTargetCount === 1 ? Array.from(selectedVariantIds)[0] ?? null : null;
  const archiveDialogFamilies = useMemo(
    () =>
      archiveDialogFamilyIds
        ? effectiveFamilies.filter((family) => archiveDialogFamilyIds.has(family.id))
        : selectedArchiveFamilies,
    [archiveDialogFamilyIds, effectiveFamilies, selectedArchiveFamilies]
  );
  const archiveDialogCount = archiveDialogFamilies.length;
  const categories = useMemo(() => Array.from(new Set(effectiveFamilies.map((family) => family.category))).sort((a, b) => a.localeCompare(b, 'sl')), [effectiveFamilies]);

  useEffect(() => {
    setSavedFamilyRows({});
    setDuplicatedFamilyRows({});
  }, [items]);

  useEffect(() => {
    let cancelled = false;
    const loadCategoryPaths = async () => {
      try {
        const response = await fetch('/api/admin/categories/paths', { cache: 'no-store' });
        if (!response.ok) return;
        const payload = (await response.json()) as { paths?: string[] };
        const nextPaths = Array.isArray(payload.paths) ? payload.paths : [];
        if (cancelled) return;
        const fromRows = effectiveFamilies
          .map((family) => family.categoryPath.join(' / '))
          .filter((entry) => entry.length > 0);
        setCategoryPaths(Array.from(new Set([...fromRows, ...nextPaths])));
      } catch {
        if (cancelled) return;
        const fallback = effectiveFamilies
          .map((family) => family.categoryPath.join(' / '))
          .filter((entry) => entry.length > 0);
        setCategoryPaths(Array.from(new Set(fallback)));
      }
    };
    void loadCategoryPaths();
    return () => {
      cancelled = true;
    };
  }, [effectiveFamilies]);

  useEffect(() => {
    if (hasBulkSelectedPillTargets) return;
    setIsStatusBulkMenuOpen(false);
    setIsNoteBulkMenuOpen(false);
  }, [hasBulkSelectedPillTargets]);

  useEffect(() => {
    if (!isStatusBulkMenuOpen && !isNoteBulkMenuOpen) return;

    const handleOutsideClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!statusBulkMenuRef.current?.contains(target)) {
        setIsStatusBulkMenuOpen(false);
      }
      if (!noteBulkMenuRef.current?.contains(target)) {
        setIsNoteBulkMenuOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsStatusBulkMenuOpen(false);
        setIsNoteBulkMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isNoteBulkMenuOpen, isStatusBulkMenuOpen]);

  const filteredFamilies = useMemo(() => {
    const q = search.trim().toLowerCase();
    return effectiveFamilies.filter((family) => {
      const matchesSearch = q.length === 0 || familySearchValue(family).includes(q);
      const matchesCategory = categoryFilter === 'all' || family.category === categoryFilter;
      const matchesStatus = statusFilter === 'all' || (statusFilter === 'active' ? family.active : !family.active);
      const hasDiscount = family.defaultDiscountPct > 0 || family.variants.some((variant) => variant.discountPct > 0);
      const matchesDiscount = discountFilter === 'all' || (discountFilter === 'yes' ? hasDiscount : !hasDiscount);
      const familyNote = family.itemBadge;
      const matchesNote = noteFilter === 'all' || familyNote === noteFilter;
      return matchesSearch && matchesCategory && matchesStatus && matchesDiscount && matchesNote;
    });
  }, [categoryFilter, discountFilter, effectiveFamilies, noteFilter, search, statusFilter]);

  const filteredRows = useMemo(() => {
    const normalizedRows = filteredFamilies
      .map((family) => {
        const visibleVariants = family.variants.filter((variant) => !deletedVariantIds.has(variant.id));
        const prices = visibleVariants.map((variant) => variant.price);
        const minPrice = prices.length ? Math.min(...prices) : 0;
        const maxPrice = prices.length ? Math.max(...prices) : 0;
        const discounts = visibleVariants.map((variant) => variant.discountPct);
        const actionPrices = visibleVariants
          .filter((variant) => variant.discountPct > 0)
          .map((variant) => computeSalePrice(variant.price, variant.discountPct));
        const minActionPrice = actionPrices.length ? Math.min(...actionPrices) : null;
        const maxActionPrice = actionPrices.length ? Math.max(...actionPrices) : null;
        return {
          family,
          visibleVariants,
          variantCount: visibleVariants.length,
          minPrice,
          maxPrice,
          discounts,
          minActionPrice,
          maxActionPrice
        };
      })
      .filter((row) => {
        const minCount = variantCountRange.min.trim() === '' ? null : Number(variantCountRange.min);
        const maxCount = variantCountRange.max.trim() === '' ? null : Number(variantCountRange.max);
        const minPriceFilter = priceRangeFilter.min.trim() === '' ? null : Number(priceRangeFilter.min);
        const maxPriceFilter = priceRangeFilter.max.trim() === '' ? null : Number(priceRangeFilter.max);
        const minActionPriceFilter = actionPriceRangeFilter.min.trim() === '' ? null : Number(actionPriceRangeFilter.min);
        const maxActionPriceFilter = actionPriceRangeFilter.max.trim() === '' ? null : Number(actionPriceRangeFilter.max);
        const matchesCountMin = minCount === null || row.variantCount >= minCount;
        const matchesCountMax = maxCount === null || row.variantCount <= maxCount;
        const matchesPriceMin = minPriceFilter === null || row.minPrice >= minPriceFilter;
        const matchesPriceMax = maxPriceFilter === null || row.maxPrice <= maxPriceFilter;
        const matchesActionPriceMin =
          minActionPriceFilter === null || (row.minActionPrice !== null && row.minActionPrice >= minActionPriceFilter);
        const matchesActionPriceMax =
          maxActionPriceFilter === null || (row.maxActionPrice !== null && row.maxActionPrice <= maxActionPriceFilter);
        return matchesCountMin && matchesCountMax && matchesPriceMin && matchesPriceMax && matchesActionPriceMin && matchesActionPriceMax;
      });

    if (!sortState) return normalizedRows;

    const rows = [...normalizedRows];
    if (sortState.column === 'article') {
      rows.sort((a, b) =>
        sortState.direction === 'asc'
          ? a.family.name.localeCompare(b.family.name, 'sl')
          : b.family.name.localeCompare(a.family.name, 'sl')
      );
      return rows;
    }
    if (sortState.column === 'category') {
      rows.sort((a, b) =>
        sortState.direction === 'asc'
          ? a.family.category.localeCompare(b.family.category, 'sl')
          : b.family.category.localeCompare(a.family.category, 'sl')
      );
      return rows;
    }
    if (sortState.column === 'sku') {
      rows.sort((a, b) =>
        sortState.direction === 'asc'
          ? getBaseSku(a.family).localeCompare(getBaseSku(b.family), 'sl')
          : getBaseSku(b.family).localeCompare(getBaseSku(a.family), 'sl')
      );
      return rows;
    }
    if (sortState.column === 'variantCount') {
      rows.sort((a, b) => (sortState.direction === 'desc' ? b.variantCount - a.variantCount : a.variantCount - b.variantCount));
      return rows;
    }
    if (sortState.column === 'discount') {
      rows.sort((a, b) =>
        sortState.direction === 'desc'
          ? b.family.defaultDiscountPct - a.family.defaultDiscountPct
          : a.family.defaultDiscountPct - b.family.defaultDiscountPct
      );
      return rows;
    }
    if (sortState.column === 'status') {
      rows.sort((a, b) => {
        const valueA = a.family.active ? 1 : 0;
        const valueB = b.family.active ? 1 : 0;
        return sortState.direction === 'desc' ? valueB - valueA : valueA - valueB;
      });
      return rows;
    }
    if (sortState.column === 'note') {
      rows.sort((a, b) => {
        const noteA = a.family.itemBadge;
        const noteB = b.family.itemBadge;
        return sortState.direction === 'desc'
          ? noteB.localeCompare(noteA, 'sl')
          : noteA.localeCompare(noteB, 'sl');
      });
      return rows;
    }
    if (sortState.column === 'priceRange' || sortState.column === 'actionPriceRange') {
      const getMin = (row: (typeof rows)[number]) => (sortState.column === 'priceRange' ? row.minPrice : row.minActionPrice ?? Number.POSITIVE_INFINITY);
      const getMax = (row: (typeof rows)[number]) => (sortState.column === 'priceRange' ? row.maxPrice : row.maxActionPrice ?? Number.NEGATIVE_INFINITY);
      rows.sort((a, b) => {
        if (sortState.mode === 'minAsc') return getMin(a) - getMin(b);
        if (sortState.mode === 'minDesc') return getMin(b) - getMin(a);
        if (sortState.mode === 'maxDesc') return getMax(b) - getMax(a);
        return getMax(a) - getMax(b);
      });
      return rows;
    }
    return rows;
  }, [actionPriceRangeFilter.max, actionPriceRangeFilter.min, deletedVariantIds, filteredFamilies, priceRangeFilter.max, priceRangeFilter.min, sortState, variantCountRange.max, variantCountRange.min]);

  const hasExportSelection = selectedFamilyIds.size > 0 || selectedVariantIds.size > 0;

  const exportRows = useMemo(() => {
    const selectedRows = filteredRows.flatMap((row) => {
      if (selectedFamilyIds.has(row.family.id)) {
        return row.visibleVariants.map((variant) => ({ family: row.family, variant }));
      }
      return row.visibleVariants
        .filter((variant) => selectedVariantIds.has(variant.id))
        .map((variant) => ({ family: row.family, variant }));
    });

    if (hasExportSelection) return selectedRows;

    return filteredRows.flatMap((row) => row.visibleVariants.map((variant) => ({ family: row.family, variant })));
  }, [filteredRows, hasExportSelection, selectedFamilyIds, selectedVariantIds]);

  const paginationTotal = filteredRows.length;
  const { page, pageSize, pageCount, setPage, setPageSize } = useTablePagination({
    totalCount: paginationTotal,
    storageKey: 'adminArtikli.families.pageSize',
    defaultPageSize: 20,
    pageSizeOptions: PAGE_SIZE_OPTIONS
  });

  const pagedFamilies = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredRows.slice(start, start + pageSize);
  }, [filteredRows, page, pageSize]);

  useEffect(() => {
    setPage(1);
  }, [actionPriceRangeFilter.max, actionPriceRangeFilter.min, categoryFilter, discountFilter, noteFilter, priceRangeFilter.max, priceRangeFilter.min, search, setPage, statusFilter, variantCountRange.max, variantCountRange.min]);

  const exportVariantsCsv = () => {
    const headers = ['Družina', 'Različica', 'SKU', 'Cena', 'Popust', 'Akcijska cena', 'Zaloga', 'Status'];
    const csvRows = exportRows.map(({ family, variant }) => [
      family.name,
      variant.label,
      variant.sku,
      variant.price.toFixed(2),
      `${variant.discountPct}`,
      `${computeSalePrice(variant.price, variant.discountPct).toFixed(2)}`,
      `${variant.stock}`,
      itemStatusLabel(variant.active)
    ]);

    if (csvRows.length === 0) {
      toast.info('Ni artiklov za izvoz glede na trenutno izbiro.');
      return;
    }

    const csv = [headers, ...csvRows].map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\r\n');
    const blob = new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'artikli-razlicice.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleArchiveSelected = () => {
    if (!hasSelectedArchiveFamilies || isArchivingSelected) return;
    setArchiveDialogFamilyIds(null);
    setIsBulkArchiveDialogOpen(true);
  };

  const confirmArchiveSelected = async () => {
    if (archiveDialogCount === 0) {
      setIsBulkArchiveDialogOpen(false);
      setArchiveDialogFamilyIds(null);
      return;
    }

    setIsBulkArchiveDialogOpen(false);
    setIsArchivingSelected(true);

    const archivedFamilyIds = new Set<string>();
    const archivedVariantIds = new Set<string>();
    const failedFamilies: string[] = [];

    try {
      for (const family of archiveDialogFamilies) {
        const itemIdentifier = family.slug.trim();
        if (!itemIdentifier) {
          failedFamilies.push(family.name);
          continue;
        }

        const previousArchiveItems = readArchivedItemStorage();
        writeArchivedItemStorage([
          buildArchiveRecordForFamily(family),
          ...previousArchiveItems.filter((item) => String(item.id ?? '') !== itemIdentifier)
        ]);

        try {
          const response = await fetch(`/api/admin/artikli/${encodeURIComponent(itemIdentifier)}`, { method: 'DELETE' });
          if (!response.ok) {
            const body = (await response.json().catch(() => ({}))) as { message?: string };
            throw new Error(body.message || 'Arhiviranje artikla ni uspelo.');
          }

          archivedFamilyIds.add(family.id);
          family.variants.forEach((variant) => archivedVariantIds.add(variant.id));
        } catch {
          writeArchivedItemStorage(previousArchiveItems);
          failedFamilies.push(family.name);
        }
      }

      if (archivedFamilyIds.size > 0) {
        setSelectedFamilyIds((current) => {
          const next = new Set(current);
          archivedFamilyIds.forEach((id) => next.delete(id));
          return next;
        });
        setSelectedVariantIds((current) => {
          const next = new Set(current);
          archivedVariantIds.forEach((id) => next.delete(id));
          return next;
        });
        setExpandedFamilyIds((current) => {
          const next = new Set(current);
          archivedFamilyIds.forEach((id) => next.delete(id));
          return next;
        });
      }

      if (archivedFamilyIds.size > 0 && failedFamilies.length === 0) {
        toast.success(archivedFamilyIds.size === 1 ? 'Artikel je arhiviran.' : `Arhiviranih artiklov: ${archivedFamilyIds.size}.`);
        router.push('/admin/arhiv/artikli');
        router.refresh();
        return;
      }

      if (archivedFamilyIds.size > 0) {
        toast.success(`Arhiviranih artiklov: ${archivedFamilyIds.size}.`);
        router.refresh();
      }

      if (failedFamilies.length > 0) {
        toast.error(
          failedFamilies.length === 1
            ? `Arhiviranje ni uspelo za artikel ${failedFamilies[0]}.`
            : `Arhiviranje ni uspelo za ${failedFamilies.length} artiklov.`
        );
      }
    } finally {
      setArchiveDialogFamilyIds(null);
      setIsArchivingSelected(false);
    }
  };

  const allVisibleFamilyIds = useMemo(() => new Set(pagedFamilies.map((row) => row.family.id)), [pagedFamilies]);
  const familiesSelectedOnPage = pagedFamilies.length > 0 && pagedFamilies.every((row) => selectedFamilyIds.has(row.family.id));
  const applySavedFamilyRow = (item: AdminCatalogListItem) => {
    const [nextFamily] = toListFamilies([item]);
    if (!nextFamily) return;
    setSavedFamilyRows((current) => ({ ...current, [nextFamily.id]: nextFamily }));
  };
  const getItemEditHref = (family: ListFamily) => `/admin/artikli/${encodeURIComponent(family.slug || family.id)}`;
  const getItemEditHrefFromItem = (item: AdminCatalogListItem) => `/admin/artikli/${encodeURIComponent(item.slug || String(item.id))}`;
  const showDuplicateToast = (items: AdminCatalogListItem[]) => {
    const firstItem = items[0];
    if (!firstItem) return;
    const href = getItemEditHrefFromItem(firstItem);
    toast.success(
      <span>
        {items.length === 1 ? 'Kopija artikla je ustvarjena.' : `Ustvarjenih kopij: ${items.length}.`}{' '}
        <a className="font-semibold underline underline-offset-2" href={href}>
          {items.length === 1 ? 'Uredi kopijo' : 'Uredi prvo kopijo'}
        </a>
      </span>,
      { durationMs: 7000 }
    );
  };
  const addDuplicatedFamilyRows = (pairs: Array<{ sourceId: string; item: AdminCatalogListItem }>) => {
    const sourceBaseIds = new Set(families.map((family) => family.id));
    setDuplicatedFamilyRows((current) => {
      const next = Object.fromEntries(Object.entries(current).map(([sourceId, rows]) => [sourceId, [...rows]])) as Record<string, ListFamily[]>;

      pairs.forEach(({ sourceId, item }) => {
        const [nextFamily] = toListFamilies([item]);
        if (!nextFamily) return;

        if (sourceBaseIds.has(sourceId)) {
          const currentRows = next[sourceId] ?? [];
          next[sourceId] = [nextFamily, ...currentRows.filter((row) => row.id !== nextFamily.id)];
          return;
        }

        const parentEntry = Object.entries(next).find(([, rows]) => rows.some((row) => row.id === sourceId));
        if (!parentEntry) return;

        const [parentSourceId, rows] = parentEntry;
        const sourceIndex = rows.findIndex((row) => row.id === sourceId);
        const withoutDuplicate = rows.filter((row) => row.id !== nextFamily.id);
        withoutDuplicate.splice(Math.max(0, sourceIndex + 1), 0, nextFamily);
        next[parentSourceId] = withoutDuplicate;
      });

      return next;
    });
  };
  const duplicateSelectedItems = async () => {
    if (!hasSelectedArchiveFamilies || isDuplicatingSelected) return;

    setIsDuplicatingSelected(true);
    try {
      const duplicatedPairs: Array<{ sourceId: string; item: AdminCatalogListItem }> = [];

      for (const family of selectedArchiveFamilies) {
        const itemIdentifier = family.slug.trim();
        if (!itemIdentifier) throw new Error(`Artikel ${family.name} nima veljavnega identifikatorja.`);

        const response = await fetch('/api/admin/artikli/duplicate', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ itemIdentifier })
        });
        const body = (await response.json().catch(() => ({}))) as { item?: AdminCatalogListItem; message?: string };
        if (!response.ok || !body.item) throw new Error(body.message || 'Kopiranje artikla ni uspelo.');
        duplicatedPairs.push({ sourceId: family.id, item: body.item });
      }

      addDuplicatedFamilyRows(duplicatedPairs);
      showDuplicateToast(duplicatedPairs.map((pair) => pair.item));
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Kopiranje artikla ni uspelo.');
    } finally {
      setIsDuplicatingSelected(false);
    }
  };
  const getVariantDraftForState = useCallback(
    (variant: Variant, sourceDrafts: Record<string, VariantDraft>) => sourceDrafts[variant.id] ?? createVariantDraft(variant),
    []
  );
  const getEditableVariantsForFamily = useCallback(
    (family: ListFamily) => family.variants.filter((variant) => !deletedVariantIds.has(variant.id)),
    [deletedVariantIds]
  );
  const getScopeVariants = useCallback(
    (scope: ActiveEditScope | null, family: ListFamily | null) => {
      if (!scope || !family) return [];
      const variants = getEditableVariantsForFamily(family);
      return scope.kind === 'group' ? variants : variants.slice(0, 1);
    },
    [getEditableVariantsForFamily]
  );
  const resolveScopeKind = (variants: Variant[]): EditScopeKind => (variants.length > 1 ? 'group' : 'row');
  const clearNumericDraftKeys = useCallback((keys: string[]) =>
    setNumericDrafts((current) => {
      if (keys.length === 0) return current;
      const next = { ...current };
      keys.forEach((key) => {
        delete next[key];
      });
      return next;
    }), []);
  const updateNumericDraft = (scope: NumericDraftScope, id: string, field: NumericDraftField, raw: string) => {
    if (!isDecimalInputDraft(raw)) return;
    const key = numericDraftKey(scope, id, field);
    setNumericDrafts((current) => ({ ...current, [key]: raw }));
  };
  const resolvePendingNumericDraftsForFamily = useCallback((
    familyId: string,
    variants: Variant[],
    sourceVariantDrafts = variantDrafts,
    sourceNumericDrafts = numericDrafts
  ) => {
    let nextVariantDrafts = { ...sourceVariantDrafts };
    const consumedKeys: string[] = [];
    const fields: NumericDraftField[] = ['price', 'discountPct', 'salePrice'];

    for (const field of fields) {
      const familyKey = numericDraftKey('family', familyId, field);
      const raw = sourceNumericDrafts[familyKey];
      if (raw === undefined) continue;

      for (const variant of variants) {
        const result = applyNumericFieldToVariantDraft(getVariantDraftForState(variant, nextVariantDrafts), field, raw);
        if ('error' in result && result.error) return { error: result.error };
        nextVariantDrafts[variant.id] = result.nextDraft;
      }

      consumedKeys.push(familyKey);
    }

    for (const variant of variants) {
      for (const field of fields) {
        const variantKey = numericDraftKey('variant', variant.id, field);
        const raw = sourceNumericDrafts[variantKey];
        if (raw === undefined) continue;

        const result = applyNumericFieldToVariantDraft(getVariantDraftForState(variant, nextVariantDrafts), field, raw);
        if ('error' in result && result.error) return { error: result.error };
        nextVariantDrafts[variant.id] = result.nextDraft;
        consumedKeys.push(variantKey);
      }
    }

    return { nextVariantDrafts, consumedKeys };
  }, [getVariantDraftForState, numericDrafts, variantDrafts]);
  const commitPendingNumericDraftsForFamily = useCallback((familyId: string, variants: Variant[]) => {
    const resolved = resolvePendingNumericDraftsForFamily(familyId, variants);
    if ('error' in resolved && resolved.error) {
      toast.error(resolved.error);
      return null;
    }
    const nextVariantDrafts = resolved.nextVariantDrafts ?? variantDrafts;
    const consumedKeys = resolved.consumedKeys ?? [];
    if (consumedKeys.length > 0) {
      setVariantDrafts(nextVariantDrafts);
      clearNumericDraftKeys(consumedKeys);
    }
    return nextVariantDrafts;
  }, [clearNumericDraftKeys, resolvePendingNumericDraftsForFamily, toast, variantDrafts]);
  const commitVariantNumericDraft = (variant: Variant, field: NumericDraftField) => {
    const key = numericDraftKey('variant', variant.id, field);
    const raw = numericDrafts[key];
    if (raw === undefined) return;

    const result = applyNumericFieldToVariantDraft(getVariantDraftForState(variant, variantDrafts), field, raw);
    if ('error' in result && result.error) return;

    setVariantDrafts((current) => ({
      ...current,
      [variant.id]: result.nextDraft
    }));
    clearNumericDraftKeys([key]);
  };
  const commitFamilyNumericDraft = (familyId: string, variants: Variant[], field: NumericDraftField) => {
    const key = numericDraftKey('family', familyId, field);
    const raw = numericDrafts[key];
    if (raw === undefined) return;

    const nextVariantDrafts = { ...variantDrafts };
    for (const variant of variants) {
      const result = applyNumericFieldToVariantDraft(getVariantDraftForState(variant, nextVariantDrafts), field, raw);
      if ('error' in result && result.error) return;
      nextVariantDrafts[variant.id] = result.nextDraft;
    }

    setVariantDrafts(nextVariantDrafts);
    clearNumericDraftKeys([key]);
  };
  const readVariantNumericInputValue = (variant: Variant, draft: VariantDraft, field: NumericDraftField) => {
    const raw = numericDrafts[numericDraftKey('variant', variant.id, field)];
    if (raw !== undefined) return raw;
    if (field === 'price') return formatDecimalForDisplay(draft.price);
    if (field === 'discountPct') return formatDecimalForDisplay(draft.discountPct);
    const salePrice = getVariantSalePrice(draft);
    return salePrice === null ? '' : formatDecimalForDisplay(salePrice);
  };
  const readFamilyNumericInputValue = (familyId: string, variants: Variant[], field: NumericDraftField) => {
    const raw = numericDrafts[numericDraftKey('family', familyId, field)];
    if (raw !== undefined) return raw;

    if (field === 'price') {
      const uniformPrice = getUniformNumber(variants.map((variant) => getVariantDraftForState(variant, variantDrafts).price));
      return uniformPrice === null ? '' : formatDecimalForDisplay(uniformPrice);
    }
    if (field === 'discountPct') {
      const uniformDiscount = getUniformNumber(variants.map((variant) => getVariantDraftForState(variant, variantDrafts).discountPct));
      return uniformDiscount === null ? '' : formatDecimalForDisplay(uniformDiscount);
    }

    const salePrices = variants.map((variant) => getVariantSalePrice(getVariantDraftForState(variant, variantDrafts)));
    if (salePrices.some((value) => value === null)) {
      return salePrices.every((value) => value === null) ? '' : '';
    }

    const uniformSalePrice = getUniformNumber(salePrices as number[]);
    return uniformSalePrice === null ? '' : formatDecimalForDisplay(uniformSalePrice);
  };
  const getFamilyNumericInputPlaceholder = (variants: Variant[], field: NumericDraftField) => {
    const drafts = variants.map((variant) => getVariantDraftForState(variant, variantDrafts));
    if (field === 'price') return formatAmountRangeForInput(drafts.map((draft) => draft.price));
    if (field === 'discountPct') return formatPercentRangeForInput(drafts.map((draft) => draft.discountPct));
    const salePrices = drafts.map((draft) => getVariantSalePrice(draft)).filter((value): value is number => value !== null);
    return formatAmountRangeForInput(salePrices);
  };
  const getScopeNumericDraftKeys = useCallback((scope: ActiveEditScope | null, family: ListFamily | null) => {
    if (!scope || !family) return [];
    const variants = getScopeVariants(scope, family);
    return [
      ...(['price', 'discountPct', 'salePrice'] as NumericDraftField[]).map((field) => numericDraftKey('family', family.id, field)),
      ...variants.flatMap((variant) =>
        (['price', 'discountPct', 'salePrice'] as NumericDraftField[]).map((field) => numericDraftKey('variant', variant.id, field))
      )
    ];
  }, [getScopeVariants]);
  const effectiveFamiliesById = useMemo(
    () => new Map(effectiveFamilies.map((family) => [family.id, family])),
    [effectiveFamilies]
  );
  const activeScopeFamily = useMemo(
    () => (activeEditScope ? effectiveFamiliesById.get(activeEditScope.familyId) ?? null : null),
    [activeEditScope, effectiveFamiliesById]
  );
  const resolveEditScopeSnapshot = useCallback(
    (
      scope: ActiveEditScope | null,
      family: ListFamily | null,
      sourceFamilyDrafts = familyDrafts,
      sourceVariantDrafts = variantDrafts,
      sourceNumericDrafts = numericDrafts
    ) => {
      if (!scope || !family) return null;

      const variants = getScopeVariants(scope, family);
      const familyDraft = getFamilyDraftForState(family, sourceFamilyDrafts);
      const resolvedDraftsResult = resolvePendingNumericDraftsForFamily(
        family.id,
        variants,
        sourceVariantDrafts,
        sourceNumericDrafts
      );
      const validationMessages: string[] = [];
      const resolvedVariantDrafts =
        'error' in resolvedDraftsResult && resolvedDraftsResult.error
          ? sourceVariantDrafts
          : resolvedDraftsResult.nextVariantDrafts ?? sourceVariantDrafts;

      if ('error' in resolvedDraftsResult && resolvedDraftsResult.error) {
        validationMessages.push(resolvedDraftsResult.error);
      }
      if (familyDraft.name.trim().length === 0) {
        validationMessages.push('Ime artikla je obvezno.');
      }
      if (familyDraft.categoryPath.length === 0) {
        validationMessages.push('Kategorija je obvezna.');
      }

      const familyNameIssue = getFamilyNameIssue(effectiveFamilies, family.id, familyDraft.name);
      if (familyNameIssue) validationMessages.push(familyNameIssue.message);
      const familySkuIssue = getSkuIssue(effectiveFamilies, familyDraft.sku, { familyId: family.id });
      if (familySkuIssue) validationMessages.push(familySkuIssue.message);

      const familyPatchResult = buildFamilyPatch(family, familyDraft);
      const pendingVariantSkuValues = new Map<string, string>();
      const variantPatchResults = variants.map((variant) => {
        const draft = getVariantDraftForState(variant, resolvedVariantDrafts);
        if (draft.label.trim().length === 0) {
          validationMessages.push('Naziv različice je obvezen.');
        }
        const normalizedSku = normalizeIdentityComparisonValue(draft.sku);
        const duplicateVariantLabel = normalizedSku ? pendingVariantSkuValues.get(normalizedSku) : undefined;
        if (duplicateVariantLabel) {
          validationMessages.push(`SKU je že uporabljen (${duplicateVariantLabel}).`);
        } else if (normalizedSku) {
          pendingVariantSkuValues.set(normalizedSku, draft.label || variant.label || draft.sku);
        }
        const variantSkuIssue = getSkuIssue(effectiveFamilies, draft.sku, {
          familyId: family.id,
          variantId: variant.id,
          includeSameFamilyVariants: true
        });
        if (variantSkuIssue) validationMessages.push(variantSkuIssue.message);
        return {
          variant,
          draft,
          ...buildVariantPatch(variant, draft)
        };
      });

      const dirtyChangeCount =
        familyPatchResult.changeCount +
        variantPatchResults.reduce((sum, result) => sum + result.changeCount, 0);

      return {
        familyDraft,
        variants,
        familyPatchResult,
        variantPatchResults,
        dirtyChangeCount,
        isDirty: dirtyChangeCount > 0,
        isValid: validationMessages.length === 0,
        validationMessage: validationMessages[0] ?? null
      };
    },
    [effectiveFamilies, familyDrafts, getScopeVariants, getVariantDraftForState, numericDrafts, resolvePendingNumericDraftsForFamily, variantDrafts]
  );
  const activeEditSnapshot = useMemo(
    () => resolveEditScopeSnapshot(activeEditScope, activeScopeFamily),
    [activeEditScope, activeScopeFamily, resolveEditScopeSnapshot]
  );
  const clearActiveEditScopeState = useCallback(
    (scope: ActiveEditScope | null, family: ListFamily | null) => {
      if (!scope || !family) {
        setActiveEditScope(null);
        return;
      }

      const variantIds = getScopeVariants(scope, family).map((variant) => variant.id);
      setFamilyDrafts((current) => {
        if (!(scope.familyId in current)) return current;
        const next = { ...current };
        delete next[scope.familyId];
        return next;
      });
      setVariantDrafts((current) => {
        if (variantIds.length === 0) return current;
        const next = { ...current };
        variantIds.forEach((variantId) => {
          delete next[variantId];
        });
        return next;
      });
      clearNumericDraftKeys(getScopeNumericDraftKeys(scope, family));
      setActiveEditScope(null);
      if (scope.kind === 'group' && scope.restoreExpandedOnExit) {
        setExpandedFamilyIds((current) => {
          const next = new Set(current);
          next.delete(scope.familyId);
          return next;
        });
      }
    },
    [clearNumericDraftKeys, getScopeNumericDraftKeys, getScopeVariants]
  );
  const cancelCurrentEditScope = useCallback(() => {
    clearActiveEditScopeState(activeEditScope, activeScopeFamily);
  }, [activeEditScope, activeScopeFamily, clearActiveEditScopeState]);
  const saveCurrentEditScope = useCallback(async () => {
    if (!activeEditScope || !activeScopeFamily) return true;

    const snapshot = resolveEditScopeSnapshot(activeEditScope, activeScopeFamily);
    if (!snapshot) return true;
    if (!snapshot.isDirty) {
      clearActiveEditScopeState(activeEditScope, activeScopeFamily);
      return true;
    }
    if (!snapshot.isValid) {
      toast.error(snapshot.validationMessage || 'Preverite vnose pred shranjevanjem.');
      return false;
    }
    if (!activeScopeFamily.slug) {
      toast.error('Artikel nima veljavnega identifikatorja (slug).');
      return false;
    }

    setIsSavingActiveScope(true);

    try {
      const committedVariantDrafts = commitPendingNumericDraftsForFamily(activeScopeFamily.id, snapshot.variants);
      if (!committedVariantDrafts) return false;

      const familyPatchResult = buildFamilyPatch(activeScopeFamily, snapshot.familyDraft);
      let latestSavedItem: AdminCatalogListItem | null = null;

      if (familyPatchResult.changeCount > 0) {
        const response = await fetch('/api/admin/artikli/quick-save/item', {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            itemIdentifier: activeScopeFamily.slug,
            patch: familyPatchResult.patch
          })
        });
        const body = (await response.json().catch(() => ({}))) as { item?: AdminCatalogListItem; message?: string };
        if (!response.ok || !body.item) throw new Error(body.message || 'Shranjevanje artikla ni uspelo.');
        latestSavedItem = body.item;
      }

      for (const { variant, patch, changeCount } of snapshot.variantPatchResults) {
        if (changeCount === 0) continue;

        const variantResponse = await fetch('/api/admin/artikli/quick-save/variant', {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            itemIdentifier: activeScopeFamily.slug,
            variantId: Number(variant.id),
            patch
          })
        });
        const variantBody = (await variantResponse.json().catch(() => ({}))) as { item?: AdminCatalogListItem; message?: string };
        if (!variantResponse.ok || !variantBody.item) {
          throw new Error(variantBody.message || 'Shranjevanje različice ni uspelo.');
        }
        latestSavedItem = variantBody.item;
      }

      if (latestSavedItem) {
        applySavedFamilyRow(latestSavedItem);
        toast.success('Shranjeno');
      }

      clearActiveEditScopeState(activeEditScope, activeScopeFamily);
      router.refresh();
      return true;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Shranjevanje ni uspelo.');
      return false;
    } finally {
      setIsSavingActiveScope(false);
    }
  }, [activeEditScope, activeScopeFamily, clearActiveEditScopeState, commitPendingNumericDraftsForFamily, resolveEditScopeSnapshot, router, toast]);
  const resolvePendingGuardAction = useCallback(() => {
    const action = pendingGuardActionRef.current;
    pendingGuardActionRef.current = null;
    setPendingGuardLabel(null);
    action?.run();
  }, []);
  const requestCurrentEditResolution = useCallback((label: string, run: () => void) => {
    if (!activeEditScope || !activeScopeFamily) {
      run();
      return;
    }

    if (!activeEditSnapshot?.isDirty) {
      clearActiveEditScopeState(activeEditScope, activeScopeFamily);
      run();
      return;
    }

    pendingGuardActionRef.current = { label, run };
    setPendingGuardLabel(label);
  }, [activeEditScope, activeScopeFamily, activeEditSnapshot?.isDirty, clearActiveEditScopeState]);
  const beginFamilyEditScope = useCallback((family: ListFamily) => {
    const allVariants = getEditableVariantsForFamily(family);
    const nextKind = resolveScopeKind(allVariants);
    const nextScope: ActiveEditScope = {
      familyId: family.id,
      kind: nextKind,
      restoreExpandedOnExit: nextKind === 'group' ? !expandedFamilyIds.has(family.id) : false
    };
    const scopedVariants = nextKind === 'group' ? allVariants : allVariants.slice(0, 1);

    const beginEdit = () => {
      setActiveEditScope(nextScope);
      if (nextKind === 'group') {
        setExpandedFamilyIds((current) => {
          const next = new Set(current);
          next.add(family.id);
          return next;
        });
      }
      setVariantDrafts((current) => {
        const next = { ...current };
        scopedVariants.forEach((variant) => {
          next[variant.id] = createVariantDraft(variant);
        });
        return next;
      });
      clearNumericDraftKeys([
        ...(['price', 'discountPct', 'salePrice'] as NumericDraftField[]).map((field) => numericDraftKey('family', family.id, field)),
        ...scopedVariants.flatMap((variant) =>
          (['price', 'discountPct', 'salePrice'] as NumericDraftField[]).map((field) => numericDraftKey('variant', variant.id, field))
        )
      ]);
      setFamilyDrafts((current) => ({
        ...current,
        [family.id]: createFamilyDraft(family)
      }));
    };

    if (activeEditScope?.familyId === family.id && activeEditScope.kind === nextScope.kind) return;
    requestCurrentEditResolution(`začetkom urejanja artikla ${family.name}`, beginEdit);
  }, [activeEditScope, clearNumericDraftKeys, expandedFamilyIds, getEditableVariantsForFamily, requestCurrentEditResolution]);
  const updateFamilyDraft = (familyId: string, fallbackDraft: FamilyDraft, mutate: (draft: FamilyDraft) => FamilyDraft) =>
    setFamilyDrafts((current) => {
      const draft = current[familyId] ?? fallbackDraft;
      return { ...current, [familyId]: mutate(draft) };
    });
  const updateSelectedPillTargets = (
    label: string,
    patch: Record<string, unknown>,
    targets?: { familyIds?: string[]; variantIds?: string[] }
  ) => {
    requestCurrentEditResolution(label, () => {
      void (async () => {
        const familyIds = targets?.familyIds ?? Array.from(selectedFamilyIds);
        const variantIds = targets?.variantIds ?? Array.from(selectedVariantIds);
        if (familyIds.length + variantIds.length === 0) return;

        setIsSelectedPillUpdating(true);
        try {
          const tasks: Array<Promise<AdminCatalogListItem>> = [];

          familyIds.forEach((familyId) => {
            const family = familyById.get(familyId);
            if (!family?.slug) throw new Error('Artikel nima veljavnega identifikatorja (slug).');
            tasks.push(
              fetch('/api/admin/artikli/quick-save/item', {
                method: 'PATCH',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({
                  itemIdentifier: family.slug,
                  patch
                })
              }).then(async (response) => {
                const body = (await response.json().catch(() => ({}))) as { item?: AdminCatalogListItem; message?: string };
                if (!response.ok || !body.item) throw new Error(body.message || 'Shranjevanje artikla ni uspelo.');
                return body.item;
              })
            );
          });

          variantIds.forEach((variantId) => {
            const target = variantTargetById.get(variantId);
            if (!target?.family.slug) throw new Error('Artikel nima veljavnega identifikatorja (slug).');
            tasks.push(
              fetch('/api/admin/artikli/quick-save/variant', {
                method: 'PATCH',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({
                  itemIdentifier: target.family.slug,
                  variantId: Number(target.variant.id),
                  patch
                })
              }).then(async (response) => {
                const body = (await response.json().catch(() => ({}))) as { item?: AdminCatalogListItem; message?: string };
                if (!response.ok || !body.item) throw new Error(body.message || 'Shranjevanje različice ni uspelo.');
                return body.item;
              })
            );
          });

          const savedItems = await Promise.all(tasks);
          savedItems.forEach(applySavedFamilyRow);
          setIsStatusBulkMenuOpen(false);
          setIsNoteBulkMenuOpen(false);
          toast.success('Shranjeno');
          router.refresh();
        } catch (error) {
          toast.error(error instanceof Error ? error.message : 'Shranjevanje ni uspelo.');
        } finally {
          setIsSelectedPillUpdating(false);
        }
      })();
    });
  };
  const handleSelectedStatusUpdate = (nextActive: boolean, targets?: { familyIds?: string[]; variantIds?: string[] }) =>
    updateSelectedPillTargets(
      nextActive ? 'množičnim nastavljanjem statusa na aktiven' : 'množičnim nastavljanjem statusa na neaktiven',
      { status: nextActive ? 'active' : 'inactive' },
      targets
    );
  const handleSelectedNoteUpdate = (nextNote: NoteTag, targets?: { familyIds?: string[]; variantIds?: string[] }) =>
    updateSelectedPillTargets(
      `množičnim nastavljanjem opombe ${noteValueLabel(nextNote)}`,
      { badge: nextNote || null },
      targets
    );
  const getSortTitleClass = (column: 'article' | 'sku' | 'category' | 'variantCount' | 'discount' | 'priceRange' | 'actionPriceRange' | 'status' | 'note') =>
    `inline-flex items-center text-[12px] font-semibold leading-none text-slate-900 hover:text-[#1982bf] ${
      sortState && 'column' in sortState && sortState.column === column ? 'underline underline-offset-2 text-[#1982bf]' : ''
    }`;
  const cycleSort = (column: 'article' | 'sku' | 'category' | 'variantCount' | 'discount' | 'priceRange' | 'actionPriceRange' | 'status' | 'note') => {
    requestCurrentEditResolution(`razvrščanjem po stolpcu ${column}`, () => {
      setSortState((current) => {
        if (column === 'article' || column === 'sku' || column === 'category') {
          if (!current || !('column' in current) || current.column !== column) return { column, direction: 'asc' };
          if ('direction' in current && current.direction === 'asc') return { column, direction: 'desc' };
          return null;
        }
        if (column === 'variantCount' || column === 'discount' || column === 'status' || column === 'note') {
          if (!current || !('column' in current) || current.column !== column) return { column, direction: 'desc' };
          if ('direction' in current && current.direction === 'desc') return { column, direction: 'asc' };
          return null;
        }
        if (column === 'priceRange' || column === 'actionPriceRange') {
          if (!current || !('column' in current) || current.column !== column) return { column, mode: 'minAsc' };
          if ('mode' in current && current.mode === 'minAsc') return { column, mode: 'minDesc' };
          if ('mode' in current && current.mode === 'minDesc') return { column, mode: 'maxDesc' };
          if ('mode' in current && current.mode === 'maxDesc') return { column, mode: 'maxAsc' };
          return null;
        }
        return current;
      });
    });
  };
  const setFamilyExpanded = useCallback((familyId: string, expanded: boolean) => {
    setExpandedFamilyIds((current) => {
      const next = new Set(current);
      if (expanded) next.add(familyId);
      else next.delete(familyId);
      return next;
    });
  }, []);
  const handleGuardDialogCancel = () => {
    pendingGuardActionRef.current = null;
    setPendingGuardLabel(null);
  };
  const handleGuardDialogDiscard = () => {
    const action = pendingGuardActionRef.current;
    pendingGuardActionRef.current = null;
    setPendingGuardLabel(null);
    clearActiveEditScopeState(activeEditScope, activeScopeFamily);
    action?.run();
  };
  const handleGuardDialogSave = async () => {
    const saved = await saveCurrentEditScope();
    if (!saved) return;
    resolvePendingGuardAction();
  };

  useEffect(() => {
    if (!activeEditSnapshot?.isDirty) return;

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [activeEditSnapshot?.isDirty]);

  useEffect(() => {
    if (!activeEditSnapshot?.isDirty) return;

    const handleDocumentClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      const target = event.target as HTMLElement | null;
      const anchor = target?.closest('a[href]') as HTMLAnchorElement | null;
      if (!anchor) return;
      if (anchor.hasAttribute('download')) return;
      if (anchor.target && anchor.target !== '_self') return;

      const url = new URL(anchor.href, window.location.href);
      const currentUrl = new URL(window.location.href);
      if (url.origin !== currentUrl.origin) return;
      if (url.pathname === currentUrl.pathname && url.search === currentUrl.search && url.hash === currentUrl.hash) return;

      event.preventDefault();
      event.stopPropagation();
      requestCurrentEditResolution('zapustitvijo strani', () => {
        router.push(`${url.pathname}${url.search}${url.hash}`);
      });
    };

    document.addEventListener('click', handleDocumentClick, true);
    return () => {
      document.removeEventListener('click', handleDocumentClick, true);
    };
  }, [activeEditSnapshot?.isDirty, requestCurrentEditResolution, router]);

  useEffect(() => {
    if (!activeEditScope || pendingGuardLabel) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      const target = event.target as HTMLElement | null;
      if (!target?.closest(`[data-edit-scope="family:${activeEditScope.familyId}"]`)) return;
      if (target.closest(EDIT_SHORTCUT_IGNORE_SELECTOR)) return;

      const tagName = target.tagName.toLowerCase();
      if (event.key === 'Escape') {
        event.preventDefault();
        cancelCurrentEditScope();
        return;
      }

      if (event.key !== 'Enter' || tagName === 'button' || tagName === 'textarea') return;

      const input = target as HTMLInputElement;
      if (input.type === 'search') return;

      event.preventDefault();
      void saveCurrentEditScope();
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [activeEditScope, cancelCurrentEditScope, pendingGuardLabel, saveCurrentEditScope]);

  useHeaderFilterDismiss({
    isOpen: Boolean(openFilter),
    onClose: () => setOpenFilter(null)
  });

  const handlePageChange = (nextPage: number) =>
    requestCurrentEditResolution('menjavo strani', () => setPage(nextPage));
  const handlePageSizeChange = (nextPageSize: number) =>
    requestCurrentEditResolution('spremembo števila vrstic na stran', () => setPageSize(nextPageSize));
  const handleSearchInputChange = (nextValue: string) =>
    requestCurrentEditResolution('iskanjem po artiklih', () => setSearch(nextValue));
  const handleCreateItemNavigation = () =>
    requestCurrentEditResolution('odhodom na ustvarjanje novega artikla', () => router.push('/admin/artikli/nov'));
  const handleDuplicateSelectionAction = () =>
    requestCurrentEditResolution('podvajanjem izbranih artiklov', () => {
      void duplicateSelectedItems();
    });
  const handleArchiveSelectionAction = () =>
    requestCurrentEditResolution('arhiviranjem izbranih artiklov', handleArchiveSelected);
  const handleArchiveFamilyAction = (family: ListFamily) =>
    requestCurrentEditResolution(`arhiviranjem artikla ${family.name}`, () => {
      if (isArchivingSelected) return;
      setArchiveDialogFamilyIds(new Set([family.id]));
      setIsBulkArchiveDialogOpen(true);
    });
  const isMatchingHoveredCell = (column: HighlightableArticleColumn, value: string) =>
    hoveredCellMatch?.column === column && hoveredCellMatch.value === getComparableArticleCellValue(value);
  const getMatchingValueClassName = (column: HighlightableArticleColumn, value: string) =>
    isMatchingHoveredCell(column, value) ? MATCHING_VALUE_HIGHLIGHT_CLASS : '';
  const setHoveredArticleCell = (column: HighlightableArticleColumn, value: string) =>
    setHoveredCellMatch({ column, value: getComparableArticleCellValue(value) });

  return (
    <div className="space-y-4 font-['Inter',system-ui,sans-serif]">
      {isBulkArchiveDialogOpen ? (
        <LazyConfirmDialog
          open={isBulkArchiveDialogOpen}
          title={archiveDialogCount === 1 ? 'Arhiviranje artikla' : 'Arhiviranje artiklov'}
          description={
            archiveDialogCount === 1
              ? 'Ali želite arhivirati izbrani artikel?'
              : `Ali želite arhivirati ${archiveDialogCount} izbranih artiklov?`
          }
          confirmLabel="Arhiviraj"
          cancelLabel="Prekliči"
          onCancel={() => {
            setIsBulkArchiveDialogOpen(false);
            setArchiveDialogFamilyIds(null);
          }}
          onConfirm={() => {
            void confirmArchiveSelected();
          }}
          confirmDisabled={isArchivingSelected}
        />
      ) : null}
      {pendingGuardLabel ? (
        <UnsavedChangesDialog
          open
          label={pendingGuardArticleTitle ? 'začetkom urejanja artikla' : pendingGuardLabel}
          itemTitle={pendingGuardArticleTitle}
          isSaving={isSavingActiveScope}
          saveDisabled={!activeEditSnapshot?.isDirty || !activeEditSnapshot.isValid}
          validationMessage={activeEditSnapshot?.validationMessage}
          onSave={() => {
            void handleGuardDialogSave();
          }}
          onContinueEditing={handleGuardDialogCancel}
          onDiscard={handleGuardDialogDiscard}
        />
      ) : null}
      <AdminTableLayout
        className={adminTableCardClassName}
        style={adminTableCardStyle}
        headerClassName={adminTableHeaderClassName}
        headerLeft={
          <div className={adminTableToolbarGroupClassName}>
            <AdminSearchInput
              value={search}
              onChange={(event) => handleSearchInputChange(event.target.value)}
              placeholder="Poišči artikel, SKU, kategorijo, status ali opombe ..."
              aria-label="Poišči artikel, SKU, kategorijo, status ali opombe"
              wrapperClassName={`${adminTableSearchWrapperClassName} sm:!flex-none sm:!w-[40%] sm:min-w-[20rem] sm:max-w-[30rem]`}
              inputClassName={adminTableSearchInputClassName}
              iconClassName={adminTableSearchIconClassName}
            />
          </div>
        }
        headerRight={
          <div className={adminTableToolbarActionsClassName}>
            <IconButton
              type="button"
              onClick={exportVariantsCsv}
              tone="neutral"
              size="sm"
              className={adminTableNeutralIconButtonClassName}
              aria-label={hasExportSelection ? 'Prenesi izbrane artikle' : 'Prenesi vse artikle'}
              title={hasExportSelection ? 'Prenesi izbrane' : 'Prenesi vse'}
            >
              <DownloadIcon className="!h-[18px] !w-[18px]" />
            </IconButton>
            <IconButton
              type="button"
              onClick={handleDuplicateSelectionAction}
              disabled={!hasSelectedArchiveFamilies || isDuplicatingSelected}
              tone="neutral"
              size="sm"
              className={adminTableNeutralIconButtonClassName}
              aria-label={
                hasSelectedArchiveFamilies
                  ? `Podvoji izbrane artikle (${selectedArchiveCount})`
                  : 'Podvoji izbrane artikle'
              }
              title="Podvoji"
            >
              {isDuplicatingSelected ? <Spinner size="sm" className="text-[#1982bf]" /> : <CopyIcon className="!h-[18px] !w-[18px]" />}
            </IconButton>
            <IconButton
              type="button"
              onClick={handleArchiveSelectionAction}
              disabled={!hasSelectedArchiveFamilies || isArchivingSelected}
              tone={hasSelectedArchiveFamilies ? 'warning' : 'neutral'}
              size="sm"
              className={hasSelectedArchiveFamilies ? adminTableSelectedWarningIconButtonClassName : `${adminTableNeutralIconButtonClassName} !transition-none`}
              aria-label={
                hasSelectedArchiveFamilies
                  ? `Arhiviraj izbrane artikle (${selectedArchiveCount})`
                  : 'Arhiviraj izbrane artikle'
              }
              title="Arhiviraj"
            >
              {isArchivingSelected ? <Spinner size="sm" className="text-amber-700" /> : <ArchiveIcon className="!h-[18px] !w-[18px]" />}
            </IconButton>
            <Button
              type="button"
              variant="primary"
              size="toolbar"
              className={adminTablePrimaryButtonClassName}
              aria-label="Nov artikel"
              onClick={handleCreateItemNavigation}
            >
              Nov artikel
            </Button>
          </div>
        }
        filterRowLeft={
          <div className="flex flex-wrap items-center gap-2">
            {categoryFilter !== 'all' ? (
              <span className={filterPillTokenClasses.base}>
                Kategorija: {categoryFilter}
                <button type="button" className={filterPillTokenClasses.clear} onClick={() => requestCurrentEditResolution('čiščenjem filtra kategorije', () => setCategoryFilter('all'))} aria-label="Počisti filter kategorije">
                  ×
                </button>
              </span>
            ) : null}
            {statusFilter !== 'all' ? (
              <span className={filterPillTokenClasses.base}>
                Status: {statusFilter === 'active' ? 'Aktiven' : 'Neaktiven'}
                <button type="button" className={filterPillTokenClasses.clear} onClick={() => requestCurrentEditResolution('čiščenjem filtra statusa', () => setStatusFilter('all'))} aria-label="Počisti filter statusa">
                  ×
                </button>
              </span>
            ) : null}
            {noteFilter !== 'all' ? (
              <span className={filterPillTokenClasses.base}>
                Opombe: {noteFilter === 'na-zalogi' ? 'Na zalogi' : noteFilter === 'novo' ? 'Novo' : noteFilter === 'akcija' ? 'V akciji' : noteFilter === 'zadnji-kosi' ? 'Zadnji kosi' : 'Ni na zalogi'}
                <button type="button" className={filterPillTokenClasses.clear} onClick={() => requestCurrentEditResolution('čiščenjem filtra opomb', () => setNoteFilter('all'))} aria-label="Počisti filter opomb">
                  ×
                </button>
              </span>
            ) : null}
            {discountFilter !== 'all' ? (
              <span className={filterPillTokenClasses.base}>
                Popust: {discountFilter === 'yes' ? 'Da' : 'Ne'}
                <button type="button" className={filterPillTokenClasses.clear} onClick={() => requestCurrentEditResolution('čiščenjem filtra popusta', () => setDiscountFilter('all'))} aria-label="Počisti filter popusta">
                  ×
                </button>
              </span>
            ) : null}
            {variantCountRange.min || variantCountRange.max ? (
              <span className={filterPillTokenClasses.base}>
                Št. različic: {variantCountRange.min || '0'}–{variantCountRange.max || '∞'}
                <button
                  type="button"
                  className={filterPillTokenClasses.clear}
                  onClick={() => requestCurrentEditResolution('čiščenjem filtra števila različic', () => {
                    setVariantCountRange({ min: '', max: '' });
                  })}
                  aria-label="Počisti filter Št. različic"
                >
                  ×
                </button>
              </span>
            ) : null}
            {priceRangeFilter.min || priceRangeFilter.max ? (
              <span className={filterPillTokenClasses.base}>
                Razpon cen: {priceRangeFilter.min || '0'}–{priceRangeFilter.max || '∞'}
                <button
                  type="button"
                  className={filterPillTokenClasses.clear}
                  onClick={() => requestCurrentEditResolution('čiščenjem filtra cene', () => {
                    setPriceRangeFilter({ min: '', max: '' });
                    setDraftPriceRangeFilter({ min: '', max: '' });
                  })}
                  aria-label="Počisti filter Razpon cen"
                >
                  ×
                </button>
              </span>
            ) : null}
            {actionPriceRangeFilter.min || actionPriceRangeFilter.max ? (
              <span className={filterPillTokenClasses.base}>
                Razpon akcijske cene: {actionPriceRangeFilter.min || '0'}–{actionPriceRangeFilter.max || '∞'}
                <button
                  type="button"
                  className={filterPillTokenClasses.clear}
                  onClick={() => requestCurrentEditResolution('čiščenjem filtra akcijske cene', () => {
                    setActionPriceRangeFilter({ min: '', max: '' });
                    setDraftActionPriceRangeFilter({ min: '', max: '' });
                  })}
                  aria-label="Počisti filter Razpon akcijske cene"
                >
                  ×
                </button>
              </span>
            ) : null}
          </div>
        }
        filterRowRight={<EuiTablePagination page={page} pageCount={pageCount} onPageChange={handlePageChange} itemsPerPage={pageSize} onChangeItemsPerPage={handlePageSizeChange} itemsPerPageOptions={PAGE_SIZE_OPTIONS} />}
        contentClassName="overflow-x-auto overflow-y-visible bg-white"
        footerRight={<EuiTablePagination page={page} pageCount={pageCount} onPageChange={handlePageChange} itemsPerPage={pageSize} onChangeItemsPerPage={handlePageSizeChange} itemsPerPageOptions={PAGE_SIZE_OPTIONS} />}
        showDivider={false}
      >
        <Table className="w-full table-fixed text-[12px] [&_thead_th]:!border-slate-200 [&_thead_th]:!py-4">
            <THead className="border-t border-slate-200">
              <TR>
                <TH className="w-10 px-2 text-center">
                  <AdminCheckbox
                    checked={familiesSelectedOnPage}
                    onChange={() =>
                      setSelectedFamilyIds((current) => {
                        const next = new Set(current);
                        if (familiesSelectedOnPage) allVisibleFamilyIds.forEach((id) => next.delete(id));
                        else allVisibleFamilyIds.forEach((id) => next.add(id));
                        return next;
                      })
                    }
                    aria-label="Izberi vse družine"
                  />
                </TH>
                <TH className={ARTICLE_COLUMN_CLASS}>
                  <button type="button" className={getSortTitleClass('article')} onClick={() => cycleSort('article')}>
                    Artikel
                  </button>
                </TH>
                <TH className="w-[13%]">
                  <button type="button" className={getSortTitleClass('sku')} onClick={() => cycleSort('sku')}>
                    SKU
                  </button>
                </TH>
                <TH className={CATEGORY_COLUMN_CLASS}>
                  <div className="relative inline-flex items-center gap-1" {...{ [HEADER_FILTER_ROOT_ATTR]: 'true' }}>
                    <button type="button" className={getSortTitleClass('category')} onClick={() => cycleSort('category')}>
                      Kategorija
                    </button>
                    <button
                      ref={categoryFilterButtonRef}
                      type="button"
                      className={HEADER_FILTER_BUTTON_CLASS}
                      onClick={(event) => {
                        event.stopPropagation();
                        requestCurrentEditResolution('filtriranjem kategorij', () => {
                          setOpenFilter((current) => (current === 'category' ? null : 'category'));
                        });
                      }}
                      aria-label="Filtriraj kategorijo"
                    >
                      <ColumnFilterIcon className="!h-[12px] !w-[12px]" />
                    </button>
                  </div>
                </TH>
                <TH className="w-[6.83%] text-right">
                  <div className="relative inline-flex items-center gap-1" {...{ [HEADER_FILTER_ROOT_ATTR]: 'true' }}>
                    <button type="button" className={getSortTitleClass('priceRange')} onClick={() => cycleSort('priceRange')}>
                      Cena
                    </button>
                    <button
                      ref={priceFilterButtonRef}
                      type="button"
                      className={HEADER_FILTER_BUTTON_CLASS}
                      onClick={(event) => {
                        event.stopPropagation();
                        requestCurrentEditResolution('filtriranjem cen', () => {
                          setDraftPriceRangeFilter(priceRangeFilter);
                          setOpenFilter((current) => (current === 'priceRange' ? null : 'priceRange'));
                        });
                      }}
                      aria-label="Filtriraj Cena"
                    >
                      <ColumnFilterIcon className="!h-[12px] !w-[12px]" />
                    </button>
                  </div>
                </TH>
                <TH className="w-[10.33%] whitespace-nowrap text-right">
                  <div className="relative inline-flex items-center gap-1" {...{ [HEADER_FILTER_ROOT_ATTR]: 'true' }}>
                    <button type="button" className={getSortTitleClass('discount')} onClick={() => cycleSort('discount')}>
                      Popust
                    </button>
                    <button
                      ref={discountFilterButtonRef}
                      type="button"
                      className={HEADER_FILTER_BUTTON_CLASS}
                      onClick={(event) => {
                        event.stopPropagation();
                        requestCurrentEditResolution('filtriranjem popustov', () => {
                          setOpenFilter((current) => (current === 'discount' ? null : 'discount'));
                        });
                      }}
                      aria-label="Filtriraj popust"
                    >
                      <ColumnFilterIcon className="!h-[12px] !w-[12px]" />
                    </button>
                  </div>
                </TH>
                <TH className="w-[10.33%] whitespace-nowrap text-right">
                  <div className="relative inline-flex items-center gap-1" {...{ [HEADER_FILTER_ROOT_ATTR]: 'true' }}>
                    <button type="button" className={getSortTitleClass('actionPriceRange')} onClick={() => cycleSort('actionPriceRange')}>
                      Akcijska cena
                    </button>
                    <button
                      ref={actionPriceFilterButtonRef}
                      type="button"
                      className={HEADER_FILTER_BUTTON_CLASS}
                      onClick={(event) => {
                        event.stopPropagation();
                        requestCurrentEditResolution('filtriranjem akcijskih cen', () => {
                          setDraftActionPriceRangeFilter(actionPriceRangeFilter);
                          setOpenFilter((current) => (current === 'actionPriceRange' ? null : 'actionPriceRange'));
                        });
                      }}
                      aria-label="Filtriraj Akcijska cena"
                    >
                      <ColumnFilterIcon className="!h-[12px] !w-[12px]" />
                    </button>
                  </div>
                </TH>
                <TH className={`${STATUS_COLUMN_CLASS} whitespace-nowrap px-0 text-center`}>
                  <div className="relative inline-flex h-11 items-center justify-center" ref={statusBulkMenuRef}>
                    {hasBulkSelectedPillTargets ? (
                      <>
                        <button
                          type="button"
                          className={adminTableBulkHeaderButtonClassName}
                          onClick={() => setIsStatusBulkMenuOpen((current) => !current)}
                          disabled={isSelectedPillUpdating}
                          aria-haspopup="menu"
                          aria-expanded={isStatusBulkMenuOpen}
                        >
                          Status ▾ ({selectedPillTargetCount})
                        </button>
                        {isStatusBulkMenuOpen ? (
                          <div role="menu">
                            <MenuPanel className="absolute left-1/2 top-8 z-20 w-36 -translate-x-1/2">
                              {ITEM_STATUS_BULK_OPTIONS.map((option) => (
                                <MenuItem
                                  key={String(option.value)}
                                  className={getActiveStateMenuItemClassName(option.value)}
                                  disabled={isSelectedPillUpdating}
                                  onClick={() => handleSelectedStatusUpdate(option.value)}
                                >
                                  {option.label}
                                </MenuItem>
                              ))}
                            </MenuPanel>
                          </div>
                        ) : null}
                      </>
                    ) : (
                      <div className="relative inline-flex items-center gap-1" {...{ [HEADER_FILTER_ROOT_ATTR]: 'true' }}>
                        <button type="button" className={getSortTitleClass('status')} onClick={() => cycleSort('status')}>
                          Status
                        </button>
                        <button
                          ref={statusFilterButtonRef}
                          type="button"
                          className={HEADER_FILTER_BUTTON_CLASS}
                          onClick={(event) => {
                            event.stopPropagation();
                            requestCurrentEditResolution('filtriranjem statusov', () => {
                              setOpenFilter((current) => (current === 'status' ? null : 'status'));
                            });
                          }}
                          aria-label="Filtriraj status"
                        >
                          <ColumnFilterIcon className="!h-[12px] !w-[12px]" />
                        </button>
                      </div>
                    )}
                  </div>
                </TH>
                <TH className={`${NOTE_COLUMN_CLASS} whitespace-nowrap px-0 text-center`}>
                  <div className="relative inline-flex h-11 items-center justify-center" ref={noteBulkMenuRef}>
                    {hasBulkSelectedPillTargets ? (
                      <>
                        <button
                          type="button"
                          className={adminTableBulkHeaderButtonClassName}
                          onClick={() => setIsNoteBulkMenuOpen((current) => !current)}
                          disabled={isSelectedPillUpdating}
                          aria-haspopup="menu"
                          aria-expanded={isNoteBulkMenuOpen}
                        >
                          Opombe ▾ ({selectedPillTargetCount})
                        </button>
                        {isNoteBulkMenuOpen ? (
                          <div role="menu">
                            <MenuPanel className="absolute left-1/2 top-8 z-20 w-44 -translate-x-1/2">
                              {ITEM_NOTE_BULK_OPTIONS.map((option) => (
                                <MenuItem
                                  key={option.value}
                                  className={getNoteTagMenuItemClassName(option.value)}
                                  disabled={isSelectedPillUpdating}
                                  onClick={() => handleSelectedNoteUpdate(option.value)}
                                >
                                  {option.label}
                                </MenuItem>
                              ))}
                            </MenuPanel>
                          </div>
                        ) : null}
                      </>
                    ) : (
                      <div className="relative inline-flex items-center gap-1" {...{ [HEADER_FILTER_ROOT_ATTR]: 'true' }}>
                        <button type="button" className={getSortTitleClass('note')} onClick={() => cycleSort('note')}>
                          Opombe
                        </button>
                        <button
                          ref={noteFilterButtonRef}
                          type="button"
                          className={HEADER_FILTER_BUTTON_CLASS}
                          onClick={(event) => {
                            event.stopPropagation();
                            requestCurrentEditResolution('filtriranjem opomb', () => {
                              setOpenFilter((current) => (current === 'note' ? null : 'note'));
                            });
                          }}
                          aria-label="Filtriraj opombe"
                        >
                          <ColumnFilterIcon className="!h-[12px] !w-[12px]" />
                        </button>
                      </div>
                    )}
                  </div>
                </TH>
                <TH className={`${ACTIONS_COLUMN_CLASS} px-2 text-center`}>
                  <span className={adminTableHeaderTextClassName}>Uredi</span>
                </TH>
              </TR>
            </THead>
            <tbody>
              {pagedFamilies.map((row) => {
                const { family, visibleVariants, minPrice, maxPrice, discounts } = row;
                const isExpanded = expandedFamilyIds.has(family.id);
                const hasSubtable = visibleVariants.length > 1;
                const isEditingFamily = activeEditScope?.familyId === family.id;
                const isEditingGroup = isEditingFamily && activeEditScope?.kind === 'group';
                const isSingleSelectedFamily = singleSelectedFamilyId === family.id;
                const canEditFamilyPills = !isSelectedPillUpdating && (isEditingFamily || isSingleSelectedFamily);
                const familyDraft = getFamilyDraftForState(family, familyDrafts);
                const familyNameIssue = isEditingFamily ? getFamilyNameIssue(effectiveFamilies, family.id, familyDraft.name) : null;
                const familySkuIssue = isEditingFamily ? getSkuIssue(effectiveFamilies, familyDraft.sku, { familyId: family.id }) : null;
                const familyNameSuggestionsId = `article-list-name-suggestions-${family.id}`;
                const familySkuSuggestionsId = `article-list-sku-suggestions-${family.id}`;
                const rowEditSnapshot = isEditingFamily ? activeEditSnapshot : null;
                const rawActionPrices = visibleVariants
                  .filter((variant) => variant.discountPct > 0)
                  .map((variant) => computeSalePrice(variant.price, variant.discountPct));
                const familySkuDisplay = getBaseSku(family) || '\u2014';
                const familyCategoryDisplay = getFamilyCategoryDisplay(family);
                const familyPriceDisplay = formatCurrencyRange(minPrice, maxPrice);
                const familyDiscountDisplay = formatPercentRange(discounts);
                const familyActionPriceDisplay = rawActionPrices.length ? formatCurrencyRangeFromValues(rawActionPrices) : '\u2014';
                return (
                  <Fragment key={family.id}>
                    <tr className={`border-t border-slate-200/90 bg-white ${adminTableRowToneClasses.hover}`} data-edit-scope={`family:${family.id}`}>
                      <td className="w-10 px-2 py-4 text-center"><AdminCheckbox checked={selectedFamilyIds.has(family.id)} onChange={() => setSelectedFamilyIds((current) => {
                        const next = new Set(current);
                        if (next.has(family.id)) next.delete(family.id); else next.add(family.id);
                        return next;
                      })} aria-label={`Izberi ${family.name}`} /></td>
                      <td className="px-2 py-4">
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            disabled={!hasSubtable}
                            className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 disabled:cursor-default disabled:hover:bg-transparent"
                            onClick={() => {
                              if (!hasSubtable) return;
                              const nextExpanded = !isExpanded;
                              if (isEditingGroup && !nextExpanded) {
                                requestCurrentEditResolution(`skrivanjem različic za ${family.name}`, () => {
                                  setFamilyExpanded(family.id, false);
                                });
                                return;
                              }
                              setFamilyExpanded(family.id, nextExpanded);
                            }}
                            aria-label={isExpanded ? `Skrij različice za ${family.name}` : `Prikaži različice za ${family.name}`}
                          >
                            <span className="inline-flex h-4 w-4 items-center justify-center">{hasSubtable ? (isExpanded ? '▾' : '▸') : ''}</span>
                          </button>
                          {isEditingFamily ? (
                            <div className={`${QUICK_EDIT_NAME_SHELL_CLASS} flex-1`}>
                              <input
                                className={`${QUICK_EDIT_NAME_INPUT_CLASS} ${familyNameIssue ? '!border-rose-400' : ''}`}
                                value={familyDraft.name}
                                list={familyNameSuggestionsId}
                                title={familyNameIssue?.message}
                                aria-invalid={Boolean(familyNameIssue)}
                                onChange={(event) => setFamilyDrafts((current) => ({ ...current, [family.id]: { ...familyDraft, name: event.target.value } }))}
                              />
                              <datalist id={familyNameSuggestionsId}>
                                {familyNameIssue?.suggestions.map((suggestion) => (
                                  <option key={suggestion} value={suggestion} />
                                ))}
                              </datalist>
                            </div>
                          ) : (
                            <button type="button" className="min-w-0 flex-1 text-left" onClick={() => requestCurrentEditResolution(`odhodom na urejanje artikla ${family.name}`, () => router.push(getItemEditHref(family)))}>
                              <span className="block truncate text-[12px] font-semibold text-slate-900 transition hover:text-[#1982bf] hover:underline underline-offset-2">
                                {family.name}
                              </span>
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="px-2 py-4 text-slate-600">
                        {isEditingFamily ? (
                          <>
                            <input
                              className={`${ROW_EDIT_INPUT_CLASS} ${familySkuIssue ? '!border-rose-400' : ''}`}
                              value={familyDraft.sku}
                              list={familySkuSuggestionsId}
                              title={familySkuIssue?.message}
                              aria-invalid={Boolean(familySkuIssue)}
                              onChange={(event) => setFamilyDrafts((current) => ({ ...current, [family.id]: { ...familyDraft, sku: event.target.value } }))}
                            />
                            <datalist id={familySkuSuggestionsId}>
                              {familySkuIssue?.suggestions.map((suggestion) => (
                                <option key={suggestion} value={suggestion} />
                              ))}
                            </datalist>
                          </>
                        ) : (
                          <span
                            className={`inline-flex max-w-full items-center ${getMatchingValueClassName('sku', familySkuDisplay)}`}
                            onMouseEnter={() => setHoveredArticleCell('sku', familySkuDisplay)}
                            onMouseLeave={() => setHoveredCellMatch(null)}
                          >
                            {familySkuDisplay}
                          </span>
                        )}
                      </td>
                      <td className="px-2 py-4 text-slate-600">
                        {isEditingFamily ? (
                          <div className="min-w-0">
                            <AdminCategoryBreadcrumbPicker
                              value={familyDraft.categoryPath}
                              onChange={(nextPath) => setFamilyDrafts((current) => ({ ...current, [family.id]: { ...familyDraft, categoryPath: nextPath } }))}
                              categoryPaths={categoryPaths}
                              className="flex h-7 items-center rounded-md bg-transparent px-1 !py-0 text-[12px] [&_input]:text-[12px] [&_span]:text-[12px]"
                            />
                          </div>
                        ) : (
                          <div className="min-w-0">
                            <span
                              className={`inline-block max-w-full truncate px-1 align-middle text-[12px] text-slate-600 ${getMatchingValueClassName('category', familyCategoryDisplay)}`}
                              onMouseEnter={() => setHoveredArticleCell('category', familyCategoryDisplay)}
                              onMouseLeave={() => setHoveredCellMatch(null)}
                            >
                              {familyCategoryDisplay}
                            </span>
                          </div>
                        )}
                      </td>
                      <td className="w-[6.83%] whitespace-nowrap px-2 py-4 text-right">
                        {isEditingFamily ? (
                          <span className="inline-flex w-full justify-end">
                            <span className={compactTableValueUnitShellClassName}>
                              <input
                                type="text"
                                inputMode="decimal"
                                className={`${ROW_EDIT_COMPACT_NUMBER_INPUT_CLASS} !w-[7ch]`}
                                value={readFamilyNumericInputValue(family.id, visibleVariants, 'price')}
                                placeholder={getFamilyNumericInputPlaceholder(visibleVariants, 'price')}
                                onChange={(event) => updateNumericDraft('family', family.id, 'price', event.target.value)}
                                onBlur={() => commitFamilyNumericDraft(family.id, visibleVariants, 'price')}
                              />
                              <span className={compactTableAdornmentClassName}>€</span>
                            </span>
                          </span>
                        ) : (
                          <span
                            className={`inline-flex justify-end ${getMatchingValueClassName('priceRange', familyPriceDisplay)}`}
                            onMouseEnter={() => setHoveredArticleCell('priceRange', familyPriceDisplay)}
                            onMouseLeave={() => setHoveredCellMatch(null)}
                          >
                            {familyPriceDisplay}
                          </span>
                        )}
                      </td>
                      <td className="w-[6.83%] px-2 py-4 text-right text-emerald-700">
                        {isEditingFamily ? (
                          <span className="inline-flex w-full justify-end">
                            <span className={compactTableValueUnitShellClassName}>
                              <input
                                type="text"
                                inputMode="decimal"
                                className={`${ROW_EDIT_COMPACT_NUMBER_INPUT_CLASS} !w-[5ch] !px-0`}
                                value={readFamilyNumericInputValue(family.id, visibleVariants, 'discountPct')}
                                placeholder={getFamilyNumericInputPlaceholder(visibleVariants, 'discountPct')}
                                onChange={(event) => updateNumericDraft('family', family.id, 'discountPct', event.target.value)}
                                onBlur={() => commitFamilyNumericDraft(family.id, visibleVariants, 'discountPct')}
                              />
                              <span className={compactTableAdornmentClassName}>%</span>
                            </span>
                          </span>
                        ) : (
                          <span
                            className={`inline-flex justify-end ${getMatchingValueClassName('discount', familyDiscountDisplay)}`}
                            onMouseEnter={() => setHoveredArticleCell('discount', familyDiscountDisplay)}
                            onMouseLeave={() => setHoveredCellMatch(null)}
                          >
                            {familyDiscountDisplay}
                          </span>
                        )}
                      </td>
                      <td className="w-[10.33%] px-2 py-4 text-right">
                        {isEditingFamily ? (
                          <span className="inline-flex w-full justify-end">
                            <span className={compactTableValueUnitShellClassName}>
                              <input
                                type="text"
                                inputMode="decimal"
                                className={`${ROW_EDIT_COMPACT_NUMBER_INPUT_CLASS} !w-[7ch]`}
                                value={readFamilyNumericInputValue(family.id, visibleVariants, 'salePrice')}
                                placeholder={getFamilyNumericInputPlaceholder(visibleVariants, 'salePrice')}
                                onChange={(event) => updateNumericDraft('family', family.id, 'salePrice', event.target.value)}
                                onBlur={() => commitFamilyNumericDraft(family.id, visibleVariants, 'salePrice')}
                              />
                              <span className={compactTableAdornmentClassName}>€</span>
                            </span>
                          </span>
                        ) : (
                          <span
                            className={`inline-flex justify-end ${getMatchingValueClassName('actionPriceRange', familyActionPriceDisplay)}`}
                            onMouseEnter={() => setHoveredArticleCell('actionPriceRange', familyActionPriceDisplay)}
                            onMouseLeave={() => setHoveredCellMatch(null)}
                          >
                            {familyActionPriceDisplay}
                          </span>
                        )}
                      </td>
                      <td className={`${STATUS_COLUMN_CLASS} px-0 py-4 text-center`}>
                        <div className={STATUS_NOTE_CELL_INNER_CLASS}>
                          <ActiveStateChip
                            active={isEditingFamily ? familyDraft.active : family.active}
                            editable={canEditFamilyPills}
                            editScope={`family:${family.id}`}
                            onChange={(next) =>
                              isEditingFamily
                                ? updateFamilyDraft(family.id, familyDraft, (current) => ({ ...current, active: next }))
                                : handleSelectedStatusUpdate(next, { familyIds: [family.id], variantIds: [] })
                            }
                          />
                        </div>
                      </td>
                      <td className={`${NOTE_COLUMN_CLASS} px-0 py-4 text-center`}>
                        <div className={STATUS_NOTE_CELL_INNER_CLASS}>
                          <NoteTagChip
                            value={((isEditingFamily ? familyDraft.badge : family.itemBadge) || 'na-zalogi') as NoteTag}
                            editable={canEditFamilyPills}
                            editScope={`family:${family.id}`}
                            placeholderLabel="Opombe"
                            onChange={(next) =>
                              isEditingFamily
                                ? updateFamilyDraft(family.id, familyDraft, (current) => ({ ...current, badge: (next || 'na-zalogi') as NoteValue }))
                                : handleSelectedNoteUpdate((next || 'na-zalogi') as NoteTag, { familyIds: [family.id], variantIds: [] })
                            }
                          />
                        </div>
                      </td>
                      <td className={`${ACTIONS_COLUMN_CLASS} px-2 py-4 text-center`}>
                        {isEditingFamily ? (
                          <div className={adminTableInlineActionRowClassName}>
                            <IconButton
                              type="button"
                              tone="neutral"
                              size="sm"
                              className={adminTableInlineConfirmButtonClassName}
                              disabled={!rowEditSnapshot?.isDirty || !rowEditSnapshot.isValid || isSavingActiveScope}
                              aria-label={`Shrani urejanje za ${family.name}`}
                              title={
                                rowEditSnapshot?.validationMessage ??
                                (!rowEditSnapshot?.isDirty ? 'Ni sprememb za shranjevanje' : 'Shrani')
                              }
                              onClick={() => {
                                void saveCurrentEditScope();
                              }}
                            >
                              {isSavingActiveScope ? (
                                <Spinner size="sm" className="text-[#1982bf]" />
                              ) : (
                                <CheckIcon className={adminTableInlineConfirmIconClassName} strokeWidth={2.2} />
                              )}
                            </IconButton>
                            <IconButton
                              type="button"
                              tone="neutral"
                              size="sm"
                              className={adminTableInlineCancelButtonClassName}
                              onClick={cancelCurrentEditScope}
                              aria-label={`Prekliči urejanje za ${family.name}`}
                              title="Prekliči"
                            >
                              <CloseIcon
                                className={adminTableInlineCancelIconClassName}
                                strokeWidth={1.9}
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </IconButton>
                          </div>
                        ) : (
                          <RowActionsDropdown
                            label={`Možnosti za ${family.name}`}
                            editScope={`family:${family.id}`}
                            menuWidth={144}
                            menuClassName="w-36"
                            items={[
                              { key: 'quick-edit', label: 'Hitro urejanje', icon: <PencilIcon />, onSelect: () => beginFamilyEditScope(family) },
                              {
                                key: 'open',
                                label: 'Odpri artikel',
                                icon: <OpenArticleIcon />,
                                onSelect: () => requestCurrentEditResolution(`odhodom na urejanje artikla ${family.name}`, () => router.push(getItemEditHref(family)))
                              },
                              {
                                key: 'archive',
                                label: 'Arhiviraj',
                                icon: <ArchiveIcon />,
                                className: 'text-amber-800 hover:bg-amber-50 hover:text-amber-900',
                                onSelect: () => handleArchiveFamilyAction(family)
                              }
                            ]}
                          />
                        )}
                      </td>
                    </tr>
                    {isExpanded && hasSubtable ? (
                      <tr className="border-t border-slate-200/90 bg-slate-50/70">
                        <td />
                        <td colSpan={9} className="p-0">
                          <table className="w-full text-[12px]">
                            <thead className="bg-[color:var(--admin-table-header-bg)]">
                              <tr className="border-b border-slate-200 text-[11px] font-medium text-slate-600">
                                <th className="px-2 py-2" />
                                <th className="w-[25%] px-2 py-2 text-left">Različica</th>
                                <th className="w-[20%] px-2 py-2 text-left">SKU</th>
                                <th className="w-[10.33%] px-2 py-2 text-right">Cena</th>
                                <th className="w-[10.33%] px-2 py-2 text-right">Popust</th>
                                <th className="w-[10.33%] px-2 py-2 text-right">Akcijska cena</th>
                                <th className={`${STATUS_COLUMN_CLASS} px-0 py-2 text-center`}>Status</th>
                                <th className={`${NOTE_COLUMN_CLASS} px-0 py-2 text-center`}>Opombe</th>
                                <th className="w-[5%] px-2 py-2 text-center">Mesto</th>
                              </tr>
                            </thead>
                            <tbody>
                              {visibleVariants.map((variant) => {
                                const isEditing = isEditingGroup;
                                const isSingleSelectedVariant = singleSelectedVariantId === variant.id;
                                const canEditVariantPills = !isSelectedPillUpdating && (isEditing || isSingleSelectedVariant);
                                const draft = variantDrafts[variant.id] ?? createVariantDraft(variant);
                                const variantSkuIssue = isEditing
                                  ? getSkuIssue(effectiveFamilies, draft.sku, {
                                      familyId: family.id,
                                      variantId: variant.id,
                                      includeSameFamilyVariants: true
                                    })
                                  : null;
                                const variantSkuSuggestionsId = `article-list-variant-sku-suggestions-${variant.id}`;
                                const actionPrice = draft.discountPct > 0 ? computeSalePrice(draft.price, draft.discountPct) : null;
                                const variantSkuDisplay = draft.sku || '\u2014';
                                const variantPriceDisplay = formatCurrency(draft.price);
                                const variantDiscountDisplay = `${draft.discountPct}%`;
                                const variantActionPriceDisplay = actionPrice === null ? '\u2014' : formatCurrency(actionPrice);
                                return (
                                  <tr key={variant.id} className="border-t border-slate-200/90" data-edit-scope={`family:${family.id}`}>
                                    <td className="px-2 py-2 text-center">
                                      <AdminCheckbox
                                        checked={selectedVariantIds.has(variant.id)}
                                        onChange={() =>
                                          setSelectedVariantIds((current) => {
                                            const next = new Set(current);
                                            if (next.has(variant.id)) next.delete(variant.id);
                                            else next.add(variant.id);
                                            return next;
                                          })
                                        }
                                      />
                                    </td>
                                    <td className="px-2 py-2 font-medium">
                                      {isEditing ? (
                                        <input
                                          className={ROW_EDIT_INPUT_CLASS}
                                          value={draft.label}
                                          onChange={(event) =>
                                            setVariantDrafts((current) => ({
                                              ...current,
                                              [variant.id]: { ...draft, label: event.target.value }
                                            }))
                                          }
                                        />
                                      ) : (
                                        (variant.label || 'Različica')
                                      )}
                                    </td>
                                    <td className="px-2 py-2">
                                      {isEditing ? (
                                        <input
                                          className={`${ROW_EDIT_INPUT_CLASS} ${variantSkuIssue ? '!border-rose-400' : ''}`}
                                          value={draft.sku}
                                          list={variantSkuSuggestionsId}
                                          title={variantSkuIssue?.message}
                                          aria-invalid={Boolean(variantSkuIssue)}
                                          onChange={(event) =>
                                            setVariantDrafts((current) => ({
                                              ...current,
                                              [variant.id]: { ...draft, sku: event.target.value }
                                            }))
                                          }
                                        />
                                      ) : (
                                        <span
                                          className={`inline-flex max-w-full items-center ${getMatchingValueClassName('sku', variantSkuDisplay)}`}
                                          onMouseEnter={() => setHoveredArticleCell('sku', variantSkuDisplay)}
                                          onMouseLeave={() => setHoveredCellMatch(null)}
                                        >
                                          {variantSkuDisplay}
                                        </span>
                                      )}
                                      {isEditing ? (
                                        <datalist id={variantSkuSuggestionsId}>
                                          {variantSkuIssue?.suggestions.map((suggestion) => (
                                            <option key={suggestion} value={suggestion} />
                                          ))}
                                        </datalist>
                                      ) : null}
                                    </td>
                                    <td className="w-[10.33%] px-2 py-2 text-right">
                                      {isEditing ? (
                                        <span className="inline-flex w-full justify-end">
                                          <span className={compactTableValueUnitShellClassName}>
                                            <input
                                              type="text"
                                              inputMode="decimal"
                                              className={`${ROW_EDIT_COMPACT_NUMBER_INPUT_CLASS} !w-[7ch]`}
                                              value={readVariantNumericInputValue(variant, draft, 'price')}
                                              placeholder={formatDecimalForDisplay(draft.price)}
                                              onChange={(event) => updateNumericDraft('variant', variant.id, 'price', event.target.value)}
                                              onBlur={() => commitVariantNumericDraft(variant, 'price')}
                                            />
                                            <span className={compactTableAdornmentClassName}>€</span>
                                          </span>
                                        </span>
                                      ) : (
                                        <span
                                          className={`inline-flex justify-end ${getMatchingValueClassName('priceRange', variantPriceDisplay)}`}
                                          onMouseEnter={() => setHoveredArticleCell('priceRange', variantPriceDisplay)}
                                          onMouseLeave={() => setHoveredCellMatch(null)}
                                        >
                                          {variantPriceDisplay}
                                        </span>
                                      )}
                                    </td>
                                    <td className="w-[10.33%] px-2 py-2 text-right text-emerald-700">
                                      {isEditing ? (
                                        <span className="inline-flex w-full justify-end">
                                          <span className={compactTableValueUnitShellClassName}>
                                            <input
                                              type="text"
                                              inputMode="decimal"
                                              className={`${ROW_EDIT_COMPACT_NUMBER_INPUT_CLASS} !w-[5ch] !px-0`}
                                              value={readVariantNumericInputValue(variant, draft, 'discountPct')}
                                              placeholder={formatDecimalForDisplay(draft.discountPct)}
                                              onChange={(event) => updateNumericDraft('variant', variant.id, 'discountPct', event.target.value)}
                                              onBlur={() => commitVariantNumericDraft(variant, 'discountPct')}
                                            />
                                            <span className={compactTableAdornmentClassName}>%</span>
                                          </span>
                                        </span>
                                      ) : (
                                        <span
                                          className={`inline-flex justify-end ${getMatchingValueClassName('discount', variantDiscountDisplay)}`}
                                          onMouseEnter={() => setHoveredArticleCell('discount', variantDiscountDisplay)}
                                          onMouseLeave={() => setHoveredCellMatch(null)}
                                        >
                                          {variantDiscountDisplay}
                                        </span>
                                      )}
                                    </td>
                                    <td className="w-[10.33%] px-2 py-2 text-right">
                                      {isEditing ? (
                                        <span className="inline-flex w-full justify-end">
                                          <span className={compactTableValueUnitShellClassName}>
                                            <input
                                              type="text"
                                              inputMode="decimal"
                                              className={`${ROW_EDIT_COMPACT_NUMBER_INPUT_CLASS} !w-[7ch]`}
                                              value={readVariantNumericInputValue(variant, draft, 'salePrice')}
                                              placeholder={actionPrice === null ? '' : formatDecimalForDisplay(actionPrice)}
                                              onChange={(event) => updateNumericDraft('variant', variant.id, 'salePrice', event.target.value)}
                                              onBlur={() => commitVariantNumericDraft(variant, 'salePrice')}
                                            />
                                            <span className={compactTableAdornmentClassName}>€</span>
                                          </span>
                                        </span>
                                      ) : (
                                        <span
                                          className={`inline-flex justify-end ${getMatchingValueClassName('actionPriceRange', variantActionPriceDisplay)}`}
                                          onMouseEnter={() => setHoveredArticleCell('actionPriceRange', variantActionPriceDisplay)}
                                          onMouseLeave={() => setHoveredCellMatch(null)}
                                        >
                                          {variantActionPriceDisplay}
                                        </span>
                                      )}
                                    </td>
                                    <td className={`${STATUS_COLUMN_CLASS} px-0 py-2 text-center`}>
                                      <div className={STATUS_NOTE_CELL_INNER_CLASS}>
                                        <ActiveStateChip
                                          active={isEditing ? draft.active : variant.active}
                                          editable={canEditVariantPills}
                                          editScope={`variant:${variant.id}`}
                                          onChange={(next) =>
                                            isEditing
                                              ? setVariantDrafts((current) => ({
                                                  ...current,
                                                  [variant.id]: { ...draft, active: next }
                                                }))
                                              : handleSelectedStatusUpdate(next, { familyIds: [], variantIds: [variant.id] })
                                          }
                                        />
                                      </div>
                                    </td>
                                    <td className={`${NOTE_COLUMN_CLASS} px-0 py-2 text-center`}>
                                      <div className={STATUS_NOTE_CELL_INNER_CLASS}>
                                        <NoteTagChip
                                          value={((isEditing ? draft.note : normalizeNoteValue(variant.badge)) || 'na-zalogi') as NoteTag}
                                          editable={canEditVariantPills}
                                          editScope={`variant:${variant.id}`}
                                          onChange={(next) =>
                                            isEditing
                                              ? setVariantDrafts((current) => ({
                                                  ...current,
                                                  [variant.id]: { ...draft, note: (next || 'na-zalogi') as NoteValue }
                                                }))
                                              : handleSelectedNoteUpdate((next || 'na-zalogi') as NoteTag, { familyIds: [], variantIds: [variant.id] })
                                          }
                                        />
                                      </div>
                                    </td>
                                    <td className="w-[5%] px-2 py-2 text-center">
                                      {isEditing ? (
                                        <input
                                          type="text"
                                          inputMode="numeric"
                                          pattern="[0-9]*"
                                          className={MESTO_EDIT_INPUT_CLASS}
                                          value={draft.position}
                                          onChange={(event) =>
                                            setVariantDrafts((current) => ({
                                              ...current,
                                              [variant.id]: { ...draft, position: Number(event.target.value) || 1 }
                                            }))
                                          }
                                        />
                                      ) : (variant.position ?? '—')}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                );
              })}
            </tbody>
          </Table>
      </AdminTableLayout>
      <HeaderFilterPortal open={Boolean(openFilter)}>
        {openFilter === 'category' ? (
          <div style={getHeaderPopoverStyle(categoryFilterButtonRef.current, 294)}>
            <MenuPanel className="w-[18.4rem] shadow-lg">
              {[{ value: 'all', label: 'Vse kategorije' }, ...categories.map((category) => ({ value: category, label: category }))].map(
                (option) => (
                  <MenuItem
                    key={option.value}
                    onClick={() => requestCurrentEditResolution('filtriranjem kategorij', () => {
                      setCategoryFilter(option.value);
                      setOpenFilter(null);
                    })}
                  >
                    {option.label}
                  </MenuItem>
                )
              )}
            </MenuPanel>
          </div>
        ) : null}
        {openFilter === 'priceRange' ? (
          <div style={getHeaderPopoverStyle(priceFilterButtonRef.current, 192)}>
            <AdminRangeFilterPanel
              title="Cena"
              draftRange={draftPriceRangeFilter}
              onDraftChange={setDraftPriceRangeFilter}
              onConfirm={() => requestCurrentEditResolution('filtriranjem cen', () => {
                setPriceRangeFilter(draftPriceRangeFilter);
                setOpenFilter(null);
              })}
              onReset={() => requestCurrentEditResolution('ponastavitvijo filtra cen', () => {
                setDraftPriceRangeFilter({ min: '', max: '' });
                setPriceRangeFilter({ min: '', max: '' });
                setOpenFilter(null);
              })}
              minPlaceholder="Min cena"
              maxPlaceholder="Max cena"
              min={0}
            />
          </div>
        ) : null}
        {openFilter === 'discount' ? (
          <div style={getHeaderPopoverStyle(discountFilterButtonRef.current, 160)}>
            <MenuPanel className="w-40 shadow-lg">
              <MenuItem onClick={() => requestCurrentEditResolution('filtriranjem popustov', () => { setDiscountFilter('all'); setOpenFilter(null); })}>Vsi</MenuItem>
              <MenuItem onClick={() => requestCurrentEditResolution('filtriranjem popustov', () => { setDiscountFilter('yes'); setOpenFilter(null); })}>S popustom</MenuItem>
              <MenuItem onClick={() => requestCurrentEditResolution('filtriranjem popustov', () => { setDiscountFilter('no'); setOpenFilter(null); })}>Brez popusta</MenuItem>
            </MenuPanel>
          </div>
        ) : null}
        {openFilter === 'actionPriceRange' ? (
          <div style={getHeaderPopoverStyle(actionPriceFilterButtonRef.current, 192)}>
            <AdminRangeFilterPanel
              title="Akcijska cena"
              draftRange={draftActionPriceRangeFilter}
              onDraftChange={setDraftActionPriceRangeFilter}
              onConfirm={() => requestCurrentEditResolution('filtriranjem akcijskih cen', () => {
                setActionPriceRangeFilter(draftActionPriceRangeFilter);
                setOpenFilter(null);
              })}
              onReset={() => requestCurrentEditResolution('ponastavitvijo filtra akcijskih cen', () => {
                setDraftActionPriceRangeFilter({ min: '', max: '' });
                setActionPriceRangeFilter({ min: '', max: '' });
                setOpenFilter(null);
              })}
              minPlaceholder="Min akcijska"
              maxPlaceholder="Max akcijska"
              min={0}
            />
          </div>
        ) : null}
        {openFilter === 'note' ? (
          <div style={getHeaderPopoverStyle(noteFilterButtonRef.current, 184)}>
            <MenuPanel className="w-44 shadow-lg">
              <MenuItem onClick={() => requestCurrentEditResolution('filtriranjem opomb', () => { setNoteFilter('all'); setOpenFilter(null); })}>Vse opombe</MenuItem>
              <MenuItem className={getNoteTagMenuItemClassName('na-zalogi')} onClick={() => requestCurrentEditResolution('filtriranjem opomb', () => { setNoteFilter('na-zalogi'); setOpenFilter(null); })}>Na zalogi</MenuItem>
              <MenuItem className={getNoteTagMenuItemClassName('novo')} onClick={() => requestCurrentEditResolution('filtriranjem opomb', () => { setNoteFilter('novo'); setOpenFilter(null); })}>Novo</MenuItem>
              <MenuItem className={getNoteTagMenuItemClassName('akcija')} onClick={() => requestCurrentEditResolution('filtriranjem opomb', () => { setNoteFilter('akcija'); setOpenFilter(null); })}>V akciji</MenuItem>
              <MenuItem className={getNoteTagMenuItemClassName('zadnji-kosi')} onClick={() => requestCurrentEditResolution('filtriranjem opomb', () => { setNoteFilter('zadnji-kosi'); setOpenFilter(null); })}>Zadnji kosi</MenuItem>
              <MenuItem className={getNoteTagMenuItemClassName('ni-na-zalogi')} onClick={() => requestCurrentEditResolution('filtriranjem opomb', () => { setNoteFilter('ni-na-zalogi'); setOpenFilter(null); })}>Ni na zalogi</MenuItem>
            </MenuPanel>
          </div>
        ) : null}
        {openFilter === 'status' ? (
          <div style={getHeaderPopoverStyle(statusFilterButtonRef.current, 144)}>
            <MenuPanel className="w-36 shadow-lg">
              <MenuItem onClick={() => requestCurrentEditResolution('filtriranjem statusov', () => { setStatusFilter('all'); setOpenFilter(null); })}>Vsi</MenuItem>
              <MenuItem className={getActiveStateMenuItemClassName(true)} onClick={() => requestCurrentEditResolution('filtriranjem statusov', () => { setStatusFilter('active'); setOpenFilter(null); })}>Aktiven</MenuItem>
              <MenuItem className={getActiveStateMenuItemClassName(false)} onClick={() => requestCurrentEditResolution('filtriranjem statusov', () => { setStatusFilter('inactive'); setOpenFilter(null); })}>Neaktiven</MenuItem>
            </MenuPanel>
          </div>
        ) : null}
      </HeaderFilterPortal>
    </div>
  );
}
