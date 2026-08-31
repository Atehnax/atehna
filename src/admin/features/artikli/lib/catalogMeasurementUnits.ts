export function catalogWeightKilogramsToDisplayGrams(
  value: number | null | undefined
): number | null {
  return value === null || value === undefined ? null : value * 1000;
}

export function catalogWeightDisplayGramsToKilograms(
  value: number | null
): number | null {
  return value === null ? null : value / 1000;
}
