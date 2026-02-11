'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import {
  type GeneratePdfType,
  type MenuPosition,
  type PdfDocument,
  badgeAvailableClass,
  badgeMissingClass,
  clampValue,
  formatDateTimeCompact,
  formatVersionCount,
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
  const [menuPosition, setMenuPosition] = useState<MenuPosition | null>(null);
  const [isClient, setIsClient] = useState(false);

  const menuRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    setDocumentsState(documents);
  }, [documents]);

  useEffect(() => {
    setAttachmentsState(attachments);
  }, [attachments]);

  const groupedDocuments = useMemo(
    () => groupDocumentsByType(documentsState, attachmentsState),
    [attachmentsState, documentsState]
  );

  const closeMenu = () => setMenuPosition(null);

  const openMenuAtButton = (buttonElement: HTMLButtonElement) => {
    const rect = buttonElement.getBoundingClientRect();
    const menuWidth = 360;
    const viewportPadding = 8;

    const calculatedLeft = clampValue(
      rect.right - menuWidth,
      viewportPadding,
      window.innerWidth - menuWidth - viewportPadding
    );

    setMenuPosition({
      top: rect.bottom + 6,
      left: calculatedLeft
    });
  };

  useEffect(() => {
    if (interactionsDisabled) {
      setMenuPosition(null);
      return;
    }

    if (!menuPosition) return;

    const handleOutsideClick = (mouseEvent: MouseEvent) => {
      const eventTarget = mouseEvent.target as Node | null;
      if (!eventTarget) return;

      const clickedInsideMenu = menuRef.current?.contains(eventTarget);
      const clickedMenuButton = menuButtonRef.current?.contains(eventTarget);

      if (clickedInsideMenu || clickedMenuButton) return;
      closeMenu();
    };

    const handleEscapeKey = (keyboardEvent: KeyboardEvent) => {
      if (keyboardEvent.key === 'Escape') closeMenu();
    };

    const handleViewportChange = () => {
      closeMenu();
    };

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleEscapeKey);
    window.addEventListener('resize', handleViewportChange);
    window.addEventListener('scroll', handleViewportChange, true);

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleEscapeKey);
      window.removeEventListener('resize', handleViewportChange);
      window.removeEventListener('scroll', handleViewportChange, true);
    };
  }, [interactionsDisabled, menuPosition]);

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
    <div className="flex items-center gap-2 min-w-0">
      <div className="grid flex-1 grid-cols-5 gap-1.5 min-w-0">
        {pdfTypes.map((pdfType) => {
          const options = groupedDocuments[pdfType.key];
          const latestDocument = options[0];
          const versionCount = options.length;

          if (latestDocument) {
            if (interactionsDisabled) {
              return (
                <span
                  key={pdfType.key}
                  className={`${badgeAvailableClass} cursor-not-allowed opacity-70`}
                  title={`${pdfType.label} · zadnja verzija (${versionCount})`}
                >
                  <span>{pdfType.label}</span>
                  {versionCount > 1 && (
                    <span className="absolute -right-1 -top-1 inline-flex min-w-[14px] items-center justify-center rounded-full border border-slate-300 bg-white px-1 text-[9px] leading-none text-slate-700 tabular-nums">
                      {versionCount}
                    </span>
                  )}
                </span>
              );
            }

            return (
              <a
                key={pdfType.key}
                href={latestDocument.blob_url}
                target="_blank"
                rel="noreferrer"
                className={badgeAvailableClass}
                title={`${pdfType.label} · zadnja verzija (${versionCount})`}
              >
                <span>{pdfType.label}</span>
                {versionCount > 1 && (
                  <span className="absolute -right-1 -top-1 inline-flex min-w-[14px] items-center justify-center rounded-full border border-slate-300 bg-white px-1 text-[9px] leading-none text-slate-700 tabular-nums">
                    {versionCount}
                  </span>
                )}
              </a>
            );
          }

          return (
            <span
              key={pdfType.key}
              className={badgeMissingClass}
              title={`${pdfType.label} · ni dokumenta`}
            >
              <span>{pdfType.label}</span>
            </span>
          );
        })}
      </div>

      <button
        ref={menuButtonRef}
        type="button"
        disabled={interactionsDisabled}
        onClick={(event) => {
          if (menuPosition) {
            closeMenu();
            return;
          }
          openMenuAtButton(event.currentTarget);
        }}
        className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-slate-200 text-[11px] text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
        aria-label="Odpri meni dokumentov"
        title="Verzije in generiranje"
      >
        ⋯
      </button>

      {isClient &&
        menuPosition &&
        createPortal(
          <div
            ref={menuRef}
            className="z-[1000] w-[360px] rounded-xl border border-slate-200 bg-white p-2 shadow-xl"
            style={{
              position: 'fixed',
              top: `${menuPosition.top}px`,
              left: `${menuPosition.left}px`
            }}
          >
            <div className="max-h-[60vh] overflow-y-auto pr-1">
              {pdfTypes.map((pdfType) => {
                const options = groupedDocuments[pdfType.key];
                const latestDocument = options[0];
                const generateKey: GeneratePdfType | null = isGenerateKey(pdfType.key)
                  ? pdfType.key
                  : null;
                const canGenerate = pdfType.canGenerate && generateKey !== null;
                const isGeneratingThisType = generateKey ? loadingType === generateKey : false;

                return (
                  <section
                    key={pdfType.key}
                    className="mb-2 rounded-lg border border-slate-100 p-2 last:mb-0"
                  >
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="inline-flex rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-700">
                          {pdfType.label}
                        </span>
                        <span className="text-[11px] text-slate-500">
                          {options.length > 0 ? formatVersionCount(options.length) : 'Brez dokumenta'}
                        </span>
                      </div>

                      <div className="flex items-center gap-1">
                        {latestDocument && (
                          <a
                            aria-disabled={interactionsDisabled}
                            onClick={(event) => {
                              if (interactionsDisabled) event.preventDefault();
                            }}
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
                            disabled={interactionsDisabled || isGeneratingThisType}
                            className="rounded-md border border-slate-200 px-2 py-1 text-[11px] font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300"
                          >
                            {isGeneratingThisType
                              ? 'Generiram…'
                              : latestDocument
                              ? 'Nova verzija'
                              : 'Ustvari'}
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
                              aria-disabled={interactionsDisabled}
                              onClick={(event) => {
                                if (interactionsDisabled) {
                                  event.preventDefault();
                                  return;
                                }
                                closeMenu();
                              }}
                              href={documentItem.blob_url}
                              target="_blank"
                              rel="noreferrer"
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
          </div>,
          document.body
        )}
    </div>
  );
}
