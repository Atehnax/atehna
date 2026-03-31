'use client';

import Image from 'next/image';
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/shared/ui/button';
import { IconButton } from '@/shared/ui/icon-button';
import {
  ArchiveIcon,
  CloseIcon,
  CopyIcon,
  FilterIcon,
  PencilIcon,
  SaveIcon
} from '@/shared/ui/icons/AdminActionIcons';
import { ADMIN_CONTROL_HEIGHT, ADMIN_CONTROL_PADDING_X } from '@/shared/ui/admin-controls/controlSizes';
import { CustomSelect } from '@/shared/ui/select';
import { RowActionsDropdown, Table, THead, TH, TR } from '@/shared/ui/table';
import { Chip } from '@/shared/ui/badge';
import { useToast } from '@/shared/ui/toast';
import { Pagination, PageSizeSelect, useTablePagination } from '@/shared/ui/pagination';
import { AdminTableLayout, ColumnVisibilityControl } from '@/shared/ui/admin-table';
import { adminTableRowToneClasses, buttonTokenClasses, getAdminStripedRowToneClass } from '@/shared/ui/theme/tokens';

type Item = {
  id: string;
  name: string;
  description: string;
  category: string;
  categoryId: string | null;
  subcategoryId: string | null;
  price: number;
  discountPct: number;
  unit: string;
  sku: string;
  active: boolean;
  images: string[];
  updatedAt: string;
  archivedAt?: string | null;
  displayOrder: number | null;
  searchIndex: string;
};

type SeedItemTuple = [
  id: string,
  name: string,
  description: string,
  category: string,
  categoryId: string | null,
  subcategoryId: string | null,
  price: number,
  sku: string,
  images: string[],
  discountPct: number,
  displayOrder: number | null
];

type SortKey = 'name' | 'sku' | 'category' | 'price' | 'status';
type StatusTab = 'active' | 'inactive';
type ItemColumnKey = 'name' | 'sku' | 'category' | 'price' | 'discount' | 'salePrice' | 'status';

const STORAGE_KEY = 'admin-items-crud-v3';
const PAGE_SIZE_OPTIONS = [50, 100];

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('sl-SI', { style: 'currency', currency: 'EUR' }).format(value);

const nowIso = () => new Date().toISOString();
const buildItemSearchIndex = (name: string, sku: string, category: string) =>
  `${name} ${sku} ${category}`.toLowerCase();

const emptyItem = (): Item => ({
  id: crypto.randomUUID(),
  name: '',
  description: '',
  category: '',
  categoryId: null,
  subcategoryId: null,
  price: 0,
  discountPct: 0,
  unit: 'kos',
  sku: '',
  active: true,
  images: [],
  updatedAt: nowIso(),
  archivedAt: null,
  displayOrder: null,
  searchIndex: ''
});

const discountedPrice = (price: number, discountPct: number) =>
  Number((price * (1 - Math.max(0, Math.min(100, discountPct)) / 100)).toFixed(2));

const statusTabs: Array<{ key: StatusTab; label: string }> = [
  { key: 'active', label: 'Aktivni' },
  { key: 'inactive', label: 'Neaktivni' }
];
const itemColumnOptions: Array<{ key: ItemColumnKey; label: string }> = [
  { key: 'name', label: 'Naziv' },
  { key: 'sku', label: 'SKU' },
  { key: 'category', label: 'Kategorija' },
  { key: 'price', label: 'Cena' },
  { key: 'discount', label: 'Popust' },
  { key: 'salePrice', label: 'Akcijska cena' },
  { key: 'status', label: 'Status' }
];

function SortIndicator({ active, direction }: { active: boolean; direction: 'asc' | 'desc' }) {
  if (!active) return <span className="ml-1 text-slate-300">↕</span>;
  return <span className="ml-1 text-slate-500">{direction === 'asc' ? '↑' : '↓'}</span>;
}

function ActionIcon({ type }: { type: 'edit' | 'copy' | 'archive' | 'save' | 'close' }) {
  if (type === 'edit') return <PencilIcon />;
  if (type === 'copy') return <CopyIcon />;
  if (type === 'save') return <SaveIcon />;
  if (type === 'close') return <CloseIcon />;
  return <ArchiveIcon />;
}

function FloatingInput({
  label,
  value,
  onChange,
  type = 'text',
  min,
  max,
  step,
  disabled,
  placeholder = ' '
}: {
  label: string;
  value: string | number;
  onChange: (next: string) => void;
  type?: string;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  placeholder?: string;
}) {
  const filled = String(value ?? '').length > 0;
  return (
    <div className="group relative" data-filled={filled ? 'true' : 'false'}>
      <input
        type={type}
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 pb-1.5 pt-5 text-sm text-slate-900 outline-none transition focus:border-[#3e67d6] focus:ring-0 focus:ring-[#3e67d6] disabled:bg-slate-100 disabled:text-slate-400"
      />
      <label className={`pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 px-0 text-xs text-slate-400 transition-all duration-150 group-focus-within:top-1.5 group-focus-within:translate-y-0 group-focus-within:px-1 group-focus-within:text-[10px] group-focus-within:text-slate-600 group-data-[filled=true]:top-1.5 group-data-[filled=true]:translate-y-0 group-data-[filled=true]:px-1 group-data-[filled=true]:text-[10px] group-data-[filled=true]:text-slate-600 ${disabled ? 'bg-slate-100' : 'bg-white'}`}>
        {label}
      </label>
    </div>
  );
}

function FloatingSelect({
  label,
  value,
  onChange,
  children,
  disabled
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  children: ReactNode;
  disabled?: boolean;
}) {
  return (
    <div className="relative">
      <label className="pointer-events-none absolute left-3 top-1.5 z-10 bg-white px-1 text-[10px] text-slate-600">
        {label}
      </label>
      <select
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 w-full appearance-none rounded-xl border border-slate-300 bg-white px-3 pb-1.5 pt-5 text-sm text-slate-900 outline-none transition focus:border-[#3e67d6] focus:ring-0 focus:ring-[#3e67d6] disabled:bg-slate-100 disabled:text-slate-400"
      >
        {children}
      </select>
    </div>
  );
}

export default function AdminItemsManager({ seedItems }: { seedItems: SeedItemTuple[] }) {
  const normalizedSeedItems = useMemo<Item[]>(
    () =>
      seedItems.map((itemTuple) => ({
        id: itemTuple[0],
        name: itemTuple[1],
        description: itemTuple[2],
        category: itemTuple[3],
        categoryId: itemTuple[4] ?? null,
        subcategoryId: itemTuple[5] ?? null,
        price: itemTuple[6],
        unit: 'kos',
        sku: itemTuple[7],
        active: true,
        images: itemTuple[8],
        discountPct: itemTuple[9],
        displayOrder: itemTuple[10] ?? null,
        updatedAt: nowIso(),
        archivedAt: null,
        searchIndex: buildItemSearchIndex(itemTuple[1], itemTuple[7], itemTuple[3])
      })),
    [seedItems]
  );
  const [items, setItems] = useState<Item[]>(() => normalizedSeedItems);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusTab, setStatusTab] = useState<StatusTab>('active');
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Item>(emptyItem());
  const [newCategoryEnabled, setNewCategoryEnabled] = useState(false);
  const [newCategoryValue, setNewCategoryValue] = useState('');
  const [editorMode, setEditorMode] = useState<'view' | 'edit'>('view');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [visibleColumns, setVisibleColumns] = useState<Record<ItemColumnKey, boolean>>({
    name: true,
    sku: false,
    category: true,
    price: true,
    discount: true,
    salePrice: true,
    status: true
  });
  const hasCompletedInitialStorageHydrationRef = useRef(false);
  const pendingStorageWriteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as Item[];
        if (Array.isArray(parsed)) {
          const canonicalBySku = new Map(normalizedSeedItems.map((item) => [item.sku, item]));
          setItems(
            parsed.map((item) => {
              const canonical = canonicalBySku.get(item.sku);
              return {
                ...item,
                category: canonical?.category ?? item.category,
                categoryId: canonical?.categoryId ?? item.categoryId ?? null,
                subcategoryId: canonical?.subcategoryId ?? item.subcategoryId ?? null,
                archivedAt: item.archivedAt ?? null,
                displayOrder: item.displayOrder ?? null,
                searchIndex: buildItemSearchIndex(item.name, item.sku, canonical?.category ?? item.category)
              };
            })
          );
        }
      } catch {
        // ignore malformed local state
      }
    }
    hasCompletedInitialStorageHydrationRef.current = true;
    return undefined;
  }, [normalizedSeedItems]);

  useEffect(() => {
    if (!hasCompletedInitialStorageHydrationRef.current) {
      hasCompletedInitialStorageHydrationRef.current = true;
      return;
    }

    const persist = () => {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
      pendingStorageWriteTimerRef.current = null;
    };

    if ('requestIdleCallback' in window) {
      const idleId = window.requestIdleCallback(() => persist(), { timeout: 1200 });
      return () => {
        window.cancelIdleCallback(idleId);
      };
    }

    pendingStorageWriteTimerRef.current = globalThis.setTimeout(() => persist(), 250);
    return () => {
      if (pendingStorageWriteTimerRef.current !== null) {
        globalThis.clearTimeout(pendingStorageWriteTimerRef.current);
        pendingStorageWriteTimerRef.current = null;
      }
    };
  }, [items]);


  const canonicalCategoryLabelByRef = useMemo(() => {
    const map = new Map<string, string>();

    normalizedSeedItems.forEach((item) => {
      if (!item.categoryId) return;
      map.set(`${item.categoryId}:${item.subcategoryId ?? ''}`, item.category);
    });

    return map;
  }, [normalizedSeedItems]);

  const getResolvedCategoryLabel = useCallback((item: Item) => {
    if (!item.categoryId) return item.category;
    return canonicalCategoryLabelByRef.get(`${item.categoryId}:${item.subcategoryId ?? ''}`) ?? item.category;
  }, [canonicalCategoryLabelByRef]);

  const categories = useMemo(
    () =>
      Array.from(
        new Set(
          items
            .filter((item) => !item.archivedAt)
            .map((item) => getResolvedCategoryLabel(item))
            .filter(Boolean)
        )
      ).sort((a, b) => a.localeCompare(b, 'sl')),
    [getResolvedCategoryLabel, items]
  );

  const selectedCategoryLabel =
    categoryFilter === 'all'
      ? 'Vse kategorije'
      : categories.find((category) => category === categoryFilter) ?? 'Vse kategorije';

  useEffect(() => {
    if (categoryFilter === 'all') return;
    if (!categories.includes(categoryFilter)) {
      setCategoryFilter('all');
    }
  }, [categories, categoryFilter]);

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    const next = items.filter((item) => {
      if (item.archivedAt) return false;
      const resolvedCategory = getResolvedCategoryLabel(item);
      const matchesSearch =
        !q ||
        item.searchIndex.includes(q) ||
        resolvedCategory.toLowerCase().includes(q);
      const matchesCategory = categoryFilter === 'all' || resolvedCategory === categoryFilter;
      const matchesStatus = statusTab === 'active' ? item.active : !item.active;
      return matchesSearch && matchesCategory && matchesStatus;
    });

    const textCmp = (a: string, b: string) => a.localeCompare(b, 'sl', { sensitivity: 'base' });
    next.sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'price') cmp = discountedPrice(a.price, a.discountPct) - discountedPrice(b.price, b.discountPct);
      else if (sortKey === 'status') cmp = textCmp(a.active ? 'Aktiven' : 'Neaktiven', b.active ? 'Aktiven' : 'Neaktiven');
      else cmp = textCmp(String(a[sortKey]), String(b[sortKey]));
      return sortDirection === 'asc' ? cmp : -cmp;
    });

    return next;
  }, [categoryFilter, getResolvedCategoryLabel, items, search, sortDirection, sortKey, statusTab]);

  const { page, pageSize, pageCount, setPage, setPageSize } = useTablePagination({
    totalCount: filteredItems.length,
    storageKey: 'adminArtikli.pageSize',
    defaultPageSize: 50,
    pageSizeOptions: PAGE_SIZE_OPTIONS
  });

  const pagedItems = useMemo(() => {
    const startIndex = (page - 1) * pageSize;
    return filteredItems.slice(startIndex, startIndex + pageSize);
  }, [filteredItems, page, pageSize]);

  const visibleIds = useMemo(() => pagedItems.map((item) => item.id), [pagedItems]);
  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const filteredItemIdSet = useMemo(() => new Set(filteredItems.map((item) => item.id)), [filteredItems]);
  const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIdSet.has(id));
  const toggleColumnVisibility = (key: ItemColumnKey) => {
    setVisibleColumns((current) => {
      if (key === 'name' && current.name) return current;
      const next = { ...current, [key]: !current[key] };
      const visibleCount = Object.values(next).filter(Boolean).length;
      if (visibleCount === 0) return current;
      return next;
    });
  };

  useEffect(() => {
    setPage(1);
  }, [categoryFilter, search, setPage, sortDirection, sortKey, statusTab]);

  useEffect(() => {
    setSelectedIds((current) => current.filter((id) => filteredItemIdSet.has(id)));
  }, [filteredItemIdSet]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSortKey(key);
    setSortDirection(key === 'price' ? 'desc' : 'asc');
  };

  const toggleAll = () => {
    if (allSelected) {
      const visibleIdSet = new Set(visibleIds);
      setSelectedIds((current) => current.filter((id) => !visibleIdSet.has(id)));
      return;
    }
    setSelectedIds((current) => Array.from(new Set([...current, ...visibleIds])));
  };

  const toggleOne = (id: string) => {
    setSelectedIds((current) => (current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id]));
  };

  const openCreate = () => {
    setEditingId(null);
    setDraft(emptyItem());
    setNewCategoryEnabled(false);
    setNewCategoryValue('');
    setEditorMode('edit');
    setEditorMode('view');
    setEditorOpen(true);
  };

  const openEdit = (item: Item) => {
    setEditingId(item.id);
    setDraft({ ...item, category: getResolvedCategoryLabel(item) });
    setNewCategoryEnabled(false);
    setNewCategoryValue('');
    setEditorOpen(true);
  };

  const save = () => {
    const resolvedCategory = newCategoryEnabled ? newCategoryValue.trim() : draft.category.trim();
    if (editorMode !== 'edit') {
      return;
    }
    if (!draft.name.trim() || !draft.sku.trim() || !resolvedCategory) {
      toast.error('Napaka pri shranjevanju');
      return;
    }
    const next = {
      ...draft,
      displayOrder: draft.displayOrder === null ? null : Math.max(1, Math.floor(draft.displayOrder)),
      category: resolvedCategory,
      categoryId: newCategoryEnabled ? null : draft.categoryId ?? null,
      subcategoryId: newCategoryEnabled ? null : draft.subcategoryId ?? null,
      discountPct: Math.max(0, Math.min(100, draft.discountPct)),
      updatedAt: nowIso(),
      archivedAt: null,
      searchIndex: buildItemSearchIndex(draft.name.trim(), draft.sku.trim(), resolvedCategory)
    };

    setItems((prev) => {
      if (!editingId) return [next, ...prev];
      return prev.map((item) => (item.id === editingId ? next : item));
    });
    setEditorOpen(false);
    setEditorMode('view');
    toast.success(editingId ? 'Shranjeno' : 'Dodano');
  };

  const duplicate = (item: Item) => {
    const copy = {
      ...item,
      id: crypto.randomUUID(),
      sku: `${item.sku}-copy`,
      name: `${item.name} (kopija)`,
      updatedAt: nowIso(),
      archivedAt: null,
      displayOrder: null,
      searchIndex: buildItemSearchIndex(`${item.name} (kopija)`, `${item.sku}-copy`, item.category)
    };
    setItems((prev) => [copy, ...prev]);
    toast.success('Dodano');
  };

  const archive = (item: Item) => {
    setItems((prev) =>
      prev.map((entry) =>
        entry.id === item.id
          ? {
              ...entry,
              archivedAt: nowIso(),
              updatedAt: nowIso()
            }
          : entry
      )
    );
    setSelectedIds((current) => current.filter((id) => id !== item.id));
    toast.success('Arhivirano');
  };

  const archiveSelected = () => {
    if (selectedIds.length === 0) {
      toast.info('Ni izbranih artiklov za arhiviranje.');
      return;
    }
    setItems((prev) =>
      prev.map((entry) =>
        selectedIds.includes(entry.id)
          ? {
              ...entry,
              archivedAt: nowIso(),
              updatedAt: nowIso()
            }
          : entry
      )
    );
    setSelectedIds([]);
    toast.success('Arhivirano');
  };


  const closeEditor = () => {
    setEditorMode('view');
    setEditorOpen(false);
  };

  const handleMultiImageUpload = (files: FileList | null) => {
    if (!files) return;
    const urls = Array.from(files).map((file) => URL.createObjectURL(file));
    setDraft((prev) => ({ ...prev, images: [...prev.images, ...urls] }));
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Artikli</h1>
      </div>

      <AdminTableLayout
        className="border shadow-sm"
        style={{ background: 'linear-gradient(180deg, rgba(250,251,252,0.96) 0%, rgba(242,244,247,0.96) 100%)', borderColor: '#e2e8f0', boxShadow: '0 10px 24px rgba(15,23,42,0.06)' }}
        headerLeft={
          <div className="inline-flex items-center gap-0.5 border-b border-slate-200 pb-1">
            {statusTabs.map((tab) => {
              const isActive = statusTab === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setStatusTab(tab.key)}
                  className={`relative px-3 py-1.5 text-[11px] font-medium transition ${
                    isActive
                      ? 'text-slate-900 after:absolute after:inset-x-0 after:bottom-[-5px] after:h-[2px] after:rounded-full after:bg-slate-800'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        }
        headerRight={
          <>
            <ColumnVisibilityControl
              options={itemColumnOptions.map((option) => ({ ...option, disabled: option.key === 'name' }))}
              visibleMap={visibleColumns}
              onToggle={(key) => toggleColumnVisibility(key as ItemColumnKey)}
              showLabel={false}
              className="[&>button]:!h-7 [&>button]:!w-7 [&>button]:!rounded-md [&>button]:!border-slate-200 [&>button]:!bg-transparent [&>button]:!px-0 [&>button]:!text-slate-600 [&>button]:hover:!border-slate-300 [&>button]:hover:!bg-[color:var(--hover-neutral)] [&>button]:hover:!text-slate-700"
              icon={<FilterIcon />}
            />
            <IconButton
              type="button"
              size="sm"
              tone={selectedIds.length > 0 ? 'warning' : 'neutral'}
              onClick={archiveSelected}
              disabled={selectedIds.length === 0}
              aria-label="Arhiviraj izbrane artikle"
              title="Arhiviraj"
            >
              <ActionIcon type="archive" />
            </IconButton>
            <Button type="button" variant="primary" size="toolbar" onClick={openCreate}>
              Nov artikel
            </Button>
          </>
        }
        filterRowLeft={
          <>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Poišči po nazivu, SKU ali kategoriji …"
              className={`${ADMIN_CONTROL_HEIGHT} min-w-[240px] flex-1 rounded-xl border border-slate-300 ${ADMIN_CONTROL_PADDING_X} text-[11px] focus:border-[#3e67d6] focus:ring-0 focus:ring-[#3e67d6]`}
            />
            <div className="relative min-w-[220px]">
              <CustomSelect
                value={categoryFilter}
                onChange={setCategoryFilter}
                options={[
                  { value: 'all', label: 'Vse kategorije' },
                  ...categories.map((category) => ({ value: category, label: category }))
                ]}
                className={`${ADMIN_CONTROL_HEIGHT} ${ADMIN_CONTROL_PADDING_X} py-0 text-[11px] font-semibold`}
                valueClassName="min-w-0 flex-1 text-left"
                menuClassName="min-w-full w-max max-w-[560px]"
              />
            </div>
          </>
        }
        filterRowRight={
          <>
            <PageSizeSelect value={pageSize} options={PAGE_SIZE_OPTIONS} onChange={setPageSize} />
            <Pagination page={page} pageCount={pageCount} onPageChange={setPage} variant="topPills" size="sm" showNumbers={false} />
          </>
        }
        contentClassName="overflow-x-auto"
        footerRight={<Pagination page={page} pageCount={pageCount} onPageChange={setPage} variant="bottomBar" size="sm" showNumbers={false} />}
      >
        <div className="w-full overflow-x-auto">
          <Table className="min-w-[860px] text-[11px]">
            <THead>
              <TR>
                <TH className="w-[44px] text-center"><input type="checkbox" checked={allSelected} onChange={toggleAll} aria-label="Izberi vse" /></TH>
                {visibleColumns.name ? <TH className="text-[11px]">
                  <button type="button" onClick={() => handleSort('name')} className="inline-flex items-center font-semibold hover:text-slate-700">Naziv <SortIndicator active={sortKey === 'name'} direction={sortDirection} /></button>
                </TH> : null}
                {visibleColumns.sku ? <TH className="text-[11px]">
                  <button type="button" onClick={() => handleSort('sku')} className="inline-flex items-center font-semibold hover:text-slate-700">SKU <SortIndicator active={sortKey === 'sku'} direction={sortDirection} /></button>
                </TH> : null}
                {visibleColumns.category ? <TH className="text-[11px]">
                  <button type="button" onClick={() => handleSort('category')} className="inline-flex items-center font-semibold hover:text-slate-700">Kategorija <SortIndicator active={sortKey === 'category'} direction={sortDirection} /></button>
                </TH> : null}
                {visibleColumns.price ? <TH className="text-center text-[11px]">
                  <button type="button" onClick={() => handleSort('price')} className="inline-flex items-center font-semibold hover:text-slate-700">Cena <SortIndicator active={sortKey === 'price'} direction={sortDirection} /></button>
                </TH> : null}
                {visibleColumns.discount ? <TH className="text-center text-[11px]"><span className="inline-flex items-center">Popust</span></TH> : null}
                {visibleColumns.salePrice ? <TH className="whitespace-nowrap text-center text-[11px]"><span className="inline-flex items-center">Akcijska cena</span></TH> : null}
                {visibleColumns.status ? <TH className="text-center text-[11px]">
                  <button type="button" onClick={() => handleSort('status')} className="inline-flex items-center font-semibold hover:text-slate-700">Status <SortIndicator active={sortKey === 'status'} direction={sortDirection} /></button>
                </TH> : null}
                <TH className="text-center text-[11px]"><span className="inline-flex items-center">Uredi</span></TH>
              </TR>
            </THead>
            <tbody>
              {pagedItems.map((item, index) => (
                <tr key={item.id} className={`border-t border-slate-200 transition-colors ${getAdminStripedRowToneClass(index)} ${adminTableRowToneClasses.hover}`}>
                  <td className="px-2.5 py-2 text-center"><input type="checkbox" checked={selectedIds.includes(item.id)} onChange={() => toggleOne(item.id)} aria-label={`Izberi ${item.name}`} /></td>
                  {visibleColumns.name ? <td className="px-2.5 py-2 text-[11px] font-medium text-slate-900">{item.name}</td> : null}
                  {visibleColumns.sku ? <td className="px-2.5 py-2 text-[11px] text-slate-600">{item.sku}</td> : null}
                  {visibleColumns.category ? <td className="px-2.5 py-2 text-[11px] text-slate-600">{getResolvedCategoryLabel(item)}</td> : null}
                  {visibleColumns.price ? <td className="px-2.5 py-2 text-center text-[11px] text-slate-600">{formatCurrency(item.price)}</td> : null}
                  {visibleColumns.discount ? <td className="px-2.5 py-2 text-center text-[11px] text-slate-600">{item.discountPct}%</td> : null}
                  {visibleColumns.salePrice ? <td className="px-2.5 py-2 text-center text-[11px] text-slate-600">{formatCurrency(discountedPrice(item.price, item.discountPct))}</td> : null}
                  {visibleColumns.status ? <td className="px-2.5 py-2 text-center">
                    <Chip
                      variant={item.active ? 'success' : 'neutral'}
                      className={`min-w-0 px-2.5 text-[11px] ${item.active ? buttonTokenClasses.activeSuccess : buttonTokenClasses.inactiveNeutral}`}
                    >
                      {item.active ? 'Aktiven' : 'Neaktiven'}
                    </Chip>
                  </td> : null}
                  <td className="px-2.5 py-2 text-center">
                    <RowActionsDropdown
                      label={`Možnosti za artikel ${item.name}`}
                      items={[
                        {
                          key: 'edit',
                          label: 'Uredi',
                          icon: <ActionIcon type="edit" />,
                          onSelect: () => openEdit(item)
                        },
                        {
                          key: 'duplicate',
                          label: 'Podvoji',
                          icon: <ActionIcon type="copy" />,
                          onSelect: () => duplicate(item)
                        },
                        {
                          key: 'archive',
                          label: 'Arhiviraj',
                          icon: <ActionIcon type="archive" />,
                          className: 'text-amber-700',
                          onSelect: () => archive(item)
                        }
                      ]}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      </AdminTableLayout>

      {editorOpen ? (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/30">
          <div className="h-full w-full max-w-md overflow-y-auto border-l border-slate-200 bg-white p-4 shadow-xl">
            <div className="mb-3 flex items-center justify-between border-b border-slate-100 pb-2">
              <h2 className="text-base font-semibold text-slate-900">{editingId ? 'Uredi artikel' : 'Dodaj artikel'}</h2>
              <div className="flex items-center gap-1.5">
                <IconButton type="button" tone="neutral" onClick={() => setEditorMode('edit')} title="Uredi" aria-label="Uredi">
                  <ActionIcon type="edit" />
                </IconButton>
                <IconButton
                  type="button"
                  tone="neutral"
                  onClick={save}
                  disabled={editorMode !== 'edit'}
                  title="Shrani"
                  aria-label="Shrani"
                >
                  <ActionIcon type="save" />
                </IconButton>
                <IconButton type="button" tone="neutral" onClick={closeEditor} title="Zapri" aria-label="Zapri">
                  <ActionIcon type="close" />
                </IconButton>
              </div>
            </div>

            <div className="space-y-3 text-sm">
              <FloatingInput label="Naziv" value={draft.name} onChange={(value) => setDraft((prev) => ({ ...prev, name: value }))} disabled={editorMode !== 'edit'} />
              <div className="group relative" data-filled={draft.description ? 'true' : 'false'}>
                <textarea value={draft.description} disabled={editorMode !== 'edit'} onChange={(event) => setDraft((prev) => ({ ...prev, description: event.target.value }))} placeholder=" " className="min-h-[90px] w-full rounded-xl border border-slate-300 bg-white px-3 pb-2 pt-5 text-sm text-slate-900 outline-none transition focus:border-[#3e67d6] focus:ring-0 focus:ring-[#3e67d6] disabled:bg-slate-100 disabled:text-slate-400" />
                <label className="pointer-events-none absolute left-3 top-1.5 bg-white px-1 text-[10px] text-slate-600">Opis</label>
              </div>

              <FloatingSelect label="Kategorija" value={draft.category} disabled={editorMode !== 'edit'} onChange={(value) => setDraft((prev) => ({ ...prev, category: value }))}>
                <option value="">Izberi kategorijo</option>
                {categories.map((category) => <option key={category} value={category}>{category}</option>)}
              </FloatingSelect>

              <label className="inline-flex items-center gap-2 text-xs text-slate-700"><input type="checkbox" checked={newCategoryEnabled} disabled={editorMode !== 'edit'} onChange={(event) => setNewCategoryEnabled(event.target.checked)} />Dodaj novo kategorijo</label>
              <FloatingInput label="Nova Kategorija" value={newCategoryValue} onChange={(value) => setNewCategoryValue(value)} disabled={!newCategoryEnabled || editorMode !== 'edit'} />

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-2">
                <p className="mb-2 text-xs font-semibold text-slate-700">Razvrščanje</p>
                <div className="grid grid-cols-2 gap-2">
                  <Button type="button" variant={draft.displayOrder === null ? 'primary' : 'default'} size="toolbar" disabled={editorMode !== 'edit'} onClick={() => setDraft((prev) => ({ ...prev, displayOrder: null }))}>Abecedno</Button>
                  <Button type="button" variant={draft.displayOrder !== null ? 'primary' : 'default'} size="toolbar" disabled={editorMode !== 'edit'} onClick={() => setDraft((prev) => ({ ...prev, displayOrder: prev.displayOrder ?? 1 }))}>Ročno (pozicija)</Button>
                </div>
                {draft.displayOrder !== null ? (
                  <div className="mt-2">
                    <FloatingInput
                      label="Pozicija"
                      value={draft.displayOrder}
                      onChange={(value) => setDraft((prev) => ({ ...prev, displayOrder: Math.max(1, Number(value) || 1) }))}
                      type="number"
                      min={1}
                      step={1}
                      disabled={editorMode !== 'edit'}
                    />
                  </div>
                ) : null}
              </div>

              <div className="grid grid-cols-3 gap-2">
                <FloatingInput label="Cena" value={draft.price} onChange={(value) => setDraft((prev) => ({ ...prev, price: Number(value) || 0 }))} type="number" step={0.01} disabled={editorMode !== 'edit'} />
                <FloatingInput label="Popust (%)" value={draft.discountPct} onChange={(value) => setDraft((prev) => ({ ...prev, discountPct: Number(value) || 0 }))} type="number" min={0} max={100} step={1} disabled={editorMode !== 'edit'} />
                <div className="flex h-11 items-center rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs text-slate-700">Sedanja cena:&nbsp;<span className="font-semibold text-slate-900">{formatCurrency(discountedPrice(draft.price, draft.discountPct))}</span></div>
              </div>

              <FloatingInput label="Enota" value={draft.unit} onChange={(value) => setDraft((prev) => ({ ...prev, unit: value }))} disabled={editorMode !== 'edit'} />
              <FloatingInput label="SKU / koda" value={draft.sku} onChange={(value) => setDraft((prev) => ({ ...prev, sku: value }))} disabled={editorMode !== 'edit'} />

              <label className="block">Slike artikla (več datotek)
                <input type="file" accept="image/*" multiple disabled={editorMode !== 'edit'} onChange={(event) => handleMultiImageUpload(event.target.files)} className="mt-1 block w-full text-xs" />
              </label>
              {draft.images.length > 0 ? (
                <div className="grid grid-cols-3 gap-2">
                  {draft.images.map((img, idx) => (
                    <div key={`${img}-${idx}`} className="relative overflow-hidden rounded border border-slate-200 bg-slate-50">
                      <Image src={img} alt={`Slika ${idx + 1}`} width={160} height={80} unoptimized className="h-20 w-full object-cover" />
                    </div>
                  ))}
                </div>
              ) : null}

              <label className="inline-flex items-center gap-2"><input type="checkbox" checked={draft.active} disabled={editorMode !== 'edit'} onChange={(event) => setDraft((prev) => ({ ...prev, active: event.target.checked }))} /><span>Aktiven</span></label>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
