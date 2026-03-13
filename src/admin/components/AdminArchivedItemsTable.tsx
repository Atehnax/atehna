'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/shared/ui/button';
import { ConfirmDialog } from '@/shared/ui/confirm-dialog';
import { AdminTableLayout } from '@/shared/ui/admin-table';
import { EmptyState, Table, TBody, TD, THead, TH, TR } from '@/shared/ui/table';

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
    <AdminTableLayout
      headerRight={(
        <div className="flex items-center justify-end gap-2">
          <Button
            type="button"
            variant="restore"
            onClick={restoreSelected}
            disabled={selectedIds.length === 0}
          >
            Obnovi
          </Button>
          <Button
            type="button"
            variant="danger"
            onClick={hardDeleteSelected}
            disabled={selectedIds.length === 0}
          >
            Trajno izbriši
          </Button>
        </div>
      )}
    >
      <Table>
          <THead>
            <TR>
              <TH className="w-[40px] px-3 py-2 text-center">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={() => setSelectedIds(allSelected ? [] : archivedItems.map((item) => item.id))}
                  aria-label="Izberi vse"
                />
              </TH>
              <TH className="px-3 py-2">Naziv</TH>
              <TH className="px-3 py-2">SKU</TH>
              <TH className="px-3 py-2">Kategorija</TH>
              <TH className="px-3 py-2">Cena</TH>
              <TH className="px-3 py-2">Arhivirano</TH>
            </TR>
          </THead>
          <TBody>
            {archivedItems.length === 0 ? (
              <TR>
                <TD colSpan={6} className="px-3 py-6">
                  <EmptyState
                    title="Ni arhiviranih artiklov"
                    description="Ko arhivirate artikel, se bo prikazal tukaj."
                  />
                </TD>
              </TR>
            ) : null}

            {archivedItems.map((item) => (
              <TR key={item.id}>
                <TD className="px-3 py-2 text-center">
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(item.id)}
                    onChange={() =>
                      setSelectedIds((current) =>
                        current.includes(item.id)
                          ? current.filter((entry) => entry !== item.id)
                          : [...current, item.id]
                      )
                    }
                    aria-label={`Izberi ${item.name}`}
                  />
                </TD>
                <TD className="px-3 py-2 font-medium text-slate-900">{item.name}</TD>
                <TD className="px-3 py-2 text-slate-600">{item.sku}</TD>
                <TD className="px-3 py-2 text-slate-600">{item.category}</TD>
                <TD className="px-3 py-2 text-slate-600">
                  {formatCurrency(item.price * (1 - (item.discountPct ?? 0) / 100))}
                </TD>
                <TD className="px-3 py-2 text-slate-600">{formatDateTime(item.archivedAt)}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
    </AdminTableLayout>
  );
}
