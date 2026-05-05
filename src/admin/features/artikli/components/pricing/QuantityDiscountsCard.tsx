'use client';

import { useEffect, useMemo, useState } from 'react';
import { AdminCheckbox } from '@/shared/ui/checkbox';
import { IconButton } from '@/shared/ui/icon-button';
import { PlusIcon, TrashCanIcon } from '@/shared/ui/icons/AdminActionIcons';
import {
  adminTableRowHeightClassName,
  adminTableNeutralIconButtonClassName,
  adminTableSelectedDangerIconButtonClassName,
  adminWindowCardClassName,
  adminWindowCardStyle
} from '@/shared/ui/admin-table/standards';
import { formatDecimalForDisplay } from '@/admin/features/artikli/lib/decimalFormat';
import type { QuantityDiscountsCardProps } from './pricingTypes';
import {
  classNames,
  compactTableAdornmentClassName,
  compactTableThirtyInputClassName,
  compactTableThirtyValueUnitShellClassName,
  DecimalDraftInput,
  DisabledSelectionCheckbox,
  ReadOnlyTableInput,
  sectionTitleClassName
} from './PricingFieldControls';
import { clampDiscountPercent, getSimulatorOptionSku } from './pricingCalculations';
import {
  adminProductInputChipClassName,
  allDiscountTargetLabel,
  normalizeDiscountSuggestionList
} from './productData';
import { toPricingSimulatorOptions } from './simulatorUtils';

const discountCheckboxColumnClassName = 'w-10 min-w-10 max-w-10';
const discountMinQuantityColumnClassName = 'w-[116px] min-w-[116px] max-w-[116px]';
const discountPercentColumnClassName = 'w-[92px] min-w-[92px] max-w-[92px]';
const discountTargetInputFrameClassName =
  'flex h-[30px] min-h-[30px] w-full flex-nowrap items-center overflow-hidden rounded-md border px-1 transition';
const discountTargetReadOnlyChipClassName = `${adminProductInputChipClassName} shrink-0 whitespace-nowrap`;
const discountTargetEditableChipClassName =
  `${adminProductInputChipClassName} shrink-0 whitespace-nowrap !gap-0.5 !pr-1`;
const discountTargetRemoveButtonClassName =
  'inline-flex h-3 w-3 items-center justify-center rounded-full text-[12px] leading-none text-current transition hover:text-[color:var(--danger-600)] active:text-[color:var(--danger-600)]';

function splitTargets(value: string): string[] {
  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function DiscountTargetChipInput({
  editable,
  compact,
  value,
  suggestions,
  listId,
  placeholder,
  onChange
}: {
  editable: boolean;
  compact: boolean;
  value: string[];
  suggestions: string[];
  listId: string;
  placeholder: string;
  onChange: (nextTargets: string[]) => void;
}) {
  const [draftValue, setDraftValue] = useState('');
  const targets = normalizeDiscountSuggestionList(value);
  const displayTargets = targets.length > 0 ? targets : [allDiscountTargetLabel];

  const commitDraft = () => {
    const entries = splitTargets(draftValue);
    if (entries.length === 0) return;
    const baseTargets = displayTargets.includes(allDiscountTargetLabel) ? [] : displayTargets;
    onChange(normalizeDiscountSuggestionList([...baseTargets, ...entries]));
    setDraftValue('');
  };

  const removeTarget = (target: string) => {
    const nextTargets = displayTargets.filter((entry) => entry !== target);
    onChange(nextTargets.length > 0 ? nextTargets : [allDiscountTargetLabel]);
  };

  if (!editable) {
    return (
      <div className={classNames(discountTargetInputFrameClassName, 'gap-1 border-transparent bg-transparent')}>
        {displayTargets.map((target) => (
          <span key={target} className={discountTargetReadOnlyChipClassName}>
            {target}
          </span>
        ))}
      </div>
    );
  }

  return (
    <>
      <div
        className={classNames(
          discountTargetInputFrameClassName,
          'gap-1 border-slate-300 bg-white focus-within:border-[#3e67d6]',
          compact && 'h-[30px] min-h-[30px]'
        )}
      >
        {displayTargets.map((target) => (
          <span key={target} className={discountTargetEditableChipClassName}>
            {target}
            <button
              type="button"
              className={discountTargetRemoveButtonClassName}
              aria-label={`Odstrani ${target}`}
              onClick={() => removeTarget(target)}
            >
              &times;
            </button>
          </span>
        ))}
        <input
          list={listId}
          className={classNames(
            'h-5 min-w-[7ch] flex-1 border-0 bg-transparent px-1 text-[11px] font-medium text-slate-900 outline-none focus:ring-0',
            compact && '!text-[11px]'
          )}
          value={draftValue}
          placeholder={displayTargets.length > 0 ? '' : placeholder}
          onChange={(event) => setDraftValue(event.target.value)}
          onBlur={commitDraft}
          onKeyDown={(event) => {
            if (event.key !== 'Enter' && event.key !== ',') return;
            event.preventDefault();
            commitDraft();
          }}
        />
      </div>
      <datalist id={listId}>
        {suggestions.map((suggestion) => (
          <option key={suggestion} value={suggestion} />
        ))}
      </datalist>
    </>
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
  minQuantityUnitLabel = '',
  minQuantityAllowsDecimal = false,
  className = ''
}: QuantityDiscountsCardProps) {
  const [customerSuggestions, setCustomerSuggestions] = useState<string[]>([]);
  const [selectedDiscountIds, setSelectedDiscountIds] = useState<Set<string>>(new Set());
  const pricingSimulatorOptions = useMemo(() => toPricingSimulatorOptions(simulatorOptions), [simulatorOptions]);

  const variantTargetSuggestions = useMemo(
    () =>
      normalizeDiscountSuggestionList([
        allDiscountTargetLabel,
        ...pricingSimulatorOptions.map(getSimulatorOptionSku).filter(Boolean)
      ]),
    [pricingSimulatorOptions]
  );
  const customerTargetSuggestions = useMemo(
    () => normalizeDiscountSuggestionList([allDiscountTargetLabel, ...customerSuggestions]),
    [customerSuggestions]
  );
  const allDiscountsSelected =
    quantityDiscounts.length > 0 && quantityDiscounts.every((rule) => selectedDiscountIds.has(rule.id));
  const hasSelectedDiscounts = selectedDiscountIds.size > 0;

  useEffect(() => {
    if (!usesScopedCommercialTools) return;
    let cancelled = false;
    void fetch('/api/admin/orders/customers', { cache: 'no-store' })
      .then((response) => (response.ok ? response.json() : { customers: [] }))
      .then((payload: unknown) => {
        if (cancelled) return;
        const record =
          typeof payload === 'object' && payload !== null && 'customers' in payload
            ? payload as { customers?: unknown }
            : {};
        const customers = Array.isArray(record.customers)
          ? record.customers.map((entry) => String(entry).trim()).filter(Boolean)
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

  const toggleDiscountSelection = (id: string) => {
    setSelectedDiscountIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const removeSelectedDiscounts = () => {
    if (!hasSelectedDiscounts) return;
    Array.from(selectedDiscountIds).forEach(onRemoveDiscount);
    setSelectedDiscountIds(new Set());
  };

  const toggleAllDiscounts = () => {
    setSelectedDiscountIds(
      allDiscountsSelected ? new Set() : new Set(quantityDiscounts.map((rule) => rule.id))
    );
  };

  const showDiscountActions = embedded || editable;
  const discountCheckboxCellClassName = embedded ? 'px-2 py-1.5 text-center' : 'px-2 py-2 text-center';
  const discountTableCellClassName = embedded ? 'px-3 py-1.5' : 'px-3 py-2';
  const discountHeaderCheckboxCellClassName = embedded
    ? `${adminTableRowHeightClassName} ${discountCheckboxColumnClassName} px-2 py-1.5 text-center`
    : `${discountCheckboxColumnClassName} px-2 py-2 text-center`;
  const discountHeaderCellClassName = embedded
    ? `${adminTableRowHeightClassName} whitespace-nowrap px-3 py-1.5 text-[11px] font-semibold text-slate-700`
    : 'whitespace-nowrap px-3 py-2 font-semibold text-slate-700';
  const discountControlClassName = embedded ? '!text-[11px]' : '';

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
            <p className="mt-1 text-[13px] font-medium text-slate-500">
              Privzeta pravila za popust glede na količino naročila.
            </p>
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
              className={
                editable && hasSelectedDiscounts
                  ? adminTableSelectedDangerIconButtonClassName
                  : adminTableNeutralIconButtonClassName
              }
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
        <table className={classNames('min-w-full table-fixed', embedded ? 'text-[11px] leading-4' : 'text-[12px]')}>
          <colgroup>
            <col className={discountCheckboxColumnClassName} />
            <col className={discountMinQuantityColumnClassName} />
            <col className={discountPercentColumnClassName} />
            {usesScopedCommercialTools ? (
              <>
                <col />
                <col />
              </>
            ) : (
              <col />
            )}
          </colgroup>
          <thead className="bg-[color:var(--admin-table-header-bg)]">
            <tr>
              <th className={discountHeaderCheckboxCellClassName}>
                {editable ? (
                  <AdminCheckbox
                    checked={allDiscountsSelected}
                    disabled={quantityDiscounts.length === 0}
                    onChange={toggleAllDiscounts}
                  />
                ) : (
                  <DisabledSelectionCheckbox />
                )}
              </th>
              <th className={`text-center ${discountHeaderCellClassName}`}>{minQuantityLabel}</th>
              <th className={`text-center ${discountHeaderCellClassName}`}>Popust</th>
              {usesScopedCommercialTools ? (
                <>
                  <th className={`text-left ${discountHeaderCellClassName}`}>Različice</th>
                  <th className={`text-left ${discountHeaderCellClassName}`}>Stranke</th>
                </>
              ) : (
                <th className={`text-center ${discountHeaderCellClassName}`}>Velja za</th>
              )}
            </tr>
          </thead>
          <tbody>
            {quantityDiscounts.length > 0 ? (
              quantityDiscounts.map((rule) => (
                <tr key={rule.id} className={classNames('border-t border-slate-100', embedded && adminTableRowHeightClassName)}>
                  <td className={discountCheckboxCellClassName}>
                    {editable ? (
                      <AdminCheckbox
                        checked={selectedDiscountIds.has(rule.id)}
                        onChange={() => toggleDiscountSelection(rule.id)}
                      />
                    ) : (
                      <DisabledSelectionCheckbox />
                    )}
                  </td>
                  <td className={`${discountTableCellClassName} text-center`}>
                    {editable ? (
                      <span className={`${compactTableThirtyValueUnitShellClassName} justify-center`}>
                        {minQuantityAllowsDecimal ? (
                          <DecimalDraftInput
                            className={`${compactTableThirtyInputClassName} ${discountControlClassName} !mt-0 !w-[5ch] !px-0 text-center`}
                            value={rule.minQuantity}
                            onDecimalChange={(value) => onUpdateDiscount(rule.id, { minQuantity: Math.max(0, value) })}
                          />
                        ) : (
                          <input
                            type="number"
                            min={1}
                            className={`${compactTableThirtyInputClassName} ${discountControlClassName} !mt-0 !w-[5ch] !px-0 text-center`}
                            value={rule.minQuantity}
                            onChange={(event) =>
                              onUpdateDiscount(rule.id, { minQuantity: Math.max(1, Number(event.target.value) || 1) })
                            }
                          />
                        )}
                        {minQuantityUnitLabel ? (
                          <span className={compactTableAdornmentClassName}>{minQuantityUnitLabel}</span>
                        ) : null}
                      </span>
                    ) : (
                      <span className={`${compactTableThirtyValueUnitShellClassName} justify-center`}>
                        <ReadOnlyTableInput
                          className={`${discountControlClassName} !w-[5ch] !px-0 text-center`}
                          value={formatDecimalForDisplay(rule.minQuantity)}
                        />
                        {minQuantityUnitLabel ? (
                          <span className={compactTableAdornmentClassName}>{minQuantityUnitLabel}</span>
                        ) : null}
                      </span>
                    )}
                  </td>
                  <td className={`${discountTableCellClassName} text-right`}>
                    {editable ? (
                      <span className={`${compactTableThirtyValueUnitShellClassName} justify-end`}>
                        <DecimalDraftInput
                          className={`${compactTableThirtyInputClassName} ${discountControlClassName} !mt-0 !w-[5ch] text-right`}
                          value={formatDecimalForDisplay(rule.discountPercent)}
                          onDecimalChange={(value) =>
                            onUpdateDiscount(rule.id, { discountPercent: clampDiscountPercent(value) })
                          }
                        />
                        <span className={compactTableAdornmentClassName}>%</span>
                      </span>
                    ) : (
                      <span className={`${compactTableThirtyValueUnitShellClassName} justify-end`}>
                        <ReadOnlyTableInput
                          className={`${discountControlClassName} !w-[5ch] text-right`}
                          value={formatDecimalForDisplay(rule.discountPercent)}
                        />
                        <span className={compactTableAdornmentClassName}>%</span>
                      </span>
                    )}
                  </td>
                  {usesScopedCommercialTools ? (
                    <>
                      <td className={`min-w-[150px] ${discountTableCellClassName}`}>
                        <DiscountTargetChipInput
                          editable={editable}
                          compact={embedded}
                          value={rule.variantTargets}
                          suggestions={variantTargetSuggestions}
                          listId={`discount-variants-${rule.id}`}
                          placeholder="SKU ali Vse"
                          onChange={(variantTargets) => onUpdateDiscount(rule.id, { variantTargets })}
                        />
                      </td>
                      <td className={`min-w-[150px] ${discountTableCellClassName}`}>
                        <DiscountTargetChipInput
                          editable={editable}
                          compact={embedded}
                          value={rule.customerTargets}
                          suggestions={customerTargetSuggestions}
                          listId={`discount-customers-${rule.id}`}
                          placeholder="Naročnik ali Vse"
                          onChange={(customerTargets) => onUpdateDiscount(rule.id, { customerTargets })}
                        />
                      </td>
                    </>
                  ) : (
                    <td className={`${discountTableCellClassName} text-center`}>
                      <span className="font-medium text-slate-700">Vse različice</span>
                    </td>
                  )}
                </tr>
              ))
            ) : (
              <tr className="border-t border-slate-100">
                <td
                  colSpan={usesScopedCommercialTools ? 5 : 4}
                  className="px-3 py-4 text-center text-[13px] font-medium text-slate-500"
                >
                  Ni aktivnih količinskih popustov.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default QuantityDiscountsCard;
