'use client';

import Image from 'next/image';
import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { Button } from '@/shared/ui/button';
import { IconButton } from '@/shared/ui/icon-button';
import { ADMIN_CONTROL_HEIGHT, ADMIN_CONTROL_PADDING_X } from '@/shared/ui/admin-controls/controlSizes';
import { SegmentedControl } from '@/shared/ui/segmented';
import { CustomSelect } from '@/shared/ui/select';
import { Table, THead, TH, TR } from '@/shared/ui/table';
import { Chip } from '@/shared/ui/badge';
import { useToast } from '@/shared/ui/toast';
import { Pagination, PageSizeSelect, useTablePagination } from '@/shared/ui/pagination';
import { AdminTableLayout } from '@/shared/ui/admin-table';
import { buttonTokenClasses } from '@/shared/ui/theme/tokens';

type Item = {
  id: string;
  name: string;
  description: string;
  category: string;
  price: number;
  discountPct: number;
  unit: string;
  sku: string;
  active: boolean;
  images: string[];
  updatedAt: string;
  archivedAt?: string | null;
};

type SortKey = 'name' | 'sku' | 'category' | 'price' | 'status';
type StatusTab = 'active' | 'inactive';

const STORAGE_KEY = 'admin-items-crud-v2';
const PAGE_SIZE_OPTIONS = [50, 100];

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('sl-SI', { style: 'currency', currency: 'EUR' }).format(value);

const nowIso = () => new Date().toISOString();

const emptyItem = (): Item => ({
  id: crypto.randomUUID(),
  name: '',
  description: '',
  category: '',
  price: 0,
  discountPct: 0,
  unit: 'kos',
  sku: '',
  active: true,
  images: [],
  updatedAt: nowIso(),
  archivedAt: null
});

const discountedPrice = (price: number, discountPct: number) =>
  Number((price * (1 - Math.max(0, Math.min(100, discountPct)) / 100)).toFixed(2));

const statusTabs: Array<{ key: StatusTab; label: string; activeClassName: string }> = [
  { key: 'active', label: 'Aktivni', activeClassName: buttonTokenClasses.activeSuccessBorderless },
  { key: 'inactive', label: 'Neaktivni', activeClassName: buttonTokenClasses.inactiveNeutralBorderless }
];

function SortIndicator({ active, direction }: { active: boolean; direction: 'asc' | 'desc' }) {
  if (!active) return <span className="ml-1 text-slate-300">↕</span>;
  return <span className="ml-1 text-slate-500">{direction === 'asc' ? '↑' : '↓'}</span>;
}

function ActionIcon({ type }: { type: 'edit' | 'copy' | 'archive' }) {
  if (type === 'edit') return <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 14.8V17h2.2L15.8 6.4l-2.2-2.2L3 14.8z"/><path d="M12.9 3.1l2.2 2.2"/></svg>;
  if (type === 'copy') return <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="7" y="7" width="10" height="10" rx="2"/><rect x="3" y="3" width="10" height="10" rx="2"/></svg>;
  return <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 6h14v11H3z"/><path d="M7 6V4h6v2"/></svg>;
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
  children
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  children: ReactNode;
}) {
  return (
    <div className="relative">
      <label className="pointer-events-none absolute left-3 top-1.5 z-10 bg-white px-1 text-[10px] text-slate-600">
        {label}
      </label>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 w-full appearance-none rounded-xl border border-slate-300 bg-white px-3 pb-1.5 pt-5 text-sm text-slate-900 outline-none transition focus:border-[#3e67d6] focus:ring-0 focus:ring-[#3e67d6]"
      >
        {children}
      </select>
    </div>
  );
}

export default function AdminItemsManager({ seedItems }: { seedItems: Item[] }) {
  const [items, setItems] = useState<Item[]>(seedItems.map((item) => ({ ...item, archivedAt: item.archivedAt ?? null })));
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
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as Item[];
      if (Array.isArray(parsed)) {
        setItems(parsed.map((item) => ({ ...item, archivedAt: item.archivedAt ?? null })));
      }
    } catch {
      // ignore malformed local state
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  const categories = useMemo(
    () =>
      Array.from(
        new Set(
          items
            .filter((item) => !item.archivedAt)
            .map((item) => item.category)
            .filter(Boolean)
        )
      ).sort((a, b) => a.localeCompare(b, 'sl')),
    [items]
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
      const matchesSearch =
        !q ||
        item.name.toLowerCase().includes(q) ||
        item.sku.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q);
      const matchesCategory = categoryFilter === 'all' || item.category === categoryFilter;
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
  }, [categoryFilter, items, search, sortDirection, sortKey, statusTab]);

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
  const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.includes(id));

  useEffect(() => {
    setPage(1);
  }, [categoryFilter, search, setPage, sortDirection, sortKey, statusTab]);

  useEffect(() => {
    setSelectedIds((current) => current.filter((id) => filteredItems.some((item) => item.id === id)));
  }, [filteredItems]);

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
      setSelectedIds((current) => current.filter((id) => !visibleIds.includes(id)));
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
    setEditorOpen(true);
  };

  const openEdit = (item: Item) => {
    setEditingId(item.id);
    setDraft(item);
    setNewCategoryEnabled(false);
    setNewCategoryValue('');
    setEditorOpen(true);
  };

  const save = () => {
    const resolvedCategory = newCategoryEnabled ? newCategoryValue.trim() : draft.category.trim();
    if (!draft.name.trim() || !draft.sku.trim() || !resolvedCategory) {
      toast.error('Napaka pri shranjevanju');
      return;
    }
    const next = {
      ...draft,
      category: resolvedCategory,
      discountPct: Math.max(0, Math.min(100, draft.discountPct)),
      updatedAt: nowIso(),
      archivedAt: null
    };

    setItems((prev) => {
      if (!editingId) return [next, ...prev];
      return prev.map((item) => (item.id === editingId ? next : item));
    });
    setEditorOpen(false);
    toast.success(editingId ? 'Shranjeno' : 'Dodano');
  };

  const duplicate = (item: Item) => {
    const copy = {
      ...item,
      id: crypto.randomUUID(),
      sku: `${item.sku}-copy`,
      name: `${item.name} (kopija)`,
      updatedAt: nowIso(),
      archivedAt: null
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
          <>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Poišči po nazivu, SKU ali kategoriji …"
              className={`${ADMIN_CONTROL_HEIGHT} min-w-[240px] flex-1 rounded-xl border border-slate-300 ${ADMIN_CONTROL_PADDING_X} text-xs focus:border-[#3e67d6] focus:ring-0 focus:ring-[#3e67d6]`}
            />
            <div className="relative min-w-[220px]">
              <CustomSelect
                value={categoryFilter}
                onChange={setCategoryFilter}
                options={[
                  { value: 'all', label: 'Vse kategorije' },
                  ...categories.map((category) => ({ value: category, label: category }))
                ]}
                className={`${ADMIN_CONTROL_HEIGHT} ${ADMIN_CONTROL_PADDING_X} py-0 text-xs font-semibold`}
                valueClassName="min-w-0 flex-1 text-left"
                menuClassName="min-w-full w-max max-w-[560px]"
              />
            </div>
          </>
        }
        headerRight={
          <>
            <Button type="button" variant="archive" className={`${ADMIN_CONTROL_HEIGHT} ${ADMIN_CONTROL_PADDING_X}`} onClick={archiveSelected} disabled={selectedIds.length === 0}>
              Arhiviraj
            </Button>
            <Button type="button" variant="primary" className={`${ADMIN_CONTROL_HEIGHT} ${ADMIN_CONTROL_PADDING_X}`} onClick={openCreate}>
              Nov artikel
            </Button>
          </>
        }
        filterRowLeft={
          <SegmentedControl
            size="sm"
            className="border-transparent"
            value={statusTab}
            onChange={(next) => setStatusTab(next as StatusTab)}
            options={statusTabs.map((tab) => ({ value: tab.key, label: tab.label, activeClassName: tab.activeClassName }))}
          />
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
        <div className="overflow-x-auto">
          <Table className="min-w-[1000px] text-sm">
            <THead>
              <TR>
                <TH className="text-center"><input type="checkbox" checked={allSelected} onChange={toggleAll} aria-label="Izberi vse" /></TH>
                <TH>
                  <button type="button" onClick={() => handleSort('name')} className="inline-flex items-center font-semibold hover:text-slate-700">Naziv <SortIndicator active={sortKey === 'name'} direction={sortDirection} /></button>
                </TH>
                <TH>
                  <button type="button" onClick={() => handleSort('sku')} className="inline-flex items-center font-semibold hover:text-slate-700">SKU <SortIndicator active={sortKey === 'sku'} direction={sortDirection} /></button>
                </TH>
                <TH>
                  <button type="button" onClick={() => handleSort('category')} className="inline-flex items-center font-semibold hover:text-slate-700">Kategorija <SortIndicator active={sortKey === 'category'} direction={sortDirection} /></button>
                </TH>
                <TH className="text-center">
                  <button type="button" onClick={() => handleSort('price')} className="inline-flex items-center font-semibold hover:text-slate-700">Cena <SortIndicator active={sortKey === 'price'} direction={sortDirection} /></button>
                </TH>
                <TH className="text-center"><span className="inline-flex items-center">Popust</span></TH>
                <TH className="whitespace-nowrap text-center"><span className="inline-flex items-center">Akcijska cena</span></TH>
                <TH className="text-center">
                  <button type="button" onClick={() => handleSort('status')} className="inline-flex items-center font-semibold hover:text-slate-700">Status <SortIndicator active={sortKey === 'status'} direction={sortDirection} /></button>
                </TH>
                <TH className="text-center"><span className="inline-flex items-center">Uredi</span></TH>
              </TR>
            </THead>
            <tbody>
              {pagedItems.map((item, index) => (
                <tr key={item.id} className={`border-t border-slate-200 transition-colors ${index % 2 === 0 ? "bg-white/70" : "bg-slate-50/60"} hover:bg-[#eef3ff]`}>
                  <td className="px-3 py-2 text-center"><input type="checkbox" checked={selectedIds.includes(item.id)} onChange={() => toggleOne(item.id)} aria-label={`Izberi ${item.name}`} /></td>
                  <td className="px-3 py-2 font-medium text-slate-900">{item.name}</td>
                  <td className="px-3 py-2 text-slate-600">{item.sku}</td>
                  <td className="px-3 py-2 text-slate-600">{item.category}</td>
                  <td className="px-3 py-2 text-center text-slate-600">{formatCurrency(item.price)}</td>
                  <td className="px-3 py-2 text-center text-slate-600">{item.discountPct}%</td>
                  <td className="px-3 py-2 text-center text-slate-600">{formatCurrency(discountedPrice(item.price, item.discountPct))}</td>
                  <td className="px-3 py-2 text-center">
                    <Chip
                      variant={item.active ? 'success' : 'neutral'}
                      className={`min-w-0 px-2.5 text-xs ${item.active ? buttonTokenClasses.activeSuccess : buttonTokenClasses.inactiveNeutral}`}
                    >
                      {item.active ? 'Aktiven' : 'Neaktiven'}
                    </Chip>
                  </td>
                  <td className="px-3 py-2"><div className="flex items-center justify-center gap-1.5"><IconButton type="button" tone="neutral" onClick={() => openEdit(item)} title="Uredi" aria-label="Uredi"><ActionIcon type="edit" /></IconButton><IconButton type="button" tone="neutral" onClick={() => duplicate(item)} title="Podvoji" aria-label="Podvoji"><ActionIcon type="copy" /></IconButton><IconButton type="button" tone="warning" onClick={() => archive(item)} title="Arhiviraj" aria-label="Arhiviraj"><ActionIcon type="archive" /></IconButton></div></td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      </AdminTableLayout>

      {editorOpen ? (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/30">
          <div className="h-full w-full max-w-md overflow-y-auto border-l border-slate-200 bg-white p-4 shadow-xl">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-900">{editingId ? 'Uredi artikel' : 'Dodaj artikel'}</h2>
              <Button type="button" variant="ghost" size="xs" className="text-sm" onClick={() => setEditorOpen(false)}>Zapri</Button>
            </div>

            <div className="space-y-3 text-sm">
              <FloatingInput label="Naziv" value={draft.name} onChange={(value) => setDraft((prev) => ({ ...prev, name: value }))} />
              <div className="group relative" data-filled={draft.description ? 'true' : 'false'}>
                <textarea value={draft.description} onChange={(event) => setDraft((prev) => ({ ...prev, description: event.target.value }))} placeholder=" " className="min-h-[90px] w-full rounded-xl border border-slate-300 bg-white px-3 pb-2 pt-5 text-sm text-slate-900 outline-none transition focus:border-[#3e67d6] focus:ring-0 focus:ring-[#3e67d6]" />
                <label className="pointer-events-none absolute left-3 top-1.5 bg-white px-1 text-[10px] text-slate-600">Opis</label>
              </div>

              <FloatingSelect label="Kategorija" value={draft.category} onChange={(value) => setDraft((prev) => ({ ...prev, category: value }))}>
                <option value="">Izberi kategorijo</option>
                {categories.map((category) => <option key={category} value={category}>{category}</option>)}
              </FloatingSelect>

              <label className="inline-flex items-center gap-2 text-xs text-slate-700"><input type="checkbox" checked={newCategoryEnabled} onChange={(event) => setNewCategoryEnabled(event.target.checked)} />Dodaj novo kategorijo</label>
              <FloatingInput label="Nova Kategorija" value={newCategoryValue} onChange={(value) => setNewCategoryValue(value)} disabled={!newCategoryEnabled} />

              <FloatingInput label="Cena" value={draft.price} onChange={(value) => setDraft((prev) => ({ ...prev, price: Number(value) || 0 }))} type="number" step={0.01} />
              <FloatingInput label="Popust (%)" value={draft.discountPct} onChange={(value) => setDraft((prev) => ({ ...prev, discountPct: Number(value) || 0 }))} type="number" min={0} max={100} step={1} />
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-2 text-xs text-slate-700">Sedanja cena: <span className="font-semibold text-slate-900">{formatCurrency(discountedPrice(draft.price, draft.discountPct))}</span></div>

              <FloatingInput label="Enota" value={draft.unit} onChange={(value) => setDraft((prev) => ({ ...prev, unit: value }))} />
              <FloatingInput label="SKU / koda" value={draft.sku} onChange={(value) => setDraft((prev) => ({ ...prev, sku: value }))} />

              <label className="block">Slike artikla (več datotek)
                <input type="file" accept="image/*" multiple onChange={(event) => handleMultiImageUpload(event.target.files)} className="mt-1 block w-full text-xs" />
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

              <label className="inline-flex items-center gap-2"><input type="checkbox" checked={draft.active} onChange={(event) => setDraft((prev) => ({ ...prev, active: event.target.checked }))} /><span>Aktiven</span></label>
            </div>

            <div className="mt-4 flex items-center justify-end">
              <Button type="button" variant="primary" onClick={save}>Shrani</Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
