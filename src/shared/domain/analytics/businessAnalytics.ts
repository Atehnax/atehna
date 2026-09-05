import type { CustomerType } from '@/shared/domain/order/customerType';
import type { DescriptiveStatistics, HistogramBin, Regression, QuoteRate, DistributionFit } from './statistics';
import type { BusinessPeriod } from './period';

export const BUSINESS_VIEWS = ['pregled', 'narocila', 'ponudbe', 'stranke', 'artikli', 'postnina', 'zemljevid', 'laboratorij'] as const;
export type BusinessView = typeof BUSINESS_VIEWS[number];
export type BusinessFilters = { range: string; from?: string; to?: string; customerType: CustomerType | 'all' | 'unknown'; status: string; source: 'all' | 'direct' | 'quote' };
export type BusinessDay = { date: string; orderCount: number; activityValue: number; valueCount: number; available: boolean; partial: boolean; previousDate: string | null; previousCount: number | null; previousValue: number | null; rollingCount7: number | null; rollingValue7: number | null };
export type BusinessPoint = { id: string; label: string; x: number; y: number; customerType: string; source: string; href: string; residual?: number; parcelCount?: number | null; oversize?: boolean | null; shippingChargeNet?: number | null };
export type BusinessBox = { key: string; label: string; n: number; minimum: number | null; q1: number | null; median: number | null; q3: number | null; maximum: number | null; lowerWhisker: number | null; upperWhisker: number | null; outliers: number[] };
export type CustomerConcentration = { customers: { key: string; label: string; value: number; netValue: number | null; orders: number; cumulativeShare: number; href: string }[]; totalCustomers: number; linkedOrders: number; unlinkedOrders: number; top5Share: number | null; top10Share: number | null; gini: number | null; lorenz: { population: number; share: number }[] };
export type QuoteBand = QuoteRate & { key: string; label: string; min?: number; max?: number | null; customerType?: string; href: string };
export type BusinessAnalyticsResponse = {
  asOf: string; timezone: 'Europe/Ljubljana'; period: BusinessPeriod; filters: BusinessFilters;
  definitions: { activity: string; realised: string; quotes: string; costs: string; statistics: string };
  coverage: { historyFrom: string | null; legacyOrders: number; snapshotOrders: number; valueOrders: number; eligibleOrders: number; realisedOrders: number; realisedValueOrders: number; refundKnownOrders: number; linkedCustomers: number; warnings: string[] };
  summary: { orderCount: number; activityValue: number | null; realisedValue: number | null; realisedCount: number; meanOrderValue: number | null; medianOrderValue: number | null; quoteAcceptance: QuoteRate; previousOrderCount: number | null; previousActivityValue: number | null; previousRealisedValue: number | null };
  days: BusinessDay[];
  orders: { statistics: DescriptiveStatistics; histogram: HistogramBin[]; boxes: BusinessBox[]; sourceBoxes: BusinessBox[] };
  quotes: { mature: QuoteRate; immature: number; acceptedAfterWindow: number; missingInitialValue: number; byValue: QuoteBand[]; byType: QuoteBand[]; responseStatistics: DescriptiveStatistics; decisionStatistics: DescriptiveStatistics; responseHistogram: HistogramBin[]; decisionHistogram: HistogramBin[]; logistic: { available: boolean; reason: string | null; intercept: number | null; slope: number | null; points: { value: number; probability: number }[] } };
  customers: CustomerConcentration;
  cohorts: { horizon: number; historyLeftTruncated: boolean; linkedOrders: number; rows: { month: string; customers: number; retention: (number | null)[] }[] };
  products: { points: { key: string; label: string; units: number; contributionPerUnit: number | null; value: number; category: string; orders: number; costCoveredUnits: number; href: string }[]; soldUnits: number; costCoveredUnits: number };
  shipping: { points: BusinessPoint[]; total: number; usable: number; coveredCharge: number; uncoveredCost: number | null; statistics: DescriptiveStatistics; replay: { usable: number; originalCharges: number; replayCharges: number; configurationVersion: string | null; points: { id: string; original: number; replay: number; href: string }[] } };
  workload: { points: BusinessPoint[]; total: number; usable: number; regression: Regression; preparationStatistics: DescriptiveStatistics };
  laboratory: { points: BusinessPoint[]; plotted: number; total: number; positiveCount: number; nonPositiveCount: number; valueCdf: { value: number; probability: number }[]; weightCdf: { value: number; probability: number }[]; distribution: DistributionFit; binomialSource: QuoteRate };
};
export type BusinessRecord = { valueUnit?: 'EUR' | 'h' | 'kg'; id: string; number: string; date: string; customerType: string; customerName: string; status: string; source: string; value: number | null; href: string };
export type BusinessDrilldownResponse = { valueUnit?: 'EUR' | 'h' | 'kg'; asOf: string; period: BusinessPeriod; total: number; page: number; pageSize: number; records: BusinessRecord[] };
export type CanonicalOrder = {
  id: string; number: string; submittedAt: string; fulfilledAt: string | null; customerKey: string | null; customerType: string; customerName: string;
  activityCents: number | null; fulfilledCents: number | null; refundCents: number | null; refundComplete: boolean; status: string; source: 'direct' | 'quote';
  addressSnapshot: Record<string, unknown>; snapshotOrigin: 'captured' | 'legacy' | 'missing'; shippingGrossCents: number | null; shippingTaxRate: number | null; shippingSnapshot: unknown;
  packedWeightGrams: number | null; carrierCostNetCents: number | null; parcelCount: number | null; preparationMinutes: number | null; oversize: boolean | null;
  fulfilledLines?: CanonicalOrder['lines'];
  lines: { id: string; key: string; name: string; category: string; quantity: number; lineNetCents: number; unitCostCents: number | null }[];
};
export type CanonicalQuote = { id: string; number: string; createdAt: string; firstIssuedAt: string; acceptedAt: string | null; initialValueCents: number | null; customerType: string; customerName: string; mature: boolean; acceptedInWindow: boolean };
