'use client';

import { useEffect, useMemo, useState } from 'react';
import { DANGER_OUTLINE_BUTTON_CLASS } from './adminButtonStyles';
import { ConfirmDialog } from '@/shared/ui/confirm-dialog';

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
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);

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

  const restoreSelected = () => {
    if (selectedIds.length === 0) return;
    const selectedSet = new Set(selectedIds);
    const next = items.map((item) => (selectedSet.has(item.id) ? { ...item, archivedAt: null } : item));
    persist(next);
    setSelectedIds([]);
  };

  const hardDeleteSelected = () => {
    if (selectedIds.length === 0) return;
    setIsDeleteConfirmOpen(true);
  };

  const confirmHardDeleteSelected = () => {
    const selectedSet = new Set(selectedIds);
    const next = items.filter((item) => !selectedSet.has(item.id));
    persist(next);
    setSelectedIds([]);
    setIsDeleteConfirmOpen(false);
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="mb-3 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={restoreSelected}
          disabled={selectedIds.length === 0}
          className="h-8 rounded-xl border border-emerald-200 px-3 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400"
        >
          Obnovi
        </button>
        <button
          type="button"
          onClick={hardDeleteSelected}
          disabled={selectedIds.length === 0}
          className={DANGER_OUTLINE_BUTTON_CLASS}
        >
          Trajno izbriši
        </button>
      </div>

      <ConfirmDialog
        open={isDeleteConfirmOpen}
        title="Trajni izbris"
        description="Trajno izbrišem izbrane artikle?"
        confirmLabel="Izbriši"
        cancelLabel="Prekliči"
        isDanger
        onCancel={() => setIsDeleteConfirmOpen(false)}
        onConfirm={confirmHardDeleteSelected}
      />

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
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
