import { normalizeManualDraftCustomer } from '@/shared/domain/order/manualDraftCustomer';
import 'server-only';
import { validateLockedOrderStatusDocuments } from './orderStatusDocuments';
import { NextResponse } from 'next/server';
import type { PoolClient } from 'pg';
import { getOrderNumberAvailability } from './orders';
import { getGursAddressById } from './gursAddresses';
import { getPool } from './db';
import { getAuditActor, insertAuditEventForRequest } from './audit';
import { revalidateAdminOrderPaths } from './revalidateAdminOrders';
import { HISTORICAL_OPERATION_MESSAGE, HistoricalOrderInputError, normalizeHistoricalFacts } from '@/shared/domain/order/historicalOrder';

export async function rejectHistoricalOrderOperation(orderId: number) {
  const pool = await getPool();
  const result = await pool.query('select is_historical from orders where id = $1', [orderId]);
  return result.rows[0]?.is_historical === true
    ? NextResponse.json({ code: 'ORDER_HISTORICAL_OPERATION_BLOCKED', message: HISTORICAL_OPERATION_MESSAGE }, { status: 409 })
    : null;
}
const facts = (row: Record<string, unknown>) => Object.fromEntries([
  'created_at', 'recorded_at', 'original_reference_system', 'original_reference', 'historical_fulfilled_at', 'historical_payment_at',
  'historical_revision', 'admin_order_notes', 'is_draft', 'status', 'payment_status', 'subtotal', 'tax', 'shipping', 'total',
  'merchandise_refund_net', 'refund_history_complete', 'contract_status', 'commitment_status', 'pricing_revision',
  'order_number', 'customer_type', 'organization_name', 'contact_name', 'email', 'address_line1', 'address_line2',
  'postal_code', 'city', 'country_code', 'gurs_house_number_id', 'reference', 'notes'
].map(key => [key, row[key] ?? null]));

const CUSTOMER_TYPES = new Set(['individual', 'company', 'school']);
const CUSTOMER_FIELDS = [
  ['organizationName', 'organization_name', true], ['contactName', 'contact_name', false], ['email', 'email', false],
  ['addressLine1', 'address_line1', true], ['addressLine2', 'address_line2', true], ['postalCode', 'postal_code', true],
  ['city', 'city', true], ['countryCode', 'country_code', false], ['reference', 'reference', true], ['notes', 'notes', true]
] as const;
const CUSTOMER_COLUMNS = ['customer_type', ...CUSTOMER_FIELDS.map(([, column]) => column), 'gurs_house_number_id', 'order_number'];
class HistoricalDetailsConflictError extends Error {
  constructor(readonly code: string, message: string) { super(message); }
}

async function historicalCustomerPatch(body: Record<string, unknown>, current: Record<string, unknown>, client: PoolClient) {
  const patch: Record<string, string | null> = {};
  if (Object.hasOwn(body, 'customerType')) {
    const value = typeof body.customerType === 'string' ? body.customerType.trim() : '';
    if (!CUSTOMER_TYPES.has(value)) throw new HistoricalOrderInputError('Tip naročnika ni veljaven.');
    patch.customer_type = value;
  }
  for (const [field, column, nullable] of CUSTOMER_FIELDS) {
    if (!Object.hasOwn(body, field)) continue;
    const value = body[field];
    if (value === null && nullable) { patch[column] = null; continue; }
    if (typeof value !== 'string') throw new HistoricalOrderInputError('Podatki naročnika niso veljavni.');
    const clean = field === 'countryCode' ? value.trim().toUpperCase() : value.trim();
    patch[column] = nullable ? clean || null : clean;
  }
  if (patch.country_code && patch.country_code !== 'SI') throw new HistoricalOrderInputError('Za naročilo je podprta samo država Slovenija (SI).');
  const next = (column: string) => String((Object.hasOwn(patch, column) ? patch[column] : current[column]) ?? '').trim();
  const addressChanged = ['address_line1', 'postal_code', 'city', 'country_code'].some(column =>
    Object.hasOwn(patch, column) && next(column) !== String(current[column] ?? '').trim());
  if (Object.hasOwn(body, 'gursHouseNumberId')) {
    if (body.gursHouseNumberId !== null && typeof body.gursHouseNumberId !== 'string') throw new HistoricalOrderInputError('Izbrani naslov ni veljaven.');
    const requestedId = typeof body.gursHouseNumberId === 'string' ? body.gursHouseNumberId.trim() || null : null;
    if (requestedId) {
      const canonical = await getGursAddressById(requestedId, client);
      if (!canonical) throw new HistoricalOrderInputError('Izbranega naslova ni več v imeniku GURS. Poiščite ga znova.');
      if (next('address_line1') !== canonical.addressLine1 || next('postal_code') !== canonical.postalCode || next('city') !== canonical.postalName || next('country_code') !== 'SI') {
        throw new HistoricalOrderInputError('Izbrani naslov se ne ujema z naslovnimi podatki. Izberite predlog znova.');
      }
      patch.gurs_house_number_id = canonical.gursHouseNumberId;
    } else patch.gurs_house_number_id = null;
  } else if (addressChanged) patch.gurs_house_number_id = null;
  if (Object.hasOwn(body, 'orderNumber')) {
    if (typeof body.orderNumber !== 'string') throw new HistoricalOrderInputError('Vnesite veljavno številko naročila.');
    const number = body.orderNumber.trim();
    if (number) {
      const availability = await getOrderNumberAvailability(number, Number(current.id), 0);
      if (availability.normalizedOrderNumber === null) throw new HistoricalOrderInputError('Vnesite veljavno številko naročila.');
      if (!availability.isAvailable) throw new HistoricalDetailsConflictError('ORDER_NUMBER_DUPLICATE', 'Številka naročila je že zasedena.');
      patch.order_number = availability.formattedOrderNumber;
    }
  }
  return patch;
}

export async function handleHistoricalOrderDetails(request: Request, orderId: number, body: Record<string, unknown>) {
  const pool = await getPool(), client = await pool.connect();
  try {
    await client.query('begin');
    const result = await client.query('select * from orders where id = $1 for update', [orderId]), current = result.rows[0] as Record<string, unknown> | undefined;
    if (!current?.is_historical) { await client.query('rollback'); return null; }
    if (current.deleted_at) { await client.query('rollback'); return NextResponse.json({ message: 'Izbrisani zapis je treba najprej obnoviti.' }, { status: 409 }); }
    const metadata = Object.keys(body).some(key => key.startsWith('historical') || key.startsWith('originalReference') || key === 'expectedHistoricalRevision');
    if (!metadata) {
      await client.query('rollback');
      return current.is_draft ? null : NextResponse.json({ code: 'ORDER_HISTORICAL_OPERATION_BLOCKED', message: HISTORICAL_OPERATION_MESSAGE }, { status: 409 });
    }
    const actor = await getAuditActor(request);
    if (!actor.actor_id?.startsWith('admin:')) { await client.query('rollback'); return NextResponse.json({ message: 'Potrebna je prijava.' }, { status: 401 }); }
    const next = normalizeHistoricalFacts(body, current);
    if (next.expectedRevision !== String(current.historical_revision)) { await client.query('rollback'); return NextResponse.json({ code: 'ORDER_HISTORICAL_CONFLICT', message: 'Zapis je medtem spremenil drug skrbnik. Ponovno ga naložite.' }, { status: 409 }); }
    if (next.complete && current.is_draft && String(body.expectedPricingRevision ?? '') !== String(current.pricing_revision)) { await client.query('rollback'); return NextResponse.json({ code: 'ORDER_HISTORICAL_PRICING_CONFLICT', message: 'Postavke so bile medtem spremenjene. Pred zaključkom jih ponovno preverite.' }, { status: 409 }); }
    const customerPatch = await historicalCustomerPatch(body, current, client);
    if (next.complete) {
      const counts = await client.query('select count(*)::int as count from order_items where order_id = $1', [orderId]);
      const customer = normalizeManualDraftCustomer({ ...current, ...customerPatch }, 'order');
      const contact = String(customer.contact_name ?? '').trim();
      if (!counts.rows[0]?.count || !contact) throw new HistoricalOrderInputError('Pred zaključkom vnesite naročnika in vsaj eno postavko z izvornimi zneski.');
    }
    if (next.status !== current.status || (next.complete && current.is_draft)) {
      const documentBlock = await validateLockedOrderStatusDocuments(client, orderId, current, next.status);
      if (documentBlock) {
        await client.query('rollback');
        return NextResponse.json(documentBlock, { status: 409 });
      }
    }
    const hold = await client.query("select 1 from order_stock_holds where order_id = $1 and state = 'held' limit 1", [orderId]);
    if (hold.rowCount) throw new HistoricalOrderInputError('Zgodovinski zapis ne sme imeti rezervacije zaloge.');
    const accepted = ['in_progress', 'partially_sent', 'sent', 'finished'].includes(next.status) || ['paid', 'refunded'].includes(next.paymentStatus);
    await client.query("select set_config('atehna.historical_order_write', 'allowed', true)");
    const updated = await client.query([
      'update orders set original_reference_system=$2, original_reference=$3, created_at=$4,',
      'historical_fulfilled_at=$5, historical_payment_at=$6, status=$7, payment_status=$8,',
      "shipping=$9, automatic_shipping=null, shipping_snapshot_json=jsonb_build_object('version',1,'origin','historical','amountGross',$9::numeric),",
      'shipping_override_json=null, shipping_override_stale=false, total=subtotal+tax+$9::numeric,',
      'merchandise_refund_net=$10, refund_history_complete=$11, is_draft=not $12,',
      'stock_enforcement_applied=false, historical_revision=historical_revision+1, admin_order_notes=$15,',
      'pricing_revision=pricing_revision+case when shipping is distinct from $9::numeric then 1 else 0 end,',
      ...CUSTOMER_COLUMNS.map(column => column + "=case when $16::jsonb ? '" + column + "' then $16::jsonb ->> '" + column + "' else " + column + ' end,'),
      "contract_status=case when $13 then 'accepted' else 'pending_seller_acceptance' end,",
      "commitment_status=case when $13 then 'binding' else 'pending_confirmation' end,",
      'contract_accepted_at=null, committed_at=null,',
      "contract_accepted_actor_type=case when $13 then 'legacy_backfill' else null end,",
      'contract_accepted_actor_id=case when $13 then $14 else null end,',
      "contract_acceptance_evidence_json=case when $13 then jsonb_build_object('channel','historical_entry','originalReference',$3::text,'originalSystem',$2::text,'acceptanceTimeKnown',false) else null end,",
      'contract_rejected_at=null, contract_rejected_actor_type=null, contract_rejected_actor_id=null,',
      'contract_rejection_reason=null, contract_rejection_evidence_json=null where id=$1 returning *'
    ].join('\n'), [orderId, next.originalReferenceSystem, next.originalReference, next.orderDate, next.fulfilledAt, next.paymentAt,
      next.status, next.paymentStatus, next.shipping, next.refund, next.refundComplete, next.complete, accepted, actor.actor_id, next.notes, JSON.stringify(customerPatch)]);
    const after = updated.rows[0];
    await client.query('insert into order_historical_changes (order_id,revision,actor_id,before_json,after_json) values ($1,$2,$3,$4::jsonb,$5::jsonb)',
      [orderId, after.historical_revision, actor.actor_id, JSON.stringify(facts(current)), JSON.stringify(facts(after))]);
    await insertAuditEventForRequest(request, { entityType: 'order', entityId: String(orderId), entityLabel: String(current.order_number),
      action: 'updated', summary: next.complete && current.is_draft ? 'Zgodovinsko naročilo: vnos zaključen' : 'Zgodovinsko naročilo: izvorna dejstva posodobljena',
      metadata: { is_historical: true, historical_revision: String(after.historical_revision), before: facts(current), after: facts(after) }
    }, client);
    await client.query('commit');revalidateAdminOrderPaths(orderId);
    return NextResponse.json({ success: true, isDraft: after.is_draft, historicalRevision: String(after.historical_revision), pricingRevision: Number(after.pricing_revision) });
  } catch (error) {
    await client.query('rollback');
    if (error instanceof HistoricalDetailsConflictError) return NextResponse.json({ code: error.code, message: error.message }, { status: 409 });
    if ((error as { code?: string; constraint?: string }).code === '23505' && (error as { constraint?: string }).constraint === 'orders_order_number_key')
      return NextResponse.json({ code: 'ORDER_NUMBER_DUPLICATE', message: 'Številka naročila je že zasedena.' }, { status: 409 });
    if (error instanceof HistoricalOrderInputError) return NextResponse.json({ message: error.message }, { status: 400 });
    if ((error as { code?: string; constraint?: string }).code === '23505' && (error as { constraint?: string }).constraint === 'orders_original_reference_unique')
      return NextResponse.json({ code: 'ORDER_ORIGINAL_REFERENCE_DUPLICATE', message: 'Naročilo iz tega sistema s to izvorno številko že obstaja, tudi če je arhivirano ali v košu.' }, { status: 409 });
    throw error;
  } finally { client.release(); }
}
