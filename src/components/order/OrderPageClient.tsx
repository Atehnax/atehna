'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { PDFDownloadLink, PDFViewer, pdf } from '@react-pdf/renderer';
import { useCartStore } from '@/lib/cart/store';
import { COMPANY_INFO } from '@/lib/constants';
import OrderPdf, { OrderFormData } from '@/components/order/OrderPdf';

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
  const [showPreview, setShowPreview] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

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

  const canPreview = items.length > 0 && Boolean(requiredFieldsFilled);

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const handlePreview = async () => {
    if (!canPreview) return;
    const document = <OrderPdf formData={formData} items={items} createdAt={createdAt} />;
    const blob = await pdf(document).toBlob();
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl(URL.createObjectURL(blob));
    setShowPreview(true);
  };

  const mailtoLink = useMemo(() => {
    if (!requiredFieldsFilled) {
      return `mailto:${COMPANY_INFO.orderEmail}`;
    }
    const subject = `Naročilo – ${formData.firstName} ${formData.lastName}`;
    const body = `Pozdravljeni,\n\npošiljamo naročilo v priponki (PDF).\n\nLep pozdrav,\n${formData.firstName} ${formData.lastName}`;
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
            {previewUrl && (
              <a
                href={previewUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-flex text-xs font-semibold text-brand-600 hover:text-brand-700"
              >
                Odpri PDF v novem zavihku →
              </a>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
