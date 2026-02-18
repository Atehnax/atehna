'use client';

import { useEffect, useMemo, useState } from 'react';

type Item = {
  id: string;
  name: string;
  description: string;
  category: string;
  price: number;
  unit: string;
  sku: string;
  active: boolean;
  image?: string;
  updatedAt: string;
};

type SortKey = 'name' | 'category' | 'price' | 'updatedAt';

const STORAGE_KEY = 'admin-items-crud-v1';

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('sl-SI', { style: 'currency', currency: 'EUR' }).format(value);

const nowIso = () => new Date().toISOString();

const emptyItem = (): Item => ({
  id: crypto.randomUUID(),
  name: '',
  description: '',
  category: '',
  price: 0,
  unit: 'kos',
  sku: '',
  active: true,
  image: '',
  updatedAt: nowIso()
});

export default function AdminItemsManager({ seedItems }: { seedItems: Item[] }) {
  const [items, setItems] = useState<Item[]>(seedItems);
  const [search, setSearch] = useState('');
  const [quickSearch, setQuickSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'archived'>('all');
  const [sortKey, setSortKey] = useState<SortKey>('updatedAt');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Item>(emptyItem());

  useEffect(() => {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as Item[];
      if (Array.isArray(parsed)) setItems(parsed);
    } catch {
      // ignore invalid local state
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  const categories = useMemo(
    () => ['all', ...Array.from(new Set(items.map((item) => item.category).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'sl'))],
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
      const matchesStatus =
        statusFilter === 'all' || (statusFilter === 'active' ? item.active : !item.active);
      return matchesSearch && matchesCategory && matchesStatus;
    });

    next.sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'price') cmp = a.price - b.price;
      else if (sortKey === 'updatedAt') cmp = a.updatedAt.localeCompare(b.updatedAt);
      else cmp = a[sortKey].localeCompare(b[sortKey], 'sl', { sensitivity: 'base' });
      return sortDirection === 'asc' ? cmp : -cmp;
    });

    return next;
  }, [categoryFilter, items, search, sortDirection, sortKey, statusFilter]);

  const quickMatches = useMemo(() => {
    const q = quickSearch.trim().toLowerCase();
    if (!q) return [];
    return items.filter((item) => item.name.toLowerCase().includes(q) || item.sku.toLowerCase().includes(q)).slice(0, 8);
  }, [items, quickSearch]);

  const openCreate = () => {
    setEditingId(null);
    setDraft(emptyItem());
    setEditorOpen(true);
  };

  const openEdit = (item: Item) => {
    setEditingId(item.id);
    setDraft(item);
    setEditorOpen(true);
  };

  const save = () => {
    if (!draft.name.trim() || !draft.sku.trim() || !draft.category.trim()) return;
    const next = { ...draft, updatedAt: nowIso() };
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
        <label className="text-xs font-semibold uppercase text-slate-500">Hitri dodatek / iskanje</label>
        <input
          value={quickSearch}
          onChange={(event) => setQuickSearch(event.target.value)}
          placeholder="Poišči po nazivu ali SKU …"
          className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm"
        />
        {quickSearch.trim() ? (
          <div className="mt-2 space-y-1">
            {quickMatches.length > 0 ? (
              quickMatches.map((item) => (
                <button key={item.id} type="button" onClick={() => openEdit(item)} className="flex w-full items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-left text-sm hover:bg-slate-50">
                  <span className="truncate">{item.name}</span>
                  <span className="text-xs text-slate-500">{item.sku}</span>
                </button>
              ))
            ) : (
              <button type="button" onClick={() => { openCreate(); setDraft((prev) => ({ ...prev, name: quickSearch })); }} className="w-full rounded-lg border border-brand-200 bg-brand-50 px-3 py-2 text-left text-sm text-brand-700 hover:bg-brand-100">
                Ni zadetkov — ustvari nov artikel »{quickSearch}«
              </button>
            )}
          </div>
        ) : null}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-3">
        <div className="grid gap-2 md:grid-cols-5">
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Išči: naziv, SKU, kategorija" className="h-10 rounded-lg border border-slate-300 px-3 text-sm md:col-span-2" />
          <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} className="h-10 rounded-lg border border-slate-300 px-2 text-sm">
            {categories.map((category) => <option key={category} value={category}>{category === 'all' ? 'Vse kategorije' : category}</option>)}
          </select>
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as 'all' | 'active' | 'archived')} className="h-10 rounded-lg border border-slate-300 px-2 text-sm">
            <option value="all">Vsi statusi</option>
            <option value="active">Aktivni</option>
            <option value="archived">Arhivirani</option>
          </select>
          <div className="flex gap-2">
            <select value={sortKey} onChange={(event) => setSortKey(event.target.value as SortKey)} className="h-10 flex-1 rounded-lg border border-slate-300 px-2 text-sm">
              <option value="name">Naziv</option>
              <option value="category">Kategorija</option>
              <option value="price">Cena</option>
              <option value="updatedAt">Posodobljeno</option>
            </select>
            <button type="button" className="h-10 rounded-lg border border-slate-300 px-3 text-sm" onClick={() => setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'))}>{sortDirection === 'asc' ? '↑' : '↓'}</button>
          </div>
        </div>

        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-3 py-2">Naziv</th>
                <th className="px-3 py-2">SKU</th>
                <th className="px-3 py-2">Kategorija</th>
                <th className="px-3 py-2">Cena</th>
                <th className="px-3 py-2">Enota</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2 text-right">Akcije</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((item) => (
                <tr key={item.id} className="border-t border-slate-200">
                  <td className="px-3 py-2 font-medium text-slate-900">{item.name}</td>
                  <td className="px-3 py-2 text-slate-600">{item.sku}</td>
                  <td className="px-3 py-2 text-slate-600">{item.category}</td>
                  <td className="px-3 py-2 text-slate-600">{formatCurrency(item.price)}</td>
                  <td className="px-3 py-2 text-slate-600">{item.unit}</td>
                  <td className="px-3 py-2"><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${item.active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{item.active ? 'Aktiven' : 'Arhiviran'}</span></td>
                  <td className="px-3 py-2">
                    <div className="flex items-center justify-end gap-2">
                      <button type="button" onClick={() => openEdit(item)} className="rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50">Uredi</button>
                      <button type="button" onClick={() => duplicate(item)} className="rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50">Podvoji</button>
                      <button type="button" onClick={() => archive(item)} className="rounded-md border border-amber-200 px-2 py-1 text-xs text-amber-700 hover:bg-amber-50">Arhiviraj</button>
                      <button type="button" onClick={() => remove(item)} className="rounded-md border border-rose-200 px-2 py-1 text-xs text-rose-700 hover:bg-rose-50">Izbriši</button>
                    </div>
                  </td>
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
              <label className="block">Kategorija<input value={draft.category} onChange={(event) => setDraft((prev) => ({ ...prev, category: event.target.value }))} className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3" /></label>
              <label className="block">Cena<input type="number" step="0.01" value={draft.price} onChange={(event) => setDraft((prev) => ({ ...prev, price: Number(event.target.value) }))} className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3" /></label>
              <label className="block">Enota<input value={draft.unit} onChange={(event) => setDraft((prev) => ({ ...prev, unit: event.target.value }))} className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3" /></label>
              <label className="block">SKU / koda<input value={draft.sku} onChange={(event) => setDraft((prev) => ({ ...prev, sku: event.target.value }))} className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3" /></label>
              <label className="block">Slika (URL, opcijsko)<input value={draft.image ?? ''} onChange={(event) => setDraft((prev) => ({ ...prev, image: event.target.value }))} className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3" /></label>
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
