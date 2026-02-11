'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

import {
  type GeneratePdfType,
  type PdfDocument,
  formatDateTimeCompact,
  groupDocumentsByType,
  isGenerateKey,
  pdfTypes,
  routeMap
} from '@/components/admin/adminOrdersPdfCellUtils';

export default function AdminOrdersPdfCell({
  orderId,
  documents,
  attachments,
  interactionsDisabled = false
}: {
  orderId: number;
  documents: PdfDocument[];
  attachments: PdfDocument[];
  interactionsDisabled?: boolean;
}) {
  const [documentsState, setDocumentsState] = useState(documents);
  const [attachmentsState, setAttachmentsState] = useState(attachments);
  const [loadingType, setLoadingType] = useState<GeneratePdfType | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setDocumentsState(documents);
  }, [documents]);

  useEffect(() => {
    setAttachmentsState(attachments);
  }, [attachments]);

  useEffect(() => {
    if (!isOpen) return;

    const handleOutsideClick = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false);
    };

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  useEffect(() => {
    if (interactionsDisabled) setIsOpen(false);
  }, [interactionsDisabled]);

  const groupedDocuments = useMemo(
    () => groupDocumentsByType(documentsState, attachmentsState),
    [attachmentsState, documentsState]
  );

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

      setDocumentsState((previousDocuments) => [newDocument, ...previousDocuments]);
    } finally {
      setLoadingType(null);
    }
  };

  return (
    <div className="relative inline-flex justify-center" ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen((previousOpen) => !previousOpen)}
        disabled={interactionsDisabled}
        className="h-8 rounded-full border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
        aria-haspopup="menu"
        aria-expanded={isOpen}
      >
        Dokumenti
      </button>

      {isOpen && (
        <div
          role="menu"
          className="absolute right-0 top-9 z-20 w-[320px] rounded-xl border border-slate-200 bg-white p-2 shadow-lg"
        >
          <div className="max-h-[55vh] overflow-y-auto pr-1">
            {pdfTypes.map((pdfType) => {
              const options = groupedDocuments[pdfType.key];
              const latestDocument = options[0];
              const generateKey: GeneratePdfType | null = isGenerateKey(pdfType.key)
                ? pdfType.key
                : null;
              const canGenerate = pdfType.canGenerate && generateKey !== null;
              const isGeneratingThisType = generateKey ? loadingType === generateKey : false;

              return (
                <section key={pdfType.key} className="mb-2 rounded-lg border border-slate-100 p-2 last:mb-0">
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-slate-700">{pdfType.label}</span>
                    <div className="flex items-center gap-1">
                      {latestDocument && (
                        <a
                          href={latestDocument.blob_url}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-md border border-slate-200 px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50"
                        >
                          Odpri
                        </a>
                      )}

                      {canGenerate && generateKey && (
                        <button
                          type="button"
                          onClick={() => handleGenerate(generateKey)}
                          disabled={isGeneratingThisType}
                          className="rounded-md border border-slate-200 px-2 py-1 text-[11px] font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300"
                        >
                          {isGeneratingThisType ? 'Generiram…' : latestDocument ? 'Nova verzija' : 'Ustvari'}
                        </button>
                      )}
                    </div>
                  </div>

                  {options.length > 0 ? (
                    <div className="space-y-1">
                      {options.map((documentItem, index) => {
                        const versionNumber = options.length - index;
                        const latestTag = index === 0 ? ' (zadnja)' : '';
                        return (
                          <a
                            key={`${documentItem.blob_url}-${documentItem.created_at}-${versionNumber}`}
                            href={documentItem.blob_url}
                            target="_blank"
                            rel="noreferrer"
                            onClick={() => setIsOpen(false)}
                            className="block rounded-md px-2 py-1 text-[11px] text-slate-700 hover:bg-slate-50"
                            title={documentItem.filename}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-medium">
                                v{versionNumber}
                                {latestTag}
                              </span>
                              <span className="text-slate-500">
                                {formatDateTimeCompact(documentItem.created_at)}
                              </span>
                            </div>
                          </a>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-[11px] text-slate-400">Ni shranjenih verzij.</p>
                  )}
                </section>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
