'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import PaymentChip from '@/components/admin/PaymentChip';
import StatusChip from '@/components/admin/StatusChip';
import { ORDER_STATUS_OPTIONS } from '@/lib/orderStatus';
import { PAYMENT_STATUS_OPTIONS, isPaymentStatus } from '@/lib/paymentStatus';

type TopSectionMode = 'read' | 'edit';

type TopData = {
  orderDate: string;
  customerType: string;
  organizationName: string;
  contactName: string;
  email: string;
  deliveryAddress: string;
  notes: string;
  status: string;
  paymentStatus: string;
};

type Props = {
  orderId: number;
  orderNumber: string;
  status: string;
  paymentStatus?: string | null;
  customerType: string;
  organizationName: string | null;
  contactName: string;
  email: string;
  deliveryAddress: string | null;
  notes: string | null;
  createdAt: string;
};

const customerTypeOptions = [
  { value: 'individual', label: 'Fizična oseba' },
  { value: 'company', label: 'Podjetje' },
  { value: 'school', label: 'Šola / javni zavod' }
];

const toDateInputValue = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return new Date().toISOString().slice(0, 10);
  return date.toISOString().slice(0, 10);
};

const asTopData = ({
  createdAt,
  customerType,
  organizationName,
  contactName,
  email,
  deliveryAddress,
  notes,
  status,
  paymentStatus
}: {
  createdAt: string;
  customerType: string;
  organizationName: string | null;
  contactName: string;
  email: string;
  deliveryAddress: string | null;
  notes: string | null;
  status: string;
  paymentStatus?: string | null;
}): TopData => ({
  orderDate: toDateInputValue(createdAt),
  customerType,
  organizationName: organizationName ?? '',
  contactName,
  email,
  deliveryAddress: deliveryAddress ?? '',
  notes: notes?.trim() ? notes : '/',
  status,
  paymentStatus: isPaymentStatus(paymentStatus ?? '') ? paymentStatus ?? 'unpaid' : 'unpaid'
});

function SaveIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M4 3h9l3 3v11H4z" />
      <path d="M7 3v5h6V3" />
      <path d="M7 13h6" />
    </svg>
  );
}

function PencilIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M4 14.5l.5-3L13.5 2.5l3 3L7.5 14.5z" />
      <path d="M11.5 4.5l3 3" />
    </svg>
  );
}

function FloatingField({
  label,
  value,
  onChange,
  type = 'text'
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <label className="relative block">
      <input
        type={type}
        value={value}
        placeholder=" "
        onChange={(event) => onChange(event.target.value)}
        className="peer h-10 w-full rounded-xl border border-slate-300 bg-white px-2.5 pb-1 pt-4 text-xs text-slate-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
      />
      <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 bg-white px-1 text-xs text-slate-500 transition-all peer-placeholder-shown:top-1/2 peer-placeholder-shown:text-xs peer-focus:top-1.5 peer-focus:text-[10px] peer-focus:text-slate-600 peer-[:not(:placeholder-shown)]:top-1.5 peer-[:not(:placeholder-shown)]:text-[10px] peer-[:not(:placeholder-shown)]:text-slate-600">
        {label}
      </span>
    </label>
  );
}

export default function AdminOrderHeaderChips(props: Props) {
  const { orderId, orderNumber } = props;
  const router = useRouter();

  const [topSectionMode, setTopSectionMode] = useState<TopSectionMode>('read');
  const [persistedTopData, setPersistedTopData] = useState<TopData>(() => asTopData(props));
  const [draftTopData, setDraftTopData] = useState<TopData>(() => asTopData(props));
  const [isTopSaving, setIsTopSaving] = useState(false);

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const isTopDirty = useMemo(
    () => JSON.stringify(draftTopData) !== JSON.stringify(persistedTopData),
    [draftTopData, persistedTopData]
  );

  const topSaveDisabled = topSectionMode === 'read' || !isTopDirty || isTopSaving;
  const topInputsEditable = topSectionMode === 'edit';

  const startEdit = () => {
    setDraftTopData({ ...persistedTopData });
    setTopSectionMode('edit');
    setMessage(null);
  };

  const saveTopSection = async () => {
    if (topSaveDisabled) return;

    setIsTopSaving(true);
    setMessage(null);
    try {
      const [statusResponse, paymentResponse, detailsResponse] = await Promise.all([
        fetch(`/api/admin/orders/${orderId}/status`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: draftTopData.status })
        }),
        fetch(`/api/admin/orders/${orderId}/payment-status`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: draftTopData.paymentStatus })
        }),
        fetch(`/api/admin/orders/${orderId}/details`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            customerType: draftTopData.customerType,
            organizationName: draftTopData.organizationName,
            contactName: draftTopData.contactName,
            email: draftTopData.email,
            deliveryAddress: draftTopData.deliveryAddress,
            notes: draftTopData.notes,
            orderDate: draftTopData.orderDate
          })
        })
      ]);

      if (!statusResponse.ok || !paymentResponse.ok || !detailsResponse.ok) {
        const error = await detailsResponse.json().catch(() => ({}));
        throw new Error(error.message || 'Shranjevanje ni uspelo.');
      }

      setPersistedTopData({ ...draftTopData });
      setTopSectionMode('read');
      window.dispatchEvent(
        new CustomEvent('admin-order-details-updated', {
          detail: {
            organizationName: draftTopData.organizationName,
            contactName: draftTopData.contactName,
            customerType: draftTopData.customerType,
            email: draftTopData.email,
            deliveryAddress: draftTopData.deliveryAddress,
            notes: draftTopData.notes
          }
        })
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Napaka pri shranjevanju.');
    } finally {
      setIsTopSaving(false);
    }
  };

  const confirmDeleteOrder = async () => {
    setIsDeleting(true);
    setIsDeleteModalOpen(false);
    setMessage(null);
    try {
      const response = await fetch(`/api/admin/orders/${orderId}`, { method: 'DELETE' });
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || 'Brisanje ni uspelo.');
      }
      router.push('/admin/orders');
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Napaka pri brisanju naročila.');
    } finally {
      setIsDeleting(false);
    }
  };

  const activeTopData = topInputsEditable ? draftTopData : persistedTopData;

  const displayValue = (value: string) => (value?.trim() ? value : '/');

  return (
    <div className="rounded-2xl border border-slate-200 bg-gradient-to-r from-white to-slate-50 px-4 py-3 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">{orderNumber}</h1>

        <div className="ml-auto flex items-center gap-1.5">
          {topInputsEditable ? (
            <>
              <select
                value={draftTopData.status}
                onChange={(event) => setDraftTopData((prev) => ({ ...prev, status: event.target.value }))}
                className="h-8 rounded-lg border border-slate-300 px-2 text-xs"
              >
                {ORDER_STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <select
                value={draftTopData.paymentStatus}
                onChange={(event) => setDraftTopData((prev) => ({ ...prev, paymentStatus: event.target.value }))}
                className="h-8 rounded-lg border border-slate-300 px-2 text-xs"
              >
                {PAYMENT_STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </>
          ) : (
            <>
              <StatusChip status={persistedTopData.status} />
              <PaymentChip status={persistedTopData.paymentStatus} />
            </>
          )}

          <button
            type="button"
            onClick={startEdit}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 text-xs text-slate-600 hover:bg-slate-100 disabled:cursor-not-allowed disabled:text-slate-300"
            aria-label="Uredi naročilo"
            disabled={topInputsEditable || isTopSaving}
          >
            <PencilIcon />
          </button>

          <button
            type="button"
            onClick={() => void saveTopSection()}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 text-xs text-slate-600 hover:bg-slate-100 disabled:cursor-not-allowed disabled:text-slate-300"
            aria-label="Shrani naročilo"
            disabled={topSaveDisabled}
          >
            <SaveIcon />
          </button>

          <button
            type="button"
            onClick={() => setIsDeleteModalOpen(true)}
            disabled={isDeleting}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-rose-200 text-sm font-semibold leading-none text-rose-600 hover:bg-rose-50 disabled:text-slate-300"
            aria-label="Izbriši naročilo"
            title="Izbriši"
          >
            ×
          </button>
        </div>
      </div>

      {topInputsEditable ? (
        <div className="mt-4 grid gap-3 text-[12px] md:grid-cols-2">
          <label className="space-y-1">
            <span className="text-[10px] text-slate-600">Datum</span>
            <input
              type="date"
              value={activeTopData.orderDate}
              onChange={(event) => setDraftTopData((prev) => ({ ...prev, orderDate: event.target.value }))}
              className="h-10 w-full rounded-xl border border-slate-300 bg-white px-2.5 text-xs text-slate-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            />
          </label>

          <label className="space-y-1">
            <span className="text-[10px] text-slate-600">Tip naročnika</span>
            <select
              value={activeTopData.customerType}
              onChange={(event) => setDraftTopData((prev) => ({ ...prev, customerType: event.target.value }))}
              className="h-10 w-full rounded-xl border border-slate-300 bg-white px-2.5 text-xs text-slate-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            >
              {customerTypeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <div className="md:col-span-2">
            <FloatingField
              label="Naročnik"
              value={activeTopData.organizationName}
              onChange={(value) => setDraftTopData((prev) => ({ ...prev, organizationName: value }))}
            />
          </div>

          <FloatingField
            label="Kontakt"
            value={activeTopData.contactName}
            onChange={(value) => setDraftTopData((prev) => ({ ...prev, contactName: value }))}
          />

          <FloatingField
            label="Email"
            type="email"
            value={activeTopData.email}
            onChange={(value) => setDraftTopData((prev) => ({ ...prev, email: value }))}
          />

          <div className="md:col-span-2">
            <FloatingField
              label="Naslov"
              value={activeTopData.deliveryAddress}
              onChange={(value) => setDraftTopData((prev) => ({ ...prev, deliveryAddress: value }))}
            />
          </div>

          <label className="relative block md:col-span-2">
            <textarea
              rows={3}
              value={activeTopData.notes}
              placeholder=" "
              onChange={(event) => setDraftTopData((prev) => ({ ...prev, notes: event.target.value }))}
              className="peer w-full rounded-xl border border-slate-300 bg-white px-2.5 pb-2 pt-5 text-xs text-slate-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            />
            <span className="pointer-events-none absolute left-2.5 top-1.5 bg-white px-1 text-[10px] text-slate-600">Opombe</span>
          </label>
        </div>
      ) : (
        <div className="mt-4 grid gap-3 text-[12px] md:grid-cols-2">
          <div>
            <p className="text-[10px] text-slate-500">Datum</p>
            <p className="mt-1 text-xs text-slate-900">{displayValue(activeTopData.orderDate)}</p>
          </div>
          <div>
            <p className="text-[10px] text-slate-500">Tip naročnika</p>
            <p className="mt-1 text-xs text-slate-900">{displayValue(customerTypeOptions.find((option) => option.value === activeTopData.customerType)?.label ?? activeTopData.customerType)}</p>
          </div>
          <div className="md:col-span-2">
            <p className="text-[10px] text-slate-500">Naročnik</p>
            <p className="mt-1 text-xs text-slate-900">{displayValue(activeTopData.organizationName)}</p>
          </div>
          <div>
            <p className="text-[10px] text-slate-500">Kontakt</p>
            <p className="mt-1 text-xs text-slate-900">{displayValue(activeTopData.contactName)}</p>
          </div>
          <div>
            <p className="text-[10px] text-slate-500">Email</p>
            <p className="mt-1 text-xs text-slate-900">{displayValue(activeTopData.email)}</p>
          </div>
          <div className="md:col-span-2">
            <p className="text-[10px] text-slate-500">Naslov</p>
            <p className="mt-1 text-xs text-slate-900">{displayValue(activeTopData.deliveryAddress)}</p>
          </div>
          <div className="md:col-span-2">
            <p className="text-[10px] text-slate-500">Opombe</p>
            <p className="mt-1 whitespace-pre-wrap text-xs text-slate-900">{displayValue(activeTopData.notes)}</p>
          </div>
        </div>
      )}

      {message ? <p className="mt-2 text-xs text-slate-600">{message}</p> : null}

      {isDeleteModalOpen ? (
        <div className="fixed inset-0 z-[130] flex items-center justify-center bg-slate-900/30 px-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-sm rounded-2xl bg-white p-4 shadow-xl">
            <p className="text-sm font-semibold text-slate-900">Izbris naročila</p>
            <p className="mt-2 text-xs text-slate-600">Ali ste prepričani, da želite izbrisati to naročilo?</p>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setIsDeleteModalOpen(false)} className="h-8 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-600">
                Prekliči
              </button>
              <button type="button" onClick={confirmDeleteOrder} className="h-8 rounded-lg border border-rose-200 px-3 text-xs font-semibold text-rose-700">
                Izbriši
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
