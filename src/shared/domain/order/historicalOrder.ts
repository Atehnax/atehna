import { localInstant } from '../analytics/period';
import { isOrderStatus } from './orderStatus';
import { isPaymentStatus } from './paymentStatus';
import { toDateInputValue } from './dateTime';

export class HistoricalOrderInputError extends Error {}
export const HISTORICAL_OPERATION_MESSAGE = 'Zgodovinski zapis ne sproža zaloge, obvestil ali novih dokumentov. Podatke uredite v naročilu.';
const present = (body: Record<string, unknown>, key: string, fallback: unknown) => Object.hasOwn(body, key) ? body[key] : fallback;

export function historicalDate(value: unknown, label: string, nullable = true): string | null {
  if (value === null || value === undefined || value === '') {
    if (nullable) return null;
    throw new HistoricalOrderInputError(label + ' je obvezen.');
  }
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}(?:T[\d:.]+(?:Z|[+-]\d{2}:\d{2}))?$/.test(value)) throw new HistoricalOrderInputError(label + ' ni veljaven.');
  const calendar = new Date(value.slice(0, 10) + 'T00:00:00.000Z');
  if (!Number.isFinite(calendar.getTime()) || calendar.toISOString().slice(0, 10) !== value.slice(0, 10)) throw new HistoricalOrderInputError(label + ' ni veljaven datum.');
  const date = value.length === 10 ? localInstant(value) : new Date(value);
  if (!Number.isFinite(date.getTime()) || date.getTime() > Date.now()) throw new HistoricalOrderInputError(label + ' mora biti veljaven pretekli datum.');
  return date.toISOString();
}
export function historicalMoney(value: unknown, label: string, nullable = false): string | null {
  if ((value === null || value === undefined || value === '') && nullable) return null;
  const text = typeof value === 'number' ? String(value) : typeof value === 'string' ? value.trim().replace(',', '.') : '';
  if (!/^\d{1,10}(?:\.\d{1,2})?$/.test(text) || Number(text) > 9999999999.99) throw new HistoricalOrderInputError(label + ' mora biti nenegativen znesek z največ dvema decimalkama.');
  return Number(text).toFixed(2);
}
export function historicalReference(system: unknown, reference: unknown, required = false) {
  const clean = (value: unknown, max: number) => {
    if (value === undefined || value === null || value === '') return null;
    if (typeof value !== 'string' || !value.trim() || value.trim().length > max || /[\u0000-\u001f]/.test(value)) throw new HistoricalOrderInputError('Izvorni sistem ali referenca ni veljavna.');
    return value.trim();
  };
  const originalReferenceSystem = clean(system, 80), originalReference = clean(reference, 200);
  if ((originalReferenceSystem === null) !== (originalReference === null) || (required && originalReference === null)) throw new HistoricalOrderInputError('Vnesite izvorni sistem in izvorno številko naročila.');
  return { originalReferenceSystem, originalReference };
}
export function normalizeHistoricalFacts(body: Record<string, unknown>, current: Record<string, unknown>) {
  const revision = body.expectedHistoricalRevision;
  if ((typeof revision !== 'string' && typeof revision !== 'number') || !/^\d+$/.test(String(revision))) throw new HistoricalOrderInputError('Manjka različica zgodovinskega zapisa.');
  if (Object.hasOwn(body, 'historicalComplete') && typeof body.historicalComplete !== 'boolean') throw new HistoricalOrderInputError('Zaključek zgodovinskega vnosa ni veljaven.');
  const complete = body.historicalComplete === true || current.is_draft === false;
  const refs = historicalReference(present(body, 'originalReferenceSystem', current.original_reference_system), present(body, 'originalReference', current.original_reference), complete);
  const iso = (value: unknown) => value instanceof Date ? value.toISOString() : value;
  const submittedDate = present(body, 'orderDate', iso(current.created_at));
  const unchangedDay = typeof submittedDate === 'string' && submittedDate.length === 10 && submittedDate === toDateInputValue(current.created_at as string | Date);
  const orderDate = historicalDate(unchangedDay ? iso(current.created_at) : submittedDate, 'Datum naročila', false)!;
  const fulfilledAt = historicalDate(present(body, 'historicalFulfilledAt', iso(current.historical_fulfilled_at)), 'Datum odpreme');
  const paymentAt = historicalDate(present(body, 'historicalPaymentAt', iso(current.historical_payment_at)), 'Datum plačila');
  if (Object.hasOwn(body, 'historicalFulfilledAt') && fulfilledAt && fulfilledAt < orderDate) throw new HistoricalOrderInputError('Datum odpreme ne sme biti pred datumom naročila.');
  const status = present(body, 'historicalStatus', current.status), paymentStatus = present(body, 'historicalPaymentStatus', current.payment_status);
  if (typeof status !== 'string' || !isOrderStatus(status) || typeof paymentStatus !== 'string' || !isPaymentStatus(paymentStatus)) throw new HistoricalOrderInputError('Status zgodovinskega naročila ali plačila ni veljaven.');
  const shipping = historicalMoney(present(body, 'historicalShippingGross', current.shipping), 'Izvorna poštnina')!;
  const refund = historicalMoney(present(body, 'historicalRefundNet', current.merchandise_refund_net), 'Neto vračilo', true);
  const refundComplete = present(body, 'historicalRefundHistoryComplete', current.refund_history_complete);
  if (typeof refundComplete !== 'boolean' || (refundComplete && refund === null)) throw new HistoricalOrderInputError('Potrjena evidenca vračil zahteva znan znesek, tudi kadar je 0.');
  const notes = present(body, 'historicalNotes', current.admin_order_notes ?? '');
  if (typeof notes !== 'string' || notes.length > 10000 || notes.includes('\u0000')) throw new HistoricalOrderInputError('Opombe imajo lahko največ 10.000 znakov.');
  return { notes, ...refs, expectedRevision: String(revision), complete, orderDate, fulfilledAt, paymentAt, status, paymentStatus, shipping, refund, refundComplete };
}
