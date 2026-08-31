import type { OrderConfirmationItem, OrderEstimateTotals } from '@/commercial/order/contracts';
import { formatEuro } from '@/shared/domain/formatting';

type OrderConfirmationSummaryProps = {
  items: OrderConfirmationItem[];
  totals: OrderEstimateTotals;
  className?: string;
};

const percentFormatter = new Intl.NumberFormat('sl-SI', {
  maximumFractionDigits: 2
});

const integerFormatter = new Intl.NumberFormat('sl-SI', {
  maximumFractionDigits: 0
});

function formatPercent(value: number) {
  return `${percentFormatter.format(value)} %`;
}

function formatPieceCount(quantity: number) {
  const absoluteQuantity = Math.abs(Math.trunc(quantity));
  const lastTwoDigits = absoluteQuantity % 100;
  const lastDigit = absoluteQuantity % 10;

  if (lastTwoDigits === 1 || (lastTwoDigits > 20 && lastDigit === 1)) {
    return 'kos';
  }
  if (lastTwoDigits === 2 || (lastTwoDigits > 20 && lastDigit === 2)) {
    return 'kosa';
  }
  if (lastTwoDigits === 3 || lastTwoDigits === 4 || (lastTwoDigits > 20 && (lastDigit === 3 || lastDigit === 4))) {
    return 'kosi';
  }
  return 'kosov';
}

function formatQuantity(item: OrderConfirmationItem) {
  const quantity = integerFormatter.format(item.quantity);
  const unit = item.unit?.trim() || 'kos';
  const displayUnit = unit.toLocaleLowerCase('sl') === 'kos' ? formatPieceCount(item.quantity) : unit;
  return `${quantity} ${displayUnit}`;
}

function buildItemTitle(productName: string, variantName: string) {
  const product = productName.trim();
  const variant = variantName.trim();
  if (!variant) return product;

  const normalizedProduct = product.toLocaleLowerCase('sl-SI');
  const normalizedVariant = variant.toLocaleLowerCase('sl-SI');
  if (
    normalizedProduct === normalizedVariant ||
    normalizedProduct.endsWith(` ${normalizedVariant}`)
  ) {
    return product;
  }
  if (normalizedVariant.startsWith(`${normalizedProduct} `)) return variant;
  return `${product} ${variant}`;
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

export default function OrderConfirmationSummary({
  items,
  totals,
  className
}: OrderConfirmationSummaryProps) {
  const taxRows = getTaxSummaryRows(items, totals.tax);

  return (
    <aside
      className={`min-w-0 ${className ?? ''}`.trim()}
      data-testid="confirmation-summary"
      aria-labelledby="confirmation-summary-heading"
    >
      <h3 id="confirmation-summary-heading" className="text-lg font-semibold">
        Povzetek naročila
      </h3>

      <section className="mt-4" data-summary-section="calculation">
        <h4 className="text-sm font-semibold leading-5 text-[color:var(--site-color-text)]">Izračun</h4>
        <ul className="mt-2" data-summary-items>
          {items.map((item, itemIndex) => {
            const appliedDiscount = getAppliedDiscount(item);
            const itemTitle = buildItemTitle(item.productName, item.variantName);
            const unitListGross = grossFromNet(item.baseUnitNet, item.taxRate);
            const lineListGross = grossFromNet(item.lineListNet, item.taxRate);
            const lineDiscountGross = appliedDiscount
              ? positiveMoneyDifference(lineListGross, item.lineGross)
              : 0;
            const unitCalculationMatches =
              moneyToCents(unitListGross) * BigInt(item.quantity) === moneyToCents(lineListGross);

            return (
              <li
                key={`${item.variantId}-${item.sku}-${itemIndex}`}
                className="border-t border-[color:var(--site-divider-color)] py-3 first:border-t-0 first:pt-0"
                data-summary-item={item.variantId}
              >
                <div className="min-w-0" data-summary-item-content>
                    <h5
                      className="break-words text-sm font-semibold leading-5 text-[color:var(--site-color-text)]"
                      data-summary-item-title
                    >
                      {itemTitle}
                    </h5>
                    {item.sku ? (
                      <p
                        className="mt-0.5 break-all text-xs font-medium leading-4 text-[color:var(--site-color-text-muted)]"
                        data-summary-item-meta
                      >
                        SKU: {item.sku}
                      </p>
                    ) : null}
                </div>
                <dl className="mt-3">
                  <div
                    className="flex min-w-0 items-center justify-between gap-4"
                    data-summary-row="item-base"
                  >
                    <dt
                      className="min-w-0 text-sm font-semibold leading-5 tabular-nums text-[color:var(--site-color-text)]"
                      data-summary-item-expression
                    >
                      {formatQuantity(item)} × {formatEuro(unitListGross)}
                    </dt>
                    <dd
                      className="shrink-0 whitespace-nowrap text-right text-sm font-semibold leading-5 tabular-nums text-[color:var(--site-color-text)]"
                      data-summary-item-line-gross
                      aria-label={
                        appliedDiscount
                          ? 'Znesek postavke z DDV pred popustom'
                          : 'Znesek postavke z DDV'
                      }
                    >
                      {formatEuro(lineListGross)}
                    </dd>
                  </div>
                  {appliedDiscount && lineDiscountGross > 0 ? (
                    <div
                      className="flex min-w-0 items-start justify-between gap-4 py-1 text-sm leading-5"
                      data-summary-row="item-discount"
                    >
                      <dt className="min-w-0 font-semibold text-[color:var(--site-color-text)]">
                        {appliedDiscount.kind === 'quantity' ? 'Količinski popust' : 'Popust'}
                        <span className="font-medium text-[color:var(--site-color-text-muted)]">
                          {' '}({formatPercent(appliedDiscount.percent)})
                        </span>
                      </dt>
                      <dd className="shrink-0 text-right font-semibold tabular-nums text-[color:var(--site-color-success)]">
                        -{formatEuro(lineDiscountGross)}
                      </dd>
                    </div>
                  ) : null}
                </dl>
                {!unitCalculationMatches ? (
                  <p
                    className="mt-1 text-xs leading-4 text-[color:var(--site-color-text-muted)]"
                    data-summary-item-rounding-note
                  >
                    DDV je zaokrožen na ravni postavke.
                  </p>
                ) : null}
              </li>
            );
          })}
        </ul>

        <dl
          className="mt-2 border-t border-[color:var(--site-divider-color)] pt-2"
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
    </aside>
  );
}
