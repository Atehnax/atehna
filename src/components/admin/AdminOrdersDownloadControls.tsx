'use client';

import { useState } from 'react';

type Option = {
  value: string;
  label: string;
};

type DownloadItem = {
  orderNumber: string;
  type: string;
  filename: string;
  url: string;
  createdAt: string;
};

const TYPE_OPTIONS: Option[] = [
  { value: 'all', label: 'Vse vrste' },
  { value: 'order_summary', label: 'Povzetek naročila' },
  { value: 'predracun', label: 'Predračun' },
  { value: 'dobavnica', label: 'Dobavnica' },
  { value: 'invoice', label: 'Račun' },
  { value: 'purchase_order', label: 'Naročilnica' }
];

const typeLabelMap = new Map(TYPE_OPTIONS.map((option) => [option.value, option.label]));

export default function AdminOrdersDownloadControls() {
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [type, setType] = useState('all');
  const [message, setMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [items, setItems] = useState<DownloadItem[]>([]);

  const downloadFile = async (item: DownloadItem) => {
    const response = await fetch(item.url);
    if (!response.ok) return;
    const blob = await response.blob();
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${item.orderNumber}-${item.filename}`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(link.href);
  };

  const handleLoad = async () => {
    setMessage(null);
    if (!fromDate || !toDate) {
      setMessage('Izberite začetni in končni datum.');
      return;
    }
    setIsLoading(true);
    try {
      const url = `/api/admin/orders/download?from=${encodeURIComponent(
        fromDate
      )}&to=${encodeURIComponent(toDate)}&type=${encodeURIComponent(type)}`;
      const response = await fetch(url);
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || 'Prenos ni uspel.');
      }
      const payload = (await response.json()) as { items: DownloadItem[] };
      if (payload.items.length === 0) {
        setMessage('Ni dokumentov za izbran interval.');
        setItems([]);
        return;
      }
      setItems(payload.items);
      setMessage(`Najdenih dokumentov: ${payload.items.length}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Napaka pri prenosu.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
        <div className="flex flex-1 flex-col gap-2 sm:flex-row">
          <div className="flex-1">
            <label className="text-xs font-semibold uppercase text-slate-500">Od</label>
            <input
              type="date"
              value={fromDate}
              onChange={(event) => setFromDate(event.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div className="flex-1">
            <label className="text-xs font-semibold uppercase text-slate-500">Do</label>
            <input
              type="date"
              value={toDate}
              onChange={(event) => setToDate(event.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div className="flex-1">
            <label className="text-xs font-semibold uppercase text-slate-500">Vrsta PDF</label>
            <select
              value={type}
              onChange={(event) => setType(event.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              {TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <button
          type="button"
          onClick={handleLoad}
          disabled={isLoading}
          className="rounded-full bg-brand-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
        >
          {isLoading ? 'Nalaganje...' : 'Naloži dokumente'}
        </button>
      </div>
      {message && <p className="mt-2 text-sm text-slate-600">{message}</p>}
      {items.length > 0 && (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-3 py-2">Št. naročila</th>
                <th className="px-3 py-2">Tip</th>
                <th className="px-3 py-2">Datum</th>
                <th className="px-3 py-2">PDF</th>
                <th className="px-3 py-2">Open</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={`${item.orderNumber}-${item.filename}-${item.createdAt}`} className="border-t border-slate-100">
                  <td className="px-3 py-2 text-slate-700">{item.orderNumber}</td>
                  <td className="px-3 py-2 text-slate-600">
                    {typeLabelMap.get(item.type) ?? item.type}
                  </td>
                  <td className="px-3 py-2 text-slate-600">
                    {new Date(item.createdAt).toLocaleDateString('sl-SI')}
                  </td>
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      onClick={() => downloadFile(item)}
                      className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 hover:border-brand-200 hover:text-brand-600"
                    >
                      Prenesi
                    </button>
                  </td>
                  <td className="px-3 py-2">
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs font-semibold text-brand-600 hover:text-brand-700"
                    >
                      Odpri →
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
