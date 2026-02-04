'use client';

import { useMemo, useState } from 'react';

type PdfDocument = {
  type: string;
  blob_url: string;
  filename: string;
  created_at: string;
};

type PdfTypeKey = 'order_summary' | 'predracun' | 'dobavnica' | 'invoice';

type PdfTypeConfig = {
  key: PdfTypeKey;
  label: string;
};

const PDF_TYPES: PdfTypeConfig[] = [
  { key: 'order_summary', label: 'Povzetek' },
  { key: 'predracun', label: 'Predračun' },
  { key: 'dobavnica', label: 'Dobavnica' },
  { key: 'invoice', label: 'Račun' }
];

const normalizeType = (type: string): PdfTypeKey | null => {
  if (type === 'offer') return 'order_summary';
  if (type === 'order_summary') return 'order_summary';
  if (type === 'predracun') return 'predracun';
  if (type === 'dobavnica') return 'dobavnica';
  if (type === 'invoice') return 'invoice';
  return null;
};

const routeMap: Record<PdfTypeKey, string> = {
  order_summary: 'generate-order-summary',
  predracun: 'generate-predracun',
  dobavnica: 'generate-dobavnica',
  invoice: 'generate-invoice'
};

export default function AdminOrdersPdfCell({
  orderId,
  documents
}: {
  orderId: number;
  documents: PdfDocument[];
}) {
  const initialLatest = useMemo(() => {
    const latest: Partial<Record<PdfTypeKey, PdfDocument>> = {};
    const sorted = [...documents].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    sorted.forEach((doc) => {
      const normalized = normalizeType(doc.type);
      if (!normalized) return;
      if (!latest[normalized]) {
        latest[normalized] = doc;
      }
    });
    return latest;
  }, [documents]);

  const [latestDocs, setLatestDocs] = useState(initialLatest);
  const [loadingType, setLoadingType] = useState<PdfTypeKey | null>(null);

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
      setLatestDocs((prev) => ({
        ...prev,
        [type]: {
          type: payload.type,
          blob_url: payload.url,
          filename: payload.filename,
          created_at: payload.createdAt
        }
      }));
    } finally {
      setLoadingType(null);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      {PDF_TYPES.map((pdf) => {
        const latest = latestDocs[pdf.key];
        return (
          <div key={pdf.key} className="flex flex-wrap items-center gap-2 text-xs">
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-600">
              {pdf.label}
            </span>
            {latest ? (
              <a
                href={latest.blob_url}
                target="_blank"
                rel="noreferrer"
                className="rounded-full border border-slate-200 px-2 py-0.5 text-slate-600 transition hover:border-brand-200 hover:text-brand-600"
                title={`Odpri ${pdf.label}`}
              >
                Odpri
              </a>
            ) : (
              <span className="text-slate-300">—</span>
            )}
            <button
              type="button"
              onClick={() => handleGenerate(pdf.key)}
              className="rounded-full border border-slate-200 px-2 py-0.5 text-slate-600 transition hover:border-brand-200 hover:text-brand-600 disabled:cursor-not-allowed disabled:text-slate-300"
              title={latest ? `Ponovno generiraj ${pdf.label}` : `Generiraj ${pdf.label}`}
              disabled={loadingType === pdf.key}
            >
              {latest ? '↻' : '+'}
            </button>
          </div>
        );
      })}
    </div>
  );
}
