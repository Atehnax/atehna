'use client';

import { useMemo, type ReactNode } from 'react';
import { CustomSelect } from '@/shared/ui/select';
import { Button } from '@/shared/ui/button';
import { adminWindowCardClassName, adminWindowCardStyle } from '@/shared/ui/admin-table/standards';
import { formatCurrency } from '@/admin/features/artikli/lib/familyModel';
import { formatDecimalForDisplay } from '@/admin/features/artikli/lib/decimalFormat';
import type { CommercialToolsPanelProps, OrderPriceSummaryRow, PricingSimulatorOption } from './pricingTypes';
import { QuantityDiscountsCard } from './QuantityDiscountsCard';
import { OrderPriceSummaryCard } from './OrderPriceSummaryCard';
import { MachineGearIcon } from './MachineGearIcon';
import { normalizeWeightFractionValue } from './productData';
import {
  clampDiscountPercent,
  defaultVatRate,
  getBestQuantityDiscount,
  getNextQuantityDiscount
} from './pricingCalculations';
import { toPricingSimulatorOptions } from './simulatorUtils';
import {
  classNames,
  DecimalDraftInput,
  sectionTitleClassName,
  simulatorSelectTriggerClassName,
  simulatorSelectValueClassName
} from './PricingFieldControls';
import { formatQuantityWithUnit, formatQuantityWithUnitLocative, getQuantityUnitForValue } from './unitFormatters';

function formatPercent(value: number): string {
  return `${formatDecimalForDisplay(value)} %`;
}

function formatQuantity(value: number, unit: string): string {
  return formatQuantityWithUnit(value, unit);
}

function getQuantityUnitLabel(value: number, unit: string): string {
  return getQuantityUnitForValue(value, unit);
}

function formatQuantityAfterPri(value: number, unit: string): string {
  return formatQuantityWithUnitLocative(value, unit);
}

function formatStockAfterOrder(stockLabel: string | undefined, quantity: number, unit: string): string | null {
  if (!stockLabel) return null;
  const numberMatch = stockLabel.match(/-?\d+(?:[,.]\d+)?/);
  if (!numberMatch) return stockLabel;
  const current = Number(numberMatch[0].replace(',', '.'));
  if (!Number.isFinite(current)) return stockLabel;
  const nextStock = Math.max(0, current - quantity);
  return unit.trim() ? formatQuantity(nextStock, unit) : stockLabel.replace(numberMatch[0], formatDecimalForDisplay(nextStock));
}

const stockAfterOrderWarningThresholds: Partial<Record<NonNullable<CommercialToolsPanelProps['productType']>, number>> = {
  simple: 10,
  dimensions: 50,
  weight: 20,
  unique_machine: 3
};

function getStockAfterOrderTone(
  productType: CommercialToolsPanelProps['productType'],
  stockAfterOrder: string
): OrderPriceSummaryRow['tone'] {
  const numberMatch = stockAfterOrder.match(/-?\d+(?:[,.]\d+)?/);
  if (!numberMatch) return 'success';
  const amount = Number(numberMatch[0].replace(',', '.'));
  if (!Number.isFinite(amount)) return 'success';
  const warningThreshold = productType ? stockAfterOrderWarningThresholds[productType] : undefined;
  if (typeof warningThreshold === 'number') return amount < warningThreshold ? 'warning' : 'success';
  return 'success';
}

function getSelectLabel(productType: CommercialToolsPanelProps['productType']): string {
  if (productType === 'weight') return 'Različica (masa | barva | frakcija)';
  if (productType === 'dimensions') return 'Različica (debelina × dolžina × širina)';
  if (productType === 'unique_machine') return 'Stroj';
  return 'Različica';
}

function getQuantityLabel(productType: CommercialToolsPanelProps['productType']): string {
  return productType === 'weight' ? 'Skupna masa' : 'Količina';
}

function getDimensionOptionLabel(option: PricingSimulatorOption): string {
  const dimensions = [option.dimensionThickness, option.dimensionLength, option.dimensionWidth];
  const hasDimensionValue = dimensions.some((value) => typeof value === 'number' && Number.isFinite(value));
  if (!hasDimensionValue) return option.dimensionLabel ?? option.label;

  return `${dimensions
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value))
    .map((value) => formatDecimalForDisplay(value))
    .join(' × ')} mm`;
}

function getOptionLabel(option: PricingSimulatorOption | null, productType: CommercialToolsPanelProps['productType']) {
  if (!option) return 'Ni različic';
  if (productType === 'weight') return option.weightSelectionLabel ?? option.label;
  if (productType === 'dimensions') return getDimensionOptionLabel(option);
  if (productType === 'unique_machine') return option.label;
  return option.label;
}

function getSummarySelectLabel(productType: CommercialToolsPanelProps['productType']): string {
  if (productType === 'unique_machine') return 'Stroj';
  if (productType === 'weight' || productType === 'dimensions') return 'Različica';
  return getSelectLabel(productType);
}

function getEffectiveUnitPrice(option: PricingSimulatorOption | null): number {
  if (!option) return 0;
  return option.basePrice;
}

function getWeightSummarySelectionLabel(option: PricingSimulatorOption | null): string {
  if (!option) return 'Ni različic';
  return option.weightSelectionLabel ?? option.label;
}

function getWeightQuantityBreakdown(quantity: number, option: PricingSimulatorOption | null): string | undefined {
  const mass = option?.weightNetMassKg ?? 0;
  if (!Number.isFinite(mass) || mass <= 0) return undefined;
  const packageCount = getWeightPackageCount(quantity, option);
  return `${formatDecimalForDisplay(packageCount)} × ${formatDecimalForDisplay(mass)} kg`;
}

function getWeightPackageCount(quantity: number, option: PricingSimulatorOption | null): number {
  const mass = option?.weightNetMassKg ?? 0;
  if (!Number.isFinite(mass) || mass <= 0) return Math.max(0, quantity);
  return Number((Math.max(0, quantity) / mass).toFixed(4));
}

function getMinimumQuantity(
  productType: CommercialToolsPanelProps['productType'],
  option: PricingSimulatorOption | null
): number {
  if (productType !== 'weight') return 1;

  const labelMatch = option?.minOrderLabel?.match(/\d+(?:[,.]\d+)?/);
  if (labelMatch) {
    const labelQuantity = Number(labelMatch[0].replace(',', '.'));
    if (Number.isFinite(labelQuantity) && labelQuantity > 0) return labelQuantity;
  }

  const packageMass = option?.weightNetMassKg ?? 0;
  return Number.isFinite(packageMass) && packageMass > 0 ? packageMass : 1;
}

function formatWeightFractionChip(option: PricingSimulatorOption | null): string | undefined {
  const fraction = option?.weightFraction?.trim();
  if (!fraction || fraction === '—') return undefined;
  return normalizeWeightFractionValue(fraction);
}

function formatWeightColorChip(option: PricingSimulatorOption | null): string | undefined {
  const color = option?.weightColor?.trim();
  if (!color || color === '—') return undefined;
  return color;
}

function formatWeightPackageChip(option: PricingSimulatorOption | null): string | undefined {
  const packageLabel = option?.weightPackageLabel?.trim();
  if (!packageLabel) return undefined;
  if (packageLabel === 'Brez pakiranja' || packageLabel.includes('/')) return packageLabel;
  return `${packageLabel} / vrečka`;
}

function getSummarySelectionChips(
  productType: CommercialToolsPanelProps['productType'],
  option: PricingSimulatorOption | null
): string[] {
  if (!option) return [];

  if (productType === 'weight') {
    return [formatWeightPackageChip(option), formatWeightColorChip(option), formatWeightFractionChip(option)]
      .filter((chip): chip is string => Boolean(chip));
  }

  if (productType === 'dimensions') {
    return [getDimensionOptionLabel(option)].filter(Boolean);
  }

  return [option.label].filter(Boolean);
}

function getSummaryPriceValue(
  productType: CommercialToolsPanelProps['productType'],
  unitPrice: number,
  quantityUnit: string
): string {
  if (productType === 'weight') {
    return `${formatCurrency(unitPrice)} / različico`;
  }

  return `${formatCurrency(unitPrice)} / ${getQuantityUnitLabel(1, quantityUnit)}`;
}

function getSelectedPricingOption(
  selectOptions: readonly PricingSimulatorOption[],
  selectedOptionId: string
): PricingSimulatorOption | null {
  const directMatch = selectOptions.find((option) => option.id === selectedOptionId);
  if (directMatch) return directMatch;

  return selectOptions[0] ?? null;
}

function SimulatorToggle({
  checked,
  disabled,
  onChange
}: {
  checked: boolean;
  disabled: boolean;
  onChange: (nextChecked: boolean) => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      aria-pressed={checked}
      aria-label="Upoštevaj količinske popuste"
      onClick={() => onChange(!checked)}
      className={classNames(
        'inline-flex h-9 items-center text-left text-[11px] font-medium leading-tight text-slate-600',
        disabled && 'cursor-not-allowed opacity-60'
      )}
    >
      <span
        className={classNames(
          'relative inline-flex h-[32px] w-[58px] shrink-0 rounded-full transition-colors',
          checked ? 'bg-[#1982bf]' : 'bg-slate-300'
        )}
      >
        <span
          className={classNames(
            'absolute top-[4px] h-6 w-6 rounded-full bg-white shadow-sm transition-transform',
            checked ? 'translate-x-[30px]' : 'translate-x-[4px]'
          )}
        />
      </span>
    </button>
  );
}

type SimulatorInfoIcon =
  | 'selection'
  | 'simpleProduct'
  | 'dimensionVariant'
  | 'dimensionQuantity'
  | 'discount'
  | 'simpleStock'
  | 'stock'
  | 'machine'
  | 'machineGear'
  | 'machineCluster';

function BoxesStockIcon({ className = 'h-5 w-5', strokeWidth = 2 }: { className?: string; strokeWidth?: number }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
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
    </svg>
  );
}

function SimulatorIcon({ icon }: { icon: SimulatorInfoIcon }) {
  const commonProps = {
    'aria-hidden': true,
    viewBox: '0 0 24 24',
    className: 'h-5 w-5',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const
  };

  if (icon === 'simpleProduct') {
    return (
      <svg {...commonProps}>
        <path d="m15 12-9.373 9.373a1 1 0 0 1-3.001-3L12 9" />
        <path d="m18 15 4-4" />
        <path d="m21.5 11.5-1.914-1.914A2 2 0 0 1 19 8.172v-.344a2 2 0 0 0-.586-1.414l-1.657-1.657A6 6 0 0 0 12.516 3H9l1.243 1.243A6 6 0 0 1 12 8.485V10l2 2h1.172a2 2 0 0 1 1.414.586L18.5 14.5" />
      </svg>
    );
  }
  if (icon === 'dimensionVariant') {
    return (
      <svg {...commonProps}>
        <rect width="20" height="16" x="2" y="4" rx="2" />
        <path d="M12 9v11" />
        <path d="M2 9h13a2 2 0 0 1 2 2v9" />
      </svg>
    );
  }
  if (icon === 'dimensionQuantity') {
    return (
      <svg {...commonProps}>
        <path d="M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83z" />
        <path d="M2 12a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 12" />
        <path d="M2 17a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 17" />
      </svg>
    );
  }
  if (icon === 'machine') {
    return (
      <svg {...commonProps}>
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
  if (icon === 'machineCluster') {
    return (
      <svg
        aria-hidden="true"
        viewBox="0 0 452 460"
        className="h-5 w-5"
        fill="currentColor"
        preserveAspectRatio="xMidYMid meet"
      >
        <g transform="translate(0,460) scale(0.1,-0.1)">
          <path d="M2986 4098 c-8 -13 -17 -50 -21 -83 -10 -93 -16 -115 -30 -115 -7 0 -32 -9 -56 -20 -24 -11 -49 -20 -55 -20 -6 0 -42 25 -79 55 -36 30 -76 55 -89 55 -30 0 -206 -177 -206 -208 0 -13 24 -55 54 -94 41 -54 52 -75 45 -87 -6 -9 -18 -38 -28 -66 l-19 -50 -93 -12 c-68 -8 -96 -16 -106 -29 -9 -12 -13 -56 -13 -145 0 -126 0 -128 26 -148 17 -13 42 -21 68 -22 22 0 58 -3 79 -7 36 -7 40 -11 66 -73 l28 -66 -53 -64 c-32 -39 -53 -74 -53 -89 -1 -33 173 -210 206 -210 12 0 52 23 89 52 l67 51 69 -24 c76 -26 73 -21 83 -132 10 -103 17 -107 168 -107 67 0 127 4 133 8 21 14 32 48 39 125 6 59 12 80 24 84 9 3 39 16 67 28 l51 23 71 -54 c39 -30 82 -54 94 -54 30 0 208 176 208 206 0 11 -25 52 -55 91 l-54 70 28 68 c15 38 32 70 37 71 5 1 44 6 87 9 114 10 117 14 117 169 0 159 -2 161 -125 177 l-90 11 -27 66 -28 66 55 72 c31 40 55 82 55 95 0 29 -178 209 -206 209 -11 0 -52 -27 -93 -61 -46 -37 -81 -58 -90 -55 -136 46 -123 30 -137 164 -4 35 -13 70 -21 78 -11 11 -45 14 -143 14 -123 0 -130 -1 -144 -22z m261 -586 c46 -24 99 -81 119 -128 18 -43 18 -145 0 -188 -46 -111 -175 -176 -292 -147 -114 29 -187 122 -187 240 0 118 64 203 183 242 40 13 133 3 177 -19z" />
          <path d="M1280 3440 c-11 -11 -20 -26 -20 -32 -1 -35 -29 -218 -35 -227 -3 -6 -13 -11 -21 -11 -8 0 -50 -16 -94 -36 l-78 -36 -79 64 c-97 79 -124 98 -141 98 -21 0 -252 -238 -252 -260 0 -10 36 -62 80 -116 45 -53 80 -99 78 -103 -11 -25 -67 -169 -71 -182 -4 -12 -32 -19 -121 -29 -168 -18 -161 -9 -161 -214 0 -140 3 -168 16 -182 12 -11 52 -20 131 -29 63 -6 120 -15 125 -18 6 -4 14 -19 18 -34 3 -15 20 -56 37 -90 20 -43 27 -67 21 -76 -5 -6 -40 -50 -76 -95 -44 -55 -67 -93 -67 -110 0 -20 28 -54 118 -144 65 -65 125 -118 134 -118 10 0 62 36 118 80 l100 80 58 -29 c31 -16 76 -34 98 -41 l41 -12 13 -107 c13 -111 23 -151 43 -163 7 -4 84 -8 173 -8 120 0 165 3 179 14 14 10 21 37 31 122 7 60 13 116 14 125 0 11 18 23 53 34 28 9 72 27 96 41 l43 24 100 -80 c56 -44 108 -80 117 -80 21 0 261 241 261 262 0 9 -36 61 -81 116 l-80 101 30 63 c16 35 33 75 36 91 4 15 12 30 18 34 5 3 62 12 126 19 157 17 152 9 149 217 -4 197 1 191 -164 209 l-111 12 -37 90 c-20 50 -39 96 -42 101 -2 6 29 53 71 105 48 61 75 104 75 120 0 19 -27 52 -107 132 -60 58 -118 111 -131 118 -28 14 -34 10 -153 -85 l-79 -64 -63 28 c-34 16 -78 34 -98 40 l-36 11 -11 123 c-16 164 -7 157 -213 157 -146 0 -161 -2 -179 -20z m328 -755 c72 -32 142 -101 174 -172 18 -38 22 -67 23 -143 0 -86 -3 -101 -29 -153 -36 -71 -99 -130 -174 -165 -47 -22 -72 -26 -137 -26 -65 0 -90 4 -137 26 -72 33 -136 93 -174 160 -27 49 -29 61 -29 158 0 95 3 110 27 156 39 75 125 149 201 174 84 27 172 22 255 -15z" />
          <path d="M2990 2288 c-29 -16 -36 -35 -51 -151 -8 -67 -15 -90 -28 -94 -9 -2 -44 -16 -78 -30 l-62 -25 -81 62 c-52 41 -89 63 -107 63 -35 0 -223 -188 -223 -223 0 -13 27 -58 61 -102 39 -51 59 -85 56 -96 -3 -9 -17 -46 -30 -82 l-25 -65 -103 -13 c-66 -8 -110 -19 -121 -29 -16 -14 -18 -35 -18 -163 0 -124 3 -150 16 -161 9 -7 63 -20 121 -29 l104 -15 30 -73 c16 -40 29 -78 29 -83 0 -6 -27 -45 -60 -87 -33 -43 -60 -87 -60 -98 0 -11 42 -62 101 -122 74 -76 107 -102 125 -102 16 0 56 23 105 61 l78 61 73 -28 c40 -15 76 -30 80 -33 4 -3 13 -48 19 -100 9 -61 19 -102 32 -117 18 -23 23 -24 156 -24 130 0 139 1 158 23 13 14 23 43 27 77 18 151 8 134 98 170 l80 32 79 -61 c110 -84 113 -84 232 38 71 71 97 105 97 123 0 16 -23 55 -60 103 -33 43 -60 80 -60 84 0 3 13 40 29 81 l29 75 105 15 c57 9 112 22 121 29 13 11 16 37 16 161 0 128 -2 149 -18 163 -11 10 -55 21 -121 29 l-103 13 -29 75 c-16 41 -29 79 -29 83 0 4 27 43 60 85 36 47 60 88 60 103 0 35 -187 222 -223 222 -16 0 -56 -24 -106 -63 l-81 -63 -58 26 c-31 14 -67 28 -78 31 -23 7 -26 20 -40 144 -11 102 -18 106 -171 110 -90 2 -135 -1 -153 -10z m269 -668 c60 -30 104 -72 131 -127 21 -41 25 -62 25 -138 0 -101 -12 -134 -74 -198 -61 -66 -103 -82 -206 -82 -103 0 -144 16 -207 82 -156 162 -81 426 137 484 48 13 150 2 194 -21z" />
        </g>
      </svg>
    );
  }
  if (icon === 'machineGear') {
    return <MachineGearIcon className="h-5 w-5" />;
  }
  if (icon === 'discount') {
    return (
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="h-5 w-5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M2.7 10.3a2.41 2.41 0 0 0 0 3.41l7.59 7.59a2.41 2.41 0 0 0 3.41 0l7.59-7.59a2.41 2.41 0 0 0 0-3.41L13.7 2.71a2.41 2.41 0 0 0-3.41 0Z" />
        <path d="M9.2 9.2h.01" />
        <path d="m14.5 9.5-5 5" />
        <path d="M14.7 14.8h.01" />
      </svg>
    );
  }
  if (icon === 'simpleStock') {
    return <BoxesStockIcon />;
  }
  if (icon === 'stock') {
    return (
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="h-5 w-5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="19" r="2" />
        <circle cx="12" cy="5" r="2" />
        <circle cx="16" cy="12" r="2" />
        <circle cx="20" cy="19" r="2" />
        <circle cx="4" cy="19" r="2" />
        <circle cx="8" cy="12" r="2" />
      </svg>
    );
  }
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 221 223"
      className="h-5 w-5"
      fill="currentColor"
      preserveAspectRatio="xMidYMid meet"
    >
      <g transform="translate(0,223) scale(0.1,-0.1)">
        <path d="M1290 2004 c-45 -20 -68 -41 -91 -86 -34 -66 -17 -161 38 -210 27 -25 87 -48 125 -48 42 0 113 35 137 68 67 95 36 224 -66 272 -50 24 -95 25 -143 4z" />
        <path d="M645 1965 c-46 -25 -66 -46 -86 -90 -34 -73 -19 -145 40 -200 61 -58 122 -67 199 -29 68 34 97 80 96 154 0 66 -21 109 -70 146 -45 35 -133 44 -179 19z" />
        <path d="M1715 1713 c-51 -26 -74 -54 -91 -107 -64 -204 233 -323 326 -131 44 91 9 193 -82 241 -36 19 -115 17 -153 -3z" />
        <path d="M800 1464 c-75 -32 -110 -86 -110 -167 0 -55 27 -112 69 -144 56 -44 162 -39 218 10 102 89 80 242 -42 298 -48 22 -88 23 -135 3z" />
        <path d="M1295 1441 c-58 -30 -95 -91 -95 -158 0 -62 17 -100 60 -137 85 -71 203 -52 267 43 49 73 19 200 -59 245 -46 28 -126 31 -173 7z" />
        <path d="M275 1433 c-97 -51 -133 -159 -82 -248 59 -104 198 -124 281 -40 59 58 65 166 15 237 -44 61 -148 86 -214 51z" />
        <path d="M1691 1049 c-138 -99 -67 -318 103 -319 99 0 176 78 176 179 0 58 -25 108 -73 142 -34 25 -50 29 -102 29 -53 0 -68 -4 -104 -31z" />
        <path d="M1048 1000 c-127 -38 -170 -198 -80 -293 39 -41 74 -57 127 -57 168 0 243 206 115 314 -29 24 -89 47 -120 45 -8 0 -27 -4 -42 -9z" />
        <path d="M393 909 c-46 -14 -100 -71 -113 -121 -40 -147 114 -277 248 -209 46 23 67 46 87 94 58 138 -76 281 -222 236z" />
        <path d="M1363 621 c-139 -101 -70 -321 102 -321 172 0 241 220 102 321 -34 25 -50 29 -102 29 -52 0 -68 -4 -102 -29z" />
        <path d="M811 560 c-43 -10 -80 -37 -109 -81 -32 -46 -28 -148 7 -197 60 -85 188 -96 264 -24 41 39 57 74 57 127 0 116 -107 201 -219 175z" />
      </g>
    </svg>
  );
}

function SimulatorInfoCard({
  title,
  icon,
  children
}: {
  title: string;
  icon: SimulatorInfoIcon;
  children: ReactNode;
}) {
  return (
    <div className="min-h-[132px] rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex items-center gap-3">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#1982bf14] text-[#1982bf]">
          <SimulatorIcon icon={icon} />
        </span>
        <p className="text-[14px] font-semibold text-slate-900">{title}</p>
      </div>
      <div className="mt-4 space-y-1.5 text-[12px] font-medium leading-5 text-slate-600">
        {children}
      </div>
    </div>
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
}: CommercialToolsPanelProps) {
  const pricingOptions = useMemo(() => toPricingSimulatorOptions(simulatorOptions), [simulatorOptions]);
  const simulatorSelectOptions = pricingOptions;
  const selectedOption = getSelectedPricingOption(simulatorSelectOptions, selectedOptionId);

  const minimumQuantity = getMinimumQuantity(productType, selectedOption);
  const normalizedQuantity = Math.max(minimumQuantity, quantity || minimumQuantity);
  const isWeight = productType === 'weight';
  const usesMachineDiscount = productType === 'unique_machine';
  const hasQuantityDiscounts = !usesMachineDiscount;
  const hasDiscountControl = hasQuantityDiscounts || usesMachineDiscount;
  const discountControlLabel = usesMachineDiscount ? 'Popust' : 'Količinski popust';
  const quantityUnit = isWeight ? 'kg' : selectedOption?.quantityUnit ?? selectedOption?.discountUnitLabel ?? 'kos';
  const discountQuantity = normalizedQuantity;
  const effectiveUnitPrice = getEffectiveUnitPrice(selectedOption);
  const pricedQuantity = isWeight ? getWeightPackageCount(normalizedQuantity, selectedOption) : normalizedQuantity;
  const discount = hasQuantityDiscounts && applyQuantityDiscounts
    ? getBestQuantityDiscount(quantityDiscounts, discountQuantity, selectedOption)
    : null;
  const nextDiscount = hasQuantityDiscounts
    ? getNextQuantityDiscount(quantityDiscounts, discountQuantity, selectedOption)
    : null;
  const machineDiscountPercent = clampDiscountPercent(selectedOption?.discountPercent ?? 0);
  const discountPercent = usesMachineDiscount
    ? applyQuantityDiscounts ? machineDiscountPercent : 0
    : clampDiscountPercent(discount?.discountPercent ?? 0);
  const discountBase = effectiveUnitPrice * pricedQuantity;
  const grossTotal = Number((discountBase * (1 - discountPercent / 100)).toFixed(4));
  const vat = Number((grossTotal * defaultVatRate).toFixed(2));
  const totalWithoutVat = Number((grossTotal - vat).toFixed(2));
  const discountAmount = Math.max(0, Number((discountBase - grossTotal).toFixed(2)));
  const stockAfterOrder = formatStockAfterOrder(selectedOption?.stockLabel, normalizedQuantity, quantityUnit);
  const selectedLabel = getOptionLabel(selectedOption, productType);
  const summarySelectionLabel = isWeight ? getWeightSummarySelectionLabel(selectedOption) : selectedLabel;
  const summarySelectionChips = getSummarySelectionChips(productType, selectedOption);
  const weightQuantityBreakdown = isWeight ? getWeightQuantityBreakdown(normalizedQuantity, selectedOption) : undefined;
  const simulatorDescription = productType === 'unique_machine'
    ? 'Preveri izračun glede na izbrani stroj in količino.'
    : isWeight
      ? 'Preveri izračun glede na izbrano različico, skupno maso in količinski popust.'
      : 'Preveri izračun glede na izbrano različico, količino in količinski popust.';
  const selectOptions =
    simulatorSelectOptions.length > 0
      ? simulatorSelectOptions.map((option) => ({ value: option.id, label: getOptionLabel(option, productType) }))
      : [{ value: '', label: 'Ni različic' }];
  const quickQuantities = productType === 'unique_machine' ? [1, 2, 5, 10] : [10, 25, 50, 100];
  const quantityLabel = getQuantityLabel(productType);
  const simulatorSelectDisabled = !editable || simulatorSelectOptions.length === 0;

  const detailRows: OrderPriceSummaryRow[] = [
    {
      label: getSummarySelectLabel(productType),
      detail: selectedOption?.targetKey ? `SKU: ${selectedOption.targetKey}` : undefined,
      detailDisplay: 'inline',
      value: summarySelectionLabel,
      chips: summarySelectionChips,
      icon: productType === 'dimensions'
        ? 'dimensionVariant'
        : productType === 'unique_machine'
          ? 'machine'
          : productType === 'simple'
            ? 'simpleProduct'
            : 'fraction'
    },
    {
      label: 'Cena',
      value: getSummaryPriceValue(productType, effectiveUnitPrice, quantityUnit),
      icon: 'price'
    },
    {
      label: 'Količina',
      detail: weightQuantityBreakdown,
      detailDisplay: 'inline',
      value: formatQuantity(normalizedQuantity, quantityUnit),
      icon: productType === 'dimensions'
        ? 'dimensionQuantity'
        : productType === 'unique_machine'
          ? 'machineGear'
          : productType === 'simple'
            ? 'simpleStock'
            : 'quantity'
    },
    ...(hasDiscountControl
      ? [
          {
            label: discountControlLabel,
            value: formatPercent(discountPercent),
            icon: 'discount' as const,
            tone: 'discount' as const,
            valueDisplay: 'badge' as const
          }
        ]
      : []),
    ...(stockAfterOrder
      ? [
          {
            label: 'Nova zaloga po naročilu',
            value: stockAfterOrder,
            icon: productType === 'dimensions'
              ? 'dimensionStock' as const
              : productType === 'unique_machine'
                ? 'machineGear' as const
                : productType === 'simple'
                  ? 'simpleStock' as const
                  : 'stock' as const,
            tone: getStockAfterOrderTone(productType, stockAfterOrder),
            valueDisplay: 'badge' as const
          }
        ]
      : [])
  ];

  const calculationRows: OrderPriceSummaryRow[] = [
    {
      label: 'Osnovni znesek',
      detail: isWeight
        ? `${formatDecimalForDisplay(pricedQuantity)} × ${formatCurrency(effectiveUnitPrice)}`
        : `${formatQuantity(normalizedQuantity, quantityUnit)} × ${formatCurrency(effectiveUnitPrice)}`,
      detailDisplay: 'inline',
      value: formatCurrency(discountBase)
    },
    ...(hasDiscountControl
      ? [
          {
            label: 'Popust',
            detail: formatPercent(discountPercent),
            detailDisplay: 'inline' as const,
            value: discountAmount > 0 ? `-${formatCurrency(discountAmount)}` : formatCurrency(0),
            tone: discountAmount > 0 ? 'discount' as const : 'default' as const
          }
        ]
      : []),
    {
      label: 'Skupaj brez DDV',
      value: formatCurrency(totalWithoutVat)
    },
    {
      label: 'DDV',
      detail: `${Math.round(defaultVatRate * 100)} %`,
      detailDisplay: 'inline',
      value: formatCurrency(vat)
    }
  ];

  return (
    <div className="grid gap-5">
      {!hideQuantityDiscounts ? (
        <QuantityDiscountsCard
          editable={editable}
          quantityDiscounts={quantityDiscounts}
          onAddDiscount={onAddDiscount}
          onRemoveDiscount={onRemoveDiscount}
          onUpdateDiscount={onUpdateDiscount}
          simulatorOptions={simulatorOptions}
          usesScopedCommercialTools
        />
      ) : null}

      <div className="grid items-stretch gap-5 xl:grid-cols-2">
        <section
          className={classNames(adminWindowCardClassName, 'h-full p-4')}
          style={adminWindowCardStyle}
        >
          <div className="mb-6">
            <h2 className={sectionTitleClassName}>Simulator cene naročila</h2>
            <p className="mt-4 whitespace-nowrap text-[12px] font-medium leading-4 text-slate-500">
              {simulatorDescription}
            </p>
          </div>

          <div className={classNames(
            'grid gap-4',
            hasDiscountControl
              ? 'md:grid-cols-[minmax(0,1fr)_minmax(150px,0.72fr)_minmax(170px,0.72fr)]'
              : 'md:grid-cols-[minmax(0,1fr)_minmax(150px,0.72fr)]'
          )}>
            <label className="block">
              <span className="mb-1 block text-[12px] font-semibold text-slate-700">
                {getSelectLabel(productType)}
              </span>
              <CustomSelect
                value={selectedOption?.id ?? ''}
                onChange={onSelectedOptionIdChange}
                options={selectOptions}
                disabled={simulatorSelectDisabled}
                triggerClassName={classNames(
                simulatorSelectTriggerClassName,
                '!h-9 !min-h-9 !text-[12px]',
                simulatorSelectDisabled &&
                  '!cursor-not-allowed !bg-[color:var(--field-locked-bg)] !text-slate-500 !transition-none !duration-0'
              )}
              triggerStyle={{ height: 36, minHeight: 36 }}
              valueClassName={classNames(
                simulatorSelectValueClassName,
                '!text-[12px]',
                simulatorSelectDisabled && '!text-slate-500 !transition-none !duration-0'
              )}
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-[12px] font-semibold text-slate-700">
                {quantityLabel}
              </span>
              <span className="flex h-9 overflow-hidden rounded-md border border-slate-300 bg-white">
                <DecimalDraftInput
                  className="h-full min-w-0 flex-1 rounded-l-md border-0 bg-transparent px-2.5 text-right text-[12px] font-medium text-slate-900 outline-none focus:ring-0 disabled:bg-transparent disabled:text-slate-500 disabled:opacity-100"
                  value={normalizedQuantity}
                  disabled={!editable}
                  onDecimalChange={(nextQuantity) => onQuantityChange(Math.max(minimumQuantity, nextQuantity))}
                />
                <span className="inline-flex h-full shrink-0 items-center border-l border-slate-200 px-2 text-[12px] font-semibold text-slate-500">
                  {getQuantityUnitLabel(normalizedQuantity, quantityUnit)}
                </span>
              </span>
            </label>

            {hasDiscountControl ? (
              <div>
                <span className="mb-1 block text-[12px] font-semibold text-slate-700">
                  {discountControlLabel}
                </span>
                <div className="flex h-9 items-center">
                  <SimulatorToggle
                    checked={applyQuantityDiscounts}
                    disabled={!editable}
                    onChange={onApplyQuantityDiscountsChange}
                  />
                </div>
              </div>
            ) : null}
          </div>

          <div className={classNames('mt-4 grid gap-4', hasDiscountControl ? 'md:grid-cols-3' : 'md:grid-cols-2')}>
            <SimulatorInfoCard
              title={isWeight ? 'Izbrana različica' : 'Izbrano'}
              icon={
                productType === 'dimensions'
                  ? 'dimensionVariant'
                  : productType === 'unique_machine'
                    ? 'machine'
                    : productType === 'simple'
                      ? 'simpleProduct'
                      : 'selection'
              }
            >
              <p className="max-w-full truncate text-[13px] font-semibold leading-5 text-[#1982bf]" title={selectedLabel}>{selectedLabel}</p>
              {selectedOption?.targetKey ? <p>{selectedOption.targetKey}</p> : null}
              {selectedOption?.serialLabels?.length ? <p>{selectedOption.serialLabels.join(', ')}</p> : null}
            </SimulatorInfoCard>
            {hasDiscountControl ? (
              <SimulatorInfoCard title="Popust" icon="discount">
                <p className="text-[15px] font-semibold leading-6 text-[#1982bf]">
                  {usesMachineDiscount
                    ? applyQuantityDiscounts ? formatPercent(machineDiscountPercent) : 'Brez popusta'
                    : discount ? `${formatPercent(discount.discountPercent)} pri ${formatQuantityAfterPri(discount.minQuantity, quantityUnit)}` : 'Brez popusta'}
                </p>
                {!usesMachineDiscount && nextDiscount ? (
                  <div>
                    <p>Naslednji prag:</p>
                    <p>{formatQuantity(nextDiscount.minQuantity, quantityUnit)} → {formatDecimalForDisplay(nextDiscount.discountPercent)}%</p>
                  </div>
                ) : null}
              </SimulatorInfoCard>
            ) : null}
            <SimulatorInfoCard
              title="Zaloga"
              icon={
                productType === 'dimensions'
                  ? 'dimensionQuantity'
                  : productType === 'unique_machine'
                    ? 'machineGear'
                    : productType === 'simple'
                      ? 'simpleStock'
                      : 'stock'
              }
            >
              <p className="text-[15px] font-semibold leading-6 text-[#1982bf]">{selectedOption?.stockLabel ?? 'Ni podatka'}</p>
              {selectedOption?.minOrderLabel ? <p>Min. naročilo: {selectedOption.minOrderLabel}</p> : null}
            </SimulatorInfoCard>
          </div>

          <div className="mt-4">
            <p className="mb-2 text-[12px] font-semibold text-slate-700">{quantityLabel}</p>
            <div className="grid gap-2 sm:grid-cols-4">
              {quickQuantities.map((quickQuantity) => (
                <Button
                  key={quickQuantity}
                  type="button"
                  variant={quickQuantity === normalizedQuantity ? 'primary' : 'default'}
                  size="toolbar"
                  disabled={!editable}
                  onClick={() => onQuantityChange(quickQuantity)}
                  className="!h-8 !min-h-8 !rounded-lg !px-3 !text-xs !leading-none"
                >
                  {formatQuantity(quickQuantity, quantityUnit)}
                </Button>
              ))}
            </div>
          </div>
        </section>

        <OrderPriceSummaryCard
          compact
          detailRows={detailRows}
          calculationRows={calculationRows}
          total={formatCurrency(grossTotal)}
        />
      </div>
    </div>
  );
}

export const DimensionOrderPricingPanel = CommercialToolsPanel;

export default CommercialToolsPanel;
