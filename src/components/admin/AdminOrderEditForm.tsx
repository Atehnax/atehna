'use client';

import { type ReactNode, useEffect, useState } from 'react';

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
  createdAt: string;
};

const customerTypeOptions = [
  { value: 'individual', label: 'Fizična oseba' },
  { value: 'company', label: 'Podjetje' },
  { value: 'school', label: 'Šola / javni zavod' }
];

const isFilled = (value: unknown) => {
  if (typeof value === 'string') return value.trim().length > 0;
  if (typeof value === 'number') return Number.isFinite(value);
  return false;
};
const toDateInputValue = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return new Date().toISOString().slice(0, 10);
  return date.toISOString().slice(0, 10);
};


type FloatingInputProps = {
  id: string;
  label: string;
  type?: string;
  value: string;
  onChange: (value: string) => void;
};

function FloatingInput({ id, label, type = 'text', value, onChange }: FloatingInputProps) {
  return (
    <div className="group relative" data-filled={isFilled(value) ? 'true' : 'false'}>
      <input
        id={id}
        type={type}
        value={value}
        placeholder=" "
        onChange={(event) => onChange(event.target.value)}
        className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 pb-1 pt-4 text-[12px] text-slate-900 shadow-sm outline-none transition focus:border-brand-500 focus:ring-1 focus:ring-[#ede8fe]"
      />
      <label
        htmlFor={id}
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[12px] text-slate-400 transition-all duration-150 group-focus-within:top-1.5 group-focus-within:translate-y-0 group-focus-within:bg-white group-focus-within:px-1 group-focus-within:text-[10px] group-focus-within:text-slate-600 group-data-[filled=true]:top-1.5 group-data-[filled=true]:translate-y-0 group-data-[filled=true]:bg-white group-data-[filled=true]:px-1 group-data-[filled=true]:text-[10px] group-data-[filled=true]:text-slate-600"
      >
        {label}
      </label>
    </div>
  );
}

type FloatingTextareaProps = {
  id: string;
  label: string;
  value: string;
  rows?: number;
  onChange: (value: string) => void;
};

function FloatingTextarea({ id, label, value, rows = 3, onChange }: FloatingTextareaProps) {
  return (
    <div className="group relative" data-filled={isFilled(value) ? 'true' : 'false'}>
      <textarea
        id={id}
        rows={rows}
        value={value}
        placeholder=" "
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-xl border border-slate-300 bg-white px-3 pb-2 pt-5 text-[12px] text-slate-900 shadow-sm outline-none transition focus:border-brand-500 focus:ring-1 focus:ring-[#ede8fe]"
      />
      <label
        htmlFor={id}
        className="pointer-events-none absolute left-3 top-5 -translate-y-1/2 text-[12px] text-slate-400 transition-all duration-150 group-focus-within:top-1.5 group-focus-within:translate-y-0 group-focus-within:bg-white group-focus-within:px-1 group-focus-within:text-[10px] group-focus-within:text-slate-600 group-data-[filled=true]:top-1.5 group-data-[filled=true]:translate-y-0 group-data-[filled=true]:bg-white group-data-[filled=true]:px-1 group-data-[filled=true]:text-[10px] group-data-[filled=true]:text-slate-600"
      >
        {label}
      </label>
    </div>
  );
}
type StaticFloatingSelectProps = {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
};

function StaticFloatingSelect({ id, label, value, onChange, children }: StaticFloatingSelectProps) {
  return (
    <div className="relative">
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 w-full appearance-none rounded-xl border border-slate-300 bg-white px-3 pb-1 pt-4 text-[12px] text-slate-900 shadow-sm outline-none transition focus:border-brand-500 focus:ring-1 focus:ring-[#ede8fe]"
      >
        {children}
      </select>
      <label
        htmlFor={id}
        className="pointer-events-none absolute left-3 top-1.5 bg-white px-1 text-[10px] text-slate-600"
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


export default function AdminOrderEditForm({
  orderId,
  customerType,
  organizationName,
  contactName,
  email,
  phone,
  deliveryAddress,
  reference,
  notes,
  createdAt
}: Props) {
  const [formData, setFormData] = useState({
    customerType,
    organizationName: organizationName ?? '',
    contactName,
    email,
    phone: phone ?? '',
    deliveryAddress: deliveryAddress ?? '',
    reference: reference ?? '',
    notes: notes?.trim() ? notes : '/',
    orderDate: toDateInputValue(createdAt)
  });
  const [message, setMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!isDirty) return;
      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [isDirty]);

  const markDirty = () => {
    setIsDirty(true);
    setMessage(null);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage(null);
    setIsSaving(true);
    try {
      const detailsResponse = await fetch(`/api/admin/orders/${orderId}/details`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (!detailsResponse.ok) {
        const error = await detailsResponse.json().catch(() => ({}));
        throw new Error(error.message || 'Shranjevanje kontaktnih podatkov ni uspelo.');
      }

      setMessage('Podatki naročila so posodobljeni. Ustvarite novo verzijo PDF dokumentov.');
      setIsDirty(false);
      window.dispatchEvent(
        new CustomEvent('admin-order-details-updated', {
          detail: {
            organizationName: formData.organizationName,
            contactName: formData.contactName,
            customerType: formData.customerType,
            email: formData.email,
            deliveryAddress: formData.deliveryAddress,
            notes: formData.notes.trim() ? formData.notes : '/'
          }
        })
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Napaka pri shranjevanju.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-base font-semibold text-slate-900">Uredi naslov</h2>
      {isDirty && (
        <p className="mt-2 text-xs font-medium text-amber-700">
          Imate neshranjene spremembe. Pred odhodom shranite obrazec.
        </p>
      )}

      <form className="mt-4 space-y-6 text-[12px]" onSubmit={handleSubmit}>
        <div className="rounded-2xl border border-slate-200 bg-slate-50/40 p-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-1">
              <div className="relative">
                <label className="pointer-events-none absolute left-2.5 top-1.5 bg-white px-1 text-[10px] text-slate-600">Datum</label>
                <input
                  type="date"
                  lang="sl-SI"
                  value={formData.orderDate}
                  onChange={(event) => {
                    setFormData((previousValue) => ({ ...previousValue, orderDate: event.target.value }));
                    markDirty();
                  }}
                  className="h-10 w-full rounded-xl border border-slate-300 bg-white px-2.5 pt-4 text-xs"
                />
              </div>
            </div>

            <div className="md:col-span-1">
              <StaticFloatingSelect
                id="customerType"
                label="Tip naročnika"
                value={formData.customerType}
                onChange={(value) => {
                  setFormData((previousValue) => ({ ...previousValue, customerType: value }));
                  markDirty();
                }}
              >
                {customerTypeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </StaticFloatingSelect>
            </div>

            <div className="md:col-span-2">
              <FloatingInput
                id="organizationName"
                label="Naziv organizacije"
                value={formData.organizationName}
                onChange={(value) => {
                  setFormData((previousValue) => ({ ...previousValue, organizationName: value }));
                  markDirty();
                }}
              />
            </div>

            <FloatingInput
              id="contactName"
              label="Kontaktna oseba"
              value={formData.contactName}
              onChange={(value) => {
                setFormData((previousValue) => ({ ...previousValue, contactName: value }));
                markDirty();
              }}
            />

            <FloatingInput
              id="email"
              type="email"
              label="Email"
              value={formData.email}
              onChange={(value) => {
                setFormData((previousValue) => ({ ...previousValue, email: value }));
                markDirty();
              }}
            />

            <div className="md:col-span-2">
              <FloatingInput
                id="deliveryAddress"
                label="Naslov dostave"
                value={formData.deliveryAddress}
                onChange={(value) => {
                  setFormData((previousValue) => ({ ...previousValue, deliveryAddress: value }));
                  markDirty();
                }}
              />
            </div>

            <div className="md:col-span-2">
              <FloatingTextarea
                id="notes"
                label="Opombe"
                rows={3}
                value={formData.notes}
                onChange={(value) => {
                  setFormData((previousValue) => ({ ...previousValue, notes: value }));
                  markDirty();
                }}
              />
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={isSaving}
          className="w-full whitespace-nowrap rounded-xl bg-brand-600 px-4 py-2 text-[12px] font-semibold text-white shadow-sm transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
        >
          {isSaving ? 'Shranjevanje...' : 'Shrani spremembe'}
        </button>

        {message && <span className="block text-[12px] text-slate-600">{message}</span>}
      </form>
    </section>
  );
}
