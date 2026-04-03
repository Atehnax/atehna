'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { EuiFieldText } from '@elastic/eui';
import { CUSTOMER_TYPE_FORM_OPTIONS } from '@/shared/domain/order/customerType';
import { ORDER_STATUS_OPTIONS } from '@/shared/domain/order/orderStatus';
import { toDateInputValue } from '@/shared/domain/order/dateTime';
import { PAYMENT_STATUS_OPTIONS, isPaymentStatus } from '@/shared/domain/order/paymentStatus';
import AdminHeaderField from '@/admin/components/AdminHeaderField';
import { CustomSelect } from '@/shared/ui/select';
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
  const topSelectClassName = "w-[120px] !h-8 !rounded-xl !px-3 text-xs hover:!bg-white active:!bg-white";

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
            <EuiFieldText
              value={draftOrderNumber}
              onChange={(event) =>
                setDraftOrderNumber(event.target.value.replace(/[^\d]/g, ''))
              }
              inputMode="numeric"
              aria-label="Številka naročila"
              className="!m-0 !h-10 !w-24 rounded-xl border border-slate-300 bg-white px-2.5 !text-2xl !font-bold leading-none tracking-tight text-slate-900 shadow-none focus:border-[#3e67d6] focus:outline-none focus:ring-0"
            />
          ) : (
            <span>{toEditableOrderNumber(displayOrderNumber)}</span>
          )}
          </span>
        </h1>

        <div className="ml-auto flex items-center gap-1.5">
          <CustomSelect
            value={topInputsEditable ? draftTopData.status : persistedTopData.status}
            onChange={(value) => {
              if (!topInputsEditable) return;
              setDraftTopData((prev) => ({ ...prev, status: value }));
            }}
            options={ORDER_STATUS_OPTIONS}
            disabled={!topInputsEditable || isTopSaving}
            className={topSelectClassName}
            menuClassName="max-w-[280px]"
          />

          <CustomSelect
            value={topInputsEditable ? draftTopData.paymentStatus : persistedTopData.paymentStatus}
            onChange={(value) => {
              if (!topInputsEditable) return;
              setDraftTopData((prev) => ({ ...prev, paymentStatus: value }));
            }}
            options={PAYMENT_STATUS_OPTIONS}
            disabled={!topInputsEditable || isTopSaving}
            className={topSelectClassName}
            menuClassName="max-w-[280px]"
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
        <div className="mt-4 grid min-h-[132px] items-start gap-3 text-[12px] md:grid-cols-2">
          <AdminHeaderField
            id="orderDate"
            label="Datum"
            type="date"
            value={activeTopData.orderDate}
            onChange={(event) => setDraftTopData((prev) => ({ ...prev, orderDate: event.target.value }))}
            className="border-0 bg-transparent px-2.5 py-2 font-['Inter',system-ui,sans-serif] text-[11px] leading-5 text-slate-900 focus:border-0 focus:ring-0"
          />

          <div className="group relative rounded-xl border border-slate-300 bg-white transition-colors focus-within:border-[#3e67d6] focus-within:ring-2 focus-within:ring-brand-100">
            <CustomSelect
              value={activeTopData.customerType}
              onChange={(value) => setDraftTopData((prev) => ({ ...prev, customerType: value }))}
              options={CUSTOMER_TYPE_FORM_OPTIONS}
              placeholder="Tip naročnika"
              className="!h-10 !pb-0 !pt-0 pr-7 font-['Inter',system-ui,sans-serif] text-[11px]"
              menuClassName="max-w-[280px]"
              disabled={isTopSaving}
            />
          </div>

          <AdminHeaderField
            id="organizationName"
            label="Naročnik"
            value={activeTopData.organizationName}
            onChange={(event) => setDraftTopData((prev) => ({ ...prev, organizationName: event.target.value }))}
          />

          <AdminHeaderField
            id="email"
            label="Email"
            type="email"
            value={activeTopData.email}
            onChange={(event) => setDraftTopData((prev) => ({ ...prev, email: event.target.value }))}
          />

          <AdminHeaderField
            id="deliveryAddress"
            label="Naslov"
            value={activeTopData.deliveryAddress}
            onChange={(event) => setDraftTopData((prev) => ({ ...prev, deliveryAddress: event.target.value }))}
          />

          <AdminHeaderField
            id="notes"
            label="Opombe"
            value={activeTopData.notes}
            onChange={(event) => setDraftTopData((prev) => ({ ...prev, notes: event.target.value }))}
          />
        </div>
      ) : (
        <div className="mt-4 grid min-h-[132px] gap-3 text-[12px] md:grid-cols-2">
          <div className="flex h-10 items-center px-2.5 font-['Inter',system-ui,sans-serif] text-[11px] leading-5 text-slate-900">
            {displayValue(activeTopData.orderDate)}
          </div>
          <div className="flex h-10 items-center px-2.5 font-['Inter',system-ui,sans-serif] text-[11px] leading-5 text-slate-900">
            {displayValue(
              CUSTOMER_TYPE_FORM_OPTIONS.find((option) => option.value === activeTopData.customerType)?.label ??
                activeTopData.customerType
            )}
          </div>
          <div className="flex h-10 items-center px-2.5 font-['Inter',system-ui,sans-serif] text-[11px] leading-5 text-slate-900">
            {displayValue(activeTopData.organizationName)}
          </div>
          <div className="flex h-10 items-center px-2.5 font-['Inter',system-ui,sans-serif] text-[11px] leading-5 text-slate-900">
            {displayValue(activeTopData.email)}
          </div>
          <div className="flex h-10 items-center px-2.5 font-['Inter',system-ui,sans-serif] text-[11px] leading-5 text-slate-900">
            {displayValue(activeTopData.deliveryAddress)}
          </div>
          <div className="flex h-10 items-center px-2.5 font-['Inter',system-ui,sans-serif] text-[11px] leading-5 text-slate-900">
            {displayValue(activeTopData.notes)}
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
