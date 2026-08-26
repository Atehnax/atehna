'use client';

import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  RotateCcw
} from 'lucide-react';
import {
  getOrderDocumentTextAlignmentOverride,
  resetOrderDocumentTableBorders,
  resetOrderDocumentTextAlignment,
  resolveOrderDocumentTable,
  resolveOrderDocumentTableBorders,
  resolveOrderDocumentTextAlignment,
  setOrderDocumentTableBorders,
  setOrderDocumentTextAlignment,
  type OrderDocumentResolvedTextAlignment,
  type OrderDocumentTemplate,
  type OrderDocumentTextAlignment,
  type OrderDocumentTypographyTarget
} from '@/shared/domain/order/orderDocumentTemplates';
import { CompactHexColorField } from '@/shared/ui/admin-controls/CompactHexColorField';
import AdminCheckbox from '@/shared/ui/checkbox/admin-checkbox';

export const ORDER_DOCUMENT_TABLE_QUICK_STYLE_SCOPES = [
  'header',
  'body',
  'column',
  'row',
  'cell'
] as const;

export type OrderDocumentTableQuickStyleScope =
  (typeof ORDER_DOCUMENT_TABLE_QUICK_STYLE_SCOPES)[number];

const SCOPE_LABELS: Record<OrderDocumentTableQuickStyleScope, string> = {
  header: 'Glava',
  body: 'Vrstice',
  column: 'Stolpec',
  row: 'Vrstica',
  cell: 'Celica'
};

const ALIGNMENT_OPTIONS = [
  ['left', 'Levo'],
  ['center', 'Na sredino'],
  ['right', 'Desno'],
  ['justify', 'Obojestransko']
] as const satisfies readonly (readonly [OrderDocumentTextAlignment, string])[];

const RESOLVED_ALIGNMENT_LABELS: Record<
  OrderDocumentResolvedTextAlignment,
  string
> = {
  left: 'levo',
  center: 'na sredino',
  right: 'desno',
  justify: 'obojestransko',
  distributed: 'smiselno razporejeno'
};

const inactiveControlClassName =
  'border-white/15 bg-white/5 text-white/65 hover:bg-white/10 hover:text-white';
const activeControlClassName =
  'border-blue-300/55 bg-blue-400/20 text-blue-100';

function moveRadioFocus(
  event: React.KeyboardEvent<HTMLDivElement>
) {
  if (![
    'ArrowLeft',
    'ArrowRight',
    'ArrowUp',
    'ArrowDown',
    'Home',
    'End'
  ].includes(event.key)) return;
  const radios = Array.from(
    event.currentTarget.querySelectorAll<HTMLButtonElement>(
      '[role="radio"]:not(:disabled)'
    )
  );
  const currentIndex = radios.indexOf(event.target as HTMLButtonElement);
  if (currentIndex < 0 || radios.length === 0) return;
  event.preventDefault();
  const nextIndex = event.key === 'Home'
    ? 0
    : event.key === 'End'
      ? radios.length - 1
      : (
          currentIndex
          + (event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 1)
          + radios.length
        ) % radios.length;
  radios[nextIndex]?.focus();
  radios[nextIndex]?.click();
}

function AlignmentIcon({ alignment }: { alignment: OrderDocumentTextAlignment }) {
  const className = 'h-3.5 w-3.5';
  if (alignment === 'left') return <AlignLeft className={className} aria-hidden="true" />;
  if (alignment === 'center') return <AlignCenter className={className} aria-hidden="true" />;
  if (alignment === 'right') return <AlignRight className={className} aria-hidden="true" />;
  return <AlignJustify className={className} aria-hidden="true" />;
}

export type OrderDocumentTableQuickStyleControlsProps = {
  template: OrderDocumentTemplate;
  target: OrderDocumentTypographyTarget;
  activeScope: OrderDocumentTableQuickStyleScope;
  availableScopes: Readonly<Record<OrderDocumentTableQuickStyleScope, boolean>>;
  scopeDetails?: Partial<Record<OrderDocumentTableQuickStyleScope, string>>;
  onSelectScope: (
    scope: OrderDocumentTableQuickStyleScope,
    gesture: { additive: boolean }
  ) => void;
  onChange: (template: OrderDocumentTemplate) => void;
};

export default function OrderDocumentTableQuickStyleControls({
  template,
  target,
  activeScope,
  availableScopes,
  scopeDetails = {},
  onSelectScope,
  onChange
}: OrderDocumentTableQuickStyleControlsProps) {
  const table = resolveOrderDocumentTable(template);
  const borders = resolveOrderDocumentTableBorders(template, table);
  const alignmentOverride = getOrderDocumentTextAlignmentOverride(template, target);
  const resolvedAlignment = resolveOrderDocumentTextAlignment(template, target);

  return (
    <section
      className="space-y-2 rounded-lg border border-white/10 bg-white/[.035] p-2"
      data-order-document-table-quick-style
      data-order-document-table-active-scope={activeScope}
      data-order-document-table-typography-target={target.kind}
      data-settings-scroll="none"
    >
      <fieldset className="space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <legend className="text-[9px] font-bold uppercase tracking-[0.1em] text-white/55">
            Obseg tabele
          </legend>
          <span className="truncate text-[8px] font-semibold text-blue-100/70">
            {SCOPE_LABELS[activeScope]}
            {scopeDetails[activeScope] ? ` · ${scopeDetails[activeScope]}` : ''}
          </span>
        </div>
        <div
          role="radiogroup"
          aria-label="Obseg urejanja tabele"
          className="grid grid-cols-5 gap-1"
          onKeyDown={moveRadioFocus}
        >
          {ORDER_DOCUMENT_TABLE_QUICK_STYLE_SCOPES.map((scope) => {
            const active = scope === activeScope;
            const available = availableScopes[scope];
            const detail = scopeDetails[scope];
            return (
              <button
                key={scope}
                type="button"
                role="radio"
                aria-checked={active}
                aria-label={`${SCOPE_LABELS[scope]}${detail ? `: ${detail}` : ''}`}
                disabled={!available}
                tabIndex={active || (!availableScopes[activeScope] && available) ? 0 : -1}
                data-order-document-table-quick-scope={scope}
                onClick={(event) => onSelectScope(scope, {
                  additive: event.ctrlKey || event.metaKey
                })}
                className={`h-7 min-w-0 truncate rounded-md border px-1 text-[8px] font-semibold transition ${
                  active ? activeControlClassName : inactiveControlClassName
                } disabled:cursor-not-allowed disabled:opacity-25`}
                title={available
                  ? `${SCOPE_LABELS[scope]}${detail ? ` · ${detail}` : ''}`
                  : `${SCOPE_LABELS[scope]}: najprej izberite ustrezno celico na dokumentu`}
              >
                {SCOPE_LABELS[scope]}
              </button>
            );
          })}
        </div>
        <p className="text-[8px] leading-3 text-white/40">
          Navaden klik zamenja obseg; Ctrl/Cmd + klik ga doda skupnemu izboru.
        </p>
      </fieldset>

      <fieldset className="space-y-1.5" data-order-document-table-quick-alignment>
        <div className="flex items-center justify-between gap-2">
          <legend className="text-[9px] font-bold uppercase tracking-[0.1em] text-white/55">
            Poravnava
          </legend>
          <span className="truncate text-[8px] font-semibold text-white/40">
            {alignmentOverride
              ? 'Prilagojeno'
              : `Samodejno · ${RESOLVED_ALIGNMENT_LABELS[resolvedAlignment]}`}
          </span>
        </div>
        <div
          role="radiogroup"
          aria-label={`Poravnava za obseg ${SCOPE_LABELS[activeScope].toLocaleLowerCase('sl')}`}
          className="grid grid-cols-[minmax(0,1fr)_repeat(4,2rem)] gap-1"
          onKeyDown={moveRadioFocus}
        >
          <button
            type="button"
            role="radio"
            aria-checked={alignmentOverride === undefined}
            tabIndex={alignmentOverride === undefined ? 0 : -1}
            data-order-document-table-alignment="automatic"
            onClick={() => onChange(resetOrderDocumentTextAlignment(template, target))}
            className={`h-7 min-w-0 rounded-md border px-2 text-[8px] font-semibold transition ${
              alignmentOverride === undefined
                ? activeControlClassName
                : inactiveControlClassName
            }`}
            title="Podeduj smiselno poravnavo tabele"
          >
            Samodejno
          </button>
          {ALIGNMENT_OPTIONS.map(([alignment, label]) => {
            const active = alignmentOverride === alignment;
            return (
              <button
                key={alignment}
                type="button"
                role="radio"
                aria-checked={active}
                aria-label={label}
                title={label}
                tabIndex={active ? 0 : -1}
                data-order-document-table-alignment={alignment}
                onClick={() => onChange(
                  setOrderDocumentTextAlignment(template, target, alignment)
                )}
                className={`grid h-7 w-8 place-items-center rounded-md border transition ${
                  active ? activeControlClassName : inactiveControlClassName
                }`}
              >
                <AlignmentIcon alignment={alignment} />
              </button>
            );
          })}
        </div>
      </fieldset>

      <fieldset
        className="space-y-1.5 border-t border-white/10 pt-2"
        data-order-document-table-quick-borders
      >
        <div className="flex items-center justify-between gap-2">
          <legend className="text-[9px] font-bold uppercase tracking-[0.1em] text-white/55">
            Obrobe
          </legend>
          <button
            type="button"
            disabled={!table.borders}
            onClick={() => onChange(resetOrderDocumentTableBorders(template))}
            className="grid h-6 w-6 place-items-center rounded-md border border-white/15 bg-white/5 text-white/60 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-25"
            aria-label="Ponastavi obrobe tabele"
            title="Ponastavi obrobe"
            data-order-document-table-border-reset
          >
            <RotateCcw className="h-3 w-3" aria-hidden="true" />
          </button>
        </div>
        <div className="grid grid-cols-3 gap-1">
          {([
            ['outer', 'Zunanja'],
            ['horizontal', 'Vodoravne'],
            ['vertical', 'Navpične']
          ] as const).map(([key, label]) => (
            <label
              key={key}
              className={`flex h-7 min-w-0 cursor-pointer items-center justify-center gap-1 rounded-md border px-1 text-[8px] font-semibold transition ${
                borders[key] ? activeControlClassName : inactiveControlClassName
              }`}
            >
              <AdminCheckbox
                checked={borders[key]}
                onChange={(event) => onChange(setOrderDocumentTableBorders(
                  template,
                  { [key]: event.target.checked }
                ))}
                data-testid={`order-document-table-quick-border-${key}`}
              />
              <span className="truncate">{label}</span>
            </label>
          ))}
        </div>
        <div className="grid grid-cols-[minmax(0,1fr)_5rem] gap-1.5">
          <CompactHexColorField
            id="order-document-table-quick-border-color"
            label="Barva"
            value={borders.color}
            inheritedColor={template.style.lineColor}
            marker="order-document.table.quickBorders.color"
            tone="dark"
            layout="compact"
            onChange={(color) => onChange(setOrderDocumentTableBorders(
              template,
              { color }
            ))}
          />
          <label
            htmlFor="order-document-table-quick-border-width"
            className="block min-w-0 text-[9px] font-semibold text-white/55"
          >
            Debelina
            <span className="relative mt-1 block">
              <input
                id="order-document-table-quick-border-width"
                type="number"
                min={0.25}
                max={12}
                step={0.25}
                value={borders.widthPt}
                onChange={(event) => {
                  const numeric = event.currentTarget.valueAsNumber;
                  if (!Number.isFinite(numeric)) return;
                  const widthPt = Math.min(12, Math.max(0.25, Math.round(numeric * 4) / 4));
                  onChange(setOrderDocumentTableBorders(template, { widthPt }));
                }}
                className="h-7 w-full rounded-md border border-white/15 bg-slate-800 px-2 pr-6 text-right text-[10px] tabular-nums text-white outline-none transition hover:border-white/25 focus:border-blue-300 focus:ring-1 focus:ring-blue-300/35"
                data-testid="order-document-table-quick-border-width"
              />
              <span className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-[8px] text-white/40">
                pt
              </span>
            </span>
          </label>
        </div>
      </fieldset>
    </section>
  );
}
