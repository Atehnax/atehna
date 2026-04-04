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
import { CustomSelect } from '@/shared/ui/select';
import { ConfirmDialog } from '@/shared/ui/confirm-dialog';
import { IconButton } from '@/shared/ui/icon-button';
import { PencilIcon, SaveIcon, TrashCanIcon } from '@/shared/ui/icons/AdminActionIcons';
import { useToast } from '@/shared/ui/toast';
import { adminInputFocusTokenClasses, buttonTokenClasses } from '@/shared/ui/theme/tokens';

type TopSectionMode = 'read' | 'edit';

const toDisplayOrderNumberValue = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return '#';
  return trimmed.startsWith('#') ? trimmed : `#${trimmed}`;
};
const toEditableOrderNumber = (value: string) => value.trim().replace(/^#/, '');
const DATE_DISPLAY_PATTERN = /^(\d{2})\/(\d{2})\/(\d{4})$/;

const toDisplayOrderDate = (value: string) => {
  const normalized = toDateInputValue(value);
  const [year, month, day] = normalized.split('-');
  if (!year || !month || !day) return value;
  return `${day}/${month}/${year}`;
};

const toApiOrderDate = (value: string) => {
  const trimmed = value.trim();
  const displayMatch = DATE_DISPLAY_PATTERN.exec(trimmed);
  if (displayMatch) {
    const [, day, month, year] = displayMatch;
    const isoCandidate = `${year}-${month}-${day}`;
    const parsed = new Date(`${isoCandidate}T00:00:00`);
    if (!Number.isNaN(parsed.getTime()) && parsed.getUTCFullYear() === Number(year) && parsed.getUTCMonth() + 1 === Number(month) && parsed.getUTCDate() === Number(day)) {
      return isoCandidate;
    }
    return '';
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  return '';
};

type TopData = {
  orderDate: string;
  customerType: string;
  postalCode: string;
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
  postalCode?: string | null;
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
  postalCode,
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
  postalCode?: string | null;
  notes: string | null;
  status: string;
  paymentStatus?: string | null;
}): TopData => ({
  postalCode:
    (typeof postalCode === 'string' && postalCode.trim()) ||
    (deliveryAddress?.match(/\b\d{4}\b/)?.[0] ?? ''),
  orderDate: toDisplayOrderDate(createdAt),
  customerType,
  organizationName: organizationName?.trim() ? organizationName : contactName,
  contactName,
  email,
  deliveryAddress: (deliveryAddress ?? '').replace(/\b\d{4}\b/g, '').replace(/\s{2,}/g, ' ').trim(),
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
            postalCode: draftTopData.postalCode,
            notes: draftTopData.notes,
            orderDate: toApiOrderDate(draftTopData.orderDate)
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
  const editableInputClassName = `mt-0.5 h-5 w-full rounded-md border border-slate-300 bg-white px-1.5 text-xs leading-5 text-slate-900 ${adminInputFocusTokenClasses}`;
  const editableTextareaClassName = `mt-0.5 min-h-5 w-full resize-y rounded-md border border-slate-300 bg-white px-1.5 text-xs leading-5 text-slate-900 ${adminInputFocusTokenClasses}`;

  return (
    <div className="min-h-[258px] rounded-2xl border border-slate-200 bg-gradient-to-r from-white to-slate-50 px-4 py-3 shadow-sm font-['Inter',system-ui,sans-serif]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="flex h-10 flex-nowrap items-center gap-1 whitespace-nowrap text-lg font-semibold tracking-tight text-slate-900">
          <span>Naročilo</span>
          <span className="inline-flex h-10 items-center gap-0">
            <span>#</span>
          {topInputsEditable ? (
            <span
              role="textbox"
              contentEditable
              suppressContentEditableWarning
              aria-label="Številka naročila"
              onInput={(event) => {
                const raw = event.currentTarget.textContent ?? '';
                const digitsOnly = raw.replace(/[^\d]/g, '');
                if (raw !== digitsOnly) event.currentTarget.textContent = digitsOnly;
                setDraftOrderNumber(digitsOnly);
              }}
              onBlur={(event) => {
                event.currentTarget.textContent = draftOrderNumber;
              }}
              className="inline-flex h-[1.45em] w-[6ch] items-center rounded-md border border-slate-300 bg-white px-1.5 py-0 font-inherit text-inherit leading-none tracking-tight text-slate-900 shadow-none outline-none focus:border-[#3e67d6] focus:outline-none focus:ring-0 focus:shadow-none focus-visible:outline-none focus-visible:ring-0 focus-visible:shadow-none"
            >
              {draftOrderNumber}
            </span>
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
              type="text"
              value={activeTopData.orderDate}
              onChange={(event) => setDraftTopData((prev) => ({ ...prev, orderDate: event.target.value }))}
              onBlur={(event) => {
                const normalized = toApiOrderDate(event.target.value);
                if (!normalized) return;
                setDraftTopData((prev) => ({ ...prev, orderDate: toDisplayOrderDate(normalized) }));
              }}
              placeholder="dd/mm/yyyy"
              className={editableInputClassName}
            />
          </div>
          <div className="min-h-10 px-2.5">
            <p className="text-sm font-semibold text-slate-700">Tip naročnika</p>
            <CustomSelect
              value={activeTopData.customerType}
              onChange={(value) => setDraftTopData((prev) => ({ ...prev, customerType: value }))}
              options={CUSTOMER_TYPE_FORM_OPTIONS}
              className="mt-0.5 !h-5 w-full !rounded-md border border-slate-300 bg-white px-1.5 font-['Inter',system-ui,sans-serif] text-xs leading-5 text-slate-900 hover:bg-white focus:border-[#3e67d6]"
              valueClassName="font-['Inter',system-ui,sans-serif]"
              menuClassName="max-w-[280px]"
              disabled={isTopSaving}
            />
          </div>
          <div className="min-h-10 px-2.5">
            <p className="text-sm font-semibold text-slate-700">Naročnik</p>
            <input
              type="text"
              value={activeTopData.organizationName}
              onChange={(event) => setDraftTopData((prev) => ({ ...prev, organizationName: event.target.value }))}
              className={editableInputClassName}
            />
          </div>
          <div className="min-h-10 px-2.5">
            <p className="text-sm font-semibold text-slate-700">Email</p>
            <input
              type="email"
              value={activeTopData.email}
              onChange={(event) => setDraftTopData((prev) => ({ ...prev, email: event.target.value }))}
              className={editableInputClassName}
            />
          </div>
          <div className="min-h-10 px-2.5">
            <p className="text-sm font-semibold text-slate-700">Poštna številka</p>
            <input
              type="text"
              inputMode="numeric"
              maxLength={4}
              value={activeTopData.postalCode}
              onChange={(event) =>
                setDraftTopData((prev) => ({
                  ...prev,
                  postalCode: event.target.value.replace(/[^\d]/g, '').slice(0, 4)
                }))
              }
              className={editableInputClassName}
            />
          </div>
          <div className="min-h-10 px-2.5">
            <p className="text-sm font-semibold text-slate-700">Naslov</p>
            <input
              type="text"
              value={activeTopData.deliveryAddress}
              onChange={(event) => setDraftTopData((prev) => ({ ...prev, deliveryAddress: event.target.value }))}
              className={editableInputClassName}
            />
          </div>
          <div className="min-h-10 px-2.5 md:col-span-1">
            <p className="text-sm font-semibold text-slate-700">Opombe stranke</p>
            <textarea
              rows={1}
              value={activeTopData.notes}
              onChange={(event) => setDraftTopData((prev) => ({ ...prev, notes: event.target.value }))}
              className={editableTextareaClassName}
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
            <p className="text-sm font-semibold text-slate-700">Poštna številka</p>
            <p className="mt-0.5 text-xs leading-5 text-slate-900">{displayValue(activeTopData.postalCode)}</p>
          </div>
          <div className="min-h-10 px-2.5">
            <p className="text-sm font-semibold text-slate-700">Naslov</p>
            <p className="mt-0.5 whitespace-pre-wrap text-xs leading-5 text-slate-900">{displayValue(activeTopData.deliveryAddress)}</p>
          </div>
          <div className="min-h-10 px-2.5">
            <p className="text-sm font-semibold text-slate-700">Opombe stranke</p>
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
