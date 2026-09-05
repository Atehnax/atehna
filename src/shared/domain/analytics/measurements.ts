export type AnalyticsMeasurementFields = {
  actualPackedWeightGrams?: number | null;
  actualCarrierCostNet?: string | null;
  actualParcelCount?: number | null;
  preparationMinutes?: string | null;
  actualOversize?: boolean | null;
  actualLengthMm?: number | null;
  actualWidthMm?: number | null;
  actualHeightMm?: number | null;
  merchandiseRefundNet?: string | null;
  refundHistoryComplete?: boolean;
  shippingTaxRate?: string | null;
  customerDirectoryProfileId?: string | null;
  schoolDirectoryRowId?: string | null;
  analyticsIsTest?: boolean;
};

export type AnalyticsMeasurementMutation = {
  expectedRevision: number;
  reason: string;
  fields: AnalyticsMeasurementFields;
};

export class AnalyticsMeasurementValidationError extends Error {}

export const ANALYTICS_MEASUREMENT_COLUMNS = {
  actualPackedWeightGrams: 'actual_packed_weight_grams',
  actualCarrierCostNet: 'actual_carrier_cost_net',
  actualParcelCount: 'actual_parcel_count',
  preparationMinutes: 'preparation_minutes',
  actualOversize: 'actual_oversize',
  actualLengthMm: 'actual_length_mm',
  actualWidthMm: 'actual_width_mm',
  actualHeightMm: 'actual_height_mm',
  merchandiseRefundNet: 'merchandise_refund_net',
  refundHistoryComplete: 'refund_history_complete',
  shippingTaxRate: 'shipping_tax_rate',
  customerDirectoryProfileId: 'customer_directory_profile_id',
  schoolDirectoryRowId: 'school_directory_row_id',
  analyticsIsTest: 'analytics_is_test'
} as const;

function invalid(message: string): never {
  throw new AnalyticsMeasurementValidationError(message);
}

function decimal(value: unknown, scale: number, maxWhole: bigint): string | null {
  if (value === null || value === '') return null;
  if (typeof value !== 'string' && typeof value !== 'number') return invalid('Meritev mora biti število ali prazna vrednost.');
  const source = String(value).trim().replace(',', '.');
  const match = /^(\d+)(?:\.(\d+))?$/.exec(source);
  if (!match || (match[2]?.length ?? 0) > scale || BigInt(match[1]) > maxWhole) return invalid('Meritev je zunaj dovoljenega območja ali ima preveč decimalk.');
  return `${BigInt(match[1])}.${(match[2] ?? '').padEnd(scale, '0')}`;
}

export function parseAnalyticsMeasurementMutation(value: unknown): AnalyticsMeasurementMutation {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return invalid('Zahteva ni veljavna.');
  const record = value as Record<string, unknown>;
  if (!Number.isSafeInteger(record.expectedRevision) || Number(record.expectedRevision) < 0) return invalid('Manjka veljavna pričakovana revizija.');
  const reason = typeof record.reason === 'string' ? record.reason.trim() : '';
  if (reason.length < 3 || reason.length > 2000) return invalid('Vnesite razlog oziroma vir meritve (3–2000 znakov).');
  if (!record.fields || typeof record.fields !== 'object' || Array.isArray(record.fields)) return invalid('Manjkajo meritve.');
  const fields = record.fields as Record<string, unknown>;
  const entries = Object.entries(fields);
  if (!entries.length || entries.some(([key]) => !Object.hasOwn(ANALYTICS_MEASUREMENT_COLUMNS, key))) return invalid('Izbrano polje ni podprto.');
  const parsed: Record<string, unknown> = {};
  const integerFields = new Set(['actualPackedWeightGrams', 'actualParcelCount', 'actualLengthMm', 'actualWidthMm', 'actualHeightMm']);
  for (const [key, raw] of entries) {
    if (integerFields.has(key)) {
      if (raw === null || raw === '') parsed[key] = null;
      else {
        const number = typeof raw === 'string' && /^\d+$/.test(raw.trim()) ? Number(raw) : raw;
        const max = key === 'actualPackedWeightGrams' ? 1_000_000_000 : 2_147_483_647;
        if (!Number.isSafeInteger(number) || Number(number) <= 0 || Number(number) > max) return invalid('Masa, mere in število paketov morajo biti pozitivna cela števila.');
        parsed[key] = number;
      }
    } else if (key === 'actualCarrierCostNet' || key === 'merchandiseRefundNet') {
      parsed[key] = decimal(raw, 2, 9_999_999_999n);
    } else if (key === 'preparationMinutes') {
      parsed[key] = decimal(raw, 2, 99_999_999n);
    } else if (key === 'shippingTaxRate') {
      const rate = decimal(raw, 4, 1n);
      if (rate !== null && Number(rate) > 1) return invalid('Stopnja DDV mora biti med 0 in 1 (npr. 0,22).');
      parsed[key] = rate;
    } else if (key === 'actualOversize') {
      if (raw !== null && typeof raw !== 'boolean') return invalid('Oznaka presežnih mer mora biti da, ne ali brez podatka.');
      parsed[key] = raw;
    } else if (key === 'refundHistoryComplete' || key === 'analyticsIsTest') {
      if (typeof raw !== 'boolean') return invalid('Potrditveno polje mora biti logična vrednost.');
      parsed[key] = raw;
    } else {
      if (raw === null || raw === '') parsed[key] = null;
      else if (typeof raw === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}$/.test(raw)) parsed[key] = raw;
      else return invalid('Identifikator stranke ali šolske enote ni veljaven.');
    }
  }
  if (parsed.refundHistoryComplete === true && Object.hasOwn(parsed, 'merchandiseRefundNet') && parsed.merchandiseRefundNet === null) return invalid('Potrjena evidenca vračil zahteva točen neto znesek, tudi kadar je 0.');
  return { expectedRevision: Number(record.expectedRevision), reason, fields: parsed as AnalyticsMeasurementFields };
}
