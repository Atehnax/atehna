'use client';

import { useMemo, useState } from 'react';

type ArchiveEntry = {
  id: number;
  item_type: 'order' | 'pdf';
  order_id: number | null;
  document_id: number | null;
  label: string;
  deleted_at: string;
  expires_at: string;
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
  const [entries, setEntries] = useState(initialEntries);
  const [selected, setSelected] = useState<number[]>([]);
  const [typeFilter, setTypeFilter] = useState<'all' | 'order' | 'pdf'>('all');
  const [isDeleting, setIsDeleting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const filtered = useMemo(
    () => entries.filter((entry) => (typeFilter === 'all' ? true : entry.item_type === typeFilter)),
    [entries, typeFilter]
  );

  const allSelected = filtered.length > 0 && filtered.every((entry) => selected.includes(entry.id));

  const toggleOne = (id: number) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  };

  const toggleAll = () => {
    setSelected((prev) => {
      if (allSelected) return prev.filter((id) => !filtered.some((entry) => entry.id === id));
      const merged = new Set(prev);
      filtered.forEach((entry) => merged.add(entry.id));
      return Array.from(merged);
    });
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
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold uppercase text-slate-500">Filter vrste</label>
          <select
            value={typeFilter}
            onChange={(event) => setTypeFilter(event.target.value as 'all' | 'order' | 'pdf')}
            className="h-8 rounded-lg border border-slate-300 px-2 text-xs"
          >
            <option value="all">Vse</option>
            <option value="order">Naročila</option>
            <option value="pdf">PDF datoteke</option>
          </select>
        </div>

        <button
          type="button"
          onClick={bulkDelete}
          disabled={selected.length === 0 || isDeleting}
          className="h-8 rounded-lg border border-rose-200 px-3 text-xs font-semibold text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400"
        >
          {isDeleting ? 'Brišem ...' : 'Trajno izbriši'}
        </button>
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
            {filtered.map((entry) => (
              <tr key={entry.id} className="border-b border-slate-100 hover:bg-slate-50">
                <td className="py-2 text-center">
                  <input
                    type="checkbox"
                    checked={selected.includes(entry.id)}
                    onChange={() => toggleOne(entry.id)}
                    disabled={entry.id <= 0}
                    aria-label={`Izberi zapis ${entry.label}`}
                  />
                </td>
                <td className="py-2 text-xs font-semibold text-slate-700">
                  {entry.item_type === 'order' ? 'Naročilo' : 'PDF datoteka'}
                </td>
                <td className="py-2 text-slate-800">
                  {entry.item_type === 'order' && entry.order_id ? (
                    <a href={`/admin/orders/${entry.order_id}`} className="font-medium text-brand-700 hover:text-brand-800">
                      {entry.label}
                    </a>
                  ) : (
                    <span>{entry.label}</span>
                  )}
                </td>
                <td className="py-2 text-xs text-slate-500">{formatDateTime(entry.deleted_at)}</td>
                <td className="py-2 text-xs text-slate-500">{formatDateTime(entry.expires_at)}</td>
              </tr>
            ))}
            {filtered.length === 0 ? (
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
