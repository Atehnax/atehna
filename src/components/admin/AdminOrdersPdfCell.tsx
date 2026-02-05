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
type GeneratePdfType = Exclude<PdfTypeKey, 'purchase_order'>;

type PdfTypeConfig =
  | { key: GeneratePdfType; label: string; color: string; canGenerate: true }
  | { key: 'purchase_order'; label: string; color: string; canGenerate: false };

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

const routeMap: Record<GeneratePdfType, string> = {
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
      (leftDoc, rightDoc) => new Date(rightDoc.created_at).getTime() - new Date(leftDoc.created_at).getTime()
    );
    sortedDocs.forEach((doc) => {
      const normalizedType = normalizeType(doc.type);
      if (!normalizedType) return;
      groupedDocs[normalizedType].push(doc);
    });

    const sortedAttachments = [...attachmentsState].sort(
      (leftAttachment, rightAttachment) =>
        new Date(rightAttachment.created_at).getTime() - new Date(leftAttachment.created_at).getTime()
    );
    sortedAttachments.forEach((attachment) => {
      groupedDocs.purchase_order.push(attachment);
    });

    return groupedDocs;
  }, [attachmentsState, docsState]);

  const initialSelection = useMemo(() => {
    const selection: Partial<Record<PdfTypeKey, string>> = {};
    PDF_TYPES.forEach((pdfType) => {
      const latestDoc = grouped[pdfType.key][0];
      if (latestDoc) {
        selection[pdfType.key] = latestDoc.blob_url;
      }
    });
    return selection;
  }, [grouped]);

  const [selected, setSelected] = useState(initialSelection);
  const [loadingType, setLoadingType] = useState<PdfTypeKey | null>(null);

  useEffect(() => {
    setSelected((previousSelected) => {
      const nextSelected: Partial<Record<PdfTypeKey, string>> = { ...previousSelected };
      PDF_TYPES.forEach((pdfType) => {
        if (!nextSelected[pdfType.key] && grouped[pdfType.key][0]) {
          nextSelected[pdfType.key] = grouped[pdfType.key][0].blob_url;
        }
      });
      return nextSelected;
    });
  }, [grouped]);

  const handleGenerate = async (type: GeneratePdfType) => {
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

      setDocsState((previousDocs) => [newDoc, ...previousDocs]);
      setSelected((previousSelected) => ({ ...previousSelected, [type]: payload.url }));
    } finally {
      setLoadingType(null);
    }
  };

  return (
    <div className="flex flex-row flex-wrap gap-4">
      {PDF_TYPES.map((pdfType) => {
        const options = grouped[pdfType.key];
        const selectedUrl = selected[pdfType.key];
        const hasDocs = options.length > 0;

        return (
          <div key={pdfType.key} className="flex w-[190px] flex-col gap-2">
            <span
              className={`inline-flex w-fit rounded-full px-2 py-0.5 text-[11px] font-semibold ${pdfType.color}`}
            >
              {pdfType.label}
            </span>
            <div className="flex items-center gap-2">
              <select
                value={selectedUrl ?? ''}
                onChange={(event) =>
                  setSelected((previousSelected) => ({
                    ...previousSelected,
                    [pdfType.key]: event.target.value
                  }))
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

              {pdfType.canGenerate && (
                <button
                  type="button"
                  onClick={() => handleGenerate(pdfType.key)}
                  disabled={loadingType === pdfType.key}
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
