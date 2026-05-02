// @ts-nocheck
'use client';

import { Fragment, jsxDEV } from 'react/jsx-dev-runtime';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/shared/ui/button';
import { Chip } from '@/shared/ui/badge';
import { AdminCheckbox } from '@/shared/ui/checkbox';
import { IconButton } from '@/shared/ui/icon-button';
import { PlusIcon, TrashCanIcon } from '@/shared/ui/icons/AdminActionIcons';
import { MenuPanel } from '@/shared/ui/menu';
import { CustomSelect } from '@/shared/ui/select';
import { adminStatusInfoPillVariantTableClassName, selectTokenClasses } from '@/shared/ui/theme/tokens';
import ActiveStateChip from '@/admin/features/artikli/components/ActiveStateChip';
import { NoteTagChip } from '@/admin/features/artikli/components/NoteTagChip';
import {
  adminCompactTableAdornmentClassName as compactTableAdornmentClassName,
  adminCompactTableAlignedInputClassName as compactTableAlignedInputClassName,
  adminCompactTableValueUnitShellClassName as compactTableValueUnitShellClassName
} from '@/shared/ui/admin-controls/adminCompactFieldStyles';
import { adminTableBodyCellCenterClassName, adminTableBodyCellLeftClassName, adminTableHeaderCellCenterClassName, adminTableHeaderCellLeftClassName, adminTableInlineEditInputClassName, adminTableNeutralIconButtonClassName, adminTablePrimaryButtonClassName, adminTableRowHeightClassName, adminTableSelectedDangerIconButtonClassName, adminWindowCardClassName, adminWindowCardStyle } from '@/shared/ui/admin-table/standards';
import { createVariant, formatCurrency } from '@/admin/features/artikli/lib/familyModel';
import { formatDecimalForDisplay, formatDecimalForSku, parseDecimalInput, parseDecimalListInput } from '@/admin/features/artikli/lib/decimalFormat';

export type ProductEditorType = 'simple' | 'dimensions' | 'weight' | 'unique_machine';
export type QuantityDiscountDraft = Record<string, any>;
export type SimulatorOption = Record<string, any>;
export type UniversalProductSpecificData = {
  simple: any;
  weight: any;
  uniqueMachine: any;
};

const __refreshSig = () => {};
const _s = __refreshSig, _s1 = __refreshSig, _s2 = __refreshSig, _s3 = __refreshSig, _s4 = __refreshSig, _s5 = __refreshSig, _s6 = __refreshSig, _s7 = __refreshSig, _s8 = __refreshSig, _s9 = __refreshSig;

;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
const classNames = (...parts)=>parts.filter(Boolean).join(' ');
const sectionTitleClassName = 'text-[20px] font-semibold tracking-tight text-slate-900';
const fieldFrameClassName = 'h-9 w-full rounded-md border border-slate-300 bg-white px-2.5 text-[13px] text-slate-900 outline-none transition focus:border-[#3e67d6] focus:ring-0 disabled:cursor-not-allowed disabled:bg-[color:var(--field-locked-bg)] disabled:text-slate-500';
const compactInfoFieldFrameClassName = `${fieldFrameClassName} !h-[30px] !px-2 !text-[12px]`;
const smallLabelClassName = 'mb-1 block text-[12px] font-semibold text-slate-700';
const inlineSnippetClassName = 'rounded bg-[#1982bf1a] px-1 py-0.5 font-mono text-[11px] text-[#1982bf]';
const fieldUnitAdornmentClassName = 'inline-flex h-full shrink-0 items-center justify-center whitespace-nowrap border-l border-slate-200 px-2 text-[12px] font-medium text-slate-500';
const fieldUnitInputClassName = 'h-full shrink-0 border-0 border-l border-slate-200 bg-transparent px-2 text-center text-[12px] font-medium text-slate-500 outline-none focus:ring-0 disabled:cursor-not-allowed disabled:bg-[color:var(--field-locked-bg)] disabled:text-slate-500';
const adminProductInputChipClassName = 'inline-flex h-5 items-center gap-1 rounded-md border border-[#b9d4fb] bg-[#f3f8fc] px-1.5 text-[11px] font-semibold text-[#1982bf]';
const tableHeaderClassName = 'px-3 py-2 text-left font-semibold text-slate-700';
const tableCellClassName = 'px-3 py-2 align-middle';
const compactInfoTableCellClassName = 'px-3 py-1.5 align-middle';
const compactInfoCheckboxCellClassName = 'px-2 py-1.5 text-center';
const narrowInfoHeaderClassName = 'px-1.5 py-2 text-left font-semibold text-slate-700';
const narrowInfoCellClassName = 'px-1.5 py-1.5 align-middle';
const narrowInfoLabelColumnWidth = '40%';
const compactTableThirtyInputClassName = `${compactTableAlignedInputClassName} !h-[30px] !min-h-[30px] !text-[11px]`;
const compactTableThirtyValueUnitShellClassName = `${compactTableValueUnitShellClassName} !h-[30px]`;
const weightVariantTableCellClassName = 'px-3 py-1.5 align-middle';
const weightVariantTableTightCellClassName = 'px-2 py-1.5 align-middle';
const discountCheckboxColumnClassName = 'w-10 min-w-10 max-w-10';
const discountMinQuantityColumnClassName = 'w-[116px] min-w-[116px] max-w-[116px]';
const discountPercentColumnClassName = 'w-[92px] min-w-[92px] max-w-[92px]';
const simulatorControlValueClassName = "font-['Inter',system-ui,sans-serif] text-[11px] font-semibold leading-[1.2] text-slate-900 not-italic";
const simulatorSelectTriggerClassName = "!h-[30px] !rounded-md !px-3 !font-['Inter',system-ui,sans-serif] !text-[11px] !font-semibold !leading-[1.2] !text-slate-900 !not-italic";
const simulatorSelectValueClassName = "!font-['Inter',system-ui,sans-serif] !text-[11px] !font-semibold !leading-[1.2] !text-slate-900 !not-italic";
const simulatorControlValueStyle = {
    fontFamily: '"Inter", system-ui, sans-serif',
    fontSize: '11px',
    fontStyle: 'normal',
    fontWeight: 600,
    lineHeight: '1.2'
};
const defaultVatRate = 0.22;
const defaultVatMultiplier = 1 + defaultVatRate;
const toGrossWithVat = (value)=>Number((Math.max(0, value) * defaultVatMultiplier).toFixed(4));
const toNetFromGross = (value)=>Number((Math.max(0, value) / defaultVatMultiplier).toFixed(4));
function DisabledSelectionCheckbox({ checked = false }) {
    return /*#__PURE__*/ jsxDEV(AdminCheckbox, {
        checked: checked,
        disabled: true,
        onChange: ()=>{}
    }, void 0, false, {
        fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
        lineNumber: 81,
        columnNumber: 10
    }, this);
}
function ReadOnlyCompactField({ value, align = 'left', className }) {
    return /*#__PURE__*/ jsxDEV("span", {
        className: classNames(compactInfoFieldFrameClassName, 'inline-flex items-center bg-[color:var(--field-locked-bg)] text-slate-600', align === 'center' && 'justify-center text-center', align === 'right' && 'justify-end text-right', className),
        children: value === null || value === undefined || value === '' ? '—' : value
    }, void 0, false, {
        fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
        lineNumber: 94,
        columnNumber: 5
    }, this);
}
function ReadOnlyTableField({ value, align = 'left', className }) {
    return /*#__PURE__*/ jsxDEV("span", {
        className: classNames('inline-flex h-[30px] min-w-0 items-center rounded-md border border-transparent bg-transparent px-2 text-[11px] font-normal leading-[1.2] text-slate-700', align === 'center' && 'justify-center text-center', align === 'right' && 'justify-end text-right', className),
        children: value === null || value === undefined || value === '' ? '—' : value
    }, void 0, false, {
        fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
        lineNumber: 118,
        columnNumber: 5
    }, this);
}
function IncludedItemReadTick() {
    return /*#__PURE__*/ jsxDEV("span", {
        className: "inline-flex h-3.5 w-3.5 items-center justify-center rounded-[3px] border border-emerald-300 bg-emerald-50 text-emerald-600",
        children: /*#__PURE__*/ jsxDEV("svg", {
            viewBox: "0 0 16 16",
            className: "h-3 w-3",
            fill: "none",
            stroke: "currentColor",
            strokeWidth: "2",
            strokeLinecap: "round",
            strokeLinejoin: "round",
            "aria-hidden": "true",
            children: /*#__PURE__*/ jsxDEV("path", {
                d: "m3.5 8 3 3 6-6"
            }, void 0, false, {
                fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                lineNumber: 135,
                columnNumber: 9
            }, this)
        }, void 0, false, {
            fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
            lineNumber: 134,
            columnNumber: 7
        }, this)
    }, void 0, false, {
        fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
        lineNumber: 133,
        columnNumber: 5
    }, this);
}
const defaultQuantityDiscountRows = [
    {
        minQuantity: 1,
        discountPercent: 0,
        appliesTo: 'allVariants',
        note: '',
        position: 0
    },
    {
        minQuantity: 10,
        discountPercent: 3,
        appliesTo: 'allVariants',
        note: '',
        position: 1
    },
    {
        minQuantity: 25,
        discountPercent: 5,
        appliesTo: 'allVariants',
        note: '',
        position: 2
    },
    {
        minQuantity: 50,
        discountPercent: 8,
        appliesTo: 'allVariants',
        note: '',
        position: 3
    }
];
const allDiscountTargetLabel = 'Vse';
const defaultSimpleProductData = {
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
const defaultWeightProductData = {
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
    packagingChips: [
        'fr:0-2',
        'kg:0,5',
        'kg:1',
        'kg:2'
    ],
    fractionChips: [
        '0-2 mm'
    ],
    orderStepChips: [
        '0,5 kg'
    ],
    fractionPricing: [],
    materialStocks: [],
    variants: []
};
const defaultMachineProductData = {
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
        {
            id: 'spec-power',
            property: 'Moč',
            value: '205 W'
        },
        {
            id: 'spec-voltage',
            property: 'Napajanje',
            value: '230 V / 50 Hz'
        },
        {
            id: 'spec-weight',
            property: 'Teža',
            value: '7,0 kg'
        }
    ],
    includedItems: [
        '1 x osnovna enota',
        '1 x navodila za uporabo'
    ]
};
const machineSerialStatusOptions = [
    {
        value: 'in_stock',
        label: 'Na zalogi'
    },
    {
        value: 'sold',
        label: 'Prodano'
    },
    {
        value: 'reserved',
        label: 'Rezervirano'
    },
    {
        value: 'service',
        label: 'Na servisu'
    }
];
const machineSerialStatusVariant = {
    in_stock: 'neutral',
    sold: 'success',
    reserved: 'warning',
    service: 'info'
};
function asRecord(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value) ? value : {};
}
function asString(value, fallback = '') {
    return typeof value === 'string' ? value : fallback;
}
function asBoolean(value, fallback) {
    return typeof value === 'boolean' ? value : fallback;
}
function asNumber(value, fallback) {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string') {
        const parsed = (0, parseDecimalInput)(value);
        if (parsed !== null) return parsed;
    }
    return fallback;
}
function asStringArray(value, fallback) {
    return Array.isArray(value) ? value.map((entry)=>String(entry).trim()).filter(Boolean) : fallback;
}
function createLocalId(prefix) {
    return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}
function normalizeSpecRows(value, fallback, idPrefix) {
    return Array.isArray(value) ? value.map((entry, index)=>{
        const spec = asRecord(entry);
        return {
            id: asString(spec.id, `${idPrefix}-${index}`),
            property: asString(spec.property, ''),
            value: asString(spec.value, '')
        };
    }).filter((entry)=>entry.property.trim() || entry.value.trim()) : fallback;
}
function normalizeMachineSerialStatus(value) {
    const normalized = String(value ?? '').trim();
    return machineSerialStatusOptions.some((option)=>option.value === normalized) ? normalized : 'in_stock';
}
function normalizeMachineSerialRows(value) {
    return Array.isArray(value) ? value.map((entry, index)=>{
        const row = asRecord(entry);
        return {
            id: asString(row.id, `serial-${index}`),
            serialNumber: asString(row.serialNumber ?? row.serial, ''),
            status: normalizeMachineSerialStatus(row.status),
            orderReference: asString(row.orderReference ?? row.order, ''),
            shippedAt: asString(row.shippedAt ?? row.shipped, '')
        };
    }).filter((entry)=>entry.serialNumber.trim() || entry.orderReference.trim() || entry.shippedAt.trim()) : [];
}
function getMachineSerialStatusLabel(status) {
    return machineSerialStatusOptions.find((option)=>option.value === status)?.label ?? 'Na zalogi';
}
function normalizeSerialMatchText(value) {
    return value.trim().toLocaleLowerCase('sl-SI');
}
function buildMachineSerialOrderAllocations(rows, matches) {
    const availableAllocations = [];
    matches.forEach((match)=>{
        const quantity = Math.max(0, Math.floor(Number(match.quantity) || 0));
        for(let index = 0; index < quantity; index += 1){
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
    const allocations = new Map();
    rows.forEach((row)=>{
        const serialNumber = normalizeSerialMatchText(row.serialNumber);
        if (!serialNumber) return;
        const exactAllocation = availableAllocations.find((allocation)=>!allocation.claimed && allocation.searchText.includes(serialNumber));
        if (!exactAllocation) return;
        exactAllocation.claimed = true;
        allocations.set(row.id, exactAllocation);
    });
    rows.forEach((row)=>{
        if (allocations.has(row.id)) return;
        const nextAllocation = availableAllocations.find((allocation)=>!allocation.claimed);
        if (!nextAllocation) return;
        nextAllocation.claimed = true;
        allocations.set(row.id, nextAllocation);
    });
    return allocations;
}
function formatMachineSerialDate(value) {
    if (!value) return '–';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '–';
    return new Intl.DateTimeFormat('sl-SI', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    }).format(date);
}
function sanitizeQuantityRangeInput(value) {
    const compact = value.replace(/[^\d-]/g, '');
    const [rawStart = '', rawEnd = '', ...rest] = compact.split('-');
    const start = rawStart.replace(/^0+(?=\d)/, '');
    const end = rawEnd.replace(/^0+(?=\d)/, '');
    if (compact.includes('-')) return `${start}${start ? '-' : ''}${end || (rest.length > 0 ? '' : '')}`;
    return start;
}
function extractQuantityRange(value, fallback = '') {
    const raw = String(value ?? '').trim();
    const match = raw.match(/\d+\s*(?:-\s*\d*)?/);
    if (!match) return fallback;
    return sanitizeQuantityRangeInput(match[0]);
}
function normalizeQuantityRangeValue(value, fallback) {
    return extractQuantityRange(value, extractQuantityRange(fallback));
}
function getQuantityRangeEnd(value) {
    const range = extractQuantityRange(value);
    if (!range) return null;
    const end = range.split('-')[1] || range.split('-')[0];
    const parsed = Number(end);
    return Number.isFinite(parsed) ? parsed : null;
}
function getInflectedQuantityUnit(value, kind) {
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
const longestQuantityUnitLabel = {
    piece: 'kosov',
    month: 'mesecev',
    workday: 'delovna dneva'
};
function getUnitAdornmentStyle(label, minimumCharacters = 1) {
    const characterCount = Math.max(Array.from(label || '').length, minimumCharacters);
    return {
        width: `calc(${characterCount}ch + 1.25rem)`
    };
}
function getQuantityUnitAdornmentStyle(kind) {
    return getUnitAdornmentStyle(longestQuantityUnitLabel[kind]);
}
function formatQuantityRangeWithUnit(value, kind) {
    const range = extractQuantityRange(value);
    return range ? `${range} ${getInflectedQuantityUnit(range, kind)}` : '';
}
function formatPieceCount(value) {
    const count = Math.max(0, Math.floor(Number(value) || 0));
    return `${(0, formatDecimalForDisplay)(count)} ${getInflectedQuantityUnit(count, 'piece')}`;
}
function isPieceUnitLabel(unit) {
    return [
        'kos',
        'kosa',
        'kosi',
        'kosov'
    ].includes((unit ?? '').trim().toLocaleLowerCase('sl-SI'));
}
function getSimulatorUnitLabel(unit, quantity) {
    return isPieceUnitLabel(unit) ? getInflectedQuantityUnit(quantity, 'piece') : unit;
}
function getSimulatorUnitAdornmentStyle(unit) {
    return isPieceUnitLabel(unit) ? getQuantityUnitAdornmentStyle('piece') : getUnitAdornmentStyle(unit);
}
function formatSimulatorQuantityWithUnit(quantity, unit) {
    return `${(0, formatDecimalForDisplay)(quantity)} ${getSimulatorUnitLabel(unit, quantity)}`;
}
function clampDiscountPercent(value) {
    return Math.min(100, Math.max(0, Number.isFinite(value) ? value : 0));
}
function normalizeDiscountTarget(value) {
    const trimmed = value.trim();
    if (!trimmed) return null;
    return trimmed.toLocaleLowerCase('sl-SI') === 'vse' ? allDiscountTargetLabel : trimmed;
}
function normalizeDiscountTargetList(values, fallback = [
    allDiscountTargetLabel
]) {
    const normalized = [];
    for (const value of values ?? []){
        const target = normalizeDiscountTarget(value);
        if (!target) continue;
        if (target === allDiscountTargetLabel) return [
            allDiscountTargetLabel
        ];
        if (!normalized.some((entry)=>entry.toLocaleLowerCase('sl-SI') === target.toLocaleLowerCase('sl-SI'))) {
            normalized.push(target);
        }
    }
    return normalized.length > 0 ? normalized : fallback;
}
function normalizeDiscountSuggestionList(values) {
    const normalized = [];
    for (const value of values){
        const target = normalizeDiscountTarget(value);
        if (!target) continue;
        if (!normalized.some((entry)=>entry.toLocaleLowerCase('sl-SI') === target.toLocaleLowerCase('sl-SI'))) {
            normalized.push(target);
        }
    }
    return normalized;
}
function parseQuantityDiscountTargets(appliesTo) {
    const normalized = appliesTo?.trim();
    if (!normalized || normalized === 'allVariants') {
        return {
            variantTargets: [
                allDiscountTargetLabel
            ],
            customerTargets: [
                allDiscountTargetLabel
            ]
        };
    }
    try {
        const parsed = JSON.parse(normalized);
        const record = asRecord(parsed);
        return {
            variantTargets: normalizeDiscountTargetList(asStringArray(record.variants ?? record.variantTargets, [
                allDiscountTargetLabel
            ])),
            customerTargets: normalizeDiscountTargetList(asStringArray(record.customers ?? record.customerTargets, [
                allDiscountTargetLabel
            ]))
        };
    } catch  {
        return {
            variantTargets: normalizeDiscountTargetList([
                normalized
            ]),
            customerTargets: [
                allDiscountTargetLabel
            ]
        };
    }
}
function serializeQuantityDiscountTargets(rule) {
    const variantTargets = normalizeDiscountTargetList(rule.variantTargets);
    const customerTargets = normalizeDiscountTargetList(rule.customerTargets);
    if (variantTargets.length === 1 && variantTargets[0] === allDiscountTargetLabel && customerTargets.length === 1 && customerTargets[0] === allDiscountTargetLabel) {
        return 'allVariants';
    }
    return JSON.stringify({
        variants: variantTargets,
        customers: customerTargets
    });
}
function getSimulatorOptionSku(option) {
    if (option.targetKey?.trim()) return option.targetKey.trim();
    const match = option.label.match(/\(([^()]+)\)\s*$/);
    return match?.[1]?.trim() || option.id;
}
function discountRuleTargetsVariant(rule, option) {
    const targets = normalizeDiscountTargetList(rule.variantTargets);
    if (targets.includes(allDiscountTargetLabel) || !option) return true;
    const sku = getSimulatorOptionSku(option).toLocaleLowerCase('sl-SI');
    const label = option.label.toLocaleLowerCase('sl-SI');
    return targets.some((target)=>{
        const normalized = target.toLocaleLowerCase('sl-SI');
        return normalized === sku || label.includes(normalized);
    });
}
function discountRuleTargetsAllCustomers(rule) {
    return normalizeDiscountTargetList(rule.customerTargets).includes(allDiscountTargetLabel);
}
function getBestQuantityDiscount(rules, quantity, option) {
    return rules.filter((rule)=>quantity >= rule.minQuantity && discountRuleTargetsVariant(rule, option) && discountRuleTargetsAllCustomers(rule)).sort((left, right)=>right.minQuantity - left.minQuantity || right.discountPercent - left.discountPercent)[0] ?? null;
}
function getNextQuantityDiscount(rules, quantity, option) {
    return rules.filter((rule)=>quantity < rule.minQuantity && discountRuleTargetsVariant(rule, option) && discountRuleTargetsAllCustomers(rule)).sort((left, right)=>left.minQuantity - right.minQuantity || right.discountPercent - left.discountPercent)[0] ?? null;
}
function formatPercent(value) {
    return `${(0, formatDecimalForDisplay)(value)} %`;
}
function formatCompactPercent(value) {
    return `${(0, formatDecimalForDisplay)(value)} %`;
}
function normalizeWeightLooseLabel(value) {
    const normalized = value.trim();
    if (!normalized) return normalized;
    const comparable = normalized.toLocaleLowerCase('sl-SI');
    return comparable.includes('rasito') || comparable.includes('bulk') || comparable.includes('razsuto') ? 'Brez pakiranja' : normalized;
}
function normalizeWeightFractionValue(value) {
    const trimmed = value.trim();
    if (!trimmed) return '';
    return /\bmm\b/i.test(trimmed) ? trimmed : `${trimmed} mm`;
}
function stripWeightFractionUnit(value) {
    return value.trim().replace(/\s*mm\s*$/i, '');
}
function normalizeWeightChipKey(value) {
    return value.trim().toLocaleLowerCase('sl-SI').normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/\s+/g, ' ');
}
function isDeprecatedWeightBagCountKey(value) {
    const key = normalizeWeightChipKey(value);
    return key === 'stevilo vreck' || key === 'st. vreck' || key === 'st vreck' || key === 'st. vr.' || key === 'st vr' || key === 'vr';
}
function splitWeightSemicolonValues(value) {
    return value.split(';').map((entry)=>entry.trim()).filter(Boolean);
}
function splitWeightColorValues(value) {
    return value.split(/[;,]/).map((entry)=>entry.trim()).filter(Boolean);
}
function parseWeightMassListInput(raw) {
    const normalized = raw.trim();
    if (!normalized) return [];
    if (normalized.includes(';')) return (0, parseDecimalListInput)(normalized);
    const commaParts = normalized.split(',').map((entry)=>entry.trim()).filter(Boolean);
    const looksLikeIntegerList = commaParts.length > 1 && commaParts.every((entry)=>/^\d+$/.test(entry)) && commaParts[0] !== '0' && (commaParts.length > 2 || commaParts.slice(1).some((entry)=>entry.length > 1));
    if (looksLikeIntegerList) {
        return commaParts.map((entry)=>Number(entry)).filter((entry)=>Number.isFinite(entry) && entry > 0);
    }
    return (0, parseDecimalListInput)(normalized);
}
function normalizeSingleWeightColorValue(value) {
    return splitWeightColorValues(value)[0] ?? value.trim();
}
function formatWeightChipLabel(value) {
    const normalized = normalizeWeightChip(value);
    const prefixed = normalized.match(/^([^:]+)\s*:\s*(.+)$/);
    if (!prefixed) return normalized;
    const key = prefixed[1].trim();
    const normalizedKey = normalizeWeightChipKey(key);
    const rawValue = prefixed[2].trim();
    const separator = normalizedKey === 'barva' ? rawValue.includes(',') ? ',' : rawValue.includes(';') ? ';' : '' : rawValue.includes(';') ? ';' : '';
    const displayValue = separator ? rawValue.split(separator).map((entry)=>entry.trim()).filter(Boolean).join(`${separator} `) : rawValue;
    return `${key}: ${displayValue}`;
}
function normalizeWeightChip(value) {
    const normalized = normalizeWeightLooseLabel(value);
    const prefixed = normalized.match(/^([^:]+)\s*:\s*(.+)$/);
    if (!prefixed) return normalized;
    const key = normalizeWeightChipKey(prefixed[1]);
    const rawValue = prefixed[2].trim();
    if (!rawValue) return normalized;
    if (key === 'frakcija' || key === 'fr') {
        const values = splitWeightSemicolonValues(rawValue);
        return `fr:${(values.length > 0 ? values : [
            rawValue
        ]).join(';')}`;
    }
    if (key === 'barva') {
        const values = splitWeightColorValues(rawValue);
        return `barva:${(values.length > 0 ? values : [
            rawValue
        ]).join(', ')}`;
    }
    if (key === 'kg' || key === 'masa') {
        const parsed = parseWeightMassListInput(rawValue);
        return parsed.length === 0 ? normalized : `kg:${parsed.map(formatDecimalForDisplay).join(';')}`;
    }
    if (isDeprecatedWeightBagCountKey(key)) return '';
    return normalized;
}
function normalizeWeightChipList(values) {
    const normalized = [];
    for (const value of values){
        const chip = normalizeWeightChip(value);
        if (!chip) continue;
        if (!normalized.some((entry)=>entry.toLocaleLowerCase('sl-SI') === chip.toLocaleLowerCase('sl-SI'))) {
            normalized.push(chip);
        }
    }
    return normalized;
}
function parsePackagingMass(label) {
    const normalized = label.replace(',', '.').toLowerCase();
    if (normalized.includes('rasito') || normalized.includes('bulk') || normalized.includes('razsuto') || normalized.includes('brez pakiranja')) return null;
    const match = normalized.match(/(\d+(?:\.\d+)?)/);
    return match ? Number(match[1]) : null;
}
function parseWeightCombinationChips(chips, data, fallbackColor = '') {
    const fractions = [];
    const colors = [];
    const masses = [];
    const addUniqueText = (target, value)=>{
        const normalized = value.trim();
        if (!normalized) return;
        if (!target.some((entry)=>entry.toLocaleLowerCase('sl-SI') === normalized.toLocaleLowerCase('sl-SI'))) {
            target.push(normalized);
        }
    };
    const addUniqueMass = (value)=>{
        if (value === null || value <= 0) return;
        if (!masses.some((entry)=>Math.abs(entry - value) < 0.0001)) masses.push(value);
    };
    for (const chip of chips){
        const normalized = normalizeWeightChip(chip);
        const prefixed = normalized.match(/^([^:]+)\s*:\s*(.+)$/);
        if (prefixed) {
            const key = normalizeWeightChipKey(prefixed[1]);
            const rawValue = prefixed[2].trim();
            if (key === 'frakcija' || key === 'fr') {
                for (const value of splitWeightSemicolonValues(rawValue)){
                    addUniqueText(fractions, normalizeWeightFractionValue(value));
                }
                continue;
            }
            if (key === 'barva') {
                for (const value of splitWeightColorValues(rawValue)){
                    addUniqueText(colors, normalizeSingleWeightColorValue(value));
                }
                continue;
            }
            if (key === 'kg' || key === 'masa') {
                for (const value of parseWeightMassListInput(rawValue)){
                    addUniqueMass(value);
                }
                continue;
            }
        }
        addUniqueMass(parsePackagingMass(normalized));
    }
    if (fractions.length === 0) addUniqueText(fractions, normalizeWeightFractionValue(data.fraction));
    if (colors.length === 0) addUniqueText(colors, fallbackColor);
    if (masses.length === 0) addUniqueMass(data.netMassKg);
    return {
        fractions: fractions.length > 0 ? fractions : [
            ''
        ],
        colors: colors.length > 0 ? colors : [
            ''
        ],
        masses: masses.length > 0 ? masses : [
            data.netMassKg
        ]
    };
}
function getWeightVariantType(label) {
    return parsePackagingMass(label) === null ? 'Brez pakiranja' : 'Vreča';
}
function getWeightPackagingName(label) {
    return parsePackagingMass(label) === null ? 'Brez pakiranja' : 'PP vreča';
}
function getWeightSaleOptionLabel(variant) {
    return variant.netMassKg === null ? 'Brez pakiranja' : 'Vrečke';
}
function getWeightBagMassLabel(variant) {
    return variant.netMassKg === null ? 'Po naročilu' : `${(0, formatDecimalForDisplay)(variant.netMassKg)} kg`;
}
function getWeightVariantDisplayLabel(variant) {
    const bagCount = typeof variant.minQuantity === 'number' ? getWeightBagCount({
        netMassKg: variant.netMassKg,
        minQuantity: variant.minQuantity
    }) : 1;
    const massLabel = variant.netMassKg === null ? 'Brez pakiranja' : bagCount > 1 ? `${(0, formatDecimalForDisplay)(variant.netMassKg)} kg / ${bagCount} vrečk` : `${(0, formatDecimalForDisplay)(variant.netMassKg)} kg vrečka`;
    const descriptors = [
        variant.fraction,
        variant.color
    ].map((entry)=>entry?.trim()).filter(Boolean);
    return descriptors.length > 0 ? `${descriptors.join(' / ')} / ${massLabel}` : massLabel;
}
function getWeightBagCount(variant) {
    return Math.max(1, Math.floor(variant.minQuantity || 1));
}
function getWeightVariantTotalMass(variant) {
    return variant.netMassKg === null ? null : Number(variant.netMassKg.toFixed(4));
}
function formatWeightKg(value) {
    return value === null || value === undefined ? '—' : `${(0, formatDecimalForDisplay)(value)} kg`;
}
function formatWeightBagCount(value) {
    const count = Math.max(1, Math.floor(Number(value) || 1));
    if (count === 1) return '1 vrečka';
    if (count === 2) return '2 vrečki';
    if (count === 3 || count === 4) return `${count} vrečke`;
    return `${count} vrečk`;
}
function parseStockLabel(value) {
    const match = value?.trim().match(/^(-?\d+(?:[,.]\d+)?)(?:\s+(.+))?$/);
    if (!match) return null;
    const amount = Number((match[1] ?? '').replace(',', '.'));
    if (!Number.isFinite(amount)) return null;
    return {
        amount,
        unit: (match[2] ?? '').trim()
    };
}
function formatStockAfterOrder(stockLabel, orderedQuantity) {
    const stock = parseStockLabel(stockLabel);
    if (!stock) return null;
    const nextAmount = Math.max(0, Number((stock.amount - Math.max(0, orderedQuantity || 0)).toFixed(2)));
    if (isPieceUnitLabel(stock.unit)) {
        return `${formatSimulatorQuantityWithUnit(stock.amount, stock.unit)} → ${formatSimulatorQuantityWithUnit(nextAmount, stock.unit)}`;
    }
    const suffix = stock.unit ? ` ${stock.unit}` : '';
    return `${(0, formatDecimalForDisplay)(stock.amount)}${suffix} → ${(0, formatDecimalForDisplay)(nextAmount)}${suffix}`;
}
function getAvailableMachineSerialLabels(rows) {
    const available = rows.filter((row)=>row.status === 'in_stock').map((row)=>row.serialNumber.trim()).filter(Boolean);
    if (available.length > 0) return available;
    return rows.map((row)=>row.serialNumber.trim()).filter(Boolean);
}
function formatMachineSerialSummary(serialLabels, quantity) {
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
function getWeightVariantUnitPrice(variant) {
    if (typeof variant.unitPrice === 'number' && Number.isFinite(variant.unitPrice)) {
        return Math.max(0, variant.unitPrice);
    }
    const totalMass = getWeightVariantTotalMass(variant);
    const bagCount = getWeightBagCount(variant);
    return totalMass === null ? variant.pricePerKg : Number((totalMass * variant.pricePerKg + bagCount * variant.packagingCostPerBag).toFixed(4));
}
function formatWeightVariantGrossPrice(variant) {
    return variant.netMassKg === null ? `${(0, formatDecimalForDisplay)(toGrossWithVat(variant.pricePerKg))} €/kg` : (0, formatCurrency)(toGrossWithVat(getWeightVariantUnitPrice(variant)));
}
function normalizeWeightNoteTag(value) {
    const normalized = value.trim();
    return normalized === 'na-zalogi' || normalized === 'novo' || normalized === 'akcija' || normalized === 'zadnji-kosi' || normalized === 'ni-na-zalogi' ? normalized : '';
}
function weightSkuPart(value) {
    return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]+/g, '').toUpperCase();
}
function weightFractionSkuPart(value) {
    const normalized = value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\b(mm|cm|m)\b/gi, '').replace(/\s+/g, '').replace(/[,.]/g, 'P').replace(/[^a-zA-Z0-9-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
    return normalized.toUpperCase();
}
function weightMassSkuPart(value) {
    if (value === null) return 'BULK';
    return (0, formatDecimalForSku)(value) || '0';
}
function shouldUseGeneratedWeightSku(sku, baseSku) {
    const normalizedSku = String(sku ?? '').trim();
    if (!normalizedSku) return true;
    const normalizedBaseSku = String(baseSku ?? '').trim();
    if (!normalizedBaseSku) return normalizedSku.toUpperCase().startsWith('SKU-');
    const upperSku = normalizedSku.toUpperCase();
    const upperBaseSku = normalizedBaseSku.toUpperCase();
    return upperSku.startsWith('SKU-') || !upperSku.startsWith(`${upperBaseSku}-`);
}
function createWeightVariantFromCombination({ netMassKg, fraction, color, bagCount = 1, index, data, baseSku }) {
    const suffix = weightMassSkuPart(netMassKg);
    const normalizedBagCount = Math.max(1, Math.floor(bagCount));
    const fractionPricing = getWeightFractionPricing(data, fraction);
    const skuParts = [
        weightFractionSkuPart(fraction),
        weightSkuPart(color),
        suffix,
        normalizedBagCount > 1 ? `VR${normalizedBagCount}` : ''
    ].filter(Boolean);
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
function createWeightVariantFromPackaging(label, index, data, baseSku) {
    return createWeightVariantFromCombination({
        netMassKg: parsePackagingMass(label),
        fraction: normalizeWeightFractionValue(data.fraction),
        color: '',
        index,
        data,
        baseSku
    });
}
function createWeightVariantsFromChips(data, baseSku, fallbackColor = '') {
    const parsed = parseWeightCombinationChips(data.packagingChips, data, fallbackColor);
    const variants = [];
    for (const fraction of parsed.fractions){
        for (const color of parsed.colors){
            for (const netMassKg of parsed.masses){
                variants.push(createWeightVariantFromCombination({
                    netMassKg,
                    fraction,
                    color,
                    index: variants.length,
                    data,
                    baseSku
                }));
            }
        }
    }
    return variants;
}
function createWeightMaterialStockKey(fraction, color) {
    return `${fraction.trim().toLocaleLowerCase('sl-SI')}|${color.trim().toLocaleLowerCase('sl-SI')}`;
}
function createWeightFractionKey(fraction) {
    return fraction.trim().toLocaleLowerCase('sl-SI');
}
function createFallbackWeightFractionPricing(data) {
    const fraction = normalizeWeightFractionValue(data.fraction || defaultWeightProductData.fraction);
    return {
        id: `fraction-pricing-${weightSkuPart(fraction) || 'DEFAULT'}`,
        fraction,
        pricePerKg: data.pricePerKg,
        packagingCostPerBag: data.packagingCostPerBag,
        basicInfoRows: [],
        position: 1
    };
}
function normalizeWeightFractionPricing(value, index, data) {
    const record = asRecord(value);
    const fraction = normalizeWeightFractionValue(asString(record.fraction, data.fraction || defaultWeightProductData.fraction));
    return {
        id: asString(record.id, `fraction-pricing-${weightSkuPart(fraction) || index + 1}`),
        fraction,
        pricePerKg: Math.max(0, asNumber(record.pricePerKg, data.pricePerKg)),
        packagingCostPerBag: Math.max(0, asNumber(record.packagingCostPerBag, data.packagingCostPerBag)),
        basicInfoRows: normalizeSpecRows(record.basicInfoRows ?? record.basicInfo, [], `weight-fraction-basic-info-${index}`),
        position: Math.max(1, Math.floor(asNumber(record.position, index + 1)))
    };
}
function getWeightFractionPricing(data, fraction) {
    const key = createWeightFractionKey(fraction);
    return data.fractionPricing.find((row)=>createWeightFractionKey(row.fraction) === key) ?? createFallbackWeightFractionPricing(data);
}
function createWeightMaterialStocksFromVariants(variants, data, fallbackColor = '') {
    const rowsByKey = new Map();
    variants.filter((variant)=>variant.netMassKg !== null).forEach((variant)=>{
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
function normalizeWeightMaterialStock(value, index, data) {
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
function normalizeWeightVariant(value, index, data, baseSku) {
    const record = asRecord(value);
    const fallback = createWeightVariantsFromChips(data, baseSku)[index] ?? createWeightVariantFromCombination({
        netMassKg: data.netMassKg,
        fraction: normalizeWeightFractionValue(data.fraction),
        color: '',
        index,
        data,
        baseSku
    });
    const rawSku = asString(record.sku, '');
    return {
        id: asString(record.id, fallback.id),
        type: normalizeWeightLooseLabel(asString(record.type, fallback.type)),
        packaging: normalizeWeightLooseLabel(asString(record.packaging, fallback.packaging)),
        fraction: asString(record.fraction, fallback.fraction),
        color: asString(record.color, fallback.color),
        netMassKg: record.netMassKg === null ? null : asNumber(record.netMassKg, fallback.netMassKg ?? data.netMassKg),
        unitPrice: record.unitPrice === null ? null : record.unitPrice !== undefined || record.price !== undefined ? Math.max(0, asNumber(record.unitPrice ?? record.price, getWeightVariantUnitPrice(fallback))) : null,
        pricePerKg: asNumber(record.pricePerKg, data.pricePerKg),
        packagingCostPerBag: asNumber(record.packagingCostPerBag, data.packagingCostPerBag),
        minQuantity: Math.max(0, asNumber(record.minQuantity, fallback.minQuantity)),
        orderStep: Math.max(0, asNumber(record.orderStep, data.orderStep)),
        stockKg: Math.max(0, asNumber(record.stockKg, data.stockKg)),
        deliveryTime: asString(record.deliveryTime, data.deliveryTime),
        sku: shouldUseGeneratedWeightSku(rawSku, baseSku) ? fallback.sku : rawSku,
        active: asBoolean(record.active, true),
        note: asString(record.note, ''),
        position: Math.max(1, Math.floor(asNumber(record.position, index + 1)))
    };
}
function createQuantityDiscountDraft(rule, index) {
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
function createInitialQuantityDiscountDrafts(rules, productType = 'dimensions') {
    const source = rules && rules.length > 0 ? rules : productType === 'unique_machine' ? [] : defaultQuantityDiscountRows;
    return source.map((rule, index)=>createQuantityDiscountDraft(rule, index)).sort((left, right)=>left.position - right.position || left.minQuantity - right.minQuantity);
}
function cloneQuantityDiscountDraft(rule) {
    return {
        ...rule,
        variantTargets: [
            ...rule.variantTargets
        ],
        customerTargets: [
            ...rule.customerTargets
        ]
    };
}
function normalizeSimpleProductData(value, context = {}) {
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
function normalizeWeightProductData(value, context = {}) {
    const record = asRecord(value);
    const baseData = {
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
    const fractionPricing = Array.isArray(record.fractionPricing) && record.fractionPricing.length > 0 ? record.fractionPricing.map((entry, index)=>normalizeWeightFractionPricing(entry, index, baseData)).sort((left, right)=>left.position - right.position) : [
        createFallbackWeightFractionPricing(baseData)
    ];
    const activeFraction = fractionPricing.some((row)=>createWeightFractionKey(row.fraction) === createWeightFractionKey(baseData.fraction)) ? baseData.fraction : fractionPricing[0]?.fraction ?? baseData.fraction;
    const activePricing = fractionPricing.find((row)=>createWeightFractionKey(row.fraction) === createWeightFractionKey(activeFraction)) ?? fractionPricing[0];
    const pricedBaseData = {
        ...baseData,
        fraction: activeFraction,
        pricePerKg: activePricing?.pricePerKg ?? baseData.pricePerKg,
        packagingCostPerBag: activePricing?.packagingCostPerBag ?? baseData.packagingCostPerBag,
        fractionPricing
    };
    const sourceVariants = Array.isArray(record.variants) && record.variants.length > 0 ? record.variants : createWeightVariantsFromChips(pricedBaseData, context.baseSku);
    const variants = sourceVariants.map((entry, index)=>normalizeWeightVariant(entry, index, pricedBaseData, context.baseSku));
    const materialStocks = Array.isArray(record.materialStocks) && record.materialStocks.length > 0 ? record.materialStocks.map((entry, index)=>normalizeWeightMaterialStock(entry, index, pricedBaseData)) : createWeightMaterialStocksFromVariants(variants, pricedBaseData);
    return {
        ...pricedBaseData,
        materialStocks,
        variants
    };
}
function normalizeUniqueMachineProductData(value, context = {}) {
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
function createInitialTypeSpecificData(value, context = {}) {
    const record = asRecord(value);
    return {
        simple: normalizeSimpleProductData(record.simple, context),
        weight: normalizeWeightProductData(record.weight, context),
        uniqueMachine: normalizeUniqueMachineProductData(record.uniqueMachine ?? record.machine, context),
        dimensions: asRecord(record.dimensions)
    };
}
function cloneTypeSpecificData(data) {
    return createInitialTypeSpecificData(JSON.parse(JSON.stringify(data)));
}
function buildSimpleCatalogVariants(data, fallback, baseSku, name) {
    return [
        (0, createVariant)({
            ...fallback ?? {},
            id: fallback?.id ?? createLocalId('simple-variant'),
            label: name || 'Osnovni artikel',
            sku: fallback?.sku || baseSku,
            price: data.actionPriceEnabled ? data.actionPrice : data.basePrice,
            discountPct: data.actionPriceEnabled && data.basePrice > 0 ? Number(Math.max(0, Math.min(99.9, (data.basePrice - data.actionPrice) / data.basePrice * 100)).toFixed(2)) : 0,
            stock: data.stock,
            minOrder: data.moq,
            active: data.saleStatus === 'active',
            sort: 1
        })
    ];
}
function buildWeightCatalogVariants(data, baseSku) {
    return data.variants.map((variant, index)=>{
        const unitPrice = getWeightVariantUnitPrice(variant);
        return (0, createVariant)({
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
function buildMachineCatalogVariants(data, fallback, baseSku, name) {
    return [
        (0, createVariant)({
            ...fallback ?? {},
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
function getSimpleSimulatorOptions(data, label = 'Osnovni artikel') {
    return [
        {
            id: 'simple',
            label,
            basePrice: data.actionPriceEnabled ? data.actionPrice : data.basePrice,
            quantityUnit: 'kos',
            targetKey: 'Enostavni',
            summaryLabel: (0, formatCurrency)(data.actionPriceEnabled ? data.actionPrice : data.basePrice),
            stockLabel: formatPieceCount(data.stock),
            minOrderLabel: formatPieceCount(Math.max(1, Math.floor(Number(data.moq) || 1)))
        }
    ];
}
function getWeightSimulatorOptions(data) {
    const getMaterialStockLabel = (fraction)=>{
        const key = createWeightFractionKey(fraction);
        const stockKg = data.materialStocks.filter((row)=>createWeightFractionKey(row.fraction) === key).reduce((total, row)=>total + row.stockKg, 0);
        return formatWeightKg(stockKg || data.stockKg);
    };
    const variantOptions = data.variants.filter((variant)=>variant.netMassKg !== null).map((variant)=>{
        const packagePrice = getWeightVariantUnitPrice(variant);
        const totalMass = getWeightVariantTotalMass(variant);
        const bagCount = getWeightBagCount(variant);
        return {
            id: variant.id,
            label: getWeightVariantDisplayLabel(variant),
            basePrice: packagePrice,
            quantityUnit: variant.netMassKg === null ? 'kg' : 'kos',
            targetKey: variant.sku || variant.id,
            summaryLabel: variant.netMassKg === null ? `${(0, formatDecimalForDisplay)(variant.pricePerKg)} €/kg` : `${(0, formatDecimalForDisplay)(totalMass)} kg × ${(0, formatDecimalForDisplay)(variant.pricePerKg)} €`,
            discountUnitLabel: variant.netMassKg === null ? 'kg' : 'kos',
            stockLabel: formatWeightKg(variant.stockKg),
            minOrderLabel: variant.netMassKg === null ? `${(0, formatDecimalForDisplay)(variant.minQuantity || data.minQuantity || 1)} kg` : formatPieceCount(bagCount),
            weightFraction: variant.fraction || undefined,
            weightNetMassKg: variant.netMassKg ?? undefined,
            weightBagCount: bagCount,
            weightPricePerKg: variant.pricePerKg,
            weightPackagingCostPerBag: variant.packagingCostPerBag
        };
    });
    const seenFractions = new Set(variantOptions.map((option)=>createWeightFractionKey(option.weightFraction || '')));
    const fractionPricingOptions = data.fractionPricing.filter((row)=>{
        const key = createWeightFractionKey(row.fraction);
        if (!key || seenFractions.has(key)) return false;
        seenFractions.add(key);
        return true;
    }).map((row)=>({
            id: `weight-fraction-${row.id}`,
            label: row.fraction,
            basePrice: Number((row.pricePerKg + row.packagingCostPerBag).toFixed(4)),
            quantityUnit: 'kg',
            targetKey: row.fraction,
            summaryLabel: `${(0, formatDecimalForDisplay)(row.pricePerKg)} €/kg`,
            discountUnitLabel: 'kg',
            stockLabel: getMaterialStockLabel(row.fraction),
            minOrderLabel: `${(0, formatDecimalForDisplay)(data.minQuantity || 1)} kg`,
            weightFraction: row.fraction,
            weightNetMassKg: 1,
            weightBagCount: 1,
            weightPricePerKg: row.pricePerKg,
            weightPackagingCostPerBag: row.packagingCostPerBag
        }));
    const materialStockOptions = data.materialStocks.filter((row)=>{
        const key = createWeightFractionKey(row.fraction);
        if (!key || seenFractions.has(key)) return false;
        seenFractions.add(key);
        return true;
    }).map((row)=>{
        const pricing = getWeightFractionPricing(data, row.fraction);
        return {
            id: `weight-material-${row.id}`,
            label: row.fraction,
            basePrice: Number((pricing.pricePerKg + pricing.packagingCostPerBag).toFixed(4)),
            quantityUnit: 'kg',
            targetKey: row.fraction,
            summaryLabel: `${(0, formatDecimalForDisplay)(pricing.pricePerKg)} €/kg`,
            discountUnitLabel: 'kg',
            stockLabel: formatWeightKg(row.stockKg),
            minOrderLabel: `${(0, formatDecimalForDisplay)(data.minQuantity || 1)} kg`,
            weightFraction: row.fraction,
            weightNetMassKg: 1,
            weightBagCount: 1,
            weightPricePerKg: pricing.pricePerKg,
            weightPackagingCostPerBag: pricing.packagingCostPerBag
        };
    });
    return [
        ...variantOptions,
        ...fractionPricingOptions,
        ...materialStockOptions
    ];
}
function getMachineSimulatorOptions(data, label = 'Stroj / unikaten artikel') {
    return [
        {
            id: 'machine',
            label,
            basePrice: data.basePrice,
            quantityUnit: 'kos',
            summaryLabel: (0, formatCurrency)(data.basePrice),
            stockLabel: formatPieceCount(data.stock),
            minOrderLabel: formatPieceCount(1),
            serialLabels: getAvailableMachineSerialLabels(data.serialNumbers)
        }
    ];
}
function isFiniteDimensionValue(value) {
    return typeof value === 'number' && Number.isFinite(value);
}
function getDimensionSimulatorLabel(variant, index) {
    const dimensions = [
        variant.length,
        variant.width,
        variant.thickness
    ].filter(isFiniteDimensionValue).map(formatDecimalForDisplay);
    if (dimensions.length > 0) return `${dimensions.join(' x ')} mm`;
    return variant.sku.trim() || `Različica ${index + 1}`;
}
function getDimensionSimulatorOptions(variants) {
    return variants.map((variant, index)=>({
            id: variant.id,
            label: getDimensionSimulatorLabel(variant, index),
            basePrice: variant.price,
            quantityUnit: 'kos',
            targetKey: variant.sku || variant.id,
            summaryLabel: (0, formatCurrency)(variant.price),
            stockLabel: formatPieceCount(variant.stock),
            minOrderLabel: formatPieceCount(Math.max(1, Math.floor(Number(variant.minOrder) || 1)))
        }));
}
function ModeIcon({ type, className }) {
    if (type === 'dimensions') {
        return /*#__PURE__*/ jsxDEV("svg", {
            viewBox: "0 0 24 24",
            className: className,
            fill: "none",
            stroke: "currentColor",
            strokeWidth: "2",
            strokeLinecap: "round",
            strokeLinejoin: "round",
            "aria-hidden": "true",
            children: [
                /*#__PURE__*/ jsxDEV("rect", {
                    width: "20",
                    height: "16",
                    x: "2",
                    y: "4",
                    rx: "2"
                }, void 0, false, {
                    fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                    lineNumber: 1643,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ jsxDEV("path", {
                    d: "M12 9v11"
                }, void 0, false, {
                    fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                    lineNumber: 1644,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ jsxDEV("path", {
                    d: "M2 9h13a2 2 0 0 1 2 2v9"
                }, void 0, false, {
                    fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                    lineNumber: 1645,
                    columnNumber: 9
                }, this)
            ]
        }, void 0, true, {
            fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
            lineNumber: 1642,
            columnNumber: 7
        }, this);
    }
    if (type === 'weight') {
        return /*#__PURE__*/ jsxDEV("svg", {
            viewBox: "0 0 24 24",
            className: className,
            fill: "none",
            stroke: "currentColor",
            strokeWidth: "2",
            strokeLinecap: "round",
            strokeLinejoin: "round",
            "aria-hidden": "true",
            children: [
                /*#__PURE__*/ jsxDEV("path", {
                    d: "M12 3v18"
                }, void 0, false, {
                    fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                    lineNumber: 1652,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ jsxDEV("path", {
                    d: "m19 8 3 8a5 5 0 0 1-6 0zV7"
                }, void 0, false, {
                    fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                    lineNumber: 1653,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ jsxDEV("path", {
                    d: "M3 7h1a17 17 0 0 0 8-2 17 17 0 0 0 8 2h1"
                }, void 0, false, {
                    fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                    lineNumber: 1654,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ jsxDEV("path", {
                    d: "m5 8 3 8a5 5 0 0 1-6 0zV7"
                }, void 0, false, {
                    fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                    lineNumber: 1655,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ jsxDEV("path", {
                    d: "M7 21h10"
                }, void 0, false, {
                    fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                    lineNumber: 1656,
                    columnNumber: 9
                }, this)
            ]
        }, void 0, true, {
            fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
            lineNumber: 1651,
            columnNumber: 7
        }, this);
    }
    if (type === 'unique_machine') {
        return /*#__PURE__*/ jsxDEV("svg", {
            viewBox: "0 0 24 24",
            className: className,
            fill: "none",
            stroke: "currentColor",
            strokeWidth: "2",
            strokeLinecap: "round",
            strokeLinejoin: "round",
            "aria-hidden": "true",
            children: [
                /*#__PURE__*/ jsxDEV("path", {
                    d: "M11 10.27 7 3.34"
                }, void 0, false, {
                    fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                    lineNumber: 1663,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ jsxDEV("path", {
                    d: "m11 13.73-4 6.93"
                }, void 0, false, {
                    fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                    lineNumber: 1664,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ jsxDEV("path", {
                    d: "M12 22v-2"
                }, void 0, false, {
                    fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                    lineNumber: 1665,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ jsxDEV("path", {
                    d: "M12 2v2"
                }, void 0, false, {
                    fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                    lineNumber: 1666,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ jsxDEV("path", {
                    d: "M14 12h8"
                }, void 0, false, {
                    fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                    lineNumber: 1667,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ jsxDEV("path", {
                    d: "m17 20.66-1-1.73"
                }, void 0, false, {
                    fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                    lineNumber: 1668,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ jsxDEV("path", {
                    d: "m17 3.34-1 1.73"
                }, void 0, false, {
                    fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                    lineNumber: 1669,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ jsxDEV("path", {
                    d: "M2 12h2"
                }, void 0, false, {
                    fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                    lineNumber: 1670,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ jsxDEV("path", {
                    d: "m20.66 17-1.73-1"
                }, void 0, false, {
                    fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                    lineNumber: 1671,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ jsxDEV("path", {
                    d: "m20.66 7-1.73 1"
                }, void 0, false, {
                    fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                    lineNumber: 1672,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ jsxDEV("path", {
                    d: "m3.34 17 1.73-1"
                }, void 0, false, {
                    fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                    lineNumber: 1673,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ jsxDEV("path", {
                    d: "m3.34 7 1.73 1"
                }, void 0, false, {
                    fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                    lineNumber: 1674,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ jsxDEV("circle", {
                    cx: "12",
                    cy: "12",
                    r: "2"
                }, void 0, false, {
                    fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                    lineNumber: 1675,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ jsxDEV("circle", {
                    cx: "12",
                    cy: "12",
                    r: "8"
                }, void 0, false, {
                    fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                    lineNumber: 1676,
                    columnNumber: 9
                }, this)
            ]
        }, void 0, true, {
            fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
            lineNumber: 1662,
            columnNumber: 7
        }, this);
    }
    return /*#__PURE__*/ jsxDEV("svg", {
        viewBox: "0 0 24 24",
        className: className,
        fill: "none",
        stroke: "currentColor",
        strokeWidth: "2",
        strokeLinecap: "round",
        strokeLinejoin: "round",
        "aria-hidden": "true",
        children: [
            /*#__PURE__*/ jsxDEV("path", {
                d: "m15 12-9.373 9.373a1 1 0 0 1-3.001-3L12 9"
            }, void 0, false, {
                fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                lineNumber: 1682,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ jsxDEV("path", {
                d: "m18 15 4-4"
            }, void 0, false, {
                fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                lineNumber: 1683,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ jsxDEV("path", {
                d: "m21.5 11.5-1.914-1.914A2 2 0 0 1 19 8.172v-.344a2 2 0 0 0-.586-1.414l-1.657-1.657A6 6 0 0 0 12.516 3H9l1.243 1.243A6 6 0 0 1 12 8.485V10l2 2h1.172a2 2 0 0 1 1.414.586L18.5 14.5"
            }, void 0, false, {
                fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                lineNumber: 1684,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
        lineNumber: 1681,
        columnNumber: 5
    }, this);
}
function ProductTypeSelectorCardRow({ value, editable, onChange, embedded = false, collapsed = false, onExpand, expandDisabled = false }) {
    const modes = [
        {
            type: 'simple',
            title: 'Enostavni',
            description: [
                'En artikel brez različic.',
                'Ena cena, en SKU in ena zaloga.'
            ]
        },
        {
            type: 'dimensions',
            title: 'Po dimenzijah',
            description: [
                'Isti artikel v več merah.',
                'Vsaka kombinacija dimenzij ima svojo ceno, SKU in zalogo.'
            ]
        },
        {
            type: 'weight',
            title: 'Po teži',
            description: [
                'Isti material v več različicah s skupno zalogo.',
                'Cena je vezana na maso različice.'
            ]
        },
        {
            type: 'unique_machine',
            title: 'Stroj / unikaten',
            description: [
                'Posamezen stroj ali unikaten artikel.',
                'En artikel z lastnimi tehničnimi podatki, servisom in garancijo.'
            ]
        }
    ];
    const selectedMode = modes.find((mode)=>mode.type === value) ?? modes[0];
    const content = /*#__PURE__*/ jsxDEV(Fragment, {
        children: [
            /*#__PURE__*/ jsxDEV("div", {
                className: "mb-3 flex items-center gap-2",
                children: /*#__PURE__*/ jsxDEV("h2", {
                    className: "text-[15px] font-semibold text-slate-900",
                    children: "Tip artikla"
                }, void 0, false, {
                    fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                    lineNumber: 1733,
                    columnNumber: 9
                }, this)
            }, void 0, false, {
                fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                lineNumber: 1732,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ jsxDEV("div", {
                className: "grid gap-4 md:grid-cols-2 xl:grid-cols-4",
                children: modes.map((mode)=>{
                    const selected = mode.type === value;
                    return /*#__PURE__*/ jsxDEV("button", {
                        type: "button",
                        disabled: !editable,
                        "aria-pressed": selected,
                        onClick: ()=>{
                            if (!editable || selected) return;
                            onChange(mode.type);
                        },
                        className: classNames('grid min-h-[92px] grid-cols-[2rem_minmax(0,1fr)] items-start gap-x-3 gap-y-2 rounded-lg border bg-white p-4 text-left transition', selected ? 'border-[#4a91f5] bg-[#f8fbff] shadow-[0_0_0_1px_rgba(74,145,245,0.22)]' : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50', !editable && !selected ? 'cursor-default opacity-80 hover:border-slate-200 hover:bg-white' : ''),
                        children: [
                            /*#__PURE__*/ jsxDEV(ModeIcon, {
                                type: mode.type,
                                className: classNames('mt-0.5 h-7 w-7 shrink-0', selected ? 'text-[#1982bf]' : 'text-slate-700')
                            }, void 0, false, {
                                fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                lineNumber: 1756,
                                columnNumber: 15
                            }, this),
                            /*#__PURE__*/ jsxDEV("span", {
                                className: classNames('min-w-0 self-center text-sm font-semibold', selected ? 'text-[#1982bf]' : 'text-slate-900'),
                                children: mode.title
                            }, void 0, false, {
                                fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                lineNumber: 1757,
                                columnNumber: 15
                            }, this),
                            /*#__PURE__*/ jsxDEV("ul", {
                                className: "col-span-2 mt-0 list-disc space-y-1 pl-4 text-[11px] font-medium leading-4 text-slate-600",
                                children: mode.description.map((sentence)=>/*#__PURE__*/ jsxDEV("li", {
                                        children: sentence
                                    }, sentence, false, {
                                        fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                        lineNumber: 1762,
                                        columnNumber: 19
                                    }, this))
                            }, void 0, false, {
                                fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                lineNumber: 1760,
                                columnNumber: 15
                            }, this)
                        ]
                    }, mode.type, true, {
                        fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                        lineNumber: 1739,
                        columnNumber: 13
                    }, this);
                })
            }, void 0, false, {
                fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                lineNumber: 1735,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true);
    const collapsedContent = /*#__PURE__*/ jsxDEV(Fragment, {
        children: [
            /*#__PURE__*/ jsxDEV("div", {
                className: "mb-2 flex items-center gap-2",
                children: /*#__PURE__*/ jsxDEV("h2", {
                    className: "text-[13px] font-semibold text-slate-900",
                    children: "Tip artikla"
                }, void 0, false, {
                    fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                    lineNumber: 1774,
                    columnNumber: 9
                }, this)
            }, void 0, false, {
                fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                lineNumber: 1773,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ jsxDEV("div", {
                className: "flex min-h-[58px] items-center justify-between gap-4 rounded-lg border border-slate-200 bg-white px-4 py-3",
                children: [
                    /*#__PURE__*/ jsxDEV("div", {
                        className: "flex min-w-0 items-center gap-3",
                        children: [
                            /*#__PURE__*/ jsxDEV(ModeIcon, {
                                type: selectedMode.type,
                                className: "h-7 w-7 shrink-0 text-[#1982bf]"
                            }, void 0, false, {
                                fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                lineNumber: 1778,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ jsxDEV("div", {
                                className: "min-w-0",
                                children: [
                                    /*#__PURE__*/ jsxDEV("p", {
                                        className: "truncate text-[13px] font-semibold leading-4 text-[#1982bf]",
                                        children: selectedMode.title
                                    }, void 0, false, {
                                        fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                        lineNumber: 1780,
                                        columnNumber: 13
                                    }, this),
                                    /*#__PURE__*/ jsxDEV("p", {
                                        className: "truncate text-[11px] font-medium leading-4 text-slate-600",
                                        children: selectedMode.description.join(' ')
                                    }, void 0, false, {
                                        fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                        lineNumber: 1781,
                                        columnNumber: 13
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                lineNumber: 1779,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                        lineNumber: 1777,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ jsxDEV("button", {
                        type: "button",
                        disabled: expandDisabled,
                        onClick: onExpand,
                        className: classNames('inline-flex h-8 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-white px-3 text-[11px] font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50', expandDisabled && 'cursor-not-allowed opacity-60 hover:border-slate-200 hover:bg-white'),
                        children: "Spremeni"
                    }, void 0, false, {
                        fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                        lineNumber: 1784,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                lineNumber: 1776,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true);
    if (embedded) {
        return /*#__PURE__*/ jsxDEV("div", {
            className: "mt-4 border-t border-slate-200 pt-4",
            children: collapsed ? collapsedContent : content
        }, void 0, false, {
            fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
            lineNumber: 1800,
            columnNumber: 12
        }, this);
    }
    return /*#__PURE__*/ jsxDEV("section", {
        className: `${adminWindowCardClassName} px-5 py-5`,
        style: adminWindowCardStyle,
        children: collapsed ? collapsedContent : content
    }, void 0, false, {
        fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
        lineNumber: 1804,
        columnNumber: 5
    }, this);
}
function LogicIcon({ type, active = false }) {
    const className = active ? 'h-8 w-8 text-[#1982bf]' : 'h-6 w-6 text-[#1982bf]';
    if (type === 'price' || type === 'sku') {
        return /*#__PURE__*/ jsxDEV("svg", {
            viewBox: "0 0 24 24",
            className: className,
            fill: "none",
            stroke: "currentColor",
            strokeWidth: "1.7",
            strokeLinecap: "round",
            strokeLinejoin: "round",
            "aria-hidden": "true",
            children: [
                /*#__PURE__*/ jsxDEV("path", {
                    d: "M20 12 12 20 4 12l8-8h8v8Z"
                }, void 0, false, {
                    fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                    lineNumber: 1815,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ jsxDEV("circle", {
                    cx: "15.5",
                    cy: "8.5",
                    r: "1.2"
                }, void 0, false, {
                    fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                    lineNumber: 1816,
                    columnNumber: 9
                }, this)
            ]
        }, void 0, true, {
            fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
            lineNumber: 1814,
            columnNumber: 7
        }, this);
    }
    if (type === 'stock') {
        return /*#__PURE__*/ jsxDEV("svg", {
            viewBox: "0 0 24 24",
            className: className,
            fill: "none",
            stroke: "currentColor",
            strokeWidth: "1.7",
            strokeLinecap: "round",
            strokeLinejoin: "round",
            "aria-hidden": "true",
            children: [
                /*#__PURE__*/ jsxDEV("rect", {
                    x: "5",
                    y: "5",
                    width: "14",
                    height: "14",
                    rx: "2"
                }, void 0, false, {
                    fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                    lineNumber: 1823,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ jsxDEV("path", {
                    d: "m9 13 2-5h4l-2 4h3l-5 5 1-4H9Z"
                }, void 0, false, {
                    fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                    lineNumber: 1824,
                    columnNumber: 9
                }, this)
            ]
        }, void 0, true, {
            fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
            lineNumber: 1822,
            columnNumber: 7
        }, this);
    }
    if (type === 'delivery' || type === 'package') {
        return /*#__PURE__*/ jsxDEV("svg", {
            viewBox: "0 0 24 24",
            className: className,
            fill: "none",
            stroke: "currentColor",
            strokeWidth: "1.7",
            strokeLinecap: "round",
            strokeLinejoin: "round",
            "aria-hidden": "true",
            children: [
                /*#__PURE__*/ jsxDEV("path", {
                    d: "M3 7h11v10H3z"
                }, void 0, false, {
                    fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                    lineNumber: 1831,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ jsxDEV("path", {
                    d: "M14 10h4l3 3v4h-7z"
                }, void 0, false, {
                    fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                    lineNumber: 1832,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ jsxDEV("circle", {
                    cx: "7",
                    cy: "18",
                    r: "1.5"
                }, void 0, false, {
                    fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                    lineNumber: 1833,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ jsxDEV("circle", {
                    cx: "18",
                    cy: "18",
                    r: "1.5"
                }, void 0, false, {
                    fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                    lineNumber: 1834,
                    columnNumber: 9
                }, this)
            ]
        }, void 0, true, {
            fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
            lineNumber: 1830,
            columnNumber: 7
        }, this);
    }
    if (type === 'service') {
        return /*#__PURE__*/ jsxDEV("svg", {
            viewBox: "0 0 24 24",
            className: className,
            fill: "none",
            stroke: "currentColor",
            strokeWidth: "1.7",
            strokeLinecap: "round",
            strokeLinejoin: "round",
            "aria-hidden": "true",
            children: [
                /*#__PURE__*/ jsxDEV("path", {
                    d: "M12 3 4.5 6v5.5c0 4.2 2.7 7.2 7.5 9.5 4.8-2.3 7.5-5.3 7.5-9.5V6L12 3Z"
                }, void 0, false, {
                    fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                    lineNumber: 1841,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ jsxDEV("path", {
                    d: "m9 12 2 2 4-5"
                }, void 0, false, {
                    fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                    lineNumber: 1842,
                    columnNumber: 9
                }, this)
            ]
        }, void 0, true, {
            fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
            lineNumber: 1840,
            columnNumber: 7
        }, this);
    }
    return /*#__PURE__*/ jsxDEV(ModeIcon, {
        type: type,
        className: className
    }, void 0, false, {
        fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
        lineNumber: 1846,
        columnNumber: 10
    }, this);
}
function ProductPricingLogicCardRow({ productType, simpleData, weightData, machineData }) {
    const config = {
        simple: {
            title: 'Aktivni način: Enostavni',
            text: 'Artikel uporablja eno osnovno ceno, en SKU in eno količino zaloge. Enostavno upravljanje cen, zaloge in razpoložljivosti.',
            cards: [
                {
                    icon: 'price',
                    title: 'Osnovna cena',
                    text: `${(0, formatCurrency)(simpleData.actionPriceEnabled ? simpleData.actionPrice : simpleData.basePrice)} brez DDV`
                },
                {
                    icon: 'stock',
                    title: 'Zaloga',
                    text: `${simpleData.stock} kos`
                },
                {
                    icon: 'delivery',
                    title: 'Dobavni rok',
                    text: simpleData.deliveryTime
                }
            ]
        },
        dimensions: {
            title: 'Aktivni način: Po dimenzijah',
            text: 'Cena, SKU in zaloga se določijo za vsako kombinacijo dimenzij. Vsaka vrstica predstavlja specifično različico artikla.',
            cards: [
                {
                    icon: 'dimensions',
                    title: 'Dimenzije',
                    text: 'Dolžina x Širina x Debelina z tolerancami'
                },
                {
                    icon: 'sku',
                    title: 'SKU & Cena',
                    text: 'Samodejno generirani SKU-ji in cene po pravilih'
                },
                {
                    icon: 'stock',
                    title: 'Zaloga',
                    text: 'Zaloga ločeno po kombinacijah skladno z vnosom'
                }
            ]
        },
        weight: {
            title: 'Aktivni način: Po teži',
            text: 'Artikel se prodaja po dejanski teži. Cena je definirana na kg, zaloga se vodi v kg, pakiranja pa izračunajo prodajno ceno.',
            cards: [
                {
                    icon: 'price',
                    title: 'Cena na kg',
                    text: `${(0, formatDecimalForDisplay)(toGrossWithVat(weightData.pricePerKg))} €/kg z DDV`
                },
                {
                    icon: 'stock',
                    title: 'Zaloga v kg',
                    text: `${(0, formatDecimalForDisplay)(weightData.stockKg)} kg`
                },
                {
                    icon: 'package',
                    title: 'Pakiranja in pretvorbe',
                    text: 'Pakiranja imajo izračunane cene na podlagi cene na kg.'
                }
            ]
        },
        unique_machine: {
            title: 'Aktivni način: Stroj / unikaten',
            text: 'Ena definicija artikla brez variant. Podpora za serijske številke, garancijo, servisne podatke in tehnično dokumentacijo.',
            cards: [
                {
                    icon: 'price',
                    title: 'Enotna definicija',
                    text: 'En SKU = en artikel'
                },
                {
                    icon: 'unique_machine',
                    title: 'Sledljivost',
                    text: machineData.serialTrackingRequired ? 'Serijske številke obvezne' : 'Sledljivost po potrebi'
                },
                {
                    icon: 'service',
                    title: 'Servis in garancija',
                    text: `${formatQuantityRangeWithUnit(machineData.warrantyMonths, 'month')} garancije`
                }
            ]
        }
    }[productType];
    return /*#__PURE__*/ jsxDEV("section", {
        className: `${adminWindowCardClassName} p-5`,
        style: adminWindowCardStyle,
        children: /*#__PURE__*/ jsxDEV("div", {
            className: "grid gap-4 xl:grid-cols-[minmax(360px,1.15fr)_repeat(3,minmax(0,1fr))]",
            children: [
                /*#__PURE__*/ jsxDEV("div", {
                    className: "flex items-center gap-4 rounded-lg bg-[#f2f8ff] p-4",
                    children: [
                        /*#__PURE__*/ jsxDEV("span", {
                            className: "inline-flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-white text-[#1982bf] shadow-[inset_0_0_0_1px_rgba(226,232,240,0.9)]",
                            children: /*#__PURE__*/ jsxDEV(LogicIcon, {
                                type: productType,
                                active: true
                            }, void 0, false, {
                                fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                lineNumber: 1904,
                                columnNumber: 13
                            }, this)
                        }, void 0, false, {
                            fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                            lineNumber: 1903,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ jsxDEV("div", {
                            children: [
                                /*#__PURE__*/ jsxDEV("h2", {
                                    className: "text-[17px] font-semibold text-slate-900",
                                    children: "Logika cen in zaloge"
                                }, void 0, false, {
                                    fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                    lineNumber: 1907,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ jsxDEV("p", {
                                    className: "mt-2 text-sm font-semibold text-slate-900",
                                    children: config.title
                                }, void 0, false, {
                                    fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                    lineNumber: 1908,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ jsxDEV("p", {
                                    className: "mt-1 text-[12px] font-medium leading-5 text-slate-600",
                                    children: config.text
                                }, void 0, false, {
                                    fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                    lineNumber: 1909,
                                    columnNumber: 13
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                            lineNumber: 1906,
                            columnNumber: 11
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                    lineNumber: 1902,
                    columnNumber: 9
                }, this),
                config.cards.map((card)=>/*#__PURE__*/ jsxDEV("div", {
                        className: "flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-4",
                        children: [
                            /*#__PURE__*/ jsxDEV("span", {
                                className: "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white",
                                children: /*#__PURE__*/ jsxDEV(LogicIcon, {
                                    type: card.icon
                                }, void 0, false, {
                                    fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                    lineNumber: 1915,
                                    columnNumber: 15
                                }, this)
                            }, void 0, false, {
                                fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                lineNumber: 1914,
                                columnNumber: 13
                            }, this),
                            /*#__PURE__*/ jsxDEV("span", {
                                children: [
                                    /*#__PURE__*/ jsxDEV("span", {
                                        className: "block text-sm font-semibold text-slate-900",
                                        children: card.title
                                    }, void 0, false, {
                                        fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                        lineNumber: 1918,
                                        columnNumber: 15
                                    }, this),
                                    /*#__PURE__*/ jsxDEV("span", {
                                        className: "mt-1 block text-[12px] font-medium leading-5 text-slate-600",
                                        children: card.text
                                    }, void 0, false, {
                                        fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                        lineNumber: 1919,
                                        columnNumber: 15
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                lineNumber: 1917,
                                columnNumber: 13
                            }, this)
                        ]
                    }, card.title, true, {
                        fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                        lineNumber: 1913,
                        columnNumber: 11
                    }, this))
            ]
        }, void 0, true, {
            fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
            lineNumber: 1901,
            columnNumber: 7
        }, this)
    }, void 0, false, {
        fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
        lineNumber: 1900,
        columnNumber: 5
    }, this);
}
function SimpleProductModule({ editable, data, quantityDiscountsPanel, onChange }) {
    _s();
    const [selectedBasicInfoIds, setSelectedBasicInfoIds] = (0, useState)(new Set());
    const [selectedSpecIds, setSelectedSpecIds] = (0, useState)(new Set());
    const update = (updates)=>onChange({
            ...data,
            ...updates
        });
    const updateBasicInfoRow = (id, updates)=>update({
            basicInfoRows: data.basicInfoRows.map((row)=>row.id === id ? {
                    ...row,
                    ...updates
                } : row)
        });
    const updateSpec = (id, updates)=>update({
            technicalSpecs: data.technicalSpecs.map((spec)=>spec.id === id ? {
                    ...spec,
                    ...updates
                } : spec)
        });
    const addBasicInfoRow = ()=>update({
            basicInfoRows: [
                ...data.basicInfoRows,
                {
                    id: createLocalId('simple-basic-info'),
                    property: '',
                    value: ''
                }
            ]
        });
    const addSpec = ()=>update({
            technicalSpecs: [
                ...data.technicalSpecs,
                {
                    id: createLocalId('simple-spec'),
                    property: '',
                    value: ''
                }
            ]
        });
    const allBasicInfoSelected = data.basicInfoRows.length > 0 && data.basicInfoRows.every((row)=>selectedBasicInfoIds.has(row.id));
    const hasSelectedBasicInfo = data.basicInfoRows.some((row)=>selectedBasicInfoIds.has(row.id));
    const allSpecsSelected = data.technicalSpecs.length > 0 && data.technicalSpecs.every((spec)=>selectedSpecIds.has(spec.id));
    const hasSelectedSpecs = data.technicalSpecs.some((spec)=>selectedSpecIds.has(spec.id));
    const toggleBasicInfoSelection = (id)=>{
        setSelectedBasicInfoIds((current)=>{
            const next = new Set(current);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };
    const toggleAllBasicInfo = ()=>{
        setSelectedBasicInfoIds(allBasicInfoSelected ? new Set() : new Set(data.basicInfoRows.map((row)=>row.id)));
    };
    const removeSelectedBasicInfoRows = ()=>{
        if (!hasSelectedBasicInfo) return;
        update({
            basicInfoRows: data.basicInfoRows.filter((row)=>!selectedBasicInfoIds.has(row.id))
        });
        setSelectedBasicInfoIds(new Set());
    };
    const toggleSpecSelection = (id)=>{
        setSelectedSpecIds((current)=>{
            const next = new Set(current);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };
    const toggleAllSpecs = ()=>{
        setSelectedSpecIds(allSpecsSelected ? new Set() : new Set(data.technicalSpecs.map((spec)=>spec.id)));
    };
    const removeSelectedSpecs = ()=>{
        if (!hasSelectedSpecs) return;
        update({
            technicalSpecs: data.technicalSpecs.filter((spec)=>!selectedSpecIds.has(spec.id))
        });
        setSelectedSpecIds(new Set());
    };
    (0, useEffect)({
        "SimpleProductModule.useEffect": ()=>{
            setSelectedBasicInfoIds({
                "SimpleProductModule.useEffect": (current)=>{
                    const validIds = new Set(data.basicInfoRows.map({
                        "SimpleProductModule.useEffect": (row)=>row.id
                    }["SimpleProductModule.useEffect"]));
                    const next = new Set(Array.from(current).filter({
                        "SimpleProductModule.useEffect": (id)=>validIds.has(id)
                    }["SimpleProductModule.useEffect"]));
                    return next.size === current.size ? current : next;
                }
            }["SimpleProductModule.useEffect"]);
        }
    }["SimpleProductModule.useEffect"], [
        data.basicInfoRows
    ]);
    (0, useEffect)({
        "SimpleProductModule.useEffect": ()=>{
            setSelectedSpecIds({
                "SimpleProductModule.useEffect": (current)=>{
                    const validIds = new Set(data.technicalSpecs.map({
                        "SimpleProductModule.useEffect": (spec)=>spec.id
                    }["SimpleProductModule.useEffect"]));
                    const next = new Set(Array.from(current).filter({
                        "SimpleProductModule.useEffect": (id)=>validIds.has(id)
                    }["SimpleProductModule.useEffect"]));
                    return next.size === current.size ? current : next;
                }
            }["SimpleProductModule.useEffect"]);
        }
    }["SimpleProductModule.useEffect"], [
        data.technicalSpecs
    ]);
    return /*#__PURE__*/ jsxDEV("section", {
        className: `${adminWindowCardClassName} px-5 pb-5 pt-5`,
        style: adminWindowCardStyle,
        children: [
            /*#__PURE__*/ jsxDEV("div", {
                className: "mb-4",
                children: /*#__PURE__*/ jsxDEV("h2", {
                    className: sectionTitleClassName,
                    children: "Prodajne informacije"
                }, void 0, false, {
                    fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                    lineNumber: 2006,
                    columnNumber: 9
                }, this)
            }, void 0, false, {
                fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                lineNumber: 2005,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ jsxDEV("div", {
                className: classNames('grid items-stretch gap-4', quantityDiscountsPanel ? 'xl:grid-cols-[minmax(0,7fr)_minmax(0,3fr)]' : 'xl:grid-cols-1'),
                children: [
                    quantityDiscountsPanel ? /*#__PURE__*/ jsxDEV("div", {
                        className: "h-full overflow-hidden rounded-lg border border-slate-200 bg-white",
                        children: quantityDiscountsPanel
                    }, void 0, false, {
                        fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                        lineNumber: 2011,
                        columnNumber: 11
                    }, this) : null,
                    /*#__PURE__*/ jsxDEV("section", {
                        className: "overflow-hidden rounded-lg border border-slate-200 bg-white",
                        children: [
                            /*#__PURE__*/ jsxDEV("div", {
                                className: "flex items-center justify-between gap-2 px-4 py-3",
                                children: [
                                    /*#__PURE__*/ jsxDEV("h3", {
                                        className: "text-sm font-semibold text-slate-900",
                                        children: "Osnovne informacije"
                                    }, void 0, false, {
                                        fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                        lineNumber: 2018,
                                        columnNumber: 13
                                    }, this),
                                    /*#__PURE__*/ jsxDEV("div", {
                                        className: "flex items-center gap-2",
                                        children: [
                                            /*#__PURE__*/ jsxDEV(IconButton, {
                                                type: "button",
                                                tone: "neutral",
                                                className: adminTableNeutralIconButtonClassName,
                                                disabled: !editable,
                                                onClick: addBasicInfoRow,
                                                "aria-label": "Dodaj osnovno informacijo",
                                                title: "Dodaj osnovno informacijo",
                                                children: /*#__PURE__*/ jsxDEV(PlusIcon, {}, void 0, false, {
                                                    fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                    lineNumber: 2020,
                                                    columnNumber: 225
                                                }, this)
                                            }, void 0, false, {
                                                fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                lineNumber: 2020,
                                                columnNumber: 15
                                            }, this),
                                            /*#__PURE__*/ jsxDEV(IconButton, {
                                                type: "button",
                                                tone: hasSelectedBasicInfo ? 'danger' : 'neutral',
                                                className: hasSelectedBasicInfo ? adminTableSelectedDangerIconButtonClassName : adminTableNeutralIconButtonClassName,
                                                disabled: !editable || !hasSelectedBasicInfo,
                                                onClick: removeSelectedBasicInfoRows,
                                                "aria-label": "Odstrani izbrane osnovne informacije",
                                                title: "Odstrani izbrane",
                                                children: /*#__PURE__*/ jsxDEV(TrashCanIcon, {}, void 0, false, {
                                                    fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                    lineNumber: 2030,
                                                    columnNumber: 17
                                                }, this)
                                            }, void 0, false, {
                                                fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                lineNumber: 2021,
                                                columnNumber: 15
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                        lineNumber: 2019,
                                        columnNumber: 13
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                lineNumber: 2017,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ jsxDEV("div", {
                                className: "overflow-hidden border-t border-slate-200",
                                children: /*#__PURE__*/ jsxDEV("table", {
                                    className: "w-full table-fixed text-[12px]",
                                    children: [
                                        /*#__PURE__*/ jsxDEV("colgroup", {
                                            children: [
                                                /*#__PURE__*/ jsxDEV("col", {
                                                    style: {
                                                        width: '32px'
                                                    }
                                                }, void 0, false, {
                                                    fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                    lineNumber: 2037,
                                                    columnNumber: 17
                                                }, this),
                                                /*#__PURE__*/ jsxDEV("col", {
                                                    style: {
                                                        width: narrowInfoLabelColumnWidth
                                                    }
                                                }, void 0, false, {
                                                    fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                    lineNumber: 2038,
                                                    columnNumber: 17
                                                }, this),
                                                /*#__PURE__*/ jsxDEV("col", {}, void 0, false, {
                                                    fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                    lineNumber: 2039,
                                                    columnNumber: 17
                                                }, this)
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                            lineNumber: 2036,
                                            columnNumber: 15
                                        }, this),
                                        /*#__PURE__*/ jsxDEV("thead", {
                                            className: "bg-[color:var(--admin-table-header-bg)]",
                                            children: /*#__PURE__*/ jsxDEV("tr", {
                                                children: [
                                                    /*#__PURE__*/ jsxDEV("th", {
                                                        className: "w-8 px-1 py-2 text-center",
                                                        children: /*#__PURE__*/ jsxDEV(AdminCheckbox, {
                                                            checked: editable && allBasicInfoSelected,
                                                            disabled: !editable || data.basicInfoRows.length === 0,
                                                            onChange: toggleAllBasicInfo
                                                        }, void 0, false, {
                                                            fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                            lineNumber: 2044,
                                                            columnNumber: 21
                                                        }, this)
                                                    }, void 0, false, {
                                                        fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                        lineNumber: 2043,
                                                        columnNumber: 19
                                                    }, this),
                                                    /*#__PURE__*/ jsxDEV("th", {
                                                        className: narrowInfoHeaderClassName,
                                                        children: "Lastnost"
                                                    }, void 0, false, {
                                                        fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                        lineNumber: 2046,
                                                        columnNumber: 19
                                                    }, this),
                                                    /*#__PURE__*/ jsxDEV("th", {
                                                        className: narrowInfoHeaderClassName,
                                                        children: "Vrednost"
                                                    }, void 0, false, {
                                                        fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                        lineNumber: 2047,
                                                        columnNumber: 19
                                                    }, this)
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                lineNumber: 2042,
                                                columnNumber: 17
                                            }, this)
                                        }, void 0, false, {
                                            fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                            lineNumber: 2041,
                                            columnNumber: 15
                                        }, this),
                                        /*#__PURE__*/ jsxDEV("tbody", {
                                            children: [
                                                /*#__PURE__*/ jsxDEV("tr", {
                                                    className: "border-t border-slate-100",
                                                    children: [
                                                        /*#__PURE__*/ jsxDEV("td", {
                                                            className: "px-1 py-1.5 text-center",
                                                            "aria-hidden": "true",
                                                            children: /*#__PURE__*/ jsxDEV(DisabledSelectionCheckbox, {}, void 0, false, {
                                                                fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                                lineNumber: 2052,
                                                                columnNumber: 78
                                                            }, this)
                                                        }, void 0, false, {
                                                            fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                            lineNumber: 2052,
                                                            columnNumber: 19
                                                        }, this),
                                                        /*#__PURE__*/ jsxDEV("td", {
                                                            className: narrowInfoCellClassName,
                                                            children: "Cena (z DDV)"
                                                        }, void 0, false, {
                                                            fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                            lineNumber: 2053,
                                                            columnNumber: 19
                                                        }, this),
                                                        /*#__PURE__*/ jsxDEV("td", {
                                                            className: narrowInfoCellClassName,
                                                            children: /*#__PURE__*/ jsxDEV(NumberField, {
                                                                label: "",
                                                                value: data.basePrice,
                                                                suffix: "€",
                                                                compact: true,
                                                                editable: editable,
                                                                onChange: (value)=>update({
                                                                        basePrice: value
                                                                    })
                                                            }, void 0, false, {
                                                                fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                                lineNumber: 2055,
                                                                columnNumber: 21
                                                            }, this)
                                                        }, void 0, false, {
                                                            fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                            lineNumber: 2054,
                                                            columnNumber: 19
                                                        }, this)
                                                    ]
                                                }, void 0, true, {
                                                    fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                    lineNumber: 2051,
                                                    columnNumber: 17
                                                }, this),
                                                /*#__PURE__*/ jsxDEV("tr", {
                                                    className: "border-t border-slate-100",
                                                    children: [
                                                        /*#__PURE__*/ jsxDEV("td", {
                                                            className: "px-1 py-1.5 text-center",
                                                            "aria-hidden": "true",
                                                            children: /*#__PURE__*/ jsxDEV(DisabledSelectionCheckbox, {}, void 0, false, {
                                                                fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                                lineNumber: 2059,
                                                                columnNumber: 78
                                                            }, this)
                                                        }, void 0, false, {
                                                            fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                            lineNumber: 2059,
                                                            columnNumber: 19
                                                        }, this),
                                                        /*#__PURE__*/ jsxDEV("td", {
                                                            className: narrowInfoCellClassName,
                                                            children: "Zaloga"
                                                        }, void 0, false, {
                                                            fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                            lineNumber: 2060,
                                                            columnNumber: 19
                                                        }, this),
                                                        /*#__PURE__*/ jsxDEV("td", {
                                                            className: narrowInfoCellClassName,
                                                            children: /*#__PURE__*/ jsxDEV(IntegerUnitField, {
                                                                value: data.stock,
                                                                unitKind: "piece",
                                                                compact: true,
                                                                editable: editable,
                                                                onChange: (value)=>update({
                                                                        stock: value
                                                                    })
                                                            }, void 0, false, {
                                                                fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                                lineNumber: 2062,
                                                                columnNumber: 21
                                                            }, this)
                                                        }, void 0, false, {
                                                            fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                            lineNumber: 2061,
                                                            columnNumber: 19
                                                        }, this)
                                                    ]
                                                }, void 0, true, {
                                                    fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                    lineNumber: 2058,
                                                    columnNumber: 17
                                                }, this),
                                                /*#__PURE__*/ jsxDEV("tr", {
                                                    className: "border-t border-slate-100",
                                                    children: [
                                                        /*#__PURE__*/ jsxDEV("td", {
                                                            className: "px-1 py-1.5 text-center",
                                                            "aria-hidden": "true",
                                                            children: /*#__PURE__*/ jsxDEV(DisabledSelectionCheckbox, {}, void 0, false, {
                                                                fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                                lineNumber: 2066,
                                                                columnNumber: 78
                                                            }, this)
                                                        }, void 0, false, {
                                                            fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                            lineNumber: 2066,
                                                            columnNumber: 19
                                                        }, this),
                                                        /*#__PURE__*/ jsxDEV("td", {
                                                            className: narrowInfoCellClassName,
                                                            children: "Dobavni rok"
                                                        }, void 0, false, {
                                                            fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                            lineNumber: 2067,
                                                            columnNumber: 19
                                                        }, this),
                                                        /*#__PURE__*/ jsxDEV("td", {
                                                            className: narrowInfoCellClassName,
                                                            children: /*#__PURE__*/ jsxDEV(QuantityRangeUnitField, {
                                                                value: data.deliveryTime,
                                                                unitKind: "workday",
                                                                compact: true,
                                                                editable: editable,
                                                                onChange: (value)=>update({
                                                                        deliveryTime: formatQuantityRangeWithUnit(value, 'workday')
                                                                    })
                                                            }, void 0, false, {
                                                                fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                                lineNumber: 2069,
                                                                columnNumber: 21
                                                            }, this)
                                                        }, void 0, false, {
                                                            fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                            lineNumber: 2068,
                                                            columnNumber: 19
                                                        }, this)
                                                    ]
                                                }, void 0, true, {
                                                    fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                    lineNumber: 2065,
                                                    columnNumber: 17
                                                }, this),
                                                data.basicInfoRows.map((row)=>/*#__PURE__*/ jsxDEV("tr", {
                                                        className: "border-t border-slate-100",
                                                        children: [
                                                            /*#__PURE__*/ jsxDEV("td", {
                                                                className: "px-1 py-1.5 text-center",
                                                                children: editable ? /*#__PURE__*/ jsxDEV(AdminCheckbox, {
                                                                    checked: selectedBasicInfoIds.has(row.id),
                                                                    onChange: ()=>toggleBasicInfoSelection(row.id)
                                                                }, void 0, false, {
                                                                    fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                                    lineNumber: 2075,
                                                                    columnNumber: 35
                                                                }, this) : /*#__PURE__*/ jsxDEV(DisabledSelectionCheckbox, {}, void 0, false, {
                                                                    fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                                    lineNumber: 2075,
                                                                    columnNumber: 148
                                                                }, this)
                                                            }, void 0, false, {
                                                                fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                                lineNumber: 2074,
                                                                columnNumber: 21
                                                            }, this),
                                                            /*#__PURE__*/ jsxDEV("td", {
                                                                className: narrowInfoCellClassName,
                                                                children: editable ? /*#__PURE__*/ jsxDEV("input", {
                                                                    className: compactInfoFieldFrameClassName,
                                                                    value: row.property,
                                                                    onChange: (event)=>updateBasicInfoRow(row.id, {
                                                                            property: event.target.value
                                                                        })
                                                                }, void 0, false, {
                                                                    fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                                    lineNumber: 2077,
                                                                    columnNumber: 73
                                                                }, this) : /*#__PURE__*/ jsxDEV(ReadOnlyCompactField, {
                                                                    value: row.property
                                                                }, void 0, false, {
                                                                    fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                                    lineNumber: 2077,
                                                                    columnNumber: 232
                                                                }, this)
                                                            }, void 0, false, {
                                                                fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                                lineNumber: 2077,
                                                                columnNumber: 21
                                                            }, this),
                                                            /*#__PURE__*/ jsxDEV("td", {
                                                                className: narrowInfoCellClassName,
                                                                children: /*#__PURE__*/ jsxDEV(SpecValueField, {
                                                                    value: row.value,
                                                                    compact: true,
                                                                    editable: editable,
                                                                    onChange: (value)=>updateBasicInfoRow(row.id, {
                                                                            value
                                                                        })
                                                                }, void 0, false, {
                                                                    fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                                    lineNumber: 2078,
                                                                    columnNumber: 61
                                                                }, this)
                                                            }, void 0, false, {
                                                                fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                                lineNumber: 2078,
                                                                columnNumber: 21
                                                            }, this)
                                                        ]
                                                    }, row.id, true, {
                                                        fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                        lineNumber: 2073,
                                                        columnNumber: 19
                                                    }, this))
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                            lineNumber: 2050,
                                            columnNumber: 15
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                    lineNumber: 2035,
                                    columnNumber: 13
                                }, this)
                            }, void 0, false, {
                                fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                lineNumber: 2034,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ jsxDEV("div", {
                                className: "flex items-center justify-between gap-2 border-t border-slate-200 px-4 py-3",
                                children: [
                                    /*#__PURE__*/ jsxDEV("h3", {
                                        className: "text-sm font-semibold text-slate-900",
                                        children: "Tehnične specifikacije"
                                    }, void 0, false, {
                                        fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                        lineNumber: 2086,
                                        columnNumber: 13
                                    }, this),
                                    /*#__PURE__*/ jsxDEV("div", {
                                        className: "flex items-center gap-2",
                                        children: [
                                            /*#__PURE__*/ jsxDEV(IconButton, {
                                                type: "button",
                                                tone: "neutral",
                                                className: adminTableNeutralIconButtonClassName,
                                                disabled: !editable,
                                                onClick: addSpec,
                                                "aria-label": "Dodaj specifikacijo",
                                                title: "Dodaj specifikacijo",
                                                children: /*#__PURE__*/ jsxDEV(PlusIcon, {}, void 0, false, {
                                                    fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                    lineNumber: 2088,
                                                    columnNumber: 205
                                                }, this)
                                            }, void 0, false, {
                                                fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                lineNumber: 2088,
                                                columnNumber: 15
                                            }, this),
                                            /*#__PURE__*/ jsxDEV(IconButton, {
                                                type: "button",
                                                tone: hasSelectedSpecs ? 'danger' : 'neutral',
                                                className: hasSelectedSpecs ? adminTableSelectedDangerIconButtonClassName : adminTableNeutralIconButtonClassName,
                                                disabled: !editable || !hasSelectedSpecs,
                                                onClick: removeSelectedSpecs,
                                                "aria-label": "Odstrani izbrane specifikacije",
                                                title: "Odstrani izbrane",
                                                children: /*#__PURE__*/ jsxDEV(TrashCanIcon, {}, void 0, false, {
                                                    fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                    lineNumber: 2098,
                                                    columnNumber: 17
                                                }, this)
                                            }, void 0, false, {
                                                fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                lineNumber: 2089,
                                                columnNumber: 15
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                        lineNumber: 2087,
                                        columnNumber: 13
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                lineNumber: 2085,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ jsxDEV("div", {
                                className: "overflow-hidden border-t border-slate-200",
                                children: /*#__PURE__*/ jsxDEV("table", {
                                    className: "w-full table-fixed text-[12px]",
                                    children: [
                                        /*#__PURE__*/ jsxDEV("colgroup", {
                                            children: [
                                                /*#__PURE__*/ jsxDEV("col", {
                                                    style: {
                                                        width: '32px'
                                                    }
                                                }, void 0, false, {
                                                    fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                    lineNumber: 2105,
                                                    columnNumber: 17
                                                }, this),
                                                /*#__PURE__*/ jsxDEV("col", {
                                                    style: {
                                                        width: narrowInfoLabelColumnWidth
                                                    }
                                                }, void 0, false, {
                                                    fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                    lineNumber: 2106,
                                                    columnNumber: 17
                                                }, this),
                                                /*#__PURE__*/ jsxDEV("col", {}, void 0, false, {
                                                    fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                    lineNumber: 2107,
                                                    columnNumber: 17
                                                }, this)
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                            lineNumber: 2104,
                                            columnNumber: 15
                                        }, this),
                                        /*#__PURE__*/ jsxDEV("thead", {
                                            className: "bg-[color:var(--admin-table-header-bg)]",
                                            children: /*#__PURE__*/ jsxDEV("tr", {
                                                children: [
                                                    /*#__PURE__*/ jsxDEV("th", {
                                                        className: "w-8 px-1 py-2 text-center",
                                                        children: /*#__PURE__*/ jsxDEV(AdminCheckbox, {
                                                            checked: editable && allSpecsSelected,
                                                            disabled: !editable || data.technicalSpecs.length === 0,
                                                            onChange: toggleAllSpecs
                                                        }, void 0, false, {
                                                            fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                            lineNumber: 2112,
                                                            columnNumber: 21
                                                        }, this)
                                                    }, void 0, false, {
                                                        fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                        lineNumber: 2111,
                                                        columnNumber: 19
                                                    }, this),
                                                    /*#__PURE__*/ jsxDEV("th", {
                                                        className: narrowInfoHeaderClassName,
                                                        children: "Lastnost"
                                                    }, void 0, false, {
                                                        fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                        lineNumber: 2114,
                                                        columnNumber: 19
                                                    }, this),
                                                    /*#__PURE__*/ jsxDEV("th", {
                                                        className: narrowInfoHeaderClassName,
                                                        children: "Vrednost"
                                                    }, void 0, false, {
                                                        fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                        lineNumber: 2115,
                                                        columnNumber: 19
                                                    }, this)
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                lineNumber: 2110,
                                                columnNumber: 17
                                            }, this)
                                        }, void 0, false, {
                                            fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                            lineNumber: 2109,
                                            columnNumber: 15
                                        }, this),
                                        /*#__PURE__*/ jsxDEV("tbody", {
                                            children: data.technicalSpecs.length > 0 ? data.technicalSpecs.map((spec)=>/*#__PURE__*/ jsxDEV("tr", {
                                                    className: "border-t border-slate-100",
                                                    children: [
                                                        /*#__PURE__*/ jsxDEV("td", {
                                                            className: "px-1 py-1.5 text-center",
                                                            children: editable ? /*#__PURE__*/ jsxDEV(AdminCheckbox, {
                                                                checked: selectedSpecIds.has(spec.id),
                                                                onChange: ()=>toggleSpecSelection(spec.id)
                                                            }, void 0, false, {
                                                                fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                                lineNumber: 2122,
                                                                columnNumber: 35
                                                            }, this) : /*#__PURE__*/ jsxDEV(DisabledSelectionCheckbox, {}, void 0, false, {
                                                                fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                                lineNumber: 2122,
                                                                columnNumber: 140
                                                            }, this)
                                                        }, void 0, false, {
                                                            fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                            lineNumber: 2121,
                                                            columnNumber: 21
                                                        }, this),
                                                        /*#__PURE__*/ jsxDEV("td", {
                                                            className: narrowInfoCellClassName,
                                                            children: editable ? /*#__PURE__*/ jsxDEV("input", {
                                                                className: compactInfoFieldFrameClassName,
                                                                value: spec.property,
                                                                onChange: (event)=>updateSpec(spec.id, {
                                                                        property: event.target.value
                                                                    })
                                                            }, void 0, false, {
                                                                fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                                lineNumber: 2124,
                                                                columnNumber: 73
                                                            }, this) : /*#__PURE__*/ jsxDEV(ReadOnlyCompactField, {
                                                                value: spec.property
                                                            }, void 0, false, {
                                                                fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                                lineNumber: 2124,
                                                                columnNumber: 226
                                                            }, this)
                                                        }, void 0, false, {
                                                            fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                            lineNumber: 2124,
                                                            columnNumber: 21
                                                        }, this),
                                                        /*#__PURE__*/ jsxDEV("td", {
                                                            className: narrowInfoCellClassName,
                                                            children: /*#__PURE__*/ jsxDEV(SpecValueField, {
                                                                value: spec.value,
                                                                compact: true,
                                                                editable: editable,
                                                                onChange: (value)=>updateSpec(spec.id, {
                                                                        value
                                                                    })
                                                            }, void 0, false, {
                                                                fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                                lineNumber: 2125,
                                                                columnNumber: 61
                                                            }, this)
                                                        }, void 0, false, {
                                                            fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                            lineNumber: 2125,
                                                            columnNumber: 21
                                                        }, this)
                                                    ]
                                                }, spec.id, true, {
                                                    fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                    lineNumber: 2120,
                                                    columnNumber: 19
                                                }, this)) : /*#__PURE__*/ jsxDEV("tr", {
                                                className: "border-t border-slate-100",
                                                children: /*#__PURE__*/ jsxDEV("td", {
                                                    colSpan: 3,
                                                    className: "px-3 py-4 text-[12px] font-medium text-slate-500",
                                                    children: "Ni dodanih tehničnih specifikacij."
                                                }, void 0, false, {
                                                    fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                    lineNumber: 2129,
                                                    columnNumber: 21
                                                }, this)
                                            }, void 0, false, {
                                                fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                lineNumber: 2128,
                                                columnNumber: 19
                                            }, this)
                                        }, void 0, false, {
                                            fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                            lineNumber: 2118,
                                            columnNumber: 15
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                    lineNumber: 2103,
                                    columnNumber: 13
                                }, this)
                            }, void 0, false, {
                                fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                lineNumber: 2102,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                        lineNumber: 2016,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                lineNumber: 2009,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
        lineNumber: 2004,
        columnNumber: 5
    }, this);
}
_s(SimpleProductModule, "zI9I1bSCOpAg/P69WMyanMO2klo=");
function WeightProductModule({ editable, data, baseSku, color, quantityDiscountsPanel, onChange }) {
    _s1();
    const [selectedIds, setSelectedIds] = (0, useState)(new Set());
    const [selectedFractionBasicInfoIds, setSelectedFractionBasicInfoIds] = (0, useState)(new Set());
    const update = (updates)=>onChange({
            ...data,
            ...updates
        });
    const updateVariant = (id, updates)=>update({
            variants: data.variants.map((variant)=>variant.id === id ? {
                    ...variant,
                    ...updates
                } : variant)
        });
    const fractionPricingRows = data.fractionPricing.length > 0 ? data.fractionPricing.slice().sort((left, right)=>left.position - right.position) : [
        createFallbackWeightFractionPricing(data)
    ];
    const selectedFractionPricing = getWeightFractionPricing({
        ...data,
        fractionPricing: fractionPricingRows
    }, data.fraction);
    const selectedFractionBasicInfoRows = selectedFractionPricing.basicInfoRows ?? [];
    const allFractionBasicInfoSelected = selectedFractionBasicInfoRows.length > 0 && selectedFractionBasicInfoRows.every((row)=>selectedFractionBasicInfoIds.has(row.id));
    const hasSelectedFractionBasicInfo = selectedFractionBasicInfoRows.some((row)=>selectedFractionBasicInfoIds.has(row.id));
    const selectFractionPricing = (fraction)=>{
        const pricing = getWeightFractionPricing({
            ...data,
            fractionPricing: fractionPricingRows
        }, fraction);
        update({
            fraction: pricing.fraction,
            pricePerKg: pricing.pricePerKg,
            packagingCostPerBag: pricing.packagingCostPerBag,
            fractionPricing: fractionPricingRows
        });
    };
    const renameFractionPricing = (row, value)=>{
        const nextFraction = normalizeWeightFractionValue(value);
        if (!nextFraction) return;
        const oldKey = createWeightFractionKey(row.fraction);
        const nextKey = createWeightFractionKey(nextFraction);
        const duplicate = fractionPricingRows.some((entry)=>entry.id !== row.id && createWeightFractionKey(entry.fraction) === nextKey);
        if (duplicate) return;
        const isActiveFraction = createWeightFractionKey(data.fraction) === oldKey;
        update({
            fraction: isActiveFraction ? nextFraction : data.fraction,
            fractionPricing: fractionPricingRows.map((entry)=>entry.id === row.id ? {
                    ...entry,
                    fraction: nextFraction
                } : entry),
            materialStocks: data.materialStocks.map((entry)=>createWeightFractionKey(entry.fraction) === oldKey ? {
                    ...entry,
                    fraction: nextFraction
                } : entry),
            variants: data.variants.map((variant)=>createWeightFractionKey(variant.fraction || data.fraction) === oldKey ? {
                    ...variant,
                    fraction: nextFraction
                } : variant)
        });
    };
    const updateSelectedFractionBasicInfoRows = (basicInfoRows)=>{
        const selectedKey = createWeightFractionKey(selectedFractionPricing.fraction);
        const nextRows = fractionPricingRows.some((row)=>createWeightFractionKey(row.fraction) === selectedKey) ? fractionPricingRows.map((row)=>createWeightFractionKey(row.fraction) === selectedKey ? {
                ...row,
                basicInfoRows
            } : row) : [
            ...fractionPricingRows,
            {
                ...selectedFractionPricing,
                basicInfoRows,
                position: fractionPricingRows.length + 1
            }
        ];
        update({
            fractionPricing: nextRows
        });
    };
    const addSelectedFractionBasicInfoRow = ()=>updateSelectedFractionBasicInfoRows([
            ...selectedFractionBasicInfoRows,
            {
                id: createLocalId('weight-fraction-basic-info'),
                property: '',
                value: ''
            }
        ]);
    const updateSelectedFractionBasicInfoRow = (id, updates)=>updateSelectedFractionBasicInfoRows(selectedFractionBasicInfoRows.map((row)=>row.id === id ? {
                ...row,
                ...updates
            } : row));
    const toggleFractionBasicInfoSelection = (id)=>{
        setSelectedFractionBasicInfoIds((current)=>{
            const next = new Set(current);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };
    const toggleAllFractionBasicInfo = ()=>{
        setSelectedFractionBasicInfoIds(allFractionBasicInfoSelected ? new Set() : new Set(selectedFractionBasicInfoRows.map((row)=>row.id)));
    };
    const removeSelectedFractionBasicInfoRows = ()=>{
        if (!hasSelectedFractionBasicInfo) return;
        updateSelectedFractionBasicInfoRows(selectedFractionBasicInfoRows.filter((row)=>!selectedFractionBasicInfoIds.has(row.id)));
        setSelectedFractionBasicInfoIds(new Set());
    };
    const addFractionPricing = ()=>{
        let fraction = '';
        for(let index = 0; index < 100; index += 1){
            const candidate = `${index * 2}-${index * 2 + 2} mm`;
            if (!fractionPricingRows.some((row)=>createWeightFractionKey(row.fraction) === createWeightFractionKey(candidate))) {
                fraction = candidate;
                break;
            }
        }
        if (!fraction) fraction = `Nova frakcija ${fractionPricingRows.length + 1} mm`;
        const nextRow = {
            id: `fraction-pricing-${weightSkuPart(fraction) || fractionPricingRows.length + 1}`,
            fraction,
            pricePerKg: selectedFractionPricing.pricePerKg,
            packagingCostPerBag: selectedFractionPricing.packagingCostPerBag,
            basicInfoRows: [],
            position: fractionPricingRows.length + 1
        };
        update({
            fraction,
            pricePerKg: nextRow.pricePerKg,
            packagingCostPerBag: nextRow.packagingCostPerBag,
            fractionPricing: [
                ...fractionPricingRows,
                nextRow
            ]
        });
    };
    const removeFractionPricing = (row)=>{
        if (!editable || fractionPricingRows.length <= 1) return;
        const removeKey = createWeightFractionKey(row.fraction);
        const nextRows = fractionPricingRows.filter((entry)=>createWeightFractionKey(entry.fraction) !== removeKey).map((entry, index)=>({
                ...entry,
                position: index + 1
            }));
        const activeKey = createWeightFractionKey(data.fraction);
        const nextSelected = createWeightFractionKey(row.fraction) === activeKey ? nextRows[0] ?? createFallbackWeightFractionPricing(data) : selectedFractionPricing;
        update({
            fraction: nextSelected.fraction,
            pricePerKg: nextSelected.pricePerKg,
            packagingCostPerBag: nextSelected.packagingCostPerBag,
            fractionPricing: nextRows
        });
    };
    const generateVariants = ()=>{
        const variants = createWeightVariantsFromChips(data, baseSku, color);
        update({
            variants,
            materialStocks: createWeightMaterialStocksFromVariants(variants, data, color)
        });
    };
    const visibleVariants = data.variants.filter((variant)=>variant.netMassKg !== null);
    const selectedAll = visibleVariants.length > 0 && visibleVariants.every((variant)=>selectedIds.has(variant.id));
    const materialStockRowsByKey = new Map();
    data.materialStocks.forEach((row)=>{
        materialStockRowsByKey.set(createWeightMaterialStockKey(row.fraction, row.color), row);
    });
    createWeightMaterialStocksFromVariants(visibleVariants, data, color).forEach((row)=>{
        const key = createWeightMaterialStockKey(row.fraction, row.color);
        if (!materialStockRowsByKey.has(key)) materialStockRowsByKey.set(key, row);
    });
    const materialStockRows = Array.from(materialStockRowsByKey.values()).sort((left, right)=>left.position - right.position);
    const getFractionMaterialStockSummary = (fraction)=>{
        const fractionKey = createWeightFractionKey(fraction);
        const rows = materialStockRows.filter((row)=>createWeightFractionKey(row.fraction) === fractionKey);
        const stockKg = rows.reduce((total, row)=>total + row.stockKg, 0);
        const reservedKg = rows.reduce((total, row)=>total + row.reservedKg, 0);
        return {
            rows,
            stockKg,
            reservedKg,
            availableKg: Math.max(0, stockKg - reservedKg),
            deliveryTime: rows[0]?.deliveryTime ?? data.deliveryTime
        };
    };
    const updateFractionMaterialStock = (fraction, updates)=>{
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
        const nextRow = {
            ...firstRow,
            fraction,
            color: '—',
            stockKg: Math.max(0, updates.stockKg ?? current.stockKg),
            reservedKg: Math.max(0, updates.reservedKg ?? current.reservedKg),
            deliveryTime: updates.deliveryTime ?? current.deliveryTime
        };
        const retainedRows = materialStockRows.filter((row)=>createWeightFractionKey(row.fraction) !== fractionKey);
        const nextMaterialStocks = [
            ...retainedRows,
            nextRow
        ].sort((left, right)=>left.position - right.position).map((row, index)=>({
                ...row,
                position: index + 1
            }));
        update({
            materialStocks: nextMaterialStocks,
            variants: data.variants.map((variant)=>{
                if (createWeightFractionKey(variant.fraction || data.fraction || '—') !== fractionKey) return variant;
                return {
                    ...variant,
                    ...updates.stockKg !== undefined ? {
                        stockKg: Math.max(0, updates.stockKg)
                    } : {},
                    ...updates.deliveryTime !== undefined ? {
                        deliveryTime: updates.deliveryTime
                    } : {}
                };
            })
        });
    };
    const deleteSelected = ()=>{
        if (!editable || selectedIds.size === 0) return;
        update({
            variants: data.variants.filter((variant)=>!selectedIds.has(variant.id)).map((variant, index)=>({
                    ...variant,
                    position: index + 1
                }))
        });
        setSelectedIds(new Set());
    };
    const selectedFractionStock = getFractionMaterialStockSummary(selectedFractionPricing.fraction);
    const selectedFractionBasicInfoIdsKey = selectedFractionBasicInfoRows.map((row)=>row.id).join('|');
    (0, useEffect)({
        "WeightProductModule.useEffect": ()=>{
            const validIds = new Set(selectedFractionBasicInfoIdsKey ? selectedFractionBasicInfoIdsKey.split('|') : []);
            setSelectedFractionBasicInfoIds({
                "WeightProductModule.useEffect": (current)=>{
                    const next = new Set(Array.from(current).filter({
                        "WeightProductModule.useEffect": (id)=>validIds.has(id)
                    }["WeightProductModule.useEffect"]));
                    return next.size === current.size ? current : next;
                }
            }["WeightProductModule.useEffect"]);
        }
    }["WeightProductModule.useEffect"], [
        selectedFractionBasicInfoIdsKey
    ]);
    return /*#__PURE__*/ jsxDEV("section", {
        className: `${adminWindowCardClassName} px-5 pb-5 pt-5`,
        style: adminWindowCardStyle,
        children: [
            /*#__PURE__*/ jsxDEV("div", {
                className: "mb-3",
                children: /*#__PURE__*/ jsxDEV("h2", {
                    className: sectionTitleClassName,
                    children: "Prodajne informacije"
                }, void 0, false, {
                    fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                    lineNumber: 2355,
                    columnNumber: 9
                }, this)
            }, void 0, false, {
                fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                lineNumber: 2354,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ jsxDEV("div", {
                className: "mb-3 text-[12px] font-normal leading-5 text-slate-600",
                children: /*#__PURE__*/ jsxDEV("p", {
                    children: [
                        "Vsaka frakcija ima svojo zalogo in dobavni rok.",
                        /*#__PURE__*/ jsxDEV("br", {}, void 0, false, {
                            fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                            lineNumber: 2361,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ jsxDEV("span", {
                            className: `${inlineSnippetClassName} !font-normal`,
                            children: "Cena različice se ureja neposredno v tabeli, količinski popusti pa se obračunajo ločeno."
                        }, void 0, false, {
                            fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                            lineNumber: 2362,
                            columnNumber: 11
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                    lineNumber: 2359,
                    columnNumber: 9
                }, this)
            }, void 0, false, {
                fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                lineNumber: 2358,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ jsxDEV("div", {
                className: classNames('mb-5 grid items-stretch gap-4', quantityDiscountsPanel ? 'xl:grid-cols-[minmax(0,7fr)_minmax(0,3fr)]' : 'xl:grid-cols-1'),
                children: [
                    quantityDiscountsPanel ? /*#__PURE__*/ jsxDEV("div", {
                        className: "h-full overflow-hidden rounded-lg border border-slate-200 bg-white",
                        children: quantityDiscountsPanel
                    }, void 0, false, {
                        fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                        lineNumber: 2368,
                        columnNumber: 11
                    }, this) : null,
                    /*#__PURE__*/ jsxDEV("section", {
                        className: "overflow-hidden rounded-lg border border-slate-200 bg-white",
                        children: [
                            /*#__PURE__*/ jsxDEV("div", {
                                className: "flex flex-wrap items-start justify-between gap-3 px-4 py-3",
                                children: [
                                    /*#__PURE__*/ jsxDEV("div", {
                                        className: "flex min-w-0 flex-wrap items-center gap-2",
                                        children: [
                                            /*#__PURE__*/ jsxDEV("span", {
                                                className: "shrink-0 text-[12px] font-semibold text-slate-700",
                                                children: "Frakcija"
                                            }, void 0, false, {
                                                fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                lineNumber: 2375,
                                                columnNumber: 15
                                            }, this),
                                            /*#__PURE__*/ jsxDEV(WeightFractionEditorSelect, {
                                                value: selectedFractionPricing.fraction,
                                                rows: fractionPricingRows,
                                                editable: editable,
                                                onSelect: selectFractionPricing,
                                                onRename: renameFractionPricing,
                                                onDelete: removeFractionPricing,
                                                onAdd: addFractionPricing
                                            }, void 0, false, {
                                                fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                lineNumber: 2376,
                                                columnNumber: 15
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                        lineNumber: 2374,
                                        columnNumber: 13
                                    }, this),
                                    /*#__PURE__*/ jsxDEV("div", {
                                        className: "flex items-center gap-2",
                                        children: [
                                            /*#__PURE__*/ jsxDEV(IconButton, {
                                                type: "button",
                                                tone: "neutral",
                                                className: adminTableNeutralIconButtonClassName,
                                                disabled: !editable,
                                                onClick: addSelectedFractionBasicInfoRow,
                                                "aria-label": "Dodaj osnovno informacijo",
                                                title: "Dodaj osnovno informacijo",
                                                children: /*#__PURE__*/ jsxDEV(PlusIcon, {}, void 0, false, {
                                                    fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                    lineNumber: 2396,
                                                    columnNumber: 17
                                                }, this)
                                            }, void 0, false, {
                                                fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                lineNumber: 2387,
                                                columnNumber: 15
                                            }, this),
                                            /*#__PURE__*/ jsxDEV(IconButton, {
                                                type: "button",
                                                tone: hasSelectedFractionBasicInfo ? 'danger' : 'neutral',
                                                className: hasSelectedFractionBasicInfo ? adminTableSelectedDangerIconButtonClassName : adminTableNeutralIconButtonClassName,
                                                disabled: !editable || !hasSelectedFractionBasicInfo,
                                                onClick: removeSelectedFractionBasicInfoRows,
                                                "aria-label": "Odstrani izbrane osnovne informacije",
                                                title: "Odstrani izbrane",
                                                children: /*#__PURE__*/ jsxDEV(TrashCanIcon, {}, void 0, false, {
                                                    fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                    lineNumber: 2407,
                                                    columnNumber: 17
                                                }, this)
                                            }, void 0, false, {
                                                fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                lineNumber: 2398,
                                                columnNumber: 15
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                        lineNumber: 2386,
                                        columnNumber: 13
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                lineNumber: 2373,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ jsxDEV("div", {
                                className: "overflow-hidden border-t border-slate-200",
                                children: /*#__PURE__*/ jsxDEV("table", {
                                    className: "w-full table-fixed text-[12px]",
                                    children: [
                                        /*#__PURE__*/ jsxDEV("colgroup", {
                                            children: [
                                                /*#__PURE__*/ jsxDEV("col", {
                                                    style: {
                                                        width: '32px'
                                                    }
                                                }, void 0, false, {
                                                    fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                    lineNumber: 2414,
                                                    columnNumber: 17
                                                }, this),
                                                /*#__PURE__*/ jsxDEV("col", {
                                                    style: {
                                                        width: narrowInfoLabelColumnWidth
                                                    }
                                                }, void 0, false, {
                                                    fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                    lineNumber: 2415,
                                                    columnNumber: 17
                                                }, this),
                                                /*#__PURE__*/ jsxDEV("col", {}, void 0, false, {
                                                    fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                    lineNumber: 2416,
                                                    columnNumber: 17
                                                }, this)
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                            lineNumber: 2413,
                                            columnNumber: 15
                                        }, this),
                                        /*#__PURE__*/ jsxDEV("thead", {
                                            className: "bg-[color:var(--admin-table-header-bg)]",
                                            children: /*#__PURE__*/ jsxDEV("tr", {
                                                children: [
                                                    /*#__PURE__*/ jsxDEV("th", {
                                                        className: "w-8 px-1 py-2 text-center",
                                                        children: /*#__PURE__*/ jsxDEV(AdminCheckbox, {
                                                            checked: editable && allFractionBasicInfoSelected,
                                                            disabled: !editable || selectedFractionBasicInfoRows.length === 0,
                                                            onChange: toggleAllFractionBasicInfo
                                                        }, void 0, false, {
                                                            fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                            lineNumber: 2421,
                                                            columnNumber: 21
                                                        }, this)
                                                    }, void 0, false, {
                                                        fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                        lineNumber: 2420,
                                                        columnNumber: 19
                                                    }, this),
                                                    /*#__PURE__*/ jsxDEV("th", {
                                                        className: narrowInfoHeaderClassName,
                                                        children: "Lastnost"
                                                    }, void 0, false, {
                                                        fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                        lineNumber: 2423,
                                                        columnNumber: 19
                                                    }, this),
                                                    /*#__PURE__*/ jsxDEV("th", {
                                                        className: narrowInfoHeaderClassName,
                                                        children: "Vrednost"
                                                    }, void 0, false, {
                                                        fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                        lineNumber: 2424,
                                                        columnNumber: 19
                                                    }, this)
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                lineNumber: 2419,
                                                columnNumber: 17
                                            }, this)
                                        }, void 0, false, {
                                            fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                            lineNumber: 2418,
                                            columnNumber: 15
                                        }, this),
                                        /*#__PURE__*/ jsxDEV("tbody", {
                                            children: [
                                                /*#__PURE__*/ jsxDEV("tr", {
                                                    className: "border-t border-slate-100",
                                                    children: [
                                                        /*#__PURE__*/ jsxDEV("td", {
                                                            className: "px-1 py-1.5 text-center",
                                                            "aria-hidden": "true",
                                                            children: /*#__PURE__*/ jsxDEV(DisabledSelectionCheckbox, {}, void 0, false, {
                                                                fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                                lineNumber: 2429,
                                                                columnNumber: 78
                                                            }, this)
                                                        }, void 0, false, {
                                                            fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                            lineNumber: 2429,
                                                            columnNumber: 19
                                                        }, this),
                                                        /*#__PURE__*/ jsxDEV("td", {
                                                            className: narrowInfoCellClassName,
                                                            children: "Zaloga"
                                                        }, void 0, false, {
                                                            fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                            lineNumber: 2430,
                                                            columnNumber: 19
                                                        }, this),
                                                        /*#__PURE__*/ jsxDEV("td", {
                                                            className: narrowInfoCellClassName,
                                                            children: /*#__PURE__*/ jsxDEV(NumberField, {
                                                                label: "",
                                                                value: selectedFractionStock.stockKg,
                                                                suffix: "kg",
                                                                compact: true,
                                                                editable: editable,
                                                                onChange: (value)=>updateFractionMaterialStock(selectedFractionPricing.fraction, {
                                                                        stockKg: value
                                                                    })
                                                            }, void 0, false, {
                                                                fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                                lineNumber: 2432,
                                                                columnNumber: 21
                                                            }, this)
                                                        }, void 0, false, {
                                                            fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                            lineNumber: 2431,
                                                            columnNumber: 19
                                                        }, this)
                                                    ]
                                                }, void 0, true, {
                                                    fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                    lineNumber: 2428,
                                                    columnNumber: 17
                                                }, this),
                                                /*#__PURE__*/ jsxDEV("tr", {
                                                    className: "border-t border-slate-100",
                                                    children: [
                                                        /*#__PURE__*/ jsxDEV("td", {
                                                            className: "px-1 py-1.5 text-center",
                                                            "aria-hidden": "true",
                                                            children: /*#__PURE__*/ jsxDEV(DisabledSelectionCheckbox, {}, void 0, false, {
                                                                fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                                lineNumber: 2443,
                                                                columnNumber: 78
                                                            }, this)
                                                        }, void 0, false, {
                                                            fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                            lineNumber: 2443,
                                                            columnNumber: 19
                                                        }, this),
                                                        /*#__PURE__*/ jsxDEV("td", {
                                                            className: narrowInfoCellClassName,
                                                            children: "Rezervirano"
                                                        }, void 0, false, {
                                                            fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                            lineNumber: 2444,
                                                            columnNumber: 19
                                                        }, this),
                                                        /*#__PURE__*/ jsxDEV("td", {
                                                            className: narrowInfoCellClassName,
                                                            children: /*#__PURE__*/ jsxDEV(NumberField, {
                                                                label: "",
                                                                value: selectedFractionStock.reservedKg,
                                                                suffix: "kg",
                                                                compact: true,
                                                                editable: editable,
                                                                onChange: (value)=>updateFractionMaterialStock(selectedFractionPricing.fraction, {
                                                                        reservedKg: value
                                                                    })
                                                            }, void 0, false, {
                                                                fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                                lineNumber: 2446,
                                                                columnNumber: 21
                                                            }, this)
                                                        }, void 0, false, {
                                                            fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                            lineNumber: 2445,
                                                            columnNumber: 19
                                                        }, this)
                                                    ]
                                                }, void 0, true, {
                                                    fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                    lineNumber: 2442,
                                                    columnNumber: 17
                                                }, this),
                                                /*#__PURE__*/ jsxDEV("tr", {
                                                    className: "border-t border-slate-100",
                                                    children: [
                                                        /*#__PURE__*/ jsxDEV("td", {
                                                            className: "px-1 py-1.5 text-center",
                                                            "aria-hidden": "true",
                                                            children: /*#__PURE__*/ jsxDEV(DisabledSelectionCheckbox, {}, void 0, false, {
                                                                fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                                lineNumber: 2457,
                                                                columnNumber: 78
                                                            }, this)
                                                        }, void 0, false, {
                                                            fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                            lineNumber: 2457,
                                                            columnNumber: 19
                                                        }, this),
                                                        /*#__PURE__*/ jsxDEV("td", {
                                                            className: narrowInfoCellClassName,
                                                            children: "Razpoložljivo"
                                                        }, void 0, false, {
                                                            fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                            lineNumber: 2458,
                                                            columnNumber: 19
                                                        }, this),
                                                        /*#__PURE__*/ jsxDEV("td", {
                                                            className: narrowInfoCellClassName,
                                                            children: /*#__PURE__*/ jsxDEV(NumberField, {
                                                                label: "",
                                                                value: selectedFractionStock.availableKg,
                                                                suffix: "kg",
                                                                compact: true,
                                                                editable: false,
                                                                onChange: ()=>undefined
                                                            }, void 0, false, {
                                                                fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                                lineNumber: 2460,
                                                                columnNumber: 21
                                                            }, this)
                                                        }, void 0, false, {
                                                            fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                            lineNumber: 2459,
                                                            columnNumber: 19
                                                        }, this)
                                                    ]
                                                }, void 0, true, {
                                                    fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                    lineNumber: 2456,
                                                    columnNumber: 17
                                                }, this),
                                                /*#__PURE__*/ jsxDEV("tr", {
                                                    className: "border-t border-slate-100",
                                                    children: [
                                                        /*#__PURE__*/ jsxDEV("td", {
                                                            className: "px-1 py-1.5 text-center",
                                                            "aria-hidden": "true",
                                                            children: /*#__PURE__*/ jsxDEV(DisabledSelectionCheckbox, {}, void 0, false, {
                                                                fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                                lineNumber: 2471,
                                                                columnNumber: 78
                                                            }, this)
                                                        }, void 0, false, {
                                                            fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                            lineNumber: 2471,
                                                            columnNumber: 19
                                                        }, this),
                                                        /*#__PURE__*/ jsxDEV("td", {
                                                            className: narrowInfoCellClassName,
                                                            children: "Dobavni rok"
                                                        }, void 0, false, {
                                                            fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                            lineNumber: 2472,
                                                            columnNumber: 19
                                                        }, this),
                                                        /*#__PURE__*/ jsxDEV("td", {
                                                            className: narrowInfoCellClassName,
                                                            children: /*#__PURE__*/ jsxDEV(QuantityRangeUnitField, {
                                                                value: selectedFractionStock.deliveryTime,
                                                                unitKind: "workday",
                                                                compact: true,
                                                                editable: editable,
                                                                onChange: (value)=>updateFractionMaterialStock(selectedFractionPricing.fraction, {
                                                                        deliveryTime: formatQuantityRangeWithUnit(value, 'workday')
                                                                    })
                                                            }, void 0, false, {
                                                                fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                                lineNumber: 2474,
                                                                columnNumber: 21
                                                            }, this)
                                                        }, void 0, false, {
                                                            fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                            lineNumber: 2473,
                                                            columnNumber: 19
                                                        }, this)
                                                    ]
                                                }, void 0, true, {
                                                    fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                    lineNumber: 2470,
                                                    columnNumber: 17
                                                }, this),
                                                selectedFractionBasicInfoRows.map((row)=>/*#__PURE__*/ jsxDEV("tr", {
                                                        className: "border-t border-slate-100",
                                                        children: [
                                                            /*#__PURE__*/ jsxDEV("td", {
                                                                className: "px-1 py-1.5 text-center",
                                                                children: editable ? /*#__PURE__*/ jsxDEV(AdminCheckbox, {
                                                                    checked: selectedFractionBasicInfoIds.has(row.id),
                                                                    onChange: ()=>toggleFractionBasicInfoSelection(row.id)
                                                                }, void 0, false, {
                                                                    fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                                    lineNumber: 2486,
                                                                    columnNumber: 35
                                                                }, this) : /*#__PURE__*/ jsxDEV(DisabledSelectionCheckbox, {}, void 0, false, {
                                                                    fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                                    lineNumber: 2486,
                                                                    columnNumber: 164
                                                                }, this)
                                                            }, void 0, false, {
                                                                fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                                lineNumber: 2485,
                                                                columnNumber: 21
                                                            }, this),
                                                            /*#__PURE__*/ jsxDEV("td", {
                                                                className: narrowInfoCellClassName,
                                                                children: editable ? /*#__PURE__*/ jsxDEV("input", {
                                                                    className: compactInfoFieldFrameClassName,
                                                                    value: row.property,
                                                                    onChange: (event)=>updateSelectedFractionBasicInfoRow(row.id, {
                                                                            property: event.target.value
                                                                        })
                                                                }, void 0, false, {
                                                                    fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                                    lineNumber: 2488,
                                                                    columnNumber: 73
                                                                }, this) : /*#__PURE__*/ jsxDEV(ReadOnlyCompactField, {
                                                                    value: row.property
                                                                }, void 0, false, {
                                                                    fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                                    lineNumber: 2488,
                                                                    columnNumber: 248
                                                                }, this)
                                                            }, void 0, false, {
                                                                fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                                lineNumber: 2488,
                                                                columnNumber: 21
                                                            }, this),
                                                            /*#__PURE__*/ jsxDEV("td", {
                                                                className: narrowInfoCellClassName,
                                                                children: /*#__PURE__*/ jsxDEV(SpecValueField, {
                                                                    value: row.value,
                                                                    compact: true,
                                                                    editable: editable,
                                                                    onChange: (value)=>updateSelectedFractionBasicInfoRow(row.id, {
                                                                            value
                                                                        })
                                                                }, void 0, false, {
                                                                    fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                                    lineNumber: 2489,
                                                                    columnNumber: 61
                                                                }, this)
                                                            }, void 0, false, {
                                                                fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                                lineNumber: 2489,
                                                                columnNumber: 21
                                                            }, this)
                                                        ]
                                                    }, row.id, true, {
                                                        fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                        lineNumber: 2484,
                                                        columnNumber: 19
                                                    }, this))
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                            lineNumber: 2427,
                                            columnNumber: 15
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                    lineNumber: 2412,
                                    columnNumber: 13
                                }, this)
                            }, void 0, false, {
                                fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                lineNumber: 2411,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                        lineNumber: 2372,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                lineNumber: 2366,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ jsxDEV("div", {
                className: "mb-3 space-y-2",
                children: [
                    /*#__PURE__*/ jsxDEV("h3", {
                        className: "text-sm font-semibold text-slate-900",
                        children: "Kombinacije"
                    }, void 0, false, {
                        fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                        lineNumber: 2499,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ jsxDEV("p", {
                        className: "text-xs text-slate-500",
                        children: [
                            "Vnesi skupine za frakcijo, barvo in maso posebej, na primer: ",
                            /*#__PURE__*/ jsxDEV("span", {
                                className: inlineSnippetClassName,
                                children: "frakcija:0-2;4"
                            }, void 0, false, {
                                fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                lineNumber: 2501,
                                columnNumber: 72
                            }, this),
                            ", ",
                            /*#__PURE__*/ jsxDEV("span", {
                                className: inlineSnippetClassName,
                                children: "barva:bela"
                            }, void 0, false, {
                                fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                lineNumber: 2501,
                                columnNumber: 136
                            }, this),
                            ", ",
                            /*#__PURE__*/ jsxDEV("span", {
                                className: inlineSnippetClassName,
                                children: "kg:0,5;1;2"
                            }, void 0, false, {
                                fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                lineNumber: 2501,
                                columnNumber: 196
                            }, this),
                            ". Frakcija lahko vsebuje razpon ali posamezno število; več vrednosti loči s podpičjem. Ob generiranju se iz vseh vnesenih skupin ustvarijo kombinacije v tabeli."
                        ]
                    }, void 0, true, {
                        fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                        lineNumber: 2500,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ jsxDEV("div", {
                        className: "flex flex-wrap items-center justify-between gap-3",
                        children: [
                            /*#__PURE__*/ jsxDEV("p", {
                                className: "whitespace-nowrap text-xs leading-5 text-slate-700",
                                children: [
                                    /*#__PURE__*/ jsxDEV("span", {
                                        className: "font-semibold",
                                        children: "Možni vnosi:"
                                    }, void 0, false, {
                                        fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                        lineNumber: 2505,
                                        columnNumber: 13
                                    }, this),
                                    ' ',
                                    /*#__PURE__*/ jsxDEV("span", {
                                        className: `${inlineSnippetClassName} !font-normal`,
                                        children: "frakcija:"
                                    }, void 0, false, {
                                        fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                        lineNumber: 2506,
                                        columnNumber: 13
                                    }, this),
                                    " (",
                                    /*#__PURE__*/ jsxDEV("span", {
                                        className: `${inlineSnippetClassName} !font-normal`,
                                        children: "fr:"
                                    }, void 0, false, {
                                        fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                        lineNumber: 2506,
                                        columnNumber: 90
                                    }, this),
                                    "), ",
                                    /*#__PURE__*/ jsxDEV("span", {
                                        className: `${inlineSnippetClassName} !font-normal`,
                                        children: "barva:"
                                    }, void 0, false, {
                                        fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                        lineNumber: 2506,
                                        columnNumber: 162
                                    }, this),
                                    ", ",
                                    /*#__PURE__*/ jsxDEV("span", {
                                        className: `${inlineSnippetClassName} !font-normal`,
                                        children: "kg:"
                                    }, void 0, false, {
                                        fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                        lineNumber: 2506,
                                        columnNumber: 236
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                lineNumber: 2504,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ jsxDEV("div", {
                                className: "ml-auto flex items-center gap-2",
                                children: [
                                    /*#__PURE__*/ jsxDEV(IconButton, {
                                        type: "button",
                                        tone: "neutral",
                                        className: adminTableNeutralIconButtonClassName,
                                        disabled: !editable,
                                        onClick: ()=>update({
                                                packagingChips: normalizeWeightChipList([
                                                    ...data.packagingChips,
                                                    'kg:1'
                                                ])
                                            }),
                                        "aria-label": "Dodaj maso",
                                        title: "Dodaj maso",
                                        children: /*#__PURE__*/ jsxDEV(PlusIcon, {}, void 0, false, {
                                            fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                            lineNumber: 2509,
                                            columnNumber: 269
                                        }, this)
                                    }, void 0, false, {
                                        fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                        lineNumber: 2509,
                                        columnNumber: 13
                                    }, this),
                                    /*#__PURE__*/ jsxDEV(IconButton, {
                                        type: "button",
                                        tone: "neutral",
                                        className: adminTableNeutralIconButtonClassName,
                                        disabled: !editable || selectedIds.size === 0,
                                        onClick: deleteSelected,
                                        "aria-label": "Odstrani izbrane različice",
                                        title: "Odstrani",
                                        children: /*#__PURE__*/ jsxDEV(TrashCanIcon, {}, void 0, false, {
                                            fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                            lineNumber: 2510,
                                            columnNumber: 232
                                        }, this)
                                    }, void 0, false, {
                                        fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                        lineNumber: 2510,
                                        columnNumber: 13
                                    }, this),
                                    /*#__PURE__*/ jsxDEV(Button, {
                                        type: "button",
                                        variant: "primary",
                                        size: "toolbar",
                                        disabled: !editable,
                                        onClick: generateVariants,
                                        className: adminTablePrimaryButtonClassName,
                                        children: "Generiraj različice"
                                    }, void 0, false, {
                                        fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                        lineNumber: 2511,
                                        columnNumber: 13
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                lineNumber: 2508,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                        lineNumber: 2503,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                lineNumber: 2498,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ jsxDEV("div", {
                className: "mb-4",
                children: /*#__PURE__*/ jsxDEV(ChipInputGroup, {
                    label: "",
                    chips: data.packagingChips,
                    editable: editable,
                    placeholder: "npr. fr:0-2;4, barva:bela, kg:0,5;1;2",
                    onChange: (chips)=>update({
                            packagingChips: normalizeWeightChipList(chips)
                        })
                }, void 0, false, {
                    fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                    lineNumber: 2526,
                    columnNumber: 9
                }, this)
            }, void 0, false, {
                fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                lineNumber: 2525,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ jsxDEV("section", {
                className: "overflow-hidden rounded-lg border border-slate-200",
                children: [
                    /*#__PURE__*/ jsxDEV("h3", {
                        className: "border-b border-slate-200 px-3 py-2 text-sm font-semibold text-slate-900",
                        children: "Različice"
                    }, void 0, false, {
                        fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                        lineNumber: 2536,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ jsxDEV("div", {
                        className: "overflow-x-auto",
                        children: /*#__PURE__*/ jsxDEV("table", {
                            className: "min-w-full table-fixed text-[11px] leading-4",
                            children: [
                                /*#__PURE__*/ jsxDEV("colgroup", {
                                    children: [
                                        /*#__PURE__*/ jsxDEV("col", {
                                            style: {
                                                width: '2.2%'
                                            }
                                        }, void 0, false, {
                                            fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                            lineNumber: 2540,
                                            columnNumber: 15
                                        }, this),
                                        /*#__PURE__*/ jsxDEV("col", {
                                            style: {
                                                width: '7%'
                                            }
                                        }, void 0, false, {
                                            fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                            lineNumber: 2541,
                                            columnNumber: 15
                                        }, this),
                                        /*#__PURE__*/ jsxDEV("col", {
                                            style: {
                                                width: '7%'
                                            }
                                        }, void 0, false, {
                                            fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                            lineNumber: 2542,
                                            columnNumber: 15
                                        }, this),
                                        /*#__PURE__*/ jsxDEV("col", {
                                            style: {
                                                width: '7%'
                                            }
                                        }, void 0, false, {
                                            fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                            lineNumber: 2543,
                                            columnNumber: 15
                                        }, this),
                                        /*#__PURE__*/ jsxDEV("col", {
                                            style: {
                                                width: '8%'
                                            }
                                        }, void 0, false, {
                                            fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                            lineNumber: 2544,
                                            columnNumber: 15
                                        }, this),
                                        /*#__PURE__*/ jsxDEV("col", {
                                            style: {
                                                width: '7%'
                                            }
                                        }, void 0, false, {
                                            fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                            lineNumber: 2545,
                                            columnNumber: 15
                                        }, this),
                                        /*#__PURE__*/ jsxDEV("col", {
                                            style: {
                                                width: '9%'
                                            }
                                        }, void 0, false, {
                                            fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                            lineNumber: 2546,
                                            columnNumber: 15
                                        }, this),
                                        /*#__PURE__*/ jsxDEV("col", {
                                            style: {
                                                width: '9%'
                                            }
                                        }, void 0, false, {
                                            fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                            lineNumber: 2547,
                                            columnNumber: 15
                                        }, this),
                                        /*#__PURE__*/ jsxDEV("col", {
                                            style: {
                                                width: '22%'
                                            }
                                        }, void 0, false, {
                                            fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                            lineNumber: 2548,
                                            columnNumber: 15
                                        }, this),
                                        /*#__PURE__*/ jsxDEV("col", {
                                            style: {
                                                width: '7%'
                                            }
                                        }, void 0, false, {
                                            fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                            lineNumber: 2549,
                                            columnNumber: 15
                                        }, this),
                                        /*#__PURE__*/ jsxDEV("col", {
                                            style: {
                                                width: '7%'
                                            }
                                        }, void 0, false, {
                                            fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                            lineNumber: 2550,
                                            columnNumber: 15
                                        }, this),
                                        /*#__PURE__*/ jsxDEV("col", {
                                            style: {
                                                width: '4%'
                                            }
                                        }, void 0, false, {
                                            fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                            lineNumber: 2551,
                                            columnNumber: 15
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                    lineNumber: 2539,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ jsxDEV("thead", {
                                    className: "bg-[color:var(--admin-table-header-bg)]",
                                    children: /*#__PURE__*/ jsxDEV("tr", {
                                        children: [
                                            /*#__PURE__*/ jsxDEV("th", {
                                                className: "w-10 px-2 py-2 text-center",
                                                children: /*#__PURE__*/ jsxDEV(AdminCheckbox, {
                                                    checked: editable && selectedAll,
                                                    disabled: !editable,
                                                    onChange: ()=>setSelectedIds(selectedAll ? new Set() : new Set(visibleVariants.map((variant)=>variant.id)))
                                                }, void 0, false, {
                                                    fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                    lineNumber: 2556,
                                                    columnNumber: 19
                                                }, this)
                                            }, void 0, false, {
                                                fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                lineNumber: 2555,
                                                columnNumber: 17
                                            }, this),
                                            /*#__PURE__*/ jsxDEV("th", {
                                                className: `${tableHeaderClassName} whitespace-nowrap text-center`,
                                                children: "Frakcija"
                                            }, void 0, false, {
                                                fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                lineNumber: 2562,
                                                columnNumber: 17
                                            }, this),
                                            /*#__PURE__*/ jsxDEV("th", {
                                                className: `${tableHeaderClassName} text-center`,
                                                children: "Barva"
                                            }, void 0, false, {
                                                fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                lineNumber: 2563,
                                                columnNumber: 17
                                            }, this),
                                            /*#__PURE__*/ jsxDEV("th", {
                                                className: `${tableHeaderClassName} text-center`,
                                                children: "Tip"
                                            }, void 0, false, {
                                                fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                lineNumber: 2564,
                                                columnNumber: 17
                                            }, this),
                                            /*#__PURE__*/ jsxDEV("th", {
                                                className: `${tableHeaderClassName} text-right`,
                                                children: "Neto masa"
                                            }, void 0, false, {
                                                fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                lineNumber: 2565,
                                                columnNumber: 17
                                            }, this),
                                            /*#__PURE__*/ jsxDEV("th", {
                                                className: `${tableHeaderClassName} text-right`,
                                                children: "Cena"
                                            }, void 0, false, {
                                                fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                lineNumber: 2566,
                                                columnNumber: 17
                                            }, this),
                                            /*#__PURE__*/ jsxDEV("th", {
                                                className: `${tableHeaderClassName} text-center`,
                                                children: "Vir zaloge"
                                            }, void 0, false, {
                                                fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                lineNumber: 2567,
                                                columnNumber: 17
                                            }, this),
                                            /*#__PURE__*/ jsxDEV("th", {
                                                className: `${tableHeaderClassName} text-right`,
                                                children: "Razpoložljivo"
                                            }, void 0, false, {
                                                fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                lineNumber: 2568,
                                                columnNumber: 17
                                            }, this),
                                            /*#__PURE__*/ jsxDEV("th", {
                                                className: `${tableHeaderClassName} text-center`,
                                                children: "SKU"
                                            }, void 0, false, {
                                                fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                lineNumber: 2569,
                                                columnNumber: 17
                                            }, this),
                                            /*#__PURE__*/ jsxDEV("th", {
                                                className: `${tableHeaderClassName} text-center`,
                                                children: "Status"
                                            }, void 0, false, {
                                                fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                lineNumber: 2570,
                                                columnNumber: 17
                                            }, this),
                                            /*#__PURE__*/ jsxDEV("th", {
                                                className: `${tableHeaderClassName} text-center`,
                                                children: "Opombe"
                                            }, void 0, false, {
                                                fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                lineNumber: 2571,
                                                columnNumber: 17
                                            }, this),
                                            /*#__PURE__*/ jsxDEV("th", {
                                                className: `${tableHeaderClassName} text-center`,
                                                children: "Mesto"
                                            }, void 0, false, {
                                                fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                lineNumber: 2572,
                                                columnNumber: 17
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                        lineNumber: 2554,
                                        columnNumber: 15
                                    }, this)
                                }, void 0, false, {
                                    fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                    lineNumber: 2553,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ jsxDEV("tbody", {
                                    children: visibleVariants.map((variant)=>{
                                        const totalMass = getWeightVariantTotalMass(variant) ?? 0;
                                        const sourceColor = normalizeSingleWeightColorValue(variant.color || color || '—');
                                        const sourceFraction = variant.fraction || data.fraction || '—';
                                        return /*#__PURE__*/ jsxDEV("tr", {
                                            className: "border-t border-slate-100",
                                            children: [
                                                /*#__PURE__*/ jsxDEV("td", {
                                                    className: `${weightVariantTableTightCellClassName} text-center`,
                                                    children: /*#__PURE__*/ jsxDEV(AdminCheckbox, {
                                                        checked: selectedIds.has(variant.id),
                                                        disabled: !editable,
                                                        onChange: ()=>setSelectedIds((current)=>{
                                                                const next = new Set(current);
                                                                if (next.has(variant.id)) next.delete(variant.id);
                                                                else next.add(variant.id);
                                                                return next;
                                                            })
                                                    }, void 0, false, {
                                                        fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                        lineNumber: 2583,
                                                        columnNumber: 23
                                                    }, this)
                                                }, void 0, false, {
                                                    fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                    lineNumber: 2582,
                                                    columnNumber: 21
                                                }, this),
                                                /*#__PURE__*/ jsxDEV("td", {
                                                    className: `${weightVariantTableCellClassName} whitespace-nowrap text-center`,
                                                    children: editable ? /*#__PURE__*/ jsxDEV("span", {
                                                        className: compactTableThirtyValueUnitShellClassName,
                                                        children: [
                                                            /*#__PURE__*/ jsxDEV("input", {
                                                                className: `${compactTableThirtyInputClassName} !mt-0 !w-[7ch] text-center`,
                                                                value: stripWeightFractionUnit(sourceFraction),
                                                                onChange: (event)=>updateVariant(variant.id, {
                                                                        fraction: normalizeWeightFractionValue(event.target.value)
                                                                    })
                                                            }, void 0, false, {
                                                                fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                                lineNumber: 2597,
                                                                columnNumber: 27
                                                            }, this),
                                                            /*#__PURE__*/ jsxDEV("span", {
                                                                className: compactTableAdornmentClassName,
                                                                children: "mm"
                                                            }, void 0, false, {
                                                                fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                                lineNumber: 2602,
                                                                columnNumber: 27
                                                            }, this)
                                                        ]
                                                    }, void 0, true, {
                                                        fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                        lineNumber: 2596,
                                                        columnNumber: 25
                                                    }, this) : sourceFraction !== '—' ? /*#__PURE__*/ jsxDEV("span", {
                                                        className: "inline-flex h-[30px] items-center justify-center whitespace-nowrap rounded-md border border-transparent bg-transparent px-2 text-slate-700",
                                                        children: [
                                                            /*#__PURE__*/ jsxDEV("span", {
                                                                children: stripWeightFractionUnit(sourceFraction)
                                                            }, void 0, false, {
                                                                fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                                lineNumber: 2608,
                                                                columnNumber: 31
                                                            }, this),
                                                            /*#__PURE__*/ jsxDEV("span", {
                                                                className: `ml-1 ${compactTableAdornmentClassName}`,
                                                                children: "mm"
                                                            }, void 0, false, {
                                                                fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                                lineNumber: 2609,
                                                                columnNumber: 31
                                                            }, this)
                                                        ]
                                                    }, void 0, true, {
                                                        fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                        lineNumber: 2607,
                                                        columnNumber: 29
                                                    }, this) : '—'
                                                }, void 0, false, {
                                                    fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                    lineNumber: 2594,
                                                    columnNumber: 21
                                                }, this),
                                                /*#__PURE__*/ jsxDEV("td", {
                                                    className: `${weightVariantTableCellClassName} text-center`,
                                                    children: editable ? /*#__PURE__*/ jsxDEV("input", {
                                                        className: "h-[30px] w-[10ch] rounded-md border border-slate-300 bg-white px-1.5 text-center text-[11px] text-slate-900 outline-none focus:border-[#3e67d6]",
                                                        value: sourceColor === '—' ? '' : sourceColor,
                                                        onChange: (event)=>updateVariant(variant.id, {
                                                                color: normalizeSingleWeightColorValue(event.target.value)
                                                            })
                                                    }, void 0, false, {
                                                        fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                        lineNumber: 2617,
                                                        columnNumber: 25
                                                    }, this) : /*#__PURE__*/ jsxDEV(ReadOnlyTableField, {
                                                        value: sourceColor,
                                                        align: "center",
                                                        className: "w-[10ch]"
                                                    }, void 0, false, {
                                                        fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                        lineNumber: 2623,
                                                        columnNumber: 25
                                                    }, this)
                                                }, void 0, false, {
                                                    fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                    lineNumber: 2615,
                                                    columnNumber: 21
                                                }, this),
                                                /*#__PURE__*/ jsxDEV("td", {
                                                    className: `${weightVariantTableCellClassName} text-center`,
                                                    children: /*#__PURE__*/ jsxDEV(ReadOnlyTableField, {
                                                        value: "Vreče",
                                                        align: "center",
                                                        className: "border-transparent bg-transparent"
                                                    }, void 0, false, {
                                                        fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                        lineNumber: 2626,
                                                        columnNumber: 86
                                                    }, this)
                                                }, void 0, false, {
                                                    fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                    lineNumber: 2626,
                                                    columnNumber: 21
                                                }, this),
                                                /*#__PURE__*/ jsxDEV("td", {
                                                    className: `${weightVariantTableCellClassName} text-right`,
                                                    children: editable ? /*#__PURE__*/ jsxDEV(NumberInline, {
                                                        value: totalMass,
                                                        suffix: "kg",
                                                        compact: true,
                                                        onChange: (value)=>updateVariant(variant.id, {
                                                                netMassKg: value
                                                            })
                                                    }, void 0, false, {
                                                        fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                        lineNumber: 2629,
                                                        columnNumber: 25
                                                    }, this) : /*#__PURE__*/ jsxDEV(ReadOnlyTableField, {
                                                        value: formatWeightKg(totalMass),
                                                        align: "right",
                                                        className: "w-20"
                                                    }, void 0, false, {
                                                        fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                        lineNumber: 2636,
                                                        columnNumber: 25
                                                    }, this)
                                                }, void 0, false, {
                                                    fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                    lineNumber: 2627,
                                                    columnNumber: 21
                                                }, this),
                                                /*#__PURE__*/ jsxDEV("td", {
                                                    className: `${weightVariantTableCellClassName} text-right`,
                                                    children: editable ? /*#__PURE__*/ jsxDEV(NumberInline, {
                                                        value: toGrossWithVat(getWeightVariantUnitPrice(variant)),
                                                        suffix: "€",
                                                        compact: true,
                                                        onChange: (value)=>updateVariant(variant.id, {
                                                                unitPrice: toNetFromGross(value)
                                                            })
                                                    }, void 0, false, {
                                                        fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                        lineNumber: 2641,
                                                        columnNumber: 25
                                                    }, this) : /*#__PURE__*/ jsxDEV(ReadOnlyTableField, {
                                                        value: formatWeightVariantGrossPrice(variant),
                                                        align: "right",
                                                        className: "w-20"
                                                    }, void 0, false, {
                                                        fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                        lineNumber: 2648,
                                                        columnNumber: 25
                                                    }, this)
                                                }, void 0, false, {
                                                    fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                    lineNumber: 2639,
                                                    columnNumber: 21
                                                }, this),
                                                /*#__PURE__*/ jsxDEV("td", {
                                                    className: `${weightVariantTableCellClassName} text-center`,
                                                    children: /*#__PURE__*/ jsxDEV(ReadOnlyTableField, {
                                                        value: `${sourceFraction} / ${sourceColor}`,
                                                        align: "center",
                                                        className: "w-full"
                                                    }, void 0, false, {
                                                        fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                        lineNumber: 2651,
                                                        columnNumber: 86
                                                    }, this)
                                                }, void 0, false, {
                                                    fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                    lineNumber: 2651,
                                                    columnNumber: 21
                                                }, this),
                                                /*#__PURE__*/ jsxDEV("td", {
                                                    className: `${weightVariantTableCellClassName} text-right`,
                                                    children: editable ? /*#__PURE__*/ jsxDEV(NumberInline, {
                                                        value: variant.stockKg,
                                                        suffix: "kg",
                                                        compact: true,
                                                        onChange: (value)=>updateVariant(variant.id, {
                                                                stockKg: value
                                                            })
                                                    }, void 0, false, {
                                                        fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                        lineNumber: 2653,
                                                        columnNumber: 35
                                                    }, this) : /*#__PURE__*/ jsxDEV(ReadOnlyTableField, {
                                                        value: formatWeightKg(variant.stockKg),
                                                        align: "right",
                                                        className: "w-20"
                                                    }, void 0, false, {
                                                        fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                        lineNumber: 2653,
                                                        columnNumber: 166
                                                    }, this)
                                                }, void 0, false, {
                                                    fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                    lineNumber: 2652,
                                                    columnNumber: 21
                                                }, this),
                                                /*#__PURE__*/ jsxDEV("td", {
                                                    className: `${weightVariantTableCellClassName} text-center`,
                                                    children: editable ? /*#__PURE__*/ jsxDEV("input", {
                                                        className: "h-[30px] w-full rounded-md border border-slate-300 bg-white px-1.5 text-center text-[11px] text-slate-900 outline-none focus:border-[#3e67d6]",
                                                        value: variant.sku,
                                                        onChange: (event)=>updateVariant(variant.id, {
                                                                sku: event.target.value
                                                            })
                                                    }, void 0, false, {
                                                        fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                        lineNumber: 2655,
                                                        columnNumber: 98
                                                    }, this) : /*#__PURE__*/ jsxDEV(ReadOnlyTableField, {
                                                        value: variant.sku,
                                                        align: "center",
                                                        className: "w-full"
                                                    }, void 0, false, {
                                                        fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                        lineNumber: 2655,
                                                        columnNumber: 361
                                                    }, this)
                                                }, void 0, false, {
                                                    fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                    lineNumber: 2655,
                                                    columnNumber: 21
                                                }, this),
                                                /*#__PURE__*/ jsxDEV("td", {
                                                    className: `${weightVariantTableCellClassName} text-center`,
                                                    children: /*#__PURE__*/ jsxDEV("div", {
                                                        className: "inline-flex justify-center",
                                                        children: /*#__PURE__*/ jsxDEV(ActiveStateChip, {
                                                            active: variant.active,
                                                            editable: editable,
                                                            chipClassName: adminStatusInfoPillVariantTableClassName,
                                                            menuPlacement: "bottom",
                                                            onChange: (next)=>updateVariant(variant.id, {
                                                                    active: next
                                                                })
                                                        }, void 0, false, {
                                                            fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                            lineNumber: 2658,
                                                            columnNumber: 25
                                                        }, this)
                                                    }, void 0, false, {
                                                        fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                        lineNumber: 2657,
                                                        columnNumber: 23
                                                    }, this)
                                                }, void 0, false, {
                                                    fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                    lineNumber: 2656,
                                                    columnNumber: 21
                                                }, this),
                                                /*#__PURE__*/ jsxDEV("td", {
                                                    className: `${weightVariantTableCellClassName} text-center`,
                                                    children: /*#__PURE__*/ jsxDEV("div", {
                                                        className: "inline-flex justify-center",
                                                        children: /*#__PURE__*/ jsxDEV(NoteTagChip, {
                                                            value: normalizeWeightNoteTag(variant.note),
                                                            editable: editable,
                                                            allowEmpty: true,
                                                            placeholderLabel: "Opombe",
                                                            chipClassName: adminStatusInfoPillVariantTableClassName,
                                                            menuPlacement: "bottom",
                                                            onChange: (next)=>updateVariant(variant.id, {
                                                                    note: next
                                                                })
                                                        }, void 0, false, {
                                                            fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                            lineNumber: 2669,
                                                            columnNumber: 25
                                                        }, this)
                                                    }, void 0, false, {
                                                        fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                        lineNumber: 2668,
                                                        columnNumber: 23
                                                    }, this)
                                                }, void 0, false, {
                                                    fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                    lineNumber: 2667,
                                                    columnNumber: 21
                                                }, this),
                                                /*#__PURE__*/ jsxDEV("td", {
                                                    className: `${weightVariantTableTightCellClassName} text-center`,
                                                    children: editable ? /*#__PURE__*/ jsxDEV("input", {
                                                        type: "number",
                                                        inputMode: "numeric",
                                                        className: `${compactTableThirtyInputClassName} !mt-0 !w-[4ch] !px-0 text-center`,
                                                        value: variant.position,
                                                        onChange: (event)=>updateVariant(variant.id, {
                                                                position: Math.max(1, Math.floor(Number(event.target.value) || 1))
                                                            })
                                                    }, void 0, false, {
                                                        fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                        lineNumber: 2682,
                                                        columnNumber: 25
                                                    }, this) : /*#__PURE__*/ jsxDEV("span", {
                                                        className: "inline-flex h-[30px] w-[4ch] items-center justify-center",
                                                        children: variant.position
                                                    }, void 0, false, {
                                                        fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                        lineNumber: 2690,
                                                        columnNumber: 25
                                                    }, this)
                                                }, void 0, false, {
                                                    fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                    lineNumber: 2680,
                                                    columnNumber: 21
                                                }, this)
                                            ]
                                        }, variant.id, true, {
                                            fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                            lineNumber: 2581,
                                            columnNumber: 19
                                        }, this);
                                    })
                                }, void 0, false, {
                                    fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                    lineNumber: 2575,
                                    columnNumber: 13
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                            lineNumber: 2538,
                            columnNumber: 11
                        }, this)
                    }, void 0, false, {
                        fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                        lineNumber: 2537,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ jsxDEV("p", {
                        className: "border-t border-slate-200 px-3 py-2 text-[11px] leading-4 text-slate-500",
                        children: "Cena vključuje DDV."
                    }, void 0, false, {
                        fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                        lineNumber: 2699,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                lineNumber: 2535,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
        lineNumber: 2353,
        columnNumber: 5
    }, this);
}
_s1(WeightProductModule, "nqCOs3cYJ0BGPKIWCYQTJlR/GTE=");
function WeightFractionEditorSelect({ value, rows, editable, onSelect, onRename, onDelete, onAdd }) {
    _s2();
    const [isOpen, setIsOpen] = (0, useState)(false);
    const containerRef = (0, useRef)(null);
    const triggerRef = (0, useRef)(null);
    const menuContainerRef = (0, useRef)(null);
    const [menuRect, setMenuRect] = (0, useState)(null);
    const selectedLabel = rows.find((row)=>createWeightFractionKey(row.fraction) === createWeightFractionKey(value))?.fraction ?? value;
    const canOpen = editable || rows.length > 1;
    (0, useEffect)({
        "WeightFractionEditorSelect.useEffect": ()=>{
            if (!isOpen) return;
            const updateMenuRect = {
                "WeightFractionEditorSelect.useEffect.updateMenuRect": ()=>{
                    const triggerBounds = triggerRef.current?.getBoundingClientRect();
                    if (!triggerBounds) return;
                    setMenuRect({
                        top: triggerBounds.bottom + 4,
                        left: triggerBounds.left,
                        width: Math.max(triggerBounds.width, 172)
                    });
                }
            }["WeightFractionEditorSelect.useEffect.updateMenuRect"];
            updateMenuRect();
            const handleOutsideClick = {
                "WeightFractionEditorSelect.useEffect.handleOutsideClick": (event)=>{
                    const target = event.target;
                    const clickedInsideTrigger = containerRef.current?.contains(target);
                    const clickedInsideMenu = menuContainerRef.current?.contains(target);
                    if (!clickedInsideTrigger && !clickedInsideMenu) setIsOpen(false);
                }
            }["WeightFractionEditorSelect.useEffect.handleOutsideClick"];
            const handleEscape = {
                "WeightFractionEditorSelect.useEffect.handleEscape": (event)=>{
                    if (event.key === 'Escape') setIsOpen(false);
                }
            }["WeightFractionEditorSelect.useEffect.handleEscape"];
            document.addEventListener('mousedown', handleOutsideClick);
            document.addEventListener('keydown', handleEscape);
            window.addEventListener('resize', updateMenuRect);
            window.addEventListener('scroll', updateMenuRect, true);
            return ({
                "WeightFractionEditorSelect.useEffect": ()=>{
                    document.removeEventListener('mousedown', handleOutsideClick);
                    document.removeEventListener('keydown', handleEscape);
                    window.removeEventListener('resize', updateMenuRect);
                    window.removeEventListener('scroll', updateMenuRect, true);
                }
            })["WeightFractionEditorSelect.useEffect"];
        }
    }["WeightFractionEditorSelect.useEffect"], [
        isOpen
    ]);
    return /*#__PURE__*/ jsxDEV("div", {
        ref: containerRef,
        className: "relative w-[150px]",
        children: [
            /*#__PURE__*/ jsxDEV("button", {
                ref: triggerRef,
                type: "button",
                disabled: !canOpen,
                onClick: ()=>setIsOpen((previousOpen)=>!previousOpen),
                "aria-label": "Izberi frakcijo",
                "aria-haspopup": "listbox",
                "aria-expanded": isOpen,
                className: classNames('relative !h-[30px] !rounded-md !px-2.5 !text-[11px] !font-normal !text-slate-700', selectTokenClasses.trigger, 'pr-5'),
                children: [
                    /*#__PURE__*/ jsxDEV("span", {
                        className: "min-w-0 flex-1 truncate pb-px text-left text-[11px] font-normal leading-[1.3]",
                        children: selectedLabel
                    }, void 0, false, {
                        fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                        lineNumber: 2782,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ jsxDEV("span", {
                        className: "pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-500",
                        children: "▾"
                    }, void 0, false, {
                        fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                        lineNumber: 2783,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                lineNumber: 2772,
                columnNumber: 7
            }, this),
            isOpen && menuRect && typeof document !== 'undefined' ? /*#__PURE__*/ (0, createPortal)(/*#__PURE__*/ jsxDEV("div", {
                ref: menuContainerRef,
                role: "listbox",
                className: "fixed z-[140]",
                style: {
                    top: `${menuRect.top}px`,
                    left: `${menuRect.left}px`,
                    width: `${menuRect.width}px`
                },
                children: /*#__PURE__*/ jsxDEV(MenuPanel, {
                    className: classNames(selectTokenClasses.menu, 'w-full'),
                    children: [
                        /*#__PURE__*/ jsxDEV("div", {
                            children: rows.map((row)=>{
                                const active = createWeightFractionKey(row.fraction) === createWeightFractionKey(value);
                                return /*#__PURE__*/ jsxDEV("div", {
                                    role: "option",
                                    "aria-selected": active,
                                    className: classNames(selectTokenClasses.menuItem, 'group grid grid-cols-[18px_minmax(0,1fr)_24px] gap-2 px-2', active && 'bg-[#e8f3ff] text-[#1982bf]'),
                                    children: [
                                        /*#__PURE__*/ jsxDEV("button", {
                                            type: "button",
                                            className: classNames('flex h-5 w-5 items-center justify-center rounded text-slate-400 transition hover:bg-white hover:text-[#1982bf]', active && 'text-[#1982bf]'),
                                            onClick: ()=>onSelect(row.fraction),
                                            "aria-label": `Izberi ${row.fraction}`,
                                            children: /*#__PURE__*/ jsxDEV("span", {
                                                className: classNames('h-2 w-2 rounded-full border', active ? 'border-[#1982bf] bg-[#1982bf]' : 'border-slate-300 bg-white')
                                            }, void 0, false, {
                                                fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                lineNumber: 2818,
                                                columnNumber: 27
                                            }, this)
                                        }, void 0, false, {
                                            fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                            lineNumber: 2809,
                                            columnNumber: 25
                                        }, this),
                                        /*#__PURE__*/ jsxDEV("span", {
                                            className: "flex min-w-0 items-center gap-1",
                                            children: [
                                                /*#__PURE__*/ jsxDEV("input", {
                                                    className: "h-6 w-[8ch] border-0 bg-transparent p-0 text-[12px] font-medium leading-none text-slate-700 outline-none focus:text-slate-900 focus:ring-0 disabled:cursor-default disabled:text-slate-700",
                                                    value: stripWeightFractionUnit(row.fraction),
                                                    disabled: !editable,
                                                    onFocus: ()=>onSelect(row.fraction),
                                                    onChange: (event)=>onRename(row, event.target.value)
                                                }, void 0, false, {
                                                    fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                    lineNumber: 2821,
                                                    columnNumber: 27
                                                }, this),
                                                /*#__PURE__*/ jsxDEV("span", {
                                                    className: "shrink-0 text-[12px] font-medium text-slate-500",
                                                    children: "mm"
                                                }, void 0, false, {
                                                    fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                    lineNumber: 2828,
                                                    columnNumber: 27
                                                }, this)
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                            lineNumber: 2820,
                                            columnNumber: 25
                                        }, this),
                                        /*#__PURE__*/ jsxDEV("button", {
                                            type: "button",
                                            disabled: !editable || rows.length <= 1,
                                            className: "flex h-6 w-6 items-center justify-center rounded text-slate-300 opacity-0 transition hover:bg-white hover:text-rose-600 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-slate-300 group-hover:opacity-100 focus:opacity-100",
                                            onClick: (event)=>{
                                                event.stopPropagation();
                                                onDelete(row);
                                            },
                                            "aria-label": `Odstrani ${row.fraction}`,
                                            title: "Odstrani",
                                            children: /*#__PURE__*/ jsxDEV(TrashCanIcon, {}, void 0, false, {
                                                fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                lineNumber: 2841,
                                                columnNumber: 27
                                            }, this)
                                        }, void 0, false, {
                                            fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                            lineNumber: 2830,
                                            columnNumber: 25
                                        }, this)
                                    ]
                                }, row.id, true, {
                                    fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                    lineNumber: 2799,
                                    columnNumber: 23
                                }, this);
                            })
                        }, void 0, false, {
                            fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                            lineNumber: 2795,
                            columnNumber: 17
                        }, this),
                        /*#__PURE__*/ jsxDEV("button", {
                            type: "button",
                            disabled: !editable,
                            onClick: onAdd,
                            className: classNames(selectTokenClasses.menuItem, 'mt-1 justify-center gap-2 border-t border-slate-100 text-[12px] font-semibold disabled:cursor-not-allowed'),
                            children: /*#__PURE__*/ jsxDEV("span", {
                                children: "Dodaj frakcijo"
                            }, void 0, false, {
                                fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                lineNumber: 2853,
                                columnNumber: 19
                            }, this)
                        }, void 0, false, {
                            fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                            lineNumber: 2847,
                            columnNumber: 17
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                    lineNumber: 2794,
                    columnNumber: 15
                }, this)
            }, void 0, false, {
                fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                lineNumber: 2788,
                columnNumber: 13
            }, this), document.body) : null
        ]
    }, void 0, true, {
        fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
        lineNumber: 2771,
        columnNumber: 5
    }, this);
}
_s2(WeightFractionEditorSelect, "lbPaauVbjJzVdjjhlA8LI4WfiAM=");
function UniqueMachineProductModule({ editable, data, orderMatches = [], onChange }) {
    _s3();
    const update = (updates)=>onChange({
            ...data,
            ...updates
        });
    const updateSpec = (id, updates)=>update({
            specs: data.specs.map((spec)=>spec.id === id ? {
                    ...spec,
                    ...updates
                } : spec)
        });
    const updateBasicInfoRow = (id, updates)=>update({
            basicInfoRows: data.basicInfoRows.map((row)=>row.id === id ? {
                    ...row,
                    ...updates
                } : row)
        });
    const addBasicInfoRow = ()=>update({
            basicInfoRows: [
                ...data.basicInfoRows,
                {
                    id: createLocalId('basic-info'),
                    property: '',
                    value: ''
                }
            ]
        });
    const addSpec = ()=>update({
            specs: [
                ...data.specs,
                {
                    id: createLocalId('spec'),
                    property: '',
                    value: ''
                }
            ]
        });
    const [selectedBasicInfoIds, setSelectedBasicInfoIds] = (0, useState)(new Set());
    const [selectedSpecIds, setSelectedSpecIds] = (0, useState)(new Set());
    const [selectedSerialIds, setSelectedSerialIds] = (0, useState)(new Set());
    const [selectedIncludedIndexes, setSelectedIncludedIndexes] = (0, useState)(new Set());
    const allBasicInfoSelected = data.basicInfoRows.length > 0 && data.basicInfoRows.every((row)=>selectedBasicInfoIds.has(row.id));
    const hasSelectedBasicInfo = data.basicInfoRows.some((row)=>selectedBasicInfoIds.has(row.id));
    const allSpecsSelected = data.specs.length > 0 && data.specs.every((spec)=>selectedSpecIds.has(spec.id));
    const hasSelectedSpecs = data.specs.some((spec)=>selectedSpecIds.has(spec.id));
    const allSerialsSelected = data.serialNumbers.length > 0 && data.serialNumbers.every((row)=>selectedSerialIds.has(row.id));
    const hasSelectedSerials = data.serialNumbers.some((row)=>selectedSerialIds.has(row.id));
    const hasSelectedIncludedItems = data.includedItems.some((_, index)=>selectedIncludedIndexes.has(index));
    const serialOrderAllocations = (0, useMemo)({
        "UniqueMachineProductModule.useMemo[serialOrderAllocations]": ()=>buildMachineSerialOrderAllocations(data.serialNumbers, orderMatches)
    }["UniqueMachineProductModule.useMemo[serialOrderAllocations]"], [
        data.serialNumbers,
        orderMatches
    ]);
    const toggleBasicInfoSelection = (id)=>{
        setSelectedBasicInfoIds((current)=>{
            const next = new Set(current);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };
    const toggleAllBasicInfo = ()=>{
        setSelectedBasicInfoIds(allBasicInfoSelected ? new Set() : new Set(data.basicInfoRows.map((row)=>row.id)));
    };
    const removeSelectedBasicInfoRows = ()=>{
        if (!hasSelectedBasicInfo) return;
        update({
            basicInfoRows: data.basicInfoRows.filter((row)=>!selectedBasicInfoIds.has(row.id))
        });
        setSelectedBasicInfoIds(new Set());
    };
    const toggleSpecSelection = (id)=>{
        setSelectedSpecIds((current)=>{
            const next = new Set(current);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };
    const toggleAllSpecs = ()=>{
        setSelectedSpecIds(allSpecsSelected ? new Set() : new Set(data.specs.map((spec)=>spec.id)));
    };
    const removeSelectedSpecs = ()=>{
        if (!hasSelectedSpecs) return;
        update({
            specs: data.specs.filter((spec)=>!selectedSpecIds.has(spec.id))
        });
        setSelectedSpecIds(new Set());
    };
    const updateSerial = (id, updates)=>update({
            serialNumbers: data.serialNumbers.map((row)=>row.id === id ? {
                    ...row,
                    ...updates
                } : row)
        });
    const addSerial = ()=>update({
            serialNumbers: [
                ...data.serialNumbers,
                {
                    id: createLocalId('serial'),
                    serialNumber: '',
                    status: 'in_stock',
                    orderReference: '',
                    shippedAt: ''
                }
            ]
        });
    const toggleSerialSelection = (id)=>{
        setSelectedSerialIds((current)=>{
            const next = new Set(current);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };
    const toggleAllSerials = ()=>{
        setSelectedSerialIds(allSerialsSelected ? new Set() : new Set(data.serialNumbers.map((row)=>row.id)));
    };
    const removeSelectedSerials = ()=>{
        if (!hasSelectedSerials) return;
        update({
            serialNumbers: data.serialNumbers.filter((row)=>!selectedSerialIds.has(row.id))
        });
        setSelectedSerialIds(new Set());
    };
    const updateIncludedItem = (index, value)=>update({
            includedItems: data.includedItems.map((entry, entryIndex)=>entryIndex === index ? value : entry)
        });
    const toggleIncludedSelection = (index)=>{
        setSelectedIncludedIndexes((current)=>{
            const next = new Set(current);
            if (next.has(index)) next.delete(index);
            else next.add(index);
            return next;
        });
    };
    const removeSelectedIncludedItems = ()=>{
        if (!hasSelectedIncludedItems) return;
        update({
            includedItems: data.includedItems.filter((_, entryIndex)=>!selectedIncludedIndexes.has(entryIndex))
        });
        setSelectedIncludedIndexes(new Set());
    };
    (0, useEffect)({
        "UniqueMachineProductModule.useEffect": ()=>{
            setSelectedBasicInfoIds({
                "UniqueMachineProductModule.useEffect": (current)=>{
                    const validIds = new Set(data.basicInfoRows.map({
                        "UniqueMachineProductModule.useEffect": (row)=>row.id
                    }["UniqueMachineProductModule.useEffect"]));
                    const next = new Set(Array.from(current).filter({
                        "UniqueMachineProductModule.useEffect": (id)=>validIds.has(id)
                    }["UniqueMachineProductModule.useEffect"]));
                    return next.size === current.size ? current : next;
                }
            }["UniqueMachineProductModule.useEffect"]);
        }
    }["UniqueMachineProductModule.useEffect"], [
        data.basicInfoRows
    ]);
    (0, useEffect)({
        "UniqueMachineProductModule.useEffect": ()=>{
            setSelectedSpecIds({
                "UniqueMachineProductModule.useEffect": (current)=>{
                    const validIds = new Set(data.specs.map({
                        "UniqueMachineProductModule.useEffect": (spec)=>spec.id
                    }["UniqueMachineProductModule.useEffect"]));
                    const next = new Set(Array.from(current).filter({
                        "UniqueMachineProductModule.useEffect": (id)=>validIds.has(id)
                    }["UniqueMachineProductModule.useEffect"]));
                    return next.size === current.size ? current : next;
                }
            }["UniqueMachineProductModule.useEffect"]);
        }
    }["UniqueMachineProductModule.useEffect"], [
        data.specs
    ]);
    (0, useEffect)({
        "UniqueMachineProductModule.useEffect": ()=>{
            setSelectedSerialIds({
                "UniqueMachineProductModule.useEffect": (current)=>{
                    const validIds = new Set(data.serialNumbers.map({
                        "UniqueMachineProductModule.useEffect": (row)=>row.id
                    }["UniqueMachineProductModule.useEffect"]));
                    const next = new Set(Array.from(current).filter({
                        "UniqueMachineProductModule.useEffect": (id)=>validIds.has(id)
                    }["UniqueMachineProductModule.useEffect"]));
                    return next.size === current.size ? current : next;
                }
            }["UniqueMachineProductModule.useEffect"]);
        }
    }["UniqueMachineProductModule.useEffect"], [
        data.serialNumbers
    ]);
    (0, useEffect)({
        "UniqueMachineProductModule.useEffect": ()=>{
            setSelectedIncludedIndexes({
                "UniqueMachineProductModule.useEffect": (current)=>{
                    const next = new Set(Array.from(current).filter({
                        "UniqueMachineProductModule.useEffect": (index)=>index >= 0 && index < data.includedItems.length
                    }["UniqueMachineProductModule.useEffect"]));
                    return next.size === current.size ? current : next;
                }
            }["UniqueMachineProductModule.useEffect"]);
        }
    }["UniqueMachineProductModule.useEffect"], [
        data.includedItems.length
    ]);
    return /*#__PURE__*/ jsxDEV("section", {
        className: `${adminWindowCardClassName} px-5 pb-5 pt-5`,
        style: adminWindowCardStyle,
        children: [
            /*#__PURE__*/ jsxDEV("div", {
                className: "mb-4",
                children: /*#__PURE__*/ jsxDEV("h2", {
                    className: sectionTitleClassName,
                    children: "Prodajne informacije"
                }, void 0, false, {
                    fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                    lineNumber: 3006,
                    columnNumber: 9
                }, this)
            }, void 0, false, {
                fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                lineNumber: 3005,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ jsxDEV("div", {
                className: "grid items-stretch gap-4 xl:grid-cols-[minmax(420px,0.95fr)_minmax(520px,1.05fr)]",
                children: [
                    /*#__PURE__*/ jsxDEV("div", {
                        className: "flex h-full min-h-0 flex-col gap-4",
                        children: [
                            /*#__PURE__*/ jsxDEV("section", {
                                className: "flex min-h-[280px] flex-1 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white",
                                children: [
                                    /*#__PURE__*/ jsxDEV("div", {
                                        className: "flex items-center justify-between gap-2 px-4 py-3",
                                        children: [
                                            /*#__PURE__*/ jsxDEV("h3", {
                                                className: "text-sm font-semibold text-slate-900",
                                                children: "Serijska številka / sledljivost"
                                            }, void 0, false, {
                                                fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                lineNumber: 3012,
                                                columnNumber: 13
                                            }, this),
                                            /*#__PURE__*/ jsxDEV("div", {
                                                className: "flex items-center gap-2",
                                                children: [
                                                    /*#__PURE__*/ jsxDEV(IconButton, {
                                                        type: "button",
                                                        tone: "neutral",
                                                        className: adminTableNeutralIconButtonClassName,
                                                        disabled: !editable,
                                                        onClick: addSerial,
                                                        "aria-label": "Dodaj serijsko številko",
                                                        title: "Dodaj serijsko številko",
                                                        children: /*#__PURE__*/ jsxDEV(PlusIcon, {}, void 0, false, {
                                                            fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                            lineNumber: 3014,
                                                            columnNumber: 215
                                                        }, this)
                                                    }, void 0, false, {
                                                        fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                        lineNumber: 3014,
                                                        columnNumber: 15
                                                    }, this),
                                                    /*#__PURE__*/ jsxDEV(IconButton, {
                                                        type: "button",
                                                        tone: hasSelectedSerials ? 'danger' : 'neutral',
                                                        className: hasSelectedSerials ? adminTableSelectedDangerIconButtonClassName : adminTableNeutralIconButtonClassName,
                                                        disabled: !editable || !hasSelectedSerials,
                                                        onClick: removeSelectedSerials,
                                                        "aria-label": "Odstrani izbrane serijske številke",
                                                        title: "Odstrani izbrane",
                                                        children: /*#__PURE__*/ jsxDEV(TrashCanIcon, {}, void 0, false, {
                                                            fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                            lineNumber: 3024,
                                                            columnNumber: 17
                                                        }, this)
                                                    }, void 0, false, {
                                                        fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                        lineNumber: 3015,
                                                        columnNumber: 15
                                                    }, this)
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                lineNumber: 3013,
                                                columnNumber: 13
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                        lineNumber: 3011,
                                        columnNumber: 11
                                    }, this),
                                    /*#__PURE__*/ jsxDEV("div", {
                                        className: "min-h-[220px] flex-1 overflow-auto border-t border-slate-200",
                                        children: /*#__PURE__*/ jsxDEV("table", {
                                            className: "min-w-full text-[12px] leading-5",
                                            children: [
                                                /*#__PURE__*/ jsxDEV("thead", {
                                                    className: "bg-[color:var(--admin-table-header-bg)]",
                                                    children: /*#__PURE__*/ jsxDEV("tr", {
                                                        children: [
                                                            /*#__PURE__*/ jsxDEV("th", {
                                                                className: `${adminTableHeaderCellCenterClassName} w-10 px-2`,
                                                                children: /*#__PURE__*/ jsxDEV(AdminCheckbox, {
                                                                    checked: editable && allSerialsSelected,
                                                                    disabled: !editable || data.serialNumbers.length === 0,
                                                                    onChange: toggleAllSerials
                                                                }, void 0, false, {
                                                                    fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                                    lineNumber: 3033,
                                                                    columnNumber: 21
                                                                }, this)
                                                            }, void 0, false, {
                                                                fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                                lineNumber: 3032,
                                                                columnNumber: 19
                                                            }, this),
                                                            /*#__PURE__*/ jsxDEV("th", {
                                                                className: adminTableHeaderCellLeftClassName,
                                                                children: "Serijska št."
                                                            }, void 0, false, {
                                                                fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                                lineNumber: 3035,
                                                                columnNumber: 19
                                                            }, this),
                                                            /*#__PURE__*/ jsxDEV("th", {
                                                                className: adminTableHeaderCellCenterClassName,
                                                                children: "Status"
                                                            }, void 0, false, {
                                                                fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                                lineNumber: 3036,
                                                                columnNumber: 19
                                                            }, this),
                                                            /*#__PURE__*/ jsxDEV("th", {
                                                                className: adminTableHeaderCellCenterClassName,
                                                                children: "Naročilo"
                                                            }, void 0, false, {
                                                                fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                                lineNumber: 3037,
                                                                columnNumber: 19
                                                            }, this),
                                                            /*#__PURE__*/ jsxDEV("th", {
                                                                className: adminTableHeaderCellCenterClassName,
                                                                children: "Odpremljeno"
                                                            }, void 0, false, {
                                                                fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                                lineNumber: 3038,
                                                                columnNumber: 19
                                                            }, this)
                                                        ]
                                                    }, void 0, true, {
                                                        fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                        lineNumber: 3031,
                                                        columnNumber: 17
                                                    }, this)
                                                }, void 0, false, {
                                                    fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                    lineNumber: 3030,
                                                    columnNumber: 15
                                                }, this),
                                                /*#__PURE__*/ jsxDEV("tbody", {
                                                    children: data.serialNumbers.length > 0 ? data.serialNumbers.map((row)=>{
                                                        const inferredOrder = serialOrderAllocations.get(row.id);
                                                        const effectiveStatus = inferredOrder ? 'sold' : row.status;
                                                        return /*#__PURE__*/ jsxDEV("tr", {
                                                            className: `${adminTableRowHeightClassName} border-t border-slate-100`,
                                                            children: [
                                                                /*#__PURE__*/ jsxDEV("td", {
                                                                    className: `${adminTableBodyCellCenterClassName} px-2`,
                                                                    children: editable ? /*#__PURE__*/ jsxDEV(AdminCheckbox, {
                                                                        checked: selectedSerialIds.has(row.id),
                                                                        onChange: ()=>toggleSerialSelection(row.id)
                                                                    }, void 0, false, {
                                                                        fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                                        lineNumber: 3048,
                                                                        columnNumber: 37
                                                                    }, this) : /*#__PURE__*/ jsxDEV(DisabledSelectionCheckbox, {}, void 0, false, {
                                                                        fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                                        lineNumber: 3048,
                                                                        columnNumber: 144
                                                                    }, this)
                                                                }, void 0, false, {
                                                                    fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                                    lineNumber: 3047,
                                                                    columnNumber: 23
                                                                }, this),
                                                                /*#__PURE__*/ jsxDEV("td", {
                                                                    className: adminTableBodyCellLeftClassName,
                                                                    children: editable ? /*#__PURE__*/ jsxDEV("input", {
                                                                        className: `${adminTableInlineEditInputClassName} font-semibold`,
                                                                        value: row.serialNumber,
                                                                        onChange: (event)=>updateSerial(row.id, {
                                                                                serialNumber: event.target.value
                                                                            })
                                                                    }, void 0, false, {
                                                                        fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                                        lineNumber: 3052,
                                                                        columnNumber: 27
                                                                    }, this) : /*#__PURE__*/ jsxDEV(ReadOnlyTableField, {
                                                                        value: row.serialNumber,
                                                                        className: "w-full text-[12px] font-semibold"
                                                                    }, void 0, false, {
                                                                        fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                                        lineNumber: 3058,
                                                                        columnNumber: 27
                                                                    }, this)
                                                                }, void 0, false, {
                                                                    fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                                    lineNumber: 3050,
                                                                    columnNumber: 23
                                                                }, this),
                                                                /*#__PURE__*/ jsxDEV("td", {
                                                                    className: adminTableBodyCellCenterClassName,
                                                                    children: /*#__PURE__*/ jsxDEV(MachineSerialStatusSelect, {
                                                                        value: effectiveStatus,
                                                                        editable: editable && !inferredOrder,
                                                                        onChange: (status)=>updateSerial(row.id, {
                                                                                status
                                                                            })
                                                                    }, void 0, false, {
                                                                        fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                                        lineNumber: 3062,
                                                                        columnNumber: 25
                                                                    }, this)
                                                                }, void 0, false, {
                                                                    fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                                    lineNumber: 3061,
                                                                    columnNumber: 23
                                                                }, this),
                                                                /*#__PURE__*/ jsxDEV("td", {
                                                                    className: `${adminTableBodyCellCenterClassName} font-semibold`,
                                                                    children: inferredOrder ? /*#__PURE__*/ jsxDEV("a", {
                                                                        href: `/admin/orders/${inferredOrder.orderId}`,
                                                                        className: "text-slate-900 underline-offset-2 hover:text-[#1982bf] hover:underline",
                                                                        children: inferredOrder.orderNumber
                                                                    }, void 0, false, {
                                                                        fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                                        lineNumber: 3070,
                                                                        columnNumber: 27
                                                                    }, this) : /*#__PURE__*/ jsxDEV("span", {
                                                                        className: "text-slate-400",
                                                                        children: "–"
                                                                    }, void 0, false, {
                                                                        fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                                        lineNumber: 3077,
                                                                        columnNumber: 27
                                                                    }, this)
                                                                }, void 0, false, {
                                                                    fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                                    lineNumber: 3068,
                                                                    columnNumber: 23
                                                                }, this),
                                                                /*#__PURE__*/ jsxDEV("td", {
                                                                    className: `${adminTableBodyCellCenterClassName} whitespace-nowrap tabular-nums`,
                                                                    children: inferredOrder?.shippedAt ? /*#__PURE__*/ jsxDEV("span", {
                                                                        className: "font-medium text-slate-700",
                                                                        children: formatMachineSerialDate(inferredOrder.shippedAt)
                                                                    }, void 0, false, {
                                                                        fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                                        lineNumber: 3082,
                                                                        columnNumber: 27
                                                                    }, this) : /*#__PURE__*/ jsxDEV("span", {
                                                                        className: "text-slate-400",
                                                                        children: "–"
                                                                    }, void 0, false, {
                                                                        fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                                        lineNumber: 3084,
                                                                        columnNumber: 27
                                                                    }, this)
                                                                }, void 0, false, {
                                                                    fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                                    lineNumber: 3080,
                                                                    columnNumber: 23
                                                                }, this)
                                                            ]
                                                        }, row.id, true, {
                                                            fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                            lineNumber: 3046,
                                                            columnNumber: 21
                                                        }, this);
                                                    }) : /*#__PURE__*/ jsxDEV("tr", {
                                                        className: `${adminTableRowHeightClassName} border-t border-slate-100`,
                                                        children: /*#__PURE__*/ jsxDEV("td", {
                                                            colSpan: 5,
                                                            className: "h-12 px-3 py-0 align-middle text-[12px] font-medium text-slate-500",
                                                            children: "Ni dodanih serijskih številk."
                                                        }, void 0, false, {
                                                            fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                            lineNumber: 3091,
                                                            columnNumber: 21
                                                        }, this)
                                                    }, void 0, false, {
                                                        fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                        lineNumber: 3090,
                                                        columnNumber: 19
                                                    }, this)
                                                }, void 0, false, {
                                                    fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                    lineNumber: 3041,
                                                    columnNumber: 15
                                                }, this)
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                            lineNumber: 3029,
                                            columnNumber: 13
                                        }, this)
                                    }, void 0, false, {
                                        fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                        lineNumber: 3028,
                                        columnNumber: 11
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                lineNumber: 3010,
                                columnNumber: 9
                            }, this),
                            /*#__PURE__*/ jsxDEV("section", {
                                className: "flex h-[180px] flex-none flex-col overflow-hidden rounded-lg border border-slate-200 bg-white",
                                children: [
                                    /*#__PURE__*/ jsxDEV("div", {
                                        className: "flex h-12 items-center justify-between gap-3 border-b border-slate-200 px-4",
                                        children: [
                                            /*#__PURE__*/ jsxDEV("h3", {
                                                className: "text-sm font-semibold text-slate-900",
                                                children: "Komplet vsebuje"
                                            }, void 0, false, {
                                                fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                lineNumber: 3101,
                                                columnNumber: 13
                                            }, this),
                                            /*#__PURE__*/ jsxDEV("div", {
                                                className: "flex items-center gap-2",
                                                children: [
                                                    /*#__PURE__*/ jsxDEV(IconButton, {
                                                        type: "button",
                                                        tone: "neutral",
                                                        className: adminTableNeutralIconButtonClassName,
                                                        disabled: !editable,
                                                        onClick: ()=>update({
                                                                includedItems: [
                                                                    ...data.includedItems,
                                                                    ''
                                                                ]
                                                            }),
                                                        "aria-label": "Dodaj postavko",
                                                        title: "Dodaj postavko",
                                                        children: /*#__PURE__*/ jsxDEV(PlusIcon, {}, void 0, false, {
                                                            fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                            lineNumber: 3103,
                                                            columnNumber: 248
                                                        }, this)
                                                    }, void 0, false, {
                                                        fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                        lineNumber: 3103,
                                                        columnNumber: 15
                                                    }, this),
                                                    /*#__PURE__*/ jsxDEV(IconButton, {
                                                        type: "button",
                                                        tone: hasSelectedIncludedItems ? 'danger' : 'neutral',
                                                        className: hasSelectedIncludedItems ? adminTableSelectedDangerIconButtonClassName : adminTableNeutralIconButtonClassName,
                                                        disabled: !editable || !hasSelectedIncludedItems,
                                                        onClick: removeSelectedIncludedItems,
                                                        "aria-label": "Odstrani izbrane postavke",
                                                        title: "Odstrani izbrane",
                                                        children: /*#__PURE__*/ jsxDEV(TrashCanIcon, {}, void 0, false, {
                                                            fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                            lineNumber: 3113,
                                                            columnNumber: 17
                                                        }, this)
                                                    }, void 0, false, {
                                                        fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                        lineNumber: 3104,
                                                        columnNumber: 15
                                                    }, this)
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                lineNumber: 3102,
                                                columnNumber: 13
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                        lineNumber: 3100,
                                        columnNumber: 11
                                    }, this),
                                    /*#__PURE__*/ jsxDEV("div", {
                                        className: "min-h-0 flex-1 divide-y divide-slate-100 overflow-y-auto",
                                        children: data.includedItems.length > 0 ? data.includedItems.map((entry, index)=>/*#__PURE__*/ jsxDEV("div", {
                                                className: "grid grid-cols-[24px_minmax(0,1fr)] items-center gap-3 px-4 py-1.5",
                                                children: [
                                                    /*#__PURE__*/ jsxDEV("span", {
                                                        className: "flex h-[30px] items-center justify-center",
                                                        children: editable ? /*#__PURE__*/ jsxDEV(AdminCheckbox, {
                                                            checked: selectedIncludedIndexes.has(index),
                                                            onChange: ()=>toggleIncludedSelection(index)
                                                        }, void 0, false, {
                                                            fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                            lineNumber: 3122,
                                                            columnNumber: 21
                                                        }, this) : /*#__PURE__*/ jsxDEV(IncludedItemReadTick, {}, void 0, false, {
                                                            fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                            lineNumber: 3124,
                                                            columnNumber: 21
                                                        }, this)
                                                    }, void 0, false, {
                                                        fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                        lineNumber: 3120,
                                                        columnNumber: 17
                                                    }, this),
                                                    editable ? /*#__PURE__*/ jsxDEV("input", {
                                                        className: compactInfoFieldFrameClassName,
                                                        value: entry,
                                                        onChange: (event)=>updateIncludedItem(index, event.target.value)
                                                    }, void 0, false, {
                                                        fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                        lineNumber: 3128,
                                                        columnNumber: 19
                                                    }, this) : /*#__PURE__*/ jsxDEV(ReadOnlyCompactField, {
                                                        value: entry
                                                    }, void 0, false, {
                                                        fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                        lineNumber: 3130,
                                                        columnNumber: 19
                                                    }, this)
                                                ]
                                            }, `included-${index}`, true, {
                                                fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                lineNumber: 3119,
                                                columnNumber: 15
                                            }, this)) : /*#__PURE__*/ jsxDEV("div", {
                                            className: "px-4 py-4 text-[13px] font-medium text-slate-500",
                                            children: "Ni dodanih postavk."
                                        }, void 0, false, {
                                            fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                            lineNumber: 3134,
                                            columnNumber: 15
                                        }, this)
                                    }, void 0, false, {
                                        fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                        lineNumber: 3117,
                                        columnNumber: 11
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                lineNumber: 3099,
                                columnNumber: 9
                            }, this),
                            /*#__PURE__*/ jsxDEV("section", {
                                className: "flex h-[180px] flex-none flex-col rounded-lg border border-orange-200 bg-orange-50/45 p-4",
                                children: [
                                    /*#__PURE__*/ jsxDEV("div", {
                                        className: "mb-3 flex items-center gap-2 text-orange-600",
                                        children: [
                                            /*#__PURE__*/ jsxDEV("svg", {
                                                "aria-hidden": "true",
                                                className: "h-5 w-5 shrink-0",
                                                viewBox: "0 0 24 24",
                                                fill: "none",
                                                stroke: "currentColor",
                                                strokeWidth: 2,
                                                strokeLinecap: "round",
                                                strokeLinejoin: "round",
                                                children: [
                                                    /*#__PURE__*/ jsxDEV("path", {
                                                        d: "m21.73 18-8-14a2 2 0 0 0-3.46 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"
                                                    }, void 0, false, {
                                                        fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                        lineNumber: 3151,
                                                        columnNumber: 15
                                                    }, this),
                                                    /*#__PURE__*/ jsxDEV("path", {
                                                        d: "M12 9v4"
                                                    }, void 0, false, {
                                                        fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                        lineNumber: 3152,
                                                        columnNumber: 15
                                                    }, this),
                                                    /*#__PURE__*/ jsxDEV("path", {
                                                        d: "M12 17h.01"
                                                    }, void 0, false, {
                                                        fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                        lineNumber: 3153,
                                                        columnNumber: 15
                                                    }, this)
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                lineNumber: 3141,
                                                columnNumber: 13
                                            }, this),
                                            /*#__PURE__*/ jsxDEV("h3", {
                                                className: "text-sm font-semibold",
                                                children: "Posebna opozorila"
                                            }, void 0, false, {
                                                fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                lineNumber: 3155,
                                                columnNumber: 13
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                        lineNumber: 3140,
                                        columnNumber: 11
                                    }, this),
                                    /*#__PURE__*/ jsxDEV("textarea", {
                                        className: `${fieldFrameClassName} min-h-0 flex-1 resize-none border-orange-200 bg-white px-4 py-3 text-[13px] leading-6 text-slate-700 shadow-sm focus:border-orange-300 focus:ring-orange-100`,
                                        value: data.warnings,
                                        disabled: !editable,
                                        onChange: (event)=>update({
                                                warnings: event.target.value
                                            })
                                    }, void 0, false, {
                                        fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                        lineNumber: 3157,
                                        columnNumber: 11
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                lineNumber: 3139,
                                columnNumber: 9
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                        lineNumber: 3009,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ jsxDEV("section", {
                        className: "overflow-hidden rounded-lg border border-slate-200 bg-white",
                        children: [
                            /*#__PURE__*/ jsxDEV("div", {
                                className: "flex items-center justify-between gap-2 px-4 py-3",
                                children: [
                                    /*#__PURE__*/ jsxDEV("div", {
                                        children: /*#__PURE__*/ jsxDEV("h3", {
                                            className: "text-sm font-semibold text-slate-900",
                                            children: "Osnovne informacije"
                                        }, void 0, false, {
                                            fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                            lineNumber: 3169,
                                            columnNumber: 15
                                        }, this)
                                    }, void 0, false, {
                                        fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                        lineNumber: 3168,
                                        columnNumber: 13
                                    }, this),
                                    /*#__PURE__*/ jsxDEV("div", {
                                        className: "flex items-center gap-2",
                                        children: [
                                            /*#__PURE__*/ jsxDEV(IconButton, {
                                                type: "button",
                                                tone: "neutral",
                                                className: adminTableNeutralIconButtonClassName,
                                                disabled: !editable,
                                                onClick: addBasicInfoRow,
                                                "aria-label": "Dodaj osnovno informacijo",
                                                title: "Dodaj osnovno informacijo",
                                                children: /*#__PURE__*/ jsxDEV(PlusIcon, {}, void 0, false, {
                                                    fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                    lineNumber: 3172,
                                                    columnNumber: 225
                                                }, this)
                                            }, void 0, false, {
                                                fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                lineNumber: 3172,
                                                columnNumber: 15
                                            }, this),
                                            /*#__PURE__*/ jsxDEV(IconButton, {
                                                type: "button",
                                                tone: hasSelectedBasicInfo ? 'danger' : 'neutral',
                                                className: hasSelectedBasicInfo ? adminTableSelectedDangerIconButtonClassName : adminTableNeutralIconButtonClassName,
                                                disabled: !editable || !hasSelectedBasicInfo,
                                                onClick: removeSelectedBasicInfoRows,
                                                "aria-label": "Odstrani izbrane osnovne informacije",
                                                title: "Odstrani izbrane",
                                                children: /*#__PURE__*/ jsxDEV(TrashCanIcon, {}, void 0, false, {
                                                    fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                    lineNumber: 3182,
                                                    columnNumber: 17
                                                }, this)
                                            }, void 0, false, {
                                                fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                lineNumber: 3173,
                                                columnNumber: 15
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                        lineNumber: 3171,
                                        columnNumber: 13
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                lineNumber: 3167,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ jsxDEV("div", {
                                className: "overflow-x-auto border-t border-slate-200",
                                children: /*#__PURE__*/ jsxDEV("table", {
                                    className: "min-w-full text-[12px]",
                                    children: [
                                        /*#__PURE__*/ jsxDEV("thead", {
                                            className: "bg-[color:var(--admin-table-header-bg)]",
                                            children: /*#__PURE__*/ jsxDEV("tr", {
                                                children: [
                                                    /*#__PURE__*/ jsxDEV("th", {
                                                        className: "w-10 px-2 py-2 text-center",
                                                        children: /*#__PURE__*/ jsxDEV(AdminCheckbox, {
                                                            checked: editable && allBasicInfoSelected,
                                                            disabled: !editable || data.basicInfoRows.length === 0,
                                                            onChange: toggleAllBasicInfo
                                                        }, void 0, false, {
                                                            fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                            lineNumber: 3191,
                                                            columnNumber: 19
                                                        }, this)
                                                    }, void 0, false, {
                                                        fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                        lineNumber: 3190,
                                                        columnNumber: 17
                                                    }, this),
                                                    /*#__PURE__*/ jsxDEV("th", {
                                                        className: tableHeaderClassName,
                                                        children: "Lastnost"
                                                    }, void 0, false, {
                                                        fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                        lineNumber: 3193,
                                                        columnNumber: 17
                                                    }, this),
                                                    /*#__PURE__*/ jsxDEV("th", {
                                                        className: tableHeaderClassName,
                                                        children: "Vrednost"
                                                    }, void 0, false, {
                                                        fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                        lineNumber: 3194,
                                                        columnNumber: 17
                                                    }, this)
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                lineNumber: 3189,
                                                columnNumber: 15
                                            }, this)
                                        }, void 0, false, {
                                            fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                            lineNumber: 3188,
                                            columnNumber: 13
                                        }, this),
                                        /*#__PURE__*/ jsxDEV("tbody", {
                                            children: [
                                                /*#__PURE__*/ jsxDEV("tr", {
                                                    className: "border-t border-slate-100",
                                                    children: [
                                                        /*#__PURE__*/ jsxDEV("td", {
                                                            className: "px-2 py-1.5 text-center",
                                                            "aria-hidden": "true",
                                                            children: /*#__PURE__*/ jsxDEV(DisabledSelectionCheckbox, {}, void 0, false, {
                                                                fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                                lineNumber: 3199,
                                                                columnNumber: 76
                                                            }, this)
                                                        }, void 0, false, {
                                                            fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                            lineNumber: 3199,
                                                            columnNumber: 17
                                                        }, this),
                                                        /*#__PURE__*/ jsxDEV("td", {
                                                            className: compactInfoTableCellClassName,
                                                            children: "Cena (z DDV)"
                                                        }, void 0, false, {
                                                            fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                            lineNumber: 3200,
                                                            columnNumber: 17
                                                        }, this),
                                                        /*#__PURE__*/ jsxDEV("td", {
                                                            className: compactInfoTableCellClassName,
                                                            children: /*#__PURE__*/ jsxDEV(NumberField, {
                                                                label: "",
                                                                value: data.basePrice,
                                                                suffix: "€",
                                                                compact: true,
                                                                editable: editable,
                                                                onChange: (value)=>update({
                                                                        basePrice: value
                                                                    })
                                                            }, void 0, false, {
                                                                fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                                lineNumber: 3202,
                                                                columnNumber: 19
                                                            }, this)
                                                        }, void 0, false, {
                                                            fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                            lineNumber: 3201,
                                                            columnNumber: 17
                                                        }, this)
                                                    ]
                                                }, void 0, true, {
                                                    fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                    lineNumber: 3198,
                                                    columnNumber: 17
                                                }, this),
                                                /*#__PURE__*/ jsxDEV("tr", {
                                                    className: "border-t border-slate-100",
                                                    children: [
                                                        /*#__PURE__*/ jsxDEV("td", {
                                                            className: "px-2 py-1.5 text-center",
                                                            "aria-hidden": "true",
                                                            children: /*#__PURE__*/ jsxDEV(DisabledSelectionCheckbox, {}, void 0, false, {
                                                                fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                                lineNumber: 3206,
                                                                columnNumber: 76
                                                            }, this)
                                                        }, void 0, false, {
                                                            fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                            lineNumber: 3206,
                                                            columnNumber: 17
                                                        }, this),
                                                        /*#__PURE__*/ jsxDEV("td", {
                                                            className: compactInfoTableCellClassName,
                                                            children: "Zaloga"
                                                        }, void 0, false, {
                                                            fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                            lineNumber: 3207,
                                                            columnNumber: 17
                                                        }, this),
                                                        /*#__PURE__*/ jsxDEV("td", {
                                                            className: compactInfoTableCellClassName,
                                                            children: /*#__PURE__*/ jsxDEV(IntegerUnitField, {
                                                                value: data.stock,
                                                                unitKind: "piece",
                                                                compact: true,
                                                                editable: editable,
                                                                onChange: (value)=>update({
                                                                        stock: value
                                                                    })
                                                            }, void 0, false, {
                                                                fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                                lineNumber: 3209,
                                                                columnNumber: 19
                                                            }, this)
                                                        }, void 0, false, {
                                                            fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                            lineNumber: 3208,
                                                            columnNumber: 17
                                                        }, this)
                                                    ]
                                                }, void 0, true, {
                                                    fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                    lineNumber: 3205,
                                                    columnNumber: 15
                                                }, this),
                                                /*#__PURE__*/ jsxDEV("tr", {
                                                    className: "border-t border-slate-100",
                                                    children: [
                                                        /*#__PURE__*/ jsxDEV("td", {
                                                            className: "px-2 py-1.5 text-center",
                                                            "aria-hidden": "true",
                                                            children: /*#__PURE__*/ jsxDEV(DisabledSelectionCheckbox, {}, void 0, false, {
                                                                fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                                lineNumber: 3213,
                                                                columnNumber: 76
                                                            }, this)
                                                        }, void 0, false, {
                                                            fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                            lineNumber: 3213,
                                                            columnNumber: 17
                                                        }, this),
                                                        /*#__PURE__*/ jsxDEV("td", {
                                                            className: compactInfoTableCellClassName,
                                                            children: "Dobavni rok"
                                                        }, void 0, false, {
                                                            fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                            lineNumber: 3214,
                                                            columnNumber: 17
                                                        }, this),
                                                        /*#__PURE__*/ jsxDEV("td", {
                                                            className: compactInfoTableCellClassName,
                                                            children: /*#__PURE__*/ jsxDEV(QuantityRangeUnitField, {
                                                                value: data.deliveryTime,
                                                                unitKind: "workday",
                                                                compact: true,
                                                                editable: editable,
                                                                onChange: (value)=>update({
                                                                        deliveryTime: formatQuantityRangeWithUnit(value, 'workday')
                                                                    })
                                                            }, void 0, false, {
                                                                fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                                lineNumber: 3216,
                                                                columnNumber: 19
                                                            }, this)
                                                        }, void 0, false, {
                                                            fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                            lineNumber: 3215,
                                                            columnNumber: 17
                                                        }, this)
                                                    ]
                                                }, void 0, true, {
                                                    fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                    lineNumber: 3212,
                                                    columnNumber: 15
                                                }, this),
                                                /*#__PURE__*/ jsxDEV("tr", {
                                                    className: "border-t border-slate-100",
                                                    children: [
                                                        /*#__PURE__*/ jsxDEV("td", {
                                                            className: compactInfoCheckboxCellClassName,
                                                            children: /*#__PURE__*/ jsxDEV(DisabledSelectionCheckbox, {}, void 0, false, {
                                                                fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                                lineNumber: 3220,
                                                                columnNumber: 66
                                                            }, this)
                                                        }, void 0, false, {
                                                            fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                            lineNumber: 3220,
                                                            columnNumber: 17
                                                        }, this),
                                                        /*#__PURE__*/ jsxDEV("td", {
                                                            className: compactInfoTableCellClassName,
                                                            children: editable ? /*#__PURE__*/ jsxDEV("input", {
                                                                className: compactInfoFieldFrameClassName,
                                                                value: data.warrantyLabel ?? 'Garancija',
                                                                onChange: (event)=>update({
                                                                        warrantyLabel: event.target.value
                                                                    })
                                                            }, void 0, false, {
                                                                fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                                lineNumber: 3222,
                                                                columnNumber: 31
                                                            }, this) : /*#__PURE__*/ jsxDEV(ReadOnlyCompactField, {
                                                                value: data.warrantyLabel || 'Garancija'
                                                            }, void 0, false, {
                                                                fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                                lineNumber: 3222,
                                                                columnNumber: 196
                                                            }, this)
                                                        }, void 0, false, {
                                                            fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                            lineNumber: 3221,
                                                            columnNumber: 17
                                                        }, this),
                                                        /*#__PURE__*/ jsxDEV("td", {
                                                            className: compactInfoTableCellClassName,
                                                            children: /*#__PURE__*/ jsxDEV(QuantityRangeUnitField, {
                                                                value: data.warrantyMonths,
                                                                unitKind: "month",
                                                                compact: true,
                                                                editable: editable,
                                                                onChange: (value)=>update({
                                                                        warrantyMonths: value
                                                                    })
                                                            }, void 0, false, {
                                                                fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                                lineNumber: 3225,
                                                                columnNumber: 19
                                                            }, this)
                                                        }, void 0, false, {
                                                            fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                            lineNumber: 3224,
                                                            columnNumber: 17
                                                        }, this)
                                                    ]
                                                }, void 0, true, {
                                                    fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                    lineNumber: 3219,
                                                    columnNumber: 15
                                                }, this),
                                                /*#__PURE__*/ jsxDEV("tr", {
                                                    className: "border-t border-slate-100",
                                                    children: [
                                                        /*#__PURE__*/ jsxDEV("td", {
                                                            className: compactInfoCheckboxCellClassName,
                                                            children: /*#__PURE__*/ jsxDEV(DisabledSelectionCheckbox, {}, void 0, false, {
                                                                fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                                lineNumber: 3229,
                                                                columnNumber: 66
                                                            }, this)
                                                        }, void 0, false, {
                                                            fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                            lineNumber: 3229,
                                                            columnNumber: 17
                                                        }, this),
                                                        /*#__PURE__*/ jsxDEV("td", {
                                                            className: compactInfoTableCellClassName,
                                                            children: editable ? /*#__PURE__*/ jsxDEV("input", {
                                                                className: compactInfoFieldFrameClassName,
                                                                value: data.serviceIntervalLabel ?? 'Servisni interval',
                                                                onChange: (event)=>update({
                                                                        serviceIntervalLabel: event.target.value
                                                                    })
                                                            }, void 0, false, {
                                                                fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                                lineNumber: 3231,
                                                                columnNumber: 31
                                                            }, this) : /*#__PURE__*/ jsxDEV(ReadOnlyCompactField, {
                                                                value: data.serviceIntervalLabel || 'Servisni interval'
                                                            }, void 0, false, {
                                                                fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                                lineNumber: 3231,
                                                                columnNumber: 218
                                                            }, this)
                                                        }, void 0, false, {
                                                            fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                            lineNumber: 3230,
                                                            columnNumber: 17
                                                        }, this),
                                                        /*#__PURE__*/ jsxDEV("td", {
                                                            className: compactInfoTableCellClassName,
                                                            children: /*#__PURE__*/ jsxDEV(QuantityRangeUnitField, {
                                                                value: data.serviceIntervalMonths,
                                                                unitKind: "month",
                                                                compact: true,
                                                                editable: editable,
                                                                onChange: (value)=>update({
                                                                        serviceIntervalMonths: value
                                                                    })
                                                            }, void 0, false, {
                                                                fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                                lineNumber: 3234,
                                                                columnNumber: 19
                                                            }, this)
                                                        }, void 0, false, {
                                                            fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                            lineNumber: 3233,
                                                            columnNumber: 17
                                                        }, this)
                                                    ]
                                                }, void 0, true, {
                                                    fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                    lineNumber: 3228,
                                                    columnNumber: 15
                                                }, this),
                                                data.basicInfoRows.map((row)=>/*#__PURE__*/ jsxDEV("tr", {
                                                        className: "border-t border-slate-100",
                                                        children: [
                                                            /*#__PURE__*/ jsxDEV("td", {
                                                                className: compactInfoCheckboxCellClassName,
                                                                children: editable ? /*#__PURE__*/ jsxDEV(AdminCheckbox, {
                                                                    checked: selectedBasicInfoIds.has(row.id),
                                                                    onChange: ()=>toggleBasicInfoSelection(row.id)
                                                                }, void 0, false, {
                                                                    fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                                    lineNumber: 3240,
                                                                    columnNumber: 33
                                                                }, this) : /*#__PURE__*/ jsxDEV(DisabledSelectionCheckbox, {}, void 0, false, {
                                                                    fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                                    lineNumber: 3240,
                                                                    columnNumber: 146
                                                                }, this)
                                                            }, void 0, false, {
                                                                fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                                lineNumber: 3239,
                                                                columnNumber: 19
                                                            }, this),
                                                            /*#__PURE__*/ jsxDEV("td", {
                                                                className: compactInfoTableCellClassName,
                                                                children: editable ? /*#__PURE__*/ jsxDEV("input", {
                                                                    className: compactInfoFieldFrameClassName,
                                                                    value: row.property,
                                                                    onChange: (event)=>updateBasicInfoRow(row.id, {
                                                                            property: event.target.value
                                                                        })
                                                                }, void 0, false, {
                                                                    fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                                    lineNumber: 3242,
                                                                    columnNumber: 77
                                                                }, this) : /*#__PURE__*/ jsxDEV(ReadOnlyCompactField, {
                                                                    value: row.property
                                                                }, void 0, false, {
                                                                    fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                                    lineNumber: 3242,
                                                                    columnNumber: 236
                                                                }, this)
                                                            }, void 0, false, {
                                                                fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                                lineNumber: 3242,
                                                                columnNumber: 19
                                                            }, this),
                                                            /*#__PURE__*/ jsxDEV("td", {
                                                                className: compactInfoTableCellClassName,
                                                                children: /*#__PURE__*/ jsxDEV(SpecValueField, {
                                                                    value: row.value,
                                                                    compact: true,
                                                                    editable: editable,
                                                                    onChange: (value)=>updateBasicInfoRow(row.id, {
                                                                            value
                                                                        })
                                                                }, void 0, false, {
                                                                    fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                                    lineNumber: 3243,
                                                                    columnNumber: 65
                                                                }, this)
                                                            }, void 0, false, {
                                                                fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                                lineNumber: 3243,
                                                                columnNumber: 19
                                                            }, this)
                                                        ]
                                                    }, row.id, true, {
                                                        fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                        lineNumber: 3238,
                                                        columnNumber: 17
                                                    }, this))
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                            lineNumber: 3197,
                                            columnNumber: 15
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                    lineNumber: 3187,
                                    columnNumber: 11
                                }, this)
                            }, void 0, false, {
                                fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                lineNumber: 3186,
                                columnNumber: 9
                            }, this),
                            /*#__PURE__*/ jsxDEV("div", {
                                className: "flex items-center justify-between gap-2 border-t border-slate-200 px-4 py-3",
                                children: [
                                    /*#__PURE__*/ jsxDEV("div", {
                                        children: /*#__PURE__*/ jsxDEV("h3", {
                                            className: "text-sm font-semibold text-slate-900",
                                            children: "Tehnične specifikacije"
                                        }, void 0, false, {
                                            fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                            lineNumber: 3252,
                                            columnNumber: 13
                                        }, this)
                                    }, void 0, false, {
                                        fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                        lineNumber: 3251,
                                        columnNumber: 11
                                    }, this),
                                    /*#__PURE__*/ jsxDEV("div", {
                                        className: "flex items-center gap-2",
                                        children: [
                                            /*#__PURE__*/ jsxDEV(IconButton, {
                                                type: "button",
                                                tone: "neutral",
                                                className: adminTableNeutralIconButtonClassName,
                                                disabled: !editable,
                                                onClick: addSpec,
                                                "aria-label": "Dodaj specifikacijo",
                                                title: "Dodaj specifikacijo",
                                                children: /*#__PURE__*/ jsxDEV(PlusIcon, {}, void 0, false, {
                                                    fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                    lineNumber: 3255,
                                                    columnNumber: 203
                                                }, this)
                                            }, void 0, false, {
                                                fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                lineNumber: 3255,
                                                columnNumber: 13
                                            }, this),
                                            /*#__PURE__*/ jsxDEV(IconButton, {
                                                type: "button",
                                                tone: hasSelectedSpecs ? 'danger' : 'neutral',
                                                className: hasSelectedSpecs ? adminTableSelectedDangerIconButtonClassName : adminTableNeutralIconButtonClassName,
                                                disabled: !editable || !hasSelectedSpecs,
                                                onClick: removeSelectedSpecs,
                                                "aria-label": "Odstrani izbrane specifikacije",
                                                title: "Odstrani izbrane",
                                                children: /*#__PURE__*/ jsxDEV(TrashCanIcon, {}, void 0, false, {
                                                    fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                    lineNumber: 3265,
                                                    columnNumber: 15
                                                }, this)
                                            }, void 0, false, {
                                                fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                lineNumber: 3256,
                                                columnNumber: 13
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                        lineNumber: 3254,
                                        columnNumber: 11
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                lineNumber: 3250,
                                columnNumber: 9
                            }, this),
                            /*#__PURE__*/ jsxDEV("div", {
                                className: "overflow-x-auto border-t border-slate-200",
                                children: /*#__PURE__*/ jsxDEV("table", {
                                    className: "min-w-full text-[12px]",
                                    children: [
                                        /*#__PURE__*/ jsxDEV("thead", {
                                            className: "bg-[color:var(--admin-table-header-bg)]",
                                            children: /*#__PURE__*/ jsxDEV("tr", {
                                                children: [
                                                    /*#__PURE__*/ jsxDEV("th", {
                                                        className: "w-10 px-2 py-2 text-center",
                                                        children: /*#__PURE__*/ jsxDEV(AdminCheckbox, {
                                                            checked: editable && allSpecsSelected,
                                                            disabled: !editable || data.specs.length === 0,
                                                            onChange: toggleAllSpecs
                                                        }, void 0, false, {
                                                            fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                            lineNumber: 3274,
                                                            columnNumber: 19
                                                        }, this)
                                                    }, void 0, false, {
                                                        fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                        lineNumber: 3273,
                                                        columnNumber: 17
                                                    }, this),
                                                    /*#__PURE__*/ jsxDEV("th", {
                                                        className: tableHeaderClassName,
                                                        children: "Lastnost"
                                                    }, void 0, false, {
                                                        fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                        lineNumber: 3276,
                                                        columnNumber: 17
                                                    }, this),
                                                    /*#__PURE__*/ jsxDEV("th", {
                                                        className: tableHeaderClassName,
                                                        children: "Vrednost"
                                                    }, void 0, false, {
                                                        fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                        lineNumber: 3277,
                                                        columnNumber: 17
                                                    }, this)
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                lineNumber: 3272,
                                                columnNumber: 15
                                            }, this)
                                        }, void 0, false, {
                                            fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                            lineNumber: 3271,
                                            columnNumber: 13
                                        }, this),
                                        /*#__PURE__*/ jsxDEV("tbody", {
                                            children: [
                                                /*#__PURE__*/ jsxDEV("tr", {
                                                    className: "border-t border-slate-100",
                                                    children: [
                                                        /*#__PURE__*/ jsxDEV("td", {
                                                            className: "px-2 py-1.5 text-center",
                                                            "aria-hidden": "true",
                                                            children: /*#__PURE__*/ jsxDEV(DisabledSelectionCheckbox, {}, void 0, false, {
                                                                fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                                lineNumber: 3282,
                                                                columnNumber: 76
                                                            }, this)
                                                        }, void 0, false, {
                                                            fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                            lineNumber: 3282,
                                                            columnNumber: 17
                                                        }, this),
                                                        /*#__PURE__*/ jsxDEV("td", {
                                                            className: compactInfoTableCellClassName,
                                                            children: "Dimenzije"
                                                        }, void 0, false, {
                                                            fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                            lineNumber: 3283,
                                                            columnNumber: 17
                                                        }, this),
                                                        /*#__PURE__*/ jsxDEV("td", {
                                                            className: compactInfoTableCellClassName,
                                                            children: /*#__PURE__*/ jsxDEV(PackageDimensionField, {
                                                                value: data.packageDimensions,
                                                                compact: true,
                                                                editable: editable,
                                                                onChange: (value)=>update({
                                                                        packageDimensions: value
                                                                    })
                                                            }, void 0, false, {
                                                                fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                                lineNumber: 3285,
                                                                columnNumber: 19
                                                            }, this)
                                                        }, void 0, false, {
                                                            fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                            lineNumber: 3284,
                                                            columnNumber: 17
                                                        }, this)
                                                    ]
                                                }, void 0, true, {
                                                    fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                    lineNumber: 3281,
                                                    columnNumber: 15
                                                }, this),
                                                data.specs.map((spec)=>/*#__PURE__*/ jsxDEV("tr", {
                                                        className: "border-t border-slate-100",
                                                        children: [
                                                            /*#__PURE__*/ jsxDEV("td", {
                                                                className: compactInfoCheckboxCellClassName,
                                                                children: editable ? /*#__PURE__*/ jsxDEV(AdminCheckbox, {
                                                                    checked: selectedSpecIds.has(spec.id),
                                                                    onChange: ()=>toggleSpecSelection(spec.id)
                                                                }, void 0, false, {
                                                                    fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                                    lineNumber: 3291,
                                                                    columnNumber: 33
                                                                }, this) : /*#__PURE__*/ jsxDEV(DisabledSelectionCheckbox, {}, void 0, false, {
                                                                    fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                                    lineNumber: 3291,
                                                                    columnNumber: 138
                                                                }, this)
                                                            }, void 0, false, {
                                                                fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                                lineNumber: 3290,
                                                                columnNumber: 19
                                                            }, this),
                                                            /*#__PURE__*/ jsxDEV("td", {
                                                                className: compactInfoTableCellClassName,
                                                                children: editable ? /*#__PURE__*/ jsxDEV("input", {
                                                                    className: compactInfoFieldFrameClassName,
                                                                    value: spec.property,
                                                                    onChange: (event)=>updateSpec(spec.id, {
                                                                            property: event.target.value
                                                                        })
                                                                }, void 0, false, {
                                                                    fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                                    lineNumber: 3293,
                                                                    columnNumber: 77
                                                                }, this) : /*#__PURE__*/ jsxDEV(ReadOnlyCompactField, {
                                                                    value: spec.property
                                                                }, void 0, false, {
                                                                    fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                                    lineNumber: 3293,
                                                                    columnNumber: 230
                                                                }, this)
                                                            }, void 0, false, {
                                                                fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                                lineNumber: 3293,
                                                                columnNumber: 19
                                                            }, this),
                                                            /*#__PURE__*/ jsxDEV("td", {
                                                                className: compactInfoTableCellClassName,
                                                                children: /*#__PURE__*/ jsxDEV(SpecValueField, {
                                                                    value: spec.value,
                                                                    compact: true,
                                                                    editable: editable,
                                                                    onChange: (value)=>updateSpec(spec.id, {
                                                                            value
                                                                        })
                                                                }, void 0, false, {
                                                                    fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                                    lineNumber: 3294,
                                                                    columnNumber: 65
                                                                }, this)
                                                            }, void 0, false, {
                                                                fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                                lineNumber: 3294,
                                                                columnNumber: 19
                                                            }, this)
                                                        ]
                                                    }, spec.id, true, {
                                                        fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                        lineNumber: 3289,
                                                        columnNumber: 17
                                                    }, this))
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                            lineNumber: 3280,
                                            columnNumber: 13
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                    lineNumber: 3270,
                                    columnNumber: 11
                                }, this)
                            }, void 0, false, {
                                fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                lineNumber: 3269,
                                columnNumber: 9
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                        lineNumber: 3166,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                lineNumber: 3008,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
        lineNumber: 3004,
        columnNumber: 5
    }, this);
}
_s3(UniqueMachineProductModule, "Wm0vgAafjGuzcJidJDkMp0DcdHE=");
function QuantityDiscountsCard({ editable, quantityDiscounts, onAddDiscount, onRemoveDiscount, onUpdateDiscount, simulatorOptions, usesScopedCommercialTools = true, embedded = false, minQuantityLabel = 'Min. količina', minQuantityUnitLabel, minQuantityAllowsDecimal = false, className }) {
    _s4();
    const [customerSuggestions, setCustomerSuggestions] = (0, useState)([]);
    const [selectedDiscountIds, setSelectedDiscountIds] = (0, useState)(new Set());
    const variantTargetSuggestions = (0, useMemo)({
        "QuantityDiscountsCard.useMemo[variantTargetSuggestions]": ()=>normalizeDiscountSuggestionList([
                allDiscountTargetLabel,
                ...simulatorOptions.map(getSimulatorOptionSku).filter(Boolean)
            ])
    }["QuantityDiscountsCard.useMemo[variantTargetSuggestions]"], [
        simulatorOptions
    ]);
    const customerTargetSuggestions = (0, useMemo)({
        "QuantityDiscountsCard.useMemo[customerTargetSuggestions]": ()=>normalizeDiscountSuggestionList([
                allDiscountTargetLabel,
                ...customerSuggestions
            ])
    }["QuantityDiscountsCard.useMemo[customerTargetSuggestions]"], [
        customerSuggestions
    ]);
    const allDiscountsSelected = quantityDiscounts.length > 0 && quantityDiscounts.every((rule)=>selectedDiscountIds.has(rule.id));
    const hasSelectedDiscounts = selectedDiscountIds.size > 0;
    const toggleDiscountSelection = (id)=>{
        setSelectedDiscountIds((current)=>{
            const next = new Set(current);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };
    const toggleAllDiscounts = ()=>{
        setSelectedDiscountIds(allDiscountsSelected ? new Set() : new Set(quantityDiscounts.map((rule)=>rule.id)));
    };
    const removeSelectedDiscounts = ()=>{
        if (!hasSelectedDiscounts) return;
        Array.from(selectedDiscountIds).forEach(onRemoveDiscount);
        setSelectedDiscountIds(new Set());
    };
    const showDiscountActions = embedded || editable;
    const discountCheckboxCellClassName = embedded ? 'px-2 py-1.5 text-center' : 'px-2 py-2 text-center';
    const discountTableCellClassName = embedded ? 'px-3 py-1.5' : 'px-3 py-2';
    const discountHeaderCheckboxCellClassName = embedded ? `${discountCheckboxColumnClassName} px-2 py-1.5 text-center` : `${discountCheckboxColumnClassName} px-2 py-2 text-center`;
    const discountHeaderCellClassName = embedded ? 'whitespace-nowrap px-3 py-1.5 text-[11px] font-semibold text-slate-700' : 'whitespace-nowrap px-3 py-2 font-semibold text-slate-700';
    const discountControlClassName = embedded ? '!text-[11px]' : '';
    const discountValueUnitShellClassName = compactTableThirtyValueUnitShellClassName;
    (0, useEffect)({
        "QuantityDiscountsCard.useEffect": ()=>{
            if (!usesScopedCommercialTools) return;
            let cancelled = false;
            void fetch('/api/admin/orders/customers', {
                cache: 'no-store'
            }).then({
                "QuantityDiscountsCard.useEffect": (response)=>response.ok ? response.json() : {
                        customers: []
                    }
            }["QuantityDiscountsCard.useEffect"]).then({
                "QuantityDiscountsCard.useEffect": (payload)=>{
                    if (cancelled) return;
                    const customers = Array.isArray(payload.customers) ? payload.customers.map({
                        "QuantityDiscountsCard.useEffect": (entry)=>String(entry).trim()
                    }["QuantityDiscountsCard.useEffect"]).filter(Boolean) : [];
                    setCustomerSuggestions(customers);
                }
            }["QuantityDiscountsCard.useEffect"]).catch({
                "QuantityDiscountsCard.useEffect": ()=>{
                    if (!cancelled) setCustomerSuggestions([]);
                }
            }["QuantityDiscountsCard.useEffect"]);
            return ({
                "QuantityDiscountsCard.useEffect": ()=>{
                    cancelled = true;
                }
            })["QuantityDiscountsCard.useEffect"];
        }
    }["QuantityDiscountsCard.useEffect"], [
        usesScopedCommercialTools
    ]);
    (0, useEffect)({
        "QuantityDiscountsCard.useEffect": ()=>{
            setSelectedDiscountIds({
                "QuantityDiscountsCard.useEffect": (current)=>{
                    const validIds = new Set(quantityDiscounts.map({
                        "QuantityDiscountsCard.useEffect": (rule)=>rule.id
                    }["QuantityDiscountsCard.useEffect"]));
                    const next = new Set(Array.from(current).filter({
                        "QuantityDiscountsCard.useEffect": (id)=>validIds.has(id)
                    }["QuantityDiscountsCard.useEffect"]));
                    return next.size === current.size ? current : next;
                }
            }["QuantityDiscountsCard.useEffect"]);
        }
    }["QuantityDiscountsCard.useEffect"], [
        quantityDiscounts
    ]);
    return /*#__PURE__*/ jsxDEV("section", {
        className: classNames(embedded ? 'border-t border-slate-200 bg-white' : adminWindowCardClassName, !embedded && 'h-full p-5', className),
        style: embedded ? undefined : adminWindowCardStyle,
        children: [
            /*#__PURE__*/ jsxDEV("div", {
                className: classNames('flex justify-between gap-3', embedded ? 'items-center border-b border-slate-200 px-4 py-3' : 'mb-3 items-start'),
                children: [
                    embedded ? /*#__PURE__*/ jsxDEV("h3", {
                        className: "text-sm font-semibold text-slate-900",
                        children: "Količinski popusti"
                    }, void 0, false, {
                        fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                        lineNumber: 3412,
                        columnNumber: 11
                    }, this) : /*#__PURE__*/ jsxDEV("div", {
                        children: [
                            /*#__PURE__*/ jsxDEV("h2", {
                                className: sectionTitleClassName,
                                children: "Količinski popusti"
                            }, void 0, false, {
                                fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                lineNumber: 3415,
                                columnNumber: 13
                            }, this),
                            /*#__PURE__*/ jsxDEV("p", {
                                className: "mt-1 text-[13px] font-medium text-slate-500",
                                children: "Privzeta pravila za popust glede na količino naročila."
                            }, void 0, false, {
                                fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                lineNumber: 3416,
                                columnNumber: 13
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                        lineNumber: 3414,
                        columnNumber: 11
                    }, this),
                    showDiscountActions ? /*#__PURE__*/ jsxDEV("div", {
                        className: "flex items-center gap-2",
                        children: [
                            /*#__PURE__*/ jsxDEV(IconButton, {
                                type: "button",
                                tone: "neutral",
                                className: adminTableNeutralIconButtonClassName,
                                disabled: !editable,
                                onClick: onAddDiscount,
                                "aria-label": "Dodaj količinski popust",
                                title: "Dodaj količinski popust",
                                children: /*#__PURE__*/ jsxDEV(PlusIcon, {}, void 0, false, {
                                    fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                    lineNumber: 3430,
                                    columnNumber: 15
                                }, this)
                            }, void 0, false, {
                                fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                lineNumber: 3421,
                                columnNumber: 13
                            }, this),
                            /*#__PURE__*/ jsxDEV(IconButton, {
                                type: "button",
                                tone: editable && hasSelectedDiscounts ? 'danger' : 'neutral',
                                className: editable && hasSelectedDiscounts ? adminTableSelectedDangerIconButtonClassName : adminTableNeutralIconButtonClassName,
                                disabled: !editable || !hasSelectedDiscounts,
                                onClick: removeSelectedDiscounts,
                                "aria-label": "Odstrani izbrane količinske popuste",
                                title: "Odstrani izbrane",
                                children: /*#__PURE__*/ jsxDEV(TrashCanIcon, {}, void 0, false, {
                                    fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                    lineNumber: 3441,
                                    columnNumber: 15
                                }, this)
                            }, void 0, false, {
                                fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                lineNumber: 3432,
                                columnNumber: 13
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                        lineNumber: 3420,
                        columnNumber: 11
                    }, this) : null
                ]
            }, void 0, true, {
                fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                lineNumber: 3410,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ jsxDEV("div", {
                className: classNames('overflow-x-auto', !embedded && 'rounded-lg border border-slate-200'),
                children: /*#__PURE__*/ jsxDEV("table", {
                    className: classNames('min-w-full table-fixed', embedded ? 'text-[11px] leading-4' : 'text-[12px]'),
                    children: [
                        /*#__PURE__*/ jsxDEV("colgroup", {
                            children: [
                                /*#__PURE__*/ jsxDEV("col", {
                                    className: discountCheckboxColumnClassName
                                }, void 0, false, {
                                    fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                    lineNumber: 3449,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ jsxDEV("col", {
                                    className: discountMinQuantityColumnClassName
                                }, void 0, false, {
                                    fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                    lineNumber: 3450,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ jsxDEV("col", {
                                    className: discountPercentColumnClassName
                                }, void 0, false, {
                                    fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                    lineNumber: 3451,
                                    columnNumber: 13
                                }, this),
                                usesScopedCommercialTools ? /*#__PURE__*/ jsxDEV(Fragment, {
                                    children: [
                                        /*#__PURE__*/ jsxDEV("col", {}, void 0, false, {
                                            fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                            lineNumber: 3454,
                                            columnNumber: 17
                                        }, this),
                                        /*#__PURE__*/ jsxDEV("col", {}, void 0, false, {
                                            fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                            lineNumber: 3455,
                                            columnNumber: 17
                                        }, this)
                                    ]
                                }, void 0, true) : /*#__PURE__*/ jsxDEV("col", {}, void 0, false, {
                                    fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                    lineNumber: 3458,
                                    columnNumber: 15
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                            lineNumber: 3448,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ jsxDEV("thead", {
                            className: "bg-[color:var(--admin-table-header-bg)]",
                            children: /*#__PURE__*/ jsxDEV("tr", {
                                children: [
                                    /*#__PURE__*/ jsxDEV("th", {
                                        className: discountHeaderCheckboxCellClassName,
                                        children: editable ? /*#__PURE__*/ jsxDEV(AdminCheckbox, {
                                            checked: allDiscountsSelected,
                                            disabled: quantityDiscounts.length === 0,
                                            onChange: toggleAllDiscounts
                                        }, void 0, false, {
                                            fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                            lineNumber: 3464,
                                            columnNumber: 29
                                        }, this) : /*#__PURE__*/ jsxDEV(DisabledSelectionCheckbox, {}, void 0, false, {
                                            fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                            lineNumber: 3464,
                                            columnNumber: 152
                                        }, this)
                                    }, void 0, false, {
                                        fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                        lineNumber: 3463,
                                        columnNumber: 15
                                    }, this),
                                    /*#__PURE__*/ jsxDEV("th", {
                                        className: `text-center ${discountHeaderCellClassName}`,
                                        children: minQuantityLabel
                                    }, void 0, false, {
                                        fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                        lineNumber: 3466,
                                        columnNumber: 15
                                    }, this),
                                    /*#__PURE__*/ jsxDEV("th", {
                                        className: `text-center ${discountHeaderCellClassName}`,
                                        children: "Popust"
                                    }, void 0, false, {
                                        fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                        lineNumber: 3467,
                                        columnNumber: 15
                                    }, this),
                                    usesScopedCommercialTools ? /*#__PURE__*/ jsxDEV(Fragment, {
                                        children: [
                                            /*#__PURE__*/ jsxDEV("th", {
                                                className: `text-left ${discountHeaderCellClassName}`,
                                                children: "Različice"
                                            }, void 0, false, {
                                                fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                lineNumber: 3470,
                                                columnNumber: 19
                                            }, this),
                                            /*#__PURE__*/ jsxDEV("th", {
                                                className: `text-left ${discountHeaderCellClassName}`,
                                                children: "Stranke"
                                            }, void 0, false, {
                                                fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                lineNumber: 3471,
                                                columnNumber: 19
                                            }, this)
                                        ]
                                    }, void 0, true) : /*#__PURE__*/ jsxDEV("th", {
                                        className: `text-center ${discountHeaderCellClassName}`,
                                        children: "Velja za"
                                    }, void 0, false, {
                                        fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                        lineNumber: 3474,
                                        columnNumber: 17
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                lineNumber: 3462,
                                columnNumber: 13
                            }, this)
                        }, void 0, false, {
                            fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                            lineNumber: 3461,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ jsxDEV("tbody", {
                            children: quantityDiscounts.length > 0 ? quantityDiscounts.map((rule)=>/*#__PURE__*/ jsxDEV("tr", {
                                    className: "border-t border-slate-100",
                                    children: [
                                        /*#__PURE__*/ jsxDEV("td", {
                                            className: discountCheckboxCellClassName,
                                            children: editable ? /*#__PURE__*/ jsxDEV(AdminCheckbox, {
                                                checked: selectedDiscountIds.has(rule.id),
                                                onChange: ()=>toggleDiscountSelection(rule.id)
                                            }, void 0, false, {
                                                fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                lineNumber: 3482,
                                                columnNumber: 31
                                            }, this) : /*#__PURE__*/ jsxDEV(DisabledSelectionCheckbox, {}, void 0, false, {
                                                fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                lineNumber: 3482,
                                                columnNumber: 144
                                            }, this)
                                        }, void 0, false, {
                                            fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                            lineNumber: 3481,
                                            columnNumber: 17
                                        }, this),
                                        /*#__PURE__*/ jsxDEV("td", {
                                            className: `${discountTableCellClassName} text-center`,
                                            children: editable ? /*#__PURE__*/ jsxDEV("span", {
                                                className: "inline-flex items-center justify-center gap-1",
                                                children: [
                                                    minQuantityAllowsDecimal ? /*#__PURE__*/ jsxDEV(DecimalDraftInput, {
                                                        className: `${compactTableThirtyInputClassName} ${discountControlClassName} !mt-0 !w-[5ch] !px-0 text-center`,
                                                        value: rule.minQuantity,
                                                        onDecimalChange: (value)=>onUpdateDiscount(rule.id, {
                                                                minQuantity: Math.max(0, value)
                                                            })
                                                    }, void 0, false, {
                                                        fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                        lineNumber: 3488,
                                                        columnNumber: 25
                                                    }, this) : /*#__PURE__*/ jsxDEV("input", {
                                                        type: "number",
                                                        min: 1,
                                                        className: `${compactTableThirtyInputClassName} ${discountControlClassName} !mt-0 !w-[5ch] !px-0 text-center`,
                                                        value: rule.minQuantity,
                                                        onChange: (event)=>onUpdateDiscount(rule.id, {
                                                                minQuantity: Math.max(1, Number(event.target.value) || 1)
                                                            })
                                                    }, void 0, false, {
                                                        fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                        lineNumber: 3494,
                                                        columnNumber: 25
                                                    }, this),
                                                    minQuantityUnitLabel ? /*#__PURE__*/ jsxDEV("span", {
                                                        className: compactTableAdornmentClassName,
                                                        children: minQuantityUnitLabel
                                                    }, void 0, false, {
                                                        fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                        lineNumber: 3502,
                                                        columnNumber: 47
                                                    }, this) : null
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                lineNumber: 3486,
                                                columnNumber: 21
                                            }, this) : /*#__PURE__*/ jsxDEV(ReadOnlyTableField, {
                                                value: minQuantityUnitLabel ? `${(0, formatDecimalForDisplay)(rule.minQuantity)} ${minQuantityUnitLabel}` : rule.minQuantity,
                                                align: "center",
                                                className: "mx-auto w-20"
                                            }, void 0, false, {
                                                fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                lineNumber: 3505,
                                                columnNumber: 21
                                            }, this)
                                        }, void 0, false, {
                                            fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                            lineNumber: 3484,
                                            columnNumber: 17
                                        }, this),
                                        /*#__PURE__*/ jsxDEV("td", {
                                            className: `${discountTableCellClassName} text-center`,
                                            children: editable ? /*#__PURE__*/ jsxDEV("span", {
                                                className: discountValueUnitShellClassName,
                                                children: [
                                                    /*#__PURE__*/ jsxDEV(DecimalDraftInput, {
                                                        className: `${compactTableThirtyInputClassName} ${discountControlClassName} !mt-0 !w-[5ch] !px-0 text-right`,
                                                        value: (0, formatDecimalForDisplay)(rule.discountPercent),
                                                        onDecimalChange: (value)=>onUpdateDiscount(rule.id, {
                                                                discountPercent: clampDiscountPercent(value)
                                                            })
                                                    }, void 0, false, {
                                                        fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                        lineNumber: 3511,
                                                        columnNumber: 23
                                                    }, this),
                                                    /*#__PURE__*/ jsxDEV("span", {
                                                        className: compactTableAdornmentClassName,
                                                        children: "%"
                                                    }, void 0, false, {
                                                        fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                        lineNumber: 3516,
                                                        columnNumber: 23
                                                    }, this)
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                lineNumber: 3510,
                                                columnNumber: 21
                                            }, this) : /*#__PURE__*/ jsxDEV("span", {
                                                className: `${discountValueUnitShellClassName} justify-center`,
                                                children: [
                                                    /*#__PURE__*/ jsxDEV("span", {
                                                        className: "inline-flex h-[30px] w-[5ch] items-center justify-end px-0 font-['Inter',system-ui,sans-serif] text-[11px] font-normal leading-[1.2] text-slate-700",
                                                        children: (0, formatDecimalForDisplay)(rule.discountPercent)
                                                    }, void 0, false, {
                                                        fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                        lineNumber: 3519,
                                                        columnNumber: 23
                                                    }, this),
                                                    /*#__PURE__*/ jsxDEV("span", {
                                                        className: compactTableAdornmentClassName,
                                                        children: "%"
                                                    }, void 0, false, {
                                                        fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                        lineNumber: 3520,
                                                        columnNumber: 23
                                                    }, this)
                                                ]
                                            }, void 0, false, {
                                                fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                lineNumber: 3519,
                                                columnNumber: 21
                                            }, this)
                                        }, void 0, false, {
                                            fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                            lineNumber: 3508,
                                            columnNumber: 17
                                        }, this),
                                        usesScopedCommercialTools ? /*#__PURE__*/ jsxDEV(Fragment, {
                                            children: [
                                                /*#__PURE__*/ jsxDEV("td", {
                                                    className: `min-w-[150px] ${discountTableCellClassName}`,
                                                    children: /*#__PURE__*/ jsxDEV(DiscountTargetChipInput, {
                                                        editable: editable,
                                                        compact: embedded,
                                                        value: rule.variantTargets,
                                                        suggestions: variantTargetSuggestions,
                                                        listId: `discount-variants-${rule.id}`,
                                                        placeholder: "SKU ali Vse",
                                                        onChange: (variantTargets)=>onUpdateDiscount(rule.id, {
                                                                variantTargets
                                                            })
                                                    }, void 0, false, {
                                                        fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                        lineNumber: 3525,
                                                        columnNumber: 23
                                                    }, this)
                                                }, void 0, false, {
                                                    fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                    lineNumber: 3524,
                                                    columnNumber: 21
                                                }, this),
                                                /*#__PURE__*/ jsxDEV("td", {
                                                    className: `min-w-[150px] ${discountTableCellClassName}`,
                                                    children: /*#__PURE__*/ jsxDEV(DiscountTargetChipInput, {
                                                        editable: editable,
                                                        compact: embedded,
                                                        value: rule.customerTargets,
                                                        suggestions: customerTargetSuggestions,
                                                        listId: `discount-customers-${rule.id}`,
                                                        placeholder: "Naročnik ali Vse",
                                                        onChange: (customerTargets)=>onUpdateDiscount(rule.id, {
                                                                customerTargets
                                                            })
                                                    }, void 0, false, {
                                                        fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                        lineNumber: 3536,
                                                        columnNumber: 23
                                                    }, this)
                                                }, void 0, false, {
                                                    fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                    lineNumber: 3535,
                                                    columnNumber: 21
                                                }, this)
                                            ]
                                        }, void 0, true) : /*#__PURE__*/ jsxDEV("td", {
                                            className: `${discountTableCellClassName} text-center`,
                                            children: /*#__PURE__*/ jsxDEV("span", {
                                                className: "font-medium text-slate-700",
                                                children: "Vse različice"
                                            }, void 0, false, {
                                                fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                lineNumber: 3549,
                                                columnNumber: 21
                                            }, this)
                                        }, void 0, false, {
                                            fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                            lineNumber: 3548,
                                            columnNumber: 19
                                        }, this)
                                    ]
                                }, rule.id, true, {
                                    fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                    lineNumber: 3480,
                                    columnNumber: 15
                                }, this)) : /*#__PURE__*/ jsxDEV("tr", {
                                className: "border-t border-slate-100",
                                children: /*#__PURE__*/ jsxDEV("td", {
                                    colSpan: usesScopedCommercialTools ? 5 : 4,
                                    className: "px-3 py-4 text-center text-[13px] font-medium text-slate-500",
                                    children: "Ni aktivnih količinskih popustov."
                                }, void 0, false, {
                                    fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                    lineNumber: 3555,
                                    columnNumber: 17
                                }, this)
                            }, void 0, false, {
                                fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                lineNumber: 3554,
                                columnNumber: 15
                            }, this)
                        }, void 0, false, {
                            fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                            lineNumber: 3478,
                            columnNumber: 11
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                    lineNumber: 3447,
                    columnNumber: 9
                }, this)
            }, void 0, false, {
                fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                lineNumber: 3446,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
        lineNumber: 3402,
        columnNumber: 5
    }, this);
}
_s4(QuantityDiscountsCard, "Iul7Nv8aKzexYaOGjuE/LwYa3o4=");
function CommercialToolsPanel({ productType = 'dimensions', hideQuantityDiscounts = false, editable, quantityDiscounts, onAddDiscount, onRemoveDiscount, onUpdateDiscount, simulatorOptions, selectedOptionId, onSelectedOptionIdChange, quantity, onQuantityChange, applyQuantityDiscounts, onApplyQuantityDiscountsChange }) {
    _s5();
    const selectedOption = simulatorOptions.find((option)=>option.id === selectedOptionId) ?? simulatorOptions[0] ?? null;
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
    const weightBaseOption = selectedOption?.weightPricePerKg !== undefined ? selectedOption : simulatorOptions.find((option)=>option.weightPricePerKg !== undefined) ?? selectedOption;
    const [customerSuggestions, setCustomerSuggestions] = (0, useState)([]);
    const [selectedDiscountIds, setSelectedDiscountIds] = (0, useState)(new Set());
    const [customWeightNetMass, setCustomWeightNetMass] = (0, useState)(1);
    const [customWeightBagCount, setCustomWeightBagCount] = (0, useState)(1);
    const [customWeightFraction, setCustomWeightFraction] = (0, useState)('');
    const weightFractionOptions = (0, useMemo)({
        "CommercialToolsPanel.useMemo[weightFractionOptions]": ()=>Array.from(new Set(simulatorOptions.map({
                "CommercialToolsPanel.useMemo[weightFractionOptions]": (option)=>option.weightFraction
            }["CommercialToolsPanel.useMemo[weightFractionOptions]"]).filter({
                "CommercialToolsPanel.useMemo[weightFractionOptions]": (fraction)=>Boolean(fraction)
            }["CommercialToolsPanel.useMemo[weightFractionOptions]"])))
    }["CommercialToolsPanel.useMemo[weightFractionOptions]"], [
        simulatorOptions
    ]);
    const simulatorSelectOptions = (0, useMemo)({
        "CommercialToolsPanel.useMemo[simulatorSelectOptions]": ()=>simulatorOptions.length > 0 ? simulatorOptions.map({
                "CommercialToolsPanel.useMemo[simulatorSelectOptions]": (option)=>({
                        value: option.id,
                        label: option.label
                    })
            }["CommercialToolsPanel.useMemo[simulatorSelectOptions]"]) : [
                {
                    value: '',
                    label: 'Ni različic'
                }
            ]
    }["CommercialToolsPanel.useMemo[simulatorSelectOptions]"], [
        simulatorOptions
    ]);
    const activeWeightFraction = customWeightFraction && weightFractionOptions.includes(customWeightFraction) ? customWeightFraction : weightFractionOptions[0] ?? '';
    const customWeightBaseOption = simulatorOptions.find((option)=>option.weightFraction === activeWeightFraction && option.weightPricePerKg !== undefined) ?? weightBaseOption;
    const variantTargetSuggestions = (0, useMemo)({
        "CommercialToolsPanel.useMemo[variantTargetSuggestions]": ()=>normalizeDiscountSuggestionList([
                allDiscountTargetLabel,
                ...simulatorOptions.map(getSimulatorOptionSku).filter(Boolean)
            ])
    }["CommercialToolsPanel.useMemo[variantTargetSuggestions]"], [
        simulatorOptions
    ]);
    const customerTargetSuggestions = (0, useMemo)({
        "CommercialToolsPanel.useMemo[customerTargetSuggestions]": ()=>normalizeDiscountSuggestionList([
                allDiscountTargetLabel,
                ...customerSuggestions
            ])
    }["CommercialToolsPanel.useMemo[customerTargetSuggestions]"], [
        customerSuggestions
    ]);
    const allDiscountsSelected = quantityDiscounts.length > 0 && quantityDiscounts.every((rule)=>selectedDiscountIds.has(rule.id));
    const hasSelectedDiscounts = selectedDiscountIds.size > 0;
    const toggleDiscountSelection = (id)=>{
        setSelectedDiscountIds((current)=>{
            const next = new Set(current);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };
    const toggleAllDiscounts = ()=>{
        setSelectedDiscountIds(allDiscountsSelected ? new Set() : new Set(quantityDiscounts.map((rule)=>rule.id)));
    };
    const removeSelectedDiscounts = ()=>{
        if (!hasSelectedDiscounts) return;
        Array.from(selectedDiscountIds).forEach(onRemoveDiscount);
        setSelectedDiscountIds(new Set());
    };
    const getWeightScenarioPrice = (netMassKg, bagCount, pricePerKg, packagingCostPerBag, scenarioOption = weightBaseOption)=>{
        const normalizedNetMass = Math.max(0, netMassKg || 0);
        const normalizedBagCount = Math.max(1, Math.floor(bagCount || 1));
        const totalKg = Number(normalizedNetMass.toFixed(4));
        const base = Number((normalizedNetMass * pricePerKg + normalizedBagCount * packagingCostPerBag).toFixed(4));
        const discount = applyQuantityDiscounts ? getBestQuantityDiscount(quantityDiscounts, totalKg, scenarioOption) : null;
        const discountPercentForScenario = discount?.discountPercent ?? 0;
        const withoutVat = Number((base * (1 - discountPercentForScenario / 100)).toFixed(2));
        const withVat = Number((withoutVat * 1.22).toFixed(2));
        return {
            totalKg,
            base,
            discountPercent: discountPercentForScenario,
            withoutVat,
            withVat
        };
    };
    const customWeightScenario = getWeightScenarioPrice(customWeightNetMass, customWeightBagCount, customWeightBaseOption?.weightPricePerKg ?? 0, customWeightBaseOption?.weightPackagingCostPerBag ?? 0, customWeightBaseOption);
    const activeSimulatorOption = productType === 'weight' ? customWeightBaseOption : selectedOption;
    const activeSimulatorQuantity = productType === 'weight' ? customWeightScenario.totalKg : normalizedQuantity;
    const activeSimulatorUnit = productType === 'weight' ? 'kg' : activeSimulatorOption?.discountUnitLabel ?? quantityUnit;
    const activeSimulatorDiscount = applyQuantityDiscounts ? productType === 'weight' ? getBestQuantityDiscount(quantityDiscounts, activeSimulatorQuantity, activeSimulatorOption) : activeDiscount : null;
    const nextSimulatorDiscount = getNextQuantityDiscount(quantityDiscounts, activeSimulatorQuantity, activeSimulatorOption);
    const quickSimulatorQuantities = [
        10,
        25,
        50,
        100
    ];
    const quickWeightBagCounts = [
        1,
        2,
        5,
        10
    ];
    const summaryDiscountPercent = productType === 'weight' ? customWeightScenario.discountPercent : discountPercent;
    const summarySubtotal = productType === 'weight' ? customWeightScenario.withoutVat : subtotal;
    const summaryVat = productType === 'weight' ? Number((summarySubtotal * 0.22).toFixed(2)) : vat;
    const summaryTotal = productType === 'weight' ? customWeightScenario.withVat : total;
    const summaryBaseSubtotal = productType === 'weight' ? customWeightScenario.base : Number((basePrice * normalizedQuantity).toFixed(2));
    const summaryDiscountAmount = Math.max(0, Number((summaryBaseSubtotal - summarySubtotal).toFixed(2)));
    const weightPricePerKg = customWeightBaseOption?.weightPricePerKg ?? 0;
    const weightPackagingCost = customWeightBaseOption?.weightPackagingCostPerBag ?? 0;
    const weightMassSubtotal = Number((customWeightScenario.totalKg * weightPricePerKg).toFixed(2));
    const weightPackagingSubtotal = Number((customWeightBagCount * weightPackagingCost).toFixed(2));
    const selectedOptionLabel = selectedOption?.label ?? '—';
    const nonWeightSelectedLabel = productType === 'unique_machine' ? selectedOptionLabel : productType === 'dimensions' ? `Različica: ${selectedOptionLabel}` : selectedOptionLabel;
    const nonWeightSelectedDescription = productType === 'unique_machine' ? formatMachineSerialSummary(selectedOption?.serialLabels, normalizedQuantity) : productType === 'dimensions' ? 'cena izbrane dimenzijske različice brez DDV' : 'cena artikla brez DDV';
    const nonWeightCalculationLabel = productType === 'unique_machine' ? 'Skupaj' : productType === 'dimensions' ? 'Različice skupaj' : 'Artikli skupaj';
    const selectedProductSummaryIcon = productType === 'unique_machine' ? 'uniqueMachine' : productType === 'dimensions' ? 'dimensions' : 'simple';
    const quantitySummaryIcon = productType === 'dimensions' ? 'layers' : 'boxes';
    const stockSummaryIcon = productType === 'dimensions' ? 'layersMinus' : 'boxes';
    const simulatorItemIcon = productType === 'weight' ? 'weightGranules' : selectedProductSummaryIcon;
    const simulatorStockIcon = productType === 'weight' ? 'quantity' : quantitySummaryIcon;
    const stockAfterOrderLabel = formatStockAfterOrder(activeSimulatorOption?.stockLabel, productType === 'weight' ? customWeightScenario.totalKg : normalizedQuantity);
    const orderSummaryDetailRows = productType === 'weight' ? [
        {
            icon: 'weightGranules',
            label: `Frakcija: ${customWeightBaseOption?.weightFraction || customWeightBaseOption?.label || '—'}`,
            description: 'osnova za izračun brez DDV',
            value: (0, formatCurrency)(summaryBaseSubtotal)
        },
        {
            icon: 'scale',
            label: 'Cena / kg',
            value: `${(0, formatCurrency)(weightPricePerKg)} / kg`
        },
        {
            icon: 'bag',
            label: 'Strošek pakiranja / vrečko',
            value: (0, formatCurrency)(weightPackagingCost)
        },
        {
            icon: 'quantity',
            label: 'Količina',
            value: `${formatWeightKg(customWeightScenario.totalKg)} • ${formatWeightBagCount(customWeightBagCount)}`
        },
        {
            icon: 'discount',
            label: 'Količinski popust',
            value: formatPercent(summaryDiscountPercent)
        },
        ...stockAfterOrderLabel ? [
            {
                icon: 'stock',
                label: 'Nova zaloga (po naročilu)',
                value: stockAfterOrderLabel
            }
        ] : []
    ] : [
        {
            icon: selectedProductSummaryIcon,
            label: nonWeightSelectedLabel,
            description: nonWeightSelectedDescription,
            value: selectedOption?.summaryLabel ?? (0, formatCurrency)(basePrice)
        },
        {
            icon: quantitySummaryIcon,
            label: 'Količina',
            value: formatSimulatorQuantityWithUnit(normalizedQuantity, quantityUnit)
        },
        {
            icon: 'discount',
            label: 'Količinski popust',
            value: formatPercent(summaryDiscountPercent)
        },
        ...stockAfterOrderLabel ? [
            {
                icon: stockSummaryIcon,
                label: 'Nova zaloga (po naročilu)',
                value: stockAfterOrderLabel
            }
        ] : []
    ];
    const orderSummaryCalculationRows = productType === 'weight' ? [
        {
            label: 'Skupna masa',
            detail: `${formatWeightKg(customWeightScenario.totalKg)} × ${(0, formatCurrency)(weightPricePerKg)} / kg`,
            value: (0, formatCurrency)(weightMassSubtotal)
        },
        {
            label: 'Pakiranje skupaj',
            detail: `${formatWeightBagCount(customWeightBagCount)} × ${(0, formatCurrency)(weightPackagingCost)}`,
            value: (0, formatCurrency)(weightPackagingSubtotal)
        }
    ] : [
        {
            label: nonWeightCalculationLabel,
            detail: `${formatSimulatorQuantityWithUnit(normalizedQuantity, quantityUnit)} × ${(0, formatCurrency)(basePrice)}`,
            value: (0, formatCurrency)(summaryBaseSubtotal)
        }
    ];
    orderSummaryCalculationRows.push({
        label: `Popust (${formatPercent(summaryDiscountPercent)})`,
        value: `−${(0, formatCurrency)(summaryDiscountAmount)}`,
        tone: 'success'
    }, {
        label: 'Skupaj brez DDV',
        value: (0, formatCurrency)(summarySubtotal),
        strong: true
    }, {
        label: 'DDV (22 %)',
        value: (0, formatCurrency)(summaryVat),
        strong: true
    });
    (0, useEffect)({
        "CommercialToolsPanel.useEffect": ()=>{
            if (!usesScopedCommercialTools) return;
            let cancelled = false;
            void fetch('/api/admin/orders/customers', {
                cache: 'no-store'
            }).then({
                "CommercialToolsPanel.useEffect": (response)=>response.ok ? response.json() : {
                        customers: []
                    }
            }["CommercialToolsPanel.useEffect"]).then({
                "CommercialToolsPanel.useEffect": (payload)=>{
                    if (cancelled) return;
                    const customers = Array.isArray(payload.customers) ? payload.customers.map({
                        "CommercialToolsPanel.useEffect": (entry)=>String(entry).trim()
                    }["CommercialToolsPanel.useEffect"]).filter(Boolean) : [];
                    setCustomerSuggestions(customers);
                }
            }["CommercialToolsPanel.useEffect"]).catch({
                "CommercialToolsPanel.useEffect": ()=>{
                    if (!cancelled) setCustomerSuggestions([]);
                }
            }["CommercialToolsPanel.useEffect"]);
            return ({
                "CommercialToolsPanel.useEffect": ()=>{
                    cancelled = true;
                }
            })["CommercialToolsPanel.useEffect"];
        }
    }["CommercialToolsPanel.useEffect"], [
        usesScopedCommercialTools
    ]);
    (0, useEffect)({
        "CommercialToolsPanel.useEffect": ()=>{
            setSelectedDiscountIds({
                "CommercialToolsPanel.useEffect": (current)=>{
                    const validIds = new Set(quantityDiscounts.map({
                        "CommercialToolsPanel.useEffect": (rule)=>rule.id
                    }["CommercialToolsPanel.useEffect"]));
                    const next = new Set(Array.from(current).filter({
                        "CommercialToolsPanel.useEffect": (id)=>validIds.has(id)
                    }["CommercialToolsPanel.useEffect"]));
                    return next.size === current.size ? current : next;
                }
            }["CommercialToolsPanel.useEffect"]);
        }
    }["CommercialToolsPanel.useEffect"], [
        quantityDiscounts
    ]);
    return /*#__PURE__*/ jsxDEV("div", {
        className: usesScopedCommercialTools ? 'grid items-stretch gap-5 xl:grid-cols-2' : 'grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.95fr)]',
        children: [
            /*#__PURE__*/ jsxDEV("div", {
                className: usesScopedCommercialTools ? 'contents' : 'space-y-5',
                children: [
                    !hideQuantityDiscounts ? /*#__PURE__*/ jsxDEV("section", {
                        className: classNames(adminWindowCardClassName, 'p-5', usesScopedCommercialTools && 'xl:col-span-2'),
                        style: adminWindowCardStyle,
                        children: [
                            /*#__PURE__*/ jsxDEV("div", {
                                className: "mb-3 flex items-start justify-between gap-3",
                                children: [
                                    /*#__PURE__*/ jsxDEV("div", {
                                        children: [
                                            /*#__PURE__*/ jsxDEV("h2", {
                                                className: sectionTitleClassName,
                                                children: "Količinski popusti"
                                            }, void 0, false, {
                                                fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                lineNumber: 3824,
                                                columnNumber: 15
                                            }, this),
                                            /*#__PURE__*/ jsxDEV("p", {
                                                className: "mt-1 text-[13px] font-medium text-slate-500",
                                                children: "Privzeta pravila za popust glede na količino naročila."
                                            }, void 0, false, {
                                                fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                lineNumber: 3825,
                                                columnNumber: 15
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                        lineNumber: 3823,
                                        columnNumber: 13
                                    }, this),
                                    editable ? /*#__PURE__*/ jsxDEV("div", {
                                        className: "flex items-center gap-2",
                                        children: [
                                            /*#__PURE__*/ jsxDEV(IconButton, {
                                                type: "button",
                                                tone: "neutral",
                                                className: adminTableNeutralIconButtonClassName,
                                                onClick: onAddDiscount,
                                                "aria-label": "Dodaj količinski popust",
                                                title: "Dodaj količinski popust",
                                                children: /*#__PURE__*/ jsxDEV(PlusIcon, {}, void 0, false, {
                                                    fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                    lineNumber: 3830,
                                                    columnNumber: 19
                                                }, this)
                                            }, void 0, false, {
                                                fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                lineNumber: 3829,
                                                columnNumber: 17
                                            }, this),
                                            /*#__PURE__*/ jsxDEV(IconButton, {
                                                type: "button",
                                                tone: hasSelectedDiscounts ? 'danger' : 'neutral',
                                                className: hasSelectedDiscounts ? adminTableSelectedDangerIconButtonClassName : adminTableNeutralIconButtonClassName,
                                                disabled: !hasSelectedDiscounts,
                                                onClick: removeSelectedDiscounts,
                                                "aria-label": "Odstrani izbrane količinske popuste",
                                                title: "Odstrani izbrane",
                                                children: /*#__PURE__*/ jsxDEV(TrashCanIcon, {}, void 0, false, {
                                                    fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                    lineNumber: 3841,
                                                    columnNumber: 19
                                                }, this)
                                            }, void 0, false, {
                                                fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                lineNumber: 3832,
                                                columnNumber: 17
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                        lineNumber: 3828,
                                        columnNumber: 15
                                    }, this) : null
                                ]
                            }, void 0, true, {
                                fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                lineNumber: 3822,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ jsxDEV("div", {
                                className: "overflow-x-auto rounded-lg border border-slate-200",
                                children: /*#__PURE__*/ jsxDEV("table", {
                                    className: "min-w-full table-fixed text-[12px]",
                                    children: [
                                        /*#__PURE__*/ jsxDEV("colgroup", {
                                            children: [
                                                /*#__PURE__*/ jsxDEV("col", {
                                                    className: discountCheckboxColumnClassName
                                                }, void 0, false, {
                                                    fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                    lineNumber: 3849,
                                                    columnNumber: 17
                                                }, this),
                                                /*#__PURE__*/ jsxDEV("col", {
                                                    className: discountMinQuantityColumnClassName
                                                }, void 0, false, {
                                                    fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                    lineNumber: 3850,
                                                    columnNumber: 17
                                                }, this),
                                                /*#__PURE__*/ jsxDEV("col", {
                                                    className: discountPercentColumnClassName
                                                }, void 0, false, {
                                                    fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                    lineNumber: 3851,
                                                    columnNumber: 17
                                                }, this),
                                                usesScopedCommercialTools ? /*#__PURE__*/ jsxDEV(Fragment, {
                                                    children: [
                                                        /*#__PURE__*/ jsxDEV("col", {}, void 0, false, {
                                                            fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                            lineNumber: 3854,
                                                            columnNumber: 21
                                                        }, this),
                                                        /*#__PURE__*/ jsxDEV("col", {}, void 0, false, {
                                                            fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                            lineNumber: 3855,
                                                            columnNumber: 21
                                                        }, this)
                                                    ]
                                                }, void 0, true) : /*#__PURE__*/ jsxDEV("col", {}, void 0, false, {
                                                    fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                    lineNumber: 3858,
                                                    columnNumber: 19
                                                }, this)
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                            lineNumber: 3848,
                                            columnNumber: 15
                                        }, this),
                                        /*#__PURE__*/ jsxDEV("thead", {
                                            className: "bg-[color:var(--admin-table-header-bg)]",
                                            children: /*#__PURE__*/ jsxDEV("tr", {
                                                children: [
                                                    /*#__PURE__*/ jsxDEV("th", {
                                                        className: `${discountCheckboxColumnClassName} px-2 py-2 text-center`,
                                                        children: /*#__PURE__*/ jsxDEV(AdminCheckbox, {
                                                            checked: editable && allDiscountsSelected,
                                                            disabled: !editable || quantityDiscounts.length === 0,
                                                            onChange: toggleAllDiscounts
                                                        }, void 0, false, {
                                                            fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                            lineNumber: 3864,
                                                            columnNumber: 21
                                                        }, this)
                                                    }, void 0, false, {
                                                        fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                        lineNumber: 3863,
                                                        columnNumber: 19
                                                    }, this),
                                                    /*#__PURE__*/ jsxDEV("th", {
                                                        className: "whitespace-nowrap px-3 py-2 text-center font-semibold text-slate-700",
                                                        children: "Min. količina"
                                                    }, void 0, false, {
                                                        fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                        lineNumber: 3866,
                                                        columnNumber: 19
                                                    }, this),
                                                    /*#__PURE__*/ jsxDEV("th", {
                                                        className: "whitespace-nowrap px-3 py-2 text-center font-semibold text-slate-700",
                                                        children: "Popust"
                                                    }, void 0, false, {
                                                        fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                        lineNumber: 3867,
                                                        columnNumber: 19
                                                    }, this),
                                                    usesScopedCommercialTools ? /*#__PURE__*/ jsxDEV(Fragment, {
                                                        children: [
                                                            /*#__PURE__*/ jsxDEV("th", {
                                                                className: "whitespace-nowrap px-3 py-2 text-left font-semibold text-slate-700",
                                                                children: "Različice"
                                                            }, void 0, false, {
                                                                fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                                lineNumber: 3870,
                                                                columnNumber: 23
                                                            }, this),
                                                            /*#__PURE__*/ jsxDEV("th", {
                                                                className: "whitespace-nowrap px-3 py-2 text-left font-semibold text-slate-700",
                                                                children: "Stranke"
                                                            }, void 0, false, {
                                                                fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                                lineNumber: 3871,
                                                                columnNumber: 23
                                                            }, this)
                                                        ]
                                                    }, void 0, true) : /*#__PURE__*/ jsxDEV("th", {
                                                        className: "whitespace-nowrap px-3 py-2 text-center font-semibold text-slate-700",
                                                        children: "Velja za"
                                                    }, void 0, false, {
                                                        fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                        lineNumber: 3874,
                                                        columnNumber: 21
                                                    }, this)
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                lineNumber: 3862,
                                                columnNumber: 17
                                            }, this)
                                        }, void 0, false, {
                                            fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                            lineNumber: 3861,
                                            columnNumber: 15
                                        }, this),
                                        /*#__PURE__*/ jsxDEV("tbody", {
                                            children: quantityDiscounts.length > 0 ? quantityDiscounts.map((rule)=>/*#__PURE__*/ jsxDEV("tr", {
                                                    className: "border-t border-slate-100",
                                                    children: [
                                                        /*#__PURE__*/ jsxDEV("td", {
                                                            className: "px-2 py-2 text-center",
                                                            children: editable ? /*#__PURE__*/ jsxDEV(AdminCheckbox, {
                                                                checked: selectedDiscountIds.has(rule.id),
                                                                onChange: ()=>toggleDiscountSelection(rule.id)
                                                            }, void 0, false, {
                                                                fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                                lineNumber: 3882,
                                                                columnNumber: 35
                                                            }, this) : /*#__PURE__*/ jsxDEV(DisabledSelectionCheckbox, {}, void 0, false, {
                                                                fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                                lineNumber: 3882,
                                                                columnNumber: 148
                                                            }, this)
                                                        }, void 0, false, {
                                                            fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                            lineNumber: 3881,
                                                            columnNumber: 21
                                                        }, this),
                                                        /*#__PURE__*/ jsxDEV("td", {
                                                            className: "px-3 py-2 text-center",
                                                            children: editable ? /*#__PURE__*/ jsxDEV("input", {
                                                                type: "number",
                                                                min: 1,
                                                                className: `${compactTableThirtyInputClassName} !mt-0 !w-[5ch] !px-0 text-center`,
                                                                value: rule.minQuantity,
                                                                onChange: (event)=>onUpdateDiscount(rule.id, {
                                                                        minQuantity: Math.max(1, Number(event.target.value) || 1)
                                                                    })
                                                            }, void 0, false, {
                                                                fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                                lineNumber: 3886,
                                                                columnNumber: 25
                                                            }, this) : /*#__PURE__*/ jsxDEV(ReadOnlyTableField, {
                                                                value: rule.minQuantity,
                                                                align: "center",
                                                                className: "mx-auto w-16"
                                                            }, void 0, false, {
                                                                fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                                lineNumber: 3894,
                                                                columnNumber: 25
                                                            }, this)
                                                        }, void 0, false, {
                                                            fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                            lineNumber: 3884,
                                                            columnNumber: 21
                                                        }, this),
                                                        /*#__PURE__*/ jsxDEV("td", {
                                                            className: "px-3 py-2 text-center",
                                                            children: editable ? /*#__PURE__*/ jsxDEV("span", {
                                                                className: compactTableThirtyValueUnitShellClassName,
                                                                children: [
                                                                    /*#__PURE__*/ jsxDEV(DecimalDraftInput, {
                                                                        className: `${compactTableThirtyInputClassName} !mt-0 !w-[5ch] !px-0 text-right`,
                                                                        value: (0, formatDecimalForDisplay)(rule.discountPercent),
                                                                        onDecimalChange: (value)=>onUpdateDiscount(rule.id, {
                                                                                discountPercent: clampDiscountPercent(value)
                                                                            })
                                                                    }, void 0, false, {
                                                                        fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                                        lineNumber: 3900,
                                                                        columnNumber: 27
                                                                    }, this),
                                                                    /*#__PURE__*/ jsxDEV("span", {
                                                                        className: compactTableAdornmentClassName,
                                                                        children: "%"
                                                                    }, void 0, false, {
                                                                        fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                                        lineNumber: 3905,
                                                                        columnNumber: 27
                                                                    }, this)
                                                                ]
                                                            }, void 0, true, {
                                                                fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                                lineNumber: 3899,
                                                                columnNumber: 25
                                                            }, this) : /*#__PURE__*/ jsxDEV("span", {
                                                                className: `${compactTableThirtyValueUnitShellClassName} justify-center`,
                                                                children: [
                                                                    /*#__PURE__*/ jsxDEV("span", {
                                                                        className: "inline-flex h-[30px] w-[5ch] items-center justify-end px-0 font-['Inter',system-ui,sans-serif] text-[11px] font-normal leading-[1.2] text-slate-700",
                                                                        children: (0, formatDecimalForDisplay)(rule.discountPercent)
                                                                    }, void 0, false, {
                                                                        fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                                        lineNumber: 3908,
                                                                        columnNumber: 27
                                                                    }, this),
                                                                    /*#__PURE__*/ jsxDEV("span", {
                                                                        className: compactTableAdornmentClassName,
                                                                        children: "%"
                                                                    }, void 0, false, {
                                                                        fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                                        lineNumber: 3909,
                                                                        columnNumber: 27
                                                                    }, this)
                                                                ]
                                                            }, void 0, false, {
                                                                fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                                lineNumber: 3908,
                                                                columnNumber: 25
                                                            }, this)
                                                        }, void 0, false, {
                                                            fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                            lineNumber: 3897,
                                                            columnNumber: 21
                                                        }, this),
                                                        usesScopedCommercialTools ? /*#__PURE__*/ jsxDEV(Fragment, {
                                                            children: [
                                                                /*#__PURE__*/ jsxDEV("td", {
                                                                    className: "min-w-[150px] px-3 py-2",
                                                                    children: /*#__PURE__*/ jsxDEV(DiscountTargetChipInput, {
                                                                        editable: editable,
                                                                        value: rule.variantTargets,
                                                                        suggestions: variantTargetSuggestions,
                                                                        listId: `discount-variants-${rule.id}`,
                                                                        placeholder: "SKU ali Vse",
                                                                        onChange: (variantTargets)=>onUpdateDiscount(rule.id, {
                                                                                variantTargets
                                                                            })
                                                                    }, void 0, false, {
                                                                        fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                                        lineNumber: 3914,
                                                                        columnNumber: 27
                                                                    }, this)
                                                                }, void 0, false, {
                                                                    fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                                    lineNumber: 3913,
                                                                    columnNumber: 25
                                                                }, this),
                                                                /*#__PURE__*/ jsxDEV("td", {
                                                                    className: "min-w-[150px] px-3 py-2",
                                                                    children: /*#__PURE__*/ jsxDEV(DiscountTargetChipInput, {
                                                                        editable: editable,
                                                                        value: rule.customerTargets,
                                                                        suggestions: customerTargetSuggestions,
                                                                        listId: `discount-customers-${rule.id}`,
                                                                        placeholder: "Naročnik ali Vse",
                                                                        onChange: (customerTargets)=>onUpdateDiscount(rule.id, {
                                                                                customerTargets
                                                                            })
                                                                    }, void 0, false, {
                                                                        fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                                        lineNumber: 3924,
                                                                        columnNumber: 27
                                                                    }, this)
                                                                }, void 0, false, {
                                                                    fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                                    lineNumber: 3923,
                                                                    columnNumber: 25
                                                                }, this)
                                                            ]
                                                        }, void 0, true) : /*#__PURE__*/ jsxDEV("td", {
                                                            className: "px-3 py-2 text-center",
                                                            children: /*#__PURE__*/ jsxDEV("span", {
                                                                className: "font-medium text-slate-700",
                                                                children: "Vse različice"
                                                            }, void 0, false, {
                                                                fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                                lineNumber: 3936,
                                                                columnNumber: 25
                                                            }, this)
                                                        }, void 0, false, {
                                                            fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                            lineNumber: 3935,
                                                            columnNumber: 23
                                                        }, this)
                                                    ]
                                                }, rule.id, true, {
                                                    fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                    lineNumber: 3880,
                                                    columnNumber: 19
                                                }, this)) : /*#__PURE__*/ jsxDEV("tr", {
                                                className: "border-t border-slate-100",
                                                children: /*#__PURE__*/ jsxDEV("td", {
                                                    colSpan: usesScopedCommercialTools ? 5 : 4,
                                                    className: "px-3 py-4 text-center text-[13px] font-medium text-slate-500",
                                                    children: "Ni aktivnih količinskih popustov."
                                                }, void 0, false, {
                                                    fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                    lineNumber: 3942,
                                                    columnNumber: 21
                                                }, this)
                                            }, void 0, false, {
                                                fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                lineNumber: 3941,
                                                columnNumber: 19
                                            }, this)
                                        }, void 0, false, {
                                            fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                            lineNumber: 3878,
                                            columnNumber: 15
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                    lineNumber: 3847,
                                    columnNumber: 13
                                }, this)
                            }, void 0, false, {
                                fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                lineNumber: 3846,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                        lineNumber: 3821,
                        columnNumber: 9
                    }, this) : null,
                    productType === 'weight' ? /*#__PURE__*/ jsxDEV("section", {
                        className: `${adminWindowCardClassName} h-full p-5`,
                        style: adminWindowCardStyle,
                        children: [
                            /*#__PURE__*/ jsxDEV(SimulatorHeader, {
                                description: "Izberite frakcijo, skupno maso in število vrečk za predogled cene, popusta in zaloge.",
                                applyQuantityDiscounts: applyQuantityDiscounts,
                                onApplyQuantityDiscountsChange: onApplyQuantityDiscountsChange
                            }, void 0, false, {
                                fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                lineNumber: 3953,
                                columnNumber: 13
                            }, this),
                            /*#__PURE__*/ jsxDEV("div", {
                                className: "mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(120px,0.7fr)_minmax(96px,0.58fr)]",
                                children: [
                                    /*#__PURE__*/ jsxDEV(SimulatorControlField, {
                                        label: "Frakcija",
                                        children: /*#__PURE__*/ jsxDEV(CustomSelect, {
                                            value: activeWeightFraction,
                                            onChange: setCustomWeightFraction,
                                            options: weightFractionOptions.length > 0 ? weightFractionOptions.map((fraction)=>({
                                                    value: fraction,
                                                    label: fraction
                                                })) : [
                                                {
                                                    value: '',
                                                    label: 'Frakcija'
                                                }
                                            ],
                                            disabled: weightFractionOptions.length === 0,
                                            ariaLabel: "Izberi frakcijo",
                                            containerClassName: "w-full",
                                            triggerClassName: simulatorSelectTriggerClassName,
                                            triggerStyle: simulatorControlValueStyle,
                                            valueClassName: simulatorSelectValueClassName,
                                            valueStyle: simulatorControlValueStyle
                                        }, void 0, false, {
                                            fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                            lineNumber: 3960,
                                            columnNumber: 17
                                        }, this)
                                    }, void 0, false, {
                                        fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                        lineNumber: 3959,
                                        columnNumber: 15
                                    }, this),
                                    /*#__PURE__*/ jsxDEV(SimulatorControlField, {
                                        label: "Skupna masa",
                                        children: /*#__PURE__*/ jsxDEV("span", {
                                            className: "flex h-[30px] rounded-md border border-slate-300 bg-white",
                                            children: [
                                                /*#__PURE__*/ jsxDEV(DecimalDraftInput, {
                                                    className: `h-full min-w-0 flex-1 rounded-l-md border-0 bg-transparent px-2.5 outline-none focus:ring-0 ${simulatorControlValueClassName}`,
                                                    style: simulatorControlValueStyle,
                                                    value: (0, formatDecimalForDisplay)(customWeightNetMass),
                                                    onDecimalChange: (value)=>setCustomWeightNetMass(Math.max(0, value))
                                                }, void 0, false, {
                                                    fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                    lineNumber: 3977,
                                                    columnNumber: 19
                                                }, this),
                                                /*#__PURE__*/ jsxDEV("span", {
                                                    className: fieldUnitAdornmentClassName,
                                                    style: getUnitAdornmentStyle('kg'),
                                                    children: "kg"
                                                }, void 0, false, {
                                                    fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                    lineNumber: 3983,
                                                    columnNumber: 19
                                                }, this)
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                            lineNumber: 3976,
                                            columnNumber: 17
                                        }, this)
                                    }, void 0, false, {
                                        fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                        lineNumber: 3975,
                                        columnNumber: 15
                                    }, this),
                                    /*#__PURE__*/ jsxDEV(SimulatorControlField, {
                                        label: "Vrečke",
                                        children: /*#__PURE__*/ jsxDEV("input", {
                                            inputMode: "numeric",
                                            className: `h-[30px] w-full rounded-md border border-slate-300 bg-white px-2.5 text-center outline-none focus:border-[#3e67d6] focus:ring-0 ${simulatorControlValueClassName}`,
                                            style: simulatorControlValueStyle,
                                            value: customWeightBagCount,
                                            onChange: (event)=>setCustomWeightBagCount(Math.max(1, Math.floor(Number(event.target.value) || 1)))
                                        }, void 0, false, {
                                            fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                            lineNumber: 3987,
                                            columnNumber: 17
                                        }, this)
                                    }, void 0, false, {
                                        fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                        lineNumber: 3986,
                                        columnNumber: 15
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                lineNumber: 3958,
                                columnNumber: 13
                            }, this),
                            /*#__PURE__*/ jsxDEV(SimulatorOverviewCards, {
                                itemIcon: simulatorItemIcon,
                                stockIcon: simulatorStockIcon,
                                title: "Izbrana frakcija",
                                sku: activeSimulatorOption ? getSimulatorOptionSku(activeSimulatorOption) : '—',
                                grossPrice: `${(0, formatCurrency)(customWeightScenario.withVat)} z DDV`,
                                netPrice: `${(0, formatCurrency)(customWeightScenario.withoutVat)} brez DDV`,
                                discountPercent: customWeightScenario.discountPercent,
                                discountRange: getSimulatorDiscountRange(activeSimulatorDiscount, nextSimulatorDiscount, activeSimulatorUnit),
                                nextDiscountLabel: getSimulatorNextDiscountLabel(nextSimulatorDiscount, activeSimulatorUnit),
                                stockLabel: activeSimulatorOption?.stockLabel,
                                minOrderLabel: activeSimulatorOption?.minOrderLabel
                            }, void 0, false, {
                                fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                lineNumber: 3996,
                                columnNumber: 13
                            }, this),
                            /*#__PURE__*/ jsxDEV(WeightSimulatorQuickSelections, {
                                massValues: quickSimulatorQuantities,
                                activeMass: customWeightNetMass,
                                bagValues: quickWeightBagCounts,
                                activeBagCount: customWeightBagCount,
                                onMassSelect: setCustomWeightNetMass,
                                onBagSelect: setCustomWeightBagCount
                            }, void 0, false, {
                                fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                lineNumber: 4009,
                                columnNumber: 13
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                        lineNumber: 3952,
                        columnNumber: 11
                    }, this) : productType === 'dimensions' ? /*#__PURE__*/ jsxDEV("section", {
                        className: `${adminWindowCardClassName} h-full p-5`,
                        style: adminWindowCardStyle,
                        children: [
                            /*#__PURE__*/ jsxDEV(SimulatorHeader, {
                                description: "Pregled izračuna za izbrano dimenzijsko različico, količino in količinski popust.",
                                applyQuantityDiscounts: applyQuantityDiscounts,
                                onApplyQuantityDiscountsChange: onApplyQuantityDiscountsChange
                            }, void 0, false, {
                                fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                lineNumber: 4020,
                                columnNumber: 13
                            }, this),
                            /*#__PURE__*/ jsxDEV("div", {
                                className: "mt-5 grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(150px,0.58fr)]",
                                children: [
                                    /*#__PURE__*/ jsxDEV(SimulatorControlField, {
                                        label: "Izbrana različica",
                                        children: /*#__PURE__*/ jsxDEV(CustomSelect, {
                                            value: selectedOption?.id ?? '',
                                            onChange: onSelectedOptionIdChange,
                                            options: simulatorSelectOptions,
                                            disabled: simulatorOptions.length === 0,
                                            ariaLabel: "Izberi dimenzijsko različico",
                                            containerClassName: "w-full",
                                            triggerClassName: simulatorSelectTriggerClassName,
                                            triggerStyle: simulatorControlValueStyle,
                                            valueClassName: simulatorSelectValueClassName,
                                            valueStyle: simulatorControlValueStyle
                                        }, void 0, false, {
                                            fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                            lineNumber: 4027,
                                            columnNumber: 17
                                        }, this)
                                    }, void 0, false, {
                                        fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                        lineNumber: 4026,
                                        columnNumber: 15
                                    }, this),
                                    /*#__PURE__*/ jsxDEV(SimulatorControlField, {
                                        label: "Količina",
                                        children: /*#__PURE__*/ jsxDEV("span", {
                                            className: "flex h-[30px] rounded-md border border-slate-300 bg-white",
                                            children: [
                                                /*#__PURE__*/ jsxDEV("input", {
                                                    type: "number",
                                                    min: 1,
                                                    className: `h-full min-w-0 flex-1 rounded-l-md border-0 bg-transparent px-2.5 outline-none focus:ring-0 ${simulatorControlValueClassName}`,
                                                    style: simulatorControlValueStyle,
                                                    value: normalizedQuantity,
                                                    onChange: (event)=>onQuantityChange(Math.max(1, Number(event.target.value) || 1))
                                                }, void 0, false, {
                                                    fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                    lineNumber: 4042,
                                                    columnNumber: 19
                                                }, this),
                                                /*#__PURE__*/ jsxDEV("span", {
                                                    className: fieldUnitAdornmentClassName,
                                                    style: getSimulatorUnitAdornmentStyle(quantityUnit),
                                                    children: quantityUnitLabel
                                                }, void 0, false, {
                                                    fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                    lineNumber: 4050,
                                                    columnNumber: 19
                                                }, this)
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                            lineNumber: 4041,
                                            columnNumber: 17
                                        }, this)
                                    }, void 0, false, {
                                        fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                        lineNumber: 4040,
                                        columnNumber: 15
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                lineNumber: 4025,
                                columnNumber: 13
                            }, this),
                            /*#__PURE__*/ jsxDEV(SimulatorOverviewCards, {
                                itemIcon: simulatorItemIcon,
                                stockIcon: simulatorStockIcon,
                                sku: selectedOption ? getSimulatorOptionSku(selectedOption) : '—',
                                grossPrice: `${(0, formatCurrency)(toGrossWithVat(basePrice))} z DDV`,
                                netPrice: `${(0, formatCurrency)(basePrice)} brez DDV`,
                                discountPercent: discountPercent,
                                discountRange: getSimulatorDiscountRange(activeSimulatorDiscount, nextSimulatorDiscount, activeSimulatorUnit),
                                nextDiscountLabel: getSimulatorNextDiscountLabel(nextSimulatorDiscount, activeSimulatorUnit),
                                stockLabel: selectedOption?.stockLabel,
                                minOrderLabel: selectedOption?.minOrderLabel
                            }, void 0, false, {
                                fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                lineNumber: 4054,
                                columnNumber: 13
                            }, this),
                            /*#__PURE__*/ jsxDEV(SimulatorQuickButtons, {
                                values: quickSimulatorQuantities,
                                activeValue: normalizedQuantity,
                                disabled: false,
                                onSelect: onQuantityChange
                            }, void 0, false, {
                                fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                lineNumber: 4066,
                                columnNumber: 13
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                        lineNumber: 4019,
                        columnNumber: 11
                    }, this) : productType === 'unique_machine' ? /*#__PURE__*/ jsxDEV("section", {
                        className: `${adminWindowCardClassName} h-full p-5`,
                        style: adminWindowCardStyle,
                        children: [
                            /*#__PURE__*/ jsxDEV(SimulatorHeader, {
                                description: "Pregled izračuna za izbrani stroj, količino in količinski popust.",
                                applyQuantityDiscounts: applyQuantityDiscounts,
                                onApplyQuantityDiscountsChange: onApplyQuantityDiscountsChange
                            }, void 0, false, {
                                fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                lineNumber: 4075,
                                columnNumber: 13
                            }, this),
                            /*#__PURE__*/ jsxDEV("div", {
                                className: "mt-5 grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(150px,0.58fr)]",
                                children: [
                                    /*#__PURE__*/ jsxDEV(SimulatorControlField, {
                                        label: "Izbrani stroj",
                                        children: /*#__PURE__*/ jsxDEV(CustomSelect, {
                                            value: selectedOption?.id ?? '',
                                            onChange: onSelectedOptionIdChange,
                                            options: simulatorSelectOptions,
                                            disabled: simulatorOptions.length === 0,
                                            ariaLabel: "Izberi stroj",
                                            containerClassName: "w-full",
                                            triggerClassName: simulatorSelectTriggerClassName,
                                            triggerStyle: simulatorControlValueStyle,
                                            valueClassName: simulatorSelectValueClassName,
                                            valueStyle: simulatorControlValueStyle
                                        }, void 0, false, {
                                            fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                            lineNumber: 4082,
                                            columnNumber: 17
                                        }, this)
                                    }, void 0, false, {
                                        fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                        lineNumber: 4081,
                                        columnNumber: 15
                                    }, this),
                                    /*#__PURE__*/ jsxDEV(SimulatorControlField, {
                                        label: "Količina",
                                        children: /*#__PURE__*/ jsxDEV("span", {
                                            className: "flex h-[30px] rounded-md border border-slate-300 bg-white",
                                            children: [
                                                /*#__PURE__*/ jsxDEV("input", {
                                                    type: "number",
                                                    min: 1,
                                                    className: `h-full min-w-0 flex-1 rounded-l-md border-0 bg-transparent px-2.5 outline-none focus:ring-0 ${simulatorControlValueClassName}`,
                                                    style: simulatorControlValueStyle,
                                                    value: normalizedQuantity,
                                                    onChange: (event)=>onQuantityChange(Math.max(1, Number(event.target.value) || 1))
                                                }, void 0, false, {
                                                    fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                    lineNumber: 4097,
                                                    columnNumber: 19
                                                }, this),
                                                /*#__PURE__*/ jsxDEV("span", {
                                                    className: fieldUnitAdornmentClassName,
                                                    style: getSimulatorUnitAdornmentStyle(quantityUnit),
                                                    children: quantityUnitLabel
                                                }, void 0, false, {
                                                    fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                    lineNumber: 4105,
                                                    columnNumber: 19
                                                }, this)
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                            lineNumber: 4096,
                                            columnNumber: 17
                                        }, this)
                                    }, void 0, false, {
                                        fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                        lineNumber: 4095,
                                        columnNumber: 15
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                lineNumber: 4080,
                                columnNumber: 13
                            }, this),
                            /*#__PURE__*/ jsxDEV(SimulatorOverviewCards, {
                                itemIcon: simulatorItemIcon,
                                stockIcon: simulatorStockIcon,
                                title: "Izbrani stroj",
                                sku: selectedOption ? getSimulatorOptionSku(selectedOption) : '—',
                                grossPrice: `${(0, formatCurrency)(toGrossWithVat(basePrice))} z DDV`,
                                netPrice: `${(0, formatCurrency)(basePrice)} brez DDV`,
                                discountPercent: discountPercent,
                                discountRange: getSimulatorDiscountRange(activeSimulatorDiscount, nextSimulatorDiscount, activeSimulatorUnit),
                                nextDiscountLabel: getSimulatorNextDiscountLabel(nextSimulatorDiscount, activeSimulatorUnit),
                                stockLabel: selectedOption?.stockLabel,
                                minOrderLabel: selectedOption?.minOrderLabel
                            }, void 0, false, {
                                fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                lineNumber: 4109,
                                columnNumber: 13
                            }, this),
                            /*#__PURE__*/ jsxDEV(SimulatorQuickButtons, {
                                values: quickSimulatorQuantities,
                                activeValue: normalizedQuantity,
                                disabled: false,
                                onSelect: onQuantityChange
                            }, void 0, false, {
                                fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                lineNumber: 4122,
                                columnNumber: 13
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                        lineNumber: 4074,
                        columnNumber: 11
                    }, this) : /*#__PURE__*/ jsxDEV("section", {
                        className: `${adminWindowCardClassName} h-full p-5`,
                        style: adminWindowCardStyle,
                        children: [
                            /*#__PURE__*/ jsxDEV(SimulatorHeader, {
                                description: "Predogled izračuna na podlagi izbrane različice, količine in pravil popustov.",
                                applyQuantityDiscounts: applyQuantityDiscounts,
                                onApplyQuantityDiscountsChange: onApplyQuantityDiscountsChange
                            }, void 0, false, {
                                fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                lineNumber: 4131,
                                columnNumber: 13
                            }, this),
                            /*#__PURE__*/ jsxDEV("div", {
                                className: "mt-4 grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_160px]",
                                children: [
                                    /*#__PURE__*/ jsxDEV(SimulatorControlField, {
                                        label: "Izbrani artikel",
                                        children: simulatorOptions.length > 1 ? /*#__PURE__*/ jsxDEV(CustomSelect, {
                                            value: selectedOption?.id ?? '',
                                            onChange: onSelectedOptionIdChange,
                                            options: simulatorSelectOptions,
                                            disabled: simulatorOptions.length === 0,
                                            ariaLabel: "Izberi artikel",
                                            containerClassName: "w-full",
                                            triggerClassName: simulatorSelectTriggerClassName,
                                            triggerStyle: simulatorControlValueStyle,
                                            valueClassName: simulatorSelectValueClassName,
                                            valueStyle: simulatorControlValueStyle
                                        }, void 0, false, {
                                            fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                            lineNumber: 4139,
                                            columnNumber: 19
                                        }, this) : /*#__PURE__*/ jsxDEV("div", {
                                            className: `flex h-[30px] w-full items-center rounded-md border border-slate-300 bg-slate-50 px-3 ${simulatorControlValueClassName}`,
                                            style: simulatorControlValueStyle,
                                            children: /*#__PURE__*/ jsxDEV("span", {
                                                className: "min-w-0 truncate",
                                                children: selectedOption?.label ?? '—'
                                            }, void 0, false, {
                                                fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                lineNumber: 4153,
                                                columnNumber: 21
                                            }, this)
                                        }, void 0, false, {
                                            fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                            lineNumber: 4152,
                                            columnNumber: 19
                                        }, this)
                                    }, void 0, false, {
                                        fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                        lineNumber: 4137,
                                        columnNumber: 15
                                    }, this),
                                    /*#__PURE__*/ jsxDEV(SimulatorControlField, {
                                        label: "Količina",
                                        children: /*#__PURE__*/ jsxDEV("span", {
                                            className: "flex h-[30px] rounded-md border border-slate-300 bg-white",
                                            children: [
                                                /*#__PURE__*/ jsxDEV("input", {
                                                    type: "number",
                                                    min: 1,
                                                    className: `h-full min-w-0 flex-1 rounded-l-md border-0 bg-transparent px-2.5 outline-none focus:ring-0 ${simulatorControlValueClassName}`,
                                                    style: simulatorControlValueStyle,
                                                    value: normalizedQuantity,
                                                    onChange: (event)=>onQuantityChange(Math.max(1, Number(event.target.value) || 1))
                                                }, void 0, false, {
                                                    fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                    lineNumber: 4159,
                                                    columnNumber: 19
                                                }, this),
                                                /*#__PURE__*/ jsxDEV("span", {
                                                    className: fieldUnitAdornmentClassName,
                                                    style: getSimulatorUnitAdornmentStyle(quantityUnit),
                                                    children: quantityUnitLabel
                                                }, void 0, false, {
                                                    fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                    lineNumber: 4167,
                                                    columnNumber: 19
                                                }, this)
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                            lineNumber: 4158,
                                            columnNumber: 17
                                        }, this)
                                    }, void 0, false, {
                                        fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                        lineNumber: 4157,
                                        columnNumber: 15
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                lineNumber: 4136,
                                columnNumber: 13
                            }, this),
                            /*#__PURE__*/ jsxDEV(SimulatorOverviewCards, {
                                itemIcon: simulatorItemIcon,
                                stockIcon: simulatorStockIcon,
                                title: "Izbrani artikel",
                                sku: selectedOption ? getSimulatorOptionSku(selectedOption) : '—',
                                grossPrice: `${(0, formatCurrency)(toGrossWithVat(basePrice))} z DDV`,
                                netPrice: `${(0, formatCurrency)(basePrice)} brez DDV`,
                                discountPercent: discountPercent,
                                discountRange: getSimulatorDiscountRange(activeSimulatorDiscount, nextSimulatorDiscount, activeSimulatorUnit),
                                nextDiscountLabel: getSimulatorNextDiscountLabel(nextSimulatorDiscount, activeSimulatorUnit),
                                stockLabel: selectedOption?.stockLabel,
                                minOrderLabel: selectedOption?.minOrderLabel
                            }, void 0, false, {
                                fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                lineNumber: 4171,
                                columnNumber: 13
                            }, this),
                            /*#__PURE__*/ jsxDEV(SimulatorQuickButtons, {
                                values: quickSimulatorQuantities,
                                activeValue: normalizedQuantity,
                                disabled: false,
                                onSelect: onQuantityChange
                            }, void 0, false, {
                                fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                lineNumber: 4184,
                                columnNumber: 13
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                        lineNumber: 4130,
                        columnNumber: 11
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                lineNumber: 3819,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ jsxDEV(OrderSummaryCard, {
                compact: usesScopedCommercialTools,
                detailRows: orderSummaryDetailRows,
                calculationRows: orderSummaryCalculationRows,
                total: (0, formatCurrency)(summaryTotal)
            }, void 0, false, {
                fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                lineNumber: 4194,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
        lineNumber: 3818,
        columnNumber: 5
    }, this);
}
_s5(CommercialToolsPanel, "QZvxFmIl+qbDZf1i4sPLcs8Gfys=");
const DimensionOrderPricingPanel = CommercialToolsPanel;
function SimulatorHeader({ description, applyQuantityDiscounts, onApplyQuantityDiscountsChange }) {
    return /*#__PURE__*/ jsxDEV("div", {
        className: "grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-3 gap-y-2",
        children: [
            /*#__PURE__*/ jsxDEV("h2", {
                className: "min-w-0 text-[20px] font-semibold tracking-tight text-slate-900",
                children: "Simulator cene naročila"
            }, void 0, false, {
                fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                lineNumber: 4217,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ jsxDEV("label", {
                className: "flex shrink-0 items-center gap-2.5 justify-self-end pt-0.5",
                children: [
                    /*#__PURE__*/ jsxDEV("input", {
                        type: "checkbox",
                        className: "peer sr-only",
                        checked: applyQuantityDiscounts,
                        onChange: (event)=>onApplyQuantityDiscountsChange(event.target.checked)
                    }, void 0, false, {
                        fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                        lineNumber: 4219,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ jsxDEV("span", {
                        className: "relative inline-flex h-5 w-9 shrink-0 rounded-full bg-slate-300 transition peer-checked:bg-[#1982bf] after:absolute after:left-0.5 after:top-0.5 after:h-4 after:w-4 after:rounded-full after:bg-white after:transition peer-checked:after:translate-x-4"
                    }, void 0, false, {
                        fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                        lineNumber: 4225,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ jsxDEV("span", {
                        className: "min-w-0",
                        children: [
                            /*#__PURE__*/ jsxDEV("span", {
                                className: "block whitespace-nowrap text-[13px] font-semibold text-slate-700",
                                children: "Upoštevaj količinske popuste"
                            }, void 0, false, {
                                fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                lineNumber: 4227,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ jsxDEV("span", {
                                className: "block truncate text-[11px] text-slate-500",
                                children: "Pragovi iz tabele"
                            }, void 0, false, {
                                fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                lineNumber: 4228,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                        lineNumber: 4226,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                lineNumber: 4218,
                columnNumber: 7
            }, this),
            description ? /*#__PURE__*/ jsxDEV("p", {
                className: "col-span-2 mb-2 mt-1 text-[13px] font-normal leading-5 text-slate-500",
                children: description
            }, void 0, false, {
                fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                lineNumber: 4231,
                columnNumber: 22
            }, this) : null
        ]
    }, void 0, true, {
        fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
        lineNumber: 4216,
        columnNumber: 5
    }, this);
}
function SimulatorControlField({ label, children }) {
    return /*#__PURE__*/ jsxDEV("label", {
        className: "block",
        children: [
            /*#__PURE__*/ jsxDEV("span", {
                className: "mb-1.5 block text-[13px] font-semibold text-slate-600",
                children: label
            }, void 0, false, {
                fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                lineNumber: 4239,
                columnNumber: 7
            }, this),
            children
        ]
    }, void 0, true, {
        fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
        lineNumber: 4238,
        columnNumber: 5
    }, this);
}
function SimulatorCardIcon({ type }) {
    return /*#__PURE__*/ jsxDEV("span", {
        className: "inline-flex h-9 w-9 items-center justify-center rounded-full bg-[#eaf4ff] text-[#1982bf]",
        children: /*#__PURE__*/ jsxDEV(OrderSummaryIcon, {
            type: type,
            compact: true,
            className: "text-[#1982bf]"
        }, void 0, false, {
            fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
            lineNumber: 4248,
            columnNumber: 7
        }, this)
    }, void 0, false, {
        fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
        lineNumber: 4247,
        columnNumber: 5
    }, this);
}
function SimulatorMetricCard({ icon, title, children }) {
    return /*#__PURE__*/ jsxDEV("article", {
        className: "rounded-lg border border-slate-200 bg-white p-3.5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]",
        children: [
            /*#__PURE__*/ jsxDEV("div", {
                className: "flex items-center gap-2.5",
                children: [
                    /*#__PURE__*/ jsxDEV(SimulatorCardIcon, {
                        type: icon
                    }, void 0, false, {
                        fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                        lineNumber: 4265,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ jsxDEV("h3", {
                        className: "whitespace-nowrap text-[14px] font-semibold text-slate-900",
                        children: title
                    }, void 0, false, {
                        fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                        lineNumber: 4266,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                lineNumber: 4264,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ jsxDEV("div", {
                className: "my-2 border-t border-dashed border-slate-200"
            }, void 0, false, {
                fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                lineNumber: 4268,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ jsxDEV("div", {
                className: "space-y-1.5 text-[12px] leading-4 text-slate-500",
                children: children
            }, void 0, false, {
                fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                lineNumber: 4269,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
        lineNumber: 4263,
        columnNumber: 5
    }, this);
}
function formatSimulatorAmount(value) {
    return (0, formatDecimalForDisplay)(Number(value.toFixed(2)));
}
function getSimulatorRangeEndBefore(nextMinQuantity) {
    if (Number.isInteger(nextMinQuantity)) return Math.max(0, nextMinQuantity - 1);
    return Math.max(0, Number((nextMinQuantity - 0.01).toFixed(2)));
}
function getSimulatorDiscountRange(activeDiscount, nextDiscount, unit) {
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
function getSimulatorNextDiscountLabel(nextDiscount, unit) {
    if (!nextDiscount) return {
        value: 'najvišji prag dosežen',
        topReached: true
    };
    return {
        value: `${formatSimulatorAmount(nextDiscount.minQuantity)} ${getSimulatorUnitLabel(unit, nextDiscount.minQuantity)} → ${formatPercent(nextDiscount.discountPercent)}`,
        topReached: false
    };
}
function isEmptySimulatorStock(stockLabel) {
    if (!stockLabel) return false;
    const match = stockLabel.trim().match(/^(-?\d+(?:[,.]\d+)?)/);
    if (!match) return false;
    return Number((match[1] ?? '').replace(',', '.')) <= 0;
}
function SimulatorOverviewCards({ itemIcon, stockIcon, title = 'Izbrana različica', sku, grossPrice, netPrice, discountPercent, discountRange, nextDiscountLabel, stockLabel, minOrderLabel }) {
    const stockEmpty = isEmptySimulatorStock(stockLabel);
    return /*#__PURE__*/ jsxDEV("div", {
        className: "mt-5 grid gap-3 md:grid-cols-3",
        children: [
            /*#__PURE__*/ jsxDEV(SimulatorMetricCard, {
                icon: itemIcon,
                title: title,
                children: [
                    /*#__PURE__*/ jsxDEV("p", {
                        children: [
                            "SKU: ",
                            /*#__PURE__*/ jsxDEV("span", {
                                className: "font-medium text-slate-700",
                                children: sku
                            }, void 0, false, {
                                fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                lineNumber: 4348,
                                columnNumber: 17
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                        lineNumber: 4348,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ jsxDEV("p", {
                        className: "pt-0.5 text-[13px] font-semibold text-slate-900",
                        children: grossPrice
                    }, void 0, false, {
                        fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                        lineNumber: 4349,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ jsxDEV("p", {
                        children: netPrice
                    }, void 0, false, {
                        fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                        lineNumber: 4350,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                lineNumber: 4347,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ jsxDEV(SimulatorMetricCard, {
                icon: "discount",
                title: "Popust",
                children: [
                    /*#__PURE__*/ jsxDEV("p", {
                        children: [
                            /*#__PURE__*/ jsxDEV("span", {
                                className: "text-[13px] font-semibold text-[#1982bf]",
                                children: formatCompactPercent(discountPercent)
                            }, void 0, false, {
                                fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                lineNumber: 4354,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ jsxDEV("span", {
                                className: "font-medium text-slate-500",
                                children: [
                                    " na ",
                                    discountRange
                                ]
                            }, void 0, true, {
                                fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                lineNumber: 4355,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                        lineNumber: 4353,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ jsxDEV("p", {
                        className: "text-[11px] leading-4",
                        children: [
                            /*#__PURE__*/ jsxDEV("span", {
                                children: "Naslednji prag: "
                            }, void 0, false, {
                                fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                lineNumber: 4358,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ jsxDEV("span", {
                                className: nextDiscountLabel.topReached ? 'break-words' : 'whitespace-nowrap',
                                children: nextDiscountLabel.value
                            }, void 0, false, {
                                fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                lineNumber: 4359,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                        lineNumber: 4357,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                lineNumber: 4352,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ jsxDEV(SimulatorMetricCard, {
                icon: stockIcon,
                title: "Zaloga",
                children: [
                    /*#__PURE__*/ jsxDEV("p", {
                        className: "text-[13px] font-semibold text-[#1982bf]",
                        children: stockLabel || '—'
                    }, void 0, false, {
                        fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                        lineNumber: 4363,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ jsxDEV("p", {
                        children: stockEmpty ? 'Ni na zalogi' : 'Na voljo'
                    }, void 0, false, {
                        fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                        lineNumber: 4364,
                        columnNumber: 9
                    }, this),
                    minOrderLabel ? /*#__PURE__*/ jsxDEV("p", {
                        children: [
                            "Min. naročilo: ",
                            minOrderLabel
                        ]
                    }, void 0, true, {
                        fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                        lineNumber: 4365,
                        columnNumber: 26
                    }, this) : null
                ]
            }, void 0, true, {
                fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                lineNumber: 4362,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
        lineNumber: 4346,
        columnNumber: 5
    }, this);
}
function WeightSimulatorQuickSelections({ massValues, activeMass, bagValues, activeBagCount, onMassSelect, onBagSelect }) {
    return /*#__PURE__*/ jsxDEV("div", {
        className: "mt-5",
        children: [
            /*#__PURE__*/ jsxDEV("h3", {
                className: "text-[13px] font-semibold text-slate-900",
                children: "Hitri izračuni"
            }, void 0, false, {
                fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                lineNumber: 4388,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ jsxDEV(QuickSelectionRow, {
                label: "Skupna masa",
                values: massValues,
                activeValue: activeMass,
                unit: "kg",
                onSelect: onMassSelect
            }, void 0, false, {
                fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                lineNumber: 4389,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ jsxDEV(QuickSelectionRow, {
                label: "Vrečke",
                values: bagValues,
                activeValue: activeBagCount,
                onSelect: onBagSelect
            }, void 0, false, {
                fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                lineNumber: 4396,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
        lineNumber: 4387,
        columnNumber: 5
    }, this);
}
function QuickSelectionRow({ label, values, activeValue, unit, onSelect }) {
    return /*#__PURE__*/ jsxDEV("div", {
        className: "mt-2.5 grid items-center gap-2 sm:grid-cols-[94px_minmax(0,1fr)]",
        children: [
            /*#__PURE__*/ jsxDEV("span", {
                className: "text-[12px] font-semibold text-slate-600",
                children: label
            }, void 0, false, {
                fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                lineNumber: 4421,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ jsxDEV("div", {
                className: "grid grid-cols-2 gap-2 sm:grid-cols-4",
                children: values.map((value)=>{
                    const active = Math.abs(activeValue - value) < 0.001;
                    return /*#__PURE__*/ jsxDEV("button", {
                        type: "button",
                        "aria-pressed": active,
                        onClick: ()=>onSelect(value),
                        className: classNames('h-9 rounded-md border text-[12px] font-semibold transition', active ? 'border-[#1982bf] bg-[#1982bf] text-white shadow-[0_8px_18px_rgba(25,130,191,0.18)]' : 'border-slate-200 bg-white text-slate-600 hover:border-[#1982bf] hover:text-[#1982bf]'),
                        children: [
                            value,
                            unit ? ` ${unit}` : ''
                        ]
                    }, `${label}-${value}`, true, {
                        fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                        lineNumber: 4426,
                        columnNumber: 13
                    }, this);
                })
            }, void 0, false, {
                fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                lineNumber: 4422,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
        lineNumber: 4420,
        columnNumber: 5
    }, this);
}
function SimulatorQuickButtons({ values, activeValue, disabled, onSelect }) {
    return /*#__PURE__*/ jsxDEV("div", {
        className: "mt-5",
        children: [
            /*#__PURE__*/ jsxDEV("h3", {
                className: "text-[13px] font-semibold text-slate-900",
                children: "Hitri izračuni"
            }, void 0, false, {
                fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                lineNumber: 4460,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ jsxDEV("div", {
                className: "mt-2.5 grid grid-cols-2 gap-3 sm:grid-cols-4",
                children: values.map((value)=>{
                    const active = Math.abs(activeValue - value) < 0.001;
                    return /*#__PURE__*/ jsxDEV("button", {
                        type: "button",
                        "aria-pressed": active,
                        disabled: disabled,
                        onClick: ()=>onSelect(value),
                        className: classNames('h-9 rounded-md border text-[13px] font-semibold transition disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400', active ? 'border-[#1982bf] bg-[#1982bf] text-white shadow-[0_8px_18px_rgba(25,130,191,0.18)]' : 'border-[#1982bf] bg-white text-[#1982bf] hover:bg-[#f2f8ff]'),
                        children: value
                    }, value, false, {
                        fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                        lineNumber: 4465,
                        columnNumber: 13
                    }, this);
                })
            }, void 0, false, {
                fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                lineNumber: 4461,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
        lineNumber: 4459,
        columnNumber: 5
    }, this);
}
function MachineSerialStatusChip({ status }) {
    return /*#__PURE__*/ jsxDEV(Chip, {
        size: "adminStatusInfo",
        variant: machineSerialStatusVariant[status],
        className: adminStatusInfoPillVariantTableClassName,
        children: getMachineSerialStatusLabel(status)
    }, void 0, false, {
        fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
        lineNumber: 4489,
        columnNumber: 5
    }, this);
}
function MachineSerialStatusSelect({ value, editable, onChange }) {
    if (!editable) return /*#__PURE__*/ jsxDEV(MachineSerialStatusChip, {
        status: value
    }, void 0, false, {
        fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
        lineNumber: 4504,
        columnNumber: 25
    }, this);
    return /*#__PURE__*/ jsxDEV(CustomSelect, {
        value: value,
        onChange: onChange,
        options: machineSerialStatusOptions,
        ariaLabel: "Status serijske številke",
        containerClassName: "mx-auto w-[132px]",
        triggerClassName: "!h-[30px] !rounded-lg !border-slate-200 !bg-white !px-2 !py-0 !text-[12px] !font-semibold !leading-none !text-slate-700",
        valueClassName: "!text-center !font-semibold",
        menuClassName: "min-w-full"
    }, void 0, false, {
        fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
        lineNumber: 4507,
        columnNumber: 5
    }, this);
}
function NumberField({ label, value, suffix, compact = false, editable, onChange }) {
    return /*#__PURE__*/ jsxDEV("label", {
        className: "block",
        children: [
            label ? /*#__PURE__*/ jsxDEV("span", {
                className: smallLabelClassName,
                children: label
            }, void 0, false, {
                fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                lineNumber: 4537,
                columnNumber: 16
            }, this) : null,
            /*#__PURE__*/ jsxDEV("span", {
                className: classNames('flex rounded-md border border-slate-300 bg-white', compact ? 'h-[30px]' : 'h-9', !editable && 'bg-[color:var(--field-locked-bg)]'),
                children: [
                    /*#__PURE__*/ jsxDEV(DecimalDraftInput, {
                        className: classNames('h-full min-w-0 flex-1 rounded-l-md border-0 bg-transparent font-semibold text-slate-900 outline-none focus:ring-0 disabled:cursor-not-allowed disabled:bg-[color:var(--field-locked-bg)] disabled:text-slate-500', compact ? 'px-2 text-[12px]' : 'px-2.5 text-[13px]'),
                        disabled: !editable,
                        value: value,
                        onDecimalChange: onChange
                    }, void 0, false, {
                        fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                        lineNumber: 4539,
                        columnNumber: 9
                    }, this),
                    suffix ? /*#__PURE__*/ jsxDEV("span", {
                        className: fieldUnitAdornmentClassName,
                        style: getUnitAdornmentStyle(suffix),
                        children: suffix
                    }, void 0, false, {
                        fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                        lineNumber: 4548,
                        columnNumber: 19
                    }, this) : null
                ]
            }, void 0, true, {
                fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                lineNumber: 4538,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
        lineNumber: 4536,
        columnNumber: 5
    }, this);
}
function IntegerUnitField({ value, unitKind, compact = false, editable, onChange }) {
    const displayValue = String(Math.max(0, Math.floor(Number(value) || 0)));
    return /*#__PURE__*/ jsxDEV("span", {
        className: classNames('flex rounded-md border border-slate-300 bg-white', compact ? 'h-[30px]' : 'h-9', !editable && 'bg-[color:var(--field-locked-bg)]'),
        children: [
            /*#__PURE__*/ jsxDEV("input", {
                inputMode: "numeric",
                className: classNames('h-full min-w-0 flex-1 rounded-l-md border-0 bg-transparent font-semibold text-slate-900 outline-none focus:ring-0 disabled:cursor-not-allowed disabled:bg-[color:var(--field-locked-bg)] disabled:text-slate-500', compact ? 'px-2 text-[12px]' : 'px-2.5 text-[13px]'),
                disabled: !editable,
                value: displayValue,
                onChange: (event)=>{
                    const digits = event.target.value.replace(/\D/g, '').replace(/^0+(?=\d)/, '');
                    onChange(digits ? Number(digits) : 0);
                }
            }, void 0, false, {
                fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                lineNumber: 4571,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ jsxDEV("span", {
                className: fieldUnitAdornmentClassName,
                style: getQuantityUnitAdornmentStyle(unitKind),
                children: getInflectedQuantityUnit(displayValue, unitKind)
            }, void 0, false, {
                fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                lineNumber: 4584,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
        lineNumber: 4570,
        columnNumber: 5
    }, this);
}
function QuantityRangeUnitField({ value, unitKind, compact = false, editable, onChange }) {
    const displayValue = extractQuantityRange(value);
    return /*#__PURE__*/ jsxDEV("span", {
        className: classNames('flex rounded-md border border-slate-300 bg-white', compact ? 'h-[30px]' : 'h-9', !editable && 'bg-[color:var(--field-locked-bg)]'),
        children: [
            /*#__PURE__*/ jsxDEV("input", {
                inputMode: "numeric",
                className: classNames('h-full min-w-0 flex-1 rounded-l-md border-0 bg-transparent font-semibold text-slate-900 outline-none focus:ring-0 disabled:cursor-not-allowed disabled:bg-[color:var(--field-locked-bg)] disabled:text-slate-500', compact ? 'px-2 text-[12px]' : 'px-2.5 text-[13px]'),
                disabled: !editable,
                value: displayValue,
                onChange: (event)=>onChange(sanitizeQuantityRangeInput(event.target.value)),
                placeholder: "1-2"
            }, void 0, false, {
                fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                lineNumber: 4606,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ jsxDEV("span", {
                className: fieldUnitAdornmentClassName,
                style: getQuantityUnitAdornmentStyle(unitKind),
                children: getInflectedQuantityUnit(displayValue, unitKind)
            }, void 0, false, {
                fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                lineNumber: 4617,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
        lineNumber: 4605,
        columnNumber: 5
    }, this);
}
function splitSpecValueSuffix(value) {
    const trimmed = value.trim();
    if (!trimmed) return {
        main: '',
        suffix: ''
    };
    const match = trimmed.match(/^([0-9]+(?:[.,][0-9]+)?)\s+(.+)$/u);
    if (!match) return {
        main: trimmed,
        suffix: ''
    };
    return {
        main: match[1] ?? '',
        suffix: match[2] ?? ''
    };
}
function joinSpecValueSuffix(main, suffix) {
    const normalizedMain = main.trim();
    const normalizedSuffix = suffix.trim();
    return [
        normalizedMain,
        normalizedSuffix
    ].filter(Boolean).join(' ');
}
function splitPackageDimensionUnit(value) {
    const trimmed = value.trim();
    if (!trimmed) return {
        main: '',
        suffix: 'mm'
    };
    const match = trimmed.match(/^(.*\S)\s+([^\d\s]+)$/u);
    if (!match) return {
        main: trimmed,
        suffix: 'mm'
    };
    return {
        main: match[1] ?? '',
        suffix: match[2] ?? 'mm'
    };
}
function UnitSuffixInput({ value, fallback, minimumCharacters = 1, onChange }) {
    _s6();
    const [draft, setDraft] = (0, useState)(value);
    const [isFocused, setIsFocused] = (0, useState)(false);
    (0, useEffect)({
        "UnitSuffixInput.useEffect": ()=>{
            if (!isFocused) setDraft(value);
        }
    }["UnitSuffixInput.useEffect"], [
        isFocused,
        value
    ]);
    const visibleValue = isFocused ? draft : value;
    return /*#__PURE__*/ jsxDEV("input", {
        className: fieldUnitInputClassName,
        style: getUnitAdornmentStyle(visibleValue || fallback, minimumCharacters),
        value: visibleValue,
        autoComplete: "off",
        autoCorrect: "off",
        autoCapitalize: "off",
        spellCheck: false,
        onFocus: ()=>{
            setDraft(value);
            setIsFocused(true);
        },
        onBlur: ()=>{
            setIsFocused(false);
            setDraft(value);
        },
        onChange: (event)=>{
            const nextValue = event.currentTarget.value;
            setDraft(nextValue);
            onChange(nextValue);
        },
        placeholder: "enota"
    }, void 0, false, {
        fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
        lineNumber: 4665,
        columnNumber: 5
    }, this);
}
_s6(UnitSuffixInput, "z2627hADcGZHnqlsh2G5KhqtApM=");
function PackageDimensionField({ value, compact = false, editable, onChange }) {
    const { main, suffix } = splitPackageDimensionUnit(value);
    if (!editable) {
        return /*#__PURE__*/ jsxDEV("span", {
            className: classNames('flex rounded-md border border-slate-300 bg-[color:var(--field-locked-bg)]', compact ? 'h-[30px]' : 'h-9'),
            children: [
                /*#__PURE__*/ jsxDEV("span", {
                    className: classNames('inline-flex h-full min-w-0 flex-1 items-center font-semibold text-slate-600', compact ? 'px-2 text-[12px]' : 'px-2.5 text-[13px]'),
                    children: main || '—'
                }, void 0, false, {
                    fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                    lineNumber: 4707,
                    columnNumber: 9
                }, this),
                main ? /*#__PURE__*/ jsxDEV("span", {
                    className: fieldUnitAdornmentClassName,
                    style: getUnitAdornmentStyle(suffix || 'mm'),
                    children: suffix
                }, void 0, false, {
                    fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                    lineNumber: 4708,
                    columnNumber: 17
                }, this) : null
            ]
        }, void 0, true, {
            fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
            lineNumber: 4706,
            columnNumber: 7
        }, this);
    }
    return /*#__PURE__*/ jsxDEV("span", {
        className: classNames('flex rounded-md border border-slate-300 bg-white', compact ? 'h-[30px]' : 'h-9'),
        children: [
            /*#__PURE__*/ jsxDEV("input", {
                className: classNames('h-full min-w-0 flex-1 rounded-l-md border-0 bg-transparent font-semibold text-slate-900 outline-none focus:ring-0 disabled:cursor-not-allowed disabled:bg-[color:var(--field-locked-bg)] disabled:text-slate-500', compact ? 'px-2 text-[12px]' : 'px-2.5 text-[13px]'),
                value: main,
                onChange: (event)=>onChange(joinSpecValueSuffix(event.target.value, suffix))
            }, void 0, false, {
                fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                lineNumber: 4715,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ jsxDEV(UnitSuffixInput, {
                value: suffix,
                fallback: "mm",
                minimumCharacters: 2,
                onChange: (nextSuffix)=>onChange(joinSpecValueSuffix(main, nextSuffix || 'mm'))
            }, void 0, false, {
                fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                lineNumber: 4723,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
        lineNumber: 4714,
        columnNumber: 5
    }, this);
}
function SpecValueField({ value, compact = false, editable, onChange }) {
    const { main, suffix } = splitSpecValueSuffix(value);
    if (!editable) {
        return /*#__PURE__*/ jsxDEV("span", {
            className: classNames('flex rounded-md border border-slate-300 bg-[color:var(--field-locked-bg)]', compact ? 'h-[30px]' : 'h-9'),
            children: [
                /*#__PURE__*/ jsxDEV("span", {
                    className: classNames('inline-flex h-full min-w-0 flex-1 items-center font-semibold text-slate-600', compact ? 'px-2 text-[12px]' : 'px-2.5 text-[13px]'),
                    children: main || '—'
                }, void 0, false, {
                    fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                    lineNumber: 4749,
                    columnNumber: 9
                }, this),
                suffix ? /*#__PURE__*/ jsxDEV("span", {
                    className: fieldUnitAdornmentClassName,
                    style: getUnitAdornmentStyle(suffix),
                    children: suffix
                }, void 0, false, {
                    fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                    lineNumber: 4750,
                    columnNumber: 19
                }, this) : null
            ]
        }, void 0, true, {
            fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
            lineNumber: 4748,
            columnNumber: 7
        }, this);
    }
    return /*#__PURE__*/ jsxDEV("span", {
        className: classNames('flex rounded-md border border-slate-300 bg-white', compact ? 'h-[30px]' : 'h-9'),
        children: [
            /*#__PURE__*/ jsxDEV("input", {
                className: classNames('h-full min-w-0 flex-1 rounded-l-md border-0 bg-transparent font-semibold text-slate-900 outline-none focus:ring-0 disabled:cursor-not-allowed disabled:bg-[color:var(--field-locked-bg)] disabled:text-slate-500', compact ? 'px-2 text-[12px]' : 'px-2.5 text-[13px]'),
                value: main,
                onChange: (event)=>onChange(joinSpecValueSuffix(event.target.value, suffix))
            }, void 0, false, {
                fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                lineNumber: 4757,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ jsxDEV(UnitSuffixInput, {
                value: suffix,
                fallback: "enota",
                minimumCharacters: 2,
                onChange: (nextSuffix)=>onChange(joinSpecValueSuffix(main, nextSuffix))
            }, void 0, false, {
                fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                lineNumber: 4765,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
        lineNumber: 4756,
        columnNumber: 5
    }, this);
}
function TextField({ label, value, suffix, compact = false, editable, onChange }) {
    return /*#__PURE__*/ jsxDEV("label", {
        className: "block",
        children: [
            label ? /*#__PURE__*/ jsxDEV("span", {
                className: smallLabelClassName,
                children: label
            }, void 0, false, {
                fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                lineNumber: 4792,
                columnNumber: 16
            }, this) : null,
            /*#__PURE__*/ jsxDEV("span", {
                className: classNames('flex rounded-md border border-slate-300 bg-white', compact ? 'h-[30px]' : 'h-9', !editable && 'bg-[color:var(--field-locked-bg)]'),
                children: [
                    /*#__PURE__*/ jsxDEV("input", {
                        className: classNames('h-full min-w-0 flex-1 rounded-l-md border-0 bg-transparent font-semibold text-slate-900 outline-none focus:ring-0 disabled:cursor-not-allowed disabled:bg-[color:var(--field-locked-bg)] disabled:text-slate-500', compact ? 'px-2 text-xs' : 'px-2.5 text-[13px]'),
                        disabled: !editable,
                        value: value,
                        onChange: (event)=>onChange(event.target.value)
                    }, void 0, false, {
                        fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                        lineNumber: 4794,
                        columnNumber: 9
                    }, this),
                    suffix ? /*#__PURE__*/ jsxDEV("span", {
                        className: fieldUnitAdornmentClassName,
                        style: getUnitAdornmentStyle(suffix),
                        children: suffix
                    }, void 0, false, {
                        fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                        lineNumber: 4803,
                        columnNumber: 19
                    }, this) : null
                ]
            }, void 0, true, {
                fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                lineNumber: 4793,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
        lineNumber: 4791,
        columnNumber: 5
    }, this);
}
function SelectField({ label, value, editable, options, className, onChange }) {
    return /*#__PURE__*/ jsxDEV("label", {
        className: classNames('block', className),
        children: [
            /*#__PURE__*/ jsxDEV("span", {
                className: smallLabelClassName,
                children: label
            }, void 0, false, {
                fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                lineNumber: 4826,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ jsxDEV("select", {
                className: fieldFrameClassName,
                disabled: !editable,
                value: value,
                onChange: (event)=>onChange(event.target.value),
                children: options.map((option)=>/*#__PURE__*/ jsxDEV("option", {
                        value: option.value,
                        children: option.label
                    }, option.value, false, {
                        fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                        lineNumber: 4828,
                        columnNumber: 34
                    }, this))
            }, void 0, false, {
                fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                lineNumber: 4827,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
        lineNumber: 4825,
        columnNumber: 5
    }, this);
}
function ToggleRow({ label, enabled, editable, onChange }) {
    return /*#__PURE__*/ jsxDEV("label", {
        className: "flex items-center justify-between gap-3 text-[13px] font-medium text-slate-700",
        children: [
            /*#__PURE__*/ jsxDEV("span", {
                children: label
            }, void 0, false, {
                fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                lineNumber: 4847,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ jsxDEV("input", {
                type: "checkbox",
                className: "peer sr-only",
                checked: enabled,
                disabled: !editable,
                onChange: (event)=>onChange(event.target.checked)
            }, void 0, false, {
                fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                lineNumber: 4848,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ jsxDEV("span", {
                className: "relative inline-flex h-5 w-9 shrink-0 rounded-full bg-slate-300 transition peer-checked:bg-emerald-500 peer-disabled:opacity-60 after:absolute after:left-0.5 after:top-0.5 after:h-4 after:w-4 after:rounded-full after:bg-white after:transition peer-checked:after:translate-x-4"
            }, void 0, false, {
                fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                lineNumber: 4849,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
        lineNumber: 4846,
        columnNumber: 5
    }, this);
}
function NumberInline({ value, suffix, compact = false, onChange }) {
    return /*#__PURE__*/ jsxDEV("span", {
        className: compact ? compactTableThirtyValueUnitShellClassName : compactTableValueUnitShellClassName,
        children: [
            /*#__PURE__*/ jsxDEV(DecimalDraftInput, {
                className: `${compact ? compactTableThirtyInputClassName : compactTableAlignedInputClassName} !mt-0 !w-16 text-right`,
                value: value,
                onDecimalChange: onChange
            }, void 0, false, {
                fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                lineNumber: 4867,
                columnNumber: 7
            }, this),
            suffix ? /*#__PURE__*/ jsxDEV("span", {
                className: compactTableAdornmentClassName,
                children: suffix
            }, void 0, false, {
                fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                lineNumber: 4872,
                columnNumber: 17
            }, this) : null
        ]
    }, void 0, true, {
        fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
        lineNumber: 4866,
        columnNumber: 5
    }, this);
}
function DecimalDraftInput({ value, className, style, disabled, onDecimalChange }) {
    _s7();
    const normalizedValue = typeof value === 'number' ? (0, formatDecimalForDisplay)(value) : value;
    const [draftValue, setDraftValue] = (0, useState)(normalizedValue);
    const [isFocused, setIsFocused] = (0, useState)(false);
    (0, useEffect)({
        "DecimalDraftInput.useEffect": ()=>{
            if (!isFocused) setDraftValue(normalizedValue);
        }
    }["DecimalDraftInput.useEffect"], [
        isFocused,
        normalizedValue
    ]);
    return /*#__PURE__*/ jsxDEV("input", {
        type: "text",
        inputMode: "decimal",
        className: className,
        style: style,
        disabled: disabled,
        value: isFocused ? draftValue : normalizedValue,
        onFocus: ()=>{
            setIsFocused(true);
            setDraftValue(normalizedValue);
        },
        onChange: (event)=>{
            const nextValue = event.target.value;
            setDraftValue(nextValue);
            const parsed = (0, parseDecimalInput)(nextValue);
            if (parsed !== null) onDecimalChange(parsed);
        },
        onBlur: ()=>{
            const parsed = (0, parseDecimalInput)(draftValue);
            if (parsed !== null) {
                onDecimalChange(parsed);
                setDraftValue((0, formatDecimalForDisplay)(parsed));
            } else {
                setDraftValue(normalizedValue);
            }
            setIsFocused(false);
        }
    }, void 0, false, {
        fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
        lineNumber: 4899,
        columnNumber: 5
    }, this);
}
_s7(DecimalDraftInput, "VioDKg+TXnaBWQaXUDtxJp5XF30=");
function VatIncludedPriceInline({ value, editable, inputSuffix, grossUnit, netUnit, onChange }) {
    const grossValue = toGrossWithVat(value);
    return /*#__PURE__*/ jsxDEV("span", {
        className: "inline-flex h-6 items-center justify-end gap-1 whitespace-nowrap text-[11px] text-slate-700",
        children: [
            editable ? /*#__PURE__*/ jsxDEV(NumberInline, {
                value: grossValue,
                suffix: inputSuffix,
                onChange: (nextGrossValue)=>onChange(toNetFromGross(nextGrossValue))
            }, void 0, false, {
                fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                lineNumber: 4949,
                columnNumber: 9
            }, this) : /*#__PURE__*/ jsxDEV("span", {
                className: compactTableValueUnitShellClassName,
                children: [
                    /*#__PURE__*/ jsxDEV("span", {
                        className: "inline-flex h-6 w-16 items-center justify-end rounded-md border border-transparent px-0.5 text-[11px] text-slate-900 tabular-nums",
                        children: (0, formatDecimalForDisplay)(grossValue)
                    }, void 0, false, {
                        fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                        lineNumber: 4952,
                        columnNumber: 11
                    }, this),
                    /*#__PURE__*/ jsxDEV("span", {
                        className: compactTableAdornmentClassName,
                        children: grossUnit
                    }, void 0, false, {
                        fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                        lineNumber: 4955,
                        columnNumber: 11
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                lineNumber: 4951,
                columnNumber: 9
            }, this),
            /*#__PURE__*/ jsxDEV("span", {
                className: "text-[11px] text-slate-500",
                children: [
                    "(",
                    (0, formatDecimalForDisplay)(value),
                    " ",
                    netUnit,
                    ")"
                ]
            }, void 0, true, {
                fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                lineNumber: 4958,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
        lineNumber: 4947,
        columnNumber: 5
    }, this);
}
function ChipInputGroup({ label, chips, editable, placeholder, onChange }) {
    _s8();
    const [input, setInput] = (0, useState)('');
    const addChip = ()=>{
        const value = input.trim();
        if (!value || chips.includes(value)) return;
        onChange([
            ...chips,
            value
        ]);
        setInput('');
    };
    return /*#__PURE__*/ jsxDEV("div", {
        children: [
            label ? /*#__PURE__*/ jsxDEV("span", {
                className: smallLabelClassName,
                children: label
            }, void 0, false, {
                fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                lineNumber: 4987,
                columnNumber: 16
            }, this) : null,
            /*#__PURE__*/ jsxDEV("div", {
                className: classNames('flex h-[30px] flex-nowrap items-center gap-2 overflow-hidden rounded-md border border-slate-300 pl-[10px] pr-2', editable ? 'bg-white' : '!bg-[color:var(--field-locked-bg)] text-slate-500'),
                children: [
                    chips.map((chip)=>/*#__PURE__*/ jsxDEV("span", {
                            className: classNames(adminProductInputChipClassName, 'shrink-0 whitespace-nowrap'),
                            children: [
                                formatWeightChipLabel(chip),
                                editable ? /*#__PURE__*/ jsxDEV("button", {
                                    type: "button",
                                    className: "text-[#1982bf]/70 transition hover:text-rose-600 active:text-rose-700",
                                    onClick: ()=>onChange(chips.filter((entry)=>entry !== chip)),
                                    children: "×"
                                }, void 0, false, {
                                    fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                    lineNumber: 4996,
                                    columnNumber: 15
                                }, this) : null
                            ]
                        }, chip, true, {
                            fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                            lineNumber: 4993,
                            columnNumber: 11
                        }, this)),
                    editable ? /*#__PURE__*/ jsxDEV("input", {
                        className: "h-full min-w-0 flex-1 border-0 bg-transparent text-xs text-slate-900 outline-none focus:ring-0",
                        value: input,
                        placeholder: chips.length > 0 ? '' : placeholder,
                        onChange: (event)=>setInput(event.target.value),
                        onKeyDown: (event)=>{
                            if (event.key !== 'Enter') return;
                            event.preventDefault();
                            addChip();
                        }
                    }, void 0, false, {
                        fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                        lineNumber: 5001,
                        columnNumber: 11
                    }, this) : null
                ]
            }, void 0, true, {
                fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                lineNumber: 4988,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
        lineNumber: 4986,
        columnNumber: 5
    }, this);
}
_s8(ChipInputGroup, "WVveI0ACa0LqOSOlGzu58xcz+KE=");
function DiscountTargetChipInput({ value, suggestions, editable, compact = false, listId, placeholder, onChange }) {
    _s9();
    const [input, setInput] = (0, useState)('');
    const chips = normalizeDiscountTargetList(value);
    const commitInput = ()=>{
        const target = normalizeDiscountTarget(input);
        if (!target) return;
        onChange(normalizeDiscountTargetList(target === allDiscountTargetLabel ? [
            target
        ] : [
            ...chips.filter((chip)=>chip !== allDiscountTargetLabel),
            target
        ]));
        setInput('');
    };
    const removeChip = (chip)=>{
        onChange(normalizeDiscountTargetList(chips.filter((entry)=>entry !== chip)));
    };
    return /*#__PURE__*/ jsxDEV("div", {
        className: classNames('flex flex-wrap items-center gap-1 rounded-md border px-1', editable ? 'border-slate-300 bg-white' : 'border-transparent bg-transparent', compact ? 'min-h-[30px] py-0' : 'min-h-[30px] py-0'),
        children: [
            chips.map((chip)=>/*#__PURE__*/ jsxDEV("span", {
                    className: adminProductInputChipClassName,
                    children: [
                        chip,
                        editable ? /*#__PURE__*/ jsxDEV("button", {
                            type: "button",
                            className: "text-[#1982bf]/70 hover:text-rose-600",
                            onClick: ()=>removeChip(chip),
                            "aria-label": `Odstrani ${chip}`,
                            children: "×"
                        }, void 0, false, {
                            fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                            lineNumber: 5062,
                            columnNumber: 13
                        }, this) : null
                    ]
                }, chip, true, {
                    fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                    lineNumber: 5059,
                    columnNumber: 9
                }, this)),
            editable ? /*#__PURE__*/ jsxDEV(Fragment, {
                children: [
                    /*#__PURE__*/ jsxDEV("input", {
                        list: listId,
                        className: "admin-discount-target-input h-5 min-w-[86px] flex-1 border-0 bg-transparent px-1 text-[11px] text-slate-900 outline-none focus:ring-0",
                        value: input,
                        placeholder: chips.length > 0 ? '' : placeholder,
                        onChange: (event)=>setInput(event.target.value),
                        onBlur: commitInput,
                        onKeyDown: (event)=>{
                            if (![
                                'Enter',
                                ',',
                                'Tab'
                            ].includes(event.key)) return;
                            if (!input.trim()) return;
                            event.preventDefault();
                            commitInput();
                        }
                    }, void 0, false, {
                        fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                        lineNumber: 5070,
                        columnNumber: 11
                    }, this),
                    /*#__PURE__*/ jsxDEV("datalist", {
                        id: listId,
                        children: suggestions.map((suggestion)=>/*#__PURE__*/ jsxDEV("option", {
                                value: suggestion
                            }, suggestion, false, {
                                fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                lineNumber: 5086,
                                columnNumber: 15
                            }, this))
                    }, void 0, false, {
                        fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                        lineNumber: 5084,
                        columnNumber: 11
                    }, this)
                ]
            }, void 0, true) : null
        ]
    }, void 0, true, {
        fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
        lineNumber: 5053,
        columnNumber: 5
    }, this);
}
_s9(DiscountTargetChipInput, "WVveI0ACa0LqOSOlGzu58xcz+KE=");
function OrderSummaryIcon({ type, compact = false, className }) {
    const path = {
        document: /*#__PURE__*/ jsxDEV(Fragment, {
            children: [
                /*#__PURE__*/ jsxDEV("path", {
                    d: "M7 3h7l4 4v14H7z"
                }, void 0, false, {
                    fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                    lineNumber: 5099,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ jsxDEV("path", {
                    d: "M14 3v5h5"
                }, void 0, false, {
                    fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                    lineNumber: 5100,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ jsxDEV("path", {
                    d: "M9.5 13h5"
                }, void 0, false, {
                    fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                    lineNumber: 5101,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ jsxDEV("path", {
                    d: "M9.5 16h3.5"
                }, void 0, false, {
                    fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                    lineNumber: 5102,
                    columnNumber: 9
                }, this)
            ]
        }, void 0, true),
        simple: /*#__PURE__*/ jsxDEV(Fragment, {
            children: [
                /*#__PURE__*/ jsxDEV("path", {
                    d: "m15 12-9.373 9.373a1 1 0 0 1-3.001-3L12 9"
                }, void 0, false, {
                    fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                    lineNumber: 5107,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ jsxDEV("path", {
                    d: "m18 15 4-4"
                }, void 0, false, {
                    fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                    lineNumber: 5108,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ jsxDEV("path", {
                    d: "m21.5 11.5-1.914-1.914A2 2 0 0 1 19 8.172v-.344a2 2 0 0 0-.586-1.414l-1.657-1.657A6 6 0 0 0 12.516 3H9l1.243 1.243A6 6 0 0 1 12 8.485V10l2 2h1.172a2 2 0 0 1 1.414.586L18.5 14.5"
                }, void 0, false, {
                    fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                    lineNumber: 5109,
                    columnNumber: 9
                }, this)
            ]
        }, void 0, true),
        dimensions: /*#__PURE__*/ jsxDEV(Fragment, {
            children: [
                /*#__PURE__*/ jsxDEV("rect", {
                    width: "20",
                    height: "16",
                    x: "2",
                    y: "4",
                    rx: "2"
                }, void 0, false, {
                    fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                    lineNumber: 5114,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ jsxDEV("path", {
                    d: "M12 9v11"
                }, void 0, false, {
                    fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                    lineNumber: 5115,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ jsxDEV("path", {
                    d: "M2 9h13a2 2 0 0 1 2 2v9"
                }, void 0, false, {
                    fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                    lineNumber: 5116,
                    columnNumber: 9
                }, this)
            ]
        }, void 0, true),
        weightGranules: /*#__PURE__*/ jsxDEV("path", {
            fill: "currentColor",
            stroke: "none",
            d: "M9 17.5c0.82843 0 1.5 0.6716 1.5 1.5s-0.67157 1.5-1.5 1.5-1.5-0.6716-1.5-1.5 0.67157-1.5 1.5-1.5m6 0c0.8284 0 1.5 0.6716 1.5 1.5s-0.6716 1.5-1.5 1.5-1.5-0.6716-1.5-1.5 0.6716-1.5 1.5-1.5M5.5 13c0.82843 0 1.5 0.6716 1.5 1.5S6.32843 16 5.5 16 4 15.3284 4 14.5 4.67157 13 5.5 13m6.5 0c0.8284 0 1.5 0.6716 1.5 1.5S12.8284 16 12 16s-1.5-0.6716-1.5-1.5 0.6716-1.5 1.5-1.5m6.5 0c0.8284 0 1.5 0.6716 1.5 1.5s-0.6716 1.5-1.5 1.5-1.5-0.6716-1.5-1.5 0.6716-1.5 1.5-1.5M9 8.5c0.82843 0 1.5 0.67157 1.5 1.5 0 0.8284-0.67157 1.5-1.5 1.5s-1.5-0.6716-1.5-1.5c0-0.82843 0.67157-1.5 1.5-1.5m6 0c0.8284 0 1.5 0.67157 1.5 1.5 0 0.8284-0.6716 1.5-1.5 1.5s-1.5-0.6716-1.5-1.5c0-0.82843 0.6716-1.5 1.5-1.5M5.5 4C6.32843 4 7 4.67157 7 5.5S6.32843 7 5.5 7 4 6.32843 4 5.5 4.67157 4 5.5 4M12 4c0.8284 0 1.5 0.67157 1.5 1.5S12.8284 7 12 7s-1.5-0.67157-1.5-1.5S11.1716 4 12 4m6.5 0c0.8284 0 1.5 0.67157 1.5 1.5S19.3284 7 18.5 7 17 6.32843 17 5.5 17.6716 4 18.5 4"
        }, void 0, false, {
            fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
            lineNumber: 5120,
            columnNumber: 7
        }, this),
        uniqueMachine: /*#__PURE__*/ jsxDEV(Fragment, {
            children: [
                /*#__PURE__*/ jsxDEV("path", {
                    d: "M11 10.27 7 3.34"
                }, void 0, false, {
                    fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                    lineNumber: 5128,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ jsxDEV("path", {
                    d: "m11 13.73-4 6.93"
                }, void 0, false, {
                    fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                    lineNumber: 5129,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ jsxDEV("path", {
                    d: "M12 22v-2"
                }, void 0, false, {
                    fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                    lineNumber: 5130,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ jsxDEV("path", {
                    d: "M12 2v2"
                }, void 0, false, {
                    fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                    lineNumber: 5131,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ jsxDEV("path", {
                    d: "M14 12h8"
                }, void 0, false, {
                    fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                    lineNumber: 5132,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ jsxDEV("path", {
                    d: "m17 20.66-1-1.73"
                }, void 0, false, {
                    fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                    lineNumber: 5133,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ jsxDEV("path", {
                    d: "m17 3.34-1 1.73"
                }, void 0, false, {
                    fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                    lineNumber: 5134,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ jsxDEV("path", {
                    d: "M2 12h2"
                }, void 0, false, {
                    fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                    lineNumber: 5135,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ jsxDEV("path", {
                    d: "m20.66 17-1.73-1"
                }, void 0, false, {
                    fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                    lineNumber: 5136,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ jsxDEV("path", {
                    d: "m20.66 7-1.73 1"
                }, void 0, false, {
                    fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                    lineNumber: 5137,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ jsxDEV("path", {
                    d: "m3.34 17 1.73-1"
                }, void 0, false, {
                    fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                    lineNumber: 5138,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ jsxDEV("path", {
                    d: "m3.34 7 1.73 1"
                }, void 0, false, {
                    fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                    lineNumber: 5139,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ jsxDEV("circle", {
                    cx: "12",
                    cy: "12",
                    r: "2"
                }, void 0, false, {
                    fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                    lineNumber: 5140,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ jsxDEV("circle", {
                    cx: "12",
                    cy: "12",
                    r: "8"
                }, void 0, false, {
                    fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                    lineNumber: 5141,
                    columnNumber: 9
                }, this)
            ]
        }, void 0, true),
        scale: /*#__PURE__*/ jsxDEV(Fragment, {
            children: [
                /*#__PURE__*/ jsxDEV("path", {
                    d: "M6 19h12"
                }, void 0, false, {
                    fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                    lineNumber: 5146,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ jsxDEV("path", {
                    d: "M12 5v14"
                }, void 0, false, {
                    fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                    lineNumber: 5147,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ jsxDEV("path", {
                    d: "M8 7h8"
                }, void 0, false, {
                    fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                    lineNumber: 5148,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ jsxDEV("path", {
                    d: "M6 7l-3 6h6z"
                }, void 0, false, {
                    fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                    lineNumber: 5149,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ jsxDEV("path", {
                    d: "M18 7l-3 6h6z"
                }, void 0, false, {
                    fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                    lineNumber: 5150,
                    columnNumber: 9
                }, this)
            ]
        }, void 0, true),
        bag: /*#__PURE__*/ jsxDEV(Fragment, {
            children: [
                /*#__PURE__*/ jsxDEV("path", {
                    d: "M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z"
                }, void 0, false, {
                    fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                    lineNumber: 5155,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ jsxDEV("path", {
                    d: "M7 12h5"
                }, void 0, false, {
                    fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                    lineNumber: 5156,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ jsxDEV("path", {
                    d: "M15 9.4a4 4 0 1 0 0 5.2"
                }, void 0, false, {
                    fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                    lineNumber: 5157,
                    columnNumber: 9
                }, this)
            ]
        }, void 0, true),
        quantity: /*#__PURE__*/ jsxDEV("g", {
            fill: "none",
            children: [
                /*#__PURE__*/ jsxDEV("circle", {
                    cx: "12",
                    cy: "6.2",
                    r: "2.1"
                }, void 0, false, {
                    fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                    lineNumber: 5162,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ jsxDEV("circle", {
                    cx: "8.6",
                    cy: "12",
                    r: "2.1"
                }, void 0, false, {
                    fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                    lineNumber: 5163,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ jsxDEV("circle", {
                    cx: "15.4",
                    cy: "12",
                    r: "2.1"
                }, void 0, false, {
                    fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                    lineNumber: 5164,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ jsxDEV("circle", {
                    cx: "5.2",
                    cy: "17.8",
                    r: "2.1"
                }, void 0, false, {
                    fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                    lineNumber: 5165,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ jsxDEV("circle", {
                    cx: "12",
                    cy: "17.8",
                    r: "2.1"
                }, void 0, false, {
                    fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                    lineNumber: 5166,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ jsxDEV("circle", {
                    cx: "18.8",
                    cy: "17.8",
                    r: "2.1"
                }, void 0, false, {
                    fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                    lineNumber: 5167,
                    columnNumber: 9
                }, this)
            ]
        }, void 0, true, {
            fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
            lineNumber: 5161,
            columnNumber: 7
        }, this),
        boxes: /*#__PURE__*/ jsxDEV(Fragment, {
            children: [
                /*#__PURE__*/ jsxDEV("path", {
                    d: "M2.97 12.92A2 2 0 0 0 2 14.63v3.24a2 2 0 0 0 .97 1.71l3 1.8a2 2 0 0 0 2.06 0L12 19v-5.5l-5-3-4.03 2.42Z"
                }, void 0, false, {
                    fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                    lineNumber: 5172,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ jsxDEV("path", {
                    d: "m7 16.5-4.74-2.85"
                }, void 0, false, {
                    fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                    lineNumber: 5173,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ jsxDEV("path", {
                    d: "m7 16.5 5-3"
                }, void 0, false, {
                    fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                    lineNumber: 5174,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ jsxDEV("path", {
                    d: "M7 16.5v5.17"
                }, void 0, false, {
                    fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                    lineNumber: 5175,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ jsxDEV("path", {
                    d: "M12 13.5V19l3.97 2.38a2 2 0 0 0 2.06 0l3-1.8a2 2 0 0 0 .97-1.71v-3.24a2 2 0 0 0-.97-1.71L17 10.5l-5 3Z"
                }, void 0, false, {
                    fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                    lineNumber: 5176,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ jsxDEV("path", {
                    d: "m17 16.5-5-3"
                }, void 0, false, {
                    fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                    lineNumber: 5177,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ jsxDEV("path", {
                    d: "m17 16.5 4.74-2.85"
                }, void 0, false, {
                    fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                    lineNumber: 5178,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ jsxDEV("path", {
                    d: "M17 16.5v5.17"
                }, void 0, false, {
                    fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                    lineNumber: 5179,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ jsxDEV("path", {
                    d: "M7.97 4.42A2 2 0 0 0 7 6.13v4.37l5 3 5-3V6.13a2 2 0 0 0-.97-1.71l-3-1.8a2 2 0 0 0-2.06 0l-3 1.8Z"
                }, void 0, false, {
                    fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                    lineNumber: 5180,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ jsxDEV("path", {
                    d: "M12 8 7.26 5.15"
                }, void 0, false, {
                    fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                    lineNumber: 5181,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ jsxDEV("path", {
                    d: "m12 8 4.74-2.85"
                }, void 0, false, {
                    fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                    lineNumber: 5182,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ jsxDEV("path", {
                    d: "M12 13.5V8"
                }, void 0, false, {
                    fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                    lineNumber: 5183,
                    columnNumber: 9
                }, this)
            ]
        }, void 0, true),
        layers: /*#__PURE__*/ jsxDEV(Fragment, {
            children: [
                /*#__PURE__*/ jsxDEV("path", {
                    d: "M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83z"
                }, void 0, false, {
                    fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                    lineNumber: 5188,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ jsxDEV("path", {
                    d: "M2 12a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 12"
                }, void 0, false, {
                    fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                    lineNumber: 5189,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ jsxDEV("path", {
                    d: "M2 17a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 17"
                }, void 0, false, {
                    fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                    lineNumber: 5190,
                    columnNumber: 9
                }, this)
            ]
        }, void 0, true),
        layersMinus: /*#__PURE__*/ jsxDEV(Fragment, {
            children: [
                /*#__PURE__*/ jsxDEV("path", {
                    d: "M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 .83.18 2 2 0 0 0 .83-.18l8.58-3.9a1 1 0 0 0 0-1.832z"
                }, void 0, false, {
                    fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                    lineNumber: 5195,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ jsxDEV("path", {
                    d: "M16 17h6"
                }, void 0, false, {
                    fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                    lineNumber: 5196,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ jsxDEV("path", {
                    d: "M2.003 11.995a1 1 0 0 0 .597.915l8.58 3.91a2 2 0 0 0 .83.18"
                }, void 0, false, {
                    fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                    lineNumber: 5197,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ jsxDEV("path", {
                    d: "M2.003 16.995a1 1 0 0 0 .597.915l8.58 3.91a2 2 0 0 0 .83.18 2 2 0 0 0 .83-.18l2.11-.96"
                }, void 0, false, {
                    fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                    lineNumber: 5198,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ jsxDEV("path", {
                    d: "M22.018 12.004a1 1 0 0 1-.598.916l-.177.08"
                }, void 0, false, {
                    fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                    lineNumber: 5199,
                    columnNumber: 9
                }, this)
            ]
        }, void 0, true),
        discount: /*#__PURE__*/ jsxDEV(Fragment, {
            children: [
                /*#__PURE__*/ jsxDEV("path", {
                    d: "M2.7 10.3a2.41 2.41 0 0 0 0 3.41l7.59 7.59a2.41 2.41 0 0 0 3.41 0l7.59-7.59a2.41 2.41 0 0 0 0-3.41L13.7 2.71a2.41 2.41 0 0 0-3.41 0Z"
                }, void 0, false, {
                    fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                    lineNumber: 5204,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ jsxDEV("path", {
                    d: "M9.2 9.2h.01"
                }, void 0, false, {
                    fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                    lineNumber: 5205,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ jsxDEV("path", {
                    d: "m14.5 9.5-5 5"
                }, void 0, false, {
                    fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                    lineNumber: 5206,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ jsxDEV("path", {
                    d: "M14.7 14.8h.01"
                }, void 0, false, {
                    fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                    lineNumber: 5207,
                    columnNumber: 9
                }, this)
            ]
        }, void 0, true),
        stock: /*#__PURE__*/ jsxDEV("g", {
            fill: "none",
            children: [
                /*#__PURE__*/ jsxDEV("circle", {
                    cx: "12",
                    cy: "6.2",
                    r: "2.1"
                }, void 0, false, {
                    fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                    lineNumber: 5212,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ jsxDEV("circle", {
                    cx: "8.6",
                    cy: "12",
                    r: "2.1"
                }, void 0, false, {
                    fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                    lineNumber: 5213,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ jsxDEV("circle", {
                    cx: "15.4",
                    cy: "12",
                    r: "2.1"
                }, void 0, false, {
                    fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                    lineNumber: 5214,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ jsxDEV("circle", {
                    cx: "5.2",
                    cy: "17.8",
                    r: "2.1"
                }, void 0, false, {
                    fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                    lineNumber: 5215,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ jsxDEV("circle", {
                    cx: "12",
                    cy: "17.8",
                    r: "2.1"
                }, void 0, false, {
                    fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                    lineNumber: 5216,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ jsxDEV("circle", {
                    cx: "18.8",
                    cy: "17.8",
                    r: "2.1"
                }, void 0, false, {
                    fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                    lineNumber: 5217,
                    columnNumber: 9
                }, this)
            ]
        }, void 0, true, {
            fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
            lineNumber: 5211,
            columnNumber: 7
        }, this),
        variant: /*#__PURE__*/ jsxDEV(Fragment, {
            children: [
                /*#__PURE__*/ jsxDEV("path", {
                    d: "M5 7h14v12H5z"
                }, void 0, false, {
                    fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                    lineNumber: 5222,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ jsxDEV("path", {
                    d: "M8 7V4h8v3"
                }, void 0, false, {
                    fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                    lineNumber: 5223,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ jsxDEV("path", {
                    d: "M9 11h2"
                }, void 0, false, {
                    fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                    lineNumber: 5224,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ jsxDEV("path", {
                    d: "M13 11h2"
                }, void 0, false, {
                    fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                    lineNumber: 5225,
                    columnNumber: 9
                }, this)
            ]
        }, void 0, true),
        box: /*#__PURE__*/ jsxDEV(Fragment, {
            children: [
                /*#__PURE__*/ jsxDEV("path", {
                    d: "M12 3 4 7.5l8 4.5 8-4.5z"
                }, void 0, false, {
                    fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                    lineNumber: 5230,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ jsxDEV("path", {
                    d: "M4 7.5v9L12 21l8-4.5v-9"
                }, void 0, false, {
                    fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                    lineNumber: 5231,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ jsxDEV("path", {
                    d: "M12 12v9"
                }, void 0, false, {
                    fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                    lineNumber: 5232,
                    columnNumber: 9
                }, this)
            ]
        }, void 0, true),
        calculator: /*#__PURE__*/ jsxDEV(Fragment, {
            children: [
                /*#__PURE__*/ jsxDEV("rect", {
                    x: "5",
                    y: "3",
                    width: "14",
                    height: "18",
                    rx: "2"
                }, void 0, false, {
                    fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                    lineNumber: 5237,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ jsxDEV("path", {
                    d: "M8 7h8"
                }, void 0, false, {
                    fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                    lineNumber: 5238,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ jsxDEV("path", {
                    d: "M8 11h2"
                }, void 0, false, {
                    fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                    lineNumber: 5239,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ jsxDEV("path", {
                    d: "M12 11h2"
                }, void 0, false, {
                    fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                    lineNumber: 5240,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ jsxDEV("path", {
                    d: "M16 11h.01"
                }, void 0, false, {
                    fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                    lineNumber: 5241,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ jsxDEV("path", {
                    d: "M8 15h2"
                }, void 0, false, {
                    fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                    lineNumber: 5242,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ jsxDEV("path", {
                    d: "M12 15h2"
                }, void 0, false, {
                    fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                    lineNumber: 5243,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ jsxDEV("path", {
                    d: "M16 15h.01"
                }, void 0, false, {
                    fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                    lineNumber: 5244,
                    columnNumber: 9
                }, this)
            ]
        }, void 0, true)
    }[type];
    return /*#__PURE__*/ jsxDEV("span", {
        className: classNames('inline-flex shrink-0 items-center justify-center', className ?? 'text-slate-500', compact ? 'h-5 w-5' : 'h-7 w-7'),
        children: /*#__PURE__*/ jsxDEV("svg", {
            viewBox: "0 0 24 24",
            className: compact ? 'h-[17px] w-[17px]' : 'h-[21px] w-[21px]',
            fill: "none",
            stroke: "currentColor",
            strokeWidth: "1.8",
            strokeLinecap: "round",
            strokeLinejoin: "round",
            "aria-hidden": "true",
            children: path
        }, void 0, false, {
            fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
            lineNumber: 5251,
            columnNumber: 7
        }, this)
    }, void 0, false, {
        fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
        lineNumber: 5250,
        columnNumber: 5
    }, this);
}
function OrderSummarySectionTitle({ children, compact = false }) {
    return /*#__PURE__*/ jsxDEV("div", {
        className: classNames('flex items-center', compact ? 'gap-2' : 'gap-3'),
        children: [
            /*#__PURE__*/ jsxDEV("h3", {
                className: classNames('shrink-0 font-semibold text-slate-900', compact ? 'text-[12px]' : 'text-[13px]'),
                children: children
            }, void 0, false, {
                fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                lineNumber: 5261,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ jsxDEV("span", {
                className: "h-px flex-1 bg-slate-200"
            }, void 0, false, {
                fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                lineNumber: 5262,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
        lineNumber: 5260,
        columnNumber: 5
    }, this);
}
function OrderSummaryCard({ compact, detailRows, calculationRows, total }) {
    const sectionGapClassName = compact ? 'mt-3' : 'mt-5';
    const listGapClassName = compact ? 'mt-2' : 'mt-3';
    const detailRowClassName = compact ? 'py-1.5' : 'py-2.5';
    const calculationRowClassName = compact ? 'py-1.5 text-[12px]' : 'py-2 text-[13px]';
    return /*#__PURE__*/ jsxDEV("section", {
        className: `${adminWindowCardClassName} h-full ${compact ? 'p-4' : 'p-7'}`,
        style: adminWindowCardStyle,
        children: [
            /*#__PURE__*/ jsxDEV("div", {
                className: "flex items-center gap-2",
                children: /*#__PURE__*/ jsxDEV("h2", {
                    className: compact ? 'text-[18px] font-semibold tracking-tight text-slate-900' : sectionTitleClassName,
                    children: "Povzetek naročila in izračun"
                }, void 0, false, {
                    fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                    lineNumber: 5286,
                    columnNumber: 9
                }, this)
            }, void 0, false, {
                fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                lineNumber: 5285,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ jsxDEV("div", {
                className: sectionGapClassName,
                children: [
                    /*#__PURE__*/ jsxDEV(OrderSummarySectionTitle, {
                        compact: compact,
                        children: "Podrobnosti artikla in izračuna"
                    }, void 0, false, {
                        fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                        lineNumber: 5290,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ jsxDEV("div", {
                        className: `${listGapClassName} divide-y divide-slate-200`,
                        children: detailRows.map((row)=>/*#__PURE__*/ jsxDEV("div", {
                                className: `flex items-center gap-3 ${detailRowClassName}`,
                                children: [
                                    /*#__PURE__*/ jsxDEV(OrderSummaryIcon, {
                                        type: row.icon,
                                        compact: compact
                                    }, void 0, false, {
                                        fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                        lineNumber: 5294,
                                        columnNumber: 15
                                    }, this),
                                    /*#__PURE__*/ jsxDEV("div", {
                                        className: "min-w-0 flex-1",
                                        children: [
                                            /*#__PURE__*/ jsxDEV("p", {
                                                className: classNames('font-medium text-slate-900', compact ? 'text-[12px] leading-4' : 'text-[13px] leading-5'),
                                                children: row.label
                                            }, void 0, false, {
                                                fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                lineNumber: 5296,
                                                columnNumber: 17
                                            }, this),
                                            row.description ? /*#__PURE__*/ jsxDEV("p", {
                                                className: classNames('text-slate-500', compact ? 'text-[10.5px] leading-[0.875rem]' : 'text-[11px] leading-4'),
                                                children: row.description
                                            }, void 0, false, {
                                                fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                lineNumber: 5297,
                                                columnNumber: 36
                                            }, this) : null
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                        lineNumber: 5295,
                                        columnNumber: 15
                                    }, this),
                                    /*#__PURE__*/ jsxDEV("span", {
                                        className: classNames('max-w-[48%] truncate text-right font-semibold tabular-nums text-slate-900', compact ? 'text-[12px]' : 'text-[13px]'),
                                        title: row.value,
                                        children: row.value
                                    }, void 0, false, {
                                        fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                        lineNumber: 5299,
                                        columnNumber: 15
                                    }, this)
                                ]
                            }, `${row.label}-${row.value}`, true, {
                                fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                lineNumber: 5293,
                                columnNumber: 13
                            }, this))
                    }, void 0, false, {
                        fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                        lineNumber: 5291,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                lineNumber: 5289,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ jsxDEV("div", {
                className: sectionGapClassName,
                children: [
                    /*#__PURE__*/ jsxDEV(OrderSummarySectionTitle, {
                        compact: compact,
                        children: "Izračun"
                    }, void 0, false, {
                        fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                        lineNumber: 5306,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ jsxDEV("div", {
                        className: `${listGapClassName} divide-y divide-slate-100`,
                        children: calculationRows.map((row)=>/*#__PURE__*/ jsxDEV("div", {
                                className: `flex items-center justify-between gap-4 ${calculationRowClassName}`,
                                children: [
                                    /*#__PURE__*/ jsxDEV("span", {
                                        className: classNames('min-w-0 text-slate-900', row.strong && 'font-semibold'),
                                        children: [
                                            row.label,
                                            row.detail ? /*#__PURE__*/ jsxDEV("span", {
                                                className: "ml-1 text-slate-500",
                                                children: [
                                                    "(",
                                                    row.detail,
                                                    ")"
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                                lineNumber: 5312,
                                                columnNumber: 31
                                            }, this) : null
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                        lineNumber: 5310,
                                        columnNumber: 15
                                    }, this),
                                    /*#__PURE__*/ jsxDEV("span", {
                                        className: classNames('shrink-0 text-right font-semibold tabular-nums', row.tone === 'success' ? 'text-emerald-600' : 'text-slate-900'),
                                        children: row.value
                                    }, void 0, false, {
                                        fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                        lineNumber: 5314,
                                        columnNumber: 15
                                    }, this)
                                ]
                            }, `${row.label}-${row.value}`, true, {
                                fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                                lineNumber: 5309,
                                columnNumber: 13
                            }, this))
                    }, void 0, false, {
                        fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                        lineNumber: 5307,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                lineNumber: 5305,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ jsxDEV("div", {
                className: `${compact ? 'mt-3 pt-3' : 'mt-5 pt-4'} border-t border-slate-200`,
                children: /*#__PURE__*/ jsxDEV("div", {
                    className: "flex items-end justify-between gap-4 text-[#1982bf]",
                    children: [
                        /*#__PURE__*/ jsxDEV("span", {
                            className: compact ? 'text-[18px] font-semibold tracking-tight' : 'text-[22px] font-semibold tracking-tight',
                            children: "Skupaj z DDV"
                        }, void 0, false, {
                            fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                            lineNumber: 5327,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ jsxDEV("span", {
                            className: compact ? 'text-[20px] font-semibold tracking-tight' : 'text-[26px] font-semibold tracking-tight',
                            children: total
                        }, void 0, false, {
                            fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                            lineNumber: 5328,
                            columnNumber: 11
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                    lineNumber: 5326,
                    columnNumber: 9
                }, this)
            }, void 0, false, {
                fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
                lineNumber: 5325,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/src/admin/features/artikli/components/DimensionProductPricingSections.tsx",
        lineNumber: 5284,
        columnNumber: 5
    }, this);
}

const CommercialToolsPanelExport: any = CommercialToolsPanel;
const ProductTypeSelectorCardRowExport: any = ProductTypeSelectorCardRow;
const QuantityDiscountsCardExport: any = QuantityDiscountsCard;
const SimpleProductModuleExport: any = SimpleProductModule;
const UniqueMachineProductModuleExport: any = UniqueMachineProductModule;
const WeightProductModuleExport: any = WeightProductModule;

export {
  CommercialToolsPanelExport as CommercialToolsPanel,
  DimensionOrderPricingPanel,
  ProductPricingLogicCardRow,
  ProductTypeSelectorCardRowExport as ProductTypeSelectorCardRow,
  QuantityDiscountsCardExport as QuantityDiscountsCard,
  SimpleProductModuleExport as SimpleProductModule,
  UniqueMachineProductModuleExport as UniqueMachineProductModule,
  WeightProductModuleExport as WeightProductModule,
  adminProductInputChipClassName,
  buildMachineCatalogVariants,
  buildSimpleCatalogVariants,
  buildWeightCatalogVariants,
  cloneQuantityDiscountDraft,
  cloneTypeSpecificData,
  createInitialQuantityDiscountDrafts,
  createInitialTypeSpecificData,
  createQuantityDiscountDraft,
  getDimensionSimulatorOptions,
  getMachineSimulatorOptions,
  getSimpleSimulatorOptions,
  getWeightSimulatorOptions,
  normalizeSimpleProductData,
  normalizeUniqueMachineProductData,
  normalizeWeightProductData,
  serializeQuantityDiscountTargets
};
