export const BUSINESS_TIMEZONE = 'Europe/Ljubljana' as const;
export const BUSINESS_PERIOD_PRESETS = ['30D', '90D', '180D', '1Y', '2Y', 'YTD'] as const;
export type BusinessPeriod = { range: string; from: string; to: string; start: string; endExclusive: string; partialToday: boolean; dayCount: number; comparison: { from: string; to: string; start: string; endExclusive: string; label: string } };
const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: BUSINESS_TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
const parts = (date: Date) => Object.fromEntries(formatter.formatToParts(date).filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]));
export function localDate(date: Date | string): string { const value = parts(new Date(date)); return `${value.year}-${value.month}-${value.day}`; }
export function validCalendarDate(value: string): boolean { if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false; const date = new Date(`${value}T12:00:00Z`); return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value; }
export function addCalendarDays(value: string, days: number): string { const date = new Date(`${value}T12:00:00Z`); date.setUTCDate(date.getUTCDate() + days); return date.toISOString().slice(0, 10); }
export function shiftCalendarYears(value: string, years: number): string { const [year, month, day] = value.split('-').map(Number); const maxDay = new Date(Date.UTC(year + years, month, 0)).getUTCDate(); return `${year + years}-${String(month).padStart(2, '0')}-${String(Math.min(day, maxDay)).padStart(2, '0')}`; }
/** Convert a local calendar clock to UTC, never advance local dates with 24-hour durations. */
export function localInstant(date: string, clock = '00:00:00', milliseconds = 0): Date { const target = Date.parse(`${date}T${clock}Z`) + milliseconds; let instant = target; for (let attempt = 0; attempt < 5; attempt += 1) { const rendered = parts(new Date(instant)); const local = Date.parse(`${rendered.year}-${rendered.month}-${rendered.day}T${rendered.hour}:${rendered.minute}:${rendered.second}Z`) + milliseconds; const correction = target - local; if (!correction) break; instant += correction; } return new Date(instant); }
export function calendarDates(from: string, to: string): string[] { const result: string[] = []; for (let cursor = from; cursor <= to; cursor = addCalendarDays(cursor, 1)) { result.push(cursor); if (result.length > 3660) throw new Error('Obdobje je omejeno na deset let.'); } return result; }
export function resolveBusinessPeriod(input: { range?: string | null; from?: string | null; to?: string | null }, asOf = new Date()): BusinessPeriod {
  const today = localDate(asOf); const requested = (input.range ?? '90D').toUpperCase(); const range = requested === 'CUSTOM' ? 'custom' : (BUSINESS_PERIOD_PRESETS as readonly string[]).includes(requested) ? requested : '90D';
  let to = today; let from: string;
  if (range === 'custom') { if (!input.from || !input.to || !validCalendarDate(input.from) || !validCalendarDate(input.to)) throw new Error('Izberite veljaven začetni in končni datum.'); if (input.from > input.to || input.from > today) throw new Error('Začetni datum mora biti pred končnim datumom in ne sme biti v prihodnosti.'); from = input.from; to = input.to > today ? today : input.to; }
  else if (range === 'YTD') from = `${today.slice(0, 4)}-01-01`;
  else if (range === '1Y' || range === '2Y') from = addCalendarDays(shiftCalendarYears(today, range === '1Y' ? -1 : -2), 1);
  else from = addCalendarDays(today, -(Number(range.slice(0, -1)) - 1));
  const dayCount = calendarDates(from, to).length; const partialToday = to === today;
  const start = localInstant(from).toISOString(); const endExclusive = partialToday ? asOf.toISOString() : localInstant(addCalendarDays(to, 1)).toISOString();
  const currentParts = parts(asOf); const clock = `${currentParts.hour}:${currentParts.minute}:${currentParts.second}`;
  const comparisonFrom = range === 'YTD' ? shiftCalendarYears(from, -1) : addCalendarDays(from, -dayCount);
  const comparisonTo = range === 'YTD' ? shiftCalendarYears(to, -1) : addCalendarDays(to, -dayCount);
  const comparisonEnd = partialToday ? localInstant(comparisonTo, clock, asOf.getUTCMilliseconds()) : localInstant(addCalendarDays(comparisonTo, 1));
  return { range, from, to, start, endExclusive, partialToday, dayCount, comparison: { from: comparisonFrom, to: comparisonTo, start: localInstant(comparisonFrom).toISOString(), endExclusive: comparisonEnd.toISOString(), label: range === 'YTD' ? 'Enako pretečeno obdobje prejšnjega leta' : 'Predhodno primerljivo obdobje' } };
}
export function inPeriod(timestamp: string | null, window: Pick<BusinessPeriod, 'start' | 'endExclusive'>): boolean { return timestamp !== null && timestamp >= window.start && timestamp < window.endExclusive; }
