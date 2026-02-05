'use client';

import { useEffect, useMemo, useState } from 'react';

type PdfDocument = {
  id?: number;
  type: string;
  blob_url: string;
  filename: string;
  created_at: string;
};

type PdfTypeKey = 'order_summary' | 'predracun' | 'dobavnica' | 'invoice' | 'purchase_order';

type PdfTypeConfig = {
  key: PdfTypeKey;
  label: string;
  color: string;
  canGenerate: boolean;
};

const PDF_TYPES: PdfTypeConfig[] = [
  { key: 'order_summary', label: 'Povzetek', color: 'bg-sky-100 text-sky-700', canGenerate: true },
  { key: 'predracun', label: 'Predračun', color: 'bg-amber-100 text-amber-700', canGenerate: true },
  { key: 'dobavnica', label: 'Dobavnica', color: 'bg-emerald-100 text-emerald-700', canGenerate: true },
  { key: 'invoice', label: 'Račun', color: 'bg-purple-100 text-purple-700', canGenerate: true },
  { key: 'purchase_order', label: 'Naročilnica', color: 'bg-slate-100 text-slate-700', canGenerate: false }
];

const normalizeType = (type: string): PdfTypeKey | null => {
  if (type === 'offer') return 'order_summary';
  if (type === 'order_summary') return 'order_summary';
  if (type === 'predracun') return 'predracun';
  if (type === 'dobavnica') return 'dobavnica';
  if (type === 'invoice') return 'invoice';
  if (type === 'purchase_order') return 'purchase_order';
  return null;
};

const routeMap: Record<'order_summary' | 'predracun' | 'dobavnica' | 'invoice', string> = {
  order_summary: 'generate-order-summary',
  predracun: 'generate-predracun',
  dobavnica: 'generate-dobavnica',
  invoice: 'generate-invoice'
};

export default function AdminOrdersPdfCell({
  orderId,
  documents,
  attachments
}: {
  orderId: number;
  documents: PdfDocument[];
  attachments: PdfDocument[];
}) {
  const [docsState, setDocsState] = useState(documents);
  const [attachmentsState, setAttachmentsState] = useState(attachments);

  useEffect(() => {
    setDocsState(documents);
  }, [documents]);

  useEffect(() => {
    setAttachmentsState(attachments);
  }, [attachments]);

  const grouped = useMemo(() => {
    const groupedDocs: Record<PdfTypeKey, PdfDocument[]> = {
      order_summary: [],
      predracun: [],
      dobavnica: [],
      invoice: [],
      purchase_order: []
    };

    const sortedDocs = [...docsState].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    sortedDocs.forEach((doc) => {
      const normalized = normalizeType(doc.type);
      if (!normalized) return;
      groupedDocs[normalized].push(doc);
    });

    const sortedAttachments = [...attachmentsState].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    sortedAttachments.forEach((attachment) => {
      groupedDocs.purchase_order.push(attachment);
    });

    return groupedDocs;
  }, [attachmentsState, docsState]);

  const initialSelection = useMemo(() => {
    const selection: Partial<Record<PdfTypeKey, string>> = {};
    PDF_TYPES.forEach((type) => {
      const latest = grouped[type.key][0];
      if (latest) {
        selection[type.key] = latest.blob_url;
      }
    });
    return selection;
  }, [grouped]);

  const [selected, setSelected] = useState(initialSelection);
  const [loadingType, setLoadingType] = useState<PdfTypeKey | null>(null);

  useEffect(() => {
    setSelected((prev) => {
      const next: Partial<Record<PdfTypeKey, string>> = { ...prev };
      PDF_TYPES.forEach((type) => {
        if (!next[type.key] && grouped[type.key][0]) {
          next[type.key] = grouped[type.key][0].blob_url;
        }
      });
      return next;
    });
  }, [grouped]);

  const handleGenerate = async (type: PdfTypeKey) => {
    if (!['order_summary', 'predracun', 'dobavnica', 'invoice'].includes(type)) {
      return;
    }
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
      const newDoc: PdfDocument = {
        type: payload.type,
        blob_url: payload.url,
        filename: payload.filename,
        created_at: payload.createdAt
      };
      setDocsState((prev) => [newDoc, ...prev]);
      setSelected((prev) => ({ ...prev, [type]: payload.url }));
    } finally {
      setLoadingType(null);
    }
  };

  return (
    <div className="flex flex-row flex-wrap gap-4">
      {PDF_TYPES.map((pdf) => {
        const options = grouped[pdf.key];
        const selectedUrl = selected[pdf.key];
        const hasDocs = options.length > 0;
        return (
          <div key={pdf.key} className="flex w-[190px] flex-col gap-2">
            <span
              className={`inline-flex w-fit rounded-full px-2 py-0.5 text-[11px] font-semibold ${pdf.color}`}
            >
              {pdf.label}
            </span>
            <div className="flex items-center gap-2">
              <select
                value={selectedUrl ?? ''}
                onChange={(event) =>
                  setSelected((prev) => ({ ...prev, [pdf.key]: event.target.value }))
                }
                className="w-full rounded-full border border-slate-200 bg-white px-2 py-1 text-xs text-slate-600"
              >
                <option value="" disabled>
                  {hasDocs ? 'Izberi verzijo' : 'Brez dokumenta'}
                </option>
                {options.map((doc) => (
                  <option key={`${doc.blob_url}-${doc.created_at}`} value={doc.blob_url}>
                    {new Date(doc.created_at).toLocaleDateString('sl-SI')}
                  </option>
                ))}
              </select>
              {selectedUrl && (
                <a
                  href={selectedUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-full border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:border-brand-200 hover:text-brand-600"
                >
                  Odpri
                </a>
              )}
              {pdf.canGenerate && (
                <button
                  type="button"
                  onClick={() => handleGenerate(pdf.key)}
                  disabled={loadingType === pdf.key}
                  className="rounded-full border border-slate-200 px-2 py-1 text-xs text-slate-600 transition hover:border-brand-200 hover:text-brand-600 disabled:cursor-not-allowed disabled:text-slate-300"
                >
                  {hasDocs ? '↻' : '+'}
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
