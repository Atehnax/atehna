'use client';

import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type InputHTMLAttributes,
  type TextareaHTMLAttributes,
  type SelectHTMLAttributes,
  type ReactNode
} from 'react';
import Link from 'next/link';
import { useCartStore } from '@/lib/cart/store';
import { SLOVENIAN_ADDRESSES } from '@/data/slovenianAddresses';

const FORM_STORAGE_KEY = 'atehna-order-form';

const customerTypeOptions = [
  { value: 'individual', label: 'Fizična oseba' },
  { value: 'company', label: 'Podjetje' },
  { value: 'school', label: 'Šola / javni zavod' }
] as const;

type CustomerType = (typeof customerTypeOptions)[number]['value'];

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
  organizationContactName: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  postalCode: string;
  email: string;
  phone: string;
  reference: string;
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
  phone: string;
  reference: string;
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
  organizationContactName: '',
  addressLine1: '',
  addressLine2: '',
  city: '',
  postalCode: '',
  email: '',
  phone: '',
  reference: '',
  notes: ''
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('sl-SI', { style: 'currency', currency: 'EUR' }).format(value);

const toNumber = (value: unknown) =>
  typeof value === 'number' && Number.isFinite(value) ? value : 0;

const extractVatIncluded = (grossAmount: number, vatRate = 0.22) =>
  grossAmount - grossAmount / (1 + vatRate);

const composeDeliveryAddressLines = (formData: OrderFormData) => {
  const cityLine = `${formData.postalCode.trim()} ${formData.city.trim()}`.trim();
  return [formData.addressLine1.trim(), formData.addressLine2.trim(), cityLine].filter(Boolean);
};

const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

type FloatingInputProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
};

function FloatingInput({ label, className = '', ...props }: FloatingInputProps) {
  return (
    <div className="relative">
      <input
        {...props}
        placeholder=" "
        className={`peer h-14 w-full rounded-lg border border-slate-300 bg-white px-3 pb-2 pt-6 text-sm text-slate-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400 ${className}`}
      />
      <label
        htmlFor={props.id}
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-500 transition-all duration-150 peer-focus:top-2 peer-focus:translate-y-0 peer-focus:text-[11px] peer-[:not(:placeholder-shown)]:top-2 peer-[:not(:placeholder-shown)]:translate-y-0 peer-[:not(:placeholder-shown)]:text-[11px]"
      >
        {label}
      </label>
    </div>
  );
}

type FloatingTextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label: string;
};

function FloatingTextarea({ label, className = '', ...props }: FloatingTextareaProps) {
  return (
    <div className="relative">
      <textarea
        {...props}
        placeholder=" "
        className={`peer min-h-[110px] w-full rounded-lg border border-slate-300 bg-white px-3 pb-2 pt-6 text-sm text-slate-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400 ${className}`}
      />
      <label
        htmlFor={props.id}
        className="pointer-events-none absolute left-3 top-5 -translate-y-1/2 text-sm text-slate-500 transition-all duration-150 peer-focus:top-2 peer-focus:translate-y-0 peer-focus:text-[11px] peer-[:not(:placeholder-shown)]:top-2 peer-[:not(:placeholder-shown)]:translate-y-0 peer-[:not(:placeholder-shown)]:text-[11px]"
      >
        {label}
      </label>
    </div>
  );
}

type FloatingSelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  label: string;
  children: ReactNode;
};

function FloatingSelect({ label, className = '', children, ...props }: FloatingSelectProps) {
  return (
    <div className="relative">
      <select
        {...props}
        className={`peer h-14 w-full appearance-none rounded-lg border border-slate-300 bg-white px-3 pb-2 pt-6 text-sm text-slate-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400 ${className}`}
      >
        {children}
      </select>
      <label
        htmlFor={props.id}
        className="pointer-events-none absolute left-3 top-2 text-[11px] text-slate-500"
      >
        {label}
      </label>
      <svg
        viewBox="0 0 20 20"
        className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      >
        <path d="M5 7.5l5 5 5-5" />
      </svg>
    </div>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path d="M5 10.5l3 3 7-7" />
    </svg>
  );
}

function PencilIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.9">
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

  // email step state
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
      items.some(
        (item) => typeof item.unitPrice !== 'number' || !Number.isFinite(item.unitPrice)
      ),
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

    return Boolean(formData.organizationName.trim() && formData.organizationContactName.trim());
  }, [
    emailIsValid,
    formData.addressLine1,
    formData.city,
    formData.customerType,
    formData.firstName,
    formData.lastName,
    formData.organizationContactName,
    formData.organizationName,
    formData.postalCode,
    items.length
  ]);

  const canSubmit = requiredFieldsFilled && !hasMissingPrices && !isSubmitting;

  const addressSuggestions = useMemo(() => {
    const query = formData.addressLine1.trim().toLowerCase();
    if (!query || shippingDetailsLocked) return [];

    return SLOVENIAN_ADDRESSES.filter((address) =>
      address.toLowerCase().includes(query)
    ).slice(0, 7);
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
      const recipientName =
        formData.customerType === 'individual'
          ? `${formData.firstName.trim()} ${formData.lastName.trim()}`.trim()
          : formData.organizationContactName.trim();

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
          phone: formData.phone.trim(),
          reference: formData.reference.trim(),
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
        phone: formData.phone.trim(),
        reference: formData.reference.trim(),
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
          className="mt-4 inline-flex rounded-full bg-brand-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700"
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

  return (
    <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr]">
      <div className="space-y-8">
        {orderResponse && submittedOrder ? (
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-slate-900">Podrobnosti naročila</h2>
            <p className="mt-2 text-sm text-slate-600">Naročilo je uspešno oddano.</p>

            <div className="mt-5 grid gap-5 text-sm text-slate-700 md:grid-cols-2">
              <div>
                <p className="text-xs font-medium text-slate-400">Dostava na</p>
                <p className="font-semibold text-slate-900">{submittedOrder.recipientName}</p>
                {submittedOrder.organizationName && <p>{submittedOrder.organizationName}</p>}
                {submittedOrder.deliveryAddressLines.map((line, index) => (
                  <p key={`${line}-${index}`}>{line}</p>
                ))}
              </div>
              <div>
                <p className="text-xs font-medium text-slate-400">Kontakt</p>
                <p>{submittedOrder.email}</p>
                {submittedOrder.phone && <p>{submittedOrder.phone}</p>}
                {submittedOrder.reference && (
                  <p className="mt-2">
                    <span className="text-slate-500">Sklic: </span>
                    {submittedOrder.reference}
                  </p>
                )}
              </div>
              {submittedOrder.notes && (
                <div className="md:col-span-2">
                  <p className="text-xs font-medium text-slate-400">Opombe</p>
                  <p>{submittedOrder.notes}</p>
                </div>
              )}
            </div>
          </section>
        ) : (
          <div className="space-y-4">
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold text-slate-900">Email naslov</h2>
                  {emailConfirmed && <p className="mt-2 text-sm text-slate-700">{formData.email.trim()}</p>}
                </div>

                {emailConfirmed ? (
                  <button
                    type="button"
                    onClick={() => setIsEmailEditing(true)}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-300 text-slate-700 transition hover:border-slate-400 hover:text-slate-900"
                    aria-label="Uredi email naslov"
                    title="Uredi email naslov"
                  >
                    <PencilIcon />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={confirmEmailStep}
                    disabled={!emailIsValid}
                    className={`inline-flex h-9 w-9 items-center justify-center rounded-full transition ${
                      emailIsValid
                        ? 'bg-black text-white hover:opacity-90'
                        : 'cursor-not-allowed border border-slate-300 text-slate-300'
                    }`}
                    aria-label="Potrdi email naslov"
                    title="Potrdi email naslov"
                  >
                    <CheckIcon />
                  </button>
                )}
              </div>

              {isEmailEditing && (
                <div className="mt-4">
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
                </div>
              )}
            </section>

            <section
              className={`rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition ${
                shippingDetailsLocked ? 'opacity-60' : 'opacity-100'
              }`}
            >
              <h2 className="text-xl font-semibold text-slate-900">Podatki za dostavo</h2>
              {shippingDetailsLocked && (
                <p className="mt-2 text-xs text-slate-500">
                  Najprej vnesite veljaven email naslov in ga potrdite.
                </p>
              )}

              <form
                className={`mt-4 grid gap-4 md:grid-cols-2 ${
                  shippingDetailsLocked ? 'pointer-events-none select-none' : ''
                }`}
                onSubmit={handleSubmit}
              >
                <div className="md:col-span-2">
                  <FloatingSelect
                    id="customerType"
                    label="Tip naročnika"
                    disabled={shippingDetailsLocked}
                    value={formData.customerType}
                    onChange={(event) =>
                      setFormData((previous) => ({
                        ...previous,
                        customerType: event.target.value as CustomerType
                      }))
                    }
                  >
                    {customerTypeOptions.map((option) => (
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
                        label="Naziv organizacije *"
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
                    <div className="md:col-span-2">
                      <FloatingInput
                        id="organizationContactName"
                        label="Kontaktna oseba *"
                        disabled={shippingDetailsLocked}
                        value={formData.organizationContactName}
                        onChange={(event) =>
                          setFormData((previous) => ({
                            ...previous,
                            organizationContactName: event.target.value
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

                <div className="md:col-span-2">
                  <FloatingInput
                    id="addressLine2"
                    label="Stanovanje, nadstropje, enota"
                    disabled={shippingDetailsLocked}
                    value={formData.addressLine2}
                    onChange={(event) =>
                      setFormData((previous) => ({
                        ...previous,
                        addressLine2: event.target.value
                      }))
                    }
                  />
                </div>

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

                <FloatingInput
                  id="phone"
                  label="Telefon"
                  disabled={shippingDetailsLocked}
                  autoComplete="tel"
                  value={formData.phone}
                  onChange={(event) =>
                    setFormData((previous) => ({ ...previous, phone: event.target.value }))
                  }
                />

                <div className="md:col-span-2">
                  <FloatingInput
                    id="reference"
                    label="Sklic / št. naročila"
                    disabled={shippingDetailsLocked}
                    value={formData.reference}
                    onChange={(event) =>
                      setFormData((previous) => ({ ...previous, reference: event.target.value }))
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
        )}

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-slate-900">
              {orderResponse ? 'Povzetek naročila' : 'Povzetek košarice'}
            </h2>
            {!orderResponse && (
              <button
                type="button"
                onClick={clearCart}
                className="text-xs font-semibold text-slate-400 hover:text-slate-600"
              >
                Počisti
              </button>
            )}
          </div>

          <div className="mt-4 space-y-4">
            {viewItems.map((item) => {
              const lineTotal = toNumber(item.unitPrice) * item.quantity;

              return (
                <div key={item.sku} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  {orderResponse ? (
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{item.name}</p>
                        <p className="text-xs text-slate-500">
                          Cena enote: {formatCurrency(toNumber(item.unitPrice))}
                        </p>
                      </div>
                      <div className="text-right text-sm">
                        <p className="text-slate-600">Količina: {item.quantity}</p>
                        <p className="font-semibold text-slate-900">{formatCurrency(lineTotal)}</p>
                      </div>
                    </div>
                  ) : (
                    <div className="grid items-center gap-3 sm:grid-cols-[minmax(0,1fr)_auto_auto_auto]">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900">{item.name}</p>
                        <p className="text-xs text-slate-500">
                          Cena enote: {formatCurrency(toNumber(item.unitPrice))}
                        </p>
                      </div>

                      <div className="flex items-center justify-center gap-3 sm:justify-self-center">
                        <button
                          type="button"
                          onClick={() => setQuantity(item.sku, item.quantity - 1)}
                          className="h-8 w-8 rounded-full border border-slate-200 text-sm font-semibold text-slate-600"
                          aria-label={`Zmanjšaj količino za ${item.name}`}
                        >
                          −
                        </button>
                        <span className="min-w-[1.5rem] text-center text-sm font-semibold text-slate-700">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => setQuantity(item.sku, item.quantity + 1)}
                          className="h-8 w-8 rounded-full border border-slate-200 text-sm font-semibold text-slate-600"
                          aria-label={`Povečaj količino za ${item.name}`}
                        >
                          +
                        </button>
                      </div>

                      <div className="justify-self-end text-right text-sm font-semibold text-slate-900 tabular-nums">
                        {formatCurrency(lineTotal)}
                      </div>

                      <button
                        type="button"
                        onClick={() => removeItem(item.sku)}
                        className="h-8 w-8 justify-self-end rounded-full border border-slate-200 text-lg leading-none text-slate-500 hover:text-slate-700"
                        aria-label={`Odstrani ${item.name}`}
                      >
                        ×
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="mt-6 rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
            <div className="flex items-center justify-between">
              <span>Vmesni seštevek</span>
              <span className="font-semibold">{formatCurrency(viewSubtotal)}</span>
            </div>
            <div className="mt-1 flex items-center justify-between">
              <span>Poštnina</span>
              <span className="font-semibold">{formatCurrency(viewShipping)}</span>
            </div>
            <div className="mt-1 flex items-center justify-between text-base font-semibold text-slate-900">
              <span>Skupaj</span>
              <span>{formatCurrency(viewTotal)}</span>
            </div>
            <p className="mt-2 text-xs text-slate-500">
              Vključuje DDV (22%): {formatCurrency(viewVatIncluded)}
            </p>
          </div>
        </section>
      </div>

      <div className="space-y-6">
        {!orderResponse && (
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-slate-900">Oddaja naročila</h2>
            <p className="mt-2 text-sm text-slate-600">
              Po oddaji naročila pripravimo PDF predračuna (za podjetja in fizične osebe) oziroma
              ponudbe (za šole).
            </p>

            <div className="mt-4 flex flex-col gap-3">
              <button
                type="button"
                disabled={!canSubmit}
                onClick={() => handleSubmit()}
                className={`rounded-full px-4 py-2 text-sm font-semibold shadow-sm transition ${
                  !canSubmit
                    ? 'cursor-not-allowed bg-slate-200 text-slate-400'
                    : 'bg-brand-600 text-white hover:bg-brand-700'
                }`}
              >
                {isSubmitting ? 'Oddajanje...' : 'Oddaj naročilo'}
              </button>

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
        )}

        {orderResponse && (
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-slate-900">PDF dokument</h2>

            <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
              <iframe title="Predogled PDF" src={orderResponse.documentUrl} className="h-[420px] w-full" />
            </div>

            <a
              href={orderResponse.documentUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-flex text-sm font-semibold text-brand-600 hover:text-brand-700"
            >
              Odpri PDF v novem zavihku →
            </a>

            {submittedOrder?.customerType === 'school' && (
              <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">
                Naročilnico lahko naložite kasneje na strani{' '}
                <Link href="/order/narocilnica" className="font-semibold text-amber-900">
                  Naloži naročilnico
                </Link>
                .
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
