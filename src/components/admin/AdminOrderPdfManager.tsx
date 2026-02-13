'use client';

import { useMemo, useState } from 'react';

type PdfDocument = {
  id: number;
  type: string;
  filename: string;
  blob_url: string;
  created_at: string;
};

type PdfTypeKey = 'order_summary' | 'predracun' | 'dobavnica' | 'invoice';

type PdfTypeConfig = {
  key: PdfTypeKey;
  label: string;
};

const PDF_TYPES: PdfTypeConfig[] = [
  { key: 'order_summary', label: 'Povzetek naročila' },
  { key: 'predracun', label: 'Predračun' },
  { key: 'dobavnica', label: 'Dobavnica' },
  { key: 'invoice', label: 'Račun' }
];

const routeMap: Record<PdfTypeKey, string> = {
  order_summary: 'generate-order-summary',
  predracun: 'generate-predracun',
  dobavnica: 'generate-dobavnica',
  invoice: 'generate-invoice'
};

const normalizeType = (type: string): PdfTypeKey | null => {
  if (type === 'offer') return 'order_summary';
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
  const [deletingDocumentId, setDeletingDocumentId] = useState<number | null>(null);
  const [uploadFile, setUploadFile] = useState<Partial<Record<PdfTypeKey, File | null>>>({});
  const [expandedByType, setExpandedByType] = useState<Partial<Record<PdfTypeKey, boolean>>>({});

  const grouped = useMemo(() => {
    const map: Record<PdfTypeKey, PdfDocument[]> = {
      order_summary: [],
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
    try {
      const response = await fetch(`/api/admin/orders/${orderId}/${routeMap[type]}`, {
        method: 'POST'
      });
      if (!response.ok) return;

      const payload = (await response.json()) as {
        url: string;
        filename: string;
        createdAt: string;
        type: string;
      };

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
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', type);
      const response = await fetch(`/api/admin/orders/${orderId}/documents`, {
        method: 'POST',
        body: formData
      });
      if (!response.ok) return;

      const payload = (await response.json()) as { url: string; filename: string };
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
    try {
      const response = await fetch(`/api/admin/orders/${orderId}/documents/${documentId}`, {
        method: 'DELETE'
      });
      if (!response.ok) return;
      setDocList((prev) => prev.filter((doc) => doc.id !== documentId));
    } finally {
      setDeletingDocumentId(null);
    }
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-900">PDF dokumenti</h2>
      <div className="mt-4 space-y-6">
        {PDF_TYPES.map((pdfType) => {
          const docs = grouped[pdfType.key];
          const latest = docs[0];
          const isExpanded = Boolean(expandedByType[pdfType.key]);
          const visibleDocs = isExpanded ? docs : docs.slice(0, 1);

          return (
            <div key={pdfType.key} className="rounded-xl border border-slate-100 p-4">
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
                  <button
                    type="button"
                    onClick={() => handleGenerate(pdfType.key)}
                    disabled={loadingType === pdfType.key}
                    className="rounded-full bg-brand-600 px-3 py-1 text-xs font-semibold text-white shadow-sm transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
                  >
                    {latest ? 'Ponovno generiraj' : 'Generiraj'}
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
                    {uploadingType === pdfType.key ? 'Nalaganje...' : 'Shrani PDF'}
                  </button>
                </div>
              </div>

              {docs.length > 0 && (
                <div className="mt-3 border-t border-slate-100 pt-3">
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedByType((previousState) => ({
                        ...previousState,
                        [pdfType.key]: !previousState[pdfType.key]
                      }))
                    }
                    disabled={docs.length < 2}
                    className="flex w-full items-center justify-between rounded-lg px-1 py-1 text-left text-xs text-slate-500 transition hover:bg-slate-50 disabled:cursor-default disabled:hover:bg-transparent"
                    aria-expanded={isExpanded}
                    aria-controls={`pdf-list-${pdfType.key}`}
                  >
                    <span>{isExpanded ? `Prikaži manj` : `Prikaži vse verzije (${docs.length})`}</span>
                    {docs.length > 1 ? (
                      <span className={`text-xs transition ${isExpanded ? 'rotate-180' : ''}`}>⌄</span>
                    ) : null}
                  </button>

                  <ul id={`pdf-list-${pdfType.key}`} className="mt-1 space-y-2 text-sm text-slate-600">
                    {visibleDocs.map((doc, index) => (
                      <li key={`${doc.id}-${doc.created_at}`}>
                        <div className="flex items-center justify-between gap-2">
                          <a
                            href={doc.blob_url}
                            target="_blank"
                            rel="noreferrer"
                            className="font-semibold text-brand-600 hover:text-brand-700"
                          >
                            {formatTimestamp(doc.created_at)}
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
                        <span className="text-xs text-slate-400">({doc.filename})</span>
                        {index === 0 && !isExpanded ? (
                          <span className="ml-2 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">
                            Najnovejše
                          </span>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
