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
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => setDocumentsState(documents), [documents]);
  useEffect(() => setAttachmentsState(attachments), [attachments]);

  useEffect(() => {
    const closeMenu = (event: MouseEvent) => {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(event.target as Node) && !buttonRef.current?.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsMenuOpen(false);
        buttonRef.current?.focus();
      }
    };

    document.addEventListener('mousedown', closeMenu);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('mousedown', closeMenu);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, []);

  useEffect(() => {
    if (!isMenuOpen || !menuRef.current) return;
    const focusable = menuRef.current.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])');
    if (focusable.length > 0) focusable[0].focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab' || !menuRef.current) return;
      const items = Array.from(
        menuRef.current.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])')
      );
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement as HTMLElement;

      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isMenuOpen]);

  const groupedDocuments = useMemo(
    () => groupDocumentsByType(documentsState, attachmentsState),
    [attachmentsState, documentsState]
  );

  const totalFiles = useMemo(
    () => pdfTypes.reduce((sum, typeItem) => sum + groupedDocuments[typeItem.key].length, 0),
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

      setDocumentsState((previousDocuments) => [
        {
          type: payload.type,
          blob_url: payload.url,
          filename: payload.filename,
          created_at: payload.createdAt
        },
        ...previousDocuments
      ]);
    } finally {
      setLoadingType(null);
    }
  };

  return (
    <div className="relative inline-flex" data-no-row-nav>
      <button
        ref={buttonRef}
        type="button"
        data-no-row-nav
        aria-haspopup="menu"
        aria-expanded={isMenuOpen}
        onClick={() => setIsMenuOpen((prev) => !prev)}
        disabled={interactionsDisabled}
        className="inline-flex h-7 items-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 text-[11px] font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300"
      >
        Datoteke
        {totalFiles > 0 && (
          <span className="inline-flex min-w-4 items-center justify-center rounded bg-slate-100 px-1 text-[10px] text-slate-600">
            {totalFiles}
          </span>
        )}
      </button>

      {isMenuOpen && (
        <div
          ref={menuRef}
          role="menu"
          aria-label="Datoteke naročila"
          className="absolute right-0 top-8 z-30 w-[360px] rounded-xl border border-slate-200 bg-white p-2 shadow-xl"
          data-no-row-nav
        >
          <div className="max-h-[380px] space-y-2 overflow-y-auto pr-1">
            {pdfTypes.map((pdfType) => {
              const options = groupedDocuments[pdfType.key];
              const latestDocument = options[0];
              const generateKey = isGenerateKey(pdfType.key) ? pdfType.key : null;
              const isGeneratingThisType = loadingType === generateKey;

              return (
                <section key={pdfType.key} className="rounded-lg border border-slate-200 bg-slate-50/40 p-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[11px] font-semibold text-slate-800">{pdfType.label}</p>
                    {generateKey && (
                      <button
                        type="button"
                        data-no-row-nav
                        onClick={() => handleGenerate(generateKey)}
                        disabled={interactionsDisabled || isGeneratingThisType}
                        className="inline-flex h-6 items-center rounded-md border border-slate-300 bg-white px-2 text-[10px] font-medium text-slate-700 transition hover:border-slate-400 disabled:cursor-not-allowed disabled:text-slate-300"
                      >
                        {isGeneratingThisType ? 'Generiram ...' : options.length > 0 ? 'Nova verzija' : 'Ustvari'}
                      </button>
                    )}
                  </div>

                  {latestDocument ? (
                    <ul className="mt-1.5 space-y-1">
                      {options.map((documentOption, index) => (
                        <li key={`${pdfType.key}-${documentOption.blob_url}-${documentOption.created_at}-${index}`}>
                          <a
                            href={documentOption.blob_url}
                            target="_blank"
                            rel="noreferrer"
                            role="menuitem"
                            data-no-row-nav
                            onClick={() => setIsMenuOpen(false)}
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
                    <p className="mt-1.5 text-[10px] text-slate-400">Ni shranjenih verzij.</p>
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
