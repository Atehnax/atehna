'use client';

import { formatEuro, formatEuroAmount } from '@/shared/domain/formatting';
import {
  adminCardSectionEditIconButtonClassName,
  adminWindowCardClassName,
  adminWindowCardStyle
} from '@/shared/ui/admin-table';
import { PencilIcon } from '@/shared/ui/icons/AdminActionIcons';
import { adminInputFocusTokenClasses } from '@/shared/ui/theme/tokens';
import AdminOrderShippingInfo from './AdminOrderShippingInfo';
import cardStyles from './AdminOrderShippingCard.module.css';

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
      className={adminWindowCardClassName + ' overflow-hidden !px-4 !py-3 ' + cardStyles.card}
      style={adminWindowCardStyle}
      aria-labelledby={titleId}
      data-testid="admin-historical-shipping-card"
    >
      <div className={'flex h-7 items-center gap-2 ' + cardStyles.header} data-shipping-summary-row>
        <div className={'flex min-w-0 flex-1 items-center gap-1.5 ' + cardStyles.heading}>
          <h2 id={titleId} className="shrink-0 text-base font-semibold text-slate-900">Poštnina</h2>
          <AdminOrderShippingInfo>
            <p>Poštnina zgodovinskega naročila je ročno vnesen znesek z DDV.</p>
            {error ? <p className="font-medium text-rose-700">{error}</p> : null}
          </AdminOrderShippingInfo>
          <span
            data-shipping-mode="manual"
            title="Ročno"
            className="shrink-0 truncate rounded-md border border-slate-300 bg-white px-1.5 py-0.5 text-[10px] font-semibold leading-4 text-slate-600"
          >
            Ročno
          </span>
        </div>
        <div className="relative h-6 w-[76px] shrink-0" data-historical-shipping-amount-slot>
          {isEditing ? (
            <input
              id={fieldId}
              aria-label="Poštnina z DDV v evrih"
              aria-invalid={Boolean(error)}
              aria-describedby={error ? errorId : undefined}
              inputMode="decimal"
              value={value}
              onChange={(event) => onChange(event.target.value)}
              disabled={disabled}
              className={adminInputFocusTokenClasses + ' block h-6 w-full min-w-0 rounded-md border border-slate-300 bg-white py-0 pl-2 pr-5 text-right text-[11px] font-semibold leading-4 tabular-nums text-slate-900 disabled:cursor-not-allowed disabled:bg-white disabled:text-slate-500'}
            />
          ) : (
            <span
              id={fieldId}
              className="flex h-6 min-w-0 items-center justify-end border border-transparent pl-2 pr-5 text-[11px] font-semibold leading-4 tabular-nums text-slate-900"
              data-historical-shipping-read-value
              data-shipping-final-amount
              title={amountIsValid ? formatEuro(amount) : '—'}
              aria-label={amountIsValid ? formatEuro(amount) : 'Poštnina ni vnesena'}
            >
              <span className="truncate">{amountIsValid ? formatEuroAmount(amount) : '—'}</span>
            </span>
          )}
          <span className="pointer-events-none absolute inset-y-0 right-1 flex items-center text-[11px] font-semibold text-slate-900" aria-hidden="true">€</span>
        </div>
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
      <p className="mt-2 flex h-6 min-w-0 items-center text-[11px] leading-4 text-slate-500">
        <span className="truncate" title="Zgodovinsko naročilo · Ročni vnos">Zgodovinsko naročilo · Ročni vnos</span>
      </p>
      {error ? <p id={errorId} role="alert" className="sr-only">{error}</p> : null}
    </section>
  );
}
