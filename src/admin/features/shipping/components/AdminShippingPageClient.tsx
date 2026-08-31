'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  calculateShipping,
  formatShippingWeightIntervalGrams,
  normalizeShippingConfiguration,
  parseShippingWeightIntervalGrams,
  SHIPPING_DIMENSION_COMPARISON_OPERATORS,
  SHIPPING_MAX_PARCEL_COUNT,
  type ShippingConfiguration,
  type ShippingDimensionComparisonOperator,
  type ShippingDimensionalRule,
  type ShippingWeightBand
} from '@/shared/domain/shipping/shipping';
import { AdminPageHeader } from '@/shared/ui/admin-primitives';
import {
  AdminTablePrimaryActionButton,
  adminWindowCardClassName,
  adminWindowCardStyle,
  adminTableRowHeightClassName
} from '@/shared/ui/admin-table';
import { AdminUnitInput } from '@/shared/ui/admin-controls/AdminUnitInput';
import { AdminSwitch } from '@/shared/ui/admin-switch';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { IconButton } from '@/shared/ui/icon-button';
import { TrashCanIcon } from '@/shared/ui/icons/AdminActionIcons';
import { Input } from '@/shared/ui/input';
import { Spinner } from '@/shared/ui/loading';
import {
  EmptyState,
  RowActions as SharedRowActions,
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR
} from '@/shared/ui/table';
import { useToast } from '@/shared/ui/toast';

type ShippingAdminState = {
  configuration: ShippingConfiguration;
  revision: number;
  updatedAt: string | null;
};

type ApiPayload = {
  state?: ShippingAdminState;
  code?: string;
  configuration?: ShippingConfiguration;
  message?: string;
  errors?: string[];
};

type ShippingOrderValueDiscountRule =
  ShippingConfiguration['orderValueDiscountRules'][number];
type ShippingMultiPieceDiscountRule =
  ShippingConfiguration['multiPieceDiscountRules'][number];
type CalculatedShippingPreview = Extract<
  ReturnType<typeof calculateShipping>,
  { status: 'calculated' }
>;

const tableInputClassName = 'h-[30px] px-2 text-[11px]';
const compactRulePanelClassName = 'min-w-0 overflow-hidden bg-white';
const compactRulePanelHeaderClassName = 'flex min-h-11 flex-col gap-2 border-b border-slate-200 bg-white px-4 py-3 sm:flex-row sm:justify-between';
const shippingRuleTableClassName = 'min-w-[650px] table-fixed text-[12px]';
const shippingRuleNameColumnClassName = 'w-[26%] px-3';
const shippingRuleConditionColumnClassName = 'w-[24%] px-3';
const shippingRuleAdjustmentColumnClassName = 'w-[20%] px-3';
const shippingRuleEnabledColumnClassName = 'w-[12%] px-3 text-center';
const shippingRuleActionsColumnClassName = 'w-[18%] px-3 text-right';

const dimensionalAdjustmentUnitOptions: ReadonlyArray<{
  value: ShippingDimensionalRule['adjustmentType'];
  label: string;
}> = [
  { value: 'fixed', label: '€' },
  { value: 'percentage', label: '%' }
];
const dimensionalComparisonLabels: Record<ShippingDimensionComparisonOperator, string> = {
  '<': '<',
  '>': '>',
  '<=': '≤',
  '>=': '≥'
};

const dimensionalComparisonOptions = SHIPPING_DIMENSION_COMPARISON_OPERATORS.map(
  (value) => ({ value, label: dimensionalComparisonLabels[value] })
);

const moneyFormatter = new Intl.NumberFormat('sl-SI', {
  style: 'currency',
  currency: 'EUR'
});
const percentagePointsFormatter = new Intl.NumberFormat('sl-SI', {
  maximumFractionDigits: 20
});

function formatCents(cents: number) {
  return moneyFormatter.format(cents / 100);
}

function formatAdjustmentValue(
  rule: Pick<ShippingDimensionalRule, 'adjustmentType' | 'adjustmentValue'>
) {
  const value = rule.adjustmentValue ?? 0;
  return rule.adjustmentType === 'percentage'
    ? `${percentagePointsFormatter.format(value)} %`
    : formatCents(value);
}

function hasValidDiscountAdjustment(
  rule: Pick<ShippingDimensionalRule, 'adjustmentType' | 'adjustmentValue'>
) {
  return (
    rule.adjustmentValue !== null
    && rule.adjustmentValue > 0
    && (rule.adjustmentType === 'fixed' || rule.adjustmentValue <= 100)
  );
}

function buildShippingCalculationSteps(preview: CalculatedShippingPreview) {
  const singleParcelFormula = `S = ${formatCents(preview.basePriceCents)} + ${formatCents(preview.surchargeAmountCents)} = ${formatCents(preview.singleParcelAmountCents)}`;
  const multiPieceRule = preview.matchedMultiPieceDiscountRule;
  const multiPieceFormula = preview.parcelCount === 1
    ? `Sₙ = 1 × ${formatCents(preview.singleParcelAmountCents)} = ${formatCents(preview.afterMultiPieceAmountCents)}`
    : multiPieceRule?.adjustmentType === 'percentage'
      ? `Sₙ = ${preview.parcelCount} × ${formatCents(preview.singleParcelAmountCents)} × (1 − ${percentagePointsFormatter.format(multiPieceRule.adjustmentValue ?? 0)} / 100) = ${formatCents(preview.afterMultiPieceAmountCents)}`
      : multiPieceRule?.adjustmentType === 'fixed'
        ? `Sₙ = ${preview.parcelCount} × max(0, ${formatCents(preview.singleParcelAmountCents)} − ${formatCents(multiPieceRule.adjustmentValue ?? 0)}) = ${formatCents(preview.afterMultiPieceAmountCents)}`
        : `Sₙ = ${preview.parcelCount} × ${formatCents(preview.singleParcelAmountCents)} = ${formatCents(preview.afterMultiPieceAmountCents)}`;
  const finalFormula = `Sₖ = max(0, ${formatCents(preview.afterMultiPieceAmountCents)} − ${formatCents(preview.orderValueDiscountAmountCents)}) = ${formatCents(preview.finalAmountCents)}`;

  return [
    { id: 'single-parcel', formula: singleParcelFormula },
    { id: 'multi-piece', formula: multiPieceFormula },
    { id: 'final', formula: finalFormula }
  ];
}

function ShippingPreviewSummaryRow({
  label,
  detail,
  value,
  variant = 'calculation',
  divider = false
}: {
  label: string;
  detail?: string;
  value: string;
  variant?: 'detail' | 'calculation';
  divider?: boolean;
}) {
  return (
    <div
      className={`grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 ${
        variant === 'detail' ? 'h-8' : 'py-0.5'
      } ${divider ? 'border-t border-slate-200/90' : ''}`}
    >
      <dt className="min-w-0 text-[12px] font-semibold leading-4 text-slate-950">
        {label}
        {detail ? (
          <span className="font-medium text-slate-500"> ({detail})</span>
        ) : null}
      </dt>
      <dd className="shrink-0 text-right text-[12px] font-semibold leading-4 text-slate-950">
        {value}
      </dd>
    </div>
  );
}

function formatTimestamp(value: string | null) {
  if (!value) return 'Še ni shranjeno';
  return new Intl.DateTimeFormat('sl-SI', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(value));
}

function createId(prefix: string) {
  const randomPart = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${prefix}-${randomPart}`;
}

function createWeightIntervalDrafts(configuration: ShippingConfiguration) {
  return Object.fromEntries(
    configuration.weightBands.map((band) => [
      band.id,
      formatShippingWeightIntervalGrams(band)
    ])
  );
}

function serializeShippingEditingState(
  configuration: ShippingConfiguration,
  weightIntervalDrafts: Record<string, string>,
  numericInputDrafts: Record<string, string>
) {
  return JSON.stringify({ configuration, weightIntervalDrafts, numericInputDrafts });
}

function getShippingNumericInputValue(
  drafts: Record<string, string>,
  key: string,
  canonicalValue: number | string
) {
  return Object.prototype.hasOwnProperty.call(drafts, key)
    ? drafts[key]
    : canonicalValue;
}

function numberInputOrZero(rawValue: string) {
  if (rawValue.trim() === '') return 0;
  const parsedValue = Number(rawValue);
  return Number.isFinite(parsedValue) ? parsedValue : 0;
}

function normalizeBlankShippingNumbersForSave(
  configuration: ShippingConfiguration
): ShippingConfiguration {
  return {
    ...configuration,
    dimensionalRules: configuration.dimensionalRules.map((rule) => ({
      ...rule,
      adjustmentValue: rule.adjustmentValue ?? 0
    })),
    orderValueDiscountRules: configuration.orderValueDiscountRules.map((rule) => ({
      ...rule,
      adjustmentValue: rule.adjustmentValue ?? 0
    })),
    multiPieceDiscountRules: configuration.multiPieceDiscountRules.map((rule) => ({
      ...rule,
      adjustmentValue: rule.adjustmentValue ?? 0
    }))
  };
}

function reorder<T extends { position: number }>(items: T[], index: number, direction: -1 | 1) {
  const nextIndex = index + direction;
  if (nextIndex < 0 || nextIndex >= items.length) return items;
  const next = [...items];
  [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
  return next.map((item, position) => ({ ...item, position }));
}

function SectionHeading({
  id,
  title,
  description,
  action
}: {
  id: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <h2 id={id} className="text-base font-semibold text-slate-900">{title}</h2>
        {description ? (
          <p className="mt-1 max-w-3xl text-sm leading-5 text-slate-600">{description}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

function RulePanelHeading({
  id,
  title,
  description,
  action
}: {
  id: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div
      className={`${compactRulePanelHeaderClassName} ${description ? 'sm:items-start' : 'sm:items-center'}`}
    >
      <div className="min-w-0">
        <h3 id={id} className="text-sm font-semibold text-slate-900">{title}</h3>
        {description ? (
          <p className="mt-1 text-[11px] font-medium leading-4 text-slate-500">{description}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

function ShippingRowActions({
  label,
  index,
  count,
  onMove,
  onRemove
}: {
  label: string;
  index: number;
  count: number;
  onMove: (direction: -1 | 1) => void;
  onRemove: () => void;
}) {
  return (
    <SharedRowActions className="!justify-end">
      <IconButton
        type="button"
        tone="neutral"
        size="md"
        aria-label="Premakni navzgor"
        title="Premakni navzgor"
        disabled={index === 0}
        onClick={() => onMove(-1)}
      >
        <span aria-hidden="true">↑</span>
      </IconButton>
      <IconButton
        type="button"
        tone="neutral"
        size="md"
        aria-label="Premakni navzdol"
        title="Premakni navzdol"
        disabled={index === count - 1}
        onClick={() => onMove(1)}
      >
        <span aria-hidden="true">↓</span>
      </IconButton>
      <IconButton
        type="button"
        tone="danger"
        size="md"
        aria-label={`Odstrani ${label}`}
        title={`Odstrani ${label}`}
        onClick={onRemove}
      >
        <TrashCanIcon className="!h-4 !w-4" />
      </IconButton>
    </SharedRowActions>
  );
}

function ShippingDeleteAction({
  label,
  onRemove
}: {
  label: string;
  onRemove: () => void;
}) {
  return (
    <SharedRowActions className="!justify-end">
      <IconButton
        type="button"
        tone="danger"
        size="md"
        aria-label={`Odstrani ${label}`}
        title={`Odstrani ${label}`}
        onClick={onRemove}
      >
        <TrashCanIcon className="!h-4 !w-4" />
      </IconButton>
    </SharedRowActions>
  );
}

export default function AdminShippingPageClient({
  initialState
}: {
  initialState: ShippingAdminState;
}) {
  const { toast } = useToast();
  const [configuration, setConfiguration] = useState(() =>
    normalizeShippingConfiguration(initialState.configuration)
  );
  const [weightIntervalDrafts, setWeightIntervalDrafts] = useState(() =>
    createWeightIntervalDrafts(normalizeShippingConfiguration(initialState.configuration))
  );
  const [savedEditingSnapshot, setSavedEditingSnapshot] = useState(() => {
    const savedConfiguration = normalizeShippingConfiguration(initialState.configuration);
    return serializeShippingEditingState(
      savedConfiguration,
      createWeightIntervalDrafts(savedConfiguration),
      {}
    );
  });
  const [updatedAt, setUpdatedAt] = useState(initialState.updatedAt);
  const [revision, setRevision] = useState(initialState.revision);
  const [isSaving, setIsSaving] = useState(false);
  const [isReloading, setIsReloading] = useState(false);
  const [hasVersionConflict, setHasVersionConflict] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [numericInputDrafts, setNumericInputDrafts] = useState<Record<string, string>>({});
  const [previewWeightGramsInput, setPreviewWeightGramsInput] = useState('4999');
  const [previewLargestDimensionMmInput, setPreviewLargestDimensionMmInput] =
    useState('900');
  const [previewMerchandiseSubtotalEurosInput, setPreviewMerchandiseSubtotalEurosInput] =
    useState('100');
  const [previewParcelCountInput, setPreviewParcelCountInput] = useState('1');
  const [isClientReady, setIsClientReady] = useState(false);

  useEffect(() => {
    setIsClientReady(true);
  }, []);

  const previewWeightGrams = numberInputOrZero(previewWeightGramsInput);
  const previewLargestDimensionMm = numberInputOrZero(
    previewLargestDimensionMmInput
  );
  const previewMerchandiseSubtotalCents = Math.max(
    0,
    Math.round(numberInputOrZero(previewMerchandiseSubtotalEurosInput) * 100)
  );
  const previewParcelCount = previewParcelCountInput.trim() === ''
    ? 0
    : Math.min(
        SHIPPING_MAX_PARCEL_COUNT,
        Math.max(1, Math.trunc(numberInputOrZero(previewParcelCountInput)))
      );

  const editingSnapshot = useMemo(
    () => serializeShippingEditingState(
      configuration,
      weightIntervalDrafts,
      numericInputDrafts
    ),
    [configuration, numericInputDrafts, weightIntervalDrafts]
  );
  const isDirty = editingSnapshot !== savedEditingSnapshot;

  const updateNumericInputDraft = (key: string, rawValue: string) => {
    setNumericInputDrafts((current) => {
      if (rawValue === '') return { ...current, [key]: '' };
      if (!Object.prototype.hasOwnProperty.call(current, key)) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
  };

  const clearNumericInputDraft = (key: string) => {
    setNumericInputDrafts((current) => {
      if (!Object.prototype.hasOwnProperty.call(current, key)) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
  };

  const clearNumericInputDraftsForRule = (ruleType: string, id: string) => {
    const prefix = `${ruleType}:${id}:`;
    setNumericInputDrafts((current) => Object.fromEntries(
      Object.entries(current).filter(([key]) => !key.startsWith(prefix))
    ));
  };

  const updateBand = (id: string, patch: Partial<ShippingWeightBand>) => {
    setConfiguration((current) => ({
      ...current,
      weightBands: current.weightBands.map((band) =>
        band.id === id ? { ...band, ...patch } : band
      )
    }));
  };

  const updateBandInterval = (band: ShippingWeightBand, value: string) => {
    setWeightIntervalDrafts((current) => ({ ...current, [band.id]: value }));
    const parsed = parseShippingWeightIntervalGrams(value);
    if (!parsed.ok) return;
    updateBand(band.id, {
      minWeightGrams: parsed.minWeightGrams,
      maxWeightGrams: parsed.maxWeightGrams
    });
  };

  const updateDimensionalRule = (
    id: string,
    patch: Partial<ShippingDimensionalRule>
  ) => {
    setConfiguration((current) => ({
      ...current,
      dimensionalRules: current.dimensionalRules.map((rule) =>
        rule.id === id ? { ...rule, ...patch } : rule
      )
    }));
  };

  const updateOrderValueDiscountRule = (
    id: string,
    patch: Partial<ShippingOrderValueDiscountRule>
  ) => {
    setConfiguration((current) => ({
      ...current,
      orderValueDiscountRules: current.orderValueDiscountRules.map((rule) =>
        rule.id === id ? { ...rule, ...patch } : rule
      )
    }));
  };

  const updateMultiPieceDiscountRule = (
    id: string,
    patch: Partial<ShippingMultiPieceDiscountRule>
  ) => {
    setConfiguration((current) => ({
      ...current,
      multiPieceDiscountRules: current.multiPieceDiscountRules.map((rule) =>
        rule.id === id ? { ...rule, ...patch } : rule
      )
    }));
  };

  const preview = useMemo(
    () =>
      calculateShipping(
        configuration,
        [
          {
            productId: 'admin-preview',
            variantId: 'admin-preview',
            sku: 'SIMULATOR',
            name: 'Artikel v simulatorju',
            quantity: 1,
            measurement: {
              weightGrams: previewWeightGrams,
              lengthMm: previewLargestDimensionMm,
              widthMm: 1,
              heightMm: 1
            }
          }
        ],
        {
          merchandiseSubtotalCents: previewMerchandiseSubtotalCents,
          parcelCount: previewParcelCount
        }
      ),
    [
      configuration,
      previewLargestDimensionMm,
      previewMerchandiseSubtotalCents,
      previewParcelCount,
      previewWeightGrams
    ]
  );

  const save = async () => {
    const configurationForSave = normalizeBlankShippingNumbersForSave(configuration);
    setConfiguration(configurationForSave);
    setNumericInputDrafts({});
    setPreviewWeightGramsInput((current) => current.trim() === '' ? '0' : current);
    setPreviewLargestDimensionMmInput((current) => current.trim() === '' ? '0' : current);
    setPreviewMerchandiseSubtotalEurosInput((current) => current.trim() === '' ? '0' : current);
    setPreviewParcelCountInput((current) => current.trim() === '' ? '0' : current);

    const intervalErrors = configurationForSave.weightBands.flatMap((band, index) => {
      const parsed = parseShippingWeightIntervalGrams(
        weightIntervalDrafts[band.id] ?? formatShippingWeightIntervalGrams(band)
      );
      return parsed.ok
        ? []
        : [`Masni interval ${index + 1} (${band.name || 'brez naziva'}): ${parsed.message}`];
    });
    if (intervalErrors.length > 0) {
      setErrors(intervalErrors);
      toast.error(intervalErrors[0]);
      return;
    }
    setIsSaving(true);
    setErrors([]);
    try {
      const response = await fetch('/api/admin/shipping', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          configuration: configurationForSave,
          expectedVersion: configurationForSave.version,
          expectedRevision: revision
        })
      });
      const payload = (await response.json().catch(() => ({}))) as ApiPayload;
      if (!response.ok || !payload.state) {
        if (response.status === 409 && payload.code === 'SHIPPING_CONFIGURATION_CHANGED') {
          const message = payload.message
            ?? 'Nastavitve so bile med urejanjem spremenjene.';
          setHasVersionConflict(true);
          setErrors([message, 'Pred ponovnim shranjevanjem naložite trenutno različico.']);
          toast.error(message);
          return;
        }
        const nextErrors = payload.errors?.length
          ? payload.errors
          : [payload.message ?? 'Shranjevanje nastavitev poštnine ni uspelo.'];
        setErrors(nextErrors);
        toast.error(nextErrors[0]);
        return;
      }
      const nextConfiguration = normalizeShippingConfiguration(payload.state.configuration);
      const nextWeightIntervalDrafts = createWeightIntervalDrafts(nextConfiguration);
      setConfiguration(nextConfiguration);
      setWeightIntervalDrafts(nextWeightIntervalDrafts);
      setNumericInputDrafts({});
      setSavedEditingSnapshot(
        serializeShippingEditingState(nextConfiguration, nextWeightIntervalDrafts, {})
      );
      setRevision(payload.state.revision);
      setUpdatedAt(payload.state.updatedAt);
      setHasVersionConflict(false);
      toast.success('Nastavitve poštnine so shranjene.');
    } catch {
      const message = 'Shranjevanje nastavitev poštnine ni uspelo.';
      setErrors([message]);
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  };

  const reloadCurrent = async () => {
    setIsReloading(true);
    try {
      const response = await fetch('/api/admin/shipping', { cache: 'no-store' });
      const payload = (await response.json().catch(() => ({}))) as ApiPayload;
      if (!response.ok || !payload.state) {
        throw new Error(payload.message ?? 'Trenutnega cenika ni mogoče naložiti.');
      }
      const nextConfiguration = normalizeShippingConfiguration(payload.state.configuration);
      const nextWeightIntervalDrafts = createWeightIntervalDrafts(nextConfiguration);
      setConfiguration(nextConfiguration);
      setWeightIntervalDrafts(nextWeightIntervalDrafts);
      setNumericInputDrafts({});
      setSavedEditingSnapshot(
        serializeShippingEditingState(nextConfiguration, nextWeightIntervalDrafts, {})
      );
      setRevision(payload.state.revision);
      setUpdatedAt(payload.state.updatedAt);
      setHasVersionConflict(false);
      setErrors([]);
      toast.info('Naložena je trenutna shranjena različica cenika.');
    } catch (error) {
      const message = error instanceof Error
        ? error.message
        : 'Trenutnega cenika ni mogoče naložiti.';
      setErrors([message]);
      toast.error(message);
    } finally {
      setIsReloading(false);
    }
  };

  return (
    <fieldset
      className="m-0 min-w-0 w-full space-y-4 border-0 p-0 font-['Inter',system-ui,sans-serif]"
      disabled={!isClientReady}
      aria-busy={!isClientReady}
      data-client-ready={isClientReady ? 'true' : 'false'}
      data-testid="shipping-client-surface"
    >
      <AdminPageHeader
        title="Poštnina"
        actions={
          <div className="flex flex-wrap items-center justify-end gap-2">
            <span
              className="mr-1 inline-flex items-center gap-1.5 text-[11px] font-medium text-slate-500"
              role="status"
              aria-live="polite"
              data-testid="shipping-save-status"
              title={
                isDirty
                  ? 'Spremembe še niso shranjene.'
                  : updatedAt
                    ? `Shranjeno: ${formatTimestamp(updatedAt)}`
                    : 'Shranjeno'
              }
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  isDirty ? 'bg-amber-500' : 'bg-emerald-500'
                }`}
                aria-hidden="true"
              />
              {isDirty ? 'Neshranjeno' : 'Shranjeno'}
            </span>
            <AdminTablePrimaryActionButton
              type="button"
              className="gap-2"
              disabled={isSaving || isReloading || !isDirty}
              aria-busy={isSaving}
              data-testid="shipping-settings-save"
              onClick={() => void save()}
            >
              {isSaving ? <Spinner size="sm" /> : null}
              {isSaving ? 'Shranjujem …' : 'Shrani nastavitve'}
            </AdminTablePrimaryActionButton>
          </div>
        }
      />

      {errors.length > 0 ? (
        <div
          className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800"
          role="alert"
          aria-live="assertive"
        >
          <p className="font-semibold">Nastavitev ni mogoče shraniti:</p>
          <ul className="mt-1 list-disc pl-5">
            {errors.map((error, index) => <li key={`${error}-${index}`}>{error}</li>)}
          </ul>
          {hasVersionConflict ? (
            <Button
              type="button"
              variant="outline"
              className="mt-3 gap-2 border-rose-300 text-rose-800"
              disabled={isReloading}
              aria-busy={isReloading}
              onClick={() => void reloadCurrent()}
            >
              {isReloading ? <Spinner size="sm" /> : null}
              Naloži trenutno različico
            </Button>
          ) : null}
        </div>
      ) : null}

      <div
        className="grid min-w-0 items-start gap-4 min-[1180px]:grid-cols-[minmax(0,3fr)_minmax(380px,2fr)] min-[1180px]:items-stretch"
        data-testid="shipping-workspace-layout"
      >
      <section
        className={adminWindowCardClassName}
        style={adminWindowCardStyle}
        data-testid="shipping-rules-workspace"
        aria-labelledby="shipping-rules-workspace-heading"
      >
        <SectionHeading
          id="shipping-rules-workspace-heading"
          title="Pravila poštnine"
        />
        <div
          className="divide-y divide-slate-200 bg-white"
          data-testid="shipping-rule-groups"
        >
      <section
        className={compactRulePanelClassName}
        data-testid="shipping-weight-bands"
        aria-labelledby="shipping-weight-bands-heading"
      >
        <RulePanelHeading
          id="shipping-weight-bands-heading"
          title="Osnovna poštnina po masi"
          action={
            <AdminTablePrimaryActionButton
              type="button"
              onClick={() => {
                const lastBand = configuration.weightBands.at(-1);
                const minWeightGrams = lastBand?.maxWeightGrams === null
                  ? Math.max(1, lastBand.minWeightGrams + 1)
                  : (lastBand?.maxWeightGrams ?? 0) + 1;
                const nextBand: ShippingWeightBand = {
                  id: createId('weight'),
                  name: 'Nov interval',
                  minWeightGrams,
                  maxWeightGrams: null,
                  priceCents: 0,
                  enabled: false,
                  position: configuration.weightBands.length
                };
                setConfiguration((current) => ({
                  ...current,
                  weightBands: [...current.weightBands, nextBand]
                }));
                setWeightIntervalDrafts((current) => ({
                  ...current,
                  [nextBand.id]: formatShippingWeightIntervalGrams(nextBand)
                }));
              }}
            >
              Dodaj interval
            </AdminTablePrimaryActionButton>
          }
        />
        <div
          className="overflow-x-auto bg-white"
          role="region"
          aria-label="Intervali poštnine po masi"
          tabIndex={0}
        >
          <Table className={shippingRuleTableClassName}>
            <caption className="sr-only">Nastavitve osnovne poštnine po skupni masi naročila</caption>
            <THead>
              <TR className="hover:bg-transparent">
                <TH scope="col" className={shippingRuleNameColumnClassName}>Naziv</TH>
                <TH scope="col" className={shippingRuleConditionColumnClassName}>Interval</TH>
                <TH scope="col" className={shippingRuleAdjustmentColumnClassName}>Cena</TH>
                <TH scope="col" className={shippingRuleEnabledColumnClassName}>Aktivno</TH>
                <TH scope="col" className={shippingRuleActionsColumnClassName}>Dejanja</TH>
              </TR>
            </THead>
            <TBody className="divide-y divide-slate-200 bg-white">
              {configuration.weightBands.length === 0 ? (
                <TR className="hover:bg-white">
                  <TD colSpan={5} className="px-4 py-8">
                    <EmptyState title="Ni nastavljenih masnih intervalov." />
                  </TD>
                </TR>
              ) : configuration.weightBands.map((band, index) => (
                <TR key={band.id} className={`${adminTableRowHeightClassName} align-middle`}>
                  <TD className="px-3 py-1.5 align-middle">
                    <Input
                      className={tableInputClassName}
                      aria-label={`Masni interval ${index + 1}: naziv`}
                      value={band.name}
                      onChange={(event) => updateBand(band.id, { name: event.target.value })}
                    />
                  </TD>
                  <TD className="px-3 py-1.5 align-middle">
                    {(() => {
                      const intervalValue = weightIntervalDrafts[band.id]
                        ?? formatShippingWeightIntervalGrams(band);
                      const intervalResult = parseShippingWeightIntervalGrams(intervalValue);
                      return (
                        <div className="grid gap-1">
                      <AdminUnitInput
                            unit="g"
                            className={intervalResult.ok ? undefined : '!border-rose-400'}
                            aria-label={`${band.name || `Masni interval ${index + 1}`}: matematično območje mase v gramih`}
                            aria-invalid={!intervalResult.ok}
                            title={intervalResult.ok ? intervalValue : intervalResult.message}
                            value={intervalValue}
                            placeholder="[5000, 30000)"
                            onChange={(event) => updateBandInterval(band, event.target.value)}
                            onBlur={() => {
                              const parsed = parseShippingWeightIntervalGrams(intervalValue);
                              if (!parsed.ok) return;
                              setWeightIntervalDrafts((current) => ({
                                ...current,
                                [band.id]: formatShippingWeightIntervalGrams(parsed)
                              }));
                            }}
                      />
                          {!intervalResult.ok ? (
                            <span className="text-[10px] leading-3 text-rose-600">
                              {intervalResult.message}
                            </span>
                          ) : null}
                        </div>
                      );
                    })()}
                  </TD>
                  <TD className="px-3 py-1.5 align-middle">
                    <AdminUnitInput
                      unit="€"
                      type="number"
                      min="0.01"
                      step="0.01"
                      aria-label={`${band.name || `Masni interval ${index + 1}`}: cena v evrih`}
                      value={getShippingNumericInputValue(
                        numericInputDrafts,
                        `weight-band:${band.id}:price`,
                        band.priceCents / 100
                      )}
                      onChange={(event) => {
                        const rawValue = event.target.value;
                        updateNumericInputDraft(`weight-band:${band.id}:price`, rawValue);
                        updateBand(band.id, {
                          priceCents: Math.round(numberInputOrZero(rawValue) * 100)
                        });
                      }}
                    />
                  </TD>
                  <TD className="px-3 py-1.5 text-center align-middle">
                    <span
                      className="inline-flex"
                      title={band.priceCents <= 0 ? 'Najprej vnesite pozitivno ceno.' : undefined}
                    >
                      <AdminSwitch
                        checked={band.enabled}
                        disabled={band.priceCents <= 0}
                        ariaLabel={`${band.name}: aktivno`}
                        onChange={(enabled) => updateBand(band.id, { enabled })}
                      />
                    </span>
                  </TD>
                  <TD className="px-3 py-1.5 align-middle">
                    <ShippingRowActions
                      label={band.name || `masni interval ${index + 1}`}
                      index={index}
                      count={configuration.weightBands.length}
                      onMove={(direction) => setConfiguration((current) => ({
                        ...current,
                        weightBands: reorder(current.weightBands, index, direction)
                      }))}
                      onRemove={() => {
                        setConfiguration((current) => ({
                          ...current,
                          weightBands: current.weightBands.filter((item) => item.id !== band.id)
                        }));
                        setWeightIntervalDrafts((current) => {
                          const next = { ...current };
                          delete next[band.id];
                          return next;
                        });
                        clearNumericInputDraftsForRule('weight-band', band.id);
                      }}
                    />
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </div>
      </section>

      <section
        className={compactRulePanelClassName}
        data-testid="shipping-dimensional-rules"
        aria-labelledby="shipping-dimensional-rules-heading"
      >
        <RulePanelHeading
          id="shipping-dimensional-rules-heading"
          title="Dodatek za večje dimenzije"
          description="Če ustreza več pravil, se uporabi prvo aktivno pravilo v tabeli."
          action={
            <AdminTablePrimaryActionButton
              type="button"
              onClick={() => setConfiguration((current) => ({
                ...current,
                dimensionalRules: [
                  ...current.dimensionalRules,
                  {
                    id: createId('dimension'),
                    name: 'Nov prag',
                    comparisonOperator: '>',
                    thresholdMm: 1000,
                    adjustmentType: 'fixed',
                    adjustmentValue: null,
                    enabled: false,
                    position: current.dimensionalRules.length
                  }
                ]
              }))}
            >
              Dodaj prag
            </AdminTablePrimaryActionButton>
          }
        />
        <div
          className="overflow-x-auto bg-white"
          role="region"
          aria-label="Dimenzijska pravila poštnine"
          tabIndex={0}
        >
          <Table className={shippingRuleTableClassName}>
            <caption className="sr-only">Nastavitve dodatkov za večje mere artiklov</caption>
            <THead>
              <TR className="hover:bg-transparent">
                <TH scope="col" className={shippingRuleNameColumnClassName}>Naziv</TH>
                <TH scope="col" className={shippingRuleConditionColumnClassName}>Največja dimenzija</TH>
                <TH scope="col" className={shippingRuleAdjustmentColumnClassName}>Dodatek</TH>
                <TH scope="col" className={shippingRuleEnabledColumnClassName}>Aktivno</TH>
                <TH scope="col" className={shippingRuleActionsColumnClassName}>Dejanja</TH>
              </TR>
            </THead>
            <TBody className="divide-y divide-slate-200 bg-white">
              {configuration.dimensionalRules.length === 0 ? (
                <TR className="hover:bg-white">
                  <TD colSpan={5} className="px-4 py-8">
                    <EmptyState title="Ni nastavljenih dimenzijskih pravil." />
                  </TD>
                </TR>
              ) : configuration.dimensionalRules.map((rule, index) => (
                <TR key={rule.id} className={`${adminTableRowHeightClassName} align-middle`}>
                  <TD className="px-3 py-1.5 align-middle">
                    <Input
                      className={tableInputClassName}
                      aria-label={`Dimenzijsko pravilo ${index + 1}: naziv`}
                      value={rule.name}
                      onChange={(event) => updateDimensionalRule(rule.id, {
                        name: event.target.value
                      })}
                    />
                  </TD>
                  <TD className="px-3 py-1.5 align-middle">
                    <AdminUnitInput
                      unit="mm"
                      prefixSelect={{
                        ariaLabel: `${rule.name || `Dimenzijsko pravilo ${index + 1}`}: operator primerjave`,
                        value: rule.comparisonOperator,
                        options: dimensionalComparisonOptions,
                        onChange: (comparisonOperator) => updateDimensionalRule(rule.id, {
                          comparisonOperator:
                            comparisonOperator as ShippingDimensionComparisonOperator
                        })
                      }}
                      type="number"
                      min="0.001"
                      step="0.001"
                      aria-label={`${rule.name || `Dimenzijsko pravilo ${index + 1}`}: prag v milimetrih`}
                      value={getShippingNumericInputValue(
                        numericInputDrafts,
                        `dimension:${rule.id}:threshold`,
                        rule.thresholdMm
                      )}
                      onChange={(event) => {
                        const rawValue = event.target.value;
                        updateNumericInputDraft(`dimension:${rule.id}:threshold`, rawValue);
                        updateDimensionalRule(rule.id, {
                          thresholdMm: numberInputOrZero(rawValue)
                        });
                      }}
                    />
                  </TD>
                  <TD className="px-3 py-1.5 align-middle">
                    <AdminUnitInput
                      suffixSelect={{
                        ariaLabel: `${rule.name || `Dimenzijsko pravilo ${index + 1}`}: vrsta dodatka`,
                        value: rule.adjustmentType,
                        options: dimensionalAdjustmentUnitOptions,
                        onChange: (adjustmentType) => {
                          clearNumericInputDraft(`dimension:${rule.id}:adjustment`);
                          updateDimensionalRule(rule.id, {
                            adjustmentType: adjustmentType as ShippingDimensionalRule['adjustmentType'],
                            adjustmentValue: null,
                            enabled: false
                          });
                        }
                      }}
                      className="min-w-0 max-w-[160px]"
                      type="number"
                      min={rule.adjustmentType === 'fixed' ? '0.01' : '0.1'}
                      step={rule.adjustmentType === 'fixed' ? '0.01' : '0.1'}
                      aria-label={`${rule.name || `Dimenzijsko pravilo ${index + 1}`}: vrednost dodatka v ${rule.adjustmentType === 'fixed' ? 'evrih' : 'odstotkih'}`}
                      value={getShippingNumericInputValue(
                        numericInputDrafts,
                        `dimension:${rule.id}:adjustment`,
                        rule.adjustmentValue === null
                          ? ''
                          : rule.adjustmentType === 'fixed'
                            ? rule.adjustmentValue / 100
                            : rule.adjustmentValue
                      )}
                      placeholder="Ni določeno"
                      onChange={(event) => {
                        const rawValue = event.target.value;
                        updateNumericInputDraft(`dimension:${rule.id}:adjustment`, rawValue);
                        updateDimensionalRule(rule.id, {
                          adjustmentValue: rule.adjustmentType === 'fixed'
                            ? Math.round(numberInputOrZero(rawValue) * 100)
                            : numberInputOrZero(rawValue)
                        });
                      }}
                    />
                  </TD>
                  <TD className="px-3 py-1.5 text-center align-middle">
                    <span
                      className="inline-flex"
                      title={
                        rule.adjustmentValue === null || rule.adjustmentValue <= 0
                          ? 'Najprej vnesite pozitivno vrednost dodatka.'
                          : undefined
                      }
                    >
                      <AdminSwitch
                        checked={rule.enabled}
                        disabled={rule.adjustmentValue === null || rule.adjustmentValue <= 0}
                        ariaLabel={`${rule.name}: aktivno`}
                        onChange={(enabled) => updateDimensionalRule(rule.id, {
                          enabled
                        })}
                      />
                    </span>
                  </TD>
                  <TD className="px-3 py-1.5 align-middle">
                    <ShippingRowActions
                      label={rule.name || `dimenzijsko pravilo ${index + 1}`}
                      index={index}
                      count={configuration.dimensionalRules.length}
                      onMove={(direction) => setConfiguration((current) => ({
                        ...current,
                        dimensionalRules: reorder(current.dimensionalRules, index, direction)
                      }))}
                      onRemove={() => {
                        setConfiguration((current) => ({
                          ...current,
                          dimensionalRules: current.dimensionalRules.filter(
                            (item) => item.id !== rule.id
                          )
                        }));
                        clearNumericInputDraftsForRule('dimension', rule.id);
                      }}
                    />
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </div>
      </section>

      <section
        className={compactRulePanelClassName}
        data-testid="shipping-order-value-discounts"
        aria-labelledby="shipping-order-value-discounts-heading"
      >
        <RulePanelHeading
          id="shipping-order-value-discounts-heading"
          title="Popust glede na vrednost naročila"
          description="Med aktivnimi pogoji, ki veljajo za vrednost blaga z DDV po drugih popustih in pred poštnino, se uporabi pogoj z najvišjo mejno vrednostjo."
          action={
            <AdminTablePrimaryActionButton
              type="button"
              onClick={() => setConfiguration((current) => ({
                ...current,
                orderValueDiscountRules: [
                  ...current.orderValueDiscountRules,
                  {
                    id: createId('order-value'),
                    name: 'Nov vrednostni prag',
                    comparisonOperator: '>=',
                    minMerchandiseValueCents: 0,
                    adjustmentType: 'percentage',
                    adjustmentValue: null,
                    enabled: false,
                    position: current.orderValueDiscountRules.length
                  }
                ]
              }))}
            >
              Dodaj prag
            </AdminTablePrimaryActionButton>
          }
        />
        <div
          className="overflow-x-auto bg-white"
          role="region"
          aria-label="Popusti glede na vrednost naročila"
          tabIndex={0}
        >
          <Table className={shippingRuleTableClassName}>
            <caption className="sr-only">Pragovi popusta glede na vrednost blaga z DDV</caption>
            <THead>
              <TR className="hover:bg-transparent">
                <TH scope="col" className={shippingRuleNameColumnClassName}>Naziv</TH>
                <TH scope="col" className={shippingRuleConditionColumnClassName}>Pogoj vrednosti blaga</TH>
                <TH scope="col" className={shippingRuleAdjustmentColumnClassName}>Popust</TH>
                <TH scope="col" className={shippingRuleEnabledColumnClassName}>Aktivno</TH>
                <TH scope="col" className={shippingRuleActionsColumnClassName}>Dejanja</TH>
              </TR>
            </THead>
            <TBody className="divide-y divide-slate-200 bg-white">
              {configuration.orderValueDiscountRules.length === 0 ? (
                <TR className="hover:bg-white">
                  <TD colSpan={5} className="px-4 py-8">
                    <EmptyState title="Ni nastavljenih vrednostnih pragov." />
                  </TD>
                </TR>
              ) : configuration.orderValueDiscountRules.map((rule, index) => {
                const label = rule.name || `Vrednostni prag ${index + 1}`;
                const adjustmentIsValid = hasValidDiscountAdjustment(rule);
                return (
                  <TR key={rule.id} className={`${adminTableRowHeightClassName} align-middle`}>
                    <TD className="px-3 py-1.5 align-middle">
                      <Input
                        className={tableInputClassName}
                        aria-label={`Vrednostni prag ${index + 1}: naziv`}
                        value={rule.name}
                        onChange={(event) => updateOrderValueDiscountRule(rule.id, {
                          name: event.target.value
                        })}
                      />
                    </TD>
                    <TD className="px-3 py-1.5 align-middle">
                      <AdminUnitInput
                        unit="€"
                        prefixSelect={{
                          ariaLabel: `${label}: operator primerjave vrednosti blaga z DDV`,
                          value: rule.comparisonOperator,
                          options: dimensionalComparisonOptions,
                          onChange: (comparisonOperator) => updateOrderValueDiscountRule(rule.id, {
                            comparisonOperator:
                              comparisonOperator as ShippingDimensionComparisonOperator
                          })
                        }}
                        type="number"
                        min="0"
                        step="0.01"
                        aria-label={`${label}: mejna vrednost blaga z DDV v evrih`}
                        value={getShippingNumericInputValue(
                          numericInputDrafts,
                          `order-value:${rule.id}:minimum`,
                          rule.minMerchandiseValueCents / 100
                        )}
                        onChange={(event) => {
                          const rawValue = event.target.value;
                          updateNumericInputDraft(`order-value:${rule.id}:minimum`, rawValue);
                          updateOrderValueDiscountRule(rule.id, {
                            minMerchandiseValueCents: Math.max(
                              0,
                              Math.round(numberInputOrZero(rawValue) * 100)
                            )
                          });
                        }}
                      />
                    </TD>
                    <TD className="px-3 py-1.5 align-middle">
                      <AdminUnitInput
                        suffixSelect={{
                          ariaLabel: `${label}: vrsta popusta`,
                          value: rule.adjustmentType,
                          options: dimensionalAdjustmentUnitOptions,
                          onChange: (adjustmentType) => {
                            clearNumericInputDraft(`order-value:${rule.id}:adjustment`);
                            updateOrderValueDiscountRule(rule.id, {
                              adjustmentType: adjustmentType as ShippingOrderValueDiscountRule['adjustmentType'],
                              adjustmentValue: null,
                              enabled: false
                            });
                          }
                        }}
                        className="min-w-0 max-w-[160px]"
                        type="number"
                        min={rule.adjustmentType === 'fixed' ? '0.01' : '0.1'}
                        max={rule.adjustmentType === 'percentage' ? '100' : undefined}
                        step={rule.adjustmentType === 'fixed' ? '0.01' : '0.1'}
                        aria-label={`${label}: vrednost popusta v ${rule.adjustmentType === 'fixed' ? 'evrih' : 'odstotkih'}`}
                        value={getShippingNumericInputValue(
                          numericInputDrafts,
                          `order-value:${rule.id}:adjustment`,
                          rule.adjustmentValue === null
                            ? ''
                            : rule.adjustmentType === 'fixed'
                              ? rule.adjustmentValue / 100
                              : rule.adjustmentValue
                        )}
                        placeholder="Ni določeno"
                        onChange={(event) => {
                          const rawValue = event.target.value;
                          updateNumericInputDraft(`order-value:${rule.id}:adjustment`, rawValue);
                          updateOrderValueDiscountRule(rule.id, {
                            adjustmentValue: rule.adjustmentType === 'fixed'
                              ? Math.round(numberInputOrZero(rawValue) * 100)
                              : numberInputOrZero(rawValue)
                          });
                        }}
                      />
                    </TD>
                    <TD className="px-3 py-1.5 text-center align-middle">
                      <span
                        className="inline-flex"
                        title={adjustmentIsValid ? undefined : 'Vnesite veljaven pozitiven popust.'}
                      >
                        <AdminSwitch
                          checked={rule.enabled}
                          disabled={!adjustmentIsValid}
                          ariaLabel={`${label}: aktivno`}
                          onChange={(enabled) => updateOrderValueDiscountRule(rule.id, {
                            enabled
                          })}
                        />
                      </span>
                    </TD>
                    <TD className="px-3 py-1.5 align-middle">
                      <ShippingDeleteAction
                        label={label}
                        onRemove={() => {
                          setConfiguration((current) => ({
                            ...current,
                            orderValueDiscountRules: current.orderValueDiscountRules.filter(
                              (item) => item.id !== rule.id
                            )
                          }));
                          clearNumericInputDraftsForRule('order-value', rule.id);
                        }}
                      />
                    </TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
        </div>
      </section>

      <section
        className={compactRulePanelClassName}
        data-testid="shipping-multi-piece-discounts"
        aria-labelledby="shipping-multi-piece-discounts-heading"
      >
        <RulePanelHeading
          id="shipping-multi-piece-discounts-heading"
          title="Popust za pošiljanje v več kosih"
          description="Pri skupaj oddanih paketih se uporabi najvišji aktivni prag, ki ga doseže število paketov."
          action={
            <AdminTablePrimaryActionButton
              type="button"
              onClick={() => setConfiguration((current) => {
                const highestMinimum = Math.max(
                  1,
                  ...current.multiPieceDiscountRules.map((rule) => rule.minParcelCount)
                );
                return {
                  ...current,
                  multiPieceDiscountRules: [
                    ...current.multiPieceDiscountRules,
                    {
                      id: createId('multi-piece'),
                      name: 'Nov večkosovni prag',
                      minParcelCount: Math.min(
                        SHIPPING_MAX_PARCEL_COUNT,
                        highestMinimum + 1
                      ),
                      adjustmentType: 'percentage',
                      adjustmentValue: 50,
                      enabled: false,
                      position: current.multiPieceDiscountRules.length
                    }
                  ]
                };
              })}
            >
              Dodaj prag
            </AdminTablePrimaryActionButton>
          }
        />
        <div
          className="overflow-x-auto bg-white pb-4"
          role="region"
          aria-label="Popusti za pošiljanje v več kosih"
          tabIndex={0}
        >
          <Table className={shippingRuleTableClassName}>
            <caption className="sr-only">Pragovi popusta glede na število skupaj oddanih paketov</caption>
            <THead>
              <TR className="hover:bg-transparent">
                <TH scope="col" className={shippingRuleNameColumnClassName}>Naziv</TH>
                <TH scope="col" className={shippingRuleConditionColumnClassName}>Najmanj paketov</TH>
                <TH scope="col" className={shippingRuleAdjustmentColumnClassName}>Popust na paket</TH>
                <TH scope="col" className={shippingRuleEnabledColumnClassName}>Aktivno</TH>
                <TH scope="col" className={shippingRuleActionsColumnClassName}>Dejanja</TH>
              </TR>
            </THead>
            <TBody className="divide-y divide-slate-200 bg-white">
              {configuration.multiPieceDiscountRules.length === 0 ? (
                <TR className="hover:bg-white">
                  <TD colSpan={5} className="px-4 py-8">
                    <EmptyState title="Ni nastavljenih večkosovnih pragov." />
                  </TD>
                </TR>
              ) : configuration.multiPieceDiscountRules.map((rule, index) => {
                const label = rule.name || `Večkosovni prag ${index + 1}`;
                const adjustmentIsValid = hasValidDiscountAdjustment(rule);
                return (
                  <TR key={rule.id} className={`${adminTableRowHeightClassName} align-middle`}>
                    <TD className="px-3 py-1.5 align-middle">
                      <Input
                        className={tableInputClassName}
                        aria-label={`Večkosovni prag ${index + 1}: naziv`}
                        value={rule.name}
                        onChange={(event) => updateMultiPieceDiscountRule(rule.id, {
                          name: event.target.value
                        })}
                      />
                    </TD>
                    <TD className="px-3 py-1.5 align-middle">
                      <AdminUnitInput
                        unit="pak."
                        type="number"
                        min="2"
                        max={SHIPPING_MAX_PARCEL_COUNT}
                        step="1"
                        aria-label={`${label}: najmanjše število paketov`}
                        value={getShippingNumericInputValue(
                          numericInputDrafts,
                          `multi-piece:${rule.id}:minimum`,
                          rule.minParcelCount
                        )}
                        onChange={(event) => {
                          const rawValue = event.target.value;
                          updateNumericInputDraft(`multi-piece:${rule.id}:minimum`, rawValue);
                          updateMultiPieceDiscountRule(rule.id, {
                            minParcelCount: rawValue === ''
                              ? 0
                              : Math.min(
                                  SHIPPING_MAX_PARCEL_COUNT,
                                  Math.max(2, Math.trunc(numberInputOrZero(rawValue)))
                                )
                          });
                        }}
                      />
                    </TD>
                    <TD className="px-3 py-1.5 align-middle">
                      <AdminUnitInput
                        suffixSelect={{
                          ariaLabel: `${label}: vrsta popusta`,
                          value: rule.adjustmentType,
                          options: dimensionalAdjustmentUnitOptions,
                          onChange: (adjustmentType) => {
                            clearNumericInputDraft(`multi-piece:${rule.id}:adjustment`);
                            updateMultiPieceDiscountRule(rule.id, {
                              adjustmentType: adjustmentType as ShippingMultiPieceDiscountRule['adjustmentType'],
                              adjustmentValue: null,
                              enabled: false
                            });
                          }
                        }}
                        className="min-w-0 max-w-[160px]"
                        type="number"
                        min={rule.adjustmentType === 'fixed' ? '0.01' : '0.1'}
                        max={rule.adjustmentType === 'percentage' ? '100' : undefined}
                        step={rule.adjustmentType === 'fixed' ? '0.01' : '0.1'}
                        aria-label={`${label}: vrednost popusta na paket v ${rule.adjustmentType === 'fixed' ? 'evrih' : 'odstotkih'}`}
                        value={getShippingNumericInputValue(
                          numericInputDrafts,
                          `multi-piece:${rule.id}:adjustment`,
                          rule.adjustmentValue === null
                            ? ''
                            : rule.adjustmentType === 'fixed'
                              ? rule.adjustmentValue / 100
                              : rule.adjustmentValue
                        )}
                        placeholder="Ni določeno"
                        onChange={(event) => {
                          const rawValue = event.target.value;
                          updateNumericInputDraft(`multi-piece:${rule.id}:adjustment`, rawValue);
                          updateMultiPieceDiscountRule(rule.id, {
                            adjustmentValue: rule.adjustmentType === 'fixed'
                              ? Math.round(numberInputOrZero(rawValue) * 100)
                              : numberInputOrZero(rawValue)
                          });
                        }}
                      />
                    </TD>
                    <TD className="px-3 py-1.5 text-center align-middle">
                      <span
                        className="inline-flex"
                        title={adjustmentIsValid ? undefined : 'Vnesite veljaven pozitiven popust.'}
                      >
                        <AdminSwitch
                          checked={rule.enabled}
                          disabled={!adjustmentIsValid}
                          ariaLabel={`${label}: aktivno`}
                          onChange={(enabled) => updateMultiPieceDiscountRule(rule.id, {
                            enabled
                          })}
                        />
                      </span>
                    </TD>
                    <TD className="px-3 py-1.5 align-middle">
                      <ShippingDeleteAction
                        label={label}
                        onRemove={() => {
                          setConfiguration((current) => ({
                            ...current,
                            multiPieceDiscountRules: current.multiPieceDiscountRules.filter(
                              (item) => item.id !== rule.id
                            )
                          }));
                          clearNumericInputDraftsForRule('multi-piece', rule.id);
                        }}
                      />
                    </TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
        </div>
      </section>
        </div>
      </section>

      <div className="min-w-0">
        <section
          className={`${adminWindowCardClassName} min-[1180px]:sticky min-[1180px]:top-4 min-[1180px]:h-full min-[1180px]:max-h-[calc(100vh-2rem)] min-[1180px]:!overflow-y-auto`}
          style={adminWindowCardStyle}
          data-testid="shipping-preview"
          aria-labelledby="shipping-preview-heading"
        >
        <SectionHeading
          id="shipping-preview-heading"
          title="Simulator poštnine"
          description="Simulator uporablja isti domenski kalkulator kot košarica. Vrednost blaga vključuje DDV in druge popuste, ne pa poštnine."
        />
        <div className="grid items-stretch gap-4 p-4 sm:p-5">
          <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-4">
            <h3 className="text-sm font-semibold text-slate-900">Vhodni podatki</h3>
            <p className="mt-1 text-[11px] font-medium leading-4 text-slate-500">
              Masa je vsota vseh kosov; dimenzija je najdaljša stran enega artikla. Paketi so fizični kosi, oddani skupaj.
            </p>
            <div
              className="mt-4 grid max-w-[220px] items-end gap-3 sm:max-w-[452px] sm:grid-cols-2"
              data-testid="shipping-preview-inputs"
            >
              <label className="grid min-w-0 content-start gap-1 text-[11px] font-semibold text-slate-600">
                Skupna masa
                <AdminUnitInput
                  unit="g"
                  className="h-9 w-full"
                  inputClassName="leading-[36px]"
                  type="number"
                  min="1"
                  step="1"
                  value={previewWeightGramsInput}
                  onChange={(event) => setPreviewWeightGramsInput(event.target.value)}
                />
              </label>
              <label className="grid min-w-0 content-start gap-1 text-[11px] font-semibold text-slate-600">
                Največja posamezna dimenzija
                <AdminUnitInput
                  unit="mm"
                  className="h-9 w-full"
                  inputClassName="leading-[36px]"
                  type="number"
                  min="0.001"
                  step="0.001"
                  value={previewLargestDimensionMmInput}
                  onChange={(event) => setPreviewLargestDimensionMmInput(event.target.value)}
                />
              </label>
              <label className="grid min-w-0 content-start gap-1 text-[11px] font-semibold text-slate-600">
                Vrednost blaga z DDV
                <AdminUnitInput
                  unit="€"
                  className="h-9 w-full"
                  inputClassName="leading-[36px]"
                  type="number"
                  min="0"
                  step="0.01"
                  value={previewMerchandiseSubtotalEurosInput}
                  onChange={(event) => setPreviewMerchandiseSubtotalEurosInput(
                    event.target.value
                  )}
                />
              </label>
              <label className="grid min-w-0 content-start gap-1 text-[11px] font-semibold text-slate-600">
                Število paketov
                <AdminUnitInput
                  unit="pak."
                  className="h-9 w-full"
                  inputClassName="leading-[36px]"
                  type="number"
                  min="1"
                  max={SHIPPING_MAX_PARCEL_COUNT}
                  step="1"
                  value={previewParcelCountInput}
                  onChange={(event) => setPreviewParcelCountInput(event.target.value)}
                />
              </label>
            </div>
          </div>

          <div className="min-w-0" aria-live="polite" aria-atomic="true">
            {preview.status === 'manual_quote' ? (
              <div className="flex h-full min-h-[210px] flex-col overflow-hidden rounded-lg border border-amber-200 bg-white">
                <div className="flex items-start justify-between gap-4 border-b border-amber-100 px-4 py-3">
                  <div>
                    <Badge variant="warning" size="sm">Ročna ponudba</Badge>
                    <p className="mt-2 text-base font-semibold text-slate-900">Poštnina po dogovoru</p>
                  </div>
                  <span className="text-right text-[11px] font-medium text-slate-500">
                    Konfiguracija {preview.configurationVersion}
                  </span>
                </div>
                <div className="flex flex-1 items-center p-4">
                  <p className="w-full rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] font-medium leading-5 text-amber-900">
                    {preview.reason}
                  </p>
                </div>
              </div>
            ) : (
              <div
                className="h-full rounded-2xl border border-slate-200 bg-white p-4"
                data-testid="shipping-preview-calculated-result"
              >
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-[12px] font-semibold leading-4 text-slate-950">Podrobnosti</h3>
                  <Badge variant="success" size="sm">Samodejni izračun</Badge>
                </div>
                <dl className="mt-2">
                  <ShippingPreviewSummaryRow
                    label="Skupna masa"
                    value={`${preview.combinedWeightGrams} g`}
                    variant="detail"
                  />
                  <ShippingPreviewSummaryRow
                    label="Največja posamezna dimenzija"
                    value={`${preview.largestDimensionMm} mm`}
                    variant="detail"
                    divider
                  />
                  <ShippingPreviewSummaryRow
                    label="Vrednost blaga z DDV"
                    value={formatCents(preview.merchandiseSubtotalCents)}
                    variant="detail"
                    divider
                  />
                  <ShippingPreviewSummaryRow
                    label="Število paketov"
                    value={String(preview.parcelCount)}
                    variant="detail"
                    divider
                  />
                </dl>

                <div className="mt-3 border-t border-slate-200/90 pt-3">
                  <h3 className="text-[12px] font-semibold leading-4 text-slate-950">Izračun</h3>
                  <dl className="mt-1.5">
                    <ShippingPreviewSummaryRow
                      label="Osnovna poštnina"
                      detail={preview.matchedWeightBand.name}
                      value={formatCents(preview.basePriceCents)}
                    />
                    <ShippingPreviewSummaryRow
                      label="Dodatek za večje dimenzije"
                      detail={
                        preview.matchedDimensionalRule
                          ? `${preview.matchedDimensionalRule.name} · ${formatAdjustmentValue(preview.matchedDimensionalRule)}`
                          : undefined
                      }
                      value={
                        preview.matchedDimensionalRule
                          ? formatCents(preview.surchargeAmountCents)
                          : 'Brez dodatka'
                      }
                    />
                    <ShippingPreviewSummaryRow
                      label="Poštnina na paket (S)"
                      value={formatCents(preview.singleParcelAmountCents)}
                    />
                    {preview.parcelCount > 1 ? (
                      <>
                        <ShippingPreviewSummaryRow
                          label={`${preview.parcelCount} paketov pred popustom`}
                          value={formatCents(preview.parcelCountGrossAmountCents)}
                        />
                        <ShippingPreviewSummaryRow
                          label="Popust za pošiljanje v več kosih"
                          detail={
                            preview.matchedMultiPieceDiscountRule
                              ? `od ${preview.matchedMultiPieceDiscountRule.minParcelCount} paketov · ${formatAdjustmentValue(preview.matchedMultiPieceDiscountRule)} na paket`
                              : undefined
                          }
                          value={
                            preview.multiPieceDiscountAmountCents > 0
                              ? `−${formatCents(preview.multiPieceDiscountAmountCents)}`
                              : 'Brez popusta'
                          }
                        />
                        <ShippingPreviewSummaryRow
                          label="Po večkosovnem popustu"
                          value={formatCents(preview.afterMultiPieceAmountCents)}
                        />
                      </>
                    ) : null}
                    <ShippingPreviewSummaryRow
                      label="Popust glede na vrednost naročila"
                      detail={
                        preview.matchedOrderValueDiscountRule
                          ? `${preview.matchedOrderValueDiscountRule.name} · ${formatAdjustmentValue(preview.matchedOrderValueDiscountRule)}`
                          : undefined
                      }
                      value={
                        preview.orderValueDiscountAmountCents > 0
                          ? `−${formatCents(preview.orderValueDiscountAmountCents)}`
                          : 'Brez popusta'
                      }
                    />
                  </dl>
                  <ol
                    className="mt-2 grid list-decimal gap-1.5 rounded-lg border border-slate-200/90 bg-slate-50/70 py-2.5 pl-8 pr-3 text-[11px] font-semibold leading-5 tabular-nums text-slate-600 marker:text-slate-400"
                    data-testid="shipping-preview-calculation-breakdown"
                    aria-label="Matematični koraki izračuna poštnine"
                  >
                    {buildShippingCalculationSteps(preview).map((step) => (
                      <li
                        key={step.id}
                        className="min-w-0 [overflow-wrap:anywhere]"
                        data-shipping-formula-step={step.id}
                      >
                        {step.formula}
                      </li>
                    ))}
                  </ol>
                </div>

                <div className="mt-3 flex items-center justify-between gap-4 border-t border-slate-200/90 pt-3">
                  <p className="min-w-0 text-left text-[15px] font-semibold leading-5 text-[#1982bf]">
                    Končna poštnina
                  </p>
                  <p className="shrink-0 text-right text-[18px] font-semibold leading-6 text-[#1982bf]">
                    {formatCents(preview.finalAmountCents)}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
        </section>
      </div>
      </div>
    </fieldset>
  );
}
