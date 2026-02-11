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

const getVersionsWord = (count: number) => {
  if (count === 1) return 'verzija';
  if (count === 2) return 'verziji';
  if (count === 3 || count === 4) return 'verzije';
  return 'verzij';
};

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
  const [isVersionsMenuOpen, setIsVersionsMenuOpen] = useState(false);
  const versionsMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setDocumentsState(documents);
  }, [documents]);

  useEffect(() => {
    setAttachmentsState(attachments);
  }, [attachments]);

  useEffect(() => {
    const closeMenu = (event: MouseEvent) => {
      if (!versionsMenuRef.current) return;
      if (!versionsMenuRef.current.contains(event.target as Node)) {
        setIsVersionsMenuOpen(false);
      }
    };

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsVersionsMenuOpen(false);
    };

    document.addEventListener('mousedown', closeMenu);
    document.addEventListener('keydown', closeOnEscape);

    return () => {
      document.removeEventListener('mousedown', closeMenu);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, []);

  const groupedDocuments = useMemo(
    () => groupDocumentsByType(documentsState, attachmentsState),
    [attachmentsState, documentsState]
  );

  const hasAnyVersions = useMemo(
    () => pdfTypes.some((pdfType) => groupedDocuments[pdfType.key].length > 0),
    [groupedDocuments]
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
    <div className="inline-flex items-center justify-center" ref={versionsMenuRef} data-no-row-nav>
      <div className="grid grid-cols-[repeat(5,minmax(0,84px))_20px] items-center gap-0.5 whitespace-nowrap">
        {pdfTypes.map((pdfType) => {
          const options = groupedDocuments[pdfType.key];
          const latestDocument = options[0];
          const isGeneratingThisType = loadingType === pdfType.key;
          const versionCount = options.length;

          const baseClassName =
            'relative inline-flex h-6 items-center justify-center whitespace-nowrap rounded-md border border-slate-200 bg-white px-1.5 text-[10px] font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50';

          return (
            <div key={pdfType.key} className="flex justify-center">
              {latestDocument ? (
                <a
                  data-no-row-nav
                  href={latestDocument.blob_url}
                  target="_blank"
                  rel="noreferrer"
                  onClick={(event) => {
                    if (interactionsDisabled) event.preventDefault();
                  }}
                  className={baseClassName}
                >
                  <span>{pdfType.label}</span>
                  {versionCount > 1 && (
                    <span className="absolute -right-1 -top-1 inline-flex h-3.5 min-w-3.5 items-center justify-center rounded-full border border-slate-200 bg-slate-100 px-0.5 text-[9px] font-semibold leading-none text-slate-600">
                      {versionCount}
                    </span>
                  )}
                </a>
              ) : !pdfType.canGenerate ? (
                <span className="inline-flex h-6 items-center justify-center whitespace-nowrap rounded-md border border-slate-200 bg-slate-50 px-1.5 text-[10px] font-medium text-slate-400">
                  {pdfType.label}
                </span>
              ) : (
                <button
                  data-no-row-nav
                  type="button"
                  onClick={() => handleGenerate(pdfType.key as GeneratePdfType)}
                  disabled={interactionsDisabled || isGeneratingThisType}
                  className={`${baseClassName} disabled:cursor-not-allowed disabled:text-slate-300`}
                >
                  {isGeneratingThisType ? '…' : pdfType.label}
                </button>
              )}
            </div>
          );
        })}

        <div className="relative flex justify-center">
          <button
            data-no-row-nav
            type="button"
            onClick={() => setIsVersionsMenuOpen((previousValue) => !previousValue)}
            disabled={interactionsDisabled}
            aria-haspopup="menu"
            aria-expanded={isVersionsMenuOpen}
            aria-label="Odpri meni verzij PDF dokumentov"
            className="inline-flex h-6 w-5 items-center justify-center text-[12px] leading-none text-slate-500 transition hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 disabled:cursor-not-allowed disabled:text-slate-300"
          >
            ⋮
          </button>

          {isVersionsMenuOpen && (
            <div
              role="menu"
              className="absolute right-0 top-7 z-30 w-[340px] rounded-lg border border-slate-200 bg-white p-2 shadow-lg"
            >
              <div className="max-h-[420px] space-y-2 overflow-y-auto pr-1">
                {pdfTypes.map((pdfType) => {
                  const options = groupedDocuments[pdfType.key];
                  const latestDocument = options[0];
                  const generateKey = isGenerateKey(pdfType.key) ? pdfType.key : null;
                  const isGeneratingThisType = loadingType === generateKey;

                  return (
                    <section
                      key={pdfType.key}
                      className="rounded-lg border border-slate-200 bg-slate-50/60 px-2 py-1.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-medium text-slate-700">
                              {pdfType.label}
                            </span>
                            <span className="text-[10px] text-slate-600">
                              {options.length > 0
                                ? `${options.length} ${getVersionsWord(options.length)}`
                                : 'Brez dokumenta'}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1">
                          {latestDocument && (
                            <a
                              data-no-row-nav
                              href={latestDocument.blob_url}
                              target="_blank"
                              rel="noreferrer"
                              onClick={() => setIsVersionsMenuOpen(false)}
                              role="menuitem"
                              className="inline-flex h-6 items-center rounded-md border border-slate-300 bg-white px-1.5 text-[10px] font-medium text-slate-700 transition hover:border-slate-400"
                            >
                              Odpri
                            </a>
                          )}

                          {generateKey && (
                            <button
                              data-no-row-nav
                              type="button"
                              onClick={() => handleGenerate(generateKey)}
                              disabled={interactionsDisabled || isGeneratingThisType}
                              className="inline-flex h-6 items-center rounded-md border border-slate-300 bg-white px-1.5 text-[10px] font-medium text-slate-700 transition hover:border-slate-400 disabled:cursor-not-allowed disabled:text-slate-300"
                            >
                              {isGeneratingThisType ? '…' : options.length > 0 ? 'Nova verzija' : 'Ustvari'}
                            </button>
                          )}
                        </div>
                      </div>

                      {latestDocument ? (
                        <div className="mt-1.5 text-[10px] text-slate-600">
                          <span className="font-semibold">v{options.length} (zadnja)</span>
                          <span className="ml-2">{formatDateTimeCompact(latestDocument.created_at)}</span>
                        </div>
                      ) : (
                        <div className="mt-1.5 text-[10px] text-slate-400">Ni shranjenih verzij.</div>
                      )}
                    </section>
                  );
                })}
              </div>

              {!hasAnyVersions && (
                <p className="mt-1 text-[10px] text-slate-400">Ni še shranjenih dokumentov.</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
