'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useCartStore } from '@/lib/cart/store';

type BuyerType = 'individual' | 'company' | 'school';

type OrderFormData = {
  buyerType: BuyerType;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  street: string;
  postalCode: string;
  city: string;
  notes: string;
  companyName: string;
  taxIdOrVatId: string;
  institutionName: string;
};

type OrderResponse = {
  orderId: string;
  orderNumber: string;
  buyerType: BuyerType;
  status: string;
  documentUrl: string;
};

const initialForm: OrderFormData = {
  firstName: '',
  lastName: '',
  address: '',
  postalCode: '',
  city: '',
  companyInvoice: false,
  companyName: '',
  companyTaxId: '',
  email: '',
  phone: '',
  notes: '',
  paymentMethod: ''
};

export default function OrderPageClient() {
  const items = useCartStore((state) => state.items);
  const setQuantity = useCartStore((state) => state.setQuantity);
  const removeItem = useCartStore((state) => state.removeItem);
  const clearCart = useCartStore((state) => state.clearCart);
  const [formData, setFormData] = useState<OrderFormData>(initialForm);
  const [orderResponse, setOrderResponse] = useState<OrderResponse | null>(null);
  const [submittedItems, setSubmittedItems] = useState(items);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const createdAt = useMemo(() => new Date().toLocaleDateString('sl-SI'), []);
  const formatter = useMemo(
    () => new Intl.NumberFormat('sl-SI', { style: 'currency', currency: 'EUR' }),
    []
  );
  const subtotal = useMemo(
    () => items.reduce((sum, item) => sum + (item.price ?? 0) * item.quantity, 0),
    [items]
  );
  const vatRate = 0.22;
  const vatAmount = subtotal * vatRate;
  const totalAmount = subtotal + vatAmount;

  const requiredFieldsFilled =
    formData.firstName.trim() &&
    formData.lastName.trim() &&
    formData.email.trim() &&
    formData.address.trim() &&
    formData.postalCode.trim() &&
    formData.city.trim();

  const canSubmit =
    items.length > 0 &&
    hasPrices &&
    Boolean(requiredFieldsFilled && companyRequired && institutionRequired);

  const handleSubmit = async () => {
    if (!canSubmit || isSubmitting) return;
    setError(null);
    setIsSubmitting(true);

    try {
      if (!hasPrices) {
        setError('V košarici manjkajo cene.');
        return;
      }
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          buyerType: formData.buyerType,
          firstName: formData.firstName,
          lastName: formData.lastName,
          email: formData.email,
          phone: formData.phone,
          street: formData.street,
          postalCode: formData.postalCode,
          city: formData.city,
          notes: formData.notes,
          companyName: formData.companyName,
          taxIdOrVatId: formData.taxIdOrVatId,
          institutionName: formData.institutionName,
          items: items.map((item) => ({
            sku: item.sku,
            name: item.name,
            quantity: item.quantity,
            unitPrice: item.price ?? 0
          }))
        })
      });

      if (!response.ok) {
        const payload = await response.json();
        setError(payload.error ?? 'Naročila ni bilo mogoče oddati.');
        return;
      }

      const payload = (await response.json()) as OrderResponse;
      setSubmittedItems(items);
      setOrderResponse(payload);
      clearCart();
    } catch (err) {
      setError('Naročila ni bilo mogoče oddati.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUploadPurchaseOrder = async (file: File) => {
    if (!orderResponse) return;
    setUploadError(null);
    setUploading(true);
    const form = new FormData();
    form.append('file', file);

    try {
      const response = await fetch(`/api/orders/${orderResponse.orderId}/purchase-order`, {
        method: 'POST',
        body: form
      });
      if (!response.ok) {
        const payload = await response.json();
        setUploadError(payload.error ?? 'Nalaganje ni uspelo.');
        return;
      }
    } catch (err) {
      setUploadError('Nalaganje ni uspelo.');
    } finally {
      setUploading(false);
    }
    const subject = `Naročilo – ${formData.firstName} ${formData.lastName}`;
    const body = `Pozdravljeni,\n\npošiljamo naročilo v priponki (PDF).\n\nLep pozdrav,\n${formData.firstName} ${formData.lastName}`;
    return `mailto:${COMPANY_INFO.orderEmail}?subject=${encodeURIComponent(
      subject
    )}&body=${encodeURIComponent(body)}`;
  }, [formData, requiredFieldsFilled]);

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
    <div className="grid gap-10 lg:grid-cols-[1.2fr_0.8fr_0.8fr]">
      <div className="space-y-8">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-slate-900">Podatki o naročilu</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-sm font-medium text-slate-700" htmlFor="firstName">
                Ime <span className="text-brand-600">*</span>
              </label>
              <input
                id="firstName"
                value={formData.firstName}
                onChange={(event) =>
                  setFormData((prev) => ({ ...prev, firstName: event.target.value }))
                }
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700" htmlFor="lastName">
                Priimek <span className="text-brand-600">*</span>
              </label>
              <input
                id="lastName"
                value={formData.lastName}
                onChange={(event) =>
                  setFormData((prev) => ({ ...prev, lastName: event.target.value }))
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
            <div className="md:col-span-2">
              <label className="text-sm font-medium text-slate-700" htmlFor="address">
                Naslov <span className="text-brand-600">*</span>
              </label>
              <input
                id="address"
                value={formData.address}
                onChange={(event) =>
                  setFormData((prev) => ({ ...prev, address: event.target.value }))
                }
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700" htmlFor="postalCode">
                Poštna številka <span className="text-brand-600">*</span>
              </label>
              <input
                id="postalCode"
                value={formData.postalCode}
                onChange={(event) =>
                  setFormData((prev) => ({ ...prev, postalCode: event.target.value }))
                }
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700" htmlFor="city">
                Kraj <span className="text-brand-600">*</span>
              </label>
              <input
                id="city"
                value={formData.city}
                onChange={(event) => setFormData((prev) => ({ ...prev, city: event.target.value }))}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div className="md:col-span-2">
              <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                <input
                  type="checkbox"
                  checked={formData.companyInvoice}
                  onChange={(event) => {
                    const checked = event.target.checked;
                    setFormData((prev) => ({
                      ...prev,
                      companyInvoice: checked,
                      companyName: checked ? prev.companyName : '',
                      companyTaxId: checked ? prev.companyTaxId : ''
                    }));
                  }}
                  className="h-4 w-4 rounded border-slate-300 text-brand-600"
                />
                Račun za podjetje
              </label>
            </div>
            {formData.companyInvoice && (
              <>
                <div>
                  <label className="text-sm font-medium text-slate-700" htmlFor="companyName">
                    Naziv podjetja
                  </label>
                  <input
                    id="companyName"
                    value={formData.companyName}
                    onChange={(event) =>
                      setFormData((prev) => ({ ...prev, companyName: event.target.value }))
                    }
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700" htmlFor="companyTaxId">
                    DDV / davčna številka
                  </label>
                  <input
                    id="companyTaxId"
                    value={formData.companyTaxId}
                    onChange={(event) =>
                      setFormData((prev) => ({ ...prev, companyTaxId: event.target.value }))
                    }
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
              </>
            )}
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
          </div>
        </section>
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-slate-900">Plačilo</h2>
          <p className="mt-2 text-sm text-slate-600">Plačilo: po predračunu.</p>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit || isSubmitting}
            className={`w-full rounded-full px-4 py-3 text-sm font-semibold shadow-sm transition ${
              canSubmit && !isSubmitting
                ? 'bg-brand-600 text-white hover:bg-brand-700'
                : 'cursor-not-allowed bg-slate-200 text-slate-400'
            }`}
          >
            Oddaj naročilo
          </button>
          {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}
          {!canSubmit && (
            <p className="mt-3 text-xs text-slate-500">
              Izpolnite obvezna polja in dodajte vsaj en izdelek.
            </p>
          )}
        </section>
      </div>

      <div className="space-y-6 lg:sticky lg:top-24">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-slate-900">Način plačila</h2>
          <p className="mt-2 text-sm text-slate-600">Izberite način plačila za to naročilo.</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {[
              {
                id: 'predracun',
                label: 'Po predračunu',
                description: 'Plačilo v spletni banki ali na banki/pošti.'
              },
              {
                id: 'povzetje',
                label: 'Po povzetju',
                description: 'Plačilo z gotovino ob prevzemu pošiljke.'
              },
              {
                id: 'kartica',
                label: 'Plačilna kartica',
                description: 'Podprte kartice Visa in MasterCard.',
                logos: [
                  { src: '/images/payments/visa.svg', alt: 'Visa' },
                  { src: '/images/payments/mastercard.svg', alt: 'Mastercard' }
                ]
              },
              {
                id: 'paypal',
                label: 'PayPal',
                description: 'Hiter spletni način plačila.',
                logos: [{ src: '/images/payments/paypal.svg', alt: 'PayPal' }]
              }
            ].map((method) => (
              <label
                key={method.id}
                className={`flex cursor-pointer items-start gap-2 rounded-xl border px-3 py-2 text-xs transition ${
                  formData.paymentMethod === method.label
                    ? 'border-brand-400 bg-brand-50 text-slate-900'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-brand-200'
                }`}
              >
                <input
                  type="radio"
                  name="paymentMethod"
                  value={method.label}
                  checked={formData.paymentMethod === method.label}
                  onChange={(event) =>
                    setFormData((prev) => ({ ...prev, paymentMethod: event.target.value }))
                  }
                  className="mt-0.5 h-3 w-3 text-brand-600"
                />
                <span className="flex flex-1 flex-col gap-1">
                  <span className="block text-xs font-semibold text-slate-900">
                    {method.label}
                  </span>
                  <span className="text-[11px] text-slate-500">{method.description}</span>
                  {'logos' in method && method.logos && (
                    <span className="flex flex-wrap gap-2">
                      {method.logos.map((logo) => (
                        <span
                          key={logo.src}
                          className="flex items-center rounded-md border border-slate-200 bg-white px-1.5 py-1"
                        >
                          <Image src={logo.src} alt={logo.alt} width={44} height={26} />
                        </span>
                      ))}
                    </span>
                  )}
                </span>
              </label>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-slate-900">Povzetek košarice</h2>
            <button
              type="button"
              onClick={clearCart}
              disabled={Boolean(orderResponse)}
              className="text-xs font-semibold text-slate-400 hover:text-slate-600"
            >
              Počisti
            </button>
          </div>
          <div className="mt-4 space-y-4">
            {summaryItems.map((item) => (
              <div
                key={item.sku}
                className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="text-sm font-semibold text-slate-900">{item.name}</p>
                  <p className="text-xs text-slate-500">SKU: {item.sku}</p>
                  <p className="text-xs text-slate-500">
                    Cena: {item.price ? formatter.format(item.price) : '—'}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setQuantity(item.sku, item.quantity - 1)}
                    className="h-8 w-8 rounded-full border border-slate-200 text-sm font-semibold text-slate-600"
                  >
                    −
                  </button>
                  <input
                    type="number"
                    min={1}
                    value={item.quantity}
                    onChange={(event) => {
                      const next = Number.parseInt(event.target.value, 10);
                      setQuantity(item.sku, Number.isNaN(next) ? item.quantity : next);
                    }}
                    className="w-16 rounded-lg border border-slate-200 px-2 py-1 text-center text-sm font-semibold text-slate-700"
                  />
                  <button
                    type="button"
                    onClick={() => setQuantity(item.sku, item.quantity + 1)}
                    className="h-8 w-8 rounded-full border border-slate-200 text-sm font-semibold text-slate-600"
                  >
                    +
                  </button>
                  <button
                    type="button"
                    onClick={() => removeItem(item.sku)}
                    className="text-xs font-semibold text-slate-400 hover:text-slate-600"
                  >
                    Odstrani
                  </button>
                  <span className="text-sm font-semibold text-slate-900">
                    {formatter.format((item.price ?? 0) * item.quantity)}
                  </span>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
            <div className="flex items-center justify-between">
              <span>Vmesna vsota</span>
              <span className="font-semibold text-slate-900">{formatter.format(subtotal)}</span>
            </div>
            <div className="mt-2 flex items-center justify-between">
              <span>DDV ({Math.round(vatRate * 100)}%)</span>
              <span className="font-semibold text-slate-900">{formatter.format(vatAmount)}</span>
            </div>
            <div className="mt-3 flex items-center justify-between text-base font-semibold text-slate-900">
              <span>Skupaj</span>
              <span>{formatter.format(totalAmount)}</span>
            </div>
          </div>
        </section>
      </div>

      <div className="space-y-6">
        {orderResponse ? (
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-slate-900">Dokument</h2>
            <p className="mt-2 text-sm text-slate-600">
              Št. naročila: <span className="font-semibold text-slate-900">{orderResponse.orderNumber}</span>
            </p>
            <div className="mt-4 h-[360px] overflow-hidden rounded-xl border border-slate-200">
              <iframe title="PDF" src={orderResponse.documentUrl} className="h-full w-full" />
            </div>
            <a
              href={orderResponse.documentUrl}
              className="mt-3 inline-flex text-sm font-semibold text-brand-600 hover:text-brand-700"
            >
              Prenesi PDF →
            </a>

            {orderResponse.buyerType === 'school' && (
              <div className="mt-6 rounded-xl border border-dashed border-slate-200 p-4">
                <p className="text-sm font-semibold text-slate-900">Naloži naročilnico</p>
                <p className="mt-1 text-xs text-slate-500">
                  Dovoljene datoteke: PDF, JPG (do 3 MB).
                </p>
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) handleUploadPurchaseOrder(file);
                  }}
                  className="mt-3 text-sm"
                />
                {uploading && <p className="mt-2 text-xs text-slate-500">Nalaganje ...</p>}
                {uploadError && <p className="mt-2 text-xs text-rose-600">{uploadError}</p>}
              </div>
            )}
          </section>
        ) : (
          <section className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm">
            <h2 className="text-xl font-semibold text-slate-900">Dokument</h2>
            <p className="mt-2">
              PDF bo na voljo po oddaji naročila.
            </p>
          </section>
        )}
      </div>
    </div>
  );
}
