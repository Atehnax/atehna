import { formatDecimalForDisplay } from '@/admin/features/artikli/lib/decimalFormat';

const slovenianPieceUnits = new Set(['kos', 'kosa', 'kosi', 'kosov']);

export function isSlovenianPieceUnit(unit: string): boolean {
  return slovenianPieceUnits.has(unit.trim().toLocaleLowerCase('sl-SI'));
}

export function getSlovenianPieceUnit(value: number): string {
  if (!Number.isFinite(value) || !Number.isInteger(value)) {
    return 'kosov';
  }

  const absoluteValue = Math.abs(value);
  const lastTwoDigits = absoluteValue % 100;
  if (lastTwoDigits >= 11 && lastTwoDigits <= 14) {
    return 'kosov';
  }

  const lastDigit = absoluteValue % 10;
  if (lastDigit === 1) {
    return 'kos';
  }
  if (lastDigit === 2) {
    return 'kosa';
  }
  if (lastDigit === 3 || lastDigit === 4) {
    return 'kosi';
  }
  return 'kosov';
}

export function getSlovenianPieceLocativeUnit(value: number): string {
  if (!Number.isFinite(value) || !Number.isInteger(value)) {
    return 'kosih';
  }
  return Math.abs(value) === 1 ? 'kosu' : 'kosih';
}

export function formatPieceQuantity(value: number): string {
  return `${formatDecimalForDisplay(value)} ${getSlovenianPieceUnit(value)}`;
}

export function formatPieceQuantityLocative(value: number): string {
  return `${formatDecimalForDisplay(value)} ${getSlovenianPieceLocativeUnit(value)}`;
}

export function formatQuantityWithUnit(value: number, unit: string): string {
  if (isSlovenianPieceUnit(unit)) {
    return formatPieceQuantity(value);
  }
  return `${formatDecimalForDisplay(value)} ${unit}`;
}

export function formatQuantityWithUnitLocative(value: number, unit: string): string {
  if (isSlovenianPieceUnit(unit)) {
    return formatPieceQuantityLocative(value);
  }
  return `${formatDecimalForDisplay(value)} ${unit}`;
}

export function getQuantityUnitForValue(value: number, unit: string): string {
  if (isSlovenianPieceUnit(unit)) {
    return getSlovenianPieceUnit(value);
  }
  return unit;
}
