'use client';

import dynamic from 'next/dynamic';
import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/shared/ui/button';
import { IconButton } from '@/shared/ui/icon-button';
import { Spinner } from '@/shared/ui/loading';
import { useToast } from '@/shared/ui/toast';
import { AdminTableLayout } from '@/shared/ui/admin-table';
import { AdminCheckbox } from '@/shared/ui/checkbox';
import { AdminSearchInput } from '@/shared/ui/admin-search-input';
import { ArchiveIcon, ColumnFilterIcon, DownloadIcon, PencilIcon, SaveIcon } from '@/shared/ui/icons/AdminActionIcons';
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
import { adminTableRowToneClasses, adminTextButtonTypographyTokenClasses, filterPillTokenClasses } from '@/shared/ui/theme/tokens';
import {
  createArchivedItemRecord,
  readArchivedItemStorage,
  writeArchivedItemStorage
} from '@/admin/features/artikli/lib/archiveItemClient';
import {
  computeSalePrice,
  formatCurrency,
  type ProductFamily,
  type Variant
} from '@/admin/features/artikli/lib/familyModel';
import { formatDecimalForDisplay, parseDecimalInput } from '@/admin/features/artikli/lib/decimalFormat';
import ActiveStateChip from '@/admin/features/artikli/components/ActiveStateChip';
import AdminCategoryBreadcrumbPicker from '@/admin/features/artikli/components/AdminCategoryBreadcrumbPicker';
import { NoteTagChip, type NoteTag } from '@/admin/features/artikli/components/NoteTagChip';
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
type NumericDraftField = 'price' | 'discountPct' | 'salePrice';
type NumericDraftScope = 'family' | 'variant';
const ROW_EDIT_INPUT_CLASS = `${compactTableAlignedTextInputClassName} !mt-0 !h-7 !w-full !px-2 text-[12px]`;
const ROW_EDIT_COMPACT_NUMBER_INPUT_CLASS = `${compactTableAlignedInputClassName} !mt-0 !h-7 text-right text-[12px]`;
const QUICK_EDIT_NAME_SHELL_CLASS = 'min-w-0 flex-1';
const QUICK_EDIT_NAME_INPUT_CLASS = `${ROW_EDIT_INPUT_CLASS} font-medium`;
const STATUS_COLUMN_CLASS = 'w-[120px] min-w-[120px] max-w-[120px]';
const NOTE_COLUMN_CLASS = 'w-[124px] min-w-[124px] max-w-[124px]';
const STATUS_NOTE_CELL_INNER_CLASS = 'inline-flex w-full items-center justify-center';
const NUMERIC_FIELD_LABELS: Record<NumericDraftField, string> = {
  price: 'Cena',
  discountPct: 'Popust',
  salePrice: 'Akcijska cena'
};
const LazyConfirmDialog = dynamic(
  () => import('@/shared/ui/confirm-dialog').then((module) => module.ConfirmDialog),
  { ssr: false }
);

const getBaseSku = (family: ListFamily) => family.baseSku || family.variants[0]?.sku || '';
const formatRangeValue = (values: number[], formatter: (value: number) => string) => {
  if (!values.length) return '—';
  const min = Math.min(...values);
  const max = Math.max(...values);
  return min === max ? formatter(min) : `${formatter(min)}–${formatter(max)}`;
};

const normalizeCategoryPath = (value: string) =>
  value
    .split('/')
    .map((entry) => entry.trim())
    .filter(Boolean);

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
      label: variant.variantName || `Različica ${variantIndex + 1}`,
      width: variant.width,
      length: variant.length,
      thickness: variant.thickness,
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

export default function AdminItemsManager({ items }: { items: AdminCatalogListItem[] }) {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [discountFilter, setDiscountFilter] = useState<DiscountFilter>('all');
  const [noteFilter, setNoteFilter] = useState<NoteFilter>('all');
  const [openFilter, setOpenFilter] = useState<OpenFilter>(null);
  const [expandedFamilyIds, setExpandedFamilyIds] = useState<Set<string>>(new Set());
  const [selectedFamilyIds, setSelectedFamilyIds] = useState<Set<string>>(new Set());
  const [selectedVariantIds, setSelectedVariantIds] = useState<Set<string>>(new Set());
  const [editingFamilyId, setEditingFamilyId] = useState<string | null>(null);
  const [deletedVariantIds] = useState<Set<string>>(new Set());
  const [familyDrafts, setFamilyDrafts] = useState<Record<string, FamilyDraft>>({});
  const [variantDrafts, setVariantDrafts] = useState<Record<string, VariantDraft>>({});
  const [numericDrafts, setNumericDrafts] = useState<Record<string, string>>({});
  const [savedFamilyRows, setSavedFamilyRows] = useState<Record<string, ListFamily>>({});
  const [categoryPaths, setCategoryPaths] = useState<string[]>([]);
  const [sortState, setSortState] = useState<SortState>(null);
  const [variantCountRange, setVariantCountRange] = useState<{ min: string; max: string }>({ min: '', max: '' });
  const [draftVariantCountRange, setDraftVariantCountRange] = useState<{ min: string; max: string }>({ min: '', max: '' });
  const [priceRangeFilter, setPriceRangeFilter] = useState<{ min: string; max: string }>({ min: '', max: '' });
  const [draftPriceRangeFilter, setDraftPriceRangeFilter] = useState<{ min: string; max: string }>({ min: '', max: '' });
  const [actionPriceRangeFilter, setActionPriceRangeFilter] = useState<{ min: string; max: string }>({ min: '', max: '' });
  const [draftActionPriceRangeFilter, setDraftActionPriceRangeFilter] = useState<{ min: string; max: string }>({ min: '', max: '' });
  const [isBulkArchiveDialogOpen, setIsBulkArchiveDialogOpen] = useState(false);
  const [isArchivingSelected, setIsArchivingSelected] = useState(false);
  const categoryFilterButtonRef = useRef<HTMLButtonElement | null>(null);
  const priceFilterButtonRef = useRef<HTMLButtonElement | null>(null);
  const discountFilterButtonRef = useRef<HTMLButtonElement | null>(null);
  const actionPriceFilterButtonRef = useRef<HTMLButtonElement | null>(null);
  const statusFilterButtonRef = useRef<HTMLButtonElement | null>(null);
  const noteFilterButtonRef = useRef<HTMLButtonElement | null>(null);

  const families = useMemo(() => toListFamilies(items), [items]);
  const { toast } = useToast();
  const effectiveFamilies = useMemo(
    () =>
      families.map((family) => {
        const saved = savedFamilyRows[family.id];
        return saved ?? family;
      }),
    [families, savedFamilyRows]
  );
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
  const categories = useMemo(() => Array.from(new Set(effectiveFamilies.map((family) => family.category))).sort((a, b) => a.localeCompare(b, 'sl')), [effectiveFamilies]);

  useEffect(() => {
    setSavedFamilyRows({});
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
    setIsBulkArchiveDialogOpen(true);
  };

  const confirmArchiveSelected = async () => {
    if (!hasSelectedArchiveFamilies) {
      setIsBulkArchiveDialogOpen(false);
      return;
    }

    setIsBulkArchiveDialogOpen(false);
    setIsArchivingSelected(true);

    const archivedFamilyIds = new Set<string>();
    const archivedVariantIds = new Set<string>();
    const failedFamilies: string[] = [];

    try {
      for (const family of selectedArchiveFamilies) {
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
  const getVariantDraftForState = (variant: Variant, sourceDrafts: Record<string, VariantDraft>) => sourceDrafts[variant.id] ?? createVariantDraft(variant);
  const numericDraftKey = (scope: NumericDraftScope, id: string, field: NumericDraftField) => `${scope}:${id}:${field}`;
  const clearNumericDraftKeys = (keys: string[]) =>
    setNumericDrafts((current) => {
      if (keys.length === 0) return current;
      const next = { ...current };
      keys.forEach((key) => {
        delete next[key];
      });
      return next;
    });
  const updateNumericDraft = (scope: NumericDraftScope, id: string, field: NumericDraftField, raw: string) => {
    if (!isDecimalInputDraft(raw)) return;
    const key = numericDraftKey(scope, id, field);
    setNumericDrafts((current) => ({ ...current, [key]: raw }));
  };
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
  const resolvePendingNumericDraftsForFamily = (
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
  };
  const commitPendingNumericDraftsForFamily = (familyId: string, variants: Variant[]) => {
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
  };
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
  const startFamilyEdit = (family: ListFamily, variants: Variant[]) => {
    setEditingFamilyId(family.id);
    setExpandedFamilyIds((current) => {
      const next = new Set(current);
      if (variants.length > 0) next.add(family.id);
      return next;
    });
    setVariantDrafts((current) => {
      const next = { ...current };
      variants.forEach((variant) => {
        next[variant.id] = createVariantDraft(variant);
      });
      return next;
    });
    clearNumericDraftKeys([
      ...(['price', 'discountPct', 'salePrice'] as NumericDraftField[]).map((field) => numericDraftKey('family', family.id, field)),
      ...variants.flatMap((variant) =>
        (['price', 'discountPct', 'salePrice'] as NumericDraftField[]).map((field) => numericDraftKey('variant', variant.id, field))
      )
    ]);
    setFamilyDrafts((current) => ({
      ...current,
      [family.id]: {
        name: family.name,
        sku: getBaseSku(family),
        categoryPath: family.categoryPath.length > 0 ? family.categoryPath : normalizeCategoryPath(family.category),
        active: family.active,
        badge: family.itemBadge || 'na-zalogi'
      }
    }));
  };
  const updateFamilyDraft = (familyId: string, fallbackDraft: FamilyDraft, mutate: (draft: FamilyDraft) => FamilyDraft) =>
    setFamilyDrafts((current) => {
      const draft = current[familyId] ?? fallbackDraft;
      return { ...current, [familyId]: mutate(draft) };
    });
  const saveFamilyEdit = async (family: ListFamily, variants: Variant[], fallbackDraft: FamilyDraft) => {
    const draft = familyDrafts[family.id] ?? fallbackDraft;
    if (!draft) return;
    try {
      if (!family.slug) throw new Error('Artikel nima veljavnega identifikatorja (slug).');
      const preparedVariantDrafts = commitPendingNumericDraftsForFamily(family.id, variants);
      if (!preparedVariantDrafts) return;
      const patch: Record<string, unknown> = {};
      if (draft.name !== family.name) patch.itemName = draft.name;
      if ((draft.sku || null) !== (getBaseSku(family) || null)) patch.sku = draft.sku || null;
      if ((draft.active ? 'active' : 'inactive') !== (family.active ? 'active' : 'inactive')) patch.status = draft.active ? 'active' : 'inactive';
      if ((draft.badge || null) !== (family.itemBadge || null)) patch.badge = draft.badge || null;
      const familyPath = (family.categoryPath.length > 0 ? family.categoryPath : normalizeCategoryPath(family.category)).join('/');
      const draftPath = draft.categoryPath.join('/');
      if (draftPath !== familyPath && draft.categoryPath.length > 0) patch.categoryPath = draft.categoryPath;
      let latestSavedItem: AdminCatalogListItem | null = null;
      if (Object.keys(patch).length > 0) {
        const response = await fetch('/api/admin/artikli/quick-save/item', {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            itemIdentifier: family.slug,
            patch
          })
        });
        const body = (await response.json().catch(() => ({}))) as { item?: AdminCatalogListItem; message?: string };
        if (!response.ok || !body.item) throw new Error(body.message || 'Shranjevanje artikla ni uspelo.');
        latestSavedItem = body.item;
      }

      for (const variant of variants) {
        const variantDraft = preparedVariantDrafts[variant.id] ?? createVariantDraft(variant);
        const variantPatch: Record<string, unknown> = {};
        if (variantDraft.label !== variant.label) variantPatch.variantName = variantDraft.label;
        if (variantDraft.sku !== variant.sku) variantPatch.variantSku = variantDraft.sku || null;
        if (variantDraft.price !== variant.price) variantPatch.price = variantDraft.price;
        if (variantDraft.discountPct !== variant.discountPct) variantPatch.discountPct = variantDraft.discountPct;
        if (variantDraft.stock !== variant.stock) variantPatch.inventory = variantDraft.stock;
        if (Math.max(1, variantDraft.minOrder) !== Math.max(1, variant.minOrder ?? 1)) variantPatch.minOrder = Math.max(1, variantDraft.minOrder);
        if ((variantDraft.active ? 'active' : 'inactive') !== (variant.active ? 'active' : 'inactive')) variantPatch.status = variantDraft.active ? 'active' : 'inactive';
        if ((variantDraft.note || null) !== (normalizeNoteValue(variant.badge) || null)) variantPatch.badge = variantDraft.note || null;
        if (Math.max(1, variantDraft.position) !== Math.max(1, variant.position ?? 1)) variantPatch.position = Math.max(1, variantDraft.position);

        if (Object.keys(variantPatch).length > 0) {
          const variantResponse = await fetch('/api/admin/artikli/quick-save/variant', {
            method: 'PATCH',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              itemIdentifier: family.slug,
              variantId: Number(variant.id),
              patch: variantPatch
            })
          });
          const variantBody = (await variantResponse.json().catch(() => ({}))) as { item?: AdminCatalogListItem; message?: string };
          if (!variantResponse.ok || !variantBody.item) throw new Error(variantBody.message || 'Shranjevanje različice ni uspelo.');
          latestSavedItem = variantBody.item;
        }
      }

      if (latestSavedItem) {
        applySavedFamilyRow(latestSavedItem);
      }
      setEditingFamilyId(null);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Shranjevanje ni uspelo.');
    }
  };
  const getSortTitleClass = (column: 'article' | 'sku' | 'category' | 'variantCount' | 'discount' | 'priceRange' | 'actionPriceRange' | 'status' | 'note') =>
    `inline-flex items-center text-[12px] font-semibold leading-none text-slate-900 hover:text-[color:var(--blue-500)] ${
      sortState && 'column' in sortState && sortState.column === column ? 'underline underline-offset-2 text-[color:var(--blue-500)]' : ''
    }`;
  const cycleSort = (column: 'article' | 'sku' | 'category' | 'variantCount' | 'discount' | 'priceRange' | 'actionPriceRange' | 'status' | 'note') => {
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
  };

  useHeaderFilterDismiss({
    isOpen: Boolean(openFilter),
    onClose: () => setOpenFilter(null)
  });

  return (
    <div className="space-y-4 font-['Inter',system-ui,sans-serif]">
      {isBulkArchiveDialogOpen ? (
        <LazyConfirmDialog
          open={isBulkArchiveDialogOpen}
          title={selectedArchiveCount === 1 ? 'Arhiviranje artikla' : 'Arhiviranje artiklov'}
          description={
            selectedArchiveCount === 1
              ? 'Ali želite arhivirati izbrani artikel?'
              : `Ali želite arhivirati ${selectedArchiveCount} izbranih artiklov?`
          }
          confirmLabel="Arhiviraj"
          cancelLabel="Prekliči"
          onCancel={() => setIsBulkArchiveDialogOpen(false)}
          onConfirm={() => {
            void confirmArchiveSelected();
          }}
          confirmDisabled={isArchivingSelected}
        />
      ) : null}
      <AdminTableLayout
        className="border shadow-sm"
        style={{ background: '#fff', borderColor: '#e2e8f0', boxShadow: '0 10px 24px rgba(15,23,42,0.06)' }}
        headerLeft={
          <div className="flex h-7 w-full items-center gap-2">
            <div className="min-w-0 w-full rounded-md border border-slate-200 bg-white transition-colors focus-within:border-[#3e67d6]">
              <AdminSearchInput
                showIcon={false}
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Poišči artikel, SKU, kategorijo, status ali opombe ..."
                aria-label="Poišči artikel, SKU, kategorijo, status ali opombe"
                className="!m-0 !h-7 min-w-0 w-full flex-1 !rounded-md !border-0 !bg-transparent !shadow-none !outline-none ring-0 transition-colors placeholder:text-slate-400 [--euiFormControlStateWidth:0px] focus:[--euiFormControlStateWidth:0px] focus-visible:[--euiFormControlStateWidth:0px] focus:!border-0 focus:!shadow-none focus:!outline-none focus-visible:!border-0 focus-visible:!shadow-none focus-visible:!outline-none"
              />
            </div>
          </div>
        }
        headerRight={
          <div className="flex h-7 items-center gap-2 self-center">
            <IconButton
              type="button"
              onClick={exportVariantsCsv}
              tone="neutral"
              size="sm"
              aria-label={hasExportSelection ? 'Prenesi izbrane artikle' : 'Prenesi vse artikle'}
              title={hasExportSelection ? 'Prenesi izbrane' : 'Prenesi vse'}
            >
              <DownloadIcon />
            </IconButton>
            <IconButton
              type="button"
              onClick={handleArchiveSelected}
              disabled={!hasSelectedArchiveFamilies || isArchivingSelected}
              tone={hasSelectedArchiveFamilies ? 'warning' : 'neutral'}
              size="sm"
              className={hasSelectedArchiveFamilies ? '!bg-amber-50 !transition-none' : '!transition-none'}
              aria-label={
                hasSelectedArchiveFamilies
                  ? `Arhiviraj izbrane artikle (${selectedArchiveCount})`
                  : 'Arhiviraj izbrane artikle'
              }
              title="Arhiviraj"
            >
              {isArchivingSelected ? <Spinner size="sm" className="text-amber-700" /> : <ArchiveIcon />}
            </IconButton>
            <Button
              type="button"
              variant="primary"
              size="toolbar"
              className={`!h-7 !rounded-md ${adminTextButtonTypographyTokenClasses}`}
              aria-label="Dodaj artikel"
              onClick={() => router.push('/admin/artikli/nov')}
            >
              Dodaj artikel
            </Button>
          </div>
        }
        filterRowLeft={
          <div className="flex flex-wrap items-center gap-2">
            {categoryFilter !== 'all' ? (
              <span className={filterPillTokenClasses.base}>
                Kategorija: {categoryFilter}
                <button type="button" className={filterPillTokenClasses.clear} onClick={() => setCategoryFilter('all')} aria-label="Počisti filter kategorije">
                  ×
                </button>
              </span>
            ) : null}
            {statusFilter !== 'all' ? (
              <span className={filterPillTokenClasses.base}>
                Status: {statusFilter === 'active' ? 'Aktiven' : 'Neaktiven'}
                <button type="button" className={filterPillTokenClasses.clear} onClick={() => setStatusFilter('all')} aria-label="Počisti filter statusa">
                  ×
                </button>
              </span>
            ) : null}
            {noteFilter !== 'all' ? (
              <span className={filterPillTokenClasses.base}>
                Opombe: {noteFilter === 'na-zalogi' ? 'Na zalogi' : noteFilter === 'novo' ? 'Novo' : noteFilter === 'akcija' ? 'V akciji' : noteFilter === 'zadnji-kosi' ? 'Zadnji kosi' : 'Ni na zalogi'}
                <button type="button" className={filterPillTokenClasses.clear} onClick={() => setNoteFilter('all')} aria-label="Počisti filter opomb">
                  ×
                </button>
              </span>
            ) : null}
            {discountFilter !== 'all' ? (
              <span className={filterPillTokenClasses.base}>
                Popust: {discountFilter === 'yes' ? 'Da' : 'Ne'}
                <button type="button" className={filterPillTokenClasses.clear} onClick={() => setDiscountFilter('all')} aria-label="Počisti filter popusta">
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
                  onClick={() => {
                    setVariantCountRange({ min: '', max: '' });
                    setDraftVariantCountRange({ min: '', max: '' });
                  }}
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
                  onClick={() => {
                    setPriceRangeFilter({ min: '', max: '' });
                    setDraftPriceRangeFilter({ min: '', max: '' });
                  }}
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
                  onClick={() => {
                    setActionPriceRangeFilter({ min: '', max: '' });
                    setDraftActionPriceRangeFilter({ min: '', max: '' });
                  }}
                  aria-label="Počisti filter Razpon akcijske cene"
                >
                  ×
                </button>
              </span>
            ) : null}
          </div>
        }
        filterRowRight={<EuiTablePagination page={page} pageCount={pageCount} onPageChange={setPage} itemsPerPage={pageSize} onChangeItemsPerPage={setPageSize} itemsPerPageOptions={PAGE_SIZE_OPTIONS} />}
        contentClassName="overflow-x-auto overflow-y-visible bg-white"
        footerRight={<EuiTablePagination page={page} pageCount={pageCount} onPageChange={setPage} itemsPerPage={pageSize} onChangeItemsPerPage={setPageSize} itemsPerPageOptions={PAGE_SIZE_OPTIONS} />}
        showDivider={false}
      >
        <Table className="w-full table-fixed text-[12px]">
            <THead>
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
                <TH className="w-[17.5%]">
                  <button type="button" className={getSortTitleClass('article')} onClick={() => cycleSort('article')}>
                    Artikel
                  </button>
                </TH>
                <TH className="w-[13%]">
                  <button type="button" className={getSortTitleClass('sku')} onClick={() => cycleSort('sku')}>
                    SKU
                  </button>
                </TH>
                <TH className="w-[24.5%]">
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
                        setOpenFilter((current) => (current === 'category' ? null : 'category'));
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
                        setDraftPriceRangeFilter(priceRangeFilter);
                        setOpenFilter((current) => (current === 'priceRange' ? null : 'priceRange'));
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
                        setOpenFilter((current) => (current === 'discount' ? null : 'discount'));
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
                        setDraftActionPriceRangeFilter(actionPriceRangeFilter);
                        setOpenFilter((current) => (current === 'actionPriceRange' ? null : 'actionPriceRange'));
                      }}
                      aria-label="Filtriraj Akcijska cena"
                    >
                      <ColumnFilterIcon className="!h-[12px] !w-[12px]" />
                    </button>
                  </div>
                </TH>
                <TH className={`${STATUS_COLUMN_CLASS} whitespace-nowrap px-0 text-center`}>
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
                        setOpenFilter((current) => (current === 'status' ? null : 'status'));
                      }}
                      aria-label="Filtriraj status"
                    >
                      <ColumnFilterIcon className="!h-[12px] !w-[12px]" />
                    </button>
                  </div>
                </TH>
                <TH className={`${NOTE_COLUMN_CLASS} whitespace-nowrap px-0 text-center`}>
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
                        setOpenFilter((current) => (current === 'note' ? null : 'note'));
                      }}
                      aria-label="Filtriraj opombe"
                    >
                      <ColumnFilterIcon className="!h-[12px] !w-[12px]" />
                    </button>
                  </div>
                </TH>
                <TH className="w-[5%] px-2 text-center">Uredi</TH>
              </TR>
            </THead>
            <tbody>
              {pagedFamilies.map((row) => {
                const { family, visibleVariants, minPrice, maxPrice, discounts } = row;
                const isExpanded = expandedFamilyIds.has(family.id);
                const hasSubtable = visibleVariants.length > 0;
                const isEditingFamily = editingFamilyId === family.id;
                const familyDraft = familyDrafts[family.id] ?? {
                  name: family.name,
                  sku: getBaseSku(family),
                  categoryPath: family.categoryPath.length > 0 ? family.categoryPath : normalizeCategoryPath(family.category),
                  active: family.active,
                  badge: family.itemBadge || 'na-zalogi'
                };
                const draftVisibleVariants = visibleVariants.map((variant) => getVariantDraftForState(variant, variantDrafts));
                const draftActionPrices = draftVisibleVariants
                  .map((draft) => getVariantSalePrice(draft))
                  .filter((value): value is number => value !== null);
                const rawActionPrices = visibleVariants
                  .filter((variant) => variant.discountPct > 0)
                  .map((variant) => computeSalePrice(variant.price, variant.discountPct));
                return (
                  <Fragment key={family.id}>
                    <tr className={`border-t border-slate-100 bg-white ${adminTableRowToneClasses.hover}`} data-edit-scope={`family:${family.id}`}>
                      <td className="w-10 px-2 py-2 text-center"><AdminCheckbox checked={selectedFamilyIds.has(family.id)} onChange={() => setSelectedFamilyIds((current) => {
                        const next = new Set(current);
                        if (next.has(family.id)) next.delete(family.id); else next.add(family.id);
                        return next;
                      })} aria-label={`Izberi ${family.name}`} /></td>
                      <td className="px-2 py-3">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            disabled={!hasSubtable}
                            className="inline-flex h-6 w-6 items-center justify-center rounded-md text-slate-500 transition hover:bg-slate-100 disabled:cursor-default disabled:hover:bg-transparent"
                            onClick={() =>
                              setExpandedFamilyIds((current) => {
                                if (!hasSubtable) return current;
                                const next = new Set(current);
                                if (next.has(family.id)) next.delete(family.id);
                                else next.add(family.id);
                                return next;
                              })
                            }
                            aria-label={isExpanded ? `Skrij različice za ${family.name}` : `Prikaži različice za ${family.name}`}
                          >
                            <span className="inline-flex h-4 w-4 items-center justify-center">{hasSubtable ? (isExpanded ? '▾' : '▸') : ''}</span>
                          </button>
                          {isEditingFamily ? (
                            <div className={`${QUICK_EDIT_NAME_SHELL_CLASS} flex-1`}>
                              <input
                                className={QUICK_EDIT_NAME_INPUT_CLASS}
                                value={familyDraft.name}
                                onChange={(event) => setFamilyDrafts((current) => ({ ...current, [family.id]: { ...familyDraft, name: event.target.value } }))}
                              />
                            </div>
                          ) : (
                            <button type="button" className="min-w-0 flex-1 text-left" onClick={() => router.push(getItemEditHref(family))}>
                              <span className="block truncate text-[12px] font-semibold text-slate-900 transition hover:text-[color:var(--blue-500)] hover:underline underline-offset-2">
                                {family.name}
                              </span>
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="px-2 py-3 text-slate-600">{isEditingFamily ? <input className={ROW_EDIT_INPUT_CLASS} value={familyDraft.sku} onChange={(event) => setFamilyDrafts((current) => ({ ...current, [family.id]: { ...familyDraft, sku: event.target.value } }))} /> : (getBaseSku(family) || '—')}</td>
                      <td className="px-2 py-3 text-slate-600">
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
                            <AdminCategoryBreadcrumbPicker
                              value={family.categoryPath.length > 0 ? family.categoryPath : normalizeCategoryPath(family.category)}
                              onChange={() => {}}
                              categoryPaths={categoryPaths}
                              disabled
                              className="flex h-7 items-center rounded-md bg-transparent px-1 !py-0 text-[12px] [&_input]:text-[12px] [&_span]:text-[12px]"
                            />
                          </div>
                        )}
                      </td>
                      <td className="w-[6.83%] whitespace-nowrap px-2 py-3 text-right">
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
                        ) : formatCurrencyRange(minPrice, maxPrice)}
                      </td>
                      <td className="w-[6.83%] px-2 py-3 text-right text-emerald-700">
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
                        ) : formatPercentRange(discounts)}
                      </td>
                      <td className="w-[10.33%] px-2 py-3 text-right">
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
                        ) : rawActionPrices.length ? formatCurrencyRangeFromValues(rawActionPrices) : '—'}
                      </td>
                      <td className={`${STATUS_COLUMN_CLASS} px-0 py-3 text-center`}><div className={STATUS_NOTE_CELL_INNER_CLASS}><ActiveStateChip active={familyDraft.active} editable={isEditingFamily} editScope={`family:${family.id}`} chipClassName="!min-w-[92px] !text-[11px]" onChange={(next) => updateFamilyDraft(family.id, familyDraft, (current) => ({ ...current, active: next }))} /></div></td>
                      <td className={`${NOTE_COLUMN_CLASS} px-0 py-3 text-center`}>
                        {isEditingFamily
                          ? <div className={STATUS_NOTE_CELL_INNER_CLASS}><NoteTagChip value={(familyDraft.badge || 'na-zalogi') as NoteTag} editable editScope={`family:${family.id}`} chipClassName="!min-w-[97px] !text-[11px]" placeholderLabel="Opombe" onChange={(next) => updateFamilyDraft(family.id, familyDraft, (current) => ({ ...current, badge: (next || 'na-zalogi') as NoteValue }))} /></div>
                          : <div className={STATUS_NOTE_CELL_INNER_CLASS}><NoteTagChip value={(family.itemBadge || 'na-zalogi') as NoteTag} editable={false} editScope={`family:${family.id}`} chipClassName="!min-w-[97px] !text-[11px]" placeholderLabel="Opombe" onChange={() => {}} /></div>}
                      </td>
                      <td className="w-[5%] px-2 py-3 text-center"><RowActionsDropdown label={`Možnosti za ${family.name}`} editScope={`family:${family.id}`} items={[{ key: 'quick-edit', label: 'Hitro urejanje', icon: <PencilIcon />, onSelect: () => startFamilyEdit(family, visibleVariants) }, { key: 'save', label: 'Shrani', icon: <SaveIcon />, disabled: !isEditingFamily, onSelect: () => { void saveFamilyEdit(family, visibleVariants, familyDraft); } }, { key: 'edit', label: 'Uredi', onSelect: () => router.push(getItemEditHref(family)) }]} /></td>
                    </tr>
                    {isExpanded && hasSubtable ? (
                      <tr className="border-t border-slate-100 bg-slate-50/70">
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
                                const isEditing = isEditingFamily;
                                const draft = variantDrafts[variant.id] ?? createVariantDraft(variant);
                                const actionPrice = draft.discountPct > 0 ? computeSalePrice(draft.price, draft.discountPct) : null;
                                return (
                                  <tr key={variant.id} className="border-t border-slate-100" data-edit-scope={`family:${family.id}`}>
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
                                          className={ROW_EDIT_INPUT_CLASS}
                                          value={draft.sku}
                                          onChange={(event) =>
                                            setVariantDrafts((current) => ({
                                              ...current,
                                              [variant.id]: { ...draft, sku: event.target.value }
                                            }))
                                          }
                                        />
                                      ) : (
                                        draft.sku
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
                                              value={readVariantNumericInputValue(variant, draft, 'price')}
                                              placeholder={formatDecimalForDisplay(draft.price)}
                                              onChange={(event) => updateNumericDraft('variant', variant.id, 'price', event.target.value)}
                                              onBlur={() => commitVariantNumericDraft(variant, 'price')}
                                            />
                                            <span className={compactTableAdornmentClassName}>€</span>
                                          </span>
                                        </span>
                                      ) : (
                                        formatCurrency(draft.price)
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
                                        `${draft.discountPct}%`
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
                                      ) : actionPrice === null ? '—' : formatCurrency(actionPrice)}
                                    </td>
                                    <td className={`${STATUS_COLUMN_CLASS} px-0 py-2 text-center`}>
                                      <div className={STATUS_NOTE_CELL_INNER_CLASS}>
                                        <ActiveStateChip
                                          active={draft.active}
                                          editable={isEditing}
                                          editScope={`variant:${variant.id}`}
                                          chipClassName="!min-w-[92px] !text-[11px]"
                                          onChange={(next) =>
                                            setVariantDrafts((current) => ({
                                              ...current,
                                              [variant.id]: { ...draft, active: next }
                                            }))
                                          }
                                        />
                                      </div>
                                    </td>
                                    <td className={`${NOTE_COLUMN_CLASS} px-0 py-2 text-center`}>
                                      {isEditing ? (
                                        <div className={STATUS_NOTE_CELL_INNER_CLASS}>
                                          <NoteTagChip
                                            value={(draft.note || 'na-zalogi') as NoteTag}
                                            editable
                                            editScope={`variant:${variant.id}`}
                                            chipClassName="!min-w-[97px] !text-[11px]"
                                            onChange={(next) =>
                                              setVariantDrafts((current) => ({
                                                ...current,
                                                [variant.id]: { ...draft, note: (next || 'na-zalogi') as NoteValue }
                                              }))
                                            }
                                          />
                                        </div>
                                      ) : (
                                        <div className={STATUS_NOTE_CELL_INNER_CLASS}><NoteTagChip value={(draft.note || 'na-zalogi') as NoteTag} editable={false} editScope={`variant:${variant.id}`} chipClassName="!min-w-[97px] !text-[11px]" onChange={() => {}} /></div>
                                      )}
                                    </td>
                                    <td className="w-[5%] px-2 py-2 text-center">
                                      {isEditing ? (
                                        <input
                                          type="number"
                                          className={`${ROW_EDIT_INPUT_CLASS} mx-auto w-[20%] text-center`}
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
                    onClick={() => {
                      setCategoryFilter(option.value);
                      setOpenFilter(null);
                    }}
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
              onConfirm={() => {
                setPriceRangeFilter(draftPriceRangeFilter);
                setOpenFilter(null);
              }}
              onReset={() => {
                setDraftPriceRangeFilter({ min: '', max: '' });
                setPriceRangeFilter({ min: '', max: '' });
                setOpenFilter(null);
              }}
              minPlaceholder="Min cena"
              maxPlaceholder="Max cena"
              min={0}
            />
          </div>
        ) : null}
        {openFilter === 'discount' ? (
          <div style={getHeaderPopoverStyle(discountFilterButtonRef.current, 160)}>
            <MenuPanel className="w-40 shadow-lg">
              <MenuItem onClick={() => { setDiscountFilter('all'); setOpenFilter(null); }}>Vsi</MenuItem>
              <MenuItem onClick={() => { setDiscountFilter('yes'); setOpenFilter(null); }}>S popustom</MenuItem>
              <MenuItem onClick={() => { setDiscountFilter('no'); setOpenFilter(null); }}>Brez popusta</MenuItem>
            </MenuPanel>
          </div>
        ) : null}
        {openFilter === 'actionPriceRange' ? (
          <div style={getHeaderPopoverStyle(actionPriceFilterButtonRef.current, 192)}>
            <AdminRangeFilterPanel
              title="Akcijska cena"
              draftRange={draftActionPriceRangeFilter}
              onDraftChange={setDraftActionPriceRangeFilter}
              onConfirm={() => {
                setActionPriceRangeFilter(draftActionPriceRangeFilter);
                setOpenFilter(null);
              }}
              onReset={() => {
                setDraftActionPriceRangeFilter({ min: '', max: '' });
                setActionPriceRangeFilter({ min: '', max: '' });
                setOpenFilter(null);
              }}
              minPlaceholder="Min akcijska"
              maxPlaceholder="Max akcijska"
              min={0}
            />
          </div>
        ) : null}
        {openFilter === 'note' ? (
          <div style={getHeaderPopoverStyle(noteFilterButtonRef.current, 184)}>
            <MenuPanel className="w-44 shadow-lg">
              <MenuItem onClick={() => { setNoteFilter('all'); setOpenFilter(null); }}>Vse opombe</MenuItem>
              <MenuItem onClick={() => { setNoteFilter('na-zalogi'); setOpenFilter(null); }}>Na zalogi</MenuItem>
              <MenuItem onClick={() => { setNoteFilter('novo'); setOpenFilter(null); }}>Novo</MenuItem>
              <MenuItem onClick={() => { setNoteFilter('akcija'); setOpenFilter(null); }}>V akciji</MenuItem>
              <MenuItem onClick={() => { setNoteFilter('zadnji-kosi'); setOpenFilter(null); }}>Zadnji kosi</MenuItem>
              <MenuItem onClick={() => { setNoteFilter('ni-na-zalogi'); setOpenFilter(null); }}>Ni na zalogi</MenuItem>
            </MenuPanel>
          </div>
        ) : null}
        {openFilter === 'status' ? (
          <div style={getHeaderPopoverStyle(statusFilterButtonRef.current, 144)}>
            <MenuPanel className="w-36 shadow-lg">
              <MenuItem onClick={() => { setStatusFilter('all'); setOpenFilter(null); }}>Vsi</MenuItem>
              <MenuItem onClick={() => { setStatusFilter('active'); setOpenFilter(null); }}>Aktiven</MenuItem>
              <MenuItem onClick={() => { setStatusFilter('inactive'); setOpenFilter(null); }}>Neaktiven</MenuItem>
            </MenuPanel>
          </div>
        ) : null}
      </HeaderFilterPortal>
    </div>
  );
}
