'use client';

import Link from 'next/link';
import {
  useEffect,
  useMemo,
  useRef,
  type ReactNode
} from 'react';
import { useCartStore } from '@/commercial/cart/store';
import {
  cartHasBlockingIssue,
  getCartSubtotal
} from '@/commercial/cart/cartTypes';
import CartLine from '@/commercial/components/storefront/CartLine';
import { useProductAppearance } from '@/commercial/components/ProductAppearanceProvider';
import useProductCanvasDevice from '@/commercial/components/storefront/useProductCanvasDevice';
import ShippingCalculationRows, {
  ShippingManualQuoteNotice
} from '@/commercial/order/components/ShippingCalculationRows';
import { useOrderEstimate } from '@/commercial/order/useOrderEstimate';
import { formatEuro } from '@/shared/domain/formatting';
import { resolveProductCanvasElementDeviceSettings } from '@/shared/domain/style/productAppearance';
import ProductCanvasElement, {
  PRODUCT_CANVAS_PROTECTED_ELEMENT_IDS
} from '@/shared/ui/product-canvas/ProductCanvasElement';

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])'
].join(',');

export default function CartDrawer() {
  const appearance = useProductAppearance();
  const canvasDevice = useProductCanvasDevice();
  const canvasActive = appearance.canvas?.mode === 'free';
  const wrapCanvasElement = (
    elementId: string,
    label: string,
    children: ReactNode,
    canvasClassName = '',
    forceVisible = false
  ) => {
    if (!canvasActive) return children;
    return (
      <ProductCanvasElement
        elementId={elementId}
        label={label}
        settings={resolveProductCanvasElementDeviceSettings(
          appearance,
          elementId,
          canvasDevice
        )}
        active
        forceVisible={
          forceVisible || PRODUCT_CANVAS_PROTECTED_ELEMENT_IDS.has(elementId)
        }
        className={canvasClassName}
      >
        {children}
      </ProductCanvasElement>
    );
  };
  const items = useCartStore((state) => state.items);
  const isOpen = useCartStore((state) => state.isOpen);
  const lastChangedLineId = useCartStore((state) => state.lastChangedLineId);
  const announcement = useCartStore((state) => state.announcement);
  const closeDrawer = useCartStore((state) => state.closeDrawer);
  const setQuantity = useCartStore((state) => state.setQuantity);
  const removeItem = useCartStore((state) => state.removeItem);
  const estimateState = useOrderEstimate(items, isOpen && items.length > 0);
  const panelRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  const estimateByVariant = useMemo(
    () =>
      new Map(
        (estimateState.estimate?.items ?? []).map((item) => [item.variantId, item])
      ),
    [estimateState.estimate]
  );
  const fallbackGross = getCartSubtotal(items);
  const fallbackNet = items.reduce(
    (sum, item) =>
      sum + (item.pricing?.unitNet ?? 0) * item.quantity,
    0
  );
  const hasCompleteFallbackPricing = items.every(
    (item) =>
      typeof item.pricing?.unitNet === 'number' &&
      typeof item.pricing?.estimatedUnitGross === 'number'
  );
  const totals = estimateState.estimate?.totals;
  const totalsKnown = Boolean(estimateState.estimate) || hasCompleteFallbackPricing;
  const checkoutBlocked =
    items.length === 0 ||
    !estimateState.estimate ||
    estimateState.isLoading ||
    Boolean(estimateState.error) ||
    cartHasBlockingIssue(items);

  useEffect(() => {
    if (!isOpen) return;
    returnFocusRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.requestAnimationFrame(() => closeButtonRef.current?.focus());

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeDrawer();
        return;
      }
      if (event.key !== 'Tab' || !panelRef.current) return;
      const focusable = Array.from(
        panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
      ).filter((element) => !element.hasAttribute('disabled'));
      if (focusable.length === 0) {
        event.preventDefault();
        panelRef.current.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKeyDown);
      returnFocusRef.current?.focus();
    };
  }, [closeDrawer, isOpen]);

  useEffect(() => {
    if (!isOpen || !lastChangedLineId) return;
    window.requestAnimationFrame(() => {
      panelRef.current
        ?.querySelector<HTMLElement>(
          `[data-cart-line-id="${CSS.escape(lastChangedLineId)}"]`
        )
        ?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
  }, [isOpen, lastChangedLineId]);

  if (!isOpen) {
    return (
      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {announcement}
      </p>
    );
  }

  const drawerOnLeft = appearance.cartSidebar.side === 'left';
  const mobileSheet = appearance.cartSidebar.mobileMode === 'sheet';

  return (
    <div className="fixed inset-0 z-[70]">
      <button
        type="button"
        className="absolute inset-0 h-full w-full cursor-default bg-slate-950/45"
        onClick={closeDrawer}
        aria-label="Zapri košarico"
        tabIndex={-1}
      />

      <aside
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="cart-drawer-title"
        aria-describedby="cart-drawer-description"
        tabIndex={-1}
        className={`absolute flex bg-[color:var(--site-color-surface)] shadow-2xl ${
          appearance.cartSidebar.stickySummary
            ? 'overflow-hidden'
            : 'overflow-y-auto'
        } ${
          mobileSheet
            ? 'inset-x-0 bottom-0 h-[min(88vh,52rem)] w-full rounded-t-[var(--site-radius-lg)] sm:inset-x-auto sm:inset-y-0 sm:h-full sm:w-[min(100vw,var(--product-cart-width,456px))] sm:rounded-none'
            : 'inset-y-0 h-full'
        } ${
          drawerOnLeft
            ? mobileSheet
              ? 'sm:left-0'
              : 'left-0'
            : mobileSheet
              ? 'sm:right-0'
              : 'right-0'
        }`}
        style={{
          width: mobileSheet
            ? undefined
            : 'min(100vw, var(--product-cart-width, 456px))'
        }}
      >
        {wrapCanvasElement(
          'cart-panel',
          'Panel košarice',
          <div
            className={
              appearance.cartSidebar.stickySummary
                ? 'flex min-w-0 flex-1 flex-col'
                : 'min-w-0 flex-1'
            }
          >
          {wrapCanvasElement(
            'cart-header',
            'Glava košarice',
            <header className="flex items-start justify-between gap-4 border-b border-[color:var(--site-divider-color)] px-5 py-4">
            <div>
              <p className="site-eyebrow">
                {lastChangedLineId ? 'Dodano v košarico' : 'Košarica'}
              </p>
              <h2 id="cart-drawer-title" className="mt-1 text-xl font-semibold">
                Košarica ({items.reduce((sum, item) => sum + item.quantity, 0)})
              </h2>
              <p
                id="cart-drawer-description"
                className="mt-1 text-xs text-[color:var(--site-color-text-muted)]"
              >
                Cene in zalogo preverimo po veljavnem ceniku.
              </p>
            </div>
            <button
              ref={closeButtonRef}
              type="button"
              onClick={closeDrawer}
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--site-radius-sm)] text-xl text-[color:var(--site-color-text)] transition hover:bg-[color:var(--site-color-surface-muted)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--site-field-focus)]"
              aria-label="Zapri košarico"
            >
              <span aria-hidden="true">×</span>
            </button>
            </header>
          )}

          <p className="sr-only" aria-live="polite" aria-atomic="true">
            {announcement}
          </p>

          <div
            className={`px-4 py-4 sm:px-5 ${
              appearance.cartSidebar.stickySummary
                ? 'flex-1 overflow-y-auto'
                : ''
            }`}
          >
            {items.length === 0 ? (
              <div className="site-radius-md border border-dashed border-[color:var(--site-border-color)] bg-[color:var(--site-color-surface-muted)] p-7 text-center">
                <p className="font-semibold text-[color:var(--site-color-text)]">
                  Košarica je prazna
                </p>
                <p className="mt-2 text-sm text-[color:var(--site-color-text-muted)]">
                  Izberite izdelek in ustrezno različico.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {items.map((item) => (
                  <CartLine
                    key={item.lineId}
                    item={item}
                    estimateItem={
                      typeof item.variant?.id === 'number'
                        ? estimateByVariant.get(item.variant.id)
                        : undefined
                    }
                    compact={appearance.cartSidebar.compactRows}
                    highlighted={item.lineId === lastChangedLineId}
                    onQuantityChange={(quantity) =>
                      setQuantity(item.lineId, quantity)
                    }
                    onRemove={() => removeItem(item.lineId)}
                    onNavigate={closeDrawer}
                    canvasDevice={canvasDevice}
                  />
                ))}
              </div>
            )}
          </div>

          {wrapCanvasElement(
            'cart-summary',
            'Povzetek košarice',
            <footer className="border-t border-[color:var(--site-divider-color)] bg-[color:var(--site-color-surface)] px-5 py-4">
            <dl className="space-y-1.5 text-sm">
              <div className="flex justify-between gap-4 text-[color:var(--site-color-text-muted)]">
                <dt>Brez DDV</dt>
                <dd className="font-semibold tabular-nums text-[color:var(--site-color-text)]">
                  {totals
                    ? formatEuro(totals.net)
                    : totalsKnown
                      ? formatEuro(fallbackNet)
                      : '—'}
                </dd>
              </div>
              <div className="flex justify-between gap-4 text-[color:var(--site-color-text-muted)]">
                <dt>DDV</dt>
                <dd className="font-semibold tabular-nums text-[color:var(--site-color-text)]">
                  {totals
                    ? formatEuro(totals.tax)
                    : totalsKnown
                      ? formatEuro(Math.max(0, fallbackGross - fallbackNet))
                      : '—'}
                </dd>
              </div>
              <ShippingCalculationRows calculation={estimateState.estimate?.shipping ?? null} />
              <div className="mt-2 flex justify-between gap-4 border-t border-[color:var(--site-divider-color)] pt-2 text-base font-semibold">
                <dt>Skupaj z DDV</dt>
                <dd className="tabular-nums text-[color:var(--site-color-primary)]">
                  {totals?.gross !== null && totals?.gross !== undefined
                    ? formatEuro(totals.gross)
                    : '—'}
                </dd>
              </div>
            </dl>

            <ShippingManualQuoteNotice
              calculation={estimateState.estimate?.shipping ?? null}
              className="site-radius-sm mt-2 bg-[color:var(--site-color-surface-muted)] p-3 text-xs text-[color:var(--site-color-danger)]"
            />

            {estimateState.isLoading ? (
              <p className="mt-2 text-xs text-[color:var(--site-color-text-muted)]">
                Preverjamo cene in zalogo …
              </p>
            ) : estimateState.error ? (
              <p className="mt-2 text-xs text-[color:var(--site-color-danger)]">
                {estimateState.error.message}
              </p>
            ) : (
              <p className="mt-2 text-xs text-[color:var(--site-color-text-muted)]">
                Plačilo uredimo ročno po ponudbi ali predračunu.
              </p>
            )}

            <div className="mt-4 grid gap-2">
              {wrapCanvasElement(
                'cart-primary-action',
                'Nadaljuj na naročilo',
                <Link
                  href="/order"
                  prefetch={false}
                  onClick={(event) => {
                    if (checkoutBlocked) {
                      event.preventDefault();
                      return;
                    }
                    closeDrawer();
                  }}
                  aria-disabled={checkoutBlocked}
                  className={`site-button site-button--primary inline-flex w-full items-center justify-center ${
                    checkoutBlocked ? 'pointer-events-none opacity-50' : ''
                  }`}
                >
                  Nadaljuj na naročilo
                </Link>
              )}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={closeDrawer}
                  className="site-button site-button--secondary"
                >
                  Nadaljuj z nakupom
                </button>
                <Link
                  href="/cart"
                  onClick={closeDrawer}
                  className="site-button site-button--secondary inline-flex items-center justify-center"
                >
                  Preglej košarico
                </Link>
              </div>
            </div>
            </footer>,
            'shrink-0'
          )}
          </div>,
          'h-full min-w-0 flex-1',
          true
        )}
      </aside>
    </div>
  );
}
