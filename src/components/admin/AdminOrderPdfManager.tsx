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
  const [expandedByType, setExpandedByType] = useState<Partial<Record<PdfTypeKey, boolean>>>({});
  const [deletingDocumentId, setDeletingDocumentId] = useState<number | null>(null);
  const [confirmDeleteDocumentId, setConfirmDeleteDocumentId] = useState<number | null>(null);
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
        id: number;
        url: string;
        filename: string;
        createdAt: string;
        type: string;
      };
      setMessage('PDF je uspešno ustvarjen.');
      setDocList((prev) => [
        {
          id: payload.id,
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
      const payload = (await response.json()) as { id: number; url: string; filename: string; createdAt: string; type: string };
      setMessage('PDF je uspešno naložen.');
      setDocList((prev) => [
        {
          id: payload.id,
          type: payload.type,
          filename: payload.filename,
          blob_url: payload.url,
          created_at: payload.createdAt
        },
        ...prev
      ]);
      setUploadFile((prev) => ({ ...prev, [type]: null }));
    } finally {
      setUploadingType(null);
    }
  };

  const handleDeleteDocument = (documentId: number) => {
    setConfirmDeleteDocumentId(documentId);
  };

  const confirmDeleteDocument = async () => {
    if (confirmDeleteDocumentId === null) return;

    const documentId = confirmDeleteDocumentId;
    setDeletingDocumentId(documentId);
    setConfirmDeleteDocumentId(null);
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
    <section className="w-full min-w-0 max-w-full overflow-hidden rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-base font-semibold text-slate-900">PDF dokumenti</h2>
      {message ? <p className="mt-2 text-xs text-slate-600">{message}</p> : null}

      <div className="mt-4 space-y-4">
        {PDF_TYPES.map((pdfType) => {
          const docs = grouped[pdfType.key];
          const hasMultipleVersions = docs.length > 1;
          const isExpanded = Boolean(expandedByType[pdfType.key]);
          const visibleDocs = isExpanded ? docs : docs.slice(0, 1);

          return (
            <div key={pdfType.key} className="relative w-full min-w-0 rounded-2xl border border-slate-200/80 p-3.5">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900">{pdfType.label}</p>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleGenerate(pdfType.key)}
                    disabled={loadingType === pdfType.key}
                    className="rounded-full bg-brand-600 px-2.5 py-1 text-xs font-semibold text-white shadow-sm transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
                  >
                    {loadingType === pdfType.key ? 'Generiram ...' : 'Ustvari'}
                  </button>
                  <label className="rounded-full border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-600 hover:border-brand-200 hover:text-brand-600">
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
                    Naloži
                  </label>
                  <button
                    type="button"
                    onClick={() => handleUpload(pdfType.key)}
                    disabled={!uploadFile[pdfType.key] || uploadingType === pdfType.key}
                    className="rounded-full border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-600 transition hover:border-brand-200 hover:text-brand-600 disabled:cursor-not-allowed disabled:text-slate-300"
                  >
                    {uploadingType === pdfType.key ? 'Nalaganje ...' : 'Shrani'}
                  </button>
                </div>
              </div>

              <div className="mt-3 border-t border-slate-100 pt-3">
                {docs.length > 0 ? (
                  <div id={`pdf-versions-${pdfType.key}`} className="rounded-xl border border-slate-200 bg-white p-2 text-[11px] leading-4 text-slate-600 shadow-inner">
                    <ul className="space-y-1">
                      {visibleDocs.map((doc, index) => {
                        const isNewest = index === 0;

                        return (
                          <li
                            key={`${doc.id}-${doc.created_at}`}
                            className="rounded-lg border border-transparent px-2 py-1 transition hover:border-slate-200 hover:bg-slate-50"
                          >
                            <div className="grid min-w-0 grid-cols-[14px_minmax(0,1fr)_130px_24px] items-center gap-2">
                              <span className="inline-flex h-3.5 w-3.5 items-center justify-center text-emerald-600" aria-hidden="true">
                                {isNewest ? (
                                  <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="currentColor">
                                    <path d="M8 1.5a6.5 6.5 0 1 0 0 13a6.5 6.5 0 0 0 0-13Zm3.03 4.72a.75.75 0 0 1 0 1.06L7.66 10.65a.75.75 0 0 1-1.06 0L4.97 9.03a.75.75 0 1 1 1.06-1.06l1.1 1.1l2.84-2.85a.75.75 0 0 1 1.06 0Z" />
                                  </svg>
                                ) : null}
                              </span>

                              <div className="min-w-0 flex items-center gap-2">
                                <a
                                  href={doc.blob_url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className={`truncate text-brand-600 hover:text-brand-700 ${isNewest ? 'font-semibold' : 'font-medium'}`}
                                  title={doc.filename}
                                >
                                  {doc.filename}
                                </a>
                                {hasMultipleVersions && isNewest ? (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setExpandedByType((previousState) => ({
                                        ...previousState,
                                        [pdfType.key]: !previousState[pdfType.key]
                                      }))
                                    }
                                    className="shrink-0 text-xs font-semibold text-slate-500 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-300"
                                    aria-label={isExpanded ? `Skrij verzije za ${pdfType.label}` : `Pokaži vse verzije za ${pdfType.label}`}
                                    aria-expanded={isExpanded}
                                    aria-controls={`pdf-versions-${pdfType.key}`}
                                  >
                                    {isExpanded ? '▲' : '▼'}
                                  </button>
                                ) : null}
                              </div>

                              <span className="text-right text-[11px] text-slate-500 whitespace-nowrap">{formatTimestamp(doc.created_at)}</span>

                              <button
                                type="button"
                                onClick={() => handleDeleteDocument(doc.id)}
                                disabled={deletingDocumentId === doc.id}
                                className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-rose-200 text-sm font-semibold leading-none text-rose-600 hover:bg-rose-50 disabled:text-slate-300"
                                aria-label={`Izbriši dokument ${doc.filename}`}
                                title="Izbriši"
                              >
                                {deletingDocumentId === doc.id ? '…' : '×'}
                              </button>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ) : (
                  <p className="text-[11px] text-slate-400">Ni shranjenih verzij.</p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {confirmDeleteDocumentId !== null ? (
        <div className="fixed inset-0 z-[130] flex items-center justify-center bg-slate-900/30 px-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-sm rounded-2xl bg-white p-4 shadow-xl">
            <p className="text-sm font-semibold text-slate-900">Izbris verzije PDF</p>
            <p className="mt-2 text-xs text-slate-600">Ali ste prepričani, da želite izbrisati to verzijo PDF dokumenta?</p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmDeleteDocumentId(null)}
                className="h-8 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-600"
              >
                Prekliči
              </button>
              <button
                type="button"
                onClick={confirmDeleteDocument}
                className="h-8 rounded-lg border border-rose-200 px-3 text-xs font-semibold text-rose-700"
              >
                Izbriši
              </button>
            </div>
          </div>
        </div>
      ) : null}

    </section>
  );
}
