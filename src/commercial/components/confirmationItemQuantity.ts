const integerFormatter = new Intl.NumberFormat('sl-SI', {
  maximumFractionDigits: 0
});

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
  if (
    lastTwoDigits === 3 ||
    lastTwoDigits === 4 ||
    (lastTwoDigits > 20 && (lastDigit === 3 || lastDigit === 4))
  ) {
    return 'kosi';
  }
  return 'kosov';
}

export function formatConfirmationItemQuantity(
  quantity: number,
  unit?: string | null
) {
  const formattedQuantity = integerFormatter.format(quantity);
  const normalizedUnit = unit?.trim() || 'kos';
  const displayUnit =
    normalizedUnit.toLocaleLowerCase('sl-SI') === 'kos'
      ? formatPieceCount(quantity)
      : normalizedUnit;
  return `${formattedQuantity} ${displayUnit}`;
}
