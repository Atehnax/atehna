'use client';

import { Fragment, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/shared/ui/button';
import { AdminTableLayout } from '@/shared/ui/admin-table';
import { AdminCheckbox } from '@/shared/ui/checkbox';
import { AdminSearchInput } from '@/shared/ui/admin-search-input';
import { ColumnFilterIcon, DownloadIcon, PencilIcon, SaveIcon, TrashCanIcon } from '@/shared/ui/icons/AdminActionIcons';
import { MenuItem, MenuPanel } from '@/shared/ui/menu';
import { RowActionsDropdown, Table, THead, TH, TR } from '@/shared/ui/table';
import { EuiTablePagination, useTablePagination } from '@/shared/ui/pagination';
import AdminRangeFilterPanel from '@/shared/ui/admin-range-filter-panel';
import { adminTableRowToneClasses, filterPillTokenClasses } from '@/shared/ui/theme/tokens';
import {
  computeSalePrice,
  formatCurrency,
  type ProductFamily,
  type Variant
} from '@/admin/features/artikli/lib/familyModel';
import { formatDecimalForDisplay } from '@/admin/features/artikli/lib/decimalFormat';
import ActiveStateChip from '@/admin/features/artikli/components/ActiveStateChip';
import AdminCategoryBreadcrumbPicker from '@/admin/features/artikli/components/AdminCategoryBreadcrumbPicker';
import { NoteTagChip, type NoteTag } from '@/admin/features/artikli/components/NoteTagChip';
import type { AdminCatalogListItem, CatalogItemEditorHydration, CatalogItemEditorPayload } from '@/shared/server/catalogItems';

type StatusFilter = 'all' | 'active' | 'inactive';
type DiscountFilter = 'all' | 'yes' | 'no';
type OpenFilter = 'category' | 'status' | 'discount' | 'variantCount' | 'priceRange' | 'actionPriceRange' | null;
type SortState =
  | { column: 'article' | 'sku' | 'category'; direction: 'asc' | 'desc' }
  | { column: 'variantCount' | 'discount' | 'status'; direction: 'desc' | 'asc' }
  | { column: 'priceRange' | 'actionPriceRange'; mode: 'minAsc' | 'minDesc' | 'maxDesc' | 'maxAsc' }
  | null;

const PAGE_SIZE_OPTIONS = [20, 50, 100];
const HEADER_FILTER_BUTTON_CLASS = 'group inline-flex h-[12px] w-[12px] shrink-0 self-center items-center justify-center text-slate-500';
type ListFamily = ProductFamily & { baseSku: string; material: string | null; categoryPath: string[] };
type NoteValue = '' | NoteTag;
const ROW_EDIT_INPUT_CLASS = 'h-7 w-full rounded-md border border-slate-300 bg-white px-2 text-xs text-slate-900 outline-none transition focus:border-[#3e67d6] focus:ring-0';

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
const itemStatusLabel = (active: boolean) => (active ? 'Aktiven' : 'Neaktiven');
const formatPercentRange = (values: number[]) => {
  if (!values.length) return '—';
  const min = Math.min(...values);
  const max = Math.max(...values);
  const minLabel = formatDecimalForDisplay(min);
  const maxLabel = formatDecimalForDisplay(max);
  return min === max ? `${maxLabel}%` : `${minLabel}–${maxLabel}%`;
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
      notes: item.adminNotes ?? '',
      slug: item.slug,
      variants,
      baseSku: item.baseSku ?? '',
      material: item.material
    };
  });
}

function toUpsertPayload(item: CatalogItemEditorHydration): CatalogItemEditorPayload {
  return {
    itemName: item.itemName,
    itemType: item.itemType,
    badge: item.badge,
    status: item.status,
    categoryPath: item.categoryPath,
    sku: item.sku,
    slug: item.slug,
    unit: item.unit,
    brand: item.brand,
    material: item.material,
    colour: item.colour,
    shape: item.shape,
    description: item.description,
    adminNotes: item.adminNotes,
    position: item.position,
    variants: item.variants.map((variant) => ({
      variantName: variant.variantName,
      length: variant.length,
      width: variant.width,
      thickness: variant.thickness,
      weight: variant.weight,
      errorTolerance: variant.errorTolerance,
      price: variant.price,
      discountPct: variant.discountPct,
      inventory: variant.inventory,
      minOrder: variant.minOrder,
      variantSku: variant.variantSku,
      unit: variant.unit,
      status: variant.status,
      badge: variant.badge,
      position: variant.position
    })),
    media: item.media.map((media) => ({
      mediaKind: media.mediaKind,
      role: media.role,
      sourceKind: media.sourceKind,
      filename: media.filename,
      blobUrl: media.blobUrl,
      blobPathname: media.blobPathname,
      externalUrl: media.externalUrl,
      mimeType: media.mimeType,
      altText: media.altText,
      position: media.position,
      variantIndex: media.variantIndex
    }))
  };
}

export default function AdminItemsManager({ items }: { items: AdminCatalogListItem[] }) {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [discountFilter, setDiscountFilter] = useState<DiscountFilter>('all');
  const [openFilter, setOpenFilter] = useState<OpenFilter>(null);
  const [expandedFamilyIds, setExpandedFamilyIds] = useState<Set<string>>(new Set());
  const [selectedFamilyIds, setSelectedFamilyIds] = useState<Set<string>>(new Set());
  const [selectedVariantIds, setSelectedVariantIds] = useState<Set<string>>(new Set());
  const [editingVariantId, setEditingVariantId] = useState<string | null>(null);
  const [editingFamilyId, setEditingFamilyId] = useState<string | null>(null);
  const [deletedVariantIds, setDeletedVariantIds] = useState<Set<string>>(new Set());
  const [familyDrafts, setFamilyDrafts] = useState<
    Record<string, { name: string; sku: string; categoryPath: string[]; active: boolean; note: NoteValue; price: number; discountPct: number; stock: number; minOrder: number }>
  >({});
  const [variantDrafts, setVariantDrafts] = useState<
    Record<string, { label: string; sku: string; price: number; discountPct: number; stock: number; active: boolean; minOrder: number; note: NoteValue; position: number }>
  >({});
  const [categoryPaths, setCategoryPaths] = useState<string[]>([]);
  const [sortState, setSortState] = useState<SortState>(null);
  const [variantCountRange, setVariantCountRange] = useState<{ min: string; max: string }>({ min: '', max: '' });
  const [draftVariantCountRange, setDraftVariantCountRange] = useState<{ min: string; max: string }>({ min: '', max: '' });
  const [priceRangeFilter, setPriceRangeFilter] = useState<{ min: string; max: string }>({ min: '', max: '' });
  const [draftPriceRangeFilter, setDraftPriceRangeFilter] = useState<{ min: string; max: string }>({ min: '', max: '' });
  const [actionPriceRangeFilter, setActionPriceRangeFilter] = useState<{ min: string; max: string }>({ min: '', max: '' });
  const [draftActionPriceRangeFilter, setDraftActionPriceRangeFilter] = useState<{ min: string; max: string }>({ min: '', max: '' });

  const families = useMemo(() => toListFamilies(items), [items]);
  const categories = useMemo(() => Array.from(new Set(families.map((family) => family.category))).sort((a, b) => a.localeCompare(b, 'sl')), [families]);

  useEffect(() => {
    let cancelled = false;
    const loadCategoryPaths = async () => {
      try {
        const response = await fetch('/api/admin/categories/paths', { cache: 'no-store' });
        if (!response.ok) return;
        const payload = (await response.json()) as { paths?: string[] };
        const nextPaths = Array.isArray(payload.paths) ? payload.paths : [];
        if (cancelled) return;
        const fromRows = families
          .map((family) => family.categoryPath.join(' / '))
          .filter((entry) => entry.length > 0);
        setCategoryPaths(Array.from(new Set([...fromRows, ...nextPaths])));
      } catch {
        if (cancelled) return;
        const fallback = families
          .map((family) => family.categoryPath.join(' / '))
          .filter((entry) => entry.length > 0);
        setCategoryPaths(Array.from(new Set(fallback)));
      }
    };
    void loadCategoryPaths();
    return () => {
      cancelled = true;
    };
  }, [families]);

  const filteredFamilies = useMemo(() => {
    const q = search.trim().toLowerCase();
    return families.filter((family) => {
      const matchesSearch =
        q.length === 0 ||
        family.name.toLowerCase().includes(q) ||
        getBaseSku(family).toLowerCase().includes(q) ||
        family.variants.some((variant) => variant.sku.toLowerCase().includes(q) || variant.label.toLowerCase().includes(q));
      const matchesCategory = categoryFilter === 'all' || family.category === categoryFilter;
      const matchesStatus = statusFilter === 'all' || (statusFilter === 'active' ? family.active : !family.active);
      const hasDiscount = family.defaultDiscountPct > 0 || family.variants.some((variant) => variant.discountPct > 0);
      const matchesDiscount = discountFilter === 'all' || (discountFilter === 'yes' ? hasDiscount : !hasDiscount);
      return matchesSearch && matchesCategory && matchesStatus && matchesDiscount;
    });
  }, [categoryFilter, discountFilter, families, search, statusFilter]);

  const flatVariants = useMemo(() => {
    const rows: Array<{ family: ProductFamily; variant: Variant }> = [];
    filteredFamilies.forEach((family) => {
      family.variants.forEach((variant) => {
        rows.push({ family, variant });
      });
    });
    return rows;
  }, [filteredFamilies]);

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
  }, [actionPriceRangeFilter.max, actionPriceRangeFilter.min, categoryFilter, discountFilter, priceRangeFilter.max, priceRangeFilter.min, search, setPage, statusFilter, variantCountRange.max, variantCountRange.min]);

  const exportVariantsCsv = () => {
    const headers = ['Družina', 'Različica', 'SKU', 'Cena', 'Popust', 'Akcijska cena', 'Zaloga', 'Status'];
    const csvRows = flatVariants.map(({ family, variant }) => [
      family.name,
      variant.label,
      variant.sku,
      variant.price.toFixed(2),
      `${variant.discountPct}`,
      `${computeSalePrice(variant.price, variant.discountPct).toFixed(2)}`,
      `${variant.stock}`,
      itemStatusLabel(variant.active)
    ]);

    const csv = [headers, ...csvRows].map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'artikli-razlicice.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  const allVisibleFamilyIds = useMemo(() => new Set(pagedFamilies.map((row) => row.family.id)), [pagedFamilies]);
  const familiesSelectedOnPage = pagedFamilies.length > 0 && pagedFamilies.every((row) => selectedFamilyIds.has(row.family.id));
  const persistItemBySlug = async (
    slug: string,
    mutate: (payload: CatalogItemEditorPayload, hydration: CatalogItemEditorHydration) => void
  ) => {
    const readResponse = await fetch(`/api/admin/artikli/${encodeURIComponent(slug)}`, { cache: 'no-store' });
    if (!readResponse.ok) throw new Error('Nalagam podatke artikla ni uspelo.');
    const hydration = (await readResponse.json()) as CatalogItemEditorHydration;
    const payload = toUpsertPayload(hydration);
    mutate(payload, hydration);
    const saveResponse = await fetch('/api/admin/artikli', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!saveResponse.ok) {
      const body = (await saveResponse.json().catch(() => ({}))) as { message?: string };
      throw new Error(body.message || 'Shranjevanje artikla ni uspelo.');
    }
  };
  const startVariantEdit = (variant: Variant) => {
    setEditingVariantId(variant.id);
    setVariantDrafts((current) => ({
      ...current,
      [variant.id]: {
        label: variant.label,
        sku: variant.sku,
        price: variant.price,
        discountPct: variant.discountPct,
        stock: variant.stock,
        active: variant.active,
        minOrder: variant.minOrder ?? 1,
        note: (variant.badge as NoteValue) ?? '',
        position: variant.position ?? 1
      }
    }));
  };
  const saveVariantEdit = async (family: ListFamily, variantId: string) => {
    const draft = variantDrafts[variantId];
    if (!draft) return;
    try {
      await persistItemBySlug(family.slug || family.id, (payload, hydration) => {
        const index = hydration.variants.findIndex((variant) => String(variant.id) === variantId);
        if (index < 0 || !payload.variants[index]) return;
        payload.variants[index] = {
          ...payload.variants[index],
          variantName: draft.label,
          variantSku: draft.sku,
          price: draft.price,
          discountPct: draft.discountPct,
          inventory: draft.stock,
          minOrder: Math.max(1, draft.minOrder),
          status: draft.active ? 'active' : 'inactive',
          badge: draft.note || null,
          position: Math.max(1, draft.position)
        };
      });
      setEditingVariantId(null);
      router.refresh();
    } catch (error) {
      console.error(error);
    }
  };
  const startFamilyEdit = (family: ListFamily, variants: Variant[]) => {
    setEditingFamilyId(family.id);
    const primary = variants[0];
    setFamilyDrafts((current) => ({
      ...current,
      [family.id]: {
        name: family.name,
        sku: getBaseSku(family),
        categoryPath: family.categoryPath.length > 0 ? family.categoryPath : normalizeCategoryPath(family.category),
        active: family.active,
        note: (family.notes as NoteValue) || '',
        price: primary?.price ?? 0,
        discountPct: primary?.discountPct ?? 0,
        stock: primary?.stock ?? 0,
        minOrder: Math.max(1, primary?.minOrder ?? 1)
      }
    }));
  };
  const saveFamilyEdit = async (family: ListFamily, variants: Variant[]) => {
    const draft = familyDrafts[family.id];
    if (!draft) return;
    try {
      await persistItemBySlug(family.slug || family.id, (payload) => {
        payload.itemName = draft.name;
        payload.sku = draft.sku || null;
        payload.status = draft.active ? 'active' : 'inactive';
        payload.adminNotes = draft.note || null;
        if (draft.categoryPath.length > 0) {
          payload.categoryPath = draft.categoryPath;
        }
        if (variants.length <= 1 && payload.variants[0]) {
          payload.variants[0] = {
            ...payload.variants[0],
            price: draft.price,
            discountPct: draft.discountPct,
            inventory: draft.stock,
            minOrder: Math.max(1, draft.minOrder),
            variantSku: draft.sku || payload.variants[0].variantSku
          };
        }
      });
      setEditingFamilyId(null);
      router.refresh();
    } catch (error) {
      console.error(error);
    }
  };
  const removeVariantRow = (variantId: string) =>
    setDeletedVariantIds((current) => {
      const next = new Set(current);
      next.add(variantId);
      return next;
    });
  const getSortTitleClass = (column: 'article' | 'sku' | 'category' | 'variantCount' | 'discount' | 'priceRange' | 'actionPriceRange' | 'status') =>
    `inline-flex items-center text-[11px] font-semibold leading-none hover:text-[color:var(--blue-500)] ${
      sortState && 'column' in sortState && sortState.column === column ? 'underline underline-offset-2 text-[color:var(--blue-500)]' : ''
    }`;
  const cycleSort = (column: 'article' | 'sku' | 'category' | 'variantCount' | 'discount' | 'priceRange' | 'actionPriceRange' | 'status') => {
    setSortState((current) => {
      if (column === 'article' || column === 'sku' || column === 'category') {
        if (!current || !('column' in current) || current.column !== column) return { column, direction: 'asc' };
        if ('direction' in current && current.direction === 'asc') return { column, direction: 'desc' };
        return null;
      }
      if (column === 'variantCount' || column === 'discount' || column === 'status') {
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

  useEffect(() => {
    const handlePointerDownOutsideEdit = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;

      if (editingFamilyId) {
        const familyScope = `family:${editingFamilyId}`;
        if (
          target.closest(`tr[data-edit-scope="${familyScope}"]`) ||
          target.closest(`[data-edit-scope="${familyScope}"]`)
        ) {
          return;
        }
        setEditingFamilyId(null);
      }

      if (editingVariantId) {
        const variantScope = `variant:${editingVariantId}`;
        if (
          target.closest(`tr[data-edit-scope="${variantScope}"]`) ||
          target.closest(`[data-edit-scope="${variantScope}"]`)
        ) {
          return;
        }
        setEditingVariantId(null);
      }
    };

    document.addEventListener('mousedown', handlePointerDownOutsideEdit);
    return () => {
      document.removeEventListener('mousedown', handlePointerDownOutsideEdit);
    };
  }, [editingFamilyId, editingVariantId]);

  return (
    <div className="space-y-4 font-['Inter',system-ui,sans-serif]">
      <AdminTableLayout
        className="border shadow-sm"
        style={{ background: '#fff', borderColor: '#e2e8f0', boxShadow: '0 10px 24px rgba(15,23,42,0.06)' }}
        headerClassName="!bg-white"
        headerLeft={
          <div className="flex h-7 w-full items-center gap-2">
            <div className="min-w-0 w-full rounded-md border border-slate-200 bg-white transition-colors focus-within:border-[#3e67d6]">
              <AdminSearchInput
                showIcon={false}
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Poišči artikel ali SKU ..."
                aria-label="Poišči artikel ali SKU"
                className="!m-0 !h-7 min-w-0 w-full flex-1 !rounded-md !border-0 !bg-transparent !shadow-none !outline-none ring-0 transition-colors placeholder:text-slate-400 [--euiFormControlStateWidth:0px] focus:[--euiFormControlStateWidth:0px] focus-visible:[--euiFormControlStateWidth:0px] focus:!border-0 focus:!shadow-none focus:!outline-none focus-visible:!border-0 focus-visible:!shadow-none focus-visible:!outline-none"
              />
            </div>
          </div>
        }
        headerRight={
          <div className="flex items-center gap-2">
            <Button type="button" variant="default" size="toolbar" onClick={exportVariantsCsv}>
              <DownloadIcon />
              Izvozi CSV
            </Button>
            <Button
              type="button"
              variant="primary"
              size="toolbar"
              className="!h-7 !rounded-md"
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
                  <div className="relative inline-flex items-center gap-1">
                    <button type="button" className={getSortTitleClass('category')} onClick={() => cycleSort('category')}>
                      Kategorija
                    </button>
                    <button
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
                    {openFilter === 'category' ? (
                      <div className="absolute left-0 top-5 z-20" onClick={(event) => event.stopPropagation()}>
                        <MenuPanel className="w-[18.4rem]">
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
                  </div>
                </TH>
                <TH className="w-[6.83%] text-right">
                  <div className="relative inline-flex items-center gap-1">
                    <button type="button" className={getSortTitleClass('priceRange')} onClick={() => cycleSort('priceRange')}>
                      Cena
                    </button>
                    <button
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
                    {openFilter === 'priceRange' ? (
                      <div className="absolute left-0 top-5 z-20" onClick={(event) => event.stopPropagation()}>
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
                  </div>
                </TH>
                <TH className="w-[6.83%] whitespace-nowrap text-right">
                  <div className="relative inline-flex items-center gap-1">
                    <button type="button" className={getSortTitleClass('discount')} onClick={() => cycleSort('discount')}>
                      Popust
                    </button>
                    <button
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
                    {openFilter === 'discount' ? (
                      <div className="absolute left-0 top-5 z-20" onClick={(event) => event.stopPropagation()}>
                        <MenuPanel className="w-40">
                          <MenuItem onClick={() => { setDiscountFilter('all'); setOpenFilter(null); }}>Vsi</MenuItem>
                          <MenuItem onClick={() => { setDiscountFilter('yes'); setOpenFilter(null); }}>S popustom</MenuItem>
                          <MenuItem onClick={() => { setDiscountFilter('no'); setOpenFilter(null); }}>Brez popusta</MenuItem>
                        </MenuPanel>
                      </div>
                    ) : null}
                  </div>
                </TH>
                <TH className="w-[6.83%] whitespace-nowrap text-right">
                  <div className="relative inline-flex items-center gap-1">
                    <button type="button" className={getSortTitleClass('actionPriceRange')} onClick={() => cycleSort('actionPriceRange')}>
                      Akcijska cena
                    </button>
                    <button
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
                    {openFilter === 'actionPriceRange' ? (
                      <div className="absolute left-0 top-5 z-20" onClick={(event) => event.stopPropagation()}>
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
                  </div>
                </TH>
                <TH className="w-[10.25%] whitespace-nowrap px-0 text-center">
                  <div className="relative inline-flex items-center gap-1">
                    <button type="button" className={getSortTitleClass('status')} onClick={() => cycleSort('status')}>
                      Status
                    </button>
                    <button
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
                    {openFilter === 'status' ? (
                      <div className="absolute left-0 top-5 z-20" onClick={(event) => event.stopPropagation()}>
                        <MenuPanel className="w-36">
                          <MenuItem onClick={() => { setStatusFilter('all'); setOpenFilter(null); }}>Vsi</MenuItem>
                          <MenuItem onClick={() => { setStatusFilter('active'); setOpenFilter(null); }}>Aktiven</MenuItem>
                          <MenuItem onClick={() => { setStatusFilter('inactive'); setOpenFilter(null); }}>Neaktiven</MenuItem>
                        </MenuPanel>
                      </div>
                    ) : null}
                  </div>
                </TH>
                <TH className="w-[10.25%] whitespace-nowrap px-0 text-center">Opombe</TH>
                <TH className="w-[4%] text-center">Uredi</TH>
              </TR>
            </THead>
            <tbody>
              {pagedFamilies.map((row) => {
                const { family, visibleVariants, minPrice, maxPrice, discounts } = row;
                const isExpanded = expandedFamilyIds.has(family.id);
                const hasSubtable = visibleVariants.length > 0;
                const primaryVariant = visibleVariants[0] ?? null;
                const isEditingFamily = editingFamilyId === family.id;
                const familyDraft = familyDrafts[family.id] ?? {
                  name: family.name,
                  sku: getBaseSku(family),
                  categoryPath: family.categoryPath.length > 0 ? family.categoryPath : normalizeCategoryPath(family.category),
                  active: family.active,
                  note: (family.notes as NoteValue) || '',
                  price: primaryVariant?.price ?? 0,
                  discountPct: primaryVariant?.discountPct ?? 0,
                  stock: primaryVariant?.stock ?? 0,
                  minOrder: Math.max(1, primaryVariant?.minOrder ?? 1)
                };
                const singleRowLike = visibleVariants.length <= 1;
                return (
                  <Fragment key={family.id}>
                    <tr className={`border-t border-slate-100 bg-white ${adminTableRowToneClasses.hover}`} data-edit-scope={`family:${family.id}`}>
                      <td className="w-10 px-2 py-2 text-center"><AdminCheckbox checked={selectedFamilyIds.has(family.id)} onChange={() => setSelectedFamilyIds((current) => {
                        const next = new Set(current);
                        if (next.has(family.id)) next.delete(family.id); else next.add(family.id);
                        return next;
                      })} aria-label={`Izberi ${family.name}`} /></td>
                      <td className="px-2 py-3">
                        <button type="button" disabled={!hasSubtable} className="inline-flex items-start gap-2 text-left disabled:cursor-default" onClick={() => setExpandedFamilyIds((current) => {
                          if (!hasSubtable) return current;
                          const next = new Set(current);
                          if (next.has(family.id)) next.delete(family.id); else next.add(family.id);
                          return next;
                        })}>
                          <span className="mt-0.5 inline-flex h-4 w-4 items-center justify-center text-slate-500">{hasSubtable ? (isExpanded ? '▾' : '▸') : ''}</span>
                          {isEditingFamily
                            ? <input className="h-8 w-full rounded-md border border-slate-300 bg-white px-2 text-sm" value={familyDraft.name} onChange={(event) => setFamilyDrafts((current) => ({ ...current, [family.id]: { ...familyDraft, name: event.target.value } }))} />
                            : <span className="block text-sm font-semibold text-slate-900">{family.name}</span>}
                        </button>
                      </td>
                      <td className="px-2 py-3 text-slate-600">{isEditingFamily ? <input className={ROW_EDIT_INPUT_CLASS} value={familyDraft.sku} onChange={(event) => setFamilyDrafts((current) => ({ ...current, [family.id]: { ...familyDraft, sku: event.target.value } }))} /> : (getBaseSku(family) || '—')}</td>
                      <td className="px-2 py-3 text-slate-600">
                        {isEditingFamily ? (
                          <div className="min-w-0">
                            <AdminCategoryBreadcrumbPicker
                              value={familyDraft.categoryPath}
                              onChange={(nextPath) => setFamilyDrafts((current) => ({ ...current, [family.id]: { ...familyDraft, categoryPath: nextPath } }))}
                              categoryPaths={categoryPaths}
                              className="flex h-7 items-center rounded-md bg-transparent px-1 !py-0 text-xs"
                            />
                          </div>
                        ) : (
                          <div className="min-w-0">
                            <AdminCategoryBreadcrumbPicker
                              value={family.categoryPath.length > 0 ? family.categoryPath : normalizeCategoryPath(family.category)}
                              onChange={() => {}}
                              categoryPaths={categoryPaths}
                              disabled
                              className="flex h-7 items-center rounded-md bg-transparent px-1 !py-0 text-xs"
                            />
                          </div>
                        )}
                      </td>
                      <td className="w-[6.83%] px-2 py-3 text-right">{singleRowLike && isEditingFamily ? <input type="number" step="0.01" className={ROW_EDIT_INPUT_CLASS} value={familyDraft.price} onChange={(event) => setFamilyDrafts((current) => ({ ...current, [family.id]: { ...familyDraft, price: Number(event.target.value) || 0 } }))} /> : formatCurrencyRange(minPrice, maxPrice)}</td>
                      <td className="w-[6.83%] px-2 py-3 text-right text-emerald-700">{singleRowLike && isEditingFamily ? <input type="number" className="h-8 w-full rounded-md border border-slate-300 bg-white px-2 text-right text-sm" value={familyDraft.discountPct} onChange={(event) => setFamilyDrafts((current) => ({ ...current, [family.id]: { ...familyDraft, discountPct: Number(event.target.value) || 0 } }))} /> : formatPercentRange(discounts)}</td>
                      <td className="w-[6.83%] px-2 py-3 text-right">{singleRowLike ? (familyDraft.discountPct > 0 ? formatCurrency(computeSalePrice(familyDraft.price, familyDraft.discountPct)) : '—') : (() => {
                        const discounted = visibleVariants.filter((variant) => variant.discountPct > 0).map((variant) => computeSalePrice(variant.price, variant.discountPct));
                        return discounted.length ? formatCurrencyRangeFromValues(discounted) : '—';
                      })()}</td>
                      <td className="w-[10.25%] px-0 py-3 text-center"><div className="flex justify-center px-1"><ActiveStateChip active={familyDraft.active} editable={isEditingFamily} editScope={`family:${family.id}`} chipClassName="!min-w-[92px] !text-[11px]" onChange={(next) => setFamilyDrafts((current) => ({ ...current, [family.id]: { ...familyDraft, active: next } }))} /></div></td>
                      <td className="w-[10.25%] px-0 py-3 text-center">
                        {isEditingFamily
                          ? <div className="flex justify-center px-1"><NoteTagChip value={familyDraft.note} editable allowEmpty editScope={`family:${family.id}`} chipClassName="!min-w-[97px] !text-[11px]" placeholderLabel="Opombe" onChange={(next) => setFamilyDrafts((current) => ({ ...current, [family.id]: { ...familyDraft, note: next as NoteValue } }))} /></div>
                          : <div className="flex justify-center px-1"><NoteTagChip value={(family.notes?.trim() as NoteValue) || ''} editable={false} allowEmpty editScope={`family:${family.id}`} chipClassName="!min-w-[97px] !text-[11px]" placeholderLabel="Opombe" onChange={() => {}} /></div>}
                      </td>
                      <td className="w-[4%] px-1 py-3 text-center"><RowActionsDropdown label={`Možnosti za ${family.name}`} items={[{ key: 'quick-edit', label: 'Hitro urejanje', icon: <PencilIcon />, onSelect: () => startFamilyEdit(family, visibleVariants) }, { key: 'save', label: 'Shrani', icon: <SaveIcon />, disabled: !isEditingFamily, onSelect: () => { void saveFamilyEdit(family, visibleVariants); } }, { key: 'edit', label: 'Uredi', onSelect: () => router.push(`/admin/artikli/${encodeURIComponent(family.slug || family.id)}`) }]} /></td>
                    </tr>
                    {isExpanded && hasSubtable ? (
                      <tr className="border-t border-slate-100 bg-slate-50/70">
                        <td />
                        <td colSpan={9} className="p-0">
                          <table className="w-full text-[12px]">
                            <thead>
                              <tr className="border-b border-slate-200 text-slate-600">
                                <th className="px-2 py-2" />
                                <th className="w-[25%] px-2 py-2 text-left">Različica</th>
                                <th className="w-[20%] px-2 py-2 text-left">SKU</th>
                                <th className="w-[10.33%] px-2 py-2 text-right">Cena</th>
                                <th className="w-[10.33%] px-2 py-2 text-right">Popust</th>
                                <th className="w-[10.33%] px-2 py-2 text-right">Akcijska cena</th>
                                <th className="w-[120px] px-2 py-2 text-center">Status</th>
                                <th className="w-[124px] px-2 py-2 text-center">Opombe</th>
                                <th className="w-[5%] px-2 py-2 text-center">Mesto</th>
                                <th className="px-2 py-2 text-center">Uredi</th>
                              </tr>
                            </thead>
                            <tbody>
                              {visibleVariants.map((variant) => {
                                const isEditing = editingVariantId === variant.id;
                                const draft = variantDrafts[variant.id] ?? {
                                  label: variant.label || 'Različica',
                                  sku: variant.sku,
                                  price: variant.price,
                                  discountPct: variant.discountPct,
                                  stock: variant.stock,
                                  active: variant.active,
                                  minOrder: variant.minOrder ?? 1,
                                  note: (variant.badge as NoteValue) ?? '',
                                  position: variant.position ?? 1
                                };
                                const actionPrice = draft.discountPct > 0 ? computeSalePrice(draft.price, draft.discountPct) : null;
                                return (
                                  <tr key={variant.id} className="border-t border-slate-100" data-edit-scope={`variant:${variant.id}`}>
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
                                        <input
                                          type="number"
                                          step="0.01"
                                          className={`${ROW_EDIT_INPUT_CLASS} ml-auto w-[32%] text-right`}
                                          value={draft.price}
                                          onChange={(event) =>
                                            setVariantDrafts((current) => ({
                                              ...current,
                                              [variant.id]: { ...draft, price: Number(event.target.value) || 0 }
                                            }))
                                          }
                                        />
                                      ) : (
                                        formatCurrency(draft.price)
                                      )}
                                    </td>
                                    <td className="w-[10.33%] px-2 py-2 text-right text-emerald-700">
                                      {isEditing ? (
                                        <input
                                          type="number"
                                          min={0}
                                          max={100}
                                          className={`${ROW_EDIT_INPUT_CLASS} mx-auto w-[56%] text-center`}
                                          value={draft.discountPct}
                                          onChange={(event) =>
                                            setVariantDrafts((current) => ({
                                              ...current,
                                              [variant.id]: { ...draft, discountPct: Number(event.target.value) || 0 }
                                            }))
                                          }
                                        />
                                      ) : (
                                        `${draft.discountPct}%`
                                      )}
                                    </td>
                                    <td className="w-[10.33%] px-2 py-2 text-right">{actionPrice === null ? '—' : formatCurrency(actionPrice)}</td>
                                    <td className="w-[120px] px-2 py-2 text-center">
                                      <div className="inline-flex justify-center">
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
                                    <td className="w-[124px] px-2 py-2 text-center">
                                      {isEditing ? (
                                        <div className="inline-flex justify-center">
                                          <NoteTagChip
                                            value={(draft.note || 'novo') as NoteTag}
                                            editable
                                            editScope={`variant:${variant.id}`}
                                            chipClassName="!min-w-[97px] !text-[11px]"
                                            onChange={(next) =>
                                              setVariantDrafts((current) => ({
                                                ...current,
                                                [variant.id]: { ...draft, note: (next || 'novo') as NoteValue }
                                              }))
                                            }
                                          />
                                        </div>
                                      ) : (
                                        <div className="inline-flex justify-center"><NoteTagChip value={(draft.note || 'novo') as NoteTag} editable={false} editScope={`variant:${variant.id}`} chipClassName="!min-w-[97px] !text-[11px]" onChange={() => {}} /></div>
                                      )}
                                    </td>
                                    <td className="px-2 py-2 text-center">
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
                                    <td className="px-2 py-2 text-center">
                                      <RowActionsDropdown
                                        label={`Uredi ${variant.sku}`}
                                        items={[
                                          {
                                            key: 'edit',
                                            label: 'Hitro urejanje',
                                            icon: <PencilIcon />,
                                            onSelect: () => startVariantEdit(variant)
                                          },
                                          {
                                            key: 'save',
                                            label: 'Shrani',
                                            icon: <SaveIcon />,
                                            disabled: !isEditing,
                                            onSelect: () => { void saveVariantEdit(family, variant.id); }
                                          },
                                          {
                                            key: 'delete',
                                            label: 'Izbriši',
                                            icon: <TrashCanIcon />,
                                            className: 'text-rose-600 hover:!bg-rose-50 hover:!text-rose-600',
                                            onSelect: () => removeVariantRow(variant.id)
                                          }
                                        ]}
                                      />
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
    </div>
  );
}
