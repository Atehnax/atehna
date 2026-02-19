'use client';

import Image from 'next/image';
import { type ReactNode, useEffect, useMemo, useState } from 'react';

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
        className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 pb-1.5 pt-5 text-sm text-slate-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100 disabled:bg-slate-100 disabled:text-slate-400"
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
        className="h-11 w-full appearance-none rounded-xl border border-slate-300 bg-white px-3 pb-1.5 pt-5 text-sm text-slate-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
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

      <div className="rounded-xl border border-slate-200 bg-white p-3">
        <div className="flex flex-wrap items-center gap-2">
          {statusTabs.map((tab) => {
            const active = statusTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setStatusTab(tab.key)}
                className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${active ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-slate-300 text-slate-600 hover:bg-slate-50'}`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="mt-3 grid gap-2 md:grid-cols-[minmax(280px,1fr)_220px_220px_auto_auto] md:items-center">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Poišči po nazivu, SKU ali kategoriji …"
            className="h-10 rounded-xl border border-slate-300 px-3 text-xs"
          />
          <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} className="h-10 rounded-xl border border-slate-300 px-3 text-xs">
            <option value="all">Vse kategorije</option>
            {categories.map((category) => (
              <option key={category} value={category}>{category}</option>
            ))}
          </select>
          <select value={statusTab} onChange={(event) => setStatusTab(event.target.value as StatusTab)} className="h-10 rounded-xl border border-slate-300 px-3 text-xs">
            <option value="active">Aktivni</option>
            <option value="inactive">Neaktivni</option>
          </select>
          <button
            type="button"
            onClick={archiveSelected}
            disabled={selectedIds.length === 0}
            className="h-10 rounded-xl border border-amber-300 px-3 text-xs font-semibold text-amber-700 transition hover:bg-amber-50 disabled:pointer-events-none disabled:opacity-45"
          >
            Arhiviraj
          </button>
          <button type="button" onClick={openCreate} className="h-10 rounded-xl border border-brand-600 bg-brand-600 px-3 text-sm font-semibold text-white hover:bg-brand-700">
            + Dodaj artikel
          </button>
        </div>

        <div className="mt-3 flex items-center justify-end">
          <p className="text-xs text-slate-500">Izbranih: {selectedIds.length}</p>
        </div>

        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[1000px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
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
                <th className="px-3 py-2 text-center">Popust</th>
                <th className="px-3 py-2 text-center">Sedanja cena</th>
                <th className="px-3 py-2 text-center">
                  <button type="button" onClick={() => handleSort('status')} className="inline-flex items-center font-semibold hover:text-slate-700">Status <SortIndicator active={sortKey === 'status'} direction={sortDirection} /></button>
                </th>
                <th className="px-3 py-2 text-left">Uredi</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((item) => (
                <tr key={item.id} className="border-t border-slate-200">
                  <td className="px-3 py-2 text-center"><input type="checkbox" checked={selectedIds.includes(item.id)} onChange={() => toggleOne(item.id)} aria-label={`Izberi ${item.name}`} /></td>
                  <td className="px-3 py-2 font-medium text-slate-900">{item.name}</td>
                  <td className="px-3 py-2 text-slate-600">{item.sku}</td>
                  <td className="px-3 py-2 text-slate-600">{item.category}</td>
                  <td className="px-3 py-2 text-center text-slate-600">{formatCurrency(item.price)}</td>
                  <td className="px-3 py-2 text-center text-slate-600">{item.discountPct}%</td>
                  <td className="px-3 py-2 text-center font-semibold text-slate-900">{formatCurrency(discountedPrice(item.price, item.discountPct))}</td>
                  <td className="px-3 py-2 text-center"><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${item.active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{item.active ? 'Aktiven' : 'Neaktiven'}</span></td>
                  <td className="px-3 py-2"><div className="flex items-center gap-2"><button type="button" onClick={() => openEdit(item)} className="rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50">Uredi</button><button type="button" onClick={() => duplicate(item)} className="rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50">Podvoji</button><button type="button" onClick={() => archive(item)} className="rounded-md border border-amber-200 px-2 py-1 text-xs text-amber-700 hover:bg-amber-50">Arhiviraj</button></div></td>
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
              <FloatingInput label="Naziv" value={draft.name} onChange={(value) => setDraft((prev) => ({ ...prev, name: value }))} />
              <div className="group relative" data-filled={draft.description ? 'true' : 'false'}>
                <textarea value={draft.description} onChange={(event) => setDraft((prev) => ({ ...prev, description: event.target.value }))} placeholder=" " className="min-h-[90px] w-full rounded-xl border border-slate-300 bg-white px-3 pb-2 pt-5 text-sm text-slate-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100" />
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
              <button type="button" onClick={save} className="rounded-lg border border-brand-600 bg-brand-600 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-700">Shrani</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
