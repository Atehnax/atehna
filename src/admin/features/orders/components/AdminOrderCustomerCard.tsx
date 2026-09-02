'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import type { CustomerDirectoryRow } from '@/shared/domain/customerDirectory';
import { formatEuro, formatSlInteger } from '@/shared/domain/formatting';
import { formatSlDate } from '@/shared/domain/order/dateTime';
import {
  adminCardSectionIconActionButtonClassName,
  adminCardSectionIconClassName
} from '@/shared/ui/admin-table';
import { CopyIcon } from '@/shared/ui/icons/AdminActionIcons';
import { Spinner } from '@/shared/ui/loading';
import { useToast } from '@/shared/ui/toast';

export type AdminOrderCustomerActionsProps = {
  orderId: number;
  customerEndpoint?: string;
  organizationName?: string | null;
  contactName?: string | null;
  email?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  postalCode?: string | null;
  city?: string | null;
  countryCode?: string | null;
};

type CustomerResponse = {
  customer?: CustomerDirectoryRow | null;
  message?: string;
};

const clean = (value: string | null | undefined) => value?.trim() ?? '';

const displayOrDash = (value: string | null | undefined) => clean(value) || '—';

const formatOptionalDate = (value: string) => value ? formatSlDate(value) : '—';


function OpenCustomerIcon({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M8.2 4.2H4.7a1.9 1.9 0 0 0-1.9 1.9v9.2a1.9 1.9 0 0 0 1.9 1.9h9.2a1.9 1.9 0 0 0 1.9-1.9v-3.5" />
      <path d="M11.2 2.8h6v6M17.2 2.8l-8.1 8.1" />
    </svg>
  );
}

function DrawerField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0 rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-2.5">
      <dt className="text-[10px] font-semibold uppercase tracking-[0.06em] text-slate-500">{label}</dt>
      <dd className="mt-1 break-words text-[13px] font-medium leading-5 text-slate-800">{children}</dd>
    </div>
  );
}

function CustomerDrawerContent({ customer }: { customer: CustomerDirectoryRow }) {
  const fullAddress = [customer.address, [customer.postalCode, customer.city].filter(Boolean).join(' ')]
    .filter(Boolean)
    .join(', ');

  return (
    <div className="mt-5 space-y-5">
      <section>
        <h3 className="text-[12px] font-semibold uppercase tracking-[0.05em] text-slate-500">
          Kontaktni podatki
        </h3>
        <dl className="mt-2 grid gap-2 sm:grid-cols-2">
          <DrawerField label="Naziv">{displayOrDash(customer.name)}</DrawerField>
          <DrawerField label="Naslov">{fullAddress || '—'}</DrawerField>
          <DrawerField label="Kontakti">
            {customer.contacts.length > 0 ? (
              <span className="flex flex-col gap-0.5">
                {customer.contacts.map((contact) => <span key={contact}>{contact}</span>)}
              </span>
            ) : '—'}
          </DrawerField>
          <DrawerField label="E-naslovi">
            {customer.emails.length > 0 ? (
              <span className="flex flex-col gap-0.5">
                {customer.emails.map((email) => (
                  <a
                    key={email}
                    href={`mailto:${email}`}
                    className="text-[color:var(--blue-500)] hover:underline"
                  >
                    {email}
                  </a>
                ))}
              </span>
            ) : '—'}
          </DrawerField>
        </dl>
      </section>

      <section>
        <h3 className="text-[12px] font-semibold uppercase tracking-[0.05em] text-slate-500">
          Nakupi
        </h3>
        <dl className="mt-2 grid grid-cols-2 gap-2">
          <DrawerField label="Število nakupov">{formatSlInteger(customer.purchaseCount)}</DrawerField>
          <DrawerField label="Skupna vrednost">{formatEuro(customer.totalPurchaseValue)}</DrawerField>
          <DrawerField label="Prvi nakup">{formatOptionalDate(customer.firstPurchaseAt)}</DrawerField>
          <DrawerField label="Zadnji nakup">{formatOptionalDate(customer.lastPurchaseAt)}</DrawerField>
          <div className="col-span-2">
            <DrawerField label="Povprečna vrednost nakupa">
              {formatEuro(customer.averagePurchaseValue)}
            </DrawerField>
          </div>
        </dl>
      </section>
    </div>
  );
}

export default function AdminOrderCustomerActions({
  orderId,
  customerEndpoint,
  organizationName,
  contactName,
  email,
  addressLine1,
  addressLine2,
  postalCode,
  city,
  countryCode
}: AdminOrderCustomerActionsProps) {
  const { toast } = useToast();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [customer, setCustomer] = useState<CustomerDirectoryRow | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const displayName = clean(organizationName) || clean(contactName) || 'Neznana stranka';
  const distinctContactName = clean(contactName) && clean(contactName) !== displayName
    ? clean(contactName)
    : '';
  const locality = [clean(postalCode), clean(city)].filter(Boolean).join(' ');
  const fullAddress = useMemo(
    () => [
      [clean(addressLine1), clean(addressLine2)].filter(Boolean).join(', '),
      locality,
      clean(countryCode)
    ].filter(Boolean).join(', '),
    [addressLine1, addressLine2, countryCode, locality]
  );

  useEffect(() => {
    if (!drawerOpen) return;
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    setCustomer(null);

    fetch(customerEndpoint ?? `/api/admin/orders/${orderId}/customer`, {
      cache: 'no-store',
      signal: controller.signal
    })
      .then(async (response) => {
        const body = await response.json().catch(() => ({})) as CustomerResponse;
        if (!response.ok || !body.customer) {
          throw new Error(body.message || 'Podatkov o stranki ni bilo mogoče naložiti.');
        }
        setCustomer(body.customer);
      })
      .catch((loadError) => {
        if (controller.signal.aborted) return;
        setError(loadError instanceof Error
          ? loadError.message
          : 'Podatkov o stranki ni bilo mogoče naložiti.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [customerEndpoint, drawerOpen, orderId]);

  useEffect(() => {
    if (!drawerOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeButtonRef.current?.focus();

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setDrawerOpen(false);
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [drawerOpen]);

  const copyCustomerData = async () => {
    const lines = [
      displayName,
      distinctContactName,
      clean(email),
      fullAddress
    ].filter(Boolean);

    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard API ni na voljo.');
      await navigator.clipboard.writeText(lines.join('\n'));
      toast.success('Podatki stranke so kopirani.');
    } catch {
      toast.error('Podatkov stranke ni bilo mogoče kopirati.');
    }
  };

  const drawer = drawerOpen && typeof document !== 'undefined'
    ? createPortal(
      <div className="fixed inset-0 z-[130] flex justify-end bg-slate-900/30 font-['Inter',system-ui,sans-serif]">
        <button
          type="button"
          aria-label="Zapri podatke stranke"
          className="absolute inset-0 cursor-default"
          onClick={() => setDrawerOpen(false)}
        />
        <aside
          role="dialog"
          aria-modal="true"
          aria-labelledby={`order-customer-drawer-title-${orderId}`}
          className="relative h-full w-full max-w-xl overflow-y-auto border-l border-slate-200 bg-white p-5 shadow-2xl"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h2
                id={`order-customer-drawer-title-${orderId}`}
                className="truncate text-lg font-semibold text-slate-900"
              >
                {customer?.name || displayName}
              </h2>
              <p className="mt-1 text-[12px] text-slate-500">Podatki iz Stranke › Vse</p>
            </div>
            <button
              ref={closeButtonRef}
              type="button"
              className="rounded-md px-2 py-1 text-[12px] font-semibold text-slate-500 hover:bg-[color:var(--hover-neutral)]"
              onClick={() => setDrawerOpen(false)}
            >
              Zapri
            </button>
          </div>

          {loading ? (
            <div className="mt-8 flex items-center justify-center gap-2 py-10 text-[13px] text-slate-500">
              <Spinner size="sm" />
              <span>Nalaganje podatkov stranke ...</span>
            </div>
          ) : null}
          {error ? (
            <div className="mt-5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-3 text-[12px] leading-5 text-rose-700">
              {error}
            </div>
          ) : null}
          {!loading && !error && customer ? <CustomerDrawerContent customer={customer} /> : null}
        </aside>
      </div>,
      document.body
    )
    : null;

  return (
    <>
      <div className="flex shrink-0 items-center gap-1" data-testid="admin-order-customer-actions">
        <button
          type="button"
          className={adminCardSectionIconActionButtonClassName}
          onClick={() => setDrawerOpen(true)}
          aria-label="Odpri stranko"
          title="Odpri stranko"
          data-testid="admin-order-customer-open"
        >
          <OpenCustomerIcon className={adminCardSectionIconClassName} />
        </button>
        <button
          type="button"
          className={adminCardSectionIconActionButtonClassName}
          onClick={() => void copyCustomerData()}
          aria-label="Kopiraj podatke"
          title="Kopiraj podatke"
          data-testid="admin-order-customer-copy"
        >
          <CopyIcon className={adminCardSectionIconClassName} />
        </button>
      </div>
      {drawer}
    </>
  );
}
