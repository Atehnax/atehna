import { BUSINESS_PERIOD_PRESETS, BUSINESS_TIMEZONE, calendarDates, localDate, resolveBusinessPeriod, type BusinessPeriod } from './period';

export class WebsiteTrafficInputError extends Error {}
export type WebsiteCounts = { pageViews: number; productViews: number; visits: number; visitors: number; returningVisitors: number; firstObservedVisitors: number };
export type WebsiteBreakdown = { key: string | null; views: number; visits: number; visitors: number };
export type WebsiteDay = { date: string; pageViews: number | null; visits: number | null; visitors: number | null; returningVisitors: number | null; available: boolean; partial: boolean };
export type WebsiteCohort = { date: string; visitors: number; eligible: boolean; returnedD7: number | null; rateD7: number | null };
export type WebsiteQueryResult = {
  summary: WebsiteCounts;
  days: Array<Omit<WebsiteDay, 'available' | 'partial'>>;
  pages: WebsiteBreakdown[];
  products: WebsiteBreakdown[];
  cohorts: Array<Omit<WebsiteCohort, 'rateD7'>>;
  coverage: { historyFrom: string | null; latestEventAt: string | null; missingVisitorPageViews: number; missingSessionPageViews: number; missingProductViews: number; missingPathPageViews: number };
};
export type WebsiteTraffic = Omit<WebsiteQueryResult, 'days' | 'cohorts'> & {
  asOf: string; timezone: typeof BUSINESS_TIMEZONE; period: BusinessPeriod; days: WebsiteDay[]; cohorts: WebsiteCohort[];
  retention: { eligibleVisitors: number; returnedD7: number; immatureVisitors: number; rateD7: number | null };
};

export function websitePeriod(params: URLSearchParams, now = new Date()) {
  const requested = params.get('asOf');
  const asOf = requested ? new Date(requested) : now;
  if (!Number.isFinite(asOf.getTime()) || asOf.getTime() > now.getTime() + 1000) throw new WebsiteTrafficInputError('Neveljaven referenčni čas.');
  const range = params.get('range') ?? (params.has('from') || params.has('to') ? 'custom' : '90D');
  if (range !== 'custom' && !(BUSINESS_PERIOD_PRESETS as readonly string[]).includes(range)) throw new WebsiteTrafficInputError('Neveljavno obdobje.');
  try { return { asOf, period: resolveBusinessPeriod({ range, from: params.get('from'), to: params.get('to') }, asOf) }; }
  catch (error) { throw new WebsiteTrafficInputError(error instanceof Error ? error.message : 'Neveljavno obdobje.'); }
}

export function completeWebsiteTraffic(raw: WebsiteQueryResult, period: BusinessPeriod, asOf: Date): WebsiteTraffic {
  const byDay = new Map(raw.days.map(day => [day.date, day]));
  const historyDay = raw.coverage.historyFrom ? localDate(raw.coverage.historyFrom) : null;
  const days = calendarDates(period.from, period.to).map(date => {
    const recorded = byDay.get(date);
    const available = historyDay !== null && date >= historyDay;
    return { date, available, partial: period.partialToday && date === period.to,
      pageViews: available ? recorded?.pageViews ?? 0 : null,
      visits: available ? recorded?.visits ?? 0 : null,
      visitors: available ? recorded?.visitors ?? 0 : null,
      returningVisitors: available ? recorded?.returningVisitors ?? 0 : null };
  });
  const cohorts = raw.cohorts.map(row => ({ ...row, returnedD7: row.eligible ? row.returnedD7 : null, rateD7: row.eligible && row.visitors > 0 && row.returnedD7 !== null ? row.returnedD7 / row.visitors : null }));
  const eligibleVisitors = cohorts.filter(row => row.eligible).reduce((sum, row) => sum + row.visitors, 0);
  const returnedD7 = cohorts.filter(row => row.eligible).reduce((sum, row) => sum + (row.returnedD7 ?? 0), 0);
  const immatureVisitors = cohorts.filter(row => !row.eligible).reduce((sum, row) => sum + row.visitors, 0);
  return { ...raw, asOf: asOf.toISOString(), timezone: BUSINESS_TIMEZONE, period, days, cohorts, retention: { eligibleVisitors, returnedD7, immatureVisitors, rateD7: eligibleVisitors ? returnedD7 / eligibleVisitors : null } };
}

export const WEBSITE_EXPORTS = ['days', 'pages', 'products', 'cohorts'] as const;
export type WebsiteExport = typeof WEBSITE_EXPORTS[number];
export function websiteExportRows(data: WebsiteTraffic, kind: WebsiteExport): { columns: string[]; rows: Array<Array<string | number | null>> } {
  if (kind === 'days') return { columns: ['Datum', 'Ogledi strani', 'Obiski (seje)', 'Obiskovalci', 'Vračajoči obiskovalci', 'Razpoložljivost', 'Delni dan'], rows: data.days.map(row => [row.date, row.pageViews, row.visits, row.visitors, row.returningVisitors, row.available ? 'Zabeleženo obdobje' : 'Pred začetkom zgodovine', row.partial ? 'Da' : 'Ne']) };
  if (kind === 'cohorts') return { columns: ['Prvi zabeleženi dan', 'Obiskovalci', 'D7 zrelost', 'Vrnitve D7', 'Delež D7 (0–1)'], rows: data.cohorts.map(row => [row.date, row.visitors, row.eligible ? 'Zrela' : 'Še nezrela', row.returnedD7, row.rateD7]) };
  return { columns: [kind === 'pages' ? 'Pot strani' : 'ID artikla', 'Ogledi', 'Obiski (seje)', 'Obiskovalci'], rows: data[kind].map(row => [row.key, row.views, row.visits, row.visitors]) };
}
export function websiteCsv(data: WebsiteTraffic, kind: WebsiteExport) {
  const { columns, rows } = websiteExportRows(data, kind);
  const cell = (value: string | number | null) => {
    const text = String(value ?? '');
    return '"' + (typeof value === 'string' && /^[=+@\-\t\r]/.test(text) ? "'" : '') + text.replaceAll('"', '""') + '"';
  };
  return '\ufeff' + [columns, ...rows].map(row => row.map(cell).join(';')).join('\r\n');
}
