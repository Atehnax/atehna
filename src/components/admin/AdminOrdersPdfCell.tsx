'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

import {
  type GeneratePdfType,
  type PdfDocument,
  formatDateTimeCompact,
  groupDocumentsByType,
  pdfTypes,
  routeMap
} from '@/components/admin/adminOrdersPdfCellUtils';

const getVersionsLabel = (count: number) => {
  if (count <= 1) return '';
  return `v${count}`;
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
    <div className="inline-flex flex-nowrap items-center justify-center gap-1 whitespace-nowrap" ref={versionsMenuRef}>
      {pdfTypes.map((pdfType) => {
        const options = groupedDocuments[pdfType.key];
        const latestDocument = options[0];
        const isGeneratingThisType = loadingType === pdfType.key;
        const versionBadge = getVersionsLabel(options.length);

        if (latestDocument) {
          return (
            <a
              key={pdfType.key}
              href={latestDocument.blob_url}
              target="_blank"
              rel="noreferrer"
              onClick={(event) => {
                if (interactionsDisabled) event.preventDefault();
              }}
              className="inline-flex h-6 shrink-0 items-center justify-center gap-1 whitespace-nowrap rounded-md border border-slate-200 bg-white px-1.5 text-[10px] font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
            >
              <span>{pdfType.label}</span>
              {versionBadge && (
                <span className="rounded-sm bg-slate-100 px-1 py-0 text-[10px] font-semibold leading-none text-slate-600">
                  {versionBadge}
                </span>
              )}
            </a>
          );
        }

        if (!pdfType.canGenerate) {
          return (
            <span
              key={pdfType.key}
              className="inline-flex h-6 shrink-0 items-center justify-center gap-1 whitespace-nowrap rounded-md border border-slate-200 bg-slate-50 px-1.5 text-[10px] font-medium text-slate-400"
            >
              <span>{pdfType.label}</span>
            </span>
          );
        }

        return (
          <button
            key={pdfType.key}
            type="button"
            onClick={() => handleGenerate(pdfType.key as GeneratePdfType)}
            disabled={interactionsDisabled || isGeneratingThisType}
            className="inline-flex h-6 shrink-0 items-center justify-center whitespace-nowrap rounded-md border border-slate-200 bg-white px-1.5 text-[10px] font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300"
          >
            {isGeneratingThisType ? 'Generiram…' : pdfType.label}
          </button>
        );
      })}

      <div className="relative inline-flex shrink-0">
        <button
          type="button"
          onClick={() => setIsVersionsMenuOpen((previousValue) => !previousValue)}
          disabled={interactionsDisabled || !hasAnyVersions}
          aria-haspopup="menu"
          aria-expanded={isVersionsMenuOpen}
          aria-label="Odpri meni verzij PDF dokumentov"
          className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-slate-200 bg-white text-[11px] text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300"
        >
          ☰
        </button>

        {isVersionsMenuOpen && (
          <div
            role="menu"
            className="absolute right-0 top-7 z-30 w-80 rounded-lg border border-slate-200 bg-white p-2 shadow-lg"
          >
            <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
              {pdfTypes.map((pdfType) => {
                const options = groupedDocuments[pdfType.key];
                if (options.length === 0) return null;

                return (
                  <section key={pdfType.key} className="border-b border-slate-100 pb-2 last:border-b-0 last:pb-0">
                    <p className="mb-1 text-[10px] font-semibold uppercase text-slate-500">{pdfType.label}</p>
                    <div className="space-y-1">
                      {options.map((documentOption, index) => {
                        const version = options.length - index;
                        return (
                          <a
                            key={`${pdfType.key}-${documentOption.created_at}-${documentOption.blob_url}`}
                            href={documentOption.blob_url}
                            target="_blank"
                            rel="noreferrer"
                            onClick={() => setIsVersionsMenuOpen(false)}
                            role="menuitem"
                            className="block rounded-md border border-slate-100 px-2 py-1.5 text-[11px] text-slate-700 transition hover:bg-slate-50"
                            title={documentOption.filename}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-semibold">v{version}</span>
                              <span className="text-[10px] text-slate-500">
                                {formatDateTimeCompact(documentOption.created_at)}
                              </span>
                            </div>
                            <p className="truncate text-[10px] text-slate-500">{documentOption.filename}</p>
                          </a>
                        );
                      })}
                    </div>
                  </section>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
