import {
  addExact, compareExact, EXACT_ZERO, formatExactDecimal, multiplyExact, parseExactDecimal, divideExact
} from './decimal';
import { calculatePricingStockRow, normalizePricingStockCell, PRICING_STOCK_LIMITS } from './calculation';
import { pricingStockValidationIssues } from './formula';
import {
  pricingStockIssue, PRICING_STOCK_EDITABLE_FIELDS,
  type PricingStockEditableField, type PricingStockModel,
  type PricingStockValidationIssue, type PricingStockValues
} from './types';

export type PricingStockBulkOperation =
  | { kind: 'inventory-set' | 'inventory-adjust' | 'sale-adjust-money' | 'sale-adjust-percent' | 'work-set'; value: string }
  | { kind: 'recommended-price' };
export type PricingStockBulkPreview = {
  rows: Array<{
    variantId: number;
    field: PricingStockEditableField;
    previous: string | null;
    proposed: string | null;
    changed: boolean;
  }>;
  errors: Array<PricingStockValidationIssue & { variantId: number }>;
  rounding: 'half-away-from-zero';
  decimalPlaces: 2 | 4 | 0;
};

/** Pure proposal only. The caller must show this result before applying or saving it. */
export function previewPricingStockBulk<T extends PricingStockValues & { variantId: number }>(
  rows: readonly T[], model: PricingStockModel, operation: PricingStockBulkOperation
): PricingStockBulkPreview {
  const field: PricingStockEditableField = operation.kind.startsWith('inventory') ? 'inventory'
    : operation.kind === 'work-set' ? 'workMinutes' : 'saleNet';
  const preview: PricingStockBulkPreview = {
    rows: [], errors: [], rounding: 'half-away-from-zero',
    decimalPlaces: field === 'inventory' ? 0 : field === 'workMinutes' ? 4 : 2
  };
  const seen = new Set<number>();
  for (const row of rows) {
    try {
      if (seen.has(row.variantId)) throw pricingStockIssue('variantId', 'DUPLICATE_VARIANT', 'Različica je izbrana večkrat.');
      seen.add(row.variantId);
      const previous = field === 'inventory' ? String(row.inventory) : row[field];
      let proposed: string | null;
      if (operation.kind === 'inventory-set' || operation.kind === 'work-set') {
        proposed = normalizePricingStockCell(field, operation.value);
        if (proposed === null) throw pricingStockIssue(field, 'REQUIRED', 'Vnesite vrednost za skupinski popravek.');
      } else if (operation.kind === 'recommended-price') {
        const calculation = calculatePricingStockRow(row, model);
        if (calculation.errors.some((issue) => issue.code !== 'MISSING_VALUE') || calculation.recommendedPrice === null) {
          throw pricingStockIssue(field, 'MISSING_VALUE', 'Priporočene cene brez veljavne nabavne cene in ciljne RVC ni mogoče uporabiti.');
        }
        proposed = normalizePricingStockCell('saleNet', calculation.recommendedPrice);
      } else {
        if (previous === null) throw pricingStockIssue(field, 'MISSING_VALUE', 'Za popravek manjka trenutna vrednost.');
        const current = parseExactDecimal(previous, field);
        const delta = parseExactDecimal(operation.value, field);
        if (operation.kind === 'inventory-adjust' && delta.denominator !== 1n) {
          throw pricingStockIssue(field, 'INTEGER_REQUIRED', 'Sprememba zaloge mora biti celo število.');
        }
        const maxDelta = operation.kind === 'inventory-adjust' ? PRICING_STOCK_LIMITS.inventory
          : operation.kind === 'sale-adjust-percent' ? '1000000' : PRICING_STOCK_LIMITS.money;
        const absoluteDelta = delta.numerator < 0n ? { ...delta, numerator: -delta.numerator } : delta;
        if (compareExact(absoluteDelta, parseExactDecimal(maxDelta)) > 0) {
          throw pricingStockIssue(field, 'OUT_OF_RANGE', 'Sprememba presega dovoljeno velikost.');
        }
        const next = operation.kind === 'sale-adjust-percent'
          ? addExact(current, multiplyExact(current, divideExact(delta, parseExactDecimal('100'))))
          : addExact(current, delta);
        if (compareExact(next, EXACT_ZERO) < 0) {
          throw pricingStockIssue(field, 'OUT_OF_RANGE', 'Sprememba bi povzročila negativno vrednost.');
        }
        const maximum = field === 'inventory' ? PRICING_STOCK_LIMITS.inventory : PRICING_STOCK_LIMITS.money;
        if (compareExact(next, parseExactDecimal(maximum)) > 0) {
          throw pricingStockIssue(field, 'OUT_OF_RANGE', 'Rezultat presega dovoljeno velikost.');
        }
        // Preserve input precision until the single explicit storage boundary.
        proposed = normalizePricingStockCell(field, formatExactDecimal(next, preview.decimalPlaces));
      }
      preview.rows.push({
        variantId: row.variantId, field, previous, proposed, changed: proposed !== previous
      });
    } catch (error) {
      preview.errors.push(...pricingStockValidationIssues(error).map((issue) => ({ ...issue, variantId: row.variantId })));
    }
  }
  return preview;
}

export type PricingStockPasteResult = {
  rows: Array<Partial<Record<PricingStockEditableField, string | null>>>;
  errors: Array<PricingStockValidationIssue & { rowIndex: number; columnIndex: number }>;
};

function readTsv(text: string): string[][] {
  if (typeof text !== 'string' || text.length > 1_000_000) {
    throw pricingStockIssue('paste', 'PASTE_LIMIT', 'Prilepljeni podatki so preobsežni.');
  }
  const normalized = text.replace(/\r\n?/gu, '\n');
  const rows: string[][] = [];
  let cells: string[] = [];
  let value = '';
  let quoted = false;
  let closedQuote = false;
  const finishCell = () => { cells.push(value); value = ''; closedQuote = false; };
  const finishRow = () => {
    finishCell(); rows.push(cells); cells = [];
    if (rows.length > 5000) throw pricingStockIssue('paste', 'PASTE_LIMIT', 'Hkrati lahko prilepite največ 5000 vrstic.');
  };
  for (let index = 0; index < normalized.length; index += 1) {
    const char = normalized[index];
    if (quoted) {
      if (char === '"') {
        if (normalized[index + 1] === '"') { value += '"'; index += 1; }
        else { quoted = false; closedQuote = true; }
      } else { value += char; }
    } else if (char === '\t') finishCell();
    else if (char === '\n') finishRow();
    else if (closedQuote) throw pricingStockIssue('paste', 'INVALID_TSV', 'Neveljaven zapis za zaključenim narekovajem.');
    else if (char === '"' && value.length === 0) quoted = true;
    else value += char;
    if (cells.length > PRICING_STOCK_EDITABLE_FIELDS.length) {
      throw pricingStockIssue('paste', 'PASTE_COLUMNS', 'Prilepljeni podatki imajo preveč stolpcev.');
    }
  }
  if (quoted) throw pricingStockIssue('paste', 'INVALID_TSV', 'Prilepljeni podatki imajo nezaključen narekovaj.');
  if (value.length > 0 || cells.length > 0 || !normalized.endsWith('\n')) finishRow();
  return rows;
}

/** Positions are zero-based; no database writes or changes to the source rows. */
export function parsePricingStockPaste(
  text: string, fields: readonly PricingStockEditableField[]
): PricingStockPasteResult {
  const result: PricingStockPasteResult = { rows: [], errors: [] };
  try {
    if (fields.length === 0 || fields.length > PRICING_STOCK_EDITABLE_FIELDS.length
      || new Set(fields).size !== fields.length
      || fields.some((field) => !(PRICING_STOCK_EDITABLE_FIELDS as readonly string[]).includes(field))) {
      throw pricingStockIssue('paste', 'INVALID_FIELDS', 'Izberite začetno celico v uredljivem stolpcu.');
    }
    const grid = readTsv(text);
    for (const [rowIndex, cells] of grid.entries()) {
      const row: Partial<Record<PricingStockEditableField, string | null>> = {};
      for (const [columnIndex, cell] of cells.entries()) {
        try {
          const field = fields[columnIndex];
          if (!field) throw pricingStockIssue('paste', 'PASTE_COLUMNS', 'Prilepljeni stolpec sega izven uredljivih celic.');
          row[field] = normalizePricingStockCell(field, cell);
        } catch (error) {
          result.errors.push(...pricingStockValidationIssues(error).map((issue) => ({ ...issue, rowIndex, columnIndex })));
        }
      }
      result.rows.push(row);
    }
  } catch (error) {
    result.errors.push(...pricingStockValidationIssues(error).map((issue) => ({ ...issue, rowIndex: 0, columnIndex: 0 })));
  }
  return result;
}
