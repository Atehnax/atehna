'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

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

type MenuPosition = {
  top: number;
  left: number;
};

const PDF_TYPES: PdfTypeConfig[] = [
  { key: 'order_summary', label: 'Povzetek', color: 'bg-sky-100 text-sky-700', canGenerate: true },
  { key: 'predracun', label: 'Predračun', color: 'bg-amber-100 text-amber-700', canGenerate: true },
  { key: 'dobavnica', label: 'Dobavnica', color: 'bg-emerald-100 text-emerald-700', canGenerate: true },
  { key: 'invoice', label: 'Račun', color: 'bg-purple-100 text-purple-700', canGenerate: true },
  { key: 'purchase_order', label: 'Naročilnica', color: 'bg-slate-100 text-slate-700', canGenerate: false }
];

const routeMap: Record<GeneratePdfType, string> = {
  order_summary: 'generate-order-summary',
  predracun: 'generate-predracun',
  dobavnica: 'generate-dobavnica',
  invoice: 'generate-invoice'
};

const normalizeType = (type: string): PdfTypeKey | null => {
  if (type === 'offer' || type === 'order_summary') return 'order_summary';
  if (type === 'predracun') return 'predracun';
  if (type === 'dobavnica') return 'dobavnica';
  if (type === 'invoice') return 'invoice';
  if (type === 'purchase_order') return 'purchase_order';
  return null;
};

const isGenerateKey = (key: PdfTypeKey): key is GeneratePdfType => key !== 'purchase_order';

const formatVersionDate = (value: string) =>
  new Date(value).toLocaleString('sl-SI', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

const clampValue = (value: number, minimum: number, maximum: number) =>
  Math.min(Math.max(value, minimum), maximum);

export default function AdminOrdersPdfCell({
  orderId,
  documents,
  attachments
}: {
  orderId: number;
  documents: PdfDocument[];
  attachments: PdfDocument[];
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

  const groupedDocuments = useMemo(() => {
    const grouped: Record<PdfTypeKey, PdfDocument[]> = {
      order_summary: [],
      predracun: [],
      dobavnica: [],
      invoice: [],
      purchase_order: []
    };

    const sortedDocuments = [...documentsState].sort(
      (leftDocument, rightDocument) =>
        new Date(rightDocument.created_at).getTime() - new Date(leftDocument.created_at).getTime()
    );

    sortedDocuments.forEach((documentItem) => {
      const normalizedType = normalizeType(documentItem.type);
      if (!normalizedType) return;
      grouped[normalizedType].push(documentItem);
    });

    const sortedAttachments = [...attachmentsState].sort(
      (leftAttachment, rightAttachment) =>
        new Date(rightAttachment.created_at).getTime() - new Date(leftAttachment.created_at).getTime()
    );

    sortedAttachments.forEach((attachmentItem) => {
      grouped.purchase_order.push(attachmentItem);
    });

    return grouped;
  }, [attachmentsState, documentsState]);

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
  }, [menuPosition]);

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
    <div className="flex items-center gap-1 whitespace-nowrap">
      {PDF_TYPES.map((pdfType) => {
        const options = groupedDocuments[pdfType.key];
        const latestDocument = options[0];
        const versionCount = options.length;

        return latestDocument ? (
          <a
            key={pdfType.key}
            href={latestDocument.blob_url}
            target="_blank"
            rel="noreferrer"
            className={`inline-flex h-6 items-center rounded-full px-1.5 text-[10px] font-semibold ${pdfType.color}`}
            title={`${pdfType.label} · zadnja verzija (${versionCount})`}
          >
            <span>{pdfType.label}</span>
            {versionCount > 1 && <span className="ml-1 opacity-75">{versionCount}</span>}
          </a>
        ) : (
          <span
            key={pdfType.key}
            className={`inline-flex h-6 items-center rounded-full px-1.5 text-[10px] font-semibold opacity-60 ${pdfType.color}`}
            title={`${pdfType.label} · ni dokumenta`}
          >
            {pdfType.label}
          </span>
        );
      })}

      <button
        ref={menuButtonRef}
        type="button"
        onClick={(event) => {
          if (menuPosition) {
            closeMenu();
            return;
          }
          openMenuAtButton(event.currentTarget);
        }}
        className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-slate-200 text-xs text-slate-600 transition hover:border-slate-300 hover:bg-slate-50"
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
              {PDF_TYPES.map((pdfType) => {
                const options = groupedDocuments[pdfType.key];
                const latestDocument = options[0];
                const generateKey: GeneratePdfType | null = isGenerateKey(pdfType.key) ? pdfType.key : null;
                const canGenerate = pdfType.canGenerate && generateKey !== null;
                const isGeneratingThisType = generateKey ? loadingType === generateKey : false;

                return (
                  <section
                    key={pdfType.key}
                    className="mb-2 rounded-lg border border-slate-100 p-2 last:mb-0"
                  >
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${pdfType.color}`}
                        >
                          {pdfType.label}
                        </span>
                        <span className="text-[11px] text-slate-500">
                          {options.length > 0 ? `${options.length} verzij` : 'Brez dokumenta'}
                        </span>
                      </div>

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
                            className="rounded-md border border-slate-200 px-2 py-1 text-[11px] font-medium text-slate-700 transition hover:border-brand-200 hover:text-brand-600 disabled:cursor-not-allowed disabled:text-slate-300"
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
                              onClick={closeMenu}
                              className="block rounded-md px-2 py-1 text-[11px] text-slate-700 hover:bg-slate-50"
                              title={documentItem.filename}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-medium">
                                  v{versionNumber}
                                  {latestTag}
                                </span>
                                <span className="text-slate-500">
                                  {formatVersionDate(documentItem.created_at)}
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
