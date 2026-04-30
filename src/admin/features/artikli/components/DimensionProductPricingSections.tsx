'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Button } from '@/shared/ui/button';
import { Chip, type BadgeVariant } from '@/shared/ui/badge';
import { AdminCheckbox } from '@/shared/ui/checkbox';
import { IconButton } from '@/shared/ui/icon-button';
import { PlusIcon, TrashCanIcon } from '@/shared/ui/icons/AdminActionIcons';
import { CustomSelect } from '@/shared/ui/select';
import { adminStatusInfoPillCompactTableClassName } from '@/shared/ui/theme/tokens';
import ActiveStateChip from '@/admin/features/artikli/components/ActiveStateChip';
import { NoteTagChip, type NoteTag } from '@/admin/features/artikli/components/NoteTagChip';
import {
  compactTableAdornmentClassName,
  compactTableAlignedInputClassName,
  compactTableValueUnitShellClassName
} from '@/admin/features/artikli/components/artikliFieldStyles';
import {
  adminTableBodyCellCenterClassName,
  adminTableBodyCellLeftClassName,
  adminTableHeaderCellCenterClassName,
  adminTableHeaderCellLeftClassName,
  adminTableInlineEditInputClassName,
  adminTableNeutralIconButtonClassName,
  adminTablePrimaryButtonClassName,
  adminTableRowHeightClassName,
  adminTableSelectedDangerIconButtonClassName,
  adminWindowCardClassName,
  adminWindowCardStyle
} from '@/shared/ui/admin-table';
import {
  createVariant,
  formatCurrency,
  type Variant
} from '@/admin/features/artikli/lib/familyModel';
import { formatDecimalForDisplay, formatDecimalForSku, parseDecimalInput, parseDecimalListInput } from '@/admin/features/artikli/lib/decimalFormat';

const classNames = (...parts: Array<string | false | null | undefined>) => parts.filter(Boolean).join(' ');

const sectionTitleClassName = 'text-[20px] font-semibold tracking-tight text-slate-900';
const fieldFrameClassName =
  'h-9 w-full rounded-md border border-slate-300 bg-white px-2.5 text-[13px] text-slate-900 outline-none transition focus:border-[#3e67d6] focus:ring-0 disabled:cursor-not-allowed disabled:bg-[color:var(--field-locked-bg)] disabled:text-slate-500';
const smallLabelClassName = 'mb-1 block text-[12px] font-semibold text-slate-700';
const inlineSnippetClassName = 'rounded bg-[#1982bf1a] px-1 py-0.5 font-mono text-[11px] text-[#1982bf]';
const fieldUnitAdornmentClassName = 'inline-flex h-full shrink-0 items-center justify-center whitespace-nowrap border-l border-slate-200 px-2 text-[12px] font-medium text-slate-500';
const fieldUnitInputClassName = 'h-full shrink-0 border-0 border-l border-slate-200 bg-transparent px-2 text-center text-[12px] font-medium text-slate-500 outline-none focus:ring-0 disabled:cursor-not-allowed disabled:bg-[color:var(--field-locked-bg)] disabled:text-slate-500';
export const adminProductInputChipClassName = 'inline-flex h-5 items-center gap-1 rounded-md border border-[#b9d4fb] bg-[#f3f8fc] px-1.5 text-[11px] font-semibold text-[#1982bf]';
const tableHeaderClassName = 'px-3 py-2 text-left font-semibold text-slate-700';
const tableCellClassName = 'px-3 py-2 align-middle';
const defaultVatRate = 0.22;
const defaultVatMultiplier = 1 + defaultVatRate;
const toGrossWithVat = (value: number) => Number((Math.max(0, value) * defaultVatMultiplier).toFixed(4));
const toNetFromGross = (value: number) => Number((Math.max(0, value) / defaultVatMultiplier).toFixed(4));

export type ProductEditorType = 'simple' | 'dimensions' | 'weight' | 'unique_machine';

export type QuantityDiscountDraft = {
  id: string;
  persistedId?: number;
  minQuantity: number;
  discountPercent: number;
  appliesTo: 'allVariants';
  variantTargets: string[];
  customerTargets: string[];
  note: string;
  position: number;
};

type QuantityDiscountInput = {
  id?: number;
  minQuantity?: number | null;
  discountPercent?: number | null;
  appliesTo?: string | null;
  note?: string | null;
  position?: number | null;
};

export type MachineSpecRow = {
  id: string;
  property: string;
  value: string;
};

type MachineSerialStatus = 'in_stock' | 'sold' | 'reserved' | 'service';

type MachineSerialRow = {
  id: string;
  serialNumber: string;
  status: MachineSerialStatus;
  orderReference: string;
  shippedAt: string;
};

export type MachineSerialOrderMatch = {
  orderId: number;
  orderNumber: string;
  orderStatus: string;
  orderCreatedAt: string;
  orderItemId: number;
  orderItemSku: string;
  orderItemName: string;
  quantity: number;
  shippedAt: string | null;
};

type MachineSerialOrderAllocation = {
  orderId: number;
  orderNumber: string;
  orderStatus: string;
  shippedAt: string | null;
  orderCreatedAt: string;
  searchText: string;
};

export type SimpleProductData = {
  basePrice: number;
  actionPrice: number;
  actionPriceEnabled: boolean;
  stock: number;
  minStock: number;
  deliveryTime: string;
  moq: number;
  warehouseLocation: string;
  saleStatus: 'active' | 'inactive';
  visibleInStore: boolean;
  showAsNew: boolean;
  requireInstructions: boolean;
  basicInfoRows: MachineSpecRow[];
  technicalSpecs: MachineSpecRow[];
};

export type WeightVariantDraft = {
  id: string;
  type: string;
  packaging: string;
  fraction: string;
  color: string;
  netMassKg: number | null;
  pricePerKg: number;
  packagingCostPerBag: number;
  minQuantity: number;
  orderStep: number;
  stockKg: number;
  deliveryTime: string;
  sku: string;
  active: boolean;
  note: string;
  position: number;
};

export type WeightMaterialStockDraft = {
  id: string;
  fraction: string;
  color: string;
  stockKg: number;
  reservedKg: number;
  deliveryTime: string;
  position: number;
};

export type WeightFractionPricingDraft = {
  id: string;
  fraction: string;
  pricePerKg: number;
  packagingCostPerBag: number;
  position: number;
};

export type WeightProductData = {
  pricePerKg: number;
  packagingCostPerBag: number;
  minQuantity: number;
  density: string;
  fraction: string;
  netMassKg: number;
  orderStep: number;
  stockKg: number;
  deliveryTime: string;
  bulkSale: boolean;
  packagingChips: string[];
  fractionChips: string[];
  orderStepChips: string[];
  fractionPricing: WeightFractionPricingDraft[];
  materialStocks: WeightMaterialStockDraft[];
  variants: WeightVariantDraft[];
};

export type UniqueMachineProductData = {
  basePrice: number;
  discountPercent: number;
  stock: number;
  serialTrackingRequired: boolean;
  warrantyLabel: string;
  warrantyMonths: string;
  serviceIntervalLabel: string;
  serviceIntervalMonths: string;
  deliveryTime: string;
  packageWeightKg: number;
  packageDimensions: string;
  transportClass: string;
  warnings: string;
  basicInfoRows: MachineSpecRow[];
  serialNumbers: MachineSerialRow[];
  specs: MachineSpecRow[];
  includedItems: string[];
};

export type UniversalProductSpecificData = {
  simple: SimpleProductData;
  weight: WeightProductData;
  uniqueMachine: UniqueMachineProductData;
  dimensions?: Record<string, unknown>;
};

export type SimulatorOption = {
  id: string;
  label: string;
  basePrice: number;
  quantityUnit: string;
  targetKey?: string;
  summaryLabel?: string;
  discountUnitLabel?: string;
  stockLabel?: string;
  minOrderLabel?: string;
  serialLabels?: string[];
  weightFraction?: string;
  weightNetMassKg?: number;
  weightBagCount?: number;
  weightPricePerKg?: number;
  weightPackagingCostPerBag?: number;
};

type OrderSummaryIconType = 'document' | 'scale' | 'bag' | 'quantity' | 'discount' | 'stock' | 'boxes' | 'layers' | 'layersMinus' | 'variant' | 'box' | 'calculator' | 'simple' | 'dimensions' | 'weightGranules' | 'uniqueMachine';

type OrderSummaryDetailRow = {
  icon: OrderSummaryIconType;
  label: string;
  description?: string;
  value: string;
};

type OrderSummaryCalculationRow = {
  label: string;
  detail?: string;
  value: string;
  tone?: 'default' | 'success';
  strong?: boolean;
};

type SimulatorNextDiscountLabel = {
  value: string;
  topReached: boolean;
};

type ProductDataContext = {
  variants?: Variant[];
  baseSku?: string | null;
};

const defaultQuantityDiscountRows: QuantityDiscountInput[] = [
  { minQuantity: 1, discountPercent: 0, appliesTo: 'allVariants', note: '', position: 0 },
  { minQuantity: 10, discountPercent: 3, appliesTo: 'allVariants', note: '', position: 1 },
  { minQuantity: 25, discountPercent: 5, appliesTo: 'allVariants', note: '', position: 2 },
  { minQuantity: 50, discountPercent: 8, appliesTo: 'allVariants', note: '', position: 3 }
];

const allDiscountTargetLabel = 'Vse';

const defaultSimpleProductData: SimpleProductData = {
  basePrice: 18.9,
  actionPrice: 15.9,
  actionPriceEnabled: false,
  stock: 0,
  minStock: 0,
  deliveryTime: '2-3 dni',
  moq: 1,
  warehouseLocation: 'Skladišče Ljubljana',
  saleStatus: 'active',
  visibleInStore: true,
  showAsNew: false,
  requireInstructions: false,
  basicInfoRows: [],
  technicalSpecs: []
};

const defaultWeightProductData: WeightProductData = {
  pricePerKg: 0.185,
  packagingCostPerBag: 0.125,
  minQuantity: 1,
  density: '1,60 t/m3',
  fraction: '0-2 mm',
  netMassKg: 25,
  orderStep: 0.5,
  stockKg: 25000,
  deliveryTime: '1-2 delovna dneva',
  bulkSale: true,
  packagingChips: ['fr:0-2', 'kg:0,5', 'kg:1', 'kg:2'],
  fractionChips: ['0-2 mm'],
  orderStepChips: ['0,5 kg'],
  fractionPricing: [],
  materialStocks: [],
  variants: []
};

const defaultMachineProductData: UniqueMachineProductData = {
  basePrice: 329,
  discountPercent: 0,
  stock: 1,
  serialTrackingRequired: true,
  warrantyLabel: 'Garancija',
  warrantyMonths: '24',
  serviceIntervalLabel: 'Servisni interval',
  serviceIntervalMonths: '12',
  deliveryTime: '1-2 delovna dneva',
  packageWeightKg: 8.2,
  packageDimensions: '620 x 380 x 330 mm',
  transportClass: 'M',
  warnings: 'Lomljivi deli pri neustrezni uporabi.\nUporabljajte zaščitna očala.',
  basicInfoRows: [],
  serialNumbers: [],
  specs: [
    { id: 'spec-power', property: 'Moč', value: '205 W' },
    { id: 'spec-voltage', property: 'Napajanje', value: '230 V / 50 Hz' },
    { id: 'spec-weight', property: 'Teža', value: '7,0 kg' }
  ],
  includedItems: ['1 x osnovna enota', '1 x navodila za uporabo']
};

const machineSerialStatusOptions: Array<{ value: MachineSerialStatus; label: string }> = [
  { value: 'in_stock', label: 'Na zalogi' },
  { value: 'sold', label: 'Prodano' },
  { value: 'reserved', label: 'Rezervirano' },
  { value: 'service', label: 'Na servisu' }
];

const machineSerialStatusVariant: Record<MachineSerialStatus, BadgeVariant> = {
  in_stock: 'neutral',
  sold: 'success',
  reserved: 'warning',
  service: 'info'
};

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function asString(value: unknown, fallback = '') {
  return typeof value === 'string' ? value : fallback;
}

function asBoolean(value: unknown, fallback: boolean) {
  return typeof value === 'boolean' ? value : fallback;
}

function asNumber(value: unknown, fallback: number) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = parseDecimalInput(value);
    if (parsed !== null) return parsed;
  }
  return fallback;
}

function asStringArray(value: unknown, fallback: string[]) {
  return Array.isArray(value)
    ? value.map((entry) => String(entry).trim()).filter(Boolean)
    : fallback;
}

function createLocalId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

function normalizeSpecRows(value: unknown, fallback: MachineSpecRow[], idPrefix: string) {
  return Array.isArray(value)
    ? value.map((entry, index) => {
        const spec = asRecord(entry);
        return {
          id: asString(spec.id, `${idPrefix}-${index}`),
          property: asString(spec.property, ''),
          value: asString(spec.value, '')
        };
      }).filter((entry) => entry.property.trim() || entry.value.trim())
    : fallback;
}

function normalizeMachineSerialStatus(value: unknown): MachineSerialStatus {
  const normalized = String(value ?? '').trim();
  return machineSerialStatusOptions.some((option) => option.value === normalized)
    ? normalized as MachineSerialStatus
    : 'in_stock';
}

function normalizeMachineSerialRows(value: unknown): MachineSerialRow[] {
  return Array.isArray(value)
    ? value.map((entry, index) => {
        const row = asRecord(entry);
        return {
          id: asString(row.id, `serial-${index}`),
          serialNumber: asString(row.serialNumber ?? row.serial, ''),
          status: normalizeMachineSerialStatus(row.status),
          orderReference: asString(row.orderReference ?? row.order, ''),
          shippedAt: asString(row.shippedAt ?? row.shipped, '')
        };
      }).filter((entry) => entry.serialNumber.trim() || entry.orderReference.trim() || entry.shippedAt.trim())
    : [];
}

function getMachineSerialStatusLabel(status: MachineSerialStatus) {
  return machineSerialStatusOptions.find((option) => option.value === status)?.label ?? 'Na zalogi';
}

function normalizeSerialMatchText(value: string) {
  return value.trim().toLocaleLowerCase('sl-SI');
}

function buildMachineSerialOrderAllocations(
  rows: MachineSerialRow[],
  matches: MachineSerialOrderMatch[]
) {
  const availableAllocations: Array<MachineSerialOrderAllocation & { claimed: boolean }> = [];
  matches.forEach((match) => {
    const quantity = Math.max(0, Math.floor(Number(match.quantity) || 0));
    for (let index = 0; index < quantity; index += 1) {
      availableAllocations.push({
        orderId: match.orderId,
        orderNumber: match.orderNumber,
        orderStatus: match.orderStatus,
        shippedAt: match.shippedAt,
        orderCreatedAt: match.orderCreatedAt,
        searchText: normalizeSerialMatchText(`${match.orderItemSku} ${match.orderItemName}`),
        claimed: false
      });
    }
  });

  const allocations = new Map<string, MachineSerialOrderAllocation>();
  rows.forEach((row) => {
    const serialNumber = normalizeSerialMatchText(row.serialNumber);
    if (!serialNumber) return;
    const exactAllocation = availableAllocations.find((allocation) =>
      !allocation.claimed && allocation.searchText.includes(serialNumber)
    );
    if (!exactAllocation) return;
    exactAllocation.claimed = true;
    allocations.set(row.id, exactAllocation);
  });

  rows.forEach((row) => {
    if (allocations.has(row.id)) return;
    const nextAllocation = availableAllocations.find((allocation) => !allocation.claimed);
    if (!nextAllocation) return;
    nextAllocation.claimed = true;
    allocations.set(row.id, nextAllocation);
  });

  return allocations;
}

function formatMachineSerialDate(value: string | null | undefined) {
  if (!value) return '–';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '–';
  return new Intl.DateTimeFormat('sl-SI', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  }).format(date);
}

type QuantityUnitKind = 'workday' | 'month' | 'piece';

function sanitizeQuantityRangeInput(value: string) {
  const compact = value.replace(/[^\d-]/g, '');
  const [rawStart = '', rawEnd = '', ...rest] = compact.split('-');
  const start = rawStart.replace(/^0+(?=\d)/, '');
  const end = rawEnd.replace(/^0+(?=\d)/, '');
  if (compact.includes('-')) return `${start}${start ? '-' : ''}${end || (rest.length > 0 ? '' : '')}`;
  return start;
}

function extractQuantityRange(value: unknown, fallback = '') {
  const raw = String(value ?? '').trim();
  const match = raw.match(/\d+\s*(?:-\s*\d*)?/);
  if (!match) return fallback;
  return sanitizeQuantityRangeInput(match[0]);
}

function normalizeQuantityRangeValue(value: unknown, fallback: string) {
  return extractQuantityRange(value, extractQuantityRange(fallback));
}

function getQuantityRangeEnd(value: string) {
  const range = extractQuantityRange(value);
  if (!range) return null;
  const end = range.split('-')[1] || range.split('-')[0];
  const parsed = Number(end);
  return Number.isFinite(parsed) ? parsed : null;
}

function getInflectedQuantityUnit(value: string | number, kind: QuantityUnitKind) {
  const quantity = getQuantityRangeEnd(String(value));
  if (kind === 'piece') {
    if (quantity === 1) return 'kos';
    if (quantity === 2) return 'kosa';
    if (quantity === 3 || quantity === 4) return 'kosi';
    return 'kosov';
  }
  if (kind === 'month') {
    if (quantity === 1) return 'mesec';
    if (quantity === 2) return 'meseca';
    if (quantity === 3 || quantity === 4) return 'meseci';
    return 'mesecev';
  }
  if (quantity === 1) return 'delovni dan';
  if (quantity === 2) return 'delovna dneva';
  if (quantity === 3 || quantity === 4) return 'delovne dni';
  return 'delovnih dni';
}

const longestQuantityUnitLabel: Record<QuantityUnitKind, string> = {
  piece: 'kosov',
  month: 'mesecev',
  workday: 'delovna dneva'
};

function getUnitAdornmentStyle(label: string, minimumCharacters = 1) {
  const characterCount = Math.max(Array.from(label || '').length, minimumCharacters);
  return { width: `calc(${characterCount}ch + 1.25rem)` };
}

function getQuantityUnitAdornmentStyle(kind: QuantityUnitKind) {
  return getUnitAdornmentStyle(longestQuantityUnitLabel[kind]);
}

function formatQuantityRangeWithUnit(value: string | number, kind: QuantityUnitKind) {
  const range = extractQuantityRange(value);
  return range ? `${range} ${getInflectedQuantityUnit(range, kind)}` : '';
}

function formatPieceCount(value: number) {
  const count = Math.max(0, Math.floor(Number(value) || 0));
  return `${formatDecimalForDisplay(count)} ${getInflectedQuantityUnit(count, 'piece')}`;
}

function isPieceUnitLabel(unit: string | undefined) {
  return ['kos', 'kosa', 'kosi', 'kosov'].includes((unit ?? '').trim().toLocaleLowerCase('sl-SI'));
}

function getSimulatorUnitLabel(unit: string, quantity: number) {
  return isPieceUnitLabel(unit) ? getInflectedQuantityUnit(quantity, 'piece') : unit;
}

function getSimulatorUnitAdornmentStyle(unit: string) {
  return isPieceUnitLabel(unit) ? getQuantityUnitAdornmentStyle('piece') : getUnitAdornmentStyle(unit);
}

function formatSimulatorQuantityWithUnit(quantity: number, unit: string) {
  return `${formatDecimalForDisplay(quantity)} ${getSimulatorUnitLabel(unit, quantity)}`;
}

function clampDiscountPercent(value: number) {
  return Math.min(100, Math.max(0, Number.isFinite(value) ? value : 0));
}

function normalizeDiscountTarget(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.toLocaleLowerCase('sl-SI') === 'vse' ? allDiscountTargetLabel : trimmed;
}

function normalizeDiscountTargetList(values: string[] | undefined, fallback: string[] = [allDiscountTargetLabel]) {
  const normalized: string[] = [];
  for (const value of values ?? []) {
    const target = normalizeDiscountTarget(value);
    if (!target) continue;
    if (target === allDiscountTargetLabel) return [allDiscountTargetLabel];
    if (!normalized.some((entry) => entry.toLocaleLowerCase('sl-SI') === target.toLocaleLowerCase('sl-SI'))) {
      normalized.push(target);
    }
  }
  return normalized.length > 0 ? normalized : fallback;
}

function normalizeDiscountSuggestionList(values: string[]) {
  const normalized: string[] = [];
  for (const value of values) {
    const target = normalizeDiscountTarget(value);
    if (!target) continue;
    if (!normalized.some((entry) => entry.toLocaleLowerCase('sl-SI') === target.toLocaleLowerCase('sl-SI'))) {
      normalized.push(target);
    }
  }
  return normalized;
}

function parseQuantityDiscountTargets(appliesTo?: string | null) {
  const normalized = appliesTo?.trim();
  if (!normalized || normalized === 'allVariants') {
    return { variantTargets: [allDiscountTargetLabel], customerTargets: [allDiscountTargetLabel] };
  }

  try {
    const parsed = JSON.parse(normalized) as unknown;
    const record = asRecord(parsed);
    return {
      variantTargets: normalizeDiscountTargetList(asStringArray(record.variants ?? record.variantTargets, [allDiscountTargetLabel])),
      customerTargets: normalizeDiscountTargetList(asStringArray(record.customers ?? record.customerTargets, [allDiscountTargetLabel]))
    };
  } catch {
    return {
      variantTargets: normalizeDiscountTargetList([normalized]),
      customerTargets: [allDiscountTargetLabel]
    };
  }
}

export function serializeQuantityDiscountTargets(rule: Pick<QuantityDiscountDraft, 'variantTargets' | 'customerTargets'>) {
  const variantTargets = normalizeDiscountTargetList(rule.variantTargets);
  const customerTargets = normalizeDiscountTargetList(rule.customerTargets);
  if (
    variantTargets.length === 1 &&
    variantTargets[0] === allDiscountTargetLabel &&
    customerTargets.length === 1 &&
    customerTargets[0] === allDiscountTargetLabel
  ) {
    return 'allVariants';
  }
  return JSON.stringify({ variants: variantTargets, customers: customerTargets });
}

function getSimulatorOptionSku(option: SimulatorOption) {
  if (option.targetKey?.trim()) return option.targetKey.trim();
  const match = option.label.match(/\(([^()]+)\)\s*$/);
  return match?.[1]?.trim() || option.id;
}

function discountRuleTargetsVariant(rule: QuantityDiscountDraft, option: SimulatorOption | null) {
  const targets = normalizeDiscountTargetList(rule.variantTargets);
  if (targets.includes(allDiscountTargetLabel) || !option) return true;
  const sku = getSimulatorOptionSku(option).toLocaleLowerCase('sl-SI');
  const label = option.label.toLocaleLowerCase('sl-SI');
  return targets.some((target) => {
    const normalized = target.toLocaleLowerCase('sl-SI');
    return normalized === sku || label.includes(normalized);
  });
}

function discountRuleTargetsAllCustomers(rule: QuantityDiscountDraft) {
  return normalizeDiscountTargetList(rule.customerTargets).includes(allDiscountTargetLabel);
}

function getBestQuantityDiscount(rules: QuantityDiscountDraft[], quantity: number, option: SimulatorOption | null) {
  return rules
    .filter((rule) =>
      quantity >= rule.minQuantity &&
      discountRuleTargetsVariant(rule, option) &&
      discountRuleTargetsAllCustomers(rule)
    )
    .sort((left, right) => right.minQuantity - left.minQuantity || right.discountPercent - left.discountPercent)[0] ?? null;
}

function getNextQuantityDiscount(rules: QuantityDiscountDraft[], quantity: number, option: SimulatorOption | null) {
  return rules
    .filter((rule) =>
      quantity < rule.minQuantity &&
      discountRuleTargetsVariant(rule, option) &&
      discountRuleTargetsAllCustomers(rule)
    )
    .sort((left, right) => left.minQuantity - right.minQuantity || right.discountPercent - left.discountPercent)[0] ?? null;
}

function formatPercent(value: number) {
  return `${formatDecimalForDisplay(value)} %`;
}

function formatCompactPercent(value: number) {
  return `${formatDecimalForDisplay(value)} %`;
}

function normalizeWeightLooseLabel(value: string) {
  const normalized = value.trim();
  if (!normalized) return normalized;
  const comparable = normalized.toLocaleLowerCase('sl-SI');
  return comparable.includes('rasito') || comparable.includes('bulk') || comparable.includes('razsuto')
    ? 'Brez pakiranja'
    : normalized;
}

function normalizeWeightFractionValue(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return '';
  return /\bmm\b/i.test(trimmed) ? trimmed : `${trimmed} mm`;
}

function stripWeightFractionUnit(value: string) {
  return value.trim().replace(/\s*mm\s*$/i, '');
}

function normalizeWeightChipKey(value: string) {
  return value
    .trim()
    .toLocaleLowerCase('sl-SI')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/\s+/g, ' ');
}

function isWeightBagCountKey(value: string) {
  const key = normalizeWeightChipKey(value);
  return key === 'stevilo vreck' ||
    key === 'st. vreck' ||
    key === 'st vreck' ||
    key === 'st. vr.' ||
    key === 'st vr' ||
    key === 'vr';
}

function splitWeightSemicolonValues(value: string) {
  return value.split(';').map((entry) => entry.trim()).filter(Boolean);
}

function splitWeightColorValues(value: string) {
  return value.split(/[;,]/).map((entry) => entry.trim()).filter(Boolean);
}

function parseWeightIntegerListInput(raw: string) {
  return raw
    .split(/[;,]/)
    .map((entry) => parseDecimalInput(entry))
    .filter((entry): entry is number => entry !== null)
    .map((entry) => Math.max(1, Math.floor(entry)))
    .filter((entry, index, all) => all.indexOf(entry) === index);
}

function parseWeightMassListInput(raw: string) {
  const normalized = raw.trim();
  if (!normalized) return [];
  if (normalized.includes(';')) return parseDecimalListInput(normalized);

  const commaParts = normalized.split(',').map((entry) => entry.trim()).filter(Boolean);
  const looksLikeIntegerList =
    commaParts.length > 1 &&
    commaParts.every((entry) => /^\d+$/.test(entry)) &&
    commaParts[0] !== '0' &&
    (commaParts.length > 2 || commaParts.slice(1).some((entry) => entry.length > 1));

  if (looksLikeIntegerList) {
    return commaParts
      .map((entry) => Number(entry))
      .filter((entry) => Number.isFinite(entry) && entry > 0);
  }

  return parseDecimalListInput(normalized);
}

function normalizeSingleWeightColorValue(value: string) {
  return splitWeightColorValues(value)[0] ?? value.trim();
}

function formatWeightChipLabel(value: string) {
  const normalized = normalizeWeightChip(value);
  const prefixed = normalized.match(/^([^:]+)\s*:\s*(.+)$/);
  if (!prefixed) return normalized;
  const key = prefixed[1].trim();
  const normalizedKey = normalizeWeightChipKey(key);
  const rawValue = prefixed[2].trim();
  const separator = normalizedKey === 'barva'
    ? (rawValue.includes(',') ? ',' : rawValue.includes(';') ? ';' : '')
    : isWeightBagCountKey(normalizedKey)
      ? (rawValue.includes(',') ? ',' : rawValue.includes(';') ? ';' : '')
    : rawValue.includes(';')
      ? ';'
      : '';
  const displayValue = separator
    ? rawValue.split(separator).map((entry) => entry.trim()).filter(Boolean).join(`${separator} `)
    : rawValue;
  return `${key}: ${displayValue}`;
}

function normalizeWeightChip(value: string) {
  const normalized = normalizeWeightLooseLabel(value);
  const prefixed = normalized.match(/^([^:]+)\s*:\s*(.+)$/);
  if (!prefixed) return normalized;
  const key = normalizeWeightChipKey(prefixed[1]);
  const rawValue = prefixed[2].trim();
  if (!rawValue) return normalized;
  if (key === 'frakcija' || key === 'fr') {
    const values = splitWeightSemicolonValues(rawValue);
    return `fr:${(values.length > 0 ? values : [rawValue]).join(';')}`;
  }
  if (key === 'barva') {
    const values = splitWeightColorValues(rawValue);
    return `barva:${(values.length > 0 ? values : [rawValue]).join(', ')}`;
  }
  if (key === 'kg' || key === 'masa') {
    const parsed = parseWeightMassListInput(rawValue);
    return parsed.length === 0 ? normalized : `kg:${parsed.map(formatDecimalForDisplay).join(';')}`;
  }
  if (isWeightBagCountKey(key)) {
    const parsed = parseWeightIntegerListInput(rawValue);
    return parsed.length === 0 ? normalized : `vr:${parsed.join(',')}`;
  }
  return normalized;
}

function normalizeWeightChipList(values: string[]) {
  const normalized: string[] = [];
  for (const value of values) {
    const chip = normalizeWeightChip(value);
    if (!chip) continue;
    if (!normalized.some((entry) => entry.toLocaleLowerCase('sl-SI') === chip.toLocaleLowerCase('sl-SI'))) {
      normalized.push(chip);
    }
  }
  return normalized;
}

function parsePackagingMass(label: string) {
  const normalized = label.replace(',', '.').toLowerCase();
  if (
    normalized.includes('rasito') ||
    normalized.includes('bulk') ||
    normalized.includes('razsuto') ||
    normalized.includes('brez pakiranja')
  ) return null;
  const match = normalized.match(/(\d+(?:\.\d+)?)/);
  return match ? Number(match[1]) : null;
}

function parseWeightCombinationChips(chips: string[], data: WeightProductData, fallbackColor = '') {
  const fractions: string[] = [];
  const colors: string[] = [];
  const masses: number[] = [];
  const bagCounts: number[] = [];
  const addUniqueText = (target: string[], value: string) => {
    const normalized = value.trim();
    if (!normalized) return;
    if (!target.some((entry) => entry.toLocaleLowerCase('sl-SI') === normalized.toLocaleLowerCase('sl-SI'))) {
      target.push(normalized);
    }
  };
  const addUniqueMass = (value: number | null) => {
    if (value === null || value <= 0) return;
    if (!masses.some((entry) => Math.abs(entry - value) < 0.0001)) masses.push(value);
  };
  const addUniqueBagCount = (value: number | null) => {
    if (value === null || value <= 0) return;
    if (!bagCounts.includes(value)) bagCounts.push(value);
  };

  for (const chip of chips) {
    const normalized = normalizeWeightChip(chip);
    const prefixed = normalized.match(/^([^:]+)\s*:\s*(.+)$/);
    if (prefixed) {
      const key = normalizeWeightChipKey(prefixed[1]);
      const rawValue = prefixed[2].trim();
      if (key === 'frakcija' || key === 'fr') {
        for (const value of splitWeightSemicolonValues(rawValue)) {
          addUniqueText(fractions, normalizeWeightFractionValue(value));
        }
        continue;
      }
      if (key === 'barva') {
        for (const value of splitWeightColorValues(rawValue)) {
          addUniqueText(colors, normalizeSingleWeightColorValue(value));
        }
        continue;
      }
      if (key === 'kg' || key === 'masa') {
        for (const value of parseWeightMassListInput(rawValue)) {
          addUniqueMass(value);
        }
        continue;
      }
      if (isWeightBagCountKey(key)) {
        for (const value of parseWeightIntegerListInput(rawValue)) {
          addUniqueBagCount(value);
        }
        continue;
      }
    }
    addUniqueMass(parsePackagingMass(normalized));
  }

  if (fractions.length === 0) addUniqueText(fractions, normalizeWeightFractionValue(data.fraction));
  if (colors.length === 0) addUniqueText(colors, fallbackColor);
  if (masses.length === 0) addUniqueMass(data.netMassKg);
  if (bagCounts.length === 0) addUniqueBagCount(1);

  return {
    fractions: fractions.length > 0 ? fractions : [''],
    colors: colors.length > 0 ? colors : [''],
    masses: masses.length > 0 ? masses : [data.netMassKg],
    bagCounts: bagCounts.length > 0 ? bagCounts : [1]
  };
}

function getWeightVariantType(label: string) {
  return parsePackagingMass(label) === null ? 'Brez pakiranja' : 'Vreča';
}

function getWeightPackagingName(label: string) {
  return parsePackagingMass(label) === null ? 'Brez pakiranja' : 'PP vreča';
}

function getWeightSaleOptionLabel(variant: Pick<WeightVariantDraft, 'netMassKg'>) {
  return variant.netMassKg === null ? 'Brez pakiranja' : 'Vrečke';
}

function getWeightBagMassLabel(variant: Pick<WeightVariantDraft, 'netMassKg'>) {
  return variant.netMassKg === null ? 'Po naročilu' : `${formatDecimalForDisplay(variant.netMassKg)} kg`;
}

function getWeightVariantDisplayLabel(variant: Pick<WeightVariantDraft, 'netMassKg'> & Partial<Pick<WeightVariantDraft, 'fraction' | 'color' | 'minQuantity'>>) {
  const bagCount = typeof variant.minQuantity === 'number' ? getWeightBagCount({ netMassKg: variant.netMassKg, minQuantity: variant.minQuantity }) : 1;
  const massLabel = variant.netMassKg === null
    ? 'Brez pakiranja'
    : bagCount > 1
      ? `${formatDecimalForDisplay(variant.netMassKg)} kg / ${bagCount} vrečk`
      : `${formatDecimalForDisplay(variant.netMassKg)} kg vrečka`;
  const descriptors = [variant.fraction, variant.color].map((entry) => entry?.trim()).filter(Boolean);
  return descriptors.length > 0 ? `${descriptors.join(' / ')} / ${massLabel}` : massLabel;
}

function getWeightBagCount(variant: Pick<WeightVariantDraft, 'netMassKg' | 'minQuantity'>) {
  return Math.max(1, Math.floor(variant.minQuantity || 1));
}

function getWeightVariantTotalMass(variant: Pick<WeightVariantDraft, 'netMassKg' | 'minQuantity'>) {
  return variant.netMassKg === null ? null : Number(variant.netMassKg.toFixed(4));
}

function formatWeightKg(value: number | null | undefined) {
  return value === null || value === undefined ? '—' : `${formatDecimalForDisplay(value)} kg`;
}

function formatWeightBagCount(value: number) {
  const count = Math.max(1, Math.floor(Number(value) || 1));
  if (count === 1) return '1 vrečka';
  if (count === 2) return '2 vrečki';
  if (count === 3 || count === 4) return `${count} vrečke`;
  return `${count} vrečk`;
}

function parseStockLabel(value: string | undefined) {
  const match = value?.trim().match(/^(-?\d+(?:[,.]\d+)?)(?:\s+(.+))?$/);
  if (!match) return null;
  const amount = Number((match[1] ?? '').replace(',', '.'));
  if (!Number.isFinite(amount)) return null;
  return { amount, unit: (match[2] ?? '').trim() };
}

function formatStockAfterOrder(stockLabel: string | undefined, orderedQuantity: number) {
  const stock = parseStockLabel(stockLabel);
  if (!stock) return null;
  const nextAmount = Math.max(0, Number((stock.amount - Math.max(0, orderedQuantity || 0)).toFixed(2)));
  if (isPieceUnitLabel(stock.unit)) {
    return `${formatSimulatorQuantityWithUnit(stock.amount, stock.unit)} → ${formatSimulatorQuantityWithUnit(nextAmount, stock.unit)}`;
  }
  const suffix = stock.unit ? ` ${stock.unit}` : '';
  return `${formatDecimalForDisplay(stock.amount)}${suffix} → ${formatDecimalForDisplay(nextAmount)}${suffix}`;
}

function getAvailableMachineSerialLabels(rows: MachineSerialRow[]) {
  const available = rows
    .filter((row) => row.status === 'in_stock')
    .map((row) => row.serialNumber.trim())
    .filter(Boolean);
  if (available.length > 0) return available;

  return rows
    .map((row) => row.serialNumber.trim())
    .filter(Boolean);
}

function formatMachineSerialSummary(serialLabels: string[] | undefined, quantity: number) {
  const count = Math.max(1, Math.floor(Number(quantity) || 1));
  const selectedSerials = (serialLabels ?? []).filter(Boolean).slice(0, count);

  if (count === 1) {
    return selectedSerials[0] ? `Serijska št.: ${selectedSerials[0]}` : 'Serijska št.: ni vnesena';
  }

  if (selectedSerials.length === 0) return 'Serijske št.: niso vnesene';

  const visibleSerials = selectedSerials.slice(0, 3);
  const hiddenSerials = Math.max(0, selectedSerials.length - visibleSerials.length);
  const missingSerials = Math.max(0, count - selectedSerials.length);
  const suffix = [
    hiddenSerials > 0 ? `+ ${hiddenSerials}` : '',
    missingSerials > 0 ? `+ ${missingSerials} brez serijske št.` : ''
  ].filter(Boolean).join(' ');

  return `Serijske št.: ${visibleSerials.join(', ')}${suffix ? ` ${suffix}` : ''}`;
}

function getWeightVariantUnitPrice(variant: Pick<WeightVariantDraft, 'netMassKg' | 'minQuantity' | 'pricePerKg' | 'packagingCostPerBag'>) {
  const totalMass = getWeightVariantTotalMass(variant);
  const bagCount = getWeightBagCount(variant);
  return totalMass === null
    ? variant.pricePerKg
    : Number((totalMass * variant.pricePerKg + bagCount * variant.packagingCostPerBag).toFixed(4));
}

function formatWeightVariantGrossPrice(variant: Pick<WeightVariantDraft, 'netMassKg' | 'minQuantity' | 'pricePerKg' | 'packagingCostPerBag'>) {
  return variant.netMassKg === null
    ? `${formatDecimalForDisplay(toGrossWithVat(variant.pricePerKg))} €/kg`
    : formatCurrency(toGrossWithVat(getWeightVariantUnitPrice(variant)));
}

function normalizeWeightNoteTag(value: string): NoteTag | '' {
  const normalized = value.trim();
  return normalized === 'na-zalogi' ||
    normalized === 'novo' ||
    normalized === 'akcija' ||
    normalized === 'zadnji-kosi' ||
    normalized === 'ni-na-zalogi'
    ? normalized
    : '';
}

function weightSkuPart(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '')
    .toUpperCase();
}

function createWeightVariantFromCombination({
  netMassKg,
  fraction,
  color,
  bagCount = 1,
  index,
  data,
  baseSku
}: {
  netMassKg: number | null;
  fraction: string;
  color: string;
  bagCount?: number;
  index: number;
  data: WeightProductData;
  baseSku?: string | null;
}): WeightVariantDraft {
  const suffix = netMassKg === null ? '001' : formatDecimalForSku(netMassKg).padStart(3, '0');
  const normalizedBagCount = Math.max(1, Math.floor(bagCount));
  const fractionPricing = getWeightFractionPricing(data, fraction);
  const skuParts = [weightSkuPart(fraction), weightSkuPart(color), normalizedBagCount > 1 ? `VR${normalizedBagCount}` : '', suffix].filter(Boolean);
  return {
    id: `weight-${skuParts.join('-') || suffix}-${index}`,
    type: netMassKg === null ? 'Brez pakiranja' : 'Vreča',
    packaging: netMassKg === null ? 'Brez pakiranja' : 'PP vreča',
    fraction,
    color,
    netMassKg,
    pricePerKg: fractionPricing.pricePerKg,
    packagingCostPerBag: fractionPricing.packagingCostPerBag,
    minQuantity: netMassKg === null ? data.minQuantity : normalizedBagCount,
    orderStep: data.orderStep,
    stockKg: data.stockKg,
    deliveryTime: data.deliveryTime,
    sku: `${baseSku || 'SKU'}-${skuParts.join('-') || suffix}`,
    active: true,
    note: '',
    position: index + 1
  };
}

function createWeightVariantFromPackaging(label: string, index: number, data: WeightProductData, baseSku?: string | null): WeightVariantDraft {
  return createWeightVariantFromCombination({
    netMassKg: parsePackagingMass(label),
    fraction: normalizeWeightFractionValue(data.fraction),
    color: '',
    index,
    data,
    baseSku
  });
}

function createWeightVariantsFromChips(data: WeightProductData, baseSku?: string | null, fallbackColor = '') {
  const parsed = parseWeightCombinationChips(data.packagingChips, data, fallbackColor);
  const variants: WeightVariantDraft[] = [];
  for (const fraction of parsed.fractions) {
    for (const color of parsed.colors) {
      for (const netMassKg of parsed.masses) {
        for (const bagCount of parsed.bagCounts) {
          variants.push(createWeightVariantFromCombination({
            netMassKg,
            fraction,
            color,
            bagCount,
            index: variants.length,
            data,
            baseSku
          }));
        }
      }
    }
  }
  return variants;
}

function createWeightMaterialStockKey(fraction: string, color: string) {
  return `${fraction.trim().toLocaleLowerCase('sl-SI')}|${color.trim().toLocaleLowerCase('sl-SI')}`;
}

function createWeightFractionKey(fraction: string) {
  return fraction.trim().toLocaleLowerCase('sl-SI');
}

function createFallbackWeightFractionPricing(data: Pick<WeightProductData, 'fraction' | 'pricePerKg' | 'packagingCostPerBag'>): WeightFractionPricingDraft {
  const fraction = normalizeWeightFractionValue(data.fraction || defaultWeightProductData.fraction);
  return {
    id: `fraction-pricing-${weightSkuPart(fraction) || 'DEFAULT'}`,
    fraction,
    pricePerKg: data.pricePerKg,
    packagingCostPerBag: data.packagingCostPerBag,
    position: 1
  };
}

function normalizeWeightFractionPricing(
  value: unknown,
  index: number,
  data: Pick<WeightProductData, 'fraction' | 'pricePerKg' | 'packagingCostPerBag'>
): WeightFractionPricingDraft {
  const record = asRecord(value);
  const fraction = normalizeWeightFractionValue(asString(record.fraction, data.fraction || defaultWeightProductData.fraction));
  return {
    id: asString(record.id, `fraction-pricing-${weightSkuPart(fraction) || index + 1}`),
    fraction,
    pricePerKg: Math.max(0, asNumber(record.pricePerKg, data.pricePerKg)),
    packagingCostPerBag: Math.max(0, asNumber(record.packagingCostPerBag, data.packagingCostPerBag)),
    position: Math.max(1, Math.floor(asNumber(record.position, index + 1)))
  };
}

function getWeightFractionPricing(data: Pick<WeightProductData, 'fraction' | 'pricePerKg' | 'packagingCostPerBag' | 'fractionPricing'>, fraction: string) {
  const key = createWeightFractionKey(fraction);
  return data.fractionPricing.find((row) => createWeightFractionKey(row.fraction) === key) ?? createFallbackWeightFractionPricing(data);
}

function createWeightMaterialStocksFromVariants(
  variants: WeightVariantDraft[],
  data: Pick<WeightProductData, 'fraction' | 'deliveryTime'>,
  fallbackColor = ''
) {
  const rowsByKey = new Map<string, WeightMaterialStockDraft>();
  variants.filter((variant) => variant.netMassKg !== null).forEach((variant) => {
    const fraction = variant.fraction || data.fraction || '—';
    const color = normalizeSingleWeightColorValue(variant.color || fallbackColor || '—');
    const key = createWeightMaterialStockKey(fraction, color);
    const existing = rowsByKey.get(key);
    if (existing) {
      rowsByKey.set(key, {
        ...existing,
        stockKg: Math.max(existing.stockKg, variant.stockKg),
        deliveryTime: existing.deliveryTime || variant.deliveryTime || data.deliveryTime
      });
      return;
    }
    rowsByKey.set(key, {
      id: `material-stock-${weightSkuPart(fraction)}-${weightSkuPart(color)}-${rowsByKey.size + 1}`,
      fraction,
      color,
      stockKg: Math.max(0, variant.stockKg),
      reservedKg: 0,
      deliveryTime: variant.deliveryTime || data.deliveryTime,
      position: rowsByKey.size + 1
    });
  });
  return Array.from(rowsByKey.values());
}

function normalizeWeightMaterialStock(
  value: unknown,
  index: number,
  data: Pick<WeightProductData, 'fraction' | 'deliveryTime'>
): WeightMaterialStockDraft {
  const record = asRecord(value);
  const fraction = asString(record.fraction, data.fraction || '—');
  const color = normalizeSingleWeightColorValue(asString(record.color, '—'));
  return {
    id: asString(record.id, `material-stock-${weightSkuPart(fraction)}-${weightSkuPart(color)}-${index + 1}`),
    fraction,
    color,
    stockKg: Math.max(0, asNumber(record.stockKg, 0)),
    reservedKg: Math.max(0, asNumber(record.reservedKg, 0)),
    deliveryTime: asString(record.deliveryTime, data.deliveryTime),
    position: Math.max(1, Math.floor(asNumber(record.position, index + 1)))
  };
}

function normalizeWeightVariant(value: unknown, index: number, data: WeightProductData, baseSku?: string | null): WeightVariantDraft {
  const record = asRecord(value);
  const fallback = createWeightVariantsFromChips(data, baseSku)[index] ?? createWeightVariantFromCombination({
    netMassKg: data.netMassKg,
    fraction: normalizeWeightFractionValue(data.fraction),
    color: '',
    index,
    data,
    baseSku
  });
  return {
    id: asString(record.id, fallback.id),
    type: normalizeWeightLooseLabel(asString(record.type, fallback.type)),
    packaging: normalizeWeightLooseLabel(asString(record.packaging, fallback.packaging)),
    fraction: asString(record.fraction, fallback.fraction),
    color: asString(record.color, fallback.color),
    netMassKg: record.netMassKg === null ? null : asNumber(record.netMassKg, fallback.netMassKg ?? data.netMassKg),
    pricePerKg: asNumber(record.pricePerKg, data.pricePerKg),
    packagingCostPerBag: asNumber(record.packagingCostPerBag, data.packagingCostPerBag),
    minQuantity: Math.max(0, asNumber(record.minQuantity, fallback.minQuantity)),
    orderStep: Math.max(0, asNumber(record.orderStep, data.orderStep)),
    stockKg: Math.max(0, asNumber(record.stockKg, data.stockKg)),
    deliveryTime: asString(record.deliveryTime, data.deliveryTime),
    sku: asString(record.sku, fallback.sku),
    active: asBoolean(record.active, true),
    note: asString(record.note, ''),
    position: Math.max(1, Math.floor(asNumber(record.position, index + 1)))
  };
}

export function createQuantityDiscountDraft(rule: QuantityDiscountInput, index: number): QuantityDiscountDraft {
  const targets = parseQuantityDiscountTargets(rule.appliesTo);
  const minQuantity = Math.max(1, Math.floor(Number(rule.minQuantity ?? 1)));
  const discountPercent = Math.min(100, Math.max(0, Number(rule.discountPercent ?? 0)));
  const targetKey = weightSkuPart([
    ...targets.variantTargets,
    ...targets.customerTargets
  ].join('-')) || 'ALL';
  return {
    id: rule.id ? `persisted-${rule.id}` : `quantity-discount-${index}-${minQuantity}-${weightSkuPart(String(discountPercent)) || '0'}-${targetKey}`,
    persistedId: rule.id,
    minQuantity,
    discountPercent,
    appliesTo: 'allVariants',
    variantTargets: targets.variantTargets,
    customerTargets: targets.customerTargets,
    note: rule.note ?? '',
    position: Number(rule.position ?? index)
  };
}

export function createInitialQuantityDiscountDrafts(
  rules: QuantityDiscountInput[] | undefined,
  productType: ProductEditorType = 'dimensions'
): QuantityDiscountDraft[] {
  const source = rules && rules.length > 0
    ? rules
    : productType === 'unique_machine'
      ? []
      : defaultQuantityDiscountRows;
  return source
    .map((rule, index) => createQuantityDiscountDraft(rule, index))
    .sort((left, right) => left.position - right.position || left.minQuantity - right.minQuantity);
}

export function cloneQuantityDiscountDraft(rule: QuantityDiscountDraft): QuantityDiscountDraft {
  return {
    ...rule,
    variantTargets: [...rule.variantTargets],
    customerTargets: [...rule.customerTargets]
  };
}

export function normalizeSimpleProductData(value: unknown, context: ProductDataContext = {}): SimpleProductData {
  const record = asRecord(value);
  const firstVariant = context.variants?.[0];
  return {
    basePrice: asNumber(record.basePrice, firstVariant?.price ?? defaultSimpleProductData.basePrice),
    actionPrice: asNumber(record.actionPrice, Math.max(0, (firstVariant?.price ?? defaultSimpleProductData.basePrice) * 0.9)),
    actionPriceEnabled: asBoolean(record.actionPriceEnabled, false),
    stock: Math.max(0, Math.floor(asNumber(record.stock, firstVariant?.stock ?? defaultSimpleProductData.stock))),
    minStock: Math.max(0, Math.floor(asNumber(record.minStock, defaultSimpleProductData.minStock))),
    deliveryTime: asString(record.deliveryTime, defaultSimpleProductData.deliveryTime),
    moq: Math.max(1, Math.floor(asNumber(record.moq, firstVariant?.minOrder ?? defaultSimpleProductData.moq))),
    warehouseLocation: asString(record.warehouseLocation, defaultSimpleProductData.warehouseLocation),
    saleStatus: asString(record.saleStatus, firstVariant?.active === false ? 'inactive' : 'active') === 'inactive' ? 'inactive' : 'active',
    visibleInStore: asBoolean(record.visibleInStore, true),
    showAsNew: asBoolean(record.showAsNew, false),
    requireInstructions: asBoolean(record.requireInstructions, false),
    basicInfoRows: normalizeSpecRows(record.basicInfoRows ?? record.basicInfo, defaultSimpleProductData.basicInfoRows, 'simple-basic-info'),
    technicalSpecs: normalizeSpecRows(record.technicalSpecs ?? record.specs, defaultSimpleProductData.technicalSpecs, 'simple-spec')
  };
}

export function normalizeWeightProductData(value: unknown, context: ProductDataContext = {}): WeightProductData {
  const record = asRecord(value);
  const baseData: WeightProductData = {
    ...defaultWeightProductData,
    pricePerKg: asNumber(record.pricePerKg, context.variants?.[0]?.price ?? defaultWeightProductData.pricePerKg),
    packagingCostPerBag: asNumber(record.packagingCostPerBag, defaultWeightProductData.packagingCostPerBag),
    minQuantity: Math.max(0, asNumber(record.minQuantity, context.variants?.[0]?.minOrder ?? defaultWeightProductData.minQuantity)),
    density: asString(record.density, defaultWeightProductData.density),
    fraction: asString(record.fraction, defaultWeightProductData.fraction),
    netMassKg: Math.max(0, asNumber(record.netMassKg, context.variants?.[0]?.weight ?? defaultWeightProductData.netMassKg)),
    orderStep: Math.max(0, asNumber(record.orderStep, defaultWeightProductData.orderStep)),
    stockKg: Math.max(0, asNumber(record.stockKg, context.variants?.[0]?.stock ?? defaultWeightProductData.stockKg)),
    deliveryTime: asString(record.deliveryTime, defaultWeightProductData.deliveryTime),
    bulkSale: asBoolean(record.bulkSale, true),
    packagingChips: normalizeWeightChipList(asStringArray(record.packagingChips, defaultWeightProductData.packagingChips)),
    fractionChips: asStringArray(record.fractionChips, defaultWeightProductData.fractionChips),
    orderStepChips: asStringArray(record.orderStepChips, defaultWeightProductData.orderStepChips),
    fractionPricing: [],
    materialStocks: [],
    variants: []
  };
  const fractionPricing = Array.isArray(record.fractionPricing) && record.fractionPricing.length > 0
    ? record.fractionPricing
        .map((entry, index) => normalizeWeightFractionPricing(entry, index, baseData))
        .sort((left, right) => left.position - right.position)
    : [createFallbackWeightFractionPricing(baseData)];
  const activeFraction = fractionPricing.some((row) => createWeightFractionKey(row.fraction) === createWeightFractionKey(baseData.fraction))
    ? baseData.fraction
    : fractionPricing[0]?.fraction ?? baseData.fraction;
  const activePricing = fractionPricing.find((row) => createWeightFractionKey(row.fraction) === createWeightFractionKey(activeFraction)) ?? fractionPricing[0];
  const pricedBaseData: WeightProductData = {
    ...baseData,
    fraction: activeFraction,
    pricePerKg: activePricing?.pricePerKg ?? baseData.pricePerKg,
    packagingCostPerBag: activePricing?.packagingCostPerBag ?? baseData.packagingCostPerBag,
    fractionPricing
  };
  const sourceVariants = Array.isArray(record.variants) && record.variants.length > 0
    ? record.variants
    : createWeightVariantsFromChips(pricedBaseData, context.baseSku);
  const variants = sourceVariants.map((entry, index) => normalizeWeightVariant(entry, index, pricedBaseData, context.baseSku));
  const materialStocks = Array.isArray(record.materialStocks) && record.materialStocks.length > 0
    ? record.materialStocks.map((entry, index) => normalizeWeightMaterialStock(entry, index, pricedBaseData))
    : createWeightMaterialStocksFromVariants(variants, pricedBaseData);
  return {
    ...pricedBaseData,
    materialStocks,
    variants
  };
}

export function normalizeUniqueMachineProductData(value: unknown, context: ProductDataContext = {}): UniqueMachineProductData {
  const record = asRecord(value);
  const firstVariant = context.variants?.[0];
  const specs = normalizeSpecRows(record.specs, defaultMachineProductData.specs, 'spec');
  return {
    basePrice: asNumber(record.basePrice, firstVariant?.price ?? defaultMachineProductData.basePrice),
    discountPercent: clampDiscountPercent(asNumber(record.discountPercent, firstVariant?.discountPct ?? defaultMachineProductData.discountPercent)),
    stock: Math.max(0, Math.floor(asNumber(record.stock, firstVariant?.stock ?? defaultMachineProductData.stock))),
    serialTrackingRequired: asBoolean(record.serialTrackingRequired, true),
    warrantyLabel: asString(record.warrantyLabel, defaultMachineProductData.warrantyLabel),
    warrantyMonths: normalizeQuantityRangeValue(record.warrantyMonths, defaultMachineProductData.warrantyMonths),
    serviceIntervalLabel: asString(record.serviceIntervalLabel, defaultMachineProductData.serviceIntervalLabel),
    serviceIntervalMonths: normalizeQuantityRangeValue(record.serviceIntervalMonths, defaultMachineProductData.serviceIntervalMonths),
    deliveryTime: formatQuantityRangeWithUnit(normalizeQuantityRangeValue(record.deliveryTime, defaultMachineProductData.deliveryTime), 'workday'),
    packageWeightKg: Math.max(0, asNumber(record.packageWeightKg, defaultMachineProductData.packageWeightKg)),
    packageDimensions: asString(record.packageDimensions, defaultMachineProductData.packageDimensions),
    transportClass: asString(record.transportClass, defaultMachineProductData.transportClass),
    warnings: asString(record.warnings, defaultMachineProductData.warnings),
    basicInfoRows: normalizeSpecRows(record.basicInfoRows ?? record.basicInfo, defaultMachineProductData.basicInfoRows, 'basic-info'),
    serialNumbers: normalizeMachineSerialRows(record.serialNumbers ?? record.serials),
    specs,
    includedItems: asStringArray(record.includedItems, defaultMachineProductData.includedItems)
  };
}

export function createInitialTypeSpecificData(value: unknown, context: ProductDataContext = {}): UniversalProductSpecificData {
  const record = asRecord(value);
  return {
    simple: normalizeSimpleProductData(record.simple, context),
    weight: normalizeWeightProductData(record.weight, context),
    uniqueMachine: normalizeUniqueMachineProductData(record.uniqueMachine ?? record.machine, context),
    dimensions: asRecord(record.dimensions)
  };
}

export function cloneTypeSpecificData(data: UniversalProductSpecificData): UniversalProductSpecificData {
  return createInitialTypeSpecificData(JSON.parse(JSON.stringify(data)) as unknown);
}

export function buildSimpleCatalogVariants(data: SimpleProductData, fallback: Variant | undefined, baseSku: string, name: string): Variant[] {
  return [
    createVariant({
      ...(fallback ?? {}),
      id: fallback?.id ?? createLocalId('simple-variant'),
      label: name || 'Osnovni artikel',
      sku: fallback?.sku || baseSku,
      price: data.actionPriceEnabled ? data.actionPrice : data.basePrice,
      discountPct: data.actionPriceEnabled && data.basePrice > 0
        ? Number(Math.max(0, Math.min(99.9, ((data.basePrice - data.actionPrice) / data.basePrice) * 100)).toFixed(2))
        : 0,
      stock: data.stock,
      minOrder: data.moq,
      active: data.saleStatus === 'active',
      sort: 1
    })
  ];
}

export function buildWeightCatalogVariants(data: WeightProductData, baseSku: string): Variant[] {
  return data.variants.map((variant, index) => {
    const unitPrice = getWeightVariantUnitPrice(variant);
    return createVariant({
      id: variant.id,
      label: getWeightVariantDisplayLabel(variant),
      weight: getWeightVariantTotalMass(variant) ?? variant.netMassKg,
      minOrder: Math.max(1, Math.ceil(variant.minQuantity || 1)),
      sku: variant.sku || `${baseSku || 'SKU'}-${index + 1}`,
      price: unitPrice,
      discountPct: 0,
      stock: Math.round(variant.stockKg),
      active: variant.active,
      sort: variant.position || index + 1
    });
  });
}

export function buildMachineCatalogVariants(data: UniqueMachineProductData, fallback: Variant | undefined, baseSku: string, name: string): Variant[] {
  return [
    createVariant({
      ...(fallback ?? {}),
      id: fallback?.id ?? createLocalId('machine-variant'),
      label: name || 'Stroj / unikaten artikel',
      sku: fallback?.sku || baseSku,
      price: data.basePrice,
      discountPct: data.discountPercent,
      stock: data.stock,
      minOrder: 1,
      active: true,
      sort: 1
    })
  ];
}

export function getSimpleSimulatorOptions(data: SimpleProductData, label = 'Osnovni artikel'): SimulatorOption[] {
  return [{
    id: 'simple',
    label,
    basePrice: data.actionPriceEnabled ? data.actionPrice : data.basePrice,
    quantityUnit: 'kos',
    targetKey: 'Enostavni',
    summaryLabel: formatCurrency(data.actionPriceEnabled ? data.actionPrice : data.basePrice),
    stockLabel: formatPieceCount(data.stock),
    minOrderLabel: formatPieceCount(Math.max(1, Math.floor(Number(data.moq) || 1)))
  }];
}

export function getWeightSimulatorOptions(data: WeightProductData): SimulatorOption[] {
  const getMaterialStockLabel = (fraction: string) => {
    const key = createWeightFractionKey(fraction);
    const stockKg = data.materialStocks
      .filter((row) => createWeightFractionKey(row.fraction) === key)
      .reduce((total, row) => total + row.stockKg, 0);
    return formatWeightKg(stockKg || data.stockKg);
  };
  const variantOptions = data.variants.filter((variant) => variant.netMassKg !== null).map((variant) => {
    const packagePrice = getWeightVariantUnitPrice(variant);
    const totalMass = getWeightVariantTotalMass(variant);
    const bagCount = getWeightBagCount(variant);
    return {
      id: variant.id,
      label: getWeightVariantDisplayLabel(variant),
      basePrice: packagePrice,
      quantityUnit: variant.netMassKg === null ? 'kg' : 'kos',
      targetKey: variant.sku || variant.id,
      summaryLabel: variant.netMassKg === null
        ? `${formatDecimalForDisplay(variant.pricePerKg)} €/kg`
        : `${formatDecimalForDisplay(totalMass)} kg × ${formatDecimalForDisplay(variant.pricePerKg)} €`,
      discountUnitLabel: variant.netMassKg === null ? 'kg' : 'kos',
      stockLabel: formatWeightKg(variant.stockKg),
      minOrderLabel: variant.netMassKg === null ? `${formatDecimalForDisplay(variant.minQuantity || data.minQuantity || 1)} kg` : formatPieceCount(bagCount),
      weightFraction: variant.fraction || undefined,
      weightNetMassKg: variant.netMassKg ?? undefined,
      weightBagCount: bagCount,
      weightPricePerKg: variant.pricePerKg,
      weightPackagingCostPerBag: variant.packagingCostPerBag
    };
  });
  const seenFractions = new Set(variantOptions.map((option) => createWeightFractionKey(option.weightFraction || '')));
  const fractionPricingOptions = data.fractionPricing
    .filter((row) => {
      const key = createWeightFractionKey(row.fraction);
      if (!key || seenFractions.has(key)) return false;
      seenFractions.add(key);
      return true;
    })
    .map((row) => ({
      id: `weight-fraction-${row.id}`,
      label: row.fraction,
      basePrice: Number((row.pricePerKg + row.packagingCostPerBag).toFixed(4)),
      quantityUnit: 'kg',
      targetKey: row.fraction,
      summaryLabel: `${formatDecimalForDisplay(row.pricePerKg)} €/kg`,
      discountUnitLabel: 'kg',
      stockLabel: getMaterialStockLabel(row.fraction),
      minOrderLabel: `${formatDecimalForDisplay(data.minQuantity || 1)} kg`,
      weightFraction: row.fraction,
      weightNetMassKg: 1,
      weightBagCount: 1,
      weightPricePerKg: row.pricePerKg,
      weightPackagingCostPerBag: row.packagingCostPerBag
    }));
  const materialStockOptions = data.materialStocks
    .filter((row) => {
      const key = createWeightFractionKey(row.fraction);
      if (!key || seenFractions.has(key)) return false;
      seenFractions.add(key);
      return true;
    })
    .map((row) => {
      const pricing = getWeightFractionPricing(data, row.fraction);
      return {
        id: `weight-material-${row.id}`,
        label: row.fraction,
        basePrice: Number((pricing.pricePerKg + pricing.packagingCostPerBag).toFixed(4)),
        quantityUnit: 'kg',
        targetKey: row.fraction,
        summaryLabel: `${formatDecimalForDisplay(pricing.pricePerKg)} €/kg`,
        discountUnitLabel: 'kg',
        stockLabel: formatWeightKg(row.stockKg),
        minOrderLabel: `${formatDecimalForDisplay(data.minQuantity || 1)} kg`,
        weightFraction: row.fraction,
        weightNetMassKg: 1,
        weightBagCount: 1,
        weightPricePerKg: pricing.pricePerKg,
        weightPackagingCostPerBag: pricing.packagingCostPerBag
      };
    });
  return [...variantOptions, ...fractionPricingOptions, ...materialStockOptions];
}

export function getMachineSimulatorOptions(data: UniqueMachineProductData, label = 'Stroj / unikaten artikel'): SimulatorOption[] {
  return [{
    id: 'machine',
    label,
    basePrice: data.basePrice,
    quantityUnit: 'kos',
    summaryLabel: formatCurrency(data.basePrice),
    stockLabel: formatPieceCount(data.stock),
    minOrderLabel: formatPieceCount(1),
    serialLabels: getAvailableMachineSerialLabels(data.serialNumbers)
  }];
}

function isFiniteDimensionValue(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function getDimensionSimulatorLabel(variant: Variant, index: number) {
  const dimensions = [variant.length, variant.width, variant.thickness]
    .filter(isFiniteDimensionValue)
    .map(formatDecimalForDisplay);
  if (dimensions.length > 0) return `${dimensions.join(' × ')} mm`;

  const label = variant.label.trim();
  const weightLikeLabel = /^\d+(?:[,.]\d+)?\s*g$/iu.test(label);
  if (label && !weightLikeLabel) return label;

  return variant.sku.trim() || `Različica ${index + 1}`;
}

export function getDimensionSimulatorOptions(variants: Variant[]): SimulatorOption[] {
  return variants.map((variant, index) => ({
    id: variant.id,
    label: getDimensionSimulatorLabel(variant, index),
    basePrice: variant.price,
    quantityUnit: 'kos',
    targetKey: variant.sku || variant.id,
    summaryLabel: formatCurrency(variant.price),
    stockLabel: formatPieceCount(variant.stock),
    minOrderLabel: formatPieceCount(Math.max(1, Math.floor(Number(variant.minOrder) || 1)))
  }));
}

function ModeIcon({ type, className }: { type: ProductEditorType; className?: string }) {
  if (type === 'dimensions') {
    return (
      <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect width="20" height="16" x="2" y="4" rx="2" />
        <path d="M12 9v11" />
        <path d="M2 9h13a2 2 0 0 1 2 2v9" />
      </svg>
    );
  }
  if (type === 'weight') {
    return (
      <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 3v18" />
        <path d="m19 8 3 8a5 5 0 0 1-6 0zV7" />
        <path d="M3 7h1a17 17 0 0 0 8-2 17 17 0 0 0 8 2h1" />
        <path d="m5 8 3 8a5 5 0 0 1-6 0zV7" />
        <path d="M7 21h10" />
      </svg>
    );
  }
  if (type === 'unique_machine') {
    return (
      <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M11 10.27 7 3.34" />
        <path d="m11 13.73-4 6.93" />
        <path d="M12 22v-2" />
        <path d="M12 2v2" />
        <path d="M14 12h8" />
        <path d="m17 20.66-1-1.73" />
        <path d="m17 3.34-1 1.73" />
        <path d="M2 12h2" />
        <path d="m20.66 17-1.73-1" />
        <path d="m20.66 7-1.73 1" />
        <path d="m3.34 17 1.73-1" />
        <path d="m3.34 7 1.73 1" />
        <circle cx="12" cy="12" r="2" />
        <circle cx="12" cy="12" r="8" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m15 12-9.373 9.373a1 1 0 0 1-3.001-3L12 9" />
      <path d="m18 15 4-4" />
      <path d="m21.5 11.5-1.914-1.914A2 2 0 0 1 19 8.172v-.344a2 2 0 0 0-.586-1.414l-1.657-1.657A6 6 0 0 0 12.516 3H9l1.243 1.243A6 6 0 0 1 12 8.485V10l2 2h1.172a2 2 0 0 1 1.414.586L18.5 14.5" />
    </svg>
  );
}

export function ProductTypeSelectorCardRow({
  value,
  editable,
  onChange,
  embedded = false
}: {
  value: ProductEditorType;
  editable: boolean;
  onChange: (next: ProductEditorType) => void;
  embedded?: boolean;
}) {
  const modes = [
    {
      type: 'simple' as const,
      title: 'Enostavni',
      description: ['En artikel brez različic.', 'Ena cena, en SKU in ena zaloga.']
    },
    {
      type: 'dimensions' as const,
      title: 'Po dimenzijah',
      description: ['Isti artikel v več merah.', 'Vsaka kombinacija dimenzij ima svojo ceno, SKU in zalogo.']
    },
    {
      type: 'weight' as const,
      title: 'Po teži',
      description: ['Isti material v več prodajnih oblikah s skupno zalogo.', 'Cena je vezana na kilažo in število vrečk.']
    },
    {
      type: 'unique_machine' as const,
      title: 'Stroj / unikaten',
      description: ['Posamezen stroj ali unikaten artikel.', 'En artikel z lastnimi tehničnimi podatki, servisom in garancijo.']
    }
  ];

  const content = (
    <>
      <div className="mb-3 flex items-center gap-2">
        <h2 className="text-[15px] font-semibold text-slate-900">Tip artikla</h2>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {modes.map((mode) => {
          const selected = mode.type === value;
          return (
            <button
              key={mode.type}
              type="button"
              disabled={!editable}
              aria-pressed={selected}
              onClick={() => {
                if (!editable || selected) return;
                onChange(mode.type);
              }}
              className={classNames(
                'grid min-h-[92px] grid-cols-[2rem_minmax(0,1fr)] items-start gap-x-3 gap-y-2 rounded-lg border bg-white p-4 text-left transition',
                selected
                  ? 'border-[#4a91f5] bg-[#f8fbff] shadow-[0_0_0_1px_rgba(74,145,245,0.22)]'
                  : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50',
                !editable && !selected ? 'cursor-default opacity-80 hover:border-slate-200 hover:bg-white' : ''
              )}
            >
              <ModeIcon type={mode.type} className={classNames('mt-0.5 h-7 w-7 shrink-0', selected ? 'text-[#1982bf]' : 'text-slate-700')} />
              <span className={classNames('min-w-0 self-center text-sm font-semibold', selected ? 'text-[#1982bf]' : 'text-slate-900')}>
                {mode.title}
              </span>
              <ul className="col-span-2 mt-0 list-disc space-y-1 pl-4 text-[11px] font-medium leading-4 text-slate-600">
                {mode.description.map((sentence) => (
                  <li key={sentence}>{sentence}</li>
                ))}
              </ul>
            </button>
          );
        })}
      </div>
    </>
  );

  if (embedded) {
    return <div className="mt-4 border-t border-slate-200 pt-4">{content}</div>;
  }

  return (
    <section className={`${adminWindowCardClassName} px-5 py-5`} style={adminWindowCardStyle}>
      {content}
    </section>
  );
}

function LogicIcon({ type, active = false }: { type: ProductEditorType | 'price' | 'stock' | 'delivery' | 'sku' | 'service' | 'package'; active?: boolean }) {
  const className = active ? 'h-8 w-8 text-[#1982bf]' : 'h-6 w-6 text-[#1982bf]';
  if (type === 'price' || type === 'sku') {
    return (
      <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M20 12 12 20 4 12l8-8h8v8Z" />
        <circle cx="15.5" cy="8.5" r="1.2" />
      </svg>
    );
  }
  if (type === 'stock') {
    return (
      <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="5" y="5" width="14" height="14" rx="2" />
        <path d="m9 13 2-5h4l-2 4h3l-5 5 1-4H9Z" />
      </svg>
    );
  }
  if (type === 'delivery' || type === 'package') {
    return (
      <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M3 7h11v10H3z" />
        <path d="M14 10h4l3 3v4h-7z" />
        <circle cx="7" cy="18" r="1.5" />
        <circle cx="18" cy="18" r="1.5" />
      </svg>
    );
  }
  if (type === 'service') {
    return (
      <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 3 4.5 6v5.5c0 4.2 2.7 7.2 7.5 9.5 4.8-2.3 7.5-5.3 7.5-9.5V6L12 3Z" />
        <path d="m9 12 2 2 4-5" />
      </svg>
    );
  }
  return <ModeIcon type={type} className={className} />;
}

export function ProductPricingLogicCardRow({
  productType,
  simpleData,
  weightData,
  machineData
}: {
  productType: ProductEditorType;
  simpleData: SimpleProductData;
  weightData: WeightProductData;
  machineData: UniqueMachineProductData;
}) {
  const config = {
    simple: {
      title: 'Aktivni način: Enostavni',
      text: 'Artikel uporablja eno osnovno ceno, en SKU in eno količino zaloge. Enostavno upravljanje cen, zaloge in razpoložljivosti.',
      cards: [
        { icon: 'price' as const, title: 'Osnovna cena', text: `${formatCurrency(simpleData.actionPriceEnabled ? simpleData.actionPrice : simpleData.basePrice)} brez DDV` },
        { icon: 'stock' as const, title: 'Zaloga', text: `${simpleData.stock} kos` },
        { icon: 'delivery' as const, title: 'Dobavni rok', text: simpleData.deliveryTime }
      ]
    },
    dimensions: {
      title: 'Aktivni način: Po dimenzijah',
      text: 'Cena, SKU in zaloga se določijo za vsako kombinacijo dimenzij. Vsaka vrstica predstavlja specifično različico artikla.',
      cards: [
        { icon: 'dimensions' as const, title: 'Dimenzije', text: 'Dolžina x Širina x Debelina z tolerancami' },
        { icon: 'sku' as const, title: 'SKU & Cena', text: 'Samodejno generirani SKU-ji in cene po pravilih' },
        { icon: 'stock' as const, title: 'Zaloga', text: 'Zaloga ločeno po kombinacijah skladno z vnosom' }
      ]
    },
    weight: {
      title: 'Aktivni način: Po teži',
      text: 'Artikel se prodaja po dejanski teži. Cena je definirana na kg, zaloga se vodi v kg, pakiranja pa izračunajo prodajno ceno.',
      cards: [
        { icon: 'price' as const, title: 'Cena na kg', text: `${formatDecimalForDisplay(toGrossWithVat(weightData.pricePerKg))} €/kg z DDV` },
        { icon: 'stock' as const, title: 'Zaloga v kg', text: `${formatDecimalForDisplay(weightData.stockKg)} kg` },
        { icon: 'package' as const, title: 'Pakiranja in pretvorbe', text: 'Pakiranja imajo izračunane cene na podlagi cene na kg.' }
      ]
    },
    unique_machine: {
      title: 'Aktivni način: Stroj / unikaten',
      text: 'Ena definicija artikla brez variant. Podpora za serijske številke, garancijo, servisne podatke in tehnično dokumentacijo.',
      cards: [
        { icon: 'price' as const, title: 'Enotna definicija', text: 'En SKU = en artikel' },
        { icon: 'unique_machine' as const, title: 'Sledljivost', text: machineData.serialTrackingRequired ? 'Serijske številke obvezne' : 'Sledljivost po potrebi' },
        { icon: 'service' as const, title: 'Servis in garancija', text: `${formatQuantityRangeWithUnit(machineData.warrantyMonths, 'month')} garancije` }
      ]
    }
  }[productType];

  return (
    <section className={`${adminWindowCardClassName} p-5`} style={adminWindowCardStyle}>
      <div className="grid gap-4 xl:grid-cols-[minmax(360px,1.15fr)_repeat(3,minmax(0,1fr))]">
        <div className="flex items-center gap-4 rounded-lg bg-[#f2f8ff] p-4">
          <span className="inline-flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-white text-[#1982bf] shadow-[inset_0_0_0_1px_rgba(226,232,240,0.9)]">
            <LogicIcon type={productType} active />
          </span>
          <div>
            <h2 className="text-[17px] font-semibold text-slate-900">Logika cen in zaloge</h2>
            <p className="mt-2 text-sm font-semibold text-slate-900">{config.title}</p>
            <p className="mt-1 text-[12px] font-medium leading-5 text-slate-600">{config.text}</p>
          </div>
        </div>
        {config.cards.map((card) => (
          <div key={card.title} className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-4">
            <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white">
              <LogicIcon type={card.icon} />
            </span>
            <span>
              <span className="block text-sm font-semibold text-slate-900">{card.title}</span>
              <span className="mt-1 block text-[12px] font-medium leading-5 text-slate-600">{card.text}</span>
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

export function SimpleProductModule({
  editable,
  data,
  quantityDiscountsPanel,
  onChange
}: {
  editable: boolean;
  data: SimpleProductData;
  quantityDiscountsPanel?: ReactNode;
  onChange: (next: SimpleProductData) => void;
}) {
  const [selectedBasicInfoIds, setSelectedBasicInfoIds] = useState<Set<string>>(new Set());
  const [selectedSpecIds, setSelectedSpecIds] = useState<Set<string>>(new Set());
  const update = (updates: Partial<SimpleProductData>) => onChange({ ...data, ...updates });
  const updateBasicInfoRow = (id: string, updates: Partial<MachineSpecRow>) => update({
    basicInfoRows: data.basicInfoRows.map((row) => (row.id === id ? { ...row, ...updates } : row))
  });
  const updateSpec = (id: string, updates: Partial<MachineSpecRow>) => update({
    technicalSpecs: data.technicalSpecs.map((spec) => (spec.id === id ? { ...spec, ...updates } : spec))
  });
  const addBasicInfoRow = () => update({ basicInfoRows: [...data.basicInfoRows, { id: createLocalId('simple-basic-info'), property: '', value: '' }] });
  const addSpec = () => update({ technicalSpecs: [...data.technicalSpecs, { id: createLocalId('simple-spec'), property: '', value: '' }] });
  const allBasicInfoSelected = data.basicInfoRows.length > 0 && data.basicInfoRows.every((row) => selectedBasicInfoIds.has(row.id));
  const hasSelectedBasicInfo = data.basicInfoRows.some((row) => selectedBasicInfoIds.has(row.id));
  const allSpecsSelected = data.technicalSpecs.length > 0 && data.technicalSpecs.every((spec) => selectedSpecIds.has(spec.id));
  const hasSelectedSpecs = data.technicalSpecs.some((spec) => selectedSpecIds.has(spec.id));
  const toggleBasicInfoSelection = (id: string) => {
    setSelectedBasicInfoIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const toggleAllBasicInfo = () => {
    setSelectedBasicInfoIds(allBasicInfoSelected ? new Set() : new Set(data.basicInfoRows.map((row) => row.id)));
  };
  const removeSelectedBasicInfoRows = () => {
    if (!hasSelectedBasicInfo) return;
    update({ basicInfoRows: data.basicInfoRows.filter((row) => !selectedBasicInfoIds.has(row.id)) });
    setSelectedBasicInfoIds(new Set());
  };
  const toggleSpecSelection = (id: string) => {
    setSelectedSpecIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const toggleAllSpecs = () => {
    setSelectedSpecIds(allSpecsSelected ? new Set() : new Set(data.technicalSpecs.map((spec) => spec.id)));
  };
  const removeSelectedSpecs = () => {
    if (!hasSelectedSpecs) return;
    update({ technicalSpecs: data.technicalSpecs.filter((spec) => !selectedSpecIds.has(spec.id)) });
    setSelectedSpecIds(new Set());
  };

  useEffect(() => {
    setSelectedBasicInfoIds((current) => {
      const validIds = new Set(data.basicInfoRows.map((row) => row.id));
      const next = new Set(Array.from(current).filter((id) => validIds.has(id)));
      return next.size === current.size ? current : next;
    });
  }, [data.basicInfoRows]);

  useEffect(() => {
    setSelectedSpecIds((current) => {
      const validIds = new Set(data.technicalSpecs.map((spec) => spec.id));
      const next = new Set(Array.from(current).filter((id) => validIds.has(id)));
      return next.size === current.size ? current : next;
    });
  }, [data.technicalSpecs]);

  return (
    <section className={`${adminWindowCardClassName} px-5 pb-5 pt-5`} style={adminWindowCardStyle}>
      <div className="mb-4">
        <h2 className={sectionTitleClassName}>Aktivni modul: Osnovna cena in zaloga</h2>
      </div>

      <div className={classNames('grid items-stretch gap-4', quantityDiscountsPanel ? 'xl:grid-cols-[minmax(420px,0.92fr)_minmax(520px,1.08fr)]' : 'xl:grid-cols-1')}>
        {quantityDiscountsPanel ? (
          <div className="h-full overflow-hidden rounded-lg border border-slate-200 bg-white">
            {quantityDiscountsPanel}
          </div>
        ) : null}

        <section className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <div className="flex items-center justify-between gap-2 px-4 py-3">
            <h3 className="text-sm font-semibold text-slate-900">Osnovne informacije</h3>
            <div className="flex items-center gap-2">
              <IconButton type="button" tone="neutral" className={adminTableNeutralIconButtonClassName} disabled={!editable} onClick={addBasicInfoRow} aria-label="Dodaj osnovno informacijo" title="Dodaj osnovno informacijo"><PlusIcon /></IconButton>
              <IconButton
                type="button"
                tone={hasSelectedBasicInfo ? 'danger' : 'neutral'}
                className={hasSelectedBasicInfo ? adminTableSelectedDangerIconButtonClassName : adminTableNeutralIconButtonClassName}
                disabled={!editable || !hasSelectedBasicInfo}
                onClick={removeSelectedBasicInfoRows}
                aria-label="Odstrani izbrane osnovne informacije"
                title="Odstrani izbrane"
              >
                <TrashCanIcon />
              </IconButton>
            </div>
          </div>
          <div className="overflow-x-auto border-t border-slate-200">
            <table className="min-w-full text-[12px]">
              <thead className="bg-[color:var(--admin-table-header-bg)]">
                <tr>
                  {editable ? (
                    <th className="w-10 px-2 py-2 text-center">
                      <AdminCheckbox checked={allBasicInfoSelected} disabled={data.basicInfoRows.length === 0} onChange={toggleAllBasicInfo} />
                    </th>
                  ) : null}
                  <th className={tableHeaderClassName}>Lastnost</th>
                  <th className={tableHeaderClassName}>Vrednost</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t border-slate-100">
                  {editable ? <td className="px-2 py-2" aria-hidden="true" /> : null}
                  <td className={tableCellClassName}>Cena (z DDV)</td>
                  <td className={tableCellClassName}>
                    <NumberField label="" value={data.basePrice} suffix="€" editable={editable} onChange={(value) => update({ basePrice: value })} />
                  </td>
                </tr>
                <tr className="border-t border-slate-100">
                  {editable ? <td className="px-2 py-2" aria-hidden="true" /> : null}
                  <td className={tableCellClassName}>Zaloga</td>
                  <td className={tableCellClassName}>
                    <IntegerUnitField value={data.stock} unitKind="piece" editable={editable} onChange={(value) => update({ stock: value })} />
                  </td>
                </tr>
                <tr className="border-t border-slate-100">
                  {editable ? <td className="px-2 py-2" aria-hidden="true" /> : null}
                  <td className={tableCellClassName}>Dobavni rok</td>
                  <td className={tableCellClassName}>
                    <QuantityRangeUnitField value={data.deliveryTime} unitKind="workday" editable={editable} onChange={(value) => update({ deliveryTime: formatQuantityRangeWithUnit(value, 'workday') })} />
                  </td>
                </tr>
                {data.basicInfoRows.map((row) => (
                  <tr key={row.id} className="border-t border-slate-100">
                    {editable ? (
                      <td className="px-2 py-2 text-center">
                        <AdminCheckbox checked={selectedBasicInfoIds.has(row.id)} onChange={() => toggleBasicInfoSelection(row.id)} />
                      </td>
                    ) : null}
                    <td className={tableCellClassName}>{editable ? <input className={fieldFrameClassName} value={row.property} onChange={(event) => updateBasicInfoRow(row.id, { property: event.target.value })} /> : row.property}</td>
                    <td className={tableCellClassName}><SpecValueField value={row.value} editable={editable} onChange={(value) => updateBasicInfoRow(row.id, { value })} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between gap-2 border-t border-slate-200 px-4 py-3">
            <h3 className="text-sm font-semibold text-slate-900">Tehnične specifikacije</h3>
            <div className="flex items-center gap-2">
              <IconButton type="button" tone="neutral" className={adminTableNeutralIconButtonClassName} disabled={!editable} onClick={addSpec} aria-label="Dodaj specifikacijo" title="Dodaj specifikacijo"><PlusIcon /></IconButton>
              <IconButton
                type="button"
                tone={hasSelectedSpecs ? 'danger' : 'neutral'}
                className={hasSelectedSpecs ? adminTableSelectedDangerIconButtonClassName : adminTableNeutralIconButtonClassName}
                disabled={!editable || !hasSelectedSpecs}
                onClick={removeSelectedSpecs}
                aria-label="Odstrani izbrane specifikacije"
                title="Odstrani izbrane"
              >
                <TrashCanIcon />
              </IconButton>
            </div>
          </div>
          <div className="overflow-x-auto border-t border-slate-200">
            <table className="min-w-full text-[12px]">
              <thead className="bg-[color:var(--admin-table-header-bg)]">
                <tr>
                  {editable ? (
                    <th className="w-10 px-2 py-2 text-center">
                      <AdminCheckbox checked={allSpecsSelected} disabled={data.technicalSpecs.length === 0} onChange={toggleAllSpecs} />
                    </th>
                  ) : null}
                  <th className={tableHeaderClassName}>Lastnost</th>
                  <th className={tableHeaderClassName}>Vrednost</th>
                </tr>
              </thead>
              <tbody>
                {data.technicalSpecs.length > 0 ? data.technicalSpecs.map((spec) => (
                  <tr key={spec.id} className="border-t border-slate-100">
                    {editable ? (
                      <td className="px-2 py-2 text-center">
                        <AdminCheckbox checked={selectedSpecIds.has(spec.id)} onChange={() => toggleSpecSelection(spec.id)} />
                      </td>
                    ) : null}
                    <td className={tableCellClassName}>{editable ? <input className={fieldFrameClassName} value={spec.property} onChange={(event) => updateSpec(spec.id, { property: event.target.value })} /> : spec.property}</td>
                    <td className={tableCellClassName}><SpecValueField value={spec.value} editable={editable} onChange={(value) => updateSpec(spec.id, { value })} /></td>
                  </tr>
                )) : (
                  <tr className="border-t border-slate-100">
                    <td colSpan={editable ? 3 : 2} className="px-3 py-4 text-[12px] font-medium text-slate-500">Ni dodanih tehničnih specifikacij.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </section>
  );
}

export function WeightProductModule({
  editable,
  data,
  baseSku,
  color,
  quantityDiscountsPanel,
  onChange
}: {
  editable: boolean;
  data: WeightProductData;
  baseSku: string;
  color: string;
  quantityDiscountsPanel?: ReactNode;
  onChange: (next: WeightProductData) => void;
}) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectedFractionIds, setSelectedFractionIds] = useState<Set<string>>(new Set());
  const update = (updates: Partial<WeightProductData>) => onChange({ ...data, ...updates });
  const updateVariant = (id: string, updates: Partial<WeightVariantDraft>) => update({
    variants: data.variants.map((variant) => (variant.id === id ? { ...variant, ...updates } : variant))
  });
  const fractionPricingRows = data.fractionPricing.length > 0
    ? data.fractionPricing.slice().sort((left, right) => left.position - right.position)
    : [createFallbackWeightFractionPricing(data)];
  const allFractionRowsSelected = fractionPricingRows.length > 0 && fractionPricingRows.every((row) => selectedFractionIds.has(row.id));
  const hasSelectedFractionRows = fractionPricingRows.some((row) => selectedFractionIds.has(row.id));
  const toggleFractionSelection = (id: string) => {
    setSelectedFractionIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const toggleAllFractionRows = () => {
    setSelectedFractionIds(allFractionRowsSelected ? new Set() : new Set(fractionPricingRows.map((row) => row.id)));
  };
  const selectedFractionPricing = getWeightFractionPricing({ ...data, fractionPricing: fractionPricingRows }, data.fraction);
  const selectFractionPricing = (fraction: string) => {
    const pricing = getWeightFractionPricing({ ...data, fractionPricing: fractionPricingRows }, fraction);
    update({
      fraction: pricing.fraction,
      pricePerKg: pricing.pricePerKg,
      packagingCostPerBag: pricing.packagingCostPerBag,
      fractionPricing: fractionPricingRows
    });
  };
  const updateFractionPricingRow = (
    row: WeightFractionPricingDraft,
    updates: Partial<Pick<WeightFractionPricingDraft, 'pricePerKg' | 'packagingCostPerBag'>>
  ) => {
    const selectedKey = createWeightFractionKey(row.fraction);
    const nextRow = {
      ...row,
      ...updates,
      pricePerKg: Math.max(0, updates.pricePerKg ?? row.pricePerKg),
      packagingCostPerBag: Math.max(0, updates.packagingCostPerBag ?? row.packagingCostPerBag)
    };
    const nextRows = fractionPricingRows.some((row) => createWeightFractionKey(row.fraction) === selectedKey)
      ? fractionPricingRows.map((row) => createWeightFractionKey(row.fraction) === selectedKey ? nextRow : row)
      : [...fractionPricingRows, nextRow];
    const isActiveFraction = createWeightFractionKey(data.fraction) === selectedKey;
    update({
      fraction: isActiveFraction ? nextRow.fraction : data.fraction,
      pricePerKg: isActiveFraction ? nextRow.pricePerKg : data.pricePerKg,
      packagingCostPerBag: isActiveFraction ? nextRow.packagingCostPerBag : data.packagingCostPerBag,
      fractionPricing: nextRows,
      variants: data.variants.map((variant) => createWeightFractionKey(variant.fraction || data.fraction) === selectedKey
        ? { ...variant, pricePerKg: nextRow.pricePerKg, packagingCostPerBag: nextRow.packagingCostPerBag }
        : variant)
    });
  };
  const updateFractionPricingLabel = (row: WeightFractionPricingDraft, value: string) => {
    const nextFraction = normalizeWeightFractionValue(value);
    if (!nextFraction) return;
    const oldKey = createWeightFractionKey(row.fraction);
    const nextKey = createWeightFractionKey(nextFraction);
    const duplicate = fractionPricingRows.some((entry) => entry.id !== row.id && createWeightFractionKey(entry.fraction) === nextKey);
    if (duplicate) return;
    const isActiveFraction = createWeightFractionKey(data.fraction) === oldKey;
    update({
      fraction: isActiveFraction ? nextFraction : data.fraction,
      fractionPricing: fractionPricingRows.map((entry) => entry.id === row.id ? { ...entry, fraction: nextFraction } : entry),
      materialStocks: data.materialStocks.map((entry) => createWeightFractionKey(entry.fraction) === oldKey ? { ...entry, fraction: nextFraction } : entry),
      variants: data.variants.map((variant) => createWeightFractionKey(variant.fraction || data.fraction) === oldKey ? { ...variant, fraction: nextFraction } : variant)
    });
  };
  const addFractionPricing = () => {
    let fraction = '';
    for (let index = 0; index < 100; index += 1) {
      const candidate = `${index * 2}-${index * 2 + 2} mm`;
      if (!fractionPricingRows.some((row) => createWeightFractionKey(row.fraction) === createWeightFractionKey(candidate))) {
        fraction = candidate;
        break;
      }
    }
    if (!fraction) fraction = `Nova frakcija ${fractionPricingRows.length + 1} mm`;
    const nextRow: WeightFractionPricingDraft = {
      id: `fraction-pricing-${weightSkuPart(fraction) || fractionPricingRows.length + 1}`,
      fraction,
      pricePerKg: selectedFractionPricing.pricePerKg,
      packagingCostPerBag: selectedFractionPricing.packagingCostPerBag,
      position: fractionPricingRows.length + 1
    };
    update({
      fraction,
      pricePerKg: nextRow.pricePerKg,
      packagingCostPerBag: nextRow.packagingCostPerBag,
      fractionPricing: [...fractionPricingRows, nextRow]
    });
  };
  const removeSelectedFractionPricing = () => {
    if (fractionPricingRows.length <= 1 || !hasSelectedFractionRows) return;
    const nextRows = fractionPricingRows
      .filter((row) => !selectedFractionIds.has(row.id))
      .map((row, index) => ({ ...row, position: index + 1 }));
    const nextSelected = nextRows[0] ?? createFallbackWeightFractionPricing(data);
    setSelectedFractionIds(new Set());
    update({
      fraction: nextSelected.fraction,
      pricePerKg: nextSelected.pricePerKg,
      packagingCostPerBag: nextSelected.packagingCostPerBag,
      fractionPricing: nextRows
    });
  };
  const generateVariants = () => {
    const variants = createWeightVariantsFromChips(data, baseSku, color);
    update({
      variants,
      materialStocks: createWeightMaterialStocksFromVariants(variants, data, color)
    });
  };
  const visibleVariants = data.variants.filter((variant) => variant.netMassKg !== null);
  const selectedAll = visibleVariants.length > 0 && visibleVariants.every((variant) => selectedIds.has(variant.id));
  const materialStockRowsByKey = new Map<string, WeightMaterialStockDraft>();
  data.materialStocks.forEach((row) => {
    materialStockRowsByKey.set(createWeightMaterialStockKey(row.fraction, row.color), row);
  });
  createWeightMaterialStocksFromVariants(visibleVariants, data, color).forEach((row) => {
    const key = createWeightMaterialStockKey(row.fraction, row.color);
    if (!materialStockRowsByKey.has(key)) materialStockRowsByKey.set(key, row);
  });
  const materialStockRows = Array.from(materialStockRowsByKey.values()).sort((left, right) => left.position - right.position);
  const getFractionMaterialStockSummary = (fraction: string) => {
    const fractionKey = createWeightFractionKey(fraction);
    const rows = materialStockRows.filter((row) => createWeightFractionKey(row.fraction) === fractionKey);
    const stockKg = rows.reduce((total, row) => total + row.stockKg, 0);
    const reservedKg = rows.reduce((total, row) => total + row.reservedKg, 0);
    return {
      rows,
      stockKg,
      reservedKg,
      availableKg: Math.max(0, stockKg - reservedKg),
      deliveryTime: rows[0]?.deliveryTime ?? data.deliveryTime
    };
  };
  const updateFractionMaterialStock = (fraction: string, updates: Partial<WeightMaterialStockDraft>) => {
    const fractionKey = createWeightFractionKey(fraction);
    const current = getFractionMaterialStockSummary(fraction);
    const firstRow = current.rows[0] ?? {
      id: `material-stock-${weightSkuPart(fraction) || materialStockRows.length + 1}`,
      fraction,
      color: '—',
      stockKg: 0,
      reservedKg: 0,
      deliveryTime: data.deliveryTime,
      position: materialStockRows.length + 1
    };
    const nextRow: WeightMaterialStockDraft = {
      ...firstRow,
      fraction,
      color: '—',
      stockKg: Math.max(0, updates.stockKg ?? current.stockKg),
      reservedKg: Math.max(0, updates.reservedKg ?? current.reservedKg),
      deliveryTime: updates.deliveryTime ?? current.deliveryTime
    };
    const retainedRows = materialStockRows.filter((row) => createWeightFractionKey(row.fraction) !== fractionKey);
    const nextMaterialStocks = [...retainedRows, nextRow]
      .sort((left, right) => left.position - right.position)
      .map((row, index) => ({ ...row, position: index + 1 }));
    update({
      materialStocks: nextMaterialStocks,
      variants: data.variants.map((variant) => {
        if (createWeightFractionKey(variant.fraction || data.fraction || '—') !== fractionKey) return variant;
        return {
          ...variant,
          ...(updates.stockKg !== undefined ? { stockKg: Math.max(0, updates.stockKg) } : {}),
          ...(updates.deliveryTime !== undefined ? { deliveryTime: updates.deliveryTime } : {})
        };
      })
    });
  };
  const deleteSelected = () => {
    if (!editable || selectedIds.size === 0) return;
    update({
      variants: data.variants
        .filter((variant) => !selectedIds.has(variant.id))
        .map((variant, index) => ({ ...variant, position: index + 1 }))
    });
    setSelectedIds(new Set());
  };
  return (
    <section className={`${adminWindowCardClassName} px-5 pb-5 pt-5`} style={adminWindowCardStyle}>
      <div className="mb-3">
        <h2 className={sectionTitleClassName}>Uredi artikel</h2>
      </div>

      <div className="mb-3 text-[12px] font-normal leading-5 text-slate-600">
        <p>
          Vsaka frakcija ima svojo ceno/kg, strošek pakiranja, zalogo, in dobavni rok.
          <br />
          <span className={`${inlineSnippetClassName} !font-normal`}>Cena = (neto masa × cena/kg + št. vrečk × strošek pakiranja) × (1 - količinski popust)</span>
        </p>
      </div>

      <div className="mb-5">
        <section className="overflow-hidden rounded-lg border border-slate-200">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
            <h3 className="text-sm font-semibold text-slate-900">Prodajni podatki</h3>
            <div className="flex items-center justify-end gap-2">
              <IconButton
                type="button"
                tone="neutral"
                className={adminTableNeutralIconButtonClassName}
                disabled={!editable}
                onClick={addFractionPricing}
                aria-label="Dodaj frakcijo"
                title="Dodaj frakcijo"
              >
                <PlusIcon />
              </IconButton>
              <IconButton
                type="button"
                tone="neutral"
                className={adminTableNeutralIconButtonClassName}
                disabled={!editable || fractionPricingRows.length <= 1 || !hasSelectedFractionRows}
                onClick={removeSelectedFractionPricing}
                aria-label="Odstrani izbrane frakcije"
                title="Odstrani izbrane frakcije"
              >
                <TrashCanIcon />
              </IconButton>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-[12px] leading-5">
              <thead className="bg-[color:var(--admin-table-header-bg)]">
                <tr>
                  <th className="w-10 px-2 py-2 text-center">
                    <AdminCheckbox
                      checked={allFractionRowsSelected}
                      disabled={!editable || fractionPricingRows.length === 0}
                      onChange={toggleAllFractionRows}
                    />
                  </th>
                  <th className={tableHeaderClassName}>Frakcija</th>
                  <th className={`${tableHeaderClassName} text-right`}>Cena/kg</th>
                  <th className={`${tableHeaderClassName} text-right`}>Strošek/vrečko</th>
                  <th className={`${tableHeaderClassName} text-right`}>Zaloga</th>
                  <th className={`${tableHeaderClassName} text-right`}>Rezervirano</th>
                  <th className={`${tableHeaderClassName} text-right`}>Razpoložljivo</th>
                  <th className={tableHeaderClassName}>Dobavni rok</th>
                </tr>
              </thead>
              <tbody>
                {fractionPricingRows.map((row) => {
                  const stock = getFractionMaterialStockSummary(row.fraction);
                  const active = createWeightFractionKey(row.fraction) === createWeightFractionKey(data.fraction);
                  return (
                    <tr
                      key={row.id}
                      className={classNames(
                        'border-t border-slate-100 bg-white transition',
                        editable ? 'cursor-pointer hover:bg-slate-50' : ''
                      )}
                      onClick={() => {
                        if (editable) selectFractionPricing(row.fraction);
                      }}
                    >
                      <td className="px-2 py-2 text-center">
                        <AdminCheckbox
                          checked={selectedFractionIds.has(row.id)}
                          disabled={!editable}
                          onClick={(event) => event.stopPropagation()}
                          onChange={() => toggleFractionSelection(row.id)}
                        />
                      </td>
                      <td className={tableCellClassName}>
                        {editable ? (
                          <span className={compactTableValueUnitShellClassName}>
                            <input
                              className={`${compactTableAlignedInputClassName} !mt-0 !w-[9ch] text-center`}
                              value={stripWeightFractionUnit(row.fraction)}
                              onClick={(event) => event.stopPropagation()}
                              onFocus={() => selectFractionPricing(row.fraction)}
                              onChange={(event) => updateFractionPricingLabel(row, event.target.value)}
                            />
                            <span className={compactTableAdornmentClassName}>mm</span>
                          </span>
                        ) : (
                          <span className={classNames('font-semibold', active ? 'text-[#1982bf]' : 'text-slate-800')}>{row.fraction}</span>
                        )}
                      </td>
                      <td className={`${tableCellClassName} text-right`}>
                        <VatIncludedPriceInline
                          value={row.pricePerKg}
                          editable={editable}
                          inputSuffix="€/kg"
                          grossUnit="€/kg"
                          netUnit="€/kg"
                          onChange={(value) => updateFractionPricingRow(row, { pricePerKg: value })}
                        />
                      </td>
                      <td className={`${tableCellClassName} text-right`}>
                        <VatIncludedPriceInline
                          value={row.packagingCostPerBag}
                          editable={editable}
                          inputSuffix="€"
                          grossUnit="€"
                          netUnit="€"
                          onChange={(value) => updateFractionPricingRow(row, { packagingCostPerBag: value })}
                        />
                      </td>
                      <td className={`${tableCellClassName} text-right`}>
                        {editable ? (
                          <NumberInline value={stock.stockKg} suffix="kg" onChange={(value) => updateFractionMaterialStock(row.fraction, { stockKg: value })} />
                        ) : (
                          formatWeightKg(stock.stockKg)
                        )}
                      </td>
                      <td className={`${tableCellClassName} text-right`}>
                        {editable ? (
                          <NumberInline value={stock.reservedKg} suffix="kg" onChange={(value) => updateFractionMaterialStock(row.fraction, { reservedKg: value })} />
                        ) : (
                          formatWeightKg(stock.reservedKg)
                        )}
                      </td>
                      <td className={`${tableCellClassName} text-right`}>{formatWeightKg(stock.availableKg)}</td>
                      <td className={tableCellClassName}>
                        {editable ? (
                          <input
                            className="h-6 w-full rounded-md border border-slate-300 bg-white px-1.5 text-[12px] text-slate-900 outline-none focus:border-[#3e67d6]"
                            value={stock.deliveryTime}
                            onClick={(event) => event.stopPropagation()}
                            onChange={(event) => updateFractionMaterialStock(row.fraction, { deliveryTime: event.target.value })}
                          />
                        ) : (
                          stock.deliveryTime || '—'
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="border-t border-slate-200 px-4 py-2 text-[11px] leading-4 text-slate-500">Vrednosti v oklepajih so brez DDV.</p>
          {quantityDiscountsPanel}
        </section>
      </div>

      <div className="mb-3 space-y-2">
        <h3 className="text-sm font-semibold text-slate-900">Kombinacije</h3>
        <p className="text-xs text-slate-500">
          Vnesi skupine za frakcijo, barvo, maso in število vrečk posebej, na primer: <span className={inlineSnippetClassName}>frakcija:0-2;4</span>, <span className={inlineSnippetClassName}>barva:bela</span>, <span className={inlineSnippetClassName}>kg:0,5</span>, <span className={inlineSnippetClassName}>vr:1,2</span>. Frakcija lahko vsebuje razpon ali posamezno število; več vrednosti loči s podpičjem. Število vrečk je celo število, zato lahko več vrednosti ločiš z vejico. Ob generiranju se iz vseh vnesenih skupin ustvarijo kombinacije v tabeli.
        </p>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="whitespace-nowrap text-xs leading-5 text-slate-700">
            <span className="font-semibold">Možni vnosi:</span>{' '}
            <span className={`${inlineSnippetClassName} !font-normal`}>frakcija:</span> (<span className={`${inlineSnippetClassName} !font-normal`}>fr:</span>), <span className={`${inlineSnippetClassName} !font-normal`}>barva:</span>, <span className={`${inlineSnippetClassName} !font-normal`}>kg:</span>, <span className={`${inlineSnippetClassName} !font-normal`}>število vrečk</span> (<span className={`${inlineSnippetClassName} !font-normal`}>št. vr.:</span>, <span className={`${inlineSnippetClassName} !font-normal`}>vr:</span>)
          </p>
          <div className="ml-auto flex items-center gap-2">
            <IconButton type="button" tone="neutral" className={adminTableNeutralIconButtonClassName} disabled={!editable} onClick={() => update({ packagingChips: normalizeWeightChipList([...data.packagingChips, 'kg:1']) })} aria-label="Dodaj možnost pakiranja" title="Dodaj možnost pakiranja"><PlusIcon /></IconButton>
            <IconButton type="button" tone="neutral" className={adminTableNeutralIconButtonClassName} disabled={!editable || selectedIds.size === 0} onClick={deleteSelected} aria-label="Odstrani izbrane različice" title="Odstrani"><TrashCanIcon /></IconButton>
            <Button
              type="button"
              variant="primary"
              size="toolbar"
              disabled={!editable}
              onClick={generateVariants}
              className={adminTablePrimaryButtonClassName}
            >
              Generiraj različice
            </Button>
          </div>
        </div>
      </div>

      <div className="mb-4">
        <ChipInputGroup
          label=""
          chips={data.packagingChips}
          editable={editable}
          placeholder="npr. fr:0-2;4, barva:bela, kg:0,5, vr:1,2"
          onChange={(chips) => update({ packagingChips: normalizeWeightChipList(chips) })}
        />
      </div>

      <section className="overflow-hidden rounded-lg border border-slate-200">
        <h3 className="border-b border-slate-200 px-3 py-2 text-sm font-semibold text-slate-900">Prodajne oblike</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full text-[11px] leading-4">
            <colgroup>
              <col style={{ width: '2.2%' }} />
              <col style={{ width: '7%' }} />
              <col style={{ width: '7%' }} />
              <col style={{ width: '7%' }} />
              <col style={{ width: '8%' }} />
              <col style={{ width: '6%' }} />
              <col style={{ width: '7%' }} />
              <col style={{ width: '9%' }} />
              <col style={{ width: '9%' }} />
              <col style={{ width: '22%' }} />
              <col style={{ width: '7%' }} />
              <col style={{ width: '7%' }} />
              <col style={{ width: '4%' }} />
            </colgroup>
            <thead className="bg-[color:var(--admin-table-header-bg)]">
              <tr>
                <th className="w-10 px-2 py-2 text-center">
                  <AdminCheckbox
                    checked={editable && selectedAll}
                    disabled={!editable}
                    onChange={() => setSelectedIds(selectedAll ? new Set() : new Set(visibleVariants.map((variant) => variant.id)))}
                  />
                </th>
                <th className={`${tableHeaderClassName} text-center`}>Frakcija</th>
                <th className={`${tableHeaderClassName} text-center`}>Barva</th>
                <th className={`${tableHeaderClassName} text-center`}>Tip</th>
                <th className={`${tableHeaderClassName} text-right`}>Neto masa</th>
                <th className={`${tableHeaderClassName} text-center`}>Št. vrečk</th>
                <th className={`${tableHeaderClassName} text-right`}>Cena</th>
                <th className={`${tableHeaderClassName} text-center`}>Vir zaloge</th>
                <th className={`${tableHeaderClassName} text-right`}>Razpoložljivo</th>
                <th className={`${tableHeaderClassName} text-center`}>SKU</th>
                <th className={`${tableHeaderClassName} text-center`}>Status</th>
                <th className={`${tableHeaderClassName} text-center`}>Opombe</th>
                <th className={`${tableHeaderClassName} text-center`}>Mesto</th>
              </tr>
            </thead>
            <tbody>
              {visibleVariants.map((variant) => {
                const bagCount = getWeightBagCount(variant);
                const totalMass = getWeightVariantTotalMass(variant) ?? 0;
                const sourceColor = normalizeSingleWeightColorValue(variant.color || color || '—');
                const sourceFraction = variant.fraction || data.fraction || '—';
                return (
                  <tr key={variant.id} className="border-t border-slate-100">
                    <td className="px-2 py-2 text-center">
                      <AdminCheckbox
                        checked={selectedIds.has(variant.id)}
                        disabled={!editable}
                        onChange={() => setSelectedIds((current) => {
                          const next = new Set(current);
                          if (next.has(variant.id)) next.delete(variant.id);
                          else next.add(variant.id);
                          return next;
                        })}
                      />
                    </td>
                    <td className={`${tableCellClassName} text-center`}>
                      {editable ? (
                        <span className={compactTableValueUnitShellClassName}>
                          <input
                            className={`${compactTableAlignedInputClassName} !mt-0 !w-[7ch] text-center`}
                            value={stripWeightFractionUnit(sourceFraction)}
                            onChange={(event) => updateVariant(variant.id, { fraction: normalizeWeightFractionValue(event.target.value) })}
                          />
                          <span className={compactTableAdornmentClassName}>mm</span>
                        </span>
                      ) : (
                        sourceFraction !== '—'
                          ? (
                            <span className="inline-flex h-6 items-center justify-center">
                              <span>{stripWeightFractionUnit(sourceFraction)}</span>
                              <span className={`ml-1 ${compactTableAdornmentClassName}`}>mm</span>
                            </span>
                          )
                          : '—'
                      )}
                    </td>
                    <td className={`${tableCellClassName} text-center`}>
                      {editable ? (
                        <input
                          className="h-6 w-[10ch] rounded-md border border-slate-300 bg-white px-1.5 text-center text-[12px] text-slate-900 outline-none focus:border-[#3e67d6]"
                          value={sourceColor === '—' ? '' : sourceColor}
                          onChange={(event) => updateVariant(variant.id, { color: normalizeSingleWeightColorValue(event.target.value) })}
                        />
                      ) : (
                        sourceColor
                      )}
                    </td>
                    <td className={`${tableCellClassName} text-center`}>Vreče</td>
                    <td className={`${tableCellClassName} text-right`}>
                      {editable ? (
                        <NumberInline
                          value={totalMass}
                          suffix="kg"
                          onChange={(value) => updateVariant(variant.id, { netMassKg: value })}
                        />
                      ) : (
                        formatWeightKg(totalMass)
                      )}
                    </td>
                    <td className={`${tableCellClassName} text-center`}>
                      <input
                        inputMode="numeric"
                        className="mx-auto block h-6 w-[5ch] rounded-md border border-slate-300 bg-white px-0 text-center text-[12px] text-slate-900 outline-none focus:border-[#3e67d6] disabled:cursor-not-allowed disabled:bg-[color:var(--field-locked-bg)] disabled:text-slate-500"
                        value={bagCount}
                        disabled={!editable}
                        onChange={(event) => {
                          const bags = Math.max(1, Math.floor(Number(event.target.value) || 1));
                          updateVariant(variant.id, { minQuantity: bags });
                        }}
                      />
                    </td>
                    <td className={`${tableCellClassName} text-right`}>{formatWeightVariantGrossPrice(variant)}</td>
                    <td className={`${tableCellClassName} text-center`}>{sourceFraction} / {sourceColor}</td>
                    <td className={`${tableCellClassName} text-right`}>
                      {editable ? <NumberInline value={variant.stockKg} suffix="kg" onChange={(value) => updateVariant(variant.id, { stockKg: value })} /> : formatWeightKg(variant.stockKg)}
                    </td>
                    <td className={`${tableCellClassName} text-center`}>{editable ? <input className="h-6 w-full rounded-md border border-slate-300 bg-white px-1.5 text-center text-[12px] text-slate-900 outline-none focus:border-[#3e67d6]" value={variant.sku} onChange={(event) => updateVariant(variant.id, { sku: event.target.value })} /> : variant.sku}</td>
                    <td className={`${tableCellClassName} text-center`}>
                      <div className="inline-flex justify-center">
                        <ActiveStateChip
                          active={variant.active}
                          editable={editable}
                          chipClassName={adminStatusInfoPillCompactTableClassName}
                          menuPlacement="bottom"
                          onChange={(next) => updateVariant(variant.id, { active: next })}
                        />
                      </div>
                    </td>
                    <td className={`${tableCellClassName} text-center`}>
                      <div className="inline-flex justify-center">
                        <NoteTagChip
                          value={normalizeWeightNoteTag(variant.note)}
                          editable={editable}
                          allowEmpty
                          placeholderLabel="Opombe"
                          chipClassName={adminStatusInfoPillCompactTableClassName}
                          menuPlacement="bottom"
                          onChange={(next) => updateVariant(variant.id, { note: next })}
                        />
                      </div>
                    </td>
                    <td className="px-2 py-1.5 text-center">
                      {editable ? (
                        <input
                          type="number"
                          inputMode="numeric"
                          className={`${compactTableAlignedInputClassName} !mt-0 !w-[4ch] !px-0 text-center`}
                          value={variant.position}
                          onChange={(event) => updateVariant(variant.id, { position: Math.max(1, Math.floor(Number(event.target.value) || 1)) })}
                        />
                      ) : (
                        <span className="inline-flex h-6 w-[4ch] items-center justify-center">{variant.position}</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="border-t border-slate-200 px-3 py-2 text-[11px] leading-4 text-slate-500">Cena vključuje DDV.</p>
      </section>

    </section>
  );
}

export function UniqueMachineProductModule({
  editable,
  data,
  orderMatches = [],
  onChange
}: {
  editable: boolean;
  data: UniqueMachineProductData;
  documents: Array<{ id: string; name: string; size: string }>;
  onUploadDocument: () => void;
  orderMatches?: MachineSerialOrderMatch[];
  onChange: (next: UniqueMachineProductData) => void;
}) {
  const update = (updates: Partial<UniqueMachineProductData>) => onChange({ ...data, ...updates });
  const updateSpec = (id: string, updates: Partial<MachineSpecRow>) => update({
    specs: data.specs.map((spec) => (spec.id === id ? { ...spec, ...updates } : spec))
  });
  const updateBasicInfoRow = (id: string, updates: Partial<MachineSpecRow>) => update({
    basicInfoRows: data.basicInfoRows.map((row) => (row.id === id ? { ...row, ...updates } : row))
  });
  const addBasicInfoRow = () => update({ basicInfoRows: [...data.basicInfoRows, { id: createLocalId('basic-info'), property: '', value: '' }] });
  const addSpec = () => update({ specs: [...data.specs, { id: createLocalId('spec'), property: '', value: '' }] });
  const [selectedBasicInfoIds, setSelectedBasicInfoIds] = useState<Set<string>>(new Set());
  const [selectedSpecIds, setSelectedSpecIds] = useState<Set<string>>(new Set());
  const [selectedSerialIds, setSelectedSerialIds] = useState<Set<string>>(new Set());
  const [selectedIncludedIndexes, setSelectedIncludedIndexes] = useState<Set<number>>(new Set());
  const allBasicInfoSelected = data.basicInfoRows.length > 0 && data.basicInfoRows.every((row) => selectedBasicInfoIds.has(row.id));
  const hasSelectedBasicInfo = data.basicInfoRows.some((row) => selectedBasicInfoIds.has(row.id));
  const allSpecsSelected = data.specs.length > 0 && data.specs.every((spec) => selectedSpecIds.has(spec.id));
  const hasSelectedSpecs = data.specs.some((spec) => selectedSpecIds.has(spec.id));
  const allSerialsSelected = data.serialNumbers.length > 0 && data.serialNumbers.every((row) => selectedSerialIds.has(row.id));
  const hasSelectedSerials = data.serialNumbers.some((row) => selectedSerialIds.has(row.id));
  const hasSelectedIncludedItems = data.includedItems.some((_, index) => selectedIncludedIndexes.has(index));
  const serialOrderAllocations = useMemo(
    () => buildMachineSerialOrderAllocations(data.serialNumbers, orderMatches),
    [data.serialNumbers, orderMatches]
  );
  const toggleBasicInfoSelection = (id: string) => {
    setSelectedBasicInfoIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const toggleAllBasicInfo = () => {
    setSelectedBasicInfoIds(allBasicInfoSelected ? new Set() : new Set(data.basicInfoRows.map((row) => row.id)));
  };
  const removeSelectedBasicInfoRows = () => {
    if (!hasSelectedBasicInfo) return;
    update({ basicInfoRows: data.basicInfoRows.filter((row) => !selectedBasicInfoIds.has(row.id)) });
    setSelectedBasicInfoIds(new Set());
  };
  const toggleSpecSelection = (id: string) => {
    setSelectedSpecIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const toggleAllSpecs = () => {
    setSelectedSpecIds(allSpecsSelected ? new Set() : new Set(data.specs.map((spec) => spec.id)));
  };
  const removeSelectedSpecs = () => {
    if (!hasSelectedSpecs) return;
    update({ specs: data.specs.filter((spec) => !selectedSpecIds.has(spec.id)) });
    setSelectedSpecIds(new Set());
  };
  const updateSerial = (id: string, updates: Partial<MachineSerialRow>) => update({
    serialNumbers: data.serialNumbers.map((row) => (row.id === id ? { ...row, ...updates } : row))
  });
  const addSerial = () => update({
    serialNumbers: [...data.serialNumbers, { id: createLocalId('serial'), serialNumber: '', status: 'in_stock', orderReference: '', shippedAt: '' }]
  });
  const toggleSerialSelection = (id: string) => {
    setSelectedSerialIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const toggleAllSerials = () => {
    setSelectedSerialIds(allSerialsSelected ? new Set() : new Set(data.serialNumbers.map((row) => row.id)));
  };
  const removeSelectedSerials = () => {
    if (!hasSelectedSerials) return;
    update({ serialNumbers: data.serialNumbers.filter((row) => !selectedSerialIds.has(row.id)) });
    setSelectedSerialIds(new Set());
  };
  const updateIncludedItem = (index: number, value: string) => update({
    includedItems: data.includedItems.map((entry, entryIndex) => (entryIndex === index ? value : entry))
  });
  const toggleIncludedSelection = (index: number) => {
    setSelectedIncludedIndexes((current) => {
      const next = new Set(current);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };
  const removeSelectedIncludedItems = () => {
    if (!hasSelectedIncludedItems) return;
    update({ includedItems: data.includedItems.filter((_, entryIndex) => !selectedIncludedIndexes.has(entryIndex)) });
    setSelectedIncludedIndexes(new Set());
  };

  useEffect(() => {
    setSelectedBasicInfoIds((current) => {
      const validIds = new Set(data.basicInfoRows.map((row) => row.id));
      const next = new Set(Array.from(current).filter((id) => validIds.has(id)));
      return next.size === current.size ? current : next;
    });
  }, [data.basicInfoRows]);

  useEffect(() => {
    setSelectedSpecIds((current) => {
      const validIds = new Set(data.specs.map((spec) => spec.id));
      const next = new Set(Array.from(current).filter((id) => validIds.has(id)));
      return next.size === current.size ? current : next;
    });
  }, [data.specs]);

  useEffect(() => {
    setSelectedSerialIds((current) => {
      const validIds = new Set(data.serialNumbers.map((row) => row.id));
      const next = new Set(Array.from(current).filter((id) => validIds.has(id)));
      return next.size === current.size ? current : next;
    });
  }, [data.serialNumbers]);

  useEffect(() => {
    setSelectedIncludedIndexes((current) => {
      const next = new Set(Array.from(current).filter((index) => index >= 0 && index < data.includedItems.length));
      return next.size === current.size ? current : next;
    });
  }, [data.includedItems.length]);

  return (
    <section className={`${adminWindowCardClassName} px-5 pb-5 pt-5`} style={adminWindowCardStyle}>
      <div className="mb-4">
        <h2 className={sectionTitleClassName}>Aktivni modul: Serijska številka, servis in specifikacije</h2>
      </div>
      <div className="grid items-stretch gap-4 xl:grid-cols-[minmax(420px,0.95fr)_minmax(520px,1.05fr)]">
        <div className="flex h-full min-h-0 flex-col gap-4">
        <section className="flex min-h-[280px] flex-1 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white">
          <div className="flex items-center justify-between gap-2 px-4 py-3">
            <h3 className="text-sm font-semibold text-slate-900">Serijska številka / sledljivost</h3>
            <div className="flex items-center gap-2">
              <IconButton type="button" tone="neutral" className={adminTableNeutralIconButtonClassName} disabled={!editable} onClick={addSerial} aria-label="Dodaj serijsko številko" title="Dodaj serijsko številko"><PlusIcon /></IconButton>
              <IconButton
                type="button"
                tone={hasSelectedSerials ? 'danger' : 'neutral'}
                className={hasSelectedSerials ? adminTableSelectedDangerIconButtonClassName : adminTableNeutralIconButtonClassName}
                disabled={!editable || !hasSelectedSerials}
                onClick={removeSelectedSerials}
                aria-label="Odstrani izbrane serijske številke"
                title="Odstrani izbrane"
              >
                <TrashCanIcon />
              </IconButton>
            </div>
          </div>
          <div className="min-h-[220px] flex-1 overflow-auto border-t border-slate-200">
            <table className="min-w-full text-[12px] leading-5">
              <thead className="bg-[color:var(--admin-table-header-bg)]">
                <tr>
                  {editable ? (
                    <th className={`${adminTableHeaderCellCenterClassName} w-10 px-2`}>
                      <AdminCheckbox checked={allSerialsSelected} disabled={data.serialNumbers.length === 0} onChange={toggleAllSerials} />
                    </th>
                  ) : null}
                  <th className={adminTableHeaderCellLeftClassName}>Serijska št.</th>
                  <th className={adminTableHeaderCellCenterClassName}>Status</th>
                  <th className={adminTableHeaderCellCenterClassName}>Naročilo</th>
                  <th className={adminTableHeaderCellCenterClassName}>Odpremljeno</th>
                </tr>
              </thead>
              <tbody>
                {data.serialNumbers.length > 0 ? data.serialNumbers.map((row) => {
                  const inferredOrder = serialOrderAllocations.get(row.id);
                  const effectiveStatus = inferredOrder ? 'sold' : row.status;
                  return (
                    <tr key={row.id} className={`${adminTableRowHeightClassName} border-t border-slate-100`}>
                      {editable ? (
                        <td className={`${adminTableBodyCellCenterClassName} px-2`}>
                          <AdminCheckbox checked={selectedSerialIds.has(row.id)} onChange={() => toggleSerialSelection(row.id)} />
                        </td>
                      ) : null}
                      <td className={adminTableBodyCellLeftClassName}>
                        {editable ? (
                          <input
                            className={`${adminTableInlineEditInputClassName} font-semibold`}
                            value={row.serialNumber}
                            onChange={(event) => updateSerial(row.id, { serialNumber: event.target.value })}
                          />
                        ) : (
                          <span className="font-semibold text-slate-900">{row.serialNumber || '–'}</span>
                        )}
                      </td>
                      <td className={adminTableBodyCellCenterClassName}>
                        <MachineSerialStatusSelect
                          value={effectiveStatus}
                          editable={editable && !inferredOrder}
                          onChange={(status) => updateSerial(row.id, { status })}
                        />
                      </td>
                      <td className={`${adminTableBodyCellCenterClassName} font-semibold`}>
                        {inferredOrder ? (
                          <a
                            href={`/admin/orders/${inferredOrder.orderId}`}
                            className="text-slate-900 underline-offset-2 hover:text-[#1982bf] hover:underline"
                          >
                            {inferredOrder.orderNumber}
                          </a>
                        ) : (
                          <span className="text-slate-400">–</span>
                        )}
                      </td>
                      <td className={`${adminTableBodyCellCenterClassName} whitespace-nowrap tabular-nums`}>
                        {inferredOrder?.shippedAt ? (
                          <span className="font-medium text-slate-700">{formatMachineSerialDate(inferredOrder.shippedAt)}</span>
                        ) : (
                          <span className="text-slate-400">–</span>
                        )}
                      </td>
                    </tr>
                  );
                }) : (
                  <tr className={`${adminTableRowHeightClassName} border-t border-slate-100`}>
                    <td colSpan={editable ? 5 : 4} className="h-12 px-3 py-0 align-middle text-[12px] font-medium text-slate-500">Ni dodanih serijskih številk.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="flex h-[180px] flex-none flex-col overflow-hidden rounded-lg border border-slate-200 bg-white">
          <div className="flex h-12 items-center justify-between gap-3 border-b border-slate-200 px-4">
            <h3 className="text-sm font-semibold text-slate-900">Komplet vsebuje</h3>
            <div className="flex items-center gap-2">
              <IconButton type="button" tone="neutral" className={adminTableNeutralIconButtonClassName} disabled={!editable} onClick={() => update({ includedItems: [...data.includedItems, ''] })} aria-label="Dodaj postavko" title="Dodaj postavko"><PlusIcon /></IconButton>
              <IconButton
                type="button"
                tone={hasSelectedIncludedItems ? 'danger' : 'neutral'}
                className={hasSelectedIncludedItems ? adminTableSelectedDangerIconButtonClassName : adminTableNeutralIconButtonClassName}
                disabled={!editable || !hasSelectedIncludedItems}
                onClick={removeSelectedIncludedItems}
                aria-label="Odstrani izbrane postavke"
                title="Odstrani izbrane"
              >
                <TrashCanIcon />
              </IconButton>
            </div>
          </div>
          <div className="min-h-0 flex-1 divide-y divide-slate-100 overflow-y-auto">
            {data.includedItems.length > 0 ? data.includedItems.map((entry, index) => (
              <div key={`included-${index}`} className="grid grid-cols-[24px_minmax(0,1fr)] items-center gap-3 px-4 py-2">
                <span className="flex h-9 items-center justify-center">
                  {editable ? (
                    <AdminCheckbox checked={selectedIncludedIndexes.has(index)} onChange={() => toggleIncludedSelection(index)} />
                  ) : (
                    <span className="text-slate-400">–</span>
                  )}
                </span>
                {editable ? (
                  <input className={fieldFrameClassName} value={entry} onChange={(event) => updateIncludedItem(index, event.target.value)} />
                ) : (
                  <span className="flex h-9 items-center text-[13px] font-medium text-slate-700">{entry}</span>
                )}
              </div>
            )) : (
              <div className="px-4 py-4 text-[13px] font-medium text-slate-500">Ni dodanih postavk.</div>
            )}
          </div>
        </section>

        <section className="flex h-[180px] flex-none flex-col rounded-lg border border-orange-200 bg-orange-50/45 p-4">
          <div className="mb-3 flex items-center gap-2 text-orange-600">
            <svg
              aria-hidden="true"
              className="h-5 w-5 shrink-0"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m21.73 18-8-14a2 2 0 0 0-3.46 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" />
              <path d="M12 9v4" />
              <path d="M12 17h.01" />
            </svg>
            <h3 className="text-sm font-semibold">Posebna opozorila</h3>
          </div>
          <textarea
            className={`${fieldFrameClassName} min-h-0 flex-1 resize-none border-orange-200 bg-white px-4 py-3 text-[13px] leading-6 text-slate-700 shadow-sm focus:border-orange-300 focus:ring-orange-100`}
            value={data.warnings}
            disabled={!editable}
            onChange={(event) => update({ warnings: event.target.value })}
          />
        </section>
        </div>

        <section className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <div className="flex items-center justify-between gap-2 px-4 py-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Osnovne informacije</h3>
            </div>
            <div className="flex items-center gap-2">
              <IconButton type="button" tone="neutral" className={adminTableNeutralIconButtonClassName} disabled={!editable} onClick={addBasicInfoRow} aria-label="Dodaj osnovno informacijo" title="Dodaj osnovno informacijo"><PlusIcon /></IconButton>
              <IconButton
                type="button"
                tone={hasSelectedBasicInfo ? 'danger' : 'neutral'}
                className={hasSelectedBasicInfo ? adminTableSelectedDangerIconButtonClassName : adminTableNeutralIconButtonClassName}
                disabled={!editable || !hasSelectedBasicInfo}
                onClick={removeSelectedBasicInfoRows}
                aria-label="Odstrani izbrane osnovne informacije"
                title="Odstrani izbrane"
              >
                <TrashCanIcon />
              </IconButton>
            </div>
          </div>
        <div className="overflow-x-auto border-t border-slate-200">
          <table className="min-w-full text-[12px]">
            <thead className="bg-[color:var(--admin-table-header-bg)]">
              <tr>
                {editable ? (
                  <th className="w-10 px-2 py-2 text-center">
                    <AdminCheckbox checked={allBasicInfoSelected} disabled={data.basicInfoRows.length === 0} onChange={toggleAllBasicInfo} />
                  </th>
                ) : null}
                <th className={tableHeaderClassName}>Lastnost</th>
                <th className={tableHeaderClassName}>Vrednost</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-slate-100">
                {editable ? <td className="px-2 py-2" aria-hidden="true" /> : null}
                <td className={tableCellClassName}>Cena (z DDV)</td>
                <td className={tableCellClassName}>
                  <NumberField label="" value={data.basePrice} suffix="€" editable={editable} onChange={(value) => update({ basePrice: value })} />
                </td>
              </tr>
              <tr className="border-t border-slate-100">
                {editable ? <td className="px-2 py-2" aria-hidden="true" /> : null}
                <td className={tableCellClassName}>Zaloga</td>
                <td className={tableCellClassName}>
                  <IntegerUnitField value={data.stock} unitKind="piece" editable={editable} onChange={(value) => update({ stock: value })} />
                </td>
              </tr>
              <tr className="border-t border-slate-100">
                {editable ? <td className="px-2 py-2" aria-hidden="true" /> : null}
                <td className={tableCellClassName}>Dobavni rok</td>
                <td className={tableCellClassName}>
                  <QuantityRangeUnitField value={data.deliveryTime} unitKind="workday" editable={editable} onChange={(value) => update({ deliveryTime: formatQuantityRangeWithUnit(value, 'workday') })} />
                </td>
              </tr>
              <tr className="border-t border-slate-100">
                {editable ? <td className="px-2 py-2 text-center"><AdminCheckbox checked={false} disabled onChange={() => {}} /></td> : null}
                <td className={tableCellClassName}>
                  {editable ? <input className={fieldFrameClassName} value={data.warrantyLabel ?? 'Garancija'} onChange={(event) => update({ warrantyLabel: event.target.value })} /> : data.warrantyLabel || 'Garancija'}
                </td>
                <td className={tableCellClassName}>
                  <QuantityRangeUnitField value={data.warrantyMonths} unitKind="month" editable={editable} onChange={(value) => update({ warrantyMonths: value })} />
                </td>
              </tr>
              <tr className="border-t border-slate-100">
                {editable ? <td className="px-2 py-2 text-center"><AdminCheckbox checked={false} disabled onChange={() => {}} /></td> : null}
                <td className={tableCellClassName}>
                  {editable ? <input className={fieldFrameClassName} value={data.serviceIntervalLabel ?? 'Servisni interval'} onChange={(event) => update({ serviceIntervalLabel: event.target.value })} /> : data.serviceIntervalLabel || 'Servisni interval'}
                </td>
                <td className={tableCellClassName}>
                  <QuantityRangeUnitField value={data.serviceIntervalMonths} unitKind="month" editable={editable} onChange={(value) => update({ serviceIntervalMonths: value })} />
                </td>
              </tr>
              {data.basicInfoRows.map((row) => (
                <tr key={row.id} className="border-t border-slate-100">
                  {editable ? (
                    <td className="px-2 py-2 text-center">
                      <AdminCheckbox checked={selectedBasicInfoIds.has(row.id)} onChange={() => toggleBasicInfoSelection(row.id)} />
                    </td>
                  ) : null}
                  <td className={tableCellClassName}>{editable ? <input className={fieldFrameClassName} value={row.property} onChange={(event) => updateBasicInfoRow(row.id, { property: event.target.value })} /> : row.property}</td>
                  <td className={tableCellClassName}><SpecValueField value={row.value} editable={editable} onChange={(value) => updateBasicInfoRow(row.id, { value })} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-slate-200 px-4 py-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Tehnične specifikacije</h3>
          </div>
          <div className="flex items-center gap-2">
            <IconButton type="button" tone="neutral" className={adminTableNeutralIconButtonClassName} disabled={!editable} onClick={addSpec} aria-label="Dodaj specifikacijo" title="Dodaj specifikacijo"><PlusIcon /></IconButton>
            <IconButton
              type="button"
              tone={hasSelectedSpecs ? 'danger' : 'neutral'}
              className={hasSelectedSpecs ? adminTableSelectedDangerIconButtonClassName : adminTableNeutralIconButtonClassName}
              disabled={!editable || !hasSelectedSpecs}
              onClick={removeSelectedSpecs}
              aria-label="Odstrani izbrane specifikacije"
              title="Odstrani izbrane"
            >
              <TrashCanIcon />
            </IconButton>
          </div>
        </div>
        <div className="overflow-x-auto border-t border-slate-200">
          <table className="min-w-full text-[12px]">
            <thead className="bg-[color:var(--admin-table-header-bg)]">
              <tr>
                {editable ? (
                  <th className="w-10 px-2 py-2 text-center">
                    <AdminCheckbox checked={allSpecsSelected} disabled={data.specs.length === 0} onChange={toggleAllSpecs} />
                  </th>
                ) : null}
                <th className={tableHeaderClassName}>Lastnost</th>
                <th className={tableHeaderClassName}>Vrednost</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-slate-100">
                {editable ? <td className="px-2 py-2" aria-hidden="true" /> : null}
                <td className={tableCellClassName}>Dimenzije</td>
                <td className={tableCellClassName}>
                  <PackageDimensionField value={data.packageDimensions} editable={editable} onChange={(value) => update({ packageDimensions: value })} />
                </td>
              </tr>
              {data.specs.map((spec) => (
                <tr key={spec.id} className="border-t border-slate-100">
                  {editable ? (
                    <td className="px-2 py-2 text-center">
                      <AdminCheckbox checked={selectedSpecIds.has(spec.id)} onChange={() => toggleSpecSelection(spec.id)} />
                    </td>
                  ) : null}
                  <td className={tableCellClassName}>{editable ? <input className={fieldFrameClassName} value={spec.property} onChange={(event) => updateSpec(spec.id, { property: event.target.value })} /> : spec.property}</td>
                  <td className={tableCellClassName}><SpecValueField value={spec.value} editable={editable} onChange={(value) => updateSpec(spec.id, { value })} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </section>
      </div>

    </section>
  );
}

export function QuantityDiscountsCard({
  editable,
  quantityDiscounts,
  onAddDiscount,
  onRemoveDiscount,
  onUpdateDiscount,
  simulatorOptions,
  usesScopedCommercialTools = true,
  embedded = false,
  minQuantityLabel = 'Min. količina',
  minQuantityAllowsDecimal = false,
  className
}: {
  editable: boolean;
  quantityDiscounts: QuantityDiscountDraft[];
  onAddDiscount: () => void;
  onRemoveDiscount: (id: string) => void;
  onUpdateDiscount: (id: string, updates: Partial<QuantityDiscountDraft>) => void;
  simulatorOptions: SimulatorOption[];
  usesScopedCommercialTools?: boolean;
  embedded?: boolean;
  minQuantityLabel?: string;
  minQuantityAllowsDecimal?: boolean;
  className?: string;
}) {
  const [customerSuggestions, setCustomerSuggestions] = useState<string[]>([]);
  const [selectedDiscountIds, setSelectedDiscountIds] = useState<Set<string>>(new Set());
  const variantTargetSuggestions = useMemo(
    () => normalizeDiscountSuggestionList([
      allDiscountTargetLabel,
      ...simulatorOptions.map(getSimulatorOptionSku).filter(Boolean)
    ]),
    [simulatorOptions]
  );
  const customerTargetSuggestions = useMemo(
    () => normalizeDiscountSuggestionList([allDiscountTargetLabel, ...customerSuggestions]),
    [customerSuggestions]
  );
  const allDiscountsSelected = quantityDiscounts.length > 0 && quantityDiscounts.every((rule) => selectedDiscountIds.has(rule.id));
  const hasSelectedDiscounts = selectedDiscountIds.size > 0;
  const toggleDiscountSelection = (id: string) => {
    setSelectedDiscountIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const toggleAllDiscounts = () => {
    setSelectedDiscountIds(allDiscountsSelected ? new Set() : new Set(quantityDiscounts.map((rule) => rule.id)));
  };
  const removeSelectedDiscounts = () => {
    if (!hasSelectedDiscounts) return;
    Array.from(selectedDiscountIds).forEach(onRemoveDiscount);
    setSelectedDiscountIds(new Set());
  };
  const showDiscountActions = embedded || editable;

  useEffect(() => {
    if (!usesScopedCommercialTools) return;
    let cancelled = false;
    void fetch('/api/admin/orders/customers', { cache: 'no-store' })
      .then((response) => response.ok ? response.json() as Promise<{ customers?: unknown }> : { customers: [] })
      .then((payload) => {
        if (cancelled) return;
        const customers = Array.isArray(payload.customers)
          ? payload.customers.map((entry) => String(entry).trim()).filter(Boolean)
          : [];
        setCustomerSuggestions(customers);
      })
      .catch(() => {
        if (!cancelled) setCustomerSuggestions([]);
      });
    return () => {
      cancelled = true;
    };
  }, [usesScopedCommercialTools]);

  useEffect(() => {
    setSelectedDiscountIds((current) => {
      const validIds = new Set(quantityDiscounts.map((rule) => rule.id));
      const next = new Set(Array.from(current).filter((id) => validIds.has(id)));
      return next.size === current.size ? current : next;
    });
  }, [quantityDiscounts]);

  return (
    <section
      className={classNames(
        embedded ? 'border-t border-slate-200 bg-white' : adminWindowCardClassName,
        !embedded && 'h-full p-5',
        className
      )}
      style={embedded ? undefined : adminWindowCardStyle}
    >
      <div className={classNames('flex justify-between gap-3', embedded ? 'items-center border-b border-slate-200 px-4 py-3' : 'mb-3 items-start')}>
        {embedded ? (
          <h3 className="text-sm font-semibold text-slate-900">Količinski popusti</h3>
        ) : (
          <div>
            <h2 className={sectionTitleClassName}>Količinski popusti</h2>
            <p className="mt-1 text-[13px] font-medium text-slate-500">Privzeta pravila za popust glede na količino naročila.</p>
          </div>
        )}
        {showDiscountActions ? (
          <div className="flex items-center gap-2">
            <IconButton
              type="button"
              tone="neutral"
              className={adminTableNeutralIconButtonClassName}
              disabled={!editable}
              onClick={onAddDiscount}
              aria-label="Dodaj količinski popust"
              title="Dodaj količinski popust"
            >
              <PlusIcon />
            </IconButton>
            <IconButton
              type="button"
              tone={editable && hasSelectedDiscounts ? 'danger' : 'neutral'}
              className={editable && hasSelectedDiscounts ? adminTableSelectedDangerIconButtonClassName : adminTableNeutralIconButtonClassName}
              disabled={!editable || !hasSelectedDiscounts}
              onClick={removeSelectedDiscounts}
              aria-label="Odstrani izbrane količinske popuste"
              title="Odstrani izbrane"
            >
              <TrashCanIcon />
            </IconButton>
          </div>
        ) : null}
      </div>
      <div className={classNames('overflow-x-auto', !embedded && 'rounded-lg border border-slate-200')}>
        <table className="min-w-full text-[12px]">
          <thead className="bg-[color:var(--admin-table-header-bg)]">
            <tr>
              <th className="w-10 px-2 py-2 text-center">
                <AdminCheckbox checked={allDiscountsSelected} disabled={!editable || quantityDiscounts.length === 0} onChange={toggleAllDiscounts} />
              </th>
              <th className="w-[86px] px-3 py-2 text-center font-semibold text-slate-700">{minQuantityLabel}</th>
              <th className="w-[82px] px-3 py-2 text-center font-semibold text-slate-700">Popust</th>
              {usesScopedCommercialTools ? (
                <>
                  <th className="px-3 py-2 text-left font-semibold text-slate-700">Različice</th>
                  <th className="px-3 py-2 text-left font-semibold text-slate-700">Stranke</th>
                </>
              ) : (
                <th className="px-3 py-2 text-center font-semibold text-slate-700">Velja za</th>
              )}
            </tr>
          </thead>
          <tbody>
            {quantityDiscounts.length > 0 ? quantityDiscounts.map((rule) => (
              <tr key={rule.id} className="border-t border-slate-100">
                <td className="px-2 py-2 text-center">
                  <AdminCheckbox checked={selectedDiscountIds.has(rule.id)} disabled={!editable} onChange={() => toggleDiscountSelection(rule.id)} />
                </td>
                <td className="px-3 py-2 text-center">
                  {editable ? (
                    minQuantityAllowsDecimal ? (
                      <DecimalDraftInput
                        className={`${compactTableAlignedInputClassName} !mt-0 !w-[5ch] !px-0 text-center`}
                        value={rule.minQuantity}
                        onDecimalChange={(value) => onUpdateDiscount(rule.id, { minQuantity: Math.max(0, value) })}
                      />
                    ) : (
                      <input
                        type="number"
                        min={1}
                        className={`${compactTableAlignedInputClassName} !mt-0 !w-[5ch] !px-0 text-center`}
                        value={rule.minQuantity}
                        onChange={(event) => onUpdateDiscount(rule.id, { minQuantity: Math.max(1, Number(event.target.value) || 1) })}
                      />
                    )
                  ) : (
                    rule.minQuantity
                  )}
                </td>
                <td className="px-3 py-2 text-center">
                  {editable ? (
                    <span className={compactTableValueUnitShellClassName}>
                      <DecimalDraftInput
                        className={`${compactTableAlignedInputClassName} !mt-0 !w-[5ch] !px-0 text-right`}
                        value={formatDecimalForDisplay(rule.discountPercent)}
                        onDecimalChange={(value) => onUpdateDiscount(rule.id, { discountPercent: clampDiscountPercent(value) })}
                      />
                      <span className={compactTableAdornmentClassName}>%</span>
                    </span>
                  ) : (
                    formatPercent(rule.discountPercent)
                  )}
                </td>
                {usesScopedCommercialTools ? (
                  <>
                    <td className="min-w-[150px] px-3 py-2">
                      <DiscountTargetChipInput
                        editable={editable}
                        value={rule.variantTargets}
                        suggestions={variantTargetSuggestions}
                        listId={`discount-variants-${rule.id}`}
                        placeholder="SKU ali Vse"
                        onChange={(variantTargets) => onUpdateDiscount(rule.id, { variantTargets })}
                      />
                    </td>
                    <td className="min-w-[150px] px-3 py-2">
                      <DiscountTargetChipInput
                        editable={editable}
                        value={rule.customerTargets}
                        suggestions={customerTargetSuggestions}
                        listId={`discount-customers-${rule.id}`}
                        placeholder="Naročnik ali Vse"
                        onChange={(customerTargets) => onUpdateDiscount(rule.id, { customerTargets })}
                      />
                    </td>
                  </>
                ) : (
                  <td className="px-3 py-2 text-center">
                    <span className="font-medium text-slate-700">Vse različice</span>
                  </td>
                )}
              </tr>
            )) : (
              <tr className="border-t border-slate-100">
                <td colSpan={usesScopedCommercialTools ? 5 : 4} className="px-3 py-4 text-center text-[13px] font-medium text-slate-500">Ni aktivnih količinskih popustov.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function CommercialToolsPanel({
  productType = 'dimensions',
  hideQuantityDiscounts = false,
  editable,
  quantityDiscounts,
  onAddDiscount,
  onRemoveDiscount,
  onUpdateDiscount,
  simulatorOptions,
  selectedOptionId,
  onSelectedOptionIdChange,
  quantity,
  onQuantityChange,
  applyQuantityDiscounts,
  onApplyQuantityDiscountsChange
}: {
  productType?: ProductEditorType;
  hideQuantityDiscounts?: boolean;
  editable: boolean;
  quantityDiscounts: QuantityDiscountDraft[];
  onAddDiscount: () => void;
  onRemoveDiscount: (id: string) => void;
  onUpdateDiscount: (id: string, updates: Partial<QuantityDiscountDraft>) => void;
  simulatorOptions: SimulatorOption[];
  selectedOptionId: string;
  onSelectedOptionIdChange: (id: string) => void;
  quantity: number;
  onQuantityChange: (quantity: number) => void;
  applyQuantityDiscounts: boolean;
  onApplyQuantityDiscountsChange: (enabled: boolean) => void;
}) {
  const selectedOption = simulatorOptions.find((option) => option.id === selectedOptionId) ?? simulatorOptions[0] ?? null;
  const normalizedQuantity = Math.max(1, quantity || 1);
  const activeDiscount = applyQuantityDiscounts ? getBestQuantityDiscount(quantityDiscounts, normalizedQuantity, selectedOption) : null;
  const basePrice = selectedOption?.basePrice ?? 0;
  const discountPercent = activeDiscount?.discountPercent ?? 0;
  const discountedUnitPrice = Number((basePrice * (1 - discountPercent / 100)).toFixed(4));
  const subtotal = Number((discountedUnitPrice * normalizedQuantity).toFixed(2));
  const vat = Number((subtotal * 0.22).toFixed(2));
  const total = Number((subtotal + vat).toFixed(2));
  const quantityUnit = selectedOption?.quantityUnit ?? 'kos';
  const quantityUnitLabel = getSimulatorUnitLabel(quantityUnit, normalizedQuantity);
  const usesScopedCommercialTools = productType === 'dimensions' || productType === 'simple' || productType === 'weight' || productType === 'unique_machine';
  const weightBaseOption = selectedOption?.weightPricePerKg !== undefined
    ? selectedOption
    : simulatorOptions.find((option) => option.weightPricePerKg !== undefined) ?? selectedOption;
  const [customerSuggestions, setCustomerSuggestions] = useState<string[]>([]);
  const [selectedDiscountIds, setSelectedDiscountIds] = useState<Set<string>>(new Set());
  const [customWeightNetMass, setCustomWeightNetMass] = useState(1);
  const [customWeightBagCount, setCustomWeightBagCount] = useState(1);
  const [customWeightFraction, setCustomWeightFraction] = useState('');
  const weightFractionOptions = useMemo(
    () => Array.from(new Set(simulatorOptions.map((option) => option.weightFraction).filter((fraction): fraction is string => Boolean(fraction)))),
    [simulatorOptions]
  );
  const simulatorSelectOptions = useMemo(
    () => simulatorOptions.length > 0
      ? simulatorOptions.map((option) => ({ value: option.id, label: option.label }))
      : [{ value: '', label: 'Ni različic' }],
    [simulatorOptions]
  );
  const activeWeightFraction = customWeightFraction && weightFractionOptions.includes(customWeightFraction)
    ? customWeightFraction
    : weightFractionOptions[0] ?? '';
  const customWeightBaseOption = simulatorOptions.find((option) => option.weightFraction === activeWeightFraction && option.weightPricePerKg !== undefined)
    ?? weightBaseOption;
  const variantTargetSuggestions = useMemo(
    () => normalizeDiscountSuggestionList([
      allDiscountTargetLabel,
      ...simulatorOptions.map(getSimulatorOptionSku).filter(Boolean)
    ]),
    [simulatorOptions]
  );
  const customerTargetSuggestions = useMemo(
    () => normalizeDiscountSuggestionList([allDiscountTargetLabel, ...customerSuggestions]),
    [customerSuggestions]
  );
  const allDiscountsSelected = quantityDiscounts.length > 0 && quantityDiscounts.every((rule) => selectedDiscountIds.has(rule.id));
  const hasSelectedDiscounts = selectedDiscountIds.size > 0;
  const toggleDiscountSelection = (id: string) => {
    setSelectedDiscountIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const toggleAllDiscounts = () => {
    setSelectedDiscountIds(allDiscountsSelected ? new Set() : new Set(quantityDiscounts.map((rule) => rule.id)));
  };
  const removeSelectedDiscounts = () => {
    if (!hasSelectedDiscounts) return;
    Array.from(selectedDiscountIds).forEach(onRemoveDiscount);
    setSelectedDiscountIds(new Set());
  };
  const getWeightScenarioPrice = (netMassKg: number, bagCount: number, pricePerKg: number, packagingCostPerBag: number, scenarioOption: SimulatorOption | null = weightBaseOption) => {
    const normalizedNetMass = Math.max(0, netMassKg || 0);
    const normalizedBagCount = Math.max(1, Math.floor(bagCount || 1));
    const totalKg = Number(normalizedNetMass.toFixed(4));
    const base = Number((normalizedNetMass * pricePerKg + normalizedBagCount * packagingCostPerBag).toFixed(4));
    const discount = applyQuantityDiscounts ? getBestQuantityDiscount(quantityDiscounts, totalKg, scenarioOption) : null;
    const discountPercentForScenario = discount?.discountPercent ?? 0;
    const withoutVat = Number((base * (1 - discountPercentForScenario / 100)).toFixed(2));
    const withVat = Number((withoutVat * 1.22).toFixed(2));
    return { totalKg, base, discountPercent: discountPercentForScenario, withoutVat, withVat };
  };
  const customWeightScenario = getWeightScenarioPrice(
    customWeightNetMass,
    customWeightBagCount,
    customWeightBaseOption?.weightPricePerKg ?? 0,
    customWeightBaseOption?.weightPackagingCostPerBag ?? 0,
    customWeightBaseOption
  );
  const activeSimulatorOption = productType === 'weight' ? customWeightBaseOption : selectedOption;
  const activeSimulatorQuantity = productType === 'weight' ? customWeightScenario.totalKg : normalizedQuantity;
  const activeSimulatorUnit = productType === 'weight' ? 'kg' : activeSimulatorOption?.discountUnitLabel ?? quantityUnit;
  const activeSimulatorDiscount = applyQuantityDiscounts
    ? (productType === 'weight'
        ? getBestQuantityDiscount(quantityDiscounts, activeSimulatorQuantity, activeSimulatorOption)
        : activeDiscount)
    : null;
  const nextSimulatorDiscount = getNextQuantityDiscount(quantityDiscounts, activeSimulatorQuantity, activeSimulatorOption);
  const quickSimulatorQuantities = [10, 25, 50, 100];
  const quickWeightBagCounts = [1, 2, 5, 10];
  const summaryDiscountPercent = productType === 'weight' ? customWeightScenario.discountPercent : discountPercent;
  const summarySubtotal = productType === 'weight' ? customWeightScenario.withoutVat : subtotal;
  const summaryVat = productType === 'weight' ? Number((summarySubtotal * 0.22).toFixed(2)) : vat;
  const summaryTotal = productType === 'weight' ? customWeightScenario.withVat : total;
  const summaryBaseSubtotal = productType === 'weight'
    ? customWeightScenario.base
    : Number((basePrice * normalizedQuantity).toFixed(2));
  const summaryDiscountAmount = Math.max(0, Number((summaryBaseSubtotal - summarySubtotal).toFixed(2)));
  const weightPricePerKg = customWeightBaseOption?.weightPricePerKg ?? 0;
  const weightPackagingCost = customWeightBaseOption?.weightPackagingCostPerBag ?? 0;
  const weightMassSubtotal = Number((customWeightScenario.totalKg * weightPricePerKg).toFixed(2));
  const weightPackagingSubtotal = Number((customWeightBagCount * weightPackagingCost).toFixed(2));
  const selectedOptionLabel = selectedOption?.label ?? '—';
  const nonWeightSelectedLabel =
    productType === 'unique_machine'
      ? selectedOptionLabel
      : productType === 'dimensions'
        ? `Različica: ${selectedOptionLabel}`
        : selectedOptionLabel;
  const nonWeightSelectedDescription =
    productType === 'unique_machine'
      ? formatMachineSerialSummary(selectedOption?.serialLabels, normalizedQuantity)
      : productType === 'dimensions'
        ? 'cena izbrane dimenzijske različice brez DDV'
        : 'cena artikla brez DDV';
  const nonWeightCalculationLabel =
    productType === 'unique_machine'
      ? 'Skupaj'
      : productType === 'dimensions'
        ? 'Različice skupaj'
        : 'Artikli skupaj';
  const selectedProductSummaryIcon: OrderSummaryIconType =
    productType === 'unique_machine'
      ? 'uniqueMachine'
      : productType === 'dimensions'
        ? 'dimensions'
        : 'simple';
  const quantitySummaryIcon: OrderSummaryIconType = productType === 'dimensions' ? 'layers' : 'boxes';
  const stockSummaryIcon: OrderSummaryIconType = productType === 'dimensions' ? 'layersMinus' : 'boxes';
  const stockAfterOrderLabel = formatStockAfterOrder(
    activeSimulatorOption?.stockLabel,
    productType === 'weight' ? customWeightScenario.totalKg : normalizedQuantity
  );
  const orderSummaryDetailRows: OrderSummaryDetailRow[] = productType === 'weight'
    ? [
        {
          icon: 'weightGranules',
          label: `Frakcija: ${customWeightBaseOption?.weightFraction || customWeightBaseOption?.label || '—'}`,
          description: 'osnova za izračun brez DDV',
          value: formatCurrency(summaryBaseSubtotal)
        },
        { icon: 'scale', label: 'Cena / kg', value: `${formatCurrency(weightPricePerKg)} / kg` },
        { icon: 'bag', label: 'Strošek pakiranja / vrečko', value: formatCurrency(weightPackagingCost) },
        { icon: 'quantity', label: 'Količina', value: `${formatWeightKg(customWeightScenario.totalKg)} • ${formatWeightBagCount(customWeightBagCount)}` },
        { icon: 'discount', label: 'Količinski popust', value: formatPercent(summaryDiscountPercent) },
        ...(stockAfterOrderLabel ? [{ icon: 'stock' as const, label: 'Nova zaloga (po naročilu)', value: stockAfterOrderLabel }] : [])
      ]
    : [
        {
          icon: selectedProductSummaryIcon,
          label: nonWeightSelectedLabel,
          description: nonWeightSelectedDescription,
          value: selectedOption?.summaryLabel ?? formatCurrency(basePrice)
        },
        { icon: quantitySummaryIcon, label: 'Količina', value: formatSimulatorQuantityWithUnit(normalizedQuantity, quantityUnit) },
        { icon: 'discount', label: 'Količinski popust', value: formatPercent(summaryDiscountPercent) },
        ...(stockAfterOrderLabel ? [{ icon: stockSummaryIcon, label: 'Nova zaloga (po naročilu)', value: stockAfterOrderLabel }] : [])
      ];
  const orderSummaryCalculationRows: OrderSummaryCalculationRow[] = productType === 'weight'
    ? [
        {
          label: 'Skupna masa',
          detail: `${formatWeightKg(customWeightScenario.totalKg)} × ${formatCurrency(weightPricePerKg)} / kg`,
          value: formatCurrency(weightMassSubtotal)
        },
        {
          label: 'Pakiranje skupaj',
          detail: `${formatWeightBagCount(customWeightBagCount)} × ${formatCurrency(weightPackagingCost)}`,
          value: formatCurrency(weightPackagingSubtotal)
        }
      ]
    : [
        {
          label: nonWeightCalculationLabel,
          detail: `${formatSimulatorQuantityWithUnit(normalizedQuantity, quantityUnit)} × ${formatCurrency(basePrice)}`,
          value: formatCurrency(summaryBaseSubtotal)
        }
      ];
  orderSummaryCalculationRows.push(
    {
      label: `Popust (${formatPercent(summaryDiscountPercent)})`,
      value: `−${formatCurrency(summaryDiscountAmount)}`,
      tone: 'success'
    },
    { label: 'Skupaj brez DDV', value: formatCurrency(summarySubtotal), strong: true },
    { label: 'DDV (22 %)', value: formatCurrency(summaryVat), strong: true }
  );

  useEffect(() => {
    if (!usesScopedCommercialTools) return;
    let cancelled = false;
    void fetch('/api/admin/orders/customers', { cache: 'no-store' })
      .then((response) => response.ok ? response.json() as Promise<{ customers?: unknown }> : { customers: [] })
      .then((payload) => {
        if (cancelled) return;
        const customers = Array.isArray(payload.customers)
          ? payload.customers.map((entry) => String(entry).trim()).filter(Boolean)
          : [];
        setCustomerSuggestions(customers);
      })
      .catch(() => {
        if (!cancelled) setCustomerSuggestions([]);
      });
    return () => {
      cancelled = true;
    };
  }, [usesScopedCommercialTools]);

  useEffect(() => {
    setSelectedDiscountIds((current) => {
      const validIds = new Set(quantityDiscounts.map((rule) => rule.id));
      const next = new Set(Array.from(current).filter((id) => validIds.has(id)));
      return next.size === current.size ? current : next;
    });
  }, [quantityDiscounts]);

  return (
    <div className={usesScopedCommercialTools ? 'grid items-stretch gap-5 xl:grid-cols-2' : 'grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.95fr)]'}>
      <div className={usesScopedCommercialTools ? 'contents' : 'space-y-5'}>
        {!hideQuantityDiscounts ? (
        <section className={classNames(adminWindowCardClassName, 'p-5', usesScopedCommercialTools && 'xl:col-span-2')} style={adminWindowCardStyle}>
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <h2 className={sectionTitleClassName}>Količinski popusti</h2>
              <p className="mt-1 text-[13px] font-medium text-slate-500">Privzeta pravila za popust glede na količino naročila.</p>
            </div>
            {editable ? (
              <div className="flex items-center gap-2">
                <IconButton type="button" tone="neutral" className={adminTableNeutralIconButtonClassName} onClick={onAddDiscount} aria-label="Dodaj količinski popust" title="Dodaj količinski popust">
                  <PlusIcon />
                </IconButton>
                <IconButton
                  type="button"
                  tone={hasSelectedDiscounts ? 'danger' : 'neutral'}
                  className={hasSelectedDiscounts ? adminTableSelectedDangerIconButtonClassName : adminTableNeutralIconButtonClassName}
                  disabled={!hasSelectedDiscounts}
                  onClick={removeSelectedDiscounts}
                  aria-label="Odstrani izbrane količinske popuste"
                  title="Odstrani izbrane"
                >
                  <TrashCanIcon />
                </IconButton>
              </div>
            ) : null}
          </div>
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="min-w-full text-[12px]">
              <thead className="bg-[color:var(--admin-table-header-bg)]">
                <tr>
                  {editable ? (
                    <th className="w-10 px-2 py-2 text-center">
                      <AdminCheckbox checked={allDiscountsSelected} disabled={quantityDiscounts.length === 0} onChange={toggleAllDiscounts} />
                    </th>
                  ) : null}
                  <th className="w-[86px] px-3 py-2 text-center font-semibold text-slate-700">Min. količina</th>
                  <th className="w-[82px] px-3 py-2 text-center font-semibold text-slate-700">Popust</th>
                  {usesScopedCommercialTools ? (
                    <>
                      <th className="px-3 py-2 text-left font-semibold text-slate-700">Različice</th>
                      <th className="px-3 py-2 text-left font-semibold text-slate-700">Stranke</th>
                    </>
                  ) : (
                    <th className="px-3 py-2 text-center font-semibold text-slate-700">Velja za</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {quantityDiscounts.length > 0 ? quantityDiscounts.map((rule) => (
                  <tr key={rule.id} className="border-t border-slate-100">
                    {editable ? (
                      <td className="px-2 py-2 text-center">
                        <AdminCheckbox checked={selectedDiscountIds.has(rule.id)} onChange={() => toggleDiscountSelection(rule.id)} />
                      </td>
                    ) : null}
                    <td className="px-3 py-2 text-center">
                      {editable ? (
                        <input
                          type="number"
                          min={1}
                          className={`${compactTableAlignedInputClassName} !mt-0 !w-[5ch] !px-0 text-center`}
                          value={rule.minQuantity}
                          onChange={(event) => onUpdateDiscount(rule.id, { minQuantity: Math.max(1, Number(event.target.value) || 1) })}
                        />
                      ) : (
                        rule.minQuantity
                      )}
                    </td>
                    <td className="px-3 py-2 text-center">
                      {editable ? (
                        <span className={compactTableValueUnitShellClassName}>
                          <DecimalDraftInput
                            className={`${compactTableAlignedInputClassName} !mt-0 !w-[5ch] !px-0 text-right`}
                            value={formatDecimalForDisplay(rule.discountPercent)}
                            onDecimalChange={(value) => onUpdateDiscount(rule.id, { discountPercent: clampDiscountPercent(value) })}
                          />
                          <span className={compactTableAdornmentClassName}>%</span>
                        </span>
                      ) : (
                        formatPercent(rule.discountPercent)
                      )}
                    </td>
                    {usesScopedCommercialTools ? (
                      <>
                        <td className="min-w-[150px] px-3 py-2">
                          <DiscountTargetChipInput
                            editable={editable}
                            value={rule.variantTargets}
                            suggestions={variantTargetSuggestions}
                            listId={`discount-variants-${rule.id}`}
                            placeholder="SKU ali Vse"
                            onChange={(variantTargets) => onUpdateDiscount(rule.id, { variantTargets })}
                          />
                        </td>
                        <td className="min-w-[150px] px-3 py-2">
                          <DiscountTargetChipInput
                            editable={editable}
                            value={rule.customerTargets}
                            suggestions={customerTargetSuggestions}
                            listId={`discount-customers-${rule.id}`}
                            placeholder="Naročnik ali Vse"
                            onChange={(customerTargets) => onUpdateDiscount(rule.id, { customerTargets })}
                          />
                        </td>
                      </>
                    ) : (
                      <td className="px-3 py-2 text-center">
                        <span className="font-medium text-slate-700">Vse različice</span>
                      </td>
                    )}
                  </tr>
                )) : (
                  <tr className="border-t border-slate-100">
                    <td colSpan={editable ? (usesScopedCommercialTools ? 5 : 4) : (usesScopedCommercialTools ? 4 : 3)} className="px-3 py-4 text-center text-[13px] font-medium text-slate-500">Ni aktivnih količinskih popustov.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
        ) : null}

        {productType === 'weight' ? (
          <section className={`${adminWindowCardClassName} h-full p-5`} style={adminWindowCardStyle}>
            <SimulatorHeader
              description="Izberite frakcijo, skupno maso in število vrečk za predogled cene, popusta in zaloge."
              applyQuantityDiscounts={applyQuantityDiscounts}
              onApplyQuantityDiscountsChange={onApplyQuantityDiscountsChange}
            />
            <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(120px,0.7fr)_minmax(96px,0.58fr)]">
              <SimulatorControlField label="Frakcija">
                <CustomSelect
                  value={activeWeightFraction}
                  onChange={setCustomWeightFraction}
                  options={weightFractionOptions.length > 0
                    ? weightFractionOptions.map((fraction) => ({ value: fraction, label: fraction }))
                    : [{ value: '', label: 'Frakcija' }]}
                  disabled={weightFractionOptions.length === 0}
                  ariaLabel="Izberi frakcijo"
                  containerClassName="w-full"
                  triggerClassName="!h-10 !rounded-md !px-3 !text-[13px] !font-semibold !text-slate-900"
                  valueClassName="!text-[13px] !font-semibold"
                />
              </SimulatorControlField>
              <SimulatorControlField label="Skupna masa">
                <span className="flex h-10 rounded-md border border-slate-300 bg-white">
                  <DecimalDraftInput
                    className="h-full min-w-0 flex-1 rounded-l-md border-0 bg-transparent px-2.5 text-[13px] font-semibold text-slate-900 outline-none focus:ring-0"
                    value={formatDecimalForDisplay(customWeightNetMass)}
                    onDecimalChange={(value) => setCustomWeightNetMass(Math.max(0, value))}
                  />
                  <span className={fieldUnitAdornmentClassName} style={getUnitAdornmentStyle('kg')}>kg</span>
                </span>
              </SimulatorControlField>
              <SimulatorControlField label="Vrečke">
                <input
                  inputMode="numeric"
                  className="h-10 w-full rounded-md border border-slate-300 bg-white px-2.5 text-center text-[13px] font-semibold text-slate-900 outline-none focus:border-[#3e67d6] focus:ring-0"
                  value={customWeightBagCount}
                  onChange={(event) => setCustomWeightBagCount(Math.max(1, Math.floor(Number(event.target.value) || 1)))}
                />
              </SimulatorControlField>
            </div>
            <SimulatorOverviewCards
              title="Izbrana frakcija"
              sku={activeSimulatorOption ? getSimulatorOptionSku(activeSimulatorOption) : '—'}
              grossPrice={`${formatCurrency(customWeightScenario.withVat)} z DDV`}
              netPrice={`${formatCurrency(customWeightScenario.withoutVat)} brez DDV`}
              discountPercent={customWeightScenario.discountPercent}
              discountRange={getSimulatorDiscountRange(activeSimulatorDiscount, nextSimulatorDiscount, activeSimulatorUnit)}
              nextDiscountLabel={getSimulatorNextDiscountLabel(nextSimulatorDiscount, activeSimulatorUnit)}
              stockLabel={activeSimulatorOption?.stockLabel}
              minOrderLabel={activeSimulatorOption?.minOrderLabel}
            />
            <WeightSimulatorQuickSelections
              massValues={quickSimulatorQuantities}
              activeMass={customWeightNetMass}
              bagValues={quickWeightBagCounts}
              activeBagCount={customWeightBagCount}
              onMassSelect={setCustomWeightNetMass}
              onBagSelect={setCustomWeightBagCount}
            />
          </section>
        ) : productType === 'dimensions' ? (
          <section className={`${adminWindowCardClassName} h-full p-5`} style={adminWindowCardStyle}>
            <SimulatorHeader
              description="Pregled izračuna za izbrano dimenzijsko različico, količino in količinski popust."
              applyQuantityDiscounts={applyQuantityDiscounts}
              onApplyQuantityDiscountsChange={onApplyQuantityDiscountsChange}
            />
            <div className="mt-5 grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(150px,0.58fr)]">
              <SimulatorControlField label="Izbrana različica">
                <CustomSelect
                  value={selectedOption?.id ?? ''}
                  onChange={onSelectedOptionIdChange}
                  options={simulatorSelectOptions}
                  disabled={simulatorOptions.length === 0}
                  ariaLabel="Izberi dimenzijsko različico"
                  containerClassName="w-full"
                  triggerClassName="!h-10 !rounded-md !px-3 !text-[13px] !font-semibold !text-slate-900"
                  valueClassName="!text-[13px] !font-semibold"
                />
              </SimulatorControlField>
              <SimulatorControlField label="Količina">
                <span className="flex h-10 rounded-md border border-slate-300 bg-white">
                  <input
                    type="number"
                    min={1}
                    className="h-full min-w-0 flex-1 rounded-l-md border-0 bg-transparent px-2.5 text-[13px] font-semibold text-slate-900 outline-none focus:ring-0"
                    value={normalizedQuantity}
                    onChange={(event) => onQuantityChange(Math.max(1, Number(event.target.value) || 1))}
                  />
                  <span className={fieldUnitAdornmentClassName} style={getSimulatorUnitAdornmentStyle(quantityUnit)}>{quantityUnitLabel}</span>
                </span>
              </SimulatorControlField>
            </div>
            <SimulatorOverviewCards
              sku={selectedOption ? getSimulatorOptionSku(selectedOption) : '—'}
              grossPrice={`${formatCurrency(toGrossWithVat(basePrice))} z DDV`}
              netPrice={`${formatCurrency(basePrice)} brez DDV`}
              discountPercent={discountPercent}
              discountRange={getSimulatorDiscountRange(activeSimulatorDiscount, nextSimulatorDiscount, activeSimulatorUnit)}
              nextDiscountLabel={getSimulatorNextDiscountLabel(nextSimulatorDiscount, activeSimulatorUnit)}
              stockLabel={selectedOption?.stockLabel}
              minOrderLabel={selectedOption?.minOrderLabel}
            />
            <SimulatorQuickButtons
              values={quickSimulatorQuantities}
              activeValue={normalizedQuantity}
              disabled={false}
              onSelect={onQuantityChange}
            />
          </section>
        ) : productType === 'unique_machine' ? (
          <section className={`${adminWindowCardClassName} h-full p-5`} style={adminWindowCardStyle}>
            <SimulatorHeader
              description="Pregled izračuna za izbrani stroj, količino in količinski popust."
              applyQuantityDiscounts={applyQuantityDiscounts}
              onApplyQuantityDiscountsChange={onApplyQuantityDiscountsChange}
            />
            <div className="mt-5 grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(150px,0.58fr)]">
              <SimulatorControlField label="Izbrani stroj">
                <CustomSelect
                  value={selectedOption?.id ?? ''}
                  onChange={onSelectedOptionIdChange}
                  options={simulatorSelectOptions}
                  disabled={simulatorOptions.length === 0}
                  ariaLabel="Izberi stroj"
                  containerClassName="w-full"
                  triggerClassName="!h-10 !rounded-md !px-3 !text-[13px] !font-semibold !text-slate-900"
                  valueClassName="!text-[13px] !font-semibold"
                />
              </SimulatorControlField>
              <SimulatorControlField label="Količina">
                <span className="flex h-10 rounded-md border border-slate-300 bg-white">
                  <input
                    type="number"
                    min={1}
                    className="h-full min-w-0 flex-1 rounded-l-md border-0 bg-transparent px-2.5 text-[13px] font-semibold text-slate-900 outline-none focus:ring-0"
                    value={normalizedQuantity}
                    onChange={(event) => onQuantityChange(Math.max(1, Number(event.target.value) || 1))}
                  />
                  <span className={fieldUnitAdornmentClassName} style={getSimulatorUnitAdornmentStyle(quantityUnit)}>{quantityUnitLabel}</span>
                </span>
              </SimulatorControlField>
            </div>
            <SimulatorOverviewCards
              title="Izbrani stroj"
              sku={selectedOption ? getSimulatorOptionSku(selectedOption) : '—'}
              grossPrice={`${formatCurrency(toGrossWithVat(basePrice))} z DDV`}
              netPrice={`${formatCurrency(basePrice)} brez DDV`}
              discountPercent={discountPercent}
              discountRange={getSimulatorDiscountRange(activeSimulatorDiscount, nextSimulatorDiscount, activeSimulatorUnit)}
              nextDiscountLabel={getSimulatorNextDiscountLabel(nextSimulatorDiscount, activeSimulatorUnit)}
              stockLabel={selectedOption?.stockLabel}
              minOrderLabel={selectedOption?.minOrderLabel}
            />
            <SimulatorQuickButtons
              values={quickSimulatorQuantities}
              activeValue={normalizedQuantity}
              disabled={false}
              onSelect={onQuantityChange}
            />
          </section>
        ) : (
          <section className={`${adminWindowCardClassName} h-full p-5`} style={adminWindowCardStyle}>
            <SimulatorHeader
              description="Predogled izračuna na podlagi izbrane različice, količine in pravil popustov."
              applyQuantityDiscounts={applyQuantityDiscounts}
              onApplyQuantityDiscountsChange={onApplyQuantityDiscountsChange}
            />
            <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_160px]">
              <SimulatorControlField label="Izbrani artikel">
                {simulatorOptions.length > 1 ? (
                  <CustomSelect
                    value={selectedOption?.id ?? ''}
                    onChange={onSelectedOptionIdChange}
                    options={simulatorSelectOptions}
                    disabled={simulatorOptions.length === 0}
                    ariaLabel="Izberi artikel"
                    containerClassName="w-full"
                    triggerClassName="!h-10 !rounded-md !px-3 !text-[13px] !font-semibold !text-slate-900"
                    valueClassName="!text-[13px] !font-semibold"
                  />
                ) : (
                  <div className="flex h-10 w-full items-center rounded-md border border-slate-300 bg-slate-50 px-3 text-[13px] font-semibold text-slate-900">
                    <span className="min-w-0 truncate">{selectedOption?.label ?? '—'}</span>
                  </div>
                )}
              </SimulatorControlField>
              <SimulatorControlField label="Količina">
                <span className="flex h-10 rounded-md border border-slate-300 bg-white">
                  <input
                    type="number"
                    min={1}
                    className="h-full min-w-0 flex-1 rounded-l-md border-0 bg-transparent px-2.5 text-[13px] font-semibold text-slate-900 outline-none focus:ring-0"
                    value={normalizedQuantity}
                    onChange={(event) => onQuantityChange(Math.max(1, Number(event.target.value) || 1))}
                  />
                  <span className={fieldUnitAdornmentClassName} style={getSimulatorUnitAdornmentStyle(quantityUnit)}>{quantityUnitLabel}</span>
                </span>
              </SimulatorControlField>
            </div>
            <SimulatorOverviewCards
              title="Izbrani artikel"
              sku={selectedOption ? getSimulatorOptionSku(selectedOption) : '—'}
              grossPrice={`${formatCurrency(toGrossWithVat(basePrice))} z DDV`}
              netPrice={`${formatCurrency(basePrice)} brez DDV`}
              discountPercent={discountPercent}
              discountRange={getSimulatorDiscountRange(activeSimulatorDiscount, nextSimulatorDiscount, activeSimulatorUnit)}
              nextDiscountLabel={getSimulatorNextDiscountLabel(nextSimulatorDiscount, activeSimulatorUnit)}
              stockLabel={selectedOption?.stockLabel}
              minOrderLabel={selectedOption?.minOrderLabel}
            />
            <SimulatorQuickButtons
              values={quickSimulatorQuantities}
              activeValue={normalizedQuantity}
              disabled={false}
              onSelect={onQuantityChange}
            />
          </section>
        )}
      </div>

      <OrderSummaryCard
        compact={usesScopedCommercialTools}
        detailRows={orderSummaryDetailRows}
        calculationRows={orderSummaryCalculationRows}
        total={formatCurrency(summaryTotal)}
      />
    </div>
  );
}

export const DimensionOrderPricingPanel = CommercialToolsPanel;

function SimulatorHeader({
  description,
  applyQuantityDiscounts,
  onApplyQuantityDiscountsChange
}: {
  description?: ReactNode;
  applyQuantityDiscounts: boolean;
  onApplyQuantityDiscountsChange: (enabled: boolean) => void;
}) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-3 gap-y-2">
      <h2 className="min-w-0 text-[20px] font-semibold tracking-tight text-slate-900">Simulator cene naročila</h2>
      <label className="flex shrink-0 items-center gap-2.5 justify-self-end pt-0.5">
        <input
          type="checkbox"
          className="peer sr-only"
          checked={applyQuantityDiscounts}
          onChange={(event) => onApplyQuantityDiscountsChange(event.target.checked)}
        />
        <span className="relative inline-flex h-5 w-9 shrink-0 rounded-full bg-slate-300 transition peer-checked:bg-[#1982bf] after:absolute after:left-0.5 after:top-0.5 after:h-4 after:w-4 after:rounded-full after:bg-white after:transition peer-checked:after:translate-x-4" />
        <span className="min-w-0">
          <span className="block whitespace-nowrap text-[13px] font-semibold text-slate-700">Upoštevaj količinske popuste</span>
          <span className="block truncate text-[11px] text-slate-500">Pragovi iz tabele</span>
        </span>
      </label>
      {description ? <p className="col-span-2 mb-2 mt-1 text-[13px] font-normal leading-5 text-slate-500">{description}</p> : null}
    </div>
  );
}

function SimulatorControlField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[13px] font-semibold text-slate-600">{label}</span>
      {children}
    </label>
  );
}

function SimulatorCardIcon({ type }: { type: 'variant' | 'discount' | 'stock' }) {
  const path = {
    variant: (
      <>
        <path d="M5 7h14v12H5z" />
        <path d="M8 7V4h8v3" />
        <path d="M9 11h2" />
        <path d="M13 11h2" />
      </>
    ),
    discount: (
      <>
        <path d="M20 12 12 20 4 12V4h8z" />
        <path d="M8.5 8.5h.01" />
      </>
    ),
    stock: (
      <>
        <path d="M4 8h16v12H4z" />
        <path d="M7 8V5h10v3" />
        <path d="M8 12h8" />
      </>
    )
  }[type];

  return (
    <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[#eaf4ff] text-[#1982bf]">
      <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {path}
      </svg>
    </span>
  );
}

function SimulatorMetricCard({
  icon,
  title,
  children
}: {
  icon: 'variant' | 'discount' | 'stock';
  title: string;
  children: ReactNode;
}) {
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-3.5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <div className="flex items-center gap-2.5">
        <SimulatorCardIcon type={icon} />
        <h3 className="whitespace-nowrap text-[14px] font-semibold text-slate-900">{title}</h3>
      </div>
      <div className="my-2 border-t border-dashed border-slate-200" />
      <div className="space-y-1.5 text-[12px] leading-4 text-slate-500">{children}</div>
    </article>
  );
}

function formatSimulatorAmount(value: number) {
  return formatDecimalForDisplay(Number(value.toFixed(2)));
}

function getSimulatorRangeEndBefore(nextMinQuantity: number) {
  if (Number.isInteger(nextMinQuantity)) return Math.max(0, nextMinQuantity - 1);
  return Math.max(0, Number((nextMinQuantity - 0.01).toFixed(2)));
}

function getSimulatorDiscountRange(
  activeDiscount: QuantityDiscountDraft | null,
  nextDiscount: QuantityDiscountDraft | null,
  unit: string
) {
  const minQuantity = activeDiscount?.minQuantity ?? 0;

  if (!nextDiscount) {
    return `${formatSimulatorAmount(minQuantity)}+ ${getSimulatorUnitLabel(unit, minQuantity)}`;
  }

  const maxQuantity = getSimulatorRangeEndBefore(nextDiscount.minQuantity);
  if (maxQuantity <= minQuantity) {
    return `${formatSimulatorAmount(minQuantity)} ${getSimulatorUnitLabel(unit, minQuantity)}`;
  }

  return `${formatSimulatorAmount(minQuantity)}–${formatSimulatorAmount(maxQuantity)} ${getSimulatorUnitLabel(unit, maxQuantity)}`;
}

function getSimulatorNextDiscountLabel(nextDiscount: QuantityDiscountDraft | null, unit: string): SimulatorNextDiscountLabel {
  if (!nextDiscount) return { value: 'najvišji prag dosežen', topReached: true };

  return {
    value: `${formatSimulatorAmount(nextDiscount.minQuantity)} ${getSimulatorUnitLabel(unit, nextDiscount.minQuantity)} → ${formatPercent(nextDiscount.discountPercent)}`,
    topReached: false
  };
}

function isEmptySimulatorStock(stockLabel: string | undefined) {
  if (!stockLabel) return false;
  const match = stockLabel.trim().match(/^(-?\d+(?:[,.]\d+)?)/);
  if (!match) return false;
  return Number((match[1] ?? '').replace(',', '.')) <= 0;
}

function SimulatorOverviewCards({
  title = 'Izbrana različica',
  sku,
  grossPrice,
  netPrice,
  discountPercent,
  discountRange,
  nextDiscountLabel,
  stockLabel,
  minOrderLabel
}: {
  title?: string;
  sku: string;
  grossPrice: string;
  netPrice: string;
  discountPercent: number;
  discountRange: string;
  nextDiscountLabel: SimulatorNextDiscountLabel;
  stockLabel?: string;
  minOrderLabel?: string;
}) {
  const stockEmpty = isEmptySimulatorStock(stockLabel);

  return (
    <div className="mt-5 grid gap-3 md:grid-cols-3">
      <SimulatorMetricCard icon="variant" title={title}>
        <p>SKU: <span className="font-medium text-slate-700">{sku}</span></p>
        <p className="pt-0.5 text-[13px] font-semibold text-slate-900">{grossPrice}</p>
        <p>{netPrice}</p>
      </SimulatorMetricCard>
      <SimulatorMetricCard icon="discount" title="Popust">
        <p>
          <span className="text-[13px] font-semibold text-[#1982bf]">{formatCompactPercent(discountPercent)}</span>
          <span className="font-medium text-slate-500"> na {discountRange}</span>
        </p>
        <p className="text-[11px] leading-4">
          <span>Naslednji prag: </span>
          <span className={nextDiscountLabel.topReached ? 'break-words' : 'whitespace-nowrap'}>{nextDiscountLabel.value}</span>
        </p>
      </SimulatorMetricCard>
      <SimulatorMetricCard icon="stock" title="Zaloga">
        <p className="text-[13px] font-semibold text-[#1982bf]">{stockLabel || '—'}</p>
        <p>{stockEmpty ? 'Ni na zalogi' : 'Na voljo'}</p>
        {minOrderLabel ? <p>Min. naročilo: {minOrderLabel}</p> : null}
      </SimulatorMetricCard>
    </div>
  );
}

function WeightSimulatorQuickSelections({
  massValues,
  activeMass,
  bagValues,
  activeBagCount,
  onMassSelect,
  onBagSelect
}: {
  massValues: number[];
  activeMass: number;
  bagValues: number[];
  activeBagCount: number;
  onMassSelect: (value: number) => void;
  onBagSelect: (value: number) => void;
}) {
  return (
    <div className="mt-5">
      <h3 className="text-[13px] font-semibold text-slate-900">Hitri izračuni</h3>
      <QuickSelectionRow
        label="Skupna masa"
        values={massValues}
        activeValue={activeMass}
        unit="kg"
        onSelect={onMassSelect}
      />
      <QuickSelectionRow
        label="Vrečke"
        values={bagValues}
        activeValue={activeBagCount}
        onSelect={onBagSelect}
      />
    </div>
  );
}

function QuickSelectionRow({
  label,
  values,
  activeValue,
  unit,
  onSelect
}: {
  label: string;
  values: number[];
  activeValue: number;
  unit?: string;
  onSelect: (value: number) => void;
}) {
  return (
    <div className="mt-2.5 grid items-center gap-2 sm:grid-cols-[94px_minmax(0,1fr)]">
      <span className="text-[12px] font-semibold text-slate-600">{label}</span>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {values.map((value) => {
          const active = Math.abs(activeValue - value) < 0.001;
          return (
            <button
              key={`${label}-${value}`}
              type="button"
              aria-pressed={active}
              onClick={() => onSelect(value)}
              className={classNames(
                'h-9 rounded-md border text-[12px] font-semibold transition',
                active
                  ? 'border-[#1982bf] bg-[#1982bf] text-white shadow-[0_8px_18px_rgba(25,130,191,0.18)]'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-[#1982bf] hover:text-[#1982bf]'
              )}
            >
              {value}{unit ? ` ${unit}` : ''}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function SimulatorQuickButtons({
  values,
  activeValue,
  disabled,
  onSelect
}: {
  values: number[];
  activeValue: number;
  disabled: boolean;
  onSelect: (value: number) => void;
}) {
  return (
    <div className="mt-5">
      <h3 className="text-[13px] font-semibold text-slate-900">Hitri izračuni</h3>
      <div className="mt-2.5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {values.map((value) => {
          const active = Math.abs(activeValue - value) < 0.001;
          return (
            <button
              key={value}
              type="button"
              aria-pressed={active}
              disabled={disabled}
              onClick={() => onSelect(value)}
              className={classNames(
                'h-9 rounded-md border text-[13px] font-semibold transition disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400',
                active
                  ? 'border-[#1982bf] bg-[#1982bf] text-white shadow-[0_8px_18px_rgba(25,130,191,0.18)]'
                  : 'border-[#1982bf] bg-white text-[#1982bf] hover:bg-[#f2f8ff]'
              )}
            >
              {value}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function MachineSerialStatusChip({ status }: { status: MachineSerialStatus }) {
  return (
    <Chip size="adminStatusInfo" variant={machineSerialStatusVariant[status]} className={adminStatusInfoPillCompactTableClassName}>
      {getMachineSerialStatusLabel(status)}
    </Chip>
  );
}

function MachineSerialStatusSelect({
  value,
  editable,
  onChange
}: {
  value: MachineSerialStatus;
  editable: boolean;
  onChange: (value: MachineSerialStatus) => void;
}) {
  if (!editable) return <MachineSerialStatusChip status={value} />;

  return (
    <CustomSelect
      value={value}
      onChange={onChange}
      options={machineSerialStatusOptions}
      ariaLabel="Status serijske številke"
      containerClassName="mx-auto w-[132px]"
      triggerClassName="!h-7 !rounded-lg !border-slate-200 !bg-white !px-2 !py-0 !text-[12px] !font-semibold !leading-none !text-slate-700"
      valueClassName="!text-center !font-semibold"
      menuClassName="min-w-full"
    />
  );
}

function NumberField({
  label,
  value,
  suffix,
  editable,
  onChange
}: {
  label: string;
  value: number;
  suffix?: string;
  editable: boolean;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block">
      {label ? <span className={smallLabelClassName}>{label}</span> : null}
      <span className="flex h-9 rounded-md border border-slate-300 bg-white">
        <DecimalDraftInput
          className="h-full min-w-0 flex-1 rounded-l-md border-0 bg-transparent px-2.5 text-[13px] font-semibold text-slate-900 outline-none focus:ring-0 disabled:cursor-not-allowed disabled:bg-[color:var(--field-locked-bg)] disabled:text-slate-500"
          disabled={!editable}
          value={value}
          onDecimalChange={onChange}
        />
        {suffix ? <span className={fieldUnitAdornmentClassName} style={getUnitAdornmentStyle(suffix)}>{suffix}</span> : null}
      </span>
    </label>
  );
}

function IntegerUnitField({
  value,
  unitKind,
  editable,
  onChange
}: {
  value: number;
  unitKind: QuantityUnitKind;
  editable: boolean;
  onChange: (value: number) => void;
}) {
  const displayValue = String(Math.max(0, Math.floor(Number(value) || 0)));

  return (
    <span className="flex h-9 rounded-md border border-slate-300 bg-white">
      <input
        inputMode="numeric"
        className="h-full min-w-0 flex-1 rounded-l-md border-0 bg-transparent px-2.5 text-[13px] font-semibold text-slate-900 outline-none focus:ring-0 disabled:cursor-not-allowed disabled:bg-[color:var(--field-locked-bg)] disabled:text-slate-500"
        disabled={!editable}
        value={displayValue}
        onChange={(event) => {
          const digits = event.target.value.replace(/\D/g, '').replace(/^0+(?=\d)/, '');
          onChange(digits ? Number(digits) : 0);
        }}
      />
      <span className={fieldUnitAdornmentClassName} style={getQuantityUnitAdornmentStyle(unitKind)}>{getInflectedQuantityUnit(displayValue, unitKind)}</span>
    </span>
  );
}

function QuantityRangeUnitField({
  value,
  unitKind,
  editable,
  onChange
}: {
  value: string;
  unitKind: QuantityUnitKind;
  editable: boolean;
  onChange: (value: string) => void;
}) {
  const displayValue = extractQuantityRange(value);

  return (
    <span className="flex h-9 rounded-md border border-slate-300 bg-white">
      <input
        inputMode="numeric"
        className="h-full min-w-0 flex-1 rounded-l-md border-0 bg-transparent px-2.5 text-[13px] font-semibold text-slate-900 outline-none focus:ring-0 disabled:cursor-not-allowed disabled:bg-[color:var(--field-locked-bg)] disabled:text-slate-500"
        disabled={!editable}
        value={displayValue}
        onChange={(event) => onChange(sanitizeQuantityRangeInput(event.target.value))}
        placeholder="1-2"
      />
      <span className={fieldUnitAdornmentClassName} style={getQuantityUnitAdornmentStyle(unitKind)}>{getInflectedQuantityUnit(displayValue, unitKind)}</span>
    </span>
  );
}

function splitSpecValueSuffix(value: string): { main: string; suffix: string } {
  const trimmed = value.trim();
  if (!trimmed) return { main: '', suffix: '' };
  const match = trimmed.match(/^([0-9]+(?:[.,][0-9]+)?)\s+(.+)$/u);
  if (!match) return { main: trimmed, suffix: '' };
  return { main: match[1] ?? '', suffix: match[2] ?? '' };
}

function joinSpecValueSuffix(main: string, suffix: string) {
  const normalizedMain = main.trim();
  const normalizedSuffix = suffix.trim();
  return [normalizedMain, normalizedSuffix].filter(Boolean).join(' ');
}

function splitPackageDimensionUnit(value: string): { main: string; suffix: string } {
  const trimmed = value.trim();
  if (!trimmed) return { main: '', suffix: 'mm' };
  const match = trimmed.match(/^(.*\S)\s+([^\d\s]+)$/u);
  if (!match) return { main: trimmed, suffix: 'mm' };
  return { main: match[1] ?? '', suffix: match[2] ?? 'mm' };
}

function PackageDimensionField({
  value,
  editable,
  onChange
}: {
  value: string;
  editable: boolean;
  onChange: (value: string) => void;
}) {
  const { main, suffix } = splitPackageDimensionUnit(value);

  if (!editable) {
    return (
      <span className="flex h-9 rounded-md border border-transparent">
        <span className="inline-flex h-full min-w-0 flex-1 items-center px-2.5 text-[13px] font-semibold text-slate-900">{main || '—'}</span>
        {main ? <span className={fieldUnitAdornmentClassName} style={getUnitAdornmentStyle(suffix || 'mm')}>{suffix}</span> : null}
      </span>
    );
  }

  return (
    <span className="flex h-9 rounded-md border border-slate-300 bg-white">
      <input
        className="h-full min-w-0 flex-1 rounded-l-md border-0 bg-transparent px-2.5 text-[13px] font-semibold text-slate-900 outline-none focus:ring-0 disabled:cursor-not-allowed disabled:bg-[color:var(--field-locked-bg)] disabled:text-slate-500"
        value={main}
        onChange={(event) => onChange(joinSpecValueSuffix(event.target.value, suffix))}
      />
      <input
        className={fieldUnitInputClassName}
        style={getUnitAdornmentStyle(suffix || 'mm')}
        value={suffix}
        onChange={(event) => onChange(joinSpecValueSuffix(main, event.target.value || 'mm'))}
        placeholder="enota"
      />
    </span>
  );
}

function SpecValueField({
  value,
  editable,
  onChange
}: {
  value: string;
  editable: boolean;
  onChange: (value: string) => void;
}) {
  const { main, suffix } = splitSpecValueSuffix(value);

  if (!editable) {
    return (
      <span className="flex h-9 rounded-md border border-transparent">
        <span className="inline-flex h-full min-w-0 flex-1 items-center px-2.5 text-[13px] font-semibold text-slate-900">{main || '—'}</span>
        {suffix ? <span className={fieldUnitAdornmentClassName} style={getUnitAdornmentStyle(suffix)}>{suffix}</span> : null}
      </span>
    );
  }

  return (
    <span className="flex h-9 rounded-md border border-slate-300 bg-white">
      <input
        className="h-full min-w-0 flex-1 rounded-l-md border-0 bg-transparent px-2.5 text-[13px] font-semibold text-slate-900 outline-none focus:ring-0 disabled:cursor-not-allowed disabled:bg-[color:var(--field-locked-bg)] disabled:text-slate-500"
        value={main}
        onChange={(event) => onChange(joinSpecValueSuffix(event.target.value, suffix))}
      />
      <input
        className={fieldUnitInputClassName}
        style={getUnitAdornmentStyle(suffix || 'enota', 2)}
        value={suffix}
        onChange={(event) => onChange(joinSpecValueSuffix(main, event.target.value))}
        placeholder="enota"
      />
    </span>
  );
}

function TextField({
  label,
  value,
  suffix,
  compact = false,
  editable,
  onChange
}: {
  label: string;
  value: string;
  suffix?: string;
  compact?: boolean;
  editable: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      {label ? <span className={smallLabelClassName}>{label}</span> : null}
      <span className={classNames('flex rounded-md border border-slate-300 bg-white', compact ? 'h-[30px]' : 'h-9')}>
        <input
          className={classNames(
            'h-full min-w-0 flex-1 rounded-l-md border-0 bg-transparent font-semibold text-slate-900 outline-none focus:ring-0 disabled:cursor-not-allowed disabled:bg-[color:var(--field-locked-bg)] disabled:text-slate-500',
            compact ? 'px-2 text-xs' : 'px-2.5 text-[13px]'
          )}
          disabled={!editable}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
        {suffix ? <span className={fieldUnitAdornmentClassName} style={getUnitAdornmentStyle(suffix)}>{suffix}</span> : null}
      </span>
    </label>
  );
}

function SelectField({
  label,
  value,
  editable,
  options,
  className,
  onChange
}: {
  label: string;
  value: string;
  editable: boolean;
  options: Array<{ value: string; label: string }>;
  className?: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className={classNames('block', className)}>
      <span className={smallLabelClassName}>{label}</span>
      <select className={fieldFrameClassName} disabled={!editable} value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </label>
  );
}

function ToggleRow({
  label,
  enabled,
  editable,
  onChange
}: {
  label: string;
  enabled: boolean;
  editable: boolean;
  onChange: (enabled: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-3 text-[13px] font-medium text-slate-700">
      <span>{label}</span>
      <input type="checkbox" className="peer sr-only" checked={enabled} disabled={!editable} onChange={(event) => onChange(event.target.checked)} />
      <span className="relative inline-flex h-5 w-9 shrink-0 rounded-full bg-slate-300 transition peer-checked:bg-emerald-500 peer-disabled:opacity-60 after:absolute after:left-0.5 after:top-0.5 after:h-4 after:w-4 after:rounded-full after:bg-white after:transition peer-checked:after:translate-x-4" />
    </label>
  );
}

function NumberInline({
  value,
  suffix,
  onChange
}: {
  value: number;
  suffix?: string;
  onChange: (value: number) => void;
}) {
  return (
    <span className={compactTableValueUnitShellClassName}>
      <DecimalDraftInput
        className={`${compactTableAlignedInputClassName} !mt-0 !w-16 text-right`}
        value={value}
        onDecimalChange={onChange}
      />
      {suffix ? <span className={compactTableAdornmentClassName}>{suffix}</span> : null}
    </span>
  );
}

function DecimalDraftInput({
  value,
  className,
  disabled,
  onDecimalChange
}: {
  value: number | string;
  className?: string;
  disabled?: boolean;
  onDecimalChange: (value: number) => void;
}) {
  const normalizedValue = typeof value === 'number' ? formatDecimalForDisplay(value) : value;
  const [draftValue, setDraftValue] = useState(normalizedValue);
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    if (!isFocused) setDraftValue(normalizedValue);
  }, [isFocused, normalizedValue]);

  return (
    <input
      type="text"
      inputMode="decimal"
      className={className}
      disabled={disabled}
      value={isFocused ? draftValue : normalizedValue}
      onFocus={() => {
        setIsFocused(true);
        setDraftValue(normalizedValue);
      }}
      onChange={(event) => {
        const nextValue = event.target.value;
        setDraftValue(nextValue);
        const parsed = parseDecimalInput(nextValue);
        if (parsed !== null) onDecimalChange(parsed);
      }}
      onBlur={() => {
        const parsed = parseDecimalInput(draftValue);
        if (parsed !== null) {
          onDecimalChange(parsed);
          setDraftValue(formatDecimalForDisplay(parsed));
        } else {
          setDraftValue(normalizedValue);
        }
        setIsFocused(false);
      }}
    />
  );
}

function VatIncludedPriceInline({
  value,
  editable,
  inputSuffix,
  grossUnit,
  netUnit,
  onChange
}: {
  value: number;
  editable: boolean;
  inputSuffix: string;
  grossUnit: string;
  netUnit: string;
  onChange: (netValue: number) => void;
}) {
  const grossValue = toGrossWithVat(value);
  return (
    <span className="inline-flex h-6 items-center justify-end gap-1 whitespace-nowrap text-[11px] text-slate-700">
      {editable ? (
        <NumberInline value={grossValue} suffix={inputSuffix} onChange={(nextGrossValue) => onChange(toNetFromGross(nextGrossValue))} />
      ) : (
        <span className={compactTableValueUnitShellClassName}>
          <span className="inline-flex h-6 w-16 items-center justify-end rounded-md border border-transparent px-0.5 text-[11px] text-slate-900 tabular-nums">
            {formatDecimalForDisplay(grossValue)}
          </span>
          <span className={compactTableAdornmentClassName}>{grossUnit}</span>
        </span>
      )}
      <span className="text-[11px] text-slate-500">
        ({formatDecimalForDisplay(value)} {netUnit})
      </span>
    </span>
  );
}

function ChipInputGroup({
  label,
  chips,
  editable,
  placeholder,
  onChange
}: {
  label: string;
  chips: string[];
  editable: boolean;
  placeholder: string;
  onChange: (chips: string[]) => void;
}) {
  const [input, setInput] = useState('');
  const addChip = () => {
    const value = input.trim();
    if (!value || chips.includes(value)) return;
    onChange([...chips, value]);
    setInput('');
  };
  return (
    <div>
      {label ? <span className={smallLabelClassName}>{label}</span> : null}
      <div className={classNames(
        'flex h-[30px] flex-nowrap items-center gap-2 overflow-hidden rounded-md border border-slate-300 pl-[10px] pr-2',
        editable ? 'bg-white' : '!bg-[color:var(--field-locked-bg)] text-slate-500'
      )}>
        {chips.map((chip) => (
          <span key={chip} className={classNames(adminProductInputChipClassName, 'shrink-0 whitespace-nowrap')}>
            {formatWeightChipLabel(chip)}
            {editable ? (
              <button type="button" className="text-[#1982bf]/70 transition hover:text-rose-600 active:text-rose-700" onClick={() => onChange(chips.filter((entry) => entry !== chip))}>×</button>
            ) : null}
          </span>
        ))}
        {editable ? (
          <input
            className="h-full min-w-0 flex-1 border-0 bg-transparent text-xs text-slate-900 outline-none focus:ring-0"
            value={input}
            placeholder={chips.length > 0 ? '' : placeholder}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== 'Enter') return;
              event.preventDefault();
              addChip();
            }}
          />
        ) : null}
      </div>
    </div>
  );
}

function DiscountTargetChipInput({
  value,
  suggestions,
  editable,
  listId,
  placeholder,
  onChange
}: {
  value: string[];
  suggestions: string[];
  editable: boolean;
  listId: string;
  placeholder: string;
  onChange: (value: string[]) => void;
}) {
  const [input, setInput] = useState('');
  const chips = normalizeDiscountTargetList(value);

  const commitInput = () => {
    const target = normalizeDiscountTarget(input);
    if (!target) return;
    onChange(normalizeDiscountTargetList(target === allDiscountTargetLabel ? [target] : [
      ...chips.filter((chip) => chip !== allDiscountTargetLabel),
      target
    ]));
    setInput('');
  };

  const removeChip = (chip: string) => {
    onChange(normalizeDiscountTargetList(chips.filter((entry) => entry !== chip)));
  };

  return (
    <div className="flex min-h-6 flex-wrap items-center gap-1 rounded-md border border-slate-300 bg-white px-1 py-0">
      {chips.map((chip) => (
        <span key={chip} className={adminProductInputChipClassName}>
          {chip}
          {editable ? (
            <button type="button" className="text-[#1982bf]/70 hover:text-rose-600" onClick={() => removeChip(chip)} aria-label={`Odstrani ${chip}`}>
              ×
            </button>
          ) : null}
        </span>
      ))}
      {editable ? (
        <>
          <input
            list={listId}
            className="h-5 min-w-[86px] flex-1 border-0 bg-transparent px-1 text-[12px] text-slate-900 outline-none focus:ring-0"
            value={input}
            placeholder={chips.length > 0 ? '' : placeholder}
            onChange={(event) => setInput(event.target.value)}
            onBlur={commitInput}
            onKeyDown={(event) => {
              if (!['Enter', ',', 'Tab'].includes(event.key)) return;
              if (!input.trim()) return;
              event.preventDefault();
              commitInput();
            }}
          />
          <datalist id={listId}>
            {suggestions.map((suggestion) => (
              <option key={suggestion} value={suggestion} />
            ))}
          </datalist>
        </>
      ) : null}
    </div>
  );
}

function OrderSummaryIcon({ type, compact = false }: { type: OrderSummaryIconType; compact?: boolean }) {
  const path = {
    document: (
      <>
        <path d="M7 3h7l4 4v14H7z" />
        <path d="M14 3v5h5" />
        <path d="M9.5 13h5" />
        <path d="M9.5 16h3.5" />
      </>
    ),
    simple: (
      <>
        <path d="m15 12-9.373 9.373a1 1 0 0 1-3.001-3L12 9" />
        <path d="m18 15 4-4" />
        <path d="m21.5 11.5-1.914-1.914A2 2 0 0 1 19 8.172v-.344a2 2 0 0 0-.586-1.414l-1.657-1.657A6 6 0 0 0 12.516 3H9l1.243 1.243A6 6 0 0 1 12 8.485V10l2 2h1.172a2 2 0 0 1 1.414.586L18.5 14.5" />
      </>
    ),
    dimensions: (
      <>
        <rect width="20" height="16" x="2" y="4" rx="2" />
        <path d="M12 9v11" />
        <path d="M2 9h13a2 2 0 0 1 2 2v9" />
      </>
    ),
    weightGranules: (
      <path
        fill="currentColor"
        stroke="none"
        d="M9 17.5c0.82843 0 1.5 0.6716 1.5 1.5s-0.67157 1.5-1.5 1.5-1.5-0.6716-1.5-1.5 0.67157-1.5 1.5-1.5m6 0c0.8284 0 1.5 0.6716 1.5 1.5s-0.6716 1.5-1.5 1.5-1.5-0.6716-1.5-1.5 0.6716-1.5 1.5-1.5M5.5 13c0.82843 0 1.5 0.6716 1.5 1.5S6.32843 16 5.5 16 4 15.3284 4 14.5 4.67157 13 5.5 13m6.5 0c0.8284 0 1.5 0.6716 1.5 1.5S12.8284 16 12 16s-1.5-0.6716-1.5-1.5 0.6716-1.5 1.5-1.5m6.5 0c0.8284 0 1.5 0.6716 1.5 1.5s-0.6716 1.5-1.5 1.5-1.5-0.6716-1.5-1.5 0.6716-1.5 1.5-1.5M9 8.5c0.82843 0 1.5 0.67157 1.5 1.5 0 0.8284-0.67157 1.5-1.5 1.5s-1.5-0.6716-1.5-1.5c0-0.82843 0.67157-1.5 1.5-1.5m6 0c0.8284 0 1.5 0.67157 1.5 1.5 0 0.8284-0.6716 1.5-1.5 1.5s-1.5-0.6716-1.5-1.5c0-0.82843 0.6716-1.5 1.5-1.5M5.5 4C6.32843 4 7 4.67157 7 5.5S6.32843 7 5.5 7 4 6.32843 4 5.5 4.67157 4 5.5 4M12 4c0.8284 0 1.5 0.67157 1.5 1.5S12.8284 7 12 7s-1.5-0.67157-1.5-1.5S11.1716 4 12 4m6.5 0c0.8284 0 1.5 0.67157 1.5 1.5S19.3284 7 18.5 7 17 6.32843 17 5.5 17.6716 4 18.5 4"
      />
    ),
    uniqueMachine: (
      <>
        <path d="M11 10.27 7 3.34" />
        <path d="m11 13.73-4 6.93" />
        <path d="M12 22v-2" />
        <path d="M12 2v2" />
        <path d="M14 12h8" />
        <path d="m17 20.66-1-1.73" />
        <path d="m17 3.34-1 1.73" />
        <path d="M2 12h2" />
        <path d="m20.66 17-1.73-1" />
        <path d="m20.66 7-1.73 1" />
        <path d="m3.34 17 1.73-1" />
        <path d="m3.34 7 1.73 1" />
        <circle cx="12" cy="12" r="2" />
        <circle cx="12" cy="12" r="8" />
      </>
    ),
    scale: (
      <>
        <path d="M6 19h12" />
        <path d="M12 5v14" />
        <path d="M8 7h8" />
        <path d="M6 7l-3 6h6z" />
        <path d="M18 7l-3 6h6z" />
      </>
    ),
    bag: (
      <>
        <path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z" />
        <path d="M7 12h5" />
        <path d="M15 9.4a4 4 0 1 0 0 5.2" />
      </>
    ),
    quantity: (
      <g fill="none">
        <circle cx="12" cy="6.2" r="2.1" />
        <circle cx="8.6" cy="12" r="2.1" />
        <circle cx="15.4" cy="12" r="2.1" />
        <circle cx="5.2" cy="17.8" r="2.1" />
        <circle cx="12" cy="17.8" r="2.1" />
        <circle cx="18.8" cy="17.8" r="2.1" />
      </g>
    ),
    boxes: (
      <>
        <path d="M2.97 12.92A2 2 0 0 0 2 14.63v3.24a2 2 0 0 0 .97 1.71l3 1.8a2 2 0 0 0 2.06 0L12 19v-5.5l-5-3-4.03 2.42Z" />
        <path d="m7 16.5-4.74-2.85" />
        <path d="m7 16.5 5-3" />
        <path d="M7 16.5v5.17" />
        <path d="M12 13.5V19l3.97 2.38a2 2 0 0 0 2.06 0l3-1.8a2 2 0 0 0 .97-1.71v-3.24a2 2 0 0 0-.97-1.71L17 10.5l-5 3Z" />
        <path d="m17 16.5-5-3" />
        <path d="m17 16.5 4.74-2.85" />
        <path d="M17 16.5v5.17" />
        <path d="M7.97 4.42A2 2 0 0 0 7 6.13v4.37l5 3 5-3V6.13a2 2 0 0 0-.97-1.71l-3-1.8a2 2 0 0 0-2.06 0l-3 1.8Z" />
        <path d="M12 8 7.26 5.15" />
        <path d="m12 8 4.74-2.85" />
        <path d="M12 13.5V8" />
      </>
    ),
    layers: (
      <>
        <path d="M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83z" />
        <path d="M2 12a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 12" />
        <path d="M2 17a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 17" />
      </>
    ),
    layersMinus: (
      <>
        <path d="M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 .83.18 2 2 0 0 0 .83-.18l8.58-3.9a1 1 0 0 0 0-1.832z" />
        <path d="M16 17h6" />
        <path d="M2.003 11.995a1 1 0 0 0 .597.915l8.58 3.91a2 2 0 0 0 .83.18" />
        <path d="M2.003 16.995a1 1 0 0 0 .597.915l8.58 3.91a2 2 0 0 0 .83.18 2 2 0 0 0 .83-.18l2.11-.96" />
        <path d="M22.018 12.004a1 1 0 0 1-.598.916l-.177.08" />
      </>
    ),
    discount: (
      <>
        <path d="M2.7 10.3a2.41 2.41 0 0 0 0 3.41l7.59 7.59a2.41 2.41 0 0 0 3.41 0l7.59-7.59a2.41 2.41 0 0 0 0-3.41L13.7 2.71a2.41 2.41 0 0 0-3.41 0Z" />
        <path d="M9.2 9.2h.01" />
        <path d="m14.5 9.5-5 5" />
        <path d="M14.7 14.8h.01" />
      </>
    ),
    stock: (
      <g fill="none">
        <circle cx="12" cy="6.2" r="2.1" />
        <circle cx="8.6" cy="12" r="2.1" />
        <circle cx="15.4" cy="12" r="2.1" />
        <circle cx="5.2" cy="17.8" r="2.1" />
        <circle cx="12" cy="17.8" r="2.1" />
        <circle cx="18.8" cy="17.8" r="2.1" />
      </g>
    ),
    variant: (
      <>
        <path d="M5 7h14v12H5z" />
        <path d="M8 7V4h8v3" />
        <path d="M9 11h2" />
        <path d="M13 11h2" />
      </>
    ),
    box: (
      <>
        <path d="M12 3 4 7.5l8 4.5 8-4.5z" />
        <path d="M4 7.5v9L12 21l8-4.5v-9" />
        <path d="M12 12v9" />
      </>
    ),
    calculator: (
      <>
        <rect x="5" y="3" width="14" height="18" rx="2" />
        <path d="M8 7h8" />
        <path d="M8 11h2" />
        <path d="M12 11h2" />
        <path d="M16 11h.01" />
        <path d="M8 15h2" />
        <path d="M12 15h2" />
        <path d="M16 15h.01" />
      </>
    )
  }[type];

  return (
    <span className={classNames('inline-flex shrink-0 items-center justify-center text-slate-500', compact ? 'h-5 w-5' : 'h-7 w-7')}>
      <svg viewBox="0 0 24 24" className={compact ? 'h-[17px] w-[17px]' : 'h-[21px] w-[21px]'} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {path}
      </svg>
    </span>
  );
}

function OrderSummarySectionTitle({ children, compact = false }: { children: ReactNode; compact?: boolean }) {
  return (
    <div className={classNames('flex items-center', compact ? 'gap-2' : 'gap-3')}>
      <h3 className={classNames('shrink-0 font-semibold text-slate-900', compact ? 'text-[12px]' : 'text-[13px]')}>{children}</h3>
      <span className="h-px flex-1 bg-slate-200" />
    </div>
  );
}

function OrderSummaryCard({
  compact,
  detailRows,
  calculationRows,
  total
}: {
  compact: boolean;
  detailRows: OrderSummaryDetailRow[];
  calculationRows: OrderSummaryCalculationRow[];
  total: string;
}) {
  const sectionGapClassName = compact ? 'mt-3' : 'mt-5';
  const listGapClassName = compact ? 'mt-2' : 'mt-3';
  const detailRowClassName = compact ? 'py-1.5' : 'py-2.5';
  const calculationRowClassName = compact ? 'py-1.5 text-[12px]' : 'py-2 text-[13px]';

  return (
    <section className={`${adminWindowCardClassName} h-full ${compact ? 'p-4' : 'p-7'}`} style={adminWindowCardStyle}>
      <div className="flex items-center gap-2">
        <h2 className={compact ? 'text-[18px] font-semibold tracking-tight text-slate-900' : sectionTitleClassName}>Povzetek naročila in izračun</h2>
      </div>

      <div className={sectionGapClassName}>
        <OrderSummarySectionTitle compact={compact}>Podrobnosti artikla in izračuna</OrderSummarySectionTitle>
        <div className={`${listGapClassName} divide-y divide-slate-200`}>
          {detailRows.map((row) => (
            <div key={`${row.label}-${row.value}`} className={`flex items-center gap-3 ${detailRowClassName}`}>
              <OrderSummaryIcon type={row.icon} compact={compact} />
              <div className="min-w-0 flex-1">
                <p className={classNames('font-medium text-slate-900', compact ? 'text-[12px] leading-4' : 'text-[13px] leading-5')}>{row.label}</p>
                {row.description ? <p className={classNames('text-slate-500', compact ? 'text-[10.5px] leading-[0.875rem]' : 'text-[11px] leading-4')}>{row.description}</p> : null}
              </div>
              <span className={classNames('max-w-[48%] truncate text-right font-semibold tabular-nums text-slate-900', compact ? 'text-[12px]' : 'text-[13px]')} title={row.value}>{row.value}</span>
            </div>
          ))}
        </div>
      </div>

      <div className={sectionGapClassName}>
        <OrderSummarySectionTitle compact={compact}>Izračun</OrderSummarySectionTitle>
        <div className={`${listGapClassName} divide-y divide-slate-100`}>
          {calculationRows.map((row) => (
            <div key={`${row.label}-${row.value}`} className={`flex items-center justify-between gap-4 ${calculationRowClassName}`}>
              <span className={classNames('min-w-0 text-slate-900', row.strong && 'font-semibold')}>
                {row.label}
                {row.detail ? <span className="ml-1 text-slate-500">({row.detail})</span> : null}
              </span>
              <span className={classNames(
                'shrink-0 text-right font-semibold tabular-nums',
                row.tone === 'success' ? 'text-emerald-600' : 'text-slate-900'
              )}>
                {row.value}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className={`${compact ? 'mt-3 pt-3' : 'mt-5 pt-4'} border-t border-slate-200`}>
        <div className="flex items-end justify-between gap-4 text-[#1982bf]">
          <span className={compact ? 'text-[18px] font-semibold tracking-tight' : 'text-[22px] font-semibold tracking-tight'}>Skupaj z DDV</span>
          <span className={compact ? 'text-[20px] font-semibold tracking-tight' : 'text-[26px] font-semibold tracking-tight'}>{total}</span>
        </div>
      </div>
    </section>
  );
}
