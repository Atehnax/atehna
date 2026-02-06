'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
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

type OrderFormData = {
  customerType: CustomerType;
  organizationName: string;
  deliveryAddress: string;
  contactName: string;
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

const initialForm: OrderFormData = {
  customerType: 'school',
  organizationName: '',
  deliveryAddress: '',
  contactName: '',
  email: '',
  phone: '',
  reference: '',
  notes: ''
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('sl-SI', { style: 'currency', currency: 'EUR' }).format(value);

const getPriceLabel = (value?: number | null) =>
  typeof value === 'number' ? formatCurrency(value) : 'Po dogovoru';

export default function OrderPageClient() {
  const items = useCartStore((state) => state.items);
  const setQuantity = useCartStore((state) => state.setQuantity);
  const removeItem = useCartStore((state) => state.removeItem);
  const clearCart = useCartStore((state) => state.clearCart);
  const [formData, setFormData] = useState<OrderFormData>(initialForm);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderResponse, setOrderResponse] = useState<OrderResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const pricedItems = useMemo(
    () => items.filter((item) => typeof item.unitPrice === 'number'),
    [items]
  );
  const subtotal = useMemo(
    () =>
      pricedItems.reduce(
        (sum, item) => sum + (item.unitPrice ?? 0) * item.quantity,
        0
      ),
    [pricedItems]
  );
  const tax = subtotal * 0.22;
  const total = subtotal + tax;
  const hasAnyPricing = pricedItems.length > 0;
  const hasCompletePricing = items.length > 0 && pricedItems.length === items.length;

  useEffect(() => {
    const saved = localStorage.getItem(FORM_STORAGE_KEY);
    if (!saved) return;
    try {
      const parsed = JSON.parse(saved) as OrderFormData;
      setFormData({ ...initialForm, ...parsed });
    } catch {
      localStorage.removeItem(FORM_STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(FORM_STORAGE_KEY, JSON.stringify(formData));
  }, [formData]);

  const requiredFieldsFilled = useMemo(() => {
    const hasContact = formData.contactName.trim() && formData.email.trim();
    const hasOrg =
      formData.customerType === 'individual' || formData.organizationName.trim();
    return Boolean(hasContact && hasOrg && items.length > 0);
  }, [formData, items.length]);

  const addressSuggestions = useMemo(() => {
    const query = formData.deliveryAddress.trim().toLowerCase();
    if (!query) return [];
    return SLOVENIAN_ADDRESSES.filter((address) =>
      address.toLowerCase().includes(query)
    ).slice(0, 7);
  }, [formData.deliveryAddress]);

  const handleSubmit = async (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
    setErrorMessage(null);
    if (!requiredFieldsFilled) {
      setErrorMessage('Izpolnite obvezna polja in dodajte vsaj en izdelek.');
      return;
    }
    setIsSubmitting(true);
    try {
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerType: formData.customerType,
          organizationName: formData.organizationName,
          deliveryAddress: formData.deliveryAddress,
          contactName: formData.contactName,
          email: formData.email,
          phone: formData.phone,
          reference: formData.reference,
          notes: formData.notes,
          items
        })
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || 'Oddaja naročila ni uspela.');
      }

      const payload = (await response.json()) as OrderResponse;
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
        <p className="mt-2 text-sm text-slate-600">
          Najprej dodajte izdelke iz posameznih kategorij.
        </p>
        <Link
          href="/products"
          className="mt-4 inline-flex rounded-full bg-brand-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700"
        >
          Pojdi na izdelke
        </Link>
      </div>
    );
  }

  return (
    <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr]">
      <div className="space-y-8">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-slate-900">Podatki o naročilu</h2>
          <form className="mt-4 grid gap-4 md:grid-cols-2" onSubmit={handleSubmit}>
            <div className="md:col-span-2">
              <label className="text-sm font-medium text-slate-700" htmlFor="customerType">
                Tip naročnika
              </label>
              <select
                id="customerType"
                value={formData.customerType}
                onChange={(event) =>
                  setFormData((prev) => ({
                    ...prev,
                    customerType: event.target.value as CustomerType
                  }))
                }
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                {customerTypeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            {formData.customerType !== 'individual' && (
              <div className="md:col-span-2">
                <label className="text-sm font-medium text-slate-700" htmlFor="organizationName">
                  Naziv organizacije <span className="text-brand-600">*</span>
                </label>
                <input
                  id="organizationName"
                  value={formData.organizationName}
                  onChange={(event) =>
                    setFormData((prev) => ({ ...prev, organizationName: event.target.value }))
                  }
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
            )}
            <div className="md:col-span-2">
              <label className="text-sm font-medium text-slate-700" htmlFor="deliveryAddress">
                Naslov dostave
              </label>
              <input
                id="deliveryAddress"
                value={formData.deliveryAddress}
                onChange={(event) =>
                  setFormData((prev) => ({ ...prev, deliveryAddress: event.target.value }))
                }
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
              {addressSuggestions.length > 0 && (
                <ul className="mt-2 space-y-1 rounded-lg border border-slate-200 bg-white p-2 text-sm shadow-sm">
                  {addressSuggestions.map((address) => (
                    <li key={address}>
                      <button
                        type="button"
                        onClick={() =>
                          setFormData((prev) => ({ ...prev, deliveryAddress: address }))
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
            <div>
              <label className="text-sm font-medium text-slate-700" htmlFor="contactName">
                Kontaktna oseba <span className="text-brand-600">*</span>
              </label>
              <input
                id="contactName"
                value={formData.contactName}
                onChange={(event) =>
                  setFormData((prev) => ({ ...prev, contactName: event.target.value }))
                }
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700" htmlFor="email">
                Email <span className="text-brand-600">*</span>
              </label>
              <input
                id="email"
                type="email"
                value={formData.email}
                onChange={(event) =>
                  setFormData((prev) => ({ ...prev, email: event.target.value }))
                }
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700" htmlFor="phone">
                Telefon
              </label>
              <input
                id="phone"
                value={formData.phone}
                onChange={(event) => setFormData((prev) => ({ ...prev, phone: event.target.value }))}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700" htmlFor="reference">
                Sklic / št. naročila
              </label>
              <input
                id="reference"
                value={formData.reference}
                onChange={(event) =>
                  setFormData((prev) => ({ ...prev, reference: event.target.value }))
                }
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div className="md:col-span-2">
              <label className="text-sm font-medium text-slate-700" htmlFor="notes">
                Opombe
              </label>
              <textarea
                id="notes"
                value={formData.notes}
                onChange={(event) => setFormData((prev) => ({ ...prev, notes: event.target.value }))}
                rows={3}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <button type="submit" className="hidden" />
          </form>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-slate-900">Povzetek košarice</h2>
            <button
              type="button"
              onClick={clearCart}
              className="text-xs font-semibold text-slate-400 hover:text-slate-600"
            >
              Počisti
            </button>
          </div>
          <div className="mt-4 space-y-4">
            {items.map((item) => (
              <div
                key={item.sku}
                className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="text-sm font-semibold text-slate-900">{item.name}</p>
                  <p className="text-xs text-slate-500">SKU: {item.sku}</p>
                  <p className="text-xs text-slate-500">
                    Cena enote: {getPriceLabel(item.unitPrice)}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setQuantity(item.sku, item.quantity - 1)}
                    className="h-8 w-8 rounded-full border border-slate-200 text-sm font-semibold text-slate-600"
                  >
                    −
                  </button>
                  <span className="min-w-[2rem] text-center text-sm font-semibold text-slate-700">
                    {item.quantity}
                  </span>
                  <button
                    type="button"
                    onClick={() => setQuantity(item.sku, item.quantity + 1)}
                    className="h-8 w-8 rounded-full border border-slate-200 text-sm font-semibold text-slate-600"
                  >
                    +
                  </button>
                  <span className="text-xs font-semibold text-slate-700">
                    Skupaj:{' '}
                    {getPriceLabel(
                      typeof item.unitPrice === 'number'
                        ? item.unitPrice * item.quantity
                        : null
                    )}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeItem(item.sku)}
                    className="text-xs font-semibold text-slate-400 hover:text-slate-600"
                  >
                    Odstrani
                  </button>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-6 rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
            <div className="flex items-center justify-between">
              <span>Vmesni seštevek</span>
              <span className="font-semibold">
                {hasAnyPricing ? formatCurrency(subtotal) : 'Po dogovoru'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>DDV (22%)</span>
              <span className="font-semibold">
                {hasAnyPricing ? formatCurrency(tax) : 'Po dogovoru'}
              </span>
            </div>
            <div className="flex items-center justify-between text-base font-semibold text-slate-900">
              <span>Skupaj</span>
              <span>{hasAnyPricing ? formatCurrency(total) : 'Po dogovoru'}</span>
            </div>
            {!hasCompletePricing && (
              <p className="mt-2 text-xs text-slate-500">
                Cena za nekatere artikle bo določena ob potrditvi naročila.
              </p>
            )}
          </div>
        </section>
      </div>

      <div className="space-y-6">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-slate-900">Oddaja naročila</h2>
          <p className="mt-2 text-sm text-slate-600">
            Po oddaji naročila pripravimo PDF predračuna (za podjetja in fizične osebe) oziroma
            ponudbe (za šole).
          </p>
          <div className="mt-4 flex flex-col gap-3">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => handleSubmit()}
              className={`rounded-full px-4 py-2 text-sm font-semibold shadow-sm transition ${
                isSubmitting
                  ? 'cursor-wait bg-slate-200 text-slate-400'
                  : 'bg-brand-600 text-white hover:bg-brand-700'
              }`}
            >
              {isSubmitting ? 'Oddajanje...' : 'Oddaj naročilo'}
            </button>
            {errorMessage && <p className="text-sm text-red-600">{errorMessage}</p>}
            {!requiredFieldsFilled && !errorMessage && (
              <p className="text-xs text-slate-500">
                Za oddajo izpolnite obvezna polja in dodajte vsaj en izdelek.
              </p>
            )}
          </div>
        </section>

        {orderResponse && (
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-slate-900">PDF dokument</h2>
            <p className="mt-2 text-sm text-slate-600">
              Št. naročila: <span className="font-semibold">{orderResponse.orderNumber}</span>
            </p>
            <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
              <iframe
                title="Predogled PDF"
                src={orderResponse.documentUrl}
                className="h-[420px] w-full"
              />
            </div>
            <a
              href={orderResponse.documentUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-flex text-sm font-semibold text-brand-600 hover:text-brand-700"
            >
              Odpri PDF v novem zavihku →
            </a>
            {formData.customerType === 'school' && (
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
