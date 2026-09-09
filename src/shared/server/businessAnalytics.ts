import { isPaidOrder, paidOrderCents, paidOrderNetCents } from '@/shared/domain/analytics/paidOrders';
import 'server-only';
import { parseBusinessOriginFilters, matchesBusinessQuoteFilters } from '@/shared/domain/analytics/filters';
import { quoteAnalyticsStart, type BusinessAnalyticsSettings } from '@/shared/domain/analytics/businessSettings';
import { readBusinessAnalyticsSettings } from '@/shared/server/businessAnalyticsSettings';
import { profileRoutePhase } from '@/shared/server/diagnostics/instrumentation';
import { buildBusinessActivity, parseBusinessActivityQuery, type BusinessActivityResponse } from '@/shared/domain/analytics/activity';
import { buildBusinessOrderPreview } from '@/shared/domain/analytics/orderPreview';
import { buildBusinessQuotePreview } from '@/shared/domain/analytics/quotePreview';
import type { PoolClient } from 'pg';
import { getPool } from '@/shared/server/db';
import { getShippingConfiguration } from '@/shared/server/shipping';
import { calculateShipping, type CalculatedShipping, type ShippingCalculationItemInput } from '@/shared/domain/shipping/shipping';
import { isCustomerType } from '@/shared/domain/order/customerType';
import { isOrderStatus } from '@/shared/domain/order/orderStatus';
import { aggregateBusinessAnalytics, isRealisedOrder, matchesBusinessFilters, orderHref, quoteDeadline, sumCents } from '@/shared/domain/analytics/metrics';
import { inPeriod, localDate, resolveBusinessPeriod } from '@/shared/domain/analytics/period';
import type { BusinessAnalyticsResponse, BusinessDrilldownResponse, BusinessFilters, BusinessRecord, CanonicalOrder, CanonicalQuote, CanonicalQuoteRequest } from '@/shared/domain/analytics/businessAnalytics';

export class BusinessAnalyticsInputError extends Error {}
export function parseBusinessFilters(params: URLSearchParams): BusinessFilters { const customerType = params.get('customerType') ?? 'all'; const status = params.get('status') ?? 'all'; const source = params.get('source') ?? 'all'; if (customerType !== 'all' && customerType !== 'unknown' && !isCustomerType(customerType)) throw new BusinessAnalyticsInputError('Neveljaven tip naročnika.'); if (status !== 'all' && !isOrderStatus(status)) throw new BusinessAnalyticsInputError('Neveljaven status.'); if (!['all', 'direct', 'quote'].includes(source)) throw new BusinessAnalyticsInputError('Neveljaven vir naročila.'); let origin: Pick<BusinessFilters, 'entrySource' | 'history'>; try { origin = parseBusinessOriginFilters(params); } catch (error) { throw new BusinessAnalyticsInputError(error instanceof Error ? error.message : 'Neveljaven filter.'); } return { ...origin, range: params.get('range') ?? '90D', from: params.get('from') ?? undefined, to: params.get('to') ?? undefined, customerType, status, source: source as BusinessFilters['source'] }; }
export function parseBusinessAsOf(value: string | null): Date { if (!value) return new Date(); const date = new Date(value); if (!Number.isFinite(date.getTime()) || date.getTime() > Date.now() + 1000) throw new BusinessAnalyticsInputError('Neveljaven referenčni čas.'); return date; }
function iso(value: unknown): string | null { if (value == null) return null; const date = value instanceof Date ? value : new Date(String(value)); return Number.isFinite(date.getTime()) ? date.toISOString() : null; }
function object(value: unknown): Record<string, unknown> { return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}; }
function nullableNumber(value: unknown): number | null { if (value == null || value === '') return null; const number = Number(value); return Number.isFinite(number) ? number : null; }
export function decimalCents(value: unknown): number | null { if (value == null || value === '') return null; const text = String(value); if (!/^-?\d+(?:\.\d{1,2})?$/.test(text)) return null; const negative = text.startsWith('-'); const [whole, fraction = ''] = text.replace('-', '').split('.'); const cents = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0')); const signed = negative ? -cents : cents; return signed <= BigInt(Number.MAX_SAFE_INTEGER) && signed >= BigInt(Number.MIN_SAFE_INTEGER) ? Number(signed) : null; }
const canonicalOrdersCandidatesSql = `
  with candidates as (
    select order_record.*,
      source_offer.quote_request_id,
      row_number() over (
        partition by case when not order_record.is_historical and source_offer.quote_request_id is not null then 'quote:' || source_offer.quote_request_id::text else 'order:' || order_record.id::text end
        order by order_record.created_at, order_record.id
      ) as opportunity_order_rank
    from orders order_record
    left join quote_offer_versions source_offer on source_offer.id = order_record.source_quote_offer_version_id
    left join quote_requests source_request on source_request.id = source_offer.quote_request_id
    where order_record.deleted_at is null
      and order_record.is_draft = false
      and order_record.analytics_is_test = false
      and coalesce(source_request.intake_source, '') <> 'admin_testing'
      and order_record.created_at < $1::timestamptz
  )
`;
const canonicalOrdersSql = (includeDetails: boolean, submittedFrom: boolean) => `${canonicalOrdersCandidatesSql}
  select candidate.id, candidate.order_number, candidate.created_at, candidate.analytics_submitted_at, candidate.entry_source, candidate.is_historical,
    candidate.analytics_snapshot_json, candidate.analytics_fulfilled_at, candidate.analytics_fulfilled_merchandise_net,
    candidate.customer_directory_profile_id, candidate.school_directory_row_id, candidate.customer_type,
    candidate.organization_name, candidate.contact_name, candidate.address_line1, candidate.address_line2,
    candidate.postal_code, candidate.city, candidate.country_code, candidate.gurs_house_number_id,
    candidate.contract_status, candidate.commitment_status, candidate.status, candidate.payment_status, candidate.source_quote_offer_version_id,
    candidate.subtotal, candidate.currency, candidate.merchandise_refund_net, candidate.refund_history_complete,
    candidate.shipping_tax_rate,
    ${includeDetails ? 'candidate.analytics_fulfilled_lines_json, candidate.shipping_snapshot_json, candidate.actual_packed_weight_grams, candidate.actual_carrier_cost_net, candidate.actual_parcel_count, candidate.preparation_minutes, candidate.actual_oversize,' : ''}
    coalesce(snapshot_lines.lines, '[]'::jsonb) as analytics_lines,
    snapshot_lines.original_subtotal_cents
  from candidates candidate
  left join lateral (
    select ${includeDetails ? `jsonb_agg(jsonb_build_object(
      'id', line_snapshot.id::text,
      'key', coalesce('variant:' || line_snapshot.catalog_variant_id::text, 'product:' || line_snapshot.catalog_item_id::text, 'sku:' || line_snapshot.sku),
      'name', line_snapshot.product_name,
      'category', coalesce(line_snapshot.category_path, line_snapshot.category_id, 'Nerazvrščeno'),
      'quantity', line_snapshot.quantity,
      'lineNetCents', (line_snapshot.line_net * 100)::bigint,
      'unitCostCents', (line_snapshot.historical_unit_cost_net * 100)::bigint
    ) order by line_snapshot.line_number)` : 'null::jsonb'} as lines,
      sum(line_snapshot.line_net * 100)::bigint as original_subtotal_cents
    from order_line_snapshots line_snapshot
    where line_snapshot.order_id = candidate.id
  ) snapshot_lines on true
  where candidate.opportunity_order_rank = 1
    ${submittedFrom ? 'and candidate.created_at >= $2::timestamptz' : ''}
  order by candidate.created_at, candidate.id
`;
export function mapCanonicalOrder(row: Record<string, unknown>): CanonicalOrder { const snapshot = object(row.analytics_snapshot_json); const snapshotOrigin = snapshot.origin === 'captured' ? 'captured' : snapshot.origin === 'legacy' ? 'legacy' : 'missing'; const currentAddress = { addressLine1: row.address_line1, addressLine2: row.address_line2, postalCode: row.postal_code, city: row.city, countryCode: row.country_code, gursHouseNumberId: row.gurs_house_number_id }; const type = String(snapshot.customerType ?? row.customer_type ?? 'unknown'); const linkedCustomer = row.school_directory_row_id ? `school:${row.school_directory_row_id}` : row.customer_directory_profile_id ? `profile:${row.customer_directory_profile_id}` : null; const initialCents = nullableNumber(snapshot.subtotalNetCents); const lineSubtotal = nullableNumber(row.original_subtotal_cents); const activityCents = row.currency !== 'EUR' ? null : snapshotOrigin === 'captured' ? initialCents : lineSubtotal ?? initialCents ?? decimalCents(row.subtotal); const contractEligible = row.contract_status === 'accepted' && row.commitment_status === 'binding'; const realised = contractEligible && (iso(row.analytics_fulfilled_at) !== null || row.is_historical === true && ['sent', 'finished'].includes(String(row.status))); return { id: String(row.id), number: String(row.order_number), submittedAt: iso(row.created_at)!, entrySource: row.entry_source === 'website' || row.entry_source === 'manual' ? row.entry_source : null, isHistorical: row.is_historical === true, realised, fulfilledAt: contractEligible ? iso(row.analytics_fulfilled_at) : null, customerKey: linkedCustomer, customerType: isCustomerType(type) ? type : 'unknown', customerName: String(snapshot.customerName ?? row.organization_name ?? row.contact_name ?? 'Nepovezan naročnik'), activityCents, fulfilledCents: contractEligible && row.currency === 'EUR' ? decimalCents(row.analytics_fulfilled_merchandise_net) : null, paymentStatus: typeof row.payment_status === 'string' ? row.payment_status : null, contractStatus: typeof row.contract_status === 'string' ? row.contract_status : null, paidCents: row.currency === 'EUR' ? decimalCents(row.subtotal) : null, refundCents: decimalCents(row.merchandise_refund_net), refundComplete: row.refund_history_complete === true, status: String(row.status), source: row.source_quote_offer_version_id ? 'quote' : 'direct', addressSnapshot: Object.keys(object(snapshot.address)).length ? object(snapshot.address) : currentAddress, snapshotOrigin, fulfilledLines: Array.isArray(row.analytics_fulfilled_lines_json) ? row.analytics_fulfilled_lines_json as CanonicalOrder['lines'] : undefined, shippingGrossCents: nullableNumber(snapshot.shippingGrossCents), shippingTaxRate: nullableNumber(snapshot.shippingTaxRate) ?? nullableNumber(row.shipping_tax_rate), shippingSnapshot: snapshot.shippingSnapshot ?? row.shipping_snapshot_json, packedWeightGrams: nullableNumber(row.actual_packed_weight_grams), carrierCostNetCents: decimalCents(row.actual_carrier_cost_net), parcelCount: nullableNumber(row.actual_parcel_count), preparationMinutes: nullableNumber(row.preparation_minutes), oversize: typeof row.actual_oversize === 'boolean' ? row.actual_oversize : null, lines: Array.isArray(row.analytics_lines) ? row.analytics_lines.map((value: unknown) => { const line = object(value); return { id: String(line.id), key: String(line.key), name: String(line.name), category: String(line.category), quantity: Number(line.quantity), lineNetCents: Number(line.lineNetCents), unitCostCents: nullableNumber(line.unitCostCents) }; }) : [] }; }
async function readOrders(client: PoolClient, asOf: Date, includeDetails = false, submittedFrom?: string): Promise<CanonicalOrder[]> { const result = await profileRoutePhase('db', 'business-orders', () => client.query(canonicalOrdersSql(includeDetails, submittedFrom !== undefined), submittedFrom === undefined ? [asOf.toISOString()] : [asOf.toISOString(), submittedFrom])); return result.rows.map(mapCanonicalOrder); }
async function readQuotes(client: PoolClient, asOf: Date, settings: BusinessAnalyticsSettings): Promise<CanonicalQuote[]> { const start = quoteAnalyticsStart(settings.quoteGoLiveDate); if (start === null) return []; const result = await profileRoutePhase('db', 'business-quotes', () => client.query(`
  with first_issue as (
    select distinct on (quote_request_id) quote_request_id, issued_at, subtotal, currency, customer_snapshot_json
    from quote_offer_versions
    where issued_at is not null and issued_at < $1::timestamptz
    order by quote_request_id, issued_at, version_number, id
  ), acceptance_facts as (
    select offer.quote_request_id, acceptance.accepted_at
    from quote_offer_acceptances acceptance
    join quote_offer_versions offer on offer.id = acceptance.quote_offer_version_id
    where acceptance.accepted_at < $1::timestamptz
    union all
    select quote_request_id, accepted_at from quote_offer_versions
    where accepted_at is not null and accepted_at < $1::timestamptz
  ), first_acceptance as (
    select quote_request_id, min(accepted_at) as accepted_at from acceptance_facts group by quote_request_id
  )
  select request.id, request.request_number, request.created_at, request.customer_type, request.intake_source,
    coalesce(request.organization_name, request.contact_name) as customer_name,
    first_issue.issued_at, first_issue.subtotal, first_issue.currency, first_issue.customer_snapshot_json, first_acceptance.accepted_at
  from quote_requests request
  join first_issue on first_issue.quote_request_id = request.id
  left join first_acceptance on first_acceptance.quote_request_id = request.id
  where request.voided_at is null and request.intake_source <> 'admin_testing'
    and first_issue.issued_at >= $2::timestamptz
    and not exists (select 1 from quote_offer_versions historical_offer join orders historical_order on historical_order.source_quote_offer_version_id = historical_offer.id where historical_offer.quote_request_id = request.id and historical_order.is_historical)
  order by first_issue.issued_at, request.id
`, [asOf.toISOString(), start])); return result.rows.map((row) => { const firstIssuedAt = iso(row.issued_at)!; const acceptedAt = iso(row.accepted_at); const deadline = quoteDeadline(firstIssuedAt); const snapshot = object(row.customer_snapshot_json); const type = String(snapshot.customerType ?? snapshot.customer_type ?? row.customer_type); return { id: String(row.id), number: String(row.request_number), createdAt: iso(row.created_at)!, entrySource: quoteEntrySource(row.intake_source), firstIssuedAt, acceptedAt, initialValueCents: row.currency === 'EUR' ? decimalCents(row.subtotal) : null, customerType: isCustomerType(type) ? type : 'unknown', customerName: String(snapshot.organizationName ?? snapshot.contactName ?? row.customer_name), mature: deadline <= asOf.toISOString(), acceptedInWindow: acceptedAt !== null && acceptedAt >= firstIssuedAt && acceptedAt <= deadline }; }); }
function quoteEntrySource(intake: unknown): 'website' | 'manual' | null { return intake === 'customer_web' ? 'website' : intake === 'admin_email' ? 'manual' : null; }
async function readQuoteRequests(client: PoolClient, asOf: Date, settings: BusinessAnalyticsSettings): Promise<CanonicalQuoteRequest[]> {
  const start = quoteAnalyticsStart(settings.quoteGoLiveDate);
  if (start === null) return [];
  const result = await profileRoutePhase('db', 'business-quote-requests', () => client.query(`
    select request.id, request.request_number, request.created_at, request.customer_type,
      coalesce(request.organization_name, request.contact_name) as customer_name, request.intake_source
    from quote_requests request
    where request.voided_at is null and request.intake_source <> 'admin_testing'
      and request.created_at >= $2::timestamptz and request.created_at < $1::timestamptz
      and not exists (select 1 from quote_offer_versions historical_offer join orders historical_order on historical_order.source_quote_offer_version_id = historical_offer.id where historical_offer.quote_request_id = request.id and historical_order.is_historical)
    order by request.created_at, request.id
  `, [asOf.toISOString(), start]));
  return result.rows.map(row => ({ id: String(row.id), number: String(row.request_number), createdAt: iso(row.created_at)!, customerType: isCustomerType(row.customer_type) ? row.customer_type : 'unknown', customerName: String(row.customer_name ?? 'Nepovezan naročnik'), entrySource: quoteEntrySource(row.intake_source) }));
}
async function withSnapshot<T>(work: (client: PoolClient) => Promise<T>): Promise<T> { const client = await (await getPool()).connect(); try { await client.query('begin isolation level repeatable read read only'); const result = await work(client); await client.query('commit'); return result; } catch (error) { await client.query('rollback'); throw error; } finally { client.release(); } }
export async function fetchBusinessActivityRecords(filters: BusinessFilters, asOf: Date = new Date()) { const period = resolveBusinessPeriod(filters, asOf); const records = await withSnapshot(async (client) => (await readOrders(client, asOf)).filter((order) => matchesBusinessFilters(order, filters) && inPeriod(order.submittedAt, period))); return { period, records }; }
async function replayShipping(client: PoolClient, orders: CanonicalOrder[], thresholdCents: number | null): Promise<BusinessAnalyticsResponse['shipping']['replay']> { const configuration = await getShippingConfiguration(client); const copy = structuredClone(configuration); if (thresholdCents !== null) { for (const rule of copy.orderValueDiscountRules) if (rule.enabled) rule.minMerchandiseValueCents = thresholdCents; } const points: BusinessAnalyticsResponse['shipping']['replay']['points'] = []; const originalAmounts: number[] = []; const replayAmounts: number[] = []; for (const order of orders) { const snapshot = object(order.shippingSnapshot); if (snapshot.status !== 'calculated' || !Array.isArray(snapshot.items) || order.parcelCount === null || order.shippingGrossCents === null) continue; const saved = snapshot as unknown as CalculatedShipping; const items: ShippingCalculationItemInput[] = saved.items.map((item) => ({ productId: item.productId, variantId: item.variantId, sku: item.sku, name: item.name, quantity: item.quantity, measurement: item.weightGrams !== null && item.lengthMm !== null && item.widthMm !== null && item.heightMm !== null ? { weightGrams: item.weightGrams, lengthMm: item.lengthMm, widthMm: item.widthMm, heightMm: item.heightMm } : null })); const replay = calculateShipping(copy, items, { merchandiseSubtotalCents: saved.merchandiseSubtotalCents, parcelCount: order.parcelCount }); if (replay.status !== 'calculated') continue; originalAmounts.push(order.shippingGrossCents); replayAmounts.push(replay.finalAmountCents); if (points.length < 300) points.push({ id: order.id, original: order.shippingGrossCents / 100, replay: replay.finalAmountCents / 100, href: orderHref(order) }); } return { usable: originalAmounts.length, originalCharges: sumCents(originalAmounts) ?? 0, replayCharges: sumCents(replayAmounts) ?? 0, configurationVersion: String(configuration.version), points }; }
export async function fetchBusinessAnalytics(params: URLSearchParams): Promise<BusinessAnalyticsResponse> { const filters = parseBusinessFilters(params); const asOf = parseBusinessAsOf(params.get('asOf')); const period = resolveBusinessPeriod(filters, asOf); const bins = params.has('bins') ? Number(params.get('bins')) : 12; if (!Number.isInteger(bins) || bins < 1 || bins > 100) throw new BusinessAnalyticsInputError('Število razredov mora biti med 1 in 100.'); const thresholdCents = params.has('thresholdCents') ? Number(params.get('thresholdCents')) : null; if (thresholdCents !== null && (!Number.isSafeInteger(thresholdCents) || thresholdCents < 0)) throw new BusinessAnalyticsInputError('Prag mora biti nenegativen znesek v centih.'); return withSnapshot(async (client) => { const view = params.get('view') ?? 'pregled'; const allOrders = await readOrders(client, asOf, ['artikli', 'postnina', 'laboratorij'].includes(view)); const settings = await readBusinessAnalyticsSettings(client); const quotes = await readQuotes(client, asOf, settings); const quoteRequests = await readQuoteRequests(client, asOf, settings); const activity = allOrders.filter((order) => matchesBusinessFilters(order, filters) && inPeriod(order.submittedAt, period)); const replay = ['postnina', 'laboratorij'].includes(view) ? await replayShipping(client, activity, thresholdCents) : undefined; return profileRoutePhase('transform', 'business-aggregate', async () => aggregateBusinessAnalytics({ allOrders, quotes, quoteRequests, settings, filters, period, asOf: asOf.toISOString(), bins, horizon: params.get('horizon') === '12' ? 12 : 24, replay })); }); }
function optionalBound(params: URLSearchParams, name: string): number | null { if (!params.has(name) || params.get(name)?.trim() === '') return null; const value = Number(params.get(name)); if (!Number.isFinite(value)) throw new BusinessAnalyticsInputError('Neveljavna meja razreda.'); return value; }
export async function fetchBusinessRecords(params: URLSearchParams, exportAll = false): Promise<BusinessDrilldownResponse> {
  const filters = parseBusinessFilters(params);
  const asOf = parseBusinessAsOf(params.get('asOf'));
  const period = resolveBusinessPeriod(filters, asOf);
  const kind = params.get('kind') ?? 'orders';
  const basis = params.get('basis') ?? 'activity';
  if (!['orders', 'quotes', 'requests'].includes(kind) || !['activity', 'paid', 'paid-net', 'realised', 'lorenz', 'mature', 'issued', 'quote-response', 'quote-decision', 'weight'].includes(basis)) {
    throw new BusinessAnalyticsInputError('Neveljavna populacija zapisov.');
  }
  const valueUnit = basis === 'quote-response' || basis === 'quote-decision' ? 'h' : basis === 'weight' ? 'kg' : 'EUR';
  const page = Math.max(1, Math.floor(Number(params.get('page')) || 1));
  const pageSize = 25;
  const min = optionalBound(params, 'min');
  const max = optionalBound(params, 'max');
  const population = optionalBound(params, 'lorenzPopulation');
  const topCustomerCount = optionalBound(params, 'topCustomerCount');
  if (topCustomerCount !== null && (!Number.isSafeInteger(topCustomerCount) || topCustomerCount < 0 || basis !== 'lorenz' || population !== null)) throw new BusinessAnalyticsInputError('Število vodilnih naročnikov mora biti nenegativno celo število na populaciji Lorenz.');
  if (population !== null && (population < 0 || population > 1)) throw new BusinessAnalyticsInputError('Delež naročnikov mora biti med 0 in 1.');
  const date = params.get('date');
  const inclusiveMax = params.get('last') === 'true' || params.get('inclusiveMax') === 'true';
  const acceptsValue = (value: number | null) => (min === null || value !== null && value >= min) && (max === null || value !== null && (inclusiveMax ? value <= max : value < max));
  const finish = (records: BusinessRecord[]): BusinessDrilldownResponse => {
    records.sort((left, right) => right.date.localeCompare(left.date) || left.id.localeCompare(right.id));
    return { valueUnit, asOf: asOf.toISOString(), period, total: records.length, page, pageSize, records: exportAll ? records : records.slice((page - 1) * pageSize, page * pageSize) };
  };
  if (params.has('area')) {
    if (!['activity', 'paid'].includes(basis) || kind !== 'orders') throw new BusinessAnalyticsInputError('Geografski izbor uporablja prikazani datum naročila.');
    const geographyParams = new URLSearchParams(params);
    geographyParams.set('export', 'orders');
    geographyParams.set('asOf', asOf.toISOString());
    const { fetchGeography } = await import('@/shared/server/geographyAnalytics');
    const geography = await fetchGeography(geographyParams);
    return finish((geography.selected?.records ?? []).filter((record) => acceptsValue(record.value) && (!date || localDate(record.date) === date) && (!params.get('orderId') || record.id === params.get('orderId'))));
  }
  return withSnapshot(async (client) => {
    if (kind === 'requests') {
      const settings = await readBusinessAnalyticsSettings(client);
      const requests = await readQuoteRequests(client, asOf, settings);
      return finish(requests.filter(row => matchesBusinessQuoteFilters(row, filters) && inPeriod(row.createdAt, period) && (!date || localDate(row.createdAt) === date)).map(row => ({ id: row.id, number: row.number, date: row.createdAt, customerType: row.customerType, customerName: row.customerName, status: 'Prejeto povpraševanje', source: 'quote', entrySource: row.entrySource, value: null, href: `/admin/orders/quotes/${row.id}` })));
    }
    if (kind === 'quotes' || basis.startsWith('quote-')) {
      if (filters.source === 'direct' || filters.status !== 'all') return finish([]);
      const settings = await readBusinessAnalyticsSettings(client);
      const quotes = await readQuotes(client, asOf, settings);
      const responseBasis = basis === 'quote-response';
      const decisionBasis = basis === 'quote-decision';
      const value = (quote: CanonicalQuote): number | null => responseBasis
        ? (Date.parse(quote.firstIssuedAt) - Date.parse(quote.createdAt)) / 3600000
        : decisionBasis
          ? quote.acceptedAt ? (Date.parse(quote.acceptedAt) - Date.parse(quote.firstIssuedAt)) / 3600000 : null
          : quote.initialValueCents === null ? null : quote.initialValueCents / 100;
      return finish(quotes.filter((quote) =>
        inPeriod(quote.firstIssuedAt, period)
        && matchesBusinessQuoteFilters(quote, filters)
        && (basis === 'issued' || (responseBasis || decisionBasis ? !decisionBasis || quote.acceptedAt !== null : quote.mature))
        && acceptsValue(value(quote))
        && (!date || localDate(quote.firstIssuedAt) === date)
        && (!params.get('quoteId') || quote.id === params.get('quoteId'))
      ).map((quote) => ({
        id: quote.id, number: quote.number, date: quote.firstIssuedAt, customerType: quote.customerType,
        customerName: quote.customerName,
        status: quote.acceptedInWindow ? 'Sprejeto v 30 dneh' : quote.mature ? 'Ni sprejeto v 30 dneh' : 'Nezrelo okno',
        source: 'quote', entrySource: quote.entrySource, valueUnit, value: value(quote), href: `/admin/orders/quotes/${quote.id}`
      })));
    }
    const allOrders = await readOrders(client, asOf, params.has('productKey') || basis === 'weight');
    const orders = allOrders.filter((order) => matchesBusinessFilters(order, filters));
    const firstMonthByCustomer = new Map<string, string>();
    for (const order of orders) {
      if (!order.customerKey || !isPaidOrder(order)) continue;
      const month = localDate(order.submittedAt).slice(0, 7);
      const previous = firstMonthByCustomer.get(order.customerKey);
      if (!previous || month < previous) firstMonthByCustomer.set(order.customerKey, month);
    }
    let lorenzCustomers: Set<string> | null = null;
    if (basis === 'lorenz' && (population !== null || topCustomerCount !== null)) {
      const customerValues = new Map<string, bigint>();
      for (const order of orders) {
        const cents = paidOrderCents(order);
        if (!order.customerKey || cents === null || cents < 0 || !isPaidOrder(order) || !inPeriod(order.submittedAt, period)) continue;
        customerValues.set(order.customerKey, (customerValues.get(order.customerKey) ?? 0n) + BigInt(cents));
      }
      const rankedDescending = [...customerValues].sort((left, right) => left[1] === right[1] ? 0 : left[1] < right[1] ? 1 : -1);
      const selected = topCustomerCount !== null ? rankedDescending.slice(0, topCustomerCount) : rankedDescending.reverse().slice(0, Math.ceil(rankedDescending.length * population! - 1e-10));
      lorenzCustomers = new Set(selected.map(([key]) => key));
    }
    const realised = basis === 'realised' && !params.has('cohort');
    const paid = basis === 'paid' || basis === 'paid-net' || basis === 'lorenz' || params.has('cohort');
    const value = (order: CanonicalOrder): number | null => {
      if (basis === 'weight') return order.packedWeightGrams === null ? null : order.packedWeightGrams / 1000;
      if (paid) { const cents = basis === 'paid-net' ? paidOrderNetCents(order) : paidOrderCents(order); return cents === null ? null : cents / 100; }
      if (realised) return order.fulfilledCents !== null && order.refundComplete && order.refundCents !== null ? (order.fulfilledCents - order.refundCents) / 100 : null;
      return order.activityCents === null ? null : order.activityCents / 100;
    };
    return finish(orders.filter((order) => {
      const eventDate = order.submittedAt;
      const cohort = params.get('cohort');
      const cohortMonth = params.has('cohortMonth') ? Number(params.get('cohortMonth')) : null;
      const fulfilledMonth = isPaidOrder(order) ? localDate(order.submittedAt).slice(0, 7) : null;
      const elapsedMonths = cohort && fulfilledMonth ? (Number(fulfilledMonth.slice(0, 4)) - Number(cohort.slice(0, 4))) * 12 + Number(fulfilledMonth.slice(5, 7)) - Number(cohort.slice(5, 7)) : null;
      return (!realised || isRealisedOrder(order, asOf.toISOString()))
        && (!paid || isPaidOrder(order))
        && (cohort ? !!order.customerKey && firstMonthByCustomer.get(order.customerKey) === cohort && (cohortMonth === null || elapsedMonths === cohortMonth) : inPeriod(eventDate, period))
        && (basis !== 'lorenz' || !!order.customerKey && paidOrderCents(order) !== null && paidOrderCents(order)! >= 0)
        && (basis !== 'weight' || order.packedWeightGrams !== null)
        && (!lorenzCustomers || !!order.customerKey && lorenzCustomers.has(order.customerKey))
        && acceptsValue(value(order))
        && (!date || eventDate !== null && localDate(eventDate) === date)
        && (!params.get('orderId') || order.id === params.get('orderId'))
        && (!params.get('customerKey') || order.customerKey === params.get('customerKey'))
        && (!params.get('productKey') || (realised ? order.fulfilledLines ?? order.lines : order.lines).some((line) => line.key === params.get('productKey')))
        && (!params.get('sourceGroup') || order.source === params.get('sourceGroup'));
    }).map((order) => ({
      id: order.id, number: order.number, date: order.submittedAt,
      customerType: order.customerType, customerName: order.customerName, status: order.status, paymentStatus: order.paymentStatus,
      source: order.source, entrySource: order.entrySource, isHistorical: order.isHistorical, valueUnit, value: value(order), href: orderHref(order)
    })));
  });
}
export function businessRecordsCsv(records: BusinessRecord[]): string { const quote = (value: unknown) => { const text = value === null ? 'Manjka podatek' : String(value); const safe = typeof value !== 'number' && /^[=+@\-]/.test(text) ? `'${text}` : text; return `"${safe.replaceAll('"', '""')}"`; }; return '\ufeff' + [['ID', 'Številka', 'Datum naročila / prve izdaje / prejema UTC', 'Tip naročnika', 'Naročnik', 'Status', 'Status plačila', 'Potek', 'Način vnosa', 'Zgodovinsko naročilo', 'Vrednost izbrane metrike', 'Enota (EUR brez DDV in poštnine, h ali kg)'], ...records.map((record) => [record.id, record.number, record.date, record.customerType, record.customerName, record.status, record.paymentStatus ?? '', record.source, record.entrySource ?? 'unknown', record.isHistorical === undefined ? '' : record.isHistorical ? 'Da' : 'Ne', record.value, record.valueUnit ?? 'EUR'])].map((row) => row.map(quote).join(';')).join('\r\n'); }

/** Read canonical opportunities once, without loading order or operational details. */
export async function fetchBusinessQuotePreview(asOf = new Date()) {
  return withSnapshot(async (client) => { const settings = await readBusinessAnalyticsSettings(client); return buildBusinessQuotePreview(await readQuotes(client, asOf, settings), asOf, settings); });
}

/** Project order summaries on the server; never serialize historical order rows to the table client. */
export async function fetchBusinessOrderPreview(asOf = new Date(), filters: Pick<BusinessFilters, 'entrySource' | 'history'> = {}) {
  return withSnapshot(async (client) => buildBusinessOrderPreview(await readOrders(client, asOf), asOf, filters));
}

/** Read only the viewport's submitted orders, after globally deduplicating quote opportunities. */
export async function fetchBusinessActivity(params: URLSearchParams): Promise<BusinessActivityResponse> {
  const asOf = new Date();
  const { window, filters } = parseBusinessActivityQuery(params, asOf);
  return withSnapshot(async client => {
    const history = await profileRoutePhase('db', 'business-activity-history', () => client.query(
      `${canonicalOrdersCandidatesSql}
       select min(created_at) as history_from
       from candidates where opportunity_order_rank = 1`,
      [window.asOf]
    ));
    const firstRecordedAt = iso(history.rows[0]?.history_from);
    const orders = await readOrders(client, asOf, false, window.start);
    return profileRoutePhase('transform', 'business-activity-days', async () =>
      buildBusinessActivity(orders, window, filters, firstRecordedAt ? localDate(firstRecordedAt) : null)
    );
  });
}
