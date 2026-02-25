'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  type GeneratePdfType,
  type PdfDocument,
  type PdfTypeKey,
  formatDateTimeCompact,
  groupDocumentsByType,
  isGenerateKey,
  routeMap
} from '@/features/admin/orders/utils/adminOrdersPdfCellUtils';

type PdfButton = { key: PdfTypeKey; short: string; full: string };

const PDF_BUTTONS: PdfButton[] = [
  { key: 'order_summary', short: 'PN', full: 'Povzetek naročila' },
  { key: 'purchase_order', short: 'N', full: 'Naročilnica' },
  { key: 'dobavnica', short: 'D', full: 'Dobavnica' },
  { key: 'predracun', short: 'P', full: 'Predračun' },
  { key: 'invoice', short: 'R', full: 'Račun' }
];

const MENU_GAP = 6;
const MENU_PADDING = 8;

type MenuPosition = {
  top: number;
  left: number;
};

const clamp = (value: number, minValue: number, maxValue: number) => {
  if (maxValue < minValue) return minValue;
  return Math.min(Math.max(value, minValue), maxValue);
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
  const [documentsState, setDocumentsState] = useState<PdfDocument[]>(documents);
  const [attachmentsState] = useState<PdfDocument[]>(attachments);
  const [loadingType, setLoadingType] = useState<GeneratePdfType | null>(null);
  const [openType, setOpenType] = useState<PdfTypeKey | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [menuPosition, setMenuPosition] = useState<MenuPosition>({ top: 0, left: 0 });

  const buttonRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!openType) return;

    const anchor = buttonRefs.current[openType];
    if (!anchor) return;

    const updatePosition = () => {
      const anchorRect = anchor.getBoundingClientRect();

      // Menu is rendered in a portal with `position: fixed`,
      // so coordinates must be viewport coordinates (NO scrollX/scrollY).
      const menuWidth = menuRef.current?.offsetWidth ?? 250;
      const menuHeight = menuRef.current?.offsetHeight ?? 180;

      // Prefer explicit boundary (data-pdf-menu-boundary), fallback to nearest overflow-x container.
      const boundaryElement =
        (anchor.closest('[data-pdf-menu-boundary]') as HTMLElement | null) ??
        (anchor.closest('.overflow-x-auto') as HTMLElement | null);

      const viewportBounds = {
        left: MENU_PADDING,
        top: MENU_PADDING,
        right: window.innerWidth - MENU_PADDING,
        bottom: window.innerHeight - MENU_PADDING
      };

      let bounds = viewportBounds;

      if (boundaryElement) {
        const boundaryRect = boundaryElement.getBoundingClientRect();

        bounds = {
          left: Math.max(viewportBounds.left, boundaryRect.left + MENU_PADDING),
          top: Math.max(viewportBounds.top, boundaryRect.top + MENU_PADDING),
          right: Math.min(viewportBounds.right, boundaryRect.right - MENU_PADDING),
          bottom: Math.min(viewportBounds.bottom, boundaryRect.bottom - MENU_PADDING)
        };
      }

      // Horizontal position: align to button left, but clamp inside bounds.
      const minLeft = bounds.left;
      const maxLeft = Math.max(bounds.left, bounds.right - menuWidth);
      const nextLeft = clamp(anchorRect.left, minLeft, maxLeft);

      // Vertical position: prefer below; if not enough space, try above; then clamp.
      const preferredTopBelow = anchorRect.bottom + MENU_GAP;
      const preferredTopAbove = anchorRect.top - MENU_GAP - menuHeight;

      const spaceBelow = bounds.bottom - preferredTopBelow;
      const spaceAbove = preferredTopAbove - bounds.top;

      let nextTop = preferredTopBelow;
      if (spaceBelow < menuHeight && spaceAbove > spaceBelow) {
        nextTop = preferredTopAbove;
      }

      const minTop = bounds.top;
      const maxTop = Math.max(bounds.top, bounds.bottom - menuHeight);

      setMenuPosition({
        top: Math.round(clamp(nextTop, minTop, maxTop)),
        left: Math.round(nextLeft)
      });
    };

    updatePosition();

    // Run once more after paint to ensure menu dimensions are measured correctly.
    const rafId = window.requestAnimationFrame(updatePosition);

    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);

    const onOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (menuRef.current?.contains(target)) return;
      if (anchor.contains(target)) return;
      setOpenType(null);
    };

    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpenType(null);
    };

    document.addEventListener('mousedown', onOutside);
    document.addEventListener('keydown', onEscape);

    return () => {
      window.cancelAnimationFrame(rafId);
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
      document.removeEventListener('mousedown', onOutside);
      document.removeEventListener('keydown', onEscape);
    };
  }, [openType, errorMessage, loadingType]);

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

      setDocumentsState((previousDocuments) => [
        {
          type: payload.type,
          blob_url: payload.url,
          filename: payload.filename,
          created_at: payload.createdAt
        },
        ...previousDocuments
      ]);

      setOpenType(type);
    } finally {
      setLoadingType(null);
    }
  };

  const renderMenu = () => {
    if (!openType || typeof document === 'undefined') return null;

    const button = PDF_BUTTONS.find((item) => item.key === openType);
    if (!button) return null;

    const versions = groupedDocuments[button.key];
    const latest = versions[0];

    return createPortal(
      <div
        ref={menuRef}
        role="menu"
        data-no-row-nav
        className="fixed z-[120] w-[250px] max-w-[calc(100vw-16px)] rounded-xl border border-slate-200 bg-white p-2 shadow-2xl"
        style={{ top: menuPosition.top, left: menuPosition.left }}
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

        <p className="mb-2 text-[10px] text-slate-500">Število verzij: {versions.length}</p>

        {versions.length > 0 ? (
          <ul className="max-h-56 space-y-1 overflow-y-auto pr-1">
            {versions.map((documentOption, index) => (
              <li key={`${button.key}-${documentOption.blob_url}-${documentOption.created_at}-${index}`}>
                <a
                  href={documentOption.blob_url}
                  target="_blank"
                  rel="noreferrer"
                  role="menuitem"
                  data-no-row-nav
                  onClick={() => setOpenType(null)}
                  className="flex items-center justify-between rounded-md border border-transparent bg-white px-2 py-1 text-[10px] text-slate-700 transition hover:border-slate-200 hover:bg-slate-100"
                  title={documentOption.filename}
                >
                  <span className="truncate font-medium">{documentOption.filename}</span>
                  <span className="ml-2 shrink-0 text-slate-500">
                    {formatDateTimeCompact(documentOption.created_at)}
                  </span>
                </a>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[10px] text-slate-400">Ni shranjenih verzij.</p>
        )}

        {errorMessage ? <p className="mt-2 text-[10px] text-rose-600">{errorMessage}</p> : null}
      </div>,
      document.body
    );
  };

  return (
    <div className="relative inline-flex items-center gap-[6px]" data-no-row-nav>
      {PDF_BUTTONS.map((button) => {
        const isOpen = openType === button.key;

        return (
          <div key={button.key} className="relative" data-no-row-nav>
            <button
              ref={(element) => {
                buttonRefs.current[button.key] = element;
              }}
              type="button"
              data-no-row-nav
              title={button.full}
              aria-label={`${button.full} dokumenti`}
              aria-haspopup="menu"
              aria-expanded={isOpen}
              onClick={() =>
                setOpenType((previousType) => (previousType === button.key ? null : button.key))
              }
              disabled={interactionsDisabled}
              className="relative inline-flex h-6 items-center rounded-md border border-slate-200 bg-slate-50 px-1.5 py-1 text-[11px] font-medium text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:text-slate-300"
            >
              <span>{button.short}</span>
            </button>
          </div>
        );
      })}

      {renderMenu()}
    </div>
  );
}