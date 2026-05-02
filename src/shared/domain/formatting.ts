const slCurrencyFormatter = new Intl.NumberFormat('sl-SI', {
  style: 'currency',
  currency: 'EUR'
});

const slEuroAmountFormatter = new Intl.NumberFormat('sl-SI', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

const slIntegerFormatter = new Intl.NumberFormat('sl-SI', {
  maximumFractionDigits: 0
});

const slNumberFormatter = new Intl.NumberFormat('sl-SI');

export const formatEuro = (value: number) => slCurrencyFormatter.format(value);

export const formatEuroAmount = (value: number) => slEuroAmountFormatter.format(value);

export const formatEuroWithSuffix = (value: number) => `${formatEuroAmount(value)} \u20ac`;

export const formatEuroRange = (minValue: number, maxValue: number) =>
  minValue === maxValue
    ? formatEuroWithSuffix(minValue)
    : `${formatEuroAmount(minValue)}\u2013${formatEuroAmount(maxValue)} \u20ac`;

export const formatSlInteger = (value: number) => slIntegerFormatter.format(value);

export const formatSlNumber = (value: number) => slNumberFormatter.format(value);
