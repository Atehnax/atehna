'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import PaymentChip from '@/admin/components/PaymentChip';
import StatusChip from '@/admin/components/StatusChip';
import { CUSTOMER_TYPE_FORM_OPTIONS } from '@/shared/domain/order/customerType';
import { ORDER_STATUS_OPTIONS } from '@/shared/domain/order/orderStatus';
import { toDateInputValue } from '@/shared/domain/order/dateTime';
import { PAYMENT_STATUS_OPTIONS, isPaymentStatus } from '@/shared/domain/order/paymentStatus';
import { MenuItem, MenuPanel } from '@/shared/ui/menu';
import { ConfirmDialog } from '@/shared/ui/confirm-dialog';
import { IconButton } from '@/shared/ui/icon-button';
import { PencilIcon, SaveIcon, TrashCanIcon } from '@/shared/ui/icons/AdminActionIcons';
import { useToast } from '@/shared/ui/toast';
import { buttonTokenClasses } from '@/shared/ui/theme/tokens';

type TopSectionMode = 'read' | 'edit';

const toDisplayOrderNumberValue = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return '#';
  return trimmed.startsWith('#') ? trimmed : `#${trimmed}`;
};
const toEditableOrderNumber = (value: string) => value.trim().replace(/^#/, '');

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

function ChipDropdown({
  value,
  options,
  onChange,
  renderChip,
  disabled = false,
  showArrow = true,
  interactive = true
}: {
  value: string;
  options: ReadonlyArray<{ value: string; label: string }>;
  onChange: (value: string) => void;
  renderChip: (value: string) => ReactNode;
  disabled?: boolean;
  showArrow?: boolean;
  interactive?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const onDocClick = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setIsOpen(false);
    };
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onEscape);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onEscape);
    };
  }, [isOpen]);

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => {
          if (disabled || !interactive) return;
          setIsOpen((prev) => !prev);
        }}
        disabled={disabled}
        aria-haspopup="menu"
        aria-expanded={interactive ? isOpen : false}
        className="relative block rounded-full focus:outline-none disabled:cursor-default disabled:opacity-60"
      >
        {showArrow ? (
          <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-500">▾</span>
        ) : null}
        <span className="block">{renderChip(value)}</span>
      </button>

      {isOpen ? (
        <div role="menu">
          <MenuPanel className="absolute left-0 top-9 z-30 min-w-[150px]">
            {options.map((option) => (
              <MenuItem
                key={option.value}
                isActive={option.value === value}
                onClick={() => {
                  onChange(option.value);
                  setIsOpen(false);
                }}
              >
                {option.label}
              </MenuItem>
            ))}
          </MenuPanel>
        </div>
      ) : null}
    </div>
  );
}

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
  notes: notes?.trim() ? notes : '',
  status,
  paymentStatus: isPaymentStatus(paymentStatus ?? '') ? paymentStatus ?? 'unpaid' : 'unpaid'
});

type CompactDropdownOption = {
  value: string;
  label: string;
};

export default function AdminOrderHeaderChips(props: Props) {
  const { orderId, orderNumber } = props;
  const [displayOrderNumber, setDisplayOrderNumber] = useState(toDisplayOrderNumberValue(orderNumber));
  const router = useRouter();

  const [topSectionMode, setTopSectionMode] = useState<TopSectionMode>('read');
  const [persistedTopData, setPersistedTopData] = useState<TopData>(() => asTopData(props));
  const [draftTopData, setDraftTopData] = useState<TopData>(() => asTopData(props));
  const [draftOrderNumber, setDraftOrderNumber] = useState(toEditableOrderNumber(orderNumber));
  const [isTopSaving, setIsTopSaving] = useState(false);

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const { toast } = useToast();

  const isTopDirty = useMemo(
    () =>
      JSON.stringify(draftTopData) !== JSON.stringify(persistedTopData) ||
      draftOrderNumber.trim() !== toEditableOrderNumber(displayOrderNumber),
    [draftTopData, persistedTopData, draftOrderNumber, displayOrderNumber]
  );

  const topInputsEditable = topSectionMode === 'edit';
  const topSaveDisabled = topSectionMode !== 'edit' || isTopSaving;
  const startEdit = () => {
    if (topSectionMode === 'edit') {
      setDraftTopData({ ...persistedTopData });
      setDraftOrderNumber(toEditableOrderNumber(displayOrderNumber));
      setTopSectionMode('read');
      return;
    }

    setDraftTopData({ ...persistedTopData });
    setDraftOrderNumber(toEditableOrderNumber(displayOrderNumber));
    setTopSectionMode('edit');
  };

  const saveTopSection = async () => {
    if (topSaveDisabled) return;

    if (!isTopDirty) {
      setTopSectionMode('read');
      return;
    }

    setIsTopSaving(true);
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
            orderNumber: toDisplayOrderNumberValue(draftOrderNumber),
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

      const resolvedOrderNumber = draftOrderNumber.trim()
        ? toDisplayOrderNumberValue(draftOrderNumber)
        : displayOrderNumber;
      setPersistedTopData({ ...draftTopData });
      setDisplayOrderNumber(resolvedOrderNumber);
      setTopSectionMode('read');
      toast.success('Shranjeno');
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
      toast.error(error instanceof Error ? error.message : 'Napaka pri shranjevanju.');
    } finally {
      setIsTopSaving(false);
    }
  };

  const confirmDeleteOrder = async () => {
    setIsDeleting(true);
    setIsDeleteModalOpen(false);
    try {
      const response = await fetch(`/api/admin/orders/${orderId}`, { method: 'DELETE' });
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || 'Brisanje ni uspelo.');
      }
      toast.success('Izbrisano');
      router.push('/admin/orders');
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Napaka pri brisanju naročila.');
    } finally {
      setIsDeleting(false);
    }
  };

  const activeTopData = topInputsEditable ? draftTopData : persistedTopData;
  const displayValue = (value: string) => (value?.trim() ? value : '');

  return (
    <div className="rounded-2xl border border-slate-200 bg-gradient-to-r from-white to-slate-50 px-4 py-3 shadow-sm font-['Inter',system-ui,sans-serif]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="flex h-10 flex-nowrap items-center gap-1 whitespace-nowrap text-2xl font-bold tracking-tight text-slate-900">
          <span>Naročilo</span>
          <span className="inline-flex h-10 items-center gap-0">
            <span>#</span>
          {topInputsEditable ? (
            <input
              type="text"
              value={draftOrderNumber}
              onChange={(event) =>
                setDraftOrderNumber(event.target.value.replace(/[^\d]/g, ''))
              }
              inputMode="numeric"
              aria-label="Številka naročila"
              className="m-0 h-10 w-24 appearance-none rounded-xl border border-slate-300 bg-white px-2.5 font-['Inter',system-ui,sans-serif] !text-[26px] !font-bold leading-none tracking-tight text-slate-900 shadow-none outline-none focus:border-[#3e67d6] focus:outline-none focus:ring-0 focus:shadow-none focus-visible:outline-none focus-visible:ring-0 focus-visible:shadow-none"
            />
          ) : (
            <span>{toEditableOrderNumber(displayOrderNumber)}</span>
          )}
          </span>
        </h1>

        <div className="ml-auto flex items-center gap-1.5">
          <ChipDropdown
            value={topInputsEditable ? draftTopData.status : persistedTopData.status}
            options={ORDER_STATUS_OPTIONS}
            disabled={isTopSaving}
            showArrow={topInputsEditable}
            interactive={topInputsEditable}
            onChange={(value) => {
              if (!topInputsEditable) return;
              setDraftTopData((prev) => ({ ...prev, status: value }));
            }}
            renderChip={(value) => <StatusChip status={value} />}
          />

          <ChipDropdown
            value={topInputsEditable ? draftTopData.paymentStatus : persistedTopData.paymentStatus}
            options={PAYMENT_STATUS_OPTIONS}
            disabled={isTopSaving}
            showArrow={topInputsEditable}
            interactive={topInputsEditable}
            onChange={(value) => {
              if (!topInputsEditable) return;
              setDraftTopData((prev) => ({ ...prev, paymentStatus: value }));
            }}
            renderChip={(value) => <PaymentChip status={value} />}
          />

          <IconButton
            type="button"
            onClick={startEdit}
            tone="neutral"
            aria-label="Uredi naročilo"
            title="Uredi"
            disabled={isTopSaving}
          >
            <PencilIcon />
          </IconButton>

          <IconButton
            type="button"
            onClick={() => void saveTopSection()}
            tone="neutral"
            aria-label="Shrani naročilo"
            title="Shrani"
            disabled={topSaveDisabled}
          >
            <SaveIcon />
          </IconButton>

          <button
            type="button"
            onClick={() => setIsDeleteModalOpen(true)}
            disabled={isDeleting}
            className={buttonTokenClasses.closeX}
            aria-label="Izbriši naročilo"
            title="Izbriši"
          >
            <TrashCanIcon />
          </button>
        </div>
      </div>

      {topInputsEditable ? (
        <div className="mt-4 grid min-h-[132px] gap-3 text-[12px] md:grid-cols-2">
          <div className="min-h-10 px-2.5">
            <p className="text-sm font-semibold text-slate-700">Datum</p>
            <input
              type="date"
              value={activeTopData.orderDate}
              onChange={(event) => setDraftTopData((prev) => ({ ...prev, orderDate: event.target.value }))}
              className="mt-0.5 h-6 w-full rounded-md border border-slate-300 bg-white px-2 text-xs leading-5 text-slate-900 outline-none focus:border-[#3e67d6] focus:outline-none focus:ring-0 focus:shadow-none focus-visible:outline-none focus-visible:ring-0 focus-visible:shadow-none"
            />
          </div>
          <div className="min-h-10 px-2.5">
            <p className="text-sm font-semibold text-slate-700">Tip naročnika</p>
            <select
              value={activeTopData.customerType}
              onChange={(event) => setDraftTopData((prev) => ({ ...prev, customerType: event.target.value }))}
              className="mt-0.5 h-6 w-full appearance-none rounded-md border border-slate-300 bg-white px-2 text-xs leading-5 text-slate-900 outline-none focus:border-[#3e67d6] focus:outline-none focus:ring-0 focus:shadow-none focus-visible:outline-none focus-visible:ring-0 focus-visible:shadow-none"
            >
              {CUSTOMER_TYPE_FORM_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div className="min-h-10 px-2.5">
            <p className="text-sm font-semibold text-slate-700">Naročnik</p>
            <input
              type="text"
              value={activeTopData.organizationName}
              onChange={(event) => setDraftTopData((prev) => ({ ...prev, organizationName: event.target.value }))}
              className="mt-0.5 h-6 w-full rounded-md border border-slate-300 bg-white px-2 text-xs leading-5 text-slate-900 outline-none focus:border-[#3e67d6] focus:outline-none focus:ring-0 focus:shadow-none focus-visible:outline-none focus-visible:ring-0 focus-visible:shadow-none"
            />
          </div>
          <div className="min-h-10 px-2.5">
            <p className="text-sm font-semibold text-slate-700">Email</p>
            <input
              type="email"
              value={activeTopData.email}
              onChange={(event) => setDraftTopData((prev) => ({ ...prev, email: event.target.value }))}
              className="mt-0.5 h-6 w-full rounded-md border border-slate-300 bg-white px-2 text-xs leading-5 text-slate-900 outline-none focus:border-[#3e67d6] focus:outline-none focus:ring-0 focus:shadow-none focus-visible:outline-none focus-visible:ring-0 focus-visible:shadow-none"
            />
          </div>
          <div className="min-h-10 px-2.5">
            <p className="text-sm font-semibold text-slate-700">Naslov</p>
            <input
              type="text"
              value={activeTopData.deliveryAddress}
              onChange={(event) => setDraftTopData((prev) => ({ ...prev, deliveryAddress: event.target.value }))}
              className="mt-0.5 h-6 w-full rounded-md border border-slate-300 bg-white px-2 text-xs leading-5 text-slate-900 outline-none focus:border-[#3e67d6] focus:outline-none focus:ring-0 focus:shadow-none focus-visible:outline-none focus-visible:ring-0 focus-visible:shadow-none"
            />
          </div>
          <div className="min-h-10 px-2.5">
            <p className="text-sm font-semibold text-slate-700">Opombe</p>
            <input
              type="text"
              value={activeTopData.notes}
              onChange={(event) => setDraftTopData((prev) => ({ ...prev, notes: event.target.value }))}
              className="mt-0.5 h-6 w-full rounded-md border border-slate-300 bg-white px-2 text-xs leading-5 text-slate-900 outline-none focus:border-[#3e67d6] focus:outline-none focus:ring-0 focus:shadow-none focus-visible:outline-none focus-visible:ring-0 focus-visible:shadow-none"
            />
          </div>
        </div>
      ) : (
        <div className="mt-4 grid min-h-[132px] gap-3 text-[12px] md:grid-cols-2">
          <div className="min-h-10 px-2.5">
            <p className="text-sm font-semibold text-slate-700">Datum</p>
            <p className="mt-0.5 text-xs leading-5 text-slate-900">{displayValue(activeTopData.orderDate)}</p>
          </div>
          <div className="min-h-10 px-2.5">
            <p className="text-sm font-semibold text-slate-700">Tip naročnika</p>
            <p className="mt-0.5 text-xs leading-5 text-slate-900">
              {displayValue(
                CUSTOMER_TYPE_FORM_OPTIONS.find((option) => option.value === activeTopData.customerType)?.label ??
                  activeTopData.customerType
              )}
            </p>
          </div>
          <div className="min-h-10 px-2.5">
            <p className="text-sm font-semibold text-slate-700">Naročnik</p>
            <p className="mt-0.5 text-xs leading-5 text-slate-900">{displayValue(activeTopData.organizationName)}</p>
          </div>
          <div className="min-h-10 px-2.5">
            <p className="text-sm font-semibold text-slate-700">Email</p>
            <p className="mt-0.5 text-xs leading-5 text-slate-900">{displayValue(activeTopData.email)}</p>
          </div>
          <div className="min-h-10 px-2.5">
            <p className="text-sm font-semibold text-slate-700">Naslov</p>
            <p className="mt-0.5 text-xs leading-5 text-slate-900">{displayValue(activeTopData.deliveryAddress)}</p>
          </div>
          <div className="min-h-10 px-2.5">
            <p className="text-sm font-semibold text-slate-700">Opombe</p>
            <p className="mt-0.5 whitespace-pre-wrap text-xs leading-5 text-slate-900">{displayValue(activeTopData.notes)}</p>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={isDeleteModalOpen}
        title="Izbris naročila"
        description="Ali ste prepričani, da želite izbrisati to naročilo?"
        confirmLabel="Izbriši"
        cancelLabel="Prekliči"
        isDanger
        onCancel={() => setIsDeleteModalOpen(false)}
        onConfirm={() => {
          void confirmDeleteOrder();
        }}
      />
    </div>
  );
}
