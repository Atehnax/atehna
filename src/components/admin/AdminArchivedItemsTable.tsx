'use client';

import { useEffect, useMemo, useState } from 'react';

const STORAGE_KEY = 'admin-items-crud-v2';

type Item = {
  id: string;
  name: string;
  category: string;
  sku: string;
  price: number;
  discountPct: number;
  active: boolean;
  archivedAt?: string | null;
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('sl-SI', { style: 'currency', currency: 'EUR' }).format(value);

const formatDateTime = (value?: string | null) => {
  if (!value) return '—';
  return new Date(value).toLocaleString('sl-SI', { dateStyle: 'medium', timeStyle: 'short' });
};

export default function AdminArchivedItemsTable() {
  const [items, setItems] = useState<Item[]>([]);
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
      // ignore malformed state
    }
  }, []);

  const archivedItems = useMemo(
    () => items.filter((item) => item.archivedAt).sort((a, b) => (b.archivedAt ?? '').localeCompare(a.archivedAt ?? '')),
    [items]
  );

  const allSelected = archivedItems.length > 0 && archivedItems.every((item) => selectedIds.includes(item.id));

  const persist = (next: Item[]) => {
    setItems(next);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  };

  const restore = (id: string) => {
    const next = items.map((item) => (item.id === id ? { ...item, archivedAt: null } : item));
    persist(next);
    setSelectedIds((current) => current.filter((entry) => entry !== id));
  };

  const hardDelete = (id: string) => {
    if (!window.confirm('Trajno izbrišem artikel?')) return;
    const next = items.filter((item) => item.id !== id);
    persist(next);
    setSelectedIds((current) => current.filter((entry) => entry !== id));
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[860px] text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-3 py-2 text-center"><input type="checkbox" checked={allSelected} onChange={() => setSelectedIds(allSelected ? [] : archivedItems.map((item) => item.id))} aria-label="Izberi vse" /></th>
              <th className="px-3 py-2">Naziv</th>
              <th className="px-3 py-2">SKU</th>
              <th className="px-3 py-2">Kategorija</th>
              <th className="px-3 py-2">Cena</th>
              <th className="px-3 py-2">Arhivirano</th>
              <th className="px-3 py-2">Akcije</th>
            </tr>
          </thead>
          <tbody>
            {archivedItems.map((item) => (
              <tr key={item.id} className="border-t border-slate-200">
                <td className="px-3 py-2 text-center"><input type="checkbox" checked={selectedIds.includes(item.id)} onChange={() => setSelectedIds((current) => current.includes(item.id) ? current.filter((entry) => entry !== item.id) : [...current, item.id])} aria-label={`Izberi ${item.name}`} /></td>
                <td className="px-3 py-2 font-medium text-slate-900">{item.name}</td>
                <td className="px-3 py-2 text-slate-600">{item.sku}</td>
                <td className="px-3 py-2 text-slate-600">{item.category}</td>
                <td className="px-3 py-2 text-slate-600">{formatCurrency(item.price * (1 - (item.discountPct ?? 0) / 100))}</td>
                <td className="px-3 py-2 text-slate-600">{formatDateTime(item.archivedAt)}</td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => restore(item.id)} className="rounded-md border border-emerald-200 px-2 py-1 text-xs text-emerald-700 hover:bg-emerald-50">Obnovi</button>
                    <button type="button" onClick={() => hardDelete(item.id)} className="rounded-md border border-rose-200 px-2 py-1 text-xs text-rose-700 hover:bg-rose-50">Trajno izbriši</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
