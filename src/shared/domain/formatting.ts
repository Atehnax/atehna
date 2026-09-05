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

const slCountPluralRules = new Intl.PluralRules('sl-SI');

type SlCountForms = { one: string; two: string; few: string; other: string };

export function formatSlCount(value: number, forms: SlCountForms) {
  const category = slCountPluralRules.select(value);
  const form = category === 'one' || category === 'two' || category === 'few'
    ? forms[category]
    : forms.other;
  return `${formatSlNumber(value)} ${form}`;
}

export const formatSlOrderCount = (value: number) => formatSlCount(value, {
  one: 'naročilo', two: 'naročili', few: 'naročila', other: 'naročil'
});
