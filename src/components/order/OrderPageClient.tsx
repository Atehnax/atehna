'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { PDFDownloadLink, PDFViewer } from '@react-pdf/renderer';
import { useCartStore } from '@/lib/cart/store';
import { COMPANY_INFO } from '@/lib/constants';
import OrderPdf, { OrderFormData } from '@/components/order/OrderPdf';

const initialForm: OrderFormData = {
  schoolName: '',
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
  const [showPreview, setShowPreview] = useState(false);

  const createdAt = useMemo(() => new Date().toLocaleDateString('sl-SI'), []);

  const requiredFieldsFilled =
    formData.schoolName.trim() &&
    formData.contactName.trim() &&
    formData.email.trim() &&
    formData.reference.trim();

  const canPreview = items.length > 0 && Boolean(requiredFieldsFilled);

  const handlePreview = () => {
    if (!canPreview) return;
    setShowPreview(true);
  };

  const mailtoLink = useMemo(() => {
    if (!requiredFieldsFilled) {
      return `mailto:${COMPANY_INFO.orderEmail}`;
    }
    const subject = `Naročilo – ${formData.schoolName} – ${formData.reference}`;
    const body = `Pozdravljeni,\n\npošiljamo naročilo v priponki (PDF).\n\nLep pozdrav,\n${formData.contactName}`;
    return `mailto:${COMPANY_INFO.orderEmail}?subject=${encodeURIComponent(
      subject
    )}&body=${encodeURIComponent(body)}`;
  }, [formData, requiredFieldsFilled]);

  if (items.length === 0) {
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
              <label className="text-sm font-medium text-slate-700" htmlFor="schoolName">
                Naziv šole <span className="text-brand-600">*</span>
              </label>
              <input
                id="schoolName"
                value={formData.schoolName}
                onChange={(event) =>
                  setFormData((prev) => ({ ...prev, schoolName: event.target.value }))
                }
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
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
                Sklic / št. naročila <span className="text-brand-600">*</span>
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
          <h2 className="text-xl font-semibold text-slate-900">Naročilnica (PDF)</h2>
          <p className="mt-2 text-sm text-slate-600">
            Generirajte PDF, ki ga lahko natisnete ali pošljete po e-pošti.
          </p>
          <div className="mt-4 flex flex-col gap-3">
            <button
              type="button"
              disabled={!canPreview}
              onClick={handlePreview}
              className={`rounded-full px-4 py-2 text-sm font-semibold shadow-sm transition ${
                canPreview
                  ? 'bg-brand-600 text-white hover:bg-brand-700'
                  : 'cursor-not-allowed bg-slate-200 text-slate-400'
              }`}
            >
              Predogled PDF
            </button>
            <PDFDownloadLink
              document={<OrderPdf formData={formData} items={items} createdAt={createdAt} />}
              fileName="Narocilo.pdf"
              className={`rounded-full px-4 py-2 text-center text-sm font-semibold shadow-sm transition ${
                canPreview
                  ? 'border border-slate-200 text-slate-700 hover:border-brand-200 hover:text-brand-600'
                  : 'pointer-events-none border border-slate-200 text-slate-300'
              }`}
            >
              Prenesi PDF
            </PDFDownloadLink>
            <a
              href={mailtoLink}
              className={`rounded-full px-4 py-2 text-center text-sm font-semibold shadow-sm transition ${
                canPreview
                  ? 'border border-slate-200 text-slate-700 hover:border-brand-200 hover:text-brand-600'
                  : 'pointer-events-none border border-slate-200 text-slate-300'
              }`}
            >
              Odpri osnutek emaila
            </a>
          </div>
          {!canPreview && (
            <p className="mt-3 text-xs text-slate-500">
              Za predogled izpolnite obvezna polja in dodajte vsaj en izdelek.
            </p>
          )}
        </section>

        {showPreview && canPreview && (
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-900">Predogled PDF</p>
              <button
                type="button"
                onClick={() => setShowPreview(false)}
                className="text-xs font-semibold text-slate-400 hover:text-slate-600"
              >
                Skrij predogled
              </button>
            </div>
            <div className="h-[480px] overflow-hidden rounded-xl border border-slate-200">
              <PDFViewer width="100%" height="100%">
                <OrderPdf formData={formData} items={items} createdAt={createdAt} />
              </PDFViewer>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
