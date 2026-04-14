'use client';

import Link from 'next/link';
import { Fragment, useEffect, useMemo, useState } from 'react';
import { Button } from '@/shared/ui/button';
import { Chip } from '@/shared/ui/badge';
import { AdminTableLayout } from '@/shared/ui/admin-table';
import { AdminCheckbox } from '@/shared/ui/checkbox';
import { AdminSearchInput } from '@/shared/ui/admin-search-input';
import { ColumnFilterIcon, DownloadIcon } from '@/shared/ui/icons/AdminActionIcons';
import { MenuItem, MenuPanel } from '@/shared/ui/menu';
import { RowActionsDropdown, Table, THead, TH, TR } from '@/shared/ui/table';
import { EuiTablePagination, useTablePagination } from '@/shared/ui/pagination';
import { adminTableRowToneClasses, filterPillTokenClasses } from '@/shared/ui/theme/tokens';
import {
  buildFamiliesFromSeed,
  computeSalePrice,
  formatCurrency,
  statusLabel,
  type ProductFamily,
  type SeedItemTuple,
  type Variant,
  variantLabel
} from '@/admin/features/artikli/lib/familyModel';

type StatusFilter = 'all' | 'active' | 'hidden';
type DiscountFilter = 'all' | 'yes' | 'no';
type ListMode = 'families' | 'variants';
type OpenFilter = 'category' | 'status' | 'discount' | null;

const PAGE_SIZE_OPTIONS = [20, 50, 100];
const HEADER_FILTER_BUTTON_CLASS = 'group inline-flex h-[12px] w-[12px] shrink-0 self-center items-center justify-center text-slate-500';
const formatPriceRange = (minPrice: number, maxPrice: number) =>
  `${minPrice.toLocaleString('sl-SI', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} – ${maxPrice.toLocaleString('sl-SI', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;

export default function AdminItemsManager({ seedItems }: { seedItems: SeedItemTuple[] }) {
  const [search, setSearch] = useState('');
  const [mode, setMode] = useState<ListMode>('families');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [discountFilter, setDiscountFilter] = useState<DiscountFilter>('all');
  const [openFilter, setOpenFilter] = useState<OpenFilter>(null);
  const [expandedFamilyIds, setExpandedFamilyIds] = useState<Set<string>>(new Set());
  const [selectedFamilyIds, setSelectedFamilyIds] = useState<Set<string>>(new Set());
  const [selectedVariantIds, setSelectedVariantIds] = useState<Set<string>>(new Set());
  const [createModePickerOpen, setCreateModePickerOpen] = useState(false);

  const families = useMemo(() => buildFamiliesFromSeed(seedItems), [seedItems]);
  const categories = useMemo(() => Array.from(new Set(families.map((family) => family.category))).sort((a, b) => a.localeCompare(b, 'sl')), [families]);

  const filteredFamilies = useMemo(() => {
    const q = search.trim().toLowerCase();
    return families.filter((family) => {
      const matchesSearch =
        q.length === 0 ||
        family.name.toLowerCase().includes(q) ||
        family.variants.some((variant) => {
          const label = variantLabel(variant);
          if (label === 'Osnovna različica') return false;
          return variant.sku.toLowerCase().includes(q) || label.toLowerCase().includes(q);
        });
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
        if (variantLabel(variant) === 'Osnovna različica') return;
        rows.push({ family, variant });
      });
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
  }, [categoryFilter, discountFilter, mode, search, setPage, statusFilter]);

  useEffect(() => {
    if (!openFilter) return;
    const close = () => setOpenFilter(null);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [openFilter]);

  const exportVariantsCsv = () => {
    const headers = ['Družina', 'Različica', 'SKU', 'Cena', 'Popust', 'Akcijska cena', 'Zaloga', 'Status'];
    const csvRows = flatVariants.map(({ family, variant }) => [
      family.name,
      variantLabel(variant),
      variant.sku,
      variant.price.toFixed(2),
      `${variant.discountPct}`,
      `${computeSalePrice(variant.price, variant.discountPct).toFixed(2)}`,
      `${variant.stock}`,
      statusLabel(variant.active)
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

  const allVisibleFamilyIds = useMemo(() => new Set(pagedFamilies.map((family) => family.id)), [pagedFamilies]);
  const familiesSelectedOnPage = pagedFamilies.length > 0 && pagedFamilies.every((family) => selectedFamilyIds.has(family.id));

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
            <div className="inline-flex rounded-lg border border-slate-200 p-0.5 text-xs font-semibold">
              <button type="button" className={`rounded-md px-3 py-1.5 ${mode === 'families' ? 'bg-[#2f66dd] text-white' : 'text-slate-600'}`} onClick={() => setMode('families')}>Družine</button>
              <button type="button" className={`rounded-md px-3 py-1.5 ${mode === 'variants' ? 'bg-[#2f66dd] text-white' : 'text-slate-600'}`} onClick={() => setMode('variants')}>Različice</button>
            </div>
          </div>
        }
        headerRight={
          <div className="flex items-center gap-2">
            <Button type="button" variant="default" size="toolbar" onClick={exportVariantsCsv}>
              <DownloadIcon />
              Izvozi CSV
            </Button>
            <div className="relative">
              <Button
                type="button"
                variant="primary"
                size="toolbar"
                aria-label="Dodaj artikel"
                onClick={() => setCreateModePickerOpen((current) => !current)}
              >
                Dodaj artikel
              </Button>
              {createModePickerOpen ? (
                <div className="absolute right-0 top-10 z-20 w-56 rounded-lg border border-slate-200 bg-white p-1 shadow-lg">
                  <Link href="/admin/artikli/nov?tip=simple" className="block w-full rounded-md px-3 py-2 text-left text-sm hover:bg-slate-100">Enostaven artikel</Link>
                  <Link href="/admin/artikli/nov?tip=variants" className="block w-full rounded-md px-3 py-2 text-left text-sm hover:bg-slate-100">Artikel z različicami</Link>
                </div>
              ) : null}
            </div>
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
                Status: {statusFilter === 'active' ? 'Aktiven' : 'Skrit'}
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
          </div>
        }
        filterRowRight={<EuiTablePagination page={page} pageCount={pageCount} onPageChange={setPage} itemsPerPage={pageSize} onChangeItemsPerPage={setPageSize} itemsPerPageOptions={PAGE_SIZE_OPTIONS} />}
        contentClassName="overflow-x-auto overflow-y-visible bg-white"
        footerRight={<EuiTablePagination page={page} pageCount={pageCount} onPageChange={setPage} itemsPerPage={pageSize} onChangeItemsPerPage={setPageSize} itemsPerPageOptions={PAGE_SIZE_OPTIONS} />}
      >
        {mode === 'families' ? (
          <Table className="w-full table-fixed text-[12px]">
            <THead><TR><TH className="w-10 px-2 text-center"><AdminCheckbox checked={familiesSelectedOnPage} onChange={() => setSelectedFamilyIds((current) => {
              const next = new Set(current);
              if (familiesSelectedOnPage) allVisibleFamilyIds.forEach((id) => next.delete(id));
              else allVisibleFamilyIds.forEach((id) => next.add(id));
              return next;
            })} aria-label="Izberi vse družine" /></TH><TH>Družina</TH><TH><div className="relative inline-flex items-center gap-1">Kategorija<button type="button" className={HEADER_FILTER_BUTTON_CLASS} onClick={(event) => { event.stopPropagation(); setOpenFilter((current) => current === 'category' ? null : 'category'); }} aria-label="Filtriraj kategorijo"><ColumnFilterIcon className="!h-[12px] !w-[12px]" /></button>{openFilter === 'category' ? <div className="absolute left-0 top-5 z-20" onMouseDown={(event) => event.stopPropagation()}><MenuPanel className="w-44">{[{ value: 'all', label: 'Vse kategorije' }, ...categories.map((category) => ({ value: category, label: category }))].map((option) => <MenuItem key={option.value} onClick={() => { setCategoryFilter(option.value); setOpenFilter(null); }}>{option.label}</MenuItem>)}</MenuPanel></div> : null}</div></TH><TH className="text-center">Št. različic</TH><TH>Razpon cen</TH><TH><div className="relative inline-flex items-center gap-1">Popust<button type="button" className={HEADER_FILTER_BUTTON_CLASS} onClick={(event) => { event.stopPropagation(); setOpenFilter((current) => current === 'discount' ? null : 'discount'); }} aria-label="Filtriraj popust"><ColumnFilterIcon className="!h-[12px] !w-[12px]" /></button>{openFilter === 'discount' ? <div className="absolute left-0 top-5 z-20" onMouseDown={(event) => event.stopPropagation()}><MenuPanel className="w-40"><MenuItem onClick={() => { setDiscountFilter('all'); setOpenFilter(null); }}>Vsi</MenuItem><MenuItem onClick={() => { setDiscountFilter('yes'); setOpenFilter(null); }}>S popustom</MenuItem><MenuItem onClick={() => { setDiscountFilter('no'); setOpenFilter(null); }}>Brez popusta</MenuItem></MenuPanel></div> : null}</div></TH><TH><div className="relative inline-flex items-center gap-1">Status<button type="button" className={HEADER_FILTER_BUTTON_CLASS} onClick={(event) => { event.stopPropagation(); setOpenFilter((current) => current === 'status' ? null : 'status'); }} aria-label="Filtriraj status"><ColumnFilterIcon className="!h-[12px] !w-[12px]" /></button>{openFilter === 'status' ? <div className="absolute left-0 top-5 z-20" onMouseDown={(event) => event.stopPropagation()}><MenuPanel className="w-36"><MenuItem onClick={() => { setStatusFilter('all'); setOpenFilter(null); }}>Vsi</MenuItem><MenuItem onClick={() => { setStatusFilter('active'); setOpenFilter(null); }}>Aktiven</MenuItem><MenuItem onClick={() => { setStatusFilter('hidden'); setOpenFilter(null); }}>Skrit</MenuItem></MenuPanel></div> : null}</div></TH><TH className="w-20 text-center">Akcije</TH></TR></THead>
            <tbody>
              {pagedFamilies.map((family) => {
                const isExpanded = expandedFamilyIds.has(family.id);
                const visibleVariants = family.variants.filter((variant) => variantLabel(variant) !== 'Osnovna različica');
                const prices = family.variants.map((variant) => variant.price);
                const minPrice = prices.length ? Math.min(...prices) : 0;
                const maxPrice = prices.length ? Math.max(...prices) : 0;
                return (
                  <Fragment key={family.id}>
                    <tr className={`border-t border-slate-100 bg-white ${adminTableRowToneClasses.hover}`}>
                      <td className="w-10 px-2 py-2 text-center"><AdminCheckbox checked={selectedFamilyIds.has(family.id)} onChange={() => setSelectedFamilyIds((current) => {
                        const next = new Set(current);
                        if (next.has(family.id)) next.delete(family.id); else next.add(family.id);
                        return next;
                      })} aria-label={`Izberi ${family.name}`} /></td>
                      <td className="px-2 py-3">
                        <button type="button" className="inline-flex items-start gap-2 text-left" onClick={() => setExpandedFamilyIds((current) => {
                          const next = new Set(current);
                          if (next.has(family.id)) next.delete(family.id); else next.add(family.id);
                          return next;
                        })}>
                          <span className="mt-0.5 inline-flex h-4 w-4 items-center justify-center text-slate-500">{isExpanded ? '▾' : '▸'}</span>
                          <span className="block text-sm font-semibold text-slate-900">{family.name}</span>
                        </button>
                      </td>
                      <td className="px-2 py-3 text-slate-600">{family.category}</td>
                      <td className="px-2 py-3 text-center">{visibleVariants.length}</td>
                      <td className="px-2 py-3">{formatPriceRange(minPrice, maxPrice)}</td>
                      <td className="px-2 py-3 text-emerald-700">{family.defaultDiscountPct}%</td>
                      <td className="px-2 py-3"><Chip variant={family.active ? 'success' : 'warning'}>{statusLabel(family.active)}</Chip></td>
                      <td className="px-2 py-3 text-center"><RowActionsDropdown label={`Možnosti za ${family.name}`} items={[{ key: 'edit', label: 'Uredi', onSelect: () => (window.location.href = `/admin/artikli/${encodeURIComponent(family.id)}`) }]} /></td>
                    </tr>
                    {isExpanded ? <tr className="border-t border-slate-100 bg-slate-50/70"><td /><td colSpan={7} className="p-0"><table className="w-full text-[12px]"><thead><tr className="border-b border-slate-200 text-slate-600"><th className="px-2 py-2" /><th className="px-2 py-2 text-left">Različica</th><th className="px-2 py-2 text-left">SKU</th><th className="px-2 py-2 text-left">Cena</th><th className="px-2 py-2 text-left">Popust</th><th className="px-2 py-2 text-left">Akcijska cena</th><th className="px-2 py-2 text-left">Zaloga</th><th className="px-2 py-2 text-left">Status</th></tr></thead><tbody>{visibleVariants.map((variant) => <tr key={variant.id} className="border-t border-slate-100"><td className="px-2 py-2 text-center"><AdminCheckbox checked={selectedVariantIds.has(variant.id)} onChange={() => setSelectedVariantIds((current) => {
                      const next = new Set(current); if (next.has(variant.id)) next.delete(variant.id); else next.add(variant.id); return next;
                    })} /></td><td className="px-2 py-2 font-medium">{variantLabel(variant)}</td><td className="px-2 py-2">{variant.sku}</td><td className="px-2 py-2">{formatCurrency(variant.price)}</td><td className="px-2 py-2 text-emerald-700">{variant.discountPct}%</td><td className="px-2 py-2">{formatCurrency(computeSalePrice(variant.price, variant.discountPct))}</td><td className="px-2 py-2">{variant.stock}</td><td className="px-2 py-2"><Chip variant={variant.active ? 'success' : 'warning'}>{statusLabel(variant.active)}</Chip></td></tr>)}</tbody></table></td></tr> : null}
                  </Fragment>
                );
              })}
            </tbody>
          </Table>
        ) : (
          <Table className="w-full table-fixed text-[12px]">
            <THead>
              <TR>
                <TH className="w-10 px-2 text-center">{' '}</TH>
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
                  <td className="w-10 px-2 py-2 text-center">
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
                    <Link href={`/admin/artikli/${encodeURIComponent(family.id)}`} className="text-[#2f66dd] hover:underline">
                      {family.name}
                    </Link>
                  </td>
                  <td className="px-2 py-2">{variantLabel(variant)}</td>
                  <td className="px-2 py-2">{variant.sku}</td>
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
    </div>
  );
}
