'use client';

import { useCallback, useMemo, useRef, useState, type ReactNode, type SVGProps } from 'react';
import ActiveStateChip from '@/admin/features/artikli/components/ActiveStateChip';
import { NoteTagChip, normalizeNoteTagValue } from '@/admin/features/artikli/components/NoteTagChip';
import EditableChipMenu, { type EditableChipMenuOption } from '@/shared/ui/badge/editable-chip-menu';
import type { BadgeVariant } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { AdminCheckbox } from '@/shared/ui/checkbox';
import { IconButton } from '@/shared/ui/icon-button';
import { useDropdownDismiss } from '@/shared/ui/dropdown/use-dropdown-dismiss';
import { CheckIcon, CloseIcon, PencilIcon, PlusIcon, TrashCanIcon } from '@/shared/ui/icons/AdminActionIcons';
import { formatCurrency } from '@/admin/features/artikli/lib/familyModel';
import { formatDecimalForDisplay } from '@/admin/features/artikli/lib/decimalFormat';
import {
  adminStatusInfoPillVariantTableClassName,
  getAdminStatusInfoMenuOptionClassName,
  hoverTokenClasses,
  selectTokenClasses
} from '@/shared/ui/theme/tokens';
import type { OrderItemSkuAllocationRow } from '@/shared/domain/order/orderTypes';
import {
  adminTableNeutralIconButtonClassName,
  adminTablePrimaryButtonClassName,
  adminTableInlineActionRowClassName,
  adminTableInlineCancelButtonClassName,
  adminTableInlineCancelIconClassName,
  adminTableInlineConfirmButtonClassName,
  adminTableInlineConfirmIconClassName,
  adminTableRowHeightClassName,
  adminTableSelectedDangerIconButtonClassName,
  adminWindowCardClassName,
  adminWindowCardStyle
} from '@/shared/ui/admin-table/standards';
import type {
  ProductEditorType,
  ProductModuleProps,
  ProductPricingLogicCardRowProps,
  ProductTypeSelectorCardRowProps,
  MachineSerialRow,
  MachineSerialStatus,
  SimpleProductData,
  SpecRow,
  TypeSpecificProductData,
  UniqueMachineProductData,
  UniqueMachineProductModuleProps,
  WeightFractionInventoryRow,
  WeightProductData,
  WeightProductModuleProps,
  WeightVariant
} from './pricingTypes';
import {
  adminProductInputChipClassName,
  compareWeightFractions,
  createWeightFractionInventoryId,
  createWeightFractionKey,
  createWeightInventoryKey,
  createWeightVariantFromCombination,
  createWeightVariantsFromChips,
  getWeightInventoryLabel,
  getWeightVariantUnitPrice,
  formatPieceCount,
  normalizeSimpleProductData,
  normalizeSingleWeightColorValue,
  normalizeUniqueMachineProductData,
  normalizeWeightFractionValue,
  normalizeWeightChip,
  normalizeWeightProductData,
  parsePackagingMass,
  syncWeightVariantsWithFractionInventory
} from './productData';
import {
  classNames,
  compactTableAdornmentClassName,
  compactTableAlignedInputClassName,
  compactTableThirtyInputClassName,
  compactTableThirtyValueUnitShellClassName,
  DecimalDraftInput,
  fieldUnitAdornmentClassName,
  ReadOnlyTableInput,
  sectionTitleClassName
} from './PricingFieldControls';
import { toGrossWithVat } from './pricingCalculations';
import { getSlovenianPieceUnit } from './unitFormatters';

type ModeIconProps = SVGProps<SVGSVGElement> & {
  type: ProductEditorType | 'price' | 'stock' | 'delivery' | 'sku' | 'service' | 'package';
};

function toTypeSpecificData(value: object): TypeSpecificProductData {
  return Object.fromEntries(Object.entries(value));
}

function ModeIcon({ type, className, ...props }: ModeIconProps) {
  const sharedProps = {
    viewBox: '0 0 24 24',
    className,
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
    ...props
  };
  if (type === 'simple') {
    return (
      <svg {...sharedProps}>
        <path d="m15 12-9.373 9.373a1 1 0 0 1-3.001-3L12 9" />
        <path d="m18 15 4-4" />
        <path d="m21.5 11.5-1.914-1.914A2 2 0 0 1 19 8.172v-.344a2 2 0 0 0-.586-1.414l-1.657-1.657A6 6 0 0 0 12.516 3H9l1.243 1.243A6 6 0 0 1 12 8.485V10l2 2h1.172a2 2 0 0 1 1.414.586L18.5 14.5" />
      </svg>
    );
  }
  if (type === 'dimensions') {
    return (
      <svg {...sharedProps}>
        <rect width="20" height="16" x="2" y="4" rx="2" />
        <path d="M12 9v11" />
        <path d="M2 9h13a2 2 0 0 1 2 2v9" />
      </svg>
    );
  }
  if (type === 'weight') {
    return (
      <svg {...sharedProps}>
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
      <svg {...sharedProps}>
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
  if (type === 'service') {
    return (
      <svg {...sharedProps}>
        <path d="M12 3 4.5 6v5.5c0 4.2 2.7 7.2 7.5 9.5 4.8-2.3 7.5-5.3 7.5-9.5V6L12 3Z" />
        <path d="m9 12 2 2 4-5" />
      </svg>
    );
  }
  if (type === 'price' || type === 'sku') {
    return (
      <svg {...sharedProps}>
        <path d="M20 12 12 20 4 12l8-8h8v8Z" />
        <circle cx="15.5" cy="8.5" r="1.2" />
      </svg>
    );
  }
  if (type === 'stock') {
    return (
      <svg {...sharedProps}>
        <rect x="5" y="5" width="14" height="14" rx="2" />
        <path d="m9 13 2-5h4l-2 4h3l-5 5 1-4H9Z" />
      </svg>
    );
  }
  if (type === 'delivery' || type === 'package') {
    return (
      <svg {...sharedProps}>
        <path d="M3 7h11v10H3z" />
        <path d="M14 10h4l3 3v4h-7z" />
        <circle cx="7" cy="18" r="1.5" />
        <circle cx="18" cy="18" r="1.5" />
      </svg>
    );
  }
  return (
    <svg {...sharedProps}>
      <rect x="5" y="5" width="14" height="14" rx="2" />
      <path d="M8 12h8M12 8v8" />
    </svg>
  );
}

export function ProductTypeSelectorCardRow({
  value,
  editable,
  onChange,
  embedded = false,
  collapsed = false,
  onExpand,
  expandDisabled = false
}: ProductTypeSelectorCardRowProps) {
  const modes: Array<{
    type: ProductEditorType;
    title: string;
    description: string[];
  }> = [
    { type: 'simple', title: 'Enostavni', description: ['En artikel brez različic.', 'Ena cena, en SKU in ena zaloga.'] },
    {
      type: 'dimensions',
      title: 'Po dimenzijah',
      description: ['Isti artikel v več merah.', 'Vsaka kombinacija dimenzij ima svojo ceno, SKU in zalogo.']
    },
    {
      type: 'weight',
      title: 'Po masi',
      description: ['Isti material v več različicah s skupno zalogo po frakciji.', 'Vsaka različica ima svojo ceno, SKU in neto maso.']
    },
    {
      type: 'unique_machine',
      title: 'Stroj / unikaten',
      description: ['Posamezen stroj ali unikaten artikel.', 'En artikel z lastnimi tehničnimi podatki, servisom in garancijo.']
    }
  ];
  const selectedMode = modes.find((mode) => mode.type === value) ?? modes[0];
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
                !editable && !selected && 'cursor-default opacity-80 hover:border-slate-200 hover:bg-white'
              )}
            >
              <ModeIcon type={mode.type} className={classNames('h-6 w-6 shrink-0 self-center', selected ? 'text-[#1982bf]' : 'text-slate-700')} />
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

  const collapsedContent = (
    <>
      <div className="mb-2 flex items-center gap-2">
        <h2 className="text-[13px] font-semibold text-slate-900">Tip artikla</h2>
      </div>
      <div className="flex min-h-[58px] items-center justify-between gap-4 rounded-lg border border-slate-200 bg-white px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <ModeIcon type={selectedMode.type} className="h-7 w-7 shrink-0 text-[#1982bf]" />
          <div className="min-w-0">
            <p className="truncate text-[13px] font-semibold leading-4 text-[#1982bf]">{selectedMode.title}</p>
            <p className="truncate text-[11px] font-medium leading-4 text-slate-600">
              {selectedMode.description.join(' ')}
            </p>
          </div>
        </div>
        <IconButton
          type="button"
          disabled={expandDisabled}
          aria-label="Spremeni tip artikla"
          title="Spremeni tip artikla"
          size="md"
          tone="neutral"
          onClick={onExpand}
        >
          <PencilIcon />
        </IconButton>
      </div>
    </>
  );

  if (embedded) {
    return <div className="mt-4 border-t border-slate-200 pt-4">{collapsed ? collapsedContent : content}</div>;
  }

  return (
    <section className={`${adminWindowCardClassName} px-5 py-5`} style={adminWindowCardStyle}>
      {collapsed ? collapsedContent : content}
    </section>
  );
}

function LogicCard({ icon, title, text }: { icon: ModeIconProps['type']; title: string; text: ReactNode }) {
  return (
    <div className="flex min-w-0 items-start gap-3 rounded-lg border border-slate-200 bg-white p-3">
      <ModeIcon type={icon} className="mt-0.5 h-6 w-6 shrink-0 text-[#1982bf]" />
      <div className="min-w-0">
        <p className="text-[12px] font-semibold text-slate-900">{title}</p>
        <p className="mt-1 text-[11px] font-medium leading-4 text-slate-600">{text}</p>
      </div>
    </div>
  );
}

export function ProductPricingLogicCardRow({
  productType,
  simpleData,
  weightData,
  machineData
}: ProductPricingLogicCardRowProps) {
  const simple = normalizeSimpleProductData(simpleData);
  const weight = normalizeWeightProductData(weightData);
  const machine = normalizeUniqueMachineProductData(machineData);
  const config = {
    simple: {
      title: 'Aktivni način: Enostavni',
      text: 'Artikel uporablja eno osnovno ceno, en SKU in eno količino zaloge. Enostavno upravljanje cen, zaloge in razpoložljivosti.',
      cards: [
        { icon: 'price' as const, title: 'Osnovna cena', text: `${formatCurrency(simple.actionPriceEnabled ? simple.actionPrice : simple.basePrice)} brez DDV` },
        { icon: 'stock' as const, title: 'Zaloga', text: formatPieceCount(simple.stock) },
        { icon: 'delivery' as const, title: 'Dobavni rok', text: simple.deliveryTime }
      ]
    },
    dimensions: {
      title: 'Aktivni način: Po dimenzijah',
      text: 'Cena, SKU in zaloga se določijo za vsako kombinacijo dimenzij. Vsaka vrstica predstavlja specifično različico artikla.',
      cards: [
        { icon: 'dimensions' as const, title: 'Dimenzije', text: 'Debelina x dolžina x širina z tolerancami' },
        { icon: 'sku' as const, title: 'SKU & Cena', text: 'Samodejno generirani SKU-ji in cene po pravilih' },
        { icon: 'stock' as const, title: 'Zaloga', text: 'Zaloga ločeno po kombinacijah skladno z vnosom' }
      ]
    },
    weight: {
      title: 'Aktivni način: Po masi',
      text: 'Artikel ima prodajne različice z lastno ceno in neto maso. Različice iste frakcije črpajo isto zalogo v kg.',
      cards: [
        { icon: 'price' as const, title: 'Različice', text: `${weight.variants.length} prodajnih različic` },
        { icon: 'stock' as const, title: 'Zaloga', text: `${formatDecimalForDisplay(weight.stockKg)} kg` },
        { icon: 'package' as const, title: 'Neto masa', text: `${formatDecimalForDisplay(weight.netMassKg)} kg` }
      ]
    },
    unique_machine: {
      title: 'Aktivni način: Stroj / unikaten',
      text: 'Artikel predstavlja posamezen stroj ali unikaten kos z lastnimi tehničnimi podatki, servisom in garancijo.',
      cards: [
        { icon: 'price' as const, title: 'Osnovna cena', text: formatCurrency(machine.basePrice) },
        { icon: 'stock' as const, title: 'Zaloga', text: formatPieceCount(machine.stock) },
        { icon: 'service' as const, title: 'Garancija', text: `${machine.warrantyMonths} ${machine.warrantyUnit?.trim() || getMachineMonthUnit(machine.warrantyMonths)}` }
      ]
    }
  }[productType];

  return (
    <section className={`${adminWindowCardClassName} px-5 py-5`} style={adminWindowCardStyle}>
      <div className="mb-4 flex items-start gap-3">
        <ModeIcon type={productType} className="h-8 w-8 shrink-0 text-[#1982bf]" />
        <div>
          <h2 className="text-[15px] font-semibold text-slate-900">{config.title}</h2>
          <p className="mt-1 text-[13px] font-medium leading-5 text-slate-600">{config.text}</p>
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        {config.cards.map((card) => (
          <LogicCard key={card.title} icon={card.icon} title={card.title} text={card.text} />
        ))}
      </div>
    </section>
  );
}

function SectionCard({ title, actions, children }: { title: string; actions?: ReactNode; children: ReactNode }) {
  return (
    <section className={`${adminWindowCardClassName} overflow-hidden`} style={adminWindowCardStyle}>
      <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
        <h2 className={sectionTitleClassName}>{title}</h2>
        {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
      </div>
      {children}
    </section>
  );
}

function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
}

function getSimpleDiscountPercent(data: SimpleProductData): number {
  if (!data.actionPriceEnabled || data.basePrice <= 0) return 0;
  return Number(clampPercent(((data.basePrice - data.actionPrice) / data.basePrice) * 100).toFixed(2));
}

function getSimpleDiscountPricePatch(basePrice: number, discountPercent: number): Pick<SimpleProductData, 'actionPrice' | 'actionPriceEnabled'> {
  const clampedDiscount = clampPercent(discountPercent);
  return {
    actionPrice: Number(Math.max(0, basePrice * (1 - clampedDiscount / 100)).toFixed(2)),
    actionPriceEnabled: clampedDiscount > 0
  };
}

export function SimpleProductModule({ editable, data, quantityDiscountsPanel, onChange }: ProductModuleProps) {
  const simpleData = normalizeSimpleProductData(data);
  const update = (updates: Partial<SimpleProductData>) => onChange(toTypeSpecificData({ ...simpleData, ...updates }));
  const discountPercent = getSimpleDiscountPercent(simpleData);
  const updateBasePrice = (basePrice: number) => update({
    basePrice,
    ...getSimpleDiscountPricePatch(basePrice, discountPercent)
  });
  const updateBasicInfoRows = (rows: SpecRow[]) => update({ basicInfoRows: rows });
  const addBasicInfoRow = () => updateBasicInfoRows([
    ...simpleData.basicInfoRows,
    { id: createMachineLocalId('simple-basic'), property: '', value: '' }
  ]);
  const removeBasicInfoRows = (ids: readonly string[]) => {
    const removeIds = new Set(ids);
    updateBasicInfoRows(simpleData.basicInfoRows.filter((row) => !removeIds.has(row.id)));
  };
  const updateBasicInfoRow = (id: string, updates: Partial<SpecRow>) => {
    updateBasicInfoRows(simpleData.basicInfoRows.map((row) => (row.id === id ? { ...row, ...updates } : row)));
  };
  const updateTechnicalSpecs = (rows: SpecRow[]) => update({ technicalSpecs: rows });
  const addTechnicalSpec = () => updateTechnicalSpecs([
    ...simpleData.technicalSpecs,
    { id: createMachineLocalId('simple-spec'), property: '', value: '' }
  ]);
  const removeTechnicalSpecs = (ids: readonly string[]) => {
    const removeIds = new Set(ids);
    updateTechnicalSpecs(simpleData.technicalSpecs.filter((row) => !removeIds.has(row.id)));
  };
  const updateTechnicalSpec = (id: string, updates: Partial<SpecRow>) => {
    updateTechnicalSpecs(simpleData.technicalSpecs.map((row) => (row.id === id ? { ...row, ...updates } : row)));
  };

  return (
    <SectionCard title="Prodajne informacije">
      <div className="grid gap-5 px-5 py-5 lg:grid-cols-[minmax(0,1fr)_minmax(548px,0.95fr)] lg:items-stretch">
        <div className={classNames(machinePanelClassName, 'h-full')}>
          <MachineInfoTable
            title="Osnovne informacije"
            editable={editable}
            fixedRows={[
              {
                key: 'basePrice',
                label: 'Osnovna cena',
                value: simpleData.basePrice,
                suffix: '€',
                numeric: true,
                hideCheckbox: true,
                onChange: (basePrice) => updateBasePrice(Number(basePrice) || 0)
              },
              {
                key: 'stock',
                label: 'Zaloga',
                value: simpleData.stock,
                suffix: getMachinePieceUnit,
                numeric: true,
                hideCheckbox: true,
                onChange: (stock) => update({ stock: Math.max(0, Math.floor(Number(stock) || 0)) })
              },
              {
                key: 'deliveryTime',
                label: 'Dobavni rok',
                value: stripMachineWorkingDayUnit(simpleData.deliveryTime),
                suffix: getMachineWorkingDayUnit,
                hideCheckbox: true,
                onChange: (deliveryTime) => update({ deliveryTime: formatMachineDeliveryTime(deliveryTime) })
              }
            ]}
            customRows={simpleData.basicInfoRows}
            customRowUnits={false}
            onAddCustomRow={addBasicInfoRow}
            onRemoveCustomRows={removeBasicInfoRows}
            onUpdateCustomRow={updateBasicInfoRow}
          />
          <MachineInfoTable
            title="Tehnične specifikacije"
            editable={editable}
            fixedRows={[]}
            customRows={simpleData.technicalSpecs}
            customRowUnits={false}
            onAddCustomRow={addTechnicalSpec}
            onRemoveCustomRows={removeTechnicalSpecs}
            onUpdateCustomRow={updateTechnicalSpec}
            flushBottom
          />
        </div>
        {quantityDiscountsPanel ? (
          <div className={classNames(machinePanelClassName, 'h-full')}>
            {quantityDiscountsPanel}
          </div>
        ) : null}
      </div>
    </SectionCard>
  );
}

function updateWeightVariant(variants: WeightVariant[], id: string, updates: Partial<WeightVariant>): WeightVariant[] {
  return variants.map((variant) => (variant.id === id ? { ...variant, ...updates } : variant));
}

function splitWeightGeneratorInput(value: string): string[] {
  return value
    .split(/[;,]/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function normalizeWeightChipValues(values: readonly string[], normalize: (value: string) => string): string[] {
  const normalized: string[] = [];
  values.forEach((value) => {
    const nextValue = normalize(value);
    if (nextValue && !normalized.some((entry) => entry.toLocaleLowerCase('sl-SI') === nextValue.toLocaleLowerCase('sl-SI'))) {
      normalized.push(nextValue);
    }
  });
  return normalized;
}

function formatWeightMassChip(value: string): string {
  const mass = parsePackagingMass(value);
  return mass === null ? value.replace(/^kg:/, '') : `${formatDecimalForDisplay(mass)} kg`;
}

function WeightGeneratorChipInput({
  editable,
  fractionChips,
  colorChips,
  massChips,
  onChange
}: {
  editable: boolean;
  fractionChips: string[];
  colorChips: string[];
  massChips: string[];
  onChange: (nextChips: { fractionChips: string[]; colorChips: string[]; massChips: string[] }) => void;
}) {
  const [draftValue, setDraftValue] = useState('');
  const massSummary = massChips
    .map(formatWeightMassChip)
    .map((value) => value.replace(/\s*kg$/i, ''))
    .join('; ');
  const chips = [
    ...(massChips.length > 0
      ? [{ kind: 'mass-group' as const, value: massChips.join('|'), label: `Neto masa: ${massSummary}` }]
      : []),
    ...colorChips.map((value) => ({ kind: 'color' as const, value, label: `Barva: ${value}` })),
    ...fractionChips.map((value) => ({ kind: 'fraction' as const, value, label: `Frakcija: ${value}` }))
  ];

  const commitDraft = () => {
    const groups = Array.from(draftValue.matchAll(/(?:^|\+)\s*(frakcija|fr|f|barva|b|neto\s*masa|neto|masa|kg)\s*:\s*([^+]+)/gi));
    if (groups.length === 0) return;
    let nextFractionChips = fractionChips;
    let nextColorChips = colorChips;
    let nextMassChips = massChips;
    groups.forEach((group) => {
      const key = group[1].toLocaleLowerCase('sl-SI').replace(/\s+/g, ' ');
      const entries = splitWeightGeneratorInput(group[2]);
      if (key === 'frakcija' || key === 'fr' || key === 'f') {
        nextFractionChips = normalizeWeightChipValues([...nextFractionChips, ...entries], normalizeWeightFractionValue);
      } else if (key === 'barva' || key === 'b') {
        nextColorChips = normalizeWeightChipValues([...nextColorChips, ...entries], normalizeSingleWeightColorValue);
      } else {
        nextMassChips = normalizeWeightChipValues([...nextMassChips, ...entries], normalizeWeightChip);
      }
    });
    onChange({ fractionChips: nextFractionChips, colorChips: nextColorChips, massChips: nextMassChips });
    setDraftValue('');
  };

  const removeChip = (chip: typeof chips[number]) => {
    onChange({
      fractionChips: chip.kind === 'fraction' ? fractionChips.filter((entry) => entry !== chip.value) : fractionChips,
      colorChips: chip.kind === 'color' ? colorChips.filter((entry) => entry !== chip.value) : colorChips,
      massChips: chip.kind === 'mass-group' ? [] : massChips
    });
  };

  return (
    <label className="relative block w-full min-w-0">
      <div
        className={classNames(
          'flex h-[30px] min-h-[30px] w-full flex-nowrap items-center overflow-hidden rounded-md border border-slate-300 !bg-white pl-[10px] pr-11 transition focus-within:border-[#3e67d6]',
          'gap-2',
          !editable && 'text-slate-500'
        )}
      >
        {chips.map((chip) => (
          <span
            key={`${chip.kind}:${chip.value}`}
            className={classNames(
              adminProductInputChipClassName,
              'shrink-0 whitespace-nowrap',
              editable && '!gap-0.5 !pr-1'
            )}
          >
            {chip.label}
            {editable ? (
              <button
                type="button"
                className="inline-flex h-3 w-3 items-center justify-center rounded-full text-[12px] leading-none text-current transition hover:text-[color:var(--danger-600)] focus-visible:outline-none"
                aria-label={`Odstrani ${chip.label}`}
                onMouseDown={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                }}
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  removeChip(chip);
                }}
              >
                &times;
              </button>
            ) : null}
          </span>
        ))}
        {editable ? (
          <input
            className="h-full min-w-0 flex-1 border-0 !bg-transparent text-xs outline-none focus:ring-0"
            value={draftValue}
            placeholder={chips.length > 0 ? '' : 'Neto masa: 0,5; 1 + Barva: modra + Frakcija: 0–2; 4'}
            onChange={(event) => setDraftValue(event.target.value)}
            onBlur={commitDraft}
            onKeyDown={(event) => {
              if (event.key !== 'Enter') return;
              event.preventDefault();
              commitDraft();
            }}
          />
        ) : (
          <span className="h-full min-w-0 flex-1 !bg-white" aria-hidden="true" />
        )}
      </div>
      <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-400">
        {Math.max(0, fractionChips.length * Math.max(1, colorChips.length) * massChips.length)}
      </span>
    </label>
  );
}

function getWorkingDayUnit(amount: string) {
  const numbers = amount.match(/\d+/g);
  const lastValue = numbers ? Number(numbers[numbers.length - 1]) : 0;
  const lastTwo = Math.abs(lastValue) % 100;
  if (lastTwo === 1) return 'delovni dan';
  if (lastTwo === 2) return 'delovna dneva';
  if (lastTwo === 3 || lastTwo === 4) return 'delovni dnevi';
  return 'delovnih dni';
}

function getDeliveryDayAmount(value: string) {
  const normalized = value.replace(/[–—]/g, '-').trim();
  const match = normalized.match(/\d+(?:\s*-\s*\d*)?/);
  return match ? match[0].replace(/\s+/g, '') : '';
}

function normalizeDeliveryDayAmount(value: string) {
  const normalized = value
    .replace(/[–—]/g, '-')
    .replace(/[^\d-\s]/g, '')
    .replace(/\s+/g, '')
    .replace(/-+/g, '-');
  const [start = '', end = ''] = normalized.split('-', 2);
  if (normalized.includes('-')) return `${start}${start ? '-' : ''}${end}`;
  return start;
}

function formatDeliveryTimeFromAmount(amount: string) {
  const normalizedAmount = normalizeDeliveryDayAmount(amount);
  return normalizedAmount ? `${normalizedAmount} ${getWorkingDayUnit(normalizedAmount)}` : '';
}

type WeightInventoryOption = Pick<WeightFractionInventoryRow, 'fraction' | 'color'>;

function createWeightInventoryOption(fraction: string, color = '—'): WeightInventoryOption {
  return {
    fraction: normalizeWeightFractionValue(fraction),
    color: normalizeSingleWeightColorValue(color)
  };
}

function createWeightFractionInventoryRow(
  option: WeightInventoryOption,
  fallback: Pick<WeightProductData, 'stockKg' | 'deliveryTime'>
): WeightFractionInventoryRow {
  const normalizedOption = createWeightInventoryOption(option.fraction, option.color);
  return {
    id: createWeightFractionInventoryId(normalizedOption.fraction, normalizedOption.color),
    fraction: normalizedOption.fraction,
    color: normalizedOption.color,
    stockKg: fallback.stockKg,
    reservedKg: 0,
    deliveryTime: fallback.deliveryTime
  };
}

function findWeightFractionInventoryRow(
  rows: readonly WeightFractionInventoryRow[],
  option: WeightInventoryOption
): WeightFractionInventoryRow | undefined {
  const key = createWeightInventoryKey(option.fraction, option.color);
  return rows.find((row) => createWeightInventoryKey(row.fraction, row.color) === key);
}

function uniqueWeightInventoryOptions(values: readonly WeightInventoryOption[]): WeightInventoryOption[] {
  const options: WeightInventoryOption[] = [];
  values.forEach((value) => {
    const option = createWeightInventoryOption(value.fraction, value.color);
    if (!option.fraction) return;
    const key = createWeightInventoryKey(option.fraction, option.color);
    if (!options.some((entry) => createWeightInventoryKey(entry.fraction, entry.color) === key)) options.push(option);
  });
  const visibleOptions = options.filter((option) =>
    option.color !== '—' ||
    !options.some((entry) => createWeightFractionKey(entry.fraction) === createWeightFractionKey(option.fraction) && entry.color !== '—')
  );
  return visibleOptions.sort((left, right) =>
    compareWeightFractions(left.fraction, right.fraction) ||
    left.color.localeCompare(right.color, 'sl-SI', { numeric: true, sensitivity: 'base' })
  );
}

function createWeightInventoryOptions(fractions: readonly string[], colors: readonly string[]): WeightInventoryOption[] {
  const normalizedColors = colors.length > 0 ? colors.map(normalizeSingleWeightColorValue) : ['—'];
  return fractions.flatMap((fraction) => normalizedColors.map((color) => createWeightInventoryOption(fraction, color)));
}

function reconcileWeightFractionInventory(
  options: readonly WeightInventoryOption[],
  currentRows: readonly WeightFractionInventoryRow[],
  fallback: Pick<WeightProductData, 'stockKg' | 'deliveryTime'>
): WeightFractionInventoryRow[] {
  return uniqueWeightInventoryOptions(options).map((option) => {
    const current = findWeightFractionInventoryRow(currentRows, option);
    return current ?? createWeightFractionInventoryRow(option, fallback);
  });
}

function uniqueWeightFractionInventoryRows(rows: readonly WeightFractionInventoryRow[]): WeightFractionInventoryRow[] {
  const uniqueRows: WeightFractionInventoryRow[] = [];
  rows.forEach((row) => {
    const option = createWeightInventoryOption(row.fraction, row.color);
    if (!option.fraction) return;
    const key = createWeightInventoryKey(option.fraction, option.color);
    if (uniqueRows.some((entry) => createWeightInventoryKey(entry.fraction, entry.color) === key)) return;
    uniqueRows.push({
      ...row,
      fraction: option.fraction,
      color: option.color
    });
  });
  return uniqueRows;
}

function renameWeightInventoryOptionInVariants(
  variants: readonly WeightVariant[],
  previousOption: WeightInventoryOption,
  nextOption: WeightInventoryOption
): WeightVariant[] {
  const previousKey = createWeightInventoryKey(previousOption.fraction, previousOption.color);
  return variants.map((variant) =>
    createWeightInventoryKey(variant.fraction, variant.color) === previousKey
      ? { ...variant, fraction: nextOption.fraction, color: nextOption.color }
      : variant
  );
}

function stripWeightFractionUnit(fraction: string): string {
  return normalizeWeightFractionValue(fraction).replace(/\s*mm$/i, '');
}

type WeightInventoryDraft = {
  fraction: string;
  color: string;
};

const emptyWeightInventoryDraft: WeightInventoryDraft = { fraction: '', color: '' };

function splitWeightFractionColorFromLabel(fraction: string, color: string): WeightInventoryOption {
  const normalizedColor = normalizeSingleWeightColorValue(color);
  if (normalizedColor !== '—') return createWeightInventoryOption(fraction, normalizedColor);

  const fractionWithoutUnit = stripWeightFractionUnit(fraction);
  const splitMatch = fractionWithoutUnit.match(/^([\d\s.,\-–—/]+)\s+(.+)$/);
  if (splitMatch?.[1] && splitMatch[2] && /\d/.test(splitMatch[1])) {
    return createWeightInventoryOption(splitMatch[1], splitMatch[2]);
  }

  return createWeightInventoryOption(fraction, normalizedColor);
}

function createWeightInventoryDraft(option: WeightInventoryOption): WeightInventoryDraft {
  const displayOption = splitWeightFractionColorFromLabel(option.fraction, option.color);
  return {
    fraction: stripWeightFractionUnit(displayOption.fraction),
    color: displayOption.color === '—' ? '' : displayOption.color
  };
}

function createWeightInventoryOptionFromDraft(draft: WeightInventoryDraft): WeightInventoryOption | null {
  const fraction = normalizeWeightFractionValue(draft.fraction);
  if (!fraction.trim()) return null;
  return createWeightInventoryOption(fraction, normalizeSingleWeightColorValue(draft.color));
}

function FractionInventoryPanel({
  editable,
  inventories,
  selectedInventoryKey,
  inventory,
  lockedInventoryKeys,
  onSelectInventory,
  onAddFraction,
  onRenameFraction,
  onDeleteInventory,
  onUpdateInventory
}: {
  editable: boolean;
  inventories: WeightFractionInventoryRow[];
  selectedInventoryKey: string;
  inventory: WeightFractionInventoryRow;
  lockedInventoryKeys: ReadonlySet<string>;
  onSelectInventory: (key: string) => void;
  onAddFraction: (option: WeightInventoryOption) => void;
  onRenameFraction: (previousOption: WeightInventoryOption, nextOption: WeightInventoryOption) => void;
  onDeleteInventory: (option: WeightInventoryOption) => void;
  onUpdateInventory: (updates: Partial<Pick<WeightFractionInventoryRow, 'stockKg' | 'reservedKg' | 'deliveryTime'>>) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [newInventoryDraft, setNewInventoryDraft] = useState<WeightInventoryDraft>(emptyWeightInventoryDraft);
  const [editingInventoryKey, setEditingInventoryKey] = useState<string | null>(null);
  const [editingInventoryDraft, setEditingInventoryDraft] = useState<WeightInventoryDraft>(emptyWeightInventoryDraft);
  const [addingFraction, setAddingFraction] = useState(false);
  const fractionMenuRef = useRef<HTMLDivElement | null>(null);
  const closeFractionMenu = useCallback(() => {
    setMenuOpen(false);
    setAddingFraction(false);
    setEditingInventoryKey(null);
    setNewInventoryDraft(emptyWeightInventoryDraft);
  }, []);
  const dismissRefs = useMemo(() => [fractionMenuRef], []);
  const deliveryDayAmount = getDeliveryDayAmount(inventory.deliveryTime);
  const deliveryDayUnit = getWorkingDayUnit(deliveryDayAmount);
  const selectedDisplayOption = splitWeightFractionColorFromLabel(inventory.fraction, inventory.color);
  const displayInventories = useMemo(() => uniqueWeightFractionInventoryRows(inventories), [inventories]);
  const fractionMenuWidthClassName = editable ? 'w-[380px]' : 'w-[228px]';
  const fractionMenuGridClassName = editable
    ? 'grid-cols-[18px_minmax(92px,1fr)_minmax(92px,0.85fr)_58px_24px]'
    : 'grid-cols-[18px_minmax(92px,1fr)_minmax(54px,0.7fr)]';
  const commitNewFraction = () => {
    const option = createWeightInventoryOptionFromDraft(newInventoryDraft);
    if (!option) return;
    onAddFraction(option);
    setNewInventoryDraft(emptyWeightInventoryDraft);
    setAddingFraction(false);
  };
  const startInventoryEdit = (option: WeightInventoryOption) => {
    const key = createWeightInventoryKey(option.fraction, option.color);
    if (lockedInventoryKeys.has(key)) return;
    setAddingFraction(false);
    setEditingInventoryKey(key);
    setEditingInventoryDraft(createWeightInventoryDraft(option));
  };
  const cancelInventoryEdit = () => {
    setEditingInventoryKey(null);
    setEditingInventoryDraft(emptyWeightInventoryDraft);
  };
  const commitRename = (previousOption: WeightInventoryOption) => {
    if (lockedInventoryKeys.has(createWeightInventoryKey(previousOption.fraction, previousOption.color))) return;
    const nextOption = createWeightInventoryOptionFromDraft(editingInventoryDraft);
    if (!nextOption) return;
    const previousKey = createWeightInventoryKey(previousOption.fraction, previousOption.color);
    const nextKey = createWeightInventoryKey(nextOption.fraction, nextOption.color);
    if (previousKey !== nextKey) onRenameFraction(previousOption, nextOption);
    cancelInventoryEdit();
  };

  useDropdownDismiss({
    open: menuOpen,
    refs: dismissRefs,
    onClose: closeFractionMenu
  });

  return (
    <aside
      className={classNames(
        'relative mb-5 inline-grid w-fit max-w-full rounded-lg border border-slate-200 bg-white lg:grid-cols-[300px_auto] xl:max-w-[66.666%]',
        menuOpen ? 'overflow-visible' : 'overflow-hidden'
      )}
    >
      <div className="flex min-w-0 items-center gap-3 px-3 py-3">
        <span className="font-['Inter',system-ui,sans-serif] text-[11px] font-semibold leading-[1.2] text-slate-600">Različica</span>
        <div ref={fractionMenuRef} className="relative min-w-0">
          <button
            type="button"
            className={classNames(
              selectTokenClasses.trigger,
              '!h-[30px] !w-[188px] !rounded-md !px-2.5 !py-0 justify-between gap-3 shadow-sm'
            )}
            onClick={() => setMenuOpen((open) => !open)}
          >
            <span className="truncate font-semibold text-slate-900">{getWeightInventoryLabel(selectedDisplayOption)}</span>
            <span
              className="h-0 w-0 border-x-[3.5px] border-t-[5px] border-x-transparent border-t-slate-500"
              aria-hidden="true"
            />
          </button>
          {menuOpen ? (
            <div className={classNames('absolute left-0 z-20 mt-1 rounded-lg border border-slate-200 bg-white p-1.5 shadow-xl', fractionMenuWidthClassName)}>
              <div className={classNames("mb-1 grid items-center gap-2 px-2 font-['Inter',system-ui,sans-serif] text-[10px] font-semibold uppercase leading-4 tracking-[0] text-slate-400", fractionMenuGridClassName)}>
                <span aria-hidden="true" />
                <span>Barva</span>
                <span>Frakcija</span>
                {editable ? (
                  <>
                    <span aria-hidden="true" />
                    <span aria-hidden="true" />
                  </>
                ) : null}
              </div>
              <div className="space-y-1">
                {displayInventories.map((entry) => {
                  const option = createWeightInventoryOption(entry.fraction, entry.color);
                  const key = createWeightInventoryKey(option.fraction, option.color);
                  const displayOption = splitWeightFractionColorFromLabel(option.fraction, option.color);
                  const locked = lockedInventoryKeys.has(key);
                  const isEditing = editingInventoryKey === key && !locked;
                  const selected = key === selectedInventoryKey;
                  return (
                    <div
                      key={key}
                      role="option"
                      aria-selected={selected}
                      tabIndex={0}
                      className={classNames(
                        "grid min-h-[42px] cursor-pointer items-center gap-2 rounded-md px-2 font-['Inter',system-ui,sans-serif] text-[12px] font-normal leading-[1.2] outline-none transition hover:text-[color:var(--blue-500)] focus-visible:ring-2 focus-visible:ring-[#1982bf]/35",
                        fractionMenuGridClassName,
                        hoverTokenClasses.neutral,
                        selected ? 'bg-slate-100 text-slate-900' : 'text-slate-600'
                      )}
                      onClick={() => onSelectInventory(key)}
                      onKeyDown={(event) => {
                        if (event.target !== event.currentTarget) return;
                        if (event.key !== 'Enter' && event.key !== ' ') return;
                        event.preventDefault();
                        onSelectInventory(key);
                      }}
                    >
                      <button
                        type="button"
                        className="inline-flex h-4 w-4 items-center justify-center rounded-full"
                        aria-label={`Izberi frakcijo ${getWeightInventoryLabel(entry)}`}
                        onClick={(event) => {
                          event.stopPropagation();
                          onSelectInventory(key);
                        }}
                      >
                        <span
                          className={
                            selected
                              ? 'h-2 w-2 rounded-full bg-[#1982bf]'
                              : 'h-2.5 w-2.5 rounded-full border border-slate-300 bg-white'
                          }
                        />
                      </button>
                      {editable && isEditing ? (
                        <>
                          <input
                            className="h-8 min-w-0 rounded-md border border-slate-300 bg-white px-2 font-['Inter',system-ui,sans-serif] text-[12px] font-semibold leading-[1.2] text-slate-900 outline-none focus:border-[#3e67d6] focus:ring-0"
                            value={editingInventoryDraft.color}
                            autoFocus
                            placeholder="bela"
                            onChange={(event) => setEditingInventoryDraft((current) => ({ ...current, color: event.target.value }))}
                            onKeyDown={(event) => {
                              if (event.key === 'Escape') {
                                event.preventDefault();
                                cancelInventoryEdit();
                                return;
                              }
                              if (event.key !== 'Enter') return;
                              event.preventDefault();
                              commitRename(option);
                            }}
                          />
                          <span className="flex h-8 min-w-0 rounded-md border border-slate-300 bg-white">
                            <input
                              className="h-full min-w-0 flex-1 rounded-l-md border-0 bg-transparent px-2 font-['Inter',system-ui,sans-serif] text-[12px] font-semibold leading-[1.2] text-slate-900 outline-none focus:ring-0"
                              value={editingInventoryDraft.fraction}
                              placeholder="0-2"
                              onChange={(event) => setEditingInventoryDraft((current) => ({ ...current, fraction: event.target.value }))}
                              onKeyDown={(event) => {
                                if (event.key === 'Escape') {
                                  event.preventDefault();
                                  cancelInventoryEdit();
                                  return;
                                }
                                if (event.key !== 'Enter') return;
                                event.preventDefault();
                                commitRename(option);
                              }}
                            />
                            <span className={fieldUnitAdornmentClassName}>mm</span>
                          </span>
                        </>
                      ) : editable && !locked ? (
                        <>
                          <button
                            type="button"
                            className="min-w-0 truncate rounded-md px-1 py-1 text-left font-semibold text-slate-700 hover:bg-white hover:text-slate-900"
                            onClick={() => startInventoryEdit(option)}
                            title="Uredi barvo"
                          >
                            {displayOption.color === '—' ? '—' : displayOption.color}
                          </button>
                          <button
                            type="button"
                            className="min-w-0 truncate rounded-md px-1 py-1 text-left font-semibold text-slate-500 hover:bg-white hover:text-slate-900"
                            onClick={() => startInventoryEdit(option)}
                            title="Uredi frakcijo"
                          >
                            {stripWeightFractionUnit(displayOption.fraction)} mm
                          </button>
                        </>
                      ) : (
                        <>
                          <span className="min-w-0 truncate text-left font-semibold text-slate-700">
                            {displayOption.color === '—' ? '—' : displayOption.color}
                          </span>
                          <button
                            type="button"
                            className="min-w-0 truncate text-left font-semibold text-slate-500"
                            onClick={(event) => {
                              event.stopPropagation();
                              onSelectInventory(key);
                            }}
                          >
                            {stripWeightFractionUnit(displayOption.fraction)} mm
                          </button>
                        </>
                      )}
                      {editable ? (
                        isEditing ? (
                          <span className={adminTableInlineActionRowClassName}>
                            <IconButton
                              type="button"
                              tone="neutral"
                              className={adminTableInlineConfirmButtonClassName}
                              disabled={editingInventoryDraft.fraction.trim().length === 0}
                              aria-label={`Potrdi urejanje za ${getWeightInventoryLabel(entry)}`}
                              title="Potrdi"
                              onClick={(event) => {
                                event.stopPropagation();
                                commitRename(option);
                              }}
                            >
                              <CheckIcon className={adminTableInlineConfirmIconClassName} strokeWidth={2.2} />
                            </IconButton>
                            <IconButton
                              type="button"
                              tone="neutral"
                              className={adminTableInlineCancelButtonClassName}
                              aria-label={`Prekliči urejanje za ${getWeightInventoryLabel(entry)}`}
                              title="Prekliči"
                              onClick={(event) => {
                                event.stopPropagation();
                                cancelInventoryEdit();
                              }}
                            >
                              <CloseIcon className={adminTableInlineCancelIconClassName} strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" />
                            </IconButton>
                          </span>
                        ) : (
                          <span aria-hidden="true" />
                        )
                      ) : null}
                      {editable ? (
                        <button
                          type="button"
                          className="inline-flex h-6 w-6 items-center justify-center rounded-md text-slate-300 hover:bg-rose-50 hover:text-rose-500 disabled:cursor-not-allowed disabled:opacity-40"
                          aria-label={`Izbriši frakcijo ${getWeightInventoryLabel(entry)}`}
                          disabled={displayInventories.length <= 1 || locked}
                          onClick={(event) => {
                            event.stopPropagation();
                            onDeleteInventory(option);
                          }}
                        >
                          <TrashCanIcon className="h-4 w-4" />
                        </button>
                      ) : null}
                    </div>
                  );
                })}
              </div>
              {editable ? (
                addingFraction ? (
                  <div className="mt-1 rounded-lg border border-slate-200 bg-white px-2 py-1.5">
                    <div className="grid min-h-[34px] grid-cols-[18px_minmax(92px,1fr)_minmax(92px,0.85fr)_58px] items-center gap-2">
                      <PlusIcon className="h-4 w-4 text-slate-600" />
                      <input
                        className="h-8 min-w-0 rounded-md border border-slate-300 bg-white px-2 font-['Inter',system-ui,sans-serif] text-[12px] font-semibold leading-[1.2] text-slate-900 outline-none focus:border-[#3e67d6] focus:ring-0"
                        value={newInventoryDraft.color}
                        placeholder="bela"
                        autoFocus
                        onChange={(event) => setNewInventoryDraft((current) => ({ ...current, color: event.target.value }))}
                        onKeyDown={(event) => {
                          if (event.key === 'Escape') {
                            setAddingFraction(false);
                            setNewInventoryDraft(emptyWeightInventoryDraft);
                            return;
                          }
                          if (event.key !== 'Enter') return;
                          event.preventDefault();
                          commitNewFraction();
                        }}
                      />
                      <span className="flex h-8 min-w-0 rounded-md border border-slate-300 bg-white">
                        <input
                          className="h-full min-w-0 flex-1 rounded-l-md border-0 bg-transparent px-2 font-['Inter',system-ui,sans-serif] text-[12px] font-semibold leading-[1.2] text-slate-900 outline-none focus:ring-0"
                          value={newInventoryDraft.fraction}
                          placeholder="0-2"
                          onChange={(event) => setNewInventoryDraft((current) => ({ ...current, fraction: event.target.value }))}
                          onKeyDown={(event) => {
                            if (event.key === 'Escape') {
                              setAddingFraction(false);
                              setNewInventoryDraft(emptyWeightInventoryDraft);
                              return;
                            }
                            if (event.key !== 'Enter') return;
                            event.preventDefault();
                            commitNewFraction();
                          }}
                        />
                        <span className={fieldUnitAdornmentClassName}>mm</span>
                      </span>
                      <span className={adminTableInlineActionRowClassName}>
                        <IconButton
                          type="button"
                          tone="neutral"
                          className={adminTableInlineConfirmButtonClassName}
                          disabled={newInventoryDraft.fraction.trim().length === 0}
                          aria-label="Potrdi novo frakcijo"
                          title="Potrdi"
                          onClick={commitNewFraction}
                        >
                          <CheckIcon className={adminTableInlineConfirmIconClassName} strokeWidth={2.2} />
                        </IconButton>
                        <IconButton
                          type="button"
                          tone="neutral"
                          className={adminTableInlineCancelButtonClassName}
                          aria-label="Prekliči dodajanje frakcije"
                          title="Prekliči"
                          onClick={() => {
                            setAddingFraction(false);
                            setNewInventoryDraft(emptyWeightInventoryDraft);
                          }}
                        >
                          <CloseIcon className={adminTableInlineCancelIconClassName} strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" />
                        </IconButton>
                      </span>
                    </div>
                </div>
                ) : (
                  <button
                    type="button"
                    className="mt-1 flex h-8 w-full items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-3 font-['Inter',system-ui,sans-serif] text-[12px] font-semibold leading-[1.2] text-slate-600 shadow-[0_1px_2px_rgba(15,23,42,0.04)] hover:bg-slate-50"
                    onClick={() => {
                      setEditingInventoryKey(null);
                      setAddingFraction(true);
                    }}
                  >
                    <PlusIcon className="h-3.5 w-3.5" />
                    Dodaj frakcijo
                  </button>
                )
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      <div className="grid min-w-0 border-t border-slate-200 bg-white md:grid-cols-[205px_275px] lg:border-l lg:border-t-0 xl:divide-x xl:divide-slate-200">
        <div className="flex min-h-[62px] min-w-0 items-center gap-2 px-3 py-3">
          <span className="shrink-0 text-[11px] font-semibold text-slate-600">Zaloga</span>
          <span className="ml-auto min-w-0">
            <span className="flex h-[30px] w-[110px] rounded-md border border-slate-300 bg-white">
              {editable ? (
                <DecimalDraftInput
                  className="h-full min-w-0 flex-1 rounded-l-md border-0 bg-transparent px-2.5 text-[12px] font-semibold text-slate-900 outline-none focus:ring-0"
                  value={inventory.stockKg}
                  onDecimalChange={(stockKg) => onUpdateInventory({ stockKg: Math.max(0, stockKg) })}
                />
              ) : (
                <input
                  className="h-full min-w-0 flex-1 rounded-l-md border-0 bg-transparent px-2.5 text-[12px] font-semibold text-slate-900 outline-none focus:ring-0"
                  value={formatDecimalForDisplay(inventory.stockKg)}
                  readOnly
                  tabIndex={-1}
                />
              )}
              <span className={fieldUnitAdornmentClassName}>kg</span>
            </span>
          </span>
        </div>
        <div className="flex min-h-[62px] min-w-0 items-center gap-2 px-3 py-3">
          <span className="shrink-0 text-[11px] font-semibold text-slate-600">Dobavni rok</span>
          <span className="ml-auto min-w-0">
            <span className="flex h-[30px] w-[175px] rounded-md border border-slate-300 bg-white">
              <input
                className="h-full min-w-0 flex-1 rounded-l-md border-0 bg-transparent px-2.5 text-[12px] font-semibold text-slate-900 outline-none focus:ring-0"
                value={deliveryDayAmount}
                inputMode="numeric"
                placeholder="1-2"
                readOnly={!editable}
                tabIndex={editable ? undefined : -1}
                onChange={(event) => onUpdateInventory({ deliveryTime: formatDeliveryTimeFromAmount(event.target.value) })}
              />
              <span className={fieldUnitAdornmentClassName}>{deliveryDayUnit}</span>
            </span>
          </span>
        </div>
      </div>
    </aside>
  );
}

export function WeightProductModule({
  editable,
  data,
  baseSku,
  color,
  quantityDiscountsPanel,
  onChange
}: WeightProductModuleProps) {
  const [selectedVariantIds, setSelectedVariantIds] = useState<Set<string>>(new Set());
  const weightData = normalizeWeightProductData(data, { baseSku });
  const update = (updates: Partial<WeightProductData>) => onChange(toTypeSpecificData({ ...weightData, ...updates }));
  const fractionChips = weightData.fractionChips;
  const colorChips = weightData.colorChips;
  const massChips = weightData.packagingChips;
  const inventoryOptions = uniqueWeightInventoryOptions([
    ...createWeightInventoryOptions(fractionChips, colorChips),
    ...weightData.fractionInventory.map((entry) => createWeightInventoryOption(entry.fraction, entry.color)),
    ...weightData.variants.map((variant) => createWeightInventoryOption(variant.fraction, variant.color))
  ]);
  const fractionInventory = uniqueWeightFractionInventoryRows(
    reconcileWeightFractionInventory(inventoryOptions, weightData.fractionInventory, weightData)
  );
  const firstInventoryOption = fractionInventory[0] ?? createWeightFractionInventoryRow(createWeightInventoryOption(weightData.fraction, colorChips[0] ?? normalizeSingleWeightColorValue(color ?? '—')), weightData);
  const [selectedInventoryKey, setSelectedInventoryKey] = useState(() => createWeightInventoryKey(firstInventoryOption.fraction, firstInventoryOption.color));
  const activeInventory = fractionInventory.find((entry) => createWeightInventoryKey(entry.fraction, entry.color) === selectedInventoryKey)
    ?? firstInventoryOption;
  const activeInventoryKey = createWeightInventoryKey(activeInventory.fraction, activeInventory.color);
  const weightTableVariantKeys = useMemo(
    () => new Set(weightData.variants.map((variant) => createWeightInventoryKey(variant.fraction, variant.color))),
    [weightData.variants]
  );
  const updateFractionInventoryRows = (
    nextRows: WeightFractionInventoryRow[],
    nextVariants: readonly WeightVariant[] = weightData.variants,
    nextFractionChips: readonly string[] = fractionChips,
    nextColorChips: readonly string[] = colorChips
  ) => {
    const uniqueRows = uniqueWeightFractionInventoryRows(nextRows);
    const syncedVariants = syncWeightVariantsWithFractionInventory(nextVariants, uniqueRows);
    update({
      fraction: nextFractionChips[0] ?? uniqueRows[0]?.fraction ?? weightData.fraction,
      fractionChips: [...nextFractionChips],
      colorChips: [...nextColorChips],
      stockKg: uniqueRows[0]?.stockKg ?? weightData.stockKg,
      deliveryTime: uniqueRows[0]?.deliveryTime ?? weightData.deliveryTime,
      fractionInventory: uniqueRows,
      variants: syncedVariants
    });
  };
  const updateActiveInventory = (updates: Partial<Pick<WeightFractionInventoryRow, 'stockKg' | 'reservedKg' | 'deliveryTime'>>) => {
    const nextRows = fractionInventory.map((entry) => {
      if (createWeightInventoryKey(entry.fraction, entry.color) !== activeInventoryKey) return entry;
      const stockKg = Math.max(0, updates.stockKg ?? entry.stockKg);
      const reservedKg = Math.min(stockKg, Math.max(0, updates.reservedKg ?? entry.reservedKg));
      return {
        ...entry,
        stockKg,
        reservedKg,
        deliveryTime: updates.deliveryTime ?? entry.deliveryTime
      };
    });
    updateFractionInventoryRows(nextRows);
  };
  const addInventoryFraction = (option: WeightInventoryOption) => {
    const key = createWeightInventoryKey(option.fraction, option.color);
    if (fractionInventory.some((entry) => createWeightInventoryKey(entry.fraction, entry.color) === key)) {
      setSelectedInventoryKey(key);
      return;
    }
    const nextRows = [...fractionInventory, createWeightFractionInventoryRow(option, weightData)];
    setSelectedInventoryKey(key);
    updateFractionInventoryRows(nextRows, weightData.variants);
  };
  const renameInventoryFraction = (previousOption: WeightInventoryOption, nextOption: WeightInventoryOption) => {
    const previousKey = createWeightInventoryKey(previousOption.fraction, previousOption.color);
    const nextKey = createWeightInventoryKey(nextOption.fraction, nextOption.color);
    if (weightTableVariantKeys.has(previousKey) || weightTableVariantKeys.has(nextKey)) return;
    if (fractionInventory.some((entry) => createWeightInventoryKey(entry.fraction, entry.color) === nextKey && createWeightInventoryKey(entry.fraction, entry.color) !== previousKey)) return;
    const nextRows = fractionInventory.map((entry) =>
      createWeightInventoryKey(entry.fraction, entry.color) === previousKey
        ? { ...entry, id: createWeightFractionInventoryId(nextOption.fraction, nextOption.color), fraction: nextOption.fraction, color: nextOption.color }
        : entry
    );
    const nextVariants = renameWeightInventoryOptionInVariants(weightData.variants, previousOption, nextOption);
    setSelectedInventoryKey(nextKey);
    updateFractionInventoryRows(nextRows, nextVariants);
  };
  const deleteInventoryFraction = (option: WeightInventoryOption) => {
    if (fractionInventory.length <= 1) return;
    const key = createWeightInventoryKey(option.fraction, option.color);
    if (weightTableVariantKeys.has(key)) return;
    const nextRows = fractionInventory.filter((entry) => createWeightInventoryKey(entry.fraction, entry.color) !== key);
    const nextVariants = weightData.variants.filter((variant) => createWeightInventoryKey(variant.fraction, variant.color) !== key);
    const nextSelected = nextRows[0] ?? createWeightFractionInventoryRow(createWeightInventoryOption(weightData.fraction, colorChips[0] ?? normalizeSingleWeightColorValue(color ?? '—')), weightData);
    setSelectedInventoryKey(createWeightInventoryKey(nextSelected.fraction, nextSelected.color));
    updateFractionInventoryRows(nextRows, nextVariants);
  };
  const regenerateVariants = () => {
    const generatedVariants = createWeightVariantsFromChips({
      ...weightData,
      fractionChips,
      colorChips,
      packagingChips: massChips
    }, baseSku);
    const nextInventory = reconcileWeightFractionInventory(
      [
        ...createWeightInventoryOptions(fractionChips, colorChips),
        ...generatedVariants.map((variant) => createWeightInventoryOption(variant.fraction, variant.color)),
        ...fractionInventory.map((entry) => createWeightInventoryOption(entry.fraction, entry.color))
      ],
      fractionInventory,
      weightData
    );
    update({
      fraction: fractionChips[0] ?? weightData.fraction,
      colorChips,
      packagingChips: massChips,
      stockKg: nextInventory[0]?.stockKg ?? weightData.stockKg,
      deliveryTime: nextInventory[0]?.deliveryTime ?? weightData.deliveryTime,
      fractionInventory: nextInventory,
      variants: syncWeightVariantsWithFractionInventory(generatedVariants, nextInventory)
    });
    setSelectedVariantIds(new Set());
  };
  const addVariant = () => {
    const netMassKg = parsePackagingMass(massChips[0] ?? '') ?? weightData.netMassKg;
    const nextVariant = createWeightVariantFromCombination({
      netMassKg,
      fraction: fractionChips[0] ?? weightData.fraction,
      color: colorChips[0] ?? '—',
      index: weightData.variants.length,
      data: weightData,
      baseSku
    });
    const nextInventory = reconcileWeightFractionInventory(
      [
        ...fractionInventory.map((entry) => createWeightInventoryOption(entry.fraction, entry.color)),
        createWeightInventoryOption(nextVariant.fraction, nextVariant.color)
      ],
      fractionInventory,
      weightData
    );
    update({
      fractionInventory: nextInventory,
      variants: syncWeightVariantsWithFractionInventory([...weightData.variants, nextVariant], nextInventory)
    });
  };
  const removeSelectedVariants = () => {
    if (selectedVariantIds.size === 0) return;
    update({ variants: weightData.variants.filter((variant) => !selectedVariantIds.has(variant.id)) });
    setSelectedVariantIds(new Set());
  };
  const toggleVariantSelection = (id: string) => {
    setSelectedVariantIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const allVariantsSelected = weightData.variants.length > 0 && weightData.variants.every((variant) => selectedVariantIds.has(variant.id));
  const hasSelectedVariants = selectedVariantIds.size > 0;

  return (
    <SectionCard title="Prodaja po masi">
      <div className="px-5 pb-5 pt-5">
        <FractionInventoryPanel
          editable={editable}
          inventories={fractionInventory}
          selectedInventoryKey={activeInventoryKey}
          inventory={activeInventory}
          lockedInventoryKeys={weightTableVariantKeys}
          onSelectInventory={setSelectedInventoryKey}
          onAddFraction={addInventoryFraction}
          onRenameFraction={renameInventoryFraction}
          onDeleteInventory={deleteInventoryFraction}
          onUpdateInventory={updateActiveInventory}
        />
        <div className="mt-5 space-y-1 px-1">
          <p className="flex flex-wrap items-center gap-1.5 text-[12px] font-medium leading-5 text-slate-600">
            <span>V spodnji tabli vnesi neto maso, barvo in frakcijo v en vnos, na primer:</span>
            <span className={adminProductInputChipClassName}>Neto masa: 0,5; 1</span>
            <span className={adminProductInputChipClassName}>Barva: modra</span>
            <span>in</span>
            <span className={adminProductInputChipClassName}>Frakcija: 0-2; 4</span>
            <span>.</span>
          </p>
          <p className="flex flex-wrap items-center gap-1.5 text-[12px] font-medium leading-5 text-slate-600">
            <span className="font-semibold">Vnosne bližnjice:</span>
            <span className={adminProductInputChipClassName}>kg:</span>
            <span className={adminProductInputChipClassName}>b:</span>
            <span className={adminProductInputChipClassName}>fr:</span>
            <span>.</span>
          </p>
        </div>
        <div className="relative mt-3 overflow-x-auto overflow-y-visible rounded-lg border border-slate-200">
          <div className="grid min-w-full grid-cols-[minmax(120px,1fr)_minmax(320px,560px)_minmax(340px,1fr)] items-center gap-3 border-b border-slate-200 bg-white px-4 py-3">
            <h3 className="text-sm font-semibold text-slate-900">Različice</h3>
            <div className="w-[560px] max-w-full min-w-0 justify-self-center">
              <WeightGeneratorChipInput
                editable={editable}
                fractionChips={fractionChips}
                colorChips={colorChips}
                massChips={massChips}
                onChange={(nextChips) => {
                  const nextFractions = nextChips.fractionChips;
                  const nextColors = nextChips.colorChips;
                  update({
                    fractionChips: nextFractions,
                    fraction: nextFractions[0] ?? weightData.fraction,
                    colorChips: nextColors,
                    packagingChips: nextChips.massChips
                  });
                }}
              />
            </div>
            <div className="flex items-center justify-end gap-2 justify-self-end">
              <IconButton
                type="button"
                aria-label="Dodaj različico"
                title="Dodaj različico"
                tone="neutral"
                className={adminTableNeutralIconButtonClassName}
                disabled={!editable}
                onClick={addVariant}
              >
                <PlusIcon />
              </IconButton>
              <IconButton
                type="button"
                aria-label="Odstrani izbrane različice"
                title="Izbriši izbrane"
                tone={hasSelectedVariants ? 'danger' : 'neutral'}
                className={hasSelectedVariants ? adminTableSelectedDangerIconButtonClassName : adminTableNeutralIconButtonClassName}
                disabled={!editable || !hasSelectedVariants}
                onClick={removeSelectedVariants}
              >
                <TrashCanIcon />
              </IconButton>
              <Button
                type="button"
                variant="primary"
                size="toolbar"
                disabled={!editable}
                onClick={regenerateVariants}
                className={adminTablePrimaryButtonClassName}
              >
                Generiraj različice
              </Button>
            </div>
          </div>
          <table className="min-w-full table-fixed text-[11px] leading-4">
          <colgroup>
            <col style={{ width: '1.87%' }} />
            <col style={{ width: '5.76%' }} />
            <col style={{ width: '8.8%' }} />
            <col style={{ width: '5.8%' }} />
            <col style={{ width: '5.8%' }} />
            <col style={{ width: '5.8%' }} />
            <col style={{ width: '5.8%' }} />
            <col style={{ width: '5.8%' }} />
            <col style={{ width: '20.97%' }} />
            <col style={{ width: '8%' }} />
            <col style={{ width: '9%' }} />
            <col style={{ width: '3.06%' }} />
          </colgroup>
          <thead className="bg-[color:var(--admin-table-header-bg)]">
            <tr>
              <th className={`${adminTableRowHeightClassName} px-2 py-1.5 text-center text-[11px] font-semibold text-slate-700`}>
                <AdminCheckbox
                  checked={editable && allVariantsSelected}
                  disabled={!editable || weightData.variants.length === 0}
                  onChange={() =>
                    setSelectedVariantIds(allVariantsSelected ? new Set() : new Set(weightData.variants.map((variant) => variant.id)))
                  }
                />
              </th>
              <th className={`${adminTableRowHeightClassName} whitespace-nowrap px-2 py-1.5 text-right text-[11px] font-semibold text-slate-700`}>Masa</th>
              <th className={`${adminTableRowHeightClassName} whitespace-nowrap px-2 py-1.5 text-left text-[11px] font-semibold text-slate-700`}>Barva</th>
              <th className={`${adminTableRowHeightClassName} whitespace-nowrap px-2 py-1.5 text-left text-[11px] font-semibold text-slate-700`}>Frakcija</th>
              <th className={`${adminTableRowHeightClassName} whitespace-nowrap py-1.5 pl-6 pr-2 text-left text-[11px] font-semibold text-slate-700`}>Toleranca</th>
              <th className={`${adminTableRowHeightClassName} whitespace-nowrap px-2 py-1.5 text-right text-[11px] font-semibold text-slate-700`}>Cena</th>
              <th className={`${adminTableRowHeightClassName} whitespace-nowrap px-2 py-1.5 text-right text-[11px] font-semibold text-slate-700`}>Zaloga</th>
              <th className={`${adminTableRowHeightClassName} whitespace-nowrap py-1.5 pl-2 pr-1 text-right text-[11px] font-semibold text-slate-700`}>Min. količina</th>
              <th className={`${adminTableRowHeightClassName} px-2 py-1.5 text-center text-[11px] font-semibold text-slate-700`}>SKU</th>
              <th className={`${adminTableRowHeightClassName} px-1 py-1.5 text-center text-[11px] font-semibold text-slate-700`}>Status</th>
              <th className={`${adminTableRowHeightClassName} px-1 py-1.5 text-center text-[11px] font-semibold text-slate-700`}>Opombe</th>
              <th className={`${adminTableRowHeightClassName} px-2 py-1.5 text-center text-[11px] font-semibold text-slate-700`}>Mesto</th>
            </tr>
          </thead>
          <tbody>
            {weightData.variants.length > 0 ? (
              weightData.variants.map((variant) => (
                <tr key={variant.id} className={`${adminTableRowHeightClassName} border-t border-slate-100 align-middle`}>
                  <td className="px-2 py-1.5 text-center">
                    <AdminCheckbox
                      checked={selectedVariantIds.has(variant.id)}
                      disabled={!editable}
                      onChange={() => toggleVariantSelection(variant.id)}
                    />
                  </td>
                  <td className="px-2 py-1.5 text-right">
                    {editable ? (
                      <span className={`${compactTableThirtyValueUnitShellClassName} justify-end`}>
                        <DecimalDraftInput
                          className={`${compactTableThirtyInputClassName} !mt-0 !w-[7ch] text-right`}
                          value={variant.netMassKg ?? 0}
                          onDecimalChange={(netMassKg) => update({ variants: updateWeightVariant(weightData.variants, variant.id, { netMassKg }) })}
                        />
                        <span className={compactTableAdornmentClassName}>kg</span>
                      </span>
                    ) : (
                      <span className={`${compactTableThirtyValueUnitShellClassName} justify-end`}>
                        <ReadOnlyTableInput
                          className="!w-[7ch] text-right"
                          value={variant.netMassKg === null ? '—' : formatDecimalForDisplay(variant.netMassKg)}
                        />
                        {variant.netMassKg === null ? null : <span className={compactTableAdornmentClassName}>kg</span>}
                      </span>
                    )}
                  </td>
                  <td className="px-2 py-1.5">
                    {editable ? (
                      <input
                        className={`${compactTableThirtyInputClassName} !mt-0 w-full text-left`}
                        value={variant.color}
                        onChange={(event) => update({ variants: updateWeightVariant(weightData.variants, variant.id, { color: normalizeSingleWeightColorValue(event.target.value) }) })}
                      />
                    ) : (
                      <ReadOnlyTableInput
                        className="!w-full text-left"
                        value={variant.color || '—'}
                      />
                    )}
                  </td>
                  <td className="px-2 py-1.5">
                    {editable ? (
                      <span className={`${compactTableThirtyValueUnitShellClassName} w-full justify-start`}>
                        <input
                          className={`${compactTableThirtyInputClassName} !mt-0 !w-[4ch] text-left`}
                          value={stripWeightFractionUnit(variant.fraction)}
                          onChange={(event) => update({ variants: updateWeightVariant(weightData.variants, variant.id, { fraction: normalizeWeightFractionValue(event.target.value) }) })}
                        />
                        <span className={compactTableAdornmentClassName}>mm</span>
                      </span>
                    ) : (
                      <span className={`${compactTableThirtyValueUnitShellClassName} w-full justify-start`}>
                        <ReadOnlyTableInput
                          className="!w-[4ch] text-left"
                          value={variant.fraction ? stripWeightFractionUnit(variant.fraction) : '—'}
                        />
                        {variant.fraction ? <span className={compactTableAdornmentClassName}>mm</span> : null}
                      </span>
                    )}
                  </td>
                  <td className="py-1.5 pl-6 pr-2 text-left">
                    {editable ? (
                      <div className="inline-flex h-[30px] w-full items-center justify-start whitespace-nowrap">
                        <span className={compactTableAdornmentClassName}>±</span>
                        <input
                          type="text"
                          inputMode="decimal"
                          maxLength={1}
                          className={`${compactTableAlignedInputClassName} !mt-0 !h-[30px] !w-[3ch] !px-0 text-center`}
                          value={variant.tolerance}
                          onChange={(event) => update({ variants: updateWeightVariant(weightData.variants, variant.id, { tolerance: event.target.value.replace(/\D/g, '').slice(0, 1) }) })}
                        />
                        <span className={`ml-1 ${compactTableAdornmentClassName}`}>mm</span>
                      </div>
                    ) : (
                      <span className="inline-flex h-[30px] w-full items-center justify-start">
                        <span className={classNames(compactTableAdornmentClassName, !variant.tolerance && 'invisible')}>±</span>
                        <ReadOnlyTableInput
                          className="!w-[3ch] !px-0 text-center"
                          value={variant.tolerance ? variant.tolerance.replace('.', ',') : '—'}
                        />
                        <span className={classNames(`ml-1 ${compactTableAdornmentClassName}`, !variant.tolerance && 'invisible')}>mm</span>
                      </span>
                    )}
                  </td>
                  <td className="px-2 py-1.5 text-right">
                    {editable ? (
                      <span className={`${compactTableThirtyValueUnitShellClassName} justify-end`}>
                        <DecimalDraftInput
                          className={`${compactTableThirtyInputClassName} !mt-0 !w-[7ch] text-right`}
                          value={getWeightVariantUnitPrice(variant)}
                          onDecimalChange={(unitPrice) => update({ variants: updateWeightVariant(weightData.variants, variant.id, { unitPrice }) })}
                        />
                        <span className={compactTableAdornmentClassName}>€</span>
                      </span>
                    ) : (
                      <span className={`${compactTableThirtyValueUnitShellClassName} justify-end`}>
                        <ReadOnlyTableInput
                          className="!w-[7ch] text-right"
                          value={formatDecimalForDisplay(getWeightVariantUnitPrice(variant))}
                        />
                        <span className={compactTableAdornmentClassName}>€</span>
                      </span>
                    )}
                  </td>
                  <td className="px-2 py-1.5 text-right">
                    <span className={`${compactTableThirtyValueUnitShellClassName} justify-end`}>
                      <ReadOnlyTableInput
                        className="!w-[5ch] text-right"
                        value={formatDecimalForDisplay(variant.stockKg)}
                      />
                      <span className={`shrink-0 ${compactTableAdornmentClassName}`}>kg</span>
                    </span>
                  </td>
                  <td className="px-2 py-1.5 text-right">
                    {editable ? (
                      <span className={`${compactTableThirtyValueUnitShellClassName} justify-end`}>
                        <DecimalDraftInput
                          className={`${compactTableThirtyInputClassName} !mt-0 !w-[5ch] text-right`}
                          value={variant.minQuantity}
                          onDecimalChange={(minQuantity) => update({ variants: updateWeightVariant(weightData.variants, variant.id, { minQuantity: Math.max(1, Math.floor(minQuantity) || 1) }) })}
                        />
                        <span className={compactTableAdornmentClassName}>kg</span>
                      </span>
                    ) : (
                      <span className={`${compactTableThirtyValueUnitShellClassName} justify-end`}>
                        <ReadOnlyTableInput
                          className="!w-[5ch] text-right"
                          value={variant.minQuantity}
                        />
                        <span className={compactTableAdornmentClassName}>kg</span>
                      </span>
                    )}
                  </td>
                  <td className="px-2 py-1.5 text-center">
                    {editable ? (
                      <input
                        className={`${compactTableThirtyInputClassName} mx-auto !mt-0 !block !w-[31ch] text-center`}
                        value={variant.sku}
                        onChange={(event) => update({ variants: updateWeightVariant(weightData.variants, variant.id, { sku: event.target.value }) })}
                      />
                    ) : (
                      <ReadOnlyTableInput
                        className="mx-auto block !w-[31ch] text-center"
                        value={variant.sku || '—'}
                      />
                    )}
                  </td>
                  <td className="px-1 py-1.5 text-center">
                    <div className="inline-flex justify-center">
                      <ActiveStateChip
                        active={variant.active}
                        editable={editable}
                        chipClassName={adminStatusInfoPillVariantTableClassName}
                        menuPlacement="bottom"
                        onChange={(active) => update({ variants: updateWeightVariant(weightData.variants, variant.id, { active }) })}
                      />
                    </div>
                  </td>
                  <td className="px-1 py-1.5 text-center">
                    <div className="inline-flex justify-center">
                      <NoteTagChip
                        value={normalizeNoteTagValue(variant.noteTag)}
                        editable={editable}
                        chipClassName={adminStatusInfoPillVariantTableClassName}
                        menuPlacement="bottom"
                        onChange={(noteTag) => update({ variants: updateWeightVariant(weightData.variants, variant.id, { noteTag }) })}
                      />
                    </div>
                  </td>
                  <td className="px-2 py-1.5 text-center">
                    {editable ? (
                      <input
                        type="number"
                        inputMode="numeric"
                        className={`${compactTableThirtyInputClassName} !mt-0 !w-[4ch] !px-0 text-center`}
                        value={variant.position}
                        onChange={(event) => update({ variants: updateWeightVariant(weightData.variants, variant.id, { position: Math.max(1, Number(event.target.value) || 1) }) })}
                      />
                    ) : (
                      <ReadOnlyTableInput
                        className="!w-[4ch] !px-0 text-center"
                        value={variant.position}
                      />
                    )}
                  </td>
                </tr>
              ))
            ) : (
              <tr className={`${adminTableRowHeightClassName} border-t border-slate-100`}>
                <td colSpan={12} className="px-3 py-4 text-center text-[13px] font-medium text-slate-500">
                  Ni ustvarjenih različic.
                </td>
              </tr>
            )}
          </tbody>
        </table>
          <p className="border-t border-slate-200 px-3 py-2 text-[11px] leading-4 text-slate-500">Cena vključuje DDV.</p>
          {quantityDiscountsPanel}
        </div>
      </div>
    </SectionCard>
  );
}

const machinePanelClassName = 'overflow-hidden rounded-lg border border-slate-200 bg-white';
const machineHeaderClassName = 'flex min-h-11 items-center justify-between gap-3 bg-white px-4 py-3';
const machineTableClassName = 'min-w-full table-fixed text-[12px]';
const machineFlushBottomTableClassName = `${machineTableClassName} [&_tbody_tr:last-child_td]:border-b-0`;
const machineTableHeaderCellClassName = `${adminTableRowHeightClassName} border-y border-slate-200 bg-slate-50 px-3 py-2 text-left text-[11px] font-semibold text-slate-600`;
const machineTableCellClassName = `${adminTableRowHeightClassName} border-b border-slate-100 px-3 py-2 align-middle text-[12px] font-medium text-slate-700`;
const machineInputClassName = "h-[30px] min-w-0 rounded-md border border-slate-300 bg-white px-2 font-['Inter',system-ui,sans-serif] text-[12px] font-semibold leading-[30px] text-slate-900 outline-none transition focus:border-[#3e67d6] focus:ring-0";
const machineUnitAdornmentClassName = "inline-flex h-full w-auto min-w-0 shrink-0 items-center justify-center whitespace-nowrap border-l border-slate-200 px-2 font-['Inter',system-ui,sans-serif] text-[12px] font-medium leading-[30px] text-slate-500";
const machineUnitInputClassName = "h-full w-auto min-w-[2.5ch] max-w-[18ch] shrink-0 border-0 border-l border-slate-200 bg-white px-2 font-['Inter',system-ui,sans-serif] text-[12px] font-medium leading-[30px] text-left text-slate-500 outline-none focus:text-slate-900 focus:ring-0";
const machineSectionHeaderHeightPx = 44;
const machineTableRowHeightPx = 48;

function getMachineTableSectionHeight(rowCount: number) {
  return machineSectionHeaderHeightPx + machineTableRowHeightPx * (rowCount + 1);
}

function createMachineLocalId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

type MachineUnitSuffix = string | ((value: string | number) => string);

function getMachinePluralAnchor(value: string | number): number {
  const matches = String(value ?? '').match(/\d+(?:[,.]\d+)?/g);
  if (!matches?.length) return 0;
  const parsedValue = Number(matches[matches.length - 1].replace(',', '.'));
  return Number.isFinite(parsedValue) ? Math.floor(Math.abs(parsedValue)) : 0;
}

function getSlovenianPluralUnit(
  value: string | number,
  forms: { one: string; two: string; few: string; other: string }
): string {
  const anchor = getMachinePluralAnchor(value);
  if (anchor === 1) return forms.one;
  if (anchor === 2) return forms.two;
  if (anchor === 3 || anchor === 4) return forms.few;
  return forms.other;
}

function getMachinePieceUnit(value: string | number): string {
  return getSlovenianPieceUnit(getMachinePluralAnchor(value));
}

function getMachineMonthUnit(value: string | number): string {
  return getSlovenianPluralUnit(value, { one: 'mesec', two: 'meseca', few: 'meseci', other: 'mesecev' });
}

function getMachineWorkingDayUnit(value: string | number): string {
  return getSlovenianPluralUnit(value, { one: 'delovni dan', two: 'delovna dneva', few: 'delovni dnevi', other: 'delovnih dni' });
}

function stripMachineWorkingDayUnit(value: string): string {
  return value
    .replace(/\bdelovn(?:i|a|ih|e)?\s+d(?:an|neva|nevi|ni)\b/giu, '')
    .replace(/\bdni\b/giu, '')
    .replace(/\bdan\b/giu, '')
    .trim();
}

function formatMachineDeliveryTime(value: string | number): string {
  const amount = stripMachineWorkingDayUnit(String(value));
  if (!amount) return '';
  return `${amount} ${getMachineWorkingDayUnit(amount)}`;
}

function resolveMachineUnitSuffix(suffix: MachineUnitSuffix | undefined, value: string | number): string | undefined {
  return typeof suffix === 'function' ? suffix(value) : suffix;
}

function MachineDisabledField({ value, className }: { value: string | number; className?: string }) {
  return (
    <input
      className={classNames(machineInputClassName, 'w-full cursor-not-allowed bg-[color:var(--field-locked-bg)] text-left text-slate-500', className)}
      value={String(value)}
      disabled
      readOnly
    />
  );
}

function MachineSectionHeader({
  title,
  editable,
  onAdd,
  onRequestEdit,
  onClear,
  clearDisabled,
  className
}: {
  title: string;
  editable: boolean;
  onAdd?: () => void;
  onRequestEdit?: () => void;
  onClear?: () => void;
  clearDisabled?: boolean;
  className?: string;
}) {
  const addDisabled = !editable && !onRequestEdit;
  const handleAdd = () => {
    if (!editable) {
      onRequestEdit?.();
    }
    onAdd?.();
  };

  return (
    <div className={classNames(machineHeaderClassName, className)}>
      <h3 className="text-[14px] font-semibold text-slate-900">{title}</h3>
      {onAdd || onClear ? (
        <div className="flex items-center gap-2">
          {onAdd ? (
            <IconButton
              type="button"
              aria-label={`Dodaj v ${title}`}
              title="Dodaj"
              tone="neutral"
              size="md"
              disabled={addDisabled}
              onClick={handleAdd}
            >
              <PlusIcon />
            </IconButton>
          ) : null}
          {onClear ? (
            <IconButton
              type="button"
              aria-label={`Izbriši vnose v ${title}`}
              title="Izbriši vnose"
              tone="neutral"
              size="md"
              disabled={!editable || clearDisabled}
              onClick={onClear}
            >
              <TrashCanIcon />
            </IconButton>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function MachineTableValueField({
  value,
  suffix,
  unitValue,
  editable,
  numeric = false,
  onChange,
  onUnitChange
}: {
  value: string | number;
  suffix?: MachineUnitSuffix;
  unitValue?: string;
  editable: boolean;
  numeric?: boolean;
  onChange: (value: string | number) => void;
  onUnitChange?: (value: string) => void;
}) {
  const fallbackSuffix = resolveMachineUnitSuffix(suffix, value);
  const resolvedSuffix = unitValue?.trim() || fallbackSuffix;
  const displayValue =
    typeof value === 'number'
      ? formatDecimalForDisplay(value)
      : value.trim() || '—';
  const unitInputSize = Math.max(1, resolvedSuffix?.length ?? 1);

  if (!editable) {
    return (
      <span className="flex h-[30px] w-full overflow-hidden rounded-md border border-slate-300 bg-[color:var(--field-locked-bg)]">
        <input
          className="h-full min-w-0 flex-1 cursor-not-allowed border-0 bg-transparent px-2 font-['Inter',system-ui,sans-serif] text-[12px] font-semibold leading-[30px] text-left text-slate-500 outline-none"
          value={displayValue}
          disabled
          readOnly
        />
        {resolvedSuffix && displayValue !== '—' ? (
          <span className={classNames(machineUnitAdornmentClassName, 'bg-[color:var(--field-locked-bg)] text-slate-500')}>
            {resolvedSuffix}
          </span>
        ) : null}
      </span>
    );
  }

  return (
    <span className="flex h-[30px] w-full overflow-hidden rounded-md border border-slate-300 bg-white">
      {numeric ? (
        <DecimalDraftInput
          className="h-full min-w-0 flex-1 border-0 bg-transparent px-2 font-['Inter',system-ui,sans-serif] text-[12px] font-semibold leading-[30px] text-left text-slate-900 outline-none focus:ring-0"
          value={value}
          onDecimalChange={(nextValue) => onChange(nextValue)}
        />
      ) : (
        <input
          className="h-full min-w-0 flex-1 border-0 bg-transparent px-2 font-['Inter',system-ui,sans-serif] text-[12px] font-semibold leading-[30px] text-left text-slate-900 outline-none focus:ring-0"
          value={String(value)}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
      {onUnitChange ? (
        <input
          className={machineUnitInputClassName}
          size={unitInputSize}
          value={resolvedSuffix ?? ''}
          onChange={(event) => onUnitChange(event.target.value)}
        />
      ) : resolvedSuffix ? (
        <span className={machineUnitAdornmentClassName}>{resolvedSuffix}</span>
      ) : null}
    </span>
  );
}

function MachineEditableSpecRow({
  editable,
  row,
  selected,
  onChange,
  onSelectedChange,
  unitEditable = true
}: {
  editable: boolean;
  row: SpecRow;
  selected: boolean;
  onChange: (updates: Partial<SpecRow>) => void;
  onSelectedChange: () => void;
  unitEditable?: boolean;
}) {
  return (
    <tr className={adminTableRowHeightClassName}>
      <td className={`${machineTableCellClassName} text-center`}>
        <AdminCheckbox
          checked={selected}
          disabled={!editable}
          onChange={onSelectedChange}
        />
      </td>
      <td className={machineTableCellClassName}>
        {editable ? (
          <input
            className={classNames(machineInputClassName, 'w-full')}
            value={row.property}
            onChange={(event) => onChange({ property: event.target.value })}
          />
        ) : (
          <MachineDisabledField value={row.property || '—'} />
        )}
      </td>
      <td className={machineTableCellClassName}>
        <MachineTableValueField
          value={row.value}
          unitValue={unitEditable ? row.unit : undefined}
          editable={editable}
          onChange={(value) => onChange({ value: String(value) })}
          onUnitChange={unitEditable ? (unit) => onChange({ unit }) : undefined}
        />
      </td>
    </tr>
  );
}

function MachineInfoTable({
  title,
  editable,
  onRequestEdit,
  fixedRows,
  customRows,
  onAddCustomRow,
  onRemoveCustomRows,
  onUpdateCustomRow,
  customRowUnits = true,
  flushBottom = false,
  className
}: {
  title: string;
  editable: boolean;
  onRequestEdit?: () => void;
  fixedRows: Array<{
    key: string;
    label: string;
    value: string | number;
    suffix?: MachineUnitSuffix;
    unitValue?: string;
    numeric?: boolean;
    locked?: boolean;
    hideCheckbox?: boolean;
    onLabelChange?: (value: string) => void;
    onChange: (value: string | number) => void;
    onUnitChange?: (value: string) => void;
  }>;
  customRows: SpecRow[];
  onAddCustomRow?: () => void;
  onRemoveCustomRows?: (ids: readonly string[]) => void;
  onUpdateCustomRow?: (id: string, updates: Partial<SpecRow>) => void;
  customRowUnits?: boolean;
  flushBottom?: boolean;
  className?: string;
}) {
  const [selectedCustomRowIds, setSelectedCustomRowIds] = useState<Set<string>>(() => new Set());
  const selectedRemovableCustomIds = customRows.filter((row) => selectedCustomRowIds.has(row.id)).map((row) => row.id);
  const allCustomRowsSelected = customRows.length > 0 && customRows.every((row) => selectedCustomRowIds.has(row.id));
  const canSelectCustomRows = Boolean(onRemoveCustomRows);
  const isVisuallyEmpty = fixedRows.length === 0 && customRows.length === 0;

  const toggleCustomRow = (id: string) => {
    if (!canSelectCustomRows) return;
    setSelectedCustomRowIds((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleAllCustomRows = () => {
    if (!canSelectCustomRows) return;
    setSelectedCustomRowIds((current) => {
      if (customRows.length > 0 && customRows.every((row) => current.has(row.id))) {
        return new Set();
      }
      return new Set(customRows.map((row) => row.id));
    });
  };

  const removeSelectedCustomRows = () => {
    if (!editable || !onRemoveCustomRows || selectedRemovableCustomIds.length === 0) return;
    onRemoveCustomRows(selectedRemovableCustomIds);
    setSelectedCustomRowIds(new Set());
  };

  return (
    <div className={className}>
      <MachineSectionHeader
        title={title}
        editable={editable}
        onAdd={onAddCustomRow}
        onRequestEdit={onRequestEdit}
        onClear={onRemoveCustomRows ? removeSelectedCustomRows : undefined}
        clearDisabled={selectedRemovableCustomIds.length === 0}
      />
      <table
        className={classNames(
          flushBottom ? machineFlushBottomTableClassName : machineTableClassName,
          flushBottom && isVisuallyEmpty && '[&_thead_th]:border-b-0'
        )}
      >
        <colgroup>
          <col style={{ width: '44px' }} />
          <col />
          <col style={{ width: '33%' }} />
        </colgroup>
        <thead>
          <tr>
            <th className={`${machineTableHeaderCellClassName} text-center`}>
              {canSelectCustomRows ? (
                <AdminCheckbox
                  checked={editable && allCustomRowsSelected}
                  disabled={!editable || customRows.length === 0}
                  onChange={toggleAllCustomRows}
                />
              ) : null}
            </th>
            <th className={machineTableHeaderCellClassName}>Lastnost</th>
            <th className={machineTableHeaderCellClassName}>Vrednost</th>
          </tr>
        </thead>
        <tbody>
          {fixedRows.map((row) => (
            <tr key={row.key} className={adminTableRowHeightClassName}>
              <td className={`${machineTableCellClassName} text-center`}>
                {row.locked || row.hideCheckbox ? null : <AdminCheckbox checked={false} disabled onChange={() => undefined} />}
              </td>
              <td className={machineTableCellClassName}>
                {editable && !row.locked && row.onLabelChange ? (
                  <input
                    className={classNames(machineInputClassName, 'w-full')}
                    value={row.label}
                    onChange={(event) => row.onLabelChange?.(event.target.value)}
                  />
                ) : (
                  <MachineDisabledField value={row.label} />
                )}
              </td>
              <td className={machineTableCellClassName}>
                <MachineTableValueField
                  value={row.value}
                  suffix={row.suffix}
                  unitValue={row.unitValue}
                  numeric={row.numeric}
                  editable={editable && !row.locked}
                  onChange={row.onChange}
                  onUnitChange={editable && !row.locked ? row.onUnitChange : undefined}
                />
              </td>
            </tr>
          ))}
          {customRows.map((row) => (
            <MachineEditableSpecRow
              key={row.id}
              editable={editable && Boolean(onUpdateCustomRow)}
              row={row}
              selected={selectedCustomRowIds.has(row.id)}
              onChange={(updates) => onUpdateCustomRow?.(row.id, updates)}
              onSelectedChange={() => toggleCustomRow(row.id)}
              unitEditable={customRowUnits}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

const machineSerialStatusConfig: Record<MachineSerialStatus, { label: string; variant: BadgeVariant; tone: 'neutral' | 'success' | 'warning' | 'info' | 'purple' }> = {
  in_stock: { label: 'Na zalogi', variant: 'success', tone: 'success' },
  sold: { label: 'Prodano', variant: 'info', tone: 'info' },
  reserved: { label: 'Rezervirano', variant: 'warning', tone: 'warning' },
  service: { label: 'Na servisu', variant: 'purple', tone: 'purple' }
};

const machineSerialStatusOptions: ReadonlyArray<EditableChipMenuOption<MachineSerialStatus>> = ([
  'in_stock',
  'sold',
  'reserved',
  'service'
] as const).map((value) => ({
  value,
  label: machineSerialStatusConfig[value].label,
  className: getAdminStatusInfoMenuOptionClassName(machineSerialStatusConfig[value].tone)
}));

function normalizeOrderReference(value: string | number | null | undefined) {
  return String(value ?? '')
    .trim()
    .replace(/^#/, '')
    .toLocaleLowerCase('sl-SI');
}

function expandMachineOrderMatches(orderMatches: readonly OrderItemSkuAllocationRow[]) {
  return orderMatches.flatMap((match) => {
    const quantity = Math.max(1, Math.floor(match.quantity || 1));
    return Array.from({ length: quantity }, (_, index) => ({ ...match, allocationIndex: index }));
  });
}

function getMachineSerialOrderMatchesForRows(
  rows: readonly MachineSerialRow[],
  expandedMatches: ReturnType<typeof expandMachineOrderMatches>
) {
  const usedMatchIndexes = new Set<number>();
  return rows.map((row) => {
    const explicitReference = normalizeOrderReference(row.orderReference);
    if (explicitReference) {
      const matchedIndex = expandedMatches.findIndex((match, index) =>
        !usedMatchIndexes.has(index) && (
          normalizeOrderReference(match.orderNumber) === explicitReference ||
          normalizeOrderReference(match.orderId) === explicitReference ||
          normalizeOrderReference(`#${match.orderNumber}`) === explicitReference
        )
      );
      if (matchedIndex === -1) return null;
      usedMatchIndexes.add(matchedIndex);
      return expandedMatches[matchedIndex];
    }

    if (row.status === 'service') return null;
    const matchedIndex = expandedMatches.findIndex((_, index) => !usedMatchIndexes.has(index));
    if (matchedIndex === -1) return null;
    usedMatchIndexes.add(matchedIndex);
    return expandedMatches[matchedIndex];
  });
}

function isMachineOrderSoldStatus(status: string) {
  const normalized = status.trim().toLocaleLowerCase('sl-SI');
  if (normalized.includes('partial') || normalized.includes('delno')) return false;
  return normalized === 'sent' || normalized === 'finished' || normalized.includes('poslan') || normalized.includes('zaklju');
}

function getMachineSerialDisplayStatus(row: MachineSerialRow, match: OrderItemSkuAllocationRow | null): MachineSerialStatus {
  if (row.status === 'service') return 'service';
  if (match && isMachineOrderSoldStatus(match.orderStatus)) return 'sold';
  if (match) return 'reserved';
  return row.status;
}

function getMachineTrackedStock(
  rows: readonly MachineSerialRow[],
  expandedMatches: ReturnType<typeof expandMachineOrderMatches>
) {
  const orderMatches = getMachineSerialOrderMatchesForRows(rows, expandedMatches);
  return rows.reduce((stock, row, index) => {
    const orderMatch = orderMatches[index] ?? null;
    return getMachineSerialDisplayStatus(row, orderMatch) === 'in_stock' ? stock + 1 : stock;
  }, 0);
}

function formatDateInputValue(value: string | null | undefined) {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
}

function formatDateForDisplay(value: string | null | undefined) {
  const inputValue = formatDateInputValue(value);
  if (!inputValue) return '—';
  const [year, month, day] = inputValue.split('-');
  return `${day}. ${month}. ${year}`;
}

function MachineSerialStatusChip({
  value,
  editable,
  onChange
}: {
  value: MachineSerialStatus;
  editable: boolean;
  onChange: (next: MachineSerialStatus) => void;
}) {
  const config = machineSerialStatusConfig[value];
  return (
    <EditableChipMenu
      label={config.label}
      variant={config.variant}
      editable={editable}
      options={machineSerialStatusOptions}
      onChange={onChange}
      chipClassName={adminStatusInfoPillVariantTableClassName}
      minMenuWidth={150}
    />
  );
}

function WarningTriangleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m21.7 18-8.5-14.8a1.4 1.4 0 0 0-2.4 0L2.3 18a1.4 1.4 0 0 0 1.2 2.1h17a1.4 1.4 0 0 0 1.2-2.1Z" />
      <path d="M12 8v5" />
      <path d="M12 17h.01" />
    </svg>
  );
}

export function UniqueMachineProductModule({
  editable,
  data,
  orderMatches = [],
  onRequestEdit,
  onChange
}: UniqueMachineProductModuleProps) {
  const machineData = normalizeUniqueMachineProductData(data);
  const [selectedSerialRowIds, setSelectedSerialRowIds] = useState<Set<string>>(() => new Set());
  const [selectedIncludedItemIndexes, setSelectedIncludedItemIndexes] = useState<Set<number>>(() => new Set());
  const expandedOrderMatches = expandMachineOrderMatches(orderMatches);
  const trackedStock = machineData.serialNumbers.length > 0 || expandedOrderMatches.length > 0
    ? getMachineTrackedStock(machineData.serialNumbers, expandedOrderMatches)
    : machineData.stock;
  const update = (updates: Partial<UniqueMachineProductData>) => {
    const nextSerialNumbers = updates.serialNumbers ?? machineData.serialNumbers;
    const shouldDeriveStock = Object.prototype.hasOwnProperty.call(updates, 'serialNumbers') || nextSerialNumbers.length > 0 || expandedOrderMatches.length > 0;
    onChange(toTypeSpecificData({
      ...machineData,
      ...updates,
      stock: shouldDeriveStock ? getMachineTrackedStock(nextSerialNumbers, expandedOrderMatches) : updates.stock ?? machineData.stock
    }));
  };
  const displayedSerialRows: MachineSerialRow[] = machineData.serialNumbers.length > 0
    ? machineData.serialNumbers
    : expandedOrderMatches.map((match, index) => ({
        id: `order-allocation-${match.orderItemId}-${match.allocationIndex}-${index}`,
        serialNumber: '',
        status: isMachineOrderSoldStatus(match.orderStatus) ? 'sold' : 'reserved',
        orderReference: match.orderNumber,
        shippedAt: match.shippedAt ?? ''
      }));
  const displayedSerialOrderMatches = getMachineSerialOrderMatchesForRows(displayedSerialRows, expandedOrderMatches);
  const persistedSerialRowIds = new Set(machineData.serialNumbers.map((row) => row.id));
  const selectedPersistedSerialIds = machineData.serialNumbers.filter((row) => selectedSerialRowIds.has(row.id)).map((row) => row.id);
  const allPersistedSerialRowsSelected = machineData.serialNumbers.length > 0 && machineData.serialNumbers.every((row) => selectedSerialRowIds.has(row.id));
  const selectedIncludedIndexesToRemove = Array.from(selectedIncludedItemIndexes).filter((index) => index >= 0 && index < machineData.includedItems.length);
  const allIncludedItemsSelected = machineData.includedItems.length > 0 && machineData.includedItems.every((_, index) => selectedIncludedItemIndexes.has(index));

  const updateSpecRows = (key: 'basicInfoRows' | 'specs', rows: SpecRow[]) => update({ [key]: rows } as Partial<UniqueMachineProductData>);
  const updateSpecRow = (key: 'basicInfoRows' | 'specs', id: string, updates: Partial<SpecRow>) => {
    updateSpecRows(key, machineData[key].map((row) => (row.id === id ? { ...row, ...updates } : row)));
  };
  const addSpecRow = (key: 'basicInfoRows' | 'specs') => {
    updateSpecRows(key, [...machineData[key], { id: createMachineLocalId(key === 'basicInfoRows' ? 'machine-basic' : 'machine-spec'), property: '', value: '' }]);
  };
  const removeSpecRows = (key: 'basicInfoRows' | 'specs', ids: readonly string[]) => {
    const removeIds = new Set(ids);
    updateSpecRows(key, machineData[key].filter((row) => !removeIds.has(row.id)));
  };

  const upsertSerialRow = (row: MachineSerialRow, updates: Partial<MachineSerialRow>) => {
    const exists = machineData.serialNumbers.some((entry) => entry.id === row.id);
    const nextRow = {
      ...row,
      id: exists ? row.id : createMachineLocalId('machine-serial'),
      ...updates
    };
    update({
      serialNumbers: exists
        ? machineData.serialNumbers.map((entry) => (entry.id === row.id ? nextRow : entry))
        : [...machineData.serialNumbers, nextRow]
    });
  };
  const addSerialRow = () => {
    update({
      serialNumbers: [
        ...machineData.serialNumbers,
        { id: createMachineLocalId('machine-serial'), serialNumber: '', status: 'in_stock', orderReference: '', shippedAt: '' }
      ]
    });
  };
  const toggleSerialRow = (id: string) => {
    if (!persistedSerialRowIds.has(id)) return;
    setSelectedSerialRowIds((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };
  const toggleAllSerialRows = () => {
    setSelectedSerialRowIds((current) => {
      if (machineData.serialNumbers.length > 0 && machineData.serialNumbers.every((row) => current.has(row.id))) {
        return new Set();
      }
      return new Set(machineData.serialNumbers.map((row) => row.id));
    });
  };
  const removeSelectedSerialRows = () => {
    if (!editable || selectedPersistedSerialIds.length === 0) return;
    const removeIds = new Set(selectedPersistedSerialIds);
    update({ serialNumbers: machineData.serialNumbers.filter((row) => !removeIds.has(row.id)) });
    setSelectedSerialRowIds(new Set());
  };
  const addIncludedItem = () => update({ includedItems: [...machineData.includedItems, ''] });
  const updateIncludedItem = (index: number, value: string) => {
    update({ includedItems: machineData.includedItems.map((entry, entryIndex) => (entryIndex === index ? value : entry)) });
  };
  const toggleIncludedItem = (index: number) => {
    setSelectedIncludedItemIndexes((current) => {
      const next = new Set(current);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };
  const toggleAllIncludedItems = () => {
    setSelectedIncludedItemIndexes((current) => {
      if (machineData.includedItems.length > 0 && machineData.includedItems.every((_, index) => current.has(index))) {
        return new Set();
      }
      return new Set(machineData.includedItems.map((_, index) => index));
    });
  };
  const removeSelectedIncludedItems = () => {
    if (!editable || selectedIncludedIndexesToRemove.length === 0) return;
    const removeIndexes = new Set(selectedIncludedIndexesToRemove);
    update({ includedItems: machineData.includedItems.filter((_, entryIndex) => !removeIndexes.has(entryIndex)) });
    setSelectedIncludedItemIndexes(new Set());
  };
  const basicInfoSectionHeight = getMachineTableSectionHeight(6 + machineData.basicInfoRows.length);
  const technicalSpecsSectionHeight = getMachineTableSectionHeight(1 + machineData.specs.length);

  return (
    <SectionCard title="Prodajne informacije">
      <div className="grid gap-5 px-5 py-5 xl:grid-cols-2 xl:items-start">
        <div className="space-y-5">
          <div className={machinePanelClassName}>
          <MachineInfoTable
            title="Osnovne informacije"
            editable={editable}
            onRequestEdit={onRequestEdit}
            fixedRows={[
              { key: 'basePrice', label: 'Osnovna cena', value: machineData.basePrice, suffix: '€', numeric: true, hideCheckbox: true, onChange: (basePrice) => update({ basePrice: Number(basePrice) || 0 }) },
              { key: 'discountPercent', label: 'Popust', value: machineData.discountPercent, suffix: '%', numeric: true, hideCheckbox: true, onChange: (discountPercent) => update({ discountPercent: Number(discountPercent) || 0 }) },
              { key: 'stock', label: 'Zaloga', value: trackedStock, suffix: getMachinePieceUnit, numeric: true, locked: true, hideCheckbox: true, onChange: (stock) => update({ stock: Math.max(0, Math.floor(Number(stock) || 0)) }) },
              { key: 'deliveryTime', label: 'Dobavni rok', value: stripMachineWorkingDayUnit(machineData.deliveryTime), suffix: getMachineWorkingDayUnit, hideCheckbox: true, onChange: (deliveryTime) => update({ deliveryTime: formatMachineDeliveryTime(deliveryTime) }) },
              {
                key: 'warrantyMonths',
                label: machineData.warrantyLabel,
                value: machineData.warrantyMonths,
                suffix: getMachineMonthUnit,
                unitValue: machineData.warrantyUnit,
                onLabelChange: (warrantyLabel) => update({ warrantyLabel }),
                onChange: (warrantyMonths) => update({ warrantyMonths: String(warrantyMonths) }),
                onUnitChange: (warrantyUnit) => update({ warrantyUnit })
              },
              {
                key: 'serviceIntervalMonths',
                label: machineData.serviceIntervalLabel,
                value: machineData.serviceIntervalMonths,
                suffix: getMachineMonthUnit,
                unitValue: machineData.serviceIntervalUnit,
                onLabelChange: (serviceIntervalLabel) => update({ serviceIntervalLabel }),
                onChange: (serviceIntervalMonths) => update({ serviceIntervalMonths: String(serviceIntervalMonths) }),
                onUnitChange: (serviceIntervalUnit) => update({ serviceIntervalUnit })
              }
            ]}
            customRows={machineData.basicInfoRows}
            onAddCustomRow={() => addSpecRow('basicInfoRows')}
            onRemoveCustomRows={(ids) => removeSpecRows('basicInfoRows', ids)}
            onUpdateCustomRow={(id, updates) => updateSpecRow('basicInfoRows', id, updates)}
          />
          <MachineInfoTable
            title="Tehnične specifikacije"
            editable={editable}
            onRequestEdit={onRequestEdit}
            fixedRows={[
              { key: 'packageDimensions', label: 'Dimenzije paketa', value: machineData.packageDimensions, onChange: (packageDimensions) => update({ packageDimensions: String(packageDimensions) }) }
            ]}
            customRows={machineData.specs}
            onAddCustomRow={() => addSpecRow('specs')}
            onRemoveCustomRows={(ids) => removeSpecRows('specs', ids)}
            onUpdateCustomRow={(id, updates) => updateSpecRow('specs', id, updates)}
            flushBottom
          />
          </div>

        </div>

        <div className="space-y-5">
          <div className={classNames(machinePanelClassName, 'flex flex-col')} style={{ height: basicInfoSectionHeight }}>
          <MachineSectionHeader
            title="Sledenje artiklom"
            editable={editable}
            onAdd={addSerialRow}
            onRequestEdit={onRequestEdit}
            onClear={removeSelectedSerialRows}
            clearDisabled={selectedPersistedSerialIds.length === 0}
          />
          <div className="min-h-0 flex-1 overflow-y-auto">
          <table className={machineFlushBottomTableClassName}>
            <colgroup>
              <col style={{ width: '44px' }} />
              <col style={{ width: '28%' }} />
              <col style={{ width: '22%' }} />
              <col style={{ width: '21%' }} />
              <col />
            </colgroup>
            <thead>
              <tr>
                <th className={`${machineTableHeaderCellClassName} text-center`}>
                  <AdminCheckbox
                    checked={editable && allPersistedSerialRowsSelected}
                    disabled={!editable || machineData.serialNumbers.length === 0}
                    onChange={toggleAllSerialRows}
                  />
                </th>
                <th className={machineTableHeaderCellClassName}>Serijska številka</th>
                <th className={machineTableHeaderCellClassName}>Status</th>
                <th className={machineTableHeaderCellClassName}>Naročilo</th>
                <th className={machineTableHeaderCellClassName}>Datum odpreme</th>
              </tr>
            </thead>
            <tbody>
              {displayedSerialRows.length > 0 ? displayedSerialRows.map((row, index) => {
                const orderMatch = displayedSerialOrderMatches[index] ?? null;
                const displayStatus = getMachineSerialDisplayStatus(row, orderMatch);
                const shippedAt = displayStatus === 'sold' ? orderMatch?.shippedAt ?? row.shippedAt : row.shippedAt;
                const isPersistedRow = machineData.serialNumbers.some((entry) => entry.id === row.id);

                return (
                  <tr key={row.id} className={adminTableRowHeightClassName}>
                    <td className={`${machineTableCellClassName} text-center`}>
                      <AdminCheckbox
                        checked={selectedSerialRowIds.has(row.id)}
                        disabled={!editable || !isPersistedRow}
                        onChange={() => toggleSerialRow(row.id)}
                      />
                    </td>
                    <td className={machineTableCellClassName}>
                      {editable ? (
                        <input
                          className={classNames(machineInputClassName, 'w-full')}
                          value={row.serialNumber}
                          placeholder="SN-0001"
                          onChange={(event) => upsertSerialRow(row, { serialNumber: event.target.value })}
                        />
                      ) : (
                        <ReadOnlyTableInput className="!w-full text-left" value={row.serialNumber || '—'} />
                      )}
                    </td>
                    <td className={machineTableCellClassName}>
                      <MachineSerialStatusChip
                        value={displayStatus}
                        editable={editable && !orderMatch}
                        onChange={(status) => upsertSerialRow(row, { status })}
                      />
                    </td>
                    <td className={machineTableCellClassName}>
                      {editable && !orderMatch ? (
                        <input
                          className={classNames(machineInputClassName, 'w-full')}
                          value={row.orderReference}
                          placeholder="#1001"
                          onChange={(event) => upsertSerialRow(row, { orderReference: event.target.value })}
                        />
                      ) : (
                        <ReadOnlyTableInput className="!w-full text-left" value={orderMatch?.orderNumber || row.orderReference || '—'} />
                      )}
                    </td>
                    <td className={machineTableCellClassName}>
                      {editable && displayStatus === 'sold' && !orderMatch ? (
                        <input
                          type="date"
                          className={classNames(machineInputClassName, 'w-full')}
                          value={formatDateInputValue(row.shippedAt)}
                          onChange={(event) => upsertSerialRow(row, { shippedAt: event.target.value })}
                        />
                      ) : (
                        <ReadOnlyTableInput className="!w-full text-left" value={displayStatus === 'sold' ? formatDateForDisplay(shippedAt) : '—'} />
                      )}
                    </td>
                  </tr>
                );
              }) : (
                <tr className={adminTableRowHeightClassName}>
                  <td colSpan={5} className="border-b border-slate-100 px-3 py-5 text-center text-[12px] font-medium text-slate-500">
                    Ni vnesenih serijskih številk.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          </div>
          </div>

          <div className="grid gap-5 lg:grid-cols-2" style={{ height: technicalSpecsSectionHeight }}>
            <div className={classNames(machinePanelClassName, 'flex h-full flex-col')}>
              <MachineSectionHeader
                title="Komplet vsebuje"
                editable={editable}
                onAdd={addIncludedItem}
                onRequestEdit={onRequestEdit}
                onClear={removeSelectedIncludedItems}
                clearDisabled={selectedIncludedIndexesToRemove.length === 0}
              />
              <div className="min-h-0 flex-1 overflow-y-auto">
              <table className={machineFlushBottomTableClassName}>
                <colgroup>
                  <col style={{ width: '44px' }} />
                  <col />
                </colgroup>
                <thead>
                  <tr>
                    <th className={`${machineTableHeaderCellClassName} text-center`}>
                      <AdminCheckbox
                        checked={editable && allIncludedItemsSelected}
                        disabled={!editable || machineData.includedItems.length === 0}
                        onChange={toggleAllIncludedItems}
                      />
                    </th>
                    <th className={machineTableHeaderCellClassName}>Postavka</th>
                  </tr>
                </thead>
                <tbody>
                  {machineData.includedItems.length > 0 ? machineData.includedItems.map((item, index) => (
                    <tr key={`${index}-${item}`} className={adminTableRowHeightClassName}>
                      <td className={`${machineTableCellClassName} text-center`}>
                        <AdminCheckbox
                          checked={selectedIncludedItemIndexes.has(index)}
                          disabled={!editable}
                          onChange={() => toggleIncludedItem(index)}
                        />
                      </td>
                      <td className={machineTableCellClassName}>
                        {editable ? (
                          <input
                            className={classNames(machineInputClassName, 'w-full')}
                            value={item}
                            onChange={(event) => updateIncludedItem(index, event.target.value)}
                          />
                        ) : (
                          <ReadOnlyTableInput className="!w-full text-left" value={item || '—'} />
                        )}
                      </td>
                    </tr>
                  )) : (
                    <tr className={adminTableRowHeightClassName}>
                      <td colSpan={2} className="border-b border-slate-100 px-3 py-5 text-center text-[12px] font-medium text-slate-500">
                        Ni vnesenih postavk kompleta.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
              </div>
            </div>

            <div className="flex h-full flex-col overflow-hidden rounded-lg border border-orange-200 bg-orange-50/20">
              <div className="flex min-h-11 items-center gap-2 border-b border-orange-200 px-4 py-3 text-orange-700">
                <WarningTriangleIcon className="h-5 w-5 shrink-0" />
                <h3 className="text-[14px] font-semibold">Posebna opozorila</h3>
              </div>
              <div className="min-h-0 flex-1 p-4">
                <textarea
                  className="h-full min-h-32 w-full resize-none rounded-md border border-slate-300 bg-white px-3 py-2 text-[13px] text-slate-900 outline-none transition focus:border-[#3e67d6] focus:ring-0 disabled:cursor-not-allowed disabled:bg-[color:var(--field-locked-bg)] disabled:text-slate-500"
                  value={machineData.warnings}
                  disabled={!editable}
                  onChange={(event) => update({ warnings: event.target.value })}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </SectionCard>
  );
}
