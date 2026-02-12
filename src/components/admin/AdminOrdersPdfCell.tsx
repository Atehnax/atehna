'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  type GeneratePdfType,
  type PdfDocument,
  type PdfTypeKey,
  formatDateTimeCompact,
  groupDocumentsByType,
  isGenerateKey,
  routeMap
} from '@/components/admin/adminOrdersPdfCellUtils';

type PdfButton = { key: PdfTypeKey; short: string; full: string };

const PDF_BUTTONS: PdfButton[] = [
  { key: 'order_summary', short: 'PN', full: 'Povzetek naročila' },
  { key: 'purchase_order', short: 'N', full: 'Naročilnica' },
  { key: 'dobavnica', short: 'D', full: 'Dobavnica' },
  { key: 'predracun', short: 'P', full: 'Predračun' },
  { key: 'invoice', short: 'R', full: 'Račun' }
];

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
  const [documentsState, setDocumentsState] = useState<PdfDocument[]>(documents);
  const [attachmentsState] = useState<PdfDocument[]>(attachments);
  const [loadingType, setLoadingType] = useState<GeneratePdfType | null>(null);
  const [openType, setOpenType] = useState<PdfTypeKey | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!openType) return;

    const onOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (menuRef.current?.contains(target)) return;
      if (buttonRef.current?.contains(target)) return;
      setOpenType(null);
    };

    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpenType(null);
    };

    document.addEventListener('mousedown', onOutside);
    document.addEventListener('keydown', onEscape);
    return () => {
      document.removeEventListener('mousedown', onOutside);
      document.removeEventListener('keydown', onEscape);
    };
  }, [openType]);

  const groupedDocuments = useMemo(
    () => groupDocumentsByType(documentsState, attachmentsState),
    [attachmentsState, documentsState]
  );

  const handleGenerate = async (type: GeneratePdfType) => {
    setLoadingType(type);
    setErrorMessage(null);
    try {
      const response = await fetch(`/api/admin/orders/${orderId}/${routeMap[type]}`, {
        method: 'POST'
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        setErrorMessage(body.message || 'Generiranje PDF ni uspelo.');
        return;
      }

      const payload = (await response.json()) as {
        url: string;
        filename: string;
        createdAt: string;
        type: string;
      };

      setDocumentsState((prev) => [
        {
          type: payload.type,
          blob_url: payload.url,
          filename: payload.filename,
          created_at: payload.createdAt
        },
        ...prev
      ]);
      setOpenType(type);
    } finally {
      setLoadingType(null);
    }
  };

  return (
    <div className="relative inline-flex items-center gap-[1px]" data-no-row-nav>
      {PDF_BUTTONS.map((button) => {
        const versions = groupedDocuments[button.key];
        const latest = versions[0];
        const isOpen = openType === button.key;

        return (
          <div key={button.key} className="relative" data-no-row-nav>
            <button
              ref={isOpen ? buttonRef : null}
              type="button"
              data-no-row-nav
              title={button.full}
              aria-label={`${button.full} dokumenti`}
              aria-haspopup="menu"
              aria-expanded={isOpen}
              onClick={() => setOpenType((previousType) => (previousType === button.key ? null : button.key))}
              disabled={interactionsDisabled}
              className="inline-flex h-6 min-w-[20px] items-center justify-center rounded-md border border-slate-300 bg-white px-1 text-[10px] font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300"
            >
              {button.short}
            </button>
            {versions.length > 1 ? (
              <span className="pointer-events-none absolute -right-1 -top-1 inline-flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-slate-800 px-1 text-[9px] text-white">
                {versions.length}
              </span>
            ) : null}

            {isOpen ? (
              <div
                ref={menuRef}
                role="menu"
                data-no-row-nav
                className="absolute left-0 top-7 z-30 w-[250px] rounded-xl border border-slate-200 bg-white p-2 shadow-xl"
              >
                <div className="mb-2 flex items-center justify-between gap-2 border-b border-slate-100 pb-2">
                  <p className="text-[11px] font-semibold text-slate-800">{button.full}</p>
                  {isGenerateKey(button.key) ? (
                    <button
                      type="button"
                      data-no-row-nav
                      onClick={() => handleGenerate(button.key)}
                      disabled={interactionsDisabled || loadingType === button.key}
                      className="inline-flex h-6 items-center rounded-md border border-slate-300 bg-white px-2 text-[10px] font-medium text-slate-700 transition hover:border-slate-400 disabled:cursor-not-allowed disabled:text-slate-300"
                    >
                      {loadingType === button.key ? 'Generiram ...' : latest ? 'Nova verzija' : 'Ustvari'}
                    </button>
                  ) : null}
                </div>

                {versions.length > 0 ? (
                  <ul className="space-y-1">
                    {versions.map((documentOption, index) => (
                      <li key={`${button.key}-${documentOption.blob_url}-${documentOption.created_at}-${index}`}>
                        <a
                          href={documentOption.blob_url}
                          target="_blank"
                          rel="noreferrer"
                          role="menuitem"
                          data-no-row-nav
                          onClick={() => setOpenType(null)}
                          className="flex items-center justify-between rounded-md border border-transparent bg-white px-2 py-1 text-[10px] text-slate-700 transition hover:border-slate-200 hover:bg-slate-50"
                          title={documentOption.filename}
                        >
                          <span className="truncate font-medium">{documentOption.filename}</span>
                          <span className="ml-2 shrink-0 text-slate-500">{formatDateTimeCompact(documentOption.created_at)}</span>
                        </a>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-[10px] text-slate-400">Ni shranjenih verzij.</p>
                )}

                {errorMessage ? <p className="mt-2 text-[10px] text-rose-600">{errorMessage}</p> : null}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
