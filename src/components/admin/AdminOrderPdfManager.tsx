'use client';

import { useMemo, useState } from 'react';

type PdfDocument = {
  id: number;
  type: string;
  filename: string;
  blob_url: string;
  created_at: string;
};

type PdfTypeKey = 'order_summary' | 'purchase_order' | 'predracun' | 'dobavnica' | 'invoice';

type PdfTypeConfig = {
  key: PdfTypeKey;
  label: string;
};

const PDF_TYPES: PdfTypeConfig[] = [
  { key: 'order_summary', label: 'Povzetek naročila' },
  { key: 'purchase_order', label: 'Naročilnica' },
  { key: 'dobavnica', label: 'Dobavnica' },
  { key: 'predracun', label: 'Predračun' },
  { key: 'invoice', label: 'Račun' }
];

const routeMap: Record<PdfTypeKey, string> = {
  order_summary: 'generate-order-summary',
  purchase_order: 'generate-purchase-order',
  predracun: 'generate-predracun',
  dobavnica: 'generate-dobavnica',
  invoice: 'generate-invoice'
};

const normalizeType = (type: string): PdfTypeKey | null => {
  if (type === 'offer') return 'order_summary';
  if (type === 'purchase_order') return 'purchase_order';
  if (type === 'order_summary') return 'order_summary';
  if (type === 'predracun') return 'predracun';
  if (type === 'dobavnica') return 'dobavnica';
  if (type === 'invoice') return 'invoice';
  return null;
};

const formatTimestamp = (value: string) =>
  new Date(value).toLocaleString('sl-SI', {
    dateStyle: 'medium',
    timeStyle: 'short'
  });

export default function AdminOrderPdfManager({
  orderId,
  documents
}: {
  orderId: number;
  documents: PdfDocument[];
}) {
  const [docList, setDocList] = useState(documents);
  const [loadingType, setLoadingType] = useState<PdfTypeKey | null>(null);
  const [uploadingType, setUploadingType] = useState<PdfTypeKey | null>(null);
  const [uploadFile, setUploadFile] = useState<Partial<Record<PdfTypeKey, File | null>>>({});
  const [openHistoryByType, setOpenHistoryByType] = useState<Partial<Record<PdfTypeKey, boolean>>>({});
  const [deletingDocumentId, setDeletingDocumentId] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const grouped = useMemo(() => {
    const map: Record<PdfTypeKey, PdfDocument[]> = {
      order_summary: [],
      purchase_order: [],
      predracun: [],
      dobavnica: [],
      invoice: []
    };

    const sorted = [...docList].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    sorted.forEach((doc) => {
      const normalized = normalizeType(doc.type);
      if (!normalized) return;
      map[normalized].push(doc);
    });

    return map;
  }, [docList]);

  const handleGenerate = async (type: PdfTypeKey) => {
    setLoadingType(type);
    setMessage(null);
    try {
      const response = await fetch(`/api/admin/orders/${orderId}/${routeMap[type]}`, {
        method: 'POST'
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        setMessage(body.message || 'Generiranje PDF ni uspelo.');
        return;
      }
      const payload = (await response.json()) as {
        url: string;
        filename: string;
        createdAt: string;
        type: string;
      };
      setMessage('PDF je uspešno ustvarjen.');
      setDocList((prev) => [
        {
          id: Date.now(),
          type: payload.type,
          filename: payload.filename,
          blob_url: payload.url,
          created_at: payload.createdAt
        },
        ...prev
      ]);
    } finally {
      setLoadingType(null);
    }
  };

  const handleUpload = async (type: PdfTypeKey) => {
    const file = uploadFile[type];
    if (!file) return;
    setUploadingType(type);
    setMessage(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', type);
      const response = await fetch(`/api/admin/orders/${orderId}/documents`, {
        method: 'POST',
        body: formData
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        setMessage(body.message || 'Nalaganje PDF ni uspelo.');
        return;
      }
      const payload = (await response.json()) as { url: string; filename: string };
      setMessage('PDF je uspešno naložen.');
      setDocList((prev) => [
        {
          id: Date.now(),
          type,
          filename: payload.filename,
          blob_url: payload.url,
          created_at: new Date().toISOString()
        },
        ...prev
      ]);
      setUploadFile((prev) => ({ ...prev, [type]: null }));
    } finally {
      setUploadingType(null);
    }
  };

  const handleDeleteDocument = async (documentId: number) => {
    const confirmed = window.confirm('Ali ste prepričani, da želite izbrisati to verzijo PDF dokumenta?');
    if (!confirmed) return;
    setDeletingDocumentId(documentId);
    setMessage(null);
    try {
      const response = await fetch(`/api/admin/orders/${orderId}/documents/${documentId}`, {
        method: 'DELETE'
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        setMessage(body.message || 'Brisanje PDF ni uspelo.');
        return;
      }
      setMessage('Verzija PDF je izbrisana.');
      setDocList((previousDocuments) => previousDocuments.filter((doc) => doc.id !== documentId));
    } finally {
      setDeletingDocumentId(null);
    }
  };

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-base font-semibold text-slate-900">PDF dokumenti</h2>
      {message ? <p className="mt-2 text-xs text-slate-600">{message}</p> : null}

      <div className="mt-4 space-y-4">
        {PDF_TYPES.map((pdfType) => {
          const docs = grouped[pdfType.key];
          const latest = docs[0];

          return (
            <div key={pdfType.key} className="rounded-2xl border border-slate-200/80 p-3.5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">{pdfType.label}</p>
                  {latest ? (
                    <p className="text-xs text-slate-500">Zadnja verzija: {formatTimestamp(latest.created_at)}</p>
                  ) : (
                    <p className="text-xs text-slate-500">Dokument še ni generiran.</p>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {latest && (
                    <a
                      href={latest.blob_url}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 transition hover:border-brand-200 hover:text-brand-600"
                    >
                      Odpri
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={() => handleGenerate(pdfType.key)}
                    disabled={loadingType === pdfType.key}
                    className="rounded-full bg-brand-600 px-3 py-1 text-xs font-semibold text-white shadow-sm transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
                  >
                    {loadingType === pdfType.key ? 'Generiram ...' : 'Ustvari PDF'}
                  </button>
                  <label className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 hover:border-brand-200 hover:text-brand-600">
                    <input
                      type="file"
                      accept="application/pdf"
                      className="hidden"
                      onChange={(event) =>
                        setUploadFile((prev) => ({
                          ...prev,
                          [pdfType.key]: event.target.files?.[0] ?? null
                        }))
                      }
                    />
                    Naloži PDF
                  </label>
                  <button
                    type="button"
                    onClick={() => handleUpload(pdfType.key)}
                    disabled={!uploadFile[pdfType.key] || uploadingType === pdfType.key}
                    className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 transition hover:border-brand-200 hover:text-brand-600 disabled:cursor-not-allowed disabled:text-slate-300"
                  >
                    {uploadingType === pdfType.key ? 'Nalaganje ...' : 'Shrani PDF'}
                  </button>
                </div>
              </div>

              {docs.length > 0 && (
                <div className="mt-3 border-t border-slate-100 pt-3">
                  <button
                    type="button"
                    onClick={() =>
                      setOpenHistoryByType((previousState) => ({
                        ...previousState,
                        [pdfType.key]: !previousState[pdfType.key]
                      }))
                    }
                    className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-medium text-slate-700 transition hover:bg-slate-100"
                  >
                    <span>Zgodovina</span>
                    <span className="rounded-sm bg-slate-200 px-1.5 py-0.5 text-[10px] text-slate-700">{docs.length}</span>
                  </button>

                  {openHistoryByType[pdfType.key] && (
                    <ul className="mt-2 space-y-1.5 rounded-xl border border-slate-200 bg-white p-2 text-[12px] text-slate-600 shadow-inner">
                      {docs.map((doc, index) => (
                        <li
                          key={`${doc.id}-${doc.created_at}`}
                          className="rounded-lg border border-transparent px-2.5 py-2 transition hover:border-slate-200 hover:bg-slate-50"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <a
                              href={doc.blob_url}
                              target="_blank"
                              rel="noreferrer"
                              className="flex min-w-0 flex-1 items-center justify-between gap-3"
                            >
                              <span className="truncate font-semibold text-brand-600 hover:text-brand-700">{doc.filename}</span>
                              <span className="shrink-0 text-[11px] text-slate-500">{formatTimestamp(doc.created_at)}</span>
                            </a>
                            <button
                              type="button"
                              onClick={() => handleDeleteDocument(doc.id)}
                              disabled={deletingDocumentId === doc.id}
                              className="inline-flex h-6 items-center rounded-md border border-rose-200 px-1.5 text-[10px] font-medium text-rose-600 hover:bg-rose-50 disabled:text-slate-300"
                              aria-label={`Izbriši dokument ${doc.filename}`}
                            >
                              {deletingDocumentId === doc.id ? '...' : 'Izbriši'}
                            </button>
                          </div>
                          {index === 0 && (
                            <span className="mt-1 inline-flex rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">
                              Najnovejše
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
