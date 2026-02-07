'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

type PdfDocument = {
  id?: number;
  type: string;
  blob_url: string;
  filename: string;
  created_at: string;
};

type PdfTypeKey = 'order_summary' | 'predracun' | 'dobavnica' | 'invoice' | 'purchase_order';
type GeneratePdfType = Exclude<PdfTypeKey, 'purchase_order'>;

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

const isGenerateKey = (key: PdfTypeKey): key is GeneratePdfType => key !== 'purchase_order';

const routeMap: Record<GeneratePdfType, string> = {
  order_summary: 'generate-order-summary',
  predracun: 'generate-predracun',
  dobavnica: 'generate-dobavnica',
  invoice: 'generate-invoice'
};

const formatVersionDate = (value: string) =>
  new Date(value).toLocaleString('sl-SI', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

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
  const [loadingType, setLoadingType] = useState<GeneratePdfType | null>(null);
  const [openMenuKey, setOpenMenuKey] = useState<PdfTypeKey | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setDocsState(documents);
  }, [documents]);

  useEffect(() => {
    setAttachmentsState(attachments);
  }, [attachments]);

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(event.target as Node)) {
        setOpenMenuKey(null);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpenMenuKey(null);
    };

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  const grouped = useMemo(() => {
    const groupedDocs: Record<PdfTypeKey, PdfDocument[]> = {
      order_summary: [],
      predracun: [],
      dobavnica: [],
      invoice: [],
      purchase_order: []
    };

    const sortedDocs = [...docsState].sort(
      (leftDocument, rightDocument) =>
        new Date(rightDocument.created_at).getTime() - new Date(leftDocument.created_at).getTime()
    );

    sortedDocs.forEach((documentItem) => {
      const normalizedType = normalizeType(documentItem.type);
      if (!normalizedType) return;
      groupedDocs[normalizedType].push(documentItem);
    });

    const sortedAttachments = [...attachmentsState].sort(
      (leftAttachment, rightAttachment) =>
        new Date(rightAttachment.created_at).getTime() - new Date(leftAttachment.created_at).getTime()
    );

    sortedAttachments.forEach((attachmentItem) => {
      groupedDocs.purchase_order.push(attachmentItem);
    });

    return groupedDocs;
  }, [attachmentsState, docsState]);

  const handleGenerate = async (type: GeneratePdfType) => {
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

      const newDocument: PdfDocument = {
        type: payload.type,
        blob_url: payload.url,
        filename: payload.filename,
        created_at: payload.createdAt
      };

      setDocsState((previousDocs) => [newDocument, ...previousDocs]);
      setOpenMenuKey(type);
    } finally {
      setLoadingType(null);
    }
  };

  return (
    <div ref={rootRef} className="flex items-center gap-1.5 overflow-x-auto whitespace-nowrap py-1">
      {PDF_TYPES.map((pdfType) => {
        const options = grouped[pdfType.key];
        const latestDocument = options[0];
        const hasDocuments = options.length > 0;
        const generateKey = isGenerateKey(pdfType.key) ? pdfType.key : null;
        const isMenuOpen = openMenuKey === pdfType.key;

        return (
          <div key={pdfType.key} className="relative shrink-0">
            <div className="inline-flex h-8 items-center gap-1 rounded-full border border-slate-200 bg-white px-1">
              {latestDocument ? (
                <a
                  href={latestDocument.blob_url}
                  target="_blank"
                  rel="noreferrer"
                  className={`inline-flex rounded-full px-2 py-1 text-[12px] font-semibold ${pdfType.color}`}
                  title={`Odpri zadnjo verzijo: ${pdfType.label}`}
                >
                  {pdfType.label}
                </a>
              ) : (
                <span
                  className={`inline-flex rounded-full px-2 py-1 text-[12px] font-semibold ${pdfType.color}`}
                  title={`Ni dokumenta: ${pdfType.label}`}
                >
                  {pdfType.label}
                </span>
              )}

              {hasDocuments && (
                <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">
                  v{options.length}
                </span>
              )}

              <button
                type="button"
                onClick={() =>
                  setOpenMenuKey((currentOpenKey) =>
                    currentOpenKey === pdfType.key ? null : pdfType.key
                  )
                }
                disabled={!hasDocuments}
                className="inline-flex h-6 w-6 items-center justify-center rounded-full text-xs text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:text-slate-300"
                aria-label={`Odpri zgodovino verzij za ${pdfType.label}`}
                title={hasDocuments ? 'Prejšnje verzije' : 'Ni prejšnjih verzij'}
              >
                ▾
              </button>

              {pdfType.canGenerate && generateKey && (
                <button
                  type="button"
                  onClick={() => handleGenerate(generateKey)}
                  disabled={loadingType === generateKey}
                  className="inline-flex h-6 w-6 items-center justify-center rounded-full text-xs text-slate-600 transition hover:bg-slate-100 hover:text-brand-600 disabled:cursor-not-allowed disabled:text-slate-300"
                  aria-label={hasDocuments ? `Ustvari novo verzijo: ${pdfType.label}` : `Ustvari: ${pdfType.label}`}
                  title={hasDocuments ? 'Nova verzija' : 'Ustvari dokument'}
                >
                  {loadingType === generateKey ? '…' : hasDocuments ? '↻' : '+'}
                </button>
              )}
            </div>

            {isMenuOpen && hasDocuments && (
              <div className="absolute right-0 z-30 mt-1 w-72 rounded-xl border border-slate-200 bg-white p-1 shadow-lg">
                <div className="max-h-64 overflow-y-auto">
                  {options.map((documentItem, index) => {
                    const versionNumber = options.length - index;
                    const isLatest = index === 0;

                    return (
                      <a
                        key={`${documentItem.blob_url}-${documentItem.created_at}-${versionNumber}`}
                        href={documentItem.blob_url}
                        target="_blank"
                        rel="noreferrer"
                        onClick={() => setOpenMenuKey(null)}
                        className="block rounded-lg px-3 py-2 text-xs text-slate-700 transition hover:bg-slate-50"
                        title={documentItem.filename}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span className="font-semibold text-slate-800">
                            v{versionNumber}{isLatest ? ' (zadnja)' : ''}
                          </span>
                          <span className="text-slate-500">{formatVersionDate(documentItem.created_at)}</span>
                        </div>
                        <div className="mt-0.5 truncate text-[11px] text-slate-500">
                          {documentItem.filename}
                        </div>
                      </a>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
