'use client';

import { Fragment, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/shared/ui/button';
import { Chip } from '@/shared/ui/badge';
import { AdminTableLayout } from '@/shared/ui/admin-table';
import { AdminCheckbox } from '@/shared/ui/checkbox';
import { AdminSearchInput } from '@/shared/ui/admin-search-input';
import { ColumnFilterIcon, DownloadIcon, PencilIcon, SaveIcon, TrashCanIcon } from '@/shared/ui/icons/AdminActionIcons';
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
type OpenFilter = 'category' | 'status' | 'discount' | null;

const PAGE_SIZE_OPTIONS = [20, 50, 100];
const HEADER_FILTER_BUTTON_CLASS = 'group inline-flex h-[12px] w-[12px] shrink-0 self-center items-center justify-center text-slate-500';
const formatPriceRange = (minPrice: number, maxPrice: number) =>
  `${minPrice.toLocaleString('sl-SI', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} – ${maxPrice.toLocaleString('sl-SI', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;

export default function AdminItemsManager({ seedItems }: { seedItems: SeedItemTuple[] }) {
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
  const [deletedVariantIds, setDeletedVariantIds] = useState<Set<string>>(new Set());
  const [variantDrafts, setVariantDrafts] = useState<Record<string, { label: string; sku: string; price: number; discountPct: number; stock: number; active: boolean }>>({});

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

  const paginationTotal = filteredFamilies.length;
  const { page, pageSize, pageCount, setPage, setPageSize } = useTablePagination({
    totalCount: paginationTotal,
    storageKey: 'adminArtikli.families.pageSize',
    defaultPageSize: 20,
    pageSizeOptions: PAGE_SIZE_OPTIONS
  });

  const pagedFamilies = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredFamilies.slice(start, start + pageSize);
  }, [filteredFamilies, page, pageSize]);

  useEffect(() => {
    setPage(1);
  }, [categoryFilter, discountFilter, search, setPage, statusFilter]);

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
  const startVariantEdit = (variant: Variant) => {
    setEditingVariantId(variant.id);
    setVariantDrafts((current) => ({
      ...current,
      [variant.id]: {
        label: variantLabel(variant),
        sku: variant.sku,
        price: variant.price,
        discountPct: variant.discountPct,
        stock: variant.stock,
        active: variant.active
      }
    }));
  };
  const saveVariantEdit = (variantId: string) => setEditingVariantId((current) => (current === variantId ? null : current));
  const removeVariantRow = (variantId: string) =>
    setDeletedVariantIds((current) => {
      const next = new Set(current);
      next.add(variantId);
      return next;
    });

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
                <TH className="w-[30%]">Artikel</TH>
                <TH className="w-[30%]">
                  <div className="relative inline-flex items-center gap-1">
                    Kategorija
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
                <TH className="text-center">Št. različic</TH>
                <TH>Razpon cen</TH>
                <TH className="text-center">
                  <div className="relative inline-flex items-center gap-1">
                    Popust
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
                <TH className="text-center">
                  <div className="relative inline-flex items-center gap-1">
                    Status
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
                          <MenuItem onClick={() => { setStatusFilter('hidden'); setOpenFilter(null); }}>Skrit</MenuItem>
                        </MenuPanel>
                      </div>
                    ) : null}
                  </div>
                </TH>
                <TH className="w-20 text-center">Uredi</TH>
              </TR>
            </THead>
            <tbody>
              {pagedFamilies.map((family) => {
                const isExpanded = expandedFamilyIds.has(family.id);
                const visibleVariants = family.variants.filter(
                  (variant) => variantLabel(variant) !== 'Osnovna različica' && !deletedVariantIds.has(variant.id)
                );
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
                      <td className="px-2 py-3 text-center text-emerald-700">{family.defaultDiscountPct}%</td>
                      <td className="px-2 py-3 text-center"><Chip variant={family.active ? 'success' : 'warning'}>{statusLabel(family.active)}</Chip></td>
                      <td className="px-2 py-3 text-center"><RowActionsDropdown label={`Možnosti za ${family.name}`} items={[{ key: 'edit', label: 'Uredi', onSelect: () => (window.location.href = `/admin/artikli/${encodeURIComponent(family.slug || family.id)}`) }]} /></td>
                    </tr>
                    {isExpanded ? (
                      <tr className="border-t border-slate-100 bg-slate-50/70">
                        <td />
                        <td colSpan={7} className="p-0">
                          <table className="w-full text-[12px]">
                            <thead>
                              <tr className="border-b border-slate-200 text-slate-600">
                                <th className="px-2 py-2" />
                                <th className="px-2 py-2 text-left">Različica</th>
                                <th className="px-2 py-2 text-left">SKU</th>
                                <th className="px-2 py-2 text-right">Cena</th>
                                <th className="px-2 py-2 text-center">Popust</th>
                                <th className="px-2 py-2 text-right">Akcijska cena</th>
                                <th className="px-2 py-2 text-right">Zaloga</th>
                                <th className="px-2 py-2 text-center">Status</th>
                                <th className="px-2 py-2 text-center">Uredi</th>
                              </tr>
                            </thead>
                            <tbody>
                              {visibleVariants.map((variant) => {
                                const isEditing = editingVariantId === variant.id;
                                const draft = variantDrafts[variant.id] ?? {
                                  label: variantLabel(variant),
                                  sku: variant.sku,
                                  price: variant.price,
                                  discountPct: variant.discountPct,
                                  stock: variant.stock,
                                  active: variant.active
                                };
                                const actionPrice = computeSalePrice(draft.price, draft.discountPct);
                                return (
                                  <tr key={variant.id} className="border-t border-slate-100">
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
                                          className="h-10 w-full rounded-md border border-slate-300 bg-white px-2.5 text-sm text-slate-900 outline-none transition focus:border-[#3e67d6] focus:ring-0"
                                          value={draft.label}
                                          onChange={(event) =>
                                            setVariantDrafts((current) => ({
                                              ...current,
                                              [variant.id]: { ...draft, label: event.target.value }
                                            }))
                                          }
                                        />
                                      ) : (
                                        draft.label
                                      )}
                                    </td>
                                    <td className="px-2 py-2">
                                      {isEditing ? (
                                        <input
                                          className="h-10 w-full rounded-md border border-slate-300 bg-white px-2.5 text-sm text-slate-900 outline-none transition focus:border-[#3e67d6] focus:ring-0"
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
                                    <td className="px-2 py-2 text-right">
                                      {isEditing ? (
                                        <input
                                          type="number"
                                          step="0.01"
                                          className="h-10 w-full rounded-md border border-slate-300 bg-white px-2.5 text-right text-sm text-slate-900 outline-none transition focus:border-[#3e67d6] focus:ring-0"
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
                                    <td className="px-2 py-2 text-center text-emerald-700">
                                      {isEditing ? (
                                        <input
                                          type="number"
                                          min={0}
                                          max={100}
                                          className="h-10 w-full rounded-md border border-slate-300 bg-white px-2.5 text-center text-sm text-slate-900 outline-none transition focus:border-[#3e67d6] focus:ring-0"
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
                                    <td className="px-2 py-2 text-right">{formatCurrency(actionPrice)}</td>
                                    <td className="px-2 py-2 text-right">
                                      {isEditing ? (
                                        <input
                                          type="number"
                                          className="h-10 w-full rounded-md border border-slate-300 bg-white px-2.5 text-right text-sm text-slate-900 outline-none transition focus:border-[#3e67d6] focus:ring-0"
                                          value={draft.stock}
                                          onChange={(event) =>
                                            setVariantDrafts((current) => ({
                                              ...current,
                                              [variant.id]: { ...draft, stock: Number(event.target.value) || 0 }
                                            }))
                                          }
                                        />
                                      ) : (
                                        draft.stock
                                      )}
                                    </td>
                                    <td className="px-2 py-2 text-center">
                                      {isEditing ? (
                                        <select
                                          className="h-10 w-full rounded-md border border-slate-300 bg-white px-2.5 text-sm text-slate-900 outline-none transition focus:border-[#3e67d6] focus:ring-0"
                                          value={draft.active ? 'active' : 'hidden'}
                                          onChange={(event) =>
                                            setVariantDrafts((current) => ({
                                              ...current,
                                              [variant.id]: { ...draft, active: event.target.value === 'active' }
                                            }))
                                          }
                                        >
                                          <option value="active">Aktiven</option>
                                          <option value="hidden">Skrit</option>
                                        </select>
                                      ) : (
                                        <Chip variant={draft.active ? 'success' : 'warning'}>{statusLabel(draft.active)}</Chip>
                                      )}
                                    </td>
                                    <td className="px-2 py-2 text-center">
                                      <RowActionsDropdown
                                        label={`Uredi ${variant.sku}`}
                                        items={[
                                          {
                                            key: 'edit',
                                            label: 'Uredi',
                                            icon: <PencilIcon />,
                                            onSelect: () => startVariantEdit(variant)
                                          },
                                          {
                                            key: 'save',
                                            label: 'Shrani',
                                            icon: <SaveIcon />,
                                            disabled: !isEditing,
                                            onSelect: () => saveVariantEdit(variant.id)
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
