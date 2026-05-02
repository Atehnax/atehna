'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import PaymentChip from '@/admin/components/PaymentChip';
import StatusChip from '@/admin/components/StatusChip';
import AdminOrderItemsEditorClient from '@/admin/components/AdminOrderItemsEditorClient';
import AdminOrderPdfManagerClient from '@/admin/components/AdminOrderPdfManagerClient';
import AuditHistoryDrawer from '@/admin/components/AuditHistoryDrawer';
import OrderNumberSuggestionMenu from '@/admin/components/OrderNumberSuggestionMenu';
import { toDisplayOrderNumber } from '@/admin/components/adminOrdersTableUtils';
import {
  getOrderNumberValidationMessage,
  isOrderNumberAllowed,
  sanitizeOrderNumberInput,
  useOrderNumberAvailability
} from '@/admin/components/useOrderNumberAvailability';
import { CUSTOMER_TYPE_FORM_OPTIONS } from '@/shared/domain/order/customerType';
import { ORDER_STATUS_OPTIONS, getStatusMenuItemClassName } from '@/shared/domain/order/orderStatus';
import { toDateInputValue } from '@/shared/domain/order/dateTime';
import { PAYMENT_STATUS_OPTIONS, getPaymentMenuItemClassName, isPaymentStatus } from '@/shared/domain/order/paymentStatus';
import { Button } from '@/shared/ui/button';
import { ConfirmDialog } from '@/shared/ui/confirm-dialog';
import { IconButton } from '@/shared/ui/icon-button';
import { UnsavedChangesDialog } from '@/shared/ui/unsaved-changes-dialog';
import {
  ActionUndoIcon,
  PencilIcon,
  SaveIcon,
  TrashCanIcon
} from '@/shared/ui/icons/AdminActionIcons';
import { MenuItem, MenuPanel } from '@/shared/ui/menu';
import { CustomSelect } from '@/shared/ui/select';
import { useToast } from '@/shared/ui/toast';
import {
  adminTableNeutralIconButtonClassName,
  adminTablePrimaryButtonClassName,
  adminTableSelectedDangerIconButtonClassName,
  adminWindowCardClassName,
  adminWindowCardStyle
} from '@/shared/ui/admin-table';
import { adminInputFocusTokenClasses, adminStatusInfoPillGroupClassName } from '@/shared/ui/theme/tokens';
import {
  adminCompactExpandableTextareaClassName,
  adminCompactIconFieldInputClassName,
  adminCompactIconFieldSelectClassName,
  adminCompactIconFieldSelectValueClassName,
  adminCompactIconFieldSelectWrapperClassName,
  adminCompactIconFieldShellClassName,
  adminTopBarArticleNameInputClassName,
  adminTopBarTitleTextClassName
} from '@/shared/ui/admin-controls/adminCompactFieldStyles';
import type { OrderItemInput, PersistedOrderPdfDocument } from '@/shared/domain/order/orderTypes';

type NormalizedOrder = {
  order_number: string;
  customer_type: string;
  organization_name: string;
  contact_name: string;
  email: string;
  delivery_address: string;
  postal_code?: string | null;
  reference: string;
  notes: string;
  status: string;
  payment_status: string;
  admin_order_notes: string;
  created_at: string;
  subtotal: number;
  tax: number;
  total: number;
  is_draft?: boolean | null;
  deleted_at?: string | null;
};

type DetailData = {
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

type ChipDropdownProps = {
  value: string;
  options: ReadonlyArray<{ value: string; label: string }>;
  onChange: (value: string) => void;
  renderChip: (value: string) => ReactNode;
  disabled?: boolean;
  showArrow?: boolean;
  interactive?: boolean;
  optionClassName?: (value: string) => string;
};

type PendingUnsavedAction =
  | { kind: 'exit-edit'; label: string }
  | { kind: 'navigate'; href: string; label: string };

const DATE_DISPLAY_PATTERN = /^(\d{2})\/(\d{2})\/(\d{4})$/;

const topActionSaveButtonClassName = `gap-2 ${adminTablePrimaryButtonClassName} !h-8 !leading-none !tracking-[0] disabled:!border-transparent disabled:!bg-[color:var(--blue-500)] disabled:!text-white disabled:!opacity-50`;
const topSaveActionButtonIconClassName = 'h-[15.3px] w-[15.3px]';
const detailFieldShellClassName = `${adminCompactIconFieldShellClassName} !mt-0 !h-8 w-full`;
const detailFieldLockedShellClassName = '!bg-[color:var(--field-locked-bg)]';
const adminNotesTextareaClassName =
  `h-[64px] min-h-[64px] w-full resize-y rounded-md border border-slate-300 px-3 py-2 text-[13px] leading-5 text-slate-900 transition ${adminInputFocusTokenClasses}`;
const labelClassName = 'text-sm font-semibold leading-5 text-slate-900';

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
  postalCode:
    (typeof order.postal_code === 'string' && order.postal_code.trim()) ||
    (order.delivery_address?.match(/\b\d{4}\b/)?.[0] ?? ''),
  orderDate: toDisplayOrderDate(order.created_at),
  customerType: order.customer_type,
  organizationName: order.organization_name?.trim() ? order.organization_name : order.contact_name,
  contactName: order.contact_name,
  email: order.email,
  deliveryAddress: (order.delivery_address ?? '').replace(/\b\d{4}\b/g, '').replace(/\s{2,}/g, ' ').trim(),
  notes: order.notes?.trim() ? order.notes : '',
  status: order.status,
  paymentStatus: isPaymentStatus(order.payment_status ?? '') ? order.payment_status : 'unpaid'
});

const displayValue = (value: string) => (value.trim() ? value : '—');

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

type DetailFieldIconType = 'calendar' | 'customer' | 'postal' | 'type' | 'email' | 'address' | 'notes';

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
  icon,
  isEditing,
  children,
  className = ''
}: {
  icon?: DetailFieldIconType | null;
  isEditing: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`${detailFieldShellClassName} ${isEditing ? '' : detailFieldLockedShellClassName} ${className}`}>
      {icon ? <DetailFieldIcon icon={icon} /> : null}
      {children}
    </div>
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

  useEffect(() => {
    if (!isOpen) return;
    const onDocClick = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setIsOpen(false);
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
  const toggleCalendar = () => {
    if (disabled || !isEditing) return;
    if (isOpen) {
      setIsOpen(false);
      return;
    }

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
        <button
          type="button"
          onClick={toggleCalendar}
          disabled={disabled || !isEditing}
          aria-label="Odpri izbirnik datuma"
          title="Odpri izbirnik datuma"
          className="inline-flex h-[16px] w-[16px] shrink-0 items-center justify-center rounded-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#3e67d6] disabled:cursor-default"
        >
          <DetailFieldIcon icon="calendar" />
        </button>
        <input
          type="text"
          value={isEditing ? value : displayValue(value)}
          readOnly
          disabled={disabled}
          onClick={openCalendar}
          className={adminCompactIconFieldInputClassName}
        />
      </div>

      {isOpen && isEditing && !disabled ? (
        <div className="absolute left-0 top-[calc(100%+4px)] z-[60] w-[218px] rounded-md border border-slate-200 bg-white p-3 shadow-[0_14px_34px_rgba(15,23,42,0.08),0_2px_6px_rgba(15,23,42,0.05)]">
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
              className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-600 hover:bg-[color:var(--hover-neutral)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#3e67d6]"
              onClick={() => setVisibleMonth((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1))}
            >
              ‹
            </button>
            <button
              type="button"
              aria-label="Naslednji mesec"
              className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-600 hover:bg-[color:var(--hover-neutral)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#3e67d6]"
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
                  className={`h-7 rounded-md text-[12px] leading-7 transition focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#3e67d6] ${
                    isSelected
                      ? 'bg-[color:var(--blue-500)] font-semibold text-white'
                      : isToday
                        ? 'border border-slate-300 text-slate-900 hover:bg-[color:var(--hover-neutral)]'
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

function ChipDropdown({
  value,
  options,
  onChange,
  renderChip,
  disabled = false,
  showArrow = true,
  interactive = true,
  optionClassName
}: ChipDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [menuRect, setMenuRect] = useState<{ left: number; top: number; width: number } | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const updateMenuRect = useCallback(() => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    setMenuRect({
      left: rect.left,
      top: rect.bottom + 4,
      width: Math.max(rect.width, 150)
    });
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const onDocClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (containerRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setIsOpen(false);
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

  useEffect(() => {
    if (!isOpen) {
      setMenuRect(null);
      return;
    }

    updateMenuRect();
    window.addEventListener('resize', updateMenuRect);
    window.addEventListener('scroll', updateMenuRect, true);
    return () => {
      window.removeEventListener('resize', updateMenuRect);
      window.removeEventListener('scroll', updateMenuRect, true);
    };
  }, [isOpen, updateMenuRect]);

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => {
          if (disabled || !interactive) return;
          setIsOpen((previousOpen) => !previousOpen);
        }}
        disabled={disabled}
        aria-haspopup="menu"
        aria-expanded={interactive ? isOpen : false}
        className="relative block rounded-md focus:outline-none disabled:cursor-default disabled:opacity-60"
      >
        {showArrow ? (
          <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-500">▾</span>
        ) : null}
        <span className="block">{renderChip(value)}</span>
      </button>

      {isOpen && menuRect && typeof document !== 'undefined'
        ? createPortal(
            <div
              ref={menuRef}
              role="menu"
              className="fixed z-[1100]"
              style={{ left: menuRect.left, top: menuRect.top, minWidth: menuRect.width }}
            >
              <MenuPanel className="w-full min-w-[150px]">
                {options.map((option) => (
                  <MenuItem
                    key={option.value}
                    isActive={option.value === value}
                    className={optionClassName?.(option.value)}
                    onClick={() => {
                      onChange(option.value);
                      setIsOpen(false);
                    }}
                  >
                    {option.label}
                  </MenuItem>
                ))}
              </MenuPanel>
            </div>,
            document.body
          )
        : null}
    </div>
  );
}

function DetailField({
  label,
  children,
  className = ''
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`min-w-0 ${className}`}>
      <p className={labelClassName}>{label}</p>
      <div className="mt-1 min-h-8">{children}</div>
    </div>
  );
}

export default function AdminOrderDetailClient({
  orderId,
  order,
  items,
  documents,
  showDemoBanner = false
}: {
  orderId: number;
  order: NormalizedOrder;
  items: OrderItemInput[];
  documents: PersistedOrderPdfDocument[];
  showDemoBanner?: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const initialOrderNumber = toDisplayOrderNumberValue(toDisplayOrderNumber(order.order_number));
  const [displayOrderNumber, setDisplayOrderNumber] = useState(initialOrderNumber);
  const [persistedDetails, setPersistedDetails] = useState<DetailData>(() => asDetailData(order));
  const [draftDetails, setDraftDetails] = useState<DetailData>(() => asDetailData(order));
  const [draftOrderNumber, setDraftOrderNumber] = useState(toEditableOrderNumber(initialOrderNumber));
  const [persistedAdminNotes, setPersistedAdminNotes] = useState(order.admin_order_notes ?? '');
  const [draftAdminNotes, setDraftAdminNotes] = useState(order.admin_order_notes ?? '');
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [itemsDirty, setItemsDirty] = useState(false);
  const [itemsSaving, setItemsSaving] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [pendingUnsavedAction, setPendingUnsavedAction] = useState<PendingUnsavedAction | null>(null);
  const itemsSaveHandlerRef = useRef<(() => Promise<boolean>) | null>(null);

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
  const hasUnsavedChanges = detailsDirty || adminNotesDirty || itemsDirty;
  const activeDetails = isEditing ? draftDetails : persistedDetails;
  const activeAdminNotes = isEditing ? draftAdminNotes : persistedAdminNotes;
  const pageIsBusy = isSaving || itemsSaving || isDeleting;
  const pageTitle = `Naročilo ${displayOrderNumber}`;
  const activeOrderNumberValue = toEditableOrderNumber(isEditing ? draftOrderNumber : displayOrderNumber);
  const orderNumberSuggestionsId = `order-number-suggestions-${orderId}`;
  const orderNumberInputRef = useRef<HTMLInputElement | null>(null);
  const [isOrderNumberMenuOpen, setIsOrderNumberMenuOpen] = useState(false);
  const orderNumberAvailability = useOrderNumberAvailability({
    orderId,
    value: draftOrderNumber,
    enabled: isEditing
  });
  const orderNumberIsAllowed = isOrderNumberAllowed(draftOrderNumber, displayOrderNumber, orderNumberAvailability);
  const orderNumberValidationMessage = getOrderNumberValidationMessage(
    draftOrderNumber,
    displayOrderNumber,
    orderNumberAvailability
  );

  useEffect(() => {
    if (!isEditing) setIsOrderNumberMenuOpen(false);
  }, [isEditing]);

  useEffect(() => {
    if (!hasUnsavedChanges) return;

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  const registerItemsSaveHandler = useCallback((handler: () => Promise<boolean>) => {
    itemsSaveHandlerRef.current = handler;
    return () => {
      if (itemsSaveHandlerRef.current === handler) {
        itemsSaveHandlerRef.current = null;
      }
    };
  }, []);

  const resetDraftsToPersisted = useCallback(() => {
    setDraftDetails({ ...persistedDetails });
    setDraftOrderNumber(toEditableOrderNumber(displayOrderNumber));
    setDraftAdminNotes(persistedAdminNotes);
  }, [displayOrderNumber, persistedAdminNotes, persistedDetails]);

  const discardUnsavedChanges = useCallback(() => {
    resetDraftsToPersisted();
    setItemsDirty(false);
    setIsEditing(false);
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

  const toggleEdit = () => {
    if (isEditing) {
      requestUnsavedResolution({ kind: 'exit-edit', label: 'zaključkom urejanja naročila' });
      return;
    }

    resetDraftsToPersisted();
    setIsEditing(true);
  };

  const handleBack = () => {
    requestUnsavedResolution({
      kind: 'navigate',
      href: '/admin/orders',
      label: 'vrnitvijo na seznam naročil'
    });
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

  const saveDetails = async () => {
    const requests: Promise<Response>[] = [];

    if (statusDirty) {
      requests.push(
        fetch(`/api/admin/orders/${orderId}/status`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: draftDetails.status })
        })
      );
    }

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
      requests.push(
        fetch(`/api/admin/orders/${orderId}/details`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            orderNumber: toDisplayOrderNumberValue(draftOrderNumber),
            customerType: draftDetails.customerType,
            organizationName: draftDetails.organizationName,
            contactName: draftDetails.organizationName.trim() || draftDetails.contactName.trim(),
            email: draftDetails.email,
            deliveryAddress: draftDetails.deliveryAddress,
            postalCode: draftDetails.postalCode,
            notes: draftDetails.notes,
            orderDate: toApiOrderDate(draftDetails.orderDate)
          })
        })
      );
    }

    if (requests.length === 0) return;

    const responses = await Promise.all(requests);
    const failedResponse = responses.find((response) => !response.ok);
    if (failedResponse) {
      const error = await failedResponse.json().catch(() => ({}));
      throw new Error(error.message || 'Shranjevanje ni uspelo.');
    }
  };

  const saveAll = async (afterSave?: () => void) => {
    if (!isEditing || pageIsBusy) return false;
    if (!orderNumberIsAllowed) {
      toast.error(orderNumberValidationMessage ?? 'Vnesite veljavno številko naročila.');
      return false;
    }

    setIsSaving(true);
    try {
      const itemsSaved = itemsSaveHandlerRef.current ? await itemsSaveHandlerRef.current() : true;
      if (!itemsSaved) return false;

      await saveDetails();

      const resolvedOrderNumber = draftOrderNumber.trim()
        ? toDisplayOrderNumberValue(draftOrderNumber)
        : displayOrderNumber;
      setPersistedDetails({ ...draftDetails });
      setPersistedAdminNotes(draftAdminNotes);
      setDisplayOrderNumber(resolvedOrderNumber);
      setIsEditing(false);
      toast.success('Naročilo je shranjeno.');
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

        {showDemoBanner ? (
          <div className="rounded-2xl border border-dashed border-amber-200 bg-amber-50 p-6 text-sm text-amber-700">
            DATABASE_URL ni nastavljen - prikazan je demo pogled.
          </div>
        ) : null}

        {order.is_draft && !hasUnsavedChanges ? (
          <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            To naročilo je osnutek. Izpolni podatke in shrani.
          </div>
        ) : null}

        {order.deleted_at ? (
          <div className="rounded-lg border border-rose-300/80 bg-rose-100/70 px-3 py-2 text-sm font-semibold text-rose-800">
            To naročilo je bilo izbrisano.
          </div>
        ) : null}

        <section className={`${adminWindowCardClassName} px-5 py-4`} style={adminWindowCardStyle}>
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex min-w-0 flex-1 flex-col gap-3 xl:flex-row xl:items-center">
              <div className="relative w-full min-w-[270px] max-w-[50%] flex-none xl:max-w-[210px]">
                <div className={`${adminCompactIconFieldShellClassName} !mt-0 !h-[38.4px] w-full ${isEditing ? '' : '!bg-[color:var(--field-locked-bg)] text-slate-500'} ${isEditing && orderNumberValidationMessage ? '!border-rose-400' : ''}`}>
                <HeaderOrderIcon />
                <div className="flex min-w-0 flex-1 items-center">
                  <span className={`shrink-0 text-slate-900 ${adminTopBarTitleTextClassName}`}>
                    Naročilo #
                  </span>
                  <input
                    ref={orderNumberInputRef}
                    aria-label="Številka naročila"
                    aria-invalid={isEditing && Boolean(orderNumberValidationMessage)}
                    aria-describedby={isEditing && orderNumberValidationMessage ? `${orderNumberSuggestionsId}-message` : undefined}
                    name={`order-number-${orderId}`}
                    value={activeOrderNumberValue}
                    disabled={!isEditing || pageIsBusy}
                    title={orderNumberValidationMessage ?? undefined}
                    onFocus={() => setIsOrderNumberMenuOpen(true)}
                    onBlur={() => setIsOrderNumberMenuOpen(false)}
                    onChange={(event) => {
                      setDraftOrderNumber(sanitizeOrderNumberInput(event.target.value));
                      setIsOrderNumberMenuOpen(true);
                    }}
                    autoComplete="off"
                    spellCheck={false}
                    className={`${adminTopBarArticleNameInputClassName} admin-order-number-input !w-[8ch] flex-none ${isEditing ? 'text-slate-900' : 'cursor-not-allowed text-slate-900'}`}
                  />
                  <OrderNumberSuggestionMenu
                    anchorRef={orderNumberInputRef}
                    open={isEditing && isOrderNumberMenuOpen}
                    currentValue={toEditableOrderNumber(displayOrderNumber)}
                    suggestions={orderNumberAvailability.suggestions}
                    onSelect={(suggestion) => {
                      setDraftOrderNumber(sanitizeOrderNumberInput(suggestion));
                      setIsOrderNumberMenuOpen(false);
                      window.setTimeout(() => orderNumberInputRef.current?.focus(), 0);
                    }}
                  />
                  {isEditing && orderNumberValidationMessage ? (
                    <span id={`${orderNumberSuggestionsId}-message`} className="sr-only">
                      {orderNumberValidationMessage}
                    </span>
                  ) : null}
                </div>
              </div>
              </div>

              <div className={adminStatusInfoPillGroupClassName}>
                <ChipDropdown
                  value={activeDetails.status}
                  options={ORDER_STATUS_OPTIONS}
                  disabled={pageIsBusy}
                  showArrow={isEditing}
                  interactive={isEditing}
                  onChange={(value) => updateDraftDetails({ status: value })}
                  renderChip={(value) => (
                    <StatusChip status={value} />
                  )}
                  optionClassName={getStatusMenuItemClassName}
                />
                <ChipDropdown
                  value={activeDetails.paymentStatus}
                  options={PAYMENT_STATUS_OPTIONS}
                  disabled={pageIsBusy}
                  showArrow={isEditing}
                  interactive={isEditing}
                  onChange={(value) => updateDraftDetails({ paymentStatus: value })}
                  renderChip={(value) => (
                    <PaymentChip status={value} />
                  )}
                  optionClassName={getPaymentMenuItemClassName}
                />
              </div>
            </div>

            <div className="flex flex-nowrap items-center justify-end gap-3">
              <IconButton
                type="button"
                onClick={toggleEdit}
                tone="neutral"
                size="sm"
                className={adminTableNeutralIconButtonClassName}
                aria-label={isEditing ? 'Končaj urejanje naročila' : 'Uredi naročilo'}
                title={isEditing ? 'Končaj urejanje' : 'Uredi'}
                disabled={pageIsBusy}
              >
                <PencilIcon />
              </IconButton>
              <IconButton
                type="button"
                onClick={handleBack}
                tone="neutral"
                size="sm"
                className={adminTableNeutralIconButtonClassName}
                aria-label="Nazaj na seznam naročil"
                title="Nazaj"
                disabled={pageIsBusy}
              >
                <ActionUndoIcon />
              </IconButton>
              <AuditHistoryDrawer
                entityType="order"
                entityId={orderId}
                entityLabel={displayOrderNumber}
                buttonClassName={adminTableNeutralIconButtonClassName}
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
                disabled={!isEditing || pageIsBusy || !orderNumberIsAllowed}
              >
                <SaveIcon className={topSaveActionButtonIconClassName} />
                <span>Shrani</span>
              </Button>
            </div>
          </div>
        </section>

        <div className="grid items-stretch gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(340px,0.85fr)]">
          <div className="flex min-w-0 flex-col gap-5">
            <section className={`${adminWindowCardClassName} p-6`} style={adminWindowCardStyle}>
              <div className="grid gap-x-10 gap-y-5 md:grid-cols-2">
                <DetailField label="Datum">
                  <OrderDatePickerField
                    value={activeDetails.orderDate}
                    isEditing={isEditing}
                    disabled={pageIsBusy}
                    onChange={(value) => updateDraftDetails({ orderDate: value })}
                  />
                </DetailField>

                <DetailField label="Tip naročnika">
                  <DetailFieldShell icon="type" isEditing={isEditing}>
                    <CustomSelect
                      ariaLabel="Tip naročnika"
                      value={activeDetails.customerType}
                      onChange={(value) => updateDraftDetails({ customerType: value })}
                      options={CUSTOMER_TYPE_FORM_OPTIONS}
                      disabled={!isEditing || pageIsBusy}
                      showArrow={isEditing}
                      containerClassName={adminCompactIconFieldSelectWrapperClassName}
                      triggerClassName={`${adminCompactIconFieldSelectClassName} disabled:!cursor-default disabled:!text-slate-900 disabled:!opacity-100`}
                      valueClassName={`${adminCompactIconFieldSelectValueClassName} !pb-0`}
                    />
                  </DetailFieldShell>
                </DetailField>

                <DetailField label="Naročnik">
                  <DetailFieldShell icon="customer" isEditing={isEditing}>
                    <input
                      type="text"
                      value={isEditing ? activeDetails.organizationName : displayValue(activeDetails.organizationName)}
                      disabled={!isEditing || pageIsBusy}
                      onChange={(event) => updateDraftDetails({ organizationName: event.target.value })}
                      className={adminCompactIconFieldInputClassName}
                    />
                  </DetailFieldShell>
                </DetailField>

                <DetailField label="Email">
                  <DetailFieldShell icon="email" isEditing={isEditing}>
                    <input
                      type="email"
                      value={isEditing ? activeDetails.email : displayValue(activeDetails.email)}
                      disabled={!isEditing || pageIsBusy}
                      onChange={(event) => updateDraftDetails({ email: event.target.value })}
                      className={adminCompactIconFieldInputClassName}
                    />
                  </DetailFieldShell>
                </DetailField>

                <DetailField label="Poštna številka">
                  <DetailFieldShell icon="postal" isEditing={isEditing}>
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={4}
                      value={isEditing ? activeDetails.postalCode : displayValue(activeDetails.postalCode)}
                      disabled={!isEditing || pageIsBusy}
                      onChange={(event) =>
                        updateDraftDetails({ postalCode: event.target.value.replace(/[^\d]/g, '').slice(0, 4) })
                      }
                      className={adminCompactIconFieldInputClassName}
                    />
                  </DetailFieldShell>
                </DetailField>

                <DetailField label="Naslov">
                  <DetailFieldShell icon="address" isEditing={isEditing}>
                    <input
                      type="text"
                      value={isEditing ? activeDetails.deliveryAddress : displayValue(activeDetails.deliveryAddress)}
                      disabled={!isEditing || pageIsBusy}
                      onChange={(event) => updateDraftDetails({ deliveryAddress: event.target.value })}
                      className={adminCompactIconFieldInputClassName}
                    />
                  </DetailFieldShell>
                </DetailField>

                <DetailField label="Opombe stranke" className="md:col-span-2">
                  <textarea
                    rows={1}
                    value={isEditing ? activeDetails.notes : displayValue(activeDetails.notes)}
                    readOnly={!isEditing || pageIsBusy}
                    onChange={(event) => updateDraftDetails({ notes: event.target.value })}
                    aria-label="Opombe stranke"
                    className={`${adminCompactExpandableTextareaClassName} ${isEditing ? '' : '!bg-[color:var(--field-locked-bg)] text-slate-600'}`}
                  />
                </DetailField>
              </div>
            </section>

            <div className="flex flex-1 flex-col [&>section]:flex-1">
              <AdminOrderItemsEditorClient
                orderId={orderId}
                items={items}
                initialSubtotal={order.subtotal}
                initialTax={order.tax}
                initialTotal={order.total}
                externalEditMode={isEditing}
                hideSectionEditControls
                onDirtyChange={setItemsDirty}
                onSavingChange={setItemsSaving}
                onRegisterSave={registerItemsSaveHandler}
              />
            </div>
          </div>

          <aside className="flex w-full min-w-0 lg:self-stretch [&>section]:h-full">
            <AdminOrderPdfManagerClient
              orderId={orderId}
              documents={documents}
              adminNotesSlot={(
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">Opombe administratorja</h2>
                  <div className="mt-4">
                    <textarea
                      value={activeAdminNotes}
                      onChange={(event) => setDraftAdminNotes(event.target.value)}
                      rows={3}
                      placeholder=""
                      aria-label="Opombe administratorja"
                      readOnly={!isEditing}
                      className={`${adminNotesTextareaClassName} ${isEditing ? 'bg-white' : '!bg-[color:var(--field-locked-bg)] text-slate-600'}`}
                    />
                  </div>
                </div>
              )}
            />
          </aside>
        </div>
      </div>

      <UnsavedChangesDialog
        open={pendingUnsavedAction !== null}
        label={pendingUnsavedAction?.label}
        isSaving={isSaving || itemsSaving}
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
    </div>
  );
}
