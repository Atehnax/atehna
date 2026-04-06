'use client';

import Image from 'next/image';
import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { Button } from '@/shared/ui/button';
import { Chip } from '@/shared/ui/badge';
import { AdminTableLayout } from '@/shared/ui/admin-table';
import { AdminCheckbox } from '@/shared/ui/checkbox';
import { AdminSearchInput } from '@/shared/ui/admin-search-input';
import { IconButton } from '@/shared/ui/icon-button';
import {
  ArchiveIcon,
  CloseIcon,
  CopyIcon,
  DownloadIcon,
  PencilIcon,
  PlusIcon,
  SaveIcon
} from '@/shared/ui/icons/AdminActionIcons';
import { RowActionsDropdown, Table, THead, TH, TR } from '@/shared/ui/table';
import { EuiTablePagination, useTablePagination } from '@/shared/ui/pagination';
import { useToast } from '@/shared/ui/toast';
import { adminTableRowToneClasses } from '@/shared/ui/theme/tokens';

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

type StatusFilter = 'all' | 'active' | 'hidden';
type ActiveFilter = 'all' | 'yes' | 'no';
type DiscountFilter = 'all' | 'yes' | 'no';
type ListMode = 'families' | 'variants';
type EditorTab = 'osnovno' | 'razlicice' | 'slike' | 'dodatno';
type CreateMode = 'single' | 'variants';

type Variant = {
  id: string;
  label: string;
  width: number | null;
  length: number | null;
  thickness: number | null;
  sku: string;
  price: number;
  discountPct: number;
  stock: number;
  active: boolean;
  sort: number;
  imageOverride?: string | null;
};

type ProductFamily = {
  id: string;
  name: string;
  description: string;
  category: string;
  categoryId: string | null;
  subcategoryId: string | null;
  images: string[];
  promoBadge: string;
  defaultDiscountPct: number;
  active: boolean;
  sort: number;
  notes: string;
  slug: string;
  variants: Variant[];
};

type VariantSeedParse = {
  familyName: string;
  variantLabel: string;
  width: number | null;
  length: number | null;
  thickness: number | null;
};

const STORAGE_KEY = 'admin-items-families-v1';
const PAGE_SIZE_OPTIONS = [20, 50, 100];

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('sl-SI', { style: 'currency', currency: 'EUR' }).format(value);

const computeSalePrice = (price: number, discountPct: number) => Number((price * (1 - Math.max(0, Math.min(100, discountPct)) / 100)).toFixed(2));

const toSlug = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

const parseDimensionTriplet = (input: string): { width: number | null; length: number | null; thickness: number | null } => {
  const normalized = input.replace(/,/g, '.').toLowerCase();
  const matches = normalized.match(/(\d+(?:\.\d+)?)/g);
  if (!matches || matches.length < 3) {
    return { width: null, length: null, thickness: null };
  }
  return {
    width: Number(matches[0]),
    length: Number(matches[1]),
    thickness: Number(matches[2])
  };
};

const parseSeedName = (name: string): VariantSeedParse => {
  const [familyRaw, variantRaw] = name.split(',').map((part) => part.trim());
  if (!variantRaw) {
    return {
      familyName: familyRaw,
      variantLabel: 'Osnovna različica',
      width: null,
      length: null,
      thickness: null
    };
  }

  const dimensions = parseDimensionTriplet(variantRaw);
  return {
    familyName: familyRaw,
    variantLabel: variantRaw,
    ...dimensions
  };
};

const buildVariantLabel = (variant: Pick<Variant, 'width' | 'length' | 'thickness' | 'label'>) => {
  if (variant.width === null || variant.length === null || variant.thickness === null) {
    return variant.label || 'Osnovna različica';
  }
  return `${variant.width} × ${variant.length} × ${variant.thickness} mm`;
};

const createVariant = (overrides: Partial<Variant> = {}): Variant => ({
  id: crypto.randomUUID(),
  label: 'Nova različica',
  width: null,
  length: null,
  thickness: null,
  sku: '',
  price: 0,
  discountPct: 0,
  stock: 0,
  active: true,
  sort: 1,
  imageOverride: null,
  ...overrides
});

const createFamily = (overrides: Partial<ProductFamily> = {}): ProductFamily => ({
  id: crypto.randomUUID(),
  name: '',
  description: '',
  category: '',
  categoryId: null,
  subcategoryId: null,
  images: [],
  promoBadge: '',
  defaultDiscountPct: 0,
  active: true,
  sort: 1,
  notes: '',
  slug: '',
  variants: [createVariant()],
  ...overrides
});

const statusLabel = (active: boolean) => (active ? 'Aktiven' : 'Skrit');

function EditorField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="space-y-1 text-xs font-medium text-slate-700">
      <span>{label}</span>
      {children}
    </label>
  );
}

const inputClassName =
  'h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-[#2f66dd]';

function ActionIcon({ type }: { type: 'edit' | 'duplicate' | 'archive' | 'save' | 'close' | 'export' | 'add' }) {
  if (type === 'edit') return <PencilIcon />;
  if (type === 'duplicate') return <CopyIcon />;
  if (type === 'save') return <SaveIcon />;
  if (type === 'close') return <CloseIcon />;
  if (type === 'export') return <DownloadIcon />;
  if (type === 'add') return <PlusIcon />;
  return <ArchiveIcon />;
}

export default function AdminItemsManager({ seedItems }: { seedItems: SeedItemTuple[] }) {
  const { toast } = useToast();

  const seedFamilies = useMemo<ProductFamily[]>(() => {
    const grouped = new Map<string, ProductFamily>();

    seedItems.forEach((seed, index) => {
      const [id, name, description, category, categoryId, subcategoryId, price, sku, images, discountPct, displayOrder] = seed;
      const parsed = parseSeedName(name);
      const key = `${parsed.familyName}::${category}`;
      const existing = grouped.get(key);
      const variant = createVariant({
        id,
        label: parsed.variantLabel,
        width: parsed.width,
        length: parsed.length,
        thickness: parsed.thickness,
        sku,
        price,
        discountPct,
        stock: Math.max(0, 40 - index),
        active: true,
        sort: index + 1
      });

      if (!existing) {
        grouped.set(
          key,
          createFamily({
            id: crypto.randomUUID(),
            name: parsed.familyName,
            description,
            category,
            categoryId,
            subcategoryId,
            images,
            promoBadge: discountPct > 0 ? 'Akcija' : '',
            defaultDiscountPct: discountPct,
            active: true,
            sort: displayOrder ?? index + 1,
            slug: toSlug(parsed.familyName),
            variants: [variant]
          })
        );
        return;
      }

      grouped.set(key, {
        ...existing,
        images: existing.images.length ? existing.images : images,
        defaultDiscountPct: existing.defaultDiscountPct || discountPct,
        variants: [...existing.variants, variant]
      });
    });

    return Array.from(grouped.values()).map((family) => ({
      ...family,
      variants: [...family.variants].sort((a, b) => a.sort - b.sort)
    }));
  }, [seedItems]);

  const [families, setFamilies] = useState<ProductFamily[]>(seedFamilies);
  const [search, setSearch] = useState('');
  const [mode, setMode] = useState<ListMode>('families');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>('all');
  const [discountFilter, setDiscountFilter] = useState<DiscountFilter>('all');
  const [expandedFamilyIds, setExpandedFamilyIds] = useState<Set<string>>(new Set());
  const [selectedFamilyIds, setSelectedFamilyIds] = useState<Set<string>>(new Set());
  const [selectedVariantIds, setSelectedVariantIds] = useState<Set<string>>(new Set());
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorTab, setEditorTab] = useState<EditorTab>('osnovno');
  const [editorFamilyId, setEditorFamilyId] = useState<string | null>(null);
  const [editorDraft, setEditorDraft] = useState<ProductFamily | null>(null);
  const [createModePickerOpen, setCreateModePickerOpen] = useState(false);
  const [variantAttrInputs, setVariantAttrInputs] = useState({ width: '100, 200', length: '100, 200', thickness: '0,5' });
  const [bulkDiscountValue, setBulkDiscountValue] = useState('10');

  useEffect(() => {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as ProductFamily[];
      if (Array.isArray(parsed) && parsed.length > 0) {
        setFamilies(parsed);
      }
    } catch {
      // ignore invalid local storage payload
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(families));
  }, [families]);

  const categories = useMemo(() => Array.from(new Set(families.map((family) => family.category))).sort((a, b) => a.localeCompare(b, 'sl')), [families]);

  const filteredFamilies = useMemo(() => {
    const q = search.trim().toLowerCase();
    return families.filter((family) => {
      const matchesSearch =
        q.length === 0 ||
        family.name.toLowerCase().includes(q) ||
        family.variants.some((variant) => variant.sku.toLowerCase().includes(q) || buildVariantLabel(variant).toLowerCase().includes(q));
      const matchesCategory = categoryFilter === 'all' || family.category === categoryFilter;
      const matchesStatus = statusFilter === 'all' || (statusFilter === 'active' ? family.active : !family.active);
      const hasAnyActiveVariant = family.variants.some((variant) => variant.active);
      const matchesActive = activeFilter === 'all' || (activeFilter === 'yes' ? hasAnyActiveVariant : !hasAnyActiveVariant);
      const hasDiscount = family.defaultDiscountPct > 0 || family.variants.some((variant) => variant.discountPct > 0);
      const matchesDiscount = discountFilter === 'all' || (discountFilter === 'yes' ? hasDiscount : !hasDiscount);
      return matchesSearch && matchesCategory && matchesStatus && matchesActive && matchesDiscount;
    });
  }, [activeFilter, categoryFilter, discountFilter, families, search, statusFilter]);

  const flatVariants = useMemo(() => {
    const rows: Array<{ family: ProductFamily; variant: Variant }> = [];
    filteredFamilies.forEach((family) => {
      family.variants.forEach((variant) => rows.push({ family, variant }));
    });
    return rows;
  }, [filteredFamilies]);

  const paginationTotal = mode === 'families' ? filteredFamilies.length : flatVariants.length;
  const { page, pageSize, pageCount, setPage, setPageSize } = useTablePagination({
    totalCount: paginationTotal,
    storageKey: 'adminArtikli.families.pageSize',
    defaultPageSize: 20,
    pageSizeOptions: PAGE_SIZE_OPTIONS
  });

  const pagedFamilies = useMemo(() => {
    if (mode !== 'families') return [];
    const start = (page - 1) * pageSize;
    return filteredFamilies.slice(start, start + pageSize);
  }, [filteredFamilies, mode, page, pageSize]);

  const pagedVariants = useMemo(() => {
    if (mode !== 'variants') return [];
    const start = (page - 1) * pageSize;
    return flatVariants.slice(start, start + pageSize);
  }, [flatVariants, mode, page, pageSize]);

  useEffect(() => {
    setPage(1);
  }, [activeFilter, categoryFilter, discountFilter, mode, search, setPage, statusFilter]);

  const resetFilters = () => {
    setSearch('');
    setCategoryFilter('all');
    setStatusFilter('all');
    setActiveFilter('all');
    setDiscountFilter('all');
  };

  const toggleFamilyExpanded = (familyId: string) => {
    setExpandedFamilyIds((current) => {
      const next = new Set(current);
      if (next.has(familyId)) next.delete(familyId);
      else next.add(familyId);
      return next;
    });
  };

  const openEditor = (family: ProductFamily) => {
    setEditorFamilyId(family.id);
    setEditorDraft(structuredClone(family));
    setEditorOpen(true);
    setEditorTab('osnovno');
    setCreateModePickerOpen(false);
  };

  const openCreateFlow = (createMode: CreateMode) => {
    const blank = createFamily({
      name: '',
      variants: createMode === 'single' ? [createVariant({ label: 'Osnovni artikel' })] : [createVariant()]
    });
    setEditorFamilyId(null);
    setEditorDraft(blank);
    setEditorOpen(true);
    setEditorTab(createMode === 'variants' ? 'razlicice' : 'osnovno');
    setCreateModePickerOpen(false);
  };

  const saveEditor = () => {
    if (!editorDraft) return;
    if (!editorDraft.name.trim()) {
      toast.error('Naziv družine je obvezen.');
      return;
    }
    if (!editorDraft.category.trim()) {
      toast.error('Kategorija je obvezna.');
      return;
    }
    if (editorDraft.variants.length === 0) {
      toast.error('Družina mora imeti vsaj eno različico.');
      return;
    }

    const normalizedDraft: ProductFamily = {
      ...editorDraft,
      slug: editorDraft.slug || toSlug(editorDraft.name),
      variants: editorDraft.variants.map((variant, index) => ({
        ...variant,
        label: buildVariantLabel(variant),
        sort: index + 1,
        discountPct: Math.max(0, Math.min(100, variant.discountPct))
      }))
    };

    setFamilies((current) => {
      if (!editorFamilyId) {
        return [normalizedDraft, ...current];
      }
      return current.map((family) => (family.id === editorFamilyId ? normalizedDraft : family));
    });
    setEditorOpen(false);
    toast.success(editorFamilyId ? 'Družina shranjena.' : 'Družina dodana.');
  };

  const archiveFamily = (familyId: string) => {
    setFamilies((current) =>
      current.map((family) =>
        family.id === familyId
          ? {
              ...family,
              active: false,
              variants: family.variants.map((variant) => ({ ...variant, active: false }))
            }
          : family
      )
    );
    toast.success('Družina je skrita.');
  };

  const duplicateFamily = (family: ProductFamily) => {
    const cloned = structuredClone(family);
    const duplicated: ProductFamily = {
      ...cloned,
      id: crypto.randomUUID(),
      name: `${cloned.name} (kopija)`,
      slug: `${cloned.slug || toSlug(cloned.name)}-kopija`,
      variants: cloned.variants.map((variant) => ({ ...variant, id: crypto.randomUUID(), sku: `${variant.sku}-copy` }))
    };
    setFamilies((current) => [duplicated, ...current]);
    toast.success('Družina podvojena.');
  };

  const allVisibleFamilyIds = useMemo(() => new Set(pagedFamilies.map((family) => family.id)), [pagedFamilies]);
  const familiesSelectedOnPage = pagedFamilies.length > 0 && pagedFamilies.every((family) => selectedFamilyIds.has(family.id));

  const toggleAllFamiliesOnPage = () => {
    setSelectedFamilyIds((current) => {
      const next = new Set(current);
      if (familiesSelectedOnPage) {
        allVisibleFamilyIds.forEach((id) => next.delete(id));
      } else {
        allVisibleFamilyIds.forEach((id) => next.add(id));
      }
      return next;
    });
  };

  const toggleFamilySelection = (familyId: string) => {
    setSelectedFamilyIds((current) => {
      const next = new Set(current);
      if (next.has(familyId)) next.delete(familyId);
      else next.add(familyId);
      return next;
    });
  };

  const toggleVariantSelection = (variantId: string) => {
    setSelectedVariantIds((current) => {
      const next = new Set(current);
      if (next.has(variantId)) next.delete(variantId);
      else next.add(variantId);
      return next;
    });
  };

  const applyBulkDiscountToSelected = () => {
    const parsed = Number(bulkDiscountValue.replace(',', '.'));
    if (!Number.isFinite(parsed)) {
      toast.error('Popust mora biti številka.');
      return;
    }

    if (!editorDraft) return;
    const selectedCount = editorDraft.variants.filter((variant) => selectedVariantIds.has(variant.id)).length;
    if (selectedCount === 0) {
      toast.info('Najprej izberite različice.');
      return;
    }

    setEditorDraft((current) => {
      if (!current) return current;
      return {
        ...current,
        variants: current.variants.map((variant) =>
          selectedVariantIds.has(variant.id)
            ? {
                ...variant,
                discountPct: Math.max(0, Math.min(100, parsed))
              }
            : variant
        )
      };
    });

    toast.success(`Popust je nastavljen za ${selectedCount} različic.`);
  };

  const applyBulkStatusToSelected = (nextActive: boolean) => {
    if (!editorDraft) return;
    const selectedCount = editorDraft.variants.filter((variant) => selectedVariantIds.has(variant.id)).length;
    if (selectedCount === 0) {
      toast.info('Najprej izberite različice.');
      return;
    }

    setEditorDraft((current) => {
      if (!current) return current;
      return {
        ...current,
        variants: current.variants.map((variant) =>
          selectedVariantIds.has(variant.id)
            ? {
                ...variant,
                active: nextActive
              }
            : variant
        )
      };
    });

    toast.success(`Status je posodobljen za ${selectedCount} različic.`);
  };

  const exportVariantsCsv = (rows: Array<{ family: ProductFamily; variant: Variant }>) => {
    const headers = ['Družina', 'Različica', 'SKU', 'Cena', 'Popust', 'Akcijska cena', 'Zaloga', 'Status'];
    const csvRows = rows.map(({ family, variant }) => [
      family.name,
      buildVariantLabel(variant),
      variant.sku,
      variant.price.toFixed(2),
      `${variant.discountPct}`,
      `${computeSalePrice(variant.price, variant.discountPct).toFixed(2)}`,
      `${variant.stock}`,
      statusLabel(variant.active)
    ]);

    const csv = [headers, ...csvRows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'artikli-razlicice.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  const generateVariants = () => {
    if (!editorDraft) return;
    const parseList = (value: string) =>
      value
        .split(',')
        .map((entry) => Number(entry.trim().replace(',', '.')))
        .filter((entry) => Number.isFinite(entry));

    const widths = parseList(variantAttrInputs.width);
    const lengths = parseList(variantAttrInputs.length);
    const thicknesses = parseList(variantAttrInputs.thickness);

    if (widths.length === 0 || lengths.length === 0 || thicknesses.length === 0) {
      toast.error('Atributi morajo vsebovati vsaj eno številčno vrednost.');
      return;
    }

    const combinations: Variant[] = [];
    widths.forEach((width) => {
      lengths.forEach((length) => {
        thicknesses.forEach((thickness) => {
          const label = `${width} × ${length} × ${thickness} mm`;
          combinations.push(
            createVariant({
              label,
              width,
              length,
              thickness,
              sku: `${toSlug(editorDraft.name || 'artikel').toUpperCase()}-${width}${length}${thickness}`,
              price: 0,
              discountPct: editorDraft.defaultDiscountPct,
              stock: 0,
              sort: combinations.length + 1
            })
          );
        });
      });
    });

    setEditorDraft((current) => (current ? { ...current, variants: combinations } : current));
    setSelectedVariantIds(new Set());
    toast.success(`Generiranih različic: ${combinations.length}.`);
  };

  return (
    <div className="space-y-4 font-['Inter',system-ui,sans-serif]">
      <AdminTableLayout
        className="border shadow-sm"
        style={{ background: '#fff', borderColor: '#e2e8f0', boxShadow: '0 10px 24px rgba(15,23,42,0.06)' }}
        headerClassName="!bg-white"
        headerLeft={
          <div className="flex w-full items-center gap-2">
            <AdminSearchInput
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Poišči artikel ali SKU ..."
              aria-label="Poišči artikel ali SKU"
              className="!m-0 !h-9 w-full"
            />
            <div className="inline-flex rounded-lg border border-slate-200 p-0.5 text-xs font-semibold">
              <button
                type="button"
                className={`rounded-md px-3 py-1.5 ${mode === 'families' ? 'bg-[#2f66dd] text-white' : 'text-slate-600'}`}
                onClick={() => setMode('families')}
              >
                Družine
              </button>
              <button
                type="button"
                className={`rounded-md px-3 py-1.5 ${mode === 'variants' ? 'bg-[#2f66dd] text-white' : 'text-slate-600'}`}
                onClick={() => setMode('variants')}
              >
                Različice
              </button>
            </div>
          </div>
        }
        headerRight={
          <div className="flex items-center gap-2">
            <Button type="button" variant="default" size="toolbar" onClick={() => exportVariantsCsv(flatVariants)}>
              <ActionIcon type="export" />
              Izvozi CSV
            </Button>
            <div className="relative">
              <Button type="button" variant="primary" size="toolbar" onClick={() => setCreateModePickerOpen((current) => !current)}>
                <ActionIcon type="add" />
                Dodaj artikel
              </Button>
              {createModePickerOpen ? (
                <div className="absolute right-0 top-10 z-20 w-56 rounded-lg border border-slate-200 bg-white p-1 shadow-lg">
                  <button type="button" className="w-full rounded-md px-3 py-2 text-left text-sm hover:bg-slate-100" onClick={() => openCreateFlow('single')}>
                    Enostaven artikel
                  </button>
                  <button type="button" className="w-full rounded-md px-3 py-2 text-left text-sm hover:bg-slate-100" onClick={() => openCreateFlow('variants')}>
                    Artikel z različicami
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        }
        filterRowLeft={
          <div className="flex flex-wrap items-center gap-2">
            <select className={`${inputClassName} !h-8 !w-auto`} value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
              <option value="all">Kategorija: Vse</option>
              {categories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
            <select className={`${inputClassName} !h-8 !w-auto`} value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}>
              <option value="all">Status: Vsi</option>
              <option value="active">Status: Aktiven</option>
              <option value="hidden">Status: Skrit</option>
            </select>
            <select className={`${inputClassName} !h-8 !w-auto`} value={activeFilter} onChange={(event) => setActiveFilter(event.target.value as ActiveFilter)}>
              <option value="all">Aktivni: Vsi</option>
              <option value="yes">Aktivni: Da</option>
              <option value="no">Aktivni: Ne</option>
            </select>
            <select className={`${inputClassName} !h-8 !w-auto`} value={discountFilter} onChange={(event) => setDiscountFilter(event.target.value as DiscountFilter)}>
              <option value="all">Ima popust: Vsi</option>
              <option value="yes">Ima popust: Da</option>
              <option value="no">Ima popust: Ne</option>
            </select>
            <Button type="button" variant="ghost" size="toolbar" onClick={resetFilters}>
              Počisti
            </Button>
          </div>
        }
        filterRowRight={
          <EuiTablePagination
            page={page}
            pageCount={pageCount}
            onPageChange={setPage}
            itemsPerPage={pageSize}
            onChangeItemsPerPage={setPageSize}
            itemsPerPageOptions={PAGE_SIZE_OPTIONS}
          />
        }
        contentClassName="overflow-x-auto overflow-y-visible bg-white"
        footerRight={
          <EuiTablePagination
            page={page}
            pageCount={pageCount}
            onPageChange={setPage}
            itemsPerPage={pageSize}
            onChangeItemsPerPage={setPageSize}
            itemsPerPageOptions={PAGE_SIZE_OPTIONS}
          />
        }
      >
        {mode === 'families' ? (
          <Table className="min-w-[1100px] table-fixed text-[12px]">
            <colgroup>
              <col className="w-[40px]" />
              <col className="w-[320px]" />
              <col className="w-[210px]" />
              <col className="w-[90px]" />
              <col className="w-[170px]" />
              <col className="w-[110px]" />
              <col className="w-[120px]" />
              <col className="w-[110px]" />
            </colgroup>
            <THead>
              <TR>
                <TH className="text-center">
                  <AdminCheckbox checked={familiesSelectedOnPage} onChange={toggleAllFamiliesOnPage} aria-label="Izberi vse družine" />
                </TH>
                <TH>Družina</TH>
                <TH>Kategorija</TH>
                <TH>Št. različic</TH>
                <TH>Razpon cen</TH>
                <TH>Popust</TH>
                <TH>Status</TH>
                <TH className="text-center">Akcije</TH>
              </TR>
            </THead>
            <tbody>
              {pagedFamilies.map((family) => {
                const isExpanded = expandedFamilyIds.has(family.id);
                const prices = family.variants.map((variant) => variant.price);
                const minPrice = prices.length ? Math.min(...prices) : 0;
                const maxPrice = prices.length ? Math.max(...prices) : 0;
                return (
                  <>
                    <tr key={family.id} className={`border-t border-slate-100 bg-white ${adminTableRowToneClasses.hover}`}>
                      <td className="px-2 py-2 text-center">
                        <AdminCheckbox checked={selectedFamilyIds.has(family.id)} onChange={() => toggleFamilySelection(family.id)} aria-label={`Izberi ${family.name}`} />
                      </td>
                      <td className="px-2 py-3">
                        <button type="button" className="inline-flex items-start gap-2 text-left" onClick={() => toggleFamilyExpanded(family.id)}>
                          <span className="mt-0.5 inline-flex h-4 w-4 items-center justify-center text-slate-500">{isExpanded ? '▾' : '▸'}</span>
                          <span>
                            <span className="block text-sm font-semibold text-slate-900">{family.name}</span>
                            <span className="block text-xs text-slate-500">{family.description || 'Brez opisa.'}</span>
                          </span>
                        </button>
                      </td>
                      <td className="px-2 py-3 text-slate-600">{family.category}</td>
                      <td className="px-2 py-3">
                        <Chip variant="neutral" className="text-xs">
                          {family.variants.length} različic
                        </Chip>
                      </td>
                      <td className="px-2 py-3 text-slate-700">
                        {formatCurrency(minPrice)} – {formatCurrency(maxPrice)}
                      </td>
                      <td className="px-2 py-3 text-sm font-semibold text-emerald-700">{family.defaultDiscountPct}%</td>
                      <td className="px-2 py-3">
                        <Chip variant={family.active ? 'success' : 'warning'}>{statusLabel(family.active)}</Chip>
                      </td>
                      <td className="px-2 py-3 text-center">
                        <RowActionsDropdown
                          label={`Možnosti za družino ${family.name}`}
                          items={[
                            { key: 'edit', label: 'Uredi', icon: <ActionIcon type="edit" />, onSelect: () => openEditor(family) },
                            { key: 'duplicate', label: 'Podvoji', icon: <ActionIcon type="duplicate" />, onSelect: () => duplicateFamily(family) },
                            {
                              key: 'archive',
                              label: 'Skrij',
                              icon: <ActionIcon type="archive" />,
                              className: 'text-amber-700 hover:!bg-amber-50 hover:!text-amber-700',
                              onSelect: () => archiveFamily(family.id)
                            }
                          ]}
                        />
                      </td>
                    </tr>
                    {isExpanded ? (
                      <tr className="border-t border-slate-100 bg-slate-50/70">
                        <td />
                        <td colSpan={7} className="p-0">
                          <table className="w-full text-[12px]">
                            <thead>
                              <tr className="border-b border-slate-200 text-slate-600">
                                <th className="px-2 py-2 text-left"> </th>
                                <th className="px-2 py-2 text-left">Različica (Š × D × Deb.)</th>
                                <th className="px-2 py-2 text-left">SKU</th>
                                <th className="px-2 py-2 text-left">Cena</th>
                                <th className="px-2 py-2 text-left">Popust</th>
                                <th className="px-2 py-2 text-left">Akcijska cena</th>
                                <th className="px-2 py-2 text-left">Zaloga</th>
                                <th className="px-2 py-2 text-left">Status</th>
                              </tr>
                            </thead>
                            <tbody>
                              {family.variants.map((variant) => (
                                <tr key={variant.id} className="border-t border-slate-100">
                                  <td className="px-2 py-2">
                                    <AdminCheckbox
                                      checked={selectedVariantIds.has(variant.id)}
                                      onChange={() => toggleVariantSelection(variant.id)}
                                      aria-label={`Izberi različico ${variant.label}`}
                                    />
                                  </td>
                                  <td className="px-2 py-2 font-medium text-slate-800">{buildVariantLabel(variant)}</td>
                                  <td className="px-2 py-2 text-slate-600">{variant.sku}</td>
                                  <td className="px-2 py-2 text-slate-700">{formatCurrency(variant.price)}</td>
                                  <td className="px-2 py-2 text-emerald-700">{variant.discountPct}%</td>
                                  <td className="px-2 py-2 text-slate-700">{formatCurrency(computeSalePrice(variant.price, variant.discountPct))}</td>
                                  <td className="px-2 py-2 text-slate-700">{variant.stock}</td>
                                  <td className="px-2 py-2">
                                    <Chip variant={variant.active ? 'success' : 'warning'}>{statusLabel(variant.active)}</Chip>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </td>
                      </tr>
                    ) : null}
                  </>
                );
              })}
            </tbody>
          </Table>
        ) : (
          <Table className="min-w-[980px] table-fixed text-[12px]">
            <colgroup>
              <col className="w-[40px]" />
              <col className="w-[220px]" />
              <col className="w-[220px]" />
              <col className="w-[140px]" />
              <col className="w-[110px]" />
              <col className="w-[100px]" />
              <col className="w-[120px]" />
              <col className="w-[100px]" />
              <col className="w-[110px]" />
            </colgroup>
            <THead>
              <TR>
                <TH>{' '}</TH>
                <TH>Družina</TH>
                <TH>Različica</TH>
                <TH>SKU</TH>
                <TH>Cena</TH>
                <TH>Popust</TH>
                <TH>Akcijska cena</TH>
                <TH>Zaloga</TH>
                <TH>Status</TH>
              </TR>
            </THead>
            <tbody>
              {pagedVariants.map(({ family, variant }) => (
                <tr key={variant.id} className={`border-t border-slate-100 bg-white ${adminTableRowToneClasses.hover}`}>
                  <td className="px-2 py-2">
                    <AdminCheckbox checked={selectedVariantIds.has(variant.id)} onChange={() => toggleVariantSelection(variant.id)} aria-label={`Izberi ${variant.label}`} />
                  </td>
                  <td className="px-2 py-2 font-medium">{family.name}</td>
                  <td className="px-2 py-2">{buildVariantLabel(variant)}</td>
                  <td className="px-2 py-2 text-slate-600">{variant.sku}</td>
                  <td className="px-2 py-2">{formatCurrency(variant.price)}</td>
                  <td className="px-2 py-2 text-emerald-700">{variant.discountPct}%</td>
                  <td className="px-2 py-2">{formatCurrency(computeSalePrice(variant.price, variant.discountPct))}</td>
                  <td className="px-2 py-2">{variant.stock}</td>
                  <td className="px-2 py-2">
                    <Chip variant={variant.active ? 'success' : 'warning'}>{statusLabel(variant.active)}</Chip>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </AdminTableLayout>

      {editorOpen && editorDraft ? (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/35">
          <aside className="h-full w-full max-w-[620px] overflow-y-auto border-l border-slate-200 bg-white">
            <div className="sticky top-0 z-20 border-b border-slate-200 bg-white px-4 py-3">
              <div className="mb-2 flex items-center justify-between">
                <h2 className="text-2xl font-semibold text-slate-900">{editorFamilyId ? 'Uredi artikel' : 'Dodaj artikel'}</h2>
                <IconButton type="button" tone="neutral" onClick={() => setEditorOpen(false)}>
                  <ActionIcon type="close" />
                </IconButton>
              </div>
              <div className="flex items-center gap-4 border-b border-slate-100 text-sm font-medium">
                {([
                  ['osnovno', 'Osnovno'],
                  ['razlicice', 'Različice'],
                  ['slike', 'Slike'],
                  ['dodatno', 'Dodatno']
                ] as Array<[EditorTab, string]>).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    className={`-mb-px border-b-2 pb-2 pt-1 ${editorTab === key ? 'border-[#2f66dd] text-[#2f66dd]' : 'border-transparent text-slate-500'}`}
                    onClick={() => setEditorTab(key)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-6 px-4 py-4">
              {editorTab === 'osnovno' ? (
                <section className="space-y-3">
                  <EditorField label="Naziv družine">
                    <input className={inputClassName} value={editorDraft.name} onChange={(event) => setEditorDraft((current) => (current ? { ...current, name: event.target.value } : current))} />
                  </EditorField>
                  <EditorField label="Opis">
                    <textarea className={`${inputClassName} !h-28 py-2`} value={editorDraft.description} onChange={(event) => setEditorDraft((current) => (current ? { ...current, description: event.target.value } : current))} />
                  </EditorField>
                  <div className="grid grid-cols-2 gap-3">
                    <EditorField label="Kategorija">
                      <input className={inputClassName} value={editorDraft.category} onChange={(event) => setEditorDraft((current) => (current ? { ...current, category: event.target.value } : current))} />
                    </EditorField>
                    <EditorField label="Promo oznaka">
                      <input className={inputClassName} value={editorDraft.promoBadge} onChange={(event) => setEditorDraft((current) => (current ? { ...current, promoBadge: event.target.value } : current))} placeholder="Akcija, Novo ..." />
                    </EditorField>
                    <EditorField label="Privzeti popust %">
                      <input type="number" className={inputClassName} value={editorDraft.defaultDiscountPct} onChange={(event) => setEditorDraft((current) => (current ? { ...current, defaultDiscountPct: Number(event.target.value) || 0 } : current))} />
                    </EditorField>
                    <EditorField label="Sort (družina)">
                      <input type="number" className={inputClassName} value={editorDraft.sort} onChange={(event) => setEditorDraft((current) => (current ? { ...current, sort: Number(event.target.value) || 1 } : current))} />
                    </EditorField>
                  </div>
                  <label className="inline-flex items-center gap-2 text-sm">
                    <AdminCheckbox checked={editorDraft.active} onChange={(event) => setEditorDraft((current) => (current ? { ...current, active: event.target.checked } : current))} />
                    Aktiven v katalogu
                  </label>
                </section>
              ) : null}

              {editorTab === 'razlicice' ? (
                <section className="space-y-4">
                  <div className="rounded-lg border border-slate-200 p-3">
                    <h3 className="mb-2 text-sm font-semibold">Model različic</h3>
                    <div className="grid grid-cols-3 gap-2">
                      <EditorField label="Širina (mm)">
                        <input className={inputClassName} value={variantAttrInputs.width} onChange={(event) => setVariantAttrInputs((current) => ({ ...current, width: event.target.value }))} />
                      </EditorField>
                      <EditorField label="Dolžina (mm)">
                        <input className={inputClassName} value={variantAttrInputs.length} onChange={(event) => setVariantAttrInputs((current) => ({ ...current, length: event.target.value }))} />
                      </EditorField>
                      <EditorField label="Debelina (mm)">
                        <input className={inputClassName} value={variantAttrInputs.thickness} onChange={(event) => setVariantAttrInputs((current) => ({ ...current, thickness: event.target.value }))} />
                      </EditorField>
                    </div>
                    <div className="mt-3 flex gap-2">
                      <Button type="button" variant="primary" size="toolbar" onClick={generateVariants}>
                        Generiraj različice
                      </Button>
                      <Button
                        type="button"
                        variant="default"
                        size="toolbar"
                        onClick={() => setEditorDraft((current) => (current ? { ...current, variants: [...current.variants, createVariant({ sort: current.variants.length + 1 })] } : current))}
                      >
                        Dodaj različico
                      </Button>
                    </div>
                  </div>

                  <div className="rounded-lg border border-slate-200 p-3">
                    <h3 className="mb-2 text-sm font-semibold">Hitre akcije</h3>
                    <div className="flex flex-wrap items-center gap-2">
                      <input className={`${inputClassName} !h-8 !w-24`} value={bulkDiscountValue} onChange={(event) => setBulkDiscountValue(event.target.value)} />
                      <Button type="button" variant="default" size="toolbar" onClick={applyBulkDiscountToSelected}>
                        Uporabi popust na izbrane
                      </Button>
                      <Button type="button" variant="default" size="toolbar" onClick={() => applyBulkStatusToSelected(true)}>
                        Nastavi aktivne
                      </Button>
                      <Button type="button" variant="default" size="toolbar" onClick={() => applyBulkStatusToSelected(false)}>
                        Nastavi skrite
                      </Button>
                      <Button
                        type="button"
                        variant="default"
                        size="toolbar"
                        onClick={() =>
                          exportVariantsCsv(
                            editorDraft.variants
                              .filter((variant) => selectedVariantIds.has(variant.id))
                              .map((variant) => ({ family: editorDraft, variant }))
                          )
                        }
                      >
                        Izvozi izbrane
                      </Button>
                    </div>
                  </div>

                  <div className="overflow-x-auto rounded-lg border border-slate-200">
                    <table className="min-w-full text-xs">
                      <thead className="bg-slate-50">
                        <tr>
                          <th className="px-2 py-2" />
                          <th className="px-2 py-2 text-left">Š × D × Deb.</th>
                          <th className="px-2 py-2 text-left">SKU</th>
                          <th className="px-2 py-2 text-left">Cena</th>
                          <th className="px-2 py-2 text-left">Popust</th>
                          <th className="px-2 py-2 text-left">Akcijska cena</th>
                          <th className="px-2 py-2 text-left">Zaloga</th>
                          <th className="px-2 py-2 text-left">Status</th>
                          <th className="px-2 py-2 text-left">Sort</th>
                          <th className="px-2 py-2 text-right">Akcije</th>
                        </tr>
                      </thead>
                      <tbody>
                        {editorDraft.variants.map((variant, index) => (
                          <tr key={variant.id} className="border-t border-slate-100">
                            <td className="px-2 py-2">
                              <AdminCheckbox checked={selectedVariantIds.has(variant.id)} onChange={() => toggleVariantSelection(variant.id)} aria-label={`Izberi ${variant.label}`} />
                            </td>
                            <td className="px-2 py-2">
                              <input
                                className={`${inputClassName} !h-8`}
                                value={buildVariantLabel(variant)}
                                onChange={(event) =>
                                  setEditorDraft((current) => {
                                    if (!current) return current;
                                    const next = [...current.variants];
                                    next[index] = { ...next[index], label: event.target.value, width: null, length: null, thickness: null };
                                    return { ...current, variants: next };
                                  })
                                }
                              />
                            </td>
                            <td className="px-2 py-2"><input className={`${inputClassName} !h-8`} value={variant.sku} onChange={(event) => setEditorDraft((current) => {
                              if (!current) return current;
                              const next = [...current.variants];
                              next[index] = { ...next[index], sku: event.target.value };
                              return { ...current, variants: next };
                            })} /></td>
                            <td className="px-2 py-2"><input type="number" className={`${inputClassName} !h-8`} value={variant.price} onChange={(event) => setEditorDraft((current) => {
                              if (!current) return current;
                              const next = [...current.variants];
                              next[index] = { ...next[index], price: Number(event.target.value) || 0 };
                              return { ...current, variants: next };
                            })} /></td>
                            <td className="px-2 py-2"><input type="number" className={`${inputClassName} !h-8`} value={variant.discountPct} onChange={(event) => setEditorDraft((current) => {
                              if (!current) return current;
                              const next = [...current.variants];
                              next[index] = { ...next[index], discountPct: Number(event.target.value) || 0 };
                              return { ...current, variants: next };
                            })} /></td>
                            <td className="px-2 py-2 text-slate-700">{formatCurrency(computeSalePrice(variant.price, variant.discountPct))}</td>
                            <td className="px-2 py-2"><input type="number" className={`${inputClassName} !h-8`} value={variant.stock} onChange={(event) => setEditorDraft((current) => {
                              if (!current) return current;
                              const next = [...current.variants];
                              next[index] = { ...next[index], stock: Number(event.target.value) || 0 };
                              return { ...current, variants: next };
                            })} /></td>
                            <td className="px-2 py-2 text-center">
                              <input
                                type="checkbox"
                                className="h-4 w-4"
                                checked={variant.active}
                                onChange={(event) =>
                                  setEditorDraft((current) => {
                                    if (!current) return current;
                                    const next = [...current.variants];
                                    next[index] = { ...next[index], active: event.target.checked };
                                    return { ...current, variants: next };
                                  })
                                }
                              />
                            </td>
                            <td className="px-2 py-2"><input type="number" className={`${inputClassName} !h-8`} value={variant.sort} onChange={(event) => setEditorDraft((current) => {
                              if (!current) return current;
                              const next = [...current.variants];
                              next[index] = { ...next[index], sort: Number(event.target.value) || 1 };
                              return { ...current, variants: next };
                            })} /></td>
                            <td className="px-2 py-2 text-right">
                              <IconButton
                                type="button"
                                tone="neutral"
                                onClick={() =>
                                  setEditorDraft((current) =>
                                    current
                                      ? {
                                          ...current,
                                          variants: current.variants.filter((entry) => entry.id !== variant.id)
                                        }
                                      : current
                                  )
                                }
                              >
                                <ActionIcon type="archive" />
                              </IconButton>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              ) : null}

              {editorTab === 'slike' ? (
                <section className="space-y-4">
                  <EditorField label="Galerija družine">
                    <input
                      type="file"
                      className={inputClassName}
                      multiple
                      accept="image/*"
                      onChange={(event) => {
                        const urls = Array.from(event.target.files ?? []).map((file) => URL.createObjectURL(file));
                        setEditorDraft((current) => (current ? { ...current, images: [...current.images, ...urls] } : current));
                      }}
                    />
                  </EditorField>
                  <div className="grid grid-cols-3 gap-2">
                    {editorDraft.images.map((img, index) => (
                      <div key={`${img}-${index}`} className="overflow-hidden rounded-md border border-slate-200">
                        <Image src={img} alt={`Slika ${index + 1}`} width={160} height={110} unoptimized className="h-24 w-full object-cover" />
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-slate-500">Različice lahko po potrebi prepišejo sliko preko polja imageOverride v naslednjih iteracijah.</p>
                </section>
              ) : null}

              {editorTab === 'dodatno' ? (
                <section className="space-y-3">
                  <EditorField label="Slug">
                    <input className={inputClassName} value={editorDraft.slug} onChange={(event) => setEditorDraft((current) => (current ? { ...current, slug: event.target.value } : current))} />
                  </EditorField>
                  <EditorField label="Opombe (admin)">
                    <textarea className={`${inputClassName} !h-28 py-2`} value={editorDraft.notes} onChange={(event) => setEditorDraft((current) => (current ? { ...current, notes: event.target.value } : current))} />
                  </EditorField>
                </section>
              ) : null}
            </div>

            <div className="sticky bottom-0 flex items-center justify-between gap-2 border-t border-slate-200 bg-white px-4 py-3">
              <Button type="button" variant="default" size="toolbar" onClick={() => setEditorOpen(false)}>
                Prekliči
              </Button>
              <Button type="button" variant="primary" size="toolbar" onClick={saveEditor}>
                <ActionIcon type="save" />
                Shrani spremembe
              </Button>
            </div>
          </aside>
        </div>
      ) : null}
    </div>
  );
}
