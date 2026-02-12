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
  { key: 'predracun', label: 'Predračun' },
  { key: 'dobavnica', label: 'Dobavnica' },
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
    try {
      const response = await fetch(`/api/admin/orders/${orderId}/${routeMap[type]}`, {
        method: 'POST'
      });
      if (!response.ok) {
        return;
      }
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
      if (!response.ok) {
        return;
      }
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

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-900">PDF dokumenti</h2>
      <div className="mt-4 space-y-6">
        {PDF_TYPES.map((pdfType) => {
          const docs = grouped[pdfType.key];
          const latest = docs[0];
          const history = docs;

          return (
            <div key={pdfType.key} className="rounded-xl border border-slate-100 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">{pdfType.label}</p>
                  {latest ? (
                    <p className="text-xs text-slate-500">
                      Zadnja verzija: {formatTimestamp(latest.created_at)}
                    </p>
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
                    Ustvari PDF
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

              {history.length > 0 && (
                <div className="mt-3 border-t border-slate-100 pt-3">
                  <button
                    type="button"
                    onClick={() =>
                      setOpenHistoryByType((previousState) => ({
                        ...previousState,
                        [pdfType.key]: !previousState[pdfType.key]
                      }))
                    }
                    className="inline-flex items-center gap-1 text-xs font-semibold uppercase text-slate-500"
                  >
                    Zgodovina
                    <span>{openHistoryByType[pdfType.key] ? '▾' : '▸'}</span>
                  </button>
                  {openHistoryByType[pdfType.key] && (
                    <ul className="mt-2 space-y-2 text-sm text-slate-600">
                      {history.map((doc) => (
                        <li key={`${doc.id}-${doc.created_at}`}>
                          <a
                            href={doc.blob_url}
                            target="_blank"
                            rel="noreferrer"
                            className="font-semibold text-brand-600 hover:text-brand-700"
                          >
                            {formatTimestamp(doc.created_at)}
                          </a>{' '}
                          <span className="text-xs text-slate-400">({doc.filename})</span>
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
