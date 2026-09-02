'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Calculator } from 'lucide-react';
import type {
  ShippingCalculation,
  ShippingManualOverride
} from '@/shared/domain/shipping/shipping';
import { SHIPPING_MAX_PARCEL_COUNT } from '@/shared/domain/shipping/shipping';
import { formatEuro } from '@/shared/domain/formatting';
import { ConfirmDialog } from '@/shared/ui/confirm-dialog';
import { IconButton } from '@/shared/ui/icon-button';
import { PencilIcon } from '@/shared/ui/icons/AdminActionIcons';
import { useToast } from '@/shared/ui/toast';
import {
  adminCardSectionEditIconButtonClassName,
  adminWindowCardClassName,
  adminWindowCardStyle
} from '@/shared/ui/admin-table';
import { adminInputFocusTokenClasses } from '@/shared/ui/theme/tokens';

type AdminOrderShippingOverrideProps = {
  orderId: number;
  shipping: number;
  automaticShipping: number | null;
  shippingCalculation: ShippingCalculation | null;
  shippingOverride: ShippingManualOverride | null;
  shippingOverrideStale: boolean;
  parcelCount: number;
  pricingRevision: number;
  orderStatus: string;
  paymentStatus: string;
  deleted: boolean;
  hasActiveDocuments: boolean;
  quoteDerived: boolean;
  externalEditMode: boolean;
  onRequestEdit: () => void;
  onDirtyChange?: (isDirty: boolean) => void;
  onSavingChange?: (isSaving: boolean) => void;
  onPricingRevisionChange?: (pricingRevision: number) => void;
  onRegisterSave?: (
    handler: (expectedPricingRevision?: number) => Promise<boolean>
  ) => void | (() => void);
  pageBusy: boolean;
};

type ShippingMutationResponse = {
  action: 'override' | 'reset' | 'set_parcel_count';
  shippingCents: number;
  automaticAmountCents: number | null;
  totalCents: number;
  shippingOverride: ShippingManualOverride | null;
  shippingOverrideStale: boolean;
  shippingCalculation?: ShippingCalculation;
  parcelCount?: number;
  pricingRevision?: number;
};

type ShippingMutationPayload =
  | { action: 'override'; amountCents: number; reason: string }
  | { action: 'reset' }
  | {
      action: 'set_parcel_count';
      parcelCount: number;
      expectedPricingRevision: number;
      confirmLockedRecalculation: boolean;
      reason?: string;
    };

type ShippingDraftMode = 'automatic' | 'override';

class ShippingMutationError extends Error {
  code: string | null;

  constructor(message: string, code: string | null = null) {
    super(message);
    this.name = 'ShippingMutationError';
    this.code = code;
  }
}

const LOCKED_ORDER_STATUSES = new Set([
  'partially_sent',
  'sent',
  'finished',
  'cancelled'
]);
const LOCKED_PAYMENT_STATUSES = new Set(['paid', 'refunded']);

const fieldClassName =
  `h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500 ${adminInputFocusTokenClasses}`;
const textareaClassName =
  `min-h-[68px] w-full resize-y rounded-md border border-slate-300 bg-white px-3 py-2 text-sm leading-5 text-slate-900 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500 ${adminInputFocusTokenClasses}`;
function eurosToCents(value: number): number {
  return Number.isFinite(value) ? Math.round(value * 100) : 0;
}

function formatCents(value: number) {
  return formatEuro(value / 100);
}

function formatCentsInput(value: number) {
  const safeValue = Math.max(0, Math.trunc(value));
  return `${Math.trunc(safeValue / 100)},${String(safeValue % 100).padStart(2, '0')}`;
}

function parseEuroInputToCents(value: string): number | null {
  const normalized = value.trim().replace(/\s+/g, '').replace(',', '.');
  const match = /^(\d+)(?:\.(\d{0,2}))?$/.exec(normalized);
  if (!match) return null;

  const cents =
    BigInt(match[1]) * 100n +
    BigInt((match[2] ?? '').padEnd(2, '0'));
  if (cents > BigInt(Number.MAX_SAFE_INTEGER)) return null;
  return Number(cents);
}

function getLockMessage(input: {
  deleted: boolean;
  paymentStatus: string;
  orderStatus: string;
}) {
  if (input.deleted) {
    return 'Po\u0161tnine ni mogo\u010de spreminjati pri izbrisanem naro\u010dilu.';
  }
  if (LOCKED_PAYMENT_STATUSES.has(input.paymentStatus)) {
    return 'Po\u0161tnine ni mogo\u010de spreminjati po pla\u010dilu ali vra\u010dilu pla\u010dila.';
  }
  if (LOCKED_ORDER_STATUSES.has(input.orderStatus)) {
    return 'Po\u0161tnine ni mogo\u010de spreminjati v trenutnem stanju dostave naro\u010dila.';
  }
  return null;
}

function isShippingMutationResponse(value: unknown): value is ShippingMutationResponse {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return (
    (
      record.action === 'override' ||
      record.action === 'reset' ||
      record.action === 'set_parcel_count'
    ) &&
    Number.isSafeInteger(record.shippingCents) &&
    (record.automaticAmountCents === null ||
      Number.isSafeInteger(record.automaticAmountCents)) &&
    Number.isSafeInteger(record.totalCents) &&
    typeof record.shippingOverrideStale === 'boolean' &&
    (
      record.parcelCount === undefined ||
      (Number.isSafeInteger(record.parcelCount) && Number(record.parcelCount) >= 1)
    ) &&
    (
      record.pricingRevision === undefined ||
      (Number.isSafeInteger(record.pricingRevision) && Number(record.pricingRevision) >= 1)
    )
  );
}

export default function AdminOrderShippingOverride({
  orderId,
  shipping,
  automaticShipping,
  shippingCalculation,
  shippingOverride,
  parcelCount,
  pricingRevision,
  orderStatus,
  paymentStatus,
  deleted,
  hasActiveDocuments,
  quoteDerived,
  externalEditMode,
  onRequestEdit,
  onDirtyChange,
  onSavingChange,
  onPricingRevisionChange,
  onRegisterSave,
  pageBusy
}: AdminOrderShippingOverrideProps) {
  const { toast } = useToast();
  const [finalAmountCents, setFinalAmountCents] = useState(() =>
    eurosToCents(shipping)
  );
  const [automaticAmountCents, setAutomaticAmountCents] = useState<number | null>(
    () => automaticShipping === null ? null : eurosToCents(automaticShipping)
  );
  const [currentOverride, setCurrentOverride] =
    useState<ShippingManualOverride | null>(shippingOverride);
  const [currentCalculation, setCurrentCalculation] =
    useState<ShippingCalculation | null>(shippingCalculation);
  const [currentParcelCount, setCurrentParcelCount] = useState(parcelCount);
  const [parcelCountInput, setParcelCountInput] = useState(String(parcelCount));
  const [currentPricingRevision, setCurrentPricingRevision] = useState(pricingRevision);
  const [amountInput, setAmountInput] = useState(() =>
    shippingOverride
      ? formatCentsInput(shippingOverride.overrideAmountCents)
      : automaticShipping === null
        ? ''
        : formatCentsInput(eurosToCents(automaticShipping))
  );
  const [reason, setReason] = useState(shippingOverride?.reason ?? '');
  const [draftMode, setDraftMode] = useState<ShippingDraftMode>(
    shippingOverride ? 'override' : 'automatic'
  );
  const [isSaving, setIsSaving] = useState(false);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [parcelCountDialogOpen, setParcelCountDialogOpen] = useState(false);
  const [parcelCountReason, setParcelCountReason] = useState('');
  const saveDraftRef = useRef<(expectedPricingRevision?: number) => Promise<boolean>>(
    async () => true
  );
  const saveInFlightRef = useRef(false);
  const parcelConfirmationResolverRef = useRef<((reason: string | null) => void) | null>(null);

  useEffect(() => {
    const nextFinalAmountCents = eurosToCents(shipping);
    setFinalAmountCents(nextFinalAmountCents);
    setAutomaticAmountCents(
      automaticShipping === null ? null : eurosToCents(automaticShipping)
    );
    setCurrentOverride(shippingOverride);
    setCurrentCalculation(shippingCalculation);
    setCurrentParcelCount(parcelCount);
    setParcelCountInput(String(parcelCount));
    setCurrentPricingRevision(pricingRevision);
    setAmountInput(
      shippingOverride
        ? formatCentsInput(shippingOverride.overrideAmountCents)
        : automaticShipping === null
          ? ''
          : formatCentsInput(eurosToCents(automaticShipping))
    );
    setReason(shippingOverride?.reason ?? '');
    setDraftMode(shippingOverride ? 'override' : 'automatic');
  }, [
    automaticShipping,
    shipping,
    shippingCalculation,
    shippingOverride,
    parcelCount,
    pricingRevision
  ]);

  useEffect(() => {
    if (externalEditMode) return;

    setParcelCountInput(String(currentParcelCount));
    setAmountInput(
      currentOverride
        ? formatCentsInput(currentOverride.overrideAmountCents)
        : automaticAmountCents === null
          ? ''
          : formatCentsInput(automaticAmountCents)
    );
    setReason(currentOverride?.reason ?? '');
    setDraftMode(currentOverride ? 'override' : 'automatic');
    setResetDialogOpen(false);
    if (parcelConfirmationResolverRef.current) {
      parcelConfirmationResolverRef.current(null);
      parcelConfirmationResolverRef.current = null;
    }
    setParcelCountDialogOpen(false);
    setParcelCountReason('');
  }, [
    automaticAmountCents,
    currentOverride,
    currentParcelCount,
    externalEditMode
  ]);

  useEffect(() => () => {
    parcelConfirmationResolverRef.current?.(null);
    parcelConfirmationResolverRef.current = null;
  }, []);

  const lockMessage = getLockMessage({
    deleted,
    paymentStatus,
    orderStatus
  });
  const controlsDisabled =
    !externalEditMode || Boolean(lockMessage) || pageBusy || isSaving;
  const parcelCountHardLocked =
    deleted || orderStatus === 'cancelled' || quoteDerived;
  const parcelCountNeedsConfirmation =
    LOCKED_PAYMENT_STATUSES.has(paymentStatus) ||
    LOCKED_ORDER_STATUSES.has(orderStatus) ||
    hasActiveDocuments;
  const parcelCountControlsDisabled =
    parcelCountHardLocked ||
    !externalEditMode ||
    pageBusy ||
    isSaving;
  const nextParcelCount = /^\d+$/u.test(parcelCountInput.trim())
    ? Number(parcelCountInput.trim())
    : Number.NaN;
  const parcelCountIsValid =
    Number.isSafeInteger(nextParcelCount)
    && nextParcelCount >= 1
    && nextParcelCount <= SHIPPING_MAX_PARCEL_COUNT;
  const parcelCountChanged =
    parcelCountIsValid && nextParcelCount !== currentParcelCount;
  const parcelDraftDirty = parcelCountInput.trim() !== String(currentParcelCount);
  const amountCents = parseEuroInputToCents(amountInput);
  const reasonIsValid = Boolean(reason.trim());
  const overrideDraftDirty =
    draftMode === 'override' && (
      currentOverride === null ||
      amountCents !== currentOverride.overrideAmountCents ||
      reason.trim() !== currentOverride.reason.trim()
    );
  const resetDraftDirty = draftMode === 'automatic' && currentOverride !== null;
  const shippingDirty = parcelDraftDirty || overrideDraftDirty || resetDraftDirty;
  const canReset =
    currentOverride !== null &&
    automaticAmountCents !== null &&
    draftMode !== 'automatic' &&
    !controlsDisabled;
  const canRequestReset =
    currentOverride !== null &&
    automaticAmountCents !== null &&
    draftMode !== 'automatic' &&
    !lockMessage &&
    !pageBusy &&
    !isSaving;
  const shippingPending =
    currentOverride === null
    && (
      currentCalculation?.status === 'manual_quote'
      || automaticAmountCents === null
    );
  const automaticSummaryLabel =
    currentCalculation?.status === 'calculated'
      ? currentCalculation.matchedWeightBand.name || 'Osnovna poštnina'
      : currentCalculation?.status === 'manual_quote'
        ? 'Potrebna je ročna ponudba'
        : 'Izračun ni na voljo';
  const applyMutationResponse = useCallback((body: ShippingMutationResponse) => {
    setFinalAmountCents(body.shippingCents);
    setAutomaticAmountCents(body.automaticAmountCents);
    setCurrentOverride(body.shippingOverride);
    if (body.shippingCalculation) {
      setCurrentCalculation(body.shippingCalculation);
    }
    if (body.parcelCount !== undefined) {
      setCurrentParcelCount(body.parcelCount);
      setParcelCountInput(String(body.parcelCount));
    }
    if (body.pricingRevision !== undefined) {
      setCurrentPricingRevision(body.pricingRevision);
      onPricingRevisionChange?.(body.pricingRevision);
    }
  }, [onPricingRevisionChange]);

  const performMutation = useCallback(async (
    payload: ShippingMutationPayload
  ): Promise<ShippingMutationResponse> => {
    const response = await fetch(`/api/admin/orders/${orderId}/shipping`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const body = await response.json().catch(() => null) as unknown;
    if (!response.ok) {
      const record =
        body && typeof body === 'object' && !Array.isArray(body)
          ? body as Record<string, unknown>
          : null;
      const message = typeof record?.message === 'string'
        ? record.message
        : 'Sprememba po\u0161tnine ni uspela.';
      const code = typeof record?.code === 'string' ? record.code : null;
      throw new ShippingMutationError(message, code);
    }
    if (!isShippingMutationResponse(body)) {
      throw new ShippingMutationError(
        'Stre\u017enik je vrnil neveljaven odgovor za po\u0161tnino.'
      );
    }
    return body;
  }, [orderId]);

  const requestParcelCountConfirmation = useCallback(() => (
    new Promise<string | null>((resolve) => {
      parcelConfirmationResolverRef.current?.(null);
      parcelConfirmationResolverRef.current = resolve;
      setParcelCountReason('');
      setParcelCountDialogOpen(true);
    })
  ), []);

  const saveShippingDraft = useCallback(async (
    expectedPricingRevision?: number
  ): Promise<boolean> => {
    if (!shippingDirty) return true;
    if (!externalEditMode || saveInFlightRef.current) return false;

    if (parcelDraftDirty && !parcelCountIsValid) {
      toast.error(
        `\u0160tevilo paketov mora biti celo \u0161tevilo med 1 in ${String(SHIPPING_MAX_PARCEL_COUNT)}.`
      );
      return false;
    }
    if (parcelDraftDirty && parcelCountHardLocked) {
      toast.error('\u0160tevila paketov pri izbrisanem ali preklicanem naro\u010dilu ni mogo\u010de spremeniti.');
      return false;
    }
    if ((overrideDraftDirty || resetDraftDirty) && lockMessage) {
      toast.error(lockMessage);
      return false;
    }
    if (overrideDraftDirty && amountCents === null) {
      toast.error('Vnesite veljaven znesek z najve\u010d dvema decimalkama.');
      return false;
    }
    if (overrideDraftDirty && !reasonIsValid) {
      toast.error('Vnesite razlog za ro\u010dno spremembo po\u0161tnine.');
      return false;
    }
    if (resetDraftDirty && automaticAmountCents === null) {
      toast.error('Samodejni znesek ni na voljo.');
      return false;
    }

    saveInFlightRef.current = true;
    setIsSaving(true);
    let workingOverride = currentOverride;
    let workingAutomaticAmountCents = automaticAmountCents;
    let workingPricingRevision =
      Number.isSafeInteger(expectedPricingRevision) && Number(expectedPricingRevision) >= 1
        ? Number(expectedPricingRevision)
        : currentPricingRevision;

    try {
      if (parcelCountChanged) {
        let confirmationReason = parcelCountNeedsConfirmation
          ? await requestParcelCountConfirmation()
          : null;
        if (parcelCountNeedsConfirmation && confirmationReason === null) {
          return false;
        }

        const submitParcelCount = (confirmedReason: string | null) => performMutation({
          action: 'set_parcel_count',
          parcelCount: nextParcelCount,
          expectedPricingRevision: workingPricingRevision,
          confirmLockedRecalculation: confirmedReason !== null,
          ...(confirmedReason ? { reason: confirmedReason } : {})
        });

        let parcelResponse: ShippingMutationResponse;
        try {
          parcelResponse = await submitParcelCount(confirmationReason);
        } catch (error) {
          if (
            error instanceof ShippingMutationError &&
            error.code === 'PARCEL_COUNT_RECALCULATION_CONFIRMATION_REQUIRED' &&
            confirmationReason === null
          ) {
            confirmationReason = await requestParcelCountConfirmation();
            if (confirmationReason === null) return false;
            parcelResponse = await submitParcelCount(confirmationReason);
          } else {
            throw error;
          }
        }

        applyMutationResponse(parcelResponse);
        workingOverride = parcelResponse.shippingOverride;
        workingAutomaticAmountCents = parcelResponse.automaticAmountCents;
        if (parcelResponse.pricingRevision !== undefined) {
          workingPricingRevision = parcelResponse.pricingRevision;
        }
      }

      if (draftMode === 'automatic' && workingOverride !== null) {
        const resetResponse = await performMutation({ action: 'reset' });
        applyMutationResponse(resetResponse);
        workingOverride = resetResponse.shippingOverride;
        workingAutomaticAmountCents = resetResponse.automaticAmountCents;
        if (resetResponse.pricingRevision !== undefined) {
          workingPricingRevision = resetResponse.pricingRevision;
        }
      } else if (overrideDraftDirty && amountCents !== null) {
        const overrideResponse = await performMutation({
          action: 'override',
          amountCents,
          reason: reason.trim()
        });
        applyMutationResponse(overrideResponse);
        workingOverride = overrideResponse.shippingOverride;
        workingAutomaticAmountCents = overrideResponse.automaticAmountCents;
        if (overrideResponse.pricingRevision !== undefined) {
          workingPricingRevision = overrideResponse.pricingRevision;
        }
      }

      setCurrentPricingRevision(workingPricingRevision);
      setDraftMode(workingOverride ? 'override' : 'automatic');
      setAmountInput(
        workingOverride
          ? formatCentsInput(workingOverride.overrideAmountCents)
          : workingAutomaticAmountCents === null
            ? ''
            : formatCentsInput(workingAutomaticAmountCents)
      );
      setReason(workingOverride?.reason ?? '');
      return true;
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'Sprememba po\u0161tnine ni uspela.'
      );
      return false;
    } finally {
      saveInFlightRef.current = false;
      setIsSaving(false);
    }
  }, [
    amountCents,
    applyMutationResponse,
    automaticAmountCents,
    currentOverride,
    currentPricingRevision,
    draftMode,
    externalEditMode,
    lockMessage,
    nextParcelCount,
    overrideDraftDirty,
    parcelCountChanged,
    parcelCountHardLocked,
    parcelCountIsValid,
    parcelCountNeedsConfirmation,
    parcelDraftDirty,
    performMutation,
    reason,
    reasonIsValid,
    requestParcelCountConfirmation,
    resetDraftDirty,
    shippingDirty,
    toast
  ]);

  useEffect(() => {
    onDirtyChange?.(shippingDirty);
  }, [onDirtyChange, shippingDirty]);

  useEffect(() => {
    onSavingChange?.(isSaving);
  }, [isSaving, onSavingChange]);

  useEffect(() => {
    saveDraftRef.current = saveShippingDraft;
  }, [saveShippingDraft]);

  useEffect(() => {
    if (!onRegisterSave) return undefined;
    return onRegisterSave((expectedPricingRevision) => (
      saveDraftRef.current(expectedPricingRevision)
    ));
  }, [onRegisterSave]);

  return (
    <>
      <section
        className={adminWindowCardClassName + ' overflow-hidden !p-0'}
        style={adminWindowCardStyle}
        aria-labelledby="admin-order-shipping-title"
        data-testid="admin-order-shipping-card"
      >
        <div
          className="flex min-h-11 items-center gap-2 px-4 py-2"
          data-shipping-summary-row
        >
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
            <h2
              id="admin-order-shipping-title"
              className="text-base font-semibold text-slate-900"
            >
              Poštnina
            </h2>
            <span
              data-shipping-mode={
                shippingPending
                  ? 'pending'
                  : currentOverride
                    ? 'manual'
                    : 'automatic'
              }
              className={
                shippingPending
                  ? 'rounded-md border border-amber-300 bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold leading-4 text-amber-800'
                  : currentOverride
                    ? 'rounded-md border border-slate-300 bg-white px-1.5 py-0.5 text-[10px] font-semibold leading-4 text-slate-600'
                    : 'rounded-md border border-emerald-300 bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold leading-4 text-emerald-700'
              }
            >
              {shippingPending
                ? 'Po dogovoru'
                : currentOverride
                  ? 'Ročno'
                  : 'Samodejno'}
            </span>
            <span className="text-[10px] leading-4 text-slate-400" aria-hidden="true">•</span>
            <p className="min-w-0 text-[11px] leading-4 text-slate-600">
              {shippingPending
                ? 'Ročni znesek je potreben'
                : String(currentParcelCount) + ' ' + (currentParcelCount === 1 ? 'paket' : 'paketov')}
            </p>
          </div>
          <p
            className="shrink-0 whitespace-nowrap text-sm font-semibold leading-5 tabular-nums text-slate-950"
            data-shipping-final-amount
          >
            {shippingPending
              ? '—'
              : formatCents(finalAmountCents)}
          </p>
          <button
            type="button"
            className={
              adminCardSectionEditIconButtonClassName +
              (externalEditMode ? ' bg-[color:var(--hover-neutral)]' : '')
            }
            aria-pressed={externalEditMode}
            aria-controls={'admin-order-shipping-editor-' + orderId}
            aria-label={externalEditMode ? 'Končaj urejanje poštnine' : 'Uredi poštnino'}
            title={externalEditMode ? 'Končaj urejanje poštnine' : 'Uredi poštnino'}
            disabled={pageBusy || isSaving}
            data-admin-card-edit-action="shipping"
            onClick={onRequestEdit}
          >
            <PencilIcon className="h-4 w-4" />
          </button>
        </div>

        <div className="border-t border-slate-200">
          {externalEditMode ? (
            <div
              id={'admin-order-shipping-editor-' + orderId}
              className="grid items-end gap-2 px-4 py-2 sm:grid-cols-[72px_96px_minmax(120px,1fr)]"
              data-shipping-editor-row
              data-testid="admin-order-shipping-editor"
            >
              <label className="block min-w-0" data-parcel-count-control>
                <span
                  className="text-[10px] font-semibold leading-4 text-slate-700"
                  title="Število paketov, oddanih skupaj"
                >
                  Paketi
                </span>
                <input
                  type="number"
                  min="1"
                  max={SHIPPING_MAX_PARCEL_COUNT}
                  step="1"
                  inputMode="numeric"
                  value={parcelCountInput}
                  onChange={(event) => setParcelCountInput(event.target.value)}
                  disabled={parcelCountControlsDisabled}
                  aria-label="Število paketov, oddanih skupaj"
                  aria-describedby={'admin-order-shipping-parcel-help-' + orderId}
                  className={'mt-0.5 ' + fieldClassName + ' !h-7 !px-2 !text-[11px] !leading-4'}
                />
                <span
                  id={'admin-order-shipping-parcel-help-' + orderId}
                  className="sr-only"
                >
                  To je število fizičnih paketov, ki so istemu prejemniku oddani
                  skupaj, ne število naročenih artiklov.
                </span>
              </label>
              <label className="block min-w-0">
                <span className="text-[10px] font-semibold leading-4 text-slate-700">
                  Znesek (€)
                </span>
                <input
                  value={amountInput}
                  onChange={(event) => {
                    setAmountInput(event.target.value);
                    setDraftMode('override');
                  }}
                  inputMode="decimal"
                  disabled={controlsDisabled}
                  aria-label="Ročni znesek poštnine v evrih"
                  className={'mt-0.5 ' + fieldClassName + ' !h-7 !px-2 !text-[11px] !leading-4'}
                />
              </label>
              <label className="block min-w-0">
                <span className="text-[10px] font-semibold leading-4 text-slate-700">
                  Razlog spremembe
                </span>
                <input
                  type="text"
                  value={reason}
                  onChange={(event) => {
                    setReason(event.target.value);
                    setDraftMode('override');
                  }}
                  disabled={controlsDisabled}
                  aria-label="Razlog ročne spremembe poštnine"
                  className={'mt-0.5 ' + fieldClassName + ' !h-7 !px-2 !text-[11px] !leading-4'}
                />
              </label>
            </div>
          ) : (
            <div
              className="grid min-h-10 grid-cols-[112px_minmax(0,1fr)] items-center gap-3 px-4 py-1.5"
              data-shipping-read-reason
            >
              <p className="text-[11px] font-medium leading-4 text-slate-500">Razlog spremembe</p>
              <p
                className="truncate text-[11px] leading-4 text-slate-900"
                title={currentOverride?.reason || (shippingPending ? '—' : 'Brez ročne spremembe.')}
              >
                {currentOverride?.reason || (shippingPending ? '—' : 'Brez ročne spremembe.')}
              </p>
            </div>
          )}
        </div>

        {externalEditMode && parcelCountHardLocked && !quoteDerived ? (
          <p className="border-t border-rose-200 bg-rose-50 px-4 py-1.5 text-[11px] font-medium leading-4 text-rose-700">
            Števila paketov pri izbrisanem ali preklicanem naročilu ni mogoče spremeniti.
          </p>
        ) : null}

        {lockMessage ? (
          <p
            className="border-t border-slate-300 bg-slate-100 px-4 py-1.5 text-[11px] font-medium leading-4 text-slate-700"
            data-shipping-lock-message
          >
            {lockMessage}
          </p>
        ) : null}

        <div
          className="grid min-h-12 gap-2 border-t border-slate-200 px-4 py-1.5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
          data-shipping-automatic-summary
        >
          <div className="flex min-w-0 items-baseline gap-2">
            <p className="shrink-0 text-[11px] font-semibold leading-4 text-slate-900">Samodejni izračun</p>
            <p className="min-w-0 truncate text-[10px] leading-4 text-slate-500" title={automaticSummaryLabel}>
              {automaticSummaryLabel}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
            <span className="shrink-0 text-[11px] font-semibold leading-4 tabular-nums text-slate-700">
              {automaticAmountCents === null
                ? 'Ni na voljo'
                : formatCents(automaticAmountCents)}
            </span>
            {currentOverride ? (
              <IconButton
                type="button"
                size="sm"
                tone="neutral"
                disabled={!canRequestReset}
                onClick={() => {
                  if (!externalEditMode) onRequestEdit();
                  setResetDialogOpen(true);
                }}
                className="shrink-0"
                aria-label="Uporabi samodejno poštnino"
                title={
                  automaticAmountCents === null
                    ? 'Samodejni znesek ni na voljo.'
                    : 'Uporabi samodejno poštnino'
                }
                data-testid="admin-order-shipping-reset-button"
              >
                <Calculator className="h-3.5 w-3.5" aria-hidden="true" />
              </IconButton>
            ) : null}
          </div>
        </div>
      </section>

      <ConfirmDialog
        open={resetDialogOpen}
        title={'Ponastavitev po\u0161tnine'}
        description={
          automaticAmountCents === null
            ? 'Samodejni znesek ni na voljo.'
            : `Ro\u010dni znesek bo zamenjan s samodejnim zneskom ${formatCents(automaticAmountCents)}.`
        }
        confirmLabel="Ponastavi"
        cancelLabel={'Prekli\u010di'}
        confirmDisabled={!canReset}
        onCancel={() => setResetDialogOpen(false)}
        onConfirm={() => {
          setResetDialogOpen(false);
          setDraftMode('automatic');
          setAmountInput(
            automaticAmountCents === null
              ? ''
              : formatCentsInput(automaticAmountCents)
          );
          setReason('');
        }}
      />

      <ConfirmDialog
        open={parcelCountDialogOpen}
        title={'Potrditev prera\u010duna po\u0161tnine'}
        description={
          `\u0160tevilo paketov se bo spremenilo z ${currentParcelCount} na ${
            parcelCountIsValid ? nextParcelCount : '\u2014'
          }. Po\u0161tnina in skupni znesek bosta prera\u010dunana, sprememba pa bo zapisana v dnevnik. ` +
          (hasActiveDocuments
            ? 'Obstoje\u010di dokumenti bodo ostali zgodovinski in jih bo treba po potrebi znova izdati.'
            : 'Sprememba vpliva na \u017ee shranjeno naro\u010dilo.')
        }
        confirmLabel="Potrdi prera\u010dun"
        cancelLabel={'Prekli\u010di'}
        confirmDisabled={
          !parcelCountChanged ||
          !parcelCountReason.trim()
        }
        onCancel={() => {
          const resolveConfirmation = parcelConfirmationResolverRef.current;
          parcelConfirmationResolverRef.current = null;
          setParcelCountDialogOpen(false);
          setParcelCountReason('');
          resolveConfirmation?.(null);
        }}
        onConfirm={() => {
          if (!parcelCountChanged || !parcelCountReason.trim()) return;
          const confirmedReason = parcelCountReason.trim();
          const resolveConfirmation = parcelConfirmationResolverRef.current;
          parcelConfirmationResolverRef.current = null;
          setParcelCountDialogOpen(false);
          setParcelCountReason('');
          resolveConfirmation?.(confirmedReason);
        }}
      >
        <label className="mt-4 block">
          <span className="text-xs font-semibold text-slate-700">Razlog spremembe</span>
          <textarea
            value={parcelCountReason}
            onChange={(event) => setParcelCountReason(event.target.value)}
            rows={3}
            className={`mt-1 ${textareaClassName}`}
            aria-label={'Razlog poznej\u0161e spremembe \u0161tevila paketov'}
          />
        </label>
      </ConfirmDialog>
    </>
  );
}
