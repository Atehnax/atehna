'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import PaymentChip from '@/admin/features/orders/components/PaymentChip';
import StatusChip from '@/admin/features/orders/components/StatusChip';
import AdminOrderItemsEditorClient, {
  type OrderDeliveryPlanSnapshot,
  type OrderItemsSaveHandler
} from '@/admin/features/orders/components/AdminOrderItemsEditorClient';
import AdminOrderShippingOverride from '@/admin/features/orders/components/AdminOrderShippingOverride';
import AdminOrderPdfManagerClient from '@/admin/features/orders/components/AdminOrderPdfManagerClient';
import AdminOrderCustomerAccess from '@/admin/features/orders/components/AdminOrderCustomerAccess';
import AdminOrderActivityCard from '@/admin/features/orders/components/AdminOrderActivityCard';
import AdminOrderCustomerActions from '@/admin/features/orders/components/AdminOrderCustomerCard';
import AuditHistoryDrawer from '@/admin/components/AuditHistoryDrawer';
import AdminAddressAutocompleteInput from '@/admin/components/AdminAddressAutocompleteInput';
import AdminPostalLocationCombobox from '@/admin/components/AdminPostalLocationCombobox';
import customerDetailStyles from '@/shared/ui/admin-detail/AdminCustomerDetails.module.css';
import { AdminCustomerNameEditor } from '@/shared/ui/admin-detail/AdminCustomerNameEditor';
import { getCustomerIdentity } from '@/shared/domain/order/customerIdentity';
import CustomerEmailConfirmationDialog from '@/admin/features/email/components/CustomerEmailConfirmationDialog';
import { useCustomerEmailConfirmation } from '@/admin/features/email/useCustomerEmailConfirmation';
import { parseCustomerEmailConfirmationRequired } from '@/admin/features/email/customerEmailConfirmation';
import OrderNumberSuggestionMenu from '@/admin/features/orders/components/OrderNumberSuggestionMenu';
import { toDisplayOrderNumber } from '@/admin/features/orders/components/adminOrdersTableUtils';
import {
  getOrderNumberValidationMessage,
  isOrderNumberAllowed,
  sanitizeOrderNumberInput,
  useOrderNumberAvailability
} from '@/admin/features/orders/components/useOrderNumberAvailability';
import { CUSTOMER_TYPE_FORM_OPTIONS } from '@/shared/domain/order/customerType';

import { ORDER_STATUS_ACTION_OPTIONS, getStatusLabel, getStatusMenuItemClassName } from '@/shared/domain/order/orderStatus';
import { toDateInputValue } from '@/shared/domain/order/dateTime';
import { PAYMENT_STATUS_OPTIONS, getPaymentMenuItemClassName, isPaymentStatus } from '@/shared/domain/order/paymentStatus';
import { Button } from '@/shared/ui/button';
import { ConfirmDialog } from '@/shared/ui/confirm-dialog';
import { IconButton } from '@/shared/ui/icon-button';
import { UnsavedChangesDialog } from '@/shared/ui/unsaved-changes-dialog';
import {
  ActionUndoIcon,
  CopyIcon,
  PencilIcon,
  SaveIcon,
  TrashCanIcon
} from '@/shared/ui/icons/AdminActionIcons';
import { CustomSelect } from '@/shared/ui/select';
import { RowActionsDropdown } from '@/shared/ui/table';
import { useToast } from '@/shared/ui/toast';
import { useDropdownDismiss } from '@/shared/ui/dropdown/use-dropdown-dismiss';
import { AdminChipDropdown } from '@/shared/ui/admin-controls/AdminChipDropdown';
import { AdminDetailTitleSlot } from '@/shared/ui/admin-detail/AdminDetailTitleSlot';
import { AdminNotesCard } from '@/shared/ui/admin-detail/AdminNotesCard';
import {
  adminCardSectionEditIconButtonClassName,
  adminCardSectionIconActionButtonClassName,
  adminCardSectionIconClassName,
  adminTableNeutralIconButtonClassName,
  adminTablePrimaryButtonClassName,
  adminTableSelectedDangerIconButtonClassName,
  adminWindowCardClassName,
  adminWindowCardStyle
} from '@/shared/ui/admin-table';
import {
  adminControlFocusTokenClasses,
  adminStatusInfoPillGroupClassName
} from '@/shared/ui/theme/tokens';
import {
  adminCompactIconFieldInputClassName,
  adminCompactIconFieldSelectClassName,
  adminCompactIconFieldSelectValueClassName,
  adminCompactIconFieldSelectWrapperClassName,
  adminCompactIconFieldShellClassName,
  adminTopBarArticleNameInputClassName
} from '@/shared/ui/admin-controls/adminCompactFieldStyles';
import {
  isShippingBearingOrderPdfType,
  type OrderItemInput,
  type PersistedOrderPdfDocument
} from '@/shared/domain/order/orderTypes';
import type {
  ShippingCalculation,
  ShippingManualOverride
} from '@/shared/domain/shipping/shipping';

type NormalizedOrder = {
  order_number: string;
  order_code: string;
  customer_type: string;
  organization_name: string;
  contact_name: string;
  email: string;
  address_line1: string;
  address_line2?: string;
  postal_code: string;
  city: string;
  gurs_house_number_id: string;
  country_code?: string;
  commitment_status?: 'binding' | 'pending_confirmation' | 'rejected' | null;
  contract_status: 'pending_seller_acceptance' | 'accepted' | 'rejected';
  contract_accepted_at: string | null;
  contract_accepted_actor_type: string | null;
  contract_accepted_actor_id: string | null;
  contract_accepted_evidence_json: Record<string, unknown> | null;
  contract_rejected_at: string | null;
  contract_rejected_actor_type: string | null;
  contract_rejected_actor_id: string | null;
  contract_rejected_evidence_json: Record<string, unknown> | null;
  contract_rejected_reason: string | null;
  committed_at: string | null;
  source_quote_offer_version_id: number | null;
  source_quote_request_id: number | null;
  source_quote_request_number: string | null;
  source_quote_offer_number: string | null;
  source_quote_code: string | null;
  source_quote_offer_code: string | null;
  reference: string;
  notes: string;
  status: string;
  payment_status: string;
  admin_order_notes: string;
  created_at: string;
  subtotal: number;
  tax: number;
  tax_rate?: number | null;
  shipping: number;
  automatic_shipping?: number | null;
  shipping_snapshot_json?: ShippingCalculation | null;
  shipping_override_json?: ShippingManualOverride | null;
  shipping_override_stale?: boolean | null;
  parcel_count: number;
  pricing_revision: number;
  delivery_plan_revision?: number | null;
  total: number;
  is_draft?: boolean | null;
  deleted_at?: string | null;
};

const SCHOOL_PURCHASE_ORDER_EVIDENCE_FORMAT_MARKERS = new Set([
  'customer-upload-pdf-v1',
  'customer-upload-jpeg-v1',
  'admin-upload-pdf-v1'
]);

const isActivePurchaseOrderEvidence = (document: PersistedOrderPdfDocument) => {
  if (document.type !== 'purchase_order') return false;
  const markerAwareDocument = document as PersistedOrderPdfDocument & {
    format_marker?: unknown;
    formatMarker?: unknown;
  };
  const hasSnakeCaseMarker = Object.prototype.hasOwnProperty.call(
    markerAwareDocument,
    'format_marker'
  );
  const hasCamelCaseMarker = Object.prototype.hasOwnProperty.call(
    markerAwareDocument,
    'formatMarker'
  );
  if (!hasSnakeCaseMarker && !hasCamelCaseMarker) return true;
  const marker = hasSnakeCaseMarker
    ? markerAwareDocument.format_marker
    : markerAwareDocument.formatMarker;
  return typeof marker === 'string' &&
    SCHOOL_PURCHASE_ORDER_EVIDENCE_FORMAT_MARKERS.has(marker);
};

type DetailData = {
  orderDate: string;
  customerType: string;
  postalCode: string;
  city: string;
  addressLine2: string;
  countryCode: string;
  gursHouseNumberId: string;
  organizationName: string;
  contactName: string;
  email: string;
  deliveryAddress: string;
  notes: string;
  status: string;
  paymentStatus: string;
};

type PendingUnsavedAction =
  | { kind: 'exit-edit'; label: string }
  | { kind: 'navigate'; href: string; label: string };

type OrderEditScopes = {
  master: boolean;
  details: boolean;
  items: boolean;
  shipping: boolean;
  notes: boolean;
};

type OrderSectionEditScope = Exclude<keyof OrderEditScopes, 'master'>;

const EMPTY_ORDER_EDIT_SCOPES: OrderEditScopes = {
  master: false,
  details: false,
  items: false,
  shipping: false,
  notes: false
};

const DATE_DISPLAY_PATTERN = /^(\d{2})\/(\d{2})\/(\d{4})$/;

const topActionSaveButtonClassName = `gap-2 ${adminTablePrimaryButtonClassName} !h-8 !leading-none !tracking-[0] disabled:!border-transparent disabled:!bg-[color:var(--blue-500)] disabled:!text-white disabled:!opacity-50`;
const topSaveActionButtonIconClassName = 'h-[15.3px] w-[15.3px]';
const detailFieldShellClassName = `${adminCompactIconFieldShellClassName} !mt-0 !h-7 w-full`;
const detailFieldLockedShellClassName = '!border-transparent !bg-transparent !shadow-none';
const orderDataValueControlClassName =
  `${adminCompactIconFieldInputClassName} min-w-0 flex-1`;
const orderDataCompositeInputClassName =
  `${adminCompactIconFieldInputClassName} min-w-0 !h-6 !px-2 !leading-5`;
const orderDataInlineTextareaClassName =
  `${orderDataValueControlClassName} !h-5 resize-none overflow-hidden whitespace-nowrap`;
const orderDataReadValueClassName =
  "block h-6 w-full min-w-0 flex-1 select-text truncate font-['Inter',system-ui,sans-serif] text-[11px] font-normal leading-6 text-slate-900";

const toDisplayOrderNumberValue = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return '#';
  return trimmed.startsWith('#') ? trimmed : `#${trimmed}`;
};

const toEditableOrderNumber = (value: string) => value.trim().replace(/^#/, '');

const toDisplayOrderDate = (value: string) => {
  const normalized = toDateInputValue(value);
  const [year, month, day] = normalized.split('-');
  if (!year || !month || !day) return value;
  return `${day}/${month}/${year}`;
};

const orderHeaderDateFormatter = new Intl.DateTimeFormat('sl-SI', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'Europe/Ljubljana'
});

const orderHeaderCurrencyFormatter = new Intl.NumberFormat('sl-SI', {
  style: 'currency',
  currency: 'EUR'
});

const formatOrderHeaderDate = (value: string) => {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : orderHeaderDateFormatter.format(parsed);
};

const toApiOrderDate = (value: string) => {
  const trimmed = value.trim();
  const displayMatch = DATE_DISPLAY_PATTERN.exec(trimmed);
  if (displayMatch) {
    const [, day, month, year] = displayMatch;
    const isoCandidate = `${year}-${month}-${day}`;
    const parsed = new Date(`${isoCandidate}T00:00:00`);
    if (
      !Number.isNaN(parsed.getTime()) &&
      parsed.getFullYear() === Number(year) &&
      parsed.getMonth() + 1 === Number(month) &&
      parsed.getDate() === Number(day)
    ) {
      return isoCandidate;
    }
    return '';
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  return '';
};

const asDetailData = (order: NormalizedOrder): DetailData => ({
  postalCode: order.postal_code.trim(),
  orderDate: toDisplayOrderDate(order.created_at),
  customerType: order.customer_type,
  organizationName: order.organization_name ?? '',
  contactName: order.contact_name.trim() ? order.contact_name : (order.customer_type === 'individual' ? order.organization_name ?? '' : ''),
  email: order.email,
  city: order.city.trim(),
  deliveryAddress: order.address_line1.trim(),
  gursHouseNumberId: order.gurs_house_number_id.trim(),
  addressLine2: order.address_line2?.trim() ?? '',
  countryCode: order.country_code?.trim().toUpperCase() || 'SI',
  notes: order.notes?.trim() ? order.notes : '',
  status: order.status,
  paymentStatus: isPaymentStatus(order.payment_status ?? '') ? order.payment_status : 'unpaid'
});

const displayValue = (value: string) => (value.trim() ? value : '—');

const formatOrderDataAddress = (
  details: Pick<
    DetailData,
    'deliveryAddress' | 'addressLine2' | 'postalCode' | 'city' | 'countryCode'
  >
) => {
  const locality = [details.postalCode.trim(), details.city.trim()]
    .filter(Boolean)
    .join(' ');
  return [
    details.deliveryAddress.trim(),
    details.addressLine2.trim(),
    locality,
    details.countryCode.trim().toUpperCase()
  ].filter(Boolean).join(', ');
};

const formatOrderDataDate = (value: string) => {
  const isoDate = toApiOrderDate(value);
  if (!isoDate) return displayValue(value);
  const [year, month, day] = isoDate.split('-');
  return `${Number(day)}. ${Number(month)}. ${year}`;
};

function HeaderOrderIcon({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`h-[18px] w-[18px] shrink-0 text-slate-700 ${className}`}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="m15 11-1 9" />
      <path d="m19 11-4-7" />
      <path d="M2 11h20" />
      <path d="m3.5 11 1.6 7.4a2 2 0 0 0 2 1.6h9.8a2 2 0 0 0 2-1.6l1.7-7.4" />
      <path d="M4.5 15.5h15" />
      <path d="m5 11 4-7" />
      <path d="m9 11 1 9" />
    </svg>
  );
}

type DetailFieldIconType = 'number' | 'calendar' | 'customer' | 'postal' | 'type' | 'email' | 'address' | 'notes';

function DetailFieldIcon({ icon }: { icon: DetailFieldIconType }) {
  const commonProps = {
    viewBox: '0 0 20 20',
    className: 'h-[16px] w-[16px] shrink-0 text-slate-500',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.55,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true
  };

  if (icon === 'calendar') {
    return (
      <svg {...commonProps}>
        <rect x="3.5" y="4.5" width="13" height="12" rx="2" />
        <path d="M6.5 2.8v3.4M13.5 2.8v3.4M3.8 8h12.4" />
      </svg>
    );
  }

  if (icon === 'customer') {
    return (
      <svg {...commonProps}>
        <circle cx="10" cy="6.7" r="3" />
        <path d="M4.5 16.2c.8-3 2.7-4.5 5.5-4.5s4.7 1.5 5.5 4.5" />
      </svg>
    );
  }

  if (icon === 'postal') {
    return (
      <svg
        {...commonProps}
        className="h-[14.4px] w-[14.4px] shrink-0 text-slate-500"
        viewBox="0 0 24 24"
        strokeWidth={2}
      >
        <path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0" />
        <circle cx="12" cy="10" r="3" />
      </svg>
    );
  }

  if (icon === 'type') {
    return (
      <svg
        {...commonProps}
        className="h-[14px] w-[14px] shrink-0 text-slate-500"
        viewBox="0 0 24 24"
        strokeWidth={2}
      >
        <path d="M12 3v18" />
        <path d="M3 12h18" />
        <rect x="3" y="3" width="18" height="18" rx="2" />
      </svg>
    );
  }

  if (icon === 'email') {
    return (
      <svg {...commonProps}>
        <rect x="3" y="5" width="14" height="10" rx="2" />
        <path d="m4 7 6 4.3L16 7" />
      </svg>
    );
  }

  if (icon === 'address') {
    return (
      <svg {...commonProps}>
        <path d="M3.5 9.2 10 4l6.5 5.2" />
        <path d="M5.2 8.4v7h9.6v-7" />
        <path d="M8.4 15.4v-4h3.2v4" />
      </svg>
    );
  }

  return (
    <svg {...commonProps}>
      <rect x="4" y="3.5" width="12" height="13" rx="2" />
      <path d="M7 7h6M7 10h6M7 13h3.5" />
    </svg>
  );
}

function DetailFieldShell({
  isEditing,
  children,
  className = ''
}: {
  isEditing: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`${detailFieldShellClassName} ${isEditing ? '' : detailFieldLockedShellClassName} ${className}`}>
      {children}
    </div>
  );
}

function OrderAddressEditor({
  details,
  disabled,
  onChange
}: {
  details: DetailData;
  disabled: boolean;
  onChange: (patch: Partial<DetailData>) => void;
}) {
  const postalEditSequenceRef = useRef(0);

  return (
    <DetailFieldShell isEditing className={customerDetailStyles.addressShell}>
      <div
        role="group"
        aria-label="Naslovni podatki"
        className={`grid h-6 min-w-0 flex-1 grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_3.5rem_minmax(0,1fr)_2.25rem] divide-x divide-slate-200 overflow-hidden ${customerDetailStyles.addressFields}`}
        data-testid="admin-order-address-fields"
      >
        <AdminAddressAutocompleteInput
          value={details.deliveryAddress}
          gursHouseNumberId={details.gursHouseNumberId}
          disabled={disabled}
          testId="admin-order-address-autocomplete"
          onChange={(value) => onChange({
            deliveryAddress: value,
            gursHouseNumberId: ''
          })}
          onSelect={(suggestion) => {
            postalEditSequenceRef.current += 1;
            onChange({
              deliveryAddress: suggestion.addressLine1,
              postalCode: suggestion.postalCode,
              city: suggestion.postalName,
              countryCode: 'SI',
              gursHouseNumberId: suggestion.gursHouseNumberId
            });
          }}
          className={orderDataCompositeInputClassName + ' !pl-0 w-full'}
        />
        <input
          aria-label="Dodatni naslov"
          autoComplete="address-line2"
          type="text"
          value={details.addressLine2}
          disabled={disabled}
          placeholder="Dodatek"
          onChange={(event) => onChange({ addressLine2: event.target.value })}
          className={orderDataCompositeInputClassName}
        />
        <AdminPostalLocationCombobox
          field="postalCode"
          aria-label="Poštna številka"
          value={details.postalCode}
          disabled={disabled}
          testId="admin-order-postal-code-autocomplete"
          editSequenceRef={postalEditSequenceRef}
          onChange={(value) => onChange({
            postalCode: value.replace(/[^\d]/g, '').slice(0, 4),
            gursHouseNumberId: ''
          })}
          onResolve={(location) => onChange({
            postalCode: location.postalCode,
            city: location.postalName,
            gursHouseNumberId: ''
          })}
          className={`${orderDataCompositeInputClassName} text-center`}
        />
        <AdminPostalLocationCombobox
          field="postalName"
          aria-label="Kraj"
          value={details.city}
          disabled={disabled}
          testId="admin-order-city-autocomplete"
          editSequenceRef={postalEditSequenceRef}
          onChange={(value) => onChange({
            city: value,
            gursHouseNumberId: ''
          })}
          onResolve={(location) => onChange({
            postalCode: location.postalCode,
            city: location.postalName,
            gursHouseNumberId: ''
          })}
          className={orderDataCompositeInputClassName}
        />
        <input
          aria-label="Država"
          autoComplete="country"
          type="text"
          maxLength={2}
          value={details.countryCode}
          disabled={disabled}
          placeholder="SI"
          onChange={(event) => onChange({
            countryCode: event.target.value
              .toUpperCase()
              .replace(/[^A-Z]/g, '')
              .slice(0, 2),
            gursHouseNumberId: ''
          })}
          className={`${orderDataCompositeInputClassName} !px-1 text-center`}
        />
      </div>
    </DetailFieldShell>
  );
}

function OrderDatePickerField({
  value,
  isEditing,
  disabled,
  onChange
}: {
  value: string;
  isEditing: boolean;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const selectedIso = toApiOrderDate(value);
  const selectedDate = useMemo(() => (selectedIso ? new Date(`${selectedIso}T00:00:00`) : null), [selectedIso]);
  const today = new Date();
  const [visibleMonth, setVisibleMonth] = useState(() =>
    new Date((selectedDate ?? today).getFullYear(), (selectedDate ?? today).getMonth(), 1)
  );
  const rootRef = useRef<HTMLDivElement | null>(null);
  const monthFormatter = useMemo(() => new Intl.DateTimeFormat('sl-SI', { month: 'long', year: 'numeric' }), []);
  const closeCalendar = useCallback(() => setIsOpen(false), []);
  const calendarDismissRefs = useMemo(() => [rootRef], []);

  useDropdownDismiss({
    open: isOpen,
    refs: calendarDismissRefs,
    onClose: closeCalendar
  });

  const toIsoDate = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
  const syncVisibleMonthToDate = (date: Date) => {
    setVisibleMonth((current) => {
      if (current.getFullYear() === date.getFullYear() && current.getMonth() === date.getMonth()) {
        return current;
      }

      return new Date(date.getFullYear(), date.getMonth(), 1);
    });
  };
  const openCalendar = () => {
    if (disabled || !isEditing) return;
    syncVisibleMonthToDate(selectedDate ?? today);
    setIsOpen(true);
  };

  const selectDate = (date: Date) => {
    onChange(toDisplayOrderDate(toIsoDate(date)));
    setIsOpen(false);
  };
  const firstOfMonth = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), 1);
  const mondayOffset = (firstOfMonth.getDay() + 6) % 7;
  const calendarStart = new Date(firstOfMonth);
  calendarStart.setDate(firstOfMonth.getDate() - mondayOffset);
  const calendarDays = Array.from({ length: 42 }, (_, index) => {
    const date = new Date(calendarStart);
    date.setDate(calendarStart.getDate() + index);
    return date;
  });
  const selectedKey = selectedDate ? toIsoDate(selectedDate) : '';
  const todayKey = toIsoDate(today);
  const monthLabel = monthFormatter.format(visibleMonth);

  return (
    <div ref={rootRef} className="relative">
      <div className={`${detailFieldShellClassName} ${isEditing ? '' : detailFieldLockedShellClassName}`}>

        <input
          type="text"
          value={formatOrderDataDate(value)}
          readOnly
          disabled={disabled}
          role="combobox"
          aria-label="Datum naročila"
          aria-autocomplete="none"
          aria-haspopup="dialog"
          aria-expanded={isOpen}
          aria-controls={isOpen ? 'admin-order-date-picker-calendar' : undefined}
          onClick={openCalendar}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ' || event.key === 'ArrowDown') {
              event.preventDefault();
              openCalendar();
            }
          }}
          className={orderDataValueControlClassName}
        />
      </div>

      {isOpen && isEditing && !disabled ? (
        <div
          id="admin-order-date-picker-calendar"
          role="dialog"
          aria-label="Izbira datuma"
          className="absolute left-0 top-[calc(100%+4px)] z-[60] w-[218px] rounded-md border border-slate-200 bg-white p-3 shadow-[0_14px_34px_rgba(15,23,42,0.08),0_2px_6px_rgba(15,23,42,0.05)]"
        >
          <div className="mb-3 flex items-center justify-between gap-2">
            <button
              type="button"
              className="min-w-0 flex-1 truncate text-left text-[12px] font-semibold text-slate-900"
              onClick={() => setVisibleMonth(new Date(today.getFullYear(), today.getMonth(), 1))}
            >
              {monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1)}
            </button>
            <button
              type="button"
              aria-label="Prejšnji mesec"
              className={`inline-flex h-7 w-7 items-center justify-center rounded-md border border-transparent text-slate-600 hover:bg-[color:var(--hover-neutral)] ${adminControlFocusTokenClasses}`}
              onClick={() => setVisibleMonth((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1))}
            >
              ‹
            </button>
            <button
              type="button"
              aria-label="Naslednji mesec"
              className={`inline-flex h-7 w-7 items-center justify-center rounded-md border border-transparent text-slate-600 hover:bg-[color:var(--hover-neutral)] ${adminControlFocusTokenClasses}`}
              onClick={() => setVisibleMonth((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1))}
            >
              ›
            </button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-medium text-slate-700">
            {['Po', 'To', 'Sr', 'Če', 'Pe', 'So', 'Ne'].map((dayName) => (
              <div key={dayName} className="h-6 leading-6">{dayName}</div>
            ))}
            {calendarDays.map((date) => {
              const key = toIsoDate(date);
              const isCurrentMonth = date.getMonth() === visibleMonth.getMonth();
              const isSelected = key === selectedKey;
              const isToday = key === todayKey;
              return (
                <button
                  key={key}
                  type="button"
                  className={`h-7 rounded-md border border-transparent text-[12px] leading-7 transition ${adminControlFocusTokenClasses} ${
                    isSelected
                      ? 'bg-[color:var(--blue-500)] font-semibold text-white'
                      : isToday
                        ? 'border-slate-300 text-slate-900 hover:bg-[color:var(--hover-neutral)]'
                        : `${isCurrentMonth ? 'text-slate-900' : 'text-slate-400'} hover:bg-[color:var(--hover-neutral)]`
                  }`}
                  onClick={() => selectDate(date)}
                >
                  {date.getDate()}
                </button>
              );
            })}
          </div>
          <div className="mt-3 flex items-center justify-between text-[12px]">
            <button
              type="button"
              className="rounded-md px-2 py-1 text-slate-500 hover:bg-[color:var(--hover-neutral)] hover:text-slate-700"
              onClick={() => {
                onChange('');
                setIsOpen(false);
              }}
            >
              Počisti
            </button>
            <button
              type="button"
              className="rounded-md px-2 py-1 text-[color:var(--blue-500)] hover:bg-[color:var(--hover-neutral)]"
              onClick={() => selectDate(today)}
            >
              Danes
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function AdminOrderDetailClient({
  orderId,
  order,
  items,
  documents
}: {
  orderId: number;
  order: NormalizedOrder;
  items: OrderItemInput[];
  documents: PersistedOrderPdfDocument[];
}) {
  const router = useRouter();
  const { toast } = useToast();
  const customerEmailConfirmation = useCustomerEmailConfirmation();
  const initialOrderNumber = toDisplayOrderNumberValue(toDisplayOrderNumber(order.order_number));
  const resolvedCommitmentStatus: NonNullable<NormalizedOrder['commitment_status']> =
    order.commitment_status === 'rejected' || order.contract_status === 'rejected'
      ? 'rejected'
      : order.commitment_status === 'binding' && order.contract_status === 'accepted'
        ? 'binding'
        : 'pending_confirmation';
  const [displayOrderNumber, setDisplayOrderNumber] = useState(initialOrderNumber);
  const [persistedDetails, setPersistedDetails] = useState<DetailData>(() => asDetailData(order));
  const [persistedCommitmentStatus, setPersistedCommitmentStatus] = useState(resolvedCommitmentStatus);
  const hasActivePurchaseOrderEvidence = documents.some(isActivePurchaseOrderEvidence);
  const [draftDetails, setDraftDetails] = useState<DetailData>(() => asDetailData(order));
  const [draftOrderNumber, setDraftOrderNumber] = useState(toEditableOrderNumber(initialOrderNumber));
  const [persistedAdminNotes, setPersistedAdminNotes] = useState(order.admin_order_notes ?? '');
  const [draftAdminNotes, setDraftAdminNotes] = useState(order.admin_order_notes ?? '');
  const [editScopes, setEditScopes] = useState<OrderEditScopes>(() => ({
    ...EMPTY_ORDER_EDIT_SCOPES
  }));
  const [isSaving, setIsSaving] = useState(false);
  const [itemsDirty, setItemsDirty] = useState(false);
  const [itemsSaving, setItemsSaving] = useState(false);
  const [deliveryPlanSnapshot, setDeliveryPlanSnapshot] = useState<OrderDeliveryPlanSnapshot>(() => ({
    shipLaterItemIds: items.filter((item) => item.ship_later === true).map((item) => item.id),
    currentItemCount: items.filter((item) => item.ship_later !== true).length,
    laterItemCount: items.filter((item) => item.ship_later === true).length
  }));
  const [shippingDirty, setShippingDirty] = useState(false);
  const [shippingSaving, setShippingSaving] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const [activityRefreshToken, setActivityRefreshToken] = useState(0);
  const [pendingUnsavedAction, setPendingUnsavedAction] = useState<PendingUnsavedAction | null>(null);
  const itemsSaveHandlerRef = useRef<OrderItemsSaveHandler | null>(null);
  const deliveryPlanSnapshotRef = useRef(deliveryPlanSnapshot);
  const latestDeliveryPlanRevisionRef = useRef(
    Number.isSafeInteger(order.delivery_plan_revision) && Number(order.delivery_plan_revision) >= 1
      ? Number(order.delivery_plan_revision)
      : 1
  );
  const shippingSaveHandlerRef = useRef<
    ((expectedPricingRevision?: number) => Promise<boolean>) | null
  >(null);
  const latestPricingRevisionRef = useRef(order.pricing_revision);

  useEffect(() => {
    setPersistedCommitmentStatus(resolvedCommitmentStatus);
  }, [resolvedCommitmentStatus]);

  const isMasterEditing = editScopes.master;
  const isOrderDataEditing = editScopes.details;
  const isItemsEditing = editScopes.items;
  const isShippingEditing = editScopes.shipping;
  const isAdminNotesEditing = editScopes.notes;
  const isEditing =
    isMasterEditing ||
    editScopes.details ||
    editScopes.items ||
    editScopes.shipping ||
    editScopes.notes;

  const coreDetailsDirty = useMemo(() => {
    const { status: _draftStatus, paymentStatus: _draftPaymentStatus, ...draftCoreDetails } = draftDetails;
    const { status: _persistedStatus, paymentStatus: _persistedPaymentStatus, ...persistedCoreDetails } = persistedDetails;
    return (
      JSON.stringify(draftCoreDetails) !== JSON.stringify(persistedCoreDetails) ||
      draftOrderNumber.trim() !== toEditableOrderNumber(displayOrderNumber)
    );
  }, [draftDetails, persistedDetails, draftOrderNumber, displayOrderNumber]);
  const statusDirty = draftDetails.status !== persistedDetails.status;
  const paymentStatusDirty = draftDetails.paymentStatus !== persistedDetails.paymentStatus;
  const detailsDirty = coreDetailsDirty || statusDirty || paymentStatusDirty;
  const adminNotesDirty = draftAdminNotes !== persistedAdminNotes;
  const hasUnsavedChanges =
    detailsDirty || adminNotesDirty || itemsDirty || shippingDirty;
  const activeHeaderDetails = isMasterEditing ? draftDetails : persistedDetails;
  const canSelectPartiallySent =
    deliveryPlanSnapshot.currentItemCount > 0 && deliveryPlanSnapshot.laterItemCount > 0;
  const partiallySentUnavailableReason = deliveryPlanSnapshot.laterItemCount === 0
    ? 'Najprej premaknite vsaj eno postavko v razdelek »Pošljemo pozneje«.'
    : deliveryPlanSnapshot.currentItemCount === 0
      ? 'V razdelku »V tej pošiljki« mora ostati vsaj ena postavka.'
      : undefined;
  const orderStatusOptions = useMemo(
    () => ORDER_STATUS_ACTION_OPTIONS.map((option) => {
      if (option.value === 'partially_sent' && !canSelectPartiallySent) {
        return {
          ...option,
          disabled: true,
          description: partiallySentUnavailableReason
        };
      }
      if (
        (option.value === 'sent' || option.value === 'finished') &&
        deliveryPlanSnapshot.laterItemCount > 0
      ) {
        return {
          ...option,
          disabled: true,
          description: 'Najprej premaknite vse postavke iz razdelka »Pošljemo pozneje« v trenutno pošiljko.'
        };
      }
      return option;
    }),
    [
      canSelectPartiallySent,
      deliveryPlanSnapshot.laterItemCount,
      partiallySentUnavailableReason
    ]
  );
  const activeOrderDataDetails = isOrderDataEditing
    ? draftDetails
    : persistedDetails;

  const activeCustomerTypeLabel =
    CUSTOMER_TYPE_FORM_OPTIONS.find((option) => option.value === activeOrderDataDetails.customerType)?.label
    ?? activeOrderDataDetails.customerType;

  const activeAdminNotes = isAdminNotesEditing ? draftAdminNotes : persistedAdminNotes;
  const pageIsBusy = isSaving || itemsSaving || shippingSaving || isDeleting || isRejecting;
  const commercialItemsLocked =
    Boolean(order.deleted_at) ||
    Boolean(order.source_quote_offer_version_id) ||
    ['partially_sent', 'sent', 'finished', 'cancelled'].includes(persistedDetails.status) ||
    ['paid', 'refunded'].includes(persistedDetails.paymentStatus) ||
    documents.some((document) => isShippingBearingOrderPdfType(document.type));
  const deliveryPlanEditingLockedReason = order.deleted_at
    ? 'Razporeda dobave izbrisanega naročila ni mogoče spreminjati.'
    : ['sent', 'finished', 'cancelled'].includes(persistedDetails.status)
      ? `Razporeda dobave ni mogoče spreminjati pri statusu »${getStatusLabel(persistedDetails.status)}«.`
      : undefined;
  const deliveryPlanEditingLocked = deliveryPlanEditingLockedReason !== undefined;
  const pageTitle = `Naročilo ${displayOrderNumber}`;
  const customerDisplayName = getCustomerIdentity(activeHeaderDetails).name || activeHeaderDetails.email.trim() || '—';
  const activeCustomerIdentity = getCustomerIdentity(activeOrderDataDetails);
  const activeCustomerName = activeCustomerIdentity.contact
    ? `${activeCustomerIdentity.name} (${activeCustomerIdentity.contact})`
    : activeCustomerIdentity.name;
  const activeOrderNumberValue = toEditableOrderNumber(isMasterEditing ? draftOrderNumber : displayOrderNumber);
  const orderNumberSuggestionsId = `order-number-suggestions-${orderId}`;
  const orderNumberInputRef = useRef<HTMLInputElement | null>(null);
  const [isOrderNumberMenuOpen, setIsOrderNumberMenuOpen] = useState(false);
  const copyPublicOrderCode = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(order.order_code);
      toast.success('Koda naročila je kopirana.');
    } catch {
      toast.error('Kode naročila ni bilo mogoče kopirati.');
    }
  }, [order.order_code, toast]);
  const orderNumberAvailability = useOrderNumberAvailability({
    orderId,
    value: draftOrderNumber,
    enabled: isMasterEditing
  });
  const orderNumberIsAllowed = isOrderNumberAllowed(draftOrderNumber, displayOrderNumber, orderNumberAvailability);
  const orderNumberValidationMessage = getOrderNumberValidationMessage(
    draftOrderNumber,
    displayOrderNumber,
    orderNumberAvailability
  );

  useEffect(() => {
    if (!isMasterEditing) setIsOrderNumberMenuOpen(false);
  }, [isMasterEditing]);

  useEffect(() => {
    if (!hasUnsavedChanges) return;

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  const registerItemsSaveHandler = useCallback((handler: OrderItemsSaveHandler) => {
    itemsSaveHandlerRef.current = handler;
    return () => {
      if (itemsSaveHandlerRef.current === handler) {
        itemsSaveHandlerRef.current = null;
      }
    };
  }, []);

  const handleDeliveryPlanChange = useCallback((snapshot: OrderDeliveryPlanSnapshot) => {
    deliveryPlanSnapshotRef.current = snapshot;
    setDeliveryPlanSnapshot((current) =>
      current.currentItemCount === snapshot.currentItemCount &&
      current.laterItemCount === snapshot.laterItemCount &&
      current.shipLaterItemIds.length === snapshot.shipLaterItemIds.length &&
      current.shipLaterItemIds.every((id, index) => id === snapshot.shipLaterItemIds[index])
        ? current
        : snapshot
    );
  }, []);

  const registerShippingSaveHandler = useCallback((
    handler: (expectedPricingRevision?: number) => Promise<boolean>
  ) => {
    shippingSaveHandlerRef.current = handler;
    return () => {
      if (shippingSaveHandlerRef.current === handler) {
        shippingSaveHandlerRef.current = null;
      }
    };
  }, []);

  const updateLatestPricingRevision = useCallback((pricingRevision: number) => {
    if (Number.isSafeInteger(pricingRevision) && pricingRevision >= 1) {
      latestPricingRevisionRef.current = pricingRevision;
    }
  }, []);

  const updateLatestDeliveryPlanRevision = useCallback((deliveryPlanRevision: number) => {
    if (Number.isSafeInteger(deliveryPlanRevision) && deliveryPlanRevision >= 1) {
      latestDeliveryPlanRevisionRef.current = deliveryPlanRevision;
    }
  }, []);

  const resetDraftsToPersisted = useCallback(() => {
    setDraftDetails({ ...persistedDetails });
    setDraftOrderNumber(toEditableOrderNumber(displayOrderNumber));
    setDraftAdminNotes(persistedAdminNotes);
  }, [displayOrderNumber, persistedAdminNotes, persistedDetails]);

  const discardUnsavedChanges = useCallback(() => {
    resetDraftsToPersisted();
    setItemsDirty(false);
    setShippingDirty(false);
    setEditScopes({ ...EMPTY_ORDER_EDIT_SCOPES });
  }, [resetDraftsToPersisted]);

  const runPendingUnsavedAction = useCallback((action: PendingUnsavedAction) => {
    if (action.kind === 'navigate') {
      router.push(action.href);
      return;
    }

    discardUnsavedChanges();
  }, [discardUnsavedChanges, router]);

  const requestUnsavedResolution = useCallback((action: PendingUnsavedAction) => {
    if (!hasUnsavedChanges) {
      runPendingUnsavedAction(action);
      return;
    }

    setPendingUnsavedAction(action);
  }, [hasUnsavedChanges, runPendingUnsavedAction]);

  const toggleMasterEdit = () => {
    if (isMasterEditing) {
      requestUnsavedResolution({ kind: 'exit-edit', label: 'zaključkom urejanja naročila' });
      return;
    }

    if (!isEditing) resetDraftsToPersisted();
    setEditScopes({
      master: true,
      details: true,
      items: true,
      shipping: true,
      notes: true
    });
  };

  const toggleSectionEdit = (scope: OrderSectionEditScope) => {
    if (editScopes[scope]) {
      if (scope === 'details') {
        setDraftDetails((current) => ({
          ...persistedDetails,
          status: isMasterEditing ? current.status : persistedDetails.status,
          paymentStatus: isMasterEditing
            ? current.paymentStatus
            : persistedDetails.paymentStatus
        }));
        if (!isMasterEditing) {
          setDraftOrderNumber(toEditableOrderNumber(displayOrderNumber));
        }
      } else if (scope === 'notes') {
        setDraftAdminNotes(persistedAdminNotes);
      }

      setEditScopes((current) => ({ ...current, [scope]: false }));
      return;
    }

    if (!isEditing) resetDraftsToPersisted();
    setEditScopes((current) => ({ ...current, [scope]: true }));
  };

  const handleRevert = () => {
    if (!isEditing || pageIsBusy) return;
    const discardedChanges = hasUnsavedChanges;
    discardUnsavedChanges();
    if (discardedChanges) {
      toast.info('Neshranjene spremembe so razveljavljene.');
    }
  };

  useEffect(() => {
    if (!hasUnsavedChanges) return;

    const handleDocumentClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      const target = event.target as HTMLElement | null;
      const anchor = target?.closest('a[href]') as HTMLAnchorElement | null;
      if (!anchor) return;
      if (anchor.hasAttribute('download')) return;
      if (anchor.target && anchor.target !== '_self') return;

      const url = new URL(anchor.href, window.location.href);
      const currentUrl = new URL(window.location.href);
      if (url.origin !== currentUrl.origin) return;
      if (url.pathname === currentUrl.pathname && url.search === currentUrl.search && url.hash === currentUrl.hash) return;

      event.preventDefault();
      event.stopPropagation();
      requestUnsavedResolution({
        kind: 'navigate',
        href: `${url.pathname}${url.search}${url.hash}`,
        label: 'zapustitvijo strani'
      });
    };

    document.addEventListener('click', handleDocumentClick, true);
    return () => {
      document.removeEventListener('click', handleDocumentClick, true);
    };
  }, [hasUnsavedChanges, requestUnsavedResolution]);

  const saveDetails = async (
    customerEmailConfirmationToken: string | null,
    onCustomerEmailConfirmationRequired: (confirmationToken: string) => void
  ): Promise<{ finalizationMessage: string | null; confirmationRequired: boolean }> => {
    let finalizationMessage: string | null = null;
    const requests: Promise<Response>[] = [];
    let detailsResponseIndex: number | null = null;

    if (paymentStatusDirty || adminNotesDirty) {
      requests.push(
        fetch(`/api/admin/orders/${orderId}/payment-status`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: draftDetails.paymentStatus, note: draftAdminNotes })
        })
      );
    }

    if (coreDetailsDirty) {
      detailsResponseIndex = requests.length;
      requests.push(
        fetch(`/api/admin/orders/${orderId}/details`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            orderNumber: toDisplayOrderNumberValue(draftOrderNumber),
            customerType: draftDetails.customerType,
            organizationName: draftDetails.customerType === 'individual' ? '' : draftDetails.organizationName.trim(),
            contactName: draftDetails.contactName.trim() || (draftDetails.customerType === 'individual' ? getCustomerIdentity(draftDetails).name : ''),
            email: draftDetails.email,
            addressLine1: draftDetails.deliveryAddress,
            addressLine2: draftDetails.addressLine2,
            postalCode: draftDetails.postalCode,
            city: draftDetails.city,
            countryCode: draftDetails.countryCode,
            gursHouseNumberId: draftDetails.gursHouseNumberId || null,
            notes: draftDetails.notes,
            orderDate: toApiOrderDate(draftDetails.orderDate)
          })
        })
      );
    }

    if (requests.length > 0) {
      const responses = await Promise.all(requests);
      const failedResponse = responses.find((response) => !response.ok);
      if (failedResponse) {
        const error = await failedResponse.json().catch(() => ({}));
        throw new Error(error.message || 'Shranjevanje ni uspelo.');
      }

      if (detailsResponseIndex !== null) {
        const detailsPayload = await responses[detailsResponseIndex].json().catch(() => null) as {
          isDraft?: boolean;
          finalized?: boolean;
          finalizationBlock?: { message?: unknown } | null;
        } | null;
        const rawFinalizationMessage = detailsPayload?.finalizationBlock?.message;
        if (typeof rawFinalizationMessage === 'string' && rawFinalizationMessage.trim()) {
          finalizationMessage = rawFinalizationMessage.trim();
        }
      }
    }

    // The complete plan travels with a status change so entering partial shipment,
    // clearing the last deferred rows, and completing shipment are one transaction.
    if (statusDirty) {
      const statusResponse = await fetch(`/api/admin/orders/${orderId}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: draftDetails.status,
          shipLaterItemIds: deliveryPlanSnapshotRef.current.shipLaterItemIds,
          expectedDeliveryPlanRevision: latestDeliveryPlanRevisionRef.current,
          ...(customerEmailConfirmationToken
            ? { customerEmailConfirmationToken }
            : {})
        })
      });
      const statusPayload = await statusResponse.json().catch(() => ({})) as {
        message?: string;
        commitmentStatus?: NonNullable<NormalizedOrder['commitment_status']>;
        contractStatus?: NonNullable<NormalizedOrder['contract_status']>;
        deliveryPlanRevision?: number;
      };
      if (!statusResponse.ok) {
        const confirmation = parseCustomerEmailConfirmationRequired(statusPayload);
        if (
          statusResponse.status === 428 &&
          confirmation?.confirmationToken
        ) {
          customerEmailConfirmation.requestConfirmation(
            confirmation,
            () => onCustomerEmailConfirmationRequired(confirmation.confirmationToken)
          );
          return { finalizationMessage, confirmationRequired: true };
        }
        throw new Error(statusPayload.message || 'Shranjevanje statusa ni uspelo.');
      }
      const nextDeliveryPlanRevision = Number(statusPayload.deliveryPlanRevision);
      if (!Number.isSafeInteger(nextDeliveryPlanRevision) || nextDeliveryPlanRevision < 1) {
        throw new Error('Strežnik ni vrnil veljavne revizije načrta dobave.');
      }
      updateLatestDeliveryPlanRevision(nextDeliveryPlanRevision);
      const nextCommitmentStatus = statusPayload.commitmentStatus;
      const nextContractStatus = statusPayload.contractStatus;
      if (nextCommitmentStatus === 'rejected' || nextContractStatus === 'rejected') {
        setPersistedCommitmentStatus('rejected');
      } else if (nextCommitmentStatus === 'binding' && nextContractStatus === 'accepted') {
        setPersistedCommitmentStatus('binding');
      } else if (nextCommitmentStatus || nextContractStatus) {
        setPersistedCommitmentStatus('pending_confirmation');
      }
    }

    return { finalizationMessage, confirmationRequired: false };
  };
  const saveAll = async (
    afterSave?: () => void,
    customerEmailConfirmationToken: string | null = null
  ) => {
    if (!isEditing || pageIsBusy) return false;
    if (isMasterEditing && !orderNumberIsAllowed) {
      toast.error(orderNumberValidationMessage ?? 'Vnesite veljavno številko naročila.');
      return false;
    }

    setIsSaving(true);
    try {
      if (statusDirty) {
        const preflightResponse = await fetch(`/api/admin/orders/${orderId}/status`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            status: draftDetails.status,
            shipLaterItemIds: deliveryPlanSnapshotRef.current.shipLaterItemIds,
            expectedDeliveryPlanRevision: latestDeliveryPlanRevisionRef.current,
            confirmationOnly: true,
            ...(coreDetailsDirty
              ? { prospectiveCustomerEmail: draftDetails.email }
              : {}),
            ...(customerEmailConfirmationToken
              ? { customerEmailConfirmationToken }
              : {})
          })
        });
        const preflightPayload = await preflightResponse.json().catch(() => ({})) as {
          message?: string;
        };
        if (!preflightResponse.ok) {
          const confirmation = parseCustomerEmailConfirmationRequired(preflightPayload);
          if (
            preflightResponse.status === 428 &&
            confirmation?.confirmationToken
          ) {
            customerEmailConfirmation.requestConfirmation(
              confirmation,
              () => void saveAll(afterSave, confirmation.confirmationToken)
            );
            return false;
          }
          throw new Error(
            preflightPayload.message ||
              'Preverjanje e-poštnega obvestila ni uspelo.'
          );
        }
      }

      const itemsSaveResult = itemsSaveHandlerRef.current
        ? await itemsSaveHandlerRef.current({
            deliveryPlanPersistence: statusDirty ? 'status' : 'after-page-save'
          })
        : { ok: true };
      if (!itemsSaveResult.ok) return false;

      const shippingSaved = shippingSaveHandlerRef.current
        ? await shippingSaveHandlerRef.current(latestPricingRevisionRef.current)
        : true;
      if (!shippingSaved) return false;

      const saveResult = await saveDetails(
        customerEmailConfirmationToken,
        (confirmationToken) => void saveAll(afterSave, confirmationToken)
      );
      if (saveResult.confirmationRequired) return false;
      const { finalizationMessage } = saveResult;
      await itemsSaveResult.persistDeferredDeliveryPlan?.();
      itemsSaveResult.commitDeferredDeliveryPlan?.();

      const resolvedOrderNumber = draftOrderNumber.trim()
        ? toDisplayOrderNumberValue(draftOrderNumber)
        : displayOrderNumber;
      setPersistedDetails({ ...draftDetails });
      setPersistedAdminNotes(draftAdminNotes);
      setDisplayOrderNumber(resolvedOrderNumber);
      setEditScopes({ ...EMPTY_ORDER_EDIT_SCOPES });
      setActivityRefreshToken((current) => current + 1);
      if (finalizationMessage) {
        toast.info(finalizationMessage);
      } else {
        toast.success('Naročilo je shranjeno.');
      }
      router.refresh();
      afterSave?.();
      return true;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Napaka pri shranjevanju naročila.');
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const closeUnsavedDialog = () => {
    setPendingUnsavedAction(null);
  };

  const discardPendingUnsavedChanges = () => {
    if (!pendingUnsavedAction) return;
    const action = pendingUnsavedAction;
    setPendingUnsavedAction(null);
    runPendingUnsavedAction(action);
  };

  const savePendingUnsavedChanges = () => {
    if (!pendingUnsavedAction) return;
    const action = pendingUnsavedAction;
    void saveAll(() => {
      setPendingUnsavedAction(null);
      if (action.kind === 'navigate') {
        router.push(action.href);
      }
    });
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
      toast.success('Naročilo je izbrisano.');
      router.push('/admin/orders');
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Napaka pri brisanju naročila.');
    } finally {
      setIsDeleting(false);
    }
  };

  const confirmRejectOrder = async (
    customerEmailConfirmationToken: string | null = null
  ) => {
    setIsRejecting(true);
    setIsRejectModalOpen(false);
    try {
      const response = await fetch(`/api/admin/orders/${orderId}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'cancelled',
          ...(customerEmailConfirmationToken
            ? { customerEmailConfirmationToken }
            : {})
        })
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        const confirmation = parseCustomerEmailConfirmationRequired(error);
        if (response.status === 428 && confirmation?.confirmationToken) {
          customerEmailConfirmation.requestConfirmation(
            confirmation,
            () => void confirmRejectOrder(confirmation.confirmationToken)
          );
          return;
        }
        throw new Error(error.message || 'Zavrnitev naročila ni uspela.');
      }
      setPersistedDetails((current) => ({ ...current, status: 'cancelled' }));
      setDraftDetails((current) => ({ ...current, status: 'cancelled' }));
      setActivityRefreshToken((current) => current + 1);
      toast.success('Naročilo je zavrnjeno.');
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Napaka pri zavrnitvi naročila.');
    } finally {
      setIsRejecting(false);
    }
  };

  const updateDraftDetails = (updates: Partial<DetailData>) => {
    setDraftDetails((current) => ({ ...current, ...updates }));
  };

  return (
    <div className="w-full font-['Inter',system-ui,sans-serif]">
      <div className="mx-auto max-w-7xl space-y-5">
        <div className="-mb-2 text-xs text-slate-500">
          <Link href="/admin/orders" className="hover:underline">Naročila</Link>
          <span className="mx-1 text-slate-400">›</span>
          <span>{pageTitle}</span>
        </div>

        {order.is_draft && !hasUnsavedChanges ? (
          <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Osnutek lahko urejate in shranjujete sproti. Dokumenti in rezervacija zaloge bodo na voljo, ko bodo podatki popolni.
          </div>
        ) : null}

        {order.deleted_at ? (
          <div className="rounded-lg border border-rose-300/80 bg-rose-100/70 px-3 py-2 text-sm font-semibold text-rose-800">
            To naročilo je bilo izbrisano.
          </div>
        ) : null}

        <section
          className={`${adminWindowCardClassName} px-5 py-4`}
          style={adminWindowCardStyle}
          data-testid="admin-order-detail-header"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <AdminDetailTitleSlot
                  editing={isMasterEditing}
                  editor={(
                    <input
                      ref={orderNumberInputRef}
                      aria-label="Številka naročila"
                      aria-invalid={Boolean(orderNumberValidationMessage)}
                      aria-describedby={orderNumberValidationMessage ? `${orderNumberSuggestionsId}-message` : undefined}
                      name={`order-number-${orderId}`}
                      value={activeOrderNumberValue}
                      disabled={pageIsBusy}
                      title={orderNumberValidationMessage ?? undefined}
                      onFocus={() => setIsOrderNumberMenuOpen(true)}
                      onBlur={() => setIsOrderNumberMenuOpen(false)}
                      onChange={(event) => {
                        setDraftOrderNumber(sanitizeOrderNumberInput(event.target.value));
                        setIsOrderNumberMenuOpen(true);
                      }}
                      autoComplete="off"
                      spellCheck={false}
                      className={`${adminTopBarArticleNameInputClassName} admin-order-number-input !w-auto min-w-0 flex-1 text-slate-900`}
                    />
                  )}
                  editorAccessory={(
                    <>
                      <OrderNumberSuggestionMenu
                        anchorRef={orderNumberInputRef}
                        open={isOrderNumberMenuOpen}
                        currentValue={toEditableOrderNumber(displayOrderNumber)}
                        suggestions={orderNumberAvailability.suggestions}
                        onSelect={(suggestion) => {
                          setDraftOrderNumber(sanitizeOrderNumberInput(suggestion));
                          setIsOrderNumberMenuOpen(false);
                          window.setTimeout(() => orderNumberInputRef.current?.focus(), 0);
                        }}
                      />
                      {orderNumberValidationMessage ? (
                        <span id={`${orderNumberSuggestionsId}-message`} className="sr-only">
                          {orderNumberValidationMessage}
                        </span>
                      ) : null}
                    </>
                  )}
                  editorPrefix="Naročilo #"
                  icon={<HeaderOrderIcon />}
                  invalid={Boolean(orderNumberValidationMessage)}
                  testId="admin-order-title-slot"
                  title={pageTitle}
                  width="compact"
                />
                <div
                  className={adminStatusInfoPillGroupClassName}
                  data-testid="admin-order-header-statuses"
                >
                  <AdminChipDropdown
                    value={activeHeaderDetails.status}
                    options={orderStatusOptions}
                    disabled={pageIsBusy}
                    showArrow={isMasterEditing}
                    interactive={isMasterEditing}
                    onChange={(value) => updateDraftDetails({ status: value })}
                    renderChip={(value) => <StatusChip status={value} />}
                    optionClassName={getStatusMenuItemClassName}
                  />
                  <AdminChipDropdown
                    value={activeHeaderDetails.paymentStatus}
                    options={PAYMENT_STATUS_OPTIONS}
                    disabled={pageIsBusy}
                    showArrow={isMasterEditing}
                    interactive={isMasterEditing}
                    onChange={(value) => updateDraftDetails({ paymentStatus: value })}
                    renderChip={(value) => <PaymentChip status={value} />}
                    optionClassName={getPaymentMenuItemClassName}
                  />
                </div>
              </div>

            </div>

            <div className="flex flex-wrap items-center justify-end gap-2 sm:flex-nowrap">
              <IconButton
                type="button"
                onClick={toggleMasterEdit}
                tone="neutral"
                size="sm"
                className={adminTableNeutralIconButtonClassName}
                aria-label={isMasterEditing ? 'Končaj urejanje naročila' : 'Uredi celotno naročilo'}
                title={isMasterEditing ? 'Končaj urejanje' : 'Uredi vse podatke naročila'}
                disabled={pageIsBusy}
              >
                <PencilIcon />
              </IconButton>
              <IconButton
                type="button"
                onClick={handleRevert}
                tone="neutral"
                size="sm"
                className={adminTableNeutralIconButtonClassName}
                aria-label="Razveljavi neshranjene spremembe"
                title="Razveljavi neshranjene spremembe"
                disabled={!isEditing || pageIsBusy}
              >
                <ActionUndoIcon />
              </IconButton>
              <AuditHistoryDrawer
                entityType="order"
                entityId={orderId}
                entityLabel={displayOrderNumber}
              />
              <IconButton
                type="button"
                onClick={() => setIsDeleteModalOpen(true)}
                tone="danger"
                size="sm"
                className={adminTableSelectedDangerIconButtonClassName}
                aria-label="Izbriši naročilo"
                title="Izbriši"
                disabled={pageIsBusy}
              >
                <TrashCanIcon />
              </IconButton>
              <Button
                type="button"
                variant="primary"
                size="toolbar"
                className={topActionSaveButtonClassName}
                onClick={() => void saveAll()}
                disabled={
                  !isEditing ||
                  pageIsBusy ||
                  (isMasterEditing && !orderNumberIsAllowed)
                }
              >
                <SaveIcon className={topSaveActionButtonIconClassName} />
                <span>Shrani</span>
              </Button>
              <RowActionsDropdown
                label="Več dejanj za naročilo"
                triggerClassName={adminTableNeutralIconButtonClassName}
                menuWidth={190}
                items={[
                  {
                    key: 'reject',
                    label: 'Zavrni naročilo',
                    onSelect: () => setIsRejectModalOpen(true),
                    disabled: pageIsBusy || isEditing || Boolean(order.deleted_at) || Boolean(order.is_draft) || activeHeaderDetails.status === 'cancelled',
                    className: '!text-rose-700'
                  }
                ]}
              />
            </div>
          </div>

          <div className="mt-3 grid min-w-0 gap-4 lg:grid-cols-[max-content_minmax(0,1fr)] lg:items-end">
            <div className="min-w-0 lg:max-w-[360px]">
              <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
                <span>{formatOrderHeaderDate(order.created_at)}</span>
                <span aria-hidden>·</span>
                <span>{customerDisplayName}</span>
                <span aria-hidden>·</span>
                <span className="font-semibold tabular-nums text-slate-700">{orderHeaderCurrencyFormatter.format(order.total)}</span>
              </p>
              {order.source_quote_request_id ? (
                <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
                  {order.source_quote_offer_number ? (
                    <span>
                      Iz ponudbe {order.source_quote_offer_code ?? order.source_quote_offer_number}
                      {order.source_quote_offer_code && order.source_quote_offer_number
                        ? ` · interno ${order.source_quote_offer_number}`
                        : ''}
                    </span>
                  ) : null}
                  {order.source_quote_request_number ? (
                    <Link
                      href={'/admin/orders/quotes/' + order.source_quote_request_id}
                      className="font-semibold text-[color:var(--blue-500)] hover:underline"
                    >
                      Povpraševanje {order.source_quote_code ?? order.source_quote_request_number}
                      {order.source_quote_code && order.source_quote_request_number
                        ? ` · interno ${order.source_quote_request_number}`
                        : ''}
                    </Link>
                  ) : null}
                </div>
              ) : null}
            </div>

            <AdminOrderActivityCard
              orderId={orderId}
              refreshToken={activityRefreshToken}
            />
          </div>

        </section>

        <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-5 lg:grid-cols-[minmax(0,1.23fr)_minmax(340px,0.77fr)]">
          <div className="flex min-w-0 flex-col gap-5">
            <AdminOrderItemsEditorClient
              orderId={orderId}
              items={items}
              initialSubtotal={order.subtotal}
              initialTax={order.tax}
              initialShipping={order.shipping}
              initialShippingOverride={Boolean(order.shipping_override_json)}
              initialShippingOverrideStale={order.shipping_override_stale === true}
              initialShippingManualQuote={
                order.shipping_snapshot_json?.status === 'manual_quote'
                && !order.shipping_override_json
              }
              initialTaxRate={order.tax_rate ?? 0.22}
              externalEditMode={isItemsEditing}
              hideSectionEditControls
              onRequestEdit={() => toggleSectionEdit('items')}
              sectionEditDisabled={pageIsBusy}
              commercialEditingLocked={commercialItemsLocked}
              deliveryPlanEditingLocked={deliveryPlanEditingLocked}
              deliveryPlanEditingLockedReason={deliveryPlanEditingLockedReason}
              initialDeliveryPlanRevision={latestDeliveryPlanRevisionRef.current}
              onDirtyChange={setItemsDirty}
              onDeliveryPlanChange={handleDeliveryPlanChange}
              onDeliveryPlanRevisionChange={updateLatestDeliveryPlanRevision}
              onSavingChange={setItemsSaving}
              onRegisterSave={registerItemsSaveHandler}
              onPricingRevisionChange={updateLatestPricingRevision}
            />


            <section
              className={`${adminWindowCardClassName} ${customerDetailStyles.customerCard} order-first p-4`}
              style={adminWindowCardStyle}
              data-testid="admin-order-data-card"
            >
              <div className="flex items-center justify-between gap-4">
                <div className="flex min-w-0 items-center gap-2">
                  <h2 className="text-base font-semibold text-slate-900">Podatki naročila</h2>
                  <AdminOrderCustomerActions
                    orderId={orderId}
                    organizationName={persistedDetails.customerType === 'individual' ? '' : persistedDetails.organizationName}
                    contactName={persistedDetails.contactName}
                    email={persistedDetails.email}
                    addressLine1={persistedDetails.deliveryAddress}
                    addressLine2={persistedDetails.addressLine2}
                    postalCode={persistedDetails.postalCode}
                    city={persistedDetails.city}
                    countryCode={persistedDetails.countryCode}
                  />
                </div>
                <button
                  type="button"
                  className={`${adminCardSectionEditIconButtonClassName} ${isOrderDataEditing ? 'bg-[color:var(--hover-neutral)]' : ''}`}
                  onClick={() => toggleSectionEdit('details')}
                  aria-label="Uredi podatke naročila"
                  aria-pressed={isOrderDataEditing}
                  title="Uredi podatke"
                  disabled={pageIsBusy}
                  data-admin-card-edit-action="order-data"
                >
                  <PencilIcon className="h-4 w-4" />
                </button>
              </div>

              <dl className={`mt-2 grid min-w-0 gap-x-8 md:grid-cols-2 ${customerDetailStyles.detailsGrid}`}>
                <OrderDataRow label="Številka naročila" value={order.order_code} icon="number" isEditing={false}
                  readContent={(
                    <div className={customerDetailStyles.publicCode}>
                      <span>{order.order_code}</span>
                      <button type="button" onClick={() => void copyPublicOrderCode()}
                        className={adminCardSectionIconActionButtonClassName}
                        aria-label={`Kopiraj kodo naročila ${order.order_code}`}
                        title="Kopiraj kodo naročila" data-testid="admin-order-public-code-copy">
                        <CopyIcon className={adminCardSectionIconClassName} />
                      </button>
                    </div>
                  )}
                />
                <OrderDataRow
                  label="Datum"
                  value={formatOrderDataDate(activeOrderDataDetails.orderDate)}
                  icon="calendar"
                  isEditing={isOrderDataEditing}
                >
                  <OrderDatePickerField
                    value={activeOrderDataDetails.orderDate}
                    isEditing={isOrderDataEditing}
                    disabled={pageIsBusy}
                    onChange={(value) => updateDraftDetails({ orderDate: value })}
                  />
                </OrderDataRow>
                <OrderDataRow
                  label="Tip naročnika"
                  value={activeCustomerTypeLabel}
                  icon="type"
                  isEditing={isOrderDataEditing}
                  reserveTrailingControl
                >
                  <DetailFieldShell isEditing>
                    <CustomSelect
                      ariaLabel="Tip naročnika"
                      value={activeOrderDataDetails.customerType}
                      onChange={(value) => updateDraftDetails({ customerType: value })}
                      options={CUSTOMER_TYPE_FORM_OPTIONS}
                      disabled={pageIsBusy}
                      showArrow
                      containerClassName={adminCompactIconFieldSelectWrapperClassName}
                      triggerClassName={`${adminCompactIconFieldSelectClassName} disabled:!cursor-default disabled:!text-slate-900 disabled:!opacity-100`}
                      valueClassName={`${adminCompactIconFieldSelectValueClassName} !pb-0`}
                    />
                  </DetailFieldShell>
                </OrderDataRow>
                <OrderDataRow label={activeOrderDataDetails.customerType === 'individual' ? 'Naročnik' : 'Naziv'} value={activeCustomerName} icon="customer" isEditing={isOrderDataEditing}>
                  <AdminCustomerNameEditor values={activeOrderDataDetails} disabled={pageIsBusy} onChange={updateDraftDetails} />
                </OrderDataRow>
                <OrderDataRow label="Email" value={activeOrderDataDetails.email} icon="email" isEditing={isOrderDataEditing}>
                  <DetailFieldShell isEditing>
                    <input
                      type="email"
                      aria-label="Email"
                      value={activeOrderDataDetails.email}
                      disabled={pageIsBusy}
                      onChange={(event) => updateDraftDetails({ email: event.target.value })}
                      className={orderDataValueControlClassName}
                    />
                  </DetailFieldShell>
                </OrderDataRow>
                <OrderDataRow
                  label="Naslov"
                  value={formatOrderDataAddress(activeOrderDataDetails)}
                  icon="address"
                  isEditing={isOrderDataEditing}
                >
                  <OrderAddressEditor
                    details={activeOrderDataDetails}
                    disabled={pageIsBusy}
                    onChange={updateDraftDetails}
                  />
                </OrderDataRow>
                <OrderDataRow
                  label="Sporočilo stranke"
                  value={activeOrderDataDetails.notes}
                  icon="notes"
                  isEditing={isOrderDataEditing}
                  fullWidth
                >
                  <DetailFieldShell isEditing>
                    <textarea
                      rows={1}
                      wrap="off"
                      value={activeOrderDataDetails.notes}
                      readOnly={pageIsBusy}
                      onChange={(event) => updateDraftDetails({ notes: event.target.value })}
                      aria-label="Sporočilo stranke"
                      className={orderDataInlineTextareaClassName}
                    />
                  </DetailFieldShell>
                </OrderDataRow>
              </dl>
            </section>
          </div>

          <aside className="flex w-full min-w-0 flex-col gap-5">

            <AdminNotesCard
              headingId="admin-order-notes-title"
              testId="admin-order-admin-notes-card"
              editActionId="notes"
              isEditing={isAdminNotesEditing}
              value={activeAdminNotes}
              persistedValue={persistedAdminNotes}
              onChange={setDraftAdminNotes}
              onToggle={() => toggleSectionEdit('notes')}
              disabled={pageIsBusy}
              autoFocus={editScopes.notes && !isMasterEditing}
            />

            <AdminOrderShippingOverride
              orderId={orderId}
              shipping={order.shipping}
              automaticShipping={order.automatic_shipping ?? null}
              shippingCalculation={order.shipping_snapshot_json ?? null}
              shippingOverride={order.shipping_override_json ?? null}
              shippingOverrideStale={order.shipping_override_stale === true}
              parcelCount={order.parcel_count}
              pricingRevision={order.pricing_revision}
              orderStatus={persistedDetails.status}
              paymentStatus={persistedDetails.paymentStatus}
              deleted={Boolean(order.deleted_at)}
              hasActiveDocuments={documents.some((document) =>
                isShippingBearingOrderPdfType(document.type)
              )}
              quoteDerived={order.source_quote_offer_version_id !== null}
              externalEditMode={isShippingEditing}
              onRequestEdit={() => toggleSectionEdit('shipping')}
              onDirtyChange={setShippingDirty}
              onSavingChange={setShippingSaving}
              onPricingRevisionChange={updateLatestPricingRevision}
              onRegisterSave={registerShippingSaveHandler}
              pageBusy={pageIsBusy}
            />

            <AdminOrderPdfManagerClient
              orderId={orderId}
              orderCode={order.order_code}
              documents={documents}
              unsavedChangesReason={
                hasUnsavedChanges
                  ? 'Pred ustvarjanjem ali nalaganjem PDF dokumentov najprej shranite spremembe.'
                  : undefined
              }
              generationDisabledReason={
                order.is_draft
                  ? 'Dokument lahko ustvarite po shranitvi dokončanega osnutka z veljavno poštnino.'
                  : order.shipping_override_stale
                    ? 'Pred izdajo dokumenta preračunajte ali odstranite zastarelo ročno poštnino.'
                    : undefined
              }
            />

            {!order.is_draft ? (
              <AdminOrderCustomerAccess
                orderId={orderId}
                customerType={persistedDetails.customerType}
                hasActivePurchaseOrderEvidence={hasActivePurchaseOrderEvidence}
                initialCommitmentStatus={persistedCommitmentStatus}
                compact
              />
            ) : null}
          </aside>
        </div>
      </div>

      <CustomerEmailConfirmationDialog
        confirmation={customerEmailConfirmation.confirmation}
        onCancel={customerEmailConfirmation.cancelConfirmation}
        onConfirm={customerEmailConfirmation.confirm}
        confirmDisabled={pageIsBusy}
      />

      <UnsavedChangesDialog
        open={pendingUnsavedAction !== null}
        label={pendingUnsavedAction?.label}
        isSaving={isSaving || itemsSaving || shippingSaving}
        saveDisabled={!hasUnsavedChanges || pageIsBusy}
        onSave={savePendingUnsavedChanges}
        onContinueEditing={closeUnsavedDialog}
        onDiscard={discardPendingUnsavedChanges}
      />

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

      <ConfirmDialog
        open={isRejectModalOpen}
        title="Zavrnitev naročila"
        description="Naročilo bo zavrnjeno in označeno kot preklicano. Morebitna zadržana zaloga bo varno sproščena."
        confirmLabel="Zavrni naročilo"
        cancelLabel="Prekliči"
        isDanger
        onCancel={() => setIsRejectModalOpen(false)}
        onConfirm={() => {
          void confirmRejectOrder();
        }}
      />
    </div>
  );
}

function OrderDataRow({
  label,
  value,
  icon,
  isEditing,
  fullWidth = false,
  reserveTrailingControl = false,
  readContent,
  children
}: {
  label: string;
  value: string;
  icon: DetailFieldIconType;
  isEditing: boolean;
  fullWidth?: boolean;
  reserveTrailingControl?: boolean;
  readContent?: ReactNode;
  children?: ReactNode;
}) {
  const display = displayValue(value);

  return (
    <div
      className={`grid min-h-[35px] min-w-0 items-center gap-3 ${customerDetailStyles.detailRow} ${icon === 'address' ? customerDetailStyles.addressRow : ''} ${
        fullWidth
          ? 'grid-cols-[120px_minmax(0,1fr)] md:col-span-2'
          : 'grid-cols-[minmax(120px,0.42fr)_minmax(0,1fr)]'
      }`}
      data-order-data-row={label}
      data-detail-editing={isEditing}
      data-order-data-span={fullWidth ? 'full' : undefined}
    >
      <dt className="flex min-w-0 items-center gap-1.5 text-[12px] font-medium text-slate-500">
        <DetailFieldIcon icon={icon} />
        <span className="min-w-0 truncate">{label}</span>
      </dt>
      <dd
        className="min-w-0"
        title={!isEditing && display !== '—' ? display : undefined}
        data-order-data-value
      >
        {readContent ?? (isEditing ? (
          children
        ) : (
          <DetailFieldShell isEditing={false}>
            <span className={`${orderDataReadValueClassName} ${reserveTrailingControl ? 'pr-5' : ''}`}>
              {display}
            </span>
          </DetailFieldShell>
        ))}
      </dd>
    </div>
  );
}
