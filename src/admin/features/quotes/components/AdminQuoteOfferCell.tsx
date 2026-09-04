'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { AdminQuoteListRow } from '@/shared/domain/quote/quoteAdminTypes';
import { useDropdownDismiss } from '@/shared/ui/dropdown/use-dropdown-dismiss';
import { Spinner } from '@/shared/ui/loading';
import { useToast } from '@/shared/ui/toast';

type QuoteListDocument = AdminQuoteListRow['downloadableDocuments'][number];

const ISSUED_LIFECYCLE_STATUSES = new Set([
  'issued',
  'accepted',
  'declined',
  'withdrawn',
  'expired',
  'superseded'
]);

const OFFER_BUTTON_TONE_CLASSNAMES = {
  generated:
    'border border-emerald-700/35 bg-emerald-50 text-emerald-700 hover:bg-emerald-100',
  pending:
    'border border-slate-300 bg-[color:var(--ui-neutral-bg)] text-slate-700 hover:bg-[color:var(--ui-neutral-bg-hover)]'
} as const;

const MENU_GAP = 6;
const MENU_PADDING = 8;

type MenuPosition = {
  top: number;
  left: number;
};

const clamp = (value: number, minValue: number, maxValue: number) =>
  Math.min(Math.max(value, minValue), Math.max(minValue, maxValue));

const documentUrl = (quoteRequestId: number, documentId: number) =>
  `/api/admin/quote-requests/${quoteRequestId}/documents/${documentId}`;

const offerDocumentsForVersion = (
  documents: QuoteListDocument[],
  offerVersionId: number | null
) =>
  offerVersionId === null
    ? []
    : documents.filter(
        (documentItem) =>
          documentItem.documentType === 'offer' &&
          documentItem.offerVersionId === offerVersionId
      );

export default function AdminQuoteOfferCell({
  quoteRequestId,
  quoteRequestLabel,
  offerVersionId,
  offerCode,
  offerStatus,
  documents
}: {
  quoteRequestId: number;
  quoteRequestLabel: string;
  offerVersionId: number | null;
  offerCode: string | null;
  offerStatus: string | null;
  documents: QuoteListDocument[];
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [offerDocuments, setOfferDocuments] = useState<QuoteListDocument[]>(
    () => offerDocumentsForVersion(documents, offerVersionId)
  );
  const [isOpen, setIsOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [menuPosition, setMenuPosition] = useState<MenuPosition>({
    top: 0,
    left: 0
  });
  const rootRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const closeMenu = useCallback(() => setIsOpen(false), []);
  const dismissRefs = useMemo(() => [rootRef, menuRef], []);

  useDropdownDismiss({
    open: isOpen,
    refs: dismissRefs,
    onClose: closeMenu
  });

  useEffect(() => {
    setOfferDocuments(
      offerDocumentsForVersion(documents, offerVersionId)
    );
  }, [documents, offerVersionId]);

  useEffect(() => {
    if (!isOpen) return;

    const updatePosition = () => {
      const anchorRect = buttonRef.current?.getBoundingClientRect();
      if (!anchorRect) return;

      const menuWidth = menuRef.current?.offsetWidth ?? 260;
      const menuHeight = menuRef.current?.offsetHeight ?? 170;
      const minLeft = MENU_PADDING;
      const maxLeft = window.innerWidth - MENU_PADDING - menuWidth;
      const preferredBelow = anchorRect.bottom + MENU_GAP;
      const preferredAbove = anchorRect.top - MENU_GAP - menuHeight;
      const fitsBelow =
        preferredBelow + menuHeight <= window.innerHeight - MENU_PADDING;

      setMenuPosition({
        left: Math.round(clamp(anchorRect.left, minLeft, maxLeft)),
        top: Math.round(
          clamp(
            fitsBelow ? preferredBelow : preferredAbove,
            MENU_PADDING,
            window.innerHeight - MENU_PADDING - menuHeight
          )
        )
      });
    };

    updatePosition();
    const frameId = window.requestAnimationFrame(updatePosition);
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);

    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [isOpen, isGenerating]);

  const hasGeneratedDocument = offerDocuments.length > 0;
  const canGenerate =
    offerVersionId !== null &&
    ISSUED_LIFECYCLE_STATUSES.has(String(offerStatus));
  const opensMenu = hasGeneratedDocument || !canGenerate;
  const latestDocument = offerDocuments[0] ?? null;
  const generationDisabledReason = canGenerate
    ? null
    : offerVersionId === null
      ? 'Ponudba še ni pripravljena.'
      : 'Ponudbo najprej izdajte. Osnutek lahko preverite na strani povpraševanja.';

  const generateOfferDocument = async () => {
    if (!canGenerate || offerVersionId === null || isGenerating) return;
    setIsGenerating(true);

    try {
      const response = await fetch(
        `/api/admin/quote-requests/${quoteRequestId}/documents`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ offerVersionId })
        }
      );
      const payload = (await response.json().catch(() => null)) as
        | {
            message?: string;
            pending?: boolean;
            document?: QuoteListDocument;
          }
        | null;

      if (!response.ok) {
        throw new Error(
          payload?.message ?? 'PDF-ja ponudbe ni bilo mogoče ustvariti.'
        );
      }

      if (payload?.document?.documentType === 'offer') {
        setOfferDocuments([payload.document]);
      }

      if (payload?.pending) {
        toast.info(
          payload.message ??
            'PDF ponudbe se ustvarja. Čez trenutek osvežite stran.'
        );
        window.setTimeout(() => router.refresh(), 1_000);
      } else {
        toast.success(payload?.message ?? 'PDF ponudbe je ustvarjen.');
        router.refresh();
      }
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'PDF-ja ponudbe ni bilo mogoče ustvariti.'
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePrimaryClick = () => {
    if (!hasGeneratedDocument && canGenerate) {
      void generateOfferDocument();
      return;
    }

    setIsOpen((current) => !current);
  };

  const menu =
    isOpen && typeof document !== 'undefined'
      ? createPortal(
          <div
            ref={menuRef}
            role="menu"
            data-no-row-nav
            className="fixed z-[120] w-[260px] max-w-[calc(100vw-16px)] rounded-xl border border-slate-200 bg-white p-2 shadow-2xl"
            style={{ top: menuPosition.top, left: menuPosition.left }}
            data-testid={`quote-offer-menu-${quoteRequestId}`}
          >
            <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold text-slate-800">
                  Ponudba
                </p>
                <p
                  className="truncate text-[10px] text-slate-500"
                  title={offerCode ?? undefined}
                >
                  {offerCode ?? 'Osnutek'}
                </p>
              </div>

              {!hasGeneratedDocument && canGenerate ? (
                <button
                  type="button"
                  data-no-row-nav
                  onClick={() => void generateOfferDocument()}
                  disabled={isGenerating}
                  className="inline-flex h-7 shrink-0 items-center rounded-md border border-slate-300 bg-white px-2 text-[10px] font-medium text-slate-700 transition hover:bg-[color:var(--hover-neutral)] disabled:cursor-default disabled:text-slate-300"
                  data-testid={`quote-offer-generate-${quoteRequestId}`}
                >
                  {isGenerating ? (
                    <span className="inline-flex items-center gap-1">
                      <Spinner size="sm" className="text-slate-500" />
                      Generiram ...
                    </span>
                  ) : (
                    'Ustvari'
                  )}
                </button>
              ) : null}
            </div>

            <div className="py-2">
              {latestDocument ? (
                <a
                  href={documentUrl(quoteRequestId, latestDocument.id)}
                  target="_blank"
                  rel="noreferrer"
                  role="menuitem"
                  data-no-row-nav
                  onClick={closeMenu}
                  className="flex items-center justify-between gap-2 rounded-md border border-transparent px-2 py-1.5 text-[10px] text-slate-700 transition hover:border-[color:var(--blue-500)] hover:bg-[color:var(--hover-neutral)]"
                  title={latestDocument.filename}
                >
                  <span className="min-w-0 truncate font-medium">
                    {latestDocument.filename}
                  </span>
                  <span className="shrink-0 text-[color:var(--blue-500)]">
                    Odpri
                  </span>
                </a>
              ) : (
                <p className="px-2 py-1 text-[10px] leading-4 text-slate-500">
                  {generationDisabledReason ?? 'PDF ponudbe še ni ustvarjen.'}
                </p>
              )}
            </div>

            <div className="border-t border-slate-100 pt-2">
              <Link
                href={`/admin/orders/quotes/${quoteRequestId}`}
                prefetch={false}
                role="menuitem"
                data-no-row-nav
                onClick={closeMenu}
                className="flex h-7 items-center rounded-md px-2 text-[10px] font-medium text-[color:var(--blue-500)] hover:bg-[color:var(--hover-neutral)]"
              >
                Odpri povpraševanje
              </Link>
            </div>
          </div>,
          document.body
        )
      : null;

  return (
    <div
      ref={rootRef}
      className="relative isolate inline-flex items-center"
      data-no-row-nav
    >
      <button
        ref={buttonRef}
        type="button"
        data-no-row-nav
        title="Ponudba"
        aria-label={`Ponudba dokumenti za povpraševanje ${quoteRequestLabel}`}
        aria-haspopup={opensMenu ? 'menu' : undefined}
        aria-expanded={opensMenu ? isOpen : undefined}
        aria-busy={isGenerating}
        onClick={handlePrimaryClick}
        disabled={isGenerating}
        className={`relative z-10 inline-flex h-7 min-w-[30px] items-center justify-center rounded-md px-1.5 py-1 text-[10px] font-medium leading-none transition hover:z-20 focus-visible:z-20 disabled:cursor-wait disabled:opacity-60 ${
          hasGeneratedDocument
            ? OFFER_BUTTON_TONE_CLASSNAMES.generated
            : OFFER_BUTTON_TONE_CLASSNAMES.pending
        }`}
        data-testid={`quote-offer-button-${quoteRequestId}`}
        data-generated={hasGeneratedDocument ? 'true' : 'false'}
      >
        PONUDBA
      </button>
      {menu}
    </div>
  );
}
