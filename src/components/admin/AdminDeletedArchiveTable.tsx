'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

type ArchiveEntry = {
  id: number;
  item_type: 'order' | 'pdf';
  order_id: number | null;
  document_id: number | null;
  label: string;
  deleted_at: string;
  expires_at: string;
};

type DisplayRow = {
  entry: ArchiveEntry;
  isChild: boolean;
  parentOrderId: number | null;
};

const formatDateTime = (value: string) =>
  new Date(value).toLocaleString('sl-SI', {
    dateStyle: 'medium',
    timeStyle: 'short'
  });

export default function AdminDeletedArchiveTable({
  initialEntries
}: {
  initialEntries: ArchiveEntry[];
}) {
  const router = useRouter();
  const [entries, setEntries] = useState(initialEntries);
  const [selected, setSelected] = useState<number[]>([]);
  const [typeFilter, setTypeFilter] = useState<'all' | 'order' | 'pdf'>('all');
  const [isDeleting, setIsDeleting] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const filtered = useMemo(
    () => entries.filter((entry) => (typeFilter === 'all' ? true : entry.item_type === typeFilter)),
    [entries, typeFilter]
  );

  const displayRows = useMemo<DisplayRow[]>(() => {
    if (typeFilter === 'pdf') {
      return filtered
        .filter((entry) => entry.item_type === 'pdf')
        .map((entry) => ({ entry, isChild: false, parentOrderId: null }));
    }

    const rows: DisplayRow[] = [];
    const orderRows = filtered.filter((entry) => entry.item_type === 'order');
    const deletedOrderIds = new Set(
      orderRows.map((entry) => entry.order_id).filter((orderId): orderId is number => typeof orderId === 'number')
    );

    const pdfByOrder = new Map<number, ArchiveEntry[]>();
    filtered
      .filter((entry) => entry.item_type === 'pdf' && typeof entry.order_id === 'number' && deletedOrderIds.has(entry.order_id))
      .forEach((entry) => {
        const orderId = entry.order_id as number;
        const list = pdfByOrder.get(orderId) ?? [];
        list.push(entry);
        pdfByOrder.set(orderId, list);
      });

    orderRows.forEach((entry) => {
      rows.push({ entry, isChild: false, parentOrderId: null });
      if (typeFilter !== 'all') return;

      const children = pdfByOrder.get(entry.order_id ?? -1) ?? [];
      children
        .sort((left, right) => new Date(right.deleted_at).getTime() - new Date(left.deleted_at).getTime())
        .forEach((child) => rows.push({ entry: child, isChild: true, parentOrderId: entry.order_id ?? null }));
    });

    if (typeFilter === 'all') {
      filtered
        .filter(
          (entry) =>
            entry.item_type === 'pdf' &&
            (!entry.order_id || !deletedOrderIds.has(entry.order_id))
        )
        .forEach((entry) => rows.push({ entry, isChild: false, parentOrderId: null }));
    }

    return rows;
  }, [filtered, typeFilter]);

  const visibleIds = useMemo(() => displayRows.map((row) => row.entry.id), [displayRows]);
  const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selected.includes(id));


  const groupedChildIdsByOrder = useMemo(() => {
    const map = new Map<number, number[]>();
    displayRows.forEach((row) => {
      if (!row.isChild || row.parentOrderId === null) return;
      const list = map.get(row.parentOrderId) ?? [];
      list.push(row.entry.id);
      map.set(row.parentOrderId, list);
    });
    return map;
  }, [displayRows]);

  const parentRowIdByOrder = useMemo(() => {
    const map = new Map<number, number>();
    displayRows.forEach((row) => {
      if (row.isChild) return;
      if (row.entry.item_type !== 'order' || row.entry.order_id === null) return;
      map.set(row.entry.order_id, row.entry.id);
    });
    return map;
  }, [displayRows]);

  const selectedEntriesFromRows = useMemo(
    () =>
      displayRows
        .map((row) => row.entry)
        .filter(
          (entry, index, array) =>
            selected.includes(entry.id) && array.findIndex((candidate) => candidate.id === entry.id) === index
        ),
    [displayRows, selected]
  );

  const toggleOne = (row: DisplayRow) => {
    const { entry, isChild, parentOrderId } = row;

    if (isChild && parentOrderId !== null) {
      const parentRowId = parentRowIdByOrder.get(parentOrderId);
      if (!parentRowId || !selected.includes(parentRowId)) return;
    }

    setSelected((prev) => {
      if (isChild && parentOrderId !== null) {
        return prev.includes(entry.id) ? prev.filter((item) => item !== entry.id) : [...prev, entry.id];
      }

      const next = new Set(prev);
      const isCurrentlySelected = next.has(entry.id);
      const childIds = entry.item_type === 'order' && entry.order_id !== null ? groupedChildIdsByOrder.get(entry.order_id) ?? [] : [];

      if (isCurrentlySelected) {
        next.delete(entry.id);
        childIds.forEach((childId) => next.delete(childId));
      } else {
        next.add(entry.id);
        childIds.forEach((childId) => next.add(childId));
      }

      return Array.from(next);
    });
  };

  const toggleAll = () => {
    setSelected((prev) => {
      if (allSelected) return prev.filter((id) => !visibleIds.includes(id));

      const merged = new Set(prev);
      displayRows.forEach((row) => {
        merged.add(row.entry.id);
        if (!row.isChild && row.entry.item_type === 'order' && row.entry.order_id !== null) {
          const childIds = groupedChildIdsByOrder.get(row.entry.order_id) ?? [];
          childIds.forEach((childId) => merged.add(childId));
        }
      });

      return Array.from(merged);
    });
  };

  const bulkRestore = async () => {
    const selectedEntries = selectedEntriesFromRows;
    const restorableIds = selectedEntries.filter((entry) => entry.id > 0).map((entry) => entry.id);
    const targets = selectedEntries
      .filter((entry) => entry.id <= 0)
      .map((entry) => ({
        item_type: entry.item_type,
        order_id: entry.order_id,
        document_id: entry.document_id
      }));

    if (restorableIds.length === 0 && targets.length === 0) {
      setMessage('Ni izbranih zapisov za obnovo.');
      return;
    }

    setIsRestoring(true);
    setMessage(null);
    try {
      const response = await fetch('/api/admin/archive', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: restorableIds, targets })
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        setMessage(body.message || 'Obnova ni uspela.');
        return;
      }

      setEntries((prev) => prev.filter((entry) => !selected.includes(entry.id)));
      setSelected([]);
      setMessage('Izbrani zapisi so obnovljeni.');
      router.refresh();
    } finally {
      setIsRestoring(false);
    }
  };

  const bulkDelete = async () => {
    const deletableIds = selected.filter((id) => id > 0);
    if (deletableIds.length === 0) {
      setMessage('Izbrani zapisi nimajo arhivske postavke za trajni izbris.');
      return;
    }
    if (!window.confirm('Ali ste prepričani, da želite trajno izbrisati izbrane zapise?')) return;

    setIsDeleting(true);
    setMessage(null);
    try {
      const response = await fetch('/api/admin/archive', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: deletableIds })
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        setMessage(body.message || 'Trajni izbris ni uspel.');
        return;
      }

      setEntries((prev) => prev.filter((entry) => !deletableIds.includes(entry.id)));
      setSelected([]);
      setMessage('Izbrani zapisi so trajno izbrisani.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-[112px]">
          <select
            value={typeFilter}
            onChange={(event) => setTypeFilter(event.target.value as 'all' | 'order' | 'pdf')}
            className="h-8 w-full rounded-xl border border-slate-300 bg-white px-3 text-xs focus:border-[#6244d8] focus:ring-1 focus:ring-[#6244d8]"
          >
            <option value="all">Vse vrste</option>
            <option value="order">Naročila</option>
            <option value="pdf">PDF datoteke</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={bulkRestore}
            disabled={selected.length === 0 || isRestoring || isDeleting}
            className="h-8 rounded-lg border border-emerald-200 bg-[#f8f7fc] px-3 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400"
          >
            {isRestoring ? 'Obnavljam ...' : 'Obnovi'}
          </button>
          <button
            type="button"
            onClick={bulkDelete}
            disabled={selected.length === 0 || isDeleting || isRestoring}
            className="h-8 rounded-lg border border-rose-200 bg-[#f8f7fc] px-3 text-xs font-semibold text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400"
          >
            {isDeleting ? 'Brišem ...' : 'Trajno izbriši'}
          </button>
        </div>
      </div>

      {message ? <p className="mb-2 text-xs text-slate-600">{message}</p> : null}

      <div className="overflow-x-auto">
        <table className="w-full table-fixed border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-xs uppercase text-slate-500">
              <th className="w-10 py-2 text-center">
                <input type="checkbox" checked={allSelected} onChange={toggleAll} aria-label="Izberi vse" />
              </th>
              <th className="w-28 py-2 text-left">Vrsta</th>
              <th className="py-2 text-left">Element</th>
              <th className="w-44 py-2 text-left">Izbrisano</th>
              <th className="w-44 py-2 text-left">Poteče</th>
            </tr>
          </thead>
          <tbody>
            {displayRows.map((row) => {
              const { entry, isChild, parentOrderId } = row;
              const parentSelected =
                !isChild || parentOrderId === null
                  ? true
                  : (() => {
                      const parentRowId = parentRowIdByOrder.get(parentOrderId);
                      return parentRowId ? selected.includes(parentRowId) : false;
                    })();

              return (
                <tr key={entry.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="py-2 text-center">
                    <input
                      type="checkbox"
                      className="disabled:cursor-not-allowed disabled:opacity-50"
                      checked={selected.includes(entry.id)}
                      onChange={() => toggleOne(row)}
                      disabled={isChild && !parentSelected}
                      aria-label={`Izberi zapis ${entry.label}`}
                    />
                  </td>
                  <td className="py-2 text-xs font-semibold text-slate-700">
                    {entry.item_type === 'order' ? 'Naročilo' : 'PDF datoteka'}
                  </td>
                  <td className={`py-2 text-slate-800 ${isChild ? 'pl-6' : ''}`}>
                    {entry.item_type === 'order' && entry.order_id ? (
                      <a href={`/admin/orders/${entry.order_id}`} className="font-medium text-brand-700 hover:text-brand-800">
                        {entry.label}
                      </a>
                    ) : (
                      <span>{isChild ? `↳ ${entry.label}` : entry.label}</span>
                    )}
                  </td>
                  <td className="py-2 text-xs text-slate-500">{formatDateTime(entry.deleted_at)}</td>
                  <td className="py-2 text-xs text-slate-500">{formatDateTime(entry.expires_at)}</td>
                </tr>
              );
            })}
            {displayRows.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-8 text-center text-sm text-slate-500">
                  Arhiv je prazen.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
