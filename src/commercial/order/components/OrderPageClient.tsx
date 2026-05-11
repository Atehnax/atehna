'use client';

import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from 'react';
import Link from 'next/link';
import { useCartStore } from '@/commercial/cart/store';
import { CUSTOMER_TYPE_FORM_OPTIONS, type CustomerType } from '@/shared/domain/order/customerType';
import { SLOVENIAN_ADDRESSES } from '@/commercial/data/slovenianAddresses';
import { FloatingInput, FloatingSelect, FloatingTextarea } from '@/shared/ui/floating-field';
import { Spinner } from '@/shared/ui/loading';
import { Button } from '@/shared/ui/button';
import { IconButton } from '@/shared/ui/icon-button';
import { QuantityInput } from '@/shared/ui/quantity-input';
import { buttonTokenClasses } from '@/shared/ui/theme/tokens';
import { CloseIcon } from '@/shared/ui/icons/AdminActionIcons';
import { formatEuro } from '@/shared/domain/formatting';

const FORM_STORAGE_KEY = 'atehna-order-form';

type CheckoutItem = {
  sku: string;
  name: string;
  unit?: string | null;
  quantity: number;
  unitPrice?: number | null;
};

type OrderFormData = {
  customerType: CustomerType;
  firstName: string;
  lastName: string;
  organizationName: string;
  addressLine1: string;
  city: string;
  postalCode: string;
  email: string;
  notes: string;
};

type OrderResponse = {
  orderId: number;
  orderNumber: string;
  documentUrl: string;
  documentType: string;
};

type SubmittedOrderSnapshot = {
  customerType: CustomerType;
  organizationName: string;
  recipientName: string;
  email: string;
  notes: string;
  deliveryAddressLines: string[];
  items: CheckoutItem[];
  subtotal: number;
  shipping: number;
  total: number;
  vatIncluded: number;
};

const initialForm: OrderFormData = {
  customerType: 'school',
  firstName: '',
  lastName: '',
  organizationName: '',
  addressLine1: '',
  city: '',
  postalCode: '',
  email: '',
  notes: ''
};

const formatCurrency = formatEuro;

const toNumber = (value: unknown) =>
  typeof value === 'number' && Number.isFinite(value) ? value : 0;

const extractVatIncluded = (grossAmount: number, vatRate = 0.22) =>
  grossAmount - grossAmount / (1 + vatRate);

const composeDeliveryAddressLines = (formData: OrderFormData) => {
  const cityLine = `${formData.postalCode.trim()} ${formData.city.trim()}`.trim();
  return [formData.addressLine1.trim(), cityLine].filter(Boolean);
};

const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

const classNames = (...parts: Array<string | false | null | undefined>) =>
  parts.filter(Boolean).join(' ');

function PencilIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M13.8 3.6a1.6 1.6 0 0 1 2.3 2.3l-8.6 8.6-3.6.8.8-3.6 8.6-8.1z" />
      <path d="M11.8 5.5l2.8 2.8" />
    </svg>
  );
}

export default function OrderPageClient() {
  const items = useCartStore((state) => state.items) as CheckoutItem[];
  const setQuantity = useCartStore((state) => state.setQuantity);
  const removeItem = useCartStore((state) => state.removeItem);
  const clearCart = useCartStore((state) => state.clearCart);

  const [formData, setFormData] = useState<OrderFormData>(initialForm);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderResponse, setOrderResponse] = useState<OrderResponse | null>(null);
  const [submittedOrder, setSubmittedOrder] = useState<SubmittedOrderSnapshot | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [isEmailEditing, setIsEmailEditing] = useState(true);

  const normalizedItems = useMemo(
    () =>
      items.map((item) => ({
        ...item,
        unitPrice: toNumber(item.unitPrice)
      })),
    [items]
  );

  const hasMissingPrices = useMemo(
    () =>
      items.some((item) => typeof item.unitPrice !== 'number' || !Number.isFinite(item.unitPrice)),
    [items]
  );

  const subtotal = useMemo(
    () => normalizedItems.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0),
    [normalizedItems]
  );
  const shipping = 0;
  const total = subtotal + shipping;
  const vatIncluded = useMemo(() => extractVatIncluded(total), [total]);

  const isIndividual = formData.customerType === 'individual';

  const emailIsValid = useMemo(() => isValidEmail(formData.email), [formData.email]);
  const emailConfirmed = emailIsValid && !isEmailEditing;
  const shippingDetailsLocked = !emailConfirmed;

  useEffect(() => {
    const saved = localStorage.getItem(FORM_STORAGE_KEY);
    if (!saved) return;

    try {
      const parsed = JSON.parse(saved) as Partial<OrderFormData> & { deliveryAddress?: string };
      const next = { ...initialForm, ...parsed };

      if (parsed.deliveryAddress && !parsed.addressLine1) {
        next.addressLine1 = parsed.deliveryAddress;
      }

      setFormData(next);

      if (isValidEmail(String(next.email ?? ''))) {
        setIsEmailEditing(false);
      }
    } catch {
      localStorage.removeItem(FORM_STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(FORM_STORAGE_KEY, JSON.stringify(formData));
  }, [formData]);

  const requiredFieldsFilled = useMemo(() => {
    const commonRequired =
      emailIsValid &&
      formData.addressLine1.trim().length > 0 &&
      formData.city.trim().length > 0 &&
      formData.postalCode.trim().length > 0 &&
      items.length > 0;

    if (!commonRequired) return false;

    if (formData.customerType === 'individual') {
      return Boolean(formData.firstName.trim() && formData.lastName.trim());
    }

    return Boolean(formData.organizationName.trim());
  }, [
    emailIsValid,
    formData.addressLine1,
    formData.city,
    formData.customerType,
    formData.firstName,
    formData.lastName,
    formData.organizationName,
    formData.postalCode,
    items.length
  ]);

  const canSubmit = requiredFieldsFilled && !hasMissingPrices && !isSubmitting;

  const addressSuggestions = useMemo(() => {
    const query = formData.addressLine1.trim().toLowerCase();
    if (!query || shippingDetailsLocked) return [];

    return SLOVENIAN_ADDRESSES.filter((address) => address.toLowerCase().includes(query)).slice(0, 7);
  }, [formData.addressLine1, shippingDetailsLocked]);

  const confirmEmailStep = () => {
    if (!emailIsValid) return;
    setIsEmailEditing(false);
  };

  const handleSubmit = async (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
    setErrorMessage(null);

    if (!requiredFieldsFilled) {
      setErrorMessage('Izpolnite obvezna polja in dodajte vsaj en izdelek.');
      return;
    }

    if (hasMissingPrices) {
      setErrorMessage('Nekateri artikli nimajo cene. Pred oddajo uredite cenik.');
      return;
    }

    setIsSubmitting(true);

    try {
      const individualName = `${formData.firstName.trim()} ${formData.lastName.trim()}`.trim();
      const recipientName = formData.organizationName.trim() || individualName;

      const deliveryAddressLines = composeDeliveryAddressLines(formData);

      const payloadItems: CheckoutItem[] = normalizedItems.map((item) => ({
        sku: item.sku,
        name: item.name,
        unit: item.unit ?? null,
        quantity: item.quantity,
        unitPrice: item.unitPrice
      }));

      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerType: formData.customerType,
          organizationName:
            formData.customerType === 'individual' ? '' : formData.organizationName.trim(),
          deliveryAddress: deliveryAddressLines.join(', '),
          contactName: recipientName,
          email: formData.email.trim(),
          notes: formData.notes.trim(),
          items: payloadItems
        })
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || 'Oddaja naročila ni uspela.');
      }

      const payload = (await response.json()) as OrderResponse;

      setSubmittedOrder({
        customerType: formData.customerType,
        organizationName:
          formData.customerType === 'individual' ? '' : formData.organizationName.trim(),
        recipientName,
        email: formData.email.trim(),
        notes: formData.notes.trim(),
        deliveryAddressLines,
        items: payloadItems,
        subtotal,
        shipping,
        total,
        vatIncluded
      });

      setOrderResponse(payload);
      clearCart();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Napaka pri oddaji naročila.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (items.length === 0 && !orderResponse) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center">
        <p className="text-lg font-semibold text-slate-900">Košarica je prazna</p>
        <p className="mt-2 text-sm text-slate-600">Najprej dodajte izdelke iz posameznih kategorij.</p>
        <Link
          href="/products"
          className={`${buttonTokenClasses.primary} mt-4`}
        >
          Pojdi na izdelke
        </Link>
      </div>
    );
  }

  const viewItems = submittedOrder?.items ?? normalizedItems;
  const viewSubtotal = submittedOrder?.subtotal ?? subtotal;
  const viewShipping = submittedOrder?.shipping ?? shipping;
  const viewTotal = submittedOrder?.total ?? total;
  const viewVatIncluded = submittedOrder?.vatIncluded ?? vatIncluded;

  if (orderResponse && submittedOrder) {
    return (
      <div className="mx-auto max-w-4xl space-y-8">
        <header className="space-y-3">
          <h1 className="text-4xl font-semibold tracking-tight text-slate-900">Naročilo je potrjeno</h1>
          <p className="text-sm text-slate-600">
            Potrditev je bila poslana na email. Spodaj so podrobnosti naročila in povezava do PDF dokumenta.
          </p>
        </header>

        <section className="border-t border-slate-200 pt-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-900">Podrobnosti naročila</h2>

          <div className="mt-6 grid gap-8 text-sm md:grid-cols-2">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Dostava na</p>
              <p className="mt-1 font-semibold text-slate-900">{submittedOrder.recipientName}</p>
              {submittedOrder.organizationName && <p>{submittedOrder.organizationName}</p>}
              {submittedOrder.deliveryAddressLines.map((line, index) => (
                <p key={`${line}-${index}`}>{line}</p>
              ))}
            </div>

            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Email</p>
              <p className="mt-1 font-semibold text-slate-900">{submittedOrder.email}</p>

            </div>
          </div>

          {submittedOrder.notes && (
            <div className="mt-6">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Opombe</p>
              <p className="mt-1 text-sm text-slate-700">{submittedOrder.notes}</p>
            </div>
          )}

          <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">PDF dokument</p>
            <a
              href={orderResponse.documentUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-1 inline-flex text-sm font-semibold text-brand-600 hover:text-brand-700"
            >
              Odpri PDF dokument →
            </a>

            {submittedOrder.customerType === 'school' && (
              <p className="mt-2 text-sm text-slate-600">
                Če ste šola, naročilnico naložite kasneje na{' '}
                <Link href="/order/narocilnica" className="font-semibold text-brand-600 hover:text-brand-700">
                  posebni strani za naročilnice
                </Link>
                .
              </p>
            )}
          </div>
        </section>

        <section className="border-t border-slate-200 pt-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-900">Povzetek naročila</h2>

          <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-3 sm:p-4">
            <div className="space-y-3">
              {submittedOrder.items.map((item) => {
                const lineTotal = toNumber(item.unitPrice) * item.quantity;

                return (
                  <div
                    key={item.sku}
                    className="grid items-start gap-3 border-b border-slate-100 pb-3 last:border-b-0 last:pb-0 sm:grid-cols-[minmax(0,1fr)_auto]"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-900">{item.name}</p>
                      <p className="text-xs text-slate-500">Cena enote: {formatCurrency(toNumber(item.unitPrice))}</p>
                    </div>

                    <div className="text-left text-sm sm:text-right">
                      <p className="font-semibold text-slate-900">{formatCurrency(lineTotal)}</p>
                      <p className="text-slate-500">Količina: {item.quantity}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
            <div className="flex items-center justify-between">
              <span>Vmesni seštevek</span>
              <span className="font-semibold">{formatCurrency(submittedOrder.subtotal)}</span>
            </div>
            <div className="mt-1 flex items-center justify-between">
              <span>Poštnina</span>
              <span className="font-semibold">{formatCurrency(submittedOrder.shipping)}</span>
            </div>
            <div className="mt-1 flex items-center justify-between text-base font-semibold text-slate-900">
              <span>Skupaj</span>
              <span>{formatCurrency(submittedOrder.total)}</span>
            </div>
            <p className="mt-2 text-xs text-slate-500">
              Vključuje DDV (22%): {formatCurrency(submittedOrder.vatIncluded)}
            </p>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <h1 className="text-3xl font-semibold text-slate-900">Oddaja naročila</h1>
        <p className="text-slate-600">
          Izpolnite podatke in oddajte naročilo. PDF dokument bo na voljo po uspešni oddaji.
        </p>
        <p className="text-sm text-slate-600">
          Če ste šola, naročilnico naložite kasneje na{' '}
          <Link href="/order/narocilnica" className="font-semibold text-brand-600">
            posebni strani za naročilnice
          </Link>
          .
        </p>
      </header>

      <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-4">
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h2 className="text-xl font-semibold text-slate-900">Email naslov</h2>

                {emailConfirmed && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    onClick={() => setIsEmailEditing(true)}
                    className="mt-2 max-w-full justify-start truncate !px-0 text-left text-sm font-normal text-slate-700 hover:text-slate-900"
                    title="Uredi email naslov"
                  >
                    {formData.email.trim()}
                  </Button>
                )}
              </div>

              {emailConfirmed && (
                <IconButton
                  type="button"
                  onClick={() => setIsEmailEditing(true)}
                  tone="neutralStatus"
                  shape="rounded"
                  size="md"
                  aria-label="Uredi email naslov"
                  title="Uredi email naslov"
                >
                  <PencilIcon />
                </IconButton>
              )}
            </div>

            {isEmailEditing && (
              <div className="mt-4 space-y-3">
                <FloatingInput
                  id="email"
                  type="email"
                  label="Email naslov"
                  autoComplete="email"
                  value={formData.email}
                  onChange={(event) =>
                    setFormData((previous) => ({ ...previous, email: event.target.value }))
                  }
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      confirmEmailStep();
                    }
                  }}
                />

                <Button
                  type="button"
                  variant="brand"
                  onClick={confirmEmailStep}
                  disabled={!emailIsValid}
                  className="w-full"
                >
                  Nadaljuj
                </Button>
              </div>
            )}
          </section>

          <section
            className={classNames(
              'rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition',
              shippingDetailsLocked ? 'opacity-60' : 'opacity-100'
            )}
          >
            <h2 className="text-xl font-semibold text-slate-900">Podatki za dostavo</h2>

            {shippingDetailsLocked && (
              <p className="mt-2 text-xs text-slate-500">
                Najprej vnesite veljaven email naslov in ga potrdite.
              </p>
            )}

            <form
              className={classNames(
                'mt-4 grid gap-4 md:grid-cols-2',
                shippingDetailsLocked && 'pointer-events-none select-none'
              )}
              onSubmit={handleSubmit}
            >
              <div className="md:col-span-2">
                <FloatingSelect
                  id="customerType"
                  label="Tip naročnika"
                  value={formData.customerType}
                  disabled={shippingDetailsLocked}
                  onChange={(event) => {
                    setFormData((previous) => ({
                      ...previous,
                      customerType: event.target.value as CustomerType
                    }));
                  }}
                >
                  {CUSTOMER_TYPE_FORM_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </FloatingSelect>
              </div>

              {isIndividual ? (
                <>
                  <FloatingInput
                    id="firstName"
                    label="Ime *"
                    disabled={shippingDetailsLocked}
                    value={formData.firstName}
                    onChange={(event) =>
                      setFormData((previous) => ({ ...previous, firstName: event.target.value }))
                    }
                  />
                  <FloatingInput
                    id="lastName"
                    label="Priimek *"
                    disabled={shippingDetailsLocked}
                    value={formData.lastName}
                    onChange={(event) =>
                      setFormData((previous) => ({ ...previous, lastName: event.target.value }))
                    }
                  />
                </>
              ) : (
                <>
                  <div className="md:col-span-2">
                    <FloatingInput
                      id="organizationName"
                      label="Naročnik *"
                      disabled={shippingDetailsLocked}
                      value={formData.organizationName}
                      onChange={(event) =>
                        setFormData((previous) => ({
                          ...previous,
                          organizationName: event.target.value
                        }))
                      }
                    />
                  </div>
                </>
              )}

              <div className="md:col-span-2">
                <FloatingInput
                  id="addressLine1"
                  label="Naslov *"
                  disabled={shippingDetailsLocked}
                  autoComplete="street-address"
                  value={formData.addressLine1}
                  onChange={(event) =>
                    setFormData((previous) => ({
                      ...previous,
                      addressLine1: event.target.value
                    }))
                  }
                />

                {!shippingDetailsLocked && addressSuggestions.length > 0 && (
                  <ul className="mt-2 space-y-1 rounded-lg border border-slate-200 bg-white p-2 text-sm shadow-sm">
                    {addressSuggestions.map((address) => (
                      <li key={address}>
                        <button
                          type="button"
                          onClick={() =>
                            setFormData((previous) => ({ ...previous, addressLine1: address }))
                          }
                          className="w-full text-left text-slate-600 hover:text-brand-600"
                        >
                          {address}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="md:col-span-2 grid gap-4 md:grid-cols-[minmax(0,1fr)_11rem]">
                <FloatingInput
                  id="city"
                  label="Kraj *"
                  disabled={shippingDetailsLocked}
                  value={formData.city}
                  onChange={(event) =>
                    setFormData((previous) => ({ ...previous, city: event.target.value }))
                  }
                />

                <FloatingInput
                  id="postalCode"
                  label="Poštna številka *"
                  disabled={shippingDetailsLocked}
                  value={formData.postalCode}
                  onChange={(event) =>
                    setFormData((previous) => ({ ...previous, postalCode: event.target.value }))
                  }
                />
              </div>


              <div className="md:col-span-2">
                <FloatingTextarea
                  id="notes"
                  label="Opombe"
                  disabled={shippingDetailsLocked}
                  rows={3}
                  value={formData.notes}
                  onChange={(event) =>
                    setFormData((previous) => ({ ...previous, notes: event.target.value }))
                  }
                />
              </div>

              <button type="submit" className="hidden" />
            </form>
          </section>
        </div>

        <div className="commercial-order-sidebar space-y-6">
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_14px_34px_rgba(15,23,42,0.07),0_2px_6px_rgba(15,23,42,0.03)]">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h2 className="text-[20px] font-semibold leading-tight tracking-tight text-slate-950">
                  Povzetek košarice
                </h2>
                <p className="mt-1 text-[12px] font-medium leading-4 text-slate-500">
                  Artikli: {viewItems.length}
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="xs"
                onClick={clearCart}
                className="h-7 shrink-0 px-2 text-[12px] font-semibold text-slate-500 hover:text-slate-900"
              >
                Ponastavi
              </Button>
            </div>

            <div className="mt-4">
              <h3 className="text-[12px] font-semibold leading-4 text-slate-950">Izdelki v naročilu</h3>
              <div className="mt-2 divide-y divide-slate-200/90">
                {viewItems.length > 0 ? (
                  viewItems.map((item) => {
                    const lineTotal = toNumber(item.unitPrice) * item.quantity;

                    return (
                      <div key={item.sku} className="py-3 first:pt-0 last:pb-0">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="min-w-0 text-[12px] font-semibold leading-4 text-slate-950">
                              {item.name}
                            </p>
                            <p className="mt-0.5 text-[12px] font-medium leading-4 text-slate-500">
                              Cena enote: {formatCurrency(toNumber(item.unitPrice))}
                            </p>
                          </div>

                          <p className="shrink-0 text-right text-[13px] font-semibold leading-5 text-slate-950 tabular-nums">
                            {formatCurrency(lineTotal)}
                          </p>
                        </div>

                        <div className="mt-2 flex items-center justify-between gap-3">
                          <div className="flex min-w-0 items-center gap-2">
                            <span className="shrink-0 text-[12px] font-medium leading-4 text-slate-500">
                              Količina
                            </span>
                            <div className="flex items-center gap-2">
                              <IconButton
                                type="button"
                                onClick={() => setQuantity(item.sku, item.quantity - 1)}
                                shape="square"
                                size="sm"
                                className="text-sm font-semibold"
                                aria-label={`Zmanjšaj količino za ${item.name}`}
                              >
                                −
                              </IconButton>
                              <QuantityInput
                                min={1}
                                value={item.quantity}
                                onChange={(event) => {
                                  const next = Number.parseInt(event.target.value, 10);
                                  setQuantity(item.sku, Number.isNaN(next) ? item.quantity : next);
                                }}
                                aria-label={`Količina za ${item.name}`}
                              />
                              <IconButton
                                type="button"
                                onClick={() => setQuantity(item.sku, item.quantity + 1)}
                                shape="square"
                                size="sm"
                                className="text-sm font-semibold"
                                aria-label={`Povečaj količino za ${item.name}`}
                              >
                                +
                              </IconButton>
                            </div>
                          </div>

                          <IconButton
                            type="button"
                            onClick={() => removeItem(item.sku)}
                            tone="danger"
                            shape="square"
                            size="sm"
                            className="shrink-0"
                            aria-label={`Odstrani ${item.name}`}
                            title="Odstrani"
                          >
                            <CloseIcon className="h-3.5 w-3.5" />
                          </IconButton>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <p className="py-6 text-center text-[13px] font-medium text-slate-500">
                    Košarica je prazna.
                  </p>
                )}
              </div>
            </div>

            <div className="mt-4 border-t border-slate-200/90 pt-3">
              <h3 className="text-[12px] font-semibold leading-4 text-slate-950">Izračun</h3>
              <div className="mt-1.5 space-y-1">
                <div className="flex items-center justify-between gap-4 text-[12px] font-medium leading-4 text-slate-700">
                  <span>Vmesni seštevek</span>
                  <span className="shrink-0 text-right font-semibold tabular-nums">{formatCurrency(viewSubtotal)}</span>
                </div>
                <div className="flex items-center justify-between gap-4 text-[12px] font-medium leading-4 text-slate-700">
                  <span>Poštnina</span>
                  <span className="shrink-0 text-right font-semibold tabular-nums">{formatCurrency(viewShipping)}</span>
                </div>
                <div className="flex items-center justify-between gap-4 text-[12px] font-medium leading-4 text-slate-700">
                  <span>DDV</span>
                  <span className="shrink-0 text-right font-semibold tabular-nums">
                    {formatCurrency(viewVatIncluded)}
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-3 flex items-center justify-between gap-4 border-t border-slate-200/90 pt-3">
              <p className="min-w-0 text-left text-[15px] font-semibold leading-5 text-[#1982bf]">Skupaj z DDV</p>
              <p className="shrink-0 text-right text-[18px] font-semibold leading-6 text-[#1982bf] tabular-nums">
                {formatCurrency(viewTotal)}
              </p>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-slate-900">Oddaja naročila</h2>
            <p className="mt-2 text-sm text-slate-600">
              Po oddaji naročila pripravimo PDF predračuna (za podjetja in fizične osebe) oziroma
              ponudbe (za šole).
            </p>

            <div className="mt-4 flex flex-col gap-3">
              <Button
                type="button"
                variant="brand"
                disabled={!canSubmit}
                onClick={() => handleSubmit()}
                className="w-full"
              >
                {isSubmitting ? <span className="inline-flex items-center gap-2"><Spinner size="sm" className="text-white" />Oddajanje...</span> : 'Oddaj naročilo'}
              </Button>

              {errorMessage && <p className="text-sm text-red-600">{errorMessage}</p>}

              {!errorMessage && !requiredFieldsFilled && (
                <p className="text-xs text-slate-500">
                  Za oddajo izpolnite obvezna polja in dodajte vsaj en izdelek.
                </p>
              )}

              {!errorMessage && hasMissingPrices && (
                <p className="text-xs text-amber-700">
                  Nekateri artikli nimajo cene. Oddaja je onemogočena, dokler ni cenik urejen.
                </p>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
