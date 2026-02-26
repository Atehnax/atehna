'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import PaymentChip from '@/components/admin/PaymentChip';
import StatusChip from '@/components/admin/StatusChip';
import { CUSTOMER_TYPE_FORM_OPTIONS } from '@/lib/customerType';
import { ORDER_STATUS_OPTIONS } from '@/lib/orderStatus';
import { toDateInputValue } from '@/lib/format/dateTime';
import { PAYMENT_STATUS_OPTIONS, isPaymentStatus } from '@/lib/paymentStatus';
import TextField from '@mui/material/TextField';

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
  organizationName: organizationName?.trim() ? organizationName : contactName,
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

function StaticFloatingDate({
  label,
  value,
  onChange
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="relative">
      <label className="pointer-events-none absolute left-2.5 top-1.5 z-10 bg-white px-1 text-[10px] text-slate-600">
        {label}
      </label>
      <input
        type="date"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 w-full overflow-visible rounded-xl border border-slate-300 bg-white px-2.5 pb-1.5 pt-5 text-xs leading-6 text-slate-900 outline-none transition focus:border-[#5d3ed6] focus:ring-0 focus:ring-[#5d3ed6]"
      />
    </div>
  );
}

function StaticFloatingSelect({
  label,
  value,
  onChange
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  const selectedOption =
    CUSTOMER_TYPE_FORM_OPTIONS.find((option) => option.value === value) ?? CUSTOMER_TYPE_FORM_OPTIONS[0];

  useEffect(() => {
    if (!isOpen) return;

    const handleOutsideClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!wrapperRef.current?.contains(target)) {
        setIsOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  return (
    <div className="relative" ref={wrapperRef}>
      <label className="pointer-events-none absolute left-2.5 top-1 z-10 bg-white px-1 text-[10px] text-slate-600">
        {label}
      </label>

      <button
        type="button"
        onClick={() => setIsOpen((previousOpen) => !previousOpen)}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        className="inline-flex h-10 w-full items-center justify-between rounded-xl border border-slate-300 bg-white px-2.5 pb-1 pt-4 text-left text-xs leading-5 text-slate-900 outline-none transition hover:border-slate-400 focus:border-[#5d3ed6] focus:outline-none focus:ring-0"
      >
        <span className="block min-w-0 flex-1 truncate text-left">
          {selectedOption?.label ?? ''}
        </span>
        <span className="ml-2 shrink-0 text-slate-500">▾</span>
      </button>

      {isOpen ? (
        <div
          role="menu"
          className="absolute left-0 top-11 z-30 min-w-full w-max max-w-[320px] rounded-xl border border-slate-300 bg-white p-1 shadow-sm"
        >
          {CUSTOMER_TYPE_FORM_OPTIONS.map((option) => {
            const isSelected = option.value === value;

            return (
              <button
                key={option.value}
                type="button"
                role="menuitem"
                onClick={() => {
                  onChange(option.value);
                  setIsOpen(false);
                }}
                className={`flex h-8 w-full items-center rounded-lg px-3 text-left text-xs font-semibold leading-none transition ${
                  isSelected
                    ? 'bg-[#f8f7fc] text-[#5d3ed6]'
                    : 'text-slate-700 hover:bg-[#ede8ff]'
                }`}
                title={option.label}
              >
                <span className="block w-full text-left whitespace-nowrap">
                  {option.label}
                </span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

type CompactDropdownOption = {
  value: string;
  label: string;
};

function CompactDropdown({
  value,
  options,
  onChange,
  disabled = false,
  buttonClassName = '',
  menuClassName = ''
}: {
  value: string;
  options: readonly CompactDropdownOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
  buttonClassName?: string;
  menuClassName?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  const selectedLabel =
    options.find((option) => option.value === value)?.label ?? options[0]?.label ?? '';

  useEffect(() => {
    if (!isOpen) return;

    const handleOutsideClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!wrapperRef.current?.contains(target)) {
        setIsOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  return (
    <div className="relative" ref={wrapperRef}>
      <button
        type="button"
        onClick={() => {
          if (disabled) return;
          setIsOpen((previousOpen) => !previousOpen);
        }}
        disabled={disabled}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        className={`inline-flex h-8 w-full items-center justify-between rounded-xl border border-slate-300 bg-white px-3 text-left text-xs font-semibold text-slate-700 shadow-sm transition hover:border-slate-400 focus:border-[#5d3ed6] focus:outline-none focus:ring-0 focus-visible:border-[#5d3ed6] disabled:cursor-not-allowed disabled:opacity-60 ${buttonClassName}`}
      >
        <span className="block min-w-0 flex-1 truncate text-left">{selectedLabel}</span>
        <span className="ml-2 shrink-0 text-slate-500">▾</span>
      </button>

      {isOpen ? (
        <div
          role="menu"
          className={`absolute left-0 top-9 z-30 min-w-full w-max max-w-[260px] rounded-xl border border-slate-300 bg-white p-1 shadow-sm ${menuClassName}`}
        >
          {options.map((option) => {
            const isSelected = option.value === value;

            return (
              <button
                key={option.value}
                type="button"
                role="menuitem"
                onClick={() => {
                  onChange(option.value);
                  setIsOpen(false);
                }}
                className={`flex h-8 w-full items-center rounded-lg px-3 text-left text-xs font-semibold leading-none transition ${
                  isSelected
                    ? 'bg-[#f8f7fc] text-[#5d3ed6]'
                    : 'text-slate-700 hover:bg-[#ede8ff]'
                }`}
                title={option.label}
              >
                <span className="block w-full text-left whitespace-nowrap">{option.label}</span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

export default function AdminOrderHeaderChips(props: Props) {
  const { orderId, orderNumber } = props;
  const [displayOrderNumber, setDisplayOrderNumber] = useState(orderNumber);
  const router = useRouter();

  const [topSectionMode, setTopSectionMode] = useState<TopSectionMode>('read');
  const [persistedTopData, setPersistedTopData] = useState<TopData>(() => asTopData(props));
  const [draftTopData, setDraftTopData] = useState<TopData>(() => asTopData(props));
  const [draftOrderNumber, setDraftOrderNumber] = useState(orderNumber);
  const [isTopSaving, setIsTopSaving] = useState(false);

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const isTopDirty = useMemo(
    () =>
      JSON.stringify(draftTopData) !== JSON.stringify(persistedTopData) ||
      draftOrderNumber.trim() !== displayOrderNumber.trim(),
    [draftTopData, persistedTopData, draftOrderNumber, displayOrderNumber]
  );

  const topInputsEditable = topSectionMode === 'edit';
  const topSaveDisabled = topSectionMode === 'read' || isTopSaving;

  const startEdit = () => {
    if (topSectionMode === 'edit') {
      setDraftTopData({ ...persistedTopData });
      setDraftOrderNumber(displayOrderNumber);
      setTopSectionMode('read');
      setMessage(null);
      return;
    }

    setDraftTopData({ ...persistedTopData });
    setDraftOrderNumber(displayOrderNumber);
    setTopSectionMode('edit');
    setMessage(null);
  };

  const saveTopSection = async () => {
    if (topSaveDisabled) return;

    if (!isTopDirty) {
      setTopSectionMode('read');
      return;
    }

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
            orderNumber: draftOrderNumber,
            customerType: draftTopData.customerType,
            organizationName: draftTopData.organizationName,
            contactName: draftTopData.organizationName.trim() || draftTopData.contactName.trim(),
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

      const resolvedOrderNumber = draftOrderNumber.trim() || displayOrderNumber;
      setPersistedTopData({ ...draftTopData });
      setDisplayOrderNumber(resolvedOrderNumber);
      setTopSectionMode('read');
      window.dispatchEvent(
        new CustomEvent('admin-order-details-updated', {
          detail: {
            organizationName: draftTopData.organizationName,
            contactName: draftTopData.organizationName.trim() || draftTopData.contactName.trim(),
            customerType: draftTopData.customerType,
            email: draftTopData.email,
            deliveryAddress: draftTopData.deliveryAddress,
            notes: draftTopData.notes,
            orderNumber: resolvedOrderNumber
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
        {topInputsEditable ? (
          <input
            value={draftOrderNumber}
            onChange={(event) => setDraftOrderNumber(event.target.value)}
            className="h-9 w-full max-w-none rounded-md border border-slate-300 bg-white px-1 text-2xl font-bold tracking-tight text-slate-900 outline-none transition focus:border-[#5d3ed6] focus:ring-0 sm:max-w-[5ch]"
            aria-label="Številka naročila"
          />
        ) : (
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">{displayOrderNumber}</h1>
        )}

        <div className="ml-auto flex items-center gap-1.5">
          {topInputsEditable ? (
            <>
              <CompactDropdown
                value={draftTopData.status}
                onChange={(value) => setDraftTopData((prev) => ({ ...prev, status: value }))}
                options={ORDER_STATUS_OPTIONS}
                disabled={isTopSaving}
                buttonClassName="w-[120px]"
                menuClassName="max-w-[280px]"
              />

              <CompactDropdown
                value={draftTopData.paymentStatus}
                onChange={(value) => setDraftTopData((prev) => ({ ...prev, paymentStatus: value }))}
                options={PAYMENT_STATUS_OPTIONS}
                disabled={isTopSaving}
                buttonClassName="w-[120px]"
                menuClassName="max-w-[280px]"
              />
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
            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 text-xs text-slate-600 hover:bg-slate-100"
            aria-label="Uredi naročilo"
            title="Uredi"
            disabled={isTopSaving}
          >
            <PencilIcon />
          </button>

          <button
            type="button"
            onClick={() => void saveTopSection()}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 text-xs text-slate-600 hover:bg-slate-100 disabled:cursor-not-allowed disabled:text-slate-300"
            aria-label="Shrani naročilo"
            title="Shrani"
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
        <div className="mt-4 grid min-h-[132px] gap-3 text-[12px] md:grid-cols-2">
          <StaticFloatingDate
            label="Datum"
            value={activeTopData.orderDate}
            onChange={(value) => setDraftTopData((prev) => ({ ...prev, orderDate: value }))}
          />

          <StaticFloatingSelect
            label="Tip naročnika"
            value={activeTopData.customerType}
            onChange={(value) => setDraftTopData((prev) => ({ ...prev, customerType: value }))}
          />

          <TextField
            id="organizationName"
            label="Naročnik"
            variant="outlined"
            size="small"
            fullWidth
            value={activeTopData.organizationName}
            onChange={(event) => setDraftTopData((prev) => ({ ...prev, organizationName: event.target.value }))}
          />

          <TextField
            id="email"
            label="Email"
            type="email"
            variant="outlined"
            size="small"
            fullWidth
            value={activeTopData.email}
            onChange={(event) => setDraftTopData((prev) => ({ ...prev, email: event.target.value }))}
          />

          <TextField
            id="deliveryAddress"
            label="Naslov"
            variant="outlined"
            size="small"
            fullWidth
            value={activeTopData.deliveryAddress}
            onChange={(event) => setDraftTopData((prev) => ({ ...prev, deliveryAddress: event.target.value }))}
          />

          <TextField
            id="notes"
            label="Opombe"
            variant="outlined"
            size="small"
            fullWidth
            multiline
            minRows={2}
            value={activeTopData.notes}
            onChange={(event) => setDraftTopData((prev) => ({ ...prev, notes: event.target.value }))}
          />
        </div>
      ) : (
        <div className="mt-4 grid min-h-[132px] gap-3 text-[12px] md:grid-cols-2">
          <div className="min-h-10">
            <p className="text-sm font-semibold text-slate-700">Datum</p>
            <p className="mt-0.5 text-xs leading-5 text-slate-900">{displayValue(activeTopData.orderDate)}</p>
          </div>
          <div className="min-h-10">
            <p className="text-sm font-semibold text-slate-700">Tip naročnika</p>
            <p className="mt-0.5 text-xs leading-5 text-slate-900">
              {displayValue(
                CUSTOMER_TYPE_FORM_OPTIONS.find((option) => option.value === activeTopData.customerType)?.label ??
                  activeTopData.customerType
              )}
            </p>
          </div>
          <div className="min-h-10">
            <p className="text-sm font-semibold text-slate-700">Naročnik</p>
            <p className="mt-0.5 text-xs leading-5 text-slate-900">{displayValue(activeTopData.organizationName)}</p>
          </div>
          <div className="min-h-10">
            <p className="text-sm font-semibold text-slate-700">Email</p>
            <p className="mt-0.5 text-xs leading-5 text-slate-900">{displayValue(activeTopData.email)}</p>
          </div>
          <div className="min-h-10">
            <p className="text-sm font-semibold text-slate-700">Naslov</p>
            <p className="mt-0.5 text-xs leading-5 text-slate-900">{displayValue(activeTopData.deliveryAddress)}</p>
          </div>
          <div className="min-h-10">
            <p className="text-sm font-semibold text-slate-700">Opombe</p>
            <p className="mt-0.5 whitespace-pre-wrap text-xs leading-5 text-slate-900">{displayValue(activeTopData.notes)}</p>
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
              <button
                type="button"
                onClick={() => setIsDeleteModalOpen(false)}
                className="h-8 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-600"
              >
                Prekliči
              </button>
              <button
                type="button"
                onClick={confirmDeleteOrder}
                className="h-8 rounded-lg border border-rose-200 px-3 text-xs font-semibold text-rose-700"
              >
                Izbriši
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}