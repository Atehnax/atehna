'use client';

import {
  resetOrderDocumentTableBorders,
  resolveOrderDocumentTable,
  resolveOrderDocumentTableBorders,
  setOrderDocumentTable,
  setOrderDocumentTableBorders,
  type OrderDocumentTable,
  type OrderDocumentTableColumnId,
  type OrderDocumentTemplate,
  type OrderDocumentTemplateLabels
} from '@/shared/domain/order/orderDocumentTemplates';
import { CompactHexColorField } from '@/shared/ui/admin-controls/CompactHexColorField';
import AdminCheckbox from '@/shared/ui/checkbox/admin-checkbox';

const COLUMN_LABEL_KEYS: Record<
  OrderDocumentTableColumnId,
  keyof OrderDocumentTemplateLabels
> = {
  sku: 'code',
  quantity: 'quantity',
  unit: 'unit',
  description: 'description',
  unitPrice: 'unitPrice',
  lineTotal: 'lineTotal'
};

const fieldClassName =
  "h-7 w-full rounded-md border border-white/15 bg-slate-800 px-2 text-[10px] text-white outline-none transition hover:border-white/25 focus:border-blue-300 focus:ring-1 focus:ring-blue-300/35 font-['Inter',system-ui,sans-serif]";

const compactButtonClassName =
  'inline-flex h-7 items-center justify-center rounded-md border border-white/15 bg-white/5 px-2 text-[9px] font-semibold text-white/75 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-35';

const removeOrderDocumentTableRowHeight = (
  override: OrderDocumentTable['rowHeightOverrides'][number]
) => {
  const remaining = { ...override };
  delete remaining.heightPt;
  return remaining.typography || remaining.textAlign ? remaining : null;
};

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(maximum, Math.max(minimum, value));
const roundHalf = (value: number) => Math.round(value * 2) / 2;
const roundTenth = (value: number) => Math.round(value * 10) / 10;

function NumberControl({
  id,
  label,
  value,
  minimum,
  maximum,
  step,
  suffix,
  onChange,
  testId
}: {
  id: string;
  label: string;
  value: number;
  minimum: number;
  maximum: number;
  step: number;
  suffix: string;
  onChange: (value: number) => void;
  testId: string;
}) {
  return (
    <label htmlFor={id} className="block min-w-0 text-[9px] font-semibold text-white/55">
      {label}
      <span className="relative mt-1 block">
        <input
          id={id}
          type="number"
          min={minimum}
          max={maximum}
          step={step}
          value={value}
          onChange={(event) => {
            const next = Number(event.target.value);
            if (Number.isFinite(next)) onChange(clamp(next, minimum, maximum));
          }}
          className={fieldClassName + ' pr-8'}
          data-testid={testId}
        />
        <span className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-[8px] text-white/40">
          {suffix}
        </span>
      </span>
    </label>
  );
}

function Section({
  title,
  children
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-white/10 bg-white/[.035] p-2">
      <h4 className="mb-1.5 text-[9px] font-bold uppercase tracking-[0.1em] text-white/55">
        {title}
      </h4>
      <div className="space-y-1.5">{children}</div>
    </section>
  );
}

export type OrderDocumentTableContextControlsProps = {
  template: OrderDocumentTemplate;
  selectedColumnId?: OrderDocumentTableColumnId | null;
  /** One-based source-row number. Rows themselves are never deleted or reordered. */
  selectedRowNumber?: number | null;
  onChange: (template: OrderDocumentTemplate) => void;
};

export default function OrderDocumentTableContextControls({
  template,
  selectedColumnId = null,
  selectedRowNumber = null,
  onChange
}: OrderDocumentTableContextControlsProps) {
  const table = resolveOrderDocumentTable(template);
  const borders = resolveOrderDocumentTableBorders(template, table);
  const selectedColumnIndex = selectedColumnId
    ? table.columns.findIndex((column) => column.id === selectedColumnId)
    : -1;
  const selectedColumn = selectedColumnIndex >= 0
    ? table.columns[selectedColumnIndex]
    : null;
  const selectedRow = selectedRowNumber && selectedRowNumber > 0
    ? Math.floor(selectedRowNumber)
    : null;
  const selectedRowOverride = selectedRow
    ? table.rowHeightOverrides.find((override) => override.rowNumber === selectedRow)
    : null;

  const commitTable = (next: OrderDocumentTable) =>
    onChange(setOrderDocumentTable(template, next));

  const updateSelectedColumn = (
    updates: Partial<OrderDocumentTable['columns'][number]>
  ) => {
    if (!selectedColumn) return;
    commitTable({
      ...table,
      columns: table.columns.map((column) =>
        column.id === selectedColumn.id ? { ...column, ...updates } : column
      )
    });
  };

  const moveSelectedColumn = (direction: -1 | 1) => {
    if (!selectedColumn) return;
    const target = selectedColumnIndex + direction;
    if (target < 0 || target >= table.columns.length) return;
    const columns = [...table.columns];
    [columns[selectedColumnIndex], columns[target]] = [
      columns[target],
      columns[selectedColumnIndex]
    ];
    commitTable({ ...table, columns });
  };

  const setSelectedRowHeight = (heightPt: number) => {
    if (!selectedRow) return;
    const existing = table.rowHeightOverrides.find(
      (override) => override.rowNumber === selectedRow
    );
    const rowHeightOverrides = table.rowHeightOverrides
      .filter((override) => override.rowNumber !== selectedRow)
      .concat({ ...existing, rowNumber: selectedRow, heightPt: roundHalf(heightPt) })
      .sort((left, right) => left.rowNumber - right.rowNumber);
    commitTable({ ...table, rowHeightOverrides });
  };

  return (
    <div
      className="grid grid-cols-2 gap-2 max-sm:grid-cols-1"
      data-testid="order-document-table-context-controls"
      data-order-document-table-controls
    >
      {selectedColumn ? (
        <Section title="Izbrani stolpec">
          <label
            htmlFor="order-document-table-column-label"
            className="block text-[9px] font-semibold text-white/55"
          >
            Naslov stolpca
            <input
              id="order-document-table-column-label"
              type="text"
              value={template.text.labels[COLUMN_LABEL_KEYS[selectedColumn.id]]}
              onChange={(event) => {
                const key = COLUMN_LABEL_KEYS[selectedColumn.id];
                onChange({
                  ...template,
                  text: {
                    ...template.text,
                    labels: { ...template.text.labels, [key]: event.target.value }
                  }
                });
              }}
              className={fieldClassName + ' mt-1'}
              data-testid="order-document-table-column-label"
            />
          </label>

          <div className="grid grid-cols-2 gap-1.5">
            <button
              type="button"
              className={compactButtonClassName}
              disabled={selectedColumnIndex === 0}
              onClick={() => moveSelectedColumn(-1)}
              data-testid="order-document-table-column-move-left"
            >
              ← Levo
            </button>
            <button
              type="button"
              className={compactButtonClassName}
              disabled={selectedColumnIndex === table.columns.length - 1}
              onClick={() => moveSelectedColumn(1)}
              data-testid="order-document-table-column-move-right"
            >
              Desno →
            </button>
          </div>

          <NumberControl
            id="order-document-table-column-width"
            label="Razmerje širine"
            value={selectedColumn.widthRatio}
            minimum={1}
            maximum={100}
            step={0.1}
            suffix="%"
            onChange={(widthRatio) =>
              updateSelectedColumn({ widthRatio: roundTenth(widthRatio) })
            }
            testId="order-document-table-column-width"
          />
        </Section>
      ) : null}

      <Section title="Obrobe tabele">
        <div
          className="grid grid-cols-3 gap-1"
          data-order-document-table-border-controls
        >
          {([
            ['outer', 'Zunanja'],
            ['horizontal', 'Vodoravne'],
            ['vertical', 'Navpične']
          ] as const).map(([key, label]) => (
            <label
              key={key}
              className={`flex min-h-7 cursor-pointer items-center justify-center gap-1 rounded-md border px-1 text-[8px] font-semibold transition ${
                borders[key]
                  ? 'border-blue-300/45 bg-blue-400/20 text-blue-100'
                  : 'border-white/10 bg-white/5 text-white/55 hover:bg-white/10'
              }`}
            >
              <AdminCheckbox
                checked={borders[key]}
                onChange={(event) => onChange(setOrderDocumentTableBorders(
                  template,
                  { [key]: event.target.checked }
                ))}
                data-testid={`order-document-table-border-${key}`}
              />
              {label}
            </label>
          ))}
        </div>
        <div className="grid grid-cols-[minmax(0,1fr)_5rem] gap-1.5">
          <CompactHexColorField
            id="order-document-table-border-color"
            label="Barva"
            value={borders.color}
            inheritedColor={template.style.lineColor}
            marker="order-document.table.borders.color"
            tone="dark"
            layout="compact"
            onChange={(color) => onChange(setOrderDocumentTableBorders(template, { color }))}
          />
          <NumberControl
            id="order-document-table-border-width"
            label="Debelina"
            value={borders.widthPt}
            minimum={0.25}
            maximum={12}
            step={0.25}
            suffix="pt"
            onChange={(widthPt) => onChange(setOrderDocumentTableBorders(template, { widthPt }))}
            testId="order-document-table-border-width"
          />
        </div>
        <button
          type="button"
          className={compactButtonClassName + ' w-full'}
          disabled={!table.borders}
          onClick={() => onChange(resetOrderDocumentTableBorders(template))}
          data-testid="order-document-table-border-reset"
        >
          Ponastavi obrobe
        </button>
      </Section>

      <Section title="Stolpci">
        <div className="grid grid-cols-2 gap-1.5">
          {table.columns.map((column) => {
            const field = { ...column, key: column.id };
            const identifying = field.id === 'sku' || field.id === 'description';
            const otherIdentifyingVisible = table.columns.some(
              (candidate) =>
                candidate.id !== field.id
                && candidate.visible
                && (candidate.id === 'sku' || candidate.id === 'description')
            );
            return (
              <label
                key={field.id}
                className="flex items-center gap-1.5 rounded-md border border-white/10 bg-white/5 px-1.5 py-1 text-[9px] font-semibold text-white/70"
              >
                <AdminCheckbox
                  checked={field.visible}
                  disabled={field.visible && identifying && !otherIdentifyingVisible}
                  onChange={(event) =>
                    commitTable({
                      ...table,
                      columns: table.columns.map((candidate) =>
                        candidate.id === field.id
                          ? { ...candidate, visible: event.target.checked }
                          : candidate
                      )
                    })
                  }
                  data-testid={`order-document-template-column-${field.key}`}
                />
                {field.id === 'sku'
                  ? 'SKU'
                  : field.id === 'quantity'
                    ? 'Količina'
                    : field.id === 'unit'
                      ? 'Enota'
                      : field.id === 'description'
                        ? 'Naziv'
                        : field.id === 'unitPrice'
                          ? 'Cena/enoto'
                          : 'Skupna cena'}
              </label>
            );
          })}
        </div>
        <button
          type="button"
          className={compactButtonClassName + ' w-full'}
          onClick={() => {
            const visibleCount = table.columns.filter((column) => column.visible).length;
            if (visibleCount === 0) return;
            const widthRatio = roundTenth(100 / visibleCount);
            commitTable({
              ...table,
              columns: table.columns.map((column) =>
                column.visible ? { ...column, widthRatio } : column
              )
            });
          }}
          data-testid="order-document-table-equal-widths"
        >
          Izenači širine vidnih stolpcev
        </button>
      </Section>

      <Section title="Glava in vrstice">
        <div className="grid grid-cols-2 gap-2">
          <NumberControl
            id="order-document-table-header-height"
            label="Višina glave"
            value={table.headerHeightPt}
            minimum={8}
            maximum={80}
            step={0.5}
            suffix="pt"
            onChange={(headerHeightPt) =>
              commitTable({ ...table, headerHeightPt: roundHalf(headerHeightPt) })
            }
            testId="order-document-table-header-height"
          />
          <NumberControl
            id="order-document-table-row-height"
            label="Višina vrstic"
            value={table.rowHeightPt}
            minimum={8}
            maximum={120}
            step={0.5}
            suffix="pt"
            onChange={(rowHeightPt) =>
              commitTable({ ...table, rowHeightPt: roundHalf(rowHeightPt) })
            }
            testId="order-document-table-row-height"
          />
        </div>
        <NumberControl
          id="order-document-table-row-gap"
          label="Razmik med vrsticami"
          value={table.rowGapPt}
          minimum={0}
          maximum={30}
          step={0.5}
          suffix="pt"
          onChange={(rowGapPt) =>
            commitTable({ ...table, rowGapPt: roundHalf(rowGapPt) })
          }
          testId="order-document-table-row-gap"
        />
      </Section>

      {selectedRow ? (
        <Section title={'Izbrana vrstica ' + selectedRow}>
          <NumberControl
            id="order-document-table-selected-row-height"
            label="Višina te vrstice"
            value={selectedRowOverride?.heightPt ?? table.rowHeightPt}
            minimum={8}
            maximum={200}
            step={0.5}
            suffix="pt"
            onChange={setSelectedRowHeight}
            testId="order-document-table-selected-row-height"
          />
          <button
            type="button"
            className={compactButtonClassName + ' w-full'}
            disabled={selectedRowOverride?.heightPt == null}
            onClick={() =>
              commitTable({
                ...table,
                rowHeightOverrides: table.rowHeightOverrides.flatMap((override) => {
                  if (override.rowNumber !== selectedRow) return [override];
                  const remaining = removeOrderDocumentTableRowHeight(override);
                  return remaining ? [remaining] : [];
                })
              })
            }
            data-testid="order-document-table-selected-row-reset"
          >
            Ponastavi višino vrstice
          </button>
        </Section>
      ) : null}

      <Section title="Vse vrstice">
        <button
          type="button"
          className={compactButtonClassName + ' w-full'}
          disabled={!table.rowHeightOverrides.some((override) => override.heightPt != null)}
          onClick={() => commitTable({
            ...table,
            rowHeightOverrides: table.rowHeightOverrides.flatMap((override) => {
              const remaining = removeOrderDocumentTableRowHeight(override);
              return remaining ? [remaining] : [];
            })
          })}
          data-testid="order-document-table-equalize-rows"
        >
          Izenači vse vrstice
        </button>
        <p className="text-[9px] leading-3.5 text-white/45">
          Predloga lahko spremeni prikaz vrstic, ne more pa izbrisati ali preurediti
          izdelkov naročila.
        </p>
      </Section>
    </div>
  );
}
