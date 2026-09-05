import type { OrderConfirmationItem, OrderEstimateTotals } from '@/commercial/order/contracts';
import { formatConfirmationItemQuantity } from '@/commercial/components/confirmationItemQuantity';
import { formatEuro } from '@/shared/domain/formatting';

type OrderConfirmationSummaryProps = {
  items: OrderConfirmationItem[];
  totals: OrderEstimateTotals;
  className?: string;
};

const percentFormatter = new Intl.NumberFormat('sl-SI', {
  maximumFractionDigits: 2
});

function formatPercent(value: number) {
  return `${percentFormatter.format(value)} %`;
}

function moneyToCents(value: number) {
  return BigInt(Math.round(value * 100));
}

function grossFromNet(net: number, taxRate: number) {
  const netCents = moneyToCents(net);
  const safeTaxRate = Number.isFinite(taxRate) ? Math.max(0, Math.min(1, taxRate)) : 0;
  const taxBasisPoints = BigInt(Math.round(safeTaxRate * 10_000));
  const taxCents = (netCents * taxBasisPoints + 5_000n) / 10_000n;
  return Number(netCents + taxCents) / 100;
}

function positiveMoneyDifference(minuend: number, subtrahend: number) {
  const difference = moneyToCents(minuend) - moneyToCents(subtrahend);
  return Number(difference > 0n ? difference : 0n) / 100;
}

type TaxSummaryRow = {
  rate: number | null;
  amount: number;
};

function getTaxSummaryRows(items: OrderConfirmationItem[], totalTax: number): TaxSummaryRow[] {
  const taxByRate = new Map<number, bigint>();

  for (const item of items) {
    const rate = Number.isFinite(item.taxRate)
      ? Math.round(Math.max(0, Math.min(1, item.taxRate)) * 10_000) / 10_000
      : 0;
    taxByRate.set(rate, (taxByRate.get(rate) ?? 0n) + moneyToCents(item.lineTax));
  }

  const rows = Array.from(taxByRate, ([rate, amount]) => ({
    rate,
    amount: Number(amount) / 100
  })).sort((left, right) => right.rate - left.rate);

  if (rows.length === 1) {
    return [{ rate: rows[0].rate, amount: totalTax }];
  }

  const groupedTax = rows.reduce((sum, row) => sum + moneyToCents(row.amount), 0n);
  if (rows.length === 0 || groupedTax !== moneyToCents(totalTax)) {
    return [{ rate: null, amount: totalTax }];
  }

  return rows;
}

function hasSavedReduction(item: OrderConfirmationItem) {
  return (
    Number.isFinite(item.lineDiscountNet) &&
    Number.isFinite(item.baseUnitNet) &&
    Number.isFinite(item.unitNet) &&
    item.lineDiscountNet > 0 &&
    item.baseUnitNet > item.unitNet
  );
}

function getAppliedDiscount(item: OrderConfirmationItem): {
  kind: 'quantity' | 'variant';
  percent: number;
} | null {
  if (!hasSavedReduction(item)) return null;
  if (
    item.discountKind === 'quantity' &&
    item.quantityDiscountPct !== null &&
    Number.isFinite(item.quantityDiscountPct) &&
    item.quantityDiscountPct > 0
  ) {
    return { kind: 'quantity', percent: item.quantityDiscountPct };
  }
  if (item.discountKind === 'variant' && Number.isFinite(item.discountPct) && item.discountPct > 0) {
    return { kind: 'variant', percent: item.discountPct };
  }
  return null;
}

function CalculationRow({
  row,
  label,
  detail,
  value,
  tone = 'default',
  taxRate,
  emphasis = false
}: {
  row: 'net' | 'shipping' | 'tax';
  label: string;
  detail?: string;
  value: string;
  tone?: 'default' | 'discount';
  taxRate?: number | 'aggregate';
  emphasis?: boolean;
}) {
  return (
    <div
      className="flex min-w-0 items-start justify-between gap-4 py-1"
      data-summary-row={row}
      data-summary-tax-rate={taxRate}
    >
      <dt
        className={`min-w-0 text-sm leading-5 text-[color:var(--site-color-text)] ${
          emphasis ? 'font-bold' : 'font-semibold'
        }`}
      >
        {label}
        {detail ? <span className="font-medium text-[color:var(--site-color-text-muted)]"> ({detail})</span> : null}
      </dt>
      <dd
        className={`shrink-0 text-right text-sm leading-5 tabular-nums ${emphasis ? 'font-bold' : 'font-semibold'} ${
          tone === 'discount' ? 'text-[color:var(--site-color-success)]' : 'text-[color:var(--site-color-text)]'
        }`}
      >
        {value}
      </dd>
    </div>
  );
}

export function OrderConfirmationItemPricing({
  item
}: {
  item: OrderConfirmationItem;
}) {
  const appliedDiscount = getAppliedDiscount(item);
  const unitListGross = grossFromNet(item.baseUnitNet, item.taxRate);
  const lineListGross = grossFromNet(item.lineListNet, item.taxRate);
  const lineDiscountGross = appliedDiscount
    ? positiveMoneyDifference(lineListGross, item.lineGross)
    : 0;
  const unitCalculationMatches =
    moneyToCents(unitListGross) * BigInt(item.quantity) ===
    moneyToCents(lineListGross);

  return (
    <div className="min-w-0 sm:min-w-[12rem]" data-confirmation-item-pricing>
      <dl className="grid gap-1.5">
        <div className="flex min-w-0 items-center justify-between gap-4">
          <dt
            className="min-w-0 whitespace-nowrap text-sm font-medium leading-5 tabular-nums text-[color:var(--site-color-text)]"
            data-confirmation-item-expression
          >
            {formatConfirmationItemQuantity(item.quantity, item.unit)} ×{' '}
            {formatEuro(unitListGross)}
          </dt>
          <dd
            className="shrink-0 whitespace-nowrap text-right text-base font-semibold leading-6 tabular-nums text-[color:var(--site-color-text)]"
            data-confirmation-item-line-gross
          >
            {formatEuro(lineListGross)}
          </dd>
        </div>
        {appliedDiscount && lineDiscountGross > 0 ? (
          <div
            className="flex min-w-0 items-start justify-between gap-4 text-sm leading-5"
            data-confirmation-item-discount
            data-summary-row="item-discount"
          >
            <dt className="min-w-0 font-medium text-[color:var(--site-color-text-muted)]">
              {appliedDiscount.kind === 'quantity'
                ? 'Količinski popust'
                : 'Popust'}
              {' '}({formatPercent(appliedDiscount.percent)})
            </dt>
            <dd className="shrink-0 text-right font-semibold tabular-nums text-[color:var(--site-color-success)]">
              -{formatEuro(lineDiscountGross)}
            </dd>
          </div>
        ) : null}
      </dl>
      {!unitCalculationMatches ? (
        <p
          className="mt-1 text-right text-xs leading-4 text-[color:var(--site-color-text-muted)]"
          data-confirmation-item-rounding-note
        >
          DDV je zaokrožen na ravni postavke.
        </p>
      ) : null}
    </div>
  );
}

export default function OrderConfirmationSummary({
  items,
  totals,
  className
}: OrderConfirmationSummaryProps) {
  const taxRows = getTaxSummaryRows(items, totals.tax);

  return (
    <section
      className={`min-w-0 ${className ?? ''}`.trim()}
      data-confirmation-summary-content
      aria-labelledby="confirmation-summary-heading"
    >
      <h2 id="confirmation-summary-heading" className="text-lg font-semibold">
        Povzetek naročila
      </h2>

      <section className="mt-4" data-summary-section="calculation">
        <dl
          className="mt-2"
          data-summary-totals
        >
          <CalculationRow
            row="net"
            label="Vmesna vsota brez DDV"
            value={formatEuro(totals.net)}
            emphasis
          />
          {taxRows.map((taxRow) => (
            <CalculationRow
              key={taxRow.rate ?? 'aggregate'}
              row="tax"
              label={taxRow.rate === null ? 'DDV' : `DDV (${formatPercent(taxRow.rate * 100)})`}
              value={formatEuro(taxRow.amount)}
              taxRate={taxRow.rate ?? 'aggregate'}
            />
          ))}
          <CalculationRow
            row="shipping"
            label="Poštnina"
            value={totals.shipping === null ? '—' : formatEuro(totals.shipping)}
          />
          <div
            className="mt-3 flex min-w-0 items-center justify-between gap-4 border-t border-[color:var(--site-divider-color)] pt-3 text-[color:var(--site-color-primary)]"
            data-summary-row="gross"
          >
            <dt className="min-w-0 text-base font-semibold leading-6">Skupaj za plačilo</dt>
            <dd className="shrink-0 text-right text-xl font-semibold leading-7 tabular-nums">
              {totals.gross === null ? '—' : formatEuro(totals.gross)}
            </dd>
          </div>
        </dl>
      </section>
    </section>
  );
}
