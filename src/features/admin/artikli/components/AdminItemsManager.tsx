'use client';

import Image from 'next/image';
import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import MuiTextField from '@/shared/ui/mui-text-field/MuiTextField';

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

const statusTabs: Array<{ key: StatusTab; label: string }> = [
  { key: 'active', label: 'Aktivni' },
  { key: 'inactive', label: 'Neaktivni' }
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
        className="h-11 w-full appearance-none rounded-xl border border-slate-300 bg-white px-3 pb-1.5 pt-5 text-sm text-slate-900 outline-none transition focus:border-[#5d3ed6] focus:ring-0 focus:ring-[#5d3ed6]"
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

  const [isCategoryMenuOpen, setIsCategoryMenuOpen] = useState(false);
  const categoryMenuRef = useRef<HTMLDivElement>(null);

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
    if (!isCategoryMenuOpen) return;

    const handleOutsideClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!categoryMenuRef.current?.contains(target)) {
        setIsCategoryMenuOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsCategoryMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isCategoryMenuOpen]);

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

  const visibleIds = useMemo(() => filteredItems.map((item) => item.id), [filteredItems]);
  const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.includes(id));

  useEffect(() => {
    setSelectedIds((current) => current.filter((id) => visibleIds.includes(id)));
  }, [visibleIds]);

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
    if (!draft.name.trim() || !draft.sku.trim() || !resolvedCategory) return;
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
  };

  const archiveSelected = () => {
    if (selectedIds.length === 0) return;
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

      <div className="overflow-hidden rounded-2xl border shadow-sm" style={{ background: "linear-gradient(180deg, rgba(250,251,252,0.96) 0%, rgba(242,244,247,0.96) 100%)", borderColor: "#e2e8f0", boxShadow: "0 10px 24px rgba(15,23,42,0.06)" }}>
        <div className="p-3">
          <div className="mt-1 grid gap-2 md:grid-cols-[minmax(280px,1fr)_240px_auto_auto] md:items-center">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Poišči po nazivu, SKU ali kategoriji …"
            className="h-8 rounded-xl border border-slate-300 px-3 text-xs focus:border-[#5d3ed6] focus:ring-0 focus:ring-[#5d3ed6]"
          />
                    <div className="relative" ref={categoryMenuRef}>
            <button
              type="button"
              onClick={() => setIsCategoryMenuOpen((previousOpen) => !previousOpen)}
              className="inline-flex h-8 w-full items-center justify-between rounded-xl border border-slate-300 bg-white px-3 text-left text-xs font-semibold text-slate-700 shadow-sm transition hover:border-slate-400 focus:border-[#5d3ed6] focus:outline-none focus:ring-0 focus-visible:border-[#5d3ed6] focus-visible:outline-none focus-visible:ring-0"
              aria-haspopup="menu"
              aria-expanded={isCategoryMenuOpen}
            >
              <span className="block min-w-0 flex-1 truncate text-left">{selectedCategoryLabel}</span>
              <span className="ml-2 text-slate-500">▾</span>
            </button>

            {isCategoryMenuOpen && (
              <div
                role="menu"
                className="absolute left-0 top-9 z-30 min-w-full w-max max-w-[560px] rounded-xl border border-slate-300 bg-white p-1 shadow-sm"
              >
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setCategoryFilter('all');
                    setIsCategoryMenuOpen(false);
                  }}
                  className={`flex h-8 w-full items-center rounded-lg px-3 text-left text-xs font-semibold leading-none transition ${
                    categoryFilter === 'all'
                      ? 'bg-[#f8f7fc] text-[#5d3ed6]'
                      : 'text-slate-700 hover:bg-[#ede8ff]'
                  }`}
                >
                  Vse kategorije
                </button>

                {categories.map((category) => (
                  <button
                    key={category}
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setCategoryFilter(category);
                      setIsCategoryMenuOpen(false);
                    }}
                    className={`flex h-8 w-full items-center rounded-lg px-3 text-left text-xs font-semibold leading-none transition ${
                      categoryFilter === category
                        ? 'bg-[#f8f7fc] text-[#5d3ed6]'
                        : 'text-slate-700 hover:bg-[#ede8ff]'
                    }`}
                    title={category}
                  >
                    <span className="block w-full text-left whitespace-nowrap">{category}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={archiveSelected}
            disabled={selectedIds.length === 0}
            className="h-8 rounded-xl border border-amber-300 bg-amber-50 px-3 text-xs font-semibold text-amber-800 transition hover:bg-amber-100 disabled:pointer-events-none disabled:opacity-45"
          >
            Arhiviraj
          </button>
          <button type="button" onClick={openCreate} className="inline-flex h-8 items-center gap-1.5 rounded-xl border border-[#ede8ff] bg-[#f8f7fc] px-3 text-xs font-semibold text-[#5d3ed6] shadow-sm transition hover:border-[#5d3ed6] hover:bg-[#f8f7fc] focus-visible:border-[#5d3ed6] focus-visible:outline-none focus-visible:ring-0">
            <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M10 4v12M4 10h12" /></svg>
            Nov artikel
          </button>
          </div>
        </div>

      <div className="flex items-center gap-2 bg-[linear-gradient(180deg,rgba(250,251,252,0.96)_0%,rgba(242,244,247,0.96)_100%)] px-3 py-2">
        <div className="inline-flex h-8 items-center gap-1 rounded-full border border-[#ede8ff] bg-white px-1">
          {statusTabs.map((tab) => {
            const isActive = statusTab === tab.key;
            const activeClass =
              tab.key === 'active'
                ? 'bg-emerald-100 text-emerald-800 ring-1 ring-emerald-400'
                : 'bg-slate-200 text-slate-700 ring-1 ring-slate-400';
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setStatusTab(tab.key)}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition ${isActive ? activeClass : 'text-slate-700 hover:bg-slate-100'}`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="overflow-x-auto" style={{ background: "linear-gradient(180deg, rgba(250,251,252,0.96) 0%, rgba(242,244,247,0.96) 100%)" }}>
          <table className="w-full min-w-[1000px] text-left text-sm">
            <thead className="text-xs text-slate-600">
              <tr>
                <th className="px-3 py-2 text-center"><input type="checkbox" checked={allSelected} onChange={toggleAll} aria-label="Izberi vse" /></th>
                <th className="px-3 py-2">
                  <button type="button" onClick={() => handleSort('name')} className="inline-flex items-center font-semibold hover:text-slate-700">Naziv <SortIndicator active={sortKey === 'name'} direction={sortDirection} /></button>
                </th>
                <th className="px-3 py-2">
                  <button type="button" onClick={() => handleSort('sku')} className="inline-flex items-center font-semibold hover:text-slate-700">SKU <SortIndicator active={sortKey === 'sku'} direction={sortDirection} /></button>
                </th>
                <th className="px-3 py-2">
                  <button type="button" onClick={() => handleSort('category')} className="inline-flex items-center font-semibold hover:text-slate-700">Kategorija <SortIndicator active={sortKey === 'category'} direction={sortDirection} /></button>
                </th>
                <th className="px-3 py-2 text-center">
                  <button type="button" onClick={() => handleSort('price')} className="inline-flex items-center font-semibold hover:text-slate-700">Cena <SortIndicator active={sortKey === 'price'} direction={sortDirection} /></button>
                </th>
                <th className="px-3 py-2 text-center"><span className="inline-flex items-center font-semibold text-slate-500">Popust</span></th>
                <th className="px-3 py-2 text-center whitespace-nowrap"><span className="inline-flex items-center font-semibold text-slate-500">Akcijska cena</span></th>
                <th className="px-3 py-2 text-center">
                  <button type="button" onClick={() => handleSort('status')} className="inline-flex items-center font-semibold hover:text-slate-700">Status <SortIndicator active={sortKey === 'status'} direction={sortDirection} /></button>
                </th>
                <th className="px-3 py-2 text-center"><span className="inline-flex items-center font-semibold text-slate-500">Uredi</span></th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((item, index) => (
                <tr key={item.id} className={`border-t border-slate-200 transition-colors ${index % 2 === 0 ? "bg-white/70" : "bg-slate-50/60"} hover:bg-[#f8f7fc]`}>
                  <td className="px-3 py-2 text-center"><input type="checkbox" checked={selectedIds.includes(item.id)} onChange={() => toggleOne(item.id)} aria-label={`Izberi ${item.name}`} /></td>
                  <td className="px-3 py-2 font-medium text-slate-900">{item.name}</td>
                  <td className="px-3 py-2 text-slate-600">{item.sku}</td>
                  <td className="px-3 py-2 text-slate-600">{item.category}</td>
                  <td className="px-3 py-2 text-center text-slate-600">{formatCurrency(item.price)}</td>
                  <td className="px-3 py-2 text-center text-slate-600">{item.discountPct}%</td>
                  <td className="px-3 py-2 text-center text-slate-600">{formatCurrency(discountedPrice(item.price, item.discountPct))}</td>
                  <td className="px-3 py-2 text-center"><span className={`inline-flex h-6 items-center rounded-full px-2.5 text-xs font-semibold ${item.active ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200' : 'bg-slate-100 text-slate-600 ring-1 ring-slate-200'}`}>{item.active ? 'Aktiven' : 'Neaktiven'}</span></td>
                  <td className="px-3 py-2"><div className="flex items-center justify-center gap-1.5"><button type="button" onClick={() => openEdit(item)} title="Uredi" aria-label="Uredi" className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-100"><ActionIcon type="edit" /></button><button type="button" onClick={() => duplicate(item)} title="Podvoji" aria-label="Podvoji" className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-100"><ActionIcon type="copy" /></button><button type="button" onClick={() => archive(item)} title="Arhiviraj" aria-label="Arhiviraj" className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-amber-300 text-amber-700 hover:bg-amber-100"><ActionIcon type="archive" /></button></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {editorOpen ? (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/30">
          <div className="h-full w-full max-w-md overflow-y-auto border-l border-slate-200 bg-white p-4 shadow-xl">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-900">{editingId ? 'Uredi artikel' : 'Dodaj artikel'}</h2>
              <button type="button" className="text-sm text-slate-500" onClick={() => setEditorOpen(false)}>Zapri</button>
            </div>

            <div className="space-y-3 text-sm">
              <MuiTextField label="Naziv" value={draft.name} onChange={(event) => setDraft((prev) => ({ ...prev, name: event.target.value }))} />
              <MuiTextField
                label="Opis"
                multiline
                minRows={4}
                value={draft.description}
                onChange={(event) => setDraft((prev) => ({ ...prev, description: event.target.value }))}
              />

              <FloatingSelect label="Kategorija" value={draft.category} onChange={(value) => setDraft((prev) => ({ ...prev, category: value }))}>
                <option value="">Izberi kategorijo</option>
                {categories.map((category) => <option key={category} value={category}>{category}</option>)}
              </FloatingSelect>

              <label className="inline-flex items-center gap-2 text-xs text-slate-700"><input type="checkbox" checked={newCategoryEnabled} onChange={(event) => setNewCategoryEnabled(event.target.checked)} />Dodaj novo kategorijo</label>
              <MuiTextField label="Nova Kategorija" value={newCategoryValue} onChange={(event) => setNewCategoryValue(event.target.value)} disabled={!newCategoryEnabled} />

              <MuiTextField label="Cena" value={draft.price} onChange={(event) => setDraft((prev) => ({ ...prev, price: Number(event.target.value) || 0 }))} type="number" inputProps={{ step: 0.01 }} />
              <MuiTextField label="Popust (%)" value={draft.discountPct} onChange={(event) => setDraft((prev) => ({ ...prev, discountPct: Number(event.target.value) || 0 }))} type="number" inputProps={{ min: 0, max: 100, step: 1 }} />
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-2 text-xs text-slate-700">Sedanja cena: <span className="font-semibold text-slate-900">{formatCurrency(discountedPrice(draft.price, draft.discountPct))}</span></div>

              <MuiTextField label="Enota" value={draft.unit} onChange={(event) => setDraft((prev) => ({ ...prev, unit: event.target.value }))} />
              <MuiTextField label="SKU / koda" value={draft.sku} onChange={(event) => setDraft((prev) => ({ ...prev, sku: event.target.value }))} />

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
              <button type="button" onClick={save} className="rounded-lg border border-brand-600 bg-brand-600 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-700">Shrani</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
