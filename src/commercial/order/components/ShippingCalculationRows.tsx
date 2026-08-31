import type { ShippingCalculation } from '@/shared/domain/shipping/shipping';
import { formatEuro } from '@/shared/domain/formatting';

type ShippingCalculationRowsProps = {
  calculation: ShippingCalculation | null;
  finalLabel?: string;
  frozenOverride?: { amount: number; reason: string } | null;
};

const centsToEuro = (amountCents: number) => amountCents / 100;

function shippingIssueMessage(issue: { message: string }) {
  return issue.message.trim();
}

export function shippingManualQuoteMessage(
  calculation: ShippingCalculation | null
) {
  if (calculation?.status !== 'manual_quote') return null;
  return calculation.reason.trim() || 'Poštnina se določi po dogovoru.';
}

export function ShippingManualQuoteNotice({
  calculation,
  className = ''
}: {
  calculation: ShippingCalculation | null;
  className?: string;
}) {
  const message = shippingManualQuoteMessage(calculation);
  if (!message || calculation?.status !== 'manual_quote') return null;

  return (
    <div
      role="alert"
      className={className}
      data-shipping-status="manual_quote"
      data-shipping-configuration-version={calculation.configurationVersion}
    >
      <p className="font-semibold">Poštnina po dogovoru</p>
      <p className="mt-1">{message}</p>
      {calculation.issues.length > 0 ? (
        <ul className="mt-1 list-disc pl-4">
          {calculation.issues.map((issue, index) => (
            <li key={`${issue.code}-${issue.variantId ?? 'order'}-${index}`}>
              {shippingIssueMessage(issue)}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export default function ShippingCalculationRows({
  calculation,
  finalLabel = 'Poštnina',
  frozenOverride = null
}: ShippingCalculationRowsProps) {
  if (calculation?.status === 'manual_quote' && frozenOverride) {
    return (
      <>
        <div
          className="flex justify-between gap-4 text-[color:var(--site-color-text-muted)]"
          data-shipping-row="automatic-origin"
          data-shipping-status="manual_quote"
          data-shipping-configuration-version={calculation.configurationVersion}
        >
          <dt>Samodejni izračun</dt>
          <dd className="text-right font-semibold text-[color:var(--site-color-danger)]">
            Po dogovoru
          </dd>
        </div>
        <div
          className="flex justify-between gap-4 text-[color:var(--site-color-text-muted)]"
          data-shipping-row="final"
          data-summary-row="shipping"
          data-shipping-status="calculated"
          data-shipping-source="manual_override"
        >
          <dt>
            {frozenOverride.amount === 0 ? 'Brezplačna dostava' : finalLabel}
            <span className="block text-xs font-normal">
              Ročno določena{frozenOverride.reason ? ': ' + frozenOverride.reason : ''}
            </span>
          </dt>
          <dd className="font-semibold tabular-nums text-[color:var(--site-color-text)]">
            {formatEuro(frozenOverride.amount)}
          </dd>
        </div>
      </>
    );
  }

  if (!calculation) {
    return (
      <div
        className="flex justify-between gap-4 text-[color:var(--site-color-text-muted)]"
        data-shipping-status="pending"
      >
        <dt>{finalLabel}</dt>
        <dd className="font-semibold tabular-nums text-[color:var(--site-color-text)]">
          —
        </dd>
      </div>
    );
  }

  if (calculation.status === 'manual_quote') {
    return (
      <div
        className="flex justify-between gap-4 text-[color:var(--site-color-text-muted)]"
        data-shipping-status="manual_quote"
        data-shipping-configuration-version={calculation.configurationVersion}
      >
        <dt>{finalLabel}</dt>
        <dd className="text-right font-semibold text-[color:var(--site-color-danger)]">
          Po dogovoru
        </dd>
      </div>
    );
  }

  const manuallyOverridden = calculation.source === 'manual_override';
  const isFreeDelivery = calculation.finalAmountCents === 0;
  const multiPieceFormula = calculation.parcelCount === 1
    ? `1 × ${formatEuro(centsToEuro(calculation.singleParcelAmountCents))} = ${formatEuro(centsToEuro(calculation.afterMultiPieceAmountCents))}`
    : calculation.matchedMultiPieceDiscountRule?.adjustmentType === 'percentage'
      ? `${calculation.parcelCount} × ${formatEuro(centsToEuro(calculation.singleParcelAmountCents))} × (1 − ${calculation.matchedMultiPieceDiscountRule.adjustmentValue ?? 0} / 100) = ${formatEuro(centsToEuro(calculation.afterMultiPieceAmountCents))}`
      : calculation.matchedMultiPieceDiscountRule?.adjustmentType === 'fixed'
        ? `${calculation.parcelCount} × max(0, ${formatEuro(centsToEuro(calculation.singleParcelAmountCents))} − ${formatEuro(centsToEuro(calculation.matchedMultiPieceDiscountRule.adjustmentValue ?? 0))}) = ${formatEuro(centsToEuro(calculation.afterMultiPieceAmountCents))}`
        : `${calculation.parcelCount} × ${formatEuro(centsToEuro(calculation.singleParcelAmountCents))} = ${formatEuro(centsToEuro(calculation.afterMultiPieceAmountCents))}`;

  return (
    <>
      <div
        className="flex justify-between gap-4 text-[color:var(--site-color-text-muted)]"
        data-shipping-row="base"
      >
        <dt>Osnovna poštnina</dt>
        <dd className="font-semibold tabular-nums text-[color:var(--site-color-text)]">
          {formatEuro(centsToEuro(calculation.basePriceCents))}
        </dd>
      </div>
      {calculation.surchargeAmountCents > 0 ? (
        <div
          className="flex justify-between gap-4 text-[color:var(--site-color-text-muted)]"
          data-shipping-row="surcharge"
        >
          <dt>Dodatek za večje dimenzije</dt>
          <dd className="font-semibold tabular-nums text-[color:var(--site-color-text)]">
            {formatEuro(centsToEuro(calculation.surchargeAmountCents))}
          </dd>
        </div>
      ) : null}
      <div
        className="flex justify-between gap-4 text-[color:var(--site-color-text-muted)]"
        data-shipping-row="single-parcel-reference"
      >
        <dt>Referenčna cena posameznega paketa (S)</dt>
        <dd className="shrink-0 font-semibold tabular-nums text-[color:var(--site-color-text)]">
          {formatEuro(centsToEuro(calculation.singleParcelAmountCents))}
        </dd>
      </div>
      <div
        className="flex justify-between gap-4 text-[color:var(--site-color-text-muted)]"
        data-shipping-row="multi-piece-base"
      >
        <dt>{calculation.parcelCount} × S</dt>
        <dd className="shrink-0 font-semibold tabular-nums text-[color:var(--site-color-text)]">
          {formatEuro(centsToEuro(calculation.parcelCountGrossAmountCents))}
        </dd>
      </div>
      {calculation.multiPieceDiscountAmountCents > 0 ? (
        <div
          className="flex justify-between gap-4 text-[color:var(--site-color-text-muted)]"
          data-shipping-row="multi-piece-discount"
        >
          <dt>Popust za pošiljanje v več kosih</dt>
          <dd className="shrink-0 font-semibold tabular-nums text-[color:var(--site-color-text)]">
            −{formatEuro(centsToEuro(calculation.multiPieceDiscountAmountCents))}
          </dd>
        </div>
      ) : null}
      <div
        className="flex justify-between gap-4 text-[color:var(--site-color-text-muted)]"
        data-shipping-row="multi-piece-result"
      >
        <dt>Po popustu za več kosov</dt>
        <dd className="shrink-0 font-semibold tabular-nums text-[color:var(--site-color-text)]">
          {formatEuro(centsToEuro(calculation.afterMultiPieceAmountCents))}
        </dd>
      </div>
      {calculation.orderValueDiscountAmountCents > 0 ? (
        <div
          className="flex justify-between gap-4 text-[color:var(--site-color-text-muted)]"
          data-shipping-row="order-value-discount"
        >
          <dt>
            {calculation.matchedOrderValueDiscountRule?.name || 'Popust glede na vrednost naročila'}
            <span className="block text-xs font-normal">
              Vrednost blaga z DDV: {formatEuro(centsToEuro(calculation.merchandiseSubtotalCents))}
            </span>
          </dt>
          <dd className="shrink-0 font-semibold tabular-nums text-[color:var(--site-color-text)]">
            −{formatEuro(centsToEuro(calculation.orderValueDiscountAmountCents))}
          </dd>
        </div>
      ) : null}
      <div
        className="flex justify-between gap-4 text-[color:var(--site-color-text-muted)]"
        data-shipping-row="formula"
      >
        <dt>Izračun</dt>
        <dd className="max-w-[70%] text-right text-xs leading-4 text-[color:var(--site-color-text-muted)]">
          {multiPieceFormula}
          {calculation.orderValueDiscountAmountCents > 0
            ? `; ${formatEuro(centsToEuro(calculation.afterMultiPieceAmountCents))} − ${formatEuro(centsToEuro(calculation.orderValueDiscountAmountCents))} = ${formatEuro(centsToEuro(calculation.automaticAmountCents))}`
            : ''}
        </dd>
      </div>
      <div
        className="flex justify-between gap-4 text-[color:var(--site-color-text-muted)]"
        data-shipping-row="automatic"
      >
        <dt>Samodejno izračunana poštnina</dt>
        <dd className="shrink-0 font-semibold tabular-nums text-[color:var(--site-color-text)]">
          {formatEuro(centsToEuro(calculation.automaticAmountCents))}
        </dd>
      </div>
      {manuallyOverridden ? (
        <div
          className="flex justify-between gap-4 text-[color:var(--site-color-text-muted)]"
          data-shipping-row="manual-override"
        >
          <dt>
            Ročna nastavitev
            {calculation.manualOverride?.reason ? (
              <span className="block text-xs font-normal">
                {calculation.manualOverride.reason}
              </span>
            ) : null}
          </dt>
          <dd className="shrink-0 font-semibold tabular-nums text-[color:var(--site-color-text)]">
            {formatEuro(centsToEuro(calculation.finalAmountCents))}
          </dd>
        </div>
      ) : null}
      <div
        className="flex justify-between gap-4 text-[color:var(--site-color-text-muted)]"
        data-shipping-row="final"
        data-summary-row="shipping"
        data-shipping-status="calculated"
        data-shipping-source={manuallyOverridden ? 'manual_override' : 'automatic'}
        data-shipping-configuration-version={calculation.configurationVersion}
      >
        <dt>
          {isFreeDelivery ? 'Brezplačna dostava' : finalLabel}
          {manuallyOverridden ? (
            <span className="block text-xs font-normal">
              Ročno določena
              {calculation.manualOverride?.reason
                ? `: ${calculation.manualOverride.reason}`
                : ''}
            </span>
          ) : null}
        </dt>
        <dd className="font-semibold tabular-nums text-[color:var(--site-color-text)]">
          {formatEuro(centsToEuro(calculation.finalAmountCents))}
        </dd>
      </div>
    </>
  );
}
