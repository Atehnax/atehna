'use client';

import { useState } from 'react';

type Props = {
  orderId: number;
  customerType: string;
  organizationName: string | null;
  contactName: string;
  email: string;
  phone: string | null;
  deliveryAddress: string | null;
  reference: string | null;
  notes: string | null;
};

const customerTypeOptions = [
  { value: 'individual', label: 'Fizična oseba' },
  { value: 'company', label: 'Podjetje' },
  { value: 'school', label: 'Šola / javni zavod' }
];

export default function AdminOrderEditForm({
  orderId,
  customerType,
  organizationName,
  contactName,
  email,
  phone,
  deliveryAddress,
  reference,
  notes
}: Props) {
  const [formData, setFormData] = useState({
    customerType,
    organizationName: organizationName ?? '',
    contactName,
    email,
    phone: phone ?? '',
    deliveryAddress: deliveryAddress ?? '',
    reference: reference ?? '',
    notes: notes ?? ''
  });
  const [message, setMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage(null);
    setIsSaving(true);
    try {
      const response = await fetch(`/api/admin/orders/${orderId}/details`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || 'Shranjevanje ni uspelo.');
      }
      setMessage('Podatki so posodobljeni.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Napaka pri shranjevanju.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-900">Uredi naročilo</h2>
      <form className="mt-4 grid gap-4 md:grid-cols-2" onSubmit={handleSubmit}>
        <div className="md:col-span-2">
          <label className="text-sm font-medium text-slate-700" htmlFor="customerType">
            Tip naročnika
          </label>
          <select
            id="customerType"
            value={formData.customerType}
            onChange={(event) =>
              setFormData((prev) => ({ ...prev, customerType: event.target.value }))
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
        <div className="md:col-span-2">
          <label className="text-sm font-medium text-slate-700" htmlFor="organizationName">
            Naziv organizacije
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
        <div>
          <label className="text-sm font-medium text-slate-700" htmlFor="contactName">
            Kontaktna oseba
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
            Email
          </label>
          <input
            id="email"
            type="email"
            value={formData.email}
            onChange={(event) => setFormData((prev) => ({ ...prev, email: event.target.value }))}
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
            Sklic
          </label>
          <input
            id="reference"
            value={formData.reference}
            onChange={(event) => setFormData((prev) => ({ ...prev, reference: event.target.value }))}
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
        <div className="md:col-span-2">
          <label className="text-sm font-medium text-slate-700" htmlFor="notes">
            Opombe
          </label>
          <textarea
            id="notes"
            rows={3}
            value={formData.notes}
            onChange={(event) => setFormData((prev) => ({ ...prev, notes: event.target.value }))}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <div className="md:col-span-2 flex items-center gap-3">
          <button
            type="submit"
            disabled={isSaving}
            className="rounded-full bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
          >
            {isSaving ? 'Shranjevanje...' : 'Shrani spremembe'}
          </button>
          {message && <span className="text-sm text-slate-600">{message}</span>}
        </div>
      </form>
    </section>
  );
}
