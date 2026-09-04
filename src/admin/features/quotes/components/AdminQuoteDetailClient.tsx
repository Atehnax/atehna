'use client';

import { useCallback, useEffect, useId, useMemo, useRef, useState, useSyncExternalStore, type KeyboardEvent as ReactKeyboardEvent, type ReactNode, type RefObject } from 'react';
import Link from 'next/link';
import AdminOrderCustomerActions from '@/admin/features/orders/components/AdminOrderCustomerCard';
import AdminAddressAutocompleteInput from '@/admin/components/AdminAddressAutocompleteInput';
import AuditHistoryDrawer from '@/admin/components/AuditHistoryDrawer';
import CustomerEmailConfirmationDialog from '@/admin/features/email/components/CustomerEmailConfirmationDialog';
import { useCustomerEmailConfirmation } from '@/admin/features/email/useCustomerEmailConfirmation';
import { useRouter } from 'next/navigation';
import { Calculator, Info } from 'lucide-react';
import { CUSTOMER_TYPE_FORM_OPTIONS, getCustomerTypeLabel } from '@/shared/domain/order/customerType';
import { getQuoteCustomerMessage } from '@/shared/domain/quote/quoteCustomerMessage';
import { defaultQuoteValidityDateInput } from '@/shared/domain/quote/quoteValidity';
import {
  getQuoteRequestStatusMenuItemClassName,
  getQuoteRequestStatusPresentation,
  getQuoteRequestVisibleStatusValue,
  isManuallyEditableQuoteRequestStatus,
  QUOTE_REQUEST_VISIBLE_STATUS_OPTIONS
} from '@/shared/domain/quote/quoteRequestStatus';
import {
  DEFAULT_QUOTE_DELIVERY_TERMS,
  DEFAULT_QUOTE_PAYMENT_TERMS,
  getQuoteReasonLabel,
  QUOTE_REASON_OPTIONS
} from '@/shared/domain/quote/quoteTypes';
import { AdminChipDropdown } from '@/shared/ui/admin-controls/AdminChipDropdown';
import { AdminDetailTitleSlot } from '@/shared/ui/admin-detail/AdminDetailTitleSlot';
import { AdminNotesCard } from '@/shared/ui/admin-detail/AdminNotesCard';
import { AdminUnitInput } from '@/shared/ui/admin-controls/AdminUnitInput';
import { AdminInfoChip } from '@/shared/ui/badge';
import { AdminSearchInput } from '@/shared/ui/admin-search-input';
import { AdminCheckbox } from '@/shared/ui/checkbox';
import { Button } from '@/shared/ui/button';
import { IconButton } from '@/shared/ui/icon-button';
import { Dialog } from '@/shared/ui/dialog';
import { ActionUndoIcon, PencilIcon, PlusIcon, SaveIcon, TrashCanIcon } from '@/shared/ui/icons/AdminActionIcons';
import { PdfPreviewDialog } from '@/shared/ui/pdf-preview-dialog';
import { CustomSelect } from '@/shared/ui/select';
import { useToast } from '@/shared/ui/toast';
import { useDropdownDismiss } from '@/shared/ui/dropdown/use-dropdown-dismiss';
import {
  adminTableBodyCellCenterClassName,
  adminTableEditIconButtonClassName,
  adminTableBodyCellLeftClassName,
  adminCardSectionEditIconButtonClassName,
  adminTableHeaderCellCenterClassName,
  adminTableHeaderCellLeftClassName,
  adminTableNeutralIconButtonClassName,
  adminTablePrimaryButtonClassName,
  adminTableSearchIconClassName,
  adminTableSearchInputClassName,
  adminTableSearchWrapperClassName,
  adminTableSelectedDangerIconButtonClassName,
  adminWindowCardClassName,
  adminWindowCardStyle
} from '@/shared/ui/admin-table';
import {
  adminCompactIconFieldInputClassName,
  adminCompactIconFieldSelectClassName,
  adminCompactIconFieldSelectValueClassName,
  adminCompactIconFieldSelectWrapperClassName,
  adminCompactIconFieldShellClassName,
  adminTopBarArticleNameInputClassName
} from '@/shared/ui/admin-controls/adminCompactFieldStyles';
import {
  adminInputFocusTokenClasses,
  adminStatusInfoPillGroupClassName
} from '@/shared/ui/theme/tokens';
import type {
  AdminQuoteDetail,
  AdminQuoteItem,
  AdminQuoteOfferVersion
} from '@/shared/domain/quote/quoteAdminTypes';
import AdminQuoteClarificationDialog, {
  type AdminQuoteClarificationDialogStep
} from '@/admin/features/quotes/components/AdminQuoteClarificationDialog';
import AdminQuoteIssueDialog from '@/admin/features/quotes/components/AdminQuoteIssueDialog';
import AdminQuoteDocumentsManager from '@/admin/features/quotes/components/AdminQuoteDocumentsManager';
import AdminQuoteActivityTimeline, { QUOTE_EVENT_LABELS } from '@/admin/features/quotes/components/AdminQuoteActivityTimeline';
import {
  buildQuoteRequestStatusSelectionOptions,
  getManualQuoteRequestStatusTarget
} from '@/admin/features/quotes/quoteStatusSelection';

const STATUS_LABELS: Record<string, string> = {
  draft: 'Osnutek',
  issued: 'Izdana',
  accepted: 'Sprejeta',
  declined: 'Zavrnjena',
  expired: 'Potekla',
  withdrawn: 'Umaknjena',
  superseded: 'Nadomeščena'
};

const subscribeToClientReadiness = () => () => undefined;
const getClientReadinessSnapshot = () => true;
const getServerReadinessSnapshot = () => false;

const EMAIL_JOB_EVENT_LABELS: Record<string, string> = {
  quote_request_submitted: 'Povpraševanje prejeto',
  quote_clarification_requested: 'Zahteva za pojasnilo',
  quote_issued: 'Ponudba izdana',
  quote_access_otp: 'Varnostna koda za dostop',
  quote_accepted: 'Ponudba sprejeta',
  quote_declined: 'Ponudba zavrnjena',
  quote_withdrawn: 'Ponudba umaknjena',
  quote_expired: 'Ponudba potekla',
  quote_request_closed: 'Povpraševanje zaključeno',
  quote_acceptance_blocked_stock: 'Sprejem blokiran zaradi zaloge',
  quote_delivery_failed: 'Dostava e-pošte ni uspela'
};

const EMAIL_JOB_AUDIENCE_LABELS: Record<string, string> = {
  customer: 'stranka',
  admin: 'administrator'
};

const EMAIL_JOB_STATUS_LABELS: Record<string, string> = {
  pending: 'Čaka',
  processing: 'V obdelavi',
  sent: 'Poslano',
  failed: 'Napaka'
};

type QuoteActionOptions = {
  reason?: string | null;
  customerEmailConfirmationToken?: string;
};

const topActionSaveButtonClassName =
  `gap-2 ${adminTablePrimaryButtonClassName} !h-8 !leading-none !tracking-[0] disabled:!border-transparent disabled:!bg-[color:var(--blue-500)] disabled:!text-white disabled:!opacity-50`;
const compactPrimaryButtonClassName = `${adminTablePrimaryButtonClassName} !h-8 !px-3`;
const compactSecondaryButtonClassName =
  `!h-8 !rounded-md !border-slate-300 !bg-white !px-3 !text-[12px] !font-semibold !text-slate-700 hover:!bg-[color:var(--hover-neutral)] ${adminInputFocusTokenClasses}`;
const compactDangerButtonClassName =
  `!h-8 !rounded-md !border !border-rose-300 !bg-white !px-3 !text-[12px] !font-semibold !text-rose-700 hover:!bg-rose-50 ${adminInputFocusTokenClasses}`;
const compactInputClassName =
  `h-8 w-full rounded-md border border-slate-300 bg-white px-3 font-['Inter',system-ui,sans-serif] text-[11px] font-normal text-slate-900 outline-none transition-[border-color,box-shadow] ${adminInputFocusTokenClasses}`;
const compactOfferTextareaClassName =
  `h-7 min-h-7 w-full resize-none overflow-hidden whitespace-nowrap rounded-md border border-slate-300 bg-white px-3 py-1 font-['Inter',system-ui,sans-serif] text-[11px] font-normal leading-5 text-slate-900 outline-none transition-[border-color,box-shadow] ${adminInputFocusTokenClasses}`;
const quoteRequestDefaultTitle = (requestNumber: string) =>
  `Povpraševanje ${requestNumber}`;
const detailFieldShellClassName = `${adminCompactIconFieldShellClassName} !mt-0 !h-7 w-full`;
const detailFieldLockedShellClassName = '!border-transparent !bg-transparent !shadow-none';
const quoteDetailValueControlClassName = `${adminCompactIconFieldInputClassName} min-w-0 flex-1`;
const quoteDetailCompositeInputClassName =
  `${adminCompactIconFieldInputClassName} min-w-0 !h-6 !px-2 !leading-5`;
const quoteDetailInlineTextareaClassName =
  `${quoteDetailValueControlClassName} !h-5 resize-none overflow-hidden whitespace-nowrap`;
const quoteDetailReadValueClassName =
  "block h-6 w-full min-w-0 flex-1 select-text truncate font-['Inter',system-ui,sans-serif] text-[11px] font-normal leading-6 text-slate-900";
const labelClassName = 'text-[11px] font-semibold leading-4 text-slate-700';

type QuoteRequestDetailsState = {
  status: string;
  customerType: string;
  organizationName: string;
  contactName: string;
  email: string;
  addressLine1: string;
  addressLine2: string;
  postalCode: string;
  city: string;
  countryCode: string;
  gursHouseNumberId: string;
  reference: string;
  quoteReason: string;
  customerMessage: string;
};


const asQuoteRequestDetails = (detail: AdminQuoteDetail): QuoteRequestDetailsState => ({
  status: detail.status,
  customerType: detail.customerType,
  organizationName: detail.organizationName ?? '',
  contactName: detail.contactName,
  email: detail.email,
  addressLine1: detail.addressLine1 ?? '',
  addressLine2: detail.addressLine2 ?? '',
  postalCode: detail.postalCode ?? '',
  city: detail.city ?? '',
  countryCode: detail.countryCode ?? 'SI',
  gursHouseNumberId: detail.gursHouseNumberId ?? '',
  reference: detail.reference ?? '',
  quoteReason: detail.quoteReason ?? 'formal_offer',
  customerMessage: detail.customerMessage ?? ''
});

const displayValue = (value: string) => value.trim() || '—';

const formatQuoteRequestAddress = (
  details: Pick<
    QuoteRequestDetailsState,
    'addressLine1' | 'addressLine2' | 'postalCode' | 'city' | 'countryCode'
  >
) => {
  const locality = [details.postalCode.trim(), details.city.trim()]
    .filter(Boolean)
    .join(' ');
  return [
    details.addressLine1.trim(),
    details.addressLine2.trim(),
    locality,
    details.countryCode.trim().toUpperCase()
  ].filter(Boolean).join(', ');
};

const formatDateTime = (value: string | null) => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? '—'
    : new Intl.DateTimeFormat('sl-SI', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
};

const toDateInput = (value: string | null) => {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
};

const formatCurrency = (value: number, currency = 'EUR') =>
  new Intl.NumberFormat('sl-SI', { style: 'currency', currency }).format(value);

const itemTitle = (item: Pick<AdminQuoteItem, 'productName' | 'variantName'>) =>
  item.variantName ? `${item.productName} · ${item.variantName}` : item.productName;

type CatalogChoice = {
  catalogItemId: number;
  catalogVariantId: number;
  sku: string;
  name: string;
  productName: string;
  variantName: string | null;
  unit: string;
  unitPrice: number;
  discountPercentage: number;
};

type DraftItem = Pick<
  AdminQuoteItem,
  'id' | 'catalogItemId' | 'catalogVariantId' | 'lineNumber' | 'productName' | 'variantName' | 'sku' | 'unit' | 'quantity' | 'baseUnitNet' | 'unitNet' | 'discountPct'
>;

type DraftState = {
  offerVersionId: number;
  expectedStateVersion: number;
  validUntil: string;
  shipping: number;
  confirmFreeShipping: boolean;
  deliveryTerms: string;
  paymentTerms: string;
  customerVisibleNotes: string;
  termsText: string;
  termsVersion: string;
  items: DraftItem[];
};

const comparableDraftFingerprint = (draft: DraftState | null) => {
  if (!draft) return null;
  return JSON.stringify({ ...draft, expectedStateVersion: 0 });
};

const toDraftState = (
  version: AdminQuoteOfferVersion,
  { populateDefaultTerms = true, populateDefaultValidity = true }: {
    populateDefaultTerms?: boolean;
    populateDefaultValidity?: boolean;
  } = {}
): DraftState => ({
  offerVersionId: version.id,
  expectedStateVersion: version.stateVersion,
  validUntil:
    toDateInput(version.validUntil) ||
    (populateDefaultValidity
      ? defaultQuoteValidityDateInput(version.createdAt)
      : ''),
  shipping: version.shipping,
  confirmFreeShipping:
    version.shipping > 0 ||
    version.shippingConfirmation?.confirmed === true ||
    version.shippingConfirmation?.decision === 'free_shipping',
  deliveryTerms:
    populateDefaultTerms && !version.deliveryTerms.trim()
      ? DEFAULT_QUOTE_DELIVERY_TERMS
      : version.deliveryTerms,
  paymentTerms:
    populateDefaultTerms && !version.paymentTerms.trim()
      ? DEFAULT_QUOTE_PAYMENT_TERMS
      : version.paymentTerms,
  customerVisibleNotes: getQuoteCustomerMessage(
    version.sellerMessage,
    version.customerVisibleNotes
  ),
  termsText: version.termsText,
  termsVersion: version.termsVersion ?? 'atehna-quote-terms-v1',
  items: version.items.map((item) => ({
    id: item.id,
    catalogItemId: item.catalogItemId,
    catalogVariantId: item.catalogVariantId,
    lineNumber: item.lineNumber,
    productName: item.productName,
    variantName: item.variantName,
    sku: item.sku,
    unit: item.unit,
    quantity: item.quantity,
    baseUnitNet: item.baseUnitNet,
    unitNet: item.unitNet,
    discountPct: item.discountPct
  }))
});

const toPersistedDraftState = (version: AdminQuoteOfferVersion) =>
  toDraftState(version, {
    populateDefaultTerms: false,
    populateDefaultValidity: false
  });

type QuoteShippingBreakdown =
  | {
      status: 'calculated';
      automaticAmountCents: number;
      basePriceCents: number;
      surchargeAmountCents: number;
      parcelCount: number;
      parcelCountGrossAmountCents: number;
      multiPieceDiscountAmountCents: number;
      orderValueDiscountAmountCents: number;
      weightBandName: string;
      dimensionalRuleName: string | null;
      configurationVersion: number | null;
      combinedWeightGrams: number | null;
      largestDimensionMm: number | null;
    }
  | {
      status: 'manual_quote';
      reason: string;
      configurationVersion: number | null;
    };

const quoteSnapshotRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;

const quoteSnapshotNumber = (value: unknown): number | null => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const quoteSnapshotCents = (value: unknown, fallback = 0) => {
  const parsed = quoteSnapshotNumber(value);
  return parsed !== null && Number.isSafeInteger(parsed) && parsed >= 0
    ? parsed
    : fallback;
};

function normalizeQuoteShippingSnapshot(
  snapshot: Record<string, unknown> | null
): QuoteShippingBreakdown | null {
  if (!snapshot) return null;
  const configurationVersion = quoteSnapshotNumber(snapshot.configurationVersion);
  const normalizedConfigurationVersion =
    configurationVersion !== null && Number.isSafeInteger(configurationVersion)
      ? configurationVersion
      : null;

  if (snapshot.status === 'manual_quote') {
    return {
      status: 'manual_quote',
      reason: typeof snapshot.reason === 'string' && snapshot.reason.trim()
        ? snapshot.reason.trim()
        : 'Samodejnega zneska za to pošiljko ni bilo mogoče določiti.',
      configurationVersion: normalizedConfigurationVersion
    };
  }
  if (snapshot.status !== 'calculated') return null;

  const automaticAmountCents = quoteSnapshotNumber(snapshot.automaticAmountCents);
  if (
    automaticAmountCents === null ||
    !Number.isSafeInteger(automaticAmountCents) ||
    automaticAmountCents < 0
  ) {
    return null;
  }

  const weightBand = quoteSnapshotRecord(snapshot.matchedWeightBand);
  const dimensionalRule = quoteSnapshotRecord(snapshot.matchedDimensionalRule);
  const parcelCountValue = quoteSnapshotNumber(snapshot.parcelCount);
  const combinedWeightGrams = quoteSnapshotNumber(snapshot.combinedWeightGrams);
  const largestDimensionMm = quoteSnapshotNumber(snapshot.largestDimensionMm);

  return {
    status: 'calculated',
    automaticAmountCents,
    basePriceCents: quoteSnapshotCents(snapshot.basePriceCents),
    surchargeAmountCents: quoteSnapshotCents(snapshot.surchargeAmountCents),
    parcelCount:
      parcelCountValue !== null && Number.isSafeInteger(parcelCountValue) && parcelCountValue > 0
        ? parcelCountValue
        : 1,
    parcelCountGrossAmountCents: quoteSnapshotCents(
      snapshot.parcelCountGrossAmountCents,
      automaticAmountCents
    ),
    multiPieceDiscountAmountCents: quoteSnapshotCents(
      snapshot.multiPieceDiscountAmountCents
    ),
    orderValueDiscountAmountCents: quoteSnapshotCents(
      snapshot.orderValueDiscountAmountCents
    ),
    weightBandName:
      typeof weightBand?.name === 'string' && weightBand.name.trim()
        ? weightBand.name.trim()
        : 'Osnovna poštnina',
    dimensionalRuleName:
      typeof dimensionalRule?.name === 'string' && dimensionalRule.name.trim()
        ? dimensionalRule.name.trim()
        : null,
    configurationVersion: normalizedConfigurationVersion,
    combinedWeightGrams:
      combinedWeightGrams !== null && combinedWeightGrams >= 0
        ? combinedWeightGrams
        : null,
    largestDimensionMm:
      largestDimensionMm !== null && largestDimensionMm >= 0
        ? largestDimensionMm
        : null
  };
}

function QuoteShippingAmountRow({
  label,
  amountCents,
  currency,
  discount = false,
  emphasized = false
}: {
  label: string;
  amountCents: number;
  currency: string;
  discount?: boolean;
  emphasized?: boolean;
}) {
  return (
    <div
      className={
        'flex items-center justify-between gap-4 py-1.5 text-xs ' +
        (emphasized ? 'font-semibold text-slate-950' : 'text-slate-600')
      }
      data-shipping-calculation-row
    >
      <span>{label}</span>
      <span
        className={
          'shrink-0 tabular-nums ' +
          (discount ? 'font-medium text-emerald-700' : 'font-medium text-slate-900')
        }
      >
        {discount ? '−' : ''}{formatCurrency(amountCents / 100, currency)}
      </span>
    </div>
  );
}

function QuoteShippingExplanationDialog({
  open,
  onOpenChange,
  snapshot,
  finalShipping,
  currency
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  snapshot: QuoteShippingBreakdown | null;
  finalShipping: number;
  currency: string;
}) {
  const finalAmountCents = Math.round(finalShipping * 100);
  const isManual =
    snapshot?.status === 'manual_quote' ||
    (snapshot?.status === 'calculated' &&
      snapshot.automaticAmountCents !== finalAmountCents);

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Izračun poštnine"
      isDismissable
      panelClassName="max-w-md"
      footer={(
        <div className="mt-4 flex justify-end">
          <Button
            type="button"
            variant="outline"
            size="toolbar"
            onClick={() => onOpenChange(false)}
          >
            Zapri
          </Button>
        </div>
      )}
    >
      <div className="mt-3" data-testid="quote-shipping-explanation">
        <div className="flex items-center justify-between gap-4 rounded-lg bg-slate-50 px-3 py-2.5">
          <div>
            <p className="text-xs font-semibold text-slate-900">
              {isManual ? 'Ročno nastavljena poštnina' : 'Samodejna poštnina'}
            </p>
            <p className="mt-0.5 text-[11px] text-slate-500">
              Samodejni izračun, zamrznjen ob oddaji povpraševanja.
            </p>
          </div>
          <span className="text-sm font-semibold tabular-nums text-slate-950">
            {formatCurrency(finalShipping, currency)}
          </span>
        </div>

        {snapshot?.status === 'calculated' ? (
          <div className="mt-3">
            <QuoteShippingAmountRow
              label={snapshot.weightBandName}
              amountCents={snapshot.basePriceCents}
              currency={currency}
            />
            {snapshot.surchargeAmountCents > 0 ? (
              <QuoteShippingAmountRow
                label={snapshot.dimensionalRuleName ?? 'Dodatek glede na mere'}
                amountCents={snapshot.surchargeAmountCents}
                currency={currency}
              />
            ) : null}
            {snapshot.parcelCount > 1 ? (
              <QuoteShippingAmountRow
                label={`${snapshot.parcelCount} paketov pred popusti`}
                amountCents={snapshot.parcelCountGrossAmountCents}
                currency={currency}
              />
            ) : null}
            {snapshot.multiPieceDiscountAmountCents > 0 ? (
              <QuoteShippingAmountRow
                label="Popust za več paketov"
                amountCents={snapshot.multiPieceDiscountAmountCents}
                currency={currency}
                discount
              />
            ) : null}
            {snapshot.orderValueDiscountAmountCents > 0 ? (
              <QuoteShippingAmountRow
                label="Popust glede na vrednost naročila"
                amountCents={snapshot.orderValueDiscountAmountCents}
                currency={currency}
                discount
              />
            ) : null}
            <div className="mt-1 border-t border-slate-200 pt-1">
              <QuoteShippingAmountRow
                label="Samodejni znesek"
                amountCents={snapshot.automaticAmountCents}
                currency={currency}
                emphasized
              />
            </div>
            {isManual ? (
              <div className="mt-1 border-t border-slate-200 pt-1">
                <QuoteShippingAmountRow
                  label="Ročno izbran znesek"
                  amountCents={finalAmountCents}
                  currency={currency}
                  emphasized
                />
              </div>
            ) : null}
            <p className="mt-3 text-[11px] leading-4 text-slate-500">
              {[
                snapshot.combinedWeightGrams !== null
                  ? `Masa: ${Math.round(snapshot.combinedWeightGrams)} g`
                  : null,
                snapshot.largestDimensionMm !== null
                  ? `Največja mera: ${Math.round(snapshot.largestDimensionMm)} mm`
                  : null,
                `Paketi: ${snapshot.parcelCount}`,
                snapshot.configurationVersion !== null
                  ? `Pravila v${snapshot.configurationVersion}`
                  : null
              ].filter(Boolean).join(' · ')}
            </p>
          </div>
        ) : snapshot?.status === 'manual_quote' ? (
          <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5">
            <p className="text-xs font-semibold text-amber-900">Potreben je ročni znesek</p>
            <p className="mt-1 text-xs leading-5 text-amber-800">{snapshot.reason}</p>
          </div>
        ) : (
          <p className="mt-3 text-xs leading-5 text-slate-600">
            Podrobna razčlenitev za to starejšo ponudbo ni na voljo.
          </p>
        )}
      </div>
    </Dialog>
  );
}

const toNewDraftState = (detail: AdminQuoteDetail): DraftState => {
  return {
    offerVersionId: 0,
    expectedStateVersion: detail.stateVersion,
    validUntil: defaultQuoteValidityDateInput(detail.createdAt),
    shipping: 0,
    confirmFreeShipping: false,
    deliveryTerms: DEFAULT_QUOTE_DELIVERY_TERMS,
    paymentTerms: DEFAULT_QUOTE_PAYMENT_TERMS,
    customerVisibleNotes: '',
    termsText: '',
    termsVersion: 'atehna-quote-terms-v1',
    items: detail.requestedItems.map((item) => ({
      id: item.id,
      catalogItemId: item.catalogItemId,
      catalogVariantId: item.catalogVariantId,
      lineNumber: item.lineNumber,
      productName: item.productName,
      variantName: item.variantName,
      sku: item.sku,
      unit: item.unit,
      quantity: item.quantity,
      baseUnitNet: item.baseUnitNet,
      unitNet: item.unitNet,
      discountPct: item.discountPct
    }))
  };
};

type QuoteDetailFieldIconType = 'type' | 'customer' | 'email' | 'address' | 'reference' | 'message';

function HeaderQuoteIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-[18px] w-[18px] shrink-0 text-slate-700"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M6 3.5h9l3 3V20.5H6z" />
      <path d="M15 3.5v3h3M9 11h6M9 14.5h6M9 18h4" />
    </svg>
  );
}

function QuoteDetailFieldIcon({ icon }: { icon: QuoteDetailFieldIconType }) {
  const commonProps = {
    viewBox: '0 0 20 20',
    className: 'h-4 w-4 shrink-0 text-slate-500',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.55,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true
  };

  if (icon === 'customer') {
    return <svg {...commonProps}><circle cx="10" cy="6.7" r="3" /><path d="M4.5 16.2c.8-3 2.7-4.5 5.5-4.5s4.7 1.5 5.5 4.5" /></svg>;
  }
  if (icon === 'email') {
    return <svg {...commonProps}><rect x="3" y="4.5" width="14" height="11" rx="2" /><path d="m4 6 6 5 6-5" /></svg>;
  }
  if (icon === 'address') {
    return <svg {...commonProps}><path d="M3.5 9.2 10 4l6.5 5.2" /><path d="M5.2 8.4v7h9.6v-7M8.4 15.4v-4h3.2v4" /></svg>;
  }
  if (icon === 'reference') {
    return <svg {...commonProps}><path d="M6 3.5h8v13H6zM8.5 7h3M8.5 10h3M8.5 13h2" /></svg>;
  }
  if (icon === 'message') {
    return <svg {...commonProps}><path d="M3.5 4.5h13v9h-7l-4 3v-3h-2zM6.5 8h7M6.5 10.5h4.5" /></svg>;
  }
  return <svg {...commonProps}><circle cx="7" cy="7" r="2.5" /><path d="M2.8 15c.6-2.6 2-3.9 4.2-3.9s3.6 1.3 4.2 3.9M13 6h4M13 9h4M13 12h4" /></svg>;
}

type QuoteOfferFieldKey =
  | 'validUntil'
  | 'shipping'
  | 'customerMessage'
  | 'deliveryTerms'
  | 'paymentTerms'
  | 'acceptanceTerms';

function QuoteOfferFieldRow({
  field,
  label,
  value,
  isEditing,
  labelAction,
  valueAction,
  children
}: {
  field: QuoteOfferFieldKey;
  label: string;
  value: string;
  isEditing: boolean;
  labelAction?: ReactNode;
  valueAction?: ReactNode;
  children: ReactNode;
}) {
  const visibleValue = displayValue(value);
  return (
    <div
      className="grid h-[35px] min-w-0 grid-cols-[112px_minmax(0,1fr)] items-center gap-4"
      data-quote-offer-field={field}
    >
      <dt className="flex min-w-0 items-center gap-1 text-[11px] font-semibold text-slate-600">
        <span className="min-w-0 truncate">{label}</span>
        {labelAction}
      </dt>
      <dd className="flex h-7 min-w-0 items-center gap-1.5">
        <div className="flex h-7 min-w-0 flex-1 items-center">
          {isEditing ? children : (
            <span
              className="block h-5 w-full min-w-0 truncate text-[11px] font-normal leading-5 text-slate-900"
              title={visibleValue}
            >
              {visibleValue}
            </span>
          )}
        </div>
        {valueAction}
      </dd>
    </div>
  );
}
function QuoteDetailFieldShell({
  isEditing,
  children
}: {
  isEditing: boolean;
  children: ReactNode;
}) {
  return (
    <div className={`${detailFieldShellClassName} ${isEditing ? '' : detailFieldLockedShellClassName}`}>
      {children}
    </div>
  );
}

function QuoteAddressEditor({
  details,
  disabled,
  onChange
}: {
  details: QuoteRequestDetailsState;
  disabled: boolean;
  onChange: (patch: Partial<QuoteRequestDetailsState>) => void;
}) {
  return (
    <QuoteDetailFieldShell isEditing>
      <div
        role="group"
        aria-label="Naslovni podatki"
        className="grid h-6 min-w-0 flex-1 grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_3.5rem_minmax(0,1fr)_2.25rem] divide-x divide-slate-200 overflow-hidden"
        data-testid="quote-request-address-fields"
      >
        <AdminAddressAutocompleteInput
          value={details.addressLine1}
          gursHouseNumberId={details.gursHouseNumberId}
          disabled={disabled}
          testId="admin-quote-address-autocomplete"
          onChange={(value) => onChange({
            addressLine1: value,
            gursHouseNumberId: ''
          })}
          onSelect={(suggestion) => onChange({
            addressLine1: suggestion.addressLine1,
            postalCode: suggestion.postalCode,
            city: suggestion.postalName,
            countryCode: 'SI',
            gursHouseNumberId: suggestion.gursHouseNumberId
          })}
          className={quoteDetailCompositeInputClassName + ' !pl-0 w-full'}
        />
        <input
          aria-label="Dodatni naslov"
          autoComplete="address-line2"
          type="text"
          value={details.addressLine2}
          disabled={disabled}
          placeholder="Dodatek"
          onChange={(event) => onChange({ addressLine2: event.target.value })}
          className={quoteDetailCompositeInputClassName}
        />
        <input
          aria-label="Poštna številka"
          autoComplete="postal-code"
          type="text"
          inputMode="numeric"
          value={details.postalCode}
          disabled={disabled}
          placeholder="P. št."
          onChange={(event) => onChange({
            postalCode: event.target.value.replace(/[^\d]/g, '').slice(0, 4),
            gursHouseNumberId: ''
          })}
          className={`${quoteDetailCompositeInputClassName} text-center`}
        />
        <input
          aria-label="Kraj"
          autoComplete="address-level2"
          type="text"
          value={details.city}
          disabled={disabled}
          placeholder="Kraj"
          onChange={(event) => onChange({
            city: event.target.value,
            gursHouseNumberId: ''
          })}
          className={quoteDetailCompositeInputClassName}
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
          className={`${quoteDetailCompositeInputClassName} !px-1 text-center`}
        />
      </div>
    </QuoteDetailFieldShell>
  );
}

function QuoteDetailRow({
  label,
  value,
  icon,
  isEditing,
  fullWidth = false,
  children
}: {
  label: string;
  value: string;
  icon: QuoteDetailFieldIconType;
  isEditing: boolean;
  fullWidth?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className={`grid h-[35px] items-center gap-3 ${
        fullWidth
          ? 'grid-cols-[120px_minmax(0,1fr)] md:col-span-2'
          : 'grid-cols-[minmax(120px,0.42fr)_minmax(0,1fr)]'
      }`}
      data-quote-detail-row={label}
      data-quote-detail-span={fullWidth ? 'full' : undefined}
    >
      <dt className="flex min-w-0 items-center gap-1.5 text-[11px] font-semibold text-slate-600">
        <QuoteDetailFieldIcon icon={icon} />
        <span className="min-w-0 truncate">{label}</span>
      </dt>
      <dd className="min-w-0">
        {isEditing ? children : (
          <QuoteDetailFieldShell isEditing={false}>
            <span className={quoteDetailReadValueClassName}>{displayValue(value)}</span>
          </QuoteDetailFieldShell>
        )}
      </dd>
    </div>
  );
}

function StateBadge({ status }: { status: string }) {
  const toneClassName = status === 'sent'
    ? 'text-emerald-700'
    : status === 'failed'
      ? 'text-rose-700'
      : status === 'processing'
        ? 'text-[color:var(--blue-600)]'
        : 'text-slate-500';

  return (
    <span
      className={`shrink-0 whitespace-nowrap text-[11px] font-semibold ${toneClassName}`}
      data-testid="quote-email-status"
    >
      {EMAIL_JOB_STATUS_LABELS[status] ?? status}
    </span>
  );
}

function QuoteWorkflowStatusBadge({ status }: { status: string }) {
  const presentation = getQuoteRequestStatusPresentation(status);

  return (
    <span
      data-testid="quote-workflow-status"
      title={presentation.description}
      aria-label={`Status povpraševanja: ${presentation.label}. ${presentation.description}`}
    >
      <AdminInfoChip label={presentation.label} variant={presentation.tone} />
    </span>
  );
}

const normaliseDiscount = (value: number) =>
  Math.max(0, Math.min(100, Math.round(value * 100) / 100));

const discountFromUnitNet = (baseUnitNet: number, unitNet: number) =>
  baseUnitNet > 0 ? normaliseDiscount((1 - unitNet / baseUnitNet) * 100) : 0;

const unitNetFromDiscount = (baseUnitNet: number, discountPct: number) =>
  Math.round(baseUnitNet * (1 - normaliseDiscount(discountPct) / 100) * 100) / 100;

const quoteItemQuantitySlotClassName =
  'mx-auto flex h-8 w-full max-w-24 items-center justify-center px-3 text-center text-[11px] tabular-nums text-slate-900';
const quoteItemUnitNetSlotClassName =
  'mx-auto flex h-8 w-full max-w-28 items-center justify-center px-3 text-center text-[11px] tabular-nums text-slate-900';
const quoteItemDiscountSlotClassName = quoteItemQuantitySlotClassName;

const quoteItemSelectionCheckboxClassName =
  'disabled:cursor-default disabled:border-slate-200 disabled:bg-slate-100 disabled:opacity-60';
const quoteItemPickerFocusableSelector = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])'
].join(',');

function QuoteCatalogItemPickerDialog({
  open,
  choices,
  onAdd,
  onClose,
  triggerRef
}: {
  open: boolean;
  choices: CatalogChoice[];
  onAdd: (choice: CatalogChoice) => void;
  onClose: () => void;
  triggerRef: RefObject<HTMLButtonElement | null>;
}) {
  const [query, setQuery] = useState('');
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const dismissRefs = useMemo(() => [dialogRef] as const, []);
  const dialogId = useId();
  const titleId = useId();

  const closeAndRestoreFocus = useCallback(() => {
    onClose();
    setQuery('');
    window.requestAnimationFrame(() => triggerRef.current?.focus());
  }, [onClose, triggerRef]);

  useDropdownDismiss({
    open,
    onClose: closeAndRestoreFocus,
    refs: dismissRefs,
    returnFocusRef: triggerRef
  });

  useEffect(() => {
    if (!open) setQuery('');
  }, [open]);

  const filteredChoices = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('sl');
    return choices.filter((choice) =>
      !normalizedQuery
        ? true
        : choice.name.toLocaleLowerCase('sl').includes(normalizedQuery) ||
          choice.sku.toLocaleLowerCase('sl').includes(normalizedQuery)
    );
  }, [choices, query]);

  const handleKeyDown = useCallback((event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Tab') return;
    const panel = dialogRef.current;
    if (!panel) return;
    const focusableElements = Array.from(
      panel.querySelectorAll<HTMLElement>(quoteItemPickerFocusableSelector)
    ).filter((element) => element.tabIndex >= 0 && !element.hasAttribute('disabled'));
    if (focusableElements.length === 0) {
      event.preventDefault();
      panel.focus();
      return;
    }
    const first = focusableElements[0];
    const last = focusableElements[focusableElements.length - 1];
    const activeElement = document.activeElement;
    if (event.shiftKey && (activeElement === first || !panel.contains(activeElement))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }, []);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
      data-quote-item-picker-overlay
    >
      <div
        id={dialogId}
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
        data-quote-item-picker-dialog
        className="w-full max-w-2xl rounded-xl border border-slate-200 bg-white p-4 shadow-[0_14px_34px_rgba(15,23,42,0.08),0_2px_6px_rgba(15,23,42,0.05)]"
      >
        <div className="flex items-center justify-between">
          <h3 id={titleId} className="text-[13px] font-semibold text-slate-900">
            Dodaj artikel v ponudbo
          </h3>
          <button
            type="button"
            className="text-[12px] text-slate-500 hover:text-slate-700"
            onClick={closeAndRestoreFocus}
          >
            Zapri
          </button>
        </div>
        <div className="mt-3">
          <AdminSearchInput
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Išči po nazivu ali šifri"
            aria-label="Išči artikel za ponudbo"
            wrapperClassName={adminTableSearchWrapperClassName}
            inputClassName={adminTableSearchInputClassName}
            iconClassName={adminTableSearchIconClassName}
          />
        </div>
        <div className="mt-3 max-h-[360px] overflow-y-auto rounded-md border border-slate-200">
          {filteredChoices.map((choice) => (
            <button
              key={choice.catalogVariantId}
              type="button"
              onClick={() => {
                onAdd(choice);
                closeAndRestoreFocus();
              }}
              className="flex w-full items-center justify-between gap-4 border-b border-slate-200/80 px-3 py-3 text-left text-[12px] text-slate-700 transition-colors hover:bg-[color:var(--admin-table-row-hover)] last:border-b-0"
            >
              <span className="min-w-0">
                <span className="block truncate font-medium text-slate-900">
                  {itemTitle(choice)}
                </span>
                <span className="mt-0.5 block truncate text-[10px] text-slate-500">
                  SKU: {choice.sku}
                </span>
              </span>
              <span className="shrink-0 tabular-nums text-slate-600">
                {formatCurrency(choice.unitPrice)}
              </span>
            </button>
          ))}
          {filteredChoices.length === 0 ? (
            <div className="px-3 py-6 text-center text-[12px] text-slate-500">
              Ni ujemajočih artiklov.
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function QuoteItemsComparisonTable({
  requestedItems,
  draftItems,
  offeredItems,
  catalogChoices,
  catalogLoadState,
  selectedDraftItemIds,
  disabled,
  onUpdateDraftItem,
  onToggleDraftItem,
  onToggleAllDraftItems
}: {
  requestedItems: AdminQuoteItem[];
  draftItems: DraftItem[] | null;
  offeredItems: AdminQuoteItem[] | null;
  catalogChoices: CatalogChoice[];
  catalogLoadState: 'idle' | 'loading' | 'ready' | 'error';
  selectedDraftItemIds: number[];
  disabled: boolean;
  onUpdateDraftItem: (itemId: number, patch: Partial<DraftItem>) => void;
  onToggleDraftItem: (itemId: number) => void;
  onToggleAllDraftItems: () => void;
}) {
  const editable = draftItems !== null;
  const sourceItems: Array<DraftItem | AdminQuoteItem> = draftItems ?? offeredItems ?? [];
  const requestedByLineNumber = new Map(
    requestedItems.map((item) => [item.lineNumber, item] as const)
  );
  const offeredByLineNumber = new Map(
    sourceItems.map((item) => [item.lineNumber, item] as const)
  );
  const lineNumbers = Array.from(
    new Set([...requestedByLineNumber.keys(), ...offeredByLineNumber.keys()])
  ).sort((left, right) => left - right);
  const allDraftItemsSelected =
    editable &&
    sourceItems.length > 0 &&
    sourceItems.every((item) => selectedDraftItemIds.includes(item.id));
  const baseCatalogOptions = catalogChoices.map((choice) => ({
    value: String(choice.catalogVariantId),
    label: choice.name + ' · ' + choice.sku
  }));

  return (
    <div className="overflow-x-auto border-y border-slate-200 bg-white">
      <table
        className="w-full min-w-[680px] table-fixed text-[12px]"
        data-testid="quote-items-comparison-table"
      >
        <caption className="sr-only">
          Primerjava zahtevanih artiklov s postavkami ponudbe
        </caption>
        <colgroup>
          <col style={{ width: '44px' }} />
          <col style={{ width: '12%' }} />
          <col style={{ width: '40%' }} />
          <col style={{ width: '15%' }} />
          <col style={{ width: '18%' }} />
          <col style={{ width: '15%' }} />
        </colgroup>
        <thead className="bg-[color:var(--admin-table-header-bg)] text-slate-700">
          <tr>
            <th
              className="h-11 border-b border-slate-200 p-0 text-center align-middle"
              aria-label="Izbira"
            >
              <span className="flex items-center justify-center leading-none">
                <AdminCheckbox
                  checked={allDraftItemsSelected}
                  onChange={onToggleAllDraftItems}
                  aria-label="Izberi vse postavke ponudbe"
                  className={quoteItemSelectionCheckboxClassName}
                  disabled={!editable || disabled || sourceItems.length === 0}
                />
              </span>
            </th>
            <th className={adminTableHeaderCellLeftClassName}>Vrsta</th>
            <th className={adminTableHeaderCellLeftClassName}>Artikel</th>
            <th className={adminTableHeaderCellCenterClassName}>Količina</th>
            <th className={adminTableHeaderCellCenterClassName}>Neto/enoto</th>
            <th className={adminTableHeaderCellCenterClassName}>Popust</th>
          </tr>
        </thead>
        {lineNumbers.map((lineNumber) => {
          const requestedItem = requestedByLineNumber.get(lineNumber) ?? null;
          const offeredItem = offeredByLineNumber.get(lineNumber) ?? null;
          const draftItem = editable && offeredItem ? offeredItem as DraftItem : null;
          const snapshotItem =
            !editable && offeredItem ? offeredItem as AdminQuoteItem : null;
          const rowLabelItem = requestedItem ?? draftItem ?? snapshotItem;
          const rowLabel = rowLabelItem
            ? itemTitle(rowLabelItem)
            : 'postavka ' + lineNumber;
          const offeredSku =
            draftItem?.sku || snapshotItem?.sku || requestedItem?.sku || '';
          const catalogOptions = [...baseCatalogOptions];
          if (
            draftItem &&
            draftItem.catalogVariantId > 0 &&
            !catalogChoices.some(
              (choice) => choice.catalogVariantId === draftItem.catalogVariantId
            )
          ) {
            catalogOptions.unshift({
              value: String(draftItem.catalogVariantId),
              label: itemTitle(draftItem) + ' · ' + (draftItem.sku || 'brez SKU')
            });
          }

          return (
            <tbody key={lineNumber} className="border-t border-slate-200/90">
              {requestedItem ? (
                <tr className="h-14 bg-slate-50/70" data-item-row="requested">
                  <td className="p-0" aria-hidden="true" />
                  <th scope="row" className={adminTableBodyCellLeftClassName}>
                    <span className="inline-flex rounded-full bg-slate-200/80 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.08em] text-slate-600">
                      Zahtevano
                    </span>
                  </th>
                  <td className={adminTableBodyCellLeftClassName + ' text-slate-900'}>
                    <span data-item-title className="block truncate font-medium">
                      {itemTitle(requestedItem)}
                    </span>
                    <span data-item-sku className="mt-0.5 block text-[10px] font-normal text-slate-500">
                      SKU: {requestedItem.sku || '—'}
                    </span>
                  </td>
                  <td className={adminTableBodyCellCenterClassName}>
                    <span data-item-field="quantity" className={quoteItemQuantitySlotClassName}>
                      {requestedItem.quantity} {requestedItem.unit ?? ''}
                    </span>
                  </td>
                  <td className={adminTableBodyCellCenterClassName}>
                    <span data-item-field="unit-net" className={quoteItemUnitNetSlotClassName}>
                      {formatCurrency(requestedItem.unitNet, requestedItem.currency)}
                    </span>
                  </td>
                  <td className={adminTableBodyCellCenterClassName}>
                    <span data-item-field="discount" className={quoteItemDiscountSlotClassName}>
                      {requestedItem.discountPct.toFixed(2)} %
                    </span>
                  </td>
                </tr>
              ) : (
                <tr className="h-14 bg-slate-50/70" data-item-row="requested-empty">
                  <td className="p-0" aria-hidden="true" />
                  <th scope="row" className={adminTableBodyCellLeftClassName}>
                    <span className="inline-flex rounded-full bg-slate-200/80 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.08em] text-slate-600">
                      Zahtevano
                    </span>
                  </th>
                  <td className={adminTableBodyCellLeftClassName + ' text-slate-500'}>
                    Dodatna postavka ponudbe.
                  </td>
                  <td className={adminTableBodyCellCenterClassName}>—</td>
                  <td className={adminTableBodyCellCenterClassName}>—</td>
                  <td className={adminTableBodyCellCenterClassName}>—</td>
                </tr>
              )}
              {draftItem || snapshotItem ? (
                <tr
                  className="h-[76px] bg-white hover:bg-[color:var(--hover-neutral)]"
                  data-item-row="offered"
                >
                  <td className="p-0 text-center align-middle">
                    <span className="flex items-center justify-center leading-none">
                      <AdminCheckbox
                        checked={Boolean(
                          editable &&
                          draftItem &&
                          selectedDraftItemIds.includes(draftItem.id)
                        )}
                        onChange={() => {
                          if (draftItem) onToggleDraftItem(draftItem.id);
                        }}
                        aria-label={'Izberi ponujeno postavko ' + rowLabel}
                        className={quoteItemSelectionCheckboxClassName}
                        disabled={!editable || !draftItem || disabled}
                      />
                    </span>
                  </td>
                  <th scope="row" className={adminTableBodyCellLeftClassName}>
                    <span className="inline-flex rounded-full bg-blue-50 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.08em] text-[color:var(--blue-600)]">
                      Ponujeno
                    </span>
                  </th>
                  <td className={adminTableBodyCellLeftClassName + ' py-2'}>
                    {draftItem ? (
                      <CustomSelect
                        value={
                          draftItem.catalogVariantId > 0
                            ? String(draftItem.catalogVariantId)
                            : ''
                        }
                        onChange={(catalogVariantId) => {
                          const choice = catalogChoices.find(
                            (candidate) =>
                              candidate.catalogVariantId === Number(catalogVariantId)
                          );
                          if (!choice) return;
                          const discountPct = normaliseDiscount(
                            choice.discountPercentage
                          );
                          onUpdateDraftItem(draftItem.id, {
                            catalogItemId: choice.catalogItemId,
                            catalogVariantId: choice.catalogVariantId,
                            productName: choice.productName,
                            variantName: choice.variantName,
                            sku: choice.sku,
                            unit: choice.unit,
                            baseUnitNet: choice.unitPrice,
                            discountPct,
                            unitNet: unitNetFromDiscount(
                              choice.unitPrice,
                              discountPct
                            )
                          });
                        }}
                        options={catalogOptions}
                        disabled={
                          disabled ||
                          catalogLoadState !== 'ready' ||
                          catalogChoices.length === 0
                        }
                        placeholder={
                          catalogLoadState === 'loading' ||
                          catalogLoadState === 'idle'
                            ? 'Nalagam katalog …'
                            : catalogLoadState === 'error'
                              ? 'Kataloga ni mogoče naložiti'
                              : 'Izberite artikel'
                        }
                        ariaLabel={'Ponujeni artikel ' + rowLabel}
                        containerClassName="w-full"
                        className={compactInputClassName + ' !h-7 w-full text-left'}
                        valueClassName="text-[11px] font-medium text-slate-900"
                        menuClassName="text-[11px]"
                      />
                    ) : (
                      <span
                        data-item-title
                        className="block truncate font-medium text-slate-900"
                        title={snapshotItem ? itemTitle(snapshotItem) : ''}
                      >
                        {snapshotItem ? itemTitle(snapshotItem) : '—'}
                      </span>
                    )}
                    <span data-item-sku className="mt-0.5 block text-[10px] font-normal text-slate-500">
                      SKU: {offeredSku || '—'}
                    </span>
                  </td>
                  <td className={adminTableBodyCellCenterClassName}>
                    {draftItem ? (
                      <input
                        data-item-field="quantity"
                        aria-label={'Količina ' + rowLabel}
                        type="number"
                        min="1"
                        step="1"
                        value={draftItem.quantity}
                        disabled={disabled}
                        onChange={(event) =>
                          onUpdateDraftItem(draftItem.id, {
                            quantity: Number(event.target.value)
                          })
                        }
                        className={compactInputClassName + ' mx-auto max-w-24 text-center tabular-nums'}
                      />
                    ) : (
                      <span data-item-field="quantity" className={quoteItemQuantitySlotClassName}>
                        {snapshotItem?.quantity ?? '—'} {snapshotItem?.unit ?? ''}
                      </span>
                    )}
                  </td>
                  <td className={adminTableBodyCellCenterClassName}>
                    {draftItem ? (
                      <input
                        data-item-field="unit-net"
                        aria-label={'Neto cena ' + rowLabel}
                        type="number"
                        min="0"
                        step="0.01"
                        value={draftItem.unitNet}
                        disabled={disabled}
                        onChange={(event) => {
                          const unitNet = Number(event.target.value);
                          onUpdateDraftItem(draftItem.id, {
                            unitNet,
                            discountPct: discountFromUnitNet(
                              draftItem.baseUnitNet,
                              unitNet
                            )
                          });
                        }}
                        className={compactInputClassName + ' mx-auto max-w-28 text-center tabular-nums'}
                      />
                    ) : (
                      <span data-item-field="unit-net" className={quoteItemUnitNetSlotClassName}>
                        {formatCurrency(
                          snapshotItem?.unitNet ?? 0,
                          snapshotItem?.currency ??
                            requestedItem?.currency ??
                            'EUR'
                        )}
                      </span>
                    )}
                  </td>
                  <td className={adminTableBodyCellCenterClassName}>
                    {draftItem ? (
                      <input
                        data-item-field="discount"
                        aria-label={'Popust ' + rowLabel}
                        type="number"
                        min="0"
                        max="100"
                        step="0.01"
                        value={draftItem.discountPct}
                        disabled={disabled}
                        onChange={(event) => {
                          const discountPct = normaliseDiscount(
                            Number(event.target.value)
                          );
                          onUpdateDraftItem(draftItem.id, {
                            discountPct,
                            unitNet: unitNetFromDiscount(
                              draftItem.baseUnitNet,
                              discountPct
                            )
                          });
                        }}
                        className={compactInputClassName + ' mx-auto max-w-24 text-center tabular-nums'}
                      />
                    ) : (
                      <span data-item-field="discount" className={quoteItemDiscountSlotClassName}>
                        {(snapshotItem?.discountPct ?? 0).toFixed(2)} %
                      </span>
                    )}
                  </td>
                </tr>
              ) : (
                <tr className="h-[76px] bg-white" data-item-row="offered-empty">
                  <td className="p-0 text-center align-middle">
                    <span className="flex items-center justify-center leading-none">
                      <AdminCheckbox
                        checked={false}
                        onChange={() => undefined}
                        aria-label={'Ponujena postavka ' + rowLabel + ' ni pripravljena'}
                        className={quoteItemSelectionCheckboxClassName}
                        disabled
                      />
                    </span>
                  </td>
                  <th scope="row" className={adminTableBodyCellLeftClassName}>
                    <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.08em] text-slate-500">
                      Ponujeno
                    </span>
                  </th>
                  <td
                    colSpan={4}
                    className={adminTableBodyCellLeftClassName + ' text-slate-500'}
                  >
                    Ponudba za ta artikel še ni pripravljena.
                  </td>
                </tr>
              )}
            </tbody>
          );
        })}
      </table>
    </div>
  );
}
export default function AdminQuoteDetailClient({ detail }: { detail: AdminQuoteDetail }) {
  const router = useRouter();
  const { toast } = useToast();
  const isClientReady = useSyncExternalStore(
    subscribeToClientReadiness,
    getClientReadinessSnapshot,
    getServerReadinessSnapshot
  );
  const draftVersion = useMemo(
    () => detail.offerVersions.find((version) => version.status === 'draft') ?? null,
    [detail.offerVersions]
  );
  const currentIssuedVersion = useMemo(
    () => detail.offerVersions.find((version) => version.status === 'issued' && version.isCurrent) ?? null,
    [detail.offerVersions]
  );
  const canEditRequestDetails =
    Boolean(draftVersion || currentIssuedVersion) ||
    detail.status === 'received' ||
    detail.status === 'in_preparation';
  const currentVersion = draftVersion ?? currentIssuedVersion ?? detail.offerVersions[0] ?? null;
  const editableVersion =
    draftVersion && (detail.status === 'received' || detail.status === 'in_preparation')
      ? draftVersion
      : null;
  const canCreateDraft = !currentVersion && (detail.status === 'received' || detail.status === 'in_preparation');
  const canRequestClarification = ['received', 'in_preparation', 'offer_issued', 'awaiting_purchase_order_review'].includes(detail.status);
  const canReviseOffer = Boolean(
    !draftVersion && currentVersion && ['issued', 'withdrawn', 'expired'].includes(currentVersion.status)
  );
  const canWithdrawIssuedOffer = Boolean(currentIssuedVersion);
  const canManuallyEditRequestStatus =
    !currentIssuedVersion &&
    (detail.status === 'received' || detail.status === 'in_preparation');
  const canCloseWithoutIssuing =
    ['received', 'in_preparation'].includes(detail.status) &&
    detail.offerVersions.every((version) => version.status === 'draft');
  const offerContextText = draftVersion && currentIssuedVersion?.offerNumber
    ? `Aktivna ponudba ${currentIssuedVersion.offerNumber} · nova različica V${draftVersion.versionNumber} je v pripravi.`
    : draftVersion
      ? `Ponudba V${draftVersion.versionNumber} je v pripravi in še ni bila izdana.`
      : currentVersion?.offerNumber
        ? `Ponudba ${currentVersion.offerNumber} · ${STATUS_LABELS[currentVersion.status] ?? currentVersion.status}.`
        : 'Ponudba še ni bila pripravljena.';
  const [draft, setDraft] = useState<DraftState | null>(() =>
    editableVersion ? toDraftState(editableVersion) : canCreateDraft ? toNewDraftState(detail) : null
  );
  const [persistedOfferDraft, setPersistedOfferDraft] = useState<DraftState | null>(() =>
    editableVersion ? toDraftState(editableVersion) : canCreateDraft ? toNewDraftState(detail) : null
  );
  const [savedDraftFingerprint, setSavedDraftFingerprint] = useState<string | null>(() =>
    comparableDraftFingerprint(
      editableVersion
        ? toPersistedDraftState(editableVersion)
        : canCreateDraft
          ? toNewDraftState(detail)
          : null
    )
  );
  const [persistedRequestDetails, setPersistedRequestDetails] = useState<QuoteRequestDetailsState>(() =>
    asQuoteRequestDetails(detail)
  );
  const [draftRequestDetails, setDraftRequestDetails] = useState<QuoteRequestDetailsState>(() =>
    asQuoteRequestDetails(detail)
  );
  const [persistedRequestTitle, setPersistedRequestTitle] = useState(() =>
    detail.adminTitle?.trim() || quoteRequestDefaultTitle(detail.requestNumber)
  );
  const [draftRequestTitle, setDraftRequestTitle] = useState(() =>
    detail.adminTitle?.trim() || quoteRequestDefaultTitle(detail.requestNumber)
  );
  const [requestStateVersion, setRequestStateVersion] = useState(detail.stateVersion);
  const [persistedAdminNotes, setPersistedAdminNotes] = useState(detail.adminNotes);
  const [draftAdminNotes, setDraftAdminNotes] = useState(detail.adminNotes);
  const [isEditingRequestDetails, setIsEditingRequestDetails] = useState(false);
  const [isEditingRequestHeader, setIsEditingRequestHeader] = useState(false);
  const [isEditingAdminNotes, setIsEditingAdminNotes] = useState(false);
  const [isEditingOffer, setIsEditingOffer] = useState(canCreateDraft);
  const [isMasterEditing, setIsMasterEditing] = useState(false);
  const [isPreparingOfferEdit, setIsPreparingOfferEdit] = useState(false);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [catalogChoices, setCatalogChoices] = useState<CatalogChoice[]>([]);
  const [catalogLoadState, setCatalogLoadState] =
    useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [selectedDraftItemIds, setSelectedDraftItemIds] = useState<number[]>([]);
  const [isQuoteItemPickerOpen, setIsQuoteItemPickerOpen] = useState(false);
  const [isClarificationDialogOpen, setIsClarificationDialogOpen] = useState(false);
  const [clarificationDialogStep, setClarificationDialogStep] =
    useState<AdminQuoteClarificationDialogStep>('compose');
  const [clarificationDraft, setClarificationDraft] = useState('');
  const [clarificationError, setClarificationError] = useState<string | null>(null);
  const [clarificationActionId, setClarificationActionId] = useState<string | null>(null);
  const [isIssueDialogOpen, setIsIssueDialogOpen] = useState(false);
  const [issueDialogError, setIssueDialogError] = useState<string | null>(null);
  const [issueActionId, setIssueActionId] = useState<string | null>(null);
  const {
    confirmation: customerEmailConfirmation,
    handleConfirmationRequired: handleCustomerEmailConfirmationRequired,
    cancelConfirmation: cancelCustomerEmailConfirmation,
    confirm: confirmCustomerEmail
  } = useCustomerEmailConfirmation();
  const [isShippingExplanationOpen, setIsShippingExplanationOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const previewUrlRef = useRef<string | null>(null);
  const previewAbortRef = useRef<AbortController | null>(null);
  const previewTriggerRef = useRef<HTMLButtonElement>(null);
  const quoteItemPickerTriggerRef = useRef<HTMLButtonElement | null>(null);
  const clarificationTriggerRef = useRef<HTMLButtonElement | null>(null);
  const clarificationTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const clarificationSendButtonRef = useRef<HTMLButtonElement | null>(null);
  const issueTriggerRef = useRef<HTMLButtonElement | null>(null);
  const issueCancelButtonRef = useRef<HTMLButtonElement | null>(null);
  const issueConfirmButtonRef = useRef<HTMLButtonElement | null>(null);
  const issueInFlightRef = useRef(false);
  const restorePreviewFocusRef = useRef(false);
  const enterOfferEditAfterRevisionRef = useRef(false);
  const enterMasterEditAfterRevisionRef = useRef(false);
  const offerEditorSnapshotKey = [
    detail.status,
    editableVersion?.id ?? 'none',
    editableVersion?.stateVersion ?? 'none',
    currentVersion?.id ?? 'none',
    currentVersion?.stateVersion ?? 'none',
    canCreateDraft ? 'new' : 'existing'
  ].join(':');
  const offerEditorSnapshotKeyRef = useRef(offerEditorSnapshotKey);

  const replacePreviewUrl = useCallback((nextUrl: string | null) => {
    const previousUrl = previewUrlRef.current;
    previewUrlRef.current = nextUrl;
    setPreviewUrl(nextUrl);
    if (previousUrl && previousUrl !== nextUrl) URL.revokeObjectURL(previousUrl);
  }, []);

  const closePreview = useCallback(() => {
    restorePreviewFocusRef.current = true;
    replacePreviewUrl(null);
  }, [replacePreviewUrl]);
  const closeQuoteItemPicker = useCallback(() => {
    setIsQuoteItemPickerOpen(false);
  }, []);

  useEffect(() => {
    if (offerEditorSnapshotKeyRef.current === offerEditorSnapshotKey) return;
    offerEditorSnapshotKeyRef.current = offerEditorSnapshotKey;
    const nextDraft = editableVersion
      ? toDraftState(editableVersion)
      : canCreateDraft
        ? toNewDraftState(detail)
        : null;
    setDraft(nextDraft);
    setPersistedOfferDraft(nextDraft);
    setSavedDraftFingerprint(
      comparableDraftFingerprint(
        editableVersion
          ? toPersistedDraftState(editableVersion)
          : canCreateDraft
            ? nextDraft
            : null
      )
    );
    setIsEditingOffer(
      canCreateDraft || Boolean(nextDraft && enterOfferEditAfterRevisionRef.current)
    );
    setIsPreparingOfferEdit(false);
    setSelectedDraftItemIds([]);
    setIsQuoteItemPickerOpen(false);
    enterOfferEditAfterRevisionRef.current = false;
  }, [canCreateDraft, detail, editableVersion, offerEditorSnapshotKey]);

  useEffect(() => {
    if (isEditingOffer) return;
    setSelectedDraftItemIds([]);
    setIsQuoteItemPickerOpen(false);
  }, [isEditingOffer]);
  useEffect(() => {
    if (!isEditingOffer || catalogLoadState !== 'idle') return;
    setCatalogLoadState('loading');
    void (async () => {
      try {
        const response = await fetch('/api/admin/catalog-items');
        const payload = await response.json().catch(() => null) as {
          items?: CatalogChoice[];
          message?: string;
        } | null;
        if (!response.ok) {
          throw new Error(payload?.message ?? 'Kataloga artiklov ni bilo mogoče naložiti.');
        }
        setCatalogChoices(payload?.items ?? []);
        setCatalogLoadState('ready');
      } catch {
        setCatalogLoadState('error');
      }
    })();
  }, [catalogLoadState, isEditingOffer]);
  useEffect(() => {
    const shouldResumeMasterEdit = enterMasterEditAfterRevisionRef.current;
    const nextDetails = asQuoteRequestDetails(detail);
    const nextTitle = detail.adminTitle?.trim()
      || quoteRequestDefaultTitle(detail.requestNumber);
    setPersistedRequestDetails(nextDetails);
    setDraftRequestDetails(nextDetails);
    setPersistedRequestTitle(nextTitle);
    setDraftRequestTitle(nextTitle);
    setRequestStateVersion(detail.stateVersion);
    setPersistedAdminNotes(detail.adminNotes);
    setDraftAdminNotes(detail.adminNotes);
    setIsEditingRequestDetails(shouldResumeMasterEdit && canEditRequestDetails);
    setIsEditingRequestHeader(shouldResumeMasterEdit);
    setIsEditingAdminNotes(shouldResumeMasterEdit);
    setIsMasterEditing(shouldResumeMasterEdit);
    setIsIssueDialogOpen(false);
    setIssueDialogError(null);
    setIssueActionId(null);
    issueInFlightRef.current = false;
    enterMasterEditAfterRevisionRef.current = false;
  }, [canEditRequestDetails, detail]);

  useEffect(
    () => () => {
      previewAbortRef.current?.abort();
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    },
    []
  );

  useEffect(() => {
    if (previewUrl || !restorePreviewFocusRef.current) return;
    restorePreviewFocusRef.current = false;
    const focusTimer = window.setTimeout(() => previewTriggerRef.current?.focus(), 100);
    return () => window.clearTimeout(focusTimer);
  }, [previewUrl]);

  const activeRequestDetails = isEditingRequestDetails
    ? draftRequestDetails
    : persistedRequestDetails;
  const activeRequestStatus = isEditingRequestHeader
    ? draftRequestDetails.status
    : persistedRequestDetails.status;
  const activeVisibleRequestStatus =
    getQuoteRequestVisibleStatusValue(activeRequestStatus) ?? 'received';
  const requestStatusSelectionOptions = useMemo(
    () => buildQuoteRequestStatusSelectionOptions({
      currentStatus: activeRequestStatus,
      hasIssuedOfferHistory: detail.offerVersions.some(
        (version) => version.status !== 'draft'
      ),
      hasDraft: Boolean(draftVersion)
    }),
    [activeRequestStatus, detail.offerVersions, draftVersion]
  );
  const activeAdminNotes = isEditingAdminNotes ? draftAdminNotes : persistedAdminNotes;
  const displayedOfferDetails = isEditingOffer && draft
    ? draft
    : currentVersion
      ? toDraftState(currentVersion)
      : draft;
  const displayedOfferValidUntil = currentVersion
    ? formatDateTime(currentVersion.validUntil)
    : displayedOfferDetails?.validUntil ?? '';
  const displayedOfferCurrency = currentVersion?.currency ?? 'EUR';
  const shippingBreakdown = normalizeQuoteShippingSnapshot(
    currentVersion?.shippingSnapshot ?? null
  );
  const automaticShippingCents =
    shippingBreakdown?.status === 'calculated'
      ? shippingBreakdown.automaticAmountCents
      : null;
  const displayedShippingCents = displayedOfferDetails
    ? Math.round(displayedOfferDetails.shipping * 100)
    : null;
  const shippingUsesManualAmount =
    shippingBreakdown?.status === 'manual_quote' ||
    (automaticShippingCents !== null &&
      displayedShippingCents !== null &&
      automaticShippingCents !== displayedShippingCents);
  const canResetQuoteShipping =
    automaticShippingCents !== null &&
    shippingUsesManualAmount &&
    Boolean(draft);
  const requestStatusDirty =
    draftRequestDetails.status !== persistedRequestDetails.status;
  const requestTitleDirty = draftRequestTitle.trim() !== persistedRequestTitle;
  const requestProfileDirty = useMemo(
    () => JSON.stringify({ ...draftRequestDetails, status: persistedRequestDetails.status }) !== JSON.stringify(persistedRequestDetails),
    [draftRequestDetails, persistedRequestDetails]
  );
  const adminNotesDirty = draftAdminNotes !== persistedAdminNotes;
  const draftHasUnsavedChanges = Boolean(
    draft && savedDraftFingerprint && comparableDraftFingerprint(draft) !== savedDraftFingerprint
  );
  const hasActiveQuoteEditor =
    isMasterEditing ||
    isEditingRequestDetails ||
    isEditingRequestHeader ||
    isEditingAdminNotes ||
    isEditingOffer;
  const editableExpectedStateVersion =
    editableVersion && draft?.offerVersionId === editableVersion.id
      ? draft.expectedStateVersion
      : editableVersion?.stateVersion ?? null;

  const updateDraftRequestDetails = (patch: Partial<QuoteRequestDetailsState>) => {
    setDraftRequestDetails((current) => ({ ...current, ...patch }));
  };
  const getRequestDetailsValidationMessage = () => {
    if (!draftRequestDetails.contactName.trim() || !draftRequestDetails.email.trim()) {
      return 'Kontaktno ime in e-poštni naslov sta obvezna.';
    }
    if (
      draftRequestDetails.customerType !== 'individual' &&
      !draftRequestDetails.organizationName.trim()
    ) {
      return 'Naziv organizacije je obvezen.';
    }
    if (
      draftRequestDetails.postalCode.trim() &&
      !/^\d{4}$/.test(draftRequestDetails.postalCode.trim())
    ) {
      return 'Poštna številka mora imeti 4 številke.';
    }
    if (draftRequestDetails.countryCode.trim().toUpperCase() !== 'SI') {
      return 'Država mora biti SI.';
    }
    return null;
  };

  const getRequestStatusValidationMessage = () => {
    if (
      !isManuallyEditableQuoteRequestStatus(persistedRequestDetails.status) ||
      !isManuallyEditableQuoteRequestStatus(draftRequestDetails.status) ||
      !canManuallyEditRequestStatus
    ) {
      return 'Ta sprememba zahteva dejanje poteka ponudbe.';
    }
    return null;
  };

  const toggleRequestDetailsEdit = () => {
    if (busyAction) return;
    if (!canEditRequestDetails) {
      toast.error(
        currentIssuedVersion
          ? draftVersion
            ? 'Podatki stranke ostanejo zaklenjeni, dokler je izdana ponudba aktivna. Pogoje nove različice uredite v oknu Ponudba.'
            : 'Podatki stranke v aktivni izdani ponudbi so zaklenjeni.'
          : 'Podatkov povpraševanja v trenutnem stanju ni mogoče urejati.'
      );
      return;
    }
    if (isEditingRequestDetails) {
      setDraftRequestDetails((current) => ({
        ...persistedRequestDetails,
        status: isEditingRequestHeader
          ? current.status
          : persistedRequestDetails.status
      }));
      setIsEditingRequestDetails(false);
      return;
    }
    setIsEditingRequestDetails(true);
  };
  const toggleAdminNotesEdit = () => {
    if (busyAction) return;
    if (isEditingAdminNotes) {
      setDraftAdminNotes(persistedAdminNotes);
      setIsEditingAdminNotes(false);
      return;
    }
    setDraftAdminNotes(persistedAdminNotes);
    setIsEditingAdminNotes(true);
  };

  const saveRequestStatus = async (
    expectedRequestStateVersion = requestStateVersion,
    showSuccess = true
  ): Promise<number | null> => {
    if (!isEditingRequestHeader || !requestStatusDirty || busyAction) return null;
    const validationMessage = getRequestStatusValidationMessage();
    if (validationMessage) {
      toast.error(validationMessage);
      return null;
    }

    setBusyAction('save-status');
    try {
      const response = await fetch(`/api/admin/quote-requests/${detail.id}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          expectedRequestStateVersion,
          status: draftRequestDetails.status
        })
      });
      const payload = await response.json().catch(() => null) as {
        message?: string;
        stateVersion?: number;
        status?: string;
      } | null;
      if (!response.ok) {
        throw new Error(payload?.message ?? 'Statusa povpraševanja ni bilo mogoče shraniti.');
      }

      const nextStateVersion = Number(payload?.stateVersion);
      const nextStatus = String(payload?.status ?? draftRequestDetails.status);
      if (!Number.isSafeInteger(nextStateVersion) || nextStateVersion <= 0) {
        throw new Error('Strežnik ni vrnil veljavne različice povpraševanja.');
      }
      setRequestStateVersion(nextStateVersion);
      setPersistedRequestDetails((current) => ({ ...current, status: nextStatus }));
      setDraftRequestDetails((current) => ({ ...current, status: nextStatus }));
      if (showSuccess) {
        toast.success(payload?.message ?? 'Status povpraševanja je shranjen.');
      }
      return nextStateVersion;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Statusa povpraševanja ni bilo mogoče shraniti.');
      return null;
    } finally {
      setBusyAction(null);
    }
  };

  const saveRequestTitle = async (
    expectedRequestStateVersion = requestStateVersion,
    showSuccess = true
  ): Promise<number | null> => {
    if (!isEditingRequestHeader || !requestTitleDirty || busyAction) return null;

    setBusyAction('save-title');
    try {
      const response = await fetch(`/api/admin/quote-requests/${detail.id}/title`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          expectedRequestStateVersion,
          title: draftRequestTitle
        })
      });
      const payload = await response.json().catch(() => null) as {
        message?: string;
        stateVersion?: number;
        title?: string;
      } | null;
      if (!response.ok) {
        throw new Error(payload?.message ?? 'Naslova povpraševanja ni bilo mogoče shraniti.');
      }

      const nextStateVersion = Number(payload?.stateVersion);
      const nextTitle = String(
        payload?.title || quoteRequestDefaultTitle(detail.requestNumber)
      ).trim();
      if (!Number.isSafeInteger(nextStateVersion) || nextStateVersion <= 0) {
        throw new Error('Strežnik ni vrnil veljavne različice povpraševanja.');
      }
      setRequestStateVersion(nextStateVersion);
      setPersistedRequestTitle(nextTitle);
      setDraftRequestTitle(nextTitle);
      if (showSuccess) {
        toast.success(payload?.message ?? 'Naslov povpraševanja je shranjen.');
      }
      return nextStateVersion;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Naslova povpraševanja ni bilo mogoče shraniti.');
      return null;
    } finally {
      setBusyAction(null);
    }
  };

  const saveRequestDetails = async (
    expectedRequestStateVersion = requestStateVersion,
    showSuccess = true,
    expectedDraftStateVersion =
      persistedOfferDraft?.offerVersionId
        ? persistedOfferDraft.expectedStateVersion
        : undefined
  ): Promise<number | null> => {
    if (!isEditingRequestDetails || !requestProfileDirty || busyAction) return null;
    const validationMessage = getRequestDetailsValidationMessage();
    if (validationMessage) {
      toast.error(validationMessage);
      return null;
    }
    setBusyAction('save-details');
    try {
      const response = await fetch(`/api/admin/quote-requests/${detail.id}/details`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          expectedRequestStateVersion,
          expectedDraftStateVersion,
          ...draftRequestDetails,
          status: persistedRequestDetails.status
        })
      });
      const payload = await response.json().catch(() => null) as {
        message?: string;
        stateVersion?: number;
        draftStateVersion?: number | null;
        quoteOfferVersionId?: number | null;
        draftVersionNumber?: number | null;
        revisionCreated?: boolean;
        correctionScope?: 'request' | 'draft_revision';
        issuedOfferVersionId?: number | null;
        status?: string;
      } | null;
      if (!response.ok) {
        throw new Error(payload?.message ?? 'Podatkov povpraševanja ni bilo mogoče shraniti.');
      }
      const nextStateVersion = Number(payload?.stateVersion);
      const nextDraftStateVersion = Number(payload?.draftStateVersion);
      const nextDraftOfferVersionId = Number(payload?.quoteOfferVersionId);
      const nextDraftVersionNumber = Number(payload?.draftVersionNumber);
      const issuedOfferVersionId = Number(payload?.issuedOfferVersionId);
      const nextStatus =
        typeof payload?.status === 'string' && payload.status.trim()
          ? payload.status
          : persistedRequestDetails.status;
      if (!Number.isSafeInteger(nextStateVersion) || nextStateVersion <= 0) {
        throw new Error('Strežnik ni vrnil veljavne različice povpraševanja.');
      }
      setRequestStateVersion(nextStateVersion);
      const reconcileDraftStateVersion = (current: DraftState | null) => {
        if (payload?.correctionScope === 'draft_revision') {
          if (
            !Number.isSafeInteger(nextDraftOfferVersionId) ||
            nextDraftOfferVersionId <= 0 ||
            !Number.isSafeInteger(nextDraftVersionNumber) ||
            nextDraftVersionNumber <= 0 ||
            !Number.isSafeInteger(nextDraftStateVersion) ||
            nextDraftStateVersion <= 0 ||
            !Number.isSafeInteger(issuedOfferVersionId) ||
            issuedOfferVersionId <= 0
          ) {
            throw new Error(
              'Strežnik ni vrnil veljavne nove različice ponudbe. Osvežite stran in poskusite znova.'
            );
          }
          const revisionDraft = current ?? (currentIssuedVersion
            ? toDraftState(currentIssuedVersion)
            : null);
          return revisionDraft
            ? {
                ...revisionDraft,
                offerVersionId: nextDraftOfferVersionId,
                expectedStateVersion: nextDraftStateVersion
              }
            : revisionDraft;
        }
        if (!current) return current;
        if (
          current.offerVersionId > 0 &&
          Number.isSafeInteger(nextDraftStateVersion) &&
          nextDraftStateVersion > 0
        ) {
          return { ...current, expectedStateVersion: nextDraftStateVersion };
        }
        return current.offerVersionId === 0
          ? { ...current, expectedStateVersion: nextStateVersion }
          : current;
      };
      setDraft(reconcileDraftStateVersion);
      setPersistedOfferDraft(reconcileDraftStateVersion);
      const reconciledRequestDetails = {
        ...draftRequestDetails,
        status: nextStatus
      };
      setPersistedRequestDetails(reconciledRequestDetails);
      setDraftRequestDetails(reconciledRequestDetails);
      setIsEditingRequestDetails(false);
      if (showSuccess) {
        toast.success(
          payload?.message ?? (payload?.revisionCreated
            ? 'Popravek je shranjen v novi različici ponudbe.'
            : 'Podatki povpraševanja so shranjeni.')
        );
      }
      if (payload?.correctionScope === 'draft_revision' && !isMasterEditing) {
        router.refresh();
      }
      return nextStateVersion;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Podatkov povpraševanja ni bilo mogoče shraniti.');
      return null;
    } finally {
      setBusyAction(null);
    }
  };

  const saveAdminNotes = async (
    expectedRequestStateVersion = requestStateVersion
  ): Promise<number | null> => {
    if (!isEditingAdminNotes || !adminNotesDirty || busyAction) return null;

    setBusyAction('save-admin-notes');
    try {
      const response = await fetch(`/api/admin/quote-requests/${detail.id}/notes`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          expectedRequestStateVersion,
          adminNotes: draftAdminNotes
        })
      });
      const payload = await response.json().catch(() => null) as {
        adminNotes?: string;
        message?: string;
        stateVersion?: number;
      } | null;
      if (!response.ok) {
        throw new Error(payload?.message ?? 'Opombe administratorja ni mogoče shraniti.');
      }

      const nextStateVersion = Number(payload?.stateVersion);
      if (!Number.isSafeInteger(nextStateVersion) || nextStateVersion <= 0) {
        throw new Error('Strežnik ni vrnil veljavne različice povpraševanja.');
      }
      const nextAdminNotes = String(payload?.adminNotes ?? draftAdminNotes);
      setRequestStateVersion(nextStateVersion);
      setPersistedAdminNotes(nextAdminNotes);
      setDraftAdminNotes(nextAdminNotes);
      setIsEditingAdminNotes(false);
      toast.success(payload?.message ?? 'Opomba administratorja je shranjena.');
      return nextStateVersion;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Opombe administratorja ni mogoče shraniti.');
      return null;
    } finally {
      setBusyAction(null);
    }
  };

  const persistDraft = async (draftToPersist: DraftState) => {
    const response = await fetch(`/api/admin/quote-requests/${detail.id}/draft`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(draftToPersist)
    });
    const payload = await response.json().catch(() => null) as {
      message?: string;
      quoteOfferVersionId?: number;
      stateVersion?: number;
      requestStateVersion?: number;
    } | null;
    if (!response.ok) {
      throw new Error(payload?.message ?? 'Osnutka ni bilo mogoče shraniti.');
    }

    const quoteOfferVersionId = Number(payload?.quoteOfferVersionId);
    const stateVersion = Number(payload?.stateVersion);
    const nextRequestStateVersion = Number(payload?.requestStateVersion);
    if (
      !Number.isSafeInteger(quoteOfferVersionId) ||
      quoteOfferVersionId <= 0 ||
      !Number.isSafeInteger(stateVersion) ||
      stateVersion <= 0 ||
      !Number.isSafeInteger(nextRequestStateVersion) ||
      nextRequestStateVersion <= 0
    ) {
      throw new Error('Osnutek je bil shranjen, vendar strani ni bilo mogoče uskladiti. Osvežite stran.');
    }

    const savedDraft = {
      ...draftToPersist,
      offerVersionId: quoteOfferVersionId,
      expectedStateVersion: stateVersion
    };
    setDraft(savedDraft);
    setPersistedOfferDraft(savedDraft);
    setSavedDraftFingerprint(comparableDraftFingerprint(savedDraft));
    setRequestStateVersion(nextRequestStateVersion);

    return {
      message: payload?.message,
      quoteOfferVersionId,
      stateVersion,
      requestStateVersion: nextRequestStateVersion
    };
  };

  const validateIssueDraft = (draftToValidate: DraftState | null) => {
    if (!editableVersion || !draftToValidate) {
      toast.error('Osnutek ponudbe ni pripravljen za izdajo.');
      return false;
    }
    if (draftToValidate.items.length === 0) {
      toast.error('Ponudba mora vsebovati vsaj eno postavko.');
      return false;
    }
    if (
      !draftToValidate.validUntil ||
      !draftToValidate.deliveryTerms.trim() ||
      !draftToValidate.paymentTerms.trim()
    ) {
      toast.error('Pred izdajo izpolnite veljavnost ter dobavne in plačilne pogoje.');
      return false;
    }
    if (draftToValidate.shipping === 0 && !draftToValidate.confirmFreeShipping) {
      toast.error('Brezplačno dostavo morate pred izdajo izrecno potrditi.');
      return false;
    }
    return true;
  };

  const callAction = async (
    action: 'issue' | 'revise' | 'withdraw' | 'close',
    options: QuoteActionOptions = {}
  ) => {
    if (busyAction) return false;
    if (action === 'issue') {
      if (!isIssueDialogOpen || !issueActionId) return false;
      if (!validateIssueDraft(draft)) return false;
    }
    const targetVersion = action === 'issue'
      ? editableVersion
      : action === 'withdraw'
        ? currentIssuedVersion
        : action === 'revise'
          ? currentIssuedVersion ?? currentVersion
          : null;
    if (action !== 'close' && !targetVersion) return false;
    const reason = options.reason ?? null;
    if ((action === 'withdraw' || action === 'close') && !reason?.trim()) return false;
    setBusyAction(action);
    try {
      let actionOfferVersionId = targetVersion?.id ?? null;
      let actionOfferStateVersion =
        action === 'issue' && editableExpectedStateVersion !== null
          ? editableExpectedStateVersion
          : targetVersion?.stateVersion ?? detail.stateVersion;
      let actionRequestStateVersion = requestStateVersion;

      if (
        action === 'issue' &&
        draft &&
        draftHasUnsavedChanges
      ) {
        const preflightResponse = await fetch(
          `/api/admin/quote-requests/${detail.id}/issue`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              quoteRequestId: detail.id,
              offerVersionId: actionOfferVersionId,
              expectedStateVersion: actionOfferStateVersion,
              expectedRequestStateVersion: actionRequestStateVersion,
              actionId: issueActionId,
              confirmationOnly: true,
              ...(options.customerEmailConfirmationToken
                ? {
                    customerEmailConfirmationToken:
                      options.customerEmailConfirmationToken
                  }
                : {})
            })
          }
        );
        const preflightPayload = await preflightResponse.json().catch(() => null) as {
          message?: string;
          confirmation?: unknown;
        } | null;
        if (
          handleCustomerEmailConfirmationRequired(
            preflightResponse,
            preflightPayload,
            (confirmationToken) =>
              callAction(action, {
                ...options,
                reason,
                customerEmailConfirmationToken: confirmationToken
              }).then(() => undefined)
          )
        ) {
          return false;
        }
        if (!preflightResponse.ok) {
          throw new Error(
            preflightPayload?.message ??
              'Preverjanje e-poštnega obvestila ni uspelo.'
          );
        }
      }

      if (action === 'issue' && draft && draftHasUnsavedChanges) {
        const saved = await persistDraft(draft);
        actionOfferVersionId = saved.quoteOfferVersionId;
        actionOfferStateVersion = saved.stateVersion;
        actionRequestStateVersion = saved.requestStateVersion;
      }

      const response = await fetch(`/api/admin/quote-requests/${detail.id}/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quoteRequestId: detail.id,
          offerVersionId: actionOfferVersionId,
          expectedStateVersion: actionOfferStateVersion,
          expectedRequestStateVersion: actionRequestStateVersion,
          reason: reason?.trim() || null,
          ...(options.customerEmailConfirmationToken
            ? {
                customerEmailConfirmationToken:
                  options.customerEmailConfirmationToken
              }
            : {}),
          ...(action === 'issue' && draft ? {
            actionId: issueActionId,
            validUntil: draft.validUntil,
            termsText: draft.termsText,
            termsVersion: draft.termsVersion,
            freeShippingConfirmed: draft.confirmFreeShipping,
            shippingReason: draft.shipping === 0
              ? 'Administrator je izrecno potrdil brezplačno dostavo.'
              : 'Administrator je potrdil znesek dostave v ponudbi.'
          } : {})
        })
      });
      const payload = await response.json().catch(() => null) as {
        code?: string;
        message?: string;
        offerNumber?: string;
        documentStatus?: string;
        emailQueued?: boolean;
        confirmation?: unknown;
      } | null;
      if (
        action !== 'revise' &&
        handleCustomerEmailConfirmationRequired(
          response,
          payload,
          (confirmationToken) =>
            callAction(action, {
              ...options,
              reason,
              customerEmailConfirmationToken: confirmationToken
            }).then(() => undefined)
        )
      ) {
        return false;
      }
      if (!response.ok) throw new Error(payload?.message ?? 'Dejanja ni bilo mogoče izvesti.');
      if (action === 'issue') {
        const reference = payload?.offerNumber?.trim() || 'Ponudba';
        if (payload?.emailQueued === true) {
          toast.success(payload.message ?? `${reference} je izdana; e-pošta je v čakalni vrsti.`);
        } else {
          toast.success(payload?.message ?? `${reference} je izdana. E-pošta stranki ni bila uvrščena; preverite nastavitve E-pošta.`);
        }
      } else {
        toast.success(payload?.message ?? 'Sprememba je shranjena.');
      }
      router.refresh();
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Dejanja ni bilo mogoče izvesti.';
      if (action === 'issue') setIssueDialogError(message);
      toast.error(message);
      return false;
    } finally {
      setBusyAction(null);
    }
  };

  const requestLifecycleAction = (
    action: 'withdraw' | 'close'
  ) => {
    if (busyAction) return;
    const reason = window.prompt(
      action === 'withdraw'
        ? 'Razlog umika izdane ponudbe (viden stranki):'
        : 'Razlog zaključka brez izdaje ponudbe (viden stranki):'
    );
    if (!reason?.trim()) return;

    void callAction(action, { reason: reason.trim() });
  };
  const handleRequestStatusSelection = (value: string) => {
    if (!isEditingRequestHeader || busyAction) return;
    const selectedOption = requestStatusSelectionOptions.find(
      (option) => option.value === value
    );
    if (!selectedOption || selectedOption.disabled) return;
    const targetStatus = getManualQuoteRequestStatusTarget(selectedOption.value);
    if (!targetStatus) return;
    updateDraftRequestDetails({ status: targetStatus });
  };

  const saveQuoteChanges = async () => {
    if (busyAction || isPreparingOfferEdit) return;
    let nextRequestStateVersion = requestStateVersion;
    let nextDraftStateVersion =
      persistedOfferDraft?.offerVersionId
        ? persistedOfferDraft.expectedStateVersion
        : undefined;
    let savedAnyChanges = false;
    const requestChangesWereDirty =
      (isEditingRequestDetails && requestProfileDirty) ||
      (isEditingRequestHeader && (requestTitleDirty || requestStatusDirty)) ||
      (isEditingAdminNotes && adminNotesDirty);

    if (isEditingRequestDetails && requestProfileDirty) {
      const validationMessage = getRequestDetailsValidationMessage();
      if (validationMessage) {
        toast.error(validationMessage);
        return;
      }
    }
    if (isEditingRequestHeader && requestStatusDirty) {
      const validationMessage = getRequestStatusValidationMessage();
      if (validationMessage) {
        toast.error(validationMessage);
        return;
      }
    }
    if (isEditingOffer && draftHasUnsavedChanges) {
      if (!draft || draft.items.length === 0) {
        toast.error('Ponudba mora vsebovati vsaj eno postavko.');
        return;
      }
      if (draft.shipping === 0 && !draft.confirmFreeShipping) {
        toast.error('Brezplačno dostavo morate izrecno potrditi.');
        return;
      }

      setBusyAction('save-all');
      try {
        const saved = await persistDraft(draft);
        nextRequestStateVersion = saved.requestStateVersion;
        nextDraftStateVersion = saved.stateVersion;
        savedAnyChanges = true;
        if (!requestChangesWereDirty) {
          toast.success(saved.message ?? 'Osnutek ponudbe je shranjen.');
        }
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Osnutka ni bilo mogoče shraniti.');
        return;
      } finally {
        setBusyAction(null);
      }
    }

    if (isEditingRequestDetails && requestProfileDirty) {
      const savedStateVersion = await saveRequestDetails(
        nextRequestStateVersion,
        !(isEditingRequestHeader && (requestTitleDirty || requestStatusDirty))
          && !(isEditingAdminNotes && adminNotesDirty),
        nextDraftStateVersion
      );
      if (!savedStateVersion) return;
      nextRequestStateVersion = savedStateVersion;
      savedAnyChanges = true;
    }
    if (isEditingRequestHeader && requestTitleDirty) {
      const savedStateVersion = await saveRequestTitle(
        nextRequestStateVersion,
        !requestStatusDirty && !(isEditingAdminNotes && adminNotesDirty)
      );
      if (!savedStateVersion) return;
      nextRequestStateVersion = savedStateVersion;
      savedAnyChanges = true;
    }
    if (isEditingRequestHeader && requestStatusDirty) {
      const savedStateVersion = await saveRequestStatus(
        nextRequestStateVersion,
        !(isEditingAdminNotes && adminNotesDirty)
      );
      if (!savedStateVersion) return;
      nextRequestStateVersion = savedStateVersion;
      savedAnyChanges = true;
    }
    if (isEditingAdminNotes && adminNotesDirty) {
      const savedStateVersion = await saveAdminNotes(nextRequestStateVersion);
      if (!savedStateVersion) return;
      savedAnyChanges = true;
    }

    setSelectedDraftItemIds([]);
    setIsQuoteItemPickerOpen(false);
    setIsEditingRequestDetails(false);
    setIsEditingRequestHeader(false);
    setIsEditingAdminNotes(false);
    setIsEditingOffer(false);
    setIsMasterEditing(false);
    if (savedAnyChanges) {
      router.refresh();
    }
  };

  const saveDraft = async () => {
    if (!draft || busyAction) return;
    if (draft.items.length === 0) {
      toast.error('Ponudba mora vsebovati vsaj eno postavko.');
      return;
    }
    if (draft.shipping === 0 && !draft.confirmFreeShipping) {
      toast.error('Brezplačno dostavo morate izrecno potrditi.');
      return;
    }
    setBusyAction('save');
    try {
      const saved = await persistDraft(draft);
      setSelectedDraftItemIds([]);
      setIsQuoteItemPickerOpen(false);
      toast.success(saved.message ?? 'Osnutek je shranjen; DDV in vsote je izračunal strežnik.');
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Osnutka ni bilo mogoče shraniti.');
    } finally {
      setBusyAction(null);
    }
  };

  const createPreview = async () => {
    if (!editableVersion || busyAction) return;
    if (draftHasUnsavedChanges) {
      toast.error('Predogled prikazuje shranjeni osnutek. Najprej kliknite »Shrani osnutek«.');
      return;
    }
    previewAbortRef.current?.abort();
    const controller = new AbortController();
    previewAbortRef.current = controller;
    setBusyAction('preview');
    try {
      const response = await fetch(`/api/admin/quote-requests/${detail.id}/preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          offerVersionId: editableVersion.id,
          expectedStateVersion: editableExpectedStateVersion ?? editableVersion.stateVersion
        })
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null) as { message?: string } | null;
        throw new Error(payload?.message ?? 'Predogleda ni bilo mogoče ustvariti.');
      }
      const blob = await response.blob();
      if (controller.signal.aborted) return;
      const pdfBlob = blob.type === 'application/pdf'
        ? blob
        : new Blob([blob], { type: 'application/pdf' });
      replacePreviewUrl(URL.createObjectURL(pdfBlob));
      toast.success('Predogled shranjenega osnutka je pripravljen.');
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      toast.error(error instanceof Error ? error.message : 'Predogleda ni bilo mogoče ustvariti.');
    } finally {
      if (previewAbortRef.current === controller) previewAbortRef.current = null;
      setBusyAction(null);
    }
  };

  const openIssueDialog = () => {
    if (busyAction) return;
    if (!validateIssueDraft(draft)) return;
    setIssueDialogError(null);
    setIssueActionId(window.crypto.randomUUID());
    setIsIssueDialogOpen(true);
  };

  const closeIssueDialog = () => {
    if (busyAction === 'issue' || issueInFlightRef.current) return;
    setIsIssueDialogOpen(false);
    setIssueDialogError(null);
    setIssueActionId(null);
  };

  const confirmIssue = async () => {
    if (busyAction || !isIssueDialogOpen) return;
    if (issueInFlightRef.current) return;
    if (!issueActionId) {
      setIssueDialogError('Potrditve izdaje ni bilo mogoče pripraviti. Zaprite okno in poskusite znova.');
      return;
    }
    issueInFlightRef.current = true;
    setIssueDialogError(null);
    try {
      const succeeded = await callAction('issue');
      if (succeeded) {
        setIsIssueDialogOpen(false);
        setIssueDialogError(null);
        setIssueActionId(null);
      }
    } finally {
      issueInFlightRef.current = false;
    }
  };
  const resetClarificationDialog = () => {
    setIsClarificationDialogOpen(false);
    setClarificationDialogStep('compose');
    setClarificationDraft('');
    setClarificationError(null);
    setClarificationActionId(null);
    window.requestAnimationFrame(() => clarificationTriggerRef.current?.focus());
  };

  const openClarificationDialog = () => {
    if (busyAction) return;
    setClarificationDraft('');
    setClarificationError(null);
    setClarificationActionId(window.crypto.randomUUID());
    setClarificationDialogStep('compose');
    setIsClarificationDialogOpen(true);
  };

  const advanceClarificationDialog = () => {
    const clarification = clarificationDraft.trim();
    if (!clarification) {
      setClarificationError('Vnesite, katero pojasnilo potrebujete od stranke.');
      clarificationTextareaRef.current?.focus();
      return;
    }
    setClarificationDraft(clarification);
    setClarificationError(null);
    setClarificationDialogStep('confirm-email');
  };

  const requestClarification = async (
    sendEmail: boolean,
    customerEmailConfirmationToken?: string
  ) => {
    if (busyAction || !isClarificationDialogOpen) return;
    const clarification = clarificationDraft.trim();
    if (!clarification || !clarificationActionId) {
      setClarificationDialogStep('compose');
      setClarificationError('Vnesite, katero pojasnilo potrebujete od stranke.');
      return;
    }
    setBusyAction('clarification');
    setClarificationError(null);
    try {
      const response = await fetch(`/api/admin/quote-requests/${detail.id}/clarification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          offerVersionId: currentVersion?.id ?? null,
          expectedRequestStateVersion: requestStateVersion,
          clarification,
          sendEmail,
          actionId: clarificationActionId,
          ...(sendEmail && customerEmailConfirmationToken
            ? { customerEmailConfirmationToken }
            : {})
        })
      });
      const payload = await response.json().catch(() => null) as {
        message?: string;
        recorded?: boolean;
        emailRequested?: boolean;
        emailQueued?: boolean;
        emailStatus?: 'not_requested' | 'not_queued' | 'pending' | 'processing' | 'sent' | 'failed';
      } | null;
      if (
        sendEmail &&
        handleCustomerEmailConfirmationRequired(
          response,
          payload,
          (confirmationToken) =>
            requestClarification(true, confirmationToken)
        )
      ) {
        return;
      }
      if (!response.ok) {
        throw new Error(payload?.message ?? 'Zahteve za pojasnilo ni bilo mogoče zabeležiti.');
      }
      if (payload?.recorded !== true) {
        throw new Error('Strežnik ni potrdil zapisa zahteve za pojasnilo.');
      }
      const message = payload.message
        ?? (sendEmail && payload.emailQueued
          ? 'Zahteva je zabeležena in e-pošta je v čakalni vrsti.'
          : 'Zahteva za pojasnilo je zabeležena v časovnici.');
      resetClarificationDialog();
      if (sendEmail && payload.emailStatus === 'failed') toast.error(message);
      else toast.success(message);
      router.refresh();
    } catch (error) {
      const message = error instanceof Error
        ? error.message
        : 'Zahteve za pojasnilo ni bilo mogoče zabeležiti.';
      setClarificationError(message);
      toast.error(message);
    } finally {
      setBusyAction(null);
    }
  };
  const retryEmail = async (
    jobId: string,
    customerEmailConfirmationToken?: string
  ) => {
    const job = detail.emailJobs.find((candidate) => candidate.id === jobId);
    if (busyAction || !job?.retryEligible) return;
    setBusyAction(`retry:${jobId}`);
    try {
      const response = await fetch(`/api/admin/quote-email-jobs/${jobId}/retry`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(customerEmailConfirmationToken
            ? { customerEmailConfirmationToken }
            : {})
        })
      });
      const payload = await response.json().catch(() => null) as { message?: string } | null;
      if (
        handleCustomerEmailConfirmationRequired(
          response,
          payload,
          (confirmationToken) =>
            retryEmail(jobId, confirmationToken)
        )
      ) {
        return;
      }
      if (!response.ok) throw new Error(payload?.message ?? 'E-pošte ni bilo mogoče znova uvrstiti.');
      toast.success(payload?.message ?? 'E-pošta je znova v čakalni vrsti.');
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Ponovni poskus ni uspel.');
    } finally {
      setBusyAction(null);
    }
  };

  const updateDraftItem = (itemId: number, patch: Partial<DraftItem>) => {
    setDraft((current) => current ? {
      ...current,
      items: current.items.map((item) => item.id === itemId ? { ...item, ...patch } : item)
    } : current);
  };

  const toggleSelectedDraftItem = (itemId: number) => {
    if (!isEditingOffer || busyAction) return;
    setSelectedDraftItemIds((previous) =>
      previous.includes(itemId)
        ? previous.filter((id) => id !== itemId)
        : [...previous, itemId]
    );
  };
  const toggleAllDraftItems = () => {
    if (!isEditingOffer || !draft || busyAction) return;
    const allSelected =
      draft.items.length > 0 &&
      draft.items.every((item) => selectedDraftItemIds.includes(item.id));
    setSelectedDraftItemIds(
      allSelected ? [] : draft.items.map((item) => item.id)
    );
  };
  const deleteSelectedDraftItems = () => {
    if (!isEditingOffer || !draft || busyAction || selectedDraftItemIds.length === 0) {
      return;
    }
    const selectedSet = new Set(selectedDraftItemIds);
    const removedCount = draft.items.filter((item) => selectedSet.has(item.id)).length;
    setDraft((current) =>
      current
        ? {
            ...current,
            items: current.items.filter((item) => !selectedSet.has(item.id))
          }
        : current
    );
    setSelectedDraftItemIds([]);
    toast.info(
      removedCount === 1
        ? 'Postavka je odstranjena. Shrani osnutek za potrditev.'
        : 'Odstranjenih postavk: ' +
            removedCount +
            '. Shrani osnutek za potrditev.'
    );
  };
  const addCatalogItemToDraft = (choice: CatalogChoice) => {
    if (!isEditingOffer || !draft || busyAction) return;
    const existingItem = draft.items.find(
      (item) => item.catalogVariantId === choice.catalogVariantId
    );
    if (!existingItem && draft.items.length >= 100) {
      toast.error('Ponudba lahko vsebuje največ 100 postavk.');
      return;
    }
    setDraft((current) => {
      if (!current) return current;
      const existing = current.items.find(
        (item) => item.catalogVariantId === choice.catalogVariantId
      );
      if (existing) {
        return {
          ...current,
          items: current.items.map((item) =>
            item.id === existing.id
              ? { ...item, quantity: Math.min(1_000_000, item.quantity + 1) }
              : item
          )
        };
      }
      const nextId = Math.min(0, ...current.items.map((item) => item.id)) - 1;
      const nextLineNumber =
        Math.max(
          0,
          ...detail.requestedItems.map((item) => item.lineNumber),
          ...current.items.map((item) => item.lineNumber)
        ) + 1;
      const discountPct = normaliseDiscount(choice.discountPercentage);
      return {
        ...current,
        items: [
          ...current.items,
          {
            id: nextId,
            catalogItemId: choice.catalogItemId,
            catalogVariantId: choice.catalogVariantId,
            lineNumber: nextLineNumber,
            productName: choice.productName,
            variantName: choice.variantName,
            sku: choice.sku,
            unit: choice.unit,
            quantity: 1,
            baseUnitNet: choice.unitPrice,
            unitNet: unitNetFromDiscount(choice.unitPrice, discountPct),
            discountPct
          }
        ]
      };
    });
  };

  const resetQuoteShippingToAutomatic = () => {
    if (automaticShippingCents === null || !draft || busyAction) return;
    const automaticShipping = automaticShippingCents / 100;
    setDraft((current) => current ? {
      ...current,
      shipping: automaticShipping,
      confirmFreeShipping: true
    } : current);
    setIsEditingOffer(true);
    setIsShippingExplanationOpen(false);
    toast.info(
      `Poštnina je ponastavljena na samodejni znesek ${formatCurrency(
        automaticShipping,
        displayedOfferCurrency
      )}. Shrani osnutek za potrditev.`
    );
  };

  const toggleOfferEdit = () => {
    if (busyAction || isPreparingOfferEdit) return;
    if (isEditingOffer) {
      setDraft(persistedOfferDraft);
      setSelectedDraftItemIds([]);
      setIsQuoteItemPickerOpen(false);
      setIsEditingOffer(false);
      return;
    }
    if (draft) {
      setSelectedDraftItemIds([]);
      setIsQuoteItemPickerOpen(false);
      setIsEditingOffer(true);
      return;
    }
    if (!canReviseOffer) return;

    enterOfferEditAfterRevisionRef.current = true;
    setIsPreparingOfferEdit(true);
    void callAction('revise').then((revised) => {
      if (revised) return;
      enterOfferEditAfterRevisionRef.current = false;
      setIsPreparingOfferEdit(false);
    });
  };

  const resetQuoteEditorsToPersisted = () => {
    setDraftRequestDetails(persistedRequestDetails);
    setDraftRequestTitle(persistedRequestTitle);
    setDraftAdminNotes(persistedAdminNotes);
    setDraft(persistedOfferDraft);
    setSelectedDraftItemIds([]);
    setIsQuoteItemPickerOpen(false);
    setIsEditingRequestDetails(false);
    setIsEditingRequestHeader(false);
    setIsEditingAdminNotes(false);
    setIsEditingOffer(false);
    setIsMasterEditing(false);
    setIsPreparingOfferEdit(false);
    enterOfferEditAfterRevisionRef.current = false;
    enterMasterEditAfterRevisionRef.current = false;
  };

  const toggleMasterEdit = () => {
    if (busyAction || isPreparingOfferEdit) return;
    if (isMasterEditing) {
      const hasUnsavedActiveChanges =
        (isEditingRequestDetails && requestProfileDirty) ||
        (isEditingRequestHeader && (requestTitleDirty || requestStatusDirty)) ||
        (isEditingAdminNotes && adminNotesDirty) ||
        (isEditingOffer && draftHasUnsavedChanges);
      if (
        hasUnsavedActiveChanges &&
        !window.confirm('Neshranjene spremembe bodo zavržene. Želite končati urejanje?')
      ) {
        return;
      }
      resetQuoteEditorsToPersisted();
      return;
    }

    if (!hasActiveQuoteEditor) {
      resetQuoteEditorsToPersisted();
    }
    setIsMasterEditing(true);
    setIsEditingRequestHeader(true);
    setIsEditingRequestDetails(canEditRequestDetails);
    setIsEditingAdminNotes(true);

    if (draft) {
      setSelectedDraftItemIds([]);
      setIsQuoteItemPickerOpen(false);
      setIsEditingOffer(true);
      return;
    }
    setIsEditingOffer(false);
    if (!canReviseOffer) return;

    enterOfferEditAfterRevisionRef.current = true;
    enterMasterEditAfterRevisionRef.current = true;
    setIsPreparingOfferEdit(true);
    void callAction('revise').then((revised) => {
      if (revised) return;
      enterOfferEditAfterRevisionRef.current = false;
      enterMasterEditAfterRevisionRef.current = false;
      setIsPreparingOfferEdit(false);
    });
  };
  return (
    <div className="w-full font-['Inter',system-ui,sans-serif]" data-testid="admin-quote-detail">
      <div className="mx-auto max-w-7xl space-y-5">
        <div className="-mb-2 text-xs text-slate-500">
          <Link href="/admin/orders?view=quotes" className="hover:underline">Naročila</Link>
          <span className="mx-1 text-slate-400">›</span>
          <span>Povpraševanje {detail.requestNumber}</span>
        </div>

        <section
          className={`${adminWindowCardClassName} px-5 py-4`}
          style={adminWindowCardStyle}
          data-testid="quote-detail-header"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <AdminDetailTitleSlot
                  editing={isEditingRequestHeader}
                  editor={(
                    <input
                      aria-label="Naslov povpraševanja"
                      name={`quote-title-${detail.id}`}
                      value={draftRequestTitle}
                      maxLength={240}
                      disabled={Boolean(busyAction)}
                      onChange={(event) => setDraftRequestTitle(event.target.value)}
                      autoComplete="off"
                      spellCheck={false}
                      className={`${adminTopBarArticleNameInputClassName} !w-auto min-w-0 flex-1 text-slate-900`}
                      data-testid="quote-request-title-input"
                    />
                  )}
                  icon={<HeaderQuoteIcon />}
                  testId="quote-title-slot"
                  title={persistedRequestTitle}
                  width="wide"
                />
                <div className={adminStatusInfoPillGroupClassName}>
                  <AdminChipDropdown
                    value={activeVisibleRequestStatus}
                    options={requestStatusSelectionOptions}
                    disabled={Boolean(busyAction)}
                    showArrow={isEditingRequestHeader}
                    interactive={isEditingRequestHeader}
                    onChange={handleRequestStatusSelection}
                    renderChip={() => (
                      <QuoteWorkflowStatusBadge status={activeRequestStatus} />
                    )}
                    optionClassName={(visibleStatus) =>
                      getQuoteRequestStatusMenuItemClassName(
                        QUOTE_REQUEST_VISIBLE_STATUS_OPTIONS.find(
                          (option) => option.value === visibleStatus
                        )?.presentationStatus ?? activeRequestStatus
                      )
                    }
                    menuClassName="w-[min(22rem,calc(100vw-2rem))]"
                    ariaLabel="Status povpraševanja"
                    testId="quote-workflow-status-control"
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
                className={adminTableEditIconButtonClassName}
                aria-label={isMasterEditing ? 'Končaj urejanje povpraševanja' : 'Uredi celotno povpraševanje'}
                aria-pressed={isMasterEditing}
                title={isMasterEditing ? 'Končaj urejanje' : 'Uredi vse podatke povpraševanja'}
                disabled={!isClientReady || Boolean(busyAction) || isPreparingOfferEdit}
                aria-busy={isPreparingOfferEdit}
                data-testid="quote-header-status-edit"
              >
                <PencilIcon />
              </IconButton>
              <IconButton
                type="button"
                onClick={() => router.push('/admin/orders?view=quotes')}
                tone="neutral"
                size="sm"
                className={adminTableNeutralIconButtonClassName}
                aria-label="Nazaj na povpraševanja in ponudbe"
                title="Nazaj"
                disabled={Boolean(busyAction)}
              >
                <ActionUndoIcon />
              </IconButton>
              <AuditHistoryDrawer
                entityType="system"
                entityId={'quote:' + detail.id}
                entityLabel={'Povpraševanje ' + detail.requestNumber}
                loadAuditEvents={false}
                workflowEventsUrl={`/api/admin/quote-requests/${detail.id}/events`}
                workflowEventLabels={QUOTE_EVENT_LABELS}
                workflowHeading="Celoten potek ponudbe"
              />
              <Button
                type="button"
                variant="primary"
                size="toolbar"
                className={topActionSaveButtonClassName}
                onClick={() => void saveQuoteChanges()}
                disabled={!hasActiveQuoteEditor || Boolean(busyAction) || isPreparingOfferEdit}
              >
                <SaveIcon className="h-[15.3px] w-[15.3px]" />
                <span>Shrani</span>
              </Button>
            </div>
          </div>

          <div className="mt-3 grid min-w-0 gap-4 lg:grid-cols-[max-content_minmax(0,1fr)] lg:items-end">
            <div className="min-w-0 lg:max-w-[420px]">
              <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
                <span>{formatDateTime(detail.createdAt)}</span>
                <span aria-hidden>·</span>
                <span>{persistedRequestDetails.organizationName.trim() || persistedRequestDetails.contactName.trim() || '—'}</span>
                {currentVersion ? (
                  <>
                    <span aria-hidden>·</span>
                    <span className="font-semibold tabular-nums text-slate-700">
                      {formatCurrency(currentVersion.total, currentVersion.currency)}
                    </span>
                  </>
                ) : null}
              </p>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
                <span>{offerContextText}</span>
                {detail.resultingOrderId ? (
                  <Link href={`/admin/orders/${detail.resultingOrderId}`} className="font-semibold text-[color:var(--blue-500)] hover:underline">
                    Naročilo {detail.resultingOrderNumber ?? `#${detail.resultingOrderId}`}
                  </Link>
                ) : null}
              </div>
            </div>
            <AdminQuoteActivityTimeline events={detail.events} />
          </div>
        </section>

        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.23fr)_minmax(340px,0.77fr)]">
        <main className="space-y-5">
          <section className={adminWindowCardClassName + ' p-4'} style={adminWindowCardStyle} data-testid="quote-request-details-card">
            <div className="flex items-center justify-between gap-4">
              <div className="flex min-w-0 items-center gap-2">
                <h2 className="text-base font-semibold text-slate-900">Podatki povpraševanja</h2>
                <AdminOrderCustomerActions
                  orderId={detail.id}
                  customerEndpoint={`/api/admin/quote-requests/${detail.id}/customer`}
                  organizationName={persistedRequestDetails.organizationName}
                  contactName={persistedRequestDetails.contactName}
                  email={persistedRequestDetails.email}
                  addressLine1={persistedRequestDetails.addressLine1}
                  addressLine2={persistedRequestDetails.addressLine2}
                  postalCode={persistedRequestDetails.postalCode}
                  city={persistedRequestDetails.city}
                  countryCode={persistedRequestDetails.countryCode}
                />
              </div>
              <button
                type="button"
                className={adminCardSectionEditIconButtonClassName + (isEditingRequestDetails ? ' bg-[color:var(--hover-neutral)]' : '')}
                onClick={toggleRequestDetailsEdit}
                aria-label={isEditingRequestDetails ? 'Končaj urejanje povpraševanja' : 'Uredi podatke povpraševanja'}
                aria-pressed={isEditingRequestDetails}
                aria-disabled={!canEditRequestDetails}
                title={
                  isEditingRequestDetails
                    ? 'Končaj urejanje'
                    : canEditRequestDetails
                      ? 'Uredi podatke'
                      : currentIssuedVersion && draftVersion
                        ? 'Podatki stranke ostanejo zaklenjeni, dokler je izdana ponudba aktivna. Pogoje nove različice uredite v oknu Ponudba.'
                        : 'Podatki stranke v aktivni izdani ponudbi so zaklenjeni.'
                }
                disabled={!isClientReady || Boolean(busyAction)}
                data-admin-card-edit-action="quote-request-details"
              >
                <PencilIcon className="h-4 w-4" />
              </button>
            </div>

            {isEditingRequestDetails && currentIssuedVersion ? (
              <p
                className="mt-3 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs leading-5 text-sky-800"
                data-testid="quote-customer-correction-revision-notice"
              >
                {draftVersion
                  ? 'Urejate podatke nove različice. Trenutno izdana ponudba ostaja nespremenjena.'
                  : 'Popravki bodo ob shranjevanju ustvarili novo različico. Trenutno izdana ponudba ostaja nespremenjena.'}
              </p>
            ) : null}

            <dl className="mt-2 grid min-w-0 gap-x-8 md:grid-cols-2">
              <QuoteDetailRow label="Tip naročnika" value={getCustomerTypeLabel(activeRequestDetails.customerType)} icon="type" isEditing={isEditingRequestDetails}>
                <QuoteDetailFieldShell isEditing>
                  <CustomSelect
                    ariaLabel="Tip naročnika"
                    value={activeRequestDetails.customerType}
                    onChange={(value) => updateDraftRequestDetails({ customerType: value })}
                    options={CUSTOMER_TYPE_FORM_OPTIONS}
                    disabled={Boolean(busyAction)}
                    showArrow
                    containerClassName={adminCompactIconFieldSelectWrapperClassName}
                    triggerClassName={adminCompactIconFieldSelectClassName}
                    valueClassName={adminCompactIconFieldSelectValueClassName + ' !pb-0'}
                  />
                </QuoteDetailFieldShell>
              </QuoteDetailRow>
              <QuoteDetailRow label="Email" value={activeRequestDetails.email} icon="email" isEditing={isEditingRequestDetails}>
                <QuoteDetailFieldShell isEditing>
                  <input aria-label="Email" type="email" value={activeRequestDetails.email} disabled={Boolean(busyAction)} onChange={(event) => updateDraftRequestDetails({ email: event.target.value })} className={quoteDetailValueControlClassName} />
                </QuoteDetailFieldShell>
              </QuoteDetailRow>
              <QuoteDetailRow label="Naziv organizacije" value={activeRequestDetails.organizationName} icon="customer" isEditing={isEditingRequestDetails}>
                <QuoteDetailFieldShell isEditing>
                  <input aria-label="Naziv organizacije" type="text" value={activeRequestDetails.organizationName} disabled={Boolean(busyAction)} onChange={(event) => updateDraftRequestDetails({ organizationName: event.target.value })} className={quoteDetailValueControlClassName} />
                </QuoteDetailFieldShell>
              </QuoteDetailRow>
              <QuoteDetailRow label="Referenca" value={activeRequestDetails.reference} icon="reference" isEditing={isEditingRequestDetails}>
                <QuoteDetailFieldShell isEditing>
                  <input aria-label="Referenca" type="text" value={activeRequestDetails.reference} disabled={Boolean(busyAction)} onChange={(event) => updateDraftRequestDetails({ reference: event.target.value })} className={quoteDetailValueControlClassName} />
                </QuoteDetailFieldShell>
              </QuoteDetailRow>
              <QuoteDetailRow label="Kontaktna oseba" value={activeRequestDetails.contactName} icon="customer" isEditing={isEditingRequestDetails}>
                <QuoteDetailFieldShell isEditing>
                  <input aria-label="Kontaktna oseba" type="text" value={activeRequestDetails.contactName} disabled={Boolean(busyAction)} onChange={(event) => updateDraftRequestDetails({ contactName: event.target.value })} className={quoteDetailValueControlClassName} />
                </QuoteDetailFieldShell>
              </QuoteDetailRow>
              <QuoteDetailRow label="Kaj potrebuje?" value={getQuoteReasonLabel(activeRequestDetails.quoteReason)} icon="reference" isEditing={isEditingRequestDetails}>
                <QuoteDetailFieldShell isEditing>
                  <CustomSelect
                    ariaLabel="Kaj potrebuje?"
                    value={activeRequestDetails.quoteReason}
                    onChange={(value) => updateDraftRequestDetails({ quoteReason: value })}
                    options={QUOTE_REASON_OPTIONS}
                    disabled={Boolean(busyAction)}
                    showArrow
                    containerClassName={adminCompactIconFieldSelectWrapperClassName}
                    triggerClassName={adminCompactIconFieldSelectClassName}
                    valueClassName={adminCompactIconFieldSelectValueClassName + ' !pb-0'}
                  />
                </QuoteDetailFieldShell>
              </QuoteDetailRow>
              <QuoteDetailRow
                label="Naslov"
                value={formatQuoteRequestAddress(activeRequestDetails)}
                icon="address"
                isEditing={isEditingRequestDetails}
                fullWidth
              >
                <QuoteAddressEditor
                  details={activeRequestDetails}
                  disabled={Boolean(busyAction)}
                  onChange={updateDraftRequestDetails}
                />
              </QuoteDetailRow>
              <QuoteDetailRow
                label="Sporočilo stranke"
                value={activeRequestDetails.customerMessage}
                icon="message"
                isEditing={isEditingRequestDetails}
                fullWidth
              >
                <QuoteDetailFieldShell isEditing>
                  <textarea aria-label="Sporočilo stranke" rows={1} wrap="off" value={activeRequestDetails.customerMessage} readOnly={Boolean(busyAction)} onChange={(event) => updateDraftRequestDetails({ customerMessage: event.target.value })} className={quoteDetailInlineTextareaClassName} />
                </QuoteDetailFieldShell>
              </QuoteDetailRow>
            </dl>
          </section>

          <section className={`${adminWindowCardClassName} overflow-hidden`} style={adminWindowCardStyle} data-testid="quote-offer-card">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 px-4 py-3">
              <div className="min-w-0">
                <h2 className="text-base font-semibold text-slate-900">Ponudba</h2>
                <p className="mt-0.5 text-[11px] text-slate-500">Uredite pogoje ponudbe; predogled vedno uporabi zadnji shranjeni osnutek.</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {currentVersion ? <span className="text-[12px] font-semibold text-slate-700">{currentVersion.offerNumber ?? `Različica ${currentVersion.versionNumber}`}</span> : null}
                <button
                  type="button"
                  className={adminCardSectionEditIconButtonClassName + (isEditingOffer || isPreparingOfferEdit ? ' bg-[color:var(--hover-neutral)]' : '')}
                  onClick={toggleOfferEdit}
                  aria-label={isEditingOffer ? 'Končaj urejanje ponudbe' : 'Uredi ponudbo'}
                  aria-pressed={isEditingOffer}
                  title={
                    isPreparingOfferEdit
                      ? 'Pripravljam novo različico'
                      : isEditingOffer
                        ? 'Končaj urejanje'
                        : draft
                          ? 'Uredi ponudbo'
                          : canReviseOffer
                            ? 'Uredi ponudbo v novi različici'
                            : 'Ponudbe ni mogoče urejati'
                  }
                  disabled={!isClientReady || Boolean(busyAction) || isPreparingOfferEdit || (!draft && !canReviseOffer)}
                  data-admin-card-edit-action="quote-offer"
                >
                  <PencilIcon className="h-4 w-4" />
                </button>
              </div>
            </div>
            {canRequestClarification || editableVersion || canWithdrawIssuedOffer || canCloseWithoutIssuing ? (
              <div className="flex flex-wrap items-center justify-end gap-2 border-b border-slate-200 bg-slate-50/70 px-4 py-2">
                {canRequestClarification ? <Button type="button" variant="default" size="toolbar" ref={clarificationTriggerRef} onClick={openClarificationDialog} disabled={Boolean(busyAction)} className={compactSecondaryButtonClassName}>Prosi za pojasnilo</Button> : null}
                {editableVersion ? (
                  <>
                    <Button
                      ref={previewTriggerRef}
                      type="button"
                      variant="default"
                      size="toolbar"
                      onClick={() => void createPreview()}
                      disabled={Boolean(busyAction)}
                      title={draftHasUnsavedChanges
                        ? 'Najprej shranite spremembe osnutka.'
                        : 'Odpri PDF zadnjega shranjenega osnutka.'}
                      className={compactSecondaryButtonClassName}
                    >
                      {busyAction === 'preview' ? 'Pripravljam …' : 'Predogled'}
                    </Button>
                    <Button
                      ref={issueTriggerRef}
                      type="button"
                      variant="primary"
                      size="toolbar"
                      onClick={openIssueDialog}
                      disabled={Boolean(busyAction)}
                      className={compactPrimaryButtonClassName}
                      data-testid="quote-action-issue-offer"
                    >
                      Izdaj ponudbo
                    </Button>
                  </>
                ) : null}
                {canWithdrawIssuedOffer ? <Button data-testid="quote-action-withdraw-offer" type="button" variant="default" size="toolbar" onClick={() => requestLifecycleAction('withdraw')} disabled={Boolean(busyAction)} title="Razveljavi trenutno izdano ponudbo in onemogoči povezavo stranke." className={compactDangerButtonClassName}>Umakni izdano ponudbo</Button> : null}
                {canCloseWithoutIssuing ? <Button data-testid="quote-action-close-without-offer" type="button" variant="default" size="toolbar" onClick={() => requestLifecycleAction('close')} disabled={Boolean(busyAction)} title="Zapri povpraševanje, ker ponudba ne bo izdana. Na voljo le pred prvo izdajo." className={compactSecondaryButtonClassName}>Zaključi brez izdaje ponudbe</Button> : null}
              </div>
            ) : null}
            {displayedOfferDetails ? (
              <>
                <div
                  className="grid items-start gap-5 p-4 lg:grid-cols-[minmax(0,1fr)_280px]"
                  data-testid="quote-offer-details"
                >
                  <dl className="h-[210px] min-w-0">
                    <QuoteOfferFieldRow
                      field="validUntil"
                      label="Velja do"
                      value={displayedOfferValidUntil}
                      isEditing={isEditingOffer && Boolean(draft)}
                    >
                      <input
                        aria-label="Velja do"
                        type="date"
                        value={displayedOfferDetails.validUntil}
                        disabled={!draft || Boolean(busyAction)}
                        onChange={(event) => setDraft((current) => current ? { ...current, validUntil: event.target.value } : current)}
                        className={`${compactInputClassName} !h-7`}
                      />
                    </QuoteOfferFieldRow>
                    <QuoteOfferFieldRow
                      field="shipping"
                      label="Poštnina"
                      value={formatCurrency(displayedOfferDetails.shipping, displayedOfferCurrency)}
                      isEditing={isEditingOffer && Boolean(draft)}
                      labelAction={(
                        <button
                          type="button"
                          className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded text-[color:var(--blue-500)] hover:bg-[color:var(--hover-neutral)]"
                          aria-label="Prikaži izračun poštnine"
                          title="Zakaj je poštnina takšna?"
                          data-testid="quote-shipping-info-button"
                          onClick={() => setIsShippingExplanationOpen(true)}
                        >
                          <Info className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                      )}
                      valueAction={canResetQuoteShipping ? (
                        <IconButton
                          type="button"
                          size="sm"
                          tone="neutral"
                          className="!h-6 !w-6 shrink-0"
                          aria-label="Uporabi samodejno poštnino"
                          title="Uporabi samodejno poštnino"
                          data-testid="quote-shipping-reset-button"
                          disabled={Boolean(busyAction)}
                          onClick={resetQuoteShippingToAutomatic}
                        >
                          <Calculator className="h-3.5 w-3.5" aria-hidden="true" />
                        </IconButton>
                      ) : null}
                    >
                      <AdminUnitInput
                        unit="€"
                        type="number"
                        min="0"
                        step="0.01"
                        aria-label="Poštnina"
                        value={displayedOfferDetails.shipping}
                        disabled={!draft || Boolean(busyAction)}
                        className="!h-7"
                        inputClassName="text-right tabular-nums"
                        onChange={(event) => {
                          const shipping = Number(event.target.value);
                          setDraft((current) => current ? {
                            ...current,
                            shipping,
                            confirmFreeShipping: shipping > 0
                          } : current);
                        }}
                      />
                    </QuoteOfferFieldRow>
                    <QuoteOfferFieldRow
                      field="customerMessage"
                      label="Sporočilo stranki"
                      value={displayedOfferDetails.customerVisibleNotes}
                      isEditing={isEditingOffer && Boolean(draft)}
                    >
                      <textarea
                        aria-label="Sporočilo stranki"
                        rows={1}
                        value={displayedOfferDetails.customerVisibleNotes}
                        disabled={!draft || Boolean(busyAction)}
                        onChange={(event) => setDraft((current) => current ? { ...current, customerVisibleNotes: event.target.value } : current)}
                        placeholder="Neobvezno sporočilo ob ponudbi."
                        className={compactOfferTextareaClassName}
                      />
                    </QuoteOfferFieldRow>
                    <QuoteOfferFieldRow
                      field="deliveryTerms"
                      label="Dobavni pogoji"
                      value={displayedOfferDetails.deliveryTerms}
                      isEditing={isEditingOffer && Boolean(draft)}
                    >
                      <textarea
                        aria-label="Dobavni pogoji"
                        rows={1}
                        value={displayedOfferDetails.deliveryTerms}
                        disabled={!draft || Boolean(busyAction)}
                        onChange={(event) => setDraft((current) => current ? { ...current, deliveryTerms: event.target.value } : current)}
                        placeholder="Dobavni pogoji"
                        className={compactOfferTextareaClassName}
                      />
                    </QuoteOfferFieldRow>
                    <QuoteOfferFieldRow
                      field="paymentTerms"
                      label="Plačilni pogoji"
                      value={displayedOfferDetails.paymentTerms}
                      isEditing={isEditingOffer && Boolean(draft)}
                    >
                      <textarea
                        aria-label="Plačilni pogoji"
                        rows={1}
                        value={displayedOfferDetails.paymentTerms}
                        disabled={!draft || Boolean(busyAction)}
                        onChange={(event) => setDraft((current) => current ? { ...current, paymentTerms: event.target.value } : current)}
                        placeholder="Plačilni pogoji"
                        className={compactOfferTextareaClassName}
                      />
                    </QuoteOfferFieldRow>
                    <QuoteOfferFieldRow
                      field="acceptanceTerms"
                      label="Pogoji sprejema"
                      value={displayedOfferDetails.termsText}
                      isEditing={isEditingOffer && Boolean(draft)}
                    >
                      <textarea
                        aria-label="Pogoji sprejema ponudbe"
                        rows={1}
                        value={displayedOfferDetails.termsText}
                        disabled={!draft || Boolean(busyAction)}
                        onChange={(event) => setDraft((current) => current ? { ...current, termsText: event.target.value } : current)}
                        placeholder="Neobvezni pogoji sprejema ponudbe."
                        className={compactOfferTextareaClassName}
                      />
                    </QuoteOfferFieldRow>
                  </dl>

                  <div className="flex min-h-[210px] min-w-0 flex-col" data-testid="quote-offer-summary">
                    <dl className="w-full text-[12px] text-slate-600">
                      <div className="flex min-h-7 items-center justify-between gap-4"><dt>Vmesni seštevek brez DDV</dt><dd className="font-medium tabular-nums text-slate-800">{currentVersion ? formatCurrency(currentVersion.subtotal, currentVersion.currency) : '—'}</dd></div>
                      <div className="flex min-h-7 items-center justify-between gap-4"><dt>Poštnina</dt><dd className="font-medium tabular-nums text-slate-800">{currentVersion ? formatCurrency(currentVersion.shipping, currentVersion.currency) : '—'}</dd></div>
                      <div className="flex min-h-7 items-center justify-between gap-4"><dt>DDV</dt><dd className="font-medium tabular-nums text-slate-800">{currentVersion ? formatCurrency(currentVersion.tax, currentVersion.currency) : '—'}</dd></div>
                      <div className="flex min-h-8 items-center justify-between gap-4 border-t border-slate-300 font-semibold text-slate-950"><dt>Skupaj z DDV</dt><dd className="tabular-nums">{currentVersion ? formatCurrency(currentVersion.total, currentVersion.currency) : '—'}</dd></div>
                    </dl>
                    <div className="mt-2 grid gap-1 text-[10px] leading-4 text-slate-500">
                      <p className="truncate" title={formatDateTime(currentVersion?.issuedAt ?? null)}><span className="font-semibold text-slate-600">Izdano:</span> {formatDateTime(currentVersion?.issuedAt ?? null)}</p>
                      <p className="truncate"><span className="font-semibold text-slate-600">Stanje:</span> {currentVersion ? STATUS_LABELS[currentVersion.status] ?? currentVersion.status : 'Ni shranjeno'}</p>
                    </div>
                    <details className="mt-auto min-h-6 text-[10px] text-slate-500">
                      <summary className="flex h-6 cursor-pointer items-center font-semibold">Tehnični podatki</summary>
                      <p className="break-all">Vsebinski hash: {currentVersion?.contentHash ?? '—'} · pogoji: {currentVersion?.termsHash ?? '—'}</p>
                    </details>
                  </div>
                </div>

                <div
                  className="grid min-h-[52px] grid-cols-[minmax(0,1fr)_124px] items-center gap-4 border-t border-slate-200 bg-slate-50/70 px-4 py-2"
                  data-testid="quote-offer-action-bar"
                >
                  <div className="min-w-0">
                    {isEditingOffer && draft?.shipping === 0 ? (
                      <label className="flex min-w-0 items-center gap-2 truncate text-[10px] font-medium text-amber-800">
                        <input
                          type="checkbox"
                          checked={draft.confirmFreeShipping}
                          disabled={Boolean(busyAction)}
                          onChange={(event) => setDraft((current) => current ? { ...current, confirmFreeShipping: event.target.checked } : current)}
                        />
                        <span className="truncate">Izrecno potrjujem brezplačno dostavo.</span>
                      </label>
                    ) : (
                      <p className="truncate text-[11px] text-slate-600">DDV in vsote ponovno izračuna strežnik.</p>
                    )}
                  </div>
                  <div className="flex h-8 w-[124px] items-center justify-end">
                    {isEditingOffer && draft ? (
                      <Button
                        type="button"
                        variant="primary"
                        size="toolbar"
                        onClick={() => void saveDraft()}
                        disabled={Boolean(busyAction)}
                        className={`${compactPrimaryButtonClassName} !w-[124px]`}
                      >
                        Shrani osnutek
                      </Button>
                    ) : (
                      <span className="inline-flex h-8 w-[124px] items-center justify-end text-[11px] font-semibold text-slate-500">
                        {currentVersion ? 'Shranjeno' : 'Ni shranjeno'}
                      </span>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <div className="flex min-h-[262px] items-center justify-center p-5 text-sm text-slate-500" data-testid="quote-offer-details">
                Za zaključeno povpraševanje osnutek ponudbe ni na voljo.
              </div>
            )}
            <section className="border-t border-slate-200 pb-4" data-testid="quote-items-card">
              <div className="flex min-h-11 items-center gap-3 px-4 py-2">
                <h3 className="shrink-0 text-[13px] font-semibold text-slate-900">
                  Postavke ponudbe
                </h3>
                <span
                  className="inline-flex min-w-0 shrink items-center gap-1 rounded-md bg-amber-50 px-1.5 py-1 text-[9px] font-medium text-amber-700"
                  data-testid="quote-items-stock-notice"
                  title="Povpraševanje ni naročilo. Zaloga za te postavke ni rezervirana."
                  aria-label="Povpraševanje ni naročilo. Zaloga za te postavke ni rezervirana."
                >
                  <Info aria-hidden="true" className="h-3 w-3 shrink-0" />
                  <span className="truncate">Zaloga ni rezervirana.</span>
                </span>
                <span
                  className={
                    'min-w-0 flex-1 truncate whitespace-nowrap text-right text-[10px] font-medium text-slate-500' +
                    (draft && isEditingOffer ? '' : ' invisible')
                  }
                  aria-hidden={!(draft && isEditingOffer)}
                >
                  Ponujene postavke lahko uredite neposredno v drugi vrstici.
                </span>
                <div className="ml-auto flex shrink-0 items-center gap-1.5">
                  <IconButton
                    type="button"
                    aria-label="Dodaj postavko ponudbe"
                    aria-haspopup="dialog"
                    aria-expanded={isQuoteItemPickerOpen}
                    onClick={(event) => {
                      quoteItemPickerTriggerRef.current = event.currentTarget;
                      setIsQuoteItemPickerOpen(true);
                    }}
                    title={
                      catalogLoadState === 'loading' || catalogLoadState === 'idle'
                        ? 'Nalagam katalog'
                        : catalogLoadState === 'error'
                          ? 'Kataloga ni mogoče naložiti'
                          : 'Dodaj'
                    }
                    tone="neutral"
                    className={adminTableNeutralIconButtonClassName}
                    disabled={
                      !isEditingOffer ||
                      !draft ||
                      Boolean(busyAction) ||
                      catalogLoadState !== 'ready' ||
                      catalogChoices.length === 0
                    }
                  >
                    <PlusIcon />
                  </IconButton>
                  <IconButton
                    type="button"
                    aria-label="Odstrani izbrane postavke ponudbe"
                    onClick={deleteSelectedDraftItems}
                    title="Izbriši izbrane"
                    tone={
                      isEditingOffer && selectedDraftItemIds.length > 0
                        ? 'danger'
                        : 'neutral'
                    }
                    className={
                      isEditingOffer && selectedDraftItemIds.length > 0
                        ? adminTableSelectedDangerIconButtonClassName
                        : adminTableNeutralIconButtonClassName + ' !transition-none'
                    }
                    disabled={
                      !isEditingOffer ||
                      Boolean(busyAction) ||
                      selectedDraftItemIds.length === 0
                    }
                  >
                    <TrashCanIcon />
                  </IconButton>
                </div>
              </div>
              <QuoteItemsComparisonTable
                requestedItems={detail.requestedItems}
                draftItems={isEditingOffer ? draft?.items ?? null : null}
                offeredItems={isEditingOffer ? null : currentVersion?.items ?? null}
                catalogChoices={catalogChoices}
                catalogLoadState={catalogLoadState}
                selectedDraftItemIds={selectedDraftItemIds}
                disabled={Boolean(busyAction)}
                onUpdateDraftItem={updateDraftItem}
                onToggleDraftItem={toggleSelectedDraftItem}
                onToggleAllDraftItems={toggleAllDraftItems}
              />

            </section>
          </section>
          <QuoteCatalogItemPickerDialog
            open={isQuoteItemPickerOpen}
            choices={catalogChoices}
            onAdd={addCatalogItemToDraft}
            onClose={closeQuoteItemPicker}
            triggerRef={quoteItemPickerTriggerRef}
          />

        </main>

        <aside className="flex w-full min-w-0 flex-col gap-5">
          <AdminNotesCard
            headingId="quote-admin-notes-title"
            testId="quote-admin-notes-card"
            editActionId="quote-admin-notes"
            isEditing={isEditingAdminNotes}
            value={activeAdminNotes}
            persistedValue={persistedAdminNotes}
            onChange={setDraftAdminNotes}
            onToggle={toggleAdminNotesEdit}
            disabled={Boolean(busyAction)}
            autoFocus={isEditingAdminNotes && !isMasterEditing}
          />          <AdminQuoteDocumentsManager
            quoteRequestId={detail.id}
            documents={detail.documents}
            offerVersions={detail.offerVersions}
          />
          <section
            className="rounded-xl border border-slate-200 bg-white p-5 shadow-[0_14px_34px_rgba(15,23,42,0.06),0_2px_6px_rgba(15,23,42,0.04)]"
            data-testid="quote-customer-access-card"
          >
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-base font-semibold text-slate-900">Stranka in dostop</h2>
            </div>

            <dl className="mt-4 divide-y divide-slate-200 text-xs">
              <div className="flex items-center justify-between gap-4 py-2 first:pt-0">
                <dt className="text-slate-600">Dostop stranke</dt>
                <dd className={detail.access.activeCount > 0 ? 'font-semibold text-emerald-700' : 'font-semibold text-slate-500'}>
                  {detail.access.activeCount > 0 ? 'Omogočen' : 'Ni omogočen'}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-4 py-2">
                <dt className="text-slate-600">Aktivne povezave</dt>
                <dd className="font-semibold tabular-nums text-slate-800">{detail.access.activeCount}</dd>
              </div>
              <div className="flex items-center justify-between gap-4 py-2">
                <dt className="text-slate-600">Velja do</dt>
                <dd className="text-right font-medium text-slate-700">{formatDateTime(detail.access.latestExpiresAt)}</dd>
              </div>
              <div className="flex items-center justify-between gap-4 py-2">
                <dt className="text-slate-600">Zadnja uporaba</dt>
                <dd className="text-right font-medium text-slate-700">{formatDateTime(detail.access.latestUsedAt)}</dd>
              </div>
            </dl>

            <section
              className="mt-4 border-t border-slate-200 pt-4"
              aria-labelledby="quote-email-evidence-title"
              data-testid="quote-email-evidence"
            >
              <h3 id="quote-email-evidence-title" className="text-sm font-semibold text-slate-900">
                E-pošta
              </h3>
              {detail.emailJobs.length > 0 ? (
                <div className="mt-2 divide-y divide-slate-200 text-xs">
                  {detail.emailJobs.map((job) => {
                    const eventLabel = EMAIL_JOB_EVENT_LABELS[job.eventType] ?? job.eventType;
                    const audienceLabel = EMAIL_JOB_AUDIENCE_LABELS[job.audience] ?? job.audience;

                    return (
                      <article
                        key={job.id}
                        className="py-2 first:pt-0"
                        data-testid={`quote-email-job-${job.id}`}
                      >
                        <div className="flex min-h-8 items-start justify-between gap-4">
                          <div className="min-w-0 flex-1">
                            <p
                              className="truncate text-[12px] font-semibold leading-4 text-slate-800"
                              title={`${job.eventType} · ${job.audience}`}
                            >
                              {eventLabel} · {audienceLabel}
                            </p>
                            <p
                              className="mt-0.5 truncate text-[10px] leading-4 text-slate-500"
                              title={job.recipientEmail}
                            >
                              {job.recipientEmail} · poskusi {job.attempts}
                            </p>
                          </div>
                          <div className="flex shrink-0 items-center gap-2">
                            <StateBadge status={job.status} />
                            {job.status === 'failed' && job.retryEligible ? (
                              <Button
                                type="button"
                                variant="default"
                                size="toolbar"
                                onClick={() => void retryEmail(job.id)}
                                disabled={Boolean(busyAction)}
                                className={compactDangerButtonClassName}
                                aria-label={`Ponovi pošiljanje: ${eventLabel} · ${job.recipientEmail}`}
                              >
                                Ponovi pošiljanje
                              </Button>
                            ) : null}
                          </div>
                        </div>
                        {job.lastError ? (
                          <p
                            className="mt-1 line-clamp-2 break-words text-[10px] leading-4 text-rose-700"
                            title={job.lastError}
                            data-testid="quote-email-last-error"
                          >
                            {job.lastError}
                          </p>
                        ) : null}
                        {job.status === 'failed' && !job.retryEligible ? (
                          <p
                            className="mt-1 text-[10px] leading-4 text-slate-500"
                            data-testid={`quote-email-retry-ineligible-${job.id}`}
                          >
                            {job.retryIneligibleReason ?? 'Tega sporočila ni mogoče ponovno poslati.'}
                          </p>
                        ) : null}
                      </article>
                    );
                  })}
                </div>
              ) : (
                <p className="mt-2 text-xs text-slate-500">E-poštnih opravil še ni.</p>
              )}
            </section>
          </section>
        </aside>
      </div>
      <QuoteShippingExplanationDialog
        open={isShippingExplanationOpen}
        onOpenChange={setIsShippingExplanationOpen}
        snapshot={shippingBreakdown}
        finalShipping={displayedOfferDetails?.shipping ?? currentVersion?.shipping ?? 0}
        currency={displayedOfferCurrency}
      />
      <AdminQuoteIssueDialog
        open={isIssueDialogOpen}
        offerReference={editableVersion?.offerNumber ?? `Ponudba V${editableVersion?.versionNumber ?? '—'}`}
        recipientEmail={persistedRequestDetails.email}
        total={formatCurrency(currentVersion?.total ?? 0, currentVersion?.currency ?? 'EUR')}
        busy={busyAction === 'issue'}
        error={issueDialogError}
        cancelButtonRef={issueCancelButtonRef}
        confirmButtonRef={issueConfirmButtonRef}
        onCancel={closeIssueDialog}
        onConfirm={() => void confirmIssue()}
      />
      <AdminQuoteClarificationDialog
        open={isClarificationDialogOpen}
        step={clarificationDialogStep}
        draft={clarificationDraft}
        recipientEmail={persistedRequestDetails.email}
        busy={busyAction === 'clarification'}
        error={clarificationError}
        textareaRef={clarificationTextareaRef}
        sendButtonRef={clarificationSendButtonRef}
        onDraftChange={(value) => {
          setClarificationDraft(value);
          if (clarificationError) setClarificationError(null);
        }}
        onCancel={() => {
          if (!busyAction) resetClarificationDialog();
        }}
        onBack={() => {
          if (busyAction) return;
          setClarificationError(null);
          setClarificationDialogStep('compose');
        }}
        onAdvance={advanceClarificationDialog}
        onRecordOnly={() => void requestClarification(false)}
        onRecordAndSend={() => void requestClarification(true)}
      />
      <CustomerEmailConfirmationDialog
        confirmation={customerEmailConfirmation}
        confirmDisabled={Boolean(busyAction)}
        onCancel={cancelCustomerEmailConfirmation}
        onConfirm={confirmCustomerEmail}
      />
      <PdfPreviewDialog
        url={previewUrl}
        title="Predogled ponudbe"
        description="PDF prikazuje zadnji shranjeni osnutek. Ponudba še ni izdana ali poslana stranki."
        frameTitle={`Predogled ponudbe ${detail.requestNumber}`}
        onClose={closePreview}
        returnFocusRef={previewTriggerRef}
      />
      </div>
    </div>
  );
}
