'use client';

import { useState } from 'react';

type DocumentItem = {
  id?: number;
  type: string;
  filename: string;
  blob_url: string;
};

type Props = {
  orderId: number;
  status: string;
  documents: DocumentItem[];
};

export default function AdminOrderActions({ orderId, status, documents }: Props) {
  const [currentStatus, setCurrentStatus] = useState(status);
  const [docList, setDocList] = useState(documents);
  const [message, setMessage] = useState<string | null>(null);
  const [isWorking, setIsWorking] = useState(false);

  const updateStatus = async () => {
    setIsWorking(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/admin/orders/${orderId}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: currentStatus })
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || 'Posodobitev ni uspela.');
      }
      setMessage('Status je posodobljen.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Napaka pri posodobitvi statusa.');
    } finally {
      setIsWorking(false);
    }
  };

  const generateDocument = async (type: 'dobavnica' | 'invoice') => {
    setIsWorking(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/admin/orders/${orderId}/generate-${type}`, {
        method: 'POST'
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || 'Generiranje ni uspelo.');
      }
      const payload = (await response.json()) as { url: string };
      const filename = `${type}-${new Date().toISOString()}.pdf`;
      setDocList((prev) => [{ type, filename, blob_url: payload.url }, ...prev]);
      setMessage('Dokument je ustvarjen.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Napaka pri generiranju dokumenta.');
    } finally {
      setIsWorking(false);
    }
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-900">Administracija</h2>
      <div className="mt-4 space-y-4">
        <div>
          <label className="text-sm font-medium text-slate-700" htmlFor="status">
            Status naročila
          </label>
          <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center">
            <input
              id="status"
              value={currentStatus}
              onChange={(event) => setCurrentStatus(event.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <button
              type="button"
              onClick={updateStatus}
              disabled={isWorking}
              className="rounded-full bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
            >
              Shrani status
            </button>
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium text-slate-700">Dokumenti</p>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => generateDocument('dobavnica')}
              disabled={isWorking}
              className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-brand-200 hover:text-brand-600 disabled:cursor-not-allowed disabled:text-slate-300"
            >
              Generiraj dobavnico
            </button>
            <button
              type="button"
              onClick={() => generateDocument('invoice')}
              disabled={isWorking}
              className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-brand-200 hover:text-brand-600 disabled:cursor-not-allowed disabled:text-slate-300"
            >
              Generiraj račun
            </button>
          </div>
          {message && <p className="text-sm text-slate-600">{message}</p>}
        </div>

        <div>
          <p className="text-sm font-medium text-slate-700">Shranjeni dokumenti</p>
          <ul className="mt-2 space-y-2 text-sm text-slate-600">
            {docList.length === 0 ? (
              <li>Ni shranjenih dokumentov.</li>
            ) : (
              docList.map((doc, index) => (
                <li key={`${doc.type}-${index}`}>
                  <a
                    href={doc.blob_url}
                    target="_blank"
                    rel="noreferrer"
                    className="font-semibold text-brand-600 hover:text-brand-700"
                  >
                    {doc.type.toUpperCase()}
                  </a>{' '}
                  <span className="text-xs text-slate-400">({doc.filename})</span>
                </li>
              ))
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}
