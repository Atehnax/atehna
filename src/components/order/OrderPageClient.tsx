'use client';

import { useMemo, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useCartStore } from '@/lib/cart/store';

const MAX_UPLOAD_SIZE = 10 * 1024 * 1024;

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

export default function OrderPageClient() {
  const items = useCartStore((state) => state.items);
  const setQuantity = useCartStore((state) => state.setQuantity);
  const removeItem = useCartStore((state) => state.removeItem);
  const clearCart = useCartStore((state) => state.clearCart);
  const [formData, setFormData] = useState<OrderFormData>(initialForm);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderResponse, setOrderResponse] = useState<OrderResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [uploadState, setUploadState] = useState<
    | { status: 'idle' | 'uploading' | 'success'; message?: string; url?: string }
    | null
  >(null);

  const requiredFieldsFilled = useMemo(() => {
    const hasContact = formData.contactName.trim() && formData.email.trim();
    const hasOrg =
      formData.customerType === 'individual' || formData.organizationName.trim();
    return Boolean(hasContact && hasOrg && items.length > 0);
  }, [formData, items.length]);

  const handleSubmit = async () => {
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
      setUploadState(null);
      clearCart();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Napaka pri oddaji naročila.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUploadPurchaseOrder = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!orderResponse) return;
    const form = event.currentTarget;
    const input = form.elements.namedItem('purchaseOrder') as HTMLInputElement | null;
    const file = input?.files?.[0];
    if (!file) {
      setUploadState({ status: 'idle', message: 'Izberite datoteko za nalaganje.' });
      return;
    }
    if (file.size > MAX_UPLOAD_SIZE) {
      setUploadState({ status: 'idle', message: 'Datoteka je prevelika (največ 10 MB).' });
      return;
    }

    const formData = new FormData();
    formData.append('file', file);

    setUploadState({ status: 'uploading', message: 'Nalaganje poteka...' });

    try {
      const response = await fetch(`/api/orders/${orderResponse.orderId}/purchase-order`, {
        method: 'POST',
        body: formData
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || 'Nalaganje ni uspelo.');
      }
      const payload = (await response.json()) as { url: string };
      setUploadState({
        status: 'success',
        message: 'Naročilnica je uspešno shranjena.',
        url: payload.url
      });
      form.reset();
    } catch (error) {
      setUploadState({
        status: 'idle',
        message: error instanceof Error ? error.message : 'Napaka pri nalaganju datoteke.'
      });
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
          <div className="mt-4 grid gap-4 md:grid-cols-2">
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
          </div>
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
                </div>
                <div className="flex items-center gap-3">
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
              onClick={handleSubmit}
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
          </section>
        )}

        {orderResponse && formData.customerType === 'school' && (
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-slate-900">Naloži naročilnico</h2>
            <p className="mt-2 text-sm text-slate-600">
              Po oddaji ponudbe dodajte skenirano naročilnico (PDF ali JPG, do 10 MB).
            </p>
            <form className="mt-4 space-y-3" onSubmit={handleUploadPurchaseOrder}>
              <input
                name="purchaseOrder"
                type="file"
                accept="application/pdf,image/jpeg"
                className="block w-full text-sm text-slate-600"
              />
              <button
                type="submit"
                className="rounded-full bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700"
              >
                Naloži naročilnico
              </button>
              {uploadState?.message && (
                <p
                  className={`text-sm ${
                    uploadState.status === 'success' ? 'text-emerald-600' : 'text-slate-600'
                  }`}
                >
                  {uploadState.message}
                </p>
              )}
              {uploadState?.url && (
                <a
                  href={uploadState.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex text-sm font-semibold text-brand-600 hover:text-brand-700"
                >
                  Odpri naloženo naročilnico →
                </a>
              )}
            </form>
          </section>
        )}
      </div>
    </div>
  );
}
