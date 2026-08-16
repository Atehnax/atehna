'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import {
  parseOrderApiError,
  type OrderConfirmationSnapshot
} from '@/commercial/order/contracts';
import { formatEuro } from '@/shared/domain/formatting';

type OrderConfirmationPageClientProps = {
  token?: string;
};

type ConfirmationState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; snapshot: OrderConfirmationSnapshot };

const formatDate = (value?: string) => {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return new Intl.DateTimeFormat('sl-SI', {
    dateStyle: 'long',
    timeStyle: 'short'
  }).format(parsed);
};

const customerTypeLabel = (value?: string) => {
  if (value === 'company') return 'Podjetje';
  if (value === 'school') return 'Šola ali javni zavod';
  return 'Zasebni naročnik';
};

const ATTRIBUTE_LABELS: Record<string, string> = {
  length: 'Dolžina',
  width: 'Širina',
  thickness: 'Debelina',
  weight: 'Teža',
  errorTolerance: 'Toleranca',
  brand: 'Znamka',
  material: 'Material',
  colour: 'Barva',
  color: 'Barva',
  shape: 'Oblika',
  badge: 'Oznaka'
};

const formatAttribute = ([key, rawValue]: [string, string | number]) => {
  const value = String(rawValue);
  const unit =
    key === 'length' || key === 'width' || key === 'thickness'
      ? ' mm'
      : key === 'weight'
        ? ' kg'
        : '';
  const prefix =
    key === 'errorTolerance' && !value.startsWith('±') ? '±' : '';
  const toleranceUnit =
    key === 'errorTolerance' &&
    !value.toLocaleLowerCase('sl').includes('mm')
      ? ' mm'
      : '';
  return `${ATTRIBUTE_LABELS[key] ?? key}: ${prefix}${value}${unit}${toleranceUnit}`;
};

function ConfirmationStatus({
  snapshot
}: {
  snapshot: OrderConfirmationSnapshot;
}) {
  if (snapshot.commitmentStatus === 'pending_confirmation') {
    return (
      <div className="site-radius-md border border-[color:var(--site-color-warning)] bg-[color:var(--site-color-surface-muted)] p-5">
        <div className="flex items-start gap-4">
          <span
            aria-hidden="true"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[color:var(--site-color-warning)] text-xl text-white"
          >
            …
          </span>
          <div>
            <p className="site-eyebrow">Potrditev</p>
            <h1 className="site-heading-1 mt-1">Zahteva je prejeta</h1>
            <p className="site-paragraph mt-3">
              Vašo zahtevo bomo pregledali in vam poslali ponudbo oziroma
              navodila za naročilnico. Zaloga do potrditve še ni rezervirana.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (snapshot.commitmentStatus === 'rejected') {
    return (
      <div className="site-radius-md border border-[color:var(--site-color-danger)] bg-[color:var(--site-color-surface)] p-5">
        <p className="site-eyebrow">Stanje naročila</p>
        <h1 className="site-heading-1 mt-1">Naročilo ni bilo potrjeno</h1>
        <p className="site-paragraph mt-3">
          Za pojasnilo se obrnite na našo ekipo in navedite številko naročila.
        </p>
      </div>
    );
  }

  return (
    <div className="site-radius-md border border-[color:var(--site-color-success)] bg-[color:var(--site-color-surface)] p-5">
      <div className="flex items-start gap-4">
        <span
          aria-hidden="true"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[color:var(--site-color-success)] text-xl font-bold text-white"
        >
          ✓
        </span>
        <div>
          <p className="site-eyebrow">Uspešno oddano</p>
          <h1 className="site-heading-1 mt-1">Naročilo je sprejeto</h1>
          <p className="site-paragraph mt-3">
            Potrditev je shranjena na tej strani. Za nadaljnje usklajevanje
            bomo uporabili navedeni e-poštni naslov; plačilo uredimo ročno po
            ponudbi ali predračunu.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function OrderConfirmationPageClient({
  token
}: OrderConfirmationPageClientProps) {
  const normalizedToken = token?.trim() ?? '';
  const [state, setState] = useState<ConfirmationState>(
    normalizedToken
      ? { status: 'loading' }
      : {
          status: 'error',
          message: 'Povezava za prikaz potrditve ni veljavna.'
        }
  );

  const loadConfirmation = useCallback(async () => {
    if (!normalizedToken) return;
    setState({ status: 'loading' });

    try {
      const response = await fetch(
        `/api/orders/confirmation?token=${encodeURIComponent(normalizedToken)}`,
        {
          cache: 'no-store',
          headers: { Accept: 'application/json' }
        }
      );
      const payload: unknown = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(
          parseOrderApiError(
            payload,
            'Potrditve trenutno ni mogoče prikazati.'
          ).message
        );
      }
      setState({
        status: 'ready',
        snapshot: payload as OrderConfirmationSnapshot
      });
    } catch (error) {
      setState({
        status: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Potrditve trenutno ni mogoče prikazati.'
      });
    }
  }, [normalizedToken]);

  useEffect(() => {
    void loadConfirmation();
  }, [loadConfirmation]);

  if (state.status === 'loading') {
    return (
      <div className="site-panel mx-auto max-w-2xl p-8 text-center" role="status">
        <span
          aria-hidden="true"
          className="mx-auto block h-9 w-9 animate-spin rounded-full border-2 border-[color:var(--site-border-color)] border-t-[color:var(--site-color-primary)]"
        />
        <h1 className="site-heading-2 mt-5">Pripravljamo potrditev</h1>
        <p className="site-paragraph mt-2">Preverjamo podatke naročila …</p>
      </div>
    );
  }

  if (state.status === 'error') {
    return (
      <div
        className="site-panel mx-auto max-w-2xl border-[color:var(--site-color-danger)] p-8 text-center"
        role="alert"
      >
        <h1 className="site-heading-2">Potrditve ni mogoče prikazati</h1>
        <p className="site-paragraph mt-3">{state.message}</p>
        {normalizedToken ? (
          <button
            type="button"
            onClick={() => void loadConfirmation()}
            className="site-button site-button--primary mt-6"
          >
            Poskusi znova
          </button>
        ) : null}
        <Link
          href="/products"
          className="site-button site-button--secondary mt-3 inline-flex items-center justify-center"
        >
          Nazaj v katalog
        </Link>
      </div>
    );
  }

  const { snapshot } = state;
  const submittedAt = formatDate(snapshot.createdAt);
  const customer = snapshot.customer;
  const purchaseOrderHref = `/order/narocilnica?orderId=${encodeURIComponent(
    String(snapshot.orderId)
  )}&orderNumber=${encodeURIComponent(
    snapshot.orderNumber
  )}&token=${encodeURIComponent(normalizedToken)}`;

  return (
    <div>
      <ConfirmationStatus snapshot={snapshot} />

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-6">
          <section className="site-card" aria-labelledby="confirmation-items">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="site-eyebrow">Številka naročila</p>
                <h2 id="confirmation-items" className="site-heading-2 mt-1">
                  {snapshot.orderNumber}
                </h2>
              </div>
              {submittedAt ? (
                <p className="text-sm text-[color:var(--site-color-text-muted)]">
                  {submittedAt}
                </p>
              ) : null}
            </div>

            <ul className="mt-6 divide-y divide-[color:var(--site-divider-color)]">
              {snapshot.items.map((item) => (
                <li
                  key={`${item.variantId}-${item.sku}`}
                  className="grid gap-4 py-5 first:pt-0 sm:grid-cols-[5rem_minmax(0,1fr)]"
                >
                  <div className="site-radius-sm relative aspect-square overflow-hidden bg-[color:var(--site-color-surface-muted)]">
                    {item.imageUrl ? (
                      <Image
                        src={item.imageUrl}
                        alt=""
                        fill
                        sizes="80px"
                        className="object-contain p-2"
                      />
                    ) : (
                      <span className="flex h-full items-center justify-center px-2 text-center text-[10px] text-[color:var(--site-color-text-muted)]">
                        Brez slike
                      </span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h3 className="font-semibold text-[color:var(--site-color-text)]">
                          {item.productName}
                        </h3>
                        {item.variantName ? (
                          <p className="mt-1 text-sm text-[color:var(--site-color-text-muted)]">
                            {item.variantName}
                          </p>
                        ) : null}
                        <p className="mt-1 font-mono text-xs text-[color:var(--site-color-text-muted)]">
                          SKU: {item.sku}
                        </p>
                      </div>
                      <p className="font-semibold tabular-nums text-[color:var(--site-color-text)]">
                        {formatEuro(item.lineGross)}
                      </p>
                    </div>
                    {Object.keys(item.attributes).length > 0 ? (
                      <p className="mt-2 text-xs text-[color:var(--site-color-text-muted)]">
                        {Object.entries(item.attributes)
                          .map(formatAttribute)
                          .join(' · ')}
                      </p>
                    ) : null}
                    <p className="mt-2 text-xs text-[color:var(--site-color-text-muted)]">
                      {item.quantity} {item.unit || 'kos'} ·{' '}
                      {formatEuro(item.lineNet)} brez DDV · DDV{' '}
                      {Math.round(item.taxRate * 100)} %:{' '}
                      {formatEuro(item.lineTax)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <section className="site-card" aria-labelledby="delivery-heading">
            <h2 id="delivery-heading" className="site-heading-2">
              Naročnik in dostava
            </h2>
            <dl className="mt-5 grid gap-5 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-[color:var(--site-color-text-muted)]">
                  Vrsta naročnika
                </dt>
                <dd className="mt-1 font-semibold">
                  {customerTypeLabel(customer?.customerType)}
                </dd>
              </div>
              <div>
                <dt className="text-[color:var(--site-color-text-muted)]">
                  Naročnik
                </dt>
                <dd className="mt-1 font-semibold">
                  {customer?.organizationName ||
                    customer?.customerName ||
                    customer?.contactName ||
                    '—'}
                </dd>
              </div>
              <div>
                <dt className="text-[color:var(--site-color-text-muted)]">
                  Kontakt
                </dt>
                <dd className="mt-1">
                  {customer?.contactName ? (
                    <span className="block font-semibold">
                      {customer.contactName}
                    </span>
                  ) : null}
                  <span>{customer?.email || '—'}</span>
                </dd>
              </div>
              <div>
                <dt className="text-[color:var(--site-color-text-muted)]">
                  Naslov za dostavo
                </dt>
                <dd className="mt-1 font-semibold">
                  {customer?.addressLine1 || customer?.deliveryAddress || '—'}
                  {customer?.addressLine1 ? (
                    <>
                      {customer.addressLine2 ? (
                        <span className="block">{customer.addressLine2}</span>
                      ) : null}
                      <span className="block">
                        {customer.postalCode} {customer.city}
                      </span>
                    </>
                  ) : null}
                </dd>
              </div>
              {customer?.reference ? (
                <div className="sm:col-span-2">
                  <dt className="text-[color:var(--site-color-text-muted)]">
                    Referenca
                  </dt>
                  <dd className="mt-1 font-semibold">{customer.reference}</dd>
                </div>
              ) : null}
            </dl>
          </section>

          {snapshot.documents.length > 0 ? (
            <section className="site-card" aria-labelledby="documents-heading">
              <h2 id="documents-heading" className="site-heading-2">
                Dokumenti
              </h2>
              <ul className="mt-4 grid gap-3 sm:grid-cols-2">
                {snapshot.documents.flatMap((document, index) => {
                  const url = document.url;
                  if (!url) return [];
                  return [
                    <li key={String(document.id ?? `${url}-${index}`)}>
                      <a
                        href={url}
                        target="_blank"
                        rel="noreferrer"
                        className="site-button site-button--secondary inline-flex w-full items-center justify-center"
                      >
                        {document.name ||
                          document.filename ||
                          'Odpri dokument'}
                      </a>
                    </li>
                  ];
                })}
              </ul>
            </section>
          ) : null}
        </div>

        <aside className="lg:sticky lg:top-8 lg:self-start">
          <div className="site-card">
            <h2 className="text-lg font-semibold">Povzetek</h2>
            <dl className="mt-5 space-y-2 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-[color:var(--site-color-text-muted)]">
                  Cena brez DDV
                </dt>
                <dd className="font-semibold tabular-nums">
                  {formatEuro(snapshot.totals.net)}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-[color:var(--site-color-text-muted)]">
                  DDV
                </dt>
                <dd className="font-semibold tabular-nums">
                  {formatEuro(snapshot.totals.tax)}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-[color:var(--site-color-text-muted)]">
                  Dostava
                </dt>
                <dd className="font-semibold text-[color:var(--site-color-success)]">
                  Brezplačno
                </dd>
              </div>
              <div className="flex justify-between gap-4 border-t border-[color:var(--site-divider-color)] pt-3 text-base font-semibold">
                <dt>Skupaj z DDV</dt>
                <dd className="tabular-nums text-[color:var(--site-color-primary)]">
                  {formatEuro(snapshot.totals.gross)}
                </dd>
              </div>
            </dl>

            {snapshot.commitmentStatus === 'pending_confirmation' ? (
              <Link
                href={purchaseOrderHref}
                className="site-button site-button--primary mt-5 inline-flex w-full items-center justify-center"
              >
                Naloži naročilnico
              </Link>
            ) : null}
            <Link
              href="/products"
              className="site-button site-button--secondary mt-3 inline-flex w-full items-center justify-center"
            >
              Nazaj v katalog
            </Link>
          </div>
        </aside>
      </div>
    </div>
  );
}
