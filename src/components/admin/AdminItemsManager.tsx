'use client';

import Image from 'next/image';
import { useEffect, useMemo, useState } from 'react';

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
};

type SortKey = 'name' | 'category' | 'price' | 'updatedAt';

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
  updatedAt: nowIso()
});

const discountedPrice = (price: number, discountPct: number) =>
  Number((price * (1 - Math.max(0, Math.min(100, discountPct)) / 100)).toFixed(2));

export default function AdminItemsManager({ seedItems }: { seedItems: Item[] }) {
  const [items, setItems] = useState<Item[]>(seedItems);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'archived'>('all');
  const [sortKey, setSortKey] = useState<SortKey>('updatedAt');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Item>(emptyItem());
  const [newCategoryEnabled, setNewCategoryEnabled] = useState(false);
  const [newCategoryValue, setNewCategoryValue] = useState('');

  useEffect(() => {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as Item[];
      if (Array.isArray(parsed)) setItems(parsed);
    } catch {
      // ignore malformed local state
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  const categories = useMemo(
    () => Array.from(new Set(items.map((item) => item.category).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'sl')),
    [items]
  );

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    const next = items.filter((item) => {
      const matchesSearch =
        !q ||
        item.name.toLowerCase().includes(q) ||
        item.sku.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q);
      const matchesCategory = categoryFilter === 'all' || item.category === categoryFilter;
      const matchesStatus = statusFilter === 'all' || (statusFilter === 'active' ? item.active : !item.active);
      return matchesSearch && matchesCategory && matchesStatus;
    });

    next.sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'price') cmp = discountedPrice(a.price, a.discountPct) - discountedPrice(b.price, b.discountPct);
      else if (sortKey === 'updatedAt') cmp = a.updatedAt.localeCompare(b.updatedAt);
      else cmp = a[sortKey].localeCompare(b[sortKey], 'sl', { sensitivity: 'base' });
      return sortDirection === 'asc' ? cmp : -cmp;
    });

    return next;
  }, [categoryFilter, items, search, sortDirection, sortKey, statusFilter]);

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
      updatedAt: nowIso()
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
      updatedAt: nowIso()
    };
    setItems((prev) => [copy, ...prev]);
  };

  const archive = (item: Item) => {
    setItems((prev) => prev.map((entry) => (entry.id === item.id ? { ...entry, active: false, updatedAt: nowIso() } : entry)));
  };

  const remove = (item: Item) => {
    if (!window.confirm(`Izbrišem artikel "${item.name}"?`)) return;
    setItems((prev) => prev.filter((entry) => entry.id !== item.id));
    if (editingId === item.id) setEditorOpen(false);
  };

  const handleMultiImageUpload = (files: FileList | null) => {
    if (!files) return;
    const urls = Array.from(files).map((file) => URL.createObjectURL(file));
    setDraft((prev) => ({ ...prev, images: [...prev.images, ...urls] }));
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Artikli</h1>
          <p className="mt-1 text-sm text-slate-600">Iskanje, filtriranje, urejanje in hiter dodatek artiklov.</p>
        </div>
        <button type="button" onClick={openCreate} className="rounded-lg border border-brand-600 bg-brand-600 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-700">
          Dodaj artikel
        </button>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-3">
        <label className="text-xs font-semibold uppercase text-slate-500">Hitro iskanje / dodajanje</label>
        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Poišči po nazivu, SKU ali kategoriji …" className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm" />
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-3">
        <div className="grid gap-2 md:grid-cols-4">
          <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} className="h-10 rounded-lg border border-slate-300 px-2 text-sm">
            <option value="all">Vse kategorije</option>
            {categories.map((category) => <option key={category} value={category}>{category}</option>)}
          </select>
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as 'all' | 'active' | 'archived')} className="h-10 rounded-lg border border-slate-300 px-2 text-sm">
            <option value="all">Vsi statusi</option>
            <option value="active">Aktivni</option>
            <option value="archived">Arhivirani</option>
          </select>
          <select value={sortKey} onChange={(event) => setSortKey(event.target.value as SortKey)} className="h-10 rounded-lg border border-slate-300 px-2 text-sm">
            <option value="name">Naziv</option>
            <option value="category">Kategorija</option>
            <option value="price">Cena</option>
            <option value="updatedAt">Posodobljeno</option>
          </select>
          <button type="button" className="h-10 rounded-lg border border-slate-300 px-3 text-sm" onClick={() => setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'))}>{sortDirection === 'asc' ? 'Naraščajoče' : 'Padajoče'}</button>
        </div>

        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-3 py-2">Naziv</th><th className="px-3 py-2">SKU</th><th className="px-3 py-2">Kategorija</th><th className="px-3 py-2">Cena</th><th className="px-3 py-2">Popust</th><th className="px-3 py-2">Trenutna cena</th><th className="px-3 py-2">Status</th><th className="px-3 py-2 text-right">Akcije</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((item) => (
                <tr key={item.id} className="border-t border-slate-200">
                  <td className="px-3 py-2 font-medium text-slate-900">{item.name}</td>
                  <td className="px-3 py-2 text-slate-600">{item.sku}</td>
                  <td className="px-3 py-2 text-slate-600">{item.category}</td>
                  <td className="px-3 py-2 text-slate-600">{formatCurrency(item.price)}</td>
                  <td className="px-3 py-2 text-slate-600">{item.discountPct}%</td>
                  <td className="px-3 py-2 font-semibold text-slate-900">{formatCurrency(discountedPrice(item.price, item.discountPct))}</td>
                  <td className="px-3 py-2"><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${item.active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{item.active ? 'Aktiven' : 'Arhiviran'}</span></td>
                  <td className="px-3 py-2"><div className="flex items-center justify-end gap-2"><button type="button" onClick={() => openEdit(item)} className="rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50">Uredi</button><button type="button" onClick={() => duplicate(item)} className="rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50">Podvoji</button><button type="button" onClick={() => archive(item)} className="rounded-md border border-amber-200 px-2 py-1 text-xs text-amber-700 hover:bg-amber-50">Arhiviraj</button><button type="button" onClick={() => remove(item)} className="rounded-md border border-rose-200 px-2 py-1 text-xs text-rose-700 hover:bg-rose-50">Izbriši</button></div></td>
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
              <label className="block">Naziv<input value={draft.name} onChange={(event) => setDraft((prev) => ({ ...prev, name: event.target.value }))} className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3" /></label>
              <label className="block">Opis<textarea value={draft.description} onChange={(event) => setDraft((prev) => ({ ...prev, description: event.target.value }))} className="mt-1 min-h-[90px] w-full rounded-lg border border-slate-300 px-3 py-2" /></label>

              <label className="block">Kategorija
                <select value={draft.category} onChange={(event) => setDraft((prev) => ({ ...prev, category: event.target.value }))} className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3">
                  <option value="">Izberi kategorijo</option>
                  {categories.map((category) => <option key={category} value={category}>{category}</option>)}
                </select>
              </label>
              <label className="inline-flex items-center gap-2 text-xs text-slate-700"><input type="checkbox" checked={newCategoryEnabled} onChange={(event) => setNewCategoryEnabled(event.target.checked)} />Dodaj novo kategorijo</label>
              <label className="block">Nova kategorija
                <input value={newCategoryValue} onChange={(event) => setNewCategoryValue(event.target.value)} disabled={!newCategoryEnabled} className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3 disabled:bg-slate-100 disabled:text-slate-400" placeholder="Vnesi novo kategorijo" />
              </label>

              <label className="block">Cena<input type="number" step="0.01" value={draft.price} onChange={(event) => setDraft((prev) => ({ ...prev, price: Number(event.target.value) }))} className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3" /></label>
              <label className="block">Popust (%)<input type="number" min={0} max={100} step="1" value={draft.discountPct} onChange={(event) => setDraft((prev) => ({ ...prev, discountPct: Number(event.target.value) }))} className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3" /></label>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-2 text-xs text-slate-700">Trenutna cena po popustu: <span className="font-semibold text-slate-900">{formatCurrency(discountedPrice(draft.price, draft.discountPct))}</span></div>

              <label className="block">Enota<input value={draft.unit} onChange={(event) => setDraft((prev) => ({ ...prev, unit: event.target.value }))} className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3" /></label>
              <label className="block">SKU / koda<input value={draft.sku} onChange={(event) => setDraft((prev) => ({ ...prev, sku: event.target.value }))} className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3" /></label>

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

            <div className="mt-4 flex items-center justify-between">
              {editingId ? <button type="button" onClick={() => remove(draft)} className="rounded-lg border border-rose-200 px-3 py-2 text-sm text-rose-700">Izbriši</button> : <span />}
              <button type="button" onClick={save} className="rounded-lg border border-brand-600 bg-brand-600 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-700">Shrani</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
