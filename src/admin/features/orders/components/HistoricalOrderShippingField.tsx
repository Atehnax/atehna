'use client';

import { formatEuro } from '@/shared/domain/formatting';
import { AdminUnitInput } from '@/shared/ui/admin-controls/AdminUnitInput';
import {
  adminCardSectionEditIconButtonClassName,
  adminWindowCardClassName,
  adminWindowCardStyle
} from '@/shared/ui/admin-table';
import { PencilIcon } from '@/shared/ui/icons/AdminActionIcons';

type Props = {
  orderId: number;
  value: string;
  isEditing: boolean;
  disabled: boolean;
  onChange: (value: string) => void;
  onRequestEdit: () => void;
  error?: string;
};

export default function HistoricalOrderShippingField({
  orderId,
  value,
  isEditing,
  disabled,
  onChange,
  onRequestEdit,
  error
}: Props) {
  const normalizedAmount = value.trim().replace(/\s+/gu, '').replace(',', '.');
  const amount = normalizedAmount ? Number(normalizedAmount) : Number.NaN;
  const amountIsValid = Number.isFinite(amount) && amount >= 0;
  const titleId = 'admin-historical-shipping-title-' + orderId;
  const fieldId = 'admin-historical-shipping-amount-' + orderId;
  const errorId = fieldId + '-error';

  return (
    <section
      className={adminWindowCardClassName + ' overflow-hidden !p-0'}
      style={adminWindowCardStyle}
      aria-labelledby={titleId}
      data-testid="admin-historical-shipping-card"
    >
      <div className="flex min-h-11 items-center gap-2 px-4 py-2" data-shipping-summary-row>
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
          <h2 id={titleId} className="text-base font-semibold text-slate-900">Poštnina</h2>
          <span
            data-shipping-mode="manual"
            className="rounded-md border border-slate-300 bg-white px-1.5 py-0.5 text-[10px] font-semibold leading-4 text-slate-600"
          >
            Ročno
          </span>
        </div>
        <p
          className="shrink-0 whitespace-nowrap text-sm font-semibold leading-5 tabular-nums text-slate-950"
          data-shipping-final-amount
        >
          {amountIsValid ? formatEuro(amount) : '—'}
        </p>
        <button
          type="button"
          className={adminCardSectionEditIconButtonClassName + (isEditing ? ' bg-[color:var(--hover-neutral)]' : '')}
          aria-pressed={isEditing}
          aria-controls={fieldId}
          aria-label={isEditing ? 'Končaj urejanje poštnine' : 'Uredi poštnino'}
          title={isEditing ? 'Končaj urejanje poštnine' : 'Uredi poštnino'}
          disabled={disabled}
          data-admin-card-edit-action="shipping"
          onClick={onRequestEdit}
        >
          <PencilIcon className="h-4 w-4" />
        </button>
      </div>
      <div className="grid min-h-11 grid-cols-[minmax(0,1fr)_112px] items-center gap-3 border-t border-slate-200 px-4 py-2">
        <label htmlFor={fieldId} className="text-[11px] font-medium leading-4 text-slate-500">Znesek z DDV</label>
        <div className="h-7 min-w-0" data-historical-shipping-amount-slot>
          {isEditing ? (
            <AdminUnitInput
              id={fieldId}
              aria-label="Poštnina z DDV v evrih"
              aria-invalid={Boolean(error)}
              aria-describedby={error ? errorId : undefined}
              inputMode="decimal"
              value={value}
              onChange={(event) => onChange(event.target.value)}
              disabled={disabled}
              unit="€"
              className="!h-7"
              inputClassName="text-right !leading-[26px]"
            />
          ) : (
            <span id={fieldId} className="flex h-7 min-w-0 rounded-md border border-transparent" data-historical-shipping-read-value>
              <span className="min-w-0 flex-1 px-2 text-right font-['Inter',system-ui,sans-serif] text-[11px] font-normal leading-[26px] text-slate-900">
                {value.trim() || '—'}
              </span>
              <span className="inline-flex h-full shrink-0 items-center justify-center border-l border-transparent px-1.5 text-[10px] font-medium text-slate-500">€</span>
            </span>
          )}
        </div>
      </div>
      {error ? <p id={errorId} role="alert" className="border-t border-rose-200 bg-rose-50 px-4 py-1.5 text-[11px] leading-4 text-rose-700">{error}</p> : null}
    </section>
  );
}
